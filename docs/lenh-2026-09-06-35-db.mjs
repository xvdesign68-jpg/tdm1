// LENH #35 (06/09/2026) — CHỈ ĐỌC, đặt trong ~/firebase-s13/functions: hồ sơ user super + đếm outreach_stats hôm nay + user đang active (che email)
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const mask = e => String(e || '').replace(/^(..)[^@]*(@.*)$/, '$1***$2');
const tk = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const us = await db.collection('users').get();
console.log('== USERS (' + us.size + ') ==');
us.docs.forEach(d => { const u = d.data(); console.log(' -', d.id.slice(0, 8) + '…', mask(u.email), '| role', u.role || '-', '| active', u.active, '| brand', u.brand || '-', '| provider', u.provider || '-'); });
const st = await db.collection('outreach_stats').where('day', '==', tk).get();
console.log('== outreach_stats ngày', tk, ':', st.size, 'doc ==');
st.docs.forEach(d => { const x = d.data(); console.log(' -', d.id, JSON.stringify({ brandCode: x.brandCode, day: x.day, react: x.react, comment: x.comment, friend: x.friend, inbox: x.inbox, replied: x.replied })); });
const all = await db.collection('outreach_stats').get();
const bad = all.docs.filter(d => { const x = d.data(); return !x.brandCode || !x.day; });
console.log('outreach_stats tổng', all.size, 'doc · thiếu brandCode/day:', bad.length, bad.slice(0, 5).map(d => d.id).join(', '));
