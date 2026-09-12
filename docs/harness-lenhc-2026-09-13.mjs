/* HARNESS LỆNH C (13/09/2026) — dựng MÃ ĐANG CHẠY = fixture B + patch B (7 file) + push.js (fixture #46 + patch #46) → áp patch C → kiểm:
   patch OK/idempotent/LỆCH/--check · stats.js statsEvents (máy loại → trừ, sales loại → giữ, đổi nhiệt → chuyển bucket, aiDropped/dropped) · push.js hotGateC (brand_hint xuất hiện 1 lần, tagged, rescored, loại/vai)
   · index.js healthEvalC (noLead/silent/err, dọn ngày cũ, alertedAt 6 h, ERROR ≥½) + scanAll trọn vòng trên Firestore giả (source_health ghi cuối lượt, health ở nhịp việc phụ, bfKey theo brand)
   · Rules patch · ZBS patch · recount newAgg. LC_EXPORT_DIR=<dir> → xuất fake ~ (firebase-s13/functions ĐÃ patch B + firestore.rules + smartlead-zalo-fn) cho dry-run .sh rồi thoát. Chạy: node docs/harness-lenhc-2026-09-13.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, 'lenh-2026-09-12-b-fixture'), PB = path.join(HERE, 'lenh-2026-09-12-b-patch.cjs'), FX46 = path.join(HERE, 'lenh-2026-09-11-46-fixture'), P46 = path.join(HERE, 'lenh-2026-09-11-46-patch.cjs');
const PC = path.join(HERE, 'lenh-2026-09-13-c-patch.cjs'), PR = path.join(HERE, 'lenh-2026-09-13-c-rules.cjs'), PZ = path.join(HERE, 'lenh-2026-09-13-c-zbs.cjs'), REC = path.join(HERE, 'lenh-2026-09-13-c-recount.mjs'), DUMP = path.join(HERE, 'lenh-2026-09-12-47-dump');
const cpDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) cpDir(s, d); else fs.copyFileSync(s, d); } };
const FILES_B = ['lib/config.js', 'lib/scraper.js', 'index.js', 'outreach.js', 'stats.js', 'scanstats.js', 'lib/multitouch.js'], FILES_C = ['stats.js', 'push.js', 'index.js'];
const OUT = console.log.bind(console); let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; OUT('  ✓', m); } else { fail++; OUT('  ✗', m); } };
const run = (cwd, args, env) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
function fakeNodeModules(dir) {
  const nm = path.join(dir, 'node_modules'); const stub = path.relative(path.join(nm, 'firebase-admin'), path.join(dir, 'stubB.mjs')).split(path.sep).join('/');
  fs.mkdirSync(path.join(nm, 'firebase-admin'), { recursive: true }); fs.mkdirSync(path.join(nm, 'firebase-functions', 'v2'), { recursive: true });
  fs.writeFileSync(path.join(nm, 'firebase-admin', 'package.json'), JSON.stringify({ name: 'firebase-admin', type: 'module', exports: { './app': './app.js', './firestore': './firestore.js', './auth': './auth.js', './messaging': './messaging.js' } }));
  for (const f of ['app', 'firestore', 'auth', 'messaging']) fs.writeFileSync(path.join(nm, 'firebase-admin', f + '.js'), "export * from '" + stub + "';\n");
  const stub2 = path.relative(path.join(nm, 'firebase-functions', 'v2'), path.join(dir, 'stubB.mjs')).split(path.sep).join('/');
  fs.writeFileSync(path.join(nm, 'firebase-functions', 'package.json'), JSON.stringify({ name: 'firebase-functions', type: 'module', exports: { './v2': './v2/index.js', './v2/https': './v2/https.js', './v2/firestore': './v2/firestore.js', './v2/scheduler': './v2/scheduler.js' } }));
  for (const f of ['index', 'https', 'firestore', 'scheduler']) fs.writeFileSync(path.join(nm, 'firebase-functions', 'v2', f + '.js'), "export * from '" + stub2 + "';\n");
}
/* cây = MÃ ĐANG CHẠY (sau B): fixture B + patch B; push.js = fixture 46 + patch 46 */
function prepRunning(W) {
  cpDir(FX, W); fs.copyFileSync(path.join(W, 'stubB.mjs'), path.join(W, 'stub48.mjs')); fs.copyFileSync(path.join(W, 'stubB.mjs'), path.join(W, 'stub.mjs')); fakeNodeModules(W);
  for (const f of ['stats.js', 'scanstats.js']) { const p = path.join(W, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/from '<che>'/g, "from './stubB.mjs'")); }
  fs.copyFileSync(path.join(HERE, 'lenh-2026-09-12-b-sources.js'), path.join(W, 'sources.js')); /* mã đang chạy có sources.js (LỆNH B) */
  const rb = run(W, [PB, ...FILES_B]); if (rb.code !== 0 || !/PATCH OK 7 file/.test(rb.out)) throw new Error('không dựng được mã sau B: ' + rb.out.slice(0, 300));
  const W46 = fs.mkdtempSync(path.join(os.tmpdir(), 'lc46-')); cpDir(FX46, W46); const r46 = run(W46, [P46, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']); if (r46.code !== 0) throw new Error('không dựng được push.js sau #46: ' + r46.out.slice(0, 300));
  fs.copyFileSync(path.join(W46, 'push.js'), path.join(W, 'push.js'));
  const rulesLine = fs.readFileSync(path.join(DUMP, 'scan-dump-0912.txt'), 'latin1').split('\n').find(l => l.includes("hasOnly(['stage', 'stage_at'"));
  const body = Buffer.from(rulesLine.replace(/^\s*\d+:/, ''), 'latin1').toString('utf8');
  fs.writeFileSync(path.join(W, '_rules_sample'), "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    function isSuperAdmin() { return true; }\n    match /leads/{id} {\n      allow update: if signedIn()\n" + body + "\n    }\n  }\n}\n");
  const zl = fs.readFileSync(path.join(DUMP, 'scan-dump-0912d.txt'), 'latin1').split('\n').slice(503, 571).filter(l => /^\s*\d+\t/.test(l)).map(l => l.replace(/^\s*\d+\t/, '')).join('\n') + '\n';
  fs.writeFileSync(path.join(W, '_zalo_sample.js'), Buffer.from(zl, 'latin1').toString('utf8'));
}
if (process.env.LC_EXPORT_DIR) { const H = process.env.LC_EXPORT_DIR; const F = path.join(H, 'firebase-s13', 'functions'); prepRunning(F);
  fs.writeFileSync(path.join(F, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-5.6-sol\nLLM_PREFILTER_MODEL=gpt-5-nano\nBRIGHTDATA_TOKEN=test-bd\nBRIGHTDATA_DATASET_ID=gd_x\nPOLL_MINUTES=3\n');
  fs.copyFileSync(path.join(F, '_rules_sample'), path.join(H, 'firebase-s13', 'firestore.rules')); fs.writeFileSync(path.join(H, 'firebase-s13', 'firebase.json'), '{}');
  fs.mkdirSync(path.join(H, 'smartlead-zalo-fn', 'functions'), { recursive: true }); fs.copyFileSync(path.join(F, '_zalo_sample.js'), path.join(H, 'smartlead-zalo-fn', 'functions', 'index.js')); fs.writeFileSync(path.join(H, 'smartlead-zalo-fn', 'firebase.json'), '{}');
  console.log('exported fake HOME (mã sau B, CHƯA patch C) →', H); process.exit(0); }

/* ---------- 0. patch ---------- */
OUT('-- patch C');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-')); prepRunning(W);
const r1 = run(W, [PC, ...FILES_C]); ok(r1.code === 0 && /PATCH OK 3 file/.test(r1.out), 'patch C áp trên mã sau B: PATCH OK 3 file' + (r1.code ? ' — ' + r1.out.slice(0, 400) : ''));
const r2 = run(W, [PC, ...FILES_C]); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of FILES_C) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f + (r.code ? ' — ' + r.out.slice(0, 200) : '')); }
{ const W2 = fs.mkdtempSync(path.join(os.tmpdir(), 'lc2-')); prepRunning(W2); fs.writeFileSync(path.join(W2, 'stats.js'), fs.readFileSync(path.join(W2, 'stats.js'), 'utf8').replace("  const countable = l =>", "  const countable_X = l =>"));
  const before = FILES_C.map(x => fs.readFileSync(path.join(W2, x), 'utf8')); const r = run(W2, [PC, ...FILES_C]); const same = FILES_C.every((x, i) => fs.readFileSync(path.join(W2, x), 'utf8') === before[i]);
  ok(r.code === 1 && /KHONG THAY MOC/.test(r.out) && /DỪNG/.test(r.out) && same, 'fail-closed NGUYÊN TỬ: 1 mốc stats.js lệch → không ghi file nào (kể cả push.js/index.js đủ mốc)'); }
{ const W3 = fs.mkdtempSync(path.join(os.tmpdir(), 'lc3-')); cpDir(W, W3); fs.copyFileSync(path.join(FX46, 'push.js'), path.join(W3, 'push.js')); const r46 = run(fs.mkdtempSync(path.join(os.tmpdir(), 'x-')), ['-e', '0']); void r46;
  const W46b = fs.mkdtempSync(path.join(os.tmpdir(), 'lc46b-')); cpDir(FX46, W46b); run(W46b, [P46, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']); fs.copyFileSync(path.join(W46b, 'push.js'), path.join(W3, 'push.js'));
  const r = run(W3, [PC, ...FILES_C]); ok(r.code === 1 && /LỆCH/.test(r.out), 'lệch (stats/index đã patch C, push.js chưa) → báo LỆCH, dừng'); }
{ const rr = run(W, [PR, '_rules_sample']); const rr2 = run(W, [PR, '_rules_sample']); const t = fs.readFileSync(path.join(W, '_rules_sample'), 'utf8');
  ok(rr.code === 0 && /PATCH OK/.test(rr.out) && rr2.code === 0 && /idempotent/.test(rr2.out) && t.includes("'dropped_by', 'dropped_reason', 'ai_feedback', 'phone', 'lost'") && (t.match(/'dropped_reason'/g) || []).length === 1 && (t.match(/match \/source_health\/\{sid\} \{ allow read: if isSuperAdmin\(\); allow write: if false; \}/g) || []).length === 1 && (t.match(/match \/group_state\/\{gid\}/g) || []).length === 1 && t.indexOf('match /source_health/') > t.indexOf('match /databases/{database}/documents {') && t.indexOf('match /source_health/') < t.indexOf('match /leads/{id}'), 'Rules: whitelist leads + dropped_reason/ai_feedback/phone (mốc dump #47) + block đọc source_health/group_state (super) ngay sau documents {, idempotent');
  /* nửa vời: đã có whitelist (LỆNH C chạy dở) nhưng thiếu block → chỉ chèn block; đã có block mà thiếu whitelist → chỉ vá whitelist */
  fs.writeFileSync(path.join(W, '_rules_half'), fs.readFileSync(path.join(W, '_rules_sample'), 'utf8').replace(/ *match \/group_state\/[^\n]*\n/, '')); const rh = run(W, [PR, '_rules_half']); const th = fs.readFileSync(path.join(W, '_rules_half'), 'utf8');
  ok(rh.code === 0 && /block đọc group_state/.test(rh.out) && !/whitelist/.test(rh.out) && (th.match(/match \/group_state\//g) || []).length === 1 && (th.match(/match \/source_health\//g) || []).length === 1 && (th.match(/'dropped_reason'/g) || []).length === 1, 'Rules nửa vời (thiếu riêng group_state) → chỉ chèn block thiếu, không vá whitelist lần 2');
  fs.writeFileSync(path.join(W, '_rules_nohelper'), "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /leads/{id} {\n      allow update: if signedIn()\n" + fs.readFileSync(path.join(W, '_rules_sample'), 'utf8').split('\n').find(l => l.includes("hasOnly(['stage'")).replace("'dropped_reason', 'ai_feedback', 'phone', ", '') + "\n    }\n  }\n}\n"); const rn = run(W, [PR, '_rules_nohelper']);
  ok(rn.code === 1 && /isSuperAdmin/.test(rn.out) && !/'dropped_reason'/.test(fs.readFileSync(path.join(W, '_rules_nohelper'), 'utf8')), 'Rules không có helper isSuperAdmin() → dừng, không ghi gì (kể cả whitelist)');
  fs.writeFileSync(path.join(W, '_rules_bad'), "rules_version = '2';\n"); const rb = run(W, [PR, '_rules_bad']); ok(rb.code === 1 && /KHONG THAY MOC/.test(rb.out), 'Rules: không có mốc → dừng, không ghi'); }
{ const rz = run(W, [PZ, '_zalo_sample.js']); const rz2 = run(W, [PZ, '_zalo_sample.js']); const t = fs.readFileSync(path.join(W, '_zalo_sample.js'), 'utf8'); const rc = run(W, ['--check', '_zalo_sample.js']);
  ok(rz.code === 0 && /PATCH OK/.test(rz.out) && rz2.code === 0 && /idempotent/.test(rz2.out) && (t.match(/LENH C/g) || []).length === 2 && rc.code === 0 && t.indexOf('if (after.dropped || after.lost') > t.indexOf('if (!brand) return;') && t.indexOf('if (after.dropped || after.lost') < t.indexOf('await getConfig()'), 'ZBS: guard chèn ngay sau if (!brand) và trước getConfig; justTagged/score giữ AI chấm lại; idempotent; --check OK'); }

/* ---------- 1. stats.js ---------- */
OUT('-- stats.js statsEvents (PB-6)');
const stm = await import(pathToFileURL(path.join(W, 'stats.js')).href);
const ev = (b, a) => { const o = {}; stm.statsEvents(b, a, Date.parse('2026-09-13T05:00:00Z')).forEach(e => { Object.keys(e.inc).forEach(k => { o[e.day + '.' + k] = (o[e.day + '.' + k] || 0) + e.inc[k]; }); }); return o; };
const D0 = Date.parse('2026-09-12T03:00:00Z'), day0 = '2026-09-12';
const hot = { brand: 'b1', temp: 'hot', score: 85, detected_at: D0 };
ok(JSON.stringify(ev(null, hot)) === JSON.stringify({ [day0 + '.new']: 1, [day0 + '.hot']: 1 }), 'tạo lead nóng → new+1 hot+1 (như cũ)');
ok(stm.machineDroppedC({ dropped: true, dropped_by: 'rescore_role' }) && stm.machineDroppedC({ dropped: true, dropped_by: 'lenh31b' }) && stm.machineDroppedC({ dropped: true, dropped_by: 'ai' }) && !stm.machineDroppedC({ dropped: true, dropped_by: 'xuanvinh@x.com' }) && !stm.machineDroppedC({ dropped: true, dropped_by: 'aiden@x.com' }) && !stm.machineDroppedC({ dropped: true, dropped_by: 'sweeper_bot_uid_12345678901234567890' }) && stm.machineDroppedC({ dropped: true, dropped_by: 'rescore:sweep' }) && !stm.machineDroppedC({ dropped: true, dropped_by: 'uid_abc' }) && !stm.machineDroppedC({ dropped: false, dropped_by: 'rescore' }), 'machineDroppedC: rescore/rescore_role/lenh31b/ai = máy; email/uid = người; chưa dropped = không');
{ const a = Object.assign({}, hot, { dropped: true, dropped_by: 'rescore', dropped_at: D0 + 3600e3 }); const o = ev(hot, a);
  ok(o[day0 + '.new'] === -1 && o[day0 + '.hot'] === -1 && o[day0 + '.aiDropped'] === 1 && !o[day0 + '.dropped'], 'MÁY loại lead nóng (AI chấm lại) → new−1 hot−1 đúng ngày phát hiện + aiDropped+1, KHÔNG cộng dropped'); }
{ const a = Object.assign({}, hot, { dropped: true, dropped_by: 'sales@z15.vn', dropped_at: D0 + 3600e3 }); const o = ev(hot, a);
  ok(!o[day0 + '.new'] && !o[day0 + '.hot'] && o[day0 + '.dropped'] === 1 && !o[day0 + '.aiDropped'], 'SALES bấm Loại → GIỮ new/hot, dropped+1 (anh chốt câu 1)'); }
{ const a = Object.assign({}, hot, { temp: 'cold', score: 45, rescored_at: D0 + 7200e3 }); const o = ev(hot, a);
  ok(o[day0 + '.hot'] === -1 && o[day0 + '.cold'] === 1 && !o[day0 + '.new'], 'AI chấm lại HẠ nhiệt nóng → lạnh: hot−1 cold+1, new giữ nguyên (0, không ghi)'); }
{ const a = Object.assign({}, hot, { temp: 'junk', score: 20 }); const o = ev(hot, a);
  ok(o[day0 + '.new'] === -1 && o[day0 + '.hot'] === -1 && o[day0 + '.junk'] === 1, 'AI hạ xuống RÁC: new−1 hot−1 junk+1'); }
{ const b = Object.assign({}, hot, { temp: 'junk', score: 20 }); const a = Object.assign({}, hot, { temp: 'warm', score: 65 }); const o = ev(b, a);
  ok(o[day0 + '.junk'] === -1 && o[day0 + '.new'] === 1 && o[day0 + '.warm'] === 1, 'AI NÂNG rác → ấm: junk−1 new+1 warm+1'); }
{ const b = Object.assign({}, hot, { dropped: true, dropped_by: 'rescore' }); const a = Object.assign({}, hot, { dropped: false, restored_at: D0 + 9e6 }); const o = ev(b, a);
  ok(o[day0 + '.new'] === 1 && o[day0 + '.hot'] === 1, 'sales KHÔI PHỤC lead máy đã loại → đếm lại new+1 hot+1'); }
{ const b = Object.assign({}, hot, { dropped: true, dropped_by: 'sales@x' }); const a = Object.assign({}, b, { temp: 'cold', score: 45 }); const o = ev(b, a);
  ok(o[day0 + '.hot'] === -1 && o[day0 + '.cold'] === 1, 'lead sales đã loại (vẫn đếm) mà AI đổi nhiệt → vẫn chuyển bucket'); }
ok(JSON.stringify(ev(hot, Object.assign({}, hot, { stage: 'responded', stage_at: D0 + 1e6 }))) === JSON.stringify({ ['2026-09-12.responded']: 1 }), 'đổi giai đoạn (không đổi temp) → chỉ responded+1 (hành vi cũ)');
{ const b = { brand: 'b1', temp: 'hot', score: 85, detected_at: D0, role: 'seller' }; const o = ev(null, b); ok(Object.keys(o).length === 0, 'vai người bán → không đếm (LỆNH #42 giữ)'); }

/* ---------- 2. push.js hotGateC ---------- */
OUT('-- push.js hotGateC (PB-10)');
const pum = await import(pathToFileURL(path.join(W, 'push.js')).href); const hg = pum.hotGateC;
ok(hg(null, { temp: 'hot', brand_hint: 'b1' }) === 'new' && hg(null, { temp: 'hot', brand: 'b1' }) === 'new', 'tạo lead nóng có brand_hint (đường B) hoặc brand → push "new"');
ok(hg(null, { temp: 'hot' }) === '' && hg({ temp: 'hot' }, { temp: 'hot', brand: 'b1' }) === 'tagged', 'lead cũ tạo KHÔNG brand/hint → không push; brand gán sau → push "tagged" (đúng 1 lần)');
ok(hg({ temp: 'hot', brand_hint: 'b1' }, { temp: 'hot', brand_hint: 'b1', brand: 'b1' }) === '', 'đường B: bước 2 gán brand khi đã có brand_hint → KHÔNG push lần 2');
ok(hg({ temp: 'hot', brand: 'b1', ai_scored: false }, { temp: 'hot', brand: 'b1', ai_scored: true }) === 'rescored' && hg(null, { temp: 'hot', brand: 'b1', ai_scored: false }) === '', 'điểm tạm → không push; AI chấm lại thành nóng → "rescored" (#46 giữ)');
ok(hg(null, { temp: 'hot', brand: 'b1', dropped: true }) === '' && hg(null, { temp: 'hot', brand: 'b1', role: 'seller' }) === '' && hg(null, { temp: 'hot', brand: 'b1', self_comment: true }) === '' && hg(null, { temp: 'warm', brand: 'b1' }) === '' && hg({ temp: 'hot', brand: 'b1' }, { temp: 'hot', brand: 'b1', score: 90 }) === '', 'bỏ: đã loại / người bán / chủ bài / không nóng / chỉ đổi điểm');
ok(fs.readFileSync(path.join(W, 'push.js'), 'utf8').includes("brand = String(after.brand || after.brand_hint || '').trim()"), 'người nhận theo brand || brand_hint (admin brand nhận ngay ở bước 1)');

/* ---------- 3. index.js healthEvalC + scanAll ---------- */
OUT('-- index.js healthEvalC (thuần)');
const stub = await import(pathToFileURL(path.join(W, 'stubB.mjs')).href);
const CFG = (await import(pathToFileURL(path.join(W, 'lib/config.js')).href)).CFG;
const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href); const mt = await import(pathToFileURL(path.join(W, 'lib/multitouch.js')).href);
const cfg = sc.scoreLead.cfg46;
Object.assign(CFG, { LLM_API_KEY: 'test-key', LLM_MODEL: 'gpt-5.6-sol', LLM_PREFILTER_MODEL: 'gpt-5-nano', SCAN_COMMENTS: false, BD_SOW_MODE: true, SCORE_CONCURRENCY: 1, PREFILTER_CONCURRENCY: 1, MIN_KEEP_SCORE: 40, HOT_THRESHOLD: 80, LOG_SCANNED_POSTS: true, SCANNED_TTL_DAYS: 3, POSTS_PER_GROUP: 20, PROBE_POSTS: 5, FULLSWEEP_HOURS: 2, SCAN_SOURCE_INTERVAL_MIN: 10, BRIGHTDATA_TOKEN: 'bd-test', BRIGHTDATA_DATASET_ID: 'gd_posts', BRIGHTDATA_COMMENTS_DATASET_ID: 'gd_cmt', RESCORE_FALLBACK: false, ZALO_CHECK_COLD: false, BD_PROGRESS_MIN_AGE_S: 120, SCAN_INTERVAL_MIN_FLOOR: 5, SCAN_INTERVAL_MAX_MIN: 30, HOUSEKEEPING_MIN: 5 });
cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300; cfg.budgetMs = 100000;
const realNow = Date.now; let clockOff = 0; Date.now = () => realNow() + clockOff;
const LOGS = []; for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); if (process.env.LC_VERBOSE) o(...a); }; }
const logHas = re => LOGS.some(l => re.test(l));
const ixm = await import(pathToFileURL(path.join(W, 'index.js')).href);
{ const now = Date.parse('2026-09-13T05:00:00Z'); const day = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
  const docs = [
    { id: 's1', name: 'A', brand: 'b1', days: { [day(now)]: { posts: 10, leads: 0 }, [day(now - 864e5)]: { posts: 8, leads: 0 }, [day(now - 9 * 864e5)]: { posts: 99, leads: 9 } }, lastPostAt: now - 3600e3 },
    { id: 's2', name: 'B', brand: 'b1', days: { [day(now - 2 * 864e5)]: { posts: 3, leads: 1 } }, lastPostAt: now - 60 * 3600e3 },
    { id: 's3', name: 'C', brand: 'b2', days: {}, errStreak: 7, lastError: 'trigger lỗi: 400' },
    { id: 's4', name: 'D', brand: 'b2', days: { [day(now)]: { posts: 5, leads: 2 } }, lastPostAt: now - 1000, alertedAt: now - 1000 },
    { id: 's5', name: 'E(tắt)', brand: 'b2', days: { [day(now - 20 * 864e5)]: { posts: 50, leads: 0 } }, lastPostAt: now - 30 * 864e5 },
    { id: 's6', name: 'F', brand: 'b3', days: {}, lastPostAt: 0 } ];
  const act = new Map([['s1', { active: true }], ['s2', { active: true }], ['s3', { active: true }], ['s4', { active: true }], ['s6', { active: true }]]);
  const r = ixm.healthEvalC(docs, act, now); const badIds = r.bad.map(b => b.id).sort().join(',');
  ok(badIds === 's1,s2,s3' && /18 bài\/7 ngày nhưng 0 lead/.test(r.bad[0].why) && /không có bài mới 60 h/.test(r.bad.find(b => b.id === 's2').why) && /lỗi 7 lượt/.test(r.bad.find(b => b.id === 's3').why), 'healthEvalC: noLead (18 bài/0 lead, KHÔNG tính ngày >7) · silent 60 h · errStreak 7 → 3 nguồn xấu; nguồn tốt/tắt/chưa dữ liệu không xấu');
  ok(r.warn.length === 3 && r.active === 5 && r.error && /3\/5 nguồn/.test(r.error), '3 WARNING lần đầu (alertedAt trống) + ERROR [SCAN-HEALTH] vì 3 ≥ ½ của 5 nguồn bật');
  const u1 = r.updates.find(u => u.id === 's1'); const u5 = r.updates.find(u => u.id === 's5'); const u4 = r.updates.find(u => u.id === 's4');
  ok(u1 && u1.patch['days.' + day(now - 9 * 864e5)] && u1.patch['days.' + day(now - 9 * 864e5)].__del === 1 && u1.patch.alertedAt === now && u5 && u5.patch['days.' + day(now - 20 * 864e5)] && !('alertedAt' in u5.patch) && u4 && u4.patch.alertedAt === 0, 'updates: dọn ngày >7 (cả nguồn tắt), alertedAt=now cho nguồn xấu, reset alertedAt nguồn đã khoẻ');
  const r2 = ixm.healthEvalC(docs.map(d => ['s1', 's2', 's3'].includes(d.id) ? Object.assign({}, d, { alertedAt: now - 3600e3 }) : d), act, now);
  ok(r2.bad.length === 3 && r2.warn.length === 0 && r2.error, 'đã cảnh báo <6 h → không WARNING lại (bad + ERROR vẫn phản ánh trạng thái)');
  const r3 = ixm.healthEvalC(docs.slice(0, 1).concat([{ id: 's7', name: 'G', brand: 'b1', days: {}, lastPostAt: now - 1000 }, { id: 's8', name: 'H', days: {}, lastPostAt: now - 1000 }, { id: 's9', name: 'I', days: {}, lastPostAt: now - 1000 }]), new Map([['s1', {}], ['s7', {}], ['s8', {}], ['s9', {}]]), now);
  ok(r3.bad.length === 1 && !r3.error, '1/4 nguồn xấu → chỉ WARNING, không ERROR'); }

OUT('-- index.js scanAll trọn vòng (source_health cuối lượt + đánh giá ở nhịp việc phụ + bfKey theo brand)');
const good = (obj) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: 'gpt-test' } });
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: () => null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body), json: async () => r.body });
const LEAD = { is_real_lead: true, hotness: 85, intent: 'cần mua gấp', need: 'mua 20 kg mực khô', industry: 'Hải sản', service: 'Mực khô', reply: 'Chào anh, bên em có mực khô loại 1 ạ.', role: 'buyer', role_reason: 'hỏi mua' };
let calls = []; let route = { pre: () => good({ maybe: true }), main: () => good(LEAD) };
const BD = { triggers: [], snaps: new Map(), progress: 0, busy: false, failNext: false, triggerFail: false, recordsFor: () => [], readyDelay: 0, n: 0, cmtRecordsFor: () => [] };
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('api.brightdata.com')) {
    if (u.includes('/trigger?')) { if (BD.triggerFail) return mk({ status: 400, body: 'Customer is not active' }); const inputs = JSON.parse(opt.body); const id = 'sd_' + (++BD.n); const isCmt = u.includes('dataset_id=gd_cmt'); BD.triggers.push({ id, inputs, url: u, isCmt }); BD.snaps.set(id, { at: Date.now(), inputs, isCmt }); return mk({ status: 200, body: { snapshot_id: id } }); }
    if (u.includes('/progress/')) { BD.progress++; const id = u.split('/progress/')[1]; if (BD.busy) return mk({ status: 429, body: { error: 'rate' } }); const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: { status: 'failed' } }); return mk({ status: 200, body: { status: (Date.now() - s.at) >= BD.readyDelay ? 'ready' : 'running' } }); }
    if (u.includes('/snapshot/')) { const id = u.split('/snapshot/')[1].split('?')[0]; const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: [] }); const recs = s.isCmt ? s.inputs.flatMap(i => BD.cmtRecordsFor(i)) : s.inputs.flatMap(i => BD.recordsFor(i).map(r => Object.assign({ input: { url: i.url, num_of_posts: i.num_of_posts || null, start_date: i.start_date || null, posts_to_not_include: i.posts_to_not_include || [] } }, r))); return mk({ status: 200, body: recs }); }
    return mk({ status: 404, body: {} });
  }
  const body = JSON.parse(opt.body); calls.push({ url: u, body, opt }); const isPre = body.model === CFG.LLM_PREFILTER_MODEL; const r = await (isPre ? route.pre : route.main)(body, opt); return mk(r);
};
const G1 = 'https://www.facebook.com/groups/1189400231607822/', G1b = 'https://www.facebook.com/groups/1189400231607822', G2 = 'https://www.facebook.com/groups/vieclamtotchosv/';
const rec = (id, extra) => Object.assign({ post_id: id, url: G1 + 'posts/' + id + '/', content: 'Cần mua ' + id + ' kg mực khô rim me, ai có báo giá', group_id: '1189400231607822', num_comments: 0, profile_id: '1000' + id.replace(/\D/g, '').padStart(12, '0'), date_posted: new Date(Date.now() - 60e3).toISOString() }, extra || {});
let F;
function fresh() { F = stub.makeDb(); LOGS.length = 0; calls = []; BD.triggers = []; BD.snaps.clear(); BD.progress = 0; BD.busy = false; BD.triggerFail = false; BD.readyDelay = 0; BD.recordsFor = () => []; BD.cmtRecordsFor = () => [];
  globalThis.__slB = { db: F.db }; globalThis.__sl48 = { db: F.db, isExcluded: () => false, enrichPhoneFromText: async () => ({ phone: '', phone_has_zalo: null, email: '' }), checkZalo: async () => ({ registered: true }), brandAiOf: (src) => ({ nganh: 'Ngành ' + ((src && src.brand) || '') }), tryMergeTouch: (db, lead, oo) => mt.tryMergeTouch(db, lead, oo) };
  F.db.collection('sources').doc('src_b1').set({ name: 'Hải sản B1', url: G1, brand: 'b1', active: true, industry: 'Hải sản' });
  F.db.collection('sources').doc('src_b2').set({ name: 'Hải sản B2', url: G1b, brand: 'b2', active: true, industry: 'Hải sản', sharedAt: Date.now() - 30 * 60e3, sharedBy: 'u2' });
  F.db.collection('sources').doc('src_slug').set({ name: 'Việc làm', url: G2, brand: 'b3', active: true, industry: 'Tuyển dụng' });
  F.db.collection('config').doc('app').set({ aiMode: 'saver', scanComments: false }); route = { pre: () => good({ maybe: true }), main: () => good(LEAD) }; return F; }
const store = (pre) => [...F.store.entries()].filter(([k]) => k.startsWith(pre)).map(([k, v]) => Object.assign({ __id: k.slice(pre.length) }, v));
const dayNow = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
fresh(); clockOff = 0; BD.recordsFor = i => (i.url === G1 ? [rec('p1'), rec('p2'), rec('p3')] : i.url === G2 ? [{ post_id: 'q1', url: 'https://www.facebook.com/groups/555666777888/posts/q1/', content: 'Tìm việc part-time', group_id: '555666777888', num_comments: 1 }] : []);
let sum = await ixm.scanAll('scheduled');
{ const sh = store('source_health/'); ok(sum && !sum.error && sh.length === 0 && (F.store.get('system_status/scan') || {}).lastHousekeepingAt > 0 && (F.store.get('system_status/scan') || {}).health && F.store.get('system_status/scan').health.n === 0, 'lượt 1 (chỉ gieo): không dòng nào có bài/lead → không ghi source_health; nhịp việc phụ chạy healthEval → system_status/scan.health {n:0}'); }
clockOff += 130e3; sum = await ixm.scanAll('scheduled');
{ const sh = store('source_health/'); const s1 = sh.find(x => x.__id === 'src_b1'), s2 = sh.find(x => x.__id === 'src_b2'), s3 = sh.find(x => x.__id === 'src_slug'); const d = dayNow();
  ok(sum.kept === 7 && sh.length === 3 && s1 && s1.days && s1.days[d] && s1.days[d].posts === 3 && s1.days[d].leads === 3 && s1.days[d].hot === 3 && s1.lastPostAt > 0 && s1.lastLeadAt > 0 && s1.errStreak === 0 && s1.brand === 'b1' && s1.gid === '1189400231607822' && s2 && s2.days[d].posts === 3 && s2.brand === 'b2' && s3 && s3.days[d].posts === 1, 'lượt 2 (gặt): source_health 3 nguồn — days.<hôm nay> posts/leads/hot, lastPostAt/lastLeadAt, errStreak 0, brand/gid; nguồn dùng chung đếm riêng'); }
/* trigger lỗi → errStreak tăng; sau 6 lượt lỗi + nhịp việc phụ → WARNING */
clockOff += 6 * 60e3; BD.triggerFail = true; for (let i = 0; i < 6; i++) { clockOff += 6 * 60e3; await ixm.scanAll('scheduled'); }
{ const s1 = F.store.get('source_health/src_b1') || {}; ok(s1.errStreak >= 6 && /trigger lỗi/.test(String(s1.lastError || '')), 'trigger BrightData lỗi 6 lượt → errStreak ≥6 + lastError'); }
LOGS.length = 0; clockOff += 6 * 60e3; await ixm.scanAll('scheduled');
{ const st = F.store.get('system_status/scan') || {}; ok(st.health && st.health.n >= 1 && st.health.bad.some(b => b.id === 'src_b1' && /BrightData lỗi/.test(b.why)) && logHas(/\[SCAN-NO-LEAD\].*Hải sản B1/) && logHas(/"severity":"ERROR".*\[SCAN-HEALTH\]/), 'nhịp việc phụ: system_status/scan.health có src_b1 (lỗi ≥6) + WARNING [SCAN-NO-LEAD] + ERROR [SCAN-HEALTH] (3/3 nguồn bật lỗi)');
  const s1 = F.store.get('source_health/src_b1') || {}; ok(s1.alertedAt > 0, 'alertedAt ghi sau cảnh báo'); }
LOGS.length = 0; clockOff += 6 * 60e3; await ixm.scanAll('scheduled');
ok(!logHas(/\[SCAN-NO-LEAD\]/), 'lượt kế trong 6 h: không cảnh báo lặp');
/* hồi phục: gieo OK, gặt có bài → errStreak về 0 */
BD.triggerFail = false; clockOff += 6 * 60e3; await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled');
{ const s1 = F.store.get('source_health/src_b1') || {}; ok(s1.errStreak === 0, 'BrightData hồi → errStreak về 0'); }
/* bfKey theo brand: backfill 2 lần cùng URL khác brand */
{ fresh(); clockOff += 10 * 60e3; BD.recordsFor = i => (i.url === G1 ? [rec('bf1')] : []); const o = { startDate: '2026-09-01', endDate: '2026-09-10', numPosts: 5, rangeLabel: '10d' };
  let r = await ixm.scanAll('manual-backfill', Object.assign({ sourceUrl: G1 }, o)); const bf = store('backfill_done/'); const k1 = bf.map(x => x.__id);
  ok(bf.length >= 1 && bf.every(x => x.brand === 'b1' || x.brand === 'b2') && bf.some(x => /_b1$/.test(x.__id) || /b1$/.test(x.__id)), 'backfill: backfill_done ghi khoá CÓ brand (…|b1) + field brand' + (process.env.LC_DBG ? ' ' + JSON.stringify(k1) : ''));
  await F.db.collection('backfill_done').doc('bf_' + (G1 + '|2026-09-01|2026-09-10').replace(/[^\w-]/g, '_').slice(0, 480)).set({ url: G1, startDate: o.startDate, endDate: o.endDate, at: Date.now() });
  r = await ixm.scanAll('manual-backfill', Object.assign({ sourceUrl: G1 }, o)); const sc = [...F.store.values()].filter(v => v && v.trigger === 'manual-backfill'); const last = sc[sc.length - 1] || {};
  ok(last.backfillSkipped >= 1, 'backfill lại cùng URL/khoảng: khoá CŨ (không brand) vẫn được tôn trọng → bỏ qua (không gieo lại BrightData)'); }

/* ---------- 4. recount newAgg ---------- */
OUT('-- _lc_recount newAgg (PB-6)');
fs.copyFileSync(REC, path.join(W, '_lc_recount.mjs')); const rm = await import(pathToFileURL(path.join(W, '_lc_recount.mjs')).href);
{ const L = [ { brand: 'b1', temp: 'hot', score: 85, detected_at: D0 }, { brand: 'b1', temp: 'hot', score: 85, detected_at: D0, dropped: true, dropped_by: 'rescore_role' }, { brand: 'b1', temp: 'warm', score: 65, detected_at: D0, dropped: true, dropped_by: 'sales@x' }, { brand: 'b1', temp: 'cold', score: 45, detected_at: D0, role: 'seller' }, { brand: '', temp: 'hot', detected_at: D0 } ];
  const { agg, skipped } = rm.newAgg(L, '2026-09-01'); const o = agg['b1__2026-09-12'];
  ok(o && o.new === 2 && o.hot === 1 && o.warm === 1 && skipped.aiDropped === 1 && skipped.roleBad === 1 && skipped.noBrand === 1, 'newAgg: bỏ lead MÁY loại + vai người bán + không brand; sales loại vẫn đếm → new 2 (hot 1, warm 1)'); }
Date.now = realNow;
OUT('\n' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' — ' + fail + ' FAIL' : ''));
process.exit(fail ? 1 : 0);
