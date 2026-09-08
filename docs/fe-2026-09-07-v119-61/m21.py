# m21.py <cây> — v119-79 / v120-esm-ac (08/09, anh: "check kĩ toàn diện số liệu ở tất cả các mục"). Áp lên cây đã qua m20 (v119-78 / v120-esm-ab).
# Vá các phát hiện đã KIỂM CHỨNG từ 3 agent rà (85 phát hiện, docs/rasoat-solieu-2026-09-08/): định nghĩa "lead hợp lệ" thống nhất, mẫu số tỷ lệ,
# đếm rail/badge khớp feed, số cứng "~3 phút" cho brand, ROI dự báo cộng deal đã chốt, N việc hôm nay, replies chưa xử lý, TTL bài đã quét,
# outreach_stats đóng băng ngày, lãi gộp phí tháng vs chi phí tới hôm nay, users active/pending, calib "ít mẫu", attribution tổng… Fail-closed nguyên tử.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
L='assets/js/live.js'; F='src/app/20-feed.js'; T='src/app/70-shell-tools.js'; V='src/app/60-scan-views.js'; P='src/app/30-pipeline.js'; R='src/app/40-roi.js'
C10='src/app/10-core-overview.js'; U='src/app/85-users-admin.js'; O='src/app/45-outreach.js'; K='src/app/50-config-views.js'; A='src/app/25-agency.js'; M='src/app/65-charts-lead-modal.js'; S='tools/smoke.js'
ESM = 'export {' in rd(F)
# ---------- live.js: 1 định nghĩa "lead hợp lệ" + mẫu số tỷ lệ + respAvg + outreach_stats sang ngày ----------
rep(L, "  const hot=leads.filter(l=>l.temp==='hot').length, warm=leads.filter(l=>l.temp==='warm').length, cold=leads.filter(l=>l.temp==='cold').length;\n  const sc=k=>leads.filter(l=>l.stage===k).length;\n  const responded=leads.filter(l=>['responded','booked','closed'].includes(l.stage)).length;\n  const booked=leads.filter(l=>['booked','closed'].includes(l.stage)).length;\n  const closed=sc('closed'), valid=leads.length, pct=(a,b)=>b?+(a/b*100).toFixed(1):0;",
"  /* v119-79: MỘT định nghĩa \"lead hợp lệ\" dùng cho mọi KPI/tỷ lệ/phễu/nguồn: không rác (junk), không Loại (dropped). Lead \"Không thành\" (lost) VẪN là lead hợp lệ\n     (nằm trong mẫu số tỷ lệ). Trước: valid=leads.length gộp cả rác + đã loại → KPI \"Lead hợp lệ\" lớn hơn số lead người dùng thấy ở feed, mọi tỷ lệ bị pha loãng.\n     pct → null khi mẫu số 0 (UI hiện \"—\", không còn \"0%\" giả). */\n  const act=leads.filter(l=>l.temp!=='junk'&&!l.dropped);\n  const hot=act.filter(l=>l.temp==='hot').length, warm=act.filter(l=>l.temp==='warm').length, cold=act.filter(l=>l.temp==='cold').length;\n  const sc=k=>act.filter(l=>l.stage===k).length;\n  const responded=act.filter(l=>['responded','booked','closed'].includes(l.stage)).length;\n  const booked=act.filter(l=>['booked','closed'].includes(l.stage)).length;\n  const closed=sc('closed'), valid=act.length, pct=(a,b)=>b?+(a/b*100).toFixed(1):null;", tag='live.act')
rep(L, "  const byDay=hotOnly=>days.map(d=>leads.filter(l=>{const t=toDate(l.detected_at);return t.toDateString()===d.toDateString()&&(!hotOnly||l.temp==='hot');}).length);",
       "  const byDay=hotOnly=>days.map(d=>act.filter(l=>{const t=toDate(l.detected_at);return t.toDateString()===d.toDateString()&&(!hotOnly||l.temp==='hot');}).length);", tag='live.byDay')
rep(L, "  const cur14=leads.filter(l=>dAt(l)>=t14), prev14=leads.filter(l=>{const t=dAt(l); return t>=t28&&t<t14;});",
       "  const cur14=act.filter(l=>dAt(l)>=t14), prev14=act.filter(l=>{const t=dAt(l); return t>=t28&&t<t14;});", tag='live.win14')
rep(L, "  const respAvg=a=>{ const xs=a.map(l=>{ const fc=Number(l.first_care_at)||0, d0=dAt(l); return (fc&&d0&&fc>=d0)?(fc-d0)/60000:null; }).filter(x=>x!=null&&x<7*1440); return xs.length?xs.reduce((x,y)=>x+y,0)/xs.length:null; };",
       "  const respAvg=a=>{ const xs=a.map(l=>{ const ft=l.first_care_at?toDate(l.first_care_at):null; const fc=(ft&&!isNaN(ft))?ft.getTime():0, d0=dAt(l); return (fc&&d0&&fc>=d0)?(fc-d0)/60000:null; }).filter(x=>x!=null&&x<30*1440); return xs.length?xs.reduce((x,y)=>x+y,0)/xs.length:null; }; // v119-79: first_care_at chấp nhận Timestamp/ISO (trước Number() → 0 → bị loại im lặng); trần 30 ngày khớp Bảng brand (trước 7 ngày làm TB đẹp giả)", tag='live.respAvg')
rep(L, "  const indMap={}; leads.forEach(l=>{const k=l.industry||'Khác';indMap[k]=(indMap[k]||0)+1;});",
       "  const indMap={}; act.forEach(l=>{const k=l.industry||'Khác';indMap[k]=(indMap[k]||0)+1;});", tag='live.industry')
rep(L, "  const bySrc=new Map(); leads.forEach(l=>{const k=l.source||''; let a=bySrc.get(k); if(!a){a={n:0,hot:0}; bySrc.set(k,a);} a.n++; if(l.temp==='hot')a.hot++;});",
       "  const bySrc=new Map(); act.forEach(l=>{const k=l.source||''; let a=bySrc.get(k); if(!a){a={n:0,hot:0}; bySrc.set(k,a);} a.n++; if(l.temp==='hot')a.hot++;}); // v119-79: theo lead hợp lệ (trước gồm rác → \"tỷ lệ nóng\" theo nguồn bị pha loãng)", tag='live.bySrc')
rep(L, "      {stage:'Đã tiếp cận',value:leads.filter(l=>['commented','inbox','responded','booked','closed'].includes(l.stage)).length},",
       "      {stage:'Đã tiếp cận',value:act.filter(l=>['commented','inbox','responded','booked','closed'].includes(l.stage)).length},", tag='live.funnel')
rep(L, "        var tk=new Date(Date.now()+7*3600*1000).toISOString().slice(0,10); // ngày VN (UTC+7)\n        var statsQ = byBrand ? query(collection(db,'outreach_stats'), where('brandCode','==',byBrand)) : query(collection(db,'outreach_stats'), where('day','==',tk));\n        dataUnsub.push(onSnapshot(statsQ, snap=>{ chanOk('outreach_stats'); outreachStats={}; snap.forEach(d=>{ var x=d.data(); if(x.brandCode && x.day===tk) outreachStats[x.brandCode]=x; }); oaRepaint(); }, snapErr('outreach_stats')));",
       "        /* v119-79: ngày VN tính LẠI mỗi lần áp (trước: chốt cứng lúc subscribe → tab mở qua nửa đêm vẫn hiện số HÔM QUA dưới nhãn \"hôm nay\"). Super: query day >= hôm-nay-lúc-subscribe (listener sống qua ngày), lọc đúng hôm nay ở client; kiểm ngày mỗi 5' */\n        var vnToday=function(){ return new Date(Date.now()+7*3600*1000).toISOString().slice(0,10); }; var tk0=vnToday(), oaDay=tk0, oaRaw=[];\n        var oaApply=function(){ var tk=vnToday(); outreachStats={}; oaRaw.forEach(function(x){ if(x.brandCode && x.day===tk) outreachStats[x.brandCode]=x; }); oaRepaint(); };\n        var statsQ = byBrand ? query(collection(db,'outreach_stats'), where('brandCode','==',byBrand)) : query(collection(db,'outreach_stats'), where('day','>=',tk0));\n        dataUnsub.push(onSnapshot(statsQ, snap=>{ chanOk('outreach_stats'); oaRaw=[]; snap.forEach(d=>oaRaw.push(d.data()||{})); oaApply(); }, snapErr('outreach_stats')));\n        var oaDayT=setInterval(function(){ var t=vnToday(); if(t!==oaDay){ oaDay=t; oaApply(); } }, 5*60*1000); dataUnsub.push(function(){ clearInterval(oaDayT); });", tag='live.oaDay')
# ---------- 20-feed: KPI null-safe · rail đếm khớp feed · opsStrip nhịp · todayBoard đồng bộ ----------
rep(F, "            + kpiCard(SLI.target,'var(--warm-bg)','var(--warm)', k.closeRate+'%', 'Tỷ lệ chốt', ...kDelta(kd.closeRate,'đ'), cap('trên lead hợp lệ','closeRate')); })()}",
       "            + kpiCard(SLI.target,'var(--warm-bg)','var(--warm)', k.closeRate==null?'—':k.closeRate+'%', 'Tỷ lệ chốt', ...kDelta(kd.closeRate,'đ'), k.closeRate==null?'chưa có lead hợp lệ':cap('trên lead hợp lệ (không tính rác/đã loại)','closeRate')); })()}", tag='feed.closeRate')
rep(F, "    D.leads.forEach(l=>{ cnt[l.temp]=(cnt[l.temp]||0)+1; });",
       "    const vis=D.leads.filter(l=>!feedHidden(l)); vis.forEach(l=>{ cnt[l.temp]=(cnt[l.temp]||0)+1; }); cnt.junk=D.leads.length-vis.length; // v119-79: đếm đúng số thẻ sẽ hiện khi bấm (feed mặc định ẩn rác/đã loại/không thành); Rác·Loại = phần bị ẩn", tag='feed.railCnt')
rep(F, "    const unassigned=D.leads.filter(l=>!l.assignee&&l.temp!=='junk'&&!l.dropped).sort((a,b)=>b.score-a.score); // v170: không gợi ý giao lead đã Loại",
       "    const unassigned=D.leads.filter(l=>!l.assignee&&!feedHidden(l)&&l.stage!=='closed').sort((a,b)=>b.score-a.score); // v170: không gợi ý giao lead đã Loại · v119-79: bỏ cả Không thành/đã chốt", tag='feed.railUnassigned')
rep(F, "        const due=D.leads.filter(l=>l.fu_at && l.fu_at<=eod.getTime() && l.stage!=='closed' && l.temp!=='junk').sort((a,b)=>a.fu_at-b.fu_at);",
       "        const due=D.leads.filter(l=>l.fu_at && l.fu_at<=eod.getTime() && l.stage!=='closed' && !feedHidden(l)).sort((a,b)=>a.fu_at-b.fu_at); // v119-79: khớp card Hôm nay (bỏ lead đã loại/không thành)", tag='feed.railDue')
rep(F, "<span class=\"rail-sum\"><b>${(D.leads||[]).length}</b> lead</span>",
       "<span class=\"rail-sum\"><b>${vis.length}</b> lead${cnt.junk?` <span class=\"muted\" style=\"font-weight:400\">+${cnt.junk} ẩn</span>`:''}</span>", tag='feed.railSum')
rep(F, "<span>${on?'đang bật · 3 phút/lượt':'đang tắt · chỉ quét khi bấm'}",
       "<span>${on?'đang bật · lịch 3′/lượt · gieo mỗi nguồn '+scanIv()+'′':'đang tắt · chỉ quét khi bấm'}", tag='feed.opsStrip')
rep(F, "    const map={unassigned:'unassigned',overdue:'today',due:'today',replied:'replied',closed:'all'};",
       "    const map={unassigned:'unassigned',overdue:'overdue',due:'today',replied:'replied',closed:'all'}; // v119-79: Quá hẹn có bộ lọc riêng (trước 2 ô khác số cùng dẫn về 1 danh sách)", tag='feed.todayGo')
# ---------- 10-core: todayBoard đồng bộ tập lead · TTL text · lãi gộp tạm tính ----------
rep(C10, "      closedToday: all.filter(l=>l.stage==='closed'&&(Number(l.closed_at)||Number(l.stage_at)||0)>=t0),\n      pendingValue: all.filter(l=>l.stage==='closed'&&l.deal_value_pending)",
         "      closedToday: L.filter(l=>l.stage==='closed'&&(Number(l.closed_at)||Number(l.stage_at)||0)>=t0), // v119-79: cùng tập L như 7 ô còn lại\n      pendingValue: L.filter(l=>l.stage==='closed'&&l.deal_value_pending)", tag='core.todayBoard')
rep(C10, "    scanned:     ['Bài đã quét','Mọi bài AI đã đọc, bài không phù hợp tự xoá sau 7 ngày'],", "    scanned:     ['Bài đã quét','Mọi bài AI đã đọc, bài không phù hợp tự xoá sau ~3 ngày'],", tag='core.ttl')
rep(C10, "        const fee=isBrand?(Number((roiParamsFor(brandDoc)||{}).fee)||0):0;\n        const profit=fee-costVnd, mar=fee>0?Math.round(profit/fee*100):null;",
         "        const feeFull=isBrand?(Number((roiParamsFor(brandDoc)||{}).fee)||0):0;\n        const fee=feeFull*bdPro; // v119-79: phí gói TẠM TÍNH theo số ngày đã qua trong tháng (chi phí BrightData/AI cũng chỉ tới hôm nay) — trước: phí trọn tháng trừ chi phí tới hôm nay → lãi gộp đầu tháng ~95% rồi tụt dần\n        const profit=fee-costVnd, mar=fee>0?Math.round(profit/fee*100):null;", tag='core.margin')
rep(C10, "      const mkRow=(label,sh,code,isBrand,brandDoc)=>{",
         "      const bdPro=(()=>{ const d=new Date(Date.now()+7*3600e3); const dim=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate(); return Math.min(1,d.getUTCDate()/dim); })(); // v119-79: tỷ lệ ngày đã qua của tháng (giờ VN)\n      const mkRow=(label,sh,code,isBrand,brandDoc)=>{", tag='core.marginPro')
rep(C10, "<th>Tổng CP (₫)</th><th>Phí gói (₫/th)</th><th>Lãi gộp</th>", "<th>Tổng CP (₫)</th><th>Phí gói tạm tính (₫, đến hôm nay)</th><th>Lãi gộp</th>", tag='core.marginHead')
# ---------- 70-shell: badge Lead mới khớp feed · replies chưa xử lý · Hộp việc dùng cùng logic ----------
rep(T, "    if(cnt){ const fresh=(D.leads||[]).filter(l=>l.stage==='new').length;", "    if(cnt){ const fresh=(D.leads||[]).filter(l=>l.stage==='new'&&!feedHidden(l)).length; /* v119-79: khớp feed (ẩn rác/đã loại/không thành) */", tag='shell.badge')
rep(T, "      return {l,tr,done:humanAfter||l.stage!=='responded'}; })", "      return {l,tr,done:humanAfter}; }) // v119-79: máy phát hiện phản hồi mà giai đoạn chưa đổi (new/inbox) vẫn là CHƯA xử lý (trước bị coi là \"đã tiếp quản\")", tag='shell.replyDone')
rep(T, "    T.replied.forEach(l=>push('replied',1,l,'Khách đã phản hồi – liên hệ ngay (máy đã dừng tự động)','ok'));",
       "    replyLeads().filter(x=>!x.done).forEach(x=>push('replied',1,x.l,'Khách đã phản hồi – liên hệ ngay (máy đã dừng tự động)','ok')); // v119-79: chỉ phản hồi CHƯA ai xử lý (khớp badge Phản hồi khách; trước đếm mọi lead 'responded' kể cả đã xử lý)", tag='shell.tasksReplied')
# ---------- 60-scan-views: nhịp/trạng thái cho brand · Chưa đạt/loại · TTL · nhãn cửa sổ ----------
rep(V, "<span class=\"sb-s\"><span class=\"sb-k\">Nhịp quét</span><b>${D.autoScanEnabled===false?'—':'~3'}</b>&nbsp;phút/lượt</span>",
       "<span class=\"sb-s\"><span class=\"sb-k\">Nhịp gieo</span><b>${D.autoScanEnabled===false?'—':scanIv()+'′'}</b>&nbsp;mỗi nguồn</span>", tag='scan.brandCad')
rep(V, "    return '<span class=\"sb-live\"><i class=\"sb-dot\"></i>Đang trực 24/7</span>';",
       "    return roleIsSuper()?'<span class=\"sb-live\"><i class=\"sb-dot\"></i>Đang trực 24/7</span>':'<span class=\"sb-live\"><i class=\"sb-dot\"></i>Quét tự động đang bật</span>'; // v119-79: brand không đọc được system_status → không khẳng định \"24/7\"", tag='scan.sbLive')
rep(V, "    const rejected=c.prefiltered_out+c.excluded+c.no_keyword+c.self_comment+c.seller;\n", "", tag='scan.rejectedVar')
rep(V, "fmt(c.scored_low+rejected), 'Chưa đạt / loại','','', 'tự xoá sau 7 ngày')", "fmt(rejCnt), 'Chưa đạt / loại','','', 'tự xoá sau ~3 ngày')", tag='scan.rejKpi')
rep(V, "      : 'Bài không phù hợp – sẽ tự xoá sau ~1 ngày để danh sách gọn gàng.';", "      : 'Bài không phù hợp – sẽ tự xoá sau ~3 ngày để danh sách gọn gàng.';", tag='scan.ttl1')
rep(V, "<div class=\"sub\">Toàn bộ bài đã chấm</div>", "<div class=\"sub\">Trong 1.000 lượt quét gần nhất đã nạp</div>", tag='scan.donutSub')
rep(V, "fmt(A.posts), 'Tổng bài đã quét','','', fmt(A.matched)+' bài khớp keyword')", "fmt(A.posts), 'Bài đã quét (1.000 lượt gần nhất)','','', fmt(A.matched)+' bài khớp keyword')", tag='scan.histKpi')
rrep(V, r"tự xoá sau 7 ngày", "tự xoá sau ~3 ngày", count=None, tag='scan.ttl7')
# ---------- 30-pipeline: N việc · bộ lọc Quá hẹn · chữ ký theo thời gian ----------
rep(P, "· ${(stuckLeads.length?1:0)+(junkLeads.length?1:0)} việc hôm nay", "· ${stuckLeads.length+junkLeads.length} việc hôm nay", tag='pv.nViec')
rep(P, "    replied: l => l.stage==='responded' // v119-40: khách đã phản hồi (engine/webhook đẩy về) - người thật tiếp quản",
       "    overdue: l => !!(l.fu_at && l.fu_at<=Date.now() && l.stage!=='closed'), // v119-79: quá hẹn riêng (ô \"Quá hẹn\" ở card Hôm nay dẫn về đây)\n    replied: l => l.stage==='responded' // v119-40: khách đã phản hồi (engine/webhook đẩy về) - người thật tiếp quản", tag='pv.overdueFilter')
rep(P, ".concat([['today','Hẹn hôm nay'],['replied','Đã phản hồi']])", ".concat([['today','Hẹn hôm nay'],['overdue','Quá hẹn'],['replied','Đã phản hồi']])", tag='pv.overdueChip')
rep(P, "    return s;\n", "    return s+'|t'+Math.floor(Date.now()/6e5); // v119-79: tuổi thẻ/quá hẹn được vẽ lại ở repaint mềm mỗi ~10' (trước đứng yên tới khi dữ liệu đổi)\n", tag='pv.sigTime')
# ---------- 40-roi: dự báo bỏ deal đã chốt · cohort sạch · nMonth không fallback · Đơn giản theo 30 ngày · pipeline ≠ đã thu ----------
rep(R, "      const cohort = (arr||[]).filter(l=>{ const d=parseTS(l.detected_at); return l.temp===t && d && d.getTime() < t0; });",
       "      const cohort = (arr||[]).filter(l=>{ const d=parseTS(l.detected_at); return l.temp===t && !l.dropped && !l.lost && d && d.getTime() < t0; }); // v119-79: lead đã Loại/Không thành không vào mẫu số tỷ lệ chốt tự học", tag='roi.cohort')
rep(R, "    if (!nMonth) nMonth = Number(kpiHW)||arr.filter(l=>l.temp==='hot'||l.temp==='warm').length;  // 3) fallback",
       "    /* v119-79: BỎ fallback \"toàn cửa sổ\" (không giới hạn ngày) — nhãn ghi \"/tháng\" mà chia cho lead cả cửa sổ là sai; không có lead 30 ngày → 0 → UI hiện \"—\" */\n    const n30=arr.filter(l=>{ const d=parseTS(l.detected_at); return d && d.getTime()>=Date.now()-30*864e5 && l.temp!=='junk' && !l.dropped; }).length;", tag='roi.nMonth')
rep(R, "    const expDeals=stageRows.reduce((a,x)=>a+x.n*x.p/100,0), expVal=stageRows.reduce((a,x)=>a+x.val,0);",
       "    const openRows=stageRows.filter(x=>x.st.key!=='closed'); // v119-79: dự báo chỉ từ lead ĐANG MỞ (trước cộng cả deal đã chốt với p=100%)\n    const expDeals=openRows.reduce((a,x)=>a+x.n*x.p/100,0), expVal=openRows.reduce((a,x)=>a+x.val,0);", tag='roi.expOpen')
rep(R, "    return { open, closedN, rates, expected, realized, realizedReal, realizedEst, dealsWithVal:withVal.length, dealsNoVal:noVal.length, budgetN, nMonth, cplSL, adsCost, saving, cheaper, evAvg, byTemp, stageRows, fc };",
       "    return { open, closedN, rates, expected, realized, realizedReal, realizedEst, dealsWithVal:withVal.length, dealsNoVal:noVal.length, budgetN, nMonth, n30, cplSL, adsCost, saving, cheaper, evAvg, byTemp, stageRows, fc };", tag='roi.return')
rep(R, "      ${roiStat('Giá trị pipeline ước tính', fmtVnd(C.expected+C.realized), '= '+fmt(C.open.length)+' lead × giá trị kỳ vọng'+(C.closedN?(' + '+fmt(C.closedN)+' đã chốt'):''))}",
       "      ${roiStat('Giá trị pipeline ước tính', fmtVnd(C.expected), 'Σ giá trị kỳ vọng của '+fmt(C.open.length)+' lead đang mở (doanh thu đã chốt xem khối dưới)')}", tag='roi.pipeLabel')
rep(R, "      ${roiStat('Chi phí mỗi lead SmartLead', fmtVnd(C.cplSL), '= phí gói ÷ '+fmt(C.nMonth)+' lead nóng+ấm')}",
       "      ${roiStat('Chi phí mỗi lead SmartLead', C.nMonth?fmtVnd(C.cplSL):'—', C.nMonth?('= phí gói ÷ '+fmt(C.nMonth)+' lead nóng+ấm / 30 ngày'):'chưa có lead nóng/ấm trong 30 ngày')}", tag='roi.cpl')
rep(R, "    return (Number(R.leadsMonth)||0) > 0 ? Number(R.leadsMonth) : (C.open.length + C.closedN);",
       "    return (Number(R.leadsMonth)||0) > 0 ? Number(R.leadsMonth) : (C.n30||0); // v119-79: lead hợp lệ 30 NGÀY (trước: cả cửa sổ → phí tháng chia cho lead nhiều tháng)", tag='roi.simpleN')
rep(R, "      ${roiStat('Tổng lead nhận được', fmt(N), usedOverride?'Z15 khai báo cho kỳ này':('lead hợp lệ đã tạo · '+tempCap))}",
       "      ${roiStat('Tổng lead nhận được', fmt(N), usedOverride?'Z15 khai báo cho kỳ này':('lead hợp lệ 30 ngày · đang mở: '+tempCap))}", tag='roi.simpleLabel')
rep(R, "        ${roiStat('Lead đang xử lý', fmt(tot.open), 'toàn hệ thống · chưa tính lead rác/đã chốt')}",
       "        ${roiStat('Lead đang xử lý', fmt(tot.open), 'trong '+fmt((D.leads||[]).length)+' lead gần nhất đã tải · chưa tính lead rác/đã chốt')}", tag='roi.superOpen')
# ---------- 85-users / 45-outreach / 50-reports / 25-agency / 65-modal ----------
rep(U, "fmt(us.filter(u=>u.active).length), 'Đang hoạt động'", "fmt(us.filter(u=>u.active!==false).length), 'Đang hoạt động'", tag='users.active')
rep(U, "admLoading?'…':fmt(n('pending')), 'Chờ duyệt'", "admLoading?'…':fmt(pendingUsers.length), 'Chờ duyệt'", tag='users.pending')
rep(O, "        <div class=\"oa-stat\"><div class=\"n mono\">${c.funnel}</div><div class=\"l\">Lead trong phễu</div></div>\n        <div class=\"oa-stat\"><div class=\"n mono\">${c.on ? c.replied : '—'}</div><div class=\"l\">Đã rep hôm nay</div></div>",
       "        <div class=\"oa-stat\"><div class=\"n mono\">${c.funnel}</div><div class=\"l\">Lượt cảm xúc hôm nay</div></div>\n        <div class=\"oa-stat\"><div class=\"n mono\">${c.replied}</div><div class=\"l\">Đã rep hôm nay</div></div>", tag='oa.card')
rep(O, "fmt(inFunnel), 'Lead trong phễu hôm nay', '', '', 'đang được warm-up')", "fmt(inFunnel), 'Lượt thả cảm xúc hôm nay', '', '', 'bước 1 của phễu · mỗi lead vào phễu = 1 lượt')", tag='oa.kpi')
rep(K, "'tỷ lệ phản hồi '+k.responseRate+'%')", "k.responseRate==null?'chưa có lead hợp lệ':'tỷ lệ phản hồi '+k.responseRate+'% trên lead hợp lệ')", tag='rep.resp')
rep(K, "'tỷ lệ hẹn '+k.bookingRate+'%')", "k.bookingRate==null?'chưa có lead hợp lệ':'tỷ lệ hẹn '+k.bookingRate+'%')", tag='rep.book')
rep(K, "'tỷ lệ chốt '+k.closeRate+'%')", "k.closeRate==null?'chưa có lead hợp lệ':'tỷ lệ chốt '+k.closeRate+'%')", tag='rep.close')
rep(K, "r.cur==null?'chưa có lead được chăm trong 14 ngày':(d?'so với 14 ngày trước (thấp = tốt)':'14 ngày gần nhất')", "r.cur==null?'chưa có lead được chăm trong 14 ngày':(d?'lead đã được chăm · so với 14 ngày trước (thấp = tốt)':'lead đã được chăm · 14 ngày gần nhất')", tag='rep.respCap')
rep(K, "    const tot=rows.reduce((a,o)=>({n:a.n+o.n,hot:a.hot+o.hot,resp:a.resp+o.resp,closed:a.closed+o.closed,rev:a.rev+o.rev}),{n:0,hot:0,resp:0,closed:0,rev:0});",
       "    const tot=[...by.values()].reduce((a,o)=>({n:a.n+o.n,hot:a.hot+o.hot,resp:a.resp+o.resp,closed:a.closed+o.closed,rev:a.rev+o.rev}),{n:0,hot:0,resp:0,closed:0,rev:0}); // v119-79: dòng Tổng cộng TẤT CẢ nguồn (trước chỉ 12 nguồn top nhưng nhãn ghi đủ N nguồn)", tag='rep.attrTot')
rep(K, "<td>${x.n?x.resp+'%':'—'}</td>", "<td>${x.n?x.resp+'%'+(x.n<30?' <span class=\"muted\" style=\"font-size:10px\">ít mẫu</span>':''):'—'}</td>", tag='rep.calibFew')
rep(A, "s+=20*((r.sla==null)?(r.leads30?0:0.5):r.sla/100);", "s+=20*((r.sla==null)?0:r.sla/100);", tag='agy.slaScore')
rep(A, "sla:'% lead hợp lệ 30 ngày được chăm lần đầu trong ngưỡng quá hạn của brand (lead chưa chăm = KHÔNG đạt)'",
       "sla:'% lead hợp lệ 30 ngày được chăm lần đầu trong ngưỡng (counter làm tròn LÊN mốc 15/30/60/120′ gần nhất so với ngưỡng quá hạn của brand — xấp xỉ; lead chưa chăm = KHÔNG đạt)'", tag='agy.slaTip')
rep(M, "'lần đầu thấy số này'", "'chưa thấy trong dữ liệu đã tải'", tag='modal.phoneFirst')
rep(M, "toast(n?('Máy chủ có '+n+' lead mang số này.'):'Máy chủ không có thêm lead nào mang số này.')", "toast(n?('Máy chủ có '+n+' lead mang số này (kể cả lead đang xem).'):'Máy chủ không có thêm lead nào mang số này.')", tag='modal.phoneToast')
# ---------- ESM: tên dùng chéo part ----------
if ESM:
    rep(F, "export { NOTE_IC,", "export { NOTE_IC, feedHidden,", tag='esm.exportFeedHidden')
    rep(T, "import { crmCfg, fmtPhoneVN, fmtWhen, isMine, leadNo, leadNotes, nextBestCard, noteAgo, renderFeed, setFeedQuery, stripMd } from './20-feed.js';",
           "import { crmCfg, feedHidden, fmtPhoneVN, fmtWhen, isMine, leadNo, leadNotes, nextBestCard, noteAgo, renderFeed, setFeedQuery, stripMd } from './20-feed.js';", tag='esm.import70')
    rep(V, "import { esc, escUrl } from './50-config-views.js';", "import { esc, escUrl, scanIv } from './50-config-views.js';", tag='esm.import60')
    rep(F, "import { esc, escJsAttr, escUrl, isAutoScanOn, scanIv } from './50-config-views.js';", "import { esc, escJsAttr, escUrl, isAutoScanOn, scanIv } from './50-config-views.js';", tag='esm.import20ok')
# ---------- smoke ----------
rep(S, '''  /* v119-78: có counter daily_stats.scanned của brand''',
'''  /* v119-79: số liệu khớp nhau: rail feed = số thẻ hiện · badge Lead mới bỏ rác/loại · pipeline "N việc" đếm thật + bộ lọc Quá hẹn · ROI dự báo không cộng deal đã chốt · Hộp việc replies = chưa xử lý */
  const k79 = await page.evaluate(() => { const D = window.SL_DATA; const hid = l => !!(l.dropped || l.lost || l.temp === 'junk');
    const L0 = D.leads.slice(); const j = D.leads.find(l => l.temp === 'hot' && !hid(l)); const bak = { dropped: j.dropped, stage: j.stage }; j.dropped = true; // 1 lead nóng bị Loại
    location.hash = 'feed'; window.SLApp.reload(D); const rail = document.querySelector('#view .rail-temp[data-rt="hot"] b'); const railHot = rail ? +rail.textContent : -1; const wantHot = D.leads.filter(l => l.temp === 'hot' && !hid(l)).length;
    const badge = +((document.getElementById('cntFeed') || {}).textContent || 0); const wantBadge = D.leads.filter(l => l.stage === 'new' && !hid(l)).length;
    location.hash = 'pipeline'; window.SLApp.reload(D); const chipOverdue = !!document.querySelector('#view [data-pf="overdue"]'); const nv = (document.querySelector('#view .pv2-ihead .mut') || {}).textContent || '';
    j.dropped = bak.dropped; D.leads = L0; return { railHot, wantHot, badge, wantBadge, chipOverdue, nv }; });
  await page.waitForTimeout(200);
  (k79.railHot === k79.wantHot && k79.badge === k79.wantBadge && k79.chipOverdue && /\\d+ việc hôm nay|^$/.test(k79.nv.trim())) ? ok('v119-79: rail Nóng ' + k79.railHot + ' = số thẻ hiện (bỏ lead đã Loại) · badge Lead mới ' + k79.badge + ' khớp feed · pipeline có bộ lọc Quá hẹn' + (k79.nv ? ' · "' + k79.nv.trim() + '"' : '')) : fail('v119-79 số liệu: ' + JSON.stringify(k79));
  /* v119-78: có counter daily_stats.scanned của brand''', tag='smoke.v119-79')
done()
