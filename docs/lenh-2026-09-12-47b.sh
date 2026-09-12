# LỆNH #47b (12/09/2026) — CHỈ ĐỌC, bổ sung cho #47: lib/alerts là THƯ MỤC (dispatch từ lib/alerts/index.js) nên dumpf lib/alerts.js báo KHONG CO;
# thêm scanstats.js/cfgpriv.js/lib/needsynth.js (trigger đang chạy trên leads) + điều kiện trigger Gateway ZBS ở ~/smartlead-zalo-fn (justTagged/brand_pending).
set -u
cd ~/firebase-s13/functions || { echo 'KHONG VAO DUOC ~/firebase-s13/functions'; exit 1; }
OUT=~/scan-dump-0912b.txt; : > "$OUT"
mask() { sed -E "s/(['\"\`])[A-Za-z0-9_./:+=-]{28,}\1/\1<che>\1/g; s/\b[0-9]{1,3}(\.[0-9]{1,3}){3}\b/<ip>/g; s/sk-[A-Za-z0-9_-]{6,}/sk-…/g"; }
say() { echo "$@" | tee -a "$OUT"; }
say "== LỆNH #47b · $(date -u +%Y-%m-%dT%H:%MZ) =="; say "-- lib/alerts/:"; ls -la lib/alerts | tee -a "$OUT"
for f in lib/alerts/*.js scanstats.js cfgpriv.js lib/needsynth.js; do [ -f "$f" ] || { say "----- $f: KHONG CO -----"; continue; }; say "----- FILE $f ($(wc -l < "$f") dòng) -----"; nl -ba "$f" | mask | tee -a "$OUT" >/dev/null; done
say "-- index.js onLeadCreated + synthNeedsOnUpdate:"; for re in "export const onLeadCreated" "export const synthNeedsOnUpdate" "export const cleanupScannedPosts"; do s=$(grep -n "$re" index.js | head -1 | cut -d: -f1); [ -z "$s" ] && { say "--- KHONG THAY $re"; continue; }; say "--- $re từ dòng $s ---"; sed -n "${s},$((s+30))p" index.js | nl -ba -v "$s" | mask | tee -a "$OUT" >/dev/null; done
say "-- Gateway ZBS (~/smartlead-zalo-fn): file có justTagged/brand_tagged/brand_pending/zalo_notified:"
Z=~/smartlead-zalo-fn; if [ -d "$Z" ]; then grep -rlE "justTagged|brand_tagged|brand_pending|zalo_notified" "$Z" --include=*.js 2>/dev/null | grep -v node_modules | head -6 | tee -a "$OUT" | while read -r f; do say "----- FILE $f ($(wc -l < "$f") dòng) — 60 dòng quanh mốc đầu -----"; s=$(grep -nE "justTagged|brand_tagged|brand_pending|zalo_notified" "$f" | head -1 | cut -d: -f1); a=$((s>25?s-25:1)); sed -n "${a},$((a+60))p" "$f" | nl -ba -v "$a" | mask | tee -a "$OUT" >/dev/null; done; grep -rnE "onDocument(Created|Updated|Written)\(" "$Z" --include=*.js 2>/dev/null | grep -v node_modules | cut -c1-160 | mask | tee -a "$OUT"; else say "(không có thư mục ~/smartlead-zalo-fn)"; fi
echo; echo "XONG → cloudshell download $OUT  (upload cùng ~/scan-dump-0912.txt)"
