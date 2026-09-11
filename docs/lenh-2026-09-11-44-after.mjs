/* LỆNH #44 KHỐI 2 (11/09/2026) — CHỈ ĐỌC: nghiệm thu sau deploy (chạy sau ≥ 30′ trong khung 8–22h VN).
   In: system_status/outreach (sweeper) · nick có cờ + nextFreeAt · thread theo step (human/expired/moved/orphan) · task cancelled · van hôm nay (⚠ ÂM) · log 24h (🔀/⏳/🙋/hết van).
   Đặt trong ~/firebase-s13/functions (bài học: /tmp không thấy firebase-admin). Không ghi gì. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now(); const day = new Date(now + OFF).toISOString().slice(0, 10);
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : Number(v) || 0)));
const hm = v => v ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
const ago = v => { const d = now - ms(v); return d < 0 ? 'tới hạn +' + Math.round(-d / 60000) + '′' : Math.round(d / 3600e3) >= 48 ? Math.round(d / 86400e3) + ' ngày' : Math.round(d / 60000) + '′ trước'; };
console.log('== LỆNH #44 KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
// 1. sweeper / giám sát
const st = await db.collection('system_status').doc('outreach').get();
if (!st.exists) console.log('1. system_status/outreach: CHƯA CÓ → sweeper chưa chạy (chờ tick trong khung giờ 8–22h VN, mỗi 5′; sweep ≤ 1 lần/25′) hoặc chưa có brand BẬT');
else { const s = st.data(); console.log('1. system_status/outreach: at ' + hm(s.at) + ' (' + ago(s.at) + ') · thread active ' + s.threadsActive + ' · moved ' + s.moved + ' · closed ' + s.closed + ' · orphan ' + s.orphan);
  Object.entries(s.brands || {}).forEach(([c, b]) => console.log('   brand ' + c + ': on ' + b.on + ' · thread ' + b.threads + ' · orphan ' + b.orphan + ' · nick sống ' + b.nicksAlive + '/' + b.nicksTotal + ((b.on && b.nicksAlive === 0 && b.nicksTotal) ? '  ⚠ BẬT nhưng 0 nick sống' : ''))); }
// 2. nick có cờ
const fa = await db.collection('fb_accounts').get(); let flagged = 0;
console.log('2. Nick (' + fa.size + ' doc):');
fa.docs.forEach(d => { const a = d.data(); if (!(a.engine || a.adspower_id || a.tokenSet)) return; const fl = [a.active === false ? 'TẮT' : '', a.needLogin ? 'needLogin' : '', a.safetyPaused ? 'safetyPaused' : '', a.challenge ? 'cp:' + a.challenge : ''].filter(Boolean); if (fl.length) flagged++;
  console.log('   ' + d.id + ' (' + (a.label || '') + ') brand ' + (a.brand || '—') + ' · ' + (fl.length ? fl.join('+') : 'sống') + ' · nextFreeAt ' + (a.nextFreeAt ? hm(a.nextFreeAt) + ' (' + ago(a.nextFreeAt) + ')' : '0') + ' · safety ' + (a.safety == null ? '—' : a.safety)); });
console.log('   → nick có cờ: ' + flagged + ' (E-16: nick cờ nhưng active:true phải có nextFreeAt đẩy về tương lai ~+1h sau tick đầu)');
// 3. thread theo step
const th = await db.collection('outreach_threads').get(); const byStep = {}, act = { human: 0, expired: 0, moved: 0, orphan: 0, active: 0, cancelled: 0 };
th.docs.forEach(d => { const t = d.data(); const k = (t.step || '?') + (t.active === true ? ' (active)' : ''); byStep[k] = (byStep[k] || 0) + 1; if (t.step === 'human') act.human++; if (t.step === 'expired') act.expired++; if (t.movedAt) act.moved++; if (t.orphanAt && t.active === true) act.orphan++; if (t.active === true) act.active++; });
console.log('3. Thread ' + th.size + ': ' + Object.entries(byStep).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' · '));
console.log('   R-1 human ' + act.human + ' · R-6 expired ' + act.expired + ' · moved ' + act.moved + ' · orphan (active, chờ nick) ' + act.orphan + ' · active tổng ' + act.active);
th.docs.filter(d => d.data().movedAt || d.data().step === 'human' || d.data().step === 'expired').slice(0, 12).forEach(d => { const t = d.data(); console.log('   ' + d.id + ' ' + (t.name || '') + ' · step ' + t.step + (t.movedFrom ? ' · ' + t.movedFrom + ' → ' + t.pid : '') + (t.stopReason ? ' · ' + t.stopReason : '') + ' · ' + hm(t.movedAt || t.stoppedAt || t.closedAt)); });
// 4. task
const tk = await db.collection('outreach_tasks').get(); const ts = {}; tk.docs.forEach(d => { const s = d.data().status || '?'; ts[s] = (ts[s] || 0) + 1; });
console.log('4. Task ' + tk.size + ': ' + Object.entries(ts).map(([k, v]) => k + ' ' + v).join(' · ') + '  (cancelled = R-1/R-6 huỷ task xếp hàng; queued mà VPS offline = chờ)');
// 5. van hôm nay
const us = await db.collection('outreach_usage').where('day', '==', day).get(); let neg = 0;
console.log('5. Van hôm nay ' + day + ' (' + us.size + ' nick):');
us.docs.forEach(d => { const u = d.data(); const bad = ['react', 'comment', 'friend', 'inbox'].filter(k => Number(u[k]) < 0); if (bad.length) neg++; console.log('   ' + d.id + ': react ' + (u.react || 0) + ' · comment ' + (u.comment || 0) + ' · friend ' + (u.friend || 0) + ' · inbox ' + (u.inbox || 0) + (bad.length ? '  ⚠ ÂM ' + bad.join(',') : '')); });
console.log('   → doc âm: ' + neg + ' (E-5: sau #44 refund clamp ≥ 0 — doc âm còn lại là tồn cũ, tự hết khi sang ngày)');
// 6. log 24h
const lg = await db.collection('outreach_log').orderBy('at', 'desc').limit(300).get(); const cnt = {}; const since = now - 24 * 3600e3;
lg.docs.forEach(d => { const l = d.data(); if (ms(l.at) < since) return; const a = String(l.action || ''); const k = /🔀/.test(a) ? '🔀 chuyển nick' : /⏳/.test(a) ? '⏳ đóng 72h' : /🙋/.test(a) ? '🙋 người thật tiếp quản' : /Tạm hoãn — nick đang cần đăng nhập/.test(a) ? '⏸ hoãn needLogin (phải GIẢM sau #44)' : (l.status || '?'); cnt[k] = (cnt[k] || 0) + 1; });
console.log('6. Log 24h (300 dòng gần nhất): ' + (Object.entries(cnt).map(([k, v]) => k + ' ' + v).join(' · ') || 'trống'));
console.log('== XONG (chỉ đọc) ==');
