# A — Rà đối kháng `worker.mjs` bản 2026-09-06d (đọc hết 1496 dòng + config.json + 3 doc + 5 harness)

## A. Phát hiện

**[A-1] [Cao] checkReplies báo GIẢ "khách đã phản hồi" khi khớp nhãn trạng thái "Đã gửi/Sent" của chính tin mình** · worker.mjs:1205–1211
`els = [aria-label] filter /(đã gửi|sent)\s*$/i` · `own = /^(bạn đã gửi|you sent)/` · `after = els.slice(lastOwn+1).filter(e => !own(e))` → `replied: !!after.length`.
Kịch bản: messenger vẽ dấu giao nhận của tin mình là phần tử `aria-label="Đã gửi"` / `"Sent"` / `"Đã nhận"` đứng SAU bong bóng "Bạn đã gửi" → khớp filter, không khớp `own` → `replied:true`, `text:''` (innerText rỗng, `filter(Boolean)` chỉ làm text rỗng chứ không hủy kết luận). Hậu quả: lead nhảy `stage:'responded'`, note "Khách đã phản hồi: \"\"", log `reply`, `outreach_stats.replied+1`, thread `active:false` — sales đuổi theo phản hồi không có thật, KPI "phản hồi" thổi phồng. Nghi ngờ mạnh (nhãn thật trên FB cần kiểm 1 thread), nhưng code hiện KHÔNG có lớp loại trừ nào.
Sửa: chỉ nhận phần tử có `innerText.trim().length>0` VÀ nhãn dạng `^(.+) (đã gửi|sent)$` với tên ≠ Bạn/You VÀ loại nhãn thuần trạng thái (`^(đã gửi|sent|đã nhận|delivered|đã xem|seen).*`); `replied` chỉ khi còn ≥1 phần tử sau lọc; ghi `replyText` bắt buộc khác rỗng.

**[A-2] [Cao] 1 lần đăng xuất bị đếm N lần → nick tự tắt sau 1 phiên khi có ≥3 task cùng nick** · worker.mjs:1261, 883–888
`if (loggedOut(page)) { for (const t of tasks) { await onNeedLogin(t); … } }` — `onNeedLogin` đọc `needLoginCount`+1 và `needLoginTotal: increment(1)` MỖI task. Với `effMax≥3` (chỉnh từ web) và 3 task cùng nick trong 1 vòng claim (claimBatch gom theo nick), phiên đăng xuất ĐẦU TIÊN đã `cnt=3 → active:false`, Safety −30 thay vì −10. Tương tự 1266: checkpoint → `onFail` từng task → `failCount+N`, `tries+1` mỗi thread (lead đốt lượt vì lỗi NICK). Hiện config `maxConcurrent:1` nên chưa lộ; sẽ lộ ngay khi anh nâng số nick cùng lúc.
Sửa: tính counter nick 1 lần/phiên (`onNeedLogin(tasks[0])` cập nhật nick, các task còn lại chỉ hoãn thread + markTask); checkpoint → `onPaused`/hoãn thread thay vì `onFail` (lỗi nick không phải lỗi lead).

**[A-3] [Cao] Comment bài qua API "mơ hồ" → rơi thẳng DOM = có thể ĐĂNG BÌNH LUẬN 2 LẦN** · worker.mjs:494–495, 1039–1047 (đối chiếu 1016–1025)
Đường comment-lead (`gqlReply`) đã có `ambiguous` → `verifyComment` trước khi gõ DOM; đường comment BÀI thì `gqlComment` chỉ trả `ok` (đòi key `comment_create|feedback_comment_edge|comment`), `!ok` → `domComment` ngay. Kịch bản: FB đổi shape response (như đã xoay doc_id 29/08→06/09) hoặc trả `{data:{…}, errors:[lỗi phụ]}` (`hasErr` → ok:false dù comment đã tạo) → API đã đăng, DOM đăng lần 2 công khai = spam/bay nick — đúng loại lỗi hệ thống sợ nhất. `execOnPage` per-step (1146–1150) còn tệ hơn: DOM xong verify-false → `throw` → onFail retry 15' → đăng LẶP tới 5 lần (bản vá v119-39 chỉ áp cho runFunnel; đường này vẫn reachable nếu engine gửi `action:'comment'`).
Sửa: `gqlComment` trả `{ok, ambiguous: res.ok && !real}` (+ coi `errors` kèm `data.comment_create` là ok); bài: ambiguous → reload + `verifyCommentPosted` → thấy = done, không thấy = log "cần kiểm tay" và KHÔNG gõ DOM; xoá/đồng bộ nhánh per-step 1142–1151 theo optimistic-done.

**[A-4] [Vừa] Worker không kiểm trạng thái lead/thread trước khi hành động → vẫn comment/inbox lead đã Loại/Không thành/Đã chốt/đã phản hồi** · worker.mjs:123–136 (gateCheck), 928 (chỉ đọc `doneSteps`)
Task `queued` (lease 30') nằm giữa lúc engine xếp và lúc worker bốc; trong khoảng đó sales bấm Không thành/Đã chốt, khách phản hồi qua kênh khác (funcWebhook đặt thread `replied`, LỆNH #31 tắt thread `skipped_role`) — worker vẫn chạy trọn phễu (gate chỉ soi nick/brand/giờ). Hậu quả: nick nhắn "chào bán" cho khách vừa mua/vừa từ chối, đốt van, log rác.
Sửa: gate thêm 2 read: `outreach_threads/{leadId}` (`active===false || step in [replied, skipped_role, done]` → markTask skipped, không mở nick) + `leads/{leadId}` (`dropped|lost|closed_at|stage in responded/booked/closed` → bỏ qua, refund quota).

**[A-5] [Vừa] `nextMorningVN()` sai trong khung 00:00–08:00 VN → hoãn thêm 24 giờ** · worker.mjs:120, 125
`d = new Date(now+7h); d.setUTCDate(+1); setUTCHours(8, rand(0,40))` — lúc 00:30 VN (đã sang ngày mới theo VN) trả về 8h SÁNG NGÀY KIA. Kịch bản: bỏ "Dừng tất cả" lúc 7:00, hoặc worker khởi động lại 6:00 với task còn queued → gate ngoài giờ → thread hẹn 8:xx ngày hôm sau nữa (mất 1 ngày lead nóng). Sửa: nếu giờ VN hiện tại < `hoursVN[0]` thì không +1 ngày.

**[A-6] [Vừa] Safety Score không bao giờ suy giảm với nick chạy hằng ngày → fail cộng dồn vô hạn rồi tự tạm dừng nick khoẻ** · worker.mjs:281–284, 911, 905–915
`days = floor((now − safetyAt)/1d)`; `safetyAt` ghi lại MỖI phiên → nick có phiên mỗi ngày thì `days` luôn 0 → `failCount` không bao giờ −1/ngày. Đồng thời `onFail` +1 `failCount` cho MỌI lỗi, kể cả lỗi lead/DOM ("không thấy nút Thêm bạn bè", ô soạn không mở, permalink comment không khớp) — không phải sức khoẻ nick. Kịch bản: FB đổi 1 nhãn nút → mỗi nick fail ~2/ngày → sau ~3 tuần `safety<60` giãn nhịp, ~5 tuần `<30` tự dừng CẢ DÀN dù không có checkpoint nào. Sửa: giữ mốc suy giảm riêng (`safetyDecayAt` chỉ tiến theo số ngày đã trừ); lỗi selector/nội dung (`e.selector`/skip) không cộng `failCount`; hoặc chỉ cộng khi lỗi lặp trên ≥2 lead cùng phiên.

**[A-7] [Vừa] `detectChallengeStrict` quét `div[role="dialog"]` — nhưng bài permalink của FB CHÍNH LÀ dialog (`POST_PERMALINK_DIALOG`)** · worker.mjs:243, gọi ở 1088/1099
Bản "chặt" ra đời để tránh quét nội dung bài; nhưng khi bài mở dạng dialog, `zones` chứa toàn bộ text bài + bình luận (≤4000 ký tự). Khi 1 bước lỗi (rất hay: selector trượt), regex `RATE_LIMIT` ("tạm thời bị chặn"), `SUSPENDED` ("tài khoản… bị vô hiệu hoá"), `LOGIN_SECURITY` ("xác nhận danh tính") khớp bài/bình luận của người dùng (nhóm mua bán tài khoản, nhóm tuyển dụng nói về "khoá tài khoản") → `flagChallenge` → needLogin:true, `challengeCount+1`, 3 lần → `active:false`, Safety −20/lần. Sửa: bỏ qua dialog có `div[role="article"]` bên trong hoặc chỉ nhận dialog không chứa article; hoặc đòi thêm URL/`form[action*=checkpoint]`.

**[A-8] [Vừa] Đóng worker (SIGINT/đóng cửa sổ/run.bat chạy lại) giữa bước → mất `doneSteps` → reaper requeue → LÀM LẠI bước = comment/inbox đôi** · worker.mjs:1419, 1479; thứ tự 1091→1094 (logStep/stampLead TRƯỚC markDone)
`goOffline` = 1 write rồi `process.exit(0)` ngay, không chờ `busy`. Quy trình vận hành chính thức ("đóng cửa sổ worker → run.bat") rơi đúng cửa sổ: đã Enter gửi tin/bình luận nhưng chưa `markDone` (hoặc chết trong 5 lần retry markDone) → task `running` → reaper 20' → requeue → bước chạy lại. Recycle 6h an toàn (giữa 2 tick) nhưng tắt tay thì không. Sửa: SIGINT → `stopping=true`, chờ `busy===false` (trần 3'), rồi mới exit; ghi `doneSteps` + log + stampLead trong 1 `db.batch()` NGAY sau hành động (trước cả bumpStat) để thu hẹp cửa sổ về 1 write.

**[A-9] [Vừa] `checkReplies` chỉ kiểm mỗi thread tối đa 6 lần cách 60' rồi bỏ hẳn → khách trả lời sau ~6 giờ (tối/hôm sau — đa số) KHÔNG BAO GIỜ được phát hiện** · worker.mjs:1177, 1215, 1168
`replyChecks>=6 → bỏ`; mỗi lần "chưa trả lời" +1; cadence `everyMin` 60. Thread vào top-5 (theo id, không theo thời gian) → 6 giờ liên tiếp rồi mù. Ngoài ra `.limit(80)` không orderBy (1170): nick có >80 thread `done` tích luỹ → 80 thread cũ nhất theo id chiếm chỗ, thread mới ngoài cửa sổ → `cands` rỗng vĩnh viễn (lộ sau vài tuần vận hành). Sửa: lịch kiểm backoff theo `replyCheckedAt` (1h·4h·12h·24h·48h·7d), sắp `cands` theo `nextAt desc`, query thêm `where nextAt >= now−days` (cần composite pid+step+nextAt) hoặc đọc danh sách hội thoại chưa đọc 1 lần (xem C-3).

**[A-10] [Vừa] `checkReplies` ghi đè `stage='responded'` không điều kiện** · worker.mjs:1220
Lead đã `booked/closed/lost` (sales xử lý xong) mà khách nhắn thêm → tụt về "Đã phản hồi", `stage_at` mới, `daily_stats.responded` +1 lần nữa, không ghi `stage_log`. Sửa: đọc lead; chỉ đổi stage khi đang ở new/contacted; luôn ghi `outreach_replied*`; thêm `stage_log` (v119-80) cho mốc máy.

**[A-11] [Vừa] Config merge nông: khai 1 khoá con là MẤT các khoá con còn lại** · worker.mjs:29–57, 140
`Object.assign(defaults, config.json)`; `hardCapCheck`: `cap = Number(hardCaps[kind]); if (!cap) return null`. Anh viết `"hardCaps": {"react": 60}` → comment/friend/inbox hết van tầng 2 (NaN → null = không chặn); `"safety": {"pauseBelow": 25}` còn ổn nhờ `||`; `"inbox": {"enabled": true}` ổn nhờ `||`. Sửa: merge sâu từng nhóm hoặc log cảnh báo khi khoá con thiếu.

**[A-12] [Thấp] Bước "đã là bạn" khớp `aria-label*="Bạn bè"` quá rộng** · worker.mjs:558, 1058, 1122 — nghi ngờ, cần kiểm 1 profile thật
Nút "Bạn bè chung" / "Xem tất cả bạn bè" (nếu là `role=button` có aria-label chứa "Bạn bè") → `already` → bỏ kết bạn, hoàn quota, ghi done, đi tiếp inbox (tin rơi Message Request). Sửa: khớp chính xác `aria-label="Bạn bè"`/`^Bạn bè$` + "Huỷ lời mời".

**[A-13] [Thấp] Checkpoint ở trang chủ bị phân loại "cần đăng nhập lại" thay vì challenge** · worker.mjs:315, 1261 (trước 1265)
`loggedOut()` khớp `checkpoint` trong URL → `onNeedLogin` (Safety −10, nhãn "cần đăng nhập lại") chạy TRƯỚC `detectChallengeStrict` (đang có nhánh URL /checkpoint → LOGIN_SECURITY). Web mất thông tin loại challenge. Sửa: ở 1261 nếu URL có /checkpoint → đi nhánh `flagChallenge`.

**[A-14] [Thấp] `nickTimeoutMs` cố định 8' không theo số việc/phiên** · worker.mjs:40, 1404–1408
1 phễu ≈ 2–4' (2× gapSensitive 20–45 s + gõ + chờ) + `checkReplies` 5 thread (có giải mã uid ≈ 15 s/thread) ≈ 1–2' → 2 task cùng nick/phiên gần chắc vượt 8' → task 2 bị huỷ cứng → hạ tầng 10' → lặp. Sửa: `timeout = base + perTask×n + (inbox.enabled ? maxThreads×20 s : 0)`.

**[A-15] [Thấp] Gõ 45–50 ký tự/giây, không jitter; `adspowerStop` không timeout; `docCache` không dọn** · worker.mjs:103–109 (delay 20–22 ms), 306, 111–118
Nhịp gõ máy 10× người thật là tín hiệu automation rẻ tiền để đo. `adspowerStop` fetch không `AbortSignal` → finally treo (không chặn tick nhưng giữ event loop). Sửa: delay `rand(45,140)` + ngừng 300–900 ms mỗi 8–20 ký tự; `AbortSignal.timeout(20000)`.

**[A-16] [Thấp] Task thiếu `adspower_id`/`createdAt` → chạy sai profile hoặc vô hình** · worker.mjs:1368, 1378, 1387 — nghi ngờ, cần kiểm engine `apEnqueueFunnel`
`orderBy('createdAt')` loại doc không có field; `byNick` key rơi về `t.pid` (`apk1…`) → `adspowerStart('apk1…')` sai id → hạ tầng 10' lặp vô hạn, không dead-letter.

## B. Đã kiểm, an toàn
- Giành task: transaction `status==='queued'` → `running` (1379–1383); reaper transaction + cutoff 20' > watchdog 8' (1343–1350); huỷ cứng: `ctl.aborted` + `browser.close()` chỉ ngắt CDP, `abortCheck` trước mỗi bước, lỗi sau huỷ → `onInfra` không đốt tries, `doneSteps` nguyên (1085, 1287, 1299); `runGen/superseded` chặn `adspowerStop` nhầm + bỏ `safetyRecalc` zombie (1308, 1314).
- `doneSteps` chống làm lại khi retry/hoãn giữa phễu (928, 964); `markDone` thất bại → `active:false` + throw (938–944); `refundQuota` chỉ bước chưa done, không hoàn đôi (896–903, 1059).
- React: API `feedback_react` thật mới OK; DOM best-effort không toggle-retry (985–1010); comment-lead: `findCommentEl` regex ranh giới + `data-sl-target`, fail-closed; `replyComment` chọn ô theo focus/mới/vị trí, chỉ tính "nội dung của mình" còn trong ô; `gqlReply` mơ hồ → verify trước DOM (1025).
- Inbox: `domInboxProfile` loại ô "bình luận", verify ô sạch, bám tab mới (796–835); `resolveProfileUid` loại uid của mình, fail-closed.
- Gate/van: `hardCapCheck` giữa bước + `pausedAll` giữa bước; `gateCheck` trước mở nick (nick tắt/needLogin/safetyPaused/brand off/giờ); `pageLang` ≠ vi → hoãn 60' không đốt tries; `onSkip` + hoàn quota; `flagChallenge` `challengeCount≥3 → active:false`, thành công reset.
- Shape Firestore khớp FE: `outreach_log` đủ leadId/name/brand/brandCode/temp/score/pid/action/text/status/at/expireAt (trừ 263/287 thiếu temp/score — cosmetic); `outreach_stats` key ngày VN; `leads.outreach` merge sâu không đè `replied_at`; `outreach_map` đúng shape funcWebhook; TTL `expireAt` ở mọi sink log.
- Backoff tick, heartbeat, `watchMyNicks` giữ danh sách cũ khi lỗi, recycle chỉ giữa 2 tick, `withTimeout` không rò timer.

## C. Đề xuất thông minh
1. **Ghi tiến độ nguyên tử**: `db.batch()` gộp `doneSteps + outreach_log + leads.outreach` ngay sau hành động, `bumpStat` sau → đóng A-3/A-8 tận gốc; kèm SIGINT graceful. Nhỏ.
2. **Pre-flight lead/thread** (A-4) + **dedupe theo dấu vết**: trước comment, `verifyCommentPosted` với 24 ký tự đầu của `comment_msg` (kể cả nick khác cùng brand) → đã có thì ghi done không gõ. Chống double xuyên retry/engine re-enqueue/thread mở lại (LỆNH #28). Nhỏ.
3. **Đọc phản hồi qua danh sách hội thoại chưa đọc** thay vì mở từng thread: mở `/messages/t/` 1 lần, lấy các hàng "chưa đọc" (badge/`aria-label` "Chưa đọc"), khớp tên với `outreach_threads.name`/uid từ link `t/<id>` → chỉ mở thread có tín hiệu. Rẻ 5–10×, phủ mọi thread, hết giới hạn 6 lần/80 doc (A-9). Vừa.
4. **Lưu `thread_id` messenger khi inbox** (URL sau khi bấm Nhắn tin `/messages/t/<id>` hoặc tab mới) vào thread → checkReplies mở thẳng, không cần giải mã uid, bắt được cả người dùng pfbid/Page. Nhỏ.
5. **Van trượt theo giờ** (`outreach_usage.hour_<h>` hoặc đếm log 60' gần nhất/nick): từ chối task nếu nick đã ≥N hành động trong 60' → hết burst sáng 8:00–8:40 (mọi nick cùng dậy) và burst khi bỏ Dừng tất cả; kèm rải `nextMorningVN` 8:00–10:30 theo hash pid. Nhỏ.
6. **Bộ dò "FB đổi giao diện"**: ≥3 lead liên tiếp/≥2 nick cùng lỗi `không thấy nút…` trong 1 giờ → worker tự `pauseAll` + log `system_alerts` (web card Cảnh báo hệ thống đã có) thay vì mỗi nick đốt 5 tries + failCount (A-6). Nhỏ.
7. **Chế độ `dryRun`** trong config (điều hướng thật, KHÔNG click/Enter/graphql, log "sẽ làm X") để nghiệm thu nick mới/brand mới/DOM mới không tốn hành động thật, và nhìn ảnh `errors/` trước khi bật. Nhỏ.
8. **Xác nhận giao tin inbox**: sau Enter chờ 3 s, quét khung chat tìm "Không gửi được/Tin nhắn chưa gửi/isn't receiving messages/đang chờ" → không giao = fail (không cộng KPI inbox), ghi `inbox_state: delivered|request|blocked` lên thread → nội dung/CTA đo đúng (LỆNH #34). Nhỏ.
9. **Hành vi giống người rẻ tiền**: thời gian "đọc" bài tỉ lệ độ dài (`min(25 s, 2 s + 30 ms×ký tự)`), cuộn xuống phần bình luận trước khi react, gõ có jitter + pause (A-15), di chuột tới nút trước khi click thay `force`. Nhỏ–Vừa.
10. **Ưu tiên lead theo giá trị khi nhiều task/nick**: `claimBatch` sắp theo `temp`/`score` trước `createdAt` trong cùng nick (nóng trước) — engine đã lọc nhưng worker là nơi quyết định thứ tự khi backlog sau pause. Nhỏ.

## D. Việc cần dữ liệu thật để kết luận
- `outreach_log where status=='reply'`: đếm `text==''` hoặc `text∈{Đã gửi,Sent,Đã nhận}` → xác nhận/bác A-1; đối chiếu lead có `outreach_replied` mà không có note người thật sau đó.
- 1 thread messenger thật: dump `[aria-label]` quanh tin cuối (label bong bóng của khách, dấu giao nhận) để chốt regex A-1.
- `outreach_threads where pid==X & step=='done'` count theo nick (>80?) và phân bố `replyChecks` → A-9.
- `fb_accounts`: `failCount/okCount/safety/safetyAt` + tần suất phiên/ngày → xem `failCount` có đang đơn điệu tăng (A-6).
- `outreach_log` `status=='fail'` gộp theo `text` 14 ngày → tỉ lệ lỗi selector vs lỗi nick.
- `outreach_tasks`: có doc thiếu `adspower_id`/`createdAt`, hoặc `status=='queued'` với `workerId` không còn VPS (A-16, kẹt).
- Log `paused` có `text` "thử lại 08:xx" ghi lúc 0–8h VN → có ca hoãn 2 ngày chưa (A-5).
- Phân bố `replied_at − inbox_at` từ funcWebhook (nick func) → chọn lịch backoff checkReplies.
- `errors/*.png` theo bước 7 ngày trên VPS → bước nào trượt DOM nhiều nhất (ưu tiên vá selector / dò đổi giao diện C-6).
