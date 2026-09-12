/* LỆNH B — ĐO LAG PHÁT HIỆN LEAD (13/09/2026) — CHỈ ĐỌC. Chốt mục tiêu tốc độ của hướng B (mốc gốc #47: trung vị 11′ · p95 36′ · <15′ 69,6 %).
   Khác `_lb_after.mjs` mục 6 (đo TRỘN mọi lead 24 h): script này (1) CHỈ lấy lead sinh SAU deploy B (có `brand_hint`), (2) tách BAN NGÀY 08–22 VN ↔ ĐÊM (đêm nhịp ×2 theo thiết kế, không so với mốc),
   (3) theo brand · theo bậc nhịp của group (group_state g_<gid>) · theo group · theo giờ, (4) phân bố bucket <5/5–10/10–15/15–30/30–60/≥60′, (5) kết luận tự động khi đủ ≥20 mẫu ban ngày.
   LAG = detected_at (lúc SmartLead ghi lead) − time (giờ đăng bài do BrightData trả) → gồm cả độ trễ BrightData lập chỉ mục + chờ tới nhịp gieo + chờ snapshot chín + tick 3′.
   Chạy: `node _lb_lag.mjs [số giờ, mặc định 24]`. Đọc theo TRANG ≤300 + select() (bài học #36/#37/#47). Đặt trong ~/firebase-s13/functions. Không ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now(), H = Math.min(168, Math.max(1, Number(process.argv[2]) || 24));
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const hourVN = v => new Date(ms(v) + OFF).getUTCHours();
const pct = (a, b) => b ? Math.round(100 * a / b) + ' %' : '—';
const srt = arr => arr.slice().sort((x, y) => x - y); const med = arr => { const a = srt(arr); return a.length ? a[Math.floor(a.length / 2)] : 0; }; const pq = (arr, p) => { const a = srt(arr); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0; };
const stat = arr => arr.length ? 'n ' + arr.length + ' · trung vị ' + Math.round(med(arr)) + '′ · p75 ' + Math.round(pq(arr, 0.75)) + '′ · p95 ' + Math.round(pq(arr, 0.95)) + '′ · <15′ ' + pct(arr.filter(x => x < 15).length, arr.length) : 'n 0';
const BK = [[0, 5, '<5′'], [5, 10, '5–10′'], [10, 15, '10–15′'], [15, 30, '15–30′'], [30, 60, '30–60′'], [60, 1e9, '≥60′']];
const buckets = arr => BK.map(([a, b, l]) => l + ' ' + arr.filter(x => x >= a && x < b).length).join(' · ');
async function pageAll(q, orderField, sel, max) { const out = []; let last = null; while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (sel && sel.length) qq = qq.select(...sel); if (last) qq = qq.startAfter(last); const s = await qq.get(); s.docs.forEach(d => out.push(Object.assign({ id: d.id }, d.data()))); if (s.size < 300) break; last = s.docs[s.docs.length - 1]; } return out; }
console.log('== LỆNH B — LAG PHÁT HIỆN ' + H + ' h gần nhất — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
const L = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - H * 3600e3)), 'detected_at', ['kind', 'brand', 'brand_hint', 'gid', 'source', 'post_id', 'detected_at', 'time', 'ai_scored'], 6000);
const gs = (await db.collection('group_state').get().catch(() => ({ docs: [] }))).docs.map(d => Object.assign({ id: d.id }, d.data()));
const gById = {}; gs.forEach(g => { gById[g.id] = g; }); const bandOf = l => { const g = l.gid ? gById['g_' + String(l.gid)] : null; return g ? (g.band || '?') + ' ' + (g.iv || '?') + '′' : '(không rõ)'; };
const rows = L.filter(l => l.kind !== 'comment' && l.time && ms(l.detected_at)).map(l => Object.assign({ lag: (ms(l.detected_at) - ms(l.time)) / 60000, day: hourVN(l.detected_at) >= 8 && hourVN(l.detected_at) < 22 }, l)).filter(r => r.lag >= 0 && r.lag < 24 * 60);
const cmt = L.filter(l => l.kind === 'comment').length, bad = L.length - cmt - rows.length;
const postB = rows.filter(r => r.brand_hint), preB = rows.filter(r => !r.brand_hint);
console.log('1. Lead ' + H + ' h: ' + L.length + ' (lead-bài đo được ' + rows.length + ' · comment-lead ' + cmt + ' bỏ qua · thiếu time/lệch ' + bad + ')  →  SAU B (có brand_hint) ' + postB.length + ' · TRƯỚC B ' + preB.length + (postB.length ? ' · lead sau B đầu tiên ' + hm(postB[0].detected_at) : ''));
console.log('   mốc gốc #47 (trước B, 30 ngày): trung vị 11′ · p95 36′ · <15′ 69,6 %');
console.log('2. TRƯỚC B (chỉ để so):  ' + stat(preB.map(r => r.lag)) + (preB.length ? '  |  ' + buckets(preB.map(r => r.lag)) : ''));
const dayB = postB.filter(r => r.day), nightB = postB.filter(r => !r.day);
console.log('3. SAU B — BAN NGÀY 08–22 VN (so với mốc):  ' + stat(dayB.map(r => r.lag)) + (dayB.length ? '  |  ' + buckets(dayB.map(r => r.lag)) : ''));
console.log('   SAU B — ĐÊM 22–08 VN (nhịp ×2 theo thiết kế, không so mốc):  ' + stat(nightB.map(r => r.lag)) + (nightB.length ? '  |  ' + buckets(nightB.map(r => r.lag)) : ''));
{ const by = {}; dayB.forEach(r => { const k = r.brand_hint || '?'; (by[k] = by[k] || []).push(r.lag); }); const ks = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
  console.log('4. SAU B ban ngày theo BRAND: ' + (ks.length ? '' : '(chưa có)')); ks.forEach(k => console.log('   ' + k + ': ' + stat(by[k]))); }
{ const by = {}; postB.forEach(r => { const k = bandOf(r); (by[k] = by[k] || []).push(r.lag); }); const ks = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
  console.log('5. SAU B (ngày+đêm) theo BẬC NHỊP group lúc đo (band hiện tại của group_state, có thể đã đổi): ' + (ks.length ? '' : '(chưa có)')); ks.forEach(k => console.log('   ' + k + ': ' + stat(by[k]))); }
{ const by = {}; postB.forEach(r => { const k = (r.gid ? 'g_' + r.gid : '(không gid)') + ' ' + String(r.source || '').slice(0, 28); (by[k] = by[k] || []).push(r.lag); }); const ks = Object.keys(by).sort((a, b) => by[b].length - by[a].length).slice(0, 12);
  console.log('6. SAU B theo GROUP (top 12 theo số lead): ' + (ks.length ? '' : '(chưa có)')); ks.forEach(k => console.log('   ' + k + ': ' + stat(by[k]))); }
{ const by = {}; postB.forEach(r => { const k = hourVN(r.detected_at); (by[k] = by[k] || []).push(r.lag); }); const ks = Object.keys(by).map(Number).sort((a, b) => a - b);
  console.log('7. SAU B theo GIỜ phát hiện (VN): ' + (ks.length ? ks.map(k => String(k).padStart(2, '0') + 'h n' + by[k].length + '/' + Math.round(med(by[k])) + '′').join(' · ') : '(chưa có)')); }
{ const n = dayB.length, m = med(dayB.map(r => r.lag)), p = pq(dayB.map(r => r.lag), 0.95), slow = dayB.filter(r => r.lag >= 30).length;
  if (n < 20) console.log('8. KẾT LUẬN: CHƯA ĐỦ MẪU ban ngày sau B (n ' + n + ' < 20) → chạy lại sau vài giờ có bài (9–17 h VN): node _lb_lag.mjs 24');
  else if (m <= 8 && p <= 25) console.log('8. KẾT LUẬN: ✓ PASS tốc độ — ban ngày sau B trung vị ' + Math.round(m) + '′ (mốc 11′, kỳ vọng 5–7′) · p95 ' + Math.round(p) + '′ (mốc 36′, kỳ vọng ≤ 20–25′)');
  else console.log('8. KẾT LUẬN: ⚠ CHƯA ĐẠT — ban ngày sau B trung vị ' + Math.round(m) + '′ · p95 ' + Math.round(p) + '′ · ≥30′ ' + slow + '/' + n + ' → xem mục 5/6: group nào chậm & đang ở bậc nào (slow/idle 30′ = group ít bài, cân nhắc config/app.scanIntervalMaxMin: 15) hay lag do BrightData (lead ở group fast 5′ mà vẫn >15′)'); }
