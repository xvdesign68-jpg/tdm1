/* placeholder — sẽ được thay bằng view thật */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  Z15.views.requests = {
    title: 'Yêu cầu',
    render: function (container, route) {
      Z15.app.setTitle('Yêu cầu', 'Đang xây dựng');
      container.innerHTML = '<div class="card reveal"><div class="card__title">Yêu cầu</div><p class="muted">View giữ chỗ.</p></div>';
    }
  };
})(window);
