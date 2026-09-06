/* LỆNH #36 (d) = LỆNH #16 (d): liệt kê lead tên chứa "Lan Anh Nguyễn" (bỏ dấu, không phân biệt hoa thường). --delete = xoá thật (recursiveDelete kèm ghi chú). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const DEL = process.argv.includes('--delete');
const snap = await db.collection('leads').get(); const hit = snap.docs.filter(d => fold((d.data() || {}).name).includes('lan anh nguy'));
console.log('Tìm thấy', hit.length, 'lead tên chứa "Lan Anh Nguyễn" trong', snap.size, 'lead:');
for (const d of hit) { const l = d.data() || {}; const det = l.detected_at && l.detected_at.toDate ? l.detected_at.toDate().toISOString().slice(0, 16) : String(l.detected_at || '').slice(0, 16);
  console.log(' ', d.id, '|', l.name, '| brand=', l.brand, '| stage=', l.stage, '| score=', l.score, '| detected=', det, '| nguồn=', String(l.source || l.source_name || '').slice(0, 30));
  if (DEL) { await db.recursiveDelete(d.ref); console.log('    → ĐÃ XOÁ (kể cả ghi chú)'); } }
if (!DEL && hit.length) console.log('Xoá thật: node _l36_junk.mjs --delete');
