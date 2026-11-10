/* 生态瓶模拟器 - 全局配置：默认参数、预设、生物参数 */
(function (root) {
  'use strict';

  // 生物参数（单位：氧气 mg/天·只，食物与废物为相对量，按水量换算为浓度）
  const ORGANISMS = {
    snail: {
      name: '螺',
      o2PerDay: 0.28,   // 每只每天耗氧 mg
      o2Min: 1.5,       // 耐受最低溶解氧 mg/L
      tMin: 10, tMax: 32,
      food: 0.35,       // 每天摄食量（生物量指数）
      diet: { algae: 0.25, detritus: 0.75 },
      waste: 0.3,       // 每只每天产生有机废物
      biomass: 2        // 死亡后转化为有机废物的量
    },
    shrimp: {
      name: '虾',
      o2PerDay: 0.72,
      o2Min: 2.8,
      tMin: 16, tMax: 29,
      food: 0.9,
      diet: { algae: 0.55, detritus: 0.35, plant: 0.1 },
      waste: 0.8,
      biomass: 2.5
    },
    fish: {
      name: '鱼',
      o2PerDay: 7.0,
      o2Min: 3.2,
      tMin: 18, tMax: 29,
      food: 3.0,
      diet: { algae: 0.8, detritus: 0.2 },
      waste: 3.5,
      biomass: 8
    }
  };

  const DEFAULTS = {
    volume: 5,          // 水量 L
    light: 0.65,        // 光照强度 0~1.5
    photoperiod: 12,    // 每日光照时长 h
    dayNight: true,     // 是否开启昼夜循环
    temperature: 25,    // 水温 ℃
    sealing: 0.6,       // 密封程度 0~1（1 为完全密封）
    substrate: 0.6,     // 底泥 0~2
    decomposer: true,   // 是否投入分解菌
    plants: 4,          // 水草株数
    algae: 2,           // 初始藻类指数
    snails: 2,
    shrimp: 0,
    fish: 0
  };

  const PRESETS = {
    balanced: {
      label: '均衡生态瓶',
      hint: '水草 + 分解菌 + 少量螺，光照充足，可长期维持',
      settings: { ...DEFAULTS }
    },
    overstocked: {
      label: '过度投放（2 条鱼）',
      hint: '耗氧量超过产氧量，溶解氧会迅速下降',
      settings: { ...DEFAULTS, fish: 2, algae: 3, snails: 1 }
    },
    sealedDark: {
      label: '完全密封·无光',
      hint: '没有光照就没有光合作用，只能消耗存量氧气',
      settings: { ...DEFAULTS, light: 0, sealing: 1, snails: 1 }
    },
    bloom: {
      label: '富营养·藻类爆发',
      hint: '强光与厚底泥让藻类疯长，夜间反过来耗尽氧气',
      settings: {
        ...DEFAULTS, light: 1.5, photoperiod: 18, substrate: 2,
        algae: 8, plants: 1, snails: 0, shrimp: 0, fish: 0, sealing: 0.9
      }
    }
  };

  // 模拟速度：1x = 1 天/秒
  const SPEEDS = [
    { label: '1×', daysPerSecond: 1 },
    { label: '2×', daysPerSecond: 2 },
    { label: '5×', daysPerSecond: 5 },
    { label: '10×', daysPerSecond: 10 }
  ];

  root.EcoConfig = { ORGANISMS, DEFAULTS, PRESETS, SPEEDS };
})(typeof window !== 'undefined' ? window : globalThis);
