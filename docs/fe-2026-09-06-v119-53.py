#!/usr/bin/env python3
# FE v119-53 (IIFE) / v120-esm-c (ESM) — 06/09/2026. Dùng: python3 fe53.py <root> iife|esm
# (a) Tiếp cận: heartbeat VPS 30s chỉ vẽ riêng PANEL VPS (live.js tách chữ ký log/stats ↔ workers; 45-outreach oaBindWorkers/oaPatchWorkers)
# (b) Cảnh báo (super): thêm card "Cảnh báo hệ thống" (BrightData ngưng, quét tự động tắt, lượt quét lỗi nguồn, nick checkpoint/needLogin/Safety/ngôn ngữ FB, VPS offline, hết credit eKYC)
# (c) Logo màn login lấy URL đã hash ?v= từ <link rel=icon> (build.mjs chỉ hash trong HTML)
import sys, re, os
root, mode = sys.argv[1], sys.argv[2]
assert mode in ('iife', 'esm')
def rd(p): return open(os.path.join(root, p), encoding='utf-8').read()
def wr(p, s): open(os.path.join(root, p), 'w', encoding='utf-8').write(s)
def rep(s, a, b, n=1, tag=''):
    c = s.count(a)
    assert c == n, f'mốc [{tag}] cần {n} thấy {c}: {a[:90]!r}'
    return s.replace(a, b)
MARK = 'v119-53'
# ---------------- 45-outreach.js ----------------
p = 'src/app/45-outreach.js'; s = rd(p)
assert MARK not in s, '45 đã patch'
s = rep(s, "\n      ${oaWorkersCard()}\n", "\n      <div id=\"oaWorkersHost\">${oaWorkersCard()}</div>\n", 1, '45 host')
i = s.index('    /* v119-40 (P30): "Dừng tất cả" theo VPS'); j = s.index('    /* Gán AdsPower Profile ID cho nick */')
block = s[i:j]
assert block.count('view.querySelectorAll') == 2 and 'data-oa-worker-pause' in block and 'data-oa-worker-max' in block, 'khối handler VPS không như kỳ vọng'
s = s[:i] + "    oaBindWorkers(view); // v119-53: handler panel VPS tách riêng — dùng lại khi vẽ riêng panel theo heartbeat (oaPatchWorkers)\n\n" + s[j:]
fn = ("  /* v119-53: handler panel VPS (Dừng tất cả + số nick cùng lúc) gắn theo ROOT — views.outreach gắn cho cả view; oaPatchWorkers gắn lại riêng cho panel */\n"
      "  function oaBindWorkers(root) {\n" + block.replace('view.querySelectorAll', 'root.querySelectorAll') + "  }\n"
      "  /* v119-53: heartbeat VPS 30s (RAM%/nick chạy/online) CHỈ vẽ lại panel VPS — live.js gọi khi chữ ký log/stats KHÔNG đổi mà workers đổi.\n"
      "     Trả false → live.js rebuild toàn view như cũ (không ở tab Tiếp cận / panel xuất hiện-biến mất). */\n"
      "  function oaPatchWorkers(ws) {\n"
      "    const host = document.getElementById('oaWorkersHost'); if (!host) return false;\n"
      "    if (Array.isArray(ws)) D.workers = ws; // D chỉ đổi khi reload → cập nhật tại chỗ để oaWorkersCard() đọc số mới\n"
      "    try { const a = document.activeElement; if (a && host.contains(a)) return true; } catch (_) { } // đang thao tác trong panel → bỏ nhịp này\n"
      "    const html = oaWorkersCard(); if (!!host.firstElementChild !== !!html) return false;\n"
      "    host.innerHTML = html; oaBindWorkers(host); return true;\n"
      "  }\n"
      "  window.__oaPatchWorkers = oaPatchWorkers;\n\n")
s = rep(s, "  /* ---- Modal thêm nick ---- */\n", fn + "  /* ---- Modal thêm nick ---- */\n", 1, '45 insert fn')
if mode == 'esm':
    s = rep(s, "export { OA_ACTS, OA_DEF_MATRIX, OA_PRESETS, OA_TEMPS, oaBrands, oaMatrixOf, oaOpenBrandCfg, oaOpenContent };",
            "export { OA_ACTS, OA_CHALLENGE_VI, OA_DEF_MATRIX, OA_PRESETS, OA_TEMPS, oaAccounts, oaBrands, oaMatrixOf, oaOpenBrandCfg, oaOpenContent, oaWorkers };", 1, '45 export')
wr(p, s)
# ---------------- live.js ----------------
p = 'assets/js/live.js'; s = rd(p)
assert MARK not in s, 'live đã patch'
i = s.index('    function oaSignature(){'); j = s.index('    function lazyOutreach(){')
old = s[i:j]
assert 'function oaRepaint(){' in old and "rebuild(['outreach','agency']);" in old, 'khối oaSignature/oaRepaint không như kỳ vọng'
new = r"""    function oaSigMain(){ // log + KPI brand (đổi = có hoạt động thật → vẽ lại toàn view)
      var s=outreachLog.length+'#';
      for(var i=0;i<outreachLog.length && i<8;i++){ var e=outreachLog[i]||{}; s+=(e.id||'')+':'+(e.status||'')+';'; }
      var codes=Object.keys(outreachStats||{}).sort();
      for(var j=0;j<codes.length;j++){ var st=outreachStats[codes[j]]||{}; s+='|'+codes[j]+'='+(st.react||0)+','+(st.comment||0)+','+(st.friend||0)+','+(st.inbox||0)+','+(st.replied||0); }
      return s;
    }
    function oaSigWorkers(){ // tình trạng VPS (heartbeat 30s: online/running/max/RAM%/paused/inboxCheck)
      var s='';
      var ws=(workersList||[]).slice().sort(function(a,b){ return a.id<b.id?-1:(a.id>b.id?1:0); });
      for(var k=0;k<ws.length;k++){ var w=ws[k]; s+=w.id+':'+(w.isOnline?1:0)+':'+(w.running||0)+':'+(w.maxConcurrent||0)+':'+(w.ramUsedPct||0)+':'+(w.paused?1:0)+':'+(w.inboxCheck?1:0)+';'; } // v119-40: + paused/inboxCheck
      return s;
    }
    function oaSignature(){ return oaSigMain()+'//'+oaSigWorkers(); } // v119-53: tách 2 nửa để biết "CHỈ VPS đổi"
    var oaSigMainLast='';
    function oaRepaint(){
      try{ var a=document.activeElement; if(a && a.matches && a.matches('input[data-oa-worker-max]')) return; }catch(_){ }
      var sig=oaSignature();
      if(sig===oaSig) return;              // dữ liệu hiển thị KHÔNG đổi → bỏ vẽ (double-fire serverTimestamp / refire cache)
      oaSig=sig;
      if(oaPaintT) return;                 // đã hẹn vẽ → state mới nhất sẽ vào lần vẽ đó (gộp burst)
      // v119-39: callback PHẢI re-check focus — nếu trong 500ms Super Admin bắt đầu gõ ô "số nick cùng lúc"
      // thì HOÃN thêm 1 nhịp (không rebuild full → không nuốt số đang gõ). Blur xong nhịp kế vẽ.
      oaPaintT=setTimeout(function paint(){
        try{ var a=document.activeElement; if(a && a.matches && a.matches('input[data-oa-worker-max]')){ oaPaintT=setTimeout(paint, 500); return; } }catch(_){ }
        oaPaintT=null;
        // v119-53: CHỈ dữ liệu VPS đổi (heartbeat 30s) + đang ở tab Tiếp cận → vẽ riêng PANEL VPS (45-outreach oaPatchWorkers), không vẽ lại toàn view.
        //   Log/KPI đổi, không ở tab, hoặc panel xuất hiện/biến mất → rebuild như cũ.
        var m=oaSigMain(); var onlyWorkers=(m===oaSigMainLast); oaSigMainLast=m;
        if(onlyWorkers && (window.location.hash||'').replace('#','')==='outreach' && window.__oaPatchWorkers){ try{ if(window.__oaPatchWorkers(workersList)) return; }catch(_){ } }
        rebuild(['outreach','agency','alerts']); // v119-49: Bảng brand cũng đọc outreach_stats/workers · v119-53: Cảnh báo hệ thống đọc workers/nick
      }, 500);
    }
"""
s = s[:i] + new + s[j:]
s = rep(s, "var onHash=function(){ var h=(window.location.hash||'').replace('#',''); if(h==='outreach'||h==='agency') start(); };",
        "var onHash=function(){ var h=(window.location.hash||'').replace('#',''); if(h==='outreach'||h==='agency'||h==='alerts') start(); }; // v119-53: Cảnh báo hệ thống cần workers/stats", 1, 'live onHash')
wr(p, s)
# ---------------- 10-core-overview.js ----------------
p = 'src/app/10-core-overview.js'; s = rd(p)
s = rep(s, "    alerts:      ['Cảnh báo lead nóng/ấm','Nhật ký lead nóng/ấm mới phát hiện (thật, realtime) · kênh thông báo'],",
        "    alerts:      ['Cảnh báo','Cảnh báo hệ thống (quét · automation · nick · VPS) + nhật ký lead nóng/ấm (thật, realtime) · kênh thông báo'], // v119-53", 1, '10 meta')
s = rep(s, "(name==='users'||name==='roi'||name==='overview'||name==='outreach'||name==='agency')",
        "(name==='users'||name==='roi'||name==='overview'||name==='outreach'||name==='agency'||name==='alerts')", 1, '10 refreshAdmin')
wr(p, s)
# ---------------- 50-config-views.js ----------------
p = 'src/app/50-config-views.js'; s = rd(p)
assert MARK not in s
card = r"""  /* v119-53: CẢNH BÁO HỆ THỐNG (super) — gom tín hiệu hạ tầng đang có sẵn trong D (không thêm kênh dữ liệu) thành 1 chỗ; bấm dòng → nơi xử lý.
     Nguồn: system_status/brightdata (D.sysStatus) · config.autoScanEnabled (D.cfg) · lượt quét gần nhất (D.scans) · nick (fb_accounts) · VPS (workers) · eKYC (D.sysAlert). */
  function sysAlertRows(){
    const rows=[]; const add=(ic,lb,detail,go,sev)=>rows.push({ic,lb,detail,go,sev});
    const st=D.sysStatus||null;
    if(st&&st.ok===false) add('⛔','BrightData đang NGƯNG - không lấy được bài mới', [(st.since?'từ '+new Date(+st.since).toLocaleString('vi-VN'):''),(st.runs?st.runs+' lượt lỗi':''),(st.sample||'')].filter(Boolean).join(' · '),'history','bad');
    if(D.cfg&&D.cfg.autoScanEnabled===false) add('⏸','Quét tự động đang TẠM DỪNG','bật lại ở widget Quét tự động (mục Chấm điểm)','scoring','warn');
    const sc=(D.scans||[])[0]; if(sc&&Number(sc.scrapeErrors)>0){ let when=''; try{ when=fmtWhen(sc.at); }catch(e){} add('⚠️','Lượt quét gần nhất có '+Number(sc.scrapeErrors)+' nguồn lỗi',[when?'lúc '+when:'',(sc.sourcesCount?sc.sourcesCount+' nguồn':'')].filter(Boolean).join(' · '),'history','warn'); }
    (oaAccounts()||[]).forEach(a=>{
      const why=a.challenge?('checkpoint: '+(OA_CHALLENGE_VI[a.challenge]||a.challenge)):a.needLogin?'cần đăng nhập lại':a.safetyPaused?('tạm dừng theo Safety Score'+(a.safety!=null?' ('+a.safety+')':'')):(a.uiLang&&a.uiLang!=='vi')?('Facebook đang để ngôn ngữ "'+a.uiLang+'" - đổi sang Tiếng Việt'):'';
      if(why) add('🔴','Nick '+(a.label||a.id||a.pid||'?')+' - '+why,(a.brand?'brand '+a.brand:'chưa gán brand')+(a.active===false?' · nick đang TẮT':''),'outreach',(a.challenge||a.needLogin)?'bad':'warn');
    });
    (oaWorkers()||[]).filter(w=>!w.isOnline).forEach(w=>add('🖥','VPS '+(w.workerId||w.id||'?')+' offline','lần cuối báo về '+(w.lastWhen||'?'),'outreach','bad'));
    if(D.sysAlert&&D.sysAlert.status==='out_of_credit') add('💳','Hết credit eKYC Pro - không check được liên kết Zalo của SĐT mới','nạp thêm tại api.ekycpro.com, hệ thống tự check bù','overview','warn');
    return rows;
  }
  function sysAlertCard(){
    const rows=sysAlertRows();
    return `<div class="card" id="sysAlertCard" style="margin-bottom:14px">
      <div class="card-head"><div><h3>🛠 Cảnh báo hệ thống</h3><div class="sub">Hạ tầng quét + automation · gom từ dữ liệu realtime đang có · bấm dòng để tới nơi xử lý</div></div>
        <span class="chip ${rows.length?'chip-hot':'chip-brand'}"><span class="dot"></span>${rows.length?rows.length+' cần chú ý':'Bình thường'}</span></div>
      <div class="card-pad">${rows.length?`<div class="al-sum al-sys">${rows.map(r=>`<button class="al-sum-row has ${r.sev}" data-go="${esc(r.go)}"><span>${r.ic} ${esc(r.lb)}<small>${esc(r.detail)}</small></span><b>›</b></button>`).join('')}</div>`:'<div class="sub">✅ Không có cảnh báo hạ tầng: BrightData chạy, quét tự động bật, nick và VPS bình thường.</div>'}</div>
    </div>`;
  }
"""
s = rep(s, "  views.alerts = function(){\n    view.innerHTML = `\n      <div class=\"grid g-2\" style=\"grid-template-columns:1.3fr 1fr\">",
        card + "  views.alerts = function(){\n    view.innerHTML = `${sysAlertCard()}\n      <div class=\"grid g-2\" style=\"grid-template-columns:1.3fr 1fr\">", 1, '50 views.alerts')
if mode == 'esm':
    s = rep(s, "import './45-outreach.js'; // GIỮ THỨ TỰ", "import { OA_CHALLENGE_VI, oaAccounts, oaWorkers } from './45-outreach.js'; // v119-53: Cảnh báo hệ thống\nimport './45-outreach.js'; // GIỮ THỨ TỰ", 1, '50 import 45')
    # import thứ tự phải đứng ĐẦU → đảo: dòng import './45' giữ ở trên
    s = s.replace("import { OA_CHALLENGE_VI, oaAccounts, oaWorkers } from './45-outreach.js'; // v119-53: Cảnh báo hệ thống\nimport './45-outreach.js'; // GIỮ THỨ TỰ ĐÁNH GIÁ theo tên file (mỗi part import part đứng trước nó ĐẦU TIÊN) = giống bản ghép IIFE cũ",
                  "import './45-outreach.js'; // GIỮ THỨ TỰ ĐÁNH GIÁ theo tên file (mỗi part import part đứng trước nó ĐẦU TIÊN) = giống bản ghép IIFE cũ\nimport { OA_CHALLENGE_VI, oaAccounts, oaWorkers } from './45-outreach.js'; // v119-53: Cảnh báo hệ thống")
    assert s.startswith("import './45-outreach.js';") or s.split('\n')[1].startswith("import './45-outreach.js';"), 'import thứ tự 50 không còn đứng đầu'
wr(p, s)
# ---------------- 80-rbac-auth.js ----------------
p = 'src/app/80-rbac-auth.js'; s = rd(p)
s = rep(s, '<img src="assets/img/logo-mark.png" width="30" height="30" alt="">', '<img src="${logoSrc()}" width="30" height="30" alt="">', 2, '80 logo')
fnl = ("  /* v119-53: logo màn login lấy đúng URL đã hash ?v= từ <link rel=icon> trong app.html (build.mjs chỉ hash ?v= trong HTML, JS không có) → đổi logo không bị cache cũ */\n"
       "  function logoSrc(){ try{ const l=document.querySelector('link[rel=\"icon\"][href*=\"logo-mark\"]'); const h=l&&l.getAttribute('href'); if(h) return h; }catch(e){} return 'assets/img/logo-mark.png'; }\n")
if mode == 'esm':
    k = s.rindex('\nexport {'); s = s[:k+1] + fnl + s[k+1:]
else:
    s = s.rstrip('\n') + '\n' + fnl
wr(p, s)
# ---------------- app.html ----------------
p = 'app.html'; s = rd(p)
s = re.sub(r'(data-view="alerts">.*?</span>) Cảnh báo lead</button>', r'\1 Cảnh báo</button>', s, count=1)
assert 'Cảnh báo lead</button>' not in s, 'nav alerts label'
wr(p, s)
# ---------------- app.css ----------------
p = 'assets/css/app.css'; s = rd(p)
assert '.al-sys' not in s
s = s.rstrip('\n') + """

/* v119-53: Cảnh báo hệ thống (super) */
.al-sys .al-sum-row { align-items: flex-start; }
.al-sys .al-sum-row > span { display: flex; flex-direction: column; gap: 2px; }
.al-sys .al-sum-row small { font-size: 11.5px; color: var(--ink-500); font-weight: 400; }
.al-sys .al-sum-row.bad { border-color: var(--hot); background: var(--hot-bg); }
.al-sys .al-sum-row.warn { border-color: var(--warm); background: var(--warm-bg); }
.al-sys .al-sum-row b { font-size: 18px; color: var(--ink-300); }
"""
wr(p, s)
# ---------------- tools/smoke.js ----------------
p = 'tools/smoke.js'; s = rd(p)
s = rep(s, "  const al = await page.evaluate(() => ({ title: (document.getElementById('vTitle') || {}).textContent, sum: document.querySelectorAll('.al-sum-row').length, fake: /Sales phụ trách: @ngoc/.test(document.querySelector('.view').textContent) }));\n  (/Cảnh báo lead/.test(al.title) && al.sum === 5 && !al.fake) ? ok('Cảnh báo: nhật ký thật + 5 ô việc cần làm, hết mẫu bịa') : fail('Cảnh báo sai: ' + JSON.stringify(al));",
"""  const al = await page.evaluate(() => ({ title: (document.getElementById('vTitle') || {}).textContent, sum: document.querySelectorAll('.al-sum:not(.al-sys) .al-sum-row').length, fake: /Sales phụ trách: @ngoc/.test(document.querySelector('.view').textContent), sys: !!document.getElementById('sysAlertCard'), sysRows: document.querySelectorAll('#sysAlertCard .al-sum-row').length, sysTxt: (document.getElementById('sysAlertCard') || {}).textContent || '' }));
  (/^Cảnh báo/.test(al.title) && al.sum === 5 && !al.fake) ? ok('Cảnh báo: nhật ký thật + 5 ô việc cần làm, hết mẫu bịa') : fail('Cảnh báo sai: ' + JSON.stringify({ title: al.title, sum: al.sum, fake: al.fake }));
  (al.sys && al.sysRows >= 2 && /Yến Wellness/.test(al.sysTxt) && /vps-2/.test(al.sysTxt)) ? ok(`Cảnh báo hệ thống (v119-53): ${al.sysRows} dòng (nick checkpoint + VPS offline), bấm được`) : fail('Cảnh báo hệ thống sai: ' + JSON.stringify({ sys: al.sys, rows: al.sysRows }));""", 1, 'smoke alerts')
s = rep(s, "  vmax >= 1 ? ok(`Ô chỉnh maxConcurrent trên panel VPS: ${vmax}`) : fail('Thiếu ô chỉnh maxConcurrent');\n",
"""  vmax >= 1 ? ok(`Ô chỉnh maxConcurrent trên panel VPS: ${vmax}`) : fail('Thiếu ô chỉnh maxConcurrent');
  // v119-53: heartbeat CHỈ vẽ riêng panel VPS — view giữ nguyên node, bảng VPS thay mới, handler gắn lại
  const vp = await page.evaluate(() => { const view = document.querySelector('.view'); const keep = view.firstElementChild; keep.setAttribute('data-sl-keep', '1'); const t1 = document.querySelector('.oa-vtable'); const r = window.__oaPatchWorkers ? window.__oaPatchWorkers() : 'no-fn'; const t2 = document.querySelector('.oa-vtable'); return { r, replaced: !!t1 && !!t2 && t1 !== t2, kept: !!view.querySelector('[data-sl-keep]'), pause: !!document.querySelector('#oaWorkersHost button[data-oa-worker-pause]') }; });
  (vp.r === true && vp.replaced && vp.kept && vp.pause) ? ok('Panel VPS vẽ riêng (v119-53): __oaPatchWorkers thay bảng VPS, view giữ nguyên node') : fail('Panel VPS patch sai: ' + JSON.stringify(vp));
""", 1, 'smoke vps')
s = rep(s, "  (clk.live && clk.app >= 1) ? ok('Giờ server: live.min.js đo lệch giờ (SL_NOW) + app dùng slNow() cho mốc ghi (fallback Date.now khi chưa có)') : fail('SL_NOW sai: ' + JSON.stringify(clk));\n",
"""  (clk.live && clk.app >= 1) ? ok('Giờ server: live.min.js đo lệch giờ (SL_NOW) + app dùng slNow() cho mốc ghi (fallback Date.now khi chưa có)') : fail('SL_NOW sai: ' + JSON.stringify(clk));
  const lg = /link\\[rel="icon"\\]\\[href\\*="logo-mark"\\]/.test(fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8')) && /oaPatchWorkers/.test(fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8'));
  lg ? ok('v119-53: logo màn login lấy URL đã hash từ <link rel=icon> · live.js gọi __oaPatchWorkers khi chỉ VPS đổi') : fail('v119-53 thiếu logoSrc()/oaPatchWorkers trong bản min');
""", 1, 'smoke logo')
wr(p, s)
print('FE53 OK', mode)
