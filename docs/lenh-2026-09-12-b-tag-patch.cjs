/* LỆNH B (12/09/2026) — codebase2/tagLeadBrand/index.js: lưới dự phòng gán brand theo TÊN NGUỒN → ưu tiên lead.brand_hint (brand fan-out của group dùng chung; 2 source doc có thể trùng tên).
   Content-anchored (dump #47e dòng 75 + khối set), fail-closed, idempotent (marker LENH B). Dùng: node _lb_tag_patch.cjs ~/codebase2/tagLeadBrand/index.js */
const fs = require('fs'); const F = process.argv[2] || 'index.js'; let s = fs.readFileSync(F, 'utf8');
if (s.includes('LENH B')) { console.log('tagLeadBrand: ĐÃ patch LENH B (idempotent) — bỏ qua'); process.exit(0); }
const A1 = "  const brand = await getBrandForSource(sourceName);";
const A1_NEW = "  const hint = String(lead.brand_hint || '').trim(); /* LENH B: brand fan-out ghi lúc tạo lead (group dùng chung) — ưu tiên hơn tra theo tên nguồn */\n  const brand = hint || await getBrandForSource(sourceName);";
const A2 = "    brand_tagged_by: 'tagLeadBrand',";
const A2_NEW = "    brand_tagged_by: hint ? 'brand_hint' : 'tagLeadBrand', /* LENH B */";
for (const [k, a] of [['A1', A1], ['A2', A2]]) { const n = s.split(a).length - 1; if (n !== 1) { console.error('KHONG THAY MOC tagLeadBrand/' + k + ' (đếm ' + n + ')'); process.exit(1); } }
s = s.replace(A1, () => A1_NEW).replace(A2, () => A2_NEW);
fs.writeFileSync(F, s); console.log('PATCH OK tagLeadBrand (LENH B): brand_hint ưu tiên, brand_tagged_by = brand_hint|tagLeadBrand');
