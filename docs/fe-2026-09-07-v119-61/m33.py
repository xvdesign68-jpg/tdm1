# m33.py <cây> — v119-91 / v120-esm-ao (13/09/2026): zip FE đi cùng LỆNH E (chấm điểm v2: prompt theo BRAND + vai reseller/proxy · 6 tiêu chí × trọng số, chạy bóng) + LỆNH D (decision too_old).
#   Áp lên cây v119-90 / v120-esm-an (cùng script, tự nhận ESM). DRY=1 python3 m33.py <cây> để kiểm mốc.
#   - Chấm điểm AI (super): card "Chấm điểm v2" = công tắc "Prompt theo brand" (promptV2) + chế độ điểm tiêu chí off/shadow/on (scoreV2) → SL_FB.setConfig({scoring}) (config/app.scoring, máy chủ đọc mỗi lượt);
#     bật "Áp dụng" phải xác nhận; trọng số: subtitle nói rõ = 6 tiêu chí v2, Lưu với Σ ≠ 100% hỏi lại.
#   - Người dùng → Hồ sơ AI: ô "Brand có bán sỉ / nhận đại lý" (brands.ai.banSi) — reseller chỉ là lead khi tick.
#   - Thẻ lead + modal: chip vai "Đại lý / mua sỉ" (reseller) · "Đăng hộ · liên hệ qua người đăng" (proxy / contact_via_poster); modal + popup Bài đã quét: khối "Phân tích điểm AI (v2)" 6 tiêu chí + lý do + chip chạy bóng/đang áp dụng (lead.ai_v2 / scanned_posts.ai_v2); tooltip vòng điểm ghi điểm v2.
#   - Bài đã quét: quyết định "Đại lý/mua sỉ · bỏ" (reseller, LỆNH E) + "Bài quá cũ · bỏ" (too_old, LỆNH D) + lý do; đếm.
#   - Cảnh báo hệ thống: dòng "N brand chưa khai Hồ sơ AI" từ scans.noProfileBrands (lượt gần nhất).
# ESM: 10-core export thêm aiV2Info/aiV2Html/aiV2Tip; 65 + 60 import từ 10-core.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
C10='src/app/10-core-overview.js'; F20='src/app/20-feed.js'; C50='src/app/50-config-views.js'; V60='src/app/60-scan-views.js'; M65='src/app/65-charts-lead-modal.js'; U85='src/app/85-users-admin.js'; CSS='assets/css/app.css'; SM='tools/smoke.js'
ESM = "import './" in rd(F20)

# =========================================================== 10-core: helper ai_v2 ===========================================================
rep(C10, "  function leadOut(l){ return !!(l&&((l.dropped&&!machineDropped(l))||l.lost||aiHidden(l))); } // = feedHidden: người loại / không thành / AI rác chưa ai chăm",
"""  function leadOut(l){ return !!(l&&((l.dropped&&!machineDropped(l))||l.lost||aiHidden(l))); } // = feedHidden: người loại / không thành / AI rác chưa ai chăm
  /* v119-91 (LỆNH E): ĐIỂM TIÊU CHÍ v2 — lead/scanned_posts.ai_v2 {v, mode off|shadow|on, raw (điểm AI), score (Σ trọng số × tiêu chí/3), criteria{intent,fit,timing,industry,area,quality} 0–3, conf 0–1, why[], w "30/25/15/12/8/10"}.
     shadow = điểm hiển thị vẫn là điểm AI (raw), v2 chỉ ghi để so ≥14 ngày; on = điểm hiển thị = v2. Không có ai_v2 (lead cũ / v2 tắt) → không vẽ gì. */
  const AI_V2_CRIT=[['intent','Ý định mua'],['fit','Khớp sản phẩm brand'],['timing','Độ gấp / thời điểm'],['industry','Đúng ngành'],['area','Khu vực phục vụ'],['quality','Chất lượng bài']];
  function aiV2Info(l){ const v=l&&l.ai_v2; if(!v||typeof v!=='object') return null; const num=x=>(x==null||x===''||isNaN(Number(x)))?null:Number(x); const c=(v.criteria&&typeof v.criteria==='object')?v.criteria:null; const w=String(v.w||'').split('/').map(Number);
    return { mode:String(v.mode||'shadow'), score:num(v.score), raw:num(v.raw), criteria:c, conf:num(v.conf), why:Array.isArray(v.why)?v.why.map(x=>String(x)).filter(Boolean):[], w:(w.length===6&&w.every(x=>isFinite(x)))?w:[30,25,15,12,8,10] }; }
  function aiV2Tip(l){ const i=aiV2Info(l); if(!i||i.score==null) return ''; return ' · điểm tiêu chí v2 '+i.score+(i.mode==='on'?' (đang áp dụng)':' (chạy bóng – chưa áp dụng)')+(i.conf!=null?' · tin cậy '+Math.round(i.conf*100)+'%':''); }
  function aiV2Html(l,opts){ const i=aiV2Info(l); if(!i||!i.criteria) return ''; opts=opts||{};
    const rows=AI_V2_CRIT.map(([k,lb],ix)=>{ const c=i.criteria[k]; const n=(c==null||c===''||isNaN(Number(c)))?null:Math.max(0,Math.min(3,Number(c))); const w=i.w[ix];
      return `<div class="row"><span class="k" title="trọng số ${w}%">${esc(lb)} <small>${w}%</small></span><span class="bar"><i style="width:${n==null?0:Math.round(n/3*100)}%"></i></span><b>${n==null?'–':n+'/3'}</b></div>`; }).join('');
    const head=`<div class="hd">${SLI.ruler} Phân tích điểm AI (v2)${i.score!=null?` <span class="chip chip-brand">${i.score}/100</span>`:''}${i.mode==='on'?'<span class="chip" style="background:#e7f7f0;color:#047857">đang áp dụng</span>':'<span class="chip chip-junk" title="Điểm tiêu chí chỉ ghi để so với điểm AI; bật ở Chấm điểm AI → Chấm điểm v2 → Áp dụng">chạy bóng</span>'}${(i.raw!=null&&i.score!=null&&i.raw!==i.score)?`<small>điểm AI ${i.raw}</small>`:''}${i.conf!=null?`<small>tin cậy ${Math.round(i.conf*100)}%</small>`:''}</div>`;
    const why=i.why.length?`<div class="why">${i.why.map(x=>'<span>'+esc(x)+'</span>').join('')}</div>`:'';
    return `<div class="ld-v2${opts.compact?' compact':''}">${head}${rows}${why}</div>`; }""", tag='10.aiV2')

# =========================================================== 20-feed: chip vai reseller / proxy ===========================================================
rep(F20, """    if(r==='poster_self'||l.self_comment===true) return `<span class="chip chip-role" data-tip="Bình luận của chính người đăng bài${l.parent_author?' ('+esc(l.parent_author)+')':''} – không phải khách mới, automation không tiếp cận">${SLI.user} Chủ bài</span>`;
    return '';""",
"""    if(r==='poster_self'||l.self_comment===true) return `<span class="chip chip-role" data-tip="Bình luận của chính người đăng bài${l.parent_author?' ('+esc(l.parent_author)+')':''} – không phải khách mới, automation không tiếp cận">${SLI.user} Chủ bài</span>`;
    /* v119-91 (LỆNH E): vai mới — reseller (đại lý / mua sỉ: chỉ là lead khi brand tick "có bán sỉ" ở Hồ sơ AI; không thì AI đã loại lúc quét) · proxy (đăng hộ: vẫn là khách, liên hệ qua NGƯỜI ĐĂNG — máy kết bạn/inbox người đăng) */
    if(r==='reseller') return `<span class="chip chip-role reseller" data-tip="AI xếp vai ĐẠI LÝ / MUA SỈ (mua để bán lại)${why} – brand có bán sỉ nên vẫn là khách hợp lệ">${SLI.store} Đại lý / mua sỉ</span>`;
    if(r==='proxy'||l.contact_via_poster===true) return `<span class="chip chip-role proxy" data-tip="ĐĂNG HỘ / hỏi giúp người khác${why} – vẫn là khách: liên hệ qua NGƯỜI ĐĂNG (tự động kết bạn/inbox người đăng)">${SLI.users} Đăng hộ · liên hệ qua người đăng</span>`;
    return '';""", tag='20.roleChip')

# =========================================================== 65 modal: tooltip vòng điểm + khối phân tích v2 ===========================================================
rep(M65, """<div class="ld-ring" style="--p:${Math.max(0,Math.min(100,l.score))};--rc:${scoreColor(l.score)}" data-tip="Điểm AI ${l.score}/100"><b>${l.score}</b></div>""",
"""<div class="ld-ring" style="--p:${Math.max(0,Math.min(100,l.score))};--rc:${scoreColor(l.score)}" data-tip="Điểm AI ${l.score}/100${aiV2Tip(l)}"><b>${l.score}</b></div>""", tag='65.ringTip')
rep(M65, """        ${leadTimelineHtml(l)}
        <div class="reply-box ld-reply">""",
"""        ${leadTimelineHtml(l)}
        ${aiV2Html(l)}
        <div class="reply-box ld-reply">""", tag='65.v2block')

# =========================================================== 60 Bài đã quét: DECIS reseller/too_old + lý do + đếm + popup v2 ===========================================================
rep(V60, """    no_text:         {label:'Bài không chữ · bỏ', color:'var(--junk,#6E7691)', bg:'var(--junk-bg,#EEF0F5)'}, /* v119-90 LỆNH #48 */""",
"""    no_text:         {label:'Bài không chữ · bỏ', color:'var(--junk,#6E7691)', bg:'var(--junk-bg,#EEF0F5)'}, /* v119-90 LỆNH #48 */
    reseller:        {label:'Đại lý/mua sỉ · bỏ', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'}, /* v119-91 LỆNH E: brand không bán sỉ */
    too_old:         {label:'Bài quá cũ · bỏ', color:'var(--junk,#6E7691)', bg:'var(--junk-bg,#EEF0F5)'}, /* v119-91 LỆNH D: lượt theo lịch bỏ bài > 45 ngày */""", tag='60.decis')
rep(V60, """      case 'error':
        return `Có <b>lỗi khi AI chấm điểm</b> bài này""",
"""      case 'reseller':
        return `AI xếp vai người viết là <b>đại lý / mua sỉ</b> (mua để bán lại) mà brand <b>chưa tick "có bán sỉ"</b> ở Hồ sơ AI nên không giữ làm lead. Brand có bán sỉ → tick ô đó (Người dùng → Hồ sơ AI), lượt sau AI sẽ giữ.`; /* v119-91 LỆNH E */
      case 'too_old':
        return `Bài đăng <b>quá cũ</b> (hơn 45 ngày) so với lúc quét theo lịch nên bỏ qua, không đưa vào AI – nhu cầu cũ hiếm khi còn; quét tay / quét quá khứ vẫn chấm bình thường.`; /* v119-91 LỆNH D */
      case 'error':
        return `Có <b>lỗi khi AI chấm điểm</b> bài này""", tag='60.reason')
rep(V60, "no_text:0,self_comment:0,seller:0};", "no_text:0,self_comment:0,seller:0,reseller:0,too_old:0};", tag='60.count')
rep(V60, "const scored=(p.decision==='lead'||p.decision==='scored_low'||p.decision==='error');", "const scored=(p.decision==='lead'||p.decision==='scored_low'||p.decision==='error'||p.decision==='reseller');", count=2, tag='60.scored') # 2 chỗ: dòng danh sách + popup
rep(V60, """            <p class="spm-reason">${decisionReason(p)}</p>
          </div>""",
"""            <p class="spm-reason">${decisionReason(p)}</p>
          </div>
          ${aiV2Html(p,{compact:true})}""", tag='60.v2popup')

# =========================================================== 50 Chấm điểm AI: card v2 + Σ trọng số + cảnh báo brand chưa hồ sơ ===========================================================
rep(C50, "    view.innerHTML = `${autoCard}${modeCard}${cmtCard}", "    const v2Card = roleIsSuper() ? scV2Card() : ''; /* v119-91 LỆNH E */\n    view.innerHTML = `${autoCard}${modeCard}${cmtCard}${v2Card}", tag='50.v2card')
rep(C50, '<div class="sub">Định hướng cho AI gpt-5.5 khi chấm</div>', '<div class="sub">6 tiêu chí × trọng số = điểm tiêu chí v2 (chạy bóng / áp dụng ở thẻ Chấm điểm v2); tổng nên = 100%</div>', tag='50.wsub')
rep(C50, """    if(roleIsSuper()) bindAutoScanToggle();
    renderWeights();
  };""",
"""    if(roleIsSuper()) bindAutoScanToggle();
    renderWeights();
    bindScV2(); /* v119-91 LỆNH E */
  };
  /* v119-91 (LỆNH E): công tắc CHẤM ĐIỂM v2 — config/app.scoring {promptV2:bool, scoreV2:'off'|'shadow'|'on'} ghi đè .env PROMPT_BRAND_V2/SCORE_V2 (máy chủ đọc mỗi lượt, không cần deploy).
     promptV2 = prompt chấm điểm dựng theo Hồ sơ AI brand (+ vai đại lý/đăng hộ + 6 tiêu chí); scoreV2: shadow = điểm hiển thị vẫn là điểm AI, điểm tiêu chí ghi bóng (lead.ai_v2) để so ≥14 ngày; on = điểm hiển thị = Σ trọng số × tiêu chí; off = không ghi. */
  function scV2Cfg(){ const s=((D.cfg||{}).scoring)||{}; const prompt=(s.promptV2==null)?true:(s.promptV2===true||s.promptV2==='true'); const mode=/^(off|shadow|on)$/.test(String(s.scoreV2||''))?String(s.scoreV2):'shadow'; return {prompt,mode,set:(s.promptV2!=null||s.scoreV2!=null)}; }
  function scV2Status(c){ return c.mode==='on'?'Đang ÁP DỤNG điểm tiêu chí (v2) – điểm lead = Σ trọng số × tiêu chí':c.mode==='shadow'?'Đang chạy bóng – điểm hiển thị = điểm AI, điểm tiêu chí ghi để so':'Điểm tiêu chí đang TẮT'; }
  function scV2Card(){ const c=scV2Cfg(); const opt=(v,lb)=>`<option value="${v}"${c.mode===v?' selected':''}>${lb}</option>`;
    return `<div class="card mt-2" id="scV2Card" style="margin-bottom:18px"><div class="card-head"><div><h3>${SLI.ruler} Chấm điểm v2 <span class="sa-lock" title="Chỉ Super Admin thấy và chỉnh mục này" aria-label="Chỉ Super Admin"></span></h3><div class="sub">Prompt theo <b>Hồ sơ AI</b> từng brand (vai đại lý / đăng hộ) + điểm theo <b>6 tiêu chí × trọng số</b> bên dưới. Máy chủ đọc cấu hình này mỗi lượt quét – không cần deploy.${c.set?'':' <i>(chưa lưu – đang theo mặc định máy chủ: prompt theo brand BẬT, chạy bóng)</i>'}</div></div><button class="btn btn-primary btn-sm" id="scV2Save">${SLI.save} Lưu</button></div>
      <div class="card-pad" style="display:grid;gap:12px">
        <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-size:13px;line-height:1.5"><input type="checkbox" id="scV2Prompt"${c.prompt?' checked':''} style="margin-top:4px"><span><b>Prompt theo brand</b> – AI chấm bài theo ngành / sản phẩm / khách của từng brand (Người dùng → Hồ sơ AI); nhận vai <b>đại lý / mua sỉ</b> (chỉ là lead khi brand tick "có bán sỉ") và <b>đăng hộ</b> (là lead, liên hệ qua người đăng). Tắt = prompt chung như trước, không có điểm tiêu chí.</span></label>
        <label style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px"><b>Điểm theo tiêu chí</b><select class="acs-in" id="scV2Mode" style="height:36px;max-width:420px">${opt('shadow','Chạy bóng – điểm hiển thị vẫn là điểm AI, điểm tiêu chí ghi để so (mặc định)')}${opt('on','Áp dụng – điểm lead = Σ trọng số × tiêu chí (0–3)')}${opt('off','Tắt – không ghi điểm tiêu chí')}</select><span id="scV2Now" style="font-size:12px;color:var(--ink-400)">${scV2Status(c)}</span></label>
        <div class="muted" style="font-size:12px;line-height:1.5">Chỉ bật <b>Áp dụng</b> sau ≥14 ngày chạy bóng, khi dải nóng theo tiêu chí phản hồi/hẹn không kém dải nóng theo điểm AI (đội Z15 đo bằng script trên máy chủ). Lead đã chấm giữ điểm cũ; lead mới + AI chấm lại theo cách mới. Đổi trọng số bên dưới = đổi điểm tiêu chí ngay lượt kế. Brand chưa khai Hồ sơ AI → AI chấm theo prompt trung tính (xem Cảnh báo).</div>
      </div></div>`; }
  function bindScV2(){ const btn=view.querySelector('#scV2Save'); if(!btn) return;
    btn.addEventListener('click',async()=>{ const prompt=!!(view.querySelector('#scV2Prompt')||{}).checked; const mode=String((view.querySelector('#scV2Mode')||{}).value||'shadow'); const cur=scV2Cfg();
      if(mode==='on'&&cur.mode!=='on'&&!await slConfirm('Điểm lead mới sẽ = Σ trọng số × 6 tiêu chí (0–3) thay vì điểm AI tổng thể. Phân bố Nóng/Ấm/Lạnh có thể đổi → KPI, push và ma trận tự động theo nhiệt độ đổi theo. Chỉ nên bật sau ≥14 ngày chạy bóng.',{title:'Áp dụng điểm tiêu chí v2?',ok:'Áp dụng'})) return;
      const scoring={promptV2:prompt,scoreV2:mode}; btn.disabled=true;
      const apply=()=>{ D.cfg=D.cfg||{}; D.cfg.scoring=Object.assign({},D.cfg.scoring||{},scoring); const st=view.querySelector('#scV2Now'); if(st) st.textContent=scV2Status(scV2Cfg()); toast('Đã lưu Chấm điểm v2: prompt theo brand '+(prompt?'BẬT':'TẮT')+' · điểm tiêu chí '+(mode==='on'?'ÁP DỤNG':mode==='shadow'?'chạy bóng':'tắt')+' – áp dụng từ lượt quét kế.'); };
      if(window.SL_FB&&window.SL_FB.setConfig){ window.SL_FB.setConfig({scoring}).then(apply).catch(e=>toast(errMsg(e,'Lưu Chấm điểm v2 lỗi'))).finally(()=>{ btn.disabled=false; }); }
      else { apply(); btn.disabled=false; } }); }""", tag='50.bindV2')
rep(C50, """    document.getElementById('saveWeights')?.addEventListener('click',()=>{
      if(window.SL_FB&&window.SL_FB.setConfig){ window.SL_FB.setConfig({weights:D.scoringWeights}).then(()=>toast('Đã lưu trọng số AI.')).catch(e=>toast(errMsg(e))); }
      else toast('Demo – bật Firebase để lưu.');
    });""",
"""    document.getElementById('saveWeights')?.addEventListener('click',async()=>{
      /* v119-91 (LỆNH E): trọng số giờ là trọng số THẬT của điểm tiêu chí v2 (máy chủ chuẩn hoá theo tổng) → Σ ≠ 100% hỏi lại cho dễ đọc */
      const s=D.scoringWeights.reduce((a,w)=>a+w.weight,0);
      if(s!==100&&!await slConfirm('Tổng trọng số đang '+s+'% (nên = 100%). Điểm tiêu chí v2 vẫn tính được (chuẩn hoá theo tổng) nhưng khó đọc. Vẫn lưu?',{title:'Tổng trọng số ≠ 100%',ok:'Vẫn lưu'})) return;
      if(window.SL_FB&&window.SL_FB.setConfig){ window.SL_FB.setConfig({weights:D.scoringWeights}).then(()=>toast('Đã lưu trọng số AI – điểm tiêu chí v2 dùng ngay từ lượt quét kế.')).catch(e=>toast(errMsg(e))); }
      else toast('Demo – bật Firebase để lưu.');
    });""", tag='50.wsave')
rep(C50, """    (oaAccounts()||[]).forEach(a=>{
      const why=a.challenge?""",
"""    /* v119-91 (LỆNH E): lượt quét gần nhất báo brand chưa có Hồ sơ AI → prompt v2 chạy trung tính, thiếu ngữ cảnh ngành/sản phẩm brand */
    { const s0=(D.scans||[])[0]; const np=(s0&&Array.isArray(s0.noProfileBrands))?s0.noProfileBrands.filter(Boolean):[]; if(np.length) add(SLI.brain,np.length+' brand chưa khai Hồ sơ AI – AI chấm điểm theo prompt trung tính, thiếu ngữ cảnh ngành/sản phẩm',np.slice(0,6).join(', ')+' · Người dùng → Hồ sơ AI','users','warn'); }
    (oaAccounts()||[]).forEach(a=>{
      const why=a.challenge?""", tag='50.alertNoProfile')

# =========================================================== 85 Hồ sơ AI: ô bán sỉ ===========================================================
rep(U85, """placeholder="vd: Xưng “phòng khám”, thân thiện, không hứa giá cụ thể"></label>
            </div>""",
"""placeholder="vd: Xưng “phòng khám”, thân thiện, không hứa giá cụ thể"></label>
            </div>
            <label class="acs-field" style="display:flex;gap:10px;align-items:flex-start;margin-top:10px;cursor:pointer"><input type="checkbox" id="aiBanSi" style="margin:3px 0 0"><span style="font-size:13px;line-height:1.5"><b>Brand có bán sỉ / nhận đại lý</b> – người hỏi nhập hàng để bán lại, đại lý, cửa hàng/quán nhập hàng là <b>khách hợp lệ</b> (AI xếp vai "Đại lý / mua sỉ"). Không tick = AI bỏ các bài đó (quyết định "Đại lý/mua sỉ · bỏ" ở Bài đã quét).</span></label>""", tag='85.banSiForm')
rep(U85, "        aiBox.querySelector('#aiGiong').value=ai.giong||'';", "        aiBox.querySelector('#aiGiong').value=ai.giong||'';\n        { const bs=aiBox.querySelector('#aiBanSi'); if(bs) bs.checked=(ai.banSi===true); } /* v119-91 LỆNH E */", tag='85.banSiLoad')
rep(U85, """          giong:(aiVal('#aiGiong')||'').trim()
        };""",
"""          giong:(aiVal('#aiGiong')||'').trim(),
          banSi:!!((aiBox.querySelector('#aiBanSi')||{}).checked) /* v119-91 LỆNH E: brand có bán sỉ → AI giữ vai đại lý/mua sỉ làm lead */
        };""", tag='85.banSiSave')

# =========================================================== CSS ===========================================================
rep(CSS, ".chip-cmt .i, .chip-airs .i, .chip-aidrop .i, .chip-shared .i, .chip-band .i { width: 12px; height: 12px; }",
""".chip-cmt .i, .chip-airs .i, .chip-aidrop .i, .chip-shared .i, .chip-band .i { width: 12px; height: 12px; }
/* v119-91 (LỆNH E): chip vai đại lý / đăng hộ + khối Phân tích điểm AI v2 (modal lead + popup Bài đã quét) */
.chip-role.reseller { background: #ecfdf5; color: #047857; }
.chip-role.proxy { background: #eef2ff; color: #3730a3; }
.ld-v2 { margin: 8px 0 2px; padding: 10px 12px; border: 1px solid var(--line, #E9ECF7); border-radius: 12px; font-size: 12.5px; background: #fff; }
.ld-v2.compact { margin: 8px 0 0; }
.ld-v2 .hd { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 600; color: var(--ink-700); margin-bottom: 6px; }
.ld-v2 .hd .i, .ld-v2 .hd svg { width: 14px; height: 14px; }
.ld-v2 .hd small { font-weight: 500; color: var(--ink-400); }
.ld-v2 .row { display: grid; grid-template-columns: minmax(120px, 170px) 1fr 34px; gap: 8px; align-items: center; margin: 3px 0; }
.ld-v2 .row .k { color: var(--ink-600); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ld-v2 .row .k small { color: var(--ink-400); }
.ld-v2 .row .bar { height: 6px; border-radius: 4px; background: var(--junk-bg, #EEF0F5); overflow: hidden; }
.ld-v2 .row .bar i { display: block; height: 100%; background: var(--brand-600, #1B2DCC); border-radius: 4px; }
.ld-v2 .row b { font-variant-numeric: tabular-nums; text-align: right; color: var(--ink-700); }
.ld-v2 .why { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.ld-v2 .why span { background: var(--junk-bg, #EEF0F5); color: var(--ink-600); border-radius: 999px; padding: 2px 9px; font-size: 12px; }""", tag='css')

# =========================================================== ESM ===========================================================
if ESM:
    rep(C10, "slDialog, machineDropped, humanCared, aiHidden, leadOut, softRender,", "slDialog, machineDropped, humanCared, aiHidden, leadOut, aiV2Info, aiV2Html, aiV2Tip, softRender,", tag='10.esmExport')
    rep(M65, "slConfirm, slNow, stageLabel, view, vnDayStart, machineDropped } from './10-core-overview.js';", "slConfirm, slNow, stageLabel, view, vnDayStart, machineDropped, aiV2Html, aiV2Tip } from './10-core-overview.js';", tag='65.esmImport10')
    rep(V60, "slChart, startBdBudgetAuto, view, views, vnDayKey } from './10-core-overview.js';", "slChart, startBdBudgetAuto, view, views, vnDayKey, aiV2Html } from './10-core-overview.js';", tag='60.esmImport10')

# =========================================================== smoke ===========================================================
rep(SM, "  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');",
r"""  // ===== v119-91 (LỆNH E): Chấm điểm v2 (công tắc + Σ trọng số) · Hồ sơ AI ô bán sỉ · chip Đại lý/Đăng hộ + Phân tích điểm ai_v2 (modal + popup Bài đã quét) · DECIS reseller/too_old · cảnh báo brand chưa Hồ sơ AI · bản min =====
  await page.evaluate(() => { location.hash = 'scoring'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(500);
  const k91a = await page.evaluate(() => { const c = document.getElementById('scV2Card'); const sel = document.getElementById('scV2Mode'); const cb = document.getElementById('scV2Prompt'); const wl = document.getElementById('wList'); return { card: !!c, opts: sel ? sel.options.length : 0, mode: sel ? sel.value : '', prompt: cb ? cb.checked : null, sub: /tổng nên = 100%/.test((wl && wl.closest('.card').textContent) || '') }; });
  await page.evaluate(() => { const sel = document.getElementById('scV2Mode'); sel.value = 'off'; document.getElementById('scV2Save').click(); }); await page.waitForTimeout(300);
  const k91b = await page.evaluate(() => ({ cfg: (window.SL_DATA.cfg && window.SL_DATA.cfg.scoring) || null, now: (document.getElementById('scV2Now') || {}).textContent || '' }));
  await page.evaluate(() => { const inp = document.querySelector('#wList input[type=range]'); inp.__v = inp.value; inp.value = String(Number(inp.value) >= 45 ? Number(inp.value) - 7 : Number(inp.value) + 7); inp.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('saveWeights').click(); }); await page.waitForTimeout(300);
  const k91c = await page.evaluate(() => { const d = document.getElementById('slDlg'); const t = d ? d.textContent : ''; const b = d && d.querySelector('[data-dlg="0"]'); if (b) b.click(); return { dlg: !!d, t }; }); await page.waitForTimeout(250);
  await page.evaluate(() => { const inp = document.querySelector('#wList input[type=range]'); inp.value = inp.__v; inp.dispatchEvent(new Event('input', { bubbles: true })); const D = window.SL_DATA; if (D.cfg && D.cfg.scoring) D.cfg.scoring.scoreV2 = 'shadow'; });
  (k91a.card && k91a.opts === 3 && k91a.mode === 'shadow' && k91a.prompt === true && k91a.sub && k91b.cfg && k91b.cfg.scoreV2 === 'off' && k91b.cfg.promptV2 === true && /TẮT/.test(k91b.now) && k91c.dlg && /Tổng trọng số ≠ 100%/.test(k91c.t)) ? ok('v119-91: card Chấm điểm v2 (prompt theo brand ✓ · 3 chế độ, mặc định chạy bóng) → lưu "tắt" ghi cfg.scoring + trạng thái; Lưu trọng số Σ ≠ 100% → hộp thoại xác nhận') : fail('v119-91 scoring: ' + JSON.stringify({ k91a, k91b, k91c }));
  await page.evaluate(() => { const D = window.SL_DATA; const L = D.leads.filter(x => !x.dropped && !x.lost && x.temp === 'hot'); const a = L[0], b = L[1]; a.__k91 = 'r'; a.__role = a.role; a.role = 'reseller'; a.role_reason = 'hỏi nhập sỉ về bán'; a.ai_v2 = { v: 1, mode: 'shadow', raw: a.score, score: 72, criteria: { intent: 3, fit: 2, timing: 2, industry: 3, area: 2, quality: 2 }, conf: 0.8, why: ['cần nhập 20 kg', 'hỏi giá sỉ'], w: '30/25/15/12/8/10' }; b.__k91 = 'p'; b.__role = b.role; b.role = 'proxy'; b.contact_via_poster = true; location.hash = 'feed'; window.SLApp.reload(D); }); await page.waitForTimeout(500);
  const k91d = await page.evaluate(() => { const D = window.SL_DATA; const a = D.leads.find(x => x.__k91 === 'r'), b = D.leads.find(x => x.__k91 === 'p'); const ca = document.querySelector('#feedList [data-lead="' + a.id + '"] .chip-role'), cb = document.querySelector('#feedList [data-lead="' + b.id + '"] .chip-role'); const btn = document.querySelector('#feedList [data-lead="' + a.id + '"] [data-chatbox]'); if (btn) btn.click(); return { ra: ca ? ca.textContent.trim() : '', ta: ca ? ca.getAttribute('data-tip') || '' : '', rb: cb ? cb.textContent.trim() : '', tb: cb ? cb.getAttribute('data-tip') || '' : '' }; }); await page.waitForTimeout(500);
  const k91e = await page.evaluate(() => { const m = document.getElementById('modal'); const v2 = m.querySelector('.ld-v2'); const rows = v2 ? v2.querySelectorAll('.row').length : 0; const ring = m.querySelector('.ld-ring'); const tip = ring ? ring.getAttribute('data-tip') || '' : ''; const why = v2 ? v2.querySelectorAll('.why span').length : 0; const cl = m.querySelector('#mClose'); if (cl) cl.click(); return { rows, tip, why, txt: v2 ? v2.textContent : '' }; }); await page.waitForTimeout(300);
  await page.evaluate(() => { const D = window.SL_DATA; D.leads.filter(x => x.__k91).forEach(l => { if (l.__role === undefined) delete l.role; else l.role = l.__role; delete l.__role; delete l.__k91; delete l.ai_v2; delete l.contact_via_poster; delete l.role_reason; }); window.SLApp.reload(D); }); await page.waitForTimeout(200);
  (/Đại lý \/ mua sỉ/.test(k91d.ra) && /bán lại/.test(k91d.ta) && /Đăng hộ/.test(k91d.rb) && /NGƯỜI ĐĂNG/.test(k91d.tb) && k91e.rows === 6 && /72\/100/.test(k91e.txt) && /chạy bóng/.test(k91e.txt) && k91e.why === 2 && /điểm tiêu chí v2 72/.test(k91e.tip)) ? ok('v119-91: chip "Đại lý / mua sỉ" + "Đăng hộ · liên hệ qua người đăng" trên thẻ; modal có Phân tích điểm AI v2 (6 tiêu chí, 72/100, chạy bóng, 2 lý do) + tooltip vòng điểm') : fail('v119-91 chip/v2: ' + JSON.stringify({ k91d, k91e }));
  await page.evaluate(() => { const D = window.SL_DATA; const sp = D.scannedPosts || []; D.__spBak = sp.slice(); const base = sp[0] || {}; sp.unshift(Object.assign({}, base, { id: 'k91r', decision: 'reseller', score: 78, role: 'reseller', kind: 'post', author: 'K91 Reseller', text: 'Cần nhập sỉ 50 kg mực khô về bán', post_url: 'https://www.facebook.com/groups/1/posts/9191/', ai_v2: { v: 1, mode: 'shadow', raw: 78, score: 70, criteria: { intent: 3, fit: 2, timing: 2, industry: 3, area: 2, quality: 2 }, conf: 0.7, why: ['nhập sỉ'], w: '30/25/15/12/8/10' } }), Object.assign({}, base, { id: 'k91o', decision: 'too_old', score: 0, kind: 'post', author: 'K91 Old', text: 'Bài cũ 60 ngày', post_url: 'https://www.facebook.com/groups/1/posts/9192/' })); location.hash = 'scanned'; window.SLApp.reload(D); }); await page.waitForTimeout(600);
  const k91f = await page.evaluate(() => { const chips = [...document.querySelectorAll('#view .chip-dot')].map(c => c.textContent.trim()); const row = document.querySelector('#view .sp-open[data-sp="0"]'); if (row) row.click(); return { res: chips.some(c => /Đại lý\/mua sỉ · bỏ/.test(c)), old: chips.some(c => /Bài quá cũ · bỏ/.test(c)), row: !!row }; }); await page.waitForTimeout(400);
  const k91g = await page.evaluate(() => { const m = document.getElementById('modal'); const v2 = m.querySelector('.ld-v2.compact'); const reason = (m.querySelector('.spm-reason') || {}).textContent || ''; const cl = m.querySelector('#mClose'); if (cl) cl.click(); return { v2: !!v2, rows: v2 ? v2.querySelectorAll('.row').length : 0, reason }; }); await page.waitForTimeout(300);
  await page.evaluate(() => { const D = window.SL_DATA; D.scannedPosts = D.__spBak; delete D.__spBak; });
  (k91f.res && k91f.old && k91f.row && k91g.v2 && k91g.rows === 6 && /chưa tick "có bán sỉ"/.test(k91g.reason)) ? ok('v119-91: Bài đã quét có quyết định "Đại lý/mua sỉ · bỏ" + "Bài quá cũ · bỏ"; popup có lý do + Phân tích điểm v2 (6 tiêu chí)') : fail('v119-91 scanned: ' + JSON.stringify({ k91f, k91g }));
  await page.evaluate(() => { const D = window.SL_DATA; D.scans[0].__np = D.scans[0].noProfileBrands; D.scans[0].noProfileBrands = ['spa-huong-anh', 'x9']; location.hash = 'alerts'; window.SLApp.reload(D); }); await page.waitForTimeout(500);
  const k91h = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#sysAlertCard .al-sum-row')].map(r => r.textContent) }));
  await page.evaluate(() => { const D = window.SL_DATA; if (D.scans[0].__np === undefined) delete D.scans[0].noProfileBrands; else D.scans[0].noProfileBrands = D.scans[0].__np; delete D.scans[0].__np; });
  k91h.rows.some(t => /2 brand chưa khai Hồ sơ AI/.test(t) && /spa-huong-anh, x9/.test(t)) ? ok('v119-91: Cảnh báo hệ thống dòng "2 brand chưa khai Hồ sơ AI" từ scans.noProfileBrands') : fail('v119-91 alerts: ' + JSON.stringify(k91h.rows.slice(0, 6)));
  await page.evaluate(() => { location.hash = 'users'; window.SLApp.reload(window.SL_DATA); }); await page.waitForTimeout(600);
  await page.evaluate(() => { const b = document.querySelector('[data-aiprof]'); if (b) b.click(); }); await page.waitForTimeout(300);
  const k91i = await page.evaluate(() => { const cb = document.getElementById('aiBanSi'); const box = document.getElementById('aiProfBox'); const vis = !!(box && box.style.display !== 'none'); const lbl = cb ? ((cb.closest('label') || {}).textContent || '') : ''; return { cb: !!cb, vis, lbl }; });
  (k91i.cb && k91i.vis && /bán sỉ/.test(k91i.lbl) && /khách hợp lệ/.test(k91i.lbl)) ? ok('v119-91: Hồ sơ AI có ô "Brand có bán sỉ / nhận đại lý" (ai.banSi) khi mở hồ sơ brand') : fail('v119-91 banSi: ' + JSON.stringify(k91i));
  { const am = fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8');
    const okMin91 = /Đại lý \/ mua sỉ/.test(am) && /id="scV2Card"/.test(am) && /Bài quá cũ · bỏ/.test(am) && /Đại lý\/mua sỉ · bỏ/.test(am) && /id="aiBanSi"/.test(am) && /Phân tích điểm AI \(v2\)/.test(am) && /brand chưa khai Hồ sơ AI/.test(am);
    okMin91 ? ok('v119-91: bản min có chip Đại lý / card Chấm điểm v2 / DECIS reseller+too_old / ô banSi / Phân tích điểm v2 / cảnh báo Hồ sơ AI') : fail('v119-91 bản min thiếu mốc'); }
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');""", tag='smoke.k91')
done()
