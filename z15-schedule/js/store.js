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
      if (saved && saved.meta && saved.meta.version === 2) {
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
      var ev = Object.assign({ id: U.uid('ev'), title: 'Sự kiện mới', type: 'meeting', date: U.todayISO(), start: '09:00', end: '10:00', attendeeIds: [], location: '', notes: '', priority: 2, visibility: 'public', prep: [], nudges: [] }, data);
      ev.attendeeIds = U.uniq(ev.attendeeIds || []);
      if (!ev.ownerId) ev.ownerId = state.currentUserId;
      if (ev.attendeeIds.indexOf(ev.ownerId) < 0 && ev.type !== 'focus' && ev.type !== 'travel') ev.attendeeIds.unshift(ev.ownerId);
      if (!ev.calendarId) ev.calendarId = ev.projectId ? 'project:' + ev.projectId : (function () { var teams = U.uniq(ev.attendeeIds.map(function (id) { var s = S.staff(id); return s ? s.teamId : null; }).filter(Boolean)); return teams.length === 1 ? 'team:' + teams[0] : 'company'; })();
      if (!ev.reminders) ev.reminders = ev.priority === 1 ? [1440, 60, 15] : ev.priority === 2 ? [60, 15] : [15];
      ev.roles = ev.roles || {}; ev.roles[ev.ownerId] = 'organizer'; ev.attendeeIds.forEach(function (id) { if (!ev.roles[id]) ev.roles[id] = 'required'; });
      ev.rsvp = ev.rsvp || {}; ev.rsvp[ev.ownerId] = 'yes'; ev.attendeeIds.forEach(function (id) { if (!ev.rsvp[id]) ev.rsvp[id] = 'pending'; });
      ev.prep = (ev.prep || []).map(function (p, i) { return Object.assign({ id: U.uid('pp'), done: false, ownerId: ev.ownerId }, p); });
      S.update(function (s) { s.events.push(ev); }, { type: 'event:add', id: ev.id });
      return ev;
    },
    updateEvent: function (id, patch) {
      var ev = S.event(id); if (!ev) return null;
      S.update(function () {
        Object.assign(ev, patch);
        if (patch.attendeeIds) { ev.attendeeIds = U.uniq(patch.attendeeIds); ev.roles = ev.roles || {}; ev.rsvp = ev.rsvp || {}; ev.attendeeIds.forEach(function (a) { if (!ev.roles[a]) ev.roles[a] = a === ev.ownerId ? 'organizer' : 'required'; if (!ev.rsvp[a]) ev.rsvp[a] = a === ev.ownerId ? 'yes' : 'pending'; }); }
        if (patch.priority && !patch.reminders) ev.reminders = ev.priority === 1 ? [1440, 60, 15] : ev.priority === 2 ? [60, 15] : [15];
      }, { type: 'event:update', id: id });
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
    /** Đơn đang chờ TÔI duyệt (không tính đơn của chính mình). */
    pendingRequests: function () { return state.requests.filter(function (r) { return r.status === 'pending' && r.staffId !== state.currentUserId; }); },
    myRequests: function () { return state.requests.filter(function (r) { return r.staffId === state.currentUserId; }); },
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
        if (status === 'approved' && r.type === 'swap' && r.swapWithId) {
          var A = s.shifts[r.staffId] = s.shifts[r.staffId] || {}, B = s.shifts[r.swapWithId] = s.shifts[r.swapWithId] || {};
          for (var d2 = U.fromISO(r.from); U.toISO(d2) <= r.to; d2 = U.addDays(d2, 1)) {
            var k = U.toISO(d2); if (U.isWeekend(d2) || D.holidayName(k)) continue;
            var a = S.shiftOf(r.staffId, k), b = S.shiftOf(r.swapWithId, k); A[k] = b; B[k] = a;
          }
        }
        // Thông báo cho người gửi đơn; hoàn tác (về 'pending') sẽ gỡ thông báo này
        s.notifications = s.notifications.filter(function (n) { return n.requestId !== r.id; });
        if (status === 'approved' || status === 'rejected') {
          var who = S.staff(r.staffId), typeLabel = { leave: 'Nghỉ phép', remote: 'Remote', ot: 'Tăng ca', swap: 'Đổi ca' }[r.type] || 'Yêu cầu';
          s.notifications.unshift({ id: U.uid('nt'), kind: status === 'approved' ? 'success' : 'info', title: (status === 'approved' ? 'Đã duyệt: ' : 'Đã từ chối: ') + typeLabel + ' · ' + (who ? U.shortName(who.name) : ''), body: U.fmtRange(r.from, r.to) + (note ? ' · ' + note : ''), time: new Date().toISOString(), read: true, link: '#/requests?tab=history', requestId: r.id });
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


    /* ================================================================
       LỚP LỊCH · VAI TRÒ · RSVP · ƯU TIÊN · RIÊNG TƯ
       ================================================================ */
    /** Danh sách lớp lịch có thể bật/tắt trong view Lịch. */
    calendars: function () {
      var me = state.currentUserId, out = [
        { id: 'company', name: 'Toàn công ty', kind: 'company', color: '#3F4A7A' },
        { id: 'exec', name: 'Ban điều hành', kind: 'exec', color: '#3F4A7A' },
        { id: 'personal:' + me, name: 'Cá nhân (riêng tư)', kind: 'personal', color: '#5E6B7D' }
      ];
      state.teams.forEach(function (t) { if (t.id !== 'exec') out.push({ id: 'team:' + t.id, name: 'Team ' + t.name, kind: 'team', color: t.color, teamId: t.id }); });
      state.projects.filter(function (p) { return p.status !== 'done'; }).forEach(function (p) { out.push({ id: 'project:' + p.id, name: p.client + ' — ' + p.name, kind: 'project', color: p.color, projectId: p.id }); });
      return out;
    },
    calendarOf: function (ev) {
      var id = ev.calendarId || 'company';
      var found = S.calendars().find(function (c) { return c.id === id; });
      if (found) return found;
      if (id.indexOf('personal:') === 0) { var who = S.staff(id.slice(9)); return { id: id, name: 'Cá nhân · ' + (who ? U.shortName(who.name) : ''), kind: 'personal', color: '#5E6B7D' }; }
      if (id.indexOf('project:') === 0) { var p = S.project(id.slice(8)); return p ? { id: id, name: p.client + ' — ' + p.name, kind: 'project', color: p.color, projectId: p.id } : { id: id, name: 'Dự án', kind: 'project', color: '#5E6B7D' }; }
      return { id: id, name: 'Khác', kind: 'other', color: '#5E6B7D' };
    },
    /** Người xem có thấy chi tiết không? Sự kiện riêng tư chỉ hiện với người tham gia (và trợ lý điều hành). */
    canSee: function (ev, viewerId) {
      viewerId = viewerId || state.currentUserId;
      if (ev.visibility !== 'private') return true;
      if (ev.attendeeIds.indexOf(viewerId) >= 0 || ev.ownerId === viewerId) return true;
      var v = S.staff(viewerId); return !!(v && v.teamId === 'exec');
    },
    displayTitle: function (ev, viewerId) { return S.canSee(ev, viewerId) ? ev.title : 'Bận (riêng tư)'; },
    priority: function (p) { return D.PRIORITIES.find(function (x) { return x.id === p; }) || D.PRIORITIES[1]; },
    roleOf: function (ev, staffId) { return (ev.roles && ev.roles[staffId]) || (ev.ownerId === staffId ? 'organizer' : 'required'); },
    rsvpOf: function (ev, staffId) { return (ev.rsvp && ev.rsvp[staffId]) || (ev.ownerId === staffId ? 'yes' : 'pending'); },
    rsvpSummary: function (ev) {
      var out = { yes: 0, maybe: 0, no: 0, pending: 0, total: ev.attendeeIds.length };
      ev.attendeeIds.forEach(function (id) { out[S.rsvpOf(ev, id)]++; });
      return out;
    },
    setRsvp: function (evId, staffId, status) {
      var ev = S.event(evId); if (!ev) return null;
      S.update(function () { ev.rsvp = ev.rsvp || {}; ev.rsvp[staffId] = status; }, { type: 'event:rsvp', id: evId, staffId: staffId, status: status });
      return ev;
    },
    setRole: function (evId, staffId, role) { var ev = S.event(evId); if (!ev) return; S.update(function () { ev.roles = ev.roles || {}; ev.roles[staffId] = role; }, { type: 'event:update', id: evId }); },
    setPriority: function (evId, p) { return S.updateEvent(evId, { priority: p }); },
    isLead: function (staffId) { var s = S.staff(staffId); return !!(s && /director|head|lead|producer|ceo|giám đốc|manager|planner/i.test(s.role)); },
    /** Sự kiện này có thể uỷ quyền cho ai (người khác cùng team/lead đang tham dự)? */
    delegable: function (ev, staffId) {
      staffId = staffId || state.currentUserId;
      if (ev.ownerId === staffId || ev.type === 'focus' || ev.visibility === 'private') return null;
      if (ev.priority === 1) return null;
      var me = S.staff(staffId); if (!me) return null;
      var others = ev.attendeeIds.filter(function (id) { return id !== staffId; }).map(S.staff).filter(Boolean).filter(function (o) { return o.teamId !== 'exec'; });
      if (others.length < 2 && ev.priority !== 3) return null;
      var cand = others.find(function (o) { return S.isLead(o.id) && (o.teamId === me.teamId || me.teamId === 'exec'); }) || (ev.priority === 3 ? others.find(function (o) { return S.isLead(o.id); }) : null);
      return cand ? { to: cand, reason: ev.priority === 3 ? 'Mức P3 · ' + U.shortName(cand.name) + ' đã tham dự' : U.shortName(cand.name) + ' (' + cand.role + ') đã tham dự' } : null;
    },
    delegate: function (evId, fromId, toId) {
      var ev = S.event(evId); if (!ev) return;
      S.update(function () { ev.attendeeIds = ev.attendeeIds.filter(function (x) { return x !== fromId; }); if (ev.attendeeIds.indexOf(toId) < 0) ev.attendeeIds.push(toId); ev.roles = ev.roles || {}; ev.roles[toId] = 'required'; ev.delegatedFrom = fromId; }, { type: 'event:update', id: evId });
      var who = S.staff(fromId), to = S.staff(toId);
      S.notify({ kind: 'info', title: 'Uỷ quyền: ' + ev.title, body: (who ? U.shortName(who.name) : '') + ' uỷ quyền cho ' + (to ? U.shortName(to.name) : '') + ' · ' + U.fmtDate(ev.date, 'shortWeekday') + ' ' + ev.start, link: '#/calendar/day/' + ev.date });
    },

    /* ================================================================
       CHUẨN BỊ · NHẮC LỊCH
       ================================================================ */
    prepStatus: function (ev) {
      var list = ev.prep || [], done = list.filter(function (p) { return p.done; }).length;
      var startMs = U.fromISO(ev.date).getTime() + U.timeToMin(ev.start) * 60000, hoursLeft = (startMs - Date.now()) / 3600000;
      return { total: list.length, done: done, open: list.length - done, overdue: list.length > done && hoursLeft < 24 && hoursLeft > -1, hoursLeft: hoursLeft };
    },
    addPrep: function (evId, text, ownerId) { var ev = S.event(evId); if (!ev || !text) return; S.update(function () { ev.prep = ev.prep || []; ev.prep.push({ id: U.uid('pp'), text: text, ownerId: ownerId || state.currentUserId, done: false }); }, { type: 'event:prep', id: evId }); },
    togglePrep: function (evId, prepId) { var ev = S.event(evId); if (!ev) return; S.update(function () { (ev.prep || []).forEach(function (p) { if (p.id === prepId) p.done = !p.done; }); }, { type: 'event:prep', id: evId }); },
    removePrep: function (evId, prepId) { var ev = S.event(evId); if (!ev) return; S.update(function () { ev.prep = (ev.prep || []).filter(function (p) { return p.id !== prepId; }); }, { type: 'event:prep', id: evId }); },
    /** Nhắc người tham gia (mặc định: người chưa phản hồi). Trả về số người được nhắc. */
    nudge: function (evId, byId, opts) {
      opts = opts || {}; var ev = S.event(evId); if (!ev) return 0;
      byId = byId || state.currentUserId;
      var targets = ev.attendeeIds.filter(function (id) { if (id === byId) return false; var r = S.rsvpOf(ev, id); return opts.all ? true : (r === 'pending' || r === 'maybe'); });
      if (!targets.length) return 0;
      var by = S.staff(byId);
      S.update(function (s) {
        ev.nudges = ev.nudges || []; ev.nudges.push({ at: new Date().toISOString(), byId: byId, count: targets.length });
        s.notifications.unshift({ id: U.uid('nt'), kind: 'warning', title: 'Nhắc lịch: ' + ev.title, body: U.fmtDate(ev.date, 'shortWeekday') + ' · ' + (ev.allDay ? 'Cả ngày' : ev.start) + (ev.location ? ' · ' + ev.location : '') + ' — ' + (by ? U.shortName(by.name) : 'Hệ thống') + ' nhắc ' + targets.length + ' người xác nhận.', time: new Date().toISOString(), read: false, link: '#/calendar/day/' + ev.date, eventId: ev.id });
      }, { type: 'event:nudge', id: evId, count: targets.length });
      return targets.length;
    },
    /** Sự kiện sắp tới (trong `withinH` giờ) cần chú ý: người chưa xác nhận hoặc chuẩn bị chưa xong. */
    needsAttention: function (staffId, withinH) {
      staffId = staffId || state.currentUserId; withinH = withinH || 48;
      var now = Date.now(), out = [];
      state.events.forEach(function (ev) {
        if (ev.attendeeIds.indexOf(staffId) < 0 && ev.ownerId !== staffId) return;
        var startMs = U.fromISO(ev.date).getTime() + (ev.allDay ? 8 * 60 : U.timeToMin(ev.start)) * 60000, h = (startMs - now) / 3600000;
        if (h < -0.5 || h > withinH) return;
        var rs = S.rsvpSummary(ev), ps = S.prepStatus(ev), reasons = [];
        if (rs.pending + rs.maybe > 0 && ev.attendeeIds.length > 1) reasons.push({ kind: 'rsvp', text: (rs.pending + rs.maybe) + ' người chưa xác nhận' });
        if (ps.open > 0) reasons.push({ kind: 'prep', text: ps.open + ' việc chuẩn bị chưa xong' });
        if (reasons.length) out.push({ event: ev, hoursLeft: h, reasons: reasons, canNudge: ev.ownerId === staffId || S.isLead(staffId) || (S.staff(staffId) || {}).teamId === 'exec' });
      });
      return U.sortBy(out, 'hoursLeft');
    },
    /** Lời mời tôi chưa phản hồi (sắp tới). */
    myPendingInvites: function (staffId) {
      staffId = staffId || state.currentUserId; var today = U.todayISO();
      return U.sortBy(state.events.filter(function (ev) { return ev.date >= today && ev.attendeeIds.indexOf(staffId) >= 0 && ev.ownerId !== staffId && S.rsvpOf(ev, staffId) === 'pending'; }), function (e) { return e.date + ' ' + e.start; });
    },

    /* ================================================================
       XUNG ĐỘT · TẢI NGÀY · SỨC KHOẺ LỊCH · DI CHUYỂN
       ================================================================ */
    /** Sự kiện theo giờ của một người trong ngày (bỏ cả ngày), đã sắp xếp. */
    dayAgenda: function (staffId, iso) {
      return S.eventsFor(staffId, iso).filter(function (e) { return !e.allDay && U.timeToMin(e.end) > U.timeToMin(e.start); });
    },
    /** Ước lượng phút di chuyển giữa hai sự kiện liên tiếp (dựa trên địa điểm). */
    travelBetween: function (a, b) {
      var isExt = function (loc) { return !!loc && !/phòng|sảnh|pantry|online|zoom|meet|văn phòng/i.test(loc); };
      var la = a.location || '', lb = b.location || '';
      if (!isExt(la) && !isExt(lb)) return 0;
      if (la && lb && U.normalizeVN(la) === U.normalizeVN(lb)) return 0;
      var far = /đông anh|cổ loa|long biên|ba vì|sân bay/i;
      var need = Math.max(isExt(lb) ? (b.travelMinutes || 30) : 0, isExt(la) ? (a.travelMinutes || 30) : 0);
      if (far.test(la) || far.test(lb)) need = Math.max(need, 45);
      return need;
    },
    /** Xung đột lịch của một người trong khoảng ngày: trùng giờ (hard) hoặc họp đè lên khối tập trung (focus). */
    conflictsFor: function (staffId, fromISO, toISO) {
      var out = [];
      for (var d = U.fromISO(fromISO); U.toISO(d) <= toISO; d = U.addDays(d, 1)) {
        var iso = U.toISO(d), list = S.dayAgenda(staffId, iso);
        for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {
          var a = list[i], b = list[j], s1 = U.timeToMin(a.start), e1 = U.timeToMin(a.end), s2 = U.timeToMin(b.start), e2 = U.timeToMin(b.end);
          var ov = Math.min(e1, e2) - Math.max(s1, s2);
          if (ov > 0) out.push({ date: iso, a: a, b: b, overlap: ov, kind: (a.type === 'focus' || b.type === 'focus') ? 'focus' : 'hard' });
        }
      }
      return out;
    },
    /** Tải trong ngày của một người: phút họp, khối tập trung, chuỗi họp sát nhau, khoảng trống, di chuyển thiếu. */
    dayLoad: function (staffId, iso) {
      var list = S.dayAgenda(staffId, iso), out = { events: list, count: list.length, meetingMin: 0, focusMin: 0, travelMin: 0, backToBack: [], tightGaps: [], travelIssues: [], gaps: [], longestFree: 0, firstStart: null, lastEnd: null, external: 0, prepMissing: [] };
      var wsMin = C.workStart * 60 + 60, weMin = 18 * 60;
      list.forEach(function (e) {
        var dur = U.timeToMin(e.end) - U.timeToMin(e.start);
        if (e.type === 'focus') out.focusMin += dur; else if (e.type === 'travel') out.travelMin += dur; else out.meetingMin += dur;
        if (e.travelMinutes) out.external++;
        if (out.firstStart == null || U.timeToMin(e.start) < out.firstStart) out.firstStart = U.timeToMin(e.start);
        if (out.lastEnd == null || U.timeToMin(e.end) > out.lastEnd) out.lastEnd = U.timeToMin(e.end);
        if (e.priority === 1 && e.type !== 'focus' && e.type !== 'travel') { var ps = S.prepStatus(e); if (ps.total && ps.open) out.prepMissing.push(e); }
      });
      var sorted = U.sortBy(list.filter(function (e) { return e.type !== 'focus'; }), function (e) { return e.start; });
      for (var i = 1; i < sorted.length; i++) {
        var prev = sorted[i - 1], cur = sorted[i], gap = U.timeToMin(cur.start) - U.timeToMin(prev.end);
        if (gap < 0) continue;
        var need = S.travelBetween(prev, cur);
        if (need > 0 && gap < need && prev.type !== 'travel' && cur.type !== 'travel') out.travelIssues.push({ from: prev, to: cur, gap: gap, need: need });
        else if (gap < 10) out.backToBack.push({ from: prev, to: cur, gap: gap });
        else if (gap < 30) out.tightGaps.push({ from: prev, to: cur, gap: gap });
        if (gap >= 30) out.gaps.push({ start: U.timeToMin(prev.end), end: U.timeToMin(cur.start), minutes: gap });
      }
      // khoảng trống đầu/cuối ngày làm việc
      var all = U.sortBy(list, function (e) { return e.start; });
      if (!all.length) out.gaps.push({ start: wsMin, end: weMin, minutes: weMin - wsMin });
      else {
        if (U.timeToMin(all[0].start) - wsMin >= 30) out.gaps.unshift({ start: wsMin, end: U.timeToMin(all[0].start), minutes: U.timeToMin(all[0].start) - wsMin });
        var lastE = Math.max.apply(null, all.map(function (e) { return U.timeToMin(e.end); }));
        if (weMin - lastE >= 30) out.gaps.push({ start: lastE, end: weMin, minutes: weMin - lastE });
      }
      out.longestFree = out.gaps.reduce(function (m, g) { return Math.max(m, g.minutes); }, 0);
      out.busyPct = Math.round((out.meetingMin + out.focusMin + out.travelMin) / (9 * 60) * 100);
      return out;
    },
    /** Sức khoẻ lịch cả tuần (T2–T6) của một người, kèm điểm 0–100. */
    weekHealth: function (staffId, iso) {
      var days = U.weekDays(U.fromISO(iso || U.todayISO())).slice(0, 5), from = U.toISO(days[0]), to = U.toISO(days[4]);
      var agg = { days: [], meetingMin: 0, focusMin: 0, travelMin: 0, backToBack: 0, travelIssues: 0, conflicts: 0, focusConflicts: 0, longestFocusBlock: 0, daysOver6h: 0, external: 0, prepMissing: 0, byPriority: { 1: 0, 2: 0, 3: 0 }, byCalendar: {} };
      days.forEach(function (d) {
        var di = U.toISO(d), dl = S.dayLoad(staffId, di); agg.days.push({ iso: di, load: dl });
        agg.meetingMin += dl.meetingMin; agg.focusMin += dl.focusMin; agg.travelMin += dl.travelMin; agg.backToBack += dl.backToBack.length; agg.travelIssues += dl.travelIssues.length; agg.external += dl.external; agg.prepMissing += dl.prepMissing.length;
        if (dl.meetingMin > 6 * 60) agg.daysOver6h++;
        dl.events.forEach(function (e) {
          var dur = U.timeToMin(e.end) - U.timeToMin(e.start);
          if (e.type === 'focus') agg.longestFocusBlock = Math.max(agg.longestFocusBlock, dur);
          else { agg.byPriority[e.priority || 2] += dur; var ck = S.calendarOf(e).kind; agg.byCalendar[ck] = (agg.byCalendar[ck] || 0) + dur; }
        });
        dl.gaps.forEach(function (g) { agg.longestFocusBlock = Math.max(agg.longestFocusBlock, g.minutes); });
      });
      var cf = S.conflictsFor(staffId, from, to); agg.conflicts = cf.filter(function (c) { return c.kind === 'hard'; }).length; agg.focusConflicts = cf.filter(function (c) { return c.kind === 'focus'; }).length;
      var capacity = 5 * 9 * 60;
      agg.meetingPct = Math.round(agg.meetingMin / capacity * 100);
      var score = 100 - agg.conflicts * 12 - agg.focusConflicts * 5 - agg.backToBack * 3 - agg.travelIssues * 6 - agg.daysOver6h * 8 - agg.prepMissing * 4;
      if (agg.focusMin < 4 * 60) score -= 8; if (agg.meetingPct > 60) score -= 10;
      agg.score = U.clamp(Math.round(score), 0, 100);
      agg.label = agg.score >= 80 ? 'Lịch khoẻ' : agg.score >= 60 ? 'Cần tinh chỉnh' : 'Quá tải';
      agg.from = from; agg.to = to;
      return agg;
    },
    /** Tìm khung giờ trống chung cho nhiều người trong một ngày. */
    freeSlotsOn: function (staffIds, iso, durationMin, opts) {
      opts = opts || {};
      var from = opts.from != null ? opts.from : 9 * 60, to = opts.to != null ? opts.to : 18 * 60, step = opts.step || 15, buffer = opts.buffer != null ? opts.buffer : 10;
      if (U.isWeekend(iso) || D.holidayName(iso)) return [];
      var busy = [], available = true;
      staffIds.forEach(function (id) {
        var sh = S.shiftOf(id, iso); if (sh === 'leave' || sh === 'off') available = false;
        if (sh === 'morning') busy.push([12 * 60 + 30, 24 * 60]); if (sh === 'afternoon') busy.push([0, 13 * 60 + 30]);
        S.dayAgenda(id, iso).forEach(function (e) { if (e.type === 'focus' && opts.avoidFocus === false) return; busy.push([U.timeToMin(e.start) - buffer, U.timeToMin(e.end) + buffer, e.type === 'focus' ? 'focus' : 'ev']); });
      });
      if (!available && !opts.ignoreLeave) return [];
      var out = [];
      for (var t = from; t + durationMin <= to; t += step) {
        var s = t, e = t + durationMin, ok = true;
        for (var i = 0; i < busy.length; i++) { if (s < busy[i][1] && e > busy[i][0]) { ok = false; break; } }
        if (!ok) continue;
        var score = 100;
        if (s < 9 * 60 + 30) score -= 6; if (s >= 12 * 60 && s < 13 * 60 + 30) score -= 25; if (s >= 16 * 60 + 30) score -= 10;
        if (s >= 9 * 60 + 30 && s < 11 * 60 + 30) score += 8; if (s >= 14 * 60 && s < 16 * 60) score += 4;
        var nearest = busy.reduce(function (m, b) { return Math.min(m, Math.abs(b[0] - e), Math.abs(b[1] - s)); }, 999);
        if (nearest <= buffer + 5) score -= 8; else if (nearest >= 60) score += 4;
        staffIds.forEach(function (id) { if (S.shiftOf(id, iso) === 'remote') score -= 3; });
        out.push({ date: iso, start: s, end: e, score: score, startLabel: U.minToTime(s), endLabel: U.minToTime(e) });
      }
      return out;
    },
    /** Gợi ý khung giờ họp tốt nhất trong N ngày làm việc tới. */
    suggestSlots: function (staffIds, fromISO, days, durationMin, opts) {
      var out = [], d = U.fromISO(fromISO || U.todayISO()), n = 0, guard = 0;
      while (n < (days || 5) && guard++ < 30) {
        var iso = U.toISO(d);
        if (!U.isWeekend(d) && !D.holidayName(iso)) {
          n++;
          var slots = S.freeSlotsOn(staffIds, iso, durationMin, opts);
          // giảm điểm theo độ xa & tránh gom quá nhiều slot cùng ngày
          slots.forEach(function (sl) { sl.score -= n * 2; });
          var best = U.sortBy(slots, 'score', true).filter(function (sl, i, arr) { return !arr.slice(0, i).some(function (p) { return Math.abs(p.start - sl.start) < 60; }); }).slice(0, 3);
          out = out.concat(best);
        }
        d = U.addDays(d, 1);
      }
      return U.sortBy(out, 'score', true).slice(0, opts && opts.limit || 6);
    },
    /** Dời một sự kiện sang khung giờ trống gần nhất cho tất cả người tham gia (cùng ngày trước, rồi ngày sau). */
    resolveConflict: function (evId) {
      var ev = S.event(evId); if (!ev) return null;
      var dur = U.timeToMin(ev.end) - U.timeToMin(ev.start);
      var cands = S.suggestSlots(ev.attendeeIds.filter(function (id) { return id !== ev.ownerId || true; }), ev.date, 3, dur, { buffer: 10, limit: 6 });
      var self = cands.filter(function (c) { return !(c.date === ev.date && c.start === U.timeToMin(ev.start)); });
      if (!self.length) return null;
      var pick = self[0];
      S.moveEvent(ev.id, pick.date, pick.start);
      return pick;
    },
    /** Chèn đệm: dời sự kiện `toId` muộn hơn `minutes` nếu khung sau đó còn trống cho mọi người. */
    insertBuffer: function (toId, minutes) {
      var ev = S.event(toId); if (!ev) return false;
      minutes = minutes || 10;
      var newStart = U.timeToMin(ev.start) + minutes, dur = U.timeToMin(ev.end) - U.timeToMin(ev.start);
      var clash = ev.attendeeIds.some(function (id) { return S.dayAgenda(id, ev.date).some(function (o) { return o.id !== ev.id && U.timeToMin(o.start) < newStart + dur && U.timeToMin(o.end) > newStart && !(U.timeToMin(o.end) <= newStart); }); });
      if (clash) return false;
      S.moveEvent(ev.id, ev.date, newStart); return true;
    },
    /** Thêm khối "Chuẩn bị" (mặc định 30') ngay trước một sự kiện, cho người `staffId`. */
    addPrepBlock: function (evId, staffId, minutes) {
      var ev = S.event(evId); if (!ev) return null; minutes = minutes || 30; staffId = staffId || state.currentUserId;
      var start = U.timeToMin(ev.start) - minutes - (ev.travelMinutes || 0);
      if (start < 7 * 60) start = 7 * 60;
      return S.addEvent({ title: 'Chuẩn bị: ' + ev.title, type: 'focus', date: ev.date, start: U.minToTime(start), end: U.minToTime(start + minutes), attendeeIds: [staffId], ownerId: staffId, priority: ev.priority || 2, calendarId: 'personal:' + staffId, visibility: 'private', linkedTo: ev.id, notes: 'Khối chuẩn bị do trợ lý lịch đề xuất.' });
    },
    /** Thêm khối di chuyển trước sự kiện ngoài văn phòng. */
    addTravelBlock: function (evId, staffId, minutes) {
      var ev = S.event(evId); if (!ev) return null; minutes = minutes || ev.travelMinutes || 30; staffId = staffId || state.currentUserId;
      var start = U.timeToMin(ev.start) - minutes;
      return S.addEvent({ title: 'Di chuyển → ' + (ev.location || ev.title), type: 'travel', date: ev.date, start: U.minToTime(start), end: ev.start, attendeeIds: [staffId], ownerId: staffId, priority: 2, calendarId: 'personal:' + staffId, linkedTo: ev.id, location: ev.location });
    },
    /** Gợi ý khối tập trung (≥ 90') trong các khoảng trống lớn của tuần. */
    suggestFocusBlocks: function (staffId, iso, minutes) {
      minutes = minutes || 120; var out = [];
      U.weekDays(U.fromISO(iso || U.todayISO())).slice(0, 5).forEach(function (d) {
        var di = U.toISO(d); if (D.holidayName(di) || di < U.todayISO()) return;
        var sh = S.shiftOf(staffId, di); if (sh === 'leave' || sh === 'off') return;
        // cắt theo giờ làm việc và tách quanh giờ nghỉ trưa 12:00–13:30
        S.dayLoad(staffId, di).gaps.forEach(function (g) {
          var parts = [[Math.max(g.start, 8 * 60 + 30), Math.min(g.end, 12 * 60)], [Math.max(g.start, 13 * 60 + 30), Math.min(g.end, 18 * 60)]];
          parts.forEach(function (p) { var len = p[1] - p[0]; if (len >= minutes) out.push({ date: di, start: p[0], end: p[0] + minutes, minutes: minutes, startLabel: U.minToTime(p[0]), endLabel: U.minToTime(p[0] + minutes), score: (p[0] < 12 * 60 ? 10 : 0) + Math.min(len - minutes, 60) / 10 }); });
        });
      });
      return U.sortBy(out, 'score', true).slice(0, 5);
    },
    addFocusBlock: function (staffId, iso, startMin, minutes, title) {
      return S.addEvent({ title: title || 'Tập trung — việc quan trọng', type: 'focus', date: iso, start: U.minToTime(startMin), end: U.minToTime(startMin + minutes), attendeeIds: [staffId], ownerId: staffId, priority: 1, calendarId: 'personal:' + staffId, visibility: 'private' });
    },
    /** Danh sách vấn đề cần trợ lý xử lý cho một người trong tuần (đã xếp theo mức nghiêm trọng). */
    issuesFor: function (staffId, iso) {
      var days = U.weekDays(U.fromISO(iso || U.todayISO())).slice(0, 5), from = U.toISO(days[0]), to = U.toISO(days[4]), today = U.todayISO(), out = [];
      S.conflictsFor(staffId, from, to).forEach(function (c) { if (c.date < today) return; out.push({ kind: c.kind === 'hard' ? 'conflict' : 'focus-conflict', severity: c.kind === 'hard' ? 3 : 2, date: c.date, events: [c.a, c.b], text: c.kind === 'hard' ? 'Trùng lịch ' + c.overlap + " phút: “" + c.a.title + "” và “" + c.b.title + "”" : "Họp đè lên khối tập trung: “" + (c.a.type === 'focus' ? c.b.title : c.a.title) + "”" }); });
      days.forEach(function (d) {
        var di = U.toISO(d); if (di < today) return; var dl = S.dayLoad(staffId, di);
        dl.travelIssues.forEach(function (t) { out.push({ kind: 'travel', severity: 3, date: di, events: [t.from, t.to], need: t.need, gap: t.gap, text: 'Thiếu giờ di chuyển tới “' + t.to.title + '” (cần ~' + t.need + "', chỉ có " + t.gap + "')" }); });
        if (dl.backToBack.length >= 2) out.push({ kind: 'chain', severity: 2, date: di, events: dl.backToBack.map(function (b) { return b.to; }), text: 'Chuỗi ' + (dl.backToBack.length + 1) + ' cuộc họp sát nhau, không có đệm' });
        else dl.backToBack.forEach(function (b) { out.push({ kind: 'b2b', severity: 1, date: di, events: [b.from, b.to], text: 'Họp sát nhau: “' + b.from.title + '” → “' + b.to.title + '”' }); });
        dl.prepMissing.forEach(function (e) { var ps = S.prepStatus(e); out.push({ kind: 'prep', severity: 2, date: di, events: [e], text: 'P1 “' + e.title + '” còn ' + ps.open + ' việc chuẩn bị' }); });
        if (dl.meetingMin > 6 * 60) out.push({ kind: 'overload', severity: 2, date: di, events: [], text: 'Ngày quá tải: ' + U.fmtDuration(dl.meetingMin) + ' họp' });
        dl.events.forEach(function (e) { if (e.priority === 1 && e.type === 'meeting' && !e.notes && e.attendeeIds.length > 2) out.push({ kind: 'agenda', severity: 1, date: di, events: [e], text: 'P1 “' + e.title + '” chưa có agenda' }); });
        dl.events.forEach(function (e) { var dg = S.delegable(e, staffId); if (dg) out.push({ kind: 'delegate', severity: 1, date: di, events: [e], to: dg.to, text: 'Có thể uỷ quyền “' + e.title + '” cho ' + U.shortName(dg.to.name) }); });
      });
      S.needsAttention(staffId, 72).forEach(function (n) { n.reasons.forEach(function (r) { if (r.kind === 'rsvp' && n.canNudge) out.push({ kind: 'rsvp', severity: 1, date: n.event.date, events: [n.event], text: '“' + n.event.title + '”: ' + r.text }); }); });
      return U.sortBy(out, function (i) { return (4 - i.severity) + '|' + i.date; });
    },
    /** Văn bản brief ngày (gửi Zalo) cho một người. */
    briefText: function (staffId, iso) {
      var who = S.staff(staffId), list = S.eventsFor(staffId, iso), lines = ['📋 Lịch ' + U.fmtDate(iso, 'long') + ' — ' + (who ? U.shortName(who.name) : '')];
      if (!list.length) lines.push('Không có lịch.');
      list.forEach(function (e) {
        var ps = S.prepStatus(e), rs = S.rsvpSummary(e);
        lines.push((e.allDay ? 'Cả ngày' : e.start + '–' + e.end) + '  ' + S.displayTitle(e, staffId) + (e.location ? ' · ' + e.location : '') + (e.travelMinutes ? ' · di chuyển ~' + e.travelMinutes + "'" : '') + (e.priority === 1 ? ' · P1' : '') + (ps.open ? ' · ⚠ ' + ps.open + ' việc chuẩn bị' : '') + (rs.pending ? ' · ' + rs.pending + ' chưa xác nhận' : ''));
      });
      return lines.join('\n');
    },
    setCurrentUser: function (id) { if (!S.staff(id)) return; state.currentUserId = id; _persist(); S.emit({ type: 'user', id: id }); },

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
      state.events.forEach(function (e) { if (!S.canSee(e)) return; var sc = U.fuzzyMatch(q, e.title); if (sc) out.push({ kind: 'event', score: sc, id: e.id, title: e.title, sub: U.fmtDate(e.date, 'shortWeekday') + ' · ' + (e.allDay ? 'Cả ngày' : e.start), item: e }); });
      return U.sortBy(out, 'score', true).slice(0, 12);
    }
  };
})(window);
