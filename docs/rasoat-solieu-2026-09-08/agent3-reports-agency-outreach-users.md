# Agent rà số liệu — Báo cáo / Bảng brand / Tiếp cận / Người dùng (08/09/2026, đọc code cây v119-77)

Đã đọc xong. Dưới đây là kết quả rà độ chính xác số liệu.

---

# PHÁT HIỆN (CAO → THẤP)

## CAO

**1. `50-config-views.js:498` — Dòng "Tổng (N nguồn)" của attributionCard cộng SAI phạm vi**
Nhãn ghi `Tổng (${fmt(by.size)} nguồn)` = **tổng số nguồn**, nhưng `tot` (L493) chỉ `reduce` trên `rows` = `[...by.values()].slice(0,12)` (L491). Có 20 nguồn → hiện "Tổng (20 nguồn)" nhưng số chỉ cộng 12 nguồn top. Ảnh hưởng: mọi vai thấy Báo cáo. Sửa: cộng `tot` trên `[...by.values()]` (toàn bộ) hoặc đổi nhãn thành `Tổng 12 nguồn hàng đầu / ${by.size}`.

**2. `50-config-views.js:492,498` vs `:517` — hai con số cùng tên "Chi phí AI (ước tính)" lệch nhau nhiều lần trên CÙNG một trang**
Trên đầu trang: `fmtCost(A.cost)` = tổng `costUsd` thật của mọi lượt quét (toàn thời gian). Dưới bảng attribution, ô Tổng: `fmtCost(tot.n*cpl)` với `cpl=A.cost/A.leads`, `tot.n` = lead trong **cửa sổ realtime** (≤500/4000, đã bỏ junk). Hai mẫu số khác nhau (`A.leads`=`leadsCreated` toàn thời gian **gồm junk**) → ví dụ $100 ở trên, $4.50 ở dưới. Ảnh hưởng: superadmin. Sửa: ô Tổng in thẳng `A.cost` và ghi rõ "phân bổ theo tỷ trọng lead đã nạp", hoặc bỏ ô Tổng.

**3. `50-config-views.js:368-372` — calibCard lấy cohort "≥14 ngày tuổi" từ cửa sổ 500 lead MỚI NHẤT → mẫu thiên lệch có hệ thống**
`cohort = D.leads.filter(detected_at < now-14d)`. `D.leads` là 500 lead mới nhất (auto-fill trần 4000, `live.js:282,310`), sắp xếp `detected_at desc`. Brand chạy mạnh → cả 500 lead đều <14 ngày → cohort rỗng/rất nhỏ; brand chạy yếu → cohort là phần đuôi ngẫu nhiên. Tỷ lệ phản hồi/chốt/loại được gắn nhãn "**THẬT**" (L379) trên mẫu này. Ảnh hưởng: superadmin (Chấm điểm AI là super-only) và quyết định chỉnh trọng số AI. Sửa: dùng counter `daily_stats` theo dải điểm, hoặc query riêng lead 14–44 ngày; tối thiểu ghi "tính trên N lead đã nạp, không phải toàn kho".

**4. `50-config-views.js:382` — bảng dải điểm hiện % với n bất kỳ, không có nhãn "ít mẫu"**
`${x.n?x.resp+'%':'—'}` → band có 2 lead hiện "50% chốt". Cảnh báo `<30` (L378) chỉ hiện khi **không có tip nào khác** fire, mà tip chỉ cần `n>=15` (L374-377) → có thể vừa hiện lời khuyên "tăng trọng số ý định mua" vừa không hề cảnh báo mẫu nhỏ. Đối chiếu: `45-outreach.js:216` có gắn `ít mẫu` cho `n<30` — hai nơi hai chuẩn. Sửa: thêm `<span class="muted">ít mẫu</span>` khi `x.n<30`, và luôn hiện banner đủ/thiếu dữ liệu độc lập với tips.

**5. `25-agency.js:61,70-71` — SLA đạt dùng bucket LÀM TRÒN LÊN, không phải ngưỡng thật của brand**
`slaLim = bad<=15?15 : bad<=30?30 : bad<=60?60 : 120`. Brand đặt `slaBadMin=45` → đếm bucket `careLe60` ⇒ **thổi phồng** SLA (lead chăm ở phút 55 vẫn tính "đạt"). Brand đặt 90 → dùng 120, cũng thổi phồng. Brand đặt 2880 (ô nhập cho phép tới 2880 — `85-users-admin.js:311`) → kẹt ở 120 ⇒ **hạ thấp** SLA. Tệ hơn: nhánh ước tính (`agyLeadWin`, L39 `careLeBad`) dùng **đúng** `bad` ⇒ cùng một cột "SLA đạt" có 2 định nghĩa tuỳ có/không counter. Tooltip cột (L18) vẫn khẳng định "trong **ngưỡng quá hạn của brand**" — sai. Ô có `<small>≤${slaLim}′</small>` (L146) đỡ được phần nào. Sửa: sửa tooltip thành "làm tròn lên bucket gần nhất (≤15/30/60/120′)", và cảnh báo khi `bad !== slaLim`.

**6. `25-agency.js:70-71` — tử số và mẫu số SLA khác cohort, phải `Math.min(100,…)` để che**
Tử = tổng `careLe60` trong 30 ngày (sự kiện **chăm** xảy ra trong cửa sổ, lead có thể phát hiện từ trước cửa sổ). Mẫu = tổng `new` trong 30 ngày (sự kiện **phát hiện**). Chính cái clamp `Math.min(100,...)` là bằng chứng tỷ lệ này vượt 100% được. Ảnh hưởng: superadmin xếp hạng/đánh giá brand. Sửa: đổi CF ghi `careLe*` vào ngày **detected_at** của lead (cohort-based), hoặc đổi nhãn thành "lượt chăm đạt ngưỡng / lead mới cùng kỳ (xấp xỉ)".

**7. `50-config-views.js:8-11,58-59,539-541` — "Tổng lead từ nguồn"/"Lead nóng từ nguồn"/Bảng xếp hạng nguồn chỉ đếm trong cửa sổ 500 lead, nhãn ngụ ý toàn bộ**
`D.sources[].leads/.hot` được dựng ở `live.js:153-157` từ `bySrc` trên mảng lead đã nạp. Nhãn "Tổng lead từ nguồn" không có chú thích cửa sổ, và trong Báo cáo nó nằm cạnh "Lead tạo ra" (`A.leads`, toàn thời gian từ `scans`) → hai con số lead trên cùng màn hình chênh nhau. Ảnh hưởng: sources = super; Báo cáo = **mọi vai**. Sửa: thêm sub "trên N lead đã nạp gần nhất" hoặc lấy từ `daily_stats`.

**8. `50-config-views.js:520-522` + `live.js:131,173` — KPI Báo cáo "Lead đã phản hồi / Đã hẹn / Đã chốt" + 3 tỷ lệ tính trên cửa sổ, mẫu số CÓ CẢ LEAD RÁC**
`valid = leads.length` (không lọc `temp==='junk'`), rồi `responseRate = pct(responded, valid)`. Trong khi attributionCard (L488) và `agyLeadWin` (L37) đều **loại junk** khỏi mẫu số. ⇒ "tỷ lệ phản hồi" ở Báo cáo thấp hơn có hệ thống so với cùng khái niệm ở Bảng brand / bảng attribution. Cộng thêm việc admin/sales còn bị Rules cắt theo `leadFrom/leadTo` (`live.js:1119-1133`) mà tiêu đề in ra là "Toàn hệ thống"/tên brand (L505). Ảnh hưởng: mọi vai. Sửa: thống nhất mẫu số = lead hợp lệ (bỏ junk) và ghi rõ cửa sổ + khung ngày đang áp.

**9. `50-config-views.js:502` + `10-core-overview.js:253` — Báo cáo KHÔNG super-only, nhưng nội dung được viết như báo cáo toàn hệ thống**
`SUPER_ONLY_VIEWS` không có `reports`; `app.html:69` nav "Báo cáo" không có `display:none`. Admin/sales/viewer vào được. May là `D.scans` rỗng với họ nên card "Tóm tắt lịch sử quét" tự ẩn (L509) và cột chi phí AI ra `—` (`cpl=0`) — **không bịa số**. Nhưng đầu trang in `${brandName}` + giờ in (L507) đóng khung mọi số như báo cáo chính thức của brand, trong khi số chỉ là cửa sổ realtime. Sửa: thêm dòng phạm vi bắt buộc vào `print-head` (cửa sổ lead + khung ngày brand).

**10. `live.js:1057` — `outreach_stats` khoá theo ngày VN chốt CỨNG lúc subscribe → sau nửa đêm VN vẫn hiện số HÔM QUA dưới nhãn "hôm nay"**
`var tk = new Date(Date.now()+7*3600*1000)...slice(0,10)` tính một lần; snapshot lọc `x.day===tk` mãi mãi. Đối chiếu `bd_month` có `setInterval(subBd, 30*60*1000)` (`live.js:1098`) để tự sang tháng — `outreach_stats` không có cơ chế tương ứng. Hệ quả: `45-outreach.js:660-662` ("Lead trong phễu **hôm nay**", "Thao tác đã gửi", "Lead phản hồi") và cột "Automation **hôm nay**" ở Bảng brand (`25-agency.js:111`) đóng băng số cũ với máy để mở qua đêm. Sửa: timer soát `tk` mỗi ~5–10 phút, đổi ngày thì re-subscribe (đúng mẫu `subBd`).

## VỪA

**11. `45-outreach.js:86,102-103,660` — "Lead trong phễu hôm nay" thực chất là SỐ LƯỢT REACT, không phải số lead**
Cả hai nhánh đều đặt `funnel = react`. Comment tự nhận "mỗi lead vào phễu đều bắt đầu bằng react" — nhưng đó là số **thao tác**, một lead được react bài + react comment sẽ đếm 2. Con số này còn bị cộng lần nữa vào "Thao tác đã gửi" (L637). Sửa: đổi nhãn thành "Lượt thả cảm xúc hôm nay", hoặc để engine ghi counter `funnelLeads` riêng.

**12. `85-users-admin.js:132` — KPI "Đang hoạt động" dùng `u.active` truthy, lệch quy ước `active!==false` ở mọi nơi khác**
`us.filter(u=>u.active)`. `25-agency.js:65`, `87-brand-wizard.js:255` và `oaNickCount` đều dùng `active!==false` (thiếu field = đang hoạt động). User cũ không có field `active` bị đếm là **không** hoạt động ở đây nhưng **có** ở Bảng brand. Sửa: `u.active!==false`.

**13. `85-users-admin.js:133` vs `:91,124` — KPI "Chờ duyệt" và tiêu đề card "Chờ duyệt · N người" cho 2 số khác nhau**
KPI: `n('pending')` = mọi role `pending`. Card: `pendingUsers` còn loại `rejectedAt` và `SUPER_EMAIL_FE`. Hai số cạnh nhau trên cùng màn hình. Sửa: KPI dùng `pendingUsers.length`.

**14. `50-config-views.js:523-527` + `live.js:146` — "TG phản hồi TB" chỉ tính lead ĐÃ được chăm và CẮT ở 7 ngày**
`respAvg` bỏ mọi lead không có `first_care_at` (lead bỏ mặc = biến mất khỏi trung bình) và bỏ luôn `x >= 7*1440` phút → những ca chăm chậm nhất bị loại ⇒ trung bình luôn đẹp hơn thực tế. Sub-caption chỉ ghi "14 ngày gần nhất". Đối chiếu `25-agency.js:39` cắt ở **30 ngày** cho cùng khái niệm ⇒ "TG phản hồi TB" (Báo cáo) và "TG chăm đầu" (Bảng brand) không so được với nhau. Sửa: caption "chỉ tính lead đã được chăm (N/M lead)"; thống nhất trần 7 vs 30 ngày.

**15. `25-agency.js:89` — thành phần "khối lượng 30 điểm" là điểm TƯƠNG ĐỐI giữa các brand, tooltip mô tả như tuyệt đối**
`30*Math.min(1, r.leads7/maxL)` với `maxL = max(leads7)` toàn hệ thống. Brand giữ nguyên lead vẫn tụt điểm khi brand khác bùng nổ; hệ thống có 1 brand thì brand đó **luôn** full 30. Tooltip (L18) chỉ ghi "khối lượng 30". Sửa: ghi "so với brand mạnh nhất" vào tooltip, hoặc dùng mốc tuyệt đối.

**16. `25-agency.js:89` — nhánh SLA của điểm số có code chết + brand KHÔNG có lead nào được thưởng 10/20 điểm SLA**
`20*((r.sla==null)?(r.leads30?0:0.5):r.sla/100)`. `r.sla==null` ⟺ `w30.new===0` ⟺ `leads30===0` ⇒ nhánh `?0` không bao giờ chạy, luôn lấy `0.5`. Brand chết (0 lead 30 ngày) mà thiết lập đủ nhận 10 (SLA) + 10 (vận hành) = 20/100, xếp trên brand có lead nhưng SLA kém. Sửa: `r.sla==null ? 0 : r.sla/100` và để cột "Điểm" hiện `—` khi không có dữ liệu.

**17. `25-agency.js:72,143` + `:191` — số hiển thị (7 ngày gồm hôm nay) và mũi tên ▲▼ (tuần trọn) dùng 2 cửa sổ khác nhau; agencyCard không hề chú thích**
`leads7 = W(7,0)` nhưng `d7` so `w7c=W(7,1)` với `p7c=W(7,8)`. Trong bảng có tooltip cột giải thích (L18); trong `agencyCard` (L191) chỉ có "7 ngày: **N** lead ▲x%" trần trụi, không tooltip. Sửa: nhét cùng tooltip vào dòng mini card.

**18. `50-config-views.js:539` vs `:490,495` — hai định nghĩa "% nóng" trên CÙNG trang Báo cáo**
Bảng xếp hạng nguồn: `hot/leads` với `leads` **gồm junk** (`live.js:153`). Bảng attribution: `o.hot/o.n` với `L` đã lọc `temp!=='junk'` (L488). Cùng một nguồn ra 2 con số %. Sửa: thống nhất bỏ junh ở cả hai.

**19. `25-agency.js:36` — lead thiếu `detected_at` được coi như phát hiện HÔM NAY (nhánh ước tính)**
`const det = dm || Date.now();` ⇒ lọt vào mọi cửa sổ 7/30 ngày, thổi phồng `leads7`/`leads30` của brand chưa có counter. Comment ghi "(demo)" nhưng code chạy cả ở live khi `D.dailyStats` rỗng. Sửa: bỏ qua lead không parse được mốc thời gian, đếm riêng và hiện "N lead thiếu mốc thời gian".

**20. `50-config-views.js:477-484` — kwTop tính trên cửa sổ lead, nhãn "Keyword hiệu quả nhất" không nói phạm vi; mẫu số quá nhỏ vẫn ra %**
`rate = responded/ls.length` với `ls` từ `D.leads`. Keyword khớp 1 lead đã phản hồi → "100%". Không có ngưỡng mẫu tối thiểu, không có cột cảnh báo. Sửa: ẩn/đánh dấu dòng `leads < 10`, thêm caption cửa sổ.

**21. `50-config-views.js:227,238,244,255` — "mỗi 3 phút" là chuỗi cứng trong FE, không đọc từ bất kỳ config nào**
`scanIv()` (L215) đọc `D.cfg.scanIntervalMin` thật cho "gieo mỗi nguồn", nhưng con số lịch "3 phút" xuất hiện 4 lần dưới dạng literal và cả trong confirm dialog (L284). Backend đổi lịch là UI nói sai. Sửa: đọc từ config (ví dụ `cfg.scanCronMin`), fallback text chung chung "theo lịch".

**22. `live.js:153-157` — join lead↔nguồn bằng CHUỖI TÊN nguồn, đổi tên nguồn là toàn bộ số về 0**
`bySrc` khoá theo `l.source`, tra `bySrc.get(s.name)`. Lead lưu tên tại thời điểm quét (thấy ngay trong demo: `data.js:75` dùng gạch ngang `-`, `app.js:4988` dùng gạch en `–` cho cùng một group). Sửa Tên nguồn ở `openSourceForm` → hàng đó hiện 0 lead / 0 nóng, không có cảnh báo. Ảnh hưởng: view Nguồn quét + Báo cáo. Sửa: join theo `s.id`/`groupId`.

## THẤP

**23. `45-outreach.js:441-442,460` — panel VPS: RAM% hiển thị thô, không nói là của tiến trình hay toàn máy; `runCnt` cộng cả VPS offline**
`ram = w.ramUsedPct + '%' + ' · ' + GB` — `ramTotalMB/1024` làm tròn (32000MB → "31GB" nếu là 31.25… thực ra `Math.round(32000/1024)=31`, lệch nhãn so với "32GB" người dùng biết). `runCnt = ws.reduce(...running)` (L457) không lọc `isOnline` ⇒ VPS chết cứng còn `running:3` vẫn cộng vào "N nick đang chạy". Sửa: chỉ cộng worker online; đổi `Math.round(MB/1024)` sang làm tròn về mốc GB quen thuộc.

**24. `45-outreach.js:77,157` — van hiển thị `max(1, nicks) * cap` ⇒ brand 0 nick vẫn hiện "0/40" như thể có hạn mức**
`oaCap` ép sàn 1 nick. Brand chưa gán nick nên hạn mức thực = 0. Sửa: `nicks===0` → hiện "chưa gán nick" thay vì thanh van.

**25. `45-outreach.js:153` — "Đã rep hôm nay" hiện `—` khi automation TẮT dù counter `replied` có thể >0 hôm đó**
`${c.on ? c.replied : '—'}` ẩn dữ liệu thật (khách vẫn rep tin gửi trước khi tắt). Sửa: luôn hiện số, gắn chip "automation đang tắt".

---

# TÓM TẮT

1. **Nhóm nghiêm trọng nhất là "cửa sổ 500 lead bị trình bày như toàn kho"**: Báo cáo (mở cho *mọi vai*), calibCard dải điểm, bảng nguồn và kwTop đều tính trên `D.leads` — mẫu thiên lệch về lead mới nhất — nhưng nhãn ghi "THẬT"/"Tổng"/"Toàn hệ thống" (mục 3, 7, 8, 9, 20).
2. **Bảng attribution có 2 lỗi số học độc lập**: dòng "Tổng (N nguồn)" cộng thiếu 8+ nguồn nhưng ghi đủ N (mục 1), và ô chi phí AI mâu thuẫn nhiều lần với chính con số cùng tên ở đầu trang (mục 2). Phần "ước tính" thì có ghi nhãn đầy đủ ở header và tên cột — chỗ này làm đúng.
3. **SLA đạt ở Bảng brand không dùng ngưỡng thật của brand** (làm tròn lên bucket ≤15/30/60/120) và trộn cohort giữa tử/mẫu tới mức phải clamp 100% — đồng thời hai nhánh counter/ước tính cho hai định nghĩa khác nhau dưới cùng một cột (mục 5, 6). Chip `≈ ước tính` + banner `noStats` thì có, nhãn hoá tốt.
4. **Điểm 0–100 không bịa thành phần nào**, nhưng "khối lượng 30" là điểm tương đối giữa các brand (không công bố) và có nhánh chết khiến brand 0 lead vẫn được 20/100 (mục 15, 16).
5. **Hai lỗi hạ tầng dữ liệu đáng sửa sớm**: `outreach_stats` chốt cứng ngày VN lúc subscribe nên mọi số "hôm nay" đóng băng sau nửa đêm (mục 10), và join lead↔nguồn bằng chuỗi tên khiến đổi tên nguồn là số về 0 im lặng (mục 22). Riêng `csEffHtml` (hiệu quả nội dung) làm **đúng chuẩn**: có nhãn `ít mẫu` cho n<30, phân biệt rõ "máy chủ đếm cộng dồn" vs "lead đã nạp trên máy" — nên lấy làm mẫu cho calibCard và kwTop.