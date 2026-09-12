# LỆNH #47d (12/09/2026) — CHỈ ĐỌC, NHỎ. Dump nốt các đoạn mã cần làm MỐC cho patch A/B/C mà #47 chưa in đủ (bị cắt 150 ký tự hoặc ngoài khoảng):
#   index.js 148–211 (helper) + 762–870 (sweeper #46 phần còn lại · giám sát [LLM-DOWN] · ghi doc scans · return) · lib/scorer.js 1–56 (SYS/PRE_SYS) + 117–187 (llmChat46 · heuristic · weightsHint)
#   · lib/scraper.js 1–60 (normalizePost — cần biết BrightData có num_comments không) · lib/config.js toàn bộ (che) · lib/zaloCheck.js 1–40 · lib/logger.js
#   · zalo-fn: notifyBrandZalo trọn + getBrandSales + tagLeadBrand (ở codebase nào?) · package.json/firebase.json. Output: màn hình + ~/scan-dump-0912d.txt
set -u
cd ~/firebase-s13/functions || { echo 'KHONG VAO DUOC ~/firebase-s13/functions'; exit 1; }
OUT=~/scan-dump-0912d.txt; : > "$OUT"
mask() { sed -E "s/(['\"\`])[A-Za-z0-9_./:+=-]{28,}\1/\1<che>\1/g; s/\b[0-9]{1,3}(\.[0-9]{1,3}){3}\b/<ip>/g; s/sk-[A-Za-z0-9_-]{6,}/sk-…/g"; }
say() { echo "$@" | tee -a "$OUT"; }
rng() { local f="$1" a="$2" b="$3"; say "----- $f dòng $a–$b -----"; sed -n "${a},${b}p" "$f" | nl -ba -v "$a" | mask | tee -a "$OUT"; }
dumpf() { local f="$1"; if [ -f "$f" ]; then say "----- FILE $f ($(wc -l < "$f") dòng) -----"; nl -ba "$f" | mask | tee -a "$OUT"; else say "----- FILE $f: KHONG CO -----"; fi; }
blk() { local f="$1" re="$2" n="${3:-60}"; local s; s=$(grep -nE "$re" "$f" 2>/dev/null | head -1 | cut -d: -f1); if [ -z "$s" ]; then say "--- $f :: KHONG THAY MOC /$re/"; return; fi; say "--- $f :: /$re/ từ dòng $s ($n dòng) ---"; sed -n "${s},$((s+n-1))p" "$f" | nl -ba -v "$s" | mask | tee -a "$OUT"; }
say "== LỆNH #47d · $(date -u +%Y-%m-%dT%H:%MZ) =="
say "-- sha8 để đối chiếu mốc patch: $(for f in index.js lib/scorer.js lib/scraper.js lib/config.js stats.js push.js outreach.js; do printf '%s=%s ' "$f" "$(sha256sum "$f" | cut -c1-8)"; done)"
rng index.js 148 211
rng index.js 762 870
rng lib/scorer.js 1 56
rng lib/scorer.js 117 187
rng lib/scraper.js 1 60
dumpf lib/config.js
rng lib/zaloCheck.js 1 40
dumpf lib/logger.js
say "-- tagLeadBrand nằm ở file nào (3 codebase):"; grep -ln "tagLeadBrand" ~/firebase-s13/functions/*.js ~/smartlead-zalo-fn/functions/*.js 2>/dev/null | tee -a "$OUT"; grep -rln "tagLeadBrand" ~/codebase2 --include=*.js 2>/dev/null | grep -v node_modules | head -5 | tee -a "$OUT"
Z=~/smartlead-zalo-fn/functions/index.js
blk "$Z" "exports\.notifyBrandZalo" 75
blk "$Z" "function getBrandSales|getBrandSales ?=" 30
blk "$Z" "function buildTemplateData|buildTemplateData ?=" 20
blk "$Z" "exports\.tagLeadBrand|tagLeadBrand ?=" 60
say "-- package.json (engines/type/deps):"; node -e "const p=require('./package.json');console.log(JSON.stringify({engines:p.engines,type:p.type,deps:Object.keys(p.dependencies||{}),scripts:Object.keys(p.scripts||{})}))" | tee -a "$OUT"
say "-- firebase.json:"; mask < ../firebase.json | tee -a "$OUT"
say "== XONG — file: $OUT (dán nguyên output hoặc cloudshell download $OUT) =="
