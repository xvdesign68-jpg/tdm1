# Rà "đủ thông minh cho mọi ngành nghề?" — cổng vai + chấm điểm v2 + bộ nhớ người viết (13/09/2026)

Anh hỏi: khách SmartLead đến từ rất nhiều ngành, có cả bên kinh doanh DỊCH VỤ — hệ thống đã "thông minh" đủ chưa?
Em kiểm trên **mã đang chạy (bản dựng lại sau LỆNH G)**: `lib/scorer.js` (`normRole` 46 · `ROLE_RULES_E` 283 · `sysE` 285 · `preSysE` 310 · `heuristic` 175), `index.js` (cổng `__resBlockE/__roleBlock` 886–892 · sweeper 1002–1011 · bộ nhớ G 202–223 · gate `seller_known` 716). Chỉ đánh giá, CHƯA sửa code.

## Kết luận ngắn
Cơ chế chung (vai buyer/seller/proxy/poster_self, Hồ sơ AI theo brand, 6 tiêu chí, bộ nhớ người viết) đúng hướng và chạy ổn với 4 brand hiện có.
Nhưng **3 quy tắc đang ghi CỨNG theo góc nhìn "brand bán HÀNG cho người tiêu dùng"**, sẽ bỏ lỡ hoặc loại nhầm khách của các ngành khác:

| # | Mức | Ca sai | Đã kiểm ở đâu |
|---|---|---|---|
| 1 | **CAO** | "Tuyển người" = seller trong MỌI brand → brand phục vụ NGƯỜI TUYỂN (cung ứng lao động, headhunt, giúp việc/gia sư theo giờ, đồng phục, phần mềm HR, PG sự kiện) mất đúng khách mục tiêu: "cần tuyển 2 giúp việc theo giờ", "tuyển gia sư cho con", "tuyển 5 PG cho sự kiện" → seller → không lead | `ROLE_RULES_E` ("TUYỂN NGƯỜI cho chính họ" = seller) · `sysE` "Loại: tuyển dụng" · `preSysE` "maybe=false nếu tuyển dụng" (chặn ngay tầng 1) · `normRole` `/recruit\|tuyen/` → seller · `heuristic` bad "tuyển" −40 |
| 2 | **CAO** | "Cửa hàng, quán NHẬP HÀNG" = reseller → khách B2B mua để DÙNG (nhà hàng nhập 30 kg tôm mỗi tuần, quán cà phê nhập cà phê, công ty mua 200 bộ bàn ghế, spa mua thiết bị) bị coi là "đại lý/mua sỉ"; brand chưa bật `banSi` (hscl-01 hiện ĐANG tắt) → `decision reseller` → không lead; bật `banSi` thì vào lead nhưng mang chip "Đại lý / mua sỉ" sai bản chất | `ROLE_RULES_E` "reseller = mua để BÁN LẠI / đại lý / nhập sỉ / cửa hàng, quán nhập hàng" · `normRole` "chủ quán nhập hàng" → reseller (em chạy thử) · cổng `__resBlockE` index 886 |
| 3 | **CAO** | Bộ nhớ G đếm `sellerHits` cho MỌI người "đang chào bán gì đó", toàn cục, không phân biệt ĐỐI THỦ cùng ngành ↔ người bán thứ khác: chủ nhà hàng bình luận quảng cáo quán 2 lần → `seller_known` → 30 ngày sau bài "cần nhập mực khô" bị bỏ TRƯỚC AI; chủ shop mỹ phẩm đăng bán 2 lần → brand agency/vận chuyển/bao bì (khách mục tiêu chính là chủ shop) mất bài "cần tìm bên chạy ads" của người đó; nhà tuyển dụng = seller ở brand tuyendung1 → đồng thời bị chặn ở brand đồng phục | `memNoteG` `seller: __role === 'seller'` (index 892, 1011) · `sellerKnownOfG` không có brand (209) · gate 716 áp cho mọi brand · `buyerHits===0` chỉ cứu khi người đó ĐÃ từng thành lead trước |
| 4 | Vừa | Hồ sơ AI không có **khu vực phục vụ** và **đối tượng KHÔNG phục vụ** → tiêu chí `area` luôn 2 (AI được dặn "không rõ khu vực → 2"), trọng số area 8 % vô nghĩa với dịch vụ tại chỗ (spa, sửa chữa, vận chuyển, cho thuê); brand chỉ bán B2B / chỉ 1 tỉnh không nói được với AI | `brandProfileE` chỉ nganh/dichvu/khach/giong/banSi · `sysE` dòng criteria |
| 5 | Vừa | `banSi` nhãn/prompt chỉ nói "bán sỉ / đại lý / nhập hàng bán lại" → brand DỊCH VỤ muốn nhận CTV / đối tác / nhượng quyền / affiliate ("mình muốn làm CTV spa", "tìm đối tác mở chi nhánh") → AI trả reseller hoặc other; không tick → loại; tick → chip "Đại lý / mua sỉ" lệch nghĩa | `sysE` dòng banSi · FE nhãn v119-91 |
| 6 | Vừa | Trọng số 6 tiêu chí là **toàn cục** (`config/app.weights`): ngành dịch vụ tại chỗ cần area/timing cao, ngành bán hàng online cần fit/intent — 1 bộ số cho mọi brand | `weightsE` đọc config/app |
| 7 | Thấp | `normRole` map chuỗi mô tả: "doanh nghiệp cần tuyển giúp việc" → proxy (vì `giup`), "cộng tác viên"/"đối tác nhượng quyền"/"ứng viên tìm việc" → other, "người bán hàng khác ngành" → seller (đối thủ). AI thường trả đúng enum nên ít gặp; chỉ lộ khi AI trả câu mô tả | em chạy thử 13 chuỗi |
| 8 | Thấp | Heuristic dự phòng (chỉ khi AI hỏng/hết lượt, kẹp ≤59) vẫn dùng từ khoá agency: bad "tuyển/khoá học/sinh viên" −40, buy "tìm agency/cần chạy" +45 → brand giúp việc/gia sư/giáo dục bị điểm tạm thấp hơn thật (chỉ ảnh hưởng điểm tạm, sweeper chấm lại sau) | `heuristic` 175 |

Đã kiểm thấy ỔN (không cần sửa): proxy (đăng hộ) = lead + cho kết bạn/inbox · người bán bình luận dưới bài người mua = seller (đối thủ) · chủ bài tự bình luận = poster_self · bài gốc người bán + bình luận hỏi giá = buyer (nguồn lead từ bài đối thủ) · brand chưa Hồ sơ AI → prompt SME trung tính "mọi nhu cầu mua thật = lead" · role rỗng/other mà `is_real_lead` vẫn giữ lead (không mất) · `force` (Quét lại) bỏ qua bộ nhớ · super có nút "Không phải người bán" để gỡ · sweeper không loại lead sales đang chăm.

Số hiện tại: 24 h qua `decision reseller` = 0, `seller_known` = 0 → chưa mất lead thật, nhưng 3 ca CAO là đường code chắc chắn xảy ra khi có brand dịch vụ / B2B / nhà hàng (và ca 2 xảy ra NGAY với hscl-01 khi nhà hàng đăng nhập hàng, vì `banSi` chưa bật).

## Đề xuất LỆNH H "vai theo từng brand" (backend 2 file + zip FE nhỏ)
1. **Vai tương đối theo Hồ sơ AI, hết ghi cứng** (`ROLE_RULES_E`, `sysE`, `preSysE`, `normRole`, `heuristic`):
   - "Tuyển người / cần người làm X" = **buyer** nếu brand cung cấp nhân lực/dịch vụ X (đọc `khach`/`dichvu`); = seller chỉ khi brand phục vụ ỨNG VIÊN hoặc không liên quan. Tầng 1 không còn `maybe=false` vì "tuyển dụng" chung chung.
   - reseller = mua để **BÁN LẠI NGUYÊN TRẠNG** (đại lý, sỉ, nhập về bán). Mua số lượng lớn để **DÙNG / chế biến / vận hành / trang bị** (nhà hàng, quán, công ty, spa) = **buyer** (có thêm cờ `b2b:true` → chip "Khách doanh nghiệp", không chặn).
   - AI trả thêm `seller_kind`: `competitor` (cùng ngành brand) · `other_seller` (bán thứ khác) · `recruiter`. Cổng vai vẫn loại cả 3 (không phải lead), nhưng chỉ `competitor` mới nuôi bộ nhớ G.
2. **Bộ nhớ G theo brand + chỉ đối thủ**: `author_memory.brands.<brand>.sellerHits/sellerIds/lastSellerAt`; `seller_known` xét trên brand đang chấm (≥2 bài competitor, 0 lead ở brand đó, 30 ngày). Người bán thứ khác / nhà tuyển dụng không bao giờ bị chặn trước AI. Doc cũ: `sellerHits` toàn cục chỉ còn để hiển thị, không gate; script di trú không cần (30 ngày tự hết hạn) — hoặc `_lh_reset.mjs` xoá `sellerHits` cũ để sạch ngay.
3. **Hồ sơ AI thêm 3 ô** (`brands.ai`): `khuVuc` (khu vực phục vụ, ví dụ "HCM + Bình Dương, ship toàn quốc") → tiêu chí `area` chấm thật; `khongPhucVu` (đối tượng KHÔNG phục vụ: "không bán lẻ", "không nhận CTV", "không làm ngoài HN") → AI loại đúng ý brand; `doiTac` (tick "Nhận CTV / đại lý / đối tác / nhượng quyền", thay/mở rộng `banSi`, nhãn theo loại hình). Wizard + thư viện ngành điền sẵn.
4. **Trọng số theo brand (tuỳ chọn)**: `brands.ai.weights` override `config/app.weights`, thư viện ngành có bộ gợi ý (dịch vụ tại chỗ: area 20 · timing 20; bán online: fit 30 · intent 35). Web card "Chấm điểm v2" chọn "Theo ngành / tuỳ chỉnh".
5. Nhỏ: `normRole` bỏ nhánh `giup|gium` → proxy khi chuỗi có "tuyển/cần"; thêm map `cong.?tac|ctv|doi.?tac|nhuong.?quyen|affiliate` → reseller-kiểu-đối-tác; heuristic bỏ hẳn từ khoá agency khi brand có Hồ sơ AI.

Kiểm: harness kịch bản 8 ngành (hải sản/nhà hàng B2B · giúp việc theo giờ · headhunt · đồng phục · spa nhận CTV · agency marketing với chủ shop · trung tâm tiếng Anh · cho thuê xe) chạy trọn `scanAll` + bộ nhớ G; `_promptcmp` lại 40 bài; chạy bóng scoreV2 không đổi lịch (14 ngày).
Không đụng worker/outreach; FE zip nhỏ (3 ô Hồ sơ AI + chip "Khách doanh nghiệp" + nhãn đối tác). Rules: `brands` super ghi sẵn có, không cần sửa.

## Chờ anh chốt
(a) Làm LỆNH H ngay (trước #34 PC-7) hay xếp sau? (b) Mục 3 dùng 3 ô mới hay gộp vào ô `khach` (rẻ hơn nhưng AI đọc kém chắc)? (c) Mục 4 trọng số theo brand làm luôn hay để Đợt 3? (d) Việc ngay hôm nay: bật `banSi` hscl-01 để nhà hàng/quán nhập hàng không bị loại trong lúc chờ LỆNH H.
