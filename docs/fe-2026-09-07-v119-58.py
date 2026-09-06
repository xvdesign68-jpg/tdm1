# FE v119-58 / v120-esm-h (07/09/2026): HẾT "CHỚP GIẬT" KHI CẬP NHẬT REALTIME — repaint mềm MORPH DOM thay vì đập innerHTML.
# Nguyên nhân (đọc code v119-57): mỗi tín hiệu realtime (leads/scans 3′/daily_stats/outreach_stats/notes/config/refreshAdmin 15″…) → SLApp.reload
#   → go(view) → view.innerHTML = html mới → MỌI node bị huỷ + dựng lại (ảnh nạp lại, animation CSS chạy lại, chart huỷ/tạo, hover mất),
#   go() còn view.scrollTop=0 + closeSidebar() rồi reload trả scrollTop=sc trong khi .view có scroll-behavior:smooth → TRƯỢT; refreshAdmin
#   luôn rebuild dù dữ liệu quản trị không đổi (2 repaint/1 sự kiện). Lead feed đã có diff (v78), pipeline/agency/outreach có sig-guard, còn
#   lại (Tổng quan, ROI, Hộp việc, Phản hồi, Cấu hình…, Bài đã quét, Người dùng) vẫn đập DOM.
# Sửa: (1) 10-core: slMorph (so node cũ↔mới theo id/data-*, chỉ sửa attribute/text đổi, giữ <canvas>/giá trị ô đang gõ) + hook innerHTML
#   cho MỌI x trong #view khi SOFT_RELOAD + sổ listener REC (gỡ listener node con trước khi code vẽ gắn lại → không gắn đôi) + slChart cập nhật
#   chart tại chỗ (update('none')) + pruneCharts; go() khi soft: không destroyCharts/không scrollTop=0/không closeSidebar; (2) 90-boot: tắt
#   scroll-behavior trong lúc repaint mềm + recPrune; (3) 20-feed: cột phải feed morph; (4) 80-rbac renderBrandTag chỉ ghi khi HTML đổi (logo
#   sidebar hết nạp lại); (5) live.js refreshAdmin chỉ rebuild khi dữ liệu quản trị đổi (chữ ký, bỏ qua chuỗi dài như logo); (6) smoke +8 check.
# Dùng: python3 fe58.py <root> iife|esm
import sys, os, re
root, mode = sys.argv[1], sys.argv[2]
def load(rel):
    p = os.path.join(root, rel); return p, open(p, encoding='utf-8').read()
def save(p, s): open(p, 'w', encoding='utf-8').write(s)
def R(s, a, b, n=1):
    assert s.count(a) == n, (a[:90], s.count(a)); return s.replace(a, b)

# ---------- 10-core: morph + sổ listener + slChart + go() ----------
p, s = load('src/app/10-core-overview.js')
MORPH = r"""  const chartAnim = () => (RAF_OK && !SOFT_RELOAD) ? { duration: 900, easing: 'easeOutQuart' } : false;
  /* ===== v119-58: REPAINT MỀM KHÔNG ĐẬP DOM (hết "chớp giật") =====
     Trước: mỗi tín hiệu realtime → go(view) → view.innerHTML = html mới → MỌI node bị huỷ rồi dựng lại (ảnh nạp lại, animation CSS chạy lại,
     chart huỷ/tạo, hover mất, scroll trả về qua scroll-behavior:smooth = trượt) → chớp/giật dù nội dung không đổi.
     Giờ: khi SOFT_RELOAD, mọi `x.innerHTML = html` với x trong #view đi qua slMorph(x, html): so từng node cũ ↔ mới (khoá theo id/data-*),
     chỉ sửa attribute/text đổi, thêm/bớt đúng node đổi; node không đổi GIỮ NGUYÊN (kể cả <canvas> của chart, ô nhập đang gõ).
     Listener gắn lên node TRONG #view được ghi sổ (REC); mỗi lần x.innerHTML được gán, listener của node con x bị gỡ trước → node được giữ
     không bị gắn đôi handler khi code vẽ gắn lại. Chart dùng slChart() cập nhật tại chỗ (update('none')) thay vì huỷ/tạo. */
  let MORPH_ON=false, REC_ARMED=false; const REC=[];
  const KEY_ATTRS=['id','data-id','data-key','data-lead','data-stage','data-brand','data-pid','data-uid','data-src','data-lid','data-rl','data-rn'];
  function keyOf(n){ if(n.nodeType!==1) return null; for(let i=0;i<KEY_ATTRS.length;i++){ const v=n.getAttribute(KEY_ATTRS[i]); if(v) return KEY_ATTRS[i]+'='+v; } return null; }
  function sameKind(a,b){ return a.nodeType===b.nodeType && (a.nodeType!==1 || a.tagName===b.tagName); }
  function morphAttrs(o,n){
    const na=n.attributes;
    for(let i=0;i<na.length;i++){ const a=na[i]; if(o.getAttribute(a.name)!==a.value){ if(a.namespaceURI) o.setAttributeNS(a.namespaceURI,a.name,a.value); else o.setAttribute(a.name,a.value); } }
    const oa=o.attributes;
    for(let i=oa.length-1;i>=0;i--){ const a=oa[i]; if(!n.hasAttribute(a.name)){ if(a.namespaceURI) o.removeAttributeNS(a.namespaceURI,a.localName); else o.removeAttribute(a.name); } }
  }
  function morphNode(o,n){
    if(o.nodeType!==1){ if(o.nodeValue!==n.nodeValue) o.nodeValue=n.nodeValue; return; }
    const tag=o.tagName, focused=(o===document.activeElement);
    if(tag==='CANVAS') return; // chart: Chart.js tự đặt width/height/style lên canvas → giữ nguyên, slChart cập nhật dữ liệu
    if(tag==='INPUT'){ const t=o.type, ov=o.getAttribute('value'), nv=n.getAttribute('value'), oc=o.hasAttribute('checked'), nc=n.hasAttribute('checked'); morphAttrs(o,n);
      if(!focused){ if(t==='checkbox'||t==='radio'){ if(oc!==nc) o.checked=nc; } else if(t!=='file' && nv!=null && nv!==ov && o.value!==nv) o.value=nv; } return; } // chỉ ép .value khi bản vẽ mới ĐỔI giá trị (giữ chữ người dùng vừa gõ)
    if(tag==='TEXTAREA'){ const ov=o.textContent, nv=n.textContent; morphAttrs(o,n); if(ov!==nv){ o.textContent=nv; if(!focused) o.value=nv; } return; }
    if(tag==='SCRIPT'||tag==='STYLE'){ morphAttrs(o,n); if(o.textContent!==n.textContent) o.textContent=n.textContent; return; }
    morphAttrs(o,n);
    if(tag==='SELECT'){ const os=o.querySelector('option[selected]'), ns=n.querySelector('option[selected]'); morphChildren(o,n); const nsv=ns?ns.value:null, osv=os?os.value:null; if(!focused && nsv!=null && nsv!==osv && o.value!==nsv) o.value=nsv; return; }
    morphChildren(o,n);
  }
  function morphChildren(from,to){
    const newKeys=new Set(); for(let c=to.firstChild;c;c=c.nextSibling){ const k=keyOf(c); if(k) newKeys.add(k); }
    const oldKeyed=new Map(); for(let c=from.firstChild;c;c=c.nextSibling){ const k=keyOf(c); if(k&&!oldKeyed.has(k)) oldKeyed.set(k,c); }
    let cur=from.firstChild;
    for(let n=to.firstChild;n;){
      const next=n.nextSibling, k=keyOf(n);
      while(cur){ const ck=keyOf(cur); if(ck&&!newKeys.has(ck)){ const nx=cur.nextSibling; from.removeChild(cur); cur=nx; } else break; } // node khoá cũ không còn trong bản mới → bỏ ngay
      let m=null;
      if(k){ m=oldKeyed.get(k)||null; if(m) oldKeyed.delete(k); }
      else if(cur&&!keyOf(cur)){
        if(sameKind(cur,n)) m=cur;
        else { const nx=cur.nextSibling; if(nx&&!keyOf(nx)&&sameKind(nx,n)){ from.removeChild(cur); cur=nx; m=cur; } } // 1 node cũ dư → bỏ, khớp node kế
      }
      if(m){ if(m!==cur) from.insertBefore(m,cur); morphNode(m,n); cur=m.nextSibling; }
      else from.insertBefore(n,cur); // node mới rời template vào DOM thật (code vẽ gắn listener sau)
      n=next;
    }
    while(cur){ const nx=cur.nextSibling; from.removeChild(cur); cur=nx; }
  }
  function slMorph(root,html){ const t=document.createElement('template'); t.innerHTML=html; morphChildren(root,t.content); }
  /* sổ listener: gỡ/dọn entry của node CON x (x.innerHTML sắp được gán) · recPrune dọn entry của node đã rời DOM (feed diff thay thẻ) */
  function recClear(x,remove){ let w=0; for(let i=0;i<REC.length;i++){ const r=REC[i], t=r[0]; if(t!==x && x.contains(t)){ if(remove){ try{ t.removeEventListener(r[1],r[2],r[3]); }catch(_){ } } } else REC[w++]=r; } REC.length=w; }
  function recPrune(){ let w=0; for(let i=0;i<REC.length;i++){ const r=REC[i]; if(view.contains(r[0])) REC[w++]=r; } REC.length=w; }
  (function(){
    try{
      const ep=window.EventTarget.prototype, add0=ep.addEventListener;
      ep.addEventListener=function(t,f,o){ if(REC_ARMED&&f&&this!==view&&this.nodeType===1&&this.tagName!=='CANVAS'&&view.contains(this)) REC.push([this,t,f,o]); return add0.call(this,t,f,o); }; // CANVAS: listener hover/tooltip của Chart.js — chart được giữ instance nên KHÔNG được gỡ
      const d=Object.getOwnPropertyDescriptor(window.Element.prototype,'innerHTML');
      Object.defineProperty(window.Element.prototype,'innerHTML',{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){
        if(REC_ARMED&&(this===view||view.contains(this))){ if(MORPH_ON){ recClear(this,true); slMorph(this,String(v)); return; } recClear(this,false); }
        d.set.call(this,v);
      }});
    }catch(e){ console.warn('[SmartLead] morph hook:',e&&e.message); }
  })();
  function softRender(root,fn){ const p=MORPH_ON; MORPH_ON=true; try{ return fn(); } finally{ MORPH_ON=p; } } // vẽ 1 khối theo kiểu morph ngoài go() (cột phải feed)
  function slChart(key,c,cfg){ // v119-58: cùng canvas + cùng type → cập nhật tại chỗ không animation; khác → huỷ tạo lại như cũ
    const CH=window.Chart, old=charts[key], ex=(CH&&CH.getChart)?CH.getChart(c):null;
    if(old && old===ex && old.config && old.config.type===cfg.type){ try{ old.data=cfg.data; if(cfg.options) old.options=cfg.options; old.update('none'); return old; }catch(e){ /* rơi xuống tạo mới */ } }
    if(old){ try{ old.destroy(); }catch(_){ } delete charts[key]; }
    if(ex&&ex!==old){ try{ ex.destroy(); }catch(_){ } }
    return new CH(c,cfg);
  }
  function pruneCharts(){ Object.keys(charts).forEach(k=>{ const ch=charts[k]; if(!ch||!ch.canvas||!document.body.contains(ch.canvas)){ try{ if(ch) ch.destroy(); }catch(_){ } delete charts[k]; } }); }
  window.__slMorph=slMorph; window.__slRec=()=>REC.length; // móc kiểm thử (smoke)
"""
s = R(s, "  const chartAnim = () => (RAF_OK && !SOFT_RELOAD) ? { duration: 900, easing: 'easeOutQuart' } : false;\n", MORPH)
s = R(s, "    destroyCharts();\n    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===name));",
       "    if(!SOFT_RELOAD) destroyCharts(); // v119-58: repaint mềm GIỮ chart (slChart cập nhật tại chỗ), chart mồ côi dọn ở pruneCharts\n    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view===name));")
s = R(s, "    (views[name] || views.overview)();\n    a11yToggles(); // v119-40: công tắc .toggle có role=switch + bàn phím\n    window.location.hash = name;\n    closeSidebar();\n    view.scrollTop = 0;\n  }",
       "    REC_ARMED=true; MORPH_ON=SOFT_RELOAD; // v119-58: realtime → morph DOM; điều hướng thật → dựng mới như cũ\n    try{ (views[name] || views.overview)(); } finally { MORPH_ON=false; }\n    if(SOFT_RELOAD) pruneCharts();\n    a11yToggles(); // v119-40: công tắc .toggle có role=switch + bàn phím\n    window.location.hash = name;\n    if(SOFT_RELOAD) return; // v119-58: dữ liệu realtime KHÔNG đóng sidebar mobile, KHÔNG nhảy scroll về đầu\n    closeSidebar();\n    view.scrollTop = 0;\n  }")
if mode == 'esm':
    s = R(s, ", views };", ", views, recPrune, slChart, softRender };")
save(p, s)

# ---------- 65 + 60: chart cập nhật tại chỗ ----------
p, s = load('src/app/65-charts-lead-modal.js')
s = R(s, "    charts[id] = new Chart(c, { type:'line',", "    charts[id] = slChart(id, c, { type:'line',")
s = R(s, "    charts.donut=new Chart(c,{type:'doughnut',", "    charts.donut=slChart('donut',c,{type:'doughnut',")
s = R(s, "    charts.src=new Chart(c,{type:'bar',", "    charts.src=slChart('src',c,{type:'bar',")
if mode == 'esm':
    s = R(s, " } from './10-core-overview.js';", ", slChart } from './10-core-overview.js';")
save(p, s)
p, s = load('src/app/60-scan-views.js')
s = R(s, "    charts.scan=new Chart(c,{type:'line',", "    charts.scan=slChart('scan',c,{type:'line',")
s = R(s, "    charts.scanDist=new Chart(c,{type:'doughnut',", "    charts.scanDist=slChart('scanDist',c,{type:'doughnut',")
if mode == 'esm':
    s = R(s, " } from './10-core-overview.js';", ", slChart } from './10-core-overview.js';")
save(p, s)

# ---------- 20-feed: cột phải morph ----------
p, s = load('src/app/20-feed.js')
s = R(s, "    rail.__slSig=railSig;\n    rail.innerHTML=railHtml;\n",
       "    rail.__slSig=railSig;\n    softRender(rail,()=>{ rail.innerHTML=railHtml; }); // v119-58: morph cột phải (giữ node, chỉ sửa chỗ đổi; listener cũ của node con tự gỡ trước khi gắn lại)\n")
if mode == 'esm':
    s = R(s, " } from './10-core-overview.js';", ", softRender } from './10-core-overview.js';")
save(p, s)

# ---------- 90-boot: tắt scroll-behavior khi repaint mềm + recPrune ----------
p, s = load('src/app/90-boot.js')
if mode == 'esm':
    old = "      setSoftReload(true); // v120-esm\n      try{ go(meta[cur]?cur:'overview'); } finally { setSoftReload(false); }\n      view.scrollTop=sc;\n"
    new = "      const sb0=view.style.scrollBehavior; view.style.scrollBehavior='auto'; // v119-58: .view có scroll-behavior:smooth → gán scrollTop sẽ TRƯỢT = \"giật\"; tắt trong lúc repaint mềm\n      recPrune(); // v119-58: dọn sổ listener của thẻ feed đã thay\n      setSoftReload(true); // v120-esm\n      try{ go(meta[cur]?cur:'overview'); } finally { setSoftReload(false); }\n      if(view.scrollTop!==sc) view.scrollTop=sc;\n"
    s = R(s, old, new)
    s = R(s, "import { D, SLI, go, meta, setD, setSoftReload, view, views } from './10-core-overview.js';",
           "import { D, SLI, go, meta, recPrune, setD, setSoftReload, view, views } from './10-core-overview.js';")
else:
    old = "      SOFT_RELOAD=true;\n      try{ go(meta[cur]?cur:'overview'); } finally { SOFT_RELOAD=false; }\n      view.scrollTop=sc;\n"
    new = "      const sb0=view.style.scrollBehavior; view.style.scrollBehavior='auto'; // v119-58: .view có scroll-behavior:smooth → gán scrollTop sẽ TRƯỢT = \"giật\"; tắt trong lúc repaint mềm\n      recPrune(); // v119-58: dọn sổ listener của thẻ feed đã thay\n      SOFT_RELOAD=true;\n      try{ go(meta[cur]?cur:'overview'); } finally { SOFT_RELOAD=false; }\n      if(view.scrollTop!==sc) view.scrollTop=sc;\n"
    s = R(s, old, new)
s = R(s, "          renderFeed(); renderFeedRail(); renderTicker();\n          return;", "          recPrune(); renderFeed(); renderFeedRail(); renderTicker(); // v119-58: dọn sổ listener của thẻ đã thay\n          return;")
s = R(s, "      if(kbd2&&kx!=null){ kbd2.scrollLeft=kx; view.querySelectorAll('.kcol').forEach(c=>{ const b=c.querySelector('.kb'); if(b&&c.dataset.stage&&kcols[c.dataset.stage]!=null) b.scrollTop=kcols[c.dataset.stage]; }); }\n      renderTicker();",
       "      if(kbd2&&kx!=null){ kbd2.scrollLeft=kx; view.querySelectorAll('.kcol').forEach(c=>{ const b=c.querySelector('.kb'); if(b&&c.dataset.stage&&kcols[c.dataset.stage]!=null) b.scrollTop=kcols[c.dataset.stage]; }); }\n      view.style.scrollBehavior=sb0;\n      renderTicker();")
save(p, s)

# ---------- 80-rbac: khối brand sidebar chỉ ghi khi HTML đổi (logo <img> hết nạp lại mỗi tín hiệu) ----------
p, s = load('src/app/80-rbac-auth.js')
lines = s.split('\n'); hit = 0
for i, ln in enumerate(lines):
    if ln.startswith("      el.innerHTML=`") and ln.rstrip().endswith("`;"):
        lines[i] = "      bbSet(el," + ln[len("      el.innerHTML="):-1] + ");"; hit += 1
assert hit == 2, hit
s = '\n'.join(lines)
s = R(s, "  function renderBrandTag(){\n", "  function bbSet(el,html){ if(el.__slHtml===html) return; el.__slHtml=html; el.innerHTML=html; } // v119-58: chỉ ghi khi đổi\n  function renderBrandTag(){\n")
save(p, s)

# ---------- live.js: refreshAdmin chỉ rebuild khi dữ liệu quản trị đổi ----------
p, s = load('assets/js/live.js')
s = R(s, "  let adminBusy=false, adminLast=0; // v145: chống gọi refreshAdmin dồn dập (throttle 15s)",
       "  let adminBusy=false, adminLast=0; // v145: chống gọi refreshAdmin dồn dập (throttle 15s)\n  let adminSig=''; // v119-58: chữ ký dữ liệu quản trị — không đổi thì KHÔNG rebuild (trước: mỗi repaint mềm kéo thêm 1 repaint nữa sau 15s dù không có gì mới)")
s = R(s, "      mergePending();\n      adminLast=Date.now();\n      rebuild(['users','roi','overview','agency']); // v119-49: Bảng brand đọc users/brands/fb_accounts",
       "      mergePending();\n      adminLast=Date.now();\n      const sig=JSON.stringify([usersList,fbAccounts,brandsList,salesList],(k,v)=>(typeof v==='string'&&v.length>2000)?('#'+v.length):v); // logo data URL → chỉ so độ dài\n      if(force || sig!==adminSig){ adminSig=sig; rebuild(['users','roi','overview','agency']); } // v119-49: Bảng brand đọc users/brands/fb_accounts · v119-58: chỉ khi đổi")
save(p, s)

# ---------- smoke: +8 check ----------
p, s = load('tools/smoke.js')
a = "  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');\n"
assert s.count(a) == 1
add = r"""  /* ===== v119-58: repaint mềm = MORPH DOM (hết chớp giật) ===== */
  await page.evaluate(() => { location.hash = 'overview'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const m2 = await page.evaluate(() => {
    const v = document.getElementById('view'); v.style.scrollBehavior = 'auto'; v.scrollTop = 240; const sc0 = v.scrollTop; v.style.scrollBehavior = ''; // .view smooth: gán rồi đọc ngay trả 0 (đang trượt) → tắt để đo
    const kpi = v.querySelector('.grid.g-4'), cv = document.getElementById('cTrend'), ch = window.Chart.getChart(cv), w0 = cv.getAttribute('width');
    let add = 0, rem = 0; const mo = new MutationObserver(ms => ms.forEach(m => { add += m.addedNodes.length; rem += m.removedNodes.length; })); mo.observe(v, { childList: true, subtree: true });
    window.SLApp.reload(window.SL_DATA);
    mo.takeRecords().forEach(m => { add += m.addedNodes.length; rem += m.removedNodes.length; }); mo.disconnect();
    return { sc0, add, rem, scroll: v.scrollTop, kpiSame: v.querySelector('.grid.g-4') === kpi, cvSame: document.getElementById('cTrend') === cv, chSame: window.Chart.getChart(document.getElementById('cTrend')) === ch, w0, w1: document.getElementById('cTrend').getAttribute('width') };
  });
  (m2.sc0 > 0 && m2.add === 0 && m2.rem === 0 && m2.scroll === m2.sc0 && m2.kpiSame && m2.cvSame && m2.chSame && m2.w0 && m2.w0 === m2.w1) ? ok('v119-58: repaint mềm Tổng quan dữ liệu KHÔNG đổi → 0 node thêm/bớt, KPI/canvas/chart giữ nguyên instance, scroll giữ ' + m2.sc0) : fail('v119-58 morph overview: ' + JSON.stringify(m2));
  await page.evaluate(() => { document.querySelector('.nav-item[data-view="roi"]').click(); document.querySelector('.nav-item[data-view="overview"]').click(); }); await page.waitForTimeout(300); // điều hướng THẬT (go() dựng mới) → chart mới, listener Chart.js mới gắn
  const hvx = await page.evaluate(() => { const c = document.getElementById('cTrend'); let rm = 0; const r0 = c.removeEventListener; c.removeEventListener = function () { rm++; return r0.apply(this, arguments); }; for (let i = 0; i < 3; i++) window.SLApp.reload(window.SL_DATA); const ch = window.Chart.getChart(c); const same = document.getElementById('cTrend') === c; delete c.removeEventListener; return { rm, same, keys: ch ? Object.keys(ch._listeners || {}).length : -1 }; });
  (hvx.rm === 0 && hvx.same && hvx.keys > 0) ? ok('v119-58: listener hover/tooltip của Chart.js trên canvas KHÔNG bị gỡ qua 3 repaint mềm (' + hvx.keys + ' loại sự kiện còn gắn)') : fail('v119-58 listener canvas: ' + JSON.stringify(hvx));
  const m3 = await page.evaluate(() => {
    const v = document.getElementById('view'), D = window.SL_DATA, h0 = D.kpi.hot; D.kpi.hot = 4242;
    const kpi = v.querySelector('.grid.g-4'), dn = window.Chart.getChart(document.getElementById('cDonut'));
    let add = 0, rem = 0; const mo = new MutationObserver(ms => ms.forEach(m => { add += m.addedNodes.length; rem += m.removedNodes.length; })); mo.observe(v, { childList: true, subtree: true });
    window.SLApp.reload(D); mo.takeRecords().forEach(m => { add += m.addedNodes.length; rem += m.removedNodes.length; }); mo.disconnect();
    const r = { add, rem, kpiSame: v.querySelector('.grid.g-4') === kpi, has: /4\.242/.test(kpi.textContent), dnSame: window.Chart.getChart(document.getElementById('cDonut')) === dn, dnVal: dn && dn.data.datasets[0].data[0] };
    D.kpi.hot = h0; window.SLApp.reload(D); return r;
  });
  (m3.kpiSame && m3.has && m3.dnSame && m3.dnVal === 4242 && m3.add + m3.rem <= 30) ? ok('v119-58: số Lead nóng đổi → chỉ sửa chữ tại chỗ (KPI giữ node, donut cùng instance cập nhật 4242, thêm/bớt ' + (m3.add + m3.rem) + ' node)') : fail('v119-58 morph đổi số: ' + JSON.stringify(m3));
  const mu = await page.evaluate(() => {
    const d = document.createElement('div'); d.innerHTML = '<p id="a" class="x">A</p><p data-id="b">B</p><span>c</span><canvas id="cv" width="77"></canvas><input id="in" value="1"><ul><li>1</li><li>2</li><li>3</li></ul><select id="se"><option value="u">u</option><option value="w" selected>w</option></select>';
    const a = d.querySelector('#a'), b = d.querySelector('[data-id=b]'), cv = d.querySelector('#cv'), inp = d.querySelector('#in'); inp.value = 'typed';
    window.__slMorph(d, '<p data-id="b" title="t">B2</p><p id="a" class="y">A</p><em>new</em><canvas id="cv"></canvas><input id="in" value="1"><ul><li>1</li><li>3</li></ul><select id="se"><option value="u" selected>u</option><option value="w">w</option></select>');
    return { order: Array.from(d.children).map(e => e.tagName + (e.id || e.dataset.id || '')).join(','), aSame: d.querySelector('#a') === a, aCls: a.className, bSame: d.querySelector('[data-id=b]') === b, bTxt: b.textContent, bTitle: b.getAttribute('title'), cvSame: d.querySelector('#cv') === cv, cvW: cv.getAttribute('width'), inSame: d.querySelector('#in') === inp, inVal: inp.value, lis: Array.from(d.querySelectorAll('li')).map(l => l.textContent).join(''), span: !!d.querySelector('span'), sel: d.querySelector('#se').value };
  });
  (mu.order === 'Pb,Pa,EM,CANVAScv,INPUTin,UL,SELECTse' && mu.aSame && mu.aCls === 'y' && mu.bSame && mu.bTxt === 'B2' && mu.bTitle === 't' && mu.cvSame && mu.cvW === '77' && mu.inSame && mu.inVal === 'typed' && mu.lis === '13' && !mu.span && mu.sel === 'u') ? ok('v119-58: slMorph đơn vị — đổi thứ tự theo khoá, sửa attr/text, chèn/xoá, canvas giữ width, ô nhập giữ chữ đã gõ, select theo selected') : fail('v119-58 slMorph đơn vị: ' + JSON.stringify(mu));
  // sổ listener: sau nhiều repaint mềm, handler trên node được giữ chạy ĐÚNG 1 lần (đếm hộp thoại confirm của công tắc quét tự động)
  await page.evaluate(() => { location.hash = 'scoring'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(400);
  const rec0 = await page.evaluate(() => { for (let i = 0; i < 5; i++) window.SLApp.reload(window.SL_DATA); return { rec: window.__slRec(), btn: !!document.getElementById('autoScanToggleFull') }; });
  let dlg = 0; const onDlg = d => { dlg++; d.accept(); }; page.on('dialog', onDlg);
  const as0 = await page.evaluate(() => window.SL_DATA.autoScanEnabled !== false);
  if (rec0.btn) { await page.click('#autoScanToggleFull'); await page.waitForTimeout(600); }
  const as1 = await page.evaluate(() => window.SL_DATA.autoScanEnabled !== false);
  if (rec0.btn) { await page.click('#autoScanToggleFull'); await page.waitForTimeout(600); } // trả về như cũ (sau go() dựng mới)
  page.off('dialog', onDlg);
  const as2 = await page.evaluate(() => window.SL_DATA.autoScanEnabled !== false);
  (rec0.btn && dlg === 2 && as1 !== as0 && as2 === as0) ? ok('v119-58: sau 5 repaint mềm + 1 dựng mới, công tắc quét tự động chạy đúng 1 handler/lần bấm (2 bấm = 2 confirm, không gắn đôi)') : fail('v119-58 gắn đôi listener: ' + JSON.stringify({ rec0, dlg, as0, as1, as2 }));
  const recN = await page.evaluate(() => { location.hash = 'feed'; window.SLApp.reload(window.SL_DATA); const a = window.__slRec(); for (let i = 0; i < 20; i++) window.SLApp.reload(window.SL_DATA); return { a, b: window.__slRec() }; });
  (recN.b <= recN.a + 5) ? ok('v119-58: sổ listener không phình sau 20 repaint mềm ở feed (' + recN.a + ' → ' + recN.b + ')') : fail('v119-58 sổ listener phình: ' + JSON.stringify(recN));
  const rl = await page.evaluate(() => { const rail = document.getElementById('feedRail'), r0 = rail.firstElementChild, D = window.SL_DATA; const l = D.leads.find(x => x.temp === 'cold' && !x.dropped && !x.lost); if (!l) return { skip: true }; l.temp = 'hot'; window.SLApp.reload(D); const same = rail.firstElementChild === r0; l.temp = 'cold'; window.SLApp.reload(D); return { same }; });
  (rl.skip || rl.same) ? ok('v119-58: cột phải feed đổi số Nóng/Lạnh → morph tại chỗ (khối đầu giữ node)') : fail('v119-58 rail: ' + JSON.stringify(rl));
  await page.evaluate(() => { location.hash = 'roi'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(400);
  const ro = await page.evaluate(() => { const v = document.getElementById('view'), c0 = v.querySelector('.card'); let n = 0; const mo = new MutationObserver(ms => ms.forEach(m => { n += m.addedNodes.length + m.removedNodes.length; })); mo.observe(v, { childList: true, subtree: true }); window.SLApp.reload(window.SL_DATA); mo.takeRecords().forEach(m => { n += m.addedNodes.length + m.removedNodes.length; }); mo.disconnect(); return { n, same: v.querySelector('.card') === c0 }; });
  (ro.n === 0 && ro.same) ? ok('v119-58: ROI repaint mềm không đổi dữ liệu → 0 node đổi') : fail('v119-58 ROI: ' + JSON.stringify(ro));
"""
s = s.replace(a, add + a)
a = "  await mp.close();\n"
assert s.count(a) == 1
s = s.replace(a, "  // v119-58: sidebar mobile đang mở → dữ liệu realtime KHÔNG được đóng nó\n  await mp.evaluate(() => { document.getElementById('menuBtn').click(); }); await mp.waitForTimeout(300);\n  const sbm = await mp.evaluate(() => { const o0 = document.getElementById('sidebar').classList.contains('open'); window.SLApp.reload(window.SL_DATA); return { o0, o1: document.getElementById('sidebar').classList.contains('open') }; });\n  (sbm.o0 && sbm.o1) ? ok('v119-58: sidebar mobile giữ mở qua repaint mềm') : fail('v119-58 sidebar mobile: ' + JSON.stringify(sbm));\n  await mp.evaluate(() => { document.getElementById('backdrop').click(); });\n" + a)
save(p, s)
print('FE58 OK', mode)
