import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]

# ---- A. Pipeline: ẩn chip tuổi khi không có mốc, nút Chi tiết = icon, gợi ý kéo-thả = tooltip ----
p='src/app/30-pipeline.js'
rep(p,"""<span class="pv2-age ${lvlCls}">${PV2I.clock} ${esc(x.age)}</span>""","""${x.age==='—'?'':`<span class="pv2-age ${lvlCls}">${PV2I.clock} ${esc(x.age)}</span>`}""",tag='A.age')
rep(p,"""<button class="pv2-open" title="Mở chi tiết lead" data-pv-open="${esc(l.id)}">Chi tiết ${PV2I.next}</button>""","""<button class="pv2-open" title="Mở chi tiết lead" aria-label="Mở chi tiết lead" data-pv-open="${esc(l.id)}">${PV2I.next}</button>""",tag='A.open')
rep(p,"""<span class="pv2-tip">Kéo-thả thẻ giữa các cột để đổi giai đoạn · bấm thẻ xem chi tiết</span>""","""<span class="pv2-tip" title="Kéo-thả thẻ giữa các cột để đổi giai đoạn · bấm thẻ xem chi tiết">${SLI.info} Kéo-thả để đổi giai đoạn</span>""",tag='A.tip')

# ---- B. Người dùng: hàng nút brand → 2 nút chính + menu ⋯ ----
p='src/app/85-users-admin.js'
s=rd(p); a=s.find(' <button class="btn btn-ghost btn-sm" data-bilprof='); b=s.find('Xoá</button></td></tr>`;}).join(\'\')'); assert a>0 and b>a, 'users buttons'
seg=s[a:b+len('Xoá</button>')]
# tách nút Thiết lập (giữ ngoài), phần còn lại vào menu
i=seg.find(' <button class="btn btn-ghost btn-sm" data-wzbrand='); j=seg.find('Thiết lập</button>',i)+len('Thiết lập</button>'); assert i>0 and j>i
wz=seg[i:j]; rest=seg[:i]+seg[j:]
new=' '+wz.strip()+' <span class="sl-more" hidden>'+rest.strip()+'</span><button type="button" class="btn btn-ghost btn-sm sl-more-btn" data-more-menu title="Thêm thao tác" aria-label="Thêm thao tác">⋯</button>'
s=s[:a]+new+s[b+len('Xoá</button>'):]; wr(p,s); lib._log.append('B.users-menu')
rep(p,"(u.email.includes('@gmail.')?'Google?':'Email')","''",tag='B.provider')
rep('src/app/70-shell-tools.js',"const k=t.l.assignee||'— chưa giao —';","const k=t.l.assignee||'Chưa giao';",tag='B.chuagiao')

# ---- C. Menu ⋯ dùng chung (10-core) ----
p='src/app/10-core-overview.js'
rep(p,"  const meta = {\n","""  /* v119-61: menu ⋯ dùng chung – nút [data-more-menu] mở danh sách các nút đang giấu trong .sl-more đứng trước nó; chọn = bấm nút gốc (giữ nguyên handler, an toàn với morph) */
  document.addEventListener('click',e=>{
    const open=document.getElementById('slMenu'); const b=e.target.closest('[data-more-menu]');
    if(!b){ if(open&&!e.target.closest('#slMenu')) open.remove(); return; }
    e.preventDefault(); e.stopPropagation();
    if(open){ const same=open.__for===b; open.remove(); if(same) return; }
    let box=b.previousElementSibling; if(!(box&&box.classList.contains('sl-more'))) box=b.parentElement&&b.parentElement.querySelector('.sl-more'); if(!box) return;
    const items=[...box.querySelectorAll('button')]; if(!items.length) return;
    const m=document.createElement('div'); m.id='slMenu'; m.className='sl-menu'; m.setAttribute('role','menu'); m.__for=b;
    m.innerHTML=items.map((it,i)=>`<button type="button" role="menuitem" class="sl-menu-i${it.disabled?' dis':''}" data-i="${i}" title="${esc(it.title||'')}">${it.innerHTML}</button>`).join('');
    document.body.appendChild(m);
    const r=b.getBoundingClientRect(); m.style.top=Math.min(r.bottom+6, window.innerHeight-m.offsetHeight-8)+'px'; m.style.left=Math.max(8, Math.min(r.right-m.offsetWidth, window.innerWidth-m.offsetWidth-8))+'px';
    m.querySelectorAll('[data-i]').forEach(x=>x.addEventListener('click',ev=>{ ev.preventDefault(); ev.stopPropagation(); const it=items[+x.dataset.i]; m.remove(); if(it&&!it.disabled) it.click(); }));
    const close=()=>{ m.remove(); document.removeEventListener('keydown',onK,true); };
    const onK=ev=>{ if(ev.key==='Escape'){ ev.stopPropagation(); close(); } };
    document.addEventListener('keydown',onK,true); view.addEventListener('scroll',close,{once:true});
    const f=m.querySelector('.sl-menu-i'); if(f) f.focus();
  },true);

  const meta = {
""",tag='C.menu')

# ---- D. chip "Super Admin" lặp → biểu tượng khoá có tooltip ----
for f in sorted(os.listdir(os.path.join(lib.ROOT,'src/app'))):
    if not f.endswith('.js'): continue
    pp='src/app/'+f; s=rd(pp)
    s2=re.sub(r'<span class="chip chip-hot"(?: style="[^"]*")?>Super Admin</span>','<span class="sa-lock" title="Chỉ Super Admin thấy và chỉnh mục này" aria-label="Chỉ Super Admin"></span>',s)
    if s2!=s: wr(pp,s2); lib._log.append('D.salock %s x%d'%(pp,s.count('>Super Admin</span>')))

# ---- E. Hộp AI trên thẻ lead: 1 kiểu ----
p='src/app/20-feed.js'
rep(p,"return `<span class=\"chip chip-zalo\">${SEAL_IC}SĐT có liên kết với Zalo</span>`;","return `<span class=\"chip chip-zalo\">${SEAL_IC}SĐT có Zalo</span>`;",tag='E.zalo1')
rep(p,"return '<span class=\"chip chip-nozalo\">SĐT chưa liên kết với Zalo</span>';","return '<span class=\"chip chip-nozalo\">SĐT chưa có Zalo</span>';",tag='E.zalo2')

p='src/app/10-core-overview.js'
rep(p,'<div style="font-size:28px;margin-bottom:8px">${mt.icon}</div>','<div class="sm-ic" style="color:${mt.color}">${mt.icon}</div>',tag='E2.sm-ic')
rep(p,'<div style="font-size:24px">${from.icon}</div>','<div class="sm-ic-s" style="color:${from.color}">${from.icon}</div>',tag='E2.sm-from')
rep(p,'<div style="font-size:24px">${to.icon}</div>','<div class="sm-ic-s" style="color:${to.color}">${to.icon}</div>',tag='E2.sm-to')

# ---- F. tiền tệ: chi phí USD theo en-US (hết "$0,0078") ----
rep('src/app/60-scan-views.js',"function fmtCost(u){ return '$'+(Number(u)||0).toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:4}); }","function fmtCost(u){ return '$'+(Number(u)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}); }",tag='F.fmtCost')

# ---- G. (bỏ ở v119-62: giữ nguyên khối brand gradient anh đã chỉnh v129–v131) ----
# ---- H. CSS ----
p='assets/css/app.css'
s=rd(p)+r"""

/* ============ v119-61: bố cục – menu ⋯, bóng cuộn bảng rộng, khoá Super Admin, mobile KPI, hộp AI, empty-state ============ */
.sl-more[hidden] { display: none !important; }
.sl-more-btn { padding-left: 9px; padding-right: 9px; font-size: 15px; line-height: 1; }
.sl-menu { position: fixed; z-index: 420; min-width: 180px; padding: 6px; background: #fff; border: 1px solid var(--border-2); border-radius: 12px; box-shadow: var(--sh-md); display: flex; flex-direction: column; gap: 2px; }
.sl-menu-i { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--ink-800); }
.sl-menu-i:hover, .sl-menu-i:focus-visible { background: var(--surface-2); outline: none; }
.sl-menu-i.dis { opacity: .45; cursor: not-allowed; }
.sl-menu-i .i { width: 14px; height: 14px; color: var(--ink-400); }
/* bóng mờ 2 mép báo còn nội dung khi cuộn ngang (CSS thuần: lớp phủ trắng cuộn theo nội dung, bóng đứng yên) */
.view div[style*="overflow-x:auto"], .view div[style*="overflow-x: auto"], .tbl-wrap, .kanban {
  background:
    linear-gradient(90deg, #fff 30%, rgba(255,255,255,0)) left / 44px 100% no-repeat local,
    linear-gradient(90deg, rgba(255,255,255,0), #fff 70%) right / 44px 100% no-repeat local,
    radial-gradient(farthest-side at 0 50%, rgba(16,18,35,.16), transparent) left / 18px 100% no-repeat scroll,
    radial-gradient(farthest-side at 100% 50%, rgba(16,18,35,.16), transparent) right / 18px 100% no-repeat scroll;
}
.sa-lock { display: inline-block; width: 13px; height: 13px; margin-left: 6px; vertical-align: -2px; background: var(--ink-300); -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='4' y='10.5' width='16' height='10' rx='2.5'/%3E%3Cpath d='M8 10.5V7.5a4 4 0 0 1 8 0v3'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='4' y='10.5' width='16' height='10' rx='2.5'/%3E%3Cpath d='M8 10.5V7.5a4 4 0 0 1 8 0v3'/%3E%3C/svg%3E") center / contain no-repeat; cursor: help; }
.ld-cform { scroll-margin-bottom: 96px; }
.empty-state > .i { width: 44px; height: 44px; padding: 10px; box-sizing: border-box; border-radius: 50%; background: var(--surface-2); color: var(--brand-500); opacity: 1; }
.empty-state p b { color: var(--ink-900); }
@media (max-width: 639px) {
  .grid.g-4 { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .kpi { padding: 14px 14px 12px; }
  .kpi .val { font-size: 26px; }
  .kpi .ic { width: 32px; height: 32px; }
  .lead-card .hd { gap: 6px; }
  .lead-card .hd .id { display: none; }
}
/* icon SVG thay emoji minh hoạ lớn (thẻ phương thức quét) – to, có màu như emoji cũ */
.sm-ic { margin-bottom: 8px; } .sm-ic .i { width: 34px; height: 34px; stroke-width: 1.6; }
.sm-ic-s .i { width: 26px; height: 26px; stroke-width: 1.6; }
.oa-cfgbtn .i { color: var(--brand-600); }
"""
wr(p,s); lib._log.append('H.css')
p='assets/css/pipeline-v2.css'
s=rd(p)+r"""

.pv2-open { padding: 4px 7px; }
.pv2-tip { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.pv2-tip .i { width: 13px; height: 13px; }
"""
wr(p,s); lib._log.append('H.css-pipeline')
done()
