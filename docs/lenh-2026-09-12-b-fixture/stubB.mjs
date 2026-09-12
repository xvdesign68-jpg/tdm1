/* stubB.mjs — Firestore/Functions/Admin giả lập cho harness LỆNH B (mở rộng stub48 LỆNH #48): set-merge DEEP (map lồng như Firestore thật), update nhận đường dẫn chấm 'a.b',
   FieldValue increment/delete/arrayUnion/arrayRemove ở mọi tầng, create → ALREADY_EXISTS (code 6), batch nguyên tử (không ghi dở), getAll, runTransaction (đọc-ghi kiểm tranh chấp → thử lại ≤5),
   query where/orderBy/limit/select/startAfter, add, forEach; getAuth.verifyIdToken cấu hình được (globalThis.__slB.verify), getMessaging.sendEachForMulticast ghi log. */
const isPlain = v => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
const isFV = v => isPlain(v) && ('__inc' in v || '__del' in v || '__au' in v || '__ar' in v);
export const FieldValue = { serverTimestamp: () => Date.now(), increment: n => ({ __inc: n }), delete: () => ({ __del: 1 }), arrayUnion: (...v) => ({ __au: v }), arrayRemove: (...v) => ({ __ar: v }) };
const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
function applyVal(old, v) { if (isFV(v)) { if ('__inc' in v) return (Number(old) || 0) + v.__inc; if ('__del' in v) return undefined; if ('__au' in v) return [...new Set([...(Array.isArray(old) ? old : []), ...v.__au])]; if ('__ar' in v) return (Array.isArray(old) ? old : []).filter(x => !v.__ar.includes(x)); } return clone(v); }
function mergeDeep(old, patch) { const o = Object.assign({}, isPlain(old) ? old : {}); for (const [k0, v] of Object.entries(patch || {})) {
    if (k0.includes('.')) { const parts = k0.split('.'); let cur = o; for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = Object.assign({}, isPlain(cur[parts[i]]) ? cur[parts[i]] : {}); cur = cur[parts[i]]; } const last = parts[parts.length - 1]; const nv = applyVal(cur[last], v); if (nv === undefined) delete cur[last]; else cur[last] = nv; continue; }
    if (isPlain(v) && !isFV(v)) { o[k0] = mergeDeep(o[k0], v); continue; }
    const nv = applyVal(o[k0], v); if (nv === undefined) delete o[k0]; else o[k0] = nv; } return o; }
function setFull(patch) { const o = {}; for (const [k, v] of Object.entries(patch || {})) { if (isPlain(v) && !isFV(v)) o[k] = setFull(v); else { const nv = applyVal(undefined, v); if (nv !== undefined) o[k] = nv; } } return o; }
export function makeDb() {
  const store = new Map(), ver = new Map(); const log = { writes: [], deletes: [], creates: [], adds: [], txRetries: 0, updates: [] }; let autoId = 0; const hooks = { beforeBatchCommit: null };
  const bump = k => ver.set(k, (ver.get(k) || 0) + 1); const key = (col, id) => col + '/' + id;
  function apply(op) { const k = key(op.col, op.id);
    if (op.t === 'set') { store.set(k, op.merge ? mergeDeep(store.get(k), op.data) : setFull(op.data)); log.writes.push(k); }
    else if (op.t === 'create') { if (store.has(k)) { const e = new Error('6 ALREADY_EXISTS: Document already exists: ' + k); e.code = 6; throw e; } store.set(k, setFull(op.data)); log.creates.push(k); }
    else if (op.t === 'update') { if (!store.has(k)) { const e = new Error('5 NOT_FOUND: ' + k); e.code = 5; throw e; } store.set(k, mergeDeep(store.get(k), op.data)); log.writes.push(k); log.updates.push(k); }
    else if (op.t === 'delete') { store.delete(k); log.deletes.push(k); } bump(k); }
  const snap = (col, id) => { const d = store.get(key(col, id)); return { id, exists: !!d, ref: docRef(col, id), data: () => clone(d), get: f => d ? d[f] : undefined }; };
  function docRef(col, id) { return { id, path: key(col, id), __col: col, async get() { return snap(col, id); }, async set(data, opt) { apply({ t: 'set', col, id, data, merge: !!(opt && opt.merge) }); }, async create(data) { apply({ t: 'create', col, id, data }); }, async update(data) { apply({ t: 'update', col, id, data }); }, async delete() { apply({ t: 'delete', col, id }); }, collection: c => query(col + '/' + id + '/' + c) }; }
  function query(col, filters = [], order = null, lim = 0, sel = null, after = null) {
    const q = { where: (f, op, v) => query(col, [...filters, [f, op, v]], order, lim, sel, after), orderBy: (f, dir) => query(col, filters, [f, dir || 'asc'], lim, sel, after), limit: n => query(col, filters, order, n, sel, after), select: (...f) => query(col, filters, order, lim, f, after), startAfter: d => query(col, filters, order, lim, sel, d), doc: id => docRef(col, id || ('auto' + (++autoId))),
      async add(obj) { const id = 'auto' + (++autoId); apply({ t: 'set', col, id, data: obj }); log.adds.push(key(col, id)); return docRef(col, id); },
      async get() { let docs = [...store.entries()].filter(([k]) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/')).map(([k, v]) => ({ id: k.slice(col.length + 1), v }));
        const cmp = (a, x) => (a instanceof Date ? a.getTime() : a) - (x instanceof Date ? x.getTime() : x);
        docs = docs.filter(({ v }) => filters.every(([f, op, x]) => { const a = v[f]; if (op === '==') return a === x; if (op === '!=') return a !== x; if (op === 'in') return Array.isArray(x) && x.includes(a); if (a == null) return false; if (op === '<=') return cmp(a, x) <= 0; if (op === '>=') return cmp(a, x) >= 0; if (op === '<') return cmp(a, x) < 0; if (op === '>') return cmp(a, x) > 0; return true; }));
        if (order) { docs = docs.filter(({ v }) => v[order[0]] != null); docs.sort((p, q2) => (p.v[order[0]] > q2.v[order[0]] ? 1 : p.v[order[0]] < q2.v[order[0]] ? -1 : 0) * (order[1] === 'desc' ? -1 : 1)); }
        if (after && order) { const i = docs.findIndex(d => d.id === after.id); if (i >= 0) docs = docs.slice(i + 1); }
        if (lim) docs = docs.slice(0, lim); const out = docs.map(({ id }) => snap(col, id)); return { empty: !out.length, size: out.length, docs: out, forEach: fn => out.forEach(fn) }; } };
    return q;
  }
  const db = {
    collection: c => query(c), doc: p => { const i = p.lastIndexOf('/'); return docRef(p.slice(0, i), p.slice(i + 1)); },
    async getAll(...refs) { return refs.map(r => snap(r.__col, r.id)); },
    batch() { const ops = []; return { set: (r, d, o) => ops.push({ t: 'set', col: r.__col, id: r.id, data: d, merge: !!(o && o.merge) }), create: (r, d) => ops.push({ t: 'create', col: r.__col, id: r.id, data: d }), update: (r, d) => ops.push({ t: 'update', col: r.__col, id: r.id, data: d }), delete: r => ops.push({ t: 'delete', col: r.__col, id: r.id }),
      async commit() { if (hooks.beforeBatchCommit) await hooks.beforeBatchCommit(ops); const seen = new Set(); for (const op of ops) { const k = key(op.col, op.id); if (seen.has(k)) { const e = new Error('3 INVALID_ARGUMENT: cannot write the same document more than once in a batch: ' + k); e.code = 3; throw e; } seen.add(k); if (op.t === 'create' && store.has(k)) { const e = new Error('6 ALREADY_EXISTS: Document already exists: ' + k); e.code = 6; throw e; } } ops.forEach(apply); } }; },
    async runTransaction(fn) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map(), buf = [];
        const tx = { async get(r) { const k = key(r.__col, r.id); reads.set(k, ver.get(k) || 0); return snap(r.__col, r.id); }, set: (r, d, o) => buf.push({ t: 'set', col: r.__col, id: r.id, data: d, merge: !!(o && o.merge) }), update: (r, d) => buf.push({ t: 'update', col: r.__col, id: r.id, data: d }), delete: r => buf.push({ t: 'delete', col: r.__col, id: r.id }), create: (r, d) => buf.push({ t: 'create', col: r.__col, id: r.id, data: d }) };
        const out = await fn(tx);
        await new Promise(r => setTimeout(r, 0));
        let dirty = false; for (const [k, v] of reads) if ((ver.get(k) || 0) !== v) dirty = true;
        if (dirty) { log.txRetries++; continue; }
        buf.forEach(apply); return out;
      }
      const e = new Error('10 ABORTED: transaction contention'); e.code = 10; throw e;
    }
  };
  return { db, store, log, hooks, reset: () => { store.clear(); ver.clear(); } };
}
let __def = null; const __cur = () => (globalThis.__slB && globalThis.__slB.db) || (globalThis.__sl48 && globalThis.__sl48.db) || (__def || (__def = makeDb().db));
/* Proxy: mã thật cache db 1 lần (scraper __fsdb, outreach _db) → luôn trỏ tới db hiện hành của harness (mỗi kịch bản 1 db mới) */
export const getFirestore = () => new Proxy({}, { get: (_, k) => { const d = __cur(); const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; } });
export const getApps = () => [1]; export const initializeApp = () => {}; export const applicationDefault = () => ({});
export const getAuth = () => ({ verifyIdToken: async (t) => { const v = globalThis.__slB && globalThis.__slB.verify; if (v) return v(t); throw new Error('stub: no verify'); }, updateUser: async () => ({}) });
export const pushLog = []; export const getMessaging = () => ({ sendEachForMulticast: async (m) => { pushLog.push(m); return { successCount: (m.tokens || []).length, responses: (m.tokens || []).map(() => ({ success: true })) }; } });
export const onSchedule = (o, fn) => fn; export const onRequest = (o, fn) => fn; export const onDocumentCreated = (o, fn) => fn; export const onDocumentUpdated = (o, fn) => fn; export const onDocumentWritten = (o, fn) => fn;
export const setGlobalOptions = () => {};
export const genForLead = async () => ({ comment: 'c', inbox: 'i', mode: 'ai', meta: { v: 34 } });
export const SecretManagerServiceClient = class { async accessSecretVersion() { return [{ payload: { data: Buffer.from('tok') } }]; } };
