/* LỆNH #47 (12/09/2026) — CHỈ ĐỌC. Số liệu thật cho: R3 nhật ký quét 7 ngày · R4 kho lead 30 ngày · R5 Bài đã quét 3 ngày + nguồn + config/app
   · R6 vòng nhận diện ↔ automation/push · B (1 group nhiều brand) · T (tốc độ). Đặt trong ~/firebase-s13/functions (cần firebase-admin).
   Chạy: node _l47_data.mjs  → in ra màn hình + ghi ~/scan-data-0912.txt. KHÔNG ghi gì vào Firestore. KHÔNG in secret. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OUTF = homedir() + '/scan-data-0912.txt'; writeFileSync(OUTF, '');
const OFF = 7 * 3600e3, now = Date.now(), H = 3600e3, D = 86400e3;
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const day = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(0, 10) : '—';
const mask = s => String(s || '').replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>').replace(/\s+/g, ' ').slice(0, 170);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
const gidOf = u => ((String(u || '').match(/facebook\.com\/groups\/([^\/\?#]+)/) || [])[1] || '');
const pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 + '%' : '—';
const med = arr => { const a = arr.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const p95 = arr => { const a = arr.filter(x => Number.isFinite(x)).sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] : null; };
const cnt = (arr, f) => { const o = {}; arr.forEach(x => { const k = f(x); o[k] = (o[k] || 0) + 1; }); return o; };
const topN = (o, n = 8) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + ' ' + v).join(' · ');
const L = t => { console.log(t); appendFileSync(OUTF, t + '\n'); };
const HD = t => L('\n=== ' + t + ' ===');
L('== LỆNH #47 dữ liệu — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
const safe = async (label, fn) => { try { await fn(); } catch (e) { L('  ✗ ' + label + ': ' + mask(e.message)); } };

// ---------- NGUỒN + config/app (R5 + B) ----------
let sources = [], srcByName = {}, brandByGid = {}, srcById = {};
await safe('sources', async () => {
  HD('N. sources (nguồn quét) + config/app');
  const ss = await db.collection('sources').get(); sources = ss.docs.map(d => ({ id: d.id, ...d.data() }));
  sources.forEach(s => { srcByName[s.name] = s; srcById[s.id] = s; const g = gidOf(s.url); if (g) (brandByGid[g] = brandByGid[g] || []).push({ id: s.id, brand: s.brand || '', name: s.name, active: s.active !== false }); });
  const act = sources.filter(s => s.active !== false);
  L('  nguồn ' + sources.length + ' · đang bật ' + act.length + ' · brand: ' + topN(cnt(act, s => s.brand || '(rỗng)'), 10));
  L('  field gặp: ' + [...new Set(sources.flatMap(s => Object.keys(s)))].sort().join(', '));
  const idGid = sources.filter(s => s.id === gidOf(s.url).replace(/[^\w-]/g, '_').slice(0, 400)).length;
  L('  doc id == group id: ' + idGid + '/' + sources.length + ' · id có "__": ' + sources.filter(s => s.id.includes('__')).length + ' · có field gid/groupId: ' + sources.filter(s => s.gid || s.groupId).length);
  const multi = Object.entries(brandByGid).filter(([, a]) => a.length > 1);
  L('  B1. group có >1 nguồn: ' + multi.length + (multi.length ? ' → ' + multi.map(([g, a]) => g + ' [' + a.map(x => x.brand + (x.active ? '' : '(tắt)')).join(',') + ']').join(' · ') : ''));
  const nameDup = Object.entries(cnt(sources, s => fold(s.name))).filter(([, n]) => n > 1);
  L('  B2. TÊN nguồn trùng (bỏ dấu): ' + nameDup.length + (nameDup.length ? ' → ' + nameDup.map(([k, n]) => '"' + k + '"×' + n).join(' · ') : ''));
  const urlForm = u => { const g = gidOf(u); return !g ? 'không-group' : /^\d+$/.test(g) ? 'số' : 'slug'; };
  L('  B0. dạng URL nguồn: ' + JSON.stringify(cnt(sources, s => urlForm(s.url))) + ' · có query/#: ' + sources.filter(s => /[?#]/.test(s.url || '')).length + ' · thiếu "/" cuối: ' + sources.filter(s => !/\/$/.test(String(s.url || '').split(/[?#]/)[0])).length + ' · có sharedAt: ' + sources.filter(s => s.sharedAt).length + '  ← H1: slug ↔ số cùng group?');
  L('  authAccountId còn: ' + sources.filter(s => s.authAccountId).length + ' (bật ' + sources.filter(s => s.authAccountId && s.active !== false).length + ') · aiMode riêng: ' + JSON.stringify(cnt(sources, s => s.aiMode || '(chung)')) + ' · commentMode: ' + JSON.stringify(cnt(sources, s => s.commentMode || '(full)')));
  const kwN = sources.map(s => (s.keywords || []).length), exN = sources.map(s => (s.exclude || []).length);
  L('  keywords/nguồn: trung vị ' + med(kwN) + ' max ' + Math.max(0, ...kwN) + ' · exclude/nguồn: trung vị ' + med(exN) + ' max ' + Math.max(0, ...exN));
  const allEx = [...new Set(sources.flatMap(s => s.exclude || []))]; L('  exclude gộp mọi nguồn (' + allEx.length + '): ' + allEx.slice(0, 40).join(' | ') + (allEx.length > 40 ? ' …' : ''));
  const cfg = await db.collection('config').doc('app').get(); const c = cfg.exists ? cfg.data() : {};
  L('  config/app field: ' + Object.keys(c).sort().join(', '));
  L('  keywords toàn cục: ' + ((c.keywords || []).length) + ' · exclude toàn cục: ' + ((c.exclude || []).length) + (c.exclude && c.exclude.length ? ' → ' + c.exclude.slice(0, 30).join(' | ') : '') + ' · scanIntervalMin ' + c.scanIntervalMin + ' · aiMode ' + c.aiMode + ' · scanComments ' + c.scanComments + ' · scanMethod ' + c.scanMethod + ' · autoScanEnabled ' + c.autoScanEnabled + ' · profileScanEnabled ' + c.profileScanEnabled + '/' + c.profileScanMax + ' · adaptiveScan ' + c.adaptiveScan);
});

// ---------- group_state / pending_snapshots / cmt_scrape / seen (T + B + Q-3) ----------
await safe('group_state', async () => {
  HD('G. group_state · pending_snapshots · cmt_scrape · seen · score_retry');
  const gs = await db.collection('group_state').get();
  L('  group_state: ' + gs.size + ' doc · field: ' + [...new Set(gs.docs.flatMap(d => Object.keys(d.data())))].sort().join(', '));
  const rows = gs.docs.map(d => { const g = d.data(); return { url: g.url, trig: ms(g.lastTriggerAt), sweep: ms(g.lastSweepAt), ids: (g.recentIds || []).length, idsAt: ms(g.recentIdsAt) }; });
  L('  lastTriggerAt tuổi (phút): trung vị ' + Math.round(med(rows.map(r => r.trig ? (now - r.trig) / 60000 : NaN)) || 0) + ' · max ' + Math.round(Math.max(0, ...rows.map(r => r.trig ? (now - r.trig) / 60000 : 0))) + ' · lastSweepAt tuổi (giờ): trung vị ' + med(rows.map(r => r.sweep ? Math.round((now - r.sweep) / H * 10) / 10 : NaN)) + ' · recentIds: trung vị ' + med(rows.map(r => r.ids)) + ' · đầy 200: ' + rows.filter(r => r.ids >= 200).length + '/' + rows.length);
  const ps = await db.collection('pending_snapshots').get(); const P = ps.docs.filter(d => d.id.startsWith('P_')), C = ps.docs.filter(d => d.id.startsWith('C_'));
  const age = d => { const x = d.data(); return Math.round((now - ms(x.t || x.at)) / 60000); };
  L('  pending_snapshots: bài P_ ' + P.length + ' (tuổi phút: ' + P.map(age).sort((a, b) => a - b).join(',') + ') · comment C_ ' + C.length + ' (tuổi: ' + C.map(age).sort((a, b) => a - b).join(',') + ') · >120′: ' + ps.docs.filter(d => age(d) > 120).length);
  const cs = await db.collection('cmt_scrape').orderBy('lastAt', 'desc').limit(3000).get();
  let twice = 0, q = 0; const gapH = [];
  cs.docs.forEach(d => { const x = d.data(); const f = ms(x.firstAt), l = ms(x.lastAt); if (x.qualified === true) q++; if (f && l && l - f > H) { twice++; gapH.push((l - f) / H); } });
  L('  cmt_scrape (3000 mới nhất): gieo lại ≥2 lần (lastAt−firstAt>1h) ' + twice + '/' + cs.size + ' (' + pct(twice, cs.size) + ') · qualified ' + q + ' · khoảng cách trung vị ' + (med(gapH) != null ? Math.round(med(gapH) * 10) / 10 + ' h' : '—') + '  ← Q-3: bình luận có bao giờ được quét lần 2?');
  try { const sc = await db.collection('seen').count().get(); L('  seen: ' + sc.data().count + ' doc (vĩnh viễn, không TTL)'); } catch (e) { L('  seen: count lỗi ' + mask(e.message)); }
  const rq = await db.collection('score_retry').limit(300).get(); L('  score_retry: ' + rq.size + ' · kind ' + JSON.stringify(cnt(rq.docs, d => d.data().kind || '?')) + ' · tries ' + JSON.stringify(cnt(rq.docs, d => d.data().tries || 0)));
  const sj = await db.collection('scan_jobs').orderBy('startedAt', 'desc').limit(50).get().catch(() => ({ docs: [] }));
  const run = sj.docs.filter(d => { const j = d.data(); return j.status === 'running' && now - ms(j.startedAt || j.at) > 30 * 60000; });
  L('  scan_jobs 50 gần nhất: status ' + JSON.stringify(cnt(sj.docs, d => d.data().status || '?')) + ' · running >30′ (kẹt): ' + run.length + ' · trigger ' + JSON.stringify(cnt(sj.docs, d => d.data().trigger || '?')));
});

// ---------- R3 + T: nhật ký quét 7 ngày ----------
let scans = [];
await safe('scans', async () => {
  HD('R3/T. scans 7 ngày (nhật ký lượt quét)');
  const q = await db.collection('scans').where('at', '>=', new Date(now - 7 * D)).orderBy('at', 'desc').limit(4000).get();
  scans = q.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.at) - ms(a.at));
  L('  lượt 7 ngày: ' + scans.length + ' · trigger ' + JSON.stringify(cnt(scans, s => s.trigger || '?')) + ' · field llm*: ' + scans.filter(s => 'llmOk' in s).length);
  const durs = scans.map(s => (s.durationMs || 0) / 1000); L('  duration s: trung vị ' + med(durs) + ' · p95 ' + p95(durs) + ' · max ' + Math.round(Math.max(0, ...durs)) + ' · >120 s: ' + durs.filter(x => x > 120).length + ' · >600 s: ' + durs.filter(x => x > 600).length);
  const gaps = []; for (let i = 0; i + 1 < scans.length; i++) { const g = (ms(scans[i].at) - ms(scans[i + 1].at)) / 60000; if (g > 0 && g < 120) gaps.push(g); }
  L('  khoảng cách 2 lượt (phút): trung vị ' + (med(gaps) != null ? Math.round(med(gaps) * 10) / 10 : '—') + ' · p95 ' + (p95(gaps) != null ? Math.round(p95(gaps) * 10) / 10 : '—') + ' · >6′: ' + gaps.filter(g => g > 6).length + '  ← T: tick thật vs lịch 3′');
  const sum = k => scans.reduce((a, s) => a + (Number(s[k]) || 0), 0);
  L('  Σ bdRecords ' + sum('bdRecords') + ' · Σ postsFetched ' + sum('postsFetched') + ' · record dư (bd−posts)/bd = ' + pct(sum('bdRecords') - sum('postsFetched'), sum('bdRecords')) + ' · Σ skippedSeen ' + sum('skippedSeen') + ' · Σ leadsCreated ' + sum('leadsCreated') + ' · Σ hotLeads ' + sum('hotLeads') + ' · Σ costUsd ' + Math.round(sum('costUsd') * 100) / 100);
  L('  sweepRuns>0: ' + scans.filter(s => s.sweepRuns > 0).length + ' lượt, trong đó bdRecords>0: ' + scans.filter(s => s.sweepRuns > 0 && s.bdRecords > 0).length + '  ← N1-3 sweep thật · probeEscalated Σ ' + sum('probeEscalated') + ' · probeIdle Σ ' + sum('probeIdle'));
  L('  comment: Σ commentsFetched ' + sum('commentsFetched') + ' · Σ bdCommentRecords ' + sum('bdCommentRecords') + ' · Σ commentsRefreshSkipped ' + sum('commentsRefreshSkipped') + ' · lượt có comment>0: ' + scans.filter(s => s.commentsFetched > 0).length);
  L('  lỗi: Σ scrapeErrors ' + sum('scrapeErrors') + ' · Σ scoreErrors ' + sum('scoreErrors') + ' · llmOk/llmFail/llmDeferred/llmFallback/llmRescored/llmPreFail = ' + ['llmOk', 'llmFail', 'llmDeferred', 'llmFallback', 'llmRescored', 'llmPreFail'].map(sum).join('/') + ' · Σ backfillSkipped ' + sum('backfillSkipped'));
  const pure = scans.filter(s => !(s.bdRecords > 0) && !(s.postsFetched > 0) && !(s.candidates > 0) && !(s.commentsFetched > 0)); L('  T/H7: lượt thuần skip (0 record/0 bài/0 ứng viên/0 comment): ' + pure.length + '/' + scans.length + ' (' + pct(pure.length, scans.length) + ') → doc scans có thể bỏ ghi');
  let cap30 = 0, cmtRows = 0; scans.forEach(s => { (Array.isArray(s.bySource) ? s.bySource : []).forEach(r => { if ((r.bdComments || 0) > 0) cmtRows++; if ((r.bdComments || 0) >= 30) cap30++; }); }); L('  H8: dòng nguồn có record comment ' + cmtRows + ' · chạm trần ≥30/lượt: ' + cap30 + '  (COMMENTS_PER_POST 30 — trần theo BÀI nên đây chỉ là dấu hiệu)');
  const man = scans.filter(s => s.trigger && s.trigger !== 'scheduled'); L('  lượt KHÔNG theo lịch: ' + man.length + ' · có bdRecords>0: ' + man.filter(s => s.bdRecords > 0).length + ' · có lead: ' + man.filter(s => s.leadsCreated > 0).length + '  ← N3-2 Quét ngay có gặt được không');
  const byHour = {}; scans.forEach(s => { const h = new Date(ms(s.at) + OFF).getUTCHours(); const o = byHour[h] = byHour[h] || { n: 0, posts: 0, leads: 0, dur: [] }; o.n++; o.posts += s.postsFetched || 0; o.leads += s.leadsCreated || 0; o.dur.push((s.durationMs || 0) / 1000); });
  L('  theo giờ VN (lượt/bài/lead/dur trung vị): ' + Object.keys(byHour).sort((a, b) => a - b).map(h => h + 'h ' + byHour[h].n + '/' + byHour[h].posts + '/' + byHour[h].leads + '/' + Math.round(med(byHour[h].dur) || 0)).join(' · '));
  const perSrc = {}; scans.forEach(s => { const bs = Array.isArray(s.bySource) ? s.bySource : Object.values(s.bySource || {}); bs.forEach(r => { const o = perSrc[r.name || r.url] = perSrc[r.name || r.url] || { runs: 0, posts: 0, bd: 0, leads: 0, hot: 0, err: 0, ok: 0, skip: 0, lastPost: 0 }; o.runs++; o.posts += r.posts || 0; o.bd += r.bdPosts || 0; o.leads += r.leads || 0; o.hot += r.hot || 0; if (r.error) o.err++; if (r.bd === 'ok') o.ok++; if (r.bd === 'skip') o.skip++; if ((r.posts || 0) > 0) o.lastPost = Math.max(o.lastPost, ms(s.at)); }); });
  L('  theo nguồn 7 ngày (lượt · bài · record · lead · nóng · lỗi · gieo ok · lần cuối có bài):');
  Object.entries(perSrc).sort((a, b) => b[1].posts - a[1].posts).forEach(([n, o]) => L('   ' + String(n).slice(0, 34).padEnd(34) + ' ' + o.runs + ' · ' + o.posts + ' · ' + o.bd + ' · ' + o.leads + ' · ' + o.hot + ' · lỗi ' + o.err + ' · ok ' + o.ok + ' · ' + (o.lastPost ? hm(o.lastPost) : 'chưa có bài') + (srcByName[n] ? '' : ' · (KHÔNG khớp tên nguồn hiện tại)')));
  L('  nguồn bật nhưng 0 bài 7 ngày: ' + sources.filter(s => s.active !== false && !(perSrc[s.name] && perSrc[s.name].posts)).map(s => s.name).join(', ') + '  ← S9 nguồn chết');
  const bdErr = scans.filter(s => Array.isArray(s.bySource) && s.bySource.some(r => /429|rate|limit|too many|not active/i.test(String(r.error || '')))).length; L('  lượt có lỗi BrightData 429/rate/not active: ' + bdErr);
});

// ---------- R4 + B: kho lead 30 ngày ----------
let leads = [];
await safe('leads', async () => {
  HD('R4/B. leads 30 ngày');
  const q = await db.collection('leads').where('detected_at', '>=', new Date(now - 30 * D)).orderBy('detected_at', 'desc').limit(3000).get();
  leads = q.docs.map(d => ({ id: d.id, ...d.data() }));
  L('  lead 30 ngày: ' + leads.length + (leads.length >= 3000 ? ' (đụng trần 3000)' : '') + ' · brand ' + JSON.stringify(cnt(leads, l => l.brand || (l.brand_pending ? '(pending)' : '(rỗng)'))) + ' · temp ' + JSON.stringify(cnt(leads, l => l.temp || '?')) + ' · kind ' + JSON.stringify(cnt(leads, l => l.kind || 'post')));
  const fb = leads.filter(l => l.ai_scored === false); const fbOpen = fb.filter(l => !l.dropped && !l.lost && !l.closed_at);
  L('  ai_scored:false: ' + fb.length + ' (mở ' + fbOpen.length + ') · rescored_at 24h: ' + leads.filter(l => ms(l.rescored_at) > now - D).length + ' · rescored tổng: ' + leads.filter(l => l.rescored_at).length);
  L('  dropped_by: ' + JSON.stringify(cnt(leads.filter(l => l.dropped), l => l.dropped_by || '(rỗng)')) + ' · lost ' + leads.filter(l => l.lost).length + ' · closed ' + leads.filter(l => l.closed_at).length);
  const resc = leads.filter(l => l.rescored_at); const hum = resc.filter(l => l.first_care_at || l.assignee || (l.stage && l.stage !== 'new') || l.last_touch_at);
  L('  N4-3: lead AI chấm lại ' + resc.length + ' → có người thật chăm ' + hum.length + ' → trong đó temp=junk ' + hum.filter(l => l.temp === 'junk').length + ' · dropped ' + hum.filter(l => l.dropped).length + '  (đang bị giấu khỏi feed/Hộp việc)');
  L('  group_count>=2: ' + leads.filter(l => (l.group_count || 0) >= 2).length + ' · identityKey rỗng: ' + pct(leads.filter(l => !l.identityKey).length, leads.length) + ' · author_url có: ' + pct(leads.filter(l => l.author_url).length, leads.length) + ' · uid số trong author_url: ' + pct(leads.filter(l => /profile\.php\?id=\d+|\/people\/[^\/]+\/\d+/.test(l.author_url || '')).length, leads.length));
  let mt = 0, mtMis = 0; leads.filter(l => (l.group_count || 0) >= 2 && Array.isArray(l.touches)).forEach(l => { mt++; l.touches.forEach(t => { const s = srcByName[t && t.source]; if (s && s.brand && l.brand && s.brand !== l.brand) mtMis++; }); }); L('  B3. multitouch: lead gộp ' + mt + ' · touch từ nguồn brand KHÁC brand lead: ' + mtMis + '  ← gộp chéo brand?');
  const ph = leads.filter(l => l.phone); L('  phone: ' + pct(ph.length, leads.length) + ' · cố định (+842x/02x): ' + ph.filter(l => /^(\+?84|0)2/.test(String(l.phone))).length + ' · phone_has_zalo ' + JSON.stringify(cnt(ph, l => String(l.phone_has_zalo))) + ' · email ' + leads.filter(l => l.email).length);
  L('  post_id rỗng: ' + leads.filter(l => !l.post_id).length + ' · comment_id (lead comment): ' + JSON.stringify(cnt(leads.filter(l => l.kind === 'comment'), l => !l.comment_id ? 'rỗng' : /^\d+$/.test(String(l.comment_id)) ? 'số' : /^[A-Za-z0-9+\/=_-]{16,}$/.test(String(l.comment_id)) ? 'base64' : 'khác')) + ' · comment_url rỗng: ' + leads.filter(l => l.kind === 'comment' && !l.comment_url).length);
  const lag = leads.map(l => { const t = Date.parse(l.time || ''); const d = ms(l.detected_at); return (t && d) ? (d - t) / 60000 : NaN; }).filter(Number.isFinite);
  L('  Q-4/T: lag phát hiện (detected_at − time bài) phút: trung vị ' + (med(lag) != null ? Math.round(med(lag)) : '—') + ' · p95 ' + (p95(lag) != null ? Math.round(p95(lag)) : '—') + ' · <1′ (time = giờ gặt?): ' + pct(lag.filter(x => x < 1).length, lag.length) + ' · n=' + lag.length);
  const byS = {}; leads.forEach(l => { const t = Date.parse(l.time || ''), d = ms(l.detected_at); if (t && d) (byS[l.source] = byS[l.source] || []).push((d - t) / 60000); }); L('  lag trung vị theo nguồn (phút): ' + Object.entries(byS).map(([s, a]) => String(s).slice(0, 18) + ' ' + Math.round(med(a))).slice(0, 12).join(' · '));
  const cand = leads.filter(l => l.kind !== 'comment' && String(l.text || '').length >= 80).slice(0, 1500).map(l => ({ id: l.id, b: l.brand, at: ms(l.detected_at), w: new Set(fold(String(l.text).slice(0, 300)).split(/[^a-z0-9]+/).filter(x => x.length > 1)) }));
  let dup = 0; const seenPair = new Set(); for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) { const a = cand[i], b = cand[j]; if (a.b !== b.b || Math.abs(a.at - b.at) > 14 * D) continue; let inter = 0; a.w.forEach(x => { if (b.w.has(x)) inter++; }); const jac = inter / (a.w.size + b.w.size - inter || 1); if (jac >= 0.8) { dup++; seenPair.add(a.id); seenPair.add(b.id); } }
  L('  Q-1: cặp lead cùng brand ≤14 ngày text trùng ≥0,8 (bài, ≥80 ký tự): ' + dup + ' cặp · lead dính: ' + seenPair.size + '/' + cand.length);
  const hot7 = leads.filter(l => l.temp === 'hot' && ms(l.detected_at) > now - 7 * D); L('  R6c: lead nóng 7 ngày ' + hot7.length + ' · zalo_notified ' + JSON.stringify(cnt(hot7, l => String(l.zalo_notified))) + ' · brand_tagged_by ' + JSON.stringify(cnt(hot7, l => l.brand_tagged_by || '(không)')) + ' · brand_pending ' + hot7.filter(l => l.brand_pending).length);
  L('  role: ' + JSON.stringify(cnt(leads, l => l.role || '(rỗng)')) + ' · self_comment ' + leads.filter(l => l.self_comment).length + ' · outreach chạm ' + leads.filter(l => l.outreach && l.outreach.at).length + ' · outreach_replied ' + leads.filter(l => l.outreach_replied).length);
});

// ---------- R5: scanned_posts 3 ngày ----------
await safe('scanned_posts', async () => {
  HD('R5. scanned_posts 3 ngày');
  const q = await db.collection('scanned_posts').orderBy('createdAt', 'desc').limit(6000).get(); const sp = q.docs.map(d => ({ id: d.id, ...d.data() }));
  L('  doc: ' + sp.length + ' (' + (sp.length ? hm(sp[sp.length - 1].createdAt) + ' → ' + hm(sp[0].createdAt) : '') + ') · decision ' + JSON.stringify(cnt(sp, x => x.decision || '?')) + ' · kind ' + JSON.stringify(cnt(sp, x => x.kind || 'post')) + ' · brand ' + JSON.stringify(cnt(sp, x => x.brand || '(rỗng)')));
  const bySrc = {}; sp.forEach(x => { const o = bySrc[x.source] = bySrc[x.source] || { n: 0, ex: 0, pre: 0, lead: 0, low: 0, role: 0, wait: 0 }; o.n++; if (x.decision === 'excluded' || x.decision === 'no_keyword') o.ex++; if (x.decision === 'prefiltered_out') o.pre++; if (x.decision === 'lead') o.lead++; if (x.decision === 'scored_low') o.low++; if (x.decision === 'seller' || x.decision === 'self_comment') o.role++; if (x.decision === 'ai_wait') o.wait++; });
  L('  theo nguồn (n · exclude · tầng1 loại · lead · thấp · vai · ai_wait):'); Object.entries(bySrc).sort((a, b) => b[1].n - a[1].n).forEach(([s, o]) => L('   ' + String(s).slice(0, 34).padEnd(34) + ' ' + o.n + ' · ' + o.ex + ' · ' + o.pre + ' · ' + o.lead + ' · ' + o.low + ' · ' + o.role + ' · ' + o.wait));
  const cm = sp.filter(x => x.kind === 'comment'); let mis = 0, orphan = 0; cm.forEach(x => { const g = gidOf(x.parent_url); const bs = g ? (brandByGid[g] || []) : []; if (!g || !bs.length) orphan++; else if (x.brand && !bs.some(b => b.brand === x.brand)) mis++; });
  L('  N3-7/N1-4: comment ' + cm.length + ' · parent_url không thuộc nguồn nào: ' + orphan + ' · brand doc ≠ brand nguồn theo gid(parent_url): ' + mis);
  const waitDup = Object.values(cnt(sp.filter(x => x.decision === 'ai_wait'), x => x.post_url)).filter(n => n > 1).length; L('  N2-10: bài ai_wait lặp >1 dòng: ' + waitDup);
  const ex = sp.filter(x => x.decision === 'excluded' || x.decision === 'no_keyword'); L('  mẫu 6 bài bị exclude (text 90 ký tự): '); ex.slice(0, 6).forEach(x => L('   [' + (x.brand || '-') + '] ' + mask(String(x.text || '').slice(0, 90))));
});

// ---------- R6 + B: automation ↔ lead ----------
await safe('automation', async () => {
  HD('R6/B. automation ↔ lead · push');
  const th = await db.collection('outreach_threads').where('active', '==', true).limit(500).get(); const tk = await db.collection('outreach_tasks').where('status', 'in', ['queued', 'running']).limit(500).get();
  const ids = [...new Set([...th.docs.map(d => d.id), ...tk.docs.map(d => String(d.id).split('__')[0])])];
  L('  thread active ' + th.size + ' · task queued/running ' + tk.size + ' · lead liên quan ' + ids.length);
  let bad = { fb: 0, junk: 0, resc: 0, role: 0, human: 0 }; for (let i = 0; i < ids.length; i += 100) { const refs = ids.slice(i, i + 100).map(id => db.collection('leads').doc(id)); const ss = await db.getAll(...refs); ss.forEach(s => { if (!s.exists) return; const l = s.data(); if (l.ai_scored === false) bad.fb++; if (l.temp === 'junk') bad.junk++; if (/^rescore/.test(l.dropped_by || '')) bad.resc++; if (l.role === 'seller' || l.role === 'poster_self') bad.role++; if (l.first_care_at || l.last_touch_at || (l.stage && l.stage !== 'new')) bad.human++; }); }
  L('  R6a: máy đang chạm lead: điểm tạm ' + bad.fb + ' · junk ' + bad.junk + ' · AI đã loại ' + bad.resc + ' · vai bán/chủ bài ' + bad.role + ' · có người thật ' + bad.human);
  const lg = await db.collection('outreach_log').where('at', '>=', new Date(now - 7 * D)).orderBy('at', 'desc').limit(1500).get();
  const cl = lg.docs.map(d => d.data()).filter(x => /bình luận/i.test(String(x.action || '')) && (x.status === 'skip' || x.status === 'fail' || x.status === 'error'));
  L('  R6d: log 7 ngày ' + lg.size + ' · comment-lead skip/fail: ' + cl.length + ' · lý do: ' + topN(cnt(cl, x => mask(String(x.detail || x.text || x.reason || '').replace(/\d+/g, '#')).slice(0, 60)), 6));
  const locks = await db.collection('outreach_map').limit(1).get().catch(() => ({ size: 0 })); L('  outreach_map có doc: ' + (locks.size ? 'có' : 'rỗng/không') + ' · outreach_locks (thiết kế B) tồn tại: ' + ((await db.collection('outreach_locks').limit(1).get().catch(() => ({ size: 0 }))).size ? 'có' : 'chưa'));
  try {
    const out = execSync(`gcloud logging read 'resource.type="cloud_run_revision" AND (resource.labels.service_name="pushonlead" OR resource.labels.service_name="pushOnLead") AND timestamp>="${new Date(now - 7 * D).toISOString()}" AND (textPayload:"push hot" OR textPayload:"push reply" OR textPayload:"pushOnLead")' --project smartlead-z15 --limit 300 --format='value(textPayload)' 2>/dev/null`, { encoding: 'utf8' });
    const lines = out.split('\n').filter(Boolean); const hot = lines.filter(l => /push hot/i.test(l)); const sent = hot.map(l => Number((l.match(/sent (\d+)/) || [])[1])).filter(Number.isFinite);
    L('  R6b: log pushOnLead 7 ngày ' + lines.length + ' dòng · "push hot" ' + hot.length + ' · sent>0: ' + sent.filter(n => n > 0).length + ' · sent=0: ' + sent.filter(n => n === 0).length + ' · mẫu: ' + mask(hot[0] || '(không có)'));
  } catch (e) { L('  R6b: log pushOnLead không đọc được: ' + mask(e.message)); }
  const ds = await db.collection('daily_stats').where('day', '>=', day(now - 3 * D)).get().catch(() => ({ docs: [] })); L('  daily_stats 3 ngày: ' + ds.docs.length + ' doc · field: ' + [...new Set(ds.docs.flatMap(d => Object.keys(d.data())))].sort().join(', '));
  const bm = await db.collection('bd_month').orderBy('__name__', 'desc').limit(1).get().catch(() => ({ docs: [] })); if (bm.docs.length) { const b = bm.docs[0].data(); L('  bd_month/' + bm.docs[0].id + ': field ' + Object.keys(b).sort().join(', ') + ' · src: ' + Object.keys(b.src || {}).length + ' nguồn'); }
});
L('\n== XONG — file: ' + OUTF + ' (dán nguyên output vào chat, hoặc cloudshell download) ==');
