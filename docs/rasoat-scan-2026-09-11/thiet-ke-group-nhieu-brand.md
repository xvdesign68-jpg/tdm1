# Thiết kế: 1 group Facebook phục vụ NHIỀU brand (câu 4 → hướng B) + kế hoạch "tốc độ" (câu 5)

> Bản nháp 12/09/2026 để 3 agent phản biện rồi chốt với anh. Chưa sửa code. Mọi mốc code lấy từ fixture
> `docs/lenh-2026-09-11-46-fixture/index.js` (dựng lại từ dump #20 + patch #21/#23/#31/#46) và FE v119-89 (`src/app/*`, `assets/js/live.js`).
> Anh chốt 12/09: câu 4 = **B** (không bỏ khách; trùng group thì super phải được báo, nhưng vẫn làm theo ý khách); câu 5 = **không bỏ lỡ lead nào, đẩy lead về nhanh nhất**.

## 0. Hiện trạng (vì sao hôm nay không làm được B)

| Chỗ | Code | Hệ quả |
|---|---|---|
| Nguồn | `sources/{gid}` — doc id = group id (50-config-views:131, wizard:164); mỗi doc 1 `brand` | cùng group không thể thuộc 2 brand (id đụng) |
| Nối brand | `brandBySource[s.name]` (index.js:29), `srcByGroup[gid] = s.name` (:30), `recordPost.brand` theo tên (:123), birthstamp `brandBySource[lead.source]` (:394) | khoá = TÊN nguồn, 1 group → 1 tên → 1 brand |
| Chống trùng | `seen/{post_id}` toàn cục, ghi ở Pha 2 TRƯỚC quyết định (:315–320); probe đếm `leadingNew` bằng `seen` (:212) | 1 bài chỉ được xử lý 1 lần cho toàn hệ thống |
| Gieo/gặt | `group_state/{url}` (recentIds, lastTriggerAt, lastSweepAt), `pending_snapshots/P_<url>` theo URL nguồn | trạng thái theo URL → dùng chung được |
| Bình luận | `ctx` Map urlKey → 1 {effSrc, src, row} (:236–241); harvest `srcOf(meta.srcUrl)` → 1 nguồn | 1 bài cha → 1 ngữ cảnh brand |
| Lead | `commitLeadNow` id ngẫu nhiên, multitouch `identityKey = author_url/phone/email` (không brand) (:371–381) | gộp chéo brand nếu cùng người |
| FE | brand user subscribe `sources where brand==` (live.js:944), `scanned_posts where brand==` (:1067); `buildData` gom lead theo `s.name` (10-core:149–151) | 2 nguồn cùng tên → đếm lead lẫn |
| Automation | thread theo `leadId`, nick theo brand; `outreach_map/{uid}` theo người | 2 brand → 2 nick có thể cùng chạm 1 bài / 1 người |

## 1. Nguyên tắc thiết kế B

1. **BrightData lấy 1 lần / group** (không nhân tiền): gieo/gặt theo `gid`, fan-out bài cho từng brand sau khi gặt.
2. **Mỗi brand tự chấm bằng Hồ sơ AI của mình** → lead riêng, điểm riêng, gợi ý riêng (đúng nghĩa "làm theo ý khách"). Chi phí AI nhân theo số brand *dùng chung group đó* (không phải toàn hệ).
3. **Tenancy giữ nguyên**: brand user chỉ thấy doc của brand mình (sources/leads/scanned_posts có `brand`); không lộ tên brand khác. Chỉ super thấy "dùng chung".
4. **Automation: 1 bài / 1 người chỉ 1 brand chạm** (khoá tranh chấp), brand còn lại chăm tay. Không bao giờ 2 nick cùng react/comment/inbox 1 bài.
5. **Super được báo mặc định** khi group bắt đầu dùng chung (push + Cảnh báo hệ thống + Hộp việc + dòng trong Nguồn quét), có số liệu để quyết (group đó đang cho brand kia bao nhiêu lead/tuần).
6. Mọi thay đổi **thêm field, không đổi nghĩa field cũ**; nguồn/lead hiện có không cần migrate.

## 2. Mô hình dữ liệu

### 2.1 `sources`
- Doc id MỚI = `<gid>__<brand>` khi group đã có nguồn ở brand khác; nguồn đầu tiên giữ id `<gid>` (không migrate 23 nguồn hiện có).
- Field thêm: `gid` (chuỗi group id chuẩn hoá — backend + FE dùng khoá này thay tên), `sharedAt`, `sharedBy` (uid người thêm nguồn thứ 2+).
- Cùng brand + cùng gid → **chặn** (trùng thật). Khác brand + cùng gid → **cho phép** + luồng thông báo §5. Trùng TÊN (fold không dấu) trong cùng brand → chặn (PB-12(3)).

### 2.2 `group_state/{urlKey}` (dùng chung theo group, không đổi)
- Giữ `recentIds/lastTriggerAt/lastSweepAt`; thêm `brands: [..]` (để sweeper/harvest biết fan-out) và `rate/deadStreak/lastPostAt` (§7).

### 2.3 `seen/{post_id}` → thêm map `brands`
- `{ at, brands: { 'hscl-01': 'lead'|'low'|'pre'|'ex'|'self'|'pending', 'tts-1': … }, expireAt }`.
- Quy tắc: bài **đã lấy về** = có doc (probe `leadingNew` vẫn đúng). Bài **đã xử lý cho brand X** = `brands[X]` khác `pending`.
- Pha 2 cho bài của group dùng chung: với mỗi brand trong `group_state.brands` chưa có `brands[X]` → tạo ứng viên riêng `{post, effSrc_X, src_X, row_X}`; ghi `brands[X]='pending'` (đi cùng PB-2(d)/PB-1: staging thay vì "ghi trước rồi quên").
- Brand mới **tham gia sau**: bài cũ không quay lại vì `posts_to_not_include` → chỉ nhận bài mới từ lúc tham gia; muốn bù thì bấm "Quét thử nguồn này" (backfill 7 ngày, `force` không cần vì `seen.brands[X]` trống → được chấm).

### 2.4 `scanned_posts`
- Doc id tự động (không đổi) → mỗi brand 1 dòng với `brand` của mình + `gid` + `source_id`. Bài đã quét theo brand vẫn lọc `where brand==` như cũ. (PB-9 muốn id tất định → dùng `SP_<post_id>__<brand>`.)

### 2.5 `leads`
- Mỗi brand 1 lead doc (điểm/reply/temp theo Hồ sơ AI của brand). Field thêm: `gid`, `source_id`, `shared_post: true`, `siblings: { '<brand>': '<leadId>' }` (ghi 2 chiều sau khi cả 2 commit; brand user KHÔNG đọc được lead brand khác nên chỉ super dùng), `shared_note` (số brand cùng có).
- Multitouch: `identityKey` giữ nguyên nhưng **so khớp trong cùng brand** (`tryMergeTouch(db, lead, {…, brand})` — cần dump `lib/multitouch.js` để đặt mốc; nếu hàm query `leads where identityKey==` thì thêm `where brand==`).
- `brand` ghi ngay trong `ref.set` (đóng luôn N1-2/PB-10).

### 2.6 `system_status/sources` (super đọc, Rules block system_status đã có)
- `{ shared: { '<gid>': { brands: ['hscl-01','tts-1'], since, by, name } }, alerts: [...] }` — nguồn cho Cảnh báo hệ thống + chip "Dùng chung" ở Nguồn quét + Bảng brand.

### 2.7 Khoá tranh chấp automation
- `outreach_locks/{post_<post_id>}` và `outreach_locks/{person_<authorKey>}` = `{ brand, leadId, pid, at, expireAt: +14 ngày }` — Admin SDK (engine/worker), không cần Rules.
- Engine `apEnqueueFunnel`: `runTransaction` tạo lock post (và lock person nếu có author_url/uid). Đã có lock của brand khác → thread `active:false, step:'skipped_shared'`, log `⏭ Bỏ qua — bài/khách này đã được nick brand khác tiếp cận` (status skip), lead vẫn ở feed để sales chăm tay (chip "máy nhường" cho super).
- Ưu tiên khi 2 brand cùng tới hạn 1 tick: `brands/{code}.outreach.priority` (số nhỏ = trước, mặc định 100) → engine sắp nick due theo priority brand rồi mới pace. Không có → brand thêm group trước ("chủ nguồn") thắng.
- Worker `preflight`: kiểm lock trước mỗi bước (chống 2 VPS).

## 3. Thay đổi engine (`index.js` scanAll)

- **Pha 0**: `loadSources()` → `byGid = Map gid → [source...]` (chỉ nguồn `active`); `primary(gid)` = nguồn có `sharedAt` nhỏ nhất/không có (chủ). Ghi `group_state.brands` khi khác.
- **Pha 1**: `mapPool(uniqueGroups)` thay `mapPool(sources)` — gieo/gặt **1 lần / gid** với `src = primary`; `row` (bySource) vẫn **1 dòng / source doc** (để `daily_stats.scanned` theo brand và attribution đúng): bài gặt được → `row_X.posts++` cho mọi brand X; `bdPosts` (tiền) chỉ cộng vào row của primary + `row_X.bdShared = true` (FE ghi "tiền tính ở nguồn chủ"). Sau khi gặt: `collected.push({post, effSrc_X, src_X, row_X})` cho từng brand X (post object **clone** để `x.post.source` = tên nguồn của brand đó; `self_comment` tính 1 lần).
- **Pha 1b**: `ctx` giá trị thành **mảng** ngữ cảnh theo brand; harvest `srcOf(srcUrl)` → danh sách; comment fan-out y hệt bài.
- **Pha 2**: đọc `seen` 1 lần/post; quyết định theo `brands[X]`; ghi `brands[X]='pending'` cùng lô (create/merge).
- **Pha 3a/3b**: không đổi logic, chỉ chạy trên ứng viên đã fan-out (`__brandAiOf(x.effSrc)` đã theo nguồn). Tối ưu: `prefilterLead` **cache theo (post_id, brand)** trong lượt; `scoreLead` luôn riêng.
- **Sau quyết định**: `seen.brands[X] = decision` (đi cùng PB-2(d)); `recordPost` gắn `brand: x.src.brand, gid, source_id` (đóng PB-12(2)).
- **`commitLeadNow`**: `brand` vào set; sau khi 2+ lead cùng post commit trong lượt → ghi `siblings` 2 chiều (best-effort).
- **Sweeper #46 / score_retry**: `sources.find(s => s.name === l.source)` → tìm theo `source_id`/(gid+brand).
- **`__bdProfTrigger`** (quét hồ sơ): 1 lần / uid / lượt (cache) — không nhân.
- **bd_month.src**: cộng theo primary (tiền) + `sharedWith` để ROI chia phí BrightData: mặc định **chia đều theo số brand dùng chung** (super có thể đổi thành "chủ nguồn chịu" ở Giá trị & ROI).

## 4. Thay đổi FE (zip)

- Form Nguồn quét + wizard: tính `gid`; nếu `D.sources` (super: mọi brand; admin brand: chỉ brand mình → server kiểm lại) có gid ở brand **khác** → hộp thoại "Group này đang được brand X quét (N lead/7 ngày). Vẫn thêm cho brand Y? Hai brand sẽ nhận lead riêng; máy tự động chỉ chạm mỗi bài 1 lần." → OK → `setSource('<gid>__<brand>', {..., gid, sharedAt, sharedBy})`. Cùng brand → chặn như cũ. Trùng tên cùng brand → chặn.
- Admin brand thêm nguồn (khi super mở quyền sau này): không thấy tên brand khác, chỉ "nguồn này hệ thống đã quét cho khách khác — lead của bạn vẫn nhận riêng"; server-side CF `sourceOnWrite` là nơi kiểm thật + ghi `system_status/sources` + push super.
- Nguồn quét (super): chip **"Dùng chung · 2 brand"** + tooltip tên brand + link Bảng brand; brand user: không chip.
- Cảnh báo hệ thống (`sysAlertRows`): dòng "Group <tên> giờ được 2 brand quét (A, B) — từ <giờ> bởi <ai>" (sev warn, đi tới Nguồn quét) — đọc `D.sysStatusSources` (subscribe `system_status/sources` super).
- Hộp việc (super): việc "Xem lại group dùng chung" tới khi super bấm "Đã xem" (ghi `system_status/sources.shared[gid].ackAt`).
- Bảng brand: cột Nguồn có "(k dùng chung)"; chi tiết brand liệt kê.
- Modal lead (super): chip "Cũng là lead của brand B" (từ `siblings`) + "máy nhường" khi `outreach.skipped_shared`.
- `buildData` gom lead↔nguồn theo `source_id` rồi mới fallback tên (10-core:149).
- Tiếp cận: log `⏭` hiện nguyên văn; thẻ brand có ô "Ưu tiên khi trùng group" (priority) trong ⚙ cấu hình brand (super).

## 5. Luồng thông báo super (mặc định, không tắt được)

1. FE lúc thêm: hộp thoại xác nhận (super) / thông báo (admin brand) + toast.
2. CF `sourceOnWrite` (onDocumentWritten `sources/{id}`, Admin SDK): phát hiện gid có ≥2 brand → cập nhật `system_status/sources.shared[gid]` (+ `ackAt` xoá khi thêm brand mới) → **push FCM tới mọi super** ("Group X giờ dùng chung: A + B", link `#sources`, `require:'1'`) → console `severity WARNING [SOURCE-SHARED]` (không ERROR để không spam alert #9).
3. Cảnh báo hệ thống + Hộp việc + chip Nguồn quét hiện tới khi super "Đã xem".
4. Tuần: dòng trong `system_status/sources` "brand A và B trùng nhau k lead/7 ngày" (đếm `siblings`) để super thấy mức cạnh tranh.

## 6. Chi phí, rủi ro, rollout

- **Tiền**: BrightData không đổi (1 gieo/group). AI: tầng 1 (gpt-5-nano ~$0,0001/bài) × số brand dùng chung; tầng 2 (gpt-5.6-sol ~$0,004–0,015/bài) chỉ cho bài qua tầng 1 của brand đó → brand khác ngành gần như không tốn thêm; cùng ngành ≈ ×2 trên group đó. Firestore write +1 seen merge + 1 scanned_posts/brand.
- **Rủi ro**: (a) 2 đội sales gọi 1 người — chấp nhận (anh chốt), super có số `siblings` để quản; (b) automation trùng — chặn bằng lock §2.7 (transaction) + worker preflight; (c) multitouch gộp chéo brand — thêm `brand` vào so khớp; (d) đếm lead↔nguồn FE lẫn khi trùng tên — khoá `source_id`; (e) patch Pha 1/2 = vùng lõi (cùng vùng PB-1/PB-2) → làm **chung 1 LỆNH** với PB-1/PB-2 sau khi dump R1 (mã đang chạy), harness dựng lại lượt 2 brand/1 group.
- **Rollout**: LỆNH B0 (engine fan-out + seen.brands + lock + sourceOnWrite + system_status/sources) + zip FE; nghiệm thu bằng 1 group test gắn 2 brand test (test-agency + 1 brand thật) trước khi mở cho khách. Không cần Rules mới nếu Rules `sources` create/update hiện chỉ super (cần R1 dump để chắc); `system_status` read super đã có (#23); `outreach_locks` Admin SDK.

## 7. Câu 5 — "không bỏ lỡ lead nào, đẩy về nhanh nhất": kế hoạch TỐC ĐỘ

### 7.1 Chỗ đang bỏ lỡ / chậm (từ rà soát + code)

| # | Chỗ | Bằng chứng | Bỏ lỡ hay chậm |
|---|---|---|---|
| S1 | Gieo cố định 10′ (thực tế ~12′) + gặt lượt sau 3′ | #21, tick 3′ | chậm: post → lead 12–20′ |
| S2 | Probe 5 bài/lần; group >25 bài/giờ lọt bài tới sweep 2 h | index.js:206–213 | bỏ lỡ tạm (sweep vớt), chậm 2 h |
| S3 | `seen` ghi trước quyết định; lượt cắt/instance thu hồi → mất bài | N1-1/N2-1, PB-1/PB-2 | bỏ lỡ hẳn |
| S4 | Bình luận chỉ lấy 1 lần lúc phát hiện bài | Q-3 (Cao) | bỏ lỡ hẳn comment-lead đến sau |
| S5 | BrightData/LLM ngưng → bài trong lúc ngưng: LLM đã có score_retry (#46); BrightData ngưng >1 h ở group đông → >20 bài → probe/sweep không tới | #21 bdwatch chỉ báo | bỏ lỡ khi sự cố dài |
| S6 | `cmt_scrape.lastAt` ghi trước gieo; snapshot comment failed bị xoá không gieo lại | N1-5 | bỏ lỡ comment |
| S7 | Push "Lead nóng mới" tới admin brand không tới (brand ghi 2 bước) | N1-2 | chậm phía người |
| S8 | Sweep "đóng dấu hụt" (`lastSweepAt` ghi dù không gieo 20 bài) | N1-3 | sweep thật thưa hơn 2 h |
| S9 | Nguồn chết/nick lỗi không ai biết nhiều ngày | G-1 | bỏ lỡ cả nguồn |
| S10 | Tầng 1 fail-open (giữ), lỗi 400 hệ thống → lead heuristic | N4-6 | không bỏ lỡ nhưng sai |

### 7.2 Kế hoạch (thứ tự = tác động ÷ công)

1. **Không mất bài (S3, S6, S8)** — PB-1 + PB-2(d): staging `score_pending`/lease trong `score_retry`, `seen` chỉ "đã lấy", quyết định ghi sau; bọc lỗi từng bài; trần mềm lượt 1.200 s + `scans.aborted`; `cmt_scrape.lastAt` ghi sau gieo OK, snapshot failed gieo lại 1 lần; tách `sweepDue`/`didSweep`.
2. **Bình luận đến sau (S4)** — câu 6 đã chốt: `watch_posts` ≤5 bài/nguồn, 2 lần/ngày, 2 ngày (bài đã ra lead hoặc ≥2 comment-lead) + đo `cmt_scrape` trước (R3).
3. **Nhanh (S1, S2)** — nhịp thích ứng **BẬT mặc định**, bậc theo `group_state.rate` (EWMA bài mới/giờ, cập nhật lúc gặt):
   - sôi động (≥6 bài/giờ) **3′** · thường (1–6) **5′** · thưa (<1) **10′** · im (0 bài ≥6 h ban ngày) **30′** · đêm 23–6 h: ×2 nhưng trần 30′.
   - Sàn = `config/app.scanIntervalMin` (ô v119-50, hạ mặc định 10 → 3), trần = `scanIntervalMaxMin` (mặc định 30). Reset về bậc "thường" lúc 7 h và **ngay khi gặt được bài** (group im có bài mới → lập tức lên nhịp nhanh).
   - Probe = 5 nhưng **escalate 20 ngay trong lượt** (đã có) + group có `rate ≥ 6` probe 10.
   - Chi phí: BrightData tính theo record → trigger dày không tốn thêm; record tăng chỉ khi trước đó lọt bài (= lead thêm). Kiểm giới hạn API BrightData (số snapshot/giờ) ở LỆNH R2.
   - **Gặt trong lượt**: cuối lượt (khi lượt < 60 s) poll các snapshot vừa gieo tối đa 75 s (bdStatus 5 s/lần) → gặt luôn nếu chín (đo 05/09: ready 45–141 s) → post → lead còn ~2–4′. Không chờ quá trần → gặt tick sau như hiện nay.
   - **Scheduler 3′ → 1′** (Cloud Scheduler tối thiểu 1′; lượt 3–6 s nên chồng không xảy ra; `maxInstances:1` đã có; attemptDeadline giữ 1800).
   - Kết quả kỳ vọng: post → lead **≈ 2–5′** (từ 12–20′), lead nóng push ngay.
4. **Sự cố dài (S5)** — khi `system_status/brightdata` hoặc `llm` chuyển ok:false→true: lượt kế chạy **deep sweep** mọi nguồn (numPosts 50, không `posts_to_not_include`, `seen` lọc) 1 lần; bdwatch ghi `downSince` để chọn `startDate`.
5. **Phía người (S7)** — PB-10: `brand` trong write đầu → push admin brand + assignee; push nóng gộp theo lead.
6. **Nguồn chết (S9)** — `source_health` (bài/giờ, lead 7 ngày, lastPostAt, deadStreak, error) trong `system_status/scan` + cảnh báo `[SCAN-NO-LEAD]` (6 h ban ngày có bài mà 0 lead) và "nguồn N ngày 0 bài" WARNING gộp; cột "Nhịp · Sức khoẻ" ở Nguồn quét; "quét không chạy >15′" ở Cảnh báo.
7. **Đúng (S10)** — PB-4 phần badreq + giám sát tầng 1 (giữ fail-open).

### 7.3 Đánh đổi anh cần biết
- Tick 1′ + nhịp 3′ ở group đông → số lượt `scans` tăng ×3 → cần PB-9 (TTL scans 90 ngày, FE limit 300).
- Gặt trong lượt kéo lượt lên ≤ ~90 s ở lượt có gieo (vẫn xa timeout 1800, không chồng vì maxInstances 1; scheduler 1′ sẽ bỏ tick khi lượt trước chưa xong → không sao).
- BrightData: cần biết giới hạn snapshot đồng thời/giờ của gói (R2 in `bd_month` + hỏi dashboard BrightData); nếu có trần, engine xếp hàng gieo theo `rate` (group đông trước).
- Deep sweep sau sự cố: 23 nguồn × 50 bài = tới 1.150 record 1 lần (~vài USD) — chỉ chạy khi sự cố ≥30′.

---

# BẢN 2 — ĐIỀU CHỈNH SAU PHẢN BIỆN (3 agent đối kháng, 12/09; kết quả thô `phan-bien-thiet-ke-b.json`: 41 lỗ · 13 bác · 25 giữ · 19 câu hỏi)

Các mục dưới đây **thay thế** phần tương ứng ở bản 1. Mọi mốc code vẫn là fixture/FE v119-89; mốc thật lấy từ LỆNH #47.

## 8.1 Hướng B — sửa 10 lỗ (5 Cao)

| # | Lỗ (lens) | Sửa trong thiết kế |
|---|---|---|
| B-1 Cao | v-fixgrp `srcByGroup[gid]` (1 gid → 1 tên) + birthstamp `brandBySource[lead.source]` chạy SAU `ref.set` sẽ đổi lead brand X thành brand Y (engine H1, auto H1) | Object lead ở Pha 3b mang sẵn `brand, source_id, gid` (từ ứng viên fan-out) → `ref.set` có brand; **bỏ v-fixgrp + bỏ update birthstamp** cho lead có `source_id` (giữ 2 nhánh cũ chỉ cho ứng viên legacy không có source_id); `brandBySource/srcByGroup` chuyển khoá `source_id` → Map gid → [sources]. Harness: 2 nguồn cùng gid tên khác → 2 lead đúng brand. |
| B-2 Cao | `score_retry/R_<post_id>` 1 doc/post + nạp lại theo `s.url` → fan-out đè nhau, 1 brand mất bài hoặc chấm bằng hồ sơ brand khác (engine H2, auto H2) | Id `R_<post_id>__<brand>`, doc lưu `source_id`; nạp lại tìm nguồn theo `source_id` (fallback gid+brand); `ai_wait`/`deferredDoc` theo brand. |
| B-3 Cao | scanstats #39 nối brand theo `normUrl(url)` → `daily_stats.scanned` của group dùng chung dồn về 1 brand (engine H3); `bd_month.src` khoá `s_<url>` đè nhau (engine H6) | `bySource` row ghi `brand` + `source_id`; scanstats ưu tiên `r.source_id`/`r.brand`; `bd_month.src` khoá `s_<source_id>` (FE ROI đọc key mới, fallback cũ); `scans.posts` đếm theo group 1 lần + `postsByBrand`, thêm `groupsCount`. |
| B-4 Cao | `seen` legacy chỉ `{at}` → bài cũ quay lại (backfill/sweep/force) làm brand chủ bị chấm lại → lead trùng + AI ×2 (engine H4, auto H13) | Quy ước Pha 2: doc `seen` không có `brands` → brand X coi là **đã xử lý** nếu nguồn X không có `sharedAt` hoặc `sharedAt < seen.at`; chỉ brand tham gia sau mốc đó mới được chấm. **Lead id tất định `L_<post_id>__<brand>` + `create()`** (kéo PB-2(e) vào B) làm chốt cứng chống lead trùng kể cả khi cổng seen sai; `leadKey` khi `force` cũng theo brand. |
| B-5 Cao | Tạo nguồn ở client: id `<gid>` + `setDoc(merge)` → đụng doc primary của brand khác = **merge đè brand/name/keywords (chiếm nguồn)**; `sourceOnWrite` chạy sau không đảo được (auto H5); `siblings/shared_note` ghi mã brand khác lên lead của brand user = lộ chéo (auto H4) | **Mọi nguồn TẠO MỚI id `<gid>__<brand>`** (23 nguồn cũ giữ id); tạo mới đi qua **CF `createSource`** (Admin SDK: kiểm gid/brand/tên trùng, chuẩn hoá gid, đặt `sharedAt`, ghi `system_status/sources`, push super) — FE không `setDoc` khi tạo; Rules `sources` update không cho đổi `brand` ngoài super (cần R1 dump). Lead **không** mang mã brand khác: chỉ `shared_post:true`; bản đồ liên kết ở `lead_links/{gid}_{post_id}` = `{brands:{A:leadId,B:leadId}}` (Rules read super, write false) — modal super đọc từ đó. |
| B-6 Vừa | `gid` không chuẩn hoá slug ↔ id số → cùng group nhập 2 dạng URL không được nhận là dùng chung: brand sau 0 lead (seen toàn cục) + BrightData ×2 (speed H1, auto H6) | `gid` = **id số**: lúc gặt lần đầu lấy `/groups/<số>/` từ URL bài BrightData → ghi `sources.gid` + `group_state.gid`; nguồn slug chưa gặt = "chưa biết gid" (không làm primary); `byGid` gộp theo gid số; `createSource` so trùng theo gid số rồi slug; LỆNH #47 in bảng dạng URL 23 nguồn (B0). Pha 2: bài `wasSeen` nhưng `brands[X]` trống (và X không phải legacy) → vẫn fan-out cho X. |
| B-7 Vừa | `group_state`/`pending_snapshots/P_` khoá theo chuỗi `source.url` → đổi/tắt nguồn chủ = mất recentIds/snapshot chờ (auto H12) | Khoá `group_state/{gid}` + `pending_snapshots/P_<gid>` (migration 1 lần ở lượt đầu, marker `v-shared`); `harvestComments`/`srcOf` theo gid → danh sách nguồn. |
| B-8 Vừa | multitouch gọi TRƯỚC khi lead có brand → `where brand==` vô hiệu/ném lỗi tắt multitouch (engine H5) | Đã đóng bởi B-1 (brand có trước `tryMergeTouch`); điểm chèn `where brand==` chốt sau dump `lib/multitouch.js` (R1); harness 2 brand cùng author_url 48 h → 2 lead, mỗi brand 1 touch. |
| B-9 Vừa | Đường bù "Quét thử nguồn này" cho brand vào sau dùng chung `pending_snapshots/P_<url>` + `backfill_done/bf_<url|range>` với lịch/brand chủ → thường không bù được; ô `force` gây `L_<post_url>` chung (engine H7/H10, auto H13) | Backfill cho nguồn dùng chung: pending riêng `P_bf_<gid>_<brand>_<range>`, `backfill_done` khoá `(gid, range, brand)`, fan-out CHỈ brand bấm; ẩn ô force với nguồn có `sharedAt` (force vẫn theo brand nhờ B-4). |
| B-10 Thấp | cache tầng 1 theo (post_id, brand) là tối ưu chết (engine H13); ước tính AI thiếu miss-reply ×3, eKYC, profile-scan theo lead | Bỏ cache; nếu tiết kiệm thật: cache theo (post_id, hash Hồ sơ AI). Ghi rõ chi phí biên/brand dùng chung = tầng 1 + tầng 2 (+miss-reply ≤3) + eKYC/profile theo lead. |

## 8.2 Khoá tranh chấp automation — viết lại §2.7

- **Helper dùng chung `acquireLocks(lead, brand, pid)`** (transaction) gọi **ở CẢ 2 đường** (`stepNick` func-path lẫn `apEnqueueFunnel`), đặt **TRƯỚC** `tryConsume`×4 và `genForLead` (thua lock = chưa đốt van, chưa tốn AI) (auto H3, H9).
- **Khoá theo mục tiêu thao tác**: lead-bài → `post_<post_id>`; comment-lead → `cmt_<comment_id>`; người → `person_<key>` với key = uid số nếu có, nếu không = username fold (bỏ `www.`, query, `/` cuối; `pfbid…` giữ nguyên). 2 comment-lead khác người dưới cùng bài của 2 brand không chặn nhau; lead-bài của brand B không bị khoá vì brand A trả lời 1 bình luận dưới bài đó (engine H14, auto H8).
- **Worker**: sau `ensureUid` (bước Kết bạn) kiểm `outreach_map/{uid}` + `person_<uid>` — brand khác đã có → dừng trước add_friend/inbox, thread `skipped_shared`, hoàn van friend/inbox, log ⏭, ghi thêm `person_<uid>` cho brand thắng (auto H7).
- **Lock có trạng thái + đường nhả**: `state: reserved|touched`, `reserved` hết hạn = lease thread (30′+); worker chuyển `touched` sau bước đầu thành công; mọi nhánh đóng thread khi còn `reserved` (sweep44 expired · onHuman · skipLeadRole · cancelQueued44 · moved) → xoá lock; `touched` giữ 14 ngày. Thread `skipped_shared` mang `retryAt = lock.expireAt` và được engine xét lại như thread retry (lead của brand B không bị "nhường" vĩnh viễn) (engine H8, auto H10).
- **Ưu tiên brand**: Đợt 1 = **first-come** (tick chạy CONC 25 song song nên "chủ nguồn thắng" không thực thi được — engine H12, auto H11). Tuỳ chọn sau: lock giữ chỗ `holdFor:<brand ưu tiên>, holdUntil` N′.
- Cùng brand có lead-bài + comment-lead cùng bài: giữ như hiện nay (không khoá trong cùng brand) — hỏi anh nếu muốn chặn.

## 8.3 Thông báo super + FE — bổ sung

- `sourceOnWrite` **so before/after** (`gid/brand/active/sharedAt`) để không push mỗi lượt nếu scanner ghi ngược `sources` (auto Q) — chi tiết sau R1 (grep `sources` write trong index.js).
- `inboxTasks` (10-core) thêm nhóm `system` (row không `data-lead`, bấm → Nguồn quét); live.js subscribe `system_status/sources` (super, lỗi chỉ console.warn); `buildData.srcOut` thêm `gid, sharedAt, sharedBy` + nối lead↔nguồn theo `source_id` rồi mới fallback tên (live.js buildData:149) (auto H14).
- Nguồn quét: chip "Dùng chung · N brand" chỉ super; brand user không thấy gì.

## 8.4 Kế hoạch tốc độ — sửa 9 lỗ (2 Cao) và **cam kết số thật**

| # | Lỗ (speed lens) | Sửa |
|---|---|---|
| T-1 Cao | Tick 1′ + tin "maxInstances 1 → không chồng" SAI: Cloud Run `containerConcurrency 80` (#19 đã thấy 2 lượt/1 instance); manualScan là service riêng không khoá; sau #46 lượt có thể >1800 s → race gặt trùng/seen trùng/lead trùng dày ×3 (H2, engine H9) | **Trước khi đổi tick**: khoá lượt `system_status/scan_lock` (transaction, TTL = trần mềm 1.200 s) cho MỌI trigger; manualScan gặp khoá → `{busy}` + FE toast; gặt pending bằng transaction (đọc→xoá nguyên tử); `seen` `create()` (PB-2 b/c/d kéo vào LỆNH tốc độ). Cân nhắc Cloud Run `concurrency 1` cho scheduledscan. |
| T-2 Cao | "Gặt trong lượt" poll ≤75 s **không gặt được**: snapshot có `posts_to_not_include` chín ~141 s (#22b B; #21: 0/15 chín trong 90 s); đổi lại ~30 h CPU/ngày (≈$80/tháng) và làm tick 1′ bị bỏ (H3) | **Bỏ poll trong lượt.** Thay bằng **BrightData `notify` webhook** (tham số trigger) → CF `bdReady` ghi `pending.ready=true` → lượt kế gặt không cần `bdStatus`; nếu gói không có notify → chỉ poll snapshot đã gieo ≥120 s, ≤2×5 s. Ước tính thật post → lead: **~4–7′** (gieo ≤3–5′ + chín ~2,5′ + tick ≤1′ + AI ~15 s), từ 12–20′ hôm nay; không hứa 2–5′. |
| T-3 Vừa | Deep sweep 23×50 record bị kích bởi mọi cú nháy `[LLM-DOWN]/[LLM-UP]` (OpenAI 500 theo đợt vài giây) + bdwatch flap khi lượt chỉ gieo 1–2 nguồn; LLM ngưng vốn không mất bài (score_retry) (H4); đi đường backfill = chờ 240 s/nguồn > timeout + `backfill_done` (H10) | Deep sweep **chỉ cho BrightData ngưng ≥30′**, đi **đường sow riêng** (gieo tất cả nguồn `{start_date: downSince, num_of_posts: min(200, rate×giờ ngưng+10)}`, pending `deep:true`, gặt lượt sau, không `isBackfill`); bỏ nhánh LLM. bdwatch ngưỡng theo cửa sổ 10′ + UP cần 2 lượt OK. |
| T-4 Vừa | Sửa S8 làm sweep 2 h thành THẬT (×3) trong khi N1-9 (recentIds ≤200 → sweep mua lại bài cũ) chưa sửa → record tăng, trái §6 (H5); escalate dùng recentIds cũ → 10 record trùng/lần (H12) | S8 làm CÙNG N1-9: sweep = `start_date = lastSweepAt − 6 h` thay `num_of_posts 20` mù; escalate truyền `notInclude = ids vừa gặt ∪ recentIds`; probe cao (10–15) cho group đông thay vì leo thang 20; đo `scans.sweepRecords`. Sửa §6: BrightData không đổi **do đa brand**, phần tốc độ có thể tăng record ở group đông (= bài trước đây lọt) và bù bằng start_date. |
| T-5 Vừa | BrightData API: tick 1′ = ~23 poll `progress`/phút + 5–8 trigger/phút; trần rate/snapshot đồng thời chưa biết; `bdStatus` nuốt 429 thành `unknown→skip` im lặng, pending quá 2 h bị xoá = mất cửa sổ bài (H6) | (1) **Gộp gieo 1 trigger/lượt** cho mọi nguồn tới hạn (bdTrigger nhận mảng url) + route record theo gid → 1 poll/lượt; (2) `bdStatus` phân biệt 429/5xx (đếm bdwatch, backoff) với running; (3) sàn mặc định **5′** tới khi R2/BrightData dashboard cho số; 3′ chỉ bật sau khi có trần. |
| T-6 Vừa | `scans` 1.440 doc/ngày, FE `limit(1000)` = 16 h; PB-9 300 = 5 h (H7); việc phụ (sweeper #46, quét-vét Zalo, profile collect, getAll 23+23) chạy 1.440 lần/ngày (H13) | Lượt **thuần skip** (0 gieo/0 gặt/0 ứng viên) không ghi doc `scans` (chỉ `system_status/scan.lastRunAt` + `bd_month.runs`), return sớm sau Pha 1; việc phụ theo nhịp riêng (`lastHousekeepingAt` ≥5′ hoặc khi backlog >0); FE chart/KPI đọc `daily_stats.scanned/scanRuns` + `bd_month`, `D.scans` limit 200 cho bảng lượt. LỆNH #47 đo tỉ lệ lượt thuần skip. |
| T-7 Vừa | `COMMENTS_PER_POST 30` = trần cứng theo bài; bài viral >30 bình luận không bao giờ lấy phần còn lại, `watch_posts` cũng chỉ trả lại 30 record cũ (H8) | Bài trong `watch_posts` (đã ra lead) → `limit_records` 100 + kiểm BrightData dataset comment có sort mới nhất/`start_date` (R2); LỆNH #47 đếm dòng chạm trần. |
| T-8 Vừa | EWMA `rate` chưa ổn định: group mới rơi bậc im 30′; sweep gặt bài cũ thổi rate; α cố định với Δt 3′↔30′; không hysteresis (H9) | Rate tính ở Pha 2 trên bài `!wasSeen` (scraper trả `newIds`); α theo thời gian `1 − e^(−Δt/τ)`, τ 60′; group mới → bậc thường 5′; hysteresis ±20 % + giữ ≥2 mẫu; sweep không cập nhật rate; reset lên nhịp nhanh ngay khi có bài mới (giữ). |
| T-9 Thấp | "Không bỏ lỡ" bỏ qua 5 nguồn private/nick đã tắt (#22) (H11) | Thêm S11: nguồn private = bỏ lỡ có chủ ý → Nguồn quét chip "Không quét được (private) · cần cookie nick" + đề nghị đổi group công khai; đường nick ngoài phạm vi kế hoạch này. |

**Bậc nhịp bản 2**: sôi động (≥6 bài/giờ) **3′** *(chỉ sau khi R2 có trần API; tới đó = 5′)* · thường **5′** · thưa **10′** · im (0 bài ≥6 h ban ngày) **30′** · đêm 23–6 h ×2, trần 30′. Sàn/trần = `scanIntervalMin` (mặc định 10 → 5) / `scanIntervalMaxMin` (30), super ghi đè từng nguồn. **Không đổi tick 1′ trước khi có khoá lượt (T-1).**

## 8.5 Chốt lại số liệu và trình tự

- Post → lead: hôm nay 12–20′ → **~4–7′** (T-2), có thể ~3–5′ khi BrightData notify + tick 1′ + khoá lượt.
- Tiền: BrightData không nhân theo brand; tăng ở group đông đúng phần bài trước đây lọt + sweep theo start_date (đo bằng `bd_month` trước/sau); AI nhân theo số brand *dùng chung group đó*; Cloud Run gần như không đổi (không poll trong lượt).
- **Trình tự LỆNH** (sau #47): **A0** (PB-5 + PB-2a) → **A** (PB-3 + PB-4 + PB-2 b/c/d = khoá lượt/gặt transaction/seen create + PB-1 lease) → **B** (hướng B §8.1–8.3 + tốc độ §8.4: gộp gieo, notify, nhịp thích ứng, deep sweep sow, S8+N1-9, scans gọn, source_health) → **C** (PB-10 + PB-6 + Rules) → zip FE (PA-4 + PC-6 + PA-11 + FE của B + toast busy).
- **Cần anh cho 3 số từ BrightData dashboard** (không có trong code): trần snapshot đồng thời / request/phút của gói; đơn giá thật dataset posts và comments (USD/1k record) + record `dead_page` có tính tiền không; gói có tham số `notify` (webhook) không. Nếu chưa có thì em giữ sàn 5′ và không bật notify.

## §9 · ĐIỀU CHỈNH SAU LỆNH #47 / #47b / #47c (12/09/2026 trưa — số liệu thật + mã đang chạy, xem `docs/lenh-2026-09-12-47.md` KẾT QUẢ ĐẦY ĐỦ)
| # | Phát hiện từ dump/số liệu | Ảnh hưởng thiết kế | Sửa |
|---|---|---|---|
| 9.1 | Gateway ZBS `notifyBrandZalo` (zalo-fn, `onDocumentUpdated`) chỉ bắn khi `justTagged = !before.brand && after.brand` (không justTagged & score không đổi → return) | §8.1 B-4 "lead mang brand TRƯỚC commitLeadNow" sẽ làm câm ZBS (create không phải update) | **Giữ 2 bước**: create KHÔNG brand (có `source_id/gid/post_id/brand_pending:true`) → update `brand` như birthstamp hiện tại. PB-10 phía push.js = cổng "brand xuất hiện" (`hasBrand(after) && !hasBrand(before)`) thay `!before`. Vá zalo-fn `onDocumentCreated` = việc riêng, không nằm trong B. |
| 9.2 | Lead KHÔNG có field `post_id` (2.059/2.059 rỗng); scanner có `x.post.post_id` trong bộ nhớ | Id tất định `L_<post_id>__<brand>` | commitLeadNow ghi thêm `post_id` (+ `gid`, `source_id`); id doc = `L_` + slug(post_id) + `__` + brand; comment-lead post_id = `cmt_<cid>` → id `L_cmt_<cid>__<brand>` |
| 9.3 | 57/1.027 comment 3 ngày có `parent_url` gid SỐ không khớp nguồn URL slug (H1) | fan-out theo gid | `gidOf()` chuẩn hoá: nguồn slug → tra `group_state.gidNum` (ghi lúc gặt từ record BrightData `group_id`/URL số) — mọi map theo gid dùng gid SỐ; `scanstats.normUrl` (v119-78) cũng đổi sang `source_id` |
| 9.4 | Comment: 12.413 record BrightData / 2.021 comment dùng được (84 % record rỗng = bài 0 bình luận vẫn tốn 1 record) | Q-3 "bài đáng theo dõi" + chi phí | Gieo snapshot comment CHỈ cho bài có `num_comments > 0` (kiểm field trong `normalizePost` — #47d) và bài đã ra lead/qualified; watch_posts giữ ≤ 5 bài/nguồn |
| 9.5 | Lượt thuần skip 1.044/3.346 (31 %) vẫn ghi doc `scans`; 3,3k snapshot/ngày; 3 nguồn 0 bài/24h, 3 nguồn ≤ 8 bài/ngày; đêm 1–5h 15–70 bài/giờ | T-7, S9, nhịp thích ứng | Không ghi `scans` khi lượt thuần skip (chỉ cộng counter nhẹ `scan_stats/day`); bậc nhịp theo EWMA bài mới: 5′ (nguồn ≥ 100 bài/ngày & ban ngày) / 10′ / 30′ (nguồn < 10 bài/ngày hoặc 0–5h) — chờ giá dead_page để chốt sàn 5′ hay 3′ |
| 9.6 | Lag phát hiện trung vị 11′ · p95 36′ (mốc gốc) | Mục tiêu 4–7′ | Đòn bẩy theo thứ tự: nhịp gieo 5′ (−2,5′) → tick 1′ có khoá transaction (−1′) → `notify` webhook (−1′, nếu gói có) → ước tính trung vị 5–6′ |
| 9.7 | N4-3: lead AI chấm lại có người thật chăm = 0; backlog `ai_scored:false` còn 2 | PB-5 khẩn → thường | Gộp A0 vào LỆNH A (vẫn làm nhánh human giữ temp ≥ cold + `ai_flag`) |
| 9.8 | 18 % lead-bài là bản gần trùng (text ≥ 0,8, cùng brand, ≤ 14 ngày); 64 % không identityKey | PC-4 | Đưa PC-4 (vân tay văn bản `textKey` = simhash 64 bit trên fold(text) 300 ký tự đầu, gộp thành touch nếu cùng brand ≤ 14 ngày) lên Đợt 1 phần B (rẻ, cùng chỗ commitLeadNow) |
| 9.9 | "excluded" 10,7 % = bài `text` rỗng (hscl-01 28–30 %) | Nhãn sai ngữ nghĩa | decision `no_text` riêng (FE Bài đã quét hiện "không có chữ"); OCR ảnh giá = đề xuất Đợt 3, không làm bây giờ |
| 9.10 | `onLeadCreated`/alerts không có kênh nào bật; push hot chỉ tới super (brand rỗng lúc create) | PB-10 | Như 9.1; alerts giữ nguyên |
| 9.11 | stage `new` 99,3 % | R-1/C.12 | Không đổi thiết kế; ghi nhận sales chưa dùng pipeline → bộ đếm trừ khi máy loại (câu 1) ảnh hưởng KPI nhiều hơn lo ngại |
| 9.12 | `normalizePost.post_id = p.post_id ‖ p.id ‖ p.url ‖ Math.random()` (scraper 13) — có thể là URL hoặc ngẫu nhiên | §9.2 id tất định | `leadIdOf(post, brand)` = `'L_' + slug(post_id ‖ urlKey(url)) + '__' + brand` (slug = `[^\w-]`→`_`, ≤ 200); bài không id lẫn url → không ghi, đếm `no_id`; bỏ `Math.random` trong normalizePost (thay `urlKey(url)`, cuối cùng `'h_'+hash(author+text)`) |
| 9.13 | `normalizePost` KHÔNG map số bình luận; tên field thô BrightData chưa biết | §9.4 gieo comment chỉ cho bài có bình luận | KHỐI 0 LỆNH B in `Object.keys` 1 record thô → thêm `num_comments` vào normalizePost; nếu dataset không có → §9.4 hạ thành "chỉ gieo cho bài qualified/lead" (`qualified_only` sẵn có) |
| 9.14 | `groupStateDoc(url)` / `cmtScrapeDoc` / `pending P_<url>` khoá theo URL nguồn (index 207–208) → 2 nguồn cùng group khác dạng URL = 2 state = 2 trigger/nhịp | B-1 "gieo/gặt 1 lần/group" | Khoá cả 3 theo **gid số** (`gidOf(source)`; slug → `group_state/{slug}.gidNum` học lúc gặt); nguồn cùng gid chia sẻ 1 state/1 pending/1 recentIds; migrate: đọc doc URL cũ nếu doc gid chưa có |
| 9.15 | **`tagLeadBrand` đang deploy từ `codebase2`** = lưới dự phòng gán brand theo nguồn cho lead `brand_pending:true` (chưa dump) | Fan-out theo brand | Lead create ghi `brand_hint` (= brand fan-out) + `source_id`; birthstamp inline dùng `lead.brand_hint` thay `brandBySource[lead.source]`; KHỐI 0 LỆNH B dump tagLeadBrand → nếu tra theo tên nguồn → LỆNH C vá ưu tiên `brand_hint` (deploy `--only functions:tagLeadBrand` từ codebase2) |
| 9.16 | ZBS bắn cả khi chỉ đổi `score` (chưa notified, ≥ ngưỡng), không kiểm `dropped/lost/ai_scored:false` | An toàn sales | LỆNH C tuỳ chọn: `notifyBrandZalo` thêm `if (after.dropped ‖ after.lost ‖ after.ai_scored === false) return` (zalo-fn) — không thuộc B |
| 9.17 | `heuristic` dự phòng #46 thuần từ khoá agency marketing + `service:'Performance Marketing'` cứng | Lead dự phòng brand ngoài marketing ≈ luôn ≤ 45 | PB-5b trong LỆNH A: heuristic nhận `brandAi` → cộng từ khoá từ `ai.khach/dichvu`, bỏ service cứng; kẹp ≤ 59 giữ |
