# LỆNH #34 — chạy bằng `bash /tmp/l34.sh 2>&1 | tee /tmp/l34.out`
cd ~/firebase-s13/functions || exit 1
echo "=== (a) backup content.js + outreach.js ==="
TS=$(date +%Y%m%d-%H%M%S)
if grep -q 'LENH #34' content.js; then echo "content.js đã có marker LENH #34 → GIỮ backup cũ"; else cp content.js "content.js.bak-$TS" && ls -1 "content.js.bak-$TS" || exit 1; fi
if grep -q 'content_meta' outreach.js; then echo "outreach.js đã có content_meta → GIỮ backup cũ"; else cp outreach.js "outreach.js.bak-$TS" && ls -1 "outreach.js.bak-$TS" || exit 1; fi
echo "=== (b) patch (fail-closed: thiếu/thừa mốc → không ghi, dừng) ===" \
 && node /tmp/c34.cjs && node --check content.js && node --check outreach.js && echo "SYNTAX OK" \
 && echo "=== (c) import + kiểm KHÔNG gọi AI (chế độ reply, bình luận dưới bài chào bán của người khác) ===" \
 && ( set -a; . ./.env; set +a; node --input-type=module -e "const m=await import('./index.js'); const {genForLead}=await import('./content.js'); console.log('IMPORT OK · outreachTick =',typeof m.outreachTick,'· genContent =',typeof m.genContent,'· genForLead =',typeof genForLead); const r=await genForLead({code:'t',name:'Hải Sản Cường Linh',content:{mode:'reply'}},{kind:'comment',text:'Giá',parent_text:'Mực khô loại 1 350k/kg ship toàn quốc ib mình nhé',reply:'Chào chị Hiền, bên Hải Sản Cường Linh có cá lóc khô giá 180k/kg, ngon hơn bên kia. Chị inbox em gửi bảng giá nhé.'}); const okc = r.meta && r.meta.parent==='seller' && r.comment.indexOf('180k')<0 && r.comment.indexOf('Cường Linh')<0 && r.comment.length<=200; console.log(okc?'BÀI ĐỐI THỦ → BÌNH LUẬN NHẸ OK':'BÀI ĐỐI THỦ SAI','|',r.comment,'| meta',JSON.stringify(r.meta)); if (okc===false) process.exit(1);" ) \
 && echo "=== (d) sinh THỬ 2 lead thật hscl-01 bằng AI (không ghi gì; ~15-30 s/lead) ===" \
 && ( set -a; . ./.env; set +a; node _l34_test.mjs ) \
 && echo "=== (e) deploy genContent + outreachTick ===" \
 && firebase deploy --only functions:genContent,functions:outreachTick \
 && echo "=== (f) thread đang xếp hàng chưa bình luận — CHỈ XEM (DRY) ===" \
 && ( set -a; . ./.env; set +a; node _l34_regen.mjs --dry ) \
 && rm -f /tmp/c34.cjs /tmp/l34.sh \
 && echo "=== XONG LỆNH #34 — ưng nội dung (d)/(f) thì chạy: cd ~/firebase-s13/functions; set -a; . ./.env; set +a; node _l34_regen.mjs ==="
