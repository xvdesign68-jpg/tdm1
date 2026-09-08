# m16.py <cây> — v119-74 / v120-esm-x (08/09, anh: "cho dòng 'Phát hiện…' xuống hẳn dòng thì đẹp hơn"). Áp lên cây đã qua m15 (v119-73 / v120-esm-w).
# Dòng thời gian 360°: (1) xếp DỌC — mốc giờ 1 dòng, nội dung dòng dưới (desktop giống mobile, hết cột giờ 108px bóp chữ);
# (2) icon thành cột riêng (flex) → chữ xuống dòng thẳng hàng, không thụt dưới icon; (3) mốc giờ gọn `tlWhen`: "Hôm nay 11:21" · "Hôm qua 09:05" ·
# "Ngày mai 07:30" · "03/09 14:20" (năm chỉ khi khác năm nay); (4) tên nguồn viết HOA toàn bộ (tên group Facebook) → `niceName` viết hoa đầu từ
# (viết tắt ≤3 chữ không nguyên âm như HCM/TP/BDS giữ nguyên, chỉ đổi khi ≥70% chữ cái là hoa), cắt 48 ký tự + "…", rê chuột thấy tên đầy đủ. + smoke check v119-74.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
M='src/app/65-charts-lead-modal.js'; C='assets/css/app.css'; S='tools/smoke.js'
rep(M, '''  function leadTimelineHtml(l){
    const ev=[]; const ms=t=>{ if(!t) return 0; if(typeof t==='number') return t; const d=parseTS(t); return d?d.getTime():0; };
    const push=(t,txt,cls,ic)=>{ const m=ms(t); if(m) ev.push({ms:m,txt,cls:cls||'',ic:ic||''}); };
    const m0=ms(l.detected_at||l.time);
    if(m0) push(m0,'Phát hiện lead từ '+(l.source||'nguồn')+(l.kind==='comment'?' (bình luận)':''),'sys',SLI.search);
    else ev.push({ms:0,label:String(l.time||''),txt:'Phát hiện lead từ '+(l.source||'nguồn'),cls:'sys',ic:SLI.search}); // dữ liệu demo/cũ chỉ có chuỗi giờ tương đối''',
'''  /* v119-74: mốc giờ gọn cho dòng thời gian - "Hôm nay 11:21" · "Hôm qua 09:05" · "Ngày mai 07:30" · "03/09 14:20" (thêm năm khi khác năm nay) */
  function tlWhen(ms){
    const d=new Date(ms); if(isNaN(d)) return '';
    const now=new Date(); const day0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
    const dd=Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()-day0)/86400e3);
    const p=n=>String(n).padStart(2,'0'); const hm=p(d.getHours())+':'+p(d.getMinutes());
    if(dd===0) return 'Hôm nay '+hm; if(dd===-1) return 'Hôm qua '+hm; if(dd===1) return 'Ngày mai '+hm;
    return p(d.getDate())+'/'+p(d.getMonth()+1)+(d.getFullYear()!==now.getFullYear()?'/'+d.getFullYear():'')+' '+hm;
  }
  /* v119-74: tên nguồn viết HOA toàn bộ (tên group Facebook) → viết hoa đầu từ để hiển thị (dữ liệu giữ nguyên); viết tắt ≤3 chữ không nguyên âm (HCM, TP, BDS) giữ nguyên - tiếng Việt nhiều từ 2-3 chữ (TẬP, VÀ) nên không dựa vào độ dài; chỉ đổi khi ≥70% chữ cái là hoa */
  function niceName(s){
    s=String(s||'').normalize('NFC'); let up=0,tot=0; for(const c of s){ if(c.toLowerCase()!==c.toUpperCase()){ tot++; if(c===c.toUpperCase()) up++; } }
    if(tot<8||up/tot<0.7) return s;
    const acro=w=>w.length<=3&&!/[aeiouy]/i.test(w.normalize('NFD').replace(/\\p{M}/gu,'')); // HCM, TP, BDS: ≤3 chữ KHÔNG nguyên âm = viết tắt, giữ nguyên (TẬP, VÀ, SPA → viết hoa đầu)
    return s.replace(/\\p{L}{2,}/gu,w=>(w===w.toUpperCase()&&!acro(w)?w.charAt(0)+w.slice(1).toLowerCase():w));
  }
  function leadTimelineHtml(l){
    const ev=[]; const ms=t=>{ if(!t) return 0; if(typeof t==='number') return t; const d=parseTS(t); return d?d.getTime():0; };
    const push=(t,txt,cls,ic,tip)=>{ const m=ms(t); if(m) ev.push({ms:m,txt,cls:cls||'',ic:ic||'',tip:tip||''}); };
    const m0=ms(l.detected_at||l.time);
    const srcFull=niceName(l.source||'nguồn'); const srcShort=srcFull.length>48?srcFull.slice(0,47).replace(/\\s+\\S*$/,'')+'…':srcFull; // v119-74: tên nguồn gọn 1 dòng, đủ tên khi rê chuột
    if(m0) push(m0,'Phát hiện lead từ '+srcShort+(l.kind==='comment'?' (bình luận)':''),'sys',SLI.search,srcShort!==srcFull?srcFull:'');
    else ev.push({ms:0,label:String(l.time||''),txt:'Phát hiện lead từ '+srcShort,cls:'sys',ic:SLI.search,tip:srcShort!==srcFull?srcFull:''}); // dữ liệu demo/cũ chỉ có chuỗi giờ tương đối''', tag='tl.js')
rep(M, '''<span class="ld-tl-t">${esc(e.ms?fmtWhen(e.ms,true):(e.label||''))}</span><span class="ld-tl-x">${e.ic?'<i class="ld-tl-ic">'+e.ic+'</i>':''}${esc(e.txt)}</span></div>''',
'''<span class="ld-tl-t">${esc(e.ms?tlWhen(e.ms):(e.label||''))}</span><span class="ld-tl-x"${e.tip?' title="'+esc(e.tip)+'"':''}>${e.ic?'<i class="ld-tl-ic">'+e.ic+'</i>':''}<span class="ld-tl-tx">${esc(e.txt)}</span></span></div>''', tag='tl.render')
rep(C, '.ld-tl-list { margin-top: 8px; padding-left: 22px; display: grid; gap: 6px; max-height: 260px; overflow-y: auto; }',
       '.ld-tl-list { margin-top: 8px; padding-left: 22px; display: grid; gap: 9px; max-height: 330px; overflow-y: auto; }', tag='css.list')
rep(C, '.ld-tl-i { position: relative; font-size: 12.5px; display: flex; gap: 10px; align-items: baseline; }',
       '.ld-tl-i { position: relative; font-size: 12.5px; display: block; } /* v119-74: xếp dọc - giờ trên, nội dung dưới (desktop giống mobile) */', tag='css.item')
rep(C, '.ld-tl-i::before { content: ""; position: absolute; left: -17px; top: 5px;', '.ld-tl-i::before { content: ""; position: absolute; left: -17px; top: 4px;', tag='css.dot')
rep(C, '.ld-tl-i::after { content: ""; position: absolute; left: -14px; top: 13px; bottom: -8px; width: 2px; background: var(--hairline); }',
       '.ld-tl-i::after { content: ""; position: absolute; left: -14px; top: 12px; bottom: -11px; width: 2px; background: var(--hairline); }', tag='css.line')
rep(C, '.ld-tl-t { flex: none; font-family: var(--font-mono, monospace); font-size: 11px; color: var(--ink-400); min-width: 108px; }',
       '.ld-tl-t { display: block; font-family: var(--font-mono, monospace); font-size: 11px; color: var(--ink-400); margin-bottom: 2px; font-variant-numeric: tabular-nums; }', tag='css.time')
rep(C, '.ld-tl-x { color: var(--ink-700); }',
       '.ld-tl-x { color: var(--ink-700); display: flex; gap: 6px; align-items: flex-start; } /* v119-74: icon cột riêng → chữ xuống dòng thẳng hàng */\n.ld-tl-ic { flex: none; margin-top: 2px; }\n.ld-tl-tx { min-width: 0; }', tag='css.text')
rep(C, '.ld-tl-ic .i { width: 13px; height: 13px; color: var(--ink-400); margin-right: 5px; vertical-align: -.15em; }',
       '.ld-tl-ic .i { width: 13px; height: 13px; color: var(--ink-400); display: block; }', tag='css.icon')
rep(C, '@media (max-width: 639px) { .cs-2col { grid-template-columns: 1fr; } .ld-tl-i { flex-direction: column; gap: 2px; } }',
       '@media (max-width: 639px) { .cs-2col { grid-template-columns: 1fr; } }', tag='css.mobile')
rep(S, '''  await page.click('#feedList .lead-card [data-chatbox]'); await page.waitForTimeout(400);''',
'''  const srcBak = await page.evaluate(() => { const id = document.querySelector('#feedList .lead-card').dataset.lead; const l = window.SL_DATA.leads.find(x => String(x.id) === id); const b = l.source; l.source = 'TUYỂN DỤNG THỰC TẬP SINH DIGITAL MARKETING (Google, Facebook,TikTok..)'; return b; }); /* v119-74: tên nguồn HOA để kiểm niceName */
  await page.click('#feedList .lead-card [data-chatbox]'); await page.waitForTimeout(400);''', tag='smoke.src')
rep(S, '''  (d2b.fu && /không nghe máy/i.test(d2b.note)) ? ok('Kết quả liên hệ "Không nghe máy" → tự hẹn lại 4h + ghi chú hệ thống') : fail('Kết quả liên hệ sai: ' + JSON.stringify(d2b));''',
'''  (d2b.fu && /không nghe máy/i.test(d2b.note)) ? ok('Kết quả liên hệ "Không nghe máy" → tự hẹn lại 4h + ghi chú hệ thống') : fail('Kết quả liên hệ sai: ' + JSON.stringify(d2b));
  /* v119-74: dòng thời gian xếp dọc + giờ gọn + tên nguồn HOA → viết hoa đầu từ, cắt gọn */
  const t74 = await page.evaluate(() => { const items = Array.from(document.querySelectorAll('#modal .ld-tl-i')); const ts = items.map(i => i.querySelector('.ld-tl-t').textContent.trim());
    const rel = ts.filter(t => /^(Hôm nay|Hôm qua|Ngày mai) \\d\\d:\\d\\d$/.test(t)).length, old = ts.filter(t => /\\d\\d:\\d\\d\\s*·\\s*\\d\\d\\/\\d\\d\\/\\d{4}/.test(t)).length;
    const stacked = items.every(i => { const a = i.querySelector('.ld-tl-t').getBoundingClientRect(), b = i.querySelector('.ld-tl-x').getBoundingClientRect(); return a.bottom <= b.top + 1 && Math.abs(a.left - b.left) < 2; });
    const iconCol = items.every(i => { const ic = i.querySelector('.ld-tl-ic'), tx = i.querySelector('.ld-tl-tx'); return !ic || (tx && tx.getBoundingClientRect().left >= ic.getBoundingClientRect().right + 3); });
    const src = items.find(i => /Phát hiện lead/.test(i.textContent)); const sx = src ? src.querySelector('.ld-tl-x') : null;
    return { n: items.length, rel, old, stacked, iconCol, srcTxt: sx ? sx.textContent.trim() : '', tip: sx ? (sx.getAttribute('title') || '') : '' }; });
  (t74.n >= 2 && t74.rel >= 1 && t74.old === 0 && t74.stacked && t74.iconCol && /^Phát hiện lead từ Tuyển Dụng Thực Tập Sinh Digital Marketing…/.test(t74.srcTxt) && /\\(Google, Facebook,TikTok\\.\\.\\)$/.test(t74.tip)) ? ok('v119-74: dòng thời gian xếp dọc (' + t74.n + ' mốc, giờ gọn "Hôm nay hh:mm" ' + t74.rel + ', hết "hh:mm · dd/mm/yyyy") · icon cột riêng · nguồn HOA → "Tuyển Dụng Thực Tập Sinh Digital Marketing…" + tooltip đủ tên') : fail('v119-74 timeline: ' + JSON.stringify(t74));
  await page.evaluate((b) => { const id = document.querySelector('#feedList .lead-card').dataset.lead; const l = window.SL_DATA.leads.find(x => String(x.id) === id); l.source = b; }, srcBak);''', tag='smoke.v119-74')
done()
