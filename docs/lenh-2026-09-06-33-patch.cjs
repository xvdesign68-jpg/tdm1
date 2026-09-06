// LENH #33 (06/09/2026) — content.js: BỎ dòng opt-out mặc định "Nếu không tiện, anh/chị cứ bỏ qua tin này nhé." (anh chốt sau khi xem inbox thật).
//  Brand vẫn có thể tự ghi dòng riêng ở Content Studio (content.optout) — mặc định giờ là RỖNG → không thêm gì vào inbox.
//  Fail-closed: mốc phải đúng 1 chỗ; đã có marker → bỏ qua.
const fs = require('fs');
const MARK = 'LENH #33';
const f = 'content.js'; let s = fs.readFileSync(f, 'utf8');
if (s.includes(MARK)) { console.log('PATCH OK ' + MARK + ' — content.js: đã có marker → bỏ qua'); process.exit(0); }
const A = "optout: String(c.optout || 'Nếu không tiện, anh/chị cứ bỏ qua tin này nhé.').trim()";
const n = s.split(A).length - 1;
if (n !== 1) { console.error('KHONG TIM THAY MOC: content.js optout mặc định phải đúng 1 chỗ, thấy ' + n); process.exit(1); }
s = s.replace(A, () => "optout: String(c.optout || '').trim() /* " + MARK + ": bỏ opt-out mặc định — chỉ thêm khi brand tự ghi ở Content Studio */");
fs.writeFileSync(f, s);
console.log('PATCH OK ' + MARK + ' — content.js: optout mặc định → rỗng');
