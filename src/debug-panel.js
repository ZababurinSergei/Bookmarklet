// debug-panel.js - Полная панель управления DEBUG
// Использует ту же архитектуру, что и env-panel.js
// Подключается через bookmarklet.js
// ОБНОВЛЕНО: Добавлена поддержка panelType для правильного отображения названия
// ОБНОВЛЕНО: Добавлено расширенное debug-логирование
// ОБНОВЛЕНО: z-index поднимается при клике в любую часть панели

// ============================================================
// 1. DEBUG-ЛОГГЕР ДЛЯ DEBUG-PANEL
// ============================================================

const DBG_LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  panel: 'color: #764ba2; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #fdcb6e;',
  step: 'color: #fd79a8;',
};

function dbgLog(message, data = null, style = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `%c[${timestamp}] %c[debug-panel]`;
  const styles = [DBG_LOG_STYLES.info, DBG_LOG_STYLES.panel];

  if (data !== null && data !== undefined) {
    console.log(
      prefix + ' %c' + message,
      ...styles,
      DBG_LOG_STYLES[style] || DBG_LOG_STYLES.info,
      data
    );
  } else {
    console.log(prefix + ' %c' + message, ...styles, DBG_LOG_STYLES[style] || DBG_LOG_STYLES.info);
  }
}

function dbgHeader(title) {
  console.log('%c' + '═'.repeat(70), DBG_LOG_STYLES.separator);
  console.log('%c  🐛 ' + title, DBG_LOG_STYLES.header);
  console.log('%c' + '═'.repeat(70), DBG_LOG_STYLES.separator);
}

function dbgSeparator() {
  console.log('%c' + '─'.repeat(70), DBG_LOG_STYLES.separator);
}

function dbgStep(message, data = null) {
  dbgLog(`▶️ ${message}`, data, 'step');
}

function dbgSuccess(message, data = null) {
  dbgLog(`✅ ${message}`, data, 'success');
}

function dbgError(message, data = null) {
  dbgLog(`❌ ${message}`, data, 'error');
}

function dbgWarn(message, data = null) {
  dbgLog(`⚠️ ${message}`, data, 'warn');
}

// ============================================================
// 2. ПОЛУЧЕНИЕ ЛОКАЛЬНОГО ЭКЗЕМПЛЯРА
// ============================================================

function getInstance() {
  dbgStep('Получение локального экземпляра...');

  // Сначала проверяем переданный аргумент
  if (arguments[0] && typeof arguments[0] === 'object' && arguments[0].getState) {
    dbgSuccess('Локальный экземпляр получен из аргумента', {
      id: arguments[0].id,
      hasGetState: true,
    });
    return arguments[0];
  }

  // Проверяем глобальный объект
  const instance = window.__bookmarkletInstance || window.R;
  if (instance && instance.getState) {
    dbgSuccess('Локальный экземпляр получен из глобального объекта', {
      id: instance.id,
      idShort: instance.id?.slice(-8),
      hasGetState: true,
      hasRunPanel: typeof instance.runPanel === 'function',
      hasSync: typeof instance.sync === 'function',
    });
    return instance;
  }

  dbgWarn('Локальный экземпляр не найден');
  return null;
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ГЛОБАЛЬНОГО СОСТОЯНИЯ
// ============================================================

function getGlobalState() {
  dbgStep('Получение глобального состояния...');

  const instance = getInstance();
  if (instance && instance.getState) {
    const state = instance.getState();
    dbgSuccess('Глобальное состояние получено через экземпляр', {
      hasGetState: true,
      hasOn: typeof state?.on === 'function',
      hasSet: typeof state?.set === 'function',
      instances: state?.instances?.length || 0,
      currentInstance: state?.getCurrentInstance?.()?.slice(-8) || 'none',
    });
    return state;
  }

  const state = window.__globalState || window.globalState || null;
  if (state) {
    dbgSuccess('Глобальное состояние получено из глобального объекта', {
      hasState: !!state,
      instances: state?.instances?.length || 0,
    });
  } else {
    dbgWarn('Глобальное состояние не найдено');
  }
  return state;
}

// ============================================================
// 4. БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ENV
// ============================================================

function getEnv() {
  dbgStep('Получение ENV...');

  // Проверяем глобальный ENV
  if (typeof window.ENV !== 'undefined') {
    dbgSuccess('ENV получен из window.ENV');
    return window.ENV;
  }
  if (typeof ENV !== 'undefined') {
    dbgSuccess('ENV получен из глобальной переменной ENV');
    return ENV;
  }

  // Проверяем DEBUG в глобальном объекте
  if (window.DEBUG !== undefined) {
    dbgSuccess('ENV создан из window.DEBUG');
    return {
      debug: {
        enable: ns => {
          window.DEBUG = ns;
        },
        disable: () => {
          window.DEBUG = '';
        },
        namespace: window.DEBUG || '',
      },
    };
  }

  // Создаем заглушку
  dbgWarn('ENV не найден, создаем заглушку');
  return {
    debug: {
      namespace: '',
      enable: ns => {
        dbgLog(`🔍 DEBUG enabled: ${ns}`, null, 'info');
      },
      disable: () => {
        dbgLog('🔍 DEBUG disabled', null, 'info');
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
      logStatus: () => dbgLog('🔍 DEBUG: off', null, 'info'),
      help: () => dbgLog('📋 DEBUG help: use enable(namespace)', null, 'info'),
    },
  };
}

// ============================================================
// 5. КОНФИГУРАЦИЯ ГРУПП ПРЕСЕТОВ
// ============================================================

const DEBUG_GROUPS = {
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
};

// ============================================================
// 6. УПРАВЛЕНИЕ Z-INDEX
// ============================================================

let maxZIndex = 99996;

function getNextZIndex() {
  dbgStep('Получение следующего z-index...');

  const allPanels = document.querySelectorAll(
    '.widget-window, #env-control-panel, #logs-control-panel, #debug-control-panel-v2'
  );
  let maxZ = 99996;
  allPanels.forEach(panel => {
    if (panel.style.display !== 'none') {
      const z = parseInt(panel.style.zIndex) || 0;
      if (z > maxZ) maxZ = z;
    }
  });
  maxZIndex = Math.max(maxZIndex, maxZ + 1);

  dbgSuccess('Новый z-index', {
    maxZ: maxZ,
    newZ: maxZIndex,
    panelsCount: allPanels.length,
  });
  return maxZIndex;
}

function bringToFront(element) {
  dbgStep('Вывод на передний план...');

  if (!element) {
    dbgWarn('Элемент не передан');
    return;
  }

  const newZ = getNextZIndex();
  element.style.zIndex = newZ;

  document.querySelectorAll('.widget-window.active-window').forEach(el => {
    el.classList.remove('active-window');
  });
  element.classList.add('active-window');

  dbgSuccess('Элемент на переднем плане', {
    newZ: newZ,
    windowsCount: document.querySelectorAll('.widget-window').length,
  });
}

// ============================================================
// 7. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export default async function (instanceArg) {
  dbgHeader('ЗАПУСК DEBUG-PANEL');
  dbgLog('🐛 Debug Panel запускается...', null, 'info');

  // Создаём уникальный ID для этого инстанса
  const componentId = 'dbg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
  const instanceId = instanceArg?.id || 'unknown';

  dbgLog(
    '🆔 Создание инстанса',
    {
      instanceId: instanceId,
      panelId: 'debug-control-panel-v2',
      componentId: componentId,
      timestamp: new Date().toISOString(),
    },
    'info'
  );

  const instance = instanceArg || getInstance();
  if (!instance) {
    dbgError('Локальный экземпляр не найден!');
    alert('❌ Локальный экземпляр не найден!\nЗапустите букмарклет сначала.');
    return null;
  }

  dbgSuccess('Локальный экземпляр получен', {
    id: instance.id,
    idShort: instance.id?.slice(-8),
  });

  const state = instance.getState ? instance.getState() : getGlobalState();
  if (!state) {
    dbgError('Глобальное состояние не найдено!');
    alert('❌ Глобальное состояние не найдено!');
    return null;
  }

  dbgSuccess('Глобальное состояние получено', {
    hasGetState: typeof state.getState === 'function',
    hasOn: typeof state.on === 'function',
    hasSet: typeof state.set === 'function',
    instances: state?.instances?.length || 0,
    currentInstance: state?.getCurrentInstance?.()?.slice(-8) || 'none',
  });

  // Проверяем существующую панель
  dbgStep('Проверка существующей панели...');

  const existingPanel = document.getElementById('debug-control-panel-v2');
  if (existingPanel) {
    const isVisible = existingPanel.style.display !== 'none';
    state.visible = !isVisible;
    dbgLog(`🔄 Панель ${state.visible ? 'показана' : 'скрыта'}`, null, 'info');
    return state;
  }

  dbgLog('ℹ️ Существующая панель не найдена, создаём новую', null, 'info');

  // Получаем ENV
  dbgStep('Получение ENV...');
  const env = getEnv();
  if (!env || !env.debug) {
    dbgWarn('ENV не найден, создаем заглушку');
    const debugStub = {
      namespace: '',
      enable: ns => {
        dbgLog(`🔍 DEBUG enabled: ${ns}`, null, 'info');
      },
      disable: () => {
        dbgLog('🔍 DEBUG disabled', null, 'info');
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
      logStatus: () => dbgLog('🔍 DEBUG: off', null, 'info'),
      help: () => dbgLog('📋 DEBUG help: use enable(namespace)', null, 'info'),
    };
    if (typeof window.DEBUG !== 'undefined') {
      debugStub.namespace = window.DEBUG || '';
    }
    if (typeof window.ENV === 'undefined' && typeof ENV === 'undefined') {
      window.ENV = { debug: debugStub };
    }
  }

  dbgLog('🆕 Создание новой debug панели...', null, 'info');

  // Импортируем PanelBuilder
  try {
    dbgStep('Импорт PanelBuilder из modules/ui.js...');

    const { default: PanelBuilder } = await import('./modules/ui.js');
    dbgSuccess('PanelBuilder импортирован', {
      type: typeof PanelBuilder,
      name: PanelBuilder.name,
    });

    dbgStep('Создание PanelBuilder с параметрами...');

    const builder = new PanelBuilder({
      panelType: 'debug', // <--- ВАЖНО: правильный тип!
      panelId: 'debug-control-panel-v2',
      panelPrefix: 'dbg',
      componentId: componentId,
    });

    dbgSuccess('PanelBuilder создан', {
      hasPanel: !!builder.panel,
      hasBuild: typeof builder.build === 'function',
      componentId: componentId,
    });

    dbgStep('Вызов builder.build()...');
    const panel = builder.build();

    if (!panel) {
      dbgError('Не удалось создать панель');
      return null;
    }

    // Устанавливаем уникальный ID
    panel.id = 'debug-control-panel-v2';
    panel.dataset.panelType = 'debug';
    panel.dataset.instanceId = instanceId;
    panel.dataset.componentId = componentId;

    dbgSuccess('Панель создана', {
      id: panel.id,
      tagName: panel.tagName,
      className: panel.className,
      dataset: panel.dataset,
      style: {
        display: panel.style.display,
        position: panel.style.position,
      },
    });

    // Устанавливаем z-index
    dbgStep('Установка z-index...');
    const zIndex = getNextZIndex();
    panel.style.zIndex = zIndex;
    state.zIndex = zIndex;
    dbgSuccess('z-index установлен', { zIndex: zIndex });

    // Настройка заголовка
    dbgStep('Настройка заголовка панели...');
    const header = builder.get('env-panel-header');
    if (header) {
      dbgLog('ℹ️ Заголовок найден', {
        id: header.id,
        hasTitle: !!header.querySelector('.panel-title'),
      });

      const title = header.querySelector('.panel-title');
      if (title) {
        // Очищаем и устанавливаем новый заголовок
        title.innerHTML = `
                    <span style="margin-right:6px;">🐛</span>
                    Debug Control
                    <span id="debug-status-badge" style="font-size:9px;padding:1px 8px;border-radius:10px;background:rgba(0,184,148,0.15);color:#00b894;border:1px solid rgba(0,184,148,0.2);margin-left:8px;">off</span>
                `;
        dbgSuccess('Заголовок обновлён');
      } else {
        dbgWarn('Заголовок .panel-title не найден');
      }
    } else {
      dbgWarn('Заголовок панели не найден');
    }

    // Добавляем группы пресетов
    dbgStep('Добавление групп пресетов...');
    const groupsContainer = builder.get('env-groups');
    if (groupsContainer) {
      dbgLog('ℹ️ Контейнер групп найден', {
        id: groupsContainer.id,
        childrenCount: groupsContainer.children.length,
      });

      groupsContainer.innerHTML = '';
      dbgLog('ℹ️ Контейнер групп очищен', null, 'info');

      const env = getEnv();
      let val = env?.debug?.namespace || '';
      dbgLog('ℹ️ Текущий DEBUG namespace', { namespace: val || 'off' });

      let groupCount = 0;
      let presetCount = 0;

      for (const [name, group] of Object.entries(DEBUG_GROUPS)) {
        groupCount++;
        dbgLog(`ℹ️ Создание группы: ${name}`, {
          presetsCount: group.presets.length,
        });

        const g = document.createElement('div');
        g.style.cssText =
          'border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:8px 10px;background:rgba(255,255,255,0.02)';

        const t = document.createElement('div');
        t.style.cssText =
          'font-size:10px;font-weight:bold;color:#8899bb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px';
        t.textContent = name;
        g.appendChild(t);

        const b = document.createElement('div');
        b.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px';

        for (const p of group.presets) {
          presetCount++;
          const active = val === p.value;
          const btn = document.createElement('button');
          btn.textContent = p.name;
          btn.dataset.preset = p.value || '';
          btn.style.cssText = `
                        padding:3px 8px;
                        border:1px solid ${active ? '#667eea' : 'rgba(255,255,255,0.05)'};
                        border-radius:4px;
                        background:${active ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)'};
                        color:${active ? '#fff' : '#8899bb'};
                        font-size:10px;
                        cursor:pointer;
                        transition:all 0.2s;
                        font-family:inherit;
                        white-space:nowrap;
                    `;

          btn.onmouseenter = function () {
            const a = this.dataset.preset === val;
            this.style.background = a ? 'rgba(102,126,234,0.4)' : 'rgba(255,255,255,0.08)';
            this.style.transform = 'translateY(-1px)';
          };
          btn.onmouseleave = function () {
            const a = this.dataset.preset === val;
            this.style.background = a ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
            this.style.transform = 'translateY(0)';
          };

          btn.onclick = function () {
            const env = getEnv();
            const v = this.dataset.preset;
            if (v && env?.debug?.enable) {
              env.debug.enable(v);
              dbgSuccess(`Включен DEBUG: ${v}`);
            } else if (v) {
              dbgWarn(`DEBUG не доступен, но пресет: ${v}`);
              try {
                localStorage.setItem('debug', v);
              } catch (e) {}
            }
            val = v;
            if (state) {
              state.namespace = v;
            }
            updateGroupUI();
            bringToFront(panel);
          };
          b.appendChild(btn);
        }
        g.appendChild(b);
        groupsContainer.appendChild(g);
      }

      dbgSuccess('Группы пресетов созданы', {
        groupCount: groupCount,
        presetCount: presetCount,
        currentNamespace: val || 'off',
      });

      updateGroupUI();
    } else {
      dbgWarn('Контейнер групп не найден');
    }

    // Добавляем быстрые действия
    dbgStep('Добавление быстрых действий...');
    const actionsContainer = builder.get('env-actions');
    if (actionsContainer) {
      dbgLog('ℹ️ Контейнер действий найден', {
        id: actionsContainer.id,
      });

      const env = getEnv();
      const actionButtons = [
        {
          text: '📊',
          title: 'Показать ENV',
          action: function () {
            const env = getEnv();
            if (env?.debug?.getConfig) {
              const config = env.debug.getConfig();
              dbgLog('📊 ENV Config:', config, 'info');
              alert('📊 ENV Config:\n' + JSON.stringify(config, null, 2));
            } else {
              dbgWarn('📊 ENV Config: не доступен');
              alert('📊 ENV Config: не доступен');
            }
            bringToFront(panel);
          },
        },
        {
          text: '🔊 Всё',
          title: 'Включить все логи',
          action: function () {
            const env = getEnv();
            if (env?.debug?.enable) {
              env.debug.enable('wasm:*');
              if (state) state.namespace = 'wasm:*';
              dbgSuccess('Включены все логи: wasm:*');
              updateGroupUI();
            } else {
              dbgWarn('DEBUG не доступен');
              try {
                localStorage.setItem('debug', 'wasm:*');
                dbgSuccess('Сохранено в localStorage: wasm:*');
              } catch (e) {}
            }
            bringToFront(panel);
          },
        },
        {
          text: '🔇 Выкл',
          title: 'Отключить все логи',
          action: function () {
            const env = getEnv();
            if (env?.debug?.disable) {
              env.debug.disable();
              if (state) state.namespace = '';
              dbgLog('🔇 DEBUG отключен', null, 'info');
              updateGroupUI();
            } else {
              dbgWarn('DEBUG не доступен');
              try {
                localStorage.setItem('debug', '');
                dbgLog('Сохранено в localStorage: off', null, 'info');
              } catch (e) {}
            }
            bringToFront(panel);
          },
        },
        {
          text: '🔄 Синхр',
          title: 'Синхронизировать с localStorage',
          action: function () {
            if (instance && instance.sync) {
              instance.sync('merge');
              dbgSuccess('Синхронизация выполнена');
            } else {
              dbgWarn('Метод sync не найден');
            }
            bringToFront(panel);
          },
        },
        {
          text: '📤 Экспорт',
          title: 'Экспортировать состояние',
          action: function () {
            if (instance && instance.export) {
              const json = instance.export();
              dbgLog('📤 Экспорт:', json, 'info');
              navigator.clipboard
                .writeText(json)
                .then(() => {
                  dbgSuccess('Состояние скопировано в буфер обмена');
                })
                .catch(() => {
                  dbgLog('📋 Состояние:\n', json, 'info');
                });
            } else {
              dbgWarn('Метод export не найден');
            }
            bringToFront(panel);
          },
        },
        {
          text: '🔄 Сброс',
          title: 'Сбросить состояние к дефолтному',
          action: function () {
            if (confirm('Сбросить состояние к дефолтному?')) {
              if (instance && instance.reset) {
                instance.reset();
                dbgSuccess('Состояние сброшено');
                updateGroupUI();
              } else {
                dbgWarn('Метод reset не найден');
              }
            }
            bringToFront(panel);
          },
        },
        {
          text: '📜 История',
          title: 'Показать историю изменений',
          action: function () {
            if (instance && instance.getHistory) {
              const history = instance.getHistory();
              dbgLog('📜 История изменений:', history, 'info');
              alert('📜 История изменений:\n' + JSON.stringify(history.slice(-10), null, 2));
            } else {
              dbgWarn('Метод getHistory не найден');
            }
            bringToFront(panel);
          },
        },
        {
          text: '🧠 SharedMem',
          title: 'Проверить SharedMemory',
          action: function () {
            if (instance && instance.checkSharedMemory) {
              const status = instance.checkSharedMemory();
              dbgLog('🧠 SharedMemory статус:', status, 'info');
              alert('🧠 SharedMemory статус:\n' + JSON.stringify(status, null, 2));
            } else {
              dbgWarn('Метод checkSharedMemory не найден');
            }
            bringToFront(panel);
          },
        },
        {
          text: '📋 Статус',
          title: 'Показать статус DEBUG',
          action: function () {
            const env = getEnv();
            if (env?.debug?.logStatus) {
              env.debug.logStatus();
            } else {
              dbgLog('📋 DEBUG status: off', null, 'info');
            }
            bringToFront(panel);
          },
        },
        {
          text: '❓ Помощь',
          title: 'Показать справку по DEBUG',
          action: function () {
            const env = getEnv();
            if (env?.debug?.help) {
              env.debug.help();
            } else {
              dbgLog(
                '📋 DEBUG help:\n  enable(ns) - включить namespace\n  disable() - отключить\n  getConfig() - показать конфиг\n  setOptions(opts) - настроить',
                null,
                'info'
              );
            }
            bringToFront(panel);
          },
        },
      ];

      for (const a of actionButtons) {
        const btn = document.createElement('button');
        btn.textContent = a.text;
        btn.title = a.title || '';
        btn.style.cssText = `
                    padding:4px 10px;
                    border:1px solid rgba(255,255,255,0.05);
                    border-radius:4px;
                    background:rgba(255,255,255,0.03);
                    color:#8899bb;
                    font-size:10px;
                    cursor:pointer;
                    font-family:inherit;
                    transition:all 0.2s;
                `;
        btn.onmouseenter = function () {
          this.style.background = 'rgba(255,255,255,0.08)';
          this.style.transform = 'translateY(-1px)';
        };
        btn.onmouseleave = function () {
          this.style.background = 'rgba(255,255,255,0.03)';
          this.style.transform = 'translateY(0)';
        };
        btn.onclick = a.action;
        actionsContainer.appendChild(btn);
      }

      dbgSuccess('Быстрые действия добавлены', {
        count: actionButtons.length,
      });
    } else {
      dbgWarn('Контейнер действий не найден');
    }

    // Добавляем блок команд
    dbgStep('Добавление блока команд...');
    const commandsContainer = builder.get('env-commands');
    if (commandsContainer) {
      commandsContainer.innerHTML = `
                <div style="color:#8899bb;font-weight:bold;font-size:9px;margin-bottom:2px;">🐛 Управление DEBUG:</div>
                <div style="display:flex;flex-wrap:wrap;gap:2px 8px;">
                    <code style="color:#667eea;">R.getState()</code>
                    <code style="color:#667eea;">R.sync()</code>
                    <code style="color:#667eea;">R.getHistory()</code>
                    <code style="color:#667eea;">R.getInstances()</code>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:2px;color:#445;">
                    <code style="color:#fdcb6e;">env.debug.enable("wasm:*")</code>
                    <code style="color:#fdcb6e;">env.debug.disable()</code>
                    <code style="color:#fdcb6e;">env.debug.setOptions({ depth: 4 })</code>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:2px;color:#445;">
                    <code style="color:#74b9ff;">__debugPanelV2.toggle()</code>
                    <code style="color:#74b9ff;">__debugPanelV2.show()</code>
                    <code style="color:#74b9ff;">__debugPanelV2.hide()</code>
                </div>
            `;
      dbgSuccess('Блок команд добавлен');
    } else {
      dbgWarn('Контейнер команд не найден');
    }

    // Добавляем панель в DOM
    dbgStep('Добавление панели в DOM...');
    document.body.appendChild(panel);
    state.panelExists = true;
    state.visible = true;
    dbgSuccess('Панель добавлена в DOM', {
      bodyChildren: document.body.children.length,
    });

    // Настройка обработчиков кнопок
    dbgStep('Настройка обработчиков...');
    setupHandlers(builder, panel, state, instance);
    dbgSuccess('Обработчики кнопок настроены');

    // Подписка на изменения состояния
    dbgStep('Настройка слушателей состояния...');
    setupStateListeners(builder, panel, state);
    dbgSuccess('Слушатели состояния настроены');

    // Настройка перетаскивания и ресайза
    dbgStep('Настройка перетаскивания и ресайза...');
    setupDragAndResize(builder, panel, state);
    dbgSuccess('Перетаскивание и ресайз настроены');

    // Выводим на передний план
    dbgStep('Вывод на передний план...');
    bringToFront(panel);
    dbgSuccess('Панель выведена на передний план');

    state.isReady = true;

    dbgSeparator();
    dbgSuccess('✅ Debug Control Panel создана и показана!');
    dbgLog(
      '📐 Размеры',
      {
        width: state.size?.width || 420,
        height: state.size?.height || 520,
      },
      'info'
    );
    dbgLog(
      '📍 Позиция',
      {
        x: state.position?.x || 20,
        y: state.position?.y || 20,
      },
      'info'
    );
    dbgLog('📌 Z-Index', { zIndex: state.zIndex || 99996 }, 'info');
    dbgLog('📌 Свернута', { minimized: state.minimized ? 'Да' : 'Нет' }, 'info');
    dbgLog('📌 Полноэкранный', { fullscreen: state.fullscreen ? 'Да' : 'Нет' }, 'info');
    dbgLog('📌 Экземпляр', { id: instance.id || 'unknown' }, 'info');

    const env = getEnv();
    dbgLog('📌 Текущий DEBUG', { namespace: env?.debug?.namespace || 'off' }, 'info');

    dbgSeparator();
    dbgLog('📋 Доступные команды:', null, 'info');
    dbgLog('  __debugPanelV2.show()    - показать панель', null, 'info');
    dbgLog('  __debugPanelV2.hide()    - скрыть панель', null, 'info');
    dbgLog('  __debugPanelV2.toggle()  - переключить', null, 'info');
    dbgLog('  __debugPanelV2.focus()   - вывести на передний план', null, 'info');
    dbgLog('  __debugPanelV2.refresh() - обновить состояние', null, 'info');

    // Экспортируем в глобальный объект
    window.__debugPanelV2 = {
      show: function () {
        panel.style.display = 'flex';
        panel.style.transform = 'scale(0.95)';
        panel.style.opacity = '0';
        setTimeout(() => {
          panel.style.transform = 'scale(1)';
          panel.style.opacity = '1';
          bringToFront(panel);
        }, 50);
        state.visible = true;
        dbgLog('👁️ Панель показана', null, 'info');
      },
      hide: function () {
        panel.style.transform = 'scale(0.95)';
        panel.style.opacity = '0';
        setTimeout(() => {
          panel.style.display = 'none';
        }, 300);
        state.visible = false;
        dbgLog('🙈 Панель скрыта', null, 'info');
      },
      toggle: function () {
        if (panel.style.display === 'none') {
          this.show();
        } else {
          this.hide();
        }
      },
      focus: function () {
        bringToFront(panel);
        dbgLog('🎯 Фокус на панели', null, 'info');
      },
      refresh: function () {
        updateGroupUI();
        dbgLog('🔄 Панель обновлена', null, 'info');
      },
      getState: function () {
        return {
          visible: panel.style.display !== 'none',
          minimized: state.minimized || false,
          fullscreen: state.fullscreen || false,
          zIndex: parseInt(panel.style.zIndex) || 99996,
          size: { width: panel.offsetWidth, height: panel.offsetHeight },
          position: {
            left: parseInt(panel.style.left) || 20,
            top: parseInt(panel.style.top) || 20,
          },
        };
      },
      destroy: function () {
        if (panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
        delete window.__debugPanelV2;
        dbgLog('🗑️ Панель уничтожена', null, 'info');
      },
    };

    dbgSeparator();
    dbgHeader('ГОТОВ');

    return state;
  } catch (error) {
    dbgError('Ошибка при создании debug панели:', error.message);
    dbgLog('📚 Stack:', error.stack, 'error');

    // Показываем ошибку пользователю
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(255,107,107,0.95);
            color: #fff;
            padding: 15px 20px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 13px;
            max-width: 400px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.1);
        `;
    errorDiv.innerHTML = `
            <strong>❌ Ошибка:</strong><br>
            ${error.message}
            <br><br>
            <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;">Закрыть</button>
        `;
    document.body.appendChild(errorDiv);
    return null;
  }
}

// ============================================================
// 8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function updateGroupUI() {
  dbgStep('Обновление UI групп...');

  const env = getEnv();
  if (!env || !env.debug) {
    dbgWarn('ENV не найден для обновления UI');
    return;
  }

  const current = env.debug.namespace || '';
  const buttons = document.querySelectorAll('#debug-control-panel-v2 button[data-preset]');

  dbgLog('ℹ️ Обновление кнопок', {
    count: buttons.length,
    current: current || 'off',
  });

  buttons.forEach(function (b) {
    const active = b.dataset.preset === current;
    b.style.background = active ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
    b.style.color = active ? '#fff' : '#8899bb';
    b.style.borderColor = active ? '#667eea' : 'rgba(255,255,255,0.05)';
  });

  // Обновляем статус-бейдж
  const statusBadge = document.getElementById('debug-status-badge');
  if (statusBadge) {
    const isEnabled = !!current && current !== 'off';
    statusBadge.textContent = current || 'off';
    statusBadge.style.background = isEnabled ? 'rgba(0,184,148,0.15)' : 'rgba(255,255,255,0.05)';
    statusBadge.style.color = isEnabled ? '#00b894' : '#636e72';
    statusBadge.style.borderColor = isEnabled ? 'rgba(0,184,148,0.2)' : 'rgba(255,255,255,0.05)';
  }

  dbgSuccess('UI групп обновлён');
}

// ============================================================
// 9. НАСТРОЙКА ОБРАБОТЧИКОВ
// ============================================================

function setupHandlers(builder, panel, state, instance) {
  dbgStep('Настройка обработчиков кнопок...');

  const minimizeBtn = builder.get('env-minimize-btn');
  if (minimizeBtn) {
    dbgLog('ℹ️ Найден minimizeBtn', null, 'info');
    minimizeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (state.fullscreen) {
        state.fullscreen = false;
        setTimeout(() => {
          state.minimized = true;
        }, 300);
        return;
      }
      state.minimized = !state.minimized;
      bringToFront(panel);
    });
  }

  const maximizeBtn = builder.get('env-maximize-btn');
  if (maximizeBtn) {
    dbgLog('ℹ️ Найден maximizeBtn', null, 'info');
    maximizeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      state.fullscreen = !state.fullscreen;
      bringToFront(panel);
    });
  }

  const closeBtn = builder.get('env-close-btn');
  if (closeBtn) {
    dbgLog('ℹ️ Найден closeBtn', null, 'info');
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      state.visible = false;
      // Скрываем панель
      const panel = document.getElementById('debug-control-panel-v2');
      if (panel) {
        panel.style.opacity = '0';
        panel.style.transform = 'scale(0.95)';
        setTimeout(() => {
          panel.style.display = 'none';
        }, 300);
      }
      bringToFront(panel);
    });
  }

  // Двойной клик по шапке для полноэкранного режима
  const header = builder.get('env-panel-header');
  if (header) {
    dbgLog('ℹ️ Найден header, настройка dblclick', null, 'info');
    header.addEventListener('dblclick', function (e) {
      if (e.target.closest('.panel-controls')) return;
      if (maximizeBtn) maximizeBtn.click();
    });
  }

  // ✅ КЛИК ПО ВСЕЙ ПАНЕЛИ - выводим на передний план
  panel.addEventListener('mousedown', function (e) {
    // Не обрабатываем клики по кнопкам управления (чтобы они работали)
    if (e.target.closest('.panel-controls')) return;
    if (e.target.closest('button')) return;
    if (e.target.closest('input')) return;
    if (e.target.closest('select')) return;
    if (e.target.closest('textarea')) return;

    bringToFront(panel);
  });

  dbgSuccess('Обработчики настроены');
}

// ============================================================
// 10. НАСТРОЙКА СЛУШАТЕЛЕЙ СОСТОЯНИЯ
// ============================================================

function setupStateListeners(builder, panel, state) {
  dbgStep('Настройка слушателей состояния...');

  state.on('minimized', function (e) {
    dbgLog(`📐 Минимизация: ${e.value}`, null, 'info');
    if (e.value) {
      panel.classList.add('minimized');
      panel.style.height = '44px';
      panel.style.minHeight = '44px';
      panel.style.maxHeight = '44px';
      const body = panel.querySelector('#env-panel-body');
      if (body) body.style.display = 'none';
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = 'none';
    } else {
      panel.classList.remove('minimized');
      const prevHeight = parseInt(panel.dataset.prevHeight) || 520;
      panel.style.height = prevHeight + 'px';
      panel.style.minHeight = '300px';
      panel.style.maxHeight = '';
      const body = panel.querySelector('#env-panel-body');
      if (body) body.style.display = '';
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = '';
      bringToFront(panel);
    }
    const minBtn = builder.get('env-minimize-btn');
    if (minBtn) minBtn.textContent = e.value ? '□' : '─';
  });

  state.on('fullscreen', function (e) {
    dbgLog(`🖥️ Полноэкранный режим: ${e.value}`, null, 'info');
    if (e.value) {
      if (!panel.dataset.prevWidth) {
        panel.dataset.prevWidth = panel.offsetWidth;
        panel.dataset.prevHeight = panel.offsetHeight;
        panel.dataset.prevLeft = panel.style.left || panel.offsetLeft + 'px';
        panel.dataset.prevTop = panel.style.top || panel.offsetTop + 'px';
      }
      panel.style.width = '100vw';
      panel.style.height = '100vh';
      panel.style.top = '0';
      panel.style.left = '0';
      panel.style.borderRadius = '0';
      panel.style.border = 'none';
      panel.style.maxWidth = '100vw';
      panel.style.maxHeight = '100vh';
      panel.style.minWidth = '100vw';
      panel.style.minHeight = '100vh';
      panel.style.zIndex = '999999';
      document.body.style.overflow = 'hidden';
      if (state.minimized) {
        state.minimized = false;
      }
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = 'none';
    } else {
      const prevWidth = parseInt(panel.dataset.prevWidth) || 380;
      const prevHeight = parseInt(panel.dataset.prevHeight) || 520;
      const prevLeft = panel.dataset.prevLeft || '20px';
      const prevTop = panel.dataset.prevTop || '20px';
      panel.style.width = prevWidth + 'px';
      panel.style.height = prevHeight + 'px';
      panel.style.top = prevTop;
      panel.style.left = prevLeft;
      panel.style.borderRadius = '12px';
      panel.style.border = '1px solid rgba(255,255,255,0.08)';
      panel.style.maxWidth = '';
      panel.style.maxHeight = '';
      panel.style.minWidth = '280px';
      panel.style.minHeight = '300px';
      panel.style.zIndex = '';
      document.body.style.overflow = '';
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = '';
      bringToFront(panel);
    }
    const maxBtn = builder.get('env-maximize-btn');
    if (maxBtn) maxBtn.textContent = e.value ? '⧉' : '□';
  });

  state.on('visible', function (e) {
    dbgLog(`👁️ Видимость: ${e.value}`, null, 'info');
    if (e.value) {
      panel.style.display = 'flex';
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.transform = 'scale(1)';
        panel.style.opacity = '1';
        bringToFront(panel);
      }, 50);
    } else {
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);
    }
  });

  dbgSuccess('Слушатели состояния настроены', {
    listenersCount: 3,
  });
}

// ============================================================
// 11. НАСТРОЙКА ПЕРЕТАСКИВАНИЯ И РЕСАЙЗА
// ============================================================

function setupDragAndResize(builder, panel, state) {
  dbgStep('Настройка перетаскивания и ресайза...');

  const header = builder.get('env-panel-header');
  const resizeHandle = builder.get('env-panel-resize');

  let isDragging = false;
  let dragStartX = 0,
    dragStartY = 0;
  let panelStartX = 0,
    panelStartY = 0;
  let rafId = null;

  if (header) {
    dbgLog('ℹ️ Найден header, настройка drag', null, 'info');
    header.addEventListener('mousedown', function (e) {
      if (e.target.closest('.panel-controls')) return;
      if (state.fullscreen) return;
      if (e.button !== 0) return;

      e.preventDefault();
      isDragging = true;
      bringToFront(panel);

      const rect = panel.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      panelStartX = rect.left;
      panelStartY = rect.top;

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      panel.style.transition = 'none';

      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDragEnd);
    });
  }

  function onDrag(e) {
    if (!isDragging) return;
    e.preventDefault();

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      let newX = Math.max(0, panelStartX + dx);
      let newY = Math.max(0, panelStartY + dy);

      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;
      newX = Math.min(newX, maxX);
      newY = Math.min(newY, maxY);

      panel.style.left = newX + 'px';
      panel.style.top = newY + 'px';

      if (state.position) {
        state.position = { x: newX, y: newY, unit: 'px' };
      }
      rafId = null;
    });
  }

  function onDragEnd() {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      panel.style.transition = '';
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  let isResizing = false;
  let resizeStartX = 0,
    resizeStartY = 0;
  let resizeStartWidth = 0,
    resizeStartHeight = 0;
  let resizeRafId = null;

  if (resizeHandle) {
    dbgLog('ℹ️ Найден resizeHandle, настройка resize', null, 'info');
    resizeHandle.addEventListener('mousedown', function (e) {
      if (state.fullscreen) return;
      e.stopPropagation();
      e.preventDefault();
      bringToFront(panel);

      isResizing = true;

      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartWidth = panel.offsetWidth;
      resizeStartHeight = panel.offsetHeight;

      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
      panel.style.transition = 'none';

      document.addEventListener('mousemove', onResize);
      document.addEventListener('mouseup', onResizeEnd);
    });
  }

  function onResize(e) {
    if (!isResizing) return;
    e.preventDefault();

    if (resizeRafId) cancelAnimationFrame(resizeRafId);
    resizeRafId = requestAnimationFrame(() => {
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;

      let newWidth = Math.max(280, resizeStartWidth + dx);
      let newHeight = Math.max(300, resizeStartHeight + dy);

      const maxW = window.innerWidth - parseInt(panel.style.left || 20) - 10;
      const maxH = window.innerHeight - parseInt(panel.style.top || 20) - 10;
      newWidth = Math.min(newWidth, maxW);
      newHeight = Math.min(newHeight, maxH);

      panel.style.width = newWidth + 'px';
      panel.style.height = newHeight + 'px';

      if (state.size) {
        state.size = { width: newWidth, height: newHeight };
      }
      resizeRafId = null;
    });
  }

  function onResizeEnd() {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      panel.style.transition = '';
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', onResizeEnd);
    }
    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = null;
    }
  }

  dbgSuccess('Перетаскивание и ресайз настроены');
}

// ============================================================
// 12. ЭКСПОРТ
// ============================================================

export { getInstance, getGlobalState, getEnv };

dbgLog('🐛 ./src/debug-panel.js загружен', null, 'info');
dbgLog('📌 Для запуска используйте: window.__debugPanelV2.toggle()', null, 'info');
