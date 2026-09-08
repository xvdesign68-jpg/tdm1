/* LỆNH #41 (09/09/2026) — stats.js: bộ đếm `new/hot/warm/cold/junk` (lead mới theo ngày phát hiện) KHÔNG tăng từ sau backfill LỆNH #17 (04/09):
   output LỆNH #39/#40 cho thấy doc daily_stats 07–08/09 có slaN/careLe60 > 0 (có lead hợp lệ được chăm) nhưng new = 0, hot = 0.
   Nguyên nhân khả dĩ: trigger chỉ đếm "lead mới" khi before == null (đúng 1 write tạo doc), nhưng lead có thể được ghi 2 bước (tạo doc rồi mới
   gán brand / chấm điểm) → write tạo: chưa có brand → return sớm (hoặc chưa có điểm → tính là junk); write sau: before đã tồn tại → không bao giờ vào `new`.
   Vá: "lead mới" = lần ĐẦU doc đủ điều kiện đếm (có brand + có temp hoặc score) — `countable(after) && !countable(before)`. Tạo 1 bước (before=null) vẫn đếm đúng 1 lần;
   tạo 2 bước → đếm ở bước có đủ dữ liệu; doc chưa có điểm → KHÔNG đếm junk oan. Kèm _l41_recount.mjs dựng lại tuyệt đối 60 ngày.
   Patch content-anchored, fail-closed, idempotent (marker LENH #41). Dùng: node _l41_stats.cjs [stats.js] */
const fs = require('fs'); const F = process.argv[2] || 'stats.js'; let s = fs.readFileSync(F, 'utf8');
if (s.includes('LENH #41')) { console.log('stats.js: ĐÃ patch (idempotent) — bỏ qua'); process.exit(0); }
const A1 = "  if (!before) { const inc = {}; const t = tempOf(after); if (t === 'junk') inc.junk = 1; else { inc.new = 1; inc[t] = 1; } push(vnDay(det || now), inc); }";
const n = s.split(A1).length - 1; if (n !== 1) { console.error('KHONG THAY MOC A1 (đếm ' + n + '): ' + A1.slice(0, 90)); process.exit(1); }
s = s.replace(A1, () => `  /* LENH #41 (09/09/2026): "lead mới" = lần ĐẦU doc đủ điều kiện đếm (có brand + có temp/score) — trước chỉ đếm khi before==null nên lead ghi 2 bước
     (tạo doc rồi mới gán brand/chấm điểm) không bao giờ vào new/hot; doc chưa có điểm cũng không bị tính junk oan. Tạo 1 bước đủ dữ liệu: hành vi y như cũ. */
  const countable = l => !!(l && String(l.brand || '').trim() && (l.temp != null || l.score != null));
  if (countable(after) && !countable(before)) { const inc = {}; const t = tempOf(after); if (t === 'junk') inc.junk = 1; else { inc.new = 1; inc[t] = 1; } push(vnDay(det || now), inc); }`);
fs.writeFileSync(F, s); console.log('PATCH OK stats.js (LENH #41: new/hot/warm/cold/junk đếm ở lần đầu doc đủ brand + điểm)');
