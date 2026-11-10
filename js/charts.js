/* 生态瓶模拟器 - 浅色细网格曲线 */
(function (root) {
  'use strict';

  const GRID = 'rgba(120, 150, 152, 0.16)';
  const LABEL = 'rgba(124, 140, 144, 0.9)';
  const MONO = '8.5px "Cascadia Mono", Consolas, monospace';

  function fitCanvas(canvas) {
    const dpr = Math.max(1, root.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return null;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawLineChart(canvas, series, opts) {
    const fitted = fitCanvas(canvas);
    if (!fitted) return;
    const { ctx, w, h } = fitted;
    const pad = { l: 34, r: 8, t: 8, b: 15 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    if (plotW <= 0 || plotH <= 0) return;

    const all = series.flatMap((s) => s.points);
    if (all.length === 0) return;

    const xMin = all[0].t;
    const xMax = Math.max(all[all.length - 1].t, xMin + 0.5);
    const vMin = opts && opts.min !== undefined ? opts.min : 0;
    let vMax = 0;
    all.forEach((p) => { if (p.v > vMax) vMax = p.v; });
    if (opts && opts.max !== undefined) vMax = Math.max(vMax, opts.max);
    vMax = Math.max(vMax * 1.12, vMin + 1e-3);

    const xOf = (t) => pad.l + ((t - xMin) / (xMax - xMin)) * plotW;
    const yOf = (v) => pad.t + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

    // 网格
    ctx.font = MONO;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    const rows = 3;
    for (let i = 0; i <= rows; i++) {
      const y = Math.round(pad.t + (plotH * i) / rows) + 0.5;
      const value = vMax - ((vMax - vMin) * i) / rows;
      ctx.strokeStyle = GRID;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = LABEL;
      ctx.textAlign = 'right';
      ctx.fillText(formatTick(value), pad.l - 5, y);
    }

    // 时间轴
    ctx.fillStyle = LABEL;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(`${xMin.toFixed(0)}d`, pad.l, h - pad.b + 3);
    ctx.textAlign = 'right';
    ctx.fillText(`${xMax.toFixed(0)}d`, w - pad.r, h - pad.b + 3);

    // 曲线
    series.forEach((s) => {
      const pts = s.points;
      if (pts.length < 2) return;
      if (s.fill) {
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
        grad.addColorStop(0, hexToRgba(s.color, 0.16));
        grad.addColorStop(1, hexToRgba(s.color, 0.01));
        ctx.beginPath();
        ctx.moveTo(xOf(pts[0].t), pad.t + plotH);
        pts.forEach((p) => ctx.lineTo(xOf(p.t), yOf(p.v)));
        ctx.lineTo(xOf(pts[pts.length - 1].t), pad.t + plotH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = xOf(p.t);
        const y = yOf(p.v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.3;
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  }

  function formatTick(v) {
    if (v >= 100) return v.toFixed(0);
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(v > 0 && v < 1 ? 2 : 1);
  }

  function hexToRgba(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(11, 114, 133, ${alpha})`;
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
  }

  root.EcoCharts = { drawLineChart };
})(window);