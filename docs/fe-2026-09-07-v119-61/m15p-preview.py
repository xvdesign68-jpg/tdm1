# m15p.py <cây> — BẢN XEM THỬ đề xuất UI modal lead (P1–P5), chưa phải bản giao. Áp lên cây đã qua m14.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
M='src/app/65-charts-lead-modal.js'; C='assets/css/app.css'
# P1 — khối Ghi kết quả liên hệ: dòng mô tả xuống dòng riêng, sắp lại trung tính → tích cực → tiêu cực, tô màu theo nghĩa
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
          <div class="cf-row cf-calls">
            <button class="btn btn-soft btn-sm" data-call="noans">${SLI.phoneOff} Không nghe máy</button>
            <button class="btn btn-soft btn-sm" data-call="callback">${SLI.refresh} Hẹn gọi lại</button>
            <button class="btn btn-soft btn-sm call-pos" data-call="talked">${SLI.checkCircle} Đã tư vấn – quan tâm</button>
            <button class="btn btn-soft btn-sm call-pos" data-call="booked">${SLI.calendar} Đã hẹn tư vấn</button>
            <button class="btn btn-soft btn-sm call-neg" data-call="wrong">${SLI.x} Không liên hệ được</button>
            <button class="btn btn-soft btn-sm call-neg" data-call="noneed">${SLI.userX} Không có nhu cầu</button>
          </div>''', tag='P1.html')
# P2 — Nhắc hẹn: nút nhanh thành pill, gợi ý nhịp chăm gọn + căn phải
rep(M, '''          <div style="display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap">
            <span class="muted" style="font-size:11px">Nhanh:</span>
            <button class="btn btn-ghost btn-sm" data-fuq="3">+3 ngày</button>
            <button class="btn btn-ghost btn-sm" data-fuq="7">+7 ngày</button>
            <button class="btn btn-ghost btn-sm" data-fuq="14">+2 tuần</button>
            <span class="muted" style="font-size:11px">· Nhịp chăm gợi ý: sau 3 ngày → 7 ngày → 2 tuần</span>
          </div>''',
'''          <div class="fu-quick">
            <span class="muted">Nhanh</span>
            <button type="button" class="fu-q" data-fuq="3">+3 ngày</button>
            <button type="button" class="fu-q" data-fuq="7">+7 ngày</button>
            <button type="button" class="fu-q" data-fuq="14">+2 tuần</button>
            <span class="muted fu-hint">Nhịp chăm gợi ý 3 → 7 → 14 ngày</span>
          </div>''', tag='P2.html')
# P3 — nút Xoá lead: chỉ icon thùng rác, xám, đỏ khi rê chuột — tách khỏi "Không thành"
rep(M, '''<button class="btn btn-ghost btn-sm" id="delLeadBtn" style="color:#d92d20;margin-left:auto" data-tip="Xoá vĩnh viễn lead này (chỉ Super Admin thấy nút này)">${SLI.x} Xoá lead</button>''',
'''<button class="btn btn-ghost btn-sm ld-del" id="delLeadBtn" style="margin-left:auto" data-tip="Xoá vĩnh viễn lead này (chỉ Super Admin thấy nút này)" aria-label="Xoá lead">${SLI.trash}</button>''', tag='P3.html')
# P4 — chip giai đoạn 1 hàng cuộn ngang, chip hiện tại tự đưa vào giữa
rep(M, '''    if(keepTop) modal.scrollTop=keepTop;''',
'''    if(keepTop) modal.scrollTop=keepTop;
    { const c=modal.querySelector('.mstage.cur'); if(c){ const sc=c.parentElement; sc.scrollLeft=Math.max(0,c.offsetLeft-(sc.clientWidth-c.offsetWidth)/2); } } /* preview P4 */''', tag='P4.js')
rep(C, '.mstages { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; }',
'''.mstages { display: flex; gap: 5px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; position: relative; margin: 10px -16px 0; padding: 0 16px; -webkit-mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent); mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent); }
.mstages::-webkit-scrollbar { display: none; }
.mstage { flex: none; }''', tag='P4.css')
# P5 — đồng bộ tiêu đề khối: Ghi kết quả / Ghi chú / Dòng thời gian dùng eyebrow như Pipeline & Nhắc hẹn
rep(C, '.cf-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }',
'''.cf-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
/* ===== preview v119-72 đề xuất ===== */
.cf-sub { font-size: 11.5px; color: var(--ink-500); margin: -3px 0 9px; }
.cf-calls .btn .i { width: 14px; height: 14px; }
.cf-calls .call-pos { background: rgba(15,123,61,.08); color: #0f7b3d; } .cf-calls .call-pos:hover { background: rgba(15,123,61,.14); }
.cf-calls .call-neg { background: rgba(217,45,32,.07); color: #b42318; } .cf-calls .call-neg:hover { background: rgba(217,45,32,.13); }
.fu-quick { display: flex; gap: 6px; align-items: center; margin-top: 9px; flex-wrap: wrap; font-size: 11px; }
.fu-q { border: 1px solid var(--border); background: #fff; border-radius: 999px; padding: 3px 10px; font: inherit; font-size: 11.5px; font-weight: 600; color: var(--brand-700); cursor: pointer; }
.fu-q:hover { border-color: var(--brand-200, #c7d2fe); background: var(--brand-50); }
.fu-hint { margin-left: auto; }
.ld-del { color: var(--ink-400); padding: 6.5px 8px; } .ld-del:hover { color: #d92d20; background: rgba(217,45,32,.08); } .ld-del .i { width: 15px; height: 15px; }
#callBox .cf-k, #mNotes .cf-k, .ld-tl summary { font-size: 10px; font-weight: 650; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-400); }
#callBox .cf-k .i, #mNotes .cf-k .i, .ld-tl summary .i { width: 13px; height: 13px; }
#mNotes .cf-k .btn, #mNotes .cf-k .muted { text-transform: none; letter-spacing: 0; }''', tag='P1-5.css')
done()
