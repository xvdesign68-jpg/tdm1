/* _scanstats_backfill.mjs — dựng counter scanned/scannedComments/scanRuns theo brand/ngày từ nhật ký `scans` (đặt trong ~/firebase-s13/functions, chạy sau khi deploy scanStatsOnRun).
   Cách dùng: node _scanstats_backfill.mjs [--dry] [--from=2026-08-01] [--deployed=<ISO giờ CF bắt đầu active>]
   - Ngày < hôm nay (VN): ghi TUYỆT ĐỐI (set merge) → chạy lại bao nhiêu lần cũng ra cùng số.
   - Hôm nay: chỉ cộng các lượt có at < --deployed (trigger đã đếm phần sau mốc đó) bằng increment → không đếm đôi. Không truyền --deployed → bỏ qua hôm nay. */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { scanEvents, brandMapOf, vnDay, toMs } from './scanstats.js';
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : ''; };
const DRY = process.argv.includes('--dry'), FROM = arg('from') || '2026-08-01', DEPLOYED = arg('deployed') ? Date.parse(arg('deployed')) : 0;
if (!getApps().length) initializeApp(); const db = getFirestore();
const today = vnDay(Date.now());
const srcSnap = await db.collection('sources').get(); const brandMap = brandMapOf(srcSnap.docs.map(d => d.data()));
console.log('sources:', srcSnap.size, '| có brand+url:', brandMap.size, '| từ ngày', FROM, '| hôm nay VN', today, '| deployed', DEPLOYED ? new Date(DEPLOYED).toISOString() : '(bỏ qua hôm nay)', DRY ? '| DRY' : '');
const agg = {}, todayAgg = {}; let n = 0, noBrand = 0, last = null, mismatch = 0;
const fromMs = Date.parse(FROM + 'T00:00:00+07:00');
let q = db.collection('scans').where('at', '>=', new Date(fromMs)).orderBy('at').limit(500);
for (;;) { const s = await (last ? q.startAfter(last).get() : q.get()); if (s.empty) break;
  s.forEach(d => { const sc = d.data(); n++; const evs = scanEvents(sc, brandMap); if (!evs.length) { noBrand++; }
    const sumRows = (Array.isArray(sc.bySource) ? sc.bySource : []).reduce((a, r) => a + (Number(r && r.posts) || 0), 0); if (Number(sc.postsFetched) && sumRows !== Number(sc.postsFetched)) mismatch++;
    const at = toMs(sc.at); const isToday = vnDay(at) === today;
    evs.forEach(e => { if (isToday) { if (DEPLOYED && at < DEPLOYED) { const o = todayAgg[e.brand] || (todayAgg[e.brand] = { scanned: 0, scannedComments: 0, scanRuns: 0 }); Object.keys(e.inc).forEach(k => o[k] += e.inc[k]); } return; }
      const k = e.brand + '__' + e.day; const o = agg[k] || (agg[k] = { brandCode: e.brand, day: e.day, scanned: 0, scannedComments: 0, scanRuns: 0 }); Object.keys(e.inc).forEach(f => o[f] += e.inc[f]); }); });
  last = s.docs[s.docs.length - 1]; if (s.size < 500) break; }
const keys = Object.keys(agg).sort(); console.log('lượt quét đọc:', n, '| không khớp brand nào:', noBrand, '| Σposts≠postsFetched:', mismatch, '| doc ngày<hôm nay:', keys.length, '| brand hôm nay (trước deploy):', Object.keys(todayAgg).length);
keys.slice(-6).forEach(k => console.log(' ', k, JSON.stringify(agg[k])));
Object.keys(todayAgg).forEach(b => console.log('  hôm nay', b, JSON.stringify(todayAgg[b])));
if (DRY) { console.log('DRY — không ghi'); process.exit(0); }
let w = 0; let batch = db.batch(); const flush = async () => { await batch.commit(); batch = db.batch(); };
for (const k of keys) { batch.set(db.collection('daily_stats').doc(k), Object.assign({ scanAtMs: Date.now() }, agg[k]), { merge: true }); if (++w % 400 === 0) await flush(); }
for (const b of Object.keys(todayAgg)) { const p = { brandCode: b, day: today, scanAtMs: Date.now() }; Object.keys(todayAgg[b]).forEach(f => { if (todayAgg[b][f]) p[f] = FieldValue.increment(todayAgg[b][f]); }); batch.set(db.collection('daily_stats').doc(b + '__' + today), p, { merge: true }); w++; }
await flush(); console.log('ĐÃ GHI', w, 'doc daily_stats (scanned/scannedComments/scanRuns)');
