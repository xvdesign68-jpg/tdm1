import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]

# ---------- A. app.html ----------
p='app.html'; s=rd(p)
icons = dict(re.findall(r'data-view="(\w+)"[^>]*><span class="ic">(.*?)</span>', s))
assert 'overview' in icons and 'integrations' in icons, 'nav parse'
def item(v,label,extra='',cnt=''):
    return '      <button type="button" class="nav-item" data-view="%s"%s><span class="ic">%s</span> %s%s</button>\n' % (v, extra, icons[v], label, cnt)
nav = ('    <nav class="side-nav" id="sideNav" tabindex="0" aria-label="Điều hướng chính">\n'
  '      <div class="side-group mono">Tổng quan</div>\n'
  + item('overview','Bảng điều khiển')
  + item('agency','Bảng brand',' style="display:none"')
  + item('roi','Giá trị &amp; ROI')
  + item('reports','Báo cáo')
  + '      <div class="side-group mono">Làm việc</div>\n'
  + item('feed','Lead mới','',' <span class="count" id="cntFeed"></span>')
  + item('tasks','Hộp việc','',' <span class="count" id="cntTasks"></span>')
  + item('replies','Phản hồi khách','',' <span class="count" id="cntReplies"></span>')
  + item('pipeline','Pipeline')
  + '      <div class="side-group mono">Quét &amp; AI</div>\n'
  + item('sources','Nguồn quét')
  + item('keywords','Từ khoá &amp; bộ lọc')
  + item('scoring','Chấm điểm AI')
  + item('history','Lịch sử quét')
  + item('scanned','Bài đã quét')
  + '      <div class="side-group mono">Quản trị</div>\n'
  + item('outreach','Tiếp cận')
  + item('alerts','Cảnh báo')
  + item('users','Người dùng',' style="display:none"')
  + item('account','Cài đặt tài khoản')
  + '    </nav>\n')
i=s.find('    <nav class="side-nav"'); j=s.find('    </nav>\n', i)+len('    </nav>\n')
assert i>0 and j>i
s=s[:i]+nav+s[j:]
wr(p,s)
cut(p,'    <!-- Sidebar hotline','    </a>\n',tag='A.hotline-sidebar')
cut(p,'<!-- Floating hotline (mobile only) -->','</a>\n',tag='A.hotline-floating')
rep(p,'aria-label="Tìm lead theo tên, nội dung, ngành" placeholder="Tìm lead theo tên, nội dung, ngành…"','aria-label="Tìm lead, số điện thoại, email" placeholder="Tìm lead, SĐT, email…"',tag='A.search')
rep(p,'<p id="vSub">Tổng quan hiệu quả phát hiện &amp; xử lý lead</p>','<p id="vSub">Việc cần làm hôm nay và hiệu quả lead</p>',tag='A.vsub')
rep(p,'<span>Lead</span></button>','<span>Lead mới</span></button>',tag='A.bt-feed')

# ---------- B. 10-core meta ----------
p='src/app/10-core-overview.js'
rep(p,"    overview:    ['Bảng điều khiển','Tổng quan hiệu quả phát hiện & xử lý lead'],","    overview:    ['Bảng điều khiển','Việc cần làm hôm nay và hiệu quả lead'],",tag='B.meta.overview')
rep(p,"    feed:        ['Lead feed realtime','Các lead vừa được phát hiện & chấm điểm bởi AI'],","    feed:        ['Lead mới','Lead vừa phát hiện, AI đã chấm điểm – cập nhật realtime'],",tag='B.meta.feed')
rep(p,"    pipeline:    ['Pipeline sales','Theo dõi lead qua từng giai đoạn xử lý'],","    pipeline:    ['Pipeline','Theo dõi lead qua từng giai đoạn chăm sóc'],",tag='B.meta.pipeline')
rep(p,"    roi:         ['Giá trị & ROI','Quy đổi lead thành tiền - so sánh trực tiếp với chi phí chạy quảng cáo'],","    roi:         ['Giá trị & ROI','Quy đổi lead thành tiền, so với chi phí quảng cáo'],",tag='B.meta.roi')
rep(p,"    sources:     ['Nguồn quét','Group / fanpage / nguồn công khai đang theo dõi'],","    sources:     ['Nguồn quét','Group, fanpage và nguồn công khai đang theo dõi'],",tag='B.meta.sources')
rep(p,"    keywords:    ['Keyword & bộ lọc','Từ khoá tín hiệu nhu cầu và tiêu chí loại trừ'],","    keywords:    ['Từ khoá & bộ lọc','Từ khoá tín hiệu nhu cầu và tiêu chí loại trừ'],",tag='B.meta.keywords')
rep(p,"    scoring:     ['Cấu hình AI Scoring','Trọng số & ngưỡng phân loại lead nóng/ấm/lạnh'],","    scoring:     ['Chấm điểm AI','Lịch quét, trọng số và ngưỡng phân loại nóng/ấm/lạnh'],",tag='B.meta.scoring')
rep(p,"    alerts:      ['Cảnh báo','Cảnh báo hệ thống (quét · automation · nick · VPS) + nhật ký lead nóng/ấm (thật, realtime) · kênh thông báo'],","    alerts:      ['Cảnh báo','Tình trạng hệ thống, lead nóng/ấm mới và kênh thông báo'],",tag='B.meta.alerts')
rep(p,"    history:     ['Lịch sử quét','Thống kê chi tiết từng lần quét: bài, lead, token & chi phí AI'],","    history:     ['Lịch sử quét','Từng lượt quét: bài, lead, chi phí AI và ngân sách'],",tag='B.meta.history')
rep(p,"    scanned:     ['Bài đã quét','Mọi bài AI đã đọc - bài không phù hợp tự xoá sau 7 ngày'],","    scanned:     ['Bài đã quét','Mọi bài AI đã đọc, bài không phù hợp tự xoá sau 7 ngày'],",tag='B.meta.scanned')
rep(p,"    reports:     ['Báo cáo & tối ưu','Phân tích nguồn, keyword và tỷ lệ chuyển đổi'],","    reports:     ['Báo cáo','Hiệu quả nguồn, từ khoá và tỷ lệ chuyển đổi'],",tag='B.meta.reports')
rep(p,"    integrations:['Tích hợp','Kết nối nguồn dữ liệu, AI và CRM của bạn'],\n","",tag='B.meta.integrations')
rep(p,"    users:       ['Người dùng','Quản lý tài khoản & phân quyền truy cập (chỉ Super Admin)'],","    users:       ['Người dùng','Tài khoản, vai trò và brand của từng người'],",tag='B.meta.users')
rep(p,"    tasks:       ['Hộp việc hôm nay','Quá hẹn · khách đã phản hồi · hẹn hôm nay · lead nóng chưa chăm · chưa giao · deal chưa nhập giá trị'],","    tasks:       ['Hộp việc','Quá hẹn, khách phản hồi, hẹn hôm nay, lead nóng chưa chăm'],",tag='B.meta.tasks')
rep(p,"    replies:     ['Phản hồi khách','Khách đã trả lời inbox/bình luận của máy - người thật tiếp quản, máy đã dừng tự động'],","    replies:     ['Phản hồi khách','Khách đã trả lời, đến lượt bạn tiếp quản'],",tag='B.meta.replies')
rep(p,"    agency:      ['Bảng brand (agency)','So sánh & xếp hạng mọi brand: lead, chất lượng, phản hồi, chốt, automation - chỉ Super Admin']","    agency:      ['Bảng brand','So sánh mọi brand: lead, chất lượng, phản hồi, chốt, automation']",tag='B.meta.agency')
rep(p,"const SUPER_ONLY_VIEWS={sources:1,keywords:1,scoring:1,alerts:1,history:1,integrations:1,users:1,outreach:1,agency:1};","const SUPER_ONLY_VIEWS={sources:1,keywords:1,scoring:1,alerts:1,history:1,users:1,outreach:1,agency:1};",tag='B.superonly')
# Tiếp cận meta có sẵn? (outreach nằm ở 45) – kiểm
assert "outreach:" in rd('src/app/45-outreach.js') or "meta.outreach" in rd('src/app/45-outreach.js')

# ---------- C. 20-feed overview ----------
p='src/app/20-feed.js'
rep(p,"""      ${roleIsSuper()?bdStatusCard():''}
      ${roleIsSuper()?autoScanWidget(true):''}
      ${roleIsSuper()?scanMethodWidget(true):''}
      ${roleIsSuper()?'<div id="bdBudget" style="margin-bottom:14px"></div>':''}
      ${agencyCard()}
      ${onboardingCard()}
      ${todayCard()}
      ${nextBestCard()}
      <div class="grid g-4">""","""      ${roleIsSuper()?bdStatusCard():''}
      ${roleIsSuper()?opsStrip():''}
      ${onboardingCard()}
      ${todayCard()}
      ${nextBestCard()}
      <div class="grid g-4">""",tag='C.order1')
rep(p,"""      <div class="grid g-2 mt-18">
        <div class="card">
          <div class="card-head"><div><h3>Nguồn lead từ các group</h3>""","""      ${agc?'<div class="mt-18">'+agc+'</div>':''}
      <div class="grid g-2 mt-18">
        <div class="card">
          <div class="card-head"><div><h3>Nguồn lead từ các group</h3>""",tag='C.order2')
rep(p,"""  views.overview = function(){
    const k = D.kpi;
    view.innerHTML = `""","""  views.overview = function(){
    const k = D.kpi; const agc=agencyCard();
    view.innerHTML = `""",tag='C.agc')
rep(p,"""    if(roleIsSuper()){ bindAutoScanToggle(); bindScanMethodSwitch(); }
    renderTrend(); renderDonut();
    if(roleIsSuper()) startBdBudgetAuto();
  };""","""    renderTrend(); renderDonut();
  };
  /* v119-61: dải trạng thái vận hành 1 dòng trên Bảng điều khiển (Super Admin) – thay 2 widget Quét tự động + Phương thức quét;
     bật/tắt & đổi phương thức làm ở mục Chấm điểm AI / Nguồn quét, ngân sách ở Lịch sử quét. */
  function opsStrip(){
    const on=isAutoScanOn(); const sm=getScanMethod(); const m=SCAN_METHODS[sm]||SCAN_METHODS.brightdata;
    const nicks=getActiveNicks().length; const nickOk = sm!=='facebook_nick' || nicks>0;
    const lastScan=(D.scanStats&&D.scanStats.lastAt)?D.scanStats.lastAt:((D.scans||[])[0]?new Date((D.scans[0]._at||D.scans[0].at||0)):null);
    const last=lastScan?fmtDT(lastScan):'chưa có';
    return `<div class="card ops-strip" id="opsStrip">
      <span class="ops-item"><i class="ops-dot ${on?'on':'off'}"></i><b>Quét tự động</b><span>${on?'đang bật · 3 phút/lượt':'đang tắt · chỉ quét khi bấm'}</span></span>
      <span class="ops-item"><b>${esc(m.label)}</b><span>${nickOk?(sm==='facebook_nick'?nicks+' nick hoạt động':'bài công khai'):'chưa có nick hoạt động'}</span></span>
      <span class="ops-item"><b>Lần quét cuối</b><span>${esc(last)}</span></span>
      <span class="ops-item"><b>Nhịp gieo</b><span>${scanIv()} phút / nguồn</span></span>
      <span class="ops-act"><button class="btn btn-ghost btn-sm" data-go="scoring">Cấu hình quét</button><button class="btn btn-ghost btn-sm" data-go="history">Chi phí</button></span>
    </div>`;
  }""",tag='C.opsStrip')

# ---------- D. 60 history: ngân sách Bright Data ----------
p='src/app/60-scan-views.js'
rep(p,"""    view.innerHTML = `
      <div class="grid g-4">
        ${kpiCard(SLI.refresh||SLI.bolt,'var(--brand-50)','var(--brand-600)', fmt(A.list.length), 'Tổng lần quét','','', A.last?('gần nhất: '+fmtDT(A.last)):'')}""","""    view.innerHTML = `
      <div id="bdBudget" style="margin-bottom:14px"></div>
      <div class="grid g-4">
        ${kpiCard(SLI.refresh||SLI.bolt,'var(--brand-50)','var(--brand-600)', fmt(A.list.length), 'Tổng lần quét','','', A.last?('gần nhất: '+fmtDT(A.last)):'')}""",tag='D.bdhost')
rep(p,"""    renderScanChart(A.trend); renderScanDist(A.dist);
""","""    renderScanChart(A.trend); renderScanDist(A.dist);
    startBdBudgetAuto(); // v119-61: ngân sách Bright Data chuyển từ Bảng điều khiển sang đây (chi phí đi cùng lịch sử quét)
""",tag='D.bdstart')

# ---------- E. 50: alerts + bỏ Tích hợp ----------
p='src/app/50-config-views.js'
rep(p,"""<div class="sub" style="margin-top:10px">Cảnh báo tới sales đi qua Hộp việc + chuông trong app (realtime). Kênh ngoài (Telegram/Zalo/Email) bật ở dưới - cần token trong functions/.env.</div>""","""<div class="sub" style="margin-top:10px">Sales nhận việc qua Hộp việc và chuông trong app. Kênh ngoài (Telegram, Zalo, Email…) bật ở phần Kênh thông báo bên dưới.</div>""",tag='E.alerts.sub')
rep(p,"""      <div class="chan-grid">${D.channels.map(chanCard).join('')}</div>
      <div class="banner mt-18"><span class="ic">ℹ️</span><span class="tx">Bật kênh ở đây để chọn nơi nhận cảnh báo. Để gửi được thật, kênh tương ứng cần có token trong <b>functions/.env</b> (Telegram/Zalo/Email…).</span></div>`;""","""      <div class="chan-grid">${D.channels.map(chanCard).join('')}</div>
      <div class="banner mt-18"><span class="ic">${SLI.info}</span><span class="tx">Bật kênh để chọn nơi nhận cảnh báo lead nóng. Đội Z15 kết nối kênh cho từng brand khi triển khai.</span></div>`;""",tag='E.alerts.banner')
cut(p,"""  /* ====================================================
     VIEW: INTEGRATIONS""","""      <div style="margin-top:14px"><button class="btn btn-ghost btn-sm">Cấu hình →</button></div></div>`;
  }
""",tag='E.integrations')

# ---------- F. 70: tài khoản + ticker + chip topbar ----------
p='src/app/70-shell-tools.js'
rep(p,"""      sessRows=`<div class="acs-row"><div><b>Chrome · macOS</b><span>Phiên hiện tại - thiết bị này (demo)</span></div><span class="chip chip-brand">Hiện tại</span></div>
        <div class="acs-row"><div><b>Safari · iOS</b><span>Hoạt động 2 giờ trước (demo)</span></div><button class="btn btn-ghost btn-sm" data-acs-out="demo">Thoát</button></div>`;""","""      sessRows='<div class="acs-row"><div><b>Chưa ghi nhận phiên nào</b><span>Danh sách thiết bị sẽ hiện sau lần đăng nhập tới</span></div></div>';""",tag='F.sess')
cut(p,"""        ${roleIsSuper()?`<div class="card">
          <div class="card-head"><div><h3>Thông báo cá nhân</h3>""","""        </div>`:''}
""",tag='F.demo-notif')
rep(p,"""          <div class="card-pad acs-fields">${sessRows}</div>
        </div>
      </div>`;""","""          <div class="card-pad acs-fields">${sessRows}</div>
        </div>
        ${roleIsSuper()?(()=>{ const tk=getAnnTicker()||{}; const onTk=!!(tk.enabled&&String(tk.text||'').trim()); return `<div class="card">
          <div class="card-head"><div><h3>Thanh thông báo đầu trang</h3><div class="sub">${onTk?'Đang bật: “'+esc(String(tk.text).trim().slice(0,90))+(String(tk.text).trim().length>90?'…':'')+'”':'Đang tắt – thông điệp chạy ngang trên đầu trang cho mọi người dùng'}</div></div>
            <button class="btn btn-ghost btn-sm" id="acsTicker">${SLI.edit} Soạn thông báo</button></div></div>`; })():''}
        <div class="card">
          <div class="card-head"><div><h3>Hỗ trợ từ Z15 Miracle</h3><div class="sub">Cần thêm nguồn quét, đổi cấu hình hay gặp sự cố: đội vận hành hỗ trợ 24/7</div></div>
            <a class="btn btn-ghost btn-sm" href="tel:19005368">${SLI.phone} 1900.5368</a></div></div>
      </div>`;
    const tkBtn=view.querySelector('#acsTicker'); if(tkBtn) tkBtn.addEventListener('click',openAnnEditor);""",tag='F.support')
rep(p,"""    view.querySelectorAll('[data-acs-toggle]').forEach(t=>t.addEventListener('click',()=>{ t.classList.toggle('on'); toast('Đã '+(t.classList.contains('on')?'bật':'tắt')+' (demo).'); }));
""","",tag='F.acs-toggle')
rep(p,"""    if(!has&&!isSuper) return;
    if(has&&annDismissed&&!isSuper) return;
    let el;
    if(!has&&isSuper){
      el=document.createElement('button'); el.type='button'; el.id='slTicker';
      el.className='ann-ticker-placeholder';
      el.title='Bật & cấu hình thanh thông báo trên đầu (chỉ Super Admin)';
      el.innerHTML=`<span class="ann-ticker-placeholder-icon">${ANN_ICONS.megaphone}</span>
        <span class="ann-ticker-placeholder-text">Thanh thông báo đang tắt - bấm để soạn thông điệp chạy ngang trên đầu trang.</span>
        <span class="ann-ticker-placeholder-pill">Cấu hình</span>`;
      el.addEventListener('click',openAnnEditor);
    } else {
      const core=annCore(conf);""","""    if(!has) return; // v119-61: thanh đang tắt → không chiếm dòng đầu trang; Super Admin soạn ở Cài đặt tài khoản
    if(has&&annDismissed&&!isSuper) return;
    let el;
    {
      const core=annCore(conf);""",tag='F.ticker')
rep(p,"""      smb.innerHTML=`<span class="chip ${autoOn?'chip-cold':'chip-junk'}" style="font-size:11px;cursor:pointer" title="${autoOn?'Auto scan: BẬT (mỗi 3 phút). Bấm để tắt.':'Auto scan: TẮT. Bấm để bật.'}" id="topAutoToggle">${autoOn?'⏱ AUTO':'⏸ PAUSED'}</span>`
        +`<span class="chip ${nickOk?m.chip:'chip-hot'}" style="font-size:11px;cursor:pointer;margin-left:4px${!nickOk?';animation:dotPing 1.8s infinite':''}" title="${nickOk?('Phương thức: '+m.label+'. Bấm để đổi.'):('⚠️ Mode Nick FB nhưng không có nick!')}" id="topMethodToggle">${m.icon} ${nickOk?m.badge:'⚠️ NO NICK'}</span>`;
      smb.style.display='';
      document.getElementById('topMethodToggle').onclick=()=>{ const next=sm==='brightdata'?'facebook_nick':'brightdata'; openScanMethodConfirm(next); };
      document.getElementById('topAutoToggle').onclick=()=>{
        const next=!autoOn;
        if(!confirm(next?'BẬT quét tự động mỗi 3 phút?':'TẮT quét tự động?')) return;
        if(window.SL_FB&&window.SL_FB.setConfig){
          window.SL_FB.setConfig({autoScanEnabled:next}).then(()=>{ if(D) D.autoScanEnabled=next; toast(next?'✅ Auto scan BẬT':'🔴 Auto scan TẮT'); recount(); }).catch(e=>toast('Lỗi: '+(e.code||e.message)));
        } else { if(D) D.autoScanEnabled=next; toast('Demo - '+(next?'bật':'tắt')); recount(); }
      };
    } else if(smb){ smb.style.display='none'; }""","""      /* v119-61: 1 chip trạng thái duy nhất (thay 2 chip "AUTO"/"API"), bấm mở mục Chấm điểm AI để bật/tắt & đổi phương thức */
      const lbl=!nickOk?'Thiếu nick quét':(autoOn?'Tự động':'Tạm dừng');
      const tip='Quét tự động '+(autoOn?'đang bật (3 phút/lượt)':'đang tắt')+' · phương thức '+m.label+(!nickOk?' · chưa có nick hoạt động':'')+' · bấm để cấu hình';
      const html=`<button type="button" class="chip ${!nickOk?'chip-hot':autoOn?'chip-cold':'chip-junk'} top-scan-chip" id="topScanChip" title="${esc(tip)}"><i class="dot${autoOn&&nickOk?' dot-live':''}"></i>${lbl} · ${esc(m.label)}</button>`;
      if(smb.__slHtml!==html){ smb.__slHtml=html; smb.innerHTML=html; document.getElementById('topScanChip').onclick=()=>go('scoring'); }
      smb.style.display='';
    } else if(smb){ smb.style.display='none'; }""",tag='F.topchip')

# ---------- G. 80: ẩn tiêu đề nhóm menu trống ----------
p='src/app/80-rbac-auth.js'
rep(p,"""    const grpCfg=document.getElementById('navGrpCfg'); // tiêu đề nhóm "Cấu hình" - ẩn luôn vì cả nhóm trống
    if(grpCfg) grpCfg.style.display = roleIsSuper()?'':'none';""","""    /* v119-61: menu 4 nhóm – tiêu đề nhóm tự ẩn khi mọi mục trong nhóm bị ẩn theo vai trò */
    document.querySelectorAll('.side-nav .side-group').forEach(g=>{ let n=g.nextElementSibling, vis=false; while(n&&!n.classList.contains('side-group')){ if(n.classList.contains('nav-item')&&n.style.display!=='none') vis=true; n=n.nextElementSibling; } g.style.display=vis?'':'none'; });""",tag='G.navgrp')

# ---------- H. CSS ----------
p='assets/css/app.css'
rep(p,".view { flex: 1; overflow-y: auto; padding: 8px clamp(16px, 3vw, 28px) 60px; scroll-behavior: smooth; }",".view { flex: 1; overflow-y: auto; padding: 8px clamp(16px, 3vw, 28px) 120px; scroll-behavior: smooth; } /* v119-61: đệm đáy ≥ nút chat + bong bóng → lớp nổi không che nội dung cuối trang */",tag='H.view')
rep(p,"  .view { padding: 12px 16px 44px; overflow: visible; }","  .view { padding: 12px 16px 120px; overflow: visible; }",tag='H.view-mobile')
rep(p,"  .view { padding-bottom: calc(84px + env(safe-area-inset-bottom)) !important; }","  .view { padding-bottom: calc(150px + env(safe-area-inset-bottom)) !important; } /* v119-61: thanh tab + nút chat */",tag='H.view-tabs')
s=rd(p); i=s.find('/* ============ HOTLINE (sidebar + floating) ============ */'); j=s.find('@media (min-width: 1024px) { .floating-hotline { display: none !important; } }')
assert i>0 and j>i
s=s[:i]+"@keyframes hotline-pulse { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(1.8); opacity: 0 } } /* v119-61: hotline nổi/sidebar đã gỡ (số máy ở Cài đặt tài khoản); keyframes còn dùng cho nút chat */\n\n"+s[j:]
wr(p,s)
rep(p,"@media (min-width: 1024px) { .floating-hotline { display: none !important; } }\n","",tag='H.hot1')
rrep(p,r"@media \(max-width: 639px\) \{\n  \.floating-hotline, \.floating-social \{ bottom: 12px; \}\n(?:  \.floating-hotline[^\n]*\n)+",'@media (max-width: 639px) {\n',tag='H.hot2')
s=rd(p); s='\n'.join(l for l in s.split('\n') if 'floating-hotline' not in l and 'sidebar-hotline' not in l); wr(p,s)
left=[l for l in s.split('\n') if 'hotline' in l and 'hotline-pulse' not in l]; assert not left, 'con hotline css: '+str(left[:5])
s=s.replace('.chip-brand,.badge-brand','.chip-brand,.badge-brand')
s+="""
/* ============ v119-61: dải trạng thái vận hành (Bảng điều khiển · Super Admin) ============ */
.ops-strip { display: flex; align-items: center; gap: 6px 22px; flex-wrap: wrap; padding: 10px 16px; margin-bottom: 14px; font-size: 12.5px; color: var(--ink-500); }
.ops-item { display: inline-flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; }
.ops-item b { color: var(--ink-900); font-weight: 600; }
.ops-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-300); flex: none; }
.ops-dot.on { background: var(--success); box-shadow: 0 0 0 3px var(--success-bg); }
.ops-dot.off { background: var(--hot); box-shadow: 0 0 0 3px var(--hot-bg); }
.ops-act { margin-left: auto; display: inline-flex; gap: 6px; }
@media (max-width: 639px) { .ops-strip { gap: 6px 14px; } .ops-act { margin-left: 0; width: 100%; } }
.top-scan-chip { cursor: pointer; font-size: 11px; }
.top-scan-chip:hover { filter: brightness(.97); }
"""
wr(p,s)

# ---------- I. live.js / data.js: bỏ D.integrations ----------
rep('assets/js/live.js',"    integrations:(window.SL_DATA&&window.SL_DATA.integrations)||[],\n","",tag='I.live')
p='assets/js/data.js'
cut(p,"  // Tích hợp nguồn dữ liệu / automation\n  const integrations = [","  ];\n\n",tag='I.data')
rep(p,"alerts, channels, integrations, stages","alerts, channels, stages",tag='I.data-ret')
rrep(p,r"    \{ id:'notion'[^\n]*\n    \{ id:'airtable'[^\n]*\n    \{ id:'crm'[^\n]*\n","",tag='I.data-chan')
rep(p,"    { id:'webhook', name:'Webhook tuỳ chỉnh', desc:'POST JSON tới endpoint của bạn', icon:'🔗', connected:true, color:'#6366f1' },","    { id:'webhook', name:'Webhook tuỳ chỉnh', desc:'POST JSON tới endpoint của bạn', icon:'🔗', connected:true, color:'#6366f1' }",tag='I.data-comma')

# ---------- icons.js: phone ----------
p='assets/js/icons.js'
rrep(p,r"(\n(\s*)mail:\s*s\()",r"\n\2phone: s('<path d=\"M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2.1Z\"/>'),\1",tag='icons.phone')

# ---------- J. smoke ----------
p='tools/smoke.js'
rep(p,"(tk.title === 'Hộp việc hôm nay')","(tk.title === 'Hộp việc')",tag='J.tasks')
rep(p,"=== 'Hộp việc hôm nay') ? ok('Mobile: bấm tab Việc → Hộp việc')","=== 'Hộp việc') ? ok('Mobile: bấm tab Việc → Hộp việc')",tag='J.mobile')
rep(p,"'history', 'scanned', 'integrations', 'users', 'account'","'history', 'scanned', 'users', 'account'",tag='J.views')
done()
