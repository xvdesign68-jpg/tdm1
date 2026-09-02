/* =====================================================================
   Z15 Miracle · Lịch làm việc — views/calendar.js
   Lịch ngày / tuần / tháng / đội ngũ: lưới giờ, kéo-thả, now-line, bộ lọc,
   lớp lịch, so sánh người, xung đột, timeline đội ngũ, trượt tuần, morph.
   Route: #/calendar/{day|week|month}/{yyyy-mm-dd}?staff=&team=&mine=1&types=&compare=
          #/calendar/team/{yyyy-mm-dd}?team=<teamId>&people=<ids>&span=day|week
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  Z15.views = Z15.views || {};
  var U = Z15.utils, UI = Z15.ui, D = Z15.data, C = Z15.config;
  var S = function () { return Z15.store; };
  var E = function () { return Z15.editors; };
  var R = function () { return Z15.router; };
  var esc = U.escapeHtml;

  var PREF_FILTERS = 'z15.ui.calendar.filters', PREF_MODE = 'z15.ui.calendar.mode', PREF_LAYERS = 'z15.ui.calendar.layers', PREF_TEAM = 'z15.ui.calendar.team';
  var MODES = ['day', 'week', 'month', 'team'];
  var LAYERS = ['mine', 'team', 'all'];
  var SNAP = 15;
  var MAX_SLOTS = 3, MIN_SLOT_W = 44; // cột chồng giờ: tối đa 3 ô (2 sự kiện + “+N nữa”) khi mỗi ô < 44px
  var NARROW_MQ = '(max-width: 768px)';
  var CMP_HUES = ['#3B6EA8', '#B8497B', '#0F9B8E', '#C2782A'];
  var TL_START = 7 * 60, TL_END = 20 * 60, TL_SPAN = TL_END - TL_START; // timeline đội ngũ 07:00–20:00
  var SHIFT_SPAN = { full: [540, 1080], morning: [510, 750], afternoon: [810, 1080], remote: [540, 1080], onsite: [420, 1140], ot: [540, 1260] };
  var KIND_LABEL = { company: 'Công ty', exec: 'Ban điều hành', personal: 'Cá nhân', team: 'Team', project: 'Dự án', other: 'Khác' };

  /* ------------------------------------------------------------ helpers */
  function reduceMotion() { return U.prefersReducedMotion() || document.body.classList.contains('reduce-motion'); }
  function isNarrow() { return !!(window.matchMedia && window.matchMedia(NARROW_MQ).matches); }
  function hourH() { var v = parseFloat(getComputedStyle(document.body).getPropertyValue('--hour-h')); return v > 0 ? v : (C.hourHeight || 64); }
  function evStart(e) { return U.timeToMin(e.start); }
  function evEnd(e) { return Math.max(U.timeToMin(e.end), U.timeToMin(e.start)); }
  function snap(m) { return Math.round(m / SNAP) * SNAP; }
  function floorSnap(m) { return Math.floor(m / SNAP) * SNAP; }
  function validISO(s) { return U.validISO(s); }
  function nextWorkday(iso) {
    var d = U.addDays(U.fromISO(iso), 1);
    for (var i = 0; i < 14; i++, d = U.addDays(d, 1)) { var k = U.toISO(d); if (!U.isWeekend(d) && !S().holidayName(k)) return k; }
    return U.toISO(d);
  }
  function isMine(ev, me) { return ev.attendeeIds.indexOf(me.id) >= 0 || ev.ownerId === me.id; }
  function calId(ev) { return ev.calendarId || 'company'; }
  function pct(min) { return ((min - TL_START) / TL_SPAN * 100).toFixed(3); }

  /* ------------------------------------------------------------ prefs */
  function loadPrefs() {
    var p = U.loadJSON(PREF_FILTERS, null) || {};
    return { layer: LAYERS.indexOf(p.layer) >= 0 ? p.layer : 'all', teams: Array.isArray(p.teams) ? p.teams : [], types: Array.isArray(p.types) ? p.types : [] };
  }
  function savePrefs(F) { U.saveJSON(PREF_FILTERS, { layer: F.layer, teams: F.teams, types: F.types }); }
  function loadHidden() { var a = U.loadJSON(PREF_LAYERS, null), m = {}; (Array.isArray(a) ? a : []).forEach(function (id) { m[id] = true; }); return m; }
  function saveHidden(m) { U.saveJSON(PREF_LAYERS, Object.keys(m).filter(function (k) { return m[k]; })); }
  function loadTeamPrefs() { var p = U.loadJSON(PREF_TEAM, null) || {}; return { collapsed: Array.isArray(p.collapsed) ? p.collapsed : [], density: p.density === 'compact' ? 'compact' : 'comfortable', onlyBusy: !!p.onlyBusy, onlyConflict: !!p.onlyConflict }; }
  function teamPrefs() { if (!V.tp) V.tp = loadTeamPrefs(); return V.tp; }
  function saveTeamPrefs() { if (V && V.tp) U.saveJSON(PREF_TEAM, V.tp); }

  /* ------------------------------------------------------------ filters */
  function filtersFromRoute(route, mode) {
    var q = route.query || {}, p = loadPrefs(), st = S();
    var teamIds = st.state.teams.map(function (t) { return t.id; }), typeIds = D.EVENT_TYPES.map(function (t) { return t.id; });
    var ids = function (v) { return String(v || '').split(',').filter(function (id) { return !!st.staff(id); }); };
    var F = { layer: p.layer, teams: p.teams.filter(function (t) { return teamIds.indexOf(t) >= 0; }), types: p.types.filter(function (t) { return typeIds.indexOf(t) >= 0; }), staff: '', hidden: loadHidden(), compare: [], team: '', people: [], span: 'day' };
    if (q.mine === '1') F.layer = 'mine';
    else if (q.layer && LAYERS.indexOf(q.layer) >= 0) F.layer = q.layer;
    if (mode === 'team') {
      var t = String(q.team || '').split(',')[0]; if (t && teamIds.indexOf(t) >= 0) F.team = t;
      F.people = U.uniq(ids(q.people)); F.span = q.span === 'week' ? 'week' : 'day';
    } else if (q.team != null) F.teams = String(q.team).split(',').filter(function (t) { return teamIds.indexOf(t) >= 0; });
    if (q.types != null) F.types = String(q.types).split(',').filter(function (t) { return typeIds.indexOf(t) >= 0; });
    if (q.staff && st.staff(q.staff)) F.staff = q.staff;
    if (q.compare) F.compare = U.uniq(ids(q.compare)).slice(0, 4);
    return F;
  }
  function queryFor(F, mode) {
    var q = {};
    if (mode === 'team') { if (F.team) q.team = F.team; if (F.people.length) q.people = F.people.join(','); if (F.span === 'week') q.span = 'week'; if (F.types.length) q.types = F.types.join(','); return q; }
    if (F.layer === 'mine') q.mine = '1';
    if (F.teams.length) q.team = F.teams.join(',');
    if (F.types.length) q.types = F.types.join(',');
    if (F.staff) q.staff = F.staff;
    if (F.compare.length) q.compare = F.compare.join(',');
    return q;
  }
  /** Chuyển bộ lọc khi đổi chế độ: team chips ↔ team đội ngũ, so sánh ↔ người được chọn. */
  function translateF(F, from, to) {
    var G = Object.assign({}, F);
    if (to === 'team' && from !== 'team') { G.team = F.teams[0] || ''; G.people = F.compare.length ? F.compare.slice() : (F.staff ? [F.staff] : []); }
    if (from === 'team' && to !== 'team') { G.teams = F.team ? [F.team] : []; G.compare = F.people.length && F.people.length <= 4 ? F.people.slice() : []; G.staff = ''; }
    return G;
  }
  function hasFilter(F) { return F.layer !== 'all' || F.teams.length > 0 || F.types.length > 0 || !!F.staff || F.compare.length > 0; }
  function layerOk(ev, F) { return !F.hidden[calId(ev)]; }
  function passes(ev, F, cx) {
    if (!layerOk(ev, F)) return false;
    if (F.types.length && F.types.indexOf(ev.type) < 0) return false;
    if (F.teams.length && !ev.attendeeIds.some(function (id) { return F.teams.indexOf(cx.teamOf[id]) >= 0; })) return false;
    if (F.compare.length) return ev.attendeeIds.some(function (id) { return F.compare.indexOf(id) >= 0; });
    if (F.staff && ev.attendeeIds.indexOf(F.staff) < 0) return false;
    if (!F.staff) {
      if (F.layer === 'mine' && !isMine(ev, cx.me)) return false;
      if (F.layer === 'team' && !ev.attendeeIds.some(function (id) { return cx.teamOf[id] === cx.me.teamId; })) return false;
    }
    return true;
  }
  function teamFilterOk(ev, F) { return layerOk(ev, F) && (!F.types.length || F.types.indexOf(ev.type) >= 0); }

  /* -------------------------------------------------------------- route */
  function parseRoute(route) {
    var parts = route.parts || [];
    var mode = MODES.indexOf(parts[0]) >= 0 ? parts[0] : U.loadJSON(PREF_MODE, 'week');
    if (MODES.indexOf(mode) < 0) mode = 'week';
    var q = route.query || {};
    if (!parts[0] && mode === 'team' && (q.staff || q.compare || q.mine === '1')) mode = 'week'; // deep link "lịch của …" không có nghĩa trong chế độ đội ngũ
    var iso = validISO(parts[1]) ? parts[1] : U.todayISO();
    return { mode: mode, iso: iso, F: filtersFromRoute(route, mode) };
  }
  function go(mode, iso, F) { var G = V && V.mode && V.mode !== mode ? translateF(F, V.mode, mode) : F; R().go('calendar/' + mode + '/' + iso, queryFor(G, mode)); }
  /** Cập nhật query trên URL mà không đổi trang (giữ popover đang mở). */
  function silentRoute(F) {
    var q = queryFor(F, V.mode), qs = Object.keys(q).filter(function (k) { return q[k] != null && q[k] !== ''; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    var h = '#/calendar/' + V.mode + '/' + V.iso + (qs ? '?' + qs : '');
    try { history.replaceState(null, '', h); } catch (e) { location.hash = h; return; }
    var r = R().current; if (r) r.query = q;
  }
  function daysFor(mode, iso) {
    var d = U.fromISO(iso);
    if (mode === 'day') return [iso];
    if (mode === 'month') return U.monthGrid(d).map(U.toISO);
    if (mode === 'team' && V && V.F && V.F.span !== 'week') return [iso];
    if (mode === 'week' && isNarrow()) return [-1, 0, 1].map(function (n) { return U.toISO(U.addDays(d, n)); });
    var days = U.weekDays(d).map(U.toISO);
    if (S().state.settings.showWeekend === false) days = days.slice(0, 5);
    return days;
  }
  function periodKey(mode, iso) {
    if (mode === 'day') return 'd' + iso;
    if (mode === 'month') return 'm' + iso.slice(0, 7);
    if (mode === 'team') return V.F.span === 'week' ? 'tw' + U.toISO(U.startOfWeek(U.fromISO(iso))) : 'td' + iso;
    if (isNarrow()) return 'n' + iso;
    return 'w' + U.toISO(U.startOfWeek(U.fromISO(iso)));
  }
  function stepDate(mode, iso, dir) {
    var d = U.fromISO(iso);
    if (mode === 'day' || (mode === 'week' && isNarrow()) || (mode === 'team' && V.F.span !== 'week')) return U.toISO(U.addDays(d, dir));
    if (mode === 'week' || mode === 'team') return U.toISO(U.addDays(d, 7 * dir));
    var m = new Date(d.getFullYear(), d.getMonth() + dir, 1);
    m.setDate(Math.min(d.getDate(), U.endOfMonth(m).getDate()));
    return U.toISO(m);
  }
  function titleFor(mode, iso) {
    var d = U.fromISO(iso);
    if (mode === 'day' || (mode === 'team' && V.F.span !== 'week')) return U.weekdayLong(d) + ', ' + U.fmtDate(d);
    if (mode === 'month') return U.fmtDate(d, 'monthYear');
    if (mode === 'week' && isNarrow()) { var a = U.addDays(d, -1), b = U.addDays(d, 1); return U.fmtDate(a, 'dm') + ' – ' + U.fmtDate(b, 'dm') + '/' + b.getFullYear(); }
    var s = U.startOfWeek(d), e = U.endOfWeek(d);
    return 'Tuần ' + U.isoWeek(s) + ' · ' + U.fmtDate(s, 'dm') + ' – ' + U.fmtDate(e, 'dm') + '/' + e.getFullYear();
  }

  /* --------------------------------------------------------- data views */
  function ctx() {
    var st = S().state, me = S().me(), teamOf = {};
    st.staff.forEach(function (s) { teamOf[s.id] = s.teamId; });
    return { st: st, me: me, teamOf: teamOf, today: U.todayISO(), now: U.nowMinutes() };
  }
  function conflictSet(list) {
    var out = {}, timed = list.filter(function (e) { return !e.allDay && evEnd(e) > evStart(e); });
    for (var i = 0; i < timed.length; i++) for (var j = i + 1; j < timed.length; j++) {
      var a = timed[i], b = timed[j];
      if (!(evStart(a) < evEnd(b) && evStart(b) < evEnd(a))) continue;
      if (a.attendeeIds.some(function (id) { return b.attendeeIds.indexOf(id) >= 0; })) { out[a.id] = true; out[b.id] = true; }
    }
    return out;
  }
  function dayEvents(iso, F, cx) {
    var all = S().eventsOn(iso);
    return { all: all, vis: all.filter(function (e) { return passes(e, F, cx); }), conflicts: conflictSet(all) };
  }
  function conflictsFor(ev, iso, s, e, attendeeIds) {
    var out = [], ids = attendeeIds || ev.attendeeIds;
    S().eventsOn(iso).forEach(function (o) {
      if (o.id === ev.id || o.allDay) return;
      var os = evStart(o), oe = evEnd(o);
      if (!(os < e && s < oe)) return;
      var shared = o.attendeeIds.filter(function (id) { return ids.indexOf(id) >= 0; });
      if (shared.length) out.push({ ev: o, staff: shared });
    });
    return out;
  }
  function isUrgent(ev, cx) {
    var startMs = U.fromISO(ev.date).getTime() + evStart(ev) * 60000, diff = startMs - Date.now();
    return diff < 864e5 && (diff >= 0 || ev.date === cx.today);
  }
  function pillClasses(ev, cx, conflicts) {
    var cls = ['cal-pill'];
    if (isMine(ev, cx.me)) cls.push('is-mine');
    if (ev.date === cx.today && !ev.allDay) {
      var s = evStart(ev), e = evEnd(ev);
      if (s <= cx.now && cx.now < e) cls.push('is-live'); else if (e <= cx.now) cls.push('is-past');
    }
    if (ev.type === 'deadline' && isUrgent(ev, cx)) cls.push('is-urgent');
    if (conflicts && conflicts[ev.id]) cls.push('is-conflict');
    return cls.join(' ');
  }
  /** Màu viền so sánh cho một sự kiện (1 người: 1 màu; ≥2 người: sọc). */
  function cmpStyle(ev, F) {
    if (!F.compare.length) return '';
    var hues = []; F.compare.forEach(function (id, i) { if (ev.attendeeIds.indexOf(id) >= 0) hues.push(CMP_HUES[i]); });
    if (!hues.length) return '';
    if (hues.length === 1) return '--cmp:' + hues[0];
    var stops = hues.map(function (h, i) { return h + ' ' + (i * 5) + 'px ' + ((i + 1) * 5) + 'px'; }).join(',');
    return '--cmp:' + hues[0] + ';--cmp-bar:repeating-linear-gradient(180deg,' + stops + ')';
  }
  /** Pill sự kiện dùng riêng cho Lịch: riêng tư, ưu tiên, RSVP chờ, so sánh, tháng. */
  function pillHtml(ev, opts, cx) {
    opts = opts || {};
    var st = S(), me = cx.me, canSee = st.canSee(ev, me.id);
    var project = ev.projectId && canSee ? st.project(ev.projectId) : null;
    var title = st.displayTitle(ev, me.id);
    var time = ev.allDay ? 'Cả ngày' : U.fmtTimeRange(ev.start, ev.end);
    var meta = canSee ? [time, ev.location].filter(Boolean).join(' · ') : time;
    var attendees = canSee && opts.people !== false && !opts.compact ? ev.attendeeIds.map(st.staff).filter(Boolean) : [];
    var pendingMe = canSee && ev.type !== 'focus' && ev.ownerId !== me.id && ev.attendeeIds.indexOf(me.id) >= 0 && ev.date >= cx.today && st.rsvpOf(ev, me.id) === 'pending';
    var cmp = opts.cmp || '';
    var cls = 'ev-pill' + (opts.compact ? ' ev-pill--compact' : '') + (opts.cls ? ' ' + opts.cls : '') + (canSee ? '' : ' is-private') + (pendingMe ? ' is-rsvp-pending' : '') + (cmp ? ' is-compared' : '');
    var style = []; if (project) style.push('--ev:' + project.color); if (cmp) style.push(cmp);
    var label = title + ', ' + meta + (pendingMe ? ', bạn chưa phản hồi' : '') + (canSee ? (ev.priority === 1 ? ', bắt buộc' : '') : ', riêng tư');
    var titleInner = (canSee ? '' : '<span class="lock" aria-hidden="true">' + UI.icon('shield', 11) + '</span>') + (opts.month ? '<b class="cal-mpill__t">' + esc(ev.allDay ? 'Cả ngày' : ev.start) + '</b><span class="cal-mpill__ttl">' + esc(title) + '</span>' : esc(title));
    var tags = '';
    if (opts.prio && canSee && ev.priority === 1) tags += '<span class="prio" data-p="1" title="Bắt buộc">P1</span>';
    if (pendingMe) tags += '<span class="cal-rsvpq mono-sm" title="Bạn chưa phản hồi lời mời này">?</span>';
    return '<div class="' + cls + '" data-type="' + ev.type + '" data-event="' + ev.id + '" data-prio="' + (ev.priority || 2) + '" data-cal="' + esc(calId(ev)) + '"' + (style.length ? ' style="' + style.join(';') + '"' : '') + ' tabindex="' + (opts.tabindex == null ? 0 : opts.tabindex) + '" role="button" aria-label="' + esc(label) + '">' +
      '<span class="ev-pill__bar"></span>' + (pendingMe ? '<i class="cal-pill__dash" aria-hidden="true"></i>' : '') +
      '<span class="ev-pill__main"><span class="cal-pill__row"><span class="ev-pill__title">' + titleInner + '</span>' + (tags ? '<span class="cal-pill__tags">' + tags + '</span>' : '') + '</span>' + (opts.compact ? '' : '<span class="ev-pill__meta">' + esc(meta) + (project ? ' · <b>' + esc(project.client) + '</b>' : '') + '</span>') + '</span>' +
      (attendees.length ? '<span class="ev-pill__people">' + UI.avatarStack(attendees, { max: 3, size: 'xs' }) + '</span>' : '') + '</div>';
  }
  /** Xếp cột cho các sự kiện chồng giờ trong một ngày. */
  function layoutDay(events) {
    var items = events.map(function (e) { var s = evStart(e); return { ev: e, s: s, e: Math.max(evEnd(e), s + SNAP) }; });
    items.sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); });
    var clusters = [], cur = null, curEnd = -1;
    items.forEach(function (it) {
      if (!cur || it.s >= curEnd) { cur = []; clusters.push(cur); curEnd = it.e; } else curEnd = Math.max(curEnd, it.e);
      cur.push(it);
    });
    clusters.forEach(function (cl) {
      var ends = [];
      cl.forEach(function (it) {
        var c = -1; for (var i = 0; i < ends.length; i++) if (ends[i] <= it.s) { c = i; break; }
        if (c < 0) { c = ends.length; ends.push(0); }
        ends[c] = it.e; it.col = c; it.cl = cl;
      });
      cl.forEach(function (it) {
        it.cols = ends.length; it.span = 1;
        for (var c = it.col + 1; c < ends.length; c++) {
          var blocked = cl.some(function (o) { return o !== it && o.col === c && o.s < it.e && it.s < o.e; });
          if (blocked) break; it.span++;
        }
      });
    });
    return items;
  }
  /** Xếp làn (lane) cho các thanh chồng giờ trong timeline; trả về số làn. */
  function packLanes(items) {
    items.sort(function (a, b) { return a.s - b.s || (b.e - b.s) - (a.e - a.s); });
    var ends = [];
    items.forEach(function (it) {
      var k = -1; for (var i = 0; i < ends.length; i++) if (ends[i] <= it.s) { k = i; break; }
      if (k < 0) { k = ends.length; ends.push(0); }
      ends[k] = it.e; it.lane = k;
    });
    return ends.length;
  }
  function rangeFor(days, F, cx) {
    var start = C.workStart * 60, end = C.workEnd * 60;
    days.forEach(function (iso) {
      S().eventsOn(iso).forEach(function (e) {
        if (e.allDay || !passes(e, F, cx)) return;
        start = Math.min(start, Math.floor(evStart(e) / 60) * 60);
        end = Math.max(end, Math.ceil(Math.max(evEnd(e), evStart(e) + SNAP) / 60) * 60);
      });
    });
    return { start: start, end: Math.min(end, 24 * 60) };
  }
  /** Khoảng rảnh chung (30') của những người đang so sánh trong một ngày, gộp liền kề. */
  function freeRanges(iso, F) {
    if (!F.compare.length) return [];
    var slots = S().freeSlotsOn(F.compare, iso, 30, { buffer: 0, step: 30 }), out = [];
    slots.forEach(function (sl) { var last = out[out.length - 1]; if (last && last.end === sl.start) last.end = sl.end; else out.push({ start: sl.start, end: sl.end }); });
    return out;
  }

  /* -------------------------------------------------------------- state */
  var V = null; // instance duy nhất

  /* ------------------------------------------------------------ builders */
  function emptyOverlay(F) {
    var filtered = hasFilter(F);
    return '<div class="cal-empty"><div class="cal-empty__box">' + UI.icon('coffee', 20) +
      '<p>' + (filtered ? 'Không có sự kiện nào khớp bộ lọc trong khoảng này.' : 'Khoảng thời gian này còn trống — kéo trên lưới để tạo sự kiện.') + '</p>' +
      (filtered ? '<button type="button" class="btn btn--soft btn--sm" data-act="clear">Bỏ lọc</button>' : '<button type="button" class="btn btn--soft btn--sm" data-act="new">' + UI.icon('plus', 14) + 'Tạo sự kiện</button>') +
      '</div></div>';
  }

  /** Dựng phần đầu (ngày + cả ngày) và lớp lưới cho 1 kỳ. */
  function renderPeriod(days, F, cx, opts) {
    opts = opts || {};
    var st = S(), range = rangeFor(days, F, cx), pxm = hourH() / 60;
    var grid = U.el('div', { class: 'cal-layer', style: '--cols:' + days.length });
    var head = U.el('div', { class: 'cal-hd', style: '--cols:' + days.length });
    var total = 0, mine = 0, anyAllDay = false, firstStart = null;
    var daysHtml = '', adHtml = '', colsHtml = '';
    var wide = days.length <= 3;
    var bodyW = V && V.body ? V.body.clientWidth : 0, gutterW = parseFloat(getComputedStyle(document.body).getPropertyValue('--cal-gutter')) || 56;
    var colW = bodyW > 0 ? Math.max(0, bodyW - gutterW - (days.length === 1 ? 336 : 0)) / days.length : 150;
    days.forEach(function (iso) {
      var d = U.fromISO(iso), isToday = iso === cx.today, weekend = U.isWeekend(d), hol = st.holidayName(iso), selected = iso === V.iso;
      var de = dayEvents(iso, F, cx);
      var timed = de.vis.filter(function (e) { return !e.allDay; }), allday = de.vis.filter(function (e) { return e.allDay; });
      total += de.vis.length; mine += de.vis.filter(function (e) { return isMine(e, cx.me); }).length;
      timed.forEach(function (e) { var s = evStart(e); if (firstStart == null || s < firstStart) firstStart = s; });
      var label = U.fmtDate(d, 'long') + (hol ? ' · ' + hol : '') + (isToday ? ' · Hôm nay' : '');
      var layerColors = U.uniq(de.vis.map(function (e) { return st.calendarOf(e).color; })).slice(0, 4);
      daysHtml += '<button type="button" class="cal-dh cal-anchor' + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + (selected ? ' is-selected' : '') + (hol ? ' is-holiday' : '') + '" data-day="' + iso + '" aria-label="' + esc(label) + '"' + (isToday ? ' aria-current="date"' : '') + '>' +
        '<span class="cal-dh__wd">' + (wide ? U.weekdayLong(d) : U.weekdayShort(d)) + '</span><span class="cal-dh__num tnum">' + d.getDate() + '</span>' + (layerColors.length && !wide ? '<span class="cal-dh__dots" aria-hidden="true">' + layerColors.map(function (c) { return '<i style="--c:' + c + '"></i>'; }).join('') + '</span>' : '') + '</button>';
      var ad = [];
      if (hol) ad.push('<span class="cal-ad__hol">' + UI.icon('flag', 12) + '<span>' + esc(hol) + '</span></span>');
      if (F.staff && !F.compare.length) { var sh = st.shiftOf(F.staff, iso); if (sh !== 'off') ad.push(UI.shiftBadge(sh, { label: wide || days.length <= 5, cls: 'cal-ad__shift' })); }
      allday.forEach(function (e) { ad.push(pillHtml(e, { compact: true, cls: pillClasses(e, cx, de.conflicts) + ' cal-adpill', cmp: cmpStyle(e, F) }, cx)); });
      if (ad.length) anyAllDay = true;
      adHtml += '<div class="cal-ad' + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + '" data-day="' + iso + '">' + ad.join('') + '</div>';
      var items = layoutDay(timed), moreHtml = '', capped = [];
      items.forEach(function (it) {
        // Cụm ≥4 cột trong cột hẹp: chỉ hiện 2 cột + nút “+N nữa” (mở chế độ ngày)
        if (it.cols <= MAX_SLOTS || colW / it.cols >= MIN_SLOT_W || capped.indexOf(it.cl) >= 0) return;
        var cl = it.cl, hidden = cl.filter(function (o) { return o.col >= MAX_SLOTS - 1; });
        if (!hidden.length) return;
        capped.push(cl);
        var hs = Infinity, he = -Infinity;
        hidden.forEach(function (o) { o.hidden = true; hs = Math.min(hs, o.s); he = Math.max(he, o.e); });
        cl.forEach(function (o) { if (!o.hidden) { o.cols = MAX_SLOTS; o.span = Math.min(o.span, MAX_SLOTS - 1 - o.col); } });
        var mtop = (hs - range.start) * pxm, mh = Math.max((he - hs) * pxm, 20);
        var mlbl = '+' + hidden.length + ' sự kiện khác, ' + U.minToTime(hs) + ' – ' + U.minToTime(he) + ' — xem theo ngày';
        moreHtml += '<button type="button" class="cal-more" data-go-day="' + iso + '" aria-label="' + esc(mlbl) + '" data-tip="' + esc(mlbl) + '" style="top:' + mtop.toFixed(1) + 'px;height:' + mh.toFixed(1) + 'px;left:calc(' + ((MAX_SLOTS - 1) / MAX_SLOTS * 100).toFixed(3) + '% + 2px);width:calc(' + (1 / MAX_SLOTS * 100).toFixed(3) + '% - 4px)"><span>+' + hidden.length + '</span><span class="cal-more__w">&nbsp;nữa</span></button>';
      });
      var evHtml = items.filter(function (it) { return !it.hidden; }).map(function (it) {
        var top = (it.s - range.start) * pxm, h = Math.max((it.e - it.s) * pxm, 20), dur = evEnd(it.ev) - evStart(it.ev);
        var short = dur < 30, tall = dur >= 90;
        var cls = pillClasses(it.ev, cx, de.conflicts) + (short ? ' cal-pill--short' : tall ? ' cal-pill--tall' : '') + (dur === 0 ? ' cal-pill--point' : '');
        return '<div class="cal-ev" data-event="' + it.ev.id + '" style="top:' + top.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px;left:calc(' + (it.col / it.cols * 100).toFixed(3) + '% + 2px);width:calc(' + (it.span / it.cols * 100).toFixed(3) + '% - 4px)">' + pillHtml(it.ev, { compact: short, cls: cls, prio: h > 44 && colW * it.span / it.cols >= 110, cmp: cmpStyle(it.ev, F) }, cx) + '</div>';
      }).join('');
      // So sánh: ô rảnh chung của mọi người được chọn
      var freeHtml = freeRanges(iso, F).map(function (fr) {
        var s = Math.max(fr.start, range.start), e = Math.min(fr.end, range.end); if (e <= s) return '';
        var lbl = 'Mọi người rảnh ' + U.minToTime(s) + ' – ' + U.minToTime(e) + ' — bấm để tạo cuộc họp';
        return '<button type="button" class="cal-freecell" data-free-day="' + iso + '" data-free-start="' + s + '" data-free-end="' + e + '" style="top:' + ((s - range.start) * pxm).toFixed(1) + 'px;height:' + ((e - s) * pxm).toFixed(1) + 'px" aria-label="' + esc(lbl) + '" data-tip="' + esc(lbl) + '"><span class="cal-freecell__lbl">Rảnh chung</span></button>';
      }).join('');
      var nowHtml = '';
      if (isToday) {
        var show = cx.now >= range.start && cx.now <= range.end;
        nowHtml = '<div class="cal-now" style="transform:translateY(' + ((cx.now - range.start) * pxm).toFixed(1) + 'px)"' + (show ? '' : ' hidden') + '><div class="now-line' + (opts.grow === false ? '' : ' is-grow') + '"></div></div>';
      }
      colsHtml += '<div class="cal-col' + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + (hol ? ' is-holiday' : '') + '" data-day="' + iso + '">' + freeHtml + evHtml + moreHtml + nowHtml + '</div>';
    });
    head.innerHTML = '<div class="cal-hd__row cal-hd__days"><div class="cal-hd__gutter"></div>' + daysHtml + '</div>' +
      (anyAllDay ? '<div class="cal-hd__row cal-hd__allday"><div class="cal-hd__gutter"><span class="eyebrow">Cả ngày</span></div>' + adHtml + '</div>' : '');
    grid.innerHTML = colsHtml + (total === 0 ? emptyOverlay(F) : '');
    return { head: head, grid: grid, range: range, total: total, mine: mine, firstStart: firstStart };
  }

  function setRange(view, range) {
    var hours = (range.end - range.start) / 60;
    view.style.setProperty('--cal-hours', String(hours));
    var g = view.querySelector('.cal-gutter'); if (!g) return;
    var key = range.start + '-' + range.end;
    if (g.dataset.range !== key) {
      g.dataset.range = key; var html = '';
      for (var h = 1; h < hours; h++) html += '<span class="cal-hour" style="top:calc(' + h + ' * var(--hour-h))">' + U.minToTime(range.start + h * 60) + '</span>';
      html += '<span class="cal-now-label" hidden></span>';
      g.innerHTML = html;
    }
  }

  function renderMonth(iso, F, cx) {
    var st = S(), d = U.fromISO(iso), m = d.getMonth(), days = U.monthGrid(d);
    var el = U.el('div', { class: 'cal-layer cal-month' });
    var total = 0, mine = 0;
    var html = '<div class="cal-month__wd">' + U.WEEKDAYS_SHORT.map(function (w, i) { return '<span class="eyebrow' + (i >= 5 ? ' is-weekend' : '') + '">' + w + '</span>'; }).join('') + '</div>';
    days.forEach(function (dt) {
      var k = U.toISO(dt), de = dayEvents(k, F, cx), out = dt.getMonth() !== m, hol = st.holidayName(k), isToday = k === cx.today, weekend = U.isWeekend(dt);
      if (!out) { total += de.vis.length; mine += de.vis.filter(function (e) { return isMine(e, cx.me); }).length; }
      var shown = de.vis.slice(0, de.vis.length <= 3 ? 3 : 2), more = de.vis.length - shown.length;
      html += '<div class="cal-mc cal-anchor' + (out ? ' is-out' : '') + (isToday ? ' is-today' : '') + (weekend ? ' is-weekend' : '') + (k === V.iso ? ' is-selected' : '') + (hol ? ' is-holiday' : '') + '" data-day="' + k + '">' +
        '<div class="cal-mc__top"><button type="button" class="cal-mc__num tnum" data-go-week="' + k + '" aria-label="' + esc('Xem tuần của ' + U.fmtDate(dt, 'long')) + '"' + (isToday ? ' aria-current="date"' : '') + '>' + dt.getDate() + '</button>' + (hol ? '<span class="cal-mc__hol truncate">' + esc(hol) + '</span>' : '') + '</div>' +
        '<div class="cal-mc__list">' + shown.map(function (e) { return pillHtml(e, { compact: true, month: true, cls: pillClasses(e, cx, de.conflicts) + ' cal-mpill', cmp: cmpStyle(e, F) }, cx); }).join('') + (more > 0 ? '<button type="button" class="cal-mc__more" data-go-day="' + k + '">+' + more + ' nữa</button>' : '') + '</div></div>';
    });
    el.innerHTML = html;
    el._counts = { total: total, mine: mine };
    return el;
  }

  /* ---------------------------------------------------------- side panel */
  function freePeople(iso, from, to) {
    var st = S(), out = [];
    st.state.staff.forEach(function (s) {
      var sh = st.shiftOf(s.id, iso); if (sh === 'off' || sh === 'leave') return;
      var busy = st.eventsFor(s.id, iso).some(function (e) { if (e.allDay) return e.type === 'shoot' || e.type === 'event'; return evStart(e) < to && from < evEnd(e); });
      if (!busy) out.push(s);
    });
    return out;
  }
  function freeListHtml(iso, slot, cx) {
    var st = S(), hol = st.holidayName(iso), from, to;
    if (slot === 'now') { from = cx.now; to = cx.now + 1; } else { from = U.timeToMin(slot); to = from + 60; }
    var list = freePeople(iso, from, to);
    if (!list.length) return '<p class="cal-side__muted">' + (hol ? 'Ngày lễ — không ai trực hôm nay.' : U.isWeekend(iso) ? 'Cuối tuần — không ai được xếp ca.' : 'Không ai rảnh trong khung giờ này.') + '</p>';
    var shown = list.slice(0, 8);
    return '<div class="cal-free">' + shown.map(function (s) {
      var team = st.team(s.teamId), sh = st.shiftType(st.shiftOf(s.id, iso));
      return '<button type="button" class="cal-free__p" data-staff-open="' + s.id + '">' + UI.avatar(s, { size: 'sm', status: true, title: false }) + '<span class="cal-free__txt"><b class="truncate">' + esc(U.shortName(s.name)) + '</b><small class="truncate">' + esc((team ? team.short : '') + ' · ' + sh.label) + '</small></span></button>';
    }).join('') + '</div>' + (list.length > shown.length ? '<div class="cal-side__muted">+' + (list.length - shown.length) + ' người khác cũng rảnh</div>' : '');
  }
  function renderSide(side, iso, F, cx) {
    if (!side) return;
    var st = S(), stats = st.dayStats(iso), hol = st.holidayName(iso), d = U.fromISO(iso), isToday = iso === cx.today;
    var de = dayEvents(iso, F, cx);
    var withMe = {};
    st.eventsFor(cx.me.id, iso).forEach(function (e) { e.attendeeIds.forEach(function (id) { if (id !== cx.me.id) withMe[id] = true; }); });
    var withMeList = Object.keys(withMe).map(st.staff).filter(Boolean);
    var slot = V.freeSlot && (V.freeSlot !== 'now' || isToday) ? V.freeSlot : (isToday ? 'now' : '14:00');
    var statsTxt = stats.onDuty + ' làm việc' + (stats.remote ? ' · ' + stats.remote + ' remote' : '') + (stats.onsite ? ' · ' + stats.onsite + ' quay' : '') + (stats.ot ? ' · ' + stats.ot + ' tăng ca' : '') + (stats.leave ? ' · ' + stats.leave + ' nghỉ' : '');
    var nw = nextWorkday(iso);
    var opts = (isToday ? '<option value="now"' + (slot === 'now' ? ' selected' : '') + '>Bây giờ</option>' : '');
    for (var h = 7; h <= 19; h++) { var v = U.minToTime(h * 60); opts += '<option value="' + v + '"' + (slot === v ? ' selected' : '') + '>' + v + ' – ' + U.minToTime(h * 60 + 60) + '</option>'; }
    var freeTitle = slot === 'now' ? 'Ai đang rảnh' : 'Ai rảnh';
    var pending = st.myPendingInvites(cx.me.id).filter(function (e) { return e.date === iso; });
    side.innerHTML =
      '<section class="cal-side__sec cal-side__sec--date"><div class="eyebrow">' + esc(U.fmtRelativeDay(d)) + '</div><h3 class="cal-side__date">' + esc(U.fmtDate(d, 'long')) + '</h3>' +
      (hol ? '<p class="cal-side__hol">' + UI.icon('flag', 14) + '<span>Nghỉ lễ <b>' + esc(hol) + '</b> — cả công ty nghỉ. Ngày làm việc tiếp theo: <button type="button" class="link-btn" data-go-day="' + nw + '">' + esc(U.fmtDate(nw, 'shortWeekday')) + '</button></span></p>' : '<p class="cal-side__stats tnum">' + esc(statsTxt) + '</p>') + '</section>' +
      (pending.length ? '<section class="cal-side__sec cal-side__sec--pending"><div class="cal-side__h"><span class="eyebrow">Chờ bạn phản hồi</span><span class="cal-side__count tnum">' + pending.length + '</span></div><div class="cal-side__list">' + pending.map(function (e) { return pillHtml(e, { cls: pillClasses(e, cx, de.conflicts), prio: true }, cx) + E().rsvpBar(e, cx.me.id); }).join('') + '</div></section>' : '') +
      '<section class="cal-side__sec"><div class="cal-side__h"><span class="eyebrow">Cùng ngày với bạn</span><span class="cal-side__count tnum">' + withMeList.length + '</span></div>' +
      (withMeList.length ? '<div class="cal-side__with">' + UI.avatarStack(withMeList, { max: 7, size: 'sm' }) + '<p class="cal-side__names">' + esc(withMeList.slice(0, 4).map(function (s) { return U.firstName(s.name); }).join(', ') + (withMeList.length > 4 ? ' và ' + (withMeList.length - 4) + ' người khác' : '')) + '</p></div>' : '<p class="cal-side__muted">Bạn không có sự kiện chung với ai trong ngày này.</p>') + '</section>' +
      '<section class="cal-side__sec"><div class="cal-side__h"><span class="eyebrow cal-side__free-title">' + esc(freeTitle) + '</span><select class="cal-side__time" aria-label="Chọn khung giờ">' + opts + '</select></div><div class="cal-side__free">' + freeListHtml(iso, slot, cx) + '</div></section>' +
      '<section class="cal-side__sec cal-side__sec--events"><div class="cal-side__h"><span class="eyebrow">Sự kiện trong ngày</span><span class="cal-side__count tnum">' + de.vis.length + '</span></div>' +
      (de.vis.length ? '<div class="cal-side__list">' + de.vis.map(function (e) { return pillHtml(e, { cls: pillClasses(e, cx, de.conflicts), prio: true, cmp: cmpStyle(e, F) }, cx); }).join('') + '</div>' : '<div class="cal-side__empty"><p>' + (hol ? 'Ngày lễ — lịch trống hoàn toàn.' : hasFilter(F) ? 'Không có sự kiện nào khớp bộ lọc.' : 'Ngày này chưa có sự kiện nào.') + '</p>' + (hasFilter(F) && !hol ? '<button type="button" class="btn btn--soft btn--sm" data-act="clear">Bỏ lọc</button>' : '<button type="button" class="btn btn--soft btn--sm" data-act="new">' + UI.icon('plus', 14) + 'Tạo sự kiện</button>') + '</div>') + '</section>';
  }

  /* ============================================================ ĐỘI NGŨ */
  /** Nhóm người theo team (Ban điều hành lên đầu). */
  function teamGroups(F) {
    var st = S(), people;
    if (F.people.length) people = F.people.map(st.staff).filter(Boolean);
    else if (F.team) people = st.staffByTeam(F.team);
    else people = st.state.staff.slice();
    var teams = st.state.teams.slice().sort(function (a, b) { return (a.id === 'exec' ? 0 : 1) - (b.id === 'exec' ? 0 : 1); });
    var out = [];
    teams.forEach(function (t) { var list = people.filter(function (p) { return p.teamId === t.id; }); if (list.length) out.push({ team: t, people: list }); });
    return out;
  }
  /** Dữ liệu một người trong một ngày cho timeline. */
  function personDay(s, iso, F) {
    var st = S();
    var evs = st.eventsFor(s.id, iso).filter(function (e) { return teamFilterOk(e, F); });
    var timed = evs.filter(function (e) { return !e.allDay && evEnd(e) > evStart(e); }), allDay = evs.filter(function (e) { return e.allDay; });
    var hard = {}, pairs = 0;
    st.conflictsFor(s.id, iso, iso).forEach(function (c) { if (c.kind !== 'hard') return; pairs++; hard[c.a.id] = 1; hard[c.b.id] = 1; });
    return { s: s, iso: iso, events: evs, timed: timed, allDay: allDay, hard: hard, conflicts: pairs, load: st.dayLoad(s.id, iso), shift: st.shiftOf(s.id, iso) };
  }
  function groupRowHtml(team, n, onDuty, collapsed, cols) {
    return '<div class="cal-tl__grow' + (collapsed ? ' is-collapsed' : '') + '" role="row" data-team="' + team.id + '" style="--chip:' + team.color + '">' +
      '<div class="cal-tl__ghead" role="rowheader"><button type="button" class="cal-tl__gbtn" data-tl-group="' + team.id + '" aria-expanded="' + (!collapsed) + '"><i class="chip__dot"></i><b>' + esc(team.name) + '</b><small>' + n + ' người · ' + onDuty + ' trực</small>' + UI.icon('chevron-down', 14, { cls: 'cal-tl__chev' }) + '</button></div>' +
      '<div class="cal-tl__gfill" role="gridcell" aria-hidden="true"' + (cols ? ' style="--cols:' + cols + '"' : '') + '></div></div>';
  }
  function teamEmptyHtml() {
    return '<div class="cal-tl__empty"><div class="cal-empty__box">' + UI.icon('users', 20) + '<p>Không ai trong bộ lọc này có lịch — chọn team khác hoặc thêm lịch mới.</p><button type="button" class="btn btn--soft btn--sm" data-act="new">' + UI.icon('plus', 14) + 'Tạo sự kiện</button></div></div>';
  }
  function personCellHtml(s, cx, pd, loadLine, weekTotal) {
    var isMe = s.id === cx.me.id;
    return '<div class="cal-tl__person" role="rowheader">' + UI.avatar(s, { size: 'sm', status: true, title: false }) +
      '<div class="cal-tl__ptxt"><div class="cal-tl__pname"><b class="truncate">' + esc(s.name) + '</b>' + (isMe ? '<span class="chip chip--muted chip--xs">Bạn</span>' : '') + '</div><div class="cal-tl__prole truncate">' + esc(s.role) + '</div>' +
      '<div class="cal-tl__pload">' + (pd ? UI.shiftBadge(pd.shift, { cls: 'cal-tl__shiftb' }) : '') + '<span class="cal-tl__load mono-sm truncate">' + esc(loadLine) + '</span></div></div></div>';
  }
  function loadLineFor(pd) {
    var load = pd.load;
    if (load.meetingMin) return U.fmtDuration(load.meetingMin) + ' họp' + (pd.conflicts ? ' · ' + pd.conflicts + ' chồng' : '') + (load.backToBack.length ? ' · sát nhau' : '');
    if (pd.shift === 'leave') return 'Nghỉ phép'; if (pd.shift === 'off') return 'Không xếp ca';
    return pd.timed.length ? U.fmtDuration(load.focusMin + load.travelMin) + ' tập trung / di chuyển' : 'Lịch trống';
  }
  function badgesHtml(pd) {
    var load = pd.load;
    return (pd.conflicts ? '<span class="cal-tl__badge cal-tl__badge--conf" title="' + pd.conflicts + ' cặp trùng giờ" aria-label="' + pd.conflicts + ' xung đột">!<b>' + pd.conflicts + '</b></span>' : '') +
      (load.backToBack.length ? '<span class="cal-tl__badge cal-tl__badge--b2b" title="Họp sát nhau ' + load.backToBack.length + ' lần, không có đệm" aria-label="họp sát nhau">≈</span>' : '') +
      (load.external ? '<span class="cal-tl__badge cal-tl__badge--trv" title="' + load.external + ' cuộc họp ngoài văn phòng cần di chuyển" aria-label="cần di chuyển">✈</span>' : '');
  }
  function teamDayRow(pd, cx, F, hidden, ri) {
    var s = pd.s, me = cx.me;
    var items = pd.timed.map(function (e) { return { ev: e, s: Math.max(TL_START, evStart(e)), e: Math.min(TL_END, Math.max(evEnd(e), evStart(e) + SNAP)) }; }).filter(function (it) { return it.e > it.s; });
    var lanes = packLanes(items), lanesTop = pd.allDay.length ? 1 : 0;
    var bars = items.map(function (it) {
      var dur = evEnd(it.ev) - evStart(it.ev), short = dur < 30;
      var cls = pillClasses(it.ev, cx, pd.hard) + ' cal-tl__pill';
      return '<div class="cal-tl__bar' + (short ? ' cal-tl__bar--short' : '') + '" data-event="' + it.ev.id + '" style="left:' + pct(it.s) + '%;width:' + ((it.e - it.s) / TL_SPAN * 100).toFixed(3) + '%;--lane:' + it.lane + '">' + pillHtml(it.ev, { compact: true, cls: cls, tabindex: -1, people: false }, cx) + '</div>';
    }).join('');
    var allday = pd.allDay.map(function (e) { return '<div class="cal-tl__bar cal-tl__bar--allday" data-event="' + e.id + '" data-allday="1">' + pillHtml(e, { compact: true, cls: pillClasses(e, cx, pd.hard) + ' cal-tl__pill', tabindex: -1, people: false }, cx) + '</div>'; }).join('');
    var span = SHIFT_SPAN[pd.shift];
    var shiftHtml = span ? '<i class="cal-tl__shift" data-shift="' + pd.shift + '" style="left:' + pct(Math.max(span[0], TL_START)) + '%;width:' + ((Math.min(span[1], TL_END) - Math.max(span[0], TL_START)) / TL_SPAN * 100).toFixed(3) + '%" aria-hidden="true"></i>' : '';
    var nowHtml = pd.iso === cx.today ? '<i class="cal-tl__now now-line" hidden aria-hidden="true"></i>' : '';
    var meetings = pd.timed.filter(function (e) { return e.type !== 'focus' && e.type !== 'travel'; }).length;
    var sum = meetings ? meetings + ' họp · ' + U.fmtDuration(pd.load.meetingMin) : (pd.timed.length ? pd.timed.length + ' khối' : '—');
    var cls = 'cal-tl__row' + (s.id === me.id ? ' is-me' : '') + (pd.shift === 'leave' ? ' is-leave hatch' : pd.shift === 'off' ? ' is-off' : '') + (pd.conflicts ? ' has-conflict' : '');
    return '<div class="' + cls + '" role="row" data-staff="' + s.id + '" data-r="' + ri + '" style="--lanes:' + (lanes + lanesTop) + ';--lanes-top:' + lanesTop + '"' + (hidden ? ' hidden' : '') + '>' +
      personCellHtml(s, cx, pd, loadLineFor(pd)) +
      '<div class="cal-tl__track" role="gridcell" data-staff="' + s.id + '" data-iso="' + pd.iso + '" aria-label="' + esc(U.shortName(s.name) + ' · ' + pd.events.length + ' sự kiện · bấm vào chỗ trống để tạo lịch') + '">' + shiftHtml + allday + bars + nowHtml + '</div>' +
      '<div class="cal-tl__sum" role="gridcell"><span class="mono-sm tnum cal-tl__sumtxt">' + esc(sum) + '</span><span class="cal-tl__badges">' + badgesHtml(pd) + '</span></div></div>';
  }
  function renderTeamDay(F, cx) {
    var st = S(), iso = V.iso, tp = teamPrefs(), groups = teamGroups(F), hol = st.holidayName(iso), stats = st.dayStats(iso);
    var hours = ''; for (var h = 7; h <= 20; h++) hours += '<span class="cal-tl__hour mono-sm' + (h === 20 ? ' is-last' : '') + '" style="left:' + pct(h * 60) + '%">' + U.minToTime(h * 60) + '</span>';
    var head = '<div class="cal-tl__head" role="row"><div class="cal-tl__corner" role="columnheader"><span class="eyebrow">' + esc(U.fmtRelativeDay(iso)) + '</span><b class="cal-tl__date">' + esc(U.fmtDate(iso, 'long')) + '</b>' + (hol ? '<small class="cal-tl__hol">' + UI.icon('flag', 11) + esc(hol) + '</small>' : '<small class="cal-tl__dstats tnum">' + stats.onDuty + ' trực · ' + stats.remote + ' remote · ' + stats.leave + ' nghỉ</small>') + '</div>' +
      '<div class="cal-tl__axis" role="columnheader" aria-label="Trục giờ 07:00 – 20:00">' + hours + '<span class="cal-tl__nowlbl mono-sm" hidden></span></div><div class="cal-tl__sumhead" role="columnheader"><span class="eyebrow">Tải ngày</span></div></div>';
    var html = '', people = 0, total = 0, ri = 0, conflicts = 0;
    groups.forEach(function (g) {
      var days = g.people.map(function (p) { return personDay(p, iso, F); });
      if (tp.onlyBusy) days = days.filter(function (d) { return d.events.length; });
      if (tp.onlyConflict) days = days.filter(function (d) { return d.conflicts; });
      if (!days.length) return;
      var collapsed = tp.collapsed.indexOf(g.team.id) >= 0;
      var onDuty = days.filter(function (d) { return d.shift !== 'off' && d.shift !== 'leave'; }).length;
      html += groupRowHtml(g.team, days.length, onDuty, collapsed);
      days.forEach(function (pd) { html += teamDayRow(pd, cx, F, collapsed, ri++); people++; total += pd.events.length; conflicts += pd.conflicts; });
    });
    if (!people) html += teamEmptyHtml();
    return { html: head + html, people: people, total: total, conflicts: conflicts };
  }
  function renderTeamWeek(F, cx) {
    var st = S(), days = V.days, tp = teamPrefs(), groups = teamGroups(F), n = days.length;
    var head = '<div class="cal-tl__head cal-tl__head--week" role="row" style="--cols:' + n + '"><div class="cal-tl__corner" role="columnheader"><span class="eyebrow">Tuần ' + U.isoWeek(U.fromISO(days[0])) + '</span><b class="cal-tl__date">' + esc(U.fmtRange(days[0], days[n - 1])) + '</b><small class="cal-tl__dstats">bấm ô để xem theo giờ</small></div>' +
      days.map(function (iso) { var d = U.fromISO(iso), hol = st.holidayName(iso); return '<button type="button" class="cal-tl__dh' + (iso === cx.today ? ' is-today' : '') + (U.isWeekend(d) ? ' is-weekend' : '') + (hol ? ' is-holiday' : '') + '" role="columnheader" data-go-teamday="' + iso + '" aria-label="' + esc(U.fmtDate(d, 'long') + (hol ? ' · ' + hol : '')) + '"><span class="cal-dh__wd">' + U.weekdayShort(d) + '</span><span class="cal-dh__num tnum">' + d.getDate() + '</span>' + (hol ? '<span class="cal-tl__dhhol truncate">' + esc(hol) + '</span>' : '') + '</button>'; }).join('') + '</div>';
    var html = '', people = 0, total = 0, ri = 0, conflicts = 0;
    groups.forEach(function (g) {
      var rows = g.people.map(function (p) {
        var cells = days.map(function (iso) { return personDay(p, iso, F); });
        return { s: p, cells: cells, total: U.sum(cells, function (c) { return c.events.length; }), conflicts: U.sum(cells, function (c) { return c.conflicts; }), meetingMin: U.sum(cells, function (c) { return c.load.meetingMin; }), meetings: U.sum(cells, function (c) { return c.timed.filter(function (e) { return e.type !== 'focus' && e.type !== 'travel'; }).length; }) };
      });
      if (tp.onlyBusy) rows = rows.filter(function (r) { return r.total; });
      if (tp.onlyConflict) rows = rows.filter(function (r) { return r.conflicts; });
      if (!rows.length) return;
      var collapsed = tp.collapsed.indexOf(g.team.id) >= 0;
      var onDuty = rows.filter(function (r) { return r.cells.some(function (c) { return c.shift !== 'off' && c.shift !== 'leave'; }); }).length;
      html += groupRowHtml(g.team, rows.length, onDuty, collapsed, n);
      rows.forEach(function (r) {
        var line = r.meetings ? r.meetings + ' họp · ' + U.fmtDuration(r.meetingMin) + (r.conflicts ? ' · ' + r.conflicts + ' chồng' : '') : 'Tuần trống';
        var cellsHtml = r.cells.map(function (pd, ci) {
          var d = U.fromISO(pd.iso), hol = st.holidayName(pd.iso), shown = pd.events.slice(0, 3), more = pd.events.length - shown.length;
          var mm = pd.load.meetingMin, lvl = mm > 480 ? 'over' : mm > 360 ? 'high' : 'normal', sh = st.shiftType(pd.shift);
          var cls = 'cal-tl__cell' + (pd.iso === cx.today ? ' is-today' : '') + (U.isWeekend(d) ? ' is-weekend' : '') + (hol ? ' is-holiday' : '') + (pd.shift === 'leave' ? ' is-leave' : '') + (pd.conflicts ? ' has-conflict' : '');
          return '<div class="' + cls + '" role="gridcell" tabindex="-1" data-staff="' + r.s.id + '" data-iso="' + pd.iso + '" data-r="' + ri + '" data-c="' + ci + '" aria-label="' + esc(U.shortName(r.s.name) + ' · ' + U.fmtDate(d, 'shortWeekday') + ' · ' + sh.label + ' · ' + pd.events.length + ' sự kiện' + (mm ? ' · ' + U.fmtDuration(mm) + ' họp' : '')) + '">' +
            '<span class="cal-tl__code mono-sm" data-shift="' + pd.shift + '" title="' + esc(sh.label) + '">' + sh.short + '</span>' +
            '<div class="cal-tl__cellist">' + shown.map(function (e) { return pillHtml(e, { compact: true, cls: pillClasses(e, cx, pd.hard) + ' cal-tl__wpill', tabindex: -1, people: false }, cx); }).join('') + (more > 0 ? '<span class="cal-tl__more mono-sm">+' + more + '</span>' : '') + '</div>' +
            (mm ? '<span class="cal-tl__loadbar" data-level="' + lvl + '" title="' + esc(U.fmtDuration(mm) + ' họp / 8g') + '"><i style="width:' + Math.min(100, mm / 480 * 100).toFixed(1) + '%"></i></span>' : '') + '</div>';
        }).join('');
        html += '<div class="cal-tl__row cal-tl__row--week' + (r.s.id === cx.me.id ? ' is-me' : '') + '" role="row" data-staff="' + r.s.id + '" data-r="' + ri + '" style="--cols:' + n + '"' + (collapsed ? ' hidden' : '') + '>' + personCellHtml(r.s, cx, null, line) + cellsHtml + '</div>';
        ri++; people++; total += r.total; conflicts += r.conflicts;
      });
    });
    if (!people) html += teamEmptyHtml();
    return { html: head + html, people: people, total: total, conflicts: conflicts };
  }
  function renderTeam(F, cx) { return F.span === 'week' ? renderTeamWeek(F, cx) : renderTeamDay(F, cx); }
  function buildTeamScroll(F, cx) {
    var tp = teamPrefs();
    var sc = U.el('div', { class: 'cal-scroll cal-tl', role: 'grid', 'aria-label': 'Lịch đội ngũ ' + (F.span === 'week' ? 'theo tuần' : 'theo giờ'), tabindex: '-1', dataset: { density: tp.density, span: F.span } });
    var inner = U.el('div', { class: 'cal-tl__inner' });
    var r = renderTeam(F, cx);
    inner.innerHTML = r.html; sc.appendChild(inner); sc._counts = r;
    rovingInit(sc);
    return sc;
  }
  /** Roving tabindex: một thanh (hoặc ô) duy nhất có tabindex=0. */
  function rovingInit(sc) {
    var items = U.qsa('.cal-tl__row:not([hidden]) .ev-pill, .cal-tl__row:not([hidden]) .cal-tl__cell', sc);
    if (!items.length) return;
    var pick = (V.tlFocus && items.find(function (i) { return (i.dataset.event && i.dataset.event === V.tlFocus) || (i.dataset.iso && i.dataset.staff + '|' + i.dataset.iso === V.tlFocus); })) || items[0];
    items.forEach(function (i) { i.tabIndex = i === pick ? 0 : -1; });
  }
  function rovingSet(el) {
    var sc = el.closest('.cal-tl'); if (!sc) return;
    U.qsa('[tabindex="0"]', sc).forEach(function (i) { if (i !== el) i.tabIndex = -1; });
    el.tabIndex = 0; V.tlFocus = el.dataset.event || (el.dataset.iso ? el.dataset.staff + '|' + el.dataset.iso : null);
  }
  function teamScrollInit(sc) {
    if (!sc || V.F.span === 'week') return;
    var track = sc.querySelector('.cal-tl__track'); if (!track) return;
    if (sc.scrollWidth - sc.clientWidth < 120) { sc.scrollLeft = 0; return; } // gần vừa khung: không cần cuộn
    var cx = ctx(), target = V.iso === cx.today ? Math.max(TL_START, cx.now - 90) : 8 * 60;
    var x = (target - TL_START) / TL_SPAN * track.getBoundingClientRect().width;
    sc.scrollLeft = Math.max(0, x - 8);
  }
  /** Kéo thanh trong timeline: ngang = dời giờ, dọc = chuyển người. */
  function bindTeamDrag(root) {
    var d = null;
    function rowAt(y) {
      var best = null, bd = Infinity;
      d.rows.forEach(function (r) { if (y >= r.top && y < r.bottom) { best = r; bd = 0; } else { var dist = y < r.top ? r.top - y : y - r.bottom; if (dist < bd) { bd = dist; best = r; } } });
      return best;
    }
    function tick() {
      if (!d || !d.active) return;
      var reduce = reduceMotion(), sc = d.scroll, scr = sc.getBoundingClientRect();
      if (d.x < scr.left + d.leftW + 24) sc.scrollLeft -= 8; else if (d.x > scr.right - 24) sc.scrollLeft += 8;
      if (d.y < scr.top + 60) sc.scrollTop -= 6; else if (d.y > scr.bottom - 24) sc.scrollTop += 6;
      var tr = d.track.getBoundingClientRect(), pxm = tr.width / TL_SPAN;
      var start = U.clamp(snap(TL_START + (d.x - d.grabX - tr.left) / pxm), TL_START, Math.max(TL_START, TL_END - d.dur));
      var row = rowAt(d.y) || d.originRow;
      if (row !== d.row) { if (d.row) d.row.el.classList.remove('is-drop'); d.row = row; if (row && row.staffId !== d.originRow.staffId) row.el.classList.add('is-drop'); }
      d.target = { start: start, staffId: row.staffId, row: row };
      var rowRect = row.el.getBoundingClientRect();
      d.tx = tr.left + (start - TL_START) * pxm; d.ty = rowRect.top + d.grabRowY;
      var ids = row.staffId === d.originRow.staffId ? d.ev.attendeeIds : d.ev.attendeeIds.map(function (id) { return id === d.originRow.staffId ? row.staffId : id; });
      var conf = conflictsFor(d.ev, d.ev.date, start, start + d.dur, ids);
      if ((conf.length > 0) !== d.hasConflict) { d.hasConflict = conf.length > 0; d.ghostPill.classList.toggle('is-conflict', d.hasConflict); }
      d.conf = conf;
      var t = reduce ? 1 : 0.35;
      d.cx = U.lerp(d.cx, d.tx, t); d.cy = U.lerp(d.cy, d.ty, t);
      d.ghost.style.transform = 'translate3d(' + d.cx.toFixed(1) + 'px,' + d.cy.toFixed(1) + 'px,0)';
      var label = U.minToTime(start) + ' – ' + U.minToTime(start + d.dur) + (row.staffId !== d.originRow.staffId ? ' → ' + row.name : '');
      if (d.timeEl.textContent !== label) d.timeEl.textContent = label;
      d.raf = requestAnimationFrame(tick);
    }
    function startDrag() {
      var ev = S().event(d.wrap.dataset.event); if (!ev) { d = null; return; }
      d.active = true;
      try { root.setPointerCapture(d.id); } catch (err) { /* noop */ }
      var st = S(), sc = d.wrap.closest('.cal-tl'), originEl = d.wrap.closest('.cal-tl__row');
      d.scroll = sc; d.ev = ev; d.dur = Math.max(evEnd(ev) - evStart(ev), SNAP);
      d.rows = U.qsa('.cal-tl__row:not([hidden])', sc).map(function (r) { var rr = r.getBoundingClientRect(), s = st.staff(r.dataset.staff); return { el: r, staffId: r.dataset.staff, name: s ? U.shortName(s.name) : '', top: rr.top, bottom: rr.bottom }; });
      d.originRow = d.rows.find(function (r) { return r.el === originEl; }); if (!d.originRow) { d.active = false; d = null; return; }
      d.row = d.originRow; d.track = originEl.querySelector('.cal-tl__track');
      d.leftW = parseFloat(getComputedStyle(sc).getPropertyValue('--tl-left')) || 220;
      var r = d.wrap.getBoundingClientRect(), rr = originEl.getBoundingClientRect();
      d.grabX = d.x0 - r.left; d.grabRowY = r.top - rr.top; d.w = r.width; d.h = r.height;
      document.body.classList.add('cal-dragging');
      d.layerEl = U.el('div', { class: 'drag-layer' });
      d.ghost = d.wrap.cloneNode(true); d.ghost.className = 'cal-tl__bar cal-ghost drag-ghost'; d.ghost.removeAttribute('data-event'); d.ghost.style.cssText = 'width:' + r.width + 'px;height:' + r.height + 'px;left:0;transform:translate3d(' + r.left + 'px,' + r.top + 'px,0)';
      d.ghostPill = d.ghost.querySelector('.ev-pill'); d.ghostPill.classList.remove('is-dragging', 'is-past'); d.ghostPill.tabIndex = -1;
      d.timeEl = U.el('span', { class: 'cal-ghost__time', text: U.fmtTimeRange(ev.start, ev.end) }); d.ghost.appendChild(d.timeEl);
      d.layerEl.appendChild(d.ghost); document.body.appendChild(d.layerEl);
      d.pill = d.wrap.querySelector('.ev-pill'); d.pill.classList.add('is-dragging');
      d.cx = r.left; d.cy = r.top; d.tx = r.left; d.ty = r.top; d.hasConflict = false;
      d.origin = { start: evStart(ev), staffId: d.originRow.staffId }; d.target = { start: evStart(ev), staffId: d.originRow.staffId, row: d.originRow };
      d.raf = requestAnimationFrame(tick);
    }
    function endDrag(cancel) {
      var dd = d; d = null;
      cancelAnimationFrame(dd.raf); document.body.classList.remove('cal-dragging');
      try { root.releasePointerCapture(dd.id); } catch (err) { /* noop */ }
      dd.rows.forEach(function (r) { r.el.classList.remove('is-drop'); });
      V.justDragged = true; setTimeout(function () { if (V) V.justDragged = false; }, 0);
      var ev = dd.ev, tg = dd.target, og = dd.origin, st = S();
      var sameTime = tg.start === og.start, sameRow = tg.staffId === og.staffId;
      if (cancel || (sameTime && sameRow)) { settleGhost(dd, dd.wrap, function () { dd.pill.classList.remove('is-dragging'); }); return; }
      var oldDate = ev.date, oldStart = og.start, oldIds = ev.attendeeIds.slice(), where = U.minToTime(tg.start) + ' – ' + U.minToTime(tg.start + dd.dur);
      if (sameRow) {
        V.pendingFlip = { id: ev.id, ghost: dd.ghost, layerEl: dd.layerEl, w: dd.w, h: dd.h };
        st.moveEvent(ev.id, ev.date, tg.start);
        if (V.pendingFlip) { V.pendingFlip = null; dd.layerEl.remove(); }
        var undo = { label: 'Hoàn tác', onClick: function () { st.moveEvent(ev.id, oldDate, oldStart); UI.toast('Đã đưa “' + ev.title + '” về ' + U.minToTime(oldStart), { kind: 'info' }); } };
        if (dd.conf && dd.conf.length) UI.toast('Đã dời “' + ev.title + '” sang ' + where + ' — trùng “' + dd.conf[0].ev.title + '”', { kind: 'warning', title: 'Trùng lịch', action: undo, duration: 8000 });
        else UI.toast('Đã dời “' + ev.title + '” sang ' + where, { kind: 'success', action: undo });
        return;
      }
      // Sang hàng người khác: xác nhận rồi thay người tham gia
      settleGhost(dd, dd.wrap, function () { dd.pill.classList.remove('is-dragging'); });
      var A = st.staff(og.staffId), B = st.staff(tg.staffId); if (!A || !B) return;
      UI.confirm({ title: 'Chuyển người tham gia', message: 'Chuyển “' + ev.title + '” từ ' + U.shortName(A.name) + ' sang ' + U.shortName(B.name) + '?' + (sameTime ? '' : ' Giờ mới: ' + where + '.'), confirmLabel: 'Chuyển', icon: 'repeat' }).then(function (ok) {
        if (!ok) return;
        var ids = U.uniq(oldIds.map(function (id) { return id === A.id ? B.id : id; }));
        var patch = { attendeeIds: ids };
        if (!sameTime) { patch.start = U.minToTime(tg.start); patch.end = U.minToTime(tg.start + dd.dur); }
        st.updateEvent(ev.id, patch);
        UI.toast('Đã chuyển “' + ev.title + '” từ ' + U.shortName(A.name) + ' sang ' + U.shortName(B.name) + (sameTime ? '' : ' · ' + where), { kind: 'success', action: { label: 'Hoàn tác', onClick: function () { st.updateEvent(ev.id, { attendeeIds: oldIds, start: U.minToTime(oldStart), end: U.minToTime(oldStart + dd.dur) }); UI.toast('Đã trả “' + ev.title + '” về ' + U.shortName(A.name), { kind: 'info' }); } } });
      });
    }
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.pointerType === 'touch' || d) return;
      if (V.slide || V.morph) return;
      var wrap = e.target.closest('.cal-tl__bar'); if (!wrap || wrap.dataset.allday || !wrap.closest('.cal-tl[data-span="day"]')) return;
      d = { wrap: wrap, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
    });
    root.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      d.x = e.clientX; d.y = e.clientY;
      if (!d.active) { if (Math.abs(d.x - d.x0) < 4 && Math.abs(d.y - d.y0) < 4) return; startDrag(); }
    });
    root.addEventListener('pointerup', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) endDrag(false); else d = null; });
    root.addEventListener('pointercancel', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) endDrag(true); else d = null; });
    return { cancel: function () { if (d && d.active) endDrag(true); else d = null; }, isDragging: function () { return !!(d && d.active); } };
  }
  /** Bàn phím trong lưới đội ngũ: ←/→ giữa các thanh, ↑/↓ giữa các hàng, Shift+←/→ dời 15', Enter mở. */
  function teamKeydown(e) {
    var sc = e.target.closest && e.target.closest('.cal-tl'); if (!sc) return;
    var pill = e.target.closest('.ev-pill'), cell = e.target.closest('.cal-tl__cell');
    if (!pill && !cell) return;
    var key = e.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Home' && key !== 'End' && key !== 'Enter') return;
    if (pill && e.shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      e.preventDefault(); var ev = S().event(pill.dataset.event); if (!ev || ev.allDay) return;
      var ns = U.clamp(evStart(ev) + (key === 'ArrowLeft' ? -SNAP : SNAP), 0, 24 * 60 - (evEnd(ev) - evStart(ev)));
      V.tlFocus = ev.id; S().moveEvent(ev.id, ev.date, ns); return;
    }
    if (cell && key === 'Enter') { e.preventDefault(); go('team', cell.dataset.iso, Object.assign({}, V.F, { span: 'day' })); return; }
    if (pill && key === 'Enter') return; // bindEventPills mở chi tiết
    e.preventDefault();
    var rows = U.qsa('.cal-tl__row:not([hidden])', sc), row = e.target.closest('.cal-tl__row'), ri = rows.indexOf(row);
    var sel = pill ? '.ev-pill' : '.cal-tl__cell';
    var inRow = function (r) { return U.qsa(sel, r).sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; }); };
    var items = inRow(row), i = items.indexOf(pill || cell), next = null;
    if (key === 'ArrowLeft') next = items[i - 1]; else if (key === 'ArrowRight') next = items[i + 1];
    else if (key === 'Home') next = items[0]; else if (key === 'End') next = items[items.length - 1];
    else {
      var dir = key === 'ArrowUp' ? -1 : 1, x = (pill || cell).getBoundingClientRect().left;
      for (var k = ri + dir; k >= 0 && k < rows.length && !next; k += dir) {
        var cand = inRow(rows[k]); if (!cand.length) continue;
        if (cell) next = cand[Math.min(i, cand.length - 1)];
        else next = cand.reduce(function (b, c) { return Math.abs(c.getBoundingClientRect().left - x) < Math.abs(b.getBoundingClientRect().left - x) ? c : b; }, cand[0]);
      }
    }
    if (next) { rovingSet(next); next.focus(); }
  }

  /* --------------------------------------------------------------- view */
  function buildView(mode, iso, F, cx) {
    var view = U.el('section', { class: 'cal-view cal-view--' + mode, dataset: { mode: mode } });
    if (mode === 'team') { var sc = buildTeamScroll(F, cx); view.appendChild(sc); view._counts = sc._counts; return view; }
    if (mode === 'month') {
      var scrollM = U.el('div', { class: 'cal-scroll cal-scroll--month' });
      var layersM = U.el('div', { class: 'cal-layers' });
      var monthEl = renderMonth(iso, F, cx);
      layersM.appendChild(monthEl); scrollM.appendChild(layersM); view.appendChild(scrollM);
      view._counts = monthEl._counts;
      return view;
    }
    var scroll = U.el('div', { class: 'cal-scroll' });
    var head = U.el('div', { class: 'cal-head' });
    var headLayers = U.el('div', { class: 'cal-head__layers' });
    head.appendChild(headLayers);
    var stage = U.el('div', { class: 'cal-stage' });
    var gutter = U.el('div', { class: 'cal-gutter', 'aria-hidden': 'true' });
    var layers = U.el('div', { class: 'cal-layers' });
    stage.appendChild(gutter); stage.appendChild(layers);
    scroll.appendChild(head); scroll.appendChild(stage);
    view.appendChild(scroll);
    var r = renderPeriod(daysFor(mode, iso), F, cx, {});
    headLayers.appendChild(r.head); layers.appendChild(r.grid);
    setRange(view, r.range);
    view._range = r.range; view._firstStart = r.firstStart; view._counts = { total: r.total, mine: r.mine };
    if (mode === 'day') { var side = U.el('aside', { class: 'cal-side', 'aria-label': 'Tóm tắt ngày' }); renderSide(side, iso, F, cx); view.appendChild(side); }
    return view;
  }
  function initialScroll(view) {
    if (view.dataset.mode === 'team') { teamScrollInit(view.querySelector('.cal-tl')); return; }
    var sc = view.querySelector('.cal-scroll'); if (!sc || !view._range) return;
    var target = Math.min(C.workStart * 60, view._firstStart == null ? Infinity : view._firstStart);
    sc.scrollTop = Math.max(0, (target - view._range.start) * (hourH() / 60) - 6);
  }

  /* -------------------------------------------------------- transitions */
  function finishSlide() {
    if (!V || !V.slide) return;
    var sl = V.slide; V.slide = null; clearTimeout(sl.timer);
    sl.old.forEach(function (n) { n.remove(); });
    sl.neu.forEach(function (n) { n.classList.remove('is-anim'); n.style.transform = ''; n.style.opacity = ''; });
  }
  function finishMorph() {
    if (!V || !V.morph) return;
    var m = V.morph; V.morph = null; clearTimeout(m.timer);
    m.old.remove();
    m.neu.classList.remove('is-anim', 'is-entering'); m.neu.style.transform = ''; m.neu.style.opacity = ''; m.neu.style.transformOrigin = '';
  }
  function animateSwap(olds, neus, sgn, headIdx) {
    var reduce = reduceMotion();
    olds.forEach(function (n) { n.classList.add('is-leaving'); });
    void neus[0].offsetWidth;
    olds.concat(neus).forEach(function (n) { n.classList.add('is-anim'); });
    requestAnimationFrame(function () {
      neus.forEach(function (n) { n.style.transform = ''; n.style.opacity = ''; });
      olds.forEach(function (n, i) { n.style.opacity = '0'; if (!reduce) n.style.transform = 'translateX(' + (i === headIdx ? -12 * sgn : -24 * sgn) + 'px)'; });
    });
    V.slide = { old: olds, neu: neus, timer: setTimeout(finishSlide, reduce ? 160 : 360) };
  }
  function slideTo(dir, cx) {
    var view = V.view; if (!view) return;
    finishSlide(); finishMorph();
    var reduce = reduceMotion(), sgn = dir > 0 ? 1 : -1;
    if (V.mode === 'team') {
      var oldSc = view.querySelector('.cal-tl'), neuSc = buildTeamScroll(V.F, cx);
      view._counts = neuSc._counts;
      if (!reduce) neuSc.style.transform = 'translateX(' + (24 * sgn) + 'px)';
      neuSc.style.opacity = '0'; view.appendChild(neuSc); teamScrollInit(neuSc);
      animateSwap([oldSc], [neuSc], sgn, -1); return;
    }
    var layersEl = view.querySelector('.cal-layers');
    var oldGrid = layersEl.querySelector('.cal-layer'), neuGrid, neuHead = null, oldHead = null;
    if (V.mode === 'month') { neuGrid = renderMonth(V.iso, V.F, cx); view._counts = neuGrid._counts; }
    else {
      var r = renderPeriod(V.days, V.F, cx, {});
      neuGrid = r.grid; neuHead = r.head; setRange(view, r.range); view._range = r.range; view._counts = { total: r.total, mine: r.mine };
      var hl = view.querySelector('.cal-head__layers'); oldHead = hl.querySelector('.cal-hd');
      if (!reduce) neuHead.style.transform = 'translateX(' + (12 * sgn) + 'px)';
      neuHead.style.opacity = '0'; hl.appendChild(neuHead);
      if (V.mode === 'day') renderSide(view.querySelector('.cal-side'), V.iso, V.F, cx);
    }
    if (!reduce) neuGrid.style.transform = 'translateX(' + (24 * sgn) + 'px)';
    neuGrid.style.opacity = '0'; layersEl.appendChild(neuGrid);
    var olds = [oldGrid, oldHead].filter(Boolean), neus = [neuGrid, neuHead].filter(Boolean);
    animateSwap(olds, neus, sgn, 1);
  }
  function morphTo(cx, anchorIso) {
    var body = V.body, oldView = V.view;
    finishSlide(); finishMorph();
    var neu = buildView(V.mode, V.iso, V.F, cx);
    neu.classList.add('is-entering'); body.appendChild(neu); initialScroll(neu);
    var reduce = reduceMotion();
    var a = oldView.querySelector('.cal-anchor[data-day="' + anchorIso + '"]'), b = neu.querySelector('.cal-anchor[data-day="' + anchorIso + '"]');
    if (!reduce && a && b) {
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), rBody = body.getBoundingClientRect();
      var s = rb.width ? ra.width / rb.width : 1; if (s < 0.6 || s > 1.6) s = 1;
      var dx = (ra.left - rBody.left) - (rb.left - rBody.left) * s, dy = (ra.top - rBody.top) - (rb.top - rBody.top) * s;
      neu.style.transformOrigin = '0 0';
      neu.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
    }
    neu.style.opacity = '0';
    void neu.offsetWidth;
    neu.classList.add('is-anim'); oldView.classList.add('is-anim', 'is-leaving');
    requestAnimationFrame(function () {
      neu.style.transform = ''; neu.style.opacity = '';
      oldView.style.opacity = '0'; if (!reduce) oldView.style.transform = 'scale(.985)';
    });
    V.view = neu;
    V.morph = { old: oldView, neu: neu, timer: setTimeout(finishMorph, reduce ? 160 : 420) };
  }
  /** Vẽ lại kỳ hiện tại tại chỗ (không animation). */
  function refresh() {
    if (!V || !V.view) return;
    var cx = ctx(), view = V.view;
    finishSlide();
    if (V.mode === 'team') {
      var sc = view.querySelector('.cal-tl'); if (!sc) return;
      var sl = sc.scrollLeft, stp = sc.scrollTop, ae = document.activeElement, focusKey = ae && sc.contains(ae) ? (ae.dataset.event ? '.ev-pill[data-event="' + ae.dataset.event + '"]' : ae.dataset.iso ? '.cal-tl__cell[data-staff="' + ae.dataset.staff + '"][data-iso="' + ae.dataset.iso + '"]' : null) : null;
      var r = renderTeam(V.F, cx);
      sc.dataset.span = V.F.span; sc.dataset.density = teamPrefs().density;
      sc.querySelector('.cal-tl__inner').innerHTML = r.html; sc._counts = r; view._counts = r;
      rovingInit(sc);
      sc.scrollLeft = sl; sc.scrollTop = stp;
      if (focusKey) { var fn = sc.querySelector(focusKey); if (fn) { rovingSet(fn); fn.focus({ preventScroll: true }); } }
      flipIfPending(sc);
    } else {
      var layersEl = view.querySelector('.cal-layers');
      if (V.mode === 'month') { var m = renderMonth(V.iso, V.F, cx); layersEl.replaceChildren(m); view._counts = m._counts; }
      else {
        var p = renderPeriod(V.days, V.F, cx, { grow: false });
        layersEl.replaceChildren(p.grid); view.querySelector('.cal-head__layers').replaceChildren(p.head);
        setRange(view, p.range); view._range = p.range; view._counts = { total: p.total, mine: p.mine };
        if (V.mode === 'day') renderSide(view.querySelector('.cal-side'), V.iso, V.F, cx);
        flipIfPending(p.grid);
      }
    }
    syncBar(cx); updateNow();
  }
  /** Ẩn mờ 120ms các pill của lớp vừa tắt rồi vẽ lại. */
  function fadeThenRefresh(ids) {
    var list = ids && ids.length ? U.qsa('.ev-pill[data-cal]', V.body).filter(function (p) { return ids.indexOf(p.dataset.cal) >= 0; }) : [];
    if (!list.length || reduceMotion()) { refresh(); return; }
    list.forEach(function (p) { p.classList.add('is-hiding'); });
    clearTimeout(V.fadeTimer); V.fadeTimer = setTimeout(refresh, 130);
  }

  /* ---------------------------------------------------------- now-line */
  function updateNow() {
    if (!V || !V.view || V.mode === 'month') return;
    var view = V.view, cx = ctx(), st = S();
    if (V.mode === 'team') {
      var showT = V.F.span !== 'week' && V.iso === cx.today && cx.now >= TL_START && cx.now <= TL_END, left = pct(cx.now) + '%';
      U.qsa('.cal-tl__now', view).forEach(function (n) { n.style.left = left; n.hidden = !showT; });
      var lb = view.querySelector('.cal-tl__nowlbl'); if (lb) { lb.hidden = !showT; lb.style.left = left; lb.textContent = U.minToTime(cx.now); }
      if (V.iso === cx.today && V.F.span !== 'week') U.qsa('.cal-tl__bar .ev-pill', view).forEach(function (pill) { var ev = st.event(pill.dataset.event); if (!ev || ev.allDay) return; var s = evStart(ev), e = evEnd(ev); pill.classList.toggle('is-live', s <= cx.now && cx.now < e); pill.classList.toggle('is-past', e <= cx.now); });
      return;
    }
    var range = view._range; if (!range) return;
    var pxm = hourH() / 60, y = (cx.now - range.start) * pxm, show = cx.now >= range.start && cx.now <= range.end;
    var col = view.querySelector('.cal-col.is-today');
    U.qsa('.cal-now', view).forEach(function (n) { n.style.transform = 'translateY(' + y.toFixed(1) + 'px)'; n.hidden = !show; });
    var lbl = view.querySelector('.cal-now-label');
    if (lbl) { lbl.hidden = !(show && col); lbl.style.transform = 'translateY(calc(' + y.toFixed(1) + 'px - 50%))'; lbl.textContent = U.minToTime(cx.now); }
    if (!col) return;
    var nl = col.querySelector('.now-line');
    U.qsa('.cal-ev', col).forEach(function (w) {
      var ev = st.event(w.dataset.event), pill = w.querySelector('.ev-pill'); if (!ev || !pill) return;
      var s = evStart(ev), e = evEnd(ev);
      pill.classList.toggle('is-live', s <= cx.now && cx.now < e);
      pill.classList.toggle('is-past', e <= cx.now);
      if (nl && isMine(ev, cx.me) && s - cx.now > 0 && s - cx.now <= 15 && !V.pinged[ev.id]) {
        V.pinged[ev.id] = true; nl.classList.add('ping');
        nl.addEventListener('animationend', function () { nl.classList.remove('ping'); }, { once: true });
      }
    });
  }

  /* -------------------------------------------------------------- bar */
  function buildBar() {
    var st = S(), tp = teamPrefs();
    var bar = U.el('div', { class: 'cal-bar reveal', style: '--i:0' });
    var layerChips = [{ id: 'mine', label: 'Của tôi', icon: 'user' }, { id: 'team', label: 'Team tôi', icon: 'users' }, { id: 'all', label: 'Toàn công ty', icon: 'building' }].map(function (l) {
      return '<button type="button" class="chip chip--btn" data-layer="' + l.id + '" aria-pressed="false">' + UI.icon(l.icon, 13) + '<span>' + l.label + '</span></button>';
    }).join('');
    var teamChips = st.state.teams.map(function (t) {
      return '<button type="button" class="chip chip--btn chip--color" style="--chip:' + t.color + '" data-team="' + t.id + '" aria-pressed="false" data-tip="' + esc(t.desc || t.name) + '"><i class="chip__dot"></i><span>' + esc(t.name) + '</span></button>';
    }).join('');
    var typeChips = D.EVENT_TYPES.map(function (t) {
      return '<button type="button" class="chip chip--btn cal-tchip" data-type="' + t.id + '" aria-pressed="false" aria-label="' + esc(t.label) + '" data-tip="' + esc(t.label) + '">' + UI.icon(t.icon, 13) + '<span class="cal-tchip__lbl">' + esc(t.label) + '</span></button>';
    }).join('');
    var tTeams = st.state.teams.slice().sort(function (a, b) { return (a.id === 'exec' ? 0 : 1) - (b.id === 'exec' ? 0 : 1); });
    var teamRowChips = '<button type="button" class="chip chip--btn" data-tteam="" aria-pressed="false">' + UI.icon('building', 13) + '<span>Tất cả</span></button>' + tTeams.map(function (t) {
      return '<button type="button" class="chip chip--btn chip--color" style="--chip:' + t.color + '" data-tteam="' + t.id + '" aria-pressed="false" data-tip="' + esc(t.desc || t.name) + '"><i class="chip__dot"></i><span class="cal-tchip__lbl">' + esc(t.name) + '</span><span class="cal-tchip__short" aria-hidden="true">' + esc(t.short) + '</span></button>';
    }).join('');
    bar.innerHTML =
      '<div class="cal-bar__row cal-bar__main">' +
        '<div class="cal-bar__nav">' +
          '<button type="button" class="btn btn--secondary btn--sm cal-todaybtn" data-act="today" data-tip="Về hôm nay (T)">Hôm nay</button>' +
          '<span class="cal-bar__arrows"><button type="button" class="icon-btn icon-btn--sm" data-act="prev" aria-label="Kỳ trước (J)" data-tip="Kỳ trước · J">' + UI.icon('chevron-left', 17) + '</button><button type="button" class="icon-btn icon-btn--sm" data-act="next" aria-label="Kỳ sau (K)" data-tip="Kỳ sau · K">' + UI.icon('chevron-right', 17) + '</button></span>' +
          '<button type="button" class="cal-title" data-act="pick" aria-haspopup="dialog" aria-expanded="false"><span class="cal-title__txt t-h2"></span>' + UI.icon('chevron-down', 16) + '</button>' +
        '</div>' +
        '<div class="cal-bar__tools">' +
          '<button type="button" class="btn btn--secondary btn--sm cal-tool cal-tool--conf" data-act="conflicts" aria-haspopup="dialog" aria-expanded="false" hidden>' + UI.icon('alert-triangle', 15) + '<span class="cal-tool__lbl">Xung đột</span><span class="badge badge--red cal-tool__n">0</span></button>' +
          '<button type="button" class="btn btn--secondary btn--sm cal-tool cal-tool--cmp" data-act="compare" aria-haspopup="dialog" aria-expanded="false" data-tip="So sánh lịch 2–4 người">' + UI.icon('users', 15) + '<span class="cal-tool__lbl">So sánh</span><span class="badge badge--blue cal-tool__n" hidden>0</span></button>' +
          '<button type="button" class="btn btn--secondary btn--sm cal-tool cal-tool--lay" data-act="layers" aria-haspopup="dialog" aria-expanded="false" data-tip="Bật / tắt lớp lịch">' + UI.icon('layers', 15) + '<span class="cal-tool__lbl">Lớp lịch</span><span class="badge cal-tool__n" hidden></span></button>' +
          '<div class="cal-bar__seg"></div>' +
        '</div>' +
      '</div>' +
      '<div class="cal-bar__row cal-bar__filters">' +
        '<div class="cal-fgroup cal-fgroup--layer" role="group" aria-label="Phạm vi">' + layerChips + '</div>' +
        '<div class="cal-fgroup cal-fgroup--staff" hidden></div>' +
        '<i class="cal-sep" aria-hidden="true"></i>' +
        '<div class="cal-fgroup cal-fgroup--teams" role="group" aria-label="Lọc theo team">' + teamChips + '</div>' +
        '<i class="cal-sep" aria-hidden="true"></i>' +
        '<div class="cal-fgroup cal-fgroup--types" role="group" aria-label="Lọc theo loại sự kiện">' + typeChips + '</div>' +
        '<button type="button" class="link-btn cal-clear" data-act="clear" hidden>Bỏ lọc</button>' +
      '</div>' +
      '<div class="cal-bar__row cal-bar__team" hidden>' +
        '<div class="cal-fgroup cal-fgroup--tteams" role="group" aria-label="Chọn team">' + teamRowChips + '</div>' +
        '<button type="button" class="btn btn--secondary btn--sm cal-people" data-act="people" aria-haspopup="dialog" aria-expanded="false">' + UI.icon('user-plus', 15) + '<span class="cal-people__lbl">Chọn người…</span></button>' +
        '<i class="cal-sep" aria-hidden="true"></i>' +
        '<label class="switch switch--sm cal-toggle"><input type="checkbox" data-toggle="onlyBusy"' + (tp.onlyBusy ? ' checked' : '') + '><span class="switch__track"></span><span>Chỉ người có lịch</span></label>' +
        '<label class="switch switch--sm cal-toggle"><input type="checkbox" data-toggle="onlyConflict"' + (tp.onlyConflict ? ' checked' : '') + '><span class="switch__track"></span><span>Chỉ xung đột</span></label>' +
        '<span class="cal-bar__tright"><span class="cal-bar__span"></span><span class="cal-bar__density"></span></span>' +
      '</div>' +
      '<div class="cal-bar__row cal-bar__legend" hidden></div>' +
      '<div class="cal-bar__note" hidden></div>';
    var seg = UI.segmented([{ value: 'day', label: 'Ngày' }, { value: 'week', label: 'Tuần' }, { value: 'month', label: 'Tháng' }, { value: 'team', label: 'Đội ngũ', icon: 'users' }], V.mode, function (v) { go(v, V.iso, V.F); }, { cls: 'cal-seg', label: 'Chế độ xem' });
    U.qsa('.segmented__btn', seg).forEach(function (b, i) { b.setAttribute('data-tip', 'Phím ' + (i + 1)); });
    bar.querySelector('.cal-bar__seg').appendChild(seg);
    V.seg = seg;
    V.spanSeg = UI.segmented([{ value: 'day', label: 'Ngày' }, { value: 'week', label: 'Tuần' }], 'day', function (v) { go('team', V.iso, Object.assign({}, V.F, { span: v })); }, { cls: 'segmented--sm cal-spanseg', label: 'Khoảng thời gian' });
    bar.querySelector('.cal-bar__span').appendChild(V.spanSeg);
    V.densSeg = UI.segmented([{ value: 'comfortable', label: 'Thoải mái' }, { value: 'compact', label: 'Gọn' }], tp.density, function (v) { teamPrefs().density = v; saveTeamPrefs(); var sc = V.view && V.view.querySelector('.cal-tl'); if (sc) sc.dataset.density = v; }, { cls: 'segmented--sm cal-densseg', label: 'Mật độ' });
    bar.querySelector('.cal-bar__density').appendChild(V.densSeg);
    return bar;
  }
  /** Danh sách xung đột (hôm nay trở đi) của người đang xem / người trong bảng. */
  function conflictList(cx) {
    var st = S(), from = V.days[0], to = V.days[V.days.length - 1], people;
    if (V.mode === 'team') people = U.uniq(U.qsa('.cal-tl__row[data-staff]', V.view || document.createElement('div')).map(function (r) { return r.dataset.staff; }));
    else people = V.F.compare.length ? V.F.compare.slice() : [V.F.staff || cx.me.id];
    var seen = {}, out = [];
    people.forEach(function (id) {
      st.conflictsFor(id, from, to).forEach(function (c) {
        if (c.date < cx.today) return;
        var k = [c.a.id, c.b.id].sort().join('|');
        if (seen[k]) { if (seen[k].who.indexOf(id) < 0) seen[k].who.push(id); return; }
        seen[k] = Object.assign({ who: [id] }, c); out.push(seen[k]);
      });
    });
    return U.sortBy(out, function (c) { return (c.kind === 'hard' ? '0' : '1') + c.date + ' ' + c.a.start; });
  }
  function syncBar(cx) {
    var bar = V.bar, F = V.F, st = S(), team = V.mode === 'team';
    bar.querySelector('.cal-title__txt').textContent = titleFor(V.mode, V.iso);
    bar.querySelector('.cal-bar__filters').hidden = team;
    bar.querySelector('.cal-bar__team').hidden = !team;
    U.qsa('[data-layer]', bar).forEach(function (b) { var on = !F.staff && !F.compare.length && b.dataset.layer === F.layer; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    U.qsa('[data-team]', bar).forEach(function (b) { var on = F.teams.indexOf(b.dataset.team) >= 0; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    U.qsa('[data-type]', bar).forEach(function (b) { var on = F.types.indexOf(b.dataset.type) >= 0; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    U.qsa('[data-tteam]', bar).forEach(function (b) { var on = !F.people.length && b.dataset.tteam === F.team; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var pb = bar.querySelector('.cal-people'); pb.classList.toggle('is-active', F.people.length > 0); pb.querySelector('.cal-people__lbl').textContent = F.people.length ? F.people.length + ' người đã chọn' : 'Chọn người…';
    U.qsa('[data-toggle]', bar).forEach(function (i) { i.checked = !!teamPrefs()[i.dataset.toggle]; });
    if (V.spanSeg) V.spanSeg.setValue(F.span); if (V.densSeg) V.densSeg.setValue(teamPrefs().density);
    var staffWrap = bar.querySelector('.cal-fgroup--staff'), layerWrap = bar.querySelector('.cal-fgroup--layer');
    var person = F.staff && !F.compare.length ? st.staff(F.staff) : null;
    staffWrap.hidden = !person; layerWrap.hidden = !!person || F.compare.length > 0;
    if (person) staffWrap.innerHTML = '<span class="eyebrow cal-fgroup__lbl">Lịch của</span><span class="chip chip--person">' + UI.avatar(person, { size: 'xs', title: false }) + '<span>' + esc(U.shortName(person.name)) + '</span><button type="button" class="chip__x" data-act="clear-staff" aria-label="Bỏ lọc theo nhân sự">' + UI.icon('x', 12) + '</button></span>';
    else staffWrap.innerHTML = '';
    bar.querySelector('.cal-clear').hidden = !hasFilter(F);
    if (V.seg) { U.qsa('.segmented__btn', V.seg).forEach(function (b) { var on = b.dataset.value === V.mode; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.removeAttribute('aria-selected'); }); V.seg.refresh(); }
    var inPeriod = V.days.indexOf(cx.today) >= 0;
    bar.querySelector('.cal-todaybtn').classList.toggle('is-current', inPeriod);
    // Lớp lịch: n đang bật / tổng
    var cals = layerList(), hiddenN = cals.filter(function (c) { return F.hidden[c.id]; }).length;
    var lay = bar.querySelector('.cal-tool--lay'), layN = lay.querySelector('.cal-tool__n');
    lay.classList.toggle('is-active', hiddenN > 0); layN.hidden = !hiddenN; layN.textContent = (cals.length - hiddenN) + '/' + cals.length;
    lay.setAttribute('aria-label', 'Lớp lịch: ' + (cals.length - hiddenN) + ' trên ' + cals.length + ' đang hiện');
    // So sánh
    var cmpBtn = bar.querySelector('.cal-tool--cmp'), cmpN = cmpBtn.querySelector('.cal-tool__n');
    cmpBtn.classList.toggle('is-active', F.compare.length > 0); cmpN.hidden = !F.compare.length; cmpN.textContent = F.compare.length; cmpBtn.hidden = team;
    var legend = bar.querySelector('.cal-bar__legend');
    if (F.compare.length && !team) {
      legend.hidden = false;
      legend.innerHTML = '<span class="eyebrow cal-fgroup__lbl">So sánh</span>' + F.compare.map(function (id, i) { var s = st.staff(id); return s ? '<span class="chip chip--person cal-legend__chip" style="--cmp:' + CMP_HUES[i] + '">' + UI.avatar(s, { size: 'xs', title: false }) + '<span>' + esc(U.shortName(s.name)) + '</span><button type="button" class="chip__x" data-cmp-remove="' + id + '" aria-label="Bỏ ' + esc(s.name) + ' khỏi so sánh">' + UI.icon('x', 12) + '</button></span>' : ''; }).join('') +
        (F.compare.length < 4 ? '<button type="button" class="chip chip--btn" data-act="compare">' + UI.icon('plus', 12) + '<span>Thêm người</span></button>' : '') +
        '<span class="cal-legend__hint">' + (V.mode === 'month' ? 'Chỉ hiện sự kiện có người được chọn' : '<i class="cal-legend__sw"></i>ô xanh = mọi người cùng rảnh, bấm để đặt họp') + '</span>' +
        '<button type="button" class="link-btn cal-clear" data-act="compare-clear">Xoá so sánh</button>';
    } else { legend.hidden = true; legend.innerHTML = ''; }
    // Xung đột
    V.conflicts = conflictList(cx);
    var cf = bar.querySelector('.cal-tool--conf'); cf.hidden = !V.conflicts.length && !cf.__pop; cf.querySelector('.cal-tool__n').textContent = V.conflicts.length; // giữ nút khi popover đang mở để popover không mất neo
    cf.setAttribute('aria-label', V.conflicts.length + ' xung đột lịch');
    // Ghi chú ngày lễ hôm nay (tuần / tháng)
    var note = bar.querySelector('.cal-bar__note'), holToday = st.holidayName(cx.today);
    if (holToday && V.mode !== 'day' && inPeriod) {
      var nw = nextWorkday(cx.today);
      note.hidden = false;
      note.innerHTML = '<div class="banner cal-note">' + UI.icon('flag', 15) + '<span>Hôm nay nghỉ lễ <b>' + esc(holToday) + '</b> — cả công ty nghỉ. Ngày làm việc tiếp theo: <b>' + esc(U.weekdayLong(U.fromISO(nw)) + ' ' + U.fmtDate(nw, 'dm')) + '</b>.</span><button type="button" class="link-btn" data-go-day="' + nw + '">Xem ngày đó ' + UI.icon('arrow-right', 13) + '</button></div>';
    } else { note.hidden = true; note.innerHTML = ''; }
    var c = V.view && V.view._counts || { total: 0, mine: 0 };
    var sub = team ? 'Đội ngũ · ' + titleFor(V.mode, V.iso) + ' · ' + (c.people || 0) + ' người · ' + c.total + ' sự kiện' + (c.conflicts ? ' · ' + c.conflicts + ' xung đột' : '')
      : titleFor(V.mode, V.iso) + ' · ' + c.total + ' sự kiện' + (c.mine ? ' · ' + c.mine + ' của bạn' : '') + (person ? ' · lịch của ' + U.shortName(person.name) : '') + (F.compare.length ? ' · so sánh ' + F.compare.length + ' người' : '');
    Z15.app.setTitle('Lịch', sub);
  }

  /* ------------------------------------------------------- lớp lịch */
  /** Lớp lịch có sẵn + lớp phát hiện trong kỳ (cá nhân người khác, dự án đã xong), kèm số sự kiện. */
  function layerList() {
    var st = S(), base = st.calendars(), byId = {}, counts = {};
    base.forEach(function (c) { byId[c.id] = c; });
    var from = V.days[0], to = V.days[V.days.length - 1];
    st.eventsBetween(from, to).forEach(function (e) { var id = calId(e); counts[id] = (counts[id] || 0) + 1; if (!byId[id]) { byId[id] = st.calendarOf(e); base.push(byId[id]); } });
    return base.map(function (c) { return Object.assign({ count: counts[c.id] || 0 }, c); });
  }
  function openLayers(anchor) {
    var pop = UI.popover(anchor, '', { placement: 'bottom-end', cls: 'popover--cal popover--layers', width: 320, ariaLabel: 'Lớp lịch', focus: false });
    function draw() {
      var F = V.F, cals = layerList(), order = ['company', 'exec', 'personal', 'team', 'project', 'other'], groups = U.groupBy(cals, function (c) { return order.indexOf(c.kind) >= 0 ? c.kind : 'other'; });
      pop.el.innerHTML = '<div class="cal-lay"><div class="cal-lay__head"><b>Lớp lịch</b><span class="cal-lay__acts"><button type="button" class="link-btn" data-lay-all>Tất cả</button><button type="button" class="link-btn" data-lay-none>Bỏ chọn</button></span></div><div class="cal-lay__list">' +
        order.filter(function (k) { return groups[k]; }).map(function (k) {
          return '<div class="cal-lay__grp"><div class="menu__heading">' + KIND_LABEL[k] + (groups[k].length > 1 ? ' · ' + groups[k].length : '') + '</div>' + groups[k].map(function (c) {
            var hidden = !!F.hidden[c.id];
            return '<div class="cal-lay__row' + (hidden ? ' is-off' : '') + '" data-lay="' + esc(c.id) + '"><label class="cal-lay__main" title="Alt + bấm: chỉ hiện lớp này"><input type="checkbox" class="cal-lay__cb"' + (hidden ? '' : ' checked') + ' aria-label="' + esc(c.name) + '"><i class="cal-lay__sw" style="--c:' + c.color + '"></i><span class="cal-lay__name truncate">' + esc(c.name) + '</span><span class="cal-lay__n mono-sm tnum" title="Sự kiện trong kỳ đang xem">' + c.count + '</span></label><button type="button" class="link-btn cal-lay__only" data-lay-only="' + esc(c.id) + '" aria-label="Chỉ hiện ' + esc(c.name) + '">Chỉ</button></div>';
          }).join('') + '</div>';
        }).join('') + '</div><div class="cal-lay__foot muted">Ẩn lớp áp dụng cho mọi chế độ xem và được ghi nhớ trên máy này.</div></div>';
      pop.reposition();
    }
    function commit(nowHidden) {
      var prev = V.F.hidden, ids = Object.keys(nowHidden).filter(function (k) { return nowHidden[k] && !prev[k]; });
      V.F.hidden = nowHidden; saveHidden(nowHidden); draw(); fadeThenRefresh(ids);
    }
    function isolate(id) { var m = {}; layerList().forEach(function (c) { if (c.id !== id) m[c.id] = true; }); commit(m); }
    draw();
    pop.el.addEventListener('change', function (e) {
      var cb = e.target.closest('.cal-lay__cb'); if (!cb) return;
      var id = cb.closest('[data-lay]').dataset.lay, m = Object.assign({}, V.F.hidden);
      if (cb.checked) delete m[id]; else m[id] = true;
      commit(m);
    });
    pop.el.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-lay-only]'))) { isolate(t.dataset.layOnly); return; }
      if (e.target.closest('[data-lay-all]')) { commit({}); return; }
      if (e.target.closest('[data-lay-none]')) { var m = {}; layerList().forEach(function (c) { m[c.id] = true; }); commit(m); return; }
      if (e.altKey && (t = e.target.closest('.cal-lay__main'))) { e.preventDefault(); isolate(t.closest('[data-lay]').dataset.lay); }
    });
    return pop;
  }

  /* ------------------------------------------------------- so sánh */
  function applyCompare(ids, silent) {
    var F = Object.assign({}, V.F, { compare: ids.slice(0, 4) });
    if (silent && V.mode !== 'team') { V.F = F; silentRoute(F); refresh(); } else go(V.mode, V.iso, F);
  }
  function openCompare(anchor) {
    var wrap = U.el('div', { class: 'cal-cmp' });
    wrap.innerHTML = '<div class="cal-lay__head"><b>So sánh lịch</b><small class="muted">Chọn 2–4 người · ô xanh là giờ mọi người cùng rảnh</small></div><div class="cal-cmp__slot"></div><div class="cal-cmp__foot"><button type="button" class="btn btn--ghost btn--sm" data-cmp-clear>Xoá so sánh</button><button type="button" class="btn btn--soft btn--sm" data-cmp-done>Xong</button></div>';
    var picker = E().staffPicker(V.F.compare, { max: 4, onChange: function (ids) { applyCompare(ids, true); } });
    wrap.querySelector('.cal-cmp__slot').appendChild(picker);
    var pop = UI.popover(anchor, wrap, { placement: 'bottom-end', cls: 'popover--cal popover--compare', width: 360, ariaLabel: 'So sánh lịch' });
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-cmp-done]')) pop.close();
      if (e.target.closest('[data-cmp-clear]')) { pop.close(); applyCompare([], false); }
    });
    return pop;
  }
  function openPeople(anchor) {
    var wrap = U.el('div', { class: 'cal-cmp' });
    wrap.innerHTML = '<div class="cal-lay__head"><b>Chọn người</b><small class="muted">Thay cho bộ lọc team</small></div><div class="cal-cmp__slot"></div><div class="cal-cmp__foot"><button type="button" class="btn btn--ghost btn--sm" data-cmp-clear>Bỏ chọn</button><button type="button" class="btn btn--soft btn--sm" data-cmp-done>Xong</button></div>';
    var picker = E().staffPicker(V.F.people, { onChange: function (ids) { V.F = Object.assign({}, V.F, { people: ids }); silentRoute(V.F); refresh(); } });
    wrap.querySelector('.cal-cmp__slot').appendChild(picker);
    var pop = UI.popover(anchor, wrap, { placement: 'bottom-start', cls: 'popover--cal popover--compare', width: 360, ariaLabel: 'Chọn người' });
    wrap.addEventListener('click', function (e) {
      if (e.target.closest('[data-cmp-done]')) pop.close();
      if (e.target.closest('[data-cmp-clear]')) { pop.close(); go('team', V.iso, Object.assign({}, V.F, { people: [] })); }
    });
    return pop;
  }

  /* ------------------------------------------------------- xung đột */
  function laterOf(c) { var pa = c.a.priority || 2, pb = c.b.priority || 2; if (pa !== pb) return pa > pb ? c.a : c.b; return evStart(c.b) >= evStart(c.a) ? c.b : c.a; }
  function openConflicts(anchor) {
    var pop = UI.popover(anchor, '', { placement: 'bottom-end', cls: 'popover--cal popover--conf', width: 380, ariaLabel: 'Xung đột lịch', focus: false, onClose: function () { if (V && V.bar) syncBar(ctx()); } });
    function draw() {
      var cx = ctx(), st = S(), list = V.conflicts = conflictList(cx);
      pop.el.innerHTML = '<div class="cal-cf"><div class="cal-lay__head"><b>Xung đột lịch</b><small class="muted">' + list.length + ' · từ hôm nay trong kỳ đang xem</small></div>' +
        (list.length ? '<div class="cal-cf__list">' + list.map(function (c) {
          var later = laterOf(c), who = c.who.map(st.staff).filter(Boolean);
          return '<div class="cal-cf__item" data-kind="' + c.kind + '"><div class="cal-cf__top"><span class="chip chip--xs ' + (c.kind === 'hard' ? 'chip--red' : 'chip--warn') + '">' + esc(U.fmtDate(c.date, 'shortWeekday')) + '</span><span class="cal-cf__ov mono-sm">' + (c.kind === 'hard' ? 'trùng ' : 'đè tập trung ') + c.overlap + "'" + '</span><span class="cal-cf__who">' + UI.avatarStack(who, { max: 3, size: 'xs' }) + '</span></div>' +
            '<div class="cal-cf__pills">' + pillHtml(c.a, { compact: true, cls: 'cal-pill' + (c.a.id === later.id ? ' is-conflict' : ''), people: false }, cx) + pillHtml(c.b, { compact: true, cls: 'cal-pill' + (c.b.id === later.id ? ' is-conflict' : ''), people: false }, cx) + '</div>' +
            '<div class="cal-cf__acts"><button type="button" class="btn btn--sm btn--secondary" data-cf-resolve="' + later.id + '">' + UI.icon('repeat', 13) + 'Dời sang giờ trống</button><button type="button" class="btn btn--sm btn--ghost" data-cf-open="' + later.id + '">Mở</button></div></div>';
        }).join('') + '</div>' : '<div class="cal-cf__empty muted">' + UI.icon('check-circle', 16) + ' Không còn xung đột nào.</div>') + '</div>';
      pop.reposition();
    }
    draw();
    pop.el.addEventListener('click', function (e) {
      var t, st = S();
      if ((t = e.target.closest('[data-cf-resolve]'))) {
        var ev = st.event(t.dataset.cfResolve); if (!ev) return;
        var oldDate = ev.date, oldStart = evStart(ev), pick = st.resolveConflict(ev.id);
        if (!pick) { UI.toast('Không tìm được giờ trống chung cho “' + ev.title + '” trong 3 ngày tới', { kind: 'warning' }); return; }
        UI.toast('Đã dời “' + ev.title + '” sang ' + U.fmtDate(pick.date, 'shortWeekday') + ' ' + pick.startLabel + ' – ' + pick.endLabel, { kind: 'success', action: { label: 'Hoàn tác', onClick: function () { st.moveEvent(ev.id, oldDate, oldStart); UI.toast('Đã đưa “' + ev.title + '” về chỗ cũ', { kind: 'info' }); } } });
        draw(); return;
      }
      if ((t = e.target.closest('[data-cf-open]'))) { pop.close(); E().eventDetail(t.dataset.cfOpen); return; }
      if ((t = e.target.closest('.ev-pill[data-event]'))) { pop.close(); E().eventDetail(t.dataset.event); }
    });
    return pop;
  }

  /* -------------------------------------------------------- mini month */
  function openPicker(anchor) {
    var cur = U.fromISO(V.iso), shown = new Date(cur.getFullYear(), cur.getMonth(), 1);
    var pop = UI.popover(anchor, '', { placement: 'bottom-start', cls: 'popover--calpick', width: 292, focus: false });
    function draw() {
      var days = U.monthGrid(shown), today = U.todayISO(), m = shown.getMonth(), st = S();
      pop.el.innerHTML = '<div class="cal-pick"><div class="cal-pick__head"><button type="button" class="icon-btn icon-btn--sm" data-nav="-1" aria-label="Tháng trước">' + UI.icon('chevron-left', 16) + '</button><b>' + esc(U.fmtDate(shown, 'monthYear')) + '</b><button type="button" class="icon-btn icon-btn--sm" data-nav="1" aria-label="Tháng sau">' + UI.icon('chevron-right', 16) + '</button></div>' +
        '<div class="cal-pick__grid">' + U.WEEKDAYS_SHORT.map(function (w) { return '<span class="cal-pick__wd">' + w + '</span>'; }).join('') +
        days.map(function (dt) { var k = U.toISO(dt), hol = st.holidayName(k); return '<button type="button" class="cal-pick__d' + (dt.getMonth() !== m ? ' is-out' : '') + (k === today ? ' is-today' : '') + (k === V.iso ? ' is-selected' : '') + (U.isWeekend(dt) ? ' is-weekend' : '') + (hol ? ' is-holiday' : '') + '" data-iso="' + k + '" aria-label="' + esc(U.fmtDate(dt, 'long') + (hol ? ' · ' + hol : '')) + '">' + dt.getDate() + '</button>'; }).join('') + '</div>' +
        '<div class="cal-pick__foot"><button type="button" class="btn btn--ghost btn--sm" data-iso="' + today + '">Hôm nay</button><span class="cal-pick__hint">Nhấn để nhảy tới ngày</span></div></div>';
      pop.reposition();
    }
    draw();
    pop.el.addEventListener('click', function (e) {
      var n = e.target.closest('[data-nav]'); if (n) { shown = U.addMonths(shown, +n.dataset.nav); draw(); return; }
      var b = e.target.closest('[data-iso]'); if (b) { pop.close(); go(V.mode, b.dataset.iso, V.F); }
    });
    return pop;
  }

  /* --------------------------------------------------------- drag & drop */
  function settleGhost(pf, toEl, done) {
    var r = toEl.getBoundingClientRect(), g = pf.ghost, reduce = reduceMotion();
    var finish = function () { if (pf.layerEl.parentNode) pf.layerEl.remove(); done && done(); };
    if (reduce) { finish(); return; }
    g.classList.add('is-settle');
    g.style.transform = 'translate3d(' + r.left.toFixed(1) + 'px,' + r.top.toFixed(1) + 'px,0) scale(' + (r.width / pf.w).toFixed(4) + ',' + (r.height / pf.h).toFixed(4) + ')';
    U.onceTransitionEnd(g, finish, 320);
  }
  function flipIfPending(grid) {
    if (!V.pendingFlip) return;
    var pf = V.pendingFlip; V.pendingFlip = null;
    var wrap = grid.querySelector('.cal-ev[data-event="' + pf.id + '"], .cal-tl__bar[data-event="' + pf.id + '"]');
    if (!wrap) { pf.layerEl.remove(); return; }
    wrap.classList.add('is-settling');
    settleGhost(pf, wrap, function () {
      wrap.classList.remove('is-settling');
      if (!reduceMotion()) { wrap.classList.add('cell-flash'); setTimeout(function () { wrap.classList.remove('cell-flash'); }, 480); }
    });
  }
  function bindDrag(root) {
    var d = null;
    function colAt(x, cols) {
      for (var i = 0; i < cols.length; i++) if (x >= cols[i].left && x < cols[i].right) return cols[i];
      return x < cols[0].left ? cols[0] : cols[cols.length - 1];
    }
    function autoScroll() {
      var sc = d.scroll; if (!sc) return;
      var r = sc.getBoundingClientRect();
      if (d.y < r.top + 48 && sc.scrollTop > 0) sc.scrollTop -= 8;
      else if (d.y > r.bottom - 48) sc.scrollTop += 8;
    }
    function tick() {
      if (!d || !d.active) return;
      var lr = d.layer.getBoundingClientRect(), reduce = reduceMotion();
      autoScroll();
      if (d.mode === 'move') {
        var col = colAt(d.x, d.cols);
        var start = U.clamp(snap(d.range.start + (d.y - d.grabY - lr.top) / d.pxm), d.range.start, Math.max(d.range.start, d.range.end - d.dur));
        d.target = { iso: col.iso, start: start };
        d.tx = col.left + 2; d.ty = lr.top + (start - d.range.start) * d.pxm;
        if (d.colW !== col.width) { d.colW = col.width; d.ghost.style.width = (col.width - 4) + 'px'; }
        var conf = conflictsFor(d.ev, col.iso, start, start + d.dur);
        if ((conf.length > 0) !== d.hasConflict) { d.hasConflict = conf.length > 0; d.ghostPill.classList.toggle('is-conflict', d.hasConflict); }
        d.conf = conf;
        var t = reduce ? 1 : 0.35;
        d.cx = U.lerp(d.cx, d.tx, t); d.cy = U.lerp(d.cy, d.ty, t);
        d.ghost.style.transform = 'translate3d(' + d.cx.toFixed(1) + 'px,' + d.cy.toFixed(1) + 'px,0)';
        var label = U.minToTime(start) + ' – ' + U.minToTime(start + d.dur);
        if (d.timeEl.textContent !== label) d.timeEl.textContent = label;
      } else {
        var cur = U.clamp(snap(d.range.start + (d.y - lr.top) / d.pxm), d.range.start, d.range.end);
        var a = Math.min(d.anchorMin, cur), b = Math.max(d.anchorMin, cur);
        if (b - a < SNAP) { b = a + SNAP; if (b > d.range.end) { b = d.range.end; a = b - SNAP; } }
        d.selStart = a; d.selEnd = b;
        d.sel.style.transform = 'translateY(' + ((a - d.range.start) * d.pxm).toFixed(1) + 'px)';
        d.sel.style.height = ((b - a) * d.pxm).toFixed(1) + 'px';
        var lbl = U.minToTime(a) + ' – ' + U.minToTime(b);
        if (d.selLbl.textContent !== lbl) d.selLbl.textContent = lbl;
      }
      d.raf = requestAnimationFrame(tick);
    }
    function startDrag() {
      d.active = true;
      try { root.setPointerCapture(d.id); } catch (err) { /* noop */ }
      d.pxm = hourH() / 60; d.range = V.view._range;
      if (!d.range) { d.active = false; return; }
      d.cols = U.qsa('.cal-col', d.layer).map(function (c) { var r = c.getBoundingClientRect(); return { el: c, iso: c.dataset.day, left: r.left, right: r.right, width: r.width }; });
      d.scroll = d.layer.closest('.cal-scroll');
      document.body.classList.add('cal-dragging');
      if (d.mode === 'move') {
        var ev = S().event(d.wrap.dataset.event); if (!ev) { d.active = false; return; }
        d.ev = ev; d.dur = Math.max(evEnd(ev) - evStart(ev), SNAP);
        var r = d.wrap.getBoundingClientRect();
        d.grabY = d.y0 - r.top; d.w = r.width; d.h = r.height;
        d.layerEl = U.el('div', { class: 'drag-layer' });
        d.ghost = d.wrap.cloneNode(true); d.ghost.className = 'cal-ev cal-ghost drag-ghost'; d.ghost.removeAttribute('data-event');
        d.ghost.style.cssText = 'width:' + r.width + 'px;height:' + r.height + 'px;transform:translate3d(' + r.left + 'px,' + r.top + 'px,0)';
        d.ghostPill = d.ghost.querySelector('.ev-pill'); d.ghostPill.classList.remove('is-dragging', 'is-past');
        d.timeEl = U.el('span', { class: 'cal-ghost__time', text: U.fmtTimeRange(ev.start, ev.end) }); d.ghost.appendChild(d.timeEl);
        d.layerEl.appendChild(d.ghost); document.body.appendChild(d.layerEl);
        d.pill = d.wrap.querySelector('.ev-pill'); d.pill.classList.add('is-dragging');
        d.cx = r.left; d.cy = r.top; d.tx = r.left; d.ty = r.top; d.colW = -1; d.hasConflict = false;
        d.origin = { iso: ev.date, start: evStart(ev) }; d.target = { iso: ev.date, start: evStart(ev) };
      } else {
        var lr = d.layer.getBoundingClientRect();
        d.anchorMin = U.clamp(floorSnap(d.range.start + (d.y0 - lr.top) / d.pxm), d.range.start, d.range.end - SNAP);
        d.sel = U.el('div', { class: 'cal-select', 'aria-hidden': 'true' });
        d.selLbl = U.el('span', { class: 'cal-select__time' }); d.sel.appendChild(d.selLbl);
        d.col.appendChild(d.sel); d.selIso = d.col.dataset.day;
      }
      d.raf = requestAnimationFrame(tick);
    }
    function endDrag(cancel) {
      var dd = d; d = null;
      cancelAnimationFrame(dd.raf); document.body.classList.remove('cal-dragging');
      try { root.releasePointerCapture(dd.id); } catch (err) { /* noop */ }
      V.justDragged = true; setTimeout(function () { if (V) V.justDragged = false; }, 0);
      if (dd.mode === 'draw') {
        dd.sel.remove();
        if (!cancel && dd.selEnd > dd.selStart) openNew(dd.selIso, dd.selStart, dd.selEnd);
        return;
      }
      var same = dd.target.iso === dd.origin.iso && dd.target.start === dd.origin.start;
      if (cancel || same) {
        settleGhost(dd, dd.wrap, function () { dd.pill.classList.remove('is-dragging'); });
        return;
      }
      var ev = dd.ev, target = dd.target, origin = dd.origin, conf = dd.conf || [];
      V.pendingFlip = { id: ev.id, ghost: dd.ghost, layerEl: dd.layerEl, w: dd.w, h: dd.h };
      S().moveEvent(ev.id, target.iso, target.start);
      if (V.pendingFlip) { V.pendingFlip = null; dd.layerEl.remove(); }
      var where = U.fmtDate(target.iso, 'shortWeekday') + ' ' + U.minToTime(target.start);
      var undo = { label: 'Hoàn tác', onClick: function () { S().moveEvent(ev.id, origin.iso, origin.start); UI.toast('Đã đưa “' + ev.title + '” về chỗ cũ', { kind: 'info' }); } };
      if (conf.length) {
        var ids = U.uniq([].concat.apply([], conf.map(function (c) { return c.staff; }))), names = ids.slice(0, 2).map(function (id) { var s = S().staff(id); return s ? U.shortName(s.name) : ''; }).filter(Boolean);
        var who = names.join(', ') + (ids.length > 2 ? ' +' + (ids.length - 2) : '');
        UI.toast('Đã dời “' + ev.title + '” sang ' + where + ' — trùng “' + conf[0].ev.title + '” · vẫn giữ?', { kind: 'warning', title: 'Trùng lịch với ' + who, action: undo, duration: 8000 });
      } else UI.toast('Đã dời “' + ev.title + '” sang ' + where, { kind: 'success', action: undo });
    }
    root.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.pointerType === 'touch' || d) return;
      if (V.slide || V.morph) return;
      var col = e.target.closest('.cal-col'); if (!col) return;
      if (e.target.closest('.cal-empty, .cal-more')) return;
      var wrap = e.target.closest('.cal-ev'), layer = col.closest('.cal-layer');
      if (!layer || layer.classList.contains('is-leaving')) return;
      d = { mode: wrap ? 'move' : 'draw', wrap: wrap, col: col, layer: layer, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
    });
    root.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      d.x = e.clientX; d.y = e.clientY;
      if (!d.active) { if (Math.abs(d.x - d.x0) < 4 && Math.abs(d.y - d.y0) < 4) return; startDrag(); }
    });
    root.addEventListener('pointerup', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) endDrag(false); else d = null; });
    root.addEventListener('pointercancel', function (e) { if (!d || e.pointerId !== d.id) return; if (d.active) endDrag(true); else d = null; });
    root.addEventListener('click', function (e) { if (V && V.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    return { cancel: function () { if (d && d.active) endDrag(true); else d = null; }, isDragging: function () { return !!(d && d.active); } };
  }

  /* --------------------------------------------------------- interactions */
  function openNew(iso, startMin, endMin, extra) {
    var me = S().me().id, att = [me];
    if (V.F.compare.length) att = V.F.compare.slice();
    else if (V.F.staff && V.F.staff !== me) att.push(V.F.staff);
    E().event(null, Object.assign({ date: iso, start: U.minToTime(startMin), end: U.minToTime(endMin), attendeeIds: att }, extra || {}));
  }
  function setFilters(patch) {
    var F = Object.assign({}, V.F, patch);
    savePrefs(F);
    go(V.mode, V.iso, F);
  }
  function toggleMine() { setFilters({ layer: V.F.layer === 'mine' ? 'all' : 'mine', staff: '', compare: [] }); }
  function nav(dir) { go(V.mode, stepDate(V.mode, V.iso, dir), V.F); }
  function toggleGroup(teamId) {
    var tp = teamPrefs(), i = tp.collapsed.indexOf(teamId), collapsed = i < 0;
    if (collapsed) tp.collapsed.push(teamId); else tp.collapsed.splice(i, 1);
    saveTeamPrefs();
    var sc = V.view.querySelector('.cal-tl'); if (!sc) return;
    var grow = sc.querySelector('.cal-tl__grow[data-team="' + teamId + '"]'); if (grow) { grow.classList.toggle('is-collapsed', collapsed); grow.querySelector('.cal-tl__gbtn').setAttribute('aria-expanded', String(!collapsed)); }
    var n = grow ? grow.nextElementSibling : null;
    while (n && n.classList.contains('cal-tl__row')) { n.hidden = collapsed; n = n.nextElementSibling; }
    rovingInit(sc);
  }
  function bindEvents(root) {
    root.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-act]'))) {
        var act = t.dataset.act;
        if (act === 'today') return go(V.mode, U.todayISO(), V.F);
        if (act === 'prev') return nav(-1);
        if (act === 'next') return nav(1);
        if (act === 'pick') return void openPicker(t);
        if (act === 'layers') return void openLayers(t);
        if (act === 'compare') return void openCompare(t);
        if (act === 'compare-clear') return applyCompare([], false);
        if (act === 'conflicts') return void openConflicts(t);
        if (act === 'people') return void openPeople(t);
        if (act === 'clear') return setFilters({ layer: 'all', teams: [], types: [], staff: '', compare: [] });
        if (act === 'clear-staff') return setFilters({ staff: '' });
        if (act === 'new') { var iso = (V.mode === 'week' || (V.mode === 'team' && V.F.span === 'week')) && V.days.indexOf(U.todayISO()) >= 0 ? U.todayISO() : V.iso; return openNew(iso, 9 * 60, 10 * 60); }
      }
      if ((t = e.target.closest('[data-cmp-remove]'))) return applyCompare(V.F.compare.filter(function (id) { return id !== t.dataset.cmpRemove; }), false);
      if ((t = e.target.closest('[data-layer]'))) return setFilters({ layer: t.dataset.layer, staff: '', compare: [] });
      if ((t = e.target.closest('[data-team]')) && t.classList.contains('chip--btn')) {
        var teams = V.F.teams.slice(), i = teams.indexOf(t.dataset.team); if (i >= 0) teams.splice(i, 1); else teams.push(t.dataset.team);
        return setFilters({ teams: teams });
      }
      if ((t = e.target.closest('[data-type]')) && t.classList.contains('chip--btn')) {
        var types = V.F.types.slice(), j = types.indexOf(t.dataset.type); if (j >= 0) types.splice(j, 1); else types.push(t.dataset.type);
        return setFilters({ types: types });
      }
      if ((t = e.target.closest('[data-tteam]')) && t.classList.contains('chip--btn')) return go('team', V.iso, Object.assign({}, V.F, { team: t.dataset.tteam, people: [] }));
      if ((t = e.target.closest('[data-tl-group]'))) return toggleGroup(t.dataset.tlGroup);
      if ((t = e.target.closest('[data-go-teamday]'))) return go('team', t.dataset.goTeamday, Object.assign({}, V.F, { span: 'day' }));
      if ((t = e.target.closest('[data-go-week]'))) return go('week', t.dataset.goWeek, V.F);
      if ((t = e.target.closest('[data-go-day]'))) return go('day', t.dataset.goDay, V.F);
      if ((t = e.target.closest('.cal-dh'))) return go('day', t.dataset.day, V.F);
      if ((t = e.target.closest('.cal-freecell'))) {
        var fs = +t.dataset.freeStart, fe = +t.dataset.freeEnd, r = t.getBoundingClientRect();
        var at = U.clamp(Math.floor((fs + (e.clientY - r.top) / r.height * (fe - fs)) / 30) * 30, fs, Math.max(fs, fe - 30));
        return openNew(t.dataset.freeDay, at, Math.min(at + 60, fe), { attendeeIds: V.F.compare.slice() });
      }
      if ((t = e.target.closest('.cal-tl__cell'))) { if (e.target.closest('.ev-pill')) return; rovingSet(t); return go('team', t.dataset.iso, Object.assign({}, V.F, { span: 'day' })); }
      if ((t = e.target.closest('.cal-tl__track'))) {
        if (e.target.closest('.cal-tl__bar')) return;
        var tr = t.getBoundingClientRect(), min = U.clamp(floorSnap(TL_START + (e.clientX - tr.left) / tr.width * TL_SPAN), TL_START, TL_END - 60);
        var me = S().me().id;
        return void E().event(null, { date: t.dataset.iso, start: U.minToTime(min), end: U.minToTime(min + 60), attendeeIds: U.uniq([t.dataset.staff, me]) });
      }
      if ((t = e.target.closest('[data-staff-open]'))) { if (e.target.closest('.avatar[data-staff]')) return; return void E().staffProfile(t.dataset.staffOpen); }
    });
    root.addEventListener('change', function (e) {
      var tg = e.target.closest('[data-toggle]');
      if (tg) { teamPrefs()[tg.dataset.toggle] = tg.checked; saveTeamPrefs(); refresh(); return; }
      var sel = e.target.closest('.cal-side__time'); if (!sel) return;
      V.freeSlot = sel.value;
      var cx = ctx(), wrap = root.querySelector('.cal-side__free'), ttl = root.querySelector('.cal-side__free-title');
      if (wrap) wrap.innerHTML = freeListHtml(V.iso, sel.value, cx);
      if (ttl) ttl.textContent = sel.value === 'now' ? 'Ai đang rảnh' : 'Ai rảnh';
    });
    root.addEventListener('dblclick', function (e) {
      var col = e.target.closest('.cal-col');
      if (col && !e.target.closest('.cal-ev, .cal-empty, .cal-more, .cal-freecell')) {
        var range = V.view._range; if (!range) return;
        var lr = col.getBoundingClientRect(), min = U.clamp(floorSnap(range.start + (e.clientY - lr.top) / (hourH() / 60)), range.start, range.end - 60);
        openNew(col.dataset.day, min, min + 60); return;
      }
      var mc = e.target.closest('.cal-mc');
      if (mc && !e.target.closest('.ev-pill, button')) openNew(mc.dataset.day, 9 * 60, 10 * 60);
    });
    root.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('.cal-tl .ev-pill, .cal-tl__cell'); if (t) rovingSet(t); });
    root.addEventListener('keydown', function (e) {
      if (e.target.closest && e.target.closest('.cal-tl')) { teamKeydown(e); return; }
      var dh = e.target.closest && e.target.closest('.cal-mc__num, .cal-dh');
      if (!dh) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); var sib = e.key === 'ArrowLeft' ? dh.parentElement.previousElementSibling : dh.parentElement.nextElementSibling; var nx = dh.classList.contains('cal-dh') ? (e.key === 'ArrowLeft' ? dh.previousElementSibling : dh.nextElementSibling) : (sib && sib.querySelector('.cal-mc__num')); if (nx && nx.focus && !nx.classList.contains('cal-hd__gutter')) nx.focus(); }
    });
  }

  /* -------------------------------------------------------------- route */
  function applyRoute(route, first) {
    var p = parseRoute(route), cx = ctx();
    var prevMode = V.mode, prevKey = V.key, prevIso = V.iso;
    V.mode = p.mode; V.iso = p.iso; V.F = p.F; V.narrow = isNarrow();
    V.days = daysFor(p.mode, p.iso); V.key = periodKey(p.mode, p.iso);
    U.saveJSON(PREF_MODE, p.mode);
    if (first || !V.view) { V.view = buildView(p.mode, p.iso, p.F, cx); V.body.appendChild(V.view); initialScroll(V.view); }
    else if (p.mode !== prevMode) morphTo(cx, p.iso);
    else if (V.key !== prevKey) slideTo(p.iso >= prevIso ? 1 : -1, cx);
    else refresh();
    syncBar(cx); updateNow();
  }

  /* ---------------------------------------------------------------- view */
  Z15.views.calendar = {
    title: 'Lịch',
    render: function (container, route) {
      if (V) this.destroy();
      V = { root: null, bar: null, body: null, view: null, mode: null, iso: null, F: null, days: [], key: null, slide: null, morph: null, pinged: {}, unregs: [], timers: [], freeSlot: null, pendingFlip: null, justDragged: false, tp: null, tlFocus: null, conflicts: [] };
      var root = U.el('div', { class: 'cal' });
      V.root = root;
      var p0 = parseRoute(route); V.mode = p0.mode; V.F = p0.F; V.iso = p0.iso;
      V.bar = buildBar();
      V.body = U.el('div', { class: 'cal-body reveal', style: '--i:1' });
      root.appendChild(V.bar); root.appendChild(V.body);
      container.appendChild(root);
      bindEvents(root);
      V.drag = bindDrag(root);
      V.tdrag = bindTeamDrag(root);
      applyRoute(route, true);

      // Phím tắt riêng của Lịch
      V.unregs = [
        UI.shortcuts.register('j', function () { nav(-1); }, 'Kỳ trước', 'Lịch'),
        UI.shortcuts.register('k', function () { nav(1); }, 'Kỳ sau', 'Lịch'),
        UI.shortcuts.register('1', function () { go('day', V.iso, V.F); }, 'Xem theo ngày', 'Lịch'),
        UI.shortcuts.register('2', function () { go('week', V.iso, V.F); }, 'Xem theo tuần', 'Lịch'),
        UI.shortcuts.register('3', function () { go('month', V.iso, V.F); }, 'Xem theo tháng', 'Lịch'),
        UI.shortcuts.register('4', function () { go('team', V.iso, V.F); }, 'Xem đội ngũ (timeline)', 'Lịch'),
        UI.shortcuts.register('m', toggleMine, 'Chỉ hiện lịch của tôi', 'Lịch')
      ];
      UI.palette.register({ id: 'cal:mine', label: 'Lịch: chỉ hiện lịch của tôi', icon: 'user', section: 'Lịch', shortcut: 'm', keywords: 'cua toi mine', run: toggleMine });
      UI.palette.register({ id: 'cal:month', label: 'Lịch: xem theo tháng', icon: 'calendar-days', section: 'Lịch', shortcut: '3', keywords: 'thang month', run: function () { go('month', V.iso, V.F); } });
      UI.palette.register({ id: 'cal:team', label: 'Lịch: xem đội ngũ theo giờ', icon: 'users', section: 'Lịch', shortcut: '4', keywords: 'doi ngu team timeline', run: function () { go('team', V.iso, V.F); } });
      V.onToday = function () { if (V) go(V.mode, U.todayISO(), V.F); };
      document.addEventListener('z15:today', V.onToday);
      V.onKey = function (e) { if (e.key === 'Escape' && V && (V.drag.isDragging() || V.tdrag.isDragging())) { e.preventDefault(); e.stopPropagation(); V.drag.cancel(); V.tdrag.cancel(); } };
      document.addEventListener('keydown', V.onKey, true);
      V.onResize = U.debounce(function () {
        if (!V) return;
        var n = isNarrow();
        if (n !== V.narrow) { V.narrow = n; V.days = daysFor(V.mode, V.iso); V.key = periodKey(V.mode, V.iso); refresh(); }
        else if (V.seg) V.seg.refresh();
      }, 150);
      window.addEventListener('resize', V.onResize);
      V.onVis = function () { if (!document.hidden) updateNow(); };
      document.addEventListener('visibilitychange', V.onVis);
      V.nowTimer = setInterval(updateNow, 30000);

      V.unsub = S().subscribe(function (state, meta) {
        if (!V) return;
        var t = meta && meta.type || '';
        if (t === 'settings') { if (meta.key === 'theme' || meta.key === 'sidebarCollapsed' || meta.key === 'showWeekend') return; refresh(); return; }
        if (/^event:|^shift:|^staff:|^reset$|^user$/.test(t)) refresh();
      });
    },
    update: function (route) { if (!V) return; applyRoute(route, false); },
    destroy: function () {
      if (!V) return;
      var v = V; V = null;
      finishSlideOf(v);
      if (v.drag) v.drag.cancel(); if (v.tdrag) v.tdrag.cancel();
      if (v.unsub) v.unsub();
      v.unregs.forEach(function (f) { try { f(); } catch (e) { /* noop */ } });
      UI.palette.unregister('cal:mine'); UI.palette.unregister('cal:month'); UI.palette.unregister('cal:team');
      document.removeEventListener('z15:today', v.onToday);
      document.removeEventListener('keydown', v.onKey, true);
      document.removeEventListener('visibilitychange', v.onVis);
      window.removeEventListener('resize', v.onResize);
      clearInterval(v.nowTimer); clearTimeout(v.fadeTimer);
      if (v.slide) clearTimeout(v.slide.timer);
      if (v.morph) clearTimeout(v.morph.timer);
      U.qsa('.drag-layer').forEach(function (n) { n.remove(); });
      document.body.classList.remove('cal-dragging');
    }
  };
  function finishSlideOf(v) { if (v.slide) { clearTimeout(v.slide.timer); } if (v.morph) { clearTimeout(v.morph.timer); } }
})(window);
