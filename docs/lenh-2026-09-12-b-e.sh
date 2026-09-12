#!/usr/bin/env bash
# LỆNH B · bước (e) BỔ SUNG (12/09/2026) — deploy lại `tagLeadBrand` (codebase2) sau khi KHỐI 1 báo
#   "Not in a Firebase app directory (could not locate firebase.json)" ở ~/codebase2.
# Vì sao: tagLeadBrand đang chạy được deploy bằng gcloud từ ~/codebase2/tagLeadBrand (describe: maxInstanceCount 100
#   dù code setGlobalOptions 10; trigger không có filter namespace như bản Firebase CLI) → không có firebase.json là bình thường.
# Làm gì: (1) kiểm marker LENH B đã vá + node --check; (2) có firebase.json trong thư mục function → firebase deploy --only;
#   không có → gcloud functions deploy từ source (CẬP NHẬT function có sẵn: trigger/env/service account/maxInstances GIỮ NGUYÊN
#   vì không truyền cờ nào khác ngoài source/runtime/entry-point); (3) describe SAU — updateTime phải đổi, state ACTIVE.
# KHÔNG deploy trùm codebase2 (bản cũ manualScan/approveEngagement/syncLeadToSheet ở đó sẽ đè s13). Chỉ đúng 1 function.
set -u
D="$HOME/codebase2/tagLeadBrand"
DESC="gcloud functions describe tagLeadBrand --region asia-southeast1 --gen2 --format=value(state,updateTime,buildConfig.runtime,buildConfig.entryPoint,eventTrigger.eventType,eventTrigger.triggerRegion,serviceConfig.maxInstanceCount,labels.deployment-tool)"

echo "=== (1) hiện trạng ==="
ls -la "$HOME/codebase2" | head -40
echo "--- firebase.json trong codebase2 (sâu ≤ 2):"
find "$HOME/codebase2" -maxdepth 2 -name firebase.json 2>/dev/null
[ -f "$D/index.js" ] || { echo "KHÔNG THẤY $D/index.js — dừng"; exit 1; }
N=$(grep -c "LENH B" "$D/index.js" || true)
echo "--- marker LENH B trong $D/index.js: $N"
if [ "$N" = "0" ]; then
  echo "chưa vá → vá ngay bằng _lb_tag_patch.cjs (KHỐI 1 đã tạo)"
  cp "$D/index.js" "$D/index.js.bak-$(date +%Y%m%d-%H%M%S)" && node "$HOME/firebase-s13/functions/_lb_tag_patch.cjs" "$D/index.js" || { echo "VÁ LỖI — dừng"; exit 1; }
fi
node --check "$D/index.js" && echo "SYNTAX OK" || { echo "SYNTAX LỖI — dừng"; exit 1; }
grep -n "brand_hint" "$D/index.js" | head -5
echo "--- describe TRƯỚC:"
$DESC 2>&1 | tail -2

echo "=== (2) deploy ĐÚNG 1 function ==="
if [ -f "$D/firebase.json" ]; then
  echo "(2a) có $D/firebase.json → firebase deploy --only functions:tagLeadBrand"
  ( cd "$D" && firebase deploy --only functions:tagLeadBrand ) > /tmp/lb_e_deploy.log 2>&1; RC=$?
else
  echo "(2b) không có firebase.json → gcloud functions deploy từ source (cập nhật function có sẵn, giữ trigger/env/SA)"
  gcloud functions deploy tagLeadBrand --gen2 --region=asia-southeast1 --runtime=nodejs22 --entry-point=tagLeadBrand --source="$D" --quiet > /tmp/lb_e_deploy.log 2>&1; RC=$?
fi
tail -8 /tmp/lb_e_deploy.log
echo "--- describe SAU (updateTime phải MỚI hơn TRƯỚC, state ACTIVE):"
$DESC 2>&1 | tail -2
if [ "$RC" = "0" ]; then echo "DEPLOY tagLeadBrand OK (rc=0)"; else echo "DEPLOY tagLeadBrand LỖI rc=$RC — dán cho em 30 dòng cuối /tmp/lb_e_deploy.log (function cũ vẫn chạy, không hỏng gì)"; fi
exit "$RC"
