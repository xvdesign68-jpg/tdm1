# m11.py <cây> — v119-69 / v120-esm-s (08/09): KHỞI ĐỘNG SẠCH ở chế độ Firebase — không vẽ dữ liệu demo, giữ màn chờ tới khi
# các kênh lõi (leads/sources/config/scans, super thêm lượt admin đầu) có dữ liệu và lead đã có bản MÁY CHỦ (hoặc quá 1,2 s sau
# bản cache) rồi vẽ ĐÚNG 1 LẦN (tối đa 7 s), + modulepreload 4 module SDK Firebase để tải song song với app.js.
# Trước: vẽ demo ngay → cổng auth mở → demo đếm số → màn chờ tắt sau 600 ms cứng → 250 ms sau ĐỢT snapshot cuối mới có số thật
# (anh thấy "số gì đó 1–2 giây rồi mới đúng"). Áp lên v119-68 / v120-esm-r. Fail-closed nguyên tử (lib.py 2 pha). DRY=1 kiểm mốc.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
# ---- app.html: modulepreload SDK + màn chờ theo tín hiệu sẵn sàng ----
rep('app.html', '<link rel="preconnect" href="https://www.gstatic.com" crossorigin />',
    '<link rel="preconnect" href="https://www.gstatic.com" crossorigin />\n'
    '<link rel="modulepreload" href="https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js" />\n'
    '<link rel="modulepreload" href="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js" />\n'
    '<link rel="modulepreload" href="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js" />\n'
    '<link rel="modulepreload" href="https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js" />', tag='html.preload')
rep('app.html', """  var ls = document.getElementById('loading-screen');
  if (ls) setTimeout(function() { ls.style.opacity='0'; ls.style.transition='opacity .4s ease'; setTimeout(function(){ls.remove();},400); }, 600);""",
"""  var ls = document.getElementById('loading-screen'); if (!ls) return;
  var done = false; function hide(){ if (done) return; done = true; ls.style.opacity='0'; ls.style.transition='opacity .25s ease'; setTimeout(function(){ ls.remove(); }, 260); }
  /* v119-69: chế độ Firebase giữ màn chờ tới khi dữ liệu thật vẽ xong lần đầu hoặc cần đăng nhập (sự kiện sl-boot-done); trần 15 s khớp watchdog. Demo: 600 ms như cũ. */
  if (window.SL_CONFIG && window.SL_CONFIG.MODE === 'firebase') { document.addEventListener('sl-boot-done', hide); setTimeout(hide, 15000); }
  else setTimeout(hide, 600);""", tag='html.loading')
# ---- 90-boot: chế độ Firebase không vẽ demo lúc khởi động ----
rep('src/app/90-boot.js', """  recount();
  initAssistant();
  const start = (window.location.hash||'').replace('#','') || 'overview';
  go(meta[start]?start:'overview');
  renderTicker();
  // Chế độ Firebase: hiện màn chờ tới khi xác thực xong (live.js gọi SLAuth.show theo trạng thái đăng nhập).
  if(window.SL_CONFIG && window.SL_CONFIG.MODE==='firebase' && window.SLAuth){ window.SLAuth.show('loading'); }""",
"""  initAssistant();
  const start = (window.location.hash||'').replace('#','') || 'overview';
  /* v119-69: chế độ Firebase KHÔNG vẽ dữ liệu demo lúc khởi động — màn chờ giữ tới khi dữ liệu thật sẵn sàng (live.js → SLAuth.reveal)
     → vẽ đúng 1 lần bằng số thật; hết cảnh số demo/số cache cũ chạy đếm rồi nhảy sang số thật. Demo: như cũ. */
  const LIVE_BOOT = !!(window.SL_CONFIG && window.SL_CONFIG.MODE==='firebase');
  window.SL_LIVE_BOOT = LIVE_BOOT;
  if(!LIVE_BOOT){ recount(); go(meta[start]?start:'overview'); renderTicker(); }
  else if(window.SLAuth){ window.SLAuth.show('loading'); }""", tag='boot.init')
# ---- 80-rbac: show('app') chờ dữ liệu; reveal() khi vẽ xong lần đầu; login/pending/nobrand tắt màn chờ ----
A80 = 'src/app/80-rbac-auth.js'
rep(A80, "  let APP_SHOWN_SIG=null; // v90: chữ ký 'role|brand' đã vẽ app - tránh show('app') vẽ lại toàn trang mỗi heartbeat",
         "  let APP_SHOWN_SIG=null; // v90: chữ ký 'role|brand' đã vẽ app - tránh show('app') vẽ lại toàn trang mỗi heartbeat\n  let GATE_MODE='loading'; // v119-69: màn cổng đang hiện gì (loading/login/pending/nobrand/app) — reveal() chỉ mở khi đang loading/app", tag='rbac.state')
rep(A80, "      if(mode!=='app') APP_SHOWN_SIG=null; // v90: rời app (login/pending/nobrand) → lần vào lại phải vẽ mới",
         "      if(mode!=='app') APP_SHOWN_SIG=null; // v90: rời app (login/pending/nobrand) → lần vào lại phải vẽ mới\n      GATE_MODE=mode;\n      if(mode==='login'||mode==='pending'||mode==='nobrand'){ try{ document.dispatchEvent(new CustomEvent('sl-boot-done')); }catch(_){} } // v119-69: cần người dùng thao tác → tắt màn chờ", tag='rbac.mode')
rep(A80, """        CURRENT_BRAND_NAME=(user&&user.brandName)||'';
        gate.classList.remove('show'); gate.innerHTML='';
        applyRoleUI();""",
"""        CURRENT_BRAND_NAME=(user&&user.brandName)||'';
        /* v119-69: dữ liệu thật chưa vẽ lần đầu → GIỮ màn chờ, chỉ áp vai trò; live.js gọi SLAuth.reveal() ngay sau lần vẽ đầu */
        if(window.SL_LIVE_BOOT && !window.SL_LIVE_READY){ APP_SHOWN_SIG=null; applyRoleUI(); return; }
        gate.classList.remove('show'); gate.innerHTML='';
        applyRoleUI();""", tag='rbac.app')
rep(A80, "    denied(){ toast('Bạn không có quyền thực hiện thao tác này.'); },",
"""    denied(){ toast('Bạn không có quyền thực hiện thao tác này.'); },
    /* v119-69: live.js gọi sau LẦN VẼ ĐẦU bằng dữ liệu thật → mở cổng + tắt màn chờ (chỉ khi cổng đang loading/app, không đè màn login/pending) */
    reveal(){
      if(GATE_MODE!=='loading' && GATE_MODE!=='app') return;
      const gate=document.getElementById('authGate'); if(gate){ gate.classList.remove('show'); gate.innerHTML=''; }
      GATE_MODE='app'; APP_SHOWN_SIG=CURRENT_ROLE+'|'+CURRENT_BRAND;
      if(!view.childElementCount){ const cur=(window.location.hash||'').replace('#','')||'overview'; go(meta[cur]?cur:'overview'); }
      try{ document.dispatchEvent(new CustomEvent('sl-boot-done')); }catch(_){}
    },""", tag='rbac.reveal')
# ---- live.js: cổng sẵn sàng cho lần vẽ đầu ----
L = 'assets/js/live.js'
rep(L, "  let lastStart=null, restartPending=false, restartT=null; const chanRetry={}, chanFailed={}, chanOkAt={};",
       "  let lastStart=null, restartPending=false, restartT=null; const chanRetry={}, chanFailed={}, chanOkAt={};\n"
       "  let liveReady=false, bootDeadline=Date.now()+7000, leadsSrv=false, leadsCacheAt=0; const chanSeen={}; // v119-69: cổng sẵn sàng cho LẦN VẼ ĐẦU (kênh nào đã có snapshot, lead đã có bản máy chủ chưa, trần 7 s)", tag='live.state')
rep(L, "  function chanOk(name){ chanOkAt[name]=Date.now();", "  function chanOk(name){ chanOkAt[name]=Date.now(); chanSeen[name]=1;", tag='live.chanOk')
rep(L, """  function snapErr(name){
    return err=>{
      const code=(err&&err.code)||'';""", """  function snapErr(name){
    return err=>{
      const code=(err&&err.code)||'';
      if(!chanSeen[name]) chanSeen[name]='err'; // v119-69: kênh lõi lỗi ngay từ đầu → không giữ màn chờ tới trần 7 s (vẽ phần còn lại + banner kênh)""", tag='live.snapErr')
rep(L, "chanOk('leads'); if(!snap.metadata.fromCache) fbUp();", "chanOk('leads'); if(!snap.metadata.fromCache){ fbUp(); leadsSrv=true; } else if(!leadsCacheAt) leadsCacheAt=Date.now();", count=2, tag='live.leadsSrv')
rep(L, "    lastStart={role,brand,userWin}; // v119-47: để tự đăng ký lại sau lỗi kênh thoáng qua",
       "    lastStart={role,brand,userWin}; // v119-47: để tự đăng ký lại sau lỗi kênh thoáng qua\n"
       "    if(!liveReady){ bootDeadline=Date.now()+7000; leadsSrv=false; leadsCacheAt=0; Object.keys(chanSeen).forEach(k=>delete chanSeen[k]); } // v119-69: đăng ký kênh mới → đếm lại kênh lõi", tag='live.start')
rep(L, """  let pendingViews=null; // null = chưa dồn gì; '*' = mọi view; Set = danh sách view
  const rebuild=(views)=>{
    if(pendingViews!=='*'){
      if(views===undefined) pendingViews='*';
      else { if(!pendingViews) pendingViews=new Set(); views.forEach(v=>pendingViews.add(v)); }
    }
    if(rebuildT) clearTimeout(rebuildT);
    rebuildT=setTimeout(()=>{
      try{ // v167: 1 doc dữ liệu "bẩn" làm buildData/reload ném exception → trước đây UI đứng hình vĩnh viễn không cảnh báo
      rebuildT=null;
      const pv=pendingViews; pendingViews=null;""",
"""  let pendingViews=null; // null = chưa dồn gì; '*' = mọi view; Set = danh sách view
  /* v119-69: LẦN VẼ ĐẦU ở chế độ live chỉ khi kênh lõi đã có dữ liệu (leads/sources/config/scans; super thêm lượt admin đầu) và lead đã có
     bản MÁY CHỦ (hoặc quá 1,2 s sau bản cache) — trần 7 s rồi vẽ với những gì có. Vẽ NGAY khi đủ (không chờ debounce 250 ms), sau đó
     mở cổng (SLAuth.reveal). Trước: vẽ demo ngay từ đầu, rồi mỗi đợt snapshot lại hẹn vẽ 250 ms → số demo → số cache cũ → số thật. */
  function coreReady(){
    if(!(chanSeen.leads && chanSeen.sources && chanSeen.config && chanSeen.scans)) return false;
    if(!leadsSrv && chanSeen.leads!=='err' && !(leadsCacheAt && Date.now()-leadsCacheAt>1200)) return false;
    if(curRole==='superadmin' && !adminLast) return false;
    return true;
  }
  const rebuild=(views)=>{
    if(pendingViews!=='*'){
      if(views===undefined) pendingViews='*';
      else { if(!pendingViews) pendingViews=new Set(); views.forEach(v=>pendingViews.add(v)); }
    }
    if(rebuildT) clearTimeout(rebuildT);
    const gating=(!liveReady && window.SL_LIVE_BOOT);
    rebuildT=setTimeout(function tick(){
      try{ // v167: 1 doc dữ liệu "bẩn" làm buildData/reload ném exception → trước đây UI đứng hình vĩnh viễn không cảnh báo
      rebuildT=null;
      let first=false;
      if(!liveReady && window.SL_LIVE_BOOT){
        if(!(coreReady() || Date.now()>bootDeadline)){ rebuildT=setTimeout(tick,100); return; } // chưa đủ kênh lõi → thăm lại 100 ms
        liveReady=true; window.SL_LIVE_READY=true; pendingViews='*'; first=true;
      }
      const pv=pendingViews; pendingViews=null;""", tag='live.rebuild.head')
rep(L, """      if(window.SLApp&&window.SLApp.reload) window.SLApp.reload(d, full?undefined:{silent:true});
      }catch(e){ console.error('[SmartLead] rebuild lỗi:', e);""",
"""      if(window.SLApp&&window.SLApp.reload) window.SLApp.reload(d, full?undefined:{silent:true});
      if(first && window.SLAuth && window.SLAuth.reveal){ window.SLAuth.reveal(); console.info('[SmartLead] vẽ lần đầu bằng dữ liệu thật sau '+(Date.now()-(bootDeadline-7000))+' ms'+(leadsSrv?' (lead từ máy chủ)':' (lead từ cache)')); } // v119-69
      }catch(e){ console.error('[SmartLead] rebuild lỗi:', e);""", tag='live.rebuild.reveal')
rep(L, "    },250);\n  };\n  /* v167: onSnapshot lỗi terminal", "    }, gating ? (coreReady()||Date.now()>bootDeadline ? 0 : 100) : 250);\n  };\n  /* v167: onSnapshot lỗi terminal", tag='live.rebuild.delay')
done()
