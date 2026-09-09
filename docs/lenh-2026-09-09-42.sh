#!/usr/bin/env bash
# LỆNH #42 (09/09/2026) — bộ đếm daily_stats KHÔNG tính người bán/chủ bài là lead hợp lệ: vá statsOnLead + đếm lại 60 ngày. Chạy: cd ~/firebase-s13/functions && bash /tmp/l42.sh
# Idempotent · fail-closed · deploy xích && · không in secret. Cần: _l42_stats.cjs + _l42_recount.mjs đã đặt trong ~/firebase-s13/functions (KHỐI 0).
set -euo pipefail
cd ~/firebase-s13/functions
TS=$(date +%Y%m%d-%H%M%S)
echo "=== (a) kiểm file ==="
test -f stats.js || { echo "THIEU stats.js"; exit 1; }
test -f _l42_stats.cjs && test -f _l42_recount.mjs || { echo "THIEU _l42_*.{cjs,mjs} — dán KHỐI 0 trước"; exit 1; }
grep -q "LENH #41" stats.js || { echo "stats.js chưa qua LỆNH #41 — chạy LỆNH #41 trước"; exit 1; }
node --check _l42_stats.cjs && node --check _l42_recount.mjs && echo "SYNTAX OK (script)"
echo "=== (b) patch stats.js + cú pháp + import test ==="
grep -q "LENH #42" stats.js || cp stats.js stats.js.bak-$TS
node _l42_stats.cjs stats.js
node --check stats.js && echo "SYNTAX OK"
grep -n "LENH #42" stats.js | cut -c1-80
set -a; . ./.env; set +a
node --input-type=module -e "
const m=await import('./stats.js'); const D=Date.parse('2026-09-08T01:00:00Z'); const inc=ev=>Object.assign({},...ev.filter(e=>e.day==='2026-09-08').map(e=>e.inc));
const a=inc(m.statsEvents(null,{brand:'x',score:85,detected_at:D},Date.now()));
const b=m.statsEvents(null,{brand:'x',score:85,detected_at:D,role:'seller'},Date.now());
const c=inc(m.statsEvents({brand:'x',score:85,detected_at:D},{brand:'x',score:85,detected_at:D,role:'poster_self',dropped:true},Date.now()));
const d=inc(m.statsEvents({brand:'x',score:62,detected_at:D,self_comment:true},{brand:'x',score:62,detected_at:D,self_comment:false},Date.now()));
const e=inc(m.statsEvents({brand:'x',score:85,detected_at:D},{brand:'x',score:85,detected_at:D,stage:'inbox'},Date.now()));
const ok=(a.new===1&&a.hot===1)&&(b.length===0)&&(c.new===-1&&c.hot===-1)&&(d.new===1&&d.warm===1)&&(e.new==null&&e.hot==null);
if(ok===false){ console.error('LOGIC FAIL', JSON.stringify({a,b,c,d,e})); process.exit(1); }
const m2=await import('./index.js'); console.log('IMPORT OK · statsOnLead =', typeof m2.statsOnLead, '· người bán không đếm ✓ · gắn vai sau khi đếm → trừ lại ✓ · gỡ vai → cộng lại ✓ · update thường không đếm ✓');"
echo "=== (c) deploy statsOnLead (asia-southeast1) ==="
cd ~/firebase-s13 && firebase deploy --only functions:statsOnLead --force && cd ~/firebase-s13/functions
gcloud functions describe statsOnLead --region=asia-southeast1 --gen2 --format='value(state,updateTime)'
echo "=== (d) đếm lại 60 ngày: DRY ==="
node _l42_recount.mjs --dry --days=60
echo "=== (e) đếm lại THẬT ==="
node _l42_recount.mjs --days=60
echo "=== (f) kiểm: số 4 ô KPI sau đếm lại ==="
if test -f _l41_kpi14.mjs; then node _l41_kpi14.mjs; else echo "(không có _l41_kpi14.mjs — bỏ qua)"; fi
echo "=== XONG LỆNH #42 — F5 web: ô Lead hợp lệ/Lead nóng không còn tính người bán/chủ bài ==="
