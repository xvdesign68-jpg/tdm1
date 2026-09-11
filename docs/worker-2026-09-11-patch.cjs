#!/usr/bin/env node
/* worker-2026-09-11-patch.cjs — biến worker.mjs 2026-09-06d → 2026-09-11 (Đợt 1 automation, theo rà soát 10/09 + LỆNH #43/#43b/#44)
   Dùng:  node docs/worker-2026-09-11-patch.cjs <worker.2026-09-06d.mjs> <worker.mjs đầu ra>
   Fail-closed NGUYÊN TỬ: mọi mốc nội dung phải khớp ĐÚNG số lần; thiếu 1 mốc → không ghi gì, in danh sách mốc hụt.
   Idempotent: file vào đã là 2026-09-11 → thoát 0.
   Nội dung:
     R-15  gqlComment dùng BỘ BIẾN capture 06/09 cho MỌI bài (POST_PERMALINK_DIALOG · feedbackSource 2 · groupID khi có · OBJECT · ORIGINAL),
           FB trả lỗi rõ → thử 1 lần bộ cũ; "mơ hồ" → ambiguous → kiểm hiển thị TRƯỚC khi gõ DOM (W-20). domComment: không thấy ô → bấm nút
           "Bình luận" rồi nhận ô theo FOCUS/ô mới (bài học replyComment 05c); còn nội dung sau Enter → thử Gửi/Enter 2 → verify → throw.
     R-9   Safety: lỗi GIAO DIỆN (selector) đếm uiFailCount KHÔNG trừ điểm; lỗi FB thật (soft-block/verify không ăn) trừ, đếm 1 lần/PHIÊN;
           needLogin đếm 1 lần/phiên; checkpoint không đếm thêm failCount; suy giảm neo safetyDecayAt (nick chạy hằng ngày vẫn giảm);
           safetyWhy cho web; di trú 1 lần failCount cũ → uiFailCount.
     R-8   markDone TRƯỚC khi ghi log/KPI (chết giữa chừng → retry bỏ qua bước, không double); tắt êm: SIGINT/SIGTERM lần 1 = không nhận
           việc mới + xong bước đang làm rồi thoát (stopGraceMs), lần 2 = thoát ngay; recycle 6h đi cùng đường.
     R-2   replyLoop độc lập: theo lịch inbox.everyMin, mở nick CHỈ để đọc messenger khi có thread tới hạn; backoff/thread 1h→3h→6h→12h→24h
           (replyNextAt) thay "bỏ sau 6 lần"; inboxAt trên thread; W-6 nhận diện bong bóng chặt hơn; không đọc nick đang chạy phễu và ngược lại.
     R-1   pre-flight: đọc lại thread + lead NGAY trước khi chạm (và trước mỗi bước) → người thật đã vào → dừng phễu (step human, task
           cancelled, hoàn van cùng ngày, log 🙋); thread đã tắt → task lỗi thời.
     dryRun  config.dryRun=true: mở nick + đi hết phễu (mở bài/trang cá nhân, kiểm nút) nhưng KHÔNG thao tác thật, log "[DRY]" status 'dry',
           hoãn thread 2h. Nhỏ: nextMorningVN 0–8h → 8h hôm nay (W-11); detectChallengeStrict bỏ dialog chứa bài (W-9); config merge sâu (W-13);
           refundQuota transaction kẹp ≥0 + theo reservedDay (E-5); heartbeat báo hardCaps/dryRun/stopping cho web. */
const fs = require('fs');
const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) { console.error('Dùng: node worker-2026-09-11-patch.cjs <in worker.mjs> <out worker.mjs>'); process.exit(2); }
let s = fs.readFileSync(inFile, 'utf8');
if (s.includes("const WORKER_VERSION = '2026-09-11'")) { console.log('đã là 2026-09-11 — không đổi gì'); process.exit(0); }
if (!s.includes("const WORKER_VERSION = '2026-09-06d'")) { console.error('DỪNG: file vào không phải worker 2026-09-06d'); process.exit(1); }
const miss = [];
function rep(a, b, n) { const c = s.split(a).length - 1; if (c !== (n || 1)) { miss.push(`[${c}× thay vì ${n || 1}] ${a.slice(0, 90).replace(/\n/g, '⏎')}`); return; } s = s.split(a).join(b); }
function repBetween(startA, endA, block) { // thay [startA, endA) — cả 2 mốc phải duy nhất
  const i = s.indexOf(startA), j = s.indexOf(endA);
  if (i < 0 || s.indexOf(startA, i + 1) >= 0) { miss.push('[start] ' + startA.slice(0, 80)); return; }
  if (j < 0 || j < i || s.indexOf(endA, j + 1) >= 0) { miss.push('[end] ' + endA.slice(0, 80)); return; }
  s = s.slice(0, i) + block + s.slice(j);
}

/* ===== 0. version + header ===== */
rep("const WORKER_VERSION = '2026-09-06d';", "const WORKER_VERSION = '2026-09-11';");
rep("   Chế độ capture (lấy doc_id để bật API nội bộ):  node worker.mjs --capture <adspower_profile_id> */",
`   v2026-09-11 (Đợt 1 automation — rà soát 10/09, LỆNH #43/#43b/#44):
     R-15 bình luận bài dùng BỘ BIẾN capture 06/09 cho mọi bài (gốc W-19: 20/20 bài group gid số thất bại từ 06/09) + API "mơ hồ" kiểm hiển thị
          trước khi gõ DOM (chống đăng 2 lần) + domComment bấm nút "Bình luận" rồi nhận ô theo focus.
     R-9  Safety Score KHÔNG trừ lỗi giao diện của worker (uiFailCount riêng), lỗi FB đếm 1 lần/phiên, đăng nhập lại đếm 1 lần/phiên,
          suy giảm theo ngày đúng (safetyDecayAt), safetyWhy hiện lý do trên web, di trú 1 lần failCount cũ.
     R-8  ghi tiến độ (doneSteps) TRƯỚC log/KPI; tắt êm (Ctrl+C lần 1 chờ xong bước, lần 2 thoát ngay); recycle 6h cùng đường.
     R-2  vòng ĐỌC INBOX độc lập theo lịch + backoff thread 1h→3h→6h→12h→24h (không phụ thuộc nick có việc mới).
     R-1  kiểm lại lead/thread ngay trước khi chạm và trước mỗi bước → người thật đã vào → máy dừng, hoàn van, log 🙋.
     dryRun (config.dryRun=true): chạy thử không thao tác thật, log "[DRY]" lên web.
   Chế độ capture (lấy doc_id để bật API nội bộ):  node worker.mjs --capture <adspower_profile_id> */`);

/* ===== 1. CFG: merge sâu + khoá mới ===== */
rep("const CFG = Object.assign({\n  adspowerBase:", "const __CFG_DEF = ({\n  adspowerBase:");
rep("  inbox: { enabled: false, maxThreads: 5, everyMin: 60, days: 7 },", "  inbox: { enabled: false, maxThreads: 5, everyMin: 60, days: 7, backoffH: [1, 3, 6, 12, 24] }, // v2026-09-11: backoffH = giãn cách kiểm lại từng thread (giờ) theo số lần chưa thấy phản hồi");
rep("  safety: { enabled: true, pauseBelow: 30, slowBelow: 60 }\n}, readJson('config.json', {}));",
`  safety: { enabled: true, pauseBelow: 30, slowBelow: 60 },
  /* v2026-09-11 */
  dryRun: false,          // CHẠY THỬ: mở nick + đi hết phễu (mở bài / trang cá nhân, kiểm nút) nhưng KHÔNG react/comment/kết bạn/inbox, không ghi tiến độ; log "[DRY]" lên web
  stopGraceMs: 90000,     // tắt êm: Ctrl+C/SIGTERM lần 1 → không nhận việc mới, chờ bước đang làm xong (tối đa X ms) rồi thoát; lần 2 = thoát ngay
  replyLoop: true         // vòng ĐỌC INBOX độc lập (mở nick chỉ để đọc phản hồi theo lịch inbox.everyMin); false = chỉ đọc cuối phiên có việc như cũ
});
const __CFG_USR = readJson('config.json', {});
const CFG = Object.assign({}, __CFG_DEF, __CFG_USR);
for (const k of ['graphql', 'hardCaps', 'inbox', 'safety']) if (__CFG_USR[k] && typeof __CFG_USR[k] === 'object' && !Array.isArray(__CFG_USR[k])) CFG[k] = Object.assign({}, __CFG_DEF[k], __CFG_USR[k]); // v2026-09-11 (W-13): merge SÂU — config chỉ ghi {inbox:{enabled:true}} vẫn giữ maxThreads/everyMin/days/backoffH mặc định
if (!Array.isArray(CFG.inbox.backoffH) || !CFG.inbox.backoffH.length) CFG.inbox.backoffH = [1, 3, 6, 12, 24];`);
rep("let pausedAll = false, pausedLogged = false; // v2026-09-04: \"Dừng tất cả\" từ web (worker_config.pauseAll)",
`let pausedAll = false, pausedLogged = false; // v2026-09-04: "Dừng tất cả" từ web (worker_config.pauseAll)
let stopping = false;                                 // v2026-09-11 (R-8): đang tắt êm — không nhận việc mới, xong bước đang làm rồi thoát
const activeProfiles = new Set(), readingProfiles = new Set(); // v2026-09-11 (R-2): nick đang chạy phễu / đang mở để đọc inbox — 2 vòng không giẫm nhau`);

/* ===== 2. nextMorningVN (W-11) · gateCheck stopping · heartbeat ===== */
rep("function nextMorningVN() { const d = new Date(Date.now() + 7 * 3600e3); d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(CFG.hoursVN[0], rand(0, 40), 0, 0); return d.getTime() - 7 * 3600e3; }",
"function nextMorningVN() { const d = new Date(Date.now() + 7 * 3600e3); if (d.getUTCHours() >= CFG.hoursVN[0]) d.setUTCDate(d.getUTCDate() + 1); d.setUTCHours(CFG.hoursVN[0], rand(0, 40), 0, 0); return d.getTime() - 7 * 3600e3; } // v2026-09-11 (W-11): 0–8h sáng → 8h HÔM NAY (trước: luôn +1 ngày = mất trọn ngày)");
rep("  if (pausedAll) return { why: 'Dừng tất cả đang bật (web)', until: Date.now() + 30 * 60000 };\n  if (!inHoursVN())",
"  if (pausedAll) return { why: 'Dừng tất cả đang bật (web)', until: Date.now() + 30 * 60000 };\n  if (stopping) return { why: 'worker đang tắt (tắt êm)', until: Date.now() + 5 * 60000 }; // v2026-09-11 (R-8)\n  if (!inHoursVN())");
rep("      shardMode: CFG.profiles.length ? 'config' : 'web'\n    }, { merge: true });",
"      shardMode: CFG.profiles.length ? 'config' : 'web',\n      hardCaps: CFG.hardCaps || null, dryRun: !!CFG.dryRun, stopping, replyLoop: !!(CFG.inbox && CFG.inbox.enabled && CFG.replyLoop !== false) // v2026-09-11: web đọc trần cứng + trạng thái\n    }, { merge: true });");

/* ===== 3. detectChallengeStrict (W-9) ===== */
rep("      const zones = [...document.querySelectorAll('div[role=\"dialog\"], form[action*=\"checkpoint\"], form[action*=\"/recover\"]')];",
"      const zones = [...document.querySelectorAll('div[role=\"dialog\"], form[action*=\"checkpoint\"], form[action*=\"/recover\"]')].filter(z => !z.querySelector('div[role=\"article\"]')); // v2026-09-11 (W-9): hộp thoại CHỨA BÀI (permalink mở dạng dialog) = nội dung người dùng → không quét");

/* ===== 4. safetyRecalc (R-9) ===== */
repBetween("async function safetyRecalc(pid, meta) {", "/* ---------- AdsPower Local API ---------- */",
`/* v2026-09-11 (R-9): (1) Safety CHỈ trừ lỗi FB thật (failCount = soft-block / verify không ăn); lỗi GIAO DIỆN của worker (không thấy nút/ô —
   selector) đếm riêng uiFailCount, KHÔNG trừ điểm (bài học t7: 43 lỗi selector → Safety 28 → tự tắt nick khoẻ, W-18). (2) Suy giảm theo ngày
   neo vào safetyDecayAt (mốc riêng, chỉ tiến theo số ngày TRÒN đã trừ) — trước neo safetyAt được ghi lại mỗi phiên nên nick chạy hằng ngày
   KHÔNG BAO GIỜ được giảm (W-8). (3) Ghi safetyWhy (lý do, web hiện). (4) Di trú 1 lần (safetyV<2): failCount cũ không phân loại được → chuyển
   sang uiFailCount (LỆNH #43b: gần như toàn bộ là lỗi selector). Nick đang safetyPaused vẫn chờ ✓ Đã xử lý trên web (web reset bộ đếm). */
async function safetyRecalc(pid, meta) {
  const S = CFG.safety || {}; if (S.enabled === false || !pid) return;
  try {
    const ref = db.collection('fb_accounts').doc(String(pid)); const d = (await ref.get()).data() || {};
    const now = Date.now(); const patch = { safetyAt: now };
    let fail = Number(d.failCount) || 0, ui = Number(d.uiFailCount) || 0, ch = Number(d.challengeTotal) || 0, nl = Number(d.needLoginTotal) || 0;
    if (!(Number(d.safetyV) >= 2)) { patch.safetyV = 2; patch.uiFailLegacy = fail; ui += fail; fail = 0; if (patch.uiFailLegacy) log(\`  🛡 nick \${pid}: di trú Safety v2 — \${patch.uiFailLegacy} lỗi cũ (không phân loại được) chuyển sang "lỗi giao diện", không trừ điểm\`); }
    const decayAt = Number(d.safetyDecayAt) || Number(d.safetyAt) || now;
    const days = Math.max(0, Math.floor((now - decayAt) / 864e5));
    if (days > 0) { fail = Math.max(0, fail - days); ui = Math.max(0, ui - 2 * days); ch = Math.max(0, ch - Math.floor(days / 7)); nl = Math.max(0, nl - Math.floor(days / 3)); patch.safetyDecayAt = decayAt + days * 864e5; }
    else if (!d.safetyDecayAt) patch.safetyDecayAt = decayAt;
    Object.assign(patch, { failCount: fail, uiFailCount: ui, challengeTotal: ch, needLoginTotal: nl });
    const ok = Number(d.okCount) || 0;
    const safety = safetyOf({ challengeTotal: ch, needLoginTotal: nl, failCount: fail, okCount: ok });
    patch.safety = safety;
    patch.safetyWhy = \`checkpoint \${ch} · đăng nhập lại \${nl} · lỗi FB \${fail} · thành công \${ok}\` + (ui ? \` · lỗi giao diện \${ui} (không trừ điểm)\` : '');
    if (safety < (S.pauseBelow || 30) && d.active !== false && !d.safetyPaused) {
      patch.active = false; patch.safetyPaused = true; patch.safetyPausedAt = now;
      try { await db.collection('outreach_log').add({ leadId: (meta && meta.leadId) || '', name: (meta && meta.name) || '', brand: (meta && meta.brandName) || '', brandCode: (meta && meta.brandCode) || '', pid,
        action: \`🛡 Safety Score \${safety}/100 — đã TẠM DỪNG nick (\${patch.safetyWhy}). Xử lý xong bấm ✓ Đã xử lý trên web.\`, status: 'paused', at: FieldValue.serverTimestamp(), expireAt: expireTs() }); } catch (_) { }
      log(\`  🛡 safety \${safety} → TẠM DỪNG nick \${pid} (\${patch.safetyWhy})\`);
    } else if (safety < (S.slowBelow || 60)) {
      const extra = (safety < 45 ? 45 : 20) * 60000; const cur = Number(d.nextFreeAt) || 0;
      if (cur < now + extra) patch.nextFreeAt = now + extra;
      log(\`  🛡 safety \${safety} → giãn nhịp nick \${pid} +\${extra / 60000}'\`);
    }
    await ref.set(patch, { merge: true });
  } catch (e) { log('safetyRecalc lỗi:', e && e.message); }
}

`);

/* ===== 5. gqlComment (R-15) ===== */
repBetween("async function gqlComment(page, feedbackId, message, groupId) {", "/* v2026-09-06b: tym BÌNH LUẬN qua API nội bộ",
`/* v2026-09-11 (R-15 — gốc W-19, LỆNH #43b): từ 06/09 FB xoay doc_id bình luận (28781864408106143) nhưng gqlComment vẫn gửi BỘ BIẾN CŨ 29/08
   (feedLocation GROUP · feedbackSource 0 · feedback_source PROFILE · AUTO_TRANSLATE) cho bài group gid SỐ → API từ chối 20/20 → rơi DOM chỉ cứu ~½.
   Bộ biến ĐÚNG lấy từ chính capture 06/09 (bình luận cấp 1 "Hi ban nhe" lên bài group gid số, response 200 comment_create):
   feedLocation POST_PERMALINK_DIALOG · feedbackSource 2 · groupID (khi có) · input.feedback_source OBJECT · translationType ORIGINAL (+ relay ORIGINAL).
   Áp cho MỌI bài. Dự phòng: FB trả LỖI RÕ (errors) = chắc chắn chưa đăng → thử 1 lần bộ cũ (bài group slug từng chạy 9/9). KHÔNG thử lại khi
   "mơ hồ" (200 không errors nhưng không thấy comment_create — có thể ĐÃ đăng) → trả ambiguous → bên gọi kiểm hiển thị TRƯỚC khi gõ DOM (W-20). */
async function gqlComment(page, feedbackId, message, groupId) {
  if (!CFG.graphql || !CFG.graphql.commentDocId) return null;
  const uuid = () => (globalThis.crypto?.randomUUID?.() || (Date.now() + '-' + Math.random()));
  const build = variant => {
    const legacy = variant === 'legacy';
    const vars = {
      feedLocation: legacy ? (groupId ? 'GROUP' : 'DEDICATED_COMMENTING_SURFACE') : 'POST_PERMALINK_DIALOG', feedbackSource: legacy ? 0 : 2,
      input: {
        client_mutation_id: String(rand(1, 9999)), attachments: null, feedback_id: feedbackId,
        formatting_style: null, is_inline_vote_enabled_for_qna: false,
        message: { ranges: [], text: String(message) }, vod_video_timestamp: null,
        feedback_source: legacy ? (groupId ? 'PROFILE' : 'OBJECT') : 'OBJECT',
        idempotence_token: 'client:' + uuid(), session_id: uuid()
      },
      inviteShortLinkKey: null, renderLocation: null, scale: 1, useDefaultActor: false, focusCommentID: null,
      translationType: legacy ? 'AUTO_TRANSLATE' : 'ORIGINAL', canUseNicknameOnComet: false,
      __relay_internal__pv__groups_comet_use_glvrelayprovider: false,
      __relay_internal__pv__CometUFICommentActionLinksRewriteEnabledrelayprovider: true,
      __relay_internal__pv__CometUFICommentAvatarStickerAnimatedImagerelayprovider: false,
      __relay_internal__pv__IsWorkUserrelayprovider: false,
      __relay_internal__pv__CometUFICommentAutoTranslationTyperelayprovider: legacy ? 'AUTO_TRANSLATE' : 'ORIGINAL'
    };
    if (groupId) vars.groupID = String(groupId);
    return vars;
  };
  const isReal = r => !!(r && r.ok && (deepHasTruthy(r.data, 'comment_create') || deepHasTruthy(r.data, 'feedback_comment_edge') || deepHasTruthy(r.data, 'comment')));
  let res = await fbGraphql(page, 'useCometUFICreateCommentMutation', CFG.graphql.commentDocId, build('capture'));
  if (!res) return null;
  let variant = 'capture';
  if (!res.ok && res.hasErr) { // lỗi RÕ = chắc chắn chưa đăng → thử bộ cũ đúng 1 lần (an toàn, không double)
    const r2 = await fbGraphql(page, 'useCometUFICreateCommentMutation', CFG.graphql.commentDocId, build('legacy'));
    if (r2) { res = r2; variant = 'legacy'; }
  }
  const real = isReal(res);
  return { ok: real, ambiguous: !!(res.ok && !real), variant, sample: res.sample || res.err };
}

`);

/* ===== 6. domComment (R-15 DOM) ===== */
repBetween("async function domComment(page, message) {", "// v2026-09-05c: \"đã ĐĂNG chưa\" = đoạn chữ xuất hiện trong khung article",
`async function domComment(page, message) {
  /* v2026-09-11 (R-15 DOM): trang bài trong nhóm thường KHÔNG vẽ sẵn ô soạn — phải bấm nút "Bình luận" dưới bài. Trước: chỉ tìm ô có nhãn
     "Bình luận" → 65 lần "không thấy ô Bình luận (đúng nhãn)" (LỆNH #43). Giờ: (1) có ô nhãn bình luận đang hiển thị → dùng; (2) không → đánh dấu
     ô cũ, bấm nút "Bình luận"/"Viết bình luận" của bài, poll ≤6 s ô đang FOCUS có nhãn bình luận / ô MỚI có nhãn / ô mới duy nhất (không phải
     trả lời, tin nhắn); (3) vẫn không → throw (chưa gõ gì → retry an toàn, KHÔNG gõ ô khác). Sau Enter còn nội dung CỦA MÌNH → chờ → chưa thấy
     hiện trên bài → Enter lần 2 → vẫn còn: đã thấy hiện = xong, chưa = throw. */
  let box = await firstVisible(page, [
    'div[role="textbox"][aria-label*="Bình luận"]', 'div[role="textbox"][aria-label*="bình luận"]',
    'div[role="textbox"][aria-label*="comment" i]', 'div[role="textbox"][aria-label*="Viết bình luận"]']);
  if (!box) {
    await page.evaluate(() => {
      const vis = b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      document.querySelectorAll('div[role="textbox"]').forEach(b => { if (vis(b)) b.setAttribute('data-sl-old', '1'); else b.removeAttribute('data-sl-old'); });
      document.querySelectorAll('[data-sl-cbox]').forEach(b => b.removeAttribute('data-sl-cbox'));
    }).catch(() => { });
    const btn = await firstVisible(page, ['div[role="button"][aria-label="Viết bình luận"]', 'div[role="button"][aria-label="Bình luận"]', 'div[role="button"][aria-label="Leave a comment"]', 'div[role="button"][aria-label="Comment"]', 'div[role="button"]:has-text("Bình luận")', 'div[role="button"]:has-text("Comment")']);
    if (!btn) throw new Error('không thấy ô Bình luận lẫn nút Bình luận của bài');
    await btn.scrollIntoViewIfNeeded().catch(() => { }); await btn.click({ force: true }).catch(() => { });
    let picked = null;
    for (let i = 0; i < 12 && !picked; i++) {
      await sleep(500);
      picked = await page.evaluate(() => {
        const vis = b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const label = b => ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('aria-placeholder') || '') + ' ' + (b.getAttribute('placeholder') || '')).toLowerCase();
        const isReply = b => /trả lời|câu trả lời|phản hồi|reply/.test(label(b));
        const isCmt = b => /bình luận|comment/.test(label(b)) && !isReply(b);
        const boxes = [...document.querySelectorAll('div[role="textbox"]')].filter(vis);
        const ae = document.activeElement; const act = ae && ae.closest ? ae.closest('div[role="textbox"]') : null;
        let pick = null, how = '';
        if (act && vis(act) && isCmt(act)) { pick = act; how = 'focus'; }
        if (!pick) { const fresh = boxes.filter(b => !b.hasAttribute('data-sl-old')); pick = fresh.find(isCmt) || null; if (pick) how = 'fresh+label'; else if (fresh.length === 1 && !isReply(fresh[0]) && !/tin nhắn|message/.test(label(fresh[0]))) { pick = fresh[0]; how = 'fresh-only'; } }
        if (!pick) return null;
        pick.setAttribute('data-sl-cbox', '1'); return { how, label: label(pick).slice(0, 60) };
      }).catch(() => null);
    }
    if (!picked) throw new Error('không thấy ô Bình luận (đúng nhãn) sau khi bấm nút Bình luận');
    log('    ô bình luận:', JSON.stringify(picked));
    box = page.locator('div[role="textbox"][data-sl-cbox="1"]').first();
  }
  await box.click({ force: true }).catch(() => { }); await sleep(500);
  await typeMsg(page, message, 22); // v2026-09-04: xuống dòng = Shift+Enter (Enter trần gửi sớm nửa bình luận)
  await sleep(500); await page.keyboard.press('Enter'); await sleep(1800);
  const frag = String(message || '').slice(0, 20);
  const still = async () => { try { return ((await box.innerText({ timeout: 1500 })) || '').includes(frag); } catch (_) { return false; } };
  if (await still()) { await sleep(2000); if ((await still()) && !(await verifyCommentPosted(page, message))) { await page.keyboard.press('Enter'); await sleep(2500); } }
  if ((await still()) && !(await verifyCommentPosted(page, message))) throw new Error('bình luận CHƯA gửi được (ô soạn vẫn còn nội dung sau Enter/gửi)');
}
`);

/* ===== 7. onNeedLogin (đếm 1 lần/phiên) · refundQuota (kẹp ≥0 + reservedDay) · onFail (kind) ===== */
repBetween("const NEEDLOGIN_PAUSE_AT = 3;", "// Hoàn quota (outreach_usage) cho các bước ĐÃ RESERVE ở engine nhưng KHÔNG làm được",
`const NEEDLOGIN_PAUSE_AT = 3; // đăng xuất lặp lại N lần → tự tạm dừng nick (hết loop mở browser mỗi 20' trên nick chết)
// v2026-09-11 (R-9/W-3): opt.count=false → KHÔNG cộng bộ đếm (phiên có N việc chỉ đếm 1 lần đăng xuất); opt.noThread → không có thread (vòng đọc inbox)
async function onNeedLogin(t, opt) {
  const count = !(opt && opt.count === false);
  const ref = db.collection('fb_accounts').doc(String(t.pid));
  let cnt = 1; try { cnt = (Number(((await ref.get()).data() || {}).needLoginCount) || 0) + (count ? 1 : 0); } catch (_) { }
  const patch = { needLogin: true, needLoginAt: FieldValue.serverTimestamp() };
  if (count) { patch.needLoginCount = cnt; patch.needLoginTotal = FieldValue.increment(1); } // needLoginTotal: bộ đếm Safety
  if (cnt >= NEEDLOGIN_PAUSE_AT) patch.active = false; // tự dừng — chờ chủ nick đăng nhập lại rồi bật lại
  await ref.set(patch, { merge: true });
  if (!(opt && opt.noThread) && t.leadId) await db.collection('outreach_threads').doc(t.leadId).set({ taskStatus: 'failed', nextAt: Date.now() + 20 * 60000, lastError: 'nick cần đăng nhập lại' }, { merge: true });
  if (count) await db.collection('outreach_log').add({ leadId: t.leadId || '', name: t.name || '', brand: t.brandName || '', brandCode: t.brandCode || '', temp: t.temp || '', score: t.score || 0, pid: t.pid,
    action: cnt >= NEEDLOGIN_PAUSE_AT ? '⚠️ Đã TẠM DỪNG nick — đăng nhập lại nhiều lần (AdsPower)' : '⚠️ Tạm dừng — nick cần đăng nhập lại (AdsPower)',
    status: 'paused', at: FieldValue.serverTimestamp(), expireAt: expireTs() }); // v2026-09-04: status paused
}
`);
repBetween("// Hoàn quota (outreach_usage) cho các bước ĐÃ RESERVE ở engine nhưng KHÔNG làm được", "async function onFail(t, msg) {",
`// Hoàn quota (outreach_usage) cho các bước ĐÃ RESERVE ở engine nhưng KHÔNG làm được → nick không "cạn ngày" oan.
// v2026-09-11 (E-5 phía worker): TRANSACTION kẹp ≥ 0 (không tạo số âm) và CHỈ hoàn khi thread reserve HÔM NAY (reservedDay — LỆNH #44;
// khác ngày = van hôm đó đã qua, không hoàn). Thread cũ không reservedDay / 'moved' → coi như hôm nay. Chỉ gọi khi task chết hẳn / bỏ qua.
async function refundQuota(pid, steps, doneSteps, reservedDay) {
  if (!pid || !Array.isArray(steps)) return;
  if (reservedDay && reservedDay !== 'moved' && reservedDay !== statDayKey()) return;
  const doneSet = new Set(doneSteps || []); const dec = {};
  for (const s of steps) { if (doneSet.has(s)) continue; const k = statFieldOf(s); if (k) dec[k] = (dec[k] || 0) + 1; }
  const keys = Object.keys(dec); if (!keys.length) return;
  const ref = db.collection('outreach_usage').doc(pid + '__' + statDayKey());
  try { await db.runTransaction(async tx => { const snap = await tx.get(ref); if (!snap.exists) return; const c = snap.data() || {}; const patch = {}; for (const k of keys) patch[k] = Math.max(0, (Number(c[k]) || 0) - dec[k]); tx.set(ref, patch, { merge: true }); }); } catch (_) { }
}
`);
repBetween("async function onFail(t, msg) {", "/* ---------- FUNNEL: 1 lead làm liền cả phễu trong 1 phiên nick ----------",
`/* v2026-09-11 (R-9): opt.kind = 'ui' (lỗi giao diện/selector của worker — KHÔNG trừ Safety, đếm uiFailCount) · 'fb' (FB thật: soft-block /
   verify không ăn — trừ Safety, đếm 1 lần/PHIÊN) · 'none' (checkpoint đã đếm ở challengeTotal / lỗi mở nick). Mặc định 'ui'. */
const sessFbCounted = new Set(); // phiên (t.__sess) đã trừ failCount
async function onFail(t, msg, opt) {
  const kind = (opt && opt.kind) || (/^(checkpoint|challenge):/.test(String(msg || '')) ? 'none' : 'ui');
  const tref = db.collection('outreach_threads').doc(t.leadId);
  const cur = (await tref.get()).data() || {};
  const tries = cur.tries || 0;
  const dead = tries + 1 >= CFG.maxTries;
  await tref.set(Object.assign({ taskStatus: 'failed', tries: tries + 1, lastError: String(msg).slice(0, 200), lastFailKind: kind }, dead ? { active: false } : { nextAt: Date.now() + 15 * 60000 }), { merge: true });
  try {
    const fp = { lastFailAt: Date.now(), lastFailKind: kind, lastFailMsg: String(msg || '').slice(0, 120) };
    if (kind === 'ui') fp.uiFailCount = FieldValue.increment(1);
    else if (kind === 'fb' && !(t.__sess && sessFbCounted.has(t.__sess))) { fp.failCount = FieldValue.increment(1); if (t.__sess) sessFbCounted.add(t.__sess); }
    await db.collection('fb_accounts').doc(String(t.pid)).set(fp, { merge: true });
  } catch (_) { }
  await addLog(t, false, dead ? '(dừng sau nhiều lần lỗi)' : ('thử lại sau 15 phút (' + (tries + 1) + '/' + CFG.maxTries + ')'), dead ? 'fail' : 'retry');
  // dead-letter funnel → hoàn quota các bước chưa làm (reserved lúc engine enqueue)
  if (dead && t.action === 'funnel' && t.payload && Array.isArray(t.payload.steps)) await refundQuota(t.pid, t.payload.steps, cur.doneSteps, cur.reservedDay);
}

`);
rep("  if (t.action === 'funnel' && t.payload && Array.isArray(t.payload.steps)) await refundQuota(t.pid, t.payload.steps, cur.doneSteps);\n}",
"  if (t.action === 'funnel' && t.payload && Array.isArray(t.payload.steps)) await refundQuota(t.pid, t.payload.steps, cur.doneSteps, cur.reservedDay);\n}");

/* ===== 8. runFunnel: thr0 · markDone trước log · stopping · human trước mỗi bước · comment API mơ hồ · inboxAt · failKind ===== */
rep("  const done = new Set(((await tref.get()).data() || {}).doneSteps || []);\n  const gapSmall",
"  const thr0 = (await tref.get()).data() || {}; const done = new Set(thr0.doneSteps || []); // v2026-09-11: giữ reservedDay để hoàn van đúng ngày\n  const gapSmall");
rep("  const logStep = async (action, ok, text, opt) => { // v2026-09-06: opt.noStat = bước \"bỏ qua thành công\" (đã là bạn) → không cộng KPI brand\n    await db.collection('outreach_log').add(",
"  const logStep = async (action, ok, text, opt) => { // v2026-09-06: opt.noStat = bước \"bỏ qua thành công\" (đã là bạn) → không cộng KPI brand\n    if (ok && !done.has(action)) await markDone(action); // v2026-09-11 (R-8): ghi TIẾN ĐỘ TRƯỚC log/KPI — chết giữa chừng thì retry BỎ QUA bước này (không double)\n    await db.collection('outreach_log').add(");
rep("    abortCheck(page); // v2026-09-06d: watchdog đã huỷ → không bắt đầu bước mới\n",
`    abortCheck(page); // v2026-09-06d: watchdog đã huỷ → không bắt đầu bước mới
    if (stopping) throw Object.assign(new Error('stopping'), { paused: { why: 'worker đang tắt (tắt êm) — việc hẹn lại', until: Date.now() + 5 * 60000 } }); // v2026-09-11 (R-8)
    { const hb = await leadHumanNow(t); if (hb) throw Object.assign(new Error('human'), { human: hb }); } // v2026-09-11 (R-1): người thật đã vào lead → dừng, không chạm (1 read/bước)
`);
rep("    let stepOk = false, cameCatch = false;\n", "    let stepOk = false, cameCatch = false, failMsg = ''; // v2026-09-11: failMsg → phân loại lỗi (ui/fb) ở runNick\n");
rep("          const fid = feedbackIdOf(p.post_url), gid = groupIdOf(p.post_url); let ok = false;\n          if (fid) { const g = await gqlComment(page, fid, p.comment_msg, gid); if (g) log('    comment API:', g.ok ? 'OK' : 'FAIL', String(g.sample || '').slice(0, 140)); if (g && g.ok) ok = true; }\n          if (ok) { await logStep('comment', true, p.comment_msg); stepOk = true; }\n          else {",
`          const fid = feedbackIdOf(p.post_url), gid = groupIdOf(p.post_url); let ok = false, amb = false;
          if (fid) { const g = await gqlComment(page, fid, p.comment_msg, gid); if (g) { log('    comment API:', g.ok ? 'OK' : (g.ambiguous ? 'MƠ HỒ' : 'FAIL'), (g.variant || ''), String(g.sample || '').slice(0, 140)); if (g.ok) ok = true; amb = !!g.ambiguous; } }
          if (ok) { await logStep('comment', true, p.comment_msg); stepOk = true; }
          else if (amb && await verifyComment(page, p.comment_msg)) { await logStep('comment', true, p.comment_msg + ' (API mơ hồ — đã thấy hiển thị, không gõ lại)'); stepOk = true; } // v2026-09-11 (R-15/W-20): kiểm hiển thị TRƯỚC khi gõ DOM
          else {`);
rep("          if (already) { await refundQuota(t.pid, ['add_friend'], []); await logStep(", "          if (already) { await refundQuota(t.pid, ['add_friend'], [], thr0.reservedDay); await logStep(");
rep("          await logStep('inbox', true, p.inbox_msg);\n", "          await logStep('inbox', true, p.inbox_msg);\n          try { await tref.set({ inboxAt: Date.now() }, { merge: true }); } catch (_) { } // v2026-09-11 (R-2): mốc inbox cho vòng đọc phản hồi\n");
rep("      if (e && e.paused) throw e;    // v2026-09-04: hoãn (gate/van) → runNick → onPaused\n",
"      if (e && e.paused) throw e;    // v2026-09-04: hoãn (gate/van) → runNick → onPaused\n      if (e && e.human) throw e;     // v2026-09-11 (R-1): người thật đã vào → runNick → onHuman\n");
rep("      stepOk = false; cameCatch = true; // đã dò challenge trong catch (null) → nhánh else khỏi dò lại\n",
"      stepOk = false; cameCatch = true; failMsg = String((e && e.message) || ''); // đã dò challenge trong catch (null) → nhánh else khỏi dò lại\n");
rep("    if (stepOk) { await markDone(step); try {", "    if (stepOk) { if (!done.has(step)) await markDone(step); try {");
rep("      throw new Error('dừng phễu tại bước \"' + step + '\" (thất bại — KHÔNG leo thang bước sau)');",
"      // v2026-09-11 (R-9): qua catch = lỗi GIAO DIỆN của worker (không thấy nút/ô…) → 'ui' (không trừ Safety); không qua catch = bấm được mà không ăn = 'fb'\n      throw Object.assign(new Error('dừng phễu tại bước \"' + step + '\" (thất bại — KHÔNG leo thang bước sau)' + (failMsg ? ': ' + failMsg.slice(0, 120) : '')), { failKind: cameCatch ? 'ui' : 'fb' });");

/* ===== 9. execOnPage: comment API mơ hồ ===== */
rep("    let done = false;\n    if (fid) { const g = await gqlComment(page, fid, t.payload.message, gid); if (g) log('    comment API:', g.ok ? 'OK' : 'FAIL', String(g.sample || '').slice(0, 180)); if (g && g.ok) done = true; }\n    if (!done) { // API tắt / lỗi → bấm DOM",
"    let done = false, amb = false;\n    if (fid) { const g = await gqlComment(page, fid, t.payload.message, gid); if (g) { log('    comment API:', g.ok ? 'OK' : (g.ambiguous ? 'MƠ HỒ' : 'FAIL'), String(g.sample || '').slice(0, 180)); if (g.ok) done = true; amb = !!g.ambiguous; } }\n    if (!done && amb && await verifyComment(page, t.payload.message)) done = true; // v2026-09-11 (W-20): mơ hồ → kiểm hiển thị trước khi gõ DOM\n    if (!done) { // API tắt / lỗi → bấm DOM");

/* ===== 10. checkReplies (R-2): force · backoff replyNextAt · inboxAt · W-6 · dryRun ===== */
rep("  const lastAt = Number((acc || {}).replyCheckAt) || 0;\n  if (Date.now() - lastAt < (Number(ib.everyMin) || 60) * 60000) return;",
"  const lastAt = Number((acc || {}).replyCheckAt) || 0;\n  if (!(meta && meta.force) && Date.now() - lastAt < (Number(ib.everyMin) || 60) * 60000) return; // v2026-09-11: replyLoop đã tự gate everyMin → force\n  const nextBk = n => Date.now() + ((CFG.inbox.backoffH || [1, 3, 6, 12, 24])[Math.min(Math.max(0, n), (CFG.inbox.backoffH || [24]).length - 1)] || 24) * 3600e3; // v2026-09-11 (R-2): giãn dần theo số lần chưa thấy phản hồi");
rep("    if ((Number(x.replyChecks) || 0) >= 6) return;\n", "    if ((Number(x.replyNextAt) || 0) > Date.now()) return; // v2026-09-11 (R-2): backoff theo thread thay \"bỏ sau 6 lần\"\n");
rep("    const t0 = Number(x.nextAt) || 0; if (t0 && Date.now() - t0 > win) return;", "    const t0 = Number(x.inboxAt) || Number(x.nextAt) || 0; if (t0 && Date.now() - t0 > win) return; // v2026-09-11: cửa sổ tính từ mốc inbox thật");
rep("        if (!u) { await ref0.set({ replyChecks: FieldValue.increment(1) }, { merge: true }); log('  checkReplies: không giải mã được uid', c.id); continue; }",
"        if (!u) { await ref0.set({ replyChecks: FieldValue.increment(1), replyNextAt: nextBk((Number(c.x.replyChecks) || 0) + 1) }, { merge: true }); log('  checkReplies: không giải mã được uid', c.id); continue; }");
rep("        const els = [...document.querySelectorAll('[aria-label]')].filter(e => /(đã gửi|sent)\\s*$/i.test(e.getAttribute('aria-label') || ''));\n        const own = e => /^(bạn đã gửi|you sent)/i.test((e.getAttribute('aria-label') || '').trim());",
`        const lbl = e => (e.getAttribute('aria-label') || '').trim();
        // v2026-09-11 (W-6): chỉ nhận bong bóng "<Tên> đã gửi" / "<Name> sent" CÓ tên phía trước + có nội dung; loại nhãn trạng thái trần ("Đã gửi"/"Sent"/"Đã xem")
        const els = [...document.querySelectorAll('[aria-label]')].filter(e => { const l = lbl(e); return /^.{1,80}\\s(đã gửi|sent)$/i.test(l) && !/^(đã gửi|sent|đã xem|seen|tin nhắn đã gửi|message sent)$/i.test(l) && ((e.innerText || '').trim().length > 0); });
        const own = e => /^(bạn đã gửi|you sent)$/i.test(lbl(e));`);
rep("      if (!r.ok) { await ref.set({ replyChecks: FieldValue.increment(1) }, { merge: true }); continue; } // không kết luận được → bỏ qua (fail-closed)\n      if (!r.replied) { await ref.set({ replyChecks: FieldValue.increment(1), replyCheckedAt: Date.now() }, { merge: true }); continue; }",
"      const nChk = (Number(c.x.replyChecks) || 0) + 1;\n      if (!r.ok) { await ref.set({ replyChecks: FieldValue.increment(1), replyNextAt: nextBk(nChk) }, { merge: true }); continue; } // không kết luận được → bỏ qua (fail-closed)\n      if (!r.replied) { await ref.set({ replyChecks: FieldValue.increment(1), replyCheckedAt: Date.now(), replyNextAt: nextBk(nChk) }, { merge: true }); continue; }\n      if (CFG.dryRun) { log(`  [DRY] lead ${String(c.x.leadId || c.id)} có phản hồi: ${(r.text || '').slice(0, 80)} (không ghi)`); continue; } // v2026-09-11: chạy thử không ghi");

/* ===== 11. runNick: session id · needLogin 1 lần · checkpoint kind none · stopping · preflight · dryRun · human · failKind ===== */
rep("  log(`▶ nick ${profile}: ${tasks.length} việc`);\n  runningNicks++;\n",
"  log(`▶ nick ${profile}: ${tasks.length} việc${CFG.dryRun ? ' [CHẠY THỬ — không thao tác thật]' : ''}`);\n  runningNicks++; activeProfiles.add(profile);\n  const sessId = profile + '@' + Date.now(); tasks.forEach(t => { t.__sess = sessId; }); // v2026-09-11 (R-9): bộ đếm Safety theo PHIÊN\n");
rep("  if (!runnable.length) { runningNicks = Math.max(0, runningNicks - 1); return; }", "  if (!runnable.length) { runningNicks = Math.max(0, runningNicks - 1); activeProfiles.delete(profile); return; }");
rep("    if (loggedOut(page)) { for (const t of tasks) { await onNeedLogin(t); await markTask(t, 'failed'); } return; }",
"    if (loggedOut(page)) { let first = true; for (const t of tasks) { await onNeedLogin(t, { count: first }); first = false; await markTask(t, 'failed'); } return; } // v2026-09-11: đếm 1 lần/phiên");
rep("for (const t of tasks) { await onFail(t, 'checkpoint:' + ch0.type); await markTask(t, 'failed'); } return; }",
"for (const t of tasks) { await onFail(t, 'checkpoint:' + ch0.type, { kind: 'none' }); await markTask(t, 'failed'); } return; } // v2026-09-11: challengeTotal đã đếm, không cộng failCount");
rep("      const t = tasks[ti];\n      if (ctl.aborted) break;\n      try {\n        await execOnPage(page, t);",
`      const t = tasks[ti];
      if (ctl.aborted) break;
      if (stopping) { log('  ⏹ worker đang tắt — việc còn lại hẹn 5\\''); await onPaused(t, 'worker đang tắt (tắt êm)', Date.now() + 5 * 60000); await markTask(t, 'paused'); continue; } // v2026-09-11 (R-8)
      const pf = await preflight(t).catch(() => null); // v2026-09-11 (R-1): kiểm lại thread/lead NGAY trước khi chạm
      if (pf) { await onHuman(t, pf); await markTask(t, 'cancelled'); continue; }
      if (CFG.dryRun) { // v2026-09-11: CHẠY THỬ — không thao tác thật
        try { await dryFunnel(page, t); await markTask(t, 'paused'); }
        catch (e) { if (e && e.needLogin) { await onNeedLogin(t); await markTask(t, 'failed'); break; } if (ctl.aborted || (e && (e.infra || isInfraErr(e)))) { await onInfra(t, e && e.message); await markTask(t, 'failed'); break; } log('  [DRY] lỗi:', e && e.message); await onPaused(t, 'chạy thử (dryRun) lỗi: ' + String(e && e.message).slice(0, 100), Date.now() + 2 * 3600e3); await markTask(t, 'paused'); }
        continue;
      }
      try {
        await execOnPage(page, t);`);
rep("        if (e && e.challenge) { log(`  ⛔ checkpoint (${e.challenge.type}) — DỪNG nick`); await flagChallenge(meta0.pid || profile, e.challenge, meta0); await onFail(t, 'checkpoint:' + e.challenge.type); await markTask(t, 'failed'); break; }",
"        if (e && e.challenge) { log(`  ⛔ checkpoint (${e.challenge.type}) — DỪNG nick`); await flagChallenge(meta0.pid || profile, e.challenge, meta0); await onFail(t, 'checkpoint:' + e.challenge.type, { kind: 'none' }); await markTask(t, 'failed'); break; }\n        if (e && e.human) { await onHuman(t, e.human); await markTask(t, 'cancelled'); continue; } // v2026-09-11 (R-1): người thật vào giữa phễu");
rep("        await onFail(t, e && e.message); await markTask(t, 'failed');\n        log(`  ✗ ${t.action}: ${e && e.message}`);",
"        await onFail(t, e && e.message, { kind: (e && e.failKind) || 'ui' }); await markTask(t, 'failed'); // v2026-09-11 (R-9): phân loại ui/fb\n        log(`  ✗ ${t.action}: ${e && e.message}`);");
rep("    for (const t of tasks) { if ((e && e.infra) || isInfraErr(e)) await onInfra(t, e && e.message); else await onFail(t, e && e.message); await markTask(t, 'failed'); } // v2026-09-06d: e.infra (watchdog)",
"    for (const t of tasks) { if ((e && e.infra) || isInfraErr(e)) await onInfra(t, e && e.message); else await onFail(t, e && e.message, { kind: 'none' }); await markTask(t, 'failed'); } // v2026-09-06d: e.infra (watchdog) · v2026-09-11: lỗi mở nick không phải lỗi FB/selector → không đếm");
rep("  } finally {\n    runningNicks = Math.max(0, runningNicks - 1);\n    if (!superseded())", "  } finally {\n    runningNicks = Math.max(0, runningNicks - 1); activeProfiles.delete(profile);\n    if (!superseded())");

/* ===== 12. helper mới: humanBusy/leadHumanNow/preflight/onHuman · dryFunnel — chèn trước khối runNick ===== */
rep("/* ---------- Xử lý 1 NICK: gộp mọi task tới hạn của nick trong 1 phiên ---------- */",
`/* ---------- v2026-09-11 (R-1 phía worker): KIỂM LẠI lead/thread NGAY TRƯỚC KHI CHẠM ----------
   Engine (LỆNH #44) đã lọc lúc xếp việc + trigger statsOnLead tắt phễu khi người thật vào; nhưng từ lúc xếp việc tới lúc worker mở nick có thể
   cách nhiều giờ → worker đọc lại: thread đã tắt / sang bước human-expired → task lỗi thời (huỷ êm, không log); lead có dấu người thật (đã chăm /
   hẹn / chốt / không thành / khách đã phản hồi) → dừng phễu (step human), hoàn van cùng ngày, log 🙋. Kiểm cả TRƯỚC MỖI BƯỚC trong phễu. */
function humanBusy(lead, brand) {
  const l = lead || {};
  if (l.lost) return 'lead đã Không thành';
  if (l.closed_at) return 'lead đã chốt';
  if (l.dropped) return 'lead đã bị loại';
  if (l.outreach_replied) return 'khách đã phản hồi';
  if (l.stage && l.stage !== 'new') return 'lead đang ở giai đoạn "' + l.stage + '" (người thật chăm)';
  if (l.first_care_at) return 'sales đã chăm lead';
  if (l.last_touch_at) return 'sales vừa liên hệ lead';
  const o = (brand && brand.outreach) || {};
  if (o.skipAssigned && (l.assignee || l.assigned_to)) return 'lead đã giao người phụ trách (brand chọn bỏ qua lead đã giao)';
  return '';
}
async function leadHumanNow(t) {
  if (!t || !t.leadId) return null;
  let lead = null; try { const d = await db.collection('leads').doc(String(t.leadId)).get(); lead = d.exists ? (d.data() || {}) : null; } catch (_) { return null; }
  if (!lead) return null;
  const brand = t.brandCode ? await cachedDoc('brands', t.brandCode, 60000) : null;
  const why = humanBusy(lead, brand);
  return why ? { human: true, why } : null;
}
async function preflight(t) {
  if (!t || !t.leadId) return null;
  let th = null; try { const d = await db.collection('outreach_threads').doc(String(t.leadId)).get(); th = d.exists ? (d.data() || {}) : null; } catch (_) { th = null; }
  if (th && (th.active === false || ['human', 'expired', 'skipped_role', 'replied', 'done'].includes(String(th.step || '')))) return { obsolete: true, why: 'thread đã ' + (th.active === false ? 'tắt' : th.step) + ' (engine/người thật) — bỏ task' };
  return leadHumanNow(t);
}
async function onHuman(t, pf) {
  const why = (pf && pf.why) || 'người thật đã tiếp quản';
  if (pf && pf.obsolete) { log(\`  ⏭ task lỗi thời lead \${t.leadId}: \${why}\`); return; } // thread đã tắt → engine/trigger đã xử lý, không ghi thêm
  let cur = {}; try { cur = (await db.collection('outreach_threads').doc(t.leadId).get()).data() || {}; } catch (_) { }
  try { await db.collection('outreach_threads').doc(t.leadId).set({ active: false, step: 'human', taskStatus: 'cancelled', stopReason: why, stoppedAt: Date.now() }, { merge: true }); } catch (_) { }
  try { await db.collection('outreach_log').add({ leadId: t.leadId, name: t.name, brand: t.brandName, brandCode: t.brandCode, temp: t.temp, score: t.score, pid: t.pid,
    action: '🙋 Người thật đã tiếp quản lead — máy dừng (kiểm trước khi chạm)', text: why, status: 'skip', at: FieldValue.serverTimestamp(), expireAt: expireTs() }); } catch (_) { }
  if (t.action === 'funnel' && t.payload && Array.isArray(t.payload.steps)) await refundQuota(t.pid, t.payload.steps, cur.doneSteps, cur.reservedDay);
  log(\`  🙋 dừng lead \${t.leadId}: \${why}\`);
}
/* ---------- v2026-09-11: CHẠY THỬ (config.dryRun=true) — mở nick + đi hết phễu nhưng KHÔNG thao tác thật ----------
   Mở bài (xem được không, có fb_dtsg không), mở trang cá nhân (có nút Thêm bạn bè / Nhắn tin, giải mã uid), ghi log "[DRY] …" status 'dry' lên web.
   KHÔNG: react/comment/kết bạn/inbox, KHÔNG ghi doneSteps/okCount/KPI/dấu vết lead. Xong → hoãn thread 2 giờ (engine đẩy lại sau khi anh tắt dryRun). */
async function dryFunnel(page, t) {
  const p = t.payload || {}; const steps = t.action === 'funnel' ? (p.steps || []) : [t.action];
  const dlog = async (step, text) => { try { await db.collection('outreach_log').add({ leadId: t.leadId, name: t.name, brand: t.brandName, brandCode: t.brandCode, temp: t.temp, score: t.score, pid: t.pid,
    action: '[DRY] ' + actionLabel(step, { reaction: p.reaction, kind: p.kind }), text: text || '', status: 'dry', at: FieldValue.serverTimestamp(), expireAt: expireTs() }); } catch (_) { } };
  let postState = null, profState = null;
  const openPost = async () => {
    if (postState) return postState;
    const url = p.comment_url || p.post_url; if (!url) return (postState = 'không có post_url');
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await sleep(CFG.actionDelayMs);
    if (loggedOut(page)) throw Object.assign(new Error('needLogin'), { needLogin: true });
    try {
      const cid = p.kind === 'comment' && p.comment_id ? String(p.comment_id).replace(/\\D/g, '') : '';
      const ok = await waitForContent(page, cid ? { cidRe: '[?&]comment_id=' + cid + '(?:&|$)', missing: 'không thấy bình luận comment_id=' + cid } : {});
      postState = ok ? 'mở được bài ✓' : 'bài chưa vẽ xong sau 12 s';
    } catch (e) { if (e && e.needLogin) throw e; postState = (e && e.skip) ? ('không xem được: ' + e.message) : ('lỗi: ' + (e && e.message)); }
    const dtsg = await getDtsg(page).catch(() => null); postState += dtsg ? ' · fb_dtsg ✓' : ' · fb_dtsg ✗';
    return postState;
  };
  const openProfile = async () => {
    if (profState) return profState;
    const url = p.profile_url || (p.uid ? \`https://www.facebook.com/profile.php?id=\${p.uid}\` : null); if (!url) return (profState = 'không có author_url/uid → bỏ kết bạn/inbox');
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await sleep(CFG.actionDelayMs);
    if (loggedOut(page)) throw Object.assign(new Error('needLogin'), { needLogin: true });
    const f = await firstVisible(page, ['div[role="button"][aria-label*="Thêm bạn bè"]', 'div[role="button"][aria-label*="Bạn bè"]', 'div[role="button"][aria-label*="Huỷ lời mời"]', 'div[role="button"][aria-label*="Hủy lời mời"]']);
    const m = await firstVisible(page, ['div[role="button"][aria-label*="Nhắn tin"]', 'div[role="button"][aria-label*="Message" i]']);
    const uid = await resolveProfileUid(page).catch(() => null);
    profState = \`trang cá nhân mở ✓ · nút kết bạn \${f ? '✓' : '✗ (có thể trong menu …)'} · nút Nhắn tin \${m ? '✓' : '✗'} · uid \${uid || '?'}\`;
    return profState;
  };
  for (const step of steps) {
    abortCheck(page);
    if (step === 'react' || step === 'comment') await dlog(step, await openPost());
    else if (step === 'add_friend' || step === 'inbox') await dlog(step, await openProfile());
    await sleep(rand(800, 1500));
  }
  await onPaused(t, 'chạy thử (dryRun) xong — KHÔNG thao tác thật; tắt "dryRun" trong config.json để chạy thật', Date.now() + 2 * 3600e3);
  log(\`  [DRY] lead \${t.leadId}: \${steps.join('→')} · \${postState || ''} · \${profState || ''}\`);
}

/* ---------- Xử lý 1 NICK: gộp mọi task tới hạn của nick trong 1 phiên ---------- */`);

/* ===== 13. claimBatch: bỏ nick đang đọc inbox · tick/tickLoop: stopping · goOffline hook ===== */
rep("    if (myNicks && t0.adspower_id && !myNicks.has(t0.adspower_id)) continue; // chốt an toàn khi nick vừa đổi VPS",
"    if (myNicks && t0.adspower_id && !myNicks.has(t0.adspower_id)) continue; // chốt an toàn khi nick vừa đổi VPS\n    if (t0.adspower_id && readingProfiles.has(t0.adspower_id)) continue; // v2026-09-11 (R-2): nick đang mở để đọc inbox → để việc lại vòng sau");
rep("async function tick() {\n  if (pausedAll) {", "async function tick() {\n  if (stopping) return 0; // v2026-09-11 (R-8): đang tắt êm — không nhận việc mới\n  if (pausedAll) {");
rep("  if (recycleWanted) { log('♻️ tái khởi động định kỳ (chống rò bộ nhớ/phiên) — run.bat sẽ tự chạy lại'); return goOffline(); }\n  let got = 0;\n  try { got = await tick(); } catch (e) { log('tickLoop lỗi:', e && e.message); }",
"  if (stopping) { if (runningNicks === 0 && !replyBusy) return goOffline(); return setTimeout(tickLoop, 1000); } // v2026-09-11 (R-8): chờ nick đang chạy xong bước rồi thoát\n  if (recycleWanted && !replyBusy) { log('♻️ tái khởi động định kỳ (chống rò bộ nhớ/phiên) — run.bat sẽ tự chạy lại'); return goOffline(); }\n  let got = 0;\n  try { got = await tick(); } catch (e) { log('tickLoop lỗi:', e && e.message); }");

/* ===== 14. replyLoop / readNick / requestStop — chèn trước khối capture ===== */
rep("/* ---------- Chế độ CAPTURE: lấy doc_id GraphQL để bật API nội bộ ---------- */",
`/* ---------- v2026-09-11 (R-2): VÒNG ĐỌC INBOX ĐỘC LẬP ----------
   Trước: checkReplies chỉ chạy CUỐI phiên có việc mới → nick hết van / brand tắt / không có lead mới = KHÔNG BAO GIỜ đọc inbox (replyFound = 0
   suốt 10 ngày dù đã inbox 4 khách — LỆNH #43/#43b). Giờ: theo lịch riêng (inbox.everyMin), mỗi nick VPS này phụ trách còn thread đã inbox chưa
   phản hồi tới hạn (replyNextAt ≤ now) → mở nick CHỈ để đọc messenger rồi đóng. Tuần tự 1 nick/lượt; bỏ nick đang chạy phễu (và phễu bỏ nick đang
   đọc); tôn trọng giờ VN / Dừng tất cả / tắt êm; nick cần đăng nhập / checkpoint / Safety dừng → bỏ. Không có thread tới hạn → KHÔNG mở nick. */
let replyBusy = false;
async function replyLoop() {
  const ib = CFG.inbox || {}; if (!ib.enabled || CFG.replyLoop === false || replyBusy || pausedAll || stopping || !inHoursVN()) return;
  replyBusy = true;
  try {
    let accs = [];
    try {
      if (CFG.profiles && CFG.profiles.length) { for (const pr of CFG.profiles) { const s = await db.collection('fb_accounts').where('adspower_id', '==', pr).limit(1).get(); s.forEach(d => accs.push(Object.assign({ id: d.id }, d.data()))); } }
      else { const snap = await db.collection('fb_accounts').where('workerId', '==', CFG.workerId).get(); snap.forEach(d => accs.push(Object.assign({ id: d.id }, d.data()))); }
    } catch (e) { log('replyLoop: đọc nick lỗi', e && e.message); return; }
    const everyMs = (Number(ib.everyMin) || 60) * 60000, now = Date.now();
    accs = accs.filter(a => a.adspower_id && a.active !== false && !a.needLogin && !a.safetyPaused && !a.challenge && (now - (Number(a.replyCheckAt) || 0)) >= everyMs && !activeProfiles.has(a.adspower_id));
    for (const a of accs) {
      if (stopping || pausedAll) break;
      const pid = a.id; let due = 0;
      try {
        const s = await db.collection('outreach_threads').where('pid', '==', pid).where('step', '==', 'done').limit(80).get();
        s.forEach(d => { const x = d.data() || {}; if (x.replied) return; if (!(Array.isArray(x.doneSteps) && x.doneSteps.includes('inbox'))) return; if ((Number(x.replyNextAt) || 0) > now) return; const t0 = Number(x.inboxAt) || Number(x.nextAt) || 0; if (t0 && now - t0 > (Number(ib.days) || 7) * 86400000) return; due++; });
      } catch (e) { log('replyLoop: query thread lỗi', e && e.message); continue; }
      if (!due) { try { await db.collection('fb_accounts').doc(pid).set({ replyCheckAt: now }, { merge: true }); } catch (_) { } continue; }
      if (activeProfiles.has(a.adspower_id)) continue;
      readingProfiles.add(a.adspower_id);
      const ctl = { aborted: false, browser: null, page: null };
      try { await withTimeout(readNick(a, due, ctl).catch(e => log(\`💬 nick \${a.adspower_id} lỗi:\`, e && e.message)), CFG.nickTimeoutMs, () => hardCancel(ctl, a.adspower_id)); }
      finally { readingProfiles.delete(a.adspower_id); }
    }
  } finally { replyBusy = false; }
}
async function readNick(a, due, ctl) {
  const profile = a.adspower_id, pid = a.id; let browser, page;
  log(\`💬 nick \${profile}: mở để đọc phản hồi (\${due} thread tới hạn)\`);
  try {
    const cdp = await adspowerStart(profile); if (ctl.aborted) return;
    ({ browser, page } = await getPage(cdp)); ctl.browser = browser; ctl.page = page; page.__slCtl = ctl;
    try { page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(45000); } catch (_) { }
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' }).catch(() => { }); await sleep(2000);
    const meta = { leadId: '', name: '', brandName: '', brandCode: a.brand || '', temp: '', score: 0, pid };
    if (loggedOut(page)) { await onNeedLogin(meta, { count: true, noThread: true }); return; }
    const ch0 = await detectChallengeStrict(page); if (ch0) { await flagChallenge(pid, ch0, meta); return; }
    await checkReplies(page, { pid, brandCode: a.brand || '', force: true });
  } catch (e) { log(\`💬 nick \${profile} lỗi:\`, e && e.message); }
  finally { try { if (browser) await withTimeout(browser.close(), 15000); } catch (_) { } if (CFG.closeAfter) await adspowerStop(profile); }
}

/* ---------- v2026-09-11 (R-8): TẮT ÊM ----------
   Ctrl+C / SIGTERM lần 1: không nhận việc mới, việc đang làm xong BƯỚC hiện tại (doneSteps đã ghi) rồi thoát (tối đa stopGraceMs); lần 2: thoát ngay.
   Tái khởi động 6h vốn chỉ chạy giữa 2 vòng tick nên không cắt ngang phiên; run.bat tự chạy lại. */
let stopTimer = null;
function requestStop(sig) {
  if (stopping) { log('⏹ tín hiệu lần 2 — thoát ngay'); return goOffline(); }
  stopping = true;
  log(\`⏹ \${sig || 'stop'}: tắt êm — không nhận việc mới, chờ bước đang làm xong (tối đa \${Math.round((CFG.stopGraceMs || 90000) / 1000)} s)…\`);
  stopTimer = setTimeout(() => { log('⏹ hết thời gian chờ — thoát'); goOffline(); }, CFG.stopGraceMs || 90000);
  if (stopTimer && stopTimer.unref) stopTimer.unref();
  if (!busy && runningNicks === 0 && !replyBusy) return goOffline();
}

/* ---------- Chế độ CAPTURE: lấy doc_id GraphQL để bật API nội bộ ---------- */`);

/* ===== 15. Khởi động: SIGINT → requestStop · log · replyLoop lịch ===== */
rep("  log(`SmartLead AdsPower worker v2 | workerId=${CFG.workerId} | đồng thời=${CFG.maxConcurrent} | API nội bộ=${CFG.graphql && CFG.graphql.reactDocId ? 'BẬT' : 'tắt (DOM)'} | v${WORKER_VERSION}`);\n  process.on('SIGINT', goOffline); process.on('SIGTERM', goOffline);",
"  log(`SmartLead AdsPower worker v2 | workerId=${CFG.workerId} | đồng thời=${CFG.maxConcurrent} | API nội bộ=${CFG.graphql && CFG.graphql.reactDocId ? 'BẬT' : 'tắt (DOM)'} | v${WORKER_VERSION}${CFG.dryRun ? ' | ⚠ CHẠY THỬ (dryRun) — không thao tác thật' : ''}`);\n  log(`Trần cứng/nick/ngày: react ${CFG.hardCaps.react} · comment ${CFG.hardCaps.comment} · kết bạn ${CFG.hardCaps.friend} · inbox ${CFG.hardCaps.inbox} · giờ ${CFG.hoursVN[0]}–${CFG.hoursVN[1]}h VN`);\n  process.on('SIGINT', () => requestStop('SIGINT')); process.on('SIGTERM', () => requestStop('SIGTERM')); // v2026-09-11 (R-8): tắt êm");
rep("  setInterval(() => { recycleWanted = true; }, 6 * 3600 * 1000); // tái khởi động định kỳ (áp dụng giữa 2 vòng tick)\n  tickLoop();",
"  setInterval(() => { recycleWanted = true; }, 6 * 3600 * 1000); // tái khởi động định kỳ (áp dụng giữa 2 vòng tick)\n  if (CFG.inbox && CFG.inbox.enabled && CFG.replyLoop !== false) { const iv = Math.max(10, Number(CFG.inbox.everyMin) || 60); setTimeout(replyLoop, 2 * 60000); setInterval(replyLoop, Math.max(5, Math.floor(iv / 2)) * 60000); log(`💬 Vòng đọc inbox độc lập: mỗi ${iv}′/nick · backoff thread ${CFG.inbox.backoffH.join('h→')}h · cửa sổ ${CFG.inbox.days} ngày`); } // v2026-09-11 (R-2)\n  tickLoop();");

if (miss.length) { console.error('KHÔNG THẤY MỐC (' + miss.length + ') — KHÔNG GHI GÌ:\n' + miss.join('\n')); process.exit(1); }
// R-2 (bổ sung sau harness H1): thread cũ thiếu brandCode/brand → lấy brand từ lead để KPI replied + note đúng brand
rep("      const brandCode = c.x.brandCode || c.x.brand || (meta && meta.brandCode) || '';",
"      let brandCode = c.x.brandCode || c.x.brand || (meta && meta.brandCode) || '';\n      if (!brandCode) { try { const ld = await db.collection('leads').doc(leadId).get(); brandCode = (ld.exists && ld.data().brand) || ''; } catch (_) { } } // v2026-09-11: thread cũ thiếu brandCode → lấy từ lead (KPI replied + note đúng brand)");

fs.writeFileSync(outFile, s);
console.log('PATCH OK → ' + outFile + ' (' + s.split('\n').length + ' dòng)');
