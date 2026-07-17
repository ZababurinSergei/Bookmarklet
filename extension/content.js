// content.js - Мост между букмарклетом и расширением
// ИСПРАВЛЕНО: Получение tabId через background
// ИСПРАВЛЕНО: Логгер с правильным контекстом
// ДОБАВЛЕНО: Запрос закладки по tabId

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  debug: true,
  sources: ['my-bookmarklet', 'bookmarklet-debug', 'my-bookmarklet-extension'],
  types: ['REQUEST_BOOKMARK_DATA', 'REQUEST_BOOKMARK_DATA_DEBUG', 'GET_BOOKMARK_DATA'],
  timeout: 5000,
};

// ============================================================
// 2. ЛОГГЕР (ИСПРАВЛЕННЫЙ)
// ============================================================

const logger = {
  _log: function (level, message, data) {
    if (!CONFIG.debug && level !== 'error') return;
    const prefix = `[Bookmarklet]`;
    const timestamp = new Date().toISOString().slice(11, 19);

    switch (level) {
      case 'error':
        console.error(`${prefix} ❌ ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️ ${message}`, data || '');
        break;
      case 'debug':
        console.log(`${prefix} 🔍 ${message}`, data || '');
        break;
      default:
        console.log(`${prefix} ℹ️ ${message}`, data || '');
    }
  },
  error: (msg, d) => logger._log('error', msg, d),
  warn: (msg, d) => logger._log('warn', msg, d),
  info: (msg, d) => logger._log('info', msg, d),
  debug: (msg, d) => logger._log('debug', msg, d),
};

// ============================================================
// 3. ПОЛУЧАЕМ TAB ID ЧЕРЕЗ BACKGROUND
// ============================================================

async function getTabIdFromBackground() {
  return new Promise(resolve => {
    if (!extensionAvailable) {
      resolve(null);
      return;
    }

    try {
      chrome.runtime.sendMessage(
        {
          action: 'get_tab_id',
          timestamp: Date.now(),
        },
        response => {
          if (chrome.runtime.lastError) {
            logger.warn('⚠️ Ошибка получения tabId:', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          resolve(response?.tabId || null);
        }
      );
    } catch (error) {
      logger.warn('⚠️ Ошибка получения tabId:', error.message);
      resolve(null);
    }
  });
}

// ============================================================
// 4. ПРОВЕРКА ДОСТУПНОСТИ РАСШИРЕНИЯ
// ============================================================

let extensionAvailable = false;

function checkExtensionAvailable() {
  try {
    extensionAvailable = !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    extensionAvailable = false;
  }
  return extensionAvailable;
}

checkExtensionAvailable();

// ============================================================
// 5. ИНИЦИАЛИЗАЦИЯ TAB ID
// ============================================================

let tabIdInitialized = false;

async function initTabId() {
  if (tabIdInitialized) return;

  const tabId = await getTabIdFromBackground();
  if (tabId) {
    window.__tabId = tabId;
    logger.info(`📌 Tab ID установлен: ${tabId}`);
  } else {
    logger.warn('⚠️ Не удалось получить tabId');
    window.__tabId = null;
  }
  tabIdInitialized = true;
}

// Запускаем инициализацию
initTabId();

// ============================================================
// 6. КЕШ
// ============================================================

const cache = new Map();
const CACHE_TTL = 30000;

function getCachedData(key) {
  if (cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    cache.delete(key);
  }
  return null;
}

function setCachedData(key, data) {
  cache.set(key, {
    data: data,
    timestamp: Date.now(),
  });
}

// ============================================================
// 7. ОТПРАВКА ЗАПРОСА В BACKGROUND
// ============================================================

function sendMessageToBackground(url, tabId) {
  return new Promise((resolve, reject) => {
    if (!extensionAvailable) {
      reject(new Error('Расширение недоступно'));
      return;
    }

    logger.debug(`📤 Отправка запроса в background для: ${url}`);
    logger.debug(`📌 Tab ID: ${tabId}`);

    const timeout = setTimeout(() => {
      reject(new Error('Таймаут ожидания ответа от background'));
    }, CONFIG.timeout);

    try {
      chrome.runtime.sendMessage(
        {
          action: 'find_bookmark_by_url',
          url: url,
          tabId: tabId,
          timestamp: Date.now(),
          source: 'content_script',
        },
        response => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            logger.error('Ошибка background:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          logger.debug('📥 Ответ от background:', response);
          resolve(response);
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// ============================================================
// 8. ЗАПРОС ЗАКЛАДКИ ПО TAB ID (НОВЫЙ МЕТОД)
// ============================================================

function getBookmarkByTabId(tabId) {
  return new Promise((resolve, reject) => {
    if (!extensionAvailable) {
      reject(new Error('Расширение недоступно'));
      return;
    }

    logger.debug(`📤 Запрос закладки по tabId: ${tabId}`);

    const timeout = setTimeout(() => {
      reject(new Error('Таймаут ожидания ответа от background'));
    }, CONFIG.timeout);

    try {
      chrome.runtime.sendMessage(
        {
          action: 'find_bookmark_by_tab_id',
          tabId: tabId,
          timestamp: Date.now(),
          source: 'content_script',
        },
        response => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            logger.error('Ошибка background:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          logger.debug('📥 Ответ от background:', response);
          resolve(response);
        }
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// ============================================================
// 9. ПОЛУЧЕНИЕ ТЕКУЩЕЙ ЗАКЛАДКИ ПО TAB ID
// ============================================================

async function getCurrentTabBookmark() {
  const tabId = window.__tabId;
  if (!tabId) {
    logger.warn('⚠️ Tab ID не установлен');
    return null;
  }

  try {
    const bookmark = await getBookmarkByTabId(tabId);
    if (bookmark) {
      logger.info(`✅ Найдена закладка для текущей вкладки: ${bookmark.title}`);
      return bookmark;
    } else {
      logger.warn('⚠️ Закладка не найдена для текущей вкладки');
      return null;
    }
  } catch (error) {
    logger.error('❌ Ошибка получения закладки по tabId:', error.message);
    return null;
  }
}

// ============================================================
// 10. ОБРАБОТЧИК ЗАПРОСОВ ОТ БУКМАРКЛЕТА
// ============================================================

window.addEventListener('message', async event => {
  if (!event.data || typeof event.data !== 'object') return;

  const isFromBookmarklet = event.data.source && CONFIG.sources.includes(event.data.source);
  const isRequestType = event.data.type && CONFIG.types.includes(event.data.type);

  if (!isFromBookmarklet || !isRequestType) return;

  const url = event.data.currentUrl || window.location.href;
  const tabId = event.data.tabId || window.__tabId || null;
  const requestId =
    event.data.requestId || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  logger.info(`📨 Получен запрос от букмарклета для URL: ${url}`);
  logger.info(`📌 Tab ID: ${tabId}`);

  // Проверяем кеш
  const cacheKey = `${url}_${tabId}`;
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    logger.info('✅ Отправка из кеша');
    window.postMessage(
      {
        source: 'my-extension-bridge',
        type: 'BOOKMARK_DATA_RESPONSE',
        payload: cachedData,
        requestId: requestId,
      },
      '*'
    );
    return;
  }

  // Если расширение недоступно — fallback
  if (!extensionAvailable) {
    logger.warn('⚠️ Расширение недоступно, fallback');
    window.postMessage(
      {
        source: 'my-extension-bridge',
        type: 'BOOKMARK_DATA_RESPONSE',
        payload: {
          title: document.title || 'Неизвестная закладка',
          type: 'unknown',
          url: url,
          tabId: tabId,
          isFallback: true,
          extensionAvailable: false,
          timestamp: Date.now(),
        },
        requestId: requestId,
      },
      '*'
    );
    return;
  }

  // Если есть tabId, сначала пробуем найти по нему
  if (tabId) {
    try {
      const bookmarkByTab = await getBookmarkByTabId(tabId);
      if (bookmarkByTab && bookmarkByTab.title) {
        setCachedData(cacheKey, bookmarkByTab);
        logger.info(`✅ Найдено по tabId ${tabId}: ${bookmarkByTab.title}`);
        window.postMessage(
          {
            source: 'my-extension-bridge',
            type: 'BOOKMARK_DATA_RESPONSE',
            payload: bookmarkByTab,
            requestId: requestId,
          },
          '*'
        );
        return;
      }
    } catch (error) {
      logger.warn('⚠️ Ошибка поиска по tabId:', error.message);
    }
  }

  // Отправляем запрос в background (поиск по URL)
  try {
    const response = await sendMessageToBackground(url, tabId);

    if (response && response.title) {
      setCachedData(cacheKey, response);
      logger.info(`✅ Получены данные: ${response.title} (${response.type || 'unknown'})`);
      window.postMessage(
        {
          source: 'my-extension-bridge',
          type: 'BOOKMARK_DATA_RESPONSE',
          payload: response,
          requestId: requestId,
        },
        '*'
      );
    } else {
      logger.warn('⚠️ Данные не найдены');
      window.postMessage(
        {
          source: 'my-extension-bridge',
          type: 'BOOKMARK_DATA_RESPONSE',
          payload: {
            title: document.title || 'Неизвестная закладка',
            type: 'unknown',
            url: url,
            tabId: tabId,
            isFallback: true,
            extensionAvailable: true,
            timestamp: Date.now(),
          },
          requestId: requestId,
        },
        '*'
      );
    }
  } catch (error) {
    logger.error('❌ Ошибка:', error.message);
    window.postMessage(
      {
        source: 'my-extension-bridge',
        type: 'BOOKMARK_DATA_RESPONSE',
        payload: {
          title: document.title || 'Неизвестная закладка',
          type: 'unknown',
          url: url,
          tabId: tabId,
          error: error.message,
          isFallback: true,
          extensionAvailable: extensionAvailable,
          timestamp: Date.now(),
        },
        requestId: requestId,
      },
      '*'
    );
  }
});

// ============================================================
// 11. ОБРАБОТКА ОТВЕТОВ ОТ BACKGROUND
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'bookmark_data_response') {
    if (request.data && request.data.url) {
      const cacheKey = `${request.data.url}_${request.data.tabId || ''}`;
      setCachedData(cacheKey, request.data);
    }

    window.postMessage(
      {
        source: 'my-extension-bridge',
        type: 'BOOKMARK_DATA_RESPONSE',
        payload: request.data,
        requestId: request.requestId || Date.now().toString(36),
      },
      '*'
    );

    sendResponse({ received: true });
    return true;
  }

  return false;
});

// ============================================================
// 12. КОНСОЛЬНЫЕ КОМАНДЫ
// ============================================================

function requestBookmarkData(url) {
  const targetUrl = url || window.location.href;
  const tabId = window.__tabId || null;
  console.log(`📡 Запрос данных для: ${targetUrl}`);
  console.log(`📌 Tab ID: ${tabId}`);

  return new Promise(resolve => {
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

    const handler = event => {
      if (
        event.data &&
        event.data.source === 'my-extension-bridge' &&
        event.data.type === 'BOOKMARK_DATA_RESPONSE' &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener('message', handler);
        resolve(event.data.payload);
      }
    };

    window.addEventListener('message', handler);

    window.postMessage(
      {
        source: 'my-bookmarklet',
        type: 'REQUEST_BOOKMARK_DATA',
        currentUrl: targetUrl,
        tabId: tabId,
        bookmarkletName: 'ENV Control',
        title: document.title,
        requestId: requestId,
      },
      '*'
    );

    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve(null);
    }, CONFIG.timeout);
  });
}

function clearBookmarkCache() {
  const size = cache.size;
  cache.clear();
  console.log(`🗑️ Кеш очищен (${size} записей)`);
  return size;
}

function checkExtension() {
  const available = checkExtensionAvailable();
  console.log(`📌 Расширение: ${available ? '✅ доступно' : '❌ недоступно'}`);
  console.log(`📌 Tab ID: ${window.__tabId || 'не установлен'}`);
  return available;
}

// ============================================================
// 13. ЭКСПОРТ
// ============================================================

if (typeof window !== 'undefined') {
  window.__bookmarkBridge = {
    requestBookmarkData: requestBookmarkData,
    sendMessageToBackground: sendMessageToBackground,
    getBookmarkByTabId: getBookmarkByTabId,
    getCurrentTabBookmark: getCurrentTabBookmark,
    clearCache: clearBookmarkCache,
    checkExtension: checkExtension,
    getTabId: () => window.__tabId,
    initTabId: initTabId,
    isAvailable: () => extensionAvailable,
  };
}

// ============================================================
// 14. ИНИЦИАЛИЗАЦИЯ
// ============================================================

console.log('📦 Bookmarklet Bridge Content Script v3.3');
console.log(`📌 Расширение: ${extensionAvailable ? '✅ доступно' : '❌ недоступно'}`);
console.log(`📌 Tab ID: ${window.__tabId || 'инициализация...'}`);
console.log('');
console.log('📋 Команды:');
console.log('  __bookmarkBridge.requestBookmarkData()     - запросить данные закладки');
console.log('  __bookmarkBridge.sendMessageToBackground() - отправить запрос');
console.log('  __bookmarkBridge.getBookmarkByTabId(id)    - получить закладку по tabId');
console.log('  __bookmarkBridge.getCurrentTabBookmark()   - получить закладку текущей вкладки');
console.log('  __bookmarkBridge.checkExtension()          - проверить статус');
console.log('  __bookmarkBridge.clearCache()              - очистить кеш');
console.log('  __bookmarkBridge.getTabId()                - получить Tab ID');
console.log('  __bookmarkBridge.initTabId()               - переинициализировать Tab ID');
