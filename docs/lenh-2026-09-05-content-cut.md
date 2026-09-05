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
