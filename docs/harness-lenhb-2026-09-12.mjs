/* Harness LỆNH B (12/09/2026) — chạy trên FIXTURE `lenh-2026-09-12-b-fixture` (= mã ĐANG CHẠY sau #48: index/scorer/scraper/config = fixture #48 + patch #48; outreach = fixture #46 + patch #46; stats/scanstats/multitouch/tagLeadBrand = dump #47/#47b/#47e)
   sau khi áp patch trong thư mục tạm. Kiểm:
   0. patch áp / idempotent / node --check 7 file + sources.js / fail-closed NGUYÊN TỬ / LỆCH · tag patch · rules script · DẪN XUẤT fixture = mã đang chạy (48-fixture+48-patch, 46-fixture+46-patch, dump) byte-identical + mỗi mốc đúng 1 lần
   A. scraper: postIdB (không Math.random) · gid số/slug · sowPostsB (1 trigger nhiều group, tham số riêng, notify, chunk) · harvestPostsB (chờ ≥ minAge, claim transaction, busy 429, failed, route theo group_id/input.url, học gid, record lỗi tính tiền)
   B. multitouch: gộp chỉ trong cùng brand · PC-4 vân tay văn bản
   C. index.js chạy TRỌN scanAll trên Firestore giả + BrightData giả: gieo gộp → gặt → fan-out 2 brand → seen.brands → lead id tất định + lead_links + brand_hint 2 bước · lượt thuần skip · khoá lượt (lịch bỏ, manual busy) · doc seen cũ + sharedAt · nhịp thích ứng/escalate/sweep start_date · bdwatch 2 OK + deepDue → deep sweep · busy · dup lead · score_retry theo brand · bình luận fan-out + num_comments gate + lastAt sau gieo · Quét ngay fan-out 1 trigger/group · watch_posts
   D. outreach.js: acquireLocksB first-come (apEnqueueFunnel + stepNick), skipped_shared retry khi hết hạn, người/bình luận khác không chặn, touched đóng, sweep44 nhả khoá
   E. stats.stopMachine nhả khoá · scanstats theo row.brand · sources.js createSource/sourceOnWrite/bdReady · tagLeadBrand brand_hint
   LB_EXPORT_DIR=<dir> → xuất fake ~/firebase-s13 + ~/codebase2 (UNPATCHED, kèm node_modules giả) cho dry-run .sh rồi thoát. Chạy: node docs/harness-lenhb-2026-09-12.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath, pathToFileURL } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, 'lenh-2026-09-12-b-fixture'), PATCH = path.join(HERE, 'lenh-2026-09-12-b-patch.cjs'), SRCJS = path.join(HERE, 'lenh-2026-09-12-b-sources.js'), TAGP = path.join(HERE, 'lenh-2026-09-12-b-tag-patch.cjs'), RULESP = path.join(HERE, 'lenh-2026-09-12-b-rules.cjs');
const FX48 = path.join(HERE, 'lenh-2026-09-12-48-fixture'), P48 = path.join(HERE, 'lenh-2026-09-12-48-patch.cjs'), FX46 = path.join(HERE, 'lenh-2026-09-11-46-fixture'), P46 = path.join(HERE, 'lenh-2026-09-11-46-patch.cjs'), DUMP = path.join(HERE, 'lenh-2026-09-12-47-dump');
const cpDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) cpDir(s, d); else fs.copyFileSync(s, d); } };
const FILES = ['lib/config.js', 'lib/scraper.js', 'index.js', 'outreach.js', 'stats.js', 'scanstats.js', 'lib/multitouch.js'];
const OUT = console.log.bind(console);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; OUT('  ✓', m); } else { fail++; OUT('  ✗', m); } };
const run = (cwd, args, env) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
/* node_modules giả (firebase-admin / firebase-functions) để import sources.js/stats.js ngoài Firebase */
function fakeNodeModules(dir) {
  const nm = path.join(dir, 'node_modules'); const stub = path.relative(path.join(nm, 'firebase-admin'), path.join(dir, 'stubB.mjs')).split(path.sep).join('/');
  fs.mkdirSync(path.join(nm, 'firebase-admin'), { recursive: true }); fs.mkdirSync(path.join(nm, 'firebase-functions', 'v2'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'firebase-admin', 'package.json'), JSON.stringify({ name: 'firebase-admin', type: 'module', exports: { './app': './app.js', './firestore': './firestore.js', './auth': './auth.js', './messaging': './messaging.js' } }));
  for (const f of ['app', 'firestore', 'auth', 'messaging']) fs.writeFileSync(path.join(nm, 'firebase-admin', f + '.js'), "export * from '" + stub + "';\n");
  const stub2 = path.relative(path.join(nm, 'firebase-functions', 'v2'), path.join(dir, 'stubB.mjs')).split(path.sep).join('/');
  fs.writeFileSync(path.join(nm, 'firebase-functions', 'package.json'), JSON.stringify({ name: 'firebase-functions', type: 'module', exports: { './v2': './v2/index.js', './v2/https': './v2/https.js', './v2/firestore': './v2/firestore.js', './v2/scheduler': './v2/scheduler.js' } }));
  for (const f of ['index', 'https', 'firestore', 'scheduler']) fs.writeFileSync(path.join(nm, 'firebase-functions', 'v2', f + '.js'), "export * from '" + stub2 + "';\n");
}
/* chuẩn bị cây tạm: fixture + stub (stub48/stub → stubB), sources.js, import '<che>' → stub */
function prepTree(W) {
  cpDir(FX, W); fs.copyFileSync(path.join(W, 'stubB.mjs'), path.join(W, 'stub48.mjs')); fs.copyFileSync(path.join(W, 'stubB.mjs'), path.join(W, 'stub.mjs')); fakeNodeModules(W);
  for (const f of ['stats.js', 'scanstats.js']) { const p = path.join(W, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/from '<che>'/g, "from './stubB.mjs'")); }
  fs.copyFileSync(SRCJS, path.join(W, 'sources.js'));
  const tp = path.join(W, 'codebase2', 'tagLeadBrand.js'); let t = fs.readFileSync(tp, 'utf8');
  t = t.replace("const { onDocumentCreated } = require('<che>');", "import { onDocumentCreated, setGlobalOptions, initializeApp, getFirestore, FieldValue } from '../stubB.mjs';").replace("const { setGlobalOptions } = require('firebase-functions/v2');\n", '').replace("const { initializeApp } = require('firebase-admin/app');\n", '').replace("const { getFirestore, FieldValue } = require('firebase-admin/firestore');\n", '').replace('exports.tagLeadBrand = ', 'export const tagLeadBrand = ');
  fs.writeFileSync(path.join(W, 'codebase2', 'tagLeadBrand.mjs'), t);
}
if (process.env.LB_EXPORT_DIR) { /* fake ~ : firebase-s13/functions (UNPATCHED) + firestore.rules + codebase2/tagLeadBrand */
  const H = process.env.LB_EXPORT_DIR; const F = path.join(H, 'firebase-s13', 'functions'); prepTree(F); fs.rmSync(path.join(F, 'sources.js')); fs.rmSync(path.join(F, 'codebase2'), { recursive: true, force: true });
  fs.writeFileSync(path.join(F, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-5.6-sol\nLLM_PREFILTER_MODEL=gpt-5-nano\nBRIGHTDATA_TOKEN=test-bd\nBRIGHTDATA_DATASET_ID=gd_x\nPOLL_MINUTES=3\n');
  fs.writeFileSync(path.join(H, 'firebase-s13', 'firestore.rules'), "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    function isSuperAdmin() { return true; }\n    match /workers/{wid} {\n      allow read: if isSuperAdmin();\n      allow write: if false;\n    }\n  }\n}\n");
  fs.writeFileSync(path.join(H, 'firebase-s13', 'firebase.json'), '{}');
  fs.mkdirSync(path.join(H, 'codebase2', 'tagLeadBrand'), { recursive: true }); fs.copyFileSync(path.join(FX, 'codebase2', 'tagLeadBrand.js'), path.join(H, 'codebase2', 'tagLeadBrand', 'index.js')); fs.writeFileSync(path.join(H, 'codebase2', 'firebase.json'), '{}');
  console.log('exported fake HOME (UNPATCHED) →', H); process.exit(0);
}

/* ---------- 0. patch ---------- */
OUT('-- patch');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-')); prepTree(W);
const r1 = run(W, [PATCH, ...FILES]); ok(r1.code === 0 && /PATCH OK 7 file/.test(r1.out), 'patch áp trên fixture: PATCH OK 7 file' + (r1.code ? ' — ' + r1.out.slice(0, 300) : ''));
const r2 = run(W, [PATCH, ...FILES]); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of [...FILES, 'sources.js']) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f + (r.code ? ' — ' + r.out.slice(0, 200) : '')); }
{ const W2 = fs.mkdtempSync(path.join(os.tmpdir(), 'lb2-')); prepTree(W2); const f = path.join(W2, 'scanstats.js'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("const brand = brandMap.get(normUrl(r.url)); if (!brand) continue;", "const brand = brandMap.get(normUrl(r.url)); if (!brand) { continue; }"));
  const before = FILES.filter(x => x !== 'scanstats.js').map(x => fs.readFileSync(path.join(W2, x), 'utf8'));
  const r = run(W2, [PATCH, ...FILES]); const same = FILES.filter(x => x !== 'scanstats.js').every((x, i) => fs.readFileSync(path.join(W2, x), 'utf8') === before[i]);
  ok(r.code === 1 && /KHONG THAY MOC scanstats.js\/SS1/.test(r.out) && same, 'fail-closed NGUYÊN TỬ: thiếu 1 mốc scanstats.js → exit 1, KHÔNG ghi file nào'); }
{ const W3 = fs.mkdtempSync(path.join(os.tmpdir(), 'lb3-')); cpDir(W, W3); fs.writeFileSync(path.join(W3, 'lib/config.js'), fs.readFileSync(path.join(FX, 'lib/config.js'), 'utf8')); const r = run(W3, [PATCH, ...FILES]); ok(r.code === 1 && /LỆCH/.test(r.out), 'lệch (6 file đã patch, config.js chưa) → báo LỆCH, dừng'); }
/* tag patch + rules script */
{ const t = path.join(W, 'codebase2', 'tagLeadBrand.js'); const r = run(W, [TAGP, t]); const r2b = run(W, [TAGP, t]); const s = fs.readFileSync(t, 'utf8');
  ok(r.code === 0 && /PATCH OK tagLeadBrand/.test(r.out) && r2b.code === 0 && /idempotent/.test(r2b.out) && s.includes("const brand = hint || await getBrandForSource(sourceName);") && s.includes("brand_tagged_by: hint ? 'brand_hint' : 'tagLeadBrand'"), 'tagLeadBrand patch: dòng 75 → hint || getBrandForSource; brand_tagged_by; idempotent');
  const tm = path.join(W, 'codebase2', 'tagLeadBrand.mjs'); fs.writeFileSync(tm, fs.readFileSync(tm, 'utf8').replace("  const brand = await getBrandForSource(sourceName);", "  const hint = String(lead.brand_hint || '').trim();\n  const brand = hint || await getBrandForSource(sourceName);").replace("    brand_tagged_by: 'tagLeadBrand',", "    brand_tagged_by: hint ? 'brand_hint' : 'tagLeadBrand',")); }
{ const RW = fs.mkdtempSync(path.join(os.tmpdir(), 'lbr-')); fs.writeFileSync(path.join(RW, 'firestore.rules'), "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /workers/{wid} {\n      allow read: if isSuperAdmin();\n      allow write: if false;\n    }\n    match /content_stats/{id} { allow read: if true; allow write: if false; }\n  }\n}\n");
  const r = run(RW, [RULESP]); const s = fs.readFileSync(path.join(RW, 'firestore.rules'), 'utf8'); const r2c = run(RW, [RULESP]);
  ok(r.code === 0 && /match \/lead_links\/\{lid\}/.test(s) && /allow read: if isSuperAdmin\(\);\n\s*allow write: if false;/.test(s.slice(s.indexOf('match /lead_links/'))) && s.split('match /workers/').length === 2 && /ĐÃ CÓ/.test(r2c.out), 'rules script: chèn block lead_links (read super / write false) từ block workers, idempotent'); }
/* DẪN XUẤT: fixture B = mã đang chạy */
{ const D48 = fs.mkdtempSync(path.join(os.tmpdir(), 'lbd48-')); cpDir(FX48, D48); const r = run(D48, [P48, 'lib/config.js', 'lib/scorer.js', 'lib/scraper.js', 'index.js']);
  const same = ['index.js', 'lib/scorer.js', 'lib/scraper.js', 'lib/config.js'].every(f => fs.readFileSync(path.join(D48, f), 'utf8') === fs.readFileSync(path.join(FX, f), 'utf8'));
  ok(r.code === 0 && same, 'dẫn xuất: fixture #48 + patch #48 == fixture B (index.js · lib/scorer.js · lib/scraper.js · lib/config.js) byte-identical');
  const D46 = fs.mkdtempSync(path.join(os.tmpdir(), 'lbd46-')); cpDir(FX46, D46); const r46 = run(D46, [P46, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']);
  ok(r46.code === 0 && fs.readFileSync(path.join(D46, 'outreach.js'), 'utf8') === fs.readFileSync(path.join(FX, 'outreach.js'), 'utf8'), 'dẫn xuất: fixture #46 + patch #46 == fixture B outreach.js byte-identical');
  const dumpLines = (file, re) => { const lines = {}; let cur = false; for (const raw of fs.readFileSync(path.join(DUMP, file), 'latin1').split('\n')) { if (/^(-----|--- |== )/.test(raw)) { cur = re.test(raw); continue; } const m = /^\s*(\d+)\t(.*)$/.exec(raw); if (m && cur) lines[Number(m[1])] = Buffer.from(m[2], 'latin1').toString('utf8'); } return Object.keys(lines).map(Number).sort((a, b) => a - b).map(n => lines[n]).join('\n'); };
  const T = { stats: dumpLines('scan-dump-0912.txt', /FILE stats\.js/), multitouch: dumpLines('scan-dump-0912.txt', /FILE lib\/multitouch\.js/), scanstats: dumpLines('scan-dump-0912b.txt', /scanstats\.js/) };
  const fxT = { stats: fs.readFileSync(path.join(FX, 'stats.js'), 'utf8'), multitouch: fs.readFileSync(path.join(FX, 'lib/multitouch.js'), 'utf8'), scanstats: fs.readFileSync(path.join(FX, 'scanstats.js'), 'utf8') };
  ok(T.stats.length > 5000 && T.stats.trim() === fxT.stats.trim() && T.multitouch.trim() === fxT.multitouch.trim(), 'dẫn xuất: stats.js + lib/multitouch.js fixture == VĂN BẢN DUMP #47');
  ok(T.scanstats.length > 1500 && T.scanstats.trim() === fxT.scanstats.trim(), 'dẫn xuất: scanstats.js fixture == VĂN BẢN DUMP #47b');
  const anch = JSON.parse(run(W, [PATCH, '--anchors']).out); let n = 0; const bad = []; const txt = { config: fs.readFileSync(path.join(FX, 'lib/config.js'), 'utf8'), scraper: fs.readFileSync(path.join(FX, 'lib/scraper.js'), 'utf8'), index: fs.readFileSync(path.join(FX, 'index.js'), 'utf8'), outreach: fs.readFileSync(path.join(FX, 'outreach.js'), 'utf8'), stats: fxT.stats, scanstats: fxT.scanstats, multitouch: fxT.multitouch };
  for (const [g, m] of Object.entries(anch)) for (const [k, a] of Object.entries(m)) { n++; const c = txt[g].split(a).length - 1; if (c !== 1) bad.push(g + '/' + k + '=' + c); }
  ok(n >= 70 && !bad.length, n + ' mốc đối chiếu fixture (= mã đang chạy): mỗi mốc đúng 1 lần' + (bad.length ? ' — LỆCH ' + bad.join(', ') : ''));
  const tag = fs.readFileSync(path.join(FX, 'codebase2', 'tagLeadBrand.js'), 'utf8'); ok(tag.split("  const brand = await getBrandForSource(sourceName);").length === 2 && tag.split("    brand_tagged_by: 'tagLeadBrand',").length === 2, 'tagLeadBrand dump #47e: 2 mốc đúng 1 lần'); }

/* ---------- chuẩn bị chạy mã đã vá ---------- */
const stub = await import(pathToFileURL(path.join(W, 'stubB.mjs')).href);
const CFG = (await import(pathToFileURL(path.join(W, 'lib/config.js')).href)).CFG;
const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href);
const sr = await import(pathToFileURL(path.join(W, 'lib/scraper.js')).href);
const mt = await import(pathToFileURL(path.join(W, 'lib/multitouch.js')).href);
const cfg = sc.scoreLead.cfg46;
Object.assign(CFG, { LLM_API_KEY: 'test-key', LLM_MODEL: 'gpt-5.6-sol', LLM_PREFILTER_MODEL: 'gpt-5-nano', SCAN_COMMENTS: false, BD_SOW_MODE: true, SCORE_CONCURRENCY: 1, PREFILTER_CONCURRENCY: 1, MIN_KEEP_SCORE: 40, HOT_THRESHOLD: 80, LOG_SCANNED_POSTS: true, SCANNED_TTL_DAYS: 3, POSTS_PER_GROUP: 20, PROBE_POSTS: 5, FULLSWEEP_HOURS: 2, SCAN_SOURCE_INTERVAL_MIN: 10, BRIGHTDATA_TOKEN: 'bd-test', BRIGHTDATA_DATASET_ID: 'gd_test', BRIGHTDATA_COMMENTS_DATASET_ID: 'gd_cmt', COMMENTS_PER_POST: 30, MOCK_MODE: false, BD_PROGRESS_MIN_AGE_S: 120, SCAN_INTERVAL_MIN_FLOOR: 5, SCAN_INTERVAL_MAX_MIN: 30, HOUSEKEEPING_MIN: 5, BD_DEEP_SWEEP_AFTER_MIN: 30, BD_ERROR_RECORD_BILLED: true, BD_NOTIFY_URL: '', WATCH_POSTS_PER_SOURCE: 5, SCAN_LOCK_TTL_S: 1200, BD_MAX_TRIGGERS_PER_RUN: 40 });
cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300; cfg.budgetMs = 100000;
const realNow = Date.now; let clockOff = 0; Date.now = () => realNow() + clockOff;
const LOGS = []; for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); if (process.env.LB_VERBOSE) o(...a); }; }
const logHas = re => LOGS.some(l => re.test(l));
/* fetch giả: BrightData (trigger/progress/snapshot) + LLM */
const good = (obj) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: 'gpt-test' } });
const err = (status, code, type, message) => ({ status, body: { error: { code, type, message } } });
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: () => null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body), json: async () => r.body });
const LEAD = { is_real_lead: true, hotness: 85, intent: 'cần mua gấp', need: 'mua 20 kg mực khô', industry: 'Hải sản', service: 'Mực khô', reply: 'Chào anh, bên em có mực khô loại 1 ạ.', role: 'buyer', role_reason: 'hỏi mua' };
let calls = []; let route = { pre: () => good({ maybe: true }), main: () => good(LEAD) };
const BD = { triggers: [], snaps: new Map(), progress: 0, busy: false, failNext: false, triggerFail: false, recordsFor: () => [], readyDelay: 0, n: 0, cmtRecordsFor: () => [] };
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('api.brightdata.com')) {
    if (u.includes('/trigger?')) { if (BD.triggerFail) return mk({ status: 400, body: 'Customer is not active' }); const inputs = JSON.parse(opt.body); const id = 'sd_' + (++BD.n); const isCmt = u.includes('dataset_id=gd_cmt'); BD.triggers.push({ id, inputs, url: u, isCmt, notify: /notify=([^&]+)/.test(u) ? decodeURIComponent(u.match(/notify=([^&]+)/)[1]) : '' }); BD.snaps.set(id, { at: Date.now(), inputs, isCmt, records: null }); return mk({ status: 200, body: { snapshot_id: id } }); }
    if (u.includes('/progress/')) { BD.progress++; const id = u.split('/progress/')[1]; if (BD.busy) return mk({ status: 429, body: { error: 'rate' } }); const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: { status: 'failed' } }); if (BD.failNext) { BD.failNext = false; return mk({ status: 200, body: { status: 'failed' } }); } return mk({ status: 200, body: { status: (Date.now() - s.at) >= BD.readyDelay ? 'ready' : 'running' } }); }
    if (u.includes('/snapshot/')) { const id = u.split('/snapshot/')[1].split('?')[0]; const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: [] }); const recs = s.isCmt ? s.inputs.flatMap(i => BD.cmtRecordsFor(i)) : s.inputs.flatMap(i => BD.recordsFor(i).map(r => Object.assign({ input: { url: i.url, num_of_posts: i.num_of_posts || null, start_date: i.start_date || null, posts_to_not_include: i.posts_to_not_include || [] } }, r))); return mk({ status: 200, body: recs }); }
    return mk({ status: 404, body: {} });
  }
  const body = JSON.parse(opt.body); calls.push({ url: u, body, opt }); const isPre = body.model === CFG.LLM_PREFILTER_MODEL; const r = await (isPre ? route.pre : route.main)(body, opt); return mk(r);
};
const attempt = async fn => { try { return { v: await fn() }; } catch (e) { return { e }; } };

/* ---------- A. scraper.js ---------- */
OUT('-- scraper.js (postIdB · gid · sowPostsB · harvestPostsB)');
ok(sr.postIdB({ post_id: '123' }) === '123' && sr.postIdB({ id: 'x9' }) === 'x9' && sr.postIdB({ url: 'https://www.facebook.com/groups/g1/posts/555/?locale=en_US' }) === 'https://www.facebook.com/groups/g1/posts/555' && /^h_[0-9a-z]+$/.test(sr.postIdB({ author: 'A', content: 'xin chào' })) && sr.postIdB({ author: 'A', content: 'xin chào' }) === sr.postIdB({ author: 'A', content: 'xin chào' }) && sr.postIdB({}) === '', 'postIdB: post_id ‖ id ‖ urlKey(url) ‖ h_<hash> tất định, rỗng khi không có gì (không Math.random)');
ok(sr.normalizePost({ url: 'https://www.facebook.com/groups/1189400231607822/posts/77/', content: 'x' }, { name: 'S' }).post_id === 'https://www.facebook.com/groups/1189400231607822/posts/77' && sr.gidNumOfB('https://www.facebook.com/groups/1189400231607822/') === '1189400231607822' && sr.gidNumOfB('https://www.facebook.com/groups/vieclamtotchosv/') === '' && sr.slugOfB('https://www.facebook.com/groups/VieclamTotChoSV/?ref=x') === 'vieclamtotchosv' && sr.slugOfB('https://www.facebook.com/groups/1189400231607822') === '1189400231607822', 'normalizePost dùng postIdB; gidNumOfB chỉ số ≥5 chữ; slugOfB thường hoá');
const G1 = 'https://www.facebook.com/groups/1189400231607822/', G2 = 'https://www.facebook.com/groups/vieclamtotchosv/';
{ const F0 = stub.makeDb(); globalThis.__slB = { db: F0.db }; globalThis.__sl48 = { db: F0.db }; BD.triggers = []; BD.snaps.clear();
  const sow = await sr.sowPostsB([{ gkey: 'g_1189400231607822', url: G1, numPosts: 5, notInclude: ['a', 'b'] }, { gkey: 's_vieclamtotchosv', url: G2, numPosts: 20, startDate: '09-11-2026', endDate: '09-12-2026', sweep: true, notInclude: [] }], { notify: 'https://x/bdReady?key=k', chunk: 40, runId: 'r1' });
  const t = BD.triggers[0]; const pend = [...F0.store.entries()].filter(([k]) => k.startsWith('pending_snapshots/PB_'));
  ok(sow.sown === 2 && sow.sownKeys.length === 2 && BD.triggers.length === 1 && t.inputs.length === 2 && t.inputs[0].num_of_posts === 5 && t.inputs[0].posts_to_not_include.length === 2 && t.inputs[1].start_date === '09-11-2026' && !('posts_to_not_include' in t.inputs[1]) && t.notify === 'https://x/bdReady?key=k' && pend.length === 1 && pend[0][1].kind === 'posts' && pend[0][1].groups.length === 2 && pend[0][1].groups[1].sweep === true, 'sowPostsB: 2 group → 1 trigger (tham số riêng từng group, notify trên URL), pending PB_ kèm groups[]');
  const sow2 = await sr.sowPostsB(Array.from({ length: 45 }, (_, i) => ({ gkey: 'g_' + i, url: 'https://www.facebook.com/groups/' + (100000 + i) + '/', numPosts: 5 })), { chunk: 40, runId: 'r1' });
  ok(sow2.sown === 45 && BD.triggers.length === 3 && BD.triggers[1].inputs.length === 40 && BD.triggers[2].inputs.length === 5, 'sowPostsB: 45 group, chunk 40 → 2 trigger (40 + 5)');
  /* harvest: chưa đủ tuổi → pending; đủ tuổi → claim + route theo group_id / input.url; học gid slug */
  BD.recordsFor = i => i.url === G1 ? [{ post_id: 'p1', url: G1 + 'posts/p1/', content: 'Cần mua mực khô', group_id: '1189400231607822', num_comments: 0 }, { post_id: 'p2', url: G1 + 'posts/p2/', content: 'x', group_id: '1189400231607822', error: 'dead_page', error_code: 'dead_page' }] : i.url === G2 ? [{ post_id: 'q1', url: 'https://www.facebook.com/groups/555666777888/posts/q1/', content: 'Tìm việc', group_id: '555666777888', num_comments: 3 }] : [];
  let hv = await sr.harvestPostsB({ runId: 'r2', minAgeS: 120 }); ok(hv.harvested === 0 && hv.pending === 3 && hv.pendingKeys.includes('g_1189400231607822') && BD.progress === 0, 'harvestPostsB: snapshot < 120 s → không hỏi progress, pendingKeys đủ');
  clockOff += 130e3; hv = await sr.harvestPostsB({ runId: 'r2', minAgeS: 120 });
  const e1 = hv.byKey.get('g_1189400231607822'), e2 = hv.byKey.get('s_vieclamtotchosv');
  ok(hv.harvested === 3 && e1 && e1.raw.length === 1 && e1.billed === 2 && e2 && e2.raw.length === 1 && e2.g.sweep === true && hv.learned.get('s_vieclamtotchosv') === '555666777888' && hv.bdRaw === 3 && hv.bdGood === 2 && [...F0.store.keys()].filter(k => k.startsWith('pending_snapshots/')).length === 0, 'harvestPostsB: ≥120 s → gặt 3 snapshot; route theo group_id; record lỗi dead_page tính tiền (billed 2, raw 1); học gid slug → 555666777888; pending xoá');
  /* busy 429 → hoãn, giữ pending; failed → xoá; claim chống 2 lượt */
  BD.triggers = []; await sr.sowPostsB([{ gkey: 'g_1', url: G1, numPosts: 5 }], { runId: 'r3' }); clockOff += 130e3; BD.busy = true; hv = await sr.harvestPostsB({ runId: 'r4', minAgeS: 120 }); BD.busy = false;
  ok(hv.busy === 1 && hv.harvested === 0 && hv.pending === 1 && [...F0.store.keys()].filter(k => k.startsWith('pending_snapshots/')).length === 1, 'harvestPostsB: progress 429 → busy, giữ pending (không xoá)');
  const pendRef = F0.db.collection('pending_snapshots').doc([...F0.store.keys()].find(k => k.startsWith('pending_snapshots/')).slice(18)); await pendRef.update({ claimedBy: 'other', claimedAt: Date.now() });
  hv = await sr.harvestPostsB({ runId: 'r4', minAgeS: 120 }); ok(hv.harvested === 0 && hv.pending === 1, 'harvestPostsB: snapshot đang được lượt khác claim (<10′) → không gặt');
  await pendRef.update({ claimedBy: '', claimedAt: 0 }); BD.failNext = true; hv = await sr.harvestPostsB({ runId: 'r4', minAgeS: 120 }); ok(hv.failed === 1 && [...F0.store.keys()].filter(k => k.startsWith('pending_snapshots/')).length === 0, 'harvestPostsB: progress failed → xoá pending');
  ok((await sr.bdProgressB('sd_none')).st === 'failed' || (await sr.bdProgressB('sd_none')).st === 'unknown', 'bdProgressB: snapshot lạ → failed/unknown (không ném)'); }

/* ---------- B. multitouch.js ---------- */
OUT('-- multitouch.js (cùng brand · vân tay văn bản)');
{ const F0 = stub.makeDb(); const db = F0.db; const now = Date.now();
  await db.collection('leads').doc('L_a__b1').set({ identityKey: 'u:https://www.facebook.com/profile.php?id=100', brand_hint: 'b1', brand: 'b1', stage: 'new', last_seen_ms: now - 1000, touches: [{ source: 'S1', url: 'u1' }], score: 50, text: 'Cần mua 20kg mực khô rim me ship Hà Nội ai có báo giá' });
  const lead2 = { author_url: 'https://www.facebook.com/profile.php?id=100', brand_hint: 'b2', source: 'S2', post_url: 'u2', text: 'khác', score: 50 };
  ok((await mt.tryMergeTouch(db, lead2, { windowH: 48, brand: 'b2' })) === false, 'multitouch: cùng người nhưng brand khác → KHÔNG gộp (lead riêng cho brand b2)');
  const lead3 = { author_url: 'https://www.facebook.com/profile.php?id=100', brand_hint: 'b1', source: 'S2', post_url: 'u2', text: 'Cần mua 20kg mực khô rim me ship Hà Nội ai có báo giá', score: 50 };
  ok((await mt.tryMergeTouch(db, lead3, { windowH: 48, brand: 'b1' })) === true && (F0.store.get('leads/L_a__b1').touches || []).length === 2, 'multitouch: cùng người cùng brand → gộp thành touch thứ 2');
  const tk = mt.textKeyB('Cần mua 20kg mực khô rim me ship Hà Nội ai có báo giá'); await db.collection('leads').doc('L_t__b1').set({ brand_hint: 'b1', stage: 'new', last_seen_ms: now - 2 * 86400e3, textKey: tk, touches: [{ source: 'S1', url: 'u1' }], score: 60, text: 'Cần mua 20kg mực khô rim me ship Hà Nội ai có báo giá' });
  const lead4 = { brand_hint: 'b1', source: 'S3', post_url: 'u3', text: 'CẦN MUA 20KG mực khô rim me, ship Hà Nội!!! ai có báo giá', score: 55 };
  ok(tk && (await mt.tryMergeTouch(db, lead4, { windowH: 48, brand: 'b1' })) === true && lead4.textKey === tk && (F0.store.get('leads/L_t__b1').touches || []).length === 2 && F0.store.get('leads/L_t__b1').merged_by === 'textKey', 'PC-4: ẩn danh, không SĐT, văn bản gần trùng (hoa/thường/dấu câu) cùng brand ≤14 ngày → gộp theo textKey');
  const lead5 = { brand_hint: 'b2', source: 'S3', post_url: 'u4', text: 'CẦN MUA 20KG mực khô rim me, ship Hà Nội!!! ai có báo giá', score: 55 };
  ok((await mt.tryMergeTouch(db, lead5, { windowH: 48, brand: 'b2' })) === false && lead5.textKey === tk, 'PC-4: cùng văn bản nhưng brand khác → không gộp (textKey vẫn gắn để ghi lead)');
  ok(mt.textKeyB('ngắn quá') === '' && mt.textKeyB('') === '', 'textKeyB: văn bản < 24 ký tự sạch → rỗng (không gộp bừa)'); }

/* ---------- C. index.js — scanAll trọn vòng ---------- */
OUT('-- index.js scanAll (gieo gộp · gặt · fan-out brand · seen.brands · lead id tất định · khoá lượt · thuần skip · nhịp · bdwatch/deep · retry theo brand · bình luận · Quét ngay · watch)');
const ixm = await import(pathToFileURL(path.join(W, 'index.js')).href);
const G1b = 'https://www.facebook.com/groups/1189400231607822';
const rec = (id, extra) => Object.assign({ post_id: id, url: G1 + 'posts/' + id + '/', content: 'Cần mua ' + id + ' kg mực khô rim me, ai có báo giá', group_id: '1189400231607822', num_comments: 0, profile_id: '1000' + id.replace(/\D/g, '').padStart(12, '0'), date_posted: new Date(Date.now() - 60e3).toISOString() }, extra || {});
let F;
function fresh(o) { o = o || {}; F = stub.makeDb(); LOGS.length = 0; calls = []; BD.triggers = []; BD.snaps.clear(); BD.progress = 0; BD.busy = false; BD.failNext = false; BD.triggerFail = false; BD.readyDelay = 0; BD.recordsFor = () => []; BD.cmtRecordsFor = () => []; BD.cmtTriggerFail = false;
  globalThis.__slB = { db: F.db }; globalThis.__sl48 = { db: F.db, isExcluded: () => false, enrichPhoneFromText: async () => ({ phone: '', phone_has_zalo: null, email: '' }), checkZalo: async () => ({ registered: true }), brandAiOf: (src) => ({ nganh: 'Ngành ' + ((src && src.brand) || '') }), tryMergeTouch: (db, lead, oo) => mt.tryMergeTouch(db, lead, oo), fetchPosts: o.fetchPosts };
  const now = Date.now();
  F.db.collection('sources').doc('src_b1').set({ name: 'Hải sản B1', url: G1, brand: 'b1', active: true, industry: 'Hải sản' });
  F.db.collection('sources').doc('src_b2').set({ name: 'Hải sản B2', url: G1b, brand: 'b2', active: true, industry: 'Hải sản', sharedAt: now - 30 * 60e3, sharedBy: 'u2' });
  if (!o.noSlug) F.db.collection('sources').doc('src_slug').set({ name: 'Việc làm', url: G2, brand: 'b3', active: true, industry: 'Tuyển dụng' });
  F.db.collection('config').doc('app').set({ aiMode: 'saver', scanComments: !!o.comments });
  route = { pre: () => good({ maybe: true }), main: () => good(LEAD) }; return F; }
const leads = () => [...F.store.entries()].filter(([k]) => /^leads\/[^/]+$/.test(k)).map(([k, v]) => Object.assign({ id: k.slice(6) }, v));
const scansAll = () => [...F.store.entries()].filter(([k]) => k.startsWith('scans/')).map(([, v]) => v);
const sysDoc = id => F.store.get('system_status/' + id); const gsDoc = k => F.store.get('group_state/' + k); const seenOf = id => F.store.get('seen/' + id);
const retries = () => [...F.store.entries()].filter(([k]) => k.startsWith('score_retry/')).map(([k, v]) => Object.assign({ id: k.slice(12) }, v));
const GK = 'g_1189400231607822';
/* C1 lượt đầu: chỉ gieo (2 group, 1 trigger) */
fresh(); clockOff = 0; BD.recordsFor = i => (i.url === G1 ? [rec('p1'), rec('p2'), rec('p3')] : i.url === G2 ? [{ post_id: 'q1', url: 'https://www.facebook.com/groups/555666777888/posts/q1/', content: 'Tìm việc part-time', group_id: '555666777888', num_comments: 1 }] : []);
let sum = await ixm.scanAll('scheduled');
{ const sc1 = scansAll(); const t = BD.triggers[0]; const g = gsDoc(GK) || {};
  ok(sc1.length === 1 && sc1[0].sown === 2 && sc1[0].groups === 2 && sc1[0].sharedGroups === 1 && sc1[0].harvested === 0 && BD.triggers.length === 1 && t.inputs.length === 2 && t.inputs.every(i => i.num_of_posts === 20 && i.start_date), 'C1 lượt đầu: 2 group (1 dùng chung 2 brand) → 1 trigger 2 input (sweep đầu: 20 bài + start_date) · scans {sown 2, groups 2, sharedGroups 1}');
  ok(g.lastTriggerAt > 0 && g.lastSweepAt > 0 && g.iv === 5 && g.band === 'fast' && (gsDoc('s_vieclamtotchosv') || {}).lastTriggerAt > 0 && sysDoc('scan').lastHousekeepingAt > 0 && sysDoc('scan_lock').holder === '', 'C1 group_state theo gkey: lastTriggerAt/lastSweepAt · nhịp 5′ (group mới = sàn) · việc phụ đã chạy · khoá lượt đã nhả'); }
/* C2 gặt + fan-out */
clockOff += 130e3; sum = await ixm.scanAll('scheduled');
{ const L = leads(), sc1 = scansAll(); const last = sc1[sc1.length - 1]; const ids = L.map(l => l.id).sort();
  ok(sc1.length === 2 && last.harvested === 1 && last.sown === 0 && last.postsFetched === 7 && last.leadsCreated === 7 && L.length === 7 && ids.join(',') === 'L_p1__b1,L_p1__b2,L_p2__b1,L_p2__b2,L_p3__b1,L_p3__b2,L_q1__b3', 'C2 gặt 1 snapshot → 3 bài × 2 brand + 1 bài × 1 brand = 7 ứng viên → 7 lead id TẤT ĐỊNH L_<post_id>__<brand>');
  const a = L.find(l => l.id === 'L_p1__b1'), b = L.find(l => l.id === 'L_p1__b2'), q = L.find(l => l.id === 'L_q1__b3');
  if (process.env.LB_DBG) OUT('DBG C2 a', JSON.stringify({ a: a && { brand: a.brand, brand_hint: a.brand_hint, source_id: a.source_id, gid: a.gid, post_id: a.post_id, shared_post: a.shared_post, btb: a.brand_tagged_by, source: a.source, uid: a.author_uid, tk: a.textKey }, b: b && { brand: b.brand, source: b.source, source_id: b.source_id }, q: q && { shared_post: q.shared_post, gid: q.gid, source_id: q.source_id } }));
  ok(a && a.brand === 'b1' && a.brand_hint === 'b1' && a.source_id === 'src_b1' && a.gid === '1189400231607822' && a.post_id === 'p1' && a.shared_post === true && a.brand_tagged_by === 'scanner-inline' && a.source === 'Hải sản B1' && b && b.brand === 'b2' && b.source === 'Hải sản B2' && b.source_id === 'src_b2' && q && q.shared_post === false && q.gid === '555666777888' && q.source_id === 'src_slug' && a.author_uid === '1000000000000001' && a.textKey, 'C2 lead: brand đúng theo nguồn fan-out (2 bước: create + brand_tagged_by scanner-inline), post_id/gid/source_id/shared_post/textKey/author_uid');
  ok(calls.filter(c => c.body.model === 'gpt-5-nano').length === 7 && calls.filter(c => c.body.model === 'gpt-5.6-sol').length === 7, 'C2 AI: tầng 1 + tầng 2 chạy RIÊNG cho từng brand (7 + 7 lượt gọi)');
  const s1 = seenOf('p1'), lk = F.store.get('lead_links/1189400231607822_p1');
  ok(s1 && s1.brands && s1.brands.b1 === 'lead' && s1.brands.b2 === 'lead' && (seenOf('q1') || {}).brands.b3 === 'lead' && F.log.creates.filter(k => k.startsWith('seen/')).length === 4 && lk && lk.brands.b1 === 'L_p1__b1' && lk.brands.b2 === 'L_p1__b2' && !F.store.get('lead_links/555666777888_q1'), 'C2 seen/{post_id}.brands{b1,b2}=lead (create 1 doc/bài) · lead_links chỉ cho bài dùng chung');
  const g = gsDoc(GK) || {}, gs2 = gsDoc('s_vieclamtotchosv') || {};
  if (process.env.LB_DBG) OUT('DBG C2 gs', JSON.stringify({ g, gs2, src: F.store.get('sources/src_slug'), gidLearned: last.gidLearned }));
  ok(g.rate === 0 && g.rateN === 0 && g.band === 'fast' && g.recentIds.length === 3 && g.lastPostAt > 0 && g.lastHarvestAt > 0 && gs2.gidNum === '555666777888' && F.store.get('sources/src_slug').gid === '555666777888' && last.gidLearned === 1 && g.watch && Object.keys(g.watch).length === 3, 'C2 group_state: gặt sweep không cập nhật rate (0/0), band fast, recentIds 3, lastPostAt · nguồn slug HỌC gid số từ record → sources.gid + group_state.gidNum · 3 bài 0 bình luận vào watch');
  const rows = last.bySource; const r1 = rows.find(r => r.source_id === 'src_b1'), r2 = rows.find(r => r.source_id === 'src_b2');
  ok(rows.length === 3 && r1.brand === 'b1' && r1.bdPosts === 3 && !r1.bdShared && r1.posts === 3 && r1.leads === 3 && r2.brand === 'b2' && r2.bdShared === true && r2.bdPosts === 0 && r2.posts === 3 && r2.leads === 3 && r1.bd === 'ok', 'C2 bySource: 1 dòng/nguồn có brand/source_id; tiền BrightData (bdPosts) ở nguồn CHỦ, nguồn dùng chung bdShared');
  const bm = F.store.get('bd_month/' + new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7)); const keys = Object.keys((bm && bm.src) || {});
  ok(keys.length === 3 && keys.some(k => k.endsWith('__b2')) && keys.filter(k => k.endsWith('__b1')).length === 0 && bm.src[keys.find(k => k.endsWith('__b2'))].shared === true, 'C2 bd_month.src: nguồn dùng chung key s_<url>__<brand>, nguồn chủ key cũ');
  ok(sysDoc('brightdata').ok === true && last.housekeeping === false && (sysDoc('scan').skipRuns || 0) === 0, 'C2 bdwatch ok:true · việc phụ chưa tới nhịp (housekeeping false)'); }
/* C3 lượt thuần skip */
clockOff += 5e3; sum = await ixm.scanAll('scheduled');
if (process.env.LB_DBG) OUT('DBG C3', JSON.stringify({ sum, n: scansAll().length, scan: sysDoc('scan'), lock: sysDoc('scan_lock'), logs: LOGS.slice(-6) }));
ok(sum.skipped === true && scansAll().length === 2 && sysDoc('scan').skipRuns === 1 && sysDoc('scan').phase === 'done' && sysDoc('scan_lock').holder === '' && logHas(/thuần skip/), 'C3 lượt thuần skip (không gieo/gặt/ứng viên, chưa tới nhịp việc phụ) → KHÔNG ghi scans, skipRuns 1, nhả khoá');
/* C4 khoá lượt */
{ const origCol = F.db.collection; F.db.collection = (c) => { const q = origCol(c); if (c !== 'sources') return q; const g0 = q.get.bind(q); q.get = async () => { await new Promise(r => setTimeout(r, 25)); return g0(); }; return q; }; /* lượt 1 giữ khoá ≥25 ms (đọc sources chậm) như thật */
  const [a, b] = await Promise.all([ixm.scanAll('scheduled'), ixm.scanAll('scheduled')]); F.db.collection = origCol;
  if (process.env.LB_DBG) OUT('DBG C4', JSON.stringify({ a, b, logs: LOGS.filter(l => /BUSY|LOCK/.test(l)) })); ok((a.busy === true) !== (b.busy === true) && logHas(/\[SCAN-BUSY\]/), 'C4 2 lượt lịch chồng → đúng 1 lượt chạy, lượt kia busy:true (không ném, không ghi scans)');
  await F.db.collection('system_status').doc('scan_lock').set({ holder: 'other_run', trigger: 'scheduled', at: Date.now(), expireAt: Date.now() + 600e3 }); const r = await attempt(() => ixm.scanAll('manual', {})); ok(r.e && r.e.code === 'busy', 'C4 Quét ngay khi đang có lượt khác → ném code busy (manualScan trả 409)');
  await F.db.collection('system_status').doc('scan_lock').set({ holder: 'stale', at: Date.now() - 2000e3, expireAt: Date.now() - 1000 }); const r2 = await ixm.scanAll('scheduled'); ok(!r2.busy && sysDoc('scan_lock').holder === '', 'C4 khoá quá hạn (TTL) → lượt mới lấy được khoá'); }
/* C5 doc seen cũ (không brands) + sharedAt: brand chủ = đã xử lý, brand vào sau được chấm */
fresh(); clockOff = 0; const T0 = Date.now() - 3600e3; await F.db.collection('seen').doc('p9').set({ at: T0, run: 'old' });
BD.recordsFor = i => (i.url === G1 ? [rec('p9')] : []); await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled');
{ const L = leads(); const s = seenOf('p9'); const last = scansAll()[1];
  ok(L.length === 1 && L[0].id === 'L_p9__b2' && s.brands && s.brands.b2 === 'lead' && !('b1' in s.brands) && last.skippedSeen === 1, 'C5 seen cũ không brands: b1 (không sharedAt) = đã xử lý → bỏ; b2 (sharedAt sau seen.at) → chấm → 1 lead L_p9__b2; seen.brands chỉ b2'); }
/* C6 lead trùng: create() từ chối */
fresh(); clockOff = 0; await F.db.collection('leads').doc('L_p5__b1').set({ name: 'cũ', brand: 'b1', stage: 'new' });
BD.recordsFor = i => (i.url === G1 ? [rec('p5')] : []); await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled');
{ const L = leads(); const last = scansAll()[1]; ok(L.length === 2 && L.find(l => l.id === 'L_p5__b1').name === 'cũ' && L.find(l => l.id === 'L_p5__b2') && last.dupLead === 1 && last.leadsCreated === 1, 'C6 lead cùng bài cùng brand đã có → create() ALREADY_EXISTS → không đè, scans.dupLead 1; brand kia vẫn tạo'); }
/* C7 nhịp thích ứng + escalate + sweep start_date */
fresh(); clockOff = 0; { const now = Date.now(); await F.db.collection('group_state').doc(GK).set({ url: G1, rate: 5, rateN: 3, band: 'fast', lastTriggerAt: now - 10 * 60e3, lastHarvestAt: now - 10 * 60e3, lastSweepAt: now - 3600e3, lastPostAt: now - 10 * 60e3, recentIds: ['old1', 'old2'] }); }
BD.recordsFor = i => (i.url === G1 ? Array.from({ length: 10 }, (_, k) => rec('e' + k)) : []);
await ixm.scanAll('scheduled');
{ const t = BD.triggers[0]; const inp = t.inputs.find(i => i.url === G1); ok(t.inputs.length === 2 && inp.num_of_posts === 10 && !inp.start_date && inp.posts_to_not_include.length === 2, 'C7 group sôi động (rate 5/giờ, tới nhịp 5′) → probe 10 bài, notInclude = recentIds, không sweep (chưa 2 h)'); }
clockOff += 130e3; await ixm.scanAll('scheduled');
{ const g = gsDoc(GK); const t2 = BD.triggers[BD.triggers.length - 1]; const inp = t2.inputs.find(i => i.url === G1); const last = scansAll()[1];
  ok(t2 !== BD.triggers[0] && inp && inp.num_of_posts === 20 && inp.posts_to_not_include.length === 12 && inp.posts_to_not_include.includes('e0') && last.escalated === 1 && last.probeEscalated === 1, 'C7 probe đầy 10 bài mới → ESCALATE: gieo đủ 20 ngay lượt này, notInclude = 10 vừa gặt ∪ recentIds');
  ok(g.rate > 5 && g.rate < 60 && g.rateN === 4 && g.band === 'fast' && g.recentIds.length === 12, 'C7 EWMA: 10 bài mới/10′ → rate tăng (5 → ' + g.rate + '), rateN 4'); }
{ fresh({ noSlug: true }); clockOff = 0; const now = Date.now(); await F.db.collection('group_state').doc(GK).set({ url: G1, rate: 0.1, rateN: 3, band: 'slow', lastTriggerAt: now - 20 * 60e3, lastHarvestAt: now - 20 * 60e3, lastSweepAt: now - 3600e3, lastPostAt: now - 8 * 3600e3, recentIds: [] });
  const vnH = new Date(now + 7 * 3600e3).getUTCHours(); if (vnH >= 23 || vnH < 6) clockOff += 8 * 3600e3; await ixm.scanAll('scheduled'); const g = gsDoc(GK); const t = BD.triggers.find(x => x.inputs.some(i => i.url === G1));
  if (process.env.LB_DBG) OUT('DBG C7idle', JSON.stringify({ n: scansAll().length, scan: sysDoc('scan'), logs: LOGS.slice(-5) }));
  ok(g.iv === 30 && g.band === 'idle' && !t && scansAll().length === 0 && sysDoc('scan').skipRuns === 1 && sysDoc('scan').lastHousekeepingAt > 0, 'C7 group im (0,1 bài/giờ, 8 h không bài, ban ngày) → nhịp 30′ (trần), chưa gieo sau 20′; lượt việc phụ không có gì chấm → KHÔNG ghi scans (skipRuns 1) nhưng lastHousekeepingAt ghi');
  clockOff += 15 * 60e3; await ixm.scanAll('scheduled'); const t2 = BD.triggers.find(x => x.inputs.some(i => i.url === G1)); const inp = t2 && t2.inputs.find(i => i.url === G1);
  ok(t2 && inp.num_of_posts === 5 && !inp.start_date, 'C7 sau 35′ → tới nhịp 30′ → gieo probe 5');
  await F.db.collection('group_state').doc(GK).set({ lastTriggerAt: Date.now() - 40 * 60e3, lastSweepAt: Date.now() - 3 * 3600e3 }, { merge: true }); await F.db.collection('pending_snapshots').doc('PB_' + BD.triggers[BD.triggers.length - 1].id).delete();
  await ixm.scanAll('scheduled'); const t3 = BD.triggers[BD.triggers.length - 1]; const inp3 = t3.inputs.find(i => i.url === G1);
  ok(inp3 && inp3.num_of_posts === 20 && /^\d{2}-\d{2}-\d{4}$/.test(inp3.start_date) && inp3.end_date, 'C7 quá 2 h chưa sweep → sweep = 20 bài + start_date (lastSweepAt − 6 h) + end_date'); }
/* C8 bdwatch: DOWN → 2 lượt OK mới UP → deepDue → deep sweep */
fresh(); clockOff = 0; BD.triggerFail = true; await ixm.scanAll('scheduled');
{ const st = sysDoc('brightdata'); ok(st && st.ok === false && st.since > 0 && st.okStreak === 0 && logHas(/\[BRIGHTDATA-DOWN\]/) && scansAll()[0].scrapeErrors >= 2, 'C8 trigger 400 → mọi group lỗi → [BRIGHTDATA-DOWN] ok:false'); }
clockOff += 35 * 60e3; BD.triggerFail = false; await ixm.scanAll('scheduled');
{ const st = sysDoc('brightdata'); ok(st.ok === false && st.okStreak === 1 && !logHas(/\[BRIGHTDATA-UP\]/), 'C8 lượt OK thứ 1 → okStreak 1, vẫn ok:false (chưa UP)'); }
clockOff += 5 * 60e3; await ixm.scanAll('scheduled');
{ const st = sysDoc('brightdata'); ok(st.ok === true && st.okStreak === 0 && st.deepDue && st.deepDue.downMin >= 35 && !st.deepDue.doneAt && logHas(/\[BRIGHTDATA-UP\].*deep sweep/), 'C8 lượt OK thứ 2 → [BRIGHTDATA-UP] + deepDue (ngưng 40′ ≥ 30′)'); }
clockOff += 60e3; { const n0 = BD.triggers.length; await ixm.scanAll('scheduled'); const t = BD.triggers[BD.triggers.length - 1]; const st = sysDoc('brightdata');
  if (process.env.LB_DBG) OUT('DBG C8', JSON.stringify({ n0, n: BD.triggers.length, t: t && t.inputs, st, last: scansAll()[scansAll().length - 1].sown, logs: LOGS.filter(l => /DEEP|\[B\]/.test(l)) }));
  ok(BD.triggers.length === n0 + 1 && t.inputs.length === 2 && t.inputs.every(i => i.start_date && i.num_of_posts >= 10 && i.num_of_posts <= 200) && st.deepDue.doneAt > 0 && logHas(/\[BRIGHTDATA-DEEP\]/) && scansAll()[scansAll().length - 1].sown === 2, 'C8 lượt sau: deep sweep MỌI group (start_date = lúc ngưng − 1 h, numPosts theo rate×giờ + 10) 1 lần, deepDue.doneAt'); }
/* C9 score_retry theo brand */
fresh(); clockOff = 0; BD.recordsFor = i => (i.url === G1 ? [rec('r1')] : []); await ixm.scanAll('scheduled'); clockOff += 130e3; route.main = () => err(500, null, 'server_error', 'x'); await ixm.scanAll('scheduled');
{ const R = retries(); ok(leads().length === 0 && R.length === 2 && R.map(r => r.id).sort().join(',') === 'R_r1__b1,R_r1__b2' && R.every(r => r.src.source_id && r.src.fanout === true) && R.find(r => r.id === 'R_r1__b2').src.brand === 'b2' && (seenOf('r1').brands.b1 === 'pending'), 'C9 LLM 500: 2 brand → 2 doc chờ R_<post_id>__<brand> (src.source_id/fanout), seen.brands giữ pending'); }
route.main = () => good(LEAD); clockOff += 4 * 60e3; calls = []; await ixm.scanAll('scheduled');
{ const L = leads(); ok(L.length === 2 && L.map(l => l.id).sort().join(',') === 'L_r1__b1,L_r1__b2' && L.find(l => l.id === 'L_r1__b2').brand === 'b2' && L.find(l => l.id === 'L_r1__b2').source === 'Hải sản B2' && retries().length === 0 && seenOf('r1').brands.b2 === 'lead', 'C9 nạp lại theo source_id → 2 lead đúng brand/nguồn, score_retry rỗng, seen.brands = lead'); }
/* C10 bình luận: gieo chỉ khi num_comments > 0, lastAt sau gieo OK, fan-out brand */
fresh({ comments: true }); clockOff = 0; const P2 = G1 + 'posts/c2/';
BD.recordsFor = i => (i.url === G1 ? [rec('c1', { num_comments: 0 }), rec('c2', { num_comments: 2 })] : []);
BD.cmtRecordsFor = i => (i.url === P2 ? [{ comment_id: 'Y29tbWVudDoxMDAyXzk5OQ==', comment_text: 'Ib giá giúp em', post_url: P2 + '?locale=en_US', user_name: 'Hien', commentator_profile_url: 'https://www.facebook.com/groups/1189400231607822/user/100012345678901/?__cft__[0]=x', date_created: new Date().toISOString() }] : []);
await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled');
{ const cmtT = BD.triggers.filter(t => t.isCmt); const last = scansAll()[1]; const cs = [...F.store.entries()].filter(([k]) => k.startsWith('cmt_scrape/')).map(([k, v]) => ({ k, v }));
  if (process.env.LB_DBG) OUT('DBG C10', JSON.stringify({ cmtT: cmtT.map(t => t.inputs), noCmt: last && last.noCmt, cs, leads: leads().map(l => l.id), logs: LOGS.slice(-12) }));
  const csLast = cs.filter(x => x.v.lastAt > 0); ok(cmtT.length === 1 && cmtT[0].inputs.length === 1 && cmtT[0].inputs[0].url === P2 && last.noCmt === 1 && csLast.length === 1 && csLast[0].k.includes('c2') && leads().length === 4, 'C10 gặt 2 bài: c1 (0 bình luận) KHÔNG gieo snapshot bình luận (noCmt 1); c2 gieo 1 snapshot; cmt_scrape.lastAt chỉ cho c2 (ghi SAU gieo OK); 4 lead bài');
  const g = gsDoc(GK); ok(g.watch && g.watch.c1 && g.watch.c1.checks === 0 && !g.watch.c2, 'C10 bài c1 ra lead nhưng 0 bình luận → vào watch_posts (group_state.watch), c2 không'); }
clockOff += 130e3; await ixm.scanAll('scheduled');
{ const L = leads().filter(l => l.kind === 'comment'); const last = scansAll()[2];
  const CID = 'L_' + 'cmt_Y29tbWVudDoxMDAyXzk5OQ=='.replace(/[^\w-]/g, '_'); if (process.env.LB_DBG) OUT('DBG C10b', JSON.stringify({ ids: leads().map(l => l.id), cf: last && last.commentsFetched, logs: LOGS.slice(-8) }));
  ok(L.length === 2 && L.map(l => l.id).sort().join(',') === CID + '__b1,' + CID + '__b2' && L.every(l => l.comment_id === '999') && L.every(l => l.parent_url === P2 && l.author_uid === '100012345678901' && l.shared_post === true && l.gid === '1189400231607822') && L.find(l => l.id === CID + '__b2').brand === 'b2' && L.find(l => l.id === CID + '__b2').source === 'Hải sản B2' && last.commentsFetched === 2, 'C10 gặt bình luận → fan-out 2 brand → L_cmt_<cid>__<brand> (comment_id 999, parent_url, author_uid, gid, shared_post)'); }
{ fresh({ comments: true }); clockOff = 0; BD.recordsFor = i => (i.url === G1 ? [rec('c3', { num_comments: 5 })] : []); await ixm.scanAll('scheduled'); clockOff += 130e3; const realFetch = globalThis.fetch; globalThis.fetch = async (u, o) => (String(u).includes('dataset_id=gd_cmt') ? mk({ status: 500, body: 'boom' }) : realFetch(u, o)); await ixm.scanAll('scheduled'); globalThis.fetch = realFetch;
  ok([...F.store.values()].filter(v => v && v.lastAt && v.firstAt).length === 0 && leads().length === 2, 'C10 gieo snapshot bình luận LỖI → KHÔNG ghi cmt_scrape.lastAt (lượt sau gieo lại) — S6'); }
/* C11 Quét ngay (đường cũ): 1 lần/group + fan-out */
{ let fpCalls = []; fresh({ fetchPosts: async (s, o) => { fpCalls.push(s.__id); const arr = s.url === G1 ? [rec('m1'), rec('m2')].map(r => sr.normalizePost(r, s)) : []; arr.bd = 'ok'; return arr; } }); clockOff = 0;
  const r = await ixm.scanAll('manual', { jobId: 'j1' }); const L = leads();
  ok(fpCalls.length === 2 && fpCalls.includes('src_b1') && !fpCalls.includes('src_b2') && L.length === 4 && L.map(l => l.id).sort().join(',') === 'L_m1__b1,L_m1__b2,L_m2__b1,L_m2__b2' && L.find(l => l.id === 'L_m2__b2').brand === 'b2' && r.kept === 4 && seenOf('m1').brands.b1 === 'lead' && seenOf('m1').brands.b2 === 'lead', 'C11 Quét ngay: BrightData gọi 1 lần/group (nguồn chủ, không gọi nguồn dùng chung) → fan-out → 4 lead tất định, seen.brands 2 brand'); }
/* C12 watch_posts: lượt sweep loại bài theo dõi khỏi notInclude, checks +1 */
{ fresh(); clockOff = 0; const now = Date.now(); await F.db.collection('group_state').doc(GK).set({ url: G1, rate: 1, rateN: 3, band: 'mid', lastTriggerAt: now - 20 * 60e3, lastHarvestAt: now - 20 * 60e3, lastSweepAt: now - 3 * 3600e3, lastPostAt: now - 20 * 60e3, recentIds: ['w1', 'w2', 'w3'], watch: { w2: { url: G1 + 'posts/w2/', at: now - 3600e3, checks: 0 } } });
  await ixm.scanAll('scheduled'); const inp = BD.triggers[0].inputs.find(i => i.url === G1); const g = gsDoc(GK);
  ok(inp.start_date && inp.posts_to_not_include.join(',') === 'w1,w3' && g.watch.w2.checks === 1 && g.watch.w2.lastCheckAt > 0, 'C12 sweep: bài theo dõi w2 loại khỏi notInclude (BrightData trả lại record với num_comments), checks +1'); }
/* C13 BrightData busy (429 progress) → hoãn gieo, rows busy */
{ fresh(); clockOff = 0; BD.recordsFor = () => []; await ixm.scanAll('scheduled'); clockOff += 130e3; BD.busy = true; await ixm.scanAll('scheduled'); BD.busy = false; const last = scansAll()[scansAll().length - 1];
  if (process.env.LB_DBG) OUT('DBG C13', JSON.stringify({ n: scansAll().length, last: last && { bdBusy: last.bdBusy, harvested: last.harvested, sown: last.sown }, pend: [...F.store.keys()].filter(k => k.startsWith('pending')), logs: LOGS.slice(-6) }));
  ok(last.bdBusy === 1 && last.harvested === 0 && last.sown === 0 && [...F.store.keys()].filter(k => k.startsWith('pending_snapshots/PB_')).length === 1 && !logHas(/\[BRIGHTDATA-DOWN\]/) && !(sysDoc('brightdata') && sysDoc('brightdata').ok === false), 'C13 progress 429 → busy: không gặt, giữ pending, không gieo thêm, KHÔNG tính là BrightData ngưng (không ERROR)'); }

/* ---------- D. outreach.js — khoá tranh chấp automation ---------- */
OUT('-- outreach.js (acquireLocksB · skipped_shared · stepNick · sweep44)');
const oam = await import(pathToFileURL(path.join(W, 'outreach.js')).href);
const stm = await import(pathToFileURL(path.join(W, 'stats.js')).href);
{ const F0 = stub.makeDb(); globalThis.__slB = { db: F0.db }; globalThis.__sl48 = { db: F0.db }; clockOff = 0;
  const db = F0.db; const now = Date.now();
  const brandA = { code: 'b1', name: 'Brand 1', outreach: { on: true } }, brandB = { code: 'b2', name: 'Brand 2', outreach: { on: true } };
  const acctA = { id: 'apA', pid: 'apA', adspower_id: 'k1', brand: 'b1', engine: 'adspower' }, acctB = { id: 'apB', pid: 'apB', adspower_id: 'k2', brand: 'b2', engine: 'adspower' };
  const leadA = { id: 'L_p1__b1', name: 'Khách', temp: 'hot', score: 90, post_url: G1 + 'posts/p1/', post_id: 'p1', author_url: 'https://www.facebook.com/profile.php?id=100012345678901', author_uid: '100012345678901', brand: 'b1', stage: 'new', detected_at: now - 60e3 };
  const leadB = Object.assign({}, leadA, { id: 'L_p1__b2', brand: 'b2' });
  await db.collection('leads').doc(leadA.id).set(leadA); await db.collection('leads').doc(leadB.id).set(leadB);
  const keys = oam.lockKeysB(leadA); ok(keys.join(',') === 'post_p1,person_100012345678901', 'lockKeysB: lead-bài có uid số → post_<post_id> + person_<uid>');
  ok(oam.lockKeysB({ post_url: G1 + 'posts/1002/', author_url: 'https://www.facebook.com/Ng.April2704' }).join(',') === 'post_1002,person_u_ng.april2704' && oam.lockKeysB({ post_url: G1 + 'posts/1003/', comment_id: '555', comment_url: G1 + 'posts/1003/?comment_id=555', author_url: 'https://www.facebook.com/profile.php?id=pfbid02abcdefghijklmnop' }).join(',') === 'cmt_555,person_pfbid02abcdefghijklmnop' && oam.lockKeysB({ post_url: G1 + 'posts/1004/' }).join(',') === 'post_1004', 'lockKeysB: lead cũ không post_id → post_<số từ URL>; username → person_u_<fold>; comment-lead → cmt_<cid> (KHÔNG khoá bài); pfbid → person_<pfbid>; không tác giả → chỉ khoá bài');
  const t1 = db.collection('outreach_threads').doc(leadA.id), t2 = db.collection('outreach_threads').doc(leadB.id);
  const r1 = await oam.apEnqueueFunnel(acctA, brandA, leadA, t1);
  const lk = F0.store.get('outreach_locks/post_p1'), pk = F0.store.get('outreach_locks/person_100012345678901');
  ok(r1 === true && lk && lk.brand === 'b1' && lk.state === 'reserved' && lk.leadId === 'L_p1__b1' && lk.expireAt > now && pk && pk.brand === 'b1' && (F0.store.get('outreach_threads/L_p1__b1') || {}).lockKeysB.length === 2 && F0.store.get('outreach_tasks/L_p1__b1__funnel'), 'apEnqueueFunnel brand A: lấy 2 khoá (post + person, reserved 6 h) → task + thread có lockKeysB');
  const usageB0 = F0.store.get('outreach_usage/apB__' + new Date(now + 7 * 3600e3).toISOString().slice(0, 10));
  const r2 = await oam.apEnqueueFunnel(acctB, brandB, leadB, t2); const th2 = F0.store.get('outreach_threads/L_p1__b2'); const usageB = F0.store.get('outreach_usage/apB__' + new Date(now + 7 * 3600e3).toISOString().slice(0, 10));
  ok(r2 === false && th2 && th2.step === 'skipped_shared' && th2.active === true && th2.nextAt === lk.expireAt && th2.lockedBy === 'b1' && !F0.store.get('outreach_tasks/L_p1__b2__funnel') && !usageB && !usageB0 && [...F0.store.values()].some(v => v && /Nhường — brand b1/.test(String(v.action || ''))), 'apEnqueueFunnel brand B cùng bài: THUA khoá → thread skipped_shared active, nextAt = hết hạn khoá, KHÔNG task, KHÔNG đốt van (usage rỗng), log ⏭ Nhường');
  /* người khác bình luận dưới cùng bài của brand B → không bị chặn */
  const leadC = { id: 'L_cmt_777__b2', name: 'Người khác', temp: 'hot', score: 85, post_url: G1 + 'posts/p1/', post_id: 'cmt_777', kind: 'comment', comment_id: '777', comment_url: G1 + 'posts/p1/?comment_id=777', author_url: 'https://www.facebook.com/profile.php?id=100099999999999', author_uid: '100099999999999', brand: 'b2', stage: 'new' };
  const r3 = await oam.apEnqueueFunnel(acctB, brandB, leadC, db.collection('outreach_threads').doc(leadC.id));
  ok(r3 === true && F0.store.get('outreach_locks/cmt_777').brand === 'b2' && F0.store.get('outreach_locks/person_100099999999999').brand === 'b2', 'comment-lead người KHÁC dưới cùng bài → brand B vẫn tiếp cận (khoá cmt_/person_ riêng, không đụng post_)');
  /* cùng người đăng bài khác ở group khác → bị khoá person */
  const leadD = { id: 'L_p8__b2', name: 'Khách', temp: 'hot', score: 88, post_url: 'https://www.facebook.com/groups/999/posts/p8/', post_id: 'p8', author_url: 'https://www.facebook.com/profile.php?id=100012345678901', author_uid: '100012345678901', brand: 'b2', stage: 'new' };
  const r4 = await oam.apEnqueueFunnel(acctB, brandB, leadD, db.collection('outreach_threads').doc(leadD.id));
  ok(r4 === false && (F0.store.get('outreach_threads/L_p8__b2') || {}).step === 'skipped_shared' && (F0.store.get('outreach_threads/L_p8__b2') || {}).lockKey === 'person_100012345678901' && !F0.store.get('outreach_locks/post_p8'), 'cùng NGƯỜI đăng ở group khác → brand B nhường theo khoá person_ (không tạo khoá post_p8)');
  /* stepNickAdspower retry: khoá còn hạn → vẫn nhường; hết hạn → chạy */
  await db.collection('fb_accounts').doc('apB').set({ brand: 'b2', engine: 'adspower', adspower_id: 'k2', active: true, nextFreeAt: 0 });
  clockOff += 7 * 3600e3; // khoá reserved 6 h hết hạn
  await db.collection('outreach_threads').doc('L_cmt_777__b2').set({ active: false }, { merge: true }); await db.collection('outreach_threads').doc('L_p8__b2').set({ active: false }, { merge: true }); // chỉ còn thread skipped_shared L_p1__b2 tới hạn
  const r5 = await oam.stepNickAdspower(brandB, acctB); const th2b = F0.store.get('outreach_threads/L_p1__b2'); const lk2 = F0.store.get('outreach_locks/post_p1');
  if (process.env.LB_DBG) OUT('DBG D5', JSON.stringify({ r5, th2b, lk2, logs: LOGS.slice(-5) }));
  ok(r5 === true && th2b.step === 'funnel' && th2b.taskStatus === 'queued' && lk2.brand === 'b2' && F0.store.get('outreach_tasks/L_p1__b2__funnel'), 'stepNickAdspower: thread skipped_shared tới hạn + khoá A hết hạn (A không chạm) → brand B lấy khoá, xếp phễu');
  /* touched (brand A đã chạm) → nhường vĩnh viễn */
  await db.collection('outreach_locks').doc('post_p1').set({ brand: 'b1', leadId: 'L_p1__b1', state: 'touched', at: Date.now(), expireAt: Date.now() + 14 * 86400e3 });
  const leadE = Object.assign({}, leadB, { id: 'L_p1__b3', brand: 'b3' }); const r6 = await oam.apEnqueueFunnel({ id: 'apC', pid: 'apC', adspower_id: 'k3' }, { code: 'b3', name: 'B3' }, leadE, db.collection('outreach_threads').doc(leadE.id));
  ok(r6 === false && F0.store.get('outreach_threads/L_p1__b3').active === false && F0.store.get('outreach_threads/L_p1__b3').step === 'skipped_shared' && /đã chạm/.test(F0.store.get('outreach_threads/L_p1__b3').skipReason + [...F0.store.values()].map(v => v && v.action).join(' ')), 'khoá touched (brand khác ĐÃ chạm) → nhường vĩnh viễn (thread active:false)');
  /* stats.stopMachine nhả khoá reserved (không nhả touched) */
  await db.collection('outreach_locks').doc('post_p1').set({ brand: 'b2', leadId: 'L_p1__b2', state: 'reserved', at: Date.now(), expireAt: Date.now() + 6 * 3600e3 });
  await db.collection('outreach_locks').doc('person_100012345678901').set({ brand: 'b2', leadId: 'L_p1__b2', state: 'reserved', at: Date.now(), expireAt: Date.now() + 6 * 3600e3 }); await db.collection('outreach_locks').doc('post_other').set({ brand: 'b2', leadId: 'L_p1__b2', state: 'touched', at: Date.now(), expireAt: Date.now() + 6 * 3600e3 });
  const stopped = await stm.stopMachine(db, 'L_p1__b2', 'sales đã chăm lead'); if (process.env.LB_DBG) OUT('DBG D7', JSON.stringify({ stopped, lk: F0.store.get('outreach_locks/post_p1'), pk: F0.store.get('outreach_locks/person_100012345678901'), th: F0.store.get('outreach_threads/L_p1__b2'), logs: LOGS.slice(-4) })); ok(stopped === true && !F0.store.get('outreach_locks/post_p1') && !F0.store.get('outreach_locks/person_100012345678901') && F0.store.get('outreach_locks/post_other') && (F0.store.get('outreach_threads/L_p1__b2') || {}).step === 'human', 'stats.stopMachine (người thật tiếp quản) → nhả khoá reserved của lead (post + person), giữ khoá touched');
  /* sweep44 expired → nhả khoá */
  await db.collection('outreach_threads').doc('L_old__b1').set({ leadId: 'L_old__b1', brand: 'b1', brandCode: 'b1', pid: 'apA', active: true, step: 'funnel', fpayload: { steps: ['react'] }, createdAt: Date.now() - 80 * 3600e3, nextAt: Date.now() - 79 * 3600e3, lockKeysB: ['post_old'] });
  await db.collection('outreach_locks').doc('post_old').set({ brand: 'b1', leadId: 'L_old__b1', state: 'reserved', at: Date.now() - 80 * 3600e3, expireAt: Date.now() + 1e9 });
  await db.collection('fb_accounts').doc('apA').set({ brand: 'b1', engine: 'adspower', adspower_id: 'k1', active: true, nextFreeAt: 0 });
  const brandMap = { b1: brandA, b2: brandB }; const sw = await oam.outreachTick.call ? null : null; void sw;
  const stRef = db.collection('system_status').doc('outreach'); await stRef.set({ at: 0 });
  const mod = oam; const sweep = mod.outreachTick; void sweep; // sweep44 chạy trong outreachTick
  await db.collection('brands').doc('b1').set({ name: 'Brand 1', outreach: { on: true } }); await db.collection('brands').doc('b2').set({ name: 'Brand 2', outreach: { on: true } });
  await oam.outreachTick();
  ok((F0.store.get('outreach_threads/L_old__b1') || {}).step === 'expired' && !F0.store.get('outreach_locks/post_old'), 'sweep44 (outreachTick): phễu quá 72 h → đóng + NHẢ khoá post_old');
  /* stepNick (func path): thua khoá → skipped_shared; drive() thử lại khi hết hạn */
  const F1 = stub.makeDb(); globalThis.__slB = { db: F1.db }; globalThis.__sl48 = { db: F1.db }; clockOff = 0;
  await F1.db.collection('leads').doc('L_f1__b2').set({ name: 'Khách F', temp: 'hot', score: 90, post_url: G1 + 'posts/7001/', post_id: '7001', author_url: 'https://www.facebook.com/profile.php?id=100055555555555', brand: 'b2', stage: 'new', detected_at: Date.now() - 60e3 });
  await F1.db.collection('outreach_locks').doc('post_7001').set({ brand: 'b1', leadId: 'L_f1__b1', state: 'reserved', at: Date.now(), expireAt: Date.now() + 3600e3 });
  const acctF = { id: 'fbu2', pid: 'fbu2', engine: 'func', brand: 'b2', tokenSet: true };
  globalThis.getToken = async () => 'tok'; globalThis.doReact = async () => false; globalThis.doComment = async () => false; globalThis.doInbox = async () => false; /* fixture #46 không có các hàm func-path này */
  await F1.db.collection('brands').doc('b2').set({ name: 'Brand 2', outreach: { on: true } }); await F1.db.collection('fb_accounts').doc('fbu2').set({ brand: 'b2', engine: 'func', tokenSet: true, active: true, nextFreeAt: 0 });
  await oam.outreachTick(); const thf = F1.store.get('outreach_threads/L_f1__b2'); if (process.env.LB_DBG) OUT('DBG D8', JSON.stringify({ thf, logs: LOGS.slice(-5), keys: [...F1.store.keys()] }));
  ok(thf && thf.step === 'skipped_shared' && thf.active === true && thf.nextAt === (F1.store.get('outreach_locks/post_7001') || {}).expireAt && thf.retryAt === thf.nextAt && !F1.store.get('outreach_usage/fbu2__' + new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)), 'stepNick (func): thua khoá → thread skipped_shared, nextAt = hết hạn khoá, không đốt van');
  clockOff += 3700e3; await F1.db.collection('fb_accounts').doc('fbu2').set({ nextFreeAt: 0 }, { merge: true }); await oam.outreachTick(); const thf2 = F1.store.get('outreach_threads/L_f1__b2');
  ok(thf2 && thf2.step !== 'skipped_shared' && (F1.store.get('outreach_locks/post_7001') || {}).brand === 'b2', 'stepNick drive(): khoá hết hạn → lấy khoá cho b2, chuyển step react (chạy phễu func)'); }

/* ---------- E. scanstats · sources.js · tagLeadBrand ---------- */
OUT('-- scanstats.js · sources.js (createSource · sourceOnWrite · bdReady) · tagLeadBrand');
{ const ssm = await import(pathToFileURL(path.join(W, 'scanstats.js')).href);
  const bm = ssm.brandMapOf([{ url: G1, brand: 'b1' }]); const evs = ssm.scanEvents({ at: Date.now(), bySource: [{ url: G1, brand: 'b1', source_id: 'src_b1', posts: 3, bdPosts: 3, bd: 'ok' }, { url: G1b, brand: 'b2', source_id: 'src_b2', posts: 3, bdPosts: 0, bd: 'ok', bdShared: true }, { url: 'https://www.facebook.com/groups/legacy/', posts: 2, bd: 'ok' }] }, bm);
  ok(evs.length === 2 && evs.find(e => e.brand === 'b1').inc.scanned === 3 && evs.find(e => e.brand === 'b2').inc.scanned === 3 && evs.find(e => e.brand === 'b2').inc.scanRuns === 1, 'scanstats: dòng có brand → đếm cho ĐÚNG brand (group dùng chung không dồn về 1 brand); dòng cũ không brand → tra theo URL như trước'); }
{ const F0 = stub.makeDb(); globalThis.__slB = { db: F0.db, verify: async t => ({ uid: t === 'tok-super' ? 'uSuper' : 'uAdm', email: t === 'tok-super' ? 'super@x' : 'adm@x' }) }; globalThis.__sl48 = { db: F0.db }; clockOff = 0; stub.pushLog.length = 0; LOGS.length = 0;
  process.env.SUPER_EMAIL = 'super@x'; const srcm = await import(pathToFileURL(path.join(W, 'sources.js')).href);
  await F0.db.collection('users').doc('uSuper').set({ role: 'superadmin', active: true, fcmTokens: ['t1'] }); await F0.db.collection('users').doc('uAdm').set({ role: 'admin', active: true, brand: 'b2' });
  await F0.db.collection('sources').doc('1189400231607822').set({ name: 'Hải sản B1', url: G1, brand: 'b1', active: true });
  const req = (tok, body) => ({ get: h => (h === 'Authorization' ? 'Bearer ' + tok : ''), body, query: {} }); const res = () => { const r = { code: 200, json: null }; r.status = c => { r.code = c; return r; }; r.jsonFn = o => { r.json = o; return r; }; r.json = o => { r.body = o; return r; }; return r; };
  let r = res(); await srcm.createSource(req('tok-adm', { url: 'https://facebook.com/groups/1189400231607822?ref=share', name: 'Hải sản B2', brand: 'b2', keywords: 'mực khô, cá khô' }), r);
  const d = F0.store.get('sources/1189400231607822__b2');
  ok(r.code === 200 && r.body.ok && r.body.id === '1189400231607822__b2' && r.body.shared === true && r.body.sharedWith.join() === 'b1' && d && d.url === G1 && d.gid === '1189400231607822' && d.sharedAt > 0 && d.sharedBy === 'uAdm' && d.keywords.length === 2 && d.createdBy === 'uAdm', 'createSource (admin brand b2): URL chuẩn hoá, id <gid>__<brand>, group đã có b1 → shared + sharedAt/sharedBy/sharedWith');
  r = res(); await srcm.createSource(req('tok-adm', { url: G1, name: 'Khác', brand: 'b2' }), r); ok(r.code === 409 && r.body.error === 'duplicate', 'createSource: cùng brand + cùng group → 409 duplicate');
  r = res(); await srcm.createSource(req('tok-adm', { url: 'https://www.facebook.com/groups/999999999/', name: 'hai san b2', brand: 'b2' }), r); ok(r.code === 409 && r.body.error === 'duplicate_name', 'createSource: cùng brand + trùng TÊN (bỏ dấu) → 409 duplicate_name');
  r = res(); await srcm.createSource(req('tok-adm', { url: 'https://www.facebook.com/groups/999999999/', name: 'Nguồn b1', brand: 'b1' }), r); ok(r.code === 403, 'createSource: admin brand b2 tạo cho b1 → 403');
  r = res(); await srcm.createSource(req('tok-super', { url: 'https://www.facebook.com/groups/vieclamtotchosv/', name: 'Việc làm', brand: 'b3' }), r); ok(r.code === 200 && r.body.id === 'vieclamtotchosv__b3' && r.body.shared === false && F0.store.get('sources/vieclamtotchosv__b3').gid === '', 'createSource (super): group slug chưa học gid → id <slug>__<brand>, gid rỗng (học lúc gặt)');
  r = res(); await srcm.createSource(req('tok-super', { url: 'https://www.facebook.com/profile.php?id=1', name: 'x', brand: 'b3' }), r); ok(r.code === 400 && r.body.error === 'bad_url', 'createSource: URL không phải group → 400');
  r = res(); await srcm.createSource({ get: () => '', body: { url: G1, name: 'x', brand: 'b3' }, query: {} }, r); ok(r.code === 401, 'createSource: không token → 401');
  /* sourceOnWrite */
  const ev = (before, after, id) => ({ params: { id }, data: { before: { exists: !!before, data: () => before }, after: { exists: !!after, data: () => after } } });
  await srcm.sourceOnWrite(ev(null, F0.store.get('sources/1189400231607822__b2'), '1189400231607822__b2'));
  const st = F0.store.get('system_status/sources'); const ent = st && st.shared && st.shared['g_1189400231607822'];
  ok(ent && ent.brands.join(',') === 'b1,b2' && ent.name === 'Hải sản B1' && ent.by === 'uAdm' && ent.ackAt === null && ent.sources.length === 2 && stub.pushLog.length === 1 && stub.pushLog[0].tokens.join() === 't1' && /Group dùng chung/.test(stub.pushLog[0].data.title) && logHas(/"severity":"WARNING".*\[SOURCE-SHARED\]/), 'sourceOnWrite: group 2 brand → system_status/sources.shared[g_<gid>] {brands, name nguồn chủ, by, sources[]} + push FCM super + WARNING [SOURCE-SHARED]');
  stub.pushLog.length = 0; const a2 = Object.assign({}, F0.store.get('sources/1189400231607822__b2'), { keywords: ['x'] }); await srcm.sourceOnWrite(ev(F0.store.get('sources/1189400231607822__b2'), a2, '1189400231607822__b2'));
  ok(stub.pushLog.length === 0, 'sourceOnWrite: chỉ đổi keywords (không gid/brand/active/url/sharedAt/name) → bỏ qua, không push lại');
  await F0.db.collection('sources').doc('1189400231607822__b2').set({ active: false }, { merge: true }); await srcm.sourceOnWrite(ev(a2, F0.store.get('sources/1189400231607822__b2'), '1189400231607822__b2'));
  ok(!(F0.store.get('system_status/sources').shared || {})['g_1189400231607822'] && stub.pushLog.length === 0 && logHas(/không còn dùng chung/), 'sourceOnWrite: tắt nguồn b2 → group còn 1 brand → gỡ khỏi system_status/sources.shared');
  /* bdReady */
  process.env.BD_NOTIFY_KEY = 'k1'; await F0.db.collection('pending_snapshots').doc('PB_sd_9').set({ kind: 'posts', snapshot_id: 'sd_9', t: Date.now(), ready: false });
  r = res(); await srcm.bdReady({ get: () => '', query: { key: 'bad' }, body: { snapshot_id: 'sd_9' } }, r); ok(r.code === 403, 'bdReady: sai key → 403');
  r = res(); await srcm.bdReady({ get: () => '', query: { key: 'k1' }, body: { snapshot_id: 'sd_9', status: 'ready' } }, r); ok(r.code === 200 && r.body.updated === 1 && F0.store.get('pending_snapshots/PB_sd_9').ready === true, 'bdReady: đúng key + snapshot_id → pending PB_ ready:true (lượt kế gặt ngay)');
  delete process.env.BD_NOTIFY_KEY;
  /* notify → harvest không chờ 120 s */
  CFG.BD_NOTIFY_URL = 'https://x/bdReady?key=k1'; const hv = await sr.harvestPostsB({ runId: 'rn', minAgeS: 0 }); ok(hv.pending === 0 && (hv.harvested === 1 || hv.failed === 1), 'harvestPostsB với notify: snapshot ready:true được gặt/xét ngay (không chờ minAge)'); CFG.BD_NOTIFY_URL = '';
  /* tagLeadBrand (codebase2) đã vá */
  const tag = await import(pathToFileURL(path.join(W, 'codebase2', 'tagLeadBrand.mjs')).href);
  await F0.db.collection('sources').doc('dup1').set({ name: 'Trùng tên', brand: 'b1' }); await F0.db.collection('sources').doc('dup2').set({ name: 'Trùng tên', brand: 'b2' });
  await F0.db.collection('leads').doc('L_x__b2').set({ source: 'Trùng tên', brand_hint: 'b2', brand_pending: true });
  await tag.tagLeadBrand({ params: { leadId: 'L_x__b2' }, data: { data: () => F0.store.get('leads/L_x__b2'), ref: F0.db.collection('leads').doc('L_x__b2') } });
  const lx = F0.store.get('leads/L_x__b2'); ok(lx.brand === 'b2' && lx.brand_tagged_by === 'brand_hint' && !('brand_pending' in lx), 'tagLeadBrand vá: 2 nguồn TRÙNG TÊN khác brand → dùng brand_hint (b2) thay tra tên (limit 1 = b1)');
  await F0.db.collection('leads').doc('L_y').set({ source: 'Trùng tên' }); await tag.tagLeadBrand({ params: { leadId: 'L_y' }, data: { data: () => F0.store.get('leads/L_y'), ref: F0.db.collection('leads').doc('L_y') } });
  ok(F0.store.get('leads/L_y').brand === 'b1' && F0.store.get('leads/L_y').brand_tagged_by === 'tagLeadBrand', 'tagLeadBrand vá: lead cũ không brand_hint → tra theo tên như trước'); }

OUT('\n== KẾT QUẢ: ' + pass + '/' + (pass + fail) + (fail ? ' — ' + fail + ' FAIL' : ' PASS') + ' ==');
process.exit(fail ? 1 : 0);
