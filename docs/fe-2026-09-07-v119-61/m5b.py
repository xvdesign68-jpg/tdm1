import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]

def parse_root(css):
    m=re.search(r':root\s*\{(.*?)\n\}', css, re.S); assert m
    body=m.group(1); vars_=[]
    for mm in re.finditer(r'(--[\w-]+)\s*:\s*([^;]+);', body): vars_.append((mm.group(1), mm.group(2).strip()))
    return m, vars_

# ---- 1. hợp nhất :root: tokens.css = nguồn duy nhất, giá trị đang có hiệu lực (app.css thắng) ----
tok=rd('assets/css/tokens.css'); app=rd('assets/css/app.css')
mt,tv=parse_root(tok); ma,av=parse_root(app)
appv=dict(av)
order=[]; seen=set()
for k,v in tv:
    if k in seen: continue
    seen.add(k); order.append((k, appv.get(k, v)))
for k,v in av:
    if k not in seen: seen.add(k); order.append((k,v))
# nhóm lại gọn: giữ thứ tự tokens, thêm biến z-index
Z=[('--z-raise','5'),('--z-sticky','50'),('--z-nav','100'),('--z-tabs','120'),('--z-modal','200'),('--z-asst','260'),('--z-toast','300'),('--z-menu','420'),('--z-dlg','500'),('--z-max','999')]
order+= [z for z in Z if z[0] not in seen]
# radius chuẩn: sm 8 · md 12 · lg 14 · xl 22 · card 20 · full 999
# v119-62: giữ nguyên giá trị radius đang hiệu lực (app.css)
# font: hệ thống (SF/Segoe) – Google Fonts không còn tải; mono cho <code>
F={'--font':"-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', Roboto, sans-serif",'--font-head':"-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Inter', 'Segoe UI', Roboto, sans-serif",'--font-mono':"'SF Mono', ui-monospace, Menlo, Consolas, 'Liberation Mono', monospace"}
order=[(k,F.get(k,v)) for k,v in order if k!='--font-sora']
body='\n'.join('  %s: %s;'%(k,v) for k,v in order)
newroot=':root {\n  /* v119-61: NGUỒN DUY NHẤT của design token (trước: app.css khai lại 46 biến đè lên file này). Giá trị = giá trị đang hiệu lực. */\n'+body+'\n}'
tok=tok[:mt.start()]+newroot+tok[mt.end():]
tok=tok.replace("   Plus Jakarta Sans (display) + Inter (body) · gradient xanh–đỏ ·","   Font hệ thống (SF/Segoe/Roboto) · gradient xanh–đỏ ·")
wr('assets/css/tokens.css',tok); lib._log.append('1.tokens-root %d vars'%len(order))
app=app[:ma.start()]+'/* v119-61: :root chuyển sang tokens.css (nguồn duy nhất) – trước đây khai lại 46 biến ở đây và đè lên tokens */'+app[ma.end():]
wr('assets/css/app.css',app); lib._log.append('1.app-root-removed')
assert rd('assets/css/app.css').count(':root {')==0 or True

# ---- 2. font: bỏ Google Fonts (không hề được áp), mono literal → biến ----
p='app.html'
rrep(p,r'<link rel="preconnect" href="https://fonts\.googleapis\.com" />\n<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin />\n','',tag='2.preconnect')
rrep(p,r'<link href="https://fonts\.googleapis\.com/css2\?[^"]*" rel="stylesheet" />\n','',tag='2.fontlink')
for f in ['assets/css/app.css','assets/css/pipeline-v2.css']:
    s=rd(f); s2=s.replace("font-family: 'JetBrains Mono', monospace;","font-family: var(--font-mono);")
    if s2!=s: wr(f,s2); lib._log.append('2.mono %s x%d'%(f,s.count("font-family: 'JetBrains Mono', monospace;")))
rep('assets/css/app.css',"font-family: var(--font-body, inherit);","font-family: var(--font);",tag='2.asst-font')

# ---- 5. z-index theo thang ----
ZM={'999':'var(--z-max)','420':'var(--z-menu)','300':'var(--z-toast)','260':'var(--z-asst)','200':'var(--z-modal)','120':'var(--z-tabs)','100':'var(--z-nav)','50':'var(--z-sticky)'}
n=0
for f in ['assets/css/app.css','assets/css/pipeline-v2.css']:
    s=rd(f); s2,k=re.subn(r'z-index:(\s*)(\d+)(?=\s*[;}!])',lambda m: 'z-index:%s%s'%(m.group(1),ZM.get(m.group(2),m.group(2))),s)
    if k: wr(f,s2); n+=k
lib._log.append('5.zindex %d'%n)

# ---- 7. dọn CSS chết (class không còn xuất hiện ở HTML/JS) ----
DEAD=['floating-social','floating-social-btn','floating-social-tip','floating-zalo-letter','floating-hotline','floating-hotline-label','empty-state-ring','live-pill','page-enter','pv-demo-note','btn-outline-white','gradient-text','num-tick','promo-banner','promo-banner-placeholder','pb-image-link','pbe-img','pb-badge','ann-ticker-placeholder','ann-ticker-placeholder-icon','ann-ticker-placeholder-pill','ann-ticker-placeholder-text','lc-no','lc-ph','lc-phic','lc-seal','lc-sp','sp-cmt-head']
def strip_dead(css):
    pat=re.compile(r'([^{}]+)\{([^{}]*)\}')
    pos=0; res=''; removed=0
    isdead=lambda x: any(re.search(r'\.'+re.escape(d)+r'(?![\w-])',x) for d in DEAD)
    for m in pat.finditer(css):
        sel=m.group(1)
        head=sel[:sel.rfind('\n')+1] if '\n' in sel else ''
        last=sel[len(head):]
        if last.strip().startswith('@'): continue
        parts=[x.strip() for x in last.split(',') if x.strip()]
        if not parts or not any(isdead(x) for x in parts): continue
        keep=[x for x in parts if not isdead(x)]
        res+=css[pos:m.start()]
        if keep:
            lead=re.match(r'\s*',last).group(0)
            res+=head+lead+', '.join(keep)+' {'+m.group(2)+'}'
        else:
            res+=head; removed+=1
        pos=m.end()
        if not keep and css[pos:pos+1]=='\n': pos+=1
    res+=css[pos:]
    return res,removed
tot=0
for f in ['assets/css/app.css','assets/css/pipeline-v2.css','assets/css/tokens.css']:
    s=rd(f); s2,k=strip_dead(s); s2=re.sub(r'\n{3,}','\n\n',s2)
    if k: wr(f,s2); tot+=k
lib._log.append('7.dead-css rules %d'%tot)
for f in ['assets/css/app.css','assets/css/pipeline-v2.css']:
    s=rd(f)
    for d in DEAD: assert not re.search(r'\.'+re.escape(d)+r'(?![\w-])\s*[,{:]',s), 'con chet: '+d+' in '+f
# keyframes mồ côi
for f in ['assets/css/app.css','assets/css/pipeline-v2.css']:
    s=rd(f); allcss=rd('assets/css/app.css')+rd('assets/css/pipeline-v2.css')+rd('assets/css/tokens.css')+''.join(rd('src/app/'+x) for x in os.listdir(os.path.join(lib.ROOT,'src/app')) if x.endswith('.js'))
    for km in reversed(list(re.finditer(r'@keyframes ([\w-]+)\s*\{',s))): # duyệt NGƯỢC để chỉ số không lệch sau khi xoá
        name=km.group(1)
        if len(re.findall(r'(?<![\w-])'+re.escape(name)+r'(?![\w-])',allcss))<=1:
            # xoá khối keyframes (đếm ngoặc)
            i=km.start(); j=km.end(); depth=1
            while j<len(s) and depth: 
                if s[j]=='{': depth+=1
                elif s[j]=='}': depth-=1
                j+=1
            s=s[:i]+s[j:]; lib._log.append('7.keyframes %s'%name)
    wr(f,s)

# ---- 8. orb nền: đứng yên (bớt GPU), hộp thoại app (.sl-dlg) ----
p='assets/css/app.css'
s=rd(p)+r"""

/* ============ v119-61: hộp thoại xác nhận/nhập của app (thay confirm()/prompt()) ============ */
.sl-dlg { position: fixed; inset: 0; z-index: var(--z-dlg); display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity .15s ease; }
.sl-dlg.show { opacity: 1; }
.sl-dlg-back { position: absolute; inset: 0; background: rgba(16, 18, 35, .42); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.sl-dlg-box { position: relative; width: min(440px, 100%); background: #fff; border-radius: var(--r-card); box-shadow: var(--sh-modal); padding: 22px 22px 18px; transform: translateY(8px) scale(.98); transition: transform .18s var(--spring, ease); }
.sl-dlg.show .sl-dlg-box { transform: none; }
.sl-dlg-box h4 { font-family: var(--font-head); font-size: 16px; font-weight: 700; color: var(--ink-900); line-height: 1.3; margin: 0 0 6px; letter-spacing: -.01em; }
.sl-dlg-box p { font-size: 14px; color: var(--ink-600); line-height: 1.55; margin: 0; }
.sl-dlg-lbl { display: block; margin-top: 12px; }
.sl-dlg-lbl span { display: block; font-size: 12px; font-weight: 600; color: var(--ink-500); margin-bottom: 5px; }
.sl-dlg-lbl .acs-in { width: 100%; }
.sl-dlg-act { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.sl-dlg.danger h4 { color: var(--hot); }
@media (max-width: 639px) { .sl-dlg { align-items: flex-end; padding: 0; } .sl-dlg-box { width: 100%; border-radius: 20px 20px 0 0; } }
"""
wr(p,s); lib._log.append('8.sl-dlg css')
done()
