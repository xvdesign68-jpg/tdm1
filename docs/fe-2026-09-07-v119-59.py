# FE v119-59 / v120-esm-i (07/09/2026): HẾT "NHÁY 1 LẦN" KHI BẤM SANG MỤC MỚI (anh báo sau v119-58). Áp lên cây v119-58 / v120-esm-h.
# Đo thật (Playwright, demo): sau khi bấm nav mà mục cũ đang cuộn dở, go() gán view.scrollTop=0 nhưng .view có scroll-behavior:smooth
#   → nội dung MỚI bị TRƯỢT từ vị trí cuộn cũ về đầu trong ~400 ms (497→422→254→111→22→0) = cái "nháy/giật" mỗi lần chuyển mục.
#   Bản live (Super Admin) còn thêm: go() gọi refreshAdmin → ~300 ms sau rebuild → repaint mềm → slChart cập nhật lại chart dù dữ liệu y hệt
#   (cắt ngang animation vẽ chart 0,9 s → chart nháy); nav-item/glider đổi TRƯỚC khi dựng view (main thread bận 50–150 ms → glider giật).
# Sửa: (1) go(): về đầu NGAY (tắt smooth tạm) TRƯỚC khi dựng view mới → 1 khung hình; (2) slChart: chữ ký data/options (bỏ animation, hàm → 'ƒ',
#   gradient → tên lớp) → dữ liệu không đổi thì KHÔNG đụng chart; (3) tắt animation vẽ chart khi điều hướng (CHART_INTRO=false — theo gu tĩnh
#   của anh như v90/v91 feed; đổi true để bật lại); (4) nav active + glider cập nhật SAU khi dựng view (cùng khung hình với nội dung);
#   (5) live.js: Super Admin làm ấm sẵn kênh Tiếp cận/Bảng brand 4–5 s sau khi vào (hết "trống → có dữ liệu" ở lần mở tab đầu); (6) smoke +3.
# Dùng: python3 fe59.py <root> iife|esm
import sys, os
root, mode = sys.argv[1], sys.argv[2]
def load(rel):
    p = os.path.join(root, rel); return p, open(p, encoding='utf-8').read()
def save(p, s): open(p, 'w', encoding='utf-8').write(s)
def R(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

# ---------- 10-core ----------
p, s = load('src/app/10-core-overview.js')
s = R(s, "  const chartAnim = () => (RAF_OK && !SOFT_RELOAD) ? { duration: 900, easing: 'easeOutQuart' } : false;\n",
       "  const CHART_INTRO = false; // v119-59: tắt animation vẽ chart khi điều hướng (gu tĩnh như feed v90/v91 — chart hiện ngay cùng khung hình với nội dung); đổi true để bật lại 0,9 s\n  const chartAnim = () => (CHART_INTRO && RAF_OK && !SOFT_RELOAD) ? { duration: 900, easing: 'easeOutQuart' } : false;\n")
s = R(s, "  function slChart(key,c,cfg){ // v119-58: cùng canvas + cùng type → cập nhật tại chỗ không animation; khác → huỷ tạo lại như cũ\n    const CH=window.Chart, old=charts[key], ex=(CH&&CH.getChart)?CH.getChart(c):null;\n    if(old && old===ex && old.config && old.config.type===cfg.type){ try{ old.data=cfg.data; if(cfg.options) old.options=cfg.options; old.update('none'); return old; }catch(e){ /* rơi xuống tạo mới */ } }\n    if(old){ try{ old.destroy(); }catch(_){ } delete charts[key]; }\n    if(ex&&ex!==old){ try{ ex.destroy(); }catch(_){ } }\n    return new CH(c,cfg);\n  }",
       "  /* v119-59: chữ ký cấu hình chart — hàm → 'ƒ', object không thuần (CanvasGradient…) → tên lớp, bỏ `animation` (khác nhau giữa dựng mới/repaint mềm nhưng không phải dữ liệu) */\n  function chartSig(cfg){ try{ return JSON.stringify(cfg,(k,v)=>{ if(k==='animation') return undefined; if(typeof v==='function') return 'ƒ'; if(v&&typeof v==='object'&&!Array.isArray(v)){ const pr=Object.getPrototypeOf(v); if(pr!==Object.prototype&&pr!==null) return '#'+((v.constructor&&v.constructor.name)||'obj'); } return v; }); }catch(e){ return null; } }\n  function slChart(key,c,cfg){ // v119-58: cùng canvas + cùng type → cập nhật tại chỗ không animation; khác → huỷ tạo lại như cũ · v119-59: dữ liệu KHÔNG đổi → không đụng chart (không cắt animation đang vẽ, không vẽ lại)\n    const CH=window.Chart, old=charts[key], ex=(CH&&CH.getChart)?CH.getChart(c):null, sig=chartSig(cfg);\n    if(old && old===ex && old.config && old.config.type===cfg.type){ if(sig && old.__slSig===sig) return old; try{ old.data=cfg.data; if(cfg.options) old.options=cfg.options; old.update('none'); old.__slSig=sig; return old; }catch(e){ /* rơi xuống tạo mới */ } }\n    if(old){ try{ old.destroy(); }catch(_){ } delete charts[key]; }\n    if(ex&&ex!==old){ try{ ex.destroy(); }catch(_){ } }\n    const ch=new CH(c,cfg); ch.__slSig=sig; return ch;\n  }")
s = R(s, "    if(!SOFT_RELOAD) destroyCharts(); // v119-58: repaint mềm GIỮ chart (slChart cập nhật tại chỗ), chart mồ côi dọn ở pruneCharts\n    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===name));\n    document.querySelectorAll('.bt-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view===name)); // v119-43 thanh tab dưới\n    updateNavGlider();\n    const m = meta[name] || meta.overview;\n    document.getElementById('vTitle').textContent = m[0];\n    document.getElementById('vSub').textContent = m[1];\n",
       "    if(!SOFT_RELOAD) destroyCharts(); // v119-58: repaint mềm GIỮ chart (slChart cập nhật tại chỗ), chart mồ côi dọn ở pruneCharts\n    const m = meta[name] || meta.overview;\n    document.getElementById('vTitle').textContent = m[0];\n    document.getElementById('vSub').textContent = m[1];\n    if(!SOFT_RELOAD){ const sb=view.style.scrollBehavior; view.style.scrollBehavior='auto'; view.scrollTop=0; view.style.scrollBehavior=sb; } // v119-59: về đầu NGAY (không trượt) TRƯỚC khi dựng view mới — trước đây gán sau + .view smooth → nội dung mới trượt ~400 ms = \"nháy\" mỗi lần chuyển mục\n")
s = R(s, "    a11yToggles(); // v119-40: công tắc .toggle có role=switch + bàn phím\n    window.location.hash = name;\n    if(SOFT_RELOAD) return; // v119-58: dữ liệu realtime KHÔNG đóng sidebar mobile, KHÔNG nhảy scroll về đầu\n    closeSidebar();\n    view.scrollTop = 0;\n  }",
       "    a11yToggles(); // v119-40: công tắc .toggle có role=switch + bàn phím\n    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===name)); // v119-59: nav + glider đổi SAU khi dựng view → cùng khung hình với nội dung (trước: glider bắt đầu trượt rồi main thread bận 50–150 ms → giật)\n    document.querySelectorAll('.bt-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view===name)); // v119-43 thanh tab dưới\n    updateNavGlider();\n    window.location.hash = name;\n    if(SOFT_RELOAD) return; // v119-58: dữ liệu realtime KHÔNG đóng sidebar mobile, KHÔNG nhảy scroll về đầu\n    closeSidebar();\n  }")
save(p, s)

# ---------- live.js: Super Admin làm ấm sẵn kênh Tiếp cận/Bảng brand (hết \"trống → có dữ liệu\" ở lần mở đầu) ----------
p, s = load('assets/js/live.js')
s = R(s, "      window.addEventListener('hashchange',onHash);\n      dataUnsub.push(function(){ window.removeEventListener('hashchange',onHash); if(oaPaintT){clearTimeout(oaPaintT);oaPaintT=null;} if(oaOnlineT){clearInterval(oaOnlineT);oaOnlineT=null;} });",
       "      window.addEventListener('hashchange',onHash);\n      if(role==='superadmin'){ const ep=dataEpoch; setTimeout(function(){ if(ep===dataEpoch && !outreachSubbed) start(); }, 4000); } // v119-59: làm ấm sẵn (log 100 doc + workers + stats nhỏ) → mở tab Tiếp cận/Bảng brand/Cảnh báo lần đầu không còn \"trống rồi mới có\"\n      dataUnsub.push(function(){ window.removeEventListener('hashchange',onHash); if(oaPaintT){clearTimeout(oaPaintT);oaPaintT=null;} if(oaOnlineT){clearInterval(oaOnlineT);oaOnlineT=null;} });")
s = R(s, "      window.addEventListener('hashchange',agHash);\n      dataUnsub.push(function(){ window.removeEventListener('hashchange',agHash); });",
       "      window.addEventListener('hashchange',agHash);\n      { const ep=dataEpoch; setTimeout(function(){ if(ep===dataEpoch) agStart(); }, 4500); } // v119-59: làm ấm sẵn daily_stats (≈35 ngày × brand, nhỏ) cho Bảng brand/Overview\n      dataUnsub.push(function(){ window.removeEventListener('hashchange',agHash); });")
save(p, s)

# ---------- smoke: +3 check ----------
p, s = load('tools/smoke.js')
a = "  (ro.n === 0 && ro.same) ? ok('v119-58: ROI repaint mềm không đổi dữ liệu → 0 node đổi') : fail('v119-58 ROI: ' + JSON.stringify(ro));\n"
assert s.count(a) == 1
add = r"""  /* ===== v119-59: điều hướng thật không "nháy" ===== */
  await page.evaluate(() => { const v = document.getElementById('view'); v.style.scrollBehavior = 'auto'; v.scrollTop = 600; v.style.scrollBehavior = ''; });
  const sc0 = await page.evaluate(() => document.getElementById('view').scrollTop);
  await page.click('.nav-item[data-view="overview"]');
  const scs = []; for (let i = 0; i < 5; i++) { scs.push(await page.evaluate(() => Math.round(document.getElementById('view').scrollTop))); await page.waitForTimeout(50); }
  const nv = await page.evaluate(() => ({ active: (document.querySelector('.nav-item.active') || {}).dataset ? document.querySelector('.nav-item.active').dataset.view : '', title: document.getElementById('vTitle').textContent, anim: JSON.stringify(window.Chart.getChart(document.getElementById('cTrend')).options.animation) }));
  (sc0 > 0 && scs.every(x => x === 0) && nv.active === 'overview' && nv.anim === 'false') ? ok('v119-59: bấm nav khi đang cuộn ' + sc0 + 'px → về đầu NGAY (5 mẫu 250 ms đều 0, không trượt) · nav active đúng · chart vẽ tức thì (animation tắt)') : fail('v119-59 nav: ' + JSON.stringify({ sc0, scs, nv }));
  const cu = await page.evaluate(() => { const dn = window.Chart.getChart(document.getElementById('cDonut')), tr = window.Chart.getChart(document.getElementById('cTrend')); let n = 0; const u0 = dn.update, u1 = tr.update; dn.update = function () { n++; return u0.apply(this, arguments); }; tr.update = function () { n++; return u1.apply(this, arguments); };
    window.SLApp.reload(window.SL_DATA); window.SLApp.reload(window.SL_DATA); const a = n; const D = window.SL_DATA, h0 = D.kpi.hot; D.kpi.hot = 777; window.SLApp.reload(D); const b = n; D.kpi.hot = h0; window.SLApp.reload(D); const same = window.Chart.getChart(document.getElementById('cDonut')) === dn; delete dn.update; delete tr.update; return { a, b, same, val: dn.data.datasets[0].data[0] === h0 }; });
  (cu.a === 0 && cu.b === 1 && cu.same && cu.val) ? ok('v119-59: repaint mềm dữ liệu chart không đổi → KHÔNG gọi chart.update (2 lần = 0) · đổi số nóng → chỉ donut update 1 lần, trend không') : fail('v119-59 chart sig: ' + JSON.stringify(cu));
"""
s = s.replace(a, a + add)
save(p, s)
print('FE59 OK', mode)
