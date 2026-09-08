/* scanstats.js — v119-78 (08/09/2026): counter "bài đã quét" THEO BRAND cho user brand (họ không đọc được nhật ký `scans`).
   Trigger onDocumentCreated scans/{id} → đọc bySource[] của lượt quét → nguồn → brand (sources.url → sources.brand)
   → FieldValue.increment lên daily_stats/{brand}__{YYYY-MM-DD giờ VN}: scanned (bài lấy về), scannedComments (bình luận), scanRuns (lượt có chạm brand).
   Khởi tạo Admin SDK LƯỜI trong handler (bài học LỆNH #10). Hàm thuần scanEvents() dùng chung cho trigger + backfill + harness. */
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const REGION = 'asia-southeast1', OFF = 7 * 3600e3;
export const vnDay = ms => new Date((Number(ms) || Date.now()) + OFF).toISOString().slice(0, 10);
export const toMs = v => { if (!v) return 0; if (typeof v === 'number') return v; if (typeof v.toMillis === 'function') return v.toMillis(); if (v.seconds) return v.seconds * 1000; const d = new Date(v); return isNaN(d) ? 0 : d.getTime(); };
/* Chuẩn hoá URL nguồn để so khớp (bỏ scheme/www/query/dấu / cuối, thường hoá) */
export const normUrl = u => String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^m\.facebook\.com/, 'facebook.com').replace(/[?#].*$/, '').replace(/\/+$/, '');
export function brandMapOf(sourcesDocs) { const m = new Map(); (sourcesDocs || []).forEach(s => { const u = normUrl(s.url); const b = String(s.brand || '').trim(); if (u && b) m.set(u, b); }); return m; }
/* Sự kiện đếm của 1 lượt quét → [{brand, day, inc}]. Thuần (không I/O). posts = bài lấy về của nguồn trong lượt (khớp postsFetched cấp lượt);
   thiếu posts mà có bdPosts → dùng bdPosts. scanRuns +1 khi lượt có chạm brand (gọi BrightData ok hoặc có bài). */
export function scanEvents(scan, brandMap) {
  const at = toMs(scan && scan.at) || Date.now(); const day = vnDay(at);
  const bs = scan && scan.bySource; const rows = Array.isArray(bs) ? bs : (bs && typeof bs === 'object' ? Object.values(bs) : []);
  const agg = {};
  for (const r of rows) { if (!r || typeof r !== 'object') continue; const brand = brandMap.get(normUrl(r.url)); if (!brand) continue;
    const posts = Number(r.posts) || Number(r.bdPosts) || 0, cm = Number(r.bdComments) || 0;
    const o = agg[brand] || (agg[brand] = { scanned: 0, scannedComments: 0, touched: false });
    o.scanned += posts; o.scannedComments += cm; if (posts > 0 || r.bd === 'ok') o.touched = true; }
  return Object.keys(agg).map(b => ({ brand: b, day, inc: { scanned: agg[b].scanned, scannedComments: agg[b].scannedComments, scanRuns: agg[b].touched ? 1 : 0 } }))
    .filter(e => e.inc.scanned || e.inc.scannedComments || e.inc.scanRuns);
}
export const scanStatsOnRun = onDocumentCreated({ document: 'scans/{id}', region: REGION, memory: '256MiB', maxInstances: 5 }, async (ev) => {
  const scan = ev.data && ev.data.exists ? ev.data.data() : null; if (!scan) return;
  if (!getApps().length) initializeApp(); const db = getFirestore();
  const srcSnap = await db.collection('sources').get(); const brandMap = brandMapOf(srcSnap.docs.map(d => d.data()));
  const evs = scanEvents(scan, brandMap); if (!evs.length) return;
  await Promise.all(evs.map(e => { const patch = { brandCode: e.brand, day: e.day, scanAtMs: Date.now() }; Object.keys(e.inc).forEach(k => { if (e.inc[k]) patch[k] = FieldValue.increment(e.inc[k]); });
    return db.collection('daily_stats').doc(e.brand + '__' + e.day).set(patch, { merge: true }); }));
});
