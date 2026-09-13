/* LỆNH E · KHỐI 1 bước (c) — gọi THẬT scoreLead v2 (prompt theo brand + criteria) trên 1 bài gần nhất đã thành lead (scanned_posts decision 'lead'). CHỈ ĐỌC Firestore, 1 lượt AI (~$0.003). Lỗi KHÔNG chặn deploy.
   Đặt trong ~/firebase-s13/functions; chạy sau `set -a; . ./.env; set +a`. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { scoreLead } from './lib/scorer.js';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const t0 = Date.now(); const kill = setTimeout(() => { console.log('LIVE: quá 90 s — bỏ qua (không chặn deploy)'); process.exit(0); }, 90000);
try {
  const q = await db.collection('scanned_posts').where('decision', '==', 'lead').orderBy('createdAt', 'desc').limit(1).get().catch(async () => db.collection('scanned_posts').orderBy('createdAt', 'desc').limit(30).get());
  const doc = q.docs.find(d => (d.data() || {}).decision === 'lead') || q.docs[0];
  if (!doc) { console.log('LIVE: không có scanned_posts để thử — bỏ qua'); clearTimeout(kill); process.exit(0); }
  const p = doc.data() || {}; const brand = String(p.brand || '').trim();
  const bs = brand ? await db.collection('brands').doc(brand).get() : null; const ai = (bs && bs.exists && (bs.data() || {}).ai) || null;
  const cfg = await db.collection('config').doc('app').get(); const weights = (cfg.exists && (cfg.data() || {}).weights) || [];
  const post = { post_id: doc.id, url: p.post_url || '', text: p.text || '', author: p.author || '', kind: p.kind || 'post', parent_text: p.parent_text || '', parent_author: p.parent_author || '', comment_id: p.comment_id || '', comment_url: p.comment_url || '', self_comment: false };
  console.log('LIVE: bài ' + doc.id + ' · brand ' + (brand || '?') + ' · hồ sơ AI ' + (scoreLead.hasProfileE(ai) ? 'CÓ' + (ai.banSi ? ' (bán sỉ)' : '') : 'KHÔNG') + ' · điểm cũ ' + (p.score || 0) + ' · vai cũ ' + (p.role || '') + ' · text: ' + String(p.text || '').slice(0, 90).replace(/\s+/g, ' '));
  const r = await scoreLead(post, { name: p.source || '', industry: '' }, weights, ai, { tries: 2, v2: { prompt: true, mode: 'shadow' } });
  const v = r.ai_v2 || {};
  console.log('LIVE OK · ' + (r._model || '') + ' · ' + Math.round((Date.now() - t0) / 100) / 10 + ' s · is_real_lead ' + r.is_real_lead + ' · hotness raw ' + r.hotness_raw + ' · v2 ' + v.score + ' · conf ' + v.conf + ' · role ' + r.role + ' (' + String(r.role_reason || '').slice(0, 80) + ')');
  console.log('  criteria ' + JSON.stringify(v.criteria) + ' · w ' + v.w + ' · why ' + JSON.stringify(v.why) + ' · service ' + JSON.stringify(r.service) + ' · industry ' + JSON.stringify(r.industry));
  console.log('  need: ' + String(r.need || '').slice(0, 120) + ' | intent: ' + String(r.intent || '').slice(0, 120));
} catch (e) { console.log('LIVE LỖI (không chặn deploy): ' + String((e && e.message) || e).slice(0, 300)); }
clearTimeout(kill); process.exit(0);
