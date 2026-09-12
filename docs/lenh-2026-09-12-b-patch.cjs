/* LỆNH B (12/09/2026) — HƯỚNG B "1 GROUP NHIỀU BRAND" + TỐC ĐỘ + PC-4 (thiết kế docs/rasoat-scan-2026-09-11/thiet-ke-group-nhieu-brand.md §8–§9; anh chốt 12/09).
   7 file trong ~/firebase-s13/functions, marker `LENH B`, content-anchored theo MÃ ĐANG CHẠY sau #48 (fixture docs/lenh-2026-09-12-b-fixture/), FAIL-CLOSED NGUYÊN TỬ (đủ mốc CẢ 7 file mới ghi), idempotent.
   Dùng: node _lb_patch.cjs lib/config.js lib/scraper.js index.js outreach.js stats.js scanstats.js lib/multitouch.js   ·   node _lb_patch.cjs --anchors → JSON mốc (harness đối chiếu fixture = mã đang chạy).
   (1) lib/config.js   BD_MAX_TRIGGERS_PER_RUN · BD_NOTIFY_URL · BD_PROGRESS_MIN_AGE_S (120) · BD_ERROR_RECORD_BILLED (true) · SCAN_INTERVAL_MIN_FLOOR (5) · SCAN_INTERVAL_MAX_MIN (30) · SCAN_LOCK_TTL_S (1200) · BD_DEEP_SWEEP_AFTER_MIN (30) · HOUSEKEEPING_MIN (5)
                       — 3 số BrightData dashboard CHƯA có → mặc định an toàn (sàn 5′, không notify, record lỗi coi như tính tiền); có số → sửa .env, không cần deploy lại code.
   (2) lib/scraper.js  postIdB (id tất định: post_id ‖ id ‖ urlKey(url) ‖ h_<hash>, bỏ Math.random) · gidNumOfB/slugOfB · bdTriggerB (nhiều group/1 trigger, mỗi group tham số riêng, notify) · bdProgressB (429/5xx = busy)
                       · sowPostsB (gieo gộp, pending PB_<snapshot> kèm groups[]) · harvestPostsB (gặt có claim transaction, route record theo group_id số → gkey, học gid slug→số, đếm record lỗi tính tiền) · fetchComments trả sownUrls · bdRaw cho đường cũ.
   (3) index.js        khoá lượt system_status/scan_lock (transaction, TTL 1860 s ≥ timeout 1800; lịch → bỏ lượt (busyRuns), Quét ngay khi bận → 409 busy; Quét ngay = gieo NGAY mọi group + gặt cái đã chín) · Pha 1 theo GROUP gid số (gieo gộp 1 trigger/lượt cho group tới nhịp; nhịp thích ứng EWMA bậc sàn/10′/trần, đêm ×2, hysteresis, group mới = sàn, có bài mới → nhanh ngay;
                       gặt snapshot đã gieo ≥120 s hoặc notify; sweep = start_date lastSweepAt−6h + notInclude; escalate = gieo đủ 20 ngay; deep sweep 1 lần khi BrightData hồi sau ≥30′; watch_posts ≤5 bài/nguồn loại khỏi notInclude ở lượt sweep) · fan-out ứng viên cho TỪNG brand dùng chung group
                       · seen/{post_id}.brands{} (doc cũ: brand không sharedAt hoặc sharedAt < seen.at = đã xử lý) + quyết định ghi lại theo brand · score_retry R_<post_id>__<brand> + source_id · lead id tất định L_<post_id>__<brand> + create() · lead mang post_id/gid/source_id/brand_hint/shared_post/textKey, GIỮ 2 bước ghi brand (ZBS justTagged)
                       · lead_links/{gid}_{post_id} (super) · bỏ v-fixgrp + multitouch theo brand cho lead fan-out · Pha 1b: mọi brand của bài nhận bình luận; gieo bình luận CHỈ khi num_comments > 0; cmt_scrape.lastAt ghi SAU gieo OK · lượt thuần skip không ghi scans · việc phụ theo nhịp ≥5′
                       · bdwatch UP cần 2 lượt OK + deepDue · bySource brand/source_id/gid/bdShared · bd_month key s_<url>__<brand> cho nguồn dùng chung · scans thêm groups/sown/harvested/bdBusy/deepSweep/noCmt/dupLead · export sources.js (createSource · sourceOnWrite · bdReady).
   (4) outreach.js     acquireLocksB (transaction outreach_locks post_/cmt_/person_, first-come, reserved 6 h / touched 14 ngày) ở CẢ apEnqueueFunnel lẫn stepNick TRƯỚC tryConsume/genForLead · skipped_shared có retryAt = hết hạn khoá, engine xét lại · nhả khoá khi sweep44 đóng phễu.
   (5) stats.js        stopMachine nhả khoá reserved của lead.   (6) scanstats.js  brand theo row.brand/source_id (group dùng chung không dồn về 1 brand).   (7) lib/multitouch.js  gộp trong CÙNG brand (opts.brand) + PC-4 vân tay văn bản textKey (≤14 ngày, cùng brand). */
const fs = require('fs');
const ANCH = { config: {}, scraper: {}, index: {}, outreach: {}, stats: {}, scanstats: {}, multitouch: {} };
const A = (grp, k, s) => { ANCH[grp][k] = s; return s; };

/* ================= (1) lib/config.js ================= */
const CF1 = A('config', 'CF1 ZALO_CHECK_COLD', "  ZALO_CHECK_COLD: bool(env.ZALO_CHECK_COLD, false),      // true = kiểm eKYC cả lead lạnh như cũ");
const CF1_NEW = CF1 + `
  // LENH B (12/09/2026): 1 group nhiều brand + tốc độ. 3 số BrightData dashboard CHƯA có → mặc định AN TOÀN; có số thì sửa .env (không cần deploy lại code)
  BD_MAX_TRIGGERS_PER_RUN: num(env.BD_MAX_TRIGGERS_PER_RUN, 40), // số group tối đa trong 1 trigger gộp (trần snapshot đồng thời của gói)
  BD_NOTIFY_URL: env.BD_NOTIFY_URL || '',                         // gói có notify webhook → URL CF bdReady (kèm ?key=BD_NOTIFY_KEY); trống = chỉ hỏi progress
  BD_NOTIFY_KEY: env.BD_NOTIFY_KEY || '',                         // khoá xác thực webhook bdReady
  BD_PROGRESS_MIN_AGE_S: num(env.BD_PROGRESS_MIN_AGE_S, 120),    // không notify: chỉ hỏi progress snapshot đã gieo ≥ N giây (chín ~45–141 s)
  BD_ERROR_RECORD_BILLED: bool(env.BD_ERROR_RECORD_BILLED, true), // record lỗi (dead_page) có tính tiền không — chưa biết → coi là CÓ (đếm bdRecords theo raw)
  SCAN_INTERVAL_MIN_FLOOR: num(env.SCAN_INTERVAL_MIN_FLOOR, 5),   // sàn nhịp gieo (phút) khi config/app.scanIntervalMin trống; 3 chỉ khi có trần API
  SCAN_INTERVAL_MAX_MIN: num(env.SCAN_INTERVAL_MAX_MIN, 30),      // trần nhịp (group im / đêm)
  SCAN_LOCK_TTL_S: num(env.SCAN_LOCK_TTL_S, 1860),                // khoá lượt quét (transaction) — TTL ≥ timeoutSeconds 1800 + 60 (lượt vượt trần mềm 1200 vẫn giữ khoá tới khi xong)
  BD_DEEP_SWEEP_AFTER_MIN: num(env.BD_DEEP_SWEEP_AFTER_MIN, 30),  // BrightData ngưng ≥ N′ → khi hồi gieo sâu 1 lần (start_date = lúc ngưng)
  HOUSEKEEPING_MIN: num(env.HOUSEKEEPING_MIN, 5),                 // việc phụ (quét-vét eKYC, chấm lại điểm tạm, hồ sơ BD) theo nhịp ≥ N′`;

/* ================= (2) lib/scraper.js ================= */
const SR1 = A('scraper', 'SR1 normalizePost post_id', "    post_id: String(p.post_id || p.id || p.url || Math.random()),");
const SR1_NEW = "    post_id: postIdB(p), /* LENH B: id TẤT ĐỊNH (post_id ‖ id ‖ urlKey(url) ‖ h_<hash tác giả+nội dung>) — không Math.random */";
const SR2 = A('scraper', 'SR2 header map', "/* Chuẩn hoá field (tên field tuỳ dataset, map tại đây) */");
const SR2_NEW = `/* LENH B (12/09/2026): id bài tất định + gid số + gieo gộp/gặt theo group (1 group nhiều brand) */
export const urlKeyB = u => String(u || '').split(/[?#]/)[0].replace(/\\/+$/, '').toLowerCase();
export const gidNumOfB = u => { const m = String(u || '').match(/facebook\\.com\\/groups\\/(\\d{5,})(?:[\\/?#]|$)/i); return m ? m[1] : ''; };
export const slugOfB = u => { const m = String(u || '').match(/facebook\\.com\\/groups\\/([^\\/?#]+)/i); return m ? m[1].toLowerCase() : ''; };
export const hashB = s => { let h = 2166136261; const t = String(s || ''); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
export const postIdB = p => { const id = String((p && (p.post_id || p.id)) || '').trim(); if (id) return id; const uk = urlKeyB(p && (p.url || p.post_url)); if (uk) return uk; const a = String((p && (p.user_name || p.author || p.profile_id)) || ''), t = String((p && (p.content || p.post_text || p.text)) || ''); return (a || t) ? ('h_' + hashB(a + '|' + t.slice(0, 400))) : ''; };
` + SR2;
const SR3 = A('scraper', 'SR3 fetchPosts doc', "/** Lấy bài cho 1 nguồn. Trả về mảng post đã chuẩn hoá.");
const SR3_NEW = `/* ===== LENH B: gieo GỘP nhiều group trong 1 trigger (mỗi group tham số riêng) → pending_snapshots/PB_<snapshot> {kind:'posts', groups[]} → gặt lượt sau (claim transaction, route record theo group_id số) ===== */
async function bdTriggerB(items, opts = {}) {
  const body = items.map(g => { const it = { url: g.url }; if (g.numPosts) it.num_of_posts = g.numPosts; if (g.startDate) it.start_date = g.startDate; if (g.endDate) it.end_date = g.endDate; if (Array.isArray(g.notInclude) && g.notInclude.length) it.posts_to_not_include = g.notInclude.slice(0, 200); return it; });
  let url = BD + '/trigger?dataset_id=' + CFG.BRIGHTDATA_DATASET_ID + '&include_errors=true'; if (opts.notify) url += '&notify=' + encodeURIComponent(opts.notify);
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + CFG.BRIGHTDATA_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('trigger ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const j = await r.json(); if (!j || !j.snapshot_id) throw new Error('trigger: không có snapshot_id'); return j.snapshot_id;
}
export async function bdProgressB(id) { /* 'ready' | 'running' | 'failed' | 'busy' (429/5xx) | 'unknown' */
  try { const r = await fetch(BD + '/progress/' + id, { headers: { Authorization: 'Bearer ' + CFG.BRIGHTDATA_TOKEN } }); if (r.status === 429) return { st: 'busy', code: r.status }; if (r.status >= 500) return { st: 'unknown', code: r.status, err: 'HTTP ' + r.status }; /* LENH B (rà): 5xx (vd 502 nginx 10/09) = không phản hồi → bdwatch bắt DOWN, không phải busy */ let j = null; try { j = await r.json(); } catch (e) { j = null; } return { st: (j && j.status) || 'unknown', code: r.status }; }
  catch (e) { return { st: 'unknown', code: 0, err: String((e && e.message) || e).slice(0, 120) }; }
}
export async function sowPostsB(items, opts = {}) {
  const out = { sown: 0, sownKeys: [], failedKeys: [], snapshots: [], err: '' };
  if (!items.length) return out;
  if (CFG.MOCK_MODE || !CFG.BRIGHTDATA_TOKEN) { out.mock = true; return out; }
  const CH = Math.max(1, Number(opts.chunk) || 40);
  for (let i = 0; i < items.length; i += CH) {
    const chunk = items.slice(i, i + CH);
    try {
      const snap = await bdTriggerB(chunk, { notify: opts.notify });
      const ref = __pendDb().collection('pending_snapshots').doc('PB_' + String(snap).replace(/[^\\w-]/g, '_').slice(0, 470));
      const pdoc = { kind: 'posts', snapshot_id: snap, t: Date.now(), n: chunk.length, notify: !!opts.notify, ready: false, run: String(opts.runId || ''), groups: chunk.map(g => ({ gkey: g.gkey, url: g.url, sweep: !!g.sweep, deep: !!g.deep, escalate: !!g.escalate, numPosts: Number(g.numPosts) || 0 })) };
      try { await ref.set(pdoc); } catch (e) { await new Promise(s => setTimeout(s, 800)); await ref.set(pdoc); }
      out.sown += chunk.length; out.snapshots.push(snap); chunk.forEach(g => out.sownKeys.push(g.gkey));
      log.info('GIEO snapshot ' + snap + ' (' + chunk.length + ' group' + (chunk.some(g => g.sweep) ? ', sweep' : '') + (chunk.some(g => g.deep) ? ', deep' : '') + (chunk.some(g => g.escalate) ? ', escalate' : '') + ') — gat luot sau');
    } catch (e) { out.err = String((e && e.message) || e).slice(0, 200); chunk.forEach(g => out.failedKeys.push(g.gkey)); log.warn('sowPostsB gieo lo loi: ' + out.err); }
  }
  return out;
}
export async function harvestPostsB(opts = {}) {
  const res = { byKey: new Map(), pendingKeys: [], learned: new Map(), harvested: 0, pending: 0, failed: 0, busy: 0, orphan: 0, bdRaw: 0, bdGood: 0, unknown: 0, unknownKeys: [], legacy: 0 };
  if (CFG.MOCK_MODE || !CFG.BRIGHTDATA_TOKEN) return res;
  const docs = [];
  try { const qs = await __pendDb().collection('pending_snapshots').where('kind', '==', 'posts').get(); qs.forEach(d => docs.push({ ref: d.ref, p: d.data() || {} })); }
  catch (e) { log.warn('harvestPostsB: doc pending loi ' + e.message); return res; }
  const glB = Array.isArray(opts.groups) ? opts.groups.filter(g => g && g.url) : []; /* LENH B (rà): snapshot P_<url> của ĐƯỜNG CŨ (Quét thử nguồn/backfill, hoặc lượt lịch cuối trước bản B) cho URL group → gặt như 1 group (không mồ côi, không mua lại) */
  if (glB.length) { try { const snL = await __pendDb().getAll(...glB.map(g => __pendDb().collection('pending_snapshots').doc('P_' + String(g.url || '').replace(/[^\\w-]/g, '_').slice(0, 470)))); snL.forEach((d, i) => { if (!(d && d.exists)) return; const p = d.data() || {}; if (!p.snapshot_id) return; docs.push({ ref: d.ref, p: { kind: 'legacy', snapshot_id: p.snapshot_id, t: Number(p.t) || 0, ready: false, groups: [{ gkey: glB[i].gkey, url: glB[i].url, sweep: true, legacy: true, backfill: !!p.backfill }] } }); res.legacy++; }); } catch (e) {} }
  const minAge = Math.max(0, Number(opts.minAgeS) || 0) * 1000; const runId = String(opts.runId || 'run');
  const ensure = (g) => res.byKey.get(g.gkey) || (res.byKey.set(g.gkey, { g, raw: [], billed: 0 }), res.byKey.get(g.gkey));
  for (const { ref, p } of docs) {
    const id = p.snapshot_id, groups = Array.isArray(p.groups) ? p.groups : [];
    if (!id || p.harvestedAt) { try { await ref.delete(); } catch (e) {} continue; } /* LENH B (rà): doc đã gặt nhưng xoá hụt → không gặt lại (tiền/EWMA tính đôi) */
    const age = Date.now() - (Number(p.t) || 0); const maxAgeB = (groups.some(g => g && (g.deep || g.sweep || g.legacy)) ? 6 : 2) * 3600e3;
    if (!p.ready && age < minAge) { res.pending++; groups.forEach(g => res.pendingKeys.push(g.gkey)); continue; }
    let claimed = false; // 2 lượt chồng (Quét ngay ↔ lịch) không cùng gặt 1 snapshot
    try { claimed = await __pendDb().runTransaction(async tx => { const s = await tx.get(ref); if (!s.exists) return false; const d = s.data() || {}; if (d.harvestedAt) return false; if (d.claimedBy && d.claimedBy !== runId && Date.now() - (Number(d.claimedAt) || 0) < 10 * 60e3) return false; tx.update(ref, { claimedBy: runId, claimedAt: Date.now() }); return true; }); } catch (e) { claimed = false; }
    if (!claimed) { res.pending++; groups.forEach(g => res.pendingKeys.push(g.gkey)); continue; }
    const unclaim = async () => { try { await ref.update({ claimedBy: '', claimedAt: 0 }); } catch (e) {} };
    const pr = await bdProgressB(id);
    if (pr.st === 'busy') { if (age > maxAgeB) { res.failed++; try { await ref.delete(); } catch (e) {} log.warn('snapshot ' + id + ' qua han khi BrightData busy — bo'); continue; } res.busy++; res.pending++; groups.forEach(g => res.pendingKeys.push(g.gkey)); await unclaim(); log.warn('BrightData ' + pr.code + ' khi hoi progress ' + id + ' — hoan'); continue; }
    if (pr.st === 'unknown') { res.unknown++; res.pending++; groups.forEach(g => { res.pendingKeys.push(g.gkey); res.unknownKeys.push(g.gkey); }); await unclaim(); log.warn('harvestPostsB: progress ' + id + ' khong tra loi (' + (pr.err || pr.code) + ') — hoan'); continue; } /* LENH B (rà): không phản hồi ≠ đang chín → bdwatch coi là lỗi (không 'ok') */
    if (pr.st === 'failed' || (pr.st !== 'ready' && age > maxAgeB)) { res.failed++; try { await ref.delete(); } catch (e) {} log.warn('snapshot ' + id + (pr.st === 'failed' ? ' failed' : ' qua han 2h') + ' — bo'); continue; }
    if (pr.st !== 'ready') { res.pending++; groups.forEach(g => res.pendingKeys.push(g.gkey)); await unclaim(); continue; }
    let raw0 = []; try { raw0 = await bdFetch(id); } catch (e) { res.pending++; res.unknown++; groups.forEach(g => { res.pendingKeys.push(g.gkey); res.unknownKeys.push(g.gkey); }); await unclaim(); log.warn('harvestPostsB: fetch ' + id + ' loi ' + e.message); continue; }
    const byGid = new Map(), byUrl = new Map(), bySlug = new Map();
    groups.forEach(g => { const n = gidNumOfB(g.url); if (n) byGid.set(n, g); byUrl.set(urlKeyB(g.url), g); const sl = slugOfB(g.url); if (sl) bySlug.set(sl, g); });
    const good = raw0.filter(r => r && (r.post_id || r.id) && !r.error && !r.error_code && !r.warning && !r.warning_code);
    res.bdRaw += raw0.length; res.bdGood += good.length;
    if (good.length < raw0.length) log.info('stub-filter: loai ' + (raw0.length - good.length) + ' record vo-rong/error (posts, gat gop) — ' + id);
    const routeOf = r => { const gnum = String((r && r.group_id) || '').trim(); const iu = urlKeyB(r && r.input && r.input.url); const ru = String((r && (r.url || r.group_url)) || '');
      return (gnum && byGid.get(gnum)) || (iu && byUrl.get(iu)) || (gnum && bySlug.get(slugOfB(ru))) || (groups.length === 1 ? groups[0] : null); };
    for (const r of raw0) { const g = routeOf(r); if (g) ensure(g).billed++; }
    for (const r of good) {
      const g = routeOf(r); if (!g) { res.orphan++; continue; }
      const gnum = String(r.group_id || '').trim(); if (gnum && !gidNumOfB(g.url)) res.learned.set(g.gkey, gnum); // nguồn slug: học gid số từ record
      ensure(g).raw.push(r);
    }
    groups.forEach(g => ensure(g)); // group không có bài vẫn "đã gặt" (bd ok)
    res.harvested++;
    try { await ref.set({ harvestedBy: runId, harvestedAt: Date.now() }, { merge: true }); } catch (e) {}
    try { await ref.delete(); } catch (e) { try { await ref.delete(); } catch (e2) {} }
    log.info('GAT snapshot ' + id + ' — ' + good.length + ' bai / ' + groups.length + ' group' + (res.orphan ? ' (' + res.orphan + ' record khong khop group)' : ''));
  }
  return res;
}

` + SR3;
const SR4 = A('scraper', 'SR4 fetchPosts return', "  return mark(_good.map(p => normalizePost(p, source)), 'ok', { sweep: pendSweep });");
const SR4_NEW = "  return mark(_good.map(p => normalizePost(p, source)), 'ok', { sweep: pendSweep, bdRaw: raw.length }); /* LENH B: record thô (kể cả lỗi) để đếm tiền */";
const SR5 = A('scraper', 'SR5 fetchComments sown', "    let sown = 0;\n    for (let i = 0; i < urls.length; i += 50) {");
const SR5_NEW = "    let sown = 0; const sownUrls = []; /* LENH B: bài đã gieo OK → index ghi cmt_scrape.lastAt SAU khi gieo */\n    for (let i = 0; i < urls.length; i += 50) {";
const SR6 = A('scraper', 'SR6 fetchComments sown++', "        sown++; log.info('GIEO snapshot comment ' + snap + ' (' + batch.length + ' bai) — gat luot sau');");
const SR6_NEW = "        sown++; batch.forEach(u => sownUrls.push(u)); log.info('GIEO snapshot comment ' + snap + ' (' + batch.length + ' bai) — gat luot sau');";
const SR7 = A('scraper', 'SR7 fetchComments out.sown', "    try { out.sown = sown; } catch (e) {}");
const SR7_NEW = "    try { out.sown = sown; out.sownUrls = sownUrls; } catch (e) {}";
const SR8 = A('scraper', 'SR8 normalizePost num_comments', "    num_comments: Number(p.num_comments) || 0, gid: String(p.group_id || '').trim(), /* LENH #48: cho nhịp bình luận + gid số (LỆNH B) */");
const SR8_NEW = "    num_comments: (p.num_comments === null || p.num_comments === undefined || p.num_comments === '' || !Number.isFinite(Number(p.num_comments))) ? null : Number(p.num_comments), gid: String(p.group_id || '').trim(), /* LENH #48: cho nhịp bình luận + gid số (LỆNH B) · LENH B (rà): record THIẾU field → null = chưa biết (vẫn gieo bình luận), 0 thật mới bỏ */";

/* ================= (3) index.js ================= */
const IX1 = A('index', 'IX1 loadSources', "  snap.forEach(d => { const s = d.data(); if (s.active !== false) out.push(s); });");
const IX1_NEW = "  snap.forEach(d => { const s = d.data(); if (s.active !== false) { s.__id = d.id; out.push(s); } }); /* LENH B: giữ doc id nguồn (source_id) — khoá mọi bookkeeping theo nguồn thay tên/URL */";
const IX2 = A('index', 'IX2 groupStateDoc', "const groupStateDoc = url => db.collection('group_state').doc(String(url || '').replace(/[^\\w-]/g, '_').slice(0, 480));");
const IX2_NEW = IX2 + String.raw`
/* ===== LENH B (12/09/2026) — helper: gid số / slug / id tất định / vân tay văn bản / khoá lượt / nhịp thích ứng ===== */
const gidNumB = u => { const m = String(u || '').match(/facebook\.com\/groups\/(\d{5,})(?:[\/?#]|$)/i); return m ? m[1] : ''; };
const slugB = u => { const m = String(u || '').match(/facebook\.com\/groups\/([^\/?#]+)/i); return m ? m[1].toLowerCase() : ''; };
const tsMsB = v => !v ? 0 : (typeof v === 'number' ? v : (typeof v.toMillis === 'function' ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (v instanceof Date ? v.getTime() : (Date.parse(v) || 0)))));
const slugIdB = s => String(s || '').replace(/[^\w-]/g, '_');
const leadIdB = (postId, brand) => 'L_' + slugIdB(postId).slice(0, 200) + '__' + slugIdB(brand).slice(0, 60);
const linkIdB = (gid, postId) => (slugIdB(gid).slice(0, 40) + '_' + slugIdB(postId).slice(0, 200));
const textKeyB = text => { const s = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160); if (s.length < 24) return ''; let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return 'tk_' + h.toString(36); };
let __lockHolderB = '';
async function acquireScanLockB(trigger, runId) { /* khoá lượt: transaction system_status/scan_lock, TTL SCAN_LOCK_TTL_S — maxInstances:1 KHÔNG chống 2 lượt chồng (containerConcurrency 80, manualScan là service riêng) */
  const ref = db.collection('system_status').doc('scan_lock'); const ttl = Math.max(60, Number(CFG.SCAN_LOCK_TTL_S) || 1200) * 1000; const now = Date.now();
  try { const r = await db.runTransaction(async tx => { const s = await tx.get(ref); const d = s.exists ? (s.data() || {}) : {}; if (d.holder && d.holder !== runId && (Number(d.expireAt) || 0) > now) return { ok: false, holder: d.holder, trigger: d.trigger || '', since: Number(d.at) || 0 }; tx.set(ref, { holder: runId, trigger, at: now, expireAt: now + ttl }); return { ok: true }; }); if (r.ok) __lockHolderB = runId; return r; }
  catch (e) { console.log(JSON.stringify({ severity: 'WARNING', message: '[SCAN-LOCK] khoá lượt lỗi (fail-open, lượt vẫn chạy): ' + String((e && e.message) || e).slice(0, 160) })); return { ok: true, err: String((e && e.message) || e).slice(0, 120) }; }
}
async function releaseScanLockB(runId) { const id = runId || __lockHolderB; if (!id) return; const ref = db.collection('system_status').doc('scan_lock'); try { await db.runTransaction(async tx => { const s = await tx.get(ref); if (s.exists && (s.data() || {}).holder === id) tx.set(ref, { holder: '', releasedAt: Date.now(), expireAt: 0, lastHolder: id }, { merge: true }); }); } catch (e) {} if (__lockHolderB === id) __lockHolderB = ''; }
/* nhịp thích ứng theo EWMA bài mới/giờ (τ 60′): ≥4/giờ (≈100/ngày) → sàn · ≥0,4/giờ (≈10/ngày) → 10′ · ít hơn → trần; hysteresis ±20 %; group mới (<2 mẫu) = sàn; vừa có bài mới (<30′) = sàn; im ≥6 h ban ngày = trần; đêm 23–6 h ×2 (trần) */
function ivB(gs, floorMin, maxMin, night, now) {
  const rate = Number(gs && gs.rate) || 0, n = Number(gs && gs.rateN) || 0, band = String((gs && gs.band) || ''); const FAST = 4, MID = 0.4;
  const fast = band === 'fast' ? rate >= FAST * 0.8 : rate >= FAST * 1.2, mid = (band === 'mid' || band === 'fast') ? rate >= MID * 0.8 : rate >= MID * 1.2;
  let nb = n < 2 ? 'fast' : (fast ? 'fast' : (mid ? 'mid' : 'slow'));
  const lastPost = Number(gs && gs.lastPostAt) || 0; if (lastPost && now - lastPost < 30 * 60e3) nb = 'fast';
  let m = nb === 'fast' ? floorMin : (nb === 'mid' ? Math.max(floorMin, 10) : maxMin);
  if (!night && n >= 2 && rate < MID && (!lastPost || now - lastPost > 6 * 3600e3)) { nb = 'idle'; m = maxMin; }
  if (night) m = Math.min(maxMin, m * 2);
  return { iv: Math.max(3, Math.min(maxMin, Math.round(m))), band: nb };
}
/* LENH B: bọc scanAll = khoá lượt cho MỌI trigger — lịch gặp khoá → bỏ lượt (không ghi scans); Quét ngay/backfill → ném busy (manualScan trả 409) */
async function scanAll(trigger = 'scheduled', opts = {}) {
  const runId = trigger + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const lk = await acquireScanLockB(trigger, runId);
  if (!lk.ok) {
    console.log('[SCAN-BUSY] lượt ' + trigger + ' bỏ qua — đang có lượt ' + (lk.trigger || '?') + ' (' + (lk.holder || '') + ') chạy từ ' + (lk.since ? Math.round((Date.now() - lk.since) / 1000) + ' s trước' : '?'));
    try { await db.collection('system_status').doc('scan').set({ busyRuns: FieldValue.increment(1), lastBusyAt: Date.now(), lastBusyHolder: String(lk.holder || '') }, { merge: true }); } catch (_) {} /* LENH B (rà): lượt bỏ vì khoá có dấu vết */
    if (trigger === 'scheduled') return { scanned: 0, matched: 0, kept: 0, hot: 0, durationMs: 0, tokensTotal: 0, costUsd: 0, scanId: null, jobId: opts.jobId || null, busy: true };
    const e = new Error('Đang có lượt quét khác chạy — thử lại sau ít phút'); e.code = 'busy'; e.holder = lk.holder || ''; throw e;
  }
  try { return await scanAllB0(trigger, Object.assign({}, opts, { __runIdB: runId })); } finally { await releaseScanLockB(runId); }
}`;
const IX48 = A('index', 'IX48 sowMode', "  const sowMode = trigger === 'scheduled' && !force && !(opts.startDate || opts.endDate) && CFG.BD_SOW_MODE !== false;");
const IX48_NEW = "  const quickManualB = trigger !== 'scheduled' && !force && !(opts.startDate || opts.endDate) && !opts.sourceUrl; /* LENH B (rà): Quét ngay = gieo NGAY mọi group + gặt snapshot đã chín (không chờ 90 s/nguồn giữ khoá lượt ~12′; bài về ở lượt lịch kế ≤3′) */\n  const sowMode = (trigger === 'scheduled' || quickManualB) && !force && !(opts.startDate || opts.endDate) && CFG.BD_SOW_MODE !== false;";
const IX49 = A('index', 'IX49 sowMetaOf', "    const sowMetaOf = (u) => { const c = ctx.get(urlKey(u)); return c ? { url: u, srcUrl: String((c.src && c.src.url) || ''), parentUrl: c.parentUrl || u,");
const IX49_NEW = "    const sowMetaOf = (u) => { const c = ctx.get(urlKey(u)); return c ? { url: u, srcUrl: String((c.src && c.src.url) || ''), gkey: gkeyByUrlB.get(urlKey(String((c.src && c.src.url) || ''))) || '', parentUrl: c.parentUrl || u,"; /* LENH B (rà): meta mang gkey → nguồn gieo tắt vẫn gặt được cho brand khác cùng group */
const IX50 = A('index', 'IX50 scanAll return', "  return { scanned, matched, kept, hot, durationMs, tokensTotal: tokTotal, costUsd, scanId, jobId: opts.jobId || null };");
const IX50_NEW = "  return { scanned, matched, kept, hot, durationMs, tokensTotal: tokTotal, costUsd, scanId, jobId: opts.jobId || null, sown: sownB, harvested: harvestedB }; /* LENH B: Quét ngay trả thêm số group đã gieo/gặt */";
const IX51 = A('index', 'IX51 bdwatch cond', "    if (nBd >= 1 && bdErrs.length >= Math.min(3, nBd) && bdOks.length === 0) {");
const IX51_NEW = "    if (nBd >= 1 && ((bdErrs.length >= Math.min(3, nBd) && bdOks.length === 0) || sowFailB)) { /* LENH B (rà): trigger gộp LỖI cho mọi group tới hạn = ngưng, kể cả khi lượt này vừa gặt được snapshot cũ (bd ok) */";
const IX52 = A('index', 'IX52 prefiltered_out', "      else { recordPost(x, { decision: 'prefiltered_out' }); await unlease48(x); }");
const IX52_NEW = "      else { if (x.post.kind !== 'comment' && x.gkeyB && !x.post.__watch && x.post.num_comments === 0) watchAddB(x.gkeyB, x.post, 0); /* LENH B (rà): bài rớt tầng 1 (đa số là bài CHÀO BÁN của người khác) 0 bình luận → theo dõi ưu tiên thấp — bình luận đến sau dưới bài người bán = 44 % comment-lead */ recordPost(x, { decision: 'prefiltered_out' }); await unlease48(x); }";
const IX3 = A('index', 'IX3 scanAll head', "async function scanAll(trigger = 'scheduled', opts = {}) {\n  const t0 = Date.now();");
const IX3_NEW = "async function scanAllB0(trigger = 'scheduled', opts = {}) { /* LENH B: thân lượt quét (khoá lượt ở scanAll) */\n  const t0 = Date.now();";
const IX4 = A('index', 'IX4 runId48', "  const runId48 = trigger + '_' + t0.toString(36) + '_' + Math.random().toString(36).slice(2, 8);");
const IX4_NEW = "  const runId48 = String(opts.__runIdB || '') || (trigger + '_' + t0.toString(36) + '_' + Math.random().toString(36).slice(2, 8)); /* LENH B: id lượt = holder khoá */";
const IX5 = A('index', 'IX5 retryRef48', "  const retryRef48 = p => { const key = String((p && p.post_id) || '').replace(/[^\\w-]/g, '_').slice(0, 470); return key ? db.collection('score_retry').doc('R_' + key) : null; };");
const IX5_NEW = "  const retryRef48 = p => { const key = String((p && p.post_id) || '').replace(/[^\\w-]/g, '_').slice(0, 400) + ((p && p.__brand) ? '__' + slugIdB(p.__brand).slice(0, 60) : ''); return key ? db.collection('score_retry').doc('R_' + key) : null; }; /* LENH B: 1 doc chờ / bài / brand */";
const IX6 = A('index', 'IX6 flushPosts head', "  async function flushPosts(force) {\n    if (flushingPosts) return;");
const IX6_NEW = "  async function flushPosts(force) {\n    await flushSeenB(force); /* LENH B: quyết định theo brand → seen.brands */\n    if (flushingPosts) return;";
const IX7 = A('index', 'IX7 recordPost head', "  function recordPost(x, fields) {\n    if (!logPosts) return;\n    const kept = !!fields.kept;");
const IX7_NEW = String.raw`  /* LENH B: quyết định của TỪNG brand ghi lại seen/{post_id}.brands[brand] (lead/low/pre/ex/self/seller); ai_wait/error giữ 'pending' */
  const seenUpdB = new Map(); const SEEN_DEC_B = { lead: 'lead', scored_low: 'low', prefiltered_out: 'pre', excluded: 'ex', no_keyword: 'ex', self_comment: 'self', seller: 'seller' };
  function seenDecB(x, decision) { const bX = x && x.brandB; const dec = SEEN_DEC_B[String(decision || '')]; if (!bX || !dec || !x.post || !x.post.post_id) return; const pid = String(x.post.post_id); const o = seenUpdB.get(pid) || {}; o[bX] = dec; seenUpdB.set(pid, o); }
  async function flushSeenB(force) { if (!seenUpdB.size || (!force && seenUpdB.size < 25)) return; const ents = [...seenUpdB]; seenUpdB.clear(); for (let i = 0; i < ents.length; i += 400) { const wb = db.batch(); ents.slice(i, i + 400).forEach(([pid, brands]) => wb.set(seenDoc(pid), { brands }, { merge: true })); try { await wb.commit(); } catch (e) { console.warn('[seen] ghi quyết định theo brand lỗi:', e && e.message); } } }
  function recordPost(x, fields) {
    seenDecB(x, fields && fields.decision);
    if (!logPosts) return;
    const kept = !!fields.kept;`;
const IX8 = A('index', 'IX8 recordPost brand', "      brand: String(brandBySource[x.post.source || x.src.name || ''] || '').trim(), // v87 dong-dau brand tung bai");
const IX8_NEW = "      brand: String((x.brandB) || (x.src && x.src.__id && x.src.brand) || brandBySource[x.post.source || x.src.name || ''] || '').trim(), /* v87 · LENH B: brand theo nguồn fan-out */ gid: String((x.post && x.post.gid) || ''), source_id: String((x.src && x.src.__id) || ''), shared_post: !!(x.post && x.post.shared),";
const IX9 = A('index', 'IX9 status starting', "  try { await db.collection('system_status').doc('scan').set({ phase: 'starting', at: Date.now(), runId: runId48, trigger, lastStartAt: Date.now() }, { merge: true }); } catch (_) {} // LENH #48 (PB-1e)");
const IX9_NEW = "  /* LENH B (T-6): việc phụ (hồ sơ BD, quét-vét eKYC, chấm lại điểm tạm) theo nhịp HOUSEKEEPING_MIN; lượt thuần skip không ghi scans */\n  const stScanB = await db.collection('system_status').doc('scan').get().then(s => (s.exists ? (s.data() || {}) : {})).catch(() => ({}));\n  const hkDueB = !sowMode || (Date.now() - (Number(stScanB.lastHousekeepingAt) || 0)) >= Math.max(1, Number(CFG.HOUSEKEEPING_MIN) || 5) * 60e3;\n" + IX9;
const IX10 = A('index', 'IX10 bdProfCollect', "  try { await __bdProfCollect(); } catch (e) { console.error('[profile-scan] collect:', (e&&e.message)||e); }");
const IX10_NEW = "  if (hkDueB) { try { await __bdProfCollect(); } catch (e) { console.error('[profile-scan] collect:', (e&&e.message)||e); } } /* LENH B: theo nhịp việc phụ */";
const IX11 = A('index', 'IX11 counters', "  let probeRuns = 0, sweepRuns = 0, probeEscalated = 0, probeIdle = 0, bdRecords = 0, authCheckpoints = 0, authRuns = 0;");
const IX11_NEW = IX11 + String.raw`
  /* LENH B: trạng thái Pha 1 theo GROUP */
  let nGroupsB = 0, sharedGroupsB = 0, sownB = 0, harvestedB = 0, bdBusyB = 0, deepB = 0, noCmtB = 0, dupLeadB = 0, hvHarvestedB = 0, hvOrphanB = 0, gidLearnedB = 0, sweepRecordsB = 0, escalatedB = 0, dupSrcB = 0, sowFailB = false; const dupIdsB = new Set();
  const gkeyBySrcIdB = new Map(), gkeyByUrlB = new Map(), gidByGkeyB = new Map(), seenCacheB = new Map(), effCacheB = new Map(), watchAddsB = new Map(), gsAllB = new Map(), leaseSeenB = new Set();
  const effOfB = s => { const k = s && s.__id ? s.__id : s; if (!effCacheB.has(k)) effCacheB.set(k, { ...s, keywords: [...(s.keywords || []), ...gKw], exclude: [...(s.exclude || []), ...gEx] }); return effCacheB.get(k); };
  const rowOfB = s => { let r = bySource.find(rr => s.__id ? rr.source_id === s.__id : rr.url === String(s.url || '')); if (!r) { r = { name: s.name || '', industry: s.industry || '', url: s.url || '', brand: String(s.brand || '').trim(), source_id: String(s.__id || ''), gid: gidNumB(s.url) || String(s.gid || ''), posts: 0, matched: 0, leads: 0, hot: 0, error: null, bdPosts: 0, bdComments: 0, ekyc: 0 }; bySource.push(r); } return r; };
  const watchAddB = (gk, post, pri) => { if (!gk || !post || !post.post_id) return; const m = watchAddsB.get(gk) || (watchAddsB.set(gk, {}).get(gk)); const k = String(post.post_id); if (m[k] && (Number(m[k].pri) || 0) >= (Number(pri) || 0)) return; m[k] = { url: String(post.url || '').slice(0, 300), at: Date.now(), checks: 0, pri: Number(pri) || 0 }; }; /* LENH B (rà): pri 2 = lead · 1 = AI chấm không lead (người bán…) · 0 = rớt tầng 1; trần ≤5/group áp lúc ghi theo pri */
  async function buildGroupsB(list) { /* nhóm nguồn theo group: gid số từ URL/field gid → g_<num>; slug → g_<num> nếu đã học (group_state/s_<slug>.gidNum) không thì s_<slug>; nguồn chủ = sharedAt nhỏ nhất/không có */
    const groups = new Map(); if (!list.length) return groups;
    const slugKeys = [...new Set(list.map(s => (gidNumB(s.url) || /^\d{5,}$/.test(String(s.gid || '').trim())) ? '' : (slugB(s.url) ? 's_' + slugB(s.url) : '')).filter(Boolean))];
    const learned = new Map(); try { const sn = slugKeys.length ? await db.getAll(...slugKeys.map(k => db.collection('group_state').doc(k))) : []; sn.forEach((d, i) => { const g = (d && d.exists) ? (d.data() || {}) : null; if (g && g.gidNum) learned.set(slugKeys[i], String(g.gidNum)); }); } catch (e) {}
    for (const s of list) {
      const n = gidNumB(s.url) || (/^\d{5,}$/.test(String(s.gid || '').trim()) ? String(s.gid).trim() : ''); const sl = slugB(s.url);
      const gk = n ? 'g_' + n : (sl ? (learned.get('s_' + sl) ? 'g_' + learned.get('s_' + sl) : 's_' + sl) : '');
      if (!gk) continue; // không phải URL group → đường cũ tự xử lý
      const g = groups.get(gk) || (groups.set(gk, { gkey: gk, gidNum: gk.startsWith('g_') ? gk.slice(2) : '', slug: sl, sources: [], url: '', primary: null }).get(gk));
      g.sources.push(s);
    }
    for (const g of groups.values()) { g.sources.sort((a, b) => ((tsMsB(a.sharedAt) || 0) - (tsMsB(b.sharedAt) || 0)) || String(a.name || '').localeCompare(String(b.name || '')));
      { const seenBr = new Set(); const keep = []; for (const s of g.sources) { const bk = String(s.brand || '').trim() || ('_' + s.__id); if (seenBr.has(bk)) { const row = rowOfB(s); row.bd = 'skip'; row.error = 'trùng nguồn cùng brand trong 1 group (bỏ qua — dùng nguồn "' + String((keep.find(z => (String(z.brand || '').trim() || ('_' + z.__id)) === bk) || {}).name || '') + '")'; dupSrcB++; dupIdsB.add(s.__id); continue; } seenBr.add(bk); keep.push(s); } g.sources = keep; } /* LENH B (rà): 2 doc nguồn cùng brand cùng group (slug + số) → 1 ứng viên/brand, không lease trùng */
      g.primary = g.sources[0]; g.url = g.primary.url; if (!g.slug) g.slug = slugB(g.url); g.sources.forEach(s => { gkeyBySrcIdB.set(s.__id, g.gkey); gkeyByUrlB.set(urlKey(s.url), g.gkey); const row = rowOfB(s); row.gid = g.gidNum || row.gid; row.bdShared = g.sources.length > 1 && s !== g.primary; }); gidByGkeyB.set(g.gkey, g.gidNum); } /* LENH B (rà): bdShared đặt ở cả 2 đường (Quét ngay/backfill cũng tách key bd_month) */
    return groups;
  }
  const fanoutLegacyB = (groups) => { /* Quét ngay/backfill: bài của nguồn chủ → ứng viên cho MỌI brand dùng chung group */
    const base = collected.slice(); for (const x of base) { if (x.post.kind === 'comment') continue; const gk = gkeyBySrcIdB.get(x.src && x.src.__id); const g = gk && groups.get(gk); if (!g) continue; const sh = g.sources.length > 1;
      x.brandB = String(x.src.brand || '').trim(); x.gkeyB = gk; x.post.gid = g.gidNum || ''; x.post.shared = sh; x.post.__brand = x.brandB;
      for (const s of g.sources) { if (s === x.src) continue; const row = rowOfB(s); row.posts++; scanned++; collected.push({ post: Object.assign({}, x.post, { source: s.name, __brand: String(s.brand || '').trim() }), effSrc: effOfB(s), src: s, row, brandB: String(s.brand || '').trim(), gkeyB: gk }); } } };
  async function flushWatchB() { /* watch_posts: bài đã ra lead nhưng 0 bình luận lúc gặt → ghi group_state.watch (≤5/nguồn) để lượt sweep loại khỏi notInclude (record trả lại với num_comments) */
    const expB = it => (Number(it && it.checks) || 0) >= 4 || Date.now() - (Number(it && it.at) || 0) > 2 * 86400e3;
    const keysB = new Set(watchAddsB.keys()); for (const [k0, gs0] of gsAllB) { if (gs0 && gs0.watch && typeof gs0.watch === 'object' && Object.values(gs0.watch).some(expB)) keysB.add(k0); } /* LENH B (rà): dọn entry hết hạn cả khi không có bài mới */
    if (!keysB.size) return; const wb = db.batch(); let n = 0; const cap = Math.max(1, Number(CFG.WATCH_POSTS_PER_SOURCE) || 5);
    for (const gk of keysB) { const adds = watchAddsB.get(gk) || {}; const gs = gsAllB.get(gk) || {}; const cur = (gs.watch && typeof gs.watch === 'object') ? gs.watch : {}; const w = {}; let live = 0;
      for (const [id, it] of Object.entries(cur)) { if (expB(it)) w[id] = FieldValue.delete(); else live++; }
      for (const [id, it] of Object.entries(adds).sort((a, b) => ((Number(b[1].pri) || 0) - (Number(a[1].pri) || 0)) || ((Number(b[1].at) || 0) - (Number(a[1].at) || 0)))) { if (cur[id] || live >= cap) continue; w[id] = it; live++; }
      if (Object.keys(w).length) { wb.set(db.collection('group_state').doc(gk), { watch: w, watchAt: Date.now() }, { merge: true }); n++; } }
    if (n) { try { await wb.commit(); } catch (e) { console.warn('[B] ghi watch_posts lỗi:', e && e.message); } }
  }`;
/* --- IX12: Pha 1 — thay khối mapPool(sources) bằng: legacyPha1B(list) (đường cũ giữ nguyên, chỉ đổi tên biến vòng lặp) + pha1B(groups) theo GROUP + điều phối */
const IX12_A = A('index', 'IX12 Pha1 head', "  await mapPool(sources, 3, async (src) => {\n    // v-patch chi-phí 16/08: bdPosts/bdComments = record BrightData TÍNH TIỀN (đếm TRƯỚC khi cắt seen);");
const IX12_B = A('index', 'IX12 Pha1 tail', "    srcDone++; await prog('scraping');\n  });");
const IX12_ROW = "    const row = { name: src.name || '', industry: src.industry || '', url: src.url || '', posts: 0, matched: 0, leads: 0, hot: 0, error: null, bdPosts: 0, bdComments: 0, ekyc: 0 };\n    bySource.push(row);";
const IX12_ROW_NEW = "    const row = rowOfB(src); /* LENH B: 1 dòng/nguồn (brand, source_id, gid) — dùng chung với đường group */";
const IX12_BD1 = "      bdRecords += posts.length; row.bdPosts += posts.length;";
const IX12_BD1_NEW = "      { const nb = (CFG.BD_ERROR_RECORD_BILLED !== false && Number(posts.bdRaw) > posts.length) ? Number(posts.bdRaw) : posts.length; bdRecords += nb; row.bdPosts += nb; } /* LENH B: record lỗi cũng tính tiền (mặc định) */";
const PHA1B = String.raw`
  /* ===== LENH B (12/09/2026) — PHA 1 THEO GROUP (gid số): gặt snapshot gộp đã chín → fan-out ứng viên cho từng brand dùng chung group; gieo GỘP 1 trigger/lượt cho group tới nhịp (thích ứng);
     sweep = start_date lastSweepAt−6h + notInclude; probe đầy bài mới → gieo đủ POSTS_PER_GROUP ngay; deep sweep 1 lần khi BrightData hồi sau ≥ BD_DEEP_SWEEP_AFTER_MIN; watch_posts loại khỏi notInclude ở lượt sweep ===== */
  const pha1B = async (groups, pOpts) => { pOpts = pOpts || {};
    const SRB = await import('./lib/scraper.js');
    const nowB = Date.now(); const stBd = await db.collection('system_status').doc('brightdata').get().catch(() => null); const stBdD = (stBd && stBd.exists) ? (stBd.data() || {}) : {};
    for (const g of groups.values()) g.sources.forEach(s => { const row = rowOfB(s); row.gid = g.gidNum || row.gid; row.bdShared = g.sources.length > 1 && s !== g.primary; });
    const gkeys = [...groups.keys()]; if (!gkeys.length) return;
    const aliasB = new Map(); for (const g of groups.values()) { if (g.slug) aliasB.set('s_' + g.slug, g.gkey); if (g.gidNum) aliasB.set('g_' + g.gidNum, g.gkey); } const grpOfB = k => groups.get(k) || groups.get(aliasB.get(k)); const keyOfB = g => (g.gidNum ? 'g_' + g.gidNum : g.gkey); /* LENH B (rà): nguồn slug học gid TRONG lượt → snapshot gieo cùng lượt mang khoá g_<num>; khoá cũ s_<slug> (snapshot đang chín) resolve qua alias — không mồ côi */
    // group_state theo gkey (migration: chưa có → đọc doc cũ theo URL nguồn chủ)
    let gsNew = []; try { gsNew = await db.getAll(...gkeys.map(k => db.collection('group_state').doc(k))); } catch (e) { gsNew = []; }
    const oldNeed = gkeys.filter((k, i) => !(gsNew[i] && gsNew[i].exists));
    let gsSlug = [], gsOld = []; // migration: g_<num> chưa có → s_<slug> (group vừa học gid) → doc cũ theo URL nguồn chủ
    try { gsSlug = oldNeed.length ? await db.getAll(...oldNeed.map(k => db.collection('group_state').doc('s_' + (groups.get(k).slug || '-')))) : []; } catch (e) { gsSlug = []; }
    try { gsOld = oldNeed.length ? await db.getAll(...oldNeed.map(k => groupStateDoc(groups.get(k).url))) : []; } catch (e) { gsOld = []; }
    gkeys.forEach((k, i) => { const sn = gsNew[i]; if (sn && sn.exists) gsAllB.set(k, sn.data() || {}); });
    oldNeed.forEach((k, i) => { if (gsAllB.has(k)) return; const ss = gsSlug[i]; if (ss && ss.exists && k.startsWith('g_')) { gsAllB.set(k, Object.assign({}, ss.data() || {}, { migratedFrom: 's_' + groups.get(k).slug })); return; }
      const sn = gsOld[i]; if (sn && sn.exists) { const d = sn.data() || {}; gsAllB.set(k, { url: d.url || '', lastTriggerAt: Number(d.lastTriggerAt) || 0, lastSweepAt: tsMsB(d.lastSweepAt) || 0, recentIds: Array.isArray(d.recentIds) ? d.recentIds : [], migratedFrom: 'url' }); } });
    const gsWrite = new Map(); const upd = (k, patch) => gsWrite.set(k, Object.assign(gsWrite.get(k) || {}, patch));
    for (const k of oldNeed) { const m0 = gsAllB.get(k); if (m0 && m0.migratedFrom) { const seed = Object.assign({}, m0); delete seed.migratedFrom; upd(k, seed); } } /* LENH B (rà): doc g_<num> mới ghi KÈM lastTriggerAt/lastSweepAt/recentIds/rate/watch di trú (không thì lượt kế thấy doc trống → gieo sớm + sweep notInclude rỗng 1 lần) */
    // (a) GẶT
    const hv = await SRB.harvestPostsB({ runId: runId48, minAgeS: CFG.BD_PROGRESS_MIN_AGE_S, groups: [...groups.values()].flatMap(g => g.sources.map(s => ({ gkey: g.gkey, url: String(s.url || '') }))) });
    harvestedB = hv.harvested; bdBusyB = hv.busy; hvOrphanB += hv.orphan || 0;
    for (const gk of new Set(hv.unknownKeys || [])) { const g = grpOfB(gk); if (g) g.sources.forEach(s => { const row = rowOfB(s); row.bd = 'skip'; row.error = 'BrightData không phản hồi progress/snapshot (fetch failed)'; scrapeErrors++; }); } /* LENH B (rà): mất kết nối BrightData khi có snapshot chờ → không đánh 'ok' → bdwatch bắt DOWN đúng lượt */
    const collKeyB = new Set(); /* LENH B (rà): 2 snapshot cùng group trong 1 lượt (probe đang chín + deep/escalate) → không đưa cùng (bài, brand) vào ứng viên 2 lần */
    for (const [gk, e] of hv.byKey) {
      const g = grpOfB(gk); if (!g) { hvOrphanB += e.raw.length; continue; } // group đã tắt/đổi → bỏ (nguồn tắt tạm = chấp nhận)
      const gs = Object.assign({}, gsAllB.get(g.gkey) || {}, gsWrite.get(g.gkey) || {});
      g.sources.forEach(s => { const row = rowOfB(s); row.bd = 'ok'; if (s === g.primary) { const nb = CFG.BD_ERROR_RECORD_BILLED !== false ? e.billed : e.raw.length; row.bdPosts += nb; bdRecords += nb; } });
      const learned = hv.learned.get(gk); if (learned && !g.gidNum) { upd('s_' + g.slug, { gidNum: learned, url: g.url }); g.gidNum = learned; gidByGkeyB.set(g.gkey, learned); aliasB.set('g_' + learned, g.gkey); g.sources.forEach(s => { rowOfB(s).gid = learned; db.collection('sources').doc(s.__id).set({ gid: learned }, { merge: true }).catch(() => {}); }); gidLearnedB++; }
      const posts0 = e.raw.map(r => SRB.normalizePost(r, g.primary)); const ids = posts0.map(p => String(p.post_id)).filter(Boolean);
      let seenSn = []; try { seenSn = ids.length ? await db.getAll(...ids.map(id => seenDoc(id))) : []; } catch (er) { seenSn = []; }
      let newN = 0; ids.forEach((id, i) => { const sn = seenSn[i] || null; seenCacheB.set(id, sn); if (!(sn && sn.exists)) newN++; });
      const prevAt = Number(gs.lastHarvestAt) || 0; let rate = Number(gs.rate) || 0, samples = Number(gs.rateN) || 0;
      if (!e.g.sweep && !e.g.deep) { const dtH = prevAt ? Math.max(1 / 60, (nowB - prevAt) / 3600e3) : 0; if (dtH) { const alpha = 1 - Math.exp(-dtH); rate = rate + alpha * ((newN / dtH) - rate); } else rate = newN; samples++; }
      upd(g.gkey, Object.assign({ url: g.url, gidNum: g.gidNum || '', lastHarvestAt: nowB, rate: Math.round(rate * 1000) / 1000, rateN: samples, lastPostAt: newN ? nowB : (Number(gs.lastPostAt) || 0), recentIds: [...new Set([...ids, ...(Array.isArray(gs.recentIds) ? gs.recentIds : [])])].slice(0, 200), recentIdsAt: nowB, brands: g.sources.map(s => String(s.brand || '').trim()) }, newN ? { band: 'fast' } : {}));
      if (e.g.sweep) { sweepRuns++; sweepRecordsB += e.raw.length; } else if (!e.g.deep && !e.g.escalate) probeRuns++;
      if (e.g.deep) deepB++;
      const wantN = Number(e.g.numPosts) || 0; if (!e.g.sweep && !e.g.deep && !e.g.escalate && wantN && posts0.length >= wantN && newN >= posts0.length) { g.escalate = true; probeEscalated++; }
      if (posts0.length && newN === 0 && !e.g.sweep && !e.g.deep) probeIdle++;
      const watch = (gs.watch && typeof gs.watch === 'object') ? gs.watch : {};
      e.raw.forEach((r, i) => { const base = posts0[i]; const sn = seenCacheB.get(String(base.post_id)); const isNew = !(sn && sn.exists); const watched = !isNew && !!watch[String(base.post_id)] && Number(base.num_comments) > 0;
        g.sources.forEach(s => { const p = Object.assign(SRB.normalizePost(r, s), { gid: g.gidNum || '', shared: g.sources.length > 1, __brand: String(s.brand || '').trim(), __watch: watched }); const ck = String(p.post_id) + '|' + String(s.brand || '').trim(); if (collKeyB.has(ck)) return; collKeyB.add(ck); const row = rowOfB(s); if (isNew) { row.posts++; scanned++; } collected.push({ post: p, effSrc: effOfB(s), src: s, row, brandB: String(s.brand || '').trim(), gkeyB: g.gkey }); }); }); /* LENH B (rà): posts/scanned chỉ đếm bài MỚI (như leadingNew cũ; bdPosts = record tính tiền) */
    }
    // (b) GIEO
    const pendingKeys = new Set((hv.pendingKeys || []).map(k => { const g0 = grpOfB(k); return g0 ? g0.gkey : k; }));
    if (hv.busy) for (const gk of pendingKeys) { const g = groups.get(gk); if (g) g.sources.forEach(s => { const row = rowOfB(s); row.bd = 'busy'; row.error = 'BrightData tạm quá tải (rate limit) khi hỏi progress — hoãn gặt/gieo, không tính là ngưng'; }); }
    const floorMin = Math.max(3, Number(config.scanIntervalMin) || Number(CFG.SCAN_INTERVAL_MIN_FLOOR) || 5), maxMin = Math.max(floorMin, Number(config.scanIntervalMaxMin) || Number(CFG.SCAN_INTERVAL_MAX_MIN) || 30);
    const vnH = new Date(nowB + 7 * 3600e3).getUTCHours(); const night = vnH >= 23 || vnH < 6;
    const deepDue = (stBdD.deepDue && typeof stBdD.deepDue === 'object' && !stBdD.deepDue.doneAt) ? stBdD.deepDue : null;
    const items = [];
    for (const g of groups.values()) {
      const gs = Object.assign({}, gsAllB.get(g.gkey) || {}, gsWrite.get(g.gkey) || {});
      if (pendingKeys.has(g.gkey) && !deepDue && !g.escalate) { g.sources.forEach(s => { const row = rowOfB(s); if (!row.bd) row.bd = 'ok'; }); continue; } // snapshot đang chín → chờ (deep/escalate vẫn gieo)
      const adapt = ivB(gs, floorMin, maxMin, night, nowB); const ovr = Math.max(0, ...g.sources.map(s => Number(s.scanIntervalMin) || 0)); const ivMin = ovr > 0 ? Math.max(3, ovr) : adapt.iv;
      upd(g.gkey, { iv: ivMin, band: adapt.band, url: g.url });
      const due = !!(g.escalate || deepDue || pOpts.forceDue) || (nowB - (Number(gs.lastTriggerAt) || 0)) >= ivMin * 60e3; /* LENH B (rà): Quét ngay → mọi group tới hạn (snapshot đang chín thì vẫn chờ) */
      if (!due) { g.sources.forEach(s => { const row = rowOfB(s); if (!row.bd) row.bd = 'skip'; }); continue; }
      if (hv.busy && !g.escalate) { g.sources.forEach(s => { const row = rowOfB(s); row.bd = 'busy'; row.error = 'BrightData tạm quá tải (rate limit) — hoãn gieo, không tính là ngưng'; }); continue; }
      const recent = Array.isArray(gs.recentIds) ? gs.recentIds : []; const watch = (gs.watch && typeof gs.watch === 'object') ? gs.watch : {};
      const it = { gkey: keyOfB(g), url: g.url, sweep: false, deep: false, escalate: false, notInclude: recent };
      const wLiveB = Object.keys(watch).filter(id => (Number(watch[id] && watch[id].checks) || 0) < 4 && nowB - (Number(watch[id] && watch[id].at) || 0) < 2 * 86400e3); let wIds = []; /* LENH B (rà): watch kiểm ở sweep VÀ ở probe mỗi ≥12 h (2 ngày ≈ 4 lần), không chỉ 4 sweep liên tiếp */
      if (deepDue) { const hrs = Math.max(1, (nowB - (Number(deepDue.downSince) || nowB)) / 3600e3); it.deep = true; it.numPosts = Math.min(200, Math.ceil((Number(gs.rate) || 1) * hrs) + 10); it.startDate = fmtMDY(new Date((Number(deepDue.downSince) || nowB) - 3600e3)); it.endDate = fmtMDY(new Date(nowB)); }
      else if ((nowB - (tsMsB(gs.lastSweepAt) || 0)) >= SWEEP_MS) { it.sweep = true; it.numPosts = CFG.POSTS_PER_GROUP; const from = (tsMsB(gs.lastSweepAt) || (nowB - 24 * 3600e3)) - 6 * 3600e3; it.startDate = fmtMDY(new Date(from)); it.endDate = fmtMDY(new Date(nowB));
        wIds = wLiveB; }
      else if (g.escalate) { it.escalate = true; it.numPosts = CFG.POSTS_PER_GROUP; }
      else { it.numPosts = ((Number(gs.rate) || 0) >= 4) ? Math.max(PROBE, 10) : PROBE; wIds = wLiveB.filter(id => nowB - (Number(watch[id] && watch[id].lastCheckAt) || Number(watch[id] && watch[id].at) || 0) >= 12 * 3600e3); }
      if (wIds.length) { it.notInclude = recent.filter(id => !wIds.includes(id)); it.watchIds = wIds; }
      items.push(it);
    }
    const sow = items.length ? await SRB.sowPostsB(items, { notify: CFG.BD_NOTIFY_URL || '', chunk: CFG.BD_MAX_TRIGGERS_PER_RUN, runId: runId48 }) : { sown: 0, sownKeys: [], failedKeys: [], err: '' };
    sownB = sow.sown; escalatedB = items.filter(i => i.escalate).length;
    for (const it of items) { const g = grpOfB(it.gkey); const okS = sow.sownKeys.indexOf(it.gkey) >= 0;
      if (okS) { const patch = { url: g.url, lastTriggerAt: nowB }; if (it.sweep) patch.lastSweepAt = nowB; if (it.deep) patch.lastDeepAt = nowB; if (it.watchIds) { patch.watch = {}; it.watchIds.forEach(id => { patch.watch[id] = { checks: FieldValue.increment(1), lastCheckAt: nowB }; }); } upd(g.gkey, patch); g.sources.forEach(s => { rowOfB(s).bd = 'ok'; }); }
      else if (!sow.mock) { g.sources.forEach(s => { const row = rowOfB(s); row.bd = 'err'; row.error = ('trigger lỗi: ' + (sow.err || '?')).slice(0, 140); scrapeErrors++; }); } }
    if (items.length && !sow.mock && !sow.sown && sow.err) sowFailB = true; /* LENH B (rà): mọi lô trigger lỗi → bdwatch coi là ngưng dù vừa gặt được */
    if (deepDue && items.some(i => i.deep) && sow.sown) { try { await db.collection('system_status').doc('brightdata').set({ deepDue: Object.assign({}, deepDue, { doneAt: nowB, groups: sow.sown }) }, { merge: true }); } catch (e) {} console.log('[BRIGHTDATA-DEEP] gieo sâu ' + sow.sown + ' group từ ' + new Date((Number(deepDue.downSince) || nowB) - 3600e3 + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' VN (bù bài trong lúc BrightData ngưng)'); }
    { const wb = db.batch(); let n = 0; for (const [k, patch] of gsWrite) { wb.set(db.collection('group_state').doc(k), Object.assign({ updatedAt: nowB }, patch), { merge: true }); n++; } if (n) { try { await wb.commit(); } catch (e) { console.warn('[B] ghi group_state lỗi:', e && e.message); } } }
    if (sownB || harvestedB) console.log('[B] group ' + groups.size + ' · gặt ' + harvestedB + ' snapshot (' + hv.bdGood + '/' + hv.bdRaw + ' record) · gieo ' + sownB + ' group' + (escalatedB ? ' (' + escalatedB + ' escalate)' : '') + (items.filter(i => i.sweep).length ? ' · sweep ' + items.filter(i => i.sweep).length : '') + (hv.busy ? ' · BrightData busy ' + hv.busy : '') + ' · ứng viên ' + collected.length);
  };
  const groupsB = await buildGroupsB(sources.filter(s => !s.authAccountId)); nGroupsB = groupsB.size; if (dupSrcB) console.log(JSON.stringify({ severity: 'WARNING', message: '[SOURCE-DUP] ' + dupSrcB + ' nguồn trùng brand+group (chỉ nguồn đầu được quét) — xem scans.bySource.error' })); sharedGroupsB = [...groupsB.values()].filter(g => g.sources.length > 1).length;
  const restB = sources.filter(s => s.authAccountId || (!gkeyBySrcIdB.has(s.__id) && !dupIdsB.has(s.__id))); // nguồn nick / URL không phải group → đường cũ (nguồn trùng brand+group: bỏ hẳn — LENH B rà)
  if (sowMode) { await pha1B(groupsB, { forceDue: quickManualB }); if (restB.length) await legacyPha1B(restB); }
  else { const prim = new Set([...groupsB.values()].map(g => g.primary)); await legacyPha1B(sources.filter(s => restB.indexOf(s) >= 0 || prim.has(s))); fanoutLegacyB(groupsB); } // Quét ngay/backfill: 1 lần/group (nguồn chủ) rồi fan-out
  srcDone = sources.length; await prog('scraping', true);
`;
/* --- bdwatch --- */
const IX14 = A('index', 'IX14 bdwatch down', "      await stRef.set({ ok: false, since, at: Date.now(), runs: FieldValue.increment(1), errors: bdErrs.length, sources: nBd, sample }, { merge: true });");
const IX14_NEW = "      await stRef.set({ ok: false, since, at: Date.now(), runs: FieldValue.increment(1), errors: bdErrs.length, sources: nBd, sample, okStreak: 0 }, { merge: true });";
const IX15 = A('index', 'IX15 bdwatch up', "      if (!pd || pd.ok !== true) { await stRef.set({ ok: true, at: Date.now(), recoveredAt: Date.now(), runs: 0 }, { merge: true }); if (pd && pd.ok === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[BRIGHTDATA-UP] BrightData hoạt động lại' })); }");
const IX15_NEW = String.raw`      if (!pd || pd.ok !== true) { /* LENH B: đang ngưng → cần 2 lượt OK liên tiếp mới UP; ngưng ≥ BD_DEEP_SWEEP_AFTER_MIN → deepDue (lượt sau gieo sâu mọi group) */
        const wasDown = !!(pd && pd.ok === false); const streak = wasDown ? (Number(pd.okStreak) || 0) + 1 : 2;
        if (streak < 2) await stRef.set({ okStreak: streak, at: Date.now() }, { merge: true });
        else { const downMs = (wasDown && pd.since) ? Date.now() - Number(pd.since) : 0; const deep = downMs >= Math.max(1, Number(CFG.BD_DEEP_SWEEP_AFTER_MIN) || 30) * 60e3 ? { downSince: Number(pd.since), at: Date.now(), downMin: Math.round(downMs / 60000) } : null;
          await stRef.set(Object.assign({ ok: true, at: Date.now(), recoveredAt: Date.now(), runs: 0, okStreak: 0 }, deep ? { deepDue: Object.assign({}, deep, { doneAt: FieldValue.delete(), groups: FieldValue.delete() }) } : {}), { merge: true }); /* LENH B (rà): set-merge giữ doneAt cũ → xoá tường minh, lần ngưng sau vẫn gieo sâu */
          if (wasDown) console.log(JSON.stringify({ severity: 'WARNING', message: '[BRIGHTDATA-UP] BrightData hoạt động lại' + (deep ? ' — ngưng ' + deep.downMin + '′ → lượt sau gieo sâu (deep sweep) mọi group' : '') })); } }`;
/* --- Pha 1b --- */
const IX16 = A('index', 'IX16 ctx map', "    const ctx = new Map();\n    const cand = []; // ứng viên bài (đã khử trùng theo URL trong lần chạy này)");
const IX16_NEW = "    const ctx = new Map(); const ctxAllB = new Map(); /* LENH B: MỌI brand dùng chung group của 1 bài */\n    const cand = []; // ứng viên bài (đã khử trùng theo URL trong lần chạy này)";
const IX17 = A('index', 'IX17 ctx set', "      const k = urlKey(u); if (ctx.has(k)) continue;\n      ctx.set(k, { effSrc: x.effSrc, src: x.src, row: x.row, parentAuthor: x.post.author || '', parentText: x.post.text || '', parentUrl: x.post.url || '', parentUserUrl: x.post.user_url || '' }); /* v-selfcmt */\n      cand.push({ k, url: u, src: x.src });");
const IX17_NEW = "      const k = urlKey(u); const cB = { effSrc: x.effSrc, src: x.src, row: x.row, parentAuthor: x.post.author || '', parentText: x.post.text || '', parentUrl: x.post.url || '', parentUserUrl: x.post.user_url || '', gid: x.post.gid || '' }; /* v-selfcmt · LENH B */\n      { const arr = ctxAllB.get(k) || (ctxAllB.set(k, []).get(k)); if (!arr.some(z => z.src === x.src)) arr.push(cB); }\n      if (ctx.has(k)) continue;\n      ctx.set(k, cB);\n      cand.push({ k, url: u, src: x.src, nc: (x.post.num_comments === null || x.post.num_comments === undefined || x.post.num_comments === '') ? null : Number(x.post.num_comments), watch: !!x.post.__watch });";
const IX18 = A('index', 'IX18 srcCtx', "        for (const s of sources) { const u = String(s.url || ''); const r = bySource.find(rr => rr.url === u); if (u && r && !srcCtx.has(u)) srcCtx.set(u, { src: s, effSrc: { ...s, keywords: [...(s.keywords || []), ...gKw], exclude: [...(s.exclude || []), ...gEx] }, row: r }); }");
const IX18_NEW = IX18 + "\n        const srcCtxAllB = new Map(); for (const s of sources) { const gk = gkeyBySrcIdB.get(s.__id); if (!gk) continue; const r2 = bySource.find(rr => rr.source_id === s.__id) || bySource.find(rr => rr.url === String(s.url || '')); if (!r2) continue; (srcCtxAllB.get(gk) || (srcCtxAllB.set(gk, []).get(gk))).push({ src: s, effSrc: effOfB(s), row: r2 }); } /* LENH B */";
const IX19 = A('index', 'IX19 harvest metas', "        for (const m of hv.metas) { const cc = m && srcCtx.get(String(m.srcUrl || '')); const k = urlKey((m && (m.parentUrl || m.url)) || ''); if (!cc || !k) { orphan++; continue; } if (!ctx.has(k)) ctx.set(k, { effSrc: cc.effSrc, src: cc.src, row: cc.row, parentAuthor: m.parentAuthor || '', parentText: m.parentText || '', parentUrl: m.parentUrl || m.url || '', parentUserUrl: m.parentUserUrl || '' }); }\n        hvCmts = hv.items;");
const IX19_NEW = "        for (const m of hv.metas) { let cc = m && srcCtx.get(String(m.srcUrl || '')); if (m && !cc && m.gkey && srcCtxAllB.has(String(m.gkey))) cc = srcCtxAllB.get(String(m.gkey))[0]; /* LENH B (rà): nguồn của brand gieo đã tắt → nguồn khác cùng group nhận */ const k = urlKey((m && (m.parentUrl || m.url)) || ''); if (!cc || !k) { orphan++; continue; } if (!ctx.has(k)) ctx.set(k, { effSrc: cc.effSrc, src: cc.src, row: cc.row, parentAuthor: m.parentAuthor || '', parentText: m.parentText || '', parentUrl: m.parentUrl || m.url || '', parentUserUrl: m.parentUserUrl || '' });\n          { const gk = (m.gkey && srcCtxAllB.has(String(m.gkey))) ? String(m.gkey) : (gkeyByUrlB.get(urlKey(m.srcUrl)) || ''); const all = (gk && srcCtxAllB.get(gk)) || [cc]; const arr = ctxAllB.get(k) || (ctxAllB.set(k, []).get(k)); all.forEach(c2 => { if (!arr.some(z => z.src === c2.src)) arr.push({ effSrc: c2.effSrc, src: c2.src, row: c2.row, parentAuthor: m.parentAuthor || '', parentText: m.parentText || '', parentUrl: m.parentUrl || m.url || '', parentUserUrl: m.parentUserUrl || '', gid: gidByGkeyB.get(gk) || '' }); }); } } /* LENH B: mọi brand của group nhận bình luận đã gặt */\n        hvCmts = hv.items; hvHarvestedB = Number(hv.harvested) || 0;";
const IX20 = A('index', 'IX20 bw batch', "    const bw = db.batch(); let bwN = 0;");
const IX20_NEW = "    const bkOpsB = []; /* LENH B (S6): bookkeeping cmt_scrape ghi SAU khi gieo OK (quét theo lịch) */";
const IX21 = A('index', 'IX21 doIt block', "      if (doIt) {\n        items.push({ url: c.url, source: c.src });\n        bw.set(cmtDoc(c.k), d ? { lastAt: FieldValue.serverTimestamp() } : { firstAt: FieldValue.serverTimestamp(), lastAt: FieldValue.serverTimestamp() }, { merge: true });\n        bwN++;\n      } else { commentsRefreshSkipped++; }\n    });\n    if (bwN) { try { await bw.commit(); } catch (e) {} }");
const IX21_NEW = "      if (doIt && sowMode && !c.watch && c.nc !== null && Number.isFinite(c.nc) && c.nc <= 0) { doIt = false; noCmtB++; } /* LENH B (§9.4/9.20): bài 0 bình luận lúc gặt → không gieo snapshot bình luận (record rỗng vẫn tốn tiền); bài watch được gieo khi num_comments > 0 */\n      if (doIt) {\n        items.push({ url: c.url, source: c.src });\n        bkOpsB.push({ url: c.url, ref: cmtDoc(c.k), data: d ? { lastAt: FieldValue.serverTimestamp() } : { firstAt: FieldValue.serverTimestamp(), lastAt: FieldValue.serverTimestamp() } });\n      } else { commentsRefreshSkipped++; }\n    });\n    const commitBkB = async (urlSet) => { const wb2 = db.batch(); let n2 = 0; for (const o of bkOpsB) { if (urlSet && !urlSet.has(o.url)) continue; wb2.set(o.ref, o.data, { merge: true }); n2++; } if (n2) { try { await wb2.commit(); } catch (e) {} } };\n    if (!sowMode) await commitBkB(null); /* quét tay/backfill: chờ trong lượt như cũ → ghi ngay */";
const IX22 = A('index', 'IX22 fetchComments call', "      const cmts = await fetchComments(items, { perPost: CFG.COMMENTS_PER_POST, billed: cmtBilled, sow: sowMode, metaOf: sowMetaOf }); // v-sowc: sow=true → chỉ gieo");
const IX22_NEW = IX22 + "\n      if (sowMode) await commitBkB(new Set(Array.isArray(cmts && cmts.sownUrls) ? cmts.sownUrls : [])); /* LENH B (S6): chỉ bài gieo OK mới ghi lastAt (snapshot lỗi → lượt sau gieo lại) */";
const IX23_A = A('index', 'IX23 cmt loop head', "      for (const { comment, parentUrl } of [...hvCmts, ...cmts]) { // v-sowc: comment đã gặt + comment quét ngay (quét tay/backfill)\n        const c = ctx.get(urlKey(parentUrl)) || ctx.get(urlKey(comment.parent_url));");
const IX23_B = A('index', 'IX23 cmt loop tail', "        collected.push({ post: comment, effSrc: c.effSrc, src: c.src, row: c.row });\n      }");
const IX23_NEW = String.raw`      for (const { comment, parentUrl } of [...hvCmts, ...cmts]) { // v-sowc: comment đã gặt + comment quét ngay (quét tay/backfill)
        const k0 = urlKey(parentUrl), k1 = urlKey(comment.parent_url); const c = ctx.get(k0) || ctx.get(k1);
        if (!c) continue;                       // không khớp bài cha → bỏ
        if (!comment.text || !comment.text.trim()) continue;
        const all = ctxAllB.get(ctx.has(k0) ? k0 : k1) || [c]; /* LENH B: mọi brand dùng chung group nhận bình luận (ứng viên riêng, chấm bằng Hồ sơ AI riêng) */
        comment.parent_url = c.parentUrl || comment.parent_url || parentUrl; // dùng URL bài cha đã quét (khớp post_url)
        comment.parent_author = c.parentAuthor || '';
        comment.parent_text = c.parentText || '';
        comment.parent_user_url = c.parentUserUrl || ''; comment.self_comment = __slIsSelfComment31(comment); /* v-selfcmt */
        for (const cc of all) { const gk = gkeyBySrcIdB.get(cc.src && cc.src.__id) || ''; const bX = String((cc.src && cc.src.brand) || '').trim();
          const cm = gk ? Object.assign({}, comment, { source: (cc.src && cc.src.name) || comment.source, gid: cc.gid || gidByGkeyB.get(gk) || '', shared: all.length > 1, __brand: bX }) : comment;
          commentsScanned++; cc.row.posts++;       // tính comment vào số item của nguồn
          collected.push({ post: cm, effSrc: cc.effSrc, src: cc.src, row: cc.row, brandB: gk ? bX : '', gkeyB: gk }); }
      }`;
/* --- lượt thuần skip + Pha 2 --- */
const IX24 = A('index', 'IX24 Pha2 comment', "  /* ---- Pha 2: chống trùng (đọc/ghi seen theo LÔ) + bỏ bài RÁC (exclude).");
const IX24_NEW = String.raw`  /* LENH B (T-6): lượt THUẦN SKIP (không gieo/gặt/ứng viên/busy, không bài chờ AI tới hạn) → không ghi doc scans, chỉ đếm system_status/scan.skipRuns; tới nhịp việc phụ thì vẫn chạy tiếp (quietB → cuối lượt cũng không ghi scans nếu không chấm lại gì) */
  let quietB = false;
  if (sowMode && !collected.length && !sownB && !harvestedB && !hvHarvestedB && !bdBusyB && !scrapeErrors) {
    let dueRetry = 0; try { dueRetry = (await db.collection('score_retry').where('nextAt', '<=', Date.now()).limit(1).get()).size; } catch (e) { dueRetry = 0; }
    quietB = !dueRetry;
    if (quietB && !hkDueB) {
      try { await db.collection('system_status').doc('scan').set({ phase: 'done', at: Date.now(), runId: runId48, trigger, lastRunAt: Date.now(), lastDurationMs: Date.now() - t0, skipRuns: FieldValue.increment(1), lastSkipAt: Date.now() }, { merge: true }); } catch (_) {}
      if (job) { try { await job.set({ status: 'done', phase: 'done', finishedAt: FieldValue.serverTimestamp(), skipped: true }, { merge: true }); } catch (e) {} }
      console.log('[B] lượt thuần skip (' + Math.round((Date.now() - t0) / 100) / 10 + ' s): chưa tới nhịp gieo, không snapshot chín, không bài chờ AI — không ghi scans');
      try { const ymB = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7); await db.collection('bd_month').doc(ymB).set({ month: ymB, updatedAt: FieldValue.serverTimestamp(), runs: FieldValue.increment(1), skipRuns: FieldValue.increment(1) }, { merge: true }); } catch (_) {} /* LENH B (rà): lượt thuần skip vẫn đếm runs/skipRuns ở bd_month (T-6) */
      return { scanned: 0, matched: 0, kept: 0, hot: 0, durationMs: Date.now() - t0, tokensTotal: 0, costUsd: 0, scanId: null, jobId: opts.jobId || null, skipped: true, sown: 0, harvested: 0 };
    }
  }
` + IX24;
const IX25_A = A('index', 'IX25 Pha2 head', "    let snaps = [];\n    try { snaps = await db.getAll(...slice.map(x => seenDoc(x.post.post_id))); } catch (e) { snaps = []; }\n    const wb = db.batch(); let writes = 0; const fresh48 = []; // LENH #48 (PB-2d): seen ghi bằng create() — 2 lượt chồng (Quét ngay ↔ lịch) không cùng nhận 1 bài");
const IX25_B = A('index', 'IX25 Pha2 tail', "        if (w2) { try { await wb2.commit(); } catch (e2) { console.warn('[seen] commit lần 2 lỗi:', e2 && e2.message); } } } } }");
const IX25_NEW = String.raw`    /* LENH #48 (PB-2d) · LENH B: seen/{post_id} = { at, run, brands: { <brand>: 'pending'|quyết định } } — 1 doc/bài, mỗi brand dùng chung group xét RIÊNG.
       Doc cũ không có brands: brand X coi là ĐÃ XỬ LÝ nếu nguồn X không có sharedAt hoặc sharedAt < seen.at (brand vào sau mốc đó mới được chấm). create() theo bài (gộp brand) — 2 lượt chồng → ALREADY_EXISTS → đọc lại. */
    let snaps = [];
    try { const need = slice.filter(x => !seenCacheB.has(String(x.post.post_id))); const got = need.length ? await db.getAll(...need.map(x => seenDoc(x.post.post_id))) : []; need.forEach((x, i) => seenCacheB.set(String(x.post.post_id), got[i] || null)); snaps = slice.map(x => seenCacheB.get(String(x.post.post_id)) || null); } catch (e) { snaps = []; }
    const wb = db.batch(); let writes = 0; const fresh48 = []; const createB = new Map(), mergeB = new Map();
    const doneForB = (x, sd) => { const bX = x.brandB || ''; if (!bX) return true; const bm = sd && sd.brands; if (bm && typeof bm === 'object' && !Array.isArray(bm)) return (bX in bm); const sh = tsMsB(x.src && x.src.sharedAt), at = tsMsB(sd && sd.at); return !sh || (at > 0 && sh < at); };
    const seenDataB = (sn) => (sn && sn.exists) ? (sn.data() || {}) : null;
    slice.forEach((x, j) => {
      const sn = snaps[j]; const wasSeen = !!(sn && sn.exists); const sd = seenDataB(sn); const pid = String(x.post.post_id); const bX = x.brandB || '';
      if (wasSeen && !force && doneForB(x, sd)) { skippedSeen++; return; }            // chống trùng theo brand (tắt khi quét lại từ đầu)
      if (!wasSeen) { const c = createB.get(pid) || { ref: seenDoc(pid), brands: {} }; if (bX) c.brands[bX] = 'pending'; createB.set(pid, c); fresh48.push(x); }
      else if (bX && !(sd && sd.brands && typeof sd.brands === 'object' && (bX in sd.brands))) { const m = mergeB.get(pid) || { ref: seenDoc(pid), brands: {} }; m.brands[bX] = 'pending'; mergeB.set(pid, m); }
      if (x.post.self_comment) { selfSkipped++; recordPost(x, { decision: 'self_comment' }); return; } /* v-selfcmt: chủ bài tự bình luận → không phải lead, không gọi AI */
      const pass = !isExcluded(x.post.text, x.effSrc); // luôn để AI đọc hiểu ngữ cảnh (chỉ bỏ bài rác theo exclude)
      if (pass) candidates.push(x);
      else recordPost(x, { decision: twoStage ? 'excluded' : 'no_keyword' });
    });
    const seenDocB = (c) => { const d = { at: FieldValue.serverTimestamp(), run: runId48 }; if (Object.keys(c.brands).length) d.brands = c.brands; return d; };
    for (const c of createB.values()) { wb.create(c.ref, seenDocB(c)); writes++; }
    for (const m of mergeB.values()) { wb.set(m.ref, { brands: m.brands }, { merge: true }); writes++; }
    const markCreatedB = (map) => { for (const [pid, c] of map) seenCacheB.set(pid, { exists: true, id: pid, data: () => ({ at: Date.now(), run: runId48, brands: c.brands }) }); };
    if (writes) { try { await wb.commit(); markCreatedB(createB); } catch (e) {
      /* ALREADY_EXISTS = lượt khác vừa ghi seen cho ≥1 bài trong lô → đọc lại; bài/brand lượt kia đã nhận → bỏ (seenRace); phần còn lại ghi lại (create theo bài, merge brand) */
      const race = !!(e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message || e))));
      if (!race) console.warn('[seen] commit lỗi:', e && e.message);
      else { const pids = [...createB.keys()]; let s2 = []; try { s2 = await db.getAll(...pids.map(p => seenDoc(p))); } catch (_) { s2 = []; }
        const exist = new Map(); pids.forEach((p, k) => { const sd2 = seenDataB(s2[k]); if (sd2) exist.set(p, sd2); });
        const wb2 = db.batch(); let w2 = 0; const merge2 = new Map(); const create2 = new Map();
        for (const x of fresh48) { const pid = String(x.post.post_id); const sd = exist.get(pid); if (!sd) continue; const bX = x.brandB || '';
          if (!force && (!bX || (sd.brands && typeof sd.brands === 'object' && (bX in sd.brands)))) { seenRace48++; skippedSeen++; const ci = candidates.indexOf(x); if (ci >= 0) candidates.splice(ci, 1); }
          else if (bX) { const m = merge2.get(pid) || { ref: seenDoc(pid), brands: {} }; m.brands[bX] = 'pending'; merge2.set(pid, m); } }
        for (const [pid, c] of createB) { if (!exist.has(pid)) create2.set(pid, c); }
        for (const [pid, m] of mergeB) { const m2 = merge2.get(pid) || { ref: m.ref, brands: {} }; Object.assign(m2.brands, m.brands); merge2.set(pid, m2); }
        for (const c of create2.values()) { wb2.create(c.ref, seenDocB(c)); w2++; }
        for (const m of merge2.values()) { wb2.set(m.ref, { brands: m.brands }, { merge: true }); w2++; }
        if (w2) { try { await wb2.commit(); markCreatedB(create2); } catch (e2) { console.warn('[seen] commit lần 2 lỗi:', e2 && e2.message); } } } } }`;
const IX26 = A('index', 'IX26 lease src', "lw.set(ref, { post: slimPost48(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || '') },");
const IX26_NEW = "if (leaseSeenB.has(ref.id)) continue; leaseSeenB.add(ref.id); /* LENH B (rà): 1 doc chờ/ứng viên trong 1 batch */ lw.set(ref, { post: slimPost48(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || ''), source_id: String((x.src && x.src.__id) || ''), gid: String((x.post && x.post.gid) || ''), fanout: !!x.brandB /* LENH B */ },";
/* --- commitLeadNow --- */
const IX27 = A('index', 'IX27 fixgrp', "    try {\n      const _gm = String((lead && (lead.comment_url || lead.post_url || lead.url)) || '').match(/facebook\\.com\\/groups\\/([^\\/\\?#]+)/);");
const IX27_NEW = "    try { if (lead && lead.brand_hint) throw 0; /* LENH B: lead fan-out đã đúng nguồn/brand theo source_id — không đổi nguồn theo group */\n      const _gm = String((lead && (lead.comment_url || lead.post_url || lead.url)) || '').match(/facebook\\.com\\/groups\\/([^\\/\\?#]+)/);";
const IX28 = A('index', 'IX28 multitouch call', "    if (await tryMergeTouch(db, lead, { windowH: 48, hotThreshold: _mtHot })) return true;");
const IX28_NEW = "    if (lead && !lead.textKey) lead.textKey = textKeyB(lead.text); /* LENH B (PC-4): vân tay văn bản (gộp bài rải nhiều nhóm cùng brand ≤14 ngày) */\n    if (await tryMergeTouch(db, lead, { windowH: 48, hotThreshold: _mtHot, brand: String((lead && lead.brand_hint) || '') })) return true; /* LENH B: chỉ gộp trong CÙNG brand */";
const IX29 = A('index', 'IX29 lead ref', "    let ref;\n    if (force && lead.post_url) {\n      ref = db.collection('leads').doc(leadKey(lead.post_url));\n      try { const s = await ref.get(); if (s.exists) return false; } catch (e) {}\n    } else ref = db.collection('leads').doc();\n    try { await ref.set(lead); } catch (e) { return false; }");
const IX29_NEW = String.raw`    let ref;
    if (lead && lead.brand_hint && lead.post_id) { /* LENH B: id TẤT ĐỊNH L_<post_id>__<brand> + create() → không bao giờ 2 lead cùng bài cùng brand (kể cả 2 lượt chồng / quét lại) */
      ref = db.collection('leads').doc(leadIdB(lead.post_id, lead.brand_hint));
      try { await ref.create(lead); } catch (e) { if (e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message || e)))) { dupLeadB++; return false; } console.warn('[lead] create lỗi (giữ lease, lượt sau ghi lại):', e && e.message); throw e; } /* LENH B (rà): lỗi không phải trùng → ném để Pha 3b giữ lease (không mất bài) */
    } else {
    if (force && lead.post_url) {
      ref = db.collection('leads').doc(leadKey(lead.post_url));
      try { const s = await ref.get(); if (s.exists) return false; } catch (e) {}
    } else ref = db.collection('leads').doc();
    try { await ref.set(lead); } catch (e) { console.warn('[lead] set lỗi (giữ lease, lượt sau ghi lại):', e && e.message); throw e; } /* LENH B (rà) */
    }`;
const IX30 = A('index', 'IX30 birthstamp', "    const _b = (typeof brandBySource !== 'undefined' && brandBySource[lead.source]) || '';");
const IX30_NEW = "    const _b = String((lead && lead.brand_hint) || '') || (typeof brandBySource !== 'undefined' && brandBySource[lead.source]) || ''; /* LENH B: brand theo nguồn fan-out (giữ 2 bước ghi brand → ZBS justTagged) */";
const IX31 = A('index', 'IX31 birthstamp catch', "  } catch (e) { console.warn('[birthstamp] loi dong dau inline (luoi du phong se do):', e.message); }");
const IX31_NEW = IX31 + "\n  if (lead && lead.shared_post && lead.gid && lead.post_id && lead.brand_hint) { try { await db.collection('lead_links').doc(linkIdB(lead.gid, lead.post_id)).set({ gid: String(lead.gid), post_id: String(lead.post_id).slice(0, 200), post_url: String(lead.post_url || '').slice(0, 300), brands: { [slugIdB(lead.brand_hint)]: ref.id }, at: Date.now() }, { merge: true }); } catch (e) {} } /* LENH B: bản đồ lead↔brand cùng bài (Rules read super) — lead KHÔNG mang mã brand khác */";
/* --- Pha 3b --- */
const IX32 = A('index', 'IX32 deferPost key', "    const key = String((x.post && x.post.post_id) || '').replace(/[^\\w-]/g, '_').slice(0, 470);\n    const badreqSys = ");
const IX32_NEW = "    const key = String((x.post && x.post.post_id) || '').replace(/[^\\w-]/g, '_').slice(0, 400) + ((x.post && x.post.__brand) ? '__' + slugIdB(x.post.__brand).slice(0, 60) : ''); /* LENH B: theo brand */\n    const badreqSys = ";
const IX33 = A('index', 'IX33 deferPost src', "      await ref.set({ post: slimPost46(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || '') },");
const IX33_NEW = "      await ref.set({ post: slimPost46(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || ''), source_id: String((x.src && x.src.__id) || ''), gid: String((x.post && x.post.gid) || ''), fanout: !!x.brandB /* LENH B */ },";
const IX34 = A('index', 'IX34 retry src find', "        const r = d.data() || {}; const src = sources.find(s => s.url === (r.src && r.src.url)) || null;");
const IX34_NEW = "        const r = d.data() || {}; const rs = r.src || {}; const src = (rs.source_id && sources.find(s => s.__id === rs.source_id)) || (rs.brand && sources.find(s => s.url === rs.url && String(s.brand || '').trim() === String(rs.brand))) || sources.find(s => s.url === rs.url) || null; /* LENH B: nguồn theo source_id → (url+brand) → url */";
const IX35 = A('index', 'IX35 retry row', "        let row = bySource.find(b => b.url === src.url); if (!row) { row = { name: src.name || '', industry: src.industry || '', url: src.url || '', posts: 0, matched: 0, leads: 0, hot: 0, error: null, bdPosts: 0, bdComments: 0, ekyc: 0 }; bySource.push(row); }\n        toScore.push({ post: r.post, effSrc, src, row, deferredRef: d.ref, deferredDoc: r }); n46++;");
const IX35_NEW = "        const row = rowOfB(src); /* LENH B */\n        const bB = (rs.fanout || rs.source_id) ? String(rs.brand || '').trim() : ''; const pB = bB ? Object.assign({}, r.post, { __brand: bB }) : r.post;\n        toScore.push({ post: pB, effSrc, src, row, deferredRef: d.ref, deferredDoc: r, brandB: bB, gkeyB: gkeyBySrcIdB.get(src.__id) || '' }); n46++;";
const IX36 = A('index', 'IX36 isLead settle', "    if (!isLead) { await settle48(x); return; } // LENH #48: không phải lead → gỡ lease/doc chờ");
const IX36_NEW = "    if (x.post.kind !== 'comment' && x.gkeyB && !x.post.__watch && x.post.num_comments === 0) watchAddB(x.gkeyB, x.post, isLead ? 2 : 1); /* LENH B (rà): bài đã qua AI (lead HAY KHÔNG — bài chào bán của người khác vẫn sinh comment-lead) nhưng 0 bình luận lúc gặt → theo dõi (≤5/group, 2 ngày) */\n" + IX36;
const IX37 = A('index', 'IX37 lead fields', "      author_uid: String(x.post.author_uid || '').slice(0, 40), zalo_defer: !!(zaloDefer48 && _zc.phone), /* LENH #48 */");
const IX37_NEW = IX37 + "\n      post_id: String(x.post.post_id || '').slice(0, 200), gid: String(x.post.gid || ''), source_id: String((x.src && x.src.__id) || ''), brand_hint: String(x.brandB || ''), shared_post: !!x.post.shared, num_comments: (x.post.num_comments === null || x.post.num_comments === undefined) ? null : (Number(x.post.num_comments) || 0), /* LENH B */";
const IX38 = A('index', 'IX38 flushPosts final', "  await flushPosts(true); // ghi nốt nhật ký bài đã quét còn trong bộ đệm");
const IX38_NEW = IX38 + "\n  await flushWatchB(); /* LENH B */";
const IX39 = A('index', 'IX39 zalo sweep', "  try {\n    const _zsnap = await db.collection('leads').where('phone_has_zalo', '==', null).limit(50).get();");
const IX39_NEW = "  if (hkDueB) try { /* LENH B: theo nhịp việc phụ */\n    const _zsnap = await db.collection('leads').where('phone_has_zalo', '==', null).limit(50).get();";
const IX40 = A('index', 'IX40 rescore gate', "  if (sow46 && CFG.LLM_API_KEY && !cb48.open && !overSoft48() && CFG.RESCORE_FALLBACK !== false && process.env.RESCORE_FALLBACK !== 'false') {");
const IX40_NEW = "  if (hkDueB && sow46 && CFG.LLM_API_KEY && !cb48.open && !overSoft48() && CFG.RESCORE_FALLBACK !== false && process.env.RESCORE_FALLBACK !== 'false') { /* LENH B: theo nhịp việc phụ */";
const IX41 = A('index', 'IX41 src46', "          const l = c.l; const src46 = sources.find(s => s.name === l.source) || { name: l.source || '', industry: l.industry || '' };");
const IX41_NEW = "          const l = c.l; const src46 = (l.source_id && sources.find(s => s.__id === l.source_id)) || sources.find(s => s.name === l.source) || { name: l.source || '', industry: l.industry || '' }; /* LENH B: nguồn theo source_id */";
const IX42 = A('index', 'IX42 summary', "    probeRuns, sweepRuns, probeEscalated, probeIdle, bdRecords, bdCommentRecords: bdCmtRecords, authRuns, authCheckpoints,");
const IX42_NEW = IX42 + "\n    groups: nGroupsB, sharedGroups: sharedGroupsB, sown: sownB, harvested: harvestedB, escalated: escalatedB, bdBusy: bdBusyB, deepSweep: deepB, sweepRecords: sweepRecordsB, noCmt: noCmtB, dupLead: dupLeadB, hvOrphan: hvOrphanB, gidLearned: gidLearnedB, dupSources: dupSrcB, housekeeping: hkDueB, /* LENH B */";
const IX43 = A('index', 'IX43 bd_month key', "      const k = 's_' + String(r.url || r.name || '?').replace(/[^\\w-]/g, '_').slice(0, 140);");
const IX43_NEW = "      const k = 's_' + String(r.url || r.name || '?').replace(/[^\\w-]/g, '_').slice(0, 140) + (r.bdShared ? '__' + slugIdB(r.brand).slice(0, 40) : ''); /* LENH B: nguồn dùng chung (không phải nguồn chủ) có key riêng, tiền BrightData ở nguồn chủ */";
const IX44 = A('index', 'IX44 bd_month fields', "        name: r.name || '', url: r.url || '', industry: r.industry || '',\n        bdPosts: inc(r.bdPosts || 0), bdComments: inc(r.bdComments || 0),");
const IX44_NEW = "        name: r.name || '', url: r.url || '', industry: r.industry || '', brand: r.brand || '', source_id: r.source_id || '', gid: r.gid || '', shared: !!r.bdShared, /* LENH B */\n        bdPosts: inc(r.bdPosts || 0), bdComments: inc(r.bdComments || 0),";
const IX45b = A('index', 'IX45b scans add', "  try { const ref = await db.collection('scans').add(summary); scanId = ref.id; }\n  catch (e) { console.error('ghi log scan lỗi:', e.message); }");
const IX45b_NEW = "  if (quietB && !rescoredLeads46) { try { await db.collection('system_status').doc('scan').set({ skipRuns: FieldValue.increment(1), lastSkipAt: Date.now() }, { merge: true }); } catch (_) {} console.log('[B] lượt việc phụ không có gì để chấm — không ghi scans'); } /* LENH B (T-6) */\n  else try { const ref = await db.collection('scans').add(summary); scanId = ref.id; }\n  catch (e) { console.error('ghi log scan lỗi:', e.message); }";
const IX45 = A('index', 'IX45 status done', "  try { await db.collection('system_status').doc('scan').set({ phase: 'done', at: Date.now(), runId: runId48, trigger, lastRunAt: Date.now(), lastDurationMs: durationMs, lastLeads: kept, lastPosts: scanned, softStop: softStop48, pipeErrors: pipeErrors48, seenRace: seenRace48, leased: leased48 }, { merge: true }); } catch (_) {} // LENH #48 (PB-1e)");
const IX45_NEW = "  try { await db.collection('system_status').doc('scan').set(Object.assign({ phase: 'done', at: Date.now(), runId: runId48, trigger, lastRunAt: Date.now(), lastDurationMs: durationMs, lastLeads: kept, lastPosts: scanned, softStop: softStop48, pipeErrors: pipeErrors48, seenRace: seenRace48, leased: leased48, groups: nGroupsB, sown: sownB, harvested: harvestedB, dupLead: dupLeadB }, hkDueB ? { lastHousekeepingAt: Date.now() } : {}), { merge: true }); } catch (_) {} // LENH #48 (PB-1e) · LENH B";
const IX46 = A('index', 'IX46 manual backfill', "    let sum; try { sum = await scanAll('backfill', opts); } catch (e) { await abortLog48('backfill', e); throw e; } // LENH #48");
const IX46_NEW = "    let sum; try { sum = await scanAll('backfill', opts); } catch (e) { if (e && e.code === 'busy') { res.status(409).json({ error: 'busy', message: String(e.message || 'Đang có lượt quét khác chạy — thử lại sau ít phút') }); return; } await abortLog48('backfill', e); throw e; } // LENH #48 · LENH B: khoá lượt → 409";
const IX47 = A('index', 'IX47 manual', "  let sum; try { sum = await scanAll('manual', { jobId, force: !!b.force }); } catch (e) { await abortLog48('manual', e); throw e; } // LENH #48\n  res.json({ ok: true, summary: sum });\n});");
const IX47_NEW = "  let sum; try { sum = await scanAll('manual', { jobId, force: !!b.force }); } catch (e) { if (e && e.code === 'busy') { res.status(409).json({ error: 'busy', message: String(e.message || 'Đang có lượt quét khác chạy — thử lại sau ít phút') }); return; } await abortLog48('manual', e); throw e; } // LENH #48 · LENH B: khoá lượt → 409\n  res.json({ ok: true, summary: sum });\n});\nexport * from './sources.js'; /* LENH B: createSource · sourceOnWrite · bdReady */";

/* ================= (4) outreach.js ================= */
const OA1 = A('outreach', 'OA1 helper anchor', "/* ===== LENH #44 (11/09/2026) — nick cờ · van hiệu lực · người thật · reserve lại · sweeper ===== */");
const OA1_NEW = String.raw`/* ===== LENH B (12/09/2026) — KHOÁ TRANH CHẤP AUTOMATION giữa brand dùng chung group: outreach_locks/{post_<post_id> | cmt_<comment_id> | person_<uid> | person_u_<username>}
   = { brand, leadId, pid, state:'reserved'|'touched', at, expireAt } — transaction, first-come; brand khác đang giữ (touched, hoặc reserved chưa hết hạn) → NHƯỜNG: thread step 'skipped_shared' + nextAt = hết hạn khoá (engine xét lại), touched → đóng.
   Gọi ở CẢ apEnqueueFunnel (AdsPower) lẫn stepNick (func) TRƯỚC tryConsume/genForLead (thua khoá = chưa đốt van, chưa tốn AI). Cùng brand → dùng lại khoá. Nhả: sweep44 đóng phễu, stats.stopMachine (người thật), phễu không bước nào. ===== */
const LOCK_RESERVED_MS_B = 6 * 3600e3, LOCK_TOUCHED_MS_B = 14 * 86400e3;
function lockKeysB(lead) {
  const keys = []; const cid = commentIdOf(lead);
  const pidPost = String(lead.post_id || '').trim() || (parsePost(lead.post_url).post_id || '');
  if (cid) keys.push('cmt_' + String(cid).replace(/[^\w-]/g, '_').slice(0, 200)); else if (pidPost) keys.push('post_' + String(pidPost).replace(/[^\w-]/g, '_').slice(0, 200));
  const uid = String(lead.author_uid || '').trim() || uidFromAuthor(lead.author_url) || '';
  if (/^\d{5,}$/.test(uid)) keys.push('person_' + uid);
  else { let raw = String(lead.author_url || '').trim(); try { raw = decodeURIComponent(raw); } catch (_) {} const pf = raw.match(/id=(pfbid[\w-]{10,})/i); const u = raw.toLowerCase().replace(/^https?:\/\/(www\.|m\.|web\.|mbasic\.)?/, '').split(/[?#]/)[0].replace(/\/+$/, '').replace(/^facebook\.com\//, '');
    const pp = u.match(/^people\/[^/]+\/(\d{5,})$/); /* LENH B (rà): chỉ khoá NGƯỜI khi chắc là 1 người — uid số · pfbid · people/<tên>/<uid> · username FB hợp lệ (allowlist); l.php/permalink.php/story.php/events/… KHÔNG khoá người (khoá chung sai cho nhiều lead) */
    if (pf) keys.push('person_' + pf[1].slice(0, 120)); else if (pp) keys.push('person_' + pp[1]); else if (/^\d{5,}$/.test(u)) keys.push('person_' + u); else if (/^[a-z0-9.]{5,50}$/.test(u) && !/\.php$/.test(u) && !/^(login|home|events|marketplace|hashtag|stories|reel|reels|watch|pages|groups|people|photo|share|profile|messages|friends|help|privacy|settings|search|gaming|videos|notifications|bookmarks|about|policies|business|ads|memories|saved|dialog)$/.test(u)) keys.push('person_u_' + u); }
  return keys;
}
async function acquireLocksB(lead, brand, pid) {
  const keys = lockKeysB(lead); const code = String(brand.code || ''); const leadId = String(lead.id || '');
  if (!keys.length || !code) return { ok: true, keys: [] };
  const now = nowMs(); const col = db().collection('outreach_locks');
  try {
    return await db().runTransaction(async tx => {
      const snaps = []; for (const k of keys) snaps.push(await tx.get(col.doc(k)));
      const thSn = new Map(); /* LENH B (rà): khoá brand khác ĐÃ HẾT HẠN (reserved 6 h) → xem phễu của họ đã chạm chưa (outreach_threads.doneSteps do worker ghi) → chạm rồi = touched 14 ngày, không ghi đè (không cần đợi worker mới) */
      for (let i = 0; i < keys.length; i++) { const s = snaps[i]; if (!s.exists) continue; const d = s.data() || {}; if (d.brand === code || (d.state === 'touched' && (Number(d.expireAt) || 0) > now) || (Number(d.expireAt) || 0) > now || !d.leadId || thSn.has(d.leadId)) continue; thSn.set(d.leadId, await tx.get(db().collection('outreach_threads').doc(String(d.leadId)))); }
      const touchedByOther = d => { if (!d || d.brand === code) return false; if (d.state === 'touched' && (Number(d.expireAt) || 0) > now) return true; const t = thSn.get(d.leadId); const td = (t && t.exists) ? (t.data() || {}) : null; return !!(td && ((Array.isArray(td.doneSteps) && td.doneSteps.length) || /^(comment|inbox|done|replied|human)$/.test(String(td.step || '')))); }; /* doneSteps = worker AdsPower; step sau react = phễu func (không ghi doneSteps) */
      const aliveByOther = d => { if (!d || d.brand === code) return false; const t = thSn.get(d.leadId); const td = (t && t.exists) ? (t.data() || {}) : null; return !!(td && td.active === true && !/^skipped/.test(String(td.step || ''))); }; /* LENH B (rà): khoá hết hạn nhưng phễu holder còn ĐANG chạy (re-enqueue/needLogin, chưa bước nào) → không chen, chờ thêm */
      for (let i = 0; i < keys.length; i++) { const s = snaps[i]; if (!s.exists) continue; const d = s.data() || {}; if (d.brand === code) continue;
        if (touchedByOther(d)) { if (d.state !== 'touched' || (Number(d.expireAt) || 0) <= now) tx.set(col.doc(keys[i]), { state: 'touched', touchedAt: now, expireAt: now + LOCK_TOUCHED_MS_B, expireTs: new Date(now + LOCK_TOUCHED_MS_B + 3600e3) }, { merge: true }); return { ok: false, key: keys[i], by: d.brand || '?', byLead: d.leadId || '', touched: true, expireAt: now + LOCK_TOUCHED_MS_B, keys }; }
        if ((Number(d.expireAt) || 0) > now) return { ok: false, key: keys[i], by: d.brand || '?', byLead: d.leadId || '', touched: false, expireAt: Number(d.expireAt) || (now + LOCK_RESERVED_MS_B), keys };
        if (aliveByOther(d)) { tx.set(col.doc(keys[i]), { expireAt: now + LOCK_RESERVED_MS_B, expireTs: new Date(now + LOCK_TOUCHED_MS_B + LOCK_RESERVED_MS_B), renewedAt: now }, { merge: true }); return { ok: false, key: keys[i], by: d.brand || '?', byLead: d.leadId || '', touched: false, expireAt: now + LOCK_RESERVED_MS_B, keys }; } }
      for (let i = 0; i < keys.length; i++) { const s = snaps[i]; const d = s.exists ? (s.data() || {}) : null; if (d && d.brand === code && (Number(d.expireAt) || 0) > now) continue; /* LENH B (rà): cùng brand còn hạn (touched, hoặc lead khác cùng người đang chạy) → giữ nguyên leadId, không đè */
        tx.set(col.doc(keys[i]), { brand: code, leadId, pid: String(pid || ''), state: 'reserved', at: now, expireAt: now + LOCK_RESERVED_MS_B, expireTs: new Date(now + LOCK_TOUCHED_MS_B + LOCK_RESERVED_MS_B), key: keys[i], touchedTtlMs: LOCK_TOUCHED_MS_B }, { merge: true }); } /* expireTs (Timestamp) = trần tuổi doc cho TTL policy outreach_locks */
      return { ok: true, keys };
    });
  } catch (e) { console.warn('[LENH B] acquireLocksB lỗi (fail-open):', e && e.message); return { ok: true, keys, err: String((e && e.message) || e).slice(0, 120) }; }
}
async function releaseLocksB(leadId, keys, touched) { /* xoá khoá 'reserved' của lead (touched giữ tới hết hạn); touched=true (phễu đã có bước / người thật tiếp quản) → chuyển 'touched' 14 ngày thay vì xoá — LENH B (rà) */
  const col = db().collection('outreach_locks'); let list = Array.isArray(keys) ? keys.slice() : [];
  if (!list.length && leadId) { try { const q = await col.where('leadId', '==', String(leadId)).get(); list = q.docs.map(d => d.id); } catch (_) { list = []; } }
  let n = 0; for (const k of list) { try { const s = await col.doc(k).get(); const d = s.exists ? (s.data() || {}) : null; if (d && d.leadId === String(leadId) && d.state !== 'touched') { if (touched) await col.doc(k).set({ state: 'touched', touchedAt: nowMs(), expireAt: nowMs() + LOCK_TOUCHED_MS_B, expireTs: new Date(nowMs() + LOCK_TOUCHED_MS_B + 3600e3) }, { merge: true }); else await col.doc(k).delete(); n++; } } catch (_) {} }
  return n;
}
async function skipLeadSharedB(lead, brand, acct, lk, tref) {
  const pid = acct.id || acct.pid; const until = Number(lk.expireAt) || (nowMs() + LOCK_RESERVED_MS_B); const ref = tref || db().collection('outreach_threads').doc(lead.id);
  let hadB = false; try { const cs = await ref.get(); hadB = !!(cs.exists && (cs.data() || {}).createdAt); } catch (_) {} /* LENH B (rà): createdAt để sweep44 tính tuổi thread nhường */
  await ref.set(Object.assign(hadB ? {} : { createdAt: FieldValue.serverTimestamp() }, { leadId: lead.id, brand: brand.code, brandCode: brand.code, brandName: brand.name || brand.code, pid, name: lead.name || '', temp: lead.temp || 'cold', score: Number(lead.score) || 0, post_url: lead.post_url || '', author_url: lead.author_url || '',
    active: !lk.touched, step: 'skipped_shared', taskStatus: 'skipped', skipReason: 'brand ' + (lk.by || '?') + ' đang tiếp cận (' + (lk.key || '') + ')', lockedBy: lk.by || '', lockKey: lk.key || '', retryAt: lk.touched ? 0 : until, nextAt: lk.touched ? 0 : until, sharedSkipAt: nowMs(), sharedSkips: FieldValue.increment(1) }), { merge: true });
  await addLog({ leadId: lead.id, name: lead.name || '', brand: brand.name || brand.code, brandCode: brand.code, pid, temp: lead.temp || 'cold', score: Number(lead.score) || 0, action: '⏭ Nhường — brand ' + (lk.by || '?') + ' đã tiếp cận bài/khách này' + (lk.touched ? ' (đã chạm, không xét lại)' : ' (xét lại sau ' + Math.max(1, Math.round((until - nowMs()) / 60000)) + '′)'), text: lk.key || '', status: 'skip' });
}
export { acquireLocksB, releaseLocksB, skipLeadSharedB, lockKeysB };

` + OA1;
const OA2 = A('outreach', 'OA2 apEnqueueFunnel uid/steps', "  const uid = uidFromAuthor(lead.author_url);\n  const steps = [];");
const OA2_NEW = "  const lkB = await acquireLocksB(lead, brand, pid); /* LENH B (§8.2): khoá bài/bình luận/người TRƯỚC khi đốt van & AI — thua khoá → nhường, xét lại khi khoá hết hạn */\n  if (!lkB.ok) { await skipLeadSharedB(lead, brand, acct, lkB, tref); return false; }\n  const uid = uidFromAuthor(lead.author_url);\n  const steps = [];";
const OA3 = A('outreach', 'OA3 steps empty', "  if (!steps.length) return false;");
const OA3_NEW = "  if (!steps.length) { await releaseLocksB(lead.id, lkB.keys); return false; } /* LENH B: không bước nào → trả khoá */";
const OA4 = A('outreach', 'OA4 thread set', "fpayload: payload, reservedDay: dayKey(), /* LENH #44 (E-4) */ createdAt: FieldValue.serverTimestamp() }), { merge: true });");
const OA4_NEW = "fpayload: payload, reservedDay: dayKey(), /* LENH #44 (E-4) */ lockKeysB: lkB.keys || [], /* LENH B */ createdAt: FieldValue.serverTimestamp() }), { merge: true });";
const OA5 = A('outreach', 'OA5 adspower else', "    } else await d.ref.set({ active: false }, { merge: true });");
const OA5_NEW = "    } else if (th.step === 'skipped_shared') { /* LENH B: khoá brand khác hết hạn → xét lại như lead mới (lead vẫn mở, chưa ai chăm) */\n      const ls = await db().collection('leads').doc(d.id).get(); const lead = ls.exists ? Object.assign({ id: d.id }, ls.data()) : null;\n      if (!lead || lead.dropped || lead.lost || lead.ai_scored === false || (lead.temp || 'cold') === 'junk' || humanBusy44(lead, brand) || roleBlockOf(lead)) await d.ref.set({ active: false, step: 'skipped_shared_closed' }, { merge: true });\n      else if (await apEnqueueFunnel(acct, brand, lead, d.ref)) return true;\n      else { const th2 = (await d.ref.get()).data() || {}; if (th2.step === 'skipped_shared' && th2.active !== false && !(Number(th2.nextAt) > nowMs())) { /* LENH B (rà): thua khoá lần nữa thì skipLeadSharedB đã hẹn lại; còn lại = không bước nào (ma trận tắt / hết van) → hẹn sáng mai hoặc đóng, không để nextAt quá hạn chiếm limit(1) mỗi tick */\n        if (!brandAllow(brand, lead.temp || 'cold', 'react')) await d.ref.set({ active: false, step: 'skipped_matrix', lastError: 'ma trận brand tắt cho nhiệt độ ' + (lead.temp || 'cold') }, { merge: true });\n        else await d.ref.set({ nextAt: nextMorning44(), lastError: 'hết van hôm nay — chờ sáng mai' }, { merge: true }); } }\n    } else await d.ref.set({ active: false }, { merge: true });";
const OA6 = A('outreach', 'OA6 stepNick post_id', "    const { post_id } = parsePost(lead.post_url);\n    if (!post_id) continue;");
const OA6_NEW = OA6 + "\n    const lkB = await acquireLocksB(lead, brand, pid); /* LENH B */\n    if (!lkB.ok) { await skipLeadSharedB(lead, brand, acct, lkB, tref); continue; }";
const OA7 = A('outreach', 'OA7 stepNick thread set', "      pid, step: 'react', active: true, nextAt: nowMs(), createdAt: FieldValue.serverTimestamp(),");
const OA7_NEW = "      pid, step: 'react', active: true, nextAt: nowMs(), createdAt: FieldValue.serverTimestamp(), lockKeysB: lkB.keys || [], /* LENH B */";
const OA8 = A('outreach', 'OA8 drive guard', "      if (!t.active || t.step === prevStep) return; // không tiến (cap/auth/xong) → dừng");
const OA8_NEW = "      if (t.active && t.step === 'skipped_shared') { /* LENH B: khoá brand khác hết hạn → thử lấy khoá lại rồi chạy từ react */\n        const lk = await acquireLocksB(Object.assign({ id: tref.id }, t), brand, pid);\n        if (!lk.ok) { await tref.set({ nextAt: Number(lk.expireAt) || (nowMs() + 6 * 3600e3), retryAt: Number(lk.expireAt) || 0, active: !lk.touched }, { merge: true }); return; }\n        const ls2 = await db().collection('leads').doc(tref.id).get(); const ld2 = ls2.exists ? Object.assign({ id: tref.id }, ls2.data()) : null; /* LENH B (rà): xét lại như lead mới + ghi đủ field phễu func (reply/need/uid/allow) */\n        if (!ld2 || ld2.dropped || ld2.lost || ld2.ai_scored === false || (ld2.temp || 'cold') === 'junk' || humanBusy44(ld2, brand) || roleBlockOf(ld2)) { await releaseLocksB(tref.id, lk.keys); await tref.set({ active: false, step: 'skipped_shared_closed' }, { merge: true }); return; }\n        const tp2 = ld2.temp || 'cold';\n        await tref.set({ step: 'react', nextAt: nowMs(), lockKeysB: lk.keys || [], lockedBy: '', taskStatus: 'queued', skipReason: FieldValue.delete(), name: ld2.name || 'Ẩn danh', temp: tp2, score: Number(ld2.score) || 0, post_url: ld2.post_url || t.post_url || '', author_url: ld2.author_url || '', uid: uidFromAuthor(ld2.author_url), reply: ld2.reply || '', need: ld2.need || '', intent: ld2.intent || '', service: ld2.service || '', industry: ld2.industry || '', allow: { comment: (typeof brandAllow === 'function') ? !!brandAllow(brand, tp2, 'comment') : true, inbox: (typeof brandAllow === 'function') ? !!brandAllow(brand, tp2, 'inbox') : true } }, { merge: true }); prevStep = null; continue; }\n" + OA8;
const OA9 = A('outreach', 'OA9 sweep44 expired', "      await cancelQueued44(d.id, 'quá 72 giờ');");
const OA9_NEW = OA9 + "\n      await releaseLocksB(d.id, Array.isArray(th.lockKeysB) ? th.lockKeysB : null, !!(Array.isArray(th.doneSteps) && th.doneSteps.length)).catch(() => {}); /* LENH B: đóng phễu → nhả khoá (đã có bước → touched 14 ngày) */";
const OA10 = A('outreach', 'OA10 sweep44 expire head', "    if (now - born > EXPIRE_AFTER44) {");
const OA10_NEW = String.raw`    if (th.step === 'skipped_shared') { /* LENH B (rà): thread nhường gắn với nick thua khoá — quá 14 ngày → đóng; nick cờ/tắt → chuyển sang nick AdsPower sống cùng brand để được xét lại */
      if (now - born > 14 * 86400e3) { await d.ref.set({ active: false, step: 'skipped_shared_expired', closedAt: now }, { merge: true }); out.closed++; continue; }
      const nk0 = await nickOf(th.pid); const fl0 = nickFlag44(nk0); if (!fl0) continue; const al0 = await aliveApOf(code);
      if (al0.length && out.moved < MOVE_MAX44) { const i0 = (rr[code] = (rr[code] || 0) + 1) - 1; const to0 = al0[i0 % al0.length]; await d.ref.set({ pid: to0.id, movedFrom: th.pid || '', movedAt: now, nextAt: Math.max(tsMs44(th.nextAt) || 0, now + 60000) }, { merge: true }); out.moved++; } else { b.orphan++; out.orphan++; if (!th.orphanAt) await d.ref.set({ orphanAt: now, orphanWhy: fl0 }, { merge: true }); }
      continue; }
` + OA10;
const OA11 = A('outreach', 'OA11 sweep44 tail', "  await stRef.set(out).catch(() => {});\n  return out;");
const OA11_NEW = "  try { const oldLk = await db().collection('outreach_locks').where('expireAt', '<', now - 86400e3).limit(200).get(); if (!oldLk.empty) { const wbL = db().batch(); oldLk.docs.forEach(x => wbL.delete(x.ref)); await wbL.commit(); out.locksPruned = oldLk.size; } } catch (e) {} /* LENH B (rà): dọn khoá hết hạn > 24 h (TTL policy expireTs là đường dọn chính) */\n" + OA11;

/* ================= (5) stats.js ================= */
const ST1 = A('stats', 'ST1 KIND44', "const KIND44 = { react: 'react', comment: 'comment', add_friend: 'friend', inbox: 'inbox' };");
const ST1_NEW = ST1 + "\n/* LENH B: khoá tranh chấp automation của lead khi người thật tiếp quản → chuyển 'touched' 14 ngày (brand khác không tự động chạm khách đang được sales chăm). Hàm NỘI BỘ (không export — tránh trùng tên releaseLocksB của outreach.js khi index.js export *) */\nasync function touchLocksStB(db, leadId, keys) { const col = db.collection('outreach_locks'); let list = Array.isArray(keys) && keys.length ? keys.slice() : []; if (!list.length) { const q = await col.where('leadId', '==', String(leadId)).get(); list = q.docs.map(d => d.id); } let n = 0; const now = Date.now(); for (const k of list) { const s = await col.doc(k).get(); const d = s.exists ? (s.data() || {}) : null; if (d && d.leadId === String(leadId) && d.state !== 'touched') { await col.doc(k).set({ state: 'touched', touchedAt: now, touchedBy: 'human', expireAt: now + 14 * 86400e3, expireTs: new Date(now + 14 * 86400e3 + 3600e3) }, { merge: true }); n++; } } return n; }";
const ST2 = A('stats', 'ST2 stopMachine task', "  const taskRef = db.collection('outreach_tasks').doc(id + '__funnel');");
const ST2_NEW = "  try { await touchLocksStB(db, id, Array.isArray(t.lockKeysB) ? t.lockKeysB : null); } catch (e) { console.warn('[LENH B] touchLocksStB', e && e.message); }\n" + ST2;

/* ================= (6) scanstats.js ================= */
const SS1 = A('scanstats', 'SS1 brand of row', "  for (const r of rows) { if (!r || typeof r !== 'object') continue; const brand = brandMap.get(normUrl(r.url)); if (!brand) continue;");
const SS1_NEW = "  for (const r of rows) { if (!r || typeof r !== 'object') continue; const brand = String(r.brand || '').trim() || brandMap.get(normUrl(r.url)); if (!brand) continue; /* LENH B: dòng bySource ghi brand/source_id → group dùng chung không dồn về 1 brand */";

/* ================= (7) lib/multitouch.js ================= */
const MT1 = A('multitouch', 'MT1 idk', "  const idk = mtIdentityKey(lead.author_url, lead.phone, lead.email);\n  if (!idk) return false;                                   // ẩn danh, không contact -> không gộp");
const MT1_NEW = "  const idk = mtIdentityKey(lead.author_url, lead.phone, lead.email);\n  const brandB = String(opts.brand || '').trim(); /* LENH B: chỉ gộp trong CÙNG brand (lead fan-out có brand_hint); lead cũ không brand → như trước */\n  if (!idk) return tryMergeTextB(db, lead, opts, brandB);           // ẩn danh, không contact -> thử vân tay văn bản (PC-4)";
const MT2 = A('multitouch', 'MT2 query', "    .orderBy('last_seen_ms', 'desc').limit(6).get();\n\n  let doc = null;\n  snap.forEach(d => { if (!doc) { const x = d.data() || {}; if (isOpen(x.stage)) doc = d; } });\n  if (!doc) return false;                                   // không có lead mở phù hợp -> tạo lead mới bình thường");
const MT2_NEW = "    .orderBy('last_seen_ms', 'desc').limit(12).get();\n\n  let doc = null;\n  snap.forEach(d => { if (!doc) { const x = d.data() || {}; if (isOpen(x.stage) && (!brandB || String(x.brand_hint || x.brand || '').trim() === brandB)) doc = d; } }); /* LENH B: cùng brand */\n  if (!doc) return tryMergeTextB(db, lead, opts, brandB);           // không có lead mở phù hợp -> thử vân tay văn bản, không thì tạo lead mới";
const MT3 = A('multitouch', 'MT3 tail', "  await doc.ref.update(upd);\n  return true;\n}");
const MT3_NEW = MT3 + String.raw`

/* LENH B (PC-4, 12/09/2026): VÂN TAY VĂN BẢN — cùng brand, ≤14 ngày, cùng textKey (fold 160 ký tự đầu, bỏ link/dấu) → gộp thành touch (rải 1 bài đi nhiều nhóm mà không có SĐT/profile: 18 % lead-bài là bản gần trùng).
   Query where textKey == (single-field, không cần index ghép); lọc brand/thời gian/mở phía code. Fail-safe như tryMergeTouch (index.js bọc try/catch). */
export function textKeyB(text) { const s = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160); if (s.length < 24) return ''; let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return 'tk_' + h.toString(36); }
async function tryMergeTextB(db, lead, opts, brandB) {
  const tk = lead.textKey || textKeyB(lead.text); if (!tk) return false; lead.textKey = tk;
  if (!brandB) return false; // lead cũ không brand → không gộp theo văn bản (tránh gộp chéo brand)
  const now = Date.now(), cutoff = now - 14 * 86400e3;
  let snap; try { snap = await db.collection('leads').where('textKey', '==', tk).limit(20).get(); } catch (e) { return false; }
  const nIdkB = mtIdentityKey(lead.author_url, lead.phone, lead.email) || '', nUidB = String(lead.author_uid || '').trim();
  const sameWhoB = x => (!nIdkB || !x.identityKey || x.identityKey === nIdkB) && (!nUidB || !x.author_uid || String(x.author_uid).trim() === nUidB); /* LENH B (rà): cùng văn bản nhưng KHÁC người (identityKey/author_uid khác) → KHÔNG gộp (2 người copy cùng mẫu tin) */
  let doc = null; snap.forEach(d => { const x = d.data() || {}; if (!doc && isOpen(x.stage) && String(x.brand_hint || x.brand || '').trim() === brandB && (Number(x.last_seen_ms) || 0) >= cutoff && !x.dropped && !x.lost && sameWhoB(x)) doc = d; });
  if (!doc) return false;
  const cur = doc.data() || {}; const touches = Array.isArray(cur.touches) ? cur.touches.slice() : []; const url = lead.post_url || lead.url || '';
  if (url && touches.some(t => t.url === url)) return true;
  touches.push(mtTouch({ source: lead.source, time: lead.time, kind: lead.kind, url, text: lead.text, atMs: Number(lead.post_ts || lead.date_posted_ms || 0) || now }, now));
  const group_count = new Set(touches.map(t => t.source).filter(Boolean)).size; const base_score = Math.max(Number(cur.base_score || cur.score || 0), Number(lead.score || 0)); const score = Math.min(100, base_score + calcBoost(group_count));
  const upd = { touches, group_count, base_score, score, last_seen_ms: now, merged_at_ms: now, merged_by: 'textKey', insight_stale: group_count >= 2 }; const wl = spanLabel(touches); if (wl) upd.window_label = wl;
  if (!cur.identityKey && nIdkB) { upd.identityKey = nIdkB; if (!cur.author_url && lead.author_url) upd.author_url = lead.author_url; if (!cur.author_uid && nUidB) upd.author_uid = nUidB; if (!cur.phone && lead.phone) upd.phone = lead.phone; if (!cur.email && lead.email) upd.email = lead.email; if ((!cur.name || /^(ẩn danh|an danh)$/i.test(String(cur.name))) && lead.name) upd.name = lead.name; } /* LENH B (rà): lead gộp không định danh nhận định danh của bản mới (lần sau gộp theo identityKey, sales thấy tên/SĐT) */
  if (score >= ((typeof opts.hotThreshold === 'number') ? opts.hotThreshold : 80)) upd.temp = 'hot';
  await doc.ref.update(upd); return true;
}`;

/* ================= ÁP ================= */
if (process.argv[2] === '--anchors') { console.log(JSON.stringify(ANCH)); process.exit(0); }
const [FCF, FSR, FIX, FOA, FST, FSS, FMT] = [process.argv[2] || 'lib/config.js', process.argv[3] || 'lib/scraper.js', process.argv[4] || 'index.js', process.argv[5] || 'outreach.js', process.argv[6] || 'stats.js', process.argv[7] || 'scanstats.js', process.argv[8] || 'lib/multitouch.js'];
const src = { cf: fs.readFileSync(FCF, 'utf8'), sr: fs.readFileSync(FSR, 'utf8'), ix: fs.readFileSync(FIX, 'utf8'), oa: fs.readFileSync(FOA, 'utf8'), st: fs.readFileSync(FST, 'utf8'), ss: fs.readFileSync(FSS, 'utf8'), mt: fs.readFileSync(FMT, 'utf8') };
const done = Object.keys(src).filter(k => src[k].includes('LENH B'));
if (done.length === 7) { console.log('7 file: ĐÃ patch LENH B (idempotent) — bỏ qua'); process.exit(0); }
if (done.length) { console.error('LỆCH: ' + done.join(',') + ' đã có LENH B mà file khác chưa — khôi phục từ .bak rồi chạy lại'); process.exit(1); }
const need = (s, name, grp) => { for (const [k, a] of Object.entries(ANCH[grp])) { const n = s.split(a).length - 1; if (n !== 1) { console.error('KHONG THAY MOC ' + name + '/' + k + ' (đếm ' + n + '): ' + a.slice(0, 110).replace(/\n/g, '⏎')); process.exit(1); } } };
need(src.cf, 'lib/config.js', 'config'); need(src.sr, 'lib/scraper.js', 'scraper'); need(src.ix, 'index.js', 'index'); need(src.oa, 'outreach.js', 'outreach'); need(src.st, 'stats.js', 'stats'); need(src.ss, 'scanstats.js', 'scanstats'); need(src.mt, 'lib/multitouch.js', 'multitouch');
const between = (s, name, a, b) => { const i = s.indexOf(a); const j = s.indexOf(b, i); if (i < 0 || j < 0 || s.indexOf(a, i + 1) >= 0 || s.indexOf(b, j + 1) >= 0) { console.error('KHONG THAY DOAN ' + name); process.exit(1); } return [i, j + b.length]; };
const rep = (s, a, b) => s.replace(a, () => b);
const rep1 = (s, name, a, b) => { if (s.split(a).length - 1 !== 1) { console.error('KHONG THAY MOC (phụ) ' + name); process.exit(1); } return rep(s, a, b); };
/* (1) config · (2) scraper */
let cf = rep(src.cf, CF1, CF1_NEW);
let sr = src.sr; for (const [a, b] of [[SR1, SR1_NEW], [SR2, SR2_NEW], [SR3, SR3_NEW], [SR4, SR4_NEW], [SR5, SR5_NEW], [SR6, SR6_NEW], [SR7, SR7_NEW], [SR8, SR8_NEW]]) sr = rep(sr, a, b);
/* (3) index — 4 đoạn between trước (Pha 1 / vòng bình luận / Pha 2), rồi mốc đơn */
let ix = src.ix;
{ const [i, j] = between(ix, 'index.js/Pha1 mapPool', IX12_A, IX12_B); let seg = ix.slice(i, j);
  seg = rep1(seg, 'Pha1 mapPool(sources', 'await mapPool(sources, 3, async (src) => {', 'await mapPool(list, 3, async (src) => {');
  seg = rep1(seg, 'Pha1 row', IX12_ROW, IX12_ROW_NEW); seg = rep1(seg, 'Pha1 bdRecords', IX12_BD1, IX12_BD1_NEW);
  ix = ix.slice(0, i) + "  /* LENH B: đường cũ (Quét ngay / backfill / nguồn nick / URL không phải group) — thân giữ nguyên, chỉ nhận danh sách nguồn */\n  const legacyPha1B = async (list) => {\n" + seg + "\n  };" + PHA1B + ix.slice(j); }
{ const [i, j] = between(ix, 'index.js/vòng bình luận', IX23_A, IX23_B); ix = ix.slice(0, i) + IX23_NEW + ix.slice(j); }
{ const [i, j] = between(ix, 'index.js/Pha 2 seen', IX25_A, IX25_B); ix = ix.slice(0, i) + IX25_NEW + ix.slice(j); }
for (const [a, b] of [[IX1, IX1_NEW], [IX2, IX2_NEW], [IX3, IX3_NEW], [IX4, IX4_NEW], [IX5, IX5_NEW], [IX6, IX6_NEW], [IX7, IX7_NEW], [IX8, IX8_NEW], [IX9, IX9_NEW], [IX10, IX10_NEW], [IX11, IX11_NEW], [IX14, IX14_NEW], [IX15, IX15_NEW], [IX16, IX16_NEW], [IX17, IX17_NEW], [IX18, IX18_NEW], [IX19, IX19_NEW], [IX20, IX20_NEW], [IX21, IX21_NEW], [IX22, IX22_NEW], [IX24, IX24_NEW], [IX26, IX26_NEW], [IX27, IX27_NEW], [IX28, IX28_NEW], [IX29, IX29_NEW], [IX30, IX30_NEW], [IX31, IX31_NEW], [IX32, IX32_NEW], [IX33, IX33_NEW], [IX34, IX34_NEW], [IX35, IX35_NEW], [IX36, IX36_NEW], [IX37, IX37_NEW], [IX38, IX38_NEW], [IX39, IX39_NEW], [IX40, IX40_NEW], [IX41, IX41_NEW], [IX42, IX42_NEW], [IX43, IX43_NEW], [IX44, IX44_NEW], [IX45b, IX45b_NEW], [IX45, IX45_NEW], [IX46, IX46_NEW], [IX47, IX47_NEW], [IX48, IX48_NEW], [IX49, IX49_NEW], [IX50, IX50_NEW], [IX51, IX51_NEW], [IX52, IX52_NEW]]) ix = rep(ix, a, b);
/* (4) outreach · (5) stats · (6) scanstats · (7) multitouch */
let oa = src.oa; for (const [a, b] of [[OA1, OA1_NEW], [OA2, OA2_NEW], [OA3, OA3_NEW], [OA4, OA4_NEW], [OA5, OA5_NEW], [OA6, OA6_NEW], [OA7, OA7_NEW], [OA8, OA8_NEW], [OA9, OA9_NEW], [OA10, OA10_NEW], [OA11, OA11_NEW]]) oa = rep(oa, a, b);
let st = src.st; for (const [a, b] of [[ST1, ST1_NEW], [ST2, ST2_NEW]]) st = rep(st, a, b);
let ss = rep(src.ss, SS1, SS1_NEW);
let mt = src.mt; for (const [a, b] of [[MT1, MT1_NEW], [MT2, MT2_NEW], [MT3, MT3_NEW]]) mt = rep(mt, a, b);
/* kiểm sau khi ghép */
const must = [[cf, 'config', 'BD_PROGRESS_MIN_AGE_S'], [sr, 'scraper', 'harvestPostsB'], [sr, 'scraper', 'sowPostsB'], [sr, 'scraper', 'postIdB(p)'], [ix, 'index', 'scanAllB0'], [ix, 'index', 'acquireScanLockB'], [ix, 'index', 'pha1B'], [ix, 'index', 'legacyPha1B'], [ix, 'index', 'leadIdB('], [ix, 'index', 'flushSeenB'], [ix, 'index', 'lead_links'], [ix, 'index', "export * from './sources.js'"], [oa, 'outreach', 'acquireLocksB'], [oa, 'outreach', 'skipped_shared'], [st, 'stats', 'touchLocksStB'], [ss, 'scanstats', 'r.brand'], [mt, 'multitouch', 'tryMergeTextB']];
for (const [s, n, t] of must) if (!s.includes(t)) { console.error('GHÉP LỖI ' + n + ': thiếu ' + t); process.exit(1); }
if (ix.includes('await mapPool(sources, 3, async (src) => {')) { console.error('GHÉP LỖI index: mapPool(sources) còn sót'); process.exit(1); }
/* ghi 2 pha: mọi mốc 7 file đã khớp mới ghi đĩa */
fs.writeFileSync(FCF, cf); fs.writeFileSync(FSR, sr); fs.writeFileSync(FIX, ix); fs.writeFileSync(FOA, oa); fs.writeFileSync(FST, st); fs.writeFileSync(FSS, ss); fs.writeFileSync(FMT, mt);
console.log('PATCH OK 7 file (LENH B): lib/config.js 10 tham số · lib/scraper.js postIdB/gid/gieo gộp/gặt theo group · index.js khoá lượt + Pha 1 theo group + fan-out brand + seen.brands + lead id tất định + lead_links + thuần skip + việc phụ theo nhịp · outreach.js khoá tranh chấp automation · stats.js nhả khoá · scanstats.js brand theo dòng · lib/multitouch.js cùng brand + vân tay văn bản');
