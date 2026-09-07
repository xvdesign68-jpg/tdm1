// LENH #38 KHỐI 2 (07/09/2026) — tái lập 2 truy vấn bị permission-denied trên Firestore EMULATOR với ĐÚNG Rules đang chạy (~/rules-deployed.txt)
// và ĐÚNG hồ sơ users của super (~/l38-seed.json). Chạy bởi: firebase emulators:exec --only firestore --project smartlead-z15 "node emu.mjs" (trong ~/l38emu).
import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, query, orderBy, limit, where, getDocs, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
const seed = JSON.parse(fs.readFileSync(process.env.HOME + '/l38-seed.json', 'utf8'));
const rules = fs.readFileSync(process.env.HOME + '/rules-deployed.txt', 'utf8');
const revive = o => { if (o === null || o === undefined) return o; if (Array.isArray(o)) return o.map(revive); if (typeof o === 'object') { if (typeof o.__ts === 'number') return Timestamp.fromMillis(o.__ts); const r = {}; for (const [k, v] of Object.entries(o)) r[k] = revive(v); return r; } return o; };
const host = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const env = await initializeTestEnvironment({ projectId: 'smartlead-z15', firestore: { rules, host: host[0], port: Number(host[1] || 8080) } });
await env.withSecurityRulesDisabled(async ctx => {
  const d = ctx.firestore();
  for (const col of ['users', 'leads', 'outreach_log', 'outreach_stats', 'workers', 'scans']) for (const [id, data] of Object.entries(seed[col] || {})) await setDoc(doc(d, col, id), revive(data));
});
const uid = seed.superUid; const em = seed.superEmail;
const me = env.authenticatedContext(uid, { email: em, email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
const oldestMs = Math.min(...Object.values(seed.leads).map(l => (l.detected_at && l.detected_at.__ts) || Date.now()));
const tests = [
  ['users/{uid} self get', () => getDoc(doc(me, 'users', uid))],
  ['leads main (orderBy detected_at desc limit 500)', () => getDocs(query(collection(me, 'leads'), orderBy('detected_at', 'desc'), limit(500)))],
  ['leads cũ (where detected_at < oldest, orderBy desc, limit 500)', () => getDocs(query(collection(me, 'leads'), where('detected_at', '<', Timestamp.fromMillis(oldestMs)), orderBy('detected_at', 'desc'), limit(500)))],
  ['outreach_log (orderBy at desc limit 100)', () => getDocs(query(collection(me, 'outreach_log'), orderBy('at', 'desc'), limit(100)))],
  ['outreach_stats (where day == hôm nay)', () => getDocs(query(collection(me, 'outreach_stats'), where('day', '==', new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10))))],
  ['workers (collection)', () => getDocs(collection(me, 'workers'))],
  ['scans (orderBy at desc limit 5)', () => getDocs(query(collection(me, 'scans'), orderBy('at', 'desc'), limit(5)))],
  ['config/app get', () => getDoc(doc(me, 'config', 'app'))],
];
let fail = 0;
for (const [name, fn] of tests) { try { const r = await fn(); console.log('✓ CHO PHÉP :', name, r.size !== undefined ? '(' + r.size + ' doc)' : ''); } catch (e) { fail++; console.log('✗ TỪ CHỐI  :', name, '→', (e && e.code) || '', (e && e.message || '').slice(0, 160)); } }
// cùng bộ Rules nhưng hồ sơ users thiếu role superadmin → chứng minh chiều ngược lại
await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'users', 'u_test_admin'), { email: 'x@y.z', role: 'admin', active: true, brand: 'hscl-01' }); });
const adm = env.authenticatedContext('u_test_admin', { email: 'x@y.z', email_verified: true }).firestore();
try { await getDocs(query(collection(adm, 'outreach_log'), orderBy('at', 'desc'), limit(100))); console.log('(đối chứng) admin brand đọc outreach_log KHÔNG lọc brand → CHO PHÉP (lạ, Rules lỏng?)'); } catch (e) { console.log('(đối chứng) admin brand đọc outreach_log KHÔNG lọc brand → TỪ CHỐI', (e && e.code) || ''); }
await env.cleanup();
console.log(fail ? ('== KẾT LUẬN: ' + fail + ' truy vấn bị Rules TỪ CHỐI với hồ sơ super hiện tại → lỗi ở Rules/hồ sơ users, không phải mạng ==') : '== KẾT LUẬN: Rules + hồ sơ super CHO PHÉP hết → lỗi trên web là phía phiên đăng nhập/token (thoáng qua hoặc tab khác), không phải Rules ==');
