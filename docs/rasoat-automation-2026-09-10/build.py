#!/usr/bin/env python3
"""Dựng report.html từ findings.json (rà soát automation 10/09/2026). Chạy: python3 build.py"""
import json, html, os, datetime
here=os.path.dirname(os.path.abspath(__file__)); J=json.load(open(os.path.join(here,'findings.json'),encoding='utf-8'))
E=lambda s: html.escape(str(s if s is not None else ''))
SEV={'Cao':'sev-hi','Vừa':'sev-md','Thấp':'sev-lo'}
def md(s):  # rất nhẹ: `code` + **đậm** + xuống dòng
    s=E(s); import re
    s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s); s=re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s); return s.replace('\n','<br>')
def findings_table(items):
    rows=[]
    for f in items:
        rows.append(f"""<tr class="{SEV.get(f['sev'],'')}"><td class="id">{E(f['id'])}</td><td><span class="pill {SEV.get(f['sev'],'')}">{E(f['sev'])}</span></td>
<td><b>{E(f['title'])}</b><div class="where">{md(f.get('where',''))}</div><div class="desc">{md(f.get('desc',''))}</div>{('<div class="fix"><span>Sửa:</span> '+md(f['fix'])+'</div>') if f.get('fix') else ''}</td>
<td class="conf">{E(f.get('conf',''))}</td></tr>""")
    return '<div class="tw"><table class="tbl"><thead><tr><th>Mã</th><th>Mức</th><th>Phát hiện · bằng chứng · cách sửa</th><th>Độ chắc</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table></div>'
def proposals(items):
    out=[]
    for p in items:
        out.append(f"""<article class="prop"><div class="prop-h"><span class="pid">{E(p['id'])}</span><h4>{E(p['title'])}</h4><span class="tag eff-{E(p['effort']).lower()}">{E(p['effort'])}</span><span class="tag val">{E(p['value'])}</span></div>
<p>{md(p['why'])}</p><p class="how"><span>Cách làm:</span> {md(p['how'])}</p></article>""")
    return ''.join(out)
sections=[]
for g in J['groups']:
    sections.append(f'<section id="{E(g["key"])}"><h2>{E(g["title"])}</h2><p class="lead">{md(g.get("intro",""))}</p>'+findings_table(g['findings'])+(('<details><summary>Đã kiểm, an toàn ('+str(len(g.get('ok',[])))+')</summary><ul>'+''.join('<li>'+md(x)+'</li>' for x in g.get('ok',[]))+'</ul></details>') if g.get('ok') else '')+'</section>')
cnt={'Cao':0,'Vừa':0,'Thấp':0}
for g in J['groups']:
    for f in g['findings']: cnt[f['sev']]=cnt.get(f['sev'],0)+1
score_rows=''.join(f'<tr><td>{E(s["name"])}</td><td class="n"><b>{E(s["score"])}</b>/10</td><td>{md(s["note"])}</td></tr>' for s in J['scorecard'])
road=''.join(f'<li><b>{E(r["name"])}</b> <span class="muted">({E(r["when"])})</span>: {md(r["items"])}</li>' for r in J['roadmap'])
L=J.get('lenh43')
if L:
    kp=''.join(f'<div class="kpi {E(k["c"])}"><b>{E(k["v"])}</b><span>{E(k["l"])}</span></div>' for k in L['kpis'])
    rows=''.join(f'<tr><td class="id">{E(r[0])}</td><td>{md(r[1])}</td></tr>' for r in L['rows'])
    ver=''.join(f'<li>{md(v)}</li>' for v in L['verdicts'])
    l43=f'<section id="l43"><h2>Kết quả LỆNH #43 — số thật</h2><p class="lead">{md(L["when"])}</p><div class="kpis">{kp}</div><div class="tw"><table class="tbl"><thead><tr><th>Mục</th><th>Số thật · nhận xét</th></tr></thead><tbody>{rows}</tbody></table></div><h4 style="margin-top:14px">Chốt 3 mục "Suy luận" từ dump engine</h4><ul class="road">{ver}</ul><p>{md(L["new"])}</p><p class="ask"><b>Cần anh gửi:</b> {md(L["ask"])}</p></section>'
else: l43=''
page=f"""<title>Rà soát automation SmartLead</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root{{--bg:#F6F7FB;--card:#fff;--ink:#141A33;--ink-2:#4A5273;--ink-3:#7B829C;--line:#E4E7F0;--brand:#1B2DCC;--brand-soft:#EEF0FF;--hi:#C62828;--hi-bg:#FDECEC;--md:#B26A00;--md-bg:#FFF4E0;--lo:#2E6B3A;--lo-bg:#E9F5EC;--code:#F1F2F8}}
@media (prefers-color-scheme:dark){{:root:not([data-theme=light]){{--bg:#0F1220;--card:#171B2E;--ink:#EDEFF7;--ink-2:#B9BFD6;--ink-3:#8A91AD;--line:#2A3050;--brand:#8B97FF;--brand-soft:#232A55;--hi:#FF7B7B;--hi-bg:#3A1F24;--md:#FFC46B;--md-bg:#3A2E18;--lo:#7ED69A;--lo-bg:#1B3325;--code:#232841}}}}
:root[data-theme=dark]{{--bg:#0F1220;--card:#171B2E;--ink:#EDEFF7;--ink-2:#B9BFD6;--ink-3:#8A91AD;--line:#2A3050;--brand:#8B97FF;--brand-soft:#232A55;--hi:#FF7B7B;--hi-bg:#3A1F24;--md:#FFC46B;--md-bg:#3A2E18;--lo:#7ED69A;--lo-bg:#1B3325;--code:#232841}}
body{{background:var(--bg);color:var(--ink);font-family:'Be Vietnam Pro',system-ui,sans-serif;font-size:14.5px;line-height:1.55;margin:0}}
.wrap{{max-width:1080px;margin:0 auto;padding-block:28px 64px;padding-inline:20px}}
h1,h2,h3,h4{{font-family:'Plus Jakarta Sans','Be Vietnam Pro',sans-serif;text-wrap:balance;margin:0}}
h1{{font-size:28px;font-weight:800;letter-spacing:-.01em}} h2{{font-size:20px;font-weight:700;margin:40px 0 8px;padding-top:12px;border-top:1px solid var(--line)}} h4{{font-size:15px;font-weight:700}}
.sub{{color:var(--ink-2);margin:6px 0 18px}} .lead{{color:var(--ink-2);margin:0 0 14px}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:18px 0}}
.kpi{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px}} .kpi b{{font-family:'Plus Jakarta Sans',sans-serif;font-size:26px;font-variant-numeric:tabular-nums;display:block}} .kpi span{{color:var(--ink-3);font-size:12.5px}}
.kpi.hi b{{color:var(--hi)}} .kpi.md b{{color:var(--md)}} .kpi.lo b{{color:var(--lo)}}
.tbl{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:13.5px}}
.tbl th{{text-align:left;font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);padding:10px 12px;border-bottom:1px solid var(--line)}}
.tbl td{{padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}} .tbl tr:last-child td{{border-bottom:0}} .tbl td.n{{text-align:right;font-variant-numeric:tabular-nums}}
.tbl td.id{{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-3);white-space:nowrap}} .tbl td.conf{{color:var(--ink-3);font-size:12.5px;white-space:nowrap}}
.pill{{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap}}
.pill.sev-hi{{background:var(--hi-bg);color:var(--hi)}} .pill.sev-md{{background:var(--md-bg);color:var(--md)}} .pill.sev-lo{{background:var(--lo-bg);color:var(--lo)}}
.where{{font-size:12.5px;color:var(--ink-3);margin-top:3px}} .desc{{margin-top:6px;color:var(--ink-2)}} .fix{{margin-top:6px}} .fix span{{font-weight:700;color:var(--brand)}}
code{{font-family:'JetBrains Mono',monospace;font-size:12px;background:var(--code);padding:1px 5px;border-radius:5px}}
details{{margin:10px 0 0;color:var(--ink-2)}} summary{{cursor:pointer;font-weight:600;color:var(--ink)}} details ul{{margin:8px 0 0 18px;padding:0}} details li{{margin:3px 0}}
.prop{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:10px 0}} .prop-h{{display:flex;gap:10px;align-items:center;flex-wrap:wrap}} .pid{{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-3)}}
.tag{{font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--brand-soft);color:var(--brand);font-family:'Plus Jakarta Sans',sans-serif}} .tag.eff-nhỏ{{background:var(--lo-bg);color:var(--lo)}} .tag.eff-lớn{{background:var(--md-bg);color:var(--md)}}
.prop p{{margin:8px 0 0;color:var(--ink-2)}} .prop .how span{{font-weight:700;color:var(--ink)}}
.tw{{overflow-x:auto;max-width:100%}} .tbl td,.tbl th{{overflow-wrap:anywhere}} code{{overflow-wrap:anywhere}}
.muted{{color:var(--ink-3)}} .ask{{background:var(--md-bg);border-radius:12px;padding:10px 14px}} ul.road{{padding-left:20px}} ul.road li{{margin:6px 0}}
pre{{background:var(--code);padding:12px 14px;border-radius:12px;overflow-x:auto;font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.5}}
.toc{{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0}} .toc a{{font-size:12.5px;color:var(--brand);text-decoration:none;background:var(--brand-soft);padding:4px 10px;border-radius:999px}}
@media (max-width:640px){{.tbl th:nth-child(4),.tbl td:nth-child(4){{display:none}} h1{{font-size:23px}}}}
</style>
<div class="wrap">
<h1>Rà soát automation SmartLead</h1>
<p class="sub">{E(J['meta']['subtitle'])}</p>
<nav class="toc">{''.join(f'<a href="#{E(g["key"])}">{E(g["short"])}</a>' for g in J['groups'])}<a href="#l43">Số thật #43</a><a href="#props">Đề xuất</a><a href="#road">Lộ trình</a><a href="#lenh">LỆNH #43</a></nav>
<div class="kpis"><div class="kpi hi"><b>{cnt['Cao']}</b><span>phát hiện mức Cao</span></div><div class="kpi md"><b>{cnt['Vừa']}</b><span>mức Vừa</span></div><div class="kpi lo"><b>{cnt['Thấp']}</b><span>mức Thấp</span></div><div class="kpi"><b>{len(J['proposals'])}</b><span>đề xuất thông minh</span></div><div class="kpi"><b>{E(J['meta']['coverage'])}</b><span>độ phủ đọc code</span></div></div>
<section><h2>Tóm tắt</h2>{md(J['summary'])}</section>
{l43}
<section><h2>Bảng điểm theo phân hệ</h2><div class="tw"><table class="tbl"><thead><tr><th>Phân hệ</th><th>Điểm</th><th>Nhận xét</th></tr></thead><tbody>{score_rows}</tbody></table></div></section>
{''.join(sections)}
<section id="props"><h2>Đề xuất thông minh</h2><p class="lead">{md(J['props_intro'])}</p>{proposals(J['proposals'])}</section>
<section id="road"><h2>Lộ trình đề xuất</h2><ul class="road">{road}</ul></section>
<section id="lenh"><h2>LỆNH #43 — đo sức khoẻ bằng số thật (chỉ đọc)</h2>{md(J['lenh'])}</section>
<section><h2>Phương pháp</h2>{md(J['method'])}</section>
<p class="muted" style="margin-top:36px">Sinh bởi <code>docs/rasoat-automation-2026-09-10/build.py</code> · {datetime.date.today().isoformat()}</p>
</div>"""
open(os.path.join(here,'report.html'),'w',encoding='utf-8').write(page); print('report.html',len(page),'bytes ·',cnt)
