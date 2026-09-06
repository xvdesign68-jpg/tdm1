/* LỆNH #36 — _cs_backfill.mjs (đặt trong ~/firebase-s13/functions): ĐẾM LẠI content_stats/{brand} từ lead có dấu vết máy (leads.outreach.at > 0), ghi ĐÈ doc
   (= đối soát; chạy lại bất cứ lúc nào). Dùng contentEvents/contentKey của stats.js (before=null) → cùng định nghĩa với trigger. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { contentEvents, contentKey } from './stats.js';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' });
const db = getFirestore(); const DIMS = ['mode', 'style', 'parent', 'cta', 'variant'];
const snap = await db.collection('leads').where('outreach.at', '>', 0).get();
const by = {}; let withMeta = 0;
snap.forEach(d => { const l = d.data() || {}; const brand = String(l.brand || '').trim(); if (!brand) return; const ev = contentEvents(null, l); if (!ev) return; withMeta++;
  const o = by[brand] || (by[brand] = { brandCode: brand, atMs: Date.now(), all: { sent: 0, rep: 0, tagged: 0 } });
  ['sent', 'rep', 'tagged'].forEach(k => { o.all[k] += ev.inc[k] || 0; });
  if (ev.inc.sent) DIMS.forEach(dim => { const k = contentKey(dim, ev.meta[dim]); const m = o[dim] || (o[dim] = {}); const c = m[k] || (m[k] = { sent: 0, rep: 0 }); c.sent += 1; c.rep += ev.inc.rep || 0; }); });
for (const b of Object.keys(by).sort()) { await db.collection('content_stats').doc(b).set(by[b]); console.log('content_stats/' + b, '| all', JSON.stringify(by[b].all), '| mode', JSON.stringify(by[b].mode || {}), '| parent', JSON.stringify(by[b].parent || {})); }
console.log('quét', snap.size, 'lead có dấu vết máy →', withMeta, 'lead có meta nội dung → ghi', Object.keys(by).length, 'doc content_stats (ghi đè = đếm lại từ đầu; lead cũ trước worker 06c không có meta → không đếm)');
