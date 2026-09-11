/* LỆNH #46 KHỐI 2 (11/09/2026) — CHỈ ĐỌC: nghiệm thu sau deploy (chạy sau ≥ 15′, tốt nhất sau 1–2 giờ có bài mới).
   In: system_status/llm · hàng chờ score_retry · lead ai_scored:false (còn/đã chấm lại 24h/loại) · scans 12 lượt gần nhất (llmOk/llmFail/llmDeferred/llmFallback/llmRescored) · log 24h [LLM-*].
   Đặt trong ~/firebase-s13/functions (bài học: /tmp không thấy firebase-admin). Không ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now();
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const ago = v => { const d = now - ms(v); return d < 0 ? 'tới hạn +' + Math.round(-d / 60000) + '′' : d >= 48 * 3600e3 ? Math.round(d / 86400e3) + ' ngày trước' : Math.round(d / 60000) + '′ trước'; };
const mask = s => String(s || '').replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').slice(0, 160);
console.log('== LỆNH #46 KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
// 1. giám sát
const st = await db.collection('system_status').doc('llm').get();
if (!st.exists) console.log('1. system_status/llm: CHƯA CÓ → chưa có lượt quét nào chấm bài sau deploy (hoặc 0 lượt OK lẫn hỏng) — chờ lượt có bài mới');
else { const s = st.data(); console.log('1. system_status/llm: ok=' + s.ok + ' · at ' + hm(s.at) + ' (' + ago(s.at) + ')' + (s.ok === false ? ' · DOWN từ ' + hm(s.since) + ' · ' + s.runs + ' lượt · kind ' + s.kind + ' · ' + mask(s.sample) : (s.recoveredAt ? ' · hồi lúc ' + hm(s.recoveredAt) : '')) + ' · model ' + (s.model || '')); }
// 2. hàng chờ
const rq = await db.collection('score_retry').orderBy('nextAt').limit(200).get(); const byKind = {}, byTries = {}; let due = 0;
rq.docs.forEach(d => { const r = d.data(); byKind[r.kind || '?'] = (byKind[r.kind || '?'] || 0) + 1; byTries[r.tries || 0] = (byTries[r.tries || 0] || 0) + 1; if (ms(r.nextAt) <= now) due++; });
console.log('2. score_retry (bài chờ AI chấm lại): ' + rq.size + (rq.size ? ' · theo kind ' + JSON.stringify(byKind) + ' · theo tries ' + JSON.stringify(byTries) + ' · tới hạn ' + due : '') + '  (bình thường = 0 hoặc vài bài đang chờ 3–10′; nhiều bài kind auth/quota = cấu hình key)');
rq.docs.slice(0, 8).forEach(d => { const r = d.data(); console.log('   ' + d.id + ' · tries ' + r.tries + ' · kind ' + r.kind + ' · nextAt ' + hm(r.nextAt) + ' (' + ago(r.nextAt) + ') · ' + mask(r.lastErr) + ' · "' + String((r.post && r.post.text) || '').slice(0, 50).replace(/\s+/g, ' ') + '"'); });
// 3. lead điểm tạm
const fb = await db.collection('leads').where('ai_scored', '==', false).limit(500).get(); const open = fb.docs.filter(d => { const l = d.data(); return !l.dropped && !l.lost && !l.closed_at; });
console.log('3. Lead ai_scored:false còn lại: ' + fb.size + ' (mở ' + open.length + ', đã loại/không thành/chốt ' + (fb.size - open.length) + ')  — sweeper chấm lại ≤12 lead/lượt quét theo lịch (≤30 ngày, ≤8 lần) → số mở phải GIẢM dần về 0');
open.slice(0, 10).forEach(d => { const l = d.data(); console.log('   ' + d.id + ' · ' + (l.name || '') + ' · ' + l.score + ' ' + l.temp + ' · ' + (l.brand || '—') + ' · ' + hm(l.detected_at) + (l.rescore_tries ? ' · đã thử chấm lại ' + l.rescore_tries + ' (' + mask(l.rescore_err) + ')' : '') + (l._fallback || /Điểm tạm/.test(l.intent || '') ? ' · dự phòng kẹp' : '')); });
const rs = await db.collection('leads').where('rescored_at', '>', now - 24 * 3600e3).limit(200).get(); let dropped = 0, up = 0, down = 0;
rs.docs.forEach(d => { const l = d.data(); if (l.dropped_by === 'rescore' || l.dropped_by === 'rescore_role') dropped++; const p = (l.ai_prev && l.ai_prev.score) || 0; if (l.score > p) up++; else if (l.score < p) down++; });
console.log('   Đã AI chấm lại 24h: ' + rs.size + ' lead · loại ' + dropped + ' · điểm tăng ' + up + ' / giảm ' + down);
rs.docs.slice(0, 10).forEach(d => { const l = d.data(); console.log('   ' + d.id + ' · ' + (l.name || '') + ' · ' + ((l.ai_prev && l.ai_prev.score) ?? '?') + ' ' + ((l.ai_prev && l.ai_prev.temp) || '') + ' → ' + l.score + ' ' + l.temp + (l.dropped ? ' · LOẠI (' + l.dropped_by + ')' : '') + (l.rescore_note ? ' · ' + l.rescore_note : '') + ' · ' + hm(l.rescored_at)); });
// 4. scans
const sc = await db.collection('scans').orderBy('at', 'desc').limit(12).get();
console.log('4. 12 lượt quét gần nhất (giờ VN · giây · bài/lead · scoreCalls · llmOk/llmFail/llmDeferred/llmFallback/llmRescored · lỗi):');
sc.docs.forEach(d => { const s = d.data(); const has = 'llmOk' in s; console.log('   ' + hm(s.at) + ' · ' + Math.round((s.durationMs || 0) / 1000) + 's · ' + (s.postsFetched || 0) + '/' + (s.leadsCreated || 0) + ' · sc ' + (s.scoreCalls || 0) + (has ? ' · ' + s.llmOk + '/' + s.llmFail + '/' + s.llmDeferred + '/' + s.llmFallback + '/' + s.llmRescored + (s.llmRescoredLeads ? ' (+' + s.llmRescoredLeads + ' lead chấm lại)' : '') + (s.llmErr ? ' · ' + s.llmErr : '') : ' · (code cũ, chưa có field llm*)') + (s.scoreErrors ? ' · scoreErrors ' + s.scoreErrors : '')); });
// 5. log 24h
try {
  const out = execSync(`gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="scheduledscan" AND timestamp>="${new Date(now - 24 * 3600e3).toISOString()}" AND (textPayload:"[LLM-" OR jsonPayload.message:"[LLM-" OR textPayload:"LLM lỗi" OR textPayload:"prefilter lỗi")' --project smartlead-z15 --limit 40 --order desc --format='value(timestamp,textPayload,jsonPayload.message)' 2>/dev/null`, { encoding: 'utf8' });
  const lines = out.split('\n').filter(Boolean); console.log('5. Log 24h [LLM-*] / "LLM lỗi" / "prefilter lỗi": ' + lines.length + ' dòng');
  lines.slice(0, 15).forEach(l => console.log('   ' + mask(l.replace(/\s+/g, ' ')).slice(0, 200)));
} catch (e) { console.log('5. Log: không đọc được (' + mask(e.message).slice(0, 80) + ')'); }
console.log('== XONG (chỉ đọc) ==');
