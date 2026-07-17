// logs-panel.js - Logs Control Panel
// Использует ту же архитектуру, что и env-panel.js
// Подключается через bookmarklet.js
// ОБНОВЛЕНО: Убраны Illegal return statement
// ОБНОВЛЕНО: Добавлен panelType: 'logs'
// ОБНОВЛЕНО: Добавлено расширенное debug-логирование
// ОБНОВЛЕНО: Добавлен обработчик mousedown на всю панель для поднятия z-index

// ============================================================
// 1. DEBUG-ЛОГГЕР ДЛЯ LOGS PANEL
// ============================================================

const LOGS_LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  panel: 'color: #74b9ff; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #fdcb6e;',
  type: 'color: #764ba2; font-weight: bold;',
};

function logsLog(message, data = null, style = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `%c[${timestamp}] %c[Logs-Panel]`;
  const styles = [LOGS_LOG_STYLES.info, LOGS_LOG_STYLES.panel];

  if (data !== null && data !== undefined) {
    console.log(
      prefix + ' %c' + message,
      ...styles,
      LOGS_LOG_STYLES[style] || LOGS_LOG_STYLES.info,
      data
    );
  } else {
    console.log(
      prefix + ' %c' + message,
      ...styles,
      LOGS_LOG_STYLES[style] || LOGS_LOG_STYLES.info
    );
  }
}

function logsHeader(title) {
  console.log('%c' + '═'.repeat(60), LOGS_LOG_STYLES.separator);
  console.log('%c  📋 ' + title, LOGS_LOG_STYLES.header);
  console.log('%c' + '═'.repeat(60), LOGS_LOG_STYLES.separator);
}

function logsSeparator() {
  console.log('%c' + '─'.repeat(60), LOGS_LOG_STYLES.separator);
}

// ============================================================
// 2. ПОЛУЧЕНИЕ ЛОКАЛЬНОГО ЭКЗЕМПЛЯРА
// ============================================================

function getInstance() {
  if (arguments[0] && typeof arguments[0] === 'object' && arguments[0].getState) {
    return arguments[0];
  }
  const instance = window.__bookmarkletInstance || window.R;
  if (instance && instance.getState) {
    return instance;
  }
  logsLog('⚠️ Локальный экземпляр не найден', null, 'warn');
  return null;
}

function getGlobalState() {
  const instance = getInstance();
  if (instance && instance.getState) {
    return instance.getState();
  }
  return window.__globalState || window.globalState || null;
}

// ============================================================
// 3. БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ENV
// ============================================================

function getEnv() {
  if (typeof window.ENV !== 'undefined') {
    return window.ENV;
  }
  if (typeof ENV !== 'undefined') {
    return ENV;
  }
  logsLog('⚠️ ENV не найден, создаем заглушку', null, 'warn');
  return {
    debug: {
      namespace: '',
      enable: ns => {
        logsLog(`🔍 DEBUG enabled: ${ns}`, null, 'info');
      },
      disable: () => {
        logsLog('🔍 DEBUG disabled', null, 'info');
      },
    },
  };
}

// ============================================================
// 4. ЛОГГЕР
// ============================================================

let logEntries = [];
let isPaused = false;
let isFollowing = true;
let logId = 0;
let isPanelReady = false;

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SUCCESS: 'success',
};

function getLevelLabel(level) {
  const labels = {
    debug: 'DEBUG',
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    success: 'SUCCESS',
  };
  return labels[level] || level.toUpperCase();
}

function getLevelColor(level) {
  const colors = {
    debug: '#667eea',
    info: '#74b9ff',
    warn: '#fdcb6e',
    error: '#ff6b6b',
    success: '#00b894',
  };
  return colors[level] || '#8899bb';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function parseFormatString(str, args) {
  if (!str || typeof str !== 'string') {
    return { message: String(str), styles: [] };
  }

  let result = '';
  let argIndex = 0;
  const styles = [];
  const formatRegex = /%([sdoOjc%])/g;
  let match;
  let lastIndex = 0;

  while ((match = formatRegex.exec(str)) !== null) {
    const [fullMatch, type] = match;
    const prefix = str.slice(lastIndex, match.index);
    if (prefix) result += prefix;
    lastIndex = formatRegex.lastIndex;

    switch (type) {
      case '%':
        result += '%';
        break;
      case 's':
        result += argIndex < args.length ? String(args[argIndex++]) : '%s';
        break;
      case 'd':
        if (argIndex < args.length) {
          const num = Number(args[argIndex++]);
          result += isNaN(num) ? 'NaN' : String(num);
        } else {
          result += '%d';
        }
        break;
      case 'j':
      case 'o':
      case 'O':
        if (argIndex < args.length) {
          const val = args[argIndex++];
          try {
            const indent = type === 'O' ? 4 : type === 'o' ? 2 : 0;
            result += JSON.stringify(val, null, indent);
          } catch {
            result += String(val);
          }
        } else {
          result += `%${type}`;
        }
        break;
      case 'c':
        if (argIndex < args.length) {
          styles.push({ start: result.length, style: String(args[argIndex++]) });
        } else {
          result += '%c';
        }
        break;
      default:
        result += fullMatch;
    }
  }

  if (lastIndex < str.length) {
    result += str.slice(lastIndex);
  }

  while (argIndex < args.length) {
    const remaining = args[argIndex++];
    if (remaining !== undefined && remaining !== null) {
      try {
        if (typeof remaining === 'object') {
          result += ' ' + JSON.stringify(remaining);
        } else {
          result += ' ' + String(remaining);
        }
      } catch {
        result += ' [Object]';
      }
    }
  }

  return { message: result, styles };
}

function addLogEntry(level, ...args) {
  if (isPaused) return;

  let message = '';
  let rawMessage = '';

  if (args.length > 0 && typeof args[0] === 'string') {
    const parsed = parseFormatString(args[0], args.slice(1));
    rawMessage = parsed.message;
    message = parsed.message;
  } else if (args.length > 0) {
    message = args
      .map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
          try {
            return JSON.stringify(a);
          } catch {
            return '[Object]';
          }
        }
        return String(a);
      })
      .join(' ');
  } else {
    message = ' ';
  }

  let actualLevel = level;
  if (!actualLevel || actualLevel === 'info') {
    if (message.includes('❌') || message.includes('error') || message.includes('Error')) {
      actualLevel = LOG_LEVELS.ERROR;
    } else if (message.includes('⚠️') || message.includes('warn') || message.includes('Warn')) {
      actualLevel = LOG_LEVELS.WARN;
    } else if (message.includes('✅') || message.includes('success')) {
      actualLevel = LOG_LEVELS.SUCCESS;
    } else if (message.includes('🔍') || message.includes('debug') || message.includes('DEBUG')) {
      actualLevel = LOG_LEVELS.DEBUG;
    } else {
      actualLevel = LOG_LEVELS.INFO;
    }
  }

  const entry = {
    id: logId++,
    timestamp: new Date(),
    level: actualLevel,
    message: message,
    rawMessage: rawMessage || message,
  };

  logEntries.push(entry);
  if (logEntries.length > 1000) logEntries = logEntries.slice(-500);

  if (isPanelReady) {
    renderLogs();
    updateLogStats();
    if (isFollowing) {
      const consoleEl = document.getElementById('logs-console');
      if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
    }
  }
}

function renderLogs() {
  const filter = document.getElementById('logs-filter')?.value?.toLowerCase() || '';
  const levelFilter = document.getElementById('logs-level')?.value || 'all';

  let filtered = logEntries;
  if (filter) {
    filtered = filtered.filter(
      e => e.message.toLowerCase().includes(filter) || e.rawMessage.toLowerCase().includes(filter)
    );
  }
  if (levelFilter !== 'all') {
    filtered = filtered.filter(e => e.level === levelFilter);
  }

  const consoleEl = document.getElementById('logs-console');
  if (!consoleEl) return;

  if (filtered.length === 0) {
    consoleEl.innerHTML = `<div class="logs-empty" style="color:#8899bb;text-align:center;padding:20px;font-style:italic;">📭 Нет логов${filter ? ' по вашему фильтру' : ''}</div>`;
    return;
  }

  let html = '';
  const entries = isFollowing ? filtered : filtered.slice(-100);

  for (const entry of entries) {
    const time = entry.timestamp.toLocaleTimeString();
    const levelLabel = getLevelLabel(entry.level);
    html += `
            <div class="logs-entry" style="padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.03);display:flex;gap:6px;align-items:flex-start;">
                <span class="logs-time" style="color:#8899bb;font-size:9px;min-width:60px;flex-shrink:0;">${time}</span>
                <span class="logs-level ${entry.level}" style="font-size:9px;padding:0 5px;border-radius:3px;font-weight:600;flex-shrink:0;color:${getLevelColor(entry.level)};">${levelLabel}</span>
                <span class="logs-message" style="color:#dfe6e9;word-break:break-all;flex:1;">${escapeHtml(entry.message)}</span>
            </div>
        `;
  }

  consoleEl.innerHTML = html;
}

function updateLogStats() {
  const total = logEntries.length;
  const errors = logEntries.filter(e => e.level === LOG_LEVELS.ERROR).length;
  const warnings = logEntries.filter(e => e.level === LOG_LEVELS.WARN).length;

  const totalEl = document.getElementById('logs-total');
  const errorsEl = document.getElementById('logs-errors');
  const warningsEl = document.getElementById('logs-warnings');
  if (totalEl) totalEl.textContent = total;
  if (errorsEl) errorsEl.textContent = errors;
  if (warningsEl) warningsEl.textContent = warnings;

  const statusEl = document.getElementById('logs-status');
  if (statusEl) {
    statusEl.textContent = isPaused ? '⏸️ Пауза' : '▶️ Активен';
    statusEl.style.color = isPaused ? '#fdcb6e' : '#00b894';
  }

  const badge = document.getElementById('logs-status-badge');
  if (badge) {
    badge.textContent = isPaused ? '⏸️ Пауза' : '▶️ Активен';
    badge.style.background = isPaused ? 'rgba(253,203,110,0.2)' : 'rgba(0,184,148,0.2)';
    badge.style.color = isPaused ? '#fdcb6e' : '#00b894';
  }

  const countBadge = document.getElementById('logs-count-badge');
  if (countBadge) {
    countBadge.textContent = total;
  }
}

// ============================================================
// 5. ПЕРЕХВАТ CONSOLE (только один раз)
// ============================================================

let isConsoleHooked = false;

function hookConsole() {
  if (isConsoleHooked) {
    logsLog('📋 Перехват console уже установлен', null, 'info');
    return;
  }
  isConsoleHooked = true;

  logsLog('🔧 Установка перехвата console...', null, 'info');

  const originalLog = console.log;
  const originalDebug = console.debug;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = function (...args) {
    originalLog.apply(console, args);
    addLogEntry(LOG_LEVELS.INFO, ...args);
  };
  console.debug = function (...args) {
    originalDebug.apply(console, args);
    addLogEntry(LOG_LEVELS.DEBUG, ...args);
  };
  console.info = function (...args) {
    originalInfo.apply(console, args);
    addLogEntry(LOG_LEVELS.INFO, ...args);
  };
  console.warn = function (...args) {
    originalWarn.apply(console, args);
    addLogEntry(LOG_LEVELS.WARN, ...args);
  };
  console.error = function (...args) {
    originalError.apply(console, args);
    addLogEntry(LOG_LEVELS.ERROR, ...args);
  };

  logsLog('✅ Перехват console.log установлен', null, 'success');
}

// ============================================================
// 6. ОСНОВНАЯ ФУНКЦИЯ (БЕЗ ILLEGAL RETURN)
// ============================================================

export default async function (instanceArg) {
  logsHeader('ЗАПУСК LOGS PANEL');
  logsLog('📋 Logs Panel запускается...', null, 'info');

  const instance = instanceArg || getInstance();
  if (!instance) {
    logsLog('❌ Локальный экземпляр не найден!', null, 'error');
    alert('❌ Локальный экземпляр не найден!\nЗапустите букмарклет сначала.');
    return null;
  }

  const instanceId = instance.id || 'unknown';
  logsLog(`📦 Получен локальный экземпляр: ${instanceId}`, null, 'info');

  const state = instance.getState ? instance.getState() : getGlobalState();
  if (!state) {
    logsLog('❌ Глобальное состояние не найдено!', null, 'error');
    alert('❌ Глобальное состояние не найдено!');
    return null;
  }

  logsLog('📊 Текущее состояние:', state.getState ? state.getState() : state, 'info');

  // Проверяем существующую панель
  const existingPanels = document.querySelectorAll('#logs-control-panel');
  if (existingPanels.length > 0) {
    // Если панелей несколько - удаляем все кроме одной
    if (existingPanels.length > 1) {
      logsLog(`🗑️ Найдено ${existingPanels.length} панелей, удаляем дубликаты`, null, 'warn');
      for (let i = 1; i < existingPanels.length; i++) {
        existingPanels[i].remove();
        logsLog(`🗑️ Удалена дублирующая панель #${i}`, null, 'info');
      }
    }

    const panel = existingPanels[0];
    const isVisible = panel.style.display !== 'none';
    if (state) state.visible = !isVisible;
    logsLog(`🔄 Панель ${state?.visible ? 'показана' : 'скрыта'}`, null, 'info');

    if (state?.visible) {
      panel.style.display = 'flex';
      setTimeout(() => {
        panel.style.opacity = '1';
        panel.style.transform = 'scale(1)';
      }, 50);
    } else {
      panel.style.opacity = '0';
      panel.style.transform = 'scale(0.95)';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);
    }
    return state;
  }

  const env = getEnv();
  if (!env || !env.debug) {
    logsLog('⚠️ ENV не найден, создаем заглушку', null, 'warn');
    if (typeof window.ENV === 'undefined' && typeof ENV === 'undefined') {
      window.ENV = {
        debug: {
          namespace: '',
          enable: ns => {
            logsLog(`🔍 DEBUG enabled: ${ns}`, null, 'info');
          },
          disable: () => {
            logsLog('🔍 DEBUG disabled', null, 'info');
          },
        },
      };
    }
  }

  logsLog('🆕 Создание новой logs панели...', null, 'info');

  try {
    // Импортируем PanelBuilder с правильным panelType
    const { default: PanelBuilder } = await import('./modules/ui.js');

    // Генерируем уникальный ID для этого инстанса
    const componentId = 'logs-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

    logsLog(
      '🏗️ Создание PanelBuilder с параметрами:',
      {
        panelType: 'logs',
        panelId: 'logs-control-panel',
        panelPrefix: 'logs',
        componentId: componentId,
      },
      'info'
    );

    const builder = new PanelBuilder({
      panelType: 'logs',
      panelId: 'logs-control-panel',
      panelPrefix: 'logs',
      componentId: componentId,
    });

    const panel = builder.build();

    if (!panel) {
      logsLog('❌ Не удалось создать панель', null, 'error');
      return null;
    }

    // Меняем ID панели
    panel.id = 'logs-control-panel';
    panel.dataset.panelType = 'logs';
    panel.dataset.instanceId = instance.id || 'unknown';
    panel.dataset.componentId = componentId;

    logsLog(
      '✅ Панель создана',
      {
        id: panel.id,
        componentId: componentId,
        instanceId: instanceId.slice(-8),
      },
      'success'
    );

    // Переопределяем заголовок для Logs
    const header = builder.get('env-panel-header');
    if (header) {
      logsLog('🎨 Настройка заголовка панели', null, 'info');
      const title = header.querySelector('span[style*="font-weight: bold"]');
      if (title) {
        title.innerHTML = `
                    <span style="margin-right:6px;">📋</span>
                    Logs Control
                    <span id="logs-status-badge" style="font-size:9px;padding:1px 8px;border-radius:10px;background:rgba(0,184,148,0.15);color:#00b894;border:1px solid rgba(0,184,148,0.2);margin-left:8px;">▶️ Активен</span>
                    <span id="logs-count-badge" style="font-size:9px;padding:1px 8px;border-radius:10px;background:rgba(102,126,234,0.15);color:#667eea;border:1px solid rgba(102,126,234,0.2);">${logEntries.length}</span>
                `;
        logsLog('✅ Заголовок панели настроен', null, 'success');
      }
    }

    // Добавляем консоль логов
    const body = builder.get('env-panel-body');
    if (body) {
      logsLog('📦 Построение тела панели', null, 'info');
      body.innerHTML = '';

      // Контролы
      const controls = document.createElement('div');
      controls.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex-shrink:0;';

      controls.innerHTML = `
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <input id="logs-filter" type="text" placeholder="🔍 Фильтр..." style="
                        flex:1;
                        min-width:100px;
                        padding:4px 10px;
                        border:1px solid rgba(255,255,255,0.1);
                        border-radius:6px;
                        background:rgba(0,0,0,0.3);
                        color:#fff;
                        font-size:12px;
                        outline:none;
                    ">
                    <select id="logs-level" style="
                        padding:4px 8px;
                        border:1px solid rgba(255,255,255,0.1);
                        border-radius:6px;
                        background:rgba(0,0,0,0.3);
                        color:#fff;
                        font-size:12px;
                        outline:none;
                        cursor:pointer;
                    ">
                        <option value="all">Все</option>
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="warn">Warn</option>
                        <option value="error">Error</option>
                        <option value="success">Success</option>
                    </select>
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    <button id="logs-pause-btn" style="
                        padding:3px 12px;
                        border:1px solid rgba(255,255,255,0.1);
                        border-radius:4px;
                        background:rgba(255,255,255,0.05);
                        color:#8899bb;
                        font-size:11px;
                        cursor:pointer;
                        transition:all 0.2s;
                    ">⏸️ Пауза</button>
                    <button id="logs-clear-btn" style="
                        padding:3px 12px;
                        border:1px solid rgba(255,255,255,0.1);
                        border-radius:4px;
                        background:rgba(255,255,255,0.05);
                        color:#8899bb;
                        font-size:11px;
                        cursor:pointer;
                        transition:all 0.2s;
                    ">🗑️ Очистить</button>
                    <button id="logs-export-btn" style="
                        padding:3px 12px;
                        border:1px solid rgba(255,255,255,0.1);
                        border-radius:4px;
                        background:rgba(255,255,255,0.05);
                        color:#8899bb;
                        font-size:11px;
                        cursor:pointer;
                        transition:all 0.2s;
                    ">📥 Экспорт</button>
                    <button id="logs-follow-btn" style="
                        padding:3px 12px;
                        border:1px solid rgba(0,184,148,0.3);
                        border-radius:4px;
                        background:rgba(0,184,148,0.1);
                        color:#00b894;
                        font-size:11px;
                        cursor:pointer;
                        transition:all 0.2s;
                    ">▶️ Следить</button>
                </div>
            `;
      body.appendChild(controls);
      logsLog('✅ Контролы добавлены', null, 'info');

      // Консоль
      const consoleEl = document.createElement('div');
      consoleEl.id = 'logs-console';
      consoleEl.style.cssText = `
                flex:1;
                background:rgba(0,0,0,0.4);
                border-radius:6px;
                padding:8px;
                overflow-y:auto;
                font-family:'Courier New',monospace;
                font-size:11px;
                line-height:1.5;
                min-height:100px;
                border:1px solid rgba(255,255,255,0.05);
                color:#dfe6e9;
            `;
      consoleEl.innerHTML = `<div class="logs-empty" style="color:#8899bb;text-align:center;padding:20px;font-style:italic;">📭 Логи будут отображаться здесь...</div>`;
      body.appendChild(consoleEl);
      logsLog('✅ Консоль логов добавлена', null, 'info');

      // Статистика
      const stats = document.createElement('div');
      stats.style.cssText = `
                display:flex;
                gap:12px;
                font-size:11px;
                color:#8899bb;
                padding-top:6px;
                border-top:1px solid rgba(255,255,255,0.05);
                flex-wrap:wrap;
                flex-shrink:0;
            `;
      stats.innerHTML = `
                <span>📊 Всего: <b id="logs-total">${logEntries.length}</b></span>
                <span style="color:#ff6b6b;">❌ <b id="logs-errors">${logEntries.filter(e => e.level === LOG_LEVELS.ERROR).length}</b></span>
                <span style="color:#fdcb6e;">⚠️ <b id="logs-warnings">${logEntries.filter(e => e.level === LOG_LEVELS.WARN).length}</b></span>
                <span id="logs-status" style="color:#00b894;">▶️ Активен</span>
            `;
      body.appendChild(stats);
      logsLog('✅ Статистика добавлена', null, 'info');
    }

    // Добавляем панель в DOM
    document.body.appendChild(panel);
    state.panelExists = true;
    state.visible = true;

    logsLog('✅ Панель добавлена в DOM', null, 'success');

    // Настройка обработчиков
    setupHandlers(builder, panel, state, instance);
    logsLog('🔧 Обработчики кнопок настроены', null, 'info');

    setupStateListeners(builder, panel, state);
    logsLog('👂 Слушатели состояния настроены', null, 'info');

    setupDragAndResize(builder, panel, state);
    logsLog('🔄 Перетаскивание и ресайз настроены', null, 'info');

    // Обработчики логов
    const filterInput = document.getElementById('logs-filter');
    if (filterInput) {
      filterInput.addEventListener('input', renderLogs);
      logsLog('🔍 Фильтр логов настроен', null, 'info');
    }

    const levelSelect = document.getElementById('logs-level');
    if (levelSelect) {
      levelSelect.addEventListener('change', renderLogs);
      logsLog('📊 Фильтр по уровню настроен', null, 'info');
    }

    const pauseBtn = document.getElementById('logs-pause-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        isPaused = !isPaused;
        const btn = document.getElementById('logs-pause-btn');
        const badge = document.getElementById('logs-status-badge');
        const status = document.getElementById('logs-status');
        btn.textContent = isPaused ? '▶️ Возобновить' : '⏸️ Пауза';
        if (badge) {
          badge.textContent = isPaused ? '⏸️ Пауза' : '▶️ Активен';
          badge.style.background = isPaused ? 'rgba(253,203,110,0.2)' : 'rgba(0,184,148,0.2)';
          badge.style.color = isPaused ? '#fdcb6e' : '#00b894';
        }
        if (status) {
          status.textContent = isPaused ? '⏸️ Пауза' : '▶️ Активен';
          status.style.color = isPaused ? '#fdcb6e' : '#00b894';
        }
        logsLog(`⏸️ Пауза: ${isPaused ? 'включена' : 'выключена'}`, null, 'info');
        bringToFront(panel);
      });
      logsLog('⏸️ Кнопка паузы настроена', null, 'info');
    }

    const clearBtn = document.getElementById('logs-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        logEntries = [];
        renderLogs();
        updateLogStats();
        logsLog('🗑️ Логи очищены', null, 'info');
        bringToFront(panel);
      });
      logsLog('🗑️ Кнопка очистки настроена', null, 'info');
    }

    const exportBtn = document.getElementById('logs-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        const data = JSON.stringify(logEntries, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        logsLog(`📥 Экспортировано ${logEntries.length} записей`, null, 'info');
        bringToFront(panel);
      });
      logsLog('📥 Кнопка экспорта настроена', null, 'info');
    }

    const followBtn = document.getElementById('logs-follow-btn');
    if (followBtn) {
      followBtn.addEventListener('click', function () {
        isFollowing = !isFollowing;
        const btn = document.getElementById('logs-follow-btn');
        btn.textContent = isFollowing ? '▶️ Следить' : '⏹️ Не следить';
        btn.style.borderColor = isFollowing ? 'rgba(0,184,148,0.3)' : 'rgba(255,255,255,0.1)';
        btn.style.background = isFollowing ? 'rgba(0,184,148,0.1)' : 'rgba(255,255,255,0.05)';
        btn.style.color = isFollowing ? '#00b894' : '#8899bb';
        if (isFollowing) {
          const consoleEl = document.getElementById('logs-console');
          consoleEl.scrollTop = consoleEl.scrollHeight;
        }
        logsLog(`📌 Слежение: ${isFollowing ? 'включено' : 'выключено'}`, null, 'info');
        bringToFront(panel);
      });
      logsLog('📌 Кнопка слежения настроена', null, 'info');
    }

    // Устанавливаем флаг готовности панели
    isPanelReady = true;
    logsLog('✅ Панель готова к работе', null, 'success');

    // Устанавливаем перехват console (только один раз)
    hookConsole();

    state.isReady = true;

    logsSeparator();
    logsLog('✅ Logs Control Panel создана и показана!', null, 'success');
    logsLog(`📐 Размер: ${state.size?.width || 380}x${state.size?.height || 520}`, null, 'info');
    logsLog(`📍 Позиция: ${state.position?.x || 20}, ${state.position?.y || 20}`, null, 'info');
    logsLog(`📌 Z-Index: ${state.zIndex || 99996}`, null, 'info');
    logsLog(`📌 Свернута: ${state.minimized ? 'Да' : 'Нет'}`, null, 'info');
    logsLog(`📌 Полноэкранный: ${state.fullscreen ? 'Да' : 'Нет'}`, null, 'info');
    logsLog(`📌 Экземпляр: ${instance.id || 'unknown'}`, null, 'info');
    logsLog(`📌 Всего логов: ${logEntries.length}`, null, 'info');
    logsLog(`📌 Тип панели: logs`, null, 'type');

    // Рендерим существующие логи
    renderLogs();
    updateLogStats();
    logsLog('📊 Логи отрендерены', null, 'info');

    // Добавляем приветственные логи
    setTimeout(() => {
      addLogEntry(LOG_LEVELS.INFO, '✅ Панель логов запущена');
      addLogEntry(LOG_LEVELS.INFO, '📝 Все console.log() теперь отображаются здесь');
      addLogEntry(LOG_LEVELS.DEBUG, '🔍 Поддерживаются форматтеры: %s, %d, %j, %c', 'строка', 42, {
        test: 'объект',
      });
      addLogEntry(LOG_LEVELS.INFO, '📌 Кнопки: ─ Свернуть | ⧉ Развернуть | ✕ Закрыть');
      addLogEntry(LOG_LEVELS.INFO, '💡 Двойной клик по шапке - полноэкранный режим');
      addLogEntry(LOG_LEVELS.INFO, `📌 Инстанс: ${instanceId.slice(-8)}`);
      logsLog('👋 Приветственные логи добавлены', null, 'info');
    }, 100);

    // Экспортируем в глобальный объект
    window.__logsPanel = {
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
        logsLog('👁️ Панель показана', null, 'info');
      },
      hide: function () {
        panel.style.transform = 'scale(0.95)';
        panel.style.opacity = '0';
        setTimeout(() => {
          panel.style.display = 'none';
        }, 300);
        state.visible = false;
        logsLog('🙈 Панель скрыта', null, 'info');
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
        logsLog('🎯 Панель на переднем плане', null, 'info');
      },
      minimize: function () {
        const minBtn = builder.get('env-minimize-btn');
        if (minBtn) minBtn.click();
      },
      maximize: function () {
        const maxBtn = builder.get('env-maximize-btn');
        if (maxBtn) maxBtn.click();
      },
      fullscreen: function () {
        if (state.fullscreen) {
          state.fullscreen = false;
        } else {
          state.fullscreen = true;
        }
        logsLog(
          `🖥️ Полноэкранный режим: ${state.fullscreen ? 'включен' : 'выключен'}`,
          null,
          'info'
        );
      },
      addLog: addLogEntry,
      getLogs: function () {
        logsLog(`📊 Получено ${logEntries.length} записей логов`, null, 'info');
        return logEntries;
      },
      clearLogs: function () {
        logEntries = [];
        renderLogs();
        updateLogStats();
        logsLog('🗑️ Логи очищены через API', null, 'info');
      },
      getState: function () {
        return {
          visible: panel.style.display !== 'none',
          minimized: state.minimized || false,
          fullscreen: state.fullscreen || false,
          zIndex: parseInt(panel.style.zIndex) || 99996,
          logCount: logEntries.length,
          size: { width: panel.offsetWidth, height: panel.offsetHeight },
          position: {
            left: parseInt(panel.style.left) || 20,
            top: parseInt(panel.style.top) || 20,
          },
        };
      },
      isPaused: function () {
        return isPaused;
      },
      isFollowing: function () {
        return isFollowing;
      },
      setPause: function (paused) {
        isPaused = paused;
        updateLogStats();
        logsLog(`⏸️ Пауза установлена: ${paused}`, null, 'info');
      },
      setFollow: function (follow) {
        isFollowing = follow;
        const btn = document.getElementById('logs-follow-btn');
        if (btn) {
          btn.textContent = follow ? '▶️ Следить' : '⏹️ Не следить';
          btn.style.borderColor = follow ? 'rgba(0,184,148,0.3)' : 'rgba(255,255,255,0.1)';
          btn.style.background = follow ? 'rgba(0,184,148,0.1)' : 'rgba(255,255,255,0.05)';
          btn.style.color = follow ? '#00b894' : '#8899bb';
        }
        if (follow) {
          const consoleEl = document.getElementById('logs-console');
          consoleEl.scrollTop = consoleEl.scrollHeight;
        }
        logsLog(`📌 Слежение установлено: ${follow}`, null, 'info');
      },
      destroy: function () {
        // Удаляем панель
        if (panel && panel.parentNode) {
          panel.parentNode.removeChild(panel);
          logsLog('🗑️ Панель удалена из DOM', null, 'info');
        }
        // Очищаем логи
        logEntries = [];
        isPanelReady = false;
        // Удаляем ссылку
        if (window.__logsPanel) {
          delete window.__logsPanel;
        }
        logsLog('🗑️ Logs Panel уничтожена', null, 'info');
      },
    };

    logsSeparator();
    logsLog('📋 Управление панелью через __logsPanel:', null, 'header');
    logsLog('  __logsPanel.show()       - показать панель', null, 'info');
    logsLog('  __logsPanel.hide()       - скрыть панель', null, 'info');
    logsLog('  __logsPanel.toggle()     - переключить', null, 'info');
    logsLog('  __logsPanel.focus()      - вывести на передний план', null, 'info');
    logsLog('  __logsPanel.minimize()   - свернуть', null, 'info');
    logsLog('  __logsPanel.maximize()   - развернуть', null, 'info');
    logsLog('  __logsPanel.fullscreen() - переключить полноэкранный режим', null, 'info');
    logsLog('  __logsPanel.addLog()     - добавить лог', null, 'info');
    logsLog('  __logsPanel.getLogs()    - получить все логи', null, 'info');
    logsLog('  __logsPanel.clearLogs()  - очистить логи', null, 'info');
    logsLog('  __logsPanel.getState()   - получить состояние', null, 'info');
    logsLog('  __logsPanel.isPaused()   - статус паузы', null, 'info');
    logsLog('  __logsPanel.isFollowing() - статус слежения', null, 'info');
    logsLog('  __logsPanel.setPause()   - установить паузу', null, 'info');
    logsLog('  __logsPanel.setFollow()  - установить слежение', null, 'info');
    logsLog('  __logsPanel.destroy()    - уничтожить панель', null, 'info');
    logsSeparator();

    logsLog('✅ Logs Panel полностью готова', null, 'success');
    logsHeader('ГОТОВ');

    return state;
  } catch (error) {
    logsLog('❌ Ошибка при создании logs панели:', error.message, 'error');
    logsLog('  📚 Stack:', error.stack, 'error');
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
// 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function bringToFront(element) {
  const allWindows = document.querySelectorAll(
    '.widget-window, #widget-app, #logs-control-panel, #debug-control-panel, #debug-control-panel-v2, #env-control-panel'
  );
  let maxZ = 99999;

  allWindows.forEach(win => {
    if (win !== element && win.style.display !== 'none') {
      const z = parseInt(win.style.zIndex) || 0;
      if (z > maxZ) maxZ = z;
    }
  });

  const newZ = maxZ + 1;
  element.style.zIndex = newZ;

  allWindows.forEach(win => {
    win.classList.remove('active-window');
  });
  element.classList.add('active-window');
}

function setupHandlers(builder, panel, state, instance) {
  logsLog('🔧 Настройка обработчиков кнопок...', null, 'info');

  const minimizeBtn = builder.get('env-minimize-btn');
  if (minimizeBtn) {
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
      logsLog(`📐 Минимизация: ${state.minimized ? 'включена' : 'выключена'}`, null, 'info');
    });
    logsLog('✅ Minimize btn настроен', null, 'info');
  }

  const maximizeBtn = builder.get('env-maximize-btn');
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      state.fullscreen = !state.fullscreen;
      logsLog(`🖥️ Полноэкранный режим: ${state.fullscreen ? 'включен' : 'выключен'}`, null, 'info');
    });
    logsLog('✅ Maximize btn настроен', null, 'info');
  }

  const closeBtn = builder.get('env-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      state.visible = false;
      const panel = document.getElementById('logs-control-panel');
      if (panel) {
        panel.style.opacity = '0';
        panel.style.transform = 'scale(0.95)';
        setTimeout(() => {
          panel.style.display = 'none';
        }, 300);
      }
      logsLog('🚪 Панель закрыта', null, 'info');
    });
    logsLog('✅ Close btn настроен', null, 'info');
  }

  const header = builder.get('env-panel-header');
  if (header) {
    header.addEventListener('dblclick', function (e) {
      if (e.target.closest('.panel-controls')) return;
      if (maximizeBtn) maximizeBtn.click();
      logsLog('🔄 Двойной клик по шапке', null, 'info');
    });
    logsLog('✅ Dblclick на шапке настроен', null, 'info');
  }

  // ✅ НОВЫЙ ОБРАБОТЧИК: КЛИК ПО ВСЕЙ ПАНЕЛИ ДЛЯ ПОДНЯТИЯ Z-INDEX
  // Вешаем событие на всю панель, а не только на шапку
  panel.addEventListener('mousedown', function (e) {
    // Исключаем интерактивные элементы, чтобы не мешать их работе
    if (e.target.closest('.panel-controls')) return;
    if (e.target.closest('button')) return;
    if (e.target.closest('input')) return;
    if (e.target.closest('select')) return;
    if (e.target.closest('textarea')) return;
    if (e.target.closest('.ctrl-btn')) return;
    if (e.target.closest('.close-btn')) return;

    // Выводим панель на передний план
    bringToFront(panel);
    logsLog('🎯 Панель выведена на передний план (клик по телу)', null, 'debug');
  });

  logsLog('✅ Обработчик mousedown на всей панели настроен', null, 'success');
  logsLog('✅ Все обработчики настроены', null, 'success');
}

function setupStateListeners(builder, panel, state) {
  logsLog('👂 Настройка слушателей состояния...', null, 'info');

  state.on('minimized', function (e) {
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
    }
    const minBtn = builder.get('env-minimize-btn');
    if (minBtn) minBtn.textContent = e.value ? '□' : '─';
  });

  state.on('fullscreen', function (e) {
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
    }
    const maxBtn = builder.get('env-maximize-btn');
    if (maxBtn) maxBtn.textContent = e.value ? '⧉' : '□';
  });

  state.on('visible', function (e) {
    if (e.value) {
      panel.style.display = 'flex';
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.transform = 'scale(1)';
        panel.style.opacity = '1';
      }, 50);
    } else {
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);
    }
  });

  logsLog('✅ Слушатели состояния настроены', null, 'success');
}

function setupDragAndResize(builder, panel, state) {
  logsLog('🔄 Настройка перетаскивания и ресайза...', null, 'info');

  const header = builder.get('env-panel-header');
  const resizeHandle = builder.get('env-panel-resize');

  let isDragging = false;
  let dragStartX = 0,
    dragStartY = 0;
  let panelStartX = 0,
    panelStartY = 0;
  let rafId = null;

  if (header) {
    header.addEventListener('mousedown', function (e) {
      if (e.target.closest('.panel-controls')) return;
      if (state.fullscreen) return;
      if (e.button !== 0) return;

      e.preventDefault();
      isDragging = true;
      logsLog('🖱️ Начало перетаскивания', null, 'info');

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
      logsLog('🖱️ Перетаскивание завершено', null, 'info');
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
    resizeHandle.addEventListener('mousedown', function (e) {
      if (state.fullscreen) return;
      e.stopPropagation();
      e.preventDefault();

      isResizing = true;
      logsLog('📐 Начало ресайза', null, 'info');

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
      logsLog('📐 Ресайз завершён', null, 'info');
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

  logsLog('✅ Перетаскивание и ресайз настроены', null, 'success');
}

// ============================================================
// 8. ЭКСПОРТ
// ============================================================

export { getInstance, getGlobalState, getEnv };

logsLog('📋 ./src/logs-panel.js загружен (архитектура как в env-panel.js)', null, 'success');
logsLog('📌 Для запуска используйте: window.__logsPanel.toggle()', null, 'info');
