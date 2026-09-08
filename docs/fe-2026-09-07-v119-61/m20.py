# m20.py <cây> — v119-78 / v120-esm-ab (08/09, anh: "anh muốn brand thấy số bài đã quét của mình"). Áp lên cây đã qua m19 (v119-77 / v120-esm-aa).
# Đi cùng LỆNH #39 (CF scanStatsOnRun: scans/{id} → daily_stats/{brand}__{ngàyVN}.scanned/scannedComments/scanRuns + backfill).
# FE: (1) live.js user brand subscribe daily_stats where brandCode==brand mình (Rules đã cho; 1 field, không cần index; ~40 doc);
# (2) 20-feed `brandScan14()` = Σ scanned 14 ngày (tới hôm nay VN) + delta vs 14 ngày trước từ D.dailyStats (lọc theo D.myBrand.code) → ô KPI 1 của
# user brand = "Bài đã quét" thật; chưa có counter (LỆNH #39 chưa chạy) → giữ ô "Đã hẹn tư vấn" (v119-77), KHÔNG bao giờ "—";
# (3) thanh nhịp quét ở Lead mới (bản brand) thêm "Bài đã quét hôm nay" khi có counter. + smoke check v119-78. Fail-closed nguyên tử.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
L='assets/js/live.js'; F='src/app/20-feed.js'; V='src/app/60-scan-views.js'; S='tools/smoke.js'
rep(L, "      lazyScanned(query(collection(db,'scanned_posts'),where('brand','==',byBrand),orderBy('createdAt','desc'),limit(3000))); // v90→v166: tải-khi-mở-tab",
"      lazyScanned(query(collection(db,'scanned_posts'),where('brand','==',byBrand),orderBy('createdAt','desc'),limit(3000))); // v90→v166: tải-khi-mở-tab\n"
"      /* v119-78: user brand đọc daily_stats của brand mình (Rules cho brandCode==brand; 1 field → không cần index; ~40 doc) → ô \"Bài đã quét\" từ counter scanned (LỆNH #39). Lỗi → chỉ warn, không banner. */\n"
"      dataUnsub.push(onSnapshot(query(collection(db,'daily_stats'),where('brandCode','==',byBrand)), snap=>{ dailyStats=[]; snap.forEach(d=>dailyStats.push({...d.data(), id:d.id})); dailyStatsErr=''; rebuild(['overview','feed']); }, function(e){ dailyStatsErr=(e&&e.code)||'error'; console.warn('[SmartLead] daily_stats (brand):', dailyStatsErr, e&&e.message); }));", tag='live.brandDaily')
rep(F, '''  /* v119-40 (P10): card "HÔM NAY" - việc cần làm ngay, bấm số là nhảy đúng bộ lọc */''',
'''  /* v119-78: "Bài đã quét" cho user brand từ counter daily_stats/{brand}__{ngàyVN}.scanned (CF scanStatsOnRun, LỆNH #39):
     14 ngày tới hôm nay (giờ VN) vs 14 ngày trước; chưa có counter → null (ô KPI rơi về "Đã hẹn tư vấn", không bao giờ "—") */
  function brandScan14(){
    const my=D.myBrand&&D.myBrand.code; const ds=(D.dailyStats||[]).filter(x=>x&&x.scanned!=null&&(!my||x.brandCode===my)); if(!ds.length) return null;
    const vnDay=ms=>new Date(ms+7*3600e3).toISOString().slice(0,10); const now=Date.now(); const t=vnDay(now), d0=vnDay(now-13*864e5), dP=vnDay(now-27*864e5);
    let cur=0, prev=0, prevHas=false, today=0;
    ds.forEach(x=>{ const n=Number(x.scanned)||0; if(x.day>=d0) cur+=n; else if(x.day>=dP){ prev+=n; prevHas=true; } if(x.day===t) today=n; });
    return {cur, prev, today, delta:(prevHas&&prev>0)?+((cur-prev)/prev*100).toFixed(1):null};
  }
  /* v119-40 (P10): card "HÔM NAY" - việc cần làm ngay, bấm số là nhảy đúng bộ lọc */''', tag='feed.brandScan14')
rep(F, '''              : kpiCard(SLI.calendar,'var(--brand-50)','var(--brand-600)', fmt(k.booked||0), 'Đã hẹn tư vấn', '', '', 'tỷ lệ hẹn '+(k.bookingRate||0)+'% trên lead hợp lệ')) /* v119-77: user brand không đọc được nhật ký quét (Rules) → ô số THẬT của brand thay cho "—" */''',
'''              : (bs14
                  ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', fmt(bs14.cur), 'Bài đã quét', ...kDelta(bs14.delta), 'bài AI đã đọc cho brand / 14 ngày'+(bs14.delta==null?'':' · so với 14 ngày trước')) /* v119-78: counter theo brand (LỆNH #39) */
                  : kpiCard(SLI.calendar,'var(--brand-50)','var(--brand-600)', fmt(k.booked||0), 'Đã hẹn tư vấn', '', '', 'tỷ lệ hẹn '+(k.bookingRate||0)+'% trên lead hợp lệ'))) /* v119-77: user brand không đọc được nhật ký quét (Rules) → ô số THẬT của brand thay cho "—" */''', tag='feed.kpi')
rep(F, '''          const cap=(base,key)=> (kd[key]==null?base:(base+' · so với 14 ngày trước'));
          return (roleIsSuper()''',
'''          const cap=(base,key)=> (kd[key]==null?base:(base+' · so với 14 ngày trước'));
          const bs14=roleIsSuper()?null:brandScan14(); // v119-78
          return (roleIsSuper()''', tag='feed.kpi.var')
rep(V, '''      const myLeads=(D.leads||[]).filter(l=>ld(l)>=dayStart).length;''',
'''      const myLeads=(D.leads||[]).filter(l=>ld(l)>=dayStart).length;
      const bsToday=(()=>{ const t=new Date(Date.now()+7*3600e3).toISOString().slice(0,10); const my=D.myBrand&&D.myBrand.code; const x=(D.dailyStats||[]).find(r=>r&&r.day===t&&r.scanned!=null&&(!my||r.brandCode===my)); return x?(Number(x.scanned)||0):null; })(); // v119-78: counter theo brand (LỆNH #39)''', tag='scanbar.today')
rep(V, '''<span class="sb-s ${myLeads?'hl':''}"><span class="sb-k">Lead hôm nay</span><b>${fmt(myLeads)}</b></span><span class="sb-last">lead mới hiện tại đây ngay khi phát hiện''',
'''${bsToday==null?'':'<span class="sb-s"><span class="sb-k">Bài đã quét hôm nay</span><b>'+fmt(bsToday)+'</b></span>'}<span class="sb-s ${myLeads?'hl':''}"><span class="sb-k">Lead hôm nay</span><b>${fmt(myLeads)}</b></span><span class="sb-last">lead mới hiện tại đây ngay khi phát hiện''', tag='scanbar.html')
rep(S, '''  (k77.admin && /Đã hẹn tư vấn/.test(k77.admin.lbl) && /^\\d/.test(k77.admin.val) && k77.sup && /Bài đã quét/.test(k77.sup.lbl)) ? ok('v119-77: Overview vai admin brand → KPI "Đã hẹn tư vấn ' + k77.admin.val + '" (thay "—" Bài đã quét) · super vẫn "Bài đã quét ' + k77.sup.val + '"') : fail('v119-77 kpi brand: ' + JSON.stringify(k77));''',
'''  (k77.admin && /Đã hẹn tư vấn/.test(k77.admin.lbl) && /^\\d/.test(k77.admin.val) && k77.sup && /Bài đã quét/.test(k77.sup.lbl)) ? ok('v119-77: Overview vai admin brand → KPI "Đã hẹn tư vấn ' + k77.admin.val + '" (thay "—" Bài đã quét) · super vẫn "Bài đã quét ' + k77.sup.val + '"') : fail('v119-77 kpi brand: ' + JSON.stringify(k77));
  /* v119-78: có counter daily_stats.scanned của brand → KPI 1 = "Bài đã quét" 14 ngày + delta; thanh nhịp quét (Lead mới) có "Bài đã quét hôm nay" */
  const k78 = await page.evaluate(() => { const vn = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); const now = Date.now(); const D = window.SL_DATA;
    D.myBrand = { code: 'z15' }; D.dailyStats = [{ brandCode: 'z15', day: vn(now), scanned: 120 }, { brandCode: 'z15', day: vn(now - 864e5), scanned: 80 }, { brandCode: 'z15', day: vn(now - 20 * 864e5), scanned: 50 }, { brandCode: 'khac', day: vn(now), scanned: 999 }];
    window.SLAuth.show('app', { brand: 'z15', brandName: 'Z15' }, 'admin'); location.hash = 'overview'; window.SLApp.reload(D); const c = document.querySelector('#view .grid.g-4 .kpi'); const kpi = { lbl: (c.querySelector('.lbl') || {}).textContent || '', val: (c.querySelector('.val') || {}).textContent || '', delta: (c.querySelector('.delta') || {}).textContent || '', cap: c.textContent };
    const scBak = D.scans; D.scans = []; /* user brand thật không có nhật ký scans → nhánh rút gọn của thanh nhịp quét */ location.hash = 'feed'; window.SLApp.reload(D); const sb = (document.querySelector('#view .scanbar') || {}).textContent || ''; D.scans = scBak;
    delete D.dailyStats; delete D.myBrand; location.hash = 'overview'; window.SLApp.reload(D); const c2 = document.querySelector('#view .grid.g-4 .kpi'); const back = (c2.querySelector('.lbl') || {}).textContent || '';
    window.SLAuth.show('app', {}, 'superadmin'); window.SLApp.reload(D); return { kpi, sb, back }; });
  await page.waitForTimeout(300);
  (/Bài đã quét/.test(k78.kpi.lbl) && k78.kpi.val === '200' && /\\+300/.test(k78.kpi.delta) && /14 ngày trước/.test(k78.kpi.cap) && /Bài đã quét hôm nay\\s*120/.test(k78.sb.replace(/\\s+/g, ' ')) && /Đã hẹn tư vấn/.test(k78.back)) ? ok('v119-78: counter brand → KPI "Bài đã quét 200" (14 ngày, ' + k78.kpi.delta.trim() + ' vs 14 ngày trước, bỏ brand khác) · thanh nhịp quét "Bài đã quét hôm nay 120" · hết counter → rơi về "Đã hẹn tư vấn"') : fail('v119-78 brand scanned: ' + JSON.stringify(k78));''', tag='smoke.v119-78')
done()
