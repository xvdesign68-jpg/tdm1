/* LỆNH #42 (09/09/2026) — stats.js: NGƯỜI BÁN / CHỦ BÀI / TỰ BÌNH LUẬN DƯỚI BÀI MÌNH không phải lead hợp lệ → bộ đếm daily_stats.new/hot/warm/cold KHÔNG cộng
   (khối kiểm 09/09: 91/1.029 lead "hợp lệ" 14 ngày là vai người bán/chủ bài LỆNH #31b đã Loại → ô KPI thổi ~9%, hscl-01 ~15%).
   Vá: roleBad(l) = role seller|poster_self hoặc self_comment===true; countable = brand + điểm + !roleBad. Lead đã đếm rồi MỚI bị gắn vai (rescore/_l31_fix) → trừ lại
   đúng ngày phát hiện (new −1, temp −1); gỡ vai → cộng lại. Xoá doc vẫn KHÔNG trừ (như #17). Áp lên stats.js đã qua LỆNH #41. Marker LENH #42, idempotent, fail-closed. */
const fs = require('fs'); const F = process.argv[2] || 'stats.js'; let s = fs.readFileSync(F, 'utf8');
if (s.includes('LENH #42')) { console.log('stats.js: ĐÃ patch (idempotent) — bỏ qua'); process.exit(0); }
if (!s.includes('LENH #41')) { console.error('stats.js CHƯA qua LỆNH #41 — chạy LỆNH #41 trước'); process.exit(1); }
const A1 = "  const countable = l => !!(l && String(l.brand || '').trim() && (l.temp != null || l.score != null));\n  if (countable(after) && !countable(before)) { const inc = {}; const t = tempOf(after); if (t === 'junk') inc.junk = 1; else { inc.new = 1; inc[t] = 1; } push(vnDay(det || now), inc); }";
const n = s.split(A1).length - 1; if (n !== 1) { console.error('KHONG THAY MOC A1 (đếm ' + n + ')'); process.exit(1); }
s = s.replace(A1, () => `  /* LENH #42 (09/09/2026): người bán / chủ bài / tự bình luận dưới bài mình KHÔNG phải lead hợp lệ → không cộng new/hot; đã đếm rồi mới bị gắn vai → trừ lại đúng ngày phát hiện. */
  const roleBad = l => !!(l && (/^(seller|poster_self)$/.test(String(l.role || '')) || l.self_comment === true));
  const countable = l => !!(l && String(l.brand || '').trim() && (l.temp != null || l.score != null) && !roleBad(l));
  if (countable(after) && !countable(before)) { const inc = {}; const t = tempOf(after); if (t === 'junk') inc.junk = 1; else { inc.new = 1; inc[t] = 1; } push(vnDay(det || now), inc); }
  else if (!countable(after) && countable(before)) { const t = tempOf(before); const dB = toMs(before.detected_at) || det || now; if (t === 'junk') push(vnDay(dB), { junk: -1 }); else push(vnDay(dB), { new: -1, [t]: -1 }); }`);
if (!/export const toMs|const toMs/.test(s)) { console.error('stats.js KHÔNG có toMs — dừng'); process.exit(1); }
fs.writeFileSync(F, s); console.log('PATCH OK stats.js (LENH #42: người bán/chủ bài không cộng new/hot; gắn vai sau khi đếm → trừ lại)');
