/* 生态瓶模拟器 - 技术制图风格剖面图 */
(function (root) {
  'use strict';

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rand = (i) => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  const INK = '#33474b';
  const INK_SOFT = '#8a9b9e';
  const RULE = '#e6ecec';
  const ACCENT = '#0b7285';
  const MONO = '9px "Cascadia Mono", Consolas, monospace';
  const MONO_SM = '8px "Cascadia Mono", Consolas, monospace';

  class Tank {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }

    fit() {
      const dpr = Math.max(1, root.devicePixelRatio || 1);
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      if (!w || !h) return null;
      if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w, h };
    }

    draw(state, running) {
      const size = this.fit();
      if (!size) return;
      const { ctx } = this;
      const { w, h } = size;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'butt';

      this.drawGrid(ctx, w, h);
      this.drawCorners(ctx, w, h);

      const jarW = Math.min(w * 0.42, h * 0.56);
      const jarH = h * 0.74;
      const left = w * 0.5 - jarW / 2;
      const top = h * 0.115;
      const bottom = top + jarH;
      const radius = 14;
      const geo = { left, top, bottom, jarW, jarH, radius };

      if (!state) {
        ctx.strokeStyle = '#c3cfd0';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        this.roundRect(ctx, left, top, jarW, jarH, radius);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = INK_SOFT;
        ctx.font = MONO;
        ctx.textAlign = 'center';
        ctx.fillText('AWAITING CONFIGURATION', w / 2, h * 0.52);
        ctx.fillText('点击「开始模拟」注水', w / 2, h * 0.52 + 16);
        this.drawCaption(ctx, w, h, '第 1 天', '00:00', 0);
        return;
      }

      const daylight = clamp(state.lightNow / 1.0, 0, 1);
      const surfaceY = top + jarH * 0.13;
      const floorY = bottom - 1;

      ctx.save();
      this.roundRect(ctx, left + 1, top + 1, jarW - 2, jarH - 2, radius);
      ctx.clip();

      // 水体
      ctx.fillStyle = '#eaf4f5';
      ctx.fillRect(left, surfaceY, jarW, jarH);
      // 水体等深细线
      ctx.strokeStyle = 'rgba(11, 114, 133, 0.055)';
      ctx.lineWidth = 1;
      for (let y = surfaceY + 8; y < floorY; y += 8) {
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + jarW, y);
        ctx.stroke();
      }

      // 藻类浑浊
      const turbidity = clamp(state.bio.algae / 70, 0, 1) * 0.35;
      if (turbidity > 0.01) {
        ctx.fillStyle = `rgba(96, 148, 104, ${turbidity * 0.45})`;
        ctx.fillRect(left, surfaceY, jarW, jarH);
      }

      // 底泥
      const substrateH = 9 + state.settings.substrate * 13;
      this.drawSubstrate(ctx, left, jarW, floorY, substrateH);
      const substrateTop = floorY - substrateH * 0.86;

      // 悬浮藻颗粒
      const algaeDots = Math.round(clamp(state.bio.algae * 2.2, 0, 90));
      for (let i = 0; i < algaeDots; i++) {
        const x = left + 8 + rand(i + 3) * (jarW - 16);
        const y = surfaceY + 6 + rand(i + 17) * (floorY - surfaceY - 12) + Math.sin(state.t + i) * 2;
        ctx.fillStyle = `rgba(63, 122, 82, ${0.18 + rand(i) * 0.22})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.7 + rand(i + 9) * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      // 水草（线稿）
      this.drawPlants(ctx, state, left, surfaceY, substrateTop, jarW, daylight);

      // 动物（线稿）
      this.drawAnimals(ctx, state, left, jarW, surfaceY, floorY, substrateTop);

      // 有机碎屑
      const particles = Math.round(clamp(state.water.detritus * 2.2, 0, 40));
      for (let i = 0; i < particles; i++) {
        const x = left + 6 + rand(i + 41) * (jarW - 12);
        const y = surfaceY + 5 + rand(i + 53) * (floorY - surfaceY - 10) + Math.sin(state.t * 0.3 + i) * 3;
        ctx.fillStyle = 'rgba(169, 132, 66, 0.45)';
        ctx.fillRect(x, y, 1.6, 1.6);
      }

      // 气泡
      if (state.lightNow > 0.05) {
        const count = Math.round(clamp(state.lightNow * 6, 0, 14));
        for (let i = 0; i < count; i++) {
          const speed = 0.05 + rand(i + 71) * 0.05;
          const progress = (state.t * speed + rand(i + 61)) % 1;
          const x = left + 10 + rand(i + 81) * (jarW - 20) + Math.sin(progress * 7 + i) * 2;
          const y = floorY - progress * (floorY - surfaceY - 4);
          ctx.strokeStyle = `rgba(11, 114, 133, ${0.32 * (1 - progress)})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + rand(i + 91) * 1.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 夜间压暗
      const night = 1 - daylight;
      if (night > 0.04) {
        ctx.fillStyle = `rgba(24, 44, 52, ${night * 0.13})`;
        ctx.fillRect(left, top, jarW, jarH);
      }

      // 水面线
      ctx.strokeStyle = 'rgba(11, 114, 133, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= jarW; x += 4) {
        const y = surfaceY + Math.sin(x * 0.05 + state.t * 1.8) * 1.2;
        if (x === 0) ctx.moveTo(left + x, y);
        else ctx.lineTo(left + x, y);
      }
      ctx.stroke();
      ctx.restore();

      // 瓶壁
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      this.roundRect(ctx, left, top, jarW, jarH, radius);
      ctx.stroke();

      ctx.strokeStyle = '#cfdbdc';
      ctx.lineWidth = 1;
      this.roundRect(ctx, left + 5, top + 5, jarW - 10, jarH - 10, radius - 3);
      ctx.stroke();

      // 瓶盖（高密封）
      if (state.settings.sealing > 0.75) {
        ctx.fillStyle = '#f2f6f6';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.2;
        this.roundRect(ctx, left + jarW * 0.34, top - 8, jarW * 0.32, 10, 2);
        ctx.fill();
        ctx.stroke();
      }

      // 深度刻度
      this.drawDepthScale(ctx, left, surfaceY, floorY, state);
      // 右上光照指示
      this.drawLightGauge(ctx, w, h, state);

      const phase = state.t - Math.floor(state.t);
      const clock = `${String(Math.floor(phase * 24)).padStart(2, '0')}:${String(Math.floor((phase * 24 % 1) * 60)).padStart(2, '0')}`;
      this.drawCaption(ctx, w, h, `第 ${Math.floor(state.t) + 1} 天`, clock, state.lightNow);
    }

    /* ---------- 背景网格 ---------- */
    drawGrid(ctx, w, h) {
      ctx.strokeStyle = 'rgba(120, 150, 152, 0.10)';
      ctx.lineWidth = 1;
      const step = 22;
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
        ctx.stroke();
      }
      for (let y = step; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
        ctx.stroke();
      }
    }

    drawCorners(ctx, w, h) {
      const L = 13;
      const m = 9;
      ctx.strokeStyle = '#b7c4c5';
      ctx.lineWidth = 1;
      const corners = [
        [m, m, 1, 1], [w - m, m, -1, 1],
        [m, h - m, 1, -1], [w - m, h - m, -1, -1]
      ];
      corners.forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + sx * L, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + sy * L);
        ctx.stroke();
      });
    }

    /* ---------- 底泥 ---------- */
    drawSubstrate(ctx, left, width, floorY, height) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left, floorY);
      ctx.lineTo(left, floorY - height * 0.72);
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const x = left + (width * i) / steps;
        ctx.lineTo(x, floorY - height * (0.55 + rand(i + 31) * 0.45));
      }
      ctx.lineTo(left + width, floorY);
      ctx.closePath();
      ctx.fillStyle = '#f2ece1';
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(150, 120, 74, 0.42)';
      ctx.lineWidth = 1;
      for (let x = -height; x < width + height; x += 5) {
        ctx.beginPath();
        ctx.moveTo(left + x, floorY);
        ctx.lineTo(left + x + height, floorY - height * 1.3);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = '#b8a488';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const x = left + (width * i) / 16;
        const y = floorY - height * (0.55 + rand(i + 31) * 0.45);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    /* ---------- 水草 ---------- */
    drawPlants(ctx, state, left, surfaceY, substrateTop, width, daylight) {
      const plants = state.settings.plants;
      if (plants <= 0 || state.bio.plant < 0.3) return;
      const visible = Math.min(plants, 8);
      const depth = Math.max(20, substrateTop - surfaceY - 10);

      for (let i = 0; i < visible; i++) {
        const x = left + width * (0.14 + (0.7 * (i + 0.5)) / visible);
        const height = depth * (0.3 + 0.45 * clamp(state.bio.plant / 90, 0, 1)) * (0.78 + rand(i + 5) * 0.42);
        const sway = Math.sin(state.t * 1.05 + i * 1.9) * (3.5 + daylight * 2);
        const baseY = substrateTop + 1;
        const tipX = x + sway;
        const tipY = baseY - height;

        ctx.strokeStyle = 'rgba(47, 107, 82, 0.85)';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, baseY);
        ctx.quadraticCurveTo(x + sway * 0.3, baseY - height * 0.55, tipX, tipY);
        ctx.stroke();

        const leaves = 3 + Math.floor(rand(i + 9) * 3);
        ctx.strokeStyle = 'rgba(63, 122, 82, 0.7)';
        ctx.lineWidth = 0.9;
        for (let j = 0; j < leaves; j++) {
          const p = (j + 1) / (leaves + 1);
          const lx = x + sway * p * p;
          const ly = baseY - height * p;
          const side = j % 2 === 0 ? -1 : 1;
          const len = 7 + rand(i * 7 + j) * 7;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(lx + side * len * 0.6, ly - len * 0.5, lx + side * len, ly - len * 0.55);
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(63, 122, 82, 0.9)';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* ---------- 动物 ---------- */
    drawAnimals(ctx, state, left, width, surfaceY, floorY, substrateTop) {
      const t = state.t;

      // 螺
      const snails = state.consumers.snail.count;
      for (let i = 0; i < snails; i++) {
        const x = left + 20 + ((i * 53 + 17) % Math.max(1, width - 40));
        const y = substrateTop + 3 + (i % 2) * 4;
        ctx.strokeStyle = '#7a6446';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0.3, Math.PI * 2.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0.6, Math.PI * 2.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 4, y + 3);
        ctx.lineTo(x + 4, y + 3);
        ctx.stroke();
      }

      // 虾
      const shrimp = state.consumers.shrimp.count;
      for (let i = 0; i < shrimp; i++) {
        const ph = t * 0.5 + i * 1.4;
        const x = left + 26 + (Math.sin(ph) * 0.5 + 0.5) * (width - 52);
        const y = floorY - 10 - (i % 3) * 5 + Math.sin(ph * 2) * 1.5;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.cos(ph) * 0.2);
        ctx.strokeStyle = '#a85b4c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0.4, Math.PI - 0.4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4.5, 0.5);
        ctx.quadraticCurveTo(-9, -1, -11, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4.5, 0.5);
        ctx.lineTo(8, 3);
        ctx.moveTo(4.5, 1);
        ctx.lineTo(8, 5);
        ctx.stroke();
        ctx.fillStyle = '#a85b4c';
        ctx.beginPath();
        ctx.arc(4, -1.2, 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 鱼
      const fish = state.consumers.fish.count;
      for (let i = 0; i < fish; i++) {
        const ph = t * 0.4 + i * 2.2;
        const dir = Math.cos(ph) >= 0 ? 1 : -1;
        const x = left + 34 + (Math.sin(ph) * 0.5 + 0.5) * (width - 68);
        const y = surfaceY + (floorY - surfaceY) * (0.34 + (i % 3) * 0.17) + Math.sin(ph * 2.2) * 3;
        const body = 9 + Math.min(state.settings.volume, 10) * 0.25;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.strokeStyle = '#a8613f';
        ctx.fillStyle = 'rgba(168, 97, 63, 0.10)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, body, body * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-body * 0.85, 0);
        ctx.lineTo(-body * 1.45, -body * 0.5);
        ctx.lineTo(-body * 1.4, body * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#a8613f';
        ctx.beginPath();
        ctx.arc(body * 0.45, -body * 0.1, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    /* ---------- 深度刻度 ---------- */
    drawDepthScale(ctx, left, surfaceY, floorY, state) {
      const x = left - 16;
      const depthCm = 20;
      ctx.strokeStyle = '#b7c4c5';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, surfaceY);
      ctx.lineTo(x, floorY);
      ctx.stroke();

      ctx.font = MONO_SM;
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = 0; i <= 4; i++) {
        const y = surfaceY + ((floorY - surfaceY) * i) / 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 5, y);
        ctx.stroke();
        ctx.fillText(String((depthCm / 4) * i), x - 4, y);
      }
      ctx.save();
      ctx.translate(left - 28, (surfaceY + floorY) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = INK_SOFT;
      ctx.font = MONO_SM;
      ctx.fillText('DEPTH cm', 0, 0);
      ctx.restore();

      // 水量标注
      ctx.font = MONO_SM;
      ctx.fillStyle = 'rgba(138, 155, 158, 0.9)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`H2O ${state.settings.volume.toFixed(1)} L`, left - 16, surfaceY - 8);
    }

    /* ---------- 光照指示 ---------- */
    drawLightGauge(ctx, w, h, state) {
      const x = w - 42;
      const y = 34;
      const day = state.lightNow > 0.05;
      ctx.strokeStyle = day ? '#b98a2e' : '#9aa9ac';
      ctx.fillStyle = day ? 'rgba(185, 138, 46, 0.12)' : 'rgba(154, 169, 172, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (day) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * 8.5, y + Math.sin(a) * 8.5);
          ctx.lineTo(x + Math.cos(a) * 11.5, y + Math.sin(a) * 11.5);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#f8fafa';
        ctx.beginPath();
        ctx.arc(x + 2.5, y - 2.5, 5.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9aa9ac';
        ctx.stroke();
      }
      ctx.font = MONO_SM;
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('LUX ' + state.lightNow.toFixed(2), x + 14, y + 15);
    }

    /* ---------- 底部标注 ---------- */
    drawCaption(ctx, w, h, dayText, clock, lux) {
      ctx.font = MONO_SM;
      ctx.fillStyle = INK_SOFT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${dayText} · ${clock}`, 24, h - 13);
      ctx.textAlign = 'right';
      ctx.fillText(`LUX ${lux.toFixed(2)}`, w - 24, h - 13);
    }

    roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }
  }

  root.EcoTank = Tank;
})(window);