/* FIXTURE LỆNH #48 (12/09/2026) — index.js dựng từ dump LỆNH #47 + #47d (mã ĐANG CHẠY sau #46; sha8 index.js=14a3a823):
   dòng 148–908 GIỮ NGUYÊN BYTE (verifyCaller … manualScan) làm mốc patch; preamble giả lập để import được ngoài Firebase
   (firebase-admin/functions, scraper/filter/zalo/multitouch → hook globalThis.__sl48 do harness gắn). Chuỗi ≥28 ký tự đã che khi dump ('<che>'). */
import { onSchedule, onRequest, onDocumentCreated, onDocumentUpdated, getAuth, FieldValue } from './stub48.mjs';
import { CFG } from './lib/config.js';
import { fetchPosts as __fp, fetchComments as __fc, harvestComments as __hc } from './lib/scraper.js';
import { scoreLead, prefilterLead } from './lib/scorer.js';
const H48 = () => (globalThis.__sl48 || {});
const db = new Proxy({}, { get: (_, k) => { const d = H48().db; if (!d) throw new Error('fixture: chưa gắn globalThis.__sl48.db'); const v = d[k]; return typeof v === 'function' ? v.bind(d) : v; } });
const SUPER_EMAIL = 'super@example.com';
const tempOf = h => h >= 80 ? 'hot' : h >= 60 ? 'warm' : h >= 40 ? 'cold' : 'junk';
const fetchPosts = (...a) => (H48().fetchPosts || __fp)(...a);
const fetchComments = (...a) => (H48().fetchComments || __fc)(...a);
const harvestComments = (...a) => (H48().harvestComments || __hc)(...a);
const fetchPostsAuth = async () => ({ posts: [], checkpoint: false });
const isExcluded = (text, src) => (H48().isExcluded ? H48().isExcluded(text, src) : false);
const keywordHit = () => true;
const enrichPhoneFromText = (...a) => (H48().enrichPhoneFromText ? H48().enrichPhoneFromText(...a) : Promise.resolve({ phone: '', phone_has_zalo: null, email: '' }));
const checkZalo = (...a) => (H48().checkZalo ? H48().checkZalo(...a) : Promise.resolve({ registered: null, cached: false, source: 'stub' }));
const tryMergeTouch = async (...a) => (H48().tryMergeTouch ? H48().tryMergeTouch(...a) : false);
const mtIdentityKey = (a, p, e) => String(a || p || e || '');
const mtTouch = (t) => Object.assign({}, t);
const dispatch = async () => {};
async function __brandAiOf(src) { return H48().brandAiOf ? H48().brandAiOf(src) : null; }
async function __bdProfTrigger() { return ''; }
async function __bdProfCollect() {}

async function verifyCaller(req) {
  const authz = req.get('Authorization') || '';
  const m = /^Bearer (.+)$/.exec(authz);
  if (!m) return null;
  let dec;
  try { dec = await getAuth().verifyIdToken(m[1]); } catch (e) { return null; }
  const email = String(dec.email || '').toLowerCase();
  if (email === SUPER_EMAIL) return { uid: dec.uid, email, role: 'superadmin' };
  try {
    const snap = await db.collection('users').doc(dec.uid).get();
    const d = snap.exists ? snap.data() : {};
    if (d.active !== true) return { uid: dec.uid, email, role: 'inactive' };
    return { uid: dec.uid, email, role: d.role || 'pending' };
  } catch (e) { return null; }
}

/* Nguồn quét: đọc từ Firestore collection "sources" (active != false) */
async function loadSources() {
  const snap = await db.collection('sources').get();
  const out = [];
  snap.forEach(d => { const s = d.data(); if (s.active !== false) out.push(s); });
  return out;
}

/* Đã xử lý post chưa? dùng collection "seen" với doc id = post_id */
async function seenRef(postId) { return db.collection('seen').doc(postId.replace(/[^\w-]/g, '_').slice(0, 480)); }

/* Cấu hình toàn cục từ Firestore (config/app): keyword, exclude, weights, channels */
async function loadConfig() {
  try { const d = await db.collection('config').doc('app').get(); return d.exists ? d.data() : {}; }
  catch (e) { console.warn('loadConfig', e.message); return {}; }
}

/* Tính khoảng ngày (MM-DD-YYYY) cho "quét quá khứ" từ preset hoặc ngày tuỳ chỉnh */
const pad2 = n => String(n).padStart(2, '0');
const fmtMDY = d => `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${d.getFullYear()}`;
function computeRange(range, customStart, customEnd) {
  const now = new Date();
  const DAYS = { '24h': 1, '3d': 3, '7d': 7, '30d': 30, '90d': 90 };
  if (range === 'custom') {
    const s = customStart ? new Date(customStart) : new Date(now.getTime() - 7 * 86400e3);
    const e = customEnd ? new Date(customEnd) : now;
    return { start: fmtMDY(s), end: fmtMDY(e) };
  }
  const n = DAYS[range] || 7;
  return { start: fmtMDY(new Date(now.getTime() - n * 86400e3)), end: fmtMDY(now) };
}

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
  /* v-sow 05/09/2026: quét theo LỊCH gieo snapshot BrightData rồi gặt ở lượt sau (không chờ 90 s/nguồn trong lượt → lượt ≈ 30 s thay vì 7–13').
     Nhịp gieo mỗi nguồn: config/app.scanIntervalMin (Super Admin) > .env SCAN_SOURCE_INTERVAL_MIN (mặc định 10'). Quét tay / backfill / force giữ cách cũ (chờ trong lượt). */
  const sowMode = trigger === 'scheduled' && !force && !(opts.startDate || opts.endDate) && CFG.BD_SOW_MODE !== false;
  const SRC_IV_MS = Math.max(3, Number(config.scanIntervalMin) || CFG.SCAN_SOURCE_INTERVAL_MIN || 10) * 60e3;
  // Quét comment: Super Admin bật/tắt qua config/app.scanComments (true/false) > biến môi trường SCAN_COMMENTS.
  const scanComments = (config.scanComments === true)
    || (config.scanComments !== false && CFG.SCAN_COMMENTS === true);
  let scanned = 0, commentsScanned = 0, candTotal = 0, prefilterDone = 0, matched = 0, scored = 0, kept = 0, hot = 0, srcDone = 0;
  let skippedSeen = 0, scoreErrors = 0, scrapeErrors = 0;
  let llmDeferred = 0, llmFallback = 0, rescored46 = 0; const __h0 = { ok: Number((scoreLead.health46 || {}).ok) || 0, fail: Number((scoreLead.health46 || {}).fail) || 0, pre: Number((scoreLead.health46 || {}).preFail) || 0, preOk: Number((scoreLead.health46 || {}).preOk) || 0 }; // LENH #46 · LENH #48 preOk
  /* ===== LENH #48 (12/09/2026) — AI hardening: lease ứng viên (score_retry kind 'lease') · trần mềm · bọc lỗi từng bài · circuit-breaker · badreq hệ thống · nạp score_retry bằng transaction ===== */
  const runId48 = trigger + '_' + t0.toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const SOFT48 = Math.max(120, Number(CFG.SCAN_SOFT_DEADLINE_S) || 1200) * 1000; const overSoft48 = () => (Date.now() - t0) > SOFT48;
  let pipeErrors48 = 0, softStop48 = 0, seenRace48 = 0, leased48 = 0, badreq48 = 0, reasonTok48 = 0, candLeased48 = 0; const cb48 = { open: false };
  const cbTick48 = () => { const H = scoreLead.health46 || {}; if (!cb48.open && ((Number(H.fail) || 0) - __h0.fail) >= 3 && ((Number(H.ok) || 0) - __h0.ok) === 0) { cb48.open = true; console.warn('[LLM-CB] 3 bài chấm hỏng liên tiếp, 0 OK → các bài còn lại chỉ thử 1 lần (vào score_retry sớm, lượt quét không kéo dài)'); } };
  const slimPost48 = p => { const o = {}; for (const k of Object.keys(p || {})) { const v = p[k]; if (k.charAt(0) === '_') continue; if (typeof v === 'string') o[k] = v.slice(0, k === 'text' ? 4000 : 1500); else if (typeof v === 'number' || typeof v === 'boolean') o[k] = v; } return o; };
  const retryRef48 = p => { const key = String((p && p.post_id) || '').replace(/[^\w-]/g, '_').slice(0, 470); return key ? db.collection('score_retry').doc('R_' + key) : null; };
  const unlease48 = async x => { if (x && x.leaseRef) { const r = x.leaseRef; x.leaseRef = null; await r.delete().catch(() => {}); } };
  const settle48 = async x => { if (x && x.deferredRef) { const r = x.deferredRef; x.deferredRef = null; await r.delete().catch(() => {}); } await unlease48(x); }; // LENH #48: gỡ lease + doc chờ CHỈ khi bài đã đi hết đường (ghi lead xong / không phải lead) — lỗi eKYC/commit giữa chừng → giữ để lượt sau chấm lại
  const lease48 = async ref => { try { return await db.runTransaction(async tx => { const s = await tx.get(ref); if (!s.exists) return false; const d = s.data() || {}; if ((Number(d.nextAt) || 0) > Date.now()) return false; tx.update(ref, { nextAt: Date.now() + 15 * 60e3, leaseBy: runId48, leaseAt: Date.now() }); return true; }); } catch (e) { return false; } };
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

  try { await db.collection('system_status').doc('scan').set({ phase: 'starting', at: Date.now(), runId: runId48, trigger, lastStartAt: Date.now() }, { merge: true }); } catch (_) {} // LENH #48 (PB-1e)
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
      let sowDue = true; // v-sow: gieo khi tới nhịp nguồn (lastTriggerAt trong group_state)
      if (sowMode) { const gs = gsBy.get(src.url); sowDue = (nowMs0 - (Number(gs && gs.lastTriggerAt) || 0)) >= SRC_IV_MS; }
      const posts = await fetchPosts(src, { startDate: opts.startDate, endDate: opts.endDate, numPosts: liveProbe ? liveNum : opts.numPosts, notInclude: (function(){ const g = gsBy.get(src.url); return (liveProbe && g && Array.isArray(g.recentIds)) ? g.recentIds : undefined; })(), sow: sowMode, sowDue, sweep: didSweep });
      row.bd = posts.bd || 'ok'; // 'ok' = đã gọi BrightData thành công (bdwatch), 'skip' = chưa tới nhịp
      if (posts.sweep) didSweep = true; // gặt snapshot đã gieo ở nhịp sweep → không cắt theo bài đã thấy
      bdRecords += posts.length; row.bdPosts += posts.length;
      let usePosts = posts;
      if (liveProbe && !didSweep && posts.length) {
        // Đếm số bài MỚI ở đầu danh sách (chưa thấy). Gặp bài đã-seen đầu tiên là dừng (phía dưới đều cũ hơn).
        let snaps = []; try { snaps = await db.getAll(...posts.map(p => seenDoc(p.post_id))); } catch (e) { snaps = []; }
        let leadingNew = 0; for (let j = 0; j < posts.length; j++) { if (snaps[j] && snaps[j].exists) break; leadingNew++; }
        if (leadingNew === 0) { usePosts = []; probeIdle++; }
        else if (leadingNew >= posts.length && posts.length >= (liveNum || 0)) { // probe đầy bài mới → có thể còn nữa → lấy đủ
          probeEscalated++;
          try { const full = await fetchPosts(src, { numPosts: CFG.POSTS_PER_GROUP, notInclude: (function(){ const g = gsBy.get(src.url); return (g && Array.isArray(g.recentIds)) ? g.recentIds : undefined; })(), sow: sowMode, sowDue: true }); bdRecords += full.length; row.bdPosts += full.length; usePosts = full.length ? full : posts; } catch (e) { usePosts = posts; }
        } else { usePosts = posts.slice(0, leadingNew); }
      }
      row.posts = usePosts.length; scanned += usePosts.length;
      for (const post of usePosts) collected.push({ post, effSrc, src, row });
      if (didSweep) { try { await groupStateDoc(src.url).set({ url: src.url || '', lastSweepAt: FieldValue.serverTimestamp() }, { merge: true }); } catch (e) {} }
      if (isBackfill) { try { await db.collection('backfill_done').doc(bfKey(src.url)).set({ url: src.url || '', startDate: opts.startDate || '', endDate: opts.endDate || '', at: FieldValue.serverTimestamp(), posts: usePosts.length }, { merge: true }); } catch (e) {} }
    } catch (e) { console.error('scrape', src.name, e.message); scrapeErrors++; row.error = e.message.slice(0, 140); }
    srcDone++; await prog('scraping');
  });

  /* ---- v-sow bdwatch 05/09/2026: BrightData ngưng (vd 'trigger 400: Customer is not active') → log JSON severity ERROR
     (alert policy 'lỗi Cloud Functions/Run' → email Super Admin) + system_status/brightdata {ok,since,sample}. Hết ngưng → WARNING [BRIGHTDATA-UP]. ---- */
  try {
    const isBdErr = r => !!(r.error && /trigger \d{3}|snapshot|not active|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND/i.test(r.error));
    const bdErrs = bySource.filter(isBdErr), bdOks = bySource.filter(r => r.bd === 'ok');
    const nBd = bySource.filter(r => r.bd || isBdErr(r)).length;
    const stRef = db.collection('system_status').doc('brightdata');
    if (nBd >= 1 && bdErrs.length >= Math.min(3, nBd) && bdOks.length === 0) {
      const sample = String(bdErrs[0].error || '').slice(0, 160);
      const prev = await stRef.get().catch(() => null); const pd = prev && prev.exists ? prev.data() : null;
      const since = (pd && pd.ok === false && pd.since) ? pd.since : Date.now();
      await stRef.set({ ok: false, since, at: Date.now(), runs: FieldValue.increment(1), errors: bdErrs.length, sources: nBd, sample }, { merge: true });
      console.log(JSON.stringify({ severity: 'ERROR', message: `[BRIGHTDATA-DOWN] ${bdErrs.length}/${nBd} nguồn lỗi BrightData, 0 nguồn OK (từ ${new Date(since + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ')} VN): ${sample}` }));
    } else if (bdOks.length) {
      const prev = await stRef.get().catch(() => null); const pd = prev && prev.exists ? prev.data() : null;
      if (!pd || pd.ok !== true) { await stRef.set({ ok: true, at: Date.now(), recoveredAt: Date.now(), runs: 0 }, { merge: true }); if (pd && pd.ok === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[BRIGHTDATA-UP] BrightData hoạt động lại' })); }
    }
  } catch (e) { console.warn('[bdwatch]', e && e.message); }

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
      cand.push({ k, url: u, src: x.src });
    }
    /* v-sowc 05/09/2026: quét theo LỊCH không còn chờ snapshot comment trong lượt (bdWait tới 510 s):
       (1) GẶT các snapshot comment đã gieo ở lượt trước → thêm bài cha vào ctx (nguồn tra theo url trong lượt này) rồi đi chung vòng xử lý bên dưới;
       (2) fetchComments({sow:true}) chỉ GIEO snapshot (pending_snapshots kind='comments' kèm bài cha) rồi trả về ngay. Quét tay/backfill/force giữ cách cũ. */
    let hvCmts = []; const hvBilled = new Map();
    const sowMetaOf = (u) => { const c = ctx.get(urlKey(u)); return c ? { url: u, srcUrl: String((c.src && c.src.url) || ''), parentUrl: c.parentUrl || u, parentAuthor: String(c.parentAuthor || '').slice(0, 200), parentText: String(c.parentText || '').slice(0, 1500), parentUserUrl: String(c.parentUserUrl || '').slice(0, 300) } : null; };
    if (sowMode) {
      try {
        // harvestComments: import tĩnh ở đầu file
        const srcCtx = new Map();
        for (const s of sources) { const u = String(s.url || ''); const r = bySource.find(rr => rr.url === u); if (u && r && !srcCtx.has(u)) srcCtx.set(u, { src: s, effSrc: { ...s, keywords: [...(s.keywords || []), ...gKw], exclude: [...(s.exclude || []), ...gEx] }, row: r }); }
        const hv = await harvestComments({ billed: hvBilled, srcOf: (u) => { const c = srcCtx.get(String(u || '')); return c ? c.src : null; } });
        let orphan = 0;
        for (const m of hv.metas) { const cc = m && srcCtx.get(String(m.srcUrl || '')); const k = urlKey((m && (m.parentUrl || m.url)) || ''); if (!cc || !k) { orphan++; continue; } if (!ctx.has(k)) ctx.set(k, { effSrc: cc.effSrc, src: cc.src, row: cc.row, parentAuthor: m.parentAuthor || '', parentText: m.parentText || '', parentUrl: m.parentUrl || m.url || '', parentUserUrl: m.parentUserUrl || '' }); }
        hvCmts = hv.items;
        if (hv.harvested || hv.pending || hv.failed) console.log(`[sowc] gặt ${hv.harvested} snapshot comment → ${hv.items.length} comment (${orphan} bài cha không còn nguồn) · còn chờ ${hv.pending} · hỏng/quá hạn ${hv.failed}`);
      } catch (e) { console.error('harvestComments lỗi:', e.message); }
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
      for (const [k, v] of hvBilled) cmtBilled.set(k, (cmtBilled.get(k) || 0) + v); // v-sowc: record comment BrightData của snapshot vừa gặt
      const cmts = await fetchComments(items, { perPost: CFG.COMMENTS_PER_POST, billed: cmtBilled, sow: sowMode, metaOf: sowMetaOf }); // v-sowc: sow=true → chỉ gieo
      for (const [pu, n] of cmtBilled) {
        bdCmtRecords += n;
        const c = ctx.get(urlKey(pu));
        if (c) c.row.bdComments += n;
        else { // record không khớp bài cha (BD trả post_url lạ) → gán nguồn ĐẦU của lô để không mất tiền nào khỏi sổ
          const first = bySource.find(r => !r.error) || bySource[0];
          if (first) first.bdComments += n;
        }
      }
      for (const { comment, parentUrl } of [...hvCmts, ...cmts]) { // v-sowc: comment đã gặt + comment quét ngay (quét tay/backfill)
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
    const wb = db.batch(); let writes = 0; const fresh48 = []; // LENH #48 (PB-2d): seen ghi bằng create() — 2 lượt chồng (Quét ngay ↔ lịch) không cùng nhận 1 bài
    slice.forEach((x, j) => {
      const wasSeen = snaps[j] && snaps[j].exists;
      if (wasSeen && !force) { skippedSeen++; return; }            // chống trùng (tắt khi quét lại từ đầu)
      if (!wasSeen) { wb.create(seenDoc(x.post.post_id), { at: FieldValue.serverTimestamp(), run: runId48 }); writes++; fresh48.push(x); }
      if (x.post.self_comment) { selfSkipped++; recordPost(x, { decision: 'self_comment' }); return; } /* v-selfcmt: chủ bài tự bình luận → không phải lead, không gọi AI */
      const pass = !isExcluded(x.post.text, x.effSrc); // luôn để AI đọc hiểu ngữ cảnh (chỉ bỏ bài rác theo exclude)
      if (pass) candidates.push(x);
      else recordPost(x, { decision: twoStage ? 'excluded' : 'no_keyword' });
    });
    if (writes) { try { await wb.commit(); } catch (e) {
      /* LENH #48 (PB-2d): ALREADY_EXISTS = lượt khác vừa ghi seen cho ≥1 bài trong lô → đọc lại, bỏ bài đã có chủ, ghi lại phần còn lại (create theo lô là nguyên tử) */
      const race = !!(e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message || e))));
      if (!race) console.warn('[seen] commit lỗi:', e && e.message);
      else { let s2 = []; try { s2 = await db.getAll(...fresh48.map(x => seenDoc(x.post.post_id))); } catch (_) { s2 = []; }
        const wb2 = db.batch(); let w2 = 0;
        fresh48.forEach((x, k) => { if (s2[k] && s2[k].exists) { if (!force) { seenRace48++; skippedSeen++; const ci = candidates.indexOf(x); if (ci >= 0) candidates.splice(ci, 1); } } else { wb2.create(seenDoc(x.post.post_id), { at: FieldValue.serverTimestamp(), run: runId48 }); w2++; } });
        if (w2) { try { await wb2.commit(); } catch (e2) { console.warn('[seen] commit lần 2 lỗi:', e2 && e2.message); } } } } }
    /* LENH #48 (PB-1a): LEASE ứng viên — mỗi bài qua exclude ghi score_retry/R_<post_id> {kind:'lease', nextAt +30′}; xoá ở MỌI nhánh quyết định; lượt bị cắt/crash → lượt theo lịch 30′ sau tự chấm lại đúng bài (không mất bài, không phải nhờ BrightData lấy lại) */
    { const lw = db.batch(); let ln = 0;
      for (const x of candidates.slice(candLeased48)) { const ref = retryRef48(x.post); if (!ref) continue; x.leaseRef = ref; lw.set(ref, { post: slimPost48(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || '') }, tries: 0, firstAt: Date.now(), leaseAt: Date.now(), leaseBy: runId48, nextAt: Date.now() + 30 * 60e3, kind: 'lease', updatedAt: FieldValue.serverTimestamp() }); ln++; }
      candLeased48 = candidates.length;
      if (ln) { try { await lw.commit(); leased48 += ln; } catch (e) { console.warn('[lease] ghi lease lỗi (bỏ qua, lượt này vẫn chấm):', e && e.message); } } }
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
      if (overSoft48()) { softStop48++; return; } // LENH #48 (PB-1c): quá trần mềm → giữ lease, lượt theo lịch sau chấm
      let pf; try { pf = await prefilterLead(x.post, await __brandAiOf(x.effSrc || x.src || x.source), { tries: cb48.open ? 1 : 2 }); } catch (e48) { pipeErrors48++; pf = { maybe: true, _usage: {}, _llm: false, _err: 'pipe' }; } /* v-brandai · LENH #48: tries theo circuit-breaker, lỗi ngoài LLM → fail-open */
      const u = pf._usage || {}; if (pf._llm) preCalls++;
      preIn += u.prompt || 0; preOut += u.completion || 0;
      prefilterDone++;
      if (pf.maybe) { matched++; x.row.matched++; toScore.push(x); }
      else { recordPost(x, { decision: 'prefiltered_out' }); await unlease48(x); } // LENH #48: đã quyết định → gỡ lease
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
  /* ===== LENH #46 (11/09/2026): LLM hỏng → KHÔNG tạo lead bằng heuristic. Bài vào score_retry/{R_<post_id>} rồi lượt quét theo lịch chấm lại
     (3′ → 10′ → 30′ → 1 h → 3 h → 6 h, tối đa 6 lần/24 h); quá hạn → lead dự phòng KẸP ≤ 59 (lạnh) + ai_scored:false (sweeper cuối lượt chấm lại khi AI khoẻ). ===== */
  const sow46 = trigger === 'scheduled' && !isBackfill && !opts.sourceUrl && !force; // LENH #48 (PB-2a): chỉ lượt theo LỊCH nạp score_retry + chấm lại điểm tạm (Quét ngay không chồng việc)
  const RETRY_WAIT46 = [3, 10, 30, 60, 180, 360]; // phút
  const slimPost46 = p => { const o = {}; for (const k of Object.keys(p || {})) { const v = p[k]; if (k.charAt(0) === '_') continue; if (typeof v === 'string') o[k] = v.slice(0, k === 'text' ? 4000 : 1500); else if (typeof v === 'number' || typeof v === 'boolean') o[k] = v; } return o; };
  async function deferPost46(x, e) {
    const kind = (e && e.kind) || 'unknown', msg = String((e && e.message) || e).slice(0, 200);
    const key = String((x.post && x.post.post_id) || '').replace(/[^\w-]/g, '_').slice(0, 470);
    const badreqSys = badreq48 >= 2 && ((Number((scoreLead.health46 || {}).ok) || 0) - __h0.ok) === 0; // LENH #48 (PB-4c): ≥2 bài 400 & 0 OK = lỗi hệ thống (tham số/model) → xếp hàng, KHÔNG đẻ lead heuristic mỗi lượt
    if (!key || (kind === 'badreq' && !badreqSys)) return 'fallback'; // không định danh được / request hỏng cho riêng bài này → dự phòng ngay · LENH #48: doc chờ/lease gỡ ở CUỐI (settle48) sau khi ghi lead
    const prev = x.deferredDoc || null; const tries = (prev ? Number(prev.tries) || 0 : 0) + 1; const firstAt = (prev && Number(prev.firstAt)) || Date.now();
    if (tries > RETRY_WAIT46.length || Date.now() - firstAt > 24 * 3600e3) return 'fallback'; // LENH #48: quá hạn → dự phòng; doc chờ gỡ ở cuối (settle48) sau khi ghi lead
    const ref = db.collection('score_retry').doc('R_' + key);
    try {
      await ref.set({ post: slimPost46(x.post), src: { name: (x.src && x.src.name) || '', url: (x.src && x.src.url) || '', industry: (x.src && x.src.industry) || '', brand: String((x.src && x.src.brand) || '') }, tries, firstAt, nextAt: Date.now() + RETRY_WAIT46[tries - 1] * 60000, lastErr: msg, kind, updatedAt: FieldValue.serverTimestamp() });
      x.deferredRef = null; x.leaseRef = null; return 'deferred'; // LENH #48: doc lease đã thành doc chờ (cùng id) → không gỡ
    } catch (e2) { console.error('[LLM-RETRY] ghi score_retry lỗi:', e2 && e2.message); return 'error'; }
  }
  if (sow46) {
    try {
      const rq = await db.collection('score_retry').where('nextAt', '<=', Date.now()).orderBy('nextAt').limit(30).get();
      let n46 = 0;
      for (const d of rq.docs) {
        const r = d.data() || {}; const src = sources.find(s => s.url === (r.src && r.src.url)) || null;
        if (!r.post || !r.post.post_id) { await d.ref.delete().catch(() => {}); continue; } // không định danh được → bỏ
        if (!src) { /* LENH #48 (PB-1b): nguồn tạm tắt/đổi URL → GIỮ, hoãn 6 h; quá 7 ngày mới bỏ */
          if (Date.now() - (Number(r.firstAt) || Number(r.leaseAt) || 0) > 7 * 86400e3) await d.ref.delete().catch(() => {});
          else await d.ref.set({ nextAt: Date.now() + 6 * 3600e3, lastErr: 'nguồn không còn bật', updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
          continue; }
        if (!(await lease48(d.ref))) continue; // LENH #48 (PB-2b): lượt khác vừa nhận bài này (transaction, lease 15′)
        const effSrc = { ...src, keywords: [...(src.keywords || []), ...gKw], exclude: [...(src.exclude || []), ...gEx] };
        let row = bySource.find(b => b.url === src.url); if (!row) { row = { name: src.name || '', industry: src.industry || '', url: src.url || '', posts: 0, matched: 0, leads: 0, hot: 0, error: null, bdPosts: 0, bdComments: 0, ekyc: 0 }; bySource.push(row); }
        toScore.push({ post: r.post, effSrc, src, row, deferredRef: d.ref, deferredDoc: r }); n46++;
      }
      if (n46) console.log('[LLM-RETRY] nạp ' + n46 + ' bài chờ AI chấm lại (score_retry tới hạn)');
    } catch (e) { console.warn('[LLM-RETRY] nạp score_retry lỗi:', e && e.message); }
  }
  await mapPool(toScore, CFG.SCORE_CONCURRENCY || 6, async (x) => { try { // LENH #48 (PB-1d): bọc trọn 1 bài — lỗi eKYC/commit/… không làm rớt cả lượt, lease giữ để lượt sau chấm lại
    if (overSoft48()) { softStop48++; return; } // LENH #48 (PB-1c): quá trần mềm → giữ lease (score_retry), lượt theo lịch sau chấm
    let ai; try { ai = await scoreLead(x.post, x.effSrc, config.weights, await __brandAiOf(x.effSrc), { tries: cb48.open ? 1 : 0 }); }
    catch (e46) { // LENH #46: hỏng → xếp hàng chấm lại (không lead) · quá hạn/request hỏng → dự phòng kẹp ≤ 59 · ghi score_retry lỗi → 'error' như cũ
      if ((e46 && e46.kind) === 'badreq') badreq48++; cbTick48(); // LENH #48
      const r46 = await deferPost46(x, e46);
      if (r46 === 'fallback') { ai = scoreLead.heuristic46(x.post, x.effSrc, await __brandAiOf(x.effSrc)); llmFallback++; } // LENH #48 (PB-5b): dự phòng biết lĩnh vực brand
      else { scored++; if (r46 === 'error') scoreErrors++; else llmDeferred++; recordPost(x, { decision: r46 === 'error' ? 'error' : 'ai_wait' }); await flushPosts(); await prog('scoring'); return; }
    }
    const u = ai._usage || {}; if (ai._llm) scoreCalls++;
    if (x.deferredRef) rescored46++; // LENH #46: bài chờ đã được AI chấm · LENH #48: doc chờ + lease gỡ ở CUỐI (settle48) sau khi ghi lead xong — lỗi eKYC/commit giữa chừng không làm mất bài
    mainIn += u.prompt || 0; mainOut += u.completion || 0; reasonTok48 += u.reasoning || 0; // LENH #48
    const t = tempOf(ai.hotness || 0); if (dist[t] !== undefined) dist[t]++;
    scored++; await prog('scoring');
    const __role = String(ai.role || '').toLowerCase().trim(), __roleBlock = (__role === 'seller' || __role === 'poster_self'); /* v-selfcmt: người bán/đối thủ hoặc chính chủ bài → không phải lead */
    const isLead = !!ai.is_real_lead && !__roleBlock && (ai.hotness || 0) >= CFG.MIN_KEEP_SCORE;
    recordPost(x, { decision: isLead ? 'lead' : (__roleBlock ? (__role === 'seller' ? 'seller' : 'self_comment') : 'scored_low'), score: ai.hotness || 0, temp: t,
      intent: ai.intent || '', service: ai.service || '', kept: isLead, role: __role });
    await flushPosts();
    if (!isLead) { await settle48(x); return; } // LENH #48: không phải lead → gỡ lease/doc chờ
    { const pURL = (x.post.kind === 'comment') ? (x.post.parent_url || x.post.url) : x.post.url; if (pURL) qualifiedUrls.add(urlKey(pURL)); }
    // v-patch miss-reply 18/08: model quen/cat truong reply -> goi cham lai toi da 2 lan, khong de lead trong goi y
    if (ai._llm !== false && !cb48.open && !(ai.reply && String(ai.reply).trim())) { // LENH #46: đang dùng dự phòng thì không gọi lại · LENH #48 (PB-3e): xin reply bằng prompt NGẮN 1 lượt thay vì chấm lại toàn bài 2 lần
      try {
        const __r2 = await scoreLead.replyOnly48(x.post, x.effSrc, await __brandAiOf(x.effSrc), ai);
        const __u2 = __r2._usage || {}; if (__r2._llm) scoreCalls++; mainIn += __u2.prompt || 0; mainOut += __u2.completion || 0; reasonTok48 += __u2.reasoning || 0;
        if (__r2.reply && String(__r2.reply).trim()) ai.reply = __r2.reply;
      } catch (e) {}
      if (!(ai.reply && String(ai.reply).trim())) console.error('[miss-reply] van rong sau 2 luot:', x.post.url || x.post.author || '');
    }
    const zaloDefer48 = (t === 'cold' && CFG.ZALO_CHECK_COLD !== true); // LENH #48 (PB-3g): lead LẠNH không kiểm eKYC lúc quét (kiểm khi sales bắt đầu chăm)
    const _zc = await enrichPhoneFromText((x.post.text || ''), { db, apiKey: process.env.EKYCPRO_API_KEY, doCheck: process.env.ZALO_CHECK_ENABLED !== 'false' && !zaloDefer48, cacheDays: 90 });
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
      author_uid: String(x.post.author_uid || '').slice(0, 40), zalo_defer: !!(zaloDefer48 && _zc.phone), /* LENH #48 */
        comment_id: x.post.comment_id || '', comment_url: x.post.comment_url || '',
        phone: _zc.phone, phone_has_zalo: _zc.phone_has_zalo, email: _zc.email || '',
      detected_at: FieldValue.serverTimestamp()
    });
    await settle48(x); // LENH #48: ghi lead xong mới gỡ lease/doc chờ
  } catch (e48) { pipeErrors48++; scoreErrors++; console.error('[pipe] bài lỗi ngoài LLM (giữ lease để lượt sau chấm lại):', (x.post && (x.post.url || x.post.post_id)) || '', (e48 && e48.message) || e48); try { recordPost(x, { decision: 'error' }); } catch (_) {} } }); // LENH #48 (PB-1d)

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
      { const _zd = _zdoc.data() || {}; if (_zd.zalo_defer && !_zd.first_care_at && !_zd.assignee && !_zd.last_touch_at) continue; } // LENH #48 (PB-3g): lead lạnh chưa ai chăm → chưa kiểm
      const _zres = await checkZalo(_zp, { db, apiKey: process.env.EKYCPRO_API_KEY, cacheDays: 90 });
      if (typeof _zres.registered === 'boolean') { await _zdoc.ref.update({ phone_has_zalo: _zres.registered }); _zn++; }
    }
    if (_zn) console.log('[zaloCheck] v89: da check bu ' + _zn + ' lead thieu ket qua Zalo');
  } catch (e) { console.warn('[zaloCheck] v89 quet-vet loi: ' + (e && e.message)); }

  /* ===== LENH #46: CHẤM LẠI lead "Điểm tạm" (ai_scored:false) bằng AI khi LLM đang khoẻ — ≤ 12 lead/lượt (pool 3), mới nhất trước, ≤ 30 ngày, ≤ 8 lần thử/lead.
     Ghi đè score/temp/intent/need/service/reply/role + ai_scored:true + rescored_at + ai_prev; AI nói KHÔNG phải lead → dropped (rescore / rescore_role); sales đang chăm → chỉ cập nhật điểm, không loại.
     Chỉ lượt quét theo lịch (không backfill/không quét riêng nguồn/không force). Tắt: RESCORE_FALLBACK=false (.env). ===== */
  let rescoredLeads46 = 0, rescoreDropped46 = 0;
  const __ms46 = v => !v ? 0 : (typeof v === 'number' ? v : (typeof v.toMillis === 'function' ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
  if (sow46 && CFG.LLM_API_KEY && !cb48.open && !overSoft48() && CFG.RESCORE_FALLBACK !== false && process.env.RESCORE_FALLBACK !== 'false') { // LENH #48 (PB-5): không key / breaker mở / quá trần mềm → không chấm lại
    const __hn = scoreLead.health46 || {}; const okNow = (Number(__hn.ok) || 0) - __h0.ok, failNow = (Number(__hn.fail) || 0) - __h0.fail;
    if (okNow > 0 || failNow === 0) {
      try {
        const rs = await db.collection('leads').where('ai_scored', '==', false).limit(80).get();
        const cut46 = Date.now() - 30 * 86400e3;
        const cand46 = rs.docs.map(d => ({ id: d.id, ref: d.ref, l: d.data() || {} }))
          .filter(c => !c.l.dropped && !c.l.lost && !c.l.closed_at && (Number(c.l.rescore_tries) || 0) < 8 && (__ms46(c.l.detected_at) || 0) >= cut46
            && (Number(c.l.rescore_lease) || 0) < Date.now() && !(/badreq|LLM 4(00|22)/.test(String(c.l.rescore_err || '')) && Date.now() - (Number(c.l.rescore_at) || 0) < 86400e3)) // LENH #48 (PB-5d/PB-4c): bỏ lead đang được lượt khác chấm + lead 400 <24 h
          .sort((a, b) => (__ms46(b.l.detected_at) || 0) - (__ms46(a.l.detected_at) || 0)).slice(0, Math.max(1, Number(process.env.RESCORE_PER_RUN) || 12));
        const brandAiCache46 = {}; let stop46 = false;
        const brandAiOf46 = async code => { if (!code) return null; if (!(code in brandAiCache46)) { try { const s = await db.collection('brands').doc(String(code)).get(); brandAiCache46[code] = (s.exists && s.data().ai) || null; } catch (_) { brandAiCache46[code] = null; } } return brandAiCache46[code]; };
        await mapPool(cand46, 3, async (c) => {
          if (stop46 || overSoft48()) return; try { await c.ref.set({ rescore_lease: Date.now() + 10 * 60e3 }, { merge: true }); } catch (_) {} // LENH #48 (PB-5d): lease 10′ chống 2 lượt chồng chấm đôi
          const l = c.l; const src46 = sources.find(s => s.name === l.source) || { name: l.source || '', industry: l.industry || '' };
          const post46 = { post_id: l.post_id || c.id, url: l.post_url || l.url || '', text: ((Number(l.group_count) || 0) >= 2 && Array.isArray(l.touches) && l.touches.length > 1) ? (l.touches.map(tt => String((tt && tt.text) || '')).filter(Boolean).join('\n---\n').slice(0, 1500) || (l.text || '')) : (l.text || ''), /* LENH #48 (PB-5c): lead gộp nhiều nhóm → chấm trên mọi lần chạm */ author: l.name || '', time: l.time || '', source: l.source || '', kind: l.kind || 'post', comment_id: l.comment_id || '', comment_url: l.comment_url || '', parent_url: l.parent_url || '', parent_author: l.parent_author || '', parent_text: l.parent_text || '', parent_user_url: l.parent_user_url || '', user_url: l.author_url || l.user_url || '', self_comment: !!l.self_comment };
          let ai;
          try { ai = await scoreLead(post46, src46, config.weights, await brandAiOf46(l.brand), { tries: 2 }); }
          catch (e) { const k = (e && e.kind) || ''; await c.ref.set({ rescore_tries: FieldValue.increment(1), rescore_err: String((e && e.message) || e).slice(0, 160), rescore_at: Date.now(), rescore_lease: FieldValue.delete() }, { merge: true }).catch(() => {}); if (/^(auth|quota|model|server|net|rate)$/.test(k)) stop46 = true; return; }
          const u = ai._usage || {}; if (ai._llm) scoreCalls++; mainIn += u.prompt || 0; mainOut += u.completion || 0;
          const h = Math.max(0, Math.min(100, Number(ai.hotness) || 0)), t = tempOf(h);
          const role = String(ai.role || '').toLowerCase().trim(), roleBlock = (role === 'seller' || role === 'poster_self');
          const isLead = !!ai.is_real_lead && !roleBlock && h >= CFG.MIN_KEEP_SCORE;
          const human = !!(__ms46(l.first_care_at) || __ms46(l.last_touch_at) || (l.stage && l.stage !== 'new') || l.assignee);
          const up = { score: h, temp: t, intent: ai.intent || '', need: ai.need || ai.intent || '', service: ai.service || '', role, role_reason: String(ai.role_reason || '').slice(0, 160), ai_scored: true, base_score: h, rescore_lease: FieldValue.delete(), rescored_at: Date.now(), ai_prev: { score: Number(l.score) || 0, temp: l.temp || '', intent: String(l.intent || '').slice(0, 120) }, rescore_err: FieldValue.delete() };
          if (ai.industry) up.industry = ai.industry; if (ai.reply && String(ai.reply).trim()) up.reply = ai.reply; if (isLead) up.ai_flag = FieldValue.delete(); // LENH #48
          if (!isLead) {
            if (human) { up.rescore_note = 'AI chấm lại: không phải lead (' + (roleBlock ? 'vai ' + role : 'điểm ' + h) + ') – giữ vì sales đang chăm'; up.ai_flag = roleBlock ? ('role_' + role) : 'not_lead'; if (h < 40) up.temp = 'cold'; } // LENH #48 (PB-5c): không hạ junk lead đang chăm (web sẽ ẩn) — giữ ≥ lạnh + cờ ai_flag
            else { up.dropped = true; up.dropped_by = roleBlock ? 'rescore_role' : 'rescore'; up.dropped_at = Date.now(); up.dropped_reason = roleBlock ? ('AI chấm lại: ' + (role === 'seller' ? 'người bán/đối thủ' : 'chính chủ bài')) : ('AI chấm lại: không phải khách có nhu cầu (điểm ' + h + ')'); rescoreDropped46++; }
          }
          await c.ref.set(up, { merge: true }); rescoredLeads46++;
          try { await db.collection('leads').doc(c.id).collection('notes').add({ leadId: c.id, brand: l.brand || '', vis: 'team', text: 'AI đã chấm lại lead này: ' + (Number(l.score) || 0) + ' → ' + h + ' điểm (' + t + ')' + (up.dropped ? ' · ' + up.dropped_reason : (up.rescore_note ? ' · ' + up.rescore_note : '')) + '. Trước đó là điểm tạm vì AI gián đoạn lúc quét.', by_uid: 'engine', by_name: 'Chấm điểm AI (tự động)', at: Date.now() }); } catch (_) { }
        });
        if (cand46.length) console.log('[LLM-RESCORE] chấm lại ' + rescoredLeads46 + '/' + cand46.length + ' lead điểm tạm' + (rescoreDropped46 ? ' · loại ' + rescoreDropped46 : '') + (stop46 ? ' · DỪNG sớm vì LLM lỗi' : ''));
      } catch (e) { console.warn('[LLM-RESCORE] lỗi:', e && e.message); }
    }
  }
  const durationMs = Date.now() - t0;
  const tokIn = mainIn + preIn, tokOut = mainOut + preOut, tokTotal = tokIn + tokOut;
  /* ===== LENH #46: GIÁM SÁT LLM — lượt này ≥ 2 lượt chấm hỏng & 0 thành công (hoặc lỗi auth/quota/model) → console ERROR [LLM-DOWN] (alert LỆNH #9) + system_status/llm {ok:false,…};
     có lượt OK sau khi đang down → [LLM-UP] + ok:true. FE (v119-89) đọc system_status/llm → Cảnh báo hệ thống + thẻ + chip thanh nhịp quét. ===== */
  const __hE = scoreLead.health46 || {};
  const llmOk46 = Math.max(0, (Number(__hE.ok) || 0) - __h0.ok), llmFail46 = Math.max(0, (Number(__hE.fail) || 0) - __h0.fail), llmPreFail46 = Math.max(0, (Number(__hE.preFail) || 0) - __h0.pre); const llmPreOk46 = Math.max(0, (Number(__hE.preOk) || 0) - __h0.preOk); // LENH #48
  const llmErr46 = llmFail46 ? String(__hE.lastKind || '') : '', llmErrMsg46 = llmFail46 ? String(__hE.last || '').slice(0, 200) : '';
  try {
    const stRef46 = db.collection('system_status').doc('llm'); const stS46 = await stRef46.get().catch(() => null); const prev46 = (stS46 && stS46.exists) ? (stS46.data() || {}) : {};
    /* LENH #48 (PB-4): cửa sổ trượt ≤5 lượt / 15′ (kích cả khi mỗi lượt chỉ 1 bài) + hysteresis (đang DOWN cần ≥2 OK) + tầng 1 [LLM-PRE-DOWN] (WARNING, vẫn fail-open) + badreq hệ thống + thiếu key */
    const now48 = Date.now();
    const win48 = (Array.isArray(prev46.win) ? prev46.win : []).filter(w => w && (now48 - (Number(w.at) || 0)) < 15 * 60e3).slice(-4);
    const touched48 = !!(llmOk46 || llmFail46 || llmPreOk46 || llmPreFail46);
    if (touched48) win48.push({ at: now48, ok: llmOk46, fail: llmFail46, preOk: llmPreOk46, preFail: llmPreFail46, kind: llmErr46 || '' });
    const sumW = k => win48.reduce((a, w) => a + (Number(w[k]) || 0), 0);
    const nokey48 = !CFG.LLM_API_KEY, badreqSys48 = badreq48 >= 2 && llmOk46 === 0;
    const kind48 = nokey48 ? 'nokey' : (badreqSys48 ? 'badreq' : (llmErr46 || String((win48.length ? win48[win48.length - 1] : {}).kind || '')));
    const downNow46 = nokey48 || badreqSys48 || (/^(auth|quota|model)$/.test(llmErr46) && llmOk46 === 0) || (sumW('fail') >= 2 && sumW('ok') === 0);
    const upNow48 = !nokey48 && !badreqSys48 && (prev46.ok === false ? sumW('ok') >= 2 : llmOk46 > 0);
    const preDown48 = !nokey48 && sumW('preFail') >= 3 && sumW('preOk') === 0, preUp48 = sumW('preOk') >= 1;
    const base48 = { win: win48, pre: preDown48 ? false : (preUp48 ? true : (prev46.pre === false ? false : true)), preKind: preDown48 ? String((scoreLead.health46 || {}).preLast || '').slice(0, 160) : '', model: CFG.LLM_MODEL || '', preModel: CFG.LLM_PREFILTER_MODEL || '', cbOpen: cb48.open, at: now48 };
    if (preDown48 && prev46.pre !== false) console.log(JSON.stringify({ severity: 'WARNING', message: '[LLM-PRE-DOWN] tầng 1 (' + (CFG.LLM_PREFILTER_MODEL || '') + ') lỗi ' + sumW('preFail') + ' bài/15′, 0 OK — đang cho MỌI bài lên model chấm sâu (fail-open, tốn hơn): ' + base48.preKind }));
    else if (!preDown48 && preUp48 && prev46.pre === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[LLM-PRE-UP] tầng 1 hoạt động lại' }));
    if (downNow46) {
      const runs46 = (prev46.ok === false ? Number(prev46.runs) || 0 : 0) + 1;
      await stRef46.set(Object.assign(base48, { ok: false, since: (prev46.ok === false && prev46.since) ? prev46.since : now48, runs: runs46, kind: kind48, sample: nokey48 ? 'Chưa cấu hình LLM_API_KEY — không chấm AI, không chấm lại điểm tạm' : llmErrMsg46, fails: llmFail46, deferred: llmDeferred, fallback: llmFallback }), { merge: true });
      if (prev46.ok !== false) console.log(JSON.stringify({ severity: 'ERROR', message: '[LLM-DOWN] OpenAI (' + (CFG.LLM_MODEL || '') + ') lỗi ' + kind48 + ' — ' + sumW('fail') + ' lượt chấm hỏng/15′, 0 thành công; ' + llmDeferred + ' bài xếp hàng chấm lại, ' + llmFallback + ' lead dự phòng · ' + (nokey48 ? 'thiếu LLM_API_KEY' : llmErrMsg46) }));
      else console.log('[LLM-DOWN] vẫn lỗi (' + runs46 + ' lượt): ' + kind48 + ' · ' + llmErrMsg46);
    } else if (upNow48 && (prev46.ok === false || !stS46 || !stS46.exists)) {
      await stRef46.set(Object.assign(base48, { ok: true, recoveredAt: now48, since: prev46.since || null, runs: prev46.runs || 0, kind: '', sample: '' }), { merge: true });
      if (prev46.ok === false) console.log(JSON.stringify({ severity: 'WARNING', message: '[LLM-UP] OpenAI hoạt động lại — ' + sumW('ok') + ' lượt chấm OK trong cửa sổ' + (llmFail46 ? ' (' + llmFail46 + ' hỏng)' : '') }));
    } else if (touched48 || !!prev46.cbOpen !== cb48.open || (prev46.pre === false) !== (base48.pre === false)) { await stRef46.set(Object.assign({ ok: prev46.ok === false ? false : true }, base48), { merge: true }); } // LENH #48: lưu cửa sổ cả khi doc chưa có (không thì 2 lượt hỏng ×1 bài không bao giờ kích)
  } catch (e) { console.warn('[LLM-WATCH] lỗi:', e && e.message); }
  const llmCalls = scoreCalls + preCalls;
  const costUsd = (mainIn / 1e6) * CFG.LLM_PRICE_IN + (mainOut / 1e6) * CFG.LLM_PRICE_OUT
                + (preIn / 1e6) * CFG.LLM_PREFILTER_PRICE_IN + (preOut / 1e6) * CFG.LLM_PREFILTER_PRICE_OUT;
  const costR = Math.round(costUsd * 1e6) / 1e6;
  const summary = {
    at: FieldValue.serverTimestamp(), trigger, twoStage, aiMode,
    durationMs, sourcesCount: sources.length,
    postsFetched: scanned, commentsFetched: commentsScanned, scanComments, candidates: candTotal, postsMatched: matched, leadsCreated: kept, hotLeads: hot,
    skippedSeen, backfillSkipped, commentsRefreshSkipped, scoreErrors, scrapeErrors, llmCalls, prefilterCalls: preCalls, scoreCalls,
    llmDeferred, llmFallback, llmRescored: rescored46, llmRescoredLeads: rescoredLeads46, llmOk: llmOk46, llmFail: llmFail46, llmErr: llmErr46, llmPreFail: llmPreFail46, /* LENH #46 */
    llmPreOk: llmPreOk46, pipeErrors: pipeErrors48, softStop: softStop48, seenRace: seenRace48, leased: leased48, cbOpen: cb48.open, badreq: badreq48, model: CFG.LLM_MODEL || '', tokensReasoning: reasonTok48, runId: runId48, status: 'done', /* LENH #48 */
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
  try { await db.collection('system_status').doc('scan').set({ phase: 'done', at: Date.now(), runId: runId48, trigger, lastRunAt: Date.now(), lastDurationMs: durationMs, lastLeads: kept, lastPosts: scanned, softStop: softStop48, pipeErrors: pipeErrors48, seenRace: seenRace48, leased: leased48 }, { merge: true }); } catch (_) {} // LENH #48 (PB-1e)
  console.log(`scan xong: ${scanned} bài → ${candTotal} ứng viên → ${matched} qua tầng 1 → giữ ${kept} lead (${hot} nóng), ${preCalls}+${scoreCalls} lượt AI, ${tokTotal} token, ~$${costUsd.toFixed(4)}`);
  return { scanned, matched, kept, hot, durationMs, tokensTotal: tokTotal, costUsd, scanId, jobId: opts.jobId || null };
}

/* 1) Quét theo lịch */
/* LENH #48 (PB-1e): lượt quét ném lỗi → vẫn để lại dấu vết (scans status:'aborted' + system_status/scan + log ERROR → alert #9) thay vì im lặng */
async function abortLog48(trigger, e) {
  const msg = String((e && e.message) || e).slice(0, 300);
  try { await db.collection('scans').add({ at: FieldValue.serverTimestamp(), trigger, status: 'aborted', error: msg, sourcesCount: 0, postsFetched: 0, commentsFetched: 0, candidates: 0, postsMatched: 0, leadsCreated: 0, hotLeads: 0, durationMs: 0, scoreErrors: 0, scrapeErrors: 0, llmCalls: 0, costUsd: 0, dist: { hot: 0, warm: 0, cold: 0, junk: 0 }, bySource: [] }); } catch (_) {}
  try { await db.collection('system_status').doc('scan').set({ phase: 'aborted', at: Date.now(), trigger, lastError: msg, lastErrorAt: Date.now() }, { merge: true }); } catch (_) {}
  console.log(JSON.stringify({ severity: 'ERROR', message: '[SCAN-ABORTED] lượt ' + trigger + ' ném lỗi: ' + msg }));
}
export const scheduledScan = onSchedule(
  { schedule: `every ${CFG.POLL_MINUTES} minutes`, timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 1800, maxInstances: 1 },
  async () => { try { await scanAll('scheduled'); } catch (e) { await abortLog48('scheduled', e); throw e; } } // LENH #48
);

/* 2) Lead NÓNG mới → cảnh báo đa kênh */
export const onLeadCreated = onDocumentCreated('leads/{id}', async (event) => {
  const lead = event.data?.data(); if (!lead) return;
  if ((lead.score || 0) < CFG.HOT_THRESHOLD) return;
  const config = await loadConfig();
  await dispatch({ id: event.params.id, ...lead }, config.channels);
});

/* 3) Quét thủ công từ dashboard (nút "Quét ngay") */
export const manualScan = onRequest({ cors: true }, async (req, res) => {
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  // Phân quyền: chấp nhận API_TOKEN (server-to-server) HOẶC Firebase ID token có vai trò được phép chạy quét.
  const tokenOK = CFG.API_TOKEN && req.get('X-API-Token') === CFG.API_TOKEN;
  if (!tokenOK) {
    const caller = await verifyCaller(req);
    if (!caller || caller.role !== 'superadmin') {
      res.status(403).json({ error: 'forbidden', message: 'Tài khoản không có quyền chạy quét.' });
      return;
    }
  }
  const jobId = (typeof b.jobId === 'string' && b.jobId) ? b.jobId : null; // theo dõi tiến độ realtime
  // QUÉT QUÁ KHỨ: { mode:'backfill', range:'24h|3d|7d|30d|90d|custom', start_date?, end_date?, sourceUrl?, jobId? }
  if (b.mode === 'backfill') {
    const { start, end } = computeRange(b.range, b.start_date, b.end_date);
    const opts = { startDate: start, endDate: end, rangeLabel: b.range || 'custom',
                   sourceUrl: b.sourceUrl || null, numPosts: b.numPosts || undefined, jobId, force: !!b.force };
    let sum; try { sum = await scanAll('backfill', opts); } catch (e) { await abortLog48('backfill', e); throw e; } // LENH #48
    res.json({ ok: true, mode: 'backfill', range: { label: opts.rangeLabel, start, end }, summary: sum });
    return;
  }
  let sum; try { sum = await scanAll('manual', { jobId, force: !!b.force }); } catch (e) { await abortLog48('manual', e); throw e; } // LENH #48
  res.json({ ok: true, summary: sum });
});

export { scanAll };
