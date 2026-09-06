// Harness v119-56: máy trạng thái banner kênh — lỗi thoáng qua → đăng ký lại → kênh OK gỡ banner; lỗi thật → banner hiện lại
const events=[]; globalThis.document={ dispatchEvent(e){ events.push(e.type+(e.detail?':'+e.detail.message:'')); } };
globalThis.CustomEvent=class{ constructor(t,o){ this.type=t; this.detail=o&&o.detail; } };
const auth={ currentUser:{uid:'u1'} }; let restarted=0; const timers=[]; const setTimeout=(fn)=>timers.push(fn);
function startData(){ restarted++; }
  let lastStart=null, restartPending=false; const chanRetry={}, chanFailed={};
  /* v119-56: MỌI kênh gọi chanOk khi nhận dữ liệu (trước chỉ 4 kênh → kênh khác đăng ký lại OK mà cờ còn → banner treo). restartPending: lúc đăng ký lại đã xoá hết cờ
     (kênh lazy như outreach_* chỉ đăng ký khi mở tab, không thể tự gỡ) → kênh đầu tiên OK sau đó gỡ banner; lỗi thật → kênh lỗi lại → banner hiện lại (chanRetry chặn lặp vô hạn). */
  function chanOk(name){ const had=!!chanFailed[name]; delete chanFailed[name]; if((had||restartPending) && !Object.keys(chanFailed).length){ restartPending=false; try{ document.dispatchEvent(new CustomEvent('sl-fb-channel-ok')); }catch(_){} } }
  function snapErr(name){
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

lastStart={role:'superadmin',brand:null,userWin:null};
let pass=0,total=0; const check=(n,ok,x)=>{ total++; if(ok) pass++; console.log(ok?'PASS':'FAIL',n,x!==undefined?'→ '+x:''); };
// A) outreach_stats lỗi thoáng qua → banner; đăng ký lại → config OK → banner gỡ (dù outreach_stats KHÔNG đăng ký lại vì user rời tab)
snapErr('outreach_stats')({code:'permission-denied',message:'Missing or insufficient permissions.'});
check('A1: banner kênh hiện', events.at(-1)==='sl-fb-down:Kênh dữ liệu "outreach_stats" lỗi permission-denied', events.at(-1));
check('A2: hẹn đăng ký lại 1 lần', timers.length===1);
timers.shift()(); check('A3: startData chạy lại, cờ kênh đã xoá', restarted===1 && Object.keys(chanFailed).length===0);
chanOk('config'); check('A4: kênh đầu OK sau đăng ký lại → gỡ banner', events.at(-1)==='sl-fb-channel-ok', events.at(-1));
chanOk('leads'); check('A5: kênh OK tiếp theo không bắn thêm event', events.filter(e=>e==='sl-fb-channel-ok').length===1);
// B) lỗi THẬT: sau đăng ký lại kênh lỗi lại → banner hiện lại, KHÔNG hẹn đăng ký lại lần 2
snapErr('outreach_stats')({code:'permission-denied',message:'x'});
check('B1: banner hiện lại', events.at(-1).startsWith('sl-fb-down') && chanFailed.outreach_stats===true);
check('B2: không lặp đăng ký lại vô hạn', timers.length===0);
chanOk('config'); check('B3: kênh khác OK KHÔNG gỡ banner khi outreach_stats vẫn lỗi', events.at(-1).startsWith('sl-fb-down'));
chanOk('outreach_stats'); check('B4: chính kênh đó OK → gỡ', events.at(-1)==='sl-fb-channel-ok');
// C) hành vi cũ giữ nguyên: kênh OK bình thường (không có cờ, không restart) → không bắn gì
const n0=events.length; chanOk('sources'); check('C: chanOk khi không có cờ → im lặng', events.length===n0);
// D) 2 kênh lỗi cùng lúc → chỉ khi cả 2 OK mới gỡ
snapErr('scans')({code:'failed-precondition',message:'index'}); snapErr('workers')({code:'permission-denied',message:'x'});
chanOk('scans'); check('D1: 1/2 kênh OK → chưa gỡ', events.at(-1).startsWith('sl-fb-down'));
chanOk('workers'); check('D2: 2/2 OK → gỡ', events.at(-1)==='sl-fb-channel-ok');
console.log(`\n${pass}/${total} PASS`); if(pass!==total) process.exit(1);
