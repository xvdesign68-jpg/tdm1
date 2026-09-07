// Render chính SmartLead (cây w62 = v119-65, demo) với từng cặp font → chụp overview/feed/agency 1440 + feed 390
const http=require('http'),fs=require('fs'),path=require('path');
const SITE=process.env.SITE, FP=path.join(process.cwd(),'fp'), OUT=process.env.OUT||'ui';
const PAIRS=JSON.parse(process.env.PAIRS);
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
 for(const pr of PAIRS){
  const css=`:root{--font:'${pr.body}',sans-serif !important;--font-head:'${pr.head}',sans-serif !important}${pr.extra||''}`;
  const ctx=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1.5}); const page=await ctx.newPage(); page.on('pageerror',e=>console.log('PAGEERROR',pr.key,e.message));
  await page.goto(`http://127.0.0.1:${port}/app.html`); await page.addStyleTag({content:css}); await page.waitForTimeout(1500);
  await page.evaluate(async({h,b})=>{ for(const w of [400,500,600,700,800]){ await document.fonts.load(`${w} 14px "${h}"`,'Ab'); await document.fonts.load(`${w} 14px "${b}"`,'Ab'); } await document.fonts.ready; },{h:pr.head,b:pr.body});
  const chk=await page.evaluate(({h,b})=>({body:getComputedStyle(document.body).fontFamily.slice(0,40),h1:getComputedStyle(document.getElementById('vTitle')).fontFamily.slice(0,40),okH:document.fonts.check(`700 14px "${h}"`),okB:document.fonts.check(`400 14px "${b}"`)}),{h:pr.head,b:pr.body});
  console.log(pr.key, JSON.stringify(chk));
  for(const v of ['overview','feed','agency','pipeline']){ const n=await page.$(`.nav-item[data-view="${v}"]`); if(!n){console.log('no view',v);continue;} await page.evaluate((v)=>{ document.querySelector(`.nav-item[data-view="${v}"]`).click(); },v); await page.waitForTimeout(1200); await page.screenshot({path:`${OUT}/${pr.key}-${v}.png`}); }
  await page.evaluate(()=>{ document.querySelector('.nav-item[data-view="feed"]').click(); }); await page.waitForTimeout(800); await page.click('#feedList .lead-card'); await page.waitForTimeout(900); await page.screenshot({path:`${OUT}/${pr.key}-modal.png`});
  await ctx.close();
  const mctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true}); const mp=await mctx.newPage();
  await mp.goto(`http://127.0.0.1:${port}/app.html`); await mp.addStyleTag({content:css}); await mp.waitForTimeout(1500);
  await mp.evaluate(()=>{ location.hash='feed'; window.SLApp.reload(window.SL_DATA); }); await mp.waitForTimeout(800); await mp.screenshot({path:`${OUT}/${pr.key}-m-feed.png`});
  await mp.evaluate(()=>{ location.hash='overview'; window.SLApp.reload(window.SL_DATA); }); await mp.waitForTimeout(800); await mp.screenshot({path:`${OUT}/${pr.key}-m-overview.png`});
  await mctx.close(); console.log('done',pr.key);
 }
 await browser.close(); server.close(); })().catch(e=>{console.log('ERR',e.stack);process.exit(1);});
