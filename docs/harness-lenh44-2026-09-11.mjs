/* Harness LỆNH #44 (11/09/2026): patch engine (outreach.js + stats.js) — E-16 nick cờ · E-17 van hiệu lực · R-1 người thật (engine + trigger) ·
   E-4/E-5 reserve lại + hoàn van cùng ngày · E-7 task running · R-6 sweeper + system_status/outreach.
   Dựng lại outreach.js/stats.js theo ĐÚNG dòng dump #43 (10/09) + #44a (11/09) (mốc patch nguyên văn) + stub Firestore in-memory. Chạy: node docs/harness-lenh44-2026-09-11.mjs */
import fs from 'fs'; import path from 'path'; import { spawnSync } from 'child_process';
const DOCS = path.resolve(new URL('.', import.meta.url).pathname); const PATCH = path.join(DOCS, 'lenh-2026-09-11-44-patch.cjs');
let pass = 0, total = 0; const check = (n, ok, x) => { total++; if (ok) pass++; console.log(ok ? 'PASS' : 'FAIL', n, x == null ? '' : String(x).slice(0, 220)); };

/* ---------- stub Firestore in-memory (where/orderBy/limit/get/doc/set/add/runTransaction) ---------- */
const STUB = `export const store = new Map(); export const logs = []; let autoId = 0;
const clone = o => JSON.parse(JSON.stringify(o));
export const FieldValue = { serverTimestamp: () => Date.now(), increment: n => ({ __inc: n }), arrayUnion: (...v) => ({ __au: v }) };
function applyMerge(old, patch) { const o = Object.assign({}, old || {}); for (const [k, v] of Object.entries(patch)) { if (v && typeof v === 'object' && !Array.isArray(v) && '__inc' in v) o[k] = (Number(o[k]) || 0) + v.__inc; else if (v && typeof v === 'object' && !Array.isArray(v) && '__au' in v) o[k] = [...new Set([...(o[k] || []), ...v.__au])]; else o[k] = v; } return o; }
function docRef(col, id) { const key = col + '/' + id; return { id, async get() { return snap(col, id); }, async set(obj, opt) { store.set(key, (opt && opt.merge) ? applyMerge(store.get(key), obj) : applyMerge({}, obj)); if (col === 'outreach_log') logs.push(store.get(key)); }, collection: c => query(col + '/' + id + '/' + c) }; }
function snap(col, id) { const d = store.get(col + '/' + id); return { id, exists: !!d, ref: docRef(col, id), data: () => d ? clone(d) : undefined }; }
function query(col, filters = [], order = null, lim = 0) { return { where: (f, op, v) => query(col, [...filters, [f, op, v]], order, lim), orderBy: (f, dir) => query(col, filters, [f, dir || 'asc'], lim), limit: n => query(col, filters, order, n), doc: id => docRef(col, id),
  async add(obj) { const id = 'auto' + (++autoId); const v = applyMerge({}, obj); store.set(col + '/' + id, v); if (col === 'outreach_log') logs.push(v); return docRef(col, id); },
  async get() { let docs = [...store.entries()].filter(([k]) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/')).map(([k, v]) => ({ id: k.slice(col.length + 1), v }));
    docs = docs.filter(({ v }) => filters.every(([f, op, x]) => { const a = v[f]; if (op === '==') return a === x; if (a == null) return false; if (op === '<=') return a <= x; if (op === '>=') return a >= x; if (op === '<') return a < x; if (op === '>') return a > x; return true; }));
    if (order) { docs = docs.filter(({ v }) => v[order[0]] != null); docs.sort((p, q) => (p.v[order[0]] > q.v[order[0]] ? 1 : p.v[order[0]] < q.v[order[0]] ? -1 : 0) * (order[1] === 'desc' ? -1 : 1)); }
    if (lim) docs = docs.slice(0, lim); const out = docs.map(({ id }) => snap(col, id)); return { empty: !out.length, size: out.length, docs: out }; } }; }
export function getFirestore() { return { collection: c => query(c), runTransaction: async fn => fn({ get: r => r.get(), set: (r, o, opt) => { r.set(o, opt); } }) }; }
export const getApps = () => [1]; export const initializeApp = () => {}; export const onSchedule = (o, fn) => fn; export const onDocumentWritten = (o, fn) => fn; export const onRequest = (o, fn) => fn;
export const genForLead = async () => ({ comment: 'c', inbox: 'i', mode: 'ai', meta: { v: 34 } });
export const SecretManagerServiceClient = class {};
`;

/* ---------- outreach.js dựng lại (dòng thật từ dump; phần không liên quan = stub tối giản) ---------- */
const OUTREACH = `import { getFirestore, FieldValue, onSchedule, onRequest, genForLead, SecretManagerServiceClient } from './stub.mjs';
const REGION = 'asia-southeast1';
const CAPS = { react: 40, comment: 12, inbox: 8, friend: 10 };
const HOURS = { start: 8, end: 22 };
const GAP_MIN_MS = 3 * 60 * 1000;
const GAP_RAND_MS = 5 * 60 * 1000;
const WARM_REACT_TO_COMMENT = [2, 5];
const WARM_COMMENT_TO_INBOX = [1, 4];
const REACT_MIX = ['LOVE', 'LOVE', 'LOVE', 'LOVE', 'LIKE'];

const sm = new SecretManagerServiceClient();
let _db = null;
function db() { return _db || (_db = getFirestore()); }
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const nowMs = () => Date.now();
function vnHour() { return (new Date().getUTCHours() + 7) % 24; }
function inHours() { return true; }
const dayKey = () => { const d = new Date(nowMs() + 7 * 3600 * 1000); return d.toISOString().slice(0, 10); };
function parsePost(url) { const m = /\\/posts\\/(\\d+)/.exec(url || ''); return { post_id: m ? m[1] : null }; }
function commentIdOf(lead){ return lead.comment_id || null; }
function commentUrlOf0(lead,cid){ return lead.comment_url || (lead.post_url + '?comment_id=' + cid); }
function uidFromAuthor(url) { const m = /profile\\.php\\?id=(\\d+)/.exec(url || ''); return m ? m[1] : null; }
async function addLog(o) { await db().collection('outreach_log').add(Object.assign({ at: FieldValue.serverTimestamp() }, o)); }
async function tryConsume(pid, kind, capOverride) {
  const ref = db().collection('outreach_usage').doc(\`\${pid}__\${dayKey()}\`);
  return db().runTransaction(async tx => {
    const s = await tx.get(ref); const d = s.exists ? s.data() : {};
    const used = Number(d[kind]) || 0;
    const cap = (Number(capOverride) > 0) ? Number(capOverride) : CAPS[kind];
    if (used >= cap) return false;
    tx.set(ref, { [kind]: used + 1, pid, day: dayKey(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}
async function usageOf(pid) {
  const s = await db().collection('outreach_usage').doc(\`\${pid}__\${dayKey()}\`).get();
  const d = s.exists ? s.data() : {};
  return { react: Number(d.react) || 0, comment: Number(d.comment) || 0, inbox: Number(d.inbox) || 0 };
}
async function stepNick(brand, acct) { return false; }
const OA_DEF_MATRIX = { hot: { react: 1, comment: 1, friend: 1, inbox: 1 }, warm: { react: 1, comment: 1, friend: 1, inbox: 0 }, cold: { react: 1, comment: 0, friend: 0, inbox: 0 } };
function brandCaps(brand) { const c = (brand.outreach && brand.outreach.caps) || {}; const o = {}; ['react','comment','friend','inbox'].forEach(k => { o[k] = Number(c[k]) > 0 ? Number(c[k]) : CAPS[k]; }); return o; }
function brandAllow(brand, temp, action) { if (temp !== 'hot' && temp !== 'warm' && temp !== 'cold') return false; const m = (brand.outreach && brand.outreach.matrix) || {}; const row = m[temp] || {}; const def = OA_DEF_MATRIX[temp]; return (row[action] != null) ? !!row[action] : !!def[action]; }

async function apEnqueueFunnel(acct, brand, lead, tref) {
  const pid = acct.id || acct.pid;
  const temp = lead.temp || 'cold';
  if (temp === 'junk') return false;
  const caps = brandCaps(brand);
  const allow = a => brandAllow(brand, temp, a);
  const hasProfile = !!lead.author_url;
  const uid = uidFromAuthor(lead.author_url);
  const steps = [];
  if (allow('react') && await tryConsume(pid, 'react', caps.react)) steps.push('react');
  if (allow('comment') && await tryConsume(pid, 'comment', caps.comment)) steps.push('comment');
  if (allow('friend') && hasProfile && await tryConsume(pid, 'friend', caps.friend)) steps.push('add_friend');
  if (allow('inbox') && hasProfile && steps.indexOf('add_friend') >= 0 && await tryConsume(pid, 'inbox', caps.inbox)) steps.push('inbox');
  if (!steps.length) return false;
  /* v119-41 Content Studio: comment + inbox RIÊNG theo bài của lead + hồ sơ brand (brands/{code}.content); AI lỗi → mẫu/lead.reply, không chặn phễu */
  const gen = (steps.includes('comment') || steps.includes('inbox')) ? await genForLead(brand, lead) : { comment: '', inbox: '', mode: 'none' };
  const payload = { post_url: lead.post_url, reaction: pick(REACT_MIX), comment_msg: gen.comment, inbox_msg: gen.inbox, content_meta: (gen && gen.meta) || null, /* LENH #34: meta nội dung → worker ghi lên lead.outreach.content */ content_mode: gen.mode || '', uid: uid || null, profile_url: lead.author_url || '', steps };
  const _cid = commentIdOf(lead); const _curl = _cid ? commentUrlOf(lead, _cid) : null;
  if (_cid && _curl) { payload.kind = 'comment'; payload.comment_id = _cid; payload.comment_url = _curl; }
  const meta = { leadId: lead.id, name: lead.name || 'An danh', brandName: brand.name || brand.code, brandCode: brand.code, temp: lead.temp || 'cold', score: Number(lead.score) || 0 };
  await db().collection('outreach_tasks').doc(lead.id + '__funnel').set(Object.assign({}, meta, { pid, adspower_id: acct.adspower_id || null, action: 'funnel', workerId: acct.workerId || '', payload, status: 'queued', createdAt: FieldValue.serverTimestamp() }));
  await tref.set(Object.assign({}, meta, { brand: brand.code, pid, step: 'funnel', active: true, taskStatus: 'queued', nextAt: nowMs() + 30 * 60000, fpayload: payload, createdAt: FieldValue.serverTimestamp() }), { merge: true });
  return true;
}
const __SL_ANON31 = /an danh|anonymous|nguoi tham gia|facebook user|nguoi dung facebook/;
function __slFold31(s) { return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().trim(); }
function roleBlockOf(lead) {
  const r = String(lead.role || '').toLowerCase().trim();
  if (r === 'seller') return 'người bán/đối thủ' + (lead.role_reason ? ' (AI: ' + lead.role_reason + ')' : ' (AI)');
  if (r === 'poster_self' || lead.self_comment === true) return 'chính chủ bài tự bình luận';
  if (lead.kind === 'comment' && lead.name && lead.parent_author) {
    const a = __slFold31(lead.name), p = __slFold31(lead.parent_author);
    if (a && a === p && !__SL_ANON31.test(a)) return 'chính chủ bài tự bình luận (tên khớp)';
  }
  return '';
}
async function skipLeadRole(lead, brand, acct, why) {
  const pid = acct.id || acct.pid;
  await db().collection('outreach_threads').doc(lead.id).set({ leadId: lead.id, brand: brand.code, brandCode: brand.code, pid, name: lead.name || '', temp: lead.temp || 'cold', active: false, step: 'skipped_role', taskStatus: 'skipped', skipReason: why, nextAt: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await addLog({ leadId: lead.id, name: lead.name || '', brand: brand.name || '', brandCode: brand.code, pid, temp: lead.temp || 'cold', action: '⏭ Bỏ qua lead — ' + why + ' (không tiếp cận đối thủ/chủ bài)', status: 'skip' });
}

async function stepNickAdspower(brand, acct) {
  const pid = acct.id || acct.pid;
  if (!acct.adspower_id) { await addLog({ pid, brand: brand.name, brandCode: brand.code, action: 'Bo qua: nick AdsPower thieu Profile ID', status: 'sched' }); return false; }
  const threads = db().collection('outreach_threads');
  const retry = await threads.where('pid', '==', pid).where('active', '==', true).where('nextAt', '<=', nowMs()).orderBy('nextAt', 'asc').limit(1).get();
  if (!retry.empty) {
    const d = retry.docs[0], th = d.data();
    if (th.fpayload) {
      await db().collection('outreach_tasks').doc(d.id + '__funnel').set({ leadId: d.id, name: th.name, brandName: th.brandName, brandCode: th.brandCode || th.brand, temp: th.temp, score: th.score, pid, adspower_id: acct.adspower_id || null, action: 'funnel', workerId: acct.workerId || '', payload: th.fpayload, status: 'queued', createdAt: FieldValue.serverTimestamp() });
      await d.ref.set({ taskStatus: 'queued', nextAt: nowMs() + 30 * 60000 }, { merge: true });
      return true;
    }
    await d.ref.set({ active: false }, { merge: true });
  }
  const u = await usageOf(pid);
  if (u.react >= CAPS.react) return false;
  const leadsSnap = await db().collection('leads').where('brand', '==', brand.code).orderBy('detected_at', 'desc').limit(40).get();
  for (const ld of leadsSnap.docs) {
    const lead = ld.data(); lead.id = ld.id;
    if (lead.dropped) continue;
    if ((lead.temp || 'cold') === 'junk') continue;
    const tref = threads.doc(lead.id);
    if ((await tref.get()).exists) continue;
    { const __rb = roleBlockOf(lead); if (__rb) { await skipLeadRole(lead, brand, acct, __rb); continue; } } /* v-selfcmt */
    if (!parsePost(lead.post_url).post_id) continue;
    if (await apEnqueueFunnel(acct, brand, lead, tref)) return true;
  }
  return false;
}
export const outreachTick = onSchedule({ schedule: 'every 5 minutes', region: REGION, timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 300, maxInstances: 1, memory: '512MiB' }, async () => {
  if (!inHours()) return;
  const now = nowMs();
  const brandsSnap = await db().collection('brands').get();
  const brandMap = {};
  brandsSnap.docs.forEach(d => { const b = Object.assign({ code: d.id }, d.data()); if (b.outreach && b.outreach.on) brandMap[b.code] = b; });
  if (!Object.keys(brandMap).length) return;
  // v120-scale P2: CHỈ nạp nick TỚI HẠN (active + nextFreeAt<=now), FIFO theo nextFreeAt — KHÔNG đọc hết fb_accounts, KHÔNG tuần tự → hết timeout + hết starvation đuôi.
  const BATCH = 800;
  const dueSnap = await db().collection('fb_accounts')
    .where('active', '==', true).where('nextFreeAt', '<=', now)
    .orderBy('nextFreeAt', 'asc').limit(BATCH).get();
  const due = dueSnap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(a => brandMap[a.brand]);
  if (!due.length) return;
  const CONC = 25;
  let idx = 0;
  const runOne = async () => {
    while (idx < due.length) {
      const acct = due[idx++];
      const brand = brandMap[acct.brand];
      const pid = acct.id;
      let acted = false;
      try { acted = await (acct.engine === 'adspower' ? stepNickAdspower : stepNick)(brand, acct); }
      catch (e) { console.error('[outreach] step', pid, e && e.message); }
      const gap = acted ? (GAP_MIN_MS + Math.floor(Math.random() * GAP_RAND_MS)) : (rand(20, 40) * 60 * 1000);
      try { await db().collection('fb_accounts').doc(pid).set({ nextFreeAt: now + gap }, { merge: true }); } catch (_) { }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, due.length) }, runOne));
});

export const funcWebhook = onRequest({ cors: true, region: REGION }, async (req, res) => { return res.json({ ok: true }); });

/* LENH #32 (06/09/2026): post_url có sẵn "?" → worker không định vị được comment (rớt lead-comment). */
function commentUrlOf(lead, cid) {
  let u = commentUrlOf0(lead, cid);
  if (typeof u === 'string') { const q = u.indexOf('?'); if (q >= 0) u = u.slice(0, q + 1) + u.slice(q + 1).replace(/\\?/g, '&'); }
  return u;
}
export { stepNickAdspower, apEnqueueFunnel, brandCaps };
`;

/* ---------- stats.js dựng lại (dòng thật 59–92 từ dump #44a; helper trên = stub) ---------- */
const STATS = `import { onDocumentWritten } from './stub.mjs';
import { initializeApp, getApps } from './stub.mjs';
import { getFirestore, FieldValue } from './stub.mjs';
const REGION = 'asia-southeast1', OFF = 7 * 3600e3;
export const vnDay = ms => new Date((Number(ms) || Date.now()) + OFF).toISOString().slice(0, 10);
export const toMs = v => { if (!v) return 0; if (typeof v === 'number') return v; if (typeof v.toMillis === 'function') return v.toMillis(); if (v instanceof Date) return v.getTime(); return Number(v) || 0; };
export const tempOf = l => { const t = l && l.temp; if (t === 'hot' || t === 'warm' || t === 'cold' || t === 'junk') return t; const s = Number(l && l.score); if (!Number.isFinite(s)) return 'cold'; return s >= 80 ? 'hot' : s >= 60 ? 'warm' : s >= 40 ? 'cold' : 'junk'; };
const RESP = new Set(['responded', 'booked', 'closed']), BOOK = new Set(['booked', 'closed']);
export function contentEvents(before, after) { return null; }
export function contentPatch(brand, ev) { return {}; }
export function slaInc(inc, fc, det, bad) { }
export async function slaBadOf(brand, before, after) { return 60; }
function careInc(inc, fc, det) { inc.contacted = 1; }
export function statsEvents(before, after, nowMs, opts) { // LENH #40: opts.slaBad = ngưỡng brand (phút)
  const out = []; const push = (day, inc) => { if (Object.keys(inc).length) out.push({ day, inc }); };
  const now = nowMs || Date.now(); const b = before || {}; const det = toMs(after.detected_at);
  const roleBad = l => !!(l && (/^(seller|poster_self)$/.test(String(l.role || '')) || l.self_comment === true));
  const countable = l => !!(l && String(l.brand || '').trim() && (l.temp != null || l.score != null) && !roleBad(l));
  if (countable(after) && !countable(before)) { const inc = {}; const t = tempOf(after); if (t === 'junk') inc.junk = 1; else { inc.new = 1; inc[t] = 1; } push(vnDay(det || now), inc); }
  const fc = toMs(after.first_care_at);
  if (fc && !toMs(b.first_care_at)) { const inc = {}; careInc(inc, fc, det); push(vnDay(fc), inc); }
  const st = String(after.stage || ''), bst = String(b.stage || ''); const stAt = toMs(after.stage_at) || now;
  if (RESP.has(st) && !RESP.has(bst)) push(vnDay(stAt), { responded: 1 });
  return out;
}
export const statsOnLead = onDocumentWritten({ document: 'leads/{id}', region: REGION, memory: '256MiB', maxInstances: 10 }, async (ev) => {
  const after = ev.data && ev.data.after && ev.data.after.exists ? ev.data.after.data() : null;
  if (!after) return;
  const before = ev.data.before && ev.data.before.exists ? ev.data.before.data() : null;
  const brand = String(after.brand || '').trim(); if (!brand) return;
  const slaBad = await slaBadOf(brand, before, after); // LENH #40
  const evs = statsEvents(before, after, Date.now(), { slaBad }); const cev = contentEvents(before, after); if (!evs.length && !cev) return; // LENH #36: + hiệu quả nội dung
  if (!getApps().length) initializeApp(); const db = getFirestore();
  const byDay = {}; evs.forEach(e => { const o = byDay[e.day] || (byDay[e.day] = {}); Object.keys(e.inc).forEach(k => { o[k] = (o[k] || 0) + e.inc[k]; }); });
  await Promise.all(Object.keys(byDay).map(day => { const patch = { brandCode: brand, day, atMs: Date.now() }; Object.keys(byDay[day]).forEach(k => { patch[k] = FieldValue.increment(byDay[day][k]); });
    return db.collection('daily_stats').doc(brand + '__' + day).set(patch, { merge: true }); }));
  if (cev) await db.collection('content_stats').doc(brand).set(contentPatch(brand, cev), { merge: true }); // LENH #36: set-merge + increment lồng → an toàn ghi đồng thời
});
`;

if (process.env.L44_EXPORT_DIR) { const E = process.env.L44_EXPORT_DIR; fs.mkdirSync(E, { recursive: true }); fs.writeFileSync(path.join(E, 'stub.mjs'), STUB); fs.writeFileSync(path.join(E, 'outreach.js'), OUTREACH); fs.writeFileSync(path.join(E, 'stats.js'), STATS); console.log('exported fake engine →', E); process.exit(0); } // dry-run .sh dùng
const mk = () => { const W = fs.mkdtempSync('/tmp/l44h-'); fs.writeFileSync(path.join(W, 'stub.mjs'), STUB); fs.writeFileSync(path.join(W, 'outreach.js'), OUTREACH); fs.writeFileSync(path.join(W, 'stats.js'), STATS); fs.writeFileSync(path.join(W, 'package.json'), '{"type":"module"}'); return W; };
const run = (args, cwd) => spawnSync('node', args, { cwd, encoding: 'utf8' });

/* ---------- 1. patch: OK / --check / idempotent / fail-closed nguyên tử ---------- */
const W = mk();
let r = run([PATCH, 'outreach.js', 'stats.js'], W); check('patch lần 1: PATCH OK', r.status === 0 && /PATCH OK/.test(r.stdout), r.stdout + r.stderr);
r = run(['--check', 'outreach.js'], W); check('node --check outreach.js', r.status === 0, r.stderr);
r = run(['--check', 'stats.js'], W); check('node --check stats.js', r.status === 0, r.stderr);
r = run([PATCH, 'outreach.js', 'stats.js'], W); check('patch lần 2: idempotent', r.status === 0 && /ĐÃ patch/.test(r.stdout), r.stdout);
check('marker LENH #44 có ở cả 2 file', fs.readFileSync(path.join(W, 'outreach.js'), 'utf8').includes('LENH #44') && fs.readFileSync(path.join(W, 'stats.js'), 'utf8').includes('LENH #44'));
for (const [name, file, from, to] of [
  ['O4 retry (khác 1 ký tự)', 'outreach.js', "if (u.react >= CAPS.react) return false;", "if (u.react >= CAPS.react) return  false;"],
  ['O6 outreachTick due', 'outreach.js', ".filter(a => brandMap[a.brand]);\n  if (!due.length) return;", ".filter(a => brandMap[a.brand]);\n  if (!due.length) { return; }"],
  ['S2 stats brand/slaBad', 'stats.js', "slaBadOf(brand, before, after); // LENH #40", "slaBadOf(brand,before, after); // LENH #40"],
]) { const B = mk(); const f = path.join(B, file); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(from, to)); const o0 = fs.readFileSync(path.join(B, 'outreach.js'), 'utf8'), s0 = fs.readFileSync(path.join(B, 'stats.js'), 'utf8');
  r = run([PATCH, 'outreach.js', 'stats.js'], B); check('fail-closed NGUYÊN TỬ khi lệch mốc ' + name + ' → exit 1, KHÔNG ghi file nào', r.status === 1 && /KHONG THAY MOC/.test(r.stderr) && fs.readFileSync(path.join(B, 'outreach.js'), 'utf8') === o0 && fs.readFileSync(path.join(B, 'stats.js'), 'utf8') === s0, r.stderr.slice(0, 120)); }
{ const B = mk(); fs.appendFileSync(path.join(B, 'stats.js'), '\n// LENH #44 giả\n'); r = run([PATCH, 'outreach.js', 'stats.js'], B); check('LỆCH (1 file đã có marker) → exit 1', r.status === 1 && /LỆCH/.test(r.stderr), r.stderr.slice(0, 80)); }

/* ---------- 2. chạy engine đã patch với stub Firestore ---------- */
const M = await import(path.join(W, 'outreach.js')); const S = await import(path.join(W, 'stats.js')); const F = await import(path.join(W, 'stub.mjs'));
const { store, logs } = F; const { outreachTick, stepNickAdspower, brandCaps } = M; const { statsOnLead, humanTookOver, stopMachine } = S;
const DAY = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); const YEST = () => new Date(Date.now() + 7 * 3600e3 - 86400e3).toISOString().slice(0, 10);
const reset = () => { store.clear(); logs.length = 0; };
const brandOn = (code, extra) => store.set('brands/' + code, Object.assign({ name: code.toUpperCase(), outreach: Object.assign({ on: true }, extra || {}) }));
const nick = (id, o) => store.set('fb_accounts/' + id, Object.assign({ brand: 'b1', active: true, engine: 'adspower', adspower_id: 'A' + id, nextFreeAt: 0, label: 'nick ' + id }, o));
const lead = (id, o) => store.set('leads/' + id, Object.assign({ brand: 'b1', post_url: 'https://www.facebook.com/groups/1733640124552320/posts/17359' + id.replace(/\D/g, '9') + '/', temp: 'hot', name: 'N' + id, detected_at: Date.now(), stage: 'new', author_url: 'https://www.facebook.com/profile.php?id=1000' + id.replace(/\D/g, '1') }, o));
const usage = (pid, o, day) => store.set('outreach_usage/' + pid + '__' + (day || DAY()), Object.assign({ pid, day: day || DAY() }, o));
const thread = (id, o) => store.set('outreach_threads/' + id, Object.assign({ leadId: id, brand: 'b1', brandCode: 'b1', brandName: 'B1', name: 'N' + id, temp: 'hot', score: 90, pid: 'p1', step: 'funnel', active: true, taskStatus: 'queued', nextAt: Date.now() - 60000, fpayload: { steps: ['react', 'comment', 'add_friend', 'inbox'], post_url: 'x' }, createdAt: Date.now() - 3600e3 }, o));
const g = k => store.get(k);

// E-16: nick cờ không được xếp việc; nextFreeAt +1h
reset(); brandOn('b1'); nick('p1'); nick('p2', { needLogin: true }); nick('p3', { safetyPaused: true, active: true }); nick('p4', { challenge: 'RATE_LIMIT' }); lead('L1'); lead('L2', { detected_at: Date.now() - 1000 });
let t0 = Date.now(); await outreachTick();
check('E-16: chỉ nick sạch (p1) được xếp việc → thread L1 pid p1 + task queued + reservedDay hôm nay', g('outreach_threads/L1') && g('outreach_threads/L1').pid === 'p1' && g('outreach_tasks/L1__funnel') && g('outreach_tasks/L1__funnel').status === 'queued' && g('outreach_threads/L1').reservedDay === DAY(), JSON.stringify(g('outreach_threads/L1') || {}).slice(0, 160));
check('E-16: p2/p3/p4 (needLogin/safetyPaused/checkpoint) KHÔNG tạo thread + nextFreeAt đẩy ~+1h', ['p2', 'p3', 'p4'].every(p => ![...store.keys()].some(k => k.startsWith('outreach_threads/') && g(k).pid === p) && g('fb_accounts/' + p).nextFreeAt >= t0 + 59 * 60000 && g('fb_accounts/' + p).nextFreeAt <= t0 + 61 * 60000), JSON.stringify(['p2', 'p3', 'p4'].map(p => Math.round((g('fb_accounts/' + p).nextFreeAt - t0) / 60000))));
check('E-16: p1 nextFreeAt = gap 3–8′ (acted)', g('fb_accounts/p1').nextFreeAt >= t0 + 3 * 60000 && g('fb_accounts/p1').nextFreeAt <= t0 + 8 * 60000 + 1000, Math.round((g('fb_accounts/p1').nextFreeAt - t0) / 60000));
check('E-16: nick p1 có usage react/comment/friend/inbox = 1 (reserve lúc enqueue)', (() => { const u = g('outreach_usage/p1__' + DAY()); return u && u.react === 1 && u.comment === 1 && u.friend === 1 && u.inbox === 1; })(), JSON.stringify(g('outreach_usage/p1__' + DAY())));
check('R-6: system_status/outreach ghi brands.b1 nicksAlive 1 / nicksTotal 4', (() => { const s = g('system_status/outreach'); return s && s.brands && s.brands.b1 && s.brands.b1.nicksAlive === 1 && s.brands.b1.nicksTotal === 4; })(), JSON.stringify(g('system_status/outreach') || {}).slice(0, 200));

// E-17: van hiệu lực = min(brand, trần cứng) + early-out theo brand
check('E-17: brandCaps({100,100,30,30}) = {80,30,20,15}', JSON.stringify(brandCaps({ outreach: { caps: { react: 100, comment: 100, friend: 30, inbox: 30 } } })) === JSON.stringify({ react: 80, comment: 30, friend: 20, inbox: 15 }), JSON.stringify(brandCaps({ outreach: { caps: { react: 100, comment: 100, friend: 30, inbox: 30 } } })));
check('E-17: brandCaps(không caps) = mặc định 40/12/10/8', JSON.stringify(brandCaps({})) === JSON.stringify({ react: 40, comment: 12, friend: 10, inbox: 8 }));
reset(); brandOn('b1', { caps: { react: 100, comment: 100 } }); nick('p1'); lead('L1'); usage('p1', { react: 45, comment: 30 });
let ok = await stepNickAdspower(g('brands/b1') && Object.assign({ code: 'b1' }, g('brands/b1')), Object.assign({ id: 'p1' }, g('fb_accounts/p1')));
check('E-17: usage react 45 (> CAPS 40, < brand 80) → VẪN mở lead mới (trước: dừng ở 40)', ok === true && g('outreach_threads/L1'), ok);
check('E-17: comment 30/30 (brand 100 → trần cứng 30) → phễu KHÔNG có bước comment', g('outreach_tasks/L1__funnel') && !g('outreach_tasks/L1__funnel').payload.steps.includes('comment') && g('outreach_tasks/L1__funnel').payload.steps.includes('react'), JSON.stringify((g('outreach_tasks/L1__funnel') || { payload: {} }).payload.steps));
reset(); brandOn('b1', { caps: { react: 100 } }); nick('p1'); lead('L1'); usage('p1', { react: 80 });
ok = await stepNickAdspower(Object.assign({ code: 'b1' }, g('brands/b1')), Object.assign({ id: 'p1' }, g('fb_accounts/p1')));
check('E-17: usage react 80 = trần cứng → không mở lead mới', ok === false && !g('outreach_threads/L1'));

// R-1 engine: bỏ lead người thật đang chăm
reset(); brandOn('b1'); nick('p1'); const now = Date.now();
lead('H1', { detected_at: now - 1, first_care_at: now - 5000 }); lead('H2', { detected_at: now - 2, stage: 'booked' }); lead('H3', { detected_at: now - 3, lost: true }); lead('H4', { detected_at: now - 4, closed_at: now - 9 }); lead('H5', { detected_at: now - 5, outreach_replied: true }); lead('H6', { detected_at: now - 6, last_touch_at: now - 7 }); lead('H7', { detected_at: now - 7, assignee: 'sales@x' }); lead('H8', { detected_at: now - 8 });
const B1 = () => Object.assign({ code: 'b1' }, g('brands/b1')), P1 = () => Object.assign({ id: 'p1' }, g('fb_accounts/p1'));
await stepNickAdspower(B1(), P1());
check('R-1: bỏ H1..H6 (đã chăm/booked/lost/chốt/đã phản hồi/đã liên hệ) → lead đầu tiên vào phễu là H7 (assignee mặc định KHÔNG chặn)', g('outreach_threads/H7') && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].every(h => !g('outreach_threads/' + h)), JSON.stringify([...store.keys()].filter(k => k.startsWith('outreach_threads/'))));
reset(); brandOn('b1', { skipAssigned: true }); nick('p1'); lead('H7', { detected_at: now - 7, assignee: 'sales@x' }); lead('H8', { detected_at: now - 8 });
await stepNickAdspower(B1(), P1());
check('R-1: brand.outreach.skipAssigned → H7 (đã giao) bị bỏ, H8 vào phễu', !g('outreach_threads/H7') && g('outreach_threads/H8'));

// E-4: reserve lại khi thread reserve ngày khác
reset(); brandOn('b1'); nick('p1'); thread('T1', { reservedDay: YEST(), doneSteps: ['react', 'comment'] });
ok = await stepNickAdspower(B1(), P1());
check('E-4: thread reserve HÔM QUA, còn friend+inbox → reserve lại 2 bước (usage friend 1 / inbox 1, react/comment KHÔNG) + task queued + reservedDay hôm nay', ok === true && (() => { const u = g('outreach_usage/p1__' + DAY()) || {}; const t = g('outreach_threads/T1'); const k = g('outreach_tasks/T1__funnel'); return u.friend === 1 && u.inbox === 1 && !u.react && !u.comment && t.reservedDay === DAY() && k && k.status === 'queued' && k.pid === 'p1'; })(), JSON.stringify(g('outreach_usage/p1__' + DAY())));
reset(); brandOn('b1'); nick('p1'); thread('T1', { reservedDay: DAY(), doneSteps: ['react'] });
ok = await stepNickAdspower(B1(), P1());
check('E-4: thread reserve HÔM NAY → KHÔNG tryConsume lại (không có usage doc), task queued', ok === true && !g('outreach_usage/p1__' + DAY()) && g('outreach_tasks/T1__funnel') && g('outreach_tasks/T1__funnel').status === 'queued');
reset(); brandOn('b1'); nick('p1'); thread('T1', { reservedDay: YEST(), doneSteps: ['react', 'comment'] }); usage('p1', { friend: 10 }); lead('L9');
t0 = Date.now(); ok = await stepNickAdspower(B1(), P1());
check('E-4: hết van friend (10/10) → thread hẹn SÁNG MAI (8:00–8:40 VN), KHÔNG task, nick vẫn mở lead mới L9 trong cùng lượt', (() => { const t = g('outreach_threads/T1'); const d = new Date(t.nextAt + 7 * 3600e3); return !g('outreach_tasks/T1__funnel') && t.nextAt > t0 + 3600e3 && d.getUTCHours() === 8 && d.getUTCMinutes() <= 40 && t.active === true && g('outreach_threads/L9') && ok === true; })(), JSON.stringify({ nextAt: g('outreach_threads/T1').nextAt, L9: !!g('outreach_threads/L9') }));
reset(); brandOn('b1'); nick('p1'); thread('T1', { reservedDay: YEST(), doneSteps: ['react', 'comment'] }); usage('p1', { friend: 2, inbox: 8 });
await stepNickAdspower(B1(), P1());
check('E-4/E-5: friend lấy được, inbox 8/8 hết → TRẢ LẠI friend (2 → 3 → 2), không âm, chờ mai', (() => { const u = g('outreach_usage/p1__' + DAY()); return u.friend === 2 && u.inbox === 8 && !g('outreach_tasks/T1__funnel'); })(), JSON.stringify(g('outreach_usage/p1__' + DAY())));
reset(); brandOn('b1'); nick('p1'); thread('T1', { reservedDay: 'moved', doneSteps: ['react'], pid: 'p1', movedFrom: 'pD' });
await stepNickAdspower(B1(), P1());
check('E-4: thread vừa CHUYỂN nick (reservedDay "moved") → nick mới reserve lại comment+friend+inbox', (() => { const u = g('outreach_usage/p1__' + DAY()) || {}; return !u.react && u.comment === 1 && u.friend === 1 && u.inbox === 1 && g('outreach_tasks/T1__funnel') && g('outreach_tasks/T1__funnel').pid === 'p1'; })(), JSON.stringify(g('outreach_usage/p1__' + DAY())));

// E-7: task đang running → không đè
reset(); brandOn('b1'); nick('p1'); thread('T2', { reservedDay: DAY() }); store.set('outreach_tasks/T2__funnel', { status: 'running', pid: 'p1', payload: {} }); lead('L9');
t0 = Date.now(); ok = await stepNickAdspower(B1(), P1());
check('E-7: task running → giữ nguyên status running, thread nextAt +30′, return false (không mở lead mới lượt này)', g('outreach_tasks/T2__funnel').status === 'running' && g('outreach_threads/T2').nextAt >= t0 + 29 * 60000 && ok === false && !g('outreach_threads/L9'));

// thread cũ per-step (không fpayload) → active:false như cũ
reset(); brandOn('b1'); nick('p1'); thread('T3', { fpayload: null, step: 'react' }); lead('L9');
await stepNickAdspower(B1(), P1());
check('thread cũ per-step (không fpayload) → active:false rồi nick mở lead mới (hành vi cũ)', g('outreach_threads/T3').active === false && g('outreach_threads/L9'));

// R-6 sweeper
reset(); brandOn('b1'); brandOn('b2'); nick('p1'); nick('pD', { active: false, safetyPaused: true }); nick('pN', { needLogin: true }); nick('q1', { brand: 'b2', active: false });
const H = 3600e3; t0 = Date.now();
thread('S1', { pid: 'pD', createdAt: t0 - 5 * H, nextAt: t0 - 4 * H, reservedDay: DAY(), doneSteps: ['react'] }); store.set('outreach_tasks/S1__funnel', { status: 'queued', pid: 'pD', payload: {} }); usage('pD', { react: 3, comment: 3, friend: 3, inbox: 3 });
thread('S2', { pid: 'pN', createdAt: t0 - H, nextAt: t0 - 0.5 * H });
thread('S3', { pid: 'p1', createdAt: t0 - 80 * H, nextAt: t0 - 79 * H, reservedDay: DAY(), doneSteps: ['react', 'comment'] }); store.set('outreach_tasks/S3__funnel', { status: 'queued', pid: 'p1', payload: {} }); usage('p1', { react: 1, comment: 1, friend: 0, inbox: 1 });
thread('S4', { pid: 'q1', brand: 'b2', brandCode: 'b2', createdAt: t0 - 5 * H, nextAt: t0 - 4 * H });
thread('S5', { pid: 'q1', brand: 'b3', brandCode: 'b3', createdAt: t0 - 100 * H, nextAt: t0 - 99 * H });
thread('S6', { pid: 'p1', createdAt: t0 - 5 * H, nextAt: t0 - 4 * H });
const errs = []; const cl = console.log; console.log = (...a) => { errs.push(a.join(' ')); };
await outreachTick(); console.log = cl;
check('R-6: S1 (nick pD tắt, kẹt 4h) → CHUYỂN sang p1: pid p1, movedFrom pD, taskStatus moved, reservedDay "moved", task cũ queued → cancelled', (() => { const t = g('outreach_threads/S1'); const k = g('outreach_tasks/S1__funnel'); return t.pid === 'p1' && t.movedFrom === 'pD' && t.taskStatus === 'moved' && t.reservedDay === 'moved' && t.active === true && k.status === 'cancelled'; })(), JSON.stringify(g('outreach_threads/S1')).slice(0, 200));
check('R-6/E-5: van nick cũ pD hoàn 3 bước chưa làm (comment/friend/inbox 3 → 2), react đã làm giữ 3', (() => { const u = g('outreach_usage/pD__' + DAY()); return u.react === 3 && u.comment === 2 && u.friend === 2 && u.inbox === 2; })(), JSON.stringify(g('outreach_usage/pD__' + DAY())));
check('R-6: S2 (needLogin nhưng mới kẹt 0,5h) → KHÔNG đụng', g('outreach_threads/S2').pid === 'pN' && g('outreach_threads/S2').taskStatus === 'queued');
check('R-6: S3 quá 72h → đóng (active:false, step expired), task cancelled, hoàn van friend/inbox (react/comment đã làm giữ), friend 0 KHÔNG âm', (() => { const t = g('outreach_threads/S3'); const u = g('outreach_usage/p1__' + DAY()); return t.active === false && t.step === 'expired' && g('outreach_tasks/S3__funnel').status === 'cancelled' && u.react === 1 && u.comment === 1 && u.friend === 0 && u.inbox === 0; })(), JSON.stringify(g('outreach_usage/p1__' + DAY())));
check('R-6: S4 brand b2 BẬT nhưng 0 nick sống → orphanAt ghi, vẫn active (chờ nick)', g('outreach_threads/S4').orphanAt > 0 && g('outreach_threads/S4').active === true && g('outreach_threads/S4').pid === 'q1');
check('R-6: S5 brand b3 TẮT → không đụng dù 100h', g('outreach_threads/S5').active === true && !g('outreach_threads/S5').orphanAt);
check('R-6: S6 nick p1 sống → không đụng', g('outreach_threads/S6').pid === 'p1' && !g('outreach_threads/S6').movedAt);
check('R-6: log 🔀 chuyển nick (sched) + ⏳ đóng 72h (skip)', logs.some(l => /🔀 Chuyển phễu/.test(l.action) && l.status === 'sched' && l.pid === 'p1') && logs.some(l => /⏳ Đóng phễu/.test(l.action) && l.status === 'skip' && l.leadId === 'S3'), logs.map(l => l.action).join(' | '));
check('R-6: system_status/outreach: moved 1 · closed 1 · orphan 1 · b2 nicksAlive 0/1', (() => { const s = g('system_status/outreach'); return s && s.moved === 1 && s.closed === 1 && s.orphan === 1 && s.brands.b2 && s.brands.b2.nicksAlive === 0 && s.brands.b2.nicksTotal === 1 && s.brands.b1.nicksAlive === 1; })(), JSON.stringify(g('system_status/outreach') || {}).slice(0, 260));
check('R-6: console ERROR JSON [OUTREACH-NO-NICK] brand b2 (lần đầu rơi về 0)', errs.some(e => { try { const j = JSON.parse(e); return j.severity === 'ERROR' && /OUTREACH-NO-NICK\] brand b2/.test(j.message); } catch (_) { return false; } }), errs.join(' || ').slice(0, 200));
// sweep throttle 25′ + lần 2 → WARNING (không ERROR lặp)
errs.length = 0; console.log = (...a) => { errs.push(a.join(' ')); }; await outreachTick(); console.log = cl;
check('R-6: tick kế trong 25′ → sweeper KHÔNG chạy lại (không log mới)', !errs.some(e => /OUTREACH-NO-NICK/.test(e)));
store.set('system_status/outreach', Object.assign({}, g('system_status/outreach'), { at: Date.now() - 30 * 60000 })); errs.length = 0; console.log = (...a) => { errs.push(a.join(' ')); }; await outreachTick(); console.log = cl;
check('R-6: sau 30′ sweeper chạy lại, b2 vẫn 0 nick → WARNING (không ERROR lặp)', errs.some(e => { try { const j = JSON.parse(e); return j.severity === 'WARNING' && /brand b2/.test(j.message); } catch (_) { return false; } }) && !errs.some(e => /"ERROR"/.test(e)), errs.join(' || ').slice(0, 160));
// nick mới sống ở b2 → thread mồ côi S4 được chuyển
nick('q2', { brand: 'b2' }); store.set('system_status/outreach', Object.assign({}, g('system_status/outreach'), { at: Date.now() - 30 * 60000 })); console.log = () => {}; await outreachTick(); console.log = cl;
check('R-6: b2 có nick q2 sống → S4 mồ côi được chuyển sang q2', g('outreach_threads/S4').pid === 'q2' && g('outreach_threads/S4').movedFrom === 'q1');

// stats.js: humanTookOver + stopMachine
const H0 = { brand: 'b1', stage: 'new', temp: 'hot' };
check('humanTookOver: tạo mới (before null) → ""', humanTookOver(null, H0) === '');
check('humanTookOver: first_care_at xuất hiện → "sales đã chăm lead"', humanTookOver(H0, Object.assign({}, H0, { first_care_at: 1 })) === 'sales đã chăm lead');
check('humanTookOver: stage → booked → "đổi giai đoạn → booked"', humanTookOver(H0, Object.assign({}, H0, { stage: 'booked' })) === 'đổi giai đoạn → booked');
check('humanTookOver: stage responded KÈM outreach_replied (funcWebhook/worker) → "" (máy, không phải người)', humanTookOver(H0, Object.assign({}, H0, { stage: 'responded', outreach_replied: true, outreach_replied_at: 1 })) === '');
check('humanTookOver: stage responded KHÔNG outreach_replied (sales tự đổi) → người thật', humanTookOver(H0, Object.assign({}, H0, { stage: 'responded' })) !== '');
check('humanTookOver: lost / closed_at / dropped / last_touch_at', humanTookOver(H0, Object.assign({}, H0, { lost: true })) === 'không thành' && humanTookOver(H0, Object.assign({}, H0, { closed_at: 5 })) === 'đã chốt' && humanTookOver(H0, Object.assign({}, H0, { dropped: true })) === 'đã loại' && humanTookOver(H0, Object.assign({}, H0, { last_touch_at: 9 })) === 'sales vừa liên hệ');
check('humanTookOver: máy ghi leads.outreach (stampLead) → ""', humanTookOver(H0, Object.assign({}, H0, { outreach: { steps: ['react'], last: 'react' } })) === '');
check('humanTookOver: stage cũ booked → mới closed (đã có người) vẫn báo (thread nếu còn active thì tắt)', humanTookOver(Object.assign({}, H0, { stage: 'booked' }), Object.assign({}, H0, { stage: 'closed' })) !== '');
const ev = (id, before, after) => ({ params: { id }, data: { before: { exists: !!before, data: () => before }, after: { exists: true, id, data: () => after } } });
reset(); thread('T9', { reservedDay: DAY(), doneSteps: ['react'] }); store.set('outreach_tasks/T9__funnel', { status: 'queued', pid: 'p1', payload: {} }); usage('p1', { react: 1, comment: 1, friend: 0, inbox: 1 });
await statsOnLead(ev('T9', H0, Object.assign({}, H0, { first_care_at: Date.now() })));
check('stopMachine: người thật chăm T9 → thread active:false step human, task queued → cancelled, hoàn van comment/inbox (friend 0 không âm), log 🙋 skip', (() => { const t = g('outreach_threads/T9'); const u = g('outreach_usage/p1__' + DAY()); return t.active === false && t.step === 'human' && t.taskStatus === 'cancelled' && g('outreach_tasks/T9__funnel').status === 'cancelled' && u.react === 1 && u.comment === 0 && u.friend === 0 && u.inbox === 0 && logs.some(l => /🙋/.test(l.action) && l.status === 'skip' && l.leadId === 'T9'); })(), JSON.stringify(g('outreach_threads/T9')).slice(0, 160) + ' ' + JSON.stringify(g('outreach_usage/p1__' + DAY())));
check('stopMachine: daily_stats vẫn đếm contacted (không phá thống kê)', g('daily_stats/b1__' + DAY()) && g('daily_stats/b1__' + DAY()).contacted === 1);
reset(); thread('T9', { reservedDay: YEST() }); store.set('outreach_tasks/T9__funnel', { status: 'running', pid: 'p1', payload: {} }); usage('p1', { react: 1 });
await statsOnLead(ev('T9', H0, Object.assign({}, H0, { stage: 'booked' })));
check('stopMachine: task đang RUNNING → không đụng task, thread vẫn tắt; reserve hôm qua → KHÔNG hoàn van hôm nay', g('outreach_threads/T9').active === false && g('outreach_tasks/T9__funnel').status === 'running' && g('outreach_usage/p1__' + DAY()).react === 1);
reset(); thread('T9', { active: false, step: 'done' });
await statsOnLead(ev('T9', H0, Object.assign({}, H0, { stage: 'booked' })));
check('stopMachine: thread đã inactive → no-op (không log)', g('outreach_threads/T9').step === 'done' && !logs.length);
reset(); thread('T9', {});
await statsOnLead(ev('T9', H0, Object.assign({}, H0, { stage: 'responded', outreach_replied: true, outreach_replied_at: 1 })));
check('stopMachine: máy phát hiện phản hồi (outreach_replied) → KHÔNG đụng thread (thread vẫn active — funcWebhook/worker tự tắt)', g('outreach_threads/T9').active === true && !logs.length);
reset(); await statsOnLead(ev('NEW1', null, Object.assign({}, H0, { detected_at: Date.now(), score: 90 })));
check('statsOnLead: tạo lead mới → không stopMachine, daily_stats new 1', g('daily_stats/b1__' + DAY()) && g('daily_stats/b1__' + DAY()).new === 1 && !logs.length);

console.log(`\n${pass}/${total} PASS`); if (pass !== total) process.exit(1);
