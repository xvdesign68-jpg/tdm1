/* Chụp các mục chính 1440 (font local) cho trang xem thử: SITE, FP, OUT, TAG env; INJECT = CSS chèn thêm (tuỳ chọn) */
const http=require('http'),fs=require('fs'),path=require('path');
const SITE=process.env.SITE, FP=process.env.FP, OUT=process.env.OUT, TAG=process.env.TAG, INJECT=process.env.INJECT||''; fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/') p='/app.html';
 if(p.endsWith('firebase-config.min.js')||p.endsWith('firebase-config.js')){ res.writeHead(200,{'content-type':'text/javascript'}); return res.end('window.SL_CONFIG={MODE:"demo"};'); }
 if(p.startsWith('/fp/')){ const f=path.join(FP,p.slice(4)); if(fs.existsSync(f)){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); return fs.createReadStream(f).pipe(res);} }
 const f=path.join(SITE,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){
  if(p==='/app.html'){ let h=fs.readFileSync(f,'utf8'); h=h.replace(/<link[^>]*fonts\.googleapis[^>]*>/g,'').replace(/<link[^>]*preconnect[^>]*>/g,''); h=h.replace('</head>','<link rel="stylesheet" href="/fp/fonts.css">'+(INJECT?'<style>'+INJECT+'</style>':'')+'</head>'); res.writeHead(200,{'content-type':MIME['.html']}); return res.end(h); }
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1500},deviceScaleFactor:1.5}); const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/app.html`); await page.waitForTimeout(1500);
 await page.evaluate(async()=>{ for(const f of ['TikTok Sans','Plus Jakarta Sans','JetBrains Mono']) for(const w of [400,450,500,600,700,800]) { try{ await document.fonts.load(`${w} 14px "${f}"`,'Ab'); }catch(e){} } await document.fonts.ready; });
 const shot=async(name)=>{ await page.waitForTimeout(400); await page.screenshot({path:`${OUT}/${TAG}-${name}.jpg`,type:'jpeg',quality:82}); };
 for(const v of ['overview','feed','pipeline','reports','agency','outreach','roi','history']){ await page.evaluate((v)=>{ document.querySelector(`.nav-item[data-view="${v}"]`).click(); },v); await page.waitForTimeout(1200); await page.evaluate(()=>{ const vw=document.querySelector('.view'); if(vw){ vw.style.scrollBehavior='auto'; vw.scrollTop=0; } }); await shot(v); }
 await page.evaluate(()=>{ document.querySelector('.nav-item[data-view="feed"]').click(); }); await page.waitForTimeout(800); await page.click('#feedList .lead-card [data-chatbox]'); await page.waitForTimeout(1000); await shot('modal');
 await ctx.close(); await browser.close(); server.close(); console.log('DONE '+TAG+(errs.length?' ERR '+errs.join('|'):'')); })().catch(e=>{console.log('ERR',e.stack);process.exit(1);});
