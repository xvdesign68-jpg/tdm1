/* authmemcf.js — LỆNH G (13/09/2026) PC-3 "bộ nhớ người viết":
   CF clearAuthorMemory (onRequest, Bearer idToken; region asia-southeast1; cors) — CHỈ Super Admin. body { key? | author_url? + author_uid?, action: 'clear' | 'seller', post_url?, note? }
   'clear'  = "Không phải người bán": xoá nhãn người bán quen (sellerHits 0, sellerIds [], lastRole '', lastSellerAt 0, clearedAt/By) — bài của người này lại được AI chấm bình thường;
   'seller' = "Đánh dấu người bán": sellerHits 2 + buyerHits 0 + lastSellerAt now + markedBy → mọi bài mới của người này bỏ trước AI (30 ngày, tự hết hạn; sau đó AI chấm lại).
   Mỗi thao tác ghi 1 doc ai_feedback {kind, key, by, at, post_url, note} (nuôi PC-1 Sổ tay brand). Ghi bằng Admin SDK (Rules author_memory/ai_feedback write=false). Khởi tạo LƯỜI (bài học LỆNH #10). Không secret. */
import { onRequest } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const REGION = 'asia-southeast1';
function ensureApp() { if (!getApps().length) initializeApp(); }
const db = () => { ensureApp(); return getFirestore(); };
export function authorKeyOfG(url, uid) { const s = String(url || '').trim(); let m = s.match(/profile\.php\?id=(\d+)/) || s.match(/\/people\/[^/]+\/(\d+)/); if (m) return 'id:' + m[1]; m = s.match(/facebook\.com\/([A-Za-z0-9.]{3,})\/?(?:[?#]|$)/); if (m && !/^(groups|people|profile\.php|photo|photos|watch|share|reel|reels|stories|events|pages|marketplace|hashtag|posts|permalink\.php|story\.php)$/i.test(m[1])) return 'u:' + m[1].toLowerCase(); const u = String(uid || '').trim(); return /^\d{5,}$/.test(u) ? 'id:' + u : ''; }
export const memIdOfG = k => String(k || '').replace(/[^\w.:-]/g, '_').slice(0, 300);
async function verifySuper(req) {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || ''); if (!m) return null;
  let dec; try { ensureApp(); dec = await getAuth().verifyIdToken(m[1]); } catch (e) { return null; }
  const email = String(dec.email || '').toLowerCase(); const superEmail = String(process.env.SUPER_EMAIL || '').toLowerCase();
  if (superEmail && email === superEmail) return { uid: dec.uid, email, role: 'superadmin' };
  let d = {}; try { const s = await db().collection('users').doc(dec.uid).get(); d = s.exists ? (s.data() || {}) : {}; } catch (e) { d = {}; }
  return { uid: dec.uid, email, role: (d.role === 'superadmin' && d.active !== false) ? 'superadmin' : String(d.role || 'pending') };
}
export const clearAuthorMemory = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const caller = await verifySuper(req); if (!caller) { res.status(401).json({ error: 'unauthenticated' }); return; }
  if (caller.role !== 'superadmin') { res.status(403).json({ error: 'forbidden', message: 'Chỉ Super Admin' }); return; }
  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  const key = String(b.key || '').trim() || authorKeyOfG(b.author_url, b.author_uid);
  if (!key || !/^(id:\d{5,}|u:[a-z0-9.]{3,})$/.test(key)) { res.status(400).json({ error: 'bad_request', message: 'Cần khoá người viết (id:<uid> | u:<username>) hoặc author_url/author_uid giải mã được' }); return; }
  const action = b.action === 'seller' ? 'seller' : 'clear'; const now = Date.now(); const ref = db().collection('author_memory').doc(memIdOfG(key));
  const up = action === 'seller'
    ? { key, sellerHits: 2, buyerHits: 0, lastRole: 'seller', lastSellerAt: now, lastAt: now, markedAt: now, markedBy: caller.email, updatedAt: now, expireAt: new Date(now + 180 * 86400e3) }
    : { key, sellerHits: 0, sellerIds: [], lastRole: '', lastSellerAt: 0, clearedAt: now, clearedBy: caller.email, updatedAt: now, expireAt: new Date(now + 180 * 86400e3) };
  await ref.set(up, { merge: true });
  try { await db().collection('ai_feedback').add({ kind: action === 'seller' ? 'mark_seller' : 'not_seller', key, by: caller.email, by_uid: caller.uid, at: now, post_url: String(b.post_url || '').slice(0, 300), note: String(b.note || '').slice(0, 300) }); } catch (e) { console.warn('[LENH G] ai_feedback', e && e.message); }
  res.json({ ok: true, key, action });
});
