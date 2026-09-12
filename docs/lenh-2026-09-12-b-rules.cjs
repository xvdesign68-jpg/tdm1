/* LỆNH B — Rules: match /lead_links/{id} = read super, write false (CF ghi Admin SDK) — bản sao block workers (LỆNH M). Chạy trong ~/firebase-s13 (nơi có firestore.rules). Idempotent, fail-closed. */
const fs = require('fs'); const F = 'firestore.rules'; let s = fs.readFileSync(F, 'utf8');
if (/match \/lead_links\//.test(s)) { console.log('Rules: block lead_links ĐÃ CÓ - bỏ qua'); process.exit(0); }
const m1 = s.match(/([ \t]*)match \/workers\/\{[^}]*\}\s*\{[\s\S]*?\n\1\}/);
const m2 = m1 ? null : s.match(/([ \t]*)match \/workers\/\{[^}]*\}\s*\{[^\n]*\}[ \t]*/);
const m = m1 || m2;
if (!m) { console.log('KHONG TIM THAY block workers trong firestore.rules - dán cho em 30 dòng quanh "workers"'); process.exit(1); }
const blk = m[0].replace(/\/workers\/\{wid\}/g, '/lead_links/{lid}').replace(/workers/g, 'lead_links');
if (!/isSuperAdmin\(\)|superadmin/.test(blk) || !/allow write: if false/.test(blk)) { console.log('Block chép được KHONG đúng dạng (cần read super / write false) - dừng để em xem:\n' + blk); process.exit(1); }
const note = m[1] + '// LENH B 12/09/2026: lead_links/{gid}_{post_id} = bản đồ lead↔brand cùng bài (group dùng chung) — CF ghi, chỉ Super Admin đọc';
s = s.replace(m[0], () => m[0] + '\n' + note + '\n' + blk);
fs.writeFileSync(F, s); console.log('Rules: đã chèn block lead_links:\n' + blk);
