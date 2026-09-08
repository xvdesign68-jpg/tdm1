# m19.py <cây> — v119-77 / v120-esm-aa (08/09, anh: "ô Bài đã quét ở Bảng điều khiển của người dùng brand không hiển thị"). Áp lên cây đã qua m18.
# Nguyên nhân: kpi.scanned lấy từ nhật ký quét `scans` — live.js chỉ subscribe cho superadmin (khớp Rules: scans là dữ liệu vận hành nội bộ có chi phí/token)
# → user brand luôn thấy "—" + "chưa có nhật ký quét" (câu sai: hệ thống có quét, chỉ là họ không được đọc nhật ký). Thanh nhịp quét ở Lead mới đã có bản
# rút gọn cho brand từ v16.22, riêng ô KPI Overview thì chưa. Sửa (FE-only): Super Admin giữ "Bài đã quét"; user brand thấy "Đã hẹn tư vấn" (số THẬT của brand,
# kèm tỷ lệ hẹn trên lead hợp lệ) — đúng phễu Lead hợp lệ → Nóng → Hẹn → Chốt. + smoke check v119-77 (vẽ Overview với vai admin brand → ô 1 đổi, trả lại super).
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
F='src/app/20-feed.js'; S='tools/smoke.js'
rep(F, '''          return kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', k.scanned==null?'—':fmt(k.scanned), 'Bài đã quét', ...kDelta(kd.scanned), k.scanned==null?'chưa có nhật ký quét':(kw?cap(fmt(kw.scanned||0)+' bài / 14 ngày','scanned'):'từ nhật ký quét'))''',
'''          return (roleIsSuper()
              ? kpiCard(SLI.search,'var(--brand-50)','var(--brand-600)', k.scanned==null?'—':fmt(k.scanned), 'Bài đã quét', ...kDelta(kd.scanned), k.scanned==null?'chưa có nhật ký quét':(kw?cap(fmt(kw.scanned||0)+' bài / 14 ngày','scanned'):'từ nhật ký quét'))
              : kpiCard(SLI.calendar,'var(--brand-50)','var(--brand-600)', fmt(k.booked||0), 'Đã hẹn tư vấn', '', '', 'tỷ lệ hẹn '+(k.bookingRate||0)+'% trên lead hợp lệ')) /* v119-77: user brand không đọc được nhật ký quét (Rules) → ô số THẬT của brand thay cho "—" */''', tag='kpi.brand')
rep(S, '''  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');''',
'''  /* v119-77: Overview với vai admin brand → ô KPI 1 = "Đã hẹn tư vấn" (số thật), không còn "—"; super vẫn "Bài đã quét" */
  const k77 = await page.evaluate(() => { const first = () => { const c = document.querySelector('#view .grid.g-4 .kpi'); return c ? { lbl: (c.querySelector('.lbl') || {}).textContent || '', val: (c.querySelector('.val') || {}).textContent || '' } : null; };
    window.SLAuth.show('app', { brand: 'z15', brandName: 'Z15' }, 'admin'); location.hash = 'overview'; window.SLApp.reload(window.SL_DATA); const admin = first();
    window.SLAuth.show('app', {}, 'superadmin'); window.SLApp.reload(window.SL_DATA); const sup = first(); return { admin, sup }; });
  await page.waitForTimeout(300);
  (k77.admin && /Đã hẹn tư vấn/.test(k77.admin.lbl) && /^\\d/.test(k77.admin.val) && k77.sup && /Bài đã quét/.test(k77.sup.lbl)) ? ok('v119-77: Overview vai admin brand → KPI "Đã hẹn tư vấn ' + k77.admin.val + '" (thay "—" Bài đã quét) · super vẫn "Bài đã quét ' + k77.sup.val + '"') : fail('v119-77 kpi brand: ' + JSON.stringify(k77));
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');''', tag='smoke.v119-77')
done()
