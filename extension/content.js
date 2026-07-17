// content.js - Мост между страницей и расширением
// С ПОДРОБНЫМ ВЫВОДОМ ВСЕХ ДАННЫХ ЗАПРОСА

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  debug: true, // Включаем debug для просмотра всех данных
  sources: ['my-bookmarklet', 'bookmarklet-debug', 'my-bookmarklet-extension'],
  types: ['REQUEST_BOOKMARK_DATA', 'REQUEST_BOOKMARK_DATA_DEBUG', 'GET_BOOKMARK_DATA'],
  timeout: 3000,
};

// ============================================================
// 2. ЛОГГЕР (с подробным выводом)
// ============================================================

const logger = {
  error: function (msg, data) {
    console.error(`[Bookmarklet] ❌ ${msg}`, data || '');
  },
  warn: function (msg, data) {
    console.warn(`[Bookmarklet] ⚠️ ${msg}`, data || '');
  },
  info: function (msg, data) {
    console.log(`[Bookmarklet] ℹ️ ${msg}`, data || '');
  },
  debug: function (msg, data) {
    console.log(`[Bookmarklet] 🔍 ${msg}`, data || '');
  },
  // Специальный метод для вывода данных запроса
  logRequestData: function (eventData) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📨 ДАННЫЕ ЗАПРОСА ОТ БУКМАРКЛЕТА');
    console.log('═══════════════════════════════════════════════════════════');

    // Выводим все поля с деталями
    const fields = [
      { key: 'source', label: '📡 Источник' },
      { key: 'type', label: '📋 Тип запроса' },
      { key: 'currentUrl', label: '📍 Текущий URL' },
      { key: 'bookmarkletName', label: '📛 Имя букмарклета' },
      { key: 'title', label: '📄 Заголовок страницы' },
      { key: 'tabId', label: '🆔 ID вкладки' },
      { key: 'requestId', label: '🔢 ID запроса' },
      { key: 'timestamp', label: '⏱️ Время' },
    ];

    for (const field of fields) {
      const value = eventData[field.key];
      if (value !== undefined && value !== null) {
        console.log(`   ${field.label}: ${value}`);
      }
    }

    // Выводим все остальные поля
    const otherFields = Object.keys(eventData).filter(
      k => !fields.some(f => f.key === k) && k !== 'source' && k !== 'type'
    );

    if (otherFields.length > 0) {
      console.log('   📦 Дополнительные поля:');
      for (const key of otherFields) {
        console.log(`      ${key}: ${JSON.stringify(eventData[key])}`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 АНАЛИЗ ЗАПРОСА:');

    // Анализируем, что ищем
    const searchTerms = [];
    if (eventData.bookmarkletName) {
      searchTerms.push(`📛 по имени: "${eventData.bookmarkletName}"`);
    }
    if (eventData.title) {
      searchTerms.push(`📄 по заголовку: "${eventData.title}"`);
    }
    if (eventData.currentUrl && !eventData.currentUrl.startsWith('chrome://')) {
      searchTerms.push(`📍 по URL: "${eventData.currentUrl}"`);
    }

    if (searchTerms.length > 0) {
      console.log(`   🔎 Будем искать: ${searchTerms.join(', ')}`);
    } else {
      console.log('   ⚠️ Не указаны критерии поиска!');
      console.log('   💡 Добавьте в запрос поля: bookmarkletName, title или currentUrl');
    }

    console.log('═══════════════════════════════════════════════════════════');
  },
};

// ============================================================
// 3. ПРОВЕРКА КОНТЕКСТА
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

function sendMessageToBackground(url, requestDetails = {}) {
  return new Promise((resolve, reject) => {
    if (!extensionAvailable) {
      reject(new Error('Расширение недоступно'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Таймаут'));
    }, CONFIG.timeout);

    try {
      const message = {
        action: 'find_bookmark_by_url',
        url: url,
        timestamp: Date.now(),
        source: 'content_script',
        ...requestDetails, // передаём все дополнительные поля
      };

      logger.debug(`📤 Отправка в background:`, message);

      chrome.runtime.sendMessage(message, response => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// ============================================================
// 6. ОБРАБОТЧИК ЗАПРОСОВ ОТ БУКМАРКЛЕТА (С ПОДРОБНЫМ ВЫВОДОМ)
// ============================================================

window.addEventListener('message', async event => {
  // Проверяем, что это сообщение
  if (!event.data || typeof event.data !== 'object') return;

  // Проверяем, что сообщение от нашего букмарклета
  const isFromBookmarklet = event.data.source && CONFIG.sources.includes(event.data.source);
  const isRequestType = event.data.type && CONFIG.types.includes(event.data.type);

  if (!isFromBookmarklet || !isRequestType) return;

  // ============================================================
  // ПОДРОБНЫЙ ВЫВОД ВСЕХ ДАННЫХ ЗАПРОСА
  // ============================================================
  logger.logRequestData(event.data);

  const url = event.data.currentUrl || window.location.href;
  const requestId =
    event.data.requestId || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  // Проверяем кеш
  const cachedData = getCachedData(url);
  if (cachedData) {
    logger.info(`📤 Отправка кешированных данных для: ${url}`);
    logger.debug(`   📦 Кеш: ${cachedData.title} (${cachedData.type})`);
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
    logger.warn('⚠️ Расширение недоступно, отправляем fallback');
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

  // Отправляем запрос в background с дополнительными данными
  try {
    const requestDetails = {
      bookmarkletName: event.data.bookmarkletName || event.data.name,
      title: event.data.title || document.title,
      tabTitle: document.title,
    };

    logger.info(`📤 Отправка запроса в background...`);
    logger.debug(`   📛 Имя: ${requestDetails.bookmarkletName || 'не указано'}`);
    logger.debug(`   📄 Заголовок: ${requestDetails.title || 'не указан'}`);

    const response = await sendMessageToBackground(url, requestDetails);

    if (response && response.title) {
      logger.info(`✅ Получен ответ: "${response.title}" (${response.type || 'unknown'})`);
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
      logger.warn('⚠️ Пустой ответ от background, отправляем fallback');
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
    logger.error(`❌ Ошибка: ${error.message}`);
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
// 10. ИНИЦИАЛИЗАЦИЯ
// ============================================================

console.log('📦 Bookmarklet Bridge Content Script v3.0');
console.log(`📌 Расширение: ${extensionAvailable ? '✅ доступно' : '❌ недоступно'}`);
console.log(
  '📋 Команды: __bookmarkBridge.requestBookmarkData(), __bookmarkBridge.checkExtension()'
);
