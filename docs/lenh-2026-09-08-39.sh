#!/usr/bin/env bash
# LỆNH #39 (08/09/2026) — counter "bài đã quét" THEO BRAND cho user brand: CF scanStatsOnRun (scans/{id} → daily_stats/{brand}__{ngàyVN}.scanned) + backfill.
# Cách chạy trong Cloud Shell:  cd ~/firebase-s13/functions && bash /tmp/l39.sh   (dán file này thành /tmp/l39.sh bằng heredoc quoted, xem docs/lenh-2026-09-08-39.md)
# Idempotent · fail-closed · deploy xích && · không in secret. Cần: scanstats.js + _scanstats_backfill.mjs đã đặt trong ~/firebase-s13/functions (KHỐI 0 của .md).
set -euo pipefail
cd ~/firebase-s13/functions
TS=$(date +%Y%m%d-%H%M%S)
echo "=== (a) kiểm file + cú pháp ==="
test -f scanstats.js && test -f _scanstats_backfill.mjs || { echo "THIEU scanstats.js / _scanstats_backfill.mjs — dán KHỐI 0 trước"; exit 1; }
node --check scanstats.js && node --check _scanstats_backfill.mjs && echo "SYNTAX OK"
echo "=== (b) nối index.js (idempotent) + import test ==="
grep -q "from './scanstats.js'" index.js || { cp index.js index.js.bak-$TS; echo "export * from './scanstats.js'; // v119-78: counter bài đã quét theo brand (daily_stats.scanned)" >> index.js; echo "đã nối export scanstats.js"; }
set -a; . ./.env; set +a
node --input-type=module -e "const m=await import('./index.js'); console.log('IMPORT OK · scanStatsOnRun =', typeof m.scanStatsOnRun, '· scheduledScan =', typeof m.scheduledScan)"
echo "=== (c) deploy scanStatsOnRun (asia-southeast1) ==="
cd ~/firebase-s13 && firebase deploy --only functions:scanStatsOnRun --force && cd ~/firebase-s13/functions
DEPLOYED=$(gcloud functions describe scanStatsOnRun --region=asia-southeast1 --gen2 --format='value(updateTime)' 2>/dev/null || true)
gcloud functions describe scanStatsOnRun --region=asia-southeast1 --gen2 --format='value(state,eventTrigger.eventType,updateTime)'
echo "=== (d) backfill từ nhật ký scans: DRY trước ==="
node _scanstats_backfill.mjs --dry --from=2026-08-01 --deployed="$DEPLOYED"
echo "=== (e) backfill THẬT (ngày < hôm nay ghi tuyệt đối; hôm nay chỉ cộng lượt trước mốc deploy) ==="
node _scanstats_backfill.mjs --from=2026-08-01 --deployed="$DEPLOYED"
echo "=== (f) kiểm: 5 doc daily_stats mới nhất có scanned ==="
node --input-type=module -e "
import { initializeApp } from 'firebase-admin/app'; import { getFirestore } from 'firebase-admin/firestore'; initializeApp(); const db=getFirestore();
const s=await db.collection('daily_stats').orderBy('day','desc').limit(12).get(); let n=0; s.forEach(d=>{ const x=d.data(); if(x.scanned!=null){ n++; console.log(' ', d.id, 'scanned', x.scanned, 'cmt', x.scannedComments||0, 'runs', x.scanRuns||0, '| new', x.new||0, 'hot', x.hot||0); } });
console.log('doc có scanned trong 12 doc mới nhất:', n);"
echo "=== XONG LỆNH #39 — deploy zip v119-78 rồi đăng nhập tài khoản brand → Bảng điều khiển ô 1 = 'Bài đã quét' (14 ngày) · Lead mới: thanh nhịp quét có 'Bài đã quét hôm nay' ==="
