# -*- coding: utf-8 -*-
import json, sys, html, re, os
sys.path.insert(0, os.path.dirname(__file__))
import findings, css_agent, copy_agent
SP = os.environ['SP']
IM = json.load(open(SP+'/ui/imgs.json'))
CAP = {
 'd-overview':'Bảng điều khiển 1440px — 2 widget quản trị + ticker đứng trên KPI', 'f-overview':'Bảng điều khiển ở laptop 1440×900: màn hình đầu không có KPI/chart nào',
 'd-feed':'Lead feed — thẻ lead, 2 kiểu hộp AI (cam / xanh), rail phải ALL CAPS', 'd-pipeline':'Pipeline — chip “⏱ —” rỗng, nút “Chi tiết” gãy dòng, cột 5 bị cắt',
 'd-tasks':'Hộp việc — tiêu đề emoji, chú giải 🚨 trong mô tả', 'd-replies':'Phản hồi khách — 1 card rồi trống',
 'd-agency':'Bảng brand — banner “LỆNH #17 (CF statsOnLead…)”, bảng 11 cột cắt, số mono', 'd-sources':'Nguồn quét — card so sánh với emoji 🌐👤 to, 6 chip Super Admin',
 'd-keywords':'Từ khoá & bộ lọc', 'd-scoring':'Chấm điểm AI — mô tả kỹ thuật dài, slider native, mono gãy dòng',
 'd-outreach':'Tiếp cận (cuối trang) — mascot đè nút “Dừng tất cả”, cột ACCOUNT_PID, nút ✍️⚙️', 'd-alerts':'Cảnh báo — emoji dày, kênh Notion/Airtable/CRM chưa nối, “cần token trong functions/.env”',
 'd-reports':'Báo cáo — “$0,0005” với dấu phẩy, số mono', 'd-history':'Lịch sử quét', 'd-scanned':'Bài đã quét', 'd-integrations':'Tích hợp — trang brochure, nút “Cấu hình →” không hoạt động, banner docs/*.md',
 'd-users':'Người dùng — 6 nút/dòng brand bị cắt, input mm/dd/yyyy, hướng dẫn dài, lộ email', 'd-account':'Cài đặt tài khoản — khối “(UI demo - chưa nối backend)”, “Phiên & thiết bị (demo)”', 'd-roi':'Giá trị & ROI',
 'd-modal-lead-bottom':'Modal lead cuộn tới cuối — thanh nút dính đáy che nội dung', 'd-modal-timeline':'Modal lead — nút kết quả gọi bằng emoji, timeline “nick apk1gm6por”, giờ mono',
 'd-modal-brandcfg2':'Cấu hình automation — emoji làm icon cột/hàng', 'd-modal-content':'Content Studio — “Cần backend LỆNH #34 + worker 2026-09-06c”, “gọi Cloud Function genContent”',
 'd-modal-addnick':'Thêm tài khoản Facebook — “Token cất ở Secret Manager qua Cloud Function”', 'd-modal-wizard1':'Wizard Thêm brand — input ngày native mm/dd/yyyy',
 'd-login':'Màn đăng nhập — gọn, đạt', 'd-login-pending':'Màn Chờ duyệt — emoji 🕒 làm minh hoạ', 'd-assign-pop':'Popover giao lead — hướng dẫn kỹ thuật thay vì hành động',
 't-overview-768':'Tablet 768 — hotline nổi che ô “Lead mới hôm nay”, nút icon-only không nhãn', 't-users-1024':'Laptop 1024×900 — sidebar cuộn, hotline + user chiếm đáy',
 'm-overview':'iPhone — banner ticker đầu trang, mascot đè KPI “Lead nóng”', 'm-feed':'iPhone — header thẻ lead 3 dòng chip, mascot đè pill email', 'm-outreach':'iPhone Tiếp cận — banner giải thích dài, KPI 1 cột',
 'm-drawer':'Drawer menu iPhone — hotline chiếm đáy, 8 mục Vận hành bị giấu', 'mt-outreach':'iPhone Tiếp cận (trang đầy) — 4 KPI ~180px/ô', 'm-modal-lead':'Modal lead mobile (bottom-sheet) — ổn, nút emoji',
}
def esc(s): return html.escape(s, quote=False)
def md(s):
    s = esc(s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    return s
def fig(name):
    pos='top'
    if '@' in name: name,pos=name.split('@')
    d=IM[name]; cap=CAP.get(name,name)
    return f'<figure class="shot" data-pos="{pos}"><button type="button" class="shot-btn" data-full="{name}" aria-label="Phóng to: {esc(cap)}"><img src="{d["d"]}" width="{d["w"]}" height="{d["h"]}" alt="{esc(cap)}" loading="lazy" style="object-position:center {pos}"></button><figcaption>{esc(cap)}</figcaption></figure>'
SEV={'cao':('Cao','sev-cao'),'vua':('Vừa','sev-vua'),'thap':('Thấp','sev-thap')}
cnt={k:sum(1 for f in findings.F if f['sev']==k) for k in SEV}
# ---------- sections ----------
find_html=''
for f in findings.F:
    lab,cls=SEV[f['sev']]
    find_html+=f'''<article class="finding {cls}" id="f-{f['id']}">
 <div class="f-head"><span class="f-id">{f['id']}</span><h3>{esc(f['title'])}</h3><span class="sev {cls}">{lab}</span></div>
 <p class="f-where">{esc(f['where'])} · <span class="f-effort">công {esc(f['effort'])}</span></p>
 <div class="figs n{len(f['imgs'])}">{''.join(fig(i) for i in f['imgs'])}</div>
 <dl class="f-body"><dt>Quan sát</dt><dd>{md(f['what'])}</dd><dt>Cách sửa</dt><dd>{md(f['fix'])}</dd></dl>
</article>'''
views_rows=''.join(f'<tr><td>{esc(v[0])}</td><td class="num"><span class="score s{v[1]}">{v[1]}/5</span></td><td>{esc(v[2])}</td><td class="mono">{esc(v[3])}</td></tr>' for v in findings.VIEWS)
css_rows=''.join(f'<tr><th scope="row">{esc(a)}</th><td class="num mono">{esc(b)}</td><td>{md(c)}</td></tr>' for a,b,c in css_agent.STATS)
copy_rows=''.join(f'<tr><th scope="row">{esc(a)}</th><td class="num mono">{esc(b)}</td><td>{md(c)}</td></tr>' for a,b,c in copy_agent.STATS)
top_css=''.join(f'<li>{md(x)}</li>' for x in css_agent.TOP)
top_copy=''.join(f'<tr><td>{esc(a)}</td><td class="was">{esc(b) if b else "—"}</td><td>{esc(c)}</td></tr>' for a,b,c in copy_agent.TOP)
rules=''.join(f'<li>{esc(x)}</li>' for x in copy_agent.RULES)
qs=''.join(f'<li><b>{esc(a)}</b><span>{esc(b)}</span></li>' for a,b in findings.QUESTIONS)
toc=''.join(f'<li><a href="#f-{f["id"]}"><span class="dot {SEV[f["sev"]][1]}"></span>{f["id"]} · {esc(f["title"].split(":")[0][:44])}</a></li>' for f in findings.F)
thumbs_all=''.join(f'<img src="{IM[k]["d"]}" alt="">' for k in [])  # none
lightbox_json=json.dumps({k:{'w':v['w'],'h':v['h']} for k,v in IM.items()})
HTML=f'''<title>Rà soát UI SmartLead</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root{{--ink:#171A2E;--ink-2:#454A62;--muted:#6B7085;--line:#E2E4EE;--ground:#F5F5FA;--surface:#FFFFFF;--surface-2:#F0F1F7;--accent:#1B2DCC;--accent-ink:#1B2DCC;--accent-soft:#E9EBFB;
 --cao:#B42318;--cao-bg:#FDECEA;--vua:#B54708;--vua-bg:#FFF4E5;--thap:#3B4557;--thap-bg:#EEF0F5;--ok:#0B7A4B;--ok-bg:#E6F4EC;--shadow:0 1px 2px rgba(23,26,46,.06),0 8px 24px -12px rgba(23,26,46,.18);
 --font:"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--ink:#ECEDF5;--ink-2:#C7CADB;--muted:#9EA3B8;--line:#2B2F45;--ground:#12141F;--surface:#1A1D2E;--surface-2:#222639;--accent:#8B97FF;--accent-ink:#B4BCFF;--accent-soft:#232848;
 --cao:#FF8A80;--cao-bg:#3A1F1E;--vua:#FFB870;--vua-bg:#3A2A18;--thap:#B9BFD3;--thap-bg:#262A3D;--ok:#7FD8A6;--ok-bg:#1B3128;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6)}}}}
:root[data-theme="dark"]{{--ink:#ECEDF5;--ink-2:#C7CADB;--muted:#9EA3B8;--line:#2B2F45;--ground:#12141F;--surface:#1A1D2E;--surface-2:#222639;--accent:#8B97FF;--accent-ink:#B4BCFF;--accent-soft:#232848;
 --cao:#FF8A80;--cao-bg:#3A1F1E;--vua:#FFB870;--vua-bg:#3A2A18;--thap:#B9BFD3;--thap-bg:#262A3D;--ok:#7FD8A6;--ok-bg:#1B3128;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6)}}
*{{box-sizing:border-box}} html{{color-scheme:light dark}}
body{{margin:0;background:var(--ground);color:var(--ink);font:15px/1.6 var(--font);-webkit-font-smoothing:antialiased}}
a{{color:var(--accent-ink)}} code{{font:0.86em var(--mono);background:var(--surface-2);padding:1px 5px;border-radius:4px;color:var(--ink)}}
.mono{{font-family:var(--mono);font-size:.9em}} .num{{font-variant-numeric:tabular-nums}}
h1,h2,h3{{line-height:1.25;text-wrap:balance;margin:0}} h1{{font-size:30px;font-weight:700;letter-spacing:-.01em}} h2{{font-size:21px;font-weight:700;margin:0 0 6px}} h3{{font-size:16px;font-weight:600}}
.eyebrow{{font-size:11.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-ink)}}
.wrap{{max-width:1180px;margin:0 auto;padding:36px 24px 80px;display:grid;grid-template-columns:230px minmax(0,1fr);gap:40px}}
@media (max-width:1000px){{.wrap{{grid-template-columns:minmax(0,1fr);padding:22px 16px 60px}} .toc{{display:none}}}}
.toc{{position:sticky;top:20px;align-self:start;font-size:13px}} .toc ul{{list-style:none;margin:8px 0 18px;padding:0}} .toc li a{{display:flex;gap:8px;align-items:baseline;color:var(--ink-2);text-decoration:none;padding:4px 0;border-left:2px solid transparent}} .toc li a:hover{{color:var(--accent-ink)}}
.toc .dot{{width:8px;height:8px;border-radius:50%;flex:none;position:relative;top:-1px}} .dot.sev-cao{{background:var(--cao)}} .dot.sev-vua{{background:var(--vua)}} .dot.sev-thap{{background:var(--thap)}}
.toc .top a{{font-weight:600;color:var(--ink)}}
header.hd{{margin-bottom:28px;padding-bottom:22px;border-bottom:1px solid var(--line)}} header.hd p.lead{{font-size:17px;color:var(--ink-2);max-width:68ch;margin:12px 0 0}}
.meta{{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--muted);font-size:13px;margin-top:10px}}
section{{margin:0 0 44px}} section>h2{{margin-bottom:12px}} section>p{{max-width:70ch;margin:6px 0 12px}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0 6px}}
.stat{{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}} .stat b{{display:block;font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums}} .stat span{{color:var(--muted);font-size:12.5px}}
.stat.cao b{{color:var(--cao)}} .stat.vua b{{color:var(--vua)}}
.good{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 22px;margin:8px 0 0;padding:0;list-style:none}} .good li{{padding-left:20px;position:relative;color:var(--ink-2);font-size:14px}} .good li::before{{content:"";position:absolute;left:0;top:9px;width:10px;height:10px;border-radius:50%;background:var(--ok-bg);border:2px solid var(--ok)}}
.finding{{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--thap);border-radius:12px;padding:18px 20px 16px;margin:0 0 16px;box-shadow:var(--shadow)}} .finding.sev-cao{{border-left-color:var(--cao)}} .finding.sev-vua{{border-left-color:var(--vua)}}
.f-head{{display:flex;align-items:center;gap:10px;flex-wrap:wrap}} .f-id{{font:600 13px var(--mono);color:var(--muted);background:var(--surface-2);border-radius:6px;padding:2px 7px}} .f-head h3{{flex:1 1 300px}}
.sev{{font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:99px}} .sev-cao.sev{{background:var(--cao-bg);color:var(--cao)}} .sev-vua.sev{{background:var(--vua-bg);color:var(--vua)}} .sev-thap.sev{{background:var(--thap-bg);color:var(--thap)}}
.f-where{{margin:4px 0 12px;color:var(--muted);font-size:13px}} .f-effort{{color:var(--ink-2)}}
.figs{{display:grid;gap:12px;margin:0 0 14px}} .figs.n1{{grid-template-columns:minmax(0,1fr)}} .figs.n2{{grid-template-columns:repeat(2,minmax(0,1fr))}} .figs.n3{{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:700px){{.figs.n2,.figs.n3{{grid-template-columns:minmax(0,1fr)}}}}
.shot{{margin:0}} .shot-btn{{display:block;width:100%;padding:0;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--surface-2);cursor:zoom-in;height:250px}} .figs.n1 .shot-btn{{height:360px}}
.shot img{{width:100%;height:100%;object-fit:cover;display:block}} .shot figcaption{{font-size:12.5px;color:var(--muted);margin-top:6px;line-height:1.4}}
.f-body{{display:grid;grid-template-columns:86px minmax(0,1fr);gap:6px 14px;margin:0}} .f-body dt{{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding-top:3px}} .f-body dd{{margin:0;max-width:78ch}}
@media (max-width:520px){{.f-body{{grid-template-columns:minmax(0,1fr)}}}}
.tbl-wrap{{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--surface)}} table{{border-collapse:collapse;width:100%;font-size:13.5px}} th,td{{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}} thead th{{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--surface-2)}} tbody tr:last-child td{{border-bottom:0}} tbody th{{font-weight:600;white-space:nowrap}}
td.num{{white-space:nowrap}} .score{{font:600 12.5px var(--mono);padding:2px 8px;border-radius:99px;background:var(--thap-bg);color:var(--thap)}} .score.s1,.score.s2{{background:var(--cao-bg);color:var(--cao)}} .score.s3{{background:var(--vua-bg);color:var(--vua)}} .score.s4,.score.s5{{background:var(--ok-bg);color:var(--ok)}}
td.was{{color:var(--muted);font-style:italic}}
ol.top{{padding-left:22px;margin:8px 0}} ol.top li{{margin:5px 0;max-width:80ch}}
ol.rules{{padding-left:22px}} ol.rules li{{margin:6px 0;max-width:80ch}}
.roadmap{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}} .phase{{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px}} .phase h3{{display:flex;justify-content:space-between;gap:10px;align-items:baseline}} .phase h3 small{{color:var(--muted);font-weight:500;font-size:12.5px;white-space:nowrap}} .phase ul{{padding-left:18px;margin:8px 0 0;font-size:14px}} .phase li{{margin:4px 0}}
ul.qs{{list-style:none;padding:0;margin:0;display:grid;gap:10px}} ul.qs li{{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 16px;display:grid;gap:4px}} ul.qs li b{{font-weight:600}} ul.qs li span{{color:var(--ink-2);font-size:14px}}
dialog.lb{{border:0;padding:0;background:transparent;max-width:min(96vw,1200px);width:auto}} dialog.lb::backdrop{{background:rgba(10,12,24,.82)}} dialog.lb .box{{background:var(--surface);border-radius:10px;overflow:auto;max-height:92vh;padding:10px}} dialog.lb img{{display:block;max-width:100%;height:auto}} dialog.lb .cap{{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13px;color:var(--muted);padding:6px 4px 2px}} dialog.lb button{{font:600 13px var(--font);background:var(--surface-2);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 12px;cursor:pointer}}
:focus-visible{{outline:2px solid var(--accent);outline-offset:2px}}
@media (prefers-reduced-motion:no-preference){{.shot-btn{{transition:transform .15s ease}} .shot-btn:hover{{transform:translateY(-1px)}}}}
.method{{color:var(--ink-2);font-size:14px;max-width:78ch}}
</style>
<div class="wrap">
<nav class="toc" aria-label="Mục lục"><div class="eyebrow">Mục lục</div>
<ul class="top"><li><a href="#tom-tat">Kết luận trong 1 phút</a></li><li><a href="#phat-hien">14 phát hiện</a></li><li><a href="#muc">Rà theo 18 mục</a></li><li><a href="#ma">Số liệu từ mã nguồn</a></li><li><a href="#chu">Chữ nghĩa</a></li><li><a href="#lo-trinh">Lộ trình đề xuất</a></li><li><a href="#chot">Câu hỏi chốt</a></li></ul>
<div class="eyebrow">Phát hiện</div><ul>{toc}</ul></nav>
<main>
<header class="hd"><div class="eyebrow">SmartLead · v119-60 · 07/09/2026</div><h1>Rà soát UI SmartLead</h1>
<p class="lead">Giao diện đã có nền tốt (Lead feed, modal lead, pipeline, đăng nhập) nhưng còn 5 nhóm việc khiến người dùng cảm thấy “sản phẩm đang dở”: lớp nổi che nội dung, emoji làm icon, chữ kỹ thuật lọt ra màn hình, trang/tính năng giả, và Bảng điều khiển mở ra bằng widget quản trị. Phần lớn sửa được trong 1 zip, không đụng backend.</p>
<div class="meta"><span>18 mục · 60 ảnh chụp (1440 / 1024 / 768 / 390)</span><span>2 lượt quét mã: design-system + chữ nghĩa</span><span>Chỉ đánh giá — chưa sửa code, chờ anh chốt</span></div></header>

<section id="tom-tat"><h2>Kết luận trong 1 phút</h2>
<div class="stats"><div class="stat cao"><b>{cnt['cao']}</b><span>phát hiện mức Cao</span></div><div class="stat vua"><b>{cnt['vua']}</b><span>mức Vừa</span></div><div class="stat"><b>{cnt['thap']}</b><span>mức Thấp</span></div><div class="stat"><b>497</b><span>emoji/ký hiệu làm icon (so với 215 icon SVG)</span></div><div class="stat"><b>901</b><span>inline style trong template</span></div><div class="stat"><b>218</b><span>mã màu khác nhau, 33 thuộc palette</span></div><div class="stat"><b>16</b><span>hộp thoại native confirm/prompt</span></div><div class="stat"><b>83</b><span>toast dán thô mã lỗi Firebase</span></div></div>
<p>Mùi “vibe code” đến từ <b>độ không nhất quán</b> chứ không phải từ một màn hình xấu: cùng một vai (icon, chip, nhãn nhỏ, ngày giờ, tiền, hộp thoại) có 3–12 cách thể hiện; chữ trong sản phẩm mang giọng chat riêng giữa anh và em (“LỆNH #17”, “VPS của anh”, “em tính được”); và vài trang được vẽ đủ UI dù chưa có tính năng phía sau.</p>
<div class="eyebrow" style="margin-top:14px">Điểm mạnh nên giữ nguyên</div>
<ul class="good"><li>Thẻ lead + modal chi tiết: cấu trúc thông tin rõ, đọc bài gốc, AI, tin cậy, pipeline, ghi chú trong 1 chỗ</li><li>Pipeline kanban + ô tóm tắt trên đầu; modal bottom-sheet trên mobile</li><li>Màn đăng nhập gọn, Google + email, đúng ngôn ngữ</li><li>Bộ icon SVG 1 nét (SLI) và bảng màu nhiệt độ Nóng/Ấm/Lạnh đã ổn — chỉ cần dùng nhất quán</li><li>Thanh tab dưới mobile, drawer, morph realtime (v119-58/60) đã mượt</li><li>Wizard Thêm brand: step chips, mỗi bước lưu ngay</li></ul></section>

<section id="phat-hien"><h2>14 phát hiện, xếp theo tác động</h2><p>Mỗi phát hiện có ảnh chụp thật (bấm để phóng to), quan sát và cách sửa. “Công” là ước lượng ngày công FE, không đụng backend.</p>{find_html}</section>

<section id="muc"><h2>Rà theo 18 mục</h2><p>Điểm 1–5 là cảm nhận tổng thể khi mở mục ở desktop + mobile (5 = sạch, không sửa; 1 = nên gỡ/làm lại). Cột cuối trỏ tới phát hiện liên quan.</p>
<div class="tbl-wrap"><table><thead><tr><th>Mục</th><th>Điểm</th><th>Vấn đề chính</th><th>Phát hiện</th></tr></thead><tbody>{views_rows}</tbody></table></div></section>

<section id="ma"><h2>Số liệu từ mã nguồn (design-system)</h2><p>Đếm thật trên 3 file CSS (215 KB) và 14 part template. Phát hiện gốc: <b>tokens.css và app.css cùng khai báo <code>:root</code></b> — 46/53 biến trùng tên khác giá trị, app.css nạp sau nên thắng; hệ quả là font Inter/Plus Jakarta trong tokens không bao giờ được dùng và mọi màu/bo góc/bóng ở dưới đều tự phát.</p>
<div class="tbl-wrap"><table><thead><tr><th>Hạng mục</th><th>Số</th><th>Chi tiết</th></tr></thead><tbody>{css_rows}</tbody></table></div>
<h3 style="margin:18px 0 4px">10 việc chuẩn hoá theo thứ tự tác động</h3><ol class="top">{top_css}</ol></section>

<section id="chu"><h2>Chữ nghĩa (microcopy)</h2><p>Trích 8.576 chuỗi từ template, lọc 3.487 dòng chữ hiển thị. Vấn đề lớn nhất là <b>chữ dành cho người viết code</b> (mã lỗi, tên hạ tầng, số lệnh) và <b>3 hệ xưng hô</b> sống chung.</p>
<div class="tbl-wrap"><table><thead><tr><th>Hạng mục</th><th>Số</th><th>Chi tiết</th></tr></thead><tbody>{copy_rows}</tbody></table></div>
<h3 style="margin:18px 0 8px">15 sửa chữ có tác động nhất</h3>
<div class="tbl-wrap"><table><thead><tr><th>Vị trí</th><th>Hiện tại</th><th>Đề xuất</th></tr></thead><tbody>{top_copy}</tbody></table></div>
<h3 style="margin:18px 0 4px">Bộ quy ước viết (áp dụng cho mọi zip sau)</h3><ol class="rules">{rules}</ol></section>

<section id="lo-trinh"><h2>Lộ trình đề xuất</h2><p>Chia 3 đợt để mỗi zip nghiệm thu được bằng mắt. Đợt 1 là thứ khách nhìn thấy ngay; đợt 2 là nền để mọi màn sau tự đẹp; đợt 3 là sắp xếp lại luồng.</p>
<div class="roadmap">
<div class="phase"><h3>Đợt 1 · Hết “mùi vibe code” <small>1 zip · ~5 ngày công</small></h3><ul><li>A Lớp nổi: 1 nút chat, bỏ bong bóng + hotline nổi, đệm đáy</li><li>B Emoji → icon SVG ở nút, tiêu đề, chip, toast, timeline (~25 icon mới)</li><li>C Gỡ chữ kỹ thuật (LỆNH/CF/Rules/v119/Secret Manager/mã nick); <code>errMsg(e)</code> cho 83 toast</li><li>D Gỡ Tích hợp + khối demo ở Cài đặt; kênh chưa nối → “Sắp có”</li><li>J 16 confirm/prompt → modal của app; tên mục 1 tên duy nhất; dấu “–”; bỏ “anh/em”; chip trạng thái quét đo được</li><li>F G I K L M N: topbar, sidebar/hotline, modal footer, mobile KPI 2 cột, pipeline chip/nút, empty-state chung, hộp AI 1 kiểu</li></ul></div>
<div class="phase"><h3>Đợt 2 · Nền design-system <small>1 zip · ~5 ngày công</small></h3><ul><li>Hợp nhất <code>:root</code>, chốt font thật (giữ system hay Inter?), xoá 221 fallback, lint hex ngoài palette trong build</li><li>Thang chữ 7 cỡ / spacing 4-8 / radius 5 / shadow 5; xoá .5px</li><li>Inline style → class (901 → &lt;100), bỏ 30 <code>!important</code>, z-index 6 mức</li><li>Component chung: chip, input/select, bảng (overflow + cột dính + số tabular), toast, skeleton</li><li>Breakpoint 17 → 4; dọn 99 rule chết; 1 hàm tiền/ngày giờ</li></ul></div>
<div class="phase"><h3>Đợt 3 · Sắp xếp luồng <small>1 zip · ~3 ngày công</small></h3><ul><li>E Bảng điều khiển: Hôm nay → KPI → chart → Bảng brand; widget quản trị thành 1 dải</li><li>Menu 4 nhóm theo tần suất: Làm việc · Tổng quan · Quét & AI · Quản trị</li><li>H Bảng brand/Người dùng: nút hàng vào menu ⋯, card-view mobile</li><li>Trang Chấm điểm AI, Nguồn quét: rút mô tả, hướng dẫn vào “Tìm hiểu thêm”</li><li>Mascot: giọng B2B, self-host ảnh; hotline giờ thật</li></ul></div>
</div></section>

<section id="chot"><h2>Câu hỏi chốt trước khi em sửa</h2><ul class="qs">{qs}</ul></section>

<section id="pp"><h2>Phương pháp</h2><p class="method">Chụp 60 màn bằng Playwright ở chế độ demo (1440×2000, 1440×900, 1024, 768, 390×844 @2x, 390×1900) gồm 18 mục, 12 modal/popover, 5 trạng thái (rỗng, chờ duyệt, chưa gán brand, đăng nhập, sau phễu tự động). Em xem từng ảnh; song song 2 agent chỉ-đọc quét mã: (1) design-system — grep/đếm token, màu, cỡ chữ, spacing, radius, shadow, inline style, emoji, chip, bảng, form, z-index, breakpoint, CSS chết; (2) chữ nghĩa — parse 8.576 chuỗi bằng espree, lọc chữ hiển thị, đếm thuật ngữ, dấu câu, xưng hô, toast, hộp thoại, định dạng số/ngày. Mọi con số trong báo cáo là đếm thật trên cây v119-60; không dòng code nào bị sửa.</p></section>
</main></div>
<dialog class="lb" id="lb"><div class="box"><div class="cap"><span id="lbCap"></span><button type="button" id="lbClose">Đóng</button></div><img id="lbImg" alt=""></div></dialog>
<script>
(function(){{const lb=document.getElementById('lb'),im=document.getElementById('lbImg'),cp=document.getElementById('lbCap');
document.querySelectorAll('.shot-btn').forEach(b=>b.addEventListener('click',()=>{{const img=b.querySelector('img');im.src=img.src;im.alt=img.alt;cp.textContent=img.alt;lb.showModal();}}));
document.getElementById('lbClose').addEventListener('click',()=>lb.close());lb.addEventListener('click',e=>{{if(e.target===lb)lb.close();}});}})();
</script>'''
out=SP+'/ui/report/rasoat-ui.html'
open(out,'w',encoding='utf-8').write(HTML)
print('written', out, round(len(HTML.encode('utf-8'))/1024/1024,2),'MB')
