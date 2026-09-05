# LỆNH #23 — gieo/gặt COMMENT cho quét theo lịch + Rules `system_status` (05/09/2026)

> **3 việc còn tồn sau sự cố scheduledScan (anh chốt "xử lý nốt")**: (1) lượt quét có comment vẫn **chờ cứng `bdWait` tới 510 s** (Pha 1b gọi `fetchComments` → trigger dataset comment rồi poll 85×6 s) → nay **gieo snapshot comment rồi gặt ở lượt sau** (`pending_snapshots` doc `C_<snapshot_id>` kind=`comments`, kèm bài cha để lượt sau nối lại đúng nguồn/bài) — cùng cơ chế v-sow của bài (LỆNH #21); quét tay/backfill/force giữ cách chờ cũ. (2) web chưa hiện `system_status/brightdata` → Rules cho Super Admin đọc (block này) + FE **v119-50** (thẻ ⛔ trên Overview + chip đỏ thanh nhịp quét, tự gỡ khi `ok:true`). (3) `config/app.scanIntervalMin` chưa có ô trên web → FE v119-50 thêm ô "Nhịp gieo mỗi nguồn" trong widget Quét tự động (mục Chấm điểm), mặc định 10, tối thiểu 3.
>
> **Đã test cục bộ**: patch idempotent trên bản dựng lại từ dump (#20 + #21), `node --check` 2 file, harness `fetchComments`/`harvestComments` **10/10** (gieo · chưa chín · gặt+stub-filter+billed · failed · quá hạn 2h · quét tay giữ cũ · outage · không đụng pending bài P_ · fetch lỗi giữ pending · mock) + harness khối Pha 1b index.js **8/8** (gặt → nối bài cha đúng nguồn/row, orphan bỏ, sổ tiền bdComments, cadence cmt_scrape, harvest lỗi vẫn gieo, bài cha trùng lượt). Script Rules test 3 dạng (block workers nhiều dòng / 1 dòng / không có → chèn sau dòng documents). Không có secret. Deploy xích `&&` sau patch; chạy qua file `.sh` (bài học `!` LỆNH #22).
>
> **Cơ chế sau patch (quét theo lịch, `sowMode`)**: lượt T gặt bài (như #21) → Pha 1b: **(a) gặt** mọi `C_*` đã chín (BrightData `ready`) → comment nối vào bài cha (ctx dựng lại từ meta lưu trong doc: url bài, url nguồn, tác giả/đoạn text bài) → đi chung pipeline chống trùng/lọc/AI như cũ; chưa chín → để lượt sau; `failed`/quá 2h → xoá; **(b) gieo**: bài cần quét comment (đúng nhịp `cmt_scrape` như cũ) → `bdTriggerComments` theo lô 50 bài → ghi doc pending → trả về NGAY (không poll). Lượt có comment giờ ≈ vài giây thay vì 300–510 s. Sổ tiền (`bdComments` theo nguồn, `bdCommentRecords`), `commentsFetched`, `cmt_scrape`/`qualified_only` giữ nguyên ngữ nghĩa.

> **★ KHỐI 1 ĐÃ CHẠY THÀNH CÔNG (05/09 04:43 UTC = 11:43 VN, `exit=0`)**: backup `index.js.bak-20260905-044358` + `lib/scraper.js.bak-20260905-044358` · `index.js: import tinh + harvestComments` · PATCH OK · SYNTAX OK · marker v-sowc index.js:442/494/495/505, lib/scraper.js:271/313 · IMPORT OK (scheduledScan/manualScan/harvestComments = function) · deploy `manualScan` + `scheduledScan` Successful → **rev `scheduledscan-00068-pob`, timeout 1800, ACTIVE** · Rules block `system_status` (bản sao workers, read isSuperAdmin / write false) compiled + released. Tiếp: KHỐI 2 sau ≥10′.

## KHỐI 1 — chạy ngay (qua file .sh)

Dán NGUYÊN KHỐI vào Cloud Shell. Khối chỉ tạo 3 file bằng heredoc rồi `bash /tmp/ss23_run.sh`; trong script mọi bước xích `&&` — lỗi ở đâu dừng ở đó, KHÔNG deploy code hỏng.

```bash
cd ~/firebase-s13/functions || exit 1

cat > /tmp/ss23.cjs <<'EOF_CJS'
/* LỆNH #23 — v-sowc 05/09/2026: GIEO/GẶT snapshot COMMENT cho quét theo LỊCH (hết chờ cứng bdWait tới 510 s/lượt có comment).
   Patch 2 file bằng mốc NỘI DUNG (không theo số dòng). Tìm ĐỦ mốc trước, thiếu mốc nào → KHÔNG ghi gì (exit 1). Idempotent qua marker 'v-sowc'. */
const fs = require('fs');
const files = { idx: 'index.js', scr: 'lib/scraper.js' };
const src = {}; for (const k in files) src[k] = fs.readFileSync(files[k], 'utf8');
if (src.idx.includes('v-sowc') && src.scr.includes('v-sowc')) { console.log('DA VA v-sowc o ca 2 file — bo qua'); process.exit(0); }
const miss = []; const need = (name, ok) => { if (!ok) miss.push(name); };
/* ---- mốc index.js (Pha 1b) ---- */
const L = src.idx.split('\n');
const after = (from, pred) => { for (let i = from; i < L.length; i++) if (pred(L[i])) return i; return -1; };
const iIf = L.findIndex(l => l === '  if (scanComments) {'); need('idx:if(scanComments)', iIf >= 0);
const iCand = after(iIf + 1, l => l.includes('const cand = []; // ứng viên bài')); need('idx:cand', iCand > iIf);
const iWaste = after(iCand + 1, l => l.startsWith('    // CHỐNG LÃNG PHÍ:')); need('idx:waste', iWaste > iCand);
const iBilled = after(iWaste + 1, l => l.includes('const cmtBilled = new Map();')); need('idx:billed', iBilled > iWaste);
const iFetch = iBilled + 1; need('idx:fetchComments', iBilled > 0 && L[iFetch] === '      const cmts = await fetchComments(items, { perPost: CFG.COMMENTS_PER_POST, billed: cmtBilled });');
const iLoop = after(iFetch + 1, l => l === '      for (const { comment, parentUrl } of cmts) {'); need('idx:loop', iLoop > iFetch);
need('idx:sowMode', src.idx.includes('const sowMode = ')); need('idx:bySource', src.idx.includes('bySource.push(row)'));
const impRe = /^import\s*\{([^}]*)\}\s*from\s*(['"])\.\/lib\/scraper\.js\2;?[ \t]*$/m;
const impM = src.idx.match(impRe);
/* ---- mốc lib/scraper.js ---- */
const S = src.scr.split('\n');
const sFc = S.findIndex(l => l.startsWith('export async function fetchComments(items, opts = {})')); need('scr:fetchComments', sFc >= 0);
const sOut = (() => { for (let i = sFc + 1; i < S.length; i++) if (S[i] === '  const out = [];') return i; return -1; })(); need('scr:out', sOut > sFc);
const sLoop = (() => { for (let i = sOut + 1; i < S.length; i++) if (S[i] === '  for (let i = 0; i < urls.length; i += 50) {') return i; return -1; })(); need('scr:loop', sLoop > sOut);
const sRet = (() => { for (let i = sLoop + 1; i < S.length; i++) if (S[i] === '  return out;') return i; return -1; })(); need('scr:return', sRet > sLoop && S[sRet + 1] === '}');
need('scr:bdStatus', src.scr.includes('async function bdStatus(id)')); need('scr:bdFetch', src.scr.includes('async function bdFetch(id)')); need('scr:normalizeComment', src.scr.includes('export function normalizeComment(c, source, parentUrl)')); need('scr:pendDb', src.scr.includes('function __pendDb()'));
if (miss.length) { console.log('THIEU MOC:', miss.join(', '), '— KHONG GHI GI'); process.exit(1); }

/* ---------- index.js ---------- */
if (!src.idx.includes('v-sowc')) {
  const useDyn = !impM || /\bharvestComments\b/.test(impM[1]);
  const harvestBlock = [
    "    /* v-sowc 05/09/2026: quét theo LỊCH không còn chờ snapshot comment trong lượt (bdWait tới 510 s):",
    "       (1) GẶT các snapshot comment đã gieo ở lượt trước → thêm bài cha vào ctx (nguồn tra theo url trong lượt này) rồi đi chung vòng xử lý bên dưới;",
    "       (2) fetchComments({sow:true}) chỉ GIEO snapshot (pending_snapshots kind='comments' kèm bài cha) rồi trả về ngay. Quét tay/backfill/force giữ cách cũ. */",
    "    let hvCmts = []; const hvBilled = new Map();",
    "    const sowMetaOf = (u) => { const c = ctx.get(urlKey(u)); return c ? { url: u, srcUrl: String((c.src && c.src.url) || ''), parentUrl: c.parentUrl || u, parentAuthor: String(c.parentAuthor || '').slice(0, 200), parentText: String(c.parentText || '').slice(0, 1500) } : null; };",
    "    if (sowMode) {",
    "      try {",
    (useDyn && !(impM && /\bharvestComments\b/.test(impM[1]))) ? "        const { harvestComments } = await import('./lib/scraper.js');" : "        // harvestComments: import tĩnh ở đầu file",
    "        const srcCtx = new Map();",
    "        for (const s of sources) { const u = String(s.url || ''); const r = bySource.find(rr => rr.url === u); if (u && r && !srcCtx.has(u)) srcCtx.set(u, { src: s, effSrc: { ...s, keywords: [...(s.keywords || []), ...gKw], exclude: [...(s.exclude || []), ...gEx] }, row: r }); }",
    "        const hv = await harvestComments({ billed: hvBilled, srcOf: (u) => { const c = srcCtx.get(String(u || '')); return c ? c.src : null; } });",
    "        let orphan = 0;",
    "        for (const m of hv.metas) { const cc = m && srcCtx.get(String(m.srcUrl || '')); const k = urlKey((m && (m.parentUrl || m.url)) || ''); if (!cc || !k) { orphan++; continue; } if (!ctx.has(k)) ctx.set(k, { effSrc: cc.effSrc, src: cc.src, row: cc.row, parentAuthor: m.parentAuthor || '', parentText: m.parentText || '', parentUrl: m.parentUrl || m.url || '' }); }",
    "        hvCmts = hv.items;",
    "        if (hv.harvested || hv.pending || hv.failed) console.log(`[sowc] gặt ${hv.harvested} snapshot comment → ${hv.items.length} comment (${orphan} bài cha không còn nguồn) · còn chờ ${hv.pending} · hỏng/quá hạn ${hv.failed}`);",
    "      } catch (e) { console.error('harvestComments lỗi:', e.message); }",
    "    }"
  ];
  // sửa từ dưới lên để index không trượt
  L[iLoop] = "      for (const { comment, parentUrl } of [...hvCmts, ...cmts]) { // v-sowc: comment đã gặt + comment quét ngay (quét tay/backfill)";
  L[iFetch] = "      const cmts = await fetchComments(items, { perPost: CFG.COMMENTS_PER_POST, billed: cmtBilled, sow: sowMode, metaOf: sowMetaOf }); // v-sowc: sow=true → chỉ gieo";
  L.splice(iBilled + 1, 0, "      for (const [k, v] of hvBilled) cmtBilled.set(k, (cmtBilled.get(k) || 0) + v); // v-sowc: record comment BrightData của snapshot vừa gặt");
  L.splice(iWaste, 0, ...harvestBlock);
  let out = L.join('\n');
  if (impM && !/\bharvestComments\b/.test(impM[1])) out = out.replace(impRe, (m0, names, q) => `import {${names.replace(/\s*$/, '')}, harvestComments } from ${q}./lib/scraper.js${q};`);
  fs.writeFileSync(files.idx, out);
  console.log('index.js: ' + (impM ? (/\bharvestComments\b/.test(impM[1]) ? 'import da co' : 'import tinh + harvestComments') : 'KHONG THAY import tinh scraper.js → dung dynamic import trong khoi'));
}
/* ---------- lib/scraper.js ---------- */
if (!src.scr.includes('v-sowc')) {
  const sowBlock = [
    "  // ==== v-sowc 05/09/2026: quét theo LỊCH (opts.sow) → chỉ GIEO snapshot comment (pending_snapshots kind='comments' kèm bài cha) rồi trả về ngay;",
    "  //      GẶT bằng harvestComments() ở lượt sau. Không sow (quét tay/backfill) → chờ trong lượt như cũ. ====",
    "  if (opts.sow) {",
    "    let sown = 0;",
    "    for (let i = 0; i < urls.length; i += 50) {",
    "      const batch = urls.slice(i, i + 50);",
    "      try {",
    "        const snap = await bdTriggerComments(batch, perPost);",
    "        const meta = batch.map(u => { let m = null; try { m = typeof opts.metaOf === 'function' ? opts.metaOf(u) : null; } catch (e) {} const s = srcByUrl.get(u); return Object.assign({ url: u, srcUrl: String((s && s.url) || ''), parentUrl: u, parentAuthor: '', parentText: '' }, m || {}); });",
    "        const ref = __pendDb().collection('pending_snapshots').doc('C_' + String(snap).replace(/[^\\w-]/g, '_').slice(0, 470));",
    "        const pdoc = { kind: 'comments', snapshot_id: snap, t: Date.now(), perPost: perPost || 0, n: batch.length, meta };",
    "        try { await ref.set(pdoc); } catch (e) { await new Promise(s => setTimeout(s, 800)); await ref.set(pdoc); }",
    "        sown++; log.info('GIEO snapshot comment ' + snap + ' (' + batch.length + ' bai) — gat luot sau');",
    "      } catch (e) { log.warn('fetchComments gieo lo loi: ' + e.message); }",
    "    }",
    "    try { out.sown = sown; } catch (e) {}",
    "    return out;",
    "  }"
  ];
  const harvestFn = [
    "",
    "/** v-sowc 05/09/2026: GẶT các snapshot comment đã gieo (pending_snapshots kind='comments'). Không chờ: chưa chín → để lượt sau; failed / quá 2h → xoá.",
    " *  opts: { billed?: Map(parentUrl → số record tính tiền), srcOf?: (srcUrl) => source | null }",
    " *  Trả { items: [{ comment, source, parentUrl, meta }], metas: [bài cha của các snapshot đã gặt], harvested, pending, failed }. */",
    "export async function harvestComments(opts = {}) {",
    "  const res = { items: [], metas: [], harvested: 0, pending: 0, failed: 0 };",
    "  if (CFG.MOCK_MODE || !CFG.BRIGHTDATA_TOKEN) return res;",
    "  const docs = [];",
    "  try { const qs = await __pendDb().collection('pending_snapshots').where('kind', '==', 'comments').get(); qs.forEach(d => docs.push({ ref: d.ref, p: d.data() || {} })); }",
    "  catch (e) { log.warn('harvestComments: doc pending loi ' + e.message); return res; }",
    "  const uk = u => String(u || '').split(/[?#]/)[0].replace(/\\/+$/, '').toLowerCase();",
    "  for (const { ref, p } of docs) {",
    "    const id = p.snapshot_id; if (!id) { try { await ref.delete(); } catch (e) {} continue; }",
    "    const st = await bdStatus(id);",
    "    if (st === 'failed' || (Date.now() - (Number(p.t) || 0)) > 2 * 3600e3) { res.failed++; try { await ref.delete(); } catch (e) {} log.warn('snapshot comment ' + id + (st === 'failed' ? ' failed' : ' qua han') + ' — bo'); continue; }",
    "    if (st !== 'ready') { res.pending++; continue; }",
    "    let raw0 = [];",
    "    try { raw0 = await bdFetch(id); } catch (e) { res.pending++; log.warn('harvestComments: fetch ' + id + ' loi ' + e.message); continue; }",
    "    const metas = Array.isArray(p.meta) ? p.meta.filter(m => m && m.url) : [];",
    "    const byKey = new Map(); for (const m of metas) { byKey.set(uk(m.url), m); const k2 = uk(m.parentUrl); if (k2 && !byKey.has(k2)) byKey.set(k2, m); }",
    "    const first = metas[0] || null;",
    "    if (opts.billed instanceof Map) { for (const c of raw0) { const pu = (c && (c.post_url || c.post_id)) || (first && first.url) || ''; opts.billed.set(pu, (opts.billed.get(pu) || 0) + 1); } }",
    "    const raw = raw0.filter(c => c && !c.error && !c.error_code && !c.warning && (c.comment_id || c.comment_text || c.comment || c.text || c.content));",
    "    if (raw.length < raw0.length) log.info('stub-filter: loai ' + (raw0.length - raw.length) + ' record vo-rong/error (comments, gat)');",
    "    for (const c of raw) {",
    "      const pu = c.post_url || c.post_id || (first && first.url) || '';",
    "      const m = byKey.get(uk(c.post_url)) || byKey.get(uk(pu)) || first;",
    "      const src = (m && typeof opts.srcOf === 'function' && opts.srcOf(m.srcUrl)) || { name: '' };",
    "      res.items.push({ comment: normalizeComment(c, src, c.post_url || pu), source: src, parentUrl: c.post_url || pu, meta: m });",
    "    }",
    "    res.metas.push(...metas); res.harvested++;",
    "    try { await ref.delete(); } catch (e) {}",
    "    log.info('GAT snapshot comment ' + id + ' — ' + raw.length + ' comment / ' + metas.length + ' bai');",
    "  }",
    "  return res;",
    "}"
  ];
  S.splice(sRet + 2, 0, ...harvestFn);   // sau dấu '}' đóng fetchComments
  S.splice(sOut + 1, 0, ...sowBlock);     // sau 'const out = [];' (đã qua mock/credential check)
  fs.writeFileSync(files.scr, S.join('\n'));
}
console.log('PATCH OK: index.js(Pha 1b: gặt + gieo comment theo sowMode) · lib/scraper.js(fetchComments sow + harvestComments)');
EOF_CJS

cat > /tmp/ss23_rules.cjs <<'EOF_RULES'
/* LỆNH #23 — Rules: match /system_status/{sid} read = isSuperAdmin(), write = false (engine ghi bằng Admin SDK).
   Chép block `match /workers/{wid}` (LỆNH M: read super, write false) → đổi tên; không có block workers → chèn block mới ngay sau dòng `match /databases/{database}/documents {`. Idempotent. */
const fs = require('fs'); const F = 'firestore.rules'; let s = fs.readFileSync(F, 'utf8');
if (/match \/system_status\//.test(s)) { console.log('Rules: block system_status ĐÃ CÓ - bỏ qua'); process.exit(0); }
let blk = null;
const m1 = s.match(/([ \t]*)match \/workers\/\{[^}]*\}\s*\{[\s\S]*?\n\1\}/);          // block nhiều dòng
const m2 = m1 ? null : s.match(/([ \t]*)match \/workers\/\{[^}]*\}\s*\{[^\n]*\}[ \t]*/); // block 1 dòng
const m = m1 || m2;
if (m) {
  blk = m[0].replace(/workers\/\{\w+\}/, 'system_status/{sid}').replace(/workers/g, 'system_status');
  const note = m[1] + '// v-sowc 05/09/2026 (LỆNH #23): trạng thái hệ thống (system_status/brightdata do engine quét ghi) — Super Admin đọc để hiện banner BrightData ngưng';
  s = s.replace(m[0], m[0] + '\n' + note + '\n' + blk);
} else {
  const L = s.split('\n'); const i = L.findIndex(l => /match \/databases\/\{database\}\/documents\s*\{/.test(l));
  if (i < 0) { console.log('KHONG TIM THAY block workers lẫn dòng match /databases/{database}/documents - dán cho em 20 dòng đầu firestore.rules'); process.exit(1); }
  const ind = ((L[i].match(/^([ \t]*)/) || ['', ''])[1]) + '  ';
  blk = ind + 'match /system_status/{sid} { allow read: if isSuperAdmin(); allow write: if false; }';
  L.splice(i + 1, 0, ind + '// v-sowc 05/09/2026 (LỆNH #23): trạng thái hệ thống (system_status/brightdata do engine quét ghi) — Super Admin đọc để hiện banner BrightData ngưng', blk);
  s = L.join('\n');
}
if (!/isSuperAdmin\(\)/.test(blk) && !/superadmin/.test(blk)) { console.log('Block chép được KHONG chứa điều kiện superadmin - dừng để em xem:\n' + blk); process.exit(1); }
fs.writeFileSync(F, s); console.log('Rules: đã chèn block system_status:\n' + blk);
EOF_RULES

cat > /tmp/ss23_run.sh <<'EOF_RUN'
# LỆNH #23 — chạy bằng `bash /tmp/ss23_run.sh` (KHÔNG dán từng dòng: shell tương tác Cloud Shell history-expand ký tự `!` — bài học LỆNH #22).
cd ~/firebase-s13/functions || exit 1
echo "=== (a) backup index.js + lib/scraper.js ==="
if grep -q 'v-sowc' index.js && grep -q 'v-sowc' lib/scraper.js; then
  echo "đã có marker v-sowc (patch từ lần chạy trước) → GIỮ backup cũ:"; ls -1 index.js.bak-* lib/scraper.js.bak-* 2>/dev/null | tail -4
else
  TS=$(date +%Y%m%d-%H%M%S); cp index.js "index.js.bak-$TS" && cp lib/scraper.js "lib/scraper.js.bak-$TS" && ls -1 "index.js.bak-$TS" "lib/scraper.js.bak-$TS" || exit 1
fi
echo "=== (b) patch v-sowc (idempotent, tìm đủ mốc mới ghi) ===" \
 && node /tmp/ss23.cjs && node --check lib/scraper.js && node --check index.js && echo "SYNTAX OK index.js + lib/scraper.js" \
 && echo "--- marker ---" && grep -n "v-sowc" index.js lib/scraper.js | cut -c1-110 \
 && echo "=== (c) import test với .env ===" \
 && ( set -a; . ./.env; set +a; node --input-type=module -e "const m=await import('./index.js'); const s=await import('./lib/scraper.js'); console.log('IMPORT OK · scheduledScan =',typeof m.scheduledScan,'· manualScan =',typeof m.manualScan,'· harvestComments =',typeof s.harvestComments)" ) \
 && echo "=== (d) deploy scheduledScan + manualScan ===" \
 && firebase deploy --only functions:scheduledScan,functions:manualScan \
 && echo "=== (e) rev + timeout ===" \
 && gcloud functions describe scheduledScan --region asia-southeast1 --project smartlead-z15 --format="value(serviceConfig.revision,serviceConfig.timeoutSeconds,state)" \
 && echo "=== (f) Rules: system_status read = Super Admin ===" \
 && cd ~/firebase-s13 && cp firestore.rules "firestore.rules.bak-$(date +%Y%m%d-%H%M%S)" && node /tmp/ss23_rules.cjs \
 && firebase deploy --only firestore:rules 2>&1 | grep -E "Deploy complete|rror|released|ompiled" | head -4 \
 && rm -f /tmp/ss23.cjs /tmp/ss23_rules.cjs /tmp/ss23_run.sh \
 && echo "=== XONG LỆNH #23 — chờ ≥10 phút rồi chạy KHỐI 2 (kiểm) ==="
EOF_RUN

bash /tmp/ss23_run.sh; echo "exit=$?"
```

**Kỳ vọng**: `PATCH OK: index.js(…) · lib/scraper.js(…)` (dòng trên có `index.js: import tinh + harvestComments` hoặc `… dynamic import`) · `SYNTAX OK` · `IMPORT OK · scheduledScan = function · manualScan = function · harvestComments = function` · deploy 2 function Successful · describe rev mới (`scheduledscan-00068-…`), timeout 1800, ACTIVE · Rules `đã chèn block system_status` + `Deploy complete` · `exit=0`. Thấy `THIEU MOC:` → không ghi gì, dán output cho em.

> **★ KHỐI 2 NGHIỆM THU PASS (05/09 11:27–11:56 VN)**: 10 lượt `dur` 3–107 s (107 s = lượt 11:31 code cũ; sau deploy: 9/23/4/34 s) · log `GIEO snapshot comment (1 bai)` 11:47 → `GAT … 0 comment / 1 bai` + `[sowc] gặt 1 → 0 comment · còn chờ 0` 11:50 → `GIEO (4 bai)` 11:50 → `GAT … 0 comment / 4 bai` 11:53 → `GIEO (13 bai)` 11:56 (gặt trước, gieo sau trong cùng lượt) · pending bài 4 / comment C_ 1 / chờ >30′ 0 · `system_status/brightdata ok:true`. Lượt 11:44 (code cũ) `comment 5 / bdCmt 14 / 63 s` là mốc so sánh. 0 comment ở các lượt gặt = bài mới chưa có bình luận (BrightData trả 1 record placeholder/bài, stub-filter loại; bdCmt = số bài). Theo dõi thêm lượt gặt có `comment > 0` buổi chiều.

## KHỐI 2 — kiểm sau ≥10 phút (chỉ đọc)

```bash
cd ~/firebase-s13/functions || exit 1
cat > _ss23_after.mjs <<'EOF_AFTER'
/* LỆNH #23 — KIỂM SAU ≥10 PHÚT (chỉ đọc): lượt quét theo lịch có comment không còn chờ tới 510 s; snapshot comment gieo (C_) rồi gặt; Rules system_status đọc được. */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const toMs = v => v && v.toMillis ? v.toMillis() : (v && v._seconds ? v._seconds * 1000 : (typeof v === 'number' ? v : 0));
const vn = ms => new Date(ms + 7 * 3600e3).toISOString().slice(5, 19).replace('T', ' ');
const sc = await db.collection('scans').orderBy('at', 'desc').limit(10).get();
let maxDur = 0;
sc.forEach(d => { const s = d.data(); const dur = Math.round((s.durationMs || 0) / 1000); if (s.trigger === 'scheduled') maxDur = Math.max(maxDur, dur); console.log(vn(toMs(s.at)), '| trigger', s.trigger, '| dur', dur + 's', '| nguồn', s.sourcesCount, '| bài', s.postsFetched, '| comment', s.commentsFetched, '| bdCmt', s.bdCommentRecords, '| lead', s.leadsCreated, '| scrapeErr', s.scrapeErrors); });
console.log('max dur lượt theo lịch trong 10 lượt:', maxDur + 's', maxDur <= 120 ? '✓ (kỳ vọng ≤ ~120 s, không còn lượt 300–600 s do chờ comment)' : '⚠ vẫn có lượt dài — gửi em output này');
const pend = await db.collection('pending_snapshots').get(); let c = 0, p = 0, cOld = 0; const now = Date.now();
pend.forEach(d => { const x = d.data() || {}; if (x.kind === 'comments') { c++; if (now - (Number(x.t) || 0) > 30 * 60e3) cOld++; } else p++; });
console.log('pending_snapshots: bài (P_)', p, '| comment (C_)', c, '| comment chờ >30 phút', cOld, '(kỳ vọng: C_ nhỏ, phần lớn được gặt ở 1–2 lượt sau)');
const ss = await db.doc('system_status/brightdata').get(); console.log('system_status/brightdata:', ss.exists ? JSON.stringify({ ok: ss.data().ok, runs: ss.data().runs, at: vn(Number(ss.data().at) || 0) }) : '(chưa có)');
EOF_AFTER
node _ss23_after.mjs && rm -f _ss23_after.mjs
echo "=== log gieo/gặt comment 30 phút qua ==="
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="scheduledscan" AND (textPayload:"snapshot comment" OR textPayload:"[sowc]" OR textPayload:"fetchComments" OR textPayload:"harvestComments")' --project smartlead-z15 --freshness=30m --limit 40 --format="value(timestamp,textPayload)" | sed -E 's#[0-9]{1,3}(\.[0-9]{1,3}){3}#<IP>#g' | cut -c1-200
```

**Kỳ vọng**: 10 lượt gần nhất `dur` ≤ ~120 s kể cả lượt có `comment > 0` (trước đây lượt có comment 300–510 s); log có `GIEO snapshot comment s_… (N bai) — gat luot sau` rồi 1–2 lượt sau `GAT snapshot comment … — X comment / N bai` + `[sowc] gặt …`; `pending_snapshots` comment (C_) nhỏ, không có doc chờ >30 phút; `system_status/brightdata ok:true`. Sau khi deploy zip **v119-50** + F5: Overview không có thẻ ⛔ (vì `ok:true`); mục Chấm điểm → widget Quét tự động có ô **Nhịp gieo mỗi nguồn** (đang 10) — đổi số → Lưu → engine áp từ lượt kế (`config/app.scanIntervalMin`).

## Rollback (nếu cần)

```bash
cd ~/firebase-s13/functions && ls -1 index.js.bak-* lib/scraper.js.bak-* | tail -2
# cp index.js.bak-<TS> index.js && cp lib/scraper.js.bak-<TS> lib/scraper.js && firebase deploy --only functions:scheduledScan,functions:manualScan
# Rules: cd ~/firebase-s13 && cp firestore.rules.bak-<TS> firestore.rules && firebase deploy --only firestore:rules
```
