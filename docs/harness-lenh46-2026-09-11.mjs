/* Harness LỆNH #46 (11/09/2026) — chạy trên FIXTURE (engine dựng lại từ dump, thư mục lenh-2026-09-11-46-fixture) sau khi áp patch trong thư mục tạm.
   Kiểm: patch áp/idempotent/fail-closed · scorer.js llmChat46 (500→OK, Retry-After, auth/quota/model/badreq không thử lại, bỏ response_format khi API từ chối,
   JSON kẹp ```json, format retry, timeout, sanitize surrogate lẻ, hotness chữ, heuristicOnly kẹp ≤59, không key → heuristic cũ, prefilter fail-open)
   · index.js: deferPost46/loader score_retry · nhánh catch (deferred/fallback/error) · sweeper chấm lại (drop/human/role/skip/stop) · giám sát [LLM-DOWN]/[LLM-UP]
   · outreach.js 2 cổng · push.js điều kiện. L46_EXPORT_DIR=<dir> → xuất fake ~/firebase-s13/functions (UNPATCHED) cho dry-run .sh rồi thoát.
   Chạy: node docs/harness-lenh46-2026-09-11.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, 'lenh-2026-09-11-46-fixture'), PATCH = path.join(HERE, 'lenh-2026-09-11-46-patch.cjs');
const cpDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) cpDir(s, d); else fs.copyFileSync(s, d); } };
if (process.env.L46_EXPORT_DIR) {
  const E = process.env.L46_EXPORT_DIR; cpDir(FX, E); fs.writeFileSync(path.join(E, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(E, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-test\nLLM_PREFILTER_MODEL=nano-test\nLLM_TRIES=1\n');
  const p = fs.readFileSync(path.join(E, 'push.js'), 'utf8').replace(/^import .* from 'firebase-[^']+';\n/gm, '');
  fs.writeFileSync(path.join(E, 'push.js'), "import { onDocumentWritten, onSchedule, getApps, initializeApp, getFirestore, FieldValue, getMessaging } from './stub.mjs';\n" + p);
  console.log('exported fake functions dir (UNPATCHED) →', E); process.exit(0);
}
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗', m); } };
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
const between = (s, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); if (i < 0 || j < 0) throw new Error('không thấy đoạn ' + a.slice(0, 40)); return s.slice(i, j); };
const BEL = String.fromCharCode(7), HI = String.fromCharCode(0xD83D), LO = String.fromCharCode(0xDE00); // ký tự điều khiển + surrogate (không ghi thô vào file)
const wellFormed = s => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

/* ---------- 0. patch: áp / idempotent / node --check / fail-closed ---------- */
console.log('-- patch');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'l46-')); cpDir(FX, W); fs.writeFileSync(path.join(W, 'package.json'), '{"type":"module"}\n');
const run = (cwd, args) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
const r1 = run(W, [PATCH, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']); ok(r1.code === 0 && /PATCH OK 4 file/.test(r1.out), 'patch áp trên fixture: PATCH OK 4 file');
const r2 = run(W, [PATCH, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of ['lib/scorer.js', 'index.js', 'outreach.js', 'push.js']) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f); }
{ const W2 = fs.mkdtempSync(path.join(os.tmpdir(), 'l46b-')); cpDir(FX, W2); const f = path.join(W2, 'outreach.js'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("if (temp37 === 'junk') continue;", "if (temp37 === 'junkX') continue;"));
  const before = ['lib/scorer.js', 'index.js', 'push.js'].map(x => fs.readFileSync(path.join(W2, x), 'utf8'));
  const r = run(W2, [PATCH, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']);
  const same = ['lib/scorer.js', 'index.js', 'push.js'].every((x, i) => fs.readFileSync(path.join(W2, x), 'utf8') === before[i]);
  ok(r.code === 1 && /KHONG THAY MOC outreach.js\/OA2/.test(r.out) && same, 'fail-closed NGUYÊN TỬ: thiếu 1 mốc outreach.js → exit 1, KHÔNG ghi file nào (3 file kia nguyên)'); }
{ const W3 = fs.mkdtempSync(path.join(os.tmpdir(), 'l46c-')); cpDir(W, W3); fs.writeFileSync(path.join(W3, 'push.js'), fs.readFileSync(path.join(FX, 'push.js'), 'utf8')); const r = run(W3, [PATCH, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']); ok(r.code === 1 && /LỆCH/.test(r.out), 'lệch (3 file đã patch, push.js chưa) → báo LỆCH, dừng'); }

/* ---------- A. scorer.js với fetch giả ---------- */
console.log('-- scorer.js llmChat46');
let calls = [], script = [];
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: h => (r.headers || {})[h] || null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body) });
globalThis.fetch = async (url, opt) => { calls.push({ url, body: JSON.parse(opt.body), opt }); const step = script.shift(); if (!step) throw new Error('harness: hết kịch bản'); if (typeof step === 'function') return step(opt); return mk(step); };
const good = (obj, extra) => Object.assign({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: 'gpt-test' } }, extra || {});
const raw = content => ({ status: 200, body: { choices: [{ message: { content }, finish_reason: 'stop' }], usage: {} } });
const err = (status, code, type, message, headers) => ({ status, body: { error: { code, type, message } }, headers });
const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href);
const cfg = sc.scoreLead.cfg46, H = sc.scoreLead.health46; cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300;
const post = { kind: 'post', text: 'Thuê mb chỉ 5 triệu trung tâm thị xã, ae cho lời khuyên', author: 'Ẩn danh', post_id: 'p1' }, src = { industry: 'Bất động sản', name: 'S1' };
const LEAD = { is_real_lead: false, hotness: 20, intent: 'hỏi kinh nghiệm', industry: 'bđs', service: '', reply: 'r', role: 'other', role_reason: 'hỏi lời khuyên' };
const attempt = async (fn) => { try { return { v: await fn() }; } catch (e) { return { e }; } };
ok(typeof cfg === 'object' && cfg.tries === 4 && typeof H === 'object', 'scoreLead.cfg46 (tries 4, waits 2/5/12 s mặc định) + health46 lộ ra');
calls = []; script = [err(500, null, 'server_error', 'The server had an error while processing your request. Sorry about that!'), err(502, null, null, 'bad gateway'), good(LEAD)];
let r = await attempt(() => sc.scoreLead(post, src, [], null));
ok(r.v && r.v.hotness === 20 && r.v._llm === true && calls.length === 3 && H.ok === 1 && H.fail === 0 && H.attemptsFail === 2, '500 → 502 → 200: thử lại và THÀNH CÔNG (3 lượt gọi, health ok 1/fail 0) — ca LỆNH #45 hết rơi heuristic');
calls = []; script = [err(429, 'rate_limit_exceeded', 'requests', 'Rate limit reached', { 'retry-after': '1' }), good(LEAD)]; let t0 = Date.now();
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && calls.length === 2 && Date.now() - t0 >= 900, '429 Retry-After 1 s → chờ ≥ 1 s rồi gọi lại OK');
calls = []; script = [err(401, 'invalid_api_key', 'invalid_request_error', 'Incorrect API key provided')];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'auth' && calls.length === 1 && H.fail === 1 && H.lastKind === 'auth', '401 invalid_api_key → NÉM lỗi kind auth, KHÔNG thử lại (1 lượt), health.fail 1');
calls = []; script = [err(429, 'insufficient_quota', 'insufficient_quota', 'You exceeded your current quota')];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'quota' && calls.length === 1, '429 insufficient_quota (hết credit) → kind quota, không thử lại');
calls = []; script = [err(404, 'model_not_found', 'invalid_request_error', 'The model `x` does not exist')];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'model' && calls.length === 1, '404 model_not_found → kind model, không thử lại');
calls = []; script = [err(400, null, 'invalid_request_error', 'Invalid body: failed to parse JSON value')];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'badreq' && calls.length === 1, '400 Invalid body → kind badreq, không thử lại (index.js → dự phòng kẹp)');
calls = []; script = [err(400, null, 'invalid_request_error', "Invalid parameter: 'response_format' of type 'json_object' is not supported with this model"), good(LEAD)];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && calls.length === 2 && calls[0].body.response_format && !calls[1].body.response_format, 'API từ chối response_format → gửi lại KHÔNG json mode → OK');
calls = []; script = [raw('Đây là JSON:\n```json\n' + JSON.stringify(Object.assign({}, LEAD, { hotness: 77 })) + '\n```')];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && r.v.hotness === 77, 'content kẹp ```json … ``` → vẫn đọc được');
calls = []; script = [raw('xin lỗi tôi không thể'), raw(''), good(LEAD)];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && calls.length === 3, 'content không phải JSON ×2 → thử lại → lượt 3 OK');
calls = []; script = [raw('a'), raw('b'), raw('c'), raw('d'), raw('e')];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'format' && calls.length === 4, 'JSON hỏng 4 lượt → ném kind format (đúng 4 lượt, không hơn)');
calls = []; script = [err(500, null, null, 'x'), err(503, null, null, 'x'), err(500, null, null, 'x'), err(500, null, null, 'x'), good(LEAD)]; const f0 = H.fail;
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'server' && r.e.status === 500 && calls.length === 4 && H.fail === f0 + 1 && /LLM 500/.test(r.e.message), '5xx ×4 → ném kind server (4 lượt), health.fail +1, message có mã');
const hang = opt => new Promise((_, rej) => opt.signal.addEventListener('abort', () => rej(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))));
calls = []; script = [hang, hang, hang, hang]; t0 = Date.now();
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'net' && /quá 300 ms/.test(r.e.message) && calls.length === 4 && Date.now() - t0 < 3000, 'treo → AbortController cắt sau timeoutMs → kind net (không treo pool)');
calls = []; script = [good(LEAD)]; const cut = 'Cần thuê ' + HI + BEL + ' mb'; // = 'Cần thuê 😀' bị slice cắt đôi + ký tự điều khiển
r = await attempt(() => sc.scoreLead({ kind: 'post', text: cut, author: 'A ' + HI, post_id: 'p2' }, src, [], null));
{ const c = calls[0].body.messages[1].content;
  ok(r.v && wellFormed(c) && c.indexOf(BEL) < 0 && /Cần thuê/.test(c) && !wellFormed(cut) && calls[0].opt.body.indexOf('\\ud83d') < 0, 'emoji bị slice cắt đôi + ký tự điều khiển → sanitize: body gửi đi hợp lệ (hết 400 "Invalid body")'); }
calls = []; script = [good(Object.assign({}, LEAD, { hotness: 'high', role: 'SELLER', industry: '' }))];
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && r.v.hotness === 85 && r.v.role === 'seller' && r.v.industry === 'Bất động sản' && r.v._usage.total === 15 && r.v._model === 'gpt-test', 'chuẩn hoá giữ nguyên: hotness "high"→85, role SELLER→seller, industry fallback nguồn, _usage, _model');
calls = []; r = await attempt(() => sc.scoreLead(post, src, [], null, { heuristicOnly: true }));
ok(r.v && r.v.hotness === 59 && r.v.is_real_lead === true && r.v._llm === false && r.v._fallback === true && /Điểm tạm/.test(r.v.intent) && calls.length === 0, 'heuristicOnly: "Thuê mb chỉ 5 triệu" 90 → KẸP 59 (lạnh), _llm false, intent nói rõ điểm tạm, không gọi mạng');
{ const CFGm = (await import(pathToFileURL(path.join(W, 'lib/config.js')).href)).CFG; const bak = CFGm.LLM_API_KEY; CFGm.LLM_API_KEY = ''; calls = [];
  r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && r.v.hotness === 90 && r.v._llm === false && !r.v._fallback && calls.length === 0, 'không cấu hình key → heuristic KHÔNG kẹp như trước (cố ý, hành vi cũ)'); CFGm.LLM_API_KEY = bak; }
calls = []; script = [err(500, null, null, 'x'), err(500, null, null, 'x'), good({ maybe: false })]; const pf0 = H.preFail;
r = await attempt(() => sc.prefilterLead(post, null)); ok(r.v && r.v.maybe === true && r.v._llm === false && r.v._err === 'server' && calls.length === 2 && H.preFail === pf0 + 1, 'prefilter 500 ×2 → fail-open maybe:true (2 lượt, không hơn), _err server, preFail +1');
calls = []; script = [good({ maybe: false })];
r = await attempt(() => sc.prefilterLead(post, null)); ok(r.v && r.v.maybe === false && r.v._llm === true && r.v._usage.total === 15 && calls[0].body.model === 'p', 'prefilter OK → maybe:false, model sàng lọc, usage');
ok(sc.scoreLead.sanitize46('a' + HI + 'b' + LO + 'c' + HI + LO) === 'abc' + HI + LO && sc.scoreLead.parseJson46('[1]') === null && sc.scoreLead.parseJson46(' {"a":1} ').a === 1, 'sanitize46 giữ cặp hợp lệ/bỏ lẻ · parseJson46 chỉ nhận object');

/* ---------- B. index.js: trích khối đã vá, chạy với Firestore giả ---------- */
console.log('-- index.js');
const ix = fs.readFileSync(path.join(W, 'index.js'), 'utf8');
function fakeDb() {
  const store = new Map(), log = { queries: 0, deletes: [], notes: [] };
  const clone = o => JSON.parse(JSON.stringify(o));
  const merge = (old, patch) => { const o = Object.assign({}, old || {}); for (const [k, v] of Object.entries(patch)) { if (v && typeof v === 'object' && !Array.isArray(v) && '__inc' in v) o[k] = (Number(o[k]) || 0) + v.__inc; else if (v && typeof v === 'object' && !Array.isArray(v) && '__del' in v) delete o[k]; else o[k] = v; } return o; };
  const docRef = (col, id) => ({ id, path: col + '/' + id, async get() { return snap(col, id); }, async set(obj, opt) { store.set(col + '/' + id, (opt && opt.merge) ? merge(store.get(col + '/' + id), obj) : merge({}, obj)); }, async delete() { log.deletes.push(col + '/' + id); store.delete(col + '/' + id); }, collection: c => query(col + '/' + id + '/' + c) });
  const snap = (col, id) => { const d = store.get(col + '/' + id); return { id, exists: !!d, ref: docRef(col, id), data: () => d ? clone(d) : undefined }; };
  function query(col, filters = [], order = null, lim = 0) { return { where: (f, op, v) => query(col, [...filters, [f, op, v]], order, lim), orderBy: (f, dir) => query(col, filters, [f, dir || 'asc'], lim), limit: n => query(col, filters, order, n), doc: id => docRef(col, id),
    async add(obj) { const id = 'auto' + (store.size + 1); store.set(col + '/' + id, merge({}, obj)); if (/\/notes$/.test(col)) log.notes.push({ col, v: store.get(col + '/' + id) }); return docRef(col, id); },
    async get() { log.queries++; let docs = [...store.entries()].filter(([k]) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/')).map(([k, v]) => ({ id: k.slice(col.length + 1), v }));
      docs = docs.filter(({ v }) => filters.every(([f, op, x]) => { const a = v[f]; if (op === '==') return a === x; if (a == null) return false; if (op === '<=') return a <= x; if (op === '>=') return a >= x; return true; }));
      if (order) { docs = docs.filter(({ v }) => v[order[0]] != null); docs.sort((p, q) => (p.v[order[0]] > q.v[order[0]] ? 1 : p.v[order[0]] < q.v[order[0]] ? -1 : 0) * (order[1] === 'desc' ? -1 : 1)); }
      if (lim) docs = docs.slice(0, lim); const out = docs.map(({ id }) => snap(col, id)); return { empty: !out.length, size: out.length, docs: out }; } }; }
  return { db: { collection: c => query(c) }, store, log };
}
const FieldValue = { serverTimestamp: () => Date.now(), increment: n => ({ __inc: n }), delete: () => ({ __del: 1 }) };
const quiet = { log: () => {}, warn: () => {}, error: () => {} };
// B1 deferPost46 + loader
const deferText = between(ix, '  const sow46 = !isBackfill', '  await mapPool(toScore, CFG.SCORE_CONCURRENCY || 6, async (x) => {');
const mkDefer = new AsyncFn('db', 'FieldValue', 'sources', 'gKw', 'gEx', 'bySource', 'toScore', 'isBackfill', 'opts', 'force', 'console', deferText + '\n return { deferPost46, sow46, slimPost46 };');
{ const F = fakeDb(); const now = Date.now(); const sources = [{ url: 'u1', name: 'S1', industry: 'hs', brand: 'b1', keywords: ['k'] }];
  await F.db.collection('score_retry').doc('R_a').set({ post: { post_id: 'a', text: 'ta', source: 'S1' }, src: { url: 'u1', name: 'S1' }, tries: 1, firstAt: now - 6e5, nextAt: now - 1000 });
  await F.db.collection('score_retry').doc('R_b').set({ post: { post_id: 'b', text: 'tb' }, src: { url: 'u9' }, tries: 1, firstAt: now, nextAt: now - 1000 });
  await F.db.collection('score_retry').doc('R_c').set({ post: { post_id: 'c', text: 'tc' }, src: { url: 'u1' }, tries: 1, firstAt: now, nextAt: now + 6e5 });
  const bySource = [], toScore = [];
  const api = await mkDefer(F.db, FieldValue, sources, ['g'], ['x'], bySource, toScore, false, {}, false, quiet);
  ok(api.sow46 === true && toScore.length === 1 && toScore[0].post.post_id === 'a' && toScore[0].deferredRef && toScore[0].deferredDoc.tries === 1 && toScore[0].effSrc.keywords.join() === 'k,g' && toScore[0].src === sources[0] && bySource.length === 1 && bySource[0].url === 'u1', 'loader: nạp bài R_a tới hạn (effSrc ghép keyword chung, row bySource mới), R_c chưa tới hạn giữ nguyên');
  ok(F.log.deletes.includes('score_retry/R_b') && F.store.has('score_retry/R_c') && !F.store.has('score_retry/R_b'), 'loader: bài của nguồn không còn (u9) → xoá khỏi hàng chờ');
  const x = { post: { post_id: 'p1', text: 't'.repeat(5000), author: 'A', _retried: true, arr: [1], nested: { a: 1 }, n: 5, b: true }, src: sources[0] };
  const e = Object.assign(new Error('LLM 500 [server_error]: boom'), { kind: 'server' });
  const r1 = await api.deferPost46(x, e); const d1 = F.store.get('score_retry/R_p1');
  ok(r1 === 'deferred' && d1 && d1.tries === 1 && d1.kind === 'server' && Math.abs(d1.nextAt - (now + 3 * 60000)) < 5000 && d1.src.brand === 'b1' && d1.post.text.length === 4000 && d1.post._retried === undefined && d1.post.arr === undefined && d1.post.nested === undefined && d1.post.n === 5 && d1.post.b === true, 'deferPost46 lần 1: ghi score_retry/R_p1 tries 1, nextAt +3′, src.brand, post gọn (bỏ _*/mảng/object, text ≤4000)');
  const x2 = { post: { post_id: 'p1', text: 't' }, src: sources[0], deferredRef: F.db.collection('score_retry').doc('R_p1'), deferredDoc: { tries: 2, firstAt: now - 3600e3 } };
  const r2 = await api.deferPost46(x2, e); const d2 = F.store.get('score_retry/R_p1');
  ok(r2 === 'deferred' && d2.tries === 3 && Math.abs(d2.nextAt - (now + 30 * 60000)) < 5000 && x2.deferredRef === null, 'lần 3: tries 3 → nextAt +30′ (3→10→30→60→180→360)');
  const x3 = { post: { post_id: 'p1', text: 't' }, src: sources[0], deferredRef: F.db.collection('score_retry').doc('R_p1'), deferredDoc: { tries: 6, firstAt: now - 3600e3 } };
  const r3 = await api.deferPost46(x3, e);
  ok(r3 === 'fallback' && !F.store.has('score_retry/R_p1') && x3.deferredRef === null, 'quá 6 lần → fallback (dự phòng kẹp), xoá doc chờ, deferredRef null');
  const x4 = { post: { post_id: 'p4', text: 't' }, src: sources[0], deferredRef: null, deferredDoc: { tries: 1, firstAt: now - 25 * 3600e3 } };
  ok((await api.deferPost46(x4, e)) === 'fallback' && !F.store.has('score_retry/R_p4'), 'quá 24 h kể từ lần đầu → fallback');
  const x5 = { post: { post_id: 'p5', text: 't' }, src: sources[0] };
  ok((await api.deferPost46(x5, Object.assign(new Error('LLM 400'), { kind: 'badreq' }))) === 'fallback' && !F.store.has('score_retry/R_p5'), 'kind badreq (request hỏng cho riêng bài) → fallback ngay, không xếp hàng');
  ok((await api.deferPost46({ post: { text: 't' }, src: sources[0] }, e)) === 'fallback', 'không có post_id → fallback');
  const x6 = { post: { post_id: 'p6', text: 't' }, src: sources[0] }; ok((await api.deferPost46(x6, Object.assign(new Error('LLM 401'), { kind: 'auth' }))) === 'deferred' && F.store.get('score_retry/R_p6').kind === 'auth', 'kind auth (cấu hình sai) → vẫn xếp hàng chờ (tự chấm khi sửa key), không tạo lead');
  const F2 = fakeDb(); await F2.db.collection('score_retry').doc('R_z').set({ post: { post_id: 'z' }, src: { url: 'u1' }, nextAt: now - 1 }); const ts2 = [];
  const api2 = await mkDefer(F2.db, FieldValue, sources, [], [], [], ts2, true, {}, false, quiet); ok(api2.sow46 === false && ts2.length === 0 && F2.log.queries === 0, 'backfill → sow46 false: KHÔNG nạp hàng chờ (không truy vấn)');
  const api3 = await mkDefer(F2.db, FieldValue, sources, [], [], [], ts2, false, { sourceUrl: 'u1' }, false, quiet); ok(api3.sow46 === false && ts2.length === 0, 'quét riêng nguồn (sourceUrl) → sow46 false'); }
// B2 nhánh catch trong mapPool
const catchText = between(ix, '    catch (e46) {', '    const u = ai._usage || {}; if (ai._llm) scoreCalls++;');
const mkCatch = new AsyncFn('deferPost46', 'scoreLead', 'recordPost', 'flushPosts', 'prog', 'ctr', 'return async (x, e46) => { let ai; let llmFallback = 0, scored = 0, scoreErrors = 0, llmDeferred = 0; try { try { throw e46; }\n' + catchText + '\n } finally { ctr.push({ llmFallback, scored, scoreErrors, llmDeferred, ai }); } return ai; };');
{ const rec = []; const mkr = (res) => mkCatch(async () => res, sc.scoreLead, (x, f) => rec.push(f.decision), async () => {}, async () => {}, rec);
  const e = Object.assign(new Error('x'), { kind: 'server' }); const x = { post, effSrc: src };
  let ai = await (await mkr('deferred'))(x, e); let c = rec.pop();
  ok(ai === undefined && rec.includes('ai_wait') && c.llmDeferred === 1 && c.scored === 1 && c.scoreErrors === 0 && c.llmFallback === 0, "catch 'deferred' → recordPost ai_wait, llmDeferred+1, KHÔNG tạo lead (return)");
  rec.length = 0; ai = await (await mkr('fallback'))(x, e); c = rec.pop();
  ok(ai && ai.hotness === 59 && ai._llm === false && c.llmFallback === 1 && c.llmDeferred === 0 && rec.length === 0, "catch 'fallback' → ai = heuristic kẹp 59, llmFallback+1, đi tiếp tạo lead (ai_scored:false)");
  rec.length = 0; ai = await (await mkr('error'))(x, e); c = rec.pop();
  ok(ai === undefined && rec.includes('error') && c.scoreErrors === 1 && c.llmDeferred === 0, "catch 'error' (ghi score_retry lỗi) → decision error + scoreErrors+1 như cũ"); }
ok(/if \(ai\._llm !== false && !\(ai\.reply && String\(ai\.reply\)\.trim\(\)\)\) \{/.test(ix) && /__ai2 = await scoreLead\(x\.post, x\.effSrc, config\.weights, await __brandAiOf\(x\.effSrc\), \{ tries: 2 \}\)/.test(ix), 'miss-reply: không gọi lại khi đang dự phòng; 2 lượt gọi lại chỉ thử 2 lần');
ok(/if \(x\.deferredRef\) \{ rescored46\+\+; await x\.deferredRef\.delete\(\)\.catch/.test(ix) && ix.indexOf('if (x.deferredRef) { rescored46++') > ix.indexOf("const u = ai._usage || {}; if (ai._llm) scoreCalls++;") && ix.indexOf('if (x.deferredRef) { rescored46++') < ix.indexOf('const t = tempOf(ai.hotness || 0);'), 'bài chờ được AI chấm → xoá doc score_retry ngay sau scoreLead OK (trước tempOf)');
ok(/llmDeferred, llmFallback, llmRescored: rescored46, llmRescoredLeads: rescoredLeads46, llmOk: llmOk46, llmFail: llmFail46, llmErr: llmErr46, llmPreFail: llmPreFail46/.test(ix), 'scans doc thêm llmDeferred/llmFallback/llmRescored/llmOk/llmFail/llmErr/llmPreFail');
// B3 sweeper chấm lại
const sweepText = between(ix, '  let rescoredLeads46 = 0', '  const durationMs = Date.now() - t0;');
const mkSweep = new AsyncFn('db', 'FieldValue', 'sources', 'config', 'CFG', 'scoreLead', 'tempOf', 'mapPool', '__h0', 'sow46', 'process', 'console', 'let scoreCalls = 0, mainIn = 0, mainOut = 0;\n' + sweepText + '\n return { rescoredLeads46, rescoreDropped46, scoreCalls };');
const tempOf = h => h >= 80 ? 'hot' : h >= 60 ? 'warm' : h >= 40 ? 'cold' : 'junk';
async function mapPool(items, limit, fn) { let i = 0; const n = Math.max(1, Math.min(limit, items.length || 1)); await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const idx = i++; await fn(items[idx], idx); } })); }
{ const F = fakeDb(); const now = Date.now(); const L = F.db.collection('leads');
  await L.doc('L1').set({ ai_scored: false, score: 90, temp: 'hot', intent: 'Cần mua', text: 'Thuê mb chỉ 5 triệu', name: 'Ẩn danh', source: 'S1', brand: 'b1', detected_at: now - 3600e3, stage: 'new' });
  await L.doc('L2').set({ ai_scored: false, score: 45, temp: 'cold', text: 'vốn góp', source: 'S1', brand: 'b1', detected_at: now - 7200e3, stage: 'new', first_care_at: now - 1000 });
  await L.doc('L3').set({ ai_scored: false, score: 88, temp: 'hot', text: 'ib em có sẵn', source: 'S1', brand: 'b1', detected_at: now - 10000, stage: 'new' });
  await L.doc('L4').set({ ai_scored: false, score: 88, temp: 'hot', text: 'x', dropped: true, detected_at: now });
  await L.doc('L5').set({ ai_scored: false, score: 88, temp: 'hot', text: 'x', rescore_tries: 8, detected_at: now });
  await L.doc('L6').set({ ai_scored: false, score: 88, temp: 'hot', text: 'x', detected_at: now - 40 * 86400e3 });
  await L.doc('L7').set({ ai_scored: true, score: 88, temp: 'hot', text: 'x', detected_at: now });
  await F.db.collection('brands').doc('b1').set({ ai: { nganh: 'hải sản' } });
  const seen = []; const fakeScore = async (p, s, w, ai, o) => { seen.push({ id: p.post_id, ai, o }); if (p.text === 'ib em có sẵn') return { is_real_lead: false, hotness: 5, role: 'seller', role_reason: 'chào hàng', intent: 'bán', _llm: true, _usage: { prompt: 1, completion: 1 } }; if (p.text === 'vốn góp') return { is_real_lead: false, hotness: 30, role: 'other', intent: 'hỏi', _llm: true, _usage: {} }; return { is_real_lead: false, hotness: 15, role: 'other', intent: 'hỏi kinh nghiệm', need: 'không', reply: 'rr', _llm: true, _usage: { prompt: 2, completion: 2 } }; };
  const res = await mkSweep(F.db, FieldValue, [{ name: 'S1', industry: 'hs' }], {}, { MIN_KEEP_SCORE: 40 }, fakeScore, tempOf, mapPool, { ok: 0, fail: 0 }, true, { env: {} }, quiet);
  const l1 = F.store.get('leads/L1'), l2 = F.store.get('leads/L2'), l3 = F.store.get('leads/L3');
  ok(res.rescoredLeads46 === 3 && res.rescoreDropped46 === 2 && seen.length === 3 && seen.every(s => s.o && s.o.tries === 2) && seen.every(s => s.ai && s.ai.nganh === 'hải sản'), 'sweeper: chấm lại 3 lead điểm tạm (bỏ dropped / tries≥8 / >30 ngày / ai_scored:true), mỗi lead 2 lượt thử, có Hồ sơ AI brand');
  ok(l1.ai_scored === true && l1.score === 15 && l1.temp === 'junk' && l1.dropped === true && l1.dropped_by === 'rescore' && /điểm 15/.test(l1.dropped_reason) && l1.ai_prev.score === 90 && l1.ai_prev.temp === 'hot' && l1.reply === 'rr' && l1.need === 'không' && l1.rescored_at > 0, 'L1 (rác 90 nóng, chưa ai chăm) → AI 15 → dropped (rescore), ai_prev giữ 90/hot, reply/need mới');
  ok(l2.ai_scored === true && l2.score === 30 && l2.dropped !== true && /giữ vì sales đang chăm/.test(l2.rescore_note), 'L2 sales đã chăm → cập nhật điểm 30, KHÔNG loại, ghi rescore_note');
  ok(l3.dropped === true && l3.dropped_by === 'rescore_role' && /người bán/.test(l3.dropped_reason) && l3.role === 'seller', 'L3 AI xếp vai người bán → dropped (rescore_role)');
  ok(F.log.notes.length === 3 && F.log.notes.every(n => /^leads\/L[123]\/notes$/.test(n.col) && n.v.by_uid === 'engine' && /AI đã chấm lại/.test(n.v.text) && !/phản hồi|trả lời/.test(n.v.text)) && F.store.get('leads/L4').ai_scored === false && F.store.get('leads/L5').ai_scored === false, 'ghi chú hệ thống 3 lead (không chứa "phản hồi/trả lời" → không bị FE nhận nhầm là khách trả lời); lead bỏ qua không đổi');
  const F3 = fakeDb(); await F3.db.collection('leads').doc('A').set({ ai_scored: false, score: 50, text: 'x', detected_at: now, stage: 'new' });
  const res2 = await mkSweep(F3.db, FieldValue, [], {}, { MIN_KEEP_SCORE: 40 }, async () => { throw Object.assign(new Error('LLM 500'), { kind: 'server' }); }, tempOf, mapPool, { ok: 0, fail: 0 }, true, { env: {} }, quiet);
  const a = F3.store.get('leads/A'); ok(res2.rescoredLeads46 === 0 && a.rescore_tries === 1 && /LLM 500/.test(a.rescore_err) && a.ai_scored === false, 'scoreLead lỗi khi chấm lại → rescore_tries +1, giữ ai_scored:false, dừng sớm');
  const F4 = fakeDb(); await F4.db.collection('leads').doc('A').set({ ai_scored: false, score: 50, text: 'x', detected_at: now });
  const res3 = await mkSweep(F4.db, FieldValue, [], {}, { MIN_KEEP_SCORE: 40 }, fakeScore, tempOf, mapPool, { ok: 0, fail: 0 }, true, { env: {} }, quiet);
  ok(res3.rescoredLeads46 === 1, 'không có lượt chấm nào trong lượt quét (0 ok / 0 fail) → vẫn chấm lại');
  const down = async () => ({}); down.health46 = { ok: 0, fail: 2 }; const F5 = fakeDb(); await F5.db.collection('leads').doc('A').set({ ai_scored: false, score: 50, text: 'x', detected_at: now });
  const res4 = await mkSweep(F5.db, FieldValue, [], {}, { MIN_KEEP_SCORE: 40 }, down, tempOf, mapPool, { ok: 0, fail: 0 }, true, { env: {} }, quiet);
  ok(res4.rescoredLeads46 === 0 && F5.log.queries === 0, 'lượt quét đang LLM hỏng (0 ok / 2 fail) → KHÔNG chấm lại (không truy vấn)');
  const res5 = await mkSweep(F5.db, FieldValue, [], {}, { MIN_KEEP_SCORE: 40 }, fakeScore, tempOf, mapPool, { ok: 0, fail: 0 }, false, { env: {} }, quiet); ok(res5.rescoredLeads46 === 0, 'sow46 false (backfill/quét riêng) → không chấm lại');
  const res6 = await mkSweep(F5.db, FieldValue, [], {}, { MIN_KEEP_SCORE: 40 }, fakeScore, tempOf, mapPool, { ok: 0, fail: 0 }, true, { env: { RESCORE_FALLBACK: 'false' } }, quiet); ok(res6.rescoredLeads46 === 0, 'RESCORE_FALLBACK=false → tắt sweeper'); }
// B4 giám sát [LLM-DOWN]/[LLM-UP]
const watchText = between(ix, '  const __hE = scoreLead.health46 || {};', '  const llmCalls = scoreCalls + preCalls;');
const mkWatch = new AsyncFn('db', 'scoreLead', '__h0', 'CFG', 'llmDeferred', 'llmFallback', 'console', watchText + '\n return { llmOk46, llmFail46, llmErr46, llmPreFail46 };');
{ const F = fakeDb(); const logs = []; const con = { log: m => logs.push(String(m)), warn: () => {}, error: () => {} }; const sl = async () => ({}); const CFGx = { LLM_MODEL: 'gpt-5.6-sol' };
  sl.health46 = { ok: 0, fail: 2, preFail: 1, lastKind: 'server', last: 'LLM 500 [server_error]: The server had an error' };
  let w = await mkWatch(F.db, sl, { ok: 0, fail: 0, pre: 0 }, CFGx, 3, 0, con); let st = F.store.get('system_status/llm');
  ok(w.llmFail46 === 2 && w.llmOk46 === 0 && w.llmErr46 === 'server' && w.llmPreFail46 === 1 && st && st.ok === false && st.runs === 1 && st.kind === 'server' && st.deferred === 3 && st.model === 'gpt-5.6-sol' && logs.some(m => /"severity":"ERROR"/.test(m) && /\[LLM-DOWN\]/.test(m) && /3 bài xếp hàng/.test(m)), '2 lượt hỏng / 0 OK → system_status/llm ok:false runs 1 + console ERROR [LLM-DOWN] (kích alert #9)');
  logs.length = 0; sl.health46 = { ok: 0, fail: 5, preFail: 1, lastKind: 'server', last: 'x' }; w = await mkWatch(F.db, sl, { ok: 0, fail: 2, pre: 1 }, CFGx, 1, 0, con); st = F.store.get('system_status/llm');
  ok(w.llmFail46 === 3 && st.runs === 2 && st.ok === false && !logs.some(m => /"severity":"ERROR"/.test(m)) && logs.some(m => /vẫn lỗi \(2 lượt\)/.test(m)), 'lượt kế vẫn hỏng → runs 2, KHÔNG bắn ERROR lần 2 (chỉ log thường)');
  logs.length = 0; sl.health46 = { ok: 4, fail: 6, preFail: 1, lastKind: 'server', last: 'x' }; w = await mkWatch(F.db, sl, { ok: 0, fail: 5, pre: 1 }, CFGx, 0, 0, con); st = F.store.get('system_status/llm');
  ok(w.llmOk46 === 4 && w.llmFail46 === 1 && st.ok === true && st.recoveredAt > 0 && logs.some(m => /"severity":"WARNING"/.test(m) && /\[LLM-UP\]/.test(m)), '4 OK / 1 hỏng sau khi down → ok:true + WARNING [LLM-UP]');
  const F2 = fakeDb(); logs.length = 0; sl.health46 = { ok: 0, fail: 1, preFail: 0, lastKind: 'auth', last: 'LLM 401' }; w = await mkWatch(F2.db, sl, { ok: 0, fail: 0, pre: 0 }, CFGx, 1, 0, con);
  ok(F2.store.get('system_status/llm').ok === false && logs.some(m => /\[LLM-DOWN\]/.test(m) && /lỗi auth/.test(m)), 'chỉ 1 lỗi nhưng kind auth → down ngay (key sai/xoay chưa deploy)');
  const F3 = fakeDb(); logs.length = 0; sl.health46 = { ok: 0, fail: 1, preFail: 0, lastKind: 'server', last: 'x' }; w = await mkWatch(F3.db, sl, { ok: 0, fail: 0, pre: 0 }, CFGx, 1, 0, con);
  ok(!F3.store.has('system_status/llm') && logs.length === 0, '1 lỗi server lẻ (0 OK) → chưa coi là down, không ghi gì');
  const F4 = fakeDb(); logs.length = 0; sl.health46 = { ok: 2, fail: 1, preFail: 0, lastKind: 'server', last: 'x' }; w = await mkWatch(F4.db, sl, { ok: 0, fail: 0, pre: 0 }, CFGx, 0, 0, con);
  ok(F4.store.get('system_status/llm').ok === true && logs.length === 0, 'có OK lẫn lỗi, chưa có doc → ghi ok:true (FE biết AI chấm bình thường), không log'); }

/* ---------- C. outreach.js + push.js ---------- */
console.log('-- outreach.js / push.js');
const oa = fs.readFileSync(path.join(W, 'outreach.js'), 'utf8'), pu = fs.readFileSync(path.join(W, 'push.js'), 'utf8');
const G1 = "if (lead.ai_scored === false) continue; // LENH #46: điểm tạm (AI chưa chấm) → máy không chạm tới khi AI chấm lại", G2 = "if (lead.ai_scored === false) continue; // LENH #46: điểm tạm (AI chưa chấm) → máy không chạm";
ok(oa.indexOf(G1) < oa.indexOf('if (humanBusy44(lead, brand)) continue;') && oa.indexOf(G1) > oa.indexOf('if (lead.dropped) continue;'), 'AdsPower path: cổng ai_scored:false đặt sau dropped, trước humanBusy44');
{ const i = oa.indexOf("if (temp37 === 'junk') continue;"); const j = oa.indexOf(G2 + '\n'); ok(j > i && j - i < 80 && oa.split('LENH #46').length - 1 === 2, 'func path (stepNick): cổng ai_scored:false ngay sau junk; đúng 2 cổng'); }
{ const m = pu.match(/if \((.*)\) \{ \/\/ LENH #46/); ok(!!m, 'push.js có điều kiện LENH #46'); const cond = new Function('before', 'after', 'return ' + m[1] + ';');
  ok(!!cond(null, { temp: 'hot', ai_scored: true }) === true && !!cond(null, { temp: 'hot' }) === true && !!cond(null, { temp: 'hot', ai_scored: false }) === false && !!cond(null, { temp: 'warm', ai_scored: true }) === false, 'lead mới: nóng AI chấm → push; nóng điểm tạm → KHÔNG push; lead cũ không có field → push như cũ');
  ok(!!cond({ ai_scored: false, temp: 'hot' }, { ai_scored: true, temp: 'hot' }) === true && !!cond({ ai_scored: false }, { ai_scored: true, temp: 'hot', dropped: true }) === false && !!cond({ ai_scored: true, temp: 'hot' }, { ai_scored: true, temp: 'hot' }) === false && !!cond({ ai_scored: false }, { ai_scored: true, temp: 'cold' }) === false, 'AI chấm lại điểm tạm → nóng: push 1 lần; bị loại/không nóng/cập nhật thường → không push'); }
ok(pu.indexOf("after.stage === 'responded'") < pu.indexOf('LENH #46'), 'nhánh push "khách phản hồi" đứng trước, không đổi');

/* ---------- D. import bản đã vá (stub) ---------- */
console.log('-- import');
{ const m = await import(pathToFileURL(path.join(W, 'index.js')).href); ok(typeof m.scheduledScan === 'function' && typeof m.scanAll === 'function', 'index.js đã vá import được (fixture)');
  const o = await import(pathToFileURL(path.join(W, 'outreach.js')).href); ok(typeof o.outreachTick === 'function', 'outreach.js đã vá import được'); }
console.log(`\nKẾT QUẢ: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
