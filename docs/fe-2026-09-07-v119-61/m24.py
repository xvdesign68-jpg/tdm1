# m24.py <cây> — v119-82 / v120-esm-af (09/09/2026 trưa, anh gửi ảnh hàng KPI: "check xem về mặt giao diện có gì cấn cấn không thì em fix cho đẹp hơn"):
# Cấn nhìn thấy trong ảnh: ô "Lead hợp lệ" có 2 dòng meta (pill ▲ + chip "còn mở", rồi caption ở dòng dưới) trong khi 3 ô kia chỉ 1 dòng → caption 4 ô không thẳng hàng,
# 3 ô còn lại hụt trống ở đáy; ô "Đã chốt" 0 vs 0 không có mũi tên nên dòng meta lệch tiếp; "291 · còn mở 291" lặp số; dải kỳ dùng chữ "▲▼" trong khi pill dùng icon SVG.
# Sửa (chỉ hàng KPI 14 ngày khi có bộ đếm — class `kpi-14`; các ô kpiCard khác ở Bảng brand/Tiếp cận/Nguồn quét giữ nguyên):
# (1) meta của ô kpi-14 = LƯỚI 2 hàng cố định: hàng 1 (20px) pill ▲▼ + chip, hàng 2 caption → 4 ô luôn cùng cấu trúc, caption thẳng hàng;
# (2) ô nào cũng có pill: không so được → pill xám "không đổi" (0 vs 0) / "kỳ trước 0" / "chưa có kỳ trước"; 0% → pill xám (trước: xanh "+0%") — kDelta trả dir 'flat', icon SLI.minus mới;
# (3) chip "còn mở N" khi N = lead hợp lệ → "tất cả còn mở" (hết lặp số); (4) dải kỳ: "mũi tên ▲▼" → icon trendUp/trendDown cùng bộ với pill; (5) caption "AI chấm từ 40 điểm, đã bỏ rác" → " · " thống nhất.
# Áp lên cây v119-81 / v120-esm-ae (sau m23). Fail-closed nguyên tử (lib.py 2 pha). Smoke +1 check (v119-82) → 118/118.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
F='src/app/20-feed.js'; C='assets/css/app.css'; S='tools/smoke.js'; I='assets/js/icons.js'

# ---------- icons: minus (pill "flat") ----------
rep(I, """    trendDown: s('<path d="m3.5 7 6 6 4-4 7 7.5"/><path d="M15.5 16.5h5v-5"/>'),
""", """    trendDown: s('<path d="m3.5 7 6 6 4-4 7 7.5"/><path d="M15.5 16.5h5v-5"/>'),
    minus: s('<path d="M5 12h14"/>'),
""", tag='icons.minus')

# ---------- kDelta: 0% = flat ----------
rep(F, """  function kDelta(v,unit){ if(v==null||!isFinite(v)) return ['','']; const s=(v>0?'+':'')+String(v).replace('.',',')+(unit||'%'); return [s, v>=0?'up':'down']; }""",
       """  function kDelta(v,unit){ if(v==null||!isFinite(v)) return ['','']; const s=(v>0?'+':'')+String(v).replace('.',',')+(unit||'%'); return [s, v>0?'up':v<0?'down':'flat']; } /* v119-82: 0% → pill xám 'flat' (trước: xanh "+0%") */""", tag='feed.kDelta')

# ---------- kpiCard: cls + icon flat ----------
rep(F, """  function kpiCard(ic,bg,fg,val,lbl,delta,dir,cap,tip,chip){ /* v119-81: tip = tooltip định nghĩa ô · chip = số phụ đứng cạnh mũi tên (vd "còn mở 287") */
    return `<div class="kpi"${tip?` title="${esc(tip)}"`:''}>
      <div class="row"><span class="lbl">${lbl}</span><span class="ic" style="background:${bg};color:${fg}">${ic}</span></div>
      <div class="val mono">${val}</div>
      <div class="meta">${delta?`<span class="delta ${dir}">${dir==='up'?SLI.trendUp:SLI.trendDown} ${delta}</span>`:''}${chip?`<span class="kchip">${chip}</span>`:''}${cap?`<span class="vs">${cap}</span>`:''}</div>""",
"""  function kpiCard(ic,bg,fg,val,lbl,delta,dir,cap,tip,chip,cls){ /* v119-81: tip = tooltip định nghĩa ô · chip = số phụ đứng cạnh mũi tên (vd "còn mở 287") · v119-82: cls 'kpi-14' = meta lưới 2 hàng cố định (pill+chip / caption) để 4 ô hàng KPI đều nhau; dir 'flat' = pill xám (0% / không so được) */
    return `<div class="kpi${cls?' '+cls:''}"${tip?` title="${esc(tip)}"`:''}>
      <div class="row"><span class="lbl">${lbl}</span><span class="ic" style="background:${bg};color:${fg}">${ic}</span></div>
      <div class="val mono">${val}</div>
      <div class="meta">${delta?`<span class="delta ${dir}">${dir==='up'?SLI.trendUp:dir==='down'?SLI.trendDown:SLI.minus} ${delta}</span>`:''}${chip?`<span class="kchip">${chip}</span>`:''}${cap?`<span class="vs">${cap}</span>`:''}</div>""", tag='feed.kpiCard')

# ---------- brandScan14 + kpi14 trả thêm prev/prevHas ----------
rep(F, """    return {cur, prev, today, delta:(prevHas&&prev>0)?+((cur-prev)/prev*100).toFixed(1):null};""",
       """    return {cur, prev, today, prevHas, delta:(prevHas&&prev>0)?+((cur-prev)/prev*100).toFixed(1):null};""", tag='feed.brandScan14')
rep(F, """      return {src:'counter', valid:cur.new, hot:cur.hot, closed:cur.closed, deal:cur.deal, open, dValid:""",
       """      return {src:'counter', valid:cur.new, hot:cur.hot, closed:cur.closed, deal:cur.deal, open, prev:{valid:prev.new,hot:prev.hot,closed:prev.closed}, prevHas, dValid:""", tag='feed.kpi14.prev')

# ---------- hàng KPI: kD (pill luôn có) + cls kpi-14 + chip "tất cả còn mở" + caption " · " ----------
rep(F, """          const q=kpi14(); /* v119-81: kỳ / so sánh / nguồn số dồn về dải kpiPeriod() phía trên — caption từng ô chỉ nói "đếm cái gì" */""",
       """          const q=kpi14(); /* v119-81: kỳ / so sánh / nguồn số dồn về dải kpiPeriod() phía trên — caption từng ô chỉ nói "đếm cái gì" */
          /* v119-82: 4 ô đều nhau — ô nào cũng có pill: không so được → pill xám "không đổi" (0 vs 0) / "kỳ trước 0" / "chưa có kỳ trước"; class kpi-14 = caption luôn ở hàng riêng */
          const flat=(has,p,c)=>[ !has ? 'chưa có kỳ trước' : (p===0&&c===0) ? 'không đổi' : 'kỳ trước 0', 'flat' ];
          const kD=(v,has,p,c)=> v!=null ? kDelta(v) : flat(has,p,c); const K14=q?'kpi-14':'';""", tag='feed.kD')
rep(F, """          const c1 = sc ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', fmt(sc.cur), 'Bài đã quét', ...kDelta(sc.delta), 'bài viết và bình luận AI đã đọc', 'Số bài viết và bình luận máy quét đã đọc trong 14 ngày (giờ Việt Nam), đếm theo ngày quét.')
            : (roleIsSuper()
              ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', k.scanned==null?'—':fmt(k.scanned), 'Bài đã quét', ...kDelta(kd.scanned), k.scanned==null?'chưa có nhật ký quét':(kw?cap(fmt(kw.scanned||0)+' bài / 14 ngày','scanned'):'từ nhật ký quét'))
              : kpiCard(SLI.calendar,'var(--brand-50)','var(--brand-600)', fmt(k.booked||0), 'Đã hẹn tư vấn', '', '', 'tỷ lệ hẹn '+(k.bookingRate||0)+'% trên lead hợp lệ'));""",
"""          const c1 = sc ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', fmt(sc.cur), 'Bài đã quét', ...kD(sc.delta,sc.prevHas,sc.prev,sc.cur), 'bài viết và bình luận AI đã đọc', 'Số bài viết và bình luận máy quét đã đọc trong 14 ngày (giờ Việt Nam), đếm theo ngày quét.', '', K14)
            : (roleIsSuper()
              ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', k.scanned==null?'—':fmt(k.scanned), 'Bài đã quét', ...kDelta(kd.scanned), k.scanned==null?'chưa có nhật ký quét':(kw?cap(fmt(kw.scanned||0)+' bài / 14 ngày','scanned'):'từ nhật ký quét'), '', '', K14)
              : kpiCard(SLI.calendar,'var(--brand-50)','var(--brand-600)', fmt(k.booked||0), 'Đã hẹn tư vấn', '', '', 'tỷ lệ hẹn '+(k.bookingRate||0)+'% trên lead hợp lệ', '', '', K14));""", tag='feed.c1')
rep(F, """          return c1
            + kpiCard(SLI.checkCircle,'var(--success-bg)','var(--success)', fmt(q.valid), 'Lead hợp lệ', ...kDelta(q.dValid), 'AI chấm từ 40 điểm, đã bỏ rác', 'Lead AI chấm từ 40 điểm trở lên, đếm theo ngày phát hiện trong 14 ngày. Không tính bài rác (dưới 40 điểm) và người bán/chủ bài. "Còn mở" = trừ thêm lead đã Loại hoặc Không thành.', q.open!=null?'còn mở '+fmt(q.open):'')
            + kpiCard(SLI.flame,'var(--hot-bg)','var(--hot)', fmt(q.hot), 'Lead nóng', ...kDelta(q.dHot), 'AI chấm từ 80 điểm'+(q.valid?' · '+pc(q.hot,q.valid)+' lead hợp lệ':''), 'Lead AI chấm từ 80 điểm trở lên trong 14 ngày — ưu tiên gọi trước.')
            + kpiCard(SLI.trophy,'var(--warm-bg)','var(--warm)', fmt(q.closed), 'Đã chốt', ...kDelta(q.dClosed), q.closed?('tỷ lệ chốt '+pc(q.closed,q.valid,1)+' trên lead hợp lệ'+(q.deal>0?' · doanh thu '+money(q.deal):'')):'chưa có deal chốt trong kỳ', 'Deal bấm "Đã chốt" trên app, đếm theo ngày chốt trong 14 ngày. Tỷ lệ chốt = deal chốt / lead hợp lệ cùng kỳ; doanh thu = tổng giá trị đơn đã nhập.'); })()}""",
"""          const P=q.prev||{};
          return c1
            + kpiCard(SLI.checkCircle,'var(--success-bg)','var(--success)', fmt(q.valid), 'Lead hợp lệ', ...kD(q.dValid,q.prevHas,P.valid,q.valid), 'AI chấm từ 40 điểm · đã bỏ rác', 'Lead AI chấm từ 40 điểm trở lên, đếm theo ngày phát hiện trong 14 ngày. Không tính bài rác (dưới 40 điểm) và người bán/chủ bài. "Còn mở" = trừ thêm lead đã Loại hoặc Không thành.', q.open!=null?(q.open===q.valid?'tất cả còn mở':'còn mở '+fmt(q.open)):'', K14)
            + kpiCard(SLI.flame,'var(--hot-bg)','var(--hot)', fmt(q.hot), 'Lead nóng', ...kD(q.dHot,q.prevHas,P.hot,q.hot), 'AI chấm từ 80 điểm'+(q.valid?' · '+pc(q.hot,q.valid)+' lead hợp lệ':''), 'Lead AI chấm từ 80 điểm trở lên trong 14 ngày — ưu tiên gọi trước.', '', K14)
            + kpiCard(SLI.trophy,'var(--warm-bg)','var(--warm)', fmt(q.closed), 'Đã chốt', ...kD(q.dClosed,q.prevHas,P.closed,q.closed), q.closed?('tỷ lệ chốt '+pc(q.closed,q.valid,1)+' trên lead hợp lệ'+(q.deal>0?' · doanh thu '+money(q.deal):'')):'chưa có deal chốt trong kỳ', 'Deal bấm "Đã chốt" trên app, đếm theo ngày chốt trong 14 ngày. Tỷ lệ chốt = deal chốt / lead hợp lệ cùng kỳ; doanh thu = tổng giá trị đơn đã nhập.', '', K14); })()}""", tag='feed.cards')

# ---------- dải kỳ: icon ↗↘ cùng bộ với pill ----------
rep(F, """<span class="vs">mũi tên ▲▼ so với 14 ngày liền trước (${dm(now-27*864e5)} – ${dm(now-14*864e5)})</span></div>`;""",
       """<span class="vs">${SLI.trendUp} ${SLI.trendDown} so với 14 ngày liền trước (${dm(now-27*864e5)} – ${dm(now-14*864e5)})</span></div>`;""", tag='feed.period.icons')

# ---------- CSS ----------
rep(C, """.kpi .meta .kchip { display: inline-flex; align-items: center; padding: 2.5px 8px; border-radius: var(--r-full); background: var(--surface-2); color: var(--ink-700); font-family: var(--font-head); font-weight: 600; font-size: 11.5px; font-variant-numeric: tabular-nums; }
.kpi .meta .kchip ~ .vs { flex-basis: 100%; }
""", """.kpi .meta .kchip { display: inline-block; line-height: 15px; vertical-align: middle; padding: 2.5px 8px; border-radius: var(--r-full); background: var(--surface-2); color: var(--ink-700); font-family: var(--font-head); font-weight: 600; font-size: 11.5px; font-variant-numeric: tabular-nums; max-width: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* v119-82: hàng KPI 14 ngày (kpi-14) — meta là lưới 2 hàng cố định: hàng 1 pill ▲▼ + chip, hàng 2 caption → 4 ô luôn cùng cấu trúc, caption thẳng hàng, không hụt trống đáy */
.kpi.kpi-14 .meta { display: grid; grid-template-columns: max-content minmax(0, 1fr); grid-template-rows: 20px auto; align-items: center; justify-items: start; column-gap: 8px; row-gap: 7px; }
.kpi.kpi-14 .meta .vs { grid-column: 1 / -1; grid-row: 2; }
.kpi .delta.flat { background: var(--surface-2); color: var(--ink-500); }
.kpi-period .vs .i { width: 12px; height: 12px; color: var(--ink-400); vertical-align: -2px; }
@media (max-width: 639px) { /* ô 2 cột hẹp: pill + chip nhỏ lại để "tất cả còn mở" vừa 1 hàng; vẫn thiếu chỗ → chip cắt "…" (không tràn ô) */
  .kpi.kpi-14 .meta { column-gap: 5px; }
  .kpi.kpi-14 .delta, .kpi.kpi-14 .kchip { font-size: 10.5px; padding: 2px 6px; }
  .kpi.kpi-14 .kchip { line-height: 15px; }
  .kpi.kpi-14 .delta .i { width: 11px; height: 11px; }
}
""", tag='css.kpi-14')

# ---------- smoke: +1 check ----------
rep(S, """    ? ok('v119-81: dải kỳ "14 ngày qua · Brand K81 · so với 14 ngày liền trước" · chip còn mở 4/6 (1 Loại + 1 chủ bài) · tooltip định nghĩa · Đã chốt 0 → "chưa có deal chốt trong kỳ", 1 deal → "tỷ lệ chốt 16,7% · doanh thu 12,5 triệu"') : fail('v119-81 KPI: ' + JSON.stringify(k81));
""", """    ? ok('v119-81: dải kỳ "14 ngày qua · Brand K81 · so với 14 ngày liền trước" · chip còn mở 4/6 (1 Loại + 1 chủ bài) · tooltip định nghĩa · Đã chốt 0 → "chưa có deal chốt trong kỳ", 1 deal → "tỷ lệ chốt 16,7% · doanh thu 12,5 triệu"') : fail('v119-81 KPI: ' + JSON.stringify(k81));
  /* v119-82: 4 ô KPI đều nhau — ô nào cũng có pill (0% / "không đổi" = xám), caption ở hàng riêng thẳng hàng cả 4 ô, chip "tất cả còn mở" khi không lead nào bị Loại, dải kỳ dùng icon ↗↘ */
  const k82 = await page.evaluate(() => { const vn = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); const now = Date.now(); const D = window.SL_DATA;
    D.dailyStats = [{ brandCode: 'k82b', day: vn(now), new: 5, hot: 2, closed: 0, scanned: 40 }, { brandCode: 'k82b', day: vn(now - 20 * 864e5), new: 5, hot: 1, closed: 0, scanned: 40 }];
    const fake = []; for (let i = 0; i < 5; i++) fake.push({ id: 'K82' + i, brand: 'k82b', temp: i < 2 ? 'hot' : 'warm', score: i < 2 ? 85 : 65, detected_at: new Date(now - i * 3600e3).toISOString(), stage: 'new', name: 'K82 ' + i, text: '', source: 'x' });
    const L0 = D.leads; D.leads = fake.concat(L0); D.myBrand = { code: 'k82b', name: 'Brand K82' };
    window.SLAuth.show('app', { brand: 'k82b', brandName: 'Brand K82' }, 'admin'); location.hash = 'overview'; window.SLApp.reload(D);
    const cards = [...document.querySelectorAll('#view .grid.g-4 .kpi')]; const rc = e => e ? e.getBoundingClientRect() : { top: -1, bottom: -1 };
    const r = { n: cards.length, cls: cards.filter(c => c.classList.contains('kpi-14')).length, pills: cards.map(c => { const d = c.querySelector('.delta'); return d ? d.className.replace('delta', '').trim() + ':' + d.textContent.trim() : ''; }),
      chip: cards[1] ? ((cards[1].querySelector('.kchip') || {}).textContent || '') : '', vsTop: cards.map(c => Math.round(rc(c.querySelector('.vs')).top)), capBelow: cards.map(c => Math.round(rc(c.querySelector('.vs')).top - rc(c.querySelector('.delta')).bottom)),
      perSvg: (document.querySelector('#view .kpi-period .vs') || { querySelectorAll: () => [] }).querySelectorAll('svg').length };
    delete D.dailyStats; delete D.myBrand; D.leads = L0; window.SLAuth.show('app', {}, 'superadmin'); location.hash = 'overview'; window.SLApp.reload(D); return r; });
  await page.waitForTimeout(300);
  (k82.n === 4 && k82.cls === 4 && k82.pills[0] === 'flat:0%' && k82.pills[1] === 'flat:0%' && k82.pills[2] === 'up:+100%' && k82.pills[3] === 'flat:không đổi' && k82.chip === 'tất cả còn mở' && k82.vsTop.every(t => t > 0 && t === k82.vsTop[0]) && k82.capBelow.every(x => x >= 0) && k82.perSvg === 2)
    ? ok('v119-82: 4 ô KPI đều nhau — pill xám "0%" ×2 + "+100%" + "không đổi" (0 vs 0), chip "tất cả còn mở", caption 4 ô cùng hàng (top ' + k82.vsTop[0] + 'px) dưới pill, dải kỳ 2 icon ↗↘') : fail('v119-82 KPI đều: ' + JSON.stringify(k82));
""", tag='smoke.v119-82')
done()
