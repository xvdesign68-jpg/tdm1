# Rà soát UI SmartLead (07/09/2026, trên cây v119-60) — CHỈ ĐÁNH GIÁ, chưa sửa code

- Báo cáo (HTML có ảnh nhúng, 2,6 MB): `rasoat-ui.html` — bản artifact: https://claude.ai/code/artifact/7290cf99-af95-42fd-b0c6-3949797e1d98
- Dữ liệu gốc: `findings.py` (14 phát hiện A–N + điểm 18 mục + câu hỏi chốt), `css_agent.py` (số liệu design-system), `copy_agent.py` (số liệu chữ nghĩa + TOP 15 + 10 quy ước viết), `build.py` (dựng HTML từ 3 file trên + `imgs.json`).
- Cách chụp lại: `shots.js` (Playwright, demo mode, 18 mục + modal + mobile), `tojpg.js` (PNG → JPEG data URI). Chạy trong thư mục source SmartLead với `OUT=<dir> NODE_PATH=<node_modules> node shots.js`.
- Kết luận: 5 phát hiện Cao (lớp nổi che nội dung · 302 emoji làm icon · chữ kỹ thuật lọt UI · trang/tính năng giả · Bảng điều khiển mở bằng widget quản trị), 6 Vừa, 3 Thấp; lộ trình 3 đợt (~5 + 5 + 3 ngày công FE); 5 câu hỏi chờ anh chốt (mascot/hotline · emoji · trang Tích hợp · tên mục · thứ tự Bảng điều khiển).
