# v119-64 / v120-esm-n: cặp font anh chốt 07/09 — Plus Jakarta Sans (tiêu đề · nút · nhãn) + Be Vietnam Pro (thân chữ);
# JetBrains Mono giữ cho mã/số kỹ thuật. Áp lên cây v119-63 (IIFE) hoặc v120-esm-m (ESM) — cùng script.
import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]

# ---- 1. Google Fonts: Jakarta 500–800 · Be Vietnam Pro 400–700 · JetBrains Mono 400–600 ----
rep('app.html','<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />',
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />',tag='1.fontlink')

# ---- 2. tokens.css: --font = Be Vietnam Pro (thân chữ), --font-head = Plus Jakarta Sans (tiêu đề/nút/nhãn) ----
p='assets/css/tokens.css'
rep(p,"  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;",
      "  --font: 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",tag='2.font')
rep(p,"  --font-head: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
      "  --font-head: 'Plus Jakarta Sans', 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",tag='2.font-head')
rep(p,"   Plus Jakarta Sans (display) + Inter (body) + JetBrains Mono (data) · gradient xanh–đỏ ·",
      "   Plus Jakarta Sans (tiêu đề · nút · nhãn) + Be Vietnam Pro (thân chữ) + JetBrains Mono (mã) · gradient xanh–đỏ ·",tag='2.comment')
# bỏ feature riêng của Inter (Be Vietnam Pro không có cv11/ss03)
rep(p,'  font-feature-settings: "cv11", "ss03"; /* Inter: a một tầng + dấu ngoặc tròn – mềm mắt hơn cho tiếng Việt */\n','',tag='2.features')
# nút + chip/badge trong tokens.css → Jakarta
rep(p,"  padding: 10px 18px; border-radius: var(--r-md);\n  font-weight: 600; font-size: 14px; line-height: 1.2;\n",
      "  padding: 10px 18px; border-radius: var(--r-md);\n  font-family: var(--font-head); font-weight: 600; font-size: 14px; line-height: 1.2;\n",tag='2.btn')
rep(p,"  padding: 3.5px 10px; border-radius: var(--r-full);\n  font-size: 11px; font-weight: 600; letter-spacing: .02em;\n",
      "  padding: 3.5px 10px; border-radius: var(--r-full);\n  font-family: var(--font-head); font-size: 11px; font-weight: 600; letter-spacing: .02em;\n",tag='2.chip')

# ---- 3. app.css: nhãn/eyebrow/nút đang ghi rõ var(--font) → var(--font-head) ----
p='assets/css/app.css'
for old,tag in [
  ("  font-family: var(--font); font-weight: 500; font-size: 10px;\n  color: var(--ink-400); letter-spacing: .1em; text-transform: uppercase;", '3.brand-small'),
  ("  padding: 20px 12px 7px;\n  font-family: var(--font);\n", '3.side-group'),
  ("  font-family: var(--font); font-size: 11px; font-weight: 700;\n  background: rgba(237,28,36,.1); color: #C71017;", '3.nav-count'),
  ("  font-family: var(--font); font-size: 12px; font-weight: 600; letter-spacing: .02em;\n  box-shadow: 0 1px 2px rgba(27,45,204,.3)", '3.avatar'),
  ("  background: #ED1C24; color: #fff;\n  font-family: var(--font); font-size: 10px; font-weight: 700;", '3.topbadge'),
  ("  font-family: var(--font); font-size: 11.5px; font-weight: 600;\n  padding: 2.5px 8px; border-radius: var(--r-full);", '3.kpi-delta'),
  ("  font-family: var(--font); font-size: 11px; font-weight: 600;\n  letter-spacing: .07em; text-transform: uppercase; color: var(--ink-400);", '3.tbl-th'),
  ("  margin-left: auto;\n  font-family: var(--font); font-size: 11px; font-weight: 600;\n  background: #fff; color: var(--ink-500);", '3.kcol-c'),
  ("  font-family: var(--font); font-size: 11px; font-weight: 700; color: #fff;\n  font-variant-numeric: tabular-nums;", '3.kcard-score'),
  ("  font-family: var(--font); font-size: 10.5px; font-weight: 700;\n  letter-spacing: .1em; text-transform: uppercase;", '3.reply-lb'),
  ("  padding: 9.5px 17px; border-radius: var(--r-md);\n  font-family: var(--font);\n  font-weight: 600; font-size: 13.5px;", '3.btn-override'),
]:
    rep(p, old, old.replace('var(--font)','var(--font-head)'), tag=tag)

# nhóm nhãn/nút còn lại (đang inherit thân chữ) → Jakarta; ô nhập/select vẫn thân chữ Be Vietnam Pro
wr(p, rd(p)+'''
/* ===== v119-64: cặp font anh chốt — Plus Jakarta Sans cho tiêu đề · nút · nhãn; Be Vietnam Pro cho thân chữ ===== */
.nav-item, .side-nav .nav-item, .seg button, .bt-item, .form-row label, .oa-capf label, .kpi .lbl,
.rl-tbl th, .agy-h, .oa-ahead, .oa-vhead, .ld-ana-head, .ld-arow .k, .ld-stage .row1 .k,
.donut-center span, .src-row .stat .l, .sidebar-hotline-label, .sb-k, .mt-k, .mt-tl-h, .pv2-justrow,
.sl-menu-i, .side-user .nm, .mobile-bar .brand { font-family: var(--font-head); }
'''); lib._log.append('3.labels-block')

# ---- 4. màn đăng nhập (#authGate) đang ghi cứng font hệ thống → theo token ----
p=None
for cand in ['src/app/80-rbac-auth.js']:
    p=cand
s=rd(p)
old1="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue','Inter','Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}"
new1="font-family:var(--font,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif);-webkit-font-smoothing:antialiased}"
rep(p,old1,new1,tag='4.gate-body')
old2="color:#16182B;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue','Inter','Segoe UI',sans-serif}"
new2="color:#16182B;font-family:var(--font-head,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif)}"
rep(p,old2,new2,tag='4.gate-h2')
old3="letter-spacing:-.005em;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:9px;"
new3="letter-spacing:-.005em;cursor:pointer;font-family:var(--font-head,inherit);display:flex;align-items:center;justify-content:center;gap:9px;"
rep(p,old3,new3,tag='4.gate-btn')
# nhãn ô nhập / link nhỏ ở màn đăng nhập giữ thân chữ (inherit)

done()
