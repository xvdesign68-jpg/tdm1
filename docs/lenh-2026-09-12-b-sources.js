/* sources.js — LỆNH B (12/09/2026) — 1 group nhiều brand:
   (1) createSource (onRequest, super/admin brand): tạo nguồn quét qua Admin SDK — id <gid|slug>__<brand>, kiểm trùng (cùng brand + cùng group; cùng brand + cùng tên bỏ dấu), group đã có brand khác → sharedAt/sharedBy/sharedWith.
   (2) sourceOnWrite (onDocumentWritten sources/{id}): group có ≥2 brand → system_status/sources.shared[gkey] (+ push FCM super, console WARNING [SOURCE-SHARED]); so before/after để scanner ghi gid không gây thông báo.
   (3) bdReady (onRequest, ?key=BD_NOTIFY_KEY): webhook notify của BrightData → pending_snapshots PB_/C_ {ready:true} → lượt kế gặt ngay (không chờ BD_PROGRESS_MIN_AGE_S).
   Khởi tạo Admin SDK LƯỜI trong handler (bài học LỆNH #10). Không secret trong file. */
import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
const REGION = 'asia-southeast1', SITE = process.env.SITE_URL || 'https://smartlead.z15miracle.com.vn/app.html';
function ensureApp() { if (!getApps().length) initializeApp(); }
const db = () => { ensureApp(); return getFirestore(); };
export const gidNumOfB = u => { const m = String(u || '').match(/facebook\.com\/groups\/(\d{5,})(?:[\/?#]|$)/i); return m ? m[1] : ''; };
export const slugOfB = u => { const m = String(u || '').match(/facebook\.com\/groups\/([^\/?#]+)/i); return m ? m[1].toLowerCase() : ''; };
export const foldB = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const normUrlB = u => { let s = String(u || '').trim(); if (!s) return ''; if (!/^https?:\/\//i.test(s)) s = 'https://' + s; s = s.replace(/^http:\/\//i, 'https://').replace(/^https:\/\/(m|web|mbasic)\.facebook\.com/i, 'https://www.facebook.com').replace(/^https:\/\/facebook\.com/i, 'https://www.facebook.com'); const m = s.match(/^https:\/\/www\.facebook\.com\/groups\/([^\/?#]+)/i); return m ? ('https://www.facebook.com/groups/' + m[1] + '/') : s.split(/[?#]/)[0]; };
const arrB = v => (Array.isArray(v) ? v : String(v || '').split(/[\n,;]+/)).map(x => String(x || '').trim()).filter(Boolean).slice(0, 100);
/* gkey của 1 nguồn: gid số (URL/field gid) → g_<num>; slug → g_<num> nếu group_state/s_<slug>.gidNum đã học; không thì s_<slug> */
const _gidCache = new Map();
export async function gkeyOfB(s) {
  const n = gidNumOfB(s && s.url) || (/^\d{5,}$/.test(String((s && s.gid) || '').trim()) ? String(s.gid).trim() : ''); if (n) return 'g_' + n;
  const sl = slugOfB(s && s.url); if (!sl) return '';
  if (!_gidCache.has(sl)) { let ln = ''; try { const gs = await db().collection('group_state').doc('s_' + sl).get(); ln = gs.exists ? String((gs.data() || {}).gidNum || '') : ''; } catch (_) { ln = ''; } _gidCache.set(sl, ln); }
  const ln = _gidCache.get(sl); return ln ? 'g_' + ln : 's_' + sl;
}
async function verifyCaller(req) {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || ''); if (!m) return null;
  let dec; try { ensureApp(); dec = await getAuth().verifyIdToken(m[1]); } catch (e) { return null; }
  const email = String(dec.email || '').toLowerCase(); const superEmail = String(process.env.SUPER_EMAIL || '').toLowerCase();
  let d = {}; try { const s = await db().collection('users').doc(dec.uid).get(); d = s.exists ? (s.data() || {}) : {}; } catch (e) { d = {}; }
  if (superEmail && email === superEmail) return { uid: dec.uid, email, role: 'superadmin', brand: String(d.brand || '') };
  if (d.active !== true) return { uid: dec.uid, email, role: 'inactive', brand: '' };
  return { uid: dec.uid, email, role: d.role || 'pending', brand: String(d.brand || '') };
}
/* ---- push helper (bản sao push.js: DATA-ONLY, dọn token chết) ---- */
async function tokensFor(uids) { const out = []; for (const uid of [...new Set((uids || []).filter(Boolean))]) { const d = (await db().doc('users/' + uid).get()).data() || {}; if (d.active === false) continue; (Array.isArray(d.fcmTokens) ? d.fcmTokens : []).forEach(t => out.push({ uid, t })); } return out; }
async function superAdmins() { const q = await db().collection('users').where('role', '==', 'superadmin').get(); return q.docs.filter(d => (d.data() || {}).active !== false).map(d => d.id); }
async function send(recips, data) {
  if (!recips.length) return 0; ensureApp();
  const payload = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v == null ? '' : v)]));
  const res = await getMessaging().sendEachForMulticast({ tokens: recips.map(r => r.t), data: payload, webpush: { headers: { Urgency: 'high', TTL: '3600' } } });
  await Promise.all((res.responses || []).map(async (r, i) => { if (r.success) return; const code = String((r.error && r.error.code) || ''); if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) { const rc = recips[i]; try { await db().doc('users/' + rc.uid).update({ fcmTokens: FieldValue.arrayRemove(rc.t) }); } catch (_) { } } }));
  return res.successCount || 0;
}
/* ---- (1) createSource ---- */
export const createSource = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const caller = await verifyCaller(req); if (!caller) { res.status(401).json({ error: 'unauthenticated' }); return; }
  if (caller.role !== 'superadmin' && caller.role !== 'admin') { res.status(403).json({ error: 'forbidden', message: 'Chỉ Super Admin hoặc admin brand tạo nguồn' }); return; }
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  const url = normUrlB(b.url), name = String(b.name || '').trim().slice(0, 120), brand = String(b.brand || '').trim();
  if (!url || !name || !brand) { res.status(400).json({ error: 'bad_request', message: 'Cần url, name, brand' }); return; }
  if (caller.role === 'admin' && caller.brand !== brand) { res.status(403).json({ error: 'forbidden', message: 'Admin chỉ tạo nguồn cho brand của mình' }); return; }
  const gnum = gidNumOfB(url), slug = slugOfB(url); if (!gnum && !slug) { res.status(400).json({ error: 'bad_url', message: 'URL không phải group Facebook' }); return; }
  const all = (await db().collection('sources').get()).docs.map(d => Object.assign({ __id: d.id }, d.data() || {}));
  const gk = await gkeyOfB({ url, gid: gnum }); const same = []; for (const s of all) { if ((await gkeyOfB(s)) === gk || (slug && slugOfB(s.url) === slug)) same.push(s); }
  const mine = same.filter(s => String(s.brand || '').trim() === brand);
  if (mine.length) { res.status(409).json({ error: 'duplicate', message: 'Brand này đã có nguồn cho group này: ' + (mine[0].name || mine[0].__id), id: mine[0].__id }); return; }
  const dupName = all.find(s => String(s.brand || '').trim() === brand && foldB(s.name) === foldB(name)); if (dupName) { res.status(409).json({ error: 'duplicate_name', message: 'Brand này đã có nguồn tên "' + dupName.name + '"', id: dupName.__id }); return; }
  const others = [...new Set(same.map(s => String(s.brand || '').trim()).filter(Boolean))]; const shared = others.length > 0;
  const id = ((gnum || slug) + '__' + brand).replace(/[^\w-]/g, '_').slice(0, 200);
  const doc = { url, name, brand, active: b.active !== false, industry: String(b.industry || '').slice(0, 80), keywords: arrB(b.keywords), exclude: arrB(b.exclude), commentMode: b.commentMode === 'qualified_only' ? 'qualified_only' : 'full', gid: gnum || (gk.startsWith('g_') ? gk.slice(2) : ''), slug, sharedAt: shared ? Date.now() : null, sharedBy: shared ? caller.uid : null, sharedWith: others, createdAt: FieldValue.serverTimestamp(), createdBy: caller.uid, createdByEmail: caller.email || '' };
  if (b.aiMode === 'max' || b.aiMode === 'saver') doc.aiMode = b.aiMode;
  try { await db().collection('sources').doc(id).create(doc); }
  catch (e) { if (e && (e.code === 6 || /ALREADY_EXISTS/i.test(String(e.message || e)))) { res.status(409).json({ error: 'duplicate', message: 'Nguồn đã tồn tại: ' + id, id }); return; } throw e; }
  console.log('[createSource] ' + id + ' by ' + (caller.email || caller.uid) + (shared ? ' · DÙNG CHUNG với ' + others.join(', ') : ''));
  res.json({ ok: true, id, gkey: gk, shared, sharedWith: others });
});
/* ---- (2) sourceOnWrite ---- */
export const sourceOnWrite = onDocumentWritten({ region: REGION, document: 'sources/{id}', retry: false }, async (ev) => {
  const before = ev.data && ev.data.before && ev.data.before.exists ? ev.data.before.data() : null; const after = ev.data && ev.data.after && ev.data.after.exists ? ev.data.after.data() : null;
  const s = after || before; if (!s) return;
  const chg = k => String((before || {})[k] == null ? '' : (before || {})[k]) !== String((after || {})[k] == null ? '' : (after || {})[k]);
  if (before && after && !chg('gid') && !chg('brand') && !chg('active') && !chg('url') && !chg('sharedAt') && !chg('name')) return; // scanner ghi field khác (không đụng gid/brand) → bỏ qua
  const gk = await gkeyOfB(s); if (!gk) return;
  const all = (await db().collection('sources').get()).docs.map(d => Object.assign({ __id: d.id }, d.data() || {}));
  const members = []; for (const x of all) { if (x.active === false) continue; if ((await gkeyOfB(x)) === gk) members.push(x); }
  const brands = [...new Set(members.map(x => String(x.brand || '').trim()).filter(Boolean))].sort();
  const stRef = db().collection('system_status').doc('sources'); let grew = false, ent = null, removed = false; /* LENH B (rà): transaction — 2 trigger cùng group (scanner ghi gid cho 2 nguồn cùng lượt) không push/WARNING đôi */
  try { await db().runTransaction(async tx => { const st = await tx.get(stRef); const cur = st.exists ? (st.data() || {}) : {}; const prev = (cur.shared && cur.shared[gk]) || null; grew = false; ent = null; removed = false;
    if (brands.length >= 2) {
      grew = !prev || brands.some(b => !(Array.isArray(prev.brands) ? prev.brands : []).includes(b));
      const primary = members.slice().sort((a, b) => (Number(a.sharedAt) || 0) - (Number(b.sharedAt) || 0))[0] || members[0];
      ent = { brands, gid: gk.startsWith('g_') ? gk.slice(2) : '', slug: slugOfB(s.url), name: (primary && primary.name) || '', url: (primary && primary.url) || s.url || '', since: (prev && prev.since) ? prev.since : Date.now(), by: (after && after.sharedBy) ? after.sharedBy : ((prev && prev.by) || ''), at: Date.now(), sources: members.map(m => ({ id: m.__id, brand: String(m.brand || ''), name: m.name || '' })), ackAt: grew ? null : ((prev && prev.ackAt) || null) };
      tx.set(stRef, { shared: { [gk]: ent }, at: Date.now() }, { merge: true });
    } else if (prev) { removed = true; tx.set(stRef, { shared: { [gk]: FieldValue.delete() }, at: Date.now() }, { merge: true }); } }); }
  catch (e) { console.warn('[SOURCE-SHARED] transaction lỗi', e && e.message); return; }
  if (ent && grew) {
    console.log(JSON.stringify({ severity: 'WARNING', message: '[SOURCE-SHARED] group ' + (ent.name || gk) + ' giờ dùng chung: ' + brands.join(' + ') + ' (mỗi brand chấm bằng Hồ sơ AI riêng → lead riêng; automation first-come)' }));
    try { const n = await send(await tokensFor(await superAdmins()), { title: '👥 Group dùng chung: ' + (ent.name || gk), body: brands.join(' + ') + ' cùng quét 1 group — kiểm Nguồn quét', link: SITE + '#sources', tag: 'shared-' + gk, require: '1', actionTitle: 'Mở Nguồn quét' }); console.log('[SOURCE-SHARED] push super sent', n); }
    catch (e) { console.warn('[SOURCE-SHARED] push lỗi', e && e.message); }
  }
  if (removed) console.log('[SOURCE-SHARED] group ' + gk + ' không còn dùng chung');
});
/* ---- (3) bdReady (notify webhook BrightData; chỉ dùng khi .env BD_NOTIFY_URL/BD_NOTIFY_KEY đặt) ---- */
export const bdReady = onRequest({ region: REGION, cors: false }, async (req, res) => {
  const key = String((req.query && req.query.key) || req.get('X-Notify-Key') || ''); const want = String(process.env.BD_NOTIFY_KEY || '');
  if (!want || key !== want) { res.status(403).json({ error: 'forbidden' }); return; }
  const b = (req.body && typeof req.body === 'object') ? req.body : {}; const sid = String(b.snapshot_id || b.id || (req.query && req.query.snapshot_id) || '').replace(/[^\w-]/g, '_').slice(0, 470);
  if (!sid) { res.status(400).json({ error: 'no_snapshot' }); return; }
  const st = String(b.status || 'ready'); let n = 0;
  for (const pre of ['PB_', 'C_']) { const ref = db().collection('pending_snapshots').doc(pre + sid); try { const s = await ref.get(); if (s.exists) { await ref.set({ ready: (st === 'ready' || st === 'done'), readyAt: Date.now(), notifyStatus: st }, { merge: true }); n++; } } catch (_) {} }
  res.json({ ok: true, updated: n });
});
