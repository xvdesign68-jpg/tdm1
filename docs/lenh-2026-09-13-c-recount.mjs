/* _lc_recount.mjs (= _l42_recount + LỆNH C PB-6: bỏ lead do MÁY loại; tempOf theo nhiệt độ HIỆN TẠI sau AI chấm lại) — (1) chẩn đoán: 6 lead mới nhất + so daily_stats 4 ngày gần nhất;
   (2) DỰNG LẠI tuyệt đối new/hot/warm/cold/junk theo NGÀY PHÁT HIỆN (VN) cho daily_stats N ngày (set merge — field khác giữ nguyên). Idempotent. Số KPI 14 ngày sẽ GIẢM (lead máy loại không còn đếm).
   Dùng: node _lc_recount.mjs [--dry] [--days=60]   (đặt trong ~/firebase-s13/functions, cạnh stats.js) */
import { vnDay, toMs, tempOf } from './stats.js';
export const MACHINE_BY_C = /^(rescore|rescore_role|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto)(:[\w-]+)?$/i; /* token máy CHÍNH XÁC (tuỳ chọn hậu tố :x) — email/uid người (có @ hoặc dài) không bao giờ khớp */
export const machineDropped = l => !!(l && l.dropped === true && MACHINE_BY_C.test(String(l.dropped_by || '')));
/* Hàm THUẦN (harness dùng chung): leads → {brand__day: {brandCode, day, new, hot, warm, cold, junk}} cho ngày >= from; bỏ: không brand/không detected_at/vai người bán/máy loại. */
export function newAgg(leads, from) {
  const agg = {}; const skipped = { noBrand: 0, noDet: 0, roleBad: 0, aiDropped: 0 };
  (leads || []).forEach(l => { const brand = String((l && l.brand) || '').trim(); if (!brand) { skipped.noBrand++; return; }
    if (/^(seller|poster_self)$/.test(String(l.role || '')) || l.self_comment === true) { skipped.roleBad++; return; } /* LENH #42 */
    if (machineDropped(l)) { skipped.aiDropped++; return; } /* LENH C (PB-6) */
    const det = toMs(l.detected_at); if (!det) { skipped.noDet++; return; } const day = vnDay(det); if (day < from) return;
    const k = brand + '__' + day; const o = agg[k] || (agg[k] = { brandCode: brand, day, new: 0, hot: 0, warm: 0, cold: 0, junk: 0 });
    const t = tempOf(l); if (t === 'junk') o.junk++; else { o.new++; o[t]++; } });
  return { agg, skipped };
}
const isMain = process.argv[1] && /_lc_recount\.mjs$/.test(process.argv[1]);
if (isMain) {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app'); const { getFirestore } = await import('firebase-admin/firestore');
  const DRY = process.argv.includes('--dry'); const dArg = process.argv.find(a => a.startsWith('--days=')); const DAYS = dArg ? Math.max(1, Number(dArg.slice(7)) || 60) : 60;
  initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
  const NOW = Date.now(), from = vnDay(NOW - (DAYS - 1) * 864e5);
  const leads = []; let last = null, scanned = 0;
  for (;;) { let q = db.collection('leads').orderBy('__name__').select('brand', 'temp', 'score', 'detected_at', 'role', 'self_comment', 'dropped', 'dropped_by').limit(300); if (last) q = q.startAfter(last); const snap = await q.get(); if (snap.empty) break;
    snap.docs.forEach(d => { scanned++; leads.push(d.data() || {}); }); last = snap.docs[snap.docs.length - 1]; if (snap.size < 300) break; }
  const { agg, skipped } = newAgg(leads, from); const keys = Object.keys(agg).sort();
  const d4 = vnDay(NOW - 3 * 864e5); const ks4 = keys.filter(k => agg[k].day >= d4);
  console.log('=== daily_stats 4 ngày gần nhất: hiện có → đếm lại (new/hot/junk) ===');
  for (const k of ks4) { const cur = await db.collection('daily_stats').doc(k).get(); const x = cur.exists ? (cur.data() || {}) : {}; const o = agg[k];
    const same = (Number(x.new) || 0) === o.new && (Number(x.hot) || 0) === o.hot && (Number(x.junk) || 0) === o.junk;
    console.log(' ', k, '| doc', (x.new ?? '∅') + '/' + (x.hot ?? '∅') + '/' + (x.junk ?? '∅'), '→ đếm lại', o.new + '/' + o.hot + '/' + o.junk, same ? '✓' : '✗ LỆCH (dự kiến: lead máy loại/đổi nhiệt trước LỆNH C)'); }
  const perBrand = {}; keys.forEach(k => { const o = agg[k]; const p = perBrand[o.brandCode] || (perBrand[o.brandCode] = { days: 0, new: 0, hot: 0, junk: 0 }); p.days++; p.new += o.new; p.hot += o.hot; p.junk += o.junk; });
  console.log((DRY ? '[DRY] ' : '') + 'recount new/hot/warm/cold/junk: quét ' + scanned + ' lead (bỏ qua: không brand ' + skipped.noBrand + ', không detected_at ' + skipped.noDet + ', vai người bán/chủ bài ' + skipped.roleBad + ', MÁY loại ' + skipped.aiDropped + ') → ' + keys.length + ' doc daily_stats từ ' + from + ' (' + DAYS + ' ngày)');
  Object.keys(perBrand).sort().forEach(b => { const p = perBrand[b]; console.log('  ' + b + ': ' + p.days + ' ngày · lead hợp lệ ' + p.new + ' · nóng ' + p.hot + ' · rác ' + p.junk); });
  if (DRY) { console.log('[DRY] không ghi gì.'); process.exit(0); }
  let wrote = 0; for (let i = 0; i < keys.length; i += 400) { const bw = db.batch(); for (const k of keys.slice(i, i + 400)) { const o = agg[k]; bw.set(db.collection('daily_stats').doc(k), { brandCode: o.brandCode, day: o.day, new: o.new, hot: o.hot, warm: o.warm, cold: o.cold, junk: o.junk, recountAt: NOW, recountBy: 'lenhC' }, { merge: true }); wrote++; } await bw.commit(); }
  /* doc trong khoảng mà không còn lead nào → đưa về 0 (không xoá field khác) */
  let zeroed = 0; const ex = await db.collection('daily_stats').where('day', '>=', from).select('brandCode', 'day', 'new').get();
  const bw2 = db.batch(); for (const d of ex.docs) { if (agg[d.id]) continue; const x = d.data() || {}; if (!(Number(x.new) || 0) && !(Number(x.hot) || 0)) continue; bw2.set(d.ref, { new: 0, hot: 0, warm: 0, cold: 0, junk: 0, recountAt: NOW, recountBy: 'lenhC' }, { merge: true }); zeroed++; } if (zeroed) await bw2.commit();
  console.log('ĐÃ GHI ' + wrote + ' doc daily_stats' + (zeroed ? ' + đưa về 0: ' + zeroed : '') + ' — F5 web: KPI 14 ngày + Bảng brand theo số mới (đã bỏ lead máy loại).');
}
