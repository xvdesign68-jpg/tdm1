/* Harness LỆNH #37: patch stepNick (func path) — gate ma trận/van brand/vai/comment-lead. Chạy: node docs/harness-lenh37-2026-09-07.mjs <stepnick.src.js> */
import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process';
const SRC = fs.readFileSync(path.resolve(process.argv[2]), 'utf8'); const DOCS = path.resolve(new URL('.', import.meta.url).pathname);
const W = fs.mkdtempSync('/tmp/l37h-'); let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x == null ? '' : String(x).slice(0, 200)); };
// dựng outreach.js giả = stub + thân stepNick thật từ dump + handleAuth rỗng
const STUB = `
export const store = new Map(); export const calls = []; export let usage = { react: 0, comment: 0, inbox: 0 }; export const setUsage = u => { usage = u; };
const FieldValue = { serverTimestamp: () => 1 }; const nowMs = () => Date.now();
function ref(col, id) { const k = col + '/' + id; return { id, async get() { const d = store.get(k); return { exists: !!d, data: () => d && Object.assign({}, d) }; }, async set(o, opt) { store.set(k, (opt && opt.merge) ? Object.assign({}, store.get(k) || {}, o) : Object.assign({}, o)); } }; }
function q(col, f = [], lim = 0) { return { where: (a, op, v) => q(col, f.concat([[a, op, v]]), lim), orderBy: () => q(col, f, lim), limit: n => q(col, f, n), doc: id => ref(col, id),
  async get() { let docs = [...store.entries()].filter(([k]) => k.startsWith(col + '/')).map(([k, v]) => ({ id: k.slice(col.length + 1), ref: ref(col, k.slice(col.length + 1)), data: () => Object.assign({}, v) }));
    docs = docs.filter(d => f.every(([a, op, v]) => { const x = d.data()[a]; return op === '==' ? x === v : op === '<=' ? x <= v : true; })); if (lim) docs = docs.slice(0, lim); return { empty: !docs.length, docs }; } }; }
const db = () => ({ collection: c => q(c) });
const getToken = async () => 'tok'; const addLog = async o => { calls.push(['log', o]); };
const usageOf = async () => Object.assign({}, usage);
const DEF = { hot: { react: 1, comment: 1, friend: 1, inbox: 1 }, warm: { react: 1, comment: 1, friend: 1, inbox: 0 }, cold: { react: 1, comment: 0, friend: 0, inbox: 0 } };
const brandCaps = b => Object.assign({ react: 40, comment: 12, friend: 10, inbox: 8 }, (b.outreach && b.outreach.caps) || {});
const brandAllow = (b, temp, act) => { const m = (b.outreach && b.outreach.matrix) || DEF; const r = m[temp] || DEF[temp] || DEF.cold; return !!r[act]; };
const roleBlockOf = l => (l.role === 'seller' || l.role === 'poster_self' || l.self_comment) ? 'role' : null;
const commentIdOf = l => l.comment_id || null;
const parsePost = u => { const m = /\\/posts\\/(\\d+)/.exec(u || ''); return { post_id: m ? m[1] : null }; };
const uidFromAuthor = () => null;
const adv = { react: 'comment', comment: 'inbox', inbox: 'done' };
async function step(name, brand, pid, token, tref, t) { calls.push([name, t.leadId || 'x', t.step]); const nx = adv[t.step]; await tref.set(nx === 'done' ? { step: 'done', active: false } : { step: nx, nextAt: Date.now() - 1 }, { merge: true }); return true; }
const doReact = (...a) => step('doReact', ...a), doComment = (...a) => step('doComment', ...a), doInbox = (...a) => step('doInbox', ...a);
`;
const body = SRC.replace(/async function handleAuth\([^\n]*\n?[\s\S]*$/, 'async function handleAuth() {}\n');
fs.writeFileSync(path.join(W, 'outreach.js'), STUB + body + '\nexport { stepNick };\n'); fs.writeFileSync(path.join(W, 'package.json'), '{"type":"module"}');
const run = (args, cwd) => spawnSync('node', args, { cwd, encoding: 'utf8' });
let r = run([path.join(DOCS, 'lenh-2026-09-07-37-stepnick-patch.cjs'), 'outreach.js'], W); check('patch lần 1: PATCH OK', r.status === 0 && /PATCH OK/.test(r.stdout), r.stdout + r.stderr);
r = run(['--check', 'outreach.js'], W); check('node --check sau patch', r.status === 0, r.stderr);
r = run([path.join(DOCS, 'lenh-2026-09-07-37-stepnick-patch.cjs'), 'outreach.js'], W); check('patch lần 2: idempotent', r.status === 0 && /ĐÃ patch/.test(r.stdout), r.stdout);
const bad = fs.mkdtempSync('/tmp/l37b-'); fs.writeFileSync(path.join(bad, 'outreach.js'), 'async function stepNick(){ return 1; }\nasync function handleAuth(){}\n');
r = run([path.join(DOCS, 'lenh-2026-09-07-37-stepnick-patch.cjs'), 'outreach.js'], bad); check('fail-closed khi thân stepNick khác dump (exit 1, không ghi)', r.status === 1 && /KHONG THAY MOC A1/.test(r.stderr) && !fs.readFileSync(path.join(bad, 'outreach.js'), 'utf8').includes('LENH #37'), r.stderr.slice(0, 80));
const M = await import(path.join(W, 'outreach.js')); const { stepNick, store, calls, setUsage } = M;
const brand = { code: 'b1', name: 'B1', outreach: { on: true } }; const acct = { id: 'p1' };
const lead = (id, o) => store.set('leads/' + id, Object.assign({ brand: 'b1', post_url: 'https://www.facebook.com/groups/1/posts/' + id.replace(/\D/g, '9') + '/', temp: 'hot', name: 'N' + id, detected_at: 1 }, o));
const reset = () => { store.clear(); calls.length = 0; setUsage({ react: 0, comment: 0, inbox: 0 }); };
// A) thứ tự lead: junk · seller · comment-lead · lost · dropped · react-tắt (cold có ma trận tắt react) đứng TRƯỚC lead hot hợp lệ → lead hot mới được tạo thread
reset(); const b2 = { code: 'b1', name: 'B1', outreach: { matrix: { hot: DEFm('hot'), warm: DEFm('warm'), cold: { react: 0, comment: 0, friend: 0, inbox: 0 } } } };
function DEFm(t) { return { hot: { react: 1, comment: 1, friend: 1, inbox: 1 }, warm: { react: 1, comment: 1, friend: 1, inbox: 0 } }[t]; }
lead('L1', { temp: 'junk' }); lead('L2', { role: 'seller' }); lead('L3', { comment_id: '77', kind: 'comment' }); lead('L4', { lost: true }); lead('L5', { dropped: true }); lead('L6', { temp: 'cold' }); lead('L7', { temp: 'hot' });
let ok = await stepNick(b2, acct);
check('A: bỏ junk/seller/comment-lead/lost/dropped/cold-tắt-react → thread tạo cho L7 + doReact chạy', ok === true && store.has('outreach_threads/L7') && !store.has('outreach_threads/L1') && !store.has('outreach_threads/L2') && !store.has('outreach_threads/L3') && !store.has('outreach_threads/L4') && !store.has('outreach_threads/L5') && !store.has('outreach_threads/L6') && calls.some(c => c[0] === 'doReact' && c[1] === 'L7'), JSON.stringify([...store.keys()].filter(k => k.startsWith('outreach_threads'))) + ' ' + JSON.stringify(calls));
const th7 = store.get('outreach_threads/L7'); check('A: thread L7 mang allow {comment:true, inbox:true} (hot đủ 4 bước)', th7 && th7.allow && th7.allow.comment === true && th7.allow.inbox === true, JSON.stringify(th7 && th7.allow));
// B) lead warm (mặc định cân bằng: react+comment+friend, KHÔNG inbox) → allow.inbox=false; sau react → tick kế comment chạy → tick kế inbox bị nhảy → done
reset(); lead('W1', { temp: 'warm' }); await stepNick(brand, acct); const thw = store.get('outreach_threads/W1');
check('B: warm → allow {comment:true, inbox:false}, step sau react = comment', thw.allow.comment === true && thw.allow.inbox === false && thw.step === 'comment', JSON.stringify(thw));
await stepNick(brand, acct); check('B: tick 2 → doComment chạy (được phép), step = inbox', calls.filter(c => c[0] === 'doComment').length === 1 && store.get('outreach_threads/W1').step === 'inbox');
await stepNick(brand, acct); const thw3 = store.get('outreach_threads/W1');
check('B: tick 3 → inbox bị ma trận tắt → nhảy done, KHÔNG gọi doInbox', thw3.step === 'done' && thw3.active === false && !calls.some(c => c[0] === 'doInbox'), JSON.stringify(thw3));
// C) cold (mặc định chỉ react) → sau react, tick kế: comment tắt → inbox tắt → done trong 1 tick, không gọi doComment/doInbox
reset(); lead('C1', { temp: 'cold' }); await stepNick(brand, acct); await stepNick(brand, acct); const thc = store.get('outreach_threads/C1');
check('C: cold → react rồi comment+inbox đều nhảy → done, không doComment/doInbox', thc.step === 'done' && thc.active === false && calls.filter(c => c[0] !== 'doReact' && c[0] !== 'log').length === 0, JSON.stringify(calls));
// D) van brand: comment đã 12/12 → thread ở bước comment hẹn lại ~1 giờ, không gọi doComment
reset(); lead('D1', { temp: 'hot' }); await stepNick(brand, acct); setUsage({ react: 5, comment: 12, inbox: 0 }); const before = Date.now(); await stepNick(brand, acct); const thd = store.get('outreach_threads/D1');
check('D: hết van comment theo brand → nextAt +~60′, step giữ comment, không doComment', thd.step === 'comment' && thd.nextAt >= before + 59 * 60000 && !calls.some(c => c[0] === 'doComment'), JSON.stringify({ step: thd.step, dt: Math.round((thd.nextAt - before) / 60000) }));
// D2) cap riêng brand cao hơn (caps.comment 30) → 12 dùng vẫn chạy
reset(); const b3 = { code: 'b1', name: 'B1', outreach: { caps: { comment: 30 } } }; lead('D2', { temp: 'hot' }); await stepNick(b3, acct); setUsage({ react: 5, comment: 12, inbox: 0 }); await stepNick(b3, acct);
check('D2: brand nới van comment 30 → 12 vẫn chạy doComment', calls.some(c => c[0] === 'doComment' && c[1] === 'D2'));
// E) thread cũ không có allow (trước #37) → hành vi cũ: doComment chạy
reset(); store.set('outreach_threads/O1', { leadId: 'O1', pid: 'p1', step: 'comment', active: true, nextAt: Date.now() - 1 }); await stepNick(brand, acct);
check('E: thread cũ không allow → doComment như cũ', calls.some(c => c[0] === 'doComment' && c[1] === 'O1'), JSON.stringify(calls));
// F) van react theo brand (early-out sẵn có) vẫn chặn nạp lead mới
reset(); lead('F1', {}); setUsage({ react: 40, comment: 0, inbox: 0 }); ok = await stepNick(brand, acct); check('F: react 40/40 → không nạp lead mới (return false)', ok === false && !store.has('outreach_threads/F1'));
console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
