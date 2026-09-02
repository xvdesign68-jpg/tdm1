/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/roster.js
   Bảng ca: ma trận nhân sự × ngày. Sổ cái biên tập: cột thẳng hàng,
   header dính hai chiều, tô ca, kéo đổi ca, phím nhanh, hoàn tác,
   gợi ý lấp ca, công bố lịch (sóng lan).
   Route: #/roster/{yyyy-mm-dd}?range=7|14&team=<id>&loc=HN|HCM&q=
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, D = Z15.data;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };
  var R = function () { return Z15.router; };

  var K = { range: 'z15.ui.roster.range', filters: 'z15.ui.roster.filters', collapsed: 'z15.ui.roster.collapsed', published: 'z15.ui.roster.published' };
  var QUICK = { s: 'morning', c: 'afternoon', f: 'full', w: 'remote', q: 'onsite', n: 'leave', o: 'ot', '-': 'off' };
  var QUICK_KEY = {}; Object.keys(QUICK).forEach(function (k) { QUICK_KEY[QUICK[k]] = k; });
  var COV_WARN = 0.6, OVER_H = 48, UNDER_H = 32, QUOTA_H = 40;
  var V = null; // instance duy nhất

  /* ------------------------------------------------------------ helpers */
  var esc = U.escapeHtml;
  function reduce() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function validISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(U.fromISO(s).getTime()); }
  function isTyping(e) { var t = e.target; return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)); }
  function hasLayer() { return !!document.querySelector('.modal-overlay, .drawer-overlay, .palette-overlay, .popover'); }
  function hoursLabel(h) { var r = Math.round(h * 10) / 10; return (r % 1 ? r.toFixed(1).replace('.', ',') : String(r)) + 'g'; }
  function shortHours(t) { if (t.hours === '—') return ''; if (t.hours.indexOf(':') < 0) return 'lịch quay'; return t.hours.replace(/\s*–\s*/, '–'); }
  function cellKey(staffId, iso) { return staffId + '|' + iso; }
  function nextWorkday(iso) {
    var d = U.addDays(U.fromISO(iso), 1);
    for (var i = 0; i < 14; i++, d = U.addDays(d, 1)) { var k = U.toISO(d); if (!U.isWeekend(d) && !S().holidayName(k)) return k; }
    return U.toISO(d);
  }

  /* -------------------------------------------------------------- route */
  function loadFilters() { var p = U.loadJSON(K.filters, null) || {}; return { team: p.team || '', loc: p.loc || '' }; }
  function saveFilters() { U.saveJSON(K.filters, { team: V.team, loc: V.loc }); }
  function parseRoute(route) {
    var parts = route.parts || [], q = route.query || {}, pf = loadFilters();
    var iso = validISO(parts[0]) ? parts[0] : U.todayISO();
    var range = q.range === '14' || q.range === '7' ? +q.range : (U.loadJSON(K.range, 7) === 14 ? 14 : 7);
    var team = q.team != null ? q.team : pf.team; if (team && !S().team(team)) team = '';
    var loc = q.loc != null ? q.loc : pf.loc; if (loc !== 'HN' && loc !== 'HCM') loc = '';
    return { iso: iso, range: range, team: team, loc: loc, q: q.q || '' };
  }
  function go(p) { R().go('roster/' + p.iso, { range: String(p.range), team: p.team || null, loc: p.loc || null, q: p.q || null }); }
  function current() { return { iso: V.iso, range: V.range, team: V.team, loc: V.loc, q: V.q }; }
  function periodStart(iso) { return U.startOfWeek(U.fromISO(iso)); }
  function periodKey(iso, range) { return U.toISO(periodStart(iso)) + '|' + range; }
  function periodTitle(iso, range) {
    var s = periodStart(iso), e = U.addDays(s, range - 1);
    var w = range === 7 ? 'Tuần ' + U.isoWeek(s) : 'Tuần ' + U.isoWeek(s) + '–' + U.isoWeek(e);
    return w + ' · ' + U.fmtDate(s, 'dm') + ' – ' + U.fmtDate(e, 'dm');
  }
  function weekWord(iso, range) { var s = periodStart(iso); return range === 7 ? 'tuần ' + U.isoWeek(s) : 'tuần ' + U.isoWeek(s) + '–' + U.isoWeek(U.addDays(s, range - 1)); }

  /* --------------------------------------------------------------- data */
  function ctx() {
    var st = S(), state = st.state, me = st.me(), today = U.todayISO();
    var start = periodStart(V.iso);
    var days = U.range(V.range).map(function (i) {
      var d = U.addDays(start, i), iso = U.toISO(d), weekend = U.isWeekend(d), hol = st.holidayName(iso);
      return { iso: iso, d: d, i: i, weekend: weekend, holiday: hol, today: iso === today, working: !weekend && !hol };
    });
    var weeks = U.uniq(days.map(function (d) { return U.toISO(U.startOfWeek(d.d)); }));
    var order = {}; state.staff.forEach(function (s, i) { order[s.id] = i; });
    var teamOrder = {}; state.teams.forEach(function (t, i) { teamOrder[t.id] = i; });
    var q = (V.q || '').trim();
    var staff = state.staff.filter(function (s) {
      if (V.team && s.teamId !== V.team) return false;
      if (V.loc && s.location !== V.loc) return false;
      if (q) { var t = st.team(s.teamId); if (U.fuzzyMatch(q, s.name + ' ' + s.role + ' ' + (t ? t.name + ' ' + t.short : '')) === 0) return false; }
      return true;
    }).sort(function (a, b) { return (teamOrder[a.teamId] - teamOrder[b.teamId]) || (order[a.id] - order[b.id]); });
    var approved = state.requests.filter(function (r) { return r.status === 'approved' && r.type === 'leave'; });
    function lockedAt(sid, iso) { return approved.some(function (r) { return r.staffId === sid && iso >= r.from && iso <= r.to; }); }
    var rows = staff.map(function (s) {
      var shifts = days.map(function (d) { return st.shiftOf(s.id, d.iso); });
      var minutes = U.sum(shifts, function (t) { return st.shiftType(t).minutes; });
      var weekH = weeks.map(function (w) { return st.weekHours(s.id, w); });
      return {
        s: s, team: st.team(s.teamId), shifts: shifts, hours: minutes / 60, weekH: weekH,
        over: weekH.some(function (h) { return h > OVER_H; }), under: weekH.some(function (h) { return h < UNDER_H; }),
        locked: days.map(function (d, i) { return shifts[i] === 'leave' && lockedAt(s.id, d.iso); }),
        me: s.id === me.id
      };
    });
    var byTeam = U.groupBy(rows, function (r) { return r.s.teamId; });
    var teams = state.teams.filter(function (t) { return byTeam[t.id]; });
    var cov = days.map(function (d, i) {
      var on = 0; rows.forEach(function (r) { if (r.shifts[i] !== 'leave' && r.shifts[i] !== 'off') on++; });
      var ratio = rows.length ? on / rows.length : 0;
      return { on: on, total: rows.length, ratio: ratio, low: d.working && rows.length > 0 && ratio < COV_WARN };
    });
    var foot = days.map(function (d, i) {
      var counts = {}; rows.forEach(function (r) { counts[r.shifts[i]] = (counts[r.shifts[i]] || 0) + 1; });
      return D.SHIFT_TYPES.filter(function (t) { return t.id !== 'off' && counts[t.id]; }).map(function (t) { return { t: t, n: counts[t.id] }; });
    });
    var totalHours = U.sum(rows, function (r) { return r.hours; });
    var health = {
      low: days.filter(function (d, i) { return cov[i].low; }),
      over: rows.filter(function (r) { return r.over; }),
      under: rows.filter(function (r) { return r.under && !r.over; })
    };
    var filtered = !!(V.team || V.loc || q);
    return { st: st, me: me, today: today, start: start, days: days, weeks: weeks, rows: rows, byTeam: byTeam, teams: teams, cov: cov, foot: foot, totalHours: totalHours, health: health, filtered: filtered, lockedAt: lockedAt, allStaff: state.staff };
  }
  function isLocked(staffId, iso) { return V && V.cx ? (S().shiftOf(staffId, iso) === 'leave' && V.cx.lockedAt(staffId, iso)) : false; }
  function signature(cx) {
    var out = [];
    cx.allStaff.forEach(function (s) { out.push(cx.days.map(function (d) { return cx.st.shiftOf(s.id, d.iso)[0]; }).join('')); });
    return out.join('.');
  }

  /* ------------------------------------------------------------- render */
  function chipHtml(typeId, opts) {
    var t = S().shiftType(typeId), hrs = shortHours(t);
    return '<span class="shift ro-chip" data-shift="' + t.id + '"><span class="shift__short">' + esc(t.short) + '</span>' + (hrs ? '<span class="ro-chip__hrs">' + esc(hrs) + '</span>' : '') + '</span>';
  }
  function cellHtml(r, ri, d, di, cx) {
    var typeId = r.shifts[di], t = cx.st.shiftType(typeId), locked = r.locked[di];
    var cls = 'ro-cell' + (d.today ? ' is-today' : '') + (d.weekend ? ' is-weekend' : '') + (d.holiday ? ' is-holiday hatch' : '') + (r.me ? ' is-mine' : '') + (locked ? ' is-locked' : '');
    var label = U.shortName(r.s.name) + ' · ' + U.fmtDate(d.d, 'shortWeekday') + ' · ' + t.label + (t.hours !== '—' ? ' · ' + t.hours : '') + (locked ? ' · nghỉ phép đã duyệt' : '') + (d.holiday ? ' · ' + d.holiday : '');
    return '<div class="' + cls + '" role="gridcell" tabindex="-1" data-staff="' + r.s.id + '" data-iso="' + d.iso + '" data-r="' + ri + '" data-c="' + di + '" data-shift="' + t.id + '" aria-selected="false" aria-label="' + esc(label) + '">' + chipHtml(typeId) + '</div>';
  }
  function personHtml(r, cx) {
    var pct = U.clamp(r.hours / (QUOTA_H * cx.weeks.length) * 100, 0, 100);
    var lvl = r.over ? ' is-over' : r.under ? ' is-under' : '';
    var barColor = r.over ? 'var(--red-ink)' : r.under ? 'var(--fg-tertiary)' : 'var(--fg-secondary)';
    return '<div class="ro-person" role="rowheader">' + UI.avatar(r.s, { size: 'sm', status: true, title: false }) +
      '<span class="ro-person__txt"><span class="ro-person__top"><b class="ro-person__name truncate" title="' + esc(r.s.name) + '">' + esc(r.s.name) + '</b><b class="ro-person__h mono-sm tnum' + lvl + '" title="' + esc('Giờ ca trong kỳ · định mức ' + (QUOTA_H * cx.weeks.length) + 'g') + '">' + esc(hoursLabel(r.hours)) + '</b></span>' +
      '<span class="ro-person__sub"><span class="ro-person__role truncate">' + esc(r.s.role) + '</span>' + (r.me ? '<span class="chip chip--xs chip--blue ro-person__me">Bạn</span>' : '') + '</span>' +
      '<span class="progress progress--xs ro-person__bar" style="--bar:' + barColor + '" role="progressbar" aria-label="Giờ ca" aria-valuenow="' + Math.round(r.hours) + '" aria-valuemin="0" aria-valuemax="' + (QUOTA_H * cx.weeks.length) + '"><span class="progress__bar" style="width:' + pct.toFixed(1) + '%"></span></span></span></div>';
  }
  function dayHeadHtml(d, di, cx, anim) {
    var c = cx.cov[di];
    var cls = 'ro-dh' + (d.today ? ' is-today' : '') + (d.weekend ? ' is-weekend' : '') + (d.holiday ? ' is-holiday' : '') + (c.low ? ' is-low' : '');
    var covLabel = c.on + '/' + c.total + ' người làm việc' + (c.low ? ' · thiếu người' : '');
    return '<div class="' + cls + '" role="columnheader" data-iso="' + d.iso + '"' + (d.today ? ' aria-current="date"' : '') + '>' +
      '<span class="ro-dh__wd">' + U.weekdayShort(d.d) + '</span>' +
      '<button type="button" class="ro-dh__num tnum" data-go-day="' + d.iso + '" aria-label="' + esc('Xem lịch ' + U.fmtDate(d.d, 'long') + (d.holiday ? ' · ' + d.holiday : '')) + '">' + U.pad(d.d.getDate()) + '</button>' +
      (d.holiday ? '<span class="ro-dh__hol truncate" title="' + esc(d.holiday) + '">' + esc(d.holiday) + '</span>' : '') +
      '<span class="ro-cov" aria-hidden="true"><span class="ro-cov__bar" style="transform:scaleX(' + (anim ? 0 : c.ratio.toFixed(3)) + ')" data-ratio="' + c.ratio.toFixed(3) + '"></span></span>' +
      '<span class="ro-cov__n mono-sm tnum" aria-label="' + esc(covLabel) + '" title="' + esc(covLabel) + '">' + c.on + '/' + c.total + '</span></div>';
  }
  function teamRowHtml(t, list, cx) {
    var collapsed = !!V.collapsed[t.id], hours = U.sum(list, function (r) { return r.hours; });
    var html = '<div class="ro-row ro-trow' + (collapsed ? ' is-collapsed' : '') + '" role="row" data-team="' + t.id + '" style="--chip:' + t.color + '">' +
      '<div class="ro-trow__head" role="rowheader"><button type="button" class="ro-trow__btn" data-toggle-team="' + t.id + '" aria-expanded="' + (!collapsed) + '" aria-label="' + esc((collapsed ? 'Mở rộng ' : 'Thu gọn ') + 'team ' + t.name) + '">' + UI.icon('chevron-down', { size: 15, cls: 'ro-trow__chev' }) + '<i class="chip__dot"></i><b>' + esc(t.name) + '</b><small class="tnum">' + list.length + ' người · ' + esc(hoursLabel(hours)) + '</small></button></div>';
    cx.days.forEach(function (d, di) {
      var on = 0; list.forEach(function (r) { if (r.shifts[di] !== 'leave' && r.shifts[di] !== 'off') on++; });
      var lowT = d.working && on / list.length < COV_WARN;
      html += '<div class="ro-trow__n' + (d.today ? ' is-today' : '') + (d.weekend ? ' is-weekend' : '') + (d.holiday ? ' is-holiday' : '') + (lowT ? ' is-low' : '') + '" role="gridcell" title="' + esc(t.name + ' · ' + U.fmtDate(d.d, 'shortWeekday') + ' · ' + on + '/' + list.length + ' người') + '"><span class="mono-sm tnum">' + on + '<small>/' + list.length + '</small></span></div>';
    });
    return html + '</div>';
  }
  function footHtml(cx) {
    var html = '<div class="ro-row ro-frow" role="row"><div class="ro-frow__head" role="rowheader"><span class="eyebrow">Tổng giờ ca</span><b class="mono tnum">' + esc(hoursLabel(cx.totalHours)) + '</b><small>' + cx.rows.length + ' người · ' + cx.days.length + ' ngày</small></div>';
    cx.days.forEach(function (d, di) {
      var items = cx.foot[di];
      html += '<div class="ro-frow__d' + (d.today ? ' is-today' : '') + (d.weekend ? ' is-weekend' : '') + '" role="gridcell">' +
        (items.length ? items.map(function (x) { return '<span class="ro-mini shift" data-shift="' + x.t.id + '" title="' + esc(x.t.label + ' · ' + x.n + ' người') + '"><span class="shift__short">' + esc(x.t.short) + '</span><b class="tnum">' + x.n + '</b></span>'; }).join('') : '<span class="ro-frow__none">—</span>') + '</div>';
    });
    return html + '</div>';
  }
  function buildGrid(cx, anim) {
    var n = cx.days.length;
    var grid = U.el('div', { class: 'ro-grid' + (n === 14 ? ' ro-grid--14' : '') + (V.paint ? ' is-paint' : ''), role: 'grid', 'aria-label': 'Bảng ca ' + periodTitle(V.iso, V.range), 'aria-rowcount': String(cx.rows.length + cx.teams.length + 2), 'aria-colcount': String(n + 1), style: '--ro-n:' + n });
    var html = '<div class="ro-row ro-hrow" role="row"><div class="ro-corner" role="columnheader"><span class="eyebrow">Nhân sự</span><b class="ro-corner__n tnum">' + cx.rows.length + ' người</b><small>' + cx.teams.length + ' team' + (cx.filtered ? ' · đang lọc' : '') + '</small></div>';
    cx.days.forEach(function (d, di) { html += dayHeadHtml(d, di, cx, anim); });
    html += '</div>';
    var ri = 0;
    if (!cx.rows.length) {
      html += '<div class="ro-empty">' + UI.empty({ icon: 'search', title: V.q ? 'Không ai khớp “' + V.q + '”' : 'Không có ai trong bộ lọc này', body: V.q ? 'Thử bỏ dấu, gõ tên ngắn hơn hoặc kiểm tra lại team.' : 'Chọn team khác hoặc bỏ lọc để xem cả công ty.', actionLabel: 'Bỏ lọc', action: 'clear' }) + '</div>';
    }
    cx.teams.forEach(function (t) {
      var list = cx.byTeam[t.id];
      html += teamRowHtml(t, list, cx);
      var hidden = V.collapsed[t.id] ? ' hidden' : '';
      list.forEach(function (r) {
        html += '<div class="ro-row ro-prow' + (r.me ? ' is-me' : '') + '" role="row" data-staff="' + r.s.id + '" data-team="' + t.id + '" data-r="' + ri + '"' + hidden + '>' + personHtml(r, cx);
        cx.days.forEach(function (d, di) { html += cellHtml(r, ri, d, di, cx); });
        html += '</div>';
        ri++;
      });
    });
    if (cx.rows.length) html += footHtml(cx);
    grid.innerHTML = html;
    return grid;
  }
  function buildLayer(cx, anim) {
    var layer = U.el('div', { class: 'ro-layer' });
    var scroll = U.el('div', { class: 'ro-scroll', tabindex: '-1' });
    var grid = buildGrid(cx, anim);
    scroll.appendChild(grid); layer.appendChild(scroll);
    layer._grid = grid; layer._scroll = scroll;
    return layer;
  }
  function animateCoverage(grid) {
    var bars = U.qsa('.ro-cov__bar', grid);
    if (reduce()) { bars.forEach(function (b) { b.style.transform = 'scaleX(' + b.dataset.ratio + ')'; }); return; }
    requestAnimationFrame(function () { requestAnimationFrame(function () { bars.forEach(function (b) { b.style.transform = 'scaleX(' + b.dataset.ratio + ')'; }); }); });
  }
  /** Sau khi dựng lưới: roving tabindex, chọn vùng, khôi phục focus, ghost đang chờ. */
  function afterBuild(grid, opts) {
    opts = opts || {};
    V.grid = grid;
    var cells = U.qsa('.ro-cell', grid);
    if (!cells.length) return;
    var target = null;
    if (V.focusKey) { var p = V.focusKey.split('|'); target = grid.querySelector('.ro-cell[data-staff="' + p[0] + '"][data-iso="' + p[1] + '"]'); }
    if (!target) target = grid.querySelector('.ro-prow.is-me .ro-cell.is-today') || grid.querySelector('.ro-prow.is-me .ro-cell') || cells[0];
    target.tabIndex = 0; V.focusKey = cellKey(target.dataset.staff, target.dataset.iso);
    if (opts.restoreFocus) { try { target.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
    applySelection();
    settlePending(grid);
  }

  /* ---------------------------------------------------------- selection */
  function applySelection() {
    if (!V.grid) return;
    var sel = V.sel, cells = U.qsa('.ro-cell', V.grid), count = 0;
    var a = sel && V.grid.querySelector('.ro-cell[data-staff="' + sel.anchor.staffId + '"][data-iso="' + sel.anchor.iso + '"]');
    var b = sel && V.grid.querySelector('.ro-cell[data-staff="' + sel.focus.staffId + '"][data-iso="' + sel.focus.iso + '"]');
    if (sel && (!a || !b)) { V.sel = null; sel = null; }
    var r0, r1, c0, c1;
    if (sel) { r0 = Math.min(+a.dataset.r, +b.dataset.r); r1 = Math.max(+a.dataset.r, +b.dataset.r); c0 = Math.min(+a.dataset.c, +b.dataset.c); c1 = Math.max(+a.dataset.c, +b.dataset.c); }
    cells.forEach(function (c) {
      var on = !!sel && +c.dataset.r >= r0 && +c.dataset.r <= r1 && +c.dataset.c >= c0 && +c.dataset.c <= c1 && !c.parentElement.hidden;
      if (on) count++;
      if (c.classList.contains('is-selected') !== on) { c.classList.toggle('is-selected', on); c.setAttribute('aria-selected', on ? 'true' : 'false'); }
    });
    V.selCount = count;
    syncPalette();
  }
  function selectedOps(typeId) {
    var ops = [];
    U.qsa('.ro-cell.is-selected', V.grid).forEach(function (c) { ops.push({ staffId: c.dataset.staff, iso: c.dataset.iso, to: typeId }); });
    return ops;
  }
  function clearSelection() { if (!V.sel) return; V.sel = null; applySelection(); }

  /* ------------------------------------------------------------- undo */
  function runOps(ops) {
    var st = S();
    V.suppress = true;
    try {
      var byStaff = U.groupBy(ops, 'staffId');
      Object.keys(byStaff).forEach(function (sid) {
        var list = U.sortBy(byStaff[sid], 'iso'), i = 0;
        while (i < list.length) {
          var j = i;
          while (j + 1 < list.length && list[j + 1].to === list[i].to && U.daysBetween(list[j].iso, list[j + 1].iso) === 1) j++;
          if (j > i) st.setShiftRange(sid, list[i].iso, list[j].iso, list[i].to); else st.setShift(sid, list[i].iso, list[i].to);
          i = j + 1;
        }
      });
    } finally { V.suppress = false; }
    refresh({ keepFocus: true });
  }
  /** Áp một lô thay đổi + đẩy vào ngăn xếp hoàn tác. ops: [{staffId, iso, to}] */
  function applyBatch(label, ops, opts) {
    opts = opts || {};
    var st = S(), real = [], skipped = 0;
    ops.forEach(function (o) {
      if (isLocked(o.staffId, o.iso)) { skipped++; return; }
      var prev = st.shiftOf(o.staffId, o.iso);
      if (prev === o.to) return;
      real.push({ staffId: o.staffId, iso: o.iso, prev: prev, to: o.to });
    });
    if (!real.length) {
      if (skipped) UI.toast('Ô nghỉ phép đã duyệt — không thể sửa trực tiếp', { kind: 'warning' });
      else if (!opts.silent) UI.toast('Không có gì thay đổi', { kind: 'info' });
      return 0;
    }
    var batch = { label: label, ops: real, at: Date.now() };
    runOps(real.map(function (o) { return { staffId: o.staffId, iso: o.iso, to: o.to }; }));
    V.undo.push(batch); if (V.undo.length > 60) V.undo.shift();
    if (!opts.silent) {
      var msg = opts.message || (label + ' · ' + real.length + ' ô');
      if (skipped) msg += ' · bỏ qua ' + skipped + ' ô nghỉ phép đã duyệt';
      UI.toast(msg, { kind: opts.kind || 'success', title: opts.title, action: { label: 'Hoàn tác', onClick: function () { undoBatch(batch); } } });
    }
    return real.length;
  }
  function undoBatch(batch) {
    if (!V) return;
    if (batch.undone) { UI.toast('Thay đổi này đã được hoàn tác trước đó', { kind: 'info' }); return; }
    batch.undone = true;
    var i = V.undo.indexOf(batch); if (i >= 0) V.undo.splice(i, 1);
    runOps(batch.ops.map(function (o) { return { staffId: o.staffId, iso: o.iso, to: o.prev }; }));
    UI.toast('Đã hoàn tác: ' + batch.label, { kind: 'info' });
  }
  function undoLast() {
    if (!V) return;
    if (!V.undo.length) { UI.toast('Không có thay đổi nào để hoàn tác', { kind: 'info' }); return; }
    undoBatch(V.undo[V.undo.length - 1]);
  }

  /* ---------------------------------------------------- quick / picker */
  function setCells(typeId, cells, label) {
    var t = S().shiftType(typeId);
    var ops = cells.map(function (c) { return { staffId: c.dataset.staff, iso: c.dataset.iso, to: typeId }; });
    if (ops.length === 1) {
      var st = S().staff(ops[0].staffId), d = U.fmtDate(ops[0].iso, 'shortWeekday');
      return applyBatch(label || (d + ' · ' + U.shortName(st.name) + ' → ' + t.label), ops, { message: d + ' của ' + U.shortName(st.name) + ' → ' + t.label });
    }
    return applyBatch(label || ('Xếp ' + t.label + ' cho vùng chọn'), ops, { message: 'Đã xếp ' + t.label + ' cho ' + ops.length + ' ô' });
  }
  function quick(cell, typeId) {
    var cells = V.sel && V.selCount ? U.qsa('.ro-cell.is-selected', V.grid) : [cell];
    var n = setCells(typeId, cells);
    if (n && V.sel) clearSelection();
  }
  function openPicker(cell) {
    var staffId = cell.dataset.staff, iso = cell.dataset.iso, st = S();
    if (isLocked(staffId, iso)) { UI.toast('Ngày này là nghỉ phép đã duyệt — hãy xử lý trong mục Yêu cầu', { kind: 'warning', action: { label: 'Mở yêu cầu', onClick: function () { location.hash = '#/requests'; } } }); return; }
    var days = U.weekDays(U.fromISO(iso)), prevWeek = days.slice(0, 5).map(function (d) { var k = U.toISO(d); return { staffId: staffId, iso: k, prev: st.shiftOf(staffId, k) }; });
    var prevOne = st.shiftOf(staffId, iso);
    V.focusKey = cellKey(staffId, iso);
    var pop = E().shiftPicker(cell, staffId, iso, {
      placement: 'bottom-start',
      onPick: function (type) {
        if (!V) return;
        var week = false; try { week = !!(pop && pop.el && pop.el.querySelector('.apply-week') && pop.el.querySelector('.apply-week').checked); } catch (e) { /* noop */ }
        var ops = week ? prevWeek.filter(function (o) { return o.prev !== type; }).map(function (o) { return { staffId: o.staffId, iso: o.iso, prev: o.prev, to: type }; }) : (prevOne !== type ? [{ staffId: staffId, iso: iso, prev: prevOne, to: type }] : []);
        if (ops.length) { V.undo.push({ label: (week ? 'Cả tuần của ' : U.fmtDate(iso, 'shortWeekday') + ' của ') + U.shortName(st.staff(staffId).name) + ' → ' + st.shiftType(type).label, ops: ops, at: Date.now() }); }
        // Store đã vẽ lại lưới (ô cũ + anchor đã tách khỏi DOM) nên popover không trả focus được → tự đưa focus về ô mới
        setTimeout(function () {
          if (!V || !V.grid) return;
          var c = V.grid.querySelector('.ro-cell[data-staff="' + staffId + '"][data-iso="' + iso + '"]');
          if (c && !V.grid.contains(document.activeElement)) focusCell(c, { noScroll: true });
        }, 0);
      }
    });
  }

  /* --------------------------------------------------------- key nav */
  function visibleRows() { return U.qsa('.ro-prow:not([hidden])', V.grid); }
  function focusCell(cell, opts) {
    if (!cell) return;
    var prev = V.grid.querySelector('.ro-cell[tabindex="0"]'); if (prev && prev !== cell) prev.tabIndex = -1;
    cell.tabIndex = 0; V.focusKey = cellKey(cell.dataset.staff, cell.dataset.iso);
    cell.focus({ preventScroll: true });
    if (!(opts && opts.noScroll)) cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function moveFocus(cell, dr, dc, extend, edge) {
    var rows = visibleRows(), row = cell.parentElement, ri = rows.indexOf(row), c = +cell.dataset.c, n = V.cx.days.length;
    if (edge === 'home') c = 0; else if (edge === 'end') c = n - 1; else c = U.clamp(c + dc, 0, n - 1);
    ri = U.clamp(ri + dr, 0, rows.length - 1);
    var target = rows[ri] && rows[ri].querySelector('.ro-cell[data-c="' + c + '"]');
    if (!target) return;
    if (extend) { V.sel = { anchor: V.sel ? V.sel.anchor : { staffId: cell.dataset.staff, iso: cell.dataset.iso }, focus: { staffId: target.dataset.staff, iso: target.dataset.iso } }; applySelection(); }
    else if (V.sel) clearSelection();
    focusCell(target);
  }

  /* --------------------------------------------------------- pointer */
  function bindPointer(root) {
    var d = null;
    function cellAt(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.ro-cell') : null; }
    function autoScroll() {
      var sc = V.layer && V.layer._scroll; if (!sc) return;
      var r = sc.getBoundingClientRect();
      if (d.y < r.top + 90 && sc.scrollTop > 0) sc.scrollTop -= 8; else if (d.y > r.bottom - 36) sc.scrollTop += 8;
      if (d.x < r.left + 240 && sc.scrollLeft > 0 && d.x > r.left) sc.scrollLeft -= 8; else if (d.x > r.right - 36) sc.scrollLeft += 8;
    }
    function paintCell(cell) {
      if (!cell || cell.classList.contains('is-locked')) { if (cell) d.lockedHit = true; return; }
      var key = cellKey(cell.dataset.staff, cell.dataset.iso);
      if (d.painted[key]) return;
      d.painted[key] = { cell: cell, prev: cell.dataset.shift };
      d.order.push(key);
      if (cell.dataset.shift !== d.type) { cell.dataset.shift = d.type; cell.innerHTML = chipHtml(d.type); }
      cell.classList.add('is-painting');
    }
    function tick() {
      if (!d || !d.active) return;
      autoScroll();
      if (d.mode === 'paint') { paintCell(cellAt(d.x, d.y)); }
      else {
        var t = reduce() ? 1 : 0.4;
        d.cx = U.lerp(d.cx, d.x - d.gx, t); d.cy = U.lerp(d.cy, d.y - d.gy, t);
        d.ghost.style.transform = 'translate3d(' + d.cx.toFixed(1) + 'px,' + d.cy.toFixed(1) + 'px,0)' + (reduce() ? '' : ' rotate(1.5deg) scale(1.03)');
        var over = cellAt(d.x, d.y);
        if (over !== d.over) {
          if (d.over) d.over.classList.remove('drop-ok', 'drop-bad');
          d.over = over;
          if (over && over !== d.cell) over.classList.add(over.classList.contains('is-locked') ? 'drop-bad' : 'drop-ok');
        }
      }
      d.raf = requestAnimationFrame(tick);
    }
    function start() {
      d.active = true;
      try { root.setPointerCapture(d.id); } catch (err) { /* noop */ }
      document.body.classList.add('ro-dragging');
      if (d.mode === 'paint') { d.painted = {}; d.order = []; d.type = V.paint; paintCell(d.cell); }
      else {
        var chip = d.cell.querySelector('.ro-chip'), r = chip.getBoundingClientRect();
        d.w = r.width; d.h = r.height; d.gx = d.x0 - r.left; d.gy = d.y0 - r.top; d.cx = r.left; d.cy = r.top;
        d.layerEl = U.el('div', { class: 'drag-layer' });
        d.ghost = chip.cloneNode(true); d.ghost.classList.add('ro-ghost', 'drag-ghost');
        d.ghost.style.cssText = 'width:' + r.width + 'px;height:' + r.height + 'px;transform:translate3d(' + r.left + 'px,' + r.top + 'px,0)';
        d.layerEl.appendChild(d.ghost); document.body.appendChild(d.layerEl);
        d.cell.classList.add('is-dragging'); d.over = null;
      }
      d.raf = requestAnimationFrame(tick);
    }
    function settle(dd, toEl, done) {
      var g = dd.ghost, finish = function () { if (dd.layerEl.parentNode) dd.layerEl.remove(); done && done(); };
      if (!g || reduce()) { finish(); return; }
      var r = toEl.getBoundingClientRect();
      g.classList.add('is-settle');
      g.style.transform = 'translate3d(' + r.left.toFixed(1) + 'px,' + r.top.toFixed(1) + 'px,0) rotate(0deg) scale(1)';
      U.onceTransitionEnd(g, finish, 320);
    }
    function shakeCell(cell) { if (!cell || reduce()) return; cell.classList.remove('shake'); void cell.offsetWidth; cell.classList.add('shake'); setTimeout(function () { cell.classList.remove('shake'); }, 300); }
    function end(cancel) {
      var dd = d; d = null;
      cancelAnimationFrame(dd.raf); document.body.classList.remove('ro-dragging');
      try { root.releasePointerCapture(dd.id); } catch (err) { /* noop */ }
      V.justDragged = true; setTimeout(function () { if (V) V.justDragged = false; }, 0);
      if (dd.mode === 'paint') {
        var ops = [];
        dd.order.forEach(function (k) { var p = dd.painted[k]; p.cell.classList.remove('is-painting'); if (p.prev !== dd.type) ops.push({ staffId: p.cell.dataset.staff, iso: p.cell.dataset.iso, to: dd.type }); });
        if (cancel || !ops.length) {
          dd.order.forEach(function (k) { var p = dd.painted[k]; if (p.cell.dataset.shift !== p.prev) { p.cell.dataset.shift = p.prev; p.cell.innerHTML = chipHtml(p.prev); } });
          if (!cancel && dd.lockedHit) UI.toast('Ô nghỉ phép đã duyệt không thể tô', { kind: 'warning' });
          return;
        }
        var t = S().shiftType(dd.type);
        applyBatch('Tô ' + t.label, ops, { message: 'Đã tô ' + t.label + ' cho ' + ops.length + ' ô' + (dd.lockedHit ? ' · bỏ qua ô nghỉ phép đã duyệt' : '') });
        return;
      }
      var from = dd.cell, to = dd.over;
      if (to) to.classList.remove('drop-ok', 'drop-bad');
      var bad = cancel || !to || to === from || to.classList.contains('is-locked') || from.classList.contains('is-locked');
      if (bad) {
        if (!cancel) shakeCell(to && to !== from ? to : from);
        if (!cancel && to && to !== from && (to.classList.contains('is-locked') || from.classList.contains('is-locked'))) UI.toast('Không đổi được với ô nghỉ phép đã duyệt', { kind: 'warning' });
        settle(dd, from, function () { from.classList.remove('is-dragging'); });
        return;
      }
      var a = { staffId: from.dataset.staff, iso: from.dataset.iso, type: from.dataset.shift }, b = { staffId: to.dataset.staff, iso: to.dataset.iso, type: to.dataset.shift };
      if (a.type === b.type) { settle(dd, to, function () { from.classList.remove('is-dragging'); }); UI.toast('Hai ô đang cùng ca ' + S().shiftType(a.type).label, { kind: 'info' }); return; }
      V.pending = { staffId: b.staffId, iso: b.iso, ghost: dd.ghost, layerEl: dd.layerEl, settle: settle, dd: dd };
      var sa = S().staff(a.staffId), sb = S().staff(b.staffId);
      var who = a.staffId === b.staffId ? U.shortName(sa.name) : U.shortName(sa.name) + ' ↔ ' + U.shortName(sb.name);
      var msg = 'Đã đổi ca ' + U.fmtDate(a.iso, 'shortWeekday') + ' ↔ ' + U.fmtDate(b.iso, 'shortWeekday') + ' · ' + who;
      applyBatch('Đổi ca ' + who, [{ staffId: a.staffId, iso: a.iso, to: b.type }, { staffId: b.staffId, iso: b.iso, to: a.type }], { message: msg });
      if (V.pending) { V.pending = null; dd.layerEl.remove(); }
    }
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || d || !V.grid) return;
      if (V.slide) return;
      var cell = e.target.closest('.ro-cell'); if (!cell || !V.grid.contains(cell)) return;
      if (e.shiftKey) { var cur = V.grid.querySelector('.ro-cell[tabindex="0"]'); V.shiftAnchor = V.sel ? V.sel.anchor : (cur ? { staffId: cur.dataset.staff, iso: cur.dataset.iso } : null); e.preventDefault(); return; }
      if (V.paint) { d = { mode: 'paint', cell: cell, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, active: false }; start(); e.preventDefault(); return; }
      if (e.pointerType === 'touch' || cell.classList.contains('is-locked')) return;
      d = { mode: 'drag', cell: cell, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
    });
    root.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      d.x = e.clientX; d.y = e.clientY;
      if (!d.active) { if (Math.abs(d.x - d.x0) < 4 && Math.abs(d.y - d.y0) < 4) return; start(); }
    });
    root.addEventListener('pointerup', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) end(false); else d = null; });
    root.addEventListener('pointercancel', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) end(true); else d = null; });
    root.addEventListener('click', function (e) { if (V && V.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    return { cancel: function () { if (d && d.active) end(true); else d = null; }, isActive: function () { return !!(d && d.active); } };
  }
  function settlePending(grid) {
    if (!V.pending) return;
    var p = V.pending; V.pending = null;
    var cell = grid.querySelector('.ro-cell[data-staff="' + p.staffId + '"][data-iso="' + p.iso + '"]');
    if (!cell) { p.layerEl.remove(); return; }
    var chip = cell.querySelector('.ro-chip'); if (chip) chip.classList.add('is-settling');
    p.settle(p.dd, cell, function () {
      if (chip) chip.classList.remove('is-settling');
      if (!reduce()) { cell.classList.add('cell-flash'); setTimeout(function () { cell.classList.remove('cell-flash'); }, 480); }
    });
  }

  /* ------------------------------------------------------------ paint */
  function setPaint(typeId) {
    V.paint = typeId || null;
    if (V.grid) V.grid.classList.toggle('is-paint', !!V.paint);
    if (V.paint && V.sel) clearSelection();
    syncPalette();
  }
  function buildPalette() {
    var pal = U.el('div', { class: 'ro-palette reveal', style: '--i:3', role: 'toolbar', 'aria-label': 'Bảng tô ca' });
    pal.innerHTML = '<span class="ro-palette__lbl eyebrow">Tô ca</span><div class="ro-palette__chips">' + D.SHIFT_TYPES.map(function (t) {
      return '<button type="button" class="shift shift--lg ro-pal" data-shift="' + t.id + '" data-paint="' + t.id + '" aria-pressed="false" data-tip="' + esc(t.label + (t.hours !== '—' ? ' · ' + t.hours : '') + ' · phím ' + QUICK_KEY[t.id].toUpperCase()) + '"><span class="shift__short">' + esc(t.short) + '</span><span class="shift__label">' + esc(t.label) + '</span></button>';
    }).join('') + '</div><span class="ro-palette__hint" aria-live="polite" hidden></span><button type="button" class="icon-btn icon-btn--sm ro-palette__exit" data-act="exit-paint" aria-label="Thoát (Esc)" data-tip="Thoát · Esc" hidden>' + UI.icon('x', 15) + '</button>';
    return pal;
  }
  function syncPalette() {
    var pal = V.palette; if (!pal) return;
    U.qsa('.ro-pal', pal).forEach(function (b) { var on = b.dataset.paint === V.paint; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var hint = pal.querySelector('.ro-palette__hint'), exit = pal.querySelector('.ro-palette__exit'), lbl = pal.querySelector('.ro-palette__lbl');
    var armed = !!V.paint, hasSel = !armed && !!(V.sel && V.selCount);
    pal.classList.toggle('is-armed', armed); pal.classList.toggle('has-sel', hasSel);
    if (armed) { hint.textContent = 'Kéo qua các ô để tô · Esc để thoát'; exit.setAttribute('aria-label', 'Thoát chế độ tô (Esc)'); exit.dataset.tip = 'Thoát · Esc'; }
    else if (hasSel) { hint.textContent = 'Đã chọn ' + V.selCount + ' ô · bấm một ca để xếp cả vùng'; exit.setAttribute('aria-label', 'Bỏ chọn (Esc)'); exit.dataset.tip = 'Bỏ chọn · Esc'; }
    hint.hidden = !(armed || hasSel); exit.hidden = !(armed || hasSel); lbl.hidden = armed || hasSel;
  }

  /* ------------------------------------------------------------- bar */
  function buildBar() {
    var st = S();
    var bar = U.el('div', { class: 'ro-bar reveal', style: '--i:0' });
    var teamChips = '<button type="button" class="chip chip--btn" data-team-filter="" aria-pressed="false">Tất cả</button>' + st.state.teams.map(function (t) {
      return '<button type="button" class="chip chip--btn chip--color ro-tchip" style="--chip:' + t.color + '" data-team-filter="' + t.id + '" aria-pressed="false" aria-label="' + esc('Team ' + t.name) + '" data-tip="' + esc(t.name + ' · ' + (t.desc || '')) + '"><i class="chip__dot"></i><span class="ro-tchip__name">' + esc(t.name) + '</span><span class="ro-tchip__short">' + esc(t.short) + '</span></button>';
    }).join('');
    bar.innerHTML =
      '<div class="ro-bar__row ro-bar__main">' +
        '<div class="ro-bar__nav">' +
          '<button type="button" class="btn btn--secondary btn--sm ro-today" data-act="today" data-tip="Về tuần này · T">Hôm nay</button>' +
          '<span class="ro-bar__arrows"><button type="button" class="icon-btn icon-btn--sm" data-act="prev" aria-label="Tuần trước (J)" data-tip="Tuần trước · J">' + UI.icon('chevron-left', 17) + '</button><button type="button" class="icon-btn icon-btn--sm" data-act="next" aria-label="Tuần sau (K)" data-tip="Tuần sau · K">' + UI.icon('chevron-right', 17) + '</button></span>' +
          '<h2 class="ro-title t-h2 tnum"><span class="ro-title__txt"></span></h2>' +
          '<span class="ro-status chip" hidden></span>' +
        '</div>' +
        '<div class="ro-bar__seg"></div>' +
        '<div class="ro-bar__actions">' +
          '<button type="button" class="btn btn--secondary ro-publish" data-act="publish">' + UI.icon('megaphone', 16) + '<span>Công bố lịch</span></button>' +
          '<button type="button" class="icon-btn" data-act="more" aria-label="Thao tác khác" aria-haspopup="menu" data-tip="Thao tác khác">' + UI.icon('more-horizontal', 18) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="ro-bar__row ro-bar__filters">' +
        '<div class="ro-fgroup" role="group" aria-label="Lọc theo team">' + teamChips + '</div>' +
        '<i class="ro-sep" aria-hidden="true"></i>' +
        '<div class="ro-fgroup" role="group" aria-label="Địa điểm"><button type="button" class="chip chip--btn" data-loc="HN" aria-pressed="false">' + UI.icon('map-pin', 12) + '<span>HN</span></button><button type="button" class="chip chip--btn" data-loc="HCM" aria-pressed="false">' + UI.icon('map-pin', 12) + '<span>HCM</span></button></div>' +
        '<label class="input-icon ro-search">' + UI.icon('search', 15) + '<input class="input ro-search__in" type="search" placeholder="Tìm tên, vai trò…" aria-label="Tìm nhân sự" autocomplete="off" spellcheck="false"></label>' +
      '</div>';
    var seg = UI.segmented([{ value: '7', label: '7 ngày' }, { value: '14', label: '14 ngày' }], String(V.range), function (v) { U.saveJSON(K.range, +v); go(Object.assign(current(), { range: +v })); }, { cls: 'ro-seg' });
    bar.querySelector('.ro-bar__seg').appendChild(seg);
    V.seg = seg;
    return bar;
  }
  function publishState(cx) {
    var rec = V.published[periodKey(V.iso, V.range)];
    if (!rec) return { state: 'draft', label: 'Nháp', tone: 'warn', icon: 'clock' };
    var same = rec.sig === signature(cx);
    var t = new Date(rec.time), when = U.pad(t.getHours()) + ':' + U.pad(t.getMinutes()) + (U.isToday(U.toISO(t)) ? '' : ' ' + U.fmtDate(t, 'dm'));
    return same ? { state: 'published', label: 'Đã công bố · ' + when, tone: 'ok', icon: 'check' } : { state: 'changed', label: 'Có thay đổi chưa công bố', tone: 'warn', icon: 'edit' };
  }
  function syncBar(cx) {
    var bar = V.bar;
    bar.querySelector('.ro-title__txt').textContent = periodTitle(V.iso, V.range);
    U.qsa('[data-team-filter]', bar).forEach(function (b) { var on = b.dataset.teamFilter === V.team; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    U.qsa('[data-loc]', bar).forEach(function (b) { var on = b.dataset.loc === V.loc; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var inp = bar.querySelector('.ro-search__in'); if (inp.value !== V.q && document.activeElement !== inp) inp.value = V.q;
    bar.querySelector('.ro-today').classList.toggle('is-current', cx.days.some(function (d) { return d.today; }));
    if (V.seg) { U.qsa('.segmented__btn', V.seg).forEach(function (b) { var on = b.dataset.value === String(V.range); b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }); V.seg.refresh(); }
    var ps = publishState(cx), stEl = bar.querySelector('.ro-status');
    stEl.hidden = false; stEl.className = 'ro-status chip chip--' + ps.tone; stEl.innerHTML = (ps.icon ? UI.icon(ps.icon, 12) : '') + '<span>' + esc(ps.label) + '</span>';
    var pub = bar.querySelector('.ro-publish'); pub.classList.toggle('btn--soft', ps.state !== 'published'); pub.classList.toggle('btn--secondary', ps.state === 'published');
    pub.querySelector('span').textContent = ps.state === 'published' ? 'Công bố lại' : 'Công bố lịch';
    var sub = periodTitle(V.iso, V.range) + ' · ' + cx.rows.length + (cx.filtered ? '/' + cx.allStaff.length : '') + ' người · ' + cx.teams.length + ' team';
    Z15.app.setTitle('Bảng ca', sub);
  }

  /* ------------------------------------------------------------ health */
  function nameList(rows, max) {
    var names = rows.map(function (r) { return '<button type="button" class="ro-health__who" data-staff-open="' + r.s.id + '">' + esc(U.shortName(r.s.name)) + '</button>'; });
    var shown = names.slice(0, max || 3); var rest = names.length - shown.length;
    return shown.join(', ') + (rest > 0 ? ' +' + rest : '');
  }
  function renderHealth(cx) {
    var h = cx.health, el = V.health, parts = [], issues = h.low.length + h.over.length + h.under.length;
    var holToday = cx.st.holidayName(cx.today), todayIn = cx.days.some(function (d) { return d.today; });
    if (!cx.rows.length) { el.hidden = true; return; }
    el.hidden = false;
    if (h.low.length) parts.push('<b>' + h.low.length + ' ngày thiếu người</b> (' + esc(h.low.slice(0, 3).map(function (d) { return U.fmtDate(d.d, 'shortWeekday'); }).join(', ')) + (h.low.length > 3 ? '…' : '') + ')');
    if (h.over.length) parts.push('<b class="ro-health__over">' + h.over.length + ' người > ' + OVER_H + 'g</b> (' + nameList(h.over) + ')');
    if (h.under.length) parts.push('<b>' + h.under.length + ' người dưới định mức</b> (' + nameList(h.under) + ')');
    var lead;
    if (issues) lead = '';
    else lead = '<b>' + esc(weekWord(V.iso, V.range).replace(/^t/, 'T')) + ' ổn.</b> Đủ người mọi ngày làm việc, không ai vượt ' + OVER_H + 'g.';
    var holNote = holToday && todayIn ? '<span class="ro-health__hol">' + UI.icon('flag', 13) + 'Hôm nay nghỉ lễ <b>' + esc(holToday) + '</b> — cả công ty nghỉ · ngày làm việc tiếp theo <b>' + esc(U.fmtDate(nextWorkday(cx.today), 'shortWeekday')) + '</b></span>' : '';
    el.className = 'ro-health banner' + (h.low.length || h.over.length ? ' banner--warn' : issues ? ' ro-health--soft' : ' ro-health--ok');
    el.innerHTML = UI.icon(h.low.length || h.over.length ? 'alert-triangle' : 'activity', 16) +
      '<div class="ro-health__txt"><span>' + lead + parts.join(' · ') + '</span>' + holNote + '</div>' +
      (h.low.length ? '<button type="button" class="btn btn--secondary btn--sm ro-health__btn" data-act="suggest">' + UI.icon('sparkles', 14) + 'Tự gợi ý lấp ca</button>' : '');
  }

  /* ------------------------------------------------------- suggestions */
  function buildSuggestions(cx) {
    var out = [], st = cx.st;
    cx.health.low.forEach(function (d) {
      var i = d.i, c = cx.cov[i], needed = Math.max(1, Math.ceil(COV_WARN * c.total) - c.on);
      var absent = {}; cx.rows.forEach(function (r) { if (r.shifts[i] === 'leave' || r.shifts[i] === 'off') absent[r.s.teamId] = (absent[r.s.teamId] || 0) + 1; });
      var cands = cx.rows.filter(function (r) { return (r.shifts[i] === 'off' || r.shifts[i] === 'remote') && !r.locked[i] && st.weekHours(r.s.id, d.iso) < QUOTA_H; })
        .map(function (r) { return { r: r, score: (absent[r.s.teamId] || 0) * 100 - st.weekHours(r.s.id, d.iso) + (r.shifts[i] === 'off' ? 10 : 0) }; })
        .sort(function (a, b) { return b.score - a.score; });
      cands.slice(0, needed).forEach(function (x) {
        var teamName = x.r.team ? x.r.team.name : '';
        out.push({ staffId: x.r.s.id, iso: d.iso, from: x.r.shifts[i], to: 'full', d: d, r: x.r, reason: (absent[x.r.s.teamId] ? 'Team ' + teamName + ' vắng ' + absent[x.r.s.teamId] + ' người' : 'Cả ngày chỉ ' + c.on + '/' + c.total + ' người') + ' · đang ' + hoursLabel(st.weekHours(x.r.s.id, d.iso)) + '/tuần' });
      });
    });
    return out;
  }
  function openSuggestions() {
    var cx = V.cx, list = buildSuggestions(cx), st = cx.st;
    var body;
    if (!list.length) body = UI.empty({ icon: 'coffee', title: 'Không tìm được ai phù hợp', body: cx.health.low.length ? 'Mọi người cùng team đều đã đủ 40g hoặc đang nghỉ phép.' : 'Mọi ngày làm việc trong kỳ đều đủ người.' });
    else body = '<p class="ro-sug__intro">Gợi ý dựa trên quy tắc: cùng team với người vắng, đang nghỉ hoặc làm từ xa hôm đó, chưa đủ 40g/tuần. Bỏ tick những dòng bạn không muốn áp dụng.</p><div class="ro-sug">' + list.map(function (x, i) {
      return '<label class="ro-sug__row"><input type="checkbox" class="ro-sug__chk" data-i="' + i + '" checked>' + UI.avatar(x.r.s, { size: 'sm', title: false }) + '<span class="ro-sug__txt"><b>' + esc(U.shortName(x.r.s.name)) + '</b><small>' + esc(x.reason) + '</small></span><span class="ro-sug__day mono-sm tnum">' + esc(U.fmtDate(x.d.d, 'shortWeekday')) + '</span><span class="ro-sug__diff">' + UI.shiftBadge(x.from) + UI.icon('arrow-right', 14) + UI.shiftBadge(x.to) + '</span></label>';
    }).join('') + '</div>';
    var modal = UI.modal({
      title: 'Tự gợi ý lấp ca', subtitle: cx.health.low.length ? cx.health.low.length + ' ngày thiếu người trong ' + weekWord(V.iso, V.range) : 'Kỳ này đủ người', size: 'md', content: body,
      actions: list.length ? [{ label: 'Huỷ', kind: 'ghost' }, { label: 'Áp dụng ' + list.length + ' gợi ý', kind: 'primary', icon: 'check', keep: true, onClick: function (close) {
        var picked = U.qsa('.ro-sug__chk:checked', modal.body).map(function (c) { return list[+c.dataset.i]; });
        if (!picked.length) { UI.toast('Chọn ít nhất một gợi ý', { kind: 'warning' }); return; }
        close();
        applyBatch('Gợi ý lấp ca', picked.map(function (x) { return { staffId: x.staffId, iso: x.iso, to: x.to }; }), { message: 'Đã áp dụng ' + picked.length + ' gợi ý lấp ca' });
      } }] : [{ label: 'Đóng', kind: 'primary' }]
    });
    if (list.length) modal.body.addEventListener('change', function () { var n = U.qsa('.ro-sug__chk:checked', modal.body).length; var b = modal.el.querySelector('.modal__foot .btn--primary span'); if (b) b.textContent = 'Áp dụng ' + n + ' gợi ý'; });
  }

  /* ------------------------------------------------------------ actions */
  function copyLastWeek() {
    var cx = V.cx, st = cx.st, srcStart = U.addDays(cx.start, -7);
    var wk = weekWord(V.iso, V.range), src = 'tuần ' + U.isoWeek(srcStart);
    UI.confirm({ title: 'Sao chép ca ' + src + ' sang ' + wk + '?', message: 'Ca của ' + cx.rows.length + ' người đang hiển thị sẽ được chép từ ' + src + ' (' + U.fmtDate(srcStart, 'dm') + ' – ' + U.fmtDate(U.addDays(srcStart, 6), 'dm') + '). Ca hiện tại trong kỳ sẽ bị ghi đè, trừ ngày lễ và nghỉ phép đã duyệt. Bạn có thể hoàn tác.', confirmLabel: 'Sao chép', icon: 'copy' }).then(function (ok) {
      if (!ok || !V) return;
      var ops = [];
      cx.rows.forEach(function (r) {
        cx.days.forEach(function (d, i) {
          if (d.holiday) return;
          var from = U.toISO(U.addDays(srcStart, i % 7));
          ops.push({ staffId: r.s.id, iso: d.iso, to: st.shiftOf(r.s.id, from) });
        });
      });
      applyBatch('Sao chép ' + src, ops, { message: 'Đã chép ca ' + src + ' → ' + wk });
    });
  }
  function rosterText(cx) {
    var st = cx.st, lines = ['BẢNG CA ' + periodTitle(V.iso, V.range).toUpperCase() + ' · Z15 MIRACLE'];
    cx.teams.forEach(function (t) {
      lines.push(''); lines.push('— ' + t.name + ' —');
      cx.byTeam[t.id].forEach(function (r) { lines.push(r.s.name + ': ' + cx.days.map(function (d, i) { return U.weekdayShort(d.d) + ' ' + st.shiftType(r.shifts[i]).short; }).join(' · ')); });
    });
    lines.push(''); lines.push('Ký hiệu: F hành chính · S sáng · C chiều · WFH từ xa · Q quay/on-site · OT tăng ca · N nghỉ phép · — không xếp ca');
    return lines.join('\n');
  }
  function copyText() {
    var cx = V.cx;
    U.copyToClipboard(rosterText(cx)).then(function () { UI.toast('Đã sao chép bảng ca ' + cx.rows.length + ' người dạng văn bản — dán vào Zalo hoặc Slack', { kind: 'success' }); }, function () { UI.toast('Không sao chép được — trình duyệt chặn clipboard', { kind: 'warning' }); });
  }
  function toggleAllTeams(collapse) {
    V.cx.teams.forEach(function (t) { if (collapse) V.collapsed[t.id] = true; else delete V.collapsed[t.id]; });
    U.saveJSON(K.collapsed, V.collapsed); refresh({ keepFocus: true });
  }
  function openMore(anchor) {
    var anyCollapsed = V.cx.teams.some(function (t) { return V.collapsed[t.id]; });
    UI.menu(anchor, [
      { label: 'Sao chép tuần trước', icon: 'copy', onClick: copyLastWeek },
      { label: 'Sao chép dạng văn bản', icon: 'message', hint: 'Zalo', onClick: copyText },
      { divider: true },
      { label: anyCollapsed ? 'Mở rộng tất cả team' : 'Thu gọn tất cả team', icon: anyCollapsed ? 'chevrons-right' : 'chevrons-left', onClick: function () { toggleAllTeams(!anyCollapsed); } },
      { label: 'Hoàn tác thay đổi cuối', icon: 'history', hint: '⌘Z', disabled: !V.undo.length, onClick: undoLast },
      { divider: true },
      { label: 'In bảng ca', icon: 'printer', onClick: function () { setTimeout(function () { window.print(); }, 120); } }
    ], { placement: 'bottom-end' });
  }
  function publish() {
    var cx = V.cx, n = cx.rows.length, wk = weekWord(V.iso, V.range), key = periodKey(V.iso, V.range);
    if (!n) { UI.toast('Không có ai trong bộ lọc để công bố', { kind: 'warning' }); return; }
    UI.confirm({ title: 'Công bố lịch ' + wk + '?', message: 'Bảng ca ' + periodTitle(V.iso, V.range) + ' sẽ được gửi tới ' + n + ' người qua thông báo. Bạn vẫn có thể chỉnh sửa sau khi công bố — hệ thống sẽ ghi nhận thay đổi.', confirmLabel: 'Công bố', icon: 'megaphone' }).then(function (ok) {
      if (!ok || !V) return;
      var done = function () {
        if (!V) return;
        V.published[key] = { time: new Date().toISOString(), sig: signature(V.cx) };
        U.saveJSON(K.published, V.published);
        syncBar(V.cx);
        UI.toast('Đã công bố lịch ' + wk + ' tới ' + n + ' người', { kind: 'brand', action: { label: 'Xem thông báo', onClick: function () { var b = document.getElementById('bellBtn'); if (b) b.click(); } } });
        S().notify({ kind: 'brand', title: 'Lịch ' + wk + ' đã được công bố', body: U.shortName(cx.me.name) + ' đã công bố bảng ca ' + periodTitle(V.iso, V.range).split(' · ')[1] + ' cho ' + n + ' người. Mở Bảng ca để xem ca của bạn.', link: '#/roster/' + V.iso + '?range=' + V.range });
      };
      if (reduce() || !V.grid) { done(); return; }
      var btn = V.bar.querySelector('.ro-publish'), br = btn.getBoundingClientRect(), bx = br.left + br.width / 2, by = br.top + br.height / 2;
      var cells = U.qsa('.ro-cell', V.grid), rects = cells.map(function (c) { return c.getBoundingClientRect(); });
      requestAnimationFrame(function () {
        cells.forEach(function (c, i) {
          var r = rects[i], dist = Math.hypot(r.left + r.width / 2 - bx, r.top + r.height / 2 - by);
          c.style.setProperty('--wave-delay', Math.min(dist * 0.35, 600).toFixed(0) + 'ms'); c.classList.add('is-wave');
        });
      });
      V.timers.push(setTimeout(function () { if (V && V.grid) U.qsa('.ro-cell.is-wave', V.grid).forEach(function (c) { c.classList.remove('is-wave'); c.style.removeProperty('--wave-delay'); }); }, 1300));
      V.timers.push(setTimeout(done, 520));
    });
  }

  /* --------------------------------------------------------- transitions */
  function finishSlide() {
    if (!V || !V.slide) return;
    var sl = V.slide; V.slide = null; clearTimeout(sl.timer);
    sl.old.remove();
    sl.neu.classList.remove('is-anim', 'is-entering'); sl.neu.style.transform = ''; sl.neu.style.opacity = '';
  }
  function slideTo(dir, cx) {
    finishSlide();
    if (V.drag) V.drag.cancel();
    var old = V.layer, neu = buildLayer(cx, false), sgn = dir > 0 ? 1 : -1, rm = reduce();
    if (!rm) neu.style.transform = 'translateX(' + (24 * sgn) + 'px)';
    neu.style.opacity = '0'; neu.classList.add('is-entering');
    old.classList.add('is-leaving');
    if (old._scroll && neu._scroll) neu._scroll.scrollLeft = old._scroll.scrollLeft;
    V.body.appendChild(neu); V.layer = neu;
    afterBuild(neu._grid, {});
    if (old._scroll && neu._scroll) neu._scroll.scrollTop = old._scroll.scrollTop;
    void neu.offsetWidth;
    old.classList.add('is-anim'); neu.classList.add('is-anim');
    requestAnimationFrame(function () {
      neu.style.transform = ''; neu.style.opacity = '';
      old.style.opacity = '0'; if (!rm) old.style.transform = 'translateX(' + (-24 * sgn) + 'px)';
    });
    V.slide = { old: old, neu: neu, timer: setTimeout(finishSlide, rm ? 160 : 360) };
  }
  /** Vẽ lại tại chỗ (không animation) — dùng khi store đổi, lọc, thu gọn. */
  function refresh(opts) {
    opts = opts || {};
    if (!V || !V.body) return;
    finishSlide();
    var cx = V.cx = ctx();
    var old = V.layer, had = !!(old && old.contains(document.activeElement));
    var neu = buildLayer(cx, false);
    if (old && old._scroll) { neu._scroll.scrollLeft = old._scroll.scrollLeft; }
    V.body.replaceChildren(neu); V.layer = neu;
    if (old && old._scroll) neu._scroll.scrollTop = old._scroll.scrollTop;
    afterBuild(neu._grid, { restoreFocus: had || opts.keepFocus });
    syncBar(cx); renderHealth(cx);
  }

  /* -------------------------------------------------------------- route */
  function applyRoute(route, first) {
    var p = parseRoute(route), prevKey = V.key, prevStart = V.start;
    V.iso = p.iso; V.range = p.range; V.team = p.team; V.loc = p.loc; V.q = p.q;
    V.key = periodKey(p.iso, p.range); V.start = U.toISO(periodStart(p.iso));
    U.saveJSON(K.range, p.range); saveFilters();
    var cx = V.cx = ctx();
    if (first || !V.layer) {
      var layer = buildLayer(cx, true);
      V.body.appendChild(layer); V.layer = layer;
      afterBuild(layer._grid, {}); animateCoverage(layer._grid);
    } else if (V.key !== prevKey) { if (V.sel) V.sel = null; slideTo(V.start >= prevStart ? 1 : -1, cx); }
    else refresh({ keepFocus: false });
    syncBar(cx); renderHealth(cx); syncPalette();
  }
  function setFilters(patch) { Object.assign(V, patch); saveFilters(); go(current()); }
  function nav(dir) { go(Object.assign(current(), { iso: U.toISO(U.addDays(periodStart(V.iso), 7 * dir)) })); }
  function goToday() { go(Object.assign(current(), { iso: U.todayISO() })); }

  /* --------------------------------------------------------- bindings */
  function bindEvents(root) {
    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-act]'))) {
        var act = t.dataset.act;
        if (act === 'today') return goToday();
        if (act === 'prev') return nav(-1);
        if (act === 'next') return nav(1);
        if (act === 'publish') return publish();
        if (act === 'more') return void openMore(t);
        if (act === 'suggest') return openSuggestions();
        if (act === 'clear') { V.q = ''; return setFilters({ team: '', loc: '' }); }
        if (act === 'exit-paint') { if (V.paint) setPaint(null); else clearSelection(); return; }
      }
      if ((t = e.target.closest('.ro-empty [data-action="clear"]'))) { V.q = ''; return setFilters({ team: '', loc: '' }); }
      if ((t = e.target.closest('[data-team-filter]'))) return setFilters({ team: t.dataset.teamFilter });
      if ((t = e.target.closest('[data-loc]')) && t.classList.contains('chip--btn')) return setFilters({ loc: V.loc === t.dataset.loc ? '' : t.dataset.loc });
      if ((t = e.target.closest('[data-toggle-team]'))) {
        var id = t.dataset.toggleTeam;
        if (V.collapsed[id]) delete V.collapsed[id]; else V.collapsed[id] = true;
        U.saveJSON(K.collapsed, V.collapsed);
        var row = t.closest('.ro-trow'), open = !V.collapsed[id];
        row.classList.toggle('is-collapsed', !open); t.setAttribute('aria-expanded', open ? 'true' : 'false');
        U.qsa('.ro-prow[data-team="' + id + '"]', V.grid).forEach(function (r) { r.hidden = !open; });
        applySelection();
        return;
      }
      if ((t = e.target.closest('[data-paint]'))) {
        var type = t.dataset.paint;
        if (V.sel && V.selCount) { var n = setCells(type, U.qsa('.ro-cell.is-selected', V.grid)); if (n) clearSelection(); return; }
        setPaint(V.paint === type ? null : type);
        return;
      }
      if ((t = e.target.closest('[data-go-day]'))) return R().go('calendar/day/' + t.dataset.goDay);
      if ((t = e.target.closest('[data-staff-open]'))) { if (e.target.closest('.avatar[data-staff]')) return; return void E().staffProfile(t.dataset.staffOpen); }
      if ((t = e.target.closest('.ro-cell'))) {
        if (e.shiftKey) {
          e.preventDefault();
          var anchor = V.sel ? V.sel.anchor : (V.shiftAnchor || { staffId: t.dataset.staff, iso: t.dataset.iso });
          V.shiftAnchor = null;
          V.sel = { anchor: anchor, focus: { staffId: t.dataset.staff, iso: t.dataset.iso } };
          applySelection(); focusCell(t, { noScroll: true });
          return;
        }
        if (V.paint) return; // đã tô ở pointerup
        if (V.sel) clearSelection();
        focusCell(t, { noScroll: true }); openPicker(t);
      }
    });
    root.addEventListener('keydown', function (e) {
      var cell = e.target.closest && e.target.closest('.ro-cell');
      if (!cell) return;
      var k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'Home' || k === 'End') {
        e.preventDefault(); e.stopPropagation();
        if (k === 'Home') moveFocus(cell, e.ctrlKey ? -999 : 0, 0, e.shiftKey, 'home');
        else if (k === 'End') moveFocus(cell, e.ctrlKey ? 999 : 0, 0, e.shiftKey, 'end');
        else moveFocus(cell, k === 'ArrowDown' ? 1 : k === 'ArrowUp' ? -1 : 0, k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : 0, e.shiftKey);
        return;
      }
      if (k === 'Enter' || k === ' ') { e.preventDefault(); e.stopPropagation(); openPicker(cell); return; }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && k.length === 1 && QUICK[k.toLowerCase()]) { e.preventDefault(); e.stopPropagation(); quick(cell, QUICK[k.toLowerCase()]); }
    });
    root.addEventListener('focusin', function (e) {
      var cell = e.target.closest && e.target.closest('.ro-cell'); if (!cell || !V.grid) return;
      var prev = V.grid.querySelector('.ro-cell[tabindex="0"]'); if (prev && prev !== cell) prev.tabIndex = -1;
      cell.tabIndex = 0; V.focusKey = cellKey(cell.dataset.staff, cell.dataset.iso);
    });
    var inp = root.querySelector('.ro-search__in');
    var onSearch = U.debounce(function () {
      if (!V) return;
      var q = inp.value;
      if (q === V.q) return;
      V.q = q;
      var hash = '#/roster/' + V.iso + '?range=' + V.range + (V.team ? '&team=' + encodeURIComponent(V.team) : '') + (V.loc ? '&loc=' + V.loc : '') + (q ? '&q=' + encodeURIComponent(q) : '');
      // Đồng bộ router.current để app.js không coi lần bấm lại menu "Bảng ca" là hashchange rỗng (giống staff.js syncURL)
      try { history.replaceState(null, '', hash); if (Z15.router && Z15.router.parse) Z15.router.current = Z15.router.parse(hash); } catch (err) { /* noop */ }
      refresh({ keepFocus: false });
    }, 120);
    inp.addEventListener('input', onSearch);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (inp.value) { inp.value = ''; onSearch(); } else inp.blur(); e.stopPropagation(); } if (e.key === 'Enter') { e.preventDefault(); var c = V.grid && V.grid.querySelector('.ro-cell[tabindex="0"]'); if (c) focusCell(c); } });
  }

  /* ---------------------------------------------------------------- view */
  Z15.views.roster = {
    title: 'Bảng ca',
    render: function (container, route) {
      if (V) this.destroy();
      V = { root: null, bar: null, health: null, body: null, layer: null, grid: null, palette: null, cx: null, iso: null, range: 7, team: '', loc: '', q: '', key: null, start: null, collapsed: U.loadJSON(K.collapsed, {}) || {}, published: U.loadJSON(K.published, {}) || {}, undo: [], sel: null, selCount: 0, paint: null, focusKey: null, shiftAnchor: null, pending: null, slide: null, suppress: false, justDragged: false, unregs: [], timers: [] };
      var p = parseRoute(route); V.range = p.range;
      var root = U.el('div', { class: 'ro' });
      V.root = root;
      V.bar = buildBar();
      V.health = U.el('div', { class: 'ro-health banner reveal', style: '--i:1', role: 'status' }); V.health.hidden = true;
      V.body = U.el('div', { class: 'ro-body reveal', style: '--i:2' });
      V.palette = buildPalette();
      root.appendChild(V.bar); root.appendChild(V.health); root.appendChild(V.body); root.appendChild(V.palette);
      container.appendChild(root);
      bindEvents(root);
      V.drag = bindPointer(V.body);
      applyRoute(route, true);

      V.unregs = [
        UI.shortcuts.register('j', function () { nav(-1); }, 'Tuần trước', 'Bảng ca'),
        UI.shortcuts.register('k', function () { nav(1); }, 'Tuần sau', 'Bảng ca'),
        UI.shortcuts.register('mod+z', function () { if (!V || isTypingEl(document.activeElement)) return; undoLast(); }, 'Hoàn tác thay đổi ca', 'Bảng ca'),
        UI.shortcuts.register('p', function () { if (V) setPaint(V.paint ? null : 'full'); }, 'Bật / tắt chế độ tô ca', 'Bảng ca')
      ];
      UI.palette.register({ id: 'ro:publish', label: 'Bảng ca: công bố lịch tuần', icon: 'megaphone', section: 'Bảng ca', keywords: 'cong bo lich publish', run: publish });
      UI.palette.register({ id: 'ro:copy', label: 'Bảng ca: sao chép dạng văn bản (Zalo)', icon: 'message', section: 'Bảng ca', keywords: 'sao chep zalo text', run: copyText });
      UI.palette.register({ id: 'ro:suggest', label: 'Bảng ca: tự gợi ý lấp ca', icon: 'sparkles', section: 'Bảng ca', keywords: 'goi y lap ca thieu nguoi', run: openSuggestions });

      V.onKeyCapture = function (e) {
        if (!V) return;
        var typing = isTyping(e), mod = e.ctrlKey || e.metaKey;
        if (mod && (e.key === 'z' || e.key === 'Z') && typing) { e.stopPropagation(); return; } // giữ undo gốc trong ô nhập
        if (mod || e.altKey || typing) return;
        if (e.key === 'Escape') {
          if (hasLayer()) return;
          if (V.drag.isActive()) V.drag.cancel(); else if (V.paint) setPaint(null); else if (V.sel) clearSelection(); else return;
          e.preventDefault(); e.stopPropagation(); return;
        }
        if (hasLayer()) return;
        if (e.key === 't' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); goToday(); }
      };
      document.addEventListener('keydown', V.onKeyCapture, true);
      V.onResize = U.debounce(function () { if (V && V.seg) V.seg.refresh(); }, 150);
      window.addEventListener('resize', V.onResize);
      V.unsub = S().subscribe(function (state, meta) {
        if (!V || V.suppress) return;
        var t = meta && meta.type || '';
        if (/^shift:|^staff:|^reset$/.test(t) || t === 'request:status') refresh({ keepFocus: false });
      });
    },
    update: function (route) { if (!V) return; applyRoute(route, false); },
    destroy: function () {
      if (!V) return;
      var v = V; V = null;
      if (v.drag) v.drag.cancel();
      if (v.unsub) v.unsub();
      v.unregs.forEach(function (f) { try { f(); } catch (e) { /* noop */ } });
      ['ro:publish', 'ro:copy', 'ro:suggest'].forEach(UI.palette.unregister);
      document.removeEventListener('keydown', v.onKeyCapture, true);
      window.removeEventListener('resize', v.onResize);
      if (v.slide) clearTimeout(v.slide.timer);
      v.timers.forEach(clearTimeout);
      U.qsa('.drag-layer').forEach(function (n) { n.remove(); });
      document.body.classList.remove('ro-dragging');
    }
  };
  function isTypingEl(t) { return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)); }
})(window);
