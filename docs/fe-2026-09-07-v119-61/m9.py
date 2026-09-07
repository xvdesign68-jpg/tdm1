# m9.py <cây> — v119-66 / v120-esm-p: font Geist (1 họ cho tiêu đề · nút · nhãn · thân chữ), JetBrains Mono giữ cho mã.
# Áp lên cây v119-65 / v120-esm-o (IIFE hoặc ESM, cùng file). Fail-closed: mốc không khớp → dừng, không ghi. DRY=1 để kiểm mốc.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
LINK_OLD = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
LINK_LP  = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
LINK_NEW = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
rep('app.html', LINK_OLD, LINK_NEW, tag='link.app')
rep('privacy.html', LINK_LP, LINK_NEW, tag='link.privacy')
rep('terms.html', LINK_LP, LINK_NEW, tag='link.terms')
T = 'assets/css/tokens.css'
rep(T, "  --font: 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
       "  --font: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;", tag='tok.font')
rep(T, "  --font-head: 'Plus Jakarta Sans', 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
       "  --font-head: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;", tag='tok.head')
rep(T, "   Plus Jakarta Sans (tiêu đề · nút · nhãn) + Be Vietnam Pro (thân chữ) + JetBrains Mono (mã)",
       "   Geist (tiêu đề · nút · nhãn · thân chữ — v119-66) + JetBrains Mono (mã)", tag='tok.cmt')
rep('assets/css/app.css', "/* ===== v119-64: cặp font anh chốt — Plus Jakarta Sans cho tiêu đề · nút · nhãn; Be Vietnam Pro cho thân chữ ===== *",
       "/* ===== v119-64: nhãn/nút dùng --font-head (v119-66: cả hai token = Geist) ===== *", tag='css.cmt')
done()
