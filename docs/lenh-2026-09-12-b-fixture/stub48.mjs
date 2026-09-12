/* stub48.mjs — Firestore/Functions giả lập cho harness LỆNH #48: batch (set/create/update/delete, create → ALREADY_EXISTS code 6, không ghi dở),
   getAll, runTransaction (đọc-ghi có kiểm tranh chấp: doc đã đọc bị đổi trước commit → ABORTED, thử lại ≤5), query where/orderBy/limit, add, FieldValue. */
export const FieldValue = { serverTimestamp: () => Date.now(), increment: n => ({ __inc: n }), delete: () => ({ __del: 1 }), arrayUnion: (...v) => ({ __au: v }) };
const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
export function makeDb() {
  const store = new Map(), ver = new Map(); const log = { writes: [], deletes: [], creates: [], adds: [], txRetries: 0 }; let autoId = 0; const hooks = { beforeBatchCommit: null };
  const bump = k => ver.set(k, (ver.get(k) || 0) + 1);
  const merge = (old, patch) => { const o = Object.assign({}, old || {}); for (const [k, v] of Object.entries(patch)) { if (v && typeof v === 'object' && !Array.isArray(v) && '__inc' in v) o[k] = (Number(o[k]) || 0) + v.__inc; else if (v && typeof v === 'object' && !Array.isArray(v) && '__del' in v) delete o[k]; else if (v && typeof v === 'object' && !Array.isArray(v) && '__au' in v) o[k] = [...new Set([...(o[k] || []), ...v.__au])]; else o[k] = clone(v); } return o; };
  const key = (col, id) => col + '/' + id;
  function apply(op) { const k = key(op.col, op.id); if (op.t === 'set') { store.set(k, op.merge ? merge(store.get(k), op.data) : merge({}, op.data)); log.writes.push(k); } else if (op.t === 'create') { if (store.has(k)) { const e = new Error('6 ALREADY_EXISTS: Document already exists: ' + k); e.code = 6; throw e; } store.set(k, merge({}, op.data)); log.creates.push(k); } else if (op.t === 'update') { if (!store.has(k)) { const e = new Error('5 NOT_FOUND: ' + k); e.code = 5; throw e; } store.set(k, merge(store.get(k), op.data)); log.writes.push(k); } else if (op.t === 'delete') { store.delete(k); log.deletes.push(k); } bump(k); }
  const snap = (col, id) => { const d = store.get(key(col, id)); return { id, exists: !!d, ref: docRef(col, id), data: () => clone(d), get: f => d ? d[f] : undefined }; };
  function docRef(col, id) { return { id, path: key(col, id), __col: col, async get() { return snap(col, id); }, async set(data, opt) { apply({ t: 'set', col, id, data, merge: !!(opt && opt.merge) }); }, async create(data) { apply({ t: 'create', col, id, data }); }, async update(data) { apply({ t: 'update', col, id, data }); }, async delete() { apply({ t: 'delete', col, id }); }, collection: c => query(col + '/' + id + '/' + c) }; }
  function query(col, filters = [], order = null, lim = 0) {
    return { where: (f, op, v) => query(col, [...filters, [f, op, v]], order, lim), orderBy: (f, dir) => query(col, filters, [f, dir || 'asc'], lim), limit: n => query(col, filters, order, n), doc: id => docRef(col, id || ('auto' + (++autoId))),
      async add(obj) { const id = 'auto' + (++autoId); apply({ t: 'set', col, id, data: obj }); log.adds.push(key(col, id)); return docRef(col, id); },
      async get() { let docs = [...store.entries()].filter(([k]) => k.startsWith(col + '/') && !k.slice(col.length + 1).includes('/')).map(([k, v]) => ({ id: k.slice(col.length + 1), v }));
        docs = docs.filter(({ v }) => filters.every(([f, op, x]) => { const a = v[f]; if (op === '==') return a === x; if (op === '!=') return a !== x; if (a == null) return false; if (op === '<=') return a <= x; if (op === '>=') return a >= x; if (op === '<') return a < x; if (op === '>') return a > x; return true; }));
        if (order) { docs = docs.filter(({ v }) => v[order[0]] != null); docs.sort((p, q) => (p.v[order[0]] > q.v[order[0]] ? 1 : p.v[order[0]] < q.v[order[0]] ? -1 : 0) * (order[1] === 'desc' ? -1 : 1)); }
        if (lim) docs = docs.slice(0, lim); const out = docs.map(({ id }) => snap(col, id)); return { empty: !out.length, size: out.length, docs: out, forEach: fn => out.forEach(fn) }; } };
  }
  const db = {
    collection: c => query(c),
    async getAll(...refs) { return refs.map(r => snap(r.__col, r.id)); },
    batch() { const ops = []; return { set: (r, d, o) => ops.push({ t: 'set', col: r.__col, id: r.id, data: d, merge: !!(o && o.merge) }), create: (r, d) => ops.push({ t: 'create', col: r.__col, id: r.id, data: d }), update: (r, d) => ops.push({ t: 'update', col: r.__col, id: r.id, data: d }), delete: r => ops.push({ t: 'delete', col: r.__col, id: r.id }),
      async commit() { if (hooks.beforeBatchCommit) await hooks.beforeBatchCommit(ops); for (const op of ops) { const k = key(op.col, op.id); if (op.t === 'create' && store.has(k)) { const e = new Error('6 ALREADY_EXISTS: Document already exists: ' + k); e.code = 6; throw e; } } ops.forEach(apply); } }; },
    async runTransaction(fn) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map(), buf = [];
        const tx = { async get(r) { const k = key(r.__col, r.id); reads.set(k, ver.get(k) || 0); return snap(r.__col, r.id); }, set: (r, d, o) => buf.push({ t: 'set', col: r.__col, id: r.id, data: d, merge: !!(o && o.merge) }), update: (r, d) => buf.push({ t: 'update', col: r.__col, id: r.id, data: d }), delete: r => buf.push({ t: 'delete', col: r.__col, id: r.id }), create: (r, d) => buf.push({ t: 'create', col: r.__col, id: r.id, data: d }) };
        const out = await fn(tx);
        await new Promise(r => setTimeout(r, 0)); // nhường lượt → 2 giao dịch chồng nhau thấy nhau
        let dirty = false; for (const [k, v] of reads) if ((ver.get(k) || 0) !== v) dirty = true;
        if (dirty) { log.txRetries++; continue; }
        buf.forEach(apply); return out;
      }
      const e = new Error('10 ABORTED: transaction contention'); e.code = 10; throw e;
    }
  };
  return { db, store, log, hooks, reset: () => { store.clear(); ver.clear(); } };
}
export const getFirestore = () => (globalThis.__sl48 && globalThis.__sl48.db) || makeDb().db;
export const getApps = () => [1]; export const initializeApp = () => {}; export const applicationDefault = () => ({});
export const getAuth = () => ({ verifyIdToken: async () => { throw new Error('stub'); } });
export const onSchedule = (o, fn) => fn; export const onRequest = (o, fn) => fn; export const onDocumentCreated = (o, fn) => fn; export const onDocumentUpdated = (o, fn) => fn; export const onDocumentWritten = (o, fn) => fn;
export const setGlobalOptions = () => {};
