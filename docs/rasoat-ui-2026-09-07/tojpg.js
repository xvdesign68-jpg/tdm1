const http=require('http'),fs=require('fs'),path=require('path');
const DIR=process.env.DIR, OUT=process.env.OUTJ; const files=process.argv.slice(2);
const server=http.createServer((req,res)=>{ if(req.url==='/'){ res.setHeader('content-type','text/html'); return res.end('<html><body></body></html>'); } const f=path.join(DIR,decodeURIComponent(req.url.slice(1))); fs.readFile(f,(e,d)=>{ if(e){res.statusCode=404;return res.end();} res.setHeader('content-type','image/png'); res.end(d); }); });
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=c; }
 const browser=await chromium.launch({executablePath:exe,headless:true}); const page=await browser.newPage(); await page.goto(`http://localhost:${port}/`);
 const out={};
 for(const f of files){ const isM=/^(m|mt|login-m)/.test(f); const maxW=isM?430:1040; const q=isM?0.72:0.64;
   const data=await page.evaluate(async({url,maxW,q})=>{ const img=new Image(); img.src=url; await img.decode(); const sc=Math.min(1,maxW/img.naturalWidth); const c=document.createElement('canvas'); c.width=Math.round(img.naturalWidth*sc); c.height=Math.round(img.naturalHeight*sc); const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); x.drawImage(img,0,0,c.width,c.height); return {d:c.toDataURL('image/jpeg',q),w:c.width,h:c.height}; },{url:`/${f}.png`,maxW,q});
   out[f]=data; console.log(f, data.w+'x'+data.h, Math.round(data.d.length*0.75/1024)+'KB'); }
 fs.writeFileSync(OUT, JSON.stringify(out)); const tot=Object.values(out).reduce((a,b)=>a+b.d.length,0); console.log('TOTAL', Math.round(tot*0.75/1024/1024*10)/10,'MB');
 await browser.close(); server.close(); })();
