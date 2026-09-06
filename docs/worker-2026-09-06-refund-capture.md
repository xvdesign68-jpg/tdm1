# Worker AdsPower `worker.mjs` bản `2026-09-06` — hoàn van kết bạn khi bỏ qua + chế độ capture đầy đủ (06/09/2026)

> Chép đè `worker.mjs` lên MỌI VPS rồi chạy lại `run.bat` (worker tự in `v2026-09-06` ở dòng đầu). Không đổi `config.json`, không đổi backend.

## 1. Hoàn 1 suất van kết bạn khi bước Kết bạn "bỏ qua thành công"
- Engine reserve cap từng bước (`tryConsume` → `outreach_usage/{pid}__{ngày}`) NGAY lúc xếp phễu. Worker mở trang cá nhân, thấy **"Bạn bè" / "Huỷ lời mời" / "Cancel request"** (đã là bạn hoặc đã gửi lời mời từ trước) → không bấm gì, coi bước là xong.
- Trước đây: suất kết bạn ĐÃ reserve không được trả lại → nick hao 1 suất/ngày oan, và KPI brand `outreach_stats.friend` vẫn +1 dù không gửi lời mời nào.
- Bản 2026-09-06: nhánh `already` trong `runFunnel` (và đường per-step cũ `execOnPage`) gọi `refundQuota(t.pid, ['add_friend'], [])` → `outreach_usage.friend −1`; `logStep(..., { noStat: true })` → ghi log "đã là bạn / đã gửi lời mời trước → bỏ qua, hoàn 1 suất van kết bạn" (status done) nhưng KHÔNG cộng KPI friend; `stampLead`/`doneSteps` vẫn ghi (bước vẫn tính là xong → inbox chạy tiếp).
- Harness `docs/harness-worker-refund-2026-09-06.mjs` 6/6 (A: đã gửi lời mời → usage.friend −1, stats không friend, inbox +1, thread done; B: chưa là bạn → không hoàn, friend +1). Harness cũ t_flow 16/16 · t_reply 19/19 · t_reply2 9/9 · t_uid 9/9 vẫn PASS.
- Hạn chế đã biết (giữ như `refundQuota` cũ): hoàn vào doc NGÀY HIỆN TẠI (giờ VN); phễu reserve hôm qua mà chạy sang ngày mới thì suất hoàn rơi vào hôm nay (van hôm nay rộng thêm 1 — không đáng kể).

## 2. Chế độ capture đầy đủ — lấy doc_id + variables cho comment-lead (tym bình luận + trả lời bình luận)
Chạy trên VPS (đóng worker thường trước để không tranh profile):
```
node worker.mjs --capture <adspower_profile_id>
```
Worker mở nick, anh **tự tay** làm trên 1 bài trong NHÓM (bài có sẵn vài bình luận):
1. Thả ❤️ (hoặc 👍) vào **1 BÌNH LUẬN** dưới bài (không phải bài).
2. Bấm **"Phản hồi"** ngay dưới 1 bình luận, gõ 1 câu ngắn, Enter để gửi.
3. (Tuỳ chọn, để đối chiếu) thả cảm xúc vào chính BÀI + viết 1 bình luận cấp 1.

Worker ghi mọi lệnh GraphQL liên quan (tên có React/Comment/Feedback/UFI/Friend/Reply) vào file **`capture-<thời gian>.log`** cạnh `worker.mjs`: `doc_id`, `variables` đã giải mã (bỏ tracking/session/idempotence), `feedback_id` giải mã base64 (để xác nhận `feedback:<comment_id>`), và 2500 ký tự đầu của response (xem `errors`/`comment_create`). Xong: Ctrl+C, **gửi FILE capture-*.log cho Claude** (không cần chụp ảnh). Từ đó Claude điền `config.json → graphql.commentReactDocId / replyDocId` + viết đường API nội bộ cho comment-lead ở bản worker kế (DOM vẫn là fallback).

## 3. Không đổi
Luồng funnel bài, comment-lead DOM (05b/05c), checkReplies, Safety Score, gate ngôn ngữ FB, heartbeat — giữ nguyên.

## ★ Bản `2026-09-06b` — comment-lead đi API nội bộ (sau capture 06/09 08:47–08:50 VN, nick k1gm6por)
### Capture cho thấy
- **Tym bình luận** = cùng mutation react bài `CometUFIFeedbackReactMutation` doc_id `27646120298312844`, chỉ khác **`feedback_id` = base64("feedback:<postId>_<commentId>")** (vd `feedback:1735915220991477_1744380153478317`), `feedback_source: "OBJECT"`. Response `feedback_react.feedback.viewer_feedback_reaction_info.id` = id cảm xúc → react thật.
- **Trả lời bình luận** = `useCometUFICreateCommentMutation` **doc_id `28781864408106143`** (MỚI — bản 29/08 là `28980334608233889`, FB đã xoay), variables như comment bài + **`reply_comment_parent_fbid` = base64("comment:<postId>_<commentId>")**, `reply_target_clicked: true`, `feedLocation: "POST_PERMALINK_DIALOG"`, `feedbackSource: 2`, `translationType: "ORIGINAL"`; FB tự thêm `message.ranges` tag tên chủ comment (worker gửi `ranges: []` — reply vẫn lồng đúng dưới comment cha, chủ comment vẫn được báo). Response có `comment_create`.
- Bình luận cấp 1 lên bài (đối chiếu) cũng dùng doc_id `28781864408106143` → **config.json `commentDocId` nên cập nhật** sang id này (đường comment bài có thể đang rơi DOM vì id cũ).
- Không cần doc_id mới cho react (dùng chung); inbox vẫn WebSocket (không có graphql) → DOM messenger như cũ.

### Worker `2026-09-06b` làm gì
- Helper `cmtFeedbackId(postId,cid)` / `cmtParentFbid(postId,cid)`; `gqlReactComment()` (dùng lại `gqlReact` với feedback id bình luận, source OBJECT); `gqlReply()` (doc_id = `graphql.replyDocId || commentDocId`, đủ bộ biến như capture) trả `{ok, ambiguous, sample}`.
- `runFunnel` comment-lead: bước **react** → API trước (chỉ cần đứng trên trang bài `gotoCmtPage()`, không định vị khung comment) → OK = xong; API tắt/lỗi → DOM tym như cũ (best-effort). Bước **comment** → `gqlReply` → OK = xong; **mơ hồ** (200 nhưng không thấy `comment_create`) → mở khung comment + `verifyComment` thấy chữ của mình → coi là đã gửi, KHÔNG gõ lại (chống double); lỗi rõ → DOM `replyComment` như cũ (fail-closed).
- `graphql` rỗng → không gọi API, hành vi y bản cũ (harness DOM thật t_reply/t_reply2 vẫn PASS).
- Kiểm: `docs/harness-worker-cmtapi-2026-09-06.mjs` **12/12** (A API OK 2 bước đúng doc_id/feedback_id/parent_fbid/feedLocation/groupID, 1 lần điều hướng; B mơ hồ + đã hiện → không gõ; C lỗi → DOM fail-closed; D graphql tắt → 0 lệnh API; E thiếu replyDocId → dùng commentDocId; F lead-bài không đổi) + t_flow 16/16 · t_reply 19/19 · t_reply2 9/9 · t_uid 9/9 · t_refund 6/6. Backup `worker.2026-09-06.bak.mjs` (scratchpad).

### Anh làm trên VPS
1. Chép đè `worker.mjs` (2026-09-06b).
2. Mở `config.json`, sửa khối `graphql` thành (giữ nguyên các mục khác):
```json
"graphql": { "reactDocId": "27646120298312844", "commentDocId": "28781864408106143", "replyDocId": "28781864408106143", "friendDocId": "28400389149651601" }
```
3. Bấm đúp `run.bat` → dòng đầu `v2026-09-06b`, `API nội bộ=BẬT`.
4. Nghiệm thu: khi engine bốc lead-bình luận, cửa sổ worker in `react-comment API: OK` + `reply API: OK`; web "Hoạt động gần đây" hiện *Thả cảm xúc ❤️ vào bình luận của Lead ✓ → Trả lời bình luận của Lead ✓* nhanh hơn (không mở khung comment). Nếu in `FAIL` kèm `errors` → gửi em dòng đó (doc_id lại đổi → capture lại).

## ★ Worker `2026-09-06c` (06/09/2026, đi cùng LỆNH #34 — meta nội dung lên lead)
- **Mục đích**: web đo tỉ lệ khách phản hồi theo KIỂU nội dung (cách soạn · bài gốc là bài chào bán của người khác hay không · kiểu bình luận · CTA · kiểu mở đầu inbox AI xoay) → Content Studio card "📈 Hiệu quả nội dung" (zip v119-55).
- **Thay đổi (marker `v2026-09-06c`)**: `stampExtra(t, action)` — nếu `task.payload.content_meta` là object (engine đóng dấu từ `genForLead(...).meta`, LỆNH #34) → ghi `leads/{id}.outreach.content = meta`; bước `comment` → `outreach.comment_at`, bước `inbox` → `outreach.inbox_at` (ms). Gọi ở 2 chỗ `stampLead` (per-step `addLog` + funnel `logStep`, kể cả nhánh "đã là bạn"). `set(merge:true)` → KHÔNG đè `replied_at`/field khác. Không có meta → không ghi gì thêm (hành vi cũ).
- **Kiểm**: `docs/harness-worker-meta-2026-09-06.mjs` 7/7 (comment-lead API → content + comment_at; kết bạn+inbox → inbox_at + content mới thay content cũ, replied_at giữ; không meta / meta rác → bỏ qua; nhánh đã-là-bạn vẫn ghi) + 6 harness cũ PASS; `node --check` OK. Stub Firestore của harness (`wk05/stubs.mjs`) sửa `applyMerge` merge SÂU map lồng như Firestore thật (trước merge nông → harness báo sai).
- **Anh cần**: chép đè `worker.mjs` MỌI VPS + chạy lại run.bat (config.json không đổi so với bản 2026-09-06b). Nghiệm thu: sau 1 phễu có inbox, lead trong Firestore có `outreach.content.v=34` + `outreach.inbox_at`; web Content Studio hiện "Đã inbox 1".

## Worker `2026-09-06d` — watchdog HUỶ CỨNG phiên nick treo (hết zombie) — 06/09/2026
- **Tồn từ v119-38/39**: `withTimeout(runNick)` chỉ *resolve sớm* khi nick quá `nickTimeoutMs` (8'); `runNick` vẫn chạy nền (zombie) tới khi Playwright tự timeout — nick treo THẬT >20' có thể làm lại việc reaper đã trả về (double-act). Guard `runGen/superseded` chỉ chặn `adspowerStop` nhầm.
- **Sửa** (patch `docs/worker-2026-09-06d-patch.cjs`, marker `v2026-09-06d`, 16 mốc): (1) `tick` tạo `ctl={aborted,browser,page}` cho từng nick → `withTimeout(..., () => hardCancel(ctl, profile))`; (2) `hardCancel`: đặt cờ + `browser.close()` (kết nối `connectOverCDP` → NGẮT kết nối, không tắt AdsPower) → mọi thao tác Playwright dở dang ném "has been closed" → `runNick` unwind trong vài giây; (3) `runNick(profile, tasks, ctl)`: kiểm cờ sau `adspowerStart`/`getPage`, trước mỗi việc, trong catch (đã huỷ → `onInfra` hẹn 10' KHÔNG đốt tries, `markTask failed`, việc còn lại xử lý ngay không chờ reaper), bỏ `checkReplies` khi huỷ; (4) `runFunnel`: `abortCheck(page)` trước mỗi bước (`page.__slCtl`), lỗi khi đã huỷ = hạ tầng+watchdog (giữ `doneSteps` → retry không làm lại bước đã xong); (5) `isInfraErr` + `watchdog|has been closed|Connection closed|Browser closed`; (6) `adspowerStart` fetch `AbortSignal.timeout(90 s)`, `connectOverCDP(cdp, {timeout: 60 s})` — AdsPower/CDP treo không còn "không có gì để ngắt".
- **Kiểm**: harness `docs/harness-worker-zombie-2026-09-06.mjs` **13/13** (A: nick treo ở trang bài → huỷ sau 150 ms, runNick thoát <500 ms, 2 thread `hạ tầng: watchdog` + nextAt ~10', task failed, log `retry` ×2 không `fail`, adspowerStop đúng 1 lần, runningNicks 0, doneSteps nguyên; A2: lần chạy kế không dính cờ; B: AdsPower start treo → cờ đặt khi chưa có browser → start trả về là thoát ngay; C: `abortCheck` giữa phễu ném infra+watchdog, không log fail). 7 harness cũ vẫn PASS (t_flow 16 · t_reply 19 · t_reply2 9 · t_uid 9 · t_refund 6 · t_cmtapi 12 · t_meta 7). `node --check` OK.
- **Vận hành**: chép `worker.mjs` đè MỌI VPS + chạy lại `run.bat`; cửa sổ worker khi có nick treo sẽ in `⏱ nick <id> quá giờ (480s) — HUỶ CỨNG: ngắt trình duyệt…` rồi `⏱ nick …: phiên đã bị huỷ cứng — việc dở hẹn lại 10'`; web "Hoạt động gần đây" hiện dòng `↻ Lỗi hạ tầng … thử lại sau 10 phút` với text `watchdog: …`. Reaper (15'+) vẫn giữ làm lưới cuối cho ca worker crash cứng.
