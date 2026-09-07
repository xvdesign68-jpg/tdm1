// Ghép ảnh so sánh: canvas cắt cùng vùng của 6 ảnh → lưới
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.cwd(); const MIME={'.html':'text/html; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); const f=path.join(root,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
const JOBS=JSON.parse(process.env.JOBS); // [{view, crop:[x,y,w,h], out, cols, scale}]
const KEYS=[['A-inter','A · Inter'],['B-geist','B · Geist'],['C-jakarta-inter','C · Plus Jakarta Sans + Inter'],['D-manrope','D · Manrope'],['E-cur-jakarta-bvp','E · Jakarta + Be Vietnam Pro (v119-64 hiện tại)'],['F-reddit','F · Reddit Sans']];
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true}); const page=await browser.newPage({viewport:{width:1200,height:800}});
 await page.goto(`http://127.0.0.1:${port}/`).catch(()=>{});
 for(const j of JOBS){
  const png=await page.evaluate(async({j,KEYS})=>{ KEYS=j.keys||KEYS;
   const [cx,cy,cw,ch]=j.crop, cols=j.cols||2, sc=j.scale||1, G=16, T=40; const rows=Math.ceil(KEYS.length/cols);
   const W=Math.round(cw*sc), H=Math.round(ch*sc)+T; const cv=document.createElement('canvas'); cv.width=cols*W+G*(cols+1); cv.height=rows*H+G*(rows+1); const c=cv.getContext('2d'); c.fillStyle='#EEF0F5'; c.fillRect(0,0,cv.width,cv.height);
   for(let i=0;i<KEYS.length;i++){ const [k,label]=KEYS[i]; const im=new Image(); im.src=`/ui/${k}-${j.view}.png`; await new Promise((r,e)=>{im.onload=r;im.onerror=e;});
     const x=G+(i%cols)*(W+G), y=G+Math.floor(i/cols)*(H+G); c.fillStyle='#1B2DCC'; c.fillRect(x,y,W,T); c.fillStyle='#fff'; c.font='600 20px sans-serif'; c.fillText(label,x+14,y+27);
     c.drawImage(im,cx,cy,cw,ch,x,y+T,W,Math.round(ch*sc)); }
   return cv.toDataURL('image/png'); },{j,KEYS});
  fs.writeFileSync(j.out,Buffer.from(png.split(',')[1],'base64')); console.log('ok',j.out); }
 await browser.close(); server.close(); })().catch(e=>{console.log('ERR',e.message);process.exit(1);});
