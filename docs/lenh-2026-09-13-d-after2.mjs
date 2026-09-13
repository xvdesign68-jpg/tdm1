/* LỆNH D KHỐI 2 — BẢN 2 (13/09/2026 ~10:30 VN) — CHỈ ĐỌC. Đặt trong ~/firebase-s13/functions (ghi đè _ld_after.mjs). Không ghi gì.
   Bản 1 (nhúng trong lenh-2026-09-13-d.sh) LỖI ở mục 2b lúc 10:03 VN: pageAll() select() KHÔNG kèm field đang orderBy → startAfter(doc) ném
   "Field "at" is missing in the provided DocumentSnapshot" (bài học lặp lại: select PHẢI kèm field orderBy). Mục 1 + 2a đã in đúng (TTL ACTIVE, 10/10 lượt bản D).
   Bản 2: (a) pageAll tự thêm field orderBy vào select; (b) mỗi mục bọc try/catch — 1 mục lỗi in "LỖI" rồi chạy tiếp; (c) mục 5 bỏ where kind== (tránh đòi composite index), lọc client;
   (d) THÊM mục 6: lead SAU #48 (12/09 08:53Z) có author_uid/author_url theo bài/bình luận — đóng mục "còn theo dõi" của LỆNH #48 (comment-lead phải có author_url).
   In: (1) TTL policy scans/seen · (2) scans 10 lượt gần nhất + 24 h orphan/byId/too_old · (3) scans/seen thiếu expireAt (mẫu 3.000 doc đầu theo id) · (4) scanned_posts 24 h: decision, ai_wait trùng, prefiltered +14d
   · (5) PB-12 (0): bình luận 7 ngày gid(bài cha) ≠ gid(nguồn) · (6) lead sau #48: author_uid/author_url. Đọc theo TRANG ≤300 + select(). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now(), DAY = 864e5;
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const dd = v => ms(v) ? Math.round((ms(v) - now) / DAY) : null;
const gidOf = u => { const m = /facebook\.com\/groups\/([^/?#]+)/i.exec(String(u || '')); return m ? m[1].toLowerCase() : ''; };
/* select() LUÔN kèm field orderBy (trừ __name__) — nếu không, startAfter(doc) thiếu field → lỗi (bài học bản 1) */
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null;
  const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last);
    const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
const sec = async (label, fn) => { try { await fn(); } catch (e) { console.log(label + ' LỖI (mục này bỏ qua, mục sau vẫn chạy): ' + String(e && e.message).slice(0, 220)); } };
console.log('== LỆNH D KHỐI 2 (bản 2) — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
// 1. TTL policy
await sec('1.', async () => {
  let out = ''; try { out = execSync('gcloud firestore fields ttls list --project=smartlead-z15 --format="value(name,ttlConfig.state)" 2>/dev/null', { encoding: 'utf8' }); }
  catch (e) { console.log('1. TTL policy: không đọc được qua gcloud (' + String(e && e.message).slice(0, 80) + ') — kiểm ở console Firestore → TTL'); return; }
  const rows = out.split('\n').filter(Boolean).map(l => l.replace(/^.*collectionGroups\//, '').replace(/\/fields\//, '.')); const pick = k => rows.find(r => r.startsWith(k)) || k + ' — CHƯA có';
  console.log('1. TTL policy: ' + pick('scans.expireAt') + ' · ' + pick('seen.expireAt') + '  (kỳ vọng: ACTIVE)');
});
// 2. scans gần nhất + 24 h
await sec('2.', async () => {
  const sc = (await db.collection('scans').orderBy('at', 'desc').limit(10).select('at', 'trigger', 'cmtOrphan', 'cmtById', 'tooOld', 'commentsFetched', 'expireAt', 'status', 'postsFetched', 'leadsCreated').get()).docs.map(d => d.data());
  console.log('2. scans 10 lượt gần nhất (giờ VN · loại · bài/lead · cmt gặt · orphan/byId · tooOld · expireAt +ngày):');
  sc.forEach(s => console.log('   ' + hm(s.at) + ' ' + String(s.trigger || '').padEnd(9) + (s.status === 'aborted' ? 'ABORTED ' : '') + (s.postsFetched || 0) + '/' + (s.leadsCreated || 0) + ' · cmt ' + (s.commentsFetched || 0) + ' · orphan ' + (s.cmtOrphan == null ? '(cũ)' : s.cmtOrphan) + '/' + (s.cmtById == null ? '-' : s.cmtById) + ' · tooOld ' + (s.tooOld == null ? '(cũ)' : s.tooOld) + ' · exp ' + (dd(s.expireAt) == null ? 'THIẾU' : '+' + dd(s.expireAt) + 'd')));
  const withD = sc.filter(s => s.cmtOrphan != null); console.log('   → ' + withD.length + '/10 lượt là bản D (có cmtOrphan) · kỳ vọng: lượt sau deploy đều có expireAt ≈ +90d');
  const d24 = await pageAll(db.collection('scans').where('at', '>=', new Date(now - 24 * 3600e3)), 'at', ['cmtOrphan', 'cmtById', 'tooOld', 'commentsFetched', 'leadsCreated'], 1500);
  const o = d24.reduce((a, s) => { a.orphan += Number(s.cmtOrphan) || 0; a.byId += Number(s.cmtById) || 0; a.cmt += Number(s.commentsFetched) || 0; a.old += Number(s.tooOld) || 0; a.lead += Number(s.leadsCreated) || 0; if (s.cmtOrphan != null) a.d++; return a; }, { orphan: 0, byId: 0, cmt: 0, old: 0, lead: 0, d: 0 });
  console.log('   24 h: ' + d24.length + ' lượt (bản D ' + o.d + ') · lead ' + o.lead + ' · bình luận gặt ' + o.cmt + ' · orphan ' + o.orphan + (o.cmt + o.orphan ? ' (' + Math.round(o.orphan * 1000 / (o.cmt + o.orphan)) / 10 + ' % — PB-12 (0): >10 % thì gửi em mẫu post_url để nới urlKey)' : ' (chưa có bình luận gặt từ bản D → chưa đo được orphan, chạy lại sau khi có lượt cmt > 0)') + ' · khớp theo id số ' + o.byId + ' · too_old ' + o.old);
});
// 3. thiếu expireAt
await sec('3.', async () => {
  const s3 = await pageAll(db.collection('scans'), '__name__', ['expireAt'], 3000); const m3 = s3.filter(x => !x.expireAt).length;
  const e3 = await pageAll(db.collection('seen'), '__name__', ['expireAt'], 3000); const m4 = e3.filter(x => !x.expireAt).length;
  let total = '?'; try { total = (await db.collection('seen').count().get()).data().count; } catch (e) {}
  console.log('3. thiếu expireAt (mẫu 3.000 doc đầu theo id): scans ' + m3 + '/' + s3.length + ' · seen ' + m4 + '/' + e3.length + ' (tổng seen ' + total + ')  (kỳ vọng: 0 sau backfill; còn = chạy lại node _ld_backfill.mjs)');
});
// 4. scanned_posts 24 h
await sec('4.', async () => {
  const sp = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', new Date(now - 24 * 3600e3)), 'createdAt', ['decision', 'post_url', 'kind', 'expireAt', 'brand'], 6000);
  const by = {}; sp.forEach(p => { by[p.decision || '?'] = (by[p.decision || '?'] || 0) + 1; });
  const aw = sp.filter(p => p.decision === 'ai_wait'); const seenU = new Set(); let dup = 0; aw.forEach(p => { const k = String(p.post_url || '') + '|' + String(p.brand || ''); if (seenU.has(k)) dup++; seenU.add(k); });
  const pf = sp.filter(p => p.decision === 'prefiltered_out' && p.expireAt); const pfd = pf.length ? Math.round(pf.reduce((a, p) => a + (dd(p.expireAt) || 0), 0) / pf.length) : null;
  const pfNew = pf.filter(p => (dd(p.expireAt) || 0) >= 10).length;
  console.log('4. scanned_posts 24 h: ' + sp.length + ' doc · ' + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · ') + '\n   ai_wait trùng (cùng bài+brand) ' + dup + '  (kỳ vọng 0 sau D) · prefiltered_out ' + pf.length + ' doc, expireAt TB ' + (pfd == null ? '—' : '+' + pfd + 'd') + ', ≥+10d: ' + pfNew + '  (kỳ vọng: doc sau D ≈ +14d; doc trước D +3d)');
});
// 5. PB-12 (0): bình luận 7 ngày lệch bài cha (lọc kind ở client — không đòi composite index)
await sec('5.', async () => {
  const sp7 = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', new Date(now - 7 * DAY)), 'createdAt', ['parent_url', 'sourceUrl', 'kind'], 9000);
  const cm7 = sp7.filter(c => c.kind === 'comment');
  let lech = 0, noGid = 0; cm7.forEach(c => { const a = gidOf(c.parent_url), b = gidOf(c.sourceUrl); if (!a || !b) { noGid++; return; } if (a !== b && !(/^\d+$/.test(a) !== /^\d+$/.test(b))) lech++; });
  console.log('5. PB-12 (0) bình luận 7 ngày (trong ' + sp7.length + ' doc scanned_posts): ' + cm7.length + ' bình luận · gid(bài cha) ≠ gid(nguồn) ' + lech + (cm7.length ? ' (' + Math.round(lech * 1000 / cm7.length) / 10 + ' %)' : '') + ' · không đọc được gid ' + noGid + '  (slug↔số không tính là lệch; kỳ vọng ≈ 0 % cho doc sau D)');
});
// 6. lead SAU #48 — author_uid/author_url (đóng "còn theo dõi" LỆNH #48)
await sec('6.', async () => {
  const since = new Date('2026-09-12T08:53:00Z');
  const ls = await pageAll(db.collection('leads').where('detected_at', '>=', since), 'detected_at', ['kind', 'comment_id', 'author_url', 'author_uid', 'brand', 'name', 'source'], 3000);
  const isC = l => l.kind === 'comment' || !!l.comment_id; const post = ls.filter(l => !isC(l)), cm = ls.filter(isC);
  const uid = l => /^\d{6,}$/.test(String(l.author_uid || '')); const au = l => !!l.author_url;
  const form = u => !u ? 'trống' : /profile\.php\?id=\d+/.test(u) ? 'profile.php?id=số' : /pfbid/i.test(u) ? 'pfbid' : /\/people\//.test(u) ? '/people/' : 'username';
  const dist = arr => { const d = {}; arr.forEach(l => { const f = form(l.author_url); d[f] = (d[f] || 0) + 1; }); return JSON.stringify(d); };
  const pct = (a, b) => b ? Math.round(a * 100 / b) + ' %' : '—';
  console.log('6. lead SAU #48 (từ 12/09 15:53 VN): ' + ls.length + ' · BÀI ' + post.length + ': uid số ' + post.filter(uid).length + ' (' + pct(post.filter(uid).length, post.length) + ') · author_url ' + post.filter(au).length + ' · dạng ' + dist(post) + ' · BÌNH LUẬN ' + cm.length + ': uid số ' + cm.filter(uid).length + ' · author_url ' + cm.filter(au).length + ' (' + pct(cm.filter(au).length, cm.length) + ') · dạng ' + dist(cm));
  cm.slice(0, 10).forEach(l => console.log('   cmt ' + hm(l.detected_at) + ' ' + String(l.brand || '').padEnd(16) + ' ' + String(l.name || '').slice(0, 18).padEnd(18) + ' uid=' + (l.author_uid || '—') + ' url=' + (l.author_url ? String(l.author_url).slice(0, 72) : 'TRỐNG') + ' · nguồn ' + String(l.source || '').slice(0, 24)));
  console.log('   kỳ vọng #48: bài ≈100 % uid số (profile_id) · bình luận ≈100 % author_url (commentator_profile_url; dạng pfbid là bình thường, uid số hiếm). Bình luận TRỐNG author_url sau #48 → gửi em dòng "cmt …" đó + tên nguồn để soi record thô BrightData.');
});
console.log('== XONG (chỉ đọc) ==');
