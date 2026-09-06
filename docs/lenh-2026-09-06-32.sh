# LỆNH #32 — chạy bằng `bash /tmp/l32.sh 2>&1 | tee /tmp/l32.out` (KHÔNG dán từng dòng: Cloud Shell history-expand ký tự chấm than).
cd ~/firebase-s13/functions || exit 1
echo "=== (a) backup content.js + outreach.js + lib/config.js ==="
if grep -q 'LENH #32' content.js && grep -q 'LENH #32' outreach.js && grep -q 'BROWSER_SVC_URL:' lib/config.js; then
  echo "đã có marker LENH #32 ở cả 3 file (lần chạy trước) → GIỮ backup cũ:"; ls -1t content.js.bak-* outreach.js.bak-* lib/config.js.bak-* 2>/dev/null | head -3
else
  TS=$(date +%Y%m%d-%H%M%S); cp content.js "content.js.bak-$TS" && cp outreach.js "outreach.js.bak-$TS" && cp lib/config.js "lib/config.js.bak-$TS" && ls -1 "content.js.bak-$TS" "outreach.js.bak-$TS" "lib/config.js.bak-$TS" || exit 1
fi
echo "=== (b) patch LENH #32 (fail-closed, idempotent) ===" \
 && node /tmp/c32.cjs && node --check content.js && node --check outreach.js && node --check lib/config.js && echo "SYNTAX OK content.js + outreach.js + lib/config.js" \
 && echo "--- marker ---" && grep -n "LENH #32\|BROWSER_SVC_URL:" content.js outreach.js lib/config.js | cut -c1-120 \
 && echo "=== (c) import test với .env ===" \
 && ( set -a; . ./.env; set +a; node --input-type=module -e "const m=await import('./index.js'); const k=await import('./lib/config.js'); console.log('IMPORT OK · outreachTick =',typeof m.outreachTick,'· genContent =',typeof m.genContent,'· genForLead =',typeof m.genForLead,'· scheduledScan =',typeof m.scheduledScan,'· CFG.BROWSER_SVC_URL =',k.CFG.BROWSER_SVC_URL?('đã đặt ('+k.CFG.BROWSER_SVC_URL.length+' ký tự)'):'trống','· CFG.BROWSER_SVC_SECRET =',k.CFG.BROWSER_SVC_SECRET?'đã đặt':'trống')" ) \
 && echo "=== (c2) kiểm nhanh opt-out khớp xưng hô (chế độ reply, không gọi AI) ===" \
 && ( set -a; . ./.env; set +a; node --input-type=module -e "const {genForLead}=await import('./content.js'); const r=await genForLead({code:'t',content:{mode:'reply'}},{reply:'Chào chị Lan, em thấy chị cần mực khô loại 1. Chị cho em xin số lượng để báo giá nhé.'}); const r2=await genForLead({code:'t',content:{mode:'reply'}},{reply:'Chào anh Nam, em gửi anh bảng giá ghẹ đá nhé.'}); console.log(/, chị cứ bỏ qua/.test(r.inbox)&&/, anh cứ bỏ qua/.test(r2.inbox)?'OPT-OUT KHỚP XƯNG HÔ OK':'OPT-OUT SAI','|',r.inbox.slice(-55),'|',r2.inbox.slice(-55))" ) \
 && echo "=== (d) deploy outreachTick + genContent + scheduledScan + manualScan ===" \
 && firebase deploy --only functions:outreachTick,functions:genContent,functions:scheduledScan,functions:manualScan \
 && echo "=== (e) rev ===" \
 && for f in outreachTick genContent scheduledScan; do gcloud functions describe $f --region asia-southeast1 --project smartlead-z15 --format="value(name,serviceConfig.revision,state)"; done \
 && echo "=== (f) Content Studio hscl-01 → AI + CTA rõ, sinh thử 2 lead thật ===" \
 && ( set -a; . ./.env; set +a; node _l32_brand.mjs ) \
 && rm -f /tmp/c32.cjs /tmp/l32.sh \
 && echo "=== XONG LỆNH #32 — đọc 2 mẫu COMMENT/INBOX ở (f). Ưng thì áp cho thread đang xếp hàng: ( set -a; . ./.env; set +a; node _l32_brand.mjs --regen --dry ) rồi chạy lại bỏ --dry ==="
