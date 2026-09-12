/* _lc_clean.mjs — dọn doc group_state CŨ khoá theo URL (LỆNH B đã di trú sang g_<gid>/s_<slug>). Mặc định DRY (chỉ liệt kê); `--apply` mới xoá.
   An toàn: chỉ xoá khi (a) có ≥ 15 doc gkey mới, (b) doc cũ không được ghi sau mốc deploy B (12/09/2026 12:11Z), (c) mọi group_state cũ có doc mới tương ứng (gkeyBySrcUrl từ sources) hoặc nguồn đã tắt/không còn.
   Đặt trong ~/firebase-s13/functions. Không đụng collection khác. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const APPLY = process.argv.includes('--apply'); const B_DEPLOY = Date.parse('2026-09-12T12:11:00Z');
const ms = v => !v ? 0 : (typeof v === 'number' ? v : (v.toMillis ? v.toMillis() : (v.seconds ? v.seconds * 1000 : (Date.parse(v) || 0))));
const gs = (await db.collection('group_state').get()).docs.map(d => Object.assign({ id: d.id }, d.data() || {}));
const NEW = gs.filter(x => /^(g_|s_)/.test(x.id)), OLD = gs.filter(x => !/^(g_|s_)/.test(x.id));
console.log('group_state: ' + gs.length + ' doc = mới (g_/s_) ' + NEW.length + ' + cũ (URL) ' + OLD.length);
if (!OLD.length) { console.log('không có doc cũ — xong.'); process.exit(0); }
if (NEW.length < 15) { console.log('DỪNG: doc mới < 15 (' + NEW.length + ') — B chưa di trú đủ, chưa dọn.'); process.exit(0); }
const late = OLD.filter(x => Math.max(ms(x.lastTriggerAt), ms(x.updatedAt), ms(x.at), ms(x.lastHarvestAt), ms(x.lastSweepAt)) > B_DEPLOY);
if (late.length) { console.log('DỪNG: ' + late.length + ' doc cũ còn được GHI sau deploy B (' + late.slice(0, 5).map(x => x.id).join(' · ') + ') — có đường code còn dùng khoá URL? gửi em.'); process.exit(0); }
OLD.slice(0, 40).forEach(x => console.log('  cũ:', x.id.slice(0, 90), '· ghi cuối', new Date(Math.max(ms(x.lastTriggerAt), ms(x.updatedAt), ms(x.at)) + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' VN'));
if (!APPLY) { console.log('[DRY] sẽ xoá ' + OLD.length + ' doc cũ. Chạy lại với --apply để xoá.'); process.exit(0); }
let n = 0; for (let i = 0; i < OLD.length; i += 400) { const bw = db.batch(); for (const x of OLD.slice(i, i + 400)) { bw.delete(db.collection('group_state').doc(x.id)); n++; } await bw.commit(); }
console.log('ĐÃ XOÁ ' + n + ' doc group_state cũ.');
