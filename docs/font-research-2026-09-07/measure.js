// Đo metric từng font (Chromium thật): độ rộng đoạn tiếng Việt 14px (so Inter), x-height/cap-height, có tabular figures (tnum) không, độ rộng chữ số
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.cwd(); const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); const f=path.join(root,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
const FAMS=JSON.parse(fs.readFileSync('sizes.json','utf8'));
const SAMPLE='Cần agency chạy Facebook ads trọn gói cho spa, và team quay video khai trương cơ sở mới ở Q7. Chị Hương · Hội chủ Spa – Thẩm mỹ viện Việt Nam · Đỗ Minh Hương, Nguyễn Quỳnh, Phạm Đức Thịnh · 1.284 lead · 4,4% · 12.500.000 ₫';
fs.writeFileSync('measure.html',`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fp/fonts.css"><style>body{margin:0}span{white-space:nowrap;font-size:14px;line-height:1}</style><div id="host"></div>`);
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true}); const page=await browser.newPage();
 await page.goto(`http://127.0.0.1:${port}/measure.html`);
 // ép nạp mọi font
 await page.evaluate(async(fams)=>{ for(const f of fams){ for(const w of [400,500,600,700]) await document.fonts.load(`${w} 14px "${f}"`,'Tiếng Việt 0123'); } await document.fonts.ready; }, Object.keys(FAMS));
 const res=await page.evaluate(({fams,SAMPLE})=>{
   const out={}; const host=document.getElementById('host');
   const cv=document.createElement('canvas').getContext('2d');
   for(const f of fams){
     const ok=document.fonts.check(`14px "${f}"`);
     const sp=document.createElement('span'); sp.style.fontFamily=`"${f}"`; sp.textContent=SAMPLE; host.appendChild(sp); const w=sp.getBoundingClientRect().width; sp.remove();
     cv.font=`400 100px "${f}"`; const mx=cv.measureText('x'), mH=cv.measureText('H');
     const xh=mx.actualBoundingBoxAscent/100, cap=mH.actualBoundingBoxAscent/100;
     // tabular: so độ rộng '1111' vs '8888' khi bật tnum
     const t=document.createElement('span'); t.style.fontFamily=`"${f}"`; t.style.fontFeatureSettings='"tnum"'; t.textContent='1111'; host.appendChild(t); const w1=t.getBoundingClientRect().width; t.textContent='8888'; const w8=t.getBoundingClientRect().width; t.style.fontFeatureSettings='normal'; t.textContent='1111'; const p1=t.getBoundingClientRect().width; t.textContent='8888'; const p8=t.getBoundingClientRect().width; t.remove();
     out[f]={ok, width:Math.round(w*10)/10, xh:Math.round(xh*1000)/1000, cap:Math.round(cap*1000)/1000, tnum:Math.abs(w1-w8)<0.6, propDigits:Math.abs(p1-p8)>=0.6, digitW:Math.round(w8/4*100)/100};
   }
   return out; }, {fams:Object.keys(FAMS), SAMPLE});
 const inter=res['Inter'].width;
 const rows=Object.entries(res).map(([f,m])=>({font:f, ok:m.ok, widthVsInter:Math.round((m.width/inter-1)*1000)/10, xHeight:m.xh, capHeight:m.cap, tnum:m.tnum, digitW:m.digitW, kb:Math.round(FAMS[f].bytes/1024)})).sort((a,b)=>a.widthVsInter-b.widthVsInter);
 console.log('font                 nạp  rộng vs Inter  x-height  cap  tnum  chữsố(px)  KB(vi+latin, 4 weight)');
 for(const r of rows) console.log(r.font.padEnd(20), r.ok?'✓':'✗', String(r.widthVsInter).padStart(7)+'%', String(r.xHeight).padStart(9), String(r.capHeight).padStart(5), r.tnum?'  ✓ ':'  ✗ ', String(r.digitW).padStart(8), String(r.kb).padStart(6));
 fs.writeFileSync('metrics.json',JSON.stringify(rows,null,1));
 await browser.close(); server.close(); })();
