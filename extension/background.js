// background.js - Полностью исправленная версия
// Версия: 2.0.0

// ============================================================
// 1. ПРИВАТНЫЕ СИМВОЛЫ (100% изоляция)
// ============================================================

const PRIVATE = {
  CONFIG: Symbol('background.config'),
  LOGGER: Symbol('background.logger'),
  STATE: Symbol('background.state'),
  CACHE: Symbol('background.cache'),
  BOOKMARKLETS: Symbol('background.bookmarklets'),
  RESULTS: Symbol('background.results'),
  INITIALIZED: Symbol('background.initialized'),
  IS_UPDATING: Symbol('background.isUpdating'),
  LAST_UPDATE: Symbol('background.lastUpdate'),
  GENERATOR: Symbol('background.generator'),
  GENERATOR_LOADED: Symbol('background.generatorLoaded'),
  BOOKMARKS: Symbol('background.bookmarks'),
  BOOKMARKLETS_LIST: Symbol('background.bookmarkletsList'),
  FOLDERS: Symbol('background.folders'),
  AUTO_UPDATE_DONE: Symbol('background.autoUpdateDone'),
  UPDATE_RESULTS: Symbol('background.updateResults'),
  DETECT_TYPE: Symbol('background.detectType'),
  GENERATE_CODE: Symbol('background.generateCode'),
  UPDATE_BOOKMARK: Symbol('background.updateBookmark'),
  UPDATE_ALL: Symbol('background.updateAll'),
  GET_LIST: Symbol('background.getList'),
  REFRESH: Symbol('background.refresh'),
  FORCE_UPDATE: Symbol('background.forceUpdate'),
  INTERNAL: Symbol('background.internal'),
  TIMERS: Symbol('background.timers'),
  LISTENERS: Symbol('background.listeners'),
  SECURE: Symbol('background.secure'),
  VALIDATOR: Symbol('background.validator'),
  DEBUG: Symbol('background.debug'),
  LOG_HISTORY: Symbol('background.logHistory'),
  VERSION: Symbol('background.version'),
  BUILD: Symbol('background.build'),
};

// ============================================================
// 2. ПУБЛИЧНЫЕ СИМВОЛЫ
// ============================================================

const PUBLIC = {
  API: Symbol.for('background.api'),
  STATE: Symbol.for('background.state'),
  CONFIG: Symbol.for('background.config'),
  LOGGER: Symbol.for('background.logger'),
  GENERATOR: Symbol.for('background.generator'),
  UPDATER: Symbol.for('background.updater'),
  REFRESHER: Symbol.for('background.refresher'),
  INSTANCE: Symbol.for('background.instance'),
  EVENTS: Symbol.for('background.events'),
};

// ============================================================
// 3. КОНФИГУРАЦИЯ
// ============================================================

const DEFAULT_CONFIG = {
  debug: true,
  basePath: './Bookmarklet/',
  files: {
    env: 'src/env-panel.js',
    logs: 'src/logs-panel.js',
    debug: 'src/debug-panel.js',
    main: 'bookmarklet.js',
    manager: 'src/manager.html',
    widget: 'widget.mjs',
  },
  source: 'my-bookmarklet',
  extensionSource: 'my-extension-bridge',
  responseType: 'BOOKMARK_DATA_RESPONSE',
  timeout: 5000,
  version: '2.0.0',
  maxRetries: 3,
  retryDelay: 1000,
  autoUpdate: true,
};

// ============================================================
// 4. ПРОСТОЙ ЛОГГЕР (без зависимостей)
// ============================================================

function createLogger(debug = true) {
  const logHistory = [];
  const maxHistory = 200;

  function _log(level, message, data = null, style = 'info') {
    if (!debug && level !== 'error') return;

    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix = `[${timestamp}] [Background]`;

    logHistory.push({ timestamp, level, message, data });
    if (logHistory.length > maxHistory) {
      logHistory.shift();
    }

    if (data !== null && data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  return {
    error: (msg, d) => _log('error', `❌ ${msg}`, d),
    warn: (msg, d) => _log('warn', `⚠️ ${msg}`, d),
    info: (msg, d) => _log('info', `ℹ️ ${msg}`, d),
    debug: (msg, d) => _log('debug', `🔍 ${msg}`, d),
    success: (msg, d) => _log('info', `✅ ${msg}`, d),

    header(title) {
      console.log('═'.repeat(70));
      console.log(`  🚀 ${title}`);
      console.log('═'.repeat(70));
    },

    separator() {
      console.log('─'.repeat(70));
    },

    symbol(name, symbol) {
      console.log(`  🔑 ${name}: ${String(symbol)}`);
    },

    private(name, symbol) {
      console.log(`  🔒 ${name}: ${String(symbol)}`);
    },

    getHistory: () => [...logHistory],
    clearHistory: () => {
      logHistory.length = 0;
      return this;
    },
    setDebug: enabled => {
      debug = enabled;
      return this;
    },
  };
}

// ============================================================
// 5. ГЕНЕРАТОР БУКМАРКЛЕТОВ
// ============================================================

class BookmarkletGenerator {
  constructor(options = {}) {
    this[PRIVATE.CONFIG] = { ...DEFAULT_CONFIG, ...options };
    this[PRIVATE.LOGGER] = createLogger(options.debug !== false);
    this[PRIVATE.CACHE] = new Map();
    this[PRIVATE.BOOKMARKLETS] = [];
    this[PRIVATE.RESULTS] = null;
    this[PRIVATE.INITIALIZED] = false;
    this[PRIVATE.IS_UPDATING] = false;
    this[PRIVATE.LAST_UPDATE] = null;
    this[PRIVATE.VERSION] = options.version || DEFAULT_CONFIG.version;

    const logger = this[PRIVATE.LOGGER];
    logger.header('СОЗДАНИЕ ГЕНЕРАТОРА');
    logger.info(`📦 Версия: ${this[PRIVATE.VERSION]}`);

    this[PRIVATE.INITIALIZED] = true;
    logger.success('✅ Генератор создан');
  }

  [PRIVATE.DETECT_TYPE](title) {
    const lower = title.toLowerCase();
    let type = 'main';
    if (lower.includes('env') || lower.includes('control')) type = 'env';
    else if (lower.includes('log')) type = 'logs';
    else if (lower.includes('debug')) type = 'debug';
    else if (lower.includes('manager')) type = 'manager';
    else if (lower.includes('widget')) type = 'widget';
    else if (lower.includes('sw') || lower.includes('service')) type = 'sw';
    else if (lower.includes('reset') || lower.includes('сброс')) type = 'reset';
    return type;
  }

  [PRIVATE.GENERATE_CODE](bookmarkData, options = {}) {
    const config = this[PRIVATE.CONFIG];
    const title = bookmarkData?.title || options.title || 'Bookmarklet';
    const type = options.type || this[PRIVATE.DETECT_TYPE](title);

    const fileMap = {
      env: config.files.env,
      logs: config.files.logs,
      debug: config.files.debug,
      main: config.files.main,
      manager: config.files.manager,
      widget: config.files.widget,
    };
    const file = fileMap[type] || fileMap.main;
    const fullPath = config.basePath + file;

    if (type === 'manager') {
      return `javascript:window.open('${fullPath}','_blank','width=900,height=800,menubar=no,toolbar=no,location=no,status=no');`;
    }

    if (type === 'sw') {
      return `javascript:(function(){if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>console.log('✅ SW зарегистрирован')).catch(err=>console.error('❌ Ошибка:',err));}})();`;
    }

    if (type === 'reset') {
      return `javascript:(function(){if(confirm('⚠️ Очистить всё состояние?')){var keys=Object.keys(localStorage);var count=0;keys.forEach(function(key){if(key.startsWith('env-panel-')||key.startsWith('shared_')||key.startsWith('bookmarklet-')||key.startsWith('logs-panel-')||key.startsWith('debug-panel-')){localStorage.removeItem(key);count++;}});alert('✅ Удалено '+count+' записей. Перезагрузите страницу.');location.reload();}})();`;
    }

    const safeTitle = title.replace(/[^a-zA-Zа-яА-Я0-9 ]/g, '').trim();

    return `javascript:(function(){
  const s=document.createElement('script');
  s.type='module';
  s.src='${fullPath}';
  s.dataset.bookmarkletName='${safeTitle}';
  s.dataset.bookmarkletType='${type}';
  s.onload=()=>setTimeout(()=>{
    const i=window.R||window.__bookmarkletInstance;
    if(i&&i.togglePanel)i.togglePanel();
    else if(i&&i.runPanel)i.runPanel();
    else if(i&&i.loadPanel)i.loadPanel('${type}');
  },200);
  document.head.appendChild(s);
})();`;
  }

  [PRIVATE.UPDATE_BOOKMARK](bookmarkId, newCode) {
    return new Promise((resolve, reject) => {
      if (!bookmarkId) {
        reject(new Error('bookmarkId is required'));
        return;
      }
      if (!newCode || !newCode.startsWith('javascript:')) {
        reject(new Error('newCode must start with "javascript:"'));
        return;
      }

      chrome.bookmarks.update(bookmarkId, { url: newCode }, result => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    });
  }

  [PRIVATE.UPDATE_ALL](bookmarklets) {
    const results = {
      total: bookmarklets.length,
      updated: 0,
      failed: 0,
      errors: [],
      details: [],
      timestamp: Date.now(),
    };

    return new Promise(resolve => {
      let processed = 0;
      const total = bookmarklets.length;

      if (total === 0) {
        resolve(results);
        return;
      }

      for (const bm of bookmarklets) {
        if (!bm.url || !bm.url.startsWith('javascript:')) {
          processed++;
          if (processed === total) resolve(results);
          continue;
        }

        const type = this[PRIVATE.DETECT_TYPE](bm.title);
        const newCode = this[PRIVATE.GENERATE_CODE](
          { id: bm.id, title: bm.title },
          { type, title: bm.title }
        );

        this[PRIVATE.UPDATE_BOOKMARK](bm.id, newCode)
          .then(() => {
            results.updated++;
            results.details.push({ id: bm.id, title: bm.title, type, success: true });
          })
          .catch(error => {
            results.failed++;
            results.errors.push({ id: bm.id, title: bm.title, error: error.message });
          })
          .finally(() => {
            processed++;
            if (processed === total) {
              resolve(results);
            }
          });
      }
    });
  }

  [PRIVATE.GET_LIST]() {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      chrome.runtime.sendMessage({ action: 'get_all_bookmarks' }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success && response.data) {
          resolve(response.data.bookmarklets || []);
        } else {
          reject(new Error('Invalid response from extension'));
        }
      });
    });
  }

  [PRIVATE.REFRESH]() {
    if (this[PRIVATE.IS_UPDATING]) {
      return Promise.resolve(this[PRIVATE.RESULTS]);
    }

    this[PRIVATE.IS_UPDATING] = true;

    return this[PRIVATE.GET_LIST]()
      .then(bookmarklets => {
        this[PRIVATE.BOOKMARKLETS] = bookmarklets;
        return this[PRIVATE.UPDATE_ALL](bookmarklets);
      })
      .then(results => {
        this[PRIVATE.RESULTS] = results;
        this[PRIVATE.LAST_UPDATE] = Date.now();
        this[PRIVATE.IS_UPDATING] = false;
        return results;
      })
      .catch(error => {
        this[PRIVATE.IS_UPDATING] = false;
        throw error;
      });
  }

  // Публичные методы
  generateCode(bookmarkData, options = {}) {
    return this[PRIVATE.GENERATE_CODE](bookmarkData, options);
  }

  updateBookmark(bookmarkId, newCode) {
    return this[PRIVATE.UPDATE_BOOKMARK](bookmarkId, newCode);
  }

  updateAll(bookmarklets) {
    return this[PRIVATE.UPDATE_ALL](bookmarklets);
  }

  getList() {
    return this[PRIVATE.GET_LIST]();
  }

  refresh() {
    return this[PRIVATE.REFRESH]();
  }

  getState() {
    return {
      initialized: this[PRIVATE.INITIALIZED],
      isUpdating: this[PRIVATE.IS_UPDATING],
      bookmarklets: this[PRIVATE.BOOKMARKLETS].length,
      results: this[PRIVATE.RESULTS],
      lastUpdate: this[PRIVATE.LAST_UPDATE],
      version: this[PRIVATE.VERSION],
    };
  }

  getConfig() {
    return { ...this[PRIVATE.CONFIG] };
  }

  getBookmarklets() {
    return [...this[PRIVATE.BOOKMARKLETS]];
  }

  clearCache() {
    this[PRIVATE.CACHE].clear();
    return this;
  }

  reset() {
    this[PRIVATE.BOOKMARKLETS] = [];
    this[PRIVATE.RESULTS] = null;
    this[PRIVATE.CACHE].clear();
    this[PRIVATE.IS_UPDATING] = false;
    this[PRIVATE.LAST_UPDATE] = null;
    return this;
  }
}

// ============================================================
// 6. ОСНОВНОЙ КЛАСС BACKGROUND SERVICE
// ============================================================

class BackgroundService {
  constructor(options = {}) {
    // Создаём логгер
    const debug = options.debug !== false;
    const logger = createLogger(debug);

    // Инициализируем приватные свойства
    this[PRIVATE.CONFIG] = { ...DEFAULT_CONFIG, ...options };
    this[PRIVATE.LOGGER] = logger;
    this[PRIVATE.STATE] = {
      initialized: false,
      isRunning: false,
      isDestroyed: false,
    };
    this[PRIVATE.CACHE] = new Map();
    this[PRIVATE.BOOKMARKS] = [];
    this[PRIVATE.BOOKMARKLETS_LIST] = [];
    this[PRIVATE.FOLDERS] = [];
    this[PRIVATE.RESULTS] = null;
    this[PRIVATE.LAST_UPDATE] = null;
    this[PRIVATE.AUTO_UPDATE_DONE] = false;
    this[PRIVATE.IS_UPDATING] = false;
    this[PRIVATE.TIMERS] = new Map();
    this[PRIVATE.LISTENERS] = new Map();
    this[PRIVATE.VERSION] = options.version || DEFAULT_CONFIG.version;
    this[PRIVATE.BUILD] = options.build || '2026-07-18';

    // Теперь можно использовать логгер
    logger.header('ЗАПУСК BACKGROUND SERVICE');
    logger.info(`📦 Версия: ${this[PRIVATE.VERSION]}`);
    logger.info(`📅 Сборка: ${this[PRIVATE.BUILD]}`);

    // Создаём генератор
    this[PRIVATE.GENERATOR] = new BookmarkletGenerator(this[PRIVATE.CONFIG]);
    this[PRIVATE.GENERATOR_LOADED] = true;
    logger.success('✅ Генератор создан');

    // Экспортируем символы
    this._exportSymbols();

    // Инициализация
    this._init();

    logger.success('✅ Background Service инициализирован');
    logger.header('ГОТОВ');
  }

  _exportSymbols() {
    const logger = this[PRIVATE.LOGGER];

    if (typeof self !== 'undefined') {
      self[PUBLIC.API] = this;
      self[PUBLIC.STATE] = this.getState.bind(this);
      self[PUBLIC.CONFIG] = this.getConfig.bind(this);
      self[PUBLIC.LOGGER] = this[PRIVATE.LOGGER];
      self[PUBLIC.GENERATOR] = this[PRIVATE.GENERATOR];
      self[PUBLIC.UPDATER] = this.updateAll.bind(this);
      self[PUBLIC.REFRESHER] = this.refresh.bind(this);
      self[PUBLIC.INSTANCE] = this;
      self[PUBLIC.EVENTS] = {
        on: this.on.bind(this),
        off: this.off.bind(this),
        emit: this.emit.bind(this),
      };

      self.__backgroundSymbols = {
        PRIVATE: PRIVATE,
        PUBLIC: PUBLIC,
        version: this[PRIVATE.VERSION],
      };
    }
  }

  _init() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔧 Инициализация...');

    this._setupListeners();
    this._loadBookmarks();
    this._setupTimers();

    this[PRIVATE.STATE].initialized = true;
    logger.success('✅ Инициализация завершена');
  }

  _setupListeners() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('👂 Настройка слушателей...');

    chrome.runtime.onInstalled.addListener(details => {
      logger.info(`📦 Расширение установлено/обновлено: ${details.reason}`);
      setTimeout(() => {
        this._autoUpdateBookmarks();
      }, 2000);
    });

    chrome.action.onClicked.addListener(() => {
      logger.info('🖱️ Клик по иконке');
      this._openPopupWindow();
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      return this._handleMessage(request, sender, sendResponse);
    });

    logger.success('✅ Слушатели настроены');
  }

  _setupTimers() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('⏱️ Настройка таймеров...');

    const checkInterval = setInterval(
      () => {
        if (!this[PRIVATE.AUTO_UPDATE_DONE]) {
          this._autoUpdateBookmarks();
        }
      },
      30 * 60 * 1000
    );
    this[PRIVATE.TIMERS].set('checkInterval', checkInterval);

    const cacheCleanup = setInterval(
      () => {
        this[PRIVATE.CACHE].clear();
      },
      60 * 60 * 1000
    );
    this[PRIVATE.TIMERS].set('cacheCleanup', cacheCleanup);

    logger.success('✅ Таймеры настроены');
  }

  _openPopupWindow() {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 420,
      height: 560,
      focused: true,
    });
  }

  _autoUpdateBookmarks() {
    const logger = this[PRIVATE.LOGGER];

    if (!this[PRIVATE.GENERATOR_LOADED] || !this[PRIVATE.GENERATOR]) {
      logger.warn('⚠️ Генератор не загружен');
      return;
    }

    if (this[PRIVATE.IS_UPDATING]) {
      logger.warn('⏳ Обновление уже выполняется');
      return;
    }

    logger.info('🔄 Автоматическое обновление букмарклетов...');
    this[PRIVATE.IS_UPDATING] = true;

    this[PRIVATE.GENERATOR]
      [PRIVATE.REFRESH]()
      .then(results => {
        this[PRIVATE.RESULTS] = results;
        this[PRIVATE.LAST_UPDATE] = Date.now();
        this[PRIVATE.AUTO_UPDATE_DONE] = true;
        this[PRIVATE.IS_UPDATING] = false;
        logger.success(`✅ Автообновление завершено: ${results.updated} обновлено`);
      })
      .catch(error => {
        this[PRIVATE.IS_UPDATING] = false;
        logger.error('❌ Ошибка автообновления:', error.message);
      });
  }

  _loadBookmarks() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('📑 Загрузка закладок...');

    chrome.bookmarks.getTree(tree => {
      if (chrome.runtime.lastError) {
        logger.error('❌ Ошибка загрузки:', chrome.runtime.lastError.message);
        return;
      }

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
            isBookmarklet,
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

      this[PRIVATE.BOOKMARKS] = allBookmarks;
      this[PRIVATE.BOOKMARKLETS_LIST] = bookmarklets;
      this[PRIVATE.FOLDERS] = folders;

      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('📊 СТАТИСТИКА ЗАКЛАДОК');
      logger.info(`   📑 Всего закладок: ${allBookmarks.length}`);
      logger.info(`   📌 Букмарклетов: ${bookmarklets.length}`);
      logger.info(`   📁 Папок: ${folders.length}`);
      logger.info('═══════════════════════════════════════════════════════════');

      if (bookmarklets.length > 0 && !this[PRIVATE.AUTO_UPDATE_DONE]) {
        setTimeout(() => {
          this._autoUpdateBookmarks();
        }, 1000);
      }
    });
  }

  _handleMessage(request, sender, sendResponse) {
    const logger = this[PRIVATE.LOGGER];
    const generator = this[PRIVATE.GENERATOR];

    if (request.action === 'ping') {
      sendResponse({
        status: 'ok',
        timestamp: Date.now(),
        generatorLoaded: this[PRIVATE.GENERATOR_LOADED],
        lastUpdate: this[PRIVATE.LAST_UPDATE],
        version: this[PRIVATE.VERSION],
      });
      return true;
    }

    if (request.action === 'get_all_bookmarks') {
      sendResponse({
        success: true,
        data: {
          all: this[PRIVATE.BOOKMARKS],
          bookmarklets: this[PRIVATE.BOOKMARKLETS_LIST],
          folders: this[PRIVATE.FOLDERS],
          timestamp: Date.now(),
        },
      });
      return true;
    }

    if (request.action === 'find_bookmark_by_url') {
      const found = this[PRIVATE.BOOKMARKS].find(b => b.url === request.url);
      sendResponse(found || null);
      return true;
    }

    if (request.action === 'generate_bookmarklet') {
      if (!this[PRIVATE.GENERATOR_LOADED] || !generator) {
        sendResponse({ success: false, error: 'Генератор не загружен' });
        return true;
      }

      try {
        const code = generator.generateCode(request.bookmarkData, request.options);
        sendResponse({ success: true, code });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }

    if (request.action === 'update_bookmarklets') {
      if (!this[PRIVATE.GENERATOR_LOADED] || !generator) {
        sendResponse({ success: false, error: 'Генератор не загружен' });
        return true;
      }

      generator[PRIVATE.REFRESH]()
        .then(results => {
          this[PRIVATE.RESULTS] = results;
          this[PRIVATE.LAST_UPDATE] = Date.now();
          sendResponse({ success: true, results });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    if (request.action === 'force_update_bookmarklets') {
      if (!this[PRIVATE.GENERATOR_LOADED] || !generator) {
        sendResponse({ success: false, error: 'Генератор не загружен' });
        return true;
      }

      this._forceUpdateBookmarks()
        .then(results => {
          sendResponse({ success: true, results });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }

    if (request.action === 'generator_status') {
      sendResponse({
        loaded: this[PRIVATE.GENERATOR_LOADED],
        hasGenerator: !!this[PRIVATE.GENERATOR],
        lastUpdate: this[PRIVATE.LAST_UPDATE],
        updateResults: this[PRIVATE.RESULTS],
        isUpdating: this[PRIVATE.IS_UPDATING],
        version: this[PRIVATE.VERSION],
      });
      return true;
    }

    if (request.action === 'clear_cache') {
      if (generator) generator.clearCache();
      this[PRIVATE.CACHE].clear();
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'get_state') {
      sendResponse({
        success: true,
        state: this.getState(),
      });
      return true;
    }

    return false;
  }

  async _forceUpdateBookmarks() {
    const logger = this[PRIVATE.LOGGER];

    if (!this[PRIVATE.GENERATOR_LOADED] || !this[PRIVATE.GENERATOR]) {
      throw new Error('Генератор не загружен');
    }

    if (this[PRIVATE.IS_UPDATING]) {
      throw new Error('Обновление уже выполняется');
    }

    logger.info('🔄 Принудительное обновление всех букмарклетов...');
    this[PRIVATE.IS_UPDATING] = true;

    try {
      const bookmarklets = await this[PRIVATE.GENERATOR][PRIVATE.GET_LIST]();
      logger.info(`📦 Найдено ${bookmarklets.length} букмарклетов`);

      let updated = 0;
      let failed = 0;
      const errors = [];
      const details = [];

      for (const bm of bookmarklets) {
        const type = this[PRIVATE.GENERATOR][PRIVATE.DETECT_TYPE](bm.title);
        const newCode = this[PRIVATE.GENERATOR][PRIVATE.GENERATE_CODE](
          { id: bm.id, title: bm.title },
          { type, title: bm.title }
        );

        try {
          await this[PRIVATE.GENERATOR][PRIVATE.UPDATE_BOOKMARK](bm.id, newCode);
          updated++;
          details.push({ id: bm.id, title: bm.title, type, success: true });
          logger.success(`✅ Обновлён: "${bm.title}" (${type})`);
        } catch (error) {
          failed++;
          errors.push({ id: bm.id, title: bm.title, error: error.message });
          logger.error(`❌ Ошибка "${bm.title}":`, error.message);
        }
      }

      const results = {
        total: bookmarklets.length,
        updated,
        failed,
        errors,
        details,
        timestamp: Date.now(),
        forced: true,
      };

      this[PRIVATE.RESULTS] = results;
      this[PRIVATE.LAST_UPDATE] = Date.now();
      this[PRIVATE.IS_UPDATING] = false;

      logger.info(`📊 Результат: ${updated} обновлено, ${failed} ошибок`);
      return results;
    } catch (error) {
      this[PRIVATE.IS_UPDATING] = false;
      logger.error('❌ Ошибка принудительного обновления:', error.message);
      throw error;
    }
  }

  // ============================================================
  // ПУБЛИЧНЫЕ МЕТОДЫ
  // ============================================================

  getState() {
    return {
      initialized: this[PRIVATE.STATE].initialized,
      isRunning: this[PRIVATE.STATE].isRunning,
      isDestroyed: this[PRIVATE.STATE].isDestroyed,
      isUpdating: this[PRIVATE.IS_UPDATING],
      generatorLoaded: this[PRIVATE.GENERATOR_LOADED],
      bookmarksCount: this[PRIVATE.BOOKMARKS].length,
      bookmarkletsCount: this[PRIVATE.BOOKMARKLETS_LIST].length,
      foldersCount: this[PRIVATE.FOLDERS].length,
      lastUpdate: this[PRIVATE.LAST_UPDATE],
      updateResults: this[PRIVATE.RESULTS],
      autoUpdateDone: this[PRIVATE.AUTO_UPDATE_DONE],
      version: this[PRIVATE.VERSION],
      build: this[PRIVATE.BUILD],
      cacheSize: this[PRIVATE.CACHE].size,
      listenersCount: this[PRIVATE.LISTENERS].size,
      timersCount: this[PRIVATE.TIMERS].size,
    };
  }

  getConfig() {
    return { ...this[PRIVATE.CONFIG] };
  }

  getLogger() {
    return this[PRIVATE.LOGGER];
  }

  getGenerator() {
    return this[PRIVATE.GENERATOR];
  }

  isGeneratorLoaded() {
    return this[PRIVATE.GENERATOR_LOADED];
  }

  refresh() {
    return this._autoUpdateBookmarks();
  }

  updateAll() {
    return this._forceUpdateBookmarks();
  }

  openPopup() {
    this._openPopupWindow();
  }

  // ============================================================
  // СОБЫТИЯ
  // ============================================================

  on(event, callback) {
    if (!this[PRIVATE.LISTENERS].has(event)) {
      this[PRIVATE.LISTENERS].set(event, []);
    }
    this[PRIVATE.LISTENERS].get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this[PRIVATE.LISTENERS].has(event)) {
      const listeners = this[PRIVATE.LISTENERS].get(event);
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      if (listeners.length === 0) {
        this[PRIVATE.LISTENERS].delete(event);
      }
    }
  }

  emit(event, data) {
    if (this[PRIVATE.LISTENERS].has(event)) {
      const listeners = this[PRIVATE.LISTENERS].get(event);
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          // Игнорируем ошибки в слушателях
        }
      }
    }
  }

  // ============================================================
  // УНИЧТОЖЕНИЕ
  // ============================================================

  destroy() {
    const logger = this[PRIVATE.LOGGER];

    for (const [key, timer] of this[PRIVATE.TIMERS]) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    this[PRIVATE.TIMERS].clear();

    this[PRIVATE.LISTENERS].clear();
    this[PRIVATE.CACHE].clear();

    if (this[PRIVATE.GENERATOR]) {
      this[PRIVATE.GENERATOR].reset();
    }

    if (typeof self !== 'undefined') {
      delete self[PUBLIC.API];
      delete self[PUBLIC.STATE];
      delete self[PUBLIC.CONFIG];
      delete self[PUBLIC.LOGGER];
      delete self[PUBLIC.GENERATOR];
      delete self[PUBLIC.UPDATER];
      delete self[PUBLIC.REFRESHER];
      delete self[PUBLIC.INSTANCE];
      delete self[PUBLIC.EVENTS];
      delete self.__backgroundSymbols;
    }

    this[PRIVATE.STATE].isDestroyed = true;
    this[PRIVATE.STATE].initialized = false;

    logger.success('✅ Background Service уничтожен');
  }
}

// ============================================================
// 7. СОЗДАНИЕ ЭКЗЕМПЛЯРА
// ============================================================

let backgroundInstance = null;

function getBackgroundInstance(options = {}) {
  if (!backgroundInstance) {
    backgroundInstance = new BackgroundService(options);
    if (typeof self !== 'undefined') {
      self.__backgroundInstance = backgroundInstance;
    }
  }
  return backgroundInstance;
}

// ============================================================
// 8. ЗАПУСК
// ============================================================

try {
  const instance = getBackgroundInstance({
    debug: true,
    version: '2.0.0',
    build: '2026-07-18',
  });

  const logger = instance[PRIVATE.LOGGER] || createLogger();

  console.log('✅ Background Service запущен');
  console.log(`📦 Версия: ${instance[PRIVATE.VERSION]}`);
  console.log('─'.repeat(70));
  console.log('📋 ДОСТУПНЫЕ КОМАНДЫ:');
  console.log('  __backgroundInstance.getState()    - состояние');
  console.log('  __backgroundInstance.updateAll()   - принудительное обновление');
  console.log('  __backgroundInstance.refresh()     - автообновление');
  console.log('  __backgroundInstance.openPopup()   - открыть окно');
  console.log('  __backgroundInstance.getGenerator() - получить генератор');
  console.log('  __backgroundInstance.on(event, cb) - подписка');
  console.log('  __backgroundInstance.emit(event)   - событие');
  console.log('  __backgroundInstance.destroy()     - уничтожить');
  console.log('─'.repeat(70));
  console.log('🔑 ПУБЛИЧНЫЕ СИМВОЛЫ (Symbol.for):');
  Object.keys(PUBLIC).forEach(key => {
    console.log(`  ${String(PUBLIC[key])}`);
  });
  console.log('─'.repeat(70));
  console.log('🔒 ПРИВАТНЫЕ СИМВОЛЫ:');
  Object.keys(PRIVATE).forEach(key => {
    console.log(`  ${String(PRIVATE[key])}`);
  });
  console.log('─'.repeat(70));
  console.log('✅ Готов к работе!');
} catch (error) {
  console.error('❌ Ошибка запуска:', error);
  console.error('Stack:', error.stack);
}

// ============================================================
// 9. ЭКСПОРТ
// ============================================================

export default BackgroundService;
export { BackgroundService, BookmarkletGenerator, getBackgroundInstance, PRIVATE, PUBLIC };
