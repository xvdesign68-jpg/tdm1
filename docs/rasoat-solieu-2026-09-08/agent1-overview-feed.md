# Agent rà số liệu — Overview / live.js buildData / Lead feed (08/09/2026, đọc code cây v119-77)

Đã đọc xong `assets/js/live.js` (buildData/buildScans + đăng ký kênh theo vai trò), `src/app/10-core-overview.js`, `20-feed.js`, `70-shell-tools.js` (recount/inboxTasks/replyLeads), `90-boot.js`, cùng các chỗ tiêu thụ số (`25-agency.js`, `50-config-views.js`, `60-scan-views.js`).

## Nhìn chung

- Lớp "delta bịa" của bản cũ đã được dọn thật (chuỗi cứng `+12,4%` → `dl()` trả `null` khi kỳ trước = 0; `scanned = lead×14` → đọc `postsFetched`; brand không đọc được `scans` thì ô KPI đổi sang số thật của brand). Đó là phần làm đúng.
- Vấn đề lớn còn lại **không phải bịa số mà là sai mẫu số và sai phạm vi**: `valid = leads.length` gộp cả `junk / dropped / lost` — trong khi feed, hotTable, todayBoard, alerts đều loại chúng. Nên "Lead hợp lệ · sau khi AI lọc rác" đang đếm chính rác, và cả 3 tỷ lệ (phản hồi/hẹn/chốt) đều bị pha loãng.
- `D.leads` chỉ là **cửa sổ** (500 realtime → auto-fill trần 4.000, brand còn bị cắt thêm theo `leadFromAt/leadToAt`). Mọi con số "tổng" trên Overview đều dựng từ cửa sổ này nhưng chỉ có feed rail cảnh báo, và chỉ cho admin/super — Sales không thấy gì.
- Giá trị hiển thị và mũi tên delta **không cùng định nghĩa**: số to là toàn-cửa-sổ, delta + caption là 14 ngày vs 14 ngày trước.
- Vài chuỗi trạng thái vẫn cứng/suy diễn cho user brand: `~3 phút/lượt` và `Đang trực 24/7` hiện bất kể thực tế, vì brand không đọc được `scans` / `system_status`.

---

## CAO

**1. `live.js:131,173` · "Lead hợp lệ" (`kpi.validLeads`)** — `valid = leads.length`, tức TOÀN BỘ lead đã nạp kể cả `temp==='junk'`, `dropped`, `lost`. Caption ở `20-feed.js:17` ghi "sau khi AI lọc rác". Chính `20-feed.js:432` lại ẩn đúng nhóm đó khỏi feed và đếm riêng ở chip "Rác · Loại" (`20-feed.js:26`). Số KPI luôn > số lead người dùng thấy được. **Cả hai vai trò.** Sửa: `valid = leads.filter(l=>!l.dropped&&!l.lost&&l.temp!=='junk').length`, dùng đúng vị từ `feedHidden`.

**2. `live.js:173` · responseRate / bookingRate / closeRate** — cả ba đều `pct(x, valid)` với `valid` ở mục 1. Rác và lead đã loại nằm ở mẫu số nên "Tỷ lệ chốt trên lead hợp lệ" bị kéo xuống một cách hệ thống. **Cả hai.** Sửa: dùng chung mẫu số đã lọc; cân nhắc loại `lost` khỏi mẫu số tỷ lệ chốt hoặc nêu rõ trong caption.

**3. `live.js:127` vs `20-feed.js:161`** — `kpi.hot` đếm `temp==='hot'` không loại `dropped/lost/closed`, còn `hotTable()` lọc `!dropped && !lost && stage!=='closed'`. Trên cùng màn hình: thẻ "Lead nóng: 57" nhưng bảng "Lead nóng cần xử lý ngay" chỉ ra vài dòng. **Cả hai.** Sửa: đồng bộ vị từ, hoặc đổi nhãn KPI thành "Lead nóng (tổng)".

**4. `20-feed.js:32` · tâm donut** — `fmt(k.hot+k.warm+k.cold)` (loại junk) đứng cách thẻ `validLeads` (gồm junk) đúng một hàng. Hai tổng khác nhau cho cùng khái niệm "lead", không có chú thích. **Cả hai.** Sửa: cho donut dùng cùng tập lead với KPI.

**5. `live.js:172,1087` · "Bài đã quét"** — `bs.stats.totalPosts` là tổng `postsFetched` của **1.000 doc `scans` gần nhất** (`limit(1000)`), hiển thị như tổng tuyệt đối. Với nhịp 3–10 phút/lượt, 1.000 lượt ≈ 2–7 ngày. Caption `"N bài / 14 ngày"` (`win.scanned`, `live.js:143`) cũng bị cùng trần này nên gần như chắc chắn **thiếu bài của những ngày đầu cửa sổ 14 ngày**. **Super.** Sửa: đổi nhãn thành "1.000 lượt quét gần nhất", hoặc đọc counter cộng dồn phía server.

**6. `70-shell-tools.js:930` · badge nav "Lead mới" (`cntFeed`)** — `(D.leads||[]).filter(l=>l.stage==='new').length` không loại `junk/dropped/lost`, trong khi feed mặc định ẩn chúng. Badge báo N, mở feed ra ít hơn. **Cả hai.** Sửa: `.filter(l=>l.stage==='new' && !feedHidden(l))`.

**7. `20-feed.js:576-577,597,599` · renderFeedRail** — `cnt[l.temp]` và `"<b>${D.leads.length}</b> lead"` đếm trên `D.leads` thô; bấm nút "Nóng · 42" thì `renderFeed()` (`20-feed.js:432`) lại loại `dropped/lost` nên danh sách ngắn hơn con số vừa bấm. Thanh tỷ lệ `cnt[k]/D.leads.length` cũng lệch. **Cả hai.** Sửa: đếm trên tập đã áp `feedHidden` (giữ riêng ô "Rác · Loại").

**8. `live.js:1143,1131` + `20-feed.js:591` · cửa sổ 500/4.000 hiển thị như "tổng"** — `validLeads`, `hot/warm/cold`, `funnel`, `closeRate`, `sources[].leads` đều dựng từ cửa sổ realtime; brand còn bị cắt thêm theo `leadFromAt/leadToAt`. Cảnh báo `leadsCapped` chỉ nằm trong feed rail và chỉ hiện khi `roleCanEditConfig()` — **Sales không bao giờ thấy**, và Overview không có cảnh báo nào. **Cả hai.** Sửa: đưa `D.leadsCapped` vào caption KPI ("≈ trên N lead đã nạp") và hiện cho mọi vai trò.

**9. `60-scan-views.js:323-326,330` · "Đang trực 24/7"** — `bdDown()` yêu cầu `roleIsSuper() && D.sysStatus`, mà brand không đọc được `system_status/brightdata` (`live.js:989-1000`, chỉ super subscribe). Khi BrightData ngưng: super thấy banner đỏ, **brand vẫn thấy chấm xanh "Đang trực 24/7"**. **Brand.** Sửa: brand không có bằng chứng thì hiện trạng thái trung tính ("đang chạy theo lịch"), đừng khẳng định 24/7.

**10. `60-scan-views.js:349` · "Nhịp quét ~3 phút/lượt" (nhánh brand)** — chuỗi `'~3'` **cứng**, vì brand không có `D.scans` để đo. Super đi nhánh dưới và tính `cad` thật từ khoảng cách giữa các lượt. Cùng lúc `20-feed.js:83` ghi cứng `"đang bật · 3 phút/lượt"` còn `20-feed.js:86` in `scanIv()` (mặc định **10**) — hai nhịp mâu thuẫn trong cùng một dải. `70-shell-tools.js:946` lặp lại "3 phút/lượt". **Cả hai.** Sửa: dùng `scanIv()` ở cả ba chỗ, brand hiện "—" nếu không đo được.

**11. `20-feed.js:12-19` · số to ≠ delta ≠ caption** — `fmt(k.validLeads)`, `fmt(k.hot)`, `k.closeRate` là số **toàn cửa sổ**, nhưng `...kDelta(kd.*)` và `cap(...)` gắn thêm "· so với 14 ngày trước" là chênh lệch **14 ngày vs 14 ngày trước**. Mũi tên ▲▼ đứng ngay cạnh một con số mà nó không mô tả. **Cả hai.** Sửa: hoặc đổi số to sang giá trị 14 ngày (`kw.leads`, `kw.hot`, `rate14`), hoặc bỏ delta khỏi các thẻ không phải 14 ngày.

---

## VỪA

**12. `live.js:145,175` · delta Tỷ lệ chốt** — `rate14 = closed(cur14)/cur14.length` tính theo **cohort ngày phát hiện**: lead vừa phát hiện chưa kịp chốt, còn cohort `prev14` đã có thêm 14 ngày để chốt → delta lệch âm một cách hệ thống. **Cả hai.** Sửa: so theo ngày CHỐT (`closed_at` trong kỳ) thay vì cohort, hoặc ghi rõ "tỷ lệ chốt của lead phát hiện trong kỳ".

**13. `live.js:146` · respAvg cắt ngầm ở 7 ngày** — `.filter(x=>x!=null && x<7*1440)` vứt mọi lần chăm sau 7 ngày. "TG phản hồi TB" (`50-config-views.js:523-527`) vì thế **luôn đẹp hơn thực tế** mà không nói. Ngoài ra `Number(l.first_care_at)` → nếu backend ghi Timestamp thay vì ms thì thành `0` và bị loại im lặng, trong khi `10-core-overview.js:116` chỉ kiểm tra truthy (vẫn nhận). **Cả hai.** Sửa: dùng `parseTS`, và ghi rõ "loại các ca > 7 ngày" hoặc bỏ trần.

**14. `live.js:176` vs `25-agency.js:38,64`** — Overview/Báo cáo: "TG phản hồi TB" = cohort 14 ngày theo `detected_at`, trần 7 ngày. Bảng brand: "TG chăm đầu" = cửa sổ 30 ngày theo **`first_care_at`**, trần 30 ngày. Cùng một khái niệm, hai công thức, hai kết quả. **Super.** Sửa: chọn một định nghĩa, ghi vào tooltip cả hai nơi.

**15. `10-core-overview.js:109` vs `60-scan-views.js:342-343`** — todayBoard lấy **nửa đêm máy khách** (`setHours(0,0,0,0)`), còn "Lead hôm nay" ở thanh nhịp quét lấy **nửa đêm giờ VN (UTC+7)**, và `daily_stats`/`outreach_stats` (`live.js:1057,1076`) khoá theo ngày VN. Ba mốc "hôm nay" trên cùng ứng dụng; lệch thật với máy đặt múi giờ khác. **Cả hai.** Sửa: một helper `vnDayStart()` dùng chung.

**16. `10-core-overview.js:121-122`** — `closedToday` và `pendingValue` lọc trên `all` (chưa lọc), còn 7 ô còn lại của cùng hàm lọc trên `L` (đã bỏ junk/dropped/lost). Không nhất quán ngay trong một hàm. **Cả hai.** Sửa: dùng `L` cho cả hai.

**17. `20-feed.js:602-608` · rail "HÔM NAY CẦN CHĂM · N"** — gộp quá hẹn + hẹn trong ngày, chỉ loại `junk`, **giữ lại `dropped/lost`**, và dùng `eod` nửa đêm máy khách. Trong khi `todayCard` (`20-feed.js:105-106`) tách "Quá hẹn" / "Hẹn hôm nay" và đã loại `dropped/lost`. Ba con số cho cùng một việc. **Cả hai.** Sửa: rail gọi thẳng `todayBoard()`.

**18. `20-feed.js:579,615` · rail "Chờ giao xử lý · N"** — lọc `!assignee && temp!=='junk' && !dropped`: **không loại `lost`**, không giới hạn `stage`, không giới hạn nhiệt độ. `todayBoard.unassigned` (`10-core-overview.js:118`) thì yêu cầu còn mở + hot/warm + đã loại `lost`. Cùng nhãn "chưa giao", số khác nhau. **Cả hai.** Sửa: dùng `todayBoard().unassigned`.

**19. `live.js:143` · biên trên cửa sổ quét lệch** — `scansIn(t14, NOW+864e5)` cộng thêm 1 ngày tương lai (bắt scan có mốc lệch giờ), còn kỳ trước `scansIn(t28, t14)` không có biên nới đó. Hai kỳ không cùng độ rộng hiệu dụng → `delta.scanned` lệch nhẹ. **Super.** Sửa: dùng `NOW` cho cả hai, hoặc nới đối xứng.

**20. `live.js:180` · phễu suy từ stage hiện tại** — "Lead phát hiện" = `valid` (gồm rác/loại); "Đã kiểm tra" = `valid − count('new')` giả định tiến trình đơn điệu, nên lead bị `dropped` khi đang ở `checked` vẫn tính là đã kiểm tra. Thêm nữa `live.js:126` ép mọi stage lạ về `'new'`, làm bậc "Đã kiểm tra" tụt. `funnelHTML` (`20-feed.js:153`) rồi lấy bậc 1 làm 100% nên **mọi %** đều bị đỉnh phễu thổi phồng kéo xuống. **Cả hai.** Sửa: lọc rác/loại trước khi dựng phễu; hoặc đếm theo mốc `stage_at` thực.

**21. `live.js:181` vs `25-agency.js:39`** — phễu Overview: "Đã tiếp cận" = `stage ∈ {commented,inbox,responded,booked,closed}`. Phễu Bảng brand: "Đã chăm" = có `first_care_at` trong cửa sổ. Hai định nghĩa "đã tiếp cận" cho hai phễu cạnh nhau. **Super.** Sửa: thống nhất, hoặc đổi nhãn cho khác hẳn.

**22. `live.js:131` · `pct` trả 0 khi mẫu số = 0** — `pct=(a,b)=>b?…:0`. Brand chưa có lead nào vẫn thấy "Tỷ lệ chốt **0%**" — không phân biệt được với 0% thật. `25-agency.js:106` (`agyPct`) đã làm đúng bằng cách trả `null` → "—". **Cả hai.** Sửa: `pct` trả `null` khi `b===0`, UI hiện "—".

**23. `live.js:1057-1059` · `outreach_stats` không sang ngày** — `tk` (ngày VN) tính **một lần** lúc subscribe rồi lọc `x.day===tk` mãi mãi. Tab mở qua nửa đêm VN: cột "Automation hôm nay" ở Bảng brand (`25-agency.js:110`) treo số của **hôm qua**, không có dấu hiệu gì. `bd_month` (`live.js:1090-1096`) đã có watcher 30 phút để tự đổi doc — chỗ này thì chưa. **Cả hai** (brand cũng subscribe kênh này). Sửa: tính lại `tk` trong callback, hoặc thêm timer đổi ngày như `subBd`.

**24. `live.js:1076-1077` · `daily_stats` cũng đóng băng mốc** — `from` = 35 ngày tính từ lúc `agStart()`; phiên sống lâu thì cửa sổ Bảng brand trôi dần (thiếu ngày mới nếu Rules cắt, dư ngày cũ). **Super.** Sửa: đăng ký lại theo ngày, hoặc lọc ngày ở client theo `Date.now()`.

---

## THẤP

**25. `live.js:167` + `50-config-views.js:465` · thẻ Cảnh báo đọc như log gửi tin** — `channel: l.source` là **tên group Facebook**, nhưng được render sau icon `SLI.send` cạnh `SLI.clock ${a.time}` (= `detected_at`, giờ phát hiện chứ không phải giờ gửi cảnh báo). Người đọc dễ hiểu là "đã gửi qua kênh X lúc Y". Đổi nhãn thành "Nguồn" + "Phát hiện lúc". Cũng lưu ý `alertRow` tự phân loại nóng/ấm theo `score>=80` còn `live.js:167` viết chữ theo `l.temp` — hai lead có thể hiện icon "nóng" nhưng chữ "Lead ẤM".

**26. `live.js:148-149,178` · `byIndustry` là code chết + có 1 dòng số giả** — khi rỗng trả `{name:'Chưa có dữ liệu', value:1}` (giá trị 1 bịa). Toàn bộ nhánh này chỉ còn được dùng làm mẫu số dự phòng ở `20-feed.js:148`, mà nhánh đó không thể chạy tới (mảng nguồn rỗng thì `barItem` không được gọi). Bỏ hẳn hoặc nối lại vào một biểu đồ ngành thật. Cùng dòng `20-feed.js:148`: nếu mọi nguồn đều 0 lead thì `max=0` → `width:NaN%`.