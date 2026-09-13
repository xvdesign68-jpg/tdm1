/* HARNESS LỆNH E (13/09/2026) — dựng MÃ ĐANG CHẠY (harness D export = fixture B + patch B + push #46 + patch C → + patch D + patch #49) → áp patch E → kiểm:
   0. patch: PATCH OK 3 file (19 mốc) · idempotent · fail-closed NGUYÊN TỬ (1 mốc index lệch → không ghi file nào) · LỆCH (config đã E, scorer/index chưa) · thiếu marker LENH D → dừng · --check 3 file + 4 script phụ
   1. scorer thuần: normRole (reseller/proxy trước seller) · scoringModeE (env/config) · critE/hotnessV2E (công thức Σ w·c/3, quy 0–10, thiếu ≥3 tiêu chí → null) · normalizeE (shadow giữ raw, on = v2, off/promptOff không ai_v2, is_real_lead chuỗi) · sysE/preSysE (brand-first, banSi, danh sách sản phẩm, không hồ sơ → trung tính, promptV2=false → SYS cũ)
   2. scanAll trọn vòng (Firestore + BrightData + LLM giả): shadow mặc định → lead score=raw + ai_v2 + scanned_posts.ai_v2 + scans.promptV2/scoreV2/distV2 · prompt gửi AI = brand-first (tầng 1 + tầng 2) · mode on → score = v2 · promptV2=false → prompt cũ, không ai_v2
      · reseller: brand không banSi → decision 'reseller' không lead; banSi → lead role reseller · proxy → lead + contact_via_poster · role other + is_real_lead → lead + scans.roleUnknown · is_real_lead "false" (chuỗi) → không lead · brand không hồ sơ → prompt trung tính + scans.noProfileBrands
      · sweeper #46 (lead ai_scored:false) chấm lại → ai_v2 + contact_via_poster, reseller không banSi → dropped rescore_role lý do "đại lý/mua sỉ".
   LE_EXPORT_DIR=<dir> → xuất fake ~ (mã SAU #49, CHƯA patch E) cho dry-run .sh rồi thoát. Chạy: node docs/harness-lenhe-2026-09-13.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HD = path.join(HERE, 'harness-lenhd-2026-09-13.mjs'), PD = path.join(HERE, 'lenh-2026-09-13-d-patch.cjs'), P49 = path.join(HERE, 'lenh-2026-09-13-49-patch.cjs'), PE = path.join(HERE, 'lenh-2026-09-13-e-patch.cjs');
const SCRIPTS = ['lenh-2026-09-13-e-live.mjs', 'lenh-2026-09-13-e-promptcmp.mjs', 'lenh-2026-09-13-e-shadow.mjs', 'lenh-2026-09-13-e-after.mjs'].map(f => path.join(HERE, f));
const FILES_E = ['lib/config.js', 'lib/scorer.js', 'index.js'];
const OUT = console.log.bind(console); let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; OUT('  ✓', m); } else { fail++; OUT('  ✗', m); } };
const run = (cwd, args, env) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
/* mã đang chạy sau #49 */
function prepRunning(W) {
  const H = fs.mkdtempSync(path.join(os.tmpdir(), 'le-h-')); const e0 = run(HERE, [HD], { LD_EXPORT_DIR: H }); if (e0.code !== 0) throw new Error('không export được mã sau C: ' + e0.out.slice(0, 300));
  const F = path.join(H, 'firebase-s13', 'functions'); const rD = run(F, [PD, 'lib/config.js', 'lib/scraper.js', 'index.js']); if (rD.code !== 0 || !/PATCH OK 3 file/.test(rD.out)) throw new Error('không áp được patch D: ' + rD.out.slice(0, 300));
  const r49 = run(F, [P49, 'lib/scraper.js']); if (r49.code !== 0) throw new Error('không áp được patch #49: ' + r49.out.slice(0, 300));
  fs.cpSync(F, W, { recursive: true }); fs.rmSync(H, { recursive: true, force: true }); return W;
}
if (process.env.LE_EXPORT_DIR) { const H = process.env.LE_EXPORT_DIR; const F = path.join(H, 'firebase-s13', 'functions'); fs.mkdirSync(F, { recursive: true }); prepRunning(F);
  fs.writeFileSync(path.join(F, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-5.6-sol\nLLM_PREFILTER_MODEL=gpt-5-nano\nBRIGHTDATA_TOKEN=test-bd\nBRIGHTDATA_DATASET_ID=gd_x\nPOLL_MINUTES=3\n');
  fs.writeFileSync(path.join(H, 'firebase-s13', 'firebase.json'), '{}'); console.log('exported fake HOME (mã sau #49, CHƯA patch E) →', H); process.exit(0); }

/* ---------- 0. patch ---------- */
OUT('-- patch E');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'le-')); prepRunning(W);
const before = FILES_E.map(f => fs.readFileSync(path.join(W, f), 'utf8'));
const r1 = run(W, [PE, ...FILES_E]); ok(r1.code === 0 && /PATCH OK 3 file/.test(r1.out) && /19 mốc/.test(r1.out), 'patch E áp trên mã sau #49: PATCH OK 3 file (19 mốc)' + (r1.code ? ' — ' + r1.out.slice(0, 400) : ''));
const r2 = run(W, [PE, ...FILES_E]); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of FILES_E) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f + (r.code ? ' — ' + r.out.slice(0, 200) : '')); }
for (const f of SCRIPTS) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + path.basename(f)); }
{ const W2 = fs.mkdtempSync(path.join(os.tmpdir(), 'le2-')); prepRunning(W2); const ix = path.join(W2, 'index.js'); fs.writeFileSync(ix, fs.readFileSync(ix, 'utf8').replace("runId: runId48, status: 'done', /* LENH #48 */", "runId: runId48, status: 'done', /* LENH #48x */"));
  const b2 = FILES_E.map(f => fs.readFileSync(path.join(W2, f), 'utf8')); const r = run(W2, [PE, ...FILES_E]); const same = FILES_E.every((f, i) => fs.readFileSync(path.join(W2, f), 'utf8') === b2[i]);
  ok(r.code === 1 && /I9 scans summary/.test(r.out) && same, 'fail-closed NGUYÊN TỬ: mốc I9 (index) lệch → exit 1, không ghi file nào (config/scorer đủ mốc)'); }
{ const W3 = fs.mkdtempSync(path.join(os.tmpdir(), 'le3-')); prepRunning(W3); fs.copyFileSync(path.join(W, 'lib/config.js'), path.join(W3, 'lib/config.js')); const b3 = FILES_E.map(f => fs.readFileSync(path.join(W3, f), 'utf8'));
  const r = run(W3, [PE, ...FILES_E]); ok(r.code === 1 && /LỆCH/.test(r.out) && FILES_E.every((f, i) => fs.readFileSync(path.join(W3, f), 'utf8') === b3[i]), 'LỆCH (config đã E, scorer/index chưa) → báo LỆCH, không ghi'); }
{ const W4 = fs.mkdtempSync(path.join(os.tmpdir(), 'le4-')); prepRunning(W4); const cf = path.join(W4, 'lib/config.js'); fs.writeFileSync(cf, fs.readFileSync(cf, 'utf8').replace(/LENH D/g, 'LENH Dx'));
  const r = run(W4, [PE, ...FILES_E]); ok(r.code === 1 && /thiếu marker/.test(r.out), 'thiếu marker LENH D (config) → DỪNG (mốc E đặt sau D)'); }

/* ---------- 1. scorer thuần ---------- */
OUT('-- scorer thuần (normRole · scoringModeE · công thức v2 · normalizeE · prompt)');
const CFG = (await import(pathToFileURL(path.join(W, 'lib/config.js')).href)).CFG;
const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href); const { scoreLead, normRole } = sc;
ok(CFG.PROMPT_BRAND_V2 === true && CFG.SCORE_V2 === 'shadow', 'config: PROMPT_BRAND_V2 true · SCORE_V2 shadow (mặc định)');
ok(normRole('đại lý') === 'reseller' && normRole('Reseller') === 'reseller' && normRole('mua sỉ') === 'reseller' && normRole('wholesale buyer') === 'reseller', 'normRole: đại lý / Reseller / mua sỉ / wholesale → reseller (trước "seller" dù chứa "sell")');
ok(normRole('đăng hộ') === 'proxy' && normRole('proxy') === 'proxy' && normRole('hỏi giúp bạn') === 'proxy' && normRole('on behalf') === 'proxy', 'normRole: đăng hộ / proxy / hỏi giúp / on behalf → proxy');
ok(normRole('seller') === 'seller' && normRole('người bán') === 'seller' && normRole('nhà cung cấp') === 'seller' && normRole('buyer') === 'buyer' && normRole('chủ bài') === 'poster_self' && normRole('') === '' && normRole('xyz') === 'other', 'normRole: 4 vai cũ giữ nguyên, rỗng → "", lạ → other');
ok(JSON.stringify(scoreLead.scoringModeE({})) === '{"prompt":true,"mode":"shadow"}' && JSON.stringify(scoreLead.scoringModeE({ scoring: { promptV2: false, scoreV2: 'on' } })) === '{"prompt":false,"mode":"on"}' && scoreLead.scoringModeE({ scoring: { scoreV2: 'bogus' } }).mode === 'shadow' && scoreLead.scoringModeE({ scoring: { scoreV2: 'off' } }).mode === 'off', 'scoringModeE: mặc định env · config/app.scoring ghi đè · giá trị lạ → shadow');
const Wt = [{ key: 'intent', weight: 30 }, { key: 'fit', weight: 25 }, { key: 'timing', weight: 15 }, { key: 'industry', weight: 12 }, { key: 'area', weight: 8 }, { key: 'quality', weight: 10 }];
ok(scoreLead.hotnessV2E({ intent: 3, fit: 3, timing: 3, industry: 3, area: 3, quality: 3 }, Wt) === 100 && scoreLead.hotnessV2E({ intent: 3, fit: 0, timing: 0, industry: 0, area: 0, quality: 0 }, Wt) === 30 && scoreLead.hotnessV2E({ intent: 0, fit: 0, timing: 0, industry: 0, area: 0, quality: 0 }, Wt) === 0, 'hotnessV2E: Σ w·c/3 ÷ Σ w × 100 (đủ 3 → 100 · chỉ intent 3 → 30 · 0 → 0)');
ok(scoreLead.hotnessV2E({ intent: 10, fit: 10, timing: 10, industry: 10, area: 10, quality: 10 }, Wt) === 100 && scoreLead.hotnessV2E({ intent: 100, fit: 50, timing: 100, industry: 100, area: 100, quality: 100 }, Wt) === Math.round((30 + 12.5 + 15 + 12 + 8 + 10)), 'hotnessV2E: tiêu chí 0–10 / 0–100 tự quy về 0–3');
ok(scoreLead.hotnessV2E({ intent: 3, fit: 3, timing: 3 }, Wt) === null && scoreLead.hotnessV2E(null, Wt) === null && scoreLead.hotnessV2E({ intent: 3, fit: 3, timing: 3, industry: 3 }, Wt) === 100, 'hotnessV2E: thiếu ≥3/6 tiêu chí → null (giữ raw); 4 tiêu chí → tính trên phần có');
ok(scoreLead.hotnessV2E({ intent: 3, fit: 0, timing: 0, industry: 0, area: 0, quality: 0 }, [{ key: 'intent', weight: 50 }, { key: 'fit', weight: 50 }, { key: 'timing', weight: 0 }, { key: 'industry', weight: 0 }, { key: 'area', weight: 0 }, { key: 'quality', weight: 0 }]) === 50 && scoreLead.hotnessV2E({ intent: 3, fit: 3, timing: 3, industry: 3, area: 3, quality: 0 }, []) === 90, 'hotnessV2E: config.weights ghi đè (intent/fit 50/50 → 50) · weights trống → mặc định (quality 0 → 90)');
{ const base = { is_real_lead: 'false', hotness: 0.85, criteria: { intent: 3, fit: 2, timing: 1, industry: 3, area: 2, quality: 2 }, confidence: 80, why: 'a', role: 'buyer' };
  const s1 = scoreLead.normalizeE(Object.assign({}, base), Wt, { prompt: true, mode: 'shadow' }); ok(s1.is_real_lead === false && s1.hotness === 85 && s1.hotness_raw === 85 && s1.ai_v2 && s1.ai_v2.mode === 'shadow' && s1.ai_v2.score === 76 && s1.ai_v2.conf === 0.8 && s1.ai_v2.why[0] === 'a' && !('criteria' in s1), 'normalizeE shadow: is_real_lead "false" → false · hotness 0.85 → 85 (giữ raw) · ai_v2.score 76 · conf 80 → 0.8 · why chuỗi → mảng · bỏ field lạ');
  const s2 = scoreLead.normalizeE(Object.assign({}, base), Wt, { prompt: true, mode: 'on' }); ok(s2.hotness === 76 && s2.hotness_raw === 85 && s2.ai_v2.mode === 'on', 'normalizeE on: hotness = điểm tiêu chí 76, raw 85 giữ ở hotness_raw');
  const s3 = scoreLead.normalizeE(Object.assign({}, base), Wt, { prompt: false, mode: 'on' }); ok(s3.hotness === 85 && !('ai_v2' in s3) && !('criteria' in s3), 'normalizeE promptV2=false: không ai_v2 (prompt cũ không có criteria), hotness raw');
  const s4 = scoreLead.normalizeE(Object.assign({}, base), Wt, { prompt: true, mode: 'off' }); ok(s4.hotness === 85 && !('ai_v2' in s4), 'normalizeE off: không ai_v2');
  const s5 = scoreLead.normalizeE({ is_real_lead: 'yes', hotness: '85', criteria: { intent: 3 }, role: 'buyer' }, Wt, { prompt: true, mode: 'shadow' }); ok(s5.is_real_lead === true && s5.hotness === 85 && s5.ai_v2 && s5.ai_v2.score === null, 'normalizeE: "yes" → true · hotness "85" → 85 · criteria thiếu → ai_v2.score null'); }
const AI = { nganh: 'Hải sản khô', dichvu: 'Mực khô loại 1; Cá lóc khô tẩm ớt, Tôm khô', khach: 'Người mua lẻ, quán nhậu', giong: 'thân thiện', banSi: true };
{ const s = scoreLead.sysE(AI, { prompt: true, mode: 'shadow' }); ok(/HỒ SƠ BRAND/.test(s) && /Hải sản khô/.test(s) && /"Mực khô loại 1", "Cá lóc khô tẩm ớt", "Tôm khô"/.test(s) && /CÓ bán sỉ/.test(s) && /"buyer", "proxy", "reseller" mới được/.test(s) && !/agency marketing/.test(s) && /"criteria"/.test(s), 'sysE brand banSi: brand-first (HỒ SƠ BRAND, danh sách sản phẩm, CÓ bán sỉ, reseller được is_real_lead), không còn "agency marketing", có criteria');
  const s2 = scoreLead.sysE(Object.assign({}, AI, { banSi: false }), { prompt: true, mode: 'shadow' }); ok(/KHÔNG bán sỉ/.test(s2) && /"buyer", "proxy" mới được/.test(s2), 'sysE brand không banSi: reseller → is_real_lead=false');
  const s3 = scoreLead.sysE(null, { prompt: true, mode: 'shadow' }); ok(/chưa khai hồ sơ ngành/.test(s3) && /"criteria"/.test(s3) && !/agency marketing/.test(s3), 'sysE không hồ sơ: prompt trung tính SME (có criteria, không agency)');
  const s4 = scoreLead.sysE(AI, { prompt: false, mode: 'shadow' }); ok(/agency marketing/.test(s4) && /BRAND ĐANG PHỤC VỤ/.test(s4) && !/"criteria"/.test(s4), 'sysE promptV2=false: SYS cũ + khối brandAiCtx (100 % như trước)');
  const p1 = scoreLead.preSysE(AI, { prompt: true }); const p2 = scoreLead.preSysE(AI, { prompt: false }); ok(/SÀNG LỌC NHANH lead cho một brand ngành "Hải sản khô"/.test(p1) && /đại lý \/ mua sỉ/.test(p1) && /agency marketing/.test(p2), 'preSysE: tầng 1 theo brand (banSi → đại lý/mua sỉ = maybe) · promptV2=false → PRE_SYS cũ');
  ok(scoreLead.hasProfileE(AI) && !scoreLead.hasProfileE({ giong: 'x' }) && !scoreLead.hasProfileE(null), 'hasProfileE: chỉ giọng điệu = chưa có hồ sơ'); }

/* ---------- 2. scanAll trọn vòng ---------- */
OUT('-- index.js scanAll (shadow/on/off · prompt gửi AI · reseller/proxy/other · noProfile · sweeper)');
const stub = await import(pathToFileURL(path.join(W, 'stubB.mjs')).href); const mt = await import(pathToFileURL(path.join(W, 'lib/multitouch.js')).href);
const cfg = scoreLead.cfg46;
Object.assign(CFG, { LLM_API_KEY: 'test-key', LLM_MODEL: 'gpt-5.6-sol', LLM_PREFILTER_MODEL: 'gpt-5-nano', SCAN_COMMENTS: false, BD_SOW_MODE: true, SCORE_CONCURRENCY: 1, PREFILTER_CONCURRENCY: 1, MIN_KEEP_SCORE: 40, HOT_THRESHOLD: 80, LOG_SCANNED_POSTS: true, SCANNED_TTL_DAYS: 3, POSTS_PER_GROUP: 20, PROBE_POSTS: 5, FULLSWEEP_HOURS: 2, BD_PROGRESS_MIN_AGE_S: 120, SCAN_INTERVAL_MIN_FLOOR: 5, HOUSEKEEPING_MIN: 5, ZALO_CHECK_COLD: false, SCAN_SOURCE_INTERVAL_MIN: 10, BRIGHTDATA_TOKEN: 'bd-test', BRIGHTDATA_DATASET_ID: 'gd_posts', BRIGHTDATA_COMMENTS_DATASET_ID: 'gd_cmt', COMMENTS_PER_POST: 5, SCANS_TTL_DAYS: 90, SEEN_TTL_DAYS: 180, TOO_OLD_DAYS: 45, PREFILTERED_TTL_DAYS: 14 });
cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300; cfg.budgetMs = 100000;
const realNow = Date.now; let clockOff = 0; Date.now = () => realNow() + clockOff;
const LOGS = []; for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); if (process.env.LE_VERBOSE) o(...a); }; }
const ixm = await import(pathToFileURL(path.join(W, 'index.js')).href);
const good = (obj) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: 'gpt-test' } });
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: () => null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body), json: async () => r.body });
const V2 = (o) => Object.assign({ is_real_lead: true, hotness: 85, criteria: { intent: 3, fit: 3, timing: 3, industry: 3, area: 3, quality: 3 }, confidence: 0.9, why: ['cần mua', 'gấp'], intent: 'cần mua gấp', need: 'mua 20 kg mực khô', industry: 'Hải sản', service: 'Mực khô loại 1', reply: 'Chào anh, bên em có mực khô loại 1 ạ.', role: 'buyer', role_reason: 'hỏi mua' }, o || {});
let calls = []; let route = { pre: () => good({ maybe: true }), main: () => good(V2()) };
const BD = { triggers: [], snaps: new Map(), n: 0, readyDelay: 0, recordsFor: () => [] };
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('api.brightdata.com')) {
    if (u.includes('/trigger?')) { const inputs = JSON.parse(opt.body); const id = 'sd_' + (++BD.n); BD.triggers.push({ id, inputs, url: u }); BD.snaps.set(id, { at: Date.now(), inputs }); return mk({ status: 200, body: { snapshot_id: id } }); }
    if (u.includes('/progress/')) { const id = u.split('/progress/')[1]; const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: { status: 'failed' } }); return mk({ status: 200, body: { status: (Date.now() - s.at) >= BD.readyDelay ? 'ready' : 'running' } }); }
    if (u.includes('/snapshot/')) { const id = u.split('/snapshot/')[1].split('?')[0]; const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: [] }); const recs = s.inputs.flatMap(i => BD.recordsFor(i).map(r => Object.assign({ input: { url: i.url, num_of_posts: i.num_of_posts || null, start_date: i.start_date || null } }, r))); return mk({ status: 200, body: recs }); }
    return mk({ status: 404, body: {} });
  }
  const body = JSON.parse(opt.body); calls.push({ url: u, body, opt }); const isPre = body.model === CFG.LLM_PREFILTER_MODEL; const r = await (isPre ? route.pre : route.main)(body, opt); return mk(r);
};
const G1 = 'https://www.facebook.com/groups/1189400231607822/'; const P = n => '10000000' + n;
const rec = (id, extra) => Object.assign({ post_id: id, url: G1 + 'posts/' + id + '/', content: 'Cần mua ' + id + ' kg mực khô rim me, ai có báo giá', group_id: '1189400231607822', num_comments: 0, profile_id: '1000' + id.padStart(12, '0'), date_posted: new Date(Date.now() - 60e3).toISOString() }, extra || {});
let F; let PROFILE = Object.assign({}, AI);
function fresh(o) { o = o || {}; F = stub.makeDb(); LOGS.length = 0; calls = []; BD.triggers = []; BD.snaps.clear(); BD.readyDelay = 0; BD.recordsFor = () => []; PROFILE = ('profile' in o) ? o.profile : Object.assign({}, AI);
  globalThis.__slB = { db: F.db }; globalThis.__sl48 = { db: F.db, isExcluded: () => false, enrichPhoneFromText: async () => ({ phone: '', phone_has_zalo: null, email: '' }), checkZalo: async () => ({ registered: true }), brandAiOf: () => PROFILE, tryMergeTouch: (db, lead, oo) => mt.tryMergeTouch(db, lead, oo) };
  F.db.collection('sources').doc('src_b1').set({ name: 'Hải sản B1', url: G1, brand: 'b1', active: true, industry: 'Hải sản' });
  F.db.collection('config').doc('app').set(Object.assign({ aiMode: 'saver', scanComments: false, weights: Wt }, o.config || {})); route = { pre: () => good({ maybe: true }), main: () => good(V2()) }; return F; }
const store = (pre) => [...F.store.entries()].filter(([k]) => k.startsWith(pre)).map(([k, v]) => Object.assign({ __id: k.slice(pre.length) }, v));
const lastScan = () => store('scans/').filter(s => s.status === 'done').slice(-1)[0] || {};
async function twoRuns(id, extra) { BD.recordsFor = i => (i.url === G1 ? [rec(id, extra)] : []); await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled'); }
const sysOf = (isPre) => { const c = calls.find(x => (x.body.model === CFG.LLM_PREFILTER_MODEL) === isPre); return c ? String((c.body.messages || []).find(m => m.role === 'system').content) : ''; };
/* (a) shadow mặc định */
fresh(); clockOff = 0; await twoRuns(P(1));
{ const L = store('leads/')[0]; const sp = store('scanned_posts/').find(p => p.decision === 'lead'); const s = lastScan();
  ok(L && L.score === 85 && L.temp === 'hot' && L.ai_v2 && L.ai_v2.mode === 'shadow' && L.ai_v2.score === 100 && L.ai_v2.raw === 85 && L.ai_v2.conf === 0.9 && L.ai_v2.why.length === 2 && L.contact_via_poster === false && L.role === 'buyer', 'shadow: lead score = raw 85 (hot), ai_v2 {mode shadow, score 100, raw 85, conf, why}, contact_via_poster false ' + JSON.stringify({ score: L && L.score, v2: L && L.ai_v2 }));
  ok(sp && sp.ai_v2 && sp.ai_v2.score === 100, 'scanned_posts decision lead có ai_v2');
  ok(s.promptV2 === true && s.scoreV2 === 'shadow' && s.distV2 && s.distV2.hot === 1 && s.dist.hot === 1 && s.roleUnknown === 0 && Array.isArray(s.noProfileBrands) && s.noProfileBrands.length === 0, 'scans: promptV2 true · scoreV2 shadow · distV2.hot 1 · roleUnknown 0 · noProfileBrands [] ' + JSON.stringify({ p: s.promptV2, m: s.scoreV2, d: s.distV2, r: s.roleUnknown, np: s.noProfileBrands }));
  ok(/HỒ SƠ BRAND/.test(sysOf(false)) && /"Mực khô loại 1"/.test(sysOf(false)) && !/agency marketing/.test(sysOf(false)) && /SÀNG LỌC NHANH lead cho một brand/.test(sysOf(true)), 'prompt gửi AI: tầng 2 brand-first (HỒ SƠ BRAND + sản phẩm) · tầng 1 theo brand'); }
/* (b) mode on */
fresh({ config: { scoring: { scoreV2: 'on' } } }); clockOff += 10 * 60e3; route.main = () => good(V2({ hotness: 90, criteria: { intent: 3, fit: 1, timing: 1, industry: 3, area: 2, quality: 2 } }));
await twoRuns(P(2));
{ const L = store('leads/')[0]; const exp = Math.round((30 + 25 * 1 / 3 + 15 * 1 / 3 + 12 + 8 * 2 / 3 + 10 * 2 / 3)); const s = lastScan();
  ok(L && L.score === exp && L.temp === 'warm' && L.ai_v2.mode === 'on' && L.ai_v2.raw === 90 && s.scoreV2 === 'on' && s.dist.warm === 1, 'mode on (config/app.scoring.scoreV2): score = điểm tiêu chí ' + exp + ' (warm) dù raw 90; scans.scoreV2 on, dist theo v2 ' + JSON.stringify({ score: L && L.score, exp, temp: L && L.temp, v2: L && L.ai_v2, sv2: s.scoreV2, dist: s.dist })); }
/* (c) promptV2 = false */
fresh({ config: { scoring: { promptV2: false } } }); clockOff += 10 * 60e3; route.main = () => good({ is_real_lead: true, hotness: 70, intent: 'x', need: 'y', industry: 'Hải sản', service: 's', reply: 'r', role: 'buyer', role_reason: '' });
await twoRuns(P(3));
{ const L = store('leads/')[0]; const s = lastScan();
  ok(L && L.score === 70 && L.ai_v2 === null && s.promptV2 === false && /agency marketing/.test(sysOf(false)) && /BRAND ĐANG PHỤC VỤ/.test(sysOf(false)) && /agency marketing/.test(sysOf(true)), 'promptV2=false: prompt cũ 100 % (tầng 1 + 2), lead không ai_v2, scans.promptV2 false'); }
/* (d) reseller: brand không bán sỉ → chặn; bán sỉ → lead */
fresh({ profile: Object.assign({}, AI, { banSi: false }) }); clockOff += 10 * 60e3; route.main = () => good(V2({ role: 'đại lý', role_reason: 'nhập sỉ về bán' }));
await twoRuns(P(4));
{ const sp = store('scanned_posts/'); const s = lastScan(); ok(store('leads/').length === 0 && sp.some(p => p.decision === 'reseller' && p.role === 'reseller') && s.leadsCreated === 0, 'reseller + brand KHÔNG bán sỉ → không lead, scanned_posts decision "reseller" ' + JSON.stringify(sp.map(p => p.decision))); }
fresh({ profile: Object.assign({}, AI, { banSi: true }) }); clockOff += 10 * 60e3; route.main = () => good(V2({ role: 'reseller', role_reason: 'nhập sỉ về bán' }));
await twoRuns(P(5));
{ const L = store('leads/')[0]; ok(L && L.role === 'reseller' && L.contact_via_poster === false && /CÓ bán sỉ/.test(sysOf(false)), 'reseller + brand bán sỉ (ai.banSi) → LEAD role reseller; prompt nêu "CÓ bán sỉ"'); }
/* (e) proxy */
fresh(); clockOff += 10 * 60e3; route.main = () => good(V2({ role: 'đăng hộ', role_reason: 'hỏi giúp chị' }));
await twoRuns(P(6));
{ const L = store('leads/')[0]; ok(L && L.role === 'proxy' && L.contact_via_poster === true, 'proxy (đăng hộ) → LEAD + contact_via_poster true'); }
/* (f) role other + is_real_lead → lead, đếm roleUnknown; is_real_lead "false" chuỗi → không lead */
fresh(); clockOff += 10 * 60e3; route.main = () => good(V2({ role: 'other' }));
await twoRuns(P(7));
{ const s = lastScan(); ok(store('leads/').length === 1 && s.roleUnknown === 1, 'role other + is_real_lead → vẫn lead (không gate), scans.roleUnknown 1'); }
fresh(); clockOff += 10 * 60e3; route.main = () => good(V2({ is_real_lead: 'false' }));
await twoRuns(P(8));
{ const sp = store('scanned_posts/'); ok(store('leads/').length === 0 && sp.some(p => p.decision === 'scored_low'), 'is_real_lead "false" (chuỗi) → false → không lead (scored_low)'); }
/* (g) brand chưa có hồ sơ */
fresh({ profile: null }); clockOff += 10 * 60e3; await twoRuns(P(9));
{ const s = lastScan(); ok(store('leads/').length === 1 && Array.isArray(s.noProfileBrands) && s.noProfileBrands.includes('b1') && /chưa khai hồ sơ ngành/.test(sysOf(false)) && /chưa rõ ngành/.test(sysOf(true)), 'brand không Hồ sơ AI: prompt trung tính SME (tầng 1 + 2), scans.noProfileBrands ["b1"] ' + JSON.stringify(s.noProfileBrands)); }
/* (h) sweeper #46 chấm lại lead điểm tạm → ai_v2 · reseller không banSi → dropped rescore_role */
fresh({ profile: Object.assign({}, AI, { banSi: false }) }); clockOff += 10 * 60e3;
F.db.collection('leads').doc('L_x1').set({ brand: 'b1', source: 'Hải sản B1', source_id: 'src_b1', text: 'Cần nhập sỉ mực khô về bán', name: 'A', post_id: 'x1', post_url: G1 + 'posts/x1/', kind: 'post', ai_scored: false, score: 50, temp: 'cold', stage: 'new', detected_at: Date.now() - 3600e3 });
F.db.collection('leads').doc('L_x2').set({ brand: 'b1', source: 'Hải sản B1', source_id: 'src_b1', text: 'Cần mua mực khô cho chị mình', name: 'B', post_id: 'x2', post_url: G1 + 'posts/x2/', kind: 'post', ai_scored: false, score: 50, temp: 'cold', stage: 'new', detected_at: Date.now() - 3600e3 });
F.db.collection('brands').doc('b1').set({ ai: Object.assign({}, AI, { banSi: false }) });
route.main = (body) => /cho chị mình/.test(String(((body.messages || []).find(m => m.role === 'user') || {}).content || '')) ? good(V2({ role: 'proxy', hotness: 75, criteria: { intent: 2, fit: 2, timing: 2, industry: 2, area: 2, quality: 2 } })) : good(V2({ role: 'reseller', hotness: 80 }));
await ixm.scanAll('scheduled');
{ const x1 = F.store.get('leads/L_x1') || {}, x2 = F.store.get('leads/L_x2') || {};
  ok(x1.ai_scored === true && x1.dropped === true && x1.dropped_by === 'rescore_role' && /đại lý\/mua sỉ/.test(String(x1.dropped_reason || '')) && x1.ai_v2 && x1.ai_v2.mode === 'shadow', 'sweeper: reseller + brand không bán sỉ → dropped rescore_role "đại lý/mua sỉ", có ai_v2 ' + JSON.stringify({ d: x1.dropped_by, r: x1.dropped_reason }));
  ok(x2.ai_scored === true && !x2.dropped && x2.role === 'proxy' && x2.contact_via_poster === true && x2.score === 75 && x2.ai_v2 && x2.ai_v2.score === 67, 'sweeper: proxy → giữ lead, contact_via_poster true, score raw 75 (shadow), ai_v2.score 67 ' + JSON.stringify({ a: x2.ai_scored, d: x2.dropped, r: x2.role, c: x2.contact_via_poster, s: x2.score, v2: x2.ai_v2 })); }

OUT('\n' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' · ' + fail + ' FAIL' : ''));
process.exit(fail ? 1 : 0);
