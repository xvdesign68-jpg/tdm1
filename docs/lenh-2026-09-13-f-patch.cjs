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
