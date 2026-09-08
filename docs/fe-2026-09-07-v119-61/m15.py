# m15.py <cây> — v119-73 / v120-esm-w (08/09, anh chốt "làm nốt P1–P5, riêng P3 thùng rác màu đỏ"). Áp lên cây đã qua m14 (v119-72 / v120-esm-v).
# P1 khối Ghi kết quả liên hệ: dòng mô tả xuống hàng riêng · sắp trung tính → tích cực (xanh lá) → tiêu cực (đỏ nhạt) · icon 14px
# P2 Nhắc hẹn: 3 nút nhanh thành pill · gợi ý nhịp chăm gọn, căn phải
# P3 nút Xoá lead → icon thùng rác ĐỎ (anh chốt), tách khỏi "Không thành" (mobile 2 nút đỏ kề nhau)
# P4 chip giai đoạn 1 hàng cuộn ngang, chip hiện tại tự vào giữa, mờ 2 mép
# P5 tiêu đề Ghi kết quả / Ghi chú / Dòng thời gian dùng eyebrow như Pipeline & Nhắc hẹn (1 kiểu tiêu đề trong modal)
# P6 toast Hoàn tác (#pvUndoToast, fixed đáy màn) lên đầu màn khi modal mở: footer 1 hàng (sau P3) làm nút Đã chốt/Không thành nằm đúng vùng toast → click bị chặn ~6 s (smoke bắt được).
# + smoke check v119-73. Fail-closed nguyên tử (lib.py 2 pha).
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
M='src/app/65-charts-lead-modal.js'; C='assets/css/app.css'; S='tools/smoke.js'
rep(M, '''          <div class="cf-k">${SLI.phone} Ghi kết quả liên hệ <span class="muted" style="font-weight:400;font-size:11px">1 chạm · tự ghi chú + hẹn lại + đổi giai đoạn</span></div>
          <div class="cf-row">
            <button class="btn btn-soft btn-sm" data-call="noans">${SLI.phoneOff} Không nghe máy</button>
            <button class="btn btn-soft btn-sm" data-call="wrong">${SLI.x} Không liên hệ được</button>
            <button class="btn btn-soft btn-sm" data-call="callback">${SLI.refresh} Hẹn gọi lại</button>
            <button class="btn btn-soft btn-sm" data-call="talked">${SLI.checkCircle} Đã tư vấn – quan tâm</button>
            <button class="btn btn-soft btn-sm" data-call="booked">${SLI.calendar} Đã hẹn tư vấn</button>
            <button class="btn btn-soft btn-sm" data-call="noneed">${SLI.userX} Không có nhu cầu</button>
          </div>''',
'''          <div class="cf-k">${SLI.phone} Ghi kết quả liên hệ</div>
          <div class="cf-sub">1 chạm · tự ghi chú + hẹn lại + đổi giai đoạn</div>
          <div class="cf-row cf-calls">${''/* v119-73 (P1): trung tính → tích cực → tiêu cực, tô màu theo nghĩa */}
            <button class="btn btn-soft btn-sm" data-call="noans">${SLI.phoneOff} Không nghe máy</button>
            <button class="btn btn-soft btn-sm" data-call="callback">${SLI.refresh} Hẹn gọi lại</button>
            <button class="btn btn-soft btn-sm call-pos" data-call="talked">${SLI.checkCircle} Đã tư vấn – quan tâm</button>
            <button class="btn btn-soft btn-sm call-pos" data-call="booked">${SLI.calendar} Đã hẹn tư vấn</button>
            <button class="btn btn-soft btn-sm call-neg" data-call="wrong">${SLI.x} Không liên hệ được</button>
            <button class="btn btn-soft btn-sm call-neg" data-call="noneed">${SLI.userX} Không có nhu cầu</button>
          </div>''', tag='P1.html')
rep(M, '''          <div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap">
            <span class="muted" style="font-size:11px">Nhanh:</span>
            <button class="btn btn-ghost btn-sm" data-fuq="3">+3 ngày</button>
            <button class="btn btn-ghost btn-sm" data-fuq="7">+7 ngày</button>
            <button class="btn btn-ghost btn-sm" data-fuq="14">+2 tuần</button>
            <span class="muted" style="font-size:11px">· Nhịp chăm gợi ý: sau 3 ngày → 7 ngày → 2 tuần</span>
          </div>''',
'''          <div class="fu-quick">${''/* v119-73 (P2) */}
            <span class="muted">Nhanh</span>
            <button type="button" class="fu-q" data-fuq="3">+3 ngày</button>
            <button type="button" class="fu-q" data-fuq="7">+7 ngày</button>
            <button type="button" class="fu-q" data-fuq="14">+2 tuần</button>
            <span class="muted fu-hint">Nhịp chăm gợi ý 3 → 7 → 14 ngày</span>
          </div>''', tag='P2.html')
rep(M, '''<button class="btn btn-ghost btn-sm" id="delLeadBtn" style="color:#d92d20;margin-left:auto" data-tip="Xoá vĩnh viễn lead này (chỉ Super Admin thấy nút này)">${SLI.x} Xoá lead</button>''',
'''<button class="btn btn-ghost btn-sm ld-del" id="delLeadBtn" style="margin-left:auto" data-tip="Xoá vĩnh viễn lead này (chỉ Super Admin thấy nút này)" aria-label="Xoá lead">${SLI.trash}</button>''', tag='P3.html')
rep(M, '''    if(keepTop) modal.scrollTop=keepTop;''',
'''    if(keepTop) modal.scrollTop=keepTop;
    { const c=modal.querySelector('.mstage.cur'); if(c){ const sc=c.parentElement; sc.scrollLeft=Math.max(0,c.offsetLeft-(sc.clientWidth-c.offsetWidth)/2); } } /* v119-73 (P4): dải chip giai đoạn 1 hàng - đưa chip hiện tại vào giữa */''', tag='P4.js')
rep(C, '.mstages { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; }',
'''.mstages { display: flex; gap: 5px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; position: relative; margin: 10px -16px 0; padding: 0 16px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent); mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent); } /* v119-73 (P4): 1 hàng cuộn ngang, mờ 2 mép */
.mstages::-webkit-scrollbar { display: none; }
.mstage { flex: none; }''', tag='P4.css')
rep(C, '.ld-tl-x { color: var(--ink-700); }',
'''.ld-tl-x { color: var(--ink-700); }
/* ===== v119-73: modal lead P1–P5 (anh chốt 08/09) ===== */
.cf-sub { font-size: 11.5px; color: var(--ink-500); margin: -3px 0 9px; }
.cf-calls .btn .i { width: 14px; height: 14px; }
.cf-calls .call-pos { background: rgba(15,123,61,.08); color: #0f7b3d; } .cf-calls .call-pos:hover { background: rgba(15,123,61,.14); }
.cf-calls .call-neg { background: rgba(217,45,32,.07); color: #b42318; } .cf-calls .call-neg:hover { background: rgba(217,45,32,.13); }
.fu-quick { display: flex; gap: 6px; align-items: center; margin-top: 9px; flex-wrap: wrap; font-size: 11px; }
.fu-q { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 11.5px; font-weight: 600; color: var(--brand-700); cursor: pointer; }
.fu-q:hover { border-color: var(--brand-200, #c7d2fe); background: var(--brand-50); }
.fu-hint { margin-left: auto; }
.ld-del { color: #d92d20; padding: 6.5px 8px; } .ld-del:hover { color: #b42318; background: rgba(217,45,32,.1); } .ld-del .i { width: 15px; height: 15px; }
body:has(#modalBg.show) #pvUndoToast { bottom: auto !important; top: 14px; } /* v119-73: toast Hoàn tác (đáy màn) không đè thanh nút cuối modal - footer giờ 1 hàng nên nút Đã chốt nằm đúng vùng toast */
#callBox .cf-k, #mNotes .cf-k, .ld-tl summary { font-size: 10px; font-weight: 650; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-400); }
#callBox .cf-k .i, #mNotes .cf-k .i, .ld-tl summary .i { width: 13px; height: 13px; }
#mNotes .cf-k .btn, #mNotes .cf-k .muted { text-transform: none; letter-spacing: 0; }''', tag='P1-5.css')
rep(S, '''  await page.click('#modal [data-call="noans"]'); await page.waitForTimeout(400);''',
'''  /* v119-73: modal P1–P5 */
  const p5 = await page.evaluate(() => { const cb = document.getElementById('callBox'); const order = Array.from(cb.querySelectorAll('[data-call]')).map(b => b.dataset.call).join(','); const pos = cb.querySelectorAll('.call-pos').length, neg = cb.querySelectorAll('.call-neg').length; const sub = !!cb.querySelector('.cf-sub');
    const st = document.querySelector('#modal .mstages'); const tops = new Set(Array.from(st.querySelectorAll('.mstage')).map(b => Math.round(b.getBoundingClientRect().top))).size; const cur = st.querySelector('.mstage.cur'); const sr = st.getBoundingClientRect(), cr = cur.getBoundingClientRect(); const curVisible = cr.left >= sr.left - 1 && cr.right <= sr.right + 1;
    const del = document.getElementById('delLeadBtn'); const delOk = !!del && del.classList.contains('ld-del') && !!del.querySelector('svg') && /217,\\s*45,\\s*32/.test(getComputedStyle(del).color) && !/Xoá/.test(del.textContent);
    const upper = getComputedStyle(document.querySelector('#modal .ld-tl summary')).textTransform === 'uppercase' && getComputedStyle(document.querySelector('#callBox .cf-k')).textTransform === 'uppercase';
    const li = document.querySelector('#modal .ld-tl-i'); const list = li.closest('.ld-tl-list'); const dotLeft = li.getBoundingClientRect().left + parseFloat(getComputedStyle(li, '::before').left); const dotIn = dotLeft >= list.getBoundingClientRect().left + parseFloat(getComputedStyle(list).borderLeftWidth);
    return { order, pos, neg, sub, tops, scroll: st.scrollWidth > st.clientWidth, curVisible, delOk, upper, dotIn, fq: document.querySelectorAll('#fuBox .fu-q').length }; });
  (p5.order === 'noans,callback,talked,booked,wrong,noneed' && p5.pos === 2 && p5.neg === 2 && p5.sub && p5.tops === 1 && p5.curVisible && p5.delOk && p5.upper && p5.dotIn && p5.fq === 3) ? ok('v119-73: modal P1–P5 — kết quả liên hệ trung tính→tích cực→tiêu cực (2 xanh/2 đỏ) + dòng mô tả riêng · chip giai đoạn 1 hàng (cuộn=' + p5.scroll + ', chip hiện tại trong tầm nhìn) · Xoá lead = thùng rác đỏ · tiêu đề eyebrow · chấm timeline trong khối cuộn · 3 pill hẹn nhanh') : fail('v119-73 modal: ' + JSON.stringify(p5));
  await page.click('#modal [data-call="noans"]'); await page.waitForTimeout(400);''', tag='smoke.v119-73')
done()
