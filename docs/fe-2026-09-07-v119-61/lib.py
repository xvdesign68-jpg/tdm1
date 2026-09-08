import re, sys, io, os
ROOT = None
DRY = bool(os.environ.get('DRY'))
_log=[]; _fail=[]; _cache={}
def rd(p):
    if p in _cache: return _cache[p]
    with io.open(os.path.join(ROOT,p),encoding='utf-8') as f: s=f.read()
    _cache[p]=s; return s
_dirty=set()
def wr(p,s):
    # 2 pha (08/09): chỉ sửa cache + đánh dấu; done() ghi đĩa khi KHÔNG có mốc lỗi → chạy thật mà mốc sau lỗi thì file trước cũng KHÔNG bị ghi dở
    _cache[p]=s; _dirty.add(p)
def _flush():
    for p in sorted(_dirty):
        with io.open(os.path.join(ROOT,p),'w',encoding='utf-8',newline='\n') as f: f.write(_cache[p])
def _err(msg):
    if DRY: _fail.append(msg); return
    raise SystemExit(msg)
def rep(p, old, new, count=1, tag=''):
    s=rd(p); n=s.count(old)
    if n==0: return _err('KHONG THAY MOC [%s] %s: %r' % (tag,p,old[:110]))
    if count is not None and n!=count: return _err('MOC KHONG DUY NHAT [%s] %s: %d x %r' % (tag,p,n,old[:90]))
    s=s.replace(old,new); wr(p,s); _log.append('%s %s x%d'%(tag or 'rep',p,n))
def rrep(p, pat, new, count=1, tag='', flags=0):
    s=rd(p); ms=re.findall(pat,s,flags)
    if not ms: return _err('KHONG THAY REGEX [%s] %s: %r'%(tag,p,pat[:90]))
    if count is not None and len(ms)!=count: return _err('REGEX KHONG DUY NHAT [%s] %s: %d x %r'%(tag,p,len(ms),pat[:90]))
    s=re.sub(pat,new,s,flags=flags); wr(p,s); _log.append('%s %s x%d'%(tag or 'rrep',p,len(ms)))
def cut(p, start, end, tag='', keep_end=False):
    s=rd(p); i=s.find(start)
    if i<0: return _err('KHONG THAY DAU [%s] %s: %r'%(tag,p,start[:80]))
    j=s.find(end,i)
    if j<0: return _err('KHONG THAY CUOI [%s] %s: %r'%(tag,p,end[:80]))
    s=s[:i]+(s[j:] if keep_end else s[j+len(end):]); wr(p,s); _log.append('%s %s cut %d'%(tag or 'cut',p,j-i))
def done():
    print('\n'.join(_log)); 
    if _fail: print('\n'.join(_fail)); print('DRY FAIL %d'%len(_fail)); sys.exit(2)
    if not DRY: _flush(); print('GHI %d file'%len(_dirty))
    print('PATCH OK (%d)'%len(_log))
