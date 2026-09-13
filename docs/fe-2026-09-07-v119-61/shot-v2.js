/* chụp v119-91 (LỆNH E): 01 Chấm điểm AI card v2 · 02 modal lead khối Phân tích điểm v2 + chip Đại lý · 03 popup Bài đã quét reseller. node shot-v2.js <root> <outdir> */
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(process.argv[2]), OUT=process.argv[3]; fs.mkdirSync(OUT,{recursive:true});
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{ const u=req.url.split('?')[0]; if(u.endsWith('firebase-config.min.js')||u.endsWith('firebase-config.js')){res.writeHead(200,{'content-type':'text/javascript'});return res.end('window.SL_CONFIG={MODE:"demo"}');}
  const fp=path.join(ROOT,u==='/'?'app.html':u); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);return res.end();} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(fs.readFileSync(fp)); });
function findChrome(){ const base='/opt/pw-browsers'; for(const d of fs.readdirSync(base)) for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) return c; throw new Error('no chrome'); }
(async()=>{ const {chromium}=require(path.join(ROOT,'node_modules','playwright-core'));
  const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
  const browser=await chromium.launch({executablePath:findChrome(),headless:true}); const errs=[];
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}); page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/app.html#overview`); await page.waitForSelector('#view .kpi',{timeout:20000}); await page.waitForTimeout(500);
  await page.evaluate(()=>{ window.SLAuth.show('app',{},'superadmin'); document.documentElement.style.scrollBehavior='auto'; });
  // 01 Chấm điểm AI — card v2
  await page.evaluate(()=>{ location.hash='scoring'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(700);
  await page.evaluate(()=>{ const c=document.getElementById('scV2Card'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); const v=document.querySelector('.view'); v.style.scrollBehavior='auto'; v.scrollTop=Math.max(0,v.scrollTop-40); }); await page.waitForTimeout(300);
  await page.setViewportSize({width:1440,height:1300}); await page.waitForTimeout(300); await page.screenshot({path:path.join(OUT,'01-scoring-v2.png')}); console.log('01');
  // 02 modal lead: reseller + ai_v2
  await page.evaluate(()=>{ const D=window.SL_DATA; const L=D.leads.filter(x=>!x.dropped&&!x.lost&&x.temp==='hot'); const a=L[0]; a.role='reseller'; a.role_reason='hỏi nhập sỉ 20 kg mực khô về bán ở quán'; a.ai_v2={v:1,mode:'shadow',raw:a.score,score:72,criteria:{intent:3,fit:2,timing:2,industry:3,area:2,quality:2},conf:0.8,why:['cần nhập 20 kg','hỏi giá sỉ','đã có quán'],w:'30/25/15/12/8/10'}; const b=L[1]; b.role='proxy'; b.contact_via_poster=true; location.hash='feed'; window.SLApp.reload(D); window.__a=a.id; }); await page.waitForTimeout(600);
  await page.setViewportSize({width:1440,height:900}); await page.evaluate(()=>{ const c=document.querySelector('#feedList [data-lead="'+window.__a+'"]'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); }); await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,'02a-feed-chips.png')}); console.log('02a');
  await page.evaluate(()=>{ const b=document.querySelector('#feedList [data-lead="'+window.__a+'"] [data-chatbox]'); b&&b.click(); }); await page.waitForTimeout(700);
  await page.evaluate(()=>{ const v2=document.querySelector('#modal .ld-v2'); v2&&v2.scrollIntoView({block:'center',behavior:'instant'}); }); await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,'02b-modal-v2.png')}); console.log('02b');
  await page.evaluate(()=>{ const c=document.querySelector('#modal #mClose'); c&&c.click(); }); await page.waitForTimeout(300);
  // 03 Bài đã quét: reseller + too_old + popup
  await page.evaluate(()=>{ const D=window.SL_DATA; const sp=D.scannedPosts||[]; const base=sp[0]||{}; sp.unshift(Object.assign({},base,{id:'k91r',decision:'reseller',score:78,role:'reseller',kind:'post',author:'Quán Nhậu Bờ Kè',text:'Cần nhập sỉ 50 kg mực khô loại 1 về bán, ai có báo giá sỉ giúp mình',post_url:'https://www.facebook.com/groups/1/posts/9191/',ai_v2:{v:1,mode:'shadow',raw:78,score:70,criteria:{intent:3,fit:2,timing:2,industry:3,area:2,quality:2},conf:0.7,why:['nhập sỉ 50 kg','hỏi báo giá'],w:'30/25/15/12/8/10'}}),Object.assign({},base,{id:'k91o',decision:'too_old',score:0,kind:'post',author:'Bài cũ',text:'Bài đăng từ 60 ngày trước',post_url:'https://www.facebook.com/groups/1/posts/9192/'})); location.hash='scanned'; window.SLApp.reload(D); }); await page.waitForTimeout(700);
  await page.screenshot({path:path.join(OUT,'03a-scanned.png')}); console.log('03a');
  await page.evaluate(()=>{ const r=document.querySelector('#view .sp-open[data-sp="0"]'); r&&r.click(); }); await page.waitForTimeout(600);
  await page.screenshot({path:path.join(OUT,'03b-scanned-popup.png')}); console.log('03b');
  console.log('errs', errs); await browser.close(); server.close(); })().catch(e=>{ console.error(e); process.exit(1); });
