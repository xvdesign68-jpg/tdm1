/* Harness buildData (live.js) không cần Firebase: cắt import CDN → stub, chạy trong vm với window/document giả, lấy buildData qua globalThis. node harness-builddata.mjs <đường dẫn live.js> */
import fs from 'node:fs'; import vm from 'node:vm';
const file=process.argv[2]; let src=fs.readFileSync(file,'utf8');
const names=[]; src=src.replace(/^import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];?/gm,(m,g)=>{ g.split(',').map(s=>s.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach(n=>names.push(n)); return ''; }).replace(/^import\s+[^;]+;?/gm,'');
src=src.replace(/^export\s+/gm,'');
const stub=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:stub,apply:()=>stub,construct:()=>stub});
const g={ console, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Number, String, Array, Object, Map, Set, Promise, isNaN, isFinite, parseInt, parseFloat, performance:{now:()=>0}, fetch:()=>Promise.resolve({headers:{get:()=>null}}),
  window:{ SL_CONFIG:{MODE:'firebase',projectId:'x'}, addEventListener(){}, location:{hash:'',origin:'http://x'}, localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, navigator:{}, dispatchEvent(){}, SL_DATA:{stages:[]} },
  document:{ addEventListener(){}, dispatchEvent(){}, getElementById:()=>null, querySelector:()=>null, hidden:false, hasFocus:()=>true, visibilityState:'visible' }, location:{hash:''}, navigator:{userAgent:''} };
names.forEach(n=>{ g[n]=stub; }); g.self=g.window; g.globalThis=g; g.CustomEvent=function(){}; g.Event=function(){}; g.localStorage=g.window.localStorage; g.addEventListener=()=>{}; g.URL=URL; g.Intl=Intl;
src+='\nglobalThis.__buildData=buildData;';
try{ vm.runInNewContext(src,g,{filename:'live.js'}); }catch(e){ console.log('LOAD WARN', String(e&&e.message).slice(0,160)); }
const bd=g.__buildData; if(typeof bd!=='function'){ console.log('KHONG LAY DUOC buildData'); process.exit(1); }
const now=Date.now(), d=(h)=>new Date(now-h*3600e3).toISOString();
const leads=[
 {id:'a',temp:'hot',score:90,stage:'new',detected_at:d(2),source:'G1'},
 {id:'b',temp:'hot',score:88,stage:'closed',detected_at:d(30),first_care_at:now-29*3600e3,source:'G1'},
 {id:'c',temp:'warm',score:70,stage:'responded',detected_at:d(50),first_care_at:d(49),source:'G2'},
 {id:'d',temp:'junk',score:10,stage:'new',detected_at:d(3),source:'G1'},
 {id:'e',temp:'hot',score:85,stage:'inbox',detected_at:d(5),dropped:true,source:'G2'},
 {id:'f',temp:'cold',score:45,stage:'new',detected_at:d(400),lost:true,source:'G2'},
 {id:'g',temp:'warm',score:65,stage:'booked',detected_at:d(10),first_care_at:{toDate:()=>new Date(now-9*3600e3)},source:'G1'},
];
const out=bd(leads,[{_id:'s1',name:'G1',url:'u1'},{_id:'s2',name:'G2',url:'u2'}],{},[],[],[],[]);
const k=out.kpi; let ok=0,fail=0; const t=(n,c)=>{ if(c) ok++; else { fail++; console.log('FAIL',n,JSON.stringify(k)); } };
t('valid = 5 (bỏ junk d + dropped e; giữ lost f)', k.validLeads===5);
t('hot = 2 (a,b; e bị loại)', k.hot===2);
t('closed 1 → closeRate 20%', k.closed===1 && k.closeRate===20);
t('responded = c,g,b = 3 → 60%', k.responded===3 && k.responseRate===60);
t('funnel[0] = valid', out.funnel[0].value===5);
t('nguồn G1: 3 lead hợp lệ (a,b,g), 2 nóng', (out.sources.find(s=>s.name==='G1')||{}).leads===3 && (out.sources.find(s=>s.name==='G1')||{}).hot===2);
t('respAvg nhận Timestamp-like first_care_at (g) + số (b,c)', k.resp && k.resp.cur!=null && k.resp.cur>50 && k.resp.cur<70);
const out0=bd([],[],{},[],[],[],[]); t('pct mẫu số 0 → null', out0.kpi.closeRate===null && out0.kpi.responseRate===null);
console.log(ok+'/'+(ok+fail)+' PASS'); process.exit(fail?1:0);
