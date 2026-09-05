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

## LỆNH #29 — llmJson: GPT-5 đốt token suy nghĩ trong trần 700 → "LLM không trả JSON" → rơi fallback (ĐÃ CHẠY 05/09 11:15 UTC)
Phát hiện từ output LỆNH #28: brand hscl-01 chạy chế độ AI (có Hồ sơ AI), 2/11 lead báo `LLM không trả JSON [gpt-5.6-sol]` → dùng `lead.reply` → đó là gốc của comment cụt chiều 05/09. Nguyên nhân: `max_completion_tokens=700` quá nhỏ cho model reasoning (token suy nghĩ tính vào trần) → content rỗng/cụt. Vá `/tmp/c29.cjs` (marker `LENH #29`, fail-closed 3 mốc): trần → `LLM_MAX_TOKENS` (mặc định 2000); gpt-5x/ox thêm `reasoning_effort` (`LLM_REASONING`, mặc định `low`; API từ chối → tự bỏ, retry `noReason`); `finish_reason=length` không có JSON → thử lại 1 lần trần gấp đôi (`bigger`); lỗi ghi rõ `finish=<reason>, N ký tự`. Test giả lập 3 kịch bản PASS. **Kết quả thật**: backup `content.js.bak-20260905-111503`, PATCH OK, SYNTAX OK, test lead PQQbXjZQjF09MjhPP5LL (AI từng lỗi) → `mode ai | gpt-5.6-sol | 11 s | spam 3`, comment 118 ký tự kiểu soft đúng ngành (tép khô), inbox 338 ký tự cá nhân hoá + opt-out; deploy `outreachTick` + `genContent` Successful. Nhanh hơn trước (16 s → 11 s) nhờ reasoning low. Tồn nhỏ: dòng opt-out ép nguyên văn "anh/chị" dù thân tin xưng "Anh" (polish sau).
```bash
cat > /tmp/c29.cjs <<'EOF'
/* LỆNH #29 — content.js llmJson: model GPT-5 (reasoning) đốt token suy nghĩ trong max_completion_tokens=700 → content rỗng/cụt → "LLM không trả JSON" → rơi fallback lead.reply.
   Vá: trần token 700 → LLM_MAX_TOKENS (mặc định 2000); gpt-5x và ox thêm reasoning_effort (LLM_REASONING, mặc định 'low'; API từ chối → tự bỏ);
   finish_reason=length → thử lại 1 lần với trần gấp đôi; lỗi "không trả JSON" ghi rõ finish_reason + độ dài để chẩn đoán. Idempotent (marker LENH #29), fail-closed. */
const fs = require('fs');
const f = process.argv[2] || 'content.js';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('LENH #29')) { console.log('ĐÃ PATCH (idempotent)'); process.exit(0); }
const fail = [];
function rep(label, a, b) { const n = s.split(a).length - 1; if (n !== 1) { fail.push(label + ': mốc xuất hiện ' + n + ' lần (cần 1)'); return; } s = s.replace(a, () => b); }
rep('max tokens', "  if (o.legacyMax) body.max_tokens = 700; else body.max_completion_tokens = 700;",
`  const MAXT = (Number(process.env.LLM_MAX_TOKENS) || 2000) * (o.bigger ? 2 : 1); // LENH #29: 700 quá nhỏ cho model reasoning (gpt-5*) → content rỗng
  if (o.legacyMax) body.max_tokens = MAXT; else body.max_completion_tokens = MAXT;
  if (/^(gpt-5|o[0-9])/i.test(model) && !o.noReason) body.reasoning_effort = process.env.LLM_REASONING || 'low'; // LENH #29: bớt token suy nghĩ, trả nhanh hơn`);
rep('retry response_format', "    if (/response_format|json_object/i.test(msg) && !o.noJson) return llmJson(sys, usr, Object.assign({}, o, { noJson: true }));",
`    if (/response_format|json_object/i.test(msg) && !o.noJson) return llmJson(sys, usr, Object.assign({}, o, { noJson: true }));
    if (/reasoning_effort|reasoning/i.test(msg) && !o.noReason) return llmJson(sys, usr, Object.assign({}, o, { noReason: true })); // LENH #29`);
rep('no json', "  const m = String(txt).match(/\\{[\\s\\S]*\\}/); if (!m) throw new Error('LLM không trả JSON [model ' + model + ']');",
`  const fr = (j && j.choices && j.choices[0] && j.choices[0].finish_reason) || '';
  const m = String(txt).match(/\\{[\\s\\S]*\\}/);
  if (!m && fr === 'length' && !o.bigger) return llmJson(sys, usr, Object.assign({}, o, { bigger: true })); // LENH #29: cụt vì trần token → thử trần gấp đôi 1 lần
  if (!m) throw new Error('LLM không trả JSON (finish=' + (fr || '?') + ', ' + String(txt).length + ' ký tự) [model ' + model + ']');`);
if (fail.length) { console.error('KHÔNG PATCH — ' + fail.join(' | ')); process.exit(2); }
fs.writeFileSync(f, s);
console.log('PATCH OK');
EOF
cat > /tmp/run29.sh <<'EOF'
set -e
cd ~/firebase-s13/functions
TS=$(date +%Y%m%d-%H%M%S)
if grep -q "LENH #29" content.js; then echo "content.js đã có LENH #29 (giữ backup cũ)"; else cp content.js "content.js.bak-$TS"; echo "backup content.js.bak-$TS"; fi
node /tmp/c29.cjs content.js
node --check content.js && echo "SYNTAX OK"
set -a; . ./.env; set +a
echo "== test thật genForLead chế độ AI (brand hscl-01, lead PQQbXjZQjF09MjhPP5LL — lead AI vừa lỗi ở LỆNH #28) =="
node --input-type=module -e "
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const { genForLead } = await import('./content.js');
const b = (await db.doc('brands/hscl-01').get()).data() || {}; const l = (await db.doc('leads/PQQbXjZQjF09MjhPP5LL').get()).data() || {};
const t0 = Date.now(); const g = await genForLead(Object.assign({ code: 'hscl-01' }, b), Object.assign({ id: 'PQQbXjZQjF09MjhPP5LL' }, l));
console.log('mode', g.mode, '| model', g.model || g._model || '?', '| ' + Math.round((Date.now() - t0) / 1000) + ' s', '| spam', g.spam, '| note', g.note || '—');
console.log('COMMENT (' + g.comment.length + '):', g.comment);
console.log('INBOX (' + g.inbox.length + '):', g.inbox);
" || echo "(test AI lỗi — vẫn deploy vì fallback giữ nguyên; gửi em dòng lỗi phía trên)"
echo "== deploy =="
cd ~/firebase-s13 && firebase deploy --only functions:outreachTick,functions:genContent --force
echo "== xong == exit=$?"
EOF
bash /tmp/run29.sh
```

## LỆNH #30 — bình luận công khai LUÔN có CTA + bám đúng câu khách hỏi (05/09, anh chốt sau lead Hien Chau Thi Thu)

**Bối cảnh**: lead từ bình luận "Giá" nhận câu trả lời kiểu mềm "Mình hiểu, xem cá lóc khô thì giá là điều cần biết đầu tiên…" (chế độ AI, `commentStyle` mặc định `soft` = không chào bán, không CTA). Anh: *thị trường VN, câu vô thưởng vô phạt không chuyển đổi — phải có CTA điều hướng*.

**#30a (chỉ đọc, đã chạy)**: dump `content.js` 88 dòng (`~/content-dump-0905.txt`, anh upload) → em tái lập file cục bộ, vá + test trước. Khối in lead mẫu lỗi `Cannot find package 'firebase-admin'` vì script đặt ở `/tmp` (lặp lại lỗi LỆNH #24) → **quy tắc: mọi script Admin SDK phải nằm trong `~/firebase-s13/functions`**.

**#30b** (`lenh-2026-09-05-30b-cta.sh` = khối anh dán; patch `lenh-2026-09-05-30-c30.cjs`, marker `LENH #30`, 8 mốc, fail-closed, idempotent):
1. `CMT_SOFT` viết lại có CTA; thêm `CTA_DEF` (3 CTA mặc định), `CTA_RE` (dấu hiệu đã có CTA: inbox/ib/nhắn/liên hệ/để lại/báo giá/bảng giá/tư vấn/số lượng/sỉ/lẻ/cho mình xin…), `ensureCta(s, c)` = thiếu CTA → nối `content.cta` của brand (≤140 ký tự) hoặc CTA mặc định, cắt thân ở cuối câu để tổng ≤ ~360.
2. `contentOf`: `commentStyle` mặc định → **`direct`** (chỉ `soft` khi brand chọn rõ).
3. `templateGen` (trần 220 → 320, sót từ #27) + `replyGen` + comment AI đều qua `ensureCta`.
4. Prompt: nhận diện lead là BÌNH LUẬN (`comment_id/comment_url/kind`), tách text khách (`text` hoặc `comment_text/commentText/comment`) và bài gốc (`parent_text/parentText/post_text/postText/parent_post`); "comment" phải trả lời ĐÚNG bình luận khách vừa viết, câu 1 hữu ích cụ thể (hỏi giá → giá tuỳ loại/quy cách, không con số), câu cuối = CTA (dựa "CTA mong muốn", khớp xưng hô), ≤3 câu <220 ký tự, cấm câu "chúc bạn sớm tìm được"; `soft` = không nhắc brand/sản phẩm nhưng vẫn CTA nhẹ. `usr` thêm **"GỢI Ý ĐÃ SOẠN CHO SALES"** = `lead.reply` (để câu nick đăng cùng ý câu sales thấy trên web) + BÀI GỐC khi là comment-lead.
5. Test thật `_l30_test.mjs` (trong functions/): 1 lead bình luận + 1 lead bài mới nhất hscl-01 → in field text-ish của lead (xác nhận field chứa câu khách) + comment/inbox + "CÓ CTA ✓" → deploy `outreachTick,genContent`.

Harness cục bộ `harness-content-cta-2026-09-05.mjs` trên bản tái lập (stub fetch): **14/14** — mặc định direct; soft giữ; AI thiếu CTA → nối CTA mặc định/CTA brand; đã có CTA → giữ; prompt comment-lead có BÌNH LUẬN + BÀI GỐC + GỢI Ý SALES; post-lead không có BÀI GỐC; soft đòi CTA nhẹ; templateGen soft luôn CTA; replyGen nối/giữ; ensureCta giới hạn dài; AI lỗi → fallback có CTA.

**#30c (tuỳ chọn)** (`lenh-2026-09-05-30c-regen.sh`): `_l30_regen.mjs [--dry]` — thread funnel `active` chưa có `comment` trong `doneSteps` (lead LỆNH #28 còn xếp hàng) → soạn lại `fpayload.comment_msg/inbox_msg` (+ task `queued/failed/paused`) bằng bản content.js mới; `--dry` chỉ in.

Sau #30: FE Content Studio nên đổi nhãn ô "Kiểu bình luận công khai" (soft = "Nhẹ: đồng cảm + CTA mềm", direct = "Trực tiếp: trả lời + CTA rõ (mặc định)") ở zip kế.
