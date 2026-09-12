/* LỆNH C KHỐI 2 (13/09/2026) — CHỈ ĐỌC: nghiệm thu sau deploy C (chạy sau ≥ 15′, tốt nhất 1–2 giờ ban ngày).
   In: (1) daily_stats 4 ngày gần nhất (new/hot/aiDropped/dropped) + so recount · (2) lead 24 h: máy loại (dropped_by) / sales loại / đổi nhiệt (ai_prev) · (3) log pushOnLead 24 h ("push hot … new|tagged|rescored sent N")
   · (4) source_health: số doc, top theo bài 7 ngày, nguồn xấu theo system_status/scan.health + log [SCAN-NO-LEAD]/[SCAN-HEALTH] · (5) backfill_done khoá mới · (6) group_state doc cũ còn lại · (7) Rules/ZBS: marker trong file local + describe notifyBrandZalo.
   Đọc theo TRANG ≤300 + select(). Đặt trong ~/firebase-s13/functions. Không ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { execSync } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now();
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const mask = s => String(s || '').replace(/sk-[A-Za-z0-9_-]{6,}/g, 'sk-…').replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '<ip>').slice(0, 200);
const vnDay = v => new Date(ms(v) + OFF).toISOString().slice(0, 10);
async function pageAll(q, orderField, sel, max) { const out = []; let last = null; while (out.length < (max || 3000)) { let qq = q.orderBy(orderField).limit(300); if (sel && sel.length) qq = qq.select(...sel); if (last) qq = qq.startAfter(last); const s = await qq.get(); s.docs.forEach(d => out.push(Object.assign({ id: d.id }, d.data()))); if (s.size < 300) break; last = s.docs[s.docs.length - 1]; } return out; }
const MACHINE = /^(rescore|rescore_role|lenh31b|ai|scanner|engine|worker|machine|system|sweep|auto)(:[\w-]+)?$/i; /* token máy CHÍNH XÁC (tuỳ chọn hậu tố :x) — email/uid người (có @ hoặc dài) không bao giờ khớp */
console.log('== LỆNH C KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
// 1. daily_stats 4 ngày
{ const from = vnDay(now - 3 * 864e5); const ds = (await db.collection('daily_stats').where('day', '>=', from).get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
  const byB = {}; ds.forEach(x => { const b = x.brandCode || '?'; const o = byB[b] || (byB[b] = { new: 0, hot: 0, aiDropped: 0, dropped: 0, days: 0, recount: 0 }); o.new += Number(x.new) || 0; o.hot += Number(x.hot) || 0; o.aiDropped += Number(x.aiDropped) || 0; o.dropped += Number(x.dropped) || 0; o.days++; if (x.recountBy === 'lenhC') o.recount++; });
  console.log('1. daily_stats 4 ngày (' + from + ' →): ' + ds.length + ' doc · ' + Object.keys(byB).sort().map(b => b + ' hợp lệ ' + byB[b].new + '/nóng ' + byB[b].hot + '/máy loại ' + byB[b].aiDropped + '/sales loại ' + byB[b].dropped + (byB[b].recount ? ' (recount C ' + byB[b].recount + ' doc)' : '')).join(' · ') + '  (kỳ vọng: doc có recountBy lenhC; aiDropped bắt đầu đếm từ deploy C)'); }
// 2. lead 24 h
{ const L = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 24 * 3600e3)), 'detected_at', ['brand', 'brand_hint', 'temp', 'dropped', 'dropped_by', 'dropped_reason', 'ai_prev', 'rescored_at', 'ai_scored', 'role', 'push_hot_at'], 3000);
  const mach = L.filter(l => l.dropped && MACHINE.test(String(l.dropped_by || ''))), hum = L.filter(l => l.dropped && !MACHINE.test(String(l.dropped_by || ''))), resc = L.filter(l => l.ai_prev && l.rescored_at);
  const by = {}; mach.forEach(l => { const k = String(l.dropped_by || '?'); by[k] = (by[k] || 0) + 1; });
  console.log('2. Lead 24 h: ' + L.length + ' · máy loại ' + mach.length + ' ' + JSON.stringify(by) + ' · sales loại ' + hum.length + (hum.length ? ' (dropped_by mẫu: ' + [...new Set(hum.map(l => String(l.dropped_by || '').slice(0, 24)))].slice(0, 3).join(', ') + ')' : '') + ' · AI chấm lại đổi điểm ' + resc.length + ' · có dropped_reason ' + L.filter(l => l.dropped_reason).length + '  (kỳ vọng: dropped_by người KHÔNG khớp regex máy — nếu khớp, gửi em mẫu)'); }
// 3. log pushOnLead 24 h
try { const filt = 'resource.type="cloud_run_revision" AND resource.labels.service_name="pushonlead" AND timestamp>="' + new Date(now - 24 * 3600e3).toISOString() + '" AND textPayload:"push hot"';
  const out = execSync('gcloud logging read \'' + filt + '\' --project smartlead-z15 --limit 200 --format="value(timestamp,textPayload)" 2>/dev/null', { encoding: 'utf8', maxBuffer: 8e6 }); const lines = out.split('\n').filter(Boolean);
  const cnt = { new: 0, tagged: 0, rescored: 0, old: 0 }, sent = { n: 0, s: 0 }; for (const l of lines) { const m = /push hot \S+ (new|tagged|rescored) sent (\d+)/.exec(l); if (m) { cnt[m[1]]++; sent.n++; sent.s += Number(m[2]); } else if (/push hot/.test(l)) cnt.old++; }
  console.log('3. Log pushOnLead 24 h "push hot": ' + lines.length + ' dòng · sau C ' + JSON.stringify({ new: cnt.new, tagged: cnt.tagged, rescored: cnt.rescored }) + ' · tổng sent ' + sent.s + '/' + sent.n + ' lượt · dòng trước C ' + cnt.old + '  (kỳ vọng: lead nóng mới → "new" (đường B có brand_hint) với sent ≥ 1 khi admin brand/super có token)');
  lines.slice(0, 4).forEach(l => console.log('   ' + mask(l.replace(/\s+/g, ' ')).slice(0, 160)));
} catch (e) { console.log('3. Log pushOnLead: không đọc được (' + mask(e.message).slice(0, 80) + ')'); }
// 4. source_health
{ const hs = (await db.collection('source_health').get()).docs.map(d => Object.assign({ id: d.id }, d.data())); const sum = hs.map(h => { const days = h.days || {}; let p = 0, l = 0; Object.values(days).forEach(x => { p += Number(x.posts) || 0; l += Number(x.leads) || 0; }); return { id: h.id, name: h.name, brand: h.brand, p, l, err: Number(h.errStreak) || 0, last: h.lastPostAt, nd: Object.keys(days).length }; }).sort((a, b) => b.p - a.p);
  const st = (await db.collection('system_status').doc('scan').get()).data() || {}; const H = st.health || {};
  console.log('4. source_health: ' + hs.length + ' nguồn có dữ liệu · health lúc ' + hm(H.at) + ': ' + (H.n ?? '—') + ' xấu / ' + (H.active ?? '—') + ' bật' + (H.bad && H.bad.length ? ' → ' + H.bad.slice(0, 6).map(b => (b.name || b.id) + ' [' + (b.brand || '') + ']: ' + b.why).join(' · ') : ' (không nguồn xấu)') + '  (kỳ vọng: sau vài lượt có bài, mỗi nguồn hoạt động 1 doc; days ≤ 7 khoá)');
  sum.slice(0, 8).forEach(s => console.log('   ' + (s.name || s.id).slice(0, 34).padEnd(34) + ' [' + (s.brand || '') + '] bài 7 ngày ' + s.p + ' · lead ' + s.l + ' · errStreak ' + s.err + ' · bài cuối ' + hm(s.last) + ' · ' + s.nd + ' ngày'));
  try { const filt = 'resource.type="cloud_run_revision" AND resource.labels.service_name="scheduledscan" AND timestamp>="' + new Date(now - 24 * 3600e3).toISOString() + '" AND (jsonPayload.message:"[SCAN-NO-LEAD]" OR jsonPayload.message:"[SCAN-HEALTH]" OR textPayload:"[LENH C]")';
    const out = execSync('gcloud logging read \'' + filt + '\' --project smartlead-z15 --limit 100 --format="value(timestamp,jsonPayload.message,textPayload)" 2>/dev/null', { encoding: 'utf8', maxBuffer: 8e6 }); const lines = out.split('\n').filter(Boolean);
    console.log('   log 24 h: [SCAN-NO-LEAD] ' + lines.filter(l => /SCAN-NO-LEAD/.test(l)).length + ' · [SCAN-HEALTH] ' + lines.filter(l => /SCAN-HEALTH/.test(l)).length + ' · [LENH C] lỗi ghi ' + lines.filter(l => /\[LENH C\]/.test(l)).length + '  (kỳ vọng: lỗi ghi 0; NO-LEAD chỉ khi nguồn thật sự im/không lead/lỗi trigger)'); lines.slice(0, 4).forEach(l => console.log('   ' + mask(l.replace(/\s+/g, ' ')).slice(0, 170)));
  } catch (e) { console.log('   log: không đọc được (' + mask(e.message).slice(0, 60) + ')'); } }
// 5. backfill_done + 6. group_state cũ
{ const bf = await db.collection('backfill_done').orderBy('at', 'desc').limit(20).get().catch(() => ({ docs: [] })); const withB = bf.docs.filter(d => (d.data() || {}).brand).length;
  console.log('5. backfill_done 20 gần nhất: ' + bf.docs.length + ' · có brand (khoá mới sau C) ' + withB + '  (kỳ vọng: backfill sau C có brand; cũ không có = bình thường)');
  const gs = await db.collection('group_state').get(); const old = gs.docs.filter(d => !/^(g_|s_)/.test(d.id)).length; console.log('6. group_state: ' + gs.size + ' doc · cũ theo URL còn ' + old + '  (kỳ vọng: 0 sau `node _lc_clean.mjs --apply`; còn = chưa dọn, không sao)'); }
// 7. Rules/ZBS
{ let r = '—', z = '—'; try { r = /'dropped_reason'/.test(fs.readFileSync(path.join(os.homedir(), 'firebase-s13', 'firestore.rules'), 'utf8')) ? 'có dropped_reason/ai_feedback/phone' : 'CHƯA có dropped_reason'; } catch (e) { r = 'không đọc được'; }
  try { z = /LENH C/.test(fs.readFileSync(path.join(os.homedir(), 'smartlead-zalo-fn', 'functions', 'index.js'), 'utf8')) ? 'có marker LENH C' : 'CHƯA có marker'; } catch (e) { z = 'không đọc được'; }
  let d = ''; try { d = execSync('gcloud functions describe notifyBrandZalo --region asia-southeast1 --gen2 --format="value(state,updateTime)" 2>/dev/null', { encoding: 'utf8' }).trim(); } catch (e) { d = '(describe lỗi)'; }
  console.log('7. Rules local: ' + r + ' · zalo-fn index.js: ' + z + ' · notifyBrandZalo: ' + d + '  (kỳ vọng: updateTime ≥ giờ chạy KHỐI 1 nếu deploy ZBS OK)'); }
console.log('== XONG (chỉ đọc) ==');
