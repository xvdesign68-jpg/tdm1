# m23.py <cây> — v119-81 / v120-esm-ae (09/09/2026, anh chốt ảnh 2 "hiển thị KPI dễ hiểu"): hàng 4 ô KPI Bảng điều khiển khi có bộ đếm máy chủ —
# (1) DẢI KỲ đặt 1 lần trên hàng KPI: "14 ngày qua · dd/mm – dd/mm · <brand|Tất cả brand> · mũi tên so với 14 ngày liền trước (dd/mm – dd/mm)" (thay lặp "so với 14 ngày trước · bộ đếm máy chủ" ở từng ô);
# (2) caption từng ô chỉ nói "đếm cái gì" bằng chữ đời thường; (3) ô Lead hợp lệ: chip "còn mở N" cạnh mũi tên (= hợp lệ − đã Loại/Không thành/người bán, CHỈ khi cửa sổ lead đã nạp phủ đủ kỳ),
# bỏ "tổng đã nạp N" (số cửa sổ trình duyệt, không phải kỳ 14 ngày); (4) ô Lead nóng thêm "% lead hợp lệ"; (5) ô Đã chốt: 0 → "chưa có deal chốt trong kỳ", >0 → tỷ lệ chốt 1 số lẻ + doanh thu (Σ daily_stats.deal);
# (6) tooltip định nghĩa đầy đủ trên từng ô (kpiCard tham số tip, chip). Áp lên cây v119-80 / v120-esm-ad (sau m22). Nhánh không có bộ đếm (demo / chưa LỆNH #17) giữ nguyên.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
F='src/app/20-feed.js'; C='assets/css/app.css'; S='tools/smoke.js'

# ---------- kpiCard: tooltip + chip ----------
rep(F, """  function kpiCard(ic,bg,fg,val,lbl,delta,dir,cap){
    return `<div class="kpi">
      <div class="row"><span class="lbl">${lbl}</span><span class="ic" style="background:${bg};color:${fg}">${ic}</span></div>
      <div class="val mono">${val}</div>
      <div class="meta">${delta?`<span class="delta ${dir}">${dir==='up'?SLI.trendUp:SLI.trendDown} ${delta}</span>`:''}${cap?`<span class="vs">${cap}</span>`:''}</div>""",
"""  function kpiCard(ic,bg,fg,val,lbl,delta,dir,cap,tip,chip){ /* v119-81: tip = tooltip định nghĩa ô · chip = số phụ đứng cạnh mũi tên (vd "còn mở 287") */
    return `<div class="kpi"${tip?` title="${esc(tip)}"`:''}>
      <div class="row"><span class="lbl">${lbl}</span><span class="ic" style="background:${bg};color:${fg}">${ic}</span></div>
      <div class="val mono">${val}</div>
      <div class="meta">${delta?`<span class="delta ${dir}">${dir==='up'?SLI.trendUp:SLI.trendDown} ${delta}</span>`:''}${chip?`<span class="kchip">${chip}</span>`:''}${cap?`<span class="vs">${cap}</span>`:''}</div>""", tag='feed.kpiCard')

# ---------- dải kỳ trước hàng KPI ----------
rep(F, """      <div class="grid g-4">
        ${(()=>{ /* v119-80""", """      ${kpiPeriod(kpi14())}
      <div class="grid g-4">
        ${(()=>{ /* v119-80""", tag='feed.period')

# ---------- caption 4 ô ----------
rep(F, """          const q=kpi14(); const vs=(q&&q.src==='counter')?' · bộ đếm máy chủ':'';""",
       """          const q=kpi14(); /* v119-81: kỳ / so sánh / nguồn số dồn về dải kpiPeriod() phía trên — caption từng ô chỉ nói "đếm cái gì" */""", tag='feed.q')
rep(F, """          const c1 = sc ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', fmt(sc.cur), 'Bài đã quét', ...kDelta(sc.delta), 'bài AI đã đọc / 14 ngày'+(sc.delta==null?'':' · so với 14 ngày trước')+' · bộ đếm máy chủ')""",
       """          const c1 = sc ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', fmt(sc.cur), 'Bài đã quét', ...kDelta(sc.delta), 'bài viết và bình luận AI đã đọc', 'Số bài viết và bình luận máy quét đã đọc trong 14 ngày (giờ Việt Nam), đếm theo ngày quét.')""", tag='feed.c1')
rep(F, """          const tot=fmt(k.validLeads);
          return c1
            + kpiCard(SLI.checkCircle,'var(--success-bg)','var(--success)', fmt(q.valid), 'Lead hợp lệ', ...kDelta(q.dValid), '14 ngày, AI đã lọc rác'+(q.dValid==null?'':' · so với 14 ngày trước')+' · tổng đã nạp '+tot)
            + kpiCard(SLI.flame,'var(--hot-bg)','var(--hot)', fmt(q.hot), 'Lead nóng', ...kDelta(q.dHot), 'điểm AI ≥ 80 · 14 ngày'+(q.dHot==null?'':' · so với 14 ngày trước'))
            + kpiCard(SLI.trophy,'var(--warm-bg)','var(--warm)', fmt(q.closed), 'Đã chốt', ...kDelta(q.dClosed), 'deal chốt trong 14 ngày'+(q.closeRate==null?'':' · tỷ lệ chốt '+String(q.closeRate).replace('.',',')+'% trên lead hợp lệ')+(q.dClosed==null?'':' · so với 14 ngày trước')+vs); })()}""",
"""          const pc=(a,b,dec)=>b?String(+(a/b*100).toFixed(dec||0)).replace('.',',')+'%':'';
          const money=v=>v>=1e9?(String(+(v/1e9).toFixed(1)).replace('.',','))+' tỷ':v>=1e6?(String(+(v/1e6).toFixed(1)).replace('.',','))+' triệu':fmt(v)+' đ';
          return c1
            + kpiCard(SLI.checkCircle,'var(--success-bg)','var(--success)', fmt(q.valid), 'Lead hợp lệ', ...kDelta(q.dValid), 'AI chấm từ 40 điểm, đã bỏ rác', 'Lead AI chấm từ 40 điểm trở lên, đếm theo ngày phát hiện trong 14 ngày. Không tính bài rác (dưới 40 điểm) và người bán/chủ bài. "Còn mở" = trừ thêm lead đã Loại hoặc Không thành.', q.open!=null?'còn mở '+fmt(q.open):'')
            + kpiCard(SLI.flame,'var(--hot-bg)','var(--hot)', fmt(q.hot), 'Lead nóng', ...kDelta(q.dHot), 'AI chấm từ 80 điểm'+(q.valid?' · '+pc(q.hot,q.valid)+' lead hợp lệ':''), 'Lead AI chấm từ 80 điểm trở lên trong 14 ngày — ưu tiên gọi trước.')
            + kpiCard(SLI.trophy,'var(--warm-bg)','var(--warm)', fmt(q.closed), 'Đã chốt', ...kDelta(q.dClosed), q.closed?('tỷ lệ chốt '+pc(q.closed,q.valid,1)+' trên lead hợp lệ'+(q.deal>0?' · doanh thu '+money(q.deal):'')):'chưa có deal chốt trong kỳ', 'Deal bấm "Đã chốt" trên app, đếm theo ngày chốt trong 14 ngày. Tỷ lệ chốt = deal chốt / lead hợp lệ cùng kỳ; doanh thu = tổng giá trị đơn đã nhập.'); })()}""", tag='feed.captions')

# ---------- kpi14: deal + "còn mở" + hàm kpiPeriod ----------
rep(F, """      const cur={new:0,hot:0,closed:0}, prev={new:0,hot:0,closed:0}; let prevHas=false;
      ds.forEach(x=>{ const o=x.day>=d0?cur:(x.day>=dP?prev:null); if(!o) return; if(o===prev) prevHas=true; o.new+=Number(x.new)||0; o.hot+=Number(x.hot)||0; o.closed+=Number(x.closed)||0; });
      return {src:'counter', valid:cur.new, hot:cur.hot, closed:cur.closed,""",
"""      const cur={new:0,hot:0,closed:0,deal:0}, prev={new:0,hot:0,closed:0,deal:0}; let prevHas=false;
      ds.forEach(x=>{ const o=x.day>=d0?cur:(x.day>=dP?prev:null); if(!o) return; if(o===prev) prevHas=true; o.new+=Number(x.new)||0; o.hot+=Number(x.hot)||0; o.closed+=Number(x.closed)||0; o.deal+=Number(x.deal)||0; });
      /* v119-81: "còn mở" = lead hợp lệ trong kỳ trừ đã Loại/Không thành/người bán — tính từ lead đã nạp, CHỈ hiện khi cửa sổ đã nạp phủ đủ kỳ (seen ≥ bộ đếm) */
      const open=(()=>{ let n=0, seen=0; (D.leads||[]).forEach(l=>{ if(!l||l.temp==='junk'||(my&&l.brand!==my)) return; const t=parseTS(l.detected_at)||parseTS(l.time); if(!t||vnDayKey(t.getTime())<d0) return; seen++; if(!l.dropped&&!l.lost&&!/^(seller|poster_self)$/.test(String(l.role||''))&&l.self_comment!==true) n++; }); return seen>=cur.new?n:null; })();
      return {src:'counter', valid:cur.new, hot:cur.hot, closed:cur.closed, deal:cur.deal, open,""", tag='feed.kpi14')
rep(F, """  function kpi14(){""", """  /* v119-81: dải kỳ đặt 1 lần trên hàng KPI (kỳ 14 ngày, khoảng so sánh, phạm vi brand) — thay cho việc lặp "so với 14 ngày trước · bộ đếm máy chủ" ở từng ô */
  function kpiPeriod(q){
    if(!q||q.src!=='counter') return '';
    const now=Date.now(), dm=ms=>{ const d=new Date(ms+7*3600e3); return String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0'); };
    const who=roleIsSuper()?'Tất cả brand':esc((D.myBrand&&(D.myBrand.name||D.myBrand.code))||'Brand của bạn');
    return `<div class="kpi-period" title="Số liệu 4 ô lấy từ bộ đếm máy chủ, cập nhật tức thì khi có lead mới">${SLI.calendar}<b>14 ngày qua</b><span>${dm(now-13*864e5)} – ${dm(now)}</span><span class="chip">${who}</span><span class="vs">mũi tên ▲▼ so với 14 ngày liền trước (${dm(now-27*864e5)} – ${dm(now-14*864e5)})</span></div>`;
  }
  function kpi14(){""", tag='feed.kpiPeriod')

# ---------- CSS ----------
css = rd(C)
if '.kpi-period' in css: raise SystemExit('CSS đã có .kpi-period')
wr(C, css.rstrip('\n') + """

/* v119-81: dải kỳ trên hàng KPI Bảng điều khiển + chip số phụ cạnh mũi tên */
.kpi-period { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; margin: 0 0 10px; font-size: 12.5px; color: var(--ink-500); }
.kpi-period .i { width: 14px; height: 14px; color: var(--brand-600); }
.kpi-period b { font-family: var(--font-head); font-weight: 600; color: var(--ink-800); }
.kpi-period .vs { font-size: 11.5px; color: var(--ink-400); }
.kpi .meta .kchip { display: inline-flex; align-items: center; padding: 2.5px 8px; border-radius: var(--r-full); background: var(--surface-2); color: var(--ink-700); font-family: var(--font-head); font-weight: 600; font-size: 11.5px; font-variant-numeric: tabular-nums; }
.kpi .meta .kchip ~ .vs { flex-basis: 100%; }
"""); lib._log.append('css .kpi-period/.kchip')

# ---------- smoke: 2 check cũ đổi caption + 1 check mới ----------
rep(S, "/bộ đếm máy chủ/.test(c80[3].cap) && /tỷ lệ chốt 10%/.test(c80[3].cap)", "/tỷ lệ chốt 10%/.test(c80[3].cap)", tag='smoke.k80')
rep(S, "/14 ngày trước/.test(k78.kpi.cap)", "/AI đã đọc/.test(k78.kpi.cap)", tag='smoke.k78')
rep(S, """  const t80 = await page.evaluate(() => { location.hash = 'feed';""", """  /* v119-81: dải kỳ 1 lần trên hàng KPI + caption đời thường + chip "còn mở" + tooltip + Đã chốt có tỷ lệ 1 số lẻ & doanh thu */
  const k81 = await page.evaluate(() => { const vn = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); const now = Date.now(); const D = window.SL_DATA;
    D.dailyStats = [{ brandCode: 'k81b', day: vn(now), new: 6, hot: 2, closed: 0, scanned: 50 }, { brandCode: 'k81b', day: vn(now - 20 * 864e5), new: 3, hot: 1, closed: 0, scanned: 20 }, { brandCode: 'khac', day: vn(now), new: 99, hot: 9 }];
    const fake = []; for (let i = 0; i < 6; i++) fake.push({ id: 'K81' + i, brand: 'k81b', temp: i < 2 ? 'hot' : 'warm', score: i < 2 ? 85 : 65, detected_at: new Date(now - i * 3600e3).toISOString(), stage: 'new', name: 'K81 ' + i, text: '', source: 'x', dropped: i === 5, role: i === 4 ? 'poster_self' : '' });
    const L0 = D.leads; D.leads = fake.concat(L0); D.myBrand = { code: 'k81b', name: 'Brand K81' };
    window.SLAuth.show('app', { brand: 'k81b', brandName: 'Brand K81' }, 'admin'); location.hash = 'overview'; window.SLApp.reload(D);
    const q = s => (document.querySelector(s) || {}); const per = q('#view .kpi-period').textContent || ''; const cards = [...document.querySelectorAll('#view .grid.g-4 .kpi')]; const c2 = cards[1], c4 = cards[3];
    const r = { per, chip: c2 ? ((c2.querySelector('.kchip') || {}).textContent || '') : '', tip: c2 ? (c2.title || '') : '', cap2: c2 ? ((c2.querySelector('.vs') || {}).textContent || '') : '', cap4: c4 ? ((c4.querySelector('.vs') || {}).textContent || '') : '' };
    D.dailyStats[0].closed = 1; D.dailyStats[0].deal = 12500000; window.SLApp.reload(D); const c4b = document.querySelectorAll('#view .grid.g-4 .kpi')[3]; r.cap4b = c4b ? ((c4b.querySelector('.vs') || {}).textContent || '') : '';
    delete D.dailyStats; delete D.myBrand; D.leads = L0; window.SLAuth.show('app', {}, 'superadmin'); location.hash = 'overview'; window.SLApp.reload(D); return r; });
  await page.waitForTimeout(300);
  (/14 ngày qua/.test(k81.per) && /Brand K81/.test(k81.per) && /14 ngày liền trước/.test(k81.per) && /còn mở 4/.test(k81.chip) && /Lead AI chấm từ 40 điểm/.test(k81.tip) && /AI chấm từ 40 điểm/.test(k81.cap2) && /chưa có deal chốt trong kỳ/.test(k81.cap4) && /tỷ lệ chốt 16,7%/.test(k81.cap4b) && /doanh thu 12,5 triệu/.test(k81.cap4b))
    ? ok('v119-81: dải kỳ "14 ngày qua · Brand K81 · so với 14 ngày liền trước" · chip còn mở 4/6 (1 Loại + 1 chủ bài) · tooltip định nghĩa · Đã chốt 0 → "chưa có deal chốt trong kỳ", 1 deal → "tỷ lệ chốt 16,7% · doanh thu 12,5 triệu"') : fail('v119-81 KPI: ' + JSON.stringify(k81));
  const t80 = await page.evaluate(() => { location.hash = 'feed';""", tag='smoke.v119-81')
done()
