# Z15 Miracle · Lịch làm việc

Web quản lý lịch làm việc, phân ca, dự án và yêu cầu nghỉ phép cho đội ngũ **Z15 Miracle Việt Nam**.
Thuần HTML/CSS/JavaScript, không cần cài đặt hay build — mở `index.html` là chạy (kể cả từ ổ đĩa), dữ liệu lưu cục bộ trên trình duyệt.

## Chạy thử

- Mở trực tiếp `z15-schedule/index.html` bằng Chrome/Edge/Safari/Firefox, **hoặc**
- Chạy một static server bất kỳ, ví dụ `npx serve z15-schedule`, **hoặc**
- Đóng gói thành một file duy nhất để gửi qua Zalo/Drive: `node tools/build-single.js` → `dist/z15-lich-lam-viec.html`.

Dữ liệu mẫu được sinh quanh **ngày hiện tại** nên demo luôn "sống". Mọi thay đổi (sự kiện, ca, yêu cầu, cài đặt) được lưu vào `localStorage`. Muốn về dữ liệu mẫu: menu tài khoản → **Cài đặt** → **Đặt lại**.

## Các màn hình

| Mục | Đường dẫn | Có gì |
|---|---|---|
| Hôm nay | `#/dashboard` | Ca của tôi + Check-in, dòng thời gian trong ngày, **lời mời chờ bạn phản hồi** (RSVP), việc cần duyệt (duyệt/từ chối tại chỗ), **sắp diễn ra · cần nhắc** (nhắc người chưa xác nhận, checklist chuẩn bị), sắp tới, deadline 7 ngày, KPI tuần, ai đang ở đâu, nhịp đội, có gì vui; thẻ sức khoẻ lịch khi xem với tư cách CEO/trợ lý |
| Lịch | `#/calendar/{day\|week\|month\|team}/{yyyy-mm-dd}` | Lịch ngày/tuần/tháng + chế độ **Đội ngũ** (người × giờ), **lớp lịch** bật/tắt (công ty, ban điều hành, team, dự án, cá nhân), **so sánh lịch** nhiều người với khung giờ rảnh chung, kéo-thả dời/đổi người, kéo vùng trống để tạo, vạch "bây giờ", bảng xung đột |
| Điều phối | `#/assistant?staff=&date=` | Trợ lý lịch cho CEO/quản lý: điểm sức khoẻ lịch, danh sách "cần xử lý" với thao tác một chạm (dời khỏi trùng lịch, chèn đệm, chặn giờ di chuyển/chuẩn bị, nhắc xác nhận, uỷ quyền, yêu cầu agenda), brief ngày (sao chép/gửi), tìm giờ họp chung, bảo vệ thời gian tập trung, cơ cấu tuần |
| Bảng ca | `#/roster/{yyyy-mm-dd}?range=7\|14` | Ma trận nhân sự × ngày, đổi ca bằng click/phím tắt/tô màu/kéo-thả, độ phủ theo ngày, gợi ý lấp ca, công bố lịch, hoàn tác |
| Đội ngũ | `#/staff?view=grid\|table\|pulse` | Danh bạ dạng thẻ/bảng, tìm không dấu, "ai đang rảnh", bản đồ nhiệt tải công việc 14 ngày |
| Dự án | `#/projects`, `#/projects/{id}` | Thẻ chiến dịch với pha & tiến độ, trang chi tiết: tổng quan, mốc & Gantt, phân bổ giờ, ghi chú & checklist |
| Yêu cầu | `#/requests?tab=pending\|mine\|all\|history` | Nghỉ phép / remote / tăng ca / đổi ca, duyệt hàng loạt có hoàn tác, số ngày phép còn lại, ai nghỉ 14 ngày tới |

Xuyên suốt: tìm nhanh `Ctrl/⌘ K`, hộp thoại dùng chung (sự kiện với RSVP · checklist chuẩn bị · nhắc · uỷ quyền, yêu cầu, hồ sơ nhân sự, dự án), thẻ xem nhanh khi rê chuột lên sự kiện, **nhắc trước giờ họp** (toast + thông báo trình duyệt, cấu hình trong Cài đặt) và dòng "tiếp theo" trên thanh đầu trang, thông báo, giao diện sáng/tối, phím tắt (`?` để xem), giảm chuyển động, in ấn.

### Vai trò demo

Menu tài khoản → **Xem với tư cách**: *Nguyễn Minh Anh* (Account Director), *Lê Ngọc Ánh* (Trợ lý CEO — mặc định điều phối lịch cho CEO), *Trần Hoàng Việt* (CEO). Sự kiện **riêng tư** chỉ hiện chi tiết với người tham gia và ban điều hành; người khác thấy "Bận (riêng tư)".

### Mô hình lịch (v1.1)

Mỗi sự kiện thuộc một **lớp lịch** (`company` · `exec` · `team:<id>` · `project:<id>` · `personal:<staffId>`), có **mức ưu tiên** P1/P2/P3 (bắt buộc / quan trọng / có thể uỷ quyền), **vai trò** người tham gia (chủ trì / bắt buộc / tuỳ chọn), **RSVP**, **checklist chuẩn bị**, **nhắc trước** (1 ngày / 1 giờ / 15 phút), **phút di chuyển** cho họp ngoài văn phòng, và các loại đặc biệt *Tập trung* (khối làm việc sâu) và *Di chuyển*. Store tính sẵn: xung đột, tải ngày (họp sát nhau, thiếu giờ di chuyển, khoảng trống), sức khoẻ lịch tuần (điểm 0–100), khung giờ rảnh chung, gợi ý khối tập trung, danh sách vấn đề cần xử lý.

Cơ sở thiết kế: nghiên cứu HBR *How CEOs Manage Time* (Porter & Nohria — lịch CEO phân mảnh, phần lớn thời gian là họp; cần họp ngắn, ít người, có agenda và thời gian một mình), thực hành của trợ lý điều hành (đệm 5–15' giữa các cuộc họp, 15–30' chuẩn bị trước họp quan trọng, chặn giờ di chuyển, brief tối hôm trước, mã màu theo loại lịch) và nghiên cứu focus time (chỉ ~27% giờ làm là khối liên tục ≥2h; giữ 1 khối 2h/ngày giúp làm việc phức tạp nhanh hơn đáng kể).

## Phím tắt chính

`g d` Hôm nay · `g c` Lịch · `g e` Điều phối · `g r` Bảng ca · `g s` Đội ngũ · `g p` Dự án · `g q` Yêu cầu · `n` tạo sự kiện · `⇧R` gửi yêu cầu · `t` hôm nay · `j/k` tuần trước/sau · `1/2/3/4` ngày/tuần/tháng/đội ngũ · `m` chỉ của tôi · `e/x` duyệt/từ chối · `⇧D` đổi giao diện · `[` thu gọn menu

## Cấu trúc

```
z15-schedule/
├─ index.html            khung ứng dụng
├─ assets/logo-mark.svg  logo (thay bằng file gốc của công ty nếu có)
├─ css/
│  ├─ tokens.css         design tokens (màu, chữ, khoảng cách, chuyển động, sáng/tối)
│  ├─ base.css           reset, tiện ích, keyframes, in ấn
│  ├─ components.css     nút, chip, avatar, thẻ, form, bảng, modal, drawer, popover, toast, palette…
│  ├─ shell.css          sidebar, topbar, splash, responsive
│  └─ views/*.css        style riêng từng màn hình
├─ js/
│  ├─ utils.js           ngày giờ, chuỗi tiếng Việt, DOM, animation helpers
│  ├─ data.js            dữ liệu mẫu (24 nhân sự gồm CEO & trợ lý, 8 team, 8 dự án, ~240 sự kiện có lớp lịch/ưu tiên/RSVP, ca, yêu cầu)
│  ├─ store.js           state + localStorage + pub/sub + nghiệp vụ
│  ├─ ui.js              primitives dùng chung
│  ├─ editors.js         hộp thoại dùng chung
│  ├─ app.js             router, shell, theme, phím tắt, command palette
│  └─ views/*.js         7 màn hình
└─ tools/build-single.js đóng gói 1 file
```

## Ngôn ngữ thiết kế

- Nền giấy ấm trung tính, đường kẻ mảnh, không đổ bóng lên thẻ tĩnh.
- **Xanh thương hiệu** = "của tôi / hành động / hôm nay"; **đỏ thương hiệu** chỉ dành cho "bây giờ / khẩn / xung đột". Gradient xanh→đỏ chỉ xuất hiện ở hairline của thẻ hero và chấm "đang trực".
- Chữ: Be Vietnam Pro (giao diện) + JetBrains Mono (giờ, ngày, số liệu).
- Chuyển động chỉ dùng transform/opacity, tôn trọng `prefers-reduced-motion` và cài đặt "Giảm chuyển động".

## Tuỳ biến nhanh

- Đổi màu thương hiệu: `css/tokens.css` (`--blue-*`, `--red-*`).
- Thêm/sửa nhân sự, team, dự án: `js/data.js` rồi **Đặt lại dữ liệu mẫu**.
- Giờ làm việc hiển thị trên lịch: `Z15.config.workStart / workEnd` trong `js/data.js`.
