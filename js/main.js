/* 生态瓶模拟器 - 入口与主循环 */
(function (root) {
  'use strict';

  root.EcoApp.init();

  let last = null;
  function loop(now) {
    if (last === null) last = now;
    const dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    root.EcoApp.frame(dt);
    root.requestAnimationFrame(loop);
  }
  root.requestAnimationFrame(loop);
})(window);
