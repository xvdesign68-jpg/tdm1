export const store = new Map(); export const logs = []; let autoId = 0;
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
export const getMessaging = () => ({ sendEachForMulticast: async () => ({ successCount: 0, responses: [] }) });
