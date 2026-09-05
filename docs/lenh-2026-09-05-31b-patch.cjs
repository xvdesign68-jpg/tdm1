/* _l31_patch.cjs — LỆNH #31b (05/09/2026), marker v-selfcmt.
   Vá 3 file theo MỐC NỘI DUNG (trim-compare, tự dò indent), fail-closed: thiếu/thừa mốc → không ghi file nào.
   Idempotent: file đã có marker → bỏ qua.
   - lib/scorer.js : JSON thêm "role"/"role_reason" + quy tắc vai; prompt bình luận kèm TÁC GIẢ BÀI GỐC / NGƯỜI BÌNH LUẬN / CÙNG MỘT NGƯỜI?;
                     prefilter loại người bán/chủ bài; normRole(); retry giữ brandAi.
   - index.js      : ctx bài cha thêm parentUserUrl; comment.parent_user_url + comment.self_comment (tên/profile khớp);
                     Pha 2 bỏ self_comment trước AI (recordPost decision 'self_comment'); gate role seller/poster_self ở Pha 3;
                     recordPost + lead doc ghi role/role_reason.
   - outreach.js   : stepNickAdspower bỏ qua lead role seller/poster_self hoặc tên = chủ bài → thread active:false + log ⏭ skip. */
const fs = require('fs');
const MARK = 'v-selfcmt';
const DIR = process.env.L31_DIR || '.';
const F = {
  scorer: process.env.L31_SCORER || (DIR + '/lib/scorer.js'),
  index: process.env.L31_INDEX || (DIR + '/index.js'),
  outreach: process.env.L31_OUTREACH || (DIR + '/outreach.js')
};
const ind = l => (l.match(/^\s*/) || [''])[0];
function findOne(ls, pred, label, from, to) {
  const a = from || 0, b = (to == null) ? ls.length : to, hits = [];
  for (let i = a; i < b; i++) if (pred(ls[i].trim(), ls[i])) hits.push(i);
  if (hits.length !== 1) throw new Error('KHONG THAY MOC "' + label + '": ' + hits.length + ' hit (can dung 1)');
  return hits[0];
}
function assertNoName(src, names, file) { for (const n of names) if (src.includes(n)) throw new Error(file + ' da co ten ' + n + ' → dung de tranh trung'); }

/* ================= lib/scorer.js ================= */
const SYS_RULES = [
  '- "role" = VAI của người viết so với brand: "buyer" = đang CẦN MUA / TÌM / THUÊ thứ brand cung cấp; "seller" = đang CHÀO BÁN / CUNG CẤP / TUYỂN NGƯỜI cho chính họ, hoặc là nhà cung cấp cùng ngành với brand (ĐỐI THỦ) — kể cả khi chỉ viết ngắn kiểu "ib em", "em gửi giá", "nhà em có sẵn", "bên mình có", "check ib nhé", "liên hệ zalo"; "poster_self" = người bình luận CHÍNH LÀ tác giả bài gốc (tự trả lời dưới bài của mình); "other" = còn lại (hỏi chơi, tag bạn, cảm ơn, bàn luận).',
  '- Với BÌNH LUẬN: đọc BÀI GỐC để biết ai là người mua, ai là người bán. Bài gốc của NGƯỜI MUA (cần tìm / cần mua) mà người bình luận chào hàng, gửi giá, mời ib → role="seller" (đối thủ), is_real_lead=false. Người bình luận là tác giả bài gốc (dòng "CÙNG MỘT NGƯỜI" = CÓ, hoặc giọng chủ bài: "ib mình", "gửi kết bạn nhận JD", "còn hàng nhé") → role="poster_self", is_real_lead=false (nhu cầu nếu có đã nằm ở bài gốc). Bài gốc của NGƯỜI BÁN (chào hàng / tuyển dụng) mà người bình luận hỏi mua, hỏi giá, xin ib → có thể là role="buyer".',
  '- CHỈ role="buyer" mới được is_real_lead=true. "role_reason": 1 câu ngắn tiếng Việt giải thích vì sao xếp vai đó.'
];
const PRE_RULE = '- maybe=false nếu người viết là NGƯỜI BÁN / nhà cung cấp đang chào hàng, gửi giá, mời inbox (kể cả bình luận ngắn kiểu "ib em", "em gửi giá", "bên mình có sẵn") hoặc bình luận là của CHÍNH tác giả bài gốc (dòng "CÙNG MỘT NGƯỜI" = CÓ).';
const NORM_ROLE = [
  '/* v-selfcmt (LỆNH #31b 05/09/2026): vai người viết (buyer/seller/poster_self/other). Chuẩn hoá giá trị AI trả: đồng nghĩa → 4 giá trị chuẩn, lạ → "other", trống → "". */',
  'export function normRole(r) {',
  "  const s = String(r || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim().replace(/[\\s-]+/g, '_');",
  "  if (!s) return '';",
  '  if (/^(buyer|seller|poster_self|other)$/.test(s)) return s;',
  "  if (/self|author|tac.?gia|chu.?bai|poster|nguoi.?dang|owner/.test(s)) return 'poster_self';",
  "  if (/sell|vendor|supplier|compet|doi.?thu|nguoi.?ban|nha.?cung|recruit|tuyen/.test(s)) return 'seller';",
  "  if (/buy|customer|khach|nguoi.?mua|lead|prospect/.test(s)) return 'buyer';",
  "  return 'other';",
  '}',
  ''
];
function patchScorer(src) {
  if (src.includes(MARK)) return null;
  assertNoName(src, ['normRole'], 'scorer.js');
  const ls = src.split('\n');
  let i = findOne(ls, t => t === '{"is_real_lead":bool,"hotness":0-100,"intent":string,"industry":string,"service":string,"reply":string}', 'SYS json');
  ls[i] = '{"is_real_lead":bool,"hotness":0-100,"intent":string,"industry":string,"service":string,"reply":string,"role":"buyer|seller|poster_self|other","role_reason":string}';
  i = findOne(ls, t => t.startsWith('- "reply": 1 đoạn gợi ý phản hồi ngắn') && t.endsWith('`;'), 'SYS reply');
  ls.splice(i, 1, ls[i].slice(0, -2), ...SYS_RULES.slice(0, -1), SYS_RULES[SYS_RULES.length - 1] + '`;');
  i = findOne(ls, t => t === 'Khi phân vân → để maybe=true.`;', 'PRE_SYS end');
  ls.splice(i, 0, PRE_RULE);
  // buildPostContent: thêm danh tính 2 bên + cờ cùng người
  i = findOne(ls, t => t.startsWith('return `Đây là BÌNH LUẬN dưới một bài đăng'), 'buildPostContent return');
  const p = ind(ls[i]);
  ls.splice(i, 1,
    p + "const anon = s => /ẩn danh|anonymous|người tham gia|facebook user/i.test(s);",
    p + "const pa = String(post.parent_author || '').trim().slice(0, 80), ca = String(post.author || '').trim().slice(0, 80);",
    p + "const same = post.self_comment ? 'CÓ — người bình luận CHÍNH LÀ tác giả bài gốc' : ((pa && ca && !anon(pa) && !anon(ca)) ? 'KHÔNG (tên khác nhau)' : 'không rõ');",
    p + 'return `Đây là BÌNH LUẬN dưới một bài đăng (hãy đánh giá theo Ý ĐỊNH và VAI của NGƯỜI BÌNH LUẬN trong ngữ cảnh bài gốc).\\nTÁC GIẢ BÀI GỐC: ${pa || \'(không rõ)\'}\\nBÀI GỐC: """${ctx}"""\\nNGƯỜI BÌNH LUẬN: ${ca || \'(không rõ)\'}\\nCÙNG MỘT NGƯỜI VỚI TÁC GIẢ BÀI GỐC? ${same}\\nBÌNH LUẬN: """${body}"""`;'
  );
  // normRole trước buildPostContent (top-level)
  i = findOne(ls, t => t === 'function buildPostContent(post, maxLen) {', 'buildPostContent def');
  // lùi lên dòng comment ngay trên (nếu có) để chèn trước cả comment
  let at = i; if (at > 0 && ls[at - 1].trim().startsWith('/*')) at = at - 1;
  ls.splice(at, 0, ...NORM_ROLE);
  // retry giữ brandAi (bug cũ: lượt thử lại rơi mất hồ sơ brand)
  i = findOne(ls, t => t === 'return prefilterLead(post);', 'prefilter retry'); ls[i] = ls[i].replace('prefilterLead(post)', 'prefilterLead(post, brandAi)');
  i = findOne(ls, t => t === 'return scoreLead(post, source, weights);', 'score retry'); ls[i] = ls[i].replace('weights)', 'weights, brandAi)');
  // chuẩn hoá role sau industry default
  i = findOne(ls, t => t === "if (!obj.industry) obj.industry = source.industry || '';", 'industry default');
  ls.splice(i + 1, 0, ind(ls[i]) + "obj.role = normRole(obj.role); obj.role_reason = String(obj.role_reason || '').slice(0, 200); /* v-selfcmt */");
  return ls.join('\n');
}

/* ================= index.js ================= */
const IDX_HELPER = [
  '/* v-selfcmt (LỆNH #31b 05/09/2026): bình luận của CHÍNH chủ bài → không phải lead (bỏ trước AI, không tốn tiền). So tên bỏ dấu hoặc link profile; tên ẩn danh không tính. */',
  '  const __SL_ANON31 = /an danh|anonymous|nguoi tham gia|facebook user|nguoi dung facebook/;',
  "  function __slFold31(s) { return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }",
  '  function __slProfileKey31(u) {',
  "    const s = String(u || '').trim(); if (!s) return '';",
  "    let m = s.match(/profile\\.php\\?id=(\\d+)/) || s.match(/\\/people\\/[^/]+\\/(\\d+)/); if (m) return 'id:' + m[1];",
  "    m = s.match(/facebook\\.com\\/([A-Za-z0-9.]{3,})\\/?(?:[?#]|$)/);",
  "    return (m && !/^(groups|people|profile\\.php|photo|photos|watch|share|reel|reels|stories|events|pages|marketplace|hashtag|posts|permalink\\.php|story\\.php)$/i.test(m[1])) ? 'u:' + m[1].toLowerCase() : '';",
  '  }',
  '  function __slIsSelfComment31(c) {',
  '    const a = __slFold31(c.author), p = __slFold31(c.parent_author);',
  '    if (a && p && a === p && !__SL_ANON31.test(a)) return true;',
  '    const ka = __slProfileKey31(c.user_url), kp = __slProfileKey31(c.parent_user_url);',
  '    return !!(ka && kp && ka === kp);',
  '  }'
];
function patchIndex(src) {
  if (src.includes(MARK)) return null;
  assertNoName(src, ['__slIsSelfComment31', 'selfSkipped', '__roleBlock'], 'index.js');
  const ls = src.split('\n');
  let i;
  i = findOne(ls, t => t.startsWith('ctx.set(k, { effSrc: x.effSrc, src: x.src, row: x.row, parentAuthor: x.post.author') && t.endsWith("parentUrl: x.post.url || '' });"), 'ctx.set bai');
  ls[i] = ls[i].replace("parentUrl: x.post.url || '' });", "parentUrl: x.post.url || '', parentUserUrl: x.post.user_url || '' }); /* v-selfcmt */");
  i = findOne(ls, t => t.startsWith('const sowMetaOf = (u) =>') && t.includes("parentText: String(c.parentText || '').slice(0, 1500) } : null; };"), 'sowMetaOf');
  ls[i] = ls[i].replace("parentText: String(c.parentText || '').slice(0, 1500) } : null; };", "parentText: String(c.parentText || '').slice(0, 1500), parentUserUrl: String(c.parentUserUrl || '').slice(0, 300) } : null; };");
  i = findOne(ls, t => t.includes("ctx.set(k, { effSrc: cc.effSrc, src: cc.src, row: cc.row, parentAuthor: m.parentAuthor || '', parentText: m.parentText || '', parentUrl: m.parentUrl || m.url || '' });"), 'ctx.set gat');
  ls[i] = ls[i].replace("parentUrl: m.parentUrl || m.url || '' });", "parentUrl: m.parentUrl || m.url || '', parentUserUrl: m.parentUserUrl || '' });");
  // helper trước recordPost (cùng scope scanAll)
  i = findOne(ls, t => t === 'function recordPost(x, fields) {', 'recordPost');
  { const p = ind(ls[i]); ls.splice(i, 0, ...IDX_HELPER.map(l => l.startsWith('  ') ? p + l.slice(2) : p + l)); }
  // vòng comment: gắn parent_user_url + self_comment
  i = findOne(ls, t => t === "comment.parent_author = c.parentAuthor || '';", 'comment.parent_author');
  { let j = i; if (ls[i + 1] && ls[i + 1].trim().startsWith('comment.parent_text =')) j = i + 1;
    ls.splice(j + 1, 0, ind(ls[i]) + "comment.parent_user_url = c.parentUserUrl || ''; comment.self_comment = __slIsSelfComment31(comment); /* v-selfcmt */"); }
  // Pha 2: bỏ self_comment trước AI
  i = findOne(ls, t => t === 'const candidates = [];', 'candidates');
  ls.splice(i + 1, 0, ind(ls[i]) + 'let selfSkipped = 0; /* v-selfcmt */');
  i = findOne(ls, t => t.startsWith('const pass = !isExcluded(x.post.text, x.effSrc);'), 'pass');
  ls.splice(i, 0, ind(ls[i]) + "if (x.post.self_comment) { selfSkipped++; recordPost(x, { decision: 'self_comment' }); return; } /* v-selfcmt: chủ bài tự bình luận → không phải lead, không gọi AI */");
  i = findOne(ls, t => t.startsWith("const leadKey = u => 'L_'"), 'leadKey');
  ls.splice(i, 0, ind(ls[i]) + "if (selfSkipped) console.log('[self-comment] bỏ ' + selfSkipped + ' bình luận của chính chủ bài (không gọi AI)'); /* v-selfcmt */");
  // recordPost ghi role
  i = findOne(ls, t => t === "intent: fields.intent || '', service: fields.service || '', kept,", 'recordPost fields');
  ls[i] = ls[i] + " role: String(fields.role || '').slice(0, 24),";
  // Pha 3: gate role
  i = findOne(ls, t => t === 'const isLead = !!ai.is_real_lead && (ai.hotness || 0) >= CFG.MIN_KEEP_SCORE;', 'isLead');
  { const p = ind(ls[i]); ls.splice(i, 1,
      p + "const __role = String(ai.role || '').toLowerCase().trim(), __roleBlock = (__role === 'seller' || __role === 'poster_self'); /* v-selfcmt: người bán/đối thủ hoặc chính chủ bài → không phải lead */",
      p + 'const isLead = !!ai.is_real_lead && !__roleBlock && (ai.hotness || 0) >= CFG.MIN_KEEP_SCORE;'); }
  i = findOne(ls, t => t.startsWith("recordPost(x, { decision: isLead ? 'lead' : 'scored_low', score: ai.hotness || 0, temp: t,"), 'recordPost decision');
  ls[i] = ls[i].replace("decision: isLead ? 'lead' : 'scored_low',", "decision: isLead ? 'lead' : (__roleBlock ? (__role === 'seller' ? 'seller' : 'self_comment') : 'scored_low'),");
  i = findOne(ls, t => t === "intent: ai.intent || '', service: ai.service || '', kept: isLead });", 'recordPost kept');
  ls[i] = ls[i].replace('kept: isLead });', 'kept: isLead, role: __role });');
  i = findOne(ls, t => t === "service: ai.service || '', stage: 'new', assignee: null, reply: ai.reply || '',", 'commitLeadNow');
  ls[i] = ls[i] + " role: __role, role_reason: String(ai.role_reason || '').slice(0, 160),";
  return ls.join('\n');
}

/* ================= outreach.js ================= */
const OA_HELPER = [
  '/* v-selfcmt (LỆNH #31b 05/09/2026): KHÔNG tiếp cận người bán/đối thủ (AI role=seller) hay chính chủ bài (role=poster_self, hoặc tên người bình luận = tên tác giả bài gốc).',
  '   Ghi thread active:false (không xét lại mỗi tick) + log ⏭ status skip lên Hoạt động. */',
  'const __SL_ANON31 = /an danh|anonymous|nguoi tham gia|facebook user|nguoi dung facebook/;',
  "function __slFold31(s) { return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }",
  'function roleBlockOf(lead) {',
  "  const r = String(lead.role || '').toLowerCase().trim();",
  "  if (r === 'seller') return 'người bán/đối thủ' + (lead.role_reason ? ' (AI: ' + String(lead.role_reason).slice(0, 80) + ')' : ' (AI)');",
  "  if (r === 'poster_self' || lead.self_comment === true) return 'chính chủ bài tự bình luận';",
  "  if (lead.kind === 'comment' && lead.name && lead.parent_author) {",
  '    const a = __slFold31(lead.name), p = __slFold31(lead.parent_author);',
  "    if (a && a === p && !__SL_ANON31.test(a)) return 'chính chủ bài tự bình luận (tên khớp)';",
  '  }',
  "  return '';",
  '}',
  'async function skipLeadRole(lead, brand, acct, why) {',
  '  const pid = acct.id || acct.pid;',
  "  await db().collection('outreach_threads').doc(lead.id).set({ leadId: lead.id, pid, brand: brand.code, brandCode: brand.code, brandName: brand.name || '', name: lead.name || '', temp: lead.temp || 'cold', score: Number(lead.score) || 0, active: false, step: 'skipped_role', taskStatus: 'skipped', skipReason: why, nextAt: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });",
  "  await addLog({ leadId: lead.id, name: lead.name || '', pid, brand: brand.name, brandCode: brand.code, brandName: brand.name || '', temp: lead.temp || 'cold', score: Number(lead.score) || 0, action: '⏭ Bỏ qua lead — ' + why + ' (không tiếp cận đối thủ/chủ bài)', status: 'skip' });",
  '}',
  ''
];
function patchOutreach(src) {
  if (src.includes(MARK)) return null;
  assertNoName(src, ['roleBlockOf', 'skipLeadRole', '__slFold31'], 'outreach.js');
  const ls = src.split('\n');
  const s = findOne(ls, t => t === 'async function stepNickAdspower(brand, acct) {', 'stepNickAdspower');
  const e = findOne(ls, t => t.startsWith('export const outreachTick = onSchedule('), 'outreachTick');
  const i = findOne(ls, t => t === 'if ((await tref.get()).exists) continue;', 'tref exists (trong stepNickAdspower)', s, e);
  ls.splice(i + 1, 0, ind(ls[i]) + '{ const __rb = roleBlockOf(lead); if (__rb) { await skipLeadRole(lead, brand, acct, __rb); continue; } } /* v-selfcmt */');
  ls.splice(s, 0, ...OA_HELPER);
  return ls.join('\n');
}

/* ================= chạy: tính hết → ghi hết (fail-closed) ================= */
const out = {};
let changed = 0;
for (const [k, f] of Object.entries(F)) {
  const src = fs.readFileSync(f, 'utf8');
  const r = ({ scorer: patchScorer, index: patchIndex, outreach: patchOutreach })[k](src);
  if (r == null) { console.log('BO QUA (da co ' + MARK + '):', f); continue; }
  out[f] = r; changed++;
}
for (const [f, r] of Object.entries(out)) { fs.writeFileSync(f, r); console.log('PATCH OK', f); }
console.log('DONE: ' + changed + ' file da va, ' + (3 - changed) + ' file bo qua');
