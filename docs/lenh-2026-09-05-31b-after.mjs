/* _l31_after.mjs — nghiệm thu LỆNH #31b: node _l31_after.mjs [giờ=3] */
import admin from 'firebase-admin'; if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore(); const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
const H = Number(process.argv[2]) || 3; const since = new Date(Date.now() - H * 3600e3);
const sp = await db.collection('scanned_posts').where('createdAt', '>=', since).get();
const dec = {}; sp.forEach(d => { const x = d.data(); dec[x.decision || '?'] = (dec[x.decision || '?'] || 0) + 1; });
console.log(`scanned_posts ${H}h:`, sp.size, JSON.stringify(dec));
for (const k of ['self_comment', 'seller']) for (const d of sp.docs.filter(d => d.data().decision === k).slice(0, 4)) { const x = d.data(); console.log(`   ${k}:`, cut(x.author, 20), 'vs chủ bài', cut(x.parent_author, 20), '| role', x.role || '-', '||', JSON.stringify(cut(x.text, 60))); }
const ls = await db.collection('leads').where('detected_at', '>=', since).get();
const roles = {}; ls.forEach(d => { const r = d.data().role; roles[r || '(rỗng)'] = (roles[r || '(rỗng)'] || 0) + 1; });
console.log(`leads mới ${H}h:`, ls.size, '| vai:', JSON.stringify(roles), '(rỗng = chấm trước bản vá / heuristic)');
const lg = await db.collection('outreach_log').where('at', '>=', since).get();
const skips = lg.docs.map(d => d.data()).filter(x => x.status === 'skip');
console.log(`outreach_log ${H}h:`, lg.size, '| ⏭ skip:', skips.length); for (const x of skips.slice(0, 8)) console.log('   ', x.brandCode, '|', cut(x.name, 20), '|', cut(x.action, 100));
const th = await db.collection('outreach_threads').where('step', '==', 'skipped_role').get(); console.log('outreach_threads step=skipped_role:', th.size);
const selfLeads = await db.collection('leads').where('role', '==', 'poster_self').get(); const sel = await db.collection('leads').where('role', '==', 'seller').get();
console.log('leads role poster_self:', selfLeads.size, '| seller:', sel.size);
