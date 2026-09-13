# bash — LỆNH #49 · KHỐI 1 (13/09/2026): vá lib/scraper.js — commentator_profile_url là ẢNH ĐẠI DIỆN, không phải link hồ sơ (bug LỆNH #48) → deploy scheduledScan + manualScan → DRY dọn lead.
# Dán: cat > /tmp/l49.sh <<'EOF' … EOF ; bash /tmp/l49.sh   (không shebang, không dấu chấm than ngoài heredoc — Cloud Shell history-expand)
set -u
cd ~/firebase-s13/functions || { echo 'DỪNG: không vào được ~/firebase-s13/functions'; exit 1; }
TS=$(date -u +%Y%m%d-%H%M%S); echo "backup TS=$TS (giờ UTC)"
cat > _l49_patch.cjs <<'EOF_PATCH'
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
EOF_PATCH
cat > _l49_fix.mjs <<'EOF_FIX'
/* LỆNH #49 · KHỐI 2 — dọn lead có author_url là ẢNH ĐẠI DIỆN (fbcdn.net) do LỆNH #48 map nhầm `commentator_profile_url` (từ 12/09 08:53Z tới lúc deploy #49).
   DRY mặc định (chỉ in); `--apply` mới ghi. Quy tắc: author_uid là uid số → author_url = https://www.facebook.com/profile.php?id=<uid>; không → author_url = '' (worker không mở ảnh; kết bạn/inbox bỏ qua, react/comment vẫn chạy).
   Ghi dấu author_url_fix49 {old (120 ký tự), at}. Kèm outreach_threads/{leadId}.fpayload.profile_url nếu cũng là ảnh. Đặt trong ~/firebase-s13/functions. Đọc theo trang ≤300 + select(). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const APPLY = process.argv.includes('--apply'); const BAD = /fbcdn\.net|\/v\/t\d{2}\./i; const OFF = 7 * 3600e3;
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
console.log('== LỆNH #49 KHỐI 2 — ' + (APPLY ? 'APPLY (ghi)' : 'DRY (chỉ in)') + ' — ' + new Date(Date.now() + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
const since = new Date('2026-09-12T08:53:00Z');
const ls = await pageAll(db.collection('leads').where('detected_at', '>=', since), 'detected_at', ['author_url', 'author_uid', 'kind', 'comment_id', 'name', 'brand', 'author_url_fix49'], 4000);
const bad = ls.filter(l => BAD.test(String(l.author_url || '')));
console.log('1. lead từ 12/09 15:53 VN: ' + ls.length + ' · author_url là ảnh/CDN: ' + bad.length + ' (đã sửa trước đó: ' + ls.filter(l => l.author_url_fix49).length + ')');
const plan = bad.map(l => { const uid = /^\d{6,}$/.test(String(l.author_uid || '')) ? String(l.author_uid) : ''; return { id: l.__id, at: l.detected_at, brand: l.brand, name: l.name, kind: (l.kind === 'comment' || l.comment_id) ? 'cmt' : 'bài', old: String(l.author_url), uid, next: uid ? 'https://www.facebook.com/profile.php?id=' + uid : '' }; });
plan.forEach(p => console.log('   ' + p.kind + ' ' + hm(p.at) + ' ' + String(p.brand || '').padEnd(14) + ' ' + String(p.name || '').slice(0, 18).padEnd(18) + ' → ' + (p.next || '(xoá author_url — không có uid số)') + ' · cũ ' + p.old.slice(0, 60) + '…'));
const refs = plan.map(p => db.collection('outreach_threads').doc(p.id)); const thr = refs.length ? await db.getAll(...refs) : [];
const thrBad = thr.filter(t => t.exists && BAD.test(String(((t.data() || {}).fpayload || {}).profile_url || '')));
console.log('2. outreach_threads của các lead trên có fpayload.profile_url là ảnh: ' + thrBad.length + '/' + thr.filter(t => t.exists).length + ' thread');
if (!APPLY) { console.log('DRY xong — không ghi gì. Ưng thì: node _l49_fix.mjs --apply'); }
else {
  let w = 0; for (let i = 0; i < plan.length; i += 400) { const b = db.batch(); plan.slice(i, i + 400).forEach(p => { b.update(db.collection('leads').doc(p.id), { author_url: p.next, author_url_fix49: { old: p.old.slice(0, 120), at: Date.now(), uid: p.uid || null } }); w++; }); await b.commit(); }
  let wt = 0; for (const t of thrBad) { const p = plan.find(x => x.id === t.id); await t.ref.update({ 'fpayload.profile_url': p ? p.next : '' }); wt++; }
  console.log('ĐÃ GHI: lead ' + w + ' · thread ' + wt + ' (chạy lại DRY sẽ thấy 0 ảnh/CDN)');
}
console.log('== XONG ==');
EOF_FIX
node --check _l49_patch.cjs && node --check _l49_fix.mjs || { echo 'DỪNG: script lỗi cú pháp (chưa đụng gì)'; exit 1; }
echo "=== (a) backup + patch lib/scraper.js ==="
if grep -q 'LENH #49' lib/scraper.js; then echo "lib/scraper.js ĐÃ có marker LENH #49 (chạy lại) — KHÔNG tạo .bak mới"; else cp lib/scraper.js "lib/scraper.js.bak-$TS" && echo "backup lib/scraper.js.bak-$TS"; fi
node _l49_patch.cjs lib/scraper.js || { echo 'DỪNG (a): patch không áp — KHÔNG ghi gì. Gửi em output.'; exit 1; }
node --check lib/scraper.js || { echo "DỪNG (a): lib/scraper.js lỗi cú pháp sau patch — khôi phục: cp lib/scraper.js.bak-$TS lib/scraper.js"; exit 1; }
echo "marker LENH #49: $(grep -c 'LENH #49' lib/scraper.js) dòng"
echo "=== (b) import test normalizeComment/normalizePost (không cần .env) ==="
node --input-type=module -e "
const m = await import('./lib/scraper.js');
const IMG = 'https://scontent-sin2-2.xx.fbcdn.net/v/t39.30808-1/618420709_320877762.jpg?stp=dst-jpg&_nc_cat=1&ccb=1-7&_nc_ohc=abc&_nc_zt=24';
const src = { name: 'S', url: 'https://www.facebook.com/groups/123456789012345/' }, P = 'https://www.facebook.com/groups/123456789012345/posts/456/';
const c1 = m.normalizeComment({ commentator_profile_url: IMG, user_id: 'pfbid0AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefghijklmnopqrstuvwxyzABCDEF', user_name: 'T', comment_text: 'ib' }, src, P);
const c2 = m.normalizeComment({ commentator_profile_url: IMG, user_id: '224550447624797', user_name: 'A', comment_text: 'ib' }, src, P);
const c3 = m.normalizeComment({ commentator_profile: 'https://www.facebook.com/groups/123456789012345/user/100012345678901/?__cft__[0]=x&__tn__=y', commentator_profile_url: IMG, user_id: 'pfbid0zz', user_name: 'B', comment_text: 'ib' }, src, P);
const p1 = m.normalizePost({ url: P, post_id: '456', profile_id: '100012345678901', user_name: 'C', content: 'x' }, src);
const ok1 = c1.user_url === 'https://www.facebook.com/profile.php?id=pfbid0AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefghijklmnopqrstuvwxyzABCDEF' && c1.author_uid === '';
const ok2 = c2.user_url === 'https://www.facebook.com/profile.php?id=224550447624797' && c2.author_uid === '224550447624797';
const ok3 = c3.user_url === 'https://www.facebook.com/groups/123456789012345/user/100012345678901' && c3.author_uid === '100012345678901';
const ok4 = p1.user_url === 'https://www.facebook.com/profile.php?id=100012345678901' && p1.author_uid === '100012345678901';
console.log('c1 ảnh+pfbid →', c1.user_url, '|', ok1 ? 'OK' : 'SAI'); console.log('c2 ảnh+uid số →', c2.user_url, '|', ok2 ? 'OK' : 'SAI'); console.log('c3 link hồ sơ thật+ảnh →', c3.user_url, c3.author_uid, '|', ok3 ? 'OK' : 'SAI'); console.log('p1 bài profile_id →', p1.user_url, '|', ok4 ? 'OK' : 'SAI');
if (ok1 && ok2 && ok3 && ok4) console.log('IMPORT OK · 4/4 ca đúng'); else process.exit(1);
" || { echo "DỪNG (b): import/ca kiểm sai — khôi phục: cp lib/scraper.js.bak-$TS lib/scraper.js"; exit 1; }
echo "=== (c) deploy scheduledScan + manualScan ==="
firebase deploy --only functions:scheduledScan,functions:manualScan --project smartlead-z15 --force > /tmp/l49_deploy.log 2>&1; grep -E 'Deploy complete|Successful update|Error|error' /tmp/l49_deploy.log | head -6
grep -q 'Deploy complete' /tmp/l49_deploy.log || { echo "DỪNG (c): deploy CHƯA xong (xem /tmp/l49_deploy.log) — code đã vá tại chỗ, chưa lên máy chủ; chạy lại: firebase deploy --only functions:scheduledScan,functions:manualScan --project smartlead-z15 --force"; exit 1; }
for f in scheduledScan manualScan; do echo -n "$f: "; gcloud functions describe $f --region asia-southeast1 --gen2 --format='value(state,updateTime)' 2>/dev/null; done
echo "=== (d) DRY dọn lead có author_url là ảnh (chỉ in) ==="
node _l49_fix.mjs
echo "=== XONG KHỐI 1 (exit=0) — đọc mục 1 ở (d): ưng thì  node _l49_fix.mjs --apply  ; nghiệm thu comment-lead mới: node _ld_after.mjs (mục 6) ==="
