# m14.py <cây> — v119-72 / v120-esm-v (08/09): (1) icon "Không nghe máy" (SLI.phoneOff) vẽ lại = ống nghe + dấu × góc trên
# (kiểu "cuộc gọi nhỡ") thay hình ống nghe gãy 2 khúc + gạch chéo (ở 13px trông như cây bút); (2) Dòng thời gian 360°: chấm mốc
# bị cắt nửa vì nằm ngoài padding-box của khối cuộn (overflow-y:auto) → đưa chấm + đường dọc vào trong padding (vẽ đường bằng ::after
# từng dòng, không dùng border-left). Áp được cho cả cây IIFE lẫn ESM. Fail-closed nguyên tử (lib.py 2 pha).
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import lib
lib.ROOT = sys.argv[1]
HAND = 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2.1Z'
rep('assets/js/icons.js',
    '''    phoneOff: s('<path d="M10.7 13.3a16 16 0 0 0 3.4 2.7l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.9.6 2.8.7a2 2 0 0 1 1.7 2.1v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1M5.2 5.6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9M3 3l18 18"/>'),''',
    '''    phoneOff: s('<path d="%s"/><path d="m15 3.5 5.5 5.5M20.5 3.5 15 9" stroke-width="2.2"/>'), /* v119-72: cuộc gọi nhỡ = ống nghe + × (trước: ống nghe gãy + gạch chéo, 13px nhìn như cây bút) */''' % HAND,
    tag='icons.phoneOff')
rep('assets/css/app.css',
    '.ld-tl-list { margin-top: 8px; border-left: 2px solid var(--hairline); padding-left: 12px; display: grid; gap: 6px; max-height: 260px; overflow-y: auto; }',
    '.ld-tl-list { margin-top: 8px; padding-left: 22px; display: grid; gap: 6px; max-height: 260px; overflow-y: auto; } /* v119-72: chấm + đường dọc nằm TRONG padding (khối cuộn cắt mọi thứ ngoài padding-box → chấm từng bị cắt nửa) */',
    tag='css.tl.list')
rep('assets/css/app.css',
    '.ld-tl-i::before { content: ""; position: absolute; left: -17px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--ink-300); }',
    '.ld-tl-i::before { content: ""; position: absolute; left: -17px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: var(--ink-300); box-shadow: 0 0 0 2px #fff; z-index: 1; }\n'
    '.ld-tl-i::after { content: ""; position: absolute; left: -14px; top: 13px; bottom: -8px; width: 2px; background: var(--hairline); }\n'
    '.ld-tl-i:last-child::after { display: none; }',
    tag='css.tl.dot')
done()
