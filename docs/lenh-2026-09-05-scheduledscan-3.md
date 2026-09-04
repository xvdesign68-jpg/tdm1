# LỆNH #20 — `scheduledScan`: (a) gom code quét thành 1 file tải về · (b) vài dòng then chốt · (c) VÁ GIẢM ĐAU NGAY timeout 540→1800 (05/09/2026)

> Kết quả LỆNH #19: 1 lượt = nhiều **đợt tuần tự, mỗi đợt ~103 s** (3 nguồn/đợt, chờ snapshot BrightData hết ngân sách → "GIEO … se gat luot sau"); 28 nguồn → 5–10 đợt → 500–1000 s. Sau mốc 540 s Cloud Run trả 504, request kết thúc → **CPU bị throttle** (không có annotation `cpu-throttling: false`) → lượt ĐÓNG BĂNG tới khi tick 3' kế tới (+720 s) mới chạy tiếp (gap 209 s rồi 30 dòng GAT dồn trong 3 s). Khoá chống chồng lượt có TTL ≈ 600 s → lượt kế bắt đầu khi lượt trước còn chạy. BrightData `Customer is not active` suốt **04h→15h VN 04/09** (20 lượt/giờ, 0 bài, 560 lỗi/giờ) — hệ thống KHÔNG báo gì. **5 nguồn lỗi cố định = "thiếu cookie nick"** (neu1, bk-1, nguyên căn 1, hhqcvain1, Tm S Con Sen — nguồn quét bằng nick, chưa có cookie).
> Bản đồ code #19 hụt vì `blockEnd` vấp default param `opts = {}` trên dòng khai báo (bài học: chọn `{` SAU dấu `)` đóng tham số). Thay vì dump từng đoạn qua ảnh, mục (a) gom file → `cloudshell download` → anh upload file vào chat. Không có secret: chỉ TÊN biến env; chuỗi dài trong config.js bị che.

```bash
cd ~/firebase-s13/functions
echo "=== (a) gom code quét vào 1 file để tải về ==="
OUT=~/scan-dump-0905.txt
{
  echo "##### index.js (dòng 195-800) #####"; awk 'NR>=195 && NR<=800 {printf "%5d  %s\n", NR, $0}' index.js
  echo; echo "##### lib/scraper.js (toàn bộ) #####"; awk '{printf "%5d  %s\n", NR, $0}' lib/scraper.js
  echo; echo "##### lib/config.js (toàn bộ, che chuỗi dài) #####"; awk '{printf "%5d  %s\n", NR, $0}' lib/config.js | sed -E "s/(['\"])[A-Za-z0-9_\-]{28,}(['\"])/\1***\2/g"
  echo; echo "##### lib/logger.js (toàn bộ) #####"; awk '{printf "%5d  %s\n", NR, $0}' lib/logger.js
} > "$OUT"
echo "dòng: $(grep -c '' "$OUT") · kích thước: $(du -h "$OUT" | cut -f1)"
echo "-- dòng nghi có secret (chỉ được thấy TÊN biến process.env hoặc ***):"; grep -n -i -E "api[_-]?key|secret|token|password|cookie" "$OUT" | grep -v -i "process.env" | grep -v '\*\*\*' | head -8
cloudshell download "$OUT"

echo "=== (b) vài dòng then chốt (khoá lượt · tham số chờ · timeout hiện có) ==="
grep -n -i -E "lock|inprogress" index.js | grep -v "^\s*//" | head -12
grep -n -E "POLL|SLOW|WAIT|BATCH|CONC|POOL|TIMEOUT|MAX_|LIMIT|DEFER|GIEO|GAT" lib/config.js | head -25
grep -n -E "setGlobalOptions|timeoutSeconds|memory:" index.js | head -8
grep -n -E "not active|Customer" lib/scraper.js index.js | head -5

echo "=== (c) VÁ GIẢM ĐAU NGAY: scheduledScan timeoutSeconds 540 → 1800 + maxInstances 1 ==="
cp index.js "index.js.bak-$(date +%Y%m%d-%H%M%S)"
cat > /tmp/ss_patch.cjs <<'EOF_PATCH'
const fs=require('fs'); const L=fs.readFileSync('index.js','utf8').split('\n');
const i=L.findIndex(l=>/export const scheduledScan\s*=\s*onSchedule\(/.test(l)); if(i<0){ console.log('KHONG THAY scheduledScan'); process.exit(1); }
if(/timeoutSeconds/.test(L[i])){ console.log('DA CO timeoutSeconds, bo qua:', L[i].slice(0,180)); process.exit(0); }
const k="timeZone: 'Asia/Ho_Chi_Minh' }"; if(!L[i].includes(k)){ console.log('KHONG THAY MOC timeZone tren dong', i+1, ':', L[i].slice(0,220)); process.exit(1); }
L[i]=L[i].replace(k, "timeZone: 'Asia/Ho_Chi_Minh', timeoutSeconds: 1800, maxInstances: 1 }");
fs.writeFileSync('index.js', L.join('\n')); console.log('PATCH OK dong', i+1, ':', L[i].slice(0,220));
EOF_PATCH
node /tmp/ss_patch.cjs && node --check index.js && echo "SYNTAX OK"
(set -a; . ./.env; set +a; node --input-type=module -e "const m=await import('./index.js'); console.log('IMPORT OK · scheduledScan =', typeof m.scheduledScan)" 2>&1 | tail -3)
cd ~/firebase-s13 && firebase deploy --only functions:scheduledScan 2>&1 | grep -E "Deploy complete|scheduledScan|rror|timeout" | head -8
echo "--- kiểm sau deploy (mong: timeout 1800 · maxInstances 1 · attemptDeadline 1800s):"
gcloud functions describe scheduledScan --region asia-southeast1 --gen2 --format="value(serviceConfig.timeoutSeconds,serviceConfig.maxInstanceCount,serviceConfig.revision,updateTime)"
gcloud scheduler jobs describe firebase-schedule-scheduledScan-asia-southeast1 --location asia-southeast1 --format="value(schedule,attemptDeadline,state)"
echo "=== XONG LỆNH #20 ==="
```

Sau (c): hết 504 (lượt dài nhất từng thấy 1577 s < 1800), hết đóng băng CPU sau 540 s → lượt xong sớm hơn. Đây CHỈ là giảm đau; sửa gốc (LỆNH #21) sau khi em đọc file `scan-dump-0905.txt`: gieo snapshot TẤT CẢ nguồn ngay đầu lượt và gặt ở lượt kế (không chờ 100 s/đợt) → lượt ≈ 1–2 phút; khoá lượt TTL khớp thời gian chạy; phát hiện BrightData `Customer is not active` → ghi note + push báo Super Admin + tạm nghỉ 30' (thay vì đốt 560 call/giờ); 5 nguồn "thiếu cookie nick" → anh chốt cấp cookie hay tắt.
