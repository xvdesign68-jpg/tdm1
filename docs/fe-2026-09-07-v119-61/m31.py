# m31.py <cây> — v119-89 / v120-esm-am (11/09/2026): zip FE đi cùng LỆNH #46 (lead "Điểm tạm – AI chưa chấm" = scoreLead rơi heuristic khi OpenAI lỗi 500 từng đợt):
#   • chip "Điểm tạm – AI sẽ chấm lại" hiện cho MỌI vai trò trên THẺ lead + modal (trước: chỉ Super Admin, chỉ modal) — tooltip nói rõ: AI gián đoạn lúc quét,
#     hệ thống tự chấm lại ở lượt quét kế, máy tự động không chạm; sales biết điểm chỉ tham khảo.
#   • "Nên gọi tiếp theo": lead điểm tạm −30 điểm + lý do "điểm tạm – chờ AI chấm lại" (không đẩy lead rác 90 lên đầu danh sách gọi).
#   • Bài đã quét: quyết định mới `ai_wait` ("Chờ AI chấm lại") + lý do (bài xếp hàng score_retry, không tạo lead tới khi AI chấm xong).
#   • system_status/llm (engine LỆNH #46 ghi khi OpenAI hỏng/hồi) → live.js D.sysLlm (super) → Cảnh báo hệ thống dòng "AI chấm điểm đang LỖI",
#     thẻ cảnh báo (Overview + Lịch sử quét, cạnh thẻ BrightData), chip thanh nhịp quét "AI chấm điểm lỗi – bài chờ chấm lại".
# Áp lên cây v119-88 / v120-esm-al (cùng script, tự nhận ESM). ESM: 20-feed export thêm aiTempChip, 65 import aiTempChip từ 20.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
LV='assets/js/live.js'; F20='src/app/20-feed.js'; M65='src/app/65-charts-lead-modal.js'; C10='src/app/10-core-overview.js'; V60='src/app/60-scan-views.js'; C50='src/app/50-config-views.js'; CSS='assets/css/app.css'; S='tools/smoke.js'
ESM = "import './" in rd(F20)

# ---------- live.js: kênh system_status/llm (super) ----------
rep(LV, "  let sysStatus=null; // v119-50:", "  let sysLlm=null; // v119-89: system_status/llm — engine LỆNH #46 ghi {ok,since,at,runs,kind,sample,model,fails,deferred,fallback,recoveredAt} khi OpenAI chấm điểm hỏng/hồi (super đọc) → Cảnh báo hệ thống + thẻ + chip nhịp quét\n  let sysStatus=null; // v119-50:", tag='lv.decl')
rep(LV, "d.sysStatus=sysStatus; d.contentStats=contentStats; d.oaStatus=oaStatus;", "d.sysStatus=sysStatus; d.contentStats=contentStats; d.oaStatus=oaStatus; d.sysLlm=sysLlm;", tag='lv.D')
rep(LV, "sysStatus=null; contentStats={}; oaStatus=null;", "sysStatus=null; contentStats={}; oaStatus=null; sysLlm=null;", tag='lv.reset')
rep(LV, "      dataUnsub.push(onSnapshot(doc(db,'system_status','brightdata'), d=>{ sysStatus=d.exists()?d.data():null; rebuild(['overview','feed','scanned']); }, function(e){ console.warn('[SL] system_status', e&&e.code); }));",
"""      dataUnsub.push(onSnapshot(doc(db,'system_status','brightdata'), d=>{ sysStatus=d.exists()?d.data():null; rebuild(['overview','feed','scanned']); }, function(e){ console.warn('[SL] system_status', e&&e.code); }));
      /* v119-89: AI chấm điểm (OpenAI) hỏng/hồi — engine LỆNH #46 ghi system_status/llm (≥2 lượt chấm hỏng & 0 OK, hoặc key/credit/model lỗi → ok:false; có lượt OK → ok:true). Rules read=super (block system_status/* LỆNH #23). */
      dataUnsub.push(onSnapshot(doc(db,'system_status','llm'), d=>{ sysLlm=d.exists()?d.data():null; rebuild(['overview','feed','history','scanned','alerts']); }, function(e){ console.warn('[SL] system_status/llm', e&&e.code); }));""", tag='lv.snap')

# ---------- 20-feed: chip Điểm tạm trên thẻ (mọi vai trò) ----------
rep(F20, "  const SEAL_IC='<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"currentColor\"/>",
"""  /* v119-89 (LỆNH #46): lead "Điểm tạm" = lúc quét AI (OpenAI) gián đoạn nên chấm bằng bộ lọc từ khoá dự phòng (ai_scored:false, điểm kẹp ≤59 từ LỆNH #46; lead cũ có thể tới 90).
     Hiện cho MỌI vai trò (trước chỉ Super Admin, chỉ modal): sales biết điểm chỉ tham khảo; máy tự động không chạm; hệ thống tự chấm lại ở lượt quét kế rồi gỡ chip. */
  function aiTempChip(l){
    if(!l||l.ai_scored!==false) return '';
    const tries=Number(l.rescore_tries)||0;
    return `<span class="chip chip-aitmp" data-tip="Lúc quét, AI chấm điểm tạm gián đoạn nên lead được chấm bằng bộ lọc từ khoá dự phòng – điểm và nhiệt độ chỉ mang tính tham khảo, chưa có gợi ý phản hồi. Hệ thống sẽ tự chấm lại bằng AI ở lượt quét kế (máy tự động không tiếp cận lead này cho tới khi chấm xong)${tries?' · đã thử chấm lại '+tries+' lần':''}">${SLI.clock} Điểm tạm – AI sẽ chấm lại</span>`;
  }
  const SEAL_IC='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="currentColor"/>""", tag='20.fn')
rep(F20, "${botChip(l)}${roleChip(l)}${l.dropped?", "${botChip(l)}${roleChip(l)}${aiTempChip(l)}${l.dropped?", tag='20.card')

# ---------- 65 modal: dùng chung chip ----------
rrep(M65, r"\$\{\(l\.ai_scored===false&&roleIsSuper\(\)\)\?`[^`]*Điểm tạm – AI chưa chấm</span>`:''\}", "${aiTempChip(l)}", tag='65.chip')

# ---------- 10-core: Nên gọi tiếp theo hạ ưu tiên ----------
rep(C10, "      let s=Number(l.score)||0; const why=[];", "      let s=Number(l.score)||0; const why=[];\n      if(l.ai_scored===false){ s-=30; why.push('điểm tạm – chờ AI chấm lại'); } // v119-89 (LỆNH #46): điểm dự phòng không đáng tin → không đẩy lên đầu danh sách gọi", tag='10.nb')

# ---------- 60: quyết định ai_wait + chip nhịp quét + thẻ AI lỗi ----------
rep(V60, "    error:           {label:'Lỗi chấm',", "    ai_wait:         {label:'Chờ AI chấm lại', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'}, /* v119-89 LỆNH #46 */\n    error:           {label:'Lỗi chấm',", tag='60.decis')
rep(V60, "      case 'excluded':", "      case 'ai_wait':\n        return `AI (OpenAI) tạm không phản hồi khi chấm bài này (lỗi máy chủ AI / mạng) nên bài được <b>xếp hàng chấm lại tự động</b> ở các lượt quét kế (3′ → 10′ → 30′ → 1 h → 3 h → 6 h). Chưa tạo lead cho tới khi AI chấm xong; quá 24 giờ vẫn lỗi thì tạo lead \"Điểm tạm\" (điểm kẹp ≤ 59) và AI chấm lại sau.`; /* v119-89 LỆNH #46 */\n      case 'excluded':", tag='60.reason')
rep(V60, "error:0,self_comment:0,seller:0}", "error:0,ai_wait:0,self_comment:0,seller:0}", tag='60.count')
rep(V60, "    if(bdDown()) return '<span class=\"sb-live sb-off\" title=\"'+esc(bdDownTitle())+'\"><i class=\"sb-dot\"></i>Bright Data ngưng – không lấy được bài</span>'; // v119-50",
"    if(bdDown()) return '<span class=\"sb-live sb-off\" title=\"'+esc(bdDownTitle())+'\"><i class=\"sb-dot\"></i>Bright Data ngưng – không lấy được bài</span>'; // v119-50\n    if(llmDown()) return '<span class=\"sb-live sb-off\" title=\"'+esc(llmDownTitle())+'\"><i class=\"sb-dot\"></i>AI chấm điểm lỗi – bài chờ chấm lại</span>'; // v119-89 LỆNH #46", tag='60.sbLive')
rep(V60, "  function bdStatusCard(){\n    if(!bdDown()) return '';",
"""  /* v119-89 (LỆNH #46): trạng thái AI chấm điểm do engine ghi (system_status/llm) — ok:false = ≥2 lượt chấm hỏng & 0 OK trong 1 lượt quét (hoặc key/credit/model lỗi):
     bài mới xếp hàng chờ chấm lại (không thành lead), lead không mất; OpenAI hoạt động lại → ok:true → thẻ tự biến mất. Chỉ Super Admin có dữ liệu (Rules). */
  function llmDown(){ return !!(roleIsSuper()&&D.sysLlm&&D.sysLlm.ok===false); }
  function llmDownTitle(){ const st=D.sysLlm||{}; return 'AI chấm điểm lỗi từ '+(st.since?new Date(+st.since).toLocaleString('vi-VN'):'?')+(st.kind?' · '+st.kind:'')+(st.sample?' · '+st.sample:''); }
  function llmStatusCard(){
    if(!llmDown()) return '';
    const st=D.sysLlm||{}; const since=st.since?new Date(+st.since):null; const mins=since?Math.max(0,Math.round((Date.now()-since.getTime())/60000)):null;
    const dur=mins==null?'':(mins<60?mins+' phút':(Math.floor(mins/60)+' giờ '+(mins%60)+' phút'));
    const why={auth:'khoá API sai hoặc đã xoay nhưng chưa deploy lại',quota:'hết credit OpenAI',model:'model không tồn tại / đổi tên',rate:'vượt hạn mức gọi (rate limit)',server:'máy chủ OpenAI lỗi (5xx)',net:'mạng / quá thời gian chờ',format:'AI trả về không đúng định dạng',badreq:'yêu cầu bị từ chối (400)'}[st.kind]||'';
    return `<div class="card" id="llmStatusCard" style="margin-bottom:14px;padding:12px 16px;border:1px solid var(--warm);background:var(--warm-bg);display:flex;gap:12px;align-items:flex-start"><span style="font-size:20px;line-height:1">${SLI.bot}</span><div><b style="color:#b45309">AI chấm điểm (OpenAI) đang LỖI${dur?' (đã '+dur+')':''} – bài mới đang xếp hàng chờ chấm lại, chưa thành lead.</b><div class="sub" style="margin-top:2px">${fmt(+st.runs||0)} lượt quét liên tiếp không chấm được${st.kind?' · lỗi <code>'+esc(String(st.kind))+'</code>'+(why?' ('+why+')':''):''}${st.sample?' · mẫu: <code>'+esc(String(st.sample).slice(0,140))+'</code>':''}. Không mất lead: bài chờ được chấm lại tự động (3′ → 10′ → 30′ → 1 h → 3 h → 6 h); lead đã tạo "Điểm tạm" cũng được AI chấm lại khi hoạt động trở lại${since?' · ghi nhận từ '+since.toLocaleString('vi-VN'):''}.</div></div></div>`;
  }
  function bdStatusCard(){ return bdStatusCard0()+llmStatusCard(); } // v119-89: thẻ BrightData + thẻ AI chấm điểm (cùng chỗ: Overview + Lịch sử quét)
  function bdStatusCard0(){
    if(!bdDown()) return '';""", tag='60.card')

# ---------- 50: Cảnh báo hệ thống ----------
rep(C50, "    if(st&&st.ok===false) add(SLI.ban,'BrightData đang NGƯNG – không lấy được bài mới', [(st.since?'từ '+new Date(+st.since).toLocaleString('vi-VN'):''),(st.runs?st.runs+' lượt lỗi':''),(st.sample||'')].filter(Boolean).join(' · '),'history','bad');",
"""    if(st&&st.ok===false) add(SLI.ban,'BrightData đang NGƯNG – không lấy được bài mới', [(st.since?'từ '+new Date(+st.since).toLocaleString('vi-VN'):''),(st.runs?st.runs+' lượt lỗi':''),(st.sample||'')].filter(Boolean).join(' · '),'history','bad');
    const sl=D.sysLlm||null; if(sl&&sl.ok===false) add(SLI.bot,'AI chấm điểm (OpenAI) đang LỖI – bài mới xếp hàng chờ chấm lại, chưa thành lead',[(sl.since?'từ '+new Date(+sl.since).toLocaleString('vi-VN'):''),(sl.runs?sl.runs+' lượt quét lỗi':''),(sl.kind?'lỗi '+sl.kind:''),(sl.sample||'')].filter(Boolean).join(' · '),'history','bad'); // v119-89 LỆNH #46""", tag='50.row')

# ---------- CSS ----------
rep(CSS, ".chip-role { background: #fef3e2; color: #b45309; border-color: transparent; } /* v-selfcmt: 🏪 người bán / 👤 chủ bài */",
".chip-role { background: #fef3e2; color: #b45309; border-color: transparent; } /* v-selfcmt: 🏪 người bán / 👤 chủ bài */\n.chip-aitmp { background: #fef3e2; color: #b45309; border-color: transparent; } /* v119-89: điểm tạm – AI chưa chấm (LỆNH #46) */", tag='css.chip')
rep(CSS, ".chip .i, .chip-role .i { width: 12px; height: 12px; }", ".chip .i, .chip-role .i, .chip-aitmp .i { width: 12px; height: 12px; }", tag='css.i')

# ---------- ESM ----------
if ESM:
    rep(F20, "restoreLead, roleChip, setFeedQuery,", "restoreLead, roleChip, aiTempChip, setFeedQuery,", tag='20.esmExport')
    rep(M65, "restoreLead, roleChip, setLeadNotes,", "restoreLead, roleChip, aiTempChip, setLeadNotes,", tag='65.esmImport')

# ---------- smoke +2 ----------
rep(S, "  errors.length ? fail('Lỗi JS: '",
"""  // ===== v119-89 (LỆNH #46): chip "Điểm tạm" mọi vai trò (thẻ + modal) · quyết định ai_wait · thẻ/chip/cảnh báo AI chấm điểm lỗi · Nên gọi hạ ưu tiên · kênh system_status/llm =====
  await page.evaluate(() => { const D = window.SL_DATA; const l = D.leads.find(x => !x.dropped && !x.lost && x.temp === 'hot'); l.__k89 = 1; l.ai_scored = false; location.hash = 'feed'; window.SLApp.reload(D); }); await page.waitForTimeout(500);
  const k89a = await page.evaluate(() => { const c = document.querySelector('#feedList .chip-aitmp'); const card = c && c.closest('.lead-card'); const b = card && card.querySelector('[data-chatbox]'); if (b) b.click(); return { chip: !!c, tip: c ? (c.getAttribute('data-tip') || '') : '', txt: c ? c.textContent.trim() : '' }; }); await page.waitForTimeout(500);
  const k89b = await page.evaluate(() => { const m = document.getElementById('modal'); const c = m && m.querySelector('.chip-aitmp'); const txt = c ? c.textContent.trim() : ''; const cl = m && m.querySelector('#mClose'); if (cl) cl.click(); return { txt }; }); await page.waitForTimeout(300);
  await page.evaluate(() => { const D = window.SL_DATA; const l = D.leads.find(x => x.__k89); if (l) { delete l.ai_scored; delete l.__k89; } window.SLApp.reload(D); }); await page.waitForTimeout(200);
  (k89a.chip && /Điểm tạm – AI sẽ chấm lại/.test(k89a.txt) && /tự chấm lại/.test(k89a.tip) && /máy tự động không tiếp cận/.test(k89a.tip) && /Điểm tạm/.test(k89b.txt)) ? ok('v119-89: chip "Điểm tạm – AI sẽ chấm lại" trên thẻ lead (mọi vai trò, tooltip nói rõ) + trong modal') : fail('v119-89 chip điểm tạm: ' + JSON.stringify({ k89a, k89b }));
  await page.evaluate(() => { window.SL_DATA.sysLlm = { ok: false, since: Date.now() - 75 * 60e3, at: Date.now(), runs: 4, kind: 'server', sample: 'LLM 500 [server_error]: The server had an error', model: 'gpt-5.6-sol' }; location.hash = 'overview'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(600);
  const k89c = await page.evaluate(() => { const c = document.getElementById('llmStatusCard'); return { card: c ? c.textContent : '' }; });
  await page.evaluate(() => { location.hash = 'feed'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(600);
  const k89f = await page.evaluate(() => { const e = document.querySelector('.scanbar .sb-live'); return { off: !!(e && e.classList.contains('sb-off')), sb: e ? e.textContent : '' }; });
  await page.evaluate(() => { location.hash = 'alerts'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const k89d = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#sysAlertCard .al-sum-row')].map(r => r.textContent) }));
  await page.evaluate(() => { window.SL_DATA.sysLlm = { ok: true, at: Date.now() }; location.hash = 'overview'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const k89e = await page.evaluate(() => ({ card: !!document.getElementById('llmStatusCard') }));
  await page.evaluate(() => { location.hash = 'feed'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(600);
  k89e.sb = await page.evaluate(() => (document.querySelector('.scanbar .sb-live') || {}).textContent || '');
  await page.evaluate(() => { delete window.SL_DATA.sysLlm; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(200);
  { const am = fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8'), lv = fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8');
    const okMin = /Chờ AI chấm lại/.test(am) && /điểm tạm – chờ AI chấm lại/.test(am) && /"system_status","llm"/.test(lv);
    (/AI chấm điểm \\(OpenAI\\) đang LỖI \\(đã 1 giờ 15 phút\\)/.test(k89c.card) && /4 lượt quét/.test(k89c.card) && /máy chủ OpenAI lỗi/.test(k89c.card) && k89f.off && /AI chấm điểm lỗi – bài chờ chấm lại/.test(k89f.sb) && k89d.rows.some(t => /AI chấm điểm \\(OpenAI\\) đang LỖI/.test(t) && /4 lượt quét lỗi/.test(t)) && !k89e.card && /Đang trực 24\\/7/.test(k89e.sb) && okMin) ? ok('v119-89: system_status/llm ok:false → thẻ AI lỗi (đã 1 giờ 15 phút · 4 lượt · lý do) + chip nhịp quét + dòng Cảnh báo hệ thống; ok:true → tự gỡ; bản min có ai_wait/hạ ưu tiên/kênh llm') : fail('v119-89 AI lỗi: ' + JSON.stringify({ k89c: { card: k89c.card.slice(0, 120) }, k89f, k89d: k89d.rows.map(t => t.slice(0, 70)), k89e, okMin })); }
  errors.length ? fail('Lỗi JS: '""", tag='smoke.k89')
done()
