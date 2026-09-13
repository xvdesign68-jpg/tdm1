/* Harness LỆNH G (13/09/2026) — Đợt 2.5 PC-3 "bộ nhớ người viết" (author_memory: người bán quen bỏ trước AI · khách cũ quay lại có cờ + ghi chú + push · CF clearAuthorMemory).
   Dựng mã đang chạy = harness F export (mã sau E) + patch F + contactcf.js = MÃ SAU F → áp patch G (index.js · stats.js · push.js) + authmemcf.js + Rules → chạy TRỌN scanAll trên Firestore + BrightData + LLM giả.
   0. patch G: PATCH OK 3 file / idempotent / --check ×4 / fail-closed NGUYÊN TỬ (1 mốc lệch → không ghi file nào) / thiếu LENH F → dừng / vá dở → dừng · Rules: OK / idempotent / mốc thiếu
   1. học người bán: bài 1 AI seller → sellerHits 1 · bài 2 → 2 · bài 3 → seller_known KHÔNG gọi AI (seen 'seller', scanned_posts author_key/memHits, scans.sellerKnown) · force (Quét lại từ đầu) vẫn chấm + bài đã đếm không đếm lại
   2. người có 1 bài thành lead (buyer) → không bao giờ seller_known · 3. bộ nhớ cũ > 30 ngày → chấm lại; AI seller lần nữa → lại thành người bán quen
   4. khách cũ (brands.b1.lastStage closed) → lead mới returning + ghi chú 🔁 + scans.returning + bộ nhớ ghi lead mới · brand khác → không · 5. sweeper #46 chấm lại điểm tạm → nuôi bộ nhớ
   6. stats.js stageMemG thuần + statsOnLead ghi brands.<brand>.lastStage · 7. push.js returningGateG + pushOnLead gửi tới người phụ trách cũ / admin brand, 1 lần · 8. CF clearAuthorMemory 401/403/400/clear/seller + ai_feedback
   LG_EXPORT_DIR=<dir> → xuất fake ~ (mã SAU F, CHƯA patch G) cho dry-run .sh rồi thoát. Chạy: node docs/harness-lenhg-2026-09-13.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HF = path.join(HERE, 'harness-lenhf-2026-09-13.mjs'), PF = path.join(HERE, 'lenh-2026-09-13-f-patch.cjs'), CFF = path.join(HERE, 'lenh-2026-09-13-f-contactcf.js');
const PG = path.join(HERE, 'lenh-2026-09-13-g-patch.cjs'), CFG_JS = path.join(HERE, 'lenh-2026-09-13-g-authmemcf.js'), RULES = path.join(HERE, 'lenh-2026-09-13-g-rules.cjs'), AFTER = path.join(HERE, 'lenh-2026-09-13-g-after.mjs');
const OUT = console.log.bind(console); let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; OUT('  ✓', m); } else { fail++; OUT('  ✗', m); } };
const run = (cwd, args, env) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
/* mã đang chạy SAU F */
function prepRunning(W) {
  const H = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-h-')); const e0 = run(HERE, [HF], { LF_EXPORT_DIR: H }); if (e0.code !== 0) throw new Error('không export được mã sau E: ' + e0.out.slice(0, 300));
  const F = path.join(H, 'firebase-s13', 'functions'); fs.copyFileSync(CFF, path.join(F, 'contactcf.js')); const rF = run(F, [PF, 'index.js']); if (rF.code !== 0 || !/PATCH OK index.js/.test(rF.out)) throw new Error('không áp được patch F: ' + rF.out.slice(0, 300));
  fs.cpSync(F, W, { recursive: true }); fs.rmSync(H, { recursive: true, force: true }); return W;
}
if (process.env.LG_EXPORT_DIR) { const H = process.env.LG_EXPORT_DIR; const F = path.join(H, 'firebase-s13', 'functions'); fs.mkdirSync(F, { recursive: true }); prepRunning(F);
  fs.writeFileSync(path.join(F, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-5.6-sol\nLLM_PREFILTER_MODEL=gpt-5-nano\nBRIGHTDATA_TOKEN=test-bd\nBRIGHTDATA_DATASET_ID=gd_x\nPOLL_MINUTES=3\n');
  fs.writeFileSync(path.join(H, 'firebase-s13', 'firebase.json'), '{}');
  fs.writeFileSync(path.join(H, 'firebase-s13', 'firestore.rules'), "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    function isSuperAdmin() { return true; }\n    match /leads/{id} { allow read: if true; }\n  }\n}\n");
  console.log('exported fake HOME (mã sau F, CHƯA patch G) →', H); process.exit(0); }

/* ---------- 0. patch ---------- */
OUT('-- patch G');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-')); prepRunning(W); fs.copyFileSync(CFG_JS, path.join(W, 'authmemcf.js'));
const before = { index: fs.readFileSync(path.join(W, 'index.js'), 'utf8'), stats: fs.readFileSync(path.join(W, 'stats.js'), 'utf8'), push: fs.readFileSync(path.join(W, 'push.js'), 'utf8') };
const ARGS = ['index.js', 'stats.js', 'push.js'];
const r1 = run(W, [PG, ...ARGS]); ok(r1.code === 0 && /PATCH OK 3 file/.test(r1.out) && /index\.js 13 mốc/.test(r1.out) && /stats\.js 2 mốc/.test(r1.out) && /push\.js 2 mốc/.test(r1.out), 'patch G áp trên mã sau F: PATCH OK 3 file (index 13 · stats 2 · push 2)' + (r1.code ? ' — ' + r1.out.slice(0, 400) : ''));
const r2 = run(W, [PG, ...ARGS]); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of ['index.js', 'stats.js', 'push.js', 'authmemcf.js']) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f + (r.code ? ' — ' + r.out.slice(0, 200) : '')); }
{ const r = run(HERE, ['--check', AFTER]); ok(r.code === 0, 'node --check lenh-2026-09-13-g-after.mjs'); }
{ const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-t-')); const bad = before.index.replace("    await commitLeadNow(x.row, { ...__pf,", "    await commitLeadNow(x.row, { /*x*/ ...__pf,"); fs.writeFileSync(path.join(T, 'index.js'), bad); fs.writeFileSync(path.join(T, 'stats.js'), before.stats); fs.writeFileSync(path.join(T, 'push.js'), before.push);
  const r = run(T, [PG, ...ARGS]); ok(r.code === 1 && /mốc G7/.test(r.out) && fs.readFileSync(path.join(T, 'index.js'), 'utf8') === bad && fs.readFileSync(path.join(T, 'stats.js'), 'utf8') === before.stats && fs.readFileSync(path.join(T, 'push.js'), 'utf8') === before.push, 'fail-closed NGUYÊN TỬ: mốc G7 (index) lệch → exit 1, KHÔNG ghi cả 3 file'); }
{ const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-t2-')); fs.writeFileSync(path.join(T, 'index.js'), before.index.replace(/LENH F\b/g, 'LENH Fx')); fs.writeFileSync(path.join(T, 'stats.js'), before.stats); fs.writeFileSync(path.join(T, 'push.js'), before.push); const r = run(T, [PG, ...ARGS]); ok(r.code === 1 && /thiếu marker LENH B\/E\/F/.test(r.out), 'thiếu marker LENH F → DỪNG'); }
{ const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-t3-')); fs.writeFileSync(path.join(T, 'index.js'), before.index); fs.writeFileSync(path.join(T, 'stats.js'), before.stats + '\n/* LENH G */\n'); fs.writeFileSync(path.join(T, 'push.js'), before.push); const r = run(T, [PG, ...ARGS]); ok(r.code === 1 && /vá dở/.test(r.out) && fs.readFileSync(path.join(T, 'index.js'), 'utf8') === before.index, 'marker LENH G chỉ ở 1 file (vá dở) → DỪNG, không ghi'); }
/* Rules */
{ const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-r-')); const R0 = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    function isSuperAdmin() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin'; }\n    match /workers/{wid} { allow read: if isSuperAdmin(); allow write: if false; }\n  }\n}\n"; fs.writeFileSync(path.join(T, 'firestore.rules'), R0);
  const a = run(T, [RULES, 'firestore.rules']); const s1 = fs.readFileSync(path.join(T, 'firestore.rules'), 'utf8');
  ok(a.code === 0 && /PATCH OK/.test(a.out) && /match \/author_memory\/\{k\} \{ allow read: if isSuperAdmin\(\); allow write: if false; \}/.test(s1) && /match \/ai_feedback\/\{k\}/.test(s1) && s1.indexOf('match /author_memory/') < s1.indexOf('match /workers/'), 'Rules: chèn 2 block author_memory + ai_feedback (read super, write false) ngay sau documents {');
  const b = run(T, [RULES, 'firestore.rules']); ok(b.code === 0 && /idempotent/.test(b.out) && fs.readFileSync(path.join(T, 'firestore.rules'), 'utf8') === s1, 'Rules chạy lần 2 → idempotent');
  fs.writeFileSync(path.join(T, 'firestore.rules'), R0.replace('match /databases/{database}/documents {', 'match /x {')); const c = run(T, [RULES, 'firestore.rules']); ok(c.code === 1 && /KHONG THAY MOC/.test(c.out), 'Rules thiếu mốc documents { → dừng, không ghi'); }

/* ---------- 1–5. scanAll trọn vòng ---------- */
OUT('-- index.js scanAll (người bán quen · khách cũ quay lại · sweeper)');
const stub = await import(pathToFileURL(path.join(W, 'stubB.mjs')).href); const mt = await import(pathToFileURL(path.join(W, 'lib/multitouch.js')).href);
const { CFG } = await import(pathToFileURL(path.join(W, 'lib/config.js')).href); const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href); const cfg = sc.scoreLead.cfg46; cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300; cfg.budgetMs = 100000;
Object.assign(CFG, { LLM_API_KEY: 'test-key', LLM_MODEL: 'gpt-5.6-sol', LLM_PREFILTER_MODEL: 'gpt-5-nano', SCAN_COMMENTS: true, BD_SOW_MODE: true, SCORE_CONCURRENCY: 1, PREFILTER_CONCURRENCY: 1, MIN_KEEP_SCORE: 40, HOT_THRESHOLD: 80, LOG_SCANNED_POSTS: true, SCANNED_TTL_DAYS: 3, POSTS_PER_GROUP: 20, PROBE_POSTS: 5, FULLSWEEP_HOURS: 2, BD_PROGRESS_MIN_AGE_S: 120, SCAN_INTERVAL_MIN_FLOOR: 5, HOUSEKEEPING_MIN: 5, ZALO_CHECK_COLD: false, SCAN_SOURCE_INTERVAL_MIN: 10, BRIGHTDATA_TOKEN: 'bd-test', BRIGHTDATA_DATASET_ID: 'gd_posts', BRIGHTDATA_COMMENTS_DATASET_ID: 'gd_cmt', COMMENTS_PER_POST: 5, SCANS_TTL_DAYS: 90, SEEN_TTL_DAYS: 180, TOO_OLD_DAYS: 45, PREFILTERED_TTL_DAYS: 14, PROMPT_BRAND_V2: true, SCORE_V2: 'shadow', RESCORE_FALLBACK: true });
const realNow = Date.now; let clockOff = 0; Date.now = () => realNow() + clockOff;
const LOGS = []; for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); if (process.env.LG_VERBOSE) o(...a); }; }
const ixm = await import(pathToFileURL(path.join(W, 'index.js')).href);
const good = (obj) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: 'gpt-test' } });
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: () => null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body), json: async () => r.body });
const V2 = (o) => Object.assign({ is_real_lead: true, hotness: 85, criteria: { intent: 3, fit: 3, timing: 3, industry: 3, area: 3, quality: 3 }, confidence: 0.9, why: ['cần mua'], intent: 'cần mua gấp', need: 'mua mực khô', industry: 'Hải sản', service: 'Mực khô', reply: 'Chào anh.', role: 'buyer', role_reason: 'hỏi mua' }, o || {});
const SELLER = () => good(V2({ is_real_lead: false, hotness: 8, role: 'seller', role_reason: 'đang chào bán', intent: 'bán hàng', criteria: { intent: 0, fit: 0, timing: 0, industry: 2, area: 1, quality: 1 } }));
let calls = []; let route = { pre: () => good({ maybe: true }), main: () => good(V2()) };
const BD = { triggers: [], snaps: new Map(), n: 0, readyDelay: 0, recordsFor: () => [], cmtRecordsFor: () => [] };
globalThis.fetch = async (url, opt) => {
  const u = String(url);
  if (u.includes('api.brightdata.com')) {
    if (u.includes('/trigger?')) { const inputs = JSON.parse(opt.body); const id = 'sd_' + (++BD.n); const isCmt = u.includes('dataset_id=gd_cmt'); BD.triggers.push({ id, inputs, url: u, isCmt }); BD.snaps.set(id, { at: Date.now(), inputs, isCmt }); return mk({ status: 200, body: { snapshot_id: id } }); }
    if (u.includes('/progress/')) { const id = u.split('/progress/')[1]; const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: { status: 'failed' } }); return mk({ status: 200, body: { status: (Date.now() - s.at) >= BD.readyDelay ? 'ready' : 'running' } }); }
    if (u.includes('/snapshot/')) { const id = u.split('/snapshot/')[1].split('?')[0]; const s = BD.snaps.get(id); if (!s) return mk({ status: 404, body: [] }); const recs = s.isCmt ? s.inputs.flatMap(i => BD.cmtRecordsFor(i)) : s.inputs.flatMap(i => BD.recordsFor(i).map(r => Object.assign({ input: { url: i.url, num_of_posts: i.num_of_posts || null, start_date: i.start_date || null, posts_to_not_include: i.posts_to_not_include || [] } }, r))); return mk({ status: 200, body: recs }); }
    return mk({ status: 404, body: {} });
  }
  const body = JSON.parse(opt.body); calls.push({ url: u, body, opt }); const isPre = body.model === CFG.LLM_PREFILTER_MODEL; const r = await (isPre ? route.pre : route.main)(body, opt); return mk(r);
};
const G1 = 'https://www.facebook.com/groups/1189400231607822/', G2 = 'https://www.facebook.com/groups/2289400231607899/'; const P = n => '10000000' + n; const PURL = id => G1 + 'posts/' + id + '/';
const UID = n => '1000' + String(n).padStart(12, '0'); const PROF = n => 'https://www.facebook.com/profile.php?id=' + UID(n); const KEY = n => 'id:' + UID(n);
const rec = (id, author, extra) => Object.assign({ post_id: id, url: PURL(id), content: 'Cần mua ' + id + ' kg mực khô rim me, ai có báo giá', group_id: '1189400231607822', num_comments: 0, profile_id: UID(author), user_name: 'Người ' + author, date_posted: new Date(Date.now() - 60e3).toISOString() }, extra || {});
const mainCalls = () => calls.filter(c => c.body.model !== CFG.LLM_PREFILTER_MODEL).length;
let F;
function fresh() { F = stub.makeDb(); LOGS.length = 0; calls = []; BD.triggers = []; BD.snaps.clear(); BD.readyDelay = 0; BD.recordsFor = () => []; BD.cmtRecordsFor = () => [];
  globalThis.__slB = { db: F.db }; globalThis.__sl48 = { db: F.db, isExcluded: () => false, enrichPhoneFromText: async () => ({ phone: '', phone_has_zalo: null, email: '' }), checkZalo: async () => ({ registered: true, source: 'api' }), brandAiOf: () => ({ nganh: 'Hải sản khô', dichvu: 'Mực khô', khach: 'quán nhậu', giong: 'thân thiện' }), tryMergeTouch: (db, lead, oo) => mt.tryMergeTouch(db, lead, oo) };
  F.db.collection('sources').doc('src_b1').set({ name: 'Hải sản B1', url: G1, brand: 'b1', active: true, industry: 'Hải sản' });
  F.db.collection('config').doc('app').set({ aiMode: 'saver', scanComments: true }); route = { pre: () => good({ maybe: true }), main: () => good(V2()) }; return F; }
const store = (pre) => [...F.store.entries()].filter(([k]) => k.startsWith(pre)).map(([k, v]) => Object.assign({ __id: k.slice(pre.length) }, v));
const lastScan = () => store('scans/').filter(s => s.status === 'done').slice(-1)[0] || {};
const mem = n => F.store.get('author_memory/' + KEY(n)) || null;
const scanManual = async (recs) => { calls = []; BD.recordsFor = i => (i.url === G1 ? recs : []); await ixm.scanAll('manual', { sourceUrl: G1 }); };

/* (1) học người bán → seller_known */
{ fresh(); clockOff = 0; route.main = SELLER;
  await scanManual([rec(P(11), 7)]); let m = mem(7);
  ok(m && m.sellerHits === 1 && Array.isArray(m.sellerIds) && m.sellerIds.includes(P(11)) && m.lastRole === 'seller' && m.lastSellerAt > 0 && m.buyerHits === undefined && m.name === 'Người 7', 'bài 1 AI chấm seller → author_memory ' + KEY(7) + ' sellerHits 1 · sellerIds [bài] · lastRole seller ' + JSON.stringify(m && { s: m.sellerHits, ids: m.sellerIds, r: m.lastRole }));
  ok(store('scanned_posts/').some(p => p.decision === 'seller' && p.author_key === KEY(7) && p.memHits === 0) && lastScan().sellerKnown === 0, 'scanned_posts decision seller mang author_key · memHits 0 · scans.sellerKnown 0');
  clockOff += 10 * 60e3; await scanManual([rec(P(12), 7)]); m = mem(7); ok(m && m.sellerHits === 2 && m.sellerIds.length === 2 && mainCalls() === 1, 'bài 2 (khác) AI seller → sellerHits 2 (AI vẫn được gọi)');
  clockOff += 10 * 60e3; await scanManual([rec(P(13), 7)]); const s3 = lastScan(); const sp3 = store('scanned_posts/').find(p => p.post_url === PURL(P(13))); const seen3 = F.store.get('seen/' + P(13));
  ok(mainCalls() === 0 && calls.length === 0 && sp3 && sp3.decision === 'seller_known' && sp3.role === 'seller' && sp3.author_key === KEY(7) && sp3.memHits === 2 && s3.sellerKnown === 1 && seen3 && seen3.brands && seen3.brands.b1 === 'seller' && !store('leads/').length, 'bài 3 → seller_known: KHÔNG gọi AI (0 lượt tầng 1/2) · scanned_posts role seller/memHits 2 · seen.brands.b1 = seller · scans.sellerKnown 1 · không lead ' + JSON.stringify({ calls: calls.length, dec: sp3 && sp3.decision, seen: seen3 && seen3.brands }));
  m = mem(7); ok(m.sellerHits === 2, 'seller_known KHÔNG cộng thêm hits (không có phán quyết AI mới)');
  clockOff += 10 * 60e3; calls = []; BD.recordsFor = i => (i.url === G1 ? [rec(P(12), 7)] : []); await ixm.scanAll('manual', { sourceUrl: G1, force: true }); m = mem(7);
  ok(mainCalls() >= 1 && m.sellerHits === 2 && m.sellerIds.length === 2, 'force (Quét lại từ đầu) bài 2 → AI vẫn chấm (không bị cổng) · bài đã đếm KHÔNG đếm lại (sellerHits giữ 2) ' + JSON.stringify({ calls: mainCalls(), s: m.sellerHits })); }
/* (2) có bài thành lead → không bao giờ seller_known */
{ fresh(); clockOff += 10 * 60e3; route.main = SELLER; await scanManual([rec(P(21), 8)]); clockOff += 10 * 60e3;
  route.main = () => good(V2()); await scanManual([rec(P(22), 8)]); let m = mem(8);
  ok(m && m.sellerHits === 1 && m.buyerHits === 1 && Array.isArray(m.leadIds) && m.leadIds.length === 1 && m.brands && m.brands.b1 && m.brands.b1.lastLeadId === m.leadIds[0] && store('leads/').length === 1, 'bài thành lead → buyerHits 1 · leadIds [lead mới] · brands.b1.lastLeadId ' + JSON.stringify(m && { s: m.sellerHits, b: m.buyerHits, ids: m.leadIds, br: m.brands }));
  clockOff += 10 * 60e3; route.main = SELLER; await scanManual([rec(P(23), 8)]); clockOff += 10 * 60e3; await scanManual([rec(P(24), 8)]); m = mem(8);
  ok(mainCalls() === 1 && m.sellerHits === 3 && m.buyerHits === 1 && !store('scanned_posts/').some(p => p.decision === 'seller_known'), 'sellerHits 3 nhưng buyerHits 1 → bài 4 VẪN gọi AI (không seller_known) — fail-closed'); }
/* (3) bộ nhớ quá 30 ngày → chấm lại; AI seller nữa → lại người bán quen */
{ fresh(); clockOff += 10 * 60e3; await F.db.collection('author_memory').doc(KEY(9)).set({ key: KEY(9), sellerHits: 2, sellerIds: [P(90), P(91)], lastRole: 'seller', lastSellerAt: Date.now() - 40 * 86400e3, updatedAt: Date.now() - 40 * 86400e3 });
  route.main = SELLER; await scanManual([rec(P(31), 9)]); let m = mem(9); const spA = store('scanned_posts/').find(p => p.post_url === PURL(P(31)));
  ok(mainCalls() === 1 && spA && spA.decision === 'seller' && m.sellerHits === 3 && Date.now() - m.lastSellerAt < 60e3, 'bộ nhớ cũ 40 ngày → AI chấm lại (không seller_known) · AI nói seller → sellerHits 3 + lastSellerAt mới');
  clockOff += 10 * 60e3; await scanManual([rec(P(32), 9)]); ok(mainCalls() === 0 && store('scanned_posts/').some(p => p.post_url === PURL(P(32)) && p.decision === 'seller_known'), 'bài kế → seller_known (bộ nhớ tươi lại)');
  /* super gỡ nhãn → chấm lại */
  await F.db.collection('author_memory').doc(KEY(9)).set({ sellerHits: 0, sellerIds: [], lastRole: '', lastSellerAt: 0, clearedAt: Date.now() }, { merge: true }); clockOff += 10 * 60e3; route.main = () => good(V2()); await scanManual([rec(P(33), 9)]);
  ok(mainCalls() === 1 && store('leads/').some(l => l.post_id === P(33)), 'super "Không phải người bán" (sellerHits 0) → bài kế được AI chấm → lead'); }
/* (4) khách cũ quay lại */
{ fresh(); clockOff += 10 * 60e3;
  await F.db.collection('leads').doc('L_old_1').set({ brand: 'b1', name: 'Người 5', assignee_uid: 'uAn', assignee: 'An Nguyễn', stage: 'closed', author_url: PROF(5) });
  await F.db.collection('author_memory').doc(KEY(5)).set({ key: KEY(5), name: 'Người 5', buyerHits: 1, brands: { b1: { lastStage: 'closed', lastStageAt: Date.now() - 5 * 86400e3, lastLeadId: 'L_old_1' }, b2: { lastStage: 'lost', lastStageAt: Date.now() - 2 * 86400e3, lastLeadId: 'L_old_2' } }, updatedAt: Date.now() });
  route.main = () => good(V2()); await scanManual([rec(P(41), 5)]); const l = store('leads/').find(x => x.post_id === P(41)); const s = lastScan(); const notes = [...F.store.entries()].filter(([k]) => k.startsWith('leads/' + (l && l.__id) + '/notes/')).map(([, v]) => v); const m = mem(5);
  ok(l && l.returning === true && l.returning_lead_id === 'L_old_1' && l.returning_stage === 'closed' && l.returning_at > 0 && l.returning_assignee_uid === 'uAn' && l.returning_assignee === 'An Nguyễn' && s.returning === 1, 'khách cũ (brands.b1.lastStage closed) → lead mới returning + lead cũ + người phụ trách cũ · scans.returning 1 ' + JSON.stringify(l && { r: l.returning, id: l.returning_lead_id, st: l.returning_stage, a: l.returning_assignee_uid }));
  ok(notes.length === 1 && /Khách cũ quay lại/.test(notes[0].text) && /đã chốt/.test(notes[0].text) && /An Nguyễn/.test(notes[0].text) && /L_old_1/.test(notes[0].text) && notes[0].by_uid === 'engine', 'ghi chú hệ thống 🔁 (giai đoạn cũ, người phụ trách, lead cũ) ' + JSON.stringify(notes[0] && notes[0].text));
  ok(m && m.brands.b1.lastStage === 'closed' && m.brands.b1.lastLeadId === l.__id && m.brands.b2.lastStage === 'lost' && m.buyerHits === 2 && m.leadIds.includes(l.__id), 'bộ nhớ: brands.b1.lastLeadId = lead mới (giữ lastStage closed, không đụng b2) · buyerHits 2 · leadIds');
  /* brand khác cùng người → không returning */
  await F.db.collection('sources').doc('src_b2').set({ name: 'Hải sản B2', url: G2, brand: 'b2', active: true, industry: 'Hải sản' }); clockOff += 10 * 60e3; calls = []; BD.recordsFor = i => (i.url === G2 ? [Object.assign(rec(P(42), 5), { url: G2 + 'posts/' + P(42) + '/', group_id: '2289400231607899' })] : []); await ixm.scanAll('manual', { sourceUrl: G2 });
  const l2 = store('leads/').find(x => x.post_id === P(42)); ok(l2 && !l2.returning && lastScan().returning === 0, 'cùng người, brand b2 (chỉ từng lost) → KHÔNG returning');
  /* lead cũ đã xoá → không returning */
  await F.db.collection('author_memory').doc(KEY(6)).set({ key: KEY(6), brands: { b1: { lastStage: 'booked', lastStageAt: Date.now() - 86400e3, lastLeadId: 'L_gone' } } }); clockOff += 10 * 60e3; await scanManual([rec(P(43), 6)]);
  const l3 = store('leads/').find(x => x.post_id === P(43)); ok(l3 && !l3.returning, 'lead cũ không còn (đã xoá) → không cờ returning (fail-closed)'); }
/* (5) sweeper #46 chấm lại điểm tạm → nuôi bộ nhớ */
{ fresh(); clockOff += 10 * 60e3; await F.db.collection('brands').doc('b1').set({ name: 'B1', ai: { nganh: 'Hải sản' } });
  await F.db.collection('leads').doc('L_tmp').set({ brand: 'b1', name: 'Người 12', author_url: PROF(12), post_id: P(120), post_url: PURL(P(120)), text: 'Bán tôm khô sỉ lẻ, ib', ai_scored: false, score: 50, temp: 'cold', stage: 'new', detected_at: Date.now() - 3600e3, source: 'Hải sản B1' });
  route.main = SELLER; await ixm.scanAll('scheduled'); const lt = F.store.get('leads/L_tmp'); const m = mem(12);
  ok(lt && lt.ai_scored === true && lt.dropped === true && lt.dropped_by === 'rescore_role' && m && m.sellerHits === 1 && m.sellerIds.includes(P(120)) && m.lastRole === 'seller', 'sweeper chấm lại lead điểm tạm → AI seller → lead loại (rescore_role) + author_memory sellerHits 1 ' + JSON.stringify({ d: lt && lt.dropped_by, s: m && m.sellerHits })); }

/* ---------- 6. stats.js ---------- */
OUT('-- stats.js stageMemG + statsOnLead');
{ const stm = await import(pathToFileURL(path.join(W, 'stats.js')).href);
  ok(stm.authorKeyG(PROF(3)) === KEY(3) && stm.authorKeyG('https://www.facebook.com/people/Nguyen-A/100012345678901/') === 'id:100012345678901' && stm.authorKeyG('https://www.facebook.com/nguyen.van.a?mibextid=x') === 'u:nguyen.van.a' && stm.authorKeyG('', '100055555555555') === 'id:100055555555555' && stm.authorKeyG('https://www.facebook.com/groups/123/') === '' && stm.authorKeyG('https://www.facebook.com/profile.php?id=pfbid0abc') === '' && stm.authorKeyG('', 'pfbid0abc') === '', 'authorKeyG: profile.php?id · /people/ · username · author_uid số · groups/pfbid → rỗng');
  const b0 = { stage: 'new', author_url: PROF(3) };
  ok(stm.stageMemG(b0, { stage: 'booked', author_url: PROF(3) }).stage === 'booked' && stm.stageMemG({ stage: 'booked', author_url: PROF(3) }, { stage: 'closed', author_url: PROF(3) }).stage === 'closed' && stm.stageMemG(null, { stage: 'responded', author_url: PROF(3) }).stage === 'responded' && stm.stageMemG(b0, { stage: 'contacted', author_url: PROF(3) }) === null && stm.stageMemG({ stage: 'closed', author_url: PROF(3) }, { stage: 'closed', author_url: PROF(3), deal_value: 5 }) === null && stm.stageMemG(b0, { stage: 'closed', author_url: '', author_uid: '' }) === null && stm.stageMemG(b0, { stage: 'closed', author_uid: '1234' }) === null && stm.stageMemG(b0, { stage: 'closed', author_uid: '100099' }).key === 'id:100099', 'stageMemG: booked/closed/responded (kể cả tạo mới) · contacted/không đổi/không khoá/uid <5 số → null · uid ≥5 số → id:');
  const F6 = stub.makeDb(); globalThis.__slB = { db: F6.db }; globalThis.__sl48 = { db: F6.db };
  const ev = (id, b, a) => ({ params: { id }, data: { before: { exists: !!b, data: () => b }, after: { exists: !!a, id, data: () => a } } });
  await stm.statsOnLead(ev('L_x1', { brand: 'b1', stage: 'new', temp: 'hot', score: 85, name: 'Khách 3', author_url: PROF(3), detected_at: Date.now() }, { brand: 'b1', stage: 'booked', stage_at: Date.now(), temp: 'hot', score: 85, name: 'Khách 3', author_url: PROF(3), detected_at: Date.now() }));
  const d6 = F6.store.get('author_memory/' + KEY(3));
  ok(d6 && d6.key === KEY(3) && d6.brands && d6.brands.b1 && d6.brands.b1.lastStage === 'booked' && d6.brands.b1.lastLeadId === 'L_x1' && d6.brands.b1.lastStageAt > 0 && d6.name === 'Khách 3' && d6.expireAt, 'statsOnLead: new → booked → author_memory.brands.b1 {lastStage booked, lastLeadId L_x1} ' + JSON.stringify(d6 && d6.brands));
  await stm.statsOnLead(ev('L_x1', { brand: 'b1', stage: 'booked', temp: 'hot', score: 85, author_url: PROF(3) }, { brand: 'b1', stage: 'closed', stage_at: Date.now(), closed_at: Date.now(), temp: 'hot', score: 85, author_url: PROF(3) }));
  ok(F6.store.get('author_memory/' + KEY(3)).brands.b1.lastStage === 'closed' && (F6.store.get('daily_stats/b1__' + stm.vnDay(Date.now())) || {}).closed === 1, 'booked → closed: lastStage closed (bộ đếm daily_stats vẫn cộng closed như cũ)');
  await stm.statsOnLead(ev('L_x2', { brand: 'b1', stage: 'new', temp: 'hot', score: 85 }, { brand: 'b1', stage: 'booked', stage_at: Date.now(), temp: 'hot', score: 85 }));
  ok(![...F6.store.keys()].some(k => k.startsWith('author_memory/') && k !== 'author_memory/' + KEY(3)), 'lead không có khoá người viết → không ghi bộ nhớ'); }

/* ---------- 7. push.js ---------- */
OUT('-- push.js returningGateG + pushOnLead');
{ const pum = await import(pathToFileURL(path.join(W, 'push.js')).href); const rg = pum.returningGateG;
  ok(rg(null, { returning: true, returning_lead_id: 'L1', brand_hint: 'b1', temp: 'hot' }) === 'returning' && rg({ returning: true }, { returning: true, returning_lead_id: 'L1', brand: 'b1' }) === '' && rg(null, { returning: true, returning_lead_id: 'L1' }) === '' && rg(null, { returning: true, returning_lead_id: 'L1', brand: 'b1', dropped: true }) === '' && rg(null, { returning: false, brand: 'b1' }) === '' && rg({ returning: false, brand: 'b1' }, { returning: true, returning_lead_id: 'L1', brand: 'b1' }) === 'returning', 'returningGateG: cờ mới + có brand → returning · đã có cờ / thiếu brand / dropped / không cờ → rỗng');
  const F7 = stub.makeDb(); globalThis.__slB = { db: F7.db }; globalThis.__sl48 = { db: F7.db }; const PL = stub.pushLog; PL.length = 0;
  await F7.db.collection('users').doc('uAn').set({ active: true, fcmTokens: ['tok-an'], role: 'sales', brand: 'b1' }); await F7.db.collection('users').doc('uAdm').set({ active: true, fcmTokens: ['tok-adm'], role: 'admin', brand: 'b1' });
  const ev = (id, b, a) => ({ params: { id }, data: { before: { exists: !!b, data: () => b }, after: { exists: !!a, data: () => a } } });
  const A1 = { returning: true, returning_lead_id: 'L_old_1', returning_stage: 'closed', returning_assignee_uid: 'uAn', returning_assignee: 'An Nguyễn', brand_hint: 'b1', temp: 'hot', score: 90, name: 'Người 5', need: 'mua mực khô', stage: 'new' };
  await pum.pushOnLead(ev('L_new', null, A1)); const p1 = PL[PL.length - 1];
  ok(PL.length === 1 && p1 && p1.tokens.length === 1 && p1.tokens[0] === 'tok-an' && /Khách cũ quay lại/.test(p1.data.title) && /90đ/.test(p1.data.title) && /đã chốt/.test(p1.data.body) && /An Nguyễn/.test(p1.data.body) && p1.data.tag === 'ret-L_new' && p1.data.require === '1', 'lead mới returning → 1 push tới người phụ trách cũ (uAn), tiêu đề Khách cũ quay lại, KHÔNG push "Lead nóng mới" cùng lần ghi ' + JSON.stringify(p1 && { t: p1.tokens, title: p1.data.title, tag: p1.data.tag }));
  await pum.pushOnLead(ev('L_new', A1, Object.assign({}, A1, { brand: 'b1' }))); ok(PL.length === 1, 'bước 2 gán brand (before đã có cờ) → không push lại (kể cả hot: brandOf(before) có brand_hint)');
  await pum.pushOnLead(ev('L_new2', null, Object.assign({}, A1, { returning_assignee_uid: '', returning_assignee: '' }))); const p2 = PL[PL.length - 1];
  ok(PL.length === 2 && p2.tokens.length === 1 && p2.tokens[0] === 'tok-adm', 'không có người phụ trách cũ → admin brand (brandAdmins)');
  await pum.pushOnLead(ev('L_new3', null, Object.assign({}, A1, { returning: false, returning_lead_id: '' }))); const p3 = PL[PL.length - 1];
  ok(PL.length === 3 && /Lead nóng mới/.test(p3.data.title), 'không cờ returning → nhánh hot cũ (hotGateC) vẫn chạy'); }

/* ---------- 8. CF clearAuthorMemory ---------- */
OUT('-- authmemcf.js clearAuthorMemory');
{ const F8 = stub.makeDb(); globalThis.__slB = { db: F8.db, verify: async t => ({ uid: t === 'tok-super' ? 'uSuper' : 'uSales', email: t + '@x' }) }; globalThis.__sl48 = { db: F8.db };
  process.env.SUPER_EMAIL = 'super@z'; const cfm = await import(pathToFileURL(path.join(W, 'authmemcf.js')).href);
  await F8.db.collection('users').doc('uSuper').set({ role: 'superadmin', active: true }); await F8.db.collection('users').doc('uSales').set({ role: 'sales', active: true, brand: 'b1' });
  await F8.db.collection('author_memory').doc(KEY(7)).set({ key: KEY(7), sellerHits: 2, sellerIds: [P(11), P(12)], lastRole: 'seller', lastSellerAt: Date.now(), buyerHits: 0, name: 'Người 7' });
  const req = (tok, body) => ({ get: h => (h === 'Authorization' && tok ? 'Bearer ' + tok : ''), body, query: {} }); const res = () => { const r = { code: 200 }; r.status = c => { r.code = c; return r; }; r.json = o => { r.body = o; return r; }; return r; };
  let r = res(); await cfm.clearAuthorMemory(req('', { key: KEY(7) }), r); ok(r.code === 401, 'không token → 401');
  r = res(); await cfm.clearAuthorMemory(req('tok-sales', { key: KEY(7) }), r); ok(r.code === 403, 'sales → 403 (chỉ super)');
  r = res(); await cfm.clearAuthorMemory(req('tok-super', { key: 'n:nguyen van a' }), r); ok(r.code === 400, 'khoá theo tên → 400 (không nhận)');
  r = res(); await cfm.clearAuthorMemory(req('tok-super', { key: KEY(7), post_url: PURL(P(13)) }), r); const d = F8.store.get('author_memory/' + KEY(7)); const fb = [...F8.store.entries()].filter(([k]) => k.startsWith('ai_feedback/')).map(([, v]) => v);
  ok(r.code === 200 && r.body.ok && r.body.action === 'clear' && d.sellerHits === 0 && Array.isArray(d.sellerIds) && d.sellerIds.length === 0 && d.lastRole === '' && d.lastSellerAt === 0 && d.clearedBy === 'tok-super@x' && d.name === 'Người 7' && fb.length === 1 && fb[0].kind === 'not_seller' && fb[0].key === KEY(7) && fb[0].post_url === PURL(P(13)), 'super "Không phải người bán" → sellerHits 0/sellerIds []/lastRole rỗng (giữ tên) + ai_feedback not_seller ' + JSON.stringify({ s: d.sellerHits, fb: fb.length }));
  r = res(); await cfm.clearAuthorMemory(req('tok-super', { author_url: PROF(8), action: 'seller', note: 'shop cá' }), r); const d8 = F8.store.get('author_memory/' + KEY(8));
  ok(r.code === 200 && r.body.key === KEY(8) && r.body.action === 'seller' && d8.sellerHits === 2 && d8.buyerHits === 0 && d8.lastRole === 'seller' && Date.now() - d8.lastSellerAt < 60e3 && d8.markedBy === 'tok-super@x' && [...F8.store.keys()].filter(k => k.startsWith('ai_feedback/')).length === 2, 'super "Đánh dấu người bán" theo author_url → sellerHits 2 (bỏ trước AI 30 ngày) + ai_feedback mark_seller');
  ok(cfm.authorKeyOfG('https://www.facebook.com/people/Ten/100011112222333/') === 'id:100011112222333' && cfm.authorKeyOfG('', '100011112222444') === 'id:100011112222444' && cfm.authorKeyOfG('https://www.facebook.com/groups/1/') === '', 'authorKeyOfG cùng công thức scanner'); }

OUT(`\n${pass}/${pass + fail} PASS` + (fail ? ` · ${fail} FAIL` : ''));
process.exit(fail ? 1 : 0);
