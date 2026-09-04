# LỆNH #19 — chẩn đoán vòng 2 `scheduledScan` (04/09/2026) — CHỈ ĐỌC

> Kết quả LỆNH #18: timeout 540 s · scheduler **mỗi 3 phút** (attemptDeadline 540 s) · mỗi lượt quét **28 nguồn mất 231–813 s** (7/40 lượt gần nhất > 540 s = đúng các mốc 504 trong alert) · lượt bị 504 vẫn **chạy tiếp trong nền** và ghi doc `scans` (vì tick 3' giữ instance sống) · **scrapeErrors = 5 ở MỌI lượt** (5 nguồn hỏng cố định) · khung 02:06–02:33 VN BrightData trả `400 Customer is not active` cho CẢ 28 nguồn (0 bài).
> Còn mù 2 chỗ: (1) logic quét KHÔNG nằm trong index.js (`scanAll` dòng 212 chỉ là wrapper 1 dòng) → cần bản đồ code XUYÊN FILE; (2) log 24h ở #18 bị lỗi cửa sổ (order asc + limit 1500 → chỉ thấy 30 phút đầu) → giờ đọc đúng cửa sổ của 1 lượt > 540 s để xem thời gian trôi ở đâu. Không có secret trong output.

```bash
cd ~/firebase-s13/functions
echo "=== (a) scan logic nằm ở file nào: danh sách file · nơi định nghĩa scanAll · import của index.js ==="
ls -1 *.js *.mjs lib/*.js lib/*.mjs 2>/dev/null | tr '\n' ' '; echo
grep -n "scanAll" *.js *.mjs lib/*.js lib/*.mjs 2>/dev/null | grep -v ":\s*//" | head -20
grep -n "^import\|^export \* from" index.js | grep -i -E "scan|bright|bd|llm|score|lib|util" | head -20
echo "-- index.js dòng 205-220:"; sed -n 205,220p index.js | cut -c1-200

echo "=== (b) Cloud Run scheduledscan: concurrency + cpu-throttling (nền chạy tiếp sau 504 có bị bóp CPU?) ==="
gcloud run services describe scheduledscan --region asia-southeast1 --format="yaml(spec.template.metadata.annotations,spec.template.spec.containerConcurrency,spec.template.spec.timeoutSeconds)" 2>&1 | grep -i -E "concurrency|throttling|timeout|cpu|execution-environment|maxScale|minScale"

echo "=== (c) bản đồ code XUYÊN FILE từ scanAll: await · helper · vòng poll · timeout · lock · song song ==="
cat > /tmp/ss_code2.cjs <<'EOF_CODE2'
const fs=require('fs'),path=require('path');
function walk(d,out){ for(const f of fs.readdirSync(d)){ if(f==='node_modules'||f.startsWith('.')||f==='tmp') continue; const p=path.join(d,f); const st=fs.statSync(p); if(st.isDirectory()) walk(p,out); else if(/\.(m?js|cjs)$/.test(f)&&!/\.bak|_ss_|diag|reset|_stats|_junk|_push/.test(f)) out.push(p); } return out; }
const files=walk('.',[]); const FL={}; files.forEach(f=>FL[f]=fs.readFileSync(f,'utf8').split('\n'));
console.log('files:',files.map(f=>f+'('+FL[f].length+')').join(' '));
const tr=(s,n=150)=>s.trim().slice(0,n);
const defRe=name=>new RegExp('^\\s*(export\\s+)?(async\\s+function\\s+'+name+'\\b|(const|let|var|function)\\s+'+name+'\\s*(=|\\())');
const ALIAS={}; files.forEach(f=>FL[f].forEach(l=>{ const m=l.match(/^\s*import\s*\{([^}]+)\}\s*from/); if(m) m[1].split(',').forEach(p=>{ const a=p.trim().match(/^(\w+)\s+as\s+(\w+)$/); if(a) ALIAS[a[2]]=a[1]; }); }));
function findDefs(name){ name=ALIAS[name]||name; const out=[]; for(const f of files){ const L=FL[f]; for(let i=0;i<L.length;i++) if(defRe(name).test(L[i])) out.push({f,i}); } return out; }
function blockEnd(L,start){ let depth=0,seen=false,k0=start,c0=0;
  for(let k=start;k<Math.min(start+12,L.length);k++){ if(/^\s*(export\s+)?(async\s+)?function\b/.test(L[k])&&L[k].indexOf('{')>=0){ k0=k; c0=L[k].indexOf('{'); break; } const p=L[k].indexOf('=>'); if(p>=0){ k0=k; c0=p+2; break; } }
  for(let k=k0;k<L.length;k++){ const s=L[k].replace(/(^|\s)\/\/.*$/,''); for(let c=(k===k0?c0:0);c<s.length;c++){ const ch=s[c]; if(ch==='{'){depth++;seen=true;} else if(ch==='}'){depth--; if(seen&&depth===0) return k;} } } return L.length-1; }
const SKIP=new Set(['if','for','while','switch','catch','function','return','console','JSON','Promise','Date','Math','String','Number','Array','Object','parseInt','parseFloat','Boolean','Set','Map','Error','setTimeout','clearTimeout','require','import','onSchedule','onRequest','logger','isNaN','encodeURIComponent','decodeURIComponent','fetch','Buffer','RegExp','Symbol','Intl']);
const calls=t=>{ const out=new Set(); const re=/\b([A-Za-z_$][\w$]*)\s*\(/g; let m; while((m=re.exec(t))) if(!SKIP.has(m[1])) out.add(ALIAS[m[1]]||m[1]); return out; };
console.log('alias import:',JSON.stringify(ALIAS).slice(0,300));
if(!findDefs('scanAll').length){ console.log('KHÔNG THẤY định nghĩa scanAll trong các file'); process.exit(0); }
const seenName=new Set(), seenLoc=new Set(); const queue=['scanAll']; let shown=0;
while(queue.length&&shown<18){ const name=queue.shift(); if(seenName.has(name)) continue; seenName.add(name);
  for(const d of findDefs(name)){ const loc=d.f+':'+d.i; if(seenLoc.has(loc)||shown>=18) continue; seenLoc.add(loc); const L=FL[d.f]; const de=blockEnd(L,d.i); const b=L.slice(d.i,de+1); const aw=b.filter(s=>/\bawait\b/.test(s)).length;
    console.log('-- '+name+' @ '+d.f+':'+(d.i+1)+'→'+(de+1)+' | '+b.length+' dòng | await: '+aw);
    let c=0; b.forEach((s,k)=>{ if(c<18&&/\bwhile\s*\(|\bfor\s*\(|\.map\(|setTimeout|sleep\(|delay\(|wait\(|fetch\(|axios|openai|chat\.completions|responses\.create|AbortController|signal\s*:|timeout|deadline|snapshot|progress|trigger|lock|inProgress|Promise\.all|allSettled|p-?limit|concurr|not active|Customer/i.test(s)&&!/^\s*\/\//.test(s)){ c++; console.log('     '+String(d.i+k+1).padStart(5)+' '+tr(s,150)); } });
    shown++; calls(b.join('\n')).forEach(x=>{ if(!seenName.has(x)) queue.push(x); }); } }
files.forEach(f=>{ const s=FL[f].join('\n'); const n=k=>(s.match(new RegExp(k,'g'))||[]).length; if(n('AbortController')||n('Promise\\.all')||n('setTimeout')) console.log('-- '+f+': AbortController='+n('AbortController')+' signal:='+n('signal\\s*:')+' Promise.all='+n('Promise\\.all')+' setTimeout='+n('setTimeout')+' POLL_MINUTES='+n('POLL_MINUTES')); });
EOF_CODE2
node /tmp/ss_code2.cjs 2>&1 | head -300

echo "=== (d) Firestore scans: 24h theo giờ · bySource 20 lượt (nguồn nào lỗi/chậm) · cửa sổ lượt dài nhất ==="
cat > _ss_diag2.mjs <<'EOF_FS2'
import fs from 'fs'; import { initializeApp, applicationDefault } from 'firebase-admin/app'; import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db=getFirestore();
const vn=ms=>new Date((ms||0)+7*3600e3).toISOString().replace('T',' ').slice(5,19);
const toMs=v=>!v?0:typeof v==='number'?v:typeof v.toMillis==='function'?v.toMillis():(v.seconds?v.seconds*1000:(Date.parse(v)||0));
const sc=await db.collection('scans').orderBy('at','desc').limit(300).get(); const rows=[]; sc.forEach(d=>rows.push(d.data()));
const day=rows.filter(s=>toMs(s.at)>=Date.now()-24*3600e3);
const H={}; day.forEach(s=>{ const h=vn(toMs(s.at)).slice(0,8)+'h'; const o=H[h]||(H[h]={n:0,dur:0,max:0,posts:0,err:0,leads:0,over:0,bd:0}); o.n++; o.dur+=s.durationMs||0; o.max=Math.max(o.max,s.durationMs||0); o.posts+=s.postsFetched||0; o.err+=s.scrapeErrors||0; o.leads+=s.leadsCreated||0; o.bd+=s.bdRecords||0; if((s.durationMs||0)>540000) o.over++; });
console.log('24h theo giờ VN: giờ | lượt | TB s | max s | >540s | posts | bdRecords | scrapeErr | leads');
Object.keys(H).sort().forEach(h=>{const o=H[h]; console.log(' ',h,'|',o.n,'|',Math.round(o.dur/o.n/1000),'|',Math.round(o.max/1000),'|',o.over,'|',o.posts,'|',o.bd,'|',o.err,'|',o.leads);});
const last=rows[0]; const bs=last&&last.bySource; const sample=Array.isArray(bs)?bs[0]:(bs&&bs[Object.keys(bs)[0]]);
console.log('bySource:', Array.isArray(bs)?'array['+bs.length+']':typeof bs+'('+(bs?Object.keys(bs).length:0)+' khoá)', '| mẫu:', JSON.stringify(Array.isArray(bs)?bs[0]:{[Object.keys(bs||{})[0]]:sample}).slice(0,400));
const agg={}; rows.slice(0,20).forEach(s=>{ const b=s.bySource; if(!b) return; const list=Array.isArray(b)?b:Object.keys(b).map(k=>Object.assign({_k:k},typeof b[k]==='object'?b[k]:{v:b[k]})); list.forEach(x=>{ const key=String(x.name||x.source||x.id||x._k||'?'); const o=agg[key]||(agg[key]={n:0,err:0,rec:0,ms:0,e:''}); o.n++; const er=x.error||x.err||(x.status&&/err|fail/i.test(x.status)?x.status:'')||(x.ok===false?'ok:false':''); if(er){o.err++; o.e=String(er).slice(0,60);} o.rec+=Number(x.records||x.posts||x.count||x.fetched||x.v||0); o.ms+=Number(x.ms||x.durationMs||x.duration||x.elapsed||0); }); });
console.log('theo nguồn (20 lượt gần nhất) — nguồn | lượt | lỗi | records | TB ms | lỗi cuối');
Object.keys(agg).sort((a,b)=>agg[b].err-agg[a].err||agg[b].ms-agg[a].ms).slice(0,32).forEach(k=>{const o=agg[k]; console.log(' ',k.slice(0,42).padEnd(42),'|',o.n,'|',o.err,'|',o.rec,'|',Math.round(o.ms/o.n),'|',o.e);});
const over=rows.find(s=>(s.durationMs||0)>540000)||rows[0]; const end=toMs(over.at), st=end-(over.durationMs||0);
fs.writeFileSync('/tmp/ss_win.txt', new Date(st-5000).toISOString()+' '+new Date(end+5000).toISOString());
console.log('lượt dài gần nhất:', vn(st),'→',vn(end),'=',Math.round((over.durationMs||0)/1000),'s | trigger',over.trigger,'twoStage',over.twoStage,'aiMode',over.aiMode,'| posts',over.postsFetched,'cmts',over.commentsFetched,'bd',over.bdRecords,'bdCmt',over.bdCommentRecords,'| prefilter',over.prefilterCalls,'score',over.scoreCalls,'llm',over.llmCalls,'| probe',over.probeRuns,'sweep',over.sweepRuns,'esc',over.probeEscalated,'idle',over.probeIdle,'| auth',over.authRuns,'/',over.authCheckpoints,'| skipped',over.skippedSeen,'backfillSkip',over.backfillSkipped);
EOF_FS2
node _ss_diag2.mjs 2>&1 | head -90; rm -f _ss_diag2.mjs

echo "=== (e) log ĐÚNG cửa sổ lượt dài đó: thời gian trôi ở đâu (top khoảng chờ + đầu/cuối) ==="
read WS WE < /tmp/ss_win.txt; echo "cửa sổ UTC: $WS → $WE"
gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"scheduledscan\" AND timestamp>=\"$WS\" AND timestamp<=\"$WE\"" --limit 1200 --order asc --format json > /tmp/ss2.json 2>/dev/null || true
cat > /tmp/ss_win.cjs <<'EOF_WIN'
const fs=require('fs'); const E=JSON.parse(fs.readFileSync('/tmp/ss2.json','utf8')).sort((a,b)=>a.timestamp<b.timestamp?-1:1);
const mask=s=>String(s).replace(/(api[_-]?key|token|secret|authorization|bearer|password)\s*[=:]\s*\S+/gi,'$1=***');
const msg=e=>{ if(e.httpRequest&&e.httpRequest.status) return '[req] status '+e.httpRequest.status+' latency '+e.httpRequest.latency; if(e.textPayload) return e.textPayload; const j=e.jsonPayload; if(!j) return ''; if(typeof j==='string') return j; return j.message||j.msg||JSON.stringify(j).slice(0,200); };
const L=E.map(e=>({t:Date.parse(e.timestamp),m:mask(msg(e)).replace(/\s+/g,' ').slice(0,160)})).filter(x=>x.m);
if(!L.length){ console.log('không có log trong cửa sổ'); process.exit(0); }
const t0=L[0].t; const fmt=x=>('+'+((x.t-t0)/1000).toFixed(0)+'s').padStart(7)+' '+x.m;
console.log('tổng dòng:',L.length);
const gaps=[]; for(let i=1;i<L.length;i++) gaps.push({i,g:(L[i].t-L[i-1].t)/1000}); gaps.sort((a,b)=>b.g-a.g);
console.log('--- 12 khoảng chờ dài nhất (dòng TRƯỚC khoảng chờ → dòng SAU):'); gaps.slice(0,12).forEach(x=>console.log('  chờ '+x.g.toFixed(0)+'s :',fmt(L[x.i-1]),'  →  ',L[x.i].m.slice(0,90)));
const kw={}; L.forEach(x=>{ const k=(x.m.match(/^\s*([a-zA-Zà-ỹ]+)/)||[])[1]||'?'; kw[k]=(kw[k]||0)+1; }); console.log('--- đếm dòng theo từ đầu:',JSON.stringify(kw).slice(0,300));
console.log('--- 30 dòng đầu:'); L.slice(0,30).forEach(x=>console.log(fmt(x)));
console.log('--- 20 dòng cuối:'); L.slice(-20).forEach(x=>console.log(fmt(x)));
EOF_WIN
node /tmp/ss_win.cjs 2>&1 | head -120
echo "=== XONG LỆNH #19 (chỉ đọc) ==="
```
