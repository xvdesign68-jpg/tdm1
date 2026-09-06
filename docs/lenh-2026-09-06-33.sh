# LỆNH #33 — chạy bằng `bash /tmp/l33.sh 2>&1 | tee /tmp/l33.out`
cd ~/firebase-s13/functions || exit 1
echo "=== (a) backup content.js ==="
if grep -q 'LENH #33' content.js; then echo "đã có marker LENH #33 → GIỮ backup cũ"; else TS=$(date +%Y%m%d-%H%M%S); cp content.js "content.js.bak-$TS" && ls -1 "content.js.bak-$TS" || exit 1; fi
echo "=== (b) patch ===" \
 && node /tmp/c33.cjs && node --check content.js && echo "SYNTAX OK" \
 && echo "=== (c) kiểm: inbox KHÔNG còn dòng opt-out (chế độ reply, không gọi AI) ===" \
 && ( set -a; . ./.env; set +a; node --input-type=module -e "const {genForLead}=await import('./content.js'); const r=await genForLead({code:'t',content:{mode:'reply'}},{reply:'Chào chị Lan, em thấy chị cần mực khô loại 1. Chị cho em xin số lượng để báo giá nhé.'}); console.log(/bỏ qua tin này/.test(r.inbox)?'VẪN CÒN OPT-OUT — SAI':'HẾT OPT-OUT OK','|',r.inbox)" ) \
 && echo "=== (d) deploy genContent + outreachTick ===" \
 && firebase deploy --only functions:genContent,functions:outreachTick \
 && echo "=== (e) gỡ opt-out khỏi brand + thread/task đang xếp hàng ===" \
 && ( set -a; . ./.env; set +a; node _l33_optout.mjs ) \
 && rm -f /tmp/c33.cjs /tmp/l33.sh \
 && echo "=== XONG LỆNH #33 ==="
