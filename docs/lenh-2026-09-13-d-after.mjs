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
