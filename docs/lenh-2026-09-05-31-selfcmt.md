# LỆNH #31 — Không nhận NGƯỜI BÁN / ĐỐI THỦ / CHÍNH CHỦ BÀI làm lead (05/09/2026)

## Vấn đề (anh phát hiện)
Nhiều người vừa đăng bài vừa tự bình luận dưới bài mình ("Ib tôi", "Gửi kết bạn nhận JD", "Em cần sz 10-12 na"…).
Bình luận đó bị AI chấm thành lead → nick tự động react/comment/kết bạn/inbox **chính người bán = đối thủ của khách hàng**.
Ngoài ra người bán khác vào chào hàng dưới bài người mua ("LIFOOD – Kho hải sản…", "Làm tư vấn cho thuê văn phòng, lương cứng 5tr…") cũng được chấm NÓNG 80–90.

## Kết quả #31a (chỉ đọc, 05/09)
- 413 comment-lead, 30 ngày 359 → **158 (44%) là CHÍNH chủ bài** (tên người bình luận = tên tác giả bài gốc): hscl-01 68 · z15mrc-tts-1 46 · z15mrc-tuyendung1 42 · test-agency 2; nhiệt độ cold 80 · warm 62 · **hot 16**.
- **7 lead chủ bài đã bị máy chạm** (react/comment/kết bạn), **4 thread còn đang mở**.
- 47 bình luận không phải chủ bài nhưng "mùi người bán" (regex), có ca chấm hot 80–90 (đối thủ/nhà tuyển dụng).
- Nguyên nhân trong code:
  - `lib/scorer.js` `buildPostContent` chỉ đưa BÀI GỐC + BÌNH LUẬN — **không đưa danh tính** (ai đăng, ai bình luận), JSON không có VAI người viết → AI không có cách nào biết người bình luận là chủ bài hay người bán.
  - `index.js` vòng comment (~dòng 511) có `parent_author` nhưng **không so với author**; ctx bài cha không lưu `user_url` người đăng.
  - `outreach.js` `stepNickAdspower` chỉ bỏ `dropped`/`junk`/đã có thread/không post_id — **không có cổng vai**.

## LỆNH #31b — 3 tầng + dọn (marker `v-selfcmt`)
### Tầng 1 — Scanner (`lib/scorer.js` + `index.js`)
- **Xác định trước AI (0 đồng)**: `comment.self_comment` = tên bỏ dấu khớp (Đ→d, bỏ ký tự lạ; **tên ẩn danh không tính**) HOẶC link profile khớp (`profile.php?id=`, `/people/…/<id>`, username). Pha 2: `self_comment` → `recordPost(decision:'self_comment')` + đánh dấu seen, **không gọi prefilter/score**. Log `[self-comment] bỏ N …`.
- ctx bài cha thêm `parentUserUrl` (3 chỗ: ctx.set bài · sowMetaOf (pending_snapshots meta) · ctx.set khi gặt) → `comment.parent_user_url`.
- **Prompt**: JSON thêm `"role":"buyer|seller|poster_self|other"` + `"role_reason"`; quy tắc vai (seller = chào bán/cung cấp/tuyển cho chính họ hoặc cùng ngành brand; poster_self = tác giả bài gốc; CHỈ buyer mới `is_real_lead=true`); bình luận kèm `TÁC GIẢ BÀI GỐC / NGƯỜI BÌNH LUẬN / CÙNG MỘT NGƯỜI? CÓ|KHÔNG|không rõ` (ẩn danh → không rõ). PRE_SYS thêm dòng loại người bán/chủ bài. `normRole()` chuẩn hoá giá trị AI trả (đồng nghĩa → 4 giá trị; lạ → other; trống → '').
- **Gate Pha 3**: `role` seller/poster_self → KHÔNG lead dù `is_real_lead=true` → `recordPost(decision:'seller'|'self_comment', role)`. Lead doc ghi `role`, `role_reason`. `scanned_posts` ghi `role`.
- Vá kèm: lượt thử lại của `prefilterLead`/`scoreLead` giữ `brandAi` (bug cũ rơi hồ sơ brand khi retry).
### Tầng 2 — Engine (`outreach.js`)
- `roleBlockOf(lead)`: `role==='seller'` → "người bán/đối thủ (AI: lý do)"; `poster_self`/`self_comment` → "chính chủ bài"; **lead cũ chưa có role**: `kind==='comment'` & tên khớp chủ bài → chặn. Đặt SAU kiểm thread tồn tại, TRƯỚC enqueue.
- Chặn → `skipLeadRole`: thread `outreach_threads/{leadId}` `{active:false, step:'skipped_role', taskStatus:'skipped', skipReason}` (không xét lại mỗi tick) + `addLog` `⏭ Bỏ qua lead — <lý do> (không tiếp cận đối thủ/chủ bài)` status `skip` (FE OA_STATUS có `skip`).
- Func-path `stepNick` CHƯA gate (nick func không dùng).
### Tầng 3 — dọn dữ liệu cũ (`_l31_fix.mjs`, đặt trong functions/)
- A (mặc định): comment-lead tên khớp chủ bài, chưa chốt/không thành → `role:'poster_self', self_comment:true, dropped:true, dropped_at, dropped_by:'lenh31b'` (Loại — sales Khôi phục được; daily_stats hôm đó cộng `dropped` một lần) + tắt thread active + huỷ task funnel queued. DRY trước, `--apply` sau.
- B `--rescore [--limit N] [--apply]`: AI (prompt mới) chấm lại VAI cho comment-lead 30 ngày không phải chủ bài, còn mở, chưa có role → seller/poster_self ⇒ Loại + tắt thread; buyer/other ⇒ chỉ ghi `role`. Cần `.env`.
- `_l31_after.mjs [giờ]`: scanned_posts theo decision, leads mới theo role, outreach_log ⏭ skip, threads skipped_role, số lead role poster_self/seller.

## File
- `lenh-2026-09-05-31b-khoi1.sh` — KHỐI 1 (chạy: `cat > /tmp/l31b.sh <<'L31B' … L31B` rồi `bash /tmp/l31b.sh`): backup `.bak-<TS>`, `_l31_patch.cjs` (= `lenh-2026-09-05-31b-patch.cjs`, content-anchored, fail-closed, idempotent), `node --check` ×3, import test với `.env`, grep marker, deploy `scheduledScan,manualScan,outreachTick` xích `&&`, in revision.
- `lenh-2026-09-05-31b-khoi2-4.sh` — KHỐI 2 (fix DRY) · 2b (`--apply`) · 3 (rescore) · 4 (after).
- `harness-selfcmt-2026-09-05.mjs` — 34/34 trên bản vá (scorer thật dựng lại từ dump + stub index/outreach): normRole, prompt 2 danh tính + cờ, gate, isSelfComment 9 ca, roleBlockOf 7 ca. Dry-run trọn KHỐI 1 với fake firebase/gcloud: exit 0, lần 2 idempotent.
- Quy tắc shell: không `!` ngoài heredoc (đã grep = 0); script Admin SDK trong `~/firebase-s13/functions`.

## Còn làm sau (FE, zip kế)
- Chip "🏪 người bán" / "👤 chủ bài" + hiện `role_reason`; "Bài đã quét" nhãn decision `self_comment`/`seller`; modal comment-lead hiện rõ TÁC GIẢ BÀI GỐC + bài gốc; Content Studio đổi nhãn kiểu bình luận (soft = "Nhẹ + CTA mềm", direct = "Trực tiếp + CTA rõ (mặc định)").
- Danh sách đối thủ theo brand (tên/page) → chặn cứng thêm (nếu anh muốn).

## ★ KHỐI 1 ĐÃ CHẠY OK (05/09 22:12 UTC)
- backup `index.js.bak-20260905-221250` · `lib/scorer.js.bak-20260905-221250` · `outreach.js.bak-20260905-221250`
- `PATCH OK` 3 file · `DONE: 3 file da va` · `SYNTAX OK` · `IMPORT OK · scheduledScan/manualScan/outreachTick/normRole = function`
- marker `v-selfcmt`: index.js 291 (helper) · 454 (ctx.set) · 528 (comment loop) · 540 (selfSkipped) · 550 (Pha 2 skip) · 585 (log) · 643 (gate role) — đủ 7 mốc; scorer.js 45 (normRole) · 157 (chuẩn hoá role); outreach.js 256 (helper) · 299 (gate) — đủ.
- deploy `manualScan` + `outreachTick` + `scheduledScan` Successful → rev `scheduledscan-00069-xop`, `outreachtick-00025-dir`; `exit=0`. Cảnh báo `GOOGLE_CLOUD_QUOTA_PROJECT is not usable` = vô hại (đã thấy các lần deploy trước).
- Kế: KHỐI 2 (`_l31_fix.mjs` DRY → `--apply`), KHỐI 3 tuỳ chọn, KHỐI 4 sau ≥15′.

## ★ KHỐI 2 DRY (05/09 ~22:20 UTC) — khớp #31a
- comment-lead tổng 413 · chủ bài tên khớp chưa gắn role **158** · bỏ qua đã chốt/không thành 0 · đã dropped sẵn 0 → sẽ xử lý 158 (hscl-01 68 · tuyendung1 42 · tts-1 46 · test-agency 2).
- thread ĐANG MỞ sẽ tắt **4**: QDlwWQivXXyRZjZhkCqL · RB5FpYY5jgFqeTQqhnhJ · bDw9U2EgEPgp1fYs9Qw3 · kXXzQYyQSonoXIanY1TQ · task funnel queued 0.
- Mẫu 6 = đúng các ca #31a (Đỗ Minh Hương, Vũ Hồng Đức "Ib tôi", Le Na "Gửi kết bạn nhận Jd"…). → OK để `--apply`.

## ★ KHỐI 2b --apply XONG (05/09 ~22:25 UTC)
- `ĐÃ GHI: 158 lead (role poster_self + dropped) | 4 thread tắt | 0 task huỷ`. 158 lead chủ bài giờ có `role:'poster_self', self_comment:true, dropped:true, dropped_by:'lenh31b'`; 4 thread → `active:false, step:'skipped_role'`.
- Kế: KHỐI 4 (`_l31_after.mjs 3`) sau ≥15′; KHỐI 3 rescore sau khi KHỐI 4 xác nhận prompt mới chạy đúng.
