# Worker `2026-09-05b` — sửa trả lời bình luận (comment-lead) + 4 gia cố (05/09/2026)

> File giao anh: `worker.mjs` (bản `2026-09-05b`) — chép đè lên MỌI VPS (cùng thư mục worker), rồi chạy lại `run.bat`.
> Không đổi `config.json`, không đổi backend, không cần zip FE.

## Lỗi anh báo
"Hoạt động gần đây" lead Đỗ Minh Hương (lead đến từ bình luận): tym bình luận ✓, **"Trả lời bình luận của Lead thất bại — không thấy ô trả lời TRONG khung bình luận mục tiêu (bỏ để an toàn)"**, dòng hẹn chạy lại ghi nhầm "Inbox mở đầu cho Lead thất bại".

## Nguyên nhân
- `replyComment` (bản v119-38) chỉ tìm ô soạn **bên trong** `div[role=article]` của bình luận mục tiêu (để không gõ nhầm ô "Bình luận" của bài). Nhưng Facebook vẽ ô trả lời **ngoài** article đó (node đứng sau khung bình luận, cùng `<li>`) → không bao giờ thấy → luôn thất bại (fail-closed nên không gõ bậy, chỉ mất bước).
- Nhãn "Inbox mở đầu…" là do `actionLabel` không có nhánh `funnel` (rơi về mặc định).

## Sửa trong worker (5 điểm, marker `v2026-09-05b`)
1. **`replyComment` viết lại**: đánh dấu mọi ô textbox ĐANG CÓ (`data-sl-old`) → bấm "Phản hồi" (scoped trong khung bình luận) → poll ≤6 s tìm ô **MỚI**, hiển thị, đứng **sau/trong** khung bình luận theo thứ tự DOM (`compareDocumentPosition`), nhãn kiểu trả lời (Trả lời dưới tên… / Viết câu trả lời… / Phản hồi / Reply as…) và **không** phải nhãn ô bình luận của bài; không nhãn thì chỉ nhận khi là ô mới duy nhất. Không thấy → throw (chưa gõ gì → retry an toàn). Sau Enter ô còn chữ → Enter lần 2 → vẫn còn → throw "chưa gửi được".
2. **`actionLabel('funnel')`** = "Phễu tự động cho Lead" (hết nhãn "Inbox mở đầu…" sai).
3. **Kiểm ngôn ngữ FB sau khi mở nick** (`pageLang` đọc `<html lang>`): khác `vi` → ghi `fb_accounts.uiLang` + hoãn việc 60′ với lý do rõ trên web ("nick đang để ngôn ngữ Facebook "en" — đổi sang Tiếng Việt…"), không đốt tries. Tắt bằng `"requireViUI": false` trong config.json.
4. **Chờ trang vẽ xong** (`waitForContent`, ≤12 s) ở `gotoPost` và `findCommentEl` thay vì chỉ ngủ cứng 3,5 s (bớt "không thấy nút Thích" khi mạng chậm).
5. **Bỏ qua lead không xem được** (`onSkip`): text "Nội dung này hiện không hiển thị / This content isn't available / nhóm riêng tư chưa tham gia / bình luận đã xoá-ẩn" → thread `active:false`, `taskStatus:'skipped'`, log `⏭ Bỏ qua lead — <lý do>` (status `skip`), hoàn quota bước chưa làm, chụp 1 ảnh `errors/<leadId>__<step>_skip.png`. Hết cảnh retry 5 lần × 15′ mở nick vô ích.

## Kiểm chứng
- `node --check` OK.
- Harness DOM thật (Chromium, `wk05/t_reply.mjs`): **19/19** — ô trả lời ngoài/trong article, nhiều dòng (Shift+Enter), giao diện English, không ra ô → throw, ô mới nhưng nhãn "Bình luận dưới tên" → từ chối, ô không nhãn duy nhất → nhận, comment_id prefix không khớp → skip, "không hiển thị" → skip nhanh, bài vẽ chậm 1,2 s → chờ được, nhóm riêng tư → skip, trang không rõ → false không throw, pageLang vi/en/rỗng, nhãn funnel, `runFunnel` comment-lead trọn (thread done + log đúng nhãn), bài-lead không hiển thị → e.skip.
- Harness cũ: `t_flow.mjs` 16/16, `t_uid.mjs` 9/9.

## Nghiệm thu trên VPS
Sau khi chép đè + chạy lại: cửa sổ worker in `v2026-09-05b`; khi bốc trúng comment-lead, "Hoạt động gần đây" hiện *Thả cảm xúc vào bình luận → Trả lời bình luận của Lead* (✓ Đã gửi), cửa sổ worker có dòng `ô trả lời: {"label":"trả lời dưới tên …","inside":false,…}`. Nếu vẫn thất bại: gửi em ảnh `errors/<leadId>__comment_0.png` + dòng `ô trả lời` (nếu có) để em chỉnh nhãn.

## Bản `2026-09-05c` (cùng ngày, sau ảnh lỗi 18:38 VN)

Anh chạy bản b → vẫn "không thấy ô trả lời xuất hiện sau khi bấm Phản hồi". Ảnh `errors/` cho thấy ô trả lời **đã mở** (có sẵn tag "Đỗ Minh Hương", Facebook tự focus), tức bộ lọc theo NHÃN của bản b trượt: nhãn ô trả lời trên giao diện mới **giống hệt ô bình luận của bài** ("Viết bình luận công khai…"), nút Thích dưới bình luận là **icon** (không có chữ), và Facebook có thể **vẽ lại khung comment** khi mở ô (mất `data-sl-target`).

Sửa (`replyComment` viết lại lần 2, marker `v2026-09-05c`):
- Nhận ô theo **cấu trúc**: (1) ô đang được **focus** ngay sau cú bấm "Trả lời" — miễn không phải ô CŨ (đã hiển thị trước cú bấm) mang nhãn bình luận bài; (2) ô mới đứng sau/trong khung comment có nhãn trả lời; (3) ô mới duy nhất không phải nhãn bài; (4) ô nhãn trả lời nằm trong khung. Chỉ đánh dấu "cũ" các ô **đang hiển thị** (ô dựng sẵn nhưng ẩn → khi hiện ra vẫn tính là mới).
- `findCommentEl` ghi `comment_id` lên `<html data-sl-cid>`; khung comment mất dấu → đánh dấu lại theo permalink.
- Tag tên có sẵn: đưa caret về **cuối** (End) trước khi gõ, thiếu khoảng trắng thì thêm → không gõ đè lên tag.
- Sau Enter: chỉ tính "chưa gửi" khi **nội dung của mình** còn trong ô (ô chỉ còn tag tên = đã gửi, KHÔNG Enter thêm — tránh đăng bình luận chỉ có tên); chưa gửi + chưa thấy trên bài (`verifyCommentPosted`: chữ trong article NGOÀI ô soạn) → bấm nút Gửi của chính ô (hoặc Enter lần 2) → vẫn còn → throw.
- Không nhận được ô → in **chẩn đoán** mọi textbox (nhãn/cũ/sau khung/focus) ra cửa sổ worker + đính vào lỗi.
- `tymComment`/`verifyCommentReact` nhận thêm nút icon (`aria-label` Thích / Bỏ thích / `aria-pressed`).

Kiểm: `wk05/t_reply2.mjs` (mock đúng giao diện trong ảnh) **9/9** — ô ngoài article + nhãn giống ô bài + tag + vẽ lại khung; ô dựng sẵn ẩn; ô ở lại sau gửi (không đăng thêm); chỉ có nút Gửi; nhiều dòng; bấm không mở ô → throw; ô bài đang focus → từ chối; runFunnel trọn. `t_reply.mjs` 19/19 (cập nhật 1 kỳ vọng: ô MỚI được focus dù nhãn giống ô bài = ô trả lời), `t_flow` 16/16, `t_uid` 9/9, `node --check` OK. Backup `worker.2026-09-05b.bak.mjs` (scratchpad).
