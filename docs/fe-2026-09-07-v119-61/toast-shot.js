/* chụp modal lead mobile 390 sau khi bấm "Sao chép gợi ý": node toast-shot.js <root> <out.png> [width] */
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(process.argv[2]), OUT=process.argv[3], W=+(process.argv[4]||390);
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{ const u=req.url.split('?')[0]; if(u.endsWith('firebase-config.min.js')||u.endsWith('firebase-config.js')){res.writeHead(200,{'content-type':'text/javascript'});return res.end('window.SL_CONFIG={MODE:"demo"};');}
  const fp=path.join(ROOT,u==='/'?'app.html':u); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);return res.end();} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); });
function findChrome(){ const base='/opt/pw-browsers'; for(const d of fs.readdirSync(base)) for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) return c; throw new Error('no chrome'); }
(async()=>{ const {chromium}=require(path.join(ROOT,'node_modules','playwright-core'));
  const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
  const browser=await chromium.launch({executablePath:findChrome(),headless:true}); const page=await browser.newPage({viewport:{width:W,height:844},deviceScaleFactor:2,isMobile:W<700,hasTouch:W<700});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/app.html#feed`); await page.waitForSelector('#feedList .lead-card',{timeout:20000}); await page.waitForTimeout(600);
  await page.evaluate(()=>{ const D=window.SL_DATA; const l=D.leads.find(x=>x.reply)||D.leads[0]; l.reply='Chào em, Z15 Miracle Vietnam đang tuyển cộng tác viên chốt đơn online. Bên chị thấy em có kinh nghiệm làm việc trong ngành bán hàng và nhu cầu tìm việc làm online, mức lương từ 1 triệu đến 2 triệu mỗi tháng phù hợp với thời gian rảnh. Em nhắn lại cho chị thời gian rảnh mỗi ngày để chị tư vấn kĩ hơn nhé.';
    window.__slShotId=l.id; const c=document.querySelector('#feedList .lead-card[data-lead="'+l.id+'"] [data-chatbox]'); (c||document.querySelector('#feedList .lead-card [data-chatbox]')).click(); });
  await page.waitForTimeout(900);
  await page.evaluate(()=>{ const m=document.getElementById('modal'); const cp=document.getElementById('copyReply'); if(cp){ cp.scrollIntoView({block:'center'}); } });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{ const cp=document.getElementById('copyReply'); cp&&cp.click(); });
  await page.waitForTimeout(350);
  const info=await page.evaluate(()=>{ const t=document.getElementById('toast'); if(!t) return 'NO TOAST'; const r=t.getBoundingClientRect(); return JSON.stringify({txt:t.textContent.slice(0,60)+(t.textContent.length>60?'…':''),len:t.textContent.length,w:Math.round(r.width),h:Math.round(r.height),top:Math.round(r.top),radius:getComputedStyle(t).borderRadius}); });
  await page.screenshot({path:OUT}); console.log('--- '+OUT+' --- '+info+(errs.length?'\nERR '+errs.join('|'):'')); await browser.close(); server.close(); })();
