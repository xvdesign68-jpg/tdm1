# m13.py <cây> <đường-dẫn-logo.png> — v119-71 / v120-esm-u (08/09): logo NGANG "Z15 MIRACLE" (chữ V + tên) ở màn chờ khởi động,
# để trong zip (assets/img/logo-full.png, ?v= tự hash, SW cache) thay vì gọi Cloudinary lúc mở trang. Áp sau m12. Fail-closed nguyên tử.
import sys, os, shutil
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
SRC = sys.argv[2] if len(sys.argv) > 2 else ''
if not (SRC and os.path.isfile(SRC) and os.path.getsize(SRC) > 1000): raise SystemExit('THIEU FILE LOGO: ' + repr(SRC))
rep('app.html', '''    <img src="assets/img/logo-mark.png?v=48019f7b7d" width="56" height="56" alt="SmartLead" style="border-radius:12px" />
  </div>
  <div class="spinner"></div>''', '''    <img src="assets/img/logo-full.png?v=0" height="64" alt="Z15 Miracle" decoding="async" />
  </div>
  <div class="spinner"></div>''', tag='html.logo')
rep('assets/css/app.css', '.loading-logo img { border-radius: 14px !important; box-shadow: 0 2px 6px rgba(16,18,35,.08), 0 18px 40px -14px rgba(27,45,204,.3); }',
    '.loading-logo img { height: 64px; width: auto; max-width: min(78vw, 360px); border-radius: 0 !important; box-shadow: none; } /* v119-71: logo ngang Z15 Miracle, không bo góc/đổ bóng */', tag='css.logo')
done()
if not lib.DRY:
    dst = os.path.join(lib.ROOT, 'assets/img/logo-full.png'); shutil.copyfile(SRC, dst); print('COPY', dst, os.path.getsize(dst), 'bytes')
