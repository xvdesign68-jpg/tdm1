/* LỆNH G — Rules: 2 block đọc cho web (zip v119-93): author_memory (bộ nhớ người viết — scanner/stats ghi) + ai_feedback (phản hồi super: không phải người bán / đánh dấu người bán — CF ghi) · read = super, write = false.
   Chèn 1 dòng/block ngay sau `match /databases/{database}/documents {` (cách LỆNH #23/C). Idempotent (block đã có → bỏ qua). Fail-closed: mốc ≠ 1 → dừng, không ghi.
   Dùng: node functions/_lg_rules.cjs   (cwd = ~/firebase-s13) */
const fs = require('fs'); const f = process.argv[2] || 'firestore.rules';
let s = fs.readFileSync(f, 'utf8');
const B1 = "    match /author_memory/{k} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH G */\n";
const B2 = "    match /ai_feedback/{k} { allow read: if isSuperAdmin(); allow write: if false; } /* LENH G */\n";
const hasAM = /match \/author_memory\//.test(s), hasAF = /match \/ai_feedback\//.test(s);
if (hasAM && hasAF) { console.log('đã vá (Rules đã có block author_memory + ai_feedback) — idempotent, bỏ qua'); process.exit(0); }
const D = /match \/databases\/\{database\}\/documents \{[ \t]*\n/; const nd = (s.match(new RegExp(D.source, 'g')) || []).length;
if (nd !== 1) { console.error('KHONG THAY MOC "match /databases/{database}/documents {" (đếm ' + nd + ', cần 1) — KHÔNG ghi gì'); process.exit(1); }
if (!/function isSuperAdmin\(\)/.test(s)) { console.error('Rules không có helper isSuperAdmin() — KHÔNG ghi gì'); process.exit(1); }
s = s.replace(D, m => m + (hasAM ? '' : B1) + (hasAF ? '' : B2));
fs.writeFileSync(f, s); console.log('PATCH OK firestore.rules: block đọc ' + [!hasAM ? 'author_memory' : '', !hasAF ? 'ai_feedback' : ''].filter(Boolean).join(' + ') + ' (super, write=false) (LENH G)');
