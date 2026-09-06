/* LỆNH #37 (07/09/2026) — outreach.js: ĐƯỜNG FUNC (`stepNick`) theo MA TRẬN nhiệt độ×hành động + VAN theo brand + cổng vai (LỆNH #31) + né lead-là-bình-luận
   — đóng mục tồn "func path chưa gate theo matrix" (v119-35/36). Chỉ sửa TRONG thân stepNick (mốc `async function stepNick(` … `async function handleAuth(`),
   content-anchored theo dump 06/09, fail-closed (thiếu mốc → không ghi), idempotent (marker LENH #37). Dùng: node _l37_stepnick.cjs outreach.js */
const fs = require('fs'); const F = process.argv[2] || 'outreach.js'; const src = fs.readFileSync(F, 'utf8');
if (src.includes('LENH #37')) { console.log('outreach.js: ĐÃ patch LENH #37 (idempotent) — bỏ qua'); process.exit(0); }
const i0 = src.indexOf('async function stepNick('), i1 = src.indexOf('async function handleAuth(');
if (i0 < 0 || i1 < 0 || i1 <= i0) { console.error('KHONG THAY MOC stepNick/handleAuth (i0=' + i0 + ', i1=' + i1 + ')'); process.exit(1); }
let body = src.slice(i0, i1);
const A1 = "      prevStep = t.step;\n      let ok = false;";
const A2 = "    const lead = ld.data(); lead.id = ld.id;\n    if (lead.dropped) continue;\n    const tref = threads.doc(ld.id);";
const A3 = "      pid, step: 'react', active: true, nextAt: nowMs(), createdAt: FieldValue.serverTimestamp() });";
for (const [n, a] of [['A1', A1], ['A2', A2], ['A3', A3]]) { const c = body.split(a).length - 1; if (c !== 1) { console.error('KHONG THAY MOC ' + n + ' trong stepNick (đếm ' + c + '): ' + a.slice(0, 70).replace(/\n/g, '⏎')); process.exit(1); } }
body = body.replace(A1, () => `      prevStep = t.step;
      // LENH #37: func-path theo MA TRẬN + VAN theo brand (như AdsPower). Bước bị brand tắt (t.allow[kind]===false) → nhảy bước kế, không tốn lượt;
      //   hết van brand cho bước này → hẹn lại 1 giờ (không chặn nick nạp lead khác ở tick sau). Thread cũ không có t.allow → hành vi cũ.
      const kind37 = t.step === 'react' ? 'react' : t.step === 'comment' ? 'comment' : t.step === 'inbox' ? 'inbox' : null;
      if (kind37 && t.allow && t.allow[kind37] === false) { const nx = kind37 === 'react' ? 'comment' : kind37 === 'comment' ? 'inbox' : 'done'; await tref.set(nx === 'done' ? { step: 'done', active: false } : { step: nx, nextAt: nowMs() }, { merge: true }); if (nx === 'done') return; continue; }
      if (kind37) { const u37 = await usageOf(pid); const c37 = brandCaps(brand); if ((Number(u37[kind37]) || 0) >= (Number(c37[kind37]) || 0)) { await tref.set({ nextAt: nowMs() + 60 * 60000 }, { merge: true }); return; } }
      let ok = false;`);
body = body.replace(A2, () => `    const lead = ld.data(); lead.id = ld.id;
    if (lead.dropped || lead.lost) continue;
    // LENH #37: gate như AdsPower — bỏ junk · ma trận brand tắt react cho nhiệt độ này · chủ bài/người bán (LỆNH #31) · lead-là-bình-luận (func chưa tym/reply đúng comment → để AdsPower lo)
    const temp37 = lead.temp || 'cold';
    if (temp37 === 'junk') continue;
    if (typeof brandAllow === 'function' && !brandAllow(brand, temp37, 'react')) continue;
    if (typeof roleBlockOf === 'function' && roleBlockOf(lead)) continue;
    if (typeof commentIdOf === 'function' && commentIdOf(lead)) continue;
    const tref = threads.doc(ld.id);`);
body = body.replace(A3, () => `      pid, step: 'react', active: true, nextAt: nowMs(), createdAt: FieldValue.serverTimestamp(),
      allow: { comment: (typeof brandAllow === 'function') ? !!brandAllow(brand, temp37, 'comment') : true, inbox: (typeof brandAllow === 'function') ? !!brandAllow(brand, temp37, 'inbox') : true } }); // LENH #37: ma trận brand cho các bước sau`);
fs.writeFileSync(F, src.slice(0, i0) + body + src.slice(i1));
console.log('PATCH OK outreach.js (LENH #37: stepNick gate ma trận/van brand/vai/comment-lead — 3 mốc trong thân stepNick)');
