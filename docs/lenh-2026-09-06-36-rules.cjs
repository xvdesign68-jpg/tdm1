/* LỆNH #36 — Rules: match /content_stats/{id} = bản sao block outreach_stats (super đọc hết / brand user đọc brandCode == brand mình, write false — CF ghi bằng Admin SDK).
   Chạy trong ~/firebase-s13 (nơi có firestore.rules). Idempotent, fail-closed (không thấy block outreach_stats → dừng). */
const fs = require('fs'); const F = 'firestore.rules'; let s = fs.readFileSync(F, 'utf8');
if (/match \/content_stats\//.test(s)) { console.log('Rules: block content_stats ĐÃ CÓ - bỏ qua'); process.exit(0); }
const m1 = s.match(/([ \t]*)match \/outreach_stats\/\{[^}]*\}\s*\{[\s\S]*?\n\1\}/);          // block nhiều dòng
const m2 = m1 ? null : s.match(/([ \t]*)match \/outreach_stats\/\{[^}]*\}\s*\{[^\n]*\}[ \t]*/); // block 1 dòng
const m = m1 || m2;
if (!m) { console.log('KHONG TIM THAY block outreach_stats trong firestore.rules - dán cho em 30 dòng quanh "outreach_stats"'); process.exit(1); }
const blk = m[0].replace(/outreach_stats/g, 'content_stats');
if (!/superadmin|isSuperAdmin\(\)/.test(blk) || !/brandCode/.test(blk)) { console.log('Block chép được KHONG đúng dạng (thiếu superadmin/brandCode) - dừng để em xem:\n' + blk); process.exit(1); }
const note = m[1] + '// LENH #36 06/09/2026: counter hiệu quả nội dung content_stats/{brand} (CF statsOnLead ghi) — cùng quyền đọc như outreach_stats';
s = s.replace(m[0], () => m[0] + '\n' + note + '\n' + blk);
fs.writeFileSync(F, s); console.log('Rules: đã chèn block content_stats:\n' + blk);
