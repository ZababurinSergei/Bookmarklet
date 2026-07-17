// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/popup.js
// ИСПРАВЛЕНО: Очистка логов при открытии, вывод всех входящих/исходящих сообщений

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
// 2. ЛОГГЕР С ВЫВОДОМ ВСЕХ СООБЩЕНИЙ
// ============================================================

function addLog(level, message, data = null) {
  try {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const levelIndex = levels.indexOf(level);
    const currentLevel = STATE.settings.logLevel;
    const currentIndex = levels.indexOf(currentLevel);

    if (levelIndex > currentIndex) return;

    // Форматируем данные для вывода
    let dataStr = '';
    if (data !== null && data !== undefined) {
      try {
        if (typeof data === 'object') {
          dataStr = JSON.stringify(data, null, 2);
        } else {
          dataStr = String(data);
        }
      } catch (e) {
        dataStr = '[Object]';
      }
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: dataStr || null,
      rawData: data,
    };

    STATE.logs.unshift(entry);
    if (STATE.logs.length > STATE.settings.maxLogs) {
      STATE.logs.pop();
    }

    // Выводим в консоль с полными данными
    const consoleMsg = `[${level.toUpperCase()}] ${message}`;
    if (data !== null && data !== undefined) {
      if (level === 'error') {
        console.error(consoleMsg, data);
      } else if (level === 'warn') {
        console.warn(consoleMsg, data);
      } else if (level === 'debug') {
        console.debug(consoleMsg, data);
      } else {
        console.log(consoleMsg, data);
      }
    } else {
      if (level === 'error') {
        console.error(consoleMsg);
      } else if (level === 'warn') {
        console.warn(consoleMsg);
      } else if (level === 'debug') {
        console.debug(consoleMsg);
      } else {
        console.log(consoleMsg);
      }
    }

    renderLogs();
    saveState();

    chrome.runtime
      .sendMessage({
        action: 'log_update',
        level,
        message,
        data: dataStr,
      })
      .catch(() => {});
  } catch (e) {
    // Игнорируем ошибки логирования
  }
}

// ============================================================
// 3. ЛОГИРОВАНИЕ ВХОДЯЩИХ/ИСХОДЯЩИХ СООБЩЕНИЙ
// ============================================================

function logIncomingMessage(source, type, data) {
  addLog('debug', `📥 ВХОДЯЩЕЕ: ${source}:${type}`, data);
}

function logOutgoingMessage(target, type, data) {
  addLog('debug', `📤 ИСХОДЯЩЕЕ: ${target}:${type}`, data);
}

function logBookmarkRequest(url, bookmarkName, details) {
  addLog('info', `📌 ЗАПРОС ЗАКЛАДКИ: "${bookmarkName}"`, {
    url: url,
    bookmarkName: bookmarkName,
    details: details,
  });
}

function logBookmarkResponse(bookmarkData) {
  addLog('info', `📤 ОТВЕТ ЗАКЛАДКИ: "${bookmarkData?.title || 'Неизвестная'}"`, bookmarkData);
}

// ============================================================
// 4. РАБОТА С ХРАНИЛИЩЕМ
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
// 5. РАБОТА С FAVICON
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
// 6. ПРЕДЗАГРУЗКА FAVICON
// ============================================================

async function preloadFavicons(bookmarks) {
  try {
    const urls = bookmarks
      .filter(b => b.type === 'url' && b.url)
      .map(b => getFaviconUrl(b.url))
      .filter(u => u);

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
// 7. РАБОТА С ЗАКЛАДКАМИ
// ============================================================

async function loadAllBookmarksFromExtension() {
  if (STATE.allBookmarks && STATE.allBookmarks.length > 0) {
    addLog('debug', '📦 Используем кеш закладок');
    return STATE.allBookmarks;
  }

  try {
    addLog('info', '📑 Загрузка всех закладок...');

    // Логируем исходящий запрос
    logOutgoingMessage('background', 'get_all_bookmarks', { action: 'get_all_bookmarks' });

    const response = await chrome.runtime.sendMessage({
      action: 'get_all_bookmarks',
    });

    // Логируем входящий ответ
    logIncomingMessage('background', 'get_all_bookmarks_response', response);

    if (response && response.success) {
      const data = response.data;
      STATE.allBookmarks = data.all || [];
      STATE.bookmarklets = data.bookmarklets || [];
      STATE.folders = data.folders || [];
      STATE.bookmarks = data.all || [];

      if (STATE.allBookmarks.length > 0) {
        await preloadFavicons(STATE.bookmarks);
      }

      updateBookmarksStats();
      renderBookmarks();

      addLog('info', `✅ Загружено ${STATE.bookmarks.length} закладок`);
      return data;
    }
    return null;
  } catch (error) {
    addLog('error', `❌ Ошибка: ${error.message}`, error);
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
// 8. РАБОТА С ЛОГАМИ
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

      let messageHtml = escapeHtml(log.message);
      if (log.data) {
        const dataPreview =
          typeof log.data === 'string' && log.data.length > 100
            ? log.data.substring(0, 100) + '...'
            : log.data;
        messageHtml += `\n📦 ${escapeHtml(JSON.stringify(dataPreview, null, 2))}`;
      }

      html += `
                <div class="log-entry">
                    <span class="log-time">${time}</span>
                    <span class="log-level ${levelClass}">${log.level.toUpperCase()}</span>
                    <span class="log-message">${messageHtml}</span>
                </div>
            `;
    }

    container.innerHTML = html;
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================================
// 9. ЭКСПОРТ ЛОГОВ
// ============================================================

function exportLogs() {
  try {
    const filter = document.getElementById('log-filter');
    const filterValue = filter ? filter.value : 'all';

    let logsToExport = STATE.logs;
    if (filterValue !== 'all') {
      logsToExport = logsToExport.filter(log => log.level === filterValue);
    }

    if (logsToExport.length === 0) {
      addLog('warn', '⚠️ Нет логов для экспорта');
      showToast('⚠️ Нет логов для экспорта', 'warn');
      return;
    }

    const data = {
      timestamp: new Date().toISOString(),
      total: logsToExport.length,
      filter: filterValue,
      logs: logsToExport,
      extension: {
        name: 'Bookmarklet Bridge',
        version: '1.0.0',
      },
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog('info', `📤 Экспортировано ${logsToExport.length} записей логов`);
    showToast(`✅ Экспортировано ${logsToExport.length} записей`, 'success');
  } catch (error) {
    addLog('error', `❌ Ошибка экспорта логов: ${error.message}`);
    showToast('❌ Ошибка экспорта логов', 'error');
  }
}

// ============================================================
// 10. TOAST УВЕДОМЛЕНИЯ
// ============================================================

let toastTimer = null;

function showToast(message, type = 'info') {
  try {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(8px);
                padding: 10px 24px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #fff;
                font-size: 13px;
                z-index: 99999;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
                max-width: 90vw;
                text-align: center;
                font-family: 'Segoe UI', system-ui, sans-serif;
            `;
      document.body.appendChild(toast);
    }

    const colors = {
      success: '#00b894',
      error: '#ff6b6b',
      warn: '#fdcb6e',
      info: '#667eea',
    };

    toast.style.borderColor = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.opacity = '1';

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toastTimer = null;
    }, 3000);
  } catch (e) {
    // Игнорируем ошибки
  }
}

// ============================================================
// 11. ОБНОВЛЕНИЕ СТАТИСТИКИ
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
// 12. ОБНОВЛЕНИЕ СТАТУСА
// ============================================================

function updateConnectionStatus() {
  try {
    chrome.runtime
      .sendMessage({ action: 'ping' })
      .then(response => {
        // Логируем входящий ответ
        logIncomingMessage('background', 'ping_response', response);

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
      .catch(error => {
        logIncomingMessage('background', 'ping_error', error);

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
// 13. ОБРАБОТЧИКИ СОБЫТИЙ
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
      addLog('info', '💾 Настройки сохранены', STATE.settings);
      showToast('✅ Настройки сохранены', 'success');
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
      addLog('info', '↺ Настройки сброшены', STATE.settings);
      showToast('↺ Настройки сброшены', 'info');
    });
  }

  // Настройки: Очистить кеш
  const clearCacheBtn = document.getElementById('btn-clear-cache');
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      if (!confirm('Очистить кеш закладок?')) return;

      logOutgoingMessage('background', 'clear_cache', { action: 'clear_cache' });

      chrome.runtime
        .sendMessage({ action: 'clear_cache' })
        .then(() => {
          logIncomingMessage('background', 'clear_cache_response', { success: true });
          STATE.stats.cacheSize = 0;
          updateStats();
          addLog('info', '🗑️ Кеш очищен');
          showToast('🗑️ Кеш очищен', 'success');
        })
        .catch(error => {
          logIncomingMessage('background', 'clear_cache_error', error);
          addLog('error', `❌ Ошибка очистки кеша: ${error.message}`, error);
          showToast('❌ Ошибка очистки кеша', 'error');
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
      showToast('🔄 Закладки обновлены', 'success');
    });
  }

  // Закладки: Экспорт
  const exportBookmarksBtn = document.getElementById('btn-export-bookmarks');
  if (exportBookmarksBtn) {
    exportBookmarksBtn.addEventListener('click', () => {
      const data = {
        timestamp: new Date().toISOString(),
        total: STATE.bookmarks.length,
        bookmarklets: STATE.bookmarks.filter(b => b.type === 'bookmarklet').length,
        bookmarks: STATE.bookmarks,
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addLog('info', `📤 Экспортировано ${STATE.bookmarks.length} закладок`);
      showToast(`📤 Экспортировано ${STATE.bookmarks.length} закладок`, 'success');
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
      showToast('🗑️ Логи очищены', 'info');
    });
  }

  // Логи: Экспорт
  const exportLogsBtn = document.getElementById('btn-export-logs');
  if (exportLogsBtn) {
    exportLogsBtn.addEventListener('click', exportLogs);
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
      logOutgoingMessage('browser', 'open_tab', { url: 'manager.html' });
      chrome.tabs.create({ url: chrome.runtime.getURL('../Bookmarklet/manager.html') });
    });
  }

  const linkInstall = document.getElementById('link-install');
  if (linkInstall) {
    linkInstall.addEventListener('click', e => {
      e.preventDefault();
      logOutgoingMessage('browser', 'open_tab', { url: 'install.html' });
      chrome.tabs.create({ url: chrome.runtime.getURL('../install.html') });
    });
  }

  const linkDebug = document.getElementById('link-debug');
  if (linkDebug) {
    linkDebug.addEventListener('click', e => {
      e.preventDefault();
      logOutgoingMessage('browser', 'open_tab', { url: 'about:debugging' });
      chrome.tabs.create({ url: 'about:debugging' });
    });
  }

  // Кнопка закрытия
  const closeBtn = document.getElementById('popup-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimers();
      logOutgoingMessage('background', 'close_extension_window', {});
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

  // Кнопка PiP
  const pipBtn = document.getElementById('btn-open-pip');
  if (pipBtn) {
    pipBtn.addEventListener('click', openPopupInPip);
  }
}

// ============================================================
// 14. ТАЙМЕРЫ
// ============================================================

function clearTimers() {
  for (const timer of timers) {
    clearInterval(timer);
    clearTimeout(timer);
  }
  timers = [];
}

function setupTimers() {
  const timeTimer = setInterval(updateTime, 10000);
  timers.push(timeTimer);

  const statusTimer = setInterval(updateConnectionStatus, 30000);
  timers.push(statusTimer);
}

// ============================================================
// 15. ОТКРЫТИЕ POPUP ПОВЕРХ ВСЕХ ОКОН (PiP)
// ============================================================

async function openPopupInPip() {
  if (!('documentPictureInPicture' in window)) {
    showToast('❌ Ваш браузер не поддерживает Document Picture-in-Picture', 'error');
    addLog('error', '❌ Document Picture-in-Picture не поддерживается');
    return;
  }

  try {
    addLog('info', '📂 Открытие окна поверх всех окон...');
    showToast('⏳ Открытие закрепленного окна...', 'info');

    const response = await fetch(chrome.runtime.getURL('popup.html'));
    let htmlText = await response.text();

    htmlText = htmlText.replace(
      '</head>',
      `<style>
                body {
                    width: 100vw;
                    height: 100vh;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                #popup-container {
                    width: 100vw !important;
                    height: 100vh !important;
                    max-width: 100vw !important;
                    max-height: 100vh !important;
                    border-radius: 0 !important;
                }
                .window-header, .header {
                    display: none !important;
                }
                .tabs {
                    margin-top: 0 !important;
                }
                #popup-close-btn {
                    display: none !important;
                }
            </style>
            </head>`
    );

    const pipWindow = await window.documentPictureInPicture.requestWindow({
      width: Math.min(540, window.screen.availWidth - 20),
      height: Math.min(620, window.screen.availHeight - 20),
    });

    pipWindow.document.open();
    pipWindow.document.write(htmlText);
    pipWindow.document.close();

    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
      try {
        const src = script.src;
        if (src && !src.includes('pip')) {
          const newScript = pipWindow.document.createElement('script');
          newScript.src = src;
          newScript.type = 'module';
          pipWindow.document.head.appendChild(newScript);
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    }

    pipWindow.addEventListener('load', () => {
      try {
        const message = {
          action: 'pip_init',
          state: {
            settings: STATE.settings,
            stats: STATE.stats,
            logs: STATE.logs.slice(0, 50),
            allBookmarks: STATE.allBookmarks || [],
            bookmarklets: STATE.bookmarklets || [],
            folders: STATE.folders || [],
          },
        };
        pipWindow.postMessage(message, '*');
        logOutgoingMessage('pip', 'pip_init', message);
      } catch (e) {
        // Игнорируем ошибки
      }
    });

    window.close();

    addLog('info', '✅ Окно открыто поверх всех окон');
    showToast('✅ Окно закреплено поверх всех окон', 'success');
  } catch (error) {
    addLog('error', `❌ Ошибка открытия окна: ${error.message}`, error);
    showToast(`❌ Ошибка: ${error.message}`, 'error');
    console.error('❌ Ошибка открытия PiP:', error);
  }
}

// ============================================================
// 16. ОБРАБОТКА СООБЩЕНИЙ ОТ BACKGROUND
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Логируем входящее сообщение
  logIncomingMessage('background', message.action || 'unknown', message);

  if (message.action === 'log_update') {
    addLog(message.level, message.message, message.data);
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'stats_update') {
    Object.assign(STATE.stats, message.stats);
    updateStats();
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'bookmark_update') {
    loadAllBookmarksFromExtension();
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'connection_status') {
    updateConnectionStatus();
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'tab_updated') {
    addLog('info', `🔄 Вкладка обновлена: ${message.tab?.title || '—'}`, message);
    updateCurrentTabDisplay(message.tab, message.bookmark);

    if (message.bookmark) {
      addLog('info', `   📌 Закладка: ${message.bookmark.title}`, message.bookmark);
      logBookmarkRequestDetails(message.bookmark, {
        url: message.tab?.url,
        timestamp: Date.now(),
        source: 'tab_updated',
      });
    }
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'tab_closed') {
    addLog('info', `🗑️ Вкладка закрыта: ${message.tabId}`, message);
    currentTabInfo = null;
    currentBookmarkInfo = null;
    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = '—';
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'bookmarks_loaded') {
    addLog(
      'info',
      `📑 Закладки загружены: ${message.stats?.total || 0} всего, ${message.stats?.bookmarklets || 0} букмарклетов`,
      message
    );
    if (message.bookmarklets) {
      addLog(
        'debug',
        `📌 Букмарклеты: ${message.bookmarklets.map(b => b.title).join(', ')}`,
        message.bookmarklets
      );
    }
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'bookmark_request') {
    logBookmarkRequestDetails(message.bookmarkData, message.requestDetails);
    sendResponse({ received: true });
    return true;
  }

  return false;
});

// ============================================================
// 17. ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ЗАКЛАДОК
// ============================================================

function logBookmarkRequestDetails(bookmarkData, requestDetails) {
  const title = bookmarkData?.title || 'Неизвестная закладка';
  const type = bookmarkData?.type || 'unknown';
  const id = bookmarkData?.id || '—';
  const parent = bookmarkData?.parent?.title || 'корень';
  const path = bookmarkData?.path?.join(' > ') || '—';
  const isBookmarklet = bookmarkData?.isBookmarklet || false;
  const siblingsCount = bookmarkData?.siblings?.length || 0;
  const features = bookmarkData?.features || [];
  const version = bookmarkData?.version || '1.0.0';
  const customConfig = bookmarkData?.customConfig || {};

  const logData = {
    title,
    type,
    id,
    parent,
    path,
    isBookmarklet,
    siblingsCount,
    features,
    version,
    customConfig,
    requestDetails,
  };

  addLog('debug', `📌 ДЕТАЛИ ЗАКЛАДКИ: "${title}"`, logData);
}

// ============================================================
// 18. ИНИЦИАЛИЗАЦИЯ С ОЧИСТКОЙ ЛОГОВ
// ============================================================

async function init() {
  if (STATE.initialized) {
    console.log('⚠️ Popup уже инициализирован, пропускаем');
    return;
  }
  STATE.initialized = true;

  // ОЧИЩАЕМ ЛОГИ ПРИ ОТКРЫТИИ
  STATE.logs = [];

  loadState();

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

  // Логируем запуск
  addLog('info', '📦 Расширение Bookmarklet Bridge запущено', {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
  addLog('info', '📌 Версия: 1.0.0');

  // Логируем исходящий запрос на загрузку закладок
  logOutgoingMessage('background', 'get_all_bookmarks', { action: 'get_all_bookmarks' });

  await loadAllBookmarksFromExtension();

  setupEventListeners();
  setupTimers();

  STATE.isOpen = true;
  saveState();
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});

console.log('📦 Bookmarklet Bridge Popup загружен');
console.log('📋 Логи очищены при открытии');
console.log('📋 Все входящие/исходящие сообщения логируются');

window.__bookmarkBridge = {
  loadAllBookmarksFromExtension,
  getAllBookmarks: () => STATE.allBookmarks || [],
  getBookmarklets: () => STATE.bookmarklets || [],
  getFolders: () => STATE.folders || [],
  exportLogs: exportLogs,
  openPopupInPip: openPopupInPip,
  addLog: addLog,
  logIncomingMessage: logIncomingMessage,
  logOutgoingMessage: logOutgoingMessage,
  clearCache: () => {
    STATE.stats.cacheSize = 0;
    updateStats();
    chrome.runtime.sendMessage({ action: 'clear_cache' });
  },
  getFaviconUrl,
  preloadFavicons,
};
