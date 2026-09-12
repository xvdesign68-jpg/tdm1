/* LỆNH D (13/09/2026) — Đợt 2.1 (PB-9 rút gọn + PB-12): mốc trên MÃ SAU LỆNH C (index.js/lib/scraper.js/lib/config.js đã có marker LENH B + LENH C).
   (1) PB-9: `scans.expireAt` (+90 ngày, cả doc aborted) + `seen.expireAt` (+180 ngày, create lẫn merge) → TTL policy (bash) · lưới `too_old`: lượt THEO LỊCH (sowMode) bài đăng cũ hơn TOO_OLD_DAYS (45) → decision `too_old`,
       không AI/không lead (seen vẫn ghi) — quét tay/backfill KHÔNG qua lưới · hoãn AI lần 2+ (x.deferredDoc) không đẻ thêm doc scanned_posts `ai_wait` · `prefiltered_out` giữ 14 ngày (nền PC-7 đối soát tầng 1).
   (2) PB-12: bình luận ↔ bài cha FAIL-CLOSED ở CẢ 2 đường (harvestComments gặt theo lịch + fetchComments quét tay/backfill): khớp URL chuẩn hoá → id số bài (/posts|permalink/(\d+), story_fbid, post_id) → chỉ khi lô có ĐÚNG 1 bài cha;
       ≥2 bài cha mà không khớp → orphan (bỏ, đếm `scans.cmtOrphan`, `cmtById`), KHÔNG dán vào bài đầu lô (trước: AI đọc sai bài gốc, self_comment/parent_kind sai, brand Bài đã quét sai). Sổ tiền BrightData giữ nguyên (cộng bài đầu lô).
       recordPost.brand theo ctx bài cha: ĐÃ đúng từ LỆNH B (x.brandB từ ctx) — không đụng.
   Marker `LENH D`. Fail-closed NGUYÊN TỬ: tìm đủ mốc ở CẢ 3 file (mỗi mốc đúng 1 lần) mới ghi; thiếu 1 mốc → không ghi file nào. Idempotent: 3 file đều có marker → bỏ qua; có ở 1 phần → LỆCH, dừng.
   Dùng: node _ld_patch.cjs lib/config.js lib/scraper.js index.js   (cwd = ~/firebase-s13/functions) */
const fs = require('fs');
const FILES = process.argv.slice(2); if (FILES.length !== 3) { console.error('cần đúng 3 đường dẫn: lib/config.js lib/scraper.js index.js'); process.exit(2); }
const [F_CFG, F_SCR, F_IDX] = FILES; const src = {}; for (const f of FILES) src[f] = fs.readFileSync(f, 'utf8');
const has = f => /LENH D/.test(src[f]); const hs = FILES.map(has);
if (hs.every(Boolean)) { console.log('đã vá (marker LENH D có ở 3/3 file) — idempotent, bỏ qua'); process.exit(0); }
if (hs.some(Boolean)) { console.error('LỆCH: marker LENH D chỉ có ở ' + FILES.filter(has).join(', ') + ' — khôi phục từ .bak rồi chạy lại. KHÔNG ghi gì.'); process.exit(1); }
for (const f of [F_SCR, F_IDX]) { if (!/LENH B/.test(src[f])) { console.error('DỪNG: ' + f + ' chưa có marker LENH B (LỆNH D đặt mốc trên mã sau B/C). KHÔNG ghi gì.'); process.exit(1); } }
if (!/LENH C/.test(src[F_IDX])) { console.error('DỪNG: index.js chưa có marker LENH C — chạy LỆNH C trước. KHÔNG ghi gì.'); process.exit(1); }
const ops = []; const A = (f, tag, find, repl) => ops.push({ f, tag, find, repl });
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ================= lib/config.js ================= */
A(F_CFG, 'CF1 HOUSEKEEPING_MIN', "  HOUSEKEEPING_MIN: num(env.HOUSEKEEPING_MIN, 5),",
"  HOUSEKEEPING_MIN: num(env.HOUSEKEEPING_MIN, 5)," + `
  /* LENH D (PB-9): vòng đời dữ liệu quét */
  SCANS_TTL_DAYS: num(env.SCANS_TTL_DAYS, 90),                    // nhật ký lượt quét scans.expireAt = at + N ngày (TTL policy xoá)
  SEEN_TTL_DAYS: num(env.SEEN_TTL_DAYS, 180),                     // seen/{post_id}.expireAt = at + N ngày (TTL) — bài tái xuất sau đó bị lưới TOO_OLD_DAYS chặn trước AI
  TOO_OLD_DAYS: num(env.TOO_OLD_DAYS, 45),                        // lượt theo lịch: bài đăng cũ hơn N ngày → decision too_old (không AI, không lead); quét tay/backfill không qua lưới
  PREFILTERED_TTL_DAYS: num(env.PREFILTERED_TTL_DAYS, 14),        // scanned_posts decision prefiltered_out giữ N ngày (đối soát tầng 1 — PC-7)`);

/* ================= lib/scraper.js ================= */
A(F_SCR, 'SC1 helper matchParentD', "export async function fetchComments(items, opts = {}) {",
`/* LENH D (PB-12): khớp bình luận ↔ bài cha FAIL-CLOSED. Thứ tự: URL chuẩn hoá (uk) của post_url/post_id → id số bài trong post_url/post_id ↔ id số của bài cha → lô chỉ có ĐÚNG 1 bài cha (không thể lệch) → không khớp = null (orphan: bỏ + đếm).
   Trước: rơi về bài ĐẦU lô (batch[0]/first) → bình luận dán nhầm bài (AI đọc sai bài gốc, self_comment/parent_kind sai, brand Bài đã quét sai). */
const pidNumD = u => { const s = String(u || ''); if (/^\\d{6,}$/.test(s)) return s; const m = s.match(/\\/(?:posts|permalink|videos|photos)\\/(?:[^/?#]+\\/)?(\\d{6,})/) || s.match(/[?&](?:story_fbid|fbid|post_id|id)=(\\d{6,})/); return m ? m[1] : ''; };
export function matchParentD(c, byKey, byPid, metas, uk) {
  const pu = String((c && c.post_url) || ''), pi = String((c && c.post_id) || '');
  for (const k of [uk(pu), uk(pi)]) { if (k && byKey.has(k)) return { m: byKey.get(k), byId: false }; }
  const n = pidNumD(pu) || pidNumD(pi); if (n && byPid.has(n)) return { m: byPid.get(n), byId: true };
  if (metas.length === 1) return { m: metas[0], byId: false }; // 1 bài cha duy nhất → không thể lệch
  return null;
}
export function byPidMapD(metas) { const mp = new Map(); for (const m of metas) { const n = pidNumD(m && m.url) || pidNumD(m && m.parentUrl); if (n && !mp.has(n)) mp.set(n, m); } return mp; }
export async function fetchComments(items, opts = {}) {`);
A(F_SCR, 'SC2 fetchComments lô (quét tay/backfill)', `      for (const c of raw) {
        const pu = c.post_url || c.post_id || batch[0];
        const src = srcByUrl.get(c.post_url) || srcByUrl.get(pu) || srcByUrl.get(batch[0]) || { name: '' };
        out.push({ comment: normalizeComment(c, src, c.post_url || pu), source: src, parentUrl: c.post_url || pu });
      }`,
`      const ukD = u => String(u || '').split(/[?#]/)[0].replace(/\\/+$/, '').toLowerCase(); /* LENH D (PB-12): khớp fail-closed, không rơi về batch[0] */
      const metasD = batch.map(u => ({ url: u })); const byKeyD = new Map(metasD.map(m => [ukD(m.url), m])); const byPidD = byPidMapD(metasD);
      for (const c of raw) {
        const r = matchParentD(c, byKeyD, byPidD, metasD, ukD); if (!r) { out.orphanCmt = (out.orphanCmt || 0) + 1; continue; }
        if (r.byId) out.matchedById = (out.matchedById || 0) + 1;
        const src = srcByUrl.get(r.m.url) || { name: '' };
        out.push({ comment: normalizeComment(c, src, r.m.url), source: src, parentUrl: r.m.url });
      }`);
A(F_SCR, 'SC3 harvest res', "  const res = { items: [], metas: [], harvested: 0, pending: 0, failed: 0 };", "  const res = { items: [], metas: [], harvested: 0, pending: 0, failed: 0, orphanCmt: 0, matchedById: 0 }; /* LENH D */");
A(F_SCR, 'SC4 harvest khớp bài cha', `    for (const c of raw) {
      const pu = c.post_url || c.post_id || (first && first.url) || '';
      const m = byKey.get(uk(c.post_url)) || byKey.get(uk(pu)) || first;
      const src = (m && typeof opts.srcOf === 'function' && opts.srcOf(m.srcUrl)) || { name: '' };
      res.items.push({ comment: normalizeComment(c, src, c.post_url || pu), source: src, parentUrl: c.post_url || pu, meta: m });
    }`,
`    const byPidD = byPidMapD(metas); /* LENH D (PB-12): khớp URL → id số bài → 1 bài duy nhất; ≥2 bài mà không khớp → orphan (bỏ), KHÔNG dán vào bài đầu snapshot */
    for (const c of raw) {
      const r = matchParentD(c, byKey, byPidD, metas, uk); if (!r) { res.orphanCmt++; continue; }
      const m = r.m; if (r.byId) res.matchedById++;
      const src = (typeof opts.srcOf === 'function' && opts.srcOf(m.srcUrl)) || { name: '' };
      res.items.push({ comment: normalizeComment(c, src, m.url), source: src, parentUrl: m.url, meta: m });
    }`);

/* ================= index.js ================= */
A(F_IDX, 'IX1 bộ đếm', "  let nGroupsB = 0, sharedGroupsB = 0, sownB = 0,", "  let cmtOrphanB = 0, cmtByIdB = 0, tooOldB = 0; /* LENH D */\n  let nGroupsB = 0, sharedGroupsB = 0, sownB = 0,");
A(F_IDX, 'IX2 SEEN_DEC_B too_old', "self_comment: 'self', seller: 'seller' };", "self_comment: 'self', seller: 'seller', too_old: 'old' }; /* LENH D */");
A(F_IDX, 'IX3 prefiltered_out 14 ngày', "      expireAt: kept ? null : new Date(Date.now() + TTL_MS)\n    });",
"      expireAt: kept ? null : new Date(Date.now() + ((fields.decision === 'prefiltered_out') ? Math.max(1, Number(CFG.PREFILTERED_TTL_DAYS) || 14) * 86400e3 : TTL_MS)) /* LENH D (nền PC-7): tầng 1 loại giữ 14 ngày để đối soát */\n    });");
A(F_IDX, 'IX4 helper tooOldD + seenExpD', "    const wb = db.batch(); let writes = 0; const fresh48 = []; const createB = new Map(), mergeB = new Map();",
"    const tooOldD = (p) => { const lim = Math.max(1, Number(CFG.TOO_OLD_DAYS) || 45) * 86400e3; const t = tsMsB(p && p.time); return !!(t > 0 && (Date.now() - t) > lim); }; /* LENH D (PB-9): bài đăng quá cũ (time không đọc được → không chặn) */\n    const seenExpD = () => new Date(Date.now() + Math.max(1, Number(CFG.SEEN_TTL_DAYS) || 180) * 86400e3); /* LENH D (PB-9): seen.expireAt (TTL) */\n    const wb = db.batch(); let writes = 0; const fresh48 = []; const createB = new Map(), mergeB = new Map();");
A(F_IDX, 'IX5 lưới too_old', "      if (x.post.self_comment) { selfSkipped++; recordPost(x, { decision: 'self_comment' }); return; }",
"      if (sowMode && tooOldD(x.post)) { tooOldB++; recordPost(x, { decision: 'too_old' }); return; } /* LENH D (PB-9): lượt theo lịch — bài cũ hơn TOO_OLD_DAYS (seen hết TTL, BrightData trả lại) → không tốn AI, không lead; quét tay/backfill không qua lưới */\n      if (x.post.self_comment) { selfSkipped++; recordPost(x, { decision: 'self_comment' }); return; }");
A(F_IDX, 'IX6 seen create expireAt', "    const seenDocB = (c) => { const d = { at: FieldValue.serverTimestamp(), run: runId48 };", "    const seenDocB = (c) => { const d = { at: FieldValue.serverTimestamp(), run: runId48, expireAt: seenExpD() }; /* LENH D */");
A(F_IDX, 'IX7 seen merge expireAt', "    for (const m of mergeB.values()) { wb.set(m.ref, { brands: m.brands }, { merge: true }); writes++; }", "    for (const m of mergeB.values()) { wb.set(m.ref, { brands: m.brands, expireAt: seenExpD() }, { merge: true }); writes++; } /* LENH D */");
A(F_IDX, 'IX8 seen merge2 expireAt', "        for (const m of merge2.values()) { wb2.set(m.ref, { brands: m.brands }, { merge: true }); w2++; }", "        for (const m of merge2.values()) { wb2.set(m.ref, { brands: m.brands, expireAt: seenExpD() }, { merge: true }); w2++; } /* LENH D */");
A(F_IDX, 'IX9 gặt bình luận đếm orphan', "        hvCmts = hv.items; hvHarvestedB = Number(hv.harvested) || 0;", "        hvCmts = hv.items; hvHarvestedB = Number(hv.harvested) || 0; cmtOrphanB += Number(hv.orphanCmt) || 0; cmtByIdB += Number(hv.matchedById) || 0; /* LENH D (PB-12) */");
A(F_IDX, 'IX10 quét bình luận tay đếm orphan', "      const cmts = await fetchComments(items, { perPost: CFG.COMMENTS_PER_POST, billed: cmtBilled, sow: sowMode, metaOf: sowMetaOf }); // v-sowc: sow=true → chỉ gieo",
"      const cmts = await fetchComments(items, { perPost: CFG.COMMENTS_PER_POST, billed: cmtBilled, sow: sowMode, metaOf: sowMetaOf }); // v-sowc: sow=true → chỉ gieo\n      cmtOrphanB += Number(cmts && cmts.orphanCmt) || 0; cmtByIdB += Number(cmts && cmts.matchedById) || 0; /* LENH D (PB-12) */");
A(F_IDX, 'IX11 hoãn AI lần 2+ không đẻ doc', "else llmDeferred++; recordPost(x, { decision: r46 === 'error' ? 'error' : 'ai_wait' }); await flushPosts();",
"else llmDeferred++; if (r46 === 'error' || !x.deferredDoc) recordPost(x, { decision: r46 === 'error' ? 'error' : 'ai_wait' }); /* LENH D (PB-9): hoãn lần 2+ không đẻ thêm doc ai_wait */ await flushPosts();");
A(F_IDX, 'IX12 summary expireAt + đếm', "    dist, bySource\n  };\n  if (range) summary.range = range;",
"    dist, bySource,\n    cmtOrphan: cmtOrphanB, cmtById: cmtByIdB, tooOld: tooOldB, expireAt: new Date(Date.now() + Math.max(1, Number(CFG.SCANS_TTL_DAYS) || 90) * 86400e3) /* LENH D (PB-9/PB-12) */\n  };\n  if (range) summary.range = range;");
A(F_IDX, 'IX13 scans aborted expireAt', "  try { await db.collection('scans').add({ at: FieldValue.serverTimestamp(), trigger, status: 'aborted', error: msg,",
"  try { await db.collection('scans').add({ at: FieldValue.serverTimestamp(), trigger, status: 'aborted', error: msg, expireAt: new Date(Date.now() + Math.max(1, Number(CFG.SCANS_TTL_DAYS) || 90) * 86400e3), /* LENH D */");

/* ================= áp: fail-closed nguyên tử ================= */
const out = Object.assign({}, src); const bad = [];
for (const o of ops) { const n = out[o.f].split(o.find).length - 1; if (n !== 1) { bad.push(o.tag + ' (' + o.f + ', đếm ' + n + ')'); continue; } out[o.f] = out[o.f].replace(o.find, () => o.repl); }
if (bad.length) { console.error('KHONG THAY MOC (cần đúng 1 lần): ' + bad.join(' · ') + ' — DỪNG, KHÔNG ghi file nào'); process.exit(1); }
for (const f of FILES) fs.writeFileSync(f, out[f]);
console.log('PATCH OK 3 file (LENH D): config 4 khoá TTL/too_old · scraper matchParentD fail-closed (2 đường) · index seen/scans expireAt + lưới too_old + hoãn AI không đẻ doc + prefiltered 14 ngày + cmtOrphan/cmtById/tooOld (' + ops.length + ' mốc)');
