# FE v119-60 / v120-esm-j (07/09/2026): RÀ TOÀN BỘ 18 MỤC — HẾT "NHÁY" DO HIỆU ỨNG fx.js + 4 chỗ còn thay node khi repaint mềm. Áp lên cây v119-59 / v120-esm-i.
# Đo thật (Playwright demo, audit 18 mục + probe): sau v119-59, cái "nháy 1 lần" khi bấm sang mục mới còn 1 nguồn: assets/js/fx.js (hiệu ứng
#   vào trang: thẻ hiện dần, số đếm, bar/vòng mọc) chạy qua MutationObserver + setTimeout 60 ms → nội dung ĐÃ VẼ hiện ra 1 khung hình (opacity 1,
#   KPI 18.432, bar 17%) rồi mới bị ẩn/về 0 để diễn (opacity 0, "0", 0%) rồi hiện lại 0,7 s = hiện → mất → hiện lại. Và khi repaint mềm realtime:
#   morph v119-58 LỘT dấu data-fx/data-fx-in (bản vẽ mới không có) → lần có node mới kế tiếp fx diễn lại toàn bộ (thẻ mờ đi, KPI đếm lại từ 0,
#   bar mọc lại) = "chớp giật" còn sót; countUp gán el.textContent → xoá <span> "/ 4" của KPI Tiếp cận; thanh nhịp quét feed (v79) tháo/gắn lại
#   5 <span> mỗi lần đổi → 4 số <b> đếm lại từ 0; panel VPS Tiếp cận ghi innerHTML thô; Keyword/Scoring/Người dùng có template rỗng rồi
#   sub-render điền → morph xoá sạch rồi điền lại (45/18 node); Báo cáo in giờ có giây → đổi text mỗi repaint.
# Sửa: (1) fx.js: enhance() chạy NGAY trong microtask của MutationObserver khi có PHẦN TỬ mới (trước khung hình đầu) → chỉ có "hiện dần", không
#   còn "hiện → mất"; go()/reload đóng dấu view[data-render]=nav|soft → repaint mềm CHỈ đánh dấu, KHÔNG diễn lại; countUp/ringsIn đếm trên text
#   node (giữ <span>, cuối trả đúng chữ app đã vẽ); công tắc FX_INTRO=false tắt hẳn mọi hiệu ứng vào trang; (2) morphAttrs giữ attr data-fx*;
#   (3) 90-boot: thanh nhịp quét morph tại chỗ (softRender) thay tháo/gắp; 45: panel VPS softRender; (4) 50: Keyword/Scoring dựng sẵn nội dung
#   trong template (sub-render vẽ y hệt → morph no-op), Báo cáo giờ in bỏ giây; 85: dòng "Đang xem" khớp text bind; (5) smoke +5.
# Dùng: python3 fe60.py <root> iife|esm
import sys, os
root, mode = sys.argv[1], sys.argv[2]
def load(rel):
    p = os.path.join(root, rel); return p, open(p, encoding='utf-8').read()
def save(p, s): open(p, 'w', encoding='utf-8').write(s)
def R(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

# ---------- fx.js ----------
p, s = load('assets/js/fx.js')
s = R(s, "  var motionOK = !window.matchMedia || matchMedia('(prefers-reduced-motion: no-preference)').matches;\n  var view = document.getElementById('view');\n  if (!view) return;\n",
       "  var motionOK = !window.matchMedia || matchMedia('(prefers-reduced-motion: no-preference)').matches;\n  var view = document.getElementById('view');\n  if (!view) return;\n  var FX_INTRO = true; // v119-60: false = tắt hẳn hiệu ứng vào trang (thẻ hiện dần, số đếm, bar/vòng mọc) — mọi thứ hiện tức thì trong 1 khung hình\n  /* v119-60: repaint mềm realtime (view[data-render]=soft do go()/reload đóng dấu) → CHỈ đánh dấu, KHÔNG diễn lại (trước: mỗi lần morph lột dấu data-fx → thẻ mờ đi, KPI đếm lại từ 0 = chớp giật) */\n  function quiet() { return !FX_INTRO || !motionOK || view.getAttribute('data-render') === 'soft'; }\n")
s = R(s, "    if (el.getAttribute('data-fx')) return;\n    el.setAttribute('data-fx', '1');\n    var text = el.textContent || '';\n",
       "    if (el.getAttribute('data-fx')) return;\n    el.setAttribute('data-fx', '1');\n    /* v119-60: đếm trên TEXT NODE đầu có số — giữ nguyên <span> con (KPI \"3 / 4\" của Tiếp cận từng bị el.textContent= xoá mất span); số nằm trong node con → không đếm */\n    var tn = null; for (var c = el.firstChild; c; c = c.nextSibling) { if (c.nodeType === 3 && /\\d/.test(c.nodeValue)) { tn = c; break; } }\n    if (!tn) return;\n    var text = tn.nodeValue || '';\n")
s = R(s, "    if (!motionOK || target === 0) { el.textContent = fmtV(target); return; }\n    var steps = 24, i = 0;\n    el.textContent = fmtV(0);\n    var t = setInterval(function () {\n      i++;\n      var p = i / steps; p = 1 - Math.pow(1 - p, 3);\n      el.textContent = fmtV(decimals ? +(target * p).toFixed(decimals) : Math.round(target * p));\n      if (i >= steps) { clearInterval(t); el.textContent = fmtV(target); }\n    }, 30);\n",
       "    if (quiet() || target === 0) return; // v119-60: giữ đúng chữ app đã vẽ (trước: gán lại fmtV(target) → có thể lệch định dạng → morph đổi text qua lại)\n    var steps = 24, i = 0;\n    tn.nodeValue = fmtV(0);\n    var t = setInterval(function () {\n      i++;\n      var p = i / steps; p = 1 - Math.pow(1 - p, 3);\n      tn.nodeValue = fmtV(decimals ? +(target * p).toFixed(decimals) : Math.round(target * p));\n      if (i >= steps) { clearInterval(t); tn.nodeValue = text; }\n    }, 30);\n")
s = R(s, "  function growBars(root) {\n    if (!motionOK) return;\n    root.querySelectorAll('.bar-fill:not([data-fx]),.fn-bar:not([data-fx]),.rl-fill:not([data-fx])').forEach(function (b) {\n      b.setAttribute('data-fx', '1');\n      var w = b.style.width;\n",
       "  function growBars(root) {\n    var q = quiet();\n    root.querySelectorAll('.bar-fill:not([data-fx]),.fn-bar:not([data-fx]),.rl-fill:not([data-fx])').forEach(function (b) {\n      b.setAttribute('data-fx', '1');\n      if (q) return;\n      var w = b.style.width;\n")
s = R(s, "      if (!motionOK || (key && ringSeen[key])) return;\n      if (key) ringSeen[key] = 1;\n      var b = ring.querySelector('b');\n      var end = b ? b.textContent : '';\n      var steps = 26, i = 0;\n      ring.style.setProperty('--p', 0);\n      if (b) b.textContent = '0';\n      var t = setInterval(function () {\n        i++;\n        var p = 1 - Math.pow(1 - i / steps, 3);\n        ring.style.setProperty('--p', (target * p).toFixed(1));\n        if (b) b.textContent = Math.round(target * p);\n        if (i >= steps) { clearInterval(t); ring.style.setProperty('--p', target); if (b) b.textContent = end; }\n      }, 26);\n",
       "      if (quiet() || (key && ringSeen[key])) return;\n      if (key) ringSeen[key] = 1;\n      var b = ring.querySelector('b');\n      var bt = (b && b.firstChild && b.firstChild.nodeType === 3) ? b.firstChild : null; // v119-60: đổi nodeValue (không thay text node → không kích MutationObserver)\n      var end = bt ? bt.nodeValue : '';\n      var steps = 26, i = 0;\n      ring.style.setProperty('--p', 0);\n      if (bt) bt.nodeValue = '0';\n      var t = setInterval(function () {\n        i++;\n        var p = 1 - Math.pow(1 - i / steps, 3);\n        ring.style.setProperty('--p', (target * p).toFixed(1));\n        if (bt) bt.nodeValue = String(Math.round(target * p));\n        if (i >= steps) { clearInterval(t); ring.style.setProperty('--p', target); if (bt) bt.nodeValue = end; }\n      }, 26);\n")
s = R(s, "  function springIn(el, delay, fromY) {\n    el.setAttribute('data-fx-in', '1');\n    if (!motionOK) return;\n",
       "  function springIn(el, delay, fromY) {\n    el.setAttribute('data-fx-in', '1');\n    if (quiet()) return;\n")
s = R(s, "  var pending;\n  new MutationObserver(function () {\n    clearTimeout(pending);\n    pending = setTimeout(enhance, 60);\n  }).observe(view, { childList: true, subtree: true });\n  enhance();\n",
       "  /* v119-60: chạy NGAY trong microtask của observer (TRƯỚC khung hình đầu) khi có PHẦN TỬ mới — trước đây debounce 60 ms nên nội dung đã vẽ\n     hiện ra 1 khung hình rồi mới bị ẩn/về 0 để diễn (= \"nháy 1 lần\" mỗi lần chuyển mục). Đổi text (số đang đếm) không kích lại. */\n  var busy = false;\n  new MutationObserver(function (ms) {\n    var hasEl = false;\n    for (var i = 0; i < ms.length && !hasEl; i++) { var a = ms[i].addedNodes; for (var j = 0; j < a.length; j++) { if (a[j].nodeType === 1) { hasEl = true; break; } } }\n    if (!hasEl || busy) return;\n    busy = true; try { enhance(); } finally { busy = false; }\n  }).observe(view, { childList: true, subtree: true });\n  enhance();\n")
save(p, s)

# ---------- 10-core ----------
p, s = load('src/app/10-core-overview.js')
s = R(s, "    for(let i=oa.length-1;i>=0;i--){ const a=oa[i]; if(!n.hasAttribute(a.name)){ if(a.namespaceURI) o.removeAttributeNS(a.namespaceURI,a.localName); else o.removeAttribute(a.name); } }\n",
       "    for(let i=oa.length-1;i>=0;i--){ const a=oa[i]; if(!n.hasAttribute(a.name)){ if(a.name.slice(0,7)==='data-fx') continue; if(a.namespaceURI) o.removeAttributeNS(a.namespaceURI,a.localName); else o.removeAttribute(a.name); } } // v119-60: giữ dấu data-fx/-in/-ring của fx.js (bản vẽ mới không có) → hiệu ứng không diễn lại sau repaint mềm\n")
s = R(s, "    REC_ARMED=true; MORPH_ON=SOFT_RELOAD; // v119-58: realtime → morph DOM; điều hướng thật → dựng mới như cũ\n",
       "    view.setAttribute('data-render', SOFT_RELOAD?'soft':'nav'); // v119-60: fx.js đọc — soft = chỉ đánh dấu, không diễn hiệu ứng vào trang\n    REC_ARMED=true; MORPH_ON=SOFT_RELOAD; // v119-58: realtime → morph DOM; điều hướng thật → dựng mới như cũ\n")
save(p, s)

# ---------- 90-boot: đóng dấu soft + thanh nhịp quét morph tại chỗ ----------
p, s = load('src/app/90-boot.js')
s = R(s, "      const cur=(window.location.hash||'').replace('#','')||'overview';\n      // v78: ĐƯỜNG TẮT cho Lead feed",
       "      const cur=(window.location.hash||'').replace('#','')||'overview';\n      view.setAttribute('data-render','soft'); // v119-60: đường tắt feed không qua go() → fx.js vẫn biết là repaint mềm\n      // v78: ĐƯỜNG TẮT cho Lead feed")
s = R(s, "              const keep=sb.querySelector('.sb-live');\n              if(keep&&n.querySelector('.sb-live')&&keep.outerHTML===n.querySelector('.sb-live').outerHTML){ // v119-50: trạng thái đổi (BrightData ngưng…) → thay cả khối\n                sb.__slHtml=nh;\n                Array.from(sb.children).forEach(c=>{ if(c!==keep) c.remove(); });\n                Array.from(n.children).forEach(c=>{ if(!(c.classList&&c.classList.contains('sb-live'))) sb.appendChild(c); });\n              } else { n.__slHtml=nh; sb.replaceWith(n); }\n",
       "              /* v119-60: morph tại chỗ — khối \"ĐANG TRỰC\" và 4 số <b> GIỮ node (chấm nhịp không restart, số không đếm lại từ 0); trạng thái BrightData đổi vẫn cập nhật vì morph sửa attr/text của .sb-live */\n              sb.__slHtml=nh; if(sb.className!==n.className) sb.className=n.className;\n              softRender(sb,()=>{ sb.innerHTML=n.innerHTML; });\n")
if mode == 'esm':
    s = R(s, "import { D, SLI, go, meta, recPrune, setD, setSoftReload, view, views } from './10-core-overview.js';",
             "import { D, SLI, go, meta, recPrune, setD, setSoftReload, softRender, view, views } from './10-core-overview.js';")
save(p, s)

# ---------- 45-outreach: panel VPS morph ----------
p, s = load('src/app/45-outreach.js')
s = R(s, "    host.innerHTML = html; oaBindWorkers(host); return true;\n",
       "    softRender(host, () => { host.innerHTML = html; }); oaBindWorkers(host); return true; // v119-60: morph (giữ node, chỉ sửa số đổi) — trước ghi thô → fx.js diễn lại panel mỗi heartbeat\n")
if mode == 'esm':
    s = R(s, "import { D, SLI, fmt, meta, tempChip, tempColor, tempLabel, view, views } from './10-core-overview.js';",
             "import { D, SLI, fmt, meta, softRender, tempChip, tempColor, tempLabel, view, views } from './10-core-overview.js';")
save(p, s)

# ---------- 50-config-views: Keyword/Scoring dựng sẵn nội dung trong template; Báo cáo giờ in bỏ giây ----------
p, s = load('src/app/50-config-views.js')
s = R(s, "    let main=[...(D.keywords.main||[])], ex=[...(D.keywords.exclude||[])];\n    view.innerHTML = `\n",
       "    let main=[...(D.keywords.main||[])], ex=[...(D.keywords.exclude||[])];\n    /* v119-60: dựng sẵn danh sách trong template (render() vẽ y hệt → morph no-op) — trước template rỗng rồi điền → repaint mềm xoá 15 chip rồi gắn lại */\n    const kwHtml=(arr,k)=>arr.length?arr.map((w,i)=>`<span class=\"kw${k==='e'?' ex':''}\">${esc(w)}<span class=\"rm\" data-${k}=\"${i}\">×</span></span>`).join(''):(k==='e'?'<span style=\"color:var(--ink-400);font-size:13px\">Chưa có</span>':'<span style=\"color:var(--ink-400);font-size:13px\">Chưa có - AI đọc mọi bài</span>');\n    view.innerHTML = `\n")
s = R(s, "          <div class=\"card-pad\"><div class=\"kw-list\" id=\"kwMain\"></div></div></div>\n",
       "          <div class=\"card-pad\"><div class=\"kw-list\" id=\"kwMain\">${kwHtml(main,'m')}</div></div></div>\n")
s = R(s, "          <div class=\"card-pad\"><div class=\"kw-list\" id=\"kwEx\"></div></div></div>\n",
       "          <div class=\"card-pad\"><div class=\"kw-list\" id=\"kwEx\">${kwHtml(ex,'e')}</div></div></div>\n")
s = R(s, "      mEl.innerHTML = main.length?main.map((w,i)=>`<span class=\"kw\">${esc(w)}<span class=\"rm\" data-m=\"${i}\">×</span></span>`).join(''):'<span style=\"color:var(--ink-400);font-size:13px\">Chưa có - AI đọc mọi bài</span>';\n      eEl.innerHTML = ex.length?ex.map((w,i)=>`<span class=\"kw ex\">${esc(w)}<span class=\"rm\" data-e=\"${i}\">×</span></span>`).join(''):'<span style=\"color:var(--ink-400);font-size:13px\">Chưa có</span>';\n",
       "      mEl.innerHTML = kwHtml(main,'m');\n      eEl.innerHTML = kwHtml(ex,'e');\n")
s = R(s, "<span class=\"chip chip-brand\" id=\"wSum\"></span>",
       "<span class=\"chip chip-brand\" id=\"wSum\" style=\"color:${wSumInfo().c}\">${wSumInfo().t}</span>")
s = R(s, "          <div class=\"card-pad\" id=\"wList\"></div></div>\n",
       "          <div class=\"card-pad\" id=\"wList\">${wgtHtml()}</div></div>\n")
s = R(s, "  function renderWeights(){\n    const list = view.querySelector('#wList');\n    list.innerHTML = D.scoringWeights.map(w=>`<div class=\"wgt\"><div class=\"top\"><span class=\"n\">${esc(w.label)}</span><span class=\"v\" id=\"v_${esc(w.key)}\">${w.weight}%</span></div>\n      <input type=\"range\" min=\"0\" max=\"50\" value=\"${w.weight}\" data-key=\"${esc(w.key)}\"></div>`).join('');\n    const sum = ()=>{ const s=D.scoringWeights.reduce((a,w)=>a+w.weight,0); const e=document.getElementById('wSum'); e.textContent='Tổng: '+s+'%'; e.style.color=s===100?'var(--success)':'var(--hot)'; };\n",
       "  /* v119-60: template Scoring dựng sẵn danh sách + tổng (renderWeights vẽ y hệt → morph no-op; trước: template rỗng → repaint mềm xoá 6 khối rồi gắn lại) */\n  function wgtHtml(){ return D.scoringWeights.map(w=>`<div class=\"wgt\"><div class=\"top\"><span class=\"n\">${esc(w.label)}</span><span class=\"v\" id=\"v_${esc(w.key)}\">${w.weight}%</span></div>\n      <input type=\"range\" min=\"0\" max=\"50\" value=\"${w.weight}\" data-key=\"${esc(w.key)}\"></div>`).join(''); }\n  function wSumInfo(){ const s=D.scoringWeights.reduce((a,w)=>a+w.weight,0); return { t:'Tổng: '+s+'%', c:s===100?'var(--success)':'var(--hot)' }; }\n  function renderWeights(){\n    const list = view.querySelector('#wList');\n    list.innerHTML = wgtHtml();\n    const sum = ()=>{ const i=wSumInfo(), e=document.getElementById('wSum'); if(e.textContent!==i.t) e.textContent=i.t; if(e.style.color!==i.c) e.style.color=i.c; };\n")
s = R(s, "${esc(brandName)} · ${new Date().toLocaleString('vi-VN')}</div>",
       "${esc(brandName)} · ${new Date().toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'})}</div>")
save(p, s)

# ---------- 85-users-admin: dòng "Đang xem" khớp text bind ----------
p, s = load('src/app/85-users-admin.js')
s = R(s, "Đang xem: <b>Mặc định chung</b>.</div>", "Đang xem: <b>Mặc định chung</b> - áp cho mọi brand chưa cài riêng.</div>")
save(p, s)

# ---------- 20-feed: nút "Hiện thêm" tái dùng node (trước: gỡ rồi tạo mới mỗi renderFeed → 1 node thay mỗi repaint mềm) ----------
p, s = load('src/app/20-feed.js')
s = R(s, "    Array.from(list.children).forEach(el=>{ if(!(el.classList&&el.classList.contains('lead-card'))&&el.id!=='feedSkels') el.remove(); });\n",
       "    Array.from(list.children).forEach(el=>{ if(!(el.classList&&el.classList.contains('lead-card'))&&el.id!=='feedSkels'&&!el.hasAttribute('data-more')) el.remove(); }); // v119-60: giữ nút \"Hiện thêm\" (tái dùng bên dưới)\n")
s = R(s, "    if(allItems.length>items.length){ // v166: nút hiện thêm card (chỉ là HIỂN THỊ - dữ liệu đã nạp sẵn)\n      const more=document.createElement('div');\n      more.style.cssText='text-align:center;padding:10px 0 4px';\n      more.innerHTML=`<button class=\"btn btn-ghost btn-sm\" id=\"feedShowMore\">Hiện thêm ${Math.min(500,allItems.length-items.length).toLocaleString('vi-VN')} lead (đang hiện ${items.length.toLocaleString('vi-VN')}/${allItems.length.toLocaleString('vi-VN')} khớp)</button>`;\n      more.querySelector('#feedShowMore').addEventListener('click',()=>{ feedShowN+=500; list.classList.remove('anim'); renderFeed(); });\n      list.appendChild(more);\n    }\n",
       "    const more0=list.querySelector(':scope > [data-more]');\n    if(allItems.length>items.length){ // v166: nút hiện thêm card (chỉ là HIỂN THỊ - dữ liệu đã nạp sẵn) · v119-60: tái dùng node cũ, chỉ ghi lại khi chữ đổi\n      const mh=`<button class=\"btn btn-ghost btn-sm\" id=\"feedShowMore\">Hiện thêm ${Math.min(500,allItems.length-items.length).toLocaleString('vi-VN')} lead (đang hiện ${items.length.toLocaleString('vi-VN')}/${allItems.length.toLocaleString('vi-VN')} khớp)</button>`;\n      let more=more0;\n      if(!more){ more=document.createElement('div'); more.setAttribute('data-more','1'); more.style.cssText='text-align:center;padding:10px 0 4px'; }\n      if(more.__slHtml!==mh){ more.__slHtml=mh; more.innerHTML=mh; more.querySelector('#feedShowMore').addEventListener('click',()=>{ feedShowN+=500; list.classList.remove('anim'); renderFeed(); }); }\n      if(list.lastElementChild!==more) list.appendChild(more);\n    } else if(more0) more0.remove();\n")
save(p, s)

# ---------- smoke: +5 check ----------
p, s = load('tools/smoke.js')
s = R(s, "return { r, replaced: !!t1 && !!t2 && t1 !== t2, kept:", "return { r, replaced: !!t1 && !!t2 && t1 === t2, kept:")
s = R(s, "ok('Panel VPS vẽ riêng (v119-53): __oaPatchWorkers thay bảng VPS, view giữ nguyên node')", "ok('Panel VPS vẽ riêng (v119-53): __oaPatchWorkers morph bảng VPS tại chỗ (v119-60: giữ node), view giữ nguyên node')")
s = R(s, "  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');\n",
"""  /* ===== v119-60: hiệu ứng vào trang (fx.js) chạy TRƯỚC khung hình đầu · repaint mềm không diễn lại · 18 mục không thay node khi dữ liệu y hệt ===== */
  await page.click('.nav-item[data-view="feed"]'); await page.waitForTimeout(700);
  const fx1 = await page.evaluate(async () => { const v = document.getElementById('view'); document.querySelector('.nav-item[data-view="overview"]').click(); const c0 = v.children[0]; const val = v.querySelector('.kpi .val'); const ops = [], vals = [];
    for (let i = 0; i < 45; i++) { await new Promise(r => requestAnimationFrame(r)); ops.push(+getComputedStyle(c0).opacity); vals.push(parseFloat((val.textContent || '').replace(/\\./g, '').replace(',', '.')) || 0); }
    const mono = a => a.every((x, i) => i === 0 || x >= a[i - 1] - 1e-6);
    return { render: v.getAttribute('data-render'), first: ops[0], last: ops[ops.length - 1], monoOp: mono(ops), monoVal: mono(vals), vLast: vals[vals.length - 1], fxin: v.querySelectorAll('[data-fx-in]').length }; });
  (fx1.render === 'nav' && fx1.first < 1 && fx1.last === 1 && fx1.monoOp && fx1.monoVal && fx1.vLast > 0 && fx1.fxin > 0) ? ok('v119-60: bấm nav → hiệu ứng áp TRƯỚC khung hình đầu (opacity ' + fx1.first + '→1 tăng đơn điệu, KPI đếm lên ' + fx1.vLast + ' không "hiện rồi về 0")') : fail('v119-60 nav fx: ' + JSON.stringify(fx1));
  await page.waitForTimeout(1200);
  const fx2 = await page.evaluate(async () => { const v = document.getElementById('view'); const n0 = v.querySelectorAll('[data-fx-in]').length, f0 = v.querySelectorAll('[data-fx]').length; const val = v.querySelector('.kpi .val'), t0 = val.textContent; const ops = [];
    window.SLApp.reload(window.SL_DATA); window.SLApp.reload(window.SL_DATA); const r = v.getAttribute('data-render');
    for (let i = 0; i < 12; i++) { await new Promise(r => requestAnimationFrame(r)); ops.push(+getComputedStyle(v.children[0]).opacity); }
    return { r, n0, n1: v.querySelectorAll('[data-fx-in]').length, f0, f1: v.querySelectorAll('[data-fx]').length, t0, t1: val.textContent, opMin: Math.min.apply(null, ops) }; });
  (fx2.r === 'soft' && fx2.n0 > 0 && fx2.n1 === fx2.n0 && fx2.f1 === fx2.f0 && fx2.t1 === fx2.t0 && fx2.opMin === 1) ? ok('v119-60: repaint mềm ×2 giữ dấu data-fx (' + fx2.n0 + '/' + fx2.f0 + ') → thẻ không mờ lại, KPI không đếm lại (' + fx2.t0 + ')') : fail('v119-60 soft fx: ' + JSON.stringify(fx2));
  await page.click('.nav-item[data-view="outreach"]'); await page.waitForTimeout(1300);
  const fx3 = await page.evaluate(async () => { const v = document.getElementById('view'); const vals = Array.from(v.querySelectorAll('.kpi .val')); const withSpan = vals.filter(e => e.querySelector('span')).length; const t0 = vals.map(e => e.textContent); window.SLApp.reload(window.SL_DATA); await new Promise(r => setTimeout(r, 250)); const t1 = vals.map(e => e.textContent); return { n: vals.length, withSpan, same: JSON.stringify(t0) === JSON.stringify(t1), t0 }; });
  (fx3.n >= 3 && fx3.withSpan >= 1 && fx3.same) ? ok('v119-60: KPI Tiếp cận "N / M" giữ <span> qua đếm số · repaint mềm không đếm lại (' + fx3.t0.join(' · ') + ')') : fail('v119-60 outreach kpi: ' + JSON.stringify(fx3));
  await page.click('.nav-item[data-view="feed"]'); await page.waitForTimeout(900);
  const fx4 = await page.evaluate(async () => { const v = document.getElementById('view'); const sb = v.querySelector('.scanbar'); const live = sb.querySelector('.sb-live'); const bs = Array.from(sb.querySelectorAll('b')).map(b => b.textContent); let add = 0, rem = 0; const mo = new MutationObserver(ms => ms.forEach(m => { add += m.addedNodes.length; rem += m.removedNodes.length; })); mo.observe(sb, { childList: true, subtree: true });
    for (let i = 0; i < 3; i++) window.SLApp.reload(window.SL_DATA); await new Promise(r => setTimeout(r, 300)); mo.disconnect();
    return { add, rem, liveSame: sb.querySelector('.sb-live') === live, sbSame: v.querySelector('.scanbar') === sb, bsSame: JSON.stringify(bs) === JSON.stringify(Array.from(sb.querySelectorAll('b')).map(b => b.textContent)), n: bs.length }; });
  (fx4.add === 0 && fx4.rem === 0 && fx4.liveSame && fx4.sbSame && fx4.bsSame && fx4.n >= 3) ? ok('v119-60: thanh nhịp quét feed qua 3 repaint mềm → 0 node thay, khối ĐANG TRỰC giữ node, ' + fx4.n + ' số <b> không đếm lại') : fail('v119-60 scanbar: ' + JSON.stringify(fx4));
  const fx5 = {}; const churn = [];
  for (const nm of ['overview', 'agency', 'feed', 'tasks', 'replies', 'pipeline', 'roi', 'sources', 'keywords', 'scoring', 'outreach', 'alerts', 'reports', 'history', 'scanned', 'integrations', 'users', 'account']) {
    await page.click(`.nav-item[data-view="${nm}"]`); await page.waitForTimeout(nm === 'feed' ? 900 : 650);
    fx5[nm] = await page.evaluate(async () => { const v = document.getElementById('view'); let add = 0, rem = 0; const smp = []; const mo = new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(n => { if (n.nodeType === 1) { add++; if (smp.length < 4) smp.push('+' + n.tagName + '.' + n.className + '@' + m.target.tagName + '#' + m.target.id + '.' + m.target.className); } }); m.removedNodes.forEach(n => { if (n.nodeType === 1) { rem++; if (smp.length < 4) smp.push('-' + n.tagName + '.' + n.className + '@' + m.target.tagName + '#' + m.target.id + '.' + m.target.className); } }); })); mo.observe(v, { childList: true, subtree: true }); window.SLApp.reload(window.SL_DATA); await new Promise(r => setTimeout(r, 200)); mo.disconnect(); const ws = v.querySelector('#wSum'); return { add, rem, smp, kw: v.querySelectorAll('#kwMain .kw').length, wl: v.querySelectorAll('#wList .wgt').length, ws: ws ? ws.textContent : '' }; });
    if (fx5[nm].add + fx5[nm].rem > 0) churn.push(nm + ':+' + fx5[nm].add + '/-' + fx5[nm].rem + ' ' + fx5[nm].smp.join(' '));
  }
  (churn.length === 0 && fx5.keywords.kw > 0 && fx5.scoring.wl > 0 && /Tổng: \\d+%/.test(fx5.scoring.ws)) ? ok('v119-60: 18 mục repaint mềm dữ liệu y hệt → 0 phần tử thêm/bớt (Keyword ' + fx5.keywords.kw + ' chip, Scoring ' + fx5.scoring.wl + ' trọng số + "' + fx5.scoring.ws + '" giữ node)') : fail('v119-60 18 mục còn thay node: ' + JSON.stringify(churn) + ' ' + JSON.stringify({ kw: fx5.keywords, sc: fx5.scoring }));
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');
""")
save(p, s)
print('v119-60 patch OK:', mode)
