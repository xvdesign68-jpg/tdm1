# Research font cho SmartLead (07/09/2026) — đề xuất **Geist**

Anh hỏi: font hệ thống ban đầu (SF Pro trên Mac / Segoe UI trên Windows) thấy "oke" hơn cặp Plus Jakarta Sans + Be Vietnam Pro (v119-64) — "research kĩ và đề xuất font đẹp, phù hợp nhất".

## Cách làm (đo được, không đoán)
1. `vi-support.txt` — hỏi Google Fonts CSS API ~70 họ, chỉ giữ họ có khối `/* vietnamese */` (đủ dấu, có hook/tone stack): 53 họ đạt; loại Sora, DM Sans, Figtree, Poppins, Outfit, Lato, Rubik, Urbanist… (không có subset tiếng Việt).
2. Tải woff2 subset vietnamese+latin+latin-ext 400/500/600/700 của 22 họ ứng viên vào `fp/` (không commit, tải lại bằng CSS API) → `measure.js` đo trong Chromium thật: độ rộng đoạn tiếng Việt 14px so với Inter, x-height, cap-height, có chữ số bảng (tnum) không, độ rộng chữ số, dung lượng thật trình duyệt tiếng Việt tải (`realsize.json`).
3. `specimen.js` — ô mẫu giống SmartLead (KPI, thẻ lead, bảng, menu) cho 24 cặp → `grid1.png` (+grid2/3 tái lập được). `diacritics.js` — dấu tiếng Việt cỡ 30px 400/700.
4. `uishot.js` — render CHÍNH app (cây v119-65, demo) với 6 cặp: Inter · Geist · Jakarta+Inter · Manrope · Jakarta+Be Vietnam Pro (hiện tại) · Reddit Sans, chụp Bảng điều khiển / Lead mới / Bảng brand / Pipeline / modal 1440 + Lead mới/Bảng điều khiển 390. `compose.js` ghép ảnh so sánh (`so-sanh-tong-quan.png`).

## Số đo (14px, so với Inter; KB = vietnamese+latin 4 weight)
| Font | Rộng vs Inter | x-height | tnum | Chữ số (px) | KB |
|---|---|---|---|---|---|
| Source Sans 3 | -13.9% | 0.49 | ✓ | 6.96 | 153 |
| Inter Tight | -10.0% | 0.54 | ✓ | 8.41 | 216 |
| Reddit Sans | -7.1% | 0.53 | ✓ | 8.52 | 208 |
| Roboto Flex | -6.9% | 0.52 | ✓ | 7.9 | 172 |
| Commissioner | -6.9% | 0.5 | ✗ | 8.5 | 185 |
| Hanken Grotesk | -6.4% | 0.5 | ✓ | 7.84 | 172 |
| Manrope | -6.3% | 0.55 | ✓ | 8.68 | 129 |
| IBM Plex Sans | -6.0% | 0.52 | ✓ | 8.4 | 195 |
| Nunito Sans | -5.6% | 0.5 | ✓ | 8.4 | 161 |
| Geist | -4.7% | 0.53 | ✓ | 8.4 | 146 |
| Public Sans | -4.1% | 0.52 | ✓ | 9.8 | 134 |
| Wix Madefor Text | -3.4% | 0.5 | ✗ | 8.54 | 109 |
| Bricolage Grotesque | -3.3% | 0.52 | ✓ | 8.43 | 195 |
| Plus Jakarta Sans | -3.1% | 0.54 | ✓ | 8.4 | 139 |
| Mulish | -2.8% | 0.51 | ✓ | 8.4 | 155 |
| Onest | -2.0% | 0.52 | ✓ | 9.41 | 181 |
| Space Grotesk | -0.7% | 0.49 | ✓ | 8.68 | 114 |
| Geologica | -0.4% | 0.5 | ✓ | 9.07 | 130 |
| Inter | +0.0% | 0.54 | ✓ | 9.08 | 229 |
| Lexend | +1.3% | 0.53 | ✗ | 8.11 | 208 |
| Be Vietnam Pro | +1.5% | 0.53 | ✗ | 8.88 | 71 |
| Work Sans | +2.3% | 0.5 | ✓ | 8.46 | 243 |

## Kết luận
- **Be Vietnam Pro (thân chữ hiện tại) KHÔNG có chữ số bảng** (tnum ✗) → số trong KPI/bảng không thẳng cột; rộng hơn Inter 1,5% và ≈6–7% so với nhóm gọn → "Nóng chưa ai chăm" gãy 2 dòng trong ô Hôm nay, thanh đầu trang Lead mới + ô Tìm brand/Thêm brand gãy 2 hàng ở 1440, thẻ lead mobile dài hơn. Đây là lý do anh thấy font hệ thống "oke" hơn: SF Pro gọn và trung tính.
- **Inter** (bản mở gần SF Pro nhất) lại là font RỘNG nhất nhóm chung kết (chữ số 9,08px) → cũng gãy dòng ở 1440 và bộ lọc feed mobile xuống 2 hàng; nặng nhất (229 KB).
- **Geist** (đề xuất): gọn hơn Inter 4,7% ≈ độ rộng SF Pro, x-height 0,53, tnum ✓, 146 KB, dấu tiếng Việt đúng vị trí ở cả 400/700, nét đủ dày cho ClearType Windows, 1 họ dùng cho cả tiêu đề · nút · nhãn · thân chữ (không cần cặp), có sẵn 100–900 trên Google Fonts. Render thật: mọi ô 1 dòng, thanh đầu trang 1 hàng, mobile không gãy bộ lọc.
- **Manrope** (phương án 2): gọn hơn 6,3%, tnum ✓, 129 KB, cảm giác geometric/startup; nét 400 mảnh hơn → trên Windows hơi nhạt.
- **Reddit Sans** (phương án 3): gọn nhất (−7,1%), ấm, dễ đọc; nặng 208 KB, ít quen mắt.
- Nếu anh muốn giữ tiêu đề Plus Jakarta Sans: cặp Jakarta + Geist (body) cũng ổn — vẫn có tnum, gọn hơn cặp hiện tại.

## Áp dụng
`docs/fe-2026-09-07-v119-61/m9.py <cây>` (áp lên v119-65 / v120-esm-o): đổi link Google Fonts (app/privacy/terms) → `Geist:wght@400;500;600;700;800 + JetBrains Mono`, `tokens.css --font` và `--font-head` = Geist. Zip `v119-66` / `v120-esm-p`, smoke 108/108 cả 2 cây. Google Fonts trả 5 khối vietnamese cho Geist (kiểm bằng curl).
