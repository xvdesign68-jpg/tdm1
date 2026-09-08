#!/usr/bin/env bash
# LỆNH #41 (09/09/2026) — bộ đếm "lead mới" (daily_stats.new/hot/warm/cold/junk) KHÔNG tăng từ sau 04/09: chẩn đoán + vá statsOnLead + đếm lại 60 ngày.
# Cách chạy trong Cloud Shell:  cd ~/firebase-s13/functions && bash /tmp/l41.sh   (dán file này thành /tmp/l41.sh bằng heredoc quoted, xem docs/lenh-2026-09-09-41.md)
# Idempotent · fail-closed · deploy xích && · không in secret. Cần: _l41_stats.cjs + _l41_recount.mjs đã đặt trong ~/firebase-s13/functions (KHỐI 0 của .md).
set -euo pipefail
cd ~/firebase-s13/functions
TS=$(date +%Y%m%d-%H%M%S)
echo "=== (a) kiểm file ==="
test -f stats.js || { echo "THIEU stats.js — LỆNH #17 chưa chạy?"; exit 1; }
test -f _l41_stats.cjs && test -f _l41_recount.mjs || { echo "THIEU _l41_*.{cjs,mjs} — dán KHỐI 0 trước"; exit 1; }
grep -q "LENH #40" stats.js || { echo "stats.js chưa qua LỆNH #40 — chạy LỆNH #40 trước"; exit 1; }
node --check _l41_stats.cjs && node --check _l41_recount.mjs && echo "SYNTAX OK (script)"
echo "=== (b) chẩn đoán: log lỗi statsOnLead 3 ngày (rỗng = không lỗi) ==="
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="statsonlead" AND severity>=ERROR' --limit=10 --freshness=3d --format='value(timestamp,textPayload,jsonPayload.message)' 2>/dev/null | cut -c1-240 || true
echo "--- số lượt statsOnLead 24h (mọi mức) ---"
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="statsonlead" AND httpRequest.requestMethod="POST"' --limit=1000 --freshness=1d --format='value(httpRequest.status)' 2>/dev/null | sort | uniq -c || true
echo "=== (c) patch stats.js (content-anchored, idempotent) + cú pháp + import test ==="
grep -q "LENH #41" stats.js || cp stats.js stats.js.bak-$TS
node _l41_stats.cjs stats.js
node --check stats.js && echo "SYNTAX OK"
grep -n "LENH #41" stats.js | cut -c1-80
set -a; . ./.env; set +a
node --input-type=module -e "
const m=await import('./stats.js'); const D=Date.parse('2026-09-08T01:00:00Z'); const inc=ev=>Object.assign({},...ev.filter(e=>e.day==='2026-09-08').map(e=>e.inc));
const a=inc(m.statsEvents(null,{brand:'x',score:85,detected_at:D},Date.now()));
const b=inc(m.statsEvents({brand:'x'},{brand:'x',score:85,detected_at:D},Date.now()));
const c=inc(m.statsEvents({brand:'x',score:85},{brand:'x',score:85,stage:'inbox',detected_at:D},Date.now()));
const d=m.statsEvents(null,{brand:'x',detected_at:D},Date.now());
const e=inc(m.statsEvents({},{brand:'x',score:20,detected_at:D},Date.now()));
const f=inc(m.statsEvents({score:85},{brand:'x',score:85,detected_at:D},Date.now()));
const ok=(a.new===1&&a.hot===1)&&(b.new===1&&b.hot===1)&&(c.new==null&&c.hot==null)&&(d.length===0)&&(e.junk===1&&e.new==null)&&(f.new===1);
if(ok===false){ console.error('LOGIC FAIL', JSON.stringify({a,b,c,d,e,f})); process.exit(1); }
const m2=await import('./index.js'); console.log('IMPORT OK · statsOnLead =', typeof m2.statsOnLead, '· new đếm đúng: tạo 1 bước ✓ · tạo rồi chấm điểm sau ✓ · tạo rồi gán brand sau ✓ · update thường không đếm ✓ · chưa có điểm không tính junk ✓');"
echo "=== (d) deploy statsOnLead (asia-southeast1) ==="
cd ~/firebase-s13 && firebase deploy --only functions:statsOnLead --force && cd ~/firebase-s13/functions
gcloud functions describe statsOnLead --region=asia-southeast1 --gen2 --format='value(state,eventTrigger.eventType,updateTime)'
echo "=== (e) chẩn đoán + đếm lại 60 ngày: DRY trước ==="
node _l41_recount.mjs --dry --days=60
echo "=== (f) đếm lại THẬT ==="
node _l41_recount.mjs --days=60
echo "=== (g) kiểm: doc daily_stats mới nhất ==="
node --input-type=module -e "
import { initializeApp } from 'firebase-admin/app'; import { getFirestore } from 'firebase-admin/firestore'; initializeApp(); const db=getFirestore();
const s=await db.collection('daily_stats').orderBy('day','desc').limit(12).get(); s.forEach(d=>{ const x=d.data(); console.log(' ', d.id, 'new', x.new||0, 'hot', x.hot||0, 'junk', x.junk||0, '| slaN', x.slaN||0, 'slaOk', x.slaOk||0, '| scanned', x.scanned||0); });"
echo "=== XONG LỆNH #41 — F5 web: Bảng điều khiển 'Lead hợp lệ / Lead nóng' 14 ngày và Bảng brand 'Lead 7 ngày' lên số đúng; từ giờ lead mới tự cộng ==="
