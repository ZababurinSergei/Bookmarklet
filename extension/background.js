// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/background.js
// Фоновый сервис расширения с детальным логированием
// Обрабатывает запросы от букмарклетов и ищет данные закладок

// ============================================================
// 1. КОНСТАНТЫ И КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  customConfigs: {
    'ENV Control': {
      type: 'env',
      version: '2.0.0',
      debug: true,
      features: ['panel', 'debug', 'logs'],
    },
    'Logs Control': {
      type: 'logs',
      version: '2.0.0',
      debug: true,
      features: ['logs', 'filter'],
    },
    'Debug Control': {
      type: 'debug',
      version: '2.0.0',
      debug: true,
      features: ['debug', 'presets'],
    },
    Manager: {
      type: 'manager',
      version: '2.0.0',
      debug: true,
      features: ['management', 'sw'],
    },
    Widget: {
      type: 'widget',
      version: '2.0.0',
      debug: true,
      features: ['widget', 'generate'],
    },
    'Toggle ENV Panel': {
      type: 'env',
      version: '2.0.0',
      debug: true,
      features: ['panel', 'toggle'],
    },
    'Toggle Logs Panel': {
      type: 'logs',
      version: '2.0.0',
      debug: true,
      features: ['logs', 'toggle'],
    },
    'Toggle Debug Panel': {
      type: 'debug',
      version: '2.0.0',
      debug: true,
      features: ['debug', 'toggle'],
    },
  },
  cache: new Map(),
  cacheTTL: 60000,
  requestLog: [],
  maxRequestLog: 100,
};

// ============================================================
// 2. ЛОГГЕР С ДЕТАЛЬНЫМ ВЫВОДОМ
// ============================================================

const logger = {
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    VERBOSE: 4,
  },
  level: 4,

  log: function (level, message, data = null) {
    if (level > this.level) return;

    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `[${timestamp}] [Bookmarklet Bridge]`;

    // Форматируем данные для красивого вывода
    let dataStr = '';
    if (data !== null) {
      if (typeof data === 'object') {
        try {
          dataStr =
            '\n' +
            JSON.stringify(
              data,
              (key, value) => {
                // Обрезаем длинные строки для читаемости
                if (typeof value === 'string' && value.length > 500) {
                  return value.substring(0, 500) + '... (обрезано)';
                }
                return value;
              },
              2
            );
        } catch {
          dataStr = ' [Object]';
        }
      } else {
        dataStr = ' ' + String(data);
      }
    }

    switch (level) {
      case this.levels.ERROR:
        console.error(`${prefix} ❌ ${message}${dataStr}`);
        break;
      case this.levels.WARN:
        console.warn(`${prefix} ⚠️ ${message}${dataStr}`);
        break;
      case this.levels.INFO:
        console.log(`${prefix} ℹ️ ${message}${dataStr}`);
        break;
      case this.levels.DEBUG:
        console.log(`${prefix} 🔍 ${message}${dataStr}`);
        break;
      case this.levels.VERBOSE:
        console.log(`${prefix} 📝 ${message}${dataStr}`);
        break;
    }

    // Сохраняем в историю
    this._addToHistory(level, message, data);
  },

  _history: [],
  _maxHistory: 200,

  _addToHistory: function (level, message, data) {
    this._history.unshift({
      timestamp: new Date().toISOString(),
      level: Object.keys(this.levels).find(k => this.levels[k] === level) || 'INFO',
      message,
      data: data,
    });
    if (this._history.length > this._maxHistory) {
      this._history.pop();
    }
  },

  getHistory: function (filter = null) {
    if (!filter) return this._history;
    return this._history.filter(h => h.level === filter || h.message.includes(filter));
  },

  clearHistory: function () {
    this._history = [];
  },

  error: function (message, data) {
    this.log(this.levels.ERROR, message, data);
  },
  warn: function (message, data) {
    this.log(this.levels.WARN, message, data);
  },
  info: function (message, data) {
    this.log(this.levels.INFO, message, data);
  },
  debug: function (message, data) {
    this.log(this.levels.DEBUG, message, data);
  },
  verbose: function (message, data) {
    this.log(this.levels.VERBOSE, message, data);
  },

  // Специальные методы для логирования запросов к букмарклетам
  logBookmarkRequest: function (url, bookmarkData, requestDetails = {}) {
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

    this.info('═══════════════════════════════════════════════════════════');
    this.info(`📌 ЗАПРОС К БУКМАРКЛЕТУ`);
    this.info(`   📍 URL страницы: ${url}`);
    this.info(`   📋 Название закладки: ${title}`);
    this.info(`   🏷️  Тип: ${type}`);
    this.info(`   🆔 ID: ${id}`);
    this.info(`   📂 Родитель: ${parent}`);
    this.info(`   📁 Путь: ${path}`);
    this.info(`   📦 Версия: ${version}`);
    this.info(`   🔖 Букмарклет: ${isBookmarklet ? '✅ Да' : '❌ Нет'}`);
    this.info(`   📎 Соседей: ${siblingsCount}`);
    this.info(`   ✨ Функции: ${features.length > 0 ? features.join(', ') : 'нет'}`);

    // Детальная информация о конфиге
    if (Object.keys(customConfig).length > 0) {
      this.info(`   ⚙️  Кастомные настройки:`);
      for (const [key, value] of Object.entries(customConfig)) {
        this.info(`      ${key}: ${JSON.stringify(value)}`);
      }
    }

    // Информация о соседних закладках (первые 5)
    if (bookmarkData?.siblings && bookmarkData.siblings.length > 0) {
      const siblings = bookmarkData.siblings.slice(0, 5);
      this.info(`   📑 Соседние закладки (${bookmarkData.siblings.length} всего):`);
      for (const sibling of siblings) {
        const sType = sibling.url?.startsWith('javascript:') ? '📌' : '🔗';
        this.info(`      ${sType} ${sibling.title || 'Без названия'}`);
      }
      if (bookmarkData.siblings.length > 5) {
        this.info(`      ... и еще ${bookmarkData.siblings.length - 5}`);
      }
    }

    // Детали запроса
    if (requestDetails.tabId) {
      this.info(`   📊 Tab ID: ${requestDetails.tabId}`);
    }
    if (requestDetails.requestId) {
      this.info(`   🔢 Request ID: ${requestDetails.requestId}`);
    }
    if (requestDetails.timestamp) {
      this.info(`   ⏱️  Время запроса: ${new Date(requestDetails.timestamp).toLocaleString()}`);
    }

    // Полные данные в VERBOSE режиме
    this.verbose('📦 ПОЛНЫЕ ДАННЫЕ ЗАКЛАДКИ:', bookmarkData);

    // Сохраняем в историю запросов
    CONFIG.requestLog.unshift({
      timestamp: new Date().toISOString(),
      url: url,
      bookmark: {
        title: title,
        type: type,
        id: id,
        parent: parent,
        path: path,
        version: version,
        isBookmarklet: isBookmarklet,
        features: features,
        customConfig: customConfig,
      },
      requestDetails: requestDetails,
    });
    if (CONFIG.requestLog.length > CONFIG.maxRequestLog) {
      CONFIG.requestLog.pop();
    }

    this.info('═══════════════════════════════════════════════════════════');
  },

  logBookmarkResponse: function (bookmarkData, responseData) {
    const title = bookmarkData?.title || 'Неизвестная закладка';
    const type = bookmarkData?.type || 'unknown';

    this.info('📤 ОТВЕТ БУКМАРКЛЕТУ');
    this.info(`   📋 Закладка: ${title} (${type})`);
    this.info(`   📦 Размер данных: ${JSON.stringify(responseData).length} байт`);
    this.verbose('   📄 Данные ответа:', responseData);
  },
};

// ============================================================
// 3. ПОИСК ЗАКЛАДКИ ПО URL
// ============================================================

async function findBookmarkByUrl(url, requestDetails = {}) {
  logger.debug(`🔍 Поиск закладки по URL: ${url}`);

  // Проверяем кеш
  if (CONFIG.cache.has(url)) {
    const cached = CONFIG.cache.get(url);
    if (Date.now() - cached.timestamp < CONFIG.cacheTTL) {
      logger.debug(`✅ Найдено в кеше: ${cached.data.title}`);
      logger.logBookmarkRequest(url, cached.data, requestDetails);
      return cached.data;
    }
    CONFIG.cache.delete(url);
  }

  try {
    logger.verbose(`📡 Поиск в chrome.bookmarks.search...`);

    // 1. Ищем закладку в системной базе браузера
    const bookmarks = await chrome.bookmarks.search({ url: url });

    if (bookmarks && bookmarks.length > 0) {
      const bookmark = bookmarks[0];
      logger.info(`✅ Найдена закладка: "${bookmark.title}" (ID: ${bookmark.id})`);

      // 2. Получаем родительскую папку
      let parent = null;
      if (bookmark.parentId) {
        try {
          const parents = await chrome.bookmarks.get(bookmark.parentId);
          if (parents && parents.length > 0) {
            parent = {
              id: parents[0].id,
              title: parents[0].title,
              parentId: parents[0].parentId,
            };
          }
        } catch (e) {
          logger.warn(`⚠️ Не удалось получить родительскую папку: ${e.message}`);
        }
      }

      // 3. Получаем кастомные данные
      const customConfig = CONFIG.customConfigs[bookmark.title] || {};

      // 4. Получаем все закладки в той же папке (контекст)
      let siblings = [];
      if (bookmark.parentId) {
        try {
          const children = await chrome.bookmarks.getChildren(bookmark.parentId);
          siblings = children.map(child => ({
            id: child.id,
            title: child.title,
            url: child.url,
          }));
          logger.verbose(`📑 Найдено соседей: ${siblings.length}`);
        } catch (e) {
          logger.warn(`⚠️ Не удалось получить соседние закладки: ${e.message}`);
        }
      }

      // 5. Получаем путь к закладке
      let path = [];
      let currentId = bookmark.parentId;
      while (currentId) {
        try {
          const parents = await chrome.bookmarks.get(currentId);
          if (parents && parents.length > 0) {
            path.unshift(parents[0].title);
            currentId = parents[0].parentId;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      const result = {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        parentId: bookmark.parentId,
        parent: parent,
        path: path,
        siblings: siblings,
        customConfig: customConfig,
        index: bookmark.index,
        dateAdded: bookmark.dateAdded,
        dateGroupModified: bookmark.dateGroupModified,
        type: customConfig.type || 'unknown',
        version: customConfig.version || '1.0.0',
        debug: customConfig.debug || false,
        features: customConfig.features || [],
        isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
        bookmarkletCode:
          bookmark.url && bookmark.url.startsWith('javascript:') ? bookmark.url : null,
      };

      // Сохраняем в кеш
      CONFIG.cache.set(url, {
        data: result,
        timestamp: Date.now(),
      });

      // Логируем запрос с деталями
      logger.logBookmarkRequest(url, result, requestDetails);

      return result;
    }

    // 4. Если закладка не найдена, пробуем поискать по части URL
    logger.debug(`🔍 Прямое совпадение не найдено, пробуем частичный поиск...`);

    const baseUrl = url.split('?')[0].split('#')[0];
    if (baseUrl !== url) {
      logger.debug(`🔍 Пробуем базовый URL: ${baseUrl}`);
      const bookmarks = await chrome.bookmarks.search({ url: baseUrl });
      if (bookmarks && bookmarks.length > 0) {
        const bookmark = bookmarks[0];
        logger.info(`✅ Найдена закладка по базовому URL: "${bookmark.title}"`);

        const customConfig = CONFIG.customConfigs[bookmark.title] || {};

        const result = {
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
          parentId: bookmark.parentId,
          customConfig: customConfig,
          type: customConfig.type || 'unknown',
          version: customConfig.version || '1.0.0',
          isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
          bookmarkletCode:
            bookmark.url && bookmark.url.startsWith('javascript:') ? bookmark.url : null,
        };

        CONFIG.cache.set(url, {
          data: result,
          timestamp: Date.now(),
        });

        logger.logBookmarkRequest(url, result, requestDetails);
        return result;
      }
    }

    // 5. Пробуем поискать по названию
    logger.debug(`🔍 Пробуем поиск по названию...`);
    const allBookmarks = await chrome.bookmarks.getRecent(100);
    for (const bm of allBookmarks) {
      if ((bm.url && bm.url.includes(url)) || (url && url.includes(bm.url))) {
        logger.info(`✅ Найдена закладка по частичному совпадению: "${bm.title}"`);
        const customConfig = CONFIG.customConfigs[bm.title] || {};
        const result = {
          id: bm.id,
          title: bm.title,
          url: bm.url,
          parentId: bm.parentId,
          customConfig: customConfig,
          type: customConfig.type || 'unknown',
          version: customConfig.version || '1.0.0',
          isBookmarklet: bm.url && bm.url.startsWith('javascript:'),
          bookmarkletCode: bm.url && bm.url.startsWith('javascript:') ? bm.url : null,
        };

        logger.logBookmarkRequest(url, result, requestDetails);
        return result;
      }
    }

    logger.warn(`❌ Закладка не найдена для URL: ${url}`);
    return null;
  } catch (error) {
    logger.error(`❌ Ошибка поиска закладки: ${error.message}`, error);
    return null;
  }
}

// ============================================================
// 4. ПОЛУЧЕНИЕ ВСЕХ ЗАКЛАДОК В ПАПКЕ
// ============================================================

async function getBookmarksInFolder(folderId) {
  try {
    logger.debug(`📂 Получение закладок в папке: ${folderId}`);
    const children = await chrome.bookmarks.getChildren(folderId);

    const result = children.map(child => ({
      id: child.id,
      title: child.title,
      url: child.url,
      type: CONFIG.customConfigs[child.title]?.type || 'unknown',
      isBookmarklet: child.url && child.url.startsWith('javascript:'),
    }));

    logger.debug(`📑 Найдено закладок: ${result.length}`);
    return result;
  } catch (error) {
    logger.error(`❌ Ошибка получения закладок в папке: ${error.message}`);
    return [];
  }
}

// ============================================================
// 5. ПОЛУЧЕНИЕ ДАННЫХ ПО ID ЗАКЛАДКИ
// ============================================================

async function getBookmarkById(id) {
  try {
    logger.debug(`🔍 Получение закладки по ID: ${id}`);
    const bookmarks = await chrome.bookmarks.get(id);
    if (bookmarks && bookmarks.length > 0) {
      const bookmark = bookmarks[0];
      const customConfig = CONFIG.customConfigs[bookmark.title] || {};

      return {
        id: bookmark.id,
        title: bookmark.title,
        url: bookmark.url,
        parentId: bookmark.parentId,
        customConfig: customConfig,
        type: customConfig.type || 'unknown',
        isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
      };
    }
    return null;
  } catch (error) {
    logger.error(`❌ Ошибка получения закладки по ID: ${error.message}`);
    return null;
  }
}

// ============================================================
// 6. ОБНОВЛЕНИЕ ДАННЫХ ЗАКЛАДКИ
// ============================================================

async function updateBookmarkData(id, data) {
  try {
    logger.debug(`💾 Обновление данных закладки: ${id}`);
    const key = `bookmark_${id}`;
    await chrome.storage.local.set({ [key]: data });
    logger.info(`✅ Данные закладки ${id} обновлены`);
    return { success: true };
  } catch (error) {
    logger.error(`❌ Ошибка обновления данных: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================================
// 7. ПОЛУЧЕНИЕ КАСТОМНЫХ ДАННЫХ ЗАКЛАДКИ
// ============================================================

async function getCustomBookmarkData(id) {
  try {
    const key = `bookmark_${id}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  } catch (error) {
    logger.error(`❌ Ошибка получения кастомных данных: ${error.message}`);
    return null;
  }
}

// ============================================================
// 8. ОБРАБОТЧИК СООБЩЕНИЙ
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const senderInfo = {
    tabId: sender.tab?.id,
    url: sender.tab?.url,
    frameId: sender.frameId,
  };

  logger.debug(`📨 Получено сообщение:`, {
    action: request.action,
    sender: senderInfo,
    request: request,
  });

  // Запрос от букмарклета
  if (request.action === 'find_bookmark_by_url') {
    const url = request.url || sender.tab?.url;
    logger.info(`🔍 Запрос данных для URL: ${url}`);

    const requestDetails = {
      tabId: sender.tab?.id,
      requestId: request.requestId || Date.now().toString(36),
      timestamp: Date.now(),
      source: request.source || 'unknown',
    };

    findBookmarkByUrl(url, requestDetails)
      .then(result => {
        if (result) {
          logger.info(`📤 Отправка данных: "${result.title}" (${result.type})`);
          logger.logBookmarkResponse(result, result);
          sendResponse(result);
        } else {
          logger.warn(`⚠️ Данные не найдены, отправляем дефолтные`);
          const defaultData = {
            title: 'Неизвестная закладка',
            type: 'unknown',
            version: '1.0.0',
            customConfig: {},
            isDefault: true,
            timestamp: Date.now(),
          };
          logger.logBookmarkResponse(defaultData, defaultData);
          sendResponse(defaultData);
        }
      })
      .catch(error => {
        logger.error(`❌ Ошибка обработки запроса: ${error.message}`, error);
        const errorData = {
          title: 'Ошибка',
          type: 'error',
          version: '1.0.0',
          customConfig: {},
          error: error.message,
          timestamp: Date.now(),
        };
        logger.logBookmarkResponse(errorData, errorData);
        sendResponse(errorData);
      });

    return true;
  }

  // Запрос на получение всех закладок в папке
  if (request.action === 'get_bookmarks_in_folder') {
    logger.info(`📂 Запрос закладок в папке: ${request.folderId}`);

    getBookmarksInFolder(request.folderId)
      .then(result => {
        logger.info(`📑 Отправлено ${result.length} закладок из папки`);
        sendResponse(result);
      })
      .catch(error => {
        logger.error(`❌ Ошибка получения закладок: ${error.message}`);
        sendResponse([]);
      });

    return true;
  }

  // Запрос на получение закладки по ID
  if (request.action === 'get_bookmark_by_id') {
    logger.info(`🔍 Запрос закладки по ID: ${request.id}`);

    getBookmarkById(request.id)
      .then(result => {
        if (result) {
          logger.info(`📤 Отправлена закладка: "${result.title}"`);
        }
        sendResponse(result);
      })
      .catch(error => {
        logger.error(`❌ Ошибка получения закладки: ${error.message}`);
        sendResponse(null);
      });

    return true;
  }

  // Запрос на обновление данных закладки
  if (request.action === 'update_bookmark_data') {
    logger.info(`💾 Обновление данных закладки: ${request.id}`);

    updateBookmarkData(request.id, request.data)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        logger.error(`❌ Ошибка обновления данных: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // Запрос на получение кастомных данных
  if (request.action === 'get_custom_bookmark_data') {
    logger.info(`🔍 Запрос кастомных данных: ${request.id}`);

    getCustomBookmarkData(request.id)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        logger.error(`❌ Ошибка получения кастомных данных: ${error.message}`);
        sendResponse(null);
      });

    return true;
  }

  // Проверка статуса (ping)
  if (request.action === 'ping') {
    sendResponse({ status: 'ok', timestamp: Date.now() });
    return true;
  }

  // Очистка кеша
  if (request.action === 'clear_cache') {
    logger.info('🗑️ Очистка кеша');
    CONFIG.cache.clear();
    sendResponse({ success: true });
    return true;
  }

  // Получение истории запросов
  if (request.action === 'get_request_history') {
    sendResponse({ history: CONFIG.requestLog });
    return true;
  }

  // Получение логов
  if (request.action === 'get_logs') {
    const filter = request.filter || null;
    sendResponse({ logs: logger.getHistory(filter) });
    return true;
  }

  // Обновление настроек
  if (request.action === 'update_settings') {
    if (request.settings) {
      if (request.settings.logLevel) {
        const levelMap = {
          error: logger.levels.ERROR,
          warn: logger.levels.WARN,
          info: logger.levels.INFO,
          debug: logger.levels.DEBUG,
          trace: logger.levels.VERBOSE,
        };
        logger.level = levelMap[request.settings.logLevel] || logger.levels.INFO;
        logger.info(`📌 Уровень логирования изменён на: ${request.settings.logLevel}`);
      }
      if (request.settings.cacheTTL) {
        CONFIG.cacheTTL = request.settings.cacheTTL * 1000;
        logger.info(`📌 TTL кеша изменён на: ${request.settings.cacheTTL} сек`);
      }
    }
    sendResponse({ success: true });
    return true;
  }

  // Получить текущую вкладку
  if (request.action === 'get_current_tab') {
    getActiveTabData()
      .then(bookmarkData => {
        sendResponse({
          tab: currentActiveTab,
          bookmark: bookmarkData,
          timestamp: Date.now(),
        });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true;
  }

  return false;
});

// ============================================================
// 9. ОТСЛЕЖИВАНИЕ АКТИВНОЙ ВКЛАДКИ
// ============================================================

let currentActiveTab = null;
let lastBookmarkData = null;

// Получить данные текущей активной вкладки
async function getActiveTabData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return null;

    currentActiveTab = tab;
    logger.debug(`📌 Активная вкладка: ${tab.title} (${tab.url})`);

    // Ищем закладку для этого URL
    const bookmarkData = await findBookmarkByUrl(tab.url, {
      tabId: tab.id,
      url: tab.url,
      timestamp: Date.now(),
      source: 'tab_change',
    });

    lastBookmarkData = bookmarkData;

    // Оповещаем popup об обновлении
    chrome.runtime
      .sendMessage({
        action: 'tab_updated',
        tab: {
          id: tab.id,
          title: tab.title,
          url: tab.url,
          favIconUrl: tab.favIconUrl,
        },
        bookmark: bookmarkData,
      })
      .catch(() => {});

    return bookmarkData;
  } catch (error) {
    logger.error(`❌ Ошибка получения активной вкладки: ${error.message}`);
    return null;
  }
}

// Обработчик смены активной вкладки
chrome.tabs.onActivated.addListener(async activeInfo => {
  logger.info(`🔄 Смена вкладки: ${activeInfo.tabId}`);

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      logger.info(`📌 Новая вкладка: ${tab.title || 'Без названия'}`);

      const bookmarkData = await findBookmarkByUrl(tab.url, {
        tabId: tab.id,
        url: tab.url,
        timestamp: Date.now(),
        source: 'tab_activated',
      });

      lastBookmarkData = bookmarkData;
      currentActiveTab = tab;

      // Оповещаем popup
      chrome.runtime
        .sendMessage({
          action: 'tab_updated',
          tab: {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl,
          },
          bookmark: bookmarkData,
        })
        .catch(() => {});
    }
  } catch (error) {
    logger.error(`❌ Ошибка при смене вкладки: ${error.message}`);
  }
});

// Обработчик обновления URL в текущей вкладке
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    logger.info(`🔄 Обновление URL в активной вкладке: ${tabId}`);
    logger.info(`   📌 Новый URL: ${changeInfo.url}`);

    findBookmarkByUrl(changeInfo.url, {
      tabId: tabId,
      url: changeInfo.url,
      timestamp: Date.now(),
      source: 'tab_updated',
    })
      .then(bookmarkData => {
        lastBookmarkData = bookmarkData;
        currentActiveTab = tab;

        chrome.runtime
          .sendMessage({
            action: 'tab_updated',
            tab: {
              id: tab.id,
              title: tab.title,
              url: tab.url,
              favIconUrl: tab.favIconUrl,
            },
            bookmark: bookmarkData,
          })
          .catch(() => {});
      })
      .catch(error => {
        logger.error(`❌ Ошибка обновления закладки: ${error.message}`);
      });
  }
});

// Обработчик закрытия вкладки
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (currentActiveTab && currentActiveTab.id === tabId) {
    logger.info(`🗑️ Закрыта активная вкладка: ${tabId}`);
    currentActiveTab = null;
    lastBookmarkData = null;

    chrome.runtime
      .sendMessage({
        action: 'tab_closed',
        tabId: tabId,
      })
      .catch(() => {});
  }
});

// ============================================================
// 10. ПЕРИОДИЧЕСКАЯ ПРОВЕРКА АКТИВНОЙ ВКЛАДКИ
// ============================================================

// Проверяем активную вкладку каждые 5 секунд
setInterval(() => {
  chrome.tabs
    .query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs.length > 0) {
        const tab = tabs[0];
        if (
          !currentActiveTab ||
          currentActiveTab.id !== tab.id ||
          currentActiveTab.url !== tab.url
        ) {
          logger.verbose(`🔄 Периодическая проверка: активная вкладка изменилась`);
          getActiveTabData();
        }
      }
    })
    .catch(error => {
      logger.error(`❌ Ошибка периодической проверки: ${error.message}`);
    });
}, 5000);

// ============================================================
// 11. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАПУСКЕ
// ============================================================

// Получаем активную вкладку при запуске
setTimeout(() => {
  getActiveTabData();
}, 1000);

logger.info('═══════════════════════════════════════════════════════════');
logger.info('📦 Bookmarklet Bridge запущен');
logger.info(`📌 Версия: 1.0.0`);
logger.info(`📌 Кеш: ${CONFIG.cache.size} записей`);
logger.info(`📌 Кастомных конфигов: ${Object.keys(CONFIG.customConfigs).length}`);
logger.info(
  `📌 Уровень логирования: ${Object.keys(logger.levels).find(k => logger.levels[k] === logger.level)}`
);
logger.info('═══════════════════════════════════════════════════════════');

logger.info('📋 Доступные действия:');
logger.info('  findBookmarkByUrl(url)     - поиск закладки по URL');
logger.info('  getBookmarksInFolder(id)   - получить закладки в папке');
logger.info('  getBookmarkById(id)        - получить закладку по ID');
logger.info('  updateBookmarkData(id,data)- обновить кастомные данные');
logger.info('  getCustomBookmarkData(id)  - получить кастомные данные');
logger.info('  clearCache()               - очистить кеш');
logger.info('  getRequestHistory()        - история запросов');
logger.info('  getLogs(filter)            - получить логи');
logger.info('📌 Отслеживание вкладок активировано');
logger.info('   🔄 Обновление при смене вкладки');
logger.info('   🔄 Обновление при изменении URL');
logger.info('   🔄 Периодическая проверка каждые 5 сек');

// Экспортируем для отладки
if (typeof self !== 'undefined') {
  self.__extensionAPI = {
    findBookmarkByUrl,
    getBookmarksInFolder,
    getBookmarkById,
    updateBookmarkData,
    getCustomBookmarkData,
    clearCache: () => {
      CONFIG.cache.clear();
      logger.info('🗑️ Кеш очищен');
    },
    getRequestHistory: () => CONFIG.requestLog,
    getLogs: filter => logger.getHistory(filter),
    getActiveTabData,
    CONFIG,
    logger,
  };
}

logger.info('✅ Bookmarklet Bridge готов к работе');
logger.info('═══════════════════════════════════════════════════════════');
