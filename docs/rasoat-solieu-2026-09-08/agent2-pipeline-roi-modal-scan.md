# Agent rà số liệu — Pipeline / ROI / modal lead / Hộp việc / Lịch sử quét / Bài đã quét (08/09/2026, đọc code cây v119-77)

Đọc xong toàn bộ 6 file + `20-feed.js` (nơi thực đặt `trustPanel/slaChip/fuChip/crmCfg`) và `assets/js/live.js` (nguồn `D.kpi`, cửa sổ 500 lead, `scans` limit 1000). Dưới đây là danh sách phát hiện.

---

## MỨC CAO

**1. `60-scan-views.js:349` — "Nhịp quét ~3 phút/lượt" là số CỨNG cho brand user**
Nhánh `!scans.length` (admin/sales không đọc được `scans` theo Rules) in thẳng `'~3'`. Nhánh super ở dòng 355–361 mới tính thật (`cad` từ khoảng cách giữa các lượt). ⇒ Khách hàng luôn thấy "~3 phút/lượt" kể cả khi scheduler chết, nhịp thật là 20 phút, hoặc BrightData ngưng. **Ảnh hưởng:** admin/sales brand. **Sửa:** bỏ số, ghi "theo lịch cấu hình" hoặc đẩy `lastScanAt`/`cadence` xuống một doc công khai cho brand đọc.

**2. `40-roi.js:95` + `:166-167` — "Dự báo chốt 30 ngày tới" cộng cả deal ĐÃ CHỐT**
`stageRows` (dòng 84–88) duyệt toàn bộ `D.stages` **gồm cả `closed`**, và `ROI_STAGE_P.closed = 100` (dòng 26). Nên `expDeals = Σ n×p/100` và `expVal` đã bao gồm 100% số deal chốt trong quá khứ → `f30Deals/f30Val` = dự báo tương lai chứa doanh thu đã thu. Tệ hơn: nhãn dòng 166 ghi *"từ `${fmt(C.open.length)}` lead đang mở × xác suất giai đoạn"* nhưng `C.open` **loại** `closed` ⇒ mẫu số công bố ≠ công thức chạy. **Ảnh hưởng:** mọi vai. **Sửa:** `stageRows.filter(r=>r.st.key!=='closed')` khi tính `expDeals/expVal`.

**3. `65-charts-lead-modal.js:325` — "lần đầu thấy số này" là khẳng định SAI**
`others` (dòng 323) chỉ lọc trong `D.leads` = cửa sổ realtime 500 lead. Chip in `'lần đầu thấy số này'` khi `others.length===0`. Chính khối này có nút "Tìm thêm trên máy chủ" (`phSrv`) — tức code tự biết dữ liệu là một phần. **Ảnh hưởng:** sales (bỏ qua khách quen, gọi lại từ đầu). **Sửa:** đổi thành "chưa thấy trong dữ liệu đã tải" và tự chạy `findByPhone` khi mở lead có SĐT.

**4. `60-scan-views.js:431` vs `:439` — cùng nhãn "Chưa đạt / loại", hai con số khác nhau**
KPI card dùng `c.scored_low + rejected` với `rejected` (dòng 400) chỉ cộng 5 decision (`prefiltered_out+excluded+no_keyword+self_comment+seller`) — **thiếu `error` và mọi decision lạ**. Chip lọc dùng `rejCnt = all.length - leadCnt` (dòng 422) — có đủ. Chênh lệch = số bài lỗi chấm. **Ảnh hưởng:** super + brand. **Sửa:** dùng chung `rejCnt` cho cả hai.

**5. `10-core-overview.js:598-599, 608` — "Lãi gộp" so phí gói CẢ THÁNG với chi phí MỚI TỚI HÔM NAY**
`fee = roiParamsFor(brandDoc).fee` (phí trọn tháng) trừ `costVnd` = BrightData/AI/eKYC cộng dồn **từ đầu tháng đến giờ** (`consumed`, `M.aiUsd`). `mar = profit/fee*100` in ra như số chốt. Ngày 2 của tháng biên lợi nhuận ~95%, cuối tháng tụt. Dòng tổng (608) cùng lỗi. **Ảnh hưởng:** super admin ra quyết định giá. **Sửa:** hoặc prorate `fee × daysEl/daysInMonth`, hoặc đổi nhãn cột thành "Chi phí đến hiện tại" và bỏ cột %.

**6. `30-pipeline.js:251` — "· N việc hôm nay" đếm SỐ LOẠI DÒNG, không phải số việc**
`(stuckLeads.length?1:0)+(junkLeads.length?1:0)` ⇒ tối đa luôn là **2**. 40 lead kẹt + 15 lead rác vẫn hiện "2 việc hôm nay". **Sửa:** `stuckLeads.length + junkLeads.length`.

**7. `30-pipeline.js:182` vs `10-core-overview.js:119` — hai định nghĩa "Hẹn hôm nay"**
`pvFilters.today` = `fu_at <= cuối ngày hôm nay` ⇒ **gồm cả quá hẹn từ những ngày trước**. `todayBoard.dueToday` = `fu_at > now && fu_at <= eod` ⇒ **loại** quá hẹn (card Hôm nay ở Overview `20-feed.js:107`, nhóm Hộp việc `70-shell-tools.js:91`, `50-config-views.js:446` đều dùng bản này). Chip pipeline "Hẹn hôm nay" luôn ≥ card Overview. Thêm nữa `todayGo` (`20-feed.js:121`) map **cả** `overdue` lẫn `due` về `pipeFilter='today'` → bấm hai ô số khác nhau ra cùng một danh sách. **Sửa:** tách `pvFilters.today` (chỉ trong ngày, chưa tới giờ) và thêm `pvFilters.overdue`.

**8. `40-roi.js:46-50` + `:203` — tỉ lệ chốt "thực tế" có mẫu số bẩn**
`cohort = arr.filter(l => l.temp===t && detected_at < now-30d)` — **không loại `dropped`/`lost`**, trong khi `open`/`stageRows` (dòng 59, 85) đều loại. Lead đã Loại/Không thành không bao giờ `stage==='closed'` ⇒ kéo tụt tử số/giữ nguyên mẫu số. Khi `n>=15` con số này **tự đè** tham số cấu hình (`auto`) và in ra dòng 203 là *"thực tế X% (n mẫu)"*. Cộng thêm: cohort >30 ngày lấy từ cửa sổ 500 lead mới nhất ⇒ thiên lệch sống sót. **Sửa:** thêm `&& !l.dropped && !l.lost` và ghi rõ "mẫu trong dữ liệu đã tải".

**9. `40-roi.js:229, 237-238` — chế độ Đơn giản: phí gói THÁNG ÷ lead CẢ CỬA SỔ**
`roiSimpleN = leadsMonth || (open.length + closedN)` — không có bất kỳ ràng buộc thời gian nào, `closedLeads` (dòng 60) cũng không loại junk/dropped. Nhãn "Tổng lead nhận được / lead hợp lệ đã tạo" + "Chi phí mỗi lead = phí gói `fee` ÷ N" ⇒ nếu cửa sổ chứa 3 tháng lead thì CPL bị chia 3. Hero (`roiHeroHtml:143`, "tiết kiệm mỗi tháng") dùng cùng N. **Ảnh hưởng:** đây là con số bán hàng chính cho brand mới. **Sửa:** lọc `detected_at >= đầu kỳ 30 ngày` và ghi rõ khoảng.

**10. `40-roi.js:73` + `:156` — `nMonth` fallback không có cửa sổ thời gian nhưng nhãn ghi "/tháng"**
Chuỗi: `leadsMonth` → đếm hot+warm trong 30 ngày → **fallback `arr.filter(hot||warm).length`** (toàn cửa sổ, không giới hạn ngày). `cplSL = fee/nMonth` in ra là *"= phí gói ÷ N lead nóng+ấm"* trong khối "Chi phí mỗi lead SmartLead". Cùng lỗi lan sang `adsCost`, `saving`, hero, và cột "Nóng+Ấm/th" ở bảng super (`:401`). **Sửa:** bỏ fallback 3, để `nMonth=0` → hiện "—" thay vì số sai.

---

## MỨC VỪA

**11. `40-roi.js:390` — "Lead đang xử lý · toàn hệ thống" trong khi nguồn là cửa sổ 500 lead**
`tot.open` cộng từ `D.leads`. Trớ trêu là dòng ngay trên (`:388`) làm đúng: *"… `${(D.leads||[]).length}` lead gần nhất"*. **Sửa:** dùng cùng cách diễn đạt "trong lead gần nhất đã tải".

**12. `40-roi.js:393` — dự báo "toàn hệ thống" chạy bằng THAM SỐ MẶC ĐỊNH**
`roiForecastHtml(roiCompute(D.leads||[], roiParamsFor(null), 0, 0))` — bỏ qua `brands/{code}.roi` mà bảng ngay dưới (`rows`, dòng 355) đang dùng. Doanh thu dự báo hệ thống ≠ tổng dự báo từng brand, và tỉ lệ chốt tự học bị trộn chung mọi brand. **Sửa:** cộng `fc` của từng `rows[i].C`.

**13. `40-roi.js:154` + `:180` — "Giá trị pipeline ước tính" trộn doanh thu ĐÃ THU vào pipeline**
`C.expected + C.realized`. `realized` gồm cả `realizedReal` (tiền đã chốt thật). Pipeline theo nghĩa thông thường là cơ hội còn mở. Nhãn phụ *"= N lead × giá trị kỳ vọng + M đã chốt"* cũng sai dạng công thức (thực tế là Σ theo từng lead, không phải N × trung bình). **Sửa:** tách hai dòng "Pipeline đang mở" và "Đã chốt".

**14. `40-roi.js:87` (stage) vs `:63` (temp) — hai mô hình xác suất cùng trang**
`expected` = giá trị nền × tỉ lệ chốt theo **nhiệt độ**; `stageRows.val` = giá trị nền × xác suất theo **giai đoạn** (`ROI_STAGE_P`). Cả hai đều được gọi là "giá trị pipeline"/"phễu giá trị" (`roiStagesHtml:210`) và cho tổng khác nhau. **Sửa:** chọn một mô hình, hoặc ghi rõ "cách tính B — đối chiếu".

**15. `40-roi.js:363, 371-372, 380` — phương trình hero super không khớp con số hiển thị**
Hiện `= Σ từng brand (lead × CPL riêng) − tổng phí gói ${tot.fee}` nhưng `tot.save = Σ max(0, adsCost−fee)` (kẹp 0 tại `:76`). Có brand âm ⇒ `tot.save ≠ adsSum − tot.fee`. `sysMult = adsSum/tot.fee` lại dùng bản KHÔNG kẹp ⇒ "rẻ hơn X lần" không nhất quán với số tiết kiệm. **Sửa:** hiển thị cả tổng âm hoặc đổi text thành "Σ tiết kiệm của các brand có lợi".

**16. `40-roi.js:355-357, 359` — "N brand đang hoạt động" phụ thuộc cửa sổ realtime**
`active = rows.filter(r=>r.arr.length || (r.b&&r.b.roi))`. Brand thật nhưng lead đã trôi khỏi 500-window và chưa có `roi` riêng ⇒ **rơi khỏi `tot.fee`** ⇒ "Tổng phí gói / tháng" tụt và "tiết kiệm" méo. **Sửa:** `active` = brand có `status active` trong `D.brands`, không suy từ lead.

**17. `30-pipeline.js:238-246` vs `:367` — phễu và đầu cột lệch khi bật bộ lọc**
`fSegs` đếm `PL.filter(stage===key)` (**không** áp `pipeFilter`), còn `.kh .c` đếm `items.length` (**có** áp filter). Bật "Điểm ≥ 80": phễu ghi 120, đầu cột ghi 14. **Sửa:** truyền `pipeFilter` vào `fSegs` hoặc ghi nhãn "toàn pipeline" cho phễu.

**18. `30-pipeline.js:89-105, 383-384` — tuổi thẻ / "Quá hẹn X phút" đứng yên, không tick**
`pvStartTick` (dòng 93–105) chỉ cập nhật `.pv2-justrow b` của thẻ "Vừa chuyển". `x.age`, `pv2-hint` ("Quá hẹn 12 phút"), `slaChip` (`20-feed.js:296`), `fuChip` (`20-feed.js:310`) đều tính lúc render. `pvSignature` (`:9`) không chứa thời gian ⇒ SOFT_RELOAD cũng không vẽ lại. Dashboard mở 3 tiếng vẫn ghi "Quá hẹn 12 phút" và lead vượt mốc 2 ngày không hiện "kẹt". **Sửa:** cho `pvTick` cập nhật cả `.pv2-age/.pv2-hint`, hoặc gộp `Math.floor(Date.now()/6e5)` vào `pvSignature`.

**19. `60-scan-views.js:344` vs `10-core-overview.js:109` — hai mốc "hôm nay"**
`lastScanInfo` tính `dayStart` bằng **UTC+7 cứng**; `todayBoard`/`nextBestLeads` dùng `setHours(0,0,0,0)` = **giờ máy**. Ghi chú ở `20-feed.js:314` nói đã thống nhất về giờ máy nhưng `lastScanInfo` chưa đổi. Máy không ở UTC+7 ⇒ "Lead hôm nay" (scanbar) ≠ "Lead mới hôm nay" (card Hôm nay). **Sửa:** dùng chung một helper `dayStart()`.

**20. `60-scan-views.js:27, 50, 63` — "Tổng" thực chất là cửa sổ 1000 lượt quét**
`live.js:1087` subscribe `scans` với `limit(1000)` (~48h ở nhịp 3′). `A.posts/A.leads` gắn nhãn "Tổng bài đã quét"/"Lead tạo ra", `A.conv = leads/posts*100` gắn nhãn "tỉ lệ chuyển đổi", donut ghi *"Toàn bộ bài đã chấm"*. Không có gì là "tổng"/"toàn bộ". **Sửa:** ghi "1.000 lượt quét gần nhất (~48 giờ)".

**21. `60-scan-views.js:326, 330` — brand user thấy "Đang trực 24/7" giữa lúc BrightData ngưng**
`bdDown()` yêu cầu `roleIsSuper()` (Rules chặn `system_status` với brand). Nên `sbLive()` trả "Đang trực 24/7" cho brand user trong đúng lúc engine lấy 0 bài. **Sửa:** mirror một cờ `ok` ẩn danh sang `config/app` để brand đọc được, hoặc hạ nhãn xuống "Quét tự động: đang bật".

**22. `60-scan-views.js:436-439` — số trên chip lọc không khớp số dòng hiện ra**
`arr.length` là số **nhóm (bài cha)**, còn `leadCnt/commentTotal/rejCnt` là số **bài+bình luận**; nhưng bộ lọc `flt = arr.filter(spPred)` chạy trên **nhóm**. Bấm "Thành lead 30" có thể ra 12 thẻ. Thêm nữa `spPred.lead` và `spPred.rejected` (`:416,418`) **chồng nhau** (bài là lead + có 1 comment không lead ⇒ khớp cả hai). **Sửa:** đếm chip bằng `arr.filter(spPred[k]).length`.

**23. `60-scan-views.js:172, 198` vs `:391, 431, 441` — hạn lưu trữ mâu thuẫn: 1 ngày hay 7 ngày**
`decisionReason('scored_low')` và `ttl` trong `openScannedPost` ghi "tự xoá sau 1 ngày / ~1 ngày"; empty-state, KPI card và tooltip toolbar ghi "tự xoá sau 7 ngày". **Sửa:** lấy TTL thật từ config, một nguồn duy nhất.

**24. `70-shell-tools.js:130` — `replies` gắn nhãn "Đã có người tiếp quản" cho lead chưa ai đụng**
`done = humanAfter || l.stage!=='responded'`. Danh sách `replyLeads` (`:127`) nhận cả lead chỉ có `outreach.replied_at` mà `stage` vẫn là `new/inbox` (engine phát hiện phản hồi nhưng chưa đổi giai đoạn) ⇒ `stage!=='responded'` đúng ⇒ **done=true** ⇒ rơi vào nhóm "Đã tiếp quản". Đồng thời `inboxTasks` (`:90`) đếm `T.replied` = **mọi** lead `responded` kể cả đã xử lý, còn badge `cntReplies` (`:936`) đếm `!done` ⇒ hai con số "khách phản hồi" khác nhau ở chuông và ở sidebar. **Sửa:** `done = humanAfter || ['booked','closed'].includes(l.stage)`; `inboxTasks` dùng chung `replyLeads().filter(!done)`.

**25. `70-shell-tools.js:930` — badge "Lead mới chưa xử lý" đếm cả lead đã ẩn khỏi feed**
`(D.leads||[]).filter(l=>l.stage==='new')` — không loại `dropped/lost/temp==='junk'`, trong khi feed ẩn đúng nhóm đó (`feedHidden`, `20-feed.js:664`). Badge ghi 37, mở feed thấy 21. **Sửa:** áp `!feedHidden(l)`.

**26. `20-feed.js:143` + `65-charts-lead-modal.js:17,25` — donut "Phân loại lead" bỏ lead rác khỏi mẫu số**
`total = k.hot+k.warm+k.cold`, phần trăm cộng đủ 100% trong khi lead `junk` vô hình; ngược lại `D.kpi.*` (`live.js:126`) **có** tính `dropped/lost`. Ba nơi (pipeline `PL`, ROI `open`, donut) loại/giữ ba tập khác nhau. **Sửa:** thống nhất một hàm `activeLeads()` và ghi rõ "không tính lead rác" dưới donut.

**27. `20-feed.js:712-723` — "Độ tin cậy hồ sơ": không có số bịa, nhưng kết luận vượt dữ liệu**
Không có điểm/% cứng (tốt). Vấn đề: `gc>=2` → khẳng định *"tài khoản hoạt động thật, khó là nick lập vội"*; `tlen>=120` → *"hành văn tự nhiên"*; `zalo` → *"danh tính khả năng cao là thật"* — đều là suy diễn từ đúng 1 biến. Ngoài ra chip trạng thái (`:721`) chỉ xét `plus.length>=2` và **bỏ qua hoàn toàn `warn`** ⇒ lead có 2 plus + 3 warn vẫn hiện "Dấu hiệu hoạt động tự nhiên". `gc` cũng chỉ đếm trong dữ liệu quét nội bộ. **Sửa:** hạ giọng thành mô tả dữ kiện ("thấy ở 2 nguồn trong dữ liệu quét") và cho `warn` tham gia quyết định chip.

**28. `65-charts-lead-modal.js:307` — "Dòng thời gian 360°" chỉ có MỘT mốc đổi giai đoạn**
`push(l.stage_at, 'Chuyển sang '+stageLabel[l.stage])` — lead chỉ lưu `stage_at` hiện tại nên hành trình new→inbox→responded→booked hiện đúng 1 dòng cuối. Nhãn "360°" + `<span class="cnt">${ev.length}</span>` gợi ý là lịch sử đầy đủ. Thêm: `fu_at` tương lai được sort chung `b.ms-a.ms` nên **lịch hẹn ngày mai nằm trên cả "Chốt deal" đã xảy ra** (có chú "(sắp tới)" nhưng vị trí vẫn gây đọc nhầm). **Sửa:** tách hẹn tương lai ra khối riêng; ghi "mốc gần nhất" nếu chưa có bảng lịch sử giai đoạn.

---

## MỨC THẤP

**29. `30-pipeline.js:158` — "kẹt" loại trừ cột "Mới"**
`mid = stage!=='new' && stage!=='closed'`. Lead nằm ở "Mới" 90 ngày không bao giờ vào `stuckLeads`, không lên chip "Đang kẹt", không lên "Việc cần chú ý". Tồn đọng lớn nhất lại vô hình. Cân nhắc thêm nhánh "Mới quá X ngày" riêng.

**30. `65-charts-lead-modal.js:276` + `live.js` `findByPhone` — đếm lệch 1**
`findByPhone` trả `found` = tổng doc khớp SĐT, **gồm cả lead đang mở**. Toast "Máy chủ có 1 lead mang số này" trong khi panel vừa nói "lần đầu thấy số này". **Sửa:** `found - 1` hoặc đổi text thành "tổng N lead mang số này (kể cả lead đang xem)".

**31. `60-scan-views.js:366, 372, 384` — "40 lượt gần nhất" nhưng chỉ dựng ≤9 dòng**
Vòng `while(... && rows.length<9)` dừng sớm; nếu 9 dòng đầu chỉ tiêu thụ 12 lượt thì 28 lượt còn lại không xuất hiện. Đổi nhãn thành "9 mốc gần nhất".

**32. `60-scan-views.js:354` — nhịp quét lọc bỏ khoảng trống ≥120 phút**
`if(g>0&&g<120) gaps.push(g)` ⇒ mọi lần gián đoạn dài bị loại khỏi trung bình, "Nhịp quét" luôn đẹp. Nên hiển thị thêm "gián đoạn dài nhất 24h qua".

**33. `40-roi.js:301` — benchmark CPL ghi cứng trong UI**
"LocaliQ 2025: ~700k₫ · Spa ~1,3tr₫ · F&B ~80k₫" là số ngoài, hard-code, không có ngày cập nhật/nguồn bấm được. Nên đưa vào config kèm nhãn năm.

**34. `70-shell-tools.js:26, 30` — palette tìm lead chỉ trong cửa sổ đã tải, cắt cứng 9 kết quả**
Không có chỉ báo "còn N kết quả" và không fallback `findByPhone` như modal lead. Gõ 4 số cuối của khách cũ ⇒ "Không tìm thấy". Nên thêm dòng "tìm trên máy chủ →".

---

## Tóm tắt

- **Lỗi số nặng nhất nằm ở ROI**: dự báo 30 ngày cộng cả deal đã chốt (`ROI_STAGE_P.closed=100` lọt vào `expDeals/expVal`), chế độ Đơn giản chia phí tháng cho lead cả cửa sổ, và `nMonth` fallback không có cửa sổ thời gian — cả ba đều là con số bán hàng đưa thẳng cho khách.
- **Một số cứng đang được trình bày như số đo**: `'~3'` phút/lượt ở scanbar bản brand (`60-scan-views.js:349`) và "Đang trực 24/7" trong lúc BrightData ngưng — brand user không có cách nào biết.
- **Ngữ nghĩa "toàn bộ/tổng/toàn hệ thống" bị dùng trên dữ liệu cửa sổ** ở ít nhất 5 nơi: ROI super (`:390`), lịch sử quét (`:50`, `:63`), "lần đầu thấy số này" (modal), badge lead mới. `D.leads` là 500 lead mới nhất và `scans` là 1000 lượt gần nhất — không chỗ nào trong 6 file này nói rõ trừ đúng một dòng (`40-roi.js:388`).
- **Ba tập lead khác nhau đang cùng được gọi là "lead"**: pipeline `PL` (bỏ dropped/lost, **giữ** junk), ROI `open` (bỏ cả junk), `D.kpi` (**giữ** dropped/lost, bỏ junk trong donut). Kéo theo mẫu số tỉ lệ chốt tự học bị bẩn (`40-roi.js:46`).
- **"Hẹn hôm nay" có hai định nghĩa** (gồm/không gồm quá hẹn) và hai ô số khác nhau ở Overview cùng dẫn về một bộ lọc pipeline; cộng với việc tuổi thẻ/quá hẹn không tick, các con số thời gian trên Kanban là ảnh chụp lúc render chứ không phải hiện tại.