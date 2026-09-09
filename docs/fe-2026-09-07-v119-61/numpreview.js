/* Dựng trang xem thử "So font chữ số": node numpreview.js <dir ảnh> <out.html> */
const fs=require('fs'),path=require('path'); const DIR=process.argv[2], OUT=process.argv[3];
const VIEWS=[['overview','Bảng điều khiển'],['feed','Lead mới'],['modal','Chi tiết lead'],['pipeline','Pipeline'],['reports','Báo cáo'],['agency','Bảng brand'],['roi','Giá trị & ROI'],['history','Lịch sử quét'],['outreach','Tiếp cận']];
const STATES=[['cur','Hiện tại (v119-84)','4 font số lẫn nhau'],['B','TikTok Sans (v119-85, đã áp)','mọi chữ số 1 font — khớp chốt 08/09'],['A','Plus Jakarta Sans','mọi chữ số dùng font tiêu đề — đổi 1 dòng token']];
const b64=f=>'data:image/jpeg;base64,'+fs.readFileSync(f).toString('base64');
let imgs=''; for(const [s] of STATES) for(const [v] of VIEWS){ const f=path.join(DIR,`${s}-${v}.jpg`); if(fs.existsSync(f)) imgs+=`<img data-s="${s}" data-v="${v}" src="${b64(f)}" alt="${s} ${v}" hidden>`; }
const html=`<title>So font chữ số</title>
<style>
:root{--bg:#f6f7fb;--card:#fff;--ink:#16182b;--ink2:#5b6178;--line:#e3e6f0;--brand:#1b2dcc;--brand-bg:#eef1fe;--ok:#0f7b3d;--ok-bg:#e7f7ee;--warn:#b45309;--warn-bg:#fff4e0}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111420;--card:#1a1e2e;--ink:#eef0f7;--ink2:#a3a9c2;--line:#2b3046;--brand:#8b9cff;--brand-bg:#232a52;--ok:#5fd18f;--ok-bg:#16301f;--warn:#f6b45c;--warn-bg:#3a2a12}}
:root[data-theme="dark"]{--bg:#111420;--card:#1a1e2e;--ink:#eef0f7;--ink2:#a3a9c2;--line:#2b3046;--brand:#8b9cff;--brand-bg:#232a52;--ok:#5fd18f;--ok-bg:#16301f;--warn:#f6b45c;--warn-bg:#3a2a12}
body{background:var(--bg);color:var(--ink);font:14px/1.5 'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0}
.wrap{max-width:1500px;margin:0 auto;padding:20px 22px 40px}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.02em;text-wrap:balance}
.sub{color:var(--ink2);margin:0 0 16px;max-width:900px}
.bar{position:sticky;top:0;background:var(--bg);padding:10px 0 12px;z-index:5;border-bottom:1px solid var(--line);margin-bottom:14px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.row+.row{margin-top:8px}
.lbl{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink2);min-width:74px}
button.chip{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 13px;font:inherit;font-weight:600;cursor:pointer}
button.chip.on{background:var(--brand);border-color:var(--brand);color:#fff}
button.chip.on.rec{background:var(--ok);border-color:var(--ok)}
button.chip small{display:block;font-weight:500;font-size:11px;opacity:.75;line-height:1.2}
.frame{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.frame img{display:block;width:100%;height:auto}
.frame img[hidden]{display:none}
.note{margin-top:14px;display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
.note .c{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.note b{display:block;margin-bottom:4px}
.note .c.rec{border-color:var(--ok);background:var(--ok-bg)}
.k{display:inline-block;padding:1px 7px;border-radius:6px;background:var(--brand-bg);color:var(--brand);font-weight:600;font-size:12px}
kbd{font:12px 'JetBrains Mono',ui-monospace,Menlo,monospace;background:var(--brand-bg);padding:1px 5px;border-radius:5px}
table{border-collapse:collapse;width:100%;font-size:13px}
td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink2)}
td.n{text-align:right;font-variant-numeric:tabular-nums}
</style>
<div class="wrap">
<h1>So font chữ số trên SmartLead</h1>
<p class="sub">Cùng 1 màn (dữ liệu demo, 1440px, font thật) ở 3 trạng thái. Chọn trạng thái rồi chuyển từng mục; nhìn các con số KPI, ô "Hôm nay", điểm lead, đếm cột, bảng số liệu, trục biểu đồ.</p>
<div class="bar">
 <div class="row"><span class="lbl">Font số</span>${STATES.map(([k,n,d],i)=>`<button class="chip${k==='B'?' rec':''}${k==='B'?' on':''}" data-st="${k}">${n}<small>${d}</small></button>`).join('')}</div>
 <div class="row"><span class="lbl">Màn</span>${VIEWS.map(([k,n],i)=>`<button class="chip${i===0?' on':''}" data-vw="${k}">${n}</button>`).join('')}</div>
</div>
<div class="frame">${imgs}</div>
<div class="note">
 <div class="c"><b>Hiện tại (v119-84) — đo trên 18 mục</b>Chữ số đang render bằng 4 font: TikTok Sans (thân chữ, phễu, điểm "Nên gọi") · Plus Jakarta Sans (KPI 34px, badge, vòng điểm, đếm cột) · JetBrains Mono (ô "Hôm nay", dải nhiệt độ, Bảng brand, van Tiếp cận, rail Lead mới) · font hệ thống (trục + tooltip biểu đồ). Bảng điều khiển có 3 font số trên 1 màn.</div>
 <div class="c rec"><b>TikTok Sans — đã áp trong zip v119-85</b>Mọi chữ số dùng 1 token <kbd>--font-num</kbd> = TikTok Sans (đúng chốt 08/09 "số dùng TikTok Sans"), kiểu chữ số bảng (tabular) nên cột số thẳng hàng. Mã kỹ thuật (mã lead, mã brand, mã nick, phiên bản worker) giữ JetBrains Mono. Số nằm trong chip/nhãn có chữ ("Ấm 74đ", "còn mở 291") giữ font nhãn.</div>
 <div class="c"><b>Plus Jakarta Sans — phương án thay thế</b>Mọi chữ số dùng font tiêu đề/nút. Nếu anh thích phương án này, em chỉ đổi 1 dòng token <kbd>--font-num</kbd> rồi build lại — mọi rule đã trỏ về token.</div>
</div>
<table style="margin-top:14px"><thead><tr><th>Text node có chữ số (18 mục + modal)</th><th style="text-align:right">Hiện tại</th><th style="text-align:right">Sau (v119-85)</th></tr></thead><tbody>
<tr><td>TikTok Sans</td><td class="n">242</td><td class="n">559</td></tr>
<tr><td>Plus Jakarta Sans</td><td class="n">228</td><td class="n">20 <span class="k">chip/nhãn có chữ</span></td></tr>
<tr><td>JetBrains Mono</td><td class="n">108</td><td class="n">5 <span class="k">mã kỹ thuật</span></td></tr>
<tr><td>Font hệ thống / monospace mặc định</td><td class="n">6 + trục biểu đồ</td><td class="n">0</td></tr>
</tbody></table>
</div>
<script>
(function(){ var st='B', vw='overview';
 function show(){ document.querySelectorAll('.frame img').forEach(function(i){ i.hidden=!(i.dataset.s===st&&i.dataset.v===vw); }); document.querySelectorAll('[data-st]').forEach(function(b){ b.classList.toggle('on',b.dataset.st===st); }); document.querySelectorAll('[data-vw]').forEach(function(b){ b.classList.toggle('on',b.dataset.vw===vw); }); try{ localStorage.setItem('numprev',JSON.stringify({st:st,vw:vw})); }catch(e){} }
 try{ var s=JSON.parse(localStorage.getItem('numprev')||'{}'); if(s.st) st=s.st; if(s.vw) vw=s.vw; }catch(e){}
 document.addEventListener('click',function(e){ var b=e.target.closest('[data-st],[data-vw]'); if(!b) return; if(b.dataset.st) st=b.dataset.st; if(b.dataset.vw) vw=b.dataset.vw; show(); });
 document.addEventListener('keydown',function(e){ var ks=['cur','B','A']; if(e.key==='1'||e.key==='2'||e.key==='3'){ st=ks[+e.key-1]; show(); } });
 show(); })();
</script>`;
fs.writeFileSync(OUT,html); console.log('OK',OUT,(fs.statSync(OUT).size/1e6).toFixed(1)+'MB');
