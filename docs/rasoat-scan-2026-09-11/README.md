# Rà soát quét → lọc → chấm điểm → nhận diện lead (11/09/2026) — CHỈ ĐÁNH GIÁ, CHƯA SỬA CODE

Anh yêu cầu: "check kĩ và toàn diện hệ thống lọc, quét, nhận diện lead… có vấn đề gì không hay có đề xuất gì thông minh hơn không". Ultracode bật → chạy Workflow đối kháng.

## File
- `report.html` — báo cáo (artifact claude.ai, sinh bởi `build.py` từ `findings.json`).
- `findings.json` — dữ liệu báo cáo (sinh bởi `assemble.py` từ `workflow-result.json` + `seed-all.json` + `narrative.json` + `draft-pipeline.json`).
- `workflow-result.json` — TOÀN BỘ đầu ra workflow: 48 phát hiện mới (`newFound`), 100 verdict (`allVerified`, có `status/sev/reason/fixNote`), 5 bác (`refuted`), 35 đề xuất (`proposals` đầy đủ why/how/risk), giám khảo (`judged`), critic.
- `seed-all.json` — 52 phát hiện seed (22 backend từ `findings-backend.json` + 30 FE từ `agent-fe.md`).
- `data-so-lieu.md` — số liệu thật + quy tắc anh đã chốt + tính năng đã có/đã bỏ (agent docs).
- `narrative.json` — tóm tắt, bảng điểm, nhóm, tier đề xuất, lộ trình, câu hỏi chốt, LỆNH chỉ đọc, phương pháp (em viết tay).

## Tái lập
```
python3 assemble.py && python3 build.py      # → findings.json + report.html
```
Workflow script: `scratchpad/wf/rasoat-scan-lead.mjs` (ephemeral; 4 finder → verify lô 8 → 3 góc đề xuất → 2 giám khảo → critic; ~25 agent, ~2 h, ~8 M token). Bài học: resume theo cache cần args GIỐNG HỆT (1 dấu chấm khác trong seedIndex → 25 agent chạy lại).

## Kết quả ngắn
- 100 phát hiện thô → **95 giữ (4 Cao · 33 Vừa · 58 Thấp)**, 5 bác (G-2, F-C4, F-D1, F-D6, F-F1), 40 đổi mức.
- 4 Cao: N4-3 (sweeper #46 giấu lead sales đang chăm), F-A2 + N3-12 (bộ lọc toàn cục "ma"), Q-3 (bình luận chỉ lấy 1 lần lúc phát hiện bài).
- 35 đề xuất → 23 canonical; Đợt 1 = LỆNH A (PB-5+PB-3+PB-4+PB-2) · LỆNH B (PB-1) · LỆNH C (PB-10+PB-6+Rules 2 field) · zip FE (PA-4+PC-6).
- 8 câu hỏi chờ anh chốt + 6 LỆNH chỉ đọc (mục cuối báo cáo).
