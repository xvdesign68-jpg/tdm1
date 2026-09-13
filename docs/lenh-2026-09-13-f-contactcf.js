/* contactcf.js — LỆNH F (13/09/2026) PA-5 "SĐT gọi được ngay":
   CF zaloCheckLead (onRequest, Bearer idToken; region asia-southeast1; cors): body { leadId, phone?, force? }
   (1) phone → đặt SĐT cho lead ("Dùng số này" từ số khác bôi trong bài/bình luận): chuẩn hoá E.164 (+84…, nhận cả số bàn 02x), ghi phone / phone_prev / contact_source 'manual' / phone_set_by,at;
   (2) kiểm Zalo qua eKYC Pro (checkZalo, cache zalo_cache 90 ngày) cho SĐT di động chưa có kết quả (lead lạnh bị hoãn lúc quét — LỆNH #48) hoặc force → phone_has_zalo, zalo_defer:false, zalo_checked_at.
   Quyền: Super Admin, hoặc admin/sales đang active CÙNG brand lead. Ghi bằng Admin SDK (không cần Rules). Khởi tạo Admin SDK LƯỜI trong handler (bài học LỆNH #10). Không secret trong file (EKYCPRO_API_KEY từ .env). */
import { onRequest } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { checkZalo } from './lib/zaloCheck.js';
const REGION = 'asia-southeast1';
function ensureApp() { if (!getApps().length) initializeApp(); }
const db = () => { ensureApp(); return getFirestore(); };
export const normPhoneF = raw => { let d = String(raw || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); if (d.startsWith('84')) d = d.slice(2); else if (d.startsWith('0')) d = d.slice(1); else return ''; return /^([35789]\d{8}|2\d{9})$/.test(d) ? '+84' + d : ''; };
export const isMobileF = e164 => /^\+84[35789]\d{8}$/.test(String(e164 || ''));
async function verifyCaller(req) {
  const m = /^Bearer (.+)$/.exec(req.get('Authorization') || ''); if (!m) return null;
  let dec; try { ensureApp(); dec = await getAuth().verifyIdToken(m[1]); } catch (e) { return null; }
  const email = String(dec.email || '').toLowerCase(); const superEmail = String(process.env.SUPER_EMAIL || '').toLowerCase();
  let d = {}; try { const s = await db().collection('users').doc(dec.uid).get(); d = s.exists ? (s.data() || {}) : {}; } catch (e) { d = {}; }
  if (superEmail && email === superEmail) return { uid: dec.uid, email, role: 'superadmin', brand: String(d.brand || '') };
  if (d.role === 'superadmin' && d.active !== false) return { uid: dec.uid, email, role: 'superadmin', brand: String(d.brand || '') };
  if (d.active !== true) return { uid: dec.uid, email, role: 'inactive', brand: '' };
  return { uid: dec.uid, email, role: d.role || 'pending', brand: String(d.brand || '') };
}
export const zaloCheckLead = onRequest({ region: REGION, cors: true }, async (req, res) => {
  const caller = await verifyCaller(req); if (!caller) { res.status(401).json({ error: 'unauthenticated' }); return; }
  if (!/^(superadmin|admin|sales)$/.test(caller.role)) { res.status(403).json({ error: 'forbidden', message: 'Tài khoản chưa được duyệt' }); return; }
  const b = (req.body && typeof req.body === 'object') ? req.body : {}; const leadId = String(b.leadId || '').trim();
  if (!leadId || /\//.test(leadId)) { res.status(400).json({ error: 'bad_request', message: 'Cần leadId' }); return; }
  const ref = db().collection('leads').doc(leadId); const snap = await ref.get(); if (!snap.exists) { res.status(404).json({ error: 'not_found', message: 'Không thấy lead' }); return; }
  const d = snap.data() || {};
  if (caller.role !== 'superadmin' && String(d.brand || d.brand_hint || '') !== caller.brand) { res.status(403).json({ error: 'forbidden', message: 'Lead thuộc brand khác' }); return; }
  const up = {}; let phone = String(d.phone || ''); let changed = false;
  if (b.phone !== undefined && b.phone !== null && String(b.phone).trim()) {
    const p = normPhoneF(b.phone); if (!p) { res.status(400).json({ error: 'bad_phone', message: 'SĐT không hợp lệ (cần số VN 10 số hoặc số bàn 11 số)' }); return; }
    if (p !== phone) { if (phone) up.phone_prev = phone; up.phone = p; up.phone_has_zalo = null; up.contact_source = 'manual'; up.phone_set_by = caller.email; up.phone_set_at = Date.now(); changed = true; }
    phone = p;
  }
  if (!phone) { if (Object.keys(up).length) await ref.update(up); res.json({ ok: true, phone: '', registered: null, source: 'no_phone' }); return; }
  let registered = (!changed && !b.force && typeof d.phone_has_zalo === 'boolean') ? d.phone_has_zalo : null; let source = registered === null ? '' : 'lead';
  if (registered === null) {
    if (isMobileF(phone)) {
      let r = { registered: null, source: 'error' };
      try { r = await checkZalo(phone, { db: db(), apiKey: process.env.EKYCPRO_API_KEY, cacheDays: 90 }); } catch (e) { r = { registered: null, source: 'error:' + String((e && e.message) || e).slice(0, 80) }; }
      registered = (typeof r.registered === 'boolean') ? r.registered : null; source = r.source || '';
      if (registered !== null) { up.phone_has_zalo = registered; up.zalo_defer = false; up.zalo_checked_at = Date.now(); }
    } else source = 'landline';
  }
  if (Object.keys(up).length) await ref.update(up);
  res.json({ ok: true, phone, registered, source, mobile: isMobileF(phone), changed });
});
