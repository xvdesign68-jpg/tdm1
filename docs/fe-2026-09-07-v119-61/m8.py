# v119-65 / v120-esm-o: kênh realtime lỗi permission-denied thoáng qua → tự đăng ký lại NHIỀU LẦN có giãn cách (10s/30s/90s/4′), banner mềm
# "đang tự kết nối lại" trong lúc thử, chỉ đòi "báo quản trị viên" khi hết lượt; cảnh báo rõ khi hồ sơ Super Admin trên máy chủ thiếu role;
# console ghi uid/role/lần thử để chẩn đoán. Áp cho cả cây IIFE lẫn ESM.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
p='assets/js/live.js'
rep(p,"  let lastStart=null, restartPending=false; const chanRetry={}, chanFailed={};\n",
      "  let lastStart=null, restartPending=false, restartT=null; const chanRetry={}, chanFailed={}, chanOkAt={};\n  const RESTART_DELAYS=[10000,30000,90000,240000]; // v119-65: thử lại 4 lần có giãn cách thay vì 1 lần (lỗi permission-denied thoáng qua phía máy chủ từng lặp lại 06/09 + 07/09 mà không có deploy Rules)\n",tag='1.decl')
rep(p,"  function chanOk(name){ const had=!!chanFailed[name]; delete chanFailed[name]; if(",
      "  function chanOk(name){ chanOkAt[name]=Date.now(); /* v119-65: mốc OK gần nhất — kênh khoẻ ≥5′ rồi mới lỗi = đợt gián đoạn MỚI (lượt thử làm lại từ đầu) */ const had=!!chanFailed[name]; delete chanFailed[name]; if(",tag='2.chanOk')
old_snap = '''  function snapErr(name){
    return err=>{
      console.warn('[SmartLead] '+name+' lỗi:', (err&&err.message)||err);
      const code=(err&&err.code)||'';
      if(code==='permission-denied'||code==='failed-precondition'||code==='unauthenticated'){
        chanFailed[name]=true;
        try{ document.dispatchEvent(new CustomEvent('sl-fb-down',{detail:{kind:'channel', message:'Kênh dữ liệu "'+name+'" lỗi '+code}})); }catch(_){}
        if(!chanRetry[name]){ chanRetry[name]=true; setTimeout(()=>{ if(lastStart && auth.currentUser){ console.warn('[SmartLead] đăng ký lại listener sau lỗi kênh "'+name+'"'); Object.keys(chanFailed).forEach(k=>delete chanFailed[k]); restartPending=true; /* v119-56 */ try{ startData(lastStart.role,lastStart.brand,lastStart.userWin); }catch(e){ console.warn('[SmartLead] đăng ký lại lỗi:', e&&e.message); } } },10000); }
      }
    };
  }
'''
new_snap = '''  function snapErr(name){
    return err=>{
      const code=(err&&err.code)||'';
      if(chanOkAt[name] && Date.now()-chanOkAt[name] > 300000) chanRetry[name]=0; // v119-65: kênh đã chạy tốt ≥5′ → coi là đợt gián đoạn mới (cache trả OK rồi máy chủ từ chối ngay thì KHÔNG reset → kênh hỏng thật dừng sau 4 lượt)
      const n=chanRetry[name]||0;
      const who=(auth.currentUser?String(auth.currentUser.uid).slice(0,8)+'…':'?')+(lastStart?(' · '+lastStart.role+(lastStart.brand?(' · '+lastStart.brand):'')):'');
      console.warn('[SmartLead] '+name+' lỗi:', (err&&err.message)||err, '('+who+' · lần '+(n+1)+')');
      if(code==='permission-denied'||code==='failed-precondition'||code==='unauthenticated'){
        chanFailed[name]=true;
        /* v119-65: thử đăng ký lại tới 4 lần (10s/30s/90s/4′) — trong lúc thử banner chỉ báo "đang tự kết nối lại"; hết lượt mới đòi báo quản trị viên.
           Lượt thử đếm THEO KÊNH (kênh hỏng thật dừng sau 4 lần, không kéo cả trang đăng ký lại vô hạn); nhiều kênh lỗi cùng lúc gộp 1 lần đăng ký lại. */
        const willRetry = n < RESTART_DELAYS.length;
        const msg = willRetry
          ? 'Kênh dữ liệu "'+name+'" gián đoạn ('+code+') – đang tự kết nối lại (lần '+(n+1)+'/'+RESTART_DELAYS.length+')'
          : 'Kênh dữ liệu "'+name+'" lỗi '+code;
        try{ document.dispatchEvent(new CustomEvent('sl-fb-down',{detail:{kind:'channel', message:msg, soft:willRetry}})); }catch(_){}
        if(willRetry){
          chanRetry[name]=n+1;
          if(!restartT){ const delay=RESTART_DELAYS[n]; restartT=setTimeout(()=>{ restartT=null; if(lastStart && auth.currentUser){ console.warn('[SmartLead] đăng ký lại listener sau lỗi kênh (chờ '+Math.round(delay/1000)+'s)'); Object.keys(chanFailed).forEach(k=>delete chanFailed[k]); restartPending=true; /* v119-56 */ try{ startData(lastStart.role,lastStart.brand,lastStart.userWin); }catch(e){ console.warn('[SmartLead] đăng ký lại lỗi:', e&&e.message); } } }, delay); }
        }
      }
    };
  }
'''
rep(p, old_snap, new_snap, tag='3.snapErr')
rep(p,"    if(userUnsub){ try{userUnsub();}catch(e){} userUnsub=null; }\n    stopData(); dataKey=null; // v90\n",
      "    if(userUnsub){ try{userUnsub();}catch(e){} userUnsub=null; }\n    stopData(); dataKey=null; // v90\n    Object.keys(chanRetry).forEach(k=>delete chanRetry[k]); if(restartT){ clearTimeout(restartT); restartT=null; } // v119-65: đổi người dùng → lượt thử kênh làm lại từ đầu\n",tag='4.authReset')
rep(p,"      const brand=isSuper?'':(data.brand||'');\n      const profile={ email:user.email||'', displayName:user.displayName||'', uid:user.uid, role, brand };\n",
      "      const brand=isSuper?'':(data.brand||'');\n      /* v119-65: web nhận Super Admin theo EMAIL nhưng Firestore Rules nhận theo users/{uid}.role → lệch là máy chủ từ chối mọi kênh super mà web vẫn hiện giao diện super. Báo rõ thay vì để banner \"permission-denied\" khó hiểu. */\n      if(isSuper && (!d.exists() || data.role!=='superadmin')){ const why=!d.exists()?'chưa có hồ sơ':('role \"'+(data.role||'')+'\"'); console.error('[SmartLead] hồ sơ Super Admin trên máy chủ chưa đúng:', why, '· uid', user.uid); try{ document.dispatchEvent(new CustomEvent('sl-fb-down',{detail:{kind:'channel', message:'Hồ sơ Super Admin trên máy chủ chưa đúng ('+why+', uid '+String(user.uid).slice(0,8)+'…) – máy chủ sẽ từ chối dữ liệu'}})); }catch(_){} }\n      const profile={ email:user.email||'', displayName:user.displayName||'', uid:user.uid, role, brand };\n",tag='5.superCheck')
p='src/app/90-boot.js'
rep(p,"        const sp=old.querySelector('span'); if(sp&&!sp.textContent.includes(d.message)) sp.textContent=''+d.message+' – một phần dữ liệu có thể không cập nhật. Vui lòng chụp màn hình báo quản trị viên.';\n",
      "        const sp=old.querySelector('span'); if(sp&&!sp.textContent.includes(d.message)) sp.textContent=''+d.message+(d.soft?' – dữ liệu tạm không cập nhật, sẽ tự khôi phục.':' – một phần dữ liệu có thể không cập nhật. Vui lòng chụp màn hình báo quản trị viên.'); /* v119-65: đang thử lại → câu mềm */\n",tag='6.bootUpdate')
rep(p,"      ? SLI.warning+' '+esc(d.message||'Một kênh dữ liệu bị lỗi')+' – một phần dữ liệu có thể không cập nhật. Vui lòng chụp màn hình báo quản trị viên.'\n",
      "      ? SLI.warning+' '+esc(d.message||'Một kênh dữ liệu bị lỗi')+(d.soft?' – dữ liệu tạm không cập nhật, sẽ tự khôi phục.':' – một phần dữ liệu có thể không cập nhật. Vui lòng chụp màn hình báo quản trị viên.') /* v119-65 */\n",tag='7.bootNew')
done()
