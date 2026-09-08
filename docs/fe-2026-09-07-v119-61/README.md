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

