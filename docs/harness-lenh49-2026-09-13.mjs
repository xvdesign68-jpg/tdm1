/* HARNESS LỆNH #49 (13/09/2026) — dựng MÃ ĐANG CHẠY (fixture B + patch B + push #46 + patch C + patch D) qua harness D (LD_EXPORT_DIR) → kiểm patch #49:
   PATCH OK 4 mốc / idempotent / fail-closed (thiếu marker #48 → không ghi; 1 mốc lệch → không ghi dù mốc khác khớp) / --check · import normalizeComment/normalizePost 7 ca
   · _l49_fix.mjs trên Firestore giả nghiêm (stubStrict: select thu hẹp data(), startAfter kiểm field orderBy): DRY 0 ghi → APPLY đúng lead/thread → APPLY lần 2 = 0.
   Chạy: node docs/harness-lenh49-2026-09-13.mjs */
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { pathToFileURL } from 'node:url';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const HD = path.join(HERE, 'harness-lenhd-2026-09-13.mjs'), PD = path.join(HERE, 'lenh-2026-09-13-d-patch.cjs'), P49 = path.join(HERE, 'lenh-2026-09-13-49-patch.cjs'), FIX = path.join(HERE, 'lenh-2026-09-13-49-fix.mjs');
const OUT = console.log.bind(console); let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; OUT('  ✓', m); } else { fail++; OUT('  ✗', m); } };
const run = (cwd, args, env) => { try { return { code: 0, out: execFileSync('node', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; } };
/* 0. mã đang chạy (sau D) */
const H = fs.mkdtempSync(path.join(os.tmpdir(), 'l49-')); const W = path.join(H, 'firebase-s13', 'functions');
const e0 = run(HERE, [HD], { LD_EXPORT_DIR: H }); if (e0.code !== 0) { console.error('không export được mã sau C: ' + e0.out.slice(0, 400)); process.exit(1); }
const rD = run(W, [PD, 'lib/config.js', 'lib/scraper.js', 'index.js']); if (rD.code !== 0 || !/PATCH OK 3 file/.test(rD.out)) { console.error('không áp được patch D: ' + rD.out.slice(0, 300)); process.exit(1); }
const SCR = path.join(W, 'lib', 'scraper.js'); const before = fs.readFileSync(SCR, 'utf8');
OUT('-- patch #49 trên mã sau D');
const r1 = run(W, [P49, 'lib/scraper.js']); ok(r1.code === 0 && /PATCH OK lib\/scraper\.js \(LENH #49\)/.test(r1.out) && /4 mốc/.test(r1.out), 'PATCH OK 4 mốc' + (r1.code ? ' — ' + r1.out.slice(0, 300) : ''));
const after = fs.readFileSync(SCR, 'utf8'); ok((after.match(/LENH #49/g) || []).length === 5 && /function fbUrl49\(/.test(after) && after !== before, 'marker LENH #49 ×5 + fbUrl49 có mặt');
const r2 = run(W, [P49, 'lib/scraper.js']); ok(r2.code === 0 && /idempotent/.test(r2.out) && fs.readFileSync(SCR, 'utf8') === after, 'chạy lại: idempotent, file không đổi');
ok(run(W, ['--check', 'lib/scraper.js']).code === 0, 'node --check lib/scraper.js sau patch');
{ const T = fs.mkdtempSync(path.join(os.tmpdir(), 'l49n-')); fs.mkdirSync(path.join(T, 'lib')); const f = path.join(T, 'lib', 'scraper.js');
  fs.writeFileSync(f, before.replace(/LENH #48/g, 'LENH X48')); const r = run(T, [P49, 'lib/scraper.js']); ok(r.code === 1 && /thiếu marker/.test(r.out) && fs.readFileSync(f, 'utf8') === before.replace(/LENH #48/g, 'LENH X48'), 'fail-closed: thiếu marker LENH #48 → exit 1, không ghi');
  const lech = before.replace("c.commentator_profile_url || '', c.user_id || c.commenter_id), /* LENH #48: dataset", "c.commentator_profile_url || '', c.user_id || c.commenter_id), /* LENH #48x: dataset"); ok(lech !== before, 'dựng được bản mốc M3 lệch');
  fs.writeFileSync(f, lech); const r3 = run(T, [P49, 'lib/scraper.js']); ok(r3.code === 1 && /mốc M3/.test(r3.out) && fs.readFileSync(f, 'utf8') === lech, 'fail-closed NGUYÊN TỬ: M3 lệch → exit 1, không ghi dù M1/M2/M4 khớp'); }
/* 1. import + normalize */
OUT('-- normalizeComment / normalizePost sau patch');
const m = await import(pathToFileURL(SCR).href);
const IMG = 'https://scontent-sin2-2.xx.fbcdn.net/v/t39.30808-1/618420709_320877762.jpg?stp=dst-jpg&_nc_cat=1&ccb=1-7&_nc_ohc=abc&id=999999999&_nc_zt=24';
const src = { name: 'S', url: 'https://www.facebook.com/groups/123456789012345/' }, P = 'https://www.facebook.com/groups/123456789012345/posts/456/';
const PF = 'pfbid0AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefghijklmnopqrstuvwxyzABCDEF';
const c1 = m.normalizeComment({ commentator_profile_url: IMG, user_id: PF, user_name: 'T', comment_text: 'ib' }, src, P);
ok(c1.user_url === 'https://www.facebook.com/profile.php?id=' + PF && c1.author_uid === '', 'ảnh + user_id pfbid → profile.php?id=<pfbid>, uid rỗng (không đọc &id= trong query CDN): ' + c1.user_url.slice(0, 60));
const c2 = m.normalizeComment({ commentator_profile_url: IMG, user_id: '224550447624797', user_name: 'A', comment_text: 'ib' }, src, P);
ok(c2.user_url === 'https://www.facebook.com/profile.php?id=224550447624797' && c2.author_uid === '224550447624797', 'ảnh + user_id số → profile.php?id=<uid> + author_uid');
const c3 = m.normalizeComment({ commentator_profile: 'https://www.facebook.com/groups/123456789012345/user/100012345678901/?__cft__[0]=x&__tn__=y', commentator_profile_url: IMG, user_id: PF, user_name: 'B', comment_text: 'ib' }, src, P);
ok(c3.user_url === 'https://www.facebook.com/groups/123456789012345/user/100012345678901' && c3.author_uid === '100012345678901', 'commentator_profile = link facebook thật (kèm tracking) thắng ảnh → cắt query + uid /user/<uid>/');
const c4 = m.normalizeComment({ commentator_profile_url: 'https://www.facebook.com/profile.php?id=100099887766554&__cft__[0]=z', user_id: PF, comment_text: 'ib' }, src, P);
ok(c4.user_url === 'https://www.facebook.com/profile.php?id=100099887766554' && c4.author_uid === '100099887766554', 'commentator_profile_url là link facebook thật → giữ (hành vi #48 không đổi)');
const c5 = m.normalizeComment({ commentator_profile_url: IMG, user_id: '', comment_text: 'ib' }, src, P);
ok(c5.user_url === '' && c5.author_uid === '', 'ảnh + không user_id → author_url rỗng (không phải link ảnh)');
const p1 = m.normalizePost({ url: P, post_id: '456', profile_id: '100012345678901', user_name: 'C', content: 'x' }, src);
ok(p1.user_url === 'https://www.facebook.com/profile.php?id=100012345678901' && p1.author_uid === '100012345678901', 'bài: profile_id → profile.php?id (như #48)');
const p2 = m.normalizePost({ url: P, post_id: '457', user_url: IMG, profile_id: '100012345678902', content: 'x' }, src);
ok(p2.user_url === 'https://www.facebook.com/profile.php?id=100012345678902' && p2.author_uid === '100012345678902', 'bài: user_url là ảnh → bỏ, rơi về profile_id');
/* 2. _l49_fix.mjs trên Firestore giả nghiêm */
OUT('-- _l49_fix.mjs (DRY → APPLY → APPLY lần 2)');
const strict = fs.readFileSync(path.join(W, 'stubB.mjs'), 'utf8')
  .replace("startAfter: d => query(col, filters, order, lim, sel, d),", "startAfter: d => { if (order && order[0] !== '__name__' && d && d.data && d.data()[order[0]] === undefined) throw new Error('Field \"' + order[0] + '\" is missing in the provided DocumentSnapshot.'); return query(col, filters, order, lim, sel, d); },")
  .replace("if (lim) docs = docs.slice(0, lim); const out = docs.map(({ id }) => snap(col, id));", "if (lim) docs = docs.slice(0, lim); const out = docs.map(({ id }) => { const s = snap(col, id); if (sel && sel.length) { const full = s.data() || {}; const part = {}; sel.forEach(f => { if (full[f] !== undefined) part[f] = full[f]; }); s.data = () => part; } return s; });");
ok(strict !== fs.readFileSync(path.join(W, 'stubB.mjs'), 'utf8'), 'stubStrict dựng được (select thu hẹp + startAfter kiểm)');
fs.writeFileSync(path.join(W, 'stubB.mjs'), strict);
const st = await import(pathToFileURL(path.join(W, 'stubB.mjs')).href); const { db, log } = st.makeDb(); globalThis.__slB = { db };
const since = Date.parse('2026-09-12T08:53:00Z') + 3600e3;
await db.collection('leads').doc('L1').set({ detected_at: since, brand: 'b1', name: 'Hà', kind: 'comment', comment_id: 'c1', author_url: IMG.split('?')[0], author_uid: '' });
await db.collection('leads').doc('L2').set({ detected_at: since + 1, brand: 'b1', name: 'Anon', kind: 'comment', comment_id: 'c2', author_url: IMG.split('?')[0], author_uid: '224550447624797' });
await db.collection('leads').doc('L3').set({ detected_at: since + 2, brand: 'b1', name: 'OK', kind: 'post', author_url: 'https://www.facebook.com/profile.php?id=100012345678901', author_uid: '100012345678901' });
await db.collection('leads').doc('L4').set({ detected_at: since - 7200e3, brand: 'b1', name: 'Cũ', kind: 'comment', comment_id: 'c4', author_url: IMG.split('?')[0] }); // trước #48 → ngoài phạm vi
for (let i = 0; i < 320; i++) await db.collection('leads').doc('F' + String(i).padStart(3, '0')).set({ detected_at: since + 10 + i, brand: 'b2', name: 'f', kind: 'post', author_url: '' }); // qua trang 300
await db.collection('outreach_threads').doc('L2').set({ step: 'funnel', fpayload: { profile_url: IMG.split('?')[0], post_url: P } });
fs.copyFileSync(FIX, path.join(W, '_l49_fix.mjs'));
const w0 = log.writes.length; process.argv = ['node', 'x']; await import(pathToFileURL(path.join(W, '_l49_fix.mjs')).href + '?v=dry');
ok(log.writes.length === w0 && log.updates.length === 0, 'DRY: 0 ghi');
process.argv = ['node', 'x', '--apply']; await import(pathToFileURL(path.join(W, '_l49_fix.mjs')).href + '?v=apply');
const L1 = (await db.collection('leads').doc('L1').get()).data(), L2 = (await db.collection('leads').doc('L2').get()).data(), L3 = (await db.collection('leads').doc('L3').get()).data(), L4 = (await db.collection('leads').doc('L4').get()).data(), T2 = (await db.collection('outreach_threads').doc('L2').get()).data();
ok(L1.author_url === '' && L1.author_url_fix49 && L1.author_url_fix49.uid === null, 'APPLY: lead ảnh không uid → author_url rỗng + dấu fix49');
ok(L2.author_url === 'https://www.facebook.com/profile.php?id=224550447624797' && L2.author_url_fix49.uid === '224550447624797', 'APPLY: lead ảnh có uid → profile.php?id=<uid>');
ok(L3.author_url === 'https://www.facebook.com/profile.php?id=100012345678901' && !L3.author_url_fix49, 'APPLY: lead link thật KHÔNG đụng');
ok(L4.author_url === IMG.split('?')[0] && !L4.author_url_fix49, 'APPLY: lead trước 12/09 15:53 VN ngoài phạm vi (không đụng)');
ok(T2.fpayload.profile_url === 'https://www.facebook.com/profile.php?id=224550447624797' && T2.fpayload.post_url === P, 'APPLY: outreach_threads.fpayload.profile_url sửa theo, field khác giữ');
const w1 = log.updates.length; process.argv = ['node', 'x', '--apply']; await import(pathToFileURL(path.join(W, '_l49_fix.mjs')).href + '?v=apply2');
ok(log.updates.length === w1, 'APPLY lần 2: 0 ghi (idempotent)');
OUT('== HARNESS #49: ' + pass + ' PASS · ' + fail + ' FAIL =='); process.exit(fail ? 1 : 0);
