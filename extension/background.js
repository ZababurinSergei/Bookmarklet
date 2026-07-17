// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/background.js
// ФИНАЛЬНАЯ ВЕРСИЯ: Правильное получение tabId через chrome.tabs.query()
// ИСПРАВЛЕНО: Открытие окна по клику на иконку (не popup)

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
  bookmarkTabMap: new Map(), // tabId → bookmarkId
  tabBookmarkMap: new Map(), // tabId → bookmarkData
  activeTabId: null,
  initialized: false,
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
  extensionWindowId: null,
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
};

// ============================================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function isIgnoredUrl(url) {
  if (!url) return true;
  for (const prefix of CONFIG.ignoredUrls) {
    if (url.startsWith(prefix)) return true;
  }
  return false;
}

function getBookmarkPath(bookmarkId) {
  return new Promise(resolve => {
    const path = [];
    let currentId = bookmarkId;

    function getParent(id) {
      if (!id || id === '0' || id === '1') {
        resolve(path);
        return;
      }

      try {
        chrome.bookmarks.get(id, results => {
          if (chrome.runtime.lastError || !results || results.length === 0) {
            resolve(path);
            return;
          }

          const parent = results[0];
          if (parent && parent.title && parent.id !== '0' && parent.id !== '1') {
            path.unshift(parent.title);
            getParent(parent.parentId);
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

// ============================================================
// 4. ПОЛУЧЕНИЕ ВСЕХ ЗАКЛАДОК
// ============================================================

async function loadAllBookmarks() {
  logger.info('📑 Загрузка всех закладок...');

  try {
    const tree = await new Promise((resolve, reject) => {
      chrome.bookmarks.getTree(result => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    });

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
          tabId: null,
        };
        allBookmarks.push(bookmark);
        if (isBookmarklet) {
          bookmarklets.push(bookmark);
        }
      }

      if (node.children) {
        const currentPath = path ? `${path} > ${node.title || 'Корень'}` : node.title || 'Корень';
        if (node.title && !node.url && node.id !== '0' && node.id !== '1') {
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
    logger.info('📊 СТАТИСТИКА ЗАКЛАДОК');
    logger.info(`   📑 Всего закладок: ${allBookmarks.length}`);
    logger.info(`   📌 Букмарклетов: ${bookmarklets.length}`);
    logger.info(`   📁 Папок: ${folders.length}`);
    logger.info('═══════════════════════════════════════════════════════════');

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
// 5. ПОЛУЧЕНИЕ ВСЕХ ОТКРЫТЫХ ВКЛАДОК (ГЛАВНАЯ ФУНКЦИЯ)
// ============================================================

async function getAllTabs() {
  return new Promise(resolve => {
    chrome.tabs.query({}, tabs => {
      if (chrome.runtime.lastError) {
        logger.error('Ошибка получения вкладок:', chrome.runtime.lastError.message);
        resolve([]);
        return;
      }
      resolve(tabs);
    });
  });
}

// ============================================================
// 6. ИНИЦИАЛИЗАЦИЯ ВСЕХ ВКЛАДОК
// ============================================================

async function initializeAllTabs() {
  if (CONFIG.initialized) return;
  CONFIG.initialized = true;

  logger.info('🔄 Инициализация всех открытых вкладок через chrome.tabs.query()...');

  try {
    const tabs = await getAllTabs();

    logger.info(`📊 Найдено открытых вкладок: ${tabs.length}`);

    // Выводим таблицу всех вкладок
    const tabList = tabs.map(tab => ({
      'Tab ID': tab.id,
      Название: tab.title || '—',
      URL: tab.url || '—',
      Активна: tab.active ? '✅' : '❌',
    }));
    console.table(tabList);
    logger.info('📋 Таблица вкладок выведена в консоль (console.table)');

    // Сопоставляем с закладками
    let foundCount = 0;
    for (const tab of tabs) {
      if (tab.url && !isIgnoredUrl(tab.url)) {
        logger.debug(`🔍 Проверка вкладки ${tab.id}: ${tab.title || '—'}`);

        const result = await findBookmarkForTab(tab);
        if (result) {
          foundCount++;
          logger.info(`✅ Вкладка ${tab.id} → "${result.title}" (ID: ${result.id})`);
        }
      }
    }

    logger.info(`📊 Найдено связей: ${foundCount} из ${tabs.length} вкладок`);

    updateBookmarkletList();
  } catch (error) {
    logger.error('❌ Ошибка инициализации вкладок:', error.message);
  }
}

// ============================================================
// 7. ПОИСК ЗАКЛАДКИ ДЛЯ ВКЛАДКИ (ПО ТАБЛИЦЕ)
// ============================================================

function findBookmarkForTab(tab) {
  return new Promise(async resolve => {
    const tabId = tab.id;
    const url = tab.url;
    const title = tab.title || '';

    if (!url || isIgnoredUrl(url)) {
      resolve(null);
      return;
    }

    logger.debug(`🔍 Поиск закладки для вкладки ${tabId}: ${title}`);

    // 1. Ищем по URL
    chrome.bookmarks.search(url, async results => {
      if (chrome.runtime.lastError) {
        logger.error('Ошибка поиска по URL:', chrome.runtime.lastError.message);
        resolve(null);
        return;
      }

      if (results && results.length > 0) {
        const bookmark = results[0];
        const result = {
          id: bookmark.id,
          title: bookmark.title || 'Без названия',
          url: bookmark.url,
          parentId: bookmark.parentId,
          tabId: tabId,
          isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
          type: bookmark.url && bookmark.url.startsWith('javascript:') ? 'bookmarklet' : 'url',
          matchedBy: 'url',
          timestamp: Date.now(),
        };

        const path = await getBookmarkPath(bookmark.parentId);
        result.path = path;

        CONFIG.bookmarkTabMap.set(tabId, result.id);
        CONFIG.tabBookmarkMap.set(tabId, result);

        logger.info(`✅ Связь по URL: вкладка ${tabId} → "${result.title}"`);
        resolve(result);
        return;
      }

      // 2. Ищем по заголовку среди букмарклетов
      for (const bm of CONFIG.bookmarklets) {
        if (!bm.title) continue;

        const titleMatch =
          title.toLowerCase().includes(bm.title.toLowerCase()) ||
          bm.title.toLowerCase().includes(title.toLowerCase());

        if (titleMatch) {
          const result = {
            ...bm,
            tabId: tabId,
            matchedBy: 'title_match',
            timestamp: Date.now(),
          };
          CONFIG.bookmarkTabMap.set(tabId, result.id);
          CONFIG.tabBookmarkMap.set(tabId, result);
          logger.info(`✅ Связь по заголовку: вкладка ${tabId} → "${result.title}"`);
          resolve(result);
          return;
        }
      }

      // 3. Ищем по домену в названии букмарклета
      if (url) {
        const urlParts = url.replace(/^https?:\/\//, '').split('/');
        const domain = urlParts[0] || '';
        const domainParts = domain.split('.');

        for (const bm of CONFIG.bookmarklets) {
          if (!bm.title) continue;

          for (const part of domainParts) {
            if (part.length > 3 && bm.title.toLowerCase().includes(part.toLowerCase())) {
              const result = {
                ...bm,
                tabId: tabId,
                matchedBy: 'domain_in_title',
                timestamp: Date.now(),
              };
              CONFIG.bookmarkTabMap.set(tabId, result.id);
              CONFIG.tabBookmarkMap.set(tabId, result);
              logger.info(
                `✅ Связь по домену: вкладка ${tabId} → "${result.title}" (домен: ${part})`
              );
              resolve(result);
              return;
            }
          }
        }
      }

      // 4. Ищем по URL в коде букмарклета
      for (const bm of CONFIG.bookmarklets) {
        if (!bm.url || !bm.url.startsWith('javascript:')) continue;

        if (bm.url && bm.url.includes(url)) {
          const result = {
            ...bm,
            tabId: tabId,
            matchedBy: 'url_in_code',
            timestamp: Date.now(),
          };
          CONFIG.bookmarkTabMap.set(tabId, result.id);
          CONFIG.tabBookmarkMap.set(tabId, result);
          logger.info(`✅ Связь по URL в коде: вкладка ${tabId} → "${result.title}"`);
          resolve(result);
          return;
        }
      }

      // 5. Ищем по пути URL (частичное совпадение)
      if (url) {
        const urlPath = url.replace(/^https?:\/\/[^\/]+/, '');
        if (urlPath && urlPath.length > 3) {
          for (const bm of CONFIG.bookmarklets) {
            if (!bm.title) continue;
            if (bm.url && bm.url.includes(urlPath)) {
              const result = {
                ...bm,
                tabId: tabId,
                matchedBy: 'url_path_in_code',
                timestamp: Date.now(),
              };
              CONFIG.bookmarkTabMap.set(tabId, result.id);
              CONFIG.tabBookmarkMap.set(tabId, result);
              logger.info(`✅ Связь по пути URL: вкладка ${tabId} → "${result.title}"`);
              resolve(result);
              return;
            }
          }
        }
      }

      // 6. Ищем по части названия букмарклета
      for (const bm of CONFIG.bookmarklets) {
        if (!bm.title) continue;
        const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanBmTitle = bm.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

        if (cleanTitle.includes(cleanBmTitle) || cleanBmTitle.includes(cleanTitle)) {
          const result = {
            ...bm,
            tabId: tabId,
            matchedBy: 'title_similarity',
            timestamp: Date.now(),
          };
          CONFIG.bookmarkTabMap.set(tabId, result.id);
          CONFIG.tabBookmarkMap.set(tabId, result);
          logger.info(`✅ Связь по похожести названий: вкладка ${tabId} → "${result.title}"`);
          resolve(result);
          return;
        }
      }

      logger.debug(`⚠️ Закладка не найдена для вкладки ${tabId}`);
      resolve(null);
    });
  });
}

// ============================================================
// 8. ОБНОВЛЕНИЕ СПИСКА БУКМАРКЛЕТОВ С TAB ID
// ============================================================

function updateBookmarkletList() {
  const bookmarklets = CONFIG.bookmarklets || [];

  if (bookmarklets.length === 0) return;

  logger.info('📋 ОБНОВЛЕННЫЙ СПИСОК БУКМАРКЛЕТОВ С TAB ID:');

  for (const bm of bookmarklets) {
    let tabId = '—';
    for (const [tId, bmData] of CONFIG.tabBookmarkMap) {
      if (bmData.id === bm.id) {
        tabId = tId;
        break;
      }
    }

    const urlPreview = bm.url.substring(0, 50) + (bm.url.length > 50 ? '...' : '');
    logger.info(`   📌 ${bm.title}`);
    logger.info(`      📂 ${bm.path}`);
    logger.info(`      🔗 ${urlPreview}`);
    logger.info(`      🆔 ${bm.id}`);
    logger.info(`      📌 Tab ID: ${tabId}`);
    logger.info('   ──────────────────────────────');
  }
}

// ============================================================
// 9. ОТСЛЕЖИВАНИЕ ИЗМЕНЕНИЙ ВКЛАДОК
// ============================================================

chrome.tabs.onActivated.addListener(activeInfo => {
  const tabId = activeInfo.tabId;
  CONFIG.activeTabId = tabId;
  logger.debug(`🔄 Активная вкладка: ${tabId}`);

  chrome.tabs.get(tabId, tab => {
    if (!chrome.runtime.lastError && tab) {
      findBookmarkForTab(tab);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title) {
    logger.debug(`🔄 Обновление вкладки ${tabId}: ${tab.title || '—'}`);
    findBookmarkForTab(tab);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (CONFIG.bookmarkTabMap.has(tabId)) {
    const bookmarkId = CONFIG.bookmarkTabMap.get(tabId);
    logger.debug(`🗑️ Вкладка ${tabId} закрыта, удаляем связь с закладкой ${bookmarkId}`);
    CONFIG.bookmarkTabMap.delete(tabId);
    CONFIG.tabBookmarkMap.delete(tabId);
  }
});

chrome.tabs.onCreated.addListener(tab => {
  if (tab.id) {
    logger.debug(`🆕 Создана вкладка ${tab.id}`);
    setTimeout(() => {
      if (tab.url && !isIgnoredUrl(tab.url)) {
        chrome.tabs.get(tab.id, updatedTab => {
          if (!chrome.runtime.lastError && updatedTab) {
            findBookmarkForTab(updatedTab);
          }
        });
      }
    }, 500);
  }
});

// ============================================================
// 10. ФУНКЦИИ ПОИСКА (ДЛЯ ЗАПРОСОВ)
// ============================================================

function findBookmarkByTabId(tabId) {
  return new Promise(resolve => {
    if (CONFIG.tabBookmarkMap.has(tabId)) {
      const cached = CONFIG.tabBookmarkMap.get(tabId);
      logger.debug(`✅ Найдена закладка для tabId ${tabId} в кеше: ${cached.title}`);
      resolve(cached);
      return;
    }

    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError || !tab) {
        resolve(null);
        return;
      }
      findBookmarkForTab(tab).then(resolve);
    });
  });
}

function findBookmarkByUrlOrId(url, tabId, bookmarkId) {
  return new Promise(resolve => {
    if (!url && !bookmarkId) {
      resolve(null);
      return;
    }

    if (bookmarkId) {
      chrome.bookmarks.get(bookmarkId, async results => {
        if (chrome.runtime.lastError || !results || results.length === 0) {
          resolve(null);
          return;
        }
        const bookmark = results[0];
        const result = {
          id: bookmark.id,
          title: bookmark.title || 'Без названия',
          url: bookmark.url,
          parentId: bookmark.parentId,
          tabId: tabId || null,
          isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
          type: bookmark.url && bookmark.url.startsWith('javascript:') ? 'bookmarklet' : 'url',
          matchedBy: 'id',
          timestamp: Date.now(),
        };
        const path = await getBookmarkPath(bookmark.parentId);
        result.path = path;
        resolve(result);
      });
      return;
    }

    chrome.bookmarks.search(url, async results => {
      if (chrome.runtime.lastError || !results || results.length === 0) {
        resolve(null);
        return;
      }
      const bookmark = results[0];
      const result = {
        id: bookmark.id,
        title: bookmark.title || 'Без названия',
        url: bookmark.url,
        parentId: bookmark.parentId,
        tabId: tabId || null,
        isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
        type: bookmark.url && bookmark.url.startsWith('javascript:') ? 'bookmarklet' : 'url',
        matchedBy: 'url',
        timestamp: Date.now(),
      };
      const path = await getBookmarkPath(bookmark.parentId);
      result.path = path;
      resolve(result);
    });
  });
}

// ============================================================
// 11. ОТКРЫТИЕ ОКНА ПО КЛИКУ НА ИКОНКУ
// ============================================================

chrome.action.onClicked.addListener(tab => {
  logger.info('🔘 Клик по иконке расширения');
  openExtensionWindow();
});

function openExtensionWindow() {
  logger.info('📂 Открытие окна расширения...');

  // Проверяем, есть ли уже открытое окно
  if (CONFIG.extensionWindowId) {
    chrome.windows.get(CONFIG.extensionWindowId, window => {
      if (!chrome.runtime.lastError && window) {
        logger.info(`🔄 Фокусировка существующего окна (ID: ${window.id})`);
        chrome.windows.update(window.id, { focused: true });
        return;
      }
      CONFIG.extensionWindowId = null;
      createNewWindow();
    });
    return;
  }

  // Ищем открытое окно с popup.html
  chrome.windows.getAll({ populate: true }, windows => {
    const popupUrl = chrome.runtime.getURL('popup.html');
    for (const win of windows) {
      if (win.tabs) {
        for (const tab of win.tabs) {
          if (tab.url && tab.url.includes('popup.html')) {
            logger.info(`🔄 Найдено открытое окно (ID: ${win.id}), фокусируем`);
            CONFIG.extensionWindowId = win.id;
            chrome.windows.update(win.id, { focused: true });
            return;
          }
        }
      }
    }
    createNewWindow();
  });
}

function createNewWindow() {
  logger.info('🆕 Создание нового окна...');

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
          CONFIG.extensionWindowId = window.id;
          logger.info(`✅ Окно расширения создано (ID: ${window.id})`);
        }
      }
    );
  });
}

// ============================================================
// 12. ОБРАБОТЧИК СООБЩЕНИЙ
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Получение tabId
  if (request.action === 'get_tab_id') {
    const tabId = sender.tab?.id || null;
    logger.info(`📌 Запрос tabId: ${tabId}`);
    sendResponse({ tabId: tabId });
    return true;
  }

  // Поиск по tabId
  if (request.action === 'find_bookmark_by_tab_id') {
    const tabId = request.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse(null);
      return true;
    }
    logger.info(`📨 Поиск закладки по tabId: ${tabId}`);
    findBookmarkByTabId(tabId).then(result => {
      if (result) {
        logger.info(`✅ Найдена закладка для tabId ${tabId}: ${result.title}`);
      } else {
        logger.warn(`⚠️ Закладка не найдена для tabId ${tabId}`);
      }
      sendResponse(result);
    });
    return true;
  }

  // Поиск по URL
  if (request.action === 'find_bookmark_by_url') {
    const url = request.url || sender.tab?.url;
    const tabId = request.tabId || sender.tab?.id;
    const bookmarkId = request.bookmarkId || null;

    if (tabId && CONFIG.tabBookmarkMap.has(tabId)) {
      sendResponse(CONFIG.tabBookmarkMap.get(tabId));
      return true;
    }

    if (isIgnoredUrl(url)) {
      sendResponse(null);
      return true;
    }

    findBookmarkByUrlOrId(url, tabId, bookmarkId).then(result => {
      if (result && tabId) {
        CONFIG.bookmarkTabMap.set(tabId, result.id);
        CONFIG.tabBookmarkMap.set(tabId, result);
        logger.info(`✅ Сохранена связь: tabId ${tabId} → "${result.title}"`);
      }
      sendResponse(result);
    });
    return true;
  }

  // Получение всех закладок
  if (request.action === 'get_all_bookmarks') {
    if (CONFIG.bookmarksCache) {
      sendResponse({ success: true, data: CONFIG.bookmarksCache });
    } else {
      loadAllBookmarks().then(result => {
        sendResponse({ success: true, data: result });
      });
    }
    return true;
  }

  // Получение закладок с tabId
  if (request.action === 'get_all_bookmarks_with_tab_id') {
    const data = [];
    for (const [tabId, bookmarkData] of CONFIG.tabBookmarkMap) {
      data.push({ tabId, bookmark: bookmarkData });
    }
    sendResponse({ success: true, data });
    return true;
  }

  // Получение статистики
  if (request.action === 'get_tab_bookmark_stats') {
    const stats = {
      totalTabs: CONFIG.tabBookmarkMap.size,
      tabBookmarkMap: Array.from(CONFIG.tabBookmarkMap.entries()).map(([tabId, data]) => ({
        tabId,
        bookmarkId: data.id,
        bookmarkTitle: data.title,
        matchedBy: data.matchedBy || 'unknown',
      })),
    };
    sendResponse({ success: true, stats });
    return true;
  }

  // Принудительное обновление
  if (request.action === 'refresh_tab_ids') {
    logger.info('🔄 Принудительное обновление tabId');
    CONFIG.initialized = false;
    CONFIG.tabBookmarkMap.clear();
    CONFIG.bookmarkTabMap.clear();
    initializeAllTabs().then(() => {
      sendResponse({ success: true, count: CONFIG.tabBookmarkMap.size });
    });
    return true;
  }

  // Ping
  if (request.action === 'ping') {
    sendResponse({ status: 'ok', timestamp: Date.now() });
    return true;
  }

  // Очистка кеша
  if (request.action === 'clear_cache') {
    CONFIG.cache.clear();
    logger.info('🗑️ Кеш очищен');
    sendResponse({ success: true });
    return true;
  }

  // Открытие окна
  if (request.action === 'open_extension_window') {
    openExtensionWindow();
    sendResponse({ success: true });
    return true;
  }

  return false;
});

// ============================================================
// 13. ИНИЦИАЛИЗАЦИЯ
// ============================================================

logger.info('═══════════════════════════════════════════════════════════');
logger.info('📦 Bookmarklet Bridge запущен');
logger.info('📌 Версия: 1.0.0');
logger.info('📌 Использует chrome.tabs.query() для получения tabId');
logger.info('📌 Отслеживает все открытые вкладки');
logger.info('📌 Клик по иконке открывает отдельное окно');
logger.info('═══════════════════════════════════════════════════════════');
logger.info('📋 Доступные команды:');
logger.info('  __extensionAPI.getAllTabs() - получить все вкладки');
logger.info('  __extensionAPI.initializeAllTabs() - инициализировать вкладки');
logger.info('  __extensionAPI.findBookmarkByTabId(tabId) - поиск по tabId');
logger.info('  __extensionAPI.findBookmarkByUrl(url, tabId) - поиск по URL');
logger.info('  __extensionAPI.getTabBookmarkStats() - статистика связей');
logger.info('  __extensionAPI.refreshTabIds() - обновить tabId');
logger.info('  __extensionAPI.openExtensionWindow() - открыть окно');
logger.info('');

// Загружаем закладки и инициализируем вкладки
setTimeout(async () => {
  await loadAllBookmarks();
  await initializeAllTabs();
}, 1000);

// Повторная инициализация через 3 секунды
setTimeout(async () => {
  if (!CONFIG.initialized) {
    logger.info('🔄 Повторная инициализация вкладок...');
    await initializeAllTabs();
  }
}, 3000);

// Повторная инициализация через 5 секунд (на всякий случай)
setTimeout(async () => {
  if (CONFIG.tabBookmarkMap.size === 0) {
    logger.info('🔄 Повторная инициализация вкладок (через 5с)...');
    await initializeAllTabs();
  }
}, 5000);

// ============================================================
// 14. ЭКСПОРТ API
// ============================================================

if (typeof self !== 'undefined') {
  self.__extensionAPI = {
    getAllTabs,
    initializeAllTabs,
    loadAllBookmarks,
    findBookmarkByTabId,
    findBookmarkByUrlOrId,
    openExtensionWindow,
    refreshTabIds: () => {
      CONFIG.initialized = false;
      CONFIG.tabBookmarkMap.clear();
      CONFIG.bookmarkTabMap.clear();
      return initializeAllTabs();
    },
    getTabBookmarkStats: () => ({
      totalTabs: CONFIG.tabBookmarkMap.size,
      tabBookmarkMap: Array.from(CONFIG.tabBookmarkMap.entries()).map(([tabId, data]) => ({
        tabId,
        bookmarkId: data.id,
        bookmarkTitle: data.title,
        matchedBy: data.matchedBy || 'unknown',
      })),
      bookmarklets: CONFIG.bookmarklets.map(bm => ({
        id: bm.id,
        title: bm.title,
        hasTab: Array.from(CONFIG.tabBookmarkMap.values()).some(v => v.id === bm.id),
      })),
    }),
    clearCache: () => {
      CONFIG.cache.clear();
      logger.info('🗑️ Кеш очищен');
    },
    CONFIG,
    logger,
  };
}

logger.info('✅ Bookmarklet Bridge готов к работе');
logger.info('═══════════════════════════════════════════════════════════');
