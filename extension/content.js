// content.js - Мост между страницей и расширением
// Перехватывает сообщения от букмарклетов и отправляет их в background

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  debug: true,
  sources: ['my-bookmarklet', 'bookmarklet-debug', 'my-bookmarklet-extension'],
  types: ['REQUEST_BOOKMARK_DATA', 'REQUEST_BOOKMARK_DATA_DEBUG', 'GET_BOOKMARK_DATA'],
  timeout: 5000,
  retryAttempts: 3,
  retryDelay: 1000,
};

// ============================================================
// 2. ЛОГГЕР
// ============================================================

const logger = {
  log: function (level, message, data) {
    if (!CONFIG.debug && level !== 'error') return;

    const prefix = '[Bookmarklet Bridge Content]';
    const timestamp = new Date().toISOString().slice(11, 23);

    switch (level) {
      case 'error':
        console.error(`${prefix} ❌ [${timestamp}] ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️ [${timestamp}] ${message}`, data || '');
        break;
      case 'debug':
        console.log(`${prefix} 🔍 [${timestamp}] ${message}`, data || '');
        break;
      case 'info':
        console.log(`${prefix} ℹ️ [${timestamp}] ${message}`, data || '');
        break;
      case 'trace':
        console.log(`${prefix} 🐛 [${timestamp}] ${message}`, data || '');
        break;
      default:
        console.log(`${prefix} 📌 [${timestamp}] ${message}`, data || '');
    }
  },
  error: function (msg, data) {
    this.log('error', msg, data);
  },
  warn: function (msg, data) {
    this.log('warn', msg, data);
  },
  debug: function (msg, data) {
    this.log('debug', msg, data);
  },
  info: function (msg, data) {
    this.log('info', msg, data);
  },
  trace: function (msg, data) {
    this.log('trace', msg, data);
  },
};

// ============================================================
// 3. КЕШ ДЛЯ БЫСТРЫХ ОТВЕТОВ
// ============================================================

const cache = new Map();
const CACHE_TTL = 30000; // 30 секунд

function getCachedData(url) {
  if (cache.has(url)) {
    const entry = cache.get(url);
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      logger.trace(`Кеш hit для: ${url}`);
      return entry.data;
    }
    cache.delete(url);
    logger.trace(`Кеш expired для: ${url}`);
  }
  return null;
}

function setCachedData(url, data) {
  cache.set(url, {
    data: data,
    timestamp: Date.now(),
  });
  logger.trace(`Кеш сохранен для: ${url}`);
}

// ============================================================
// 4. ОБРАБОТЧИК СООБЩЕНИЙ ОТ СТРАНИЦЫ
// ============================================================

window.addEventListener('message', async event => {
  // Проверяем источник сообщения
  if (!event.data || typeof event.data !== 'object') return;

  // Проверяем, что сообщение от нашего букмарклета
  const isFromBookmarklet = event.data.source && CONFIG.sources.includes(event.data.source);

  const isRequestType = event.data.type && CONFIG.types.includes(event.data.type);

  if (!isFromBookmarklet || !isRequestType) {
    // Если сообщение не от нашего букмарклета, игнорируем
    if (event.data.source && event.data.type) {
      logger.trace(`Игнорируем сообщение: ${event.data.source}:${event.data.type}`);
    }
    return;
  }

  logger.info(`Получен запрос от букмарклета:`, {
    source: event.data.source,
    type: event.data.type,
    url: event.data.currentUrl || window.location.href,
  });

  // Извлекаем URL страницы (из сообщения или из текущего окна)
  const url = event.data.currentUrl || window.location.href;
  const tabId = event.data.tabId;
  const requestId =
    event.data.requestId || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  logger.debug(`URL страницы: ${url}`);
  logger.debug(`Request ID: ${requestId}`);

  // Проверяем кеш
  const cachedData = getCachedData(url);
  if (cachedData) {
    logger.info(`Отправка кешированных данных для: ${url}`);
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

  // Отправляем запрос в фоновый скрипт с retry механизмом
  let attempt = 0;
  let lastError = null;

  while (attempt < CONFIG.retryAttempts) {
    attempt++;
    logger.trace(`Попытка ${attempt}/${CONFIG.retryAttempts}`);

    try {
      const response = await sendMessageToBackground(url, tabId);

      // Проверяем ответ
      if (response && response.title) {
        logger.info(`Получены данные: "${response.title}" (тип: ${response.type || 'unknown'})`);

        // Сохраняем в кеш
        setCachedData(url, response);

        // Отправляем ответ букмарклету
        window.postMessage(
          {
            source: 'my-extension-bridge',
            type: 'BOOKMARK_DATA_RESPONSE',
            payload: response,
            requestId: requestId,
          },
          '*'
        );

        return;
      } else {
        logger.warn(`Пустой ответ, попытка ${attempt}`);
        lastError = new Error('Пустой ответ от background');
      }
    } catch (error) {
      logger.error(`Ошибка в попытке ${attempt}: ${error.message}`, error);
      lastError = error;

      if (attempt < CONFIG.retryAttempts) {
        logger.info(`Повтор через ${CONFIG.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
      }
    }
  }

  // Все попытки неудачны
  logger.error(`Не удалось получить данные после ${CONFIG.retryAttempts} попыток`);

  // Отправляем fallback ответ
  window.postMessage(
    {
      source: 'my-extension-bridge',
      type: 'BOOKMARK_DATA_RESPONSE',
      payload: {
        title: document.title || 'Неизвестная закладка',
        type: 'unknown',
        url: url,
        error: lastError ? lastError.message : 'Неизвестная ошибка',
        isFallback: true,
        customConfig: {},
        timestamp: Date.now(),
      },
      requestId: requestId,
    },
    '*'
  );
});

// ============================================================
// 5. ОТПРАВКА СООБЩЕНИЯ В BACKGROUND
// ============================================================

function sendMessageToBackground(url, tabId) {
  return new Promise((resolve, reject) => {
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
        },
        response => {
          clearTimeout(timeout);

          // Проверяем ошибки
          if (chrome.runtime.lastError) {
            logger.error(`Ошибка отправки сообщения: ${chrome.runtime.lastError.message}`);
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
// 6. ОБРАБОТКА ОТВЕТОВ ОТ ФОНОВОГО СКРИПТА
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'bookmark_data_response') {
    logger.info(`Получен ответ от фонового скрипта:`, {
      title: request.data?.title,
      type: request.data?.type,
      id: request.data?.id,
    });

    // Сохраняем в кеш если есть URL
    if (request.data && request.data.url) {
      setCachedData(request.data.url, request.data);
    }

    // Пересылаем ответ букмарклету
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

  // Обработка ручного запроса от консоли
  if (request.action === 'manual_bookmark_request') {
    logger.info('Ручной запрос данных от консоли');

    findBookmarkData(request.url || window.location.href)
      .then(data => {
        sendResponse(data);
      })
      .catch(error => {
        logger.error('Ошибка ручного запроса:', error.message);
        sendResponse({ error: error.message });
      });

    return true;
  }
});

// ============================================================
// 7. ОСНОВНАЯ ФУНКЦИЯ ПОИСКА
// ============================================================

async function findBookmarkData(url) {
  logger.info(`Поиск данных для URL: ${url}`);

  // Проверяем кеш
  const cached = getCachedData(url);
  if (cached) {
    logger.info(`Найдено в кеше: "${cached.title}"`);
    return cached;
  }

  // Отправляем запрос в background
  try {
    const response = await sendMessageToBackground(url);

    if (response && response.title) {
      setCachedData(url, response);
      logger.info(`Найдены данные: "${response.title}"`);
      return response;
    }

    logger.warn('Данные не найдены');
    return null;
  } catch (error) {
    logger.error(`Ошибка поиска: ${error.message}`);
    throw error;
  }
}

// ============================================================
// 8. ИНИЦИАЛИЗАЦИЯ
// ============================================================

logger.info('═══════════════════════════════════════════════════════════');
logger.info('📦 Bookmarklet Bridge Content Script v2.0');
logger.info('═══════════════════════════════════════════════════════════');
logger.info(`📍 URL: ${window.location.href}`);
logger.info(`🔧 Sources: ${CONFIG.sources.join(', ')}`);
logger.info(`📋 Types: ${CONFIG.types.join(', ')}`);
logger.info(`⏱️  Таймаут: ${CONFIG.timeout}ms`);
logger.info(`🔄 Retry: ${CONFIG.retryAttempts} попыток`);
logger.info(`💾 Кеш: ${cache.size} записей`);

// ============================================================
// 9. ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КОНСОЛИ
// ============================================================

// Функция для ручного запроса данных из консоли
function requestBookmarkData(url) {
  const targetUrl = url || window.location.href;
  logger.info(`📡 Ручной запрос данных для: ${targetUrl}`);

  return findBookmarkData(targetUrl)
    .then(data => {
      if (data) {
        console.log('📊 Данные закладки:');
        console.table(data);
        return data;
      } else {
        console.warn('⚠️ Данные не найдены');
        return null;
      }
    })
    .catch(error => {
      console.error('❌ Ошибка:', error.message);
      return null;
    });
}

// Функция очистки кеша
function clearBookmarkCache() {
  const size = cache.size;
  cache.clear();
  logger.info(`🗑️ Кеш очищен (${size} записей)`);
  return size;
}

// Функция получения статистики
function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    config: {
      debug: CONFIG.debug,
      timeout: CONFIG.timeout,
      retryAttempts: CONFIG.retryAttempts,
      retryDelay: CONFIG.retryDelay,
    },
  };
}

// Экспортируем в глобальный объект для отладки
if (typeof window !== 'undefined') {
  window.__bookmarkBridge = {
    logger: logger,
    CONFIG: CONFIG,
    cache: cache,
    requestBookmarkData: requestBookmarkData,
    clearCache: clearBookmarkCache,
    getCacheStats: getCacheStats,
    findBookmarkData: findBookmarkData,
  };
}

logger.info('📋 Доступны команды:');
logger.info('  window.__bookmarkBridge.requestBookmarkData([url]) - получить данные закладки');
logger.info('  window.__bookmarkBridge.clearCache() - очистить кеш');
logger.info('  window.__bookmarkBridge.getCacheStats() - статистика кеша');
logger.info('  window.__bookmarkBridge.findBookmarkData(url) - поиск данных');

// ============================================================
// 10. ОБРАБОТКА ОШИБОК
// ============================================================

window.addEventListener('error', event => {
  logger.error('Глобальная ошибка:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', event => {
  logger.error('Необработанное отклонение промиса:', {
    reason: event.reason,
    promise: event.promise,
  });
});

logger.info('✅ Content script готов к работе!');
logger.info('═══════════════════════════════════════════════════════════');
