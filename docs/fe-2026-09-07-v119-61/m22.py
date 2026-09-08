# m22.py <cây> — v119-80 / v120-esm-ad (08/09 tối, anh giao em TỰ CHỐT 12 mục "chờ chốt" + 2 mục backend FE-side của báo cáo rà số liệu
# docs/rasoat-solieu-2026-09-08/ theo hướng "thuận tiện, thông minh, tự động hoá cao"). Áp lên cây đã qua m21 (v119-79 / v120-esm-ac).
# Chốt: (1+2) 4 ô KPI Bảng điều khiển = giá trị 14 NGÀY (khớp mũi tên), ưu tiên BỘ ĐẾM máy chủ daily_stats (chính xác mọi quy mô), lead đã nạp chỉ là dự phòng;
# (3) ô 4 = "Đã chốt" theo NGÀY CHỐT (delta không còn nghiêng âm), tỷ lệ chốt ở caption; (4) mốc "hôm nay" = nửa đêm giờ VIỆT NAM toàn app (khớp bộ đếm);
# (5) pipeline: lead ở cột Mới ≥7 ngày chưa chăm = kẹt + phễu ghi "toàn pipeline" khi đang lọc; (6) độ tin cậy hồ sơ: mô tả dữ kiện, cảnh báo tham gia chip;
# (7) báo cáo: dòng phạm vi số liệu (màn hình + bản in); (8) keyword / hiệu chỉnh điểm: dưới 10 lead → "ít mẫu" thay vì %; (9) ROI Super Admin: dự báo cộng từng brand
# theo tham số riêng, tổng tiết kiệm cộng cả brand âm (khớp phương trình), brand hoạt động = không tắt + có lead/tham số/nguồn bật; (10) Tiếp cận: brand 0 nick → "chưa gán nick",
# panel VPS chỉ cộng VPS online; (11) benchmark CPL đưa vào cấu hình kèm năm + nguồn, Super Admin sửa ngay trên web; (12) Cmd+K: SĐT không có trong lead đã tải → "Tìm trên máy chủ";
# (B) nguồn ↔ lead nối theo MÃ GROUP trong URL trước, tên sau (đổi tên nguồn không mất số); (C) stage_log: lịch sử giai đoạn ghi riêng best-effort → Dòng thời gian 360° đủ hành trình
# (Rules whitelist stage_log = LỆNH #40); (D) Bảng brand: SLA đạt ưu tiên counter slaOk/slaN đúng ngưỡng brand (LỆNH #40), ước tính theo cohort ngày phát hiện.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
L='assets/js/live.js'; F='src/app/20-feed.js'; T='src/app/70-shell-tools.js'; P='src/app/30-pipeline.js'; R='src/app/40-roi.js'
C10='src/app/10-core-overview.js'; O='src/app/45-outreach.js'; K='src/app/50-config-views.js'; A='src/app/25-agency.js'; M='src/app/65-charts-lead-modal.js'; S='tools/smoke.js'
ESM = 'export {' in rd(F)

# ---------- 10-core: 1 mốc "hôm nay" theo giờ VN cho toàn app ----------
rep(C10, "  function slNow(){ return (typeof window.SL_NOW==='function') ? window.SL_NOW() : Date.now(); }\n",
"""  function slNow(){ return (typeof window.SL_NOW==='function') ? window.SL_NOW() : Date.now(); }
  /* v119-80: MỘT mốc "hôm nay" cho toàn app = nửa đêm GIỜ VIỆT NAM (khớp bộ đếm máy chủ daily_stats/outreach_stats + thanh nhịp quét).
     Trước: card Hôm nay / Hộp việc / pipeline / chip hẹn dùng nửa đêm máy khách → người dùng ở múi giờ khác thấy số "hôm nay" lệch với bộ đếm. */
  function vnDayStart(ms){ const t=(ms==null?Date.now():Number(ms))+7*3600e3; return Math.floor(t/864e5)*864e5-7*3600e3; }
  function vnDayKey(ms){ return new Date((ms==null?Date.now():Number(ms))+7*3600e3).toISOString().slice(0,10); }
""", tag='core.vnDay')
rep(C10, "    const now=Date.now(), d0=new Date(); d0.setHours(0,0,0,0); const t0=d0.getTime(), eod=t0+864e5-1;\n    const all=D.leads||[];",
         "    const now=Date.now(), t0=vnDayStart(now), eod=t0+864e5-1; // v119-80: \"hôm nay\" theo giờ VN (khớp bộ đếm máy chủ)\n    const all=D.leads||[];", tag='core.todayBoard')
rep(C10, "    const now=Date.now(), t0=(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); })(), eod=t0+864e5-1;",
         "    const now=Date.now(), t0=vnDayStart(now), eod=t0+864e5-1; // v119-80: ngày VN", tag='core.nextBest')

# ---------- 20-feed: KPI 14 ngày theo bộ đếm · Đã chốt theo ngày chốt · hôm nay VN · độ tin cậy ----------
cut(F, "      <div class=\"grid g-4\">\n        ${(()=>{ /* v119-40: delta THẬT 14 ngày vs 14 ngày trước", "; })()}\n      </div>", tag='feed.kpiCut')
rep(F, "      ${nextBestCard()}\n",
"""      ${nextBestCard()}
      <div class="grid g-4">
        ${(()=>{ /* v119-80 (anh giao em chốt): 4 ô = GIÁ TRỊ 14 NGÀY (số to và mũi tên ▲▼ cùng một kỳ — trước: số to là cả cửa sổ lead đã tải, mũi tên là 14 ngày);
             nguồn số ưu tiên BỘ ĐẾM máy chủ daily_stats (kpi14: chính xác mọi quy mô, brand user lẫn super đều đọc được), chưa có → lead đã nạp; demo → số cả cửa sổ như cũ. */
          const kd=k.delta||{}, kw=k.win||null; const cap=(base,key)=> (kd[key]==null?base:(base+' · so với 14 ngày trước'));
          const q=kpi14(); const vs=(q&&q.src==='counter')?' · bộ đếm máy chủ':'';
          const sc=brandScan14(roleIsSuper()); // v119-78/80: counter LỆNH #39 — super gộp mọi brand, brand user chỉ brand mình; chưa có counter → nhật ký quét (super) / Đã hẹn tư vấn (brand)
          const c1 = sc ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', fmt(sc.cur), 'Bài đã quét', ...kDelta(sc.delta), 'bài AI đã đọc / 14 ngày'+(sc.delta==null?'':' · so với 14 ngày trước')+' · bộ đếm máy chủ')
            : (roleIsSuper()
              ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', k.scanned==null?'—':fmt(k.scanned), 'Bài đã quét', ...kDelta(kd.scanned), k.scanned==null?'chưa có nhật ký quét':(kw?cap(fmt(kw.scanned||0)+' bài / 14 ngày','scanned'):'từ nhật ký quét'))
              : kpiCard(SLI.calendar,'var(--brand-50)','var(--brand-600)', fmt(k.booked||0), 'Đã hẹn tư vấn', '', '', 'tỷ lệ hẹn '+(k.bookingRate||0)+'% trên lead hợp lệ'));
          if(!q) return c1
            + kpiCard(SLI.checkCircle,'var(--success-bg)','var(--success)', fmt(k.validLeads), 'Lead hợp lệ', '', '', 'sau khi AI lọc rác')
            + kpiCard(SLI.flame,'var(--hot-bg)','var(--hot)', fmt(k.hot), 'Lead nóng', '', '', 'điểm AI ≥ 80 – ưu tiên')
            + kpiCard(SLI.target,'var(--warm-bg)','var(--warm)', k.closeRate==null?'—':k.closeRate+'%', 'Tỷ lệ chốt', '', '', k.closeRate==null?'chưa có lead hợp lệ':'trên lead hợp lệ (không tính rác/đã loại)');
          const tot=fmt(k.validLeads);
          return c1
            + kpiCard(SLI.checkCircle,'var(--success-bg)','var(--success)', fmt(q.valid), 'Lead hợp lệ', ...kDelta(q.dValid), '14 ngày, AI đã lọc rác'+(q.dValid==null?'':' · so với 14 ngày trước')+' · tổng đã nạp '+tot)
            + kpiCard(SLI.flame,'var(--hot-bg)','var(--hot)', fmt(q.hot), 'Lead nóng', ...kDelta(q.dHot), 'điểm AI ≥ 80 · 14 ngày'+(q.dHot==null?'':' · so với 14 ngày trước'))
            + kpiCard(SLI.trophy,'var(--warm-bg)','var(--warm)', fmt(q.closed), 'Đã chốt', ...kDelta(q.dClosed), 'deal chốt trong 14 ngày'+(q.closeRate==null?'':' · tỷ lệ chốt '+String(q.closeRate).replace('.',',')+'% trên lead hợp lệ')+(q.dClosed==null?'':' · so với 14 ngày trước')+vs); })()}
      </div>
""", tag='feed.kpiNew')
rep(F, "  function brandScan14(){\n    const my=D.myBrand&&D.myBrand.code;",
       "  function brandScan14(all){ // v119-80: all=true (super) gộp mọi brand\n    const my=all?null:(D.myBrand&&D.myBrand.code);", tag='feed.brandScan14')
rep(F, "  /* v119-40 (P10): card \"HÔM NAY\" - việc cần làm ngay, bấm số là nhảy đúng bộ lọc */",
"""  /* v119-80: 4 ô KPI Bảng điều khiển theo KỲ 14 NGÀY. Nguồn: (a) bộ đếm daily_stats (super: mọi brand — live.js làm ấm agStart; brand user: brand mình) →
     valid = new (AI đã lọc rác), hot, closed THEO NGÀY CHỐT; (b) chưa có bộ đếm → lead đã nạp (kpi.win + closed_at); (c) demo → null (ô cũ). Delta = vs 14 ngày liền trước. */
  function kpi14(){
    const k=D.kpi||{}; const kw=k.win||null; const my=roleIsSuper()?null:((D.myBrand&&D.myBrand.code)||null);
    const ds=(D.dailyStats||[]).filter(x=>x&&x.day&&(!my||x.brandCode===my)&&(x.new!=null||x.closed!=null||x.hot!=null));
    const now=Date.now(), d0=vnDayKey(now-13*864e5), dP=vnDayKey(now-27*864e5);
    const dl=(a,b)=>(b>0)?+(((a-b)/b)*100).toFixed(1):null;
    if(ds.length){
      const cur={new:0,hot:0,closed:0}, prev={new:0,hot:0,closed:0}; let prevHas=false;
      ds.forEach(x=>{ const o=x.day>=d0?cur:(x.day>=dP?prev:null); if(!o) return; if(o===prev) prevHas=true; o.new+=Number(x.new)||0; o.hot+=Number(x.hot)||0; o.closed+=Number(x.closed)||0; });
      return {src:'counter', valid:cur.new, hot:cur.hot, closed:cur.closed, dValid:prevHas?dl(cur.new,prev.new):null, dHot:prevHas?dl(cur.hot,prev.hot):null, dClosed:prevHas?dl(cur.closed,prev.closed):null, closeRate:cur.new?+(cur.closed/cur.new*100).toFixed(1):null};
    }
    if(kw){
      const Lv=(D.leads||[]).filter(l=>l&&l.temp!=='junk'&&!l.dropped); const cAt=l=>Number(l.closed_at)||Number(l.stage_at)||0; const t14=now-14*864e5, t28=now-28*864e5;
      const c14=Lv.filter(l=>l.stage==='closed'&&cAt(l)>=t14).length, cP=Lv.filter(l=>l.stage==='closed'&&cAt(l)>=t28&&cAt(l)<t14).length;
      return {src:'window', valid:kw.leads||0, hot:kw.hot||0, closed:c14, dValid:dl(kw.leads,kw.leadsPrev), dHot:dl(kw.hot,kw.hotPrev), dClosed:dl(c14,cP), closeRate:kw.leads?+(c14/kw.leads*100).toFixed(1):null};
    }
    return null;
  }
  /* v119-40 (P10): card "HÔM NAY" - việc cần làm ngay, bấm số là nhảy đúng bộ lọc */""", tag='feed.kpi14')
rep(F, "${new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit'})}",
       "${new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})}", tag='feed.todayDate')
rep(F, "    const dayStart=new Date(); dayStart.setHours(0,0,0,0);\n    const todayN=notedLeads.reduce((s,x)=>s+leadNotes(x.l.id).filter(n=>(n.at||0)>=dayStart.getTime()).length,0);",
       "    const dayStart0=vnDayStart(); // v119-80: ngày VN\n    const todayN=notedLeads.reduce((s,x)=>s+leadNotes(x.l.id).filter(n=>(n.at||0)>=dayStart0).length,0);", tag='feed.railToday')
rrep(F, r"    const d=new Date\(l\.fu_at\), today=new Date\(now\);[^\n]*\n    if\(d\.getDate\(\)===today\.getDate\(\) && d\.getMonth\(\)===today\.getMonth\(\) && d\.getFullYear\(\)===today\.getFullYear\(\)\)\{",
        "    const d=new Date(l.fu_at); // v119-80: \"hôm nay\" theo ngày VN (khớp card Hôm nay / bộ đếm)\n    if(vnDayStart(l.fu_at)===vnDayStart(now)){", tag='feed.fuChipToday')
rep(F, "      if(gc>=2) plus.push(`Xuất hiện ở ${gc} nơi – tài khoản hoạt động thật, khó là nick lập vội`);",
       "      if(gc>=2) plus.push(`Xuất hiện ở ${gc} nơi trong dữ liệu quét`); // v119-80: mô tả dữ kiện, không kết luận \"tài khoản thật\" từ 1 tín hiệu", tag='trust.gc')
rep(F, "      if(tlen>=120) plus.push('Nội dung chi tiết, hành văn tự nhiên');", "      if(tlen>=120) plus.push('Bài viết dài, có chi tiết (≥120 ký tự)');", tag='trust.len')
rep(F, "      if(zalo) plus.push('SĐT có liên kết Zalo – danh tính khả năng cao là thật');", "      if(zalo) plus.push('SĐT có liên kết Zalo');", tag='trust.zalo')
rep(F, "      if(l.kind==='comment') plus.push('Chủ động bình luận hỏi – hành vi quan tâm tự nhiên');", "      if(l.kind==='comment') plus.push('Chủ động bình luận hỏi dưới bài');", tag='trust.cmt')
rep(F, "      if(plus.length>=2){ st='Dấu hiệu hoạt động tự nhiên'; cls='chip-brand'; }\n      else if(!plus.length && warn.length>=2){",
       "      /* v119-80: cảnh báo tham gia quyết định chip (trước: ≥2 điểm cộng là \"tự nhiên\" dù có 2 điểm trừ) */\n      if(plus.length>=2&&!warn.length){ st='Nhiều dấu hiệu hoạt động tự nhiên'; cls='chip-brand'; }\n      else if(plus.length>=2){ st='Có dấu hiệu tốt · còn điểm cần xác minh'; cls='chip-warm'; }\n      else if(!plus.length && warn.length>=2){", tag='trust.chip')

# ---------- 30-pipeline: kẹt ở cột Mới · phễu toàn pipeline · hôm nay VN · stage_log ----------
rep(P, "  function pvOf(l){\n    const ms=pvAgeMs(l);",
       "  const PV_NEW_IDLE_DAYS=7; // v119-80: lead nằm ở cột Mới quá N ngày chưa ai chăm = kẹt (trước: cột Mới không bao giờ bị coi là kẹt, lead 90 ngày vẫn \"bình thường\")\n  function pvOf(l){\n    const ms=pvAgeMs(l);", tag='pv.idleConst')
rep(P, "    const stuck = (mid && days>=2) ? days : 0;",
       "    const idle = l.stage==='new' && days>=PV_NEW_IDLE_DAYS && l.temp!=='junk'; // v119-80\n    const stuck = ((mid && days>=2) || idle) ? days : 0;", tag='pv.idle')
rep(P, "    else if(stuck){ hint='Kẹt '+stuck+' ngày ở '+(stageLabel[l.stage]||l.stage)+' – inbox lại hôm nay'; htype='stuck'; }",
       "    else if(stuck){ hint=(l.stage==='new'?'Nằm ở Mới '+stuck+' ngày chưa ai chăm – kiểm tra rồi tiếp cận hoặc loại':'Kẹt '+stuck+' ngày ở '+(stageLabel[l.stage]||l.stage)+' – inbox lại hôm nay'); htype='stuck'; }", tag='pv.idleHint')
rep(P, " – nên inbox lại trong hôm nay.</span><button class=\"lnk\" id=\"pvStuck\">",
       " – xử lý trong hôm nay (lead ở Mới quá ${PV_NEW_IDLE_DAYS} ngày: kiểm tra rồi tiếp cận hoặc loại).</span><button class=\"lnk\" id=\"pvStuck\">", tag='pv.insight')
rep(P, "<span class=\"k\">Pipeline hiện tại</span><b>${PL.length} lead trong pipeline</b>",
       "<span class=\"k\">${pipeFilter==='all'?'Pipeline hiện tại':'Toàn pipeline (không theo bộ lọc)'}</span><b>${PL.length} lead trong pipeline</b>", tag='pv.funnelLbl')
rep(P, "    today: l => { if(!l.fu_at||l.stage==='closed') return false; const e=new Date(); e.setHours(23,59,59,999); return l.fu_at<=e.getTime(); },",
       "    today: l => { if(!l.fu_at||l.stage==='closed') return false; return l.fu_at<=vnDayStart()+864e5-1; }, // v119-80: hết ngày theo giờ VN", tag='pv.today')
rep(P, "    const d=new Date(l.fu_at), t=new Date();\n    return (d.getDate()===t.getDate()&&d.getMonth()===t.getMonth()&&d.getFullYear()===t.getFullYear()) ? d : null;",
       "    const d=new Date(l.fu_at);\n    return vnDayStart(l.fu_at)===vnDayStart() ? d : null; // v119-80: cùng ngày theo giờ VN", tag='pv.fuToday')
rep(P, "      const patch=Object.assign({stage, stage_at: lead.stage_at}, opts.extra||{}); // v167: stage_at = mốc tính \"tuổi giai đoạn\"/kẹt thật",
       "      const patch=Object.assign({stage, stage_at: lead.stage_at}, opts.extra||{}); // v167: stage_at = mốc tính \"tuổi giai đoạn\"/kẹt thật\n      lead.__stageLogPrev=lead.stage_log; lead.stage_log=(Array.isArray(lead.stage_log)?lead.stage_log:[]).concat([{from:from||'', to:stage, at:lead.stage_at, by:(window.CURRENT_USER||{}).email||'', undo:!!R}]).slice(-40); // v119-80: lịch sử giai đoạn (Dòng thời gian 360° hiện đủ hành trình) — ghi riêng best-effort, Rules cần whitelist stage_log (LỆNH #40)", tag='pv.stageLog')
rep(P, "      window.SL_FB.updateLead(id,patch).catch(err=>{\n        lead.stage=from; lead.stage_at=fromAt; lead.first_care_at=fromFC; pvJust.delete(id);",
       "      window.SL_FB.updateLead(id,patch).then(()=>{ window.SL_FB.updateLead(id,{stage_log: lead.stage_log}).catch(e=>{ console.warn('[SmartLead] stage_log chưa ghi được:', e&&e.code); }); }).catch(err=>{ // v119-80: stage_log ghi riêng — lỗi (Rules chưa mở) không chặn đổi giai đoạn\n        lead.stage=from; lead.stage_at=fromAt; lead.first_care_at=fromFC; lead.stage_log=lead.__stageLogPrev; pvJust.delete(id);", tag='pv.stageLogWrite')

# ---------- 65-modal: Dòng thời gian đọc stage_log · Hôm nay/Hôm qua theo VN ----------
rep(M, "    if(l.stage_at&&l.stage!=='new') push(l.stage_at,'Chuyển sang '+(stageLabel[l.stage]||l.stage),'',SLI.bookmark);",
"""    const slg=Array.isArray(l.stage_log)?l.stage_log.filter(e=>e&&e.at&&e.to):[]; // v119-80: lịch sử giai đoạn (mọi lần chuyển) — trước chỉ có mốc giai đoạn hiện tại nên hành trình mới → inbox → phản hồi → hẹn chỉ hiện 1 dòng
    slg.forEach(e=>push(e.at,(e.undo?'Hoàn tác về ':'Chuyển sang ')+(stageLabel[e.to]||e.to)+(e.from&&!e.undo?' (từ '+(stageLabel[e.from]||e.from)+')':'')+(e.by?' · '+e.by:''),'',SLI.bookmark));
    if(l.stage_at&&l.stage!=='new'&&!slg.some(e=>e.to===l.stage&&Math.abs(Number(e.at)-Number(l.stage_at))<5000)) push(l.stage_at,'Chuyển sang '+(stageLabel[l.stage]||l.stage),'',SLI.bookmark);""", tag='modal.stageLog')
rep(M, "    const now=new Date(); const day0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();\n    const dd=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()-day0)/86400e3);",
       "    const now=new Date(); const dd=Math.round((vnDayStart(ms)-vnDayStart())/86400e3); // v119-80: \"Hôm nay/Hôm qua\" theo ngày VN", tag='modal.tlWhen')

# ---------- 70-shell: Cmd+K tìm SĐT trên máy chủ ----------
rep(T, "    if(roleCanScan()&&fold('quét ngay scan').includes(nq)) out.push(",
       "    if(!out.some(x=>x.t==='lead')&&window.SL_FB&&window.SL_FB.findByPhone){ const ph=normPhoneVN(q); if(ph) out.push({t:'srv',k:ph,lbl:'Tìm SĐT '+fmtPhoneVN(ph)+' trên máy chủ',sub:'toàn bộ kho lead, cả lead cũ chưa tải',ic:CK_IC.cmd}); } // v119-80: trước chỉ tìm trong lead đã tải, không có đường ra kho như feed/modal\n    if(roleCanScan()&&fold('quét ngay scan').includes(nq)) out.push(", tag='ck.srvItem')
rep(T, "    else if(it.k==='newbrand'){ openBrandWizard(); } // v119-49",
       "    else if(it.t==='srv'){ ckFindSrv(it.k); } // v119-80\n    else if(it.k==='newbrand'){ openBrandWizard(); } // v119-49", tag='ck.srvRun')
rep(T, "  function ckRun(it){\n",
       "  /* v119-80: Cmd+K → tìm SĐT trên máy chủ (findByPhone nạp lead vào kho) rồi mở Lead mới với ô tìm = SĐT đó */\n  function ckFindSrv(ph){ toast('Đang tìm trên máy chủ…'); Promise.resolve(window.SL_FB.findByPhone(ph)).then(n=>{ if(n){ toast('Tìm thấy '+n+' lead mang SĐT này – đã nạp vào Lead mới.'); const si=document.getElementById('searchInput'); if(si) si.value=ph; " + ("setFeedQuery(ph);" if ESM else "feedQuery=ph;") + " go('feed'); } else toast('Không có lead nào mang SĐT này trên máy chủ.'); }).catch(e=>toast(errMsg(e))); }\n  function ckRun(it){\n", tag='ck.srvFn')

# ---------- 25-agency: SLA đạt — counter đúng ngưỡng brand (LỆNH #40) · ước tính theo cohort ngày phát hiện ----------
rep(A, "  function agyEmpty(){ return {new:0,", "  function agyEmpty(){ return {slaOk:0,slaN:0,new:0,", tag='agy.empty')
rep(A, "    const slaOk=has?(Number(w30[bucket])||0):(Number(w30.careLeBad)||0);",
       "    const slaExact=has&&(Number(w30.slaN)||0)>0; // v119-80: LỆNH #40 — counter slaOk đúng ngưỡng riêng brand, cohort ngày phát hiện; chưa có → bucket 15/30/60/120 như cũ\n    const slaOk=has?(slaExact?(Number(w30.slaOk)||0):(Number(w30[bucket])||0)):(Number(w30.careLeBad)||0);", tag='agy.slaOk')
rrep(A, r"slaLim:has\?slaLim:bad,", "slaLim:(has&&!slaExact)?slaLim:bad,", tag='agy.slaLim')
rep(A, "      if(inW(det)){ const tp=agyTempOf(l); if(tp==='junk') acc.junk++; else { acc.new++; acc[tp]++; } if(l.dropped) acc.dropped++; }",
       "      if(inW(det)){ const tp=agyTempOf(l); if(tp==='junk') acc.junk++; else { acc.new++; acc[tp]++; const fc0=Number(l.first_care_at)||0; if(fc0&&dm&&fc0>=dm&&(fc0-dm)/60000<=(bad||60)) acc.careLeBad++; } if(l.dropped) acc.dropped++; } // v119-80: SLA đạt theo COHORT ngày phát hiện (tử số cùng tập với mẫu số)", tag='agy.cohort')
rep(A, " if(min<=120)acc.careLe120++; if(min<=(bad||60))acc.careLeBad++; } } }", " if(min<=120)acc.careLe120++; } } }", tag='agy.oldBad')
rep(A, "sla:'% lead hợp lệ 30 ngày được chăm lần đầu trong ngưỡng (counter làm tròn LÊN mốc 15/30/60/120′ gần nhất so với ngưỡng quá hạn của brand — xấp xỉ; lead chưa chăm = KHÔNG đạt)'",
       "sla:'% lead hợp lệ 30 ngày (theo ngày phát hiện) được chăm lần đầu trong ngưỡng quá hạn của brand · lead chưa chăm = KHÔNG đạt · bộ đếm máy chủ đúng ngưỡng riêng brand sau LỆNH #40 (trước đó làm tròn LÊN mốc 15/30/60/120′)'", tag='agy.tip')

# ---------- 40-roi: Super Admin cộng dự báo từng brand · tổng tiết kiệm có âm · brand hoạt động · benchmark cấu hình ----------
rep(R, "saving, cheaper, evAvg, byTemp, stageRows, fc };", "saving, savingRaw:adsCost-R.fee, cheaper, evAvg, byTemp, stageRows, fc }; // v119-80: savingRaw có thể âm (tổng hệ thống cộng cả brand âm)", tag='roi.savingRaw')
rep(R, "    const active = rows.filter(r=>r.arr.length || (r.b&&r.b.roi));",
       "    const srcOn=new Set((D.sources||[]).filter(s=>s&&s.status==='active').map(s=>String(s.brand||''))); // v119-80: brand đang hoạt động = không bị tắt + (có lead đã tải HOẶC tham số riêng HOẶC nguồn quét đang bật) — trước chỉ suy từ lead đã tải\n    const active = rows.filter(r=>r.b.active!==false && (r.arr.length || (r.b&&r.b.roi) || srcOn.has(String(r.b.code||''))));\n    const negN = active.filter(r=>r.C.savingRaw<0).length;", tag='roi.active')
rep(R, "      save: active.reduce((a,r)=>a+r.C.saving,0),", "      save: active.reduce((a,r)=>a+r.C.savingRaw,0), // v119-80: cộng cả brand âm → khớp phương trình Σ(lead × CPL) − Σ phí gói", tag='roi.save')
rep(R, "          <div class=\"rh-num\"><b>${fmtVnd(tot.save)}</b></div>\n          <div class=\"rl-hero-sub\">tổng tiết kiệm mỗi tháng so với chạy quảng cáo</div>",
       "          <div class=\"rh-num\"><b>${tot.save<0?'−':''}${fmtVnd(Math.abs(tot.save))}</b></div>\n          <div class=\"rl-hero-sub\">${tot.save<0?'đang tốn hơn chạy quảng cáo – phí gói cao hơn CPL ads ở '+fmt(negN)+' brand':'tổng tiết kiệm mỗi tháng so với chạy quảng cáo'}</div>", tag='roi.hero')
rep(R, "        ${roiStat('Tổng tiết kiệm / tháng', fmtVnd(tot.save), 'cộng các brand đang hoạt động', 'good')}",
       "        ${roiStat('Tổng tiết kiệm / tháng', (tot.save<0?'−':'')+fmtVnd(Math.abs(tot.save)), negN?('kể cả '+fmt(negN)+' brand âm (phí gói > CPL ads)'):'cộng các brand đang hoạt động', tot.save<0?'':'good')}", tag='roi.stat')
rep(R, "      ${roiForecastHtml(roiCompute(D.leads||[], roiParamsFor(null), 0, 0))}", "      ${roiForecastHtml(roiSumForecast(all))}", tag='roi.fcSum')
rep(R, "            <td class=\"n\" style=\"color:${r.C.saving>0?'var(--success)':'var(--ink-300)'}\">${r.C.saving>0?fmtVnd(r.C.saving):'-'}</td>",
       "            <td class=\"n\" style=\"color:${r.C.saving>0?'var(--success)':(r.C.savingRaw<0?'var(--danger)':'var(--ink-300)')}\">${r.C.saving>0?fmtVnd(r.C.saving):(r.C.savingRaw<0?'−'+fmtVnd(-r.C.savingRaw):'-')}</td>", tag='roi.rowSave')
rep(R, "  function roiSuperView(){\n",
"""  /* v119-80: dự báo toàn hệ thống = CỘNG dự báo từng brand (mỗi brand tham số riêng) — trước chạy lại roiCompute trên mọi lead với tham số MẶC ĐỊNH */
  function roiSumForecast(rows){
    const f={expDeals:0,expVal:0,c30:0,c60:0,val30:0,f30Deals:0,f30Val:0,nDays:0,daySum:0}; let open=[], closedN=0;
    (rows||[]).forEach(r=>{ const c=r.C||{}, x=c.fc||{}; open=open.concat(c.open||[]); closedN+=c.closedN||0; ['expDeals','expVal','c30','c60','val30','f30Deals','f30Val','nDays'].forEach(k=>{ f[k]+=Number(x[k])||0; }); if(x.avgDays&&x.nDays) f.daySum+=x.avgDays*x.nDays; });
    f.avgDays=f.nDays?f.daySum/f.nDays:null;
    return {open, closedN, fc:f};
  }
  /* v119-80: benchmark CPL ngành lấy từ cấu hình (config/app.roiBench — Super Admin sửa ngay trên web) kèm năm + nguồn; chưa cấu hình → bộ mặc định 2025 (LocaliQ) ghi rõ "tham khảo" (trước: ghi cứng trong code, không nguồn) */
  const ROI_BENCH_DEF={year:2025,src:'LocaliQ',avg:700000,rows:[['Làm đẹp / Spa',1300000],['Giáo dục',715000],['F&B',80000]]};
  function roiBench(){ const b=(D&&D.cfg&&D.cfg.roiBench&&typeof D.cfg.roiBench==='object')?D.cfg.roiBench:null; if(!b) return ROI_BENCH_DEF;
    return {year:Number(b.year)||ROI_BENCH_DEF.year, src:String(b.src||''), avg:Number(b.avg)||0, rows:(Array.isArray(b.rows)?b.rows:[]).filter(r=>Array.isArray(r)&&r[0]).map(r=>[String(r[0]),Number(r[1])||0])}; }
  function roiBenchHtml(){ const b=roiBench(); const custom=!!(D&&D.cfg&&D.cfg.roiBench);
    return `<div style="font-size:12px;color:var(--ink-500);margin-top:12px" id="roiBench">Benchmark CPL Facebook Ads ${esc(String(b.year))}${b.src?' ('+esc(b.src)+')':''}${custom?'':' – số tham khảo'}: ${b.avg?'trung bình ~'+fmtVnd(b.avg):''}${b.rows.map(r=>' · '+esc(r[0])+' ~'+fmtVnd(r[1])).join('')}. Bán lẻ nên nhập giá trị đơn + CPL thật của brand.${roleIsSuper()?' <button class="lnk" id="roiBenchEdit" type="button">Cập nhật chuẩn ngành</button>':''}</div>`; }
  async function roiBenchEdit(){ const b=roiBench();
    const cur=b.year+' | '+(b.src||'')+' | '+(b.avg||0)+' | '+b.rows.map(r=>r[0]+'='+r[1]).join('; ');
    const s=await slPrompt('Định dạng: năm | nguồn | CPL trung bình (₫) | Ngành=CPL; Ngành=CPL…', cur, {title:'Chuẩn CPL ngành (benchmark)', ok:'Lưu'}); if(s==null) return;
    const p=String(s).split('|').map(x=>x.trim()); const year=Number(p[0])||b.year, src=p[1]||'', avg=Number(String(p[2]||'').replace(/\\D/g,''))||0;
    const rows=String(p[3]||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{ const i=x.indexOf('='); return i>0?[x.slice(0,i).trim(), Number(String(x.slice(i+1)).replace(/\\D/g,''))||0]:null; }).filter(r=>r&&r[0]&&r[1]>0);
    const patch={roiBench:{year,src,avg,rows,at:slNow()}};
    const apply=()=>{ if(D){ D.cfg=Object.assign({},D.cfg||{},patch); } toast('Đã cập nhật chuẩn CPL ngành.'); views.roi(); };
    if(window.SL_FB&&window.SL_FB.setConfig) window.SL_FB.setConfig(patch).then(apply).catch(e=>toast(errMsg(e))); else apply();
  }
  function roiSuperView(){
""", tag='roi.helpers')
rep(R, "        <div style=\"font-size:12px;color:var(--ink-500);margin-top:12px\">Benchmark CPL Facebook Ads 2025 (LocaliQ): trung bình ~700k₫ · Làm đẹp/Spa ~1,3tr₫ · Giáo dục ~715k₫ · F&amp;B ~80k₫ · Bán lẻ nên nhập giá trị đơn + CPL thật của brand.</div>",
       "        ${roiBenchHtml()}", tag='roi.benchHtml')
rep(R, "  views.roi = function(){\n    if(roleIsSuper()) roiSuperView(); else roiBrandView();\n  };",
       "  views.roi = function(){\n    if(roleIsSuper()) roiSuperView(); else roiBrandView();\n    const be=view.querySelector('#roiBenchEdit'); if(be) be.addEventListener('click',roiBenchEdit); // v119-80\n  };", tag='roi.bind')

# ---------- 45-outreach: brand 0 nick · VPS online ----------
rep(O, "      <div class=\"oa-valves${c.on ? '' : ' dim'}\">\n        ${oaValve('react', c.usage.react, oaCap('react', nicks, caps.react))}${oaValve('comment', c.usage.comment, oaCap('comment', nicks, caps.comment))}${oaValve('friend', c.usage.friend, oaCap('friend', nicks, caps.friend))}${oaValve('inbox', c.usage.inbox, oaCap('inbox', nicks, caps.inbox))}\n      </div>",
       "      ${nicks ? `<div class=\"oa-valves${c.on ? '' : ' dim'}\">\n        ${oaValve('react', c.usage.react, oaCap('react', nicks, caps.react))}${oaValve('comment', c.usage.comment, oaCap('comment', nicks, caps.comment))}${oaValve('friend', c.usage.friend, oaCap('friend', nicks, caps.friend))}${oaValve('inbox', c.usage.inbox, oaCap('inbox', nicks, caps.inbox))}\n      </div>` : `<div class=\"oa-valves dim oa-novalve\" style=\"font-size:12px;color:var(--ink-400);padding:6px 0\">${SLI.info} Chưa gán nick cho brand – thêm ở bảng Tài khoản Facebook bên dưới; van an toàn sẽ hiện theo số nick.</div>`}", tag='oa.novalve')
rep(O, "    const runCnt = ws.reduce((s, w) => s + (Number(w.running) || 0), 0);",
       "    const runCnt = ws.filter(w => w.isOnline).reduce((s, w) => s + (Number(w.running) || 0), 0); // v119-80: chỉ cộng VPS online (VPS rớt mạng giữ nguyên số running cũ)", tag='oa.runCnt')
rep(O, "${runCnt} nick đang chạy — cập nhật realtime mỗi 30 giây", "${runCnt} nick đang chạy trên VPS online — cập nhật realtime mỗi 30 giây", tag='oa.runTxt')

# ---------- 50-config-views: keyword/hiệu chỉnh ≥10 lead · báo cáo dòng phạm vi ----------
rep(K, "      return {kw,leads:ls.length,rate:ls.length?Math.round(rp/ls.length*100):0}; })",
       "      return {kw,leads:ls.length,rate:ls.length>=10?Math.round(rp/ls.length*100):null}; }) // v119-80: tỷ lệ chỉ khi ≥10 lead (1 lead khớp → \"100%\" vô nghĩa)", tag='kw.rate')
rep(K, "<tr><td class=\"nm\">${esc(t.kw)}</td><td>${t.leads}</td><td>${t.rate}%</td></tr>",
       "<tr><td class=\"nm\">${esc(t.kw)}</td><td>${t.leads}</td><td>${t.rate==null?'<span class=\"muted\" title=\"dưới 10 lead – chưa đủ mẫu\">ít mẫu</span>':t.rate+'%'}</td></tr>", tag='kw.cell')
rep(K, "        <div class=\"card\"><div class=\"card-head\"><h3>Keyword hiệu quả nhất</h3></div>",
       "        <div class=\"card\"><div class=\"card-head\"><div><h3>Keyword hiệu quả nhất</h3><div class=\"sub\">Trên ${fmt((D.leads||[]).length)} lead đã nạp · tỷ lệ phản hồi chỉ tính khi ≥10 lead</div></div></div>", tag='kw.head')
rep(K, "    return `<div class=\"card mt-18\" id=\"calCard\">",
       "    const cc=(x,v)=>x.n>=10?(v+'%'+(x.n<30?' <span class=\"muted\" style=\"font-size:10px\">ít mẫu</span>':'')):(x.n?'<span class=\"muted\" style=\"font-size:10px\" title=\"dưới 10 lead\">ít mẫu ('+x.n+')</span>':'—'); // v119-80: dưới 10 lead không hiện %\n    return `<div class=\"card mt-18\" id=\"calCard\">", tag='cal.cc')
rep(K, "<td>${x.n?x.resp+'%'+(x.n<30?' <span class=\"muted\" style=\"font-size:10px\">ít mẫu</span>':''):'—'}</td><td style=\"font-weight:700;color:${x.n&&x.closed?'var(--success)':'inherit'}\">${x.n?x.closed+'%':'—'}</td><td>${x.n?x.lost+'%':'—'}</td>",
       "<td>${cc(x,x.resp)}</td><td style=\"font-weight:700;color:${x.n>=10&&x.closed?'var(--success)':'inherit'}\">${cc(x,x.closed)}</td><td>${cc(x,x.lost)}</td>", tag='cal.cells')
rep(K, "      <div class=\"print-only print-head\"><b>SmartLead · Báo cáo</b> · ${esc(brandName)} · ${new Date().toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'})}</div>",
       "      <div class=\"print-only print-head\"><b>SmartLead · Báo cáo</b> · ${esc(brandName)} · ${new Date().toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'})}</div>\n      <div class=\"print-only print-head\" style=\"font-weight:400\">${esc(repScope)}</div>\n      <div class=\"sub no-print\" style=\"margin-bottom:8px\">${SLI.info} ${esc(repScope)}</div>", tag='rep.head')
rep(K, "    const brandName=(D.myBrand&&D.myBrand.name)||CURRENT_BRAND_NAME||(roleIsSuper()?'Toàn hệ thống':'');\n    view.innerHTML = `",
       "    const brandName=(D.myBrand&&D.myBrand.name)||CURRENT_BRAND_NAME||(roleIsSuper()?'Toàn hệ thống':'');\n    /* v119-80: dòng phạm vi bắt buộc — số trang này tính trên lead ĐÃ NẠP (cửa sổ realtime), không phải toàn kho; in ra giấy cũng có */\n    const repL=(D.leads||[]); const repMin=repL.reduce((m,l)=>{ const d=parseTS(l.detected_at)||parseTS(l.time); return (d&&(!m||d<m))?d:m; },null);\n    const repScope='Phạm vi số liệu: '+fmt(repL.length)+' lead đã nạp'+(repMin?' (phát hiện từ '+repMin.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'})+')':'')+(D.leadsCapped?' · kho còn lead cũ hơn chưa tải':'')+' · Bảng điều khiển và Bảng brand dùng bộ đếm máy chủ.';\n    view.innerHTML = `", tag='rep.scope')

# ---------- live.js: nguồn ↔ lead theo mã group ----------
rep(L, "  const bySrc=new Map(); act.forEach(l=>{const k=l.source||''; let a=bySrc.get(k); if(!a){a={n:0,hot:0}; bySrc.set(k,a);} a.n++; if(l.temp==='hot')a.hot++;}); // v119-79: theo lead hợp lệ (trước gồm rác → \"tỷ lệ nóng\" theo nguồn bị pha loãng)\n  const srcOut=sources.map(s=>{const ls=bySrc.get(s.name)||{n:0,hot:0};return{",
"""  /* v119-80: nối lead ↔ nguồn theo MÃ GROUP trong URL (post_url/parent_url/comment_url ↔ sources.url hoặc id) TRƯỚC, tên nguồn SAU — đổi tên nguồn không còn làm số lead của nguồn về 0
     (lead chỉ lưu tên nguồn lúc quét). Lead hợp lệ (v119-79). */
  const gidOf=u=>{ const m=/facebook\\.com\\/groups\\/([^/?#]+)/i.exec(String(u||'')); return m?m[1].toLowerCase():''; };
  const bySrc=new Map(), bySrcG=new Map(); act.forEach(l=>{ const add=(m,k)=>{ if(!k) return; let a=m.get(k); if(!a){a={n:0,hot:0}; m.set(k,a);} a.n++; if(l.temp==='hot')a.hot++; }; add(bySrc,l.source||''); add(bySrcG,gidOf(l.post_url||l.parent_url||l.comment_url)); });
  const srcOut=sources.map(s=>{const g=gidOf(s.url)||String(s._id||'').toLowerCase(); const ls=(g&&bySrcG.get(g))||bySrc.get(s.name)||{n:0,hot:0};return{""", tag='live.srcGid')

# ---------- ESM: tên dùng chéo part ----------
if ESM:
    rep(C10, "todayBoard, view, views };", "todayBoard, view, views, vnDayKey, vnDayStart };", tag='esm.export10')
    rep(F, "import { D, SCAN_METHODS, SLI, chip, errMsg, fmt, getScanMethod, go, nextBestLeads, parseTS, scoreBg, scoreColor, slNow, softRender, stageLabel, tempLabel, todayBoard, view, views } from './10-core-overview.js';",
           "import { D, SCAN_METHODS, SLI, chip, errMsg, fmt, getScanMethod, go, nextBestLeads, parseTS, scoreBg, scoreColor, slNow, softRender, stageLabel, tempLabel, todayBoard, view, views, vnDayKey, vnDayStart } from './10-core-overview.js';", tag='esm.import20')
    rep(F, "export { NOTE_IC, feedHidden,", "export { NOTE_IC, feedHidden, normPhoneVN,", tag='esm.export20')
    rep(P, "import { D, SLI, SOFT_RELOAD, el, errMsg, kStageColor, parseTS, scoreColor, slConfirm, slNow, stageLabel, view, views } from './10-core-overview.js';",
           "import { D, SLI, SOFT_RELOAD, el, errMsg, kStageColor, parseTS, scoreColor, slConfirm, slNow, stageLabel, view, views, vnDayStart } from './10-core-overview.js';", tag='esm.import30')
    rep(M, "import { D, SLI, chartAnim, charts, chip, el, errMsg, fmt, getScanMethod, go, parseTS, scoreColor, slChart, slConfirm, slNow, stageLabel, view } from './10-core-overview.js';",
           "import { D, SLI, chartAnim, charts, chip, el, errMsg, fmt, getScanMethod, go, parseTS, scoreColor, slChart, slConfirm, slNow, stageLabel, view, vnDayStart } from './10-core-overview.js';", tag='esm.import65')
    rep(T, "import { crmCfg, feedHidden, fmtPhoneVN, fmtWhen, isMine, leadNo, leadNotes, nextBestCard, noteAgo, renderFeed, setFeedQuery, stripMd } from './20-feed.js';",
           "import { crmCfg, feedHidden, fmtPhoneVN, fmtWhen, isMine, leadNo, leadNotes, nextBestCard, normPhoneVN, noteAgo, renderFeed, setFeedQuery, stripMd } from './20-feed.js';", tag='esm.import70')
    rep(R, "import { D, SLI, errMsg, fmt, parseTS, tempLabel, view, views } from './10-core-overview.js';",
           "import { D, SLI, errMsg, fmt, parseTS, slNow, slPrompt, tempLabel, view, views } from './10-core-overview.js';", tag='esm.import40')

# ---------- smoke ----------
rep(S, '''  /* v119-79: số liệu khớp nhau: rail feed''',
'''  /* v119-80: KPI 14 ngày từ bộ đếm máy chủ (super gộp brand) + ô "Đã chốt" theo ngày chốt · pipeline coi lead ở Mới ≥7 ngày là kẹt · Dòng thời gian đọc stage_log · phễu "toàn pipeline" khi lọc */
  const k80 = await page.evaluate(() => { const vn = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10); const now = Date.now(); const D = window.SL_DATA;
    D.dailyStats = [{ brandCode: 'a', day: vn(now), new: 10, hot: 3, closed: 2 }, { brandCode: 'b', day: vn(now - 5 * 864e5), new: 20, hot: 4, closed: 1 }, { brandCode: 'a', day: vn(now - 20 * 864e5), new: 15, hot: 5, closed: 1 }];
    location.hash = 'overview'; window.SLApp.reload(D); const cs = [...document.querySelectorAll('#view .grid.g-4 .kpi')].map(c => ({ lbl: ((c.querySelector('.lbl') || {}).textContent || '').trim(), val: ((c.querySelector('.val') || {}).textContent || '').trim(), delta: ((c.querySelector('.delta') || {}).textContent || '').trim(), cap: ((c.querySelector('.vs') || {}).textContent || '').trim() }));
    delete D.dailyStats;
    location.hash = 'pipeline'; window.SLApp.reload(D); const stuck0 = +((document.querySelector('#view [data-pf="stuck"] i') || {}).textContent || 0);
    const l = D.leads.find(x => x.stage === 'new' && x.temp !== 'junk' && !x.dropped && !x.lost); const bak = { d: l.detected_at, t: l.time, s: l.stage_at, f: l.first_care_at };
    l.detected_at = new Date(now - 9 * 864e5).toISOString(); l.time = l.detected_at; delete l.stage_at; delete l.first_care_at;
    window.SLApp.reload(D); const stuck1 = +((document.querySelector('#view [data-pf="stuck"] i') || {}).textContent || 0); const ins = (document.querySelector('#view .pv2-insight') || {}).textContent || '';
    document.querySelector('#view [data-pf="stuck"]').click(); const flbl = (document.querySelector('#view .pv2-fsum .k') || {}).textContent || ''; document.querySelector('#view [data-pf="all"]').click();
    l.detected_at = bak.d; l.time = bak.t; if (bak.s) l.stage_at = bak.s; if (bak.f) l.first_care_at = bak.f;
    location.hash = 'overview'; window.SLApp.reload(D); return { cs, stuck0, stuck1, insName: ins.includes(l.name), flbl }; });
  await page.waitForTimeout(200);
  const c80 = k80.cs;
  (c80.length === 4 && c80[1].lbl === 'Lead hợp lệ' && c80[1].val === '30' && /\\+100/.test(c80[1].delta) && c80[2].val === '7' && c80[3].lbl === 'Đã chốt' && c80[3].val === '3' && /\\+200/.test(c80[3].delta) && /bộ đếm máy chủ/.test(c80[3].cap) && /tỷ lệ chốt 10%/.test(c80[3].cap)
    && k80.stuck1 === k80.stuck0 + 1 && k80.insName && /Toàn pipeline/.test(k80.flbl)) ? ok('v119-80: KPI 14 ngày từ bộ đếm (hợp lệ 30 ' + c80[1].delta + ' · nóng 7 · Đã chốt 3 ' + c80[3].delta + ', tỷ lệ chốt ở caption) · lead ở Mới 9 ngày thành kẹt (' + k80.stuck0 + '→' + k80.stuck1 + ') · phễu "Toàn pipeline" khi lọc') : fail('v119-80 KPI/pipeline: ' + JSON.stringify(k80));
  const t80 = await page.evaluate(() => { location.hash = 'feed'; window.SLApp.reload(window.SL_DATA); const id = document.querySelector('#feedList .lead-card').dataset.lead; const l = window.SL_DATA.leads.find(x => String(x.id) === id); const now = Date.now();
    l.__slBak = l.stage_log; l.stage_log = [{ from: 'new', to: 'inbox', at: now - 2 * 864e5, by: 'sales@z15.vn' }, { from: 'inbox', to: 'responded', at: now - 864e5, by: 'sales@z15.vn' }]; return id; });
  await page.click('#feedList .lead-card [data-chatbox]'); await page.waitForTimeout(400);
  const tl80 = await page.evaluate(() => { const t = (document.querySelector('#modal .ld-tl') || {}).textContent || ''; const D = window.SL_DATA; const l = D.leads.find(x => x.stage_log && x.stage_log[0] && x.stage_log[0].by === 'sales@z15.vn'); if (l) { if (l.__slBak) l.stage_log = l.__slBak; else delete l.stage_log; delete l.__slBak; } document.getElementById('modalBg').classList.remove('show'); return t.replace(/\\s+/g, ' '); });
  (/Chuyển sang Đã inbox \\(từ Lead mới\\) · sales@z15.vn/.test(tl80) && /Chuyển sang Đã phản hồi \\(từ Đã inbox\\)/.test(tl80)) ? ok('v119-80: Dòng thời gian 360° đọc stage_log → đủ hành trình Mới → Đã inbox → Đã phản hồi') : fail('v119-80 stage_log timeline: ' + tl80.slice(0, 300));
  /* v119-79: số liệu khớp nhau: rail feed''', tag='smoke.v119-80')
done()
