# HANDOFF.md — Gói bàn giao để tiếp tục SmartLead ở phiên/gói Claude Code khác

> Đọc file này + `CLAUDE.md` là đủ để một phiên Claude Code MỚI (gói khác, máy khác, vẫn của anh Vinh) tiếp tục làm việc đúng "gu" mà không mất ngữ cảnh.
> **TUYỆT ĐỐI không đưa secret (token/API key/mật khẩu/IP) vào file này, vào git, vào zip, vào chat.**

## 0. TL;DR (đọc 20 giây)
- **`CLAUDE.md` = bộ nhớ toàn dự án** (bắt buộc). Nó đi theo git repo `xvdesign68-jpg/tdm1`. Phiên mới nối cùng repo → tự có; không thì anh copy tay.
- **Code app THẬT KHÔNG nằm trong git.** Frontend + worker mới nhất nằm ở *scratchpad của phiên cũ (ephemeral, mất khi đổi phiên)* + máy anh + VPS + Cloud Shell. ⇒ Anh phải **đưa lại 2 file** cho phiên mới: (1) **zip frontend mới nhất**, (2) **worker.mjs mới nhất**.
- **Secret KHÔNG bao giờ qua chat.** Chúng nằm ở Secret Manager / functions/.env / VPS. Phiên mới chỉ cần biết *chúng ở đâu*, không cần giá trị.

## 1. Bản đồ "cái gì ở đâu"
| Thành phần | Nơi ở THẬT | Có trong git tdm1? | Phiên mới lấy bằng cách |
|---|---|---|---|
| Bộ nhớ dự án (`CLAUDE.md` + `HANDOFF.md`) | git repo `xvdesign68-jpg/tdm1` | ✅ CÓ | Tự có nếu nối cùng repo; không thì copy 2 file |
| **Frontend SmartLead** (app.html, `src/app/*.js`, `assets/js/live.js`, `assets/css/*`, `tools/build.mjs`, `tools/smoke.js`, eslint, _redirects…) | Máy anh (source gốc) + **zip khứ hồi** (zip CHỨA nguyên source) | ❌ KHÔNG | Anh đưa **zip mới nhất**, phiên mới giải nén vào thư mục làm việc |
| **Worker AdsPower** (`worker.mjs`, `config.json`, `run.bat`, `capture.mjs`, `install-autostart.bat`) | Trên VPS Windows + file đã gửi anh | ❌ KHÔNG | Anh đưa lại **worker.mjs 2026-09-03** (+ config.json) |
| **Engine backend** (`outreach.js`, `fbaccounts.js`, `index.js`, `firestore.rules`, `.env`) | Cloud Shell `~/firebase-s13/functions` | ❌ KHÔNG | Phiên mới **dump qua LỆNH** (xem §6) — không cần gửi file |
| Secrets (func token, OPENAI_API_KEY, FUNC_WEBHOOK_SECRET, serviceAccount.json, BrightData/Telegram) | Secret Manager / functions/.env / VPS | ❌ KHÔNG (đúng) | Không cần — phiên mới chỉ thao tác *tham chiếu* |

> ⚠ **Lưu ý repo tdm1 có rác cũ:** `index.html`, `css/styles.css`, `js/main.js`, `fb-worker/*` trong repo là **scaffold v0.1 CŨ / không dùng** — KHÔNG phải app thật. App thật = zip frontend; worker thật = `worker.mjs` (không phải `fb-worker/worker.js`).

## 2. File anh cần chuẩn bị đưa cho phiên mới (checklist)
1. ☐ **`CLAUDE.md`** — nếu phiên mới không cùng repo, copy file này.
2. ☐ **`HANDOFF.md`** — file này.
3. ☐ **Zip frontend MỚI NHẤT** = `smartleads17deploy-v119-43.zip` (đã gửi anh 04/09 — v119-42 (việc nhỏ + Đợt 3 FE) + PWA/sw.js/manifest + thanh tab dưới + push FCM FE + badge Safety Score). Worker mới nhất `worker.mjs 2026-09-04b`. Đây là snapshot source đầy đủ, phiên mới giải nén ra là sửa được ngay.
4. ☐ **`worker.mjs` bản `2026-09-04`** (đã gửi anh 03/09) — nếu định sửa worker.
5. ☐ (tuỳ) **`config.json`** của worker (có `graphql.reactDocId/commentDocId/friendDocId/friendDocId` — KHÔNG phải secret) — để phiên mới biết doc_id hiện tại.
6. ☐ (tuỳ) Ảnh `errors/*.png` trên VPS nếu đang debug selector.

Sau khi giải nén zip: phiên mới cài 1 lần `npm i playwright-core` (Chromium sẵn ở `/opt/pw-browsers` trên môi trường web) để chạy smoke test.

## 3. Thông tin hạ tầng / tài khoản (không phải secret)
- **Super Admin:** xuanvinhsc68.work@gmail.com
- **Firebase/GCP project:** `smartlead-z15` · **Region functions:** `asia-southeast1` (BẮT BUỘC mọi function)
- **Cloud Shell:** account `xuanvinh.marketingpartners` · thư mục chính `~/firebase-s13` (Rules + engine); phụ `~/codebase2` (Sheet sync), `~/smartlead-zalo-fn` (Zalo)
- **Netlify site (deploy FE):** `smartlead.z15miracle.com.vn` (kéo-thả zip; nhắc Cmd+Shift+R / Ctrl+F5)
- **func.vn:** account_pid FB User = `fbu100013727043931` (nằm trên URL, không phải secret)
- **AdsPower:** Local API `http://local.adspower.net:50325` trên VPS Windows (proxy dân cư)
- **Nguồn lead:** BrightData / Apify FB Groups Scraper
- **funcWebhook URL:** `https://asia-southeast1-smartlead-z15.cloudfunctions.net/funcWebhook` (Cloud Run: `https://funcwebhook-ljvdphb2ja-as.a.run.app`)

## 4. Secrets — CHỈ vị trí, KHÔNG giá trị
| Secret | Nơi lưu | Ghi chú |
|---|---|---|
| func Account Token (mỗi nick) | Secret Manager `func-token-<pid>` | CF đọc runtime; FE chỉ gọi `SL_FB.*` |
| OPENAI_API_KEY | `~/firebase-s13/functions/.env` | engine `aiText()` |
| FUNC_WEBHOOK_SECRET | `~/firebase-s13/functions/.env` | verify webhook func |
| serviceAccount.json | trên VPS (cạnh worker.mjs) | worker đọc/ghi Firestore (Admin SDK) |
| BrightData / Telegram | backend | scan/notify |
| Firebase web apiKey | công khai trong FE | **KHÔNG phải secret** (hợp lệ) |

> ⚠ **Cần làm:** anh đã lỡ dán **2 func token + 1 webhook secret** vào chat trước đây → **regenerate** cả 3 khi rảnh.

## 5. Trạng thái deploy hiện tại (tính đến 03/09/2026)
- **FE:** zip mới nhất cần deploy = **v119-43** (worker 2026-09-04b chép đè mọi VPS; LỆNH #7–#11 backend ĐÃ CHẠY XONG 04/09 — config/private, Rules whitelist+audit_log, index notes, backup+alert, setUserLock, push CF; còn thiếu VAPID public key để bật push FE). Trước đó v119-42 (backend đi kèm: LỆNH #7–#10 chưa chạy → khoá tài khoản tạm là khoá mềm, audit_log ghi nhưng chưa đọc được, notes fallback không giới hạn, config/private chưa tách). Trước đó v119-41b (Đợt 1: số thật, Hôm nay, Hộp việc, Gọi·Zalo·SMS, tìm SĐT, chốt/không thành, modal mới, pipeline mobile, lead cũ realtime, Dừng tất cả).
- **Worker:** bản **2026-09-04** (chép đè MỌI VPS + restart): gate/van tầng 2/lỗi hạ tầng/newline/log status/stamp lead/đọc phản hồi (tắt mặc định).
- **Engine (asia-southeast1, đã deploy):** `outreachTick` (tick song song p-limit, maxInstances:1, RAM 512Mi; 04/09: dùng `genForLead` từ `content.js` cho comment/inbox riêng theo brand.content), `genContent` (Content Studio "Sinh thử"), `funcWebhook`, `fbaccounts` (saveFbAccount/deleteFbAccount), `manualScan`… + comment-lead (`commentIdOf`/`commentUrlOf` + payload `kind:'comment'`).
- **Firestore:** Rules cho `outreach_log`/`outreach_stats`/`workers`/`worker_config`/`fb_accounts`/`brands` đã có. TTL `outreach_log.expireAt` = **ACTIVE** (xoá log >60 ngày). Index: `leads(brand,phone,detected_at desc)`=CICAgJjFqZMK (tìm SĐT, v119-40d); `outreach_tasks(workerId,status,createdAt)`=CICAgNiroIEK; `outreach_threads(pid,active,nextAt)`; `outreach_log(brandCode,at)`; `leads(brand,detected_at)`; `notes` collectionGroup (brand/vis/by_uid).
- **Đã qua 3 lượt rà đối kháng** (v119-36, GA#1 v119-38, GA#2 v119-39) — nền chắc để mở cho khách.
- **03/09/2026 — rà soát toàn diện "siêu giải pháp" (chỉ đánh giá, 0 dòng code sửa):** artifact "Bản đồ nâng cấp SmartLead" + mục mới trong CLAUDE.md (scorecard 6,9/10, 13 lỗi cao đã verify, lộ trình 3 đợt 54 đề xuất, 8 câu hỏi chờ anh chốt). Anh đã chốt 8 câu → **Đợt 1 đã làm xong** (mục v119-40-dot1 trong CLAUDE.md). Đợt 2 FE đã xong (v119-41-dot2); backend Đợt 2 ĐÃ DEPLOY (LỆNH #4: content.js + genContent + engine dùng brand.content; bản tin sáng ZBS đã BỎ theo anh) — xem mục v119-41-dot2 trong CLAUDE.md.
- **Đang chờ NGHIỆM THU thật:** luồng **comment-lead** (lead là 1 bình luận → tym + reply đúng comment) trên 1 lead-comment thật; van/KPI **Kết bạn** trên thẻ brand. Còn tồn không-chặn-GA: zombie chưa cancel cứng (rất hiếm), `findCommentEl` fail-closed (sai chỉ là bỏ lỡ, không nhầm chỗ) — chi tiết ở mục v119-39 trong CLAUDE.md.

## 6. Cách phiên mới KHỞI ĐỘNG hiệu quả
**Bước 1 — nạp ngữ cảnh:** đọc `CLAUDE.md` (toàn bộ) + `HANDOFF.md` (file này).

**Bước 2 — nạp code thật:** giải nén zip frontend vào thư mục làm việc; đặt `worker.mjs` vào thư mục worker.

**Bước 3 — (khi cần đụng backend) dump engine hiện tại từ Cloud Shell.** Dán LỆNH này để lấy snapshot:
```bash
cd ~/firebase-s13/functions
echo "=== FILES ===" && ls -la
echo "=== outreach.js (đầu 40 dòng + đếm dòng) ===" && wc -l outreach.js && head -40 outreach.js
echo "=== index.js exports ===" && grep -n "export" index.js
echo "=== deployed functions ===" && gcloud functions list --project=smartlead-z15 --format="table(name,state,updateTime)" 2>/dev/null | head -30
```
Cần đoạn cụ thể (vd `stepNickAdspower`/`apEnqueueFunnel`) thì dump theo mốc như các LỆNH DUMP đã dùng trong lịch sử (xem CLAUDE.md mục v120-scale / comment-lead).

**Bước 4 — verify FE trước khi sửa:**
```bash
cd <thư mục smartlead>
npm i playwright-core            # 1 lần
node tools/build.mjs --zip /tmp/smartleads17deploy-<tên>.zip
NODE_PATH=<nơi có node_modules> node tools/smoke.js   # PASS hết mới gửi
```

**Câu mở đầu mẫu để paste vào phiên mới:**
> "Em là Claude Code tiếp tục dự án SmartLead của anh Vinh. Đọc `CLAUDE.md` + `HANDOFF.md` để nạp ngữ cảnh. Anh đã đính kèm zip frontend mới nhất (v119-39-ga-round2) + worker.mjs (2026-09-03). Trả lời tiếng Việt, xưng em/anh. Giữ đúng quy trình: FE giao bằng zip, backend giao bằng LỆNH Cloud Shell, không đưa secret vào git/zip/chat. Việc đang chờ: nghiệm thu luồng comment-lead."

## 7. Quy trình & "gu" (chi tiết trong CLAUDE.md — nhắc nhanh)
- Trả lời **tiếng Việt**, xưng **em** / gọi **anh**; thuật ngữ kỹ thuật giữ English.
- **FE** = sửa `src/app/*.js` + `live.js` → build → smoke PASS → **gửi 1 zip mới** (nói rõ "zip MỚI NHẤT cần deploy") → anh kéo-thả Netlify.
- **Backend** = **soạn LỆNH bash** cho anh dán vào Cloud Shell → anh chạy → dán output → em check. Không tự đụng, không gửi file backend.
- **Worker** = giao file `.mjs`, anh chép đè VPS.
- `?v=` tự hash trong build (đừng bump tay). eslint chạy trong build (lỗi = dừng).
- Mọi thay đổi automation: nhớ **van an toàn nick** (react/comment/friend/inbox theo ngày), **verify kết quả thật** (không tin HTTP 200), **fail-closed** khi không chắc (thà bỏ lỡ còn hơn thao tác nhầm/bay nick).
