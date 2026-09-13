/* LỆNH C · KHỐI 3 (13/09/2026) — _lc_drop.mjs: đếm lại 2 cột `dropped` (người loại) / `aiDropped` (máy loại) của daily_stats theo NGÀY LOẠI (VN) trong 60 ngày.
   Vì sao: bộ đếm `dropped` trước LỆNH C cộng cả lead do MÁY loại (sweeper #46/#48 ngày 11–12/09 ≈ 270 lead) → Bảng brand hiện "loại 109" như sales bấm, "AI loại" = 0.
   Recount KHỐI 1 chỉ dựng lại new/hot/warm/cold/junk, KHÔNG đụng dropped → khối này dựng lại tuyệt đối 2 cột đó (docs trong cửa sổ, kể cả đưa về 0), `lost` không đụng.
   Quy tắc = đúng stats.js sau C: lead.dropped===true → dropped_by khớp regex máy → aiDropped, còn lại → dropped; ngày = dropped_at || rescored_at || detected_at (giờ VN).
   Mặc định DRY (chỉ in lệch); `--apply` mới ghi (set merge + recountDropBy:'lenhC'). Đọc theo TRANG 300 + select(). Đặt trong ~/firebase-s13/functions. Chạy lại = 0 ghi. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const APPLY = process.argv.includes('--apply'); const DAYS = 60; const OFF = 7 * 3600e3; const now = Date.now();
const MACHINE = /^(rescore|rescore_role|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto)(:[\w-]+)?$/i;
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const vnDay = t => new Date(t + OFF).toISOString().slice(0, 10);
const from = vnDay(now - (DAYS - 1) * 864e5);
export function aggDrops(leads, fromDay) { /* thuần — harness dùng */
  const agg = {}; const skip = { noBrand: 0, noDay: 0, old: 0 };
  for (const l of leads) { if (l.dropped !== true) continue; const b = String(l.brand || l.brand_hint || ''); if (b === '') { skip.noBrand++; continue; }
    const t = ms(l.dropped_at) || ms(l.rescored_at) || ms(l.detected_at); if (t === 0) { skip.noDay++; continue; } const day = vnDay(t); if (day < fromDay) { skip.old++; continue; }
    const k = b + '__' + day; const o = agg[k] || (agg[k] = { brandCode: b, day, dropped: 0, aiDropped: 0 }); if (MACHINE.test(String(l.dropped_by || ''))) o.aiDropped++; else o.dropped++; }
  return { agg, skip };
}
async function pageLeads() { const out = []; let last = null; for (;;) { let q = db.collection('leads').orderBy('__name__').limit(300).select('brand', 'brand_hint', 'dropped', 'dropped_by', 'dropped_at', 'rescored_at', 'detected_at'); if (last) q = q.startAfter(last); const s = await q.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ id: d.id }, d.data() || {}))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; } return out; }
const leads = await pageLeads(); const { agg, skip } = aggDrops(leads, from);
const ds = (await db.collection('daily_stats').where('day', '>=', from).get()).docs.map(d => Object.assign({ id: d.id }, d.data() || {}));
const cur = {}; ds.forEach(x => { cur[x.id] = x; });
console.log('== LỆNH C KHỐI 3 recount dropped/aiDropped ' + (APPLY ? '(ÁP)' : '[DRY]') + ' — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
console.log('lead quét ' + leads.length + ' · đã loại ' + leads.filter(l => l.dropped === true).length + ' (bỏ: không brand ' + skip.noBrand + ', không mốc ' + skip.noDay + ', trước ' + from + ' ' + skip.old + ') · daily_stats trong cửa sổ ' + ds.length + ' doc');
const byB = {}; Object.values(agg).forEach(o => { const s = byB[o.brandCode] || (byB[o.brandCode] = { dropped: 0, aiDropped: 0 }); s.dropped += o.dropped; s.aiDropped += o.aiDropped; });
console.log('theo brand (60 ngày, theo ngày loại): ' + Object.keys(byB).sort().map(b => b + ' người ' + byB[b].dropped + ' / máy ' + byB[b].aiDropped).join(' · '));
const keys = new Set([...Object.keys(agg), ...ds.filter(x => (Number(x.dropped) || 0) > 0 || (Number(x.aiDropped) || 0) > 0).map(x => x.id)]);
const changes = []; for (const k of keys) { const want = agg[k] || { brandCode: k.split('__')[0], day: k.split('__')[1], dropped: 0, aiDropped: 0 }; const have = cur[k] || {}; const hd = Number(have.dropped) || 0, ha = Number(have.aiDropped) || 0; if (hd !== want.dropped || ha !== want.aiDropped) changes.push({ k, want, hd, ha }); }
changes.sort((a, b) => a.k < b.k ? -1 : 1);
changes.slice(0, 40).forEach(c => console.log('  ' + c.k.padEnd(30) + ' dropped ' + c.hd + ' → ' + c.want.dropped + '  aiDropped ' + c.ha + ' → ' + c.want.aiDropped));
if (changes.length > 40) console.log('  … +' + (changes.length - 40) + ' doc nữa');
if (changes.length === 0) { console.log('KHỚP hết — không có gì để ghi.'); process.exit(0); }
if (APPLY === false) { console.log('[DRY] sẽ ghi ' + changes.length + ' doc (set merge dropped/aiDropped + recountDropBy). Chạy lại với --apply để ghi.'); process.exit(0); }
let n = 0; for (let i = 0; i < changes.length; i += 400) { const bw = db.batch(); for (const c of changes.slice(i, i + 400)) { bw.set(db.collection('daily_stats').doc(c.k), { brandCode: c.want.brandCode, day: c.want.day, dropped: c.want.dropped, aiDropped: c.want.aiDropped, recountDropBy: 'lenhC', recountDropAt: now }, { merge: true }); n++; } await bw.commit(); }
console.log('ĐÃ GHI ' + n + ' doc daily_stats (dropped/aiDropped). Web: F5 Bảng brand → cột "Không thành / loại · AI loại" đúng.');
