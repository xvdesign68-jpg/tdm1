# HANDOFF.md — Gói bàn giao để tiếp tục SmartLead ở phiên/gói Claude Code khác

> Đọc file này + `CLAUDE.md` là đủ để một phiên Claude Code MỚI (gói khác, máy khác, vẫn của anh Vinh) tiếp tục làm việc đúng "gu" mà không mất ngữ cảnh.
> **TUYỆT ĐỐI không đưa secret (token/API key/mật khẩu/IP) vào file này, vào git, vào zip, vào chat.**
> Bản này cập nhật **11/09/2026** (bản trước 07/09 lưu trong lịch sử git).

## 0. TL;DR (đọc 30 giây)
- **`CLAUDE.md` = bộ nhớ toàn dự án** (bắt buộc đọc hết, 670 dòng). Nó đi theo git repo `xvdesign68-jpg/tdm1`, **nhánh `claude/chao-ban-8d6f9r`** (repo CHỈ có nhánh này). Phiên mới **nối cùng repo + nhánh** → tự có `CLAUDE.md` + `HANDOFF.md` + `docs/` (258 file: mọi LỆNH đã chạy, script tái lập FE, harness, báo cáo rà soát).
- **Code app THẬT KHÔNG nằm trong git.** Anh phải **đưa lại 3 thứ** cho phiên mới: (1) **zip frontend mới nhất `smartleads17deploy-v119-87.zip`** (+ bản riêng `v120-esm-ak`), (2) **`worker.mjs` bản `2026-09-06d`**, (3) `config.json` của worker. Cả 3 đã đóng sẵn trong **`smartlead-handoff-2026-09-11.zip`** (em gửi 11/09) cùng CLAUDE.md + HANDOFF.md + docs/.
- **Backend (engine/Rules/.env) nằm ở Cloud Shell** `~/firebase-s13/functions` — phiên mới KHÔNG cần file, khi cần thì soạn LỆNH dump (mục 6).
- **Secret KHÔNG bao giờ qua chat.** Chúng ở Secret Manager / `functions/.env` / VPS. Phiên mới chỉ cần biết *chúng ở đâu* (mục 4).
- **Việc đang dở lúc bàn giao**: rà soát automation "Tiếp cận" 10/09 đã có số thật (LỆNH #43/#43b/#44a) → **LỆNH #44 engine ĐÃ CHẠY + nghiệm thu PASS 11/09 11:29 VN (rev `outreachtick-00030-bub`); worker 2026-09-11 + zip FE nhỏ chờ anh gật Đợt 1** (mục 6b, việc số 1).

## 1. Bản đồ "cái gì ở đâu"
| Thành phần | Nơi ở THẬT | Có trong git tdm1? | Phiên mới lấy bằng cách |
|---|---|---|---|
| Bộ nhớ dự án (`CLAUDE.md` + `HANDOFF.md`) | git repo `xvdesign68-jpg/tdm1` | ✅ CÓ | Tự có nếu nối cùng repo; không thì copy 2 file |
| **Frontend SmartLead** (app.html, `src/app/*.js`, `assets/js/live.js`, `assets/css/*`, `tools/build.mjs`, `tools/smoke.js`, eslint, _redirects…) | Máy anh (source gốc) + **zip khứ hồi** (zip CHỨA nguyên source) | ❌ KHÔNG | Anh đưa **zip mới nhất**, phiên mới giải nén vào thư mục làm việc |
| **Worker AdsPower** (`worker.mjs`, `config.json`, `run.bat`, `capture.mjs`, `install-autostart.bat`) | VPS Windows `vps-1` + file đã gửi anh | ❌ KHÔNG | Anh đưa lại **`worker.mjs` 2026-09-06d** + `config.json` |
| **Engine backend** (`outreach.js`, `content.js`, `stats.js`, `push.js`, `admin.js`, `cfgpriv.js`, `fbaccounts.js`, `index.js`, `lib/*`, `firestore.rules`, `.env`) | Cloud Shell `~/firebase-s13/functions` | ❌ KHÔNG | Phiên mới **dump qua LỆNH** (mục 6) — không gửi file |
| **Lịch sử LỆNH** (`docs/lenh-*.md` + `.sh/.cjs/.mjs` đi kèm) · **script tái lập FE** (`docs/fe-*.py`, `docs/fe-2026-09-07-v119-61/` m1–m29 + `lib.py` + README) · **harness kiểm** (`docs/harness-*.mjs`) · **báo cáo rà soát** (`docs/rasoat-2026-09-03/`, `docs/rasoat-ui-2026-09-07/`, `docs/rasoat-automation-2026-09-10/`, `docs/rasoat-solieu-2026-09-08/`) · research font | git repo `tdm1` | ✅ CÓ | Tự có — nguồn để soạn LỆNH/patch mới đúng pattern |
| Dump engine gần nhất (chỉ đọc) | `docs/lenh-2026-09-10-43-engine-dump.txt` (stepNickAdspower / apEnqueueFunnel / tryConsume, 10/09) | ✅ CÓ | Đủ để soạn LỆNH #44 mà không cần dump lại |
| Secrets (func token, LLM_API_KEY, FUNC_WEBHOOK_SECRET, serviceAccount.json, BrightData/Telegram, cookie nick) | Secret Manager / `functions/.env` / VPS | ❌ KHÔNG (đúng) | Không cần — phiên mới chỉ thao tác *tham chiếu* |

> ⚠ **Repo tdm1 có rác cũ:** `index.html`, `css/styles.css`, `js/main.js`, `fb-worker/*` là **scaffold v0.1 CŨ, không dùng** — KHÔNG phải app thật. App thật = zip frontend; worker thật = `worker.mjs` (không phải `fb-worker/worker.js`).

## 2. File anh đưa cho phiên mới (checklist)
1. ☐ **Nối repo `xvdesign68-jpg/tdm1`, nhánh `claude/chao-ban-8d6f9r`** (cách tốt nhất — có sẵn CLAUDE.md/HANDOFF.md/docs). Không nối được → đưa **`smartlead-handoff-2026-09-11.zip`** (bên trong: `CLAUDE.md`, `HANDOFF.md`, `docs/`, `fe/` 2 zip, `worker/` 2 file, `README-START.txt`).
2. ☐ **`fe/smartleads17deploy-v119-87.zip`** — zip FE MỚI NHẤT cần deploy (cây IIFE, 10/09). **`fe/smartleads17deploy-v120-esm-ak.zip`** — bản riêng cây ES module, cùng tính năng, deploy sau khi v119-87 ổn. Mọi FE mới phải áp cho **cả 2 cây** (script `mNN.py` trong `docs/fe-2026-09-07-v119-61/`).
3. ☐ **`worker/worker.mjs`** bản `2026-09-06d` (118.996 byte; `WORKER_VERSION = '2026-09-06d'`) — đang chạy trên VPS `vps-1`.
4. ☐ **`worker/config.json`** (KHÔNG phải secret: `graphql.reactDocId 27646120298312844`, `commentDocId/replyDocId 28781864408106143`, `friendDocId 28400389149651601`, `maxConcurrent 1`, `profiles []`, `inbox.enabled true`; không khai `hardCaps`/`safety` → mặc định).
5. ☐ (khi debug automation) 1–2 ảnh `errors/*.png` + `capture-<ts>.log` từ VPS — xem mục 6b việc 1.

Sau khi giải nén zip FE: `npm i playwright-core esbuild eslint` 1 lần (Chromium sẵn ở `/opt/pw-browsers` trên môi trường web) để build + smoke.

## 3. Thông tin hạ tầng / tài khoản (không phải secret)
- **Super Admin:** xuanvinhsc68.work@gmail.com
- **Firebase/GCP project:** `smartlead-z15` · **Region functions:** `asia-southeast1` (BẮT BUỘC mọi function)
- **Cloud Shell:** account `xuanvinh.marketingpartners` · thư mục chính `~/firebase-s13` (Rules + engine); phụ `~/codebase2` (Sheet sync), `~/smartlead-zalo-fn` (Zalo)
- **Netlify site (deploy FE):** `smartlead.z15miracle.com.vn` (kéo-thả zip; nhắc Cmd+Shift+R / Ctrl+F5)
- **func.vn:** account_pid FB User = `fbu100013727043931` (nằm trên URL, không phải secret)
- **AdsPower:** Local API `http://local.adspower.net:50325` trên VPS Windows `vps-1` (proxy dân cư); nick AdsPower doc id `ap<profileId>`
- **Nguồn lead:** BrightData (dataset bài + comment; gieo/gặt snapshot mỗi ~10′/nguồn) · 23 nguồn đang bật / 4 brand
- **funcWebhook URL:** `https://asia-southeast1-smartlead-z15.cloudfunctions.net/funcWebhook` (Cloud Run: `https://funcwebhook-ljvdphb2ja-as.a.run.app`)
- **Alert email GCP** (LỆNH #9): policy "SmartLead - lỗi Cloud Functions/Run (severity>=ERROR)" → mail tài khoản gcloud; bdwatch (LỆNH #21) ghi `[BRIGHTDATA-DOWN]`/`[BRIGHTDATA-UP]` + `system_status/brightdata`.

## 4. Secrets — CHỈ vị trí, KHÔNG giá trị
| Secret | Nơi lưu | Ghi chú |
|---|---|---|
| func Account Token (mỗi nick func) | Secret Manager `func-token-<pid>` | CF đọc runtime; FE chỉ gọi `SL_FB.*` |
| LLM_API_KEY / LLM_BASE_URL / LLM_MODEL (gpt-5.6-sol) / LLM_PREFILTER_MODEL | `~/firebase-s13/functions/.env` | scanner + content.js + aiText; đổi key = sed .env + deploy cả bộ functions |
| FUNC_WEBHOOK_SECRET | `~/firebase-s13/functions/.env` | verify webhook func |
| BRIGHTDATA_TOKEN / DATASET_ID | `~/firebase-s13/functions/.env` | scraper |
| VPS_URL / BROWSER_SVC_URL / SECRET | `~/firebase-s13/functions/.env` (LỆNH #22: code không còn IP literal) | quét nick (đang tắt) |
| serviceAccount.json (SA `outreach-worker@`) | trên VPS cạnh `worker.mjs` | worker đọc/ghi Firestore (Admin SDK) — anh chốt KHÔNG đụng kiến trúc này |
| Cookie/nick FB | trong AdsPower trên VPS | SmartLead chỉ ra lệnh, không giữ credential |
| Firebase web apiKey · VAPID_KEY (Web Push) | công khai trong FE (`firebase-config.js`) | **KHÔNG phải secret** (hợp lệ) |

> ⚠ **Cần làm khi rảnh:** anh đã lỡ dán **2 func token + 1 webhook secret** vào chat trước đây → **regenerate** cả 3 (đã đổi webhook secret 1 lần bằng LỆNH E; 2 func token chưa).

## 5. Trạng thái deploy (tính đến 11/09/2026)
### 5.1 Frontend
- **Zip mới nhất cần deploy: `v119-87`** (10/09 sáng) = v119-86 + trang Giá trị & ROI cho Super Admin toàn cảnh mọi brand (CPL 2 cách A/B, `brands.roi.cplBasis`, phí gói theo `brands.plan` hoặc `feeSrc custom`, bảng 17 cột cùng số Bảng brand, "Xem như khách"); bản riêng **`v120-esm-ak`**. Smoke **129/129** cả 2 cây. Anh chưa xác nhận đã deploy + chưa nhận xét bố cục ROI (ảnh `docs/fe-2026-09-07-v119-61/shots-roi-v119-87/`).
- Chuỗi gần nhất (mỗi bản = 1 script `mNN.py`, README trong `docs/fe-2026-09-07-v119-61/`): v119-80 KPI 14 ngày theo `daily_stats` → 81 hàng KPI dễ hiểu → 82 KPI 4 ô đều → 83 Pipeline "Việc cần chú ý" gom nhóm → 84 toast mobile → 85 chữ số 1 font (`--font-num`) → 86 brand realtime cho super (`brands` onSnapshot) → 87 ROI super. Anh đã deploy tới **v119-80** (xác nhận 09/09); v119-81…86 bỏ qua, deploy thẳng 87.
- Nền tảng đã chốt (đừng đổi nếu anh không gọi): font menu Plus Jakarta Sans đậm + nội dung TikTok Sans 14,5px/450 + số TikTok Sans + mã JetBrains Mono; morph DOM realtime (v119-58) + `slChart` chữ ký + `FX_INTRO` (60); khởi động sạch chờ kênh lõi (69/70); menu 4 nhóm + hộp thoại app + icon SVG (61/62); kênh realtime tự đăng ký lại 4 lần (65).

### 5.2 Worker VPS
- **`worker.mjs 2026-09-06d`** trên `vps-1` (1 VPS, `maxConcurrent 1`, `inbox.enabled true`, worker online). **Nick: 0/6 sống** — 4 nick needLogin + tắt (`apk1g9yjdv/apk1ge6dka/apk1gehnnq/apk1gm2jd2`), nick t7 `apk1gm6por` bị Safety tự tắt 09/09 (Safety 28 vì 43 lỗi selector — xem 6b). **Khuyên: chưa bật lại nick tới khi có worker mới (Đợt 1).**
- Lịch sử bản: 06d watchdog huỷ cứng zombie · 06c `stampExtra` meta nội dung · 06b comment-lead đi API nội bộ + doc_id comment/reply MỚI `28781864408106143` (**từ bản này comment vào BÀI group gid số bắt đầu fail — nghi bộ biến `gqlComment` cấp 1 không khớp doc mới**) · 06 hoàn van kết bạn + `--capture` · 05c/05b trả lời bình luận DOM theo focus · 05 giải mã uid + `checkReplies`.

### 5.3 Engine / Cloud Functions (asia-southeast1)
- `outreachTick` (5′, maxInstances 1, 512Mi; LỆNH #37 07/09 = bản mới nhất: func-path gate ma trận) · `genContent` (rev `gencontent-00007-yav`, LỆNH #32) · `funcWebhook` · `saveFbAccount/deleteFbAccount` · `setUserLock` · `pushOnLead` + `pushDueFollowups` · `statsOnLead` (LỆNH #42 09/09 = bản mới nhất: bộ đếm bỏ vai người bán/chủ bài, `slaN/slaOk`, `content_stats`) · `scanStatsOnRun` (LỆNH #39) · `scheduledScan` (rev `scheduledscan-00070-waj`, LỆNH #32; timeout 1800, gieo/gặt bài + comment v-sow/v-sowc, bdwatch, cổng vai #31b) · `manualScan` · `assistantChat/assistantLogs` (config/private).
- Backup code trên Cloud Shell: mỗi file giữ 1 `.bak-<ts>` mới nhất (LỆNH #36c đã dọn); script chẩn đoán `_l3x_*.mjs`, `_l4x_*.mjs` để nguyên trong `functions/`.
- **Firestore**: Rules có block cho `leads` (whitelist 31 field non-super), `users`, `brands`, `config` (private chỉ super), `notes` CG, `fb_accounts`, `workers`, `worker_config`, `outreach_log/stats`, `daily_stats`, `content_stats`, `system_status`, `stage_log`, `audit_log`. Index đủ (leads brand+phone+detected_at, outreach_tasks workerId+status+createdAt, outreach_threads pid+active+nextAt, outreach_log brandCode+at & status+at, notes CG ×4). TTL `outreach_log.expireAt` ACTIVE. Backup hằng ngày giữ 7 ngày.
- **Quét**: 23 nguồn / 4 brand (test-agency, hscl-01, z15mrc-tts-1, z15mrc-tuyendung1); lượt 3–100 s; `system_status/brightdata.ok=true` (sự cố 502 ngày 10/09 17:28→17:31 VN tự hồi — `docs/lenh-2026-09-10-bd502.md`).

### 5.4 Số thật automation (LỆNH #43/#43b, 10/09) — nền cho Đợt 1
hscl-01 BẬT + ⚡ngay + van 100/100/30/30 nhưng 0 nick sống; 12 thread active kẹt 5–10 ngày; task 156 (done 100 · failed 49 · paused 7); log 7 ngày: comment vào bài done 23 / fail 105 (**20/20 lead fail = bài group gid số; 9/9 bài group slug OK**), "tạm hoãn nick cần đăng nhập lại" 160; lead máy chạm 43, inbox 4, phản hồi 1 (máy phát hiện 0); backlog 133/261 lead chưa có thread (32 nóng). Chi tiết + 53 phát hiện + 15 đề xuất: `docs/rasoat-automation-2026-09-10/` (artifact bản 4 https://claude.ai/code/artifact/85bfaa3e-b299-46ba-a92b-1f3878c571cf).

## 6. Cách phiên mới KHỞI ĐỘNG hiệu quả
**Bước 1 — nạp ngữ cảnh:** đọc `CLAUDE.md` (toàn bộ) + `HANDOFF.md`; khi làm automation đọc thêm `docs/rasoat-automation-2026-09-10/findings.json` + `docs/lenh-2026-09-10-43.md`/`43b.md` (phần KẾT QUẢ).

**Bước 2 — nạp code thật:** giải nén zip FE (cả 2 cây nếu cần build song song) vào thư mục làm việc; đặt `worker.mjs` + `config.json` vào thư mục worker; `npm i playwright-core esbuild eslint`.

**Bước 3 — (khi đụng backend) dump engine từ Cloud Shell** (pattern chuẩn: chỉ đọc, che chuỗi dài, in số dòng):
```bash
cd ~/firebase-s13/functions
echo "=== FILES ===" && ls -la
echo "=== outreach.js ===" && wc -l outreach.js && grep -n "^export\|^async function\|^function\|^const [A-Z_]* =" outreach.js
echo "=== index.js exports ===" && grep -n "^export" index.js
echo "=== deployed ===" && gcloud functions list --project=smartlead-z15 --format="table(name,state,updateTime)" 2>/dev/null | head -30
```
Cần thân hàm cụ thể → dump theo mốc `sed -n 'a,bp'` như `docs/lenh-2026-09-10-43.md` (b). **Quy tắc LỆNH**: script Admin SDK đặt TRONG `functions/`; chuỗi lệnh dài ghi vào `/tmp/xxx.sh` qua heredoc `<<'EOF'` rồi `bash /tmp/xxx.sh`; không có `!` ngoài heredoc; patch theo mốc nội dung, fail-closed, idempotent (marker `LENH #NN`), backup `.bak-<ts>`, `node --check` + import test `.env` trước deploy, deploy xích `&&`; anh dán output → em check.

**Bước 4 — FE: build + smoke trước khi gửi zip (cả 2 cây):**
```bash
cd <cây smartlead>
node tools/build.mjs --zip /tmp/smartleads17deploy-<tên>.zip
NODE_PATH=<nơi có node_modules> node tools/smoke.js   # PASS hết mới gửi
```
Mọi thay đổi `live.js` kiểm thêm bằng harness stub SDK (`docs/harness-boot-stub-2026-09-05.mjs`, `docs/harness-boot-timeline-2026-09-08.mjs`) vì smoke chạy demo offline.

**Câu mở đầu mẫu để dán vào phiên mới** (cũng có trong `README-START.txt` của gói bàn giao):
> Em là Claude Code tiếp tục dự án SmartLead (Z15 Miracle) của anh Vinh. Đọc hết `CLAUDE.md` + `HANDOFF.md` để nạp ngữ cảnh và "gu" làm việc; cần soạn LỆNH/patch thì tham khảo pattern trong `docs/lenh-*.md` và `docs/fe-2026-09-07-v119-61/README.md`. Anh đính kèm: zip frontend mới nhất `smartleads17deploy-v119-87.zip` (+ bản ESM `v120-esm-ak`), `worker.mjs` 2026-09-06d, `config.json`. Quy tắc: trả lời tiếng Việt, xưng em/anh; FE giao bằng zip mới (build + smoke PASS cả 2 cây); backend chỉ soạn LỆNH bash để anh dán Cloud Shell; worker giao file; không bao giờ đưa secret vào chat/git/zip; chỉ làm việc đã chốt. Việc đang treo: xem HANDOFF.md mục 6b — bắt đầu từ việc số 1 (chốt Đợt 1 automation).

## 6b. Việc đang treo lúc bàn giao (11/09/2026) — theo thứ tự ưu tiên
1. **Chốt Đợt 1 automation** (mục ★ RÀ SOÁT AUTOMATION 10/09 trong CLAUDE.md). **Cập nhật 11/09**: gốc W-19 đã xác định từ capture 06/09 (không cần (c)); LỆNH #44a đã chạy; **LỆNH #44 engine ĐÃ CHẠY OK 11/09 11:09 VN + KHỐI 2 PASS 11:29 VN** (`docs/lenh-2026-09-11-44.md` — sweeper expired 11 / orphan 1, hscl-01 0/6 nick sống, ERROR→WARNING đúng, BrightData sập 3′ 10/09 đã hồi); còn worker 2026-09-11 + zip FE nhỏ chờ anh gật. (Trước đó chờ 3 bằng chứng từ VPS: (a) đếm bình luận của nick t7 trên bài của 2 lead `zt4t59NCvZigXs9tlRmF` / `VMjR1TEGGOOtcNIpvJoS` (nghi đăng trùng W-20); (b) 1 ảnh `errors/*__comment_0.png`; (c) `node worker.mjs --capture k1gm6por` rồi tự tay bình luận cấp 1 lên 1 bài group gid SỐ → `capture-<ts>.log` (lấy bộ biến đúng cho R-15). Sau đó làm: **worker 2026-09-10** (R-15 bình luận bài bấm nút "Bình luận" + nhận ô theo focus + dò doc_id lỗi thời · R-9 tách lỗi FB ↔ lỗi giao diện, Safety không trừ vì selector, đếm theo phiên, decay đúng · R-8 ghi tiến độ nguyên tử + SIGINT êm + API mơ hồ kiểm trước DOM · R-2 phiên đọc inbox độc lập + backoff · `dryRun`) + **LỆNH #44 engine** (E-16 due-nick lọc needLogin/safetyPaused · R-6 sweeper thread mồ côi · E-17 `effectiveCaps=min(brand,hardCap)` · R-1 lọc lead có người thật + trigger tắt thread · E-4 reserve lại van khi re-enqueue khác ngày) + **zip FE nhỏ** (F-1 nick realtime · F-2 trần van + lý do Safety · F-6/F-7 tên nick + chip "BẬT nhưng 0/N nick"). Trước đó: đưa van hscl-01 về Cân bằng 40/12/10/8; sau khi worker mới chạy mới bấm "✓ Đã xử lý" cho t7.)
2. **Deploy zip v119-87** (Cmd+Shift+R) rồi bản riêng `v120-esm-ak`; hỏi anh bố cục ROI super mới có ưng không.
3. **4 nick needLogin** → đăng nhập lại trên AdsPower + "✓ Đã xử lý" (hoặc `node _l34_move.mjs --dry` rồi áp để chuyển thread sang nick sống) — làm SAU khi có worker mới.
4. Tuỳ chọn: bdwatch debounce 2 lượt (giảm mail 502 thoáng qua); Close alert cũ trong GCP; `node _l36_junk.mjs --delete` (1 lead rác); LỆNH #30c regen thread cũ; `_l31_fix.mjs --rescore`; regenerate 2 func token + webhook secret.
5. Nghiệm thu còn thiếu: comment-lead API nội bộ trên lead thật (`react-comment API: OK` / `reply API: OK`); card "Hiệu quả nội dung" lên số khi `content_stats.all.sent>0`; `checkReplies` phát hiện phản hồi thật (hiện `replyFound 0`); push FCM trên điện thoại.
6. Đề xuất chưa làm (chỉ khi anh gọi): kiến thức brand có số / follow-up lần 2 sau 24–48 h / CTA xin Zalo (nội dung); lịch sử phí gói theo tháng + cảnh báo gói hết hạn vào Hộp việc (ROI); brand-admin tự quản automation (mở Rules).

## 7. Quy trình & "gu" (chi tiết trong CLAUDE.md — nhắc nhanh)
- Trả lời **tiếng Việt**, xưng **em** / gọi **anh**; thuật ngữ kỹ thuật giữ English. Chỉ implement việc đã **chốt**; thay đổi thẩm mỹ toàn cục → chụp trước/sau + hỏi anh trước.
- **FE** = sửa `src/app/*.js` + `live.js` qua script `mNN.py` fail-closed áp cho **cả 2 cây** → build → smoke PASS → **gửi 1 zip mới** ("zip MỚI NHẤT cần deploy") → anh kéo-thả Netlify → Cmd+Shift+R.
- **Backend** = **soạn LỆNH bash** cho anh dán vào Cloud Shell → anh chạy → dán output → em check. Không tự đụng, không gửi file backend.
- **Worker** = giao file `.mjs` (+ harness PASS), anh chép đè VPS + chạy lại `run.bat`. Không đụng SA key/kiến trúc worker nếu chưa bàn.
- `?v=` tự hash trong build (đừng bump tay). eslint chạy trong build (lỗi = dừng). Mọi bản FE ghi vào CLAUDE.md ("Zip mới nhất" + TRẠNG THÁI) + README `docs/fe-2026-09-07-v119-61/` + commit/push nhánh `claude/chao-ban-8d6f9r`.
- Automation: **van an toàn nick** theo ngày · **verify kết quả thật** (không tin HTTP 200) · **fail-closed** (thà bỏ lỡ còn hơn thao tác nhầm/bay nick) · checkpoint = tín hiệu DỪNG, không né · nick FB phải để Tiếng Việt.

## 8. Bẫy đã gặp (đọc trước khi soạn LỆNH/patch)
- Cloud Shell bash tương tác history-expand `!` kể cả trong `"…"` → chuỗi lệnh dài ghi `.sh` qua heredoc quoted rồi `bash file.sh`; grep `!` ngoài heredoc = 0 trước khi gửi.
- Script `firebase-admin` để ở `/tmp` → `Cannot find package` → luôn đặt trong `~/firebase-s13/functions`.
- Deploy không xích `&&` sau patch → patch fail vẫn deploy code cũ (LỆNH #20). Mốc patch chọn `{` SAU `)` đóng tham số (default param `opts = {}` làm hụt thân hàm).
- `initializeApp()` top-level ở module mới → Firebase CLI "codebase could not be analyzed" → khởi tạo lười trong handler.
- Function deploy thiếu `region:'asia-southeast1'` → vào us-central1 → FE "Failed to fetch".
- `String.replace` chuỗi thay thế có `` $` `` / `$&` → dùng hàm `()=>b` (CLAUDE.md từng bị nhân đôi).
- Smoke chạy demo offline → thay đổi `live.js` phải kiểm bằng harness stub SDK; kiểm âm (chạy check mới trên cây cũ phải FAIL) trước khi tin check mới.
- Đổi thẩm mỹ toàn cục theo "chuẩn design-system" bị anh chê (v119-61) → gu đã chốt thắng chuẩn.
- Nhận diện ô soạn FB bằng nhãn sai (bài và trả lời dùng chung nhãn) → tín hiệu tin cậy = focus ngay sau cú bấm + node mới + vị trí DOM.
- Safety Score cộng lỗi selector của mình như FB phạt → nick khoẻ tự tắt (W-18) — sửa ở Đợt 1.
