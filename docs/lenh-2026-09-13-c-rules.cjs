/* LỆNH C — Rules: (1) leads whitelist update cho non-super thêm 'dropped_reason' (PC-6 Loại có lý do), 'ai_feedback' (PC-6/PC-1 phản hồi 1 chạm), 'phone' (PA-5 SĐT gọi được ngay); (2) block đọc source_health + group_state cho Super Admin (web v119-90: cột Nhịp · Sức khoẻ ở Nguồn quét).
   Content-anchored: mốc `'dropped', 'dropped_at', 'dropped_by', ` trong hasOnly([...]) của match /leads/{id} (LỆNH #8). Idempotent (đã có 'dropped_reason' → bỏ qua). Fail-closed: mốc ≠ 1 → dừng, không ghi.
   Dùng: node functions/_lc_rules.cjs   (cwd = ~/firebase-s13) */
const fs = require('fs'); const f = process.argv[2] || 'firestore.rules';
let s = fs.readFileSync(f, 'utf8');
/* 2 block đọc cho web (zip v119-90): source_health (sức khoẻ nguồn — LỆNH C ghi) + group_state (nhịp thích ứng — LỆNH B ghi) · read = super, write = false (chỉ Admin SDK ghi). Chèn 1 dòng/block ngay sau `match /databases/{database}/documents {` (cách LỆNH #23 dùng cho system_status). */
const B1 = "    match /source_health/{sid} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH C */\n";
const B2 = "    match /group_state/{gid} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH C */\n";
const hasWL = /'dropped_reason'/.test(s), hasSH = /match \/source_health\//.test(s), hasGS = /match \/group_state\//.test(s);
if (hasWL && hasSH && hasGS) { console.log('đã vá (Rules leads đã có dropped_reason + block source_health/group_state) — idempotent, bỏ qua'); process.exit(0); }
const A = "'dropped', 'dropped_at', 'dropped_by', "; const n = s.split(A).length - 1;
if (!hasWL && n !== 1) { console.error('KHONG THAY MOC Rules hasOnly (đếm ' + n + ', cần 1) — KHÔNG ghi gì'); process.exit(1); }
if (!hasWL && (!/match \/leads\/\{id\}/.test(s) || !/hasOnly\(\['stage', 'stage_at'/.test(s))) { console.error('Rules không có block leads/hasOnly như LỆNH #8 — KHÔNG ghi gì'); process.exit(1); }
const D = /match \/databases\/\{database\}\/documents \{[ \t]*\n/; const nd = (s.match(new RegExp(D.source, 'g')) || []).length;
if ((!hasSH || !hasGS) && nd !== 1) { console.error('KHONG THAY MOC "match /databases/{database}/documents {" (đếm ' + nd + ', cần 1) — KHÔNG ghi gì'); process.exit(1); }
if (!/function isSuperAdmin\(\)/.test(s)) { console.error('Rules không có helper isSuperAdmin() — KHÔNG ghi gì'); process.exit(1); }
const did = [];
if (!hasWL) { s = s.replace(A, () => A + "'dropped_reason', 'ai_feedback', 'phone', "); did.push('leads whitelist + dropped_reason, ai_feedback, phone'); }
if (!hasSH || !hasGS) { s = s.replace(D, m => m + (hasSH ? '' : B1) + (hasGS ? '' : B2)); did.push('block đọc ' + [!hasSH ? 'source_health' : '', !hasGS ? 'group_state' : ''].filter(Boolean).join(' + ') + ' (super)'); }
fs.writeFileSync(f, s); console.log('PATCH OK firestore.rules: ' + did.join(' · ') + ' (LENH C)');
