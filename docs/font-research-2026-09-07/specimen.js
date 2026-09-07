// Trang mẫu: cùng nội dung SmartLead (KPI, thẻ lead, tiêu đề, nhãn nhỏ, chữ số) render bằng từng font → 1 ảnh lưới để so mắt thường
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.cwd(); const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.woff2':'font/woff2','.png':'image/png'};
const server=http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); const f=path.join(root,p); if(fs.existsSync(f)&&fs.statSync(f).isFile()){ res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);} else { res.writeHead(404); res.end('nf'); } });
const PAIRS=JSON.parse(process.env.PAIRS); // [{name, head, body}]
const cell=(p)=>`<div class="cell" style="--fh:'${p.head}';--fb:'${p.body}'">
 <div class="tag">${p.name}</div>
 <h1>Bảng điều khiển</h1><div class="sub">Việc cần làm hôm nay và hiệu quả lead</div>
 <div class="kpis"><div class="kpi"><div class="l">Lead hợp lệ</div><div class="n">1.284</div><div class="d">▲ 12% so 14 ngày trước</div></div><div class="kpi"><div class="l">Tỷ lệ chốt</div><div class="n">4,4%</div><div class="d">▼ 0,3 điểm</div></div></div>
 <div class="card"><div class="row"><span class="score">94</span><b class="nm">Chị Hương</b><span class="chip hot">Nóng</span><span class="chip ok">SĐT có Zalo</span></div>
  <div class="src">Hội chủ Spa – Thẩm mỹ viện Việt Nam · 2 phút trước</div>
  <p>Có bên nào làm marketing trọn gói cho spa không ạ? Mình đang cần chạy lead gấp cho cơ sở mới khai trương ở Q7, ngân sách ~30tr/tháng. Ai nhận làm inbox hoặc gọi/Zalo giúp mình số <code>0938 123 456</code> nhé.</p>
  <div class="btns"><span class="btn ghost">Ghi chú</span><span class="btn ghost">Mở bài gốc</span><span class="btn pri">Chi tiết →</span></div></div>
 <div class="tbl"><div class="th">Mã · Tên hiển thị · Số người dùng · Khung thời gian</div><div class="td">hscl-01 · Hải Sản Cường Linh · 3 · Từ 30/08/2026 → mãi về sau</div><div class="td">z15mrc-tts-1 · Tuyển dụng TTS · 2 · 12.500.000 ₫ · Đỗ Minh Hương, Nguyễn Quỳnh, Phạm Đức Thịnh</div></div>
 <div class="nav">Tổng quan · Lead mới · Hộp việc · Pipeline · Chấm điểm AI · Từ khoá & bộ lọc · Tiếp cận</div>
</div>`;
const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/fp/fonts.css"><style>
body{margin:0;background:#F5F5F7;padding:14px;font-size:14px;color:#16182B;-webkit-font-smoothing:antialiased}
.grid{display:grid;grid-template-columns:repeat(${process.env.COLS||3},1fr);gap:14px}
.cell{background:#fff;border:1px solid #E6E8F0;border-radius:16px;padding:16px 18px;font-family:var(--fb),sans-serif;position:relative;overflow:hidden}
.tag{position:absolute;right:12px;top:10px;font:600 11px/1 var(--fh),sans-serif;color:#fff;background:#1B2DCC;padding:5px 9px;border-radius:99px}
h1{font:700 22px/1.15 var(--fh),sans-serif;letter-spacing:-.02em;margin:0 0 3px}.sub{font-size:13px;color:#6B7194;margin-bottom:12px}
.kpis{display:flex;gap:10px;margin-bottom:12px}.kpi{flex:1;border:1px solid #E6E8F0;border-radius:12px;padding:10px 12px}.kpi .l{font-size:12.5px;color:#6B7194}.kpi .n{font:700 28px/1.1 var(--fh),sans-serif;letter-spacing:-.03em;font-variant-numeric:tabular-nums;margin:4px 0}.kpi .d{font:600 11.5px/1.2 var(--fh),sans-serif;color:#0F8A5F}
.card{border:1px solid #E6E8F0;border-radius:14px;padding:12px 14px;margin-bottom:12px}.row{display:flex;align-items:center;gap:8px;margin-bottom:4px}.score{font:700 14px/1 var(--fh),sans-serif;color:#C81118;border:2px solid #C81118;border-radius:50%;width:32px;height:32px;display:grid;place-items:center}.nm{font:700 15px/1.2 var(--fh),sans-serif}
.chip{font:600 11px/1 var(--fh),sans-serif;padding:4px 9px;border-radius:99px;letter-spacing:.02em}.hot{background:#FDE8E9;color:#C81118}.ok{background:#E3F6EC;color:#0F8A5F}
.src{font-size:12px;color:#6B7194;margin-bottom:6px}p{margin:0 0 10px;line-height:1.55}code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;background:#EEF0FF;color:#1B2DCC;padding:1px 6px;border-radius:6px}
.btns{display:flex;gap:8px;justify-content:flex-end}.btn{font:600 13px/1.2 var(--fh),sans-serif;padding:8px 14px;border-radius:10px;border:1px solid #DADEEA}.pri{background:#1B2DCC;color:#fff;border-color:#1B2DCC}
.tbl{border:1px solid #E6E8F0;border-radius:12px;overflow:hidden;margin-bottom:10px}.th{font:600 11px/1.2 var(--fh),sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#8A91A8;padding:9px 12px;background:#FAFAFC}.td{padding:8px 12px;border-top:1px solid #EEF0F5;font-size:13.5px}
.nav{font:500 13.5px/1.3 var(--fh),sans-serif;color:#3A3F5C}
</style><div class="grid">${PAIRS.map(cell).join('')}</div>`;
fs.writeFileSync('specimen.html',html);
(async()=>{ const {chromium}=require('playwright-core'); const port=await new Promise(r=>server.listen(0,()=>r(server.address().port)));
 const base='/opt/pw-browsers'; let exe=null; for(const d of fs.readdirSync(base)){ for(const c of [`${base}/${d}/chrome-linux/headless_shell`,`${base}/${d}/chrome-linux/chrome`]) if(fs.existsSync(c)) exe=exe||c; }
 const browser=await chromium.launch({executablePath:exe,headless:true}); const page=await browser.newPage({viewport:{width:Number(process.env.W||1500),height:900},deviceScaleFactor:2});
 await page.goto(`http://127.0.0.1:${port}/specimen.html`); await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(500);
 await page.screenshot({path:process.env.OUT||'specimen.png',fullPage:true}); console.log('shot',process.env.OUT||'specimen.png'); await browser.close(); server.close(); })();
