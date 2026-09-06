# FE v119-54 / v120-esm-d: Content Studio — bỏ opt-out mặc định (để trống = không thêm dòng nào vào inbox)
import sys, os
root, mode = sys.argv[1], sys.argv[2]
p = os.path.join(root, 'src/app/45-outreach.js'); s = open(p, encoding='utf-8').read()
a = "optout: 'Nếu không tiện, anh/chị cứ bỏ qua tin này nhé.', tplComment: [], tplInbox: [] };"
assert s.count(a) == 1; s = s.replace(a, "optout: '', tplComment: [], tplInbox: [] }; // v119-54: bỏ opt-out mặc định (anh chốt 06/09) — để trống = không thêm dòng nào")
b = '<div class="form-row"><label>Dòng opt-out cuối inbox</label><input id="csOptout" maxlength="160" ${inp} value="${esc(c.optout)}"></div>'
assert s.count(b) == 1; s = s.replace(b, '<div class="form-row"><label>Dòng kết cuối inbox (tuỳ chọn)</label><input id="csOptout" maxlength="160" ${inp} value="${esc(c.optout)}" placeholder="Để trống = không thêm câu nào (mặc định)"></div>')
c = '<span style="margin-left:auto">Có opt-out &amp; ghi log mọi thao tác</span>'
assert s.count(c) == 1; s = s.replace(c, '<span style="margin-left:auto">Ghi log mọi thao tác</span>')
open(p, 'w', encoding='utf-8').write(s)
p = os.path.join(root, 'tools/smoke.js'); s = open(p, encoding='utf-8').read()
a = "  lg ? ok('v119-53: logo màn login lấy URL đã hash từ <link rel=icon> · live.js gọi __oaPatchWorkers khi chỉ VPS đổi') : fail('v119-53 thiếu logoSrc()/oaPatchWorkers trong bản min');\n"
assert s.count(a) == 1
s = s.replace(a, a + "  (!/bỏ qua tin này nhé/.test(fs.readFileSync(path.join(ROOT, 'assets/min/js/app.min.js'), 'utf8'))) ? ok('v119-54: Content Studio không còn opt-out mặc định') : fail('v119-54: vẫn còn câu opt-out mặc định trong app.min.js');\n")
open(p, 'w', encoding='utf-8').write(s)
print('FE54 OK', mode)
