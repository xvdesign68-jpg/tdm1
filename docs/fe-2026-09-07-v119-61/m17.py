# m17.py <cây> — v119-75 / v120-esm-y (08/09, anh: "cải tiến giao diện card Hôm nay đẹp hơn"). Áp lên cây đã qua m16 (v119-74 / v120-esm-x).
# Card "Hôm nay" (Overview): ô số từ "hộp trắng viền trái 3px, số màu, chữ 11.5px" → ô có icon trong chip màu nhạt (30px) · số 26px mono đậm màu mực ·
# nhãn 12px; màu chỉ nằm ở chip icon (hết 7 màu "cầu vồng"); ô = 0 → chip xám, số mờ; 2 ô cảnh báo (Nóng chưa ai chăm, Quá hẹn) khi >0 → nền nhạt màu
# + số màu (nhìn là thấy việc gấp). Tiêu đề: ngày riêng, số việc thành pill đỏ (siren) / xanh "Không có việc tồn" cạnh nút Hộp việc.
# Mobile: 2 cột, ô lẻ cuối trải 2 cột (hết ô mồ côi), hàng pill + nút xuống dòng riêng. + smoke check v119-75. Fail-closed nguyên tử.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
F='src/app/20-feed.js'; C='assets/css/app.css'; P='assets/css/pipeline-v2.css'; S='tools/smoke.js'
rep(F, '''    const tile=(key,n,lbl,color,hint)=>`<button class="td-tile${n?'':' zero'}" data-td="${key}" style="--tc:${color}" title="${esc(hint||'')}"><b class="mono">${fmt(n)}</b><span>${lbl}</span></button>`;
    const total=T.overdue.length+T.dueToday.length+T.replied.length+T.hotUncared.length+(roleCanEditConfig()?T.unassigned.length:0);
    return `<div class="card td-card" style="margin-bottom:14px">
      <div class="td-head"><div><h3>Hôm nay</h3><div class="sub">${new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit'})} · ${total?`<b style="color:var(--hot)">${fmt(total)} việc cần làm ngay</b>`:'<b style="color:var(--success)">không có việc tồn – tốt!</b>'}</div></div>
        <button class="btn btn-soft btn-sm" data-go="tasks">Hộp việc →</button></div>
      <div class="td-grid">
        ${tile('new',T.newToday.length,'Lead mới hôm nay','var(--brand-600)','Lead hệ thống phát hiện từ 0h hôm nay')}
        ${tile('hot',T.hotUncared.length,'Nóng chưa ai chăm','var(--hot)','Lead nóng còn mở, chưa giao & chưa ai chăm')}
        ${roleCanEditConfig()?tile('unassigned',T.unassigned.length,'Chưa giao','#7C3AED','Lead nóng/ấm chưa có người phụ trách'):''}
        ${tile('overdue',T.overdue.length,'Quá hẹn','#d92d20','Hẹn chăm đã trôi qua mà chưa xử lý')}
        ${tile('due',T.dueToday.length,'Hẹn hôm nay','#b45309','Lịch hẹn chăm trong ngày')}
        ${tile('replied',T.replied.length,'Khách đã phản hồi','#0f7b3d','Khách trả lời – người thật tiếp quản ngay')}
        ${tile('closed',T.closedToday.length,'Chốt hôm nay','var(--success)','Deal chốt từ 0h hôm nay')}
      </div></div>`;''',
'''    /* v119-75: ô có chip icon màu nhạt, số mực đậm, màu chỉ ở chip; ô cảnh báo (alert) >0 → nền nhạt + số màu; =0 → mờ */
    const tile=(key,n,lbl,ic,color,bg,hint,alert)=>`<button class="td-tile${n?'':' zero'}${(alert&&n)?' alert':''}" data-td="${key}" style="--tc:${color};--tb:${bg}" title="${esc(hint||'')}"><i class="td-ic">${ic}</i><b class="mono">${fmt(n)}</b><span>${lbl}</span></button>`;
    const total=T.overdue.length+T.dueToday.length+T.replied.length+T.hotUncared.length+(roleCanEditConfig()?T.unassigned.length:0);
    return `<div class="card td-card" style="margin-bottom:14px">
      <div class="td-head"><div><h3>Hôm nay</h3><div class="sub">${new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit'})}</div></div>
        <div class="td-head-r">${total?`<span class="td-pill hot">${SLI.siren} ${fmt(total)} việc cần làm ngay</span>`:`<span class="td-pill ok">${SLI.checkCircle} Không có việc tồn</span>`}<button class="btn btn-soft btn-sm" data-go="tasks">Hộp việc →</button></div></div>
      <div class="td-grid">
        ${tile('new',T.newToday.length,'Lead mới hôm nay',SLI.sparkle,'var(--brand-600)','var(--brand-50)','Lead hệ thống phát hiện từ 0h hôm nay')}
        ${tile('hot',T.hotUncared.length,'Nóng chưa ai chăm',SLI.flame,'var(--hot)','#FEF2F2','Lead nóng còn mở, chưa giao & chưa ai chăm',true)}
        ${roleCanEditConfig()?tile('unassigned',T.unassigned.length,'Chưa giao',SLI.users,'#7C3AED','#F3EEFE','Lead nóng/ấm chưa có người phụ trách'):''}
        ${tile('overdue',T.overdue.length,'Quá hẹn',SLI.warning,'#d92d20','#FEF2F2','Hẹn chăm đã trôi qua mà chưa xử lý',true)}
        ${tile('due',T.dueToday.length,'Hẹn hôm nay',SLI.clock,'#b45309','#FEF6E7','Lịch hẹn chăm trong ngày')}
        ${tile('replied',T.replied.length,'Khách đã phản hồi',SLI.message,'#0f7b3d','#ECFDF3','Khách trả lời – người thật tiếp quản ngay')}
        ${tile('closed',T.closedToday.length,'Chốt hôm nay',SLI.handshake,'var(--success)','#ECFDF3','Deal chốt từ 0h hôm nay')}
      </div></div>`;''', tag='today.html')
rrep(C, r'^\.td-grid \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(128px, 1fr\)\); gap: 10px; padding: 8px 22px 20px; \}$',
        '.td-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(136px, 1fr)); gap: 10px; padding: 6px 22px 20px; }', tag='css.grid', flags=re.M)
rrep(C, r'^\.td-tile \{ display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 14px; border: 1px solid var\(--hairline, rgba\(16,18,35,\.07\)\); border-left: 3px solid var\(--tc\); border-radius: 12px; background: #fff; cur[^\n]*$',
        '.td-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 0; padding: 13px 14px 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); cursor: pointer; text-align: left; font: inherit; transition: transform var(--dur-3) var(--spring), box-shadow var(--dur-3) var(--ease), border-color var(--dur-3) var(--ease), background var(--dur-3) var(--ease); } /* v119-75 */', tag='css.tile', flags=re.M)
rep(C, '.td-tile:hover { transform: translateY(-2px); box-shadow: var(--sh-md); }',
       '.td-tile:hover { transform: translateY(-2px); box-shadow: var(--sh-md); border-color: var(--tc); }', tag='css.hover')
rep(C, '.td-tile b { font-size: 22px; font-weight: 800; color: var(--tc); line-height: 1.1; }',
       '.td-tile .td-ic { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; background: var(--tb); color: var(--tc); margin-bottom: 10px; }\n'
       '.td-tile .td-ic .i { width: 16px; height: 16px; }\n'
       '.td-tile b { font-size: 26px; font-weight: 700; color: var(--ink-900); line-height: 1; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }', tag='css.num')
rep(C, '.td-tile span { font-size: 11.5px; color: var(--ink-500); font-weight: 600; }',
       '.td-tile span { font-size: 11.5px; color: var(--ink-500); font-weight: 600; margin-top: 5px; line-height: 1.3; }', tag='css.lbl')
rep(C, '.td-tile.zero b { color: var(--ink-300); }',
       '.td-tile.zero b { color: var(--ink-300); }\n'
       '.td-tile.zero .td-ic { background: var(--ink-50); color: var(--ink-400); }\n'
       '.td-tile.alert { background: var(--tb); border-color: transparent; } .td-tile.alert b { color: var(--tc); } .td-tile.alert .td-ic { background: #fff; }\n'
       '.td-head-r { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }\n'
       '.td-pill { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-family: var(--font-head); font-size: 12px; font-weight: 700; white-space: nowrap; }\n'
       '.td-pill .i { width: 13px; height: 13px; }\n'
       '.td-pill.hot { background: #FEF2F2; color: var(--hot); } .td-pill.ok { background: #ECFDF3; color: var(--success); }', tag='css.extra')
rep(P, '  .td-grid { grid-template-columns: repeat(2, 1fr); padding: 8px 14px 16px; }',
       '  .td-grid { grid-template-columns: repeat(2, 1fr); padding: 6px 14px 16px; } .td-tile:last-child:nth-child(odd) { grid-column: span 2; } .td-head-r { width: 100%; justify-content: space-between; } /* v119-75: ô lẻ cuối trải 2 cột, pill + nút hàng riêng */', tag='css.mobile')
rep(S, '''  await page.click('.td-tile[data-td="new"]'); await page.waitForTimeout(500);''',
'''  /* v119-75: card Hôm nay - chip icon, pill số việc, ô cảnh báo, ô 0 mờ */
  const td75 = await page.evaluate(() => { const c = document.querySelector('.td-card'); const tiles = Array.from(c.querySelectorAll('.td-tile')); const pill = c.querySelector('.td-pill');
    const ic = tiles.every(t => t.querySelector('.td-ic svg') && t.querySelector('b.mono')); const zero = tiles.filter(t => t.classList.contains('zero')); const z = zero.length ? getComputedStyle(zero[0].querySelector('b')).color : ''; const nz = tiles.find(t => !t.classList.contains('zero')); const nzc = nz ? getComputedStyle(nz.querySelector('b')).color : '';
    const alert = tiles.filter(t => t.classList.contains('alert')); const alertOk = alert.every(t => !t.classList.contains('zero') && getComputedStyle(t).backgroundColor !== 'rgb(255, 255, 255)');
    return { n: tiles.length, ic, pill: pill ? pill.textContent.trim() : '', pillCls: pill ? pill.className : '', zeroN: zero.length, z, nzc, alertN: alert.length, alertOk, subHasCount: /việc/.test((c.querySelector('.td-head .sub') || {}).textContent || '') }; });
  (td75.n === 7 && td75.ic && /việc cần làm ngay$|Không có việc tồn$/.test(td75.pill) && /td-pill (hot|ok)/.test(td75.pillCls) && td75.alertOk && !td75.subHasCount && (!td75.zeroN || td75.z !== td75.nzc)) ? ok('v119-75: card Hôm nay - 7 ô có chip icon + số mono · pill "' + td75.pill + '" · ' + td75.alertN + ' ô cảnh báo nền màu · ' + td75.zeroN + ' ô 0 mờ') : fail('v119-75 today card: ' + JSON.stringify(td75));
  await page.click('.td-tile[data-td="new"]'); await page.waitForTimeout(500);''', tag='smoke.v119-75')
done()
