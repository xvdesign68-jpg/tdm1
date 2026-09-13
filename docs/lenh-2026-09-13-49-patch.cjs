/* LỆNH #49 (13/09/2026) — patch lib/scraper.js: `commentator_profile_url` của dataset bình luận BrightData là ẢNH ĐẠI DIỆN (scontent-*.fbcdn.net/v/t39.30808-1/…),
   KHÔNG phải link hồ sơ (LỆNH #48 đoán từ dump che chuỗi ≥28 ký tự; bằng chứng: 3/3 comment-lead sau #48 có author_url = fbcdn.net — `_ld_after.mjs` bản 2 mục 6, 13/09 10:18 VN).
   Hệ quả nếu không vá: worker mở ảnh thay trang cá nhân → kết bạn/inbox comment-lead thất bại 5 lượt (uiFail), thẻ lead link sai.
   Vá 4 mốc (marker `LENH #49`), FAIL-CLOSED NGUYÊN TỬ (đủ 4 mốc, mỗi mốc đúng 1 lần mới ghi), idempotent:
   M1 helper `fbUrl49(...)` = ứng viên đầu tiên là URL host facebook.com/fb.com/fb.me và KHÔNG phải CDN (fbcdn.net, /v/t39.) + `profileOf48` chỉ nhận link đó (ảnh → bỏ → rơi về user_id: uid số → profile.php?id=<uid>, pfbid → profile.php?id=<pfbid>)
   M2 `authorUidOf48` chỉ rút uid từ URL facebook (không đọc `&id=` trong query CDN)
   M3/M4 `normalizeComment`: user_url/author_uid lấy từ fbUrl49(user_url, commenter_url, commenter_profile_url, commentator_profile, commentator_profile_url)
   Dùng: node _l49_patch.cjs lib/scraper.js   (cwd = ~/firebase-s13/functions) */
'use strict';
const fs = require('fs');
const F = process.argv[2]; if (!F) { console.error('cần đường dẫn lib/scraper.js'); process.exit(2); }
let s = fs.readFileSync(F, 'utf8');
if (/LENH #49/.test(s)) { console.log('đã vá (marker LENH #49 có sẵn) — idempotent, bỏ qua'); process.exit(0); }
if (!/LENH #48/.test(s) || !/LENH D/.test(s)) { console.error('DỪNG: ' + F + ' thiếu marker LENH #48 / LENH D (mốc #49 đặt trên mã sau D). KHÔNG ghi gì.'); process.exit(1); }
const ops = [];
const A = (label, from, to) => { const n = s.split(from).length - 1; if (n !== 1) { console.error('DỪNG: mốc ' + label + ' gặp ' + n + ' lần (cần đúng 1). KHÔNG ghi gì.'); process.exit(1); } ops.push([label, from, to]); };
A('M1 profileOf48',
  "function profileOf48(raw, id) { const s = stripQ48(raw); if (s) return s; const v = String(id || '').trim(); return (/^\\d{5,}$/.test(v) || /^pfbid[\\w-]{10,}$/i.test(v)) ? ('https://www.facebook.com/profile.php?id=' + v) : ''; }",
  "/* LENH #49 (13/09/2026): commentator_profile_url của dataset = ẢNH ĐẠI DIỆN (scontent-*.fbcdn.net/v/t39…), KHÔNG phải link hồ sơ → chỉ nhận URL host facebook.com/fb.com; ảnh/CDN → bỏ → rơi về user_id (uid số hoặc pfbid) */\n" +
  "function fbUrl49(...cands) { for (const x of cands) { const s = String(x || '').trim(); if (!s) continue; if (/^https?:\\/\\/([\\w-]+\\.)*(facebook\\.com|fb\\.com|fb\\.me)(\\/|$)/i.test(s) && !/fbcdn\\.net|\\/v\\/t\\d{2}\\./i.test(s)) return s; } return ''; }\n" +
  "function profileOf48(raw, id) { const s = stripQ48(fbUrl49(raw)); if (s) return s; const v = String(id || '').trim(); return (/^\\d{5,}$/.test(v) || /^pfbid[\\w-]{10,}$/i.test(v)) ? ('https://www.facebook.com/profile.php?id=' + v) : ''; } /* LENH #49: ảnh/CDN không phải hồ sơ */");
A('M2 authorUidOf48',
  "function authorUidOf48(raw, id) { const u = uidOf48(raw); if (u) return u;",
  "function authorUidOf48(raw, id) { const u = uidOf48(fbUrl49(raw)); /* LENH #49 */ if (u) return u;");
A('M3 normalizeComment user_url',
  "    user_url:  profileOf48(c.user_url || c.commenter_url || c.commenter_profile_url || c.commentator_profile_url || '', c.user_id || c.commenter_id), /* LENH #48: dataset dùng commentator_profile_url (kèm tracking) · user_id = pfbid → link dự phòng */",
  "    user_url:  profileOf48(fbUrl49(c.user_url, c.commenter_url, c.commenter_profile_url, c.commentator_profile, c.commentator_profile_url), c.user_id || c.commenter_id), /* LENH #48 · LENH #49: chỉ link hồ sơ facebook thật (commentator_profile_url = ảnh đại diện → bỏ) · user_id uid số/pfbid → link dự phòng */");
A('M4 normalizeComment author_uid',
  "    author_uid: authorUidOf48(c.user_url || c.commenter_url || c.commenter_profile_url || c.commentator_profile_url || '', c.user_id || c.commenter_id), /* LENH #48 */",
  "    author_uid: authorUidOf48(fbUrl49(c.user_url, c.commenter_url, c.commenter_profile_url, c.commentator_profile, c.commentator_profile_url), c.user_id || c.commenter_id), /* LENH #48 · LENH #49 */");
for (const [, from, to] of ops) s = s.replace(from, () => to);
for (const [label, , to] of ops) { if (s.split(to).length - 1 !== 1) { console.error('DỪNG: sau thay mốc ' + label + ' không đúng 1 lần — KHÔNG ghi gì.'); process.exit(1); } }
fs.writeFileSync(F, s);
console.log('PATCH OK lib/scraper.js (LENH #49): fbUrl49 + profileOf48/authorUidOf48 chỉ nhận link facebook · normalizeComment ưu tiên link hồ sơ thật, ảnh đại diện bỏ (' + ops.length + ' mốc)');
