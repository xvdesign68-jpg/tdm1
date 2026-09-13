/* chụp v119-93 (PC-3): 01 thẻ lead chip "Khách cũ quay lại · đã chốt" + Nên gọi tiếp theo · 02 modal lead có chip · 03 popup Bài đã quét "Người bán quen · bỏ trước AI" + nút Không phải người bán. node shot-pc3.js <root> <outdir> */
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
  await page.evaluate(()=>{ const D=window.SL_DATA; const L=D.leads.filter(x=>!x.dropped&&!x.lost&&x.temp==='hot'&&x.stage!=='closed'); const a=L[0], o=L[1];
    a.returning=true; a.returning_lead_id=o.id; a.returning_stage='closed'; a.returning_at=Date.now()-5*864e5; a.returning_assignee='An Nguyễn'; a.score=99; a.name=o.name;
    location.hash='feed'; window.SLApp.reload(D); window.__a=a.id; }); await page.waitForTimeout(600);
  await page.evaluate(()=>{ const v=document.querySelector('.view'); v.style.scrollBehavior='auto'; const c=document.querySelector('#feedList [data-lead="'+window.__a+'"]'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); v.scrollTop=Math.max(0,v.scrollTop-150); }); await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,'01-feed-returning.png')}); console.log('01');
  await page.evaluate(()=>{ const b=document.querySelector('#feedList [data-lead="'+window.__a+'"] [data-chatbox]'); b&&b.click(); }); await page.waitForTimeout(700);
  await page.screenshot({path:path.join(OUT,'02-modal-returning.png')}); console.log('02');
  await page.evaluate(()=>{ const cl=document.querySelector('#modal #mClose'); cl&&cl.click(); }); await page.waitForTimeout(300);
  await page.evaluate(()=>{ const D=window.SL_DATA; const sp=D.scannedPosts||[]; const base=sp[0]||{}; sp.unshift(Object.assign({},base,{id:'k93s',decision:'seller_known',score:0,role:'seller',memHits:3,author_key:'id:100093093093093',kind:'post',author:'Shop Mực Khô Cô Tô',text:'Mực khô Cô Tô loại 1 giá sỉ 450k/kg, ship toàn quốc, ib em nhé',post_url:'https://www.facebook.com/groups/1/posts/9393/'})); location.hash='scanned'; window.SLApp.reload(D); }); await page.waitForTimeout(700);
  await page.evaluate(()=>{ const row=document.querySelector('#view .sp-open[data-sp="0"]'); row&&row.click(); }); await page.waitForTimeout(600);
  await page.evaluate(()=>{ const m=document.querySelector('#modal .modal-body'); if(m) m.scrollTop=m.scrollHeight; }); await page.waitForTimeout(200);
  await page.screenshot({path:path.join(OUT,'03-scanned-seller-known.png')}); console.log('03');
  console.log(errs.length?('ERRORS '+errs.join(' | ')):'no JS errors'); await browser.close(); server.close(); })().catch(e=>{ console.error(e); process.exit(1); });
