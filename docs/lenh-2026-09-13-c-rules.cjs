/* LỆNH C — Rules leads: whitelist update cho non-super thêm 'dropped_reason' (PC-6 Loại có lý do), 'ai_feedback' (PC-6/PC-1 phản hồi 1 chạm), 'phone' (PA-5 SĐT gọi được ngay).
   Content-anchored: mốc `'dropped', 'dropped_at', 'dropped_by', ` trong hasOnly([...]) của match /leads/{id} (LỆNH #8). Idempotent (đã có 'dropped_reason' → bỏ qua). Fail-closed: mốc ≠ 1 → dừng, không ghi.
   Dùng: node functions/_lc_rules.cjs   (cwd = ~/firebase-s13) */
const fs = require('fs'); const f = process.argv[2] || 'firestore.rules';
let s = fs.readFileSync(f, 'utf8');
if (/'dropped_reason'/.test(s)) { console.log('đã vá (Rules leads đã có dropped_reason) — idempotent, bỏ qua'); process.exit(0); }
const A = "'dropped', 'dropped_at', 'dropped_by', "; const n = s.split(A).length - 1;
if (n !== 1) { console.error('KHONG THAY MOC Rules hasOnly (đếm ' + n + ', cần 1) — KHÔNG ghi gì'); process.exit(1); }
if (!/match \/leads\/\{id\}/.test(s) || !/hasOnly\(\['stage', 'stage_at'/.test(s)) { console.error('Rules không có block leads/hasOnly như LỆNH #8 — KHÔNG ghi gì'); process.exit(1); }
s = s.replace(A, () => A + "'dropped_reason', 'ai_feedback', 'phone', ");
fs.writeFileSync(f, s); console.log('PATCH OK firestore.rules: leads update whitelist + dropped_reason, ai_feedback, phone (LENH C)');
