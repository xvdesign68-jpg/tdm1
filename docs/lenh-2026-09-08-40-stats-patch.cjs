/* LỆNH #40 (08/09/2026) — stats.js: SLA đạt theo NGƯỠNG RIÊNG BRAND + COHORT NGÀY PHÁT HIỆN.
   Thêm counter daily_stats.slaN (lead hợp lệ phát hiện ngày D đã được chăm lần đầu) + slaOk (chăm trong ≤ slaBadMin của brand — brands/{code}.slaBadMin,
   không có thì config/app.slaBadMin, không có nữa thì 60′). Ghi lên doc NGÀY PHÁT HIỆN (không phải ngày chăm) → tử số cùng tập với mẫu số `new`.
   Trước: chỉ có bucket careLe15/30/60/120 theo ngày CHĂM → FE phải làm tròn LÊN mốc (45′ tính như 60′) và kẹp 100% vì lệch cohort.
   Patch content-anchored, fail-closed (thiếu mốc → không ghi), idempotent (marker LENH #40). Áp được lên stats.js đã qua LỆNH #17 (+ #36).
   Dùng: node _l40_stats.cjs [stats.js] */
const fs = require('fs'); const F = process.argv[2] || 'stats.js'; let s = fs.readFileSync(F, 'utf8');
if (s.includes('LENH #40')) { console.log('stats.js: ĐÃ patch (idempotent) — bỏ qua'); process.exit(0); }
const A1 = "function careInc(inc, fc, det) {";
const A2 = "  if (fc && !toMs(b.first_care_at)) { const inc = {}; careInc(inc, fc, det); push(vnDay(fc), inc); }";
const A3 = "export function statsEvents(before, after, nowMs) {";
const A4 = "  const evs = statsEvents(before, after, Date.now());";
const A5 = "  const brand = String(after.brand || '').trim(); if (!brand) return;";
for (const [i, a] of [A1, A2, A3, A4, A5].entries()) { const n = s.split(a).length - 1; if (n !== 1) { console.error('KHONG THAY MOC A' + (i + 1) + ' (đếm ' + n + '): ' + a.slice(0, 90)); process.exit(1); } }
if (s.indexOf(A5) > s.indexOf(A4)) { console.error('MOC A5 (brand) phải đứng TRƯỚC A4 (evs) — dừng'); process.exit(1); }
const helpers = `/* LENH #40 (08/09/2026) — SLA theo ngưỡng riêng brand, cohort ngày phát hiện: slaN/slaOk ghi lên doc NGÀY PHÁT HIỆN. FE 25-agency v119-80 ưu tiên khi slaN > 0. */
export function slaInc(inc, fc, det, bad) { if (det && fc >= det) { const min = (fc - det) / 60000; if (min < 30 * 1440) { inc.slaN = (inc.slaN || 0) + 1; if (min <= (Number(bad) > 0 ? Number(bad) : 60)) inc.slaOk = (inc.slaOk || 0) + 1; } } }
const _slaCache = new Map(); let _cfgBad = { v: 0, t: 0 };
/* Ngưỡng quá hạn của brand (phút): brands/{code}.slaBadMin > config/app.slaBadMin > 60. Chỉ đọc khi CÓ sự kiện chăm lần đầu (đa số write không đọc gì); cache 5'. Lỗi đọc → 60. */
export async function slaBadOf(brand, before, after) {
  const fc = toMs(after && after.first_care_at); if (!fc || (before && toMs(before.first_care_at))) return 60;
  try { if (!getApps().length) initializeApp(); const db = getFirestore(); const now = Date.now();
    let c = _slaCache.get(brand); if (!c || now - c.t > 300e3) { const d = await db.collection('brands').doc(brand).get(); const v = d.exists ? Number((d.data() || {}).slaBadMin) : 0; c = { v: v > 0 ? Math.round(v) : 0, t: now }; _slaCache.set(brand, c); }
    if (c.v > 0) return c.v;
    if (now - _cfgBad.t > 300e3) { const a = await db.collection('config').doc('app').get(); const v = a.exists ? Number((a.data() || {}).slaBadMin) : 0; _cfgBad = { v: v > 0 ? Math.round(v) : 0, t: now }; }
    return _cfgBad.v > 0 ? _cfgBad.v : 60;
  } catch (e) { return 60; }
}
` + A1;
s = s.replace(A1, () => helpers);
s = s.replace(A3, () => "export function statsEvents(before, after, nowMs, opts) { // LENH #40: opts.slaBad = ngưỡng brand (phút)");
s = s.replace(A2, () => A2.slice(0, -2) + " if (tempOf(after) !== 'junk') { const sl = {}; slaInc(sl, fc, det, opts && opts.slaBad); push(vnDay(det || fc), sl); } } // LENH #40: slaN/slaOk theo NGÀY PHÁT HIỆN");
s = s.replace(A4, () => "  const slaBad = await slaBadOf(brand, before, after); // LENH #40\n  const evs = statsEvents(before, after, Date.now(), { slaBad });");
fs.writeFileSync(F, s); console.log('PATCH OK stats.js (LENH #40: slaInc/slaBadOf + statsEvents(opts.slaBad) + slaN/slaOk theo ngày phát hiện)');
