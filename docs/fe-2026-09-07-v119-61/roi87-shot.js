/* chụp view ROI v119-87: node shot.js <root> <outdir> */
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(process.argv[2]), OUT=process.argv[3];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{ const u=req.url.split('?')[0]; if(u.endsWith('firebase-config.min.js')||u.endsWith('firebase-config.js')){res.writeHead(200,{'content-type':'text/javascript'});return res.end('window.SL_CONFIG={MODE:"demo"};');}
  const fp=path.join(ROOT,u==='/'?'app.html':u); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);return res.end();} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(fs.readFileSync(fp)); });
function findChrome(){ const base='/opt/pw-browsers'; for(const d of fs.readdirSync(base)) for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) return c; throw new Error('no chrome'); }
(async()=>{ const {chromium}=require(path.join(ROOT,'node_modules','playwright-core'));
  const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
  const browser=await chromium.launch({executablePath:findChrome(),headless:true});
  const errs=[];
  async function open(W,hash){ const page=await browser.newPage({viewport:{width:W,height:900},deviceScaleFactor:2}); page.on('pageerror',e=>errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/app.html#overview`); await page.waitForSelector('#view .kpi',{timeout:20000}); await page.waitForTimeout(500);
    await page.evaluate(h=>{ const D=window.SL_DATA; const now=Date.now();
      // gói giải pháp demo cho 3 brand + tham số riêng
      const bs=D.brands; if(bs[0]){ bs[0].plan={tier:'Pro',price:36000000,cycle:'quy',from:'2026-07-01',to:'2026-09-30'}; }
      if(bs[1]){ bs[1].plan={tier:'Growth',price:9800000,cycle:'thang',from:'2026-09-01',to:'2026-09-30'}; bs[1].roi=Object.assign({},bs[1].roi||{},{cplBasis:'hotwarm'}); }
      if(bs[2]){ bs[2].plan={tier:'Starter',price:60000000,cycle:'tron',from:'2026-03-01',to:'2026-08-31'}; }
      if(bs[3]){ bs[3].roi=Object.assign({},bs[3].roi||{},{feeSrc:'custom',fee:15000000,cplBasis:'both'}); }
      window.SLAuth.show('app',{},'superadmin'); location.hash=h; window.SLApp.reload(D); }, hash);
    await page.waitForTimeout(700);
    await page.evaluate(()=>{ document.documentElement.style.scrollBehavior='auto'; document.querySelectorAll('.view, #view').forEach(v=>v.style.scrollBehavior='auto'); });
    return page; }
  async function shotView(page,name,maxH){ // chụp toàn bộ #view (cuộn trong .view)
    const dims=await page.evaluate(()=>{ const v=document.querySelector('.view'); return {sh:v.scrollHeight, ch:v.clientHeight}; });
    const H=Math.min(dims.sh+120, maxH||6000);
    await page.setViewportSize({width:page.viewportSize().width,height:H}); await page.waitForTimeout(300);
    await page.screenshot({path:path.join(OUT,name),fullPage:false}); console.log(name,'h=',H); }
  // 1) super toàn cảnh 1440
  let p=await open(1440,'roi'); await shotView(p,'01-super-1440.png',3200);
  // 2) bấm dòng brand đầu → chi tiết + editor
  await p.evaluate(()=>{ const tr=document.querySelector('tr[data-roibrand]'); tr&&tr.click(); }); await p.waitForTimeout(600);
  await p.evaluate(()=>{ const c=document.getElementById('roiCfgCard'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); const v=document.querySelector('.view'); v.scrollTop=Math.max(0,v.scrollTop-60); }); await p.waitForTimeout(300);
  await p.setViewportSize({width:1440,height:2200}); await p.waitForTimeout(300);
  await p.evaluate(()=>{ const c=document.getElementById('roiCfgCard'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); const v=document.querySelector('.view'); v.scrollTop=Math.max(0,v.scrollTop-60); }); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(OUT,'02-super-detail-editor.png')}); console.log('02 detail');
  const txt=await p.evaluate(()=>{ const c=document.getElementById('roiCfgCard'); return c?c.innerText.replace(/\n{2,}/g,'\n').slice(0,2500):'(no cfg)'; }); console.log('--- detail text ---\n'+txt);
  // 3) Xem như khách
  await p.evaluate(()=>{ const b=document.getElementById('roiPreviewBtn'); b&&b.click(); }); await p.waitForTimeout(600);
  await p.evaluate(()=>{ const c=document.querySelector('.roi-preview'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); const v=document.querySelector('.view'); v.scrollTop=Math.max(0,v.scrollTop-100); }); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(OUT,'03-super-preview.png')}); console.log('03 preview');
  // 4) brand 2 (hotwarm) chi tiết
  await p.evaluate(()=>{ const trs=document.querySelectorAll('tr[data-roibrand]'); trs[1]&&trs[1].click(); }); await p.waitForTimeout(600);
  await p.evaluate(()=>{ const c=document.getElementById('roiCfgCard'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); const v=document.querySelector('.view'); v.scrollTop=Math.max(0,v.scrollTop-60); }); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(OUT,'04-super-detail-brand2.png')}); console.log('04 brand2');
  await p.close();
  // 5) Bảng brand chi tiết → nút Tài chính
  p=await open(1440,'agency'); await p.evaluate(()=>{ const tr=document.querySelector('#view tr[data-agy], #view [data-agy-row], #view tbody tr'); tr&&tr.click(); }); await p.waitForTimeout(600);
  await p.evaluate(()=>{ const d=document.getElementById('agyDetail'); d&&d.scrollIntoView({block:'start',behavior:'instant'}); const v=document.querySelector('.view'); v.scrollTop=Math.max(0,v.scrollTop-60); }); await p.waitForTimeout(300);
  await p.setViewportSize({width:1440,height:1400}); await p.waitForTimeout(300);
  await p.evaluate(()=>{ const d=document.getElementById('agyDetail'); d&&d.scrollIntoView({block:'start',behavior:'instant'}); const v=document.querySelector('.view'); v.scrollTop=Math.max(0,v.scrollTop-60); }); await p.waitForTimeout(300);
  await p.screenshot({path:path.join(OUT,'05-agency-detail.png')}); console.log('05 agency');
  await p.close();
  // 6) mobile 390 super
  p=await open(390,'roi'); await shotView(p,'06-super-390.png',5000); await p.close();
  // 7) brand user (admin) với cplBasis both
  p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2}); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`http://127.0.0.1:${port}/app.html#overview`); await p.waitForSelector('#view .kpi',{timeout:20000}); await p.waitForTimeout(500);
  await p.evaluate(()=>{ const D=window.SL_DATA; const b=D.brands[0]; b.plan={tier:'Pro',price:36000000,cycle:'quy',from:'2026-07-01',to:'2026-09-30'}; b.roi=Object.assign({},b.roi||{},{cplBasis:'both'}); D.myBrand=b; window.SLAuth.show('app',{brand:b.code,brandName:b.name},'admin'); location.hash='roi'; window.SLApp.reload(D); });
  await p.waitForTimeout(700); await p.evaluate(()=>{ document.querySelectorAll('.view, #view').forEach(v=>v.style.scrollBehavior='auto'); });
  await shotView(p,'07-brand-both-1440.png',3200); await p.close();
  console.log(errs.length?('ERR '+errs.join(' | ')):'no JS errors'); await browser.close(); server.close(); })();
