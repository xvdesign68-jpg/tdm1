/* LỆNH E · bước bổ sung — bật cờ "brand có bán sỉ / nhận đại lý" (brands/{code}.ai.banSi = true) cho brand có khách là ĐẠI LÝ/MUA SỈ.
   Vì sao: prompt v2 (LỆNH E) xếp vai `reseller` cho người "cần lấy sỉ / nhập hàng / mua để bán lại"; brand KHÔNG bật banSi → decision `reseller` = KHÔNG lead.
   _promptcmp 13/09: 5/5 lead hscl-01 (Hải Sản Cường Linh, bán hải sản khô) đều là người mua sỉ → phải bật banSi, nếu không mất lead tốt nhất của brand.
   Dùng: node _le_bansi.mjs hscl-01 [<brand khác>…]   (cwd ~/firebase-s13/functions; không tham số = chỉ in bảng) — set merge, giữ nguyên nganh/dichvu/khach/giong. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const codes = process.argv.slice(2).map(s => String(s).trim()).filter(Boolean);
for (const c of codes) { const s = await db.collection('brands').doc(c).get(); if (!s.exists) { console.log('✗ brand không tồn tại: ' + c); continue; } await s.ref.set({ ai: { banSi: true } }, { merge: true }); console.log('✓ ' + c + ' → ai.banSi = true (lượt quét kế: người mua sỉ = lead hợp lệ)'); }
const all = await db.collection('brands').get();
console.log('brand'.padEnd(22) + 'banSi   hồ sơ AI'); all.docs.forEach(d => { const a = (d.data() || {}).ai || {}; console.log(String(d.id).padEnd(22) + String(a.banSi === true).padEnd(8) + (a.nganh ? 'CÓ (' + String(a.nganh).slice(0, 40) + ')' : 'CHƯA — v2 chấm bằng prompt trung tính, super khai ở Người dùng → Hồ sơ AI')); });
process.exit(0);
