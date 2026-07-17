// content.js - Мост между страницей и расширением
// УПРОЩЕНО: Без спама предупреждениями, проверка контекста один раз

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  debug: false,
  sources: ['my-bookmarklet', 'bookmarklet-debug', 'my-bookmarklet-extension'],
  types: ['REQUEST_BOOKMARK_DATA', 'REQUEST_BOOKMARK_DATA_DEBUG', 'GET_BOOKMARK_DATA'],
  timeout: 3000,
};

// ============================================================
// 2. ЛОГГЕР (минимальный, без спама)
// ============================================================

const logger = {
  error: function (msg, data) {
    console.error(`[Bookmarklet] ❌ ${msg}`, data || '');
  },
  warn: function (msg, data) {
    if (CONFIG.debug) {
      console.warn(`[Bookmarklet] ⚠️ ${msg}`, data || '');
    }
  },
  info: function (msg, data) {
    if (CONFIG.debug) {
      console.log(`[Bookmarklet] ℹ️ ${msg}`, data || '');
    }
  },
  debug: function (msg, data) {
    if (CONFIG.debug) {
      console.log(`[Bookmarklet] 🔍 ${msg}`, data || '');
    }
  },
};

// ============================================================
// 3. ПРОВЕРКА КОНТЕКСТА (ОДИН РАЗ)
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

// Проверяем при загрузке
checkExtensionAvailable();

// ============================================================
// 4. КЕШ
// ============================================================

const cache = new Map();
const CACHE_TTL = 30000;

function getCachedData(url) {
  if (cache.has(url)) {
    const entry = cache.get(url);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    cache.delete(url);
  }
  return null;
}

function setCachedData(url, data) {
  cache.set(url, {
    data: data,
    timestamp: Date.now(),
  });
}

// ============================================================
// 5. ОТПРАВКА В BACKGROUND
// ============================================================

function sendMessageToBackground(url, tabId) {
  return new Promise((resolve, reject) => {
    if (!extensionAvailable) {
      reject(new Error('Расширение недоступно'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Таймаут'));
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
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
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
// 6. ОБРАБОТЧИК ЗАПРОСОВ ОТ БУКМАРКЛЕТА
// ============================================================

window.addEventListener('message', async event => {
  if (!event.data || typeof event.data !== 'object') return;

console.log('message >>>>>>>>>>>>>>>>>> ', event);
  const isFromBookmarklet = event.data.source && CONFIG.sources.includes(event.data.source);
  const isRequestType = event.data.type && CONFIG.types.includes(event.data.type);

  if (!isFromBookmarklet || !isRequestType) return;

  const url = event.data.currentUrl || window.location.href;
  const requestId =
    event.data.requestId || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  // Проверяем кеш
  const cachedData = getCachedData(url);
  if (cachedData) {
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
    window.postMessage(
      {
        source: 'my-extension-bridge',
        type: 'BOOKMARK_DATA_RESPONSE',
        payload: {
          title: document.title || 'Неизвестная закладка',
          type: 'unknown',
          url: url,
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

  // Отправляем запрос
  try {
    const response = await sendMessageToBackground(url);
    if (response && response.title) {
      setCachedData(url, response);
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
      window.postMessage(
        {
          source: 'my-extension-bridge',
          type: 'BOOKMARK_DATA_RESPONSE',
          payload: {
            title: document.title || 'Неизвестная закладка',
            type: 'unknown',
            url: url,
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
    window.postMessage(
      {
        source: 'my-extension-bridge',
        type: 'BOOKMARK_DATA_RESPONSE',
        payload: {
          title: document.title || 'Неизвестная закладка',
          type: 'unknown',
          url: url,
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
// 7. ОБРАБОТКА ОТВЕТОВ ОТ BACKGROUND
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'bookmark_data_response') {
    if (request.data && request.data.url) {
      setCachedData(request.data.url, request.data);
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
// 8. КОНСОЛЬНЫЕ КОМАНДЫ
// ============================================================

function requestBookmarkData(url) {
  const targetUrl = url || window.location.href;
  console.log(`📡 Запрос данных для: ${targetUrl}`);

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
  return available;
}

// ============================================================
// 9. ЭКСПОРТ
// ============================================================

if (typeof window !== 'undefined') {
  window.__bookmarkBridge = {
    requestBookmarkData: requestBookmarkData,
    clearCache: clearBookmarkCache,
    checkExtension: checkExtension,
    isAvailable: () => extensionAvailable,
  };
}

// ============================================================
// 10. ИНИЦИАЛИЗАЦИЯ (без спама)
// ============================================================

console.log('📦 Bookmarklet Bridge Content Script v3.0');
console.log(
  `📌 Расширение: ${extensionAvailable ? '✅ доступно' : '❌ недоступно (работает в fallback режиме)'}`
);
console.log(
  '📋 Команды: __bookmarkBridge.requestBookmarkData(), __bookmarkBridge.checkExtension()'
);
