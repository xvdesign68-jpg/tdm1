# LỆNH #26/#27 — bình luận tự động bị CẮT GIỮA CÂU (phiên 05/09/2026)

## Hiện tượng (anh phát hiện)
Nick comment lên bài của lead thiếu đuôi câu so với "Gợi ý phản hồi từ AI" trong lead: gợi ý 247 ký tự "...để bên mình tư vấn đúng loại và báo giá ạ?" → bình luận thật (và dòng "Hoạt động gần đây") chỉ còn 219 ký tự "...để bên mình tư".

## Chẩn đoán
- Dòng "Hoạt động gần đây" = chuỗi `payload.comment_msg` worker nhận từ engine → đã cụt trước khi worker gõ. Không phải lỗi worker.
- **LỆNH #26 (chỉ đọc)** dump `content.js`: `clean(s, max)` (dòng 19, 1 dòng) cắt `s.slice(0, max)` rồi lùi về dấu câu/khoảng trắng gần nhất; `replyGen` (dòng 47, chế độ `reply` = dùng nguyên `lead.reply`) gọi `clean(r, 220)`; chế độ AI (dòng 57) `clean(j.comment, 220)`, inbox `clean(..., 620)`. Brand hscl-01 chưa soạn Content Studio (`content` rỗng, không `brand.ai`) → chế độ `reply` → lead.reply 247 ký tự bị `clean(…, 220)` cắt: câu cuối dài >110 ký tự nên thuật toán rơi về cắt ở khoảng trắng → câu cụt.

## LỆNH #27 — vá content.js (Cloud Shell)
`/tmp/c27.cjs`: thay NGUYÊN dòng `function clean(s, max) {…}` bằng bản mới: chỉ cắt ở **cuối câu** (`. ! ? …` + khoảng trắng/hết chuỗi); câu cuối trong `max` quá ngắn (<50% max) thì cho vượt tới `max×1.5` để kết câu; không có dấu câu → cắt khoảng trắng + "…". `replyGen`: `clean(x, 220)` → `clean(x, 500)` (lead.reply vốn ~250 ký tự, giữ nguyên câu). Chế độ AI/template: `clean(x, 220)` → `clean(x, 320)` (prompt vẫn xin <180 ký tự; 320 chỉ là trần an toàn). Inbox 620 giữ nguyên (đã đủ). Fail-closed: `clean` phải nằm trọn 1 dòng + `replyGen` phải có `clean(x, 220)`, không thì không ghi. Marker idempotent `LENH #27`.
`run27.sh`: backup `content.js.bak-<TS>` → patch → `node --check` → test thật `genForLead` chế độ reply với đúng câu 247 ký tự (phải trả đủ câu, không thì dừng trước deploy) → `firebase deploy --only functions:outreachTick,functions:genContent`.
Đã test cục bộ trên bản mô phỏng 4 dòng: patch idempotent 2 lần, `clean(full,220)` → trả đủ 247 ký tự kết thúc "?", chuỗi dài hơn cắt đúng cuối câu, chuỗi không dấu câu cắt ở khoảng trắng + "…", link/hashtag vẫn bị bỏ.

## Sau deploy
- Lead MỚI vào phễu sẽ nhận nguyên câu. Thread đang chạy dở giữ payload cũ (không đổi).
- Nghiệm thu: Tiếp cận → ✍️ Content Studio brand → "Sinh thử" 1 lead có gợi ý dài → comment hiện đủ câu; hoặc chờ dòng "Bình luận vào bài của Lead" kế tiếp trên "Hoạt động gần đây".

## LỆNH #28 — mở lại 11 thread comment-lead đã chết hôm 09-03 (nguyên nhân: nick để FB tiếng Anh → worker không thấy nút "Thích")
Script `_cl_reopen.mjs` (đặt trong `~/firebase-s13/functions`, import `./content.js` để soạn lại nội dung đủ câu theo LỆNH #27). Chỉ đụng thread `step=funnel + fpayload.kind=comment + active=false + tries≥5`; fail-closed: số thread phải = 11 (`--force` để ép). Nick tắt/needLogin → chuyển sang nick AdsPower đang bật cùng brand (xoay vòng). Ghi `active:true, tries:0, lastError:null, nextAt` giãn 2′/thread → engine tự re-enqueue 1 thread/nick/tick + pace 3–8′ (KHÔNG burst). Đã test trên stub Firestore: 11/11 đúng, thread đang chạy + thread lead-bài không bị đụng.
```bash
cd ~/firebase-s13/functions && cat > _cl_reopen.mjs <<'EOF2'
/* LỆNH #28 — mở lại các thread comment-lead đã chết (tries≥5, active:false) để engine chạy lại bằng nick đã đổi Tiếng Việt.
   - Chỉ đụng thread: step 'funnel' + fpayload.kind 'comment' + active false + tries ≥ 5 (fail-closed: số lượng phải = EXPECT, khác thì KHÔNG ghi; --force để ép).
   - Soạn lại comment_msg/inbox_msg bằng genForLead (bản LỆNH #27, đủ câu) từ lead + brand hiện tại.
   - Nick: giữ pid cũ nếu nick đó còn bật; nick tắt → chuyển sang nick AdsPower đang bật cùng brand (xoay vòng); brand không còn nick bật → bỏ qua.
   - Ghi: active:true, tries:0, lastError:null, nextAt giãn 2′/thread (engine tự re-enqueue 1 thread/nick/tick + pace 3–8′ → KHÔNG burst).
   Chạy: node _cl_reopen.mjs            (dry-run, chỉ in kế hoạch)
         node _cl_reopen.mjs --apply    (ghi; dừng nếu số thread ≠ EXPECT)   --force (bỏ kiểm EXPECT) */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const { genForLead } = await import('./content.js');
const APPLY = process.argv.includes('--apply'), FORCE = process.argv.includes('--force');
const EXPECT = 11;
const vn = ms => ms ? new Date(ms + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '—';
const th = await db.collection('outreach_threads').get();
const dead = [];
th.forEach(d => { const x = d.data() || {}; const p = x.fpayload || {};
  if (x.step === 'funnel' && p.kind === 'comment' && x.active === false && Number(x.tries || 0) >= 5) dead.push({ id: d.id, x }); });
console.log('Thread comment-lead đã chết:', dead.length, '(kỳ vọng', EXPECT + ')');
if (!dead.length) { console.log('Không có gì để mở lại.'); process.exit(0); }
// nick AdsPower đang bật theo brand
const fa = await db.collection('fb_accounts').get();
const nicks = {}; const nickOk = {};
fa.forEach(d => { const a = d.data() || {}; nickOk[d.id] = a.engine === 'adspower' && a.active === true && !a.needLogin && !a.safetyPaused;
  if (nickOk[d.id]) (nicks[a.brand || ''] = nicks[a.brand || ''] || []).push(d.id); });
const rr = {};
const plan = [];
for (const t of dead) {
  const x = t.x, p = x.fpayload || {};
  const brandCode = x.brandCode || x.brand || '';
  const leadId = String(x.leadId || t.id);
  const leadSnap = await db.collection('leads').doc(leadId).get();
  if (!leadSnap.exists) { plan.push({ id: t.id, skip: 'lead không còn' }); continue; }
  const lead = Object.assign({ id: leadId }, leadSnap.data());
  const brandSnap = await db.collection('brands').doc(brandCode).get();
  const brand = Object.assign({ code: brandCode }, brandSnap.exists ? brandSnap.data() : {});
  let pid = String(x.pid || '');
  let note = 'giữ nick';
  if (!nickOk[pid]) { const list = nicks[brandCode] || []; if (!list.length) { plan.push({ id: t.id, skip: 'brand ' + brandCode + ' không còn nick AdsPower đang bật' }); continue; }
    rr[brandCode] = (rr[brandCode] || 0) % list.length; pid = list[rr[brandCode]++]; note = 'đổi nick → ' + pid; }
  let gen = null; try { gen = await genForLead(brand, lead); } catch (e) { gen = null; note += ' | genForLead lỗi: ' + String(e && e.message || e).slice(0, 60) + ' (giữ nội dung cũ)'; }
  const comment_msg = (gen && gen.comment) || p.comment_msg || '', inbox_msg = (gen && gen.inbox) || p.inbox_msg || comment_msg;
  plan.push({ id: t.id, leadId, brandCode, pid, note, mode: gen && gen.mode, oldLen: String(p.comment_msg || '').length, newLen: comment_msg.length,
    write: { active: true, tries: 0, lastError: null, taskStatus: 'failed', nextAt: Date.now() + plan.length * 120000, pid,
      fpayload: Object.assign({}, p, { comment_msg, inbox_msg, content_mode: (gen && gen.mode) || p.content_mode || '' }),
      reopenedAt: Date.now(), reopenedBy: 'LENH28' } });
}
for (const r of plan) console.log(r.skip ? ('  ✗ ' + r.id + ' BỎ QUA: ' + r.skip) : ('  ✓ ' + r.id + ' | ' + r.brandCode + ' | ' + r.note + ' | comment ' + r.oldLen + '→' + r.newLen + ' ký tự (' + (r.mode || '?') + ') | chạy từ ' + vn(r.write.nextAt) + ' VN'));
const todo = plan.filter(r => !r.skip);
if (!APPLY) { console.log('\nDRY-RUN: chưa ghi gì. Chạy lại với --apply để mở lại', todo.length, 'thread.'); process.exit(0); }
if (dead.length !== EXPECT && !FORCE) { console.log('\nDỪNG: số thread đã chết =', dead.length, '≠', EXPECT, '→ không ghi (thêm --force nếu đúng ý).'); process.exit(2); }
let n = 0; for (const r of todo) { await db.collection('outreach_threads').doc(r.id).set(r.write, { merge: true }); n++; }
console.log('\nĐÃ MỞ LẠI', n, 'thread. Engine sẽ tự đẩy lại 1 thread/nick/vòng (5′) + giãn nhịp → xem "Hoạt động gần đây" trong ~1 giờ.');
EOF2
set -a; . ./.env; set +a
node _cl_reopen.mjs --apply; rm -f _cl_reopen.mjs
```
