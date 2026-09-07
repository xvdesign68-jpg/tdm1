# -*- coding: utf-8 -*-
# Số liệu từ agent rà CSS/design-system (đếm thật trên cây v119-60)
STATS = [
 ('2 bộ token chồng nhau', '46/53', 'biến `:root` trùng tên nhưng khác giá trị giữa tokens.css và app.css — app.css nạp sau nên thắng; tokens.css hứa Inter/Plus Jakarta, thực tế chạy system font; 24 token không dùng'),
 ('Mã màu hard-code', '218', 'mã hex khác nhau, chỉ 33 thuộc palette; 221 chỗ `var(--x, #hex)` fallback lệch token; 6 biến dùng mà chưa khai báo'),
 ('Cỡ chữ', '25', 'giá trị font-size trong CSS (8→34px), 235 chỗ .5px (11.5/12.5/13.5…); weight 650/550 vô nghĩa với system font; h2 = h3 cùng 15px'),
 ('Khoảng cách', '66%', 'giá trị padding/margin/gap KHÔNG là bội số 4 (719/1.088); 119 `margin-top` inline trong JS thay vì class'),
 ('Bo góc / bóng', '41 / 86', 'biến thể border-radius / box-shadow (chỉ ~17% dùng token)'),
 ('Inline style', '901', 'chuỗi `style="` trong template JS (85-users 195, 50-config 118, 10-core 113, 70-shell 109); 94 chuỗi dài >80 ký tự, dài nhất 296'),
 ('Icon', '497 vs 215', 'emoji/ký hiệu (→×152, ✓×33, 💬×20, ✅×14, ⚠️×18…) so với icon SVG SLI; 26 thẻ h3 có emoji; 11 dòng trộn SVG + emoji cùng nút'),
 ('Chip/badge', '43', 'class chip-like khác nhau cho cùng vai (chip, rl-tag2, ph-pill, mstage, badge-mt, oa-fbtag, em-pill, fm-pill…)'),
 ('Form', '6 / 104', 'label có `for=`; 51 control không class, 11 `outline:none` tắt focus; 2 định nghĩa focus-visible đè nhau'),
 ('Trạng thái', '27 + 3', 'empty-state vẽ tay ngoài component + 3 cơ chế toast khác nhau'),
 ('z-index / !important', '20 / 30', 'giá trị z-index (tới 2147483000) / số `!important` (đa số để đè inline style trên mobile)'),
 ('Responsive', '39 @media · 17 bp', 'breakpoint (639 và 640, 720/760/860/880 sát nhau); 14 grid cứng ≥3 cột; 4 bảng chưa bọc overflow'),
 ('CSS chết', '~13 KB', '99 rule không còn dùng (promo-banner, floating-social, alert-row, 4 biến thể btn…) trên 215 KB'),
 ('Animation góc màn hình', '3 vô hạn', 'orb nền + hotline pulse + mascot float chạy cùng lúc; 36 @keyframes, 49 animation; ảnh mascot tải từ Cloudinary bên thứ ba'),
]
TOP = [
 'Hợp nhất 2 `:root` (tokens.css vs app.css) — chốt palette + font thật, xoá định nghĩa trùng `.btn/.chip/:focus-visible`',
 'Xoá 221 fallback `var(--x,#hex)`, thêm 6 token thiếu, lint “var chưa khai báo / hex ngoài palette” trong build',
 'Map 185 màu lạ về token ngữ nghĩa (danger/warm/success/info + nền)',
 'Thang chữ 7 cỡ (11/12/13/14/16/20/24), cấm .5px, weight 500/600/700, h1/h2/h3 rõ',
 'Emoji → SVG: thêm ~25 icon vào icons.js, thay →/✓/✕/⚠ và 37 heading/nút emoji trước',
 'Inline style → class (94 chuỗi dài + 119 margin-top), bỏ 5 `<style>` inject từ JS',
 'Thang spacing 4/8 + utility mt/mb/gap; radius 41→5, shadow 86→5',
 '1 component chip + modifier; form chuẩn `.input/.select/.textarea` + label for/id + 1 focus ring',
 'emptyState()/toast()/skeleton() dùng chung; thang z-index 6 mức; bỏ 30 !important',
 'Dọn 99 rule chết, 24 token thừa, breakpoint 17→4; orb/ticker tắt mặc định, mascot self-host',
]
