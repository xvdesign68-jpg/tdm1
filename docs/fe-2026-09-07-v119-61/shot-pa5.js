/* chụp v119-92 (PA-5): 01 thẻ lead bôi 3 số + nút Dùng + dòng bình luận thêm · 02 modal khối bình luận thêm + Kiểm Zalo · 03 hộp thoại Dùng số này. node shot-pa5.js <root> <outdir> */
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
  await page.evaluate(()=>{ const D=window.SL_DATA; const L=D.leads.filter(x=>!x.dropped&&!x.lost&&x.temp==='hot'); const a=L[0], b=L[1];
    a.text='Cần mua 20 kg mực khô loại 1 giao Q7, liên hệ 0912 345 678 hoặc 0987 654 321, giờ hành chính gọi số bàn 028 3822 1234'; a.phone='+84912345678';
    b.text='Cần tìm nơi bán mực khô ngon giao tận nơi, ai có ib mình'; b.text_extra='Ai cần thì ib mình hoặc gọi 0905 111 222 nhé, mình lấy số lượng lớn'; b.phone='+84905111222'; b.phone_has_zalo=null; b.contact_source='comment';
    location.hash='feed'; window.SLApp.reload(D); window.__a=a.id; window.__b=b.id; }); await page.waitForTimeout(600);
  await page.evaluate(()=>{ const v=document.querySelector('.view'); v.style.scrollBehavior='auto'; const c=document.querySelector('#feedList [data-lead="'+window.__a+'"]'); c&&c.scrollIntoView({block:'start',behavior:'instant'}); v.scrollTop=Math.max(0,v.scrollTop-20); }); await page.waitForTimeout(300);
  await page.setViewportSize({width:1440,height:1000}); await page.waitForTimeout(200); await page.screenshot({path:path.join(OUT,'01-feed-phones.png')}); console.log('01');
  await page.evaluate(()=>{ const btn=document.querySelector('#feedList [data-lead="'+window.__a+'"] .ph-use[data-usephone="+84987654321"]'); btn&&btn.click(); }); await page.waitForTimeout(400);
  await page.screenshot({path:path.join(OUT,'03-dialog-dung-so-nay.png')}); console.log('03');
  await page.evaluate(()=>{ const d=document.getElementById('slDlg'); const b=d&&d.querySelector('[data-dlg="0"]'); b&&b.click(); }); await page.waitForTimeout(300);
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>{ const b=document.querySelector('#feedList [data-lead="'+window.__b+'"] [data-chatbox]'); b&&b.click(); }); await page.waitForTimeout(700);
  await page.evaluate(()=>{ const x=document.querySelector('#modal .ld-extra'); x&&x.scrollIntoView({block:'center',behavior:'instant'}); const m=document.querySelector('#modal .modal-body'); if(m) m.scrollTop=0; }); await page.waitForTimeout(300);
  await page.screenshot({path:path.join(OUT,'02-modal-extra-zalo.png')}); console.log('02');
  console.log('errs',errs); await browser.close(); server.close(); })().catch(e=>{ console.error(e); process.exit(1); });
