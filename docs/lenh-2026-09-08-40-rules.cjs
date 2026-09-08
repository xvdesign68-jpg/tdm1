/* LỆNH #40 (08/09/2026) — firestore.rules: thêm 'stage_log' vào whitelist field vận hành của leads (non-super, LỆNH #8 v119-42).
   FE v119-80 ghi lịch sử giai đoạn `stage_log` (mảng {from,to,at,by,undo}) RIÊNG, best-effort → Rules chưa mở thì chỉ console.warn, không chặn đổi giai đoạn.
   Idempotent · fail-closed. Dùng: node _l40_rules.cjs [firestore.rules] */
const fs = require('fs'); const F = process.argv[2] || 'firestore.rules'; let s = fs.readFileSync(F, 'utf8');
const m = s.match(/match \/leads\/\{\w+\}\s*\{[\s\S]*?hasOnly\(\[([^\]]*)\]\)/);
if (!m) { console.error('KHONG THAY whitelist hasOnly([...]) trong match /leads — Rules chưa qua LỆNH #8?'); process.exit(1); }
if (/'stage_log'/.test(m[1])) { console.log("Rules: ĐÃ CÓ 'stage_log' trong whitelist — bỏ qua"); process.exit(0); }
const nu = m[0].replace(/\]\)$/, ", 'stage_log'])");
if (nu === m[0]) { console.error('KHONG SUA DUOC whitelist (regex)'); process.exit(1); }
s = s.replace(m[0], () => nu);
fs.writeFileSync(F, s); console.log("PATCH OK firestore.rules: + 'stage_log' vào whitelist leads (v119-80 lịch sử giai đoạn) · " + (m[1].split(',').length + 1) + ' field');
