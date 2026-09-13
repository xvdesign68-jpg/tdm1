/* Harness LỆNH F (13/09/2026) — Đợt 2.4 PA-5 "SĐT gọi được ngay" (gom SĐT/bình luận cùng tác giả + CF zaloCheckLead).
   Dựng mã đang chạy = harness E export (mã sau #49) + patch E = MÃ SAU E → áp patch F + contactcf.js → chạy TRỌN scanAll trên Firestore + BrightData + LLM giả (bài + bình luận).
   0. patch F: PATCH OK 9 mốc / idempotent / --check / fail-closed NGUYÊN TỬ (1 mốc lệch → không ghi) / thiếu LENH E → dừng
   1. quét tay (không sow): chủ bài tự bình luận có SĐT → lead bài nhận phone (contact_source 'comment') + text_extra; người lạ có SĐT dưới bài → KHÔNG gán vào bài (fail-closed), thành comment-lead riêng với SĐT của họ
   2. người X bình luận 2 lần → comment-lead của X mang text_extra (bình luận kia) + SĐT từ bình luận kia
   3. chỉ người lạ bình luận (không self) → bài không phone, không text_extra · ẩn danh không gom
   4. đường gieo/gặt (theo lịch): bài thành lead ở lượt trước → bình luận chủ bài gặt lượt sau → lead cập nhật phone/text_extra (nóng → kiểm Zalo; lạnh → zalo_defer) · gặt lại không nhân đôi
   5. CF zaloCheckLead: 401/403/404 · super đặt SĐT + kiểm Zalo · sales cùng brand force · số bàn → landline · SĐT sai → 400
   LF_EXPORT_DIR=<dir> → xuất fake ~ (mã SAU E, CHƯA patch F, có lib/zaloCheck.js stub) cho dry-run .sh rồi thoát. Chạy: node docs/harness-lenhf-2026-09-13.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { pathToFileURL, fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HE = path.join(HERE, 'harness-lenhe-2026-09-13.mjs'), PE = path.join(HERE, 'lenh-2026-09-13-e-patch.cjs'), PF = path.join(HERE, 'lenh-2026-09-13-f-patch.cjs'), CFJS = path.join(HERE, 'lenh-2026-09-13-f-contactcf.js'), AFTER = path.join(HERE, 'lenh-2026-09-13-f-after.mjs');
const OUT = console.log.bind(console); let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; OUT('  ✓', m); } else { fail++; OUT('  ✗', m); } };
const run = (cwd, args, env) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
const ZSTUB = "/* stub lib/zaloCheck.js (harness/dry-run): thật ở ~/firebase-s13/functions/lib */\nexport async function checkZalo(p, o) { const f = globalThis.__sl48 && globalThis.__sl48.checkZalo; return f ? f(p, o) : { registered: null, cached: false, source: 'stub' }; }\nexport function normalizePhoneVN(raw) { let d = String(raw || '').replace(/[^\\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); if (d.startsWith('84')) d = d.slice(2); else if (d.startsWith('0')) d = d.slice(1); else return ''; return /^[35789]\\d{8}$/.test(d) ? '+84' + d : ''; }\nexport async function enrichPhoneFromText(t, o) { const f = globalThis.__sl48 && globalThis.__sl48.enrichPhoneFromText; return f ? f(t, o) : { phone: '', phone_has_zalo: null, email: '' }; }\n";
/* mã đang chạy SAU E */
function prepRunning(W) {
  const H = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-h-')); const e0 = run(HERE, [HE], { LE_EXPORT_DIR: H }); if (e0.code !== 0) throw new Error('không export được mã sau #49: ' + e0.out.slice(0, 300));
  const F = path.join(H, 'firebase-s13', 'functions'); const rE = run(F, [PE, 'lib/config.js', 'lib/scorer.js', 'index.js']); if (rE.code !== 0 || !/PATCH OK 3 file/.test(rE.out)) throw new Error('không áp được patch E: ' + rE.out.slice(0, 300));
  fs.cpSync(F, W, { recursive: true }); fs.rmSync(H, { recursive: true, force: true }); if (!fs.existsSync(path.join(W, 'lib', 'zaloCheck.js'))) fs.writeFileSync(path.join(W, 'lib', 'zaloCheck.js'), ZSTUB); return W;
}
if (process.env.LF_EXPORT_DIR) { const H = process.env.LF_EXPORT_DIR; const F = path.join(H, 'firebase-s13', 'functions'); fs.mkdirSync(F, { recursive: true }); prepRunning(F);
  fs.writeFileSync(path.join(F, '.env'), 'LLM_API_KEY=test-key\nLLM_BASE_URL=http://127.0.0.1:9/v1\nLLM_MODEL=gpt-5.6-sol\nLLM_PREFILTER_MODEL=gpt-5-nano\nBRIGHTDATA_TOKEN=test-bd\nBRIGHTDATA_DATASET_ID=gd_x\nPOLL_MINUTES=3\n');
  fs.writeFileSync(path.join(H, 'firebase-s13', 'firebase.json'), '{}'); console.log('exported fake HOME (mã sau E, CHƯA patch F) →', H); process.exit(0); }

/* ---------- 0. patch ---------- */
OUT('-- patch F');
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-')); prepRunning(W); fs.copyFileSync(CFJS, path.join(W, 'contactcf.js'));
const before = fs.readFileSync(path.join(W, 'index.js'), 'utf8');
const r1 = run(W, [PF, 'index.js']); ok(r1.code === 0 && /PATCH OK index.js/.test(r1.out) && /9 mốc/.test(r1.out), 'patch F áp trên mã sau E: PATCH OK index.js (9 mốc)' + (r1.code ? ' — ' + r1.out.slice(0, 400) : ''));
const r2 = run(W, [PF, 'index.js']); ok(r2.code === 0 && /idempotent/.test(r2.out), 'chạy lần 2 → idempotent, bỏ qua');
for (const f of ['index.js', 'contactcf.js']) { const r = run(W, ['--check', f]); ok(r.code === 0, 'node --check ' + f + (r.code ? ' — ' + r.out.slice(0, 200) : '')); }
{ const r = run(HERE, ['--check', AFTER]); ok(r.code === 0, 'node --check lenh-2026-09-13-f-after.mjs'); }
{ const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-t-')); const bad = before.replace("phone: _zc.phone, phone_has_zalo: _zc.phone_has_zalo, email: _zc.email || '',", "phone: _zc.phone, /*x*/ phone_has_zalo: _zc.phone_has_zalo, email: _zc.email || '',"); fs.writeFileSync(path.join(T, 'index.js'), bad);
  const r = run(T, [PF, 'index.js']); ok(r.code === 1 && /mốc F7/.test(r.out) && fs.readFileSync(path.join(T, 'index.js'), 'utf8') === bad, 'fail-closed NGUYÊN TỬ: mốc F7 lệch → exit 1, không ghi'); }
{ const T = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-t2-')); fs.writeFileSync(path.join(T, 'index.js'), before.replace(/LENH E\b/g, 'LENH Ex')); const r = run(T, [PF, 'index.js']); ok(r.code === 1 && /thiếu marker/.test(r.out), 'thiếu marker LENH E → DỪNG'); }

/* ---------- 1–4. scanAll trọn vòng ---------- */
OUT('-- index.js scanAll (bình luận cùng tác giả → SĐT/text_extra · fail-closed · đường gieo/gặt · scans)');
const stub = await import(pathToFileURL(path.join(W, 'stubB.mjs')).href); const mt = await import(pathToFileURL(path.join(W, 'lib/multitouch.js')).href);
const { CFG } = await import(pathToFileURL(path.join(W, 'lib/config.js')).href); const sc = await import(pathToFileURL(path.join(W, 'lib/scorer.js')).href); const cfg = sc.scoreLead.cfg46; cfg.waits = [5, 5, 5]; cfg.timeoutMs = 300; cfg.budgetMs = 100000;
Object.assign(CFG, { LLM_API_KEY: 'test-key', LLM_MODEL: 'gpt-5.6-sol', LLM_PREFILTER_MODEL: 'gpt-5-nano', SCAN_COMMENTS: true, BD_SOW_MODE: true, SCORE_CONCURRENCY: 1, PREFILTER_CONCURRENCY: 1, MIN_KEEP_SCORE: 40, HOT_THRESHOLD: 80, LOG_SCANNED_POSTS: true, SCANNED_TTL_DAYS: 3, POSTS_PER_GROUP: 20, PROBE_POSTS: 5, FULLSWEEP_HOURS: 2, BD_PROGRESS_MIN_AGE_S: 120, SCAN_INTERVAL_MIN_FLOOR: 5, HOUSEKEEPING_MIN: 5, ZALO_CHECK_COLD: false, SCAN_SOURCE_INTERVAL_MIN: 10, BRIGHTDATA_TOKEN: 'bd-test', BRIGHTDATA_DATASET_ID: 'gd_posts', BRIGHTDATA_COMMENTS_DATASET_ID: 'gd_cmt', COMMENTS_PER_POST: 5, SCANS_TTL_DAYS: 90, SEEN_TTL_DAYS: 180, TOO_OLD_DAYS: 45, PREFILTERED_TTL_DAYS: 14, PROMPT_BRAND_V2: true, SCORE_V2: 'shadow' });
const realNow = Date.now; let clockOff = 0; Date.now = () => realNow() + clockOff;
const LOGS = []; for (const k of ['log', 'warn', 'error']) { const o = console[k].bind(console); console[k] = (...a) => { LOGS.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); if (process.env.LF_VERBOSE) o(...a); }; }
const ixm = await import(pathToFileURL(path.join(W, 'index.js')).href);
const good = (obj) => ({ status: 200, body: { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, model: 'gpt-test' } });
const mk = r => ({ ok: r.status < 400, status: r.status, headers: { get: () => null }, text: async () => typeof r.body === 'string' ? r.body : JSON.stringify(r.body), json: async () => r.body });
const V2 = (o) => Object.assign({ is_real_lead: true, hotness: 85, criteria: { intent: 3, fit: 3, timing: 3, industry: 3, area: 3, quality: 3 }, confidence: 0.9, why: ['cần mua'], intent: 'cần mua gấp', need: 'mua mực khô', industry: 'Hải sản', service: 'Mực khô', reply: 'Chào anh.', role: 'buyer', role_reason: 'hỏi mua' }, o || {});
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
const G1 = 'https://www.facebook.com/groups/1189400231607822/'; const P = n => '10000000' + n; const PURL = id => G1 + 'posts/' + id + '/';
const PROF = id => 'https://www.facebook.com/profile.php?id=1000' + String(id).padStart(12, '0');
const rec = (id, extra) => Object.assign({ post_id: id, url: PURL(id), content: 'Cần mua ' + id + ' kg mực khô rim me, ai có báo giá', group_id: '1189400231607822', num_comments: 0, profile_id: '1000' + String(id).padStart(12, '0'), user_name: 'Chủ bài ' + id, date_posted: new Date(Date.now() - 60e3).toISOString() }, extra || {});
function hash(s) { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
const cmt = (post_url, txt, extra) => Object.assign({ comment_id: 'c_' + Math.abs(hash(txt)), post_url, comment_text: txt, user_name: 'Khách ' + txt.slice(0, 4), date_created: new Date(Date.now() - 30e3).toISOString(), commentator_profile_url: 'https://www.facebook.com/profile.php?id=100099' + Math.abs(hash(txt)) % 1000 }, extra || {});
const PH_RE = /(?:\+?84|0)(?:[\s.\-]?\d){9}(?!\d)/g; const normP = raw => { let d = String(raw || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); if (d.startsWith('84')) d = d.slice(2); else if (d.startsWith('0')) d = d.slice(1); else return ''; return /^[35789]\d{8}$/.test(d) ? '+84' + d : ''; };
let ZC = [];
const enrich = async (text, o) => { const m = String(text || '').match(PH_RE) || []; let phone = ''; for (const x of m) { const e = normP(x); if (e) { phone = e; break; } } if (!phone) return { phone: '', phone_has_zalo: null, email: '' }; if (!(o && o.doCheck)) return { phone, phone_has_zalo: null, email: '' }; ZC.push(phone); return { phone, phone_has_zalo: true, email: '' }; };
let F;
function fresh(opts) { opts = opts || {}; F = stub.makeDb(); LOGS.length = 0; calls = []; ZC = []; BD.triggers = []; BD.snaps.clear(); BD.readyDelay = 0; BD.recordsFor = () => []; BD.cmtRecordsFor = () => [];
  globalThis.__slB = { db: F.db }; globalThis.__sl48 = { db: F.db, isExcluded: () => false, enrichPhoneFromText: enrich, checkZalo: async (p) => { ZC.push(p); return { registered: true, source: 'api' }; }, brandAiOf: () => ({ nganh: 'Hải sản khô', dichvu: 'Mực khô', khach: 'quán nhậu', giong: 'thân thiện' }), tryMergeTouch: (db, lead, oo) => mt.tryMergeTouch(db, lead, oo) };
  F.db.collection('sources').doc('src_b1').set({ name: 'Hải sản B1', url: G1, brand: 'b1', active: true, industry: 'Hải sản' });
  F.db.collection('config').doc('app').set({ aiMode: 'saver', scanComments: true }); route = { pre: () => good({ maybe: true }), main: () => good(V2()) }; return F; }
const store = (pre) => [...F.store.entries()].filter(([k]) => k.startsWith(pre)).map(([k, v]) => Object.assign({ __id: k.slice(pre.length) }, v));
const lastScan = () => store('scans/').filter(s => s.status === 'done').slice(-1)[0] || {};
const leadOf = (f) => store('leads/').find(f);

/* (1) quét tay: chủ bài tự bình luận có SĐT + người lạ có SĐT */
{ fresh(); clockOff = 0;
  BD.recordsFor = i => (i.url === G1 ? [rec(P(1), { num_comments: 2 })] : []);
  BD.cmtRecordsFor = i => (String(i.url || '').includes(P(1)) ? [cmt(PURL(P(1)), 'Ai cần ib mình, sđt 0912 345 678 nhé', { user_name: 'Chủ bài ' + P(1), commentator_profile_url: PROF(P(1)) }), cmt(PURL(P(1)), 'Mình cũng cần mua, gọi 0987654321', { user_name: 'Khách Lạ' })] : []);
  await ixm.scanAll('manual', { sourceUrl: G1 });
  const lp = leadOf(l => l.kind !== 'comment'), lc = leadOf(l => l.kind === 'comment'); const s = lastScan();
  ok(lp && lp.phone === '+84912345678' && lp.contact_source === 'comment' && /0912 345 678/.test(String(lp.text_extra || '')) && lp.phone_has_zalo === true, 'quét tay: lead BÀI nhận SĐT từ bình luận CHỦ BÀI (contact_source comment, text_extra, nóng → kiểm Zalo) ' + JSON.stringify({ phone: lp && lp.phone, src: lp && lp.contact_source, x: lp && lp.text_extra }));
  ok(lc && lc.phone === '+84987654321' && lc.contact_source === 'post' && !lc.text_extra, 'người lạ có SĐT → KHÔNG gán vào bài; thành comment-lead riêng với SĐT của họ (contact_source post)');
  ok(s.cmtExtra === 1 && s.phoneFromCmt === 1 && (store('scanned_posts/').some(p => p.decision === 'self_comment')), 'scans.cmtExtra 1 · phoneFromCmt 1 · bình luận chủ bài vẫn ghi scanned_posts self_comment (không thành lead)' + ' ' + JSON.stringify({ x: s.cmtExtra, p: s.phoneFromCmt })); }
/* (2) người X bình luận 2 lần → comment-lead mang bình luận kia + SĐT */
{ fresh(); clockOff += 10 * 60e3;
  BD.recordsFor = i => (i.url === G1 ? [rec(P(2), { num_comments: 2 })] : []);
  const X = { user_name: 'Nguyễn Văn X', commentator_profile_url: 'https://www.facebook.com/profile.php?id=100077777' };
  BD.cmtRecordsFor = i => (String(i.url || '').includes(P(2)) ? [cmt(PURL(P(2)), 'Mình cần mua 5 kg mực khô loại 1', X), cmt(PURL(P(2)), 'sđt mình 0905111222 gọi sau 18h', X)] : []);
  await ixm.scanAll('manual', { sourceUrl: G1 });
  const cls = store('leads/').filter(l => l.kind === 'comment'); const a = cls.find(l => /5 kg/.test(String(l.text || '')));
  ok(a && a.phone === '+84905111222' && a.contact_source === 'comment' && /0905111222/.test(String(a.text_extra || '')), 'X bình luận 2 lần: comment-lead "cần mua 5 kg" nhận SĐT từ bình luận kia của X (text_extra) ' + JSON.stringify({ n: cls.length, phone: a && a.phone, src: a && a.contact_source }));
  ok(cls.every(l => l.text_extra && !/5 kg.*5 kg/s.test(String(l.text_extra))) && lastScan().cmtExtra === 2, 'cả 2 bình luận của X có text_extra chéo nhau (không tự chứa) · scans.cmtExtra 2'); }
/* (3) chỉ người lạ / ẩn danh */
{ fresh(); clockOff += 10 * 60e3;
  BD.recordsFor = i => (i.url === G1 ? [rec(P(3), { num_comments: 3 })] : []);
  BD.cmtRecordsFor = i => (String(i.url || '').includes(P(3)) ? [cmt(PURL(P(3)), 'Inbox mình 0911222333', { user_name: 'Người tham gia ẩn danh', commentator_profile_url: '' }), cmt(PURL(P(3)), 'Mình cũng hỏi giá 0911999888', { user_name: 'Người tham gia ẩn danh', commentator_profile_url: '' }), cmt(PURL(P(3)), 'Giá bao nhiêu bạn', { user_name: 'Khách Y' })] : []);
  await ixm.scanAll('manual', { sourceUrl: G1 });
  const lp = leadOf(l => l.kind !== 'comment'); const anon = store('leads/').filter(l => l.kind === 'comment' && /ẩn danh/i.test(String(l.name || '')));
  ok(lp && !lp.phone && !lp.text_extra && lp.contact_source === '', 'không có bình luận chủ bài → bài KHÔNG nhận SĐT/text_extra của người lạ (fail-closed)');
  ok(anon.length >= 1 && anon.every(l => !l.text_extra) && lastScan().cmtExtra === 0, '2 bình luận "ẩn danh" không link hồ sơ → KHÔNG gom với nhau (text_extra rỗng, cmtExtra 0)'); }
/* (4) đường gieo/gặt theo lịch: lead có trước, bình luận chủ bài đến sau */
{ fresh(); clockOff += 10 * 60e3;
  BD.recordsFor = i => (i.url === G1 ? [rec(P(4), { num_comments: 1 })] : []);
  BD.cmtRecordsFor = i => (String(i.url || '').includes(P(4)) ? [cmt(PURL(P(4)), 'Ai quan tâm gọi mình 0933 444 555', { user_name: 'Chủ bài ' + P(4), commentator_profile_url: PROF(P(4)) })] : []);
  await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled');
  let lp = leadOf(l => l.kind !== 'comment'); const before4 = lp && lp.phone;
  clockOff += 130e3; await ixm.scanAll('scheduled'); lp = leadOf(l => l.kind !== 'comment'); const s4 = lastScan();
  ok(lp && before4 === '' && lp.phone === '+84933444555' && lp.contact_source === 'comment' && /0933 444 555/.test(String(lp.text_extra || '')) && lp.phone_has_zalo === true && lp.zalo_defer === false && s4.phoneFromCmt === 1, 'gieo/gặt: lead bài tạo ở lượt 2 (chưa SĐT) → bình luận chủ bài gặt ở lượt 3 → lead cập nhật SĐT + text_extra + kiểm Zalo (nóng) · scans.phoneFromCmt 1 ' + JSON.stringify({ b: before4, phone: lp && lp.phone, src: lp && lp.contact_source, z: lp && lp.phone_has_zalo }));
  const tx = lp && lp.text_extra; clockOff += 130e3; BD.cmtRecordsFor = () => []; await ixm.scanAll('scheduled'); lp = leadOf(l => l.kind !== 'comment');
  ok(lp && lp.text_extra === tx, 'lượt sau không có bình luận mới → text_extra giữ nguyên (không nhân đôi)');
  ok(store('scanned_posts/').filter(p => p.decision === 'self_comment').length === 1, 'bình luận chủ bài ghi scanned_posts self_comment 1 lần'); }
/* (4b) lead LẠNH: SĐT từ bình luận nhưng KHÔNG kiểm Zalo (zalo_defer) */
{ fresh(); clockOff += 10 * 60e3; route.main = () => good(V2({ hotness: 50, criteria: { intent: 1, fit: 2, timing: 1, industry: 2, area: 2, quality: 2 } }));
  BD.recordsFor = i => (i.url === G1 ? [rec(P(5), { num_comments: 1 })] : []);
  BD.cmtRecordsFor = i => (String(i.url || '').includes(P(5)) ? [cmt(PURL(P(5)), 'Liên hệ 0977 888 999', { user_name: 'Chủ bài ' + P(5), commentator_profile_url: PROF(P(5)) })] : []);
  await ixm.scanAll('scheduled'); clockOff += 130e3; await ixm.scanAll('scheduled'); clockOff += 130e3; ZC = []; await ixm.scanAll('scheduled');
  const lp = leadOf(l => l.kind !== 'comment');
  ok(lp && lp.temp === 'cold' && lp.phone === '+84977888999' && lp.phone_has_zalo === null && lp.zalo_defer === true && ZC.length === 0, 'lead LẠNH nhận SĐT từ bình luận chủ bài nhưng hoãn kiểm Zalo (zalo_defer, không gọi eKYC) ' + JSON.stringify({ t: lp && lp.temp, z: lp && lp.phone_has_zalo, d: lp && lp.zalo_defer, zc: ZC.length })); }

/* ---------- 5. CF zaloCheckLead ---------- */
OUT('-- contactcf.js zaloCheckLead');
{ const F0 = stub.makeDb(); let zc = []; globalThis.__slB = { db: F0.db, verify: async t => ({ uid: t === 'tok-super' ? 'uSuper' : (t === 'tok-sales' ? 'uSales' : 'uOther'), email: t + '@x' }) }; globalThis.__sl48 = { db: F0.db, checkZalo: async (p) => { zc.push(p); return { registered: p.endsWith('1'), source: 'api', cached: false }; } };
  process.env.SUPER_EMAIL = 'super@z'; const cfm = await import(pathToFileURL(path.join(W, 'contactcf.js')).href);
  await F0.db.collection('users').doc('uSuper').set({ role: 'superadmin', active: true }); await F0.db.collection('users').doc('uSales').set({ role: 'sales', active: true, brand: 'b1' }); await F0.db.collection('users').doc('uOther').set({ role: 'sales', active: true, brand: 'b9' });
  await F0.db.collection('leads').doc('L1').set({ brand: 'b1', name: 'A', phone: '', phone_has_zalo: null, text: 'x' }); await F0.db.collection('leads').doc('L2').set({ brand: 'b1', name: 'B', phone: '+84905000001', phone_has_zalo: null, zalo_defer: true, temp: 'cold' });
  const req = (tok, body) => ({ get: h => (h === 'Authorization' && tok ? 'Bearer ' + tok : ''), body, query: {} }); const res = () => { const r = { code: 200 }; r.status = c => { r.code = c; return r; }; r.json = o => { r.body = o; return r; }; return r; };
  let r = res(); await cfm.zaloCheckLead(req('', { leadId: 'L1' }), r); ok(r.code === 401, 'không token → 401');
  r = res(); await cfm.zaloCheckLead(req('tok-other', { leadId: 'L1' }), r); ok(r.code === 403 && /brand khác/.test(r.body.message), 'sales brand khác → 403');
  r = res(); await cfm.zaloCheckLead(req('tok-super', { leadId: 'Lx' }), r); ok(r.code === 404, 'lead không có → 404');
  r = res(); await cfm.zaloCheckLead(req('tok-super', { leadId: 'L1', phone: '0912 345 671' }), r); const d1 = F0.store.get('leads/L1');
  ok(r.code === 200 && r.body.ok && r.body.phone === '+84912345671' && r.body.registered === true && r.body.changed === true && d1.phone === '+84912345671' && d1.phone_has_zalo === true && d1.contact_source === 'manual' && d1.phone_set_by === 'tok-super@x' && d1.zalo_defer === false && zc.length === 1, 'super "Dùng số này": lead ghi phone/contact_source manual/phone_set_by + kiểm Zalo ngay (registered true) ' + JSON.stringify({ b: r.body, d: { p: d1.phone, z: d1.phone_has_zalo, s: d1.contact_source } }));
  r = res(); await cfm.zaloCheckLead(req('tok-super', { leadId: 'L1', phone: '0912345671' }), r); ok(r.code === 200 && r.body.changed === false && r.body.source === 'lead' && zc.length === 1, 'cùng số → không đổi, không gọi eKYC lại (source lead)');
  r = res(); await cfm.zaloCheckLead(req('tok-sales', { leadId: 'L2' }), r); const d2 = F0.store.get('leads/L2');
  ok(r.code === 200 && r.body.registered === true && d2.phone_has_zalo === true && d2.zalo_defer === false && d2.zalo_checked_at > 0, 'sales cùng brand "Kiểm Zalo" lead lạnh bị hoãn → kiểm ngay, zalo_defer false');
  r = res(); await cfm.zaloCheckLead(req('tok-sales', { leadId: 'L2', force: true }), r); ok(r.code === 200 && zc.length === 3, 'force → gọi eKYC lại');
  r = res(); await cfm.zaloCheckLead(req('tok-super', { leadId: 'L1', phone: '028 3822 1234' }), r); const d3 = F0.store.get('leads/L1');
  ok(r.code === 200 && r.body.phone === '+842838221234' && r.body.mobile === false && r.body.source === 'landline' && r.body.registered === null && d3.phone === '+842838221234' && d3.phone_prev === '+84912345671' && d3.phone_has_zalo === null, 'số bàn 028… → nhận (E.164), không kiểm Zalo (landline), giữ phone_prev');
  r = res(); await cfm.zaloCheckLead(req('tok-super', { leadId: 'L1', phone: '12345' }), r); ok(r.code === 400 && r.body.error === 'bad_phone', 'SĐT sai → 400 bad_phone');
  r = res(); await cfm.zaloCheckLead(req('tok-super', { leadId: 'a/b' }), r); ok(r.code === 400, 'leadId có "/" → 400');
  ok(cfm.normPhoneF('+84 912-345-678') === '+84912345678' && cfm.normPhoneF('84912345678') === '+84912345678' && cfm.normPhoneF('0283822123') === '' && cfm.isMobileF('+842838221234') === false, 'normPhoneF/isMobileF: +84/84/0, số bàn 11 số, di động 10 số'); }

OUT(`\n${pass}/${pass + fail} PASS` + (fail ? ` · ${fail} FAIL` : ''));
process.exit(fail ? 1 : 0);
