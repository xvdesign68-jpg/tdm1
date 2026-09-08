#!/usr/bin/env bash
# LỆNH #40 (08/09/2026) — (1) statsOnLead: SLA đạt theo NGƯỠNG RIÊNG BRAND + cohort NGÀY PHÁT HIỆN (daily_stats.slaN/slaOk) + backfill 60 ngày;
#                          (2) Rules: thêm 'stage_log' vào whitelist field leads (FE v119-80 ghi lịch sử giai đoạn cho Dòng thời gian 360°).
# Cách chạy trong Cloud Shell:  cd ~/firebase-s13/functions && bash /tmp/l40.sh   (dán file này thành /tmp/l40.sh bằng heredoc quoted, xem docs/lenh-2026-09-08-40.md)
# Idempotent · fail-closed · deploy xích && · không in secret. Cần: _l40_stats.cjs + _l40_rules.cjs + _l40_backfill.mjs đã đặt trong ~/firebase-s13/functions (KHỐI 0 của .md).
set -euo pipefail
cd ~/firebase-s13/functions
TS=$(date +%Y%m%d-%H%M%S)
echo "=== (a) kiểm file ==="
test -f stats.js || { echo "THIEU stats.js — LỆNH #17 chưa chạy?"; exit 1; }
test -f _l40_stats.cjs && test -f _l40_rules.cjs && test -f _l40_backfill.mjs || { echo "THIEU _l40_*.{cjs,mjs} — dán KHỐI 0 trước"; exit 1; }
grep -q "LENH #40" stats.js || cp stats.js stats.js.bak-$TS
echo "=== (b) patch stats.js (content-anchored, idempotent) + cú pháp + import test ==="
node _l40_stats.cjs stats.js
node --check stats.js && node --check _l40_backfill.mjs && echo "SYNTAX OK"
grep -n "LENH #40" stats.js | cut -c1-80
set -a; . ./.env; set +a
node --input-type=module -e "
const m=await import('./stats.js'); const bad=45;
const ev=m.statsEvents({first_care_at:null,stage:'new'},{brand:'x',temp:'hot',detected_at:Date.parse('2026-09-08T01:00:00Z'),first_care_at:Date.parse('2026-09-08T01:40:00Z'),stage:'new'},Date.now(),{slaBad:bad});
const d=ev.filter(e=>e.day==='2026-09-08'); const inc=Object.assign({},...d.map(e=>e.inc));
const okA=(typeof m.slaInc==='function' && typeof m.slaBadOf==='function' && inc.slaN===1 && inc.slaOk===1 && inc.careN===1); if(okA===false) { console.error('IMPORT/LOGIC FAIL', JSON.stringify(ev)); process.exit(1); }
const ev2=m.statsEvents({first_care_at:null},{brand:'x',temp:'hot',detected_at:Date.parse('2026-09-07T20:00:00Z'),first_care_at:Date.parse('2026-09-08T01:00:00Z')},Date.now(),{slaBad:60});
const sl=ev2.find(e=>e.inc.slaN); const okB=(sl && sl.day==='2026-09-08' && sl.inc.slaN===1 && sl.inc.slaOk==null); if(okB===false||okB==null) { console.error('COHORT FAIL', JSON.stringify(ev2)); process.exit(1); }
const m2=await import('./index.js'); console.log('IMPORT OK · statsOnLead =', typeof m2.statsOnLead, '· slaN/slaOk theo ngày phát hiện ✓ (ngưỡng 45′: 40′ đạt; ngưỡng 60′: 300′ không đạt)');"
echo "=== (c) Rules: + 'stage_log' vào whitelist leads (idempotent) ==="
cd ~/firebase-s13
grep -q "'stage_log'" firestore.rules || cp firestore.rules firestore.rules.bak-$TS
node functions/_l40_rules.cjs firestore.rules
grep -c "'stage_log'" firestore.rules
echo "=== (d) deploy statsOnLead + Rules (asia-southeast1) ==="
firebase deploy --only functions:statsOnLead --force && firebase deploy --only firestore:rules && cd ~/firebase-s13/functions
gcloud functions describe statsOnLead --region=asia-southeast1 --gen2 --format='value(state,eventTrigger.eventType,updateTime)'
echo "=== (e) backfill slaN/slaOk 60 ngày: DRY trước ==="
node _l40_backfill.mjs --dry --days=60
echo "=== (f) backfill THẬT ==="
node _l40_backfill.mjs --days=60
echo "=== (g) kiểm: doc daily_stats mới nhất có slaN/slaOk ==="
node --input-type=module -e "
import { initializeApp } from 'firebase-admin/app'; import { getFirestore } from 'firebase-admin/firestore'; initializeApp(); const db=getFirestore();
const s=await db.collection('daily_stats').orderBy('day','desc').limit(15).get(); let n=0; s.forEach(d=>{ const x=d.data(); if(x.slaN==null) return; n++; console.log(' ', d.id, 'new', x.new||0, 'slaN', x.slaN, 'slaOk', x.slaOk, '| careLe60', x.careLe60||0); });
console.log('doc có slaN trong 15 doc mới nhất:', n);"
echo "=== XONG LỆNH #40 — deploy zip v119-80: Bảng brand cột 'SLA đạt' dùng đúng ngưỡng riêng brand (tooltip ≤N′ = ngưỡng brand); đổi giai đoạn lead → Dòng thời gian 360° hiện đủ hành trình ==="
