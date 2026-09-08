// Ghép 2 ảnh trước/sau cạnh nhau bằng Chromium (không có PIL). node stitch.js <a.png> <b.png> <out.png> <nhãnA> <nhãnB>
const fs=require('fs'),path=require('path'); const [a,b,out,la,lb]=process.argv.slice(2);
(async()=>{ const {chromium}=require('playwright-core'); const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const A='data:image/png;base64,'+fs.readFileSync(a).toString('base64'), B='data:image/png;base64,'+fs.readFileSync(b).toString('base64');
 const html=`<html><body style="margin:0;background:#f4f5fa;font-family:sans-serif"><div id="w" style="display:inline-flex;gap:40px;padding:20px;align-items:flex-start"><div><div style="font:700 26px sans-serif;color:#3c3c50;margin:0 0 12px">${la}</div><img id="ia" src="${A}"></div><div><div style="font:700 26px sans-serif;color:#1B2DCC;margin:0 0 12px">${lb}</div><img id="ib" src="${B}"></div></div></body></html>`;
 const browser=await chromium.launch({executablePath:exe,headless:true}); const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
 await page.setContent(html); await page.waitForTimeout(300);
 const box=await page.evaluate(()=>{ const ia=document.getElementById('ia'), ib=document.getElementById('ib'); ia.style.width=(ia.naturalWidth/2)+'px'; ib.style.width=(ib.naturalWidth/2)+'px'; const r=document.getElementById('w').getBoundingClientRect(); return {w:Math.ceil(r.width),h:Math.ceil(r.height)}; });
 await page.setViewportSize({width:box.w,height:box.h}); await page.waitForTimeout(200);
 await page.locator('#w').screenshot({path:out}); await browser.close(); console.log('OK',out,box); })();
