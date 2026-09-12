# LỆNH B · KHỐI 0 (12/09/2026) — CHỈ ĐỌC (1 ngoại lệ nhỏ ở mục (c): nếu KHÔNG có snapshot BrightData nào đang chín thì GIEO 1 snapshot 1 bài ≈ 1 record
#   (≈ 0,001–0,003 USD) chỉ để in TÊN FIELD THÔ; tắt bằng: B0_NO_TRIGGER=1 bash /tmp/b0.sh).
#   (a) codebase2/tagLeadBrand/index.js trọn + trạng thái deploy (tagLeadBrand/notifyBrandZalo/sendZaloZBS) · (b) zalo-fn getConfig · (c) field thô record BrightData (bài + bình luận).
#   Output: màn hình + ~/scan-dump-0912e.txt → cloudshell download ~/scan-dump-0912e.txt rồi upload vào chat (ảnh chữ nhỏ em không đọc được).
set -u
OUT=$HOME/scan-dump-0912e.txt; : > "$OUT"
mask() { sed -E "s/(['\"\`])[A-Za-z0-9_./:+=-]{28,}\1/\1<che>\1/g; s/\b[0-9]{1,3}(\.[0-9]{1,3}){3}\b/<ip>/g; s/sk-[A-Za-z0-9_-]{6,}/sk-…/g; s/(Bearer )[A-Za-z0-9_.-]{8,}/\1<che>/g"; }
say() { echo "$@" | tee -a "$OUT"; }
dumpf() { local f="$1" cap="${2:-500}"; if [ -f "$f" ]; then local n; n=$(wc -l < "$f"); say "----- FILE $f ($n dòng, in tối đa $cap) -----"; head -n "$cap" "$f" | nl -ba | mask | tee -a "$OUT"; else say "----- FILE $f: KHONG CO -----"; fi; }
blk() { local f="$1" re="$2" n="${3:-60}"; local s; s=$(grep -nE "$re" "$f" 2>/dev/null | head -1 | cut -d: -f1); if [ -z "$s" ]; then say "--- $f :: KHONG THAY MOC /$re/"; return; fi; say "--- $f :: /$re/ từ dòng $s ($n dòng) ---"; sed -n "${s},$((s+n-1))p" "$f" | nl -ba -v "$s" | mask | tee -a "$OUT"; }
say "== LỆNH B · KHỐI 0 · $(date -u +%Y-%m-%dT%H:%MZ) =="

say "===== (a) tagLeadBrand (codebase2) ====="
T=$HOME/codebase2/tagLeadBrand
dumpf "$T/index.js" 500
if [ -f "$T/package.json" ]; then say "-- $T/package.json:"; node -e "const p=require(process.argv[1]);console.log(JSON.stringify({name:p.name,main:p.main,engines:p.engines,type:p.type,deps:Object.keys(p.dependencies||{})}))" "$T/package.json" | tee -a "$OUT"; fi
say "-- file khác trong codebase2 có chữ brand_pending / tagLeadBrand:"; grep -rln "brand_pending\|tagLeadBrand" "$HOME/codebase2" --include=*.js 2>/dev/null | grep -v node_modules | tee -a "$OUT"
say "-- mtime 3 bản index.js:"; stat -c '%y %n' "$T/index.js" "$HOME/smartlead-zalo-fn/functions/index.js" "$HOME/codebase2/notifyBrandZalo/index.js" 2>&1 | mask | tee -a "$OUT"
say "-- functions đang deploy (tagLeadBrand / notifyBrandZalo / sendZaloZBS):"; gcloud functions list --format="value(name,state,environment,updateTime)" 2>&1 | grep -E "tagLeadBrand|notifyBrandZalo|sendZaloZBS" | mask | tee -a "$OUT"
for fn in tagLeadBrand notifyBrandZalo; do for rg in asia-southeast1 us-central1; do
  d=$(gcloud functions describe "$fn" --region "$rg" --format="yaml(updateTime,buildConfig.entryPoint,buildConfig.runtime,eventTrigger.eventType,eventTrigger.eventFilters,eventTrigger.resource,serviceConfig.timeoutSeconds,serviceConfig.maxInstanceCount)" 2>/dev/null)
  if [ -n "$d" ]; then say "-- describe $fn @ $rg:"; echo "$d" | mask | tee -a "$OUT"; fi
done; done

say "===== (b) zalo-fn getConfig ====="
Z=$HOME/smartlead-zalo-fn/functions/index.js
blk "$Z" "async function getConfig|function getConfig|getConfig ?=" 30

say "===== (c) field thô record BrightData ====="
cd "$HOME/firebase-s13/functions" || { say 'KHONG VAO DUOC ~/firebase-s13/functions'; exit 1; }
cat > _b0_bd.mjs <<'EOM'
/* LỆNH B · KHỐI 0 (c) — in TÊN FIELD THÔ của record BrightData (bài + bình luận) để thiết kế B map num_comments / group id / comments lồng.
   CHỈ ĐỌC Firestore (pending_snapshots, sources, scans). Ngoại lệ: không có snapshot bài nào chín trong ~2′ → GIEO 1 snapshot 1 bài (≈1 record) — tắt bằng --no-trigger.
   Không in nội dung bài / tên người / link cá nhân (che), chỉ in TÊN field + kiểu + giá trị số/ngắn không nhạy cảm. */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: 'smartlead-z15' }); const db = getFirestore();
const NOTRIG = process.argv.includes('--no-trigger');
const TOKEN = process.env.BRIGHTDATA_TOKEN || '', DS = process.env.BRIGHTDATA_DATASET_ID || '';
const BD = 'https://api.brightdata.com/datasets/v3', H = { Authorization: 'Bearer ' + TOKEN };
const L = (...a) => console.log(...a); const sleep = ms => new Promise(r => setTimeout(r, ms));
const HIDE = /text|content|message|caption|description|title|bio|name|user|profile|author|avatar|image|photo|video|email|phone|address/i; // che GIÁ TRỊ (nội dung/danh tính), chỉ in tên field + độ dài
const SHOW = /comment|group|post_id|^id$|^url$|^post_url$|permalink|num_|count|likes|shares|reactions|date|time|type|kind|input|error|warning|timestamp|page|is_|has_/i;
function short(v) { v = String(v); return v.length > 110 ? v.slice(0, 110) + '…(' + v.length + ')' : v; }
function describe(rec, indent, depth) {
  const keys = Object.keys(rec || {}).sort(); L(indent + '· ' + keys.length + ' field: ' + keys.join(', '));
  for (const k of keys) {
    const v = rec[k]; const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    let out = indent + '  ' + k + ' : ' + t;
    if (t === 'number' || t === 'boolean' || t === 'null') out += ' = ' + v;
    else if (t === 'string') out += HIDE.test(k) ? ' (' + v.length + ' ký tự, che)' : (SHOW.test(k) ? ' = ' + short(v) : ' (' + v.length + ' ký tự)');
    else if (t === 'array') { out += '(' + v.length + ')'; const f = v[0]; if (f && typeof f === 'object' && !Array.isArray(f)) out += ' phần tử đầu: {' + Object.keys(f).sort().join(', ') + '}'; else if (f !== undefined) out += ' phần tử đầu: ' + (HIDE.test(k) ? '(che)' : short(JSON.stringify(f))); }
    else if (t === 'object') out += ' {' + Object.keys(v).sort().join(', ') + '}';
    L(out);
    if (t === 'array' && depth < 1 && v[0] && typeof v[0] === 'object' && !Array.isArray(v[0]) && /comment/i.test(k)) { L(indent + '  ↳ record con đầu tiên của ' + k + ':'); describe(v[0], indent + '    ', depth + 1); }
  }
  const cm = keys.filter(k => /comment/i.test(k)).map(k => k + '=' + (typeof rec[k] === 'object' ? (Array.isArray(rec[k]) ? 'array(' + rec[k].length + ')' : 'object') : (HIDE.test(k) ? '(che)' : short(rec[k]))));
  const gr = keys.filter(k => /group/i.test(k)).map(k => k + '=' + (HIDE.test(k) ? '(che)' : short(typeof rec[k] === 'object' ? JSON.stringify(rec[k]) : rec[k])));
  L(indent + 'TÓM: field liên quan BÌNH LUẬN → ' + (cm.length ? cm.join(' · ') : 'KHÔNG CÓ') + ' | liên quan GROUP → ' + (gr.length ? gr.join(' · ') : 'KHÔNG CÓ') + ' | id/url → ' + ['post_id', 'id', 'url', 'post_url'].filter(k => k in (rec || {})).map(k => k + '=' + short(rec[k])).join(' · '));
}
async function progress(id) { try { const r = await fetch(BD + '/progress/' + id, { headers: H }); const j = await r.json().catch(() => ({})); return { status: j.status || ('http' + r.status), records: j.records, errors: j.errors }; } catch (e) { return { status: 'err', msg: String(e && e.message || e) }; } }
async function fetchSnap(id) { const r = await fetch(BD + '/snapshot/' + id + '?format=json', { headers: H }); if (!r.ok) throw new Error('snapshot fetch ' + r.status + ' ' + (await r.text()).slice(0, 100)); const j = await r.json(); return Array.isArray(j) ? j : []; }
const good = rec => rec && typeof rec === 'object' && !rec.error && !rec.error_code && (rec.url || rec.post_id || rec.id || rec.comment_id || rec.comment_url);
async function tryOne(kind, p) {
  const st = await progress(p.snapshot_id); L('  ' + kind + ' ' + p.snapshot_id + ' → ' + st.status + (st.records != null ? ' · records ' + st.records : '') + (st.errors ? ' · errors ' + st.errors : '') + (st.msg ? ' · ' + st.msg : ''));
  if (st.status !== 'ready') return null;
  let recs = []; try { recs = await fetchSnap(p.snapshot_id); } catch (e) { L('    ✗ ' + e.message); return null; }
  const rec = recs.find(good); L('    ' + recs.length + ' record, dùng được ' + recs.filter(good).length + (recs[0] && !good(recs[0]) ? ' · record đầu: ' + short(JSON.stringify(recs[0]).replace(/"(input|url)":"[^"]*"/g, '"$1":"…"')) : ''));
  return rec || null;
}
if (!TOKEN) { L('✗ Thiếu BRIGHTDATA_TOKEN trong env (chạy qua .sh có set -a; . ./.env)'); process.exit(2); }
let postRec = null, cmtRec = null;
for (let round = 0; round < 8 && (!postRec || !cmtRec); round++) {
  const qs = await db.collection('pending_snapshots').get(); const posts = [], cmts = [];
  qs.docs.forEach(d => { const p = d.data() || {}; if (!p.snapshot_id) return; (p.kind === 'comments' ? cmts : posts).push(p); });
  L('[vòng ' + (round + 1) + '] pending: bài ' + posts.length + ' · bình luận ' + cmts.length);
  for (const p of posts.slice(0, 12)) { if (postRec) break; postRec = await tryOne('BÀI', p); }
  for (const p of cmts.slice(0, 6)) { if (cmtRec) break; cmtRec = await tryOne('BÌNH LUẬN', p); }
  if (!postRec || !cmtRec) await sleep(15000);
}
if (!postRec && !NOTRIG) {
  L('-- Không snapshot bài nào chín trong ~2′ → GIEO 1 snapshot 1 bài (≈1 record) để lấy field thô');
  const ss = await db.collection('sources').get(); const cand = []; ss.docs.forEach(d => { const s = d.data() || {}; if (s.active !== false && s.url && /facebook\.com\/groups\/\d+/.test(s.url)) cand.push(s); });
  const score = {}; try { const sc = await db.collection('scans').orderBy('at', 'desc').limit(6).select('bySource').get(); sc.docs.forEach(d => (d.data().bySource || []).forEach(r => { score[r.name] = (score[r.name] || 0) + (r.posts || 0); })); } catch (e) { L('  (scans: ' + e.message + ')'); }
  cand.sort((a, b) => (score[b.name] || 0) - (score[a.name] || 0));
  for (const src of cand.slice(0, 2)) {
    L('  gieo: ' + src.url + ' (bài gần đây ' + (score[src.name] || 0) + ')');
    let sid = ''; try { const r = await fetch(BD + '/trigger?dataset_id=' + DS + '&include_errors=true', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: JSON.stringify([{ url: src.url, num_of_posts: 1 }]) }); const j = await r.json().catch(() => ({})); if (!r.ok) { L('  ✗ trigger ' + r.status + ' ' + short(JSON.stringify(j))); continue; } sid = j.snapshot_id || ''; } catch (e) { L('  ✗ trigger: ' + e.message); continue; }
    if (!sid) { L('  ✗ không có snapshot_id'); continue; }
    L('  snapshot ' + sid + ' — chờ chín (tối đa 5′)…');
    for (let i = 0; i < 20 && !postRec; i++) { await sleep(15000); postRec = await tryOne('BÀI(gieo)', { snapshot_id: sid }); const st = await progress(sid); if (st.status === 'failed') break; if (st.status === 'ready' && !postRec) break; }
    if (postRec) break;
  }
}
L(''); L('===== RECORD BÀI (field thô) ====='); if (postRec) describe(postRec, '', 0); else L('KHÔNG lấy được record bài' + (NOTRIG ? ' (đã tắt gieo)' : ''));
L(''); L('===== RECORD BÌNH LUẬN (field thô) ====='); if (cmtRec) describe(cmtRec, '', 0); else L('KHÔNG có snapshot bình luận nào chín trong lúc chạy (chạy lại ban ngày hoặc bỏ qua — chỉ cần cho hoàn thiện normalizeComment)');
L(''); L('== XONG (c) ==');
EOM
node --check _b0_bd.mjs && ( set -a; . ./.env; set +a; node _b0_bd.mjs ${B0_NO_TRIGGER:+--no-trigger} ) 2>&1 | mask | tee -a "$OUT"; rc=${PIPESTATUS[0]}; if [ "$rc" -ne 0 ]; then say "✗ (c) node thoát mã $rc — đọc lỗi phía trên"; fi
say "== XONG — cloudshell download $OUT  (rồi upload file vào chat) =="
