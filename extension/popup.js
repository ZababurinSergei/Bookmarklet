// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/popup.js
// Полноценный интерфейс для расширения

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
  filteredBookmarks: [],
  isOpen: true,
};

// ============================================================
// 2. ЛОГГЕР
// ============================================================

function addLog(level, message, data = null) {
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

  // Отправляем лог в background
  chrome.runtime
    .sendMessage({
      action: 'log_update',
      level,
      message,
      data,
    })
    .catch(() => {});
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
    console.warn('⚠️ Ошибка сохранения состояния:', e);
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
    console.warn('⚠️ Ошибка загрузки состояния:', e);
  }
}

// ============================================================
// 4. РАБОТА С ЗАКЛАДКАМИ
// ============================================================

async function loadBookmarks() {
  addLog('info', '📑 Загрузка закладок...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'get_bookmark_tree',
    });

    if (response && Array.isArray(response)) {
      STATE.bookmarks = flattenBookmarks(response);
      STATE.filteredBookmarks = [...STATE.bookmarks];
      renderBookmarks();
      updateBookmarksStats();
      addLog('info', `✅ Загружено ${STATE.bookmarks.length} закладок`);
    } else {
      addLog('error', '❌ Не удалось загрузить закладки');
    }
  } catch (error) {
    addLog('error', `❌ Ошибка загрузки закладок: ${error.message}`);
  }
}

function flattenBookmarks(tree, path = '') {
  const result = [];

  for (const node of tree) {
    const isBookmarklet = node.url && node.url.startsWith('javascript:');
    const type = node.children ? 'folder' : isBookmarklet ? 'bookmarklet' : 'url';

    result.push({
      id: node.id,
      title: node.title || 'Без названия',
      url: node.url || '',
      type: type,
      path: path ? `${path} > ${node.title}` : node.title,
      isBookmarklet,
      children: node.children ? node.children.length : 0,
      dateAdded: node.dateAdded,
    });

    if (node.children) {
      const children = flattenBookmarks(
        node.children,
        path ? `${path} > ${node.title}` : node.title
      );
      result.push(...children);
    }
  }

  return result;
}

function updateBookmarksStats() {
  const total = STATE.bookmarks.length;
  const bookmarklets = STATE.bookmarks.filter(b => b.type === 'bookmarklet').length;
  const folders = STATE.bookmarks.filter(b => b.type === 'folder').length;

  document.getElementById('bookmarks-total').textContent = total;
  document.getElementById('bookmarks-bookmarklets').textContent = bookmarklets;
  document.getElementById('bookmarks-folders').textContent = folders;
}

function renderBookmarks() {
  const container = document.getElementById('bookmarks-list');
  const filter = document.getElementById('bookmark-filter').value.toLowerCase();

  let filtered = STATE.bookmarks;
  if (filter) {
    filtered = filtered.filter(
      b => b.title.toLowerCase().includes(filter) || (b.url && b.url.toLowerCase().includes(filter))
    );
  }

  STATE.filteredBookmarks = filtered;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="log-empty">📭 Закладок не найдено</div>`;
    return;
  }

  let html = '';
  for (const bookmark of filtered) {
    const icon = bookmark.type === 'folder' ? '📁' : bookmark.type === 'bookmarklet' ? '📌' : '🔗';
    const typeClass = bookmark.type;

    html += `
            <div class="bookmark-item" data-id="${bookmark.id}">
                <div class="bookmark-info">
                    <span class="bookmark-icon">${icon}</span>
                    <span class="bookmark-title">${escapeHtml(bookmark.title)}</span>
                    <span class="bookmark-url">${bookmark.url ? escapeHtml(bookmark.url.substring(0, 40)) : ''}</span>
                </div>
                <span class="bookmark-type ${typeClass}">${bookmark.type}</span>
            </div>
        `;
  }

  container.innerHTML = html;
}

// ============================================================
// 5. РАБОТА С ЛОГАМИ
// ============================================================

function renderLogs() {
  const container = document.getElementById('logs-container');
  const filter = document.getElementById('log-filter').value;

  let filtered = STATE.logs;
  if (filter !== 'all') {
    filtered = filtered.filter(log => log.level === filter);
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
}

// ============================================================
// 6. ОБНОВЛЕНИЕ СТАТИСТИКИ
// ============================================================

function updateStats() {
  document.getElementById('stat-requests').textContent = STATE.stats.requests;
  document.getElementById('stat-success').textContent = STATE.stats.success;
  document.getElementById('stat-errors').textContent = STATE.stats.errors;
  document.getElementById('stat-cache').textContent = STATE.stats.cacheSize;
}

// ============================================================
// 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  addLog(type, message);
}

// ============================================================
// 8. ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ЗАПРОСОВ К БУКМАРКЛЕТАМ
// ============================================================

function logBookmarkRequestDetails(bookmarkData, requestDetails = {}) {
  if (!bookmarkData) {
    addLog('warn', '⚠️ Нет данных о закладке');
    return;
  }

  const title = bookmarkData.title || 'Неизвестная закладка';
  const type = bookmarkData.type || 'unknown';
  const id = bookmarkData.id || '—';
  const parent = bookmarkData.parent?.title || 'корень';
  const path = bookmarkData.path?.join(' > ') || '—';
  const isBookmarklet = bookmarkData.isBookmarklet || false;
  const siblingsCount = bookmarkData.siblings?.length || 0;
  const features = bookmarkData.features || [];
  const version = bookmarkData.version || '1.0.0';
  const customConfig = bookmarkData.customConfig || {};

  // Разделитель
  addLog('debug', '═══════════════════════════════════════════════════════════');
  addLog('debug', `📌 ЗАПРОС К БУКМАРКЛЕТУ`);

  // Основная информация
  if (requestDetails.url) {
    addLog('debug', `   📍 URL страницы: ${requestDetails.url}`);
  }
  addLog('debug', `   📋 Название закладки: ${title}`);
  addLog('debug', `   🏷️  Тип: ${type}`);
  addLog('debug', `   🆔 ID: ${id}`);
  addLog('debug', `   📂 Родитель: ${parent}`);
  addLog('debug', `   📁 Путь: ${path}`);
  addLog('debug', `   📦 Версия: ${version}`);
  addLog('debug', `   🔖 Букмарклет: ${isBookmarklet ? '✅ Да' : '❌ Нет'}`);
  addLog('debug', `   📎 Соседей: ${siblingsCount}`);
  addLog('debug', `   ✨ Функции: ${features.length > 0 ? features.join(', ') : 'нет'}`);

  // Кастомные настройки
  if (Object.keys(customConfig).length > 0) {
    addLog('debug', `   ⚙️  Кастомные настройки:`);
    for (const [key, value] of Object.entries(customConfig)) {
      const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      addLog('debug', `      ${key}: ${valueStr}`);
    }
  }

  // Соседние закладки (первые 5)
  if (bookmarkData.siblings && bookmarkData.siblings.length > 0) {
    const siblings = bookmarkData.siblings.slice(0, 5);
    addLog('debug', `   📑 Соседние закладки (${bookmarkData.siblings.length} всего):`);
    for (const sibling of siblings) {
      const sType = sibling.url?.startsWith('javascript:') ? '📌' : '🔗';
      const sTitle = sibling.title || 'Без названия';
      addLog('debug', `      ${sType} ${sTitle}`);
    }
    if (bookmarkData.siblings.length > 5) {
      addLog('debug', `      ... и еще ${bookmarkData.siblings.length - 5}`);
    }
  }

  // Детали запроса
  if (requestDetails.tabId) {
    addLog('debug', `   📊 Tab ID: ${requestDetails.tabId}`);
  }
  if (requestDetails.requestId) {
    addLog('debug', `   🔢 Request ID: ${requestDetails.requestId}`);
  }
  if (requestDetails.timestamp) {
    addLog('debug', `   ⏱️  Время запроса: ${new Date(requestDetails.timestamp).toLocaleString()}`);
  }
  if (requestDetails.source) {
    addLog('debug', `   📡 Источник: ${requestDetails.source}`);
  }

  // Полные данные в VERBOSE режиме
  if (STATE.settings.logLevel === 'debug' || STATE.settings.logLevel === 'trace') {
    addLog('debug', '📦 ПОЛНЫЕ ДАННЫЕ ЗАКЛАДКИ:', bookmarkData);
  }

  addLog('debug', '═══════════════════════════════════════════════════════════');
}

// ============================================================
// 9. ОБНОВЛЕНИЕ СТАТУСА ПОДКЛЮЧЕНИЯ
// ============================================================

function updateConnectionStatus() {
  const statusEl = document.getElementById('connection-status');
  const footerStatus = document.getElementById('footer-status');
  const badge = document.querySelector('.status-badge .dot');
  const statusText = document.getElementById('status-text');

  chrome.runtime
    .sendMessage({ action: 'ping' })
    .then(response => {
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
        if (statusText && !statusText.textContent.includes('📌')) {
          statusText.textContent = 'Активно';
        }
      }
    })
    .catch(() => {
      if (statusEl) {
        statusEl.textContent = '🔴 Нет соединения';
        statusEl.className = 'info-value';
      }
      if (footerStatus) {
        footerStatus.textContent = '🔴 Офлайн';
        footerStatus.className = 'offline';
      }
      if (badge) badge.className = 'dot inactive';
      if (statusText && !statusText.textContent.includes('📌')) {
        statusText.textContent = 'Офлайн';
      }
    });
}

function updateTime() {
  const now = new Date();
  const timeEl = document.getElementById('footer-time');
  const updateEl = document.getElementById('last-update');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString();
  if (updateEl) updateEl.textContent = now.toLocaleString();
}

// ============================================================
// 10. ОТСЛЕЖИВАНИЕ АКТИВНОЙ ВКЛАДКИ
// ============================================================

let currentTabInfo = null;
let currentBookmarkInfo = null;

function updateCurrentTabDisplay(tabData, bookmarkData) {
  currentTabInfo = tabData;
  currentBookmarkInfo = bookmarkData;

  // Обновляем информацию в инфо-панели
  const titleEl = document.getElementById('current-tab-title');
  const urlEl = document.getElementById('current-tab-url');
  const bookmarkTitleEl = document.getElementById('current-bookmark-title');
  const bookmarkTypeEl = document.getElementById('current-bookmark-type');

  if (titleEl) {
    titleEl.textContent = tabData?.title || '—';
    titleEl.title = tabData?.title || '';
  }
  if (urlEl) {
    const url = tabData?.url || '—';
    urlEl.textContent = url.length > 50 ? url.substring(0, 50) + '...' : url;
    urlEl.title = url;
  }
  if (bookmarkTitleEl) {
    bookmarkTitleEl.textContent = bookmarkData?.title || '—';
    bookmarkTitleEl.title = bookmarkData?.title || '';
  }
  if (bookmarkTypeEl) {
    bookmarkTypeEl.textContent = bookmarkData?.type || '—';
  }

  // Обновляем статус в шапке
  const statusText = document.getElementById('status-text');
  if (statusText && tabData) {
    const title = tabData.title || 'Без названия';
    const shortTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;
    if (bookmarkData && bookmarkData.title) {
      statusText.textContent = `📌 ${shortTitle} (${bookmarkData.title})`;
    } else {
      statusText.textContent = `📌 ${shortTitle}`;
    }
  }

  // Обновляем статус в подвале
  const footerStatus = document.getElementById('footer-status');
  if (footerStatus && tabData) {
    const title = tabData.title || 'Без названия';
    const shortTitle = title.length > 25 ? title.substring(0, 25) + '...' : title;
    footerStatus.textContent = `📌 ${shortTitle}`;
    footerStatus.className = 'online';
  }

  // Логируем
  if (bookmarkData && bookmarkData.title) {
    addLog(
      'debug',
      `📌 Текущая закладка: "${bookmarkData.title}" (${bookmarkData.type || 'unknown'})`
    );
    if (bookmarkData.path && bookmarkData.path.length > 0) {
      addLog('debug', `   📂 Путь: ${bookmarkData.path.join(' > ')}`);
    }
  }
}

async function loadCurrentTab() {
  addLog('info', '🔄 Загрузка текущей вкладки...');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'get_current_tab',
    });

    if (response && !response.error) {
      updateCurrentTabDisplay(response.tab, response.bookmark);

      if (response.tab) {
        addLog('info', `✅ Текущая вкладка: ${response.tab.title || '—'}`);
      }

      if (response.bookmark) {
        addLog('info', `   📌 Закладка: ${response.bookmark.title}`);
        if (response.bookmark.type) {
          addLog('info', `   🏷️  Тип: ${response.bookmark.type}`);
        }
        // Детальные логи
        logBookmarkRequestDetails(response.bookmark, {
          url: response.tab?.url,
          timestamp: Date.now(),
          source: 'popup_open',
        });
      } else {
        addLog('warn', '   ⚠️ Закладка не найдена для этого URL');
      }
    } else {
      addLog('error', '❌ Не удалось получить текущую вкладку');
    }
  } catch (error) {
    addLog('error', `❌ Ошибка: ${error.message}`);
  }
}

// ============================================================
// 11. ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================

// Вкладки
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'bookmarks' && STATE.bookmarks.length === 0) {
      loadBookmarks();
    }
    if (tab === 'logs') {
      renderLogs();
    }
    if (tab === 'info') {
      loadCurrentTab();
    }
  });
});

// Настройки: Сохранить
document.getElementById('btn-save-settings').addEventListener('click', () => {
  STATE.settings.bridgeEnabled = document.getElementById('bridge-enabled').checked;
  STATE.settings.autoRespond = document.getElementById('auto-respond').checked;
  STATE.settings.timeout = parseInt(document.getElementById('timeout').value) || 5000;
  STATE.settings.cacheTTL = parseInt(document.getElementById('cache-ttl').value) || 30;
  STATE.settings.debugMode = document.getElementById('debug-mode').checked;
  STATE.settings.logLevel = document.getElementById('log-level').value;
  STATE.settings.maxLogs = parseInt(document.getElementById('max-logs').value) || 100;

  saveState();
  addLog('info', '💾 Настройки сохранены');

  chrome.runtime
    .sendMessage({
      action: 'update_settings',
      settings: STATE.settings,
    })
    .catch(() => {});

  showNotification('Настройки сохранены', 'success');
});

// Настройки: Сбросить
document.getElementById('btn-reset-settings').addEventListener('click', () => {
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

  document.getElementById('bridge-enabled').checked = true;
  document.getElementById('auto-respond').checked = true;
  document.getElementById('timeout').value = 5000;
  document.getElementById('cache-ttl').value = 30;
  document.getElementById('debug-mode').checked = false;
  document.getElementById('log-level').value = 'info';
  document.getElementById('max-logs').value = 100;

  saveState();
  updateStats();
  renderLogs();
  addLog('info', '↺ Настройки сброшены');
  showNotification('Настройки сброшены', 'info');
});

// Настройки: Очистить кеш
document.getElementById('btn-clear-cache').addEventListener('click', () => {
  if (!confirm('Очистить кеш закладок?')) return;

  chrome.runtime
    .sendMessage({ action: 'clear_cache' })
    .then(() => {
      STATE.stats.cacheSize = 0;
      updateStats();
      addLog('info', '🗑️ Кеш очищен');
      showNotification('Кеш очищен', 'success');
    })
    .catch(error => {
      addLog('error', `❌ Ошибка очистки кеша: ${error.message}`);
    });
});

// Закладки: Фильтр
document.getElementById('bookmark-filter').addEventListener('input', renderBookmarks);

// Закладки: Обновить
document.getElementById('btn-refresh-bookmarks').addEventListener('click', () => {
  loadBookmarks();
  showNotification('Закладки обновлены', 'info');
});

// Закладки: Экспорт
document.getElementById('btn-export-bookmarks').addEventListener('click', () => {
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
  a.click();
  URL.revokeObjectURL(url);

  addLog('info', `📤 Экспортировано ${STATE.bookmarks.length} закладок`);
  showNotification('Экспорт выполнен', 'success');
});

// Логи: Очистить
document.getElementById('btn-clear-logs').addEventListener('click', () => {
  STATE.logs = [];
  renderLogs();
  saveState();
  addLog('info', '🗑️ Логи очищены');
});

// Логи: Экспорт
document.getElementById('btn-export-logs').addEventListener('click', () => {
  const data = {
    timestamp: new Date().toISOString(),
    total: STATE.logs.length,
    logs: STATE.logs,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `logs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showNotification('Логи экспортированы', 'success');
});

// Логи: Фильтр
document.getElementById('log-filter').addEventListener('change', renderLogs);

// Инфо: Обновить вкладку
document.getElementById('btn-refresh-tab')?.addEventListener('click', () => {
  loadCurrentTab();
  addLog('info', '🔄 Принудительное обновление данных вкладки');
  showNotification('Данные вкладки обновлены', 'info');
});

// Инфо: Ссылки
document.getElementById('link-manager')?.addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('../Bookmarklet/manager.html') });
});

document.getElementById('link-install')?.addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('../install.html') });
});

document.getElementById('link-debug')?.addEventListener('click', e => {
  e.preventDefault();
  chrome.tabs.create({ url: 'about:debugging' });
});

// ============================================================
// 12. ПОДПИСКА НА СООБЩЕНИЯ ОТ BACKGROUND
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    loadBookmarks();
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'connection_status') {
    updateConnectionStatus();
    sendResponse({ received: true });
    return true;
  }

  if (message.action === 'tab_updated') {
    addLog('info', `🔄 Вкладка обновлена: ${message.tab?.title || '—'}`);
    updateCurrentTabDisplay(message.tab, message.bookmark);

    if (message.bookmark) {
      addLog('info', `   📌 Закладка: ${message.bookmark.title}`);
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
    addLog('info', `🗑️ Вкладка закрыта: ${message.tabId}`);
    currentTabInfo = null;
    currentBookmarkInfo = null;

    const titleEl = document.getElementById('current-tab-title');
    const urlEl = document.getElementById('current-tab-url');
    const bookmarkTitleEl = document.getElementById('current-bookmark-title');
    const bookmarkTypeEl = document.getElementById('current-bookmark-type');
    const statusText = document.getElementById('status-text');

    if (titleEl) titleEl.textContent = '—';
    if (urlEl) urlEl.textContent = '—';
    if (bookmarkTitleEl) bookmarkTitleEl.textContent = '—';
    if (bookmarkTypeEl) bookmarkTypeEl.textContent = '—';
    if (statusText) statusText.textContent = 'Активно';

    sendResponse({ received: true });
    return true;
  }

  return false;
});

// ============================================================
// 13. КОНСОЛЬНЫЕ КОМАНДЫ
// ============================================================

// Функция для ручного запроса деталей закладки из консоли
window.requestBookmarkDetails = async function (url) {
  const targetUrl = url || window.location.href;
  addLog('info', `🔍 Запрос деталей для: ${targetUrl}`);

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'find_bookmark_by_url',
      url: targetUrl,
      requestId: Date.now().toString(36),
      timestamp: Date.now(),
    });

    if (response && response.title) {
      logBookmarkRequestDetails(response, {
        url: targetUrl,
        timestamp: Date.now(),
        source: 'console',
      });
      console.log('📊 Данные закладки:', response);
      return response;
    } else {
      addLog('warn', '⚠️ Закладка не найдена');
      return null;
    }
  } catch (error) {
    addLog('error', `❌ Ошибка: ${error.message}`);
    return null;
  }
};

// ============================================================
// 14. ИНИЦИАЛИЗАЦИЯ
// ============================================================

async function init() {
  // Загружаем состояние
  loadState();

  // Применяем настройки к UI
  document.getElementById('bridge-enabled').checked = STATE.settings.bridgeEnabled;
  document.getElementById('auto-respond').checked = STATE.settings.autoRespond;
  document.getElementById('timeout').value = STATE.settings.timeout;
  document.getElementById('cache-ttl').value = STATE.settings.cacheTTL;
  document.getElementById('debug-mode').checked = STATE.settings.debugMode;
  document.getElementById('log-level').value = STATE.settings.logLevel;
  document.getElementById('max-logs').value = STATE.settings.maxLogs;

  // Обновляем статистику
  updateStats();

  // Показываем логи
  renderLogs();

  // Обновляем статус подключения
  updateConnectionStatus();

  // Показываем ID расширения
  document.getElementById('extension-id').textContent =
    chrome.runtime.id?.substring(0, 8) || 'unknown';

  // Обновляем время
  updateTime();

  // Добавляем приветственное сообщение
  addLog('info', '📦 Расширение Bookmarklet Bridge запущено');
  addLog('info', '📌 Версия: 1.0.0');

  // Загружаем текущую вкладку
  await loadCurrentTab();

  // Загружаем закладки в фоне
  setTimeout(() => {
    loadBookmarks();
    addLog('info', '📑 Закладки загружены');
  }, 500);

  // Запускаем таймеры для обновления
  setInterval(updateConnectionStatus, 5000);
  setInterval(updateTime, 10000);

  // Экспортируем команды в консоль
  console.log('📦 Bookmarklet Bridge Popup загружен');
  console.log('📋 Доступные команды:');
  console.log('  requestBookmarkDetails([url]) - получить детали закладки');
  console.log('  STATE - текущее состояние');
  console.log('  addLog(level, message, data) - добавить лог');
  console.log('  loadCurrentTab() - обновить текущую вкладку');
  console.log('  loadBookmarks() - перезагрузить закладки');
}

// Запускаем инициализацию
init();
