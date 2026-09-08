# Rà soát số liệu toàn web SmartLead — 08/09/2026

Anh yêu cầu (08/09): *"anh muốn em check kĩ toàn diện xem số liệu thông tin ở các bảng/khung tương tự ở tất cả các mục tại web xem có chuẩn chính xác chưa"* (sau khi phát hiện ô "Bài đã quét" của user brand trống).

## Kết quả
- **Báo cáo giao anh**: artifact https://claude.ai/code/artifact/7b577cf3-49ab-4664-adeb-469f9902fac0 — bản HTML lưu kèm `doi-soat-so-lieu.html`.
- **85 phát hiện** từ 3 agent chỉ-đọc (mỗi agent 1 cụm mục, đọc code cây v119-77) → em kiểm chứng từng mục trên code rồi phân loại:
  - **46 đã vá trong FE `v119-79` / `v120-esm-ac`** (`docs/fe-2026-09-07-v119-61/m21.py`, 59/63 mốc, fail-closed) — smoke **114/114** cả 2 cây + harness `harness-builddata.mjs` 8/8.
  - **5 cần backend** → gộp vào **LỆNH #39** (`docs/lenh-2026-09-08-39.md`, chờ anh chạy) hoặc ghi rõ trong báo cáo.
  - **12 mục anh giao em tự chốt (08/09 tối) → đã làm ở v119-80 / v120-esm-ad** (`docs/fe-2026-09-07-v119-61/m22.py`, smoke 116/116; quyết định từng mục ở cột "Em chốt · đã làm" của báo cáo HTML). 3 mục backend còn lại gộp vào **LỆNH #40** (`docs/lenh-2026-09-08-40.md`).
  - **22 đã kiểm, không cần sửa** (agent báo nhưng code đúng / by-design).
- Cách tính đã thống nhất từ v119-79: **mọi KPI/tỷ lệ tính trên lead HỢP LỆ = không `junk`, không `dropped`** (`act` trong `buildData`); tỷ lệ chia 0 → `null` → UI "—" thay vì 0%; rail/badge Lead mới đếm đúng số thẻ đang hiện (bỏ lead đã Loại/Không thành/rác); ngày theo giờ VN (outreach_stats tự đổi ngày lúc 0h VN); ROI cohort bỏ dropped/lost, mẫu = lead 30 ngày; Hộp việc/Phản hồi khách không đếm lead đã xử lý.

## File
| File | Nội dung |
|---|---|
| `doi-soat-so-lieu.html` | Báo cáo (bản artifact) |
| `agent1-overview-feed.md` | Agent 1: Overview · live.js buildData · Lead feed · rail · Hôm nay · badge |
| `agent2-pipeline-roi-modal-scan.md` | Agent 2: Pipeline · ROI · modal lead · Hộp việc · Lịch sử quét · Bài đã quét |
| `agent3-reports-agency-outreach-users.md` | Agent 3: Báo cáo · Bảng brand · Tiếp cận · Người dùng |
| `harness-builddata.mjs` | Harness `buildData` (vm, stub SDK) — chạy: `node harness-builddata.mjs <đường dẫn live.js>` |

Phát hiện của agent là **đầu vào thô** (có mục sai/đã bị bác); phân loại cuối cùng nằm trong báo cáo HTML + mục v119-79 ở `docs/fe-2026-09-07-v119-61/README.md`.
