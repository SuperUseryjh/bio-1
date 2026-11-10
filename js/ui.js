/* 生态瓶模拟器 - 界面绑定与状态同步 */
(function (root) {
  'use strict';

  const CFG = root.EcoConfig;
  const Engine = root.EcoEngine;
  const Charts = root.EcoCharts;
  const el = (id) => document.getElementById(id);

  const RANGE_IDS = [
    'light', 'photoperiod', 'temperature', 'sealing', 'volume',
    'substrate', 'plants', 'algae', 'snails', 'shrimp', 'fish'
  ];

  let state = null;
  let running = false;
  let speedIndex = 1;
  let tank = null;
  let uiClock = 0;
  let lastEventRef = null;

  /* ---------- 设置读取与显示 ---------- */
  function readSettings() {
    return {
      light: parseFloat(el('light').value),
      photoperiod: parseFloat(el('photoperiod').value),
      dayNight: el('dayNight').checked,
      temperature: parseFloat(el('temperature').value),
      sealing: parseFloat(el('sealing').value),
      volume: parseFloat(el('volume').value),
      substrate: parseFloat(el('substrate').value),
      decomposer: el('decomposer').checked,
      plants: parseInt(el('plants').value, 10),
      algae: parseFloat(el('algae').value),
      snails: parseInt(el('snails').value, 10),
      shrimp: parseInt(el('shrimp').value, 10),
      fish: parseInt(el('fish').value, 10)
    };
  }

  function syncInputs(settings) {
    el('light').value = settings.light;
    el('photoperiod').value = settings.photoperiod;
    el('dayNight').checked = settings.dayNight;
    el('temperature').value = settings.temperature;
    el('sealing').value = settings.sealing;
    el('volume').value = settings.volume;
    el('substrate').value = settings.substrate;
    el('decomposer').checked = settings.decomposer;
    el('plants').value = settings.plants;
    el('algae').value = settings.algae;
    el('snails').value = settings.snails;
    el('shrimp').value = settings.shrimp;
    el('fish').value = settings.fish;
    updateOutputs();
  }

  function updateOutputs() {
    el('lightOut').textContent = parseFloat(el('light').value).toFixed(2);
    el('photoperiodOut').textContent = `${el('photoperiod').value} 小时`;
    el('temperatureOut').textContent = `${el('temperature').value} ℃`;
    el('sealingOut').textContent = `${Math.round(el('sealing').value * 100)}%`;
    el('volumeOut').textContent = `${el('volume').value} L`;
    el('substrateOut').textContent = parseFloat(el('substrate').value).toFixed(1);
    el('plantsOut').textContent = `${el('plants').value} 株`;
    el('algaeOut').textContent = parseFloat(el('algae').value).toFixed(1);
    el('snailsOut').textContent = `${el('snails').value} 只`;
    el('shrimpOut').textContent = `${el('shrimp').value} 只`;
    el('fishOut').textContent = `${el('fish').value} 只`;
  }

  /* ---------- 初始化静态控件 ---------- */
  function buildPresetOptions() {
    const select = el('preset');
    select.innerHTML = '';
    Object.keys(CFG.PRESETS).forEach((key) => {
      const preset = CFG.PRESETS[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = preset.label;
      select.appendChild(opt);
    });
  }

  function buildSpeedButtons() {
    const group = el('speedGroup');
    group.innerHTML = '';
    CFG.SPEEDS.forEach((speed, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = speed.label;
      btn.dataset.index = String(i);
      btn.addEventListener('click', () => {
        speedIndex = i;
        updateSpeedUI();
      });
      group.appendChild(btn);
    });
    updateSpeedUI();
  }

  function updateSpeedUI() {
    [...el('speedGroup').children].forEach((btn, i) => {
      btn.classList.toggle('active', i === speedIndex);
    });
  }

  function applyPreset(key) {
    const preset = CFG.PRESETS[key];
    if (!preset) return;
    syncInputs(Object.assign({}, CFG.DEFAULTS, preset.settings));
    el('presetHint').textContent = preset.hint;
    state = null;
    running = false;
    lastEventRef = null;
    createState();
    updateAll(true);
  }

  /* ---------- 状态管理 ---------- */
  function createState() {
    state = Engine.createState(readSettings());
    state.events = state.events.slice(-1); // 只保留初始提示
    lastEventRef = null;
  }

  function resetSimulation() {
    createState();
    running = false;
    updateAll(true);
  }

  function startPause() {
    if (!state) createState();
    if (state.stopped) return;
    running = !running;
    updateAll(true);
  }

  /* ---------- 实时更新 ---------- */
  function updateAll(force) {
    updateStatus();
    if (force || uiClock > 0.1) {
      uiClock = 0;
      updateMetrics();
      updateCharts();
      updateLog();
    }
  }

  function updateStatus() {
    const chip = el('statusChip');
    chip.classList.remove('running', 'paused', 'collapsed');

    let label = '未开始';
    if (state && state.stopped) {
      chip.classList.add('collapsed');
      label = '生态失衡';
    } else if (running) {
      chip.classList.add('running');
      label = '平衡中';
    } else if (state && state.t > 0) {
      chip.classList.add('paused');
      label = '已暂停';
    }
    el('statusText').textContent = label;
    el('tankBadge').textContent = label;

    const day = state ? Math.floor(state.t) + 1 : 1;
    el('dayValue').textContent = `第 ${day} 天`;
    el('maintainValue').textContent = `${(state ? state.t : 0).toFixed(1)} 天`;

    const btn = el('btnToggle');
    btn.disabled = !!(state && state.stopped);
    if (state && state.stopped) btn.textContent = '已失衡';
    else if (running) btn.textContent = '暂停模拟';
    else if (state && state.t > 0) btn.textContent = '继续模拟';
    else btn.textContent = '开始模拟';

    const banner = el('collapseBanner');
    if (state && state.stopped) {
      banner.classList.remove('hidden');
      el('collapseText').textContent =
        `平衡维持 ${state.balance.days.toFixed(1)} 天 · ${state.balance.cause}`;
    } else {
      banner.classList.add('hidden');
    }
  }

  function updateMetrics() {
    if (!state) return;
    const w = state.water;
    const b = state.bio;
    const sat = state.satO2 || 8.3;

    el('metricDo').textContent = w.o2.toFixed(1);
    el('metricCo2').textContent = w.co2.toFixed(1);
    el('metricDetritus').textContent = w.detritus.toFixed(1);
    el('metricPh').textContent = w.ph.toFixed(2);
    el('metricAlgae').textContent = b.algae.toFixed(1);
    el('metricPlant').textContent = b.plant.toFixed(0);
    el('metricBacteria').textContent = state.settings.decomposer ? b.bacteria.toFixed(1) : '未投放';

    const snails = state.consumers.snail.count;
    const shrimp = state.consumers.shrimp.count;
    const fish = state.consumers.fish.count;
    el('metricAnimals').textContent = String(snails + shrimp + fish);
    el('metricAnimalDetail').textContent = `螺 ${snails} · 虾 ${shrimp} · 鱼 ${fish}`;

    setBar('barDo', (w.o2 / Math.max(sat * 1.6, 1)) * 100, w.o2 < 2 ? 'var(--danger)' : w.o2 < 3.5 ? 'var(--warn)' : 'var(--accent)');
    setBar('barCo2', (w.co2 / 20) * 100);
    setBar('barDetritus', (w.detritus / 60) * 100);
    setBar('barPh', ((w.ph - 6) / 3) * 100);
    setBar('barAlgae', (b.algae / 55) * 100);
    setBar('barPlant', (b.plant / 100) * 100);
    setBar('barBacteria', (b.bacteria / 25) * 100);
  }

  function setBar(id, pct, color) {
    const bar = el(id);
    bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    if (color) bar.style.background = color;
  }

  function updateCharts() {
    if (!state) return;
    const history = state.history;
    const pick = (key) => history.map((h) => ({ t: h.t, v: h[key] }));

    Charts.drawLineChart(el('chart-o2'), [{ points: pick('o2'), color: '#4ad6b8', fill: true }], { fixedMax: 10 });
    Charts.drawLineChart(el('chart-co2'), [{ points: pick('co2'), color: '#6fb7ff', fill: true }], { fixedMax: 10 });
    Charts.drawLineChart(el('chart-detritus'), [{ points: pick('detritus'), color: '#f2b45c', fill: true }], { fixedMax: 10 });
    Charts.drawLineChart(el('chart-biomass'), [
      { points: pick('algae'), color: '#7fdc8a', fill: true },
      { points: pick('plant'), color: '#4ac2c8' }
    ], {});

    el('chartO2Value').textContent = `${state.water.o2.toFixed(1)} mg/L`;
    el('chartCo2Value').textContent = `${state.water.co2.toFixed(1)} mg/L`;
    el('chartDetritusValue').textContent = `${state.water.detritus.toFixed(1)} mg/L`;
    el('chartBiomassValue').textContent =
      `藻 ${state.bio.algae.toFixed(1)} · 草 ${state.bio.plant.toFixed(0)}`;
  }

  function updateLog() {
    if (!state) return;
    const latest = state.events[state.events.length - 1] || null;
    if (latest === lastEventRef) return;
    lastEventRef = latest;
    const list = el('eventLog');
    list.innerHTML = '';
    if (state.events.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = '暂无事件';
      list.appendChild(li);
      return;
    }
    state.events.forEach((event) => {
      const li = document.createElement('li');
      li.className = event.level;
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = `D${Math.max(1, Math.floor(event.t) + 1)}`;
      const text = document.createElement('span');
      text.textContent = event.msg;
      li.appendChild(time);
      li.appendChild(text);
      list.appendChild(li);
    });
    list.scrollTop = list.scrollHeight;
  }

  /* ---------- 主循环 ---------- */
  function frame(dtReal) {
    if (!state) {
      tank.draw(null, false);
      return;
    }
    if (running && !state.stopped) {
      let simDt = Math.min(dtReal, 0.12) * CFG.SPEEDS[speedIndex].daysPerSecond;
      const maxStep = 0.02;
      let guard = 0;
      while (simDt > 0 && guard < 200) {
        const step = Math.min(maxStep, simDt);
        const result = Engine.step(state, step);
        simDt -= step;
        guard += 1;
        if (result !== 'running') {
          running = false;
          break;
        }
      }
    }
    tank.draw(state, running);
    uiClock += dtReal;
    updateAll(false);
  }

  /* ---------- 事件绑定 ---------- */
  function bindControls() {
    RANGE_IDS.forEach((id) => {
      el(id).addEventListener('input', () => {
        updateOutputs();
        if (state) Engine.applySettings(state, readSettings());
        updateAll(true);
      });
    });
    ['dayNight', 'decomposer'].forEach((id) => {
      el(id).addEventListener('change', () => {
        if (state) Engine.applySettings(state, readSettings());
        updateAll(true);
      });
    });
    el('btnToggle').addEventListener('click', startPause);
    el('btnReset').addEventListener('click', resetSimulation);
    el('btnResetInline').addEventListener('click', resetSimulation);
    el('preset').addEventListener('change', (e) => {
      applyPreset(e.target.value);
    });
  }

  function init() {
    tank = new root.EcoTank(el('tank'));
    buildPresetOptions();
    buildSpeedButtons();
    bindControls();

    const firstKey = Object.keys(CFG.PRESETS)[0];
    el('preset').value = firstKey;
    applyPreset(firstKey);
    const hint = CFG.PRESETS[firstKey].hint;
    el('presetHint').textContent = hint;

    root.addEventListener('resize', () => {
      if (state) tank.draw(state, running);
    });
  }

  root.EcoApp = { init, frame, isRunning: () => running, getState: () => state };
})(window);
