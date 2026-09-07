# v119-63: trả lại khung hotline sidebar (như v119-60) + bộ font Plus Jakarta Sans / Inter / JetBrains Mono (Google Fonts)
import re, sys, os, io
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]; BASE = sys.argv[2]   # BASE = thư mục v119-60 (lấy lại HTML/CSS hotline nguyên bản)
def rdb(p): return io.open(os.path.join(BASE,p),encoding='utf-8').read()

# ---- 1. hotline sidebar ----
b=rdb('app.html'); i=b.find('    <!-- Sidebar hotline'); j=b.find('    </a>\n',i)+len('    </a>\n'); assert i>0 and j>i
hot_html=b[i:j]
rep('app.html','    <div class="side-foot">', hot_html+'\n    <div class="side-foot">',tag='1.hotline-html')
c=rdb('assets/css/app.css'); i=c.find('/* ============ HOTLINE (sidebar + floating) ============ */'); j=c.find('.floating-hotline, .floating-social {'); assert i>0 and j>i
hot_css=c[i:j].replace('/* ============ HOTLINE (sidebar + floating) ============ */','/* ============ HOTLINE (sidebar) – v119-63 trả lại theo ý anh; hotline nổi mobile vẫn bỏ ============ */')
hot_css=re.sub(r'@keyframes hotline-pulse \{[^}]*\}[^\n]*\n','',hot_css)  # keyframes đã có sẵn trong app.css
p='assets/css/app.css'
rrep(p,r'@keyframes hotline-pulse \{ 0% \{ transform: scale\(1\); opacity: \.6 \} 100% \{ transform: scale\(1\.8\); opacity: 0 \} \} /\* v119-61: hotline nổi/sidebar đã gỡ[^\n]*\n',
     lambda m: '@keyframes hotline-pulse { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(1.8); opacity: 0 } }\n'+hot_css, tag='1.hotline-css')
assert '.sidebar-hotline-number' in rd(p)

# ---- 2. font: Plus Jakarta Sans (tiêu đề/số) · Inter (chữ) · JetBrains Mono (mã) ----
rep('app.html','<link rel="apple-touch-icon" href="assets/img/icon-192.png" />\n',
    '<link rel="apple-touch-icon" href="assets/img/icon-192.png" />\n<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />\n',tag='2.fontlink')
p='assets/css/tokens.css'
rep(p,"  --font: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', Roboto, sans-serif;","  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;",tag='2.font')
rep(p,"  --font-head: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', 'Segoe UI', Roboto, sans-serif;","  --font-head: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",tag='2.font-head')
rep(p,"  --font-mono: 'SF Mono', ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace;","  --font-mono: 'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace;",tag='2.font-mono')
rep(p,"   Font hệ thống (SF/Segoe/Roboto) · gradient xanh–đỏ ·","   Plus Jakarta Sans (display) + Inter (body) + JetBrains Mono (data) · gradient xanh–đỏ ·",tag='2.comment')
# Inter: bật số đều cột cho mọi số liệu + chữ a/g đẹp hơn (cv11); Jakarta tiêu đề đã có letter-spacing -.02em
rep(p,"  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n  text-rendering: optimizeLegibility;\n}","  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n  text-rendering: optimizeLegibility;\n  font-feature-settings: \"cv11\", \"ss03\"; /* Inter: a một tầng + dấu ngoặc tròn – mềm mắt hơn cho tiếng Việt */\n}",tag='2.features')
p='assets/css/app.css'; wr(p, rd(p)+'\n/* v119-63: font Inter rộng hơn font hệ thống → thanh lọc feed trên điện thoại cuộn ngang thay vì gãy dòng; pill liên hệ được xuống dòng */\n@media (max-width: 639px) {\n  .seg { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }\n  .seg::-webkit-scrollbar { display: none; }\n  .seg > button { flex: none; }\n  .lead-card .fm-pill { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }\n}\n'); lib._log.append('3.mobile-seg')
done()
