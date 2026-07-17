// bookmarklet.js - Точка входа с правильными путями
// ОБНОВЛЕНО: Исправлены пути к модулям (убрано дублирование Bookmarklet)

// ============================================================
// 1. НЕЙМСПЕЙС-ДЕБАГГЕР
// ============================================================

const DEBUG_NAMESPACE = 'bookmarklet';
const DEBUG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4,
};

let currentLogLevel = DEBUG_LEVELS.DEBUG;

const LOG_COLORS = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  namespace: 'color: #667eea; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  trace: 'color: #dfe6e9;',
  separator: 'color: #636e72;',
  stage: 'color: #fd79a8; font-weight: bold;',
  data: 'color: #fdcb6e;',
  timer: 'color: #55efc4;',
  cleanup: 'color: #ff7675; font-weight: bold;',
};

let stageCounter = 0;
let startTime = Date.now();
const stageHistory = [];

function getTimestamp() {
  return new Date().toISOString().slice(11, 23);
}

function getElapsed() {
  return ((Date.now() - startTime) / 1000).toFixed(3);
}

function debugLog(message, data = null, level = 'info', component = 'core') {
  const levelValue =
    typeof level === 'string' ? DEBUG_LEVELS[level.toUpperCase()] || DEBUG_LEVELS.INFO : level;
  if (levelValue > currentLogLevel) return;

  const timestamp = getTimestamp();
  const elapsed = getElapsed();
  const prefix = `%c[${timestamp}] %c[${elapsed}s] %c[${DEBUG_NAMESPACE}] %c[${component}]`;
  const styles = [LOG_COLORS.info, LOG_COLORS.timer, LOG_COLORS.namespace, LOG_COLORS.trace];

  if (data !== null && data !== undefined) {
    console.log(prefix + ' %c' + message, ...styles, LOG_COLORS[level] || LOG_COLORS.info, data);
  } else {
    console.log(prefix + ' %c' + message, ...styles, LOG_COLORS[level] || LOG_COLORS.info);
  }
}

function debugStage(title, data = null) {
  stageCounter++;
  const stageId = String(stageCounter).padStart(3, '0');
  const timestamp = getTimestamp();
  const elapsed = getElapsed();

  const entry = { id: stageId, title: title, timestamp: timestamp, elapsed: elapsed, data: data };
  stageHistory.push(entry);

  console.log('%c' + '═'.repeat(60), LOG_COLORS.separator);
  console.log(
    `%c[${timestamp}] %c[${elapsed}s] %c[${DEBUG_NAMESPACE}] %c📌 СТАДИЯ ${stageId}: ${title}`,
    LOG_COLORS.info,
    LOG_COLORS.timer,
    LOG_COLORS.namespace,
    LOG_COLORS.stage
  );
  if (data) {
    console.log(`  %c📊 Данные:`, LOG_COLORS.data, data);
  }
  console.log('%c' + '─'.repeat(60), LOG_COLORS.separator);
  return stageId;
}

function debugHeader(title) {
  console.log('%c' + '═'.repeat(60), LOG_COLORS.separator);
  console.log(`%c  📦 ${title}`, LOG_COLORS.header);
  console.log('%c' + '═'.repeat(60), LOG_COLORS.separator);
}

function debugSeparator() {
  console.log('%c' + '─'.repeat(60), LOG_COLORS.separator);
}

function debugSummary() {
  console.log('%c' + '═'.repeat(60), LOG_COLORS.separator);
  console.log('%c  📊 ИТОГОВАЯ СТАТИСТИКА', LOG_COLORS.header);
  console.log('%c' + '═'.repeat(60), LOG_COLORS.separator);
  console.log(`  📌 Всего этапов: ${stageHistory.length}`);
  console.log(`  ⏱️  Общее время: ${getElapsed()}s`);
  console.log(`  📋 Этапы:`);
  stageHistory.forEach((s, i) => {
    console.log(`    ${String(i + 1).padStart(3)}. ${s.title} (${s.elapsed}s)`);
  });
  console.log('%c' + '═'.repeat(60), LOG_COLORS.separator);
}

function setupLogLevel() {
  try {
    const params = new URLSearchParams(window.location.search);
    const level = params.get('debug-level');
    if (level) {
      const levelKey = level.toUpperCase();
      if (DEBUG_LEVELS[levelKey] !== undefined) {
        currentLogLevel = DEBUG_LEVELS[levelKey];
        debugLog(`🔊 Уровень логирования установлен: ${level}`, null, 'info', 'config');
      }
    }
    const savedLevel = localStorage.getItem('bookmarklet-debug-level');
    if (savedLevel) {
      const levelKey = savedLevel.toUpperCase();
      if (DEBUG_LEVELS[levelKey] !== undefined) {
        currentLogLevel = DEBUG_LEVELS[levelKey];
        debugLog(`🔊 Уровень логирования из localStorage: ${savedLevel}`, null, 'info', 'config');
      }
    }
  } catch (e) {
    // Игнорируем ошибки парсинга
  }
}

// ============================================================
// 2. МЕНЕДЖЕР Z-INDEX
// ============================================================

const ZIndexManager = {
  _baseZIndex: 99996,
  _maxZIndex: 99996,
  _elements: new Map(),

  register(element, type = 'panel') {
    if (!element) return;
    const id = element.id || `el-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    if (!element.id) element.id = id;

    const zIndex = ++this._baseZIndex;
    element.style.zIndex = zIndex;
    this._elements.set(id, { element, zIndex, type });
    this._maxZIndex = Math.max(this._maxZIndex, zIndex);

    debugLog(`📌 Зарегистрирован элемент: ${id} (z-index: ${zIndex})`, null, 'debug', 'zindex');
    return zIndex;
  },

  bringToFront(element) {
    if (!element) return;
    const id = element.id;
    const entry = this._elements.get(id);

    if (!entry) {
      return this.register(element);
    }

    const newZ = ++this._maxZIndex;
    entry.element.style.zIndex = newZ;
    entry.zIndex = newZ;
    this._elements.set(id, entry);

    debugLog(`⬆ Элемент на передний план: ${id} (z-index: ${newZ})`, null, 'debug', 'zindex');
    return newZ;
  },

  getZIndex(element) {
    if (!element) return 0;
    const id = element.id;
    const entry = this._elements.get(id);
    return entry ? entry.zIndex : parseInt(element.style.zIndex) || 0;
  },

  unregister(element) {
    if (!element) return;
    const id = element.id;
    if (this._elements.has(id)) {
      this._elements.delete(id);
      debugLog(`🗑️ Элемент удалён из ZIndexManager: ${id}`, null, 'debug', 'zindex');
    }
  },

  getMaxZIndex() {
    return this._maxZIndex;
  },

  getStats() {
    return {
      total: this._elements.size,
      maxZIndex: this._maxZIndex,
      baseZIndex: this._baseZIndex,
      elements: Array.from(this._elements.keys()),
    };
  },
};

// ============================================================
// 3. ЗАПРОС К РАСШИРЕНИЮ
// ============================================================

function requestExtensionData(timeout = 3000) {
  return new Promise(resolve => {
    debugLog('📡 Запрос данных от расширения...', null, 'info', 'extension');

    let resolved = false;
    let timeoutId = null;

    function handleResponse(event) {
      if (
        event.data &&
        event.data.source === 'my-extension-bridge' &&
        event.data.type === 'BOOKMARK_DATA_RESPONSE'
      ) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          window.removeEventListener('message', handleResponse);
          debugLog('✅ Данные получены от расширения:', event.data.payload, 'success', 'extension');
          resolve({ success: true, data: event.data.payload });
        }
      }
    }

    window.addEventListener('message', handleResponse);

    window.postMessage(
      {
        source: 'my-bookmarklet',
        type: 'REQUEST_BOOKMARK_DATA',
        currentUrl: window.location.href,
        tabId: Date.now(),
      },
      '*'
    );

    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener('message', handleResponse);
        debugLog('⏱️ Таймаут запроса к расширению', null, 'warn', 'extension');
        resolve({ success: false, error: 'timeout' });
      }
    }, timeout);
  });
}

// ============================================================
// 4. FALLBACK ОКНО
// ============================================================

function showExtensionFallback() {
  debugLog('🔔 Показ fallback окна', null, 'info', 'fallback');

  const existing = document.getElementById('extension-fallback-overlay');
  if (existing) {
    existing.style.display = 'flex';
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'extension-fallback-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 999999;
    animation: fadeInOverlay 0.3s ease;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: rgba(26, 26, 46, 0.96);
    border-radius: 16px;
    padding: 40px 35px;
    max-width: 480px;
    width: 90%;
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 25px 80px rgba(0,0,0,0.8);
    animation: slideUpModal 0.4s ease;
    color: #fff;
    font-family: 'Segoe UI', system-ui, sans-serif;
  `;

  modal.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-size: 48px; margin-bottom: 12px;">🔌</div>
      <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0; color: #fff;">Требуется расширение</h2>
      <p style="color: #8899bb; font-size: 14px; line-height: 1.6; margin: 0;">
        Для работы букмарклета необходимо установить расширение 
        <strong style="color: #667eea;">Bookmarklet Bridge</strong>.
      </p>
    </div>

    <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 16px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: #8899bb;">Статус</span>
        <span style="color: #ff6b6b;">❌ Не обнаружено</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 4px 0;">
        <span style="color: #8899bb;">Требуется</span>
        <span style="color: #667eea;">Bookmarklet Bridge v2.0+</span>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px;">
      <button id="fallback-install-btn" style="
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        border: none;
        border-radius: 10px;
        color: #fff;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
      ">📥 Установить расширение</button>
      
      <button id="fallback-retry-btn" style="
        padding: 10px 20px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        color: #8899bb;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s;
      ">🔄 Проверить снова</button>
      
      <button id="fallback-continue-btn" style="
        padding: 10px 20px;
        background: transparent;
        border: none;
        color: #636e72;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.3s;
      ">Продолжить без расширения</button>
    </div>

    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: #636e72; text-align: center;">
      💡 Расширение нужно для получения данных о закладках
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOverlay {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUpModal {
      from { opacity: 0; transform: translateY(30px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(style);

  document.getElementById('fallback-install-btn')?.addEventListener('click', () => {
    window.open('https://chrome.google.com/webstore/detail/bookmarklet-bridge', '_blank');
  });

  document.getElementById('fallback-retry-btn')?.addEventListener('click', async () => {
    overlay.style.display = 'none';
    const result = await requestExtensionData(3000);
    if (result.success) {
      overlay.remove();
      debugLog('✅ Расширение обнаружено при повторной проверке', null, 'success', 'fallback');
      runMain();
    } else {
      overlay.style.display = 'flex';
      debugLog('❌ Расширение всё ещё не обнаружено', null, 'warn', 'fallback');
    }
  });

  document.getElementById('fallback-continue-btn')?.addEventListener('click', () => {
    overlay.remove();
    debugLog('ℹ️ Продолжение без расширения', null, 'info', 'fallback');
    runMain();
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      // Не закрываем по клику вне модалки
    }
  });
}

// ============================================================
// 5. ПРОВЕРКА SERVICE WORKER
// ============================================================

async function ensureServiceWorker() {
  debugLog('📦 Проверка Service Worker...', null, 'info', 'sw');

  if (!('serviceWorker' in navigator)) {
    debugLog('❌ Service Workers не поддерживаются', null, 'error', 'sw');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration && registration.active) {
      debugLog('✅ Service Worker уже активен', null, 'success', 'sw');
      return true;
    }

    debugLog('🔄 Регистрация Service Worker...', null, 'info', 'sw');
    const newRegistration = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
    });

    await new Promise(resolve => {
      if (newRegistration.active) {
        resolve();
      } else {
        newRegistration.addEventListener('statechange', function onStateChange() {
          debugLog(`  📌 Состояние SW: ${this.state}`, null, 'trace', 'sw');
          if (this.state === 'activated') {
            resolve();
            this.removeEventListener('statechange', onStateChange);
          }
        });
      }
    });

    debugLog('✅ Service Worker зарегистрирован и активирован', null, 'success', 'sw');
    return true;
  } catch (error) {
    debugLog(`❌ Ошибка регистрации Service Worker: ${error.message}`, error, 'error', 'sw');
    return false;
  }
}

// ============================================================
// 6. ЗАГРУЗКА ПАНЕЛИ
// ============================================================

async function loadPanel(panelName, panelPath, instance, isMain = false, retries = 3) {
  debugLog(`🔄 Загрузка панели: ${panelName}...`, { path: panelPath }, 'info', 'loader');

  let attempt = 0;
  let lastError = null;

  while (attempt < retries) {
    attempt++;
    debugLog(`  📌 Попытка ${attempt}/${retries}`, null, 'trace', 'loader');

    try {
      if (isMain) {
        const oldPanel = document.getElementById('env-control-panel');
        if (oldPanel) {
          oldPanel.remove();
          debugLog(`  🗑️ Старая панель ${panelName} удалена`, null, 'trace', 'loader');
        }
      }

      const timer = debugTimer ? debugTimer(`Импорт ${panelName}`) : null;
      debugLog(`  📦 Импорт модуля: ${panelPath}`, null, 'trace', 'loader');

      const module = await import(panelPath);
      if (timer) timer.end('(импорт завершён)');

      if (module && module.default) {
        debugLog(
          `  🔧 Вызов module.default(${instance ? 'instance' : 'null'})`,
          null,
          'trace',
          'loader'
        );
        const result = await module.default(instance);
        debugLog(`✅ Панель ${panelName} загружена`, null, 'success', 'loader');
        return result;
      } else {
        debugLog(`  ⚠️ Модуль не имеет default экспорта`, null, 'warn', 'loader');
        throw new Error('Модуль не имеет default экспорта');
      }
    } catch (error) {
      lastError = error;
      debugLog(
        `⚠️ Ошибка загрузки ${panelName} (попытка ${attempt}): ${error.message}`,
        error,
        'warn',
        'loader'
      );

      if (attempt < retries) {
        debugLog(`  🔄 Повтор через 200ms...`, null, 'info', 'loader');
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  debugLog(
    `❌ Панель ${panelName} не загружена после ${retries} попыток`,
    lastError,
    'error',
    'loader'
  );
  return null;
}

// ============================================================
// 7. ПОЛУЧЕНИЕ ИЛИ СОЗДАНИЕ ЭКЗЕМПЛЯРА
// ============================================================

async function getOrCreateInstance() {
  debugLog('📦 Проверка существующего экземпляра...', null, 'info', 'instance');

  const existingInstance = window.__bookmarkletInstance || window.R;
  if (existingInstance && existingInstance.getState) {
    debugLog('♻️ Используем существующий экземпляр', null, 'success', 'instance');
    return existingInstance;
  }

  debugLog('🆕 Создание нового экземпляра...', null, 'info', 'instance');

  try {
    // Пытаемся загрузить LocalInstance
    try {
      const { default: LocalInstance } = await import('./core/LocalInstance.js');
      const instance = new LocalInstance({
        name: 'Bookmarklet Manager',
      });

      instance.id = 'bookmarklet-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
      window.__bookmarkletInstance = instance;
      window.R = instance;

      debugLog('✅ Локальный экземпляр создан', { id: instance.id }, 'success', 'instance');
      return instance;
    } catch (error) {
      debugLog(`⚠️ LocalInstance не загружен: ${error.message}`, null, 'warn', 'instance');
      // Создаём простой объект-заглушку
      const instance = {
        id: 'bookmarklet-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        name: 'Bookmarklet Manager',
        created: new Date().toISOString(),
        getState: () => window.__globalState || null,
        togglePanel: () => {
          const panel = document.getElementById('env-control-panel');
          if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
          }
        },
      };
      window.__bookmarkletInstance = instance;
      window.R = instance;
      debugLog('✅ Создан экземпляр-заглушка', { id: instance.id }, 'success', 'instance');
      return instance;
    }
  } catch (error) {
    debugLog(`❌ Ошибка создания экземпляра: ${error.message}`, error, 'error', 'instance');
    return null;
  }
}

// ============================================================
// 8. ОСНОВНАЯ ФУНКЦИЯ ЗАПУСКА
// ============================================================

async function runMain() {
  debugHeader('ЗАПУСК БУКМАРКЛЕТА');
  debugLog('🚀 Запуск букмарклета...', null, 'info', 'main');

  // Проверяем, не запущен ли уже букмарклет
  if (window.__bookmarkletInstance && window.__bookmarkletInstance.getState) {
    const state = window.__bookmarkletInstance.getState();
    if (state && state.togglePanel) {
      debugLog('🔄 Букмарклет уже запущен, переключение панели', null, 'info', 'main');
      window.__bookmarkletInstance.togglePanel();
      return;
    }
  }

  // ============================================================
  // ОЧИСТКА СТАРЫХ ПАНЕЛЕЙ
  // ============================================================

  const panels = document.querySelectorAll(
    '#env-control-panel, #logs-control-panel, #debug-control-panel-v2'
  );
  panels.forEach(panel => {
    if (panel.parentNode) {
      panel.parentNode.removeChild(panel);
      debugLog(`🗑️ Удалена старая панель: ${panel.id}`, null, 'debug', 'main');
    }
  });

  // ============================================================
  // ЗАПРОС К РАСШИРЕНИЮ
  // ============================================================

  const extResult = await requestExtensionData(3000);

  if (!extResult.success) {
    debugLog('⚠️ Расширение не обнаружено, показываем fallback', null, 'warn', 'main');
    showExtensionFallback();
  } else {
    debugLog('✅ Расширение обнаружено, данные получены', null, 'success', 'main');
    window.__bookmarkData = extResult.data;
  }

  // ============================================================
  // SERVICE WORKER
  // ============================================================

  await ensureServiceWorker();

  // ============================================================
  // СОЗДАНИЕ ЭКЗЕМПЛЯРА
  // ============================================================

  const instance = await getOrCreateInstance();
  if (!instance) {
    debugLog('❌ Не удалось создать экземпляр', null, 'error', 'main');
    return;
  }

  // ============================================================
  // ЗАГРУЗКА ENV PANEL (ПРАВИЛЬНЫЙ ПУТЬ!)
  // ============================================================

  try {
    debugLog('📦 Загрузка env-panel.js...', null, 'info', 'main');

    // ПРАВИЛЬНЫЙ ПУТЬ: ./src/env-panel.js (без дублирования!)
    const { default: envPanel } = await import('./src/env-panel.js');

    const result = await envPanel(instance);

    if (result) {
      debugLog('✅ ENV Panel успешно загружена', null, 'success', 'main');
    } else {
      debugLog('⚠️ ENV Panel не загружена', null, 'warn', 'main');
    }
  } catch (error) {
    debugLog(`❌ Ошибка загрузки ENV Panel: ${error.message}`, error, 'error', 'main');

    // Показываем ошибку
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
    `;
    errorDiv.innerHTML = `
      <strong>❌ Ошибка:</strong><br>
      ${error.message}
      <br><br>
      <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;">Закрыть</button>
    `;
    document.body.appendChild(errorDiv);
  }

  // ============================================================
  // ЗАГРУЗКА ДОПОЛНИТЕЛЬНЫХ ПАНЕЛЕЙ (в фоне)
  // ============================================================

  setTimeout(async () => {
    try {
      debugLog('📦 Загрузка logs-panel.js (фон)...', null, 'info', 'main');
      const { default: logsPanel } = await import('./src/logs-panel.js');
      await logsPanel(instance);
      debugLog('✅ Logs Panel загружена в фоне', null, 'success', 'main');
    } catch (error) {
      debugLog(`⚠️ Logs Panel не загружена: ${error.message}`, null, 'warn', 'main');
    }
  }, 500);

  setTimeout(async () => {
    try {
      debugLog('📦 Загрузка debug-panel.js (фон)...', null, 'info', 'main');
      const { default: debugPanel } = await import('./src/debug-panel.js');
      await debugPanel(instance);
      debugLog('✅ Debug Panel загружена в фоне', null, 'success', 'main');
    } catch (error) {
      debugLog(`⚠️ Debug Panel не загружена: ${error.message}`, null, 'warn', 'main');
    }
  }, 800);

  debugLog('✅ Букмарклет запущен', null, 'success', 'main');
}

// ============================================================
// 9. ЗАПУСК БУКМАРКЛЕТА
// ============================================================

// Настройка уровня логирования
setupLogLevel();

// Предотвращаем множественный запуск
if (!window.__bookmarkletRunning) {
  window.__bookmarkletRunning = true;

  // Небольшая задержка для стабилизации DOM
  setTimeout(() => {
    runMain().catch(error => {
      debugLog(`❌ Критическая ошибка: ${error.message}`, error, 'error', 'main');
      window.__bookmarkletRunning = false;
    });
  }, 100);
} else {
  debugLog('⚠️ Букмарклет уже запускается', null, 'warn', 'main');
}

// ============================================================
// 10. ЭКСПОРТЫ
// ============================================================

window.__bookmarklet = {
  version: '2.0.0',
  run: runMain,
  ZIndexManager,
  requestExtensionData,
  showExtensionFallback,
  ensureServiceWorker,
  debugLog,
  debugStage,
  debugHeader,
  debugSeparator,
  debugSummary,
  getStageHistory: () => [...stageHistory],
  setLogLevel: level => {
    const levelKey = level.toUpperCase();
    if (DEBUG_LEVELS[levelKey] !== undefined) {
      currentLogLevel = DEBUG_LEVELS[levelKey];
      localStorage.setItem('bookmarklet-debug-level', level);
      debugLog(`🔊 Уровень логирования изменён: ${level}`, null, 'info', 'config');
      return true;
    }
    return false;
  },
  getLogLevel: () => {
    const levels = Object.keys(DEBUG_LEVELS);
    return levels.find(k => DEBUG_LEVELS[k] === currentLogLevel) || 'unknown';
  },
};

debugLog(
  '📦 Bookmarklet загружен',
  {
    version: '2.0.0',
    commands: [
      'window.__bookmarklet.run()',
      'window.__bookmarklet.setLogLevel("DEBUG")',
      'window.__bookmarklet.ZIndexManager.getStats()',
    ],
  },
  'success',
  'init'
);
