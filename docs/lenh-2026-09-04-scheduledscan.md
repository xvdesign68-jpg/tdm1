# LỆNH #18 — chẩn đoán alert `scheduledscan` 504 / 540 s (04/09/2026) — CHỈ ĐỌC, không đổi gì

> Alert "SmartLead - lỗi Cloud Functions/Run (severity>=ERROR)" (tạo ở LỆNH #9) báo Cloud Run `scheduledscan` (asia-southeast1, revision `scheduledscan-00064-med`) trả **POST 504 với latency ≈ 540 s** lặp nhiều lần trong ngày 04/09 (08:57 · 09:09 · 09:21 · 10:04 · 10:16 · 10:35 · 10:56 · 12:15 · 15:07 · 16:12 UTC).
> **504 + đúng 540 s = function `scheduledScan` chạy QUÁ timeout** (Cloud Run cắt ở mốc timeoutSeconds), không phải crash/exception. Hệ quả: lượt quét bị cắt ngang (nguồn cuối danh sách không được quét, doc nhật ký `scans` của lượt đó có thể không được ghi), đốt 9 phút compute mỗi lượt. Chưa mất dữ liệu lead (lead ghi trước khi cắt vẫn còn).
> LỆNH này chỉ đọc cấu hình + log + code + Firestore để tìm bước treo (nghi: BrightData polling snapshot / chấm điểm LLM tuần tự / quá nhiều nguồn trong 1 lượt). Không có secret trong output (chỉ in TÊN biến .env, log được che token/key).

```bash
cd ~/firebase-s13/functions
echo "=== (a) cấu hình scheduledScan: timeout / RAM / CPU / instances / revision / updateTime ==="
gcloud functions describe scheduledScan --region asia-southeast1 --gen2 --format="yaml(serviceConfig.timeoutSeconds,serviceConfig.availableMemory,serviceConfig.availableCpu,serviceConfig.maxInstanceCount,serviceConfig.minInstanceCount,serviceConfig.revision,updateTime,state)" 2>&1 | tail -12

echo "=== (b) job Cloud Scheduler gọi scheduledScan (lịch · attemptDeadline · retry · lần chạy cuối) ==="
for LOC in asia-southeast1 us-central1; do
  gcloud scheduler jobs list --location $LOC --format="value(name)" 2>/dev/null | grep -i "scheduledscan" | while read J; do
    echo "--- $LOC :: $(basename "$J")"
    gcloud scheduler jobs describe "$J" --location $LOC --format="yaml(schedule,timeZone,attemptDeadline,retryConfig,lastAttemptTime,status,state)" 2>&1
  done
done

echo "=== (c) log 24h của service scheduledscan → tóm tắt theo lượt (giờ VN) ==="
SINCE=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)
gcloud logging read "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"scheduledscan\" AND timestamp>=\"$SINCE\"" --limit 1500 --order asc --format json > /tmp/ss.json 2>/tmp/ss.err || true
echo "entries: $(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/ss.json','utf8')).length)" 2>/dev/null || echo 0) (lỗi đọc log nếu có:) $(head -c 200 /tmp/ss.err)"
cat > /tmp/ss_sum.cjs <<'EOF_SS'
const fs=require('fs'); const E=JSON.parse(fs.readFileSync('/tmp/ss.json','utf8')).sort((a,b)=>a.timestamp<b.timestamp?-1:1);
const vn=ts=>new Date(Date.parse(ts)+7*3600e3).toISOString().replace('T',' ').slice(5,19);
const mask=s=>String(s).replace(/(api[_-]?key|token|secret|authorization|bearer|password)\s*[=:]\s*\S+/gi,'$1=***');
const msg=e=>{ if(e.textPayload) return e.textPayload; const j=e.jsonPayload; if(!j) return ''; if(typeof j==='string') return j; return j.message||j.msg||JSON.stringify(j).slice(0,200); };
const reqs=[], groups=[]; let cur={req:null,lines:[]};
for(const e of E){
  if(e.httpRequest&&e.httpRequest.status){ const lat=parseFloat(String(e.httpRequest.latency||'0').replace('s',''))||0; const r={t:e.timestamp,st:e.httpRequest.status,lat}; reqs.push(r); cur.req=r; groups.push(cur); cur={req:null,lines:[]}; }
  else { const m=msg(e); if(m) cur.lines.push({t:e.timestamp,sev:e.severity||'',m:mask(m).replace(/\s+/g,' ').slice(0,170)}); }
}
if(cur.lines.length) groups.push(cur);
const by={}; reqs.forEach(r=>by[r.st]=(by[r.st]||0)+1);
const ok=reqs.filter(r=>r.st<400).map(r=>r.lat);
console.log('requests:',reqs.length,'theo status:',JSON.stringify(by));
if(ok.length) console.log('latency lượt THÀNH CÔNG (s): min',Math.min(...ok).toFixed(0),'avg',(ok.reduce((a,b)=>a+b,0)/ok.length).toFixed(0),'max',Math.max(...ok).toFixed(0), ' | số lượt >400s:', ok.filter(x=>x>400).length);
console.log('lượt 504 (giờ VN):', reqs.filter(r=>r.st>=500).map(r=>vn(r.t)+'('+r.lat.toFixed(0)+'s)').join(' · ')||'(không có)');
const errs=E.filter(e=>/ERROR|CRITICAL|ALERT|EMERGENCY/.test(e.severity||'')&&!(e.httpRequest&&e.httpRequest.status)).map(e=>mask(msg(e)).replace(/\s+/g,' ').slice(0,170));
console.log('app log severity>=ERROR:',errs.length); [...new Set(errs)].slice(0,8).forEach(x=>console.log('  !',x));
console.log('--- 10 khối cuối (mỗi khối = log app giữa 2 request; dòng [req] = request Cloud Run kết thúc/bắt đầu lượt) ---');
groups.slice(-10).forEach(g=>{ const L=g.lines; const show=L.length<=12?L:[...L.slice(0,3),{t:'',sev:'',m:'… '+(L.length-11)+' dòng …'},...L.slice(-8)];
  show.forEach(l=>console.log('   ',l.t?vn(l.t):'          ',(l.sev||'').slice(0,4).padEnd(4),l.m));
  if(g.req) console.log(' [req]',vn(g.req.t),'status',g.req.st,'latency',g.req.lat.toFixed(1)+'s'); });
EOF_SS
node /tmp/ss_sum.cjs 2>&1 | head -220

echo "=== (d) bản đồ code scheduledScan: options · các await · helper gọi tới · vòng poll · timeout ==="
F=$(grep -l "scheduledScan" *.js 2>/dev/null | head -1); echo "file: $F ($(wc -l < "$F") dòng)"
cat > /tmp/ss_code.cjs <<'EOF_CODE'
const fs=require('fs'); const file=process.argv[2]; const src=fs.readFileSync(file,'utf8'); const L=src.split('\n');
const find=re=>{ for(let i=0;i<L.length;i++) if(re.test(L[i])) return i; return -1; };
function blockEnd(start){ let depth=0,seen=false,k0=start,c0=0;
  for(let k=start;k<Math.min(start+12,L.length);k++){ if(/^\s*(export\s+)?(async\s+)?function\b/.test(L[k])&&L[k].indexOf('{')>=0){ k0=k; c0=L[k].indexOf('{'); break; } const p=L[k].indexOf('=>'); if(p>=0){ k0=k; c0=p+2; break; } }
  for(let k=k0;k<L.length;k++){ const s=L[k].replace(/(^|\s)\/\/.*$/,''); for(let c=(k===k0?c0:0);c<s.length;c++){ const ch=s[c]; if(ch==='{'){depth++;seen=true;} else if(ch==='}'){depth--; if(seen&&depth===0) return k;} } } return L.length-1; }
const tr=(s,n=150)=>s.trim().slice(0,n);
let i=find(/export\s+const\s+scheduledScan\b/); if(i<0) i=find(/\bscheduledScan\s*=/); if(i<0){ console.log('KHÔNG THẤY scheduledScan'); process.exit(0); }
let opt=''; for(let k=i;k<Math.min(i+12,L.length);k++){ opt+=L[k].trim()+' '; if(/=>\s*\{?\s*$/.test(L[k])||/async\s*\(/.test(L[k])) break; }
console.log('scheduledScan @ dòng',i+1,'| OPTIONS:',opt.slice(0,420));
const e=blockEnd(i); console.log('body dòng',i+1,'→',e+1,'('+(e-i+1)+' dòng)');
const body=L.slice(i,e+1);
console.log('-- các dòng await trong scheduledScan (tối đa 40):'); let n=0; body.forEach((s,k)=>{ if(/\bawait\b/.test(s)&&n<40){ n++; console.log('  ',String(i+k+1).padStart(5),tr(s)); } });
const defRe=name=>new RegExp('^\\s*(export\\s+)?(async\\s+function\\s+'+name+'\\b|(const|let|function)\\s+'+name+'\\s*(=|\\())');
const SKIP=new Set(['if','for','while','switch','catch','function','return','console','JSON','Promise','Date','Math','String','Number','Array','Object','parseInt','parseFloat','Boolean','Set','Map','Error','setTimeout','clearTimeout','require','import','onSchedule','onRequest','logger','isNaN','encodeURIComponent','decodeURIComponent','fetch','Buffer','RegExp']);
const calls=t=>{ const out=new Set(); const re=/\b([A-Za-z_$][\w$]*)\s*\(/g; let m; while((m=re.exec(t))) if(!SKIP.has(m[1])) out.add(m[1]); return out; };
const seen=new Set(['scheduledScan']); const queue=[...calls(body.join('\n'))]; let shown=0;
while(queue.length&&shown<12){ const name=queue.shift(); if(seen.has(name)) continue; seen.add(name); const d=find(defRe(name)); if(d<0) continue; const de=blockEnd(d); const b=L.slice(d,de+1); const aw=b.filter(s=>/\bawait\b/.test(s)).length;
  console.log('-- helper',name,'@',d+1,'→',de+1,'|',b.length,'dòng | await:',aw);
  let c=0; b.forEach((s,k)=>{ if(c<14&&/\bwhile\s*\(|\bfor\s*\(|setTimeout|sleep\(|delay\(|wait\(|fetch\(|axios|openai|chat\.completions|responses\.create|AbortController|signal\s*:|timeout|snapshot|progress|status\b.*===|Promise\.all|\.get\(\)/i.test(s)&&!/^\s*\/\//.test(s)){ c++; console.log('     ',String(d+k+1).padStart(5),tr(s,140)); } });
  shown++; calls(b.join('\n')).forEach(x=>{ if(!seen.has(x)) queue.push(x); }); }
console.log('-- toàn file: AbortController =',(src.match(/AbortController/g)||[]).length,'| signal: =',(src.match(/signal\s*:/g)||[]).length,'| timeoutSeconds =',(src.match(/timeoutSeconds/g)||[]).length,'| Promise.all =',(src.match(/Promise\.all/g)||[]).length);
EOF_CODE
node /tmp/ss_code.cjs "$F" 2>&1 | head -260
echo "-- tên biến .env liên quan quét (CHỈ TÊN, không giá trị):"; grep -o '^[A-Z_][A-Z0-9_]*' .env 2>/dev/null | grep -i -E "scan|bright|bd_|llm|timeout|max|limit|concur|batch|apify|profile" | tr '\n' ' '; echo

echo "=== (e) Firestore: cấu hình quét · số nguồn · 40 lượt quét gần nhất (durationMs / posts / llm) ==="
cat > _ss_diag.mjs <<'EOF_FS'
import { initializeApp, applicationDefault } from 'firebase-admin/app'; import { getFirestore } from 'firebase-admin/firestore';
initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db=getFirestore();
const vn=ms=>new Date((ms||0)+7*3600e3).toISOString().replace('T',' ').slice(5,19);
const toMs=v=>!v?0:typeof v==='number'?v:typeof v.toMillis==='function'?v.toMillis():(v.seconds?v.seconds*1000:(Date.parse(v)||0));
const app=(await db.doc('config/app').get()).data()||{}; const pick={}; for(const k of Object.keys(app)) if(/scan|profile|channel|method|comment|auto|limit|max|batch|interval/i.test(k)&&k!=='keywords'&&k!=='exclude') pick[k]=app[k];
console.log('config/app (quét):', JSON.stringify(pick).slice(0,700));
const src=await db.collection('sources').get(); let act=0; const rows=[];
src.forEach(d=>{ const s=d.data(); if(s.active!==false) act++; const ex={}; for(const k of Object.keys(s)) if(/scan|last|interval|every|limit|max|brand|active|type|kind|posts|err/i.test(k)&&typeof s[k]!=='object') ex[k]=s[k]; else if(/last|scan/i.test(k)&&s[k]&&typeof s[k]==='object') ex[k]=vn(toMs(s[k])); rows.push((s.active===false?'  [tắt] ':'  ')+d.id+' '+JSON.stringify(ex).slice(0,170)); });
console.log('sources:', src.size, '| active:', act); rows.slice(0,40).forEach(r=>console.log(r));
const sc=await db.collection('scans').orderBy('at','desc').limit(40).get(); let first=null;
console.log('scans 40 gần nhất — giờVN | durMs | src | posts | cmts | llmCalls | leads | scrapeErr | scoreErr | ghi chú');
sc.forEach(d=>{ const s=d.data(); if(!first) first=s; console.log(' ',vn(toMs(s.at)),'|',s.durationMs,'|',s.sourcesCount,'|',s.postsFetched,'|',s.commentsFetched,'|',s.llmCalls,'|',s.leadsCreated,'|',s.scrapeErrors,'|',s.scoreErrors,'|',String(s.note||s.status||s.error||s.method||'').slice(0,50)); });
if(first) console.log('field của doc scans mới nhất:', Object.keys(first).join(', '));
const today=new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
console.log('scanned_posts hôm nay (', today, '):', (await db.collection('scanned_posts').where('scannedAt','>=',new Date(Date.parse(today+'T00:00:00+07:00'))).count().get().catch(()=>({data:()=>({count:'?'})}))).data().count);
EOF_FS
node _ss_diag.mjs 2>&1 | head -120; rm -f _ss_diag.mjs
echo "=== XONG LỆNH #18 (chỉ đọc) ==="
```

Anh chạy xong dán/chụp output (đủ 5 mục a→e) để em xác định bước treo rồi soạn LỆNH sửa (#19). Hướng sửa có thể: timeout riêng cho từng call BrightData/LLM (AbortController) + trần thời gian mềm trong lượt (dừng sớm, ghi nhật ký, lượt sau quét tiếp) + nâng `timeoutSeconds` nếu cần + chạy nguồn/chấm điểm song song có giới hạn.
