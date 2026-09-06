/* LỆNH #36 (b) = LỆNH #16 (b): gắn expireAt = at + 60 ngày cho outreach_log CŨ (trước bản S3 không có expireAt → TTL policy không xoá). Batch 400, chỉ đọc-ghi field expireAt. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const DAY = 864e5; let scanned = 0, fixed = 0, last = null;
for (;;) {
  let q = db.collection('outreach_log').orderBy('__name__').limit(400); if (last) q = q.startAfter(last);
  const snap = await q.get(); if (snap.empty) break;
  const batch = db.batch(); let inBatch = 0;
  snap.docs.forEach(d => { scanned++; const x = d.data() || {}; if (x.expireAt) return;
    const atMs = x.at && x.at.toMillis ? x.at.toMillis() : (Number(x.at) || Date.now());
    batch.update(d.ref, { expireAt: Timestamp.fromMillis(atMs + 60 * DAY) }); inBatch++; fixed++; });
  if (inBatch) await batch.commit(); last = snap.docs[snap.docs.length - 1]; if (snap.size < 400) break;
}
console.log('outreach_log: quét', scanned, 'doc | gắn expireAt cho', fixed, 'doc cũ (log cũ hơn 60 ngày sẽ được Firestore TTL tự xoá trong ~24h)');
