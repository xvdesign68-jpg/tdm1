# LỆNH #38b (07/09/2026) — CHỈ ĐỌC. Chạy: bash /tmp/l38b.sh 2>&1 | tee /tmp/l38b.out
set -o pipefail
export GOOGLE_CLOUD_QUOTA_PROJECT=smartlead-z15
cd ~/firebase-s13/functions || { echo "KHONG THAY ~/firebase-s13/functions"; exit 1; }
echo "=== KHỐI 1b (bổ sung): tài khoản Auth mang email super + đối chiếu hồ sơ users + seed ==="
cp /tmp/l38b_db.mjs ./_l38b_db.mjs
( set -a; . ./.env; set +a; node _l38b_db.mjs ) || echo "l38b_db LOI"
echo "=== KHỐI 2 (chạy lại): emulator với đúng Rules + hồ sơ super ==="
if [ -s ~/rules-deployed.txt ] && [ -s ~/l38-seed.json ] && [ -d ~/l38emu/node_modules/@firebase/rules-unit-testing ]; then
  cd ~/l38emu && cp ~/rules-deployed.txt rules.txt && cp /tmp/l38_emu2.mjs ./emu.mjs
  firebase emulators:exec --only firestore --project smartlead-z15 "node emu.mjs" 2>&1 | grep -v "^i \|^✔ \|^⚠  emulators: \|^⚠  hub\|^⚠  logging" | tail -30
else
  echo "Bỏ qua KHỐI 2 (thiếu rules/seed/node_modules — xem KHỐI 1 của LỆNH #38)"
fi
echo "=== XONG LỆNH #38b (không ghi gì) ==="
