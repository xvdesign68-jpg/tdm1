# m32.py <cây> — v119-90 / v120-esm-an (13/09/2026): zip FE đi cùng LỆNH B (1 group nhiều brand + nhịp thích ứng) · LỆNH #48 (AI hardening) · LỆNH C (bộ đếm/push/source_health)
#   + 3 đề xuất Đợt 1 của báo cáo rà soát quét→lọc→chấm điểm (PA-4 · PC-6 · PA-11). Áp lên cây v119-89 / v120-esm-am (cùng script, tự nhận ESM).
#   PA-4  thẻ comment-lead KỂ ĐỦ CHUYỆN: chip "Từ bình luận · dưới bài của X" + dòng "Bài gốc: …" ngay trên thẻ (trước chỉ modal có); hộp AI trên thẻ đưa NHU CẦU lên trước ý định;
#         ô tìm kiếm quét cả bài gốc / tác giả bài gốc / lý do vai / lý do loại.
#   PC-6  AI GIẢI THÍCH + KHÔNG GIẤU LEAD ĐANG CHĂM: lead máy loại (sweeper #46 `dropped_by:rescore…`) hoặc AI hạ xuống rác mà sales đã chăm/giao → VẪN HIỆN
#         kèm dải vàng "AI chấm lại: rác/loại – bạn đang chăm nên vẫn giữ" + 2 nút 1 chạm (Đồng ý loại / AI sai – giữ lead → `ai_feedback`); chip "AI chấm lại 90 → 12"
#         (tooltip lý do); Loại có LÝ DO (pipeline + modal, `dropped_reason`); chip Rác · Loại tách "AI a · người b"; dòng thời gian phân biệt AI loại / người loại + mốc AI chấm lại.
#   PA-11 Lịch sử quét: biểu đồ 14 ngày ưu tiên BỘ ĐẾM MÁY CHỦ daily_stats (scanned/new mọi lượt) thay vì 300 lượt đã nạp; nhãn "1.000 lượt" → số thật; live.js scans limit 1000 → 300.
#   FE của LỆNH B: nguồn mới tạo qua CF `createSource` (id <gid>__<brand>, kiểm trùng cùng brand, 409 duplicate/duplicate_name nói rõ); form + wizard CHO PHÉP 1 group nhiều brand
#         (hộp thoại xác nhận, wizard hiện "dùng chung" thay vì bỏ qua); chip "Dùng chung" + cột "Nhịp · Sức khoẻ" ở Nguồn quét (group_state band/iv/lastPostAt + source_health 7 ngày
#         + scan.health bad); nhãn ô "Sàn nhịp gieo"; Quét ngay/quét quá khứ gặp 409 busy → toast rõ; Quét thử wizard gửi sourceId.
#   FE của LỆNH #48: Cảnh báo hệ thống thêm "AI tiền lọc lỗi" (llm.pre=false) + "cầu dao AI đang mở" (llm.cbOpen); Bài đã quét quyết định `no_text` (bài không chữ).
#   FE của LỆNH C: Cảnh báo hệ thống dòng "N nguồn có vấn đề" từ system_status/scan.health; Bảng brand chi tiết "AI loại N" (daily_stats.aiDropped).
# live.js: state sysScan/srcHealth/groupState (super) + SL_FB.createSource. ESM: 10-core export thêm machineDropped/humanCared/aiHidden/leadOut/slDialog; 20-feed export 7 tên mới; 30/65/70/60 import.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
LV='assets/js/live.js'; C10='src/app/10-core-overview.js'; F20='src/app/20-feed.js'; A25='src/app/25-agency.js'; P30='src/app/30-pipeline.js'; C50='src/app/50-config-views.js'; V60='src/app/60-scan-views.js'; M65='src/app/65-charts-lead-modal.js'; T70='src/app/70-shell-tools.js'; W87='src/app/87-brand-wizard.js'; CSS='assets/css/app.css'; SM='tools/smoke.js'
ESM = "import './" in rd(F20)

# =========================================================== live.js ===========================================================
rep(LV, "  let sysLlm=null; // v119-89:", "  let sysScan=null, srcHealth={}, groupState={}; // v119-90: system_status/scan (LỆNH B khoá lượt/skipRuns + LỆNH C health{bad[]}) · source_health/{source_id} (LỆNH C, 7 ngày posts/leads/err) · group_state/{g_<gid>|s_<slug>} (LỆNH B band/iv/lastPostAt) — super đọc (Rules LỆNH C) → Nguồn quét cột Nhịp · Sức khoẻ + Cảnh báo hệ thống\n  let sysLlm=null; // v119-89:", tag='lv.decl')
rep(LV, "d.sysLlm=sysLlm; //", "d.sysLlm=sysLlm; d.sysScan=sysScan; d.srcHealth=srcHealth; d.groupState=groupState; //", tag='lv.D')
rep(LV, "oaStatus=null; sysLlm=null;", "oaStatus=null; sysLlm=null; sysScan=null; srcHealth={}; groupState={};", tag='lv.reset')
rep(LV, """      dataUnsub.push(onSnapshot(doc(db,'system_status','llm'), d=>{ sysLlm=d.exists()?d.data():null; rebuild(['overview','feed','history','scanned','alerts']); }, function(e){ console.warn('[SL] system_status/llm', e&&e.code); }));""",
"""      dataUnsub.push(onSnapshot(doc(db,'system_status','llm'), d=>{ sysLlm=d.exists()?d.data():null; rebuild(['overview','feed','history','scanned','alerts']); }, function(e){ console.warn('[SL] system_status/llm', e&&e.code); }));
      /* v119-90: LỆNH B/C — system_status/scan {phase, skipRuns, busyRuns, health:{at,n,active,bad[≤30]}} · source_health/{source_id} {days.<ngàyVN>.{posts,leads,hot,err}, lastPostAt, lastLeadAt, errStreak, lastError, name, brand, gid}
         · group_state/{g_<gid>|s_<slug>} {band fast|mid|slow|idle, iv, rate, lastPostAt, lastTriggerAt, brands[]} → Nguồn quét cột "Nhịp · Sức khoẻ" + Cảnh báo hệ thống. Rules read=super (LỆNH C); chưa deploy → chỉ warn, KHÔNG banner kênh. */
      dataUnsub.push(onSnapshot(doc(db,'system_status','scan'), d=>{ sysScan=d.exists()?d.data():null; rebuild(['sources','alerts','history']); }, function(e){ console.warn('[SL] system_status/scan', e&&e.code); }));
      dataUnsub.push(onSnapshot(collection(db,'source_health'), snap=>{ const m={}; snap.forEach(d=>{ m[d.id]=d.data(); }); srcHealth=m; rebuild(['sources']); }, function(e){ console.warn('[SL] source_health', e&&e.code); }));
      dataUnsub.push(onSnapshot(collection(db,'group_state'), snap=>{ const m={}; snap.forEach(d=>{ const x=d.data()||{}; m[d.id]={band:x.band||'',iv:Number(x.iv)||0,rate:Number(x.rate)||0,rateN:Number(x.rateN)||0,lastPostAt:Number(x.lastPostAt)||0,lastTriggerAt:Number(x.lastTriggerAt)||0,lastHarvestAt:Number(x.lastHarvestAt)||0,gidNum:x.gidNum||'',url:x.url||'',brands:Array.isArray(x.brands)?x.brands:[]}; }); groupState=m; rebuild(['sources']); }, function(e){ console.warn('[SL] group_state', e&&e.code); })); // chỉ giữ field hiển thị (bỏ recentIds ≤200 id/doc)""", tag='lv.snap')
rep(LV, "dataUnsub.push(onSnapshot(query(collection(db,'scans'),orderBy('at','desc'),limit(1000)), snap=>{", "dataUnsub.push(onSnapshot(query(collection(db,'scans'),orderBy('at','desc'),limit(300)), snap=>{ /* v119-90 (PA-11): 1000 → 300 lượt (biểu đồ 14 ngày đọc daily_stats máy chủ; nhật ký chỉ cần vài trăm lượt gần nhất) */", tag='lv.scans')
rep(LV, "    setSource:  (id,data)=>guard(setDoc(doc(db,'sources',id),data,{merge:true})),",
"""    setSource:  (id,data)=>guard(setDoc(doc(db,'sources',id),data,{merge:true})),
    /* v119-90 (LỆNH B): tạo nguồn MỚI qua CF createSource — id <gid|slug>__<brand>, kiểm trùng cùng brand (409 duplicate / duplicate_name), group đã có brand khác → sharedAt (dùng chung, lead tách riêng). Trả {ok,id,gkey,shared,sharedWith[]}. Sửa nguồn cũ vẫn setSource. */
    createSource:(data)=>cf('createSource',data||{}),""", tag='lv.createSource')

# =========================================================== 10-core: helper máy loại / người đang chăm ===========================================================
rep(C10, "  function todayBoard(){\n    const now=Date.now(), t0=vnDayStart(now), eod=t0+864e5-1;",
"""  /* v119-90 (PC-6, khớp stats.js LỆNH C): `dropped_by` là MÁY khi đúng token máy (sweeper #46 `rescore`/`rescore_role`, LỆNH #31b, engine/worker…) — email/uid người không khớp.
     humanCared = sales đã giao/chăm/liên hệ hoặc đã đổi giai đoạn → AI hạ xuống rác / máy loại KHÔNG được giấu lead đó (dải vàng + 2 nút 1 chạm thay vì biến mất khỏi Lead mới/Hôm nay/Hộp việc). */
  const MACHINE_BY=/^(rescore|rescore_role|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto)(:[\\w-]+)?$/i;
  function machineDropped(l){ return !!(l&&l.dropped===true&&MACHINE_BY.test(String(l.dropped_by||''))); }
  function humanCared(l){ return !!(l&&(l.first_care_at||l.assignee||l.last_touch_at||(l.stage&&l.stage!=='new')||l.ai_feedback==='wrong')); }
  function aiHidden(l){ return !!(l&&(l.temp==='junk'||machineDropped(l))&&!humanCared(l)); } // AI nói rác/loại và chưa ai chăm → ẩn như cũ
  function leadOut(l){ return !!(l&&((l.dropped&&!machineDropped(l))||l.lost||aiHidden(l))); } // = feedHidden: người loại / không thành / AI rác chưa ai chăm
  function todayBoard(){
    const now=Date.now(), t0=vnDayStart(now), eod=t0+864e5-1;""", tag='10.helpers')
rep(C10, "    const L=all.filter(l=>!l.dropped&&!l.lost&&l.temp!=='junk');\n    const at=l=>{", "    const L=all.filter(l=>!leadOut(l)); // v119-90: lead đang chăm mà AI hạ rác/máy loại vẫn tính (dải vàng ở thẻ)\n    const at=l=>{", tag='10.today')
rep(C10, "    const L=(D.leads||[]).filter(l=>l&&!l.dropped&&!l.lost&&l.temp!=='junk'&&l.stage!=='closed'&&(admin||isMine(l)||!l.assignee));", "    const L=(D.leads||[]).filter(l=>l&&!leadOut(l)&&l.stage!=='closed'&&(admin||isMine(l)||!l.assignee)); // v119-90", tag='10.nb')
rep(C10, "      if(l.ai_scored===false){ s-=30; why.push('điểm tạm – chờ AI chấm lại'); }", "      if(l.ai_scored===false){ s-=30; why.push('điểm tạm – chờ AI chấm lại'); }\n      if(l.temp==='junk'||machineDropped(l)){ s-=40; why.push('AI chấm lại: rác – xem lại trước khi gọi'); } // v119-90 (PC-6): đang chăm nhưng AI đã hạ → xuống cuối danh sách", tag='10.nb2')

# =========================================================== 20-feed ===========================================================
rep(F20, "  function feedHidden(l){ return !!(l && (l.dropped || l.lost || l.temp==='junk')); }",
"  function feedHidden(l){ return leadOut(l); } /* v119-90 (PC-6): = người loại / không thành / AI rác|máy loại CHƯA ai chăm — lead sales đang chăm mà AI hạ vẫn hiện kèm dải vàng */", tag='20.hidden')
rep(F20, "  const SEAL_IC='<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"currentColor\"/>",
"""  /* ===== v119-90 (PC-6): Loại có LÝ DO · AI giải thích · dải vàng lead đang chăm bị AI hạ · phản hồi 1 chạm ===== */
  const DROP_REASONS=['Rác / spam','Người bán – đối thủ','Trùng lead','Không đúng ngành','Tuyển dụng / tìm việc','Khác'];
  /* hộp thoại chọn lý do loại (dùng slDialog html; đọc <select> ngay khi bấm Đồng ý — phần tử còn trong DOM 150 ms) → null = huỷ */
  function pickDropReason(name){
    const opts=DROP_REASONS.map(r=>`<option>${esc(r)}</option>`).join('');
    return slDialog({title:'Loại "'+(name||'lead')+'" khỏi pipeline?',html:true,text:`<label class="sl-dlg-lbl"><span>Lý do (để AI học và báo cáo đúng)</span><select class="acs-in" id="slDropWhy">${opts}</select></label><div class="muted" style="font-size:12px;margin-top:6px">Lead vẫn còn trong kho (chip "Rác · Loại" ở Lead mới) và khôi phục được.</div>`,ok:'Loại lead',danger:true})
      .then(okv=>{ if(!okv) return null; const s=document.getElementById('slDropWhy'); return (s&&s.value)||DROP_REASONS[0]; });
  }
  /* ghi Loại + lý do (Rules whitelist dropped_reason từ LỆNH C); optimistic + hoàn tác qua nút Khôi phục; after() = vẽ lại nơi gọi */
  function dropLead(id,why,after){
    const l=D.leads.find(x=>String(x.id)===String(id)); if(!l) return Promise.resolve(false);
    const prev={dropped:l.dropped,dropped_reason:l.dropped_reason,dropped_by:l.dropped_by,dropped_at:l.dropped_at};
    const by=(window.CURRENT_USER||{}).email||'';
    Object.assign(l,{dropped:true,dropped_reason:why||'',dropped_by:by,dropped_at:slNow()});
    if(after) after();
    if(window.SL_FB&&window.SL_FB.updateLead){
      return window.SL_FB.updateLead(String(l.id),{dropped:true,dropped_at:l.dropped_at,dropped_by:by,dropped_reason:why||''})
        .then(()=>{ toast('Đã loại "'+(l.name||'lead')+'" · '+(why||'')+' – khôi phục ở chip Rác · Loại.'); return true; })
        .catch(e=>{ Object.assign(l,prev); if(after) after(); toast(errMsg(e,'Loại lead lỗi')); return false; });
    }
    toast('Đã loại "'+(l.name||'lead')+'" · '+(why||'')+' (demo).'); return Promise.resolve(true);
  }
  /* AI chấm lại (sweeper LỆNH #46/#48): ai_prev {score,temp} hoặc số → chip "AI chấm lại 90 → 12" + tooltip lý do (rescore_note / dropped_reason / role_reason) */
  function aiPrevScore(l){ const ap=l&&l.ai_prev; if(ap==null) return null; const v=(typeof ap==='object')?ap.score:ap; return (v==null||isNaN(Number(v)))?null:Number(v); }
  function aiRescoreChip(l){
    if(!l||!l.rescored_at) return '';
    const p=aiPrevScore(l); const why=[l.rescore_note,l.dropped_reason,l.role_reason].filter(Boolean).join(' · ');
    const when=(()=>{ try{ return noteAgo(Number(l.rescored_at)); }catch(e){ return ''; } })();
    return `<span class="chip chip-airs" data-tip="AI đã chấm lại lead này${when?' '+when:''}${p!=null?' (điểm cũ '+p+' → '+l.score+')':''}${why?' · '+esc(why):''}${machineDropped(l)?' · AI đã loại':''}">${SLI.bot} AI chấm lại${p!=null?' '+p+' → '+l.score:''}</span>`;
  }
  /* chip Đã loại: tách AI loại (máy) / người loại + lý do */
  function dropChip(l){
    if(!l||!l.dropped) return '';
    const why=l.dropped_reason?' · '+esc(String(l.dropped_reason).slice(0,60)):'';
    if(machineDropped(l)) return `<span class="chip chip-aidrop" data-tip="Máy loại (${esc(l.dropped_by||'AI')})${why?why:''}${humanCared(l)?' – bạn đang chăm nên lead vẫn hiện; bấm "AI sai – giữ lead" hoặc Khôi phục nếu muốn giữ':''}">${SLI.bot} AI loại${why}</span>`;
    return `<span class="chip chip-junk" data-tip="Người loại${l.dropped_by?' · '+esc(l.dropped_by):''}${why}">${SLI.trash} Đã loại${why}</span>`;
  }
  /* PA-4: lead là BÌNH LUẬN dưới bài người khác → chip + dòng "Bài gốc" ngay trên thẻ (trước chỉ modal có; sales chỉ thấy "Ib") */
  function parentChip(l){ if(!l||l.kind!=='comment') return ''; return `<span class="chip chip-cmt" data-tip="Lead này là 1 BÌNH LUẬN dưới bài của người khác${l.parent_author?' ('+esc(l.parent_author)+')':''} – đọc bài gốc bên dưới để hiểu khách đang hỏi gì">${SLI.message} Từ bình luận${l.parent_author?' · dưới bài của '+esc(String(l.parent_author).slice(0,28)):''}</span>`; }
  function parentLine(l){ if(!l||l.kind!=='comment'||!l.parent_text) return ''; const t=stripMd(String(l.parent_text)).replace(/\\s+/g,' ').trim(); return `<div class="ld-parent-line" title="${esc(t.slice(0,600))}"><b>Bài gốc${l.parent_author?' của '+esc(l.parent_author):''}:</b> “${esc(t.slice(0,180))}${t.length>180?'…':''}”</div>`; }
  /* hộp AI trên thẻ: NHU CẦU trước, ý định sau (khác nhau mới ghép) */
  function aiReadOf(l){ const nd=String(l&&l.need||'').trim(), it=String(l&&l.intent||'').trim(); const n=s=>s.toLowerCase().replace(/\\s+/g,' ').replace(/[.,;!…]+$/,''); if(nd&&it&&n(nd)!==n(it)) return nd+' · '+it; return nd||it; }
  /* dải vàng: AI hạ xuống rác / máy loại NHƯNG sales đang chăm → giữ lead + 2 nút 1 chạm */
  function aiBand(l){
    if(!l||!humanCared(l)||l.ai_feedback==='wrong') return '';
    const md=machineDropped(l), junk=l.temp==='junk'; if(!md&&!junk) return '';
    const p=aiPrevScore(l); const why=[l.dropped_reason,l.rescore_note,l.role_reason].filter(Boolean).join(' · ');
    return `<div class="ai-band" data-aiband="${esc(l.id)}"><span class="ic">${SLI.bot}</span><div class="bd"><b>AI chấm lại: ${md?'đã loại':'rác'}${p!=null?' ('+p+' → '+l.score+' điểm)':''}${why?' – '+esc(why):''}.</b> Bạn đang chăm nên lead vẫn giữ ở đây.</div><div class="ac"><button class="btn btn-soft btn-sm" data-aifb="${esc(l.id)}:right" title="Đồng ý với AI – loại lead này (lý do: AI đúng)">${SLI.check} Đồng ý loại</button><button class="btn btn-soft btn-sm" data-aifb="${esc(l.id)}:wrong" title="AI sai – giữ lead, gỡ cờ loại (AI ghi nhận phản hồi để tự học)">${SLI.x} AI sai – giữ lead</button></div></div>`;
  }
  function bindAiFb(root,after){
    root.querySelectorAll('[data-aifb]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const [id,fb]=String(b.dataset.aifb).split(':'); const l=D.leads.find(x=>String(x.id)===String(id)); if(!l) return;
      if(fb==='right'){ l.ai_feedback='right'; if(window.SL_FB&&window.SL_FB.updateLead) window.SL_FB.updateLead(String(l.id),{ai_feedback:'right'}).catch(()=>{}); if(l.dropped){ if(after) after(); toast('Đã ghi nhận: AI đúng – lead rời khỏi danh sách.'); } else dropLead(l.id,'Rác / spam (AI đúng)',after); return; }
      const prev={dropped:l.dropped,ai_feedback:l.ai_feedback}; l.ai_feedback='wrong'; const patch={ai_feedback:'wrong'}; if(machineDropped(l)){ l.dropped=false; Object.assign(patch,{dropped:false,restored_at:slNow(),restored_by:(window.CURRENT_USER||{}).email||''}); }
      if(after) after();
      if(window.SL_FB&&window.SL_FB.updateLead) window.SL_FB.updateLead(String(l.id),patch).then(()=>toast('Đã giữ lead – ghi nhận AI sai để hệ thống học lại.')).catch(err=>{ Object.assign(l,prev); if(after) after(); toast(errMsg(err,'Ghi phản hồi lỗi')); });
      else toast('Đã giữ lead (demo).'); }));
  }
  const SEAL_IC='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="currentColor"/>""", tag='20.fn')
rep(F20, "${botChip(l)}${roleChip(l)}${aiTempChip(l)}${l.dropped?'<span class=\"chip chip-junk\">'+SLI.trash+' Đã loại</span>':''}", "${botChip(l)}${roleChip(l)}${aiTempChip(l)}${aiRescoreChip(l)}${parentChip(l)}${dropChip(l)}", tag='20.card.chips')
rep(F20, "        <div class=\"txt\">${pb.html}</div>\n        <div class=\"tags\">", "        <div class=\"txt\">${pb.html}</div>\n        ${parentLine(l)}\n        <div class=\"tags\">", tag='20.card.parent')
rep(F20, "        ${isMulti(l)&&l.insight&&l.insight.need?panoSummary(l):(l.intent?`<div class=\"intent-note\">${SLI.sparkle||SLI.target}<div class=\"in-tx\"><span class=\"in-k\" style=\"cursor:help\" data-tip=\"AI phân tích riêng bài đăng này\">AI · đọc vị nhu cầu</span>${esc(l.intent)}</div></div>`:'')}",
"        ${isMulti(l)&&l.insight&&l.insight.need?panoSummary(l):(aiReadOf(l)?`<div class=\"intent-note\">${SLI.sparkle||SLI.target}<div class=\"in-tx\"><span class=\"in-k\" style=\"cursor:help\" data-tip=\"AI phân tích riêng bài đăng này – nhu cầu trước, ý định mua sau\">AI · nhu cầu & ý định</span>${esc(aiReadOf(l))}</div></div>`:'')}\n        ${aiBand(l)}", tag='20.card.ai')
rep(F20, "if(l.__q===undefined){ l.__q=fold([l.name,l.text,l.need,l.intent,l.industry,l.source,l.service,l.email,l.assignee,'#'+leadNo(l.id),l.id].join(' '));", "if(l.__q===undefined){ l.__q=fold([l.name,l.text,l.need,l.intent,l.industry,l.source,l.service,l.email,l.assignee,'#'+leadNo(l.id),l.id,l.parent_text,l.parent_author,l.role_reason,l.dropped_reason,l.rescore_note].join(' ')); /* v119-90 (PA-4): tìm cả bài gốc / tác giả bài gốc / lý do */", tag='20.q')
rep(F20, "              ${(()=>{ const n=(D.leads||[]).filter(feedHidden).length; return `<button data-f=\"junk\" class=\"seg-dim${feedFilter==='junk'?' active':''}\" title=\"Lead rác / đã loại / không thành – mặc định ẩn khỏi feed\">Rác · Loại${n?` <i>${n}</i>`:''}</button>`; })()}",
"              ${(()=>{ const hid=(D.leads||[]).filter(feedHidden); const n=hid.length; const a=hid.filter(l=>machineDropped(l)||(l.temp==='junk'&&!l.dropped&&!l.lost)).length; return `<button data-f=\"junk\" class=\"seg-dim${feedFilter==='junk'?' active':''}\" title=\"Lead rác / đã loại / không thành – mặc định ẩn khỏi feed${n?' · AI '+a+' · người '+(n-a):''}\">Rác · Loại${n?` <i>${n}</i><small class=\"seg-sub\">AI ${a} · người ${n-a}</small>`:''}</button>`; })()} ${''/* v119-90 (PC-6): tách AI / người */}", tag='20.rail')
rep(F20, "      card.querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); restoreLead(b.dataset.restore); }));",
"      card.querySelectorAll('[data-restore]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); restoreLead(b.dataset.restore); }));\n      bindAiFb(card,()=>{ if(view.querySelector('#feedList')){ renderFeed(); renderFeedRail(); } }); // v119-90 (PC-6)", tag='20.bind')

# =========================================================== 30-pipeline ===========================================================
rep(P30, "    const PL = D.leads.filter(l=>!l.dropped&&!l.lost);", "    const PL = D.leads.filter(l=>!l.lost&&(!l.dropped||(machineDropped(l)&&humanCared(l)))); // v119-90 (PC-6): máy loại nhưng sales đang chăm → vẫn ở pipeline (dải vàng ở thẻ)", tag='30.PL')
rep(P30, "    const all = D.leads.filter(l=>l.stage===st.key && !l.dropped && !l.lost);", "    const all = D.leads.filter(l=>l.stage===st.key && !l.lost && (!l.dropped||(machineDropped(l)&&humanCared(l)))); // v119-90", tag='30.col')
rep(P30, "          window.SL_FB.updateLead(String(l.id),{dropped:true,dropped_at:slNow(),dropped_by:(window.CURRENT_USER||{}).email||''})\n            .catch(err=>{ l.dropped=false; if(document.querySelector('#view .kanban')) pvRepaint(); toast('Loại lead lỗi: '+(err.code||err.message)); });",
"          window.SL_FB.updateLead(String(l.id),{dropped:true,dropped_at:slNow(),dropped_by:(window.CURRENT_USER||{}).email||'',dropped_reason:'Rác / spam (loại hàng loạt)'}) // v119-90: lý do\n            .catch(err=>{ l.dropped=false; if(document.querySelector('#view .kanban')) pvRepaint(); toast('Loại lead lỗi: '+(err.code||err.message)); });", tag='30.bulk')
rep(P30, """    col.querySelectorAll('[data-pv-drop]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation(); const l=D.leads.find(x=>x.id===b.dataset.pvDrop); if(!l) return;
      if(window.SL_FB&&window.SL_FB.updateLead){ // v167: ghi thật thay vì splice cục bộ
        l.dropped=true; pvRepaint(); toast('Đã loại "'+(l.name||'')+'" khỏi pipeline.');
        window.SL_FB.updateLead(String(l.id),{dropped:true,dropped_at:slNow(),dropped_by:(window.CURRENT_USER||{}).email||''})
          .catch(err=>{ l.dropped=false; if(document.querySelector('#view .kanban')) pvRepaint(); toast('Loại lead lỗi: '+(err.code||err.message)); });
      } else {
        const i=D.leads.indexOf(l); if(i>-1) D.leads.splice(i,1);
        views.pipeline(); toast('Đã loại "'+(l.name||'')+'" khỏi pipeline (demo).');
      }
    }));""",
"""    col.querySelectorAll('[data-pv-drop]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation(); const l=D.leads.find(x=>x.id===b.dataset.pvDrop); if(!l) return;
      /* v167: ghi thật thay vì splice cục bộ · v119-90 (PC-6): hỏi LÝ DO trước (dropped_reason); demo cũng đi đường này (dropLead tự xử lý khi không có SL_FB, không splice nữa) */
      const why=await pickDropReason(l.name); if(why===null) return;
      dropLead(l.id,why,()=>{ if(document.querySelector('#view .kanban')) pvRepaint(); });
    }));""", tag='30.drop')

# =========================================================== 65 modal ===========================================================
rep(M65, "${aiTempChip(l)}</div>", "${aiTempChip(l)}${aiRescoreChip(l)}${dropChip(l)}</div>", tag='65.chips')
rep(M65, "        ${panoPanel(l)}\n        <div class=\"ld-ana\">", "        ${aiBand(l)}\n        ${panoPanel(l)}\n        <div class=\"ld-ana\">", tag='65.band')
rep(M65, "<button class=\"btn btn-ghost btn-sm\" id=\"lostBtn\" style=\"color:#d92d20\">${SLI.x} Không thành</button>`)}",
"<button class=\"btn btn-ghost btn-sm\" id=\"lostBtn\" style=\"color:#d92d20\">${SLI.x} Không thành</button>${l.dropped?`<button class=\"btn btn-ghost btn-sm\" id=\"undropBtn\" title=\"Đưa lead trở lại pipeline\">↩ Khôi phục</button>`:`<button class=\"btn btn-ghost btn-sm\" id=\"dropBtn\" title=\"Loại khỏi pipeline – chọn lý do (lead vẫn trong kho, khôi phục được)\">${SLI.trash} Loại</button>`}`)}", tag='65.btn')
rep(M65, "    document.getElementById('lostBtn')?.addEventListener('click',()=>showForm('lostForm'));",
"""    document.getElementById('lostBtn')?.addEventListener('click',()=>showForm('lostForm'));
    /* v119-90 (PC-6): Loại có lý do ngay trong modal + khôi phục + 2 nút phản hồi AI trên dải vàng */
    document.getElementById('dropBtn')?.addEventListener('click',async()=>{ const why=await pickDropReason(l.name); if(why===null) return; dropLead(l.id,why,rerender); });
    document.getElementById('undropBtn')?.addEventListener('click',()=>{ restoreLead(l.id); rerender(); });
    bindAiFb(modal,rerender);""", tag='65.handlers')
rep(M65, "    if(l.dropped_at&&l.dropped) push(l.dropped_at,'Loại khỏi pipeline'+(l.dropped_by?' · '+l.dropped_by:''),'lost',SLI.trash);",
"""    if(l.dropped_at&&l.dropped) push(l.dropped_at,(machineDropped(l)?'AI loại khỏi pipeline':'Loại khỏi pipeline')+(l.dropped_reason?' · '+l.dropped_reason:'')+(l.dropped_by&&!machineDropped(l)?' · '+l.dropped_by:''),'lost',machineDropped(l)?SLI.bot:SLI.trash); // v119-90: AI/người + lý do
    if(l.rescored_at){ const ap=l.ai_prev, p=(ap!=null&&typeof ap==='object')?ap.score:ap; push(l.rescored_at,'AI chấm lại'+(p!=null&&!isNaN(Number(p))?': '+p+' → '+l.score+' điểm':'')+(l.rescore_note?' · '+l.rescore_note:''),'bot',SLI.bot); } // v119-90 (LỆNH #46/#48 sweeper)
    if(l.ai_feedback==='wrong') push(l.restored_at||l.rescored_at||l.dropped_at,'Sales báo AI sai – giữ lead','',SLI.hand); // v119-90 (PC-6)""", tag='65.tl')

# =========================================================== 70 shell ===========================================================
rep(T70, "    toast(st===401||st===403?'Không có quyền quét quá khứ (hoặc phiên đăng nhập hết hạn) – đăng nhập lại rồi thử.':('Quét quá khứ không chạy được: '+((e&&e.message)||'lỗi kết nối')));",
"    toast(st===401||st===403?'Không có quyền quét quá khứ (hoặc phiên đăng nhập hết hạn) – đăng nhập lại rồi thử.':(st===409?'Máy chủ đang chạy một lượt quét khác (khoá lượt) – chờ ~1 phút rồi bấm lại.':('Quét quá khứ không chạy được: '+((e&&e.message)||'lỗi kết nối')))); // v119-90 (LỆNH B): 409 busy", tag='70.409')
rep(T70, "      if(sourceUrl) body.sourceUrl=sourceUrl;\n", "      if(sourceUrl) body.sourceUrl=sourceUrl;\n      if(opts.sourceId) body.sourceId=String(opts.sourceId); // v119-90 (LỆNH B): quét thử đúng nguồn (1 group nhiều brand → cần id nguồn, không chỉ URL)\n", tag='70.sid')
rep(T70, "    const L=(D.leads||[]).filter(l=>l&&!l.dropped&&!l.lost&&(l.stage==='responded'||l.outreach_replied||(l.outreach&&l.outreach.replied_at)));", "    const L=(D.leads||[]).filter(l=>l&&!leadOut(l)&&(l.stage==='responded'||l.outreach_replied||(l.outreach&&l.outreach.replied_at))); // v119-90", tag='70.replies')

# =========================================================== 50 config: Nguồn quét + form + nhịp + cảnh báo ===========================================================
rep(C50, "  function srcRow(s){\n    const maxLeads=Math.max(1,...D.sources.map(x=>x.leads||0));",
"""  /* ===== v119-90 (LỆNH B/C): 1 group nhiều brand + nhịp thích ứng + sức khoẻ nguồn ===== */
  function srcGid(s){ const m=/facebook\\.com\\/groups\\/([^/?#]+)/i.exec(String((s&&s.url)||'')); return m?m[1].toLowerCase():String((s&&s.gid)||'').toLowerCase(); }
  function srcSharedWith(s){ const g=srcGid(s); if(!g) return []; const me=String(s.brand||''); const out=[]; (D.sources||[]).forEach(x=>{ if(x&&x!==s&&String(x.id)!==String(s.id)&&srcGid(x)===g&&String(x.brand||'')!==me) out.push(x.brand||'(chưa gán)'); }); return [...new Set(out)]; }
  function srcGroupState(s){ const gs=D.groupState||{}; const g=srcGid(s); if(!g) return null; if(/^\\d{5,}$/.test(g)&&gs['g_'+g]) return gs['g_'+g]; const bySlug=gs['s_'+g]; if(bySlug) return bySlug; for(const k in gs){ const x=gs[k]; if(x&&x.gidNum&&String(x.gidNum)===g) return x; if(x&&x.url&&srcGid({url:x.url})===g) return x; } return null; }
  function srcHealthOf(s){ const h=D.srcHealth||{}; return h[String(s.id)]||h[String(s._id||'')]||null; }
  function srcHealth7(h){ const out={posts:0,leads:0,hot:0,err:0}; if(!h||!h.days) return out; const keys=Object.keys(h.days).sort().slice(-7); keys.forEach(k=>{ const d=h.days[k]||{}; out.posts+=Number(d.posts)||0; out.leads+=Number(d.leads)||0; out.hot+=Number(d.hot)||0; out.err+=Number(d.err)||0; }); return out; }
  function srcBad(s){ const sh=(D.sysScan&&D.sysScan.health)||null; if(!sh||!Array.isArray(sh.bad)) return null; return sh.bad.find(b=>b&&(String(b.id)===String(s.id)||String(b.id)===String(s._id||'')))||null; }
  const SRC_BAND_VI={fast:['nhanh','Group đang sôi động – gieo mỗi nhịp sàn'],mid:['vừa','Group có bài đều – gieo ~10′'],slow:['chậm','Ít bài mới – gieo tới trần'],idle:['im','>6 h không bài mới – gieo thưa nhất; có bài lại tự lên nhanh']};
  function srcHealthChips(s){
    if(!roleIsSuper()) return '';
    const parts=[]; const shared=srcSharedWith(s);
    if(shared.length) parts.push(`<span class="chip chip-shared" data-tip="Group này còn được brand ${esc(shared.join(', '))} quét – 2 brand cùng đọc 1 group, lead tách riêng theo Hồ sơ AI mỗi brand (theo thiết kế, Super Admin được báo)">${SLI.users} Dùng chung · ${esc(shared.join(', '))}</span>`);
    const gs=srcGroupState(s);
    if(gs&&gs.band){ const b=SRC_BAND_VI[gs.band]||[gs.band,'']; const lp=gs.lastPostAt?noteAgo(gs.lastPostAt):''; parts.push(`<span class="chip chip-band band-${esc(gs.band)}" data-tip="Nhịp gieo thích ứng: ${esc(b[1])}${gs.iv?' · đang '+gs.iv+'′':''}${gs.rate?' · ~'+gs.rate+' bài/giờ':''}${lp?' · bài mới cuối '+esc(lp):''}">${SLI.refresh} Nhịp ${esc(b[0])}${gs.iv?' '+gs.iv+'′':''}</span>`); }
    const h=srcHealthOf(s); const bad=srcBad(s);
    if(bad) parts.push(`<span class="chip chip-hot" data-tip="Máy chủ đánh dấu nguồn có vấn đề: ${esc(bad.why||'')}${bad.p7!=null?' · 7 ngày: '+bad.p7+' bài / '+(bad.l7||0)+' lead':''}">${SLI.warning} ${esc(bad.why||'có vấn đề')}</span>`);
    else if(h){ const w=srcHealth7(h); parts.push(`<span class="chip chip-junk" data-tip="7 ngày gần nhất: ${w.posts} bài quét · ${w.leads} lead (${w.hot} nóng)${w.err?' · '+w.err+' lượt BrightData lỗi':''}${h.errStreak?' · đang lỗi '+h.errStreak+' lượt liên tiếp':''}${h.lastLeadAt?' · lead cuối '+esc(noteAgo(Number(h.lastLeadAt))):''}">${SLI.checkCircle} 7 ngày ${w.posts} bài · ${w.leads} lead</span>`); }
    return parts.join('');
  }
  function srcRow(s){
    const maxLeads=Math.max(1,...D.sources.map(x=>x.leads||0));""", tag='50.helpers')
rep(C50, "title=\"Chế độ AI riêng của group\">AI: ${s.aiMode==='max'?'Max':'Tiết kiệm'}</span>`:''}</div></div>", "title=\"Chế độ AI riêng của group\">AI: ${s.aiMode==='max'?'Max':'Tiết kiệm'}</span>`:''}${srcHealthChips(s)}</div></div>", tag='50.row')
rep(C50, "<div class=\"sub\">Group / fanpage / cộng đồng công khai · thanh màu = mức đóng góp lead (đỏ = tỉ lệ nóng)</div>", "<div class=\"sub\">Group / fanpage / cộng đồng công khai · thanh màu = mức đóng góp lead (đỏ = tỉ lệ nóng)${roleIsSuper()?' · chip Nhịp = nhịp gieo thích ứng theo group · 1 group có thể phục vụ nhiều brand (chip Dùng chung)':''}</div>", tag='50.sub')
rep(C50, "      if(!s.id && (D.sources||[]).some(x=>String(x.id)===id)){ toast('Nguồn này đã có trong danh sách (\"'+id+'\") – sửa nguồn cũ thay vì thêm mới.'); return; }\n      if(window.SL_FB&&window.SL_FB.setSource){ try{ await window.SL_FB.setSource(id,data); toast('Đã lưu nguồn.'); closeModal(); }catch(e){ toast(errMsg(e)); } }\n      else { toast('Demo – bật Firebase để lưu.'); closeModal(); }",
"""      /* v119-90 (LỆNH B): trùng = CÙNG brand + cùng group; group đã thuộc brand KHÁC → hỏi rồi vẫn tạo (dùng chung, lead tách riêng theo brand) */
      const gidL=gid.toLowerCase(); const myB=String(data.brand||'');
      if(!s.id && (D.sources||[]).some(x=>String(x.id)===id||(gidL&&srcGid(x)===gidL&&String(x.brand||'')===myB))){ toast('Brand này đã có nguồn cho group này – sửa nguồn cũ thay vì thêm mới.'); return; }
      if(!s.id && gidL){ const others=[...new Set((D.sources||[]).filter(x=>srcGid(x)===gidL&&String(x.brand||'')!==myB).map(x=>x.brand||'(chưa gán)'))];
        if(others.length && !await slConfirm('Group này đang được brand '+others.join(', ')+' quét. Vẫn tạo cho brand '+(myB||'(chưa gán)')+'? Hai brand cùng đọc 1 group, lead tách riêng theo Hồ sơ AI mỗi brand; Bright Data chỉ quét 1 lần.',{title:'Group đã có brand khác dùng',ok:'Vẫn tạo (dùng chung)'})) return; }
      if(!s.id && window.SL_FB && window.SL_FB.createSource){
        try{ const r=await window.SL_FB.createSource(Object.assign({},data,{id})); const extra={}; ['aiMode','authAccountId','groupId'].forEach(k=>{ if(data[k]) extra[k]=data[k]; }); if(Object.keys(extra).length&&r&&r.id&&window.SL_FB.setSource) await window.SL_FB.setSource(String(r.id),extra); // CF createSource chỉ giữ field lõi → ghi thêm field super
          toast(r&&r.shared?('Đã tạo nguồn – group dùng chung với brand '+((r.sharedWith||[]).join(', ')||'khác')+' (lead tách riêng theo brand).'):'Đã tạo nguồn.'); closeModal(); }
        catch(e){ if(e&&e.status===409) toast(e.code==='duplicate_name'?'Brand này đã có nguồn cùng tên – đổi tên khác.':('Brand này đã có nguồn cho group này'+(e.message?' ('+String(e.message).replace(/^createSource: /,'')+')':'')+' – sửa nguồn cũ thay vì thêm mới.')); else toast(errMsg(e,'Tạo nguồn lỗi')); }
      }
      else if(window.SL_FB&&window.SL_FB.setSource){ try{ await window.SL_FB.setSource(id,data); toast('Đã lưu nguồn.'); closeModal(); }catch(e){ toast(errMsg(e)); } }
      else { toast('Demo – bật Firebase để lưu.'); closeModal(); }""", tag='50.form')
rep(C50, "          ${miniStat('Tần suất', 'Lịch 3 phút · gieo mỗi nguồn '+scanIv()+'′')}", "          ${miniStat('Tần suất', 'Lịch 3 phút · nhịp thích ứng theo group, sàn '+scanIv()+'′ – trần 30′')}", tag='50.iv1')
rep(C50, "          <label for=\"scanIvMin\" style=\"font-size:13px;font-weight:700\">Nhịp gieo mỗi nguồn</label>", "          <label for=\"scanIvMin\" style=\"font-size:13px;font-weight:700\" title=\"Từ LỆNH B: mỗi group tự chọn nhịp 5′ → 30′ theo tốc độ ra bài (EWMA); ô này là SÀN – group sôi động không gieo dày hơn số này\">Sàn nhịp gieo (nhịp thích ứng)</label>", tag='50.iv2')
rep(C50, "    const sl=D.sysLlm||null; if(sl&&sl.ok===false) add(SLI.bot,'AI chấm điểm (OpenAI) đang LỖI – bài mới xếp hàng chờ chấm lại, chưa thành lead',[(sl.since?'từ '+new Date(+sl.since).toLocaleString('vi-VN'):''),(sl.runs?sl.runs+' lượt quét lỗi':''),(sl.kind?'lỗi '+sl.kind:''),(sl.sample||'')].filter(Boolean).join(' · '),'history','bad'); // v119-89 LỆNH #46",
"""    const sl=D.sysLlm||null; if(sl&&sl.ok===false) add(SLI.bot,'AI chấm điểm (OpenAI) đang LỖI – bài mới xếp hàng chờ chấm lại, chưa thành lead',[(sl.since?'từ '+new Date(+sl.since).toLocaleString('vi-VN'):''),(sl.runs?sl.runs+' lượt quét lỗi':''),(sl.kind?'lỗi '+sl.kind:''),(sl.sample||'')].filter(Boolean).join(' · '),'history','bad'); // v119-89 LỆNH #46
    /* v119-90 (LỆNH #48): tầng 1 (tiền lọc) lỗi → bài đi thẳng chấm sâu (không mất lead, tốn hơn); cầu dao AI mở trong lượt → bài xếp hàng */
    if(sl&&sl.ok!==false&&sl.pre===false) add(SLI.bot,'AI tiền lọc (tầng 1) đang lỗi – bài đi thẳng chấm sâu, chi phí cao hơn (không mất lead)',[(sl.preSince?'từ '+new Date(+sl.preSince).toLocaleString('vi-VN'):''),(sl.preFails?sl.preFails+' lần lỗi':''),(sl.preSample||'')].filter(Boolean).join(' · '),'history','warn');
    if(sl&&sl.cbOpen) add(SLI.bot,'Cầu dao AI đang MỞ trong lượt quét (3 bài hỏng liên tiếp) – bài còn lại xếp hàng chấm lại',(sl.cbAt?'lúc '+new Date(+sl.cbAt).toLocaleString('vi-VN'):''),'history','warn');
    /* v119-90 (LỆNH C): nguồn có vấn đề do máy chủ chấm mỗi 5′ (không ra lead ≥15 bài/7 ngày · im lặng >48 h · BrightData lỗi ≥6 lượt) */
    { const sh=(D.sysScan&&D.sysScan.health)||null; if(sh&&Array.isArray(sh.bad)&&sh.bad.length){ const sev=(sh.bad.length>=3&&sh.bad.length*2>=(Number(sh.active)||0))?'bad':'warn';
      add(SLI.target,sh.bad.length+' nguồn quét có vấn đề (không ra lead / im lặng / Bright Data lỗi liên tiếp)',sh.bad.slice(0,4).map(b=>(b.name||b.id)+(b.brand?' ['+b.brand+']':'')+': '+(b.why||'')).join(' · ')+(sh.bad.length>4?' · …':''),'sources',sev); } }
    /* v119-90 (LỆNH B): group dùng chung giữa ≥2 brand — theo thiết kế (lead tách riêng), chỉ nhắc để super biết */
    { const g={}; (D.sources||[]).forEach(s=>{ const k=srcGid(s); if(!k) return; (g[k]=g[k]||new Set()).add(String(s.brand||'')); }); const shared=Object.entries(g).filter(([k,v])=>v.size>=2); if(shared.length) add(SLI.users,shared.length+' group đang phục vụ nhiều brand (dùng chung)',shared.slice(0,4).map(([k,v])=>k+': '+[...v].map(x=>x||'(chưa gán)').join(' + ')).join(' · ')+' · Bright Data quét 1 lần, lead tách riêng theo brand','sources','warn'); }""", tag='50.alerts')

# =========================================================== 60 scan views: DECIS no_text + biểu đồ máy chủ ===========================================================
rep(V60, "    ai_wait:         {label:'Chờ AI chấm lại', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'}, /* v119-89 LỆNH #46 */", "    ai_wait:         {label:'Chờ AI chấm lại', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'}, /* v119-89 LỆNH #46 */\n    no_text:         {label:'Bài không chữ · bỏ', color:'var(--junk,#6E7691)', bg:'var(--junk-bg,#EEF0F5)'}, /* v119-90 LỆNH #48 */", tag='60.decis')
rep(V60, "      case 'excluded':\n        return `Bài bị <b>lọc rác</b>", "      case 'no_text':\n        return `Bài <b>không có chữ</b> (chỉ ảnh/video/link hoặc nội dung trống) nên không đưa vào AI – trước LỆNH #48 bị đếm nhầm vào \"lọc rác\".`; /* v119-90 */\n      case 'excluded':\n        return `Bài bị <b>lọc rác</b>", tag='60.reason')
rep(V60, "error:0,ai_wait:0,self_comment:0,seller:0}", "error:0,ai_wait:0,no_text:0,self_comment:0,seller:0}", tag='60.count')
rep(V60, "      trend:{ labels:days.map(d=>d.getDate()+'/'+(d.getMonth()+1)), posts:days.map(d=>onDay(d,'postsFetched')), leads:days.map(d=>onDay(d,'leadsCreated')) } };\n  }",
"""      trend:(()=>{ /* v119-90 (PA-11): ưu tiên BỘ ĐẾM MÁY CHỦ daily_stats (scanned/new mọi lượt, LỆNH #39/#41/C) — 300 lượt đã nạp chỉ phủ ~1 ngày nên biểu đồ 14 ngày từ scans bị cụt */
        const ds=(D.dailyStats||[]); const srv=new Map(); ds.forEach(x=>{ if(!x||!x.day) return; const a=srv.get(x.day)||{scanned:0,leads:0}; a.scanned+=Number(x.scanned)||0; a.leads+=Number(x.new)||0; srv.set(x.day,a); });
        const keys=days.map(d=>vnDayKey(d.getTime())); const useSrv=keys.some(k=>srv.has(k));
        return { labels:days.map(d=>d.getDate()+'/'+(d.getMonth()+1)), src:useSrv?'server':'local',
          posts:useSrv?keys.map(k=>(srv.get(k)||{}).scanned||0):days.map(d=>onDay(d,'postsFetched')), leads:useSrv?keys.map(k=>(srv.get(k)||{}).leads||0):days.map(d=>onDay(d,'leadsCreated')) }; })() };
  }""", tag='60.trend')
rep(V60, "'Bài đã quét (1.000 lượt gần nhất)'", "'Bài đã quét ('+fmt(A.list.length)+' lượt đã nạp)'", tag='60.lb1')
rep(V60, "<div class=\"card-head\"><div><h3>Bài quét & Lead theo ngày</h3><div class=\"sub\">14 ngày gần nhất</div></div>", "<div class=\"card-head\"><div><h3>Bài quét & Lead theo ngày</h3><div class=\"sub\">${A.trend.src==='server'?'14 ngày gần nhất · bộ đếm máy chủ (mọi lượt, mọi brand)':'14 ngày gần nhất · từ '+fmt(A.list.length)+' lượt đã nạp'}</div></div>", tag='60.lb2')
rep(V60, "<div class=\"sub\">Trong 1.000 lượt quét gần nhất đã nạp</div>", "<div class=\"sub\">Trong ${fmt(A.list.length)} lượt quét gần nhất đã nạp</div>", tag='60.lb3')

# =========================================================== 87 wizard: nguồn dùng chung + createSource + Quét thử sourceId ===========================================================
rep(W87, "      out.push({id,gid,url:'https://www.facebook.com/groups/'+gid+'/',name:nm||('Group '+gid),dup:old?(old.brand||'(chưa gán brand)'):''});",
"      const sameB=old&&String(old.brand||'')===String(WZ.code||''); // v119-90 (LỆNH B): trùng = cùng brand; brand khác = dùng chung (vẫn tạo)\n      out.push({id,gid,url:'https://www.facebook.com/groups/'+gid+'/',name:nm||('Group '+gid),dup:sameB?(old.brand||'(chưa gán brand)'):'',shared:(old&&!sameB)?(old.brand||'(chưa gán brand)'):''});", tag='87.parse')
rep(W87, "        :r.dup?`<div class=\"wz-srow warn\">↷ <b>${esc(r.name)}</b> <code>${esc(r.gid)}</code> · đã có trong hệ thống (brand: ${esc(r.dup)}) – bỏ qua</div>`",
"        :r.dup?`<div class=\"wz-srow warn\">↷ <b>${esc(r.name)}</b> <code>${esc(r.gid)}</code> · brand này đã có nguồn cho group (${esc(r.dup)}) – bỏ qua</div>`\n        :r.shared?`<div class=\"wz-srow warn\">${SLI.users} <b>${esc(r.name)}</b> <code>${esc(r.gid)}</code> · group đang thuộc brand <b>${esc(r.shared)}</b> – vẫn tạo cho ${esc(WZ.code)} (dùng chung, lead tách riêng)</div>`", tag='87.paint')
rep(W87, "      await wzCall('setSource',[r.id,data],()=>{ (D.sources=D.sources||[]).push(Object.assign({id:r.id,_id:r.id,status:'active',leads:0,hot:0},data)); });\n      WZ.done.src++;",
"""      if(window.SL_FB&&window.SL_FB.createSource){ // v119-90 (LỆNH B): id <gid>__<brand> do CF đặt, kiểm trùng cùng brand ở máy chủ
        try{ await window.SL_FB.createSource(Object.assign({id:r.id},data)); }
        catch(e){ if(e&&e.status===409){ WZ.done.srcDup=(WZ.done.srcDup||0)+1; continue; } throw e; }
      } else await wzCall('setSource',[r.id,data],()=>{ (D.sources=D.sources||[]).push(Object.assign({id:r.id,_id:r.id,status:'active',leads:0,hot:0},data)); });
      WZ.done.src++;""", tag='87.save')
rep(W87, "    if(rows.length) toast('Đã thêm '+rows.length+' nguồn cho brand '+WZ.code+'.');", "    if(rows.length) toast('Đã thêm '+(rows.length-(WZ.done.srcDup||0))+' nguồn cho brand '+WZ.code+(WZ.done.srcDup?' ('+WZ.done.srcDup+' đã có, bỏ qua)':'')+'.');", tag='87.toast')
rep(W87, "<select class=\"acs-in\" id=\"wzTrySrc\">${srcAll.map(s=>`<option value=\"${esc(s.url||'')}\">${esc(s.name||s.url||s.id||'')}</option>`).join('')}</select>", "<select class=\"acs-in\" id=\"wzTrySrc\">${srcAll.map(s=>`<option value=\"${esc(s.url||'')}\" data-sid=\"${esc(s.id||s._id||'')}\">${esc(s.name||s.url||s.id||'')}</option>`).join('')}</select>", tag='87.trySel')
rep(W87, "wzClose(); openBackfill(url,nm,{numPosts:15,range:'7d'}); });", "const sid=sel&&sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].dataset.sid:''; wzClose(); openBackfill(url,nm,{numPosts:15,range:'7d',sourceId:sid||''}); }); // v119-90: sourceId (1 group nhiều brand)", tag='87.try')

# =========================================================== 25 agency: AI loại ===========================================================
rep(A25, "function agyEmpty(){ return {slaOk:0,slaN:0,new:0,hot:0,warm:0,cold:0,junk:0,contacted:0,responded:0,booked:0,closed:0,lost:0,dropped:0,", "function agyEmpty(){ return {slaOk:0,slaN:0,new:0,hot:0,warm:0,cold:0,junk:0,contacted:0,responded:0,booked:0,closed:0,lost:0,dropped:0,aiDropped:0,", tag='25.empty')
rep(A25, "<div class=\"agy-kv\"><span>Không thành / loại</span><b>${fmt(w.lost)} / ${fmt(w.dropped)}</b></div>", "<div class=\"agy-kv\"><span>Không thành / loại</span><b>${fmt(w.lost)} / ${fmt(w.dropped)}${w.aiDropped?' <small class=\"muted\">· AI loại '+fmt(w.aiDropped)+'</small>':''}</b></div>", tag='25.row')

# =========================================================== CSS ===========================================================
rep(CSS, ".ld-parent p { margin: 6px 0 0; white-space: pre-wrap; background: var(--junk-bg, #EEF0F5); padding: 8px 10px; border-radius: 10px; }",
""".ld-parent p { margin: 6px 0 0; white-space: pre-wrap; background: var(--junk-bg, #EEF0F5); padding: 8px 10px; border-radius: 10px; }
/* v119-90: PA-4 bài gốc trên thẻ · PC-6 AI chấm lại / AI loại / dải vàng · LỆNH B chip dùng chung + nhịp */
.ld-parent-line { margin: 4px 0 2px; font-size: 13px; color: var(--ink-600); background: var(--junk-bg, #EEF0F5); padding: 6px 10px; border-radius: 10px; line-height: 1.45; }
.ld-parent-line b { color: var(--ink-700); font-weight: 600; }
.chip-cmt { background: #eef2ff; color: #3730a3; border-color: transparent; }
.chip-airs { background: #eef2ff; color: #3730a3; border-color: transparent; }
.chip-aidrop { background: #fef3e2; color: #b45309; border-color: transparent; }
.chip-shared { background: #ecfdf5; color: #047857; border-color: transparent; }
.chip-band { background: rgba(16,18,35,.06); color: var(--ink-600); border-color: transparent; }
.chip-band.band-fast { background: #e7f7f0; color: #047857; }
.chip-band.band-idle { background: rgba(16,18,35,.05); color: var(--ink-400); }
.chip-cmt .i, .chip-airs .i, .chip-aidrop .i, .chip-shared .i, .chip-band .i { width: 12px; height: 12px; }
.ai-band { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 8px 0 2px; padding: 8px 12px; border: 1px solid #f5d0a0; background: #fff7e6; border-radius: 12px; font-size: 13px; color: #7c4a00; }
.ai-band .ic { display: inline-flex; width: 18px; height: 18px; flex: none; color: #b45309; }
.ai-band .ic .i, .ai-band .ic svg { width: 18px; height: 18px; }
.ai-band .bd { flex: 1 1 240px; min-width: 0; }
.ai-band .ac { display: flex; gap: 6px; flex-wrap: wrap; }
.seg-sub { display: block; font-size: 10px; font-weight: 500; opacity: .75; line-height: 1.1; }
.sl-dlg select.acs-in { width: 100%; margin-top: 4px; }""", tag='css')

# =========================================================== ESM ===========================================================
if ESM:
    rep(C10, "slPrompt, softRender, stageLabel,", "slPrompt, slDialog, machineDropped, humanCared, aiHidden, leadOut, softRender, stageLabel,", tag='10.esmExport')
    rep(F20, "slNow, softRender, stageLabel, tempLabel, todayBoard, view, views, vnDayKey, vnDayStart } from './10-core-overview.js';", "slNow, softRender, stageLabel, tempLabel, todayBoard, view, views, vnDayKey, vnDayStart, slDialog, machineDropped, humanCared, leadOut } from './10-core-overview.js';", tag='20.esmImport')
    rep(F20, "restoreLead, roleChip, aiTempChip, setFeedQuery,", "restoreLead, roleChip, aiTempChip, aiRescoreChip, dropChip, parentChip, aiBand, bindAiFb, dropLead, pickDropReason, setFeedQuery,", tag='20.esmExport')
    rep(P30, "slConfirm, slNow, stageLabel, view, views, vnDayStart } from './10-core-overview.js';", "slConfirm, slNow, stageLabel, view, views, vnDayStart, machineDropped, humanCared } from './10-core-overview.js';", tag='30.esmImport10')
    rep(P30, "import { crmCfg, fuChip, isMine, openAssignDialog, renderFeed, renderFeedRail, slaChip } from './20-feed.js';", "import { crmCfg, fuChip, isMine, openAssignDialog, renderFeed, renderFeedRail, slaChip, dropLead, pickDropReason } from './20-feed.js';", tag='30.esmImport20')
    rep(M65, "slConfirm, slNow, stageLabel, view, vnDayStart } from './10-core-overview.js';", "slConfirm, slNow, stageLabel, view, vnDayStart, machineDropped } from './10-core-overview.js';", tag='65.esmImport10')
    rep(M65, "restoreLead, roleChip, aiTempChip, setLeadNotes,", "restoreLead, roleChip, aiTempChip, aiRescoreChip, dropChip, aiBand, bindAiFb, dropLead, pickDropReason, setLeadNotes,", tag='65.esmImport20')
    rep(T70, "scoreColor, todayBoard, view, views } from './10-core-overview.js';", "scoreColor, todayBoard, view, views, leadOut } from './10-core-overview.js';", tag='70.esmImport10')
    rep(V60, "slChart, startBdBudgetAuto, view, views } from './10-core-overview.js';", "slChart, startBdBudgetAuto, view, views, vnDayKey } from './10-core-overview.js';", tag='60.esmImport10')
    rep(C50, "import { fmtWhen, kpiCard } from './20-feed.js';", "import { fmtWhen, kpiCard, noteAgo } from './20-feed.js';", tag='50.esmImport20')

# =========================================================== smoke ===========================================================
# check cũ đổi kỳ vọng theo hành vi mới: (a) wizard: group đã thuộc brand khác giờ VẪN tạo cho brand mới (dùng chung) → +2 nguồn, ô Quét thử 2 lựa chọn; (b) miniStat nhịp = "sàn N′"
rep(SM, "(wz5.step === 'crm' && wz5.src === 1 && wz5.srcKw >= 5 && wz5.kw > kwBefore && wz5.presets === 3) ? ok(`Wizard: +1 nguồn gán brand (${wz5.srcKw} keyword riêng nguồn)", "(wz5.step === 'crm' && wz5.src === 2 && wz5.srcKw >= 5 && wz5.kw > kwBefore && wz5.presets === 3) ? ok(`Wizard: +2 nguồn gán brand (1 dùng chung với brand khác – v119-90) (${wz5.srcKw} keyword riêng nguồn)", tag='smoke.wz5')
rep(SM, "(wz7b.opts === 1 && wz7b.btn && /facebook\\.com\\/groups\\//.test(wz7b.url)) ? ok('v119-57: Hoàn tất có ô chọn nguồn (1 nguồn vừa tạo) + nút Quét thử nguồn này')", "(wz7b.opts === 2 && wz7b.btn && /facebook\\.com\\/groups\\//.test(wz7b.url)) ? ok('v119-57: Hoàn tất có ô chọn nguồn (2 nguồn vừa tạo, 1 dùng chung) + nút Quét thử nguồn này')", tag='smoke.wz7b')
rep(SM, "stat: /gieo mỗi nguồn 10′/.test(document.body.textContent) }));", "stat: /sàn 10′/.test(document.body.textContent) }));", tag='smoke.iv0')
rep(SM, "stat: /gieo mỗi nguồn 15′/.test(document.body.textContent) }));", "stat: /sàn 15′/.test(document.body.textContent) }));", tag='smoke.iv1')
rep(SM, "  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');",
r"""  // ===== v119-90: PA-4 thẻ comment-lead kể đủ chuyện · PC-6 lead đang chăm bị AI hạ vẫn hiện (dải vàng + 2 nút) · Loại có lý do · Rác·Loại tách AI/người · PA-11 biểu đồ máy chủ · FE LỆNH B (chip Dùng chung/Nhịp/sức khoẻ, cảnh báo) · bản min =====
  await page.evaluate(() => { const D = window.SL_DATA; const L = D.leads.filter(x => !x.dropped && !x.lost && x.stage !== 'closed'); const c = L[0], m = L[1], j = L[2];
    [c, m, j].forEach(l => { l.__bk = { assignee: l.assignee, first_care_at: l.first_care_at, last_touch_at: l.last_touch_at, temp: l.temp, stage: l.stage, stage_at: l.stage_at, group_count: l.group_count, insight: l.insight, ai_feedback: l.ai_feedback }; delete l.assignee; delete l.first_care_at; delete l.last_touch_at; delete l.ai_feedback; l.stage = 'new'; delete l.stage_at; l.group_count = 0; delete l.insight; if (l.temp === 'junk') l.temp = 'warm'; });
    c.__k90 = 'c'; c.kind = 'comment'; c.parent_author = 'Kim Oanh Seafood'; c.parent_text = 'Cá lóc khô tẩm ớt loại 1 giao tận nơi, inbox em nhé'; c.need = 'Hỏi giá cá lóc khô'; c.intent = 'Muốn mua thử 2 kg';
    m.__k90 = 'm'; m.dropped = true; m.dropped_by = 'rescore_role'; m.dropped_reason = 'AI: người bán'; m.rescored_at = Date.now() - 3600e3; m.ai_prev = { score: 90, temp: 'hot' }; m.assignee = 'Lan'; m.first_care_at = Date.now() - 7200e3;
    j.__k90 = 'j'; j.dropped = true; j.dropped_by = 'rescore'; j.rescored_at = Date.now() - 3600e3; j.ai_prev = 88;
    location.hash = 'pipeline'; window.SLApp.reload(D); }); await page.waitForTimeout(300);
  await page.evaluate(() => { location.hash = 'feed'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500); // rời feed rồi quay lại: header bộ lọc (chip Rác · Loại) vẽ lại đủ
  const k90a = await page.evaluate(() => { const D = window.SL_DATA; const c = D.leads.find(x => x.__k90 === 'c'), m = D.leads.find(x => x.__k90 === 'm'), j = D.leads.find(x => x.__k90 === 'j'); const q = s => document.querySelector('#feedList [data-lead="' + s + '"]');
    const cc = q(c.id), mc = q(m.id), jc = q(j.id); const rail = document.querySelector('#view [data-f="junk"]');
    return { cChip: cc ? (cc.querySelector('.chip-cmt') || {}).textContent || '' : '', cLine: cc ? (cc.querySelector('.ld-parent-line') || {}).textContent || '' : '', cAi: cc ? (cc.querySelector('.intent-note') || {}).textContent || '' : '',
      mShown: !!mc, mBand: mc ? (mc.querySelector('.ai-band') || {}).textContent || '' : '', mChip: mc ? (mc.querySelector('.chip-airs') || {}).textContent || '' : '', mDrop: mc ? (mc.querySelector('.chip-aidrop') || {}).textContent || '' : '', jShown: !!jc, rail: rail ? rail.textContent : '', railTip: rail ? rail.title : '' }; });
  (/Từ bình luận · dưới bài của Kim Oanh Seafood/.test(k90a.cChip) && /Bài gốc của Kim Oanh Seafood:/.test(k90a.cLine) && /Cá lóc khô tẩm ớt/.test(k90a.cLine) && /Hỏi giá cá lóc khô · Muốn mua thử 2 kg/.test(k90a.cAi)
    && k90a.mShown && /AI chấm lại: đã loại \(90 → \d+ điểm\) – AI: người bán/.test(k90a.mBand) && /Bạn đang chăm nên lead vẫn giữ/.test(k90a.mBand) && /AI chấm lại 90 → \d+/.test(k90a.mChip) && /AI loại · AI: người bán/.test(k90a.mDrop) && !k90a.jShown && /AI 1 · người/.test(k90a.railTip))
    ? ok('v119-90: thẻ comment-lead có chip "Từ bình luận · dưới bài của …" + dòng Bài gốc + AI nhu cầu·ý định; lead sales đang chăm bị AI loại VẪN HIỆN (dải vàng 90 → điểm mới, chip AI chấm lại, chip AI loại); lead AI loại chưa ai chăm vẫn ẩn; Rác·Loại tách AI/người') : fail('v119-90 thẻ: ' + JSON.stringify(k90a));
  await page.evaluate(() => { const m = window.SL_DATA.leads.find(x => x.__k90 === 'm'); const b = document.querySelector('#feedList [data-lead="' + m.id + '"] [data-aifb$=":wrong"]'); b.click(); }); await page.waitForTimeout(300);
  const k90b = await page.evaluate(() => { const D = window.SL_DATA; const m = D.leads.find(x => x.__k90 === 'm'); const mc = document.querySelector('#feedList [data-lead="' + m.id + '"]'); return { dropped: m.dropped, fb: m.ai_feedback, band: !!(mc && mc.querySelector('.ai-band')), shown: !!mc }; });
  (k90b.dropped === false && k90b.fb === 'wrong' && !k90b.band && k90b.shown) ? ok('v119-90: "AI sai – giữ lead" → gỡ cờ loại + ai_feedback=wrong, dải vàng biến mất, thẻ vẫn hiện') : fail('v119-90 aifb: ' + JSON.stringify(k90b));
  // Loại có lý do ở pipeline: hộp thoại app có select lý do → chọn "Trùng lead" → dropped_reason; modal: dòng thời gian "Loại khỏi pipeline · Trùng lead"
  await page.evaluate(() => { const c = window.SL_DATA.leads.find(x => x.__k90 === 'c'); c.__t = c.temp; c.temp = 'junk'; location.hash = 'pipeline'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500); // nút Loại ở pipeline chỉ có trên thẻ rác
  const k90c0 = await page.evaluate(() => { const c = window.SL_DATA.leads.find(x => x.__k90 === 'c'); const b = document.querySelector('#view [data-pv-drop="' + c.id + '"]'); if (b) b.click(); return { btn: !!b }; }); await page.waitForTimeout(350);
  const k90c1 = await page.evaluate(() => { const d = document.getElementById('slDlg'); const sel = d && d.querySelector('#slDropWhy'); const opts = sel ? [...sel.options].map(o => o.textContent) : []; if (sel) { sel.value = 'Trùng lead'; d.querySelector('[data-dlg="1"]').click(); } return { dlg: !!d, opts, title: d ? (d.querySelector('h4') || {}).textContent : '' }; }); await page.waitForTimeout(350);
  const k90c2 = await page.evaluate(() => { const c = window.SL_DATA.leads.find(x => x.__k90 === 'c'); const inK = !!document.querySelector('#view .kanban [data-lead="' + c.id + '"]'); window.__openLead && 0; return { dropped: c.dropped, why: c.dropped_reason, by: c.dropped_by, inK }; });
  (k90c0.btn && k90c1.dlg && k90c1.opts.length === 6 && k90c1.opts.includes('Trùng lead') && /Loại "/.test(k90c1.title) && k90c2.dropped === true && k90c2.why === 'Trùng lead' && !k90c2.inK) ? ok('v119-90: nút Loại ở pipeline mở hộp thoại chọn lý do (6 lựa chọn) → ghi dropped_reason "Trùng lead", thẻ rời kanban') : fail('v119-90 loại lý do: ' + JSON.stringify({ k90c0, k90c1, k90c2 }));
  await page.evaluate(() => { const c = window.SL_DATA.leads.find(x => x.__k90 === 'c'); c.dropped_at = Date.now(); location.hash = 'feed'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelector('#view [data-f="junk"]').click(); }); await page.waitForTimeout(400);
  const k90d0 = await page.evaluate(() => { const c = window.SL_DATA.leads.find(x => x.__k90 === 'c'); const cc = document.querySelector('#feedList [data-lead="' + c.id + '"]'); const chip = cc ? (cc.querySelector('.chip-junk[data-tip^="Người loại"]') || {}).textContent || '' : ''; const b = cc && cc.querySelector('[data-chatbox]'); if (b) b.click(); return { chip }; }); await page.waitForTimeout(500);
  const k90d = await page.evaluate(() => { const m = document.getElementById('modal'); const tl = [...m.querySelectorAll('.ld-tl-tx')].map(e => e.textContent); const undrop = !!m.querySelector('#undropBtn'); const cl = m.querySelector('#mClose'); if (cl) cl.click(); return { tl, undrop }; }); await page.waitForTimeout(300);
  (/Đã loại · Trùng lead/.test(k90d0.chip) && k90d.tl.some(t => /^Loại khỏi pipeline · Trùng lead/.test(t)) && k90d.undrop) ? ok('v119-90: chip "Đã loại · Trùng lead" (người loại) + dòng thời gian ghi lý do + modal có nút Khôi phục thay nút Loại') : fail('v119-90 modal loại: ' + JSON.stringify({ k90d0, k90d }));
  await page.evaluate(() => { const D = window.SL_DATA; D.leads.filter(x => x.__k90).forEach(l => { if (l.__t) { l.temp = l.__t; delete l.__t; } const bk = l.__bk || {}; Object.keys(bk).forEach(k => { if (bk[k] === undefined) delete l[k]; else l[k] = bk[k]; }); delete l.__bk; ['kind', 'parent_author', 'parent_text', 'dropped', 'dropped_by', 'dropped_reason', 'dropped_at', 'rescored_at', 'ai_prev', 'ai_feedback', '__k90'].forEach(k => delete l[k]); }); document.querySelector('#view [data-f="all"]')?.click(); window.SLApp.reload(D); }); await page.waitForTimeout(300);
  // Nguồn quét: group_state + source_health + scan.health → chip Nhịp / 7 ngày / có vấn đề / Dùng chung; Cảnh báo hệ thống có dòng nguồn có vấn đề + group dùng chung + AI tiền lọc
  await page.evaluate(() => { const D = window.SL_DATA; const s0 = D.sources[0], s1 = D.sources[1]; s0.__u = s0.url; s1.__u = s1.url; s0.__b = s0.brand; s1.__b = s1.brand; s0.url = 'https://www.facebook.com/groups/1733640124552320/'; s1.url = 'https://www.facebook.com/groups/1733640124552320/'; s0.brand = 'hscl-01'; s1.brand = 'tts';
    D.groupState = { g_1733640124552320: { band: 'fast', iv: 5, rate: 6.2, lastPostAt: Date.now() - 600e3 } }; D.srcHealth = {}; D.srcHealth[s0.id] = { days: { '2026-09-12': { posts: 40, leads: 3, hot: 1, err: 0 }, '2026-09-13': { posts: 12, leads: 1, hot: 0, err: 0 } }, lastLeadAt: Date.now() - 3600e3, errStreak: 0 };
    D.sysScan = { health: { at: Date.now(), n: 1, active: 5, bad: [{ id: s1.id, name: s1.name, brand: 'tts', why: 'không ra lead (22 bài / 7 ngày)', p7: 22, l7: 0 }] } }; D.sysLlm = { ok: true, pre: false, preFails: 4 };
    location.hash = 'sources'; window.SLApp.reload(D); }); await page.waitForTimeout(500);
  const k90e = await page.evaluate(() => { const rows = [...document.querySelectorAll('#view .src-row')].slice(0, 2); return rows.map(r => ({ shared: (r.querySelector('.chip-shared') || {}).textContent || '', band: (r.querySelector('.chip-band') || {}).textContent || '', bandTip: (r.querySelector('.chip-band') || {}).getAttribute ? r.querySelector('.chip-band').getAttribute('data-tip') : '', h7: (r.querySelector('.chip-junk[data-tip^="7 ngày"]') || {}).textContent || '', bad: (r.querySelector('.chip-hot[data-tip^="Máy chủ"]') || {}).textContent || '' })); });
  await page.evaluate(() => { location.hash = 'alerts'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const k90f = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#sysAlertCard .al-sum-row')].map(r => r.textContent) }));
  await page.evaluate(() => { const D = window.SL_DATA; [D.sources[0], D.sources[1]].forEach(s => { s.url = s.__u; s.brand = s.__b; delete s.__u; delete s.__b; }); delete D.groupState; delete D.srcHealth; delete D.sysScan; delete D.sysLlm; window.SLApp.reload(D); }); await page.waitForTimeout(200);
  (k90e.length === 2 && /Dùng chung · tts/.test(k90e[0].shared) && /Dùng chung · hscl-01/.test(k90e[1].shared) && /Nhịp nhanh 5′/.test(k90e[0].band) && /6\.2 bài\/giờ/.test(k90e[0].bandTip) && /7 ngày 52 bài · 4 lead/.test(k90e[0].h7) && /không ra lead \(22 bài/.test(k90e[1].bad)
    && k90f.rows.some(t => /1 nguồn quét có vấn đề/.test(t) && /không ra lead/.test(t)) && k90f.rows.some(t => /1 group đang phục vụ nhiều brand/.test(t) && /hscl-01 \+ tts/.test(t)) && k90f.rows.some(t => /AI tiền lọc \(tầng 1\) đang lỗi/.test(t) && /4 lần lỗi/.test(t)))
    ? ok('v119-90: Nguồn quét chip Dùng chung (2 brand · 1 group) + Nhịp nhanh 5′ (tooltip bài/giờ) + 7 ngày 52 bài · 4 lead + nguồn có vấn đề; Cảnh báo hệ thống: nguồn có vấn đề · group dùng chung · AI tiền lọc lỗi') : fail('v119-90 nguồn/cảnh báo: ' + JSON.stringify({ k90e, rows: k90f.rows.map(t => t.slice(0, 80)) }));
  // PA-11: Lịch sử quét đọc daily_stats máy chủ cho biểu đồ 14 ngày
  await page.evaluate(() => { const D = window.SL_DATA; const k = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); D.__ds = D.dailyStats; D.dailyStats = [{ brandCode: 'a', day: k, scanned: 120, new: 7 }, { brandCode: 'b', day: k, scanned: 30, new: 2 }]; location.hash = 'history'; window.SLApp.reload(D); }); await page.waitForTimeout(600);
  const k90g = await page.evaluate(() => { const v = document.getElementById('view'); const sub = [...v.querySelectorAll('.card-head .sub')].map(e => e.textContent); const ch = window.Chart && window.Chart.getChart ? window.Chart.getChart(v.querySelector('#cScan')) : null; const ds = ch ? ch.data.datasets : []; return { sub: sub.find(t => /bộ đếm máy chủ/.test(t)) || '', old: sub.some(t => /1\.000/.test(t)) || /1\.000 lượt/.test(v.textContent), last: ds.length ? [ds[0].data[13], ds[1].data[13]] : null }; });
  await page.evaluate(() => { const D = window.SL_DATA; D.dailyStats = D.__ds; delete D.__ds; window.SLApp.reload(D); }); await page.waitForTimeout(200);
  (/14 ngày gần nhất · bộ đếm máy chủ/.test(k90g.sub) && !k90g.old && k90g.last && k90g.last[0] === 150 && k90g.last[1] === 9) ? ok('v119-90 (PA-11): biểu đồ Lịch sử quét lấy daily_stats máy chủ (hôm nay 150 bài / 9 lead gộp 2 brand), hết nhãn "1.000 lượt"') : fail('v119-90 PA-11: ' + JSON.stringify(k90g));
  { const am = fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8'), lv = fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8');
    const lsrc = fs.readFileSync(path.join(ROOT, 'assets/js/live.js'), 'utf8');
    const okMin = /Bài không chữ · bỏ/.test(am) && /Sàn nhịp gieo/.test(am) && /khoá lượt/.test(am) && /"system_status","scan"/.test(lv) && /"source_health"/.test(lv) && /"group_state"/.test(lv) && /"createSource"/.test(lv) && /collection\(db,'scans'\),orderBy\('at','desc'\),limit\(300\)/.test(lsrc);
    okMin ? ok('v119-90: bản min có DECIS no_text · nhãn Sàn nhịp gieo · toast 409 khoá lượt · live.min kênh system_status/scan + source_health + group_state + createSource + scans limit 300') : fail('v119-90 bản min thiếu mốc'); }
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');""", tag='smoke')

done()
