# LỆNH #22a — Soi BrightData: snapshot đang chờ + nguồn có bài 24h (CHỈ ĐỌC) — 05/09/2026

> Bối cảnh: sau LỆNH #21 (v-sow) lượt quét theo lịch chỉ còn 0,4–6 s, hết 504, chu trình gieo→gặt→skip đúng.
> Nhưng 8 lượt 04:02–04:23 VN đều **0 bài / 0 bdRecords / 0 lead**; soi tay 1 snapshot (`vieclamtotchosv`) thấy BrightData trả
> `status:ready, records:0, errors:1, error_codes:{dead_page:1}` (record duy nhất là record LỖI, chỉ có `input`).
> Cần biết `dead_page` là **cục bộ** (1 group / giờ đêm không có bài) hay **lan rộng** (collector BrightData hoặc group không đọc được).
> Khối này KHÔNG ghi gì. Token BrightData đọc từ `.env`, **không in ra màn hình**.

## Chạy (dán nguyên khối)

```bash
cd ~/firebase-s13/functions && cat > _ss_bd.mjs <<'EOS'
/* LỆNH #22a — CHỈ ĐỌC: soi BrightData cho MỌI snapshot đang chờ (pending_snapshots) + nguồn nào có bài 24h qua.
   Token đọc từ .env (BRIGHTDATA_TOKEN) — KHÔNG in ra màn hình. */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const TOK = process.env.BRIGHTDATA_TOKEN || '';
if (!TOK) { console.log('THIEU BRIGHTDATA_TOKEN trong .env'); process.exit(1); }
const BD = 'https://api.brightdata.com/datasets/v3';
const H = { Authorization: 'Bearer ' + TOK };
const short = u => String(u || '').replace(/^https?:\/\/(www\.|m\.)?facebook\.com\/(groups\/)?/, '').replace(/\/+$/, '').slice(0, 34);
const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : (v && v._seconds ? v._seconds * 1000 : 0));
const vn = t => t ? new Date(t + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '—';
const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
async function progress(id) {
  try { const r = await fetch(`${BD}/progress/${id}`, { headers: H }); const j = await r.json(); j.__http = r.status; return j; }
  catch (e) { return { status: 'ERR', __msg: String(e && e.message) }; }
}
async function snapshot(id) {
  try { const r = await fetch(`${BD}/snapshot/${id}?format=json`, { headers: H }); if (!r.ok) return { __http: r.status }; return await r.json(); }
  catch (e) { return { __msg: String(e && e.message) }; }
}

/* 1) snapshot đang chờ — hỏi BrightData từng cái */
const pend = await db.collection('pending_snapshots').get();
console.log(`== 1) pending_snapshots: ${pend.size} doc (hỏi progress từng snapshot) ==`);
const rows = [];
for (const d of pend.docs) {
  const p = d.data() || {};
  const j = await progress(p.snapshot_id);
  rows.push({ url: p.url || d.id, id: p.snapshot_id, age: Math.round((Date.now() - (p.t || 0)) / 60e3), sweep: !!p.sweep,
    st: j.status || j.__msg || ('http' + j.__http), rec: j.records ?? '', err: j.errors ?? '', codes: JSON.stringify(j.error_codes || {}), dur: j.collection_duration ?? '' });
}
rows.sort((a, b) => b.age - a.age);
console.log(pad('nguồn', 34), pad('tuổi', 6), pad('sweep', 5), pad('status', 8), pad('rec', 4), pad('err', 4), pad('error_codes', 24), 'ms');
for (const r of rows) console.log(pad(short(r.url), 34), pad(r.age + "'", 6), pad(r.sweep ? 'Y' : '', 5), pad(r.st, 8), pad(r.rec, 4), pad(r.err, 4), pad(r.codes, 24), r.dur);
const cnt = {};
for (const r of rows) { const k = r.st === 'ready' ? (Number(r.rec) > 0 ? 'ready_co_bai' : (r.codes.includes('dead_page') ? 'ready_dead_page' : 'ready_0_bai')) : r.st; cnt[k] = (cnt[k] || 0) + 1; }
console.log('TÓM TẮT pending:', JSON.stringify(cnt));

/* 2) mẫu record lỗi: đọc 1 snapshot ready có errors>0, in các field lỗi (không in input) */
const bad = rows.find(r => r.st === 'ready' && Number(r.err) > 0);
if (bad) {
  const recs = await snapshot(bad.id);
  const arr = Array.isArray(recs) ? recs : [];
  console.log(`== 2) mẫu record lỗi (${short(bad.url)}, ${arr.length} record) ==`);
  for (const r0 of arr.slice(0, 3)) {
    const keys = Object.keys(r0 || {}).filter(k => k !== 'input');
    console.log('  keys:', keys.join(','), '| error=', r0.error, '| error_code=', r0.error_code, '| warning=', r0.warning, '| warning_code=', r0.warning_code, '| url=', r0.url || (r0.input && r0.input.url) || '');
  }
  if (!arr.length) console.log('  (snapshot trả về không phải mảng:', JSON.stringify(recs).slice(0, 200), ')');
} else console.log('== 2) không có snapshot ready kèm lỗi để lấy mẫu ==');

/* 3) 24h qua theo nguồn (từ scans.bySource): nguồn nào BrightData từng trả bài, nguồn nào 0 cả ngày */
const sc = await db.collection('scans').orderBy('at', 'desc').limit(120).get();
const since = Date.now() - 24 * 3600e3;
const by = new Map();
let nRuns = 0;
for (const d of sc.docs) {
  const s = d.data() || {}; const t = ms(s.at); if (t && t < since) continue; nRuns++;
  for (const r of (Array.isArray(s.bySource) ? s.bySource : [])) {
    const k = r.url || r.name || '?';
    const o = by.get(k) || { name: r.name || '', bdPosts: 0, posts: 0, leads: 0, runs: 0, ok: 0, err: 0, lastBd: 0, lastErr: '' };
    o.runs++; o.bdPosts += Number(r.bdPosts) || 0; o.posts += Number(r.posts) || 0; o.leads += Number(r.leads) || 0;
    if (r.bd === 'ok') o.ok++;
    if (r.error) { o.err++; if (!o.lastErr) o.lastErr = String(r.error).slice(0, 40); }
    if ((Number(r.bdPosts) || 0) > 0 && t > o.lastBd) o.lastBd = t;
    by.set(k, o);
  }
}
const pendBy = new Map(rows.map(r => [r.url, r]));
console.log(`== 3) 24h qua theo nguồn (${nRuns} lượt scans) — bdPosts = record BrightData trả (trước stub-filter), posts = bài hợp lệ ==`);
console.log(pad('nguồn', 34), pad('lượt', 5), pad('bdPosts', 8), pad('posts', 6), pad('lead', 5), pad('lần cuối có bài (VN)', 20), pad('lỗi', 42), 'pending giờ');
const list = [...by.entries()].sort((a, b) => b[1].bdPosts - a[1].bdPosts);
for (const [u, o] of list) {
  const p = pendBy.get(u);
  console.log(pad(short(u) || o.name, 34), pad(o.runs, 5), pad(o.bdPosts, 8), pad(o.posts, 6), pad(o.leads, 5), pad(vn(o.lastBd), 20), pad(o.err ? `${o.err}× ${o.lastErr}` : '', 42), p ? `${p.st} ${p.codes}` : '');
}
const zero = list.filter(([, o]) => o.bdPosts === 0 && !o.lastErr).length;
console.log(`Nguồn 0 bài suốt 24h (không lỗi): ${zero}/${list.length} · nguồn lỗi cố định: ${list.filter(([, o]) => o.err >= Math.max(3, o.runs * 0.8)).length}`);

/* 4) 12 lượt gần nhất (để soi sau 09:00 VN có bài chưa) */
console.log('== 4) 12 lượt scans gần nhất ==');
for (const d of sc.docs.slice(0, 12)) {
  const s = d.data() || {}; const bs = Array.isArray(s.bySource) ? s.bySource : [];
  const ok = bs.filter(r => r.bd === 'ok').length, skip = bs.filter(r => r.bd === 'skip').length, er = bs.filter(r => r.error).length;
  console.log(vn(ms(s.at)), pad(s.trigger, 9), 'dur', pad(Math.round((s.durationMs || 0) / 1000) + 's', 6), 'posts', pad(s.postsFetched ?? s.posts ?? 0, 4), 'bd', pad(s.bdRecords ?? 0, 4), 'lead', pad(s.leadsCreated ?? 0, 3), 'llm', pad(s.llmCalls ?? 0, 3), `bd ok/skip/err ${ok}/${skip}/${er}`);
}
const st = await db.collection('system_status').doc('brightdata').get();
console.log('system_status/brightdata:', st.exists ? JSON.stringify(st.data()).slice(0, 300) : '(chưa có)');
process.exit(0);
EOS
set -a; . ./.env; set +a; node _ss_bd.mjs; rm -f _ss_bd.mjs
```

## Cách đọc output
- **Mục 1** (pending): mỗi snapshot đang chờ → `status/rec/err/error_codes/ms`. Dòng `TÓM TẮT pending`:
  - `ready_co_bai` nhiều → BrightData bình thường, lượt kế sẽ gặt được bài.
  - `ready_dead_page` ≈ toàn bộ → collector BrightData không đọc được group (lỗi bên BrightData hoặc group private/đổi URL) → cần mở ticket BrightData / kiểm URL group.
  - `ready_dead_page` chỉ vài group → group đó private/đổi tên → tắt/sửa nguồn trên web.
  - `running` nhiều với tuổi < 10' = bình thường (BrightData mất 1–5' để chín).
- **Mục 2**: field lỗi của record mẫu (`error`, `error_code`) — câu chữ BrightData ghi.
- **Mục 3**: theo nguồn 24h qua — `bdPosts` (record BrightData trả) và `lần cuối có bài`. Nguồn có bài chiều/tối qua mà giờ `dead_page` = tạm thời/giờ đêm; nguồn 0 bài suốt 24h + không lỗi = group chết hoặc BrightData không vào được.
- **Mục 4**: 12 lượt gần nhất — chạy lại sau **09:00 VN** để thấy `posts/bd/lead` lên số khi group có bài mới.

## Sau khi có output → LỆNH #22 (sửa) theo 3 việc anh chốt
1. 5 nguồn "thiếu cookie nick" (neu1 · bk-1 · nguyên căn 1 · hhqcvain1 · Tm S Con Sen): tắt trên web (Nguồn quét → gạt tắt) hay giữ?
2. `SCANNED_TTL_DAYS`: config.js chưa đọc biến này (TTL luôn 1 ngày) — anh muốn mấy ngày?
3. Dời IP VPS mặc định trong `lib/config.js` (`VPS_URL`) sang `.env` (không đổi hành vi, chỉ để không lộ IP trong code).
(Tuỳ chọn) nhịp đêm 00–06h VN: `config/app.scanIntervalMin` = 30 để đỡ mua record rỗng.
