# m34.py <cây> — v119-92 / v120-esm-ap (13/09/2026): zip FE đi cùng LỆNH F (PA-5 "SĐT gọi được ngay"). Áp lên cây v119-91 / v120-esm-ao (cùng script, tự nhận ESM). DRY=1 để kiểm mốc.
#   - hlBody: bôi MỌI số VN hợp lệ trong bài/bình luận (di động 10 số + số bàn 02x 11 số); số = SĐT lead → .ph-hl (chép); số KHÁC → .ph-alt (chép) + nút "Dùng" → xác nhận → CF zaloCheckLead {leadId, phone} (đặt SĐT lead, phone_prev, kiểm Zalo luôn; demo → mutate).
#   - Thẻ lead: dòng "Chủ bài bình luận thêm / Khách còn bình luận · SĐT lấy từ đây" từ lead.text_extra (LỆNH F), số bôi nổi; modal: khối .ld-extra + nút "Kiểm Zalo" (SĐT chưa có kết quả — lead lạnh bị hoãn) → CF zaloCheckLead {leadId}; pill SĐT nói rõ nguồn (bình luận / sales đặt).
#   - normPhoneVN nhận số bàn; tìm kiếm quét cả text_extra; live.js SL_FB.zaloCheckLead.
# ESM: 20-feed export thêm extraLine; 65 import extraLine, fmtPhoneVN từ 20.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
LV='assets/js/live.js'; F20='src/app/20-feed.js'; M65='src/app/65-charts-lead-modal.js'; CSS='assets/css/app.css'; SM='tools/smoke.js'
ESM = "import './" in rd(F20)

# ===== live.js =====
rep(LV, "    createSource:(data)=>cf('createSource',data||{}),", "    createSource:(data)=>cf('createSource',data||{}),\n    /* v119-92 (PA-5, LỆNH F): CF zaloCheckLead {leadId, phone?, force?} — \"Dùng số này\" (đặt SĐT lead từ số khác trong bài/bình luận) + \"Kiểm Zalo\" (lead lạnh bị hoãn lúc quét); super/admin/sales cùng brand; máy chủ ghi phone/phone_has_zalo */\n    zaloCheckLead:(data)=>cf('zaloCheckLead',data||{}),", tag='lv.zaloCheckLead')

# ===== 20-feed =====
rep(F20, "return /^[35789]\\d{8}$/.test(d)?'+84'+d:'';}", "return /^([35789]\\d{8}|2\\d{9})$/.test(d)?'+84'+d:'';} /* v119-92: nhận cả số bàn 02x (11 số) */", tag='20.normPhone')
rep(F20, """    if(l&&l.phone){
      safe=safe.replace(/(?:\\+?84|0)(?:[\\s.\\-]?\\d){9}(?!\\d)/g,function(m){
        if(normPhoneVN(m)===l.phone){phoneFound=true;return `<span class="ph-hl" title="Bấm để chép số" onclick="event.stopPropagation();window.__slCopy(this,'${escJsAttr(phoneLocal(l.phone))}')">${m}${COPY_IC}</span>`;}
        return m;
      });
    }
    return {html:safe,phoneFound:phoneFound,emailFound:emailFound};""",
"""    /* v119-92 (PA-5): bôi MỌI số VN hợp lệ (số bàn 02x 11 số thử trước, rồi di động 10 số) — số = SĐT lead → .ph-hl (chép); số KHÁC → .ph-alt (chép) + nút "Dùng" đặt làm SĐT lead qua CF zaloCheckLead (kiểm Zalo luôn). Trước đây chỉ bôi số khớp l.phone → bài có 2 số / máy chủ sót thì sales không thấy. */
    safe=safe.replace(/(?:\\+?84|0)2(?:[\\s.\\-]?\\d){9}(?!\\d)|(?:\\+?84|0)(?:[\\s.\\-]?\\d){9}(?!\\d)/g,function(m){
      const e=normPhoneVN(m); if(!e) return m;
      if(l&&l.phone&&e===l.phone){phoneFound=true;return `<span class="ph-hl" title="SĐT của lead – bấm để chép" onclick="event.stopPropagation();window.__slCopy(this,'${escJsAttr(phoneLocal(l.phone))}')">${m}${COPY_IC}</span>`;}
      const use=(l&&l.id)?`<button type="button" class="ph-use" data-usephone="${esc(e)}" data-lead="${esc(String(l.id))}" title="Đặt số này làm SĐT của lead (kiểm Zalo luôn)" onclick="event.stopPropagation();window.__slUsePhone&&window.__slUsePhone(this)">Dùng</button>`:'';
      return `<span class="ph-hl ph-alt" title="Số khác trong bài – bấm để chép${use?'; bấm Dùng để đặt làm SĐT lead':''}" onclick="event.stopPropagation();window.__slCopy(this,'${escJsAttr(phoneLocal(e))}')">${m}${COPY_IC}${use}</span>`;
    });
    return {html:safe,phoneFound:phoneFound,emailFound:emailFound};""", tag='20.hlBody')
rep(F20, """    return `<span class="ph-pill" title="Bấm để chép số" onclick=""", """    return `<span class="ph-pill" title="${l.contact_source==='comment'?'SĐT lấy từ bình luận của khách dưới bài – ':l.contact_source==='manual'?'SĐT do sales đặt – ':''}Bấm để chép số" onclick=""", tag='20.pillTip')
rep(F20, "  function parentLine(l){ if(!l||l.kind!=='comment'||!l.parent_text) return '';",
"""  /* v119-92 (PA-5, LỆNH F): lead.text_extra = bình luận CÙNG TÁC GIẢ (chủ bài tự bình luận dưới bài mình / khách bình luận thêm) → 1 dòng trên thẻ, số bôi nổi + Dùng; contact_source 'comment' = SĐT lấy từ đây */
  function extraLine(l){ if(!l||!l.text_extra) return ''; const t=String(l.text_extra).replace(/\\s+/g,' ').trim(); return `<div class="ld-parent-line ld-extra-line"><b>${SLI.message} ${l.kind==='comment'?'Khách còn bình luận':'Chủ bài bình luận thêm'}${l.contact_source==='comment'?' · SĐT lấy từ đây':''}:</b> ${hlBody(t.slice(0,240),l).html}${t.length>240?'…':''}</div>`; }
  function parentLine(l){ if(!l||l.kind!=='comment'||!l.parent_text) return '';""", tag='20.extraLine')
rep(F20, "        ${parentLine(l)}\n", "        ${parentLine(l)}${extraLine(l)}\n", tag='20.cardExtra')
rep(F20, "l.parent_text,l.parent_author,l.role_reason,l.dropped_reason,l.rescore_note].join(' '));", "l.parent_text,l.parent_author,l.role_reason,l.dropped_reason,l.rescore_note,l.text_extra].join(' ')); /* v119-92: tìm cả bình luận thêm */", tag='20.search')

# ===== 65 modal =====
rep(M65, "  function openLead(id,opts){",
"""  /* v119-92 (PA-5, LỆNH F): nút Kiểm Zalo (SĐT chưa có kết quả — lead lạnh bị hoãn lúc quét) + "Dùng số này" (số khác bôi trong bài/bình luận) → CF zaloCheckLead (super/admin/sales cùng brand; máy chủ ghi phone/phone_prev/contact_source manual/phone_has_zalo) */
  function zaloCheckBtn(l){ if(!l||!l.phone||l.phone_has_zalo===true||l.phone_has_zalo===false) return ''; return `<button type="button" class="chip zalo-chk" title="SĐT chưa được kiểm Zalo (lead lạnh được hoãn để tiết kiệm) – bấm để kiểm ngay" onclick="event.stopPropagation();window.__slZaloCheck('${escJsAttr(String(l.id))}')">${SLI.search} Kiểm Zalo</button>`; }
  function extraBox(l){ if(!l||!l.text_extra) return ''; return `<div class="ld-extra"><div class="lb">${SLI.message} ${l.kind==='comment'?'Khách còn bình luận thêm dưới bài':'Chủ bài bình luận thêm dưới bài của mình'}${l.contact_source==='comment'?' · <b>SĐT lấy từ đây</b>':''}</div><div class="tx">${hlBody(String(l.text_extra),l).html}</div></div>`; }
  async function zaloCheckLeadUI(id,phone){
    const l=(D.leads||[]).find(x=>String(x.id)===String(id)); if(!l) return;
    const after=()=>{ try{ if(document.getElementById('modalBg').classList.contains('show')) openLead(l.id,{keep:true}); }catch(e){} try{ if((location.hash||'').replace('#','')==='feed') renderFeed(); }catch(e){} };
    if(!(window.SL_FB&&window.SL_FB.zaloCheckLead)){ if(phone){ if(l.phone) l.phone_prev=l.phone; l.phone=phone; l.phone_has_zalo=null; l.contact_source='manual'; toast('Đã đặt SĐT '+phone.replace(/^\\+84/,'0')+' cho lead (demo).'); } else toast('Demo – kiểm Zalo cần kết nối máy chủ.'); after(); return; }
    toast(phone?'Đang đặt SĐT và kiểm Zalo…':'Đang kiểm Zalo…');
    try{ const r=await window.SL_FB.zaloCheckLead(phone?{leadId:String(l.id),phone}:{leadId:String(l.id)});
      if(r&&r.ok){ if(r.phone){ if(phone&&l.phone&&l.phone!==r.phone) l.phone_prev=l.phone; l.phone=r.phone; } if(phone) l.contact_source='manual'; if(r.registered===true||r.registered===false){ l.phone_has_zalo=r.registered; l.zalo_defer=false; }
        const loc=String(r.phone||'').replace(/^\\+84/,'0');
        toast(r.registered===true?'SĐT '+loc+' CÓ Zalo.':r.registered===false?'SĐT '+loc+' chưa có Zalo.':(r.source==='landline'?'Đã đặt số bàn '+loc+' (không kiểm Zalo).':'Chưa kiểm được Zalo ('+(r.source||'lỗi')+') – thử lại sau.')); }
      else toast('Không kiểm được Zalo.'); }
    catch(e){ toast(errMsg(e,'Kiểm Zalo lỗi')); }
    after();
  }
  window.__slUsePhone=async function(btn){ const id=btn&&btn.dataset.lead, ph=btn&&btn.dataset.usephone; if(!id||!ph) return; const l=(D.leads||[]).find(x=>String(x.id)===String(id)); const cur=l&&l.phone?String(l.phone).replace(/^\\+84/,'0'):'';
    if(!await slConfirm('Đặt '+ph.replace(/^\\+84/,'0')+' làm SĐT của lead'+(l&&l.name?' "'+l.name+'"':'')+'?'+(cur?' SĐT hiện tại '+cur+' sẽ được lưu lại.':'')+' Hệ thống kiểm Zalo ngay sau đó.',{title:'Dùng số này',ok:'Dùng số này'})) return;
    await zaloCheckLeadUI(id,ph); };
  window.__slZaloCheck=function(id){ return zaloCheckLeadUI(id,''); };
  function openLead(id,opts){""", tag='65.fns')
rep(M65, "${chip(l.temp)}${zaloTag(l)} <span class=\"chip chip-brand\">${esc(l.industry)}</span>${l.kind==='comment'?' <span class=\"chip chip-warm\" data-tip=\"Lead này là 1 BÌNH LUẬN", "${chip(l.temp)}${zaloTag(l)}${zaloCheckBtn(l)} <span class=\"chip chip-brand\">${esc(l.industry)}</span>${l.kind==='comment'?' <span class=\"chip chip-warm\" data-tip=\"Lead này là 1 BÌNH LUẬN", tag='65.hdrBtn')
rep(M65, "        ${aiBand(l)}\n        ${panoPanel(l)}", "        ${extraBox(l)}\n        ${aiBand(l)}\n        ${panoPanel(l)}", tag='65.extraBox')

# ===== CSS =====
rep(CSS, ".ld-v2 .why span { background: var(--junk-bg, #EEF0F5); color: var(--ink-600); border-radius: 999px; padding: 2px 9px; font-size: 12px; }",
""".ld-v2 .why span { background: var(--junk-bg, #EEF0F5); color: var(--ink-600); border-radius: 999px; padding: 2px 9px; font-size: 12px; }
/* v119-92 (PA-5): số khác trong bài (.ph-alt) + nút Dùng · khối bình luận thêm của khách · nút Kiểm Zalo */
.ph-hl.ph-alt { background: #fff7e6; border-color: #f5d0a0; color: #7c4a03; font-weight: 700; }
.ph-hl.ph-alt .cpi { color: #b45309; }
.ph-use { margin-left: 4px; border: 0; border-radius: 6px; background: #b45309; color: #fff; font: inherit; font-size: 10.5px; font-weight: 700; padding: 1px 6px; cursor: pointer; line-height: 1.3; }
.ph-use:hover { background: #92400e; }
.ld-extra { margin: 8px 0 2px; padding: 8px 12px; border-left: 3px solid #b45309; background: #fff7e6; border-radius: 0 10px 10px 0; font-size: 13.5px; }
.ld-extra .lb { font-size: 12px; color: #7c4a03; font-weight: 600; margin-bottom: 4px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ld-extra .lb .i { width: 13px; height: 13px; }
.ld-extra .tx { white-space: pre-line; color: var(--ink-700); }
.ld-extra-line { border-left: 3px solid #f5d0a0; background: #fff7e6; }
.zalo-chk { cursor: pointer; border: 1px dashed #b45309; background: #fff7e6; color: #7c4a03; font: inherit; font-size: 11.5px; }
.zalo-chk:hover { background: #ffedd5; }
.zalo-chk .i { width: 12px; height: 12px; }""", tag='css')

# ===== ESM =====
if ESM:
    rep(F20, "roleChip, aiTempChip, aiRescoreChip, dropChip, parentChip, aiBand, bindAiFb, dropLead, pickDropReason, setFeedQuery,", "roleChip, aiTempChip, aiRescoreChip, dropChip, parentChip, extraLine, aiBand, bindAiFb, dropLead, pickDropReason, setFeedQuery,", tag='20.esmExport')
    rep(M65, "restoreLead, roleChip, aiTempChip, aiRescoreChip, dropChip, aiBand, bindAiFb, dropLead, pickDropReason, setLeadNotes,", "restoreLead, roleChip, aiTempChip, aiRescoreChip, dropChip, aiBand, bindAiFb, dropLead, pickDropReason, extraLine, fmtPhoneVN, setLeadNotes,", tag='65.esmImport20')

# ===== smoke =====
rep(SM, "  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');",
r"""  // ===== v119-92 (PA-5): bôi mọi số trong bài (+số bàn), nút Dùng → SĐT lead · khối bình luận thêm (thẻ + modal) · nút Kiểm Zalo · bản min =====
  await page.evaluate(() => { const D = window.SL_DATA; const L = D.leads.filter(x => !x.dropped && !x.lost && x.temp === 'hot'); const a = L[0], b = L[1]; a.__k92 = 'a'; a.__bk = { text: a.text, phone: a.phone, phone_has_zalo: a.phone_has_zalo, contact_source: a.contact_source }; a.text = 'Liên hệ 0912 345 678 hoặc 0987 654 321, giờ hành chính gọi bàn 028 3822 1234'; a.phone = '+84912345678'; b.__k92 = 'b'; b.__bk = { text: b.text, text_extra: b.text_extra, phone: b.phone, phone_has_zalo: b.phone_has_zalo, contact_source: b.contact_source }; b.text = 'Cần tìm nơi bán mực khô ngon giao tận nơi'; b.text_extra = 'Ai cần ib mình, sđt 0905 111 222 nhé'; b.phone = '+84905111222'; b.phone_has_zalo = null; b.contact_source = 'comment'; location.hash = 'feed'; window.SLApp.reload(D); }); await page.waitForTimeout(500);
  const k92a = await page.evaluate(() => { const D = window.SL_DATA; const a = D.leads.find(x => x.__k92 === 'a'); const c = document.querySelector('#feedList [data-lead="' + a.id + '"]'); const main = c ? c.querySelectorAll('.ph-hl:not(.ph-alt)').length : 0, alt = c ? c.querySelectorAll('.ph-alt').length : 0, use = c ? [...c.querySelectorAll('.ph-use')].map(b => b.dataset.usephone) : []; const b = D.leads.find(x => x.__k92 === 'b'); const cb = document.querySelector('#feedList [data-lead="' + b.id + '"]'); const xl = cb && cb.querySelector('.ld-extra-line'); const btn = c && c.querySelector('.ph-use[data-usephone="+84987654321"]'); if (btn) btn.click(); return { main, alt, use, xl: xl ? xl.textContent : '', xlPh: xl ? xl.querySelectorAll('.ph-hl:not(.ph-alt)').length : 0 }; }); await page.waitForTimeout(300);
  const k92b = await page.evaluate(() => { const d = document.getElementById('slDlg'); const t = d ? d.textContent : ''; const b = d && d.querySelector('[data-dlg="1"]'); if (b) b.click(); return { dlg: !!d, t }; }); await page.waitForTimeout(500);
  const k92c = await page.evaluate(() => { const D = window.SL_DATA; const a = D.leads.find(x => x.__k92 === 'a'); const c = document.querySelector('#feedList [data-lead="' + a.id + '"]'); const main = c ? [...c.querySelectorAll('.ph-hl:not(.ph-alt)')].map(e => e.textContent.replace(/\D/g, '').slice(0, 10)) : []; return { phone: a.phone, prev: a.phone_prev, src: a.contact_source, main, alt: c ? c.querySelectorAll('.ph-alt').length : 0 }; });
  (k92a.main === 1 && k92a.alt === 2 && k92a.use.join() === '+84987654321,+842838221234' && /Chủ bài bình luận thêm/.test(k92a.xl) && /SĐT lấy từ đây/.test(k92a.xl) && k92a.xlPh === 1 && k92b.dlg && /Dùng số này/.test(k92b.t) && k92c.phone === '+84987654321' && k92c.prev === '+84912345678' && k92c.src === 'manual' && k92c.main.join() === '0987654321' && k92c.alt === 2) ? ok('v119-92 (PA-5): thẻ bôi 1 số lead + 2 số khác (di động + số bàn) có nút Dùng; Dùng 0987… → xác nhận → SĐT lead đổi (phone_prev, manual), bôi nổi đổi theo; dòng "Chủ bài bình luận thêm · SĐT lấy từ đây" có số bôi nổi') : fail('v119-92 feed: ' + JSON.stringify({ k92a, k92b, k92c }));
  await page.evaluate(() => { const D = window.SL_DATA; const b = D.leads.find(x => x.__k92 === 'b'); const cb = document.querySelector('#feedList [data-lead="' + b.id + '"] [data-chatbox]'); if (cb) cb.click(); }); await page.waitForTimeout(500);
  const k92d = await page.evaluate(() => { const m = document.getElementById('modal'); const x = m.querySelector('.ld-extra'); const z = m.querySelector('.zalo-chk'); const pill = m.querySelector('.ph-pill'); const r = { extra: x ? x.textContent : '', extraPh: x ? x.querySelectorAll('.ph-hl:not(.ph-alt)').length : 0, zalo: !!z, pillTip: pill ? (pill.getAttribute('title') || '') : '' }; if (z) z.click(); return r; }); await page.waitForTimeout(400);
  const k92e = await page.evaluate(() => { const m = document.getElementById('modal'); const open = document.getElementById('modalBg').classList.contains('show'); const cl = m.querySelector('#mClose'); if (cl) cl.click(); return { open }; }); await page.waitForTimeout(300);
  await page.evaluate(() => { const D = window.SL_DATA; D.leads.filter(x => x.__k92).forEach(l => { Object.keys(l.__bk).forEach(k => { if (l.__bk[k] === undefined) delete l[k]; else l[k] = l.__bk[k]; }); delete l.__bk; delete l.__k92; delete l.phone_prev; delete l.zalo_defer; }); window.SLApp.reload(D); }); await page.waitForTimeout(200);
  (/bình luận thêm/.test(k92d.extra) && /SĐT lấy từ đây/.test(k92d.extra) && k92d.extraPh === 1 && k92d.zalo && /bình luận/.test(k92d.pillTip) && k92e.open) ? ok('v119-92: modal có khối bình luận thêm (số bôi nổi) + nút Kiểm Zalo (SĐT chưa có kết quả) + pill nói rõ SĐT lấy từ bình luận; bấm Kiểm Zalo (demo) không văng modal') : fail('v119-92 modal: ' + JSON.stringify({ k92d, k92e }));
  { const am = fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8'), lv = fs.readFileSync(path.join(ROOT, 'assets/min/js/live.min.js'), 'utf8');
    const okMin92 = /ph-use/.test(am) && /Kiểm Zalo/.test(am) && /bình luận thêm/.test(am) && /"zaloCheckLead"/.test(lv) && /2\\d\{9\}/.test(am);
    okMin92 ? ok('v119-92: bản min có nút Dùng / Kiểm Zalo / bình luận thêm / số bàn; live.min có zaloCheckLead') : fail('v119-92 bản min thiếu mốc'); }
  errors.length ? fail('Lỗi JS: ' + errors.slice(0, 4).join(' | ')) : ok('Không có lỗi JS');""", tag='smoke.k92')
done()
