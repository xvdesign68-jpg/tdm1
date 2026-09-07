// Harness v119-65: trích ĐÚNG khối chanOk/snapErr từ live.js đã vá → máy trạng thái thử lại có giãn cách (10s/30s/90s/240s), banner mềm/cứng,
// đợt gián đoạn mới sau ≥5′ khoẻ, cache-OK-rồi-từ-chối KHÔNG reset (không lặp vô hạn). Chạy: node docs/harness-chanretry-2026-09-07.mjs <đường dẫn live.js>
import fs from 'fs';
const src=fs.readFileSync(process.argv[2]||'assets/js/live.js','utf8');
const i=src.indexOf('  let lastStart=null, restartPending=false, restartT=null;'); const j=src.indexOf('  const stopData=()=>{'); if(i<0||j<0) throw new Error('không thấy mốc khối chanOk/snapErr');
const block=src.slice(i,j);
const events=[]; const timers=[]; let restarted=0; const warns=[]; let now=1_000_000;
const doc={ dispatchEvent(e){ events.push({t:e.type, m:e.detail&&e.detail.message, soft:e.detail&&e.detail.soft}); } };
const FakeDate={ now:()=>now };
const ctx={ document:doc, CustomEvent:class{ constructor(t,o){ this.type=t; this.detail=o&&o.detail; } }, auth:{currentUser:{uid:'6NUqcP5Gabcdef'}}, setTimeout:(fn,ms)=>{ timers.push({fn,ms}); return timers.length; }, clearTimeout:()=>{}, startData:()=>{restarted++;}, console:{warn:(...a)=>warns.push(a.join(' ')), error:()=>{}, log:()=>{} }, Date:FakeDate };
const api=new Function(...Object.keys(ctx), block+'\nlastStart={role:"superadmin",brand:null,userWin:null};\nreturn {chanOk,snapErr,state:()=>({chanRetry,chanFailed,restartPending,restartT})};')(...Object.values(ctx));
let pass=0,total=0; const check=(n,ok,x)=>{ total++; if(ok) pass++; console.log(ok?'PASS':'FAIL',n,x!==undefined?'→ '+JSON.stringify(x):''); };
const last=()=>events.at(-1); const fire=()=>timers.shift().fn();
// A) lỗi thoáng qua: banner MỀM + hẹn 10s → restart → kênh đầu OK gỡ banner
api.snapErr('leads cũ')({code:'permission-denied',message:'Missing or insufficient permissions.'});
check('A1 banner mềm lần 1/4', last().t==='sl-fb-down' && last().soft===true && /lần 1\/4/.test(last().m), last().m);
check('A2 hẹn 10s', timers.length===1 && timers[0].ms===10000);
check('A3 console có uid+role+lần', /6NUqcP5G… · superadmin · lần 1/.test(warns[0]), warns[0]);
fire(); check('A4 restart 1 lần, cờ xoá', restarted===1 && Object.keys(api.state().chanFailed).length===0);
api.chanOk('config'); check('A5 kênh đầu OK → gỡ banner', last().t==='sl-fb-channel-ok');
api.chanOk('leads cũ'); now+=6*60*1000; api.snapErr('leads cũ')({code:'permission-denied',message:'x'});
check('A6 kênh khoẻ 6′ rồi lỗi → đợt MỚI, lại lần 1/4', /lần 1\/4/.test(last().m), last().m); fire(); api.chanOk('leads cũ');
// B) lỗi THẬT có cache: OK từ cache rồi máy chủ từ chối ngay (cách nhau vài giây) → KHÔNG reset → 4 lượt 10/30/90/240 rồi banner CỨNG, dừng
const ms=[]; now+=6*60*1000; timers.length=0; restarted=0;
for(let k=0;k<4;k++){ api.snapErr('outreach_log')({code:'permission-denied',message:'x'}); check('B'+(k+1)+' banner mềm lần '+(k+1)+'/4 + hẹn', last().soft===true && new RegExp('lần '+(k+1)+'/4').test(last().m) && timers.length===1, last().m); ms.push(timers[0].ms); fire(); now+=timers.length?0:2000; api.chanOk('outreach_log'); /* snapshot từ cache sau restart */ now+=1500; }
check('B5 giãn cách 10/30/90/240s', JSON.stringify(ms)==='[10000,30000,90000,240000]', ms);
api.snapErr('outreach_log')({code:'permission-denied',message:'x'});
check('B6 hết lượt → banner CỨNG, không hẹn thêm', last().soft===false && /lỗi permission-denied$/.test(last().m) && timers.length===0, last().m);
check('B7 restart đúng 4 lần (không vô hạn dù cache trả OK giữa chừng)', restarted===4, restarted);
api.chanOk('config'); check('B8 kênh khác OK không gỡ khi outreach_log còn cờ', last().t==='sl-fb-down');
api.chanOk('outreach_log'); check('B9 chính kênh OK → gỡ', last().t==='sl-fb-channel-ok');
// C) 2 kênh lỗi cùng lúc → gộp 1 timer; sau restart kênh đầu OK gỡ banner (thiết kế v119-56), kênh kia lỗi lại → banner lại
now+=10*60*1000; timers.length=0;
api.snapErr('scans')({code:'failed-precondition',message:'index'}); api.snapErr('workers')({code:'permission-denied',message:'x'});
check('C1 gộp 1 lần hẹn', timers.length===1); fire();
api.chanOk('scans'); check('C2 kênh đầu OK sau restart → gỡ', last().t==='sl-fb-channel-ok');
api.snapErr('workers')({code:'permission-denied',message:'x'}); check('C3 kênh kia lỗi lại → banner mềm lần 2/4', last().soft===true && /lần 2\/4/.test(last().m), last().m);
// D) lỗi không terminal (unavailable) → không banner, không hẹn
timers.length=0; const n0=events.length; api.snapErr('leads')({code:'unavailable',message:'net'}); check('D lỗi mạng thường → im lặng', events.length===n0 && timers.length===0);
console.log(`\n${pass}/${total} PASS`); if(pass!==total) process.exit(1);
