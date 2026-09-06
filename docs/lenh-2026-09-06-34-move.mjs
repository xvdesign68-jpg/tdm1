// LENH #34b (06/09/2026) — đặt trong ~/firebase-s13/functions. Chuyển thread funnel ĐANG MỞ đang gắn nick CHẾT (active=false / needLogin / safetyPaused / checkpoint)
// sang nick SỐNG cùng brand (engine adspower), xoay vòng, giãn nhịp --gap=<phút> (mặc định 10) để không dồn phễu lên 1 nick. --dry chỉ in. --brand=<code> giới hạn.
// Không đụng cap: thread giữ nguyên fpayload (nội dung + steps); engine re-enqueue khi nick đích tới hạn (trạng thái giống worker onFail: taskStatus failed + nextAt).
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const args = process.argv.slice(2); const DRY = args.includes('--dry'); const ONLY = (args.find(a => a.startsWith('--brand=')) || '').slice(8);
const GAP = Math.max(1, Number((args.find(a => a.startsWith('--gap=')) || '--gap=10').slice(6)) || 10);
const vn = ms => new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const accs = {}; (await db.collection('fb_accounts').get()).docs.forEach(d => { accs[d.id] = Object.assign({ id: d.id }, d.data()); });
const why = a => !a ? 'không có doc' : a.active === false ? 'đã tắt' : a.needLogin ? 'cần đăng nhập lại' : a.safetyPaused ? 'tạm dừng Safety' : a.challenge ? 'checkpoint ' + a.challenge : a.engine !== 'adspower' ? 'engine ' + (a.engine || '?') : 'sống';
const alive = a => !!a && a.active === true && !a.needLogin && !a.safetyPaused && !a.challenge && a.engine === 'adspower';
console.log('NICK:', Object.values(accs).map(a => a.id + ' [' + (a.brand || '-') + '] ' + why(a)).join(' · '));
const ts = await db.collection('outreach_threads').where('active', '==', true).get();
const th = ts.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(t => t.step === 'funnel');
console.log('thread funnel đang mở:', th.length, ONLY ? '(chỉ brand ' + ONLY + ')' : '', DRY ? '(DRY)' : '');
const rr = {}; let moved = 0, keep = 0; const now = Date.now();
for (const t of th) {
  const cur = accs[t.pid]; const code = String(t.brandCode || (cur && cur.brand) || '');
  if (ONLY && code !== ONLY) continue;
  if (alive(cur)) { console.log(' -', t.id.slice(0, 10), '| nick', t.pid, 'sống → giữ nguyên'); keep++; continue; }
  const pool = Object.values(accs).filter(a => alive(a) && String(a.brand || '') === code).sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) { console.log(' -', t.id.slice(0, 10), '| nick', t.pid, '(' + why(cur) + ') · brand', code, 'KHÔNG có nick sống → giữ'); keep++; continue; }
  rr[code] = rr[code] || { i: 0 }; const dest = pool[rr[code].i % pool.length]; rr[code].i++;
  const nextAt = now + rr[code].i * GAP * 60000;
  console.log(' -', t.id.slice(0, 10), '| nick', t.pid, '(' + why(cur) + ') →', dest.id, '| chạy từ', vn(nextAt), '| lỗi cũ:', String(t.lastError || '').slice(0, 60));
  if (DRY) continue;
  await db.doc('outreach_threads/' + t.id).set({ pid: dest.id, tries: 0, nextAt, taskStatus: 'failed', lastError: 'chuyển nick (LENH34b) từ ' + t.pid, movedBy: 'LENH34b', movedAt: now, movedFrom: t.pid }, { merge: true });
  const task = db.doc('outreach_tasks/' + t.id + '__funnel'); const tk = await task.get();
  if (tk.exists && (tk.data() || {}).status !== 'running') await task.set({ status: 'failed', pid: dest.id, workerId: dest.workerId || '', movedAt: now }, { merge: true });
  moved++;
}
console.log(DRY ? 'DRY — không ghi gì (bỏ --dry để áp)' : 'ĐÃ CHUYỂN ' + moved + ' thread · giữ ' + keep + ' · engine re-enqueue khi nick đích tới hạn (pace 3–8′)');
