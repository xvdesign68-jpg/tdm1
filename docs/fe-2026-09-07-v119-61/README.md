# FE v119-61 / v120-esm-k — đợt sửa UI "hết mùi vibe code" (07/09/2026)

Áp trên cây **v119-60** (IIFE). Cây **v120-esm-k** = cùng thay đổi, sinh từ cây IIFE đã vá bằng converter `docs/esm-convert-2026-09-05.mjs` + `tools/build.mjs`/`eslint.config.mjs` của bản v120-esm.

## Tái lập (từ zip v119-60 đã giải nén, có node_modules)
```bash
W=<thư mục v119-60>; S=docs/fe-2026-09-07-v119-61
python3 $S/m1.py $W                              # M1 cấu trúc: menu 4 nhóm + tên Việt, gỡ Tích hợp/hotline/khối demo, dashboard sắp lại + dải trạng thái
python3 $S/m2.py $W                              # M2 chữ nghĩa: errMsg(), hộp thoại app (slConfirm/slPrompt), bỏ chữ kỹ thuật, xưng hô, ALL-CAPS, tên mục
cp $S/dash.mjs $W/tools/_dash.mjs && (cd $W && node tools/_dash.mjs $W $(ls src/app/*.js) assets/js/live.js && rm tools/_dash.mjs)   # " - " → " – " trong string/template (espree)
sed -i 's|Z15 Miracle - Dashboard|Z15 Miracle – Dashboard|' $W/app.html
python3 $S/caps.py $W                            # bỏ text-transform:uppercase ở nhãn nhỏ (trừ .side-group)
python3 $S/m3pre.py $W                           # M3 vá tay: icon mới, Hộp việc/timeline/nhãn nick, bỏ U+FE0F
cp $S/m3.mjs $W/tools/_m3.mjs && (cd $W && node tools/_m3.mjs $W $(ls src/app/*.js) && rm tools/_m3.mjs tools/_m3.log)   # emoji → SLI.<icon> theo token
python3 $S/m4.py $W                              # M4 bố cục: menu ⋯, bóng cuộn bảng, khoá Super Admin, KPI mobile, hộp AI, pipeline
python3 $S/m5.py $W                              # M5 design-system: :root duy nhất, bỏ Google Fonts, thang chữ/bo góc/z-index/breakpoint, dọn CSS chết, CSS hộp thoại
cd $W && node tools/build.mjs --zip /tmp/smartleads17deploy-v119-61.zip && NODE_PATH=$PWD/node_modules node tools/smoke.js
```
Mỗi script fail-closed (mốc không thấy = dừng, không ghi dở); `DRY=1 python3 mX.py $W` để kiểm mốc trước. `v119-60-to-v119-61.patch` = diff toàn bộ (tham khảo, không gồm assets/min).

## Cây ESM
```bash
E=<bản sao cây IIFE đã vá>; cp <v120-esm-j>/tools/build.mjs $E/tools/; cp <v120-esm-j>/eslint.config.mjs $E/; rm -f $E/src/app/_wrapper.json $E/tools/gen-globals.mjs $E/tools/.globals.json
cp docs/esm-convert-2026-09-05.mjs $E/tools/_esm.mjs && (cd $E && node tools/_esm.mjs $E && rm tools/_esm.mjs) && cd $E && node tools/build.mjs --zip /tmp/smartleads17deploy-v120-esm-k.zip
```
Kết quả 07/09: smoke **108/108** cả 2 cây · harness boot stub OK · eslint 0 lỗi (ESM 6 warning biến cục bộ không dùng).

## v119-62 / v120-esm-l (07/09 chiều, sau khi anh xem v119-61 "xấu hơn")
Đối chiếu ảnh v119-60 ↔ v119-61 cho thấy phần **đợt 2 design-system** làm mất "chất" cũ: bỏ nhãn CAPS (eyebrow/tiêu đề bảng/rail), số liệu bỏ font mono, hộp AI cam → xanh, khung brand sidebar mất viền gradient anh đã chỉnh v129–v131, cỡ chữ .5px làm chữ to hơn gãy dòng, bo góc/breakpoint đổi. **v119-62 = v119-61 trừ các thay đổi thuần thẩm mỹ đó** (giữ cấu trúc menu, chữ nghĩa, icon SVG, menu ⋯, bóng cuộn, hộp thoại app, token :root duy nhất, bỏ Google Fonts, CSS chết).
```bash
W=<v119-60>; S=docs/fe-2026-09-07-v119-61
python3 $S/m1b.py $W          # = m1 nhưng tiêu đề nhóm menu giữ class mono
python3 $S/m2.py $W
cp $S/dash.mjs $W/tools/_dash.mjs && (cd $W && node tools/_dash.mjs $W $(ls src/app/*.js) assets/js/live.js && rm tools/_dash.mjs)
sed -i 's|Z15 Miracle - Dashboard|Z15 Miracle – Dashboard|' $W/app.html
# KHÔNG chạy caps.py
python3 $S/m3pre.py $W
cp $S/m3.mjs $W/tools/_m3.mjs && (cd $W && node tools/_m3.mjs $W $(ls src/app/*.js) && rm tools/_m3.mjs tools/_m3.log)
python3 $S/m4b.py $W          # = m4 trừ đổi màu hộp AI / khối brand / .mono; + icon phương thức quét to có màu
python3 $S/m5b.py $W          # = m5 trừ cỡ chữ .5px / bo góc / breakpoint / orb tĩnh / đổi giá trị radius token
python3 $S/m3css.py $W        # CSS icon (v119-61 từng chèn tay) + 3 sửa smoke
cd $W && node tools/build.mjs --zip /tmp/smartleads17deploy-v119-62.zip && NODE_PATH=$PWD/node_modules node tools/smoke.js
```
Cây ESM `v120-esm-l`: như mục "Cây ESM" ở trên. Kết quả: smoke 108/108 cả 2 cây.

## v119-63 / v120-esm-m (07/09 chiều, anh: "để lại khung hotline và đổi lại font chữ sao cho thật đẹp")
`python3 $S/m6.py $W <thư mục v119-60>` sau các bước của v119-62: (1) trả lại **khung hotline sidebar** nguyên bản (HTML + CSS lấy từ v119-60; hotline nổi mobile vẫn bỏ vì che nội dung); (2) **bộ font Z15 CRM thật sự được áp**: `--font-head` Plus Jakarta Sans (tiêu đề, số KPI), `--font` Inter (chữ), `--font-mono` JetBrains Mono (mã/số liệu) – nạp Google Fonts `display=swap`, Inter bật `cv11` + `ss03`. Trước đây app.css đè `--font` bằng font hệ thống nên Google Fonts tải mà không dùng. Xem thử: tải woff2 về `assets/fp/` (chỉ để chụp, không vào zip).

## v119-64 / v120-esm-n (07/09 chiều, anh gửi ảnh cặp font: Plus Jakarta Sans — tiêu đề, nút, nhãn · Be Vietnam Pro — thân chữ)
`python3 $S/m7.py <cây>` sau m6 — áp được cho CẢ cây IIFE (v119-63) lẫn cây ESM (v120-esm-m), không cần thư mục base:
(1) Google Fonts link → `Plus+Jakarta+Sans:500;600;700;800` + `Be+Vietnam+Pro:400;500;600;700` + `JetBrains+Mono:400;500;600`, `display=swap`;
(2) tokens.css: `--font` = Be Vietnam Pro (fallback Plus Jakarta Sans), `--font-head` = Plus Jakarta Sans (fallback Be Vietnam Pro); bỏ `font-feature-settings: "cv11","ss03"` (riêng Inter); `.btn` + `.chip/.badge` thêm `font-family: var(--font-head)`;
(3) app.css: 11 rule nhãn/nút đang ghi rõ `var(--font)` → `var(--font-head)` + khối cuối gom nhãn/nút còn inherit (`.nav-item, .side-nav .nav-item, .seg button, .bt-item, .form-row label, .kpi .lbl, th bảng, eyebrow…`) — LƯU Ý `.side-nav .nav-item { font-family: inherit }` specificity (0,2,0) đè rule `.nav-item` (0,1,0) nên phải liệt kê rõ;
(4) `src/app/80-rbac-auth.js` màn đăng nhập `#authGate` bỏ font hệ thống ghi cứng → `var(--font)` / `var(--font-head)` (nút `.ag-btn` = Jakarta).
Ô nhập/select/textarea giữ thân chữ; số liệu `.mono`/eyebrow mono giữ JetBrains Mono.
```bash
W=<v119-63 hoặc v120-esm-m>; S=docs/fe-2026-09-07-v119-61
python3 $S/m7.py $W && cd $W && node tools/build.mjs --zip /tmp/smartleads17deploy-v119-64.zip && NODE_PATH=$PWD/node_modules node tools/smoke.js
```
Kết quả: smoke **108/108** cả 2 cây; kiểm `document.fonts`: 33 face nạp (Be Vietnam Pro 400–700, Jakarta 500–700, JetBrains 400/600), body = Be Vietnam Pro, h1/nút/menu/chip = Plus Jakarta Sans; 11 ảnh desktop 1440 + mobile 390 dấu tiếng Việt đủ. Xem thử cục bộ: tải woff2 về `assets/fp/` với URL tuyệt đối `/assets/fp/fN.woff2` (chỉ để chụp, không vào zip).

## v119-65 / v120-esm-o (07/09 tối, sau LỆNH #38: banner "leads cũ / outreach_log permission-denied" trên tài khoản super)
`python3 $S/m8.py <cây>` sau m7 (áp cho cả 2 cây; live.js 2 cây giống nhau). live.js: `snapErr` thử đăng ký lại **4 lần có giãn cách 10s/30s/90s/240s** (trước: đúng 1 lần sau 10s rồi treo banner); lượt đếm THEO KÊNH, nhiều kênh lỗi cùng lúc gộp 1 lần đăng ký lại; banner trong lúc thử = "gián đoạn … đang tự kết nối lại (lần n/4)" (`detail.soft`), hết lượt mới "lỗi permission-denied … báo quản trị viên"; `chanOkAt[name]` = mốc OK gần nhất → kênh khoẻ ≥5′ rồi lỗi = đợt mới (lượt về 0), còn cache trả OK rồi máy chủ từ chối ngay thì KHÔNG reset (kênh hỏng thật dừng sau 4 lượt, không lặp vô hạn); đổi người dùng → xoá lượt + huỷ timer; console ghi `uid… · role · lần n`; `onAuthChanged`: super theo email mà `users/{uid}` thiếu/`role` ≠ superadmin → banner "Hồ sơ Super Admin trên máy chủ chưa đúng (…, uid …)" + console.error. 90-boot `showFbDown`: hậu tố theo `d.soft`. Harness `docs/harness-chanretry-2026-09-07.mjs <live.js>` **19/19** (trích đúng khối từ live.js đã vá; Date/setTimeout giả). Smoke 108/108 cả 2 cây.
```bash
W=<v119-64 hoặc v120-esm-n>; S=docs/fe-2026-09-07-v119-61
python3 $S/m8.py $W && cd $W && node tools/build.mjs --zip /tmp/smartleads17deploy-v119-65.zip && NODE_PATH=$PWD/node_modules node tools/smoke.js && node <repo>/docs/harness-chanretry-2026-09-07.mjs assets/js/live.js
```


## v119-66 / v120-esm-p (07/09 trưa, ĐỀ XUẤT font Geist — chờ anh chốt)
Anh hỏi font hệ thống ban đầu là gì mà "oke" hơn, rồi "research kĩ và đề xuất font đẹp, phù hợp nhất". Research đo được ở `docs/font-research-2026-09-07/README.md`. Kết quả: Be Vietnam Pro không có chữ số bảng + rộng → gãy dòng; Geist gọn như SF Pro, tnum, dấu Việt chuẩn, 146 KB.
```
cp -a w62 w66 && python3 m9.py w66      # cây IIFE v119-65 → v119-66
cp -a w62e w66e && python3 m9.py w66e   # cây ESM v120-esm-o → v120-esm-p
cd w66  && node tools/build.mjs --zip smartleads17deploy-v119-66.zip   && node tools/smoke.js
cd w66e && node tools/build.mjs --zip smartleads17deploy-v120-esm-p.zip && node tools/smoke.js
```
`m9.py` fail-closed 7 mốc: link Google Fonts ở `app.html`/`privacy.html`/`terms.html`, `tokens.css --font`/`--font-head`/comment, comment `app.css`. Muốn đổi sang Manrope/Reddit Sans: sửa 2 hằng `LINK_NEW` + tên họ trong m9.py.

## v119-67 / v120-esm-q (08/09 rạng sáng, ANH CHỐT sau khi so 9 phương án trên trang xem thử)
Anh chốt: menu giữ Plus Jakarta Sans nhưng **in đậm**; nội dung chính đổi sang **TikTok Sans** (Google Fonts, variable opsz 12..36 · wght 300..900, có subset tiếng Việt, mở nguồn 7/2025), to/đậm hơn một chút; số trong nội dung dùng chữ số TikTok Sans (có tabular). Thay đổi thật: `.nav-item` 500→600, `.nav-item.active` 650→700; `tokens.css` `--font` = TikTok Sans (fallback Jakarta), `--font-head` = Jakarta (fallback TikTok Sans), body `font-weight:450` (cỡ nền GIỮ 14px vì app.css cũng đặt 14px); `.lead-card .txt` và `.ld-post .tx` 14→15px; link Google Fonts 3 trang = Jakarta 500–800 + TikTok Sans + JetBrains Mono.
```
python3 m10.py <cây>   # áp được lên v119-65 / v120-esm-o (Jakarta + Be Vietnam Pro) HOẶC v119-66 / v120-esm-p (Geist) — 18 mốc, fail-closed NGUYÊN TỬ (lib.py ghi 2 pha từ 08/09: mốc nào lỗi → không ghi file nào), DRY=1 kiểm
cd w67  && node tools/build.mjs --zip smartleads17deploy-v119-67.zip   && NODE_PATH=$PWD/node_modules node tools/smoke.js   # 108/108
cd w67e && node tools/build.mjs --zip smartleads17deploy-v120-esm-q.zip && NODE_PATH=$PWD/node_modules node tools/smoke.js  # 108/108
```
Đo trước khi chốt (trang xem thử Lead mới, cùng dữ liệu, 9 chip: Geist · Jakarta+Geist · Hiện tại · Hiện tại+số Jakarta · Font hệ thống · Inter · Manrope · TikTok Sans · Kiểu Facebook): TikTok Sans gọn hơn Be Vietnam Pro 2,6%, chữ số bảng ✓ (Be Vietnam Pro ✗), dấu tiếng Việt ở 14px gần bằng Be Vietnam Pro (hơn hẳn Geist/Inter), 122 KB/3 file so với cặp cũ 155 KB/15 file. Sau vá: chiều cao 18 mục ở 1440 giảm hoặc giữ nguyên (feed +27px do bài đăng 15px), không mục nào thêm phần tử tràn ngang; Users 1440 hết 19 phần tử lòi.
**Rà đối kháng (Workflow 3 agent review + 5 agent phản biện, 27′)**: 16 phát hiện → 3 xác nhận đã sửa trong m10.py: (1) ô nhập/chọn/textarea/nút rơi về weight 400 (UA stylesheet) cạnh thân chữ 450 → `tokens.css` `input, select, textarea, button { font-weight: inherit }`; (2) khối "AI đọc vị nhu cầu" (`.lead-card .intent-note`, pipeline-v2.css) vốn đặt = cỡ `.txt` từ v46 → theo lên 15px; (3) `lib.py` ghi từng file ngay khi mốc khớp → chạy thật mà mốc sau lỗi thì file trước đã ghi dở → đổi sang ghi 2 pha trong `done()`. 2 bị bác (tên lead 14.5 < bài 15px là ý thích, không lỗi; gãy dòng modal 390 là trùng hợp 1 mẫu demo). 3 mục low đáng làm cũng đưa vào m10: `.bt-item.active` 700 (tab dưới mobile đậm như sidebar), `.ld-parent` 12.5→13.5px (bài gốc trong modal comment-lead), `.tbl td` `tabular-nums`. Tái lập zip byte-identical ✓ · zip sạch (không node_modules/.bak/.git, không secret) ✓ · link Google Fonts TikTok Sans đúng chuẩn css2 (curl 200, fvar khớp) ✓ · menu đậm ở mọi breakpoint kể cả drawer mobile ✓.

### v119-68 / v120-esm-r (08/09 sáng, anh: "cái 15px em cho thành 14,5px xem")
`m10.py` thêm tham số môi trường `TXT_PX` (mặc định **14.5px**) cho 3 khối đọc chính (`.lead-card .txt`, `.ld-post .tx`, `.lead-card .intent-note`); `TXT_PX=15px python3 m10.py <cây>` tái lập v119-67. Cùng lệnh build/smoke như trên, zip `smartleads17deploy-v119-68.zip` / `smartleads17deploy-v120-esm-r.zip`, smoke 108/108 cả 2 cây.

## v119-69 / v120-esm-s (08/09 sáng, anh: "mới vào/F5 load lâu, nội dung mất 1–2 giây mới hiện đúng realtime — fix triệt để")
**Chẩn đoán bằng harness dòng thời gian** (`docs/harness-boot-timeline-2026-09-08.mjs`: chạy app thật MODE firebase với SDK Firebase GIẢ có độ trễ như thật — auth 200 ms · getDoc 150 ms · snapshot cache 80–150 ms rồi server 450–700 ms · getDocs admin 400 ms; ghi mỗi 50 ms màn chờ/cổng auth/KPI/số thẻ). Bản v119-68: 0–465 ms màn chờ + cổng; **465 ms cổng mở → vẽ DỮ LIỆU DEMO (18.432 bài · 1.284 lead) và chạy hiệu ứng đếm số**; 1.055 ms màn chờ tắt (hẹn cứng 600 ms) → người dùng thấy số demo đang đếm; **1.450 ms số thật mới thay vào**. Gốc: (1) `90-boot` Init `go(start)` vẽ `D = SL_DATA` demo ngay cả ở chế độ Firebase; (2) `SLAuth.show('app')` gọi `go()` TRƯỚC `startData()` → vẽ demo lần 2 (đếm từ 0); (3) `rebuild()` debounce 250 ms kiểu trailing → đợt ~10 snapshot lúc mở (cache rồi server) hẹn lại liên tục, lần vẽ thật chỉ xảy ra 250 ms SAU snapshot cuối; (4) màn chờ tắt theo đồng hồ 600 ms, không theo dữ liệu.
**Vá (`m11.py`, 15 mốc, fail-closed nguyên tử)**: `app.html` — 4 `<link rel="modulepreload">` SDK Firebase (tải song song với app.js thay vì sau khi live.min.js parse xong) + màn chờ `#loading-screen` ở chế độ Firebase giữ tới sự kiện `sl-boot-done` (trần 15 s khớp watchdog), demo vẫn 600 ms · `90-boot` — chế độ Firebase KHÔNG `go()`/`recount()`/`renderTicker()` với demo, chỉ `SLAuth.show('loading')`; `window.SL_LIVE_BOOT` · `80-rbac` — `show('app')` khi `SL_LIVE_BOOT && !SL_LIVE_READY` chỉ `applyRoleUI()` rồi giữ cổng; thêm `SLAuth.reveal()` (mở cổng + `sl-boot-done`, chỉ khi cổng đang loading/app), `GATE_MODE`; login/pending/nobrand bắn `sl-boot-done` · `live.js` — `chanSeen` (chanOk ghi kênh đã có snapshot, snapErr ghi `'err'`), `leadsSrv`/`leadsCacheAt` (snapshot leads từ máy chủ hay cache), `coreReady()` = leads+sources+config+scans đã có (super thêm lượt `refreshAdmin` đầu) và lead có bản máy chủ hoặc quá 1,2 s sau bản cache; `rebuild()` lần đầu ở chế độ live: chưa đủ → thăm lại 100 ms (trần `bootDeadline` 7 s), đủ → vẽ NGAY (delay 0, không chờ debounce) với `pendingViews='*'` rồi `SLAuth.reveal()` + console `vẽ lần đầu bằng dữ liệu thật sau N ms`; sau đó debounce 250 ms như cũ.
```
python3 m11.py <cây>   # áp lên v119-68 / v120-esm-r (sau m10)
node docs/harness-boot-timeline-2026-09-08.mjs <cây> [nhãn]   (cần node_modules có playwright-core cạnh file, vd symlink)   # SCN=normal|slow|nocache|login|pending|leadsErr
```
**Kết quả harness** (ms từ DOMContentLoaded): normal — màn chờ giữ tới **1.275 ms rồi hiện thẳng số thật** (43 | 6), không có đoạn demo/cache; slow (server lead 3 s) — 1.9 s vẽ bản cache (43 | 3), 3.7 s cập nhật máy chủ bằng morph; nocache — 1.45 s; login — form đăng nhập 202 ms, màn chờ tắt 500 ms; pending — cổng chờ duyệt 450 ms; leadsErr (permission-denied) — vẽ phần còn lại + banner ngay thay vì đợi 7 s (sau khi thêm mốc snapErr). Harness boot stub cũ (auth null): SL_FB 86 method, login hiện, 0 lỗi. Smoke 108/108 cả 2 cây (demo path không đổi).

## v119-70 / v120-esm-t (08/09, anh: "quá trình đang tải khi mới vào vẫn lâu" sau v119-69)
v119-69 đổi "nháy số demo" thành "chờ lâu hơn" vì điều kiện vẽ lần đầu đòi cả kênh `scans` (1.000 doc) + lượt admin + bản máy chủ của lead (1,2 s sau cache), và trước khi đăng ký kênh còn 2 lượt máy chủ tuần tự (getDoc hồ sơ user, getDoc tên brand). `m12.py` (14 mốc, áp sau m11): (1) kênh lõi chỉ còn leads + sources + config; scans + admin chờ MỀM ≤500 ms; (2) lead chờ bản máy chủ ≤600 ms sau cache; (3) listener hồ sơ user đăng ký NGAY, tạo/vá hồ sơ chạy song song (bỏ qua snapshot cache "không tồn tại" để không hiện chờ duyệt nhầm), `startData` chạy trước khi lấy tên brand; (4) lần vẽ đầu chờ `SL_ROLE_APPLIED` (SLAuth.show('app') đã áp vai trò) → không vẽ 2 lần; (5) `window.SL_BOOT` + dòng console `[SmartLead] khởi động (ms từ lúc mở trang): sdk · auth · hồ sơ user · đăng ký kênh · kênh … · vẽ lần đầu | tải: firebase-*.js Nms app.min.js Nms` — dán dòng này khi còn chậm để biết chậm ở bước nào; (6) `#loading-screen` z-index 10000 (trên cổng auth 9999) → lúc chờ thấy logo.
Harness (ms từ DOMContentLoaded): normal 1,1 s (bản máy chủ), cache nóng nhưng máy chủ lead chậm 3 s → 1,1 s bản cache rồi 3,4 s morph, cold + scans 4 s + admin 2,5 s → **2,1 s** (v119-69: 5,1 s), nocache 1,6 s, kênh lead lỗi 0,8 s + banner, login 0,2 s, pending 0,3 s.

## v119-71 / v120-esm-u (08/09, anh gửi file logo ngang "Z15 MIRACLE" qua zip)
`python3 m13.py <cây> <logo.png>` (áp sau m12): chép file vào `assets/img/logo-full.png` (1874×601 RGBA, 40 KB; ?v= tự hash → SW cache), màn chờ `#loading-screen` dùng logo ngang cao 64px (không bo góc/đổ bóng, rộng tối đa 78vw/360px), thay dấu V vuông 56px. Ảnh anh dán vào chat chỉ là ảnh xem (không thành file) → cần zip hoặc Drive; Cloudinary bị proxy phiên chặn. Không dùng Cloudinary cho logo màn chờ: cùng domain Netlify không tốn thêm DNS/TLS, có ?v= + SW cache nên lần sau hiện tức thì kể cả offline. Sidebar/favicon/icon PWA vẫn dấu V (anh chỉ hỏi màn chờ). Smoke 108/108 cả 2 cây.


## v119-72 / v120-esm-v (08/09, anh: "fix lại cái icon cạnh 'Không nghe máy' cho đẹp hơn")
- `m14.py <cây>` (áp lên v119-71 / v120-esm-u, fail-closed 2 pha): (1) `assets/js/icons.js` `SLI.phoneOff` vẽ lại = ống nghe đầy đủ + dấu × góc trên phải
  (kiểu "cuộc gọi nhỡ", × nét 2.2) — bản cũ là ống nghe gãy 2 khúc + gạch chéo, ở 13px trong nút trông như cây bút; so 5 phương án ở kích thước
  thật (`shots-modal-v119-72/icons-cmp.png`) → chọn D. (2) `assets/css/app.css` Dòng thời gian 360°: chấm mốc bị cắt nửa vì `::before` đặt
  `left:-17px` nằm NGOÀI padding-box của `.ld-tl-list` (`overflow-y:auto` cắt mọi thứ ngoài padding-box) → bỏ `border-left`, `padding-left:22px`,
  chấm + đường dọc vẽ bằng `::before/::after` của TỪNG dòng (đường dọc `left:-14px; top:13px; bottom:-8px`, dòng cuối không có), chấm có viền trắng 2px.
- Kiểm: smoke **108/108** cả 2 cây; ảnh `shots-modal-v119-72/callbox-1440-{truoc,sau}.png`.
- **Đề xuất UI modal (CHƯA giao, chờ anh chốt)** — `m15p-preview.py <cây>` áp lên cây đã qua m14 để dựng bản xem thử; `shot-modal-cmp.js`
  (SITE/OUT/TAG, lead làm giàu dấu vết: giao/chăm/hẹn/ghi chú/máy) + `stitch-png.js` ghép → `shots-modal-v119-72/so-sanh-modal-{1440,390}.png`:
  P1 khối Ghi kết quả liên hệ: dòng mô tả xuống hàng riêng (mobile hết gãy tiêu đề), sắp lại trung tính → tích cực (xanh lá) → tiêu cực (đỏ nhạt),
  icon 14px · P2 Nhắc hẹn: nút nhanh thành pill, gợi ý nhịp chăm gọn căn phải · P3 nút Xoá lead → icon thùng rác xám (đỏ khi rê), tách khỏi
  "Không thành" (mobile 2 nút đỏ kề nhau) · P4 chip giai đoạn 1 hàng cuộn ngang, chip hiện tại tự vào giữa, mờ 2 mép (đánh đổi: "Đã chốt" phải cuộn
  mới thấy — footer vẫn có nút Đã chốt) · P5 tiêu đề 3 khối Ghi kết quả / Ghi chú / Dòng thời gian dùng eyebrow như Pipeline & Nhắc hẹn (1 kiểu
  tiêu đề trong modal). Anh chốt mục nào thì chuyển phần đó từ m15p-preview.py sang script giao chính thức.

## v119-73 / v120-esm-w (08/09, anh chốt "làm nốt từ P1 đến P5, riêng P3 thùng rác màu đỏ")
- `m15.py <cây>` (áp lên v119-72 / v120-esm-v, fail-closed 2 pha, 7 mốc — bản giao chính thức của `m15p-preview.py`, khác P3 = thùng rác ĐỎ):
  **P1** `#callBox`: tiêu đề + `.cf-sub` riêng dòng; nút xếp `noans, callback` (trung tính) → `talked, booked` (`.call-pos` xanh lá) → `wrong, noneed`
  (`.call-neg` đỏ nhạt); icon 14px · **P2** `#fuBox`: `.fu-quick` + 3 pill `.fu-q` (handler `[data-fuq]` giữ nguyên) + `.fu-hint` căn phải ·
  **P3** `#delLeadBtn` → `.ld-del` chỉ icon `SLI.trash` đỏ `#d92d20` (rê chuột đậm + nền hồng), `aria-label="Xoá lead"`, hộp thoại xác nhận như cũ ·
  **P4** `.mstages` `flex-wrap:nowrap; overflow-x:auto` (ẩn thanh cuộn, mờ 2 mép bằng mask, `margin:0 -16px; padding:0 16px` khớp padding `.ld-stage`),
  sau khi vẽ modal `scrollLeft` đưa `.mstage.cur` vào giữa (chạy cả khi vẽ lại tại chỗ) · **P5** `#callBox .cf-k, #mNotes .cf-k, .ld-tl summary`
  = eyebrow 10px caps `--ink-400` như `.ld-stage .row1 .k` (khối CSS chèn SAU `.ld-tl-x` để thắng rule `.ld-tl summary` 13px/700 đứng trước);
  nút "↻ tải ghi chú cũ" + chữ mờ trong tiêu đề Ghi chú giữ chữ thường.
  **P6 (lộ ra khi smoke chạy)**: toast "Hoàn tác" `#pvUndoToast` (fixed đáy màn, z 300) đè lên thanh nút cuối modal — trước đây footer 2 hàng (nút
  "Xoá lead" chữ dài rớt hàng) nên "Đã chốt" nằm cao hơn toast; sau P3 footer còn 1 hàng → nút nằm đúng vùng toast, bấm bị chặn ~6 s sau khi đổi giai đoạn.
  Vá: `body:has(#modalBg.show) #pvUndoToast { bottom:auto !important; top:14px }` (mobile vốn đã top 14px). Bài học: đổi bố cục footer sticky phải kiểm
  lớp nổi cố định đáy màn (toast/FAB) có đè lên không — smoke bắt được vì click `#winBtn` ngay sau khi đổi chip.
- `tools/smoke.js` +1 check **v119-73** (thứ tự 6 nút + 2 xanh/2 đỏ + `.cf-sub` · chip giai đoạn cùng 1 hàng + chip hiện tại trong tầm nhìn · thùng rác đỏ
  không chữ · tiêu đề uppercase · chấm timeline nằm trong padding-box khối cuộn (kiểm âm: CSS cũ → false) · 3 pill hẹn nhanh) → **109/109** cả 2 cây.
- Ảnh: `shots-modal-v119-73/` (modal trọn 1440/390, khối kết quả liên hệ, footer mobile).

## v119-74 / v120-esm-x (08/09, anh hỏi "có cấn gì ở Dòng thời gian không" → 3 điểm → rồi anh đề xuất "cho dòng Phát hiện… xuống hẳn dòng")
- 3 điểm "cấn" em chỉ ra (ảnh `shots-modal-v119-74/1440-one-0-hientai.png`): (1) chữ xuống dòng thụt dưới icon (icon inline cùng dòng chữ);
  (2) tên nguồn = tên group Facebook viết HOA nguyên văn, dài, "hét" giữa dòng nhật ký nhỏ; (3) mốc "11:21 · 08/09/2026" mono 108–119px kiểu log máy,
  kèm năm, bóp hẹp cột chữ. Mock 2 kiểu bằng CSS/DOM inject trên bản build (`shot-timeline-mock.js`, SITE/OUT): A = 2 cột sửa thụt dòng · B = xếp dọc
  → chọn **B** (mobile ≤639 vốn đã xếp dọc, desktop theo cho đồng bộ; chữ dài không bị bóp; đánh đổi 9 mốc cao 380 px thay 310 px → nâng `max-height` 330).
- `m16.py <cây>` (áp lên v119-73 / v120-esm-w, 12 mốc, fail-closed 2 pha): 65-charts-lead-modal `tlWhen(ms)` ("Hôm nay 11:21" · "Hôm qua 09:05" ·
  "Ngày mai 07:30" · "03/09 14:20", năm chỉ khi khác năm nay; mốc demo dạng chuỗi "2 phút trước" giữ nguyên) + `niceName(s)` (chuỗi ≥8 chữ cái và
  ≥70% hoa → viết hoa đầu từ mọi từ ≥2 chữ; viết tắt = ≤3 chữ KHÔNG nguyên âm (HCM/TP/BDS) giữ nguyên — KHÔNG dựa độ dài vì tiếng Việt đầy từ 2–3 chữ
  như TẬP/VÀ; NFC trước khi đếm; unit-test 6 ca) + tên nguồn cắt 48 ký tự ở ranh giới từ + "…" và `title` đủ tên trên `.ld-tl-x`; render bọc chữ trong
  `<span class="ld-tl-tx">`. CSS: `.ld-tl-i{display:block}` · `.ld-tl-t{display:block; tabular-nums}` (bỏ min-width 108) · `.ld-tl-x{display:flex;gap:6px}`
  + `.ld-tl-ic{flex:none}` (icon cột riêng) · chấm `top:4px`, đường dọc `top:12px; bottom:-11px` · list `gap:9px; max-height:330px` · bỏ rule mobile
  `.ld-tl-i{flex-direction:column}` (thừa). smoke +1 check **v119-74** (đổi tên nguồn card đầu thành chuỗi HOA trước khi mở modal → kiểm "Tuyển Dụng Thực
  Tập Sinh Digital Marketing…" + tooltip đủ; giờ "Hôm nay hh:mm" ≥1 và 0 mốc kiểu cũ; mọi mốc: giờ nằm trên nội dung, cùng lề trái; chữ bắt đầu sau icon
  ≥3px; trả lại tên nguồn sau khi kiểm) → **110/110** cả 2 cây. BÀI HỌC: smoke bắt được lỗi heuristic đầu ("TẬP" 3 chữ bị coi là viết tắt) trước khi gửi zip.
- Ảnh: `shots-modal-v119-74/{1440,390}-{one,rich}-that.png` (bản thật) + `*-0-hientai.png` (trước).

## v119-75 / v120-esm-y (08/09, anh: "cải tiến giao diện card Hôm nay đẹp hơn")
- Hiện trạng (`shots-today-v119-75/truoc-today-*.png`): 7 ô trắng viền trái 3px, số 22px tô 7 màu khác nhau (đỏ ×2, xanh lá ×2 → "cầu vồng"), nhãn 11.5px,
  ô = 0 chỉ đổi số sang xám; màn rộng 2000px ô 221px trống rỗng vì nội dung dồn góc trái; dòng "5 việc cần làm ngay" đỏ chen vào dòng ngày.
- `m17.py <cây>` (áp lên v119-74 / v120-esm-x, 9 mốc, fail-closed 2 pha): 20-feed `todayCard` — mỗi ô: **chip icon** 30px nền màu nhạt (`--tb`) + icon màu (`--tc`)
  (sparkle · flame · users · warning · clock · message · handshake) → số **26px mono đậm màu mực** → nhãn 11.5px; màu chỉ nằm ở chip; ô = 0 → chip xám
  `--ink-50`, số `--ink-300`; 2 ô cảnh báo `alert` (Nóng chưa ai chăm · Quá hẹn) khi > 0 → nền nhạt màu + số màu (nhìn là thấy việc gấp). Tiêu đề: dòng ngày
  riêng; số việc thành **pill** `.td-pill.hot` (siren, đỏ nhạt) / `.td-pill.ok` ("Không có việc tồn", xanh) đứng cạnh nút Hộp việc trong `.td-head-r`.
  CSS app.css: `.td-grid` minmax 128→136 (7 ô vẫn 1 hàng ở ≥1366; 1280 xuống 2 hàng như trước), `.td-tile` bỏ viền trái, bo 14, `font:inherit`, hover viền
  màu ô; pipeline-v2.css ≤639: ô lẻ cuối `:last-child:nth-child(odd){grid-column:span 2}` (hết ô mồ côi — kiểm 390: ô cuối 326px vs 159px), `.td-head-r`
  xuống hàng riêng, pill trái + nút phải. `.td-head` giữ nguyên (dùng chung với card "Nên gọi tiếp theo" + "Bắt đầu với SmartLead").
- smoke +1 check **v119-75** (7 ô đều có chip icon + số mono; pill đúng chữ/lớp; ô alert có nền màu; ô 0 mờ khác màu ô có số; dòng ngày không còn chứa
  số việc) → **111/111** cả 2 cây. Ảnh: `shots-today-v119-75/sau-today-{2000,1440,1024,390}.png` + `sau-today-390-full.png`.

## v119-76 / v120-esm-z (08/09, anh: "icon Chốt hôm nay xấu quá, em sửa lại đi")
- `SLI.handshake` (bắt tay) ở 16px trong chip 30px thành cục rối. So 7 phương án ở đúng cỡ chip (`shots-today-v119-75/icons-cmp2.png`: handshake · trophy ·
  badgeCheck · checkCircle · flag · coins · star · partyCheck) → chọn **trophy** (cúp: rõ ở 16px, đúng nghĩa "chốt được deal", không trùng checkCircle đang
  dùng cho Đã tư vấn/Đã chốt ở modal). `m18.py <cây>` (áp lên v119-75 / v120-esm-y, 3 mốc): icons.js thêm `trophy` (Lucide, trước `siren`) · 20-feed ô
  "Chốt hôm nay" → `SLI.trophy` · 50-config-views KPI "Đã chốt" (Báo cáo) → `SLI.trophy` (cùng nghĩa, đồng bộ). `handshake` giữ cho bước "Kết bạn" (Tiếp cận)
  + tiêu đề CRM (cỡ lớn hơn, đúng nghĩa quan hệ). Smoke 111/111 cả 2 cây (không thêm check — check v119-75 đã đòi mỗi ô có svg).

## v119-77 / v120-esm-aa (08/09, anh: "ô Bài đã quét ở Bảng điều khiển của người dùng brand không hiển thị")
- **Nguyên nhân**: `kpi.scanned` (live.js) = tổng `postsFetched` của nhật ký `scans`; live.js chỉ subscribe `scans` khi `role==='superadmin'` (khớp Rules — scans là
  dữ liệu vận hành nội bộ có chi phí/token, không cho brand đọc) → user brand: `scans=[]` → `kpi.scanned=null` → ô hiện "—" + "chưa có nhật ký quét" (câu sai:
  hệ thống có quét, chỉ là họ không được đọc nhật ký). Thanh nhịp quét ở Lead mới đã có bản rút gọn cho brand từ v16.22 (`lastScanInfo`), riêng ô KPI Overview
  thì chưa. `opsStrip` (Lần quét cuối/Chi phí) đã là super-only; Lịch sử quét / widget phương thức / ngân sách Bright Data đều super-only → không lộ ô rỗng khác.
- `m19.py <cây>` (FE-only): Super Admin giữ "Bài đã quét"; user brand thấy **"Đã hẹn tư vấn"** (`kpi.booked` thật của brand, caption "tỷ lệ hẹn N% trên lead
  hợp lệ") → hàng KPI thành phễu Hợp lệ → Nóng → Hẹn → Chốt. smoke +1 check v119-77 (gọi `SLAuth.show('app',{role:'admin'})` rồi vẽ Overview → ô 1 = "Đã hẹn
  tư vấn <số>"; trả lại super → "Bài đã quét") → **112/112** cả 2 cây (BÀI HỌC: `SLAuth.show(mode,user,role)` — vai trò là tham số thứ 3, không nằm trong user; check đầu truyền `{role}` nên cả 2 lần vẽ đều thành viewer). Ảnh `shots-kpi-v119-77/kpi-admin-1440.png`.
- **Tuỳ chọn sau (backend, chưa làm)**: muốn brand thấy đúng "bài đã quét của brand mình" thì thêm counter `daily_stats/{brand}__{ngày}.scanned` từ
  `scans.bySource` (nguồn → brand) trong `scheduledScan` (LỆNH) → FE đọc `D.dailyStats` (brand user đã đọc được daily_stats theo Rules).

## v119-78 / v120-esm-ab (08/09, anh: "anh muốn brand thấy số bài đã quét của mình")
- Đi cùng **LỆNH #39** (`docs/lenh-2026-09-08-39.md`; CF `scanStatsOnRun` trigger `onDocumentCreated scans/{id}` → `bySource[].url` map sang brand qua `sources` → `FieldValue.increment` vào `daily_stats/{brand}__{ngày VN}` các field `scanned` / `scannedComments` / `scanRuns` (+`scanAtMs`); backfill `_scanstats_backfill.mjs` từ 01/08; harness `docs/harness-scanstats-2026-09-08.mjs` 10/10). Không patch `index.js`/`scanAll` (chỉ thêm file + 1 dòng export như stats.js).
- `m20.py <cây>` (FE): live.js user brand subscribe `daily_stats where brandCode == brand` (1 field, không cần index; lỗi chỉ console.warn — Rules LỆNH #17 đã cho brand đọc) → `D.dailyStats`; 20-feed `brandScan14()` (tổng `scanned` 14 ngày vs 14 ngày trước theo chuỗi ngày VN, hôm nay riêng) → ô KPI 1 của brand = **"Bài đã quét"** (số + delta + "bài AI đã đọc cho brand / 14 ngày · hôm nay N") khi đã có counter; chưa có (LỆNH #39 chưa chạy) → giữ "Đã hẹn tư vấn" của v119-77. Thanh nhịp quét ở Lead mới (brand) thêm "Bài đã quét hôm nay". smoke +1 check (bơm `dailyStats` + `myBrand`, vẽ như admin → ô 1 "Bài đã quét", thanh nhịp quét có số hôm nay; trả lại) → **113/113** cả 2 cây. ESM: 20 import không đổi (hàm cục bộ).

## v119-79 / v120-esm-ac (08/09, anh: "check kĩ toàn diện xem số liệu ở các bảng/khung tại tất cả các mục có chuẩn chính xác chưa")
- **Cách làm**: 3 agent chỉ-đọc rà 3 cụm mục (Overview/live.js/feed · Pipeline/ROI/modal/Hộp việc/scan · Báo cáo/Bảng brand/Tiếp cận/Users) → 85 phát hiện → em kiểm từng mục trên code → **46 vá** (`m21.py`, 59/63 mốc) · 5 backend · 12 chờ anh chốt · 22 không cần sửa. Báo cáo + dữ liệu thô: `docs/rasoat-solieu-2026-09-08/` (artifact `7b577cf3-49ab-4664-adeb-469f9902fac0`).
- **live.js `buildData`**: mọi KPI/tỷ lệ tính trên **`act` = lead không `junk` và không `dropped`** (trước: hot/warm/cold/sc/responded/booked/closed đếm cả lead đã Loại, tỷ lệ chia trên `valid` khác mẫu); `pct(a,b)` trả `null` khi mẫu 0 (UI "—" thay 0%); byDay/cur14/prev14/indMap/bySrc/funnel cùng tập `act`; `respAvg` dùng `toDate(first_care_at)` (trước lẫn Timestamp/ms) + bỏ mẫu lệch >30 ngày; **outreach_stats theo ngày VN**: `vnToday()` + `oaApply()` lọc lại lúc đổi ngày (interval 5′, dọn trong `dataUnsub`) — trước super query cứng `day == hôm nay` lúc đăng ký nên qua 0h vẫn hiện số hôm qua.
- **20-feed**: rail Nóng/Ấm/Lạnh + tổng đếm trên `vis = lead không bị `feedHidden``, thêm "+N ẩn" (khớp số thẻ đang hiện); chưa giao/hẹn hôm nay bỏ lead ẩn + đã chốt; `closeRate` null-safe; `opsStrip` "lịch 3′/lượt · gieo mỗi nguồn N′"; ô Hôm nay "Quá hẹn" nhảy đúng bộ lọc `overdue`. **10-core**: Hôm nay chốt/chờ giá trị tính trên tập `L` chung; TTL bài đã quét "~3 ngày" (khớp `SCANNED_TTL_DAYS=3`); phí gói Bright Data **tạm tính theo ngày đã qua** trong tháng (`bdPro`) thay vì trọn tháng. **70-shell**: badge Lead mới bỏ lead ẩn; Hộp việc/Phản hồi khách bỏ lead đã xử lý (`done`). **60-scan-views**: KPI "Chưa đạt / loại" = `rejCnt` thật (trước đếm thiếu `self_comment`/`seller`), nhãn "1.000 lượt quét gần nhất", thanh brand "Nhịp gieo N′ mỗi nguồn"/"Quét tự động đang bật". **30-pipeline**: "N việc hôm nay" = kẹt + rác (trước chỉ kẹt), thêm bộ lọc + chip **Quá hẹn**, `pvSignature` thêm mốc 10′ để chip tuổi/quá hẹn tự cập nhật khi repaint mềm. **40-roi**: cohort bỏ `dropped`/`lost`, mẫu = `n30` (30 ngày, bỏ fallback 3 lead), dự báo chỉ tính lead đang mở, "Giá trị pipeline ước tính" = `expected`, CPL "—" khi tháng chưa có lead, chú thích super "trong N lead gần nhất đã tải". **85-users** `u.active!==false` + đếm chờ duyệt; **45-outreach** nhãn "Lượt cảm xúc hôm nay", replied luôn hiện; **50 reports** caption null-safe, "lead đã được chăm", tổng attribution cộng đúng phạm vi bảng, hiệu chỉnh điểm "ít mẫu" <30; **25-agency** điểm SLA null → 0 + tooltip "làm tròn LÊN mốc"; **65 modal** "chưa thấy trong dữ liệu đã tải" + toast "(kể cả lead đang xem)". ESM: 20 export `feedHidden` → 70 import; 60 import `scanIv`.
- **Kiểm**: harness `docs/rasoat-solieu-2026-09-08/harness-builddata.mjs` 8/8 (valid/hot/closeRate/responded/funnel/source/respAvg/pct null); smoke +1 check v119-79 (Loại 1 lead nóng → rail Nóng = số thẻ hiện, badge Lead mới khớp feed, pipeline có bộ lọc Quá hẹn) → **114/114** cả 2 cây. BÀI HỌC: patch chèn `//` giữa dòng gốc còn tiếp = nuốt phần sau (build "Unexpected end of input") → dùng `/* */`.

## v119-80 / v120-esm-ad (08/09 tối, anh: "em hãy xem lại các đề xuất của em và tự suy nghĩ, tự chốt theo hướng tốt nhất… thuận tiện, thông minh và tự động hoá cao")
- **Em chốt 12 mục "chờ chốt" + 2 mục backend của báo cáo rà số liệu** (`docs/rasoat-solieu-2026-09-08/`, artifact `7b577cf3` đã cập nhật cột "Em chốt · đã làm") theo 3 nguyên tắc: ưu tiên **bộ đếm máy chủ** (đúng mọi quy mô, sales cũng thấy đúng), **ít cấu hình tay**, **tự chuyển** khi backend có (không cần deploy lại FE). `m22.py <cây>` (57/64 mốc, fail-closed), smoke **116/116** cả 2 cây, harness buildData 8/8.
- **KPI Bảng điều khiển** (20-feed `kpi14()`): 4 ô = **giá trị 14 ngày** (số to và mũi tên ▲▼ cùng kỳ; trước: số to cả cửa sổ lead đã tải, mũi tên 14 ngày) — nguồn `D.dailyStats` (super: mọi brand nhờ live.js làm ấm `agStart`; brand user: brand mình) → `new/hot/closed`; chưa có bộ đếm → `kpi.win` + `closed_at`; demo → ô cũ. Ô 4 = **"Đã chốt" theo NGÀY CHỐT** (delta hết nghiêng âm), tỷ lệ chốt ở caption; caption ô 2 ghi "tổng đã nạp N". `brandScan14(all)` → super cũng dùng counter LỆNH #39 khi có.
- **"Hôm nay" theo giờ Việt Nam toàn app**: 10-core `vnDayStart(ms)/vnDayKey(ms)` (xuất cho ESM) → todayBoard, nextBestLeads, rail đếm ghi chú hôm nay, `fuChip`, pipeline `today`/`pvFuToday`, modal `tlWhen` ("Hôm nay/Hôm qua"), tiêu đề card Hôm nay (`timeZone`). Khớp bộ đếm máy chủ + thanh nhịp quét.
- **Pipeline**: `PV_NEW_IDLE_DAYS=7` — lead ở cột Mới ≥7 ngày chưa chăm = kẹt (gợi ý "kiểm tra rồi tiếp cận hoặc loại"; bộ lọc Đang kẹt + khối Việc cần chú ý đếm cả); phễu ghi "Toàn pipeline (không theo bộ lọc)" khi đang lọc. **stage_log**: `pvApplyStage` ghi `lead.stage_log` (≤40 mục `{from,to,at,by,undo}`) bằng update RIÊNG sau khi đổi giai đoạn thành công (lỗi Rules → console.warn, không chặn; whitelist = LỆNH #40) → 65 Dòng thời gian 360° hiện mọi lần chuyển "Chuyển sang X (từ Y) · ai" (không lặp với mốc stage_at hiện tại).
- **Độ tin cậy hồ sơ** (20-feed `trustPanel`): câu chữ thành mô tả dữ kiện; chip: ≥2 điểm cộng & 0 cảnh báo → "Nhiều dấu hiệu hoạt động tự nhiên"; ≥2 điểm cộng có cảnh báo → "Có dấu hiệu tốt · còn điểm cần xác minh" (chip-warm).
- **Báo cáo** (50): dòng "Phạm vi số liệu: N lead đã nạp (phát hiện từ dd/mm) · kho còn lead cũ hơn chưa tải · Bảng điều khiển/Bảng brand dùng bộ đếm máy chủ" trên màn hình + bản in; giờ in theo VN. **Keyword hiệu quả**: tỷ lệ chỉ khi ≥10 lead (dưới → "ít mẫu"), caption phạm vi; **Hiệu chỉnh điểm AI**: dải <10 lead → "ít mẫu (n)" thay %.
- **ROI Super Admin** (40): `roiSumForecast(rows)` cộng dự báo từng brand theo tham số riêng (trước chạy lại toàn lead với tham số mặc định); `savingRaw` → tổng tiết kiệm cộng cả brand âm, hero/ô/hàng hiện số âm đỏ (khớp Σ(lead×CPL) − Σ phí); brand hoạt động = `active!==false` + (lead đã tải ∨ tham số riêng ∨ nguồn quét bật). **Benchmark CPL** → `D.cfg.roiBench` `{year,src,avg,rows[[ngành,cpl]]}` (mặc định 2025 LocaliQ "số tham khảo"), nút "Cập nhật chuẩn ngành" (super, `slPrompt` 1 dòng `năm | nguồn | CPL TB | Ngành=CPL; …`) → `setConfig`.
- **Tiếp cận** (45): brand 0 nick → dòng "Chưa gán nick cho brand…" thay 4 thanh van 0/40; panel VPS `runCnt` chỉ cộng VPS online. **Cmd+K** (70): SĐT hợp lệ không có trong lead đã tải + có `findByPhone` → dòng "Tìm SĐT … trên máy chủ" → `ckFindSrv` nạp rồi mở Lead mới với ô tìm = SĐT (IIFE gán `feedQuery`, ESM `setFeedQuery`). **Nguồn ↔ lead** (live.js): `gidOf(url)` — đếm lead theo mã group trong `post_url/parent_url/comment_url` khớp `sources.url` hoặc `_id` trước, tên nguồn sau (đổi tên nguồn không mất số).
- **Bảng brand** (25): SLA đạt ưu tiên counter `slaOk/slaN` (LỆNH #40: đúng ngưỡng riêng brand, cohort ngày phát hiện; `slaLim` hiện đúng ngưỡng), chưa có → bucket như cũ; ước tính từ lead cũng theo cohort ngày phát hiện (`careLeBad` đếm trong nhánh `inW(det)`).
- ESM: 10 export `vnDayKey, vnDayStart`; 20 import 2 tên + export `normPhoneVN`; 30/65 import `vnDayStart`; 70 import `normPhoneVN`; 40 import `slNow, slPrompt`. smoke +2 check v119-80 (bơm daily_stats 3 doc → KPI "Lead hợp lệ 30 +100% · Lead nóng 7 · Đã chốt 3 +200% · caption tỷ lệ chốt 10% · bộ đếm máy chủ"; lead Mới 9 ngày → bộ lọc Đang kẹt +1 + tên trong Việc cần chú ý; bấm lọc → "Toàn pipeline"; stage_log 2 mục → Dòng thời gian "Chuyển sang Đã inbox (từ Lead mới) · sales@z15.vn" + "Đã phản hồi (từ Đã inbox)").
- **LỆNH #40** (`docs/lenh-2026-09-08-40.md` + `-40-stats-patch.cjs` / `-40-rules.cjs` / `-40-backfill.mjs` / `-40.sh`, chờ anh chạy): stats.js `slaInc/slaBadOf` + `statsEvents(…, {slaBad})` ghi `slaN/slaOk` lên doc NGÀY PHÁT HIỆN (ngưỡng `brands/{code}.slaBadMin` > `config/app.slaBadMin` > 60, cache 5′, chỉ đọc khi có sự kiện chăm lần đầu) + backfill 60 ngày (`slaAgg` thuần) + Rules whitelist `stage_log`. Harness `docs/harness-lenh40-2026-09-08.mjs` **21/21** (dựng stats.js = #17 + #36 + #40 trong thư mục tạm với SDK giả); dry-run `.sh` fake firebase/gcloud ×2 exit 0 (idempotent). Không `!` ngoài shebang.

### Cập nhật 09/09 sáng (sau khi anh deploy v119-80 + chạy LỆNH #39/#40)
- LỆNH #39 OK (scanStatsOnRun ACTIVE, 94 doc `scanned`), LỆNH #40 OK (statsOnLead slaN/slaOk, Rules stage_log 32 field, 90 doc). Kết quả ghi cuối `docs/lenh-2026-09-08-39.md` / `-40.md`.
- **Lỗi lộ ra từ output**: `daily_stats.new/hot` = 0 ở mọi doc 07–09/09 dù cùng doc có `slaN` > 0 → trigger #17 không đếm lead mới từ sau backfill 04/09 → KPI "Lead hợp lệ/Lead nóng" 14 ngày (v119-80, từ bộ đếm) và Bảng brand "Lead 7 ngày" thiếu số → **LỆNH #41** (`docs/lenh-2026-09-09-41.md`): vá trigger đếm ở lần đầu doc đủ brand + điểm, recount tuyệt đối 60 ngày, chẩn đoán kiểu dữ liệu lead + log lỗi. Không cần zip mới (FE tự đúng khi bộ đếm đúng).
