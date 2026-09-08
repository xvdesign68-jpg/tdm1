# m12.py <cây> — v119-70 / v120-esm-t (08/09, anh: "quá trình đang tải khi mới vào vẫn lâu"): rút NGẮN đường găng khởi động.
# Áp lên v119-69 / v120-esm-s (sau m11). Fail-closed nguyên tử. DRY=1 kiểm mốc.
#  (1) Kênh lõi cho lần vẽ đầu chỉ còn leads + sources + config (3 kênh nhỏ); scans (1.000 doc) và lượt admin chỉ CHỜ MỀM ≤500 ms.
#  (2) Lead: chờ bản máy chủ tối đa 600 ms sau bản cache (trước 1,2 s).
#  (3) Đăng ký kênh dữ liệu NGAY khi có hồ sơ user (song song với tạo/vá hồ sơ + lấy tên brand; trước: 2 lượt getDoc máy chủ tuần tự rồi mới đăng ký).
#  (4) Lần vẽ đầu chỉ khi vai trò đã áp lên giao diện (SL_ROLE_APPLIED) → không vẽ 2 lần.
#  (5) Thống kê khởi động: window.SL_BOOT + 1 dòng console "[SmartLead] khởi động…" lúc vẽ lần đầu (mốc ms từng bước + thời gian tải SDK/app.js) để đo trên máy người dùng.
#  (6) Màn chờ logo nằm TRÊN cổng auth (z 10000 > 9999) → lúc chờ thấy logo, không phải spinner trần.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
L = 'assets/js/live.js'
rep(L, "const C = window.SL_CONFIG || {};",
"""const C = window.SL_CONFIG || {};
/* v119-70: thống kê khởi động — mốc ms từ lúc mở trang (performance.now) để soi "vào trang lâu" ngay trên máy người dùng: window.SL_BOOT + 1 dòng console khi vẽ lần đầu */
const BOOT={ sdk: Math.round(performance.now()) }; window.SL_BOOT=BOOT;
const bootMark=(k)=>{ if(BOOT[k]===undefined) BOOT[k]=Math.round(performance.now()); };""", tag='live.bootstats')
rep(L, "  let liveReady=false, bootDeadline=Date.now()+7000, leadsSrv=false, leadsCacheAt=0; const chanSeen={};",
       "  let liveReady=false, bootDeadline=Date.now()+7000, leadsSrv=false, leadsCacheAt=0, coreAt=0; const chanSeen={};", tag='live.state')
rep(L, "  function chanOk(name){ chanOkAt[name]=Date.now(); chanSeen[name]=1;", "  function chanOk(name){ chanOkAt[name]=Date.now(); if(!chanSeen[name]){ chanSeen[name]=1; bootMark('kênh '+name); }", tag='live.chanOk')
rep(L, "chanOk('leads'); if(!snap.metadata.fromCache){ fbUp(); leadsSrv=true; } else if(!leadsCacheAt) leadsCacheAt=Date.now();",
       "chanOk('leads'); if(!snap.metadata.fromCache){ fbUp(); leadsSrv=true; bootMark('leads máy chủ'); } else if(!leadsCacheAt){ leadsCacheAt=Date.now(); bootMark('leads cache'); }", count=2, tag='live.leadsMark')
rep(L, "    if(!liveReady){ bootDeadline=Date.now()+7000; leadsSrv=false; leadsCacheAt=0; Object.keys(chanSeen).forEach(k=>delete chanSeen[k]); }",
       "    if(!liveReady){ bootDeadline=Date.now()+7000; leadsSrv=false; leadsCacheAt=0; coreAt=0; Object.keys(chanSeen).forEach(k=>delete chanSeen[k]); bootMark('đăng ký kênh'); }", tag='live.start')
rep(L, """  function coreReady(){
    if(!(chanSeen.leads && chanSeen.sources && chanSeen.config && chanSeen.scans)) return false;
    if(!leadsSrv && chanSeen.leads!=='err' && !(leadsCacheAt && Date.now()-leadsCacheAt>1200)) return false;
    if(curRole==='superadmin' && !adminLast) return false;
    return true;
  }""",
"""  function coreReady(){
    if(!window.SL_ROLE_APPLIED) return false;                                   // v119-70: vai trò đã áp lên giao diện (SLAuth.show('app')) → không vẽ 2 lần
    if(!(chanSeen.leads && chanSeen.sources && chanSeen.config)) return false;  // v119-70: kênh lõi = 3 kênh nhỏ (scans 1.000 doc + lượt admin chỉ chờ mềm bên dưới)
    if(!leadsSrv && chanSeen.leads!=='err' && !(leadsCacheAt && Date.now()-leadsCacheAt>600)) return false; // lead: bản máy chủ, hoặc 600 ms sau bản cache
    if(!coreAt) coreAt=Date.now();
    const soft = !!chanSeen.scans && (curRole!=='superadmin' || !!adminLast);
    return soft || Date.now()-coreAt>500;                                       // chờ mềm ≤500 ms cho scans/admin (đỡ nhảy bố cục) rồi vẽ
  }""", tag='live.coreReady')
rep(L, """      if(first && window.SLAuth && window.SLAuth.reveal){ window.SLAuth.reveal(); console.info('[SmartLead] vẽ lần đầu bằng dữ liệu thật sau '+(Date.now()-(bootDeadline-7000))+' ms'+(leadsSrv?' (lead từ máy chủ)':' (lead từ cache)')); } // v119-69""",
"""      if(first && window.SLAuth && window.SLAuth.reveal){ window.SLAuth.reveal(); bootMark('vẽ lần đầu'); // v119-69
        try{ const b=window.SL_BOOT||{}; const rs=((performance.getEntriesByType&&performance.getEntriesByType('resource'))||[]).filter(r=>/firebasejs|app\\.min\\.js|live\\.min\\.js/.test(r.name)).map(r=>r.name.replace(/.*\\//,'').replace(/\\?.*/,'')+' '+Math.round(r.duration)+'ms'+(r.transferSize===0?' (cache)':'')).join(' · ');
          console.info('[SmartLead] khởi động (ms từ lúc mở trang): '+Object.keys(b).map(k=>k+' '+b[k]).join(' · ')+(leadsSrv?' · lead từ máy chủ':' · lead từ cache')+' | tải: '+rs); }catch(_){} } // v119-70: dán dòng này cho em khi thấy chậm""", tag='live.paintlog')
# (3) hồ sơ user: đăng ký listener NGAY, tạo/vá hồ sơ song song; startData trước khi lấy tên brand
rep(L, """  async function onAuthChanged(user){
    if(userUnsub){ try{userUnsub();}catch(e){} userUnsub=null; }""",
"""  async function onAuthChanged(user){
    bootMark('auth'); // v119-70
    if(userUnsub){ try{userUnsub();}catch(e){} userUnsub=null; }""", tag='live.authMark')
rep(L, """    // Tạo hồ sơ user lần đầu (super admin → toàn quyền; còn lại → chờ duyệt)
    try{
      const snap=await getDoc(uref);""",
"""    // Tạo hồ sơ user lần đầu (super admin → toàn quyền; còn lại → chờ duyệt)
    /* v119-70: chạy SONG SONG với listener hồ sơ bên dưới (trước: await getDoc máy chủ xong mới onSnapshot → mất 1 lượt máy chủ trước khi đăng ký kênh dữ liệu) */
    (async()=>{ try{
      const snap=await getDoc(uref);""", tag='live.profile.open')
rep(L, """    }catch(e){ console.warn('[SmartLead] khởi tạo hồ sơ user lỗi:', e.message); }
    // Lắng nghe hồ sơ của chính mình (vai trò có thể bị super admin đổi realtime)
    userUnsub=onSnapshot(uref, async (d)=>{
      const data=d.exists()?d.data():{};""",
"""    }catch(e){ console.warn('[SmartLead] khởi tạo hồ sơ user lỗi:', e.message); } })();
    // Lắng nghe hồ sơ của chính mình (vai trò có thể bị super admin đổi realtime)
    userUnsub=onSnapshot(uref, async (d)=>{
      if(!d.exists() && d.metadata && d.metadata.fromCache) return; // v119-70: cache chưa có hồ sơ → chờ bản máy chủ (đừng hiện "chờ duyệt" nhầm)
      bootMark('hồ sơ user');
      const data=d.exists()?d.data():{};""", tag='live.profile.close')
rep(L, """      // Lấy tên hiển thị của brand (rules cho phép user đọc đúng brand của mình).
      if(brand){
        try{ const bd=await getDoc(doc(db,'brands',brand)); profile.brandName=(bd.exists()&&bd.data().name)?bd.data().name:brand; }
        catch(e){ profile.brandName=brand; }
      } else { profile.brandName=''; }
      if(window.SLAuth) window.SLAuth.show('app', profile, role);
      // v53: đăng ký phiên đăng nhập của thiết bị này (1 lần mỗi lượt tải trang) + heartbeat 10 phút
      if(!sessionReg){ sessionReg=true; signingOut=false; registerSession(user.uid, sess); startHeartbeat(user.uid); }
      // v90: TRƯỚC ĐÂY mỗi thay đổi doc user của chính mình (heartbeat 10 phút, đăng ký phiên, sửa hồ sơ...)
      //      đều gọi startData() → gỡ & đăng ký lại TOÀN BỘ listener → loạt snapshot dội về → cả trang vẽ lại
      //      → chính là cảm giác "web tự load lại trang". Giờ CHỈ khởi động lại khi vai trò/brand thật sự đổi.
      // v103: khung xem lead RIÊNG của user (đè khung brand) - đưa vào dataKey để đổi khung là nạp lại lead ngay
      const uwF=(data.leadFromAt&&data.leadFromAt.toMillis)?data.leadFromAt.toMillis():0;
      const uwT=(data.leadToAt&&data.leadToAt.toMillis)?data.leadToAt.toMillis():0;
      const dk=role+'|'+(brand||'')+'|'+uwF+'_'+uwT;
      if(dk!==dataKey){ startData(role, brand||null, (uwF||uwT)?{from:uwF,to:uwT}:null); dataKey=dk; rebuild(); }
      else rebuild([]); // hồ sơ/heartbeat đổi → chỉ cập nhật ngầm, không vẽ lại""",
"""      // v90: TRƯỚC ĐÂY mỗi thay đổi doc user của chính mình (heartbeat 10 phút, đăng ký phiên, sửa hồ sơ...)
      //      đều gọi startData() → gỡ & đăng ký lại TOÀN BỘ listener → loạt snapshot dội về → cả trang vẽ lại
      //      → chính là cảm giác "web tự load lại trang". Giờ CHỈ khởi động lại khi vai trò/brand thật sự đổi.
      // v103: khung xem lead RIÊNG của user (đè khung brand) - đưa vào dataKey để đổi khung là nạp lại lead ngay
      /* v119-70: đăng ký kênh dữ liệu TRƯỚC, tên brand lấy song song (trước: chờ getDoc brands rồi mới đăng ký) — show('app') chỉ áp vai trò, lần vẽ đầu chờ dữ liệu */
      const uwF=(data.leadFromAt&&data.leadFromAt.toMillis)?data.leadFromAt.toMillis():0;
      const uwT=(data.leadToAt&&data.leadToAt.toMillis)?data.leadToAt.toMillis():0;
      const dk=role+'|'+(brand||'')+'|'+uwF+'_'+uwT;
      if(dk!==dataKey){ startData(role, brand||null, (uwF||uwT)?{from:uwF,to:uwT}:null); dataKey=dk; rebuild(); }
      else rebuild([]); // hồ sơ/heartbeat đổi → chỉ cập nhật ngầm, không vẽ lại
      // Lấy tên hiển thị của brand (rules cho phép user đọc đúng brand của mình).
      if(brand){
        try{ const bd=await getDoc(doc(db,'brands',brand)); profile.brandName=(bd.exists()&&bd.data().name)?bd.data().name:brand; }
        catch(e){ profile.brandName=brand; }
      } else { profile.brandName=''; }
      if(window.SLAuth) window.SLAuth.show('app', profile, role);
      // v53: đăng ký phiên đăng nhập của thiết bị này (1 lần mỗi lượt tải trang) + heartbeat 10 phút
      if(!sessionReg){ sessionReg=true; signingOut=false; registerSession(user.uid, sess); startHeartbeat(user.uid); }""", tag='live.reorder')
A80 = 'src/app/80-rbac-auth.js'
rep(A80, "        if(window.SL_LIVE_BOOT && !window.SL_LIVE_READY){ APP_SHOWN_SIG=null; applyRoleUI(); return; }",
         "        if(window.SL_LIVE_BOOT && !window.SL_LIVE_READY){ APP_SHOWN_SIG=null; applyRoleUI(); window.SL_ROLE_APPLIED=true; return; } // v119-70: cờ cho live.js vẽ lần đầu", tag='rbac.flag1')
rep(A80, """        gate.classList.remove('show'); gate.innerHTML='';
        applyRoleUI();""", """        gate.classList.remove('show'); gate.innerHTML='';
        applyRoleUI(); window.SL_ROLE_APPLIED=true;""", tag='rbac.flag2')
rep('assets/css/app.css', "#loading-screen {\n  position: fixed; inset: 0; z-index: var(--z-max);", "#loading-screen {\n  position: fixed; inset: 0; z-index: 10000; /* v119-70: trên cả cổng auth (9999) → lúc chờ thấy logo, không phải spinner trần */", tag='css.loading')
done()
