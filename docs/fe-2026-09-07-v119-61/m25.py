# m25.py <cây> — v119-83 / v120-esm-ag (09/09/2026 trưa, anh gửi ảnh Pipeline "Việc cần chú ý · 488 việc hôm nay" = bức tường 488 tên:
# "trong trường hợp số liệu thông tin phần này nhiều quá thì có cách nào hiển thị thật thông minh tiện lợi hơn được không").
# Trước: khối liệt kê TỪNG lead kẹt nối bằng dấu phẩy ("Hoà Nguyễn (72) kẹt 7 ngày ở Lead mới, …") → 488 lead = 30 dòng chữ, không đọc được, không bấm được.
# Sau: GOM NHÓM — mỗi nhóm 1 dòng = số đếm đậm + câu việc cần làm + 3 lead điểm cao nhất (chip bấm mở modal) + nút Lọc thu hẹp đúng nhóm:
#   (1) 🔴 kẹt ở giai đoạn ĐANG CHĂM (khách đã tương tác — ưu tiên trước) · (2) 🟠 nằm ở Mới quá N ngày chưa ai chăm, chia BẬC TUỔI 7–9 / 10–13 / ≥14 ngày
#   (chip bấm = lọc đúng bậc; chip bộ lọc "Đang kẹt" đổi nhãn "Kẹt · ≥14 ngày ở Mới") · (3) ⚪ trùng mẫu spam + Loại ngay như cũ.
# State `pvStuckSel {scope:new|care, min, max}` thu hẹp pvFilters.stuck; bấm chip bộ lọc bất kỳ → bỏ thu hẹp. Áp lên cây v119-82 / v120-esm-af (sau m24).
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
P='src/app/30-pipeline.js'; C='assets/css/pipeline-v2.css'; S='tools/smoke.js'

# ---------- state + bộ lọc "Đang kẹt" thu hẹp được ----------
rep(P, """  const PV_NEW_IDLE_DAYS=7; // v119-80: lead nằm ở cột Mới quá N ngày chưa ai chăm = kẹt (trước: cột Mới không bao giờ bị coi là kẹt, lead 90 ngày vẫn "bình thường")
""", """  const PV_NEW_IDLE_DAYS=7; // v119-80: lead nằm ở cột Mới quá N ngày chưa ai chăm = kẹt (trước: cột Mới không bao giờ bị coi là kẹt, lead 90 ngày vẫn "bình thường")
  let pvStuckSel=null; /* v119-83: thu hẹp bộ lọc "Đang kẹt" từ khối Việc cần chú ý — {scope:'new'|'care', min, max} (ngày kẹt); null = mọi lead kẹt */
  function pvStuckDesc(){ const q=pvStuckSel; if(!q) return ''; if(q.scope==='care') return 'đang chăm'; const N=PV_NEW_IDLE_DAYS; return (q.max==null ? (q.min>N?'≥'+q.min+' ngày ':'') : q.min+'–'+q.max+' ngày ')+'ở Mới'; }
""", tag='pipe.state')
rep(P, """    stuck: l => !!pvOf(l).stuck,
""", """    stuck: l => { const s=pvOf(l).stuck; if(!s) return false; const q=pvStuckSel; if(!q) return true; if(q.scope==='new'&&l.stage!=='new') return false; if(q.scope==='care'&&l.stage==='new') return false; return s>=(q.min||0)&&(q.max==null||s<=q.max); }, // v119-83
""", tag='pipe.filter')
rep(P, """    let s=(pipeFilter||'')+'|'+(D.leads||[]).length+'|';""",
       """    let s=(pipeFilter||'')+'|'+(pvStuckSel?JSON.stringify(pvStuckSel):'')+'|'+(D.leads||[]).length+'|';""", tag='pipe.sig')

# ---------- chip bộ lọc đổi nhãn khi thu hẹp ----------
rep(P, """      .map(([k,lb])=>`<button data-pf="${k}" class="${k===pipeFilter?'active':''}">${lb} <i>${PL.filter(pvFilters[k]).length}</i></button>`).join('');""",
       """      .map(([k,lb])=>`<button data-pf="${k}" class="${k===pipeFilter?'active':''}">${(k==='stuck'&&pvStuckSel)?'Kẹt · '+pvStuckDesc():lb} <i>${PL.filter(pvFilters[k]).length}</i></button>`).join(''); // v119-83: "Đang kẹt" → "Kẹt · ≥14 ngày ở Mới" khi thu hẹp từ khối Việc cần chú ý""", tag='pipe.chips')

# ---------- khối Việc cần chú ý: gom nhóm ----------
rep(P, """    const top = `<div class="pv2-top">
      ${(stuckLeads.length||junkLeads.length)?`<div class="card pv2-insight">
        <div class="pv2-ihead"><span class="ic">${PV2I.bolt}</span><b>Việc cần chú ý</b><span class="mut">· ${stuckLeads.length+junkLeads.length} việc hôm nay</span></div>
        ${stuckLeads.length?`<div class="pv2-irow"><span class="dot warn"></span><span class="tx">${stuckLeads.map(l=>'<b>'+esc(l.name)+' ('+l.score+')</b> kẹt '+pvOf(l).age+' ở '+(stageLabel[l.stage]||l.stage)).join(', ')} – xử lý trong hôm nay (lead ở Mới quá ${PV_NEW_IDLE_DAYS} ngày: kiểm tra rồi tiếp cận hoặc loại).</span><button class="lnk" id="pvStuck">Lọc lead kẹt</button></div>`:''}
        ${junkLeads.length?`<div class="pv2-irow"><span class="dot junk"></span><span class="tx">${junkLeads.map(l=>'<b>'+esc(l.name)+' ('+l.score+')</b>').join(', ')} trùng mẫu spam – đề xuất loại khỏi pipeline.</span><button class="lnk danger" id="pvDropJunk">Loại ngay</button></div>`:''}
      </div>`:''}""",
"""    /* v119-83: khối "Việc cần chú ý" GOM NHÓM thay vì liệt kê từng lead (488 tên = bức tường chữ không đọc/không bấm được):
       mỗi nhóm 1 dòng = số đếm + việc cần làm + 3 lead điểm cao nhất (chip bấm mở) + nút Lọc thu hẹp đúng nhóm; lead ở Mới chia bậc tuổi 7–9 / 10–13 / ≥14 ngày (chip bấm = lọc đúng bậc) */
    const byScore=(a,b)=>(Number(b.score)||0)-(Number(a.score)||0);
    const nmChips=(arr,n,more)=>arr.slice(0,n).map(l=>`<button type="button" class="pv2-nm" data-lead="${esc(String(l.id))}" title="Mở lead">${esc(l.name)} <i>${Number(l.score)||0}</i></button>`).join('')+((more&&arr.length>n)?`<span class="pv2-more">+${arr.length-n} khác</span>`:'');
    const stuckCare=stuckLeads.filter(l=>l.stage!=='new').sort(byScore), stuckNew=stuckLeads.filter(l=>l.stage==='new').sort(byScore);
    const NI=PV_NEW_IDLE_DAYS, BK=[[NI,NI+2],[NI+3,2*NI-1],[2*NI,null]];
    const bkChips=BK.map(([mn,mx])=>{ const c=stuckNew.filter(l=>{ const s=pvOf(l).stuck; return s>=mn&&(mx==null||s<=mx); }).length; if(!c) return ''; const on=!!(pvStuckSel&&pvStuckSel.scope==='new'&&pvStuckSel.min===mn&&(pvStuckSel.max==null)===(mx==null));
      return `<button type="button" class="pv2-bk${on?' on':''}" data-pv-stuck="new" data-pv-min="${mn}"${mx!=null?` data-pv-max="${mx}"`:''} title="Chỉ hiện lead ở Mới kẹt ${mx==null?'từ '+mn:mn+'–'+mx} ngày">${mx==null?'≥'+mn:mn+'–'+mx} ngày <i>${c}</i></button>`; }).join('');
    const careOn=!!(pvStuckSel&&pvStuckSel.scope==='care'), newOn=!!(pvStuckSel&&pvStuckSel.scope==='new'&&pvStuckSel.min===NI&&pvStuckSel.max==null);
    const top = `<div class="pv2-top">
      ${(stuckLeads.length||junkLeads.length)?`<div class="card pv2-insight">
        <div class="pv2-ihead"><span class="ic">${PV2I.bolt}</span><b>Việc cần chú ý</b><span class="mut">· ${stuckLeads.length+junkLeads.length} việc hôm nay</span></div>
        ${stuckCare.length?`<div class="pv2-irow"><span class="dot hot"></span><span class="tx"><b class="n">${stuckCare.length}</b> lead kẹt ở giai đoạn đang chăm – khách đã tương tác, xử lý trước: ${nmChips(stuckCare,3,true)}</span><button type="button" class="lnk${careOn?' on':''}" data-pv-stuck="care">Lọc</button></div>`:''}
        ${stuckNew.length?`<div class="pv2-irow"><span class="dot warn"></span><span class="tx"><b class="n">${stuckNew.length}</b> lead nằm ở Mới quá ${NI} ngày chưa ai chăm – kiểm tra rồi tiếp cận hoặc loại. Theo tuổi: ${bkChips} · điểm cao nhất: ${nmChips(stuckNew,3,false)}</span><button type="button" class="lnk${newOn?' on':''}" id="pvStuck" data-pv-stuck="new" data-pv-min="${NI}">Lọc lead kẹt</button></div>`:''}
        ${junkLeads.length?`<div class="pv2-irow"><span class="dot junk"></span><span class="tx"><b class="n">${junkLeads.length}</b> lead trùng mẫu spam – đề xuất loại khỏi pipeline: ${nmChips(junkLeads.slice().sort(byScore),3,true)}</span><button type="button" class="lnk danger" id="pvDropJunk">Loại ngay</button></div>`:''}
      </div>`:''}""", tag='pipe.insight')

# ---------- bind: chip bộ lọc bỏ thu hẹp · nút/bậc Lọc · tên lead mở modal ----------
rep(P, """    root.querySelectorAll('#pvSeg button').forEach(b=>b.addEventListener('click',()=>{ pipeFilter=b.dataset.pf; pvColMore.clear(); views.pipeline(); })); // v170: đổi bộ lọc → cột dài quay về cap 50
    const btnStuck = root.querySelector('#pvStuck');
    if(btnStuck) btnStuck.addEventListener('click',()=>{ pipeFilter='stuck'; views.pipeline(); });""",
"""    root.querySelectorAll('#pvSeg button').forEach(b=>b.addEventListener('click',()=>{ pipeFilter=b.dataset.pf; pvStuckSel=null; pvColMore.clear(); views.pipeline(); })); // v170: đổi bộ lọc → cột dài quay về cap 50 · v119-83: bỏ thu hẹp
    /* v119-83: nút Lọc / chip bậc tuổi trong khối Việc cần chú ý → bộ lọc "Đang kẹt" thu hẹp đúng nhóm; chip tên lead → mở modal */
    root.querySelectorAll('[data-pv-stuck]').forEach(b=>b.addEventListener('click',()=>{ const sc=b.dataset.pvStuck, mn=b.dataset.pvMin!=null?+b.dataset.pvMin:0, mx=b.dataset.pvMax!=null?+b.dataset.pvMax:null;
      pvStuckSel={scope:sc,min:mn,max:mx}; pipeFilter='stuck'; pvColMore.clear(); views.pipeline(); }));
    root.querySelectorAll('.pv2-nm[data-lead]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); openLead(b.dataset.lead); }));""", tag='pipe.bind')

# ---------- CSS ----------
rep(C, """.pv2-irow .lnk.danger { color: var(--danger); }
""", """.pv2-irow .lnk.danger { color: var(--danger); }
/* v119-83: khối Việc cần chú ý gom nhóm — số đếm đậm, chip tên lead (bấm mở), chip bậc tuổi (bấm lọc) */
.pv2-irow { align-items: flex-start; }
.pv2-irow .dot { margin-top: 6px; }
.pv2-irow .dot.hot { background: var(--hot); box-shadow: 0 0 0 3px var(--hot-bg); }
.pv2-irow .tx { flex: 1; min-width: 0; }
.pv2-irow .lnk { margin-top: 2px; }
.pv2-irow .lnk.on { text-decoration: underline; }
.pv2-irow .tx .n { font-family: var(--font-head); font-weight: 700; font-size: 13.5px; color: var(--ink-900); font-variant-numeric: tabular-nums; }
.pv2-nm, .pv2-bk { display: inline-flex; align-items: center; gap: 4px; margin: 1px 3px 1px 0; padding: 1px 8px; border-radius: var(--r-full); border: 1px solid var(--border); background: var(--surface); font: inherit; font-size: 12px; font-weight: 600; color: var(--ink-800); cursor: pointer; line-height: 1.5; vertical-align: middle; }
.pv2-nm i, .pv2-bk i { font-style: normal; font-family: var(--font-head); font-weight: 700; font-size: 11px; color: var(--ink-500); font-variant-numeric: tabular-nums; }
.pv2-nm:hover, .pv2-bk:hover { border-color: var(--brand-300); color: var(--brand-700); background: var(--brand-50); }
.pv2-bk.on { border-color: var(--brand-600); background: var(--brand-50); color: var(--brand-700); }
.pv2-bk.on i { color: var(--brand-700); }
.pv2-more { font-size: 12px; color: var(--ink-400); margin-left: 2px; }
""", tag='css.insight')

# ---------- smoke: k80 mốc mới + check v119-83 ----------
rep(S, "return { cs, stuck0, stuck1, insName: ins.includes(l.name), flbl }; });",
       "return { cs, stuck0, stuck1, insName: /lead nằm ở Mới quá 7 ngày/.test(ins), flbl }; });", tag='smoke.k80')
rep(S, """: fail('v119-80 KPI/pipeline: ' + JSON.stringify(k80));
""", """: fail('v119-80 KPI/pipeline: ' + JSON.stringify(k80));
  /* v119-83: khối "Việc cần chú ý" gom nhóm — số đếm + 3 lead điểm cao (chip bấm mở modal) + bậc tuổi bấm lọc đúng bậc, thay bức tường tên */
  const k83 = await page.evaluate(() => { const D = window.SL_DATA; const now = Date.now(); const L0 = D.leads;
    const mk = (id, name, score, stage, days) => { const iso = new Date(now - days * 864e5).toISOString(); const o = { id, name, score, temp: score >= 80 ? 'hot' : 'warm', stage, brand: (D.myBrand && D.myBrand.code) || '', detected_at: iso, time: iso, text: '', source: 'x', assignee: '' }; if (stage !== 'new') o.stage_at = now - days * 864e5; return o; };
    const fake = [mk('K83a', 'K83 Care', 91, 'responded', 4), mk('K83b', 'K83 New8', 88, 'new', 8), mk('K83c', 'K83 New11', 70, 'new', 11), mk('K83d', 'K83 New20', 66, 'new', 20)];
    D.leads = fake.concat(L0); location.hash = 'pipeline'; window.SLApp.reload(D);
    const ins = document.querySelector('#view .pv2-insight'); const rows = ins ? [...ins.querySelectorAll('.pv2-irow')] : [];
    const care = rows.find(x => x.querySelector('.dot.hot')), nw = rows.find(x => x.querySelector('.dot.warn'));
    const r = { rows: rows.length, careN: care ? +care.querySelector('.n').textContent : -1, careHas: !!(care && [...care.querySelectorAll('.pv2-nm')].some(b => /K83 Care/.test(b.textContent))), newN: nw ? +nw.querySelector('.n').textContent : -1,
      bk: nw ? [...nw.querySelectorAll('.pv2-bk')].map(b => b.textContent.replace(/\\s+/g, ' ').trim()) : [], names: nw ? nw.querySelectorAll('.pv2-nm').length : -1, len: ins ? ins.textContent.length : -1 };
    const b14 = nw && [...nw.querySelectorAll('.pv2-bk')].find(b => /≥14/.test(b.textContent)); if (b14) b14.click();
    const cards = [...document.querySelectorAll('#view .kcard')].map(c => c.dataset.lead); r.after14 = { has20: cards.includes('K83d'), has8: cards.includes('K83b'), chip: ((document.querySelector('#view [data-pf="stuck"]') || {}).textContent || '').replace(/\\s+/g, ' ').trim(), on: !!document.querySelector('#view .pv2-bk.on') };
    const nm = document.querySelector('#view .pv2-insight .pv2-nm[data-lead="K83a"]'); if (nm) nm.click(); const mb = document.getElementById('modalBg'); r.modal = !!(mb && mb.classList.contains('show')); if (r.modal) mb.classList.remove('show');
    document.querySelector('#view [data-pf="all"]').click(); D.leads = L0; location.hash = 'overview'; window.SLApp.reload(D); return r; });
  await page.waitForTimeout(200);
  (k83.rows >= 2 && k83.careN >= 1 && k83.careHas && k83.newN >= 3 && k83.bk.length === 3 && /^7–9 ngày \\d+$/.test(k83.bk[0]) && /^10–13 ngày \\d+$/.test(k83.bk[1]) && /^≥14 ngày \\d+$/.test(k83.bk[2]) && k83.names === 3 && k83.len < 1200 && k83.after14.has20 && !k83.after14.has8 && k83.after14.on && /^Kẹt · ≥14 ngày ở Mới \\d+$/.test(k83.after14.chip) && k83.modal)
    ? ok('v119-83: Việc cần chú ý gom nhóm — đang chăm ' + k83.careN + ' (chip tên mở modal) · ở Mới ' + k83.newN + ' theo bậc ' + k83.bk.join(' / ') + ' · bấm ≥14 ngày → chỉ còn lead 20 ngày, bộ lọc "' + k83.after14.chip + '" · khối ' + k83.len + ' ký tự') : fail('v119-83 insight: ' + JSON.stringify(k83));
""", tag='smoke.v119-83')
done()
