# Agent FE (chỉ-đọc, cây w89) — phát hiện thô, ĐÃ spot-check các dòng chính (11/09)

## A. Nguồn quét & keyword
- [CAO] 50-config-views.js:127 + live.js:161-167 — `srcOut` trong buildData KHÔNG mang `authAccountId`/`groupId` → form sửa nguồn đọc rỗng → Lưu ghi `authAccountId:''` → nguồn private mất nick quét (hiện 5 nguồn nick đang TẮT nên chưa gây hại).
- [CAO] live.js:170 + 50-config-views.js:176 — `config.keywords/exclude` rỗng → view "Từ khoá" hiển thị GỘP keyword/exclude của mọi nguồn như thể toàn cục; bấm × 1 chip → `persist()` ghi `{keywords: main, exclude: ex}` = tạo bộ lọc toàn cục chưa từng tồn tại, áp lên MỌI nguồn/brand (exclude là cổng thật ở backend → nguy hiểm).
- [VỪA] 50-config-views.js:118 — keyword theo nguồn chỉ tách `,`, không fold dấu, không dedupe (toàn cục có, :187-190).
- [VỪA] 50-config-views.js:159-162 — không kiểm trùng giữa `main` và `exclude`.
- [VỪA] 10-core-overview.js:133-146 — `INDUSTRY_LIB` có keyword 1 từ cực rộng ('chó','mèo','son','váy','tour','visa','crm','content','cua'); exclude rộng ('tuyển','pass','bán').
- [THẤP] 50-config-views.js:488 — "Keyword hiệu quả" khớp `includes` trên chuỗi fold, không biên từ.

## B. Chấm điểm / weights / ngưỡng
- [CAO*] 50-config-views.js:404 ↔ live.js:193 — `weights` FE↔Firestore; backend chỉ dùng làm 1 câu gợi ý (`weightsHint`, scorer.js:124-131) → gần như vô hiệu; không validate tổng=100 (:393/:403); ngưỡng 80/60/40 chuỗi cứng HTML (:337-340).
- [VỪA] 50-config-views.js:400 — slider mutate tại chỗ `D.scoringWeights` (= `DEF_WEIGHTS` chung, live.js:76) → kéo rồi không lưu vẫn bẩn mặc định phiên, không có Đặt lại.
- [VỪA] 50-config-views.js:376 — calibCard khuyên chỉnh trọng số "độ tin cậy nguồn" KHÔNG tồn tại (6 key thật: intent/fit/timing/industry/area/quality).
- [VỪA] 50-config-views.js:371 — calibCard chia dải theo `score` nhưng gọi tên theo `temp`; cột "Loại/không thành" gộp `lost||dropped` (2 tín hiệu ngược nhau: AI/vận hành loại vs sales chăm không thành).
- [VỪA] bindCalib :387 — chỉ vẽ lại, không ghi ngược; cohort = cửa sổ lead đã nạp, không có dòng phạm vi.
- [VỪA] FE tự tính nhiệt độ ở 4 chỗ lệch nhau: live.js:174 (lọc `score>=60` nhưng nhãn theo `temp`), 50-config-views.js:468 (`score>=80?'hot':'warm'` — không có lạnh), 25-agency.js:22 (`agyTempOf` fallback), 65-charts-lead-modal.js:471 (demo).
- [THẤP] 10-core-overview.js:97 — `chip(temp)` không fallback → lead thiếu `temp` render "undefined".

## C. Feed / lead bị AI loại
- [VỪA] 20-feed.js:717 + :485 — `feedHidden` gộp `dropped` (người/AI loại) + `lost` (sales chăm không thành) + `temp==='junk'` vào 1 chip "Rác · Loại" → không phân biệt lead nào do AI loại để phản hồi.
- [VỪA] 30-pipeline.js:298 & :335 — Loại lead KHÔNG ghi lý do (`dropped:true, dropped_at, dropped_by` thôi), trong khi Không thành có `lost_reason` (65:221) → không có dữ liệu hiệu chỉnh AI.
- [VỪA] 70-shell-tools.js:66 — tìm SĐT máy chủ báo "đã nạp" nhưng lead dropped/lost/junk bị feed ẩn ngay → "Không có lead khớp".
- [THẤP] live.js:130 vs 20-feed.js:717 — KPI "Lead hợp lệ" giữ `lost`, feed ẩn `lost` → số KPI luôn > số thẻ.
- [THẤP] 20-feed.js:239-244 — feed không có bộ lọc theo nguồn/brand (chỉ temp + junk).

## D. Bài đã quét
- [VỪA] 60-scan-views.js:159 — `decision` lạ → `DECIS[d]||DECIS.scored_low` hiển thị SAI ("Đã chấm · chưa đạt") thay vì trung tính.
- [VỪA] 60-scan-views.js:452-455 — 4 chip lọc trộn đơn vị (nhóm/item/số bình luận).
- [VỪA] 60-scan-views.js:434 — nhóm vừa có lead vừa có comment bị loại xuất hiện ở cả 2 bộ lọc.
- [VỪA] 60-scan-views.js:272 (+:239,:246) — nối bài ↔ lead bằng TÊN tác giả `find(x=>x.name===p.author)` → trùng tên mở nhầm lead, "Ẩn danh" mất nút. Backend nên ghi `leadId` vào `scanned_posts`.
- [THẤP] 60-scan-views.js:262 — `spHl` replace regex trên chuỗi đã HTML-escape/đã chèn `<mark>` → tín hiệu có `&<"` không khớp, tín hiệu ngắn hỏng markup (không XSS).
- [THẤP] 60-scan-views.js:179-181 + 10-core:260 — brand user đọc lý do loại (keyword/exclude) nhưng không có quyền sửa.
- [THẤP] 60-scan-views.js:171 vs :201 — chữ "tự xoá sau 1 ngày" vs "~3 ngày".

## E. SĐT / Zalo / độ tin cậy
- [VỪA] 20-feed.js:829 — bôi nổi SĐT chỉ khi `normPhoneVN(m)===l.phone` → bài có 2 số hoặc backend sót số thì FE không gợi ý gì.
- [THẤP] 20-feed.js:759 — `normPhoneVN` chỉ di động `^[35789]\d{8}$` (bỏ cố định 02x, số viết chữ/full-width).
- [VỪA] 20-feed.js:765-785 — "Độ tin cậy hồ sơ" thuần heuristic FE; `warn` "chưa để lại SĐT" đúng với đa số → chip gần như luôn "còn điểm cần xác minh", mất giá trị.

## F. Wizard brand
- [VỪA] 87-brand-wizard.js:193 — group đã tồn tại bị bỏ qua im lặng (`.filter(r=>!r.err&&!r.dup)`) → brand mới tưởng có nguồn, nguồn vẫn thuộc brand cũ.
- [THẤP] 87-brand-wizard.js:196 — mọi nguồn nhập hàng loạt cùng `industry` + cùng keyword, không chỉnh per-nguồn.

## Đề xuất FE (agent)
1 Nút "Không phải lead" + lý do (người bán/tuyển dụng/spam/sai ngành/trùng) → `dropped_reason` (S). 2 Panel "Vì sao AI chấm điểm này" (M, cần backend `signals`). 3 Lọc feed theo nguồn/brand/"chỉ lead AI loại" (S). 4 Gom lead trùng người/trùng bài (badge "3 lần xuất hiện") (M). 5 Nhãn "nguồn hiệu quả" trên srcRow (S). 6 Khoá Lưu trọng số khi tổng≠100 + Đặt lại + "engine đọc lần cuối" (S). 7 Tách chip Rác/Đã loại/Không thành + hiện dropped_by/lost_reason (S). 8 calibCard → hành động (M). 9 Preflight keyword (ước % lead khớp) (M). 10 Cảnh báo drift ≥20 % lead 7 ngày `ai_scored:false` (S).

## Không chắc (agent tự khai)
weights backend (đã xác minh: chỉ là câu gợi ý) · ngưỡng 80/60/40 backend (đã xác minh: index.js:6 `tempOf` cùng mốc) · `group_count/touches` backend có ghi thật không (đã xác minh: commitLeadNow ghi khi tạo lead mới, index.js:375-381) · Rules brand user sửa keyword · index composite scanned_posts(brand,createdAt)/leads(brand,phone,detected_at) (leads đã có #2).
