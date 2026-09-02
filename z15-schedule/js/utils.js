/* =====================================================================
   Z15 Miracle · Lịch làm việc — utils.js
   Tiện ích dùng chung: ngày giờ, chuỗi, DOM, animation helpers.
   Classic script (không dùng ES module) để chạy được từ file://
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  var U = Z15.utils = {};

  /* ------------------------------------------------------------------ ids */
  var _seq = 0;
  U.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + (++_seq).toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /* ---------------------------------------------------------------- dates */
  function pad(n) { return String(n).padStart(2, '0'); }
  U.pad = pad;

  U.toISO = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  U.fromISO = function (iso) {
    var p = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  };
  U.today = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  U.todayISO = function () { return U.toISO(U.today()); };
  U.addDays = function (d, n) { var r = new Date(d); r.setDate(r.getDate() + n); return r; };
  U.addMonths = function (d, n) { var r = new Date(d), day = r.getDate(); r.setDate(1); r.setMonth(r.getMonth() + n); r.setDate(Math.min(day, new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate())); return r; };
  U.startOfWeek = function (d) { // Thứ Hai là đầu tuần
    var r = new Date(d); r.setHours(0, 0, 0, 0);
    var day = (r.getDay() + 6) % 7; r.setDate(r.getDate() - day); return r;
  };
  U.endOfWeek = function (d) { return U.addDays(U.startOfWeek(d), 6); };
  U.startOfMonth = function (d) { return new Date(d.getFullYear(), d.getMonth(), 1); };
  U.endOfMonth = function (d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); };
  U.isSameDay = function (a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  U.isToday = function (d) { return U.isSameDay(typeof d === 'string' ? U.fromISO(d) : d, U.today()); };
  U.isWeekend = function (d) { var day = (typeof d === 'string' ? U.fromISO(d) : d).getDay(); return day === 0 || day === 6; };
  U.daysBetween = function (a, b) {
    var A = typeof a === 'string' ? U.fromISO(a) : a, B = typeof b === 'string' ? U.fromISO(b) : b;
    return Math.round((B - A) / 86400000);
  };
  U.range = function (n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; };
  U.weekDays = function (d) { var s = U.startOfWeek(d); return U.range(7).map(function (i) { return U.addDays(s, i); }); };
  U.monthGrid = function (d) { // 6 tuần x 7 ngày, bắt đầu Thứ Hai
    var s = U.startOfWeek(U.startOfMonth(d));
    return U.range(42).map(function (i) { return U.addDays(s, i); });
  };
  U.isoWeek = function (d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  };

  U.WEEKDAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  U.WEEKDAYS_LONG = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
  U.MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  U.weekdayIndex = function (d) { return (d.getDay() + 6) % 7; };
  U.weekdayShort = function (d) { return U.WEEKDAYS_SHORT[U.weekdayIndex(d)]; };
  U.weekdayLong = function (d) { return U.WEEKDAYS_LONG[U.weekdayIndex(d)]; };

  /**
   * fmtDate(date|iso, style)
   *  'short'     -> 02/09/2026
   *  'dm'        -> 02/09
   *  'medium'    -> 2 Th9
   *  'long'      -> Thứ Tư, 02/09/2026
   *  'weekday'   -> Thứ Tư
   *  'monthYear' -> Tháng 9/2026
   *  'dayMonth'  -> 2 tháng 9
   */
  U.fmtDate = function (d, style) {
    if (typeof d === 'string') d = U.fromISO(d);
    var day = d.getDate(), m = d.getMonth(), y = d.getFullYear();
    switch (style || 'short') {
      case 'dm': return pad(day) + '/' + pad(m + 1);
      case 'medium': return day + ' Th' + (m + 1);
      case 'long': return U.weekdayLong(d) + ', ' + pad(day) + '/' + pad(m + 1) + '/' + y;
      case 'weekday': return U.weekdayLong(d);
      case 'monthYear': return U.MONTHS[m] + '/' + y;
      case 'dayMonth': return day + ' tháng ' + (m + 1);
      case 'shortWeekday': return U.weekdayShort(d) + ' ' + pad(day) + '/' + pad(m + 1);
      default: return pad(day) + '/' + pad(m + 1) + '/' + y;
    }
  };
  U.fmtRelativeDay = function (d) {
    if (typeof d === 'string') d = U.fromISO(d);
    var diff = U.daysBetween(U.today(), d);
    if (diff === 0) return 'Hôm nay';
    if (diff === 1) return 'Ngày mai';
    if (diff === -1) return 'Hôm qua';
    if (diff > 1 && diff < 7) return U.weekdayLong(d);
    return U.fmtDate(d, 'shortWeekday');
  };
  U.fmtRange = function (a, b) {
    var A = typeof a === 'string' ? U.fromISO(a) : a, B = typeof b === 'string' ? U.fromISO(b) : b;
    if (U.isSameDay(A, B)) return U.fmtDate(A, 'dayMonth');
    if (A.getMonth() === B.getMonth()) return A.getDate() + ' – ' + B.getDate() + ' tháng ' + (A.getMonth() + 1);
    return U.fmtDate(A, 'dm') + ' – ' + U.fmtDate(B, 'dm');
  };

  U.timeToMin = function (t) { if (!t) return 0; var p = t.split(':').map(Number); return p[0] * 60 + (p[1] || 0); };
  U.minToTime = function (m) { m = Math.max(0, Math.round(m)); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); };
  U.nowMinutes = function () { var n = new Date(); return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60; };
  U.fmtDuration = function (mins) {
    mins = Math.round(mins);
    if (mins < 60) return mins + ' phút';
    var h = Math.floor(mins / 60), m = mins % 60;
    return m ? h + 'g' + pad(m) : h + 'g';
  };
  U.fmtTimeRange = function (s, e) { return s && e ? s + ' – ' + e : (s || ''); };
  U.timeAgo = function (iso) {
    var t = new Date(iso).getTime(), diff = (Date.now() - t) / 1000;
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return Math.floor(diff / 60) + ' phút trước';
    if (diff < 86400) return Math.floor(diff / 3600) + ' giờ trước';
    if (diff < 172800) return 'hôm qua';
    return Math.floor(diff / 86400) + ' ngày trước';
  };
  U.greeting = function () {
    var h = new Date().getHours();
    if (h < 11) return 'Chào buổi sáng';
    if (h < 13) return 'Chào buổi trưa';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  /* -------------------------------------------------------------- strings */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.escapeHtml = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  U.normalizeVN = function (s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  };
  /** 3 = khớp đầu từ, 2 = chứa chuỗi, 1 = mọi từ trong truy vấn đều là tiền tố của một từ trong văn bản, 0 = không khớp */
  U.fuzzyMatch = function (query, text) {
    var q = U.normalizeVN(query).trim(), t = U.normalizeVN(text);
    if (!q) return 1;
    if (t.indexOf(q) === 0 || t.indexOf(' ' + q) >= 0) return 3;
    if (t.indexOf(q) >= 0) return 2;
    var words = t.split(/[^a-z0-9]+/).filter(Boolean), parts = q.split(/\s+/).filter(Boolean);
    var ok = parts.every(function (p) { return words.some(function (w) { return w.indexOf(p) === 0; }); });
    return ok ? 1 : 0;
  };
  U.firstName = function (name) { var p = String(name).trim().split(/\s+/); return p[p.length - 1]; };
  U.shortName = function (name) { var p = String(name).trim().split(/\s+/); return p.slice(-2).join(' '); };
  U.initials = function (name) {
    var p = String(name).trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[p.length - 2][0] + p[p.length - 1][0]).toUpperCase();
  };
  U.hashCode = function (s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; } return Math.abs(h); };
  U.fmtNumber = function (n) { return Number(n || 0).toLocaleString('vi-VN'); };
  U.percent = function (a, b) { return b ? Math.round((a / b) * 100) : 0; };
  U.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ------------------------------------------------------------ collections */
  U.groupBy = function (arr, fn) {
    var out = {}; (arr || []).forEach(function (x) { var k = typeof fn === 'function' ? fn(x) : x[fn]; (out[k] = out[k] || []).push(x); }); return out;
  };
  U.sortBy = function (arr, fn, desc) {
    var f = typeof fn === 'function' ? fn : function (x) { return x[fn]; };
    return (arr || []).slice().sort(function (a, b) { var A = f(a), B = f(b); return (A < B ? -1 : A > B ? 1 : 0) * (desc ? -1 : 1); });
  };
  U.sum = function (arr, fn) { return (arr || []).reduce(function (s, x) { return s + (fn ? fn(x) : x); }, 0); };
  U.uniq = function (arr) { return Array.from(new Set(arr || [])); };
  U.by = function (arr, key) { var m = {}; (arr || []).forEach(function (x) { m[x[key || 'id']] = x; }); return m; };
  U.debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 150); }; };
  U.throttle = function (fn, ms) { var last = 0, t; return function () { var now = Date.now(), a = arguments, c = this; if (now - last >= ms) { last = now; fn.apply(c, a); } else { clearTimeout(t); t = setTimeout(function () { last = Date.now(); fn.apply(c, a); }, ms - (now - last)); } }; };
  U.rafThrottle = function (fn) { var pending = false, args; return function () { args = arguments; if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; fn.apply(null, args); }); }; };

  /* ------------------------------------------------------------------- DOM */
  U.qs = function (sel, root) { return (root || document).querySelector(sel); };
  U.qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /** el('div', {class:'a', dataset:{id:1}, style:{color:'red'}, onclick:fn, html:'<b>x</b>'}, child, 'text') */
  U.el = function (tag, attrs) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class' || k === 'className') node.className = v;
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) U.append(node, arguments[i]);
    return node;
  };
  U.append = function (node, child) {
    if (child == null || child === false) return node;
    if (Array.isArray(child)) { child.forEach(function (c) { U.append(node, c); }); return node; }
    if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
    return node;
  };
  /** Tagged template with auto-escaping. Use U.raw(str) to inject trusted HTML. */
  function Raw(s) { this.s = s; }
  U.raw = function (s) { return new Raw(s); };
  U.html = function (strings) {
    var out = '';
    for (var i = 0; i < strings.length; i++) {
      out += strings[i];
      if (i + 1 < arguments.length) {
        var v = arguments[i + 1];
        if (v instanceof Raw) out += v.s;
        else if (Array.isArray(v)) out += v.map(function (x) { return x instanceof Raw ? x.s : U.escapeHtml(x); }).join('');
        else if (v != null && v !== false) out += U.escapeHtml(v);
      }
    }
    return new Raw(out);
  };
  U.render = function (container, htmlOrRaw) {
    container.innerHTML = htmlOrRaw instanceof Raw ? htmlOrRaw.s : String(htmlOrRaw);
    return container;
  };
  U.frag = function (htmlOrRaw) {
    var t = document.createElement('template');
    t.innerHTML = (htmlOrRaw instanceof Raw ? htmlOrRaw.s : String(htmlOrRaw)).trim();
    return t.content;
  };
  U.delegate = function (root, evt, selector, handler) {
    var fn = function (e) {
      var target = e.target.closest ? e.target.closest(selector) : null;
      if (target && root.contains(target)) handler.call(target, e, target);
    };
    root.addEventListener(evt, fn);
    return function () { root.removeEventListener(evt, fn); };
  };
  U.onceTransitionEnd = function (node, cb, timeout) {
    var done = false;
    var finish = function (e) { if (e && e.target && e.target !== node) return; if (done) return; done = true; node.removeEventListener('transitionend', finish); node.removeEventListener('animationend', finish); cb(); };
    node.addEventListener('transitionend', finish); node.addEventListener('animationend', finish);
    setTimeout(finish, timeout || 600);
  };
  U.prefersReducedMotion = function () { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!(global.document && document.body && document.body.classList.contains('reduce-motion')); };

  /** Đếm số tăng dần (wow nhỏ cho KPI). */
  U.countUp = function (node, to, opts) {
    opts = opts || {};
    var from = Number(opts.from || 0), dur = opts.duration || 900, fmt = opts.format || function (v) { return Math.round(v).toLocaleString('vi-VN'); };
    if (U.prefersReducedMotion() || dur <= 0) { node.textContent = fmt(to); return; }
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = U.clamp((ts - start) / dur, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  /** Stagger reveal: thêm class .is-in với delay tăng dần cho các phần tử con. */
  U.stagger = function (container, selector, opts) {
    opts = opts || {};
    var items = typeof container === 'string' ? U.qsa(container) : U.qsa(selector || '.reveal', container);
    var step = opts.step == null ? 40 : opts.step, base = opts.delay || 0, max = opts.max || 600;
    var reduce = U.prefersReducedMotion();
    items.forEach(function (it, i) {
      var d = Math.min(base + i * step, max);
      if (reduce) { it.classList.add('is-in'); return; }
      it.style.transitionDelay = d + 'ms';
      it.style.animationDelay = d + 'ms';
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { items.forEach(function (it) { it.classList.add('is-in'); }); }); });
    setTimeout(function () { items.forEach(function (it) { it.style.transitionDelay = ''; it.style.animationDelay = ''; }); }, max + 800);
    return items;
  };

  U.copyToClipboard = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta); return Promise.resolve();
  };

  U.focusTrap = function (node) {
    var sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function onKey(e) {
      if (e.key !== 'Tab') return;
      var f = U.qsa(sel, node).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    node.addEventListener('keydown', onKey);
    return function () { node.removeEventListener('keydown', onKey); };
  };

  U.loadJSON = function (key, fallback) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } };
  U.saveJSON = function (key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } };

  /** Màu avatar ổn định theo tên (dùng hue xoay quanh bảng màu hài hoà). */
  U.avatarHue = function (seed) { return U.hashCode(seed) % 360; };

  /** Hex -> rgba string */
  U.rgba = function (hex, a) {
    var h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
  };

  /** Seeded RNG (mulberry32) để dữ liệu mẫu ổn định. */
  U.rng = function (seed) {
    var a = seed >>> 0;
    var r = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    r.int = function (min, max) { return Math.floor(r() * (max - min + 1)) + min; };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.chance = function (p) { return r() < p; };
    r.shuffle = function (arr) { var c = arr.slice(); for (var i = c.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = c[i]; c[i] = c[j]; c[j] = t; } return c; };
    return r;
  };
})(window);
