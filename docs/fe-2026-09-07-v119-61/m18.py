# m18.py <cây> — v119-76 / v120-esm-z (08/09, anh: "icon Chốt hôm nay xấu quá"). Áp lên cây đã qua m17 (v119-75 / v120-esm-y).
# SLI.handshake (bắt tay) ở 16px trong chip thành cục rối → thêm icon `trophy` (cúp) — so 7 phương án ở đúng cỡ chip (shots-today-v119-75/icons-cmp2.png)
# → dùng cho ô "Chốt hôm nay" (card Hôm nay) + KPI "Đã chốt" ở Báo cáo (cùng nghĩa). handshake giữ cho bước "Kết bạn" (Tiếp cận) + tiêu đề CRM (cỡ lớn hơn).
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
rep('assets/js/icons.js', "    siren:", "    trophy: s('<path d=\"M6 9H4.5a2.5 2.5 0 0 1 0-5H6\"/><path d=\"M18 9h1.5a2.5 2.5 0 0 0 0-5H18\"/><path d=\"M4 22h16\"/><path d=\"M10 14.7V17c0 .5-.5 1-1 1.2-1.2.5-2 2-2 3.8\"/><path d=\"M14 14.7V17c0 .5.5 1 1 1.2 1.2.5 2 2 2 3.8\"/><path d=\"M18 2H6v7a6 6 0 0 0 12 0V2Z\"/>'), /* v119-76: cúp - chốt deal */\n    siren:", tag='icons.trophy')
rep('src/app/20-feed.js', "${tile('closed',T.closedToday.length,'Chốt hôm nay',SLI.handshake,", "${tile('closed',T.closedToday.length,'Chốt hôm nay',SLI.trophy,", tag='today.closed')
rep('src/app/50-config-views.js', "${kpiCard(SLI.handshake,'var(--success-bg)','var(--success)', fmt(k.closed), 'Đã chốt',", "${kpiCard(SLI.trophy,'var(--success-bg)','var(--success)', fmt(k.closed), 'Đã chốt',", tag='reports.closed')
done()
