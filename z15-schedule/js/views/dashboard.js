/* placeholder — sẽ được thay bằng view thật */
(function (global) {
  'use strict';
  var Z15 = global.Z15; Z15.views = Z15.views || {};
  Z15.views.dashboard = {
    title: 'Hôm nay',
    render: function (container, route) {
      Z15.app.setTitle('Hôm nay', 'Đang xây dựng');
      container.innerHTML = '<div class="card reveal"><div class="card__title">Hôm nay</div><p class="muted">View giữ chỗ.</p></div>';
    }
  };
})(window);
