# m35.py <cây> — v119-93 / v120-esm-aq (13/09/2026): zip FE đi cùng LỆNH G (PC-3 "bộ nhớ người viết" author_memory). Áp lên cây v119-92 / v120-esm-ap (cùng script, tự nhận ESM). DRY=1 để kiểm mốc.
#   - Chip "Khách cũ quay lại · đã chốt/đã hẹn/đã phản hồi" (lead.returning — scanner đặt khi author_memory nói brand này từng responded/booked/closed với chính người này) trên thẻ Lead mới + modal; tooltip ngày/người phụ trách cũ/lead cũ; bấm → mở lead cũ (nếu đang nạp).
#   - Nên gọi tiếp theo: +14 điểm + lý do "khách cũ quay lại".
#   - Bài đã quét: quyết định mới `seller_known` "Người bán quen · bỏ trước AI" + lý do (số bài AI đã chấm seller từ memHits); popup (super): nút "Không phải người bán" (bài seller/seller_known) hoặc "Đánh dấu người bán" (bài khác) → CF clearAuthorMemory (Admin SDK ghi author_memory + ai_feedback); demo → toast.
#   - live.js SL_FB.clearAuthorMemory.
# ESM: 20-feed export thêm returningChip; 65 import returningChip; 60 import errMsg, slConfirm từ 10-core.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
LV='assets/js/live.js'; C10='src/app/10-core-overview.js'; F20='src/app/20-feed.js'; S60='src/app/60-scan-views.js'; M65='src/app/65-charts-lead-modal.js'; CSS='assets/css/app.css'; SM='tools/smoke.js'
ESM = "import './" in rd(F20)

# ===== live.js =====
rep(LV, "    zaloCheckLead:(data)=>cf('zaloCheckLead',data||{}),", "    zaloCheckLead:(data)=>cf('zaloCheckLead',data||{}),\n    /* v119-93 (PC-3, LỆNH G): CF clearAuthorMemory {key | author_url+author_uid, action:'clear'|'seller', post_url?} — Super Admin gỡ nhãn \"người bán quen\" / đánh dấu người bán (máy chủ ghi author_memory + ai_feedback) */\n    clearAuthorMemory:(data)=>cf('clearAuthorMemory',data||{}),", tag='live.clearAuthorMemory')

# ===== 10-core: Nên gọi tiếp theo =====
rep(C10, "      if(l.stage==='responded'){ s+=30; why.push('khách đã phản hồi'); }", "      if(l.stage==='responded'){ s+=30; why.push('khách đã phản hồi'); }\n      if(l.returning===true){ s+=14; why.push('khách cũ quay lại'); } /* v119-93 (PC-3, LỆNH G): từng responded/booked/closed với brand → ưu tiên gọi */", tag='10.nextBest')

# ===== 20-feed: chip Khách cũ quay lại =====
rep(F20, "  /* v119-89 (LỆNH #46): lead \"Điểm tạm\" = lúc quét AI (OpenAI) gián đoạn",
"""  /* v119-93 (PC-3, LỆNH G): KHÁCH CŨ QUAY LẠI — scanner đặt lead.returning/returning_lead_id/returning_stage/returning_at/returning_assignee khi bộ nhớ người viết (author_memory, khoá = link hồ sơ / uid – KHÔNG theo tên)
     nói brand này từng responded/booked/closed với chính người này. Chip trên thẻ + modal; bấm → mở lead cũ nếu đang nạp trong cửa sổ realtime. Máy chủ còn ghi chú hệ thống 🔁 + push tới người từng phụ trách. */
  function returningChip(l){
    if(!l||l.returning!==true) return '';
    const st={responded:'đã phản hồi',booked:'đã hẹn tư vấn',closed:'đã chốt'}[String(l.returning_stage||'')]||String(l.returning_stage||'');
    const when=l.returning_at?new Date(Number(l.returning_at)).toLocaleDateString('vi-VN'):'';
    const old=l.returning_lead_id?String(l.returning_lead_id):''; const has=!!old&&(D.leads||[]).some(x=>String(x.id)===old);
    return `<span class="chip chip-ret" data-tip="Khách cũ của brand: từng ${esc(st)}${when?' ngày '+esc(when):''}${l.returning_assignee?' · '+esc(l.returning_assignee)+' phụ trách':''}${old?' · lead cũ '+esc(old):''}${has?' – bấm để mở lead cũ':''}"${has?` style="cursor:pointer" onclick="event.stopPropagation();window.__slGoLead&&window.__slGoLead('${escJsAttr(old)}')"`:''}>${SLI.refresh} Khách cũ quay lại${st?' · '+esc(st):''}</span>`;
  }
  /* v119-89 (LỆNH #46): lead "Điểm tạm" = lúc quét AI (OpenAI) gián đoạn""", tag='20.returningChip')
rep(F20, "${botChip(l)}${roleChip(l)}${aiTempChip(l)}", "${botChip(l)}${roleChip(l)}${returningChip(l)}${aiTempChip(l)}", tag='20.card')

# ===== 65 modal =====
rep(M65, "${roleChip(l)}${Number(l.views)>0?", "${roleChip(l)}${returningChip(l)}${Number(l.views)>0?", tag='65.header')
rep(M65, "  window.__slZaloCheck=function(id){ return zaloCheckLeadUI(id,''); };", "  window.__slZaloCheck=function(id){ return zaloCheckLeadUI(id,''); };\n  window.__slGoLead=function(id){ if(!id) return; if((D.leads||[]).some(x=>String(x.id)===String(id))) openLead(String(id)); else toast('Lead cũ không nằm trong cửa sổ đang nạp – tìm bằng mã lead ở ô tìm kiếm.'); }; /* v119-93 (PC-3): chip Khách cũ quay lại → mở lead cũ */", tag='65.goLead')

# ===== 60 Bài đã quét =====
rep(S60, "    seller:          {label:'Người bán/đối thủ · bỏ', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'},",
"    seller:          {label:'Người bán/đối thủ · bỏ', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'},\n    seller_known:    {label:'Người bán quen · bỏ trước AI', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'}, /* v119-93 LỆNH G (PC-3): bộ nhớ người viết — không tốn AI */", tag='60.DECIS')
rep(S60, "      case 'reseller':\n        return `AI xếp vai người viết là <b>đại lý / mua sỉ</b>",
"""      case 'seller_known':
        return `Người viết này đã được AI xếp vai <b>người bán / đối thủ</b> ở ${Number(p.memHits)||'≥ 2'} bài khác nhau trong 30 ngày qua (bộ nhớ người viết – khoá theo link hồ sơ, không theo tên) nên bài mới được <b>bỏ trước khi gọi AI</b>, không tốn phí. Nếu sai, Super Admin bấm "Không phải người bán" bên dưới; nhãn tự hết hạn sau 30 ngày không có bài bán mới.`; /* v119-93 LỆNH G (PC-3) */
      case 'reseller':
        return `AI xếp vai người viết là <b>đại lý / mua sỉ</b>""", tag='60.reason')
rep(S60, "no_text:0,self_comment:0,seller:0,reseller:0,too_old:0};", "no_text:0,self_comment:0,seller:0,seller_known:0,reseller:0,too_old:0}; /* v119-93 */", tag='60.counts')
rep(S60, """          <button class="btn btn-ghost btn-sm" id="spCopy">${SLI.copy} Sao chép nội dung</button>
        </div>""",
"""          <button class="btn btn-ghost btn-sm" id="spCopy">${SLI.copy} Sao chép nội dung</button>
          ${(roleIsSuper()&&p.author_key)?((p.decision==='seller_known'||p.decision==='seller')?`<button class="btn btn-soft btn-sm" id="spMemClear" title="Gỡ nhãn người bán quen cho người viết này – bài mới lại được AI chấm">${SLI.userX} Không phải người bán</button>`:`<button class="btn btn-soft btn-sm" id="spMemSeller" title="Đánh dấu người viết này là người bán – mọi bài mới bỏ trước AI trong 30 ngày">${SLI.store} Đánh dấu người bán</button>`):''}
        </div>""", tag='60.popupBtns')
rep(S60, "    document.getElementById('spGoLead')?.addEventListener('click',()=>{ const ld=(D.leads||[]).find(x=>x.name===p.author); if(ld) openLead(ld.id); });",
"""    document.getElementById('spGoLead')?.addEventListener('click',()=>{ const ld=(D.leads||[]).find(x=>x.name===p.author); if(ld) openLead(ld.id); });
    document.getElementById('spMemClear')?.addEventListener('click',()=>authMemAction(p,'clear')); document.getElementById('spMemSeller')?.addEventListener('click',()=>authMemAction(p,'seller')); /* v119-93 (PC-3) */""", tag='60.popupBind')
rep(S60, "  // Popup chi tiết 1 bài đã quét\n  function openScannedPost(idx){",
"""  /* v119-93 (PC-3, LỆNH G): Super Admin sửa BỘ NHỚ NGƯỜI VIẾT ngay trong popup Bài đã quét → CF clearAuthorMemory (máy chủ ghi author_memory + ai_feedback nuôi Sổ tay brand). p.author_key = khoá người viết do scanner ghi (id:<uid> | u:<username>). */
  async function authMemAction(p,action){
    const key=p&&p.author_key; if(!key) return; const who=p.author||key;
    const q=action==='seller'?'Đánh dấu "'+who+'" là NGƯỜI BÁN? Mọi bài mới của người này sẽ bỏ trước khi gọi AI trong 30 ngày (không tạo lead).':'Gỡ nhãn người bán quen cho "'+who+'"? Bài mới của người này sẽ được AI chấm lại bình thường.';
    if(!await slConfirm(q,{title:action==='seller'?'Đánh dấu người bán':'Không phải người bán',ok:action==='seller'?'Đánh dấu':'Gỡ nhãn'})) return;
    if(!(window.SL_FB&&window.SL_FB.clearAuthorMemory)){ toast(action==='seller'?'Đã đánh dấu người bán (demo).':'Đã gỡ nhãn người bán (demo).'); return; }
    try{ const r=await window.SL_FB.clearAuthorMemory({key,action,post_url:p.post_url||''}); toast(r&&r.ok?(action==='seller'?'Đã đánh dấu người bán – bài mới của người này bỏ trước AI 30 ngày.':'Đã gỡ nhãn – bài mới của người này sẽ được AI chấm lại.'):'Không lưu được – thử lại sau.'); }
    catch(e){ toast(errMsg(e,'Sửa bộ nhớ người viết lỗi')); }
  }
  // Popup chi tiết 1 bài đã quét
  function openScannedPost(idx){""", tag='60.authMemAction')

# ===== CSS =====
rep(CSS, ".zalo-chk .i { width: 12px; height: 12px; }", """.zalo-chk .i { width: 12px; height: 12px; }
/* v119-93 (PC-3): chip Khách cũ quay lại (thẻ + modal) */
.chip-ret { background: #ecfeff; color: #0e7490; border-color: transparent; font-weight: 700; }
.chip-ret .i { width: 12px; height: 12px; }""", tag='css')

# ===== ESM =====
if ESM:
    rep(F20, "dropChip, parentChip, extraLine, aiBand,", "dropChip, parentChip, extraLine, returningChip, aiBand,", tag='esm.20export')
    rep(M65, "pickDropReason, extraLine, fmtPhoneVN, setLeadNotes,", "pickDropReason, extraLine, returningChip, fmtPhoneVN, setLeadNotes,", tag='esm.65import')
    rep(S60, "import { D, SLI, chartAnim, charts, chip, fmt, scoreBg, scoreColor, slChart, startBdBudgetAuto, view, views, vnDayKey, aiV2Html } from './10-core-overview.js';", "import { D, SLI, chartAnim, charts, chip, errMsg, fmt, scoreBg, scoreColor, slChart, slConfirm, startBdBudgetAuto, view, views, vnDayKey, aiV2Html } from './10-core-overview.js';", tag='esm.60import')

# ===== smoke =====
rep(SM, "  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');",
r"""  // ===== v119-93 (PC-3): chip Khách cũ quay lại (thẻ + modal, bấm mở lead cũ) · Nên gọi tiếp theo lý do · Bài đã quét seller_known + nút Không phải người bán (super) · bản min =====
  await page.evaluate(() => { const D = window.SL_DATA; const L = D.leads.filter(x => !x.dropped && !x.lost && x.temp === 'hot' && x.stage !== 'closed'); const a = L[0], o = L[1]; a.__k93 = 'a'; o.__k93 = 'o'; a.returning = true; a.returning_lead_id = o.id; a.returning_stage = 'closed'; a.returning_at = Date.now() - 5 * 864e5; a.returning_assignee = 'An Nguyễn'; a.score = 99; location.hash = 'overview'; window.SLApp.reload(D); }); await page.waitForTimeout(600);
  const k93n = await page.evaluate(() => { const nb = document.querySelector('#view .nb-card'); return { nb: !!nb, why: nb ? nb.textContent : '' }; });
  await page.evaluate(() => { location.hash = 'feed'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const k93a = await page.evaluate(() => { const D = window.SL_DATA; const a = D.leads.find(x => x.__k93 === 'a'), o = D.leads.find(x => x.__k93 === 'o'); const c = document.querySelector('#feedList [data-lead="' + a.id + '"]'); const ch = c && c.querySelector('.chip-ret'); const r = { chip: ch ? ch.textContent.trim() : '', tip: ch ? (ch.getAttribute('data-tip') || '') : '', oname: o.name, oid: o.id }; if (ch) ch.click(); return r; }); await page.waitForTimeout(600);
  const k93b = await page.evaluate(() => { const m = document.getElementById('modal'); const open = document.getElementById('modalBg').classList.contains('show'); const txt = m.textContent; const cl = m.querySelector('#mClose'); if (cl) cl.click(); return { open, txt: txt.slice(0, 600) }; }); await page.waitForTimeout(400);
  await page.evaluate(() => { const D = window.SL_DATA; const a = D.leads.find(x => x.__k93 === 'a'); const cb = document.querySelector('#feedList [data-lead="' + a.id + '"] [data-chatbox]'); if (cb) cb.click(); }); await page.waitForTimeout(500);
  const k93c = await page.evaluate(() => { const m = document.getElementById('modal'); const ch = m.querySelector('.chip-ret'); const cl = m.querySelector('#mClose'); if (cl) cl.click(); return { chip: ch ? ch.textContent.trim() : '' }; }); await page.waitForTimeout(300);
  (/Khách cũ quay lại · đã chốt/.test(k93a.chip) && /An Nguyễn phụ trách/.test(k93a.tip) && k93a.tip.includes(k93a.oid) && k93b.open && k93b.txt.includes(k93a.oname) && /Khách cũ quay lại/.test(k93c.chip) && k93n.nb && /khách cũ quay lại/.test(k93n.why)) ? ok('v119-93 (PC-3): chip "Khách cũ quay lại · đã chốt" trên thẻ (tooltip người phụ trách + lead cũ), bấm → mở lead cũ; modal có chip; Nên gọi tiếp theo nêu lý do "khách cũ quay lại"') : fail('v119-93 chip: ' + JSON.stringify({ k93a: { chip: k93a.chip, tip: k93a.tip }, k93b: { open: k93b.open, has: k93b.txt.includes(k93a.oname) }, k93c, nb: k93n.nb, why: /khách cũ quay lại/.test(k93n.why) }));
  await page.evaluate(() => { const D = window.SL_DATA; D.leads.filter(x => x.__k93).forEach(l => { delete l.__k93; delete l.returning; delete l.returning_lead_id; delete l.returning_stage; delete l.returning_at; delete l.returning_assignee; }); const sp = D.scannedPosts || []; D.__spBak = sp.slice(); const base = sp[0] || {}; sp.unshift(Object.assign({}, base, { id: 'k93s', decision: 'seller_known', score: 0, role: 'seller', memHits: 3, author_key: 'id:100093093093093', kind: 'post', author: 'K93 Shop Mực', text: 'Mực khô Cô Tô giá sỉ, ib em nhé', post_url: 'https://www.facebook.com/groups/1/posts/9393/' })); location.hash = 'scanned'; window.SLApp.reload(D); }); await page.waitForTimeout(600);
  const k93d = await page.evaluate(() => { const chips = [...document.querySelectorAll('#view .chip-dot')].map(c => c.textContent.trim()); const row = document.querySelector('#view .sp-open[data-sp="0"]'); if (row) row.click(); return { known: chips.some(c => /Người bán quen · bỏ trước AI/.test(c)), row: !!row }; }); await page.waitForTimeout(400);
  const k93e = await page.evaluate(() => { const m = document.getElementById('modal'); const reason = (m.querySelector('.spm-reason') || {}).textContent || ''; const b = m.querySelector('#spMemClear'); const r = { reason, btn: b ? b.textContent.trim() : '', seller: !!m.querySelector('#spMemSeller') }; if (b) b.click(); return r; }); await page.waitForTimeout(400);
  const k93f = await page.evaluate(() => { const d = document.getElementById('slDlg'); const t = d ? d.textContent : ''; const b = d && d.querySelector('[data-dlg="1"]'); if (b) b.click(); return { dlg: !!d, t }; }); await page.waitForTimeout(400);
  await page.evaluate(() => { const m = document.getElementById('modal'); const cl = m.querySelector('#mClose'); if (cl) cl.click(); const D = window.SL_DATA; D.scannedPosts = D.__spBak; delete D.__spBak; }); await page.waitForTimeout(200);
  (k93d.known && k93d.row && /3 bài khác nhau/.test(k93e.reason) && /bỏ trước khi gọi AI/.test(k93e.reason) && /Không phải người bán/.test(k93e.btn) && !k93e.seller && k93f.dlg && /Gỡ nhãn người bán quen/.test(k93f.t)) ? ok('v119-93 (PC-3): Bài đã quét có "Người bán quen · bỏ trước AI" (lý do nêu 3 bài); popup super có nút Không phải người bán → hộp thoại xác nhận') : fail('v119-93 scanned: ' + JSON.stringify({ k93d, k93e: { reason: k93e.reason.slice(0, 80), btn: k93e.btn, seller: k93e.seller }, k93f }));
  { const am = fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8'), lv = fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8');
    const okMin93 = /Khách cũ quay lại/.test(am) && /Người bán quen/.test(am) && /Đánh dấu người bán/.test(am) && /"clearAuthorMemory"/.test(lv) && /khách cũ quay lại/.test(am);
    okMin93 ? ok('v119-93: bản min có chip Khách cũ / Người bán quen / Đánh dấu người bán; live.min có clearAuthorMemory') : fail('v119-93 bản min thiếu mốc'); }
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');""", tag='smoke.k93')
done()
