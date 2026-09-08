// Chụp card "Hôm nay" (Overview) ở 2000 / 1440 / 1024 / 390. SITE, OUT, TAG; CSS=<file css inject tuỳ chọn>
const http=require('http'),fs=require('fs'),path=require('path');
const SITE=process.env.SITE, FP=path.join(__dirname,'..','geist','fp'), OUT=process.env.OUT, TAG=process.env.TAG||'x', CSS=process.env.CSS?fs.readFileSync(process.env.CSS,'utf8'):''; fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/app.html';
 if(p.endsWith('firebase-config.min.js')||p.endsWith('firebase-config.js')){ res.writeHead(200,{'content-type':'text/javascript'}); return res.end('window.SL_CONFIG={MODE:"demo"};'); }
 if(p.startsWith('/fp/')){ const f=path.join(FP,p.slice(4)); if(fs.existsSync(f)){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); return fs.createReadStream(f).pipe(res);} }
 const f=path.join(SITE,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){
  if(p==='/app.html'){ let h=fs.readFileSync(f,'utf8'); h=h.replace(/<link[^>]*fonts\.googleapis[^>]*>/g,'').replace(/<link[^>]*preconnect[^>]*>/g,''); h=h.replace('</head>','<link rel="stylesheet" href="/fp/fonts.css"></head>'); res.writeHead(200,{'content-type':'text/html; charset=utf-8'}); return res.end(h); }
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true});
 for(const [w,h,dpr,mobile] of [[2000,900,1.5,false],[1440,900,1.5,false],[1024,900,1.5,false],[390,844,2,true]]){
  const ctx=await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr,isMobile:mobile,hasTouch:mobile}); const page=await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/app.html#overview`); await page.waitForTimeout(1500);
  await page.evaluate(async()=>{ for(const f of ['TikTok Sans','Plus Jakarta Sans','JetBrains Mono']) for(const w of [400,450,500,600,700,800]) { try{ await document.fonts.load(`${w} 14px "${f}"`,'Ab'); }catch(e){} } await document.fonts.ready; });
  // làm số giống ảnh anh: 3 mới · 133 nóng chưa chăm · 1 quá hẹn · 0 hẹn · 2 phản hồi · 0 chốt (demo có sẵn số khác → chỉ chụp nguyên trạng demo)
  await page.evaluate(()=>{ location.hash='overview'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(900);
  if(CSS) await page.addStyleTag({content:CSS});
  await page.waitForTimeout(300);
  const el=page.locator('.td-card').first(); await el.screenshot({path:`${OUT}/${TAG}-today-${w}.png`});
  const info=await page.evaluate(()=>{ const c=document.querySelector('.td-card'); const tiles=[...c.querySelectorAll('.td-tile')]; return {h:Math.round(c.getBoundingClientRect().height), tiles:tiles.length, rows:new Set(tiles.map(t=>Math.round(t.getBoundingClientRect().top))).size, tw:Math.round(tiles[0].getBoundingClientRect().width)}; });
  console.log(TAG,w,JSON.stringify(info)); await ctx.close(); }
 await browser.close(); server.close(); console.log('DONE'); })().catch(e=>{console.log('ERR',e.stack);process.exit(1);});
