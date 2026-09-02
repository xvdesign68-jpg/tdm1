/* =====================================================================
   Z15 Miracle · Lịch làm việc — store.js
   State tập trung + persist localStorage + pub/sub + domain helpers.
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  var U = Z15.utils, D = Z15.data, C = Z15.config;

  var state = null;
  var listeners = [];
  var _persist = U.debounce(function () { U.saveJSON(C.storageKey, state); }, 120);

  var S = Z15.store = {
    get state() { return state; },

    /** Nạp từ localStorage, hoặc seed mới. Nếu dữ liệu mẫu chưa bị sửa và đã cũ -> seed lại cho demo luôn tươi. */
    init: function () {
      var saved = U.loadJSON(C.storageKey, null);
      var todayISO = U.todayISO();
      if (saved && saved.meta && saved.meta.version === 1) {
        if (!saved.meta.dirty && saved.meta.seedDate !== todayISO) {
          state = D.seed();
          if (saved.settings) state.settings = Object.assign(state.settings, saved.settings);
        } else state = saved;
      } else state = D.seed();
      _persist();
      return state;
    },
    reset: function () { var keep = state && state.settings ? Object.assign({}, state.settings) : null; state = D.seed(); if (keep) Object.assign(state.settings, keep); U.saveJSON(C.storageKey, state); S.emit({ type: 'reset' }); },

    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (l) { return l !== fn; }); }; },
    emit: function (meta) { listeners.slice().forEach(function (l) { try { l(state, meta || {}); } catch (e) { console.error(e); } }); },

    /** Mọi thay đổi đi qua đây: mutator(state) -> persist -> notify. */
    update: function (mutator, meta) {
      mutator(state);
      state.meta.dirty = true;
      _persist();
      S.emit(meta || { type: 'update' });
    },
    /** Cài đặt giao diện không làm 'bẩn' dữ liệu mẫu (để demo vẫn tự làm mới theo ngày). */
    setSetting: function (key, value) { state.settings[key] = value; _persist(); S.emit({ type: 'settings', key: key, value: value }); },

    /* ----------------------------------------------------------- lookups */
    me: function () { return S.staff(state.currentUserId); },
    staff: function (id) { return state.staff.find(function (s) { return s.id === id; }) || null; },
    team: function (id) { return state.teams.find(function (t) { return t.id === id; }) || null; },
    project: function (id) { return state.projects.find(function (p) { return p.id === id; }) || null; },
    event: function (id) { return state.events.find(function (e) { return e.id === id; }) || null; },
    request: function (id) { return state.requests.find(function (r) { return r.id === id; }) || null; },
    shiftType: function (id) { return D.SHIFT_TYPES.find(function (t) { return t.id === id; }) || D.SHIFT_TYPES[D.SHIFT_TYPES.length - 1]; },
    eventType: function (id) { return D.EVENT_TYPES.find(function (t) { return t.id === id; }) || D.EVENT_TYPES[0]; },
    staffByTeam: function (teamId) { return state.staff.filter(function (s) { return s.teamId === teamId; }); },
    holidayName: D.holidayName,

    /* ------------------------------------------------------------ events */
    eventsOn: function (iso) { return U.sortBy(state.events.filter(function (e) { return e.date === iso; }), function (e) { return (e.allDay ? '0' : '1') + e.start; }); },
    eventsBetween: function (fromISO, toISO) { return U.sortBy(state.events.filter(function (e) { return e.date >= fromISO && e.date <= toISO; }), function (e) { return e.date + ' ' + e.start; }); },
    eventsFor: function (staffId, iso) { return S.eventsOn(iso).filter(function (e) { return e.attendeeIds.indexOf(staffId) >= 0; }); },
    eventsForStaffBetween: function (staffId, fromISO, toISO) { return S.eventsBetween(fromISO, toISO).filter(function (e) { return e.attendeeIds.indexOf(staffId) >= 0; }); },
    eventsForProject: function (projectId) { return U.sortBy(state.events.filter(function (e) { return e.projectId === projectId; }), function (e) { return e.date + ' ' + e.start; }); },
    upcomingFor: function (staffId, limit) {
      var now = U.nowMinutes(), today = U.todayISO();
      var list = state.events.filter(function (e) {
        if (e.attendeeIds.indexOf(staffId) < 0) return false;
        if (e.date > today) return true;
        return e.date === today && (e.allDay || U.timeToMin(e.end) >= now);
      });
      return U.sortBy(list, function (e) { return e.date + ' ' + e.start; }).slice(0, limit || 8);
    },
    addEvent: function (data) {
      var ev = Object.assign({ id: U.uid('ev'), title: 'Sự kiện mới', type: 'meeting', date: U.todayISO(), start: '09:00', end: '10:00', attendeeIds: [], location: '', notes: '' }, data);
      ev.attendeeIds = U.uniq(ev.attendeeIds || []);
      if (!ev.ownerId) ev.ownerId = state.currentUserId;
      S.update(function (s) { s.events.push(ev); }, { type: 'event:add', id: ev.id });
      return ev;
    },
    updateEvent: function (id, patch) {
      var ev = S.event(id); if (!ev) return null;
      S.update(function () { Object.assign(ev, patch); if (patch.attendeeIds) ev.attendeeIds = U.uniq(patch.attendeeIds); }, { type: 'event:update', id: id });
      return ev;
    },
    moveEvent: function (id, newDate, newStart) {
      var ev = S.event(id); if (!ev) return null;
      var dur = U.timeToMin(ev.end) - U.timeToMin(ev.start);
      var patch = { date: newDate };
      if (newStart != null) { newStart = U.clamp(Math.round(newStart), 0, Math.max(0, 24 * 60 - dur)); patch.start = U.minToTime(newStart); patch.end = U.minToTime(newStart + dur); }
      return S.updateEvent(id, patch);
    },
    deleteEvent: function (id) { S.update(function (s) { s.events = s.events.filter(function (e) { return e.id !== id; }); }, { type: 'event:delete', id: id }); },

    /* ------------------------------------------------------------ shifts */
    shiftOf: function (staffId, iso) { var m = state.shifts[staffId]; return (m && m[iso]) || (U.isWeekend(iso) ? 'off' : 'full'); },
    setShift: function (staffId, iso, typeId) {
      S.update(function (s) { (s.shifts[staffId] = s.shifts[staffId] || {})[iso] = typeId; }, { type: 'shift:set', staffId: staffId, date: iso, shift: typeId });
    },
    setShiftRange: function (staffId, fromISO, toISO, typeId) {
      S.update(function (s) {
        var m = s.shifts[staffId] = s.shifts[staffId] || {};
        for (var d = U.fromISO(fromISO); U.toISO(d) <= toISO; d = U.addDays(d, 1)) m[U.toISO(d)] = typeId;
      }, { type: 'shift:range', staffId: staffId });
    },
    /** Thống kê ca theo ngày: {onDuty, remote, onsite, leave, off, total} */
    dayStats: function (iso) {
      var out = { onDuty: 0, remote: 0, onsite: 0, leave: 0, off: 0, ot: 0, total: state.staff.length };
      state.staff.forEach(function (s) {
        var t = S.shiftOf(s.id, iso);
        if (t === 'leave') out.leave++; else if (t === 'off') out.off++; else { out.onDuty++; if (t === 'remote') out.remote++; if (t === 'onsite') out.onsite++; if (t === 'ot') out.ot++; }
      });
      return out;
    },
    /** Giờ làm dự kiến trong tuần chứa `iso` của 1 người. */
    weekHours: function (staffId, iso) {
      var days = U.weekDays(U.fromISO(iso));
      return U.sum(days, function (d) { return S.shiftType(S.shiftOf(staffId, U.toISO(d))).minutes; }) / 60;
    },
    /** Tải công việc (%) tuần này: giờ sự kiện + giờ ca so với capacity. */
    workload: function (staffId, iso) {
      var days = U.weekDays(U.fromISO(iso || U.todayISO()));
      var from = U.toISO(days[0]), to = U.toISO(days[6]);
      var evMin = U.sum(S.eventsForStaffBetween(staffId, from, to), function (e) { return e.allDay ? 480 : Math.max(0, U.timeToMin(e.end) - U.timeToMin(e.start)); });
      var st = S.staff(staffId);
      var shiftH = S.weekHours(staffId, iso || U.todayISO());
      var evH = evMin / 60, extra = Math.max(0, evH - shiftH * 0.5) * 0.5; // sự kiện phần lớn nằm trong ca; chỉ phần dôi ra mới cộng thêm
      var pct = U.clamp(Math.round((shiftH + extra) / (st ? st.capacity : 40) * 100), 0, 150);
      return { percent: pct, eventHours: Math.round(evH * 10) / 10, shiftHours: shiftH, level: pct > 105 ? 'over' : pct >= 90 ? 'high' : pct >= 50 ? 'normal' : 'low' };
    },

    /* ---------------------------------------------------------- requests */
    pendingRequests: function () { return state.requests.filter(function (r) { return r.status === 'pending'; }); },
    addRequest: function (data) {
      var r = Object.assign({ id: U.uid('rq'), staffId: state.currentUserId, type: 'leave', from: U.todayISO(), to: U.todayISO(), reason: '', status: 'pending', createdAt: new Date().toISOString() }, data);
      S.update(function (s) { s.requests.unshift(r); }, { type: 'request:add', id: r.id });
      return r;
    },
    setRequestStatus: function (id, status, note) {
      var r = S.request(id); if (!r) return null;
      S.update(function (s) {
        r.status = status; r.approverId = s.currentUserId; r.decidedAt = new Date().toISOString(); if (note) r.note = note;
        if (status === 'approved' && (r.type === 'leave' || r.type === 'remote' || r.type === 'ot')) {
          var m = s.shifts[r.staffId] = s.shifts[r.staffId] || {};
          var t = r.type === 'leave' ? 'leave' : r.type === 'remote' ? 'remote' : 'ot';
          for (var d = U.fromISO(r.from); U.toISO(d) <= r.to; d = U.addDays(d, 1)) if (!U.isWeekend(d) && !D.holidayName(U.toISO(d))) m[U.toISO(d)] = t;
        }
      }, { type: 'request:status', id: id, status: status });
      return r;
    },

    /* ----------------------------------------------------- notifications */
    unreadCount: function () { return state.notifications.filter(function (n) { return !n.read; }).length; },
    markRead: function (id) { S.update(function (s) { var n = s.notifications.find(function (x) { return x.id === id; }); if (n) n.read = true; }, { type: 'notif:read', id: id }); },
    markAllRead: function () { S.update(function (s) { s.notifications.forEach(function (n) { n.read = true; }); }, { type: 'notif:readall' }); },
    notify: function (n) {
      var item = Object.assign({ id: U.uid('nt'), kind: 'info', title: '', body: '', time: new Date().toISOString(), read: false }, n);
      S.update(function (s) { s.notifications.unshift(item); }, { type: 'notif:add', id: item.id });
      return item;
    },

    /* -------------------------------------------------------------- staff */
    setStaffStatus: function (id, status) { S.update(function () { var s = S.staff(id); if (s) s.status = status; }, { type: 'staff:status', id: id }); },
    updateStaff: function (id, patch) { S.update(function () { var s = S.staff(id); if (s) Object.assign(s, patch); }, { type: 'staff:update', id: id }); },

    /* ------------------------------------------------------------ projects */
    updateProject: function (id, patch) { S.update(function () { var p = S.project(id); if (p) Object.assign(p, patch); }, { type: 'project:update', id: id }); },
    addProject: function (data) {
      var p = Object.assign({ id: U.uid('pj'), name: 'Dự án mới', client: '', color: '#0B2FA6', status: 'planning', progress: 0, start: U.todayISO(), end: U.toISO(U.addDays(U.today(), 30)), leadId: state.currentUserId, memberIds: [state.currentUserId], tags: [] }, data);
      S.update(function (s) { s.projects.unshift(p); }, { type: 'project:add', id: p.id });
      return p;
    },
    projectHealth: function (p) {
      var total = Math.max(1, U.daysBetween(p.start, p.end)), elapsed = U.clamp(U.daysBetween(p.start, U.todayISO()), 0, total);
      var expected = Math.round(elapsed / total * 100);
      if (p.status === 'done') return { label: 'Hoàn thành', level: 'done', expected: 100 };
      if (p.status === 'planning') return { label: 'Đang lên kế hoạch', level: 'planning', expected: expected };
      var gap = p.progress - expected;
      if (gap < -15) return { label: 'Chậm tiến độ', level: 'risk', expected: expected };
      if (gap < -5) return { label: 'Cần theo dõi', level: 'watch', expected: expected };
      return { label: 'Đúng tiến độ', level: 'ok', expected: expected };
    },

    /* -------------------------------------------------------------- search */
    search: function (query) {
      var q = (query || '').trim(); if (!q) return [];
      var out = [];
      state.staff.forEach(function (s) { var sc = Math.max(U.fuzzyMatch(q, s.name), U.fuzzyMatch(q, s.role)); if (sc) out.push({ kind: 'staff', score: sc, id: s.id, title: s.name, sub: s.role, item: s }); });
      state.projects.forEach(function (p) { var sc = Math.max(U.fuzzyMatch(q, p.name), U.fuzzyMatch(q, p.client)); if (sc) out.push({ kind: 'project', score: sc, id: p.id, title: p.client + ' — ' + p.name, sub: 'Dự án', item: p }); });
      state.events.forEach(function (e) { var sc = U.fuzzyMatch(q, e.title); if (sc) out.push({ kind: 'event', score: sc, id: e.id, title: e.title, sub: U.fmtDate(e.date, 'shortWeekday') + ' · ' + e.start, item: e }); });
      return U.sortBy(out, 'score', true).slice(0, 12);
    }
  };
})(window);
