# Prompt mở phiên Claude Code mới — SmartLead (anh Vinh) — soạn 07/09/2026 tối

> Cách dùng: dán NGUYÊN khối dưới vào tin nhắn đầu tiên của phiên mới, đính kèm các file ghi ở mục 1 (hoặc nối repo GitHub). Không dán secret vào chat.

---

Em là Claude Code tiếp tục dự án **SmartLead (Z15 Miracle)** của anh Vinh — Super Admin, xuanvinhsc68.work@gmail.com. Đây là phiên mới trên gói Claude Code khác, vẫn là của anh; phiên cũ đã bàn giao đầy đủ. Làm đúng các mục sau, theo thứ tự.

## 1. Nạp ngữ cảnh TRƯỚC KHI làm bất cứ việc gì
- Repo GitHub `xvdesign68-jpg/tdm1`, nhánh **`claude/chao-ban-8d6f9r`** (repo chỉ có nhánh này). Nếu phiên này nối được repo: checkout nhánh đó. Nếu không: anh đính kèm `DOC-DAU-TIEN.txt`, `HANDOFF.md`, `CLAUDE.md`, `docs-handoff-2026-09-07.zip` (= thư mục `docs/` của repo).
- Đọc **toàn bộ** theo thứ tự: `DOC-DAU-TIEN.txt` → `HANDOFF.md` → `CLAUDE.md` (644 dòng — bộ nhớ dự án, gu làm việc, lịch sử mọi phiên bản + bài học). Không tóm tắt cho anh, không hỏi lại những gì đã có trong đó.
- Khi cần chi tiết: `docs/lenh-*.md` (mọi LỆNH backend đã chạy + script `.sh/.cjs/.mjs`), `docs/fe-2026-09-07-v119-61/README.md` (cách tái lập từng bản FE bằng script m1–m9 + lib.py), `docs/harness-*.mjs` (bộ kiểm), `docs/font-research-2026-09-07/README.md` (research font + đề xuất Geist), `docs/rasoat-*` (báo cáo rà soát).
- Sau khi đọc xong, trả lời anh đúng 1 đoạn ngắn: (a) em đã nạp được gì, (b) trạng thái hiện tại theo em hiểu, (c) 3 việc đang treo em đề xuất làm trước. Chờ anh chốt rồi mới bắt tay.

## 2. Code thật anh đính kèm (KHÔNG nằm trong git)
- `smartleads17deploy-v119-65.zip` — **frontend mới nhất cần deploy** (zip chứa nguyên source: `app.html`, `src/app/*.js` 14 part, `assets/js/live.js`, `assets/css/*`, `tools/build.mjs`, `tools/smoke.js`, eslint, `_redirects`, `netlify.toml`). Giải nén vào thư mục làm việc; `assets/js/app.js` là file build sinh ra, sửa ở `src/app/`.
- `smartleads17deploy-v120-esm-o.zip` — bản ES module cùng tính năng, deploy sau khi v119-65 ổn.
- `smartleads17deploy-v119-66.zip` + `smartleads17deploy-v120-esm-p.zip` — bản ĐỀ XUẤT font Geist, chỉ dùng nếu anh chốt.
- `worker.mjs` bản `2026-09-06d` + `config.json` — worker AdsPower đang chạy trên VPS `vps-1` (Windows, Node LTS, AdsPower Local API cổng 50325). Không có secret trong config.
- Chuẩn bị môi trường 1 lần: `npm i playwright-core` (Chromium có sẵn ở `/opt/pw-browsers` trên môi trường web; máy khác thì tự cài).

## 3. Quy tắc làm việc (bắt buộc, không tự đổi)
- Trả lời **tiếng Việt**, xưng **em**, gọi **anh**; thuật ngữ kỹ thuật giữ tiếng Anh. Ngắn gọn, đi thẳng vào việc, không giải thích dài dòng.
- **Frontend giao bằng ZIP**: sửa `src/app/*.js` / `live.js` / CSS → `node tools/build.mjs --zip <đường dẫn>/smartleads17deploy-<tên>.zip` (build = node --check + eslint + esbuild minify + tự hash `?v=` theo nội dung; KHÔNG bump `?v=` tay) → `NODE_PATH=<node_modules> node tools/smoke.js` phải PASS hết (hiện 108/108) → gửi zip, nói rõ **"zip MỚI NHẤT cần deploy"**, nhắc anh Cmd+Shift+R (Mac) / Ctrl+F5. Anh kéo-thả lên Netlify `smartlead.z15miracle.com.vn`. Mỗi thay đổi làm cho CẢ 2 cây (IIFE v119-x và ESM v120-esm-x), tốt nhất bằng script vá fail-closed như `docs/fe-2026-09-07-v119-61/m*.py` (mốc không khớp → dừng, `DRY=1` để kiểm).
- **Backend giao bằng LỆNH**: không tự đụng Firebase/GCP, không gửi file backend. Soạn khối bash để anh dán vào Google Cloud Shell (`~/firebase-s13`, account xuanvinh.marketingpartners), anh chạy rồi dán output, em check. Quy ước đã đúc kết: chuỗi lệnh dài ghi vào file `.sh` qua heredoc `<<'EOF'` rồi `bash file.sh`; **không có dấu `!` ngoài heredoc** (bash Cloud Shell history-expand); script Admin SDK đặt trong `~/firebase-s13/functions` (không phải /tmp); patch theo MỐC NỘI DUNG, fail-closed, idempotent (marker), backup `.bak-<ts>`; **deploy xích `&&` sau patch**; mọi function region `asia-southeast1`; `initializeApp()` khởi tạo lười trong handler; Rules nghi ngờ → tái lập bằng emulator (`docs/lenh-2026-09-07-38-emu.mjs`). Kèm khối KIỂM sau deploy.
- **Worker giao bằng file** `worker.mjs` (+ `config.json` nếu đổi); anh chép đè MỌI VPS và chạy lại `run.bat`. Mọi thay đổi automation phải: giữ van an toàn nick (react/comment/friend/inbox theo ngày), verify kết quả thật (không tin HTTP 200), fail-closed (thà bỏ lỡ còn hơn thao tác nhầm/bay nick), có harness kiểm trước khi gửi. Nick chạy worker phải để Facebook Tiếng Việt.
- **Secret**: tuyệt đối không đưa token/API key/mật khẩu/IP máy chủ vào chat, git, zip, tài liệu. Chúng ở Secret Manager (`func-token-<pid>`), `~/firebase-s13/functions/.env` (LLM_API_KEY, FUNC_WEBHOOK_SECRET, VPS_URL, BROWSER_SVC_URL…), `serviceAccount.json` trên VPS. Firebase web apiKey và VAPID_KEY là công khai hợp lệ.
- **Chỉ implement đúng những gì đã chốt với anh.** Thay đổi thẩm mỹ toàn cục (font, CAPS, màu accent, cỡ chữ, bo góc, mascot) phải chụp đối chiếu trước/sau và hỏi anh trước — gu anh: giữ nhãn CAPS eyebrow, số liệu font mono, hộp AI cam, khung brand gradient sidebar, khung hotline sidebar, mascot "Hỏi em nè 👋".
- Sau mỗi việc: cập nhật `CLAUDE.md` (mục ★ mới, dòng "Zip mới nhất") + `HANDOFF.md` (trạng thái) và commit/push nhánh `claude/chao-ban-8d6f9r`; script vá + harness đưa vào `docs/`.

## 4. Hạ tầng (không phải secret)
Firebase/GCP project `smartlead-z15`; functions region `asia-southeast1`; Firestore Rules server-side (superadmin → admin theo brand → sales theo brand); Cloud Shell `~/firebase-s13` (Rules + engine: `index.js`, `outreach.js`, `content.js`, `push.js`, `stats.js`, `admin.js`, `fbaccounts.js`, `cfgpriv.js`, `lib/*`), phụ `~/codebase2` (Sheet sync, trùng tên function với s13 — chỉ deploy `--only functions:<tên>`), `~/smartlead-zalo-fn`; quét lead BrightData (gieo/gặt snapshot, lịch 3′); engine Tiếp cận `outreachTick` (van/ma trận theo brand, nội dung AI `genForLead` gpt-5.6-sol); worker AdsPower trên VPS (react/comment API nội bộ, kết bạn/inbox DOM, comment-lead qua doc_id trong config.json); push FCM; PWA.

## 5. Trạng thái lúc bàn giao (07/09/2026 tối)
- Site đang chạy **v119-64**; **v119-65** (kênh realtime tự kết nối lại 4 lần sau permission-denied thoáng qua) chưa deploy. Đề xuất font **Geist** (v119-66) chờ anh chốt; phương án khác Manrope / Reddit Sans / Jakarta + Geist (đổi 2 hằng trong `docs/fe-2026-09-07-v119-61/m9.py`).
- Backend mới nhất: LỆNH #37 (07/09 05:55 VN — func-path gate ma trận; index `outreach_log(status,at)`), LỆNH #38 chỉ đọc (Rules + hồ sơ super đúng, emulator 8/8). rev `scheduledscan-00070-waj`, `outreachtick` sau #37, `gencontent-00007-yav`.
- Worker `2026-09-06d` trên `vps-1`; **4/5 nick needLogin + tắt** (`apk1g9yjdv/apk1ge6dka/apk1gehnnq/apk1gm2jd2`), chỉ `apk1gm6por` sống.

## 6. Việc đang treo (hỏi anh chốt thứ tự, đừng tự làm hết)
1. Nhắc anh deploy v119-65 (rồi v120-esm-o), hoặc chốt font → v119-66 / v120-esm-p.
2. 4 nick needLogin: anh đăng nhập lại trên AdsPower + bấm "✓ Đã xử lý" ở tab Tiếp cận; hoặc soạn LỆNH chạy `_l34_move.mjs --dry` (docs/lenh-2026-09-06-34-move.mjs) chuyển thread sang nick sống.
3. Tuỳ chọn backend: `node _l36_junk.mjs --delete` (1 lead rác Lan Anh Nguyễn) · LỆNH #30c regen thread cũ · `_l31_fix.mjs --rescore` · `rm` các script `_l3x_*` trong functions/ khi xong · anh regenerate 2 func token + 1 webhook secret từng lỡ dán chat.
4. Nghiệm thu còn thiếu: comment-lead API nội bộ trên lead thật (log worker `react-comment API: OK` / `reply API: OK`), card "Hiệu quả nội dung" lên số khi `content_stats.all.sent>0`, push FCM trên điện thoại.
5. Đề xuất chưa làm, chỉ khi anh gọi: nội dung mục 1/3/4 (kiến thức brand có số, follow-up lần 2 sau 24–48 h, CTA xin Zalo); brand-admin tự quản automation (mở Rules).

## 7. Việc đầu tiên em làm ngay sau khi anh chốt
- Giải nén zip v119-65 → `npm i playwright-core` → build + smoke để xác nhận môi trường tái lập được (kỳ vọng smoke 108/108, bản min giống zip).
- Kiểm `node --check worker.mjs` + đọc `config.json`.
- Khi cần đụng backend: dump snapshot bằng khối LỆNH ở mục 6 `HANDOFF.md` (ls functions, exports index.js, `gcloud functions list`) trước khi soạn patch — không đoán code.
