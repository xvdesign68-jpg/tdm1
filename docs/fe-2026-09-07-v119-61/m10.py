# m10.py <cây> — v119-67 / v120-esm-q (anh chốt 08/09): menu Plus Jakarta Sans IN ĐẬM; nội dung chính = TikTok Sans, to/đậm hơn một chút
# (thân chữ weight 450, cỡ nền giữ 14px; bài đăng lead + bài gốc trong modal 14 → 15px); số trong nội dung dùng chữ số TikTok Sans (có tabular).
# Áp được lên cây v119-65 / v120-esm-o (cặp Jakarta + Be Vietnam Pro) HOẶC v119-66 / v120-esm-p (Geist) — mốc nào khớp thì thay.
# Fail-closed: mốc không khớp → dừng, KHÔNG ghi file nào (lib.py ghi 2 pha từ 08/09). DRY=1 để kiểm mốc. 18 mốc.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
def rep_any(p, olds, new, tag=''):
    s = rd(p); hits = [o for o in olds if s.count(o) == 1]
    if len(hits) != 1:
        raise SystemExit('KHONG THAY MOC DUY NHAT [%s] %s (khớp %d mốc)' % (tag, p, len(hits)))
    rep(p, hits[0], new, tag=tag)
GF = 'https://fonts.googleapis.com/css2?family='
L65_APP = GF + 'Plus+Jakarta+Sans:wght@500;600;700;800&family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
L65_LP  = GF + 'Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
L66     = GF + 'Geist:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
L67     = GF + 'Plus+Jakarta+Sans:wght@500;600;700;800&family=TikTok+Sans:opsz,wght@12..36,300..900&family=JetBrains+Mono:wght@400;500;600&display=swap'
rep_any('app.html',     [L65_APP, L66], L67, tag='link.app')
rep_any('privacy.html', [L65_LP,  L66], L67, tag='link.privacy')
rep_any('terms.html',   [L65_LP,  L66], L67, tag='link.terms')
T = 'assets/css/tokens.css'
SYS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
rep_any(T, ["  --font: 'Be Vietnam Pro', 'Plus Jakarta Sans', " + SYS, "  --font: 'Geist', " + SYS],
           "  --font: 'TikTok Sans', 'Plus Jakarta Sans', " + SYS, tag='tok.font')
rep_any(T, ["  --font-head: 'Plus Jakarta Sans', 'Be Vietnam Pro', " + SYS, "  --font-head: 'Geist', " + SYS],
           "  --font-head: 'Plus Jakarta Sans', 'TikTok Sans', " + SYS, tag='tok.head')
rep_any(T, ["   Plus Jakarta Sans (tiêu đề · nút · nhãn) + Be Vietnam Pro (thân chữ) + JetBrains Mono (mã)",
            "   Geist (tiêu đề · nút · nhãn · thân chữ — v119-66) + JetBrains Mono (mã)"],
           "   Plus Jakarta Sans (tiêu đề · nút · nhãn · menu đậm) + TikTok Sans (thân chữ 450 · bài đăng 15px · số — v119-67) + JetBrains Mono (mã)", tag='tok.cmt')
# Thân chữ to/đậm hơn một chút (TikTok Sans là variable font 300–900 → 450 hợp lệ; font dự phòng rơi về 400/500)
rep(T, "  line-height: 1.6;\n  font-size: 14px;\n", "  line-height: 1.6;\n  font-size: 14px;\n  font-weight: 450;\n", tag='tok.body')  # cỡ nền giữ 14px (app.css cũng đặt 14px); chỉ tăng độ đậm
A = 'assets/css/app.css'
rep(A, "  font-size: 13.5px; font-weight: 500; color: var(--ink-600);", "  font-size: 13.5px; font-weight: 600; color: var(--ink-600);", tag='nav.weight')
rep(A, "  color: var(--brand-700); font-weight: 650;", "  color: var(--brand-700); font-weight: 700;", tag='nav.active')
rep(A, ".lead-card .txt { font-size: 14px;", ".lead-card .txt { font-size: 15px;", tag='feed.txt')
rep(A, ".ld-post .tx { font-size: 14px;", ".ld-post .tx { font-size: 15px;", tag='modal.tx')
rep_any(A, ["/* ===== v119-64: cặp font anh chốt — Plus Jakarta Sans cho tiêu đề · nút · nhãn; Be Vietnam Pro cho thân chữ ===== */",
            "/* ===== v119-64: nhãn/nút dùng --font-head (v119-66: cả hai token = Geist) ===== */"],
           "/* ===== v119-64: nhãn/nút dùng --font-head — v119-67: Plus Jakarta Sans (tiêu đề · nút · nhãn · menu đậm) + TikTok Sans (thân chữ 450 · bài đăng 15px · số) ===== */", tag='css.cmt')
# --- Bổ sung sau vòng rà đối kháng 08/09 (3 phát hiện xác nhận + 3 mục nhỏ đáng làm) ---
# (1) Ô nhập/chọn/textarea/nút không kế thừa font-weight (UA stylesheet đặt 400) → lệch với thân chữ 450 trên cùng màn
rep(T, "button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }",
       "button { font-family: inherit; font-weight: inherit; cursor: pointer; border: none; background: none; color: inherit; }", tag='tok.button')
rep(T, "input, select, textarea { font-family: inherit; }", "input, select, textarea { font-family: inherit; font-weight: inherit; }", tag='tok.input')
# (2) Khối "AI đọc vị nhu cầu" trên thẻ lead được đặt = cỡ .lead-card .txt từ v46 → theo lên 15px
rep('assets/css/pipeline-v2.css', "cho cân đối - ý anh Vinh */\n  font-size: 14px; line-height: 1.6; color: var(--ink-800);",
    "cho cân đối - ý anh Vinh; v119-67: .txt lên 15px nên theo */\n  font-size: 15px; line-height: 1.6; color: var(--ink-800);", tag='pv2.intent')
# (3) Thanh tab dưới mobile: mục đang chọn đậm hơn như menu sidebar
rep(A, "  .bt-item.active { color: var(--brand-600, #1B2DCC); }", "  .bt-item.active { color: var(--brand-600, #1B2DCC); font-weight: 700; }", tag='tabs.active')
# (4) Modal lead-là-bình-luận: bài gốc 12.5 → 13.5px (sales cần đọc bài gốc để hiểu câu khách)
rep(A, ".ld-parent { margin: 6px 0 2px; font-size: 12.5px; color: var(--ink-600); }", ".ld-parent { margin: 6px 0 2px; font-size: 13.5px; color: var(--ink-600); }", tag='modal.parent')
# (5) Bảng chung: số thẳng cột (TikTok Sans có tnum nhưng mặc định proportional)
rep(A, ".tbl td { padding: 13px 18px; border-bottom: 1px solid var(--hairline); color: var(--ink-800); vertical-align: middle; }",
       ".tbl td { padding: 13px 18px; border-bottom: 1px solid var(--hairline); color: var(--ink-800); vertical-align: middle; font-variant-numeric: tabular-nums; }", tag='tbl.tnum')
done()
