cat > /tmp/l31a.sh <<'EOF'
set -e
cd ~/firebase-s13/functions
OUT=~/scorer-dump-0905.txt
{
  echo "===== lib/scorer.js (co so dong) ====="
  grep -n "" lib/scorer.js | sed -E 's/(sk-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/\1…/g'
  echo; echo "===== lib/filter.js (isExcluded) ====="
  grep -n "" lib/filter.js | head -80
  echo; echo "===== index.js: cho goi prefilter/score + ctx comment + user_url ====="
  grep -n "prefilterLead\|scoreLead\|parentAuthor\|parent_author\|parent_user\|is_real_lead\|hotness\|user_url\|__brandAiOf" index.js | head -60
  echo; echo "===== outreach.js: stepNickAdspower -> outreachTick (de gate) ====="
  grep -n "" outreach.js | sed -n '/async function stepNickAdspower/,/export const outreachTick/p'
  echo; echo "===== AUDIT comment-lead ====="
  cat > _l31_audit.mjs <<'JS'
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const SELLER_RE = /\b(ib|inbox)\b|em gửi|mình gửi|nhà em|bên em|bên mình có|có sẵn|giá chỉ|liên hệ|zalo|ship|sỉ lẻ|báo giá|check ib/i;
const cut = (s, n) => String(s || '').replace(/\s+/g, ' ').slice(0, n);
const snap = await db.collection('leads').where('kind', '==', 'comment').get();
const all = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
const ms = l => (l.detected_at && l.detected_at.toMillis) ? l.detected_at.toMillis() : 0;
const since = Date.now() - 30 * 864e5;
const recent = all.filter(l => ms(l) >= since);
console.log('comment-lead tổng:', all.length, '| 30 ngày:', recent.length);
const self = recent.filter(l => l.name && l.parent_author && fold(l.name) === fold(l.parent_author));
const sellerish = recent.filter(l => !self.includes(l) && SELLER_RE.test(l.text || ''));
console.log('→ người bình luận = CHỦ BÀI (tên khớp):', self.length, '| bình luận có mùi người bán (regex, chưa tính chủ bài):', sellerish.length);
const byBrand = {}; for (const l of self) byBrand[l.brand || '?'] = (byBrand[l.brand || '?'] || 0) + 1;
console.log('   chủ bài theo brand:', JSON.stringify(byBrand));
const byTemp = {}; for (const l of self) byTemp[l.temp || '?'] = (byTemp[l.temp || '?'] || 0) + 1;
console.log('   chủ bài theo nhiệt độ:', JSON.stringify(byTemp));
const touched = self.filter(l => l.outreach && Array.isArray(l.outreach.steps) && l.outreach.steps.length);
console.log('   chủ bài ĐÃ bị máy chạm (react/comment/...):', touched.length, touched.map(l => l.id + ':' + (l.outreach.steps || []).join('+')).slice(0, 15).join(' , '));
let activeTh = 0;
for (let i = 0; i < self.length; i += 100) { const refs = self.slice(i, i + 100).map(l => db.doc('outreach_threads/' + l.id)); const ds = await db.getAll(...refs); activeTh += ds.filter(d => d.exists && (d.data() || {}).active === true).length; }
console.log('   chủ bài còn thread ĐANG MỞ (sẽ bị máy chạm tiếp):', activeTh);
console.log('-- MẪU 8 lead chủ bài:');
for (const l of self.slice(0, 8)) console.log('  ', l.id, '|', l.temp, l.score, '|', cut(l.name, 22), '|| BL:', JSON.stringify(cut(l.text, 90)), '|| BÀI:', JSON.stringify(cut(l.parent_text, 110)));
console.log('-- MẪU 8 lead mùi người bán (không phải chủ bài):');
for (const l of sellerish.slice(0, 8)) console.log('  ', l.id, '|', l.temp, l.score, '|', cut(l.name, 22), 'vs chủ bài', cut(l.parent_author, 22), '|| BL:', JSON.stringify(cut(l.text, 90)), '|| BÀI:', JSON.stringify(cut(l.parent_text, 110)));
console.log('-- Field có trong 1 comment-lead:', Object.keys(recent[0] || {}).filter(k => !/phone|email/.test(k)).sort().join(','));
JS
  node _l31_audit.mjs; rm -f _l31_audit.mjs
} > "$OUT" 2>&1
wc -l "$OUT"
EOF
bash /tmp/l31a.sh && cloudshell download ~/scorer-dump-0905.txt
