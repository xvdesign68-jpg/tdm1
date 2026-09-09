# m27.py <cây> — v119-85 / v120-esm-ai (09/09/2026 chiều, anh: "hình như anh thấy loại font của "số" tại toàn web này đang không đồng bộ lắm -> em check kĩ lại nha").
# ĐO THẬT (scratchpad numfont.js: mọi text node có chữ số ở 18 mục + modal, font đang render): chữ số đang lẫn 4 font trong cùng 1 màn —
#   TikTok Sans (thân chữ, KPI phễu, điểm Nên gọi, bảng Báo cáo/ROI) · Plus Jakarta Sans (KPI 34px, badge, vòng điểm, đếm kanban, ô nguồn, ROI hero) ·
#   JetBrains Mono (card Hôm nay 26px, dải nhiệt độ, Bảng brand td.mono, van Tiếp cận, rail feed, chi phí, timeline) · font hệ thống (trục + tooltip Chart.js "-apple-system…").
#   Vd Bảng điều khiển: KPI Jakarta 34px · Hôm nay JetBrains Mono 26px · Nên gọi TikTok 800 · phễu TikTok · nhiệt độ Mono · Bảng brand Mono → 3 font số trên 1 màn.
# QUY TẮC MỚI (khớp chốt 08/09 v119-67 "số dùng TikTok Sans"; 1 token 1 quyết định):
#   (1) `--font-num` (tokens.css) = font CHỮ SỐ toàn web = TikTok Sans (đổi 1 dòng nếu anh muốn Jakarta) — mọi số liệu/đếm/điểm/badge/van/trục biểu đồ dùng token này + tabular-nums;
#   (2) `.mono` = SỐ LIỆU (dùng --font-num, không còn monospace); (3) `.code`/`code`/`kbd` = MÃ KỸ THUẬT (id, token, mã brand, version) = JetBrains Mono — 5 chỗ JS đổi class mono → code;
#   (4) chữ số nằm trong nhãn/chip có chữ ("Ấm 74đ", "còn mở 291", "14 ngày qua") giữ font của nhãn (Jakarta) — không đổi; (5) Chart.js: `CHART_FONT` + `Chart.defaults.font.family`.
# Áp lên cây v119-84 / v120-esm-ah (sau m26). ESM: 10-core export thêm CHART_FONT, 65 import thêm CHART_FONT (tự phát hiện cây ESM).
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
T='assets/css/tokens.css'; A='assets/css/app.css'; P='assets/css/pipeline-v2.css'
C10='src/app/10-core-overview.js'; C65='src/app/65-charts-lead-modal.js'; C45='src/app/45-outreach.js'; C85='src/app/85-users-admin.js'; C87='src/app/87-brand-wizard.js'; S='tools/smoke.js'

def swap(p, sel, old, new, tag):
    """Trong rule CSS bắt đầu bằng `sel {` (đúng 1 rule), đổi đúng 1 `font-family: old` → `font-family: new`. Fail-closed."""
    s=rd(p); pat=re.compile(r'(^|\n)'+re.escape(sel)+r'\s*\{[^{}]*\}')
    ms=list(pat.finditer(s))
    if len(ms)!=1: return lib._err('RULE %s x%d [%s] %s'%(sel,len(ms),tag,p))
    blk=ms[0].group(0); o='font-family: '+old; n='font-family: '+new
    if blk.count(o)!=1: return lib._err('FONT %s x%d trong rule %s [%s]'%(old,blk.count(o),sel,tag))
    s=s[:ms[0].start()]+blk.replace(o,n)+s[ms[0].end():]; wr(p,s); lib._log.append('%s %s: %s → %s'%(tag,sel,old,new))

# ---------- (1) token + (2)(3) .mono / .code ----------
rep(T, """  --font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
""", """  --font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
  --font-num: 'TikTok Sans', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; /* v119-85: font CHỮ SỐ toàn web (KPI, đếm, điểm, badge, van, trục biểu đồ) — đổi 1 dòng này là đổi mọi chữ số */
""", tag='tok.num')
rep(T, """.mono { font-family: var(--font-mono); }
""", """.mono { font-family: var(--font-num); font-variant-numeric: tabular-nums; } /* v119-85: .mono = SỐ LIỆU (font số, không còn monospace); mã kỹ thuật dùng .code */
.code, code, kbd { font-family: var(--font-mono); } /* v119-85: mã kỹ thuật (id lead, mã brand, token, version, phím tắt) */
""", tag='tok.mono')

# ---------- app.css: Jakarta → font số ----------
for sel in ['.nav-item .count','.icon-btn .badge','.donut-center b','.kpi .delta','.kpi .val','.lead-card .score','.lead-card .score-ring b','.kcol .c','.kcard .ksc b','.kcard .sc','.src-row .stat .v','.ld-ring b','.sidebar-hotline-number','.rh-num','.rls-v','.oa-stat .n','.al-sum-row b']:
    swap(A, sel, 'var(--font-head)', 'var(--font-num)', 'app.head→num')
# ---------- app.css: JetBrains Mono → font số ----------
swap(A, '.src-share .pct', 'var(--font-mono)', 'var(--font-num)', 'app.mono→num')
swap(A, '.ld-tl-t', 'var(--font-mono, monospace)', 'var(--font-num)', 'app.mono→num')
swap(A, '.agy-score', 'var(--font-mono)', 'var(--font-num)', 'app.mono→num')
swap(A, '.asst-m code', 'ui-monospace, SFMono-Regular, Menlo, monospace', 'var(--font-mono)', 'app.code')
# ---------- pipeline-v2.css ----------
for sel in ['.pv2-irow .tx .n','.pv2-nm i, .pv2-bk i','.pv2-fsum b','.pv2-fseg .n','.rail-sum b','.spm-ring b']:
    swap(P, sel, 'var(--font-head)', 'var(--font-num)', 'pv.head→num')
for sel in ['.pv2-fseg .v','.pv2-kval','.pv2-val','.sc-n','.bp-score','.rail-temp b','.rail-note .rn-hd i','.rail-src b','.rail-lead b']:
    swap(P, sel, 'var(--font-mono)', 'var(--font-num)', 'pv.mono→num')

# ---------- đếm trong nút phân đoạn + chip điểm Safety (số thuần) → font số ----------
rep(A, ".seg button i { font-style: normal; opacity: .6; margin-left: 3px; }", ".seg button i { font-style: normal; opacity: .6; margin-left: 3px; font-family: var(--font-num); font-variant-numeric: tabular-nums; } /* v119-85: số đếm cạnh nhãn dùng font số */", tag='app.seg.num')
rep(A, ".oa-safety { font-weight: 800; }", ".oa-safety { font-weight: 800; font-family: var(--font-num); } /* v119-85: chip điểm Safety = số thuần */", tag='app.safety.num')

# ---------- JS: mã kỹ thuật đổi class mono → code ----------
rep(C45, '<div class="oa-apid mono">${esc(pid)}</div>', '<div class="oa-apid code">${esc(pid)}</div>', tag='js.code.pid')
rep(C45, '<div class="oa-vver mono">v${esc(w.version', '<div class="oa-vver code">v${esc(w.version', tag='js.code.ver')
rep(C87, 'class="acs-in mono" id="wzCode"', 'class="acs-in code" id="wzCode"', tag='js.code.wz')
rep(C65, 'class="mono" style="font-size:11px;color:var(--ink-400);font-weight:500;flex:none;cursor:pointer" data-tip="Lead số ${', 'class="code" style="font-size:11px;color:var(--ink-400);font-weight:500;flex:none;cursor:pointer" data-tip="Lead số ${', tag='js.code.leadno')
rep(C85, '<td>${s.phone?`<code>${esc(s.phone)}</code>`', '<td>${s.phone?`<span class="mono">${esc(s.phone)}</span>`', tag='js.phone.num')

# ---------- Chart.js: trục + tooltip dùng font số ----------
rep(C10, """  function slChart(key,c,cfg){ // v119-58:""", """  const CHART_FONT="'TikTok Sans','Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"; /* v119-85: trục/tooltip biểu đồ cùng font chữ số (trước: font hệ thống) */
  function slChart(key,c,cfg){ // v119-58:""", tag='js.chartfont.def')
rep(C10, """    const CH=window.Chart, old=charts[key], ex=(CH&&CH.getChart)?CH.getChart(c):null, sig=chartSig(cfg);
""", """    const CH=window.Chart, old=charts[key], ex=(CH&&CH.getChart)?CH.getChart(c):null, sig=chartSig(cfg);
    try{ if(CH&&CH.defaults&&CH.defaults.font&&CH.defaults.font.family!==CHART_FONT) CH.defaults.font.family=CHART_FONT; }catch(e){} /* v119-85 */
""", tag='js.chartfont.set')
s65=rd(C65); n=s65.count("\"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif\"")
if n!=8: lib._err('CHART FONT literal x%d (mong 8)'%n)
else: wr(C65, s65.replace("\"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif\"", 'CHART_FONT')); lib._log.append('js.chartfont.use 65 x8')
# ESM: export/import CHART_FONT
if "import './" in rd(C65):
    rep(C10, 'export { D, INDUSTRY_LIB, SCAN_METHODS,', 'export { CHART_FONT, D, INDUSTRY_LIB, SCAN_METHODS,', tag='esm.export')
    rep(C65, 'import { D, SLI, chartAnim, charts,', 'import { CHART_FONT, D, SLI, chartAnim, charts,', tag='esm.import')

# ---------- smoke ----------
rep(S, """  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
  await browser.close(); server.close();""", """  /* v119-85: chữ số đồng bộ 1 font — mọi số liệu/đếm/điểm/badge dùng --font-num (TikTok Sans), mã kỹ thuật (.code/code) JetBrains Mono, Chart.js cùng font số; không còn font hệ thống/monospace lẫn vào số liệu */
  const k85 = await page.evaluate(() => { const fam = e => (getComputedStyle(e).fontFamily || '').split(',')[0].replace(/["']/g, '').trim(); const D = window.SL_DATA; const r = {};
    location.hash = 'overview'; window.SLApp.reload(D); const q = s => document.querySelector(s); r.kpi = fam(q('#view .kpi .val')); r.today = fam(q('#view .td-tile b')); r.temp = fam(q('#view .temp-row .tv')); r.badge = fam(q('#topBadge')); r.count = fam(q('#cntFeed'));
    location.hash = 'feed'; window.SLApp.reload(D); r.ring = fam(q('#view .score-ring b')); r.rail = fam(q('#view .rail-temp b')); r.leadId = fam(q('#view .lead-card .id') || q('#view .lead-card'));
    location.hash = 'pipeline'; window.SLApp.reload(D); r.kanban = fam(q('#view .kcol .c')); r.ksc = fam(q('#view .ksc b'));
    location.hash = 'agency'; window.SLApp.reload(D); r.agyTd = fam(q('#view td.mono')); r.agyScore = fam(q('#view .agy-score')); r.agyCode = fam(q('#view .agy-name code'));
    location.hash = 'outreach'; window.SLApp.reload(D); r.valve = fam(q('#view .oa-vc')); r.pid = fam(q('#view .oa-apid'));
    location.hash = 'overview'; window.SLApp.reload(D); r.chart = (window.Chart && window.Chart.defaults.font.family) || ''; const cv = document.querySelector('#view canvas'); const ch = cv && window.Chart && window.Chart.getChart(cv); r.tick = ch ? ((ch.options.scales && ch.options.scales.x && ch.options.scales.x.ticks && ch.options.scales.x.ticks.font && ch.options.scales.x.ticks.font.family) || (ch.options.plugins.tooltip.bodyFont || {}).family || '') : '';
    r.tokNum = getComputedStyle(document.documentElement).getPropertyValue('--font-num').trim().split(',')[0].replace(/["']/g, ''); return r; });
  await page.waitForTimeout(200);
  const NUM = k85.tokNum; const numOk = ['kpi', 'today', 'temp', 'badge', 'count', 'ring', 'rail', 'kanban', 'ksc', 'agyTd', 'agyScore', 'valve'].filter(k => k85[k] !== NUM);
  (NUM === 'TikTok Sans' && numOk.length === 0 && k85.leadId === 'JetBrains Mono' && k85.agyCode === 'JetBrains Mono' && k85.pid === 'JetBrains Mono' && /TikTok Sans/.test(k85.chart) && /TikTok Sans/.test(k85.tick))
    ? ok('v119-85: chữ số 1 font "' + NUM + '" ở KPI · Hôm nay · nhiệt độ · badge · đếm menu · vòng điểm · rail · kanban · Bảng brand · van Tiếp cận; mã kỹ thuật JetBrains Mono (id lead, mã brand, pid); Chart.js font số') : fail('v119-85 font số: ' + JSON.stringify(k85) + ' lệch=' + numOk.join(','));
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
  await browser.close(); server.close();""", tag='smoke.k85')
done()
