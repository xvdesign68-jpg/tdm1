# m29.py <cây> — v119-87 / v120-esm-ak (10/09/2026): TOÀN CẢNH BRAND cho Super Admin trên trang Giá trị & ROI (anh chốt 09–10/09 sau câu hỏi CPL 21.717 ↔ 15.009):
#   (1) CPL 1 công thức mặc định = cách A (phí gói ÷ MỌI lead hợp lệ 30 ngày); super LUÔN thấy cả A và B (nóng+ấm); `roi.cplBasis` ('valid' | 'hotwarm' | 'both')
#       quyết định khách (admin/sales brand) thấy cách nào — chỉnh trong tham số riêng từng brand (mặc định hệ thống ở config/app.roi);
#   (2) Phí gói đồng bộ "Gói giải pháp" (Người dùng → brands.plan {tier,price,cycle,from,to}) quy về tháng (tháng/quý÷3/năm÷12/trọn ÷ số tháng from→to);
#       `roi.feeSrc` 'plan' (mặc định) | 'custom' (nhập riêng ở ROI); brand chưa cấp gói → tham số như cũ + cờ "chưa cấp gói"; cờ gói hết hạn / còn ≤30 ngày;
#   (3) giữ 2 trang: bảng ROI dùng CHUNG số khối lượng/kết quả/SLA/vận hành với Bảng brand (agyRowsRaw/agyWinFor: bộ đếm máy chủ daily_stats, không phụ thuộc
#       cửa sổ lead đã tải) + nút qua lại "Xem vận hành" (ROI → Bảng brand) và "Tài chính" (Bảng brand → ROI);
#   thêm: bảng 17 cột nhóm Khối lượng · Kết quả · Tài chính · Giá trị · Vận hành, sắp xếp theo cột, ▲▼ so 30 ngày trước, dòng tổng, xuất CSV,
#   "Xem như khách" (super xem đúng những gì admin brand thấy theo cplBasis), pipeline hiện cho mọi brand (kể cả chế độ Đơn giản), 4 ô tổng theo bộ đếm.
# Áp lên cây v119-86 / v120-esm-aj. ESM: 40-roi import {go} 10-core + {AGY, agyIndex, agyRowsRaw, agyWinFor} 25-agency; 25 import {roiFeeInfo, roiParamsFor, roiSelect} 40; export tương ứng.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
R40='src/app/40-roi.js'; A25='src/app/25-agency.js'; C10='src/app/10-core-overview.js'; CSS='assets/css/app.css'; S='tools/smoke.js'
ESM = "import './" in rd(R40)

# ---------- 40-roi: ROI_DEF + helper phí gói / đếm / chọn brand ----------
rep(R40, "const ROI_DEF = { fee: 15000000, aov: 25000000, closeHot: 30, closeWarm: 15, closeCold: 5, cplAds: 250000, autoRate: true, useBudget: true, leadsMonth: 0, mode: 'advanced', industries: {} };",
"const ROI_DEF = { fee: 15000000, aov: 25000000, closeHot: 30, closeWarm: 15, closeCold: 5, cplAds: 250000, autoRate: true, useBudget: true, leadsMonth: 0, mode: 'advanced', industries: {}, cplBasis: 'valid', feeSrc: 'plan' }; // v119-87: cplBasis = cách khách thấy CPL ('valid' mọi lead hợp lệ · 'hotwarm' nóng+ấm · 'both') · feeSrc 'plan' = phí gói theo Gói giải pháp", tag='def')

rep(R40, """  function roiParamsFor(brandDoc){ return roiMerge((D && D.roi) || null, (brandDoc && brandDoc.roi) || null); }
  function roiParamSrc(brandDoc){ return (brandDoc && brandDoc.roi) ? 'brand' : ((D && D.roi) ? 'global' : 'default'); }""",
"""  function roiParamsFor(brandDoc){ const out=roiMerge((D && D.roi) || null, (brandDoc && brandDoc.roi) || null); out.feeRaw=out.fee; const fi=roiFeeInfo(brandDoc,out); out.fee=fi.fee; out.feeInfo=fi; return out; } // v119-87: phí gói đồng bộ Gói giải pháp
  function roiParamSrc(brandDoc){ return (brandDoc && brandDoc.roi) ? 'brand' : ((D && D.roi) ? 'global' : 'default'); }
  /* v119-87: PHÍ GÓI đồng bộ với "Gói giải pháp" (Người dùng → brands.plan {tier, price, cycle thang|quy|nam|tron, from, to}) — quy về THÁNG.
     Ưu tiên: feeSrc 'custom' → ô nhập riêng ở ROI · mặc định 'plan' → giá gói (không có gói → tham số riêng/mặc định như cũ + cờ "chưa cấp gói"). */
  const ROI_CYCLE_VI={thang:'tháng',quy:'quý',nam:'năm',tron:'trọn gói'};
  function roiPlanMonthly(pl){ if(!pl||!(Number(pl.price)>0)) return null; const p=Number(pl.price), c=pl.cycle||'thang';
    if(c==='quy') return {fee:p/3, months:3}; if(c==='nam') return {fee:p/12, months:12};
    if(c==='tron'){ const f=Date.parse(pl.from||''), t=Date.parse(pl.to||''); if(!(f>0&&t>f)) return {fee:0, months:0, incomplete:true}; const m=Math.max(1,Math.round((t-f)/(30.44*864e5))); return {fee:p/m, months:m}; }
    return {fee:p, months:1}; }
  function roiFeeInfo(brandDoc, R){
    const pl=(brandDoc&&brandDoc.plan&&typeof brandDoc.plan==='object')?brandDoc.plan:null; const pm=roiPlanMonthly(pl);
    const today=new Date(Date.now()+7*3600e3).toISOString().slice(0,10); // ngày VN
    const daysLeft=(pl&&pl.to)?Math.round((Date.parse(pl.to)-Date.parse(today))/864e5):null;
    const expired=daysLeft!=null&&daysLeft<0, soon=daysLeft!=null&&daysLeft>=0&&daysLeft<=30;
    const raw=Number(R.feeRaw!=null?R.feeRaw:R.fee)||0;
    const rawSrc=(brandDoc&&brandDoc.roi&&Number(brandDoc.roi.fee)>0)?'brand':((D&&D.roi&&Number(D.roi.fee)>0)?'global':'default');
    const base={plan:pl, pm, daysLeft, expired, soon, raw, rawSrc, noPlan:!pm, incomplete:!!(pm&&pm.incomplete)};
    if(R.feeSrc!=='custom' && pm && pm.fee>0) return Object.assign(base,{fee:pm.fee, src:'plan'});
    return Object.assign(base,{fee:raw, src:(R.feeSrc==='custom')?'custom':rawSrc});
  }
  function roiFeeTag(fi){ return fi.src==='plan'?'Gói':(fi.src==='custom'||fi.src==='brand')?'Riêng':'Mặc định'; }
  function roiFeeNote(fi){ const pl=fi.plan||{}; if(fi.src==='plan') return esc(pl.tier||'Gói')+' · '+fmtVnd(pl.price)+'/'+(ROI_CYCLE_VI[pl.cycle]||'tháng')+(fi.pm&&fi.pm.months>1?' → '+fmtVnd(fi.fee)+'/tháng':'')+(fi.expired?' · hết hạn '+esc(pl.to):(fi.soon?' · còn '+fi.daysLeft+' ngày':''));
    if(fi.incomplete) return 'gói trọn gói thiếu ngày bắt đầu/kết thúc → dùng '+(fi.src==='custom'?'ô nhập riêng':'tham số'); return fi.src==='custom'?'nhập riêng ở ROI':(fi.noPlan?'chưa cấp gói · dùng tham số '+(fi.src==='brand'?'riêng':'mặc định'):'tham số '+(fi.src==='brand'?'riêng':'mặc định')); }
  function roiBasisLabel(b){ return b==='hotwarm'?'nóng + ấm':b==='both'?'cả hai':'mọi lead hợp lệ'; }
  /* v119-87: số ĐẾM 30 ngày dùng CHUNG với Bảng brand (agyWinFor: bộ đếm máy chủ daily_stats; chưa có → ước tính từ lead đã nạp) + 30 ngày liền trước để so */
  function roiCountsFor(code, IX){ if(!code) return null; IX=IX||agyIndex(); const w=agyWinFor(code,30,0,IX), p=agyWinFor(code,30,30,IX);
    const mk=x=>({valid:Number(x.new)||0, hw:(Number(x.hot)||0)+(Number(x.warm)||0), hot:Number(x.hot)||0, warm:Number(x.warm)||0, cold:Number(x.cold)||0, contacted:Number(x.contacted)||0, resp:Number(x.responded)||0, booked:Number(x.booked)||0, closed:Number(x.closed)||0, deal:Number(x.deal)||0, lost:Number(x.lost)||0, dropped:Number(x.dropped)||0});
    return Object.assign(mk(w),{prev:mk(p), server:!!IX.active}); }
  function roiDelta(cur, prev){ cur=Number(cur)||0; prev=Number(prev)||0; if(!prev) return cur?'<span class="roi-d up" title="30 ngày trước: 0">mới</span>':''; const v=Math.round((cur-prev)/prev*100); return `<span class="roi-d ${v>=0?'up':'down'}" title="30 ngày trước: ${fmt(prev)}">${v>=0?'▲':'▼'} ${Math.abs(v)}%</span>`; }
  function roiSelect(code){ roiSelBrand=code||null; roiPreview=false; } // Bảng brand → "Tài chính" gọi rồi go('roi')""", tag='helpers')

# ---------- roiCompute: nhận cnt (bộ đếm) + 2 cách CPL ----------
rep(R40, "  function roiCompute(arr, R, kpiHW, kpiClosed){", "  function roiCompute(arr, R, kpiHW, kpiClosed, cnt){ // v119-87: cnt = bộ đếm 30 ngày dùng chung Bảng brand (null → đếm trên lead đã tải như cũ)", tag='compute.sig')
rep(R40, """    const n30=arr.filter(l=>{ const d=parseTS(l.detected_at); return d && d.getTime()>=Date.now()-30*864e5 && l.temp!=='junk' && !l.dropped; }).length;
    const cplSL = nMonth ? R.fee/nMonth : 0;
    const adsCost = nMonth * R.cplAds;
    const saving = Math.max(0, adsCost - R.fee);
    const cheaper = (cplSL>0 && R.cplAds>0) ? (R.cplAds/cplSL) : 0;""",
"""    let n30=arr.filter(l=>{ const d=parseTS(l.detected_at); return d && d.getTime()>=Date.now()-30*864e5 && l.temp!=='junk' && !l.dropped; }).length;
    const ovN=Number(R.leadsMonth)||0;
    if(cnt){ nMonth=ovN||cnt.hw; n30=ovN||cnt.valid; } else if(ovN) n30=ovN; // v119-87: bộ đếm máy chủ thắng lead đã tải; Z15 khai báo tay thắng tất cả
    /* v119-87: 2 cách CPL — A = phí gói ÷ MỌI lead hợp lệ 30 ngày (mặc định) · B = ÷ lead nóng+ấm; `basis` = cách CHÍNH theo cplBasis của brand ('both' → A chính, ghi kèm B) */
    const basis=(R.cplBasis==='hotwarm')?'hotwarm':'valid';
    const cplA=n30?R.fee/n30:0, cplB=nMonth?R.fee/nMonth:0, adsA=n30*R.cplAds, adsB=nMonth*R.cplAds;
    const nBasis=basis==='valid'?n30:nMonth;
    const cplSL = basis==='valid'?cplA:cplB;
    const adsCost = basis==='valid'?adsA:adsB;
    const saving = Math.max(0, adsCost - R.fee);
    const cheaper = (cplSL>0 && R.cplAds>0) ? (R.cplAds/cplSL) : 0;""", tag='compute.cpl')
rep(R40, "    return { open, closedN, rates, expected, realized, realizedReal, realizedEst, dealsWithVal:withVal.length, dealsNoVal:noVal.length, budgetN, nMonth, n30, cplSL, adsCost, saving, savingRaw:adsCost-R.fee, cheaper, evAvg, byTemp, stageRows, fc };",
         "    return { open, closedN, rates, expected, realized, realizedReal, realizedEst, dealsWithVal:withVal.length, dealsNoVal:noVal.length, budgetN, nMonth, n30, cplSL, adsCost, saving, savingRaw:adsCost-R.fee, cheaper, evAvg, byTemp, stageRows, fc, basis, nBasis, cplA, cplB, adsA, adsB, saveA:adsA-R.fee, saveB:adsB-R.fee, cnt:cnt||null };", tag='compute.ret')

# ---------- hero: dùng C + ghi kèm cách còn lại ----------
i=rd(R40).index("  function roiHeroHtml(C, R){"); j=rd(R40).index("  function roiStat(lb, v, nt, cls){")
hero_new = """  function roiHeroHtml(C, R, showBoth){
    const simple = R.mode==='simple';
    const N = roiSimpleN(C,R); const usedOv=(Number(R.leadsMonth)||0)>0;
    const cpl = N ? R.fee/N : 0;
    const ads = N * R.cplAds;
    const save = ads - R.fee;
    const cheaper = (cpl>0 && R.cplAds>0) ? (R.cplAds/cpl) : 0;
    const srcNote = usedOv?'số lead do Z15 khai báo':(C.basis==='valid'?'mọi lead hợp lệ 30 ngày, không tính lead rác':'lead nóng+ấm 30 ngày');
    /* v119-87: super (hoặc brand đặt 'cả hai') thấy thêm dòng cách còn lại */
    const alt=((showBoth||R.cplBasis==='both')&&!usedOv) ? (C.basis==='valid'
      ? ('Theo nóng + ấm: '+fmt(C.nMonth)+' lead · CPL '+(C.nMonth?fmtVnd(C.cplB):'—')+' · tiết kiệm '+(C.saveB<0?'−':'')+fmtVnd(Math.abs(C.saveB)))
      : ('Theo mọi lead hợp lệ: '+fmt(C.n30)+' lead · CPL '+(C.n30?fmtVnd(C.cplA):'—')+' · tiết kiệm '+(C.saveA<0?'−':'')+fmtVnd(Math.abs(C.saveA)))) : '';
    const feeTag=(R.feeInfo&&R.feeInfo.src==='plan')?' (theo Gói giải pháp)':'';
    const right = (R.cplAds>0 && N>0)
      ? `<div class="rl-vs"><div class="rl-vs-t">Cùng ${fmt(N)} lead${C.basis==='valid'?'':' chất lượng'} – chi phí hai phương án</div>${roiBars(R.fee, ads, fmt(N)+' lead × CPL benchmark '+fmtVnd(R.cplAds)+' · '+srcNote)}</div>`
      : `<div class="rl-vs"><div class="rl-vs-t">So sánh với quảng cáo</div><div class="rlb-note">Nhập <b>CPL benchmark ads</b> của brand trong phần tham số để so sánh trực tiếp chi phí và thấy con số tiết kiệm mỗi tháng.</div></div>`;
    if (save > 0 && N > 0){
      return `<div class="rl-card rl-state">
        <div class="rl-hero">
          <span class="rl-kick">Kết quả tháng này${simple?' · chế độ đơn giản':''}</span>
          <div class="rh-num"><b>${fmtVnd(save)}</b></div>
          <div class="rl-hero-sub">tiết kiệm mỗi tháng so với chạy quảng cáo</div>
          <div class="rl-eq">= (${fmt(N)} lead ${C.basis==='valid'?'hợp lệ':'nóng+ấm'} × CPL ${fmtVnd(R.cplAds)}) − phí gói ${fmtVnd(R.fee)}${feeTag}</div>
          ${alt?`<div class="rl-alt">${alt}</div>`:''}
          ${cheaper>=1.05?`<span class="rl-delta">${SLI.checkCircle} Rẻ hơn ${cheaper.toLocaleString('vi-VN',{maximumFractionDigits:1})} lần chạy ads</span>`:''}
        </div>
        ${right}
      </div>`;
    }
    // Chưa đủ dữ liệu tiết kiệm → hero hiển thị giá trị chính của chế độ
    return `<div class="rl-card rl-state">
      <div class="rl-hero">
        <span class="rl-kick">${simple?'Chi phí mỗi lead SmartLead':'Giá trị pipeline ước tính'}</span>
        <div class="rh-num"><b>${simple?fmtVnd(cpl):fmtVnd(C.expected+C.realized)}</b></div>
        <div class="rl-hero-sub">${simple?('= phí gói '+fmtVnd(R.fee)+feeTag+' ÷ '+fmt(N)+' lead '+(C.basis==='valid'?'hợp lệ':'nóng+ấm')):('từ '+fmt(C.open.length)+' lead đang xử lý · giá trị nền × tỉ lệ chốt từng nhóm nhiệt')}</div>
        ${alt?`<div class="rl-alt">${alt}</div>`:''}
      </div>
      ${right}
    </div>`;
  }
"""
s=rd(R40); wr(R40, s[:i]+hero_new+s[j:]); lib._log.append('hero 40-roi rewrite')

# ---------- ô CPL dùng chung + KPI/simple nhận showBoth ----------
rep(R40, """  function roiKpisHtml(C, R){
    return `<div class="rl-card rl-strip mt-16">
      ${roiStat('Giá trị pipeline ước tính', fmtVnd(C.expected), 'Σ giá trị kỳ vọng của '+fmt(C.open.length)+' lead đang mở (doanh thu đã chốt xem khối dưới)')}
      ${roiStat('Giá trị trung bình mỗi lead', fmtVnd(C.evAvg), '= tổng kỳ vọng ÷ '+fmt(C.open.length)+' lead đang xử lý')}
      ${roiStat('Chi phí mỗi lead SmartLead', C.nMonth?fmtVnd(C.cplSL):'—', C.nMonth?('= phí gói ÷ '+fmt(C.nMonth)+' lead nóng+ấm / 30 ngày'):'chưa có lead nóng/ấm trong 30 ngày')}""",
"""  /* v119-87: ô "Chi phí mỗi lead" — số chính theo cplBasis của brand; 'both' hoặc super → ghi cả 2 cách */
  function roiCplStat(C, R, showBoth){
    const both=showBoth||R.cplBasis==='both'; const A=C.n30?fmtVnd(C.cplA):'—', B=C.nMonth?fmtVnd(C.cplB):'—';
    const main=C.basis==='valid'?A:B;
    const nt=both?('mọi lead hợp lệ '+A+' · nóng+ấm '+B+(showBoth?(' · khách thấy: '+roiBasisLabel(R.cplBasis)):''))
      :(C.basis==='valid'?('= phí gói '+fmtVnd(R.fee)+' ÷ '+fmt(C.n30)+' lead hợp lệ 30 ngày'):('= phí gói '+fmtVnd(R.fee)+' ÷ '+fmt(C.nMonth)+' lead nóng+ấm 30 ngày'));
    return roiStat('Chi phí mỗi lead SmartLead', main, nt);
  }
  function roiKpisHtml(C, R, showBoth){
    return `<div class="rl-card rl-strip mt-16">
      ${roiStat('Giá trị pipeline ước tính', fmtVnd(C.expected), 'Σ giá trị kỳ vọng của '+fmt(C.open.length)+' lead đang mở (doanh thu đã chốt xem khối dưới)')}
      ${roiStat('Giá trị trung bình mỗi lead', fmtVnd(C.evAvg), '= tổng kỳ vọng ÷ '+fmt(C.open.length)+' lead đang xử lý')}
      ${roiCplStat(C,R,showBoth)}""", tag='kpis')

rep(R40, """      Chi phí/lead = phí gói ÷ lead nóng+ấm/tháng · Tiết kiệm = (số lead × CPL ads) − phí gói.
      Số cập nhật <b>realtime</b> và là <b>ước tính</b> – doanh thu thực phụ thuộc năng lực chốt của đội sales.</div>`;
  }""",
"""      Chi phí/lead = phí gói ÷ ${(R&&R.cplBasis==='hotwarm')?'lead nóng+ấm':'mọi lead hợp lệ'} 30 ngày${(R&&R.cplBasis==='both')?' (kèm cách tính theo lead nóng+ấm)':''} · Tiết kiệm = (số lead × CPL ads) − phí gói · Phí gói theo Gói giải pháp quy về tháng (hoặc số nhập riêng).
      Số cập nhật <b>realtime</b> và là <b>ước tính</b> – doanh thu thực phụ thuộc năng lực chốt của đội sales.</div>`;
  }""", tag='method')
rep(R40, "  function roiMethodHtml(){", "  function roiMethodHtml(R){", tag='method.sig')
rep(R40, """  function roiSimpleN(C, R){
    return (Number(R.leadsMonth)||0) > 0 ? Number(R.leadsMonth) : (C.n30||0); // v119-79: lead hợp lệ 30 NGÀY (trước: cả cửa sổ → phí tháng chia cho lead nhiều tháng)
  }
  function roiSimpleBlock(C, R){
    const N = roiSimpleN(C, R);
    const usedOverride = (Number(R.leadsMonth)||0) > 0;
    const cpl = N ? R.fee/N : 0;
    const tempCap = C.byTemp.map(r=>fmt(r.n)+' '+({hot:'nóng',warm:'ấm',cold:'lạnh'}[r.t])).join(' · ');
    return `<div class="rl-card rl-strip mt-16">
      ${roiStat('Chi phí mỗi lead SmartLead', fmtVnd(cpl), '= phí gói '+fmtVnd(R.fee)+' ÷ '+fmt(N)+' lead')}
      ${roiStat('Tổng lead nhận được', fmt(N), usedOverride?'Z15 khai báo cho kỳ này':('lead hợp lệ 30 ngày · đang mở: '+tempCap))}
      ${roiStat('Nếu chạy quảng cáo', fmtVnd(N*R.cplAds), '= '+fmt(N)+' lead × CPL '+fmtVnd(R.cplAds))}
      ${roiStat('Phí gói SmartLead / tháng', fmtVnd(R.fee), 'con số thực đang trả')}
    </div>${roiRealizedHtml(C)}${roiForecastHtml(C)}`;
  }""",
"""  function roiSimpleN(C, R){
    return (Number(R.leadsMonth)||0) > 0 ? Number(R.leadsMonth) : (C.nBasis||0); // v119-87: theo cplBasis (A hợp lệ 30 ngày mặc định · B nóng+ấm) — cùng mẫu số với bảng toàn cảnh
  }
  function roiSimpleBlock(C, R, showBoth){
    const N = roiSimpleN(C, R);
    const usedOverride = (Number(R.leadsMonth)||0) > 0;
    const tempCap = C.cnt?(fmt(C.cnt.hot)+' nóng · '+fmt(C.cnt.warm)+' ấm · '+fmt(C.cnt.cold)+' lạnh'):C.byTemp.map(r=>fmt(r.n)+' '+({hot:'nóng',warm:'ấm',cold:'lạnh'}[r.t])).join(' · ');
    const fi=R.feeInfo||{};
    return `<div class="rl-card rl-strip mt-16">
      ${roiCplStat(C,R,showBoth)}
      ${roiStat('Tổng lead nhận được', fmt(N), usedOverride?'Z15 khai báo cho kỳ này':((C.basis==='valid'?'lead hợp lệ 30 ngày':'lead nóng+ấm 30 ngày')+' · '+tempCap+(C.cnt&&C.cnt.server?' · bộ đếm máy chủ':'')))}
      ${roiStat('Nếu chạy quảng cáo', fmtVnd(N*R.cplAds), '= '+fmt(N)+' lead × CPL '+fmtVnd(R.cplAds))}
      ${roiStat('Phí gói SmartLead / tháng', fmtVnd(R.fee), fi.src==='plan'?('theo Gói giải pháp: '+roiFeeNote(fi)):'con số thực đang trả')}
    </div>${roiRealizedHtml(C)}${roiForecastHtml(C)}`;
  }""", tag='simple')
rep(R40, """      Chi phí mỗi lead = phí gói tháng ÷ tổng lead hợp lệ (không tính lead rác) ·""",
         """      Chi phí mỗi lead = phí gói tháng ÷ ${(R&&R.cplBasis==='hotwarm')?'lead nóng+ấm':'tổng lead hợp lệ (không tính lead rác)'} 30 ngày${(R&&R.cplBasis==='both')?' (kèm cách tính theo lead nóng+ấm)':''} ·""", tag='simple.method')
rep(R40, "  function roiSimpleMethodHtml(){", "  function roiSimpleMethodHtml(R){", tag='simple.method.sig')

# ---------- editor: khối phí gói + cách khách thấy ----------
rep(R40, "  function roiEditorHtml(R, indRows, title, sub){", "  function roiEditorHtml(R, indRows, title, sub, ctx){ ctx=ctx||{}; const bd=ctx.brandDoc||null, C=ctx.C||null, fi=R.feeInfo||roiFeeInfo(bd,R); // v119-87: ctx = {brandDoc, C} cho khối phí gói/cplBasis", tag='editor.sig')
rep(R40, """          ${[['roiFee','Phí gói SmartLead / tháng (₫)',R.fee],['roiAov','Giá trị hợp đồng/đơn CHUNG (₫)',R.aov],""",
         """          ${[].concat(bd?[]:[['roiFee','Phí gói mặc định / tháng (₫)',R.feeRaw!=null?R.feeRaw:R.fee]],[['roiAov','Giá trị hợp đồng/đơn CHUNG (₫)',R.aov],""", tag='editor.grid')
rep(R40, """['roiHot','Tỉ lệ chốt lead NÓNG (%)',R.closeHot],['roiWarm','Tỉ lệ chốt lead ẤM (%)',R.closeWarm],['roiCold','Tỉ lệ chốt lead LẠNH (%)',R.closeCold]].map(([id,lb,v])=>`""",
         """['roiHot','Tỉ lệ chốt lead NÓNG (%)',R.closeHot],['roiWarm','Tỉ lệ chốt lead ẤM (%)',R.closeWarm],['roiCold','Tỉ lệ chốt lead LẠNH (%)',R.closeCold]]).map(([id,lb,v])=>`""", tag='editor.grid2')
rep(R40, """        <div style="margin-top:16px">
          <div style="font-size:12.5px;font-weight:700;color:var(--ink-600);margin-bottom:8px">Giá trị hợp đồng/đơn theo ngành""",
"""        ${roiFeeBoxHtml(R, bd, C, fi)}
        <div style="margin-top:16px">
          <div style="font-size:12.5px;font-weight:700;color:var(--ink-600);margin-bottom:8px">Giá trị hợp đồng/đơn theo ngành""", tag='editor.feebox')
rep(R40, """  function roiIndRowsOf(arr, R){""",
"""  /* v119-87: khối "Phí gói & cách khách thấy CPL" trong editor — brand: radio Gói giải pháp / nhập riêng + link sửa gói; mặc định hệ thống: chỉ cplBasis mặc định */
  function roiFeeBoxHtml(R, bd, C, fi){
    const pl=fi.plan||{}; const custom=R.feeSrc==='custom';
    const planLine=(fi.pm&&fi.pm.fee>0)
      ? `<b>${esc(pl.tier||'Gói')}</b> · ${fmtVnd(pl.price)}/${ROI_CYCLE_VI[pl.cycle]||'tháng'} → <b>${fmtVnd(fi.pm.fee)}/tháng</b>${fi.expired?` <span class="roi-flag bad">hết hạn ${esc(pl.to)}</span>`:(fi.soon?` <span class="roi-flag warn">còn ${fi.daysLeft} ngày</span>`:'')}`
      : (fi.incomplete?'<span class="roi-flag warn">gói trọn gói thiếu ngày bắt đầu/kết thúc</span> – tạm dùng ô nhập bên dưới':'<span class="roi-flag">chưa cấp gói</span> – tạm dùng ô nhập bên dưới');
    const optA=C&&C.n30?fmtVnd(C.cplA):'—', optB=C&&C.nMonth?fmtVnd(C.cplB):'—';
    const basisSel=`<select class="u-select acs-in" id="roiCplBasis" style="max-width:380px">
        <option value="valid"${(R.cplBasis||'valid')==='valid'?' selected':''}>Mọi lead hợp lệ 30 ngày${C?' – '+optA:''} (mặc định)</option>
        <option value="hotwarm"${R.cplBasis==='hotwarm'?' selected':''}>Chỉ lead nóng + ấm${C?' – '+optB:''}</option>
        <option value="both"${R.cplBasis==='both'?' selected':''}>Cả hai con số</option></select>`;
    if(!bd) return `<div class="roi-fee" id="roiFeeBox">
      <div class="roi-fee-t">Khách (admin/sales brand) nhìn "Chi phí mỗi lead" theo – mặc định hệ thống</div>${basisSel}
      <div class="roi-fee-hint">Áp cho mọi brand chưa chọn riêng. Super Admin luôn thấy cả hai cách. Phí gói từng brand lấy từ "Gói giải pháp" (mục Người dùng); ô "Phí gói mặc định" ở trên chỉ dùng cho brand chưa cấp gói.</div></div>`;
    return `<div class="roi-fee" id="roiFeeBox">
      <div class="roi-fee-t">Phí gói SmartLead / tháng</div>
      <label class="roi-fee-opt"><input type="radio" name="roiFeeSrc" value="plan"${custom?'':' checked'}> <span>Theo <b>Gói giải pháp</b>: ${planLine} <a href="#" data-roi-plan="${esc(bd.code||'')}">${SLI.edit} Sửa gói ở Người dùng</a></span></label>
      <label class="roi-fee-opt"><input type="radio" name="roiFeeSrc" value="custom"${custom?' checked':''}> <span>Nhập riêng cho brand này</span> <input class="acs-in mono" id="roiFee" type="number" min="0" value="${fi.raw}" style="max-width:170px"${custom?'':' disabled'}></label>
      <div class="roi-fee-hint">Đang áp dụng: <b>${fmtVnd(R.fee)}/tháng</b> (${roiFeeTag(fi)} · ${roiFeeNote(fi)}). Tổng phí gói toàn hệ thống = doanh thu gói của Z15.</div>
      <div class="roi-fee-t mt-12">Khách (admin/sales của brand) nhìn "Chi phí mỗi lead" theo</div>${basisSel}
      <div class="roi-fee-hint">Super Admin luôn thấy cả hai. Lựa chọn này quyết định ô "tiết kiệm/tháng", "Chi phí mỗi lead" và mẫu số mà khách nhìn thấy. Bấm "Xem như khách" phía trên để kiểm tra.</div>
    </div>`;
  }
  function roiIndRowsOf(arr, R){""", tag='feebox')
rep(R40, """    return { mode:((document.getElementById('roiModeVal')||{}).value==='simple')?'simple':'advanced',
      fee:val('roiFee'), aov:val('roiAov'),""",
"""    const fsEl=view.querySelector('input[name="roiFeeSrc"]:checked'); const bs=(document.getElementById('roiCplBasis')||{}).value; // v119-87
    return { mode:((document.getElementById('roiModeVal')||{}).value==='simple')?'simple':'advanced',
      feeSrc:(fsEl&&fsEl.value==='custom')?'custom':'plan', cplBasis:(bs==='hotwarm'||bs==='both')?bs:'valid',
      fee:val('roiFee'), aov:val('roiAov'),""", tag='collect')

# ---------- brand user view: bộ đếm chung + khối dùng chung với "Xem như khách" ----------
i=rd(R40).index("  function roiBrandView(){"); j=rd(R40).index("  /* ---------- Super admin: toàn cảnh mọi brand + drill-down + editor ---------- */")
brand_new = """  /* v119-87: khối khách nhìn thấy (brand user) — dùng chung với "Xem như khách" của super */
  function roiBrandBlocks(bd, C, R, showBoth){
    const src = roiParamSrc(bd); const fi=R.feeInfo||{};
    const srcChip = src==='brand' ? '<span class="rl-tag2" style="margin:3px 0 0">Tham số riêng của brand</span>'
      : src==='global' ? '<span class="rl-tag2" style="margin:3px 0 0">Mặc định hệ thống</span>'
      : '<span class="rl-tag2" style="margin:3px 0 0">Mặc định</span>';
    const pr = (k,v)=>`<div class="rl-pr"><span class="k">${k}</span><span class="v">${v}</span></div>`;
    return `${src==='default'&&fi.src!=='plan'?`<div class="banner warn" style="margin-bottom:16px"><span class="ic">${SLI.warning}</span>
        <span class="tx"><b>Đang tính theo tham số mặc định.</b> Z15 sẽ hiệu chỉnh theo thực tế brand của bạn – con số hiện tại chỉ mang tính minh hoạ.</span></div>`:''}
      ${roiHeroHtml(C,R,showBoth)}
      ${R.mode==='simple' ? roiSimpleBlock(C,R,showBoth) : (roiKpisHtml(C,R,showBoth)+roiCompareTempHtml(C,R)+roiStagesHtml(C))}
      <div class="rl-card mt-16">
        <div class="rl-head"><div><h3>Tham số quy đổi đang áp dụng</h3><span class="rl-sub">Do đội Z15 hiệu chỉnh riêng theo ngành &amp; mô hình của bạn – cần thay đổi, liên hệ Z15 · hotline 1900.5368</span></div>${srcChip}</div>
        <div class="rl-pad" style="padding-top:6px;padding-bottom:8px">
          ${pr('Chế độ tính', R.mode==='simple'?'Đơn giản – chi phí / lead':'Nâng cao – giá trị kỳ vọng & ROI')}
          ${pr('Phí gói / tháng', fmtVnd(R.fee)+(fi.src==='plan'?' <span class="rl-tag2">'+roiFeeNote(fi)+'</span>':''))}
          ${pr('Chi phí mỗi lead tính theo', roiBasisLabel(R.cplBasis)+' (30 ngày)')}
          ${pr('Giá trị hợp đồng/đơn trung bình', fmtVnd(R.aov))}
          ${pr('CPL benchmark ads', fmtVnd(R.cplAds))}
          ${pr('Tỉ lệ chốt Nóng / Ấm / Lạnh', R.closeHot+'% / '+R.closeWarm+'% / '+R.closeCold+'%')}
          ${Object.keys(R.industries).length?pr('Ngành có giá trị riêng', fmt(Object.keys(R.industries).length)+' ngành'):''}
        </div>
      </div>
      ${R.mode==='simple'?roiSimpleMethodHtml(R):roiMethodHtml(R)}`;
  }
  function roiBrandView(){
    const bd = D.myBrand || null;
    const R = roiParamsFor(bd);
    const kpiHW = D.kpi ? (Number(D.kpi.hot)||0)+(Number(D.kpi.warm)||0) : 0;
    const C = roiCompute(D.leads||[], R, kpiHW, D.kpi?Number(D.kpi.closed)||0:0, roiCountsFor(bd&&bd.code)); // v119-87: bộ đếm 30 ngày dùng chung Bảng brand
    view.innerHTML = roiBrandBlocks(bd, C, R, false);
  }
"""
s=rd(R40); wr(R40, s[:i]+brand_new+s[j:]); lib._log.append('brandview 40-roi rewrite')

# ---------- super view: viết lại toàn bộ ----------
i=rd(R40).index("  function roiSuperView(){"); j=rd(R40).index("  let roiSelBrand=null;")
super_new = r"""  /* v119-87: TOÀN CẢNH BRAND — 17 cột 5 nhóm, số khối lượng/kết quả/SLA/vận hành dùng CHUNG với Bảng brand (agyRowsRaw + agyWinFor = bộ đếm máy chủ daily_stats,
     không phụ thuộc cửa sổ lead đã tải); tiền + CPL cả 2 cách; phí gói theo Gói giải pháp; pipeline/dự báo từ lead đã tải (ghi chú rõ). Sắp xếp theo cột · dòng tổng · CSV · "Xem như khách". */
  const ROI_COLS=[
    ['name','Brand','','Tên brand · cờ: gói hết hạn / sắp hết hạn / chưa cấp gói · nick cần xử lý · chưa thiết lập',0],
    ['valid','Hợp lệ 30n','Khối lượng','Lead hợp lệ phát hiện 30 ngày (AI chấm từ 40 điểm, đã bỏ rác) · ▲▼ so 30 ngày liền trước',1],
    ['hw','Nóng · Ấm · Lạnh','Khối lượng','Phân bố nhiệt độ 30 ngày · sắp xếp theo nóng+ấm',1],
    ['resp','Phản hồi','Kết quả','Khách đã phản hồi trong 30 ngày',1],
    ['booked','Hẹn','Kết quả','Đã đặt hẹn tư vấn 30 ngày',1],
    ['closed','Chốt','Kết quả','Deal chốt 30 ngày · % = chốt ÷ lead hợp lệ',1],
    ['deal','Doanh thu','Kết quả','Σ giá trị đơn sales nhập, 30 ngày',1],
    ['fee','Phí gói/th','Tài chính','Gói = theo Gói giải pháp (Người dùng) quy về tháng · Riêng = nhập ở ROI · Mặc định = chưa cấp gói',1],
    ['cplA','CPL hợp lệ','Tài chính','Phí gói ÷ mọi lead hợp lệ 30 ngày (cách A, mặc định)',1],
    ['cplB','CPL nóng+ấm','Tài chính','Phí gói ÷ lead nóng+ấm 30 ngày (cách B)',1],
    ['saveA','Tiết kiệm/th','Tài chính','(lead × CPL ads) − phí gói · số chính theo cách A · dòng nhỏ: theo cách B',1],
    ['basis','Khách thấy','Tài chính','Cách CPL mà admin/sales của brand nhìn thấy – chỉnh trong tham số riêng',0],
    ['pipe','Pipeline','Giá trị','Giá trị kỳ vọng lead đang mở + đã chốt (tính trên lead đã tải)',1],
    ['fc','Dự báo 30n','Giá trị','Doanh thu dự báo 30 ngày tới (lead đang mở × xác suất × tốc độ chốt)',1],
    ['ops','Nguồn · Nick','Vận hành','Nguồn quét đang bật / nick Facebook đang bật',1],
    ['auto','Auto hôm nay','Vận hành','Automation hôm nay: react / bình luận / kết bạn / inbox',1],
    ['sla','SLA','Vận hành','% lead hợp lệ 30 ngày được chăm trong ngưỡng của brand',1]
  ];
  function roiSuperRows(){
    const IX=agyIndex(); const AG={}; agyRowsRaw().forEach(r=>{ AG[r.code]=r; });
    const brands=(D.brands||[]).slice().sort((a,b)=>(a.name||a.code||'').localeCompare(b.name||b.code||''));
    const byB={}; (D.leads||[]).forEach(l=>{ const k=l.brand||''; (byB[k]=byB[k]||[]).push(l); });
    const rows=brands.map(b=>{ const code=String(b.code||''); const arr=byB[code]||[]; const R=roiParamsFor(b); const ag=AG[code]||null;
      const cnt=roiCountsFor(code,IX); const C=roiCompute(arr,R,0,0,cnt); const fi=R.feeInfo||roiFeeInfo(b,R);
      const st=(ag&&ag.st)||null; const autoN=st?((Number(st.react)||0)+(Number(st.comment)||0)+(Number(st.friend)||0)+(Number(st.inbox)||0)):0;
      const v={name:(b.name||code).toLowerCase(), valid:cnt.valid, hw:cnt.hw, resp:cnt.resp, booked:cnt.booked, closed:cnt.closed, deal:cnt.deal, fee:R.fee, cplA:C.cplA, cplB:C.cplB, saveA:C.saveA, saveB:C.saveB,
        basis:R.cplBasis||'valid', pipe:C.expected+C.realized, fc:(C.fc&&C.fc.f30Val)||0, ops:ag?ag.srcOn:0, auto:autoN, sla:(ag&&ag.sla!=null)?ag.sla:-1};
      return {b, code, R, C, arr, cnt, fi, ag, st, v}; });
    const un=byB['']||[]; const unRow=un.length?{b:null, code:'', R:roiParamsFor(null), C:roiCompute(un, roiParamsFor(null),0,0,null), arr:un, cnt:null, fi:null, ag:null, st:null, v:null}:null;
    return {rows, unRow, IX};
  }
  function roiSortRows(rows){ const k=ROI_TB.sort, dir=ROI_TB.dir; const out=rows.slice();
    out.sort((a,b)=>{ const x=a.v[k], y=b.v[k]; if(k==='name'||k==='basis') return dir*String(x).localeCompare(String(y)); const nx=Number(x)||0, ny=Number(y)||0; return dir*((nx>ny)?1:(nx<ny)?-1:0); }); return out; }
  function roiFlags(r){ const f=[]; const fi=r.fi||{};
    if(r.b&&r.b.active===false) f.push('<span class="roi-flag" title="Brand đang tắt – không tính vào tổng phí gói / tiết kiệm toàn hệ thống">đang tắt</span>');
    if(fi.src==='plan'&&fi.expired) f.push('<span class="roi-flag bad" title="Gói giải pháp đã hết hạn '+esc(fi.plan.to)+'">gói hết hạn</span>');
    else if(fi.src==='plan'&&fi.soon) f.push('<span class="roi-flag warn" title="Gói giải pháp hết hạn '+esc(fi.plan.to)+'">còn '+fi.daysLeft+' ngày</span>');
    else if(fi.noPlan||fi.incomplete) f.push('<span class="roi-flag" title="Chưa cấp Gói giải pháp – phí gói đang lấy tham số">chưa cấp gói</span>');
    if(r.ag&&r.ag.nickWarn) f.push('<span class="roi-flag bad" title="Nick cần đăng nhập lại / checkpoint / tạm dừng">'+fmt(r.ag.nickWarn)+' nick</span>');
    if(r.ag&&r.ag.setupMissing&&r.ag.setupMissing.length) f.push('<span class="roi-flag warn" title="Thiếu: '+esc(r.ag.setupMissing.join(', '))+'">chưa thiết lập</span>');
    return f.join(''); }
  function roiCsvText(rows){ const H=['Brand','Mã','Lead hợp lệ 30n','30n trước','Nóng','Ấm','Lạnh','Phản hồi','Hẹn','Chốt','Doanh thu','Phí gói/tháng','Nguồn phí','CPL hợp lệ','CPL nóng+ấm','Tiết kiệm A','Tiết kiệm B','Khách thấy','Pipeline','Dự báo 30n','Nguồn bật','Nick bật','Auto hôm nay','SLA %'];
    const q=s=>'"'+String(s==null?'':s).replace(/"/g,'""')+'"'; const n=x=>Math.round(Number(x)||0);
    const L=rows.map(r=>[r.b.name||r.code, r.code, r.cnt.valid, r.cnt.prev.valid, r.cnt.hot, r.cnt.warm, r.cnt.cold, r.cnt.resp, r.cnt.booked, r.cnt.closed, n(r.cnt.deal), n(r.R.fee), roiFeeTag(r.fi), n(r.C.cplA), n(r.C.cplB), n(r.C.saveA), n(r.C.saveB), roiBasisLabel(r.R.cplBasis), n(r.v.pipe), n(r.v.fc), r.ag?r.ag.srcOn:'', r.ag?r.ag.nickOn:'', r.v.auto, r.v.sla>=0?r.v.sla:''].map(q).join(','));
    return '\uFEFF'+H.map(q).join(',')+'\n'+L.join('\n'); }
  function roiSuperView(){
    const {rows, unRow, IX}=roiSuperRows();
    const all = rows.concat(unRow?[unRow]:[]);
    // Tổng phí gói + tiết kiệm: CHỈ cộng các brand thật đang hoạt động (nhóm "chưa gán brand" không có phí gói riêng)
    const srcOn=new Set((D.sources||[]).filter(s=>s&&s.status==='active').map(s=>String(s.brand||''))); // v119-80: brand đang hoạt động = không bị tắt + (có lead đã tải HOẶC tham số riêng HOẶC nguồn quét đang bật)
    const active = rows.filter(r=>r.b.active!==false && (r.arr.length || r.cnt.valid || (r.b&&r.b.roi) || (r.fi&&r.fi.src==='plan') || srcOn.has(String(r.b.code||''))));
    const negN = active.filter(r=>r.C.saveA<0).length;
    const sum=(list,f)=>list.reduce((a,r)=>a+(Number(f(r))||0),0);
    const tot = {
      pipe: sum(all,r=>r.C.expected+r.C.realized), // v119-87: cộng MỌI brand (trước bỏ brand chế độ Đơn giản → tổng 0 dù ô dự báo có số)
      saveA: sum(active,r=>r.C.saveA), saveB: sum(active,r=>r.C.saveB), fee: sum(active,r=>r.R.fee),
      open: sum(all,r=>r.C.open.length), valid: sum(rows,r=>r.cnt.valid), validPrev: sum(rows,r=>r.cnt.prev.valid), hw: sum(rows,r=>r.cnt.hw),
      resp: sum(rows,r=>r.cnt.resp), booked: sum(rows,r=>r.cnt.booked), closed: sum(rows,r=>r.cnt.closed), closedPrev: sum(rows,r=>r.cnt.prev.closed), deal: sum(rows,r=>r.cnt.deal), dealPrev: sum(rows,r=>r.cnt.prev.deal),
      fc: sum(all,r=>(r.C.fc&&r.C.fc.f30Val)||0), adsA: sum(active,r=>r.C.adsA), adsB: sum(active,r=>r.C.adsB)
    };
    const feeSrcN={plan:0,custom:0,def:0}; active.forEach(r=>{ const s=r.fi?r.fi.src:'default'; feeSrcN[s==='plan'?'plan':(s==='custom'||s==='brand')?'custom':'def']++; });
    const expN=rows.filter(r=>r.fi&&r.fi.src==='plan'&&r.fi.expired).length, soonN=rows.filter(r=>r.fi&&r.fi.src==='plan'&&r.fi.soon).length, noPlanN=active.filter(r=>r.fi&&(r.fi.noPlan||r.fi.incomplete)).length;
    // brand đang chọn để xem chi tiết / chỉnh tham số
    const brands=rows.map(r=>r.b);
    const selBrand = roiSelBrand==='__default' ? null : brands.find(b=>b.code===roiSelBrand) || null;
    const selRow = selBrand ? rows.find(r=>r.b===selBrand) : null;
    const sysMult = (tot.fee>0 && tot.adsA>0) ? (tot.adsA/tot.fee) : 0;
    const BDOT = ['#2A40DA','#F59E0B','#047857','#7C3AED','#0E7490'];
    const server=!!IX.active;
    const groups=[]; ROI_COLS.forEach(c=>{ const g=groups[groups.length-1]; if(g&&g.name===c[2]) g.n++; else groups.push({name:c[2],n:1}); });
    const thead=`<tr class="grp">${groups.map(g=>`<th colspan="${g.n}">${esc(g.name)}</th>`).join('')}</tr>
      <tr>${ROI_COLS.map(c=>`<th class="${c[4]?'n':''}${ROI_TB.sort===c[0]?' on':''}" data-roi-sort="${c[0]}" title="${esc(c[3])}">${esc(c[1])}${ROI_TB.sort===c[0]?(ROI_TB.dir>0?' ▲':' ▼'):''}</th>`).join('')}</tr>`;
    const sorted=roiSortRows(rows);
    const money=(v,neg)=>v>0?fmtVnd(v):(neg&&v<0?'−'+fmtVnd(-v):'-');
    const tr=(r,ri)=>{ const c=r.cnt, C=r.C, R=r.R, ag=r.ag, st=r.st||{}; const pct=c.valid?Math.round(c.closed/c.valid*100):null;
      return `<tr data-roibrand="${esc(r.code)}" class="${selBrand===r.b?'sel':''}${r.b.active===false?' off':''}">
        <td><span class="rl-dot" style="background:${BDOT[ri%5]}"></span><span class="bnm">${esc(r.b.name||r.code)}</span>${(fl=>fl?'<div class="roi-flags">'+fl+'</div>':'')(roiFlags(r))}</td>
        <td class="n"><b>${fmt(c.valid)}</b>${roiDelta(c.valid,c.prev.valid)}</td>
        <td class="n"><span style="color:var(--hot)">${fmt(c.hot)}</span> · <span style="color:var(--warm)">${fmt(c.warm)}</span> · <span style="color:var(--cold)">${fmt(c.cold)}</span></td>
        <td class="n">${fmt(c.resp)}</td><td class="n">${fmt(c.booked)}</td>
        <td class="n">${fmt(c.closed)}${pct!=null&&c.closed?`<small>${pct}%</small>`:''}</td>
        <td class="n">${c.deal?fmtVnd(c.deal):'-'}</td>
        <td class="n">${fmtVnd(R.fee)}<small>${roiFeeTag(r.fi)}${r.fi&&r.fi.src==='plan'&&r.fi.pm.months>1?' · '+esc(ROI_CYCLE_VI[r.fi.plan.cycle]||''):''}</small></td>
        <td class="n">${C.n30?fmtVnd(C.cplA):'-'}${(Number(R.leadsMonth)||0)>0?`<small title="Z15 nhập tay ở tham số riêng – thay cho số đếm 30 ngày">÷ ${fmt(R.leadsMonth)} lead khai báo</small>`:''}</td>
        <td class="n">${C.nMonth?fmtVnd(C.cplB):'-'}${(Number(R.leadsMonth)||0)>0?`<small>÷ ${fmt(R.leadsMonth)} lead khai báo</small>`:''}</td>
        <td class="n" style="color:${C.saveA>0?'var(--success)':(C.saveA<0?'var(--danger)':'var(--ink-300)')}">${money(C.saveA,true)}<small title="Theo nóng+ấm">B: ${money(C.saveB,true)}</small></td>
        <td><span class="rl-tag2" style="margin-left:0">${roiBasisLabel(R.cplBasis)}</span></td>
        <td class="n">${fmtVnd(C.expected+C.realized)}${tot.pipe>0?`<span class="roi-share"><i style="width:${Math.min(100,Math.round((C.expected+C.realized)/tot.pipe*100))}%"></i></span>`:''}</td>
        <td class="n">${C.fc&&C.fc.f30Val?fmtVnd(C.fc.f30Val):'-'}</td>
        <td class="n">${ag?(fmt(ag.srcOn)+' · '+fmt(ag.nickOn)+(ag.nickWarn?`<small style="color:var(--hot)">${fmt(ag.nickWarn)} cần xử lý</small>`:'')):'-'}</td>
        <td class="n">${ag&&ag.auto?(fmt(r.v.auto)+`<small>${fmt(st.react||0)}/${fmt(st.comment||0)}/${fmt(st.friend||0)}/${fmt(st.inbox||0)}</small>`):'<span style="color:var(--ink-300)">tắt</span>'}</td>
        <td class="n">${ag&&ag.sla!=null?ag.sla+'%':'-'}</td>
      </tr>`; };
    view.innerHTML = `
      <div class="rl-card rl-state" style="margin-bottom:16px">
        <div class="rl-hero">
          <span class="rl-kick">Toàn hệ thống · ${fmt(active.length)} brand đang hoạt động</span>
          <div class="rh-num"><b>${tot.saveA<0?'−':''}${fmtVnd(Math.abs(tot.saveA))}</b></div>
          <div class="rl-hero-sub">${tot.saveA<0?'đang tốn hơn chạy quảng cáo – phí gói cao hơn CPL ads ở '+fmt(negN)+' brand':'tổng tiết kiệm mỗi tháng so với chạy quảng cáo'}</div>
          <div class="rl-eq">= Σ từng brand (lead hợp lệ 30 ngày × CPL riêng) − tổng phí gói ${fmtVnd(tot.fee)}</div>
          <div class="rl-alt">Theo nóng + ấm: ${fmt(tot.hw)} lead · tiết kiệm ${tot.saveB<0?'−':''}${fmtVnd(Math.abs(tot.saveB))}</div>
          ${sysMult>=1.05?`<span class="rl-delta">${SLI.checkCircle} Rẻ hơn ${sysMult.toLocaleString('vi-VN',{maximumFractionDigits:1})} lần chạy ads</span>`:''}
        </div>
        <div class="rl-vs"><div class="rl-vs-t">Chi phí hai phương án – cùng lượng lead</div>
          ${roiBars(tot.fee, tot.adsA, 'cộng theo CPL benchmark riêng từng brand đang hoạt động · mọi lead hợp lệ 30 ngày')}
        </div>
      </div>
      <div class="rl-card rl-strip">
        ${roiStat('Lead hợp lệ 30 ngày', fmt(tot.valid)+roiDelta(tot.valid,tot.validPrev), (server?'bộ đếm máy chủ, mọi brand':'ước tính từ lead đã nạp')+' · '+fmt(tot.hw)+' nóng+ấm · '+fmt(tot.open)+' lead đang mở')}
        ${roiStat('Chốt 30 ngày', fmt(tot.closed)+' deal'+roiDelta(tot.closed,tot.closedPrev), (tot.deal?('doanh thu thật '+fmtVnd(tot.deal)+roiDelta(tot.deal,tot.dealPrev)):'chưa có doanh thu nhập tay')+(tot.valid?' · tỷ lệ chốt '+(Math.round(tot.closed/tot.valid*1000)/10).toLocaleString('vi-VN')+'%':''))}
        ${roiStat('Tổng phí gói / tháng', fmtVnd(tot.fee), fmt(feeSrcN.plan)+' theo Gói giải pháp · '+fmt(feeSrcN.custom)+' nhập riêng · '+fmt(feeSrcN.def)+' mặc định'+(expN?' · <span style="color:var(--danger)">'+fmt(expN)+' gói hết hạn</span>':'')+(soonN?' · '+fmt(soonN)+' sắp hết hạn':'')+(noPlanN?' · '+fmt(noPlanN)+' chưa cấp gói':''))}
        ${roiStat('Tổng giá trị pipeline', fmtVnd(tot.pipe), 'kỳ vọng lead đang mở + đã chốt, mọi brand · dự báo 30 ngày '+fmtVnd(tot.fc)+' · tính trên '+fmt((D.leads||[]).length)+' lead đã tải')}
      </div>
      ${roiForecastHtml(roiSumForecast(all))}
      <div class="rl-card mt-16">
        <div class="rl-head"><div><h3>Toàn cảnh brand</h3><span class="rl-sub">Khối lượng · kết quả · SLA · vận hành cùng số với Bảng brand${server?' (bộ đếm máy chủ)':' (ước tính từ lead đã nạp)'} · CPL cả 2 cách · bấm tiêu đề cột để sắp xếp · bấm dòng để xem chi tiết &amp; chỉnh tham số</span></div>
          <div class="roi-acts"><button class="btn btn-ghost btn-sm" id="roiAgency">${SLI.chart} Bảng brand</button><button class="btn btn-ghost btn-sm" id="roiCsv" title="Tải bảng này dạng CSV (mở bằng Excel)">${SLI.download||SLI.card} CSV</button></div></div>
        <div style="overflow-x:auto"><table class="rl-tbl roi-tbl roi-wide"><thead>${thead}</thead>
          <tbody>
          ${sorted.map(tr).join('')}
          ${unRow?`<tr><td style="color:var(--ink-500)">- Chưa gán brand <span style="font-size:11px">(gán brand cho nguồn để tách số liệu)</span></td>
            <td class="n" style="color:var(--ink-500)">${fmt(unRow.C.open.length)}<small>đang mở</small></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            <td class="n">${fmtVnd(unRow.C.expected+unRow.C.realized)}</td><td></td><td></td><td></td><td></td></tr>`:''}
          <tr class="roi-tot"><td>Toàn hệ thống</td>
            <td class="n">${fmt(tot.valid)}</td><td class="n">${fmt(tot.hw)} nóng+ấm</td>
            <td class="n">${fmt(tot.resp)}</td><td class="n">${fmt(tot.booked)}</td><td class="n">${fmt(tot.closed)}</td><td class="n">${tot.deal?fmtVnd(tot.deal):'-'}</td>
            <td class="n">${fmtVnd(tot.fee)}</td><td class="n">${tot.valid?fmtVnd(tot.fee/tot.valid):'-'}</td><td class="n">${tot.hw?fmtVnd(tot.fee/tot.hw):'-'}</td>
            <td class="n" style="color:${tot.saveA>=0?'var(--success)':'var(--danger)'}">${tot.saveA<0?'−':''}${fmtVnd(Math.abs(tot.saveA))}<small>B: ${tot.saveB<0?'−':''}${fmtVnd(Math.abs(tot.saveB))}</small></td><td></td>
            <td class="n">${fmtVnd(tot.pipe)}</td><td class="n">${fmtVnd(tot.fc)}</td><td></td><td></td><td></td></tr>
          </tbody></table></div>
      </div>
      <div class="roi-picker">
        <span class="roi-mode-lb">Chi tiết &amp; tham số</span>
        ${brands.map(b=>`<button class="btn ${selBrand===b?'btn-primary':'btn-ghost'} btn-sm" data-roisel="${esc(b.code)}">${esc(b.name||b.code)}</button>`).join('')}
        <button class="btn ${roiSelBrand==='__default'?'btn-primary':'btn-ghost'} btn-sm" data-roisel="__default">Mặc định hệ thống</button>
      </div>
      ${selRow?`
        <h3 class="section-title mt-24">Chi tiết brand: ${esc(selBrand.name||selBrand.code)} ${selBrand.roi?'<span class="rl-tag2">Tham số riêng</span>':'<span class="rl-tag2">Đang dùng mặc định</span>'}${selRow.R.mode==='simple'?'<span class="rl-tag2">Chế độ đơn giản</span>':''}<span class="rl-tag2" title="${esc(roiFeeNote(selRow.fi))}">Phí gói: ${roiFeeTag(selRow.fi)}</span></h3>
        <div class="roi-acts"><button class="btn btn-soft btn-sm" data-roi-agy="${esc(selBrand.code)}">${SLI.chart} Xem vận hành ở Bảng brand</button><button class="btn ${roiPreview?'btn-primary':'btn-soft'} btn-sm" id="roiPreviewBtn">${SLI.eye} ${roiPreview?'Về góc nhìn quản trị':'Xem như khách'}</button></div>
        ${roiPreview?`<div class="roi-preview"><span class="roi-preview-lb">Đang xem đúng như admin/sales của brand này thấy · CPL theo ${roiBasisLabel(selRow.R.cplBasis)}</span>${roiBrandBlocks(selBrand, selRow.C, selRow.R, false)}</div>`:`
        ${roiModeSegHtml(selRow.R)}
        <div class="mt-12"></div>
        ${roiHeroHtml(selRow.C, selRow.R, true)}
        ${selRow.R.mode==='simple' ? roiSimpleBlock(selRow.C, selRow.R, true) : (roiKpisHtml(selRow.C, selRow.R, true)+roiCompareTempHtml(selRow.C, selRow.R)+roiStagesHtml(selRow.C))}
        ${roiEditorHtml(selRow.R, roiIndRowsOf(selRow.arr, selRow.R), 'Tham số riêng – '+esc(selBrand.name||selBrand.code), 'Lưu vào brands/'+esc(selBrand.code)+'.roi – chỉ áp dụng cho brand này, người dùng brand thấy ngay (realtime).'+(selRow.R.mode==='simple'?' Ở chế độ Đơn giản, các trường giá trị đơn/tỉ lệ chốt chỉ dùng khi chuyển sang Nâng cao.':''), {brandDoc:selBrand, C:selRow.C})}`}
      `:''}
      ${roiSelBrand==='__default'?(roiModeSegHtml(roiParamsFor(null))+'<div class="mt-12"></div>'+roiEditorHtml(roiParamsFor(null), roiIndRowsOf(D.leads||[], roiParamsFor(null)), 'Tham số MẶC ĐỊNH hệ thống', 'Lưu vào config/app.roi – áp cho mọi brand CHƯA có tham số riêng.', {brandDoc:null, C:null})):''}
      ${roiPreview?'':((selRow&&selRow.R.mode==='simple')?roiSimpleMethodHtml(selRow?selRow.R:null):roiMethodHtml(selRow?selRow.R:null))}`;
    // bind
    view.querySelectorAll('[data-roibrand]').forEach(tr=>tr.addEventListener('click',()=>{ roiSelBrand=tr.dataset.roibrand; roiPreview=false; views.roi(); document.getElementById('roiCfgCard')?.scrollIntoView({behavior:'smooth',block:'center'}); }));
    view.querySelectorAll('[data-roi-sort]').forEach(th=>th.addEventListener('click',()=>{ const k=th.dataset.roiSort; if(ROI_TB.sort===k) ROI_TB.dir=-ROI_TB.dir; else { ROI_TB.sort=k; ROI_TB.dir=(k==='name'||k==='basis')?1:-1; } views.roi(); }));
    view.querySelectorAll('[data-roisel]').forEach(b=>b.addEventListener('click',()=>{ roiSelBrand = (roiSelBrand===b.dataset.roisel)?null:b.dataset.roisel; roiPreview=false; views.roi(); }));
    view.querySelectorAll('[data-roi-agy]').forEach(b=>b.addEventListener('click',()=>{ AGY.sel=b.dataset.roiAgy; go('agency'); }));
    const ag=document.getElementById('roiAgency'); if(ag) ag.addEventListener('click',()=>go('agency'));
    const pv=document.getElementById('roiPreviewBtn'); if(pv) pv.addEventListener('click',()=>{ roiPreview=!roiPreview; views.roi(); });
    const csv=document.getElementById('roiCsv'); if(csv) csv.addEventListener('click',()=>{ const txt=roiCsvText(sorted); window.__roiCsv=txt; try{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})); a.download='smartlead-roi-brand-'+new Date(Date.now()+7*3600e3).toISOString().slice(0,10)+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000); toast('Đã tải bảng CSV ('+fmt(sorted.length)+' brand).'); }catch(e){ toast(errMsg(e)); } });
    view.querySelectorAll('[data-roi-plan]').forEach(a=>a.addEventListener('click',ev=>{ ev.preventDefault(); const code=a.dataset.roiPlan; go('users'); setTimeout(()=>{ const b=document.querySelector('[data-planprof="'+CSS.escape(code)+'"]'); if(b){ b.click(); b.scrollIntoView({behavior:'smooth',block:'center'}); } },450); }));
    view.querySelectorAll('input[name="roiFeeSrc"]').forEach(r=>r.addEventListener('change',()=>{ const inp=document.getElementById('roiFee'); if(inp) inp.disabled=(view.querySelector('input[name="roiFeeSrc"]:checked')||{}).value!=='custom'; }));
    if(selBrand) roiBindModeSeg({type:'brand', code:selBrand.code, roi:selBrand.roi});
    else if(roiSelBrand==='__default') roiBindModeSeg({type:'global', roi:(D&&D.roi)||null});
    const saveBtn=document.getElementById('roiSave');
    if(saveBtn) saveBtn.addEventListener('click',()=>{
      const patch=roiCollectPatch();
      if(roiSelBrand && roiSelBrand!=='__default'){
        const code=roiSelBrand;
        const apply=()=>{ const b=(D.brands||[]).find(x=>x.code===code); if(b) b.roi=patch; toast('Đã lưu tham số riêng cho brand.'); views.roi(); };
        if(window.SL_FB&&window.SL_FB.setBrandRoi){ window.SL_FB.setBrandRoi(code,patch).then(apply).catch(e=>toast(errMsg(e))); }
        else { apply(); }
      } else {
        if(window.SL_FB&&window.SL_FB.setConfig){ window.SL_FB.setConfig({roi:patch}).then(()=>{ if(D) D.roi=patch; toast('Đã lưu tham số mặc định hệ thống.'); views.roi(); }).catch(e=>toast(errMsg(e))); }
        else { if(D) D.roi=patch; toast('Demo – đã áp dụng.'); views.roi(); }
      }
    });
  }
  const ROI_TB={sort:'saveA',dir:-1}; // v119-87: sắp xếp bảng toàn cảnh
  let roiPreview=false; // v119-87: "Xem như khách"
"""
s=rd(R40); wr(R40, s[:i]+super_new+s[j:]); lib._log.append('superview 40-roi rewrite')
# roiMethodHtml() gọi ở chỗ khác? (đã đổi hết trong super/brand) — kiểm không còn gọi không đối số
if re.search(r"roiMethodHtml\(\)|roiSimpleMethodHtml\(\)", rd(R40)): lib._err('còn gọi roiMethodHtml() không đối số')

# ---------- 25-agency: agyWinFor + chi tiết brand có Gói + nút Tài chính ----------
rep(A25, """  function agyRow(b,IX){""",
"""  /* v119-87: cửa sổ đếm 30 ngày cho 1 brand — DÙNG CHUNG với trang Giá trị & ROI (bộ đếm máy chủ; chưa có → ước tính từ lead đã nạp) */
  function agyWinFor(code,nDays,shift,IX){ IX=IX||agyIndex(); code=String(code||''); const b=(D.brands||[]).find(x=>String(x.code||'')===code)||{};
    const bad=(typeof b.slaBadMin==='number'&&b.slaBadMin>0)?b.slaBadMin:(D.slaBad||60);
    return IX.active?agyStatsWin(IX.stats.get(code)||[],nDays,shift):agyLeadWin(IX.leads.get(code)||[],nDays,shift,bad); }
  function agyRow(b,IX){""", tag='agy.winfor')
rep(A25, """        <div class="agy-acts"><button class="btn btn-soft btn-sm" data-agy-wiz="${esc(code)}">${SLI.bolt} Thiết lập</button>""",
         """        <div class="agy-acts"><button class="btn btn-soft btn-sm" data-agy-roi="${esc(code)}" title="Tài chính · CPL · phí gói ở trang Giá trị & ROI">${SLI.coins} Tài chính</button><button class="btn btn-soft btn-sm" data-agy-wiz="${esc(code)}">${SLI.bolt} Thiết lập</button>""", tag='agy.btn')
rep(A25, """          <div class="agy-kv"><span>Hồ sơ AI</span><b>${b.ai&&b.ai.nganh?esc(b.ai.nganh):'<span class="agy-na">chưa khai báo</span>'}</b></div>""",
"""          <div class="agy-kv"><span>Hồ sơ AI</span><b>${b.ai&&b.ai.nganh?esc(b.ai.nganh):'<span class="agy-na">chưa khai báo</span>'}</b></div>
          ${(()=>{ const R=roiParamsFor(b), fi=roiFeeInfo(b,R); const pl=fi.plan||{}; return `<div class="agy-kv"><span>Gói giải pháp</span><b>${fi.src==='plan'?(esc(pl.tier||'Gói')+' · '+esc(fmtVnd(fi.fee))+'/tháng'+(fi.expired?' · <span style="color:var(--hot)">hết hạn '+esc(pl.to)+'</span>':(fi.soon?' · còn '+fi.daysLeft+' ngày':''))):('<span class="agy-na">chưa cấp gói</span> · phí '+esc(fmtVnd(R.fee))+' ('+(fi.src==='custom'||fi.src==='brand'?'riêng':'mặc định')+')')}</b></div>`; })()}""", tag='agy.plan')
rep(A25, """      view.querySelectorAll('[data-agy-close]').forEach(b=>b.addEventListener('click',()=>{ AGY.sel=''; views.agency(); }));""",
         """      view.querySelectorAll('[data-agy-close]').forEach(b=>b.addEventListener('click',()=>{ AGY.sel=''; views.agency(); }));
      view.querySelectorAll('[data-agy-roi]').forEach(b=>b.addEventListener('click',()=>{ roiSelect(b.dataset.agyRoi); go('roi'); })); // v119-87: sang trang Giá trị & ROI đúng brand""", tag='agy.bind')
rep(A25, """    if(AGY.sel){ const b=(D.brands||[]).find(x=>x.code===AGY.sel)||{}; s+='@'+((b.ai&&b.ai.nganh)||'')+'|'""",
         """    if(AGY.sel){ const b=(D.brands||[]).find(x=>x.code===AGY.sel)||{}; s+='@'+((b.ai&&b.ai.nganh)||'')+'|'+JSON.stringify(b.plan||null)+JSON.stringify(b.roi||null)+'|'""", tag='agy.sig')

# ---------- CSS ----------
s=rd(CSS)
if '.roi-fee {' in s: lib._err('CSS v119-87 đã có')
else:
    wr(CSS, s.rstrip('\n')+"""

/* ===== v119-87: Toàn cảnh brand (Giá trị & ROI, super) ===== */
.roi-tbl.roi-wide th, .roi-tbl.roi-wide td { white-space: nowrap; padding-left: 10px; padding-right: 10px; }
.roi-tbl.roi-wide td { padding-top: 9px; padding-bottom: 9px; font-size: 12px; }
.roi-tbl.roi-wide th:first-child, .roi-tbl.roi-wide td:first-child { position: sticky; left: 0; z-index: 1; background: var(--card, #fff); padding-left: 22px; box-shadow: 1px 0 0 var(--line, #E8EBF3); }
.roi-tbl.roi-wide tr.sel td:first-child { background: var(--brand-25, #F4F6FF); box-shadow: inset 2px 0 0 var(--brand-600, #1B2DCC), 1px 0 0 var(--line, #E8EBF3); }
.roi-tbl.roi-wide tr.roi-tot td:first-child { background: var(--card, #fff); }
.roi-tbl.roi-wide tr.off td { opacity: .55; }
.roi-tbl.roi-wide .roi-flags { display: flex; flex-wrap: wrap; gap: 3px; margin: 3px 0 0 18px; }
.roi-tbl.roi-wide .roi-flags .roi-flag { margin-left: 0; }
.roi-tbl.roi-wide tr.off td:first-child { opacity: 1; color: var(--ink-400); }
.roi-tbl thead tr.grp th { font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-400); text-align: center; padding-bottom: 2px; border-bottom: 0; }
.roi-tbl thead tr.grp th:first-child { text-align: left; }
.roi-tbl th[data-roi-sort] { cursor: pointer; user-select: none; }
.roi-tbl th[data-roi-sort]:hover, .roi-tbl th[data-roi-sort].on { color: var(--brand-600, #1B2DCC); }
.roi-tbl td small { display: block; font-size: 10.5px; line-height: 1.3; color: var(--ink-400); font-weight: 400; }
.roi-tbl td .roi-d { display: inline-block; }
.roi-d { font-size: 10.5px; font-weight: 700; margin-left: 5px; }
.roi-d.up { color: var(--success, #047857); }
.roi-d.down { color: var(--danger, #DC2626); }
.roi-flag { display: inline-block; margin-left: 5px; padding: 1px 6px; border-radius: 999px; font-size: 10.5px; font-weight: 600; background: var(--surface-2, #F3F4F8); color: var(--ink-500); vertical-align: 1px; white-space: nowrap; }
.roi-flag.bad { background: #FEE2E2; color: #B91C1C; }
.roi-flag.warn { background: #FEF3C7; color: #92400E; }
.roi-acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.rl-head .roi-acts { margin-left: auto; }
.rl-alt { margin-top: 6px; font-size: 12px; color: var(--ink-500); }
.roi-fee { margin-top: 16px; padding: 14px 16px; border: 1px solid var(--border-1, #E5E9F2); border-radius: 12px; background: var(--surface-1, #FAFBFF); }
.roi-fee-t { font-size: 12.5px; font-weight: 700; color: var(--ink-600); margin-bottom: 8px; }
.roi-fee-opt { display: flex; align-items: center; gap: 8px; font-size: 13px; margin: 6px 0; flex-wrap: wrap; cursor: pointer; }
.roi-fee-opt input[type=radio] { width: 15px; height: 15px; }
.roi-fee-opt a { color: var(--brand-600, #1B2DCC); font-weight: 600; text-decoration: none; margin-left: 4px; white-space: nowrap; }
.roi-fee-hint { font-size: 11.5px; color: var(--ink-400); margin-top: 6px; line-height: 1.5; }
.roi-preview { position: relative; margin-top: 12px; padding: 18px 14px 14px; border: 1.5px dashed var(--brand-300, #A8B4F5); border-radius: 14px; }
.roi-preview-lb { position: absolute; top: -10px; left: 14px; padding: 0 8px; background: var(--surface-0, #fff); font-size: 11px; font-weight: 700; color: var(--brand-600, #1B2DCC); }
""")
    lib._log.append('css v119-87')

# ---------- ESM import/export ----------
if ESM:
    rep(R40, "import { D, SLI, errMsg, fmt, parseTS, slNow, slPrompt, tempLabel, view, views } from './10-core-overview.js';",
             "import { D, SLI, errMsg, fmt, go, parseTS, slNow, slPrompt, tempLabel, view, views } from './10-core-overview.js';\nimport { AGY, agyIndex, agyRowsRaw, agyWinFor } from './25-agency.js';", tag='esm.40.import')
    rep(R40, "export { fmtVnd, roiParamsFor };", "export { fmtVnd, roiFeeInfo, roiParamsFor, roiSelect };", tag='esm.40.export')
    rep(A25, "import { fmtVnd } from './40-roi.js';", "import { fmtVnd, roiFeeInfo, roiParamsFor, roiSelect } from './40-roi.js';", tag='esm.25.import')
    rep(A25, "export { AGY, agencyCard };", "export { AGY, agencyCard, agyIndex, agyRowsRaw, agyWinFor };", tag='esm.25.export')

# ---------- smoke ----------
rep(S, """  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
  await browser.close(); server.close();""", """  /* v119-87: toàn cảnh brand (super) — bảng 5 nhóm cột + CPL 2 cách + phí gói theo Gói giải pháp + sắp xếp + CSV + cplBasis cho khách + Xem như khách */
  await page.evaluate(() => { location.hash = 'roi'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const k87a = await page.evaluate(() => { const v = document.getElementById('view'); const D = window.SL_DATA; const b0 = D.brands[0];
    b0.plan = { tier: 'Gói Pro', price: 36000000, cycle: 'quy', from: '2026-01-01', to: '2027-12-31' }; delete b0.roi;
    const now = Date.now(); const inj = [[92, 'hot'], [85, 'hot'], [70, 'warm'], [50, 'cold']].map((x, i) => ({ id: 'K87L' + i, name: 'K87 lead ' + i, score: x[0], temp: x[1], stage: 'new', brand: b0.code, detected_at: new Date(now - (i + 1) * 3600e3).toISOString(), text: '', source: 'x', assignee: '' })); D.leads = inj.concat(D.leads); window.SLApp.reload(D);
    const ths = [...v.querySelectorAll('.roi-tbl thead tr:last-child th')].map(t => t.textContent.trim()); const grp = [...v.querySelectorAll('.roi-tbl thead tr.grp th')].map(t => t.textContent.trim()).filter(Boolean);
    const row = v.querySelector('tr[data-roibrand="' + b0.code + '"]'); const cells = row ? [...row.querySelectorAll('td')].map(td => td.textContent.replace(/\\s+/g, ' ').trim()) : [];
    const tot = (v.querySelector('tr.roi-tot') || {}).textContent || ''; const strip = (v.querySelector('.rl-strip') || {}).textContent || '';
    return { code: b0.code, nTh: ths.length, grp, fee: cells[7] || '', cplA: cells[8] || '', cplB: cells[9] || '', save: cells[10] || '', basis: cells[11] || '', tot: /Toàn hệ thống/.test(tot), strip: /Lead hợp lệ 30 ngày/.test(strip) && /Tổng phí gói/.test(strip) && /Gói giải pháp/.test(strip) }; });
  (k87a.nTh === 17 && k87a.grp.join('|') === 'Khối lượng|Kết quả|Tài chính|Giá trị|Vận hành' && /12 tr₫/.test(k87a.fee) && /Gói/.test(k87a.fee) && /quý/.test(k87a.fee) && /₫/.test(k87a.cplA) && /₫/.test(k87a.cplB) && /B:/.test(k87a.save) && /hợp lệ/.test(k87a.basis) && k87a.tot && k87a.strip)
    ? ok('v119-87: bảng toàn cảnh 17 cột · 5 nhóm · phí gói 36 tr/quý → 12 tr₫/tháng (Gói) · CPL hợp lệ ' + k87a.cplA + ' · nóng+ấm ' + k87a.cplB + ' · tiết kiệm kèm B · khách thấy "' + k87a.basis + '"') : fail('v119-87 bảng: ' + JSON.stringify(k87a));
  const k87b = await page.evaluate(() => { const v = document.getElementById('view'); const first = () => (v.querySelector('tr[data-roibrand]') || {}).dataset || {}; const f0 = first().roibrand;
    const th = v.querySelector('th[data-roi-sort="name"]'); th.click(); const f1 = (document.querySelector('#view tr[data-roibrand]') || {}).dataset.roibrand; document.querySelector('#view th[data-roi-sort="name"]').click(); const f2 = (document.querySelector('#view tr[data-roibrand]') || {}).dataset.roibrand;
    const names = [...document.querySelectorAll('#view tr[data-roibrand] .bnm')].map(e => e.textContent); const desc = names.slice().sort((a, b) => b.localeCompare(a)); return { f0, f1, f2, sortedDesc: names.join('|') === desc.join('|'), on: !!document.querySelector('#view th[data-roi-sort="name"].on') }; });
  (k87b.f1 !== k87b.f2 && k87b.sortedDesc && k87b.on) ? ok('v119-87: bấm tiêu đề cột sắp xếp (Brand A→Z rồi Z→A, cột đang sắp có dấu)') : fail('v119-87 sort: ' + JSON.stringify(k87b));
  await page.evaluate(() => { document.querySelector('#view tr[data-roibrand]').click(); }); await page.waitForTimeout(400);
  const k87c = await page.evaluate(() => { const v = document.getElementById('view'); const sel = v.querySelector('#roiCplBasis'); const radio = v.querySelector('input[name="roiFeeSrc"][value="plan"]'); const fee = v.querySelector('#roiFee');
    const both = [...v.querySelectorAll('.rls-nt')].some(e => /mọi lead hợp lệ .* · nóng\\+ấm/.test(e.textContent)); const alt = !!v.querySelector('.rl-alt'); sel.value = 'hotwarm'; v.querySelector('#roiSave').click();
    return { hasSel: !!sel, planChecked: !!(radio && radio.checked), feeDisabled: !!(fee && fee.disabled), both, alt, preview: !!v.querySelector('#roiPreviewBtn') }; });
  await page.waitForTimeout(400);
  const k87d = await page.evaluate(() => { const v = document.getElementById('view'); const D = window.SL_DATA; const b0 = D.brands.find(b => b.roi && b.roi.cplBasis === 'hotwarm'); const cell = b0 ? (v.querySelector('tr[data-roibrand="' + b0.code + '"] td:nth-child(12)') || {}).textContent : '';
    const eq = (v.querySelector('h3.section-title ~ .rl-card .rl-eq, .rl-state .rl-eq') || {}).textContent || ''; v.querySelector('#roiPreviewBtn').click();
    return { saved: !!b0, feeSrc: b0 && b0.roi.feeSrc, cell: (cell || '').trim(), eqHW: [...v.querySelectorAll('.rl-state')].some(e => /lead nóng\\+ấm/.test(e.textContent)) }; });
  await page.waitForTimeout(400);
  const k87e = await page.evaluate(() => { const v = document.getElementById('view'); const pv = v.querySelector('.roi-preview'); const lb = (v.querySelector('.roi-preview-lb') || {}).textContent || '';
    const noEditor = !v.querySelector('#roiCfgCard'); const pr = pv ? pv.querySelectorAll('.rl-pr').length : 0; const oneCpl = pv ? [...pv.querySelectorAll('.rls-nt')].filter(e => /nóng\\+ấm 30 ngày/.test(e.textContent)).length : 0;
    v.querySelector('#roiPreviewBtn').click(); return { pv: !!pv, lb: /nóng \\+ ấm/.test(lb), noEditor, pr, oneCpl }; });
  await page.waitForTimeout(300);
  const k87f = await page.evaluate(() => { const v = document.getElementById('view'); const back = !!v.querySelector('#roiCfgCard'); const uo = URL.createObjectURL; URL.createObjectURL = () => 'blob:x'; let clicked = 0; const a0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { clicked++; }; v.querySelector('#roiCsv').click(); HTMLAnchorElement.prototype.click = a0; URL.createObjectURL = uo;
    const csv = window.__roiCsv || ''; const lines = csv.split('\\n'); return { back, clicked, bom: csv.charCodeAt(0) === 0xFEFF, head: lines[0] || '', n: lines.length - 1, brands: window.SL_DATA.brands.length }; });
  (k87c.hasSel && k87c.planChecked && k87c.feeDisabled && k87c.both && k87c.alt && k87c.preview && k87d.saved && k87d.feeSrc === 'plan' && /nóng \\+ ấm/.test(k87d.cell) && k87d.eqHW)
    ? ok('v119-87: editor có radio Gói giải pháp (ô nhập riêng khoá) + chọn "khách thấy" → lưu → bảng "nóng + ấm", hero tính theo nóng+ấm; super thấy cả 2 cách') : fail('v119-87 editor: ' + JSON.stringify({ k87c, k87d }));
  (k87e.pv && k87e.lb && k87e.noEditor && k87e.pr >= 5 && k87e.oneCpl === 1 && k87f.back) ? ok('v119-87: "Xem như khách" hiện đúng khối brand user (1 cách CPL nóng+ấm, không editor) rồi về góc nhìn quản trị') : fail('v119-87 preview: ' + JSON.stringify({ k87e, back: k87f.back }));
  (k87f.clicked === 1 && k87f.bom && /^\\uFEFF?"Brand","Mã","Lead hợp lệ 30n"/.test(k87f.head) && k87f.n === k87f.brands) ? ok('v119-87: xuất CSV ' + k87f.n + ' brand (BOM UTF-8, đúng tiêu đề)') : fail('v119-87 csv: ' + JSON.stringify(k87f));
  await page.evaluate(() => { const D = window.SL_DATA; const b0 = D.brands.find(b => b.roi && b.roi.cplBasis === 'hotwarm'); if (b0) delete b0.roi; delete D.brands[0].plan; D.leads = D.leads.filter(l => !/^K87L/.test(String(l.id || ''))); });
  await page.evaluate(() => { location.hash = 'agency'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(400);
  await page.evaluate(() => { const r = document.querySelector('#view tr[data-agy-row]'); if (r) r.click(); }); await page.waitForTimeout(400);
  const k87g = await page.evaluate(() => { const d = document.getElementById('agyDetail'); const kv = d ? [...d.querySelectorAll('.agy-kv span')].map(e => e.textContent) : []; const btn = d && d.querySelector('[data-agy-roi]'); const code = btn && btn.dataset.agyRoi; if (btn) btn.click(); return { kv: kv.includes('Gói giải pháp'), btn: !!btn, code }; });
  await page.waitForTimeout(500);
  const k87h = await page.evaluate(() => ({ hash: location.hash, sel: !!document.querySelector('#view h3.section-title'), title: (document.querySelector('#view h3.section-title') || {}).textContent || '' }));
  (k87g.kv && k87g.btn && k87h.hash === '#roi' && k87h.sel && k87h.title.indexOf('Chi tiết brand') >= 0) ? ok('v119-87: Bảng brand có dòng Gói giải pháp + nút Tài chính → sang ROI đúng brand (' + k87g.code + ')') : fail('v119-87 qua lại: ' + JSON.stringify({ k87g, k87h }));
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
  await browser.close(); server.close();""", tag='smoke.k87')
done()
