// Soi dấu tiếng Việt cỡ lớn: mỗi font 2 dòng (400 và 700) → 1 ảnh
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.cwd(); const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); const f=path.join(root,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
const FAMS=JSON.parse(process.env.FAMS);
const S1='Đỗ Quỳnh · Phạm Đức Thịnh · Hải Sản Cường Linh · ấầẩẫậ ếềểễệ ốồổỗộ ớờởỡợ ứừửữự ảỉỏủỷ';
const S2='Bảng điều khiển · Tổng quan · Chấm điểm AI · ẤẦẨẪẬ ẾỀỂỄỆ ỐỒỔỖỘ ỚỜỞỠỢ ỨỪỬỮỰ 0123456789';
const rows=FAMS.map(f=>`<div class="r" style="font-family:'${f}'"><div class="n">${f}</div><div class="a">${S1}</div><div class="b">${S2}</div><div class="c">Có bên nào làm marketing trọn gói cho spa không ạ? Mình đang cần chạy lead gấp cho cơ sở mới khai trương ở Q7, ngân sách ~30tr/tháng · 12.500.000 ₫ · 1.284 lead · 4,4%</div></div>`).join('');
fs.writeFileSync('diacritics.html',`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fp/fonts.css"><style>body{margin:0;padding:16px;background:#fff;color:#16182B;-webkit-font-smoothing:antialiased}.r{border-bottom:1px solid #E6E8F0;padding:10px 0 12px}.n{font:600 11px/1 system-ui;color:#1B2DCC;margin-bottom:6px;letter-spacing:.05em;text-transform:uppercase}.a{font-size:30px;line-height:1.35;font-weight:400}.b{font-size:30px;line-height:1.35;font-weight:700;letter-spacing:-.01em}.c{font-size:13px;line-height:1.5;margin-top:4px;color:#3A3F5C}</style>${rows}`);
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true}); const page=await browser.newPage({viewport:{width:Number(process.env.W||1400),height:900},deviceScaleFactor:2});
 await page.goto(`http://127.0.0.1:${port}/diacritics.html`); await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(600);
 await page.screenshot({path:process.env.OUT||'diacritics.png',fullPage:true}); console.log('shot'); await browser.close(); server.close(); })();
