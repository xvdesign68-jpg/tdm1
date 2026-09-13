#!/usr/bin/env bash
# LỆNH C · bước (e) BỔ SUNG (13/09/2026) — deploy lại `notifyBrandZalo` (~/smartlead-zalo-fn) sau khi KHỐI 1 báo
#   "Error: No function matches given --only filters. Aborting deployment." (Firebase CLI không thấy function trong codebase zalo-fn).
# Mã ĐÃ VÁ ở KHỐI 1 (marker LENH C, node --check OK) — chỉ còn deploy. Function đang chạy vẫn là bản CŨ
#   (ZBS vẫn bắn cho sales khi lead đã loại / điểm tạm / người bán) tới khi bước này xong.
# Làm gì: (1) chẩn đoán zalo-fn: firebase.json / .firebaserc / package.json, export thật của index.js, marker, describe TRƯỚC
#   (chỉ in TÊN biến env/secret, KHÔNG in giá trị); (2) deploy A = Firebase CLI với ĐÚNG codebase đọc từ firebase.json;
#   lỗi → deploy B = `gcloud functions deploy` từ source (CẬP NHẬT function có sẵn: trigger/env/secrets/SA/maxInstances GIỮ NGUYÊN
#   vì không truyền cờ nào ngoài source/runtime/entry-point — cùng cách đã dùng cho tagLeadBrand ở LỆNH B bước (e));
#   (3) describe SAU: updateTime phải đổi, state ACTIVE, secret keys vẫn còn ZALO_APP_ID + ZALO_SECRET_KEY.
# KHÔNG deploy trùm zalo-fn (đúng 1 function). KHÔNG đụng ~/codebase2. Không in secret. Lỗi ở đâu → function cũ vẫn chạy, không hỏng gì.
set -u
D="$HOME/smartlead-zalo-fn"; FD="$D/functions"; F="$FD/index.js"
FN=notifyBrandZalo; REG=asia-southeast1; LOG=/tmp/lc_e_deploy.log
cat > /tmp/lc_e_desc.js <<'EOF_DESC'
let s = ''; process.stdin.on('data', d => s += d).on('end', () => {
  if (s.trim() === '') { console.log('  (describe rỗng — function không tồn tại hoặc gcloud lỗi)'); return; }
  let j; try { j = JSON.parse(s); } catch (e) { console.log('  (describe không phải JSON)'); return; }
  const sc = j.serviceConfig || {}, bc = j.buildConfig || {}, et = j.eventTrigger || {}, lb = j.labels || {};
  const env = Object.keys(sc.environmentVariables || {}).sort(), sec = (sc.secretEnvironmentVariables || []).map(x => x.key).sort();
  const filt = (et.eventFilters || []).map(f => f.attribute + '=' + f.value).join(' ');
  console.log('  state=' + j.state + ' · updateTime=' + j.updateTime + ' · runtime=' + bc.runtime + ' · entryPoint=' + bc.entryPoint + ' · revision=' + (sc.revision || '?'));
  console.log('  trigger=' + et.eventType + ' [' + filt + '] · maxInstances=' + sc.maxInstanceCount + ' · timeout=' + sc.timeoutSeconds + ' · tool=' + (lb['deployment-tool'] || '?') + ' · codebaseLabel=' + (lb['firebase-functions-codebase'] || '-'));
  console.log('  env keys=' + (env.length ? env.join(',') : '(0)') + ' · secret keys=' + (sec.length ? sec.join(',') : '(0)'));
});
EOF_DESC
desc() { gcloud functions describe "$FN" --region "$REG" --gen2 --format=json 2>/dev/null | node /tmp/lc_e_desc.js; }
ut() { gcloud functions describe "$FN" --region "$REG" --gen2 --format='value(updateTime)' 2>/dev/null; }

echo "=== (1) hiện trạng zalo-fn ==="
[ -f "$F" ] || { echo "KHÔNG THẤY $F — dừng (gửi em đường dẫn zalo-fn)"; exit 1; }
ls -la "$D" | head -30
echo "--- firebase.json:"; if [ -f "$D/firebase.json" ]; then cat "$D/firebase.json"; else echo "(không có firebase.json)"; fi
echo; echo "--- .firebaserc:"; if [ -f "$D/.firebaserc" ]; then cat "$D/.firebaserc"; else echo "(không có .firebaserc)"; fi
echo; echo "--- functions/package.json (name/main/engines/deps):"
node -e 'const p=require(process.argv[1]);console.log(JSON.stringify({name:p.name,main:p.main,engines:p.engines,deps:Object.keys(p.dependencies||{})}))' "$FD/package.json" 2>/dev/null || echo "(không đọc được package.json)"
if [ -d "$FD/node_modules" ]; then echo "node_modules: có"; else echo "node_modules: KHÔNG (Firebase CLI discovery sẽ lỗi — nhánh gcloud không cần)"; fi
N=$(grep -c "LENH C" "$F" || true); echo "--- marker LENH C trong index.js: $N (kỳ vọng 2)"
if [ "$N" = "0" ]; then
  echo "chưa vá → vá ngay bằng _lc_zbs.cjs (KHỐI 1 đã tạo)"
  cp "$F" "$F.bak-$(date +%Y%m%d-%H%M%S)" && node "$HOME/firebase-s13/functions/_lc_zbs.cjs" "$F" || { echo "VÁ LỖI — dừng"; exit 1; }
fi
node --check "$F" && echo "SYNTAX OK" || { echo "SYNTAX LỖI — dừng (quay lui: cp $F.bak-<TS> $F)"; exit 1; }
grep -n "LENH C" "$F" | cut -c1-160
echo "--- export thật của index.js (chỉ nạp module, không chạy function):"
( cd "$FD" && timeout 60 node -e 'process.env.FUNCTIONS_EMULATOR="true";process.env.GCLOUD_PROJECT="smartlead-z15";const m=require("./index.js");console.log("exports: "+Object.keys(m).join(", "))' ) 2>&1 | tail -3
echo "--- describe TRƯỚC:"; desc; UT0=$(ut)

echo "=== (2) xác định codebase Firebase CLI (từ firebase.json) ==="
CB=$(node -e '
const fs=require("fs"),path=require("path"); const d=process.argv[1]; let j={};
try { j=JSON.parse(fs.readFileSync(path.join(d,"firebase.json"),"utf8")); } catch(e){ console.error("firebase.json không đọc được: "+e.message); process.exit(0); }
const fx=j.functions; if (fx===undefined || fx===null){ console.error("firebase.json KHÔNG có mục functions → Firebase CLI không có gì để deploy"); process.exit(0); }
const arr=Array.isArray(fx)?fx:[fx]; const rows=arr.map(x=>({source:(x&&x.source)||"functions",codebase:(x&&x.codebase)||"default"}));
console.error("mục functions: "+JSON.stringify(rows));
const hit=rows.find(r=>{ try { return /exports\.notifyBrandZalo/.test(fs.readFileSync(path.join(d,r.source,"index.js"),"utf8")); } catch(e){ return false; } });
if (hit===undefined){ console.error("KHÔNG mục functions nào có source chứa exports.notifyBrandZalo → đó là lý do KHỐI 1 báo \"No function matches\" — đi nhánh gcloud"); process.exit(0); }
console.error("→ notifyBrandZalo thuộc source="+hit.source+" · codebase="+hit.codebase); process.stdout.write(hit.codebase);
' "$D")
echo "codebase dùng để deploy: '${CB:-}'"

echo "=== (3) deploy A — Firebase CLI đúng codebase ==="
RC=1
if [ -n "${CB:-}" ]; then
  if [ "$CB" = "default" ]; then SEL="functions:$FN"; else SEL="functions:$CB:$FN"; fi
  echo "( cd $D && firebase deploy --only $SEL --non-interactive )"
  ( cd "$D" && firebase deploy --only "$SEL" --non-interactive ) > "$LOG" 2>&1; RC=$?
  tail -12 "$LOG"
  if [ "$RC" = "0" ] && grep -q "Deploy complete" "$LOG"; then echo "deploy A OK"; else RC=1; echo "deploy A LỖI (xem $LOG) → sang nhánh gcloud"; fi
else
  echo "bỏ qua deploy A (Firebase CLI không thấy function) → nhánh gcloud"
fi

if [ "$RC" = "0" ]; then echo "(bỏ qua nhánh gcloud — deploy A đã OK)"; else
  echo "=== (3b) deploy B — gcloud functions deploy từ source (cập nhật function có sẵn; giữ trigger/env/secrets/SA/maxInstances) ==="
  echo "gcloud functions deploy $FN --gen2 --region=$REG --runtime=nodejs22 --entry-point=$FN --source=$FD --quiet"
  gcloud functions deploy "$FN" --gen2 --region="$REG" --runtime=nodejs22 --entry-point="$FN" --source="$FD" --quiet > "$LOG.b" 2>&1; RC=$?
  tail -8 "$LOG.b"
fi

echo "=== (4) describe SAU (updateTime phải MỚI hơn TRƯỚC, state ACTIVE, secret keys còn ZALO_APP_ID,ZALO_SECRET_KEY) ==="
desc; UT1=$(ut)
if [ -n "${UT0:-}" ] && [ "$UT0" = "${UT1:-}" ]; then echo "updateTime KHÔNG đổi ($UT0) — function chưa được cập nhật"; RC=1; else echo "updateTime đổi: $UT0 → ${UT1:-?}"; fi
if [ "$RC" = "0" ]; then echo "DEPLOY $FN OK (rc=0) — bước (e) LỆNH C xong; KHỐI 2 mục 7 sẽ thấy updateTime mới"; else echo "DEPLOY $FN LỖI rc=$RC — dán cho em 30 dòng cuối $LOG (và $LOG.b nếu có); function cũ vẫn chạy, không hỏng gì"; fi
exit "$RC"
