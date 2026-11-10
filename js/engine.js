/* 生态瓶模拟器 - 简化生态动力学引擎
 * 状态量：溶解氧 O2、二氧化碳 CO2、营养盐 N、有机废物 D（mg/L）
 * 生物量：藻类/水草/分解菌（生物量指数）、消费者（螺/虾/鱼，按只数）
 *
 * 主要过程：光合作用产氧耗碳、呼吸耗氧产碳、分解菌耗氧分解有机物、
 * 消费者摄食与耗氧、水面气体交换（受密封程度影响）、生物死亡与应激。
 */
(function (root) {
  'use strict';

  const CFG = root.EcoConfig;
  const ORGANISMS = CFG.ORGANISMS;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function satO2(temp) {
    // 简化饱和溶解氧曲线：25℃ 约 8.3 mg/L，10℃ 约 11.3 mg/L
    return clamp(14.6 - 0.25 * temp, 5.5, 13);
  }

  function tempFactor(temp) {
    // Q10 近似：温度越高代谢越快
    return clamp(Math.exp(0.065 * (temp - 25)), 0.15, 2.6);
  }

  /** 当前瞬时光照（0~1.5），昼夜循环下按正弦日出日落 */
  function currentLight(state) {
    const s = state.settings;
    if (s.light <= 0) return 0;
    if (!s.dayNight) return s.light;
    const phase = state.t - Math.floor(state.t); // 0~1 天
    const sunrise = 0.27;
    const dayLength = clamp(s.photoperiod / 24, 0, 1);
    if (dayLength <= 0) return 0;
    const x = (phase - sunrise) / dayLength;
    if (x <= 0 || x >= 1) return 0;
    return s.light * Math.sin(Math.PI * x);
  }

  function createState(settings) {
    const s = Object.assign({}, CFG.DEFAULTS, settings);
    const sat = satO2(s.temperature);
    const state = {
      t: 0,
      day: 1,
      settings: s,
      water: {
        o2: sat * 0.92,
        co2: 6,
        n: 1.0 + s.substrate * 2.0,
        detritus: 0.4,
        ph: 8.0
      },
      bio: {
        algae: Math.max(0, s.algae),
        plant: Math.max(0, s.plants * 37.5 / s.volume) // 每株水草约 37.5 生物量·L
      },
      consumers: {
        snail: { count: s.snails, stress: 0 },
        shrimp: { count: s.shrimp, stress: 0 },
        fish: { count: s.fish, stress: 0 }
      },
      history: [],
      events: [],
      balance: { active: true, days: 0, cause: null },
      stopped: false,
      sampleTimer: 0,
      warnCooldown: {},
      lightNow: 0,
      satO2: sat,
      seeded: { snail: s.snails, shrimp: s.shrimp, fish: s.fish }
    };
    state.bio.bacteria = s.decomposer ? 1 : 0;
    pushEvent(state, 'info', '已按当前配置生成生态瓶。');
    sample(state, true);
    return state;
  }

  function pushEvent(state, level, msg) {
    state.events.push({ t: state.t, level, msg });
    if (state.events.length > 200) state.events.shift();
  }

  function warn(state, key, level, msg, cooldownDays) {
    const last = state.warnCooldown[key];
    if (last !== undefined && state.t - last < cooldownDays) return;
    state.warnCooldown[key] = state.t;
    pushEvent(state, level, msg);
  }

  function sample(state, force) {
    const w = state.water, b = state.bio;
    state.history.push({
      t: state.t,
      o2: w.o2,
      co2: w.co2,
      n: w.n,
      detritus: w.detritus,
      algae: b.algae,
      plant: b.plant,
      bacteria: b.bacteria,
      consumers:
        state.consumers.snail.count +
        state.consumers.shrimp.count +
        state.consumers.fish.count
    });
    if (state.history.length > 1600) state.history.shift();
  }

  /** 把面板上的新设置实时应用（作为“调整/投放”） */
  function applySettings(state, settings) {
    const prev = state.settings;
    const next = Object.assign({}, prev, settings);
    state.settings = next;

    // 水草：按株数变化增减生物量
    if (next.plants !== prev.plants) {
      const per = 37.5 / next.volume; // 每株约 37.5 生物量·L 的密度
      state.bio.plant = Math.max(0, state.bio.plant + (next.plants - prev.plants) * per);
    }
    // 藻类：直接设定初始指数，投放/移除
    if (next.algae !== prev.algae) {
      state.bio.algae = Math.max(0, state.bio.algae + (next.algae - prev.algae));
    }
    // 分解菌
    if (next.decomposer !== prev.decomposer) {
      state.bio.bacteria = next.decomposer ? Math.max(state.bio.bacteria, 1) : 0;
    }
    // 动物：增减只数
    ['snail', 'shrimp', 'fish'].forEach((key) => {
      const field = key === 'snail' ? 'snails' : key;
      if (next[field] !== prev[field]) {
        const delta = next[field] - prev[field];
        const c = state.consumers[key];
        c.count = Math.max(0, c.count + delta);
        if (delta > 0) {
          state.seeded[key] = Math.max(state.seeded[key], c.count);
          pushEvent(state, 'info', `投放了 ${delta} 只${ORGANISMS[key].name}。`);
        } else {
          // 主动取出不视为生态失衡
          state.seeded[key] = Math.min(state.seeded[key], c.count);
          pushEvent(state, 'info', `取出了 ${-delta} 只${ORGANISMS[key].name}。`);
        }
      }
    });
  }

  function step(state, dtDays) {
    if (state.stopped) return 'stopped';
    const s = state.settings;
    const w = state.water;
    const b = state.bio;
    const vol = Math.max(0.5, s.volume);
    const Tf = tempFactor(s.temperature);
    const L = currentLight(state);
    state.lightNow = L;

    let o2 = w.o2, co2 = w.co2, n = w.n, d = w.detritus;
    let A = b.algae, P = b.plant, B = b.bacteria;

    const Nlim = n / (n + 0.4);
    const Clim = co2 / (co2 + 0.3);
    const Lf = Math.max(0, L);

    /* ---------- 生产者：光合作用 ---------- */
    const growthA = 0.55 * A * Math.max(0, 1 - A / 55) * Lf * Nlim * Clim * Tf;
    const growthP = 0.45 * P * Math.max(0, 1 - P / 100) * Lf * Nlim * Clim * Tf;
    A += growthA * dtDays;
    P += growthP * dtDays;
    o2 += 1.5 * (growthA + growthP) * dtDays;
    co2 -= 1.9 * (growthA + growthP) * dtDays;
    n -= 0.02 * (growthA + growthP) * dtDays;

    /* ---------- 生产者：呼吸与凋亡 ---------- */
    const deadA = 0.05 * A * Tf;
    const deadP = 0.015 * P * Tf;
    A -= deadA * dtDays;
    P -= deadP * dtDays;
    d += (deadA + deadP) * dtDays;

    const respA = 0.02 * A * Tf;
    const respP = 0.016 * P * Tf;
    o2 -= (respA + respP) * dtDays;
    co2 += 1.3 * (respA + respP) * dtDays;

    /* ---------- 消费者：摄食、耗氧、应激 ---------- */
    let consumerO2 = 0;
    const order = ['fish', 'shrimp', 'snail'];
    order.forEach((key) => {
      const spec = ORGANISMS[key];
      const c = state.consumers[key];
      if (c.count <= 0) { c.stress = 0; return; }

      const count = c.count;
      consumerO2 += count * spec.o2PerDay / vol;

      // 摄食需求（换算成浓度，按本步时长）
      const want = count * spec.food / vol * dtDays;
      let got = 0;
      Object.keys(spec.diet).forEach((foodKey) => {
        const share = spec.diet[foodKey];
        const need = want * share;
        if (need <= 0) return;
        if (foodKey === 'algae') {
          const take = Math.min(A, need);
          A -= take; got += take;
        } else if (foodKey === 'plant') {
          const take = Math.min(P, need);
          P -= take; got += take;
        } else if (foodKey === 'detritus') {
          const take = Math.min(d, need);
          d -= take; got += take;
        }
      });
      const fed = got / Math.max(want, 1e-6);

      // 废物
      d += count * spec.waste / vol * dtDays;

      // 应激累积
      let rate = 0;
      if (o2 < spec.o2Min) rate += 1.2 + 2 * (spec.o2Min - o2) / Math.max(spec.o2Min, 0.1);
      if (s.temperature < spec.tMin) rate += 1.1 * (spec.tMin - s.temperature) / 5;
      if (s.temperature > spec.tMax) rate += 1.1 * (s.temperature - spec.tMax) / 5;
      if (d > 55) rate += 0.5 + 0.4 * (d - 55) / 20;
      if (fed < 0.5) rate += 0.9;

      if (rate > 0) c.stress += rate * dtDays;
      else c.stress = Math.max(0, c.stress - 0.35 * dtDays);

      if (c.stress >= 1) {
        c.count -= 1;
        c.stress = 0.25;
        d += spec.biomass / vol;
        pushEvent(state, 'critical', `1 只${spec.name}死亡（${o2 < spec.o2Min ? '缺氧' : d > 55 ? '水质恶化' : fed < 0.5 ? '缺乏食物' : '温度不适'}）。`);
      }
    });
    o2 -= consumerO2 * dtDays;
    co2 += consumerO2 * 1.25 * dtDays;

    /* ---------- 分解菌：分解有机物 ---------- */
    if (B > 0 && s.decomposer) {
      const O2lim = o2 / (o2 + 1);
      const dLim = d / (d + 2);
      const growthB = 0.75 * B * dLim * Tf * O2lim * Math.max(0, 1 - B / 25);
      B += growthB * dtDays;
      const flux = 0.5 * B * dLim * Tf * O2lim;
      d -= flux * dtDays;
      o2 -= 0.8 * flux * dtDays;
      co2 += 0.9 * flux * dtDays;
      n += 0.06 * flux * dtDays;
    } else {
      B = 0;
    }

    /* ---------- 底泥缓慢释放营养盐 ---------- */
    n += 0.03 * s.substrate * dtDays;
    // 部分氮被沉积物固定/反硝化，避免营养盐无限累积
    n -= 0.03 * n * dtDays;

    /* ---------- 水面气体交换（密封越紧交换越弱） ---------- */
    const kO2 = 0.08 + 0.8 * (1 - s.sealing);
    o2 += kO2 * (satO2(s.temperature) - o2) * dtDays;
    const kCO2 = 0.12 + 0.7 * (1 - s.sealing);
    co2 += kCO2 * (0.6 - co2) * dtDays;

    // 碳酸盐缓冲：水体中的碳酸氢盐会缓慢补充被光合作用消耗的 CO2
    co2 += 1.0 * Math.max(0, 4 - co2) * dtDays;

    /* ---------- 限幅 ---------- */
    o2 = clamp(o2, 0, 30);
    co2 = clamp(co2, 0.05, 60);
    n = clamp(n, 0, 25);
    d = clamp(d, 0, 250);
    A = clamp(A, 0, 100);
    P = clamp(P, 0, 120);
    B = clamp(B, 0, 40);

    // 写回状态
    w.o2 = o2; w.co2 = co2; w.n = n; w.detritus = d;
    w.ph = clamp(8.15 - 0.45 * Math.log10(Math.max(co2, 0.2)), 6.2, 9);
    b.algae = A; b.plant = P; b.bacteria = B;
    state.satO2 = satO2(s.temperature);
    state.t += dtDays;
    state.day = Math.floor(state.t) + 1;

    /* ---------- 采样与判定 ---------- */
    state.sampleTimer += dtDays;
    if (state.sampleTimer >= 0.2) {
      state.sampleTimer = 0;
      sample(state);
    }

    if (state.balance.active) {
      let cause = null;
      const deadSpecies = ['snail', 'shrimp', 'fish'].find(
        (key) => state.seeded[key] > 0 && state.consumers[key].count === 0
      );
      if (o2 < 1.5) cause = '溶解氧耗尽';
      else if (d > 75) cause = '有机废物腐败';
      else if (A > 40) cause = '藻类爆发';
      else if (A + P < 0.5 && state.t > 2) cause = '生产者全部消亡';
      else if (deadSpecies) cause = `${ORGANISMS[deadSpecies].name}全部死亡`;

      if (cause) {
        state.balance.active = false;
        state.balance.days = state.t;
        state.balance.cause = cause;
        state.stopped = true;
        sample(state, true);
        pushEvent(state, 'critical', `生态失衡：${cause}（维持 ${state.t.toFixed(1)} 天）。`);
        return 'collapsed';
      }

      // 预警（不终止）
      if (o2 < 3) warn(state, 'o2low', 'warn', '溶解氧偏低，动物呼吸开始受限。', 1.2);
      if (o2 > 18) warn(state, 'o2high', 'warn', '溶解氧过饱和，可能出现气泡病。', 2);
      if (co2 > 18) warn(state, 'co2high', 'warn', '二氧化碳偏高，水体趋于酸化。', 2);
      if (d > 45) warn(state, 'dhig', 'warn', '有机废物开始积累，分解菌耗氧加重。', 2);
      if (A > 28) warn(state, 'abloom', 'warn', '藻类快速繁殖，水质正在变绿。', 3);
      if (s.temperature > 30) warn(state, 'thot', 'warn', '水温偏高，溶解氧容量下降。', 3);
      if (s.temperature < 15) warn(state, 'tcold', 'warn', '水温偏低，生物代谢明显变慢。', 3);
      if (!s.decomposer) warn(state, 'nodecomp', 'warn', '没有分解菌，有机废物将持续堆积。', 5);
    }

    return 'running';
  }

  root.EcoEngine = {
    createState,
    applySettings,
    step,
    currentLight,
    satO2,
    tempFactor
  };
})(typeof window !== 'undefined' ? window : globalThis);
