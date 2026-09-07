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
