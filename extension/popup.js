// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/popup.js
// ИСПРАВЛЕНО: Добавлена функция preloadFavicons

// ============================================================
// 1. СОСТОЯНИЕ
// ============================================================

const STATE = {
  settings: {
    bridgeEnabled: true,
    autoRespond: true,
    timeout: 5000,
    cacheTTL: 30,
    debugMode: false,
    logLevel: 'info',
    maxLogs: 100,
  },
  stats: {
    requests: 0,
    success: 0,
    errors: 0,
    cacheSize: 0,
  },
  logs: [],
  bookmarks: [],
  allBookmarks: [],
  bookmarklets: [],
  folders: [],
  filteredBookmarks: [],
  isOpen: true,
  initialized: false,
};

// ============================================================
// 2. ЛОГГЕР
// ============================================================

function addLog(level, message, data = null) {
  try {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const levelIndex = levels.indexOf(level);
    const currentLevel = STATE.settings.logLevel;
    const currentIndex = levels.indexOf(currentLevel);

    if (levelIndex > currentIndex) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: data ? JSON.stringify(data) : null,
    };

    STATE.logs.unshift(entry);
    if (STATE.logs.length > STATE.settings.maxLogs) {
      STATE.logs.pop();
    }

    renderLogs();
    saveState();

    chrome.runtime
      .sendMessage({
        action: 'log_update',
        level,
        message,
        data,
      })
      .catch(() => {});
  } catch (e) {
    // Игнорируем ошибки логирования
  }
}

// ============================================================
// 3. РАБОТА С ХРАНИЛИЩЕМ
// ============================================================

const STORAGE_KEY = 'bookmarklet-bridge-state';

function saveState() {
  try {
    const data = {
      settings: STATE.settings,
      stats: STATE.stats,
      logs: STATE.logs.slice(0, 100),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // Игнорируем ошибки
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (data.settings) Object.assign(STATE.settings, data.settings);
      if (data.stats) Object.assign(STATE.stats, data.stats);
      if (data.logs) STATE.logs = data.logs;
    }
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================================
// 4. РАБОТА С FAVICON
// ============================================================

function getFaviconUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

function getFallbackColor(url) {
  if (!url) return '#667eea';
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = url.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#667eea',
    '#764ba2',
    '#00b894',
    '#fdcb6e',
    '#ff6b6b',
    '#74b9ff',
    '#fd79a8',
    '#00cec9',
    '#6c5ce7',
    '#f39c12',
    '#e17055',
    '#0984e3',
  ];
  return colors[Math.abs(hash) % colors.length];
}

// ============================================================
// 5. ПРЕДЗАГРУЗКА FAVICON
// ============================================================

async function preloadFavicons(bookmarks) {
  try {
    const urls = bookmarks
      .filter(b => b.type === 'url' && b.url)
      .map(b => getFaviconUrl(b.url))
      .filter(u => u);

    // Загружаем только первые 10 для экономии ресурсов
    for (const url of urls.slice(0, 10)) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        await new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 2000);
        });
      } catch {
        // Игнорируем ошибки
      }
    }
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================================
// 6. РАБОТА С ЗАКЛАДКАМИ
// ============================================================

async function loadAllBookmarksFromExtension() {
  try {
    addLog('info', '📑 Загрузка всех закладок...');

    const response = await chrome.runtime.sendMessage({
      action: 'get_all_bookmarks',
    });

    if (response && response.success) {
      const data = response.data;
      STATE.allBookmarks = data.all || [];
      STATE.bookmarklets = data.bookmarklets || [];
      STATE.folders = data.folders || [];
      STATE.bookmarks = data.all || [];

      // Предзагружаем favicon
      await preloadFavicons(STATE.bookmarks);

      updateBookmarksStats();
      renderBookmarks();

      addLog('info', `✅ Загружено ${STATE.bookmarks.length} закладок`);
      return data;
    }
    return null;
  } catch (error) {
    addLog('error', `❌ Ошибка: ${error.message}`);
    return null;
  }
}

function updateBookmarksStats() {
  try {
    const bookmarks = STATE.bookmarks || STATE.allBookmarks || [];
    const total = bookmarks.length;
    const bookmarklets = bookmarks.filter(b => b.isBookmarklet || b.type === 'bookmarklet').length;
    const folders = bookmarks.filter(b => b.type === 'folder').length;

    const totalEl = document.getElementById('bookmarks-total');
    const bmEl = document.getElementById('bookmarks-bookmarklets');
    const foldersEl = document.getElementById('bookmarks-folders');

    if (totalEl) totalEl.textContent = total;
    if (bmEl) bmEl.textContent = bookmarklets;
    if (foldersEl) foldersEl.textContent = folders;
  } catch (e) {
    // Игнорируем ошибки обновления статистики
  }
}

function renderBookmarks() {
  try {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;

    const filter = document.getElementById('bookmark-filter');
    const filterValue = filter ? filter.value.toLowerCase() : '';

    let bookmarks = STATE.bookmarks || STATE.allBookmarks || [];

    let filtered = bookmarks;
    if (filterValue) {
      filtered = filtered.filter(
        b =>
          b.title.toLowerCase().includes(filterValue) ||
          (b.url && b.url.toLowerCase().includes(filterValue))
      );
    }

    STATE.filteredBookmarks = filtered;

    if (filtered.length === 0) {
      container.innerHTML = `<div class="log-empty">📭 Закладок не найдено</div>`;
      return;
    }

    let html = '';
    for (const bookmark of filtered) {
      const type = bookmark.type || (bookmark.isBookmarklet ? 'bookmarklet' : 'url');
      const isFolder = type === 'folder';
      const isBookmarklet = type === 'bookmarklet' || bookmark.isBookmarklet;
      const isUrl = type === 'url' && !isBookmarklet;

      let iconHtml = '';
      if (isFolder) {
        iconHtml = `<span class="bookmark-icon-fallback">📁</span>`;
      } else if (isBookmarklet) {
        iconHtml = `<span class="bookmark-icon-fallback">📌</span>`;
      } else if (isUrl && bookmark.url) {
        const faviconUrl = getFaviconUrl(bookmark.url);
        iconHtml = `
                    <div class="bookmark-icon-wrapper">
                        <img src="${faviconUrl}" 
                             class="bookmark-favicon" 
                             alt="favicon"
                             onerror="this.style.display='none'; this.parentElement.innerHTML='<span class=\\'bookmark-icon-fallback\\' style=\\'color:${getFallbackColor(bookmark.url)}\\'>🔗</span>'"
                             loading="lazy">
                    </div>
                `;
      } else {
        iconHtml = `<span class="bookmark-icon-fallback">🔗</span>`;
      }

      const typeClass = isBookmarklet ? 'bookmarklet' : isFolder ? 'folder' : 'url';
      const typeLabel = isBookmarklet ? '📌 букмарклет' : isFolder ? '📁 папка' : '🔗 url';
      const path = bookmark.path || '—';

      html += `
                <div class="bookmark-item" data-id="${bookmark.id}" title="Путь: ${path}">
                    <div class="bookmark-info">
                        ${iconHtml}
                        <div style="display:flex;flex-direction:column;min-width:0;flex:1;">
                            <span class="bookmark-title">${escapeHtml(bookmark.title)}</span>
                            <span style="font-size:9px;color:#636e72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(path)}</span>
                        </div>
                        <span class="bookmark-url">${bookmark.url ? escapeHtml(bookmark.url.substring(0, 30)) : ''}</span>
                    </div>
                    <span class="bookmark-type ${typeClass}">${typeLabel}</span>
                </div>
            `;
    }

    container.innerHTML = html;
  } catch (e) {
    // Игнорируем ошибки рендера
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// 7. РАБОТА С ЛОГАМИ
// ============================================================

function renderLogs() {
  try {
    const container = document.getElementById('logs-container');
    if (!container) return;

    const filter = document.getElementById('log-filter');
    const filterValue = filter ? filter.value : 'all';

    let filtered = STATE.logs;
    if (filterValue !== 'all') {
      filtered = filtered.filter(log => log.level === filterValue);
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div class="log-empty">📭 Логов нет</div>`;
      return;
    }

    let html = '';
    for (const log of filtered) {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const levelClass = log.level;

      html += `
                <div class="log-entry">
                    <span class="log-time">${time}</span>
                    <span class="log-level ${levelClass}">${log.level.toUpperCase()}</span>
                    <span class="log-message">${escapeHtml(log.message)}</span>
                </div>
            `;
    }

    container.innerHTML = html;
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================================
// 8. ОБНОВЛЕНИЕ СТАТИСТИКИ
// ============================================================

function updateStats() {
  try {
    const requests = document.getElementById('stat-requests');
    const success = document.getElementById('stat-success');
    const errors = document.getElementById('stat-errors');
    const cache = document.getElementById('stat-cache');

    if (requests) requests.textContent = STATE.stats.requests;
    if (success) success.textContent = STATE.stats.success;
    if (errors) errors.textContent = STATE.stats.errors;
    if (cache) cache.textContent = STATE.stats.cacheSize;
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================================
// 9. ОБНОВЛЕНИЕ СТАТУСА
// ============================================================

function updateConnectionStatus() {
  try {
    chrome.runtime
      .sendMessage({ action: 'ping' })
      .then(response => {
        const statusEl = document.getElementById('connection-status');
        const footerStatus = document.getElementById('footer-status');
        const badge = document.querySelector('.status-badge .dot');
        const statusText = document.getElementById('status-text');

        if (response && response.status === 'ok') {
          if (statusEl) {
            statusEl.textContent = '🟢 Подключено';
            statusEl.className = 'info-value';
          }
          if (footerStatus) {
            footerStatus.textContent = '🟢 Активно';
            footerStatus.className = 'online';
          }
          if (badge) badge.className = 'dot active';
          if (statusText) statusText.textContent = 'Активно';
        } else {
          if (statusEl) {
            statusEl.textContent = '🔴 Нет соединения';
            statusEl.className = 'info-value';
          }
          if (footerStatus) {
            footerStatus.textContent = '🔴 Офлайн';
            footerStatus.className = 'offline';
          }
          if (badge) badge.className = 'dot inactive';
          if (statusText) statusText.textContent = 'Офлайн';
        }
      })
      .catch(() => {
        const statusEl = document.getElementById('connection-status');
        const footerStatus = document.getElementById('footer-status');
        const badge = document.querySelector('.status-badge .dot');
        const statusText = document.getElementById('status-text');

        if (statusEl) {
          statusEl.textContent = '🔴 Нет соединения';
          statusEl.className = 'info-value';
        }
        if (footerStatus) {
          footerStatus.textContent = '🔴 Офлайн';
          footerStatus.className = 'offline';
        }
        if (badge) badge.className = 'dot inactive';
        if (statusText) statusText.textContent = 'Офлайн';
      });
  } catch (e) {
    // Игнорируем ошибки
  }
}

function updateTime() {
  try {
    const now = new Date();
    const timeEl = document.getElementById('footer-time');
    const updateEl = document.getElementById('last-update');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString();
    if (updateEl) updateEl.textContent = now.toLocaleString();
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================================
// 10. ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================

let timers = [];

function setupEventListeners() {
  // Вкладки
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const panel = document.getElementById(`tab-${tab}`);
      if (panel) panel.classList.add('active');
    });
  });

  // Настройки: Сохранить
  const saveBtn = document.getElementById('btn-save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const bridgeEnabled = document.getElementById('bridge-enabled');
      const autoRespond = document.getElementById('auto-respond');
      const timeout = document.getElementById('timeout');
      const cacheTTL = document.getElementById('cache-ttl');
      const debugMode = document.getElementById('debug-mode');
      const logLevel = document.getElementById('log-level');
      const maxLogs = document.getElementById('max-logs');

      STATE.settings.bridgeEnabled = bridgeEnabled ? bridgeEnabled.checked : true;
      STATE.settings.autoRespond = autoRespond ? autoRespond.checked : true;
      STATE.settings.timeout = timeout ? parseInt(timeout.value) || 5000 : 5000;
      STATE.settings.cacheTTL = cacheTTL ? parseInt(cacheTTL.value) || 30 : 30;
      STATE.settings.debugMode = debugMode ? debugMode.checked : false;
      STATE.settings.logLevel = logLevel ? logLevel.value : 'info';
      STATE.settings.maxLogs = maxLogs ? parseInt(maxLogs.value) || 100 : 100;

      saveState();
      addLog('info', '💾 Настройки сохранены');
    });
  }

  // Настройки: Сбросить
  const resetBtn = document.getElementById('btn-reset-settings');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('Сбросить все настройки?')) return;

      STATE.settings = {
        bridgeEnabled: true,
        autoRespond: true,
        timeout: 5000,
        cacheTTL: 30,
        debugMode: false,
        logLevel: 'info',
        maxLogs: 100,
      };
      STATE.stats = { requests: 0, success: 0, errors: 0, cacheSize: 0 };
      STATE.logs = [];

      const bridgeEnabled = document.getElementById('bridge-enabled');
      const autoRespond = document.getElementById('auto-respond');
      const timeout = document.getElementById('timeout');
      const cacheTTL = document.getElementById('cache-ttl');
      const debugMode = document.getElementById('debug-mode');
      const logLevel = document.getElementById('log-level');
      const maxLogs = document.getElementById('max-logs');

      if (bridgeEnabled) bridgeEnabled.checked = true;
      if (autoRespond) autoRespond.checked = true;
      if (timeout) timeout.value = 5000;
      if (cacheTTL) cacheTTL.value = 30;
      if (debugMode) debugMode.checked = false;
      if (logLevel) logLevel.value = 'info';
      if (maxLogs) maxLogs.value = 100;

      saveState();
      updateStats();
      renderLogs();
      addLog('info', '↺ Настройки сброшены');
    });
  }

  // Настройки: Очистить кеш
  const clearCacheBtn = document.getElementById('btn-clear-cache');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      if (!confirm('Очистить кеш закладок?')) return;

      chrome.runtime
        .sendMessage({ action: 'clear_cache' })
        .then(() => {
          STATE.stats.cacheSize = 0;
          updateStats();
          addLog('info', '🗑️ Кеш очищен');
        })
        .catch(error => {
          addLog('error', `❌ Ошибка очистки кеша: ${error.message}`);
        });
    });
  }

  // Закладки: Фильтр
  const filterInput = document.getElementById('bookmark-filter');
  if (filterInput) {
    filterInput.addEventListener('input', renderBookmarks);
  }

  // Закладки: Обновить
  const refreshBtn = document.getElementById('btn-refresh-bookmarks');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadAllBookmarksFromExtension();
    });
  }

  // Логи: Очистить
  const clearLogsBtn = document.getElementById('btn-clear-logs');
  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      STATE.logs = [];
      renderLogs();
      saveState();
      addLog('info', '🗑️ Логи очищены');
    });
  }

  // Логи: Фильтр
  const logFilter = document.getElementById('log-filter');
  if (logFilter) {
    logFilter.addEventListener('change', renderLogs);
  }

  // Инфо: Ссылки
  const linkManager = document.getElementById('link-manager');
  if (linkManager) {
    linkManager.addEventListener('click', e => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('../Bookmarklet/manager.html') });
    });
  }

  const linkInstall = document.getElementById('link-install');
  if (linkInstall) {
    linkInstall.addEventListener('click', e => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('../install.html') });
    });
  }

  const linkDebug = document.getElementById('link-debug');
  if (linkDebug) {
    linkDebug.addEventListener('click', e => {
      e.preventDefault();
      chrome.tabs.create({ url: 'about:debugging' });
    });
  }

  // Кнопка закрытия
  const closeBtn = document.getElementById('popup-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimers();
      chrome.runtime.sendMessage({ action: 'close_extension_window' }, () => {
        try {
          window.close();
        } catch (e) {
          chrome.windows.getCurrent(win => {
            if (win) chrome.windows.remove(win.id);
          });
        }
      });
    });
  }
}

// ============================================================
// 11. ТАЙМЕРЫ
// ============================================================

function clearTimers() {
  for (const timer of timers) {
    clearInterval(timer);
    clearTimeout(timer);
  }
  timers = [];
}

function setupTimers() {
  // Только один интервал для обновления времени (каждые 10 секунд)
  const timeTimer = setInterval(updateTime, 10000);
  timers.push(timeTimer);

  // Проверка статуса подключения (каждые 30 секунд, не чаще)
  const statusTimer = setInterval(updateConnectionStatus, 30000);
  timers.push(statusTimer);
}

// ============================================================
// 12. ИНИЦИАЛИЗАЦИЯ (один раз)
// ============================================================

async function init() {
  if (STATE.initialized) return;
  STATE.initialized = true;

  loadState();

  // Применяем настройки к UI
  const bridgeEnabled = document.getElementById('bridge-enabled');
  const autoRespond = document.getElementById('auto-respond');
  const timeout = document.getElementById('timeout');
  const cacheTTL = document.getElementById('cache-ttl');
  const debugMode = document.getElementById('debug-mode');
  const logLevel = document.getElementById('log-level');
  const maxLogs = document.getElementById('max-logs');

  if (bridgeEnabled) bridgeEnabled.checked = STATE.settings.bridgeEnabled;
  if (autoRespond) autoRespond.checked = STATE.settings.autoRespond;
  if (timeout) timeout.value = STATE.settings.timeout;
  if (cacheTTL) cacheTTL.value = STATE.settings.cacheTTL;
  if (debugMode) debugMode.checked = STATE.settings.debugMode;
  if (logLevel) logLevel.value = STATE.settings.logLevel;
  if (maxLogs) maxLogs.value = STATE.settings.maxLogs;

  updateStats();
  renderLogs();
  updateConnectionStatus();
  updateTime();

  const extensionId = document.getElementById('extension-id');
  if (extensionId) {
    extensionId.textContent = chrome.runtime.id?.substring(0, 8) || 'unknown';
  }

  addLog('info', '📦 Расширение Bookmarklet Bridge запущено');
  addLog('info', '📌 Версия: 1.0.0');

  // Загружаем закладки
  await loadAllBookmarksFromExtension();

  // Настраиваем обработчики событий
  setupEventListeners();

  // Настраиваем таймеры
  setupTimers();

  // Сохраняем состояние
  STATE.isOpen = true;
  saveState();
}

// Запускаем инициализацию
document.addEventListener('DOMContentLoaded', () => {
  init();
});

console.log('📦 Bookmarklet Bridge Popup загружен');
console.log('📋 Расширение всегда видно, закрывается только по кнопке ✕');

// Экспортируем в глобальный объект
window.__bookmarkBridge = {
  loadAllBookmarksFromExtension,
  getAllBookmarks: () => STATE.allBookmarks || [],
  getBookmarklets: () => STATE.bookmarklets || [],
  getFolders: () => STATE.folders || [],
  clearCache: () => {
    STATE.stats.cacheSize = 0;
    updateStats();
    chrome.runtime.sendMessage({ action: 'clear_cache' });
  },
  getFaviconUrl,
  preloadFavicons,
};
