/* Harness LỆNH #36 (06/09/2026): patch stats.js (contentKey/contentEvents/contentPatch + trigger ghi content_stats), patch push.js, Rules content_stats, backfill.
   Chạy: node docs/harness-lenh36-2026-09-06.mjs <thư-mục-test có stats.js gốc, push.js gốc, node_modules fake firebase-*> */
import fs from 'fs'; import path from 'path'; import { execFileSync, spawnSync } from 'child_process';
const T = path.resolve(process.argv[2]); const DOCS = path.resolve(new URL('.', import.meta.url).pathname);
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x == null ? '' : String(x).slice(0, 220)); };
const run = (args, cwd) => spawnSync('node', args, { cwd, encoding: 'utf8' });
// ---- 1) stats.js patch ----
const W = path.join(T, 'w1'); fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W); fs.copyFileSync(path.join(T, 'stats.js'), path.join(W, 'stats.js')); fs.symlinkSync(path.join(T, 'node_modules'), path.join(W, 'node_modules')); fs.writeFileSync(path.join(W, 'package.json'), '{"type":"module"}');
let r = run([path.join(DOCS, 'lenh-2026-09-06-36-stats-patch.cjs'), 'stats.js'], W); check('stats patch lần 1: PATCH OK', r.status === 0 && /PATCH OK/.test(r.stdout), r.stdout + r.stderr);
r = run(['--check', 'stats.js'], W); check('stats.js node --check', r.status === 0, r.stderr);
r = run([path.join(DOCS, 'lenh-2026-09-06-36-stats-patch.cjs'), 'stats.js'], W); check('stats patch lần 2: idempotent', r.status === 0 && /ĐÃ patch/.test(r.stdout), r.stdout);
const bad = path.join(T, 'w1bad'); fs.rmSync(bad, { recursive: true, force: true }); fs.mkdirSync(bad); fs.writeFileSync(path.join(bad, 'stats.js'), 'const x = 1;');
r = run([path.join(DOCS, 'lenh-2026-09-06-36-stats-patch.cjs'), 'stats.js'], bad); check('stats patch fail-closed khi thiếu mốc (exit 1, không ghi)', r.status === 1 && fs.readFileSync(path.join(bad, 'stats.js'), 'utf8') === 'const x = 1;', r.stderr);
const S = await import(path.join(W, 'stats.js')); const { contentKey, contentEvents, contentPatch, statsOnLead } = S;
check('contentKey: variant 3→v3, -1→vx, "x"→vx, parent ""→none, mode ai→ai, ký tự lạ → _', contentKey('variant', 3) === 'v3' && contentKey('variant', -1) === 'vx' && contentKey('variant', 'x') === 'vx' && contentKey('parent', '') === 'none' && contentKey('mode', 'ai') === 'ai' && contentKey('cta', 'a.b/c') === 'a_b_c');
const meta = { v: 34, mode: 'ai', style: 'direct', parent: 'seller', cta: 'cmp', variant: 2 };
check('contentEvents: lead không có meta → null', contentEvents(null, { outreach: { steps: ['react'] } }) === null && contentEvents({}, { stage: 'responded' }) === null);
let ev = contentEvents(null, { outreach: { content: meta, steps: ['react', 'comment'] } }); check('tạo mới có meta chưa inbox → tagged 1 (không sent/rep)', ev && ev.inc.tagged === 1 && !ev.inc.sent && !ev.inc.rep, JSON.stringify(ev && ev.inc));
ev = contentEvents({ outreach: { content: meta, steps: ['react'] } }, { outreach: { content: meta, steps: ['react', 'comment', 'inbox'], inbox_at: 1 } }); check('inbox_at xuất hiện → sent 1 (không tagged lại)', ev && ev.inc.sent === 1 && !ev.inc.tagged && !ev.inc.rep, JSON.stringify(ev && ev.inc));
ev = contentEvents({ outreach: { content: meta, inbox_at: 1 }, stage: 'new' }, { outreach: { content: meta, inbox_at: 1 }, stage: 'responded' }); check('đã inbox → chuyển Đã phản hồi → rep 1', ev && ev.inc.rep === 1 && !ev.inc.sent, JSON.stringify(ev && ev.inc));
ev = contentEvents({ outreach: { content: meta, inbox_at: 1 }, stage: 'responded' }, { outreach: { content: meta, inbox_at: 1 }, stage: 'booked' }); check('responded → booked: KHÔNG đếm rep lần 2', ev === null, JSON.stringify(ev));
ev = contentEvents({ outreach: { content: meta, inbox_at: 1 } }, { outreach: { content: meta, inbox_at: 1, replied_at: 5 } }); check('worker phát hiện phản hồi (outreach.replied_at) → rep 1', ev && ev.inc.rep === 1, JSON.stringify(ev && ev.inc));
ev = contentEvents({ outreach: { content: meta, inbox_at: 1 } }, { outreach: { content: meta, inbox_at: 1 }, outreach_replied: true }); check('func webhook (outreach_replied) → rep 1', ev && ev.inc.rep === 1, JSON.stringify(ev && ev.inc));
ev = contentEvents({ outreach: { content: meta }, stage: 'responded' }, { outreach: { content: meta, inbox_at: 9 }, stage: 'responded' }); check('khách đã phản hồi TRƯỚC khi inbox → lúc inbox: sent 1 + rep 1 cùng lúc', ev && ev.inc.sent === 1 && ev.inc.rep === 1, JSON.stringify(ev && ev.inc));
ev = contentEvents(null, { outreach: { content: meta, inbox_at: 1 }, stage: 'closed' }); check('backfill (before=null) lead đã inbox + chốt → tagged/sent/rep = 1', ev && ev.inc.tagged === 1 && ev.inc.sent === 1 && ev.inc.rep === 1, JSON.stringify(ev && ev.inc));
ev = contentEvents({ outreach: { content: meta, inbox_at: 1 }, stage: 'responded' }, { outreach: { content: meta, inbox_at: 1 }, stage: 'responded', note: 'x' }); check('update không liên quan → null', ev === null);
const p = contentPatch('hscl-01', { inc: { sent: 1, rep: 1 }, meta }); const inc = v => v && v.__inc__;
check('contentPatch: all.sent/rep = increment(1), mode.ai/parent.seller/cta.cmp/variant.v2/style.direct có sent+rep', inc(p.all.sent) === 1 && inc(p.all.rep) === 1 && inc(p.mode.ai.sent) === 1 && inc(p.parent.seller.rep) === 1 && inc(p.cta.cmp.sent) === 1 && inc(p.variant.v2.sent) === 1 && inc(p.style.direct.rep) === 1 && p.brandCode === 'hscl-01', JSON.stringify(p).slice(0, 200));
const p2 = contentPatch('b', { inc: { tagged: 1 }, meta }); check('contentPatch chỉ tagged → không tạo khoá dim', inc(p2.all.tagged) === 1 && !p2.mode && !p2.variant, JSON.stringify(p2));
// trigger thật với fake db: 1 write vừa chuyển giai đoạn (daily_stats) vừa rep (content_stats)
const F = await import(path.join(T, 'node_modules/firebase-admin/firestore.js')); const store = F.store; for (const k of Object.keys(store)) delete store[k];
const mkEv = (before, after) => ({ data: { before: { exists: !!before, data: () => before }, after: { exists: !!after, data: () => after } } });
await statsOnLead(mkEv({ brand: 'hscl-01', stage: 'new', detected_at: Date.now(), outreach: { content: meta, inbox_at: 1 } }, { brand: 'hscl-01', stage: 'responded', stage_at: Date.now(), detected_at: Date.now(), outreach: { content: meta, inbox_at: 1 } }));
const cs = store['content_stats/hscl-01']; const ds = Object.keys(store).find(k => k.startsWith('daily_stats/hscl-01__'));
check('trigger: content_stats/hscl-01 all.rep=1 + mode.ai.rep=1 + variant.v2.rep=1 (không sent)', cs && cs.all.rep === 1 && !cs.all.sent && cs.mode.ai.rep === 1 && cs.variant.v2.rep === 1 && cs.parent.seller.rep === 1, JSON.stringify(cs));
check('trigger: daily_stats responded=1 vẫn ghi như cũ', ds && store[ds].responded === 1, ds && JSON.stringify(store[ds]));
await statsOnLead(mkEv({ brand: 'hscl-01', stage: 'responded', outreach: { content: meta, inbox_at: 1 } }, { brand: 'hscl-01', stage: 'responded', outreach: { content: meta, inbox_at: 1 }, note: 'x' }));
check('trigger: update không liên quan → không ghi thêm', store['content_stats/hscl-01'].all.rep === 1 && F.writes.length === 2, 'writes=' + F.writes.length);
await statsOnLead(mkEv(null, { brand: 'hscl-01', stage: 'new', detected_at: Date.now(), outreach: { content: { mode: 'reply', variant: -1, parent: '' }, inbox_at: 3 } }));
const cs2 = store['content_stats/hscl-01']; check('trigger: lead mới đã inbox meta reply/vx/none → all.sent=1,tagged=1 + mode.reply + variant.vx + parent.none', cs2.all.sent === 1 && cs2.all.tagged === 1 && cs2.mode.reply.sent === 1 && cs2.variant.vx.sent === 1 && cs2.parent.none.sent === 1 && cs2.all.rep === 1, JSON.stringify(cs2));
// ---- 2) push.js patch ----
const P = path.join(T, 'w2'); fs.rmSync(P, { recursive: true, force: true }); fs.mkdirSync(P); fs.copyFileSync(path.join(T, 'push.js'), path.join(P, 'push.js'));
r = run([path.join(DOCS, 'lenh-2026-09-06-36-push-patch.cjs'), 'push.js'], P); const ps = fs.readFileSync(path.join(P, 'push.js'), 'utf8');
check('push patch n=2: reply có require+Mở lead, hẹn chăm có Mở việc', r.status === 0 && /n=2/.test(r.stdout) && /tag: 'reply-' \+ id, require: '1', actionTitle: 'Mở lead' \}\)/.test(ps) && /tag: 'fu-' \+ d\.id, actionTitle: 'Mở việc' \}\)/.test(ps), r.stdout);
r = run(['--check', 'push.js'], P); check('push.js node --check', r.status === 0, r.stderr);
r = run([path.join(DOCS, 'lenh-2026-09-06-36-push-patch.cjs'), 'push.js'], P); check('push patch idempotent (n=0)', r.status === 0 && /n=0/.test(r.stdout), r.stdout);
fs.writeFileSync(path.join(P, 'push.js'), "send(x, { tag: 'reply-' + id + 'z' });"); r = run([path.join(DOCS, 'lenh-2026-09-06-36-push-patch.cjs'), 'push.js'], P); check('push patch fail-closed khi mốc khác (exit 1 + in dòng hiện có)', r.status === 1 && /KHONG THAY MOC reply/.test(r.stderr) && /'reply-'/.test(r.stderr), r.stderr.slice(0, 80));
// ---- 3) Rules ----
const rulesCase = (name, src, expectOk, must) => { const d = path.join(T, 'r_' + name); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d); fs.writeFileSync(path.join(d, 'firestore.rules'), src);
  const rr = run([path.join(DOCS, 'lenh-2026-09-06-36-rules.cjs')], d); const out = fs.readFileSync(path.join(d, 'firestore.rules'), 'utf8'); const ok = expectOk ? (rr.status === 0 && (out.match(/match \/content_stats\//g) || []).length === 1 && (!must || must.test(out))) : (rr.status === 1 && !/content_stats/.test(out)); check('Rules ' + name, ok, (rr.stdout + rr.stderr).slice(0, 160)); return d; };
const multi = "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /outreach_stats/{id} {\n      allow read: if request.auth != null && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin' || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.brand == resource.data.brandCode);\n      allow write: if false;\n    }\n    match /daily_stats/{id} {\n      allow read: if request.auth != null && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin' || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.brand == resource.data.brandCode);\n      allow write: if false;\n    }\n  }\n}\n";
const d1 = rulesCase('block nhiều dòng → chèn content_stats (1 block, giữ daily_stats)', multi, true, /match \/content_stats\/\{id\} \{\n      allow read: if request\.auth != null[\s\S]*?brandCode\);\n      allow write: if false;\n    \}\n    match \/daily_stats/);
r = run([path.join(DOCS, 'lenh-2026-09-06-36-rules.cjs')], d1); check('Rules idempotent (đã có → bỏ qua, không chèn thêm)', r.status === 0 && /ĐÃ CÓ/.test(r.stdout) && (fs.readFileSync(path.join(d1, 'firestore.rules'), 'utf8').match(/content_stats/g) || []).length === 2, r.stdout);
rulesCase('block 1 dòng', "service cloud.firestore {\n  match /databases/{database}/documents {\n    match /outreach_stats/{id} { allow read: if isSuperAdmin() || resource.data.brandCode == myBrand(); allow write: if false; }\n  }\n}\n", true, /match \/content_stats\/\{id\} \{ allow read: if isSuperAdmin\(\) \|\| resource\.data\.brandCode == myBrand\(\); allow write: if false; \}/);
rulesCase('không có block outreach_stats → exit 1 không ghi', "service cloud.firestore {\n  match /databases/{database}/documents {\n    match /workers/{wid} { allow read: if isSuperAdmin(); allow write: if false; }\n  }\n}\n", false);
// ---- 4) backfill với fake store ----
for (const k of Object.keys(store)) delete store[k]; F.writes.length = 0;
store['leads/A'] = { brand: 'hscl-01', outreach: { at: 5, content: meta, inbox_at: 1 }, stage: 'responded' };
store['leads/B'] = { brand: 'hscl-01', outreach: { at: 6, content: { mode: 'ai', variant: 0, parent: '', style: 'direct', cta: 'brand' }, inbox_at: 1 }, stage: 'new' };
store['leads/C'] = { brand: 'hscl-01', outreach: { at: 7, content: meta }, stage: 'new' }; // chưa inbox
store['leads/D'] = { brand: 'tts', outreach: { at: 8, steps: ['react'] } }; // không meta
store['leads/E'] = { brand: 'hscl-01', stage: 'closed' }; // không outreach
const BF = path.join(W, '_cs_backfill.mjs'); fs.copyFileSync(path.join(DOCS, 'lenh-2026-09-06-36-cs-backfill.mjs'), BF);
await import(BF); const b = store['content_stats/hscl-01'];
check('backfill: hscl-01 all {sent 2, rep 1, tagged 3}, mode.ai {sent 2, rep 1}, parent seller/none, variant v2/v0; brand tts không có doc', b && b.all.sent === 2 && b.all.rep === 1 && b.all.tagged === 3 && b.mode.ai.sent === 2 && b.mode.ai.rep === 1 && b.parent.seller.sent === 1 && b.parent.none.sent === 1 && b.variant.v2.rep === 1 && b.variant.v0.sent === 1 && !store['content_stats/tts'], JSON.stringify(b));
console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
