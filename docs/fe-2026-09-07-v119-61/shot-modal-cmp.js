// Chụp modal lead TRƯỚC/SAU cùng 1 lead làm giàu dấu vết. SITE, OUT, TAG. Ảnh: modal-full (toàn modal, không cắt), crop từng khối, mobile 390 toàn modal.
const http=require('http'),fs=require('fs'),path=require('path');
const SITE=process.env.SITE, FP=path.join(__dirname,'..','geist','fp'), OUT=process.env.OUT, TAG=process.env.TAG; fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/app.html';
 if(p.endsWith('firebase-config.min.js')||p.endsWith('firebase-config.js')){ res.writeHead(200,{'content-type':'text/javascript'}); return res.end('window.SL_CONFIG={MODE:"demo"};'); }
 if(p.startsWith('/fp/')){ const f=path.join(FP,p.slice(4)); if(fs.existsSync(f)){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); return fs.createReadStream(f).pipe(res);} }
 const f=path.join(SITE,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){
  if(p==='/app.html'){ let h=fs.readFileSync(f,'utf8'); h=h.replace(/<link[^>]*fonts\.googleapis[^>]*>/g,'').replace(/<link[^>]*preconnect[^>]*>/g,''); h=h.replace('</head>','<link rel="stylesheet" href="/fp/fonts.css"></head>'); res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(h); }
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true}); const errs=[];
 const loadFonts=(page)=>page.evaluate(async()=>{ for(const f of ['TikTok Sans','Plus Jakarta Sans','JetBrains Mono']) for(const w of [400,450,500,600,700]) { try{ await document.fonts.load(`${w} 14px "${f}"`,'Ab'); }catch(e){} } await document.fonts.ready; });
 const enrich=(page)=>page.evaluate(()=>{ const L=window.SL_DATA.leads||[]; const l=L.find(x=>x.kind==='comment'&&x.parent_author)||L[0]; const now=Date.now();
   Object.assign(l,{assignee:'Minh Anh',assigned_at:now-5*3600e3,first_care_at:now-4*3600e3,first_care_by:'minhanh',stage:'inbox',stage_at:now-3*3600e3,fu_at:now+20*3600e3,fu_note:'Gọi lại báo giá combo ads',last_touch_at:now-50*60e3,last_touch_kind:'call',outreach:{steps:['react','comment','add_friend','inbox'],at:now-6*3600e3,pid:'apk1gm6por',last:'inbox'}});
   const m={}; m[l.id]=[{a:'Minh Anh',t:'Khách bận, hẹn chiều mai gọi lại. Quan tâm gói ads + video khai trương.',at:now-45*60e3},{a:'Hệ thống',t:'Gọi không nghe máy',at:now-4*3600e3}]; localStorage.setItem('sl_lead_notes_v1',JSON.stringify(m)); return l.id; });
 async function open(page,id){ await page.evaluate(()=>{ location.hash='feed'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(700);
   const ok=await page.evaluate((id)=>{ const c=document.querySelector(`#feedList .lead-card[data-lead="${id}"]`); if(!c) return false; c.click(); return true; },id); if(!ok){ await page.click('#feedList .lead-card'); }
   await page.waitForTimeout(1100); }
 // Desktop: viewport cao để modal không cần cuộn → chụp trọn modal
 const ctx=await browser.newContext({viewport:{width:1440,height:3400},deviceScaleFactor:1.5}); const page=await ctx.newPage(); page.on('pageerror',e=>errs.push('d:'+e.message));
 await page.goto(`http://127.0.0.1:${port}/app.html#feed`); await page.waitForTimeout(1500); await loadFonts(page); const id=await enrich(page); await open(page,id);
 await page.addStyleTag({content:'.modal{max-height:none!important} .modal-bg{align-items:flex-start!important;padding-top:24px!important} .ld-actions{position:static!important}'}); await page.waitForTimeout(400);
 await page.locator('#modal').screenshot({path:`${OUT}/${TAG}-modal-full-1440.png`});
 for(const sel of ['#callBox','#fuBox','.ld-stage','.ld-tl','.ld-actions','#mNotes']){ const el=page.locator(sel).first(); if(await el.count()) await el.screenshot({path:`${OUT}/${TAG}-${sel.replace(/[^a-z]/gi,'')}-1440.png`}); }
 const info=await page.evaluate(()=>{ const cb=document.getElementById('callBox'); const rows=new Set([...cb.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top))).size; const st=document.querySelector('.mstages'); return {callRows:rows, stagesScroll: st.scrollWidth>st.clientWidth, stagesRows:new Set([...st.querySelectorAll('.mstage')].map(b=>Math.round(b.getBoundingClientRect().top))).size, modalH:document.getElementById('modal').scrollHeight}; });
 console.log(TAG,'1440',JSON.stringify(info));
 await ctx.close();
 // Mobile 390: toàn modal (viewport cao) + crop khối
 const mctx=await browser.newContext({viewport:{width:390,height:4000},deviceScaleFactor:2,isMobile:true,hasTouch:true}); const mp=await mctx.newPage(); mp.on('pageerror',e=>errs.push('m:'+e.message));
 await mp.goto(`http://127.0.0.1:${port}/app.html#feed`); await mp.waitForTimeout(1500); await loadFonts(mp); const mid=await enrich(mp); await open(mp,mid);
 await mp.addStyleTag({content:'.modal{max-height:none!important;height:auto!important} .modal-bg{align-items:flex-start!important} .ld-actions{position:static!important}'}); await mp.waitForTimeout(400);
 await mp.locator('#modal').screenshot({path:`${OUT}/${TAG}-modal-full-390.png`});
 for(const sel of ['#callBox','#fuBox','.ld-stage','.ld-actions']){ const el=mp.locator(sel).first(); if(await el.count()) await el.screenshot({path:`${OUT}/${TAG}-${sel.replace(/[^a-z]/gi,'')}-390.png`}); }
 const minfo=await mp.evaluate(()=>{ const cb=document.getElementById('callBox'); const rows=new Set([...cb.querySelectorAll('button')].map(b=>Math.round(b.getBoundingClientRect().top))).size; const st=document.querySelector('.mstages'); return {callRows:rows, stagesScroll: st.scrollWidth>st.clientWidth, modalH:document.getElementById('modal').scrollHeight, wide:document.documentElement.scrollWidth>window.innerWidth+2}; });
 console.log(TAG,'390',JSON.stringify(minfo));
 await mctx.close(); await browser.close(); server.close(); console.log('errors',JSON.stringify(errs)); console.log('DONE'); })().catch(e=>{console.log('ERR',e.stack);process.exit(1);});
