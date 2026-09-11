/* FIXTURE LỆNH #46 — index.js dựng lại từ dump LỆNH #20 + patch #31b (chuỗi ≥28 ký tự đã che khi dump). Preamble giả lập để import được; thân scanAll giữ nguyên byte làm mốc patch; phần sau scanAll cắt bỏ. */
import { CFG } from './lib/config.js';
import { prefilterLead, scoreLead } from './lib/scorer.js';
const FieldValue = { serverTimestamp: () => Date.now(), increment: n => ({ __inc: n }), delete: () => ({ __del: 1 }) };
let db = globalThis.__slDb46 || null;
const tempOf = h => h >= 80 ? 'hot' : h >= 60 ? 'warm' : h >= 40 ? 'cold' : 'junk';
async function __brandAiOf() { return null; }
const loadSources = async () => []; const loadConfig = async () => ({});

/* Chạy song song có giới hạn (concurrency pool) */
async function mapPool(items, limit, fn) {
  let i = 0;
  const n = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  }));
}
const seenDoc = id => db.collection('seen').doc(String(id).replace(/[^\w-]/g, '_').slice(0, 480));
// Chuẩn hoá URL bài (bỏ query/fragment, bỏ "/" thừa, lowercase) — dùng chung cho khớp bài cha & bookkeeping comment.
const urlKey = u => String(u || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
const cmtScrapeDoc = k => db.collection('cmt_scrape').doc(String(k).replace(/[^\w-]/g, '_').slice(0, 480));
const groupStateDoc = url => db.collection('group_state').doc(String(url || '').replace(/[^\w-]/g, '_').slice(0, 480));

/* Quét nguồn (SONG SONG) + chấm điểm AI (POOL) + ghi TIẾN ĐỘ realtime vào scan_jobs/{jobId}.
 * opts: { sourceUrl?, startDate?, endDate?, numPosts?, rangeLabel?, jobId? } */
async function scanAll(trigger = 'scheduled', opts = {}) {
  const t0 = Date.now();
  let sources = await loadSources();
  const brandBySource = {}; try { (sources || []).forEach(s => { if (s && s.name) brandBySource[s.name] = String(s.brand || '').trim(); }); } catch (e) {} // v17 dong-dau-kep
  const srcByGroup = {}; try { (sources || []).forEach(s => { const m = String(s.url || s.link || '').match(/facebook\.com\/groups\/([^\/\?#]+)/); if (m && s.name) srcByGroup[m[1]] = s.name; }); } catch (e) {} /* v-fixgrp: map group that -> ten nguon */

  if (opts.sourceUrl) sources = sources.filter(s => s.url === opts.sourceUrl);
  const config = await loadConfig();
  const gKw = config.keywords || [], gEx = config.exclude || [];
  const job = opts.jobId ? db.collection('scan_jobs').doc(String(opts.jobId).slice(0, 200)) : null;
  const range = (opts.startDate || opts.endDate)
    ? { label: opts.rangeLabel || 'custom', start: opts.startDate || null, end: opts.endDate || null } : null;

  // Chế độ AI: 'saver' (2 tầng — model rẻ lọc trước) hoặc 'max' (model thông minh chấm MỌI bài).
  // Super Admin chỉnh qua config/app.aiMode; fallback theo biến môi trường TWO_STAGE.
  const aiMode = config.aiMode === 'max' ? 'max'
               : config.aiMode === 'saver' ? 'saver'
               : (CFG.TWO_STAGE !== false ? 'saver' : 'max');
  const twoStage = aiMode === 'saver'; // chế độ MẶC ĐỊNH toàn cục
  // Mỗi group có thể GHI ĐÈ: src.aiMode ('max'|'saver') > cấu hình chung (aiMode)
  const srcMode = (src) => { const m = src && src.aiMode; return (m === 'max' || m === 'saver') ? m : aiMode; };
  const force = !!opts.force; // QUÉT LẠI TỪ ĐẦU: bỏ chống trùng → quét & chấm lại mọi bài trong khoảng
  // Quét comment: Super Admin bật/tắt qua config/app.scanComments (true/false) > biến môi trường SCAN_COMMENTS.
  const scanComments = (config.scanComments === true)
    || (config.scanComments !== false && CFG.SCAN_COMMENTS === true);
  let scanned = 0, commentsScanned = 0, candTotal = 0, prefilterDone = 0, matched = 0, scored = 0, kept = 0, hot = 0, srcDone = 0;
  let skippedSeen = 0, scoreErrors = 0, scrapeErrors = 0;
  let backfillSkipped = 0, commentsRefreshSkipped = 0; // chống lãng phí: bỏ qua backfill trùng / quét lại comment chưa tới nhịp
  let scoreCalls = 0, preCalls = 0;                 // số lượt gọi model thông minh / model rẻ
  let mainIn = 0, mainOut = 0, preIn = 0, preOut = 0; // token theo từng model
  const dist = { hot: 0, warm: 0, cold: 0, junk: 0 };
  const bySource = [];

  // Ghi tiến độ (throttle ~1.2s) để dashboard hiển thị realtime
  let lastWrite = 0;
  const prog = async (phase, force) => {
    if (!job) return;
    const now = Date.now();
    if (!force && now - lastWrite < 1200) return;
    lastWrite = now;
    try {
      await job.set({
        status: 'running', phase, trigger, range, sourceUrl: opts.sourceUrl || null, twoStage, aiMode,
        sourcesTotal: sources.length, sourcesDone: srcDone,
        postsFetched: scanned, commentsFetched: commentsScanned, scanComments, candidatesTotal: candTotal, prefilterDone,
        postsMatched: matched, postsScored: scored,
        leadsCreated: kept, hotLeads: hot, skippedSeen, scrapeErrors, scoreErrors,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  };
  if (job) { try { await job.set({ createdAt: FieldValue.serverTimestamp() }, { merge: true }); } catch (e) {} }

  /* ---- Nhật ký "tất cả bài đã quét": ghi MỌI bài (kèm điểm & quyết định) theo LÔ, realtime.
     Ghi cho CẢ quét thủ công LẪN quét nền theo lịch → danh sách "Bài đã quét" phản ánh đúng hoạt động nền.
     Chỉ ghi bài MỚI (bài trùng đã bị bỏ ở Pha 2 trước recordPost) nên lượng ghi nhỏ.
     Bài KHÔNG phù hợp gắn expireAt = giờ + N ngày (hàm cleanupScannedPosts tự dọn); lead giữ vĩnh viễn. ---- */
  const logPosts = CFG.LOG_SCANNED_POSTS !== false;
  const TTL_MS = Math.max(0, CFG.SCANNED_TTL_DAYS || 1) * 86400e3;
  let postLogged = 0;
  const postBuf = [];
  let flushingPosts = false;
  async function flushPosts(force) {
    if (flushingPosts) return;
    if (!force && postBuf.length < 25) return;
    flushingPosts = true;
    try {
      while (postBuf.length) {
        const chunk = postBuf.splice(0, 400);
        const wb = db.batch();
        chunk.forEach(r => wb.set(db.collection('scanned_posts').doc(), r));
        try { await wb.commit(); postLogged += chunk.length; } catch (e) {}
      }
    } finally { flushingPosts = false; }
  }
  /* v-selfcmt (LỆNH #31b 05/09/2026): bình luận của CHÍNH chủ bài → không phải lead (bỏ trước AI, không tốn tiền). So tên bỏ dấu hoặc link profile; tên ẩn danh không tính. */
  const __SL_ANON31 = /an danh|anonymous|nguoi tham gia|facebook user|nguoi dung facebook/;
  function __slFold31(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function __slProfileKey31(u) {
    const s = String(u || '').trim(); if (!s) return '';
    let m = s.match(/profile\.php\?id=(\d+)/) || s.match(/\/people\/[^/]+\/(\d+)/); if (m) return 'id:' + m[1];
    m = s.match(/facebook\.com\/([A-Za-z0-9.]{3,})\/?(?:[?#]|$)/);
    return (m && !/^(groups|people|profile\.php|photo|photos|watch|share|reel|reels|stories|events|pages|marketplace|hashtag|posts|permalink\.php|story\.php)$/i.test(m[1])) ? 'u:' + m[1].toLowerCase() : '';
  }
  function __slIsSelfComment31(c) {
    const a = __slFold31(c.author), p = __slFold31(c.parent_author);
    if (a && p && a === p && !__SL_ANON31.test(a)) return true;
    const ka = __slProfileKey31(c.user_url), kp = __slProfileKey31(c.parent_user_url);
    return !!(ka && kp && ka === kp);
  }
  function recordPost(x, fields) {
    if (!logPosts) return;
    const kept = !!fields.kept;
    postBuf.push({
      jobId: opts.jobId || null, trigger,
      source: x.post.source || x.src.name || '',
      sourceUrl: x.src.url || '',
      brand: String(brandBySource[x.post.source || x.src.name || ''] || '').trim(), // v87 dong-dau brand tung bai
      author: String(x.post.author || '').slice(0, 120),
      text: String(x.post.text || '').slice(0, 600),
      post_url: x.post.url || '', time: x.post.time || '',
      kind: x.post.kind || 'post', parent_url: x.post.parent_url || '',
      parent_author: String(x.post.parent_author || '').slice(0, 120),
      parent_text: String(x.post.parent_text || '').slice(0, 300),
      comment_id: x.post.comment_id || '',
      comment_url: x.post.comment_url || '',
      decision: fields.decision || 'scored_low',
      score: Number(fields.score) || 0, temp: fields.temp || null,
      intent: fields.intent || '', service: fields.service || '', kept, role: String(fields.role || '').slice(0, 24),
      createdAt: FieldValue.serverTimestamp(),
      expireAt: kept ? null : new Date(Date.now() + TTL_MS)
    });
  }

  await prog('starting', true);

  /* v-patch profile-scan: thu ket qua ho so BD dang cho (da dat lenh tu nhip truoc) */
  try { await __bdProfCollect(); } catch (e) { console.error('[profile-scan] collect:', (e&&e.message)||e); }
  /* ---- Pha 1: SCRAPE các nguồn song song (pool 3) ---- */
  await prog('scraping', true);
  const collected = []; // { post, effSrc, src, row }
  // Chống quét lại backfill: khoá theo [group + khoảng ngày]. Live scan (không có ngày) KHÔNG bị ảnh hưởng.
  const isBackfill = !!(opts.startDate || opts.endDate);
  const bfKey = (url) => ('bf_' + String(url || '') + '|' + (opts.startDate || '') + '|' + (opts.endDate || '')).replace(/[^\w-]/g, '_').slice(0, 480);
  // ===== PROBE + FULL-SWEEP (chống lãng phí tiền lấy bài) =====
  // Quét sống: mỗi nhịp chỉ lấy PROBE_POSTS bài mới nhất. Feed Bright Data sắp mới-nhất-trước → nếu các bài đầu đã "seen"
  // thì phía dưới cũng cũ → bỏ qua nguồn. Nếu CẢ probe đều mới → có thể còn bài → lấy đủ POSTS_PER_GROUP.
  // Định kỳ FULLSWEEP_HOURS giờ vẫn lấy đủ 1 lần (lưới an toàn chống sót bài ghim/lệch thứ tự + làm mới comment).
  const liveProbe = !isBackfill && !force;
  const PROBE = Math.max(1, CFG.PROBE_POSTS || 5);
  const SWEEP_MS = Math.max(0, CFG.FULLSWEEP_HOURS || 2) * 3600 * 1000;
  const nowMs0 = Date.now();
  let gsSnaps = [];
  if (liveProbe && sources.length) { try { gsSnaps = await db.getAll(...sources.map(s => groupStateDoc(s.url))); } catch (e) { gsSnaps = []; } }
  const gsBy = new Map(); sources.forEach((s, i) => { const sn = gsSnaps[i]; gsBy.set(s.url, (sn && sn.exists) ? sn.data() : null); });
  let probeRuns = 0, sweepRuns = 0, probeEscalated = 0, probeIdle = 0, bdRecords = 0, authCheckpoints = 0, authRuns = 0;
  let bdCmtRecords = 0; // v-patch chi-phí: tổng record COMMENT BrightData tính tiền lượt này
  await mapPool(sources, 3, async (src) => {
    // v-patch chi-phí 16/08: bdPosts/bdComments = record BrightData TÍNH TIỀN (đếm TRƯỚC khi cắt seen);
    // nguồn private (quét bằng nick/browser) KHÔNG tốn BrightData → bdPosts giữ 0. ekyc = lead có SĐT (1 lượt check).
    const row = { name: src.name || '', industry: src.industry || '', url: src.url || '', posts: 0, matched: 0, leads: 0, hot: 0, error: null, bdPosts: 0, bdComments: 0, ekyc: 0 };
    bySource.push(row);
    const effSrc = { ...src, keywords: [...(src.keywords || []), ...gKw], exclude: [...(src.exclude || []), ...gEx] };
    if (isBackfill && !force) {
      try { const bd = await db.collection('backfill_done').doc(bfKey(src.url)).get(); if (bd.exists) { row.error = 'đã backfill khoảng này — bỏ qua'; backfillSkipped++; srcDone++; await prog('scraping'); return; } } catch (e) {}
    }
    try {
      // ===== NGUỒN PRIVATE: quét bằng NICK qua microservice trình duyệt (chỉ theo nhịp sweep, browser nặng) =====
      if (src.authAccountId && !isBackfill) {
        authRuns++;
        const gs = gsBy.get(src.url);
        const lastSweep = (gs && gs.lastSweepAt && gs.lastSweepAt.toMillis) ? gs.lastSweepAt.toMillis() : 0;
        if (!force && (nowMs0 - lastSweep) < SWEEP_MS) { row.error = 'auth: chưa tới nhịp'; srcDone++; await prog('scraping'); return; }
        let acc = null;
        try {
          const md = await db.collection('fb_accounts').doc(src.authAccountId).get();
          if (md.exists && md.data().status === 'quarantined') { row.error = 'nick đang bị cách ly'; srcDone++; await prog('scraping'); return; }
          const sd = await db.collection('fb_account_secrets').doc(src.authAccountId).get();
          if (sd.exists) acc = sd.data();
        } catch (e) {}
        if (!acc || !acc.cookie) { row.error = 'thiếu cookie nick'; scrapeErrors++; srcDone++; await prog('scraping'); return; }
        const res = await fetchPostsAuth(src, acc, { numPosts: CFG.AUTH_POSTS_PER_GROUP });
        if (res.checkpoint) {
          try { await db.collection('fb_accounts').doc(src.authAccountId).set({ status: 'quarantined', quarantineReason: 'checkpoint', quarantinedAt: FieldValue.serverTimestamp() }, { merge: true }); } catch (e) {}
          row.error = 'CHECKPOINT — đã cách ly nick'; authCheckpoints++; scrapeErrors++; srcDone++; await prog('scraping'); return;
        }
        const aposts = res.posts || [];
        bdRecords += aposts.length; row.posts = aposts.length; scanned += aposts.length;
        for (const post of aposts) collected.push({ post, effSrc, src, row });
        try { await groupStateDoc(src.url).set({ url: src.url || '', lastSweepAt: FieldValue.serverTimestamp() }, { merge: true }); } catch (e) {}
        try { await db.collection('fb_accounts').doc(src.authAccountId).set({ lastUsedAt: FieldValue.serverTimestamp(), status: 'active', lastPosts: aposts.length }, { merge: true }); } catch (e) {}
        srcDone++; await prog('scraping'); return;
      }
      // Chọn số bài lấy: backfill/force giữ nguyên; live = probe (PROBE) hoặc sweep (đủ POSTS_PER_GROUP) khi tới hạn.
      let liveNum, didSweep = false;
      if (liveProbe) {
        const gs = gsBy.get(src.url);
        const lastSweep = (gs && gs.lastSweepAt && gs.lastSweepAt.toMillis) ? gs.lastSweepAt.toMillis() : 0;
        if ((nowMs0 - lastSweep) >= SWEEP_MS) { liveNum = CFG.POSTS_PER_GROUP; didSweep = true; sweepRuns++; }
        else { liveNum = PROBE; probeRuns++; }
      }
      const posts = await fetchPosts(src, { startDate: opts.startDate, endDate: opts.endDate, numPosts: liveProbe ? liveNum : opts.numPosts, notInclude: (function(){ const g = gsBy.get(src.url); return (liveProbe && g && Array.isArray(g.recentIds)) ? g.recentIds : undefined; })() });
      bdRecords += posts.length; row.bdPosts += posts.length;
      let usePosts = posts;
      if (liveProbe && !didSweep && posts.length) {
        // Đếm số bài MỚI ở đầu danh sách (chưa thấy). Gặp bài đã-seen đầu tiên là dừng (phía dưới đều cũ hơn).
        let snaps = []; try { snaps = await db.getAll(...posts.map(p => seenDoc(p.post_id))); } catch (e) { snaps = []; }
        let leadingNew = 0; for (let j = 0; j < posts.length; j++) { if (snaps[j] && snaps[j].exists) break; leadingNew++; }
        if (leadingNew === 0) { usePosts = []; probeIdle++; }
        else if (leadingNew >= posts.length && posts.length >= (liveNum || 0)) { // probe đầy bài mới → có thể còn nữa → lấy đủ
          probeEscalated++;
          try { const full = await fetchPosts(src, { numPosts: CFG.POSTS_PER_GROUP, notInclude: (function(){ const g = gsBy.get(src.url); return (g && Array.isArray(g.recentIds)) ? g.recentIds : undefined; })() }); bdRecords += full.length; row.bdPosts += full.length; usePosts = full; } catch (e) { usePosts = posts; }
        } else { usePosts = posts.slice(0, leadingNew); }
      }
      row.posts = usePosts.length; scanned += usePosts.length;
      for (const post of usePosts) collected.push({ post, effSrc, src, row });
      if (didSweep) { try { await groupStateDoc(src.url).set({ url: src.url || '', lastSweepAt: FieldValue.serverTimestamp() }, { merge: true }); } catch (e) {} }
      if (isBackfill) { try { await db.collection('backfill_done').doc(bfKey(src.url)).set({ url: src.url || '', startDate: opts.startDate || '', endDate: opts.endDate || '', at: FieldValue.serverTimestamp(), posts: usePosts.length }, { merge: true }); } catch (e) {} }
    } catch (e) { console.error('scrape', src.name, e.message); scrapeErrors++; row.error = e.message.slice(0, 140); }
    srcDone++; await prog('scraping');
  });

  /* ---- Pha 1b: QUÉT COMMENT của mọi bài vừa lấy (nếu bật) → coi mỗi comment như 1 ứng viên lead ----
     Comment đi CHUNG pipeline (chống trùng → lọc rác → tầng 1 → tầng 2) với effSrc/src/row của bài cha. */
  if (scanComments) {
    await prog('comments', true);
    // Bright Data trả post_url có thể THÊM query (vd ?locale=en_US) / thừa dấu "/" → chuẩn hoá khi so khớp bài cha.
    const urlKey = u => String(u || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
    // gom URL bài (kèm src) để gọi dataset comment; map URLkey → {effSrc, src, row, parent...}
    const ctx = new Map();
    const cand = []; // ứng viên bài (đã khử trùng theo URL trong lần chạy này)
    for (const x of collected) {
      if (x.post.kind === 'comment') continue;
      const u = x.post.url; if (!u) continue;
      const k = urlKey(u); if (ctx.has(k)) continue;
      ctx.set(k, { effSrc: x.effSrc, src: x.src, row: x.row, parentAuthor: x.post.author || '', parentText: x.post.text || '', parentUrl: x.post.url || '', parentUserUrl: x.post.user_url || '' }); /* v-selfcmt */
    const sowMetaOf = (u) => { const c = ctx.get(urlKey(u)); return c ? { url: u, srcUrl: String((c.src && c.src.url) || ''), parentUrl: c.parentUrl || u, parentAuthor: String(c.parentAuthor || '').slice(0, 200), parentText: String(c.parentText || '').slice(0, 1500), parentUserUrl: String(c.parentUserUrl || '').slice(0, 300) } : null; };
        for (const m of hv.metas) { const cc = m && srcCtx.get(String(m.srcUrl || '')); const k = urlKey((m && (m.parentUrl || m.url)) || ''); if (!cc || !k) { orphan++; continue; } if (!ctx.has(k)) ctx.set(k, { effSrc: cc.effSrc, src: cc.src, row: cc.row, parentAuthor: m.parentAuthor || '', parentText: m.parentText || '', parentUrl: m.parentUrl || m.url || '', parentUserUrl: m.parentUserUrl || '' }); }
      cand.push({ k, url: u, src: x.src });
    }
    // CHỐNG LÃNG PHÍ: chỉ quét comment cho bài MỚI, hoặc bài cũ theo NHỊP tối thiểu (3h nếu ≤48h kể từ lần đầu, 12h nếu hơn).
    // Bookkeeping: collection "cmt_scrape" doc id = urlKey → { firstAt, lastAt }. Lỗi đọc → fail-open (vẫn quét, không mất lead).
    const HMS = 3600 * 1000;
    const freshWin = Math.max(0, CFG.COMMENT_FRESH_WINDOW_HOURS || 48) * HMS;
    const freshIv = Math.max(0, CFG.COMMENT_REFRESH_FRESH_HOURS || 3) * HMS;
    const oldIv = Math.max(0, CFG.COMMENT_REFRESH_OLD_HOURS || 12) * HMS;
    const nowMs = Date.now();
    const cmtDoc = k => db.collection('cmt_scrape').doc(String(k).replace(/[^\w-]/g, '_').slice(0, 480));
    let bk = [];
    try { if (cand.length) bk = await db.getAll(...cand.map(c => cmtDoc(c.k))); } catch (e) { bk = []; }
    const items = [];
    const bw = db.batch(); let bwN = 0;
    cand.forEach((c, i) => {
      const snap = bk[i]; const d = (snap && snap.exists) ? snap.data() : null;
      const qualifiedOnly = !!(c.src && c.src.commentMode === 'qualified_only');
      let doIt = true;
      if (d && !force) {
        // 'qualified_only': bài đã quét lần đầu mà CHƯA từng ra lead → ngừng refresh (tiết kiệm). Bài mới (d==null) vẫn quét 1 lần.
        if (qualifiedOnly && d.qualified !== true) { doIt = false; }
        else {
          const firstMs = (d.firstAt && d.firstAt.toMillis) ? d.firstAt.toMillis() : nowMs;
          const lastMs = (d.lastAt && d.lastAt.toMillis) ? d.lastAt.toMillis() : 0;
          const iv = (nowMs - firstMs) <= freshWin ? freshIv : oldIv;
          doIt = (nowMs - lastMs) >= iv; // chưa tới nhịp → bỏ qua lần này (đã quét gần đây rồi)
        }
      }
      if (doIt) {
        items.push({ url: c.url, source: c.src });
        bw.set(cmtDoc(c.k), d ? { lastAt: FieldValue.serverTimestamp() } : { firstAt: FieldValue.serverTimestamp(), lastAt: FieldValue.serverTimestamp() }, { merge: true });
        bwN++;
      } else { commentsRefreshSkipped++; }
    });
    if (bwN) { try { await bw.commit(); } catch (e) {} }
    try {
      const cmtBilled = new Map(); // v-patch chi-phí: parentUrl → số record comment BrightData TÍNH TIỀN
      const cmts = await fetchComments(items, { perPost: CFG.COMMENTS_PER_POST, billed: cmtBilled });
      for (const [pu, n] of cmtBilled) {
        bdCmtRecords += n;
        const c = ctx.get(urlKey(pu));
        if (c) c.row.bdComments += n;
        else { // record không khớp bài cha (BD trả post_url lạ) → gán nguồn ĐẦU của lô để không mất tiền nào khỏi sổ
          const first = bySource.find(r => !r.error) || bySource[0];
          if (first) first.bdComments += n;
        }
      }
      for (const { comment, parentUrl } of cmts) {
        const c = ctx.get(urlKey(parentUrl)) || ctx.get(urlKey(comment.parent_url));
        if (!c) continue;                       // không khớp bài cha → bỏ
        if (!comment.text || !comment.text.trim()) continue;
        // Lưu kèm thông tin bài cha vào comment để UI dựng được tiêu đề kể cả khi bài gốc không nằm trong cửa sổ tải.
        comment.parent_url = c.parentUrl || comment.parent_url || parentUrl; // dùng URL bài cha đã quét (khớp post_url)
        comment.parent_author = c.parentAuthor || '';
        comment.parent_text = c.parentText || '';
        comment.parent_user_url = c.parentUserUrl || ''; comment.self_comment = __slIsSelfComment31(comment); /* v-selfcmt */
        commentsScanned++; c.row.posts++;       // tính comment vào số item của nguồn
        collected.push({ post: comment, effSrc: c.effSrc, src: c.src, row: c.row });
      }
    } catch (e) { console.error('fetchComments lỗi:', e.message); }
    await prog('comments', true);
  }

  /* ---- Pha 2: chống trùng (đọc/ghi seen theo LÔ) + bỏ bài RÁC (exclude).
     Chế độ 2 tầng KHÔNG dùng cổng keyword "include" — để AI tầng 1 đọc hiểu mọi bài còn lại. ---- */
  await prog('filtering', true);
  const candidates = [];
  let selfSkipped = 0; /* v-selfcmt */
  for (let i = 0; i < collected.length; i += 300) {
    const slice = collected.slice(i, i + 300);
    let snaps = [];
    try { snaps = await db.getAll(...slice.map(x => seenDoc(x.post.post_id))); } catch (e) { snaps = []; }
    const wb = db.batch(); let writes = 0;
    slice.forEach((x, j) => {
      const wasSeen = snaps[j] && snaps[j].exists;
      if (wasSeen && !force) { skippedSeen++; return; }            // chống trùng (tắt khi quét lại từ đầu)
      if (!wasSeen) { wb.set(seenDoc(x.post.post_id), { at: FieldValue.serverTimestamp() }); writes++; }
      if (x.post.self_comment) { selfSkipped++; recordPost(x, { decision: 'self_comment' }); return; } /* v-selfcmt: chủ bài tự bình luận → không phải lead, không gọi AI */
      const pass = !isExcluded(x.post.text, x.effSrc); // luôn để AI đọc hiểu ngữ cảnh (chỉ bỏ bài rác theo exclude)
      if (pass) candidates.push(x);
      else recordPost(x, { decision: twoStage ? 'excluded' : 'no_keyword' });
    });
    if (writes) { try { await wb.commit(); } catch (e) {} }
    await flushPosts();
    await prog('filtering');
  }
  candTotal = candidates.length;

  /* ---- Pha 3a: TẦNG 1 theo chế độ AI của TỪNG group.
     'saver' → model rẻ lọc trước; 'max' → bỏ tầng lọc, vào thẳng tầng 2. ---- */
  const toScore = [];
  const saverList = candidates.filter(x => srcMode(x.src) === 'saver');
  const maxList   = candidates.filter(x => srcMode(x.src) === 'max');
  // 'max': chấm sâu thẳng mọi bài
  maxList.forEach(x => { matched++; x.row.matched++; toScore.push(x); });
  // 'saver': qua tầng 1 (model rẻ) — chỉ bài tiềm năng mới lên tầng 2
  if (saverList.length) {
    candTotal = saverList.length; // số bài thực sự đi qua tầng 1 (cho thanh tiến độ)
    await prog('prefiltering', true);
    await mapPool(saverList, CFG.PREFILTER_CONCURRENCY || 10, async (x) => {
      const pf = await prefilterLead(x.post, await __brandAiOf(x.effSrc || x.src || x.source)); /* v-brandai */
      const u = pf._usage || {}; if (pf._llm) preCalls++;
      preIn += u.prompt || 0; preOut += u.completion || 0;
      prefilterDone++;
      if (pf.maybe) { matched++; x.row.matched++; toScore.push(x); }
      else recordPost(x, { decision: 'prefiltered_out' });
      await flushPosts();
      await prog('prefiltering');
    });
  }

    // ==== v16-patch 09/08/2026: ghi lead TUC THI khi cham dat — feed realtime, khong mat lead neu function chet giua chung ====
  if (selfSkipped) console.log('[self-comment] bỏ ' + selfSkipped + ' bình luận của chính chủ bài (không gọi AI)'); /* v-selfcmt */
  const leadKey = u => 'L_' + String(u || '').replace(/[^\w-]/g, '_').slice(0, 470);
  async function commitLeadNow(row, lead) {
    /* v-fixgrp: comment co the bi khop nham bai cha trong batch -> doi chieu group that tu URL, sua lai nguon truoc khi ghi */
    try {
      const _gm = String((lead && (lead.comment_url || lead.post_url || lead.url)) || '').match(/facebook\.com\/groups\/([^\/\?#]+)/);
      if (_gm && srcByGroup[_gm[1]] && lead.source !== srcByGroup[_gm[1]]) {
        console.warn('[v-fixgrp] doi nguon', lead.source, '->', srcByGroup[_gm[1]], 'theo group', _gm[1]);
        lead.source = srcByGroup[_gm[1]];
        if (Array.isArray(lead.touches)) lead.touches.forEach(t => { if (t) t.source = srcByGroup[_gm[1]]; });
      }
    } catch (e) {}
  // [multitouch A] Gop khach xuat hien nhieu nhom trong 48h. Fail-safe: loi -> tao lead thuong.
  try {
    const _mtHot = (typeof CFG !== 'undefined' && CFG && typeof CFG.HOT_THRESHOLD === 'number') ? CFG.HOT_THRESHOLD : 80;
    if (await tryMergeTouch(db, lead, { windowH: 48, hotThreshold: _mtHot })) return true;
  } catch (e) { console.error('[multitouch] merge loi, tao lead thuong:', e && e.message); }
  // [multitouch A] Gan khoa dinh danh + touch dau cho lead MOI (de lan sau con gop duoc).
  try {
    if (lead && !lead.identityKey) {
      lead.identityKey = mtIdentityKey(lead.author_url, lead.phone, lead.email);
      lead.touches = [ mtTouch({ source: lead.source, time: lead.time, kind: lead.kind, url: lead.post_url || lead.url, text: lead.text }, Date.now()) ];
      lead.group_count = 1;
      lead.base_score = Number(lead.score || 0);
      lead.last_seen_ms = Date.now();
    }
  } catch (e) { console.error('[multitouch] tag lead loi:', e && e.message); }

    let ref;
    if (force && lead.post_url) {
      ref = db.collection('leads').doc(leadKey(lead.post_url));
      try { const s = await ref.get(); if (s.exists) return false; } catch (e) {}
    } else ref = db.collection('leads').doc();
    try { await ref.set(lead); } catch (e) { return false; }
  /* v17 DONG-DAU-KEP: scanner tu dong dau brand ngay sau khi ghi lead (~50ms).
     Gateway ZBS (onDocumentUpdated) thay dung cu chuyen-trang-thai justTagged -> ZNS som hon, khong phu thuoc event bus.
     Neu nhip nay loi: tagLeadBrand (da bat RETRY) van la luoi du phong nhu cu. */
  try {
    const _b = (typeof brandBySource !== 'undefined' && brandBySource[lead.source]) || '';
    if (_b) await ref.update({ brand: _b, brand_pending: FieldValue.delete(), brand_tagged_at: FieldValue.serverTimestamp(), brand_tagged_by: 'scanner-inline' });
    else await ref.update({ brand_pending: true, brand_tagged_at: FieldValue.serverTimestamp(), brand_tagged_by: 'scanner-inline' });
  } catch (e) { console.warn('[birthstamp] loi dong dau inline (luoi du phong se do):', e.message); }

    kept++; row.leads++; if ((lead.score || 0) >= CFG.HOT_THRESHOLD) { hot++; row.hot++; }
    if (lead && lead.phone) row.ekyc = (row.ekyc || 0) + 1; // v-patch chi-phí: 1 lead có SĐT ≈ 1 lượt check eKYC
    return true;
  }
/* ---- Pha 3b: TẦNG 2 — model THÔNG MINH chấm sâu + viết phản hồi (song song) ---- */
  await prog('scoring', true);
  const leads = [];
  const qualifiedUrls = new Set(); // bài (theo urlKey) đã ra lead → cho phép tiếp tục refresh comment ở chế độ 'qualified_only'
  await mapPool(toScore, CFG.SCORE_CONCURRENCY || 6, async (x) => {
    let ai; try { ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc)); }
    catch { scoreErrors++; scored++; recordPost(x, { decision: 'error' }); await flushPosts(); await prog('scoring'); return; }
    const u = ai._usage || {}; if (ai._llm) scoreCalls++;
    mainIn += u.prompt || 0; mainOut += u.completion || 0;
    const t = tempOf(ai.hotness || 0); if (dist[t] !== undefined) dist[t]++;
    scored++; await prog('scoring');
    const __role = String(ai.role || '').toLowerCase().trim(), __roleBlock = (__role === 'seller' || __role === 'poster_self'); /* v-selfcmt: người bán/đối thủ hoặc chính chủ bài → không phải lead */
    const isLead = !!ai.is_real_lead && !__roleBlock && (ai.hotness || 0) >= CFG.MIN_KEEP_SCORE;
    recordPost(x, { decision: isLead ? 'lead' : (__roleBlock ? (__role === 'seller' ? 'seller' : 'self_comment') : 'scored_low'), score: ai.hotness || 0, temp: t,
      intent: ai.intent || '', service: ai.service || '', kept: isLead, role: __role });
    await flushPosts();
    if (!isLead) return;
    { const pURL = (x.post.kind === 'comment') ? (x.post.parent_url || x.post.url) : x.post.url; if (pURL) qualifiedUrls.add(urlKey(pURL)); }
    // v-patch miss-reply 18/08: model quen/cat truong reply -> goi cham lai toi da 2 lan, khong de lead trong goi y
    if (!(ai.reply && String(ai.reply).trim())) {
      for (let __rt = 0; __rt < 2; __rt++) {
        try {
          const __ai2 = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc));
          const __u2 = __ai2._usage || {}; if (__ai2._llm) scoreCalls++;
          mainIn += __u2.prompt || 0; mainOut += __u2.completion || 0;
          if (__ai2.reply && String(__ai2.reply).trim()) { ai.reply = __ai2.reply; break; }
        } catch (e) {}
      }
      if (!(ai.reply && String(ai.reply).trim())) console.error('[miss-reply] van rong sau 3 luot:', x.post.url || x.post.author || '');
    }
    const _zc = await enrichPhoneFromText((x.post.text || ''), { db, apiKey: process.env.EKYCPRO_API_KEY, doCheck: process.env.ZALO_CHECK_ENABLED !== 'false', cacheDays: 90 });
    // v-patch profile-scan: lead NONG + co link profile -> dat lenh quet ho so BD (ket qua ve o nhip scan sau)
    let __pf = {};
    try {
      if (t === 'hot' && x.post.user_url) {
        const __sid = await __bdProfTrigger(x.post.user_url);
        if (__sid) __pf = { profile_status:'pending', profile_snapshot:__sid, profile_url:String(x.post.user_url).slice(0,300) };
      }
    } catch (e) { console.error('[profile-scan] trigger:', (e&&e.message)||e); }
    await commitLeadNow(x.row, { ...__pf,
      name: x.post.author, score: ai.hotness, temp: t,
      industry: ai.industry || x.src.industry || '', source: x.post.source,
      time: x.post.time, need: ai.need || ai.intent || '', text: x.post.text, intent: ai.intent || '',
      service: ai.service || '', stage: 'new', assignee: null, reply: ai.reply || '', role: __role, role_reason: String(ai.role_reason || '').slice(0, 160),
      ai_scored: ai._llm !== false, // s18b: false = cham bang bo du phong -> giao dien gan nhan "diem tam" (chi Super Admin thay)
      post_url: x.post.url, kind: x.post.kind || 'post', parent_url: x.post.parent_url || '',
      author_url: x.post.user_url || '', parent_author: x.post.parent_author || '', parent_text: x.post.parent_text || '',
        comment_id: x.post.comment_id || '', comment_url: x.post.comment_url || '',
        phone: _zc.phone, phone_has_zalo: _zc.phone_has_zalo, email: _zc.email || '',
      detected_at: FieldValue.serverTimestamp()
    });
  });

  /* ---- Pha 4: LƯU lead (batch — vẫn kích hoạt onLeadCreated để cảnh báo) ---- */
  await prog('saving', true);
  // Khi QUÉT LẠI TỪ ĐẦU: tránh tạo lead TRÙNG theo post_url và KHÔNG ghi đè lead cũ (giữ nguyên giai đoạn pipeline đã chỉnh).
  // v16-patch: lead da duoc ghi TUC THI o Pha 3b (commitLeadNow) — khoi batch cu da go. Backup: index.js.bak-leadnow
  // Đánh dấu bài đã ra lead → 'qualified' để chế độ 'qualified_only' tiếp tục refresh comment các bài này (kể cả lead nằm trong comment của bài rác).
  if (qualifiedUrls.size) {
    let qb = db.batch(), qn = 0;
    for (const k of qualifiedUrls) { qb.set(cmtScrapeDoc(k), { qualified: true, qualifiedAt: FieldValue.serverTimestamp() }, { merge: true }); if (++qn % 400 === 0) { try { await qb.commit(); } catch (e) {} qb = db.batch(); } }
    if (qn % 400 !== 0) { try { await qb.commit(); } catch (e) {} }
  }
  await flushPosts(true); // ghi nốt nhật ký bài đã quét còn trong bộ đệm

  // v89 quet-vet zalo: check bu cac lead co SDT nhung chua co ket qua (timeout truoc do) — toi da 20 lead/luot
  try {
    const _zsnap = await db.collection('leads').where('phone_has_zalo', '==', null).limit(50).get();
    let _zn = 0;
    for (const _zdoc of _zsnap.docs) {
      if (_zn >= 20) break;
      const _zp = String((_zdoc.data() || {}).phone || '');
      if (!_zp) continue;
      const _zres = await checkZalo(_zp, { db, apiKey: process.env.EKYCPRO_API_KEY, cacheDays: 90 });
      if (typeof _zres.registered === 'boolean') { await _zdoc.ref.update({ phone_has_zalo: _zres.registered }); _zn++; }
    }
    if (_zn) console.log('[zaloCheck] v89: da check bu ' + _zn + ' lead thieu ket qua Zalo');
  } catch (e) { console.warn('[zaloCheck] v89 quet-vet loi: ' + (e && e.message)); }

  const durationMs = Date.now() - t0;
  const tokIn = mainIn + preIn, tokOut = mainOut + preOut, tokTotal = tokIn + tokOut;
  const llmCalls = scoreCalls + preCalls;
  const costUsd = (mainIn / 1e6) * CFG.LLM_PRICE_IN + (mainOut / 1e6) * CFG.LLM_PRICE_OUT
                + (preIn / 1e6) * CFG.LLM_PREFILTER_PRICE_IN + (preOut / 1e6) * CFG.LLM_PREFILTER_PRICE_OUT;
  const costR = Math.round(costUsd * 1e6) / 1e6;
  const summary = {
    at: FieldValue.serverTimestamp(), trigger, twoStage, aiMode,
    durationMs, sourcesCount: sources.length,
    postsFetched: scanned, commentsFetched: commentsScanned, scanComments, candidates: candTotal, postsMatched: matched, leadsCreated: kept, hotLeads: hot,
    skippedSeen, backfillSkipped, commentsRefreshSkipped, scoreErrors, scrapeErrors, llmCalls, prefilterCalls: preCalls, scoreCalls,
    probeRuns, sweepRuns, probeEscalated, probeIdle, bdRecords, bdCommentRecords: bdCmtRecords, authRuns, authCheckpoints,
    tokensIn: tokIn, tokensOut: tokOut, tokensTotal: tokTotal,
    tokensPrefilter: preIn + preOut, tokensScore: mainIn + mainOut,
    costUsd: costR,
    conversion: scanned ? Math.round((kept / scanned) * 1e4) / 1e4 : 0,
    dist, bySource
  };
  if (range) summary.range = range;
  let scanId = null;
  try { const ref = await db.collection('scans').add(summary); scanId = ref.id; }
  catch (e) { console.error('ghi log scan lỗi:', e.message); }
  /* ==== v-patch chi-phí 16/08/2026: ROLLUP THÁNG theo TỪNG NGUỒN — bd_month/{YYYY-MM} ====
     Cộng dồn số record BrightData TÍNH TIỀN (post + comment), lượt eKYC, chi phí AI ($) và lead
     bằng FieldValue.increment → đúng 1 lần ghi Firestore mỗi lượt quét, số CẢ THÁNG chính xác 100%.
     Nguồn private (nick/browser) tự nhiên có bdPosts=0 — không tính nhầm tiền BrightData.
     Fail-safe: lỗi ghi rollup KHÔNG ảnh hưởng lượt quét. */
  try {
    const ym = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7); // YYYY-MM theo giờ VN
    const inc = FieldValue.increment;
    const roll = {
      month: ym, updatedAt: FieldValue.serverTimestamp(), runs: inc(1),
      bdPostRecords: inc(bdRecords), bdCommentRecords: inc(bdCmtRecords),
      aiUsd: inc(costR), leads: inc(kept), hotLeads: inc(hot),
      ekycChecks: inc(bySource.reduce((a, r) => a + (r.ekyc || 0), 0))
    };
    const srcMap = {};
    for (const r of bySource) {
      if (!(r.bdPosts || r.bdComments || r.leads || r.ekyc || r.posts)) continue; // nguồn im lặng → khỏi ghi
      const k = 's_' + String(r.url || r.name || '?').replace(/[^\w-]/g, '_').slice(0, 140);
      srcMap[k] = {
        name: r.name || '', url: r.url || '', industry: r.industry || '',
        bdPosts: inc(r.bdPosts || 0), bdComments: inc(r.bdComments || 0),
        posts: inc(r.posts || 0), leads: inc(r.leads || 0), hot: inc(r.hot || 0), ekyc: inc(r.ekyc || 0)
      };
    }
    // QUAN TRỌNG: chỉ đính kèm src khi CÓ dữ liệu — gửi src:{} kèm merge:true sẽ XOÁ SẠCH map từng-nguồn!
    if (Object.keys(srcMap).length) roll.src = srcMap;
    await db.collection('bd_month').doc(ym).set(roll, { merge: true });
  } catch (e) { console.error('ghi rollup bd_month lỗi (không ảnh hưởng quét):', e.message); }
  if (job) { try { await job.set({
    status: 'done', phase: 'done', scanId, sourcesDone: srcDone, twoStage, aiMode,
    postsFetched: scanned, commentsFetched: commentsScanned, scanComments, candidatesTotal: candTotal, prefilterDone,
    postsMatched: matched, postsScored: scored, scannedLogged: postLogged,
    leadsCreated: kept, hotLeads: hot, skippedSeen, scrapeErrors, scoreErrors,
    costUsd: costR, durationMs,
    finishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }); } catch (e) {} }
  console.log(`scan xong: ${scanned} bài → ${candTotal} ứng viên → ${matched} qua tầng 1 → giữ ${kept} lead (${hot} nóng), ${preCalls}+${scoreCalls} lượt AI, ${tokTotal} token, ~$${costUsd.toFixed(4)}`);
  return { scanned, matched, kept, hot, durationMs, tokensTotal: tokTotal, costUsd, scanId, jobId: opts.jobId || null };
}
/* fixture: phần sau scanAll (helper khác) cắt bỏ — không cần cho mốc patch */
export const scheduledScan = function () {}; export const manualScan = function () {}; export { scanAll };
