// modules/forms.js - Формы для ENV Control Panel
// ОТДЕЛЬНЫЙ ФАЙЛ ДЛЯ ФОРМ

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const GROUPS = {
  '🌊 Flow': {
    presets: [
      { name: 'Все flow', value: 'wasm:flow:*' },
      { name: 'Flow шаги', value: 'wasm:flow:step:*' },
      { name: 'Flow чекпоинты', value: 'wasm:flow:checkpoint:*' },
      { name: 'Flow ветки', value: 'wasm:flow:branch:*' },
    ],
  },
  '🧠 Memory': {
    presets: [
      { name: 'Все память', value: 'wasm:memory:*' },
      { name: 'Чтение памяти', value: 'wasm:memory:read:*' },
      { name: 'Запись памяти', value: 'wasm:memory:write:*' },
    ],
  },
  '⚡ Generate': {
    presets: [
      { name: 'Все генерация', value: 'wasm:generate:*' },
      { name: 'JSON генерация', value: 'wasm:generate:json:*' },
      { name: 'C генерация', value: 'wasm:generate:c:*' },
      { name: 'ENV генерация', value: 'wasm:generate:env:*' },
    ],
  },
  '🔧 API': {
    presets: [
      { name: 'Все API', value: 'wasm:api:*' },
      { name: 'API вызовы', value: 'wasm:api:call:*' },
      { name: 'API ошибки', value: 'wasm:api:error:*' },
    ],
  },
  '🚨 Errors': {
    presets: [
      { name: 'Все ошибки', value: 'wasm:error:*' },
      { name: 'Критические', value: 'wasm:error:critical:*' },
    ],
  },
  '📊 All': {
    presets: [
      { name: 'ВСЕ ЛОГИ', value: 'wasm:*' },
      { name: 'Все кроме памяти', value: '*,-wasm:memory:*' },
      { name: 'Flow+Generate+Memory', value: 'wasm:flow:*,wasm:generate:*,wasm:memory:*' },
      { name: 'Только ошибки', value: 'wasm:error:*' },
    ],
  },
  '🎯 Custom': {
    presets: [
      { name: 'Отключить всё', value: '' },
      { name: 'Только flow и generate', value: 'wasm:flow:*,wasm:generate:*' },
      { name: 'Только memory и errors', value: 'wasm:memory:*,wasm:error:*' },
      { name: 'Flow + API', value: 'wasm:flow:*,wasm:api:*' },
    ],
  },
  '📦 Bookmarklet': {
    presets: [
      { name: 'Все bookmarklet', value: 'bookmarklet:*' },
      { name: 'Только main', value: 'bookmarklet:main' },
      { name: 'Только loader', value: 'bookmarklet:loader' },
      { name: 'Только SW', value: 'bookmarklet:sw' },
      { name: 'Только панели', value: 'bookmarklet:panels' },
      { name: 'Все кроме SW', value: 'bookmarklet:*,-bookmarklet:sw' },
    ],
  },
};

const ACTION_BUTTONS = [
  { text: '📊', title: 'Показать ENV', action: 'showEnv' },
  { text: '🔊', title: 'Включить все логи', action: 'enableAll' },
  { text: '🔇', title: 'Отключить все логи', action: 'disableAll' },
  { text: '📦', title: 'Логи букмарклета', action: 'enableBookmarklet' },
  { text: '🔄', title: 'Синхронизировать', action: 'sync' },
  { text: '📤', title: 'Экспортировать', action: 'export' },
  { text: '🔄', title: 'Сбросить состояние', action: 'reset' },
  { text: '📜', title: 'История', action: 'history' },
  { text: '🧠', title: 'SharedMemory', action: 'sharedMemory' },
];

// ============================================================
// 2. ПОЛУЧЕНИЕ ENV
// ============================================================

function getEnv() {
  if (typeof window.ENV !== 'undefined') return window.ENV;
  if (typeof ENV !== 'undefined') return ENV;

  // Создаём заглушку
  return {
    debug: {
      namespace: '',
      enable: ns => {
        console.log(`🔍 DEBUG enabled: ${ns}`);
      },
      disable: () => {
        console.log('🔍 DEBUG disabled');
      },
      getConfig: () => ({
        namespace: '',
        hideDate: false,
        colors: true,
        depth: 2,
        showHidden: false,
      }),
      enabled: () => false,
      setOptions: () => {},
      getHistory: () => [],
      clearHistory: () => {},
      logStatus: () => console.log('🔍 DEBUG: off'),
      help: () => console.log('📋 DEBUG help: use enable(namespace)'),
    },
  };
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ЭКЗЕМПЛЯРА
// ============================================================

function getInstance() {
  return window.__bookmarkletInstance || window.R || null;
}

// ============================================================
// 4. ОБНОВЛЕНИЕ UI
// ============================================================

function updateGroupUI(container) {
  if (!container) return;

  const env = getEnv();
  if (!env || !env.debug) return;

  const current = env.debug.namespace || '';
  const buttons = container.querySelectorAll('button[data-preset]');

  buttons.forEach(function (b) {
    const active = b.dataset.preset === current;
    b.style.background = active ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
    b.style.color = active ? '#fff' : '#8899bb';
    b.style.borderColor = active ? '#667eea' : 'rgba(255,255,255,0.05)';
  });

  // Обновляем статус-бейдж
  const badge = document.getElementById('env-status-badge');
  if (badge) {
    const isOn = !!current && current !== 'off';
    badge.textContent = current || 'off';
    badge.style.background = isOn ? 'rgba(0,184,148,0.15)' : 'rgba(255,255,255,0.05)';
    badge.style.color = isOn ? '#00b894' : '#636e72';
    badge.style.borderColor = isOn ? 'rgba(0,184,148,0.2)' : 'rgba(255,255,255,0.05)';
  }
}

// ============================================================
// 5. ОБРАБОТЧИКИ ДЕЙСТВИЙ
// ============================================================

const actionHandlers = {
  showEnv: () => {
    const env = getEnv();
    if (env?.debug?.getConfig) {
      const config = env.debug.getConfig();
      console.log('📊 ENV Config:', config);
      alert('📊 ENV Config:\n' + JSON.stringify(config, null, 2));
    } else {
      console.log('📊 ENV Config: не доступен');
    }
  },

  enableAll: () => {
    const env = getEnv();
    if (env?.debug?.enable) {
      env.debug.enable('wasm:*');
      console.log('✅ Включены все логи: wasm:*');
      updateGroupUI(document.querySelector('#env-groups'));
    } else {
      localStorage.setItem('debug', 'wasm:*');
      console.log('✅ Сохранено в localStorage: wasm:*');
    }
  },

  disableAll: () => {
    const env = getEnv();
    if (env?.debug?.disable) {
      env.debug.disable();
      console.log('🔇 DEBUG отключен');
      updateGroupUI(document.querySelector('#env-groups'));
    } else {
      localStorage.setItem('debug', '');
      console.log('✅ Сохранено в localStorage: off');
    }
  },

  enableBookmarklet: () => {
    const env = getEnv();
    if (env?.debug?.enable) {
      env.debug.enable('bookmarklet:*');
      if (window.__bookmarklet && window.__bookmarklet.setLogLevel) {
        window.__bookmarklet.setLogLevel('DEBUG');
      }
      console.log('📦 Включены логи букмарклета: bookmarklet:*');
      updateGroupUI(document.querySelector('#env-groups'));
    } else {
      localStorage.setItem('debug', 'bookmarklet:*');
      console.log('✅ Сохранено в localStorage: bookmarklet:*');
    }
  },

  sync: () => {
    const inst = getInstance();
    if (inst && inst.sync) {
      inst.sync('merge');
      console.log('✅ Синхронизация выполнена');
    } else {
      console.log('⚠️ Метод sync не найден');
    }
  },

  export: () => {
    const inst = getInstance();
    if (inst && inst.export) {
      const json = inst.export();
      navigator.clipboard
        .writeText(json)
        .then(() => console.log('✅ Состояние скопировано в буфер обмена'))
        .catch(() => console.log('📋 Состояние:\n', json));
    } else {
      console.log('⚠️ Метод export не найден');
    }
  },

  reset: () => {
    if (confirm('Сбросить состояние к дефолтному?')) {
      const inst = getInstance();
      if (inst && inst.reset) {
        inst.reset();
        console.log('✅ Состояние сброшено');
        updateGroupUI(document.querySelector('#env-groups'));
      } else {
        console.log('⚠️ Метод reset не найден');
      }
    }
  },

  history: () => {
    const inst = getInstance();
    if (inst && inst.getHistory) {
      const history = inst.getHistory();
      console.log('📜 История изменений:', history);
      alert('📜 История изменений:\n' + JSON.stringify(history.slice(-10), null, 2));
    } else {
      console.log('⚠️ Метод getHistory не найден');
    }
  },

  sharedMemory: () => {
    const inst = getInstance();
    if (inst && inst.checkSharedMemory) {
      const status = inst.checkSharedMemory();
      console.log('🧠 SharedMemory статус:', status);
      alert('🧠 SharedMemory статус:\n' + JSON.stringify(status, null, 2));
    } else {
      console.log('⚠️ Метод checkSharedMemory не найден');
    }
  },
};

// ============================================================
// 6. ПОСТРОЕНИЕ ФОРМ
// ============================================================

function buildForms() {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
  `;

  // ============================================================
  // ГРУППЫ ПРЕСЕТОВ
  // ============================================================

  const groupsContainer = document.createElement('div');
  groupsContainer.id = 'env-groups';
  groupsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
  `;

  const env = getEnv();
  let currentVal = env?.debug?.namespace || '';

  for (const [name, group] of Object.entries(GROUPS)) {
    const g = document.createElement('div');
    g.style.cssText = `
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 8px 10px;
      background: rgba(255,255,255,0.02);
    `;

    const t = document.createElement('div');
    t.style.cssText = `
      font-size: 10px;
      font-weight: bold;
      color: #8899bb;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    `;
    t.textContent = name;
    g.appendChild(t);

    const b = document.createElement('div');
    b.style.cssText = 'display: flex; flex-wrap: wrap; gap: 3px;';

    for (const p of group.presets) {
      const active = currentVal === p.value;
      const btn = document.createElement('button');
      btn.textContent = p.name;
      btn.dataset.preset = p.value || '';
      btn.style.cssText = `
        padding: 3px 8px;
        border: 1px solid ${active ? '#667eea' : 'rgba(255,255,255,0.05)'};
        border-radius: 4px;
        background: ${active ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)'};
        color: ${active ? '#fff' : '#8899bb'};
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
        white-space: nowrap;
      `;

      btn.onmouseenter = function () {
        const a = this.dataset.preset === currentVal;
        this.style.background = a ? 'rgba(102,126,234,0.4)' : 'rgba(255,255,255,0.08)';
        this.style.transform = 'translateY(-1px)';
      };
      btn.onmouseleave = function () {
        const a = this.dataset.preset === currentVal;
        this.style.background = a ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
        this.style.transform = 'translateY(0)';
      };

      btn.onclick = function () {
        const env = getEnv();
        const v = this.dataset.preset;
        if (v && env?.debug?.enable) {
          env.debug.enable(v);
          console.log(`✅ Включен DEBUG: ${v}`);
          if (v.includes('bookmarklet') && window.__bookmarklet?.setLogLevel) {
            window.__bookmarklet.setLogLevel('DEBUG');
          }
        } else if (v) {
          console.log(`ℹ️ DEBUG не доступен, но пресет: ${v}`);
          localStorage.setItem('debug', v);
        }
        currentVal = v;
        updateGroupUI(groupsContainer);
      };
      b.appendChild(btn);
    }
    g.appendChild(b);
    groupsContainer.appendChild(g);
  }

  container.appendChild(groupsContainer);

  // ============================================================
  // БЫСТРЫЕ ДЕЙСТВИЯ  // ============================================================

  const actionsContainer = document.createElement('div');
  actionsContainer.id = 'env-actions';
  actionsContainer.style.cssText = `
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
  `;

  for (const a of ACTION_BUTTONS) {
    const btn = document.createElement('button');
    btn.textContent = a.text;
    btn.title = a.title || '';
    btn.style.cssText = `
      padding: 4px 10px;
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 4px;
      background: rgba(255,255,255,0.03);
      color: #8899bb;
      font-size: 10px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    `;
    btn.onmouseenter = function () {
      this.style.background = 'rgba(255,255,255,0.08)';
      this.style.transform = 'translateY(-1px)';
    };
    btn.onmouseleave = function () {
      this.style.background = 'rgba(255,255,255,0.03)';
      this.style.transform = 'translateY(0)';
    };
    btn.onclick = function () {
      const handler = actionHandlers[a.action];
      if (handler) {
        handler();
        // Обновляем UI после действия
        updateGroupUI(groupsContainer);
      }
    };
    actionsContainer.appendChild(btn);
  }

  container.appendChild(actionsContainer);

  // ============================================================
  // КОМАНДЫ
  // ============================================================

  const commandsContainer = document.createElement('div');
  commandsContainer.id = 'env-commands';
  commandsContainer.style.cssText = `
    margin-top: 6px;
    padding: 6px 10px;
    background: rgba(0,0,0,0.3);
    border-radius: 6px;
    font-size: 9px;
    color: #636e72;
    font-family: monospace;
    border: 1px solid rgba(255,255,255,0.03);
    flex-shrink: 0;
    line-height: 1.6;
  `;
  commandsContainer.innerHTML = `
    <div style="color:#8899bb;font-weight:bold;font-size:9px;margin-bottom:2px;">📋 Управление:</div>
    <div style="display:flex;flex-wrap:wrap;gap:2px 8px;">
      <code style="color:#667eea;">R.sync()</code>
      <code style="color:#667eea;">R.export()</code>
      <code style="color:#667eea;">R.reset()</code>
      <code style="color:#667eea;">R.getHistory()</code>
      <code style="color:#667eea;">R.getInstances()</code>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:2px;color:#445;">
      <code style="color:#fdcb6e;">env.debug.enable("wasm:*")</code>
      <code style="color:#fdcb6e;">env.debug.disable()</code>
      <code style="color:#fdcb6e;">env.debug.setOptions({ depth: 4 })</code>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:2px;color:#445;">
      <code style="color:#74b9ff;">window.__envPanel.toggle()</code>
      <code style="color:#74b9ff;">window.__envPanel.show()</code>
      <code style="color:#74b9ff;">window.__envPanel.hide()</code>
    </div>
  `;

  container.appendChild(commandsContainer);

  // ============================================================
  // ОБНОВЛЯЕМ UI
  // ============================================================

  // Задержка для обновления после рендера
  setTimeout(() => {
    updateGroupUI(groupsContainer);
  }, 50);

  return container;
}

// ============================================================
// 7. ЭКСПОРТ
// ============================================================

export default buildForms;
export { GROUPS, ACTION_BUTTONS, updateGroupUI, getEnv, getInstance };
