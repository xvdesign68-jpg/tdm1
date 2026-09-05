/* _l31_fix.mjs — LỆNH #31b KHỐI 2 (đặt trong ~/firebase-s13/functions).
   A) comment-lead là CHÍNH CHỦ BÀI (tên người bình luận = tên tác giả bài gốc, bỏ dấu; ẩn danh không tính)
      → gắn role 'poster_self' + dropped:true (Loại — sales vẫn Khôi phục được), tắt thread/task tự động đang mở.
   B) --rescore: chấm lại VAI bằng AI (prompt mới) cho comment-lead 30 ngày KHÔNG phải chủ bài, còn mở, chưa có role
      → role seller/poster_self ⇒ Loại + tắt thread; buyer/other ⇒ chỉ ghi role. Cần .env (set -a; . ./.env; set +a).
   node _l31_fix.mjs                      → A DRY (chỉ in)
   node _l31_fix.mjs --apply              → A ghi
   node _l31_fix.mjs --rescore [--limit N] [--apply]   → B (mặc định 60 lead mới nhất) */
import admin from 'firebase-admin';
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore(); const { FieldValue } = admin.firestore;
const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply'), RESCORE = ARGS.includes('--rescore');
const LIMIT = (() => { const i = ARGS.indexOf('--limit'); return i >= 0 ? Math.max(1, Number(ARGS[i + 1]) || 60) : 60; })();
const ANON = /an danh|anonymous|nguoi tham gia|facebook user|nguoi dung facebook/;
const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
const ms = l => (l.detected_at && l.detected_at.toMillis) ? l.detected_at.toMillis() : 0;
const isSelf = l => { const a = fold(l.name), p = fold(l.parent_author); return !!(a && p && a === p && !ANON.test(a)); };
const closedish = l => !!(l.closed_at || l.deal_value || l.stage === 'closed' || l.lost);
async function commitBatch(ops) { for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); for (const [ref, data] of ops.slice(i, i + 400)) b.set(ref, data, { merge: true }); await b.commit(); } }
async function openThreadsTasks(ids) {
  const th = [], tk = [];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    (await db.getAll(...part.map(id => db.doc('outreach_threads/' + id)))).forEach(d => { if (d.exists && (d.data() || {}).active === true) th.push(d.ref); });
    (await db.getAll(...part.map(id => db.doc('outreach_tasks/' + id + '__funnel')))).forEach(d => { if (d.exists && (d.data() || {}).status === 'queued') tk.push(d.ref); });
  }
  return { th, tk };
}

const snap = await db.collection('leads').where('kind', '==', 'comment').get();
const all = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
console.log('comment-lead tổng:', all.length, '| chế độ:', RESCORE ? 'B rescore' : 'A chủ bài', APPLY ? '(GHI)' : '(DRY)');

if (!RESCORE) {
  const self = all.filter(l => isSelf(l) && l.role !== 'poster_self');
  const selfDo = self.filter(l => !closedish(l));
  console.log('A) chủ bài tên khớp, chưa gắn role:', self.length, '| bỏ qua vì đã chốt/không thành:', self.length - selfDo.length, '| sẽ xử lý:', selfDo.length, '| trong đó đã dropped sẵn:', selfDo.filter(l => l.dropped).length);
  const byBrand = {}; for (const l of selfDo) byBrand[l.brand || '?'] = (byBrand[l.brand || '?'] || 0) + 1; console.log('   theo brand:', JSON.stringify(byBrand));
  const { th, tk } = await openThreadsTasks(selfDo.map(l => l.id));
  console.log('   thread ĐANG MỞ sẽ tắt:', th.length, th.slice(0, 8).map(r => r.id).join(','), '| task funnel queued sẽ huỷ:', tk.length);
  console.log('   mẫu 6:'); for (const l of selfDo.slice(0, 6)) console.log('    ', l.id, '|', l.temp, l.score, '|', cut(l.name, 22), '|| BL:', JSON.stringify(cut(l.text, 70)), '|| BÀI:', JSON.stringify(cut(l.parent_text, 80)));
  if (APPLY) {
    const now = Date.now(), reason = 'Bình luận của chính chủ bài (đối soát LỆNH #31b)', ops = [];
    for (const l of selfDo) { const d = { role: 'poster_self', role_reason: reason, self_comment: true }; if (!l.dropped) Object.assign(d, { dropped: true, dropped_at: now, dropped_by: 'lenh31b' }); ops.push([db.doc('leads/' + l.id), d]); }
    for (const r of th) ops.push([r, { active: false, step: 'skipped_role', taskStatus: 'skipped', skipReason: reason, nextAt: 0 }]);
    for (const r of tk) ops.push([r, { status: 'skipped', skipReason: reason, finishedAt: FieldValue.serverTimestamp() }]);
    await commitBatch(ops);
    console.log('ĐÃ GHI:', selfDo.length, 'lead (role poster_self + dropped) |', th.length, 'thread tắt |', tk.length, 'task huỷ');
  } else console.log('(DRY — thêm --apply để ghi)');
} else {
  const { scoreLead } = await import('./lib/scorer.js');
  const { CFG } = await import('./lib/config.js');
  if (!CFG.LLM_API_KEY) { console.log('THIẾU LLM_API_KEY — chạy trước: set -a; . ./.env; set +a'); process.exit(1); }
  const since = Date.now() - 30 * 864e5;
  const cand = all.filter(l => ms(l) >= since && !isSelf(l) && !l.role && !l.dropped && !closedish(l)).sort((a, b) => ms(b) - ms(a)).slice(0, LIMIT);
  console.log('B) chấm lại VAI bằng AI:', cand.length, 'lead | model', CFG.LLM_MODEL);
  const cfg = (await db.doc('config/app').get()).data() || {};
  const brands = {}; (await db.collection('brands').get()).forEach(d => { brands[d.id] = d.data() || {}; });
  const srcs = {}; (await db.collection('sources').get()).forEach(d => { const s = d.data() || {}; if (s.name) srcs[s.name] = s; });
  const res = []; let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (i < cand.length) { const l = cand[i++]; try {
    const post = { kind: 'comment', text: l.text || '', author: l.name || '', user_url: l.author_url || '', parent_author: l.parent_author || '', parent_text: l.parent_text || '', parent_url: l.parent_url || '', self_comment: false };
    const ai = await scoreLead(post, srcs[l.source] || { industry: l.industry || '' }, cfg.weights, brands[l.brand] && brands[l.brand].ai);
    res.push(ai._llm === false ? { l, err: 'heuristic (AI lỗi)' } : { l, ai });
  } catch (e) { res.push({ l, err: e.message }); } } }));
  const block = res.filter(r => r.ai && (r.ai.role === 'seller' || r.ai.role === 'poster_self'));
  const cnt = {}; for (const r of res) { const k = r.err ? 'lỗi' : (r.ai.role || '(rỗng)'); cnt[k] = (cnt[k] || 0) + 1; } console.log('   phân bố vai:', JSON.stringify(cnt));
  console.log('   SẼ LOẠI (seller/poster_self):', block.length);
  for (const r of block.slice(0, 15)) console.log('    ', r.l.id, '|', r.l.temp, r.l.score, '|', cut(r.l.name, 20), 'vs', cut(r.l.parent_author, 20), '|', r.ai.role, '—', cut(r.ai.role_reason, 70), '|| BL:', JSON.stringify(cut(r.l.text, 60)));
  const buyers = res.filter(r => r.ai && r.ai.role === 'buyer'); console.log('   GIỮ (buyer) mẫu 5:'); for (const r of buyers.slice(0, 5)) console.log('    ', r.l.id, '|', cut(r.l.name, 20), '|| BL:', JSON.stringify(cut(r.l.text, 60)), '—', cut(r.ai.role_reason, 60));
  if (APPLY) {
    const now = Date.now(), ops = [], reason = 'AI: người bán/chủ bài (đối soát LỆNH #31b)';
    for (const r of res) { if (!r.ai) continue; const d = { role: r.ai.role || 'other', role_reason: String(r.ai.role_reason || '').slice(0, 160), role_at: now }; if (r.ai.role === 'seller' || r.ai.role === 'poster_self') Object.assign(d, { dropped: true, dropped_at: now, dropped_by: 'lenh31b-ai' }); ops.push([db.doc('leads/' + r.l.id), d]); }
    const { th, tk } = await openThreadsTasks(block.map(r => r.l.id));
    for (const ref of th) ops.push([ref, { active: false, step: 'skipped_role', taskStatus: 'skipped', skipReason: reason, nextAt: 0 }]);
    for (const ref of tk) ops.push([ref, { status: 'skipped', skipReason: reason, finishedAt: FieldValue.serverTimestamp() }]);
    await commitBatch(ops);
    console.log('ĐÃ GHI role cho', res.filter(r => r.ai).length, 'lead | loại', block.length, '| thread tắt', th.length, '| task huỷ', tk.length);
  } else console.log('(DRY — thêm --apply để ghi)');
}
