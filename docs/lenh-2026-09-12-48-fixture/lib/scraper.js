import { getFirestore as __getFs } from '../stub48.mjs'; /* FIXTURE #48: thật = 'firebase-admin/firestore' */
/* Lấy bài CÔNG KHAI từ group Facebook qua Scraper API (Bright Data — Posts by group URL).
   Không dùng nick đăng nhập → không có bài toán checkpoint.
   Có MOCK_MODE để chạy thử không cần token. */
import { CFG } from './config.js';
import { log } from './logger.js';

const BD = 'https://api.brightdata.com/datasets/v3';

/* Chuẩn hoá field (tên field tuỳ dataset, map tại đây) */
export function normalizePost(p, source) {
  return {
    post_id: String(p.post_id || p.id || p.url || Math.random()),
    url:     p.url || p.post_url || '',
    author:  p.user_name || p.author || p.profile_name || p.user_username_raw || 'Ẩn danh',
    user_url: p.user_url || p.profile_url || p.user_profile_url || '',  /* v-patch user_url-map: giu link profile nguoi dang */
    text:    dedupeTxt(p.content || p.post_text || p.text || ''),
    time:    p.date_posted || p.time || new Date().toISOString(),
    source:  source.name,
    kind:    'post'
  };
}

/* Chuẩn hoá 1 COMMENT về cùng "hình dạng" như post để đi chung pipeline AI.
   Tên field comment tuỳ dataset Bright Data → map rộng tay tại đây. */
export function normalizeComment(c, source, parentUrl) {
  const cid = c.comment_id || c.id || c.comment_url || c.url
    || ((parentUrl || '') + '#' + (c.user_url || c.commenter_id || Math.random()));
  return {
    post_id:    'cmt_' + String(cid),
    url:        c.comment_url || c.url || parentUrl || '',
    author:     c.user_name || c.commenter_name || c.author || c.profile_name || c.user_username_raw || 'Ẩn danh',
    user_url:  c.user_url || c.commenter_url || c.commenter_profile_url || '',
    text:       dedupeTxt(c.comment_text || c.comment || c.text || c.content || ''),
    time:       c.date_created || c.date || c.comment_date || c.time || new Date().toISOString(),
    source:     source.name,
    kind:       'comment',
    parent_url: parentUrl || c.post_url || '',
    comment_id: (() => {
      const raw = String(c.comment_id || c.id || '');
      if (/^\d+$/.test(raw)) return raw;
      try { const dm = Buffer.from(raw, 'base64').toString('utf8').match(/^comment:\d+_(\d+)$/); if (dm) return dm[1]; } catch (e) {}
      const m = String(c.comment_link || c.comment_url || c.url || '').match(/comment_id=(\d+)/);
      return m ? m[1] : '';
    })(),
    comment_url: (() => {
      const link = String(c.comment_link || '');
      if (/comment_id=\d+/.test(link)) return link;
      const raw = String(c.comment_id || c.id || '');
      let numId = /^\d+$/.test(raw) ? raw : '';
      if (!numId) { try { const dm = Buffer.from(raw, 'base64').toString('utf8').match(/^comment:\d+_(\d+)$/); if (dm) numId = dm[1]; } catch (e) {} }
      if (!numId) numId = (String(c.comment_link || c.comment_url || c.url || '').match(/comment_id=(\d+)/) || [])[1] || '';
      if (numId && parentUrl) return parentUrl.split('?')[0] + '?comment_id=' + numId;
      return c.comment_link || c.comment_url || c.url || '';
    })()
  };
}

/* ---- MOCK: sinh bài giả để demo pipeline end-to-end ---- */
const MOCK_POOL = [
  'Có bên nào làm marketing trọn gói cho spa không ạ? Mình cần chạy lead gấp, budget ~30tr/tháng.',
  'Cần tìm team quay video TikTok cho quán cà phê mới khai trương khu Thảo Điền, bạn nào làm tốt review giúp.',
  'Shop em bán đồ nữ, TikTok Shop dạo này không ra đơn, có bên nào nhận vận hành trọn gói không ạ?',
  'Trung tâm du học bên mình cần tìm agency chạy lead du học Nhật mùa cao điểm, báo giá giúp mình.',
  'Mọi người ơi cho hỏi tự chạy ads cho shop mẹ&bé có khó không, có nên thuê ngoài không ạ?',
  'Em 2k8 đang tìm hiểu ngành TMĐT muốn nghe review thực tế, nên đi theo hướng nào ạ?',
  'Bên mình nhận đào tạo khoá học chạy ads 2tr/khoá, ai cần inbox nhé!!!',
  'Tiệm grooming thú cưng ở Gò Vấp đang vắng khách, có cách nào marketing địa phương hiệu quả không?'
];
function mockPosts(source, n, opts = {}) {
  const out = [];
  const backfill = !!(opts.startDate || opts.endDate);
  const k = backfill ? Math.min(n, 8 + Math.floor(Math.random() * 8)) // 8-15 bài khi quét quá khứ
                     : Math.min(n, 3 + Math.floor(Math.random() * 3)); // 3-5 bài mỗi lần thường
  const parseMDY = s => { const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s || ''); return m ? new Date(+m[3], +m[1] - 1, +m[2]).getTime() : Date.now(); };
  const t1 = parseMDY(opts.endDate), t0 = opts.startDate ? parseMDY(opts.startDate) : t1 - 86400e3;
  for (let i = 0; i < k; i++) {
    const text = MOCK_POOL[Math.floor(Math.random() * MOCK_POOL.length)];
    const when = backfill ? new Date(t0 + Math.random() * Math.max(1, t1 - t0)) : new Date();
    out.push(normalizePost({
      post_id: 'mock_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
      url: source.url + '/posts/' + Math.floor(Math.random() * 1e9),
      author: 'User' + Math.floor(Math.random() * 9999),
      content: text, date_posted: when.toISOString()
    }, source));
  }
  return out;
}

/* ---- Gọi Bright Data Dataset API (trigger → poll → fetch) ----
   opts: { numPosts?, startDate?, endDate? }  (start/end dạng MM-DD-YYYY — quét ngược quá khứ) */
async function bdTrigger(urls, opts = {}) {
  const body = urls.map(u => {
    const item = { url: u };
    if (opts.numPosts) item.num_of_posts = opts.numPosts; // bỏ trống = không giới hạn
    if (opts.startDate) item.start_date = opts.startDate;  // lọc bài từ ngày này (MM-DD-YYYY)
    if (opts.endDate) item.end_date = opts.endDate;        // đến ngày này (MM-DD-YYYY)
    if (Array.isArray(opts.notInclude) && opts.notInclude.length) item.posts_to_not_include = opts.notInclude.slice(0, 200); // v17: loai bai da thay - chi mua bai moi
    return item;
  });
  const r = await fetch(`${BD}/trigger?dataset_id=${CFG.BRIGHTDATA_DATASET_ID}&include_errors=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CFG.BRIGHTDATA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`trigger ${r.status}: ${await r.text()}`);
  return (await r.json()).snapshot_id;
}
async function bdWait(id, tries = 40, gap = 5000) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${BD}/progress/${id}`, { headers: { Authorization: `Bearer ${CFG.BRIGHTDATA_TOKEN}` } });
    const j = await r.json();
    if (j.status === 'ready') return;
    if (j.status === 'failed') throw new Error('snapshot failed');
    await new Promise(s => setTimeout(s, gap));
  }
  throw new Error('snapshot timeout');
}
let __fsdb = null;
function __pendDb() { if (!__fsdb) __fsdb = __getFs(); return __fsdb; }
async function bdStatus(id) {
  try {
    const r = await fetch(`${BD}/progress/${id}`, { headers: { Authorization: `Bearer ${CFG.BRIGHTDATA_TOKEN}` } });
    const j = await r.json(); return j.status || 'unknown';
  } catch (e) { return 'unknown'; }
}
async function bdWaitSoft(id, tries = 18, gap = 5000) {
  for (let i = 0; i < tries; i++) {
    const st = await bdStatus(id);
    if (st === 'ready') return true;
    if (st === 'failed') throw new Error('snapshot failed');
    await new Promise(s => setTimeout(s, gap));
  }
  return false;
}
async function bdFetch(id) {
  const r = await fetch(`${BD}/snapshot/${id}?format=json`, { headers: { Authorization: `Bearer ${CFG.BRIGHTDATA_TOKEN}` } });
  if (!r.ok) throw new Error(`snapshot fetch ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

/** Lấy bài cho 1 nguồn. Trả về mảng post đã chuẩn hoá.
 *  opts: { startDate?, endDate?, numPosts? }
 *   - không có startDate/endDate → quét "mới nhất" (giới hạn POSTS_PER_GROUP) như cũ
 *   - có startDate/endDate (MM-DD-YYYY) → QUÉT NGƯỢC QUÁ KHỨ theo khoảng ngày */
export async function fetchPosts(source, opts = {}) {
  const backfill = !!(opts.startDate || opts.endDate);
  if (CFG.MOCK_MODE) return mockPosts(source, backfill ? (opts.numPosts || 24) : CFG.POSTS_PER_GROUP, opts);
  if (!CFG.BRIGHTDATA_TOKEN) { log.warn('Chưa có BRIGHTDATA_TOKEN — bật MOCK_MODE=true để chạy thử.'); return []; }
  const trigOpts = backfill
    ? { startDate: opts.startDate, endDate: opts.endDate, numPosts: opts.numPosts || undefined }
    : { numPosts: opts.numPosts || CFG.POSTS_PER_GROUP, notInclude: opts.notInclude }; // live: cho phép ghi đè (probe ít bài / sweep đủ bài)
  // ==== v16 GIEO-GAT 09/08/2026 + v-sow 05/09/2026: gieo snapshot, gat o luot sau. opts.sow=true (quet theo LICH): KHONG cho trong luot ====
  const pendRef = __pendDb().collection('pending_snapshots').doc('P_' + String(source.url || '').replace(/[^\w-]/g, '_').slice(0, 470));
  const gsRef = __pendDb().collection('group_state').doc(String(source.url || '').replace(/[^\w-]/g, '_').slice(0, 480));
  const mark = (arr, bd, extra) => { try { arr.bd = bd; if (extra) Object.assign(arr, extra); } catch (e) {} return arr; }; // arr.bd: 'ok' = da goi BrightData thanh cong, 'skip' = khong goi
  let snap = null, pendSweep = false;
  try {
    const pd = await pendRef.get();
    if (pd.exists) {
      const p = pd.data() || {};
      const st = await bdStatus(p.snapshot_id);
      if (st === 'ready') { snap = p.snapshot_id; pendSweep = !!p.sweep; try { await pendRef.delete(); } catch (e) {} log.info('GAT snapshot ' + p.snapshot_id + ' — ' + source.url); }
      else if (st === 'failed' || (Date.now() - (p.t || 0)) > 2 * 3600e3) { try { await pendRef.delete(); } catch (e) {} }
      else { log.info('snapshot ' + p.snapshot_id + ' chua chin (' + st + ') — cho luot sau: ' + source.url); return mark([], st === 'unknown' ? 'skip' : 'ok'); }
    }
  } catch (e) {}
  if (!snap) {
    if (opts.sow) {
      if (opts.sowDue === false) return mark([], 'skip'); // chua toi nhip gieo cua nguon nay
      snap = await bdTrigger([source.url], trigOpts);
      try { await pendRef.set({ snapshot_id: snap, url: source.url || '', backfill: false, sweep: !!opts.sweep, t: Date.now() }); } catch (e) {}
      try { await gsRef.set({ url: source.url || '', lastTriggerAt: Date.now() }, { merge: true }); } catch (e) {}
      log.info('GIEO snapshot ' + snap + (opts.sweep ? ' (sweep)' : '') + ' — gat luot sau: ' + source.url);
      return mark([], 'ok');
    }
    snap = await bdTrigger([source.url], trigOpts);
    const ok = await bdWaitSoft(snap, backfill ? 40 : 18, backfill ? 6000 : 5000);
    if (!ok) {
      try { await pendRef.set({ snapshot_id: snap, url: source.url || '', backfill: !!backfill, t: Date.now() }); } catch (e) {}
      log.info('GIEO snapshot ' + snap + ' (nguon cham) — se gat luot sau: ' + source.url);
      return mark([], 'ok');
    }
  }
  const raw = await bdFetch(snap);
  try { if (!backfill) { const _ids = raw.map(r => String(r.post_id || r.id || '')).filter(Boolean); if (_ids.length) { const _prev = Array.isArray(opts.notInclude) ? opts.notInclude : []; const _m = [...new Set([..._ids, ..._prev])].slice(0, 200); await __pendDb().collection('group_state').doc(String(source.url || '').replace(/[^\w-]/g, '_').slice(0, 480)).set({ url: source.url || '', recentIds: _m, recentIdsAt: Date.now() }, { merge: true }); } } } catch (e) {}
  const _good = raw.filter(r => r && (r.post_id || r.id) && !r.error && !r.error_code && !r.warning && !r.warning_code);
  if (_good.length < raw.length) log.info('stub-filter: loai ' + (raw.length - _good.length) + ' record vo-rong/error (posts) — ' + (source.url || ''));
  return mark(_good.map(p => normalizePost(p, source)), 'ok', { sweep: pendSweep });
}

/* ---- COMMENT: lấy bình luận của 1 loạt bài qua dataset comment riêng của Bright Data ----
   Input mỗi dòng: { url: <post_url>, limit_records?: N }. Trả mảng comment đã chuẩn hoá (kind:'comment'). */
const MOCK_CMT_POOL = [
  'Mình cũng đang cần dịch vụ này, ib giá giúp mình với ạ.',
  'Cho em xin báo giá gói chạy ads tháng với ạ.',
  'Bên bạn có nhận vận hành TikTok Shop không, shop mình cần gấp.',
  'Hóng review, mình cũng định thuê ngoài.',
  'Quan tâm nha, inbox em bảng giá nhé!',
  'Bài hay quá, cảm ơn bạn đã chia sẻ.',
  'Up cho bạn nào cần.'
];
function mockComments(postUrls, source, perPost = 3) {
  const out = [];
  for (const url of postUrls) {
    const k = 1 + Math.floor(Math.random() * Math.max(1, perPost));
    for (let i = 0; i < k; i++) {
      out.push(normalizeComment({
        comment_id: 'mockcmt_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
        comment_url: url + '?comment_id=' + Math.floor(Math.random() * 1e9),
        user_name: 'Commenter' + Math.floor(Math.random() * 9999),
        comment_text: MOCK_CMT_POOL[Math.floor(Math.random() * MOCK_CMT_POOL.length)],
        date_created: new Date().toISOString()
      }, source, url));
    }
  }
  return out;
}

/* ---- (FIXTURE #48: dòng 223–256 thật không có trong dump — stub cùng chữ ký) ---- */
export async function fetchPostsAuth(source, account, opts = {}) { return { posts: [], checkpoint: false }; }
async function bdTriggerComments(postUrls, perPost) {
  const body = postUrls.map(u => { const item = { url: u }; if (perPost) item.limit_records = perPost; return item; });
  const r = await fetch(`${BD}/trigger?dataset_id=${CFG.BRIGHTDATA_COMMENTS_DATASET_ID}&include_errors=true`, { method: 'POST', headers: { Authorization: `Bearer ${CFG.BRIGHTDATA_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`trigger comments ${r.status}: ${await r.text()}`);
  return (await r.json()).snapshot_id;
}
export async function fetchComments(items, opts = {}) {
  const urls = [...new Set(items.map(i => i.url).filter(Boolean))];
  if (!urls.length) return [];
  const srcByUrl = new Map(items.map(i => [i.url, i.source]));
  const perPost = opts.perPost || CFG.COMMENTS_PER_POST || undefined;
  if (CFG.MOCK_MODE) {
    return urls.flatMap(u => mockComments([u], srcByUrl.get(u) || { name: '' }, perPost || 3)
      .map(c => ({ comment: c, source: srcByUrl.get(u) || { name: '' }, parentUrl: u })));
  }
  if (!CFG.BRIGHTDATA_TOKEN || !CFG.BRIGHTDATA_COMMENTS_DATASET_ID) {
    log.warn('Chưa cấu hình BRIGHTDATA_COMMENTS_DATASET_ID — bỏ qua quét comment.');
    return [];
  }
  const out = [];
  // ==== v-sowc 05/09/2026: quét theo LỊCH (opts.sow) → chỉ GIEO snapshot comment (pending_snapshots kind='comments' kèm bài cha) rồi trả về ngay;
  //      GẶT bằng harvestComments() ở lượt sau. Không sow (quét tay/backfill) → chờ trong lượt như cũ. ====
  if (opts.sow) {
    let sown = 0;
    for (let i = 0; i < urls.length; i += 50) {
      const batch = urls.slice(i, i + 50);
      try {
        const snap = await bdTriggerComments(batch, perPost);
        const meta = batch.map(u => { let m = null; try { m = typeof opts.metaOf === 'function' ? opts.metaOf(u) : null; } catch (e) {} const s = srcByUrl.get(u); return Object.assign({ url: u, srcUrl: String((s && s.url) || ''), parentUrl: u, parentAuthor: '', parentText: '' }, m || {}); });
        const ref = __pendDb().collection('pending_snapshots').doc('C_' + String(snap).replace(/[^\w-]/g, '_').slice(0, 470));
        const pdoc = { kind: 'comments', snapshot_id: snap, t: Date.now(), perPost: perPost || 0, n: batch.length, meta };
        try { await ref.set(pdoc); } catch (e) { await new Promise(s => setTimeout(s, 800)); await ref.set(pdoc); }
        sown++; log.info('GIEO snapshot comment ' + snap + ' (' + batch.length + ' bai) — gat luot sau');
      } catch (e) { log.warn('fetchComments gieo lo loi: ' + e.message); }
    }
    try { out.sown = sown; } catch (e) {}
    return out;
  }
  // chia lô URL để 1 snapshot không quá lớn (mỗi lô tối đa 50 bài)
  for (let i = 0; i < urls.length; i += 50) {
    const batch = urls.slice(i, i + 50);
    try {
      const snap = await bdTriggerComments(batch, perPost);
      await bdWait(snap, 85, 6000);
      const raw0 = await bdFetch(snap);
      // v-patch chi-phí 16/08: báo số record BrightData TÍNH TIỀN theo từng bài cha (trước stub-filter)
      // qua opts.billed (Map parentUrl → n). Không đổi hành vi cũ nếu không truyền.
      if (opts.billed instanceof Map) {
        for (const c of raw0) { const pu = (c && (c.post_url || c.post_id)) || batch[0]; opts.billed.set(pu, (opts.billed.get(pu) || 0) + 1); }
      }
      const raw = raw0.filter(c => c && !c.error && !c.error_code && !c.warning && (c.comment_id || c.comment_text || c.comment || c.text || c.content));
      if (raw.length < raw0.length) log.info('stub-filter: loai ' + (raw0.length - raw.length) + ' record vo-rong/error (comments)');
      for (const c of raw) {
        const pu = c.post_url || c.post_id || batch[0];
        const src = srcByUrl.get(c.post_url) || srcByUrl.get(pu) || srcByUrl.get(batch[0]) || { name: '' };
        out.push({ comment: normalizeComment(c, src, c.post_url || pu), source: src, parentUrl: c.post_url || pu });
      }
    } catch (e) { log.warn('fetchComments lô lỗi: ' + e.message); }
  }
  return out;
}

/** v-sowc 05/09/2026: GẶT các snapshot comment đã gieo (pending_snapshots kind='comments'). Không chờ: chưa chín → để lượt sau; failed / quá 2h → xoá.
 *  opts: { billed?: Map(parentUrl → số record tính tiền), srcOf?: (srcUrl) => source | null }
 *  Trả { items: [{ comment, source, parentUrl, meta }], metas: [bài cha của các snapshot đã gặt], harvested, pending, failed }. */
export async function harvestComments(opts = {}) {
  const res = { items: [], metas: [], harvested: 0, pending: 0, failed: 0 };
  if (CFG.MOCK_MODE || !CFG.BRIGHTDATA_TOKEN) return res;
  const docs = [];
  try { const qs = await __pendDb().collection('pending_snapshots').where('kind', '==', 'comments').get(); qs.forEach(d => docs.push({ ref: d.ref, p: d.data() || {} })); }
  catch (e) { log.warn('harvestComments: doc pending loi ' + e.message); return res; }
  const uk = u => String(u || '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  for (const { ref, p } of docs) {
    const id = p.snapshot_id; if (!id) { try { await ref.delete(); } catch (e) {} continue; }
    const st = await bdStatus(id);
    if (st === 'failed' || (Date.now() - (Number(p.t) || 0)) > 2 * 3600e3) { res.failed++; try { await ref.delete(); } catch (e) {} log.warn('snapshot comment ' + id + (st === 'failed' ? ' failed' : ' qua han') + ' — bo'); continue; }
    if (st !== 'ready') { res.pending++; continue; }
    let raw0 = [];
    try { raw0 = await bdFetch(id); } catch (e) { res.pending++; log.warn('harvestComments: fetch ' + id + ' loi ' + e.message); continue; }
    const metas = Array.isArray(p.meta) ? p.meta.filter(m => m && m.url) : [];
    const byKey = new Map(); for (const m of metas) { byKey.set(uk(m.url), m); const k2 = uk(m.parentUrl); if (k2 && !byKey.has(k2)) byKey.set(k2, m); }
    const first = metas[0] || null;
    if (opts.billed instanceof Map) { for (const c of raw0) { const pu = (c && (c.post_url || c.post_id)) || (first && first.url) || ''; opts.billed.set(pu, (opts.billed.get(pu) || 0) + 1); } }
    const raw = raw0.filter(c => c && !c.error && !c.error_code && !c.warning && (c.comment_id || c.comment_text || c.comment || c.text || c.content));
    if (raw.length < raw0.length) log.info('stub-filter: loai ' + (raw0.length - raw.length) + ' record vo-rong/error (comments, gat)');
    for (const c of raw) {
      const pu = c.post_url || c.post_id || (first && first.url) || '';
      const m = byKey.get(uk(c.post_url)) || byKey.get(uk(pu)) || first;
      const src = (m && typeof opts.srcOf === 'function' && opts.srcOf(m.srcUrl)) || { name: '' };
      res.items.push({ comment: normalizeComment(c, src, c.post_url || pu), source: src, parentUrl: c.post_url || pu, meta: m });
    }
    res.metas.push(...metas); res.harvested++;
    try { await ref.delete(); } catch (e) {}
    log.info('GAT snapshot comment ' + id + ' — ' + raw.length + ' comment / ' + metas.length + ' bai');
  }
  return res;
}


/* v104 (v-dedup): Bright Data doi khi tra ve content bi LAP DOI (bai ngan: title == content).
   Chuan hoa tai cua vao: (1) chuoi = A + xuong dong + A -> giu mot A; (2) bo cac dong lien ke trung het nhau. */
function dedupeTxt(s){
  s=String(s||'').replace(/\r\n?/g,'\n').trim();
  if(!s) return s;
  var h=Math.floor(s.length/2);
  if(s.length%2===1 && s.charAt(h)==='\n' && s.slice(0,h)===s.slice(h+1)) return s.slice(0,h);
  var lines=s.split('\n'), out=[];
  for(var i=0;i<lines.length;i++){ if(!out.length || out[out.length-1].trim()!==lines[i].trim()) out.push(lines[i]); }
  return out.join('\n');
}
