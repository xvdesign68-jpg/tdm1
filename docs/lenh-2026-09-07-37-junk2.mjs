/* LỆNH #37 (b) = LỆNH #36 (d) bản 2: liệt kê lead tên chứa "Lan Anh Nguyễn" — ĐỌC THEO TRANG 300 doc + chỉ lấy vài field (bản 1 đọc nguyên collection → DEADLINE_EXCEEDED 300 s).
   --delete = xoá thật (recursiveDelete kèm ghi chú). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const DEL = process.argv.includes('--delete'); const PAGE = 300;
let last = null, scanned = 0; const hit = []; const t0 = Date.now();
for (;;) {
  let q = db.collection('leads').select('name', 'brand', 'stage', 'score', 'detected_at', 'source', 'source_name').orderBy('__name__').limit(PAGE);
  if (last) q = q.startAfter(last);
  const s = await q.get(); if (s.empty) break;
  s.docs.forEach(d => { scanned++; const l = d.data() || {}; if (fold(l.name).includes('lan anh nguy')) hit.push({ id: d.id, l }); });
  last = s.docs[s.docs.length - 1]; if (s.size < PAGE) break;
}
console.log('Quét', scanned, 'lead trong', Math.round((Date.now() - t0) / 1000) + ' s → tìm thấy', hit.length, 'lead tên chứa "Lan Anh Nguyễn":');
for (const { id, l } of hit) { const det = l.detected_at && l.detected_at.toDate ? l.detected_at.toDate().toISOString().slice(0, 16) : String(l.detected_at || '').slice(0, 16);
  console.log(' ', id, '|', l.name, '| brand=', l.brand, '| stage=', l.stage, '| score=', l.score, '| detected=', det, '| nguồn=', String(l.source || l.source_name || '').slice(0, 30));
  if (DEL) { await db.recursiveDelete(db.collection('leads').doc(id)); console.log('    → ĐÃ XOÁ (kể cả ghi chú)'); } }
if (!DEL && hit.length) console.log('Xoá thật: node _l36_junk.mjs --delete');
