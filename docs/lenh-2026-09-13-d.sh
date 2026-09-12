#!/bin/bash
# LỆNH D (13/09/2026) — Đợt 2.1, sau LỆNH C. PB-9 rút gọn: scans.expireAt +90 ngày + seen.expireAt +180 ngày (TTL policy + backfill doc cũ) · lưới too_old (lượt theo lịch: bài đăng > 45 ngày → không AI/không lead)
#   · hoãn AI lần 2+ không đẻ thêm doc scanned_posts ai_wait · prefiltered_out giữ 14 ngày (nền PC-7) · PB-12: bình luận ↔ bài cha FAIL-CLOSED (khớp URL → id số bài → lô 1 bài; lệch → orphan, đếm scans.cmtOrphan/cmtById)
#   → backup .bak-<TS> → patch fail-closed NGUYÊN TỬ 3 file (lib/config.js lib/scraper.js index.js; đủ 18 mốc mới ghi) → node --check → import test (.env) → deploy scheduledScan + manualScan (xích &&) → TTL policy scans/seen → backfill expireAt
set -o pipefail
cd ~/firebase-s13/functions || { echo 'KHONG VAO DUOC ~/firebase-s13/functions'; exit 1; }
TS=$(date +%Y%m%d-%H%M%S); echo "backup TS=$TS (giờ UTC)"
cat > _ld_patch.cjs <<'EOF_PATCH'
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
EOF_PATCH
cat > _ld_backfill.mjs <<'EOF_BACKFILL'
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
EOF_BACKFILL
cat > _ld_after.mjs <<'EOF_AFTER'
/* LỆNH D KHỐI 2 (13/09/2026) — CHỈ ĐỌC: nghiệm thu sau deploy D (chạy sau ≥ 15′; PB-12 (0) đo lệch bài cha cần vài lượt có bình luận → tốt nhất sau 1–2 giờ ban ngày).
   In: (1) TTL policy scans/seen (gcloud) · (2) scans: 10 lượt gần nhất (cmtOrphan/cmtById/tooOld/commentsFetched/expireAt) + tỉ lệ orphan 24 h · (3) scans/seen thiếu expireAt (mẫu 3.000 doc đầu theo __name__) + tổng seen
   · (4) scanned_posts 24 h: too_old · ai_wait trùng post_id (kỳ vọng 0 sau D) · prefiltered_out expireAt ≈ +14 ngày · (5) PB-12 (0): bình luận 7 ngày — gid(parent_url) ≠ gid(sourceUrl) (lệch bài cha) + orphan theo scans.
   Đọc theo TRANG ≤300 + select(). Đặt trong ~/firebase-s13/functions. Không ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now(), DAY = 864e5;
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const dd = v => ms(v) ? Math.round((ms(v) - now) / DAY) : null;
const gidOf = u => { const m = /facebook\.com\/groups\/([^/?#]+)/i.exec(String(u || '')); return m ? m[1].toLowerCase() : ''; };
async function pageAll(q, orderField, sel, max) { const out = []; let last = null; while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (sel && sel.length) qq = qq.select(...sel); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; } return out; }
console.log('== LỆNH D KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
// 1. TTL policy
try { const out = execSync('gcloud firestore fields ttls list --project=smartlead-z15 --format="value(name,ttlConfig.state)" 2>/dev/null', { encoding: 'utf8' });
  const rows = out.split('\n').filter(Boolean).map(l => l.replace(/^.*collectionGroups\//, '').replace(/\/fields\//, '.')); const pick = k => rows.find(r => r.startsWith(k)) || k + ' — CHƯA có';
  console.log('1. TTL policy: ' + pick('scans.expireAt') + ' · ' + pick('seen.expireAt') + '  (kỳ vọng: ACTIVE — CREATING vài phút sau KHỐI 1 là bình thường)'); }
catch (e) { console.log('1. TTL policy: không đọc được qua gcloud (' + String(e && e.message).slice(0, 80) + ') — kiểm ở console Firestore → TTL'); }
// 2. scans gần nhất
{ const sc = (await db.collection('scans').orderBy('at', 'desc').limit(10).select('at', 'trigger', 'cmtOrphan', 'cmtById', 'tooOld', 'commentsFetched', 'expireAt', 'status', 'postsFetched', 'leadsCreated').get()).docs.map(d => d.data());
  console.log('2. scans 10 lượt gần nhất (giờ VN · loại · bài/lead · cmt gặt · orphan/byId · tooOld · expireAt +ngày):');
  sc.forEach(s => console.log('   ' + hm(s.at) + ' ' + String(s.trigger || '').padEnd(9) + (s.status === 'aborted' ? 'ABORTED ' : '') + (s.postsFetched || 0) + '/' + (s.leadsCreated || 0) + ' · cmt ' + (s.commentsFetched || 0) + ' · orphan ' + (s.cmtOrphan == null ? '(cũ)' : s.cmtOrphan) + '/' + (s.cmtById == null ? '-' : s.cmtById) + ' · tooOld ' + (s.tooOld == null ? '(cũ)' : s.tooOld) + ' · exp ' + (dd(s.expireAt) == null ? 'THIẾU' : '+' + dd(s.expireAt) + 'd')));
  const withD = sc.filter(s => s.cmtOrphan != null); console.log('   → ' + withD.length + '/10 lượt là bản D (có cmtOrphan) · kỳ vọng: lượt sau deploy đều có expireAt ≈ +90d');
  const d24 = await pageAll(db.collection('scans').where('at', '>=', new Date(now - 24 * 3600e3)), 'at', ['cmtOrphan', 'cmtById', 'tooOld', 'commentsFetched'], 1500);
  const o = d24.reduce((a, s) => { a.orphan += Number(s.cmtOrphan) || 0; a.byId += Number(s.cmtById) || 0; a.cmt += Number(s.commentsFetched) || 0; a.old += Number(s.tooOld) || 0; return a; }, { orphan: 0, byId: 0, cmt: 0, old: 0 });
  console.log('   24 h: ' + d24.length + ' lượt · bình luận gặt ' + o.cmt + ' · orphan ' + o.orphan + (o.cmt + o.orphan ? ' (' + Math.round(o.orphan * 1000 / (o.cmt + o.orphan)) / 10 + ' % — PB-12 (0): >10 % thì gửi em mẫu post_url để nới urlKey)' : '') + ' · khớp theo id số ' + o.byId + ' · too_old ' + o.old); }
// 3. thiếu expireAt
{ const s3 = await pageAll(db.collection('scans'), '__name__', ['expireAt'], 3000); const m3 = s3.filter(x => !x.expireAt).length;
  const e3 = await pageAll(db.collection('seen'), '__name__', ['expireAt'], 3000); const m4 = e3.filter(x => !x.expireAt).length;
  let total = '?'; try { total = (await db.collection('seen').count().get()).data().count; } catch (e) {}
  console.log('3. thiếu expireAt (mẫu 3.000 doc đầu theo id): scans ' + m3 + '/' + s3.length + ' · seen ' + m4 + '/' + e3.length + ' (tổng seen ' + total + ')  (kỳ vọng: 0 sau backfill; còn = chạy lại node _ld_backfill.mjs)'); }
// 4. scanned_posts 24 h
{ const sp = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', new Date(now - 24 * 3600e3)), 'createdAt', ['decision', 'post_url', 'kind', 'expireAt', 'sourceUrl', 'parent_url', 'brand'], 6000);
  const by = {}; sp.forEach(p => { by[p.decision || '?'] = (by[p.decision || '?'] || 0) + 1; });
  const aw = sp.filter(p => p.decision === 'ai_wait'); const seenU = new Set(); let dup = 0; aw.forEach(p => { const k = String(p.post_url || '') + '|' + String(p.brand || ''); if (seenU.has(k)) dup++; seenU.add(k); });
  const pf = sp.filter(p => p.decision === 'prefiltered_out' && p.expireAt); const pfd = pf.length ? Math.round(pf.reduce((a, p) => a + (dd(p.expireAt) || 0), 0) / pf.length) : null;
  console.log('4. scanned_posts 24 h: ' + sp.length + ' doc · ' + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · ') + '\n   ai_wait trùng (cùng bài+brand) ' + dup + '  (kỳ vọng 0 sau D) · prefiltered_out expireAt TB ' + (pfd == null ? '—' : '+' + pfd + 'd') + '  (kỳ vọng ≈ +14d cho doc sau D; doc cũ +3d)');
  // 5. PB-12 (0): bình luận 7 ngày lệch bài cha
  const cm7 = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', new Date(now - 7 * DAY)).where('kind', '==', 'comment'), 'createdAt', ['parent_url', 'sourceUrl', 'brand', 'source'], 6000);
  let lech = 0, noGid = 0; cm7.forEach(c => { const a = gidOf(c.parent_url), b = gidOf(c.sourceUrl); if (!a || !b) { noGid++; return; } if (a !== b && !(/^\d+$/.test(a) !== /^\d+$/.test(b))) lech++; });
  console.log('5. PB-12 (0) bình luận 7 ngày: ' + cm7.length + ' doc · gid(bài cha) ≠ gid(nguồn) ' + lech + (cm7.length ? ' (' + Math.round(lech * 1000 / cm7.length) / 10 + ' %)' : '') + ' · không đọc được gid ' + noGid + '  (slug↔số không tính là lệch; kỳ vọng ≈ 0 % cho doc sau D)'); }
console.log('== XONG (chỉ đọc) ==');
EOF_AFTER
node --check _ld_patch.cjs && node --check _ld_backfill.mjs && node --check _ld_after.mjs || { echo 'DỪNG: script lỗi cú pháp (chưa đụng gì)'; exit 1; }
FILES="lib/config.js lib/scraper.js index.js"
echo "=== (a) backup + patch 3 file ==="
for f in $FILES; do [ -f "$f" ] || { echo "DỪNG: thiếu $f"; exit 1; }; done
grep -q "LENH C" index.js || { echo 'DỪNG: index.js chưa có marker LENH C — LỆNH D đặt mốc trên mã SAU LỆNH C. Chạy LỆNH C trước.'; exit 1; }
if grep -q "LENH D" index.js && [ -f _ld_backup_ts ]; then TSB=$(cat _ld_backup_ts); echo "index.js ĐÃ có marker LENH D (chạy lại) — KHÔNG tạo .bak mới; bản gốc trước LENH D = *.bak-$TSB"
elif grep -q "LENH D" index.js; then echo "DỪNG: index.js đã có marker LENH D nhưng thiếu _ld_backup_ts — khôi phục từ .bak-<TS gốc> hoặc gửi em output"; exit 1
else TSB=$TS
  for f in $FILES; do cp "$f" "$f.bak-$TSB" || { echo "DỪNG: không backup được $f"; exit 1; }; done
  echo "$TSB" > _ld_backup_ts
fi
restore() { for f in $FILES; do cp "$f.bak-$TSB" "$f"; done; echo "ĐÃ KHÔI PHỤC 3 file từ .bak-$TSB"; }
describe2() { for f in scheduledScan manualScan; do gcloud functions describe "$f" --region asia-southeast1 --gen2 --format='value(name,state,updateTime)' 2>/dev/null | sed 's|projects/smartlead-z15/locations/asia-southeast1/functions/||' || echo "(describe $f lỗi)"; done; }
node _ld_patch.cjs $FILES || { echo 'DỪNG (a): patch không áp — KHÔNG ghi gì. Gửi em output.'; exit 1; }
for f in $FILES; do node --check "$f" || { echo "DỪNG (a): lỗi cú pháp sau patch ($f)"; restore; exit 1; }; done
echo "marker LENH D (config/scraper/index):"; grep -c "LENH D" $FILES
echo "=== (b) import test (.env) ==="
set -a; . ./.env; set +a
node --input-type=module -e "const m=await import('./index.js'); const r=await import('./lib/scraper.js'); const c=(await import('./lib/config.js')).CFG; console.log('IMPORT OK · scheduledScan', typeof m.scheduledScan, '· manualScan', typeof m.manualScan, '· matchParentD', typeof r.matchParentD, '· byPidMapD', typeof r.byPidMapD, '· TTL scans/seen', c.SCANS_TTL_DAYS+'/'+c.SEEN_TTL_DAYS, 'ngày · too_old', c.TOO_OLD_DAYS, 'ngày · prefiltered', c.PREFILTERED_TTL_DAYS, 'ngày'); const uk=u=>String(u||'').split(/[?#]/)[0].replace(/\/+$/,'').toLowerCase(); const metas=[{url:'https://www.facebook.com/groups/1/posts/100000001/'},{url:'https://www.facebook.com/groups/1/posts/100000002/'}]; const t=r.matchParentD({post_url:'https://m.facebook.com/groups/1/permalink/100000002/?x=1'}, new Map(metas.map(x=>[uk(x.url),x])), r.byPidMapD(metas), metas, uk); const o=r.matchParentD({post_url:'https://www.facebook.com/groups/1/posts/999999999/'}, new Map(metas.map(x=>[uk(x.url),x])), r.byPidMapD(metas), metas, uk); const okT=(t&&t.m===metas[1]&&t.byId)?1:0, okO=(o===null)?1:0; console.log('matchParentD: id số →', okT?'bài 2 (byId) ✓':'SAI', '· lệch 2 bài →', okO?'orphan ✓':'SAI'); if(okT+okO<2) process.exit(1);" || { echo 'DỪNG (b): import/test lỗi'; restore; exit 1; }
echo "=== (c) deploy scheduledScan + manualScan ==="
cd ~/firebase-s13 && firebase deploy --only functions:scheduledScan,functions:manualScan > /tmp/ld_deploy.log 2>&1; RC=$?; tail -6 /tmp/ld_deploy.log
[ "$RC" = "0" ] && grep -q "Deploy complete" /tmp/ld_deploy.log || { echo "DEPLOY LỖI (RC=$RC) — firebase deploy đưa từng function lên lần lượt nên lỗi giữa chừng = MỘT PHẦN đã lên; bảng describe dưới: updateTime ≥ $TS = đã lên bản mới. Cách xử lý: chạy LẠI đúng lệnh deploy ở (c) (idempotent) — hoặc quay lui: cd ~/firebase-s13/functions; for f in $FILES; do cp \$f.bak-$TSB \$f; done; cd ~/firebase-s13; firebase deploy --only functions:scheduledScan,functions:manualScan"; describe2; exit 1; }
describe2
echo "=== (d) TTL policy scans.expireAt (90 ngày) + seen.expireAt (180 ngày) — lỗi = CẢNH BÁO (doc vẫn có expireAt, bật tay ở console Firestore → TTL) ==="
gcloud firestore fields ttls update expireAt --collection-group=scans --enable-ttl --project=smartlead-z15 --quiet > /tmp/ld_ttl1.log 2>&1 && echo "TTL scans.expireAt: OK (ACTIVE sau vài phút)" || echo "TTL scans.expireAt: CHƯA bật (xem /tmp/ld_ttl1.log) — không chặn"
gcloud firestore fields ttls update expireAt --collection-group=seen --enable-ttl --project=smartlead-z15 --quiet > /tmp/ld_ttl2.log 2>&1 && echo "TTL seen.expireAt: OK (ACTIVE sau vài phút)" || echo "TTL seen.expireAt: CHƯA bật (xem /tmp/ld_ttl2.log) — không chặn"
echo "=== (e) backfill expireAt cho doc CŨ (scans + seen, theo trang 400; vài phút) ==="
cd ~/firebase-s13/functions && node _ld_backfill.mjs || echo "CẢNH BÁO (e): backfill lỗi — TTL chỉ xoá doc CÓ expireAt; chạy lại: cd ~/firebase-s13/functions && node _ld_backfill.mjs"
echo "=== XONG KHỐI 1 (exit=0) — KHỐI 2 (sau ≥ 15′, tốt nhất 1–2 giờ ban ngày): cd ~/firebase-s13/functions && node _ld_after.mjs ==="
