// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/background.js
// ИСПРАВЛЕНО: Убраны бесконечные циклы и зависания

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
  allBookmarks: [],
  bookmarklets: [],
  folders: [],
  bookmarksCache: null,
  ignoredUrls: [
    'chrome://',
    'about:',
    'chrome-extension://',
    'chrome-devtools://',
    'edge://',
    'brave://',
    'opera://',
    'vivaldi://',
    'chrome-search://',
    'chrome-untrusted://',
  ],
  windowWidth: 540,
  windowHeight: 620,
  windowOffset: 10,
};

// ============================================================
// 2. ЛОГГЕР
// ============================================================

const logger = {
  levels: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    VERBOSE: 4,
  },
  level: 2,

  log: function (level, message, data = null) {
    if (level > this.level) return;

    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `[${timestamp}] [Bookmarklet Bridge]`;

    let dataStr = '';
    if (data !== null && this.level >= this.levels.VERBOSE) {
      if (typeof data === 'object') {
        try {
          dataStr = '\n' + JSON.stringify(data, null, 2);
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

  logBookmarkRequest: function (url, bookmarkData, requestDetails = {}) {
    const title = bookmarkData?.title || 'Неизвестная закладка';
    const type = bookmarkData?.type || 'unknown';
    const id = bookmarkData?.id || '—';
    const path = bookmarkData?.path?.join(' > ') || '—';
    const isBookmarklet = bookmarkData?.isBookmarklet || false;
    const features = bookmarkData?.features || [];

    this.info('═══════════════════════════════════════════════════════════');
    this.info(`📌 ЗАПРОС К БУКМАРКЛЕТУ`);
    this.info(`   📍 URL: ${url}`);
    this.info(`   📋 Название: ${title}`);
    this.info(`   🏷️  Тип: ${type}`);
    this.info(`   🆔 ID: ${id}`);
    this.info(`   📁 Путь: ${path}`);
    this.info(`   🔖 Букмарклет: ${isBookmarklet ? '✅ Да' : '❌ Нет'}`);
    if (features.length > 0) {
      this.info(`   ✨ Функции: ${features.join(', ')}`);
    }
    if (requestDetails.tabId) {
      this.info(`   📊 Tab ID: ${requestDetails.tabId}`);
    }
    if (requestDetails.bookmarkletName) {
      this.info(`   📛 Имя букмарклета: ${requestDetails.bookmarkletName}`);
    }
    this.info('═══════════════════════════════════════════════════════════');

    CONFIG.requestLog.unshift({
      timestamp: new Date().toISOString(),
      url: url,
      bookmark: { title, type, id, path, isBookmarklet },
      requestDetails: {
        bookmarkletName: requestDetails.bookmarkletName || null,
        source: requestDetails.source || null,
      },
    });
    if (CONFIG.requestLog.length > CONFIG.maxRequestLog) {
      CONFIG.requestLog.pop();
    }
  },

  logBookmarkResponse: function (bookmarkData, responseData) {
    const title = bookmarkData?.title || 'Неизвестная закладка';
    const type = bookmarkData?.type || 'unknown';
    this.info(`📤 ОТВЕТ: ${title} (${type})`);
  },
};

// ============================================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function isIgnoredUrl(url) {
  if (!url) return true;
  for (const prefix of CONFIG.ignoredUrls) {
    if (url.startsWith(prefix)) return true;
  }
  if (url === '' || url === 'about:blank' || url === 'about:empty') return true;
  return false;
}

function getBookmarkPath(bookmarkId) {
  return new Promise(resolve => {
    const path = [];
    let currentId = bookmarkId;

    function getParent(id) {
      if (!id) {
        resolve(path);
        return;
      }
      try {
        chrome.bookmarks.get(id, results => {
          if (results && results.length > 0) {
            const parent = results[0];
            if (parent && parent.title && parent.id !== '0' && parent.id !== '1') {
              path.unshift(parent.title);
              getParent(parent.parentId);
            } else {
              resolve(path);
            }
          } else {
            resolve(path);
          }
        });
      } catch (e) {
        resolve(path);
      }
    }

    getParent(currentId);
  });
}

function processBookmark(bookmark) {
  const customConfig = CONFIG.customConfigs[bookmark.title] || {};
  return {
    id: bookmark.id,
    title: bookmark.title,
    url: bookmark.url,
    parentId: bookmark.parentId,
    path: [],
    customConfig: customConfig,
    type: customConfig.type || 'unknown',
    version: customConfig.version || '1.0.0',
    features: customConfig.features || [],
    isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
    bookmarkletCode: bookmark.url && bookmark.url.startsWith('javascript:') ? bookmark.url : null,
  };
}

// ============================================================
// 4. ПОИСК БУКМАРКЛЕТА ПО URL ИЛИ НАЗВАНИЮ
// ============================================================

async function findBookmarkByUrl(url, requestDetails = {}) {
  if (isIgnoredUrl(url)) {
    logger.debug(`⏭️ Игнорируем системный URL: ${url}`);
    return null;
  }

  logger.debug(`🔍 Поиск закладки по URL: ${url}`);

  if (CONFIG.cache.has(url)) {
    const cached = CONFIG.cache.get(url);
    if (Date.now() - cached.timestamp < CONFIG.cacheTTL) {
      logger.debug(`✅ Найдено в кеше: ${cached.data.title}`);
      return cached.data;
    }
    CONFIG.cache.delete(url);
  }

  try {
    const bookmarks = await chrome.bookmarks.search({ url: url });
    if (bookmarks && bookmarks.length > 0) {
      const bookmark = bookmarks[0];
      const result = processBookmark(bookmark);
      const path = await getBookmarkPath(bookmark.parentId);
      result.path = path;

      CONFIG.cache.set(url, { data: result, timestamp: Date.now() });

      if (requestDetails.source === 'bookmarklet' || requestDetails.source === 'content_script') {
        logger.logBookmarkRequest(url, result, requestDetails);
      }
      return result;
    }

    let searchTitle = requestDetails.bookmarkletName || requestDetails.title;

    if (searchTitle) {
      logger.debug(`🔍 Поиск по названию: "${searchTitle}"`);

      const allBookmarks = await chrome.bookmarks.search({ query: 'javascript:' });

      for (const bm of allBookmarks) {
        if (bm.url && bm.url.startsWith('javascript:')) {
          const titleMatch = bm.title && bm.title.toLowerCase().includes(searchTitle.toLowerCase());
          const searchInTitle = searchTitle
            .toLowerCase()
            .includes(bm.title ? bm.title.toLowerCase() : '');

          if (titleMatch || searchInTitle) {
            logger.info(`✅ Найден букмарклет по названию: "${bm.title}"`);
            const result = processBookmark(bm);
            const path = await getBookmarkPath(bm.parentId);
            result.path = path;

            CONFIG.cache.set(url, { data: result, timestamp: Date.now() });

            if (
              requestDetails.source === 'bookmarklet' ||
              requestDetails.source === 'content_script'
            ) {
              logger.logBookmarkRequest(url, result, requestDetails);
            }
            return result;
          }
        }
      }
    }

    if (requestDetails.tabTitle) {
      logger.debug(`🔍 Поиск по заголовку страницы: "${requestDetails.tabTitle}"`);

      const allBookmarks = await chrome.bookmarks.search({ query: 'javascript:' });
      for (const bm of allBookmarks) {
        if (bm.url && bm.url.startsWith('javascript:')) {
          const titleMatch =
            bm.title && requestDetails.tabTitle.toLowerCase().includes(bm.title.toLowerCase());
          if (titleMatch) {
            logger.info(`✅ Найден букмарклет по заголовку страницы: "${bm.title}"`);
            const result = processBookmark(bm);
            const path = await getBookmarkPath(bm.parentId);
            result.path = path;

            CONFIG.cache.set(url, { data: result, timestamp: Date.now() });

            if (
              requestDetails.source === 'bookmarklet' ||
              requestDetails.source === 'content_script'
            ) {
              logger.logBookmarkRequest(url, result, requestDetails);
            }
            return result;
          }
        }
      }
    }

    const baseUrl = url.split('?')[0].split('#')[0];
    if (baseUrl !== url) {
      logger.debug(`🔍 Пробуем базовый URL: ${baseUrl}`);
      const bookmarks = await chrome.bookmarks.search({ url: baseUrl });
      if (bookmarks && bookmarks.length > 0) {
        const bookmark = bookmarks[0];
        const result = processBookmark(bookmark);
        const path = await getBookmarkPath(bookmark.parentId);
        result.path = path;

        CONFIG.cache.set(url, { data: result, timestamp: Date.now() });

        if (requestDetails.source === 'bookmarklet' || requestDetails.source === 'content_script') {
          logger.logBookmarkRequest(url, result, requestDetails);
        }
        return result;
      }
    }

    logger.debug(`ℹ️ Закладка не найдена для: ${url}`);
    return null;
  } catch (error) {
    logger.error(`❌ Ошибка поиска: ${error.message}`);
    return null;
  }
}

// ============================================================
// 5. ПОЛУЧЕНИЕ ВСЕХ ЗАКЛАДОК
// ============================================================

async function loadAllBookmarks() {
  logger.info('📑 Загрузка всех закладок...');

  try {
    const tree = await chrome.bookmarks.getTree();
    const allBookmarks = [];
    const bookmarklets = [];
    const folders = [];

    function traverseBookmarks(node, path = '') {
      if (node.url) {
        const isBookmarklet = node.url.startsWith('javascript:');
        const bookmark = {
          id: node.id,
          title: node.title || 'Без названия',
          url: node.url,
          path: path || 'Корень',
          isBookmarklet: isBookmarklet,
          type: isBookmarklet ? 'bookmarklet' : 'url',
          parentId: node.parentId,
        };
        allBookmarks.push(bookmark);
        if (isBookmarklet) {
          bookmarklets.push(bookmark);
        }
      }

      if (node.children) {
        const currentPath = path ? `${path} > ${node.title || 'Корень'}` : node.title || 'Корень';
        if (node.title && !node.url) {
          folders.push({
            id: node.id,
            title: node.title,
            path: path || 'Корень',
            childrenCount: node.children.length,
          });
        }
        for (const child of node.children) {
          traverseBookmarks(child, currentPath);
        }
      }
    }

    for (const root of tree) {
      traverseBookmarks(root, '');
    }

    CONFIG.allBookmarks = allBookmarks;
    CONFIG.bookmarklets = bookmarklets;
    CONFIG.folders = folders;

    logger.info('═══════════════════════════════════════════════════════════');
    logger.info(`📊 СТАТИСТИКА ЗАКЛАДОК`);
    logger.info(`   📑 Всего закладок: ${allBookmarks.length}`);
    logger.info(`   📌 Букмарклетов: ${bookmarklets.length}`);
    logger.info(`   📁 Папок: ${folders.length}`);
    logger.info('═══════════════════════════════════════════════════════════');

    if (bookmarklets.length > 0) {
      logger.info('📋 СПИСОК БУКМАРКЛЕТОВ:');
      for (const bm of bookmarklets) {
        const urlPreview = bm.url.substring(0, 50) + (bm.url.length > 50 ? '...' : '');
        logger.info(`   📌 ${bm.title}`);
        logger.info(`      📂 ${bm.path}`);
        logger.info(`      🔗 ${urlPreview}`);
        logger.info(`      🆔 ${bm.id}`);
        logger.info('   ──────────────────────────────');
      }
    } else {
      logger.warn('⚠️ Букмарклеты не найдены');
    }

    CONFIG.bookmarksCache = {
      all: allBookmarks,
      bookmarklets: bookmarklets,
      folders: folders,
      timestamp: Date.now(),
    };

    return { allBookmarks, bookmarklets, folders };
  } catch (error) {
    logger.error(`❌ Ошибка загрузки: ${error.message}`);
    return null;
  }
}

// ============================================================
// 6. ОТКРЫТИЕ ОКНА КАК МЕНЮ В ПРАВОМ ВЕРХНЕМ УГЛУ
// ============================================================

function openExtensionWindow() {
  logger.info('📂 Открытие окна расширения как меню...');

  chrome.windows.getCurrent(currentWindow => {
    chrome.system.display.getInfo(displays => {
      let screenWidth = 1920;
      let screenHeight = 1080;

      if (displays && displays.length > 0) {
        const primary = displays[0];
        screenWidth = primary.workArea.width || primary.bounds.width || 1920;
        screenHeight = primary.workArea.height || primary.bounds.height || 1080;
      }

      const left = screenWidth - CONFIG.windowWidth - CONFIG.windowOffset;
      const top = CONFIG.windowOffset + 40;

      logger.debug(`📐 Экран: ${screenWidth}x${screenHeight}, Окно: ${left}, ${top}`);

      chrome.windows.create(
        {
          url: chrome.runtime.getURL('popup.html'),
          type: 'popup',
          width: CONFIG.windowWidth,
          height: CONFIG.windowHeight,
          left: Math.max(0, left),
          top: Math.max(0, top),
          focused: true,
        },
        window => {
          if (window) {
            logger.info(`📂 Окно расширения открыто (ID: ${window.id})`);
          } else {
            logger.warn('⚠️ Не удалось открыть окно в правом углу, открываем по центру');
            chrome.windows.create({
              url: chrome.runtime.getURL('popup.html'),
              type: 'popup',
              width: CONFIG.windowWidth,
              height: CONFIG.windowHeight,
              focused: true,
            });
          }
        }
      );
    });
  });
}

chrome.action.onClicked.addListener(tab => {
  openExtensionWindow();
});

// ============================================================
// 7. ОБРАБОТЧИКИ СООБЩЕНИЙ
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'find_bookmark_by_url') {
    const url = request.url || sender.tab?.url;

    if (isIgnoredUrl(url)) {
      sendResponse(null);
      return true;
    }

    const requestDetails = {
      tabId: sender.tab?.id,
      requestId: request.requestId || Date.now().toString(36),
      timestamp: Date.now(),
      source: request.source || 'content_script',
      bookmarkletName: request.bookmarkletName || request.name,
      tabTitle: sender.tab?.title,
      title: request.title,
    };

    findBookmarkByUrl(url, requestDetails)
      .then(result => {
        if (result) {
          logger.logBookmarkResponse(result, result);
          sendResponse(result);
        } else {
          sendResponse(null);
        }
      })
      .catch(error => {
        logger.error(`❌ Ошибка: ${error.message}`);
        sendResponse(null);
      });

    return true;
  }

  if (request.action === 'get_all_bookmarks') {
    if (CONFIG.bookmarksCache) {
      sendResponse({ success: true, data: CONFIG.bookmarksCache });
    } else {
      loadAllBookmarks()
        .then(result => {
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
    }
    return true;
  }

  if (request.action === 'get_bookmarklets') {
    sendResponse({
      success: true,
      count: CONFIG.bookmarklets?.length || 0,
      bookmarklets: CONFIG.bookmarklets || [],
    });
    return true;
  }

  if (request.action === 'get_bookmark_tree') {
    chrome.bookmarks
      .getTree()
      .then(tree => {
        sendResponse(tree);
      })
      .catch(error => {
        logger.error(`❌ Ошибка получения дерева: ${error.message}`);
        sendResponse(null);
      });
    return true;
  }

  if (request.action === 'ping') {
    sendResponse({ status: 'ok', timestamp: Date.now() });
    return true;
  }

  if (request.action === 'clear_cache') {
    CONFIG.cache.clear();
    logger.info('🗑️ Кеш очищен');
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'get_request_history') {
    sendResponse({ history: CONFIG.requestLog });
    return true;
  }

  if (request.action === 'update_settings') {
    if (request.settings) {
      const levelMap = {
        error: logger.levels.ERROR,
        warn: logger.levels.WARN,
        info: logger.levels.INFO,
        debug: logger.levels.DEBUG,
        trace: logger.levels.VERBOSE,
      };
      if (request.settings.logLevel) {
        logger.level = levelMap[request.settings.logLevel] || logger.levels.INFO;
        logger.info(`📌 Уровень логирования: ${request.settings.logLevel}`);
      }
      if (request.settings.cacheTTL) {
        CONFIG.cacheTTL = request.settings.cacheTTL * 1000;
      }
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'open_extension_window') {
    openExtensionWindow();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'close_extension_window') {
    if (sender.tab && sender.tab.windowId) {
      chrome.windows.remove(sender.tab.windowId, () => {
        if (chrome.runtime.lastError) {
          logger.error(`❌ Ошибка закрытия окна: ${chrome.runtime.lastError.message}`);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          logger.info('🗑️ Окно расширения закрыто');
          sendResponse({ success: true });
        }
      });
    } else {
      chrome.windows.getAll({ populate: true }, windows => {
        for (const win of windows) {
          for (const tab of win.tabs) {
            if (tab.url && tab.url.includes('popup.html')) {
              chrome.windows.remove(win.id, () => {
                logger.info('🗑️ Окно расширения закрыто');
                sendResponse({ success: true });
              });
              return;
            }
          }
        }
        sendResponse({ success: false, error: 'Окно не найдено' });
      });
    }
    return true;
  }

  return false;
});

// ============================================================
// 8. ИНИЦИАЛИЗАЦИЯ (без бесконечных циклов)
// ============================================================

logger.info('═══════════════════════════════════════════════════════════');
logger.info('📦 Bookmarklet Bridge запущен');
logger.info(`📌 Версия: 1.0.0`);
logger.info(`📌 Уровень логирования: INFO`);
logger.info(`📌 Размер окна: ${CONFIG.windowWidth}x${CONFIG.windowHeight}`);
logger.info(`📌 Позиция: правый верхний угол`);
logger.info('═══════════════════════════════════════════════════════════');

// Загружаем закладки один раз при старте
setTimeout(() => {
  loadAllBookmarks();
}, 1000);

// Обновление закладок только по запросу, без бесконечных циклов
// setInterval УДАЛЁН - больше нет автоматического обновления

logger.info('📌 Отслеживание вкладок ОТКЛЮЧЕНО');
logger.info('📌 Поиск букмарклетов по URL И названию');
logger.info('📌 Окно открывается по клику на иконку (правый верхний угол)');
logger.info('📌 Автообновление закладок ОТКЛЮЧЕНО (только по запросу)');

logger.info('📋 Доступные команды:');
logger.info('  __extensionAPI.findBookmarkByUrl(url) - поиск закладки');
logger.info('  __extensionAPI.loadAllBookmarks() - загрузить все закладки');
logger.info('  __extensionAPI.clearCache() - очистить кеш');
logger.info('  __extensionAPI.getRequestHistory() - история запросов');
logger.info('  __extensionAPI.getBookmarklets() - получить букмарклеты');
logger.info('  __extensionAPI.getAllBookmarks() - получить все закладки');
logger.info('  __extensionAPI.openExtensionWindow() - открыть окно расширения');

logger.info('✅ Bookmarklet Bridge готов к работе');
logger.info('═══════════════════════════════════════════════════════════');

if (typeof self !== 'undefined') {
  self.__extensionAPI = {
    findBookmarkByUrl,
    loadAllBookmarks,
    clearCache: () => {
      CONFIG.cache.clear();
      logger.info('🗑️ Кеш очищен');
    },
    getRequestHistory: () => CONFIG.requestLog,
    getBookmarklets: () => CONFIG.bookmarklets,
    getAllBookmarks: () => CONFIG.allBookmarks,
    openExtensionWindow,
    CONFIG,
    logger,
  };
}
