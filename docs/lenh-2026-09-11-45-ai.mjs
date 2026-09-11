// LỆNH #45 (11/09/2026) — CHỈ ĐỌC. Chẩn đoán lead "Điểm tạm – AI chưa chấm" (ai_scored:false = scoreLead rơi về bộ dự phòng từ khoá).
// Đặt trong ~/firebase-s13/functions (cần firebase-admin). Chạy: set -a; . ./.env; set +a; node _l45_ai.mjs
// KHÔNG in secret: key chỉ in độ dài + 8 ký tự SHA-256 + dạng (sk-…). Không ghi gì vào Firestore.
import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import admin from 'firebase-admin';

const PROJECT = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'smartlead-z15';
const REGION = 'asia-southeast1';
const VN = 7 * 3600e3;
const vnDay = ms => new Date(ms + VN).toISOString().slice(0, 10);
const vnHour = ms => new Date(ms + VN).toISOString().slice(0, 13).replace('T', ' ') + 'h';
const vnTime = ms => new Date(ms + VN).toISOString().slice(5, 16).replace('T', ' ');
const sha8 = s => createHash('sha256').update(String(s || '')).digest('hex').slice(0, 8);
const mask = s => String(s || '').replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/Bearer\s+\S+/g, 'Bearer …').slice(0, 220);
const keyInfo = k => !k ? 'TRỐNG' : `dài ${String(k).length} · ${/^sk-/.test(k) ? 'dạng sk-' : 'KHÔNG dạng sk-'} · sha8 ${sha8(k)}${/\s/.test(k) ? ' · ⚠ CÓ KHOẢNG TRẮNG' : ''}`;
const line = t => console.log(t);
const H = t => console.log('\n=== ' + t + ' ===');

if (!admin.apps.length) admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const tsMs = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (typeof v === 'number' ? v : (v ? Date.parse(v) || 0 : 0));

// ---------- 1. ENV local (.env) vs env ĐÃ DEPLOY (Cloud Run) ----------
H('1. Cấu hình LLM: .env cục bộ ↔ env đã deploy (scheduledscan / manualscan / outreachtick / gencontent)');
const localEnv = {};
if (existsSync('.env')) for (const l of readFileSync('.env', 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) localEnv[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
const VARS = ['LLM_API_KEY', 'OPENAI_API_KEY', 'LLM_BASE_URL', 'LLM_MODEL', 'LLM_PREFILTER_MODEL', 'LLM_CONTENT_MODEL', 'LLM_MAX_TOKENS', 'LLM_REASONING', 'SCORE_CONCURRENCY', 'PREFILTER_CONCURRENCY', 'MIN_KEEP_SCORE', 'TWO_STAGE'];
const showEnv = (name, e) => { line(`  [${name}]`); for (const v of VARS) { if (!(v in e)) continue; line(`    ${v} = ${/KEY/.test(v) ? keyInfo(e[v]) : e[v]}`); } };
showEnv('.env cục bộ', localEnv);
const deployed = {};
for (const svc of ['scheduledscan', 'manualscan', 'outreachtick', 'gencontent']) {
  try {
    const j = JSON.parse(execSync(`gcloud run services describe ${svc} --region ${REGION} --project ${PROJECT} --format=json 2>/dev/null`, { encoding: 'utf8' }));
    const c = (((j.spec || {}).template || {}).spec || {}).containers || []; const env = {}; (c[0] && c[0].env || []).forEach(x => { env[x.name] = x.value != null ? x.value : (x.valueFrom ? '(secret ref)' : ''); });
    env.__rev = ((j.status || {}).latestReadyRevisionName) || ''; env.__updated = (((j.metadata || {}).annotations || {})['serving.knative.dev/lastModifier'] || '') + ' ' + (((j.status || {}).conditions || [])[0] || {}).lastTransitionTime || '';
    deployed[svc] = env; showEnv(svc + ' (rev ' + env.__rev + ')', env);
  } catch (e) { line(`  [${svc}] không describe được: ${mask(e.message)}`); }
}
const ds = deployed.scheduledscan || {};
if (ds.LLM_API_KEY !== undefined) {
  const same = sha8(ds.LLM_API_KEY) === sha8(localEnv.LLM_API_KEY);
  line(same ? '  ✓ LLM_API_KEY đã deploy ở scheduledscan KHỚP .env cục bộ' : '  ✗ LỆCH: LLM_API_KEY ở scheduledscan KHÁC .env cục bộ → nghi key đã xoay trong .env nhưng CHƯA deploy lại (hoặc ngược lại)');
  for (const s of ['manualscan', 'outreachtick', 'gencontent']) if (deployed[s] && deployed[s].LLM_API_KEY !== undefined && sha8(deployed[s].LLM_API_KEY) !== sha8(ds.LLM_API_KEY)) line(`  ⚠ ${s} dùng key KHÁC scheduledscan (sha8 ${sha8(deployed[s].LLM_API_KEY)})`);
  if (ds.LLM_MODEL !== localEnv.LLM_MODEL) line(`  ⚠ LLM_MODEL đã deploy (${ds.LLM_MODEL}) ≠ .env (${localEnv.LLM_MODEL})`);
}

// ---------- 2. GỌI THỬ LLM y hệt scoreLead (json_object, không max_tokens) bằng key ĐÃ DEPLOY và key .env ----------
H('2. Gọi thử OpenAI y hệt scoreLead (response_format json_object) — status · mã lỗi · finish · token · độ trễ · rate-limit headers');
async function tryLlm(label, key, base, model, extra) {
  if (!key) { line(`  ${label}: bỏ qua (không có key)`); return null; }
  const body = Object.assign({ model, response_format: { type: 'json_object' }, messages: [
    { role: 'system', content: 'Trả về DUY NHẤT JSON: {"is_real_lead":bool,"hotness":0-100,"intent":string,"industry":string,"service":string,"reply":string}' },
    { role: 'user', content: 'Ngành ưu tiên: đa ngành.\nBÀI: """Mô hình ngoài trời có mái che kéo ổn k ae, ae cho lời khuyên ạ. Thuê mb chỉ 5 triệu trung tâm thị xã."""' }] }, extra || {});
  const t0 = Date.now(); const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 60000);
  try {
    const r = await fetch((base || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (_) {}
    const hdr = {}; for (const h of ['x-ratelimit-limit-requests', 'x-ratelimit-remaining-requests', 'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-tokens', 'x-ratelimit-reset-tokens', 'retry-after']) { const v = r.headers.get(h); if (v) hdr[h] = v; }
    const ms = Date.now() - t0;
    if (!r.ok) { const er = (j && j.error) || {}; line(`  ${label} [${model}]: ✗ HTTP ${r.status} · type=${er.type || '?'} · code=${er.code || '?'} · ${mask(er.message || txt)} · ${ms} ms`); if (Object.keys(hdr).length) line('     rate-limit: ' + JSON.stringify(hdr)); return { ok: false, status: r.status, code: er.code, type: er.type }; }
    const ch = (j && j.choices && j.choices[0]) || {}; const content = (ch.message && ch.message.content) || ''; let parsed = null; try { parsed = JSON.parse(content); } catch (_) {}
    const u = j.usage || {}; const rt = (u.completion_tokens_details || {}).reasoning_tokens;
    line(`  ${label} [${model}]: ✓ 200 · finish=${ch.finish_reason} · content ${content.length} ký tự · JSON ${parsed ? 'ĐỌC ĐƯỢC (hotness ' + parsed.hotness + ')' : '✗ KHÔNG PARSE ĐƯỢC'} · token in/out ${u.prompt_tokens}/${u.completion_tokens}${rt != null ? ' (suy nghĩ ' + rt + ')' : ''} · ${ms} ms`);
    if (Object.keys(hdr).length) line('     rate-limit: ' + JSON.stringify(hdr));
    if (!parsed) line('     mẫu content: ' + mask(content.slice(0, 160)));
    return { ok: true, parsed: !!parsed, ms };
  } catch (e) { line(`  ${label} [${model}]: ✗ lỗi mạng/timeout: ${mask(e.message)} · ${Date.now() - t0} ms`); return { ok: false, net: true }; }
  finally { clearTimeout(tm); }
}
const base = ds.LLM_BASE_URL || localEnv.LLM_BASE_URL; const model = ds.LLM_MODEL || localEnv.LLM_MODEL || 'gpt-4o-mini'; const pre = ds.LLM_PREFILTER_MODEL || localEnv.LLM_PREFILTER_MODEL || 'gpt-5-nano';
const rMain = await tryLlm('key ĐÃ DEPLOY (scheduledscan)', ds.LLM_API_KEY, base, model);
if (ds.LLM_API_KEY === undefined || sha8(ds.LLM_API_KEY) !== sha8(localEnv.LLM_API_KEY)) await tryLlm('key .env cục bộ', localEnv.LLM_API_KEY, localEnv.LLM_BASE_URL, model);
await tryLlm('key ĐÃ DEPLOY · model sàng lọc', ds.LLM_API_KEY || localEnv.LLM_API_KEY, base, pre);
if (rMain && rMain.ok && /^(gpt-5|o[0-9])/i.test(model)) await tryLlm('key ĐÃ DEPLOY · thêm reasoning_effort=low', ds.LLM_API_KEY || localEnv.LLM_API_KEY, base, model, { reasoning_effort: 'low' });
// 3 lượt song song để xem trần RPM/TPM còn bao nhiêu sau burst nhỏ
if (rMain && rMain.ok) { line('  burst 3 lượt song song (mô phỏng SCORE_CONCURRENCY):'); const rs = await Promise.all([1, 2, 3].map(i => tryLlm('   #' + i, ds.LLM_API_KEY || localEnv.LLM_API_KEY, base, model))); line('  → ' + rs.filter(x => x && x.ok).length + '/3 OK'); }

// ---------- 3. Lead ai_scored:false — 14 ngày theo ngày/brand/nguồn + 10 lead gần nhất + lead #399 ----------
H('3. Lead "Điểm tạm" (ai_scored:false) 14 ngày gần nhất');
const since = Date.now() - 14 * 864e5;
const fb = []; (await db.collection('leads').where('ai_scored', '==', false).get()).forEach(d => { const x = d.data(); const at = tsMs(x.detected_at); if (at >= since) fb.push({ id: d.id, ...x, _at: at }); });
const all = []; (await db.collection('leads').where('detected_at', '>=', admin.firestore.Timestamp.fromMillis(since)).get()).forEach(d => { const x = d.data(); all.push({ id: d.id, brand: x.brand, temp: x.temp, ai: x.ai_scored, _at: tsMs(x.detected_at) }); });
const byDay = {}; all.forEach(l => { const k = vnDay(l._at); byDay[k] = byDay[k] || { all: 0, fb: 0, fbHot: 0 }; byDay[k].all++; if (l.ai === false) { byDay[k].fb++; if (l.temp === 'hot') byDay[k].fbHot++; } });
line('  ngày (VN)   | lead mới | ĐIỂM TẠM | trong đó nóng | tỉ lệ');
Object.keys(byDay).sort().forEach(k => { const v = byDay[k]; line(`  ${k}  | ${String(v.all).padStart(8)} | ${String(v.fb).padStart(8)} | ${String(v.fbHot).padStart(13)} | ${v.all ? Math.round(v.fb / v.all * 100) : 0}%${v.fb && v.fb === v.all ? '  ← 100% = AI hoàn toàn không chấm' : ''}`); });
const grp = (arr, f) => { const o = {}; arr.forEach(x => { const k = f(x) || '(trống)'; o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
line('  theo brand: ' + grp(fb, x => x.brand).map(([k, v]) => k + ' ' + v).join(' · '));
line('  theo nguồn: ' + grp(fb, x => x.source).slice(0, 8).map(([k, v]) => k + ' ' + v).join(' · '));
line('  theo nhiệt độ: ' + grp(fb, x => x.temp).map(([k, v]) => k + ' ' + v).join(' · '));
const open = fb.filter(l => !l.dropped && !l.lost && !l.closed_at); const touched = fb.filter(l => l.first_care_at || l.assignee); const machine = fb.filter(l => l.outreach && Array.isArray(l.outreach.steps) && l.outreach.steps.length);
line(`  tổng ${fb.length} lead Điểm tạm 14 ngày · còn mở ${open.length} · sales đã chăm/giao ${touched.length} · MÁY ĐÃ CHẠM ${machine.length}${machine.length ? ' ⚠ (automation chạm lead chấm bằng từ khoá)' : ''}`);
line('  10 lead Điểm tạm gần nhất:');
fb.sort((a, b) => b._at - a._at).slice(0, 10).forEach(l => line(`    ${vnTime(l._at)} · #${l.leadNo || '?'} · ${l.brand} · ${String(l.source || '').slice(0, 22)} · ${l.temp} ${l.score} · ${l.stage}${l.assignee ? ' · giao ' + l.assignee : ''}${l.outreach && l.outreach.last ? ' · máy:' + l.outreach.last : ''} · "${String(l.text || '').replace(/\s+/g, ' ').slice(0, 70)}"`));
try { const s399 = await db.collection('leads').where('leadNo', '==', 399).limit(1).get(); if (!s399.empty) { const x = s399.docs[0].data(); line(`  lead #399: id ${s399.docs[0].id} · ai_scored=${x.ai_scored} · ${x.temp} ${x.score} · brand ${x.brand} · nguồn ${x.source} · phát hiện ${vnTime(tsMs(x.detected_at))} · intent "${x.intent}" · service "${x.service}" · reply ${x.reply ? x.reply.length + ' ký tự' : 'RỖNG'}`); } else line('  lead #399: không tìm thấy theo leadNo'); } catch (e) { line('  lead #399: ' + mask(e.message)); }

// ---------- 4. Nhật ký quét 48h theo giờ: lượt AI gọi được vs lead tạo ----------
H('4. Lịch sử quét 48h theo giờ VN — scoreCalls = 0 mà vẫn tạo lead = AI im lặng, lead chấm bằng từ khoá');
const since48 = Date.now() - 48 * 3600e3;
const scans = []; (await db.collection('scans').where('at', '>=', admin.firestore.Timestamp.fromMillis(since48)).get()).forEach(d => scans.push({ id: d.id, ...d.data() }));
const byH = {}; scans.forEach(s => { const k = vnHour(tsMs(s.at)); const o = byH[k] = byH[k] || { runs: 0, posts: 0, cand: 0, pre: 0, sc: 0, err: 0, leads: 0, hot: 0, tok: 0, cost: 0, dur: 0 }; o.runs++; o.posts += +s.postsFetched || 0; o.cand += +s.candidates || 0; o.pre += +s.prefilterCalls || 0; o.sc += +s.scoreCalls || 0; o.err += +s.scoreErrors || 0; o.leads += +s.leadsCreated || 0; o.hot += +s.hotLeads || 0; o.tok += +s.tokensTotal || 0; o.cost += +s.costUsd || 0; o.dur = Math.max(o.dur, +s.durationMs || 0); });
line('  giờ VN          | lượt | bài  | ứng viên | sàng lọc | chấm AI | lỗi | lead | nóng | token  | USD    | max s');
Object.keys(byH).sort().forEach(k => { const o = byH[k]; const flag = (o.leads > 0 && o.sc === 0) ? '  ← AI IM LẶNG' : (o.cand > 0 && o.sc === 0 && o.pre === 0 ? '  ← 0 lượt AI' : ''); line(`  ${k} | ${String(o.runs).padStart(4)} | ${String(o.posts).padStart(4)} | ${String(o.cand).padStart(8)} | ${String(o.pre).padStart(8)} | ${String(o.sc).padStart(7)} | ${String(o.err).padStart(3)} | ${String(o.leads).padStart(4)} | ${String(o.hot).padStart(4)} | ${String(o.tok).padStart(6)} | ${o.cost.toFixed(3).padStart(6)} | ${Math.round(o.dur / 1000)}${flag}`); });
const last = scans.sort((a, b) => tsMs(b.at) - tsMs(a.at))[0]; if (last) line(`  lượt gần nhất ${vnTime(tsMs(last.at))}: aiMode ${last.aiMode} · twoStage ${last.twoStage} · candidates ${last.candidates} · prefilterCalls ${last.prefilterCalls} · scoreCalls ${last.scoreCalls} · leads ${last.leadsCreated} · scoreErrors ${last.scoreErrors}`);

// ---------- 5. Cloud Logging 24h: dòng "LLM lỗi / prefilter lỗi / heuristic / miss-reply" theo loại lỗi ----------
H('5. Log scheduledscan + manualscan 24h: lỗi LLM theo loại (che key)');
try {
  const sinceIso = new Date(Date.now() - 24 * 3600e3).toISOString();
  const filter = `resource.type="cloud_run_revision" AND (resource.labels.service_name="scheduledscan" OR resource.labels.service_name="manualscan") AND timestamp>="${sinceIso}" AND (textPayload:"LLM" OR textPayload:"prefilter" OR textPayload:"heuristic" OR textPayload:"miss-reply" OR jsonPayload.message:"LLM" OR jsonPayload.message:"heuristic")`;
  const out = execSync(`gcloud logging read '${filter}' --project ${PROJECT} --format=json --limit=3000 --order=desc 2>/dev/null`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const rows = JSON.parse(out || '[]');
  const sig = {}; const byHr = {}; const samples = [];
  rows.forEach(r => { const m = String(r.textPayload || (r.jsonPayload && (r.jsonPayload.message || JSON.stringify(r.jsonPayload))) || ''); if (!/LLM|prefilter|heuristic|miss-reply/i.test(m)) return; const t = Date.parse(r.timestamp) || 0;
    const s = m.replace(/\d+/g, '#').replace(/sk-\S+/g, 'sk-…').replace(/["'][^"']{40,}["']/g, '"…"').slice(0, 110); sig[s] = (sig[s] || 0) + 1; const hk = vnHour(t); byHr[hk] = (byHr[hk] || 0) + 1; if (samples.length < 8) samples.push(vnTime(t) + ' ' + mask(m)); });
  line(`  ${rows.length} dòng khớp · theo giờ: ` + Object.keys(byHr).sort().map(k => k.slice(5) + '=' + byHr[k]).join(' '));
  Object.entries(sig).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => line(`  ${String(v).padStart(5)} × ${k}`));
  line('  mẫu:'); samples.forEach(s => line('    ' + s));
  if (!rows.length) line('  (0 dòng — hoặc AI không lỗi trong 24h, hoặc log.warn của logger.js ghi dạng khác; mục 4 quyết định)');
} catch (e) { line('  không đọc được log: ' + mask(e.message)); }

// ---------- 6. Tài khoản OpenAI: hạn mức/credit (nếu key có quyền) ----------
H('6. Hạn mức tài khoản OpenAI (best-effort)');
try {
  const k = ds.LLM_API_KEY || localEnv.LLM_API_KEY; const b = (base || 'https://api.openai.com/v1').replace(/\/$/, '');
  const r = await fetch(b + '/models/' + encodeURIComponent(model), { headers: { Authorization: 'Bearer ' + k } }); const j = await r.json().catch(() => null);
  line(`  GET /models/${model}: HTTP ${r.status}${r.ok ? ' ✓ model tồn tại/khả dụng với key này' : ' ✗ ' + mask((j && j.error && j.error.message) || '')}`);
} catch (e) { line('  ' + mask(e.message)); }
line('\nXONG LỆNH #45 (chỉ đọc). Dán toàn bộ output cho em.');
process.exit(0);
