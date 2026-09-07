// LENH #38b (07/09/2026) — CHỈ ĐỌC, đặt trong ~/firebase-s13/functions. Bổ sung cho _l38_db.mjs: (1) MỌI tài khoản Auth mang email super
// (uid, provider, xác minh email, khoá, thu hồi phiên, lần đăng nhập/làm mới cuối) — cần GOOGLE_CLOUD_QUOTA_PROJECT=smartlead-z15;
// (2) đối chiếu từng uid Auth với hồ sơ users/{uid} (tồn tại? role?); (3) xuất lại ~/l38-seed.json có users[superUid] cho KHỐI 2.
import admin from 'firebase-admin'; import fs from 'fs';
if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore(); const auth = admin.auth();
const SUPER_EMAIL = (process.env.SUPER_EMAIL || 'xuanvinhsc68.work@gmail.com').toLowerCase();
const vn = s => s ? new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-';
const tsOf = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v instanceof Date ? v.getTime() : (typeof v === 'number' ? v : (typeof v === 'string' ? Date.parse(v) : NaN)));
const plain = (o, depth = 0) => { if (o === null || o === undefined) return o; if (typeof o.toMillis === 'function') return { __ts: o.toMillis() }; if (Array.isArray(o)) return o.map(x => plain(x, depth + 1)); if (typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) { if (depth === 0 && ['avatar', 'sessions', 'fcmTokens', 'totp', 'mfa', 'secret'].includes(k)) continue; if (typeof v === 'string' && v.length > 4000) { r[k] = v.slice(0, 40) + '…'; continue; } r[k] = plain(v, depth + 1); } return r; } return o; };
// (1) Auth: liệt kê mọi user (dự án nhỏ) → lọc email super
let authUsers = [];
try { let tok; do { const r = await auth.listUsers(1000, tok); authUsers.push(...r.users); tok = r.pageToken; } while (tok); }
catch (e) { console.log('Auth listUsers LỖI:', (e.message || '').slice(0, 200), '\n  → nếu vẫn 403 quota project: chạy `gcloud auth application-default set-quota-project smartlead-z15` rồi chạy lại'); }
const sup = authUsers.filter(u => (u.email || '').toLowerCase() === SUPER_EMAIL);
console.log('== AUTH: tổng', authUsers.length, 'tài khoản | mang email super:', sup.length, '==');
sup.forEach(u => console.log(' -', 'uid', u.uid.slice(0, 8) + '…', '| providers', (u.providerData || []).map(p => p.providerId).join(',') || '-', '| emailVerified', u.emailVerified, '| disabled', u.disabled, '| tokensValidAfterTime', u.tokensValidAfterTime ? vn(u.tokensValidAfterTime) : '-', '| lastSignIn', vn(u.metadata.lastSignInTime), '| lastRefresh', vn(u.metadata.lastRefreshTime), '| customClaims', JSON.stringify(u.customClaims || {})));
// (2) hồ sơ users theo email super + theo uid Auth
const us = await db.collection('users').get();
const byEmail = us.docs.filter(d => ((d.data() || {}).email || '').toLowerCase() === SUPER_EMAIL);
console.log('== users có email super:', byEmail.length, '==');
byEmail.forEach(d => { const u = d.data(); console.log(' -', 'doc', d.id.slice(0, 8) + '…', JSON.stringify({ role: u.role, active: u.active, brand: u.brand || '-', provider: u.provider || '-', emailVerified: u.emailVerified, authDisabled: u.authDisabled, sessions: u.sessions ? Object.keys(u.sessions).length : 0, sessionsRevoked: u.sessions ? Object.values(u.sessions).filter(s => s && s.revoked).length : 0, updatedAt: vn(tsOf(u.updatedAt)) })); });
let superUid = null;
for (const u of sup) { const d = await db.collection('users').doc(u.uid).get(); const ok = d.exists && d.data().role === 'superadmin'; console.log(' → Auth uid', u.uid.slice(0, 8) + '…', d.exists ? ('có hồ sơ users, role ' + d.data().role + ', active ' + d.data().active) : 'KHÔNG CÓ hồ sơ users ← nếu trình duyệt đang đăng nhập uid này thì ĐÂY LÀ NGUYÊN NHÂN', ok ? '✓' : '✗'); if (ok && !superUid) superUid = u.uid; }
if (!superUid && byEmail.length) superUid = byEmail.find(d => d.data().role === 'superadmin')?.id || byEmail[0].id;
if (sup.length > 1) console.log('!!! CÓ ' + sup.length + ' tài khoản Auth cùng email super (đăng nhập Google vs email/mật khẩu tạo 2 uid?) — uid nào KHÔNG có hồ sơ role superadmin sẽ bị Rules từ chối mọi kênh super');
// (3) seed cho KHỐI 2
let seed = {}; try { seed = JSON.parse(fs.readFileSync(process.env.HOME + '/l38-seed.json', 'utf8')); } catch (e) { seed = { users: {}, leads: {}, outreach_log: {}, outreach_stats: {}, workers: {}, scans: {} }; }
seed.superUid = superUid; seed.superEmail = SUPER_EMAIL; seed.users = seed.users || {};
if (superUid) { const d = await db.collection('users').doc(superUid).get(); if (d.exists) seed.users[superUid] = plain(d.data()); }
fs.writeFileSync(process.env.HOME + '/l38-seed.json', JSON.stringify(seed));
console.log('== seed: superUid', superUid ? superUid.slice(0, 8) + '…' : '(KHÔNG có)', '| users seed', Object.keys(seed.users).length, '| leads', Object.keys(seed.leads || {}).length, '| outreach_log', Object.keys(seed.outreach_log || {}).length, '==');
