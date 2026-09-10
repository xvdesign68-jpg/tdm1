# B — Rà giao diện AUTOMATION "Tiếp cận" (v119-87, cây `w87`) — reviewer đối kháng, chỉ đọc

Phạm vi đã đọc: `src/app/45-outreach.js` (toàn bộ 820 dòng), `assets/js/live.js` (527–548, 554–637, 1005–1081, 393–425), `50-config-views.js` 414–435, `87-brand-wizard.js` 210–250, `20-feed.js` 730–745, `70-shell-tools.js` 118–151, `25-agency.js` 68–117, `10-core-overview.js` 256–272, `90-boot.js` 35–62; đối chiếu shape ghi của worker (`scratchpad/worker/worker.mjs` 2026-09-04b — bản gần nhất có trong máy; 06d chỉ khác phần zombie) + patch engine `docs/lenh-2026-09-05-31b-patch.cjs`.

## A. Phát hiện

### [B-1] [Cao] Cờ nick (needLogin / checkpoint / Safety tạm dừng / worker tự tắt) KHÔNG hiện realtime ở tab Tiếp cận & Cảnh báo — chỉ thấy sau khi rời tab rồi có thêm 1 sự kiện log
- `assets/js/live.js:545` `if(force || sig!==adminSig){ adminSig=sig; rebuild(['users','roi','overview','agency']); }` — danh sách KHÔNG có `outreach`/`alerts`; `live.js:418-419` `full = pv.has(cur)` → không có thì `SLApp.reload(d,{silent:true})` (90-boot:48 chỉ cập nhật D, không vẽ).
- `10-core-overview.js:264` `go()` gọi `refreshAdmin()` (async, throttle 15 s) rồi `views[name]()` ở dòng 272 vẽ NGAY từ D cũ.
- `fb_accounts` không có `onSnapshot` nào; `oaSigMain()` (`live.js:1016-1023`) chỉ băm log/stats/contentStats.
- Kịch bản: worker `flagChallenge` ghi `fb_accounts.challenge` + 1 dòng log. Log snapshot → `oaRepaint` → `rebuild(['outreach',…])` → `buildData(...,fbAccounts)` với mảng `fbAccounts` CŨ (chưa getDocs) → bảng nick vẫn "bật, không cờ" trong khi "Hoạt động gần đây" đã ghi "⛔ checkpoint". Super rời tab → quay lại: `go()` vẽ từ D cũ, `refreshAdmin` xong → rebuild list không có `outreach` → silent. Chỉ khi có thêm log/stats mới thì chip + nút "✓ Đã xử lý" mới hiện. Tương tự `sysAlertRows()` (50:420-424) ở tab Cảnh báo.
- Sửa: (a) thêm `'outreach','alerts'` vào list ở `live.js:545`; (b) tốt hơn: super subscribe `onSnapshot(collection(db,'fb_accounts'))` trong `lazyOutreach` (Rules read super có sẵn, collection nhỏ) → gán `fbAccounts` + đưa `id:active:needLogin:challenge:safetyPaused:safety:uiLang:workerId` vào `oaSigMain()`.

### [B-2] [Vừa] Van hiển thị/ô nhập cho phép vượt "van tầng 2" của worker → UI báo còn suất, worker đẩy sang mai
- `45-outreach.js:320` `OA_CAP_MAX = { react: 200, comment: 100, friend: 30, inbox: 30 }`, `:362` `capMax` giống; worker `hardCapCheck()` dùng `CFG.hardCaps {react:80, comment:30, friend:20, inbox:15}` (worker.mjs:38, CLAUDE.md v119-40).
- Kịch bản: super đặt inbox 30/nick. Thẻ brand vẽ `0/30`; worker dừng ở 15 → thread nick đó "paused… đẩy sang sáng mai" dù thanh van mới nửa. Người vận hành tưởng engine kẹt.
- Sửa: hạ `OA_CAP_MAX` = hardCaps của worker (80/30/20/15) hoặc hiện chú thích "trần cứng máy chủ: N" cạnh ô; thanh van dùng `min(cap brand, hardCap)`.

### [B-3] [Vừa] Nick chuyển sang AdsPower nhưng chưa có Profile ID vẫn `active:true` → engine reserve quota + enqueue task không ai chạy
- `live.js:615` `setFbAccountEngine` chỉ ghi `engine`; `45:739-751` handler đổi engine không đụng `active`; `45:383-385` chỉ hiện nút "Gán Profile ID", công tắc vẫn BẬT.
- Kịch bản: engine `stepNickAdspower` chọn nick (active, nextFreeAt 0) → `tryConsume` trừ van → task `adspower_id` rỗng; VPS gán nick không claim (`myNicks.has(adspower_id)`), VPS `takeUnassigned` claim → `adspowerStart` lỗi → `onInfra` 10′ lặp; lead bị lease 30′ liên tục.
- Sửa: FE khi đổi engine → adspower mà thiếu `adspower_id` thì ghi kèm `active:false` (toast "gán Profile ID rồi bật"); `oaAcctRow` chip đỏ "thiếu Profile ID – nick không chạy"; `sysAlertRows` thêm dòng.

### [B-4] [Vừa] Status lạ trong `outreach_log` rơi về "✓ Đã gửi" xanh
- `45:617` `const st = OA_STATUS[r.status] || OA_STATUS.done;` — `OA_STATUS` (45:39-40) có done/wait/sched/reply/fail/error/paused/skip/retry; thiếu `queued`/`running` (task) và bất kỳ status engine thêm sau này.
- Kiểm worker 04b: log chỉ ghi done/fail/retry/paused/skip/reply; `queued`/`running` là `outreach_tasks` (worker.mjs:1046,1077) → hiện chưa lộ, nhưng fallback "Đã gửi" là fail-open: 1 status mới = báo thành công giả.
- Sửa: fallback chip xám `['oa-s-wait', esc(r.status)]`; thêm `queued: 'Đã xếp hàng'`.

### [B-5] [Vừa] Sales/admin không thấy MÁY ĐÃ NÓI GÌ với khách
- `leads.outreach` (worker `stampLead` worker.mjs:132-134 + `stampExtra`) chỉ có `steps/last/at/pid/content{meta}/comment_at/inbox_at`; nội dung gửi nằm ở `outreach_log.text` — kênh super-only (`live.js:1052-1054`). Modal `65-charts-lead-modal.js:314` chỉ vẽ "Máy đã react → comment → inbox · nick X"; `70:139` tab Phản hồi chỉ trích câu KHÁCH nói.
- Kịch bản: khách trả lời "giá combo bao nhiêu?", sales mở lead không biết nick đã comment/inbox câu gì (CTA nào, hứa gì) → trả lời lệch.
- Sửa: worker `stampExtra` ghi thêm `outreach.comment_text/inbox_text` (≤300 ký tự) → modal + tab Phản hồi hiện "Máy đã nhắn: …". Không cần Rules.

### [B-6] [Thấp] `botChip` đọc `o.nick` — field không tồn tại; `nickLabel()` có sẵn mà không dùng
- `20-feed.js:737` `${o.nick?' · nick '+esc(o.nick):''}` — worker ghi `pid` (worker.mjs:134). Tooltip chip 🤖 không bao giờ có nick. `20:732` `nickLabel(pid)` định nghĩa ngay trên. `70:128` `replyTrace` fallback `l.outreach.nick||l.outreach.pid` → `rpRow` (70:139) in mã thô `nick apk1gm6por` cho sales (trái quy ước v119-61 M3).
- Sửa: `o.pid ? ' · nick '+esc(nickLabel(o.pid))` ở cả 2 chỗ.

### [B-7] [Thấp] Brand "BẬT" nhưng không có nick chạy được → KPI 1/1 xanh, engine im lặng, không ai cảnh báo
- `45:634` `onCount` = `oaCfg(b).on`; `45:48` `oaNickCount` đếm `active!==false` kể cả nick `needLogin/challenge/safetyPaused/uiLang≠vi` (gate worker hoãn 30–60′). Thẻ brand chỉ nói "chưa gán nick" khi 0 nick; `sysAlertRows` không có dòng "brand bật mà 0 nick khả dụng".
- Sửa: `oaNickCount` tách `usable` (active && !needLogin && !challenge && !safetyPaused && (engine!=='adspower'||adspower_id)); thẻ brand chip đỏ "BẬT nhưng 0/N nick chạy được"; thêm dòng Cảnh báo hệ thống.

### [B-8] [Thấp] Content Studio: chặn Lưu chế độ AI khi trống hồ sơ, trong khi chính hint nói backend dùng Hồ sơ AI làm ngữ cảnh
- `45:297` `if (content.mode === 'ai' && !content.intro) { toast(...); return; }` vs `45:229` "Đang dùng Hồ sơ AI … vì hồ sơ này còn trống"; backend `contentOf` → mode ai khi có `brand.ai` (LỆNH #4). Brand có `brand.ai` đầy đủ vẫn phải chép sang mới lưu được — mâu thuẫn nhỏ, gây bối rối.
- Sửa: cho lưu khi `aiTxt` có, hoặc tự điền intro = aiTxt khi lưu.

### [B-9] [Thấp] Nút "Dừng tất cả" lấy trạng thái từ heartbeat, không từ `worker_config.pauseAll` → VPS offline/khởi động lại hiện sai
- `45:469-470` `on = !w.paused` (heartbeat); `live.js:625` ghi `worker_config`. VPS đang offline: bấm Dừng → optimistic "Chạy lại"; rời tab quay lại → vẽ từ heartbeat cũ `paused:false` → nút "Dừng tất cả" dù pauseAll=true; VPS lên lại đọc pauseAll → đứng im, web không thấy lý do (Cảnh báo cũng không có dòng "đang Dừng tất cả").
- Sửa: super subscribe `worker_config` (Rules read super có) → `w.pauseAll` là nguồn sự thật; `sysAlertRows` thêm "VPS X đang Dừng tất cả (bởi …, từ …)".

### [B-10] [Thấp] Timer hạ 🔴 VPS chỉ chạy khi hash==='outreach' → tab Cảnh báo giữ "online" cho VPS chết cứng
- `live.js:1061` `if(hash!=='outreach') return;` nhưng `50:424` Cảnh báo cũng đọc `w.isOnline`. Sửa: cho phép cả `alerts`/`agency`.

### [B-11] [Thấp] Log `paused` lặp mỗi giờ đẩy hoạt động thật ra khỏi 100 dòng
- Worker `onPaused` ghi log mỗi lần gate hoãn (ngôn ngữ en 60′, needLogin 30′, khung giờ) cho MỌI task tới hạn; `live.js:1054` `limit(100)`, `45:652` vẽ nguyên. 4 nick chết × 11 thread × 24 lượt/ngày = trăm dòng giống nhau → KPI fallback không ảnh hưởng (chỉ đếm done) nhưng người xem mất dấu.
- Sửa FE: gộp dòng liên tiếp cùng `leadId+action+status` thành 1 dòng "×N"; thêm bộ lọc Trạng thái/Brand/Nick + toggle "chỉ lỗi".

### [B-12] [Thấp] `replyTrace` khớp format worker, chưa chắc khớp func-path
- Worker: `'💬 Khách đã phản hồi (inbox): "' + text + '" · nick ' + pid` (worker.mjs:947) → regex `70:126` `/[:：]\s*["“']([\s\S]*?)["”']\s*(?:·|$)/` + `via` `\((inbox|comment|bình luận)\)` + `nick\s+(\S+)` đều bắt ✓. Func `funcWebhook` ghi "… '...' + giờ + nick" (CLAUDE.md dòng 175) — nếu sau dấu đóng là " lúc 14:20" thay vì " ·" → không match → `txt` = cả câu hệ thống hiện thành "câu khách nói". Nghi ngờ, cần 1 note thật từ func để xác nhận (nick anh chạy AdsPower nên chưa ảnh hưởng).

### [B-13] [Thấp] Mốc "x phút trước" ở Hoạt động gần đây đứng yên
- `live.js:1055` `when:relAt(x.at)` tính lúc snapshot; sig cố ý bỏ `when` (v119-37) → dòng "2 phút trước" giữ nguyên 30′ nếu không có sự kiện mới. `45:625` có thể tự tính từ `oaLogMs(r)` lúc vẽ (không đổi sig) + timer 60″ chỉ sửa text `.oa-tick` qua softRender.

### [B-14] [Thấp] Card Bảng brand trên Tổng quan không nằm trong list repaint của `oaRepaint`
- `live.js:1047` `rebuild(['outreach','agency','alerts'])`; `agencyCard()` ở Overview đọc `outreachStats/auto` → số automation hôm nay trên Tổng quan chỉ đổi khi có sự kiện lead/scan khác.

### [B-15] [Thấp] Định nghĩa "phản hồi" của card Hiệu quả nội dung lệch giữa local và máy chủ
- `45:202` local: `rep` = `stage ∈ responded/booked/closed` bất kể trước/sau inbox; server (LỆNH #36) chỉ đếm khi đã inbox rồi mới phản hồi. Brand chưa có `content_stats.all.sent>0` thấy tỉ lệ cao giả (lead sales đã hẹn trước khi máy inbox).

### [B-16] [Thấp] Danh sách lead "Sinh thử" gồm lead người bán/chủ bài/không thành
- `45:231` chỉ lọc `dropped`/`junk`; nên loại `lost`, `role seller|poster_self`, `self_comment` (engine `roleBlockOf` không bao giờ chạm các lead này → sinh thử vô nghĩa).

### [B-17] [Thấp] Xoá nick: cảnh báo chỉ nói token, không nói thread/task đang mở với nick
- `45:811` "Token tương ứng cũng bị xoá" — nick AdsPower không có token; thread `outreach_threads.pid` = nick đã xoá → engine re-enqueue vào nick không tồn tại mãi (đã có `_l34_move.mjs` xử lý tay). FE chưa có dữ liệu thread nên chỉ đổi lời: "Phễu đang mở bằng nick này sẽ kẹt – tắt nick thay vì xoá nếu còn thread".

### [B-18] [Thấp] Mô tả "Xử lý ngay" đã lỗi thời với AdsPower
- `45:161` "chạy React → Comment → Inbox liền một mạch, KHÔNG chờ giãn" — từ K3 funnel AdsPower luôn liền trong 1 phiên, `immediate` chỉ còn tác dụng func path. Nên ghi rõ "chỉ ảnh hưởng nick func.vn".

## B. Đã kiểm, an toàn
- Tenancy: `SUPER_ONLY_VIEWS` (10-core:259) chặn `outreach/alerts/agency` cả khi gõ hash; palette Cmd-K lọc (70:13); nav ẩn (80:216). `lazyOutreach` brand user chỉ `where brandCode==byBrand` (log/stats/content_stats); `workers` + timer chỉ super; `fb_accounts` chỉ nạp qua `refreshAdmin` (go() chỉ gọi khi `roleIsSuper()`); `content_stats` lỗi Rules → chỉ console.warn (cố ý v119-57).
- Nguồn số: `oaBrandStats` ưu tiên `outreach_stats` (đúng ngày VN `vnToday`/`oaTodayStart`), fallback log chỉ đếm `status==='done'`; regex else-if bắt đúng "Thả cảm xúc vào bình luận" (→ react), "Trả lời bình luận của Lead" (→ comment), "Gửi lời mời kết bạn", "Inbox mở đầu"; "Phễu tự động cho Lead" (nhãn dòng hẹn lại, status fail/retry) không bị đếm; `funnel = react` nhất quán 2 nhánh; `OA_ENGINE_CAP` 40/12/10/8 khớp engine CAPS; van Kết bạn có (v119-38).
- Log field: worker (worker.mjs:640-717) và engine (31b patch) đều ghi `brand` (= brandName) + `score` → `oaFeedRow` đọc `r.brand`/`r.score` đúng, không "undefined".
- Thao tác: 3 handler brand toggle / ⚡ / nick active revert CẢ model + re-render (45:694, 709, 802); brand/engine/VPS select revert model (732, 747, 762); lưu ma trận ép Inbox⇒Kết bạn lúc lưu (45:361) và ở wizard (87:244); clamp cap 1..max; `setOutreach`/`setBrandContent` dùng `setDoc merge:true` → không xoá key khác của `outreach`/`content`; audit wrap đủ 12 method automation (live.js:960).
- Wizard: `patch.on=false` chỉ khi brand chưa có boolean `on` (87:245) → brand mới TẮT, brand đang chạy không đụng công tắc; "Giữ tuỳ chỉnh" không ghi ma trận; banner đỏ khi đang BẬT.
- Realtime: sig-guard + gộp 500 ms + re-check focus ô maxConcurrent (live.js:1033, 1041); panel VPS morph riêng qua `softRender` + `oaBindWorkers(host)` (REC registry gỡ listener con trước khi gắn lại → không gắn đôi); nút Dừng tất cả optimistic không nhấp nháy (mutate không đổi `oaSig`); dọn `oaPaintT/oaOnlineT/oaDayT/hashchange` trong `dataUnsub` khi `stopData`; `outreachSubbed`/`oaSig` là biến closure của `startData` → reset theo phiên; `permission-denied` trên outreach_log/workers/outreach_stats đi `snapErr` → banner + 4 lượt đăng ký lại (v119-65).
- XSS: mọi giá trị từ Firestore đi `esc()` (name/brand/action/text/when/label/pid/challenge/workerId/version); số ép `Number()`; `grad` esc trong attr style (super ghi).

## C. Đề xuất thông minh
1. **Kênh `fb_accounts` realtime + chữ ký cờ nick** (Nhỏ; `live.js` lazyOutreach + `oaSigMain`) — đóng B-1, bảng nick/ Cảnh báo phản ứng trong ~1 s như log.
2. **Màn "Hàng đợi & kẹt"** (Vừa; `45-outreach.js` + Rules read super cho `outreach_threads`/`outreach_tasks` + index `tasks(status,createdAt)`): card đếm `queued / running / failed (dead-letter) / skipped_role / paused` + bảng thread `active && nextAt < now−30′` ("kẹt: nick X needLogin") với nút "Chuyển nick" (= `_l34_move.mjs` trên web) và "Mở lại". Trả lời trực tiếp "vì sao lead X chưa được chạm".
3. **Dấu vết máy theo lead cho super** (Nhỏ; `65-charts-lead-modal.js` + `live.js` + index `outreach_log(leadId ASC, at DESC)`): mục "Máy đã làm" trong modal = query 20 log của leadId, hiện nội dung đã gửi + nick + trạng thái; kết hợp B-5 để sales cũng thấy câu đã gửi.
4. **Hoạt động gần đây có bộ lọc + gộp trùng + bấm mở lead** (Nhỏ; `45:616-627`, `652-654`): chip lọc Brand/Nick/Trạng thái, "chỉ lỗi", gộp `paused` lặp "×N", `data-lead` → `openLead(r.leadId)`.
5. **"Sức khoẻ tổng" 1 dải đầu tab Tiếp cận** (Nhỏ; `45` views.outreach): N brand bật · N nick chạy được/N · VPS online/paused · task kẹt · lượt gần nhất lúc nào — trả lời "hệ thống có đang chạy không" trong 1 giây thay vì cuộn 4 khối.
6. **Đồng bộ trần van với worker + cảnh báo hết van** (Nhỏ; `45:320,362` + `sysAlertRows`): `OA_CAP_MAX` = hardCaps; khi `usage ≥ 90% cap` brand → dòng Cảnh báo "brand X sắp hết van inbox hôm nay" (đóng B-2).
7. **"✓ Đã xử lý" giữ lịch sử Safety** (Nhỏ; `live.js:621`): chỉ reset `needLogin/challenge/safetyPaused/active/nextFreeAt`, giữ `challengeTotal/needLoginTotal`, đặt `safety` = 60 thay vì 100 → worker tự giãn nhịp thêm vài ngày với nick vừa checkpoint (cân nhắc — v119-43 cố ý reset 100; nên hỏi anh).
8. **Content Studio kiểm soát kỹ hơn** (Vừa; `45:220-305`): đếm ký tự live cho intro/CTA/mẫu + cảnh báo mẫu >220 (comment) / >320 (inbox) sẽ bị `clean()` cắt; "Sinh thử ×3 biến thể" (gọi genContent 3 lần, hiện variant/spam từng bản) + ngưỡng spam ≥6 tô đỏ; hiện danh sách biến đủ `{ten}{nhucau}{dichvu}{cta}{optout}`; nút "Xem nội dung máy đã gửi 10 lead gần nhất" từ log.
9. **Nick "nghỉ" có lịch** (Vừa; `45` bảng nick + worker gate): ô "Nghỉ tới <ngày giờ>" ghi `fb_accounts.restUntil` → gate hoãn, chip "nghỉ tới 12/09" thay vì phải tắt/bật tay; hiện `nextFreeAt` ("lượt kế ~14:32") để biết nick còn sống.
10. **Tab Phản hồi khách hiện ngữ cảnh máy** (Nhỏ; `70:138-139`): mỗi dòng thêm "máy đã: react·comment·inbox lúc … qua nick <label>" + câu inbox đã gửi (cần B-5) để sales tiếp quản không hỏi lại từ đầu.
