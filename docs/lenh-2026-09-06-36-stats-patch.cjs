/* LỆNH #36 (06/09/2026) — stats.js: + counter HIỆU QUẢ NỘI DUNG `content_stats/{brand}` (card "📈 Hiệu quả nội dung" ở Content Studio chính xác mọi quy mô,
   không phụ thuộc cửa sổ lead đã nạp trên máy). Nguồn: dấu vết `leads.outreach.content` (meta do genForLead/LỆNH #34 đóng dấu, worker 2026-09-06c ghi) +
   `outreach.inbox_at` + phản hồi (outreach_replied / outreach.replied_at / stage responded|booked|closed). Cùng trigger statsOnLead (onDocumentWritten leads/{id}).
   Patch content-anchored, fail-closed (thiếu mốc → không ghi), idempotent (marker LENH #36). Dùng: node _l36_stats.cjs [stats.js] */
const fs = require('fs'); const F = process.argv[2] || 'stats.js'; let s = fs.readFileSync(F, 'utf8');
if (s.includes('LENH #36')) { console.log('stats.js: ĐÃ patch (idempotent) — bỏ qua'); process.exit(0); }
const A1 = "const RESP = new Set(['responded', 'booked', 'closed']), BOOK = new Set(['booked', 'closed']);";
const A2 = "  const evs = statsEvents(before, after, Date.now()); if (!evs.length) return;";
const A3 = "    return db.collection('daily_stats').doc(brand + '__' + day).set(patch, { merge: true }); }));";
for (const [i, a] of [A1, A2, A3].entries()) { const n = s.split(a).length - 1; if (n !== 1) { console.error('KHONG THAY MOC A' + (i + 1) + ' (đếm ' + n + '): ' + a.slice(0, 80)); process.exit(1); } }
const helpers = A1 + `
/* LENH #36 (06/09/2026) — HIỆU QUẢ NỘI DUNG: counter cộng dồn content_stats/{brand} = { brandCode, atMs, all:{sent,rep,tagged}, <dim>:{<khoá>:{sent,rep}} }
   dim = mode/style/parent/cta/variant (khớp CS_META_VI ở FE 45-outreach). Khoá làm sạch: variant → v0..v5 (vx = -1/không xoay), rỗng → none, ký tự lạ → _.
   sent = lead có outreach.inbox_at (đếm lần đầu xuất hiện) · rep = lead ĐÃ inbox rồi có phản hồi (đếm 1 lần) · tagged = lead có content meta (lần đầu).
   Hàm thuần (không I/O) → backfill (_cs_backfill.mjs, before=null) dùng chung. FE: csEffFromCounters đổi ngược khoá → nhãn. */
const C_DIMS = ['mode', 'style', 'parent', 'cta', 'variant'];
export const contentKey = (dim, v) => { if (dim === 'variant') { const n = Number(v); return Number.isFinite(n) && n >= 0 ? 'v' + Math.min(9, Math.floor(n)) : 'vx'; } const k = String(v == null ? '' : v).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 24); return k || 'none'; };
const isRep = l => !!(l && (l.outreach_replied || (l.outreach && l.outreach.replied_at) || RESP.has(String(l.stage || ''))));
export function contentEvents(before, after) {
  const b = before || {}; const ao = (after && after.outreach) || {}; const bo = b.outreach || {};
  const meta = ao.content; if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const inc = {};
  if (!(bo.content && typeof bo.content === 'object' && !Array.isArray(bo.content))) inc.tagged = 1;
  const sentNow = !!ao.inbox_at, sentBefore = !!bo.inbox_at;
  if (sentNow && !sentBefore) inc.sent = 1;
  if (sentNow && isRep(after) && !(sentBefore && isRep(b))) inc.rep = 1;
  return Object.keys(inc).length ? { inc, meta } : null;
}
export function contentPatch(brand, ev) {
  const p = { brandCode: brand, atMs: Date.now(), all: {} };
  Object.keys(ev.inc).forEach(k => { p.all[k] = FieldValue.increment(ev.inc[k]); });
  C_DIMS.forEach(d => { const o = {}; ['sent', 'rep'].forEach(f => { if (ev.inc[f]) o[f] = FieldValue.increment(ev.inc[f]); }); if (Object.keys(o).length) p[d] = { [contentKey(d, ev.meta[d])]: o }; });
  return p;
}`;
s = s.replace(A1, () => helpers);
s = s.replace(A2, () => "  const evs = statsEvents(before, after, Date.now()); const cev = contentEvents(before, after); if (!evs.length && !cev) return; // LENH #36: + hiệu quả nội dung");
s = s.replace(A3, () => A3 + "\n  if (cev) await db.collection('content_stats').doc(brand).set(contentPatch(brand, cev), { merge: true }); // LENH #36: set-merge + increment lồng → an toàn ghi đồng thời");
fs.writeFileSync(F, s); console.log('PATCH OK stats.js (LENH #36: contentKey/contentEvents/contentPatch + content_stats)');
