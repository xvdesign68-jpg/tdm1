/* =====================================================================
   Z15 Miracle · Lịch làm việc — editors.js
   Các hộp thoại dùng chung: sự kiện, chi tiết sự kiện, yêu cầu, chọn ca,
   hồ sơ nhân sự (drawer), dự án, bộ chọn nhân sự.
   ===================================================================== */
(function (global) {
  'use strict';
  var Z15 = global.Z15 = global.Z15 || {};
  var U = Z15.utils, UI = Z15.ui, D = Z15.data;
  var E = Z15.editors = {};
  var S = function () { return Z15.store; };

  var REQUEST_TYPES = E.REQUEST_TYPES = [
    { id: 'leave', label: 'Nghỉ phép', icon: 'umbrella', desc: 'Nghỉ có phép, trừ phép năm' },
    { id: 'remote', label: 'Remote', icon: 'laptop', desc: 'Làm việc từ xa (WFH)' },
    { id: 'ot', label: 'Tăng ca', icon: 'hourglass', desc: 'Làm thêm ngoài giờ' },
    { id: 'swap', label: 'Đổi ca', icon: 'repeat', desc: 'Hoán đổi ca với đồng nghiệp' }
  ];
  E.requestType = function (id) { return REQUEST_TYPES.find(function (t) { return t.id === id; }) || REQUEST_TYPES[0]; };

  var PROJECT_COLORS = ['#4A3FB8', '#3B6EA8', '#0E6E8C', '#0F766E', '#5E8C3A', '#9A6700', '#C2782A', '#B8497B', '#A21CAF', '#7C5BD1', '#B45309', '#5E6B7D'];
  var COLOR_NAMES = ['Chàm', 'Xanh thép', 'Xanh biển', 'Xanh ngọc', 'Xanh ô liu', 'Vàng đất', 'Cam đất', 'Hồng mận', 'Tím sen', 'Tím oải hương', 'Nâu đồng', 'Xám xanh'];
  var PROJECT_STATUS = E.PROJECT_STATUS = [
    { id: 'planning', label: 'Lên kế hoạch' }, { id: 'active', label: 'Đang chạy' }, { id: 'review', label: 'Chờ duyệt' }, { id: 'done', label: 'Hoàn thành' }
  ];
  E.projectStatus = function (id) { return PROJECT_STATUS.find(function (s) { return s.id === id; }) || PROJECT_STATUS[0]; };

  function field(label, inner, opts) {
    opts = opts || {};
    var fid = opts.id || ((String(inner).match(/\sid="([^"]+)"/) || [])[1] || '');
    return '<div class="field' + (opts.cls ? ' ' + opts.cls : '') + '">' + (label ? '<label class="label"' + (fid ? ' for="' + fid + '"' : '') + '>' + U.escapeHtml(label) + (opts.required ? ' <i class="req">*</i>' : '') + '</label>' : '') + inner + (opts.help ? '<div class="field__help">' + U.escapeHtml(opts.help) + '</div>' : '') + '</div>';
  }
  function selectHtml(id, options, value, opts) {
    opts = opts || {};
    return '<div class="select-wrap"><select class="input select" id="' + id + '">' + (opts.placeholder ? '<option value="">' + U.escapeHtml(opts.placeholder) + '</option>' : '') + options.map(function (o) { return '<option value="' + U.escapeHtml(o.value) + '"' + (o.value === value ? ' selected' : '') + '>' + U.escapeHtml(o.label) + '</option>'; }).join('') + '</select>' + UI.icon('chevron-down', 16) + '</div>';
  }
  function staffOptions() { return S().state.staff.map(function (s) { return { value: s.id, label: s.name + ' — ' + s.role }; }); }
  function workdays(from, to) { var n = 0; for (var d = U.fromISO(from); U.toISO(d) <= to; d = U.addDays(d, 1)) if (!U.isWeekend(d) && !D.holidayName(U.toISO(d))) n++; return n; }
  E.workdays = workdays;
  /** Số ngày phép đã dùng trong năm (đơn nghỉ phép đã duyệt). Định mức 12 ngày/năm. */
  var LEAVE_USED_BASE = 3.5; // số ngày phép đã dùng trước khi có hệ thống (dữ liệu mẫu)
  E.LEAVE_USED_BASE = LEAVE_USED_BASE;
  E.leaveBalance = function (staffId) {
    var y = String(new Date().getFullYear());
    var used = LEAVE_USED_BASE + U.sum(S().state.requests.filter(function (r) { return r.staffId === staffId && r.type === 'leave' && r.status === 'approved' && r.from.slice(0, 4) === y; }), function (r) { return workdays(r.from, r.to); });
    var pending = U.sum(S().state.requests.filter(function (r) { return r.staffId === staffId && r.type === 'leave' && r.status === 'pending' && r.from.slice(0, 4) === y; }), function (r) { return workdays(r.from, r.to); });
    return { total: 12, used: used, pending: pending, left: Math.max(0, 12 - used) };
  };

  /* --------------------------------------------------------- staff picker */
  /** staffPicker(selectedIds, {onChange, max}) -> element (.staff-picker) with .value getter */
  E.staffPicker = function (selectedIds, opts) {
    opts = opts || {};
    var selected = (selectedIds || []).slice();
    var teams = S().state.teams, staff = S().state.staff;
    var wrap = U.el('div', { class: 'staff-picker' });
    wrap.innerHTML = '<div class="staff-picker__top"><div class="input-icon">' + UI.icon('search', 16) + '<input class="input staff-picker__search" type="text" placeholder="Tìm theo tên, vai trò, team…" aria-label="Tìm nhân sự"></div><div class="staff-picker__teams"></div></div><div class="staff-picker__selected"></div><div class="staff-picker__list" role="listbox" aria-multiselectable="true"></div>';
    var search = wrap.querySelector('.staff-picker__search'), list = wrap.querySelector('.staff-picker__list'), sel = wrap.querySelector('.staff-picker__selected'), teamsEl = wrap.querySelector('.staff-picker__teams');
    var teamFilter = '';
    teamsEl.innerHTML = '<button type="button" class="chip chip--btn is-active" data-team="">Tất cả</button>' + teams.map(function (t) { return '<button type="button" class="chip chip--btn chip--color" style="--chip:' + t.color + '" data-team="' + t.id + '"><i class="chip__dot"></i><span>' + U.escapeHtml(t.name) + '</span></button>'; }).join('');
    function renderSel() {
      var people = selected.map(S().staff).filter(Boolean);
      sel.innerHTML = people.length ? people.map(function (p) { return '<span class="chip chip--person">' + UI.avatar(p, { size: 'xs', title: false }) + '<span>' + U.escapeHtml(U.shortName(p.name)) + '</span><button type="button" class="chip__x" data-remove="' + p.id + '" aria-label="Bỏ ' + U.escapeHtml(p.name) + '">' + UI.icon('x', 12) + '</button></span>'; }).join('') + '<span class="staff-picker__count">' + people.length + ' người</span>' : '<span class="muted">Chưa chọn ai — bấm để thêm người tham gia</span>';
    }
    function renderList() {
      var q = search.value;
      var rows = staff.filter(function (s) { return (!teamFilter || s.teamId === teamFilter) && (!q || U.fuzzyMatch(q, s.name + ' ' + s.role + ' ' + (S().team(s.teamId) || {}).name) > 0); });
      var groups = U.groupBy(rows, 'teamId');
      list.innerHTML = teams.filter(function (t) { return groups[t.id]; }).map(function (t) {
        return '<div class="staff-picker__group"><div class="staff-picker__gtitle" style="--chip:' + t.color + '"><i class="chip__dot"></i>' + U.escapeHtml(t.name) + '<button type="button" class="link-btn" data-team-all="' + t.id + '">Chọn cả team</button></div>' + groups[t.id].map(function (s) {
          var on = selected.indexOf(s.id) >= 0;
          return '<button type="button" class="staff-opt' + (on ? ' is-on' : '') + '" role="option" aria-selected="' + on + '" data-id="' + s.id + '">' + UI.avatar(s, { size: 'sm', title: false }) + '<span class="staff-opt__txt"><b>' + U.escapeHtml(s.name) + '</b><small>' + U.escapeHtml(s.role) + '</small></span><span class="staff-opt__check">' + UI.icon('check', 14) + '</span></button>';
        }).join('') + '</div>';
      }).join('') || '<div class="muted pad">Không tìm thấy nhân sự phù hợp</div>';
    }
    function toggle(id) {
      var i = selected.indexOf(id);
      if (i >= 0) selected.splice(i, 1); else { if (opts.max && selected.length >= opts.max) { UI.toast('Chỉ chọn tối đa ' + opts.max + ' người', { kind: 'warning' }); return; } selected.push(id); }
      renderSel(); renderList(); if (opts.onChange) opts.onChange(selected.slice());
    }
    list.addEventListener('click', function (e) {
      var all = e.target.closest('[data-team-all]');
      if (all) { S().staffByTeam(all.dataset.teamAll).forEach(function (s) { if (selected.indexOf(s.id) < 0) selected.push(s.id); }); renderSel(); renderList(); if (opts.onChange) opts.onChange(selected.slice()); return; }
      var b = e.target.closest('.staff-opt'); if (b) toggle(b.dataset.id);
    });
    sel.addEventListener('click', function (e) { var b = e.target.closest('[data-remove]'); if (b) toggle(b.dataset.remove); });
    teamsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-team]'); if (!b) return; teamFilter = b.dataset.team; U.qsa('[data-team]', teamsEl).forEach(function (x) { x.classList.toggle('is-active', x === b); }); renderList(); });
    search.addEventListener('input', U.debounce(renderList, 80));
    renderSel(); renderList();
    Object.defineProperty(wrap, 'value', { get: function () { return selected.slice(); } });
    return wrap;
  };

  /* --------------------------------------------------------------- event */
  /** E.event(existingEvent|null, defaults) — tạo hoặc sửa sự kiện. */
  E.event = function (ev, defaults) {
    var isNew = !ev;
    var st = S().state, me = st.currentUserId;
    var data = Object.assign({ title: '', type: 'meeting', projectId: '', date: U.todayISO(), start: '09:00', end: '10:00', allDay: false, location: '', attendeeIds: [me], notes: '', priority: 2, visibility: 'public', calendarId: '', travelMinutes: 0, reminders: null, prep: [], roles: {} }, defaults || {}, ev || {});
    var optional = Object.keys(data.roles || {}).filter(function (k) { return data.roles[k] === 'optional'; });
    var cals = S().calendars ? S().calendars() : [];
    var id = U.uid('f');
    var types = D.EVENT_TYPES;
    var content = U.el('form', { class: 'form', novalidate: true });
    content.innerHTML =
      field('Tiêu đề', '<input class="input input--lg" id="' + id + '-title" type="text" placeholder="VD: Họp brief Vinamilk Tết" value="' + U.escapeHtml(data.title) + '" required autofocus>', { id: id + '-title', required: true }) +
      field('Loại sự kiện', '<div class="type-picker" role="radiogroup" aria-label="Loại sự kiện">' + types.map(function (t) { return '<button type="button" class="type-opt' + (t.id === data.type ? ' is-on' : '') + '" data-type="' + t.id + '" role="radio" aria-checked="' + (t.id === data.type) + '">' + UI.icon(t.icon, 15) + '<span>' + t.label + '</span></button>'; }).join('') + '</div>') +
      '<div class="form__row">' +
      field('Mức ưu tiên', '<div class="prio-picker" role="radiogroup" aria-label="Mức ưu tiên">' + D.PRIORITIES.map(function (p) { return '<button type="button" class="prio-opt' + (p.id === data.priority ? ' is-on' : '') + '" data-prio="' + p.id + '" role="radio" aria-checked="' + (p.id === data.priority) + '" title="' + U.escapeHtml(p.desc) + '"><span class="prio" data-p="' + p.id + '">' + p.short + '</span>' + p.label + '</button>'; }).join('') + '</div>') +
      field('Lớp lịch', selectHtml(id + '-cal', cals.map(function (c) { return { value: c.id, label: c.name }; }), data.calendarId || '', { placeholder: 'Tự động (theo dự án / team)' })) +
      '</div>' +
      '<div class="form__row form__row--3">' +
      field('Ngày', '<input class="input" id="' + id + '-date" type="date" value="' + data.date + '" required>', { id: id + '-date' }) +
      field('Bắt đầu', '<input class="input" id="' + id + '-start" type="time" step="300" value="' + data.start + '"' + (data.allDay ? ' disabled' : '') + '>', { id: id + '-start', cls: 'field--time' }) +
      field('Kết thúc', '<input class="input" id="' + id + '-end" type="time" step="300" value="' + data.end + '"' + (data.allDay ? ' disabled' : '') + '>', { id: id + '-end', cls: 'field--time' }) +
      '</div>' +
      '<label class="switch"><input type="checkbox" id="' + id + '-allday"' + (data.allDay ? ' checked' : '') + '><span class="switch__track"></span><span class="switch__label">Cả ngày</span></label>' +
      '<div class="form__row">' +
      field('Dự án', selectHtml(id + '-project', st.projects.map(function (p) { return { value: p.id, label: p.client + ' — ' + p.name }; }), data.projectId, { placeholder: 'Không gắn dự án' })) +
      field('Địa điểm', '<div class="input-icon">' + UI.icon('map-pin', 16) + '<input class="input" id="' + id + '-loc" type="text" placeholder="Phòng họp, địa chỉ hoặc link online" value="' + U.escapeHtml(data.location || '') + '"></div>') +
      '</div>' +
      '<div class="form__row form__row--3">' +
      field('Di chuyển (phút)', '<input class="input" id="' + id + '-travel" type="number" min="0" step="5" value="' + (data.travelMinutes || 0) + '">', { help: 'Cho họp ngoài văn phòng' }) +
      field('Nhắc trước', '<div class="reminder-chips" role="group" aria-label="Nhắc trước">' + [[1440, '1 ngày'], [60, '1 giờ'], [15, '15 phút']].map(function (r) { var on = (data.reminders || (data.priority === 1 ? [1440, 60, 15] : data.priority === 3 ? [15] : [60, 15])).indexOf(r[0]) >= 0; return '<button type="button" class="chip chip--btn' + (on ? ' is-active' : '') + '" data-rem="' + r[0] + '" aria-pressed="' + on + '">' + r[1] + '</button>'; }).join('') + '</div>') +
      field('Hiển thị', '<label class="switch" style="height:var(--input-h)"><input type="checkbox" id="' + id + '-private"' + (data.visibility === 'private' ? ' checked' : '') + '><span class="switch__track"></span><span class="switch__label">Riêng tư</span></label>', { help: 'Người khác chỉ thấy “Bận”' }) +
      '</div>' +
      '<div class="field"><span class="label">Người tham gia</span><div class="staff-picker-slot"></div><div class="attendee-roles" data-roles></div></div>' +
      field('Việc cần chuẩn bị', '<textarea class="input textarea" id="' + id + '-prep" rows="2" placeholder="Mỗi dòng một việc, VD: In 6 bộ deck">' + U.escapeHtml((data.prep || []).map(function (p) { return p.text; }).join('\n')) + '</textarea>', { help: 'Sẽ thành checklist trong chi tiết sự kiện' }) +
      field('Ghi chú / Agenda', '<textarea class="input textarea" id="' + id + '-notes" rows="3" placeholder="Agenda, call time, link tài liệu…">' + U.escapeHtml(data.notes || '') + '</textarea>') +
      '<div class="form__error" role="alert" hidden></div>';
    var rolesEl = content.querySelector('[data-roles]');
    function renderRoles(ids) {
      var others = (ids || picker.value).filter(function (x) { return x !== (data.ownerId || me); }).map(function (x) { return S().staff(x); }).filter(Boolean);
      rolesEl.innerHTML = others.length ? '<span class="muted" style="font-size:12px;width:100%">Bấm tên để đánh dấu <b>tuỳ chọn</b> (không bắt buộc dự):</span>' + others.map(function (p) { var opt = optional.indexOf(p.id) >= 0; return '<button type="button" class="chip chip--person' + (opt ? ' is-optional' : '') + '" data-role-toggle="' + p.id + '" aria-pressed="' + opt + '">' + UI.avatar(p, { size: 'xs', title: false }) + '<span>' + U.escapeHtml(U.shortName(p.name)) + (opt ? ' · tuỳ chọn' : '') + '</span></button>'; }).join('') : '';
    }
    var picker = E.staffPicker(data.attendeeIds, { onChange: function (ids) { renderRoles(ids); } });
    content.querySelector('.staff-picker-slot').appendChild(picker);
    renderRoles();
    rolesEl.addEventListener('click', function (e) { var b = e.target.closest('[data-role-toggle]'); if (!b) return; var pid = b.dataset.roleToggle, i = optional.indexOf(pid); if (i >= 0) optional.splice(i, 1); else optional.push(pid); renderRoles(); });
    var prioEl = content.querySelector('.prio-picker');
    prioEl.addEventListener('click', function (e) { var b = e.target.closest('.prio-opt'); if (!b) return; U.qsa('.prio-opt', prioEl).forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('is-on'); b.setAttribute('aria-checked', 'true'); data.priority = +b.dataset.prio; });
    content.querySelector('.reminder-chips').addEventListener('click', function (e) { var b = e.target.closest('[data-rem]'); if (!b) return; b.classList.toggle('is-active'); b.setAttribute('aria-pressed', b.classList.contains('is-active')); });
    var typeEl = content.querySelector('.type-picker');
    typeEl.addEventListener('click', function (e) { var b = e.target.closest('.type-opt'); if (!b) return; U.qsa('.type-opt', typeEl).forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('is-on'); b.setAttribute('aria-checked', 'true'); data.type = b.dataset.type; if (data.type === 'deadline') { var s = content.querySelector('#' + id + '-start'); content.querySelector('#' + id + '-end').value = s.value; } });
    var allDay = content.querySelector('#' + id + '-allday');
    allDay.addEventListener('change', function () { content.querySelector('#' + id + '-start').disabled = allDay.checked; content.querySelector('#' + id + '-end').disabled = allDay.checked; });
    content.querySelector('#' + id + '-start').addEventListener('change', function (e) {
      var s = U.timeToMin(e.target.value), endEl = content.querySelector('#' + id + '-end');
      if (data.type === 'deadline') endEl.value = e.target.value;
      else if (U.timeToMin(endEl.value) <= s) endEl.value = U.minToTime(Math.min(s + 60, 23 * 60 + 55));
    });

    function read() {
      return {
        title: content.querySelector('#' + id + '-title').value.trim(), type: data.type, projectId: content.querySelector('#' + id + '-project').value || null,
        date: content.querySelector('#' + id + '-date').value, start: content.querySelector('#' + id + '-start').value || '09:00', end: content.querySelector('#' + id + '-end').value || '10:00',
        allDay: allDay.checked, location: content.querySelector('#' + id + '-loc').value.trim(), attendeeIds: picker.value, notes: content.querySelector('#' + id + '-notes').value.trim(),
        priority: data.priority, calendarId: content.querySelector('#' + id + '-cal').value || undefined, visibility: content.querySelector('#' + id + '-private').checked ? 'private' : 'public',
        travelMinutes: Math.max(0, +content.querySelector('#' + id + '-travel').value || 0),
        reminders: U.qsa('.reminder-chips .is-active', content).map(function (b) { return +b.dataset.rem; }),
        roles: (function () { var r = Object.assign({}, data.roles || {}); Object.keys(r).forEach(function (k) { if (r[k] === 'optional') delete r[k]; }); optional.forEach(function (pid) { r[pid] = 'optional'; }); return r; })(),
        prep: (function () { var lines = content.querySelector('#' + id + '-prep').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); var old = data.prep || []; return lines.map(function (text) { var ex = old.find(function (p) { return p.text === text; }); return ex ? ex : { text: text, ownerId: data.ownerId || me, done: false }; }); })()
      };
    }
    function showError(msg) { var er = content.querySelector('.form__error'); er.textContent = msg; er.hidden = false; content.classList.remove('shake'); void content.offsetWidth; content.classList.add('shake'); }
    var modal = UI.modal({
      title: isNew ? 'Tạo sự kiện mới' : 'Chỉnh sửa sự kiện', subtitle: isNew ? 'Sự kiện sẽ xuất hiện trên lịch của mọi người tham gia.' : U.fmtDate(data.date, 'long'), size: 'lg', content: content, cls: 'modal--event',
      actions: [].concat(isNew ? [] : [{ label: 'Xoá', kind: 'ghost-danger', icon: 'trash', align: 'left', keep: true, onClick: function (close) { UI.confirm({ title: 'Xoá sự kiện?', message: '"' + data.title + '" sẽ bị xoá khỏi lịch của mọi người tham gia.', confirmLabel: 'Xoá', danger: true }).then(function (ok) { if (ok) { S().deleteEvent(ev.id); close(); UI.toast('Đã xoá sự kiện', { kind: 'info' }); } }); } }],
        [{ label: 'Huỷ', kind: 'ghost' }, { label: isNew ? 'Tạo sự kiện' : 'Lưu thay đổi', kind: 'primary', icon: 'check', keep: true, onClick: function (close) {
          var v = read();
          if (!v.title) return showError('Vui lòng nhập tiêu đề sự kiện.');
          if (!v.date) return showError('Vui lòng chọn ngày.');
          if (!v.allDay && U.timeToMin(v.end) < U.timeToMin(v.start)) return showError('Giờ kết thúc phải sau giờ bắt đầu.');
          if (!v.attendeeIds.length) return showError('Chọn ít nhất một người tham gia.');
          if (!v.calendarId) { if (isNew) delete v.calendarId; else v.calendarId = v.projectId ? 'project:' + v.projectId : (ev.calendarId || 'company'); }
          var saved = isNew ? S().addEvent(v) : S().updateEvent(ev.id, v);
          close();
          UI.toast(isNew ? 'Đã tạo "' + v.title + '"' : 'Đã lưu thay đổi', { kind: 'success', action: { label: 'Xem', onClick: function () { E.eventDetail(saved.id); } } });
        } }])
    });
    content.addEventListener('submit', function (e) { e.preventDefault(); modal.el.querySelector('.modal__foot .btn--primary').click(); });
    return modal;
  };

  /** E.eventDetail(id) — xem chi tiết sự kiện (RSVP, chuẩn bị, nhắc, uỷ quyền). */
  E.eventDetail = function (id) {
    var st = S(), ev = st.event(id); if (!ev) return UI.toast('Sự kiện không còn tồn tại', { kind: 'warning' });
    var content = U.el('div');
    var modal = UI.modal({ title: false, ariaLabel: st.displayTitle(ev), size: 'md', content: content, cls: 'modal--detail', actions: buildActions(), onClose: function () { if (unsub) unsub(); } });
    var unsub = st.subscribe(function (state, meta) { if (meta.type && /event/.test(meta.type)) { if (!st.event(id)) { modal.close(); return; } render(); } });
    modal.el.insertBefore(U.el('button', { class: 'icon-btn modal__close modal__close--float', 'aria-label': 'Đóng', html: UI.icon('x', 18), onclick: function () { modal.close(); } }), modal.el.firstChild);

    function buildActions() {
      var me = st.state.currentUserId, joined = ev.attendeeIds.indexOf(me) >= 0, canSee = st.canSee(ev, me);
      if (!canSee) return [{ label: 'Đóng', kind: 'primary' }];
      return [
        { label: 'Xoá', kind: 'ghost-danger', icon: 'trash', align: 'left', keep: true, onClick: function (close) { UI.confirm({ title: 'Xoá sự kiện?', message: '"' + ev.title + '" sẽ bị xoá khỏi lịch.', confirmLabel: 'Xoá', danger: true }).then(function (ok) { if (ok) { st.deleteEvent(ev.id); close(); UI.toast('Đã xoá sự kiện'); } }); } },
        { label: joined ? 'Rời sự kiện' : 'Tham gia', kind: 'ghost', icon: joined ? 'x' : 'user-plus', onClick: function () { var ids = joined ? ev.attendeeIds.filter(function (x) { return x !== me; }) : ev.attendeeIds.concat([me]); st.updateEvent(ev.id, { attendeeIds: ids }); if (!joined) st.setRsvp(ev.id, me, 'yes'); UI.toast(joined ? 'Bạn đã rời sự kiện' : 'Đã thêm vào lịch của bạn', { kind: 'success' }); } },
        { label: 'Nhân bản', kind: 'ghost', icon: 'copy', onClick: function () { var c = Object.assign({}, ev); delete c.id; delete c.ownerId; delete c.birthdayOf; delete c.rsvp; delete c.nudges; c.title = ev.title + ' (bản sao)'; c.date = U.toISO(U.addDays(U.fromISO(ev.date), 7)); E.event(null, c); } },
        { label: 'Chỉnh sửa', kind: 'primary', icon: 'edit', onClick: function () { setTimeout(function () { E.event(ev); }, 80); } }
      ];
    }

    function render() {
      ev = st.event(id); if (!ev) return;
      var me = st.state.currentUserId, canSee = st.canSee(ev, me), type = st.eventType(ev.type), project = ev.projectId ? st.project(ev.projectId) : null, owner = st.staff(ev.ownerId), cal = st.calendarOf(ev);
      var people = ev.attendeeIds.map(st.staff).filter(Boolean), joined = ev.attendeeIds.indexOf(me) >= 0, isOwner = ev.ownerId === me;
      var date = U.fromISO(ev.date), diff = U.daysBetween(U.today(), date);
      var when = (Math.abs(diff) <= 1 ? U.fmtRelativeDay(date) + ' · ' : '') + U.fmtDate(date, 'long');
      var dur = ev.allDay ? 'Cả ngày' : U.fmtTimeRange(ev.start, ev.end) + (U.timeToMin(ev.end) > U.timeToMin(ev.start) ? ' · ' + U.fmtDuration(U.timeToMin(ev.end) - U.timeToMin(ev.start)) : '');
      var rs = st.rsvpSummary(ev), ps = st.prepStatus(ev), myR = st.rsvpOf(ev, me), dg = joined ? st.delegable(ev, me) : null, prio = st.priority(ev.priority || 2);
      var html = '<div class="ev-detail" data-type="' + ev.type + '"' + (project ? ' style="--ev:' + project.color + '"' : '') + '>';
      if (!canSee) {
        html += '<div class="ev-detail__tags">' + UI.chip('Riêng tư', { icon: 'shield', tone: 'muted' }) + '</div><h3 class="ev-detail__title">Bận (riêng tư)</h3><div class="ev-detail__rows"><div class="ev-detail__row">' + UI.icon('calendar', 18) + '<div><b>' + U.escapeHtml(when) + '</b><small>' + U.escapeHtml(dur) + '</small></div></div>' + (owner ? '<div class="ev-detail__row">' + UI.icon('user', 18) + '<div><b>' + U.escapeHtml(owner.name) + '</b><small>Chỉ người tham gia xem được chi tiết</small></div></div>' : '') + '</div></div>';
        U.render(content, html); return;
      }
      html += '<div class="ev-detail__tags">' + UI.chip(type.label, { icon: type.icon, cls: 'chip--type' }) + '<span class="cal-chip" title="Lớp lịch"><i style="--c:' + cal.color + '"></i>' + U.escapeHtml(cal.name) + '</span><span class="prio" data-p="' + prio.id + '" title="' + prio.label + '">' + prio.short + ' · ' + prio.label + '</span>' + (ev.visibility === 'private' ? UI.chip('Riêng tư', { icon: 'shield', tone: 'muted' }) : '') + (ev.birthdayOf ? UI.chip('Sinh nhật', { icon: 'cake', tone: 'red' }) : '') + '</div>' +
        '<h3 class="ev-detail__title">' + U.escapeHtml(ev.title) + '</h3>' +
        '<div class="ev-detail__rows">' +
        '<div class="ev-detail__row">' + UI.icon('calendar', 18) + '<div><b>' + U.escapeHtml(when) + '</b><small>' + U.escapeHtml(dur) + (ev.travelMinutes ? ' · <span class="travel-tag">' + UI.icon('map-pin', 12) + 'di chuyển ~' + ev.travelMinutes + "'</span>" : '') + '</small></div></div>' +
        (ev.location ? '<div class="ev-detail__row">' + UI.icon('map-pin', 18) + '<div><b>' + U.escapeHtml(ev.location) + '</b>' + (/^https?:|meet|zoom/i.test(ev.location) ? '<small>Online</small>' : '') + '</div></div>' : '') +
        (owner ? '<div class="ev-detail__row">' + UI.icon('user', 18) + '<div><b>' + U.escapeHtml(owner.name) + '</b><small>Chủ trì · ' + U.escapeHtml(owner.role) + '</small></div></div>' : '') +
        '</div>';
      // RSVP của tôi / tổng hợp cho chủ trì
      if (joined && !isOwner && ev.type !== 'focus') {
        html += '<div class="rsvp-bar" style="margin-top:14px"><b>Bạn có tham dự?</b>' + [['yes', 'Tham dự', 'check'], ['maybe', 'Có thể', 'circle-dot'], ['no', 'Vắng', 'x']].map(function (o) { return '<button type="button" class="btn btn--sm ' + (myR === o[0] ? 'btn--primary is-on' : 'btn--secondary') + '" data-rsvp="' + o[0] + '" data-event="' + ev.id + '">' + UI.icon(o[2], 14) + o[1] + '</button>'; }).join('') + '</div>';
      }
      if ((isOwner || st.isLead(me)) && people.length > 1) {
        html += '<div class="rsvp-bar" style="margin-top:' + (joined && !isOwner ? 8 : 14) + 'px"><span class="rsvp-summary"><span><i class="rsvp-dot" data-rsvp="yes"></i>' + rs.yes + ' tham dự</span><span><i class="rsvp-dot" data-rsvp="maybe"></i>' + rs.maybe + ' có thể</span><span><i class="rsvp-dot" data-rsvp="pending"></i>' + rs.pending + ' chưa phản hồi</span>' + (rs.no ? '<span><i class="rsvp-dot" data-rsvp="no"></i>' + rs.no + ' vắng</span>' : '') + '</span>' + (rs.pending + rs.maybe > 0 ? '<button type="button" class="btn btn--sm btn--soft" data-nudge="' + ev.id + '">' + UI.icon('bell', 14) + 'Nhắc ' + (rs.pending + rs.maybe) + ' người</button>' : '') + (ev.nudges && ev.nudges.length ? '<small class="muted">Đã nhắc ' + U.timeAgo(ev.nudges[ev.nudges.length - 1].at) + '</small>' : '') + '</div>';
      }
      if (dg) html += '<div class="banner" style="margin-top:10px">' + UI.icon('user-plus', 16) + '<div><b>Có thể uỷ quyền cho ' + U.escapeHtml(U.shortName(dg.to.name)) + '</b><br><small class="muted">' + U.escapeHtml(dg.reason) + '. Bạn có thể vắng mà không ảnh hưởng.</small></div><button type="button" class="btn btn--sm btn--secondary ml-auto" data-delegate="' + dg.to.id + '">Uỷ quyền</button></div>';
      // Người tham gia
      html += '<div class="ev-detail__people"><div class="ev-detail__label">Người tham gia · ' + people.length + '</div><div class="people-grid">' + people.map(function (p) { var r = st.rsvpOf(ev, p.id), role = st.roleOf(ev, p.id); return '<button type="button" class="person" data-staff="' + p.id + '" title="' + U.escapeHtml(p.name + ' · ' + ({ yes: 'Tham dự', maybe: 'Có thể', no: 'Vắng', pending: 'Chưa phản hồi' })[r]) + '">' + UI.avatar(p, { size: 'sm', title: false }).replace('</span>', '<i class="avatar__rsvp" data-rsvp="' + r + '"></i></span>') + '<span><b>' + U.escapeHtml(U.shortName(p.name)) + (role !== 'required' ? ' <span class="role-tag" data-role="' + role + '">' + (role === 'organizer' ? 'Chủ trì' : 'Tuỳ chọn') + '</span>' : '') + '</b><small>' + U.escapeHtml(p.role) + '</small></span></button>'; }).join('') + '</div></div>';
      // Chuẩn bị
      if (ev.type !== 'focus' && ev.type !== 'travel') {
        html += '<div class="ev-detail__people"><div class="between" style="margin-bottom:8px"><div class="ev-detail__label" style="margin:0">Chuẩn bị' + (ps.total ? ' · ' + ps.done + '/' + ps.total : '') + '</div>' + (ps.total ? '<span class="prep__bar">' + UI.progress(ps.total ? ps.done / ps.total * 100 : 0, { color: ps.open && ps.overdue ? 'var(--warn)' : 'var(--ok)' }) + (ps.open && ps.overdue ? '<span style="color:var(--warn)">còn ' + ps.open + ' việc, sắp diễn ra</span>' : '') + '</span>' : '') + '</div>' +
          '<div class="prep">' + (ev.prep || []).map(function (p) { var o = st.staff(p.ownerId); return '<div class="prep__item' + (p.done ? ' is-done' : '') + '"><button type="button" class="prep__check" data-prep="' + p.id + '" aria-label="' + (p.done ? 'Bỏ đánh dấu' : 'Đánh dấu xong') + '" aria-pressed="' + p.done + '">' + UI.icon('check', 12) + '</button><span class="prep__text">' + U.escapeHtml(p.text) + '</span>' + (o ? '<span class="prep__owner">' + UI.avatar(o, { size: 'xs', title: false }) + U.escapeHtml(U.firstName(o.name)) + '</span>' : '') + '<button type="button" class="icon-btn icon-btn--sm" data-prep-remove="' + p.id + '" aria-label="Xoá việc">' + UI.icon('x', 13) + '</button></div>'; }).join('') + '</div>' +
          '<form class="prep__add" data-prep-add><input class="input" type="text" placeholder="Thêm việc cần chuẩn bị…" aria-label="Việc cần chuẩn bị"><button class="btn btn--sm btn--secondary" type="submit">' + UI.icon('plus', 14) + 'Thêm</button></form>' +
          ((ev.priority === 1 || ev.travelMinutes) && ev.date >= U.todayISO() ? '<div class="row row--wrap" style="margin-top:8px;gap:6px">' + (ev.priority === 1 && !st.state.events.some(function (x) { return x.linkedTo === ev.id && x.type === 'focus'; }) ? '<button type="button" class="btn btn--sm btn--ghost" data-prepblock>' + UI.icon('target', 14) + "Thêm 30' chuẩn bị trước họp</button>" : '') + (ev.travelMinutes && !st.state.events.some(function (x) { return x.linkedTo === ev.id && x.type === 'travel'; }) ? '<button type="button" class="btn btn--sm btn--ghost" data-travelblock>' + UI.icon('map-pin', 14) + 'Chặn ' + ev.travelMinutes + "' di chuyển</button>" : '') + '</div>' : '') +
          '</div>';
      }
      if (ev.notes) html += '<div class="ev-detail__notes"><div class="ev-detail__label">Ghi chú / Agenda</div><p>' + U.escapeHtml(ev.notes) + '</p></div>';
      else if (ev.priority === 1 && ev.type === 'meeting' && people.length > 2) html += '<div class="banner banner--warn" style="margin-top:14px">' + UI.icon('alert-triangle', 16) + '<div>Họp P1 chưa có agenda — người tham gia sẽ chuẩn bị tốt hơn nếu biết trước nội dung.' + (isOwner ? '' : ' <button type="button" class="link-btn" data-ask-agenda>Yêu cầu agenda</button>') + '</div></div>';
      html += '</div>';
      U.render(content, html);
    }
    content.addEventListener('click', function (e) {
      var t, me = st.state.currentUserId;
      if ((t = e.target.closest('[data-rsvp][data-event]'))) { st.setRsvp(ev.id, me, t.dataset.rsvp); UI.toast({ yes: 'Đã xác nhận tham dự', maybe: 'Đã đánh dấu: có thể tham dự', no: 'Đã báo vắng' }[t.dataset.rsvp], { kind: 'success' }); return; }
      if ((t = e.target.closest('[data-nudge]'))) { var n = st.nudge(ev.id, me); UI.toast(n ? 'Đã nhắc ' + n + ' người xác nhận lịch' : 'Mọi người đã xác nhận', { kind: n ? 'brand' : 'info' }); return; }
      if ((t = e.target.closest('[data-delegate]'))) { var to = st.staff(t.dataset.delegate); st.delegate(ev.id, me, t.dataset.delegate); UI.toast('Đã uỷ quyền cho ' + U.shortName(to.name) + ' — bạn đã rời sự kiện', { kind: 'success' }); modal.close(); return; }
      if ((t = e.target.closest('[data-prep]'))) { st.togglePrep(ev.id, t.dataset.prep); return; }
      if ((t = e.target.closest('[data-prep-remove]'))) { st.removePrep(ev.id, t.dataset.prepRemove); return; }
      if ((t = e.target.closest('[data-prepblock]'))) { var pb = st.addPrepBlock(ev.id, me); UI.toast("Đã chặn 30' chuẩn bị lúc " + pb.start, { kind: 'success' }); return; }
      if ((t = e.target.closest('[data-travelblock]'))) { var tb = st.addTravelBlock(ev.id, me); UI.toast('Đã chặn di chuyển ' + tb.start + ' – ' + tb.end, { kind: 'success' }); return; }
      if ((t = e.target.closest('[data-ask-agenda]'))) { var ow = st.staff(ev.ownerId); st.notify({ kind: 'warning', title: 'Yêu cầu agenda: ' + ev.title, body: U.shortName(st.me().name) + ' đề nghị ' + (ow ? U.shortName(ow.name) : 'chủ trì') + ' bổ sung agenda trước giờ họp.', link: '#/calendar/day/' + ev.date, eventId: ev.id }); UI.toast('Đã gửi yêu cầu agenda tới ' + (ow ? U.shortName(ow.name) : 'chủ trì'), { kind: 'success' }); return; }
      if ((t = e.target.closest('.person'))) { modal.close(); setTimeout(function () { E.staffProfile(t.dataset.staff); }, 60); }
    });
    content.addEventListener('submit', function (e) { var f = e.target.closest('[data-prep-add]'); if (!f) return; e.preventDefault(); var inp = f.querySelector('input'); if (inp.value.trim()) { st.addPrep(ev.id, inp.value.trim(), st.state.currentUserId); inp.value = ''; } });
    render();
    return modal;
  };

  /* -------------------------------------------------------------- request */
  /** E.request(defaults) — gửi yêu cầu nghỉ phép / remote / OT / đổi ca */
  E.request = function (defaults) {
    var st = S().state, me = st.currentUserId;
    var data = Object.assign({ staffId: me, type: 'leave', from: U.toISO(U.addDays(U.today(), 1)), to: U.toISO(U.addDays(U.today(), 1)), reason: '', swapWithId: '' }, defaults || {});
    var id = U.uid('r');
    var content = U.el('form', { class: 'form', novalidate: true });
    content.innerHTML =
      field('Người yêu cầu', selectHtml(id + '-staff', staffOptions(), data.staffId), { id: id + '-staff' }) +
      field('Loại yêu cầu', '<div class="type-picker type-picker--big" role="radiogroup" aria-label="Loại yêu cầu">' + REQUEST_TYPES.map(function (t) { return '<button type="button" class="type-opt' + (t.id === data.type ? ' is-on' : '') + '" data-type="' + t.id + '" role="radio" aria-checked="' + (t.id === data.type) + '">' + UI.icon(t.icon, 18) + '<span><b>' + t.label + '</b><small>' + t.desc + '</small></span></button>'; }).join('') + '</div>') +
      '<div class="form__row">' + field('Từ ngày', '<input class="input" id="' + id + '-from" type="date" value="' + data.from + '">', { id: id + '-from' }) + field('Đến ngày', '<input class="input" id="' + id + '-to" type="date" value="' + data.to + '">', { id: id + '-to' }) + '</div>' +
      '<div class="req-summary muted"></div>' +
      '<div class="swap-slot"' + (data.type === 'swap' ? '' : ' hidden') + '>' + field('Đổi ca với', selectHtml(id + '-swap', staffOptions().filter(function (o) { return o.value !== data.staffId; }), data.swapWithId, { placeholder: 'Chọn đồng nghiệp' })) + '</div>' +
      field('Lý do', '<textarea class="input textarea" id="' + id + '-reason" rows="3" placeholder="Mô tả ngắn gọn để quản lý duyệt nhanh hơn…">' + U.escapeHtml(data.reason) + '</textarea>', { id: id + '-reason', required: true }) +
      '<div class="form__error" role="alert" hidden></div>';
    var typeEl = content.querySelector('.type-picker'), swapSlot = content.querySelector('.swap-slot'), summary = content.querySelector('.req-summary');
    function updateSummary() {
      var f = content.querySelector('#' + id + '-from').value, t = content.querySelector('#' + id + '-to').value;
      if (!f || !t || t < f) { summary.textContent = ''; return; }
      var n = workdays(f, t);
      var bal = E.leaveBalance(content.querySelector('#' + id + '-staff').value);
      summary.innerHTML = UI.icon('info', 14) + ' ' + n + ' ngày làm việc · ' + U.escapeHtml(U.fmtRange(f, t)) + (data.type === 'leave' ? ' · Phép năm còn lại sau khi duyệt: <b>' + U.fmtNumber(Math.max(0, bal.left - n)) + '/' + bal.total + ' ngày</b>' : '');
    }
    typeEl.addEventListener('click', function (e) { var b = e.target.closest('.type-opt'); if (!b) return; U.qsa('.type-opt', typeEl).forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('is-on'); b.setAttribute('aria-checked', 'true'); data.type = b.dataset.type; swapSlot.hidden = data.type !== 'swap'; updateSummary(); });
    content.querySelector('#' + id + '-from').addEventListener('change', function (e) { var to = content.querySelector('#' + id + '-to'); if (to.value < e.target.value) to.value = e.target.value; updateSummary(); });
    content.querySelector('#' + id + '-staff').addEventListener('change', function (e) {
      var sw = content.querySelector('#' + id + '-swap'), cur = sw.value;
      sw.innerHTML = '<option value="">Chọn đồng nghiệp</option>' + staffOptions().filter(function (o) { return o.value !== e.target.value; }).map(function (o) { return '<option value="' + o.value + '"' + (o.value === cur ? ' selected' : '') + '>' + U.escapeHtml(o.label) + '</option>'; }).join('');
      updateSummary();
    });
    content.querySelector('#' + id + '-to').addEventListener('change', updateSummary);
    updateSummary();
    function showError(msg) { var er = content.querySelector('.form__error'); er.textContent = msg; er.hidden = false; content.classList.remove('shake'); void content.offsetWidth; content.classList.add('shake'); }
    var modal = UI.modal({
      title: 'Gửi yêu cầu', subtitle: 'Quản lý trực tiếp sẽ nhận thông báo và duyệt trong mục Yêu cầu.', size: 'md', content: content,
      actions: [{ label: 'Huỷ', kind: 'ghost' }, { label: 'Gửi yêu cầu', kind: 'primary', icon: 'send', keep: true, onClick: function (close) {
        var from = content.querySelector('#' + id + '-from').value, to = content.querySelector('#' + id + '-to').value, reason = content.querySelector('#' + id + '-reason').value.trim();
        var staffId = content.querySelector('#' + id + '-staff').value, swapWithId = content.querySelector('#' + id + '-swap').value;
        if (!from || !to) return showError('Vui lòng chọn khoảng ngày.');
        if (to < from) return showError('Ngày kết thúc phải sau ngày bắt đầu.');
        if (data.type === 'swap' && !swapWithId) return showError('Chọn đồng nghiệp để đổi ca.');
        if (!reason) return showError('Vui lòng nhập lý do.');
        var r = S().addRequest({ staffId: staffId, type: data.type, from: from, to: to, reason: reason, swapWithId: swapWithId || undefined });
        var who = S().staff(staffId);
        S().notify({ kind: 'warning', title: 'Yêu cầu mới: ' + E.requestType(r.type).label, body: who.name + ' · ' + U.fmtRange(from, to) + ' · ' + reason, link: '#/requests' });
        close();
        UI.toast('Đã gửi yêu cầu ' + E.requestType(r.type).label.toLowerCase(), { kind: 'success', action: { label: 'Xem', onClick: function () { location.hash = '#/requests'; } } });
      } }]
    });
    content.addEventListener('submit', function (e) { e.preventDefault(); modal.el.querySelector('.modal__foot .btn--primary').click(); });
    return modal;
  };

  /* --------------------------------------------------------- shift picker */
  /** E.shiftPicker(anchorEl, staffId, iso, {onPick}) — popover đổi ca. */
  E.shiftPicker = function (anchor, staffId, iso, opts) {
    opts = opts || {};
    var st = S(), staff = st.staff(staffId), current = st.shiftOf(staffId, iso);
    var html = '<div class="shift-picker"><div class="shift-picker__head">' + UI.avatar(staff, { size: 'xs', title: false }) + '<div><b>' + U.escapeHtml(U.shortName(staff.name)) + '</b><small>' + U.escapeHtml(U.fmtDate(iso, 'long')) + '</small></div></div>' +
      '<div class="shift-picker__list" role="listbox" aria-label="Loại ca">' + D.SHIFT_TYPES.map(function (t) { return '<button type="button" class="shift-picker__opt' + (t.id === current ? ' is-on' : '') + '" data-shift="' + t.id + '" role="option" aria-selected="' + (t.id === current) + '" tabindex="' + (t.id === current ? '0' : '-1') + '"><span class="shift shift--dot" data-shift="' + t.id + '"><span class="shift__short">' + t.short + '</span></span><span class="shift-picker__txt"><b>' + t.label + '</b><small>' + t.hours + '</small></span>' + (t.id === current ? UI.icon('check', 14) : '') + '</button>'; }).join('') + '</div>' +
      '<label class="switch switch--sm shift-picker__week"><input type="checkbox" class="apply-week"><span class="switch__track"></span><span class="switch__label">Áp dụng cả tuần (T2–T6)</span></label></div>';
    var pop = UI.popover(anchor, html, { placement: opts.placement || 'bottom-start', cls: 'popover--shift', width: 280, ariaLabel: 'Đổi ca ' + U.shortName(staff.name) + ' · ' + U.fmtDate(iso, 'shortWeekday') });
    pop.el.addEventListener('keydown', function (e) {
      var os = U.qsa('.shift-picker__opt', pop.el), i = os.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); var n = e.key === 'ArrowDown' ? (os[i + 1] || os[0]) : (os[i - 1] || os[os.length - 1]); os.forEach(function (o) { o.tabIndex = -1; }); n.tabIndex = 0; n.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); os[0].focus(); } else if (e.key === 'End') { e.preventDefault(); os[os.length - 1].focus(); }
    });
    pop.el.addEventListener('click', function (e) {
      var b = e.target.closest('.shift-picker__opt'); if (!b) return;
      var type = b.dataset.shift, week = pop.el.querySelector('.apply-week').checked;
      if (week) { var days = U.weekDays(U.fromISO(iso)); st.setShiftRange(staffId, U.toISO(days[0]), U.toISO(days[4]), type); }
      else st.setShift(staffId, iso, type);
      pop.close();
      UI.toast((week ? 'Cả tuần của ' : U.fmtDate(iso, 'shortWeekday') + ' của ') + U.shortName(staff.name) + ' → ' + st.shiftType(type).label, { kind: 'success' });
      if (opts.onPick) opts.onPick(type, { week: week, date: iso, staffId: staffId });
    });
    return pop;
  };

  /* -------------------------------------------------------- staff profile */
  /** E.staffProfile(staffId) — drawer hồ sơ nhân sự. */
  E.staffProfile = function (staffId) {
    var st = S(), s = st.staff(staffId); if (!s) return;
    var unsub;
    var drawer = UI.drawer({ title: false, ariaLabel: 'Hồ sơ ' + s.name, size: 'md', cls: 'drawer--profile', content: '', onClose: function () { if (unsub) { unsub(); unsub = null; } } });
    function render() {
      s = st.staff(staffId); if (!s) { drawer.close(); return; }
      var ae = document.activeElement, focusKey = null;
      if (ae && drawer.body.contains(ae)) focusKey = ae.dataset.status ? '.status-opt[data-status="' + ae.dataset.status + '"]' : ae.dataset.iso ? '.week-strip__day[data-iso="' + ae.dataset.iso + '"]' : ae.dataset.act ? '[data-act="' + ae.dataset.act + '"]' : ae.dataset.event ? '.ev-pill[data-event="' + ae.dataset.event + '"]' : null;
      var team = st.team(s.teamId), wl = st.workload(s.id), todayISO = U.todayISO();
      var days = U.weekDays(U.today());
      var upcoming = st.upcomingFor(s.id, 5);
      var projects = st.state.projects.filter(function (p) { return p.memberIds.indexOf(s.id) >= 0 && p.status !== 'done'; });
      var isMe = s.id === st.state.currentUserId;
      var statuses = ['available', 'busy', 'remote', 'onsite', 'off'];
      drawer.body.innerHTML =
        '<div class="profile__hero" style="--team:' + team.color + '"><button class="icon-btn profile__close" aria-label="Đóng">' + UI.icon('x', 18) + '</button>' +
        '<div class="profile__id">' + UI.avatar(s, { size: 'xl', status: true, ring: true, title: false }) + '<div><h2 class="profile__name">' + U.escapeHtml(s.name) + (isMe ? ' <span class="chip chip--muted chip--xs">Bạn</span>' : '') + '</h2><div class="profile__role">' + U.escapeHtml(s.role) + '</div><div class="profile__chips">' + UI.teamChip(team) + UI.chip(s.location === 'HN' ? 'Hà Nội' : 'TP. HCM', { icon: 'map-pin' }) + UI.chip('Từ ' + s.joined.slice(0, 4), { icon: 'award' }) + '</div></div></div>' +
        '<div class="profile__status"><span class="label">Trạng thái</span><div class="status-picker">' + statuses.map(function (x) { return '<button type="button" class="status-opt' + (x === s.status ? ' is-on' : '') + '" data-status="' + x + '" aria-pressed="' + (x === s.status) + '"><i class="status-dot" data-status="' + x + '"></i>' + UI.statusLabel(x) + '</button>'; }).join('') + '</div></div></div>' +
        '<div class="profile__body">' +
        '<div class="profile__actions"><button class="btn btn--primary" data-act="meet">' + UI.icon('calendar', 16) + 'Đặt lịch họp</button><button class="btn btn--soft" data-act="request">' + UI.icon('send', 16) + 'Tạo yêu cầu</button><button class="btn btn--ghost" data-act="calendar">' + UI.icon('eye', 16) + 'Xem lịch</button></div>' +
        '<section class="profile__sec"><div class="sec-title">Liên hệ</div><div class="contact"><button class="contact__row" data-copy="' + U.escapeHtml(s.email) + '">' + UI.icon('mail', 16) + '<span>' + U.escapeHtml(s.email) + '</span><small>Sao chép</small></button><button class="contact__row" data-copy="' + U.escapeHtml(s.phone) + '">' + UI.icon('phone', 16) + '<span>' + U.escapeHtml(s.phone) + '</span><small>Sao chép</small></button></div></section>' +
        '<section class="profile__sec"><div class="sec-title">Tải công việc tuần này <span class="muted">· ' + U.fmtNumber(wl.shiftHours) + 'g ca · ' + U.fmtNumber(wl.eventHours) + 'g sự kiện</span></div><div class="workload" data-level="' + wl.level + '"><div class="workload__bar"><span style="width:' + Math.min(100, wl.percent) + '%"></span></div><b class="tnum">' + wl.percent + '%</b></div></section>' +
        '<section class="profile__sec"><div class="sec-title">Ca làm tuần này <span class="muted">· bấm để đổi</span></div><div class="week-strip">' + days.map(function (d) { var iso = U.toISO(d); return '<button type="button" class="week-strip__day' + (iso === todayISO ? ' is-today' : '') + '" data-iso="' + iso + '"><small>' + U.weekdayShort(d) + '</small><b class="tnum">' + d.getDate() + '</b>' + UI.shiftBadge(st.shiftOf(s.id, iso)) + '</button>'; }).join('') + '</div></section>' +
        '<section class="profile__sec"><div class="sec-title">Sắp tới</div>' + (upcoming.length ? '<div class="stack-sm">' + upcoming.map(function (e) { return '<div class="upcoming-row"><span class="upcoming-row__date"><b class="tnum">' + U.fromISO(e.date).getDate() + '</b><small>' + U.weekdayShort(U.fromISO(e.date)) + '</small></span>' + UI.eventPill(e, { compact: false }) + '</div>'; }).join('') + '</div>' : UI.empty({ icon: 'coffee', title: 'Lịch trống', body: 'Không có sự kiện nào sắp tới.' })) + '</section>' +
        (projects.length ? '<section class="profile__sec"><div class="sec-title">Dự án đang tham gia</div><div class="mini-projects">' + projects.map(function (p) { return '<a class="mini-project" href="#/projects/' + p.id + '" style="--ev:' + p.color + '"><span class="mini-project__dot"></span><span class="mini-project__txt"><b>' + U.escapeHtml(p.client) + '</b><small>' + U.escapeHtml(p.name) + '</small></span><span class="tnum muted">' + p.progress + '%</span></a>'; }).join('') + '</div></section>' : '') +
        '<section class="profile__sec"><div class="sec-title">Kỹ năng</div><div class="chips">' + s.skills.map(function (k) { return UI.chip(k); }).join('') + '</div></section>' +
        '</div>';
      if (focusKey) { var fn = drawer.body.querySelector(focusKey); if (fn) fn.focus({ preventScroll: true }); }
    }
    render();
    drawer.body.addEventListener('keydown', function (e) {
      var pill = e.target.closest && e.target.closest('.ev-pill');
      if (pill && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); drawer.close(); setTimeout(function () { E.eventDetail(pill.dataset.event); }, 120); }
    });
    drawer.body.addEventListener('click', function (e) {
      var t;
      if (e.target.closest('.profile__close')) return drawer.close();
      if ((t = e.target.closest('.status-opt'))) { st.setStaffStatus(s.id, t.dataset.status); UI.toast('Trạng thái của ' + U.shortName(s.name) + ': ' + UI.statusLabel(t.dataset.status), { kind: 'success' }); return; }
      if ((t = e.target.closest('[data-copy]'))) { U.copyToClipboard(t.dataset.copy); UI.toast('Đã sao chép ' + t.dataset.copy, { kind: 'info' }); return; }
      if ((t = e.target.closest('.week-strip__day'))) { E.shiftPicker(t, s.id, t.dataset.iso, { placement: 'bottom-center', onPick: function (type, ctx) { setTimeout(function () { var b = drawer.body.querySelector('.week-strip__day[data-iso="' + ctx.date + '"]'); (b || drawer.el).focus({ preventScroll: true }); }, 0); } }); return; }
      if ((t = e.target.closest('[data-act]'))) {
        var act = t.dataset.act;
        if (act === 'meet') { drawer.close(); setTimeout(function () { E.event(null, { attendeeIds: U.uniq([st.state.currentUserId, s.id]), title: 'Họp với ' + U.shortName(s.name) }); }, 120); }
        if (act === 'request') { drawer.close(); setTimeout(function () { E.request({ staffId: s.id }); }, 120); }
        if (act === 'calendar') { drawer.close(); location.hash = '#/calendar?staff=' + s.id; }
        return;
      }
      if ((t = e.target.closest('.ev-pill'))) { drawer.close(); setTimeout(function () { E.eventDetail(t.dataset.event); }, 120); return; }
      if ((t = e.target.closest('.mini-project'))) { drawer.close(); }
    });
    unsub = st.subscribe(function (state, meta) { if (meta.type && /staff|shift|event|request|reset/.test(meta.type)) render(); });
    return drawer;
  };

  /* -------------------------------------------------------------- project */
  E.project = function (p) {
    var isNew = !p, st = S().state;
    var data = Object.assign({ name: '', client: '', color: PROJECT_COLORS[0], status: 'planning', progress: 0, start: U.todayISO(), end: U.toISO(U.addDays(U.today(), 30)), leadId: st.currentUserId, memberIds: [st.currentUserId], tags: [], budget: '' }, p || {});
    var id = U.uid('p');
    var content = U.el('form', { class: 'form', novalidate: true });
    content.innerHTML =
      '<div class="form__row">' + field('Khách hàng', '<input class="input" id="' + id + '-client" type="text" placeholder="VD: Vinamilk" value="' + U.escapeHtml(data.client) + '" autofocus>', { id: id + '-client', required: true }) + field('Tên chiến dịch', '<input class="input" id="' + id + '-name" type="text" placeholder="VD: Tết Đoàn Viên 2027" value="' + U.escapeHtml(data.name) + '">', { id: id + '-name', required: true }) + '</div>' +
      field('Màu nhận diện', '<div class="swatches" role="radiogroup" aria-label="Màu nhận diện">' + PROJECT_COLORS.map(function (c, i) { return '<button type="button" class="swatch' + (c === data.color ? ' is-on' : '') + '" data-color="' + c + '" style="--c:' + c + '" role="radio" aria-checked="' + (c === data.color) + '" aria-label="' + COLOR_NAMES[i] + '"></button>'; }).join('') + '</div>') +
      '<div class="form__row form__row--3">' + field('Trạng thái', selectHtml(id + '-status', PROJECT_STATUS.map(function (x) { return { value: x.id, label: x.label }; }), data.status)) + field('Bắt đầu', '<input class="input" id="' + id + '-start" type="date" value="' + data.start + '">') + field('Kết thúc', '<input class="input" id="' + id + '-end" type="date" value="' + data.end + '">') + '</div>' +
      field('Tiến độ', '<input class="range" id="' + id + '-progress" type="range" min="0" max="100" step="1" value="' + data.progress + '" aria-valuetext="' + data.progress + '%">', { id: id + '-progress' }) +
      '<div class="form__row">' + field('Phụ trách (lead)', selectHtml(id + '-lead', staffOptions(), data.leadId)) + field('Ngân sách', '<input class="input" id="' + id + '-budget" type="text" placeholder="VD: 2,5 tỷ" value="' + U.escapeHtml(data.budget || '') + '">') + '</div>' +
      field('Tags', '<input class="input" id="' + id + '-tags" type="text" placeholder="TVC, Digital, OOH (phân cách bằng dấu phẩy)" value="' + U.escapeHtml((data.tags || []).join(', ')) + '">') +
      '<div class="field"><span class="label">Thành viên</span><div class="staff-picker-slot"></div></div>' +
      '<div class="form__error" role="alert" hidden></div>';
    content.querySelector('label[for="' + id + '-progress"]').insertAdjacentHTML('beforeend', '<output class="tnum" for="' + id + '-progress">' + data.progress + '%</output>');
    var picker = E.staffPicker(data.memberIds); content.querySelector('.staff-picker-slot').appendChild(picker);
    var sw = content.querySelector('.swatches');
    sw.addEventListener('click', function (e) { var b = e.target.closest('.swatch'); if (!b) return; U.qsa('.swatch', sw).forEach(function (x) { x.classList.remove('is-on'); x.setAttribute('aria-checked', 'false'); }); b.classList.add('is-on'); b.setAttribute('aria-checked', 'true'); data.color = b.dataset.color; });
    content.querySelector('#' + id + '-progress').addEventListener('input', function (e) { var o = content.querySelector('output'); if (o) o.textContent = e.target.value + '%'; e.target.setAttribute('aria-valuetext', e.target.value + '%'); });
    function showError(msg) { var er = content.querySelector('.form__error'); er.textContent = msg; er.hidden = false; }
    var modal = UI.modal({
      title: isNew ? 'Tạo dự án mới' : 'Chỉnh sửa dự án', size: 'lg', content: content,
      actions: [{ label: 'Huỷ', kind: 'ghost' }, { label: isNew ? 'Tạo dự án' : 'Lưu thay đổi', kind: 'primary', icon: 'check', keep: true, onClick: function (close) {
        var v = {
          client: content.querySelector('#' + id + '-client').value.trim(), name: content.querySelector('#' + id + '-name').value.trim(), color: data.color,
          status: content.querySelector('#' + id + '-status').value, start: content.querySelector('#' + id + '-start').value, end: content.querySelector('#' + id + '-end').value,
          progress: +content.querySelector('#' + id + '-progress').value, leadId: content.querySelector('#' + id + '-lead').value, budget: content.querySelector('#' + id + '-budget').value.trim(),
          tags: content.querySelector('#' + id + '-tags').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean), memberIds: U.uniq([content.querySelector('#' + id + '-lead').value].concat(picker.value))
        };
        if (!v.client || !v.name) return showError('Nhập tên khách hàng và tên chiến dịch.');
        if (!v.start || !v.end) return showError('Vui lòng chọn ngày bắt đầu và kết thúc.');
        if (v.end < v.start) return showError('Ngày kết thúc phải sau ngày bắt đầu.');
        if (v.status === 'done') v.progress = 100;
        var saved = isNew ? S().addProject(v) : S().updateProject(p.id, v) || S().project(p.id);
        close(); UI.toast(isNew ? 'Đã tạo dự án ' + v.client : 'Đã lưu dự án', { kind: 'success', action: isNew ? { label: 'Mở', onClick: function () { location.hash = '#/projects/' + (saved ? saved.id : ''); } } : undefined });
      } }]
    });
    content.addEventListener('submit', function (e) { e.preventDefault(); modal.el.querySelector('.modal__foot .btn--primary').click(); });
    return modal;
  };


  /* -------------------------------------------------- RSVP nhanh & hover */
  /** Thanh RSVP dùng lại được ở mọi view (click được nhờ E.bindRsvp trên #view). */
  E.rsvpBar = function (ev, staffId) {
    staffId = staffId || S().state.currentUserId; var cur = S().rsvpOf(ev, staffId);
    return '<div class="rsvp-bar" data-rsvp-bar="' + ev.id + '"><b>Bạn có tham dự?</b>' + [['yes', 'Tham dự', 'check'], ['maybe', 'Có thể', 'circle-dot'], ['no', 'Vắng', 'x']].map(function (o) { return '<button type="button" class="btn btn--sm ' + (cur === o[0] ? 'btn--primary is-on' : 'btn--secondary') + '" data-rsvp="' + o[0] + '" data-event="' + ev.id + '">' + UI.icon(o[2], 14) + o[1] + '</button>'; }).join('') + '</div>';
  };
  E.bindRsvp = function (root) {
    return U.delegate(root, 'click', '[data-rsvp][data-event]', function (e, el) {
      e.preventDefault(); e.stopPropagation();
      var st = S(); st.setRsvp(el.dataset.event, st.state.currentUserId, el.dataset.rsvp);
      UI.toast({ yes: 'Đã xác nhận tham dự', maybe: 'Đã đánh dấu: có thể tham dự', no: 'Đã báo vắng' }[el.dataset.rsvp], { kind: 'success' });
    });
  };
  /** Thẻ xem nhanh khi rê chuột lên .ev-pill (mọi view). */
  E.installHoverCards = function () {
    var card, timer, current;
    function hide() { clearTimeout(timer); if (card) card.classList.remove('is-open'); current = null; }
    function show(pill) {
      var st = S(), ev = st.event(pill.dataset.event); if (!ev || !pill.isConnected) return;
      var me = st.state.currentUserId, canSee = st.canSee(ev, me), people = ev.attendeeIds.map(st.staff).filter(Boolean), rs = st.rsvpSummary(ev), ps = st.prepStatus(ev), cal = st.calendarOf(ev), prio = st.priority(ev.priority || 2), type = st.eventType(ev.type);
      if (!card) { card = U.el('div', { class: 'ev-hover', role: 'tooltip' }); document.body.appendChild(card); }
      card.innerHTML = '<div class="row" style="gap:6px;flex-wrap:wrap">' + UI.chip(type.label, { icon: type.icon, cls: 'chip--type chip--xs' }) + (canSee ? '<span class="prio" data-p="' + prio.id + '">' + prio.short + '</span><span class="cal-chip"><i style="--c:' + cal.color + '"></i>' + U.escapeHtml(cal.name) + '</span>' : '') + '</div>' +
        '<div class="ev-hover__title">' + U.escapeHtml(st.displayTitle(ev, me)) + '</div>' +
        '<div class="ev-hover__row">' + UI.icon('clock', 13) + U.escapeHtml(U.fmtDate(ev.date, 'shortWeekday') + ' · ' + (ev.allDay ? 'Cả ngày' : U.fmtTimeRange(ev.start, ev.end))) + (ev.travelMinutes && canSee ? ' · di chuyển ~' + ev.travelMinutes + "'" : '') + '</div>' +
        (canSee && ev.location ? '<div class="ev-hover__row">' + UI.icon('map-pin', 13) + U.escapeHtml(ev.location) + '</div>' : '') +
        (canSee && people.length > 1 ? '<div class="ev-hover__people">' + UI.avatarStack(people, { max: 5, size: 'xs' }) + '<span class="rsvp-summary"><span><i class="rsvp-dot" data-rsvp="yes"></i>' + rs.yes + '</span><span><i class="rsvp-dot" data-rsvp="pending"></i>' + rs.pending + '</span></span></div>' : '') +
        (canSee && ps.total ? '<div class="ev-hover__row">' + UI.icon('check-square', 13) + 'Chuẩn bị ' + ps.done + '/' + ps.total + (ps.open && ps.overdue ? ' · <span style="color:var(--warn)">sắp diễn ra</span>' : '') + '</div>' : '') +
        (canSee && ev.notes ? '<div class="ev-hover__row" style="align-items:flex-start">' + UI.icon('message', 13) + '<span class="clamp-2">' + U.escapeHtml(ev.notes) + '</span></div>' : '');
      var r = pill.getBoundingClientRect(), w = 300, h = card.offsetHeight || 140;
      var left = U.clamp(r.right + 10, 8, window.innerWidth - w - 8), top = U.clamp(r.top, 8, window.innerHeight - h - 8);
      if (r.right + 10 + w > window.innerWidth - 8) left = Math.max(8, r.left - w - 10);
      card.style.left = left + 'px'; card.style.top = top + 'px'; card.classList.add('is-open'); current = pill;
    }
    document.addEventListener('mouseover', function (e) {
      var p = e.target.closest && e.target.closest('.ev-pill[data-event]');
      if (!p || p === current || p.classList.contains('is-dragging')) return;
      clearTimeout(timer); timer = setTimeout(function () { show(p); }, 450);
    });
    document.addEventListener('mouseout', function (e) { var p = e.target.closest && e.target.closest('.ev-pill[data-event]'); if (p && (!e.relatedTarget || !p.contains(e.relatedTarget))) hide(); });
    document.addEventListener('mousedown', hide, true); document.addEventListener('keydown', hide, true); window.addEventListener('scroll', hide, true);
  };

  /* -------------------------------------------------------- shortcuts help */
  E.shortcutsHelp = function () {
    var groups = U.groupBy(UI.shortcuts.list(), 'group');
    var html = '<div class="shortcuts">' + Object.keys(groups).map(function (g) { return '<div class="shortcuts__group"><div class="sec-title">' + U.escapeHtml(g) + '</div>' + groups[g].map(function (s) { return '<div class="shortcuts__row"><span>' + U.escapeHtml(s.desc || s.combo) + '</span><span>' + UI.kbd(s.combo.replace('mod', navigator.platform.indexOf('Mac') >= 0 ? '⌘' : 'Ctrl').replace('+', ' ')) + '</span></div>'; }).join('') + '</div>'; }).join('') + '</div>';
    return UI.modal({ title: 'Phím tắt', subtitle: 'Làm việc nhanh hơn mà không cần rời bàn phím.', size: 'md', content: html, actions: [{ label: 'Đã hiểu', kind: 'primary' }] });
  };
})(window);
