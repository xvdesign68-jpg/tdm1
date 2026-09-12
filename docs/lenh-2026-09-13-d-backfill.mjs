/* LỆNH D (13/09/2026) — backfill expireAt cho doc CŨ (TTL policy chỉ xoá doc có field): scans.expireAt = at + SCANS_TTL_DAYS (90) · seen.expireAt = at + SEEN_TTL_DAYS (180).
   Đọc theo TRANG 400 (orderBy __name__, select expireAt/at) → chỉ ghi doc THIẾU expireAt (idempotent; chạy lại = 0 ghi). scans ~12–14 k doc, seen ~55 k doc → vài phút. In tiến độ mỗi 20 trang.
   Doc quá hạn (at cũ hơn TTL) vẫn gắn expireAt (đã qua) → Firestore TTL tự xoá trong ~24 h. --dry = chỉ đếm. Đặt trong ~/firebase-s13/functions. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const DRY = process.argv.includes('--dry'); const DAY = 864e5; const now = Date.now();
const env = process.env; const SCANS_D = Math.max(1, Number(env.SCANS_TTL_DAYS) || 90), SEEN_D = Math.max(1, Number(env.SEEN_TTL_DAYS) || 180);
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
async function fill(coll, days) {
  let scanned = 0, fixed = 0, pages = 0, past = 0, last = null;
  for (;;) {
    let q = db.collection(coll).orderBy('__name__').limit(400).select('expireAt', 'at'); if (last) q = q.startAfter(last);
    const snap = await q.get(); if (snap.empty) break; pages++;
    const batch = db.batch(); let inBatch = 0;
    snap.docs.forEach(d => { scanned++; const x = d.data() || {}; if (x.expireAt) return; const at = ms(x.at) || now; const exp = at + days * DAY; if (exp < now) past++; if (!DRY) { batch.update(d.ref, { expireAt: new Date(exp) }); inBatch++; } fixed++; });
    if (inBatch) await batch.commit(); last = snap.docs[snap.docs.length - 1];
    if (pages % 20 === 0) console.log('  … ' + coll + ': ' + scanned + ' doc đã quét, ' + fixed + ' gắn expireAt');
    if (snap.size < 400) break;
  }
  console.log(coll + ': quét ' + scanned + ' doc · ' + (DRY ? 'THIẾU expireAt ' : 'gắn expireAt cho ') + fixed + ' doc' + (past ? ' (' + past + ' doc đã quá ' + days + ' ngày → TTL xoá trong ~24 h)' : '') + ' · TTL ' + days + ' ngày');
  return { scanned, fixed, past };
}
console.log('== LỆNH D backfill expireAt' + (DRY ? ' (DRY — chỉ đếm)' : '') + ' ==');
const a = await fill('scans', SCANS_D); const b = await fill('seen', SEEN_D);
console.log('XONG: scans ' + a.fixed + '/' + a.scanned + ' · seen ' + b.fixed + '/' + b.scanned + (DRY ? ' — chạy lại KHÔNG --dry để ghi' : ''));
