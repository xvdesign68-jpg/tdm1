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
