/* LỆNH C — ZBS guard (tuỳ chọn): notifyBrandZalo (~/smartlead-zalo-fn/functions/index.js) KHÔNG bắn ZNS cho sales khi lead đã loại / không thành / điểm tạm (ai_scored:false) / vai người bán / chủ bài;
   AI chấm lại lead điểm tạm → được bắn (zalo_notified vẫn chặn trùng). Content-anchored theo dump #47d dòng 288–298, marker `LENH C`, idempotent, fail-closed.
   Dùng: node ~/firebase-s13/functions/_lc_zbs.cjs ~/smartlead-zalo-fn/functions/index.js */
const fs = require('fs'); const f = process.argv[2]; if (!f) { console.error('thiếu đường dẫn index.js zalo-fn'); process.exit(1); }
let s = fs.readFileSync(f, 'utf8');
if (s.includes('LENH C')) { console.log('đã vá (notifyBrandZalo có marker LENH C) — idempotent, bỏ qua'); process.exit(0); }
const A1 = "    if (!brand) return;                       // no brand yet\n";
const B1 = A1 + "    if (after.dropped || after.lost || after.ai_scored === false || /^(seller|poster_self)$/.test(String(after.role || '')) || after.self_comment === true) return; // LENH C: không bắn ZBS cho lead đã loại / không thành / điểm tạm / người bán / chủ bài\n";
const A2 = "    if (!justTagged && before.score === after.score) return;";
const B2 = "    if (!justTagged && !(before.ai_scored === false && after.ai_scored === true) && before.score === after.score) return; // LENH C: AI chấm lại lead điểm tạm → cho qua (zalo_notified vẫn chặn trùng)";
const miss = [[A1, 'guard sau if (!brand)'], [A2, 'justTagged/score']].filter(([a]) => s.split(a).length - 1 !== 1).map(x => x[1]);
if (miss.length) { console.error('KHONG THAY MOC notifyBrandZalo: ' + miss.join(', ') + ' — KHÔNG ghi gì'); process.exit(1); }
if (!/exports\.notifyBrandZalo = onDocumentUpdated\(/.test(s)) { console.error('không thấy exports.notifyBrandZalo — KHÔNG ghi gì'); process.exit(1); }
s = s.replace(A1, () => B1).replace(A2, () => B2); fs.writeFileSync(f, s); console.log('PATCH OK notifyBrandZalo: guard dropped/lost/ai_scored:false/vai + AI chấm lại (LENH C)');
