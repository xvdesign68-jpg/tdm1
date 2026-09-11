/* LỆNH #46 (11/09/2026) — LEAD "ĐIỂM TẠM – AI CHƯA CHẤM" (ai_scored:false) VÁ TRIỆT ĐỂ. Theo LỆNH #45 (11/09 15:xx VN):
   gốc hôm nay = OpenAI trả HTTP 500 server_error từng đợt trên gpt-5.6-sol khi gọi song song (burst 3 → 2/3 lỗi trong 1,7 s) + scoreLead chỉ thử lại 1 lần sau 1,5 s
   → rơi về heuristic từ khoá → "Thuê mb chỉ 5 triệu" = 90 điểm NÓNG, không reply, push/Hộp việc/automation đều ăn theo; scans.scoreErrors vẫn 0 (im lặng).
   Phụ: prefilter 400 "Invalid body: failed to parse JSON value" = slice() cắt đôi emoji → surrogate lẻ trong JSON body.
   4 file, marker LENH #46, content-anchored, FAIL-CLOSED NGUYÊN TỬ (đủ mốc CẢ 4 file mới ghi), idempotent. Dùng: node _l46_patch.cjs lib/scorer.js index.js outreach.js push.js
   (1) lib/scorer.js  llmChat46: sanitize surrogate lẻ/ký tự điều khiển · AbortController 60 s · thử lại 4 lần giãn 2/5/12 s (+jitter, tôn trọng Retry-After ≤30 s) cho 429/5xx/mạng/JSON hỏng
                      · KHÔNG thử lại auth/quota/model/400 · API từ chối response_format → gửi lại không json mode · lỗi mang e.kind · bộ đếm scoreLead.health46.
                      scoreLead: LLM hỏng → NÉM LỖI (không heuristic); scoreLead(…,{heuristicOnly:true}) = heuristic KẸP ≤ 59 (lạnh) cho bài chờ quá hạn. prefilter: 2 lần, fail-open.
   (2) index.js       LLM hỏng → bài vào score_retry/{R_<post_id>} (3′→10′→30′→1h→3h→6h, tối đa 6 lần/24 h) · đầu Pha 3b lượt quét theo lịch nạp ≤30 bài tới hạn chấm lại
                      · quá hạn → lead dự phòng kẹp ≤59 + ai_scored:false · sweeper cuối lượt: lead ai_scored:false (≤30 ngày, ≤8 lần) AI chấm lại ≤12/lượt (ghi đè điểm/reply, not-lead → dropped, sales đang chăm → giữ)
                      · giám sát: lượt ≥2 lỗi & 0 OK (hoặc auth/quota/model) → console ERROR [LLM-DOWN] (alert LỆNH #9) + system_status/llm; hồi → [LLM-UP] · scans thêm llmDeferred/llmFallback/llmRescored/llmOk/llmFail/llmErr/llmPreFail
                      · miss-reply: không gọi lại khi đang dùng dự phòng; 2 lượt gọi lại chỉ thử 2 lần.
   (3) outreach.js    engine (AdsPower + func) KHÔNG bốc lead ai_scored:false.   (4) push.js  không push "Lead nóng mới" khi ai_scored:false; push khi AI chấm lại thành nóng. */
const fs = require('fs');
const [FSC, FIX, FOA, FPU] = [process.argv[2] || 'lib/scorer.js', process.argv[3] || 'index.js', process.argv[4] || 'outreach.js', process.argv[5] || 'push.js'];
const src = { sc: fs.readFileSync(FSC, 'utf8'), ix: fs.readFileSync(FIX, 'utf8'), oa: fs.readFileSync(FOA, 'utf8'), pu: fs.readFileSync(FPU, 'utf8') };
const done = Object.keys(src).filter(k => src[k].includes('LENH #46'));
if (done.length === 4) { console.log('4 file: ĐÃ patch LENH #46 (idempotent) — bỏ qua'); process.exit(0); }
if (done.length) { console.error('LỆCH: ' + done.join(',') + ' đã có LENH #46 mà file khác chưa — khôi phục từ .bak rồi chạy lại'); process.exit(1); }
const need = (s, name, list) => { for (const [k, a] of list) { const n = s.split(a).length - 1; if (n !== 1) { console.error('KHONG THAY MOC ' + name + '/' + k + ' (đếm ' + n + '): ' + a.slice(0, 100).replace(/\n/g, '⏎')); process.exit(1); } } };
const between = (s, name, k, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); if (i < 0 || j < 0 || s.indexOf(a, i + 1) >= 0 || s.indexOf(b, j + 1) >= 0) { console.error('KHONG THAY DOAN ' + name + '/' + k); process.exit(1); } return [i, j + b.length]; };

/* ================= (1) lib/scorer.js ================= */
const SC_PRE_A = "export async function prefilterLead(post, brandAi) { /* v-brandai */";
const SC_PRE_B = "    log.warn('prefilter lỗi, cho qua tầng 2:', e.message);\n    return { maybe: true, _usage: { prompt: 0, completion: 0, total: 0 }, _llm: false };\n  }\n}";
const SC_SCORE_A = "export async function scoreLead(post, source, weights, brandAi) { /* v-brandai */";
const SC_SCORE_B = "    log.warn('LLM lỗi, dùng heuristic:', e.message);\n    return heuristic(post.text, source);\n  }\n}";
const SC_HEUR = "function heuristic(text, source) {";
need(src.sc, 'scorer.js', [['pre-A', SC_PRE_A], ['pre-B', SC_PRE_B], ['score-A', SC_SCORE_A], ['score-B', SC_SCORE_B], ['heuristic', SC_HEUR]]);
const [p0, p1] = between(src.sc, 'scorer.js', 'prefilter', SC_PRE_A, SC_PRE_B);
const [q0, q1] = between(src.sc, 'scorer.js', 'scoreLead', SC_SCORE_A, SC_SCORE_B);
if (!(p1 <= q0)) { console.error('scorer.js: thứ tự prefilter/scoreLead lạ'); process.exit(1); }
// giữ nguyên phần thân prompt (SYS + user message) của scoreLead cũ → lấy ra từ đoạn cũ để không lệch prompt
const oldScore = src.sc.slice(q0, q1);
const mUser = oldScore.match(/\{ role: 'user', content: (`[\s\S]*?`) \}\n\s*\]/);
if (!mUser) { console.error('scorer.js: không tách được user prompt của scoreLead'); process.exit(1); }
const USER_TPL = mUser[1];
const oldPre = src.sc.slice(p0, p1);
const mPreUser = oldPre.match(/\{ role: 'user', content: (buildPostContent\(post, \d+\)) \}/);
if (!mPreUser) { console.error('scorer.js: không tách được user prompt của prefilter'); process.exit(1); }

const SC_HELPERS = `/* ===== LENH #46 (11/09/2026) — gọi LLM BỀN: sanitize surrogate lẻ (emoji bị slice cắt đôi → OpenAI 400 "Invalid body") · timeout 60 s ·
   thử lại 4 lần giãn 2/5/12 s (+jitter, tôn trọng Retry-After ≤ 30 s) cho 429/5xx/mạng/JSON hỏng · KHÔNG thử lại auth/quota/model/400 ·
   API từ chối response_format → gửi lại không json mode · lỗi mang e.kind (auth|quota|rate|model|badreq|server|net|format) · bộ đếm scoreLead.health46 (index.js giám sát [LLM-DOWN]).
   Vì sao: LỆNH #45 đo OpenAI trả 500 server_error từng đợt trên gpt-5.6-sol (burst 3 → 2/3 lỗi trong 1,7 s); retry 1 lần/1,5 s cũ không đủ → heuristic → lead rác 90 điểm NÓNG. */
const LLM46 = { tries: Math.max(1, Number(process.env.LLM_TRIES) || 4), waits: [2000, 5000, 12000], timeoutMs: Math.max(5000, Number(process.env.LLM_TIMEOUT_MS) || 60000), maxWaitMs: 30000 };
const RETRY46 = { rate: 1, server: 1, net: 1, http: 1, format: 1 };
const llmHealth46 = { ok: 0, fail: 0, attempts: 0, attemptsFail: 0, last: '', lastKind: '', lastAt: 0, lastOkAt: 0, preOk: 0, preFail: 0, preLast: '' };
function sanitize46(s) {
  return String(s == null ? '' : s)
    .replace(/[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\uD800-\\uDFFF]/g, m => m.length === 2 ? m : '')   // giữ cặp surrogate hợp lệ, bỏ surrogate lẻ
    .replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g, '');                           // ký tự điều khiển (giữ \\n \\t)
}
function kindOf46(status, code, type, msg) {
  const s = Number(status) || 0, all = String(code || '') + ' ' + String(type || '') + ' ' + String(msg || '');
  if (/insufficient_quota|credit_balance|billing_not_active|exceeded your current quota/i.test(all)) return 'quota';
  if (s === 401 || s === 403 || /invalid_api_key|incorrect api key|authentication/i.test(all)) return 'auth';
  if (s === 429) return 'rate';
  if (s === 404 || /model_not_found|does not exist|no such model/i.test(all)) return 'model';
  if (s === 400 || s === 422) return 'badreq';
  if (s >= 500) return 'server';
  return s ? 'http' : 'net';
}
function mkErr46(kind, status, msg) { const e = new Error(msg); e.kind = kind; e.status = status; e.retryable = !!RETRY46[kind]; return e; }
function parseJson46(content) {
  const c = String(content || '').trim(); if (!c) return null;
  const tryP = t => { try { const o = JSON.parse(t); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; } catch (_) { return null; } };
  let o = tryP(c); if (o) return o;
  const f = c.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\`/i); if (f) { o = tryP(f[1].trim()); if (o) return o; }
  const g = c.match(/\\{[\\s\\S]*\\}/); if (g) { o = tryP(g[0]); if (o) return o; }
  return null;
}
async function llmChat46(body, o) {
  o = o || {}; const tries = Math.max(1, o.tries || LLM46.tries); const base = String(CFG.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\\/+$/, '');
  const msgs = (body.messages || []).map(m => Object.assign({}, m, { content: sanitize46(m.content) }));
  let noJson = false, lastErr = null;
  for (let i = 0; i < tries; i++) {
    llmHealth46.attempts++;
    const req = Object.assign({}, body, { messages: msgs }); if (noJson) delete req.response_format;
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), LLM46.timeoutMs);
    let r = null, txt = '', err = null;
    try { r = await fetch(base + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + CFG.LLM_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: ctl.signal }); txt = await r.text(); }
    catch (e) { err = mkErr46('net', 0, 'LLM mạng/timeout: ' + ((e && e.name === 'AbortError') ? ('quá ' + LLM46.timeoutMs + ' ms') : String((e && e.message) || e)).slice(0, 160)); }
    finally { clearTimeout(tm); }
    if (!err) {
      let j = null; try { j = JSON.parse(txt); } catch (_) { j = null; }
      if (!r.ok) {
        const eo = (j && j.error) || {}; const kind = kindOf46(r.status, eo.code, eo.type, eo.message || txt);
        if (kind === 'badreq' && !noJson && req.response_format && /response_format|json_object|json mode/i.test(String(eo.message || txt))) { noJson = true; llmHealth46.attemptsFail++; continue; }
        err = mkErr46(kind, r.status, 'LLM ' + r.status + (eo.code ? ' ' + eo.code : '') + (eo.type ? ' [' + eo.type + ']' : '') + ': ' + String(eo.message || txt).slice(0, 200));
        err.retryAfter = Number(r.headers && r.headers.get && r.headers.get('retry-after')) || 0;
      } else {
        const ch = (j && j.choices && j.choices[0]) || {}; const content = (ch.message && ch.message.content) || '';
        const obj = parseJson46(content);
        if (!obj) err = mkErr46('format', 200, 'LLM 200 nhưng không đọc được JSON (finish=' + (ch.finish_reason || '?') + ', ' + content.length + ' ký tự): ' + content.slice(0, 120));
        else return { obj, usage: j.usage || {}, model: j.model || body.model || '', finish: ch.finish_reason || '' };
      }
    }
    lastErr = err; llmHealth46.attemptsFail++;
    if (!RETRY46[err.kind] || i === tries - 1) break;
    let w = LLM46.waits[Math.min(i, LLM46.waits.length - 1)]; if (err.retryAfter) w = Math.max(w, err.retryAfter * 1000); w = Math.min(w, LLM46.maxWaitMs) + Math.floor(Math.random() * 500);
    await new Promise(res => setTimeout(res, w));
  }
  throw lastErr || mkErr46('net', 0, 'LLM: không rõ lỗi');
}
const usage46 = u => { u = u || {}; const pt = Number(u.prompt_tokens) || 0, ct = Number(u.completion_tokens) || 0; return { prompt: pt, completion: ct, total: Number(u.total_tokens) || (pt + ct) }; };
/* bài chờ AI quá hạn (score_retry hết 6 lần/24 h) → lead DỰ PHÒNG kẹp ≤ 59 (lạnh), ai_scored:false, intent nói rõ; sweeper chấm lại sau */
function heuristicCapped46(post, source) {
  const h = heuristic((post && post.text) || '', source || {});
  h.hotness = Math.min(59, h.hotness); h.is_real_lead = h.hotness >= 40;
  h.intent = 'Điểm tạm – AI chưa chấm được lúc quét (bộ lọc từ khoá dự phòng); hệ thống sẽ tự chấm lại bằng AI'; h.need = ''; h._fallback = true;
  return h;
}
`;

const SC_PRE_NEW = `export async function prefilterLead(post, brandAi) { /* v-brandai · LENH #46: llmChat46 (2 lần, fail-open) */
  if (!CFG.LLM_API_KEY) return { maybe: true, _usage: { prompt: 0, completion: 0, total: 0 }, _llm: false };
  try {
    const r = await llmChat46({ model: CFG.LLM_PREFILTER_MODEL, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: PRE_SYS + brandAiCtx(brandAi) },
      { role: 'user', content: ${mPreUser[1]} }
    ] }, { tries: 2 });
    llmHealth46.preOk++;
    return { maybe: !!r.obj.maybe, _llm: true, _usage: usage46(r.usage) };
  } catch (e) {
    llmHealth46.preFail++; llmHealth46.preLast = String((e && e.message) || e).slice(0, 200);
    log.warn('prefilter lỗi (' + ((e && e.kind) || '?') + '), cho qua tầng 2:', (e && e.message) || e);
    return { maybe: true, _usage: { prompt: 0, completion: 0, total: 0 }, _llm: false, _err: (e && e.kind) || 'unknown' };
  }
}`;

const SC_SCORE_NEW = `export async function scoreLead(post, source, weights, brandAi, opts) { /* v-brandai · LENH #46: LLM hỏng → NÉM LỖI (index.js xếp hàng chấm lại), không còn heuristic ngầm */
  opts = opts || {};
  if (!CFG.LLM_API_KEY) return heuristic(post.text, source);          // không cấu hình LLM → heuristic như trước (cố ý)
  if (opts.heuristicOnly) return heuristicCapped46(post, source);     // bài chờ AI quá hạn → dự phòng kẹp ≤ 59
  try {
    const r = await llmChat46({ model: CFG.LLM_MODEL, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: SYS + brandAiCtx(brandAi) },
      { role: 'user', content: ${USER_TPL} }
    ] }, { tries: opts.tries || LLM46.tries });
    const obj = r.obj;
    // Bền vững nếu model trả hotness dạng chữ ('low'/'high'…) thay vì số
    const HMAP = { low:30, medium:60, high:85, hot:90, warm:65, cold:35, none:0 };
    let h = obj.hotness;
    if (typeof h === 'string') { const k=h.toLowerCase().trim(); h = (k in HMAP) ? HMAP[k] : Number(h); }
    obj.hotness = Math.max(0, Math.min(100, Number(h) || 0));
    if (!obj.industry) obj.industry = source.industry || '';
    obj.role = normRole(obj.role); obj.role_reason = String(obj.role_reason || '').slice(0, 200); /* v-selfcmt */
    obj._llm = true; obj._usage = usage46(r.usage); obj._model = r.model || '';
    llmHealth46.ok++; llmHealth46.lastOkAt = Date.now();
    return obj;
  } catch (e) {
    llmHealth46.fail++; llmHealth46.last = String((e && e.message) || e).slice(0, 200); llmHealth46.lastKind = (e && e.kind) || 'unknown'; llmHealth46.lastAt = Date.now();
    log.warn('LLM lỗi (' + ((e && e.kind) || '?') + ') — KHÔNG dùng heuristic, bài sẽ xếp hàng chấm lại:', (e && e.message) || e);
    throw e;
  }
}
scoreLead.health46 = llmHealth46; scoreLead.heuristic46 = heuristicCapped46; scoreLead.llmChat46 = llmChat46; scoreLead.sanitize46 = sanitize46; scoreLead.parseJson46 = parseJson46; scoreLead.cfg46 = LLM46; /* LENH #46 */`;

let sc = src.sc;
sc = sc.slice(0, q0) + SC_SCORE_NEW + sc.slice(q1);            // thay scoreLead trước (nằm sau) để chỉ số prefilter còn đúng
sc = sc.slice(0, p0) + SC_PRE_NEW + sc.slice(p1);              // thay prefilterLead
sc = sc.replace(SC_HEUR, () => SC_HELPERS + SC_HEUR);          // helper LENH #46 đặt ngay trước heuristic (heuristicCapped46 gọi heuristic — hoisting OK)
// prefilter đứng TRƯỚC heuristic → llmChat46/usage46 là const trong helper đặt sau prefilter: gọi lúc runtime (sau khi module nạp) → OK về TDZ

/* ================= (2) index.js ================= */
const IX1 = "  let skippedSeen = 0, scoreErrors = 0, scrapeErrors = 0;";
const IX2 = "  await mapPool(toScore, CFG.SCORE_CONCURRENCY || 6, async (x) => {\n    let ai; try { ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc)); }\n    catch { scoreErrors++; scored++; recordPost(x, { decision: 'error' }); await flushPosts(); await prog('scoring'); return; }";
const IX3 = "    const u = ai._usage || {}; if (ai._llm) scoreCalls++;";
const IX4 = "    if (!(ai.reply && String(ai.reply).trim())) {\n      for (let __rt = 0; __rt < 2; __rt++) {";
const IX5 = "          const __ai2 = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc));";
const IX6 = "  const durationMs = Date.now() - t0;";
const IX7 = "  const llmCalls = scoreCalls + preCalls;";
const IX8 = "    skippedSeen, backfillSkipped, commentsRefreshSkipped, scoreErrors, scrapeErrors, llmCalls, prefilterCalls: preCalls, scoreCalls,";
const IX9 = "  const isBackfill = !!(opts.startDate || opts.endDate);";
need(src.ix, 'index.js', [['IX1 counters', IX1], ['IX2 mapPool+catch', IX2], ['IX3 usage', IX3], ['IX4 miss-reply', IX4], ['IX5 miss-reply call', IX5], ['IX6 durationMs', IX6], ['IX7 llmCalls', IX7], ['IX8 summary', IX8], ['IX9 isBackfill', IX9]]);

const IX_DEFER = `  /* ===== LENH #46 (11/09/2026): LLM hỏng → KHÔNG tạo lead bằng heuristic. Bài vào score_retry/{R_<post_id>} rồi lượt quét theo lịch chấm lại
     (3′ → 10′ → 30′ → 1 h → 3 h → 6 h, tối đa 6 lần/24 h); quá hạn → lead dự phòng KẸP ≤ 59 (lạnh) + ai_scored:false (sweeper cuối lượt chấm lại khi AI khoẻ). ===== */
  const sow46 = !isBackfill && !opts.sourceUrl && !force;
  const RETRY_WAIT46 = [3, 10, 30, 60, 180, 360]; // phút
  const slimPost46 = p => { const o = {}; for (const k of Object.keys(p || {})) { const v = p[k]; if (k.charAt(0) === '_') continue; if (typeof v === 'string') o[k] = v.slice(0, k === 'text' ? 4000 : 1500); else if (typeof v === 'number' || typeof v === 'boolean') o[k] = v; } return o; };
  async function deferPost46(x, e) {
    const kind = (e && e.kind) || 'unknown', msg = String((e && e.message) || e).slice(0, 200);
    const key = String((x.post && x.post.post_id) || '').replace(/[^\\w-]/g, '_').slice(0, 470);
    if (!key || kind === 'badreq') { if (x.deferredRef) { await x.deferredRef.delete().catch(() => {}); x.deferredRef = null; } return 'fallback'; } // không định danh được / request hỏng cho riêng bài này → dự phòng ngay
    const prev = x.deferredDoc || null; const tries = (prev ? Number(prev.tries) || 0 : 0) + 1; const firstAt = (prev && Number(prev.firstAt)) || Date.now();
    if (tries > RETRY_WAIT46.length || Date.now() - firstAt > 24 * 3600e3) { if (x.deferredRef) { await x.deferredRef.delete().catch(() => {}); x.deferredRef = null; } return 'fallback'; }
    const ref = db.collection('score_retry').doc('R_' + key);
    try {
      await ref.set({ post: slimPost46(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || '') }, tries, firstAt, nextAt: Date.now() + RETRY_WAIT46[tries - 1] * 60000, lastErr: msg, kind, updatedAt: FieldValue.serverTimestamp() });
      x.deferredRef = null; return 'deferred';
    } catch (e2) { console.error('[LLM-RETRY] ghi score_retry lỗi:', e2 && e2.message); return 'error'; }
  }
  if (sow46) {
    try {
      const rq = await db.collection('score_retry').where('nextAt', '<=', Date.now()).orderBy('nextAt').limit(30).get();
      let n46 = 0;
      for (const d of rq.docs) {
        const r = d.data() || {}; const src = sources.find(s => s.url === (r.src && r.src.url)) || null;
        if (!src || !r.post || !r.post.post_id) { await d.ref.delete().catch(() => {}); continue; } // nguồn đã xoá/tắt → bỏ
        const effSrc = { ...src, keywords: [...(src.keywords || []), ...gKw], exclude: [...(src.exclude || []), ...gEx] };
        let row = bySource.find(b => b.url === src.url); if (!row) { row = { name: src.name || '', industry: src.industry || '', url: src.url || '', posts: 0, matched: 0, leads: 0, hot: 0, error: null, bdPosts: 0, bdComments: 0, ekyc: 0 }; bySource.push(row); }
        toScore.push({ post: r.post, effSrc, src, row, deferredRef: d.ref, deferredDoc: r }); n46++;
      }
      if (n46) console.log('[LLM-RETRY] nạp ' + n46 + ' bài chờ AI chấm lại (score_retry tới hạn)');
    } catch (e) { console.warn('[LLM-RETRY] nạp score_retry lỗi:', e && e.message); }
  }
`;
let ix = src.ix;
ix = ix.replace(IX1, () => IX1 + "\n  let llmDeferred = 0, llmFallback = 0, rescored46 = 0; const __h0 = { ok: Number((scoreLead.health46 || {}).ok) || 0, fail: Number((scoreLead.health46 || {}).fail) || 0, pre: Number((scoreLead.health46 || {}).preFail) || 0 }; // LENH #46");
ix = ix.replace(IX2, () => IX_DEFER + "  await mapPool(toScore, CFG.SCORE_CONCURRENCY || 6, async (x) => {\n    let ai; try { ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc)); }\n" +
  "    catch (e46) { // LENH #46: hỏng → xếp hàng chấm lại (không lead) · quá hạn/request hỏng → dự phòng kẹp ≤ 59 · ghi score_retry lỗi → 'error' như cũ\n" +
  "      const r46 = await deferPost46(x, e46);\n" +
  "      if (r46 === 'fallback') { ai = scoreLead.heuristic46(x.post, x.effSrc); llmFallback++; }\n" +
  "      else { scored++; if (r46 === 'error') scoreErrors++; else llmDeferred++; recordPost(x, { decision: r46 === 'error' ? 'error' : 'ai_wait' }); await flushPosts(); await prog('scoring'); return; }\n" +
  "    }");
ix = ix.replace(IX3, () => IX3 + "\n    if (x.deferredRef) { rescored46++; await x.deferredRef.delete().catch(() => {}); x.deferredRef = null; } // LENH #46: bài chờ đã được AI chấm → xoá hàng chờ");
ix = ix.replace(IX4, () => "    if (ai._llm !== false && !(ai.reply && String(ai.reply).trim())) { // LENH #46: đang dùng dự phòng thì không gọi lại\n      for (let __rt = 0; __rt < 2; __rt++) {");
ix = ix.replace(IX5, () => "          const __ai2 = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc), { tries: 2 }); // LENH #46");

const IX_SWEEP = `  /* ===== LENH #46: CHẤM LẠI lead "Điểm tạm" (ai_scored:false) bằng AI khi LLM đang khoẻ — ≤ 12 lead/lượt (pool 3), mới nhất trước, ≤ 30 ngày, ≤ 8 lần thử/lead.
     Ghi đè score/temp/intent/need/service/reply/role + ai_scored:true + rescored_at + ai_prev; AI nói KHÔNG phải lead → dropped (rescore / rescore_role); sales đang chăm → chỉ cập nhật điểm, không loại.
     Chỉ lượt quét theo lịch (không backfill/không quét riêng nguồn/không force). Tắt: RESCORE_FALLBACK=false (.env). ===== */
  let rescoredLeads46 = 0, rescoreDropped46 = 0;
  const __ms46 = v => !v ? 0 : (typeof v === 'number' ? v : (typeof v.toMillis === 'function' ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
  if (sow46 && CFG.RESCORE_FALLBACK !== false && process.env.RESCORE_FALLBACK !== 'false') {
    const __hn = scoreLead.health46 || {}; const okNow = (Number(__hn.ok) || 0) - __h0.ok, failNow = (Number(__hn.fail) || 0) - __h0.fail;
    if (okNow > 0 || failNow === 0) {
      try {
        const rs = await db.collection('leads').where('ai_scored', '==', false).limit(80).get();
        const cut46 = Date.now() - 30 * 86400e3;
        const cand46 = rs.docs.map(d => ({ id: d.id, ref: d.ref, l: d.data() || {} }))
          .filter(c => !c.l.dropped && !c.l.lost && !c.l.closed_at && (Number(c.l.rescore_tries) || 0) < 8 && (__ms46(c.l.detected_at) || 0) >= cut46)
          .sort((a, b) => (__ms46(b.l.detected_at) || 0) - (__ms46(a.l.detected_at) || 0)).slice(0, Math.max(1, Number(process.env.RESCORE_PER_RUN) || 12));
        const brandAiCache46 = {}; let stop46 = false;
        const brandAiOf46 = async code => { if (!code) return null; if (!(code in brandAiCache46)) { try { const s = await db.collection('brands').doc(String(code)).get(); brandAiCache46[code] = (s.exists && s.data().ai) || null; } catch (_) { brandAiCache46[code] = null; } } return brandAiCache46[code]; };
        await mapPool(cand46, 3, async (c) => {
          if (stop46) return;
          const l = c.l; const src46 = sources.find(s => s.name === l.source) || { name: l.source || '', industry: l.industry || '' };
          const post46 = { post_id: l.post_id || c.id, url: l.post_url || l.url || '', text: l.text || '', author: l.name || '', time: l.time || '', source: l.source || '', kind: l.kind || 'post', comment_id: l.comment_id || '', comment_url: l.comment_url || '', parent_url: l.parent_url || '', parent_author: l.parent_author || '', parent_text: l.parent_text || '', parent_user_url: l.parent_user_url || '', user_url: l.author_url || l.user_url || '', self_comment: !!l.self_comment };
          let ai;
          try { ai = await scoreLead(post46, src46, config.weights, await brandAiOf46(l.brand), { tries: 2 }); }
          catch (e) { const k = (e && e.kind) || ''; await c.ref.set({ rescore_tries: FieldValue.increment(1), rescore_err: String((e && e.message) || e).slice(0, 160), rescore_at: Date.now() }, { merge: true }).catch(() => {}); if (/^(auth|quota|model|server|net|rate)$/.test(k)) stop46 = true; return; }
          const u = ai._usage || {}; if (ai._llm) scoreCalls++; mainIn += u.prompt || 0; mainOut += u.completion || 0;
          const h = Math.max(0, Math.min(100, Number(ai.hotness) || 0)), t = tempOf(h);
          const role = String(ai.role || '').toLowerCase().trim(), roleBlock = (role === 'seller' || role === 'poster_self');
          const isLead = !!ai.is_real_lead && !roleBlock && h >= CFG.MIN_KEEP_SCORE;
          const human = !!(__ms46(l.first_care_at) || __ms46(l.last_touch_at) || (l.stage && l.stage !== 'new') || l.assignee);
          const up = { score: h, temp: t, intent: ai.intent || '', need: ai.need || ai.intent || '', service: ai.service || '', role, role_reason: String(ai.role_reason || '').slice(0, 160), ai_scored: true, rescored_at: Date.now(), ai_prev: { score: Number(l.score) || 0, temp: l.temp || '', intent: String(l.intent || '').slice(0, 120) }, rescore_err: FieldValue.delete() };
          if (ai.industry) up.industry = ai.industry; if (ai.reply && String(ai.reply).trim()) up.reply = ai.reply;
          if (!isLead) {
            if (human) up.rescore_note = 'AI chấm lại: không phải lead (' + (roleBlock ? 'vai ' + role : 'điểm ' + h) + ') – giữ vì sales đang chăm';
            else { up.dropped = true; up.dropped_by = roleBlock ? 'rescore_role' : 'rescore'; up.dropped_at = Date.now(); up.dropped_reason = roleBlock ? ('AI chấm lại: ' + (role === 'seller' ? 'người bán/đối thủ' : 'chính chủ bài')) : ('AI chấm lại: không phải khách có nhu cầu (điểm ' + h + ')'); rescoreDropped46++; }
          }
          await c.ref.set(up, { merge: true }); rescoredLeads46++;
          try { await db.collection('leads').doc(c.id).collection('notes').add({ leadId: c.id, brand: l.brand || '', vis: 'team', text: 'AI đã chấm lại lead này: ' + (Number(l.score) || 0) + ' → ' + h + ' điểm (' + t + ')' + (up.dropped ? ' · ' + up.dropped_reason : (up.rescore_note ? ' · ' + up.rescore_note : '')) + '. Trước đó là điểm tạm vì AI gián đoạn lúc quét.', by_uid: 'engine', by_name: 'Chấm điểm AI (tự động)', at: Date.now() }); } catch (_) { }
        });
        if (cand46.length) console.log('[LLM-RESCORE] chấm lại ' + rescoredLeads46 + '/' + cand46.length + ' lead điểm tạm' + (rescoreDropped46 ? ' · loại ' + rescoreDropped46 : '') + (stop46 ? ' · DỪNG sớm vì LLM lỗi' : ''));
      } catch (e) { console.warn('[LLM-RESCORE] lỗi:', e && e.message); }
    }
  }
`;
ix = ix.replace(IX6, () => IX_SWEEP + IX6);

const IX_WATCH = `  /* ===== LENH #46: GIÁM SÁT LLM — lượt này ≥ 2 lượt chấm hỏng & 0 thành công (hoặc lỗi auth/quota/model) → console ERROR [LLM-DOWN] (alert LỆNH #9) + system_status/llm {ok:false,…};
     có lượt OK sau khi đang down → [LLM-UP] + ok:true. FE (v119-89) đọc system_status/llm → Cảnh báo hệ thống + thẻ + chip thanh nhịp quét. ===== */
  const __hE = scoreLead.health46 || {};
  const llmOk46 = Math.max(0, (Number(__hE.ok) || 0) - __h0.ok), llmFail46 = Math.max(0, (Number(__hE.fail) || 0) - __h0.fail), llmPreFail46 = Math.max(0, (Number(__hE.preFail) || 0) - __h0.pre);
  const llmErr46 = llmFail46 ? String(__hE.lastKind || '') : '', llmErrMsg46 = llmFail46 ? String(__hE.last || '').slice(0, 200) : '';
  try {
    const downNow46 = (llmFail46 >= 2 && llmOk46 === 0) || (/^(auth|quota|model)$/.test(llmErr46) && llmOk46 === 0);
    const stRef46 = db.collection('system_status').doc('llm'); const stS46 = await stRef46.get().catch(() => null); const prev46 = (stS46 && stS46.exists) ? (stS46.data() || {}) : {};
    if (downNow46) {
      const runs46 = (prev46.ok === false ? Number(prev46.runs) || 0 : 0) + 1;
      await stRef46.set({ ok: false, since: (prev46.ok === false && prev46.since) ? prev46.since : Date.now(), at: Date.now(), runs: runs46, kind: llmErr46, sample: llmErrMsg46, model: CFG.LLM_MODEL || '', fails: llmFail46, deferred: llmDeferred, fallback: llmFallback });
      if (prev46.ok !== false) console.log(JSON.stringify({ severity: 'ERROR', message: '[LLM-DOWN] OpenAI (' + (CFG.LLM_MODEL || '') + ') lỗi ' + llmErr46 + ' — ' + llmFail46 + ' lượt chấm hỏng, 0 thành công; ' + llmDeferred + ' bài xếp hàng chấm lại, ' + llmFallback + ' lead dự phòng · ' + llmErrMsg46 }));
      else console.log('[LLM-DOWN] vẫn lỗi (' + runs46 + ' lượt): ' + llmErr46 + ' · ' + llmErrMsg46);
    } else if (llmOk46 > 0 && (prev46.ok === false || !stS46 || !stS46.exists)) {
      await stRef46.set({ ok: true, recoveredAt: Date.now(), at: Date.now(), since: prev46.since || null, runs: prev46.runs || 0, kind: '', sample: '', model: CFG.LLM_MODEL || '' });
      if (prev46.ok === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[LLM-UP] OpenAI hoạt động lại — ' + llmOk46 + ' lượt chấm OK' + (llmFail46 ? ' (' + llmFail46 + ' hỏng)' : '') }));
    }
  } catch (e) { console.warn('[LLM-WATCH] lỗi:', e && e.message); }
`;
ix = ix.replace(IX7, () => IX_WATCH + IX7);
ix = ix.replace(IX8, () => IX8 + "\n    llmDeferred, llmFallback, llmRescored: rescored46, llmRescoredLeads: rescoredLeads46, llmOk: llmOk46, llmFail: llmFail46, llmErr: llmErr46, llmPreFail: llmPreFail46, /* LENH #46 */");

/* ================= (3) outreach.js ================= */
const OA1 = "    if (humanBusy44(lead, brand)) continue; // LENH #44 (R-1)";
const OA2 = "    if (temp37 === 'junk') continue;";
need(src.oa, 'outreach.js', [['OA1 AdsPower gate', OA1], ['OA2 func gate', OA2]]);
let oa = src.oa;
oa = oa.replace(OA1, () => "    if (lead.ai_scored === false) continue; // LENH #46: điểm tạm (AI chưa chấm) → máy không chạm tới khi AI chấm lại\n" + OA1);
oa = oa.replace(OA2, () => OA2 + "\n    if (lead.ai_scored === false) continue; // LENH #46: điểm tạm (AI chưa chấm) → máy không chạm");

/* ================= (4) push.js ================= */
const PU1 = "  if (!before && after.temp === 'hot') {";
need(src.pu, 'push.js', [['PU1 hot push', PU1]]);
let pu = src.pu.replace(PU1, () => "  if (((!before && after.ai_scored !== false) || (before && before.ai_scored === false && after.ai_scored === true && !after.dropped)) && after.temp === 'hot') { // LENH #46: không push lead dự phòng (điểm tạm); AI chấm lại thành nóng → push");

/* ghi 2 pha: mọi mốc 4 file đã khớp mới ghi đĩa */
fs.writeFileSync(FSC, sc); fs.writeFileSync(FIX, ix); fs.writeFileSync(FOA, oa); fs.writeFileSync(FPU, pu);
console.log('PATCH OK 4 file (LENH #46): lib/scorer.js llmChat46 (sanitize · timeout · thử lại · e.kind · health46) · index.js score_retry + rescore + [LLM-DOWN] · outreach.js gate ai_scored:false ×2 · push.js không push điểm tạm');
