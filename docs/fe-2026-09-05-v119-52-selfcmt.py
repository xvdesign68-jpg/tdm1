import sys, re, io
root = sys.argv[1]; esm = sys.argv[2] == 'esm'
def rd(p): return io.open(p, encoding='utf8').read()
def wr(p, s): io.open(p, 'w', encoding='utf8').write(s)
def rep1(s, old, new, label):
    n = s.count(old)
    assert n == 1, f'{label}: {n} hit'
    return s.replace(old, new)
# ---- 60-scan-views
p = root + '/src/app/60-scan-views.js'; s = rd(p)
s = rep1(s, "    no_keyword:      {label:'Không khớp keyword', color:'var(--junk,#6E7691)', bg:'var(--junk-bg,#EEF0F5)'},\n",
  "    no_keyword:      {label:'Không khớp keyword', color:'var(--junk,#6E7691)', bg:'var(--junk-bg,#EEF0F5)'},\n"
  "    self_comment:    {label:'Chủ bài tự bình luận · bỏ', color:'var(--junk,#6E7691)', bg:'var(--junk-bg,#EEF0F5)'}, /* v-selfcmt */\n"
  "    seller:          {label:'Người bán/đối thủ · bỏ', color:'var(--warm,#F59E0B)', bg:'var(--warm-bg,#FEF3E2)'},\n", 'DECIS')
s = rep1(s, "      case 'no_keyword':\n        return `Bài <b>không khớp từ khoá</b> theo dõi của nguồn nên bị bỏ qua, không đưa vào AI.`;\n",
  "      case 'no_keyword':\n        return `Bài <b>không khớp từ khoá</b> theo dõi của nguồn nên bị bỏ qua, không đưa vào AI.`;\n"
  "      case 'self_comment':\n        return `Bình luận của <b>chính người đăng bài</b> (tên/hồ sơ trùng tác giả bài gốc) - không phải khách mới nên bỏ trước khi gọi AI, tránh tự động tiếp cận nhầm người bán.`;\n"
  "      case 'seller':\n        return `AI xếp vai người viết là <b>người bán / nhà cung cấp (đối thủ)</b> - chào hàng, gửi giá, mời inbox dưới bài của người mua - nên không giữ làm lead; automation không tiếp cận.`;\n", 'decisionReason')
s = rep1(s, "    const c={lead:0,scored_low:0,prefiltered_out:0,excluded:0,no_keyword:0,error:0};\n    all.forEach(p=>{ c[p.decision]=(c[p.decision]||0)+1; });\n    const rejected=c.prefiltered_out+c.excluded+c.no_keyword;",
  "    const c={lead:0,scored_low:0,prefiltered_out:0,excluded:0,no_keyword:0,error:0,self_comment:0,seller:0};\n    all.forEach(p=>{ c[p.decision]=(c[p.decision]||0)+1; });\n    const rejected=c.prefiltered_out+c.excluded+c.no_keyword+c.self_comment+c.seller;", 'counts')
wr(p, s)
# ---- 20-feed: roleChip + card
p = root + '/src/app/20-feed.js'; s = rd(p)
s = rep1(s, "  const SEAL_IC='<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"currentColor\"/>",
  "  /* v-selfcmt: vai người viết do scanner/AI gắn (LỆNH #31b) - người bán/đối thủ hoặc chính chủ bài tự bình luận */\n"
  "  function roleChip(l){\n"
  "    if(!l) return '';\n"
  "    const r=String(l.role||'').toLowerCase(); const why=l.role_reason?' · '+esc(l.role_reason):'';\n"
  "    if(r==='seller') return `<span class=\"chip chip-role\" data-tip=\"AI xếp vai NGƯỜI BÁN / nhà cung cấp (đối thủ)${why} - automation không tiếp cận\">🏪 Người bán</span>`;\n"
  "    if(r==='poster_self'||l.self_comment===true) return `<span class=\"chip chip-role\" data-tip=\"Bình luận của chính người đăng bài${l.parent_author?' ('+esc(l.parent_author)+')':''} - không phải khách mới, automation không tiếp cận\">👤 Chủ bài</span>`;\n"
  "    return '';\n"
  "  }\n"
  "  const SEAL_IC='<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"9.5\" fill=\"currentColor\"/>", 'roleChip def')
s = rep1(s, "${slaChip(l)}${fuChip(l)}${botChip(l)}${l.dropped?", "${slaChip(l)}${fuChip(l)}${botChip(l)}${roleChip(l)}${l.dropped?", 'card chip')
if esm:
    s = rep1(s, "export { NOTE_IC, OA_STEP_VI, contactPills, crmCfg, fmtPhoneVN, fmtWhen, fuChip, hlBody, isMine, kpiCard, leadNo, leadNotes, markFirstCare, nextBestCard, noteAgo, openAssignDialog, panoPanel, renderFeed, renderFeedRail, restoreLead, ",
               "export { NOTE_IC, OA_STEP_VI, contactPills, crmCfg, fmtPhoneVN, fmtWhen, fuChip, hlBody, isMine, kpiCard, leadNo, leadNotes, markFirstCare, nextBestCard, noteAgo, openAssignDialog, panoPanel, renderFeed, renderFeedRail, restoreLead, roleChip, ", 'esm export 20')
wr(p, s)
# ---- 65 modal
p = root + '/src/app/65-charts-lead-modal.js'; s = rd(p)
s = rep1(s, "${l.kind==='comment'?' <span class=\"chip chip-warm\">Từ bình luận</span>':''}",
  "${l.kind==='comment'?' <span class=\"chip chip-warm\" data-tip=\"Lead này là 1 BÌNH LUẬN dưới bài của người khác - xem bài gốc bên dưới\">Từ bình luận'+(l.parent_author?' · dưới bài của '+esc(l.parent_author):'')+'</span>':''}${roleChip(l)}", 'modal chip')
old_lb = "class=\"src-link\">mở bài gốc</a>`:(l.post_url?` · <a href=\"${escUrl(l.post_url)}\" target=\"_blank\" rel=\"noopener\" class=\"src-link\">${SLI.linkExt||'↗'} mở bài gốc</a>`:'')}</div>\n"
assert s.count(old_lb) == 1, 'lb line'
s = s.replace(old_lb, old_lb + "          ${l.kind==='comment'&&l.parent_text?`<details class=\"ld-parent\"><summary>📄 Bài gốc${l.parent_author?' của <b>'+esc(l.parent_author)+'</b>':''} - lead này là bình luận dưới bài đó</summary><p>${esc(String(l.parent_text).slice(0,600))}</p></details>`:''}\n")
if esm:
    s = rep1(s, "import { NOTE_IC, OA_STEP_VI, contactPills, crmCfg, fmtWhen, fuChip, hlBody, leadNo, leadNotes, markFirstCare, noteAgo, openAssignDialog, panoPanel, renderFeed,",
               "import { NOTE_IC, OA_STEP_VI, contactPills, crmCfg, fmtWhen, fuChip, hlBody, leadNo, leadNotes, markFirstCare, noteAgo, openAssignDialog, panoPanel, renderFeed, roleChip,", 'esm import 65')
wr(p, s)
# ---- 45 Content Studio labels + default direct
p = root + '/src/app/45-outreach.js'; s = rd(p)
s = rep1(s, "commentStyle: 'soft', forbid: ''", "commentStyle: 'direct', forbid: ''", 'CS_DEF')
s = rep1(s, ">Đồng cảm + gợi mở, KHÔNG chào bán (an toàn nick)</option>", ">Nhẹ + CTA mềm (đồng cảm, không nêu brand - an toàn nick hơn)</option>", 'opt soft')
s = rep1(s, ">Giới thiệu nhẹ + mời inbox (rủi ro spam cao hơn)</option>", ">Trực tiếp + CTA rõ (mặc định - trả lời đúng câu khách hỏi + mời inbox)</option>", 'opt direct')
wr(p, s)
# ---- CSS
p = root + '/assets/css/app.css'; s = rd(p)
s = rep1(s, ".chip-lost { background: #feeceb; color: #d92d20; }\n",
  ".chip-lost { background: #feeceb; color: #d92d20; }\n"
  ".chip-role { background: #fef3e2; color: #b45309; border-color: transparent; } /* v-selfcmt: 🏪 người bán / 👤 chủ bài */\n"
  ".ld-parent { margin: 6px 0 2px; font-size: 12.5px; color: var(--ink-600); }\n"
  ".ld-parent summary { cursor: pointer; color: var(--brand-600); }\n"
  ".ld-parent p { margin: 6px 0 0; white-space: pre-wrap; background: var(--junk-bg, #EEF0F5); padding: 8px 10px; border-radius: 10px; }\n", 'css')
wr(p, s)
print('FE patched', root, 'esm' if esm else 'iife')
