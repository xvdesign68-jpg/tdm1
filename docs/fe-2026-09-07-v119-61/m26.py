# m26.py <cây> — v119-84 / v120-esm-ah (09/09/2026 chiều, anh gửi ảnh iPhone: bấm "Sao chép gợi ý" trong modal lead →
# toast "Đã chép: Chào em, Z15 Miracle Vietnam đang tuyển…" in NGUYÊN cả đoạn gợi ý AI (~500 ký tự) thành cục bầu dục đen che kín modal — "em check lại nhé").
# 3 lỗi: (0) toast fixed `left:50%` không đặt width → shrink-to-fit chỉ được dùng nửa màn hình còn lại (390px → 195px) nên nhãn ngắn cũng gãy 2 dòng, đoạn dài thành CỘT cao 360px (đúng cái cục bầu dục trong ảnh); (1) `__slCopy` toast luôn 'Đã chép: '+val — hợp với SĐT/email/mã lead (ngắn) nhưng gợi ý phản hồi dài → thừa, che màn;
#        (2) `toast()` bo góc 999px (pill) + không giới hạn bề rộng/không căn giữa chữ → nhiều dòng thành hình bầu dục, chữ đậm 14px dồn cục.
# Sửa: `__slCopy(el,val,label)` — có nhãn → "Đã chép <nhãn>"; không nhãn: giá trị ≤48 ký tự (1 dòng) giữ "Đã chép: <giá trị>", dài hơn → cắt 44 + "…";
#      modal gọi `__slCopy(cp,l.reply,'gợi ý phản hồi')`; `toast()` bo góc 22px (1 dòng vẫn pill ~44px, nhiều dòng = hộp bo góc), max-width min(92vw,520px),
#      căn giữa, line-height 1.4, ngắt từ dài (overflow-wrap:anywhere), tin >200 ký tự cắt "…" (toast là báo nhanh, không phải nơi đọc). Áp lên cây v119-83 / v120-esm-ag (sau m25).
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
F='src/app/20-feed.js'; M='src/app/65-charts-lead-modal.js'; S='tools/smoke.js'

# ---------- __slCopy: nhãn ngắn thay vì in nguyên nội dung đã chép ----------
rep(F, """  window.__slCopy=function(el,val){
    function fb(){""", """  window.__slCopy=function(el,val,label){ /* v119-84: label = tên thứ vừa chép ("gợi ý phản hồi") → toast "Đã chép gợi ý phản hồi" thay vì in nguyên đoạn dài che màn hình */
    function fb(){""", tag='copy.sig')
rep(F, """    try{toast('Đã chép: '+val);}catch(e){}
  };""", """    try{ const s=String(val==null?'':val).replace(/\\s+/g,' ').trim(); toast(label ? 'Đã chép '+label+'.' : (s.length<=48 ? 'Đã chép: '+s : 'Đã chép: '+s.slice(0,44).replace(/\\s+\\S*$/,'')+'…')); }catch(e){} // v119-84: SĐT/email/mã lead (ngắn) vẫn hiện giá trị để người dùng đối chiếu; đoạn dài chỉ báo ngắn
  };""", tag='copy.toast')

# ---------- modal: nút "Sao chép gợi ý" truyền nhãn ----------
rep(M, """window.__slCopy(cp,l.reply); }); // v119-40: guard reply rỗng + fallback clipboard""",
       """window.__slCopy(cp,l.reply,'gợi ý phản hồi'); }); // v119-40: guard reply rỗng + fallback clipboard · v119-84: nhãn ngắn (không in cả đoạn gợi ý lên toast)""", tag='modal.copy')

# ---------- toast(): nhiều dòng an toàn ----------
rep(M, """    if(!t){ t=el('<div id="toast" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ink-900);color:#fff;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:600;box-shadow:var(--sh-lg);z-index:300;opacity:0;transition:opacity .2s,transform .2s"></div>'); document.body.appendChild(t); }
    t.textContent=msg; t.style.opacity=1;""",
       """    if(!t){ t=el('<div id="toast" style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ink-900);color:#fff;padding:12px 20px;border-radius:22px;font-size:14px;font-weight:600;line-height:1.4;text-align:center;width:max-content;max-width:min(92vw,520px);box-sizing:border-box;overflow-wrap:anywhere;box-shadow:var(--sh-lg);z-index:300;opacity:0;transition:opacity .2s,transform .2s"></div>'); document.body.appendChild(t); } /* v119-84: bo 22px (1 dòng vẫn dạng pill, nhiều dòng = hộp bo góc thay vì bầu dục), width:max-content (phần tử fixed left:50% chỉ được dùng NỬA màn hình còn lại → trên điện thoại 390px toast chỉ rộng 195px nên chữ ngắn cũng gãy 2 dòng, đoạn dài thành cột cao 360px), rộng tối đa 520px/92vw, căn giữa */
    msg=String(msg==null?'':msg); if(msg.length>200) msg=msg.slice(0,196).replace(/\\s+\\S*$/,'')+'…'; /* v119-84: toast là báo nhanh 2,6 s — tin quá dài cắt bớt */
    t.textContent=msg; t.style.opacity=1;""", tag='toast.style')

# ---------- smoke ----------
rep(S, """  (Math.abs(mm.bottom - mm.h) <= 2) ? ok('Mobile modal dạng bottom-sheet') : fail('Mobile modal: ' + JSON.stringify(mm));
""", """  (Math.abs(mm.bottom - mm.h) <= 2) ? ok('Mobile modal dạng bottom-sheet') : fail('Mobile modal: ' + JSON.stringify(mm));
  /* v119-84: bấm "Sao chép gợi ý" trên điện thoại → toast nhãn ngắn (không in cả đoạn gợi ý), 1 dòng thấp, không tràn màn; toast dài nhiều dòng = hộp bo góc 22px, ≤ 92vw */
  const k84 = await mp.evaluate(() => { const D = window.SL_DATA; const cp = document.getElementById('copyReply'); const r = {};
    const l0 = D.leads.find(l => (document.querySelector('#modal h3 .truncate') || {}).textContent === l.name); const bak = l0 ? l0.reply : null; if (l0) l0.reply = 'Chào em, Z15 Miracle Vietnam đang tuyển cộng tác viên chốt đơn – nội dung dài ' + 'x'.repeat(400);
    if (cp) cp.click(); const t = document.getElementById('toast'); const tr = t ? t.getBoundingClientRect() : { width: 0, height: 0, left: 0, right: 0, top: -1 };
    r.txt = t ? t.textContent : ''; r.h = Math.round(tr.height); r.w = Math.round(tr.width); r.inView = tr.left >= 0 && tr.right <= innerWidth; r.radius = t ? getComputedStyle(t).borderRadius : ''; r.top = Math.round(tr.top);
    window.__slCopy(null, '0912 345 678'); r.phone = t ? t.textContent : ''; window.__slCopy(null, 'a'.repeat(30) + ' ' + 'b'.repeat(60)); r.longNoLabel = t ? t.textContent : '';
    if (l0) { if (bak == null) delete l0.reply; else l0.reply = bak; } r.l0 = !!l0; return r; });
  (k84.l0 && k84.txt === 'Đã chép gợi ý phản hồi.' && k84.h <= 48 && k84.w <= 360 && k84.inView && k84.radius === '22px' && k84.top >= 0 && k84.top < 60 && k84.phone === 'Đã chép: 0912 345 678' && /^Đã chép: a{30}…$/.test(k84.longNoLabel))
    ? ok('v119-84: Sao chép gợi ý (mobile) → toast "' + k84.txt + '" ' + k84.w + '×' + k84.h + 'px 1 dòng ở đỉnh (top ' + k84.top + '), bo ' + k84.radius + ' · SĐT vẫn hiện giá trị · giá trị dài không nhãn cắt 44 + …') : fail('v119-84 toast copy: ' + JSON.stringify(k84));
  const k84b = await mp.evaluate(() => { const t = document.getElementById('toast'); const D = window.SL_DATA; /* gọi toast() gián tiếp qua __slCopy với nhãn dài → nhiều dòng */
    window.__slCopy(null, 'x', 'nội dung rất dài để kiểm tra toast nhiều dòng trên màn hình điện thoại 390px – dòng hai – dòng ba – dòng bốn cho chắc');
    const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); return { h: Math.round(r.height), w: Math.round(r.width), maxW: Math.round(innerWidth * 0.92) + 1, radius: cs.borderRadius, align: cs.textAlign, inView: r.left >= 0 && r.right <= innerWidth, lines: Math.round(r.height / (14 * 1.4)) }; });
  (k84b.h > 48 && k84b.w <= k84b.maxW && k84b.inView && k84b.radius === '22px' && k84b.align === 'center')
    ? ok('v119-84: toast nhiều dòng (' + k84b.w + '×' + k84b.h + 'px, ~' + k84b.lines + ' dòng) = hộp bo 22px căn giữa, không tràn 92vw') : fail('v119-84 toast nhiều dòng: ' + JSON.stringify(k84b));
""", tag='smoke.k84')
done()
