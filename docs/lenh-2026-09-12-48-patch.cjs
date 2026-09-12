/* LỆNH #48 (12/09/2026) — "AI HARDENING" = LỆNH A của lộ trình rà soát quét→lọc→chấm điểm (anh chốt 8 câu 12/09): PB-5 + PB-3 + PB-4 + PB-2 (a/b/d) + PB-1 + 2 vá scraper (KHỐI 0 LỆNH B).
   4 file, marker LENH #48, content-anchored theo mã ĐANG CHẠY (dump #47/#47d, sha8 index.js=14a3a823 · scorer 12223e1c · scraper 66714197 · config 81d91f79), FAIL-CLOSED NGUYÊN TỬ (đủ mốc CẢ 4 file mới ghi), idempotent.
   Dùng: node _l48_patch.cjs lib/config.js lib/scorer.js lib/scraper.js index.js   ·   node _l48_patch.cjs --anchors → in JSON mốc (harness đối chiếu với dump).
   (1) lib/config.js  LLM_TRIES/LLM_TIMEOUT_MS(45 s)/LLM_POST_BUDGET_MS(90 s)/LLM_REASONING(low)/LLM_MAX_TOKENS(2000)/SCAN_SOFT_DEADLINE_S(1200)/ZALO_CHECK_COLD(false).
   (2) lib/scorer.js  PB-3: llmChat46 thêm reasoning_effort + max_completion_tokens cho gpt-5/o-series (API từ chối → bỏ field gửi lại) · finish=length → nới trần 1 lần · JSON hỏng thử lại đúng 1 lần
                      · mọi 400 thử lại 1 lần không json mode · ngân sách thời gian/bài · usage đếm reasoning tokens · replyOnly48 (xin reply bằng prompt ngắn, 1 lượt, không text thô).
                      PB-5: không key → heuristic KẸP ≤59 (điểm tạm, hết 90 nóng); heuristic biết lĩnh vực brand (bigram Hồ sơ AI) + không gán 'Performance Marketing' cho brand khác ngành; prefilter nhận opts.tries.
   (3) lib/scraper.js normalizePost: BrightData chỉ có profile_id (uid số) → user_url=profile.php?id=<uid> + author_uid (+ num_comments, gid cho LỆNH B) · normalizeComment: map commentator_profile_url (cắt tracking ?__cft__), rút uid số, user_id=pfbid → link dự phòng.
   (4) index.js       PB-2a sow46 chỉ lượt LỊCH · PB-2b nạp score_retry qua transaction (lease 15′) · PB-2d seen ghi create() + xử lý ALREADY_EXISTS · PB-1a lease ứng viên score_retry {kind:'lease'} xoá ở mọi nhánh
                      · PB-1b nguồn tắt tạm → giữ 6 h/7 ngày · PB-1c trần mềm 1.200 s (giữ lease) · PB-1d bọc lỗi từng bài (pipeErrors) · PB-1e lượt ném lỗi → scans status:'aborted' + system_status/scan
                      · PB-3d circuit-breaker trong lượt (3 hỏng/0 OK → tries 1) · PB-3e miss-reply → replyOnly48 · PB-3g eKYC bỏ lead lạnh (zalo_defer; quét-vét bỏ qua tới khi sales chăm)
                      · PB-4 giám sát cửa sổ trượt 15′ (kích cả khi 1 bài/lượt) + hysteresis 2 OK + tầng 1 [LLM-PRE-DOWN] WARNING (vẫn fail-open) + badreq hệ thống → defer + [LLM-DOWN] kind badreq/nokey
                      · PB-5 sweeper: không key/breaker mở/quá trần → không chạy; lead sales đang chăm → giữ temp ≥ lạnh + ai_flag (không junk); base_score; lease 10′; text ghép touches; bỏ lead badreq <24 h
                      · lead ghi author_uid + zalo_defer · scans ghi model/tokensReasoning/leased/softStop/pipeErrors/seenRace/cbOpen/badreq/runId/status. */
const fs = require('fs');
const ANCH = { config: {}, scorer: {}, scraper: {}, index: {} };
const A = (grp, k, s) => { ANCH[grp][k] = s; return s; };

/* ================= (1) lib/config.js ================= */
const CF1 = A('config', 'CF1 SCORE_CONCURRENCY', "  SCORE_CONCURRENCY: num(env.SCORE_CONCURRENCY, 6),");
const CF1_NEW = CF1 + `
  // LENH #48 (12/09/2026): gọi LLM bền + trần mềm lượt quét + eKYC (chỉnh trong .env; giá trị mặc định = khuyến nghị)
  LLM_TRIES: num(env.LLM_TRIES, 4),                       // số lần thử 1 bài (429/5xx/mạng/JSON hỏng)
  LLM_TIMEOUT_MS: num(env.LLM_TIMEOUT_MS, 45000),         // mỗi lượt gọi (trước 60 s)
  LLM_POST_BUDGET_MS: num(env.LLM_POST_BUDGET_MS, 90000), // tổng chờ tối đa cho 1 bài (kể cả giãn cách)
  LLM_REASONING: env.LLM_REASONING || 'low',              // reasoning_effort cho gpt-5/o-series (content.js LỆNH #29 đã dùng)
  LLM_MAX_TOKENS: num(env.LLM_MAX_TOKENS, 2000),          // max_completion_tokens (token suy nghĩ tính vào đây)
  SCAN_SOFT_DEADLINE_S: num(env.SCAN_SOFT_DEADLINE_S, 1200), // quá mốc này lượt quét ngừng chấm bài mới (giữ lease, lượt sau chấm)
  ZALO_CHECK_COLD: bool(env.ZALO_CHECK_COLD, false),      // true = kiểm eKYC cả lead lạnh như cũ`;

/* ================= (2) lib/scorer.js ================= */
const SC1 = A('scorer', 'SC1 LLM46', "const LLM46 = { tries: Math.max(1, Number(process.env.LLM_TRIES) || 4), waits: [2000, 5000, 12000], timeoutMs: Math.max(5000, Number(process.env.LLM_TIMEOUT_MS) || 60000), maxWaitMs: 30000 };");
const SC1_NEW = "const LLM46 = { tries: Math.max(1, Number(CFG.LLM_TRIES || process.env.LLM_TRIES) || 4), waits: [2000, 5000, 12000], timeoutMs: Math.max(5000, Number(CFG.LLM_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS) || 45000), maxWaitMs: 30000, budgetMs: Math.max(10000, Number(CFG.LLM_POST_BUDGET_MS || process.env.LLM_POST_BUDGET_MS) || 90000), reasoning: String(CFG.LLM_REASONING || process.env.LLM_REASONING || 'low'), maxTokens: Math.max(256, Number(CFG.LLM_MAX_TOKENS || process.env.LLM_MAX_TOKENS) || 2000) }; /* LENH #48 (PB-3): timeout 45 s · ngân sách 90 s/bài · reasoning_effort low · max_completion_tokens 2000 */";
const SC2_A = A('scorer', 'SC2 llmChat46 head', "async function llmChat46(body, o) {\n  o = o || {}; const tries = Math.max(1, o.tries || LLM46.tries); const base = String(CFG.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\\/+$/, '');");
const SC2_B = A('scorer', 'SC2 llmChat46 tail', "  throw lastErr || mkErr46('net', 0, 'LLM: không rõ lỗi');\n}");
const SC2_NEW = `async function llmChat46(body, o) { /* LENH #48 (PB-3): reasoning_effort/max_completion_tokens cho gpt-5/o-series (API từ chối → bỏ field gửi lại) · finish=length → nới trần 1 lần · JSON hỏng thử lại đúng 1 lần · mọi 400 thử 1 lần không json mode · ngân sách thời gian/bài */
  o = o || {}; const tries = Math.max(1, o.tries || LLM46.tries); const base = String(CFG.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\\/+$/, '');
  const msgs = (body.messages || []).map(m => Object.assign({}, m, { content: sanitize46(m.content) }));
  const isReason = /^(gpt-5|o\\d)/i.test(String(body.model || '')); let useReason = isReason && o.reasoning !== false; let tokCap = Math.max(256, Number(o.maxTokens) || LLM46.maxTokens); let grew = false, fmtN = 0;
  let noJson = false, lastErr = null; const tStart = Date.now();
  for (let i = 0; i < tries; i++) {
    llmHealth46.attempts++;
    const req = Object.assign({}, body, { messages: msgs }); if (noJson) delete req.response_format;
    if (useReason) { req.reasoning_effort = LLM46.reasoning; req.max_completion_tokens = tokCap; }
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), LLM46.timeoutMs);
    let r = null, txt = '', err = null;
    try { r = await fetch(base + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + CFG.LLM_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: ctl.signal }); txt = await r.text(); }
    catch (e) { err = mkErr46('net', 0, 'LLM mạng/timeout: ' + ((e && e.name === 'AbortError') ? ('quá ' + LLM46.timeoutMs + ' ms') : String((e && e.message) || e)).slice(0, 160)); }
    finally { clearTimeout(tm); }
    if (!err) {
      let j = null; try { j = JSON.parse(txt); } catch (_) { j = null; }
      if (!r.ok) {
        const eo = (j && j.error) || {}; const emsg = String(eo.message || txt); const kind = kindOf46(r.status, eo.code, eo.type, emsg);
        if (kind === 'badreq' && useReason && /reasoning_effort|max_completion_tokens|unsupported|unrecognized|not supported|unknown parameter/i.test(emsg)) { useReason = false; llmHealth46.attemptsFail++; i--; continue; } // model không nhận tham số reasoning → gửi lại không kèm
        if (kind === 'badreq' && !noJson && req.response_format) { noJson = true; llmHealth46.attemptsFail++; i--; continue; } // mọi 400: thử 1 lần không json mode
        err = mkErr46(kind, r.status, 'LLM ' + r.status + (eo.code ? ' ' + eo.code : '') + (eo.type ? ' [' + eo.type + ']' : '') + ': ' + emsg.slice(0, 200));
        err.retryAfter = Number(r.headers && r.headers.get && r.headers.get('retry-after')) || 0;
      } else {
        const ch = (j && j.choices && j.choices[0]) || {}; const content = (ch.message && ch.message.content) || '';
        if (ch.finish_reason === 'length' && useReason && !grew) { grew = true; tokCap = tokCap * 2; llmHealth46.attemptsFail++; i--; continue; } // token suy nghĩ ăn hết trần → nới gấp đôi 1 lần
        const obj = parseJson46(content);
        if (!obj) err = mkErr46('format', 200, 'LLM 200 nhưng không đọc được JSON (finish=' + (ch.finish_reason || '?') + ', ' + content.length + ' ký tự): ' + content.slice(0, 120));
        else return { obj, usage: j.usage || {}, model: j.model || body.model || '', finish: ch.finish_reason || '' };
      }
    }
    lastErr = err; llmHealth46.attemptsFail++;
    if (err.kind === 'format' && ++fmtN >= 2) break; // JSON hỏng: thử lại đúng 1 lần
    if (!RETRY46[err.kind] || i === tries - 1) break;
    let w = LLM46.waits[Math.min(i, LLM46.waits.length - 1)]; if (err.retryAfter) w = Math.max(w, err.retryAfter * 1000); w = Math.min(w, LLM46.maxWaitMs) + Math.floor(Math.random() * 500);
    if ((Date.now() - tStart) + w > LLM46.budgetMs) break; // hết ngân sách thời gian cho bài này → trả lỗi (index.js xếp hàng chấm lại)
    await new Promise(res => setTimeout(res, w));
  }
  throw lastErr || mkErr46('net', 0, 'LLM: không rõ lỗi');
}`;
const SC3 = A('scorer', 'SC3 usage46', "const usage46 = u => { u = u || {}; const pt = Number(u.prompt_tokens) || 0, ct = Number(u.completion_tokens) || 0; return { prompt: pt, completion: ct, total: Number(u.total_tokens) || (pt + ct) }; };");
const SC3_NEW = "const usage46 = u => { u = u || {}; const pt = Number(u.prompt_tokens) || 0, ct = Number(u.completion_tokens) || 0; return { prompt: pt, completion: ct, total: Number(u.total_tokens) || (pt + ct), reasoning: Number(u.completion_tokens_details && u.completion_tokens_details.reasoning_tokens) || 0 }; }; /* LENH #48: đếm token suy nghĩ */";
const SC4 = A('scorer', 'SC4 heuristicCapped46', "function heuristicCapped46(post, source) {\n  const h = heuristic((post && post.text) || '', source || {});");
const SC4_NEW = "function heuristicCapped46(post, source, brandAi) { /* LENH #48: truyền Hồ sơ AI brand */\n  const h = heuristic((post && post.text) || '', source || {}, brandAi);";
const SC5 = A('scorer', 'SC5 heuristic head', "function heuristic(text, source) {\n  const t = (text || '').toLowerCase();");
const SC5_NEW = `/* LENH #48 (PB-5b): heuristic dự phòng biết LĨNH VỰC brand — bigram từ Hồ sơ AI (brands/{code}.ai nganh/dichvu/khach) thay vì chỉ từ khoá agency marketing */
const KW_STOP48 = new Set('và của cho các với là có được những người khách hàng bên mình bạn anh chị em tại từ trong ngoài đến về theo hoặc như khi này đó nào một hai ba cần tìm mua bán dịch vụ sản phẩm giá tốt nhất uy tín chất lượng nhu cầu thường gặp nhanh đang sẽ đã rất nhiều ít mọi tất cả'.split(' '));
function brandKw48(ai) {
  if (!ai || typeof ai !== 'object') return [];
  const raw = [ai.nganh, ai.dichvu, ai.khach].map(v => String(v || '')).join(' ').toLowerCase().replace(/[^\\p{L}\\p{N}\\s]/gu, ' ');
  const w = raw.split(/\\s+/).filter(x => x.length >= 2 && !KW_STOP48.has(x)); const out = new Set();
  for (let i = 0; i + 1 < w.length && out.size < 80; i++) out.add(w[i] + ' ' + w[i + 1]);
  return [...out];
}
function heuristic(text, source, brandAi) {
  const t = (text || '').toLowerCase(); const bk = brandKw48(brandAi); const bkHit = bk.length ? bk.filter(k => t.includes(k)).length : 0; /* LENH #48 */`;
const SC6 = A('scorer', 'SC6 heuristic budget', "  if (/\\d+\\s*(tr|triệu|k\\b)/.test(t)) score += 10;     // có ngân sách");
const SC6_NEW = "  if (bkHit >= 2) score += 25; else if (bkHit === 1) score += 15; // LENH #48: khớp lĩnh vực brand\n" + SC6;
const SC7 = A('scorer', 'SC7 heuristic service', "    service: source.industry ? 'Performance Marketing' : '',");
const SC7_NEW = "    service: (brandAi && (brandAi.dichvu || brandAi.nganh)) ? '' : (source.industry ? 'Performance Marketing' : ''), /* LENH #48: không gán dịch vụ agency cho brand khác ngành */";
const SC8 = A('scorer', 'SC8 scoreLead nokey', "  if (!CFG.LLM_API_KEY) return heuristic(post.text, source);          // không cấu hình LLM → heuristic như trước (cố ý)\n  if (opts.heuristicOnly) return heuristicCapped46(post, source);     // bài chờ AI quá hạn → dự phòng kẹp ≤ 59");
const SC8_NEW = "  if (!CFG.LLM_API_KEY) { const h = heuristicCapped46(post, source, brandAi); h._nokey = true; return h; } // LENH #48 (PB-5a): không key → điểm tạm KẸP ≤ 59 (hết 90 điểm nóng từ từ khoá), sweeper không chạy\n  if (opts.heuristicOnly) return heuristicCapped46(post, source, brandAi);     // bài chờ AI quá hạn → dự phòng kẹp ≤ 59";
const SC9 = A('scorer', 'SC9 prefilter head', "export async function prefilterLead(post, brandAi) { /* v-brandai · LENH #46: llmChat46 (2 lần, fail-open) */");
const SC9_NEW = "export async function prefilterLead(post, brandAi, opts) { /* v-brandai · LENH #46: llmChat46 (2 lần, fail-open) · LENH #48: opts.tries (circuit-breaker) */";
const SC10 = A('scorer', 'SC10 prefilter tries', "    ] }, { tries: 2 });\n    llmHealth46.preOk++;");
const SC10_NEW = "    ] }, { tries: (opts && opts.tries) || 2 });\n    llmHealth46.preOk++;";
const SC11 = A('scorer', 'SC11 exports', "scoreLead.health46 = llmHealth46; scoreLead.heuristic46 = heuristicCapped46; scoreLead.llmChat46 = llmChat46; scoreLead.sanitize46 = sanitize46; scoreLead.parseJson46 = parseJson46; scoreLead.cfg46 = LLM46; /* LENH #46 */");
const SC11_NEW = SC11 + `
/* LENH #48 (PB-3e): chỉ xin "reply" bằng prompt NGẮN (1 lượt, không chấm lại toàn bài, KHÔNG gửi text thô của bài) khi model quên field reply */
const REPLY_SYS48 = 'Bạn là trợ lý sales tại Việt Nam. Dựa trên hồ sơ nhu cầu đã chấm, viết 1 gợi ý phản hồi ngắn (2–3 câu) để sales gửi cho khách: đúng ngữ cảnh, lịch sự, xưng hô phù hợp, KHÔNG bịa giá/khuyến mãi, không spam, kết bằng 1 câu hỏi hoặc lời mời trao đổi. Trả về DUY NHẤT JSON {"reply":string}.';
async function replyOnly48(post, source, brandAi, ai) {
  if (!CFG.LLM_API_KEY) return { reply: '', _llm: false, _usage: { prompt: 0, completion: 0, total: 0 } };
  const a = ai || {};
  const usr = 'Ngành: ' + (a.industry || (source && source.industry) || (brandAi && brandAi.nganh) || 'đa ngành') + '\\nNhu cầu của khách: ' + String(a.need || a.intent || '').slice(0, 300) + '\\nÝ định mua: ' + String(a.intent || '').slice(0, 200) + '\\nVai: ' + (a.role || 'buyer') + '\\nDịch vụ gợi ý: ' + String(a.service || '').slice(0, 120) + '\\nKênh: ' + ((post && post.kind) === 'comment' ? 'bình luận dưới bài' : 'bài đăng') + ' · Tên khách: ' + String((post && post.author) || '').slice(0, 60);
  const r = await llmChat46({ model: CFG.LLM_MODEL, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: REPLY_SYS48 + brandAiCtx(brandAi) }, { role: 'user', content: usr }] }, { tries: 1, maxTokens: 600 });
  return { reply: String((r.obj && r.obj.reply) || '').trim(), _llm: true, _usage: usage46(r.usage), _model: r.model || '' };
}
scoreLead.replyOnly48 = replyOnly48; scoreLead.brandKw48 = brandKw48; /* LENH #48 */`;

/* ================= (3) lib/scraper.js ================= */
const SR0 = A('scraper', 'SR0 comment map', "/* Chuẩn hoá field (tên field tuỳ dataset, map tại đây) */");
const SR0_NEW = `/* LENH #48 (12/09/2026, KHỐI 0 LỆNH B): record BrightData — bài chỉ có profile_id (uid số, KHÔNG có user_url); bình luận có commentator_profile_url kèm tracking ?__cft__… và user_id = pfbid.
   → rút uid số / cắt tracking để lead có author_url + author_uid (kết bạn/inbox mở cho ~100 % lead, API nội bộ theo uid). */
function stripQ48(u) { const s = String(u || '').trim(); if (!s) return ''; const m = s.match(/profile\\.php\\?(?:[^#]*&)?id=([\\w.-]+)/i); if (m) return 'https://www.facebook.com/profile.php?id=' + m[1]; return s.split(/[?#]/)[0].replace(/\\/+$/, ''); }
function uidOf48(u) { const s = String(u || ''); const m = s.match(/[?&]id=(\\d{5,})(?:\\D|$)/) || s.match(/\\/user\\/(\\d{5,})(?:\\/|$)/) || s.match(/\\/people\\/[^/]+\\/(\\d{5,})(?:\\/|$)/) || s.match(/\\/profile\\/(\\d{5,})(?:\\/|$)/); return m ? m[1] : ''; }
function profileOf48(raw, id) { const s = stripQ48(raw); if (s) return s; const v = String(id || '').trim(); return (/^\\d{5,}$/.test(v) || /^pfbid[\\w-]{10,}$/i.test(v)) ? ('https://www.facebook.com/profile.php?id=' + v) : ''; }
function authorUidOf48(raw, id) { const u = uidOf48(raw); if (u) return u; const v = String(id || '').trim(); return /^\\d{5,}$/.test(v) ? v : ''; }
` + SR0;
const SR1 = A('scraper', 'SR1 normalizePost user_url', "    user_url: p.user_url || p.profile_url || p.user_profile_url || '',  /* v-patch user_url-map: giu link profile nguoi dang */");
const SR1_NEW = "    user_url: profileOf48(p.user_url || p.profile_url || p.user_profile_url || '', p.profile_id),  /* v-patch user_url-map · LENH #48: BrightData chỉ có profile_id (uid số) → profile.php?id=<uid> */\n    author_uid: authorUidOf48(p.user_url || p.profile_url || p.user_profile_url || '', p.profile_id), /* LENH #48 */\n    num_comments: Number(p.num_comments) || 0, gid: String(p.group_id || '').trim(), /* LENH #48: cho nhịp bình luận + gid số (LỆNH B) */";
const SR2 = A('scraper', 'SR2 normalizeComment user_url', "    user_url:  c.user_url || c.commenter_url || c.commenter_profile_url || '',");
const SR2_NEW = "    user_url:  profileOf48(c.user_url || c.commenter_url || c.commenter_profile_url || c.commentator_profile_url || '', c.user_id || c.commenter_id), /* LENH #48: dataset dùng commentator_profile_url (kèm tracking) · user_id = pfbid → link dự phòng */\n    author_uid: authorUidOf48(c.user_url || c.commenter_url || c.commenter_profile_url || c.commentator_profile_url || '', c.user_id || c.commenter_id), /* LENH #48 */";

/* ================= (4) index.js ================= */
const IX1 = A('index', 'IX1 __h0', "  let llmDeferred = 0, llmFallback = 0, rescored46 = 0; const __h0 = { ok: Number((scoreLead.health46 || {}).ok) || 0, fail: Number((scoreLead.health46 || {}).fail) || 0, pre: Number((scoreLead.health46 || {}).preFail) || 0 }; // LENH #46");
const IX1_NEW = `  let llmDeferred = 0, llmFallback = 0, rescored46 = 0; const __h0 = { ok: Number((scoreLead.health46 || {}).ok) || 0, fail: Number((scoreLead.health46 || {}).fail) || 0, pre: Number((scoreLead.health46 || {}).preFail) || 0, preOk: Number((scoreLead.health46 || {}).preOk) || 0 }; // LENH #46 · LENH #48 preOk
  /* ===== LENH #48 (12/09/2026) — AI hardening: lease ứng viên (score_retry kind 'lease') · trần mềm · bọc lỗi từng bài · circuit-breaker · badreq hệ thống · nạp score_retry bằng transaction ===== */
  const runId48 = trigger + '_' + t0.toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const SOFT48 = Math.max(120, Number(CFG.SCAN_SOFT_DEADLINE_S) || 1200) * 1000; const overSoft48 = () => (Date.now() - t0) > SOFT48;
  let pipeErrors48 = 0, softStop48 = 0, seenRace48 = 0, leased48 = 0, badreq48 = 0, reasonTok48 = 0, candLeased48 = 0; const cb48 = { open: false };
  const cbTick48 = () => { const H = scoreLead.health46 || {}; if (!cb48.open && ((Number(H.fail) || 0) - __h0.fail) >= 3 && ((Number(H.ok) || 0) - __h0.ok) === 0) { cb48.open = true; console.warn('[LLM-CB] 3 bài chấm hỏng liên tiếp, 0 OK → các bài còn lại chỉ thử 1 lần (vào score_retry sớm, lượt quét không kéo dài)'); } };
  const slimPost48 = p => { const o = {}; for (const k of Object.keys(p || {})) { const v = p[k]; if (k.charAt(0) === '_') continue; if (typeof v === 'string') o[k] = v.slice(0, k === 'text' ? 4000 : 1500); else if (typeof v === 'number' || typeof v === 'boolean') o[k] = v; } return o; };
  const retryRef48 = p => { const key = String((p && p.post_id) || '').replace(/[^\\w-]/g, '_').slice(0, 470); return key ? db.collection('score_retry').doc('R_' + key) : null; };
  const unlease48 = async x => { if (x && x.leaseRef) { const r = x.leaseRef; x.leaseRef = null; await r.delete().catch(() => {}); } };\n  const settle48 = async x => { if (x && x.deferredRef) { const r = x.deferredRef; x.deferredRef = null; await r.delete().catch(() => {}); } await unlease48(x); }; // LENH #48: gỡ lease + doc chờ CHỈ khi bài đã đi hết đường (ghi lead xong / không phải lead) — lỗi eKYC/commit giữa chừng → giữ để lượt sau chấm lại
  const lease48 = async ref => { try { return await db.runTransaction(async tx => { const s = await tx.get(ref); if (!s.exists) return false; const d = s.data() || {}; if ((Number(d.nextAt) || 0) > Date.now()) return false; tx.update(ref, { nextAt: Date.now() + 15 * 60e3, leaseBy: runId48, leaseAt: Date.now() }); return true; }); } catch (e) { return false; } };`;
const IX2 = A('index', 'IX2 prog starting', "  await prog('starting', true);");
const IX2_NEW = "  try { await db.collection('system_status').doc('scan').set({ phase: 'starting', at: Date.now(), runId: runId48, trigger, lastStartAt: Date.now() }, { merge: true }); } catch (_) {} // LENH #48 (PB-1e)\n" + IX2;
const IX3 = A('index', 'IX3 seen batch', "    const wb = db.batch(); let writes = 0;\n    slice.forEach((x, j) => {\n      const wasSeen = snaps[j] && snaps[j].exists;\n      if (wasSeen && !force) { skippedSeen++; return; }            // chống trùng (tắt khi quét lại từ đầu)\n      if (!wasSeen) { wb.set(seenDoc(x.post.post_id), { at: FieldValue.serverTimestamp() }); writes++; }");
const IX3_NEW = "    const wb = db.batch(); let writes = 0; const fresh48 = []; // LENH #48 (PB-2d): seen ghi bằng create() — 2 lượt chồng (Quét ngay ↔ lịch) không cùng nhận 1 bài\n    slice.forEach((x, j) => {\n      const wasSeen = snaps[j] && snaps[j].exists;\n      if (wasSeen && !force) { skippedSeen++; return; }            // chống trùng (tắt khi quét lại từ đầu)\n      if (!wasSeen) { wb.create(seenDoc(x.post.post_id), { at: FieldValue.serverTimestamp(), run: runId48 }); writes++; fresh48.push(x); }";
const IX4 = A('index', 'IX4 seen commit', "    if (writes) { try { await wb.commit(); } catch (e) {} }\n    await flushPosts();\n    await prog('filtering');");
const IX4_NEW = `    if (writes) { try { await wb.commit(); } catch (e) {
      /* LENH #48 (PB-2d): ALREADY_EXISTS = lượt khác vừa ghi seen cho ≥1 bài trong lô → đọc lại, bỏ bài đã có chủ, ghi lại phần còn lại (create theo lô là nguyên tử) */
      const race = !!(e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message || e))));
      if (!race) console.warn('[seen] commit lỗi:', e && e.message);
      else { let s2 = []; try { s2 = await db.getAll(...fresh48.map(x => seenDoc(x.post.post_id))); } catch (_) { s2 = []; }
        const wb2 = db.batch(); let w2 = 0;
        fresh48.forEach((x, k) => { if (s2[k] && s2[k].exists) { if (!force) { seenRace48++; skippedSeen++; const ci = candidates.indexOf(x); if (ci >= 0) candidates.splice(ci, 1); } } else { wb2.create(seenDoc(x.post.post_id), { at: FieldValue.serverTimestamp(), run: runId48 }); w2++; } });
        if (w2) { try { await wb2.commit(); } catch (e2) { console.warn('[seen] commit lần 2 lỗi:', e2 && e2.message); } } } } }
    /* LENH #48 (PB-1a): LEASE ứng viên — mỗi bài qua exclude ghi score_retry/R_<post_id> {kind:'lease', nextAt +30′}; xoá ở MỌI nhánh quyết định; lượt bị cắt/crash → lượt theo lịch 30′ sau tự chấm lại đúng bài (không mất bài, không phải nhờ BrightData lấy lại) */
    { const lw = db.batch(); let ln = 0;
      for (const x of candidates.slice(candLeased48)) { const ref = retryRef48(x.post); if (!ref) continue; x.leaseRef = ref; lw.set(ref, { post: slimPost48(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || '') }, tries: 0, firstAt: Date.now(), leaseAt: Date.now(), leaseBy: runId48, nextAt: Date.now() + 30 * 60e3, kind: 'lease', updatedAt: FieldValue.serverTimestamp() }); ln++; }
      candLeased48 = candidates.length;
      if (ln) { try { await lw.commit(); leased48 += ln; } catch (e) { console.warn('[lease] ghi lease lỗi (bỏ qua, lượt này vẫn chấm):', e && e.message); } } }
    await flushPosts();
    await prog('filtering');`;
const IX5 = A('index', 'IX5 prefilter call', "      const pf = await prefilterLead(x.post, await __brandAiOf(x.effSrc || x.src || x.source)); /* v-brandai */");
const IX5_NEW = "      if (overSoft48()) { softStop48++; return; } // LENH #48 (PB-1c): quá trần mềm → giữ lease, lượt theo lịch sau chấm\n      let pf; try { pf = await prefilterLead(x.post, await __brandAiOf(x.effSrc || x.src || x.source), { tries: cb48.open ? 1 : 2 }); } catch (e48) { pipeErrors48++; pf = { maybe: true, _usage: {}, _llm: false, _err: 'pipe' }; } /* v-brandai · LENH #48: tries theo circuit-breaker, lỗi ngoài LLM → fail-open */";
const IX6 = A('index', 'IX6 prefiltered_out', "      else recordPost(x, { decision: 'prefiltered_out' });");
const IX6_NEW = "      else { recordPost(x, { decision: 'prefiltered_out' }); await unlease48(x); } // LENH #48: đã quyết định → gỡ lease";
const IX7 = A('index', 'IX7 sow46', "  const sow46 = !isBackfill && !opts.sourceUrl && !force;");
const IX7_NEW = "  const sow46 = trigger === 'scheduled' && !isBackfill && !opts.sourceUrl && !force; // LENH #48 (PB-2a): chỉ lượt theo LỊCH nạp score_retry + chấm lại điểm tạm (Quét ngay không chồng việc)";
const IX8 = A('index', 'IX8 defer badreq', "    if (!key || kind === 'badreq') { if (x.deferredRef) { await x.deferredRef.delete().catch(() => {}); x.deferredRef = null; } return 'fallback'; } // không định danh được / request hỏng cho riêng bài này → dự phòng ngay");
const IX8_NEW = "    const badreqSys = badreq48 >= 2 && ((Number((scoreLead.health46 || {}).ok) || 0) - __h0.ok) === 0; // LENH #48 (PB-4c): ≥2 bài 400 & 0 OK = lỗi hệ thống (tham số/model) → xếp hàng, KHÔNG đẻ lead heuristic mỗi lượt\n    if (!key || (kind === 'badreq' && !badreqSys)) return 'fallback'; // không định danh được / request hỏng cho riêng bài này → dự phòng ngay · LENH #48: doc chờ/lease gỡ ở CUỐI (settle48) sau khi ghi lead";
const IX35 = A('index', 'IX35 defer expired', "    if (tries > RETRY_WAIT46.length || Date.now() - firstAt > 24 * 3600e3) { if (x.deferredRef) { await x.deferredRef.delete().catch(() => {}); x.deferredRef = null; } return 'fallback'; }");
const IX35_NEW = "    if (tries > RETRY_WAIT46.length || Date.now() - firstAt > 24 * 3600e3) return 'fallback'; // LENH #48: quá hạn → dự phòng; doc chờ gỡ ở cuối (settle48) sau khi ghi lead";
const IX9 = A('index', 'IX9 defer ok', "      x.deferredRef = null; return 'deferred';");
const IX9_NEW = "      x.deferredRef = null; x.leaseRef = null; return 'deferred'; // LENH #48: doc lease đã thành doc chờ (cùng id) → không gỡ";
const IX10 = A('index', 'IX10 loader', "        const r = d.data() || {}; const src = sources.find(s => s.url === (r.src && r.src.url)) || null;\n        if (!src || !r.post || !r.post.post_id) { await d.ref.delete().catch(() => {}); continue; } // nguồn đã xoá/tắt → bỏ");
const IX10_NEW = `        const r = d.data() || {}; const src = sources.find(s => s.url === (r.src && r.src.url)) || null;
        if (!r.post || !r.post.post_id) { await d.ref.delete().catch(() => {}); continue; } // không định danh được → bỏ
        if (!src) { /* LENH #48 (PB-1b): nguồn tạm tắt/đổi URL → GIỮ, hoãn 6 h; quá 7 ngày mới bỏ */
          if (Date.now() - (Number(r.firstAt) || Number(r.leaseAt) || 0) > 7 * 86400e3) await d.ref.delete().catch(() => {});
          else await d.ref.set({ nextAt: Date.now() + 6 * 3600e3, lastErr: 'nguồn không còn bật', updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
          continue; }
        if (!(await lease48(d.ref))) continue; // LENH #48 (PB-2b): lượt khác vừa nhận bài này (transaction, lease 15′)`;
const IX11 = A('index', 'IX11 mapPool head', "  await mapPool(toScore, CFG.SCORE_CONCURRENCY || 6, async (x) => {\n    let ai; try { ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc)); }");
const IX11_NEW = "  await mapPool(toScore, CFG.SCORE_CONCURRENCY || 6, async (x) => { try { // LENH #48 (PB-1d): bọc trọn 1 bài — lỗi eKYC/commit/… không làm rớt cả lượt, lease giữ để lượt sau chấm lại\n    if (overSoft48()) { softStop48++; return; } // LENH #48 (PB-1c): quá trần mềm → giữ lease (score_retry), lượt theo lịch sau chấm\n    let ai; try { ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc), { tries: cb48.open ? 1 : 0 }); }";
const IX12 = A('index', 'IX12 defer call', "      const r46 = await deferPost46(x, e46);\n      if (r46 === 'fallback') { ai = scoreLead.heuristic46(x.post, x.effSrc); llmFallback++; }");
const IX12_NEW = "      if ((e46 && e46.kind) === 'badreq') badreq48++; cbTick48(); // LENH #48\n      const r46 = await deferPost46(x, e46);\n      if (r46 === 'fallback') { ai = scoreLead.heuristic46(x.post, x.effSrc, await __brandAiOf(x.effSrc)); llmFallback++; } // LENH #48 (PB-5b): dự phòng biết lĩnh vực brand";
const IX13 = A('index', 'IX13 deferredRef delete', "    if (x.deferredRef) { rescored46++; await x.deferredRef.delete().catch(() => {}); x.deferredRef = null; } // LENH #46: bài chờ đã được AI chấm → xoá hàng chờ");
const IX13_NEW = "    if (x.deferredRef) rescored46++; // LENH #46: bài chờ đã được AI chấm · LENH #48: doc chờ + lease gỡ ở CUỐI (settle48) sau khi ghi lead xong — lỗi eKYC/commit giữa chừng không làm mất bài";
const IX14 = A('index', 'IX14 tokens', "    mainIn += u.prompt || 0; mainOut += u.completion || 0;\n    const t = tempOf(ai.hotness || 0); if (dist[t] !== undefined) dist[t]++;");
const IX14_NEW = "    mainIn += u.prompt || 0; mainOut += u.completion || 0; reasonTok48 += u.reasoning || 0; // LENH #48\n    const t = tempOf(ai.hotness || 0); if (dist[t] !== undefined) dist[t]++;";
const IX15_A = A('index', 'IX15 miss-reply head', "    if (ai._llm !== false && !(ai.reply && String(ai.reply).trim())) { // LENH #46: đang dùng dự phòng thì không gọi lại");
const IX15_B = A('index', 'IX15 miss-reply tail', "      if (!(ai.reply && String(ai.reply).trim())) console.error('[miss-reply] van rong sau 3 luot:', x.post.url || x.post.author || '');\n    }");
const IX15_NEW = `    if (ai._llm !== false && !cb48.open && !(ai.reply && String(ai.reply).trim())) { // LENH #46: đang dùng dự phòng thì không gọi lại · LENH #48 (PB-3e): xin reply bằng prompt NGẮN 1 lượt thay vì chấm lại toàn bài 2 lần
      try {
        const __r2 = await scoreLead.replyOnly48(x.post, x.effSrc, await __brandAiOf(x.effSrc), ai);
        const __u2 = __r2._usage || {}; if (__r2._llm) scoreCalls++; mainIn += __u2.prompt || 0; mainOut += __u2.completion || 0; reasonTok48 += __u2.reasoning || 0;
        if (__r2.reply && String(__r2.reply).trim()) ai.reply = __r2.reply;
      } catch (e) {}
      if (!(ai.reply && String(ai.reply).trim())) console.error('[miss-reply] van rong sau 2 luot:', x.post.url || x.post.author || '');
    }`;
const IX16 = A('index', 'IX16 eKYC', "    const _zc = await enrichPhoneFromText((x.post.text || ''), { db, apiKey: process.env.EKYCPRO_API_KEY, doCheck: process.env.ZALO_CHECK_ENABLED !== 'false', cacheDays: 90 });");
const IX16_NEW = "    const zaloDefer48 = (t === 'cold' && CFG.ZALO_CHECK_COLD !== true); // LENH #48 (PB-3g): lead LẠNH không kiểm eKYC lúc quét (kiểm khi sales bắt đầu chăm)\n    const _zc = await enrichPhoneFromText((x.post.text || ''), { db, apiKey: process.env.EKYCPRO_API_KEY, doCheck: process.env.ZALO_CHECK_ENABLED !== 'false' && !zaloDefer48, cacheDays: 90 });";
const IX17 = A('index', 'IX17 lead fields', "      author_url: x.post.user_url || '', parent_author: x.post.parent_author || '', parent_text: x.post.parent_text || '',");
const IX17_NEW = IX17 + "\n      author_uid: String(x.post.author_uid || '').slice(0, 40), zalo_defer: !!(zaloDefer48 && _zc.phone), /* LENH #48 */";
const IX36 = A('index', 'IX36 not lead', "    if (!isLead) return;");
const IX36_NEW = "    if (!isLead) { await settle48(x); return; } // LENH #48: không phải lead → gỡ lease/doc chờ";
const IX18 = A('index', 'IX18 mapPool tail', "      detected_at: FieldValue.serverTimestamp()\n    });\n  });\n\n  /* ---- Pha 4: LƯU lead");
const IX18_NEW = "      detected_at: FieldValue.serverTimestamp()\n    });\n    await settle48(x); // LENH #48: ghi lead xong mới gỡ lease/doc chờ\n  } catch (e48) { pipeErrors48++; scoreErrors++; console.error('[pipe] bài lỗi ngoài LLM (giữ lease để lượt sau chấm lại):', (x.post && (x.post.url || x.post.post_id)) || '', (e48 && e48.message) || e48); try { recordPost(x, { decision: 'error' }); } catch (_) {} } }); // LENH #48 (PB-1d)\n\n  /* ---- Pha 4: LƯU lead";
const IX19 = A('index', 'IX19 zalo sweep', "      if (!_zp) continue;\n      const _zres = await checkZalo(_zp, { db, apiKey: process.env.EKYCPRO_API_KEY, cacheDays: 90 });");
const IX19_NEW = "      if (!_zp) continue;\n      { const _zd = _zdoc.data() || {}; if (_zd.zalo_defer && !_zd.first_care_at && !_zd.assignee && !_zd.last_touch_at) continue; } // LENH #48 (PB-3g): lead lạnh chưa ai chăm → chưa kiểm\n      const _zres = await checkZalo(_zp, { db, apiKey: process.env.EKYCPRO_API_KEY, cacheDays: 90 });";
const IX20 = A('index', 'IX20 sweeper gate', "  if (sow46 && CFG.RESCORE_FALLBACK !== false && process.env.RESCORE_FALLBACK !== 'false') {");
const IX20_NEW = "  if (sow46 && CFG.LLM_API_KEY && !cb48.open && !overSoft48() && CFG.RESCORE_FALLBACK !== false && process.env.RESCORE_FALLBACK !== 'false') { // LENH #48 (PB-5): không key / breaker mở / quá trần mềm → không chấm lại";
const IX21 = A('index', 'IX21 sweeper filter', "          .filter(c => !c.l.dropped && !c.l.lost && !c.l.closed_at && (Number(c.l.rescore_tries) || 0) < 8 && (__ms46(c.l.detected_at) || 0) >= cut46)");
const IX21_NEW = "          .filter(c => !c.l.dropped && !c.l.lost && !c.l.closed_at && (Number(c.l.rescore_tries) || 0) < 8 && (__ms46(c.l.detected_at) || 0) >= cut46\n            && (Number(c.l.rescore_lease) || 0) < Date.now() && !(/badreq|LLM 4(00|22)/.test(String(c.l.rescore_err || '')) && Date.now() - (Number(c.l.rescore_at) || 0) < 86400e3)) // LENH #48 (PB-5d/PB-4c): bỏ lead đang được lượt khác chấm + lead 400 <24 h";
const IX22 = A('index', 'IX22 sweeper stop', "          if (stop46) return;\n          const l = c.l;");
const IX22_NEW = "          if (stop46 || overSoft48()) return; try { await c.ref.set({ rescore_lease: Date.now() + 10 * 60e3 }, { merge: true }); } catch (_) {} // LENH #48 (PB-5d): lease 10′ chống 2 lượt chồng chấm đôi\n          const l = c.l;";
const IX23 = A('index', 'IX23 sweeper post46 text', "const post46 = { post_id: l.post_id || c.id, url: l.post_url || l.url || '', text: l.text || '', author: l.name || '',");
const IX23_NEW = "const post46 = { post_id: l.post_id || c.id, url: l.post_url || l.url || '', text: ((Number(l.group_count) || 0) >= 2 && Array.isArray(l.touches) && l.touches.length > 1) ? (l.touches.map(tt => String((tt && tt.text) || '')).filter(Boolean).join('\\n---\\n').slice(0, 1500) || (l.text || '')) : (l.text || ''), /* LENH #48 (PB-5c): lead gộp nhiều nhóm → chấm trên mọi lần chạm */ author: l.name || '',";
const IX24 = A('index', 'IX24 sweeper catch', "await c.ref.set({ rescore_tries: FieldValue.increment(1), rescore_err: String((e && e.message) || e).slice(0, 160), rescore_at: Date.now() }, { merge: true }).catch(() => {});");
const IX24_NEW = "await c.ref.set({ rescore_tries: FieldValue.increment(1), rescore_err: String((e && e.message) || e).slice(0, 160), rescore_at: Date.now(), rescore_lease: FieldValue.delete() }, { merge: true }).catch(() => {});";
const IX25 = A('index', 'IX25 sweeper up', "ai_scored: true, rescored_at: Date.now(), ai_prev:");
const IX25_NEW = "ai_scored: true, base_score: h, rescore_lease: FieldValue.delete(), rescored_at: Date.now(), ai_prev:";
const IX26 = A('index', 'IX26 sweeper reply', "          if (ai.industry) up.industry = ai.industry; if (ai.reply && String(ai.reply).trim()) up.reply = ai.reply;");
const IX26_NEW = IX26 + " if (isLead) up.ai_flag = FieldValue.delete(); // LENH #48";
const IX27 = A('index', 'IX27 sweeper human', "            if (human) up.rescore_note = 'AI chấm lại: không phải lead (' + (roleBlock ? 'vai ' + role : 'điểm ' + h) + ') – giữ vì sales đang chăm';");
const IX27_NEW = "            if (human) { up.rescore_note = 'AI chấm lại: không phải lead (' + (roleBlock ? 'vai ' + role : 'điểm ' + h) + ') – giữ vì sales đang chăm'; up.ai_flag = roleBlock ? ('role_' + role) : 'not_lead'; if (h < 40) up.temp = 'cold'; } // LENH #48 (PB-5c): không hạ junk lead đang chăm (web sẽ ẩn) — giữ ≥ lạnh + cờ ai_flag";
const IX28 = A('index', 'IX28 watch counters', "  const llmOk46 = Math.max(0, (Number(__hE.ok) || 0) - __h0.ok), llmFail46 = Math.max(0, (Number(__hE.fail) || 0) - __h0.fail), llmPreFail46 = Math.max(0, (Number(__hE.preFail) || 0) - __h0.pre);");
const IX28_NEW = IX28 + " const llmPreOk46 = Math.max(0, (Number(__hE.preOk) || 0) - __h0.preOk); // LENH #48";
const IX29_A = A('index', 'IX29 watch head', "  try {\n    const downNow46 = (llmFail46 >= 2 && llmOk46 === 0) || (/^(auth|quota|model)$/.test(llmErr46) && llmOk46 === 0);");
const IX29_B = A('index', 'IX29 watch tail', "  } catch (e) { console.warn('[LLM-WATCH] lỗi:', e && e.message); }");
const IX29_NEW = `  try {
    const stRef46 = db.collection('system_status').doc('llm'); const stS46 = await stRef46.get().catch(() => null); const prev46 = (stS46 && stS46.exists) ? (stS46.data() || {}) : {};
    /* LENH #48 (PB-4): cửa sổ trượt ≤5 lượt / 15′ (kích cả khi mỗi lượt chỉ 1 bài) + hysteresis (đang DOWN cần ≥2 OK) + tầng 1 [LLM-PRE-DOWN] (WARNING, vẫn fail-open) + badreq hệ thống + thiếu key */
    const now48 = Date.now();
    const win48 = (Array.isArray(prev46.win) ? prev46.win : []).filter(w => w && (now48 - (Number(w.at) || 0)) < 15 * 60e3).slice(-4);
    const touched48 = !!(llmOk46 || llmFail46 || llmPreOk46 || llmPreFail46);
    if (touched48) win48.push({ at: now48, ok: llmOk46, fail: llmFail46, preOk: llmPreOk46, preFail: llmPreFail46, kind: llmErr46 || '' });
    const sumW = k => win48.reduce((a, w) => a + (Number(w[k]) || 0), 0);
    const nokey48 = !CFG.LLM_API_KEY, badreqSys48 = badreq48 >= 2 && llmOk46 === 0;
    const kind48 = nokey48 ? 'nokey' : (badreqSys48 ? 'badreq' : (llmErr46 || String((win48.length ? win48[win48.length - 1] : {}).kind || '')));
    const downNow46 = nokey48 || badreqSys48 || (/^(auth|quota|model)$/.test(llmErr46) && llmOk46 === 0) || (sumW('fail') >= 2 && sumW('ok') === 0);
    const upNow48 = !nokey48 && !badreqSys48 && (prev46.ok === false ? sumW('ok') >= 2 : llmOk46 > 0);
    const preDown48 = !nokey48 && sumW('preFail') >= 3 && sumW('preOk') === 0, preUp48 = sumW('preOk') >= 1;
    const base48 = { win: win48, pre: preDown48 ? false : (preUp48 ? true : (prev46.pre === false ? false : true)), preKind: preDown48 ? String((scoreLead.health46 || {}).preLast || '').slice(0, 160) : '', model: CFG.LLM_MODEL || '', preModel: CFG.LLM_PREFILTER_MODEL || '', cbOpen: cb48.open, at: now48 };
    if (preDown48 && prev46.pre !== false) console.log(JSON.stringify({ severity: 'WARNING', message: '[LLM-PRE-DOWN] tầng 1 (' + (CFG.LLM_PREFILTER_MODEL || '') + ') lỗi ' + sumW('preFail') + ' bài/15′, 0 OK — đang cho MỌI bài lên model chấm sâu (fail-open, tốn hơn): ' + base48.preKind }));
    else if (!preDown48 && preUp48 && prev46.pre === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[LLM-PRE-UP] tầng 1 hoạt động lại' }));
    if (downNow46) {
      const runs46 = (prev46.ok === false ? Number(prev46.runs) || 0 : 0) + 1;
      await stRef46.set(Object.assign(base48, { ok: false, since: (prev46.ok === false && prev46.since) ? prev46.since : now48, runs: runs46, kind: kind48, sample: nokey48 ? 'Chưa cấu hình LLM_API_KEY — không chấm AI, không chấm lại điểm tạm' : llmErrMsg46, fails: llmFail46, deferred: llmDeferred, fallback: llmFallback }), { merge: true });
      if (prev46.ok !== false) console.log(JSON.stringify({ severity: 'ERROR', message: '[LLM-DOWN] OpenAI (' + (CFG.LLM_MODEL || '') + ') lỗi ' + kind48 + ' — ' + sumW('fail') + ' lượt chấm hỏng/15′, 0 thành công; ' + llmDeferred + ' bài xếp hàng chấm lại, ' + llmFallback + ' lead dự phòng · ' + (nokey48 ? 'thiếu LLM_API_KEY' : llmErrMsg46) }));
      else console.log('[LLM-DOWN] vẫn lỗi (' + runs46 + ' lượt): ' + kind48 + ' · ' + llmErrMsg46);
    } else if (upNow48 && (prev46.ok === false || !stS46 || !stS46.exists)) {
      await stRef46.set(Object.assign(base48, { ok: true, recoveredAt: now48, since: prev46.since || null, runs: prev46.runs || 0, kind: '', sample: '' }), { merge: true });
      if (prev46.ok === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[LLM-UP] OpenAI hoạt động lại — ' + sumW('ok') + ' lượt chấm OK trong cửa sổ' + (llmFail46 ? ' (' + llmFail46 + ' hỏng)' : '') }));
    } else if (touched48 || !!prev46.cbOpen !== cb48.open || (prev46.pre === false) !== (base48.pre === false)) { await stRef46.set(Object.assign({ ok: prev46.ok === false ? false : true }, base48), { merge: true }); } // LENH #48: lưu cửa sổ cả khi doc chưa có (không thì 2 lượt hỏng ×1 bài không bao giờ kích)
  } catch (e) { console.warn('[LLM-WATCH] lỗi:', e && e.message); }`;
const IX30 = A('index', 'IX30 summary', "    llmDeferred, llmFallback, llmRescored: rescored46, llmRescoredLeads: rescoredLeads46, llmOk: llmOk46, llmFail: llmFail46, llmErr: llmErr46, llmPreFail: llmPreFail46, /* LENH #46 */");
const IX30_NEW = IX30 + "\n    llmPreOk: llmPreOk46, pipeErrors: pipeErrors48, softStop: softStop48, seenRace: seenRace48, leased: leased48, cbOpen: cb48.open, badreq: badreq48, model: CFG.LLM_MODEL || '', tokensReasoning: reasonTok48, runId: runId48, status: 'done', /* LENH #48 */";
const IX31 = A('index', 'IX31 scan xong', "  console.log(`scan xong: ${scanned} bài → ${candTotal} ứng viên → ${matched} qua tầng 1 → giữ ${kept} lead (${hot} nóng), ${preCalls}+${scoreCalls} lượt AI, ${tokTotal} token, ~$${costUsd.toFixed(4)}`);");
const IX31_NEW = "  try { await db.collection('system_status').doc('scan').set({ phase: 'done', at: Date.now(), runId: runId48, trigger, lastRunAt: Date.now(), lastDurationMs: durationMs, lastLeads: kept, lastPosts: scanned, softStop: softStop48, pipeErrors: pipeErrors48, seenRace: seenRace48, leased: leased48 }, { merge: true }); } catch (_) {} // LENH #48 (PB-1e)\n" + IX31;
const IX32 = A('index', 'IX32 scheduledScan', "export const scheduledScan = onSchedule(\n  { schedule: `every ${CFG.POLL_MINUTES} minutes`, timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 1800, maxInstances: 1 },\n  async () => { await scanAll('scheduled'); }\n);");
const IX32_NEW = `/* LENH #48 (PB-1e): lượt quét ném lỗi → vẫn để lại dấu vết (scans status:'aborted' + system_status/scan + log ERROR → alert #9) thay vì im lặng */
async function abortLog48(trigger, e) {
  const msg = String((e && e.message) || e).slice(0, 300);
  try { await db.collection('scans').add({ at: FieldValue.serverTimestamp(), trigger, status: 'aborted', error: msg, sourcesCount: 0, postsFetched: 0, commentsFetched: 0, candidates: 0, postsMatched: 0, leadsCreated: 0, hotLeads: 0, durationMs: 0, scoreErrors: 0, scrapeErrors: 0, llmCalls: 0, costUsd: 0, dist: { hot: 0, warm: 0, cold: 0, junk: 0 }, bySource: [] }); } catch (_) {}
  try { await db.collection('system_status').doc('scan').set({ phase: 'aborted', at: Date.now(), trigger, lastError: msg, lastErrorAt: Date.now() }, { merge: true }); } catch (_) {}
  console.log(JSON.stringify({ severity: 'ERROR', message: '[SCAN-ABORTED] lượt ' + trigger + ' ném lỗi: ' + msg }));
}
export const scheduledScan = onSchedule(
  { schedule: \`every \${CFG.POLL_MINUTES} minutes\`, timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 1800, maxInstances: 1 },
  async () => { try { await scanAll('scheduled'); } catch (e) { await abortLog48('scheduled', e); throw e; } } // LENH #48
);`;
const IX33 = A('index', 'IX33 manual backfill', "    const sum = await scanAll('backfill', opts);");
const IX33_NEW = "    let sum; try { sum = await scanAll('backfill', opts); } catch (e) { await abortLog48('backfill', e); throw e; } // LENH #48";
const IX34 = A('index', 'IX34 manual', "  const sum = await scanAll('manual', { jobId, force: !!b.force });");
const IX34_NEW = "  let sum; try { sum = await scanAll('manual', { jobId, force: !!b.force }); } catch (e) { await abortLog48('manual', e); throw e; } // LENH #48";

if (process.argv[2] === '--anchors') { console.log(JSON.stringify(ANCH)); process.exit(0); }

const [FCF, FSC, FSR, FIX] = [process.argv[2] || 'lib/config.js', process.argv[3] || 'lib/scorer.js', process.argv[4] || 'lib/scraper.js', process.argv[5] || 'index.js'];
const src = { cf: fs.readFileSync(FCF, 'utf8'), sc: fs.readFileSync(FSC, 'utf8'), sr: fs.readFileSync(FSR, 'utf8'), ix: fs.readFileSync(FIX, 'utf8') };
const done = Object.keys(src).filter(k => src[k].includes('LENH #48'));
if (done.length === 4) { console.log('4 file: ĐÃ patch LENH #48 (idempotent) — bỏ qua'); process.exit(0); }
if (done.length) { console.error('LỆCH: ' + done.join(',') + ' đã có LENH #48 mà file khác chưa — khôi phục từ .bak rồi chạy lại'); process.exit(1); }
const need = (s, name, grp) => { for (const [k, a] of Object.entries(ANCH[grp])) { const n = s.split(a).length - 1; if (n !== 1) { console.error('KHONG THAY MOC ' + name + '/' + k + ' (đếm ' + n + '): ' + a.slice(0, 110).replace(/\n/g, '⏎')); process.exit(1); } } };
need(src.cf, 'lib/config.js', 'config'); need(src.sc, 'lib/scorer.js', 'scorer'); need(src.sr, 'lib/scraper.js', 'scraper'); need(src.ix, 'index.js', 'index');
const between = (s, name, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); if (i < 0 || j < 0 || s.indexOf(a, i + 1) >= 0 || s.indexOf(b, j + 1) >= 0) { console.error('KHONG THAY DOAN ' + name); process.exit(1); } return [i, j + b.length]; };
const rep = (s, a, b) => s.replace(a, () => b);
/* (1) config */
let cf = rep(src.cf, CF1, CF1_NEW);
/* (2) scorer — thay thân llmChat46 (between), rồi các mốc đơn */
let sc = src.sc; { const [i, j] = between(sc, 'scorer.js/llmChat46', SC2_A, SC2_B); sc = sc.slice(0, i) + SC2_NEW + sc.slice(j); }
sc = rep(sc, SC1, SC1_NEW); sc = rep(sc, SC3, SC3_NEW); sc = rep(sc, SC4, SC4_NEW); sc = rep(sc, SC5, SC5_NEW); sc = rep(sc, SC6, SC6_NEW); sc = rep(sc, SC7, SC7_NEW); sc = rep(sc, SC8, SC8_NEW); sc = rep(sc, SC9, SC9_NEW); sc = rep(sc, SC10, SC10_NEW); sc = rep(sc, SC11, SC11_NEW);
/* (3) scraper */
let sr = src.sr; sr = rep(sr, SR0, SR0_NEW); sr = rep(sr, SR1, SR1_NEW); sr = rep(sr, SR2, SR2_NEW);
/* (4) index — 2 đoạn between (miss-reply, watch) trước, rồi mốc đơn */
let ix = src.ix;
{ const [i, j] = between(ix, 'index.js/miss-reply', IX15_A, IX15_B); ix = ix.slice(0, i) + IX15_NEW + ix.slice(j); }
{ const [i, j] = between(ix, 'index.js/LLM-WATCH', IX29_A, IX29_B); ix = ix.slice(0, i) + IX29_NEW + ix.slice(j); }
for (const [a, b] of [[IX1, IX1_NEW], [IX2, IX2_NEW], [IX3, IX3_NEW], [IX4, IX4_NEW], [IX5, IX5_NEW], [IX6, IX6_NEW], [IX7, IX7_NEW], [IX8, IX8_NEW], [IX9, IX9_NEW], [IX10, IX10_NEW], [IX11, IX11_NEW], [IX12, IX12_NEW], [IX13, IX13_NEW], [IX14, IX14_NEW], [IX16, IX16_NEW], [IX17, IX17_NEW], [IX18, IX18_NEW], [IX19, IX19_NEW], [IX20, IX20_NEW], [IX21, IX21_NEW], [IX22, IX22_NEW], [IX23, IX23_NEW], [IX24, IX24_NEW], [IX25, IX25_NEW], [IX26, IX26_NEW], [IX27, IX27_NEW], [IX28, IX28_NEW], [IX30, IX30_NEW], [IX31, IX31_NEW], [IX32, IX32_NEW], [IX33, IX33_NEW], [IX34, IX34_NEW], [IX35, IX35_NEW], [IX36, IX36_NEW]]) ix = rep(ix, a, b);
/* kiểm sau khi ghép: mỗi mốc mới phải xuất hiện, không mốc cũ nào còn lại trùng */
const must = [[cf, 'config', 'LLM_POST_BUDGET_MS'], [sc, 'scorer', 'replyOnly48'], [sc, 'scorer', 'brandKw48'], [sr, 'scraper', 'authorUidOf48'], [ix, 'index', 'lease48'], [ix, 'index', 'abortLog48'], [ix, 'index', 'win48'], [ix, 'index', 'unlease48'], [ix, 'index', 'settle48']];
for (const [s, n, t] of must) if (!s.includes(t)) { console.error('GHÉP LỖI ' + n + ': thiếu ' + t); process.exit(1); }
/* ghi 2 pha: mọi mốc 4 file đã khớp mới ghi đĩa */
fs.writeFileSync(FCF, cf); fs.writeFileSync(FSC, sc); fs.writeFileSync(FSR, sr); fs.writeFileSync(FIX, ix);
console.log('PATCH OK 4 file (LENH #48): lib/config.js 7 tham số · lib/scorer.js llmChat46 reasoning/budget + heuristic theo brand + nokey kẹp + replyOnly48 · lib/scraper.js profile_id/commentator_profile_url → author_url/author_uid · index.js lease/seen create/transaction/trần mềm/bọc lỗi/breaker/badreq/cửa sổ 15′/sweeper an toàn/eKYC lạnh/aborted');
