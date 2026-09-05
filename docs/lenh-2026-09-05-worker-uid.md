# Worker `2026-09-05` — giải mã uid chủ trang + `checkReplies` phủ mọi lead (phiên 05/09/2026)

> Anh chốt "xử lý hết các vấn đề trên" → phần (1): worker. File giao: `worker.mjs` bản **2026-09-05** (chép đè MỌI VPS, khởi động lại `run.bat`).
> Không đụng backend/Rules/index. Không có secret trong tài liệu này.

## Đổi gì (worker.mjs)
1. **`resolveProfileUid(page)`** — khi worker đang đứng trên trang cá nhân của lead (author_url dạng username/pfbid), giải mã **uid số** theo thứ tự tin cậy: URL sau redirect (`profile.php?id=` / `/people/…/<id>`) → meta `al:android:url` / `al:ios:url` (`fb://profile/<id>`) → meta `og:url` → `"profile_owner":{"id"}` trong HTML. KHÔNG dùng `"userID"` trần (đó là uid của chính nick). Trùng uid nick mình → bỏ. Không chắc → `null` (fail-closed).
2. **`runFunnel` → `ensureUid()`**: ở bước Kết bạn (đang trên profile) và sau Inbox (tab chính vẫn là profile) → nếu payload chưa có `uid` thì giải mã → ghi `outreach_threads/{leadId}.uid` + `uidResolvedAt` + `outreach_map/{uid}` = {leadId, brand, pid}. `gqlFriend` (API nội bộ kết bạn) dùng được uid vừa giải mã.
3. **`checkReplies`** (config `inbox.enabled`): thread đã inbox nhưng **chưa có uid** mà có `fpayload.profile_url` → mở profile 1 lần giải mã uid → lưu → mới mở `messages/t/<uid>` đọc phản hồi. Ưu tiên thread có uid sẵn (rẻ) trước; không ra uid → `replyChecks+1` (tối đa 6 lần rồi thôi). Thread không uid + không profile_url → bỏ qua như cũ.
4. `WORKER_VERSION='2026-09-05'` (heartbeat báo lên panel VPS).

**Đã test cục bộ**: harness Chromium thật cho `resolveProfileUid` 9/9 kịch bản (meta android/ios/og, profile_owner, URL redirect, uid của mình → null, pfbid → null, messenger → null); harness luồng stub Firestore 16/16 (funnel giải mã + lưu map; không uid → vẫn done, không rác; uid sẵn không bị đè; checkReplies 4 loại thread + everyMin). `node --check` OK.

## Anh làm (VPS)
1. Chép `worker.mjs` (2026-09-05) đè lên MỌI VPS → đóng cửa sổ worker → `run.bat` chạy lại (hoặc chờ vòng tái khởi động 6h).
2. **Bật đọc phản hồi thử trên 1 VPS**: mở `config.json` cạnh worker, thêm/sửa:
   ```json
   "inbox": { "enabled": true, "maxThreads": 5, "everyMin": 60, "days": 7 }
   ```
   → worker in header `inboxCheck` lên panel VPS (heartbeat). Mỗi phiên nick sau khi làm xong việc sẽ đọc tối đa 5 thread/nick, cách 60′. Ổn 1–2 ngày thì bật các VPS còn lại.
3. Nghiệm thu trên web: **Tiếp cận → Hoạt động gần đây** — dòng "💬 Khách đã phản hồi qua inbox — người thật tiếp quản, máy dừng" (status reply) + lead nhảy sang "Đã phản hồi" ở Pipeline + tab **Phản hồi khách**. Lead-là-comment: dòng "Thả cảm xúc vào bình luận → Trả lời bình luận của Lead". Lỗi → ảnh `errors/<leadId>__<step>_<i>.png` trên VPS.

## LỆNH #24 — KIỂM CHỈ ĐỌC (Cloud Shell, `~/firebase-s13/functions`) — chạy sau khi worker mới chạy ≥ 1 giờ
```bash
cd ~/firebase-s13/functions && cat > /tmp/_wk_check.mjs <<'EOF2'
/* LỆNH #24 — chỉ đọc: worker 2026-09-05 (uid giải mã, checkReplies) + luồng comment-lead */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const toMs = v => v && v.toMillis ? v.toMillis() : (v && v._seconds ? v._seconds * 1000 : (typeof v === 'number' ? v : 0));
const vn = ms => ms ? new Date(ms + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ') : '—';
const D7 = Date.now() - 7 * 86400e3;
// 1) VPS + phiên bản worker
const ws = await db.collection('workers').get();
ws.forEach(d => { const x = d.data() || {}; console.log('VPS', d.id, '| v' + (x.version || '?'), '| online', x.online, '| lastSeen', vn(toMs(x.lastSeen)), '| inboxCheck', x.inboxCheck, '| running', x.running + '/' + x.maxConcurrent, '| RAM', x.ramUsedPct + '%'); });
// 2) thread: uid có sẵn / giải mã / thiếu (chỉ thread đã inbox)
const th = await db.collection('outreach_threads').get();
let inboxed = 0, hasUid = 0, resolved = 0, noUid = 0, noUidHasProfile = 0, replied = 0; const cl = [];
th.forEach(d => { const x = d.data() || {};
  const ds = Array.isArray(x.doneSteps) ? x.doneSteps : [];
  if (ds.includes('inbox')) { inboxed++; if (x.uid) { hasUid++; if (x.uidResolvedAt) resolved++; } else { noUid++; if (x.fpayload && x.fpayload.profile_url) noUidHasProfile++; } }
  if (x.replied) replied++;
  if (x.fpayload && x.fpayload.kind === 'comment') cl.push({ id: d.id, step: x.step, active: x.active, tries: x.tries || 0, taskStatus: x.taskStatus, done: ds.join('>'), err: String(x.lastError || '').slice(0, 90), nextAt: vn(Number(x.nextAt) || 0) });
});
console.log('\nTHREAD đã inbox:', inboxed, '| có uid', hasUid, '(trong đó giải mã bởi worker mới:', resolved + ')', '| thiếu uid', noUid, '(có profile_url để giải mã:', noUidHasProfile + ')', '| đã phản hồi (mọi thời điểm)', replied);
console.log('→ kỳ vọng sau vài phiên: "giải mã bởi worker mới" tăng, "thiếu uid có profile_url" giảm dần (checkReplies giải mã 5 thread/nick/giờ).');
// 3) checkReplies theo nick
const fa = await db.collection('fb_accounts').get();
fa.forEach(d => { const x = d.data() || {}; if (x.engine !== 'adspower') return; console.log('nick', d.id, '|', x.label || '', '| active', x.active, '| replyCheckAt', vn(Number(x.replyCheckAt) || 0), '| replyFound', x.replyFound || 0, '| needLogin', !!x.needLogin, '| safety', x.safety == null ? '—' : x.safety); });
// 4) log reply 7 ngày (từ worker: text "qua inbox")
const lg = await db.collection('outreach_log').where('status', '==', 'reply').orderBy('at', 'desc').limit(20).get().catch(e => { console.log('log reply: cần index status+at? ', e.message.slice(0, 80)); return null; });
if (lg) { let n = 0; lg.forEach(d => { const x = d.data() || {}; if (toMs(x.at) < D7) return; n++; console.log('  reply', vn(toMs(x.at)), '| lead', x.leadId, '| nick', x.pid, '|', String(x.text || '').slice(0, 60)); }); console.log('log reply 7 ngày:', n); }
// 5) luồng comment-lead
console.log('\nCOMMENT-LEAD threads:', cl.length);
cl.slice(0, 20).forEach(c => console.log('  ', c.id, '| step', c.step, '| active', c.active, '| tries', c.tries, '| task', c.taskStatus, '| done', c.done || '—', '| nextAt', c.nextAt, c.err ? '| lỗi: ' + c.err : ''));
const dead = await db.collection('outreach_tasks').where('status', '==', 'dead').limit(50).get().catch(() => null);
if (dead) { let n = 0; dead.forEach(d => { const x = d.data() || {}; if (x.payload && x.payload.kind === 'comment') { n++; console.log('  DEAD comment-lead task', d.id, '|', String(x.lastError || '').slice(0, 100)); } }); console.log('dead-letter comment-lead:', n); }
console.log('\nKẾT LUẬN: gửi em nguyên output này.');
EOF2
node /tmp/_wk_check.mjs
```
- Chỉ đọc, không ghi gì. Nếu dòng "log reply" báo cần index thì bỏ qua mục 4 (mục 3 `replyFound` đủ để nghiệm thu).
