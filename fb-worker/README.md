# SmartLead FB Worker

Điều khiển **Facebook User (nick cá nhân)** qua **AdsPower** để **thả cảm xúc / bình luận / inbox** lead — chạy trên **VPS của anh**. Nick + cookie **nằm nguyên trong AdsPower trên VPS**, SmartLead chỉ ra lệnh.

```
SmartLead ──(tạo task)──▶ Firestore `outreach_tasks`
                                  │
                 worker.js (VPS) ─┤ đọc task
                                  ├─▶ AdsPower Local API  (bật profile → CDP endpoint)
                                  ├─▶ Puppeteer bám vào Chrome đã login FB (proxy sẵn trong profile)
                                  ├─▶ react / comment / inbox
                                  └─▶ ghi kết quả về Firestore → UI SmartLead realtime
```

> ⚠️ **Nói thẳng:** FB đổi giao diện liên tục nên selector có thể phải chỉnh (gom hết ở `src/fb.js`, phần `L = {...}`). Đây là bản **v0.1 để anh chạy test & hiệu chỉnh trên VPS thật** — em chưa test được selector từ phía em (không có AdsPower/FB ở đây). Chạy `--dry` trước, rồi mình soi log chỉnh dần.
> ⚠️ **Rủi ro bay nick theo HÀNH VI**, không phải theo tool. Van an toàn (`src/safety.js`) là lớp bảo vệ chính — để mức thấp, tăng dần. Inbox người lạ là rủi ro cao nhất.

---

## 1. Chuẩn bị trên VPS

**Node.js ≥ 18** (có sẵn `fetch`). Kiểm tra: `node -v`.

**AdsPower** cài trên VPS, đã tạo profile, **mỗi profile đã đăng nhập 1 nick FB + gắn proxy dân cư**.
Bật API: **AdsPower → Setting → Local API → Enable** (mặc định `http://local.adspower.net:50325`).

- **VPS Windows**: chạy AdsPower bình thường (có giao diện). Để `ADSPOWER_HEADLESS=0`.
- **VPS Linux**: AdsPower cần môi trường đồ hoạ. Chạy headless kèm `xvfb`:
  `xvfb-run -a node test.js ...` và đặt `ADSPOWER_HEADLESS=1`.

## 2. Cài worker

```bash
cd fb-worker
npm install            # cài puppeteer-core (KHÔNG tải Chromium — mình bám vào Chrome của AdsPower)
cp .env.example .env   # rồi mở .env chỉnh nếu cần (đều có mặc định an toàn)
```

## 3. Test NGAY (không cần Firebase)

```bash
# a) Liệt kê profile để lấy user_id
node test.js list

# b) Kiểm tra nick khoẻ/đăng nhập chưa (chỉ mở FB, không làm gì)
node test.js open --profile <USER_ID>

# c) Chạy thử KHÔNG gửi (khuyên làm trước)
node test.js react   --profile <USER_ID> --url "<POST_URL>" --dry
node test.js inbox   --profile <USER_ID> --uid "<UID_hoặc_PROFILE_URL>" --dry

# d) Làm thật
node test.js react   --profile <USER_ID> --url "<POST_URL>" --reaction love
node test.js comment --profile <USER_ID> --url "<POST_URL>" --text "Bài hữu ích quá ạ 👍"
node test.js inbox   --profile <USER_ID> --uid "<UID_hoặc_PROFILE_URL>" --text "Chào anh/chị, em thấy bài của mình..."

# e) Xem đã dùng bao nhiêu hôm nay (van an toàn)
node test.js usage --profile <USER_ID>
```

`--reaction`: `like | love | care | haha | wow | sad | angry`.
`--uid`: UID số, username, hoặc URL profile — worker tự đổi sang `facebook.com/messages/t/...`.

## 4. Chế độ tự động (worker đọc hàng đợi Firestore)

Chỉ cần khi nối với SmartLead. Đặt trong `.env`:
```
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json   # file service account Firebase (KHÔNG commit)
```
Cài SDK & chạy:
```bash
npm i firebase-admin
node worker.js
```
SmartLead (Cloud Function) tạo document vào `outreach_tasks`:
```json
{
  "channel": "fb",
  "action": "inbox",
  "profile_id": "<adspower user_id>",
  "target": "<uid | profile url | post url>",
  "text": "Chào anh/chị...",
  "reaction": "love",
  "status": "pending",
  "lead_id": "<id lead SmartLead, tuỳ chọn>",
  "createdAt": "<serverTimestamp>"
}
```
Worker nhặt → chạy → cập nhật `status: done|failed|skipped` + `result`.
*(Cần composite index `(channel ASC, status ASC, createdAt ASC)` — Firestore sẽ báo link tạo ngay trong log lỗi lần đầu.)*

## 5. Lead từ BrightData → task

BrightData FB scraper thường trả mỗi lead: **link/UID người đăng** + **link bài viết (post URL)**. Map:
- `react` / `comment` → `target` = **post URL**.
- `inbox` → `target` = **UID / profile URL** người đăng.

Phần tạo task từ lead sẽ nằm ở Cloud Function `sendFunc`/SmartLead (đợt sau). Giờ cứ test tay bằng `test.js` với URL/UID thật.

## 6. Van an toàn (chỉnh trong `.env`)

| Biến | Ý nghĩa | Gợi ý khởi đầu |
|---|---|---|
| `DAILY_CAP_REACT` | thả cảm xúc / nick / ngày | 80 |
| `DAILY_CAP_COMMENT` | bình luận / nick / ngày | 25 |
| `DAILY_CAP_INBOX` | **inbox / nick / ngày** | **15** (thấp — rủi ro cao nhất) |
| `MIN_GAP_SEC` | cách tối thiểu giữa 2 thao tác | 45 |
| `ACTIVE_HOURS` | khung giờ chạy (giờ VPS) | 8-22 |

Nick mới hoặc mới "nuôi" → để **thấp hơn** rồi tăng dần theo ngày.

---

## Lưu ý pháp lý & ToS
Tự động hoá nick cá nhân là **vi phạm điều khoản Facebook** (rủi ro khoá nick do anh chịu) và dữ liệu lead cần tuân **Nghị định 13/2023** (có cơ sở liên hệ hợp lệ, tin mở đầu tôn trọng + có cách từ chối/opt-out, giữ log). Dùng đúng mực, giãn nhịp, nội dung đa dạng.
