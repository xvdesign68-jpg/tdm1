/* Harness LỆNH #48 (12/09/2026) — chạy trên FIXTURE `lenh-2026-09-12-48-fixture` (mã đang chạy dựng từ dump #47/#47d) sau khi áp patch trong thư mục tạm.
   Kiểm: patch áp/idempotent/fail-closed nguyên tử/LỆCH · 52 mốc đối chiếu VĂN BẢN DUMP (mỗi mốc đúng 1 lần trong mã đang chạy)
   · scorer: reasoning_effort/max_completion_tokens (gpt-5 có, gpt-4o-mini không; API từ chối → gửi lại; finish=length → nới trần), JSON hỏng thử lại đúng 1 lần, 400 → thử 1 lần không json, ngân sách/bài, usage.reasoning,
     heuristic theo brand (bigram), service không gán agency, không key → kẹp ≤59 + _nokey, replyOnly48 không gửi text thô, prefilter opts.tries
   · scraper: profile_id → user_url/author_uid; commentator_profile_url 3 dạng + tracking; user_id pfbid → link dự phòng
   · index.js chạy TRỌN scanAll trên Firestore giả: lease ứng viên (ghi/xoá), seen create() + ALREADY_EXISTS, nạp score_retry bằng transaction (2 lượt chồng → 1 lead), sow46 chỉ lịch, trần mềm giữ lease,
     bọc lỗi từng bài, circuit-breaker, badreq hệ thống → defer, cửa sổ 15′ (1 bài/lượt ×2 → DOWN, cần 2 OK → UP), [LLM-PRE-DOWN]/[LLM-PRE-UP], sweeper PB-5 (human giữ cold + ai_flag, base_score, lease, badreq <24h, touches),
     nokey → không sweeper + [LLM-DOWN] nokey, eKYC bỏ lead lạnh + quét-vét bỏ zalo_defer, miss-reply → replyOnly48, lượt ném lỗi → scans aborted, nguồn tắt tạm → giữ 6 h/7 ngày, lead có author_uid.
   L48_EXPORT_DIR=<dir> → xuất fake ~/firebase-s13/functions (UNPATCHED) cho dry-run .sh rồi thoát. Chạy: node docs/harness-lenh48-2026-09-12.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, 'lenh-2026-09-12-48-fixture'), PATCH = path.join(HERE, 'lenh-2026-09-12-48-patch.cjs'), DUMP = path.join(HERE, 'lenh-2026-09-12-47-dump');
const cpDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) cpDir(s, d); else fs.copyFileSync(s, d); } };
if (process.env.L48_EXPORT_DIR) {
  const E = process.env.L48_EXPORT_DIR; cpDir(FX, E);
  fs.writeFileSync(path.join(E, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-5.6-sol\nLLM_PREFILTER_MODEL=gpt-5-nano\nLLM_TRIES=1\nLLM_TIMEOUT_MS=5000\n');
  console.log('exported fake functions dir (UNPATCHED) →', E); process.exit(0);
}
const OUT = console.log.bind(console); /* giữ console gốc — phần sau bắt console để đọc log của mã */
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; OUT('  ✓', m); } else { fail++; OUT('  ✗', m); } };
const run = (cwd, args) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
const FILES = ['lib/config.js', 'lib/scorer.js', 'lib/scraper.js', 'index.js'];

/* ---------- 0. patch: áp / idempotent / node --check / fail-closed nguyên tử / LỆCH ---------- */
OUT('-- patch');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'l48-')); cpDir(FX, W);
const r1 = run(W, [PATCH, ...FILES]); ok(r1.code === 0 && /PATCH OK 4 file/.test(r1.out), 'patch áp trên fixture: PATCH OK 4 file');
const r2 = run(W, [PATCH, ...FILES]); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of FILES) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f); }
{ const W2 = fs.mkdtempSync(path.join(os.tmpdir(), 'l48b-')); cpDir(FX, W2); const f = path.join(W2, 'lib/scraper.js'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("    user_url:  c.user_url || c.commenter_url || c.commenter_profile_url || '',", "    user_url:  c.user_url || c.commenter_url || '',"));
  const before = ['lib/config.js', 'lib/scorer.js', 'index.js'].map(x => fs.readFileSync(path.join(W2, x), 'utf8'));
  const r = run(W2, [PATCH, ...FILES]); const same = ['lib/config.js', 'lib/scorer.js', 'index.js'].every((x, i) => fs.readFileSync(path.join(W2, x), 'utf8') === before[i]);
  ok(r.code === 1 && /KHONG THAY MOC lib\/scraper.js\/SR2/.test(r.out) && same, 'fail-closed NGUYÊN TỬ: thiếu 1 mốc scraper.js → exit 1, KHÔNG ghi file nào'); }
{ const W3 = fs.mkdtempSync(path.join(os.tmpdir(), 'l48c-')); cpDir(W, W3); fs.writeFileSync(path.join(W3, 'lib/config.js'), fs.readFileSync(path.join(FX, 'lib/config.js'), 'utf8')); const r = run(W3, [PATCH, ...FILES]); ok(r.code === 1 && /LỆCH/.test(r.out), 'lệch (3 file đã patch, config.js chưa) → báo LỆCH, dừng'); }
/* mốc đối chiếu văn bản DUMP (mã đang chạy) — mỗi mốc đúng 1 lần */
{ const lines = { 'index.js': {}, 'lib/scorer.js': {}, 'lib/scraper.js': {}, 'lib/config.js': {} };
  for (const fn of ['scan-dump-0912.txt', 'scan-dump-0912d.txt']) { let cur = null; for (const raw of fs.readFileSync(path.join(DUMP, fn), 'latin1').split('\n')) {
      if (/^(-----|--- |== )/.test(raw)) { cur = null; if (/zalo-fn|codebase2|tagLeadBrand/.test(raw)) continue; for (const k of Object.keys(lines)) if (raw.includes(k)) cur = k; if (!cur && /index\.js (dòng|scanAll|::)/.test(raw)) cur = 'index.js'; continue; }
      const m = /^\s*(\d+)\t(.*)$/.exec(raw); if (m && cur) lines[cur][Number(m[1])] = Buffer.from(m[2], 'latin1').toString('utf8'); } }
  const txt = k => Object.keys(lines[k]).map(Number).sort((a, b) => a - b).map(n => lines[k][n]).join('\n');
  const T = { config: txt('lib/config.js'), scorer: txt('lib/scorer.js'), scraper: txt('lib/scraper.js'), index: txt('index.js') };
  const anch = JSON.parse(run(W, [PATCH, '--anchors']).out); let n = 0, bad = [];
  for (const [g, m] of Object.entries(anch)) for (const [k, a] of Object.entries(m)) { n++; const c = T[g].split(a).length - 1; if (c !== 1) bad.push(g + '/' + k + '=' + c); }
  ok(n >= 50 && !bad.length, n + ' mốc đối chiếu VĂN BẢN DUMP (mã đang chạy): mỗi mốc đúng 1 lần' + (bad.length ? ' — LỆCH ' + bad.join(', ') : '')); }

/* ---------- chuẩn bị chạy mã đã vá ---------- */
const AsyncFn = Object.getPrototypeOf(async function () {}).constructor; void AsyncFn;
const stub = await import(pathToFileURL(path.join(W, 'stub48.mjs')).href);
const CFG = (await import(pathToFileURL(path.join(W, 'lib/config.js')).href)).CFG;
const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href);
const sr = await import(pathToFileURL(path.join(W, 'lib/scraper.js')).href);
const cfg = sc.scoreLead.cfg46, H = sc.scoreLead.health46;
Object.assign(CFG, { LLM_API_KEY: 'test-key', LLM_MODEL: 'gpt-5.6-sol', LLM_PREFILTER_MODEL: 'gpt-5-nano', SCAN_COMMENTS: false, BD_SOW_MODE: true, SCORE_CONCURRENCY: 1, PREFILTER_CONCURRENCY: 1, MIN_KEEP_SCORE: 40, HOT_THRESHOLD: 80, LOG_SCANNED_POSTS: true, SCANNED_TTL_DAYS: 3, POSTS_PER_GROUP: 20, PROBE_POSTS: 5, FULLSWEEP_HOURS: 2, SCAN_SOURCE_INTERVAL_MIN: 10 });
cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300; cfg.budgetMs = 100000;
/* đồng hồ giả + console bắt log */
const realNow = Date.now; let clockOff = 0; Date.now = () => realNow() + clockOff;
const LOGS = []; for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); if (process.env.L48_VERBOSE) o(...a); }; }
const logHas = re => LOGS.some(l => re.test(l));
/* fetch giả cho LLM: điều phối theo model */
let calls = []; let route = { pre: () => good({ maybe: true }), main: () => good(LEAD) };
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: h => (r.headers || {})[h] || null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body) });
const good = (obj, extra) => Object.assign({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, completion_tokens_details: { reasoning_tokens: 3 } }, model: 'gpt-test' } }, extra || {});
const err = (status, code, type, message, headers) => ({ status, body: { error: { code, type, message } }, headers });
const LEAD = { is_real_lead: true, hotness: 85, intent: 'cần mua gấp', need: 'mua 20 kg mực khô', industry: 'Hải sản', service: 'Mực khô', reply: 'Chào anh, bên em có mực khô loại 1 ạ.', role: 'buyer', role_reason: 'hỏi mua' };
globalThis.fetch = async (url, opt) => { const body = JSON.parse(opt.body); calls.push({ url, body, opt }); const isPre = body.model === CFG.LLM_PREFILTER_MODEL; const h = isPre ? route.pre : route.main; const r = await h(body, opt); return typeof r === 'function' ? r(opt) : mk(r); };
const attempt = async fn => { try { return { v: await fn() }; } catch (e) { return { e }; } };

/* ---------- A. scorer.js ---------- */
OUT('-- scorer.js (PB-3 / PB-5b / replyOnly48)');
const post = { kind: 'post', text: 'Cần mua 20kg mực khô rim me ship Hà Nội, ai có báo giá', author: 'Khách A', post_id: 'p1' }, src = { industry: 'Hải sản', name: 'S1' };
ok(cfg.timeoutMs === 300 && cfg.budgetMs === 100000 && cfg.reasoning === 'low' && cfg.maxTokens === 2000 && cfg.tries === 4, 'cfg46: reasoning low · maxTokens 2000 · tries 4 (timeout/budget do harness đặt)');
calls = []; route.main = () => good(LEAD); let r = await attempt(() => sc.scoreLead(post, src, [], null));
ok(r.v && calls.length === 1 && calls[0].body.reasoning_effort === 'low' && calls[0].body.max_completion_tokens === 2000 && r.v._usage.reasoning === 3, 'gpt-5.6-sol → body có reasoning_effort=low + max_completion_tokens=2000; usage.reasoning đọc từ completion_tokens_details');
{ const bak = CFG.LLM_MODEL; CFG.LLM_MODEL = 'gpt-4o-mini'; calls = []; r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && calls.length === 1 && !('reasoning_effort' in calls[0].body) && !('max_completion_tokens' in calls[0].body), 'gpt-4o-mini → KHÔNG gửi reasoning_effort/max_completion_tokens'); CFG.LLM_MODEL = bak; }
calls = []; { let n = 0; route.main = () => (++n === 1) ? err(400, 'unsupported_parameter', 'invalid_request_error', "Unsupported parameter: 'reasoning_effort' is not supported with this model.") : good(LEAD); }
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && calls.length === 2 && calls[0].body.reasoning_effort && !('reasoning_effort' in calls[1].body) && calls[1].body.response_format, 'API từ chối reasoning_effort → gửi lại KHÔNG kèm (vẫn json mode) → OK');
calls = []; { let n = 0; route.main = () => (++n === 1) ? good(LEAD, { body: { choices: [{ message: { content: '' }, finish_reason: 'length' }], usage: {} } }) : good(LEAD); }
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.v && calls.length === 2 && calls[1].body.max_completion_tokens === 4000, 'finish=length → nới max_completion_tokens gấp đôi 1 lần → OK');
calls = []; route.main = () => ({ status: 200, body: { choices: [{ message: { content: 'không phải json' }, finish_reason: 'stop' }], usage: {} } });
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'format' && calls.length === 2, 'JSON hỏng → thử lại ĐÚNG 1 lần (2 lượt gọi, không 4)');
calls = []; route.main = () => err(400, null, 'invalid_request_error', 'Invalid body: failed to parse JSON value');
r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'badreq' && calls.length === 2 && calls[0].body.response_format && !calls[1].body.response_format, '400 bất kỳ → thử 1 lần KHÔNG json mode → vẫn 400 → kind badreq (2 lượt)');
{ const b0 = cfg.budgetMs, w0 = cfg.waits; cfg.budgetMs = 10000; cfg.waits = [20000]; calls = []; route.main = () => err(500, null, 'server_error', 'x');
  r = await attempt(() => sc.scoreLead(post, src, [], null)); ok(r.e && r.e.kind === 'server' && calls.length === 1, 'ngân sách thời gian/bài: chờ kế vượt budget → dừng thử lại (1 lượt) thay vì 4×'); cfg.budgetMs = b0; cfg.waits = w0; }
calls = []; route.main = () => good(LEAD); r = await attempt(() => sc.prefilterLead(post, null, { tries: 1 })); calls = []; route.pre = () => err(500, null, null, 'x');
r = await attempt(() => sc.prefilterLead(post, null, { tries: 1 })); ok(r.v && r.v.maybe === true && r.v._llm === false && calls.length === 1, 'prefilterLead opts.tries=1 → 1 lượt rồi fail-open (circuit-breaker)'); route.pre = () => good({ maybe: true });
{ const AI = { nganh: 'Hải sản khô', dichvu: 'Mực khô rim me, cá lóc khô tẩm ớt, tôm khô', khach: 'người mua lẻ và quán ăn cần hải sản khô ngon' };
  const kw = sc.scoreLead.brandKw48(AI); const h1 = sc.scoreLead.heuristic46({ text: 'ai bán mực khô rim me ngon không, mình muốn mua ít' }, src, AI), h0 = sc.scoreLead.heuristic46({ text: 'ai bán mực khô rim me ngon không, mình muốn mua ít' }, src, null);
  ok(kw.includes('mực khô') && kw.includes('cá lóc') && !kw.includes('và của') && kw.length <= 80, 'brandKw48: bigram từ Hồ sơ AI ("mực khô", "cá lóc"), bỏ từ dừng, ≤80'); 
  ok(h1.hotness > h0.hotness && h1.hotness <= 59 && h1.service === '' && h0.service === 'Performance Marketing', 'heuristic theo brand: khớp lĩnh vực → điểm cao hơn (vẫn kẹp ≤59), service KHÔNG gán "Performance Marketing" khi có Hồ sơ AI'); }
{ const bak = CFG.LLM_API_KEY; CFG.LLM_API_KEY = ''; calls = []; r = await attempt(() => sc.scoreLead({ kind: 'post', text: 'Thuê mb chỉ 5 triệu trung tâm thị xã, ae cho lời khuyên', post_id: 'x' }, src, [], null));
  ok(r.v && r.v.hotness <= 59 && r.v._llm === false && r.v._nokey === true && r.v._fallback === true && calls.length === 0, 'không key → điểm tạm KẸP ≤59 + _nokey (trước: 90 điểm NÓNG)'); CFG.LLM_API_KEY = bak; }
calls = []; route.main = () => good({ reply: 'Dạ chào anh, bên em có mực khô rim me loại 1, anh cần bao nhiêu kg ạ?' });
r = await attempt(() => sc.scoreLead.replyOnly48(post, src, null, { need: 'mua 20 kg mực khô', intent: 'gấp', role: 'buyer', industry: 'Hải sản', service: 'Mực khô' }));
ok(r.v && r.v.reply.length > 10 && calls.length === 1 && calls[0].body.messages[1].content.includes('mua 20 kg mực khô') && !calls[0].body.messages[1].content.includes('ship Hà Nội') && calls[0].body.max_completion_tokens === 600, 'replyOnly48: 1 lượt, prompt = nhu cầu đã cấu trúc (KHÔNG text thô của bài), maxTokens 600');

/* ---------- B. scraper.js ---------- */
OUT('-- scraper.js (profile_id / commentator_profile_url)');
{ const p = sr.normalizePost({ post_id: '2182424042305431', url: 'https://www.facebook.com/groups/vieclamtotchosv/posts/2182424042305431/', content: 'x', profile_id: '1000123456789012', group_id: '1189400231607822', num_comments: 3 }, { name: 'S1' });
  ok(p.user_url === 'https://www.facebook.com/profile.php?id=1000123456789012' && p.author_uid === '1000123456789012' && p.num_comments === 3 && p.gid === '1189400231607822', 'normalizePost: profile_id số → user_url profile.php?id + author_uid; num_comments/gid giữ'); 
  const p2 = sr.normalizePost({ post_id: '1', url: 'u', content: 'x', profile_id: 'abc' }, { name: 'S1' }); ok(p2.user_url === '' && p2.author_uid === '', 'normalizePost: profile_id không phải số → không bịa link');
  const p3 = sr.normalizePost({ post_id: '1', url: 'u', content: 'x', user_url: 'https://www.facebook.com/people/Nguyen-A/100012345678901/?__cft__[0]=abc', profile_id: '999' }, { name: 'S1' }); ok(p3.user_url === 'https://www.facebook.com/people/Nguyen-A/100012345678901' && p3.author_uid === '100012345678901', 'normalizePost: có user_url dạng /people/<tên>/<uid>/?tracking → cắt tracking + uid');
  const c1 = sr.normalizeComment({ comment_id: 'Y29tbWVudDoyMTgyNDE4NTE4OTcyNjUwXzIxODI0MTg2MzU2MzkzMDU=', comment_text: 'Giá', commentator_profile_url: 'https://www.facebook.com/groups/1189400231607822/user/100012345678901/?__cft__[0]=AZW&__tn__=R]-R', user_id: 'pfbid02abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef', user_name: 'Hien' }, { name: 'S1' }, 'https://www.facebook.com/groups/vieclamtotchosv/posts/2182418518972650/?locale=en_US');
  ok(c1.user_url === 'https://www.facebook.com/groups/1189400231607822/user/100012345678901' && c1.author_uid === '100012345678901' && c1.comment_id === '2182418635639305', 'normalizeComment: commentator_profile_url /groups/<gid>/user/<uid>/?__cft__ → cắt tracking + uid; comment_id base64 → số');
  const c2 = sr.normalizeComment({ comment_id: '1', comment_text: 'Ib', commentator_profile_url: 'https://www.facebook.com/profile.php?id=100012345678901&sk=about&__cft__[0]=x', user_id: 'pfbid0X' }, { name: 'S1' }, 'https://www.facebook.com/groups/g/posts/1/');
  ok(c2.user_url === 'https://www.facebook.com/profile.php?id=100012345678901' && c2.author_uid === '100012345678901', 'normalizeComment: profile.php?id=<uid>&sk=… → giữ id, bỏ tham số khác');
  const c3 = sr.normalizeComment({ comment_id: '2', comment_text: 'Ib', user_id: 'pfbid02abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef' }, { name: 'S1' }, 'https://www.facebook.com/groups/g/posts/1/');
  ok(c3.user_url === 'https://www.facebook.com/profile.php?id=pfbid02abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef' && c3.author_uid === '', 'normalizeComment: chỉ có user_id = pfbid → link dự phòng profile.php?id=pfbid…, author_uid rỗng');
  const c4 = sr.normalizeComment({ comment_id: '3', comment_text: 'x', commentator_profile_url: 'https://www.facebook.com/people/T%C3%AAn/100055556666777/?mibextid=abc' }, { name: 'S1' }, 'u'); ok(c4.author_uid === '100055556666777' && !/\?/.test(c4.user_url), 'normalizeComment: /people/<tên>/<uid>/?mibextid → uid + link sạch'); }

/* ---------- C. index.js — scanAll trọn vẹn trên Firestore giả ---------- */
OUT('-- index.js scanAll (lease · seen create · transaction · trần mềm · breaker · badreq · cửa sổ · sweeper · eKYC · miss-reply · aborted)');
const ixm = await import(pathToFileURL(path.join(W, 'index.js')).href);
const SRC = { name: 'S1', url: 'https://www.facebook.com/groups/1189400231607822/', brand: 'b1', active: true, industry: 'Hải sản' };
const mkPost = (i, extra) => Object.assign({ post_id: 'p' + i, url: SRC.url + 'posts/p' + i + '/', author: 'Khách ' + i, user_url: 'https://www.facebook.com/profile.php?id=10001234567890' + i, author_uid: '10001234567890' + i, text: 'Cần mua ' + (10 + i) + 'kg mực khô rim me, ai có báo giá', time: new Date().toISOString(), source: 'S1', kind: 'post' }, extra || {});
let F, posts = [], zaloCalls = 0, enrichHook = null;
function fresh(opts) {
  F = stub.makeDb(); opts = opts || {}; LOGS.length = 0; calls = []; zaloCalls = 0; enrichHook = null;
  F.db.collection('sources').doc('s1').set(SRC); F.db.collection('config').doc('app').set({ aiMode: opts.aiMode || 'saver', scanComments: false });
  globalThis.__sl48 = { db: F.db, fetchPosts: async (s, o) => { const arr = (o && o.numPosts === CFG.POSTS_PER_GROUP && !o.sow) ? [] : posts.slice(); arr.bd = 'ok'; return arr; }, fetchComments: async () => [], harvestComments: async () => ({ items: [], metas: [], harvested: 0, pending: 0, failed: 0 }), isExcluded: () => false,
    enrichPhoneFromText: async (text, o) => { if (enrichHook) await enrichHook(text, o); const m = /0\d{9}/.exec(String(text || '')); if (!m) return { phone: '', phone_has_zalo: null, email: '' }; if (!o.doCheck) return { phone: '+84' + m[0].slice(1), phone_has_zalo: null, email: '' }; zaloCalls++; return { phone: '+84' + m[0].slice(1), phone_has_zalo: true, email: '' }; },
    checkZalo: async () => { zaloCalls++; return { registered: true }; }, brandAiOf: () => opts.brandAi || null };
  route = { pre: () => good({ maybe: true }), main: () => good(LEAD) }; clockOff = 0;
  return F;
}
const leads = () => [...F.store.entries()].filter(([k]) => /^leads\/[^/]+$/.test(k)).map(([k, v]) => Object.assign({ id: k.slice(6) }, v));
const retries = () => [...F.store.entries()].filter(([k]) => k.startsWith('score_retry/')).map(([k, v]) => Object.assign({ id: k.slice(12) }, v));
const scansLast = () => { const s = [...F.store.entries()].filter(([k]) => k.startsWith('scans/')).map(([, v]) => v); return s[s.length - 1]; };
const spDec = () => [...F.store.entries()].filter(([k]) => k.startsWith('scanned_posts/')).map(([, v]) => v.decision);
const sysDoc = id => F.store.get('system_status/' + id);

/* C1. lượt lịch bình thường */
fresh(); posts = [mkPost(1), mkPost(2), mkPost(3)];
let sum = await ixm.scanAll('scheduled');
{ const L = leads(), sc1 = scansLast();
  ok(sum.kept === 3 && L.length === 3 && L.every(l => l.author_uid && /profile\.php\?id=\d+/.test(l.author_url)), 'C1 lượt lịch: 3 bài → 3 lead có author_url + author_uid');
  if (process.env.L48_DBG) OUT('DBG C1', JSON.stringify({ creates: F.log.creates, retries: retries().map(r => r.id + ':' + r.kind), sc1: { leased: sc1.leased, status: sc1.status, runId: sc1.runId, model: sc1.model, tokensReasoning: sc1.tokensReasoning, seenRace: sc1.seenRace } }));
  ok(F.log.creates.filter(k => k.startsWith('seen/')).length === 3 && retries().length === 0 && sc1.leased === 3 && sc1.status === 'done' && typeof sc1.runId === 'string' && sc1.model === 'gpt-5.6-sol' && sc1.tokensReasoning === 9, 'C1 seen ghi bằng create() ×3 · lease ghi 3 rồi XOÁ hết sau khi chấm · scans {leased 3, status done, runId, model, tokensReasoning 9}');
  ok(sysDoc('scan') && sysDoc('scan').phase === 'done' && sysDoc('scan').lastLeads === 3 && sysDoc('llm') && sysDoc('llm').ok === true && Array.isArray(sysDoc('llm').win) && sysDoc('llm').win[0].ok === 3 && sysDoc('llm').pre === true, 'C1 system_status/scan phase done · system_status/llm ok + cửa sổ win[0].ok=3 + pre true'); }
/* C2. LLM 500 toàn bộ → defer + breaker */
fresh(); posts = [1, 2, 3, 4, 5].map(i => mkPost(i)); route.main = () => err(500, null, 'server_error', 'The server had an error');
sum = await ixm.scanAll('scheduled');
{ const R = retries(), sc1 = scansLast(), mainCalls = calls.filter(c => c.body.model === 'gpt-5.6-sol').length;
  ok(leads().length === 0 && R.length === 5 && R.every(x => x.kind === 'server' && x.tries === 1 && !x.leaseBy) && spDec().filter(d => d === 'ai_wait').length === 5, 'C2 LLM 500: 0 lead · 5 bài vào score_retry (kind server, tries 1 — doc lease đã thành doc chờ) · scanned_posts ai_wait ×5');
  ok(mainCalls === 3 * 4 + 2 * 1 && sc1.cbOpen === true && logHas(/\[LLM-CB\]/), 'C2 circuit-breaker: 3 bài đầu 4 lượt, 2 bài sau 1 lượt (14 lượt gọi) · scans.cbOpen · log [LLM-CB]');
  ok(sysDoc('llm').ok === false && logHas(/"severity":"ERROR".*\[LLM-DOWN\]/) && sc1.llmDeferred === 5 && sc1.llmFail === 5, 'C2 [LLM-DOWN] ERROR + system_status/llm ok:false · scans llmDeferred 5'); }
/* C3. lượt lịch sau: nạp score_retry bằng transaction → chấm OK → [LLM-UP] */
clockOff = 4 * 60e3; posts = []; route.main = () => good(LEAD); calls = []; LOGS.length = 0;
sum = await ixm.scanAll('scheduled');
{ const sc1 = scansLast(); ok(leads().length === 5 && retries().length === 0 && sc1.llmRescored === 5 && F.log.writes.some(k => k.startsWith('score_retry/')) , 'C3 lượt sau: nạp 5 bài chờ (lease 15′ qua transaction) → 5 lead, score_retry rỗng, scans.llmRescored 5');
  ok(sysDoc('llm').ok === true && logHas(/\[LLM-UP\]/), 'C3 cửa sổ: 5 OK ≥ 2 → [LLM-UP], ok:true'); }
/* C4. Quét ngay (manual) KHÔNG nạp score_retry / KHÔNG sweeper */
fresh(); posts = []; F.db.collection('score_retry').doc('R_q1').set({ post: mkPost(9), src: { url: SRC.url, name: 'S1' }, tries: 1, firstAt: Date.now() - 6e5, nextAt: Date.now() - 1000, kind: 'server' });
F.db.collection('leads').doc('Lx').set({ ai_scored: false, score: 50, temp: 'cold', text: 'x', source: 'S1', brand: 'b1', detected_at: Date.now(), stage: 'new' });
sum = await ixm.scanAll('manual', { force: false });
ok(leads().length === 1 && retries().length === 1 && !retries()[0].leaseBy && !leads()[0].rescored_at, 'C4 trigger manual: sow46=false → không đụng score_retry, không chấm lại điểm tạm (Quét ngay không chồng việc lượt lịch)');
/* C5. 2 lượt lịch CHỒNG NHAU trên cùng 1 bài chờ → đúng 1 lead */
fresh(); posts = []; F.db.collection('score_retry').doc('R_c1').set({ post: mkPost(7), src: { url: SRC.url, name: 'S1' }, tries: 1, firstAt: Date.now() - 6e5, nextAt: Date.now() - 1000, kind: 'server' });
route.main = async () => { await new Promise(r => setTimeout(r, 30)); return good(LEAD); };
await Promise.all([ixm.scanAll('scheduled'), ixm.scanAll('scheduled')]);
ok(leads().length === 1 && retries().length === 0 && calls.filter(c => c.body.model === 'gpt-5.6-sol').length === 1, 'C5 2 lượt chồng cùng 1 bài chờ: transaction lease → chỉ 1 lượt chấm → 1 lead, 1 lượt gọi AI (hết chấm đôi/lead trùng)');
/* C6. seen ALREADY_EXISTS (lượt khác ghi seen p2 trước khi commit) */
fresh(); posts = [mkPost(1), mkPost(2), mkPost(3)]; let raced = false; F.hooks.beforeBatchCommit = async ops => { if (!raced && ops.some(o => o.t === 'create' && o.col === 'seen')) { raced = true; await F.db.collection('seen').doc('p2').set({ at: 1, run: 'other' }); } };
sum = await ixm.scanAll('scheduled');
if (process.env.L48_DBG) { const sc1 = scansLast(); OUT('DBG C6', JSON.stringify({ leads: leads().map(l => l.post_url), seenRace: sc1.seenRace, skippedSeen: sc1.skippedSeen, retries: retries().map(r => r.id), creates: F.log.creates.filter(k => k.startsWith('seen/')), logs: LOGS.filter(l => /seen|\[pipe\]|race/i.test(l)).slice(0, 8) })); }
{ const sc1 = scansLast(); ok(leads().length === 2 && !leads().some(l => l.post_url.endsWith('/p2/')) && sc1.seenRace === 1 && sc1.skippedSeen === 1 && retries().length === 0 && F.log.creates.filter(k => k.startsWith('seen/')).length === 2, 'C6 seen create() ALREADY_EXISTS → đọc lại, bỏ p2 (lượt khác đã nhận), ghi lại p1/p3 → 2 lead, scans.seenRace 1, lease rỗng'); }
/* C7. trần mềm: quá SCAN_SOFT_DEADLINE_S → giữ lease, lượt sau chấm */
fresh(); posts = [mkPost(1), mkPost(2), mkPost(3)]; { const s0 = CFG.SCAN_SOFT_DEADLINE_S; CFG.SCAN_SOFT_DEADLINE_S = 120; let first = true; route.pre = () => { if (first) { first = false; clockOff += 200e3; } return good({ maybe: true }); };
  sum = await ixm.scanAll('scheduled'); const sc1 = scansLast(), R = retries();
  ok(leads().length === 0 && R.length === 3 && R.every(x => x.kind === 'lease' && x.tries === 0) && sc1.softStop === 3 && sc1.status === 'done', 'C7 quá trần mềm giữa lượt: bài còn lại KHÔNG chấm, 3 lease giữ nguyên (kind lease), scans.softStop 3');
  CFG.SCAN_SOFT_DEADLINE_S = s0; route.pre = () => good({ maybe: true }); clockOff += 31 * 60e3; posts = []; sum = await ixm.scanAll('scheduled');
  ok(leads().length === 3 && retries().length === 0, 'C7 lượt lịch 31′ sau: nạp 3 lease tới hạn → chấm → 3 lead (không mất bài, không cần BrightData lấy lại)'); }
/* C8. lỗi ngoài LLM (eKYC ném) → chỉ bài đó lỗi, lease giữ */
fresh(); posts = [mkPost(1), mkPost(2), mkPost(3)]; enrichHook = async text => { if (/12kg|19kg/.test(text)) throw new Error('eKYC boom'); };
F.db.collection('score_retry').doc('R_p9').set({ post: mkPost(9), src: { url: SRC.url, name: 'S1' }, tries: 1, firstAt: Date.now() - 3600e3, nextAt: Date.now() - 1000, kind: 'server' });
sum = await ixm.scanAll('scheduled');
if (process.env.L48_DBG) { const sc1 = scansLast(), R = retries(); OUT('DBG C8', JSON.stringify({ leads: leads().map(l => l.post_url), R: R.map(r => r.id + ':' + r.kind), pipeErrors: sc1.pipeErrors, spDec: spDec(), logs: LOGS.filter(l => /pipe|boom|lỗi/i.test(l)).slice(0, 8) })); }
{ const sc1 = scansLast(), R = retries(); ok(leads().length === 2 && R.length === 2 && R.some(r => r.id === 'R_p2' && r.kind === 'lease') && R.some(r => r.id === 'R_p9' && r.kind === 'server' && r.leaseBy) && sc1.pipeErrors === 2 && spDec().includes('error') && logHas(/\[pipe\]/), 'C8 bọc lỗi từng bài: eKYC ném ở p2 (mới) + p9 (bài chờ) → p1/p3 vẫn thành lead, p2 giữ lease + p9 giữ doc chờ (chấm lại sau), scans.pipeErrors 2'); }
/* C9. badreq hệ thống */
fresh(); posts = [mkPost(1), mkPost(2), mkPost(3)]; route.main = () => err(400, null, 'invalid_request_error', 'Invalid value for max_tokens');
sum = await ixm.scanAll('scheduled');
{ const L = leads(), R = retries(), sc1 = scansLast(); ok(L.length === 1 && L[0].ai_scored === false && L[0].score <= 59 && R.length === 2 && R.every(x => x.kind === 'badreq') && sc1.badreq === 3 && sysDoc('llm').ok === false && sysDoc('llm').kind === 'badreq', 'C9 400 lặp: bài 1 dự phòng kẹp ≤59, từ bài 2 = lỗi hệ thống → xếp hàng (không đẻ lead heuristic mỗi bài) · [LLM-DOWN] kind badreq'); }
/* C10. cửa sổ trượt: 1 bài/lượt × 2 lượt hỏng → DOWN; cần 2 OK → UP */
fresh(); { const t0 = cfg.tries; cfg.tries = 1; route.main = () => err(500, null, null, 'x'); posts = [mkPost(1)]; await ixm.scanAll('scheduled'); const d1 = sysDoc('llm');
  posts = [mkPost(2)]; await ixm.scanAll('scheduled'); const d2 = sysDoc('llm'); const downLogged = logHas(/\[LLM-DOWN\]/);
  route.main = () => good(LEAD); posts = [mkPost(3)]; await ixm.scanAll('scheduled'); const d3 = sysDoc('llm');
  posts = [mkPost(4)]; await ixm.scanAll('scheduled'); const d4 = sysDoc('llm'); cfg.tries = t0;
  if (process.env.L48_DBG) OUT('DBG C10a', JSON.stringify({ d1, d2, downLogged, keys: [...F.store.keys()], logs: LOGS.slice(0, 40) }));
  ok((!d1 || d1.ok !== false) && d2 && d2.ok === false && downLogged, 'C10 cửa sổ 15′: lượt 1 (1 bài hỏng) chưa DOWN · lượt 2 (tổng 2 hỏng/0 OK) → DOWN (trước đây ngưỡng theo LƯỢT không bao giờ kích khi 1 bài/lượt)');
  if (process.env.L48_DBG) OUT('DBG C10b', JSON.stringify({ d3, d4, logs: LOGS.filter(l => /LLM-/.test(l)).slice(0, 8) }));
  ok(d3.ok === false && d4.ok === true && logHas(/\[LLM-UP\]/), 'C10 hysteresis: 1 OK chưa UP, 2 OK → UP'); }
/* C11. tầng 1 hỏng → [LLM-PRE-DOWN] WARNING, vẫn fail-open; hồi → [LLM-PRE-UP] */
fresh(); posts = [mkPost(1), mkPost(2), mkPost(3)]; route.pre = () => err(404, 'model_not_found', 'invalid_request_error', 'The model `gpt-5-nano` does not exist');
await ixm.scanAll('scheduled');
ok(leads().length === 3 && sysDoc('llm').pre === false && logHas(/"severity":"WARNING".*\[LLM-PRE-DOWN\]/) && scansLast().llmPreFail === 3 && sysDoc('llm').ok === true, 'C11 tầng 1 lỗi 3 bài/0 OK → llm.pre=false + WARNING [LLM-PRE-DOWN]; vẫn fail-open (3 lead), tầng 2 ok');
route.pre = () => good({ maybe: true }); posts = [mkPost(4)]; await ixm.scanAll('scheduled'); ok(sysDoc('llm').pre === true && logHas(/\[LLM-PRE-UP\]/) && scansLast().llmPreOk === 1, 'C11 tầng 1 OK trở lại → pre=true + [LLM-PRE-UP], scans.llmPreOk');
/* C12. sweeper PB-5 */
fresh({ brandAi: null }); posts = []; const now = Date.now();
const seedLead = (id, extra) => F.db.collection('leads').doc(id).set(Object.assign({ ai_scored: false, score: 55, temp: 'cold', text: 'Cần mua mực khô', name: 'K', source: 'S1', brand: 'b1', detected_at: now - 3600e3, stage: 'new', kind: 'post' }, extra));
seedLead('L1', { first_care_at: now - 1000 }); seedLead('L2', {}); seedLead('L3', { rescore_lease: now + 5 * 60e3 }); seedLead('L4', { rescore_err: 'LLM 400 invalid_request_error: Invalid body', rescore_at: now - 3600e3 }); seedLead('L5', { group_count: 2, touches: [{ text: 'lần chạm A mực khô' }, { text: 'lần chạm B cá khô' }] }); seedLead('L6', { ai_flag: 'not_lead', first_care_at: now - 1000 });
route.main = body => { const u = body.messages[1].content; if (/lần chạm A/.test(u)) return good(LEAD); if (/L6/.test(u)) return good(LEAD); return good(Object.assign({}, LEAD, { is_real_lead: false, hotness: 20, role: 'other' })); };
{ const c0 = calls.length; F.db.collection('leads').doc('L6').set({ text: 'L6 cần mua mực khô' }, { merge: true }); await ixm.scanAll('scheduled'); const L = Object.fromEntries(leads().map(l => [l.id, l])); const sc1 = scansLast();
  ok(L.L1.temp === 'cold' && L.L1.score === 20 && L.L1.ai_flag === 'not_lead' && !L.L1.dropped && L.L1.base_score === 20 && L.L1.ai_scored === true && !('rescore_lease' in L.L1), 'C12 sales đang chăm + AI nói không phải lead (20) → GIỮ temp cold (không junk → web không ẩn) + ai_flag not_lead + base_score, lease đã gỡ');
  ok(L.L2.dropped === true && L.L2.dropped_by === 'rescore' && L.L3.ai_scored === false && !L.L3.rescored_at && L.L4.ai_scored === false && !L.L4.rescored_at, 'C12 không ai chăm → loại (như #46) · L3 đang lease → bỏ qua · L4 lỗi 400 <24 h → bỏ qua');
  ok(L.L5.ai_scored === true && L.L5.score === 85 && calls.some(c => /lần chạm A[\s\S]*---[\s\S]*lần chạm B/.test(c.body.messages[1].content)) && L.L6.ai_scored === true && !('ai_flag' in L.L6) && L.L6.base_score === 85, 'C12 lead gộp 2 nhóm → AI chấm trên MỌI lần chạm (ghép "---") · lead có ai_flag cũ mà AI nói là lead → gỡ ai_flag'); void c0; void sc1; }
/* C13. không key → không sweeper, lead kẹp, [LLM-DOWN] nokey */
fresh(); { const bak = CFG.LLM_API_KEY; CFG.LLM_API_KEY = ''; posts = [mkPost(1)]; seedLead('Ln', {}); await ixm.scanAll('scheduled'); const L = leads(); const ln = L.find(l => l.id === 'Ln'), l1 = L.find(l => l.id !== 'Ln');
  ok(l1 && l1.ai_scored === false && l1.score <= 59 && ln.ai_scored === false && !ln.rescored_at && sysDoc('llm').ok === false && sysDoc('llm').kind === 'nokey' && logHas(/\[LLM-DOWN\].*nokey/), 'C13 thiếu LLM_API_KEY: lead mới = điểm tạm kẹp ≤59, sweeper KHÔNG chạy (không hợp thức hoá heuristic), [LLM-DOWN] kind nokey'); CFG.LLM_API_KEY = bak; }
/* C14. eKYC: nóng kiểm, lạnh hoãn; quét-vét bỏ zalo_defer chưa ai chăm */
fresh(); posts = [mkPost(1, { text: 'Cần mua mực khô, lh 0912345678' }), mkPost(2, { text: 'Hỏi giá mực khô 0987654321' })];
route.main = body => /0987654321/.test(body.messages[1].content) ? good(Object.assign({}, LEAD, { hotness: 45 })) : good(LEAD);
F.db.collection('leads').doc('Ld1').set({ phone: '+84900000001', phone_has_zalo: null, zalo_defer: true, source: 'S1', brand: 'b1' }); F.db.collection('leads').doc('Ld2').set({ phone: '+84900000002', phone_has_zalo: null, zalo_defer: true, assignee: 'u1', source: 'S1', brand: 'b1' });
{ zaloCalls = 0; await ixm.scanAll('scheduled'); const L = Object.fromEntries(leads().map(l => [l.phone, l]));
  ok(L['+84912345678'] && L['+84912345678'].zalo_defer === false && L['+84912345678'].phone_has_zalo === true && L['+84987654321'] && L['+84987654321'].zalo_defer === true && L['+84987654321'].phone_has_zalo === null, 'C14 lead NÓNG có SĐT → kiểm eKYC · lead LẠNH → zalo_defer:true, không kiểm (tiết kiệm eKYC ~40–50 % lead)');
  ok(F.store.get('leads/Ld1').phone_has_zalo === null && F.store.get('leads/Ld2').phone_has_zalo === true && zaloCalls === 2, 'C14 quét-vét: lead zalo_defer chưa ai chăm → bỏ qua; có assignee → kiểm (đúng 2 lượt eKYC cả lượt)'); }
/* C15. miss-reply → replyOnly48 */
fresh(); posts = [mkPost(1)]; route.main = body => (/DUY NHẤT JSON \{"reply"/.test(body.messages[0].content)) ? good({ reply: 'Dạ chào anh, bên em có sẵn mực khô ạ, anh cần loại nào?' }) : good(Object.assign({}, LEAD, { reply: '' }));
await ixm.scanAll('scheduled');
{ const mainCalls = calls.filter(c => c.body.model === 'gpt-5.6-sol'); ok(leads().length === 1 && /mực khô ạ/.test(leads()[0].reply) && mainCalls.length === 2 && mainCalls[1].body.max_completion_tokens === 600 && !mainCalls[1].body.messages[1].content.includes('11kg'), 'C15 model quên reply → gọi RIÊNG replyOnly48 1 lượt (không chấm lại toàn bài 2 lần, không text thô) → lead có reply'); }
/* C16. lượt ném lỗi → scans aborted + system_status/scan aborted + ERROR */
fresh(); { const real = F.db; globalThis.__sl48.db = new Proxy(real, { get(t, k) { if (k === 'collection') return c => { if (c === 'sources') throw new Error('boom sources'); return t.collection(c); }; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
  let threw = false; try { await ixm.scheduledScan(); } catch (e) { threw = /boom/.test(e.message); }
  const ab = [...F.store.entries()].filter(([k]) => k.startsWith('scans/')).map(([, v]) => v).find(v => v.status === 'aborted');
  ok(threw && ab && /boom sources/.test(ab.error) && sysDoc('scan').phase === 'aborted' && logHas(/"severity":"ERROR".*\[SCAN-ABORTED\]/), 'C16 scanAll ném lỗi → scheduledScan ghi scans {status:aborted} + system_status/scan aborted + log ERROR rồi ném tiếp'); globalThis.__sl48.db = real; }
/* C17. nguồn tắt tạm: giữ 6 h; quá 7 ngày → bỏ */
fresh(); posts = []; F.db.collection('score_retry').doc('R_g1').set({ post: mkPost(11), src: { url: 'https://www.facebook.com/groups/gone/', name: 'Gone' }, tries: 1, firstAt: Date.now() - 3600e3, nextAt: Date.now() - 1000, kind: 'server' });
F.db.collection('score_retry').doc('R_g2').set({ post: mkPost(12), src: { url: 'https://www.facebook.com/groups/gone/', name: 'Gone' }, tries: 3, firstAt: Date.now() - 8 * 86400e3, nextAt: Date.now() - 1000, kind: 'server' });
await ixm.scanAll('scheduled');
{ const R = Object.fromEntries(retries().map(x => [x.id, x])); ok(R.R_g1 && R.R_g1.nextAt > Date.now() + 5 * 3600e3 && /không còn bật/.test(R.R_g1.lastErr) && !R.R_g2 && leads().length === 0, 'C17 nguồn tạm tắt: bài chờ GIỮ + hoãn 6 h (trước: xoá ngay = mất bài); quá 7 ngày mới bỏ'); }
/* C18. Quét quá khứ (backfill) không lease-load, vẫn tạo lead + gỡ lease */
fresh(); posts = [mkPost(1)]; await ixm.scanAll('backfill', { startDate: '09-01-2026', endDate: '09-12-2026', rangeLabel: '7d' });
if (process.env.L48_DBG) OUT('DBG C18', JSON.stringify({ leads: leads().length, retries: retries().map(r => r.id + ':' + r.kind), scans: scansLast(), logs: LOGS.slice(-12) }));
ok(leads().length === 1 && retries().length === 0 && scansLast().status === 'done', 'C18 backfill: vẫn lease/gỡ lease bình thường, không nạp score_retry');

OUT('\n' + (fail ? '✗ FAIL ' + fail + ' / PASS ' + pass : '✓ PASS ' + pass + '/' + pass));
process.exit(fail ? 1 : 0);
