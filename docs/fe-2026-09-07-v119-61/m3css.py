import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
p='assets/css/app.css'; s=rd(p); assert '.ag-ic .i' not in s
s+=r"""

/* ============ v119-61: icon SVG thay emoji – căn dòng trong chữ, chấm màu, biểu tượng lớn ============ */
.i { display: inline-block; vertical-align: -.22em; }
.card-head h2 .i, .card-head h3 .i, .btn .i, .chip .i, .nav-item .ic .i, .kpi .ic .i, .empty-state > .i, .alert-row .ic .i, .chan .ic .i, .search .i, .icon-btn .i { vertical-align: baseline; }
.dot-hot { background: var(--hot) !important; } .dot-warm { background: var(--warm) !important; } .dot-cold { background: var(--cold) !important; } .dot-ok { background: var(--success) !important; }
i.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; vertical-align: 0; margin-right: 2px; }
.ag-ic .i { width: 46px; height: 46px; color: var(--brand-400); margin: 0 auto 4px; display: block; }
.ld-tl-ic .i { width: 13px; height: 13px; color: var(--ink-400); margin-right: 5px; vertical-align: -.15em; }
.oa-badge .i { width: 22px; height: 22px; }
.tk-h .i, .cf-k .i, .rk .i, .td-head h3 .i { width: 15px; height: 15px; }
.td-head h3 .i, .tk-h .i { color: var(--brand-600); }
.sub .i, .muted .i, small .i { width: 13px; height: 13px; }
.tk-as .i { width: 12px; height: 12px; }
.chip .i, .chip-role .i { width: 12px; height: 12px; }
"""
wr(p,s); lib._log.append('m3.css')
# smoke: đếm hộp thoại app qua MutationObserver + chip vai SVG
p='tools/smoke.js'
rep(p,"""  let dlg = 0; await page.evaluate(() => { window.__dlg = 0; window.SLDlg.confirm = () => { window.__dlg++; return Promise.resolve(true); }; }); // v119-61: hộp thoại app thay confirm()""",
"""  let dlg = 0; await page.evaluate(() => { window.__dlg = 0; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.id === 'slDlg') window.__dlg++; }).observe(document.body, { childList: true }); }); // v119-61: hộp thoại app (#slDlg) thay confirm() – đếm số lần mở
  const clickToggle = async () => { await page.click('#autoScanToggleFull'); await page.waitForSelector('#slDlg [data-dlg="1"]', { timeout: 3000 }); await page.click('#slDlg [data-dlg="1"]'); await page.waitForTimeout(600); };""",tag='smoke.dlg')
rep(p,"""  if (rec0.btn) { await page.click('#autoScanToggleFull'); await page.waitForTimeout(600); }
  const as1 = await page.evaluate(() => window.SL_DATA.autoScanEnabled !== false);
  if (rec0.btn) { await page.click('#autoScanToggleFull'); await page.waitForTimeout(600); } // trả về như cũ (sau go() dựng mới)""",
"""  if (rec0.btn) await clickToggle();
  const as1 = await page.evaluate(() => window.SL_DATA.autoScanEnabled !== false);
  if (rec0.btn) await clickToggle(); // trả về như cũ (sau go() dựng mới)""",tag='smoke.dlg2')
rep(p,"(rc1 === '🏪 Người bán' &&","(rc1 === 'Người bán' &&",tag='smoke.rc1')
rep(p,"ok('v119-52: thẻ + modal có chip 🏪 Người bán","ok('v119-52: thẻ + modal có chip Người bán (icon SVG)",tag='smoke.rc1b')
done()
