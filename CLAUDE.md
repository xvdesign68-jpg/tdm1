# CLAUDE.md — Cách làm việc với anh Vinh (SmartLead / Z15 Miracle)

> Bộ nhớ dự án để mọi phiên Claude Code sau tiếp tục đúng "gu" của anh, không mất ngữ cảnh.
> **TUYỆT ĐỐI không đưa secret (mật khẩu, API key, token, IP máy chủ) vào file này, vào git, hay vào zip deploy.**

## Ngôn ngữ & xưng hô
- Luôn trả lời **tiếng Việt**, xưng **"em"**, gọi người dùng là **"anh"** (anh Vinh — Super Admin, xuanvinhsc68.work@gmail.com).
- Thuật ngữ kỹ thuật giữ tiếng Anh.

## Quy trình bàn giao chuẩn (anh thích cách này — giữ nguyên, đừng tự đổi)

### 1. Frontend (SmartLead SPA tĩnh) → GIAO BẰNG ZIP
Anh **không dùng git cho code app**. Anh giữ source gốc, mỗi lần cần sửa sẽ gửi zip; em sửa rồi **trả về một zip mới** để anh **kéo-thả lên Netlify** (site `smartlead.z15miracle.com.vn`).

Các bước em phải làm mỗi lần sửa frontend:
```bash
cd <thư mục smartlead>            # cwd reset giữa các lệnh → luôn cd trước
node --check assets/js/app.js     # và live.js — bắt lỗi cú pháp
npx --yes esbuild assets/js/app.js  --minify --charset=utf8 --outfile=assets/min/js/app.min.js
npx --yes esbuild assets/js/live.js --minify --charset=utf8 --outfile=assets/min/js/live.min.js
npx --yes esbuild assets/css/app.css --minify --charset=utf8 --outfile=assets/min/css/app.min.css   # chỉ khi sửa CSS
cp -f assets/min/js/app.min.js  assets/js/app.min.js     # giữ bản đồng bộ (zip chứa cả 2 vị trí)
cp -f assets/min/js/live.min.js assets/js/live.min.js
# Bump ?v= trong app.html cho ĐÚNG file vừa build (số hiện tại +1):
sed -i 's#app\.min\.js?v=164#app.min.js?v=165#'  app.html
sed -i 's#live\.min\.js?v=47#live.min.js?v=48#'   app.html
# Đóng zip tên MỚI khác biệt (stage qua /tmp, loại *.bak):
rm -rf /tmp/slz && mkdir -p /tmp/slz && cp -r . /tmp/slz/
cd /tmp/slz && zip -qr /tmp/<tên-mới>.zip . -x '*.bak*'
```
- **Verify bản min** bằng string literal tiếng Việt (esbuild đổi tên biến local): `grep 'Mặc định chung' assets/min/js/app.min.js`. Truy cập `window.*` và string literal luôn được giữ nguyên.
- Gửi zip cho anh qua SendUserFile, **nói rõ "zip MỚI NHẤT cần deploy"** (thư mục outputs của anh không xoá được file cũ). Nhắc anh **Cmd+Shift+R** (Mac) / **Ctrl+F5** sau khi deploy.
- Chỉ implement đúng những gì đã **chốt** với anh.

### 2. Backend (Firestore Rules, Cloud Shell, GCP) → GỬI LỆNH ĐỂ ANH TỰ CHẠY
- **Không tự đụng vào backend, không gửi file.** Em **soạn khối LỆNH bash** để anh **copy-dán vào Google Cloud Shell** (`~/firebase-s13`), anh chạy rồi **chụp/dán output** gửi lại → em "check".
- Khi patch text file Rules đã tự chèn block mới: pattern tìm kiếm phải không match nội dung vừa chèn (bài học lỗi LỆNH #2).

## Kiến trúc & version (tham khảo nhanh)
- **Frontend**: HTML/CSS/JS thuần + Firebase Web SDK (ES module qua CDN gstatic). `app.js` là monolith UI/render (~5600 dòng, 1 IIFE); `live.js` lo Firebase auth + Firestore realtime, expose `window.SL_FB`; state chảy `data.js (demo) → let D → live.js buildData → SLApp.reload`.
- **Backend**: Firebase project `smartlead-z15` (Firestore + Auth). Phân quyền THẬT ở **Firestore Rules server-side**. Vai trò: superadmin → admin (theo brand) → sales (theo brand).
- **Bảo mật**: Firebase web apiKey là công khai hợp lệ (KHÔNG phải secret). Mọi secret thật (BrightData/Telegram/OpenAI/VPS) giữ ở backend, không bao giờ vào zip.
- **Version marker nội bộ** trong code (comment `/* v.. */`) và `?v=` trong app.html được đánh số thủ công — dễ quên bump. (Đề xuất tương lai: script build tự hash `?v=`.)

### Lịch sử version (cập nhật mỗi lần build)
| File | v hiện tại |
|---|---|
| app.min.js | **166** |
| live.min.js | **49** |
| app.min.css | 42 |
| pipeline-v2.min.css | 47 |
| tokens.min.css | 17 |
- Zip mới nhất: **v119-15** (tăng tốc F5 + hết lag — gói hiệu năng A+B+C).

## Việc đã fix ở v119-14 (phiên 27/08/2026)
1. **`window.CURRENT_USER`** không bao giờ được gán → thêm `window.CURRENT_USER=CURRENT_USER` trong `SLAuth.show` (app.js). Khôi phục "Lead của tôi", nút xoá ghi chú của chính mình, `first_care_by`.
2. **XSS** SĐT/email/id lead nhét vào chuỗi JS trong `onclick` → thêm hàm `escJsAttr()` (JS-escape rồi HTML-escape) áp cho 6 sink `__slCopy`, + `esc()` cho `showAssignPop` và `barItem`.
3. **Lead "bốc hơi"** (live.js): cửa sổ realtime 500 trượt khi có lead mới → thêm `absorbDropped()` giữ lead rơi khỏi đáy cửa sổ sang `leadsExtra`.

## Việc đã làm ở v119-15 (phiên 27/08/2026 — anh phàn nàn F5 lâu + lag)
- **A1** live.js: bật `initializeFirestore` + `persistentLocalCache` (multi-tab) → F5 chỉ đọc doc THAY ĐỔI thay vì 7–12k doc.
- **A2** live.js: auto-fill 8 lượt gộp về **1 lần rebuild cuối** (cờ `autoFillQuiet`; nút "Tải thêm lead cũ" vẫn rebuild ngay).
- **A3** live.js: `scanned_posts` (3–5k doc) đổi sang `lazyScanned()` — chỉ subscribe khi hash `#scanned` (tab Bài đã quét).
- **B4** app.js: cap feed **200 card** + nút `#feedShowMore` "Hiện thêm 500" (đếm Nóng/Ấm/Lạnh vẫn trên toàn bộ D.leads; đổi filter/query reset về 200).
- **B5** app.js: debounce ô tìm kiếm 180ms.
- **B6** app.js: `notesIdx()` Map leadId→notes (invalidate theo reference+length), `leadNotes()` tra Map + `.slice()`.
- **C** app.html: thêm `defer` cho 8 script classic (giữ nguyên thứ tự; module live.js vốn defer).
- Smoke test Playwright (MODE=demo, headless_shell trong `/opt/pw-browsers`): bơm 450 lead → DOM 200 card + nút hiện thêm đúng, không console error. Cách test: copy thư mục, ghi đè `firebase-config.min.js` = `window.SL_CONFIG={MODE:"demo"}`, serve http.server.

## Việc còn tồn (chờ anh chốt)
- Pipeline view chưa cap card + chưa diff (vẫn đập innerHTML toàn bộ) — làm tương tự feed nếu anh thấy pipeline lag.
- `buildData` chưa memoize theo kênh; `loadNotes` superadmin vẫn đọc toàn bộ notes 1 lượt (getDocs không hưởng cache resume).
- **Kiến trúc**: tách `app.js` thành 4–6 ES module + script build tự hash `?v=`; giữ bộ smoke test Playwright làm nền.
- Backend (khi anh cần): các bug Firestore khác trong báo cáo audit (onSnapshot lỗi chết im, phân trang theo docSnapshot...).
- Chi tiết: báo cáo audit đã gửi anh (57 phát hiện, lọc theo mức độ/nhóm).
