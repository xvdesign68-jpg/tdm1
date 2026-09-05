cat > /tmp/run30c.sh <<'EOF'
set -e
cd ~/firebase-s13/functions
set -a; . ./.env; set +a
cat > _l30_regen.mjs <<'JS'
// LENH #30c: soạn lại comment/inbox (có CTA) cho thread funnel ĐANG MỞ mà CHƯA bình luận (lead đã mở lại ở LỆNH #28 còn xếp hàng). --dry = chỉ in, không ghi.
import admin from 'firebase-admin'; if (admin.apps.length === 0) admin.initializeApp();
const db = admin.firestore();
const { genForLead } = await import('./content.js');
const DRY = process.argv.includes('--dry');
const snap = await db.collection('outreach_threads').where('active', '==', true).get();
const th = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).filter(t => t.step === 'funnel' && t.fpayload && Array.isArray(t.fpayload.steps) && t.fpayload.steps.includes('comment') && !(t.doneSteps || []).includes('comment'));
console.log('thread funnel đang mở, CHƯA bình luận:', th.length, DRY ? '(DRY-RUN)' : '');
const brands = {}; let n = 0;
for (const t of th) {
  const ld = await db.doc('leads/' + t.id).get(); if (!ld.exists) { console.log(' -', t.id, 'lead không còn → bỏ'); continue; }
  const lead = Object.assign({ id: t.id }, ld.data()); const code = lead.brand || t.brandCode || t.brand; if (!code) { console.log(' -', t.id, 'không rõ brand → bỏ'); continue; }
  if (!brands[code]) brands[code] = Object.assign({ code }, (await db.doc('brands/' + code).get()).data() || {});
  const g = await genForLead(brands[code], lead);
  console.log(' -', t.id, '|', (lead.name || '').slice(0, 22), '|', (lead.comment_id || lead.comment_url) ? 'bình luận' : 'bài', '|', g.mode, '|', g.comment);
  if (DRY) continue;
  await db.doc('outreach_threads/' + t.id).update({ 'fpayload.comment_msg': g.comment, 'fpayload.inbox_msg': g.inbox, 'fpayload.content_mode': g.mode, regenBy: 'LENH30', regenAt: Date.now() });
  const task = await db.doc('outreach_tasks/' + t.id + '__funnel').get(); const st = task.exists ? (task.data() || {}).status : '-';
  if (task.exists && ['queued', 'failed', 'paused'].includes(st)) await task.ref.update({ 'payload.comment_msg': g.comment, 'payload.inbox_msg': g.inbox, 'payload.content_mode': g.mode });
  console.log('   → thread cập nhật; task', st, ['queued', 'failed', 'paused'].includes(st) ? 'cập nhật' : 'giữ nguyên');
  n++;
}
console.log(DRY ? 'DRY-RUN xong — không ghi gì' : ('ĐÃ CẬP NHẬT ' + n + ' thread'));
JS
node _l30_regen.mjs "$@"; rm -f _l30_regen.mjs
EOF
bash /tmp/run30c.sh "$@"
