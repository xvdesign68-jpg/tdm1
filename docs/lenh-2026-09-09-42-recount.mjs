/* _l42_recount.mjs (= _l41_recount + LỆNH #42: bỏ lead vai người bán/chủ bài) — (1) CHẨN ĐOÁN: 6 lead mới nhất (kiểu dữ liệu brand/temp/score/detected_at) + so daily_stats {new,hot,junk} 4 ngày gần nhất với số đếm lại từ leads;
   (2) DỰNG LẠI tuyệt đối new/hot/warm/cold/junk theo NGÀY PHÁT HIỆN (VN) cho daily_stats N ngày gần nhất (set merge — field khác giữ nguyên). Chạy lại bao nhiêu lần cũng ra cùng số.
   Dùng: node _l42_recount.mjs [--dry] [--days=60]   (đặt trong ~/firebase-s13/functions, cạnh stats.js) */
import { vnDay, toMs, tempOf } from './stats.js';
/* Hàm THUẦN (harness dùng chung): leads → {brand__day: {brandCode, day, new, hot, warm, cold, junk}} cho ngày >= from; lead thiếu brand/detected_at bỏ qua (đếm vào skipped). */
export function newAgg(leads, from) {
  const agg = {}; const skipped = { noBrand: 0, noDet: 0 };
  (leads || []).forEach(l => { const brand = String((l && l.brand) || '').trim(); if (!brand) { skipped.noBrand++; return; }
    if (/^(seller|poster_self)$/.test(String(l.role || '')) || l.self_comment === true) { skipped.roleBad = (skipped.roleBad || 0) + 1; return; } /* LENH #42 */
    const det = toMs(l.detected_at); if (!det) { skipped.noDet++; return; } const day = vnDay(det); if (day < from) return;
    const k = brand + '__' + day; const o = agg[k] || (agg[k] = { brandCode: brand, day, new: 0, hot: 0, warm: 0, cold: 0, junk: 0 });
    const t = tempOf(l); if (t === 'junk') o.junk++; else { o.new++; o[t]++; } });
  return { agg, skipped };
}
export const kindOf = v => v == null ? 'null' : (typeof v === 'object' ? (typeof v.toMillis === 'function' ? 'Timestamp' : (v.seconds != null ? 'seconds-obj' : 'object')) : typeof v);

const isMain = process.argv[1] && /_l42_recount\.mjs$/.test(process.argv[1]);
if (isMain) {
  const { initializeApp, applicationDefault } = await import('firebase-admin/app'); const { getFirestore } = await import('firebase-admin/firestore');
  const DRY = process.argv.includes('--dry'); const dArg = process.argv.find(a => a.startsWith('--days=')); const DAYS = dArg ? Math.max(1, Number(dArg.slice(7)) || 60) : 60;
  initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
  const NOW = Date.now(), from = vnDay(NOW - (DAYS - 1) * 864e5);
  /* (1a) 6 lead mới nhất theo detected_at — xem kiểu dữ liệu + doc daily_stats ngày đó */
  const recent = await db.collection('leads').orderBy('detected_at', 'desc').limit(6).select('brand', 'temp', 'score', 'detected_at', 'stage', 'source', 'role', 'self_comment').get();
  console.log('=== 6 lead mới nhất (kiểu dữ liệu) ===');
  for (const d of recent.docs) { const l = d.data() || {}; const det = toMs(l.detected_at); console.log(' ', d.id, '| brand', JSON.stringify(l.brand), '| temp', JSON.stringify(l.temp), '| score', JSON.stringify(l.score), '(' + kindOf(l.score) + ')', '| detected_at', kindOf(l.detected_at), det ? vnDay(det) : 'KHONG-DOC-DUOC', '| tempOf', tempOf(l)); }
  /* (1b) đọc leads theo trang (select field cần) */
  const leads = []; let last = null, scanned = 0;
  for (;;) { let q = db.collection('leads').orderBy('__name__').select('brand', 'temp', 'score', 'detected_at', 'role', 'self_comment').limit(500); if (last) q = q.startAfter(last); const snap = await q.get(); if (snap.empty) break;
    snap.docs.forEach(d => { scanned++; leads.push(d.data() || {}); }); last = snap.docs[snap.docs.length - 1]; if (snap.size < 500) break; }
  const { agg, skipped } = newAgg(leads, from); const keys = Object.keys(agg).sort();
  /* (1c) so 4 ngày gần nhất: doc hiện có vs đếm lại */
  const d4 = vnDay(NOW - 3 * 864e5); const ks4 = keys.filter(k => agg[k].day >= d4);
  console.log('=== daily_stats 4 ngày gần nhất: hiện có → đếm lại (new/hot/junk) ===');
  for (const k of ks4) { const cur = await db.collection('daily_stats').doc(k).get(); const x = cur.exists ? (cur.data() || {}) : {}; const o = agg[k];
    const same = (Number(x.new) || 0) === o.new && (Number(x.hot) || 0) === o.hot && (Number(x.junk) || 0) === o.junk;
    console.log(' ', k, '| doc', (x.new ?? '∅') + '/' + (x.hot ?? '∅') + '/' + (x.junk ?? '∅'), '→ đếm lại', o.new + '/' + o.hot + '/' + o.junk, same ? '✓' : '✗ LỆCH'); }
  const perBrand = {}; keys.forEach(k => { const o = agg[k]; const p = perBrand[o.brandCode] || (perBrand[o.brandCode] = { days: 0, new: 0, hot: 0, junk: 0 }); p.days++; p.new += o.new; p.hot += o.hot; p.junk += o.junk; });
  console.log((DRY ? '[DRY] ' : '') + 'recount new/hot/warm/cold/junk: quét ' + scanned + ' lead (bỏ qua: không brand ' + skipped.noBrand + ', không detected_at ' + skipped.noDet + ', vai người bán/chủ bài ' + (skipped.roleBad || 0) + ') → ' + keys.length + ' doc daily_stats từ ' + from + ' (' + DAYS + ' ngày)');
  Object.keys(perBrand).sort().forEach(b => { const p = perBrand[b]; console.log('  ' + b + ': ' + p.days + ' ngày · lead hợp lệ ' + p.new + ' · nóng ' + p.hot + ' · rác ' + p.junk); });
  if (DRY) { console.log('DRY: không ghi. Chạy lại không --dry để ghi.'); process.exit(0); }
  let batch = db.batch(), n = 0, w = 0; const flush = async () => { if (n) { await batch.commit(); batch = db.batch(); n = 0; } };
  for (const k of keys) { const o = agg[k]; batch.set(db.collection('daily_stats').doc(k), { brandCode: o.brandCode, day: o.day, new: o.new, hot: o.hot, warm: o.warm, cold: o.cold, junk: o.junk, atMs: NOW }, { merge: true }); n++; w++; if (n >= 400) await flush(); }
  await flush(); console.log('ĐÃ GHI ' + w + ' doc daily_stats (new/hot/warm/cold/junk tuyệt đối, field khác giữ nguyên)');
}
