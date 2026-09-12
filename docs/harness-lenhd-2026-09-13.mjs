/* HARNESS LỆNH D (13/09/2026) — dựng MÃ ĐANG CHẠY = (fixture B + patch B + push.js #46) + patch C → áp patch D → kiểm:
   patch OK/idempotent/LỆCH/fail-closed nguyên tử/thiếu LENH C · --check 3 file · scraper matchParentD/pidNumD (thuần) · scanAll trọn vòng trên Firestore + BrightData + LLM giả:
   scans.expireAt +90d · seen.expireAt +180d (create + merge) · lưới too_old (lịch: có / backfill: không) · hoãn AI lần 2+ không đẻ doc ai_wait · prefiltered_out +14d
   · bình luận: khớp URL / khớp id số / orphan (≥2 bài cha) ở đường GẶT theo lịch, và đường quét tay (fetchComments) · scans.cmtOrphan/cmtById/tooOld.
   LD_EXPORT_DIR=<dir> → xuất fake ~ (mã SAU C, CHƯA patch D) cho dry-run .sh rồi thoát. Chạy: node docs/harness-lenhd-2026-09-13.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, 'lenh-2026-09-12-b-fixture'), PB = path.join(HERE, 'lenh-2026-09-12-b-patch.cjs'), FX46 = path.join(HERE, 'lenh-2026-09-11-46-fixture'), P46 = path.join(HERE, 'lenh-2026-09-11-46-patch.cjs');
const PC = path.join(HERE, 'lenh-2026-09-13-c-patch.cjs'), PD = path.join(HERE, 'lenh-2026-09-13-d-patch.cjs'), BF = path.join(HERE, 'lenh-2026-09-13-d-backfill.mjs'), AF = path.join(HERE, 'lenh-2026-09-13-d-after.mjs');
const cpDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) cpDir(s, d); else fs.copyFileSync(s, d); } };
const FILES_B = ['lib/config.js', 'lib/scraper.js', 'index.js', 'outreach.js', 'stats.js', 'scanstats.js', 'lib/multitouch.js'], FILES_C = ['stats.js', 'push.js', 'index.js'], FILES_D = ['lib/config.js', 'lib/scraper.js', 'index.js'];
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
/* cây = MÃ ĐANG CHẠY (sau C): fixture B + patch B + push.js (#46) + patch C */
function prepRunning(W) {
  cpDir(FX, W); fs.copyFileSync(path.join(W, 'stubB.mjs'), path.join(W, 'stub48.mjs')); fs.copyFileSync(path.join(W, 'stubB.mjs'), path.join(W, 'stub.mjs')); fakeNodeModules(W);
  for (const f of ['stats.js', 'scanstats.js']) { const p = path.join(W, f); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/from '<che>'/g, "from './stubB.mjs'")); }
  fs.copyFileSync(path.join(HERE, 'lenh-2026-09-12-b-sources.js'), path.join(W, 'sources.js'));
  const rb = run(W, [PB, ...FILES_B]); if (rb.code !== 0 || !/PATCH OK 7 file/.test(rb.out)) throw new Error('không dựng được mã sau B: ' + rb.out.slice(0, 300));
  const W46 = fs.mkdtempSync(path.join(os.tmpdir(), 'ld46-')); cpDir(FX46, W46); const r46 = run(W46, [P46, 'lib/scorer.js', 'index.js', 'outreach.js', 'push.js']); if (r46.code !== 0) throw new Error('không dựng được push.js sau #46: ' + r46.out.slice(0, 300));
  fs.copyFileSync(path.join(W46, 'push.js'), path.join(W, 'push.js'));
  const rc = run(W, [PC, ...FILES_C]); if (rc.code !== 0 || !/PATCH OK 3 file/.test(rc.out)) throw new Error('không dựng được mã sau C: ' + rc.out.slice(0, 300));
}
if (process.env.LD_EXPORT_DIR) { const H = process.env.LD_EXPORT_DIR; const F = path.join(H, 'firebase-s13', 'functions'); prepRunning(F);
  fs.writeFileSync(path.join(F, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-5.6-sol\nLLM_PREFILTER_MODEL=gpt-5-nano\nBRIGHTDATA_TOKEN=test-bd\nBRIGHTDATA_DATASET_ID=gd_x\nPOLL_MINUTES=3\n');
  fs.writeFileSync(path.join(H, 'firebase-s13', 'firebase.json'), '{}'); console.log('exported fake HOME (mã sau C, CHƯA patch D) →', H); process.exit(0); }

/* ---------- 0. patch ---------- */
OUT('-- patch D');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'ld-')); prepRunning(W);
const r1 = run(W, [PD, ...FILES_D]); ok(r1.code === 0 && /PATCH OK 3 file/.test(r1.out) && /18 mốc/.test(r1.out), 'patch D áp trên mã sau C: PATCH OK 3 file (18 mốc)' + (r1.code ? ' — ' + r1.out.slice(0, 400) : ''));
const r2 = run(W, [PD, ...FILES_D]); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of FILES_D) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f + (r.code ? ' — ' + r.out.slice(0, 200) : '')); }
for (const f of [BF, AF]) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + path.basename(f)); }
{ const W2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ld2-')); prepRunning(W2); fs.writeFileSync(path.join(W2, 'lib/scraper.js'), fs.readFileSync(path.join(W2, 'lib/scraper.js'), 'utf8').replace("  const res = { items: [], metas: [], harvested: 0, pending: 0, failed: 0 };", "  const res = { items: [], metas: [], harvested: 0, pending: 0, failed: 0, x: 1 };"));
  const before = FILES_D.map(x => fs.readFileSync(path.join(W2, x), 'utf8')); const r = run(W2, [PD, ...FILES_D]); const same = FILES_D.every((x, i) => fs.readFileSync(path.join(W2, x), 'utf8') === before[i]);
  ok(r.code === 1 && /KHONG THAY MOC/.test(r.out) && /SC3/.test(r.out) && same, 'fail-closed NGUYÊN TỬ: 1 mốc scraper lệch → không ghi file nào (config/index đủ mốc)'); }
{ const W3 = fs.mkdtempSync(path.join(os.tmpdir(), 'ld3-')); prepRunning(W3); run(W3, [PD, ...FILES_D]); fs.copyFileSync(path.join(W, 'lib/config.js'), path.join(W3, 'lib/config.js')); const W3b = fs.mkdtempSync(path.join(os.tmpdir(), 'ld3b-')); prepRunning(W3b); fs.copyFileSync(path.join(W3, 'lib/config.js'), path.join(W3b, 'lib/config.js'));
  const r = run(W3b, [PD, ...FILES_D]); ok(r.code === 1 && /LỆCH/.test(r.out), 'lệch (config đã D, scraper/index chưa) → báo LỆCH, dừng'); }
{ const W4 = fs.mkdtempSync(path.join(os.tmpdir(), 'ld4-')); cpDir(FX, W4); fakeNodeModules(W4); fs.copyFileSync(path.join(HERE, 'lenh-2026-09-12-b-sources.js'), path.join(W4, 'sources.js')); run(W4, [PB, ...FILES_B]); /* sau B, CHƯA C */
  const r = run(W4, [PD, ...FILES_D]); ok(r.code === 1 && /chưa có marker LENH C/.test(r.out), 'mã sau B nhưng chưa C → DỪNG (LỆNH D đặt mốc sau C)'); }

/* ---------- 1. scraper thuần ---------- */
OUT('-- scraper matchParentD / pidNumD (thuần)');
const SR = await import(pathToFileURL(path.join(W, 'lib/scraper.js')).href);
{ const uk = u => String(u || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  const G = 'https://www.facebook.com/groups/1189400231607822/'; const metas = [{ url: G + 'posts/100000001/', srcUrl: G }, { url: G + 'posts/100000002/', srcUrl: G }];
  const byKey = new Map(metas.map(m => [uk(m.url), m])); const byPid = SR.byPidMapD(metas);
  const t1 = SR.matchParentD({ post_url: G + 'posts/100000002' }, byKey, byPid, metas, uk); ok(t1 && t1.m === metas[1] && !t1.byId, 'khớp URL chuẩn hoá (bỏ / cuối) → bài 2');
  const t2 = SR.matchParentD({ post_url: 'https://m.facebook.com/groups/1189400231607822/permalink/100000001/?ref=x' }, byKey, byPid, metas, uk); ok(t2 && t2.m === metas[0] && t2.byId, 'khớp theo ID SỐ (m.facebook + permalink + query) → bài 1, byId');
  const t3 = SR.matchParentD({ post_id: '100000002' }, byKey, byPid, metas, uk); ok(t3 && t3.m === metas[1] && t3.byId, 'post_id số trần → bài 2');
  const t4 = SR.matchParentD({ post_url: G + 'posts/999999999/' }, byKey, byPid, metas, uk); ok(t4 === null, '2 bài cha, không khớp → null (orphan), KHÔNG rơi về bài đầu');
  const t5 = SR.matchParentD({ post_url: G + 'posts/999999999/' }, new Map([[uk(metas[0].url), metas[0]]]), SR.byPidMapD([metas[0]]), [metas[0]], uk); ok(t5 && t5.m === metas[0] && !t5.byId, '1 bài cha duy nhất → nhận (không thể lệch)');
  const t6 = SR.matchParentD({ post_url: 'https://www.facebook.com/story.php?story_fbid=100000001&id=123' }, byKey, byPid, metas, uk); ok(t6 && t6.m === metas[0] && t6.byId, 'story.php?story_fbid= → khớp id số');
  const t7 = SR.matchParentD({ post_url: G + 'posts/12345/' }, byKey, byPid, metas, uk); ok(t7 === null, 'id <6 chữ số không coi là id bài → orphan (tránh khớp nhầm số ngắn)'); }

/* ---------- 2. scanAll trọn vòng ---------- */
OUT('-- index.js scanAll (TTL scans/seen · too_old · hoãn AI · prefiltered 14d · bình luận fail-closed)');
const stub = await import(pathToFileURL(path.join(W, 'stubB.mjs')).href);
const CFG = (await import(pathToFileURL(path.join(W, 'lib/config.js')).href)).CFG;
const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href); const mt = await import(pathToFileURL(path.join(W, 'lib/multitouch.js')).href);
const cfg = sc.scoreLead.cfg46;
Object.assign(CFG, { LLM_API_KEY: 'test-key', LLM_MODEL: 'gpt-5.6-sol', LLM_PREFILTER_MODEL: 'gpt-5-nano', SCAN_COMMENTS: true, BD_SOW_MODE: true, SCORE_CONCURRENCY: 1, PREFILTER_CONCURRENCY: 1, MIN_KEEP_SCORE: 40, HOT_THRESHOLD: 80, LOG_SCANNED_POSTS: true, SCANNED_TTL_DAYS: 3, POSTS_PER_GROUP: 20, PROBE_POSTS: 5, FULLSWEEP_HOURS: 2, SCAN_SOURCE_INTERVAL_MIN: 10, BRIGHTDATA_TOKEN: 'bd-test', BRIGHTDATA_DATASET_ID: 'gd_posts', BRIGHTDATA_COMMENTS_DATASET_ID: 'gd_cmt', RESCORE_FALLBACK: false, ZALO_CHECK_COLD: false, COMMENTS_PER_POST: 5, SCANS_TTL_DAYS: 90, SEEN_TTL_DAYS: 180, TOO_OLD_DAYS: 45, PREFILTERED_TTL_DAYS: 14 });
ok(CFG.SCANS_TTL_DAYS === 90 && CFG.SEEN_TTL_DAYS === 180 && CFG.TOO_OLD_DAYS === 45 && CFG.PREFILTERED_TTL_DAYS === 14, 'config: 4 khoá TTL/too_old có mặt (mặc định 90/180/45/14)');
cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300; cfg.budgetMs = 100000;
const realNow = Date.now; let clockOff = 0; Date.now = () => realNow() + clockOff;
const LOGS = []; for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); if (process.env.LD_VERBOSE) o(...a); }; }
const ixm = await import(pathToFileURL(path.join(W, 'index.js')).href);
const good = (obj) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: 'gpt-test' } });
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: () => null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body), json: async () => r.body });
const LEAD = { is_real_lead: true, hotness: 85, intent: 'cần mua gấp', need: 'mua 20 kg mực khô', industry: 'Hải sản', service: 'Mực khô', reply: 'Chào anh, bên em có mực khô loại 1 ạ.', role: 'buyer', role_reason: 'hỏi mua' };
let calls = []; let route = { pre: () => good({ maybe: true }), main: () => good(LEAD) };
const BD = { triggers: [], snaps: new Map(), n: 0, readyDelay: 0, busy: false, triggerFail: false, recordsFor: () => [], cmtRecordsFor: () => [] };
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('api.brightdata.com')) {
    if (u.includes('/trigger?')) { if (BD.triggerFail) return mk({ status: 400, body: 'Customer is not active' }); const inputs = JSON.parse(opt.body); const id = 'sd_' + (++BD.n); const isCmt = u.includes('dataset_id=gd_cmt'); BD.triggers.push({ id, inputs, url: u, isCmt }); BD.snaps.set(id, { at: Date.now(), inputs, isCmt }); return mk({ status: 200, body: { snapshot_id: id } }); }
    if (u.includes('/progress/')) { const id = u.split('/progress/')[1]; if (BD.busy) return mk({ status: 429, body: { error: 'rate' } }); const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: { status: 'failed' } }); return mk({ status: 200, body: { status: (Date.now() - s.at) >= BD.readyDelay ? 'ready' : 'running' } }); }
    if (u.includes('/snapshot/')) { const id = u.split('/snapshot/')[1].split('?')[0]; const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: [] }); const recs = s.isCmt ? s.inputs.flatMap(i => BD.cmtRecordsFor(i)) : s.inputs.flatMap(i => BD.recordsFor(i).map(r => Object.assign({ input: { url: i.url, num_of_posts: i.num_of_posts || null, start_date: i.start_date || null, posts_to_not_include: i.posts_to_not_include || [] } }, r))); return mk({ status: 200, body: recs }); }
    return mk({ status: 404, body: {} });
  }
  const body = JSON.parse(opt.body); calls.push({ url: u, body, opt }); const isPre = body.model === CFG.LLM_PREFILTER_MODEL; const r = await (isPre ? route.pre : route.main)(body, opt); return mk(r);
};
const G1 = 'https://www.facebook.com/groups/1189400231607822/', G1b = 'https://www.facebook.com/groups/1189400231607822';
const P1 = '100000001', P2 = '100000002', P3 = '100000003', P4 = '100000004';
const rec = (id, extra) => Object.assign({ post_id: id, url: G1 + 'posts/' + id + '/', content: 'Cần mua ' + id + ' kg mực khô rim me, ai có báo giá', group_id: '1189400231607822', num_comments: 0, profile_id: '1000' + id.padStart(12, '0'), date_posted: new Date(Date.now() - 60e3).toISOString() }, extra || {});
const cmt = (post_url, txt, extra) => Object.assign({ comment_id: 'c_' + Math.abs(hash(txt)), post_url, comment_text: txt, user_name: 'Khách ' + txt.slice(0, 4), date_created: new Date(Date.now() - 30e3).toISOString(), commentator_profile_url: 'https://www.facebook.com/profile.php?id=100099' + Math.abs(hash(txt)) % 1000 }, extra || {});
function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
let F;
function fresh(opts) { F = stub.makeDb(); LOGS.length = 0; calls = []; BD.triggers = []; BD.snaps.clear(); BD.busy = false; BD.triggerFail = false; BD.readyDelay = 0; BD.recordsFor = () => []; BD.cmtRecordsFor = () => [];
  globalThis.__slB = { db: F.db }; globalThis.__sl48 = { db: F.db, isExcluded: () => false, enrichPhoneFromText: async () => ({ phone: '', phone_has_zalo: null, email: '' }), checkZalo: async () => ({ registered: true }), brandAiOf: (src) => ({ nganh: 'Ngành ' + ((src && src.brand) || '') }), tryMergeTouch: (db, lead, oo) => mt.tryMergeTouch(db, lead, oo) };
  F.db.collection('sources').doc('src_b1').set({ name: 'Hải sản B1', url: G1, brand: 'b1', active: true, industry: 'Hải sản' });
  if (opts && opts.shared) F.db.collection('sources').doc('src_b2').set({ name: 'Hải sản B2', url: G1b, brand: 'b2', active: true, industry: 'Hải sản', sharedAt: Date.now() - 30 * 60e3, sharedBy: 'u2' });
  F.db.collection('config').doc('app').set({ aiMode: 'saver', scanComments: !!(opts && opts.comments) }); route = { pre: () => good({ maybe: true }), main: () => good(LEAD) }; return F; }
const store = (pre) => [...F.store.entries()].filter(([k]) => k.startsWith(pre)).map(([k, v]) => Object.assign({ __id: k.slice(pre.length) }, v));
const dayAt = ms => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
const daysFrom = (d, base) => { const t = d instanceof Date ? d.getTime() : (typeof d === 'number' ? d : (d && d.toMillis ? d.toMillis() : (Date.parse(String(d || '')) || 0))); return t ? Math.round((t - (base || Date.now())) / 864e5) : null; }; /* stub lưu Date thành chuỗi ISO */

/* (a) lượt theo lịch: scans.expireAt +90d · seen.expireAt +180d · too_old · prefiltered_out +14d */
fresh({ shared: true }); clockOff = 0;
const OLD = new Date(Date.now() - 60 * 864e5).toISOString();
BD.recordsFor = i => (i.url === G1 ? [rec(P1), rec(P2, { date_posted: OLD, content: 'Cần mua 2 kg mực khô rim me' }), rec(P3, { content: 'Ai biết chỗ bán mực ngon PREFAIL' })] : []);
route.pre = (body) => good({ maybe: !/PREFAIL/.test(JSON.stringify(body)) });
F.db.collection('seen').doc(P1).set({ at: Date.now() - 5 * 60e3, brands: { b1: 'lead' } }); /* doc seen CŨ (không expireAt) đã có brand b1 → b2 sẽ MERGE */
let sum = await ixm.scanAll('scheduled'); clockOff += 130e3; sum = await ixm.scanAll('scheduled');
{ const scans = store('scans/').filter(s => s.trigger === 'scheduled'); const last = scans[scans.length - 1] || {}; const sp = store('scanned_posts/'); const seen = store('seen/');
  const old = sp.filter(p => p.decision === 'too_old'); const pre = sp.filter(p => p.decision === 'prefiltered_out'); const leads = store('leads/');
  ok(scans.length >= 1 && daysFrom(last.expireAt) === 90 && last.tooOld === 2 && last.cmtOrphan === 0, 'scans: doc lượt có expireAt = +90 ngày · tooOld 2 (1 bài × 2 brand dùng chung) · cmtOrphan 0' + ' ' + JSON.stringify({ exp: last.expireAt, d: daysFrom(last.expireAt), tooOld: last.tooOld, orphan: last.cmtOrphan }));
  ok(old.length === 2 && old.every(p => p.post_url === G1 + 'posts/' + P2 + '/') && !calls.some(c => /2 kg mực khô rim me/.test(JSON.stringify(c.body))), 'too_old: bài đăng 60 ngày → scanned_posts decision too_old cho CẢ 2 brand dùng chung, KHÔNG gọi AI cho bài đó');
  ok(!leads.some(l => /2 kg mực khô rim me/.test(String(l.text || ''))) && leads.some(l => /100000001 kg/.test(String(l.text || ''))), 'too_old không thành lead; bài mới vẫn thành lead');
  const s1 = seen.find(x => x.__id === P1), s2 = seen.find(x => x.__id === P2);
  ok(s1 && s1.brands && s1.brands.b1 === 'lead' && s1.brands.b2 && daysFrom(s1.expireAt) === 180, 'seen MERGE (doc cũ không expireAt, thêm brand b2) → expireAt = +180 ngày, giữ brand b1 ' + JSON.stringify(s1));
  ok(s2 && daysFrom(s2.expireAt) === 180 && s2.brands && s2.brands.b1 === 'old', 'seen CREATE cho bài too_old: expireAt +180 ngày, brands.b1 = "old" ' + JSON.stringify(s2));
  ok(pre.length >= 1 && pre.every(p => daysFrom(p.expireAt) === 14), 'prefiltered_out: scanned_posts expireAt = +14 ngày (đối soát tầng 1) ' + JSON.stringify({ n: pre.length, exp: pre[0] && pre[0].expireAt, d: pre[0] && daysFrom(pre[0].expireAt) })); }
/* (b) backfill KHÔNG qua lưới too_old */
{ fresh(); clockOff += 10 * 60e3; BD.recordsFor = i => (i.url === G1 ? [rec(P4, { date_posted: OLD, content: 'Cần mua 4 kg mực khô cũ' })] : []);
  const r = await ixm.scanAll('manual-backfill', { sourceUrl: G1, startDate: '2026-07-01', endDate: '2026-07-20', numPosts: 5, rangeLabel: '20d' }); const leads = store('leads/'); const sp = store('scanned_posts/');
  ok(leads.some(l => /4 kg mực khô cũ/.test(String(l.text || ''))) && !sp.some(p => p.decision === 'too_old'), 'backfill: bài 60 ngày vẫn chấm + thành lead (không qua lưới too_old)'); }
/* (c) hoãn AI: lần 1 ghi ai_wait, lần 2 KHÔNG ghi thêm, lần 3 OK → lead */
{ fresh(); clockOff += 10 * 60e3; BD.recordsFor = i => (i.url === G1 ? [rec(P3, { content: 'Cần mua 3 kg mực khô FAILME' })] : []);
  route.main = (body) => /FAILME/.test(JSON.stringify(body)) ? { status: 500, body: 'boom' } : good(LEAD);
  await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled');
  const aw1 = store('scanned_posts/').filter(p => p.decision === 'ai_wait').length; const rq = store('score_retry/');
  ok(aw1 === 1 && rq.length === 1 && rq[0].tries === 1, 'hoãn lần 1: 1 doc ai_wait + score_retry tries 1');
  clockOff += 4 * 60e3; await ixm.scanAll('scheduled');
  const aw2 = store('scanned_posts/').filter(p => p.decision === 'ai_wait').length; const rq2 = store('score_retry/');
  ok(aw2 === 1 && rq2.length === 1 && rq2[0].tries === 2, 'hoãn lần 2 (score_retry tới hạn, AI vẫn lỗi): KHÔNG đẻ thêm doc ai_wait (vẫn 1), tries 2');
  route.main = () => good(LEAD); clockOff += 11 * 60e3; await ixm.scanAll('scheduled');
  ok(store('leads/').some(l => /FAILME/.test(String(l.text || ''))) && store('score_retry/').length === 0, 'AI hồi → lead tạo, score_retry gỡ'); }
/* (d) bình luận gặt theo lịch: khớp URL / khớp id số / orphan */
{ fresh({ comments: true }); clockOff += 10 * 60e3;
  BD.recordsFor = i => (i.url === G1 ? [rec(P1, { num_comments: 2 }), rec(P2, { num_comments: 2 })] : []);
  BD.cmtRecordsFor = i => { const u = String(i.url || ''); if (u.includes(P1)) return [cmt(G1 + 'posts/' + P1, 'Giá sao b ơi bài một')]; if (u.includes(P2)) return [cmt('https://m.facebook.com/groups/1189400231607822/permalink/' + P2 + '/?ref=share', 'Inbox mình bài hai'), cmt(G1 + 'posts/999999999/', 'Comment lạc bài')]; return []; };
  await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled'); /* gặt bài + gieo bình luận */
  const sownCmt = BD.triggers.filter(t => t.isCmt).length; clockOff += 200e3; await ixm.scanAll('scheduled'); const s3 = store('scans/').slice(-1)[0] || {}; /* gặt bình luận */
  const cl = store('leads/').filter(l => l.kind === 'comment'); const byTxt = t => cl.find(l => new RegExp(t).test(String(l.text || '')));
  ok(sownCmt >= 1 && cl.length === 2 && byTxt('bài một') && byTxt('bài hai') && !byTxt('lạc bài'), 'gặt bình luận: 2 lead bình luận (khớp URL + khớp id số qua m.facebook/permalink), bình luận lạc bài KHÔNG dán vào bài đầu');
  ok(byTxt('bài hai') && byTxt('bài hai').parent_url === G1 + 'posts/' + P2 + '/' && /100000002 kg/.test(String(byTxt('bài hai').parent_text || '')), 'bình luận khớp theo id số nhận đúng bài cha 2 (parent_url/parent_text)');
  ok(s3 && s3.cmtOrphan === 1 && s3.cmtById === 1, 'scans.cmtOrphan 1 · cmtById 1'); }
/* (e) quét tay (fetchComments không sow): khớp fail-closed */
{ fresh({ comments: true }); clockOff += 10 * 60e3;
  BD.recordsFor = i => (i.url === G1 ? [rec(P1, { num_comments: 1 }), rec(P2, { num_comments: 1 })] : []);
  BD.cmtRecordsFor = i => { const u = String(i.url || ''); if (u.includes(P1)) return [cmt(G1 + 'posts/' + P1 + '/', 'Quét tay bài một'), cmt(G1 + 'posts/888888888/', 'Quét tay lạc')]; if (u.includes(P2)) return [cmt('', 'Quét tay không url', { post_id: P2 })]; return []; };
  await ixm.scanAll('manual', { sourceUrl: G1 }); const r = store('scans/').slice(-1)[0] || {}; const cl = store('leads/').filter(l => l.kind === 'comment'); const byTxt = t => cl.find(l => new RegExp(t).test(String(l.text || '')));
  ok(cl.length === 2 && byTxt('bài một') && byTxt('không url') && !byTxt('lạc') && r.cmtOrphan === 1 && r.cmtById === 1, 'quét tay: khớp URL + khớp post_id số (không post_url) → 2 lead; lạc → orphan 1, không dán bài đầu lô ' + JSON.stringify({ n: cl.length, txt: cl.map(l => String(l.text || '').slice(0, 20)), orphan: r.cmtOrphan, byId: r.cmtById, trigger: r.trigger })); }
/* (f) 1 bài cha duy nhất trong lô → bình luận URL lạ vẫn nhận */
{ fresh({ comments: true }); clockOff += 10 * 60e3;
  BD.recordsFor = i => (i.url === G1 ? [rec(P1, { num_comments: 1 })] : []);
  BD.cmtRecordsFor = () => [cmt('https://www.facebook.com/groups/1189400231607822/user/123/?comment_id=5', 'Bình luận url lạ')];
  await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled'); clockOff += 200e3; await ixm.scanAll('scheduled'); const s3 = store('scans/').slice(-1)[0] || {};
  ok(store('leads/').some(l => l.kind === 'comment' && /url lạ/.test(String(l.text || ''))) && s3.cmtOrphan === 0, '1 bài cha duy nhất → nhận bình luận URL lạ (không thể lệch), orphan 0 ' + JSON.stringify({ orphan: s3.cmtOrphan, cl: store('leads/').filter(l => l.kind === 'comment').length })); }

OUT('\n' + pass + '/' + (pass + fail) + ' PASS' + (fail ? ' · ' + fail + ' FAIL' : ''));
process.exit(fail ? 1 : 0);
