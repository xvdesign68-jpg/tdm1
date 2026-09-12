# LỆNH #47c (12/09/2026) — CHỈ ĐỌC. Chạy lại 3 mục của #47 bị DEADLINE_EXCEEDED 300 s (scans 7 ngày · leads 30 ngày · scanned_posts 3 ngày)
# theo TRANG + select(), thêm N2 (nguồn URL slug/không-group), G2 (scan_jobs/bd_month). Output: màn hình + ~/scan-data-0912c.txt
# Dán nguyên khối này vào Cloud Shell (bash tương tác): bash /tmp/l47c.sh
set -u
cd ~/firebase-s13/functions || { echo "KHONG CO ~/firebase-s13/functions"; exit 1; }
cat > _l47c_data.mjs <<'EOM'
/* LỆNH #47c (12/09/2026) — CHỈ ĐỌC. Chạy lại 3 mục của #47 bị DEADLINE_EXCEEDED (scans 7 ngày · leads 30 ngày · scanned_posts 3 ngày)
   theo TRANG 200–300 doc + select() chỉ field cần (bài học LỆNH #36/#37: đọc nguyên collection lớn 1 lần → 300 s timeout).
   + bổ sung: danh sách nguồn URL slug / không phải group (H1), scan_jobs không cần startedAt, bd_month.
   Đặt trong ~/firebase-s13/functions. Chạy: node _l47c_data.mjs → in màn hình + ~/scan-data-0912c.txt. KHÔNG ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { appendFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OUTF = homedir() + '/scan-data-0912c.txt'; writeFileSync(OUTF, '');
const OFF = 7 * 3600e3, now = Date.now(), H = 3600e3, D = 86400e3;
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const mask = s => String(s || '').replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>').replace(/\s+/g, ' ').slice(0, 170);
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
const gidOf = u => ((String(u || '').match(/facebook\.com\/groups\/([^\/\?#]+)/) || [])[1] || '');
const pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 + '%' : '—';
const med = arr => { const a = arr.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const p95 = arr => { const a = arr.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] : null; };
const cnt = (arr, f) => { const o = {}; arr.forEach(x => { const k = f(x); o[k] = (o[k] || 0) + 1; }); return o; };
const topN = (o, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + ' ' + v).join(' · ');
const L = t => { console.log(t); appendFileSync(OUTF, t + '\n'); };
const HD = t => L('\n=== ' + t + ' ===');
const safe = async (label, fn) => { const t0 = Date.now(); try { await fn(); L('  (' + label + ' ' + Math.round((Date.now() - t0) / 1000) + ' s)'); } catch (e) { L('  ✗ ' + label + ': ' + mask(e.message)); } };
// đọc theo trang: q đã có orderBy; fields = select() (PHẢI chứa field orderBy để startAfter hoạt động)
async function paged(q, fields, pageSize, max, onDoc) {
  let last = null, n = 0;
  while (n < max) {
    let qq = q.limit(Math.min(pageSize, max - n)); if (fields && fields.length) qq = qq.select(...fields); if (last) qq = qq.startAfter(last);
    const s = await qq.get(); if (s.empty) break;
    s.docs.forEach(d => { onDoc(d); n++; }); last = s.docs[s.docs.length - 1]; if (s.size < pageSize) break;
  }
  return n;
}
L('== LỆNH #47c dữ liệu — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');

// ---------- nguồn: dạng URL (H1) ----------
let sources = [], srcByName = {}, brandByGid = {};
await safe('sources', async () => {
  HD('N2. nguồn theo dạng URL (H1 slug ↔ số)');
  const ss = await db.collection('sources').get(); sources = ss.docs.map(d => ({ id: d.id, ...d.data() }));
  sources.forEach(s => { srcByName[s.name] = s; const g = gidOf(s.url); if (g) (brandByGid[g] = brandByGid[g] || []).push({ brand: s.brand || '' }); });
  const form = u => { const g = gidOf(u); return !g ? 'không-group' : /^\d+$/.test(g) ? 'số' : 'slug'; };
  ['không-group', 'slug'].forEach(k => { const a = sources.filter(s => form(s.url) === k); L('  ' + k + ' (' + a.length + '):'); a.forEach(s => L('   [' + (s.brand || '-') + '] ' + (s.active === false ? '(tắt) ' : '') + String(s.name).slice(0, 30) + ' · ' + String(s.url || '').slice(0, 90) + ' · id=' + s.id + (s.groupId ? ' · groupId=' + s.groupId : ''))); });
  L('  id nguồn không phải gid (' + sources.filter(s => s.id !== gidOf(s.url).replace(/[^\w-]/g, '_').slice(0, 400)).length + '): ' + sources.filter(s => s.id !== gidOf(s.url).replace(/[^\w-]/g, '_').slice(0, 400)).slice(0, 12).map(s => s.id).join(', '));
});

// ---------- scan_jobs / bd_month (sửa) ----------
await safe('scan_jobs+bd_month', async () => {
  HD('G2. scan_jobs · bd_month');
  const sj = await db.collection('scan_jobs').limit(60).get(); const js = sj.docs.map(d => ({ id: d.id, ...d.data() }));
  const tsOf = j => ms(j.startedAt || j.createdAt || j.at || j.updatedAt); js.sort((a, b) => tsOf(b) - tsOf(a));
  L('  scan_jobs (' + js.length + ' doc đọc): field ' + [...new Set(js.flatMap(j => Object.keys(j)))].sort().join(', '));
  L('  status ' + JSON.stringify(cnt(js, j => j.status || j.phase || '?')) + ' · trigger ' + JSON.stringify(cnt(js, j => j.trigger || '?')) + ' · running >30′: ' + js.filter(j => (j.status === 'running' || (j.phase && j.phase !== 'done')) && now - tsOf(j) > 30 * 60000).length + ' · mới nhất ' + (js[0] ? hm(tsOf(js[0])) : '—'));
  const bm = await db.collection('bd_month').get(); const ids = bm.docs.map(d => d.id).sort(); const last = bm.docs.find(d => d.id === ids[ids.length - 1]);
  L('  bd_month: ' + ids.join(', ') + (last ? ' · ' + last.id + ' field: ' + Object.keys(last.data()).sort().join(', ') + ' · src: ' + Object.keys(last.data().src || {}).length + ' · bdPostRecords ' + last.data().bdPostRecords + ' · bdCommentRecords ' + last.data().bdCommentRecords + ' · aiUsd ' + last.data().aiUsd : ''));
});

// ---------- R3: scans 7 ngày (scalar theo trang) + bySource 24h ----------
let scans = [];
await safe('scans', async () => {
  HD('R3/T. scans 7 ngày (trang 200, chỉ field số)');
  const F = ['at', 'trigger', 'durationMs', 'bdRecords', 'postsFetched', 'skippedSeen', 'leadsCreated', 'hotLeads', 'costUsd', 'sweepRuns', 'probeEscalated', 'probeIdle', 'commentsFetched', 'bdCommentRecords', 'commentsRefreshSkipped', 'scrapeErrors', 'scoreErrors', 'llmOk', 'llmFail', 'llmDeferred', 'llmFallback', 'llmRescored', 'llmPreFail', 'backfillSkipped', 'candidates', 'sourcesCount', 'aborted'];
  const n = await paged(db.collection('scans').where('at', '>=', new Date(now - 7 * D)).orderBy('at', 'desc'), F, 200, 4000, d => scans.push({ id: d.id, ...d.data() }));
  scans.sort((a, b) => ms(b.at) - ms(a.at));
  L('  lượt 7 ngày: ' + n + ' · trigger ' + JSON.stringify(cnt(scans, s => s.trigger || '?')) + ' · có field llm*: ' + scans.filter(s => 'llmOk' in s).length);
  const durs = scans.map(s => (s.durationMs || 0) / 1000); L('  duration s: trung vị ' + med(durs) + ' · p95 ' + p95(durs) + ' · max ' + Math.round(Math.max(0, ...durs)) + ' · >120 s: ' + durs.filter(x => x > 120).length + ' · >600 s: ' + durs.filter(x => x > 600).length + ' · >1500 s: ' + durs.filter(x => x > 1500).length);
  const gaps = []; for (let i = 0; i + 1 < scans.length; i++) { const g = (ms(scans[i].at) - ms(scans[i + 1].at)) / 60000; if (g > 0 && g < 120) gaps.push(g); }
  L('  khoảng cách 2 lượt (phút): trung vị ' + (med(gaps) != null ? Math.round(med(gaps) * 10) / 10 : '—') + ' · p95 ' + (p95(gaps) != null ? Math.round(p95(gaps) * 10) / 10 : '—') + ' · >6′: ' + gaps.filter(g => g > 6).length + ' · >15′: ' + gaps.filter(g => g > 15).length + '  ← T: tick thật vs lịch 3′');
  const sum = k => scans.reduce((a, s) => a + (Number(s[k]) || 0), 0);
  L('  Σ bdRecords ' + sum('bdRecords') + ' · Σ postsFetched ' + sum('postsFetched') + ' · record dư (bd−posts)/bd = ' + pct(sum('bdRecords') - sum('postsFetched'), sum('bdRecords')) + ' · Σ skippedSeen ' + sum('skippedSeen') + ' · Σ candidates ' + sum('candidates') + ' · Σ leadsCreated ' + sum('leadsCreated') + ' · Σ hotLeads ' + sum('hotLeads') + ' · Σ costUsd ' + Math.round(sum('costUsd') * 100) / 100);
  L('  sweepRuns>0: ' + scans.filter(s => s.sweepRuns > 0).length + ' lượt, trong đó bdRecords>0: ' + scans.filter(s => s.sweepRuns > 0 && s.bdRecords > 0).length + '  ← N1-3 · probeEscalated Σ ' + sum('probeEscalated') + ' · probeIdle Σ ' + sum('probeIdle'));
  L('  comment: Σ commentsFetched ' + sum('commentsFetched') + ' · Σ bdCommentRecords ' + sum('bdCommentRecords') + ' · Σ commentsRefreshSkipped ' + sum('commentsRefreshSkipped') + ' · lượt có comment>0: ' + scans.filter(s => s.commentsFetched > 0).length);
  L('  lỗi: Σ scrapeErrors ' + sum('scrapeErrors') + ' · Σ scoreErrors ' + sum('scoreErrors') + ' · llmOk/llmFail/llmDeferred/llmFallback/llmRescored/llmPreFail = ' + ['llmOk', 'llmFail', 'llmDeferred', 'llmFallback', 'llmRescored', 'llmPreFail'].map(sum).join('/') + ' · Σ backfillSkipped ' + sum('backfillSkipped') + ' · aborted ' + scans.filter(s => s.aborted).length);
  const pure = scans.filter(s => !(s.bdRecords > 0) && !(s.postsFetched > 0) && !(s.candidates > 0) && !(s.commentsFetched > 0)); L('  T/H7: lượt thuần skip: ' + pure.length + '/' + scans.length + ' (' + pct(pure.length, scans.length) + ')');
  const man = scans.filter(s => s.trigger && s.trigger !== 'scheduled'); L('  lượt KHÔNG theo lịch: ' + man.length + ' · có bdRecords>0: ' + man.filter(s => s.bdRecords > 0).length + ' · có lead: ' + man.filter(s => s.leadsCreated > 0).length + '  ← N3-2');
  const byHour = {}; scans.forEach(s => { const h = new Date(ms(s.at) + OFF).getUTCHours(); const o = byHour[h] = byHour[h] || { n: 0, posts: 0, leads: 0, dur: [] }; o.n++; o.posts += s.postsFetched || 0; o.leads += s.leadsCreated || 0; o.dur.push((s.durationMs || 0) / 1000); });
  L('  theo giờ VN (lượt/bài/lead/dur trung vị): ' + Object.keys(byHour).sort((a, b) => a - b).map(h => h + 'h ' + byHour[h].n + '/' + byHour[h].posts + '/' + byHour[h].leads + '/' + Math.round(med(byHour[h].dur) || 0)).join(' · '));
  const byDay = {}; scans.forEach(s => { const k = new Date(ms(s.at) + OFF).toISOString().slice(5, 10); const o = byDay[k] = byDay[k] || { n: 0, posts: 0, leads: 0, bd: 0 }; o.n++; o.posts += s.postsFetched || 0; o.leads += s.leadsCreated || 0; o.bd += s.bdRecords || 0; });
  L('  theo ngày (lượt/bài/record/lead): ' + Object.keys(byDay).sort().map(k => k + ' ' + byDay[k].n + '/' + byDay[k].posts + '/' + byDay[k].bd + '/' + byDay[k].leads).join(' · '));
  // bySource chỉ 24h (doc nặng)
  const perSrc = {}; let n24 = 0, cap30 = 0, cmtRows = 0, bdErr = 0;
  await paged(db.collection('scans').where('at', '>=', new Date(now - 1 * D)).orderBy('at', 'desc'), ['at', 'bySource'], 100, 600, d => { n24++; const s = d.data(); const bs = Array.isArray(s.bySource) ? s.bySource : Object.values(s.bySource || {}); let anyErr = false; bs.forEach(r => { const o = perSrc[r.name || r.url] = perSrc[r.name || r.url] || { runs: 0, posts: 0, bd: 0, leads: 0, hot: 0, err: 0, ok: 0, skip: 0, lastPost: 0 }; o.runs++; o.posts += r.posts || 0; o.bd += r.bdPosts || 0; o.leads += r.leads || 0; o.hot += r.hot || 0; if (r.error) o.err++; if (r.bd === 'ok') o.ok++; if (r.bd === 'skip') o.skip++; if ((r.posts || 0) > 0) o.lastPost = Math.max(o.lastPost, ms(s.at)); if ((r.bdComments || 0) > 0) cmtRows++; if ((r.bdComments || 0) >= 30) cap30++; if (/429|rate|limit|too many|not active/i.test(String(r.error || ''))) anyErr = true; }); if (anyErr) bdErr++; });
  L('  bySource 24h (' + n24 + ' lượt) — theo nguồn (lượt · bài · record · lead · nóng · lỗi · gieo ok · lần cuối có bài):');
  Object.entries(perSrc).sort((a, b) => b[1].posts - a[1].posts).forEach(([nm, o]) => L('   ' + String(nm).slice(0, 34).padEnd(34) + ' ' + o.runs + ' · ' + o.posts + ' · ' + o.bd + ' · ' + o.leads + ' · ' + o.hot + ' · lỗi ' + o.err + ' · ok ' + o.ok + ' · ' + (o.lastPost ? hm(o.lastPost) : 'chưa có bài') + (srcByName[nm] ? '' : ' · (KHÔNG khớp tên nguồn hiện tại)')));
  L('  nguồn bật nhưng 0 bài 24h: ' + sources.filter(s => s.active !== false && !(perSrc[s.name] && perSrc[s.name].posts)).map(s => s.name).join(', ') + '  ← S9');
  L('  H8: dòng nguồn có record comment ' + cmtRows + ' · ≥30/lượt: ' + cap30 + ' · lượt có lỗi BrightData 429/rate/not active: ' + bdErr);
});

// ---------- R4: leads 30 ngày (trang 300 + select) ----------
let leads = [];
await safe('leads', async () => {
  HD('R4/B. leads 30 ngày (trang 300, select)');
  const F = ['detected_at', 'brand', 'brand_pending', 'temp', 'kind', 'ai_scored', 'rescored_at', 'rescore_tries', 'dropped', 'dropped_by', 'dropped_at', 'lost', 'closed_at', 'first_care_at', 'assignee', 'stage', 'last_touch_at', 'group_count', 'identityKey', 'author_url', 'touches', 'phone', 'phone_has_zalo', 'email', 'post_id', 'comment_id', 'comment_url', 'time', 'source', 'zalo_notified', 'brand_tagged_by', 'role', 'self_comment', 'outreach', 'outreach_replied', 'score', 'text'];
  const n = await paged(db.collection('leads').where('detected_at', '>=', new Date(now - 30 * D)).orderBy('detected_at', 'desc'), F, 300, 4000, d => leads.push({ id: d.id, ...d.data() }));
  L('  lead 30 ngày: ' + n + (n >= 4000 ? ' (đụng trần)' : '') + ' · brand ' + JSON.stringify(cnt(leads, l => l.brand || (l.brand_pending ? '(pending)' : '(rỗng)'))) + ' · temp ' + JSON.stringify(cnt(leads, l => l.temp || '?')) + ' · kind ' + JSON.stringify(cnt(leads, l => l.kind || 'post')));
  const fb = leads.filter(l => l.ai_scored === false); const fbOpen = fb.filter(l => !l.dropped && !l.lost && !l.closed_at);
  L('  ai_scored:false: ' + fb.length + ' (mở ' + fbOpen.length + ') · rescored_at 48h: ' + leads.filter(l => ms(l.rescored_at) > now - 2 * D).length + ' · rescored tổng: ' + leads.filter(l => l.rescored_at).length + ' · rescore_tries>0 chưa xong: ' + leads.filter(l => (l.rescore_tries || 0) > 0 && l.ai_scored === false).length);
  L('  dropped_by: ' + JSON.stringify(cnt(leads.filter(l => l.dropped), l => l.dropped_by || '(rỗng)')) + ' · lost ' + leads.filter(l => l.lost).length + ' · closed ' + leads.filter(l => l.closed_at).length + ' · stage ' + JSON.stringify(cnt(leads, l => l.stage || '?')));
  const resc = leads.filter(l => l.rescored_at); const hum = resc.filter(l => l.first_care_at || l.assignee || (l.stage && l.stage !== 'new') || l.last_touch_at);
  L('  N4-3: lead AI chấm lại ' + resc.length + ' → loại ' + resc.filter(l => l.dropped).length + ' · có người thật chăm ' + hum.length + ' → trong đó temp=junk ' + hum.filter(l => l.temp === 'junk').length + ' · dropped ' + hum.filter(l => l.dropped).length + '  (đang bị giấu khỏi feed/Hộp việc)');
  hum.slice(0, 8).forEach(l => L('   ' + l.id + ' · ' + (l.brand || '-') + ' · ' + l.score + ' ' + l.temp + ' · stage ' + l.stage + ' · assignee ' + (l.assignee || '-') + (l.dropped ? ' · LOẠI ' + l.dropped_by : '') + ' · chấm lại ' + hm(l.rescored_at)));
  L('  group_count>=2: ' + leads.filter(l => (l.group_count || 0) >= 2).length + ' · identityKey rỗng: ' + pct(leads.filter(l => !l.identityKey).length, leads.length) + ' · author_url có: ' + pct(leads.filter(l => l.author_url).length, leads.length) + ' · uid số trong author_url: ' + pct(leads.filter(l => /profile\.php\?id=\d+|\/people\/[^\/]+\/\d+/.test(l.author_url || '')).length, leads.length));
  let mt = 0, mtMis = 0; leads.filter(l => (l.group_count || 0) >= 2 && Array.isArray(l.touches)).forEach(l => { mt++; l.touches.forEach(t => { const s = srcByName[t && t.source]; if (s && s.brand && l.brand && s.brand !== l.brand) mtMis++; }); }); L('  B3. multitouch: lead gộp ' + mt + ' · touch từ nguồn brand KHÁC brand lead: ' + mtMis);
  const ph = leads.filter(l => l.phone); L('  phone: ' + pct(ph.length, leads.length) + ' · cố định (+842x/02x): ' + ph.filter(l => /^(\+?84|0)2/.test(String(l.phone))).length + ' · phone_has_zalo ' + JSON.stringify(cnt(ph, l => String(l.phone_has_zalo))) + ' · email ' + leads.filter(l => l.email).length);
  L('  post_id rỗng: ' + leads.filter(l => !l.post_id).length + ' · comment_id (lead comment): ' + JSON.stringify(cnt(leads.filter(l => l.kind === 'comment'), l => !l.comment_id ? 'rỗng' : /^\d+$/.test(String(l.comment_id)) ? 'số' : /^[A-Za-z0-9+\/=_-]{16,}$/.test(String(l.comment_id)) ? 'base64' : 'khác')) + ' · comment_url rỗng: ' + leads.filter(l => l.kind === 'comment' && !l.comment_url).length);
  const lag = leads.map(l => { const t = Date.parse(l.time || ''); const d = ms(l.detected_at); return (t && d) ? (d - t) / 60000 : NaN; }).filter(Number.isFinite);
  L('  Q-4/T: lag phát hiện (detected_at − time bài) phút: trung vị ' + (med(lag) != null ? Math.round(med(lag)) : '—') + ' · p95 ' + (p95(lag) != null ? Math.round(p95(lag)) : '—') + ' · <1′: ' + pct(lag.filter(x => x < 1).length, lag.length) + ' · <15′: ' + pct(lag.filter(x => x < 15).length, lag.length) + ' · >60′: ' + pct(lag.filter(x => x > 60).length, lag.length) + ' · n=' + lag.length + '  ← tốc độ post→lead hôm nay');
  const byS = {}; leads.forEach(l => { const t = Date.parse(l.time || ''), d = ms(l.detected_at); if (t && d) (byS[l.source] = byS[l.source] || []).push((d - t) / 60000); }); L('  lag trung vị theo nguồn (phút): ' + Object.entries(byS).map(([s, a]) => String(s).slice(0, 18) + ' ' + Math.round(med(a))).slice(0, 14).join(' · '));
  const cand = leads.filter(l => l.kind !== 'comment' && String(l.text || '').length >= 80).slice(0, 1500).map(l => ({ id: l.id, b: l.brand, at: ms(l.detected_at), w: new Set(fold(String(l.text).slice(0, 300)).split(/[^a-z0-9]+/).filter(x => x.length > 1)) }));
  let dup = 0; const seenPair = new Set(); for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) { const a = cand[i], b = cand[j]; if (a.b !== b.b || Math.abs(a.at - b.at) > 14 * D) continue; let inter = 0; a.w.forEach(x => { if (b.w.has(x)) inter++; }); const jac = inter / (a.w.size + b.w.size - inter || 1); if (jac >= 0.8) { dup++; seenPair.add(a.id); seenPair.add(b.id); } }
  L('  Q-1: cặp lead cùng brand ≤14 ngày text trùng ≥0,8 (bài, ≥80 ký tự): ' + dup + ' cặp · lead dính: ' + seenPair.size + '/' + cand.length);
  const hot7 = leads.filter(l => l.temp === 'hot' && ms(l.detected_at) > now - 7 * D); L('  R6c: lead nóng 7 ngày ' + hot7.length + ' · zalo_notified ' + JSON.stringify(cnt(hot7, l => String(l.zalo_notified))) + ' · brand_tagged_by ' + JSON.stringify(cnt(hot7, l => l.brand_tagged_by || '(không)')) + ' · brand_pending ' + hot7.filter(l => l.brand_pending).length);
  L('  role: ' + JSON.stringify(cnt(leads, l => l.role || '(rỗng)')) + ' · self_comment ' + leads.filter(l => l.self_comment).length + ' · outreach chạm ' + leads.filter(l => l.outreach && l.outreach.at).length + ' · outreach_replied ' + leads.filter(l => l.outreach_replied).length);
  const byBrandDay = {}; leads.forEach(l => { const k = (l.brand || '-') + ' ' + new Date(ms(l.detected_at) + OFF).toISOString().slice(5, 10); byBrandDay[k] = (byBrandDay[k] || 0) + 1; }); L('  lead/ngày 7 ngày gần nhất theo brand: ' + Object.entries(byBrandDay).filter(([k]) => ms(new Date('2026-' + k.split(' ')[1])) > now - 8 * D).sort().map(([k, v]) => k + ':' + v).join(' · '));
});

// ---------- R5: scanned_posts 3 ngày (trang 300 + select, không text) ----------
await safe('scanned_posts', async () => {
  HD('R5. scanned_posts 3 ngày (trang 300, select)');
  const sp = []; const n = await paged(db.collection('scanned_posts').where('createdAt', '>=', new Date(now - 3 * D)).orderBy('createdAt', 'desc'), ['createdAt', 'decision', 'kind', 'brand', 'source', 'parent_url', 'post_url', 'score', 'role'], 300, 8000, d => sp.push({ id: d.id, ...d.data() }));
  L('  doc: ' + n + (n >= 8000 ? ' (đụng trần)' : '') + ' (' + (sp.length ? hm(sp[sp.length - 1].createdAt) + ' → ' + hm(sp[0].createdAt) : '') + ') · decision ' + JSON.stringify(cnt(sp, x => x.decision || '?')) + ' · kind ' + JSON.stringify(cnt(sp, x => x.kind || 'post')) + ' · brand ' + JSON.stringify(cnt(sp, x => x.brand || '(rỗng)')));
  const bySrc = {}; sp.forEach(x => { const o = bySrc[x.source] = bySrc[x.source] || { n: 0, ex: 0, pre: 0, lead: 0, low: 0, role: 0, wait: 0 }; o.n++; if (x.decision === 'excluded' || x.decision === 'no_keyword') o.ex++; if (x.decision === 'prefiltered_out') o.pre++; if (x.decision === 'lead') o.lead++; if (x.decision === 'scored_low') o.low++; if (x.decision === 'seller' || x.decision === 'self_comment') o.role++; if (x.decision === 'ai_wait') o.wait++; });
  L('  theo nguồn (n · exclude · tầng1 loại · lead · thấp · vai · ai_wait):'); Object.entries(bySrc).sort((a, b) => b[1].n - a[1].n).forEach(([s, o]) => L('   ' + String(s).slice(0, 34).padEnd(34) + ' ' + o.n + ' · ' + o.ex + ' · ' + o.pre + ' · ' + o.lead + ' · ' + o.low + ' · ' + o.role + ' · ' + o.wait));
  const cm = sp.filter(x => x.kind === 'comment'); let mis = 0, orphan = 0; cm.forEach(x => { const g = gidOf(x.parent_url); const bs = g ? (brandByGid[g] || []) : []; if (!g || !bs.length) orphan++; else if (x.brand && !bs.some(b => b.brand === x.brand)) mis++; });
  L('  N3-7/N1-4: comment ' + cm.length + ' · parent_url không thuộc nguồn nào: ' + orphan + ' · brand doc ≠ brand nguồn theo gid(parent_url): ' + mis);
  const waitDup = Object.values(cnt(sp.filter(x => x.decision === 'ai_wait'), x => x.post_url)).filter(k => k > 1).length; L('  N2-10: bài ai_wait lặp >1 dòng: ' + waitDup);
  const dupUrl = Object.values(cnt(sp.filter(x => x.kind !== 'comment' && x.post_url), x => x.post_url)).filter(k => k > 1).length; L('  bài (post) có >1 dòng scanned_posts trong 3 ngày: ' + dupUrl + '  ← chấm đôi / quét lại?');
  const ex = await db.collection('scanned_posts').where('decision', '==', 'excluded').limit(6).select('brand', 'text', 'source').get(); L('  mẫu 6 bài bị exclude (text 90 ký tự):'); ex.docs.forEach(d => { const x = d.data(); L('   [' + (x.brand || '-') + ' · ' + String(x.source || '').slice(0, 18) + '] ' + mask(String(x.text || '').slice(0, 90))); });
});
L('\n== XONG — file: ' + OUTF + ' (dán nguyên output vào chat) ==');
EOM
node --check _l47c_data.mjs && echo "SYNTAX OK" || { echo "SYNTAX LOI"; exit 1; }
node _l47c_data.mjs 2>&1
echo "exit=$?  (file: ~/scan-data-0912c.txt — dán nguyên output vào chat)"
