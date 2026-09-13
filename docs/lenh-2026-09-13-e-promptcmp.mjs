/* LỆNH E — `_promptcmp.mjs` (PA-1 bước (d)): SO SÁNH prompt cũ ↔ prompt v2 theo brand trên bài THẬT đã có quyết định (scanned_posts N ngày gần nhất).
   CHỈ ĐỌC Firestore + gọi AI (mỗi bài 1 lượt gpt-5.6-sol ≈ $0,003 → 40 bài ≈ $0,12). KHÔNG ghi gì. Đặt trong ~/firebase-s13/functions; chạy sau `set -a; . ./.env; set +a`.
   Dùng: node _promptcmp.mjs [--n=40] [--days=3] [--brand=<code>] [--conc=3]
   In: từng bài (brand · quyết định/điểm/vai CŨ ↔ v2: is_real_lead/raw/điểm tiêu chí/vai/conf/service/why) + tổng kết (đồng ý lead↔lead, lead→không, không→lead, |Δ| TB, phân bố nhiệt độ raw/v2, đổi vai, brand thiếu hồ sơ, chi phí). */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { scoreLead } from './lib/scorer.js';
import { CFG } from './lib/config.js';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const arg = (k, d) => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
const N = Math.max(4, Math.min(200, Number(arg('n', 40)) || 40)), DAYS = Math.max(1, Number(arg('days', 3)) || 3), BRAND = String(arg('brand', '')).trim(), CONC = Math.max(1, Math.min(6, Number(arg('conc', 3)) || 3));
const OFF = 7 * 3600e3; const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const tempOf = h => h >= 80 ? 'hot' : h >= 60 ? 'warm' : h >= 40 ? 'cold' : 'junk';
async function pageAll(q, orderField, sel, max) {
  const fields = (sel && sel.length) ? ((orderField === '__name__' || sel.includes(orderField)) ? sel : sel.concat(orderField)) : null; const out = []; let last = null;
  while (out.length < (max || 3000)) { let qq = q.orderBy(orderField, 'desc').limit(300); if (fields) qq = qq.select(...fields); if (last) qq = qq.startAfter(last); const s = await qq.get(); if (s.empty) break; s.docs.forEach(d => out.push(Object.assign({ __id: d.id }, d.data()))); last = s.docs[s.docs.length - 1]; if (s.size < 300) break; }
  return out;
}
console.log('== LỆNH E · _promptcmp — ' + new Date(Date.now() + OFF).toISOString().slice(0, 16).replace('T', ' ') + ' VN · n=' + N + ' · ' + DAYS + ' ngày' + (BRAND ? ' · brand ' + BRAND : '') + ' · model ' + CFG.LLM_MODEL + ' ==');
if (!CFG.LLM_API_KEY) { console.log('DỪNG: thiếu LLM_API_KEY (chạy `set -a; . ./.env; set +a` trước)'); process.exit(1); }
const since = new Date(Date.now() - DAYS * 864e5);
const sp = await pageAll(db.collection('scanned_posts').where('createdAt', '>=', since), 'createdAt', ['brand', 'decision', 'score', 'role', 'text', 'kind', 'author', 'parent_text', 'parent_author', 'comment_id', 'comment_url', 'post_url', 'source', 'ai_v2'], 2500);
const pool = sp.filter(p => (p.decision === 'lead' || p.decision === 'scored_low' || p.decision === 'seller' || p.decision === 'reseller') && String(p.text || '').trim().length >= 15 && (!BRAND || p.brand === BRAND) && !p.ai_v2);
const byBrand = {}; for (const p of pool) (byBrand[p.brand || '?'] = byBrand[p.brand || '?'] || { lead: [], rej: [] })[p.decision === 'lead' ? 'lead' : 'rej'].push(p);
const brands = Object.keys(byBrand); if (!brands.length) { console.log('Không có bài nào trong ' + DAYS + ' ngày (hoặc tất cả đã có ai_v2 = đã chấm bằng v2). Tăng --days.'); process.exit(0); }
const per = Math.max(2, Math.ceil(N / brands.length / 2)); const pick = [];
for (const b of brands) { pick.push(...byBrand[b].lead.slice(0, per), ...byBrand[b].rej.slice(0, per)); }
const items = pick.slice(0, N);
console.log('bài trong kho ' + sp.length + ' · đủ điều kiện ' + pool.length + ' · brand ' + brands.join(', ') + ' · chọn ' + items.length + ' (mỗi brand ≤' + per + ' lead + ≤' + per + ' loại)');
const cfgDoc = await db.collection('config').doc('app').get(); const weights = (cfgDoc.exists && (cfgDoc.data() || {}).weights) || [];
const aiCache = {}; const aiOf = async b => { if (!b) return null; if (!(b in aiCache)) { const s = await db.collection('brands').doc(b).get(); aiCache[b] = (s.exists && (s.data() || {}).ai) || null; } return aiCache[b]; };
const noProfile = new Set(); for (const b of brands) if (!scoreLead.hasProfileE(await aiOf(b))) noProfile.add(b);
if (noProfile.size) console.log('⚠ brand CHƯA có Hồ sơ AI (v2 chấm bằng prompt trung tính SME): ' + [...noProfile].join(', ') + ' → super khai ở Người dùng → Hồ sơ AI trước khi bật v2');
const rows = []; let tokIn = 0, tokOut = 0, fail = 0;
async function one(p) {
  const ai = await aiOf(p.brand); const post = { post_id: p.__id, url: p.post_url || '', text: p.text || '', author: p.author || '', kind: p.kind || 'post', parent_text: p.parent_text || '', parent_author: p.parent_author || '', comment_id: p.comment_id || '', comment_url: p.comment_url || '', self_comment: false };
  try { const r = await scoreLead(post, { name: p.source || '', industry: '' }, weights, ai, { tries: 2, v2: { prompt: true, mode: 'shadow' } });
    const u = r._usage || {}; tokIn += u.prompt || 0; tokOut += u.completion || 0; const v = r.ai_v2 || {}; const role = String(r.role || '');
    const resBlock = role === 'reseller' && !(ai && ai.banSi === true); const isLeadNew = !!r.is_real_lead && !(role === 'seller' || role === 'poster_self' || resBlock) && (r.hotness || 0) >= CFG.MIN_KEEP_SCORE;
    rows.push({ p, r, v, isLeadNew, role }); }
  catch (e) { fail++; rows.push({ p, err: String((e && e.message) || e).slice(0, 120) }); }
}
let i = 0; await Promise.all(Array.from({ length: CONC }, async () => { while (i < items.length) { const p = items[i++]; await one(p); } }));
const short = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
console.log('\n#  brand        | CŨ: quyết định / điểm / vai   | V2: lead? / raw / điểm tiêu chí / vai / tin cậy | service · why · text');
rows.forEach((x, k) => { const p = x.p; if (x.err) { console.log(String(k + 1).padStart(2) + '  ' + String(p.brand || '?').padEnd(12) + ' | ' + p.decision + ' / ' + (p.score || 0) + ' / ' + (p.role || '') + ' | LỖI ' + x.err); return; }
  const c = x.v.criteria || {}; const cs = ['intent', 'fit', 'timing', 'industry', 'area', 'quality'].map(k2 => (c[k2] === null || c[k2] === undefined) ? '-' : c[k2]).join('');
  console.log(String(k + 1).padStart(2) + '  ' + String(p.brand || '?').padEnd(12) + ' | ' + String(p.decision).padEnd(10) + ' ' + String(p.score || 0).padStart(3) + ' ' + String(p.role || '-').padEnd(11) + ' | ' + (x.isLeadNew ? 'LEAD ' : 'no   ') + String(x.v.raw).padStart(3) + ' ' + String(x.v.score === null || x.v.score === undefined ? '-' : x.v.score).padStart(3) + ' [' + cs + '] ' + x.role.padEnd(11) + ' ' + (x.v.conf === null || x.v.conf === undefined ? '-' : x.v.conf) + ' | ' + short(x.r.service, 24) + ' · ' + short((x.v.why || []).join('; '), 70) + ' · ' + short(p.text, 60)); });
const ok = rows.filter(x => !x.err); const oldLead = x => x.p.decision === 'lead';
const agree = ok.filter(x => oldLead(x) === x.isLeadNew).length, l2n = ok.filter(x => oldLead(x) && !x.isLeadNew).length, n2l = ok.filter(x => !oldLead(x) && x.isLeadNew).length;
const dRaw = ok.map(x => Math.abs((Number(x.p.score) || 0) - (x.v.raw || 0))); const dV2 = ok.filter(x => x.v.score !== null && x.v.score !== undefined).map(x => Math.abs((x.v.raw || 0) - x.v.score));
const dist = (f) => { const d = { hot: 0, warm: 0, cold: 0, junk: 0 }; ok.forEach(x => { const s = f(x); if (s !== null && s !== undefined) d[tempOf(s)]++; }); return d; };
const roleChg = {}; ok.forEach(x => { const a = String(x.p.role || '-'), b = x.role || '-'; if (a !== b) roleChg[a + '→' + b] = (roleChg[a + '→' + b] || 0) + 1; });
const cost = (tokIn / 1e6) * CFG.LLM_PRICE_IN + (tokOut / 1e6) * CFG.LLM_PRICE_OUT;
console.log('\n== TỔNG KẾT ==');
console.log('chấm ' + ok.length + '/' + rows.length + ' bài (lỗi ' + fail + ') · đồng ý lead↔lead ' + agree + '/' + ok.length + ' (' + (ok.length ? Math.round(agree / ok.length * 100) : 0) + ' %) · lead cũ → v2 KHÔNG ' + l2n + ' · loại cũ → v2 LEAD ' + n2l);
console.log('|Δ điểm| cũ ↔ raw v2 TB ' + (dRaw.length ? Math.round(dRaw.reduce((a, b) => a + b, 0) / dRaw.length) : '-') + ' · |raw − điểm tiêu chí| TB ' + (dV2.length ? Math.round(dV2.reduce((a, b) => a + b, 0) / dV2.length) : '-') + ' · thiếu criteria ' + ok.filter(x => x.v.score === null || x.v.score === undefined).length);
console.log('phân bố nhiệt độ — cũ ' + JSON.stringify(dist(x => Number(x.p.score) || 0)) + ' · v2 raw ' + JSON.stringify(dist(x => x.v.raw)) + ' · v2 tiêu chí ' + JSON.stringify(dist(x => x.v.score)));
console.log('đổi vai (cũ→v2): ' + (Object.keys(roleChg).length ? Object.entries(roleChg).map(([k, v]) => k + ' ' + v).join(' · ') : 'không') + ' · reseller ' + ok.filter(x => x.role === 'reseller').length + ' · proxy ' + ok.filter(x => x.role === 'proxy').length + ' · vai rỗng/other mà is_real_lead ' + ok.filter(x => x.r.is_real_lead && (x.role === '' || x.role === 'other')).length);
console.log('token ' + tokIn + '/' + tokOut + ' ≈ $' + (Math.round(cost * 1000) / 1000) + ' · KHÔNG ghi gì. Đọc: "lead cũ → v2 KHÔNG" là bài v2 gạt bỏ (xem why/vai có hợp lý), "loại cũ → v2 LEAD" là bài v2 cứu (đúng ngành brand?). Ưng → giữ mặc định (promptV2 bật, scoreV2 shadow); không ưng → config/app.scoring.promptV2=false (web) hoặc .env PROMPT_BRAND_V2=false.');
process.exit(0);
