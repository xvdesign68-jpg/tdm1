# CLAUDE.md — Cách làm việc với anh Vinh (SmartLead / Z15 Miracle)

> Bộ nhớ dự án để mọi phiên Claude Code sau tiếp tục đúng "gu" của anh, không mất ngữ cảnh.
> **TUYỆT ĐỐI không đưa secret (mật khẩu, API key, token, IP máy chủ) vào file này, vào git, hay vào zip deploy.**

## Ngôn ngữ & xưng hô
- Luôn trả lời **tiếng Việt**, xưng **"em"**, gọi người dùng là **"anh"** (anh Vinh — Super Admin, xuanvinhsc68.work@gmail.com).
- Thuật ngữ kỹ thuật giữ tiếng Anh.

## Quy trình bàn giao chuẩn (anh thích cách này — giữ nguyên, đừng tự đổi)

### 1. Frontend (SmartLead SPA tĩnh) → GIAO BẰNG ZIP
Anh **không dùng git cho code app**. Anh giữ source gốc, mỗi lần cần sửa sẽ gửi zip; em sửa rồi **trả về một zip mới** để anh **kéo-thả lên Netlify** (site `smartlead.z15miracle.com.vn`).

Các bước em phải làm mỗi lần sửa frontend (TỪ v119-16 dùng script, không còn bump ?v= tay):
```bash
cd <thư mục smartlead>
node tools/build.mjs --zip /tmp/smartleads17deploy-<tên-mới>.zip
# = node --check + esbuild minify TOÀN BỘ js/css + cp bản đồng bộ + TỰ HASH ?v= theo nội dung file
#   (không còn lớp lỗi "quên bump + cache immutable 1 năm") + đóng zip loại *.bak*/node_modules/.git
# Smoke test trước khi gửi zip (cần npm i playwright-core 1 lần, Chromium ở /opt/pw-browsers):
NODE_PATH=<nơi có node_modules> node tools/smoke.js   # PASS hết mới gửi
```
- **Verify bản min** bằng string literal tiếng Việt (esbuild đổi tên biến local): `grep 'Mặc định chung' assets/min/js/app.min.js`. Truy cập `window.*` và string literal luôn được giữ nguyên.
- Zip vẫn chứa source (quy trình khứ hồi của anh) nhưng `_redirects` đã CHẶN truy cập công khai `/assets/js/*`, `/assets/css/*`, `/tools/*` (404!).
- Gửi zip cho anh qua SendUserFile, **nói rõ "zip MỚI NHẤT cần deploy"** (thư mục outputs của anh không xoá được file cũ). Nhắc anh **Cmd+Shift+R** (Mac) / **Ctrl+F5** sau khi deploy.
- Chỉ implement đúng những gì đã **chốt** với anh.

### 2. Backend (Firestore Rules, Cloud Shell, GCP) → GỬI LỆNH ĐỂ ANH TỰ CHẠY
- **Không tự đụng vào backend, không gửi file.** Em **soạn khối LỆNH bash** để anh **copy-dán vào Google Cloud Shell** (`~/firebase-s13`), anh chạy rồi **chụp/dán output** gửi lại → em "check".
- Khi patch text file Rules đã tự chèn block mới: pattern tìm kiếm phải không match nội dung vừa chèn (bài học lỗi LỆNH #2).

## Kiến trúc & version (tham khảo nhanh)
- **Frontend**: HTML/CSS/JS thuần + Firebase Web SDK (ES module qua CDN gstatic). `app.js` là monolith UI/render (~5600 dòng, 1 IIFE); `live.js` lo Firebase auth + Firestore realtime, expose `window.SL_FB`; state chảy `data.js (demo) → let D → live.js buildData → SLApp.reload`.
- **Backend**: Firebase project `smartlead-z15` (Firestore + Auth). Phân quyền THẬT ở **Firestore Rules server-side**. Vai trò: superadmin → admin (theo brand) → sales (theo brand).
- **Bảo mật**: Firebase web apiKey là công khai hợp lệ (KHÔNG phải secret). Mọi secret thật (BrightData/Telegram/OpenAI/VPS) giữ ở backend, không bao giờ vào zip.
- **Version marker nội bộ** trong code (comment `/* v.. */`) chỉ là changelog; `?v=` do `tools/build.mjs` tự hash — đừng sửa tay.

### Version
- Từ **v119-16**: `?v=` là **hash 10 ký tự theo nội dung file** do `tools/build.mjs` tự sinh — KHÔNG còn số đếm tay (số v164/v47... cũ đã đóng băng; marker `/* v167 */` trong code chỉ còn là changelog).
- Zip mới nhất: **v119-16** (trọn gói 5 nhóm fix + bộ build/test tự động).

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

## Việc đã làm ở v119-16 (phiên 27/08/2026 — "xử lý hết 5 nhóm")
- **Pipeline dữ liệu THẬT**: bỏ bảng demo `pvExt`; `pvOf()` tính tuổi/kẹt từ `stage_at` (ghi mới mỗi lần kéo thẻ, fallback `first_care_at`/`detected_at`); "Hẹn hôm nay" từ `fu_at`; đổi nhãn "Gợi ý từ AI" → "Việc cần chú ý"; cap 50 thẻ/cột + nút hiện thêm (`pvColMore`).
- **Nút Loại thật**: `dropped:true` ghi Firestore (optimistic + revert khi lỗi); pipeline lọc `!l.dropped` (lead vẫn còn trong kho/feed).
- **Regex "tỷ"**: `\b` → lookahead `(?![A-Za-zÀ-ỹ0-9])` (nhánh 'tỷ' trước đây KHÔNG BAO GIỜ khớp).
- **snapErr()** live.js: listener lỗi terminal (permission-denied/failed-precondition) bắn `sl-fb-down` → banner, hết "chết im"; `rebuild()` bọc try/catch cũng bắn banner.
- **Feed search bỏ dấu**: dùng `fold()` + cache `l.__q` trên object lead.
- **Vá nhỏ**: parseTS chặn Invalid Date; fuChip dùng giờ máy (đồng bộ bộ đếm "hôm nay"); bd_month tự đổi doc khi sang tháng (check 30'); spread `{...d.data(), id:d.id}` (doc id thắng field trùng tên) toàn bộ live.js; điều kiện nick đồng bộ `getActiveNicks()`; privacy/terms tokens v17; xoá `api-live.js` + 3 ảnh không dùng; `_redirects` chặn source; CSP thêm `frame-ancestors 'self'`.
- **Notes realtime**: `loadNotes()` → `onSnapshot` (hưởng cache resume + ghi chú đồng nghiệp tự hiện; `reloadNotes()` thành no-op khi đã subscribe, cờ `notesSubbed` reset trong stopData).
- **buildData memoize**: `buildScansMemo`/`buildScannedMemo` theo reference mảng — lead mới không kéo theo sort lại 1000 scan + 5000 scanned.
- **tools/**: `build.mjs` (build 1 lệnh + hash ?v= + zip) + `smoke.js` (7 check tự động, PASS hết mới gửi zip). Drift-check khi chuyển: mọi min build lại từ source giống hệt byte.

## Backend: bản đồ 3 codebase + kết quả audit 27/08/2026 (ĐÃ ĐÓNG)
- **3 codebase cùng deploy lên project `smartlead-z15`** (Cloud Shell, account xuanvinh.marketingpartners):
  - `~/firebase-s13` — CHÍNH: Firestore Rules + functions lõi (manualScan, assistant*, brightdataUsage, gcpUsage, approveEngagement bản mới, scheduledScan, cleanup...).
  - `~/codebase2` — Sheet sync + auto-send FB (syncLeadToSheet, syncDraftToSheet, backfillSheet, triggerAutoSend, autoSendEngine, generateDrafts). Mỗi function 1 thư mục con.
  - `~/smartlead-zalo-fn` — cụm Zalo (bootstrapZaloTokens, sendZaloZBS, refreshZaloToken, notifyBrandZalo).
- ⚠ **Trùng tên giữa s13 và codebase2** (`manualScan`, `approveEngagement`, `syncLeadToSheet` có ở CẢ 2 — bản codebase2 là snapshot CŨ, guard yếu hơn). Deploy sau đè deploy trước → khi deploy từ codebase2 CHỈ deploy đúng function Sheet (`--only functions:tên`), không deploy trùm. Nghi ngờ thì so `updateTime` (gcloud functions describe).
- **Kết quả audit** (đã kiểm tận code qua LỆNH #1–#7):
  - Rules `users/{uid}`: guard field-level `diff().affectedKeys().hasAny(['role','active','brand','leadFrom','leadTo','leadFromAt','leadToAt'])` — user thường KHÔNG tự sửa được quyền. Create ép pending+inactive. Delete chỉ superadmin. → lỗ "leo thang quyền qua setMyProfile" trong audit = ĐÓNG.
  - 10/10 function HTTPS/callable có auth: verifyIdToken + role check (401/403) hoặc `isAdmin(request.auth)` (callable). `backfillSheet` khoá theo đúng email Super Admin. `manualScan` đang chạy là bản s13 mới (22/08), 2 lớp X-API-Token/verifyCaller.
  - ⚠ Ghi nhớ: `backfillDrafts` trong codebase2 (CHƯA deploy) có guard lỏng `if(!ok && (API_TOKEN||Authorization))` — env không set API_TOKEN + không gửi header là LỌT. Nếu sau này deploy PHẢI sửa thành `if(!ok) return 401` trước.
  - `backfillSheet` = công cụ đổ bù lead CŨ vào Google Sheet (chạy tay khi mới nối/đổi Sheet) — giữ lại, đã khoá.

## Việc còn tồn (chờ anh chốt)
- **Tách `app.js` thành 4–6 ES module** + tách `boot()` live.js — refactor lớn, làm ZIP RIÊNG sau khi v119-16 chạy ổn ở production (kèm eslint khi đó mới có giá trị).
- Pipeline chưa diff theo lead.id như feed (đã cap 50/cột nên nhẹ; diff làm cùng đợt tách module).
- `buildData` whitelist → pass-through (bug "field rơi khỏi rebuild" từng dính 2 lần) — làm cùng đợt tách module.
- `assigned_at`/giờ ghi chú vẫn dùng đồng hồ máy client (đổi sang serverTimestamp cần migrate dữ liệu ms cũ — lợi nhỏ, để sau).
- Ngoài code: research Zalo cá nhân (yêu cầu 26/08); xoay key OpenAI; xoá lead rác "Lan Anh Nguyễn".
- Chi tiết: báo cáo audit đã gửi anh (57 phát hiện, lọc theo mức độ/nhóm).
