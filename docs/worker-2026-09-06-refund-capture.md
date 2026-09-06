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
