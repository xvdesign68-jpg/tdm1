// LENH #38 (07/09/2026) — CHỈ ĐỌC, đặt trong ~/firebase-s13/functions (cần firebase-admin). Không ghi gì.
// (1) hồ sơ users của Super Admin (theo SUPER_EMAIL) + tài khoản Auth (disabled? tokensValidAfterTime = thu hồi phiên?) ;
// (2) mọi user có role superadmin (che email); (3) kiểu dữ liệu detected_at của 600 lead mới nhất; (4) outreach_log thiếu at/brandCode;
// (5) xuất ~/l38-seed.json (bản sao hồ sơ super + 3 lead + 3 outreach_log, BỎ avatar/sessions/token) cho KHỐI 2 (emulator).
import admin from 'firebase-admin'; import fs from 'fs';
if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore(); const auth = admin.auth();
const SUPER_EMAIL = (process.env.SUPER_EMAIL || 'xuanvinhsc68.work@gmail.com').toLowerCase();
const mask = e => String(e || '').replace(/^(..)[^@]*(@.*)$/, '$1***$2');
const vn = ms => ms ? new Date(ms).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '-';
const tsOf = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v instanceof Date ? v.getTime() : (typeof v === 'number' ? v : (typeof v === 'string' ? Date.parse(v) : NaN)));
const plain = (o, depth = 0) => { if (o === null || o === undefined) return o; if (typeof o.toMillis === 'function') return { __ts: o.toMillis() }; if (Array.isArray(o)) return o.map(x => plain(x, depth + 1)); if (typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) { if (depth === 0 && ['avatar', 'sessions', 'fcmTokens', 'totp', 'mfa', 'secret'].includes(k)) continue; if (typeof v === 'string' && v.length > 4000) { r[k] = v.slice(0, 40) + '…'; continue; } r[k] = plain(v, depth + 1); } return r; } return o; };
// (1) Auth account
let ur = null;
try { ur = await auth.getUserByEmail(SUPER_EMAIL); } catch (e) { console.log('Auth getUserByEmail LỖI:', e.message); }
if (ur) console.log('== AUTH super ==', 'uid', ur.uid.slice(0, 8) + '…', '| disabled', ur.disabled, '| providers', (ur.providerData || []).map(p => p.providerId).join(','), '| tokensValidAfterTime', ur.tokensValidAfterTime || '-', '| lastSignIn', ur.metadata.lastSignInTime, '| lastRefresh', ur.metadata.lastRefreshTime || '-', '| customClaims', JSON.stringify(ur.customClaims || {}));
const uid = ur ? ur.uid : null;
const seed = { superUid: uid, superEmail: SUPER_EMAIL, users: {}, leads: {}, outreach_log: {}, outreach_stats: {}, workers: {}, scans: {} };
if (uid) {
  const d = await db.collection('users').doc(uid).get();
  if (!d.exists) console.log('== users/' + uid.slice(0, 8) + '… KHÔNG TỒN TẠI ← ĐÂY LÀ NGUYÊN NHÂN (Rules isSuperAdmin đọc users.role) ==');
  else { const u = d.data(); const size = JSON.stringify(u).length; console.log('== users super ==', JSON.stringify({ role: u.role, active: u.active, brand: u.brand || '-', provider: u.provider || '-', emailVerified: u.emailVerified, authDisabled: u.authDisabled, sessions: u.sessions ? Object.keys(u.sessions).length : 0, sessionsRevoked: u.sessions ? Object.values(u.sessions).filter(s => s && s.revoked).length : 0, avatarLen: (u.avatar || '').length, fcmTokens: (u.fcmTokens || []).length, docSizeApprox: size, updatedAt: vn(tsOf(u.updatedAt)), leadFromAt: u.leadFromAt ? vn(tsOf(u.leadFromAt)) : '-', leadToAt: u.leadToAt ? vn(tsOf(u.leadToAt)) : '-' })); if (u.role !== 'superadmin') console.log('!!! role hiện là "' + u.role + '" — KHÔNG phải superadmin ← ĐÂY LÀ NGUYÊN NHÂN: web hiện giao diện super theo email nhưng Rules đọc users.role → mọi kênh super-only bị permission-denied'); seed.users[uid] = plain(u); }
}
// (2) mọi user superadmin
const us = await db.collection('users').get();
const sups = us.docs.filter(x => (x.data() || {}).role === 'superadmin');
console.log('== users role=superadmin:', sups.length, '==', sups.map(x => x.id.slice(0, 8) + '…(' + mask(x.data().email) + ', active ' + x.data().active + ')').join(' · '));
console.log('== users tổng', us.size, '| active', us.docs.filter(x => x.data().active === true).length, '| pending', us.docs.filter(x => x.data().role === 'pending').length, '==');
// (3) detected_at type của 600 lead mới nhất (query FE "leads cũ" dùng where detected_at < oldest)
const ls = await db.collection('leads').orderBy('detected_at', 'desc').limit(600).get();
const types = {}; let oldest = null; ls.docs.forEach(x => { const v = x.data().detected_at; const t = v === undefined ? 'undefined' : (v === null ? 'null' : (typeof v.toMillis === 'function' ? 'Timestamp' : typeof v)); types[t] = (types[t] || 0) + 1; const ms = tsOf(v); if (!isNaN(ms) && (oldest === null || ms < oldest)) oldest = ms; });
console.log('== leads 600 mới nhất: kiểu detected_at', JSON.stringify(types), '| oldest', vn(oldest), '==');
ls.docs.slice(0, 3).forEach(x => { seed.leads[x.id] = plain(x.data()); });
// (4) outreach_log
const ol = await db.collection('outreach_log').orderBy('at', 'desc').limit(100).get();
const bad = ol.docs.filter(x => { const o = x.data(); return !o.brandCode || !o.at; });
console.log('== outreach_log 100 mới nhất: thiếu brandCode/at', bad.length, '| mới nhất', vn(tsOf(ol.docs[0] && ol.docs[0].data().at)), '==');
ol.docs.slice(0, 3).forEach(x => { seed.outreach_log[x.id] = plain(x.data()); });
const tk = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
(await db.collection('outreach_stats').where('day', '==', tk).limit(3).get()).docs.forEach(x => { seed.outreach_stats[x.id] = plain(x.data()); });
(await db.collection('workers').limit(2).get()).docs.forEach(x => { seed.workers[x.id] = plain(x.data()); });
(await db.collection('scans').orderBy('at', 'desc').limit(2).get()).docs.forEach(x => { seed.scans[x.id] = plain(x.data()); });
fs.writeFileSync(process.env.HOME + '/l38-seed.json', JSON.stringify(seed));
console.log('== đã xuất ~/l38-seed.json (không có avatar/sessions/token) ==');
