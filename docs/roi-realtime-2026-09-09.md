# Kiểm tra realtime trang "Giá trị & ROI" (Super Admin) — 09/09/2026

Anh hỏi: "các chỉ số này có được update real-time không". Em đọc code (40-roi.js, live.js, 90-boot) rồi đo thật bằng
harness `docs/harness-roi-realtime-2026-09-09.mjs` (app thật MODE firebase + SDK Firebase giả, bắn snapshot mới rồi
đo mili-giây tới khi DOM đổi).

Chạy lại: `NODE_PATH=<nơi có playwright-core> node docs/harness-roi-realtime-2026-09-09.mjs <cây source đã build>`
(Chromium ở /opt/pw-browsers; ~45 s vì có bước chờ 15,5 s).

## Kết quả đo (cây v119-85)

| Kịch bản | Nguồn dữ liệu | Kết quả |
|---|---|---|
| T1 thêm 2 lead nóng | `leads` onSnapshot | ĐỔI sau ~270 ms (Lead đang xử lý, pipeline, tiết kiệm, CPL, dự báo, dòng brand, dòng tổng) |
| T2 chốt 1 deal 30 tr | `leads` | ĐỔI sau ~275 ms (Đã chốt 30 ngày 0 → 1, doanh thu) |
| T3 đổi phí gói mặc định (`config/app.roi`) | `config` onSnapshot | ĐỔI sau ~270 ms (phí gói, tiết kiệm mọi brand chưa có tham số riêng) |
| T4 tắt nguồn quét của 1 brand | `sources` onSnapshot | ĐỔI sau ~270 ms ("3 brand đang hoạt động" → 2, phí gói tổng bớt brand đó) |
| T5 đổi THAM SỐ RIÊNG 1 brand (`brands/{code}.roi`) từ nơi khác | `brands` = getDocs (`refreshAdmin`, throttle 15 s) | KHÔNG đổi trong 2,5 s dù có snapshot lead; chỉ đổi sau ≥15 s **và** phải có 1 tín hiệu vẽ lại khác (lead/scan…) |
| T6 đang gõ ô tham số trong trang + có lead mới | `deferReload` (90-boot) | HOÃN tới khi rời ô (blur) → ĐỔI sau ~750 ms |

Không lỗi JS. Độ trễ ~270 ms = debounce `rebuild` 250 ms (cố ý, gộp đợt snapshot).

## Kết luận
- **Realtime thật**: mọi số suy từ lead (Lead đang xử lý, nóng+ấm/30 ngày, giá trị pipeline, tiết kiệm, CPL, dự báo chốt,
  đã chốt 30 ngày, thời gian chốt TB, bảng từng brand, dòng tổng), tham số mặc định hệ thống + benchmark (`config/app`),
  brand đang hoạt động theo nguồn quét (`sources`).
- **KHÔNG realtime**: danh sách brand, cờ `active` và **tham số ROI riêng từng brand** (`brands` collection) — chỉ đọc lại
  qua `refreshAdmin` (getDocs, throttle 15 s, gọi khi vẽ lại view). Anh sửa trên chính tab đang mở thì thấy ngay (ghi cục bộ);
  sửa ở tab/máy khác thì tab này chỉ thấy sau ≥15 s **và** khi có tín hiệu vẽ lại khác (đêm vắng lead → phải đổi mục/F5).
- **Phạm vi số**: tính trên lead đã tải về trình duyệt (super: 500 mới nhất + tự nạp thêm tới 4.000). Caption
  "trong N lead gần nhất đã tải" nói đúng; kho hiện ~2.000 lead nên đang phủ đủ; vượt 4.000 lead thì ô Lead đang xử lý sẽ thiếu lead cũ.
- **Đang gõ vào ô tham số** trong trang thì mọi cập nhật bị hoãn tới khi rời ô (cố ý, tránh mất chữ đang gõ).

## Hướng sửa (chờ anh chốt, chưa làm)
1. Super subscribe `brands` bằng onSnapshot (collection nhỏ, ≤ vài chục doc) thay getDocs → tham số riêng/cờ active
   realtime như các kênh khác; `refreshAdmin` chỉ còn users/fb_accounts/brand_sales.
2. Hoặc nhẹ hơn: mở trang ROI/Bảng brand → `refreshAdmin(true)` (bỏ throttle 1 lần) để số brand luôn mới khi vào trang.

## ĐÃ LÀM hướng 1 (09/09 chiều) — v119-86 / v120-esm-aj (`docs/fe-2026-09-07-v119-61/m28.py`)
Super Admin đăng ký `brands` bằng onSnapshot; `refreshAdmin` không đọc brands nữa; lần vẽ đầu chờ mềm kênh brands. Harness (cây đã build):

| Kịch bản | v119-85 | v119-86 |
|---|---|---|
| T5a đổi tham số riêng brand | không đổi trong 2,5 s; chỉ sau ≥15 s + tín hiệu khác | ĐỔI sau 265 ms |
| T5c tắt brand (`active:false`) | như trên | ĐỔI sau 265 ms, "1 brand đang hoạt động" |
| T5d thêm brand mới có tham số riêng | như trên | ĐỔI sau 269 ms, có dòng brand mới |
| T5e snapshot y hệt bắn lại | — | 0 mutation (chữ ký quản trị) |
| refreshAdmin getDocs(brands) | 1 lần/lượt | 0 |
| Vẽ lần đầu (boot-timeline normal) | 1.274 ms | 1.262 ms |

KỲ VỌNG v119-86: PASS 12/12 (IIFE + ESM). Kiểm âm: harness trên bản min v119-85 FAIL 4/12 đúng các mục T5.
Không đổi: đang gõ ô tham số → hoãn tới blur (cố ý); số tính trên lead đã tải (≤4.000).
