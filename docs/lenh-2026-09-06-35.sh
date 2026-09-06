# LỆNH #35 — CHỈ ĐỌC. chạy bằng `bash /tmp/l35.sh 2>&1 | tee /tmp/l35.out`
cd ~/firebase-s13/functions || exit 1
echo "=== (a) Rules ĐANG CHẠY trên Firestore vs file local + ruleset gần đây ==="
node /tmp/l35_rules.mjs
echo "=== (b) users + outreach_stats hôm nay ==="
( set -a; . ./.env; set +a; node _l35_db.mjs )
echo "=== XONG LỆNH #35 (không ghi gì) ==="
