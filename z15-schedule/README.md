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
| Hôm nay | `#/dashboard` | Ca của tôi + Check-in, dòng thời gian trong ngày, việc cần duyệt (duyệt/từ chối tại chỗ), sắp tới, deadline 7 ngày, KPI tuần, ai đang ở đâu, nhịp đội, có gì vui |
| Lịch | `#/calendar/{day\|week\|month}/{yyyy-mm-dd}` | Lịch ngày/tuần/tháng, kéo-thả dời sự kiện, kéo vùng trống để tạo, vạch "bây giờ", lọc theo của tôi / team / loại |
| Bảng ca | `#/roster/{yyyy-mm-dd}?range=7\|14` | Ma trận nhân sự × ngày, đổi ca bằng click/phím tắt/tô màu/kéo-thả, độ phủ theo ngày, gợi ý lấp ca, công bố lịch, hoàn tác |
| Đội ngũ | `#/staff?view=grid\|table\|pulse` | Danh bạ dạng thẻ/bảng, tìm không dấu, "ai đang rảnh", bản đồ nhiệt tải công việc 14 ngày |
| Dự án | `#/projects`, `#/projects/{id}` | Thẻ chiến dịch với pha & tiến độ, trang chi tiết: tổng quan, mốc & Gantt, phân bổ giờ, ghi chú & checklist |
| Yêu cầu | `#/requests?tab=pending\|mine\|all\|history` | Nghỉ phép / remote / tăng ca / đổi ca, duyệt hàng loạt có hoàn tác, số ngày phép còn lại, ai nghỉ 14 ngày tới |

Xuyên suốt: tìm nhanh `Ctrl/⌘ K`, hộp thoại dùng chung (sự kiện, yêu cầu, hồ sơ nhân sự, dự án), thông báo, giao diện sáng/tối, phím tắt (`?` để xem), giảm chuyển động, in ấn.

## Phím tắt chính

`g d` Hôm nay · `g c` Lịch · `g r` Bảng ca · `g s` Đội ngũ · `g p` Dự án · `g q` Yêu cầu · `n` tạo sự kiện · `⇧R` gửi yêu cầu · `t` hôm nay · `j/k` tuần trước/sau · `1/2/3` ngày/tuần/tháng · `m` chỉ của tôi · `e/x` duyệt/từ chối · `⇧D` đổi giao diện · `[` thu gọn menu

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
│  ├─ data.js            dữ liệu mẫu (22 nhân sự, 7 team, 8 dự án, ~150 sự kiện, ca, yêu cầu)
│  ├─ store.js           state + localStorage + pub/sub + nghiệp vụ
│  ├─ ui.js              primitives dùng chung
│  ├─ editors.js         hộp thoại dùng chung
│  ├─ app.js             router, shell, theme, phím tắt, command palette
│  └─ views/*.js         6 màn hình
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
