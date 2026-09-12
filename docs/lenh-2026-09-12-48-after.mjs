/* LỆNH #48 KHỐI 2 (12/09/2026) — CHỈ ĐỌC: nghiệm thu sau deploy LỆNH A "AI hardening" (chạy sau ≥ 15′, tốt nhất sau 1–2 giờ có bài mới).
   In: system_status/llm (cửa sổ 15′, tầng 1, breaker) · system_status/scan (lượt gần nhất/aborted) · score_retry theo kind/lease · scans 12 lượt (llmOk-llmFail-deferred-fallback-rescored · pipe · soft · seen · lease · badreq · reasoning · status)
   · lead 24h: tỉ lệ author_uid bài/bình luận, zalo_defer, ai_flag, dạng author_url · log 24h [LLM-CB]/[LLM-PRE-*]/[SCAN-ABORTED]/[pipe]/[seen]/[lease]/[LLM-DOWN|UP].
   Đọc theo TRANG ≤300 + select() (bài học #36/#37/#47). Đặt trong ~/firebase-s13/functions (bài học: /tmp không thấy firebase-admin). Không ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now();
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const ago = v => { const d = now - ms(v); return d < 0 ? 'tới hạn +' + Math.round(-d / 60000) + '′' : d >= 48 * 3600e3 ? Math.round(d / 86400e3) + ' ngày trước' : Math.round(d / 60000) + '′ trước'; };
const mask = s => String(s || '').replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>').slice(0, 160);
const pct = (a, b) => b ? Math.round(100 * a / b) + ' %' : '—';
async function pageAll(q, orderField, sel, max) { const out = []; let last = null; while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (sel && sel.length) qq = qq.select(...sel); if (last) qq = qq.startAfter(last); const s = await qq.get(); s.docs.forEach(d => out.push(Object.assign({ id: d.id }, d.data()))); if (s.size < 300) break; last = s.docs[s.docs.length - 1]; } return out; }
console.log('== LỆNH #48 KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
// 1. giám sát LLM (cửa sổ 15′ + tầng 1 + breaker)
const st = await db.collection('system_status').doc('llm').get();
if (!st.exists) console.log('1. system_status/llm: CHƯA CÓ → chưa có lượt nào chấm bài sau deploy — chờ lượt có bài mới');
else { const s = st.data(); const win = Array.isArray(s.win) ? s.win : [];
  console.log('1. system_status/llm: ok=' + s.ok + ' · at ' + hm(s.at) + ' (' + ago(s.at) + ')' + (s.ok === false ? ' · DOWN từ ' + hm(s.since) + ' · ' + s.runs + ' lượt · kind ' + s.kind + ' · ' + mask(s.sample) : (s.recoveredAt ? ' · hồi lúc ' + hm(s.recoveredAt) : '')) + ' · model ' + (s.model || '?') + ' / tầng 1 ' + (s.preModel || '?'));
  console.log('   #48: cửa sổ 15′ ' + win.length + ' lượt ' + JSON.stringify(win.map(w => ({ at: hm(w.at), ok: w.ok, fail: w.fail, preOk: w.preOk, preFail: w.preFail, kind: w.kind || '' }))) + ' · tầng 1 pre=' + s.pre + (s.pre === false ? ' (ĐANG lỗi: ' + mask(s.preKind) + ' → mọi bài lên model chấm sâu)' : '') + ' · breaker lượt gần nhất cbOpen=' + s.cbOpen + ('win' in s ? '' : '  ⚠ chưa có field win → lượt sau deploy chưa chạy'));
}
// 1b. lượt quét gần nhất / aborted
const ss = await db.collection('system_status').doc('scan').get();
if (!ss.exists) console.log('1b. system_status/scan: CHƯA CÓ (chưa có lượt nào sau deploy)');
else { const s = ss.data(); console.log('1b. system_status/scan: phase=' + s.phase + ' · runId ' + (s.runId || '—') + ' · trigger ' + (s.trigger || '—') + ' · lượt xong gần nhất ' + hm(s.lastRunAt) + ' (' + ago(s.lastRunAt) + ') ' + Math.round((s.lastDurationMs || 0) / 1000) + ' s · ' + (s.lastPosts || 0) + ' bài/' + (s.lastLeads || 0) + ' lead · softStop ' + (s.softStop || 0) + ' · pipeErrors ' + (s.pipeErrors || 0) + (s.phase === 'aborted' ? '  ⚠ ABORTED lúc ' + hm(s.at) + ': ' + mask(s.error) : '') + (s.phase === 'starting' && now - ms(s.at) > 35 * 60e3 ? '  ⚠ "starting" quá 35′ → lượt treo/bị cắt?' : '')); }
// 2. hàng chờ score_retry (lease / chờ AI / badreq)
const rq = await pageAll(db.collection('score_retry'), 'nextAt', ['kind', 'tries', 'nextAt', 'leaseBy', 'firstAt', 'lastErr', 'src'], 1500);
{ const byKind = {}, byTries = {}; let due = 0, leased = 0, stale = 0; rq.forEach(r => { const k = r.kind || '?'; byKind[k] = (byKind[k] || 0) + 1; byTries[r.tries || 0] = (byTries[r.tries || 0] || 0) + 1; if (ms(r.nextAt) <= now) due++; if (r.leaseBy) leased++; if (k === 'lease' && now - ms(r.firstAt) > 2 * 3600e3) stale++; });
  console.log('2. score_retry: ' + rq.length + (rq.length ? ' · theo kind ' + JSON.stringify(byKind) + ' · theo tries ' + JSON.stringify(byTries) + ' · tới hạn ' + due + ' · đang lease (leaseBy) ' + leased + ' · lease ứng viên >2 h ' + stale : '') + '  (bình thường: 0 hoặc vài "lease" của lượt ĐANG chạy / vài bài chờ 3–10′; "lease" >2 h = lượt bị cắt giữa chừng → lượt lịch sau tự nạp; nhiều "server/badreq" = OpenAI đang lỗi)');
  rq.slice(0, 8).forEach(r => console.log('   ' + r.id + ' · ' + (r.kind || '?') + ' · tries ' + (r.tries || 0) + ' · nextAt ' + hm(r.nextAt) + ' (' + ago(r.nextAt) + ')' + (r.leaseBy ? ' · lease ' + r.leaseBy : '') + ' · ' + ((r.src && r.src.name) || '') + ' · ' + mask(r.lastErr))); }
// 3. 12 lượt quét gần nhất
const sc = await db.collection('scans').orderBy('at', 'desc').limit(12).get();
console.log('3. 12 lượt quét gần nhất (giờ VN · giây · bài/lead · ok/fail/deferred/fallback/rescored · preOk/preFail · pipe/soft/seenRace/leased/badreq · cb · reasoning tok · status):');
sc.docs.forEach(d => { const s = d.data(); const has = 'leased' in s; console.log('   ' + hm(s.at) + ' · ' + Math.round((s.durationMs || 0) / 1000) + 's · ' + (s.trigger || '') + ' · ' + (s.postsFetched || 0) + '/' + (s.leadsCreated || 0) + (has ? ' · ' + s.llmOk + '/' + s.llmFail + '/' + s.llmDeferred + '/' + s.llmFallback + '/' + s.llmRescored + ' · ' + s.llmPreOk + '/' + s.llmPreFail + ' · ' + s.pipeErrors + '/' + s.softStop + '/' + s.seenRace + '/' + s.leased + '/' + s.badreq + ' · cb ' + s.cbOpen + ' · rt ' + (s.tokensReasoning || 0) + ' · ' + (s.status || '') : ' · (lượt TRƯỚC deploy #48)') + (s.llmErr ? ' · ' + mask(s.llmErr) : '') + (s.error ? ' · ABORTED ' + mask(s.error) : '')); });
{ const after = sc.docs.map(d => d.data()).filter(s => 'leased' in s); const soft = after.filter(s => s.softStop > 0).length, pipe = after.reduce((a, s) => a + (s.pipeErrors || 0), 0), race = after.reduce((a, s) => a + (s.seenRace || 0), 0), ab = sc.docs.map(d => d.data()).filter(s => s.status === 'aborted').length;
  console.log('   → sau deploy: ' + after.length + ' lượt · lượt chạm trần mềm ' + soft + ' · bài lỗi ngoài LLM ' + pipe + ' · seen race ' + race + ' · aborted ' + ab + '  (kỳ vọng: soft 0 trừ lượt rất dài, pipe ≈ 0, race 0 khi không chồng lượt)'); }
// 4. lead 24h: author_uid / zalo_defer / ai_flag / dạng author_url
const L = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 24 * 3600e3)), 'detected_at', ['kind', 'author_uid', 'author_url', 'zalo_defer', 'ai_flag', 'ai_scored', 'temp', 'brand', 'phone', 'detected_at', 'base_score'], 3000);
{ const post = L.filter(l => (l.kind || 'post') !== 'comment'), cmt = L.filter(l => l.kind === 'comment'); const uid = a => a.filter(l => /^\d{5,}$/.test(String(l.author_uid || ''))).length, url = a => a.filter(l => l.author_url).length;
  const zd = L.filter(l => l.zalo_defer === true).length, zdPhone = L.filter(l => l.zalo_defer === true && l.phone).length, flag = L.filter(l => l.ai_flag).length, tmp = L.filter(l => l.ai_scored === false).length, cold = L.filter(l => l.temp === 'cold').length;
  const forms = {}; L.forEach(l => { const u = String(l.author_url || ''); const f = !u ? 'trống' : /profile\.php\?id=\d+$/.test(u) ? 'profile.php?id=số' : /profile\.php\?id=pfbid[\w-]*$/.test(u) ? 'profile.php?id=pfbid' : /\?/.test(u) ? 'CÒN tracking ?' : /\/people\//.test(u) ? '/people/' : /\/user\/\d+/.test(u) ? '/groups/…/user/' : 'username'; forms[f] = (forms[f] || 0) + 1; });
  console.log('4. Lead 24h: ' + L.length + ' (bài ' + post.length + ' · bình luận ' + cmt.length + ')');
  console.log('   author_uid số: bài ' + uid(post) + '/' + post.length + ' (' + pct(uid(post), post.length) + ') · bình luận ' + uid(cmt) + '/' + cmt.length + ' (' + pct(uid(cmt), cmt.length) + ')  — trước #48: bài ≈31 % có author_url, 0 % uid số; bình luận 0 %. Kỳ vọng sau #48: bài ≈100 % (profile_id), bình luận cao (commentator_profile_url)');
  console.log('   author_url có: bài ' + url(post) + ' · bình luận ' + url(cmt) + ' · dạng ' + JSON.stringify(forms) + (forms['CÒN tracking ?'] ? '  ⚠ còn link mang tham số tracking' : ''));
  console.log('   zalo_defer (lạnh, hoãn eKYC): ' + zd + ' / lạnh ' + cold + ' · có SĐT ' + zdPhone + '  · ai_flag (sales đang chăm, AI nói không phải lead/vai) ' + flag + ' · điểm tạm ai_scored:false ' + tmp);
  L.filter(l => l.ai_flag).slice(0, 5).forEach(l => console.log('   ai_flag ' + l.id + ' · ' + l.ai_flag + ' · ' + l.temp + ' · ' + (l.brand || '') + ' · base_score ' + (l.base_score ?? '—'))); }
// 5. log 24h
try {
  const filt = 'resource.type="cloud_run_revision" AND (resource.labels.service_name="scheduledscan" OR resource.labels.service_name="manualscan") AND timestamp>="' + new Date(now - 24 * 3600e3).toISOString() + '" AND (textPayload:"[LLM-" OR jsonPayload.message:"[LLM-" OR jsonPayload.message:"[SCAN-ABORTED]" OR textPayload:"[pipe]" OR textPayload:"[seen]" OR textPayload:"[lease]" OR textPayload:"[LLM-CB]")';
  const out = execSync('gcloud logging read \'' + filt + '\' --project smartlead-z15 --limit 200 --format="value(timestamp,textPayload,jsonPayload.message)" 2>/dev/null', { encoding: 'utf8', maxBuffer: 8e6 });
  const lines = out.split('\n').filter(Boolean); const cnt = {}; for (const l of lines) { const m = /\[(LLM-[A-Z-]+|SCAN-ABORTED|pipe|seen|lease)\]/.exec(l); const k = m ? m[1] : 'khác'; cnt[k] = (cnt[k] || 0) + 1; }
  console.log('5. Log 24h: ' + lines.length + ' dòng · ' + JSON.stringify(cnt) + '  (kỳ vọng: LLM-CB/PRE-DOWN/SCAN-ABORTED/pipe = 0 hoặc rất ít; LLM-DOWN chỉ khi OpenAI thật sự lỗi ≥2 bài/15′)');
  lines.slice(0, 15).forEach(l => console.log('   ' + mask(l.replace(/\s+/g, ' ')).slice(0, 200)));
} catch (e) { console.log('5. Log: không đọc được (' + mask(e.message).slice(0, 80) + ')'); }
console.log('== XONG (chỉ đọc) ==');
