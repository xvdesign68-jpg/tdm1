# LỆNH #38 (07/09/2026) — CHỈ ĐỌC, KHÔNG ghi gì lên Firestore/Rules/Functions. Chạy: bash /tmp/l38.sh 2>&1 | tee /tmp/l38.out
set -o pipefail
cd ~/firebase-s13/functions || { echo "KHONG THAY ~/firebase-s13/functions"; exit 1; }
echo "=== KHỐI 1a: Rules ĐANG CHẠY (ruleset, deploy hôm nay?, block users/leads/outreach_log + helper) ==="
node /tmp/l38_rules.mjs || echo "l38_rules LOI"
echo "=== KHỐI 1b: hồ sơ Super Admin (users + Auth) · user superadmin · kiểu detected_at · outreach_log · xuất seed ==="
cp /tmp/l38_db.mjs ./_l38_db.mjs
( set -a; . ./.env; set +a; node _l38_db.mjs ) || echo "l38_db LOI"
echo "=== KHỐI 2: tái lập truy vấn trên Firestore EMULATOR với đúng Rules + hồ sơ super (1–3 phút, cần Java + firebase CLI) ==="
if [ -s ~/rules-deployed.txt ] && [ -s ~/l38-seed.json ]; then
  mkdir -p ~/l38emu && cd ~/l38emu || exit 1
  cp ~/rules-deployed.txt rules.txt
  printf '%s\n' '{ "firestore": { "rules": "rules.txt" }, "emulators": { "firestore": { "port": 8080, "host": "127.0.0.1" }, "ui": { "enabled": false } } }' > firebase.json
  [ -f package.json ] || printf '%s\n' '{ "name": "l38emu", "private": true, "type": "module" }' > package.json
  [ -d node_modules/@firebase/rules-unit-testing ] || npm i --silent --no-audit --no-fund @firebase/rules-unit-testing firebase >/dev/null 2>&1 || echo "npm i LOI"
  cp /tmp/l38_emu.mjs ./emu.mjs
  firebase emulators:exec --only firestore --project smartlead-z15 "node emu.mjs" 2>&1 | grep -v "^i \|^✔ \|^⚠  emulators: " | tail -40
else
  echo "Bỏ qua KHỐI 2 (thiếu ~/rules-deployed.txt hoặc ~/l38-seed.json — xem lỗi KHỐI 1)"
fi
echo "=== XONG LỆNH #38 (không ghi gì) ==="
