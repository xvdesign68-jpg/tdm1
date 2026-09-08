// Mock 2 kiểu timeline: A = 2 cột (sửa thụt dòng + giờ gọn) · B = xếp dọc (giờ trên, nội dung dưới). Chỉ inject CSS/DOM, không build.
const http=require('http'),fs=require('fs'),path=require('path');
const SITE=process.env.SITE, FP=path.join(__dirname,'..','geist','fp'), OUT=process.env.OUT; fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/app.html';
 if(p.endsWith('firebase-config.min.js')||p.endsWith('firebase-config.js')){ res.writeHead(200,{'content-type':'text/javascript'}); return res.end('window.SL_CONFIG={MODE:"demo"};'); }
 if(p.startsWith('/fp/')){ const f=path.join(FP,p.slice(4)); if(fs.existsSync(f)){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); return fs.createReadStream(f).pipe(res);} }
 const f=path.join(SITE,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){
  if(p==='/app.html'){ let h=fs.readFileSync(f,'utf8'); h=h.replace(/<link[^>]*fonts\.googleapis[^>]*>/g,'').replace(/<link[^>]*preconnect[^>]*>/g,''); h=h.replace('</head>','<link rel="stylesheet" href="/fp/fonts.css"></head>'); res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(h); }
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
const CSS_A=`.ld-tl-x{display:flex;gap:6px;align-items:flex-start} .ld-tl-ic{flex:none;margin-top:2px} .ld-tl-t{min-width:0;width:auto;white-space:nowrap}`;
const CSS_B=`.ld-tl-i{display:block} .ld-tl-t{display:block;min-width:0;margin-bottom:1px} .ld-tl-x{display:flex;gap:6px;align-items:flex-start} .ld-tl-ic{flex:none;margin-top:2px} .ld-tl-list{gap:9px;max-height:330px} .ld-tl-i::before{top:4px} .ld-tl-i::after{top:12px;bottom:-11px}`;
const NICE_BODY=`s=String(s||''); const letters=s.replace(/[^A-Za-zÀ-ỹ]/g,''); if(letters.length>=8 && letters===letters.toUpperCase()){ s=s.toLowerCase().replace(/(^|[\s(\/"“-])([a-zà-ỹ])/g,(m,a,b)=>a+b.toUpperCase()); } return s;`;
const nice=(s)=>{ s=String(s||''); const letters=s.replace(/[^A-Za-zÀ-ỹ]/g,''); if(letters.length>=8 && letters===letters.toUpperCase()){ s=s.toLowerCase().replace(/(^|[\s(\/"“-])([a-zà-ỹ])/g,(m,a,b)=>a+b.toUpperCase()); } return s; };
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true});
 async function shoot(vp,dpr,mobile,tag,mode,css){
  const ctx=await browser.newContext({viewport:vp,deviceScaleFactor:dpr,isMobile:!!mobile,hasTouch:!!mobile}); const page=await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/app.html#feed`); await page.waitForTimeout(1400);
  await page.evaluate(async()=>{ for(const f of ['TikTok Sans','Plus Jakarta Sans','JetBrains Mono']) for(const w of [400,450,500,600,700]) { try{ await document.fonts.load(`${w} 14px "${f}"`,'Ab'); }catch(e){} } await document.fonts.ready; });
  const id=await page.evaluate((mode)=>{ const L=window.SL_DATA.leads; const now=Date.now(); let l;
    if(mode==='one'){ l=L[3]; localStorage.removeItem('sl_lead_notes_v1'); Object.assign(l,{source:'TUYỂN DỤNG THỰC TẬP SINH DIGITAL MARKETING (Google, Facebook,TikTok..)', detected_at: now-2*3600e3, assignee:'', assigned_at:null, first_care_at:null, stage:'new', stage_at:null, fu_at:null, fu_note:'', last_touch_at:null, outreach:null}); }
    else { l=L.find(x=>x.kind==='comment'&&x.parent_author)||L[0]; Object.assign(l,{source:'Hội chủ Spa - Thẩm mỹ viện Việt Nam',detected_at:now-30*3600e3,assignee:'Minh Anh',assigned_at:now-26*3600e3,first_care_at:now-25*3600e3,first_care_by:'minhanh',stage:'inbox',stage_at:now-3*3600e3,fu_at:now+20*3600e3,fu_note:'Gọi lại báo giá combo ads',last_touch_at:now-50*60e3,last_touch_kind:'call',outreach:{steps:['react','comment','add_friend','inbox'],at:now-27*3600e3,pid:'apk1gm6por',last:'inbox'}});
      const m={}; m[l.id]=[{a:'Minh Anh',t:'Khách bận, hẹn chiều mai gọi lại. Quan tâm gói ads + video khai trương.',at:now-45*60e3},{a:'Hệ thống',t:'Gọi không nghe máy',at:now-4*3600e3}]; localStorage.setItem('sl_lead_notes_v1',JSON.stringify(m)); }
    return l.id; },mode);
  await page.evaluate(()=>{ location.hash='feed'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(600);
  await page.evaluate((id)=>{ document.querySelector(`#feedList .lead-card[data-lead="${id}"]`).click(); },id); await page.waitForTimeout(1000);
  await page.addStyleTag({content:'.modal{max-height:none!important} .modal-bg{align-items:flex-start!important;padding-top:24px!important} .ld-actions{position:static!important}'+(css||'')});
  if(css){ // giờ gọn: Hôm nay 11:21 / Hôm qua 09:05 / 03/09 14:20 (năm chỉ khi khác) + tên nguồn CAPS → Title Case, cắt 48
    await page.evaluate((niceSrc)=>{ const nice=new Function('s',niceSrc); const now=new Date(); const d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
      document.querySelectorAll('#modal .ld-tl-t').forEach(t=>{ const m=t.textContent.match(/(\d\d):(\d\d)\s*·\s*(\d\d)\/(\d\d)\/(\d{4})/); if(!m) return; const dt=new Date(+m[5],+m[4]-1,+m[3],+m[1],+m[2]).getTime(); const dd=Math.floor((dt-d0)/86400e3); const hm=m[1]+':'+m[2]; t.textContent = dd===0?'Hôm nay '+hm : dd===-1?'Hôm qua '+hm : dd===1?'Ngày mai '+hm : (m[3]+'/'+m[4]+(+m[5]!==now.getFullYear()?'/'+m[5]:'')+' '+hm); });
      document.querySelectorAll('#modal .ld-tl-x').forEach(x=>{ const tn=[...x.childNodes].find(n=>n.nodeType===3); if(!tn) return; const mm=tn.nodeValue.match(/^(Phát hiện lead từ )(.+)$/); if(mm){ let s=nice(mm[2]); const full=s; if(s.length>48) s=s.slice(0,47).replace(/\s+\S*$/,'')+'…'; tn.nodeValue=mm[1]+s; x.title=full; } });
    }, NICE_BODY); }
  await page.waitForTimeout(200); await page.locator('#modal .ld-tl').screenshot({path:`${OUT}/${tag}.png`});
  const h=await page.evaluate(()=>document.querySelector('#modal .ld-tl').getBoundingClientRect().height); console.log(tag,'h=',Math.round(h));
  await ctx.close(); }
 for(const [mode] of [['one'],['rich']]){
  await shoot({width:1440,height:2600},2,false,`1440-${mode}-0-hientai`,mode,null);
  await shoot({width:1440,height:2600},2,false,`1440-${mode}-A-2cot`,mode,CSS_A);
  await shoot({width:1440,height:2600},2,false,`1440-${mode}-B-xepdoc`,mode,CSS_B);
  await shoot({width:390,height:3600},2,true,`390-${mode}-0-hientai`,mode,null);
  await shoot({width:390,height:3600},2,true,`390-${mode}-A-2cot`,mode,CSS_A);
  await shoot({width:390,height:3600},2,true,`390-${mode}-B-xepdoc`,mode,CSS_B);
 }
 await browser.close(); server.close(); console.log('DONE'); })().catch(e=>{console.log('ERR',e.stack);process.exit(1);});
