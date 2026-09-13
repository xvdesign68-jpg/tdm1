# bash — LỆNH F · KHỐI 1 (13/09/2026) — Đợt 2.4 PA-5 "SĐT GỌI ĐƯỢC NGAY": gom SĐT/bình luận CÙNG TÁC GIẢ vào lead (chủ bài tự bình luận → text_extra + SĐT; khách X bình luận nhiều lần → comment-lead mang bình luận kia) + CF zaloCheckLead ("Dùng số này" + "Kiểm Zalo" từ web)
#   Mốc trên mã SAU LỆNH E (index.js có marker LENH E). Patch 1 file index.js (9 mốc, marker LENH F, fail-closed NGUYÊN TỬ, idempotent) + file MỚI contactcf.js (CF zaloCheckLead, import lib/zaloCheck.js có sẵn) + `export * from './contactcf.js'`.
#   Không đổi Rules (CF ghi bằng Admin SDK), không index mới, không worker. Fail-closed gom: khoá tác giả = link hồ sơ hoặc tên bỏ dấu KHÔNG ẩn danh — không gán SĐT người khác.
#   Thứ tự: backup .bak-<TS> (index.js, contactcf.js nếu có) → chép contactcf.js → patch → node --check → import test (.env: scheduledScan/zaloCheckLead/normPhoneF) → deploy scheduledScan + manualScan + zaloCheckLead (gated "Deploy complete") → describe 3 function.
# Dán: tạo file /tmp/lf.sh bằng heredoc quoted rồi bash /tmp/lf.sh   (không shebang, không dấu chấm than ngoài heredoc — Cloud Shell history-expand)
set -o pipefail
cd ~/firebase-s13/functions || { echo 'DỪNG: không vào được ~/firebase-s13/functions'; exit 1; }
TS=$(date -u +%Y%m%d-%H%M%S); echo "backup TS=$TS (giờ UTC)"
cat > _lf_patch.cjs <<'EOF_PATCH'
/* LỆNH F (13/09/2026) — Đợt 2.4 PA-5 "SĐT gọi được ngay": gom SĐT/bình luận CÙNG TÁC GIẢ vào lead (index.js) — mốc trên MÃ SAU LỆNH E (index.js có marker LENH E + LENH D + LENH C).
   (a) Chủ bài tự bình luận dưới bài mình (self_comment — LỆNH #31 đã nhận diện: profile key trùng hoặc tên bỏ dấu trùng, không ẩn danh) → nội dung ghép vào `text_extra` của bài (≤3 bình luận, ≤600 ký tự):
       bài còn trong lượt (quét tay/backfill/quét ngay) → gắn vào ứng viên trước Pha 3b; bài đã thành lead ở lượt trước (đường gieo/gặt theo lịch: bình luận về sau bài 1–2 lượt) → cập nhật lead (`text_extra`, SĐT nếu lead chưa có → `contact_source:'comment'`, eKYC chỉ khi lead nóng/ấm, lạnh → `zalo_defer`).
   (b) Người X bình luận ≥2 lần dưới 1 bài → comment-lead của X mang các bình luận khác của X (`text_extra`) → SĐT X để ở bình luận kế được bắt.
   (c) Pha 3b: `enrichPhoneFromText(text + '\n' + text_extra)`; lead ghi `text_extra`, `contact_source` ('post' | 'comment'); scans đếm `cmtExtra` (bài nhận bình luận cùng tác giả), `phoneFromCmt` (SĐT lấy từ bình luận).
   (d) `export * from './contactcf.js'` — CF `zaloCheckLead` (file riêng, .sh chép vào): "Dùng số này" + "Kiểm Zalo" từ web.
   Fail-closed: khoá tác giả = profile key hoặc tên bỏ dấu KHÔNG ẩn danh; không khoá → không gom (không bao giờ gán SĐT người khác). Marker `LENH F`, 9 mốc, NGUYÊN TỬ (đủ mốc mới ghi), idempotent.
   Dùng: node _lf_patch.cjs index.js   (cwd = ~/firebase-s13/functions) */
'use strict';
const fs = require('fs');
const FI = process.argv[2]; if (!FI) { console.error('cần đường dẫn index.js'); process.exit(2); }
let s = fs.readFileSync(FI, 'utf8');
if (/LENH F\b/.test(s)) { console.log('đã vá (marker LENH F có sẵn) — idempotent, bỏ qua'); process.exit(0); }
if (!/LENH E\b/.test(s) || !/LENH D\b/.test(s) || !/LENH C\b/.test(s) || !/LENH B\b/.test(s)) { console.error('DỪNG: index.js thiếu marker LENH B/C/D/E (mốc F đặt trên mã sau E). KHÔNG ghi gì.'); process.exit(1); }
const ops = [];
const A = (label, from, to) => { const n = s.split(from).length - 1; if (n !== 1) { console.error('DỪNG: mốc ' + label + ' gặp ' + n + ' lần (cần đúng 1). KHÔNG ghi gì.'); process.exit(1); } ops.push([label, from, to]); };

A('F1 ctx bài cha giữ post_id + ứng viên',
  "const cB = { effSrc: x.effSrc, src: x.src, row: x.row, parentAuthor: x.post.author || '', parentText: x.post.text || '', parentUrl: x.post.url || '', parentUserUrl: x.post.user_url || '', gid: x.post.gid || '' }; /* v-selfcmt · LENH B */",
  "const cB = { effSrc: x.effSrc, src: x.src, row: x.row, parentAuthor: x.post.author || '', parentText: x.post.text || '', parentUrl: x.post.url || '', parentUserUrl: x.post.user_url || '', gid: x.post.gid || '', parentPostId: x.post.post_id || '', parentX: x }; /* v-selfcmt · LENH B · LENH F: parentX = ứng viên còn trong lượt (bình luận chủ bài gắn thẳng text_extra) */");
A('F2 bộ đếm',
  "  const distV2E = { hot: 0, warm: 0, cold: 0, junk: 0 }; let roleUnknownE = 0; /* LENH E: phân bố nhiệt độ theo điểm tiêu chí (chạy bóng) · AI trả vai rỗng/other mà vẫn is_real_lead (N2-12: chỉ đếm) */",
  "  const distV2E = { hot: 0, warm: 0, cold: 0, junk: 0 }; let roleUnknownE = 0; /* LENH E: phân bố nhiệt độ theo điểm tiêu chí (chạy bóng) · AI trả vai rỗng/other mà vẫn is_real_lead (N2-12: chỉ đếm) */\n" +
  "  let cmtExtraF = 0, phoneCmtF = 0; /* LENH F (PA-5): bài/bình luận nhận thêm bình luận cùng tác giả · SĐT lấy từ bình luận */");
A('F3 khoá tác giả + gom trước vòng bình luận',
  "      for (const { comment, parentUrl } of [...hvCmts, ...cmts]) { // v-sowc: comment đã gặt + comment quét ngay (quét tay/backfill)",
  "      /* LENH F (PA-5): gom bình luận CÙNG TÁC GIẢ — (a) chủ bài tự bình luận (self_comment) → text_extra của bài (SĐT hay nằm ở đây); (b) người X bình luận ≥2 lần dưới 1 bài → comment-lead của X mang các bình luận khác của X.\n" +
  "         Khoá tác giả = profile key (LỆNH #31) hoặc tên bỏ dấu KHÔNG ẩn danh; không khoá → không gom (fail-closed, không gán nhầm SĐT người khác). */\n" +
  "      const authKeyF = (cm) => { const k = __slProfileKey31(cm && cm.user_url); if (k) return k; const a = __slFold31(cm && cm.author); return (a && !__SL_ANON31.test(a)) ? 'n:' + a : ''; };\n" +
  "      const byAuthF = new Map(); const listF = [...hvCmts, ...cmts];\n" +
  "      for (const { comment, parentUrl } of listF) { if (!comment || !comment.text || !String(comment.text).trim()) continue; const k0 = urlKey(parentUrl), k1 = urlKey(comment.parent_url); const kk = ctx.has(k0) ? k0 : (ctx.has(k1) ? k1 : ''); const ak = kk ? authKeyF(comment) : ''; if (!ak) continue; const key = kk + '|' + ak; (byAuthF.get(key) || byAuthF.set(key, []).get(key)).push(comment); }\n" +
  "      const extraF = (cm, kk) => { const ak = authKeyF(cm); if (!ak) return ''; const out = []; for (const z of (byAuthF.get(kk + '|' + ak) || [])) { if (z === cm) continue; const t = String(z.text || '').trim(); if (!t) continue; out.push(t.slice(0, 220)); if (out.length >= 3) break; } return out.join('\\n').slice(0, 600); };\n" +
  "      const selfExtraF = new Map(); /* k bài → bình luận của chủ bài */\n" +
  "      for (const { comment, parentUrl } of listF) { // v-sowc: comment đã gặt + comment quét ngay (quét tay/backfill) · LENH F: duyệt listF");
A('F4 trong vòng: chủ bài → selfExtraF · người X → text_extra',
  "        comment.parent_user_url = c.parentUserUrl || ''; comment.self_comment = __slIsSelfComment31(comment); /* v-selfcmt */",
  "        comment.parent_user_url = c.parentUserUrl || ''; comment.self_comment = __slIsSelfComment31(comment); /* v-selfcmt */\n" +
  "        { const kkF = ctx.has(k0) ? k0 : k1; if (comment.self_comment) { const arrF = selfExtraF.get(kkF) || selfExtraF.set(kkF, []).get(kkF); if (arrF.length < 3) arrF.push(String(comment.text).trim().slice(0, 220)); } else { const exF = extraF(comment, kkF); if (exF) { comment.text_extra = exF; cmtExtraF++; } } } /* LENH F */");
A('F5 sau vòng: bình luận chủ bài → ứng viên còn trong lượt hoặc lead đã có',
  "    } catch (e) { console.error('fetchComments lỗi:', e.message); }",
  "      /* LENH F (PA-5): bình luận của CHỦ BÀI → text_extra của bài: ứng viên còn trong lượt → gắn thẳng; bài đã thành lead ở lượt trước (đường gieo/gặt) → cập nhật lead theo post_url (mọi brand dùng chung), SĐT nếu lead chưa có */\n" +
  "      for (const [kkF, arrF] of selfExtraF) { const cF = ctx.get(kkF); if (!cF) continue; const txF = arrF.join('\\n').slice(0, 600); if (!txF) continue; cmtExtraF++;\n" +
  "        const allF = ctxAllB.get(kkF) || [cF]; let sameRunF = false; for (const ccF of allF) { if (ccF.parentX && ccF.parentX.post) { ccF.parentX.post.text_extra = String((ccF.parentX.post.text_extra ? ccF.parentX.post.text_extra + '\\n' : '') + txF).slice(0, 600); sameRunF = true; } }\n" +
  "        if (sameRunF || !cF.parentUrl) continue;\n" +
  "        try { const qF = await db.collection('leads').where('post_url', '==', String(cF.parentUrl)).limit(6).get();\n" +
  "          for (const dsF of qF.docs) { const dF = dsF.data() || {}; if (dF.kind === 'comment' || dF.comment_id) continue; if (dF.text_extra && String(dF.text_extra).includes(txF.slice(0, 80))) continue;\n" +
  "            const upF = { text_extra: String(dF.text_extra ? (dF.text_extra + '\\n' + txF) : txF).slice(0, 600), text_extra_at: Date.now() };\n" +
  "            if (!dF.phone) { const hotF = (dF.temp === 'hot' || dF.temp === 'warm'); const zF = await enrichPhoneFromText(txF, { db, apiKey: process.env.EKYCPRO_API_KEY, doCheck: process.env.ZALO_CHECK_ENABLED !== 'false' && (hotF || CFG.ZALO_CHECK_COLD === true), cacheDays: 90 });\n" +
  "              if (zF.phone) { upF.phone = zF.phone; upF.phone_has_zalo = zF.phone_has_zalo; upF.contact_source = 'comment'; upF.zalo_defer = !(hotF || CFG.ZALO_CHECK_COLD === true); if (!dF.email && zF.email) upF.email = zF.email; phoneCmtF++; } }\n" +
  "            await dsF.ref.update(upF); } } catch (eF) { console.warn('[LENH F] cập nhật lead từ bình luận chủ bài lỗi:', (eF && eF.message) || eF); } }\n" +
  "    } catch (e) { console.error('fetchComments lỗi:', e.message); }");
A('F6 Pha 3b: bắt SĐT trong text + text_extra',
  "    const _zc = await enrichPhoneFromText((x.post.text || ''), { db, apiKey: process.env.EKYCPRO_API_KEY, doCheck: process.env.ZALO_CHECK_ENABLED !== 'false' && !zaloDefer48, cacheDays: 90 });",
  "    const _txExtraF = String(x.post.text_extra || '').slice(0, 600); /* LENH F (PA-5): bình luận cùng tác giả (chủ bài tự bình luận / X bình luận nhiều lần) — SĐT hay nằm ở đây */\n" +
  "    const _zc = await enrichPhoneFromText((x.post.text || '') + (_txExtraF ? '\\n' + _txExtraF : ''), { db, apiKey: process.env.EKYCPRO_API_KEY, doCheck: process.env.ZALO_CHECK_ENABLED !== 'false' && !zaloDefer48, cacheDays: 90 });\n" +
  "    const _srcF = _zc.phone ? (((await enrichPhoneFromText((x.post.text || ''), { db, doCheck: false })).phone === _zc.phone) ? 'post' : 'comment') : ''; if (_srcF === 'comment') phoneCmtF++; /* LENH F: nguồn SĐT */");
A('F7 lead ghi text_extra + contact_source',
  "        phone: _zc.phone, phone_has_zalo: _zc.phone_has_zalo, email: _zc.email || '',",
  "        phone: _zc.phone, phone_has_zalo: _zc.phone_has_zalo, email: _zc.email || '',\n" +
  "        text_extra: _txExtraF, contact_source: _srcF, /* LENH F (PA-5): bình luận cùng tác giả · SĐT lấy từ bài hay bình luận */");
A('F8 scans summary',
  "    promptV2: v2E.prompt, scoreV2: v2E.mode, distV2: distV2E, roleUnknown: roleUnknownE, noProfileBrands: [...noProfileE].slice(0, 20), /* LENH E */",
  "    promptV2: v2E.prompt, scoreV2: v2E.mode, distV2: distV2E, roleUnknown: roleUnknownE, noProfileBrands: [...noProfileE].slice(0, 20), /* LENH E */\n" +
  "    cmtExtra: cmtExtraF, phoneFromCmt: phoneCmtF, /* LENH F (PA-5) */");
A('F9 export contactcf.js',
  "export * from './sources.js'; /* LENH B: createSource · sourceOnWrite · bdReady */",
  "export * from './sources.js'; /* LENH B: createSource · sourceOnWrite · bdReady */\nexport * from './contactcf.js'; /* LENH F (PA-5): zaloCheckLead — Dùng số này + Kiểm Zalo từ web */");
for (const [, from, to] of ops) s = s.replace(from, () => to);
for (const [label, , to] of ops) { if (s.split(to).length - 1 !== 1) { console.error('DỪNG: sau thay mốc ' + label + ' không đúng 1 lần — KHÔNG ghi gì.'); process.exit(1); } }
if (!/LENH F\b/.test(s)) { console.error('DỪNG: sau vá không có marker LENH F — KHÔNG ghi gì.'); process.exit(1); }
fs.writeFileSync(FI, s);
console.log('PATCH OK index.js (LENH F): ' + ops.length + ' mốc — ctx parentPostId/parentX · bộ đếm · khoá tác giả + gom bình luận (chủ bài → text_extra bài · X nhiều bình luận → text_extra comment-lead) · cập nhật lead đã có theo post_url · Pha 3b bắt SĐT text+text_extra · lead text_extra/contact_source · scans cmtExtra/phoneFromCmt · export contactcf.js');
EOF_PATCH
cat > _lf_contactcf.js <<'EOF_CF'
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
EOF_CF
cat > _lf_after.mjs <<'EOF_AFTER'
/* LỆNH F · KHỐI 2 — CHỈ ĐỌC (đặt trong ~/firebase-s13/functions, chạy ≥15′ sau deploy; tốt nhất 1–2 giờ ban ngày khi có bình luận). Không ghi gì.
   In: (1) 10 lượt quét gần nhất: cmtExtra/phoneFromCmt/commentsFetched · (2) lead 24 h: có text_extra, contact_source (post/comment/manual), có SĐT theo nguồn, kiểm Zalo · (3) lead có SĐT 7 ngày: tỉ lệ có SĐT trước/sau F · (4) zaloCheckLead: lead phone_set_by 7 ngày · (5) describe CF. Đọc theo trang ≤300 + select() (kèm field orderBy). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const OFF = 7 * 3600e3, now = Date.now(); const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const hm = v => ms(v) ? new Date(ms(v) + OFF).toISOString().slice(5, 16).replace('T', ' ') : '—';
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField, 'desc').limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
const sec = async (label, fn) => { try { await fn(); } catch (e) { console.log(label + ' LỖI (mục này bỏ qua, mục sau vẫn chạy): ' + String(e && e.message).slice(0, 220)); } };
const cnt = (arr, f) => arr.reduce((m, x) => { const k = String(f(x)); m[k] = (m[k] || 0) + 1; return m; }, {});
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + ' %' : '—';
console.log('== LỆNH F KHỐI 2 — ' + new Date(now + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN ==');
await sec('1.', async () => {
  const sc = await pageAll(db.collection('scans').where('at', '>=', new Date(now - 6 * 3600e3)), 'at', ['at', 'trigger', 'status', 'cmtExtra', 'phoneFromCmt', 'commentsFetched', 'leadsCreated', 'postsFetched', 'durationMs'], 600);
  const f = sc.filter(s => s.cmtExtra !== undefined); console.log('1. lượt quét 6 h: ' + sc.length + ' · bản F (có cmtExtra): ' + f.length + ' · Σ cmtExtra ' + f.reduce((a, s) => a + (s.cmtExtra || 0), 0) + ' · Σ phoneFromCmt ' + f.reduce((a, s) => a + (s.phoneFromCmt || 0), 0) + '   (kỳ vọng: mọi lượt sau deploy có cmtExtra; số > 0 khi có bình luận cùng tác giả)');
  sc.slice(0, 10).forEach(s => console.log('   ' + hm(s.at) + ' ' + String(s.trigger || '').padEnd(9) + ' ' + String(s.status || '').padEnd(6) + (s.cmtExtra === undefined ? ' (trước F)' : ' cmtExtra ' + s.cmtExtra + ' · phoneFromCmt ' + s.phoneFromCmt) + ' · bình luận ' + (s.commentsFetched || 0) + ' · bài ' + (s.postsFetched || 0) + '/lead ' + (s.leadsCreated || 0) + ' · ' + Math.round((s.durationMs || 0) / 1000) + ' s'));
});
await sec('2.', async () => {
  const ls = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 864e5)), 'detected_at', ['text_extra', 'contact_source', 'phone', 'phone_has_zalo', 'zalo_defer', 'temp', 'brand', 'kind', 'name', 'text_extra_at', 'phone_set_by'], 3000);
  const withX = ls.filter(l => l.text_extra), withP = ls.filter(l => l.phone);
  console.log('2. lead 24 h: ' + ls.length + ' · có text_extra ' + withX.length + ' · có SĐT ' + withP.length + ' (' + pct(withP.length, ls.length) + ') · contact_source ' + JSON.stringify(cnt(withP, l => l.contact_source || '(trước F)')) + ' · kiểm Zalo ' + JSON.stringify(cnt(withP, l => l.phone_has_zalo === true ? 'có' : l.phone_has_zalo === false ? 'không' : (l.zalo_defer ? 'hoãn (lạnh)' : 'chưa'))));
  withX.slice(0, 6).forEach(l => console.log('   ' + String(l.brand || '').padEnd(12) + ' ' + String(l.name || '').slice(0, 18).padEnd(18) + ' ' + (l.kind === 'comment' ? 'bình luận' : 'bài     ') + ' · SĐT ' + (l.phone || '—') + ' (' + (l.contact_source || '') + ') · thêm: ' + String(l.text_extra || '').replace(/\s+/g, ' ').slice(0, 90)));
  const cmtP = withP.filter(l => l.contact_source === 'comment'); if (cmtP.length) console.log('   → ' + cmtP.length + ' lead có SĐT NHỜ bình luận cùng tác giả (trước F sales không có số để gọi)');
});
await sec('3.', async () => {
  const ls = await pageAll(db.collection('leads').where('detected_at', '>=', new Date(now - 7 * 864e5)), 'detected_at', ['phone', 'contact_source', 'kind'], 6000);
  const f = ls.filter(l => l.contact_source !== undefined), o = ls.filter(l => l.contact_source === undefined);
  console.log('3. lead 7 ngày: ' + ls.length + ' · tỉ lệ có SĐT — bản F: ' + pct(f.filter(l => l.phone).length, f.length) + ' (n ' + f.length + ') · trước F: ' + pct(o.filter(l => l.phone).length, o.length) + ' (n ' + o.length + ')   (đo lại sau vài ngày để thấy chênh)');
});
await sec('4.', async () => {
  const ls = await pageAll(db.collection('leads').where('phone_set_at', '>=', now - 7 * 864e5), 'phone_set_at', ['phone', 'phone_prev', 'phone_set_by', 'phone_has_zalo', 'brand', 'name'], 300);
  console.log('4. "Dùng số này" 7 ngày: ' + ls.length + (ls.length ? ' · ' + ls.slice(0, 5).map(l => (l.name || '') + ' ' + (l.phone_prev || '∅') + ' → ' + l.phone + ' (' + (l.phone_set_by || '') + ', Zalo ' + l.phone_has_zalo + ')').join(' | ') : ' (chưa ai dùng — zip v119-92 cần deploy)'));
});
console.log('== XONG (chỉ đọc) ==');
process.exit(0);
EOF_AFTER
node --check _lf_patch.cjs && node --check _lf_contactcf.js && node --check _lf_after.mjs || { echo 'DỪNG: script lỗi cú pháp (chưa đụng gì)'; rm -f _lf_patch.cjs _lf_contactcf.js _lf_after.mjs; exit 1; }
echo "=== (a) guard + backup + chép contactcf.js + patch index.js ==="
[ -f index.js ] || { echo 'DỪNG: thiếu index.js'; exit 1; }
grep -q "LENH E" index.js || { echo 'DỪNG: index.js chưa có marker LENH E — LỆNH F đặt mốc trên mã SAU LỆNH E. Chạy LỆNH E trước.'; rm -f _lf_contactcf.js; exit 1; }
grep -q "export async function checkZalo" lib/zaloCheck.js || { echo 'DỪNG: lib/zaloCheck.js không có checkZalo (contactcf.js cần) — gửi em output'; rm -f _lf_contactcf.js; exit 1; }
if grep -q "LENH F" index.js && [ -f _lf_backup_ts ]; then TSB=$(cat _lf_backup_ts); echo "index.js ĐÃ có marker LENH F (chạy lại) — KHÔNG tạo .bak mới; bản gốc trước LENH F = index.js.bak-$TSB"
elif grep -q "LENH F" index.js; then echo "DỪNG: index.js đã có marker LENH F nhưng thiếu _lf_backup_ts — khôi phục từ .bak-<TS gốc> hoặc gửi em output"; rm -f _lf_contactcf.js; exit 1
else TSB=$TS; cp index.js "index.js.bak-$TSB" || { echo 'DỪNG: không backup được index.js'; exit 1; }; [ -f contactcf.js ] && cp contactcf.js "contactcf.js.bak-$TSB"; echo "$TSB" > _lf_backup_ts
fi
mv -f _lf_contactcf.js contactcf.js
restore() { cp "index.js.bak-$TSB" index.js; echo "ĐÃ KHÔI PHỤC index.js từ .bak-$TSB (contactcf.js để nguyên — không được export nên vô hại)"; }
describe3() { for f in scheduledScan manualScan zaloCheckLead; do gcloud functions describe "$f" --region asia-southeast1 --gen2 --format='value(name,state,updateTime)' 2>/dev/null | sed 's|projects/smartlead-z15/locations/asia-southeast1/functions/||' || echo "(describe $f lỗi)"; done; }
node _lf_patch.cjs index.js || { echo 'DỪNG (a): patch không áp — KHÔNG ghi gì. Gửi em output.'; exit 1; }
node --check index.js || { echo 'DỪNG (a): lỗi cú pháp sau patch'; restore; exit 1; }
node --check contactcf.js || { echo 'DỪNG (a): contactcf.js lỗi cú pháp'; restore; exit 1; }
echo "marker LENH F index.js: $(grep -c 'LENH F' index.js) dòng · contactcf.js: $(wc -l < contactcf.js) dòng"
echo "=== (b) import test (.env) ==="
set -a; . ./.env; set +a
node --input-type=module -e "const m=await import('./index.js'); const c=await import('./contactcf.js'); const okA = (typeof m.scheduledScan==='function' && typeof m.manualScan==='function' && typeof m.zaloCheckLead==='function' && c.normPhoneF('0912 345 678')==='+84912345678' && c.normPhoneF('028 3822 1234')==='+842838221234' && c.normPhoneF('12345')==='' && c.isMobileF('+842838221234')===false && c.isMobileF('+84912345678')===true); console.log('IMPORT OK · scheduledScan', typeof m.scheduledScan, '· manualScan', typeof m.manualScan, '· zaloCheckLead', typeof m.zaloCheckLead, '· normPhoneF di động/số bàn/sai', c.normPhoneF('0912 345 678'), c.normPhoneF('028 3822 1234'), JSON.stringify(c.normPhoneF('12345')), '· isMobileF', c.isMobileF('+84912345678'), c.isMobileF('+842838221234')); if (okA === false) { console.log('IMPORT: giá trị SAI'); process.exit(1); }" || { echo "DỪNG (b): import/ca kiểm sai — khôi phục"; restore; exit 1; }
echo "=== (c) deploy scheduledScan + manualScan + zaloCheckLead ==="
cd ~/firebase-s13 && firebase deploy --only functions:scheduledScan,functions:manualScan,functions:zaloCheckLead > /tmp/lf_deploy.log 2>&1; RC=$?; tail -6 /tmp/lf_deploy.log
[ "$RC" = "0" ] && grep -q "Deploy complete" /tmp/lf_deploy.log || { echo "DEPLOY LỖI (RC=$RC) — firebase deploy đưa từng function lên lần lượt nên lỗi giữa chừng = MỘT PHẦN đã lên; bảng describe dưới: updateTime ≥ $TS = đã lên bản mới. Cách xử lý: chạy LẠI đúng lệnh deploy ở (c) (idempotent) — hoặc quay lui: cd ~/firebase-s13/functions; cp index.js.bak-$TSB index.js; cd ~/firebase-s13; firebase deploy --only functions:scheduledScan,functions:manualScan"; describe3; exit 1; }
describe3
echo "=== XONG KHỐI 1 (exit=0) — KHỐI 2 (sau ≥ 15′, tốt nhất 1–2 giờ ban ngày có bình luận): cd ~/firebase-s13/functions && node _lf_after.mjs · web: deploy zip v119-92 (nút Dùng số này + Kiểm Zalo + khối bình luận thêm) ==="
