// Bookmarklet/extension/background.js
// ============================================================
// Service Worker для Bookmarklet Bridge (ES-модуль)
// Генератор букмарклетов встроен прямо в код
// ============================================================

// ============================================================
// 1. ВСТРОЕННЫЙ ГЕНЕРАТОР БУКМАРКЛЕТОВ
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
};

class BookmarkletGenerator {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this._cache = new Map();
    this._bookmarklets = [];
    this._results = null;
    this._initialized = false;
  }

  generateCode(bookmarkData, options = {}) {
    const title = bookmarkData?.title || options.title || 'Bookmarklet';
    const type = options.type || 'main';
    const id = options.id || `bm-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`;
    const version = options.version || this.config.version;
    const debug = options.debug !== false;

    const fileMap = {
      env: this.config.files.env,
      logs: this.config.files.logs,
      debug: this.config.files.debug,
      main: this.config.files.main,
      manager: this.config.files.manager,
      widget: this.config.files.widget,
    };
    const file = fileMap[type] || this.config.files.main;
    const fullPath = this.config.basePath + file;

    return `javascript:(()=>{(function(){"use strict";

const CONFIG = {
  debug: ${debug},
  timeout: ${this.config.timeout},
  source: "${this.config.source}",
  extensionSource: "${this.config.extensionSource}",
  responseType: "${this.config.responseType}",
  version: "${version}",
  title: "${title}",
  type: "${type}",
  id: "${id}",
};

console.log('CONFIG:', CONFIG);
const logger = {
  log: function(level, message, data) {
    if (!CONFIG.debug && level !== "error") return;
    const prefix = "[Bookmarklet]";
    switch(level) {
      case "error": console.error(\`\${prefix} ❌ \${message}\`, data || ""); break;
      case "warn":  console.warn(\`\${prefix} ⚠️ \${message}\`, data || ""); break;
      case "debug": console.log(\`\${prefix} 🔍 \${message}\`, data || ""); break;
      default:      console.log(\`\${prefix} ℹ️ \${message}\`, data || "");
    }
  },
  error: function(msg, d) { this.log("error", msg, d); },
  warn: function(msg, d) { this.log("warn", msg, d); },
  info: function(msg, d) { this.log("info", msg, d); },
  debug: function(msg, d) { this.log("debug", msg, d); }
};

function getBookmarkData() {
  return new Promise((resolve, reject) => {
    logger.info("Запрос данных от расширения...");

    function handleResponse(event) {
      if (event.data &&
          event.data.source === CONFIG.extensionSource &&
          event.data.type === CONFIG.responseType) {
        const bookmark = event.data.payload;
        logger.info("Получены данные:", bookmark);
        window.removeEventListener("message", handleResponse);
        clearTimeout(timeoutId);
        resolve(bookmark);
      }
    }

    window.addEventListener("message", handleResponse);

    const timeoutId = setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      logger.warn("Таймаут ожидания ответа от расширения");
      reject(new Error("Таймаут: расширение не ответило"));
    }, CONFIG.timeout);

    window.postMessage({
      source: CONFIG.source,
      type: "REQUEST_BOOKMARK_DATA",
      currentUrl: window.location.href,
      tabId: window.__tabId || null,
      bookmarkletId: CONFIG.id,
      bookmarkletName: CONFIG.title,
      bookmarkletType: CONFIG.type,
    }, "*");

    logger.debug("Запрос отправлен");
  });
}

async function main() {
  console.log("═".repeat(60));
  console.log(\`📦 БУКМАРКЛЕТ \${CONFIG.version}\`);
  console.log(\`📌 ${title}\`);
  console.log("═".repeat(60));

  try {
    const bookmark = await getBookmarkData();

    console.log("═══════════════════════════════════════════════════════════");
    console.log(\`📌 ЗАКЛАДКА: \${bookmark.title}\`);
    console.log(\`📌 ТИП: \${bookmark.type || "unknown"}\`);
    console.log(\`📌 ID: \${bookmark.id || "нет"}\`);
    console.log(\`📌 ВЕРСИЯ: \${bookmark.version || "1.0.0"}\`);
    console.log(\`📌 РОДИТЕЛЬ: \${bookmark.parent?.title || "корень"}\`);
    console.log(\`📌 СОСЕДЕЙ: \${bookmark.siblings?.length || 0}\`);
    console.log("═══════════════════════════════════════════════════════════");

    if (bookmark.customConfig && Object.keys(bookmark.customConfig).length > 0) {
      console.log("🔧 КАСТОМНЫЕ НАСТРОЙКИ:");
      console.table(bookmark.customConfig);
    }

    if (bookmark.features && bookmark.features.length > 0) {
      console.log(\`✨ ДОСТУПНЫЕ ФУНКЦИИ: \${bookmark.features.join(", ")}\`);
    }

    window.__bookmarkData = bookmark;

    (function(...args) {
      console.log("INIT_THIS", args);

      function detectName() {
        const scripts = document.querySelectorAll("script[data-bookmarklet-name]");
        for (const s of scripts) {
          if (s.dataset.bookmarkletName) return s.dataset.bookmarkletName;
        }
        const nameParam = new URLSearchParams(window.location.search).get("name");
        if (nameParam) return decodeURIComponent(nameParam);
        const stored = localStorage.getItem("bookmarklet-name");
        if (stored) return stored;
        const title = document.title || "";
        if (title.includes("ENV") || title.includes("env")) return "ENV Control";
        if (title.includes("Logs") || title.includes("logs")) return "Logs Control";
        if (title.includes("Debug") || title.includes("debug")) return "Debug Control";
        if (title.includes("Manager") || title.includes("manager")) return "Manager";
        if (title.includes("Widget") || title.includes("widget")) return "Widget";
        return "Bookmarklet";
      }

      function detectType() {
        const scripts = document.querySelectorAll('script[src*="bookmarklet"]');
        for (const s of scripts) {
          const src = s.src || "";
          if (src.includes("logs-panel")) return "logs";
          if (src.includes("debug-panel")) return "debug";
          if (src.includes("env-panel")) return "env";
          if (src.includes("bookmarklet.js")) return "main";
        }
        return "main";
      }

      const name = detectName();
      const type = detectType();
      console.log("----------------------++++++++++++++++++++", name, type);
      const id = "bm-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
      localStorage.setItem("bookmarklet-name", name);

      const files = {
        env: "${fullPath}",
        logs: "${fullPath.replace('env-panel.js', 'logs-panel.js')}",
        debug: "${fullPath.replace('env-panel.js', 'debug-panel.js')}",
        main: "${fullPath.replace('src/env-panel.js', 'bookmarklet.js')}",
      };
      const file = files[type] || files.main;
      const script = document.createElement("script");
      script.type = "module";
      script.src = file + "?name=" + encodeURIComponent(name) + "&id=" + id;
      script.dataset.bookmarkletName = name;
      script.dataset.bookmarkletId = id;
      script.dataset.bookmarkletType = type;
      document.head.appendChild(script);
      window.__bookmarkletInfo = { name, id, type, timestamp: Date.now() };
      console.log('📌 [' + id + '] "' + name + '" (' + type + ")");
    })();

    console.log("═".repeat(60));
    console.log("✅ Готово! Данные доступны в window.__bookmarkData");

  } catch (error) {
    logger.error("Ошибка:", error.message);
    console.log("⚠️ Используем fallback (без расширения)...");

    (function(...args) {
      console.log("INIT_THIS", args);

      function detectName() {
        const scripts = document.querySelectorAll("script[data-bookmarklet-name]");
        for (const s of scripts) {
          if (s.dataset.bookmarkletName) return s.dataset.bookmarkletName;
        }
        const nameParam = new URLSearchParams(window.location.search).get("name");
        if (nameParam) return decodeURIComponent(nameParam);
        const stored = localStorage.getItem("bookmarklet-name");
        if (stored) return stored;
        const title = document.title || "";
        if (title.includes("ENV") || title.includes("env")) return "ENV Control";
        if (title.includes("Logs") || title.includes("logs")) return "Logs Control";
        if (title.includes("Debug") || title.includes("debug")) return "Debug Control";
        if (title.includes("Manager") || title.includes("manager")) return "Manager";
        if (title.includes("Widget") || title.includes("widget")) return "Widget";
        return "Bookmarklet";
      }

      function detectType() {
        const scripts = document.querySelectorAll('script[src*="bookmarklet"]');
        for (const s of scripts) {
          const src = s.src || "";
          if (src.includes("logs-panel")) return "logs";
          if (src.includes("debug-panel")) return "debug";
          if (src.includes("env-panel")) return "env";
          if (src.includes("bookmarklet.js")) return "main";
        }
        return "main";
      }

      const name = detectName();
      const type = detectType();
      console.log("----------------------++++++++++++++++++++", name, type);
      const id = "bm-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4);
      localStorage.setItem("bookmarklet-name", name);

      const files = {
        env: "${fullPath}",
        logs: "${fullPath.replace('env-panel.js', 'logs-panel.js')}",
        debug: "${fullPath.replace('env-panel.js', 'debug-panel.js')}",
        main: "${fullPath.replace('src/env-panel.js', 'bookmarklet.js')}",
      };
      const file = files[type] || files.main;
      const script = document.createElement("script");
      script.type = "module";
      script.src = file + "?name=" + encodeURIComponent(name) + "&id=" + id;
      script.dataset.bookmarkletName = name;
      script.dataset.bookmarkletId = id;
      script.dataset.bookmarkletType = type;
      document.head.appendChild(script);
      window.__bookmarkletInfo = { name, id, type, timestamp: Date.now() };
      console.log('📌 [' + id + '] "' + name + '" (' + type + ")");
    })();
  }
}

main();

})();})();`;
  }

  updateBookmark(bookmarkId, newCode) {
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

  async updateAll(bookmarklets, options = {}) {
    const results = {
      total: bookmarklets.length,
      updated: 0,
      failed: 0,
      errors: [],
      details: [],
    };

    if (bookmarklets.length === 0) {return results;}

    for (const bm of bookmarklets) {
      if (!bm.url || !bm.url.startsWith('javascript:')) {
        continue;
      }

      const type = bm.type || options.type || 'main';
      const newCode = this.generateCode(
        { id: bm.id, title: bm.title, type: bm.type },
        { type, ...options },
      );

      try {
        const result = await this.updateBookmark(bm.id, newCode);
        results.updated++;
        results.details.push({ id: bm.id, title: bm.title, success: true, result });
      } catch (error) {
        results.failed++;
        results.errors.push({ id: bm.id, title: bm.title, error: error.message });
      }
    }

    return results;
  }

  getList() {
    return new Promise(resolve => {
      chrome.bookmarks.getTree(tree => {
        const bookmarklets = [];
        function traverse(nodes) {
          for (const node of nodes) {
            if (node.url && node.url.startsWith('javascript:')) {
              bookmarklets.push({
                id: node.id,
                title: node.title || 'Без названия',
                url: node.url,
                isBookmarklet: true,
                type: 'bookmarklet',
                parentId: node.parentId,
              });
            }
            if (node.children) {
              traverse(node.children);
            }
          }
        }
        traverse(tree);
        resolve(bookmarklets);
      });
    });
  }

  async refresh() {
    const bookmarklets = await this.getList();
    this._bookmarklets = bookmarklets;
    const results = await this.updateAll(bookmarklets);
    this._results = results;
    return results;
  }

  getState() {
    return {
      initialized: true,
      bookmarklets: this._bookmarklets,
      results: this._results,
      lastUpdate: new Date().toISOString(),
    };
  }

  getConfig() {
    return { ...this.config };
  }

  getResults() {
    return this._results ? { ...this._results } : null;
  }

  getBookmarklets() {
    return [...this._bookmarklets];
  }

  clearCache() {
    this._cache.clear();
    return this;
  }

  reset() {
    this._bookmarklets = [];
    this._results = null;
    this._cache.clear();
    return this;
  }
}

// ============================================================
// 2. ПРИВАТНЫЕ СИМВОЛЫ
// ============================================================

const PRIVATE = {
  CONFIG: Symbol('background.config'),
  LOGGER: Symbol('background.logger'),
  STATE: Symbol('background.state'),
  CACHE: Symbol('background.cache'),
  GENERATOR: Symbol('background.generator'),
  GENERATOR_LOADED: Symbol('background.generatorLoaded'),
  BOOKMARKS: Symbol('background.bookmarks'),
  BOOKMARKLETS: Symbol('background.bookmarklets'),
  FOLDERS: Symbol('background.folders'),
  TABS: Symbol('background.tabs'),
  TAB_MAP: Symbol('background.tabMap'),
  BOOKMARK_MAP: Symbol('background.bookmarkMap'),
  ACTIVE_BOOKMARKLETS: Symbol('background.activeBookmarklets'),
  INSTANCE_SYMBOLS: Symbol('background.instanceSymbols'),
  EXTENSION_WINDOW: Symbol('background.extensionWindow'),
  ACTIVE_TAB: Symbol('background.activeTab'),
  INITIALIZED: Symbol('background.initialized'),
  LAST_UPDATE: Symbol('background.lastUpdate'),
  UPDATE_RESULTS: Symbol('background.updateResults'),
};

// ============================================================
// 3. КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  cacheTTL: 60000,
  maxRequestLog: 100,
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
  autoUpdateEnabled: true,
  version: '2.0.0',
  debug: true,
};

// ============================================================
// 4. ЛОГГЕР
// ============================================================

const LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  instance: 'color: #667eea; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #dfe6e9;',
};

function createLogger() {
  const logger = {
    _log(level, message, data = null, style = 'info') {
      const timestamp = new Date().toISOString().slice(11, 23);
      const prefix = `%c[${timestamp}] %c[Bookmarklet Bridge]`;
      const styles = [LOG_STYLES.info, LOG_STYLES.instance];
      const colorStyle = LOG_STYLES[style] || LOG_STYLES.info;

      if (data !== null && data !== undefined) {
        console.log(prefix + ' %c' + message, ...styles, colorStyle, data);
      } else {
        console.log(prefix + ' %c' + message, ...styles, colorStyle);
      }
    },
    error(msg, d) {
      this._log('error', `❌ ${msg}`, d, 'error');
    },
    warn(msg, d) {
      this._log('warn', `⚠️ ${msg}`, d, 'warn');
    },
    info(msg, d) {
      this._log('info', `ℹ️ ${msg}`, d, 'info');
    },
    debug(msg, d) {
      this._log('debug', `🔍 ${msg}`, d, 'debug');
    },
    verbose(msg, d) {
      this._log('verbose', `📝 ${msg}`, d, 'verbose');
    },

    header(title) {
      console.log('%c' + '═'.repeat(70), LOG_STYLES.separator);
      console.log('%c  📦 ' + title, LOG_STYLES.header);
      console.log('%c' + '═'.repeat(70), LOG_STYLES.separator);
    },

    separator() {
      console.log('%c' + '─'.repeat(70), LOG_STYLES.separator);
    },

    table(data) {
      console.table(data);
    },
  };
  return logger;
}

// ============================================================
// 5. ОСНОВНОЙ КЛАСС
// ============================================================

class BackgroundService {
  constructor(options = {}) {
    this[PRIVATE.CONFIG] = { ...CONFIG, ...options };
    this[PRIVATE.LOGGER] = createLogger();
    this[PRIVATE.STATE] = { initialized: false, lastUpdate: null };
    this[PRIVATE.CACHE] = new Map();
    this[PRIVATE.GENERATOR] = null;
    this[PRIVATE.GENERATOR_LOADED] = false;
    this[PRIVATE.BOOKMARKS] = [];
    this[PRIVATE.BOOKMARKLETS] = [];
    this[PRIVATE.FOLDERS] = [];
    this[PRIVATE.TABS] = new Map();
    this[PRIVATE.TAB_MAP] = new Map();
    this[PRIVATE.BOOKMARK_MAP] = new Map();
    this[PRIVATE.ACTIVE_BOOKMARKLETS] = new Map();
    this[PRIVATE.INSTANCE_SYMBOLS] = new Map();
    this[PRIVATE.EXTENSION_WINDOW] = null;
    this[PRIVATE.ACTIVE_TAB] = null;
    this[PRIVATE.INITIALIZED] = false;
    this[PRIVATE.LAST_UPDATE] = null;
    this[PRIVATE.UPDATE_RESULTS] = null;

    const logger = this[PRIVATE.LOGGER];
    logger.header('ИНИЦИАЛИЗАЦИЯ BACKGROUND SERVICE');
    logger.info('🔄 Создание экземпляра BackgroundService...');

    this._loadGenerator();
    this._init();
  }

  // ============================================================
  // 6. ЗАГРУЗКА ГЕНЕРАТОРА (встроенный)
  // ============================================================

  _loadGenerator() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('📦 Загрузка встроенного генератора букмарклетов...');

    try {
      this[PRIVATE.GENERATOR] = new BookmarkletGenerator({
        debug: this[PRIVATE.CONFIG].debug,
        version: this[PRIVATE.CONFIG].version,
      });
      this[PRIVATE.GENERATOR_LOADED] = true;
      logger.info('✅ Встроенный генератор успешно создан');
      logger.info(`📌 Версия: ${this[PRIVATE.CONFIG].version}`);

      if (this[PRIVATE.CONFIG].autoUpdateEnabled) {
        setTimeout(() => {
          this._autoUpdate().catch(err => {
            logger.warn('⚠️ Автообновление не выполнено:', err.message);
          });
        }, 2000);
      }

      return this[PRIVATE.GENERATOR];
    } catch (error) {
      logger.error('❌ Ошибка создания генератора:', error.message);
      this[PRIVATE.GENERATOR] = null;
      this[PRIVATE.GENERATOR_LOADED] = false;
      return null;
    }
  }

  // ============================================================
  // 7. АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ
  // ============================================================

  async _autoUpdate() {
    const logger = this[PRIVATE.LOGGER];
    const generator = this[PRIVATE.GENERATOR];

    if (!generator || !this[PRIVATE.GENERATOR_LOADED]) {
      logger.warn('⚠️ Генератор не загружен, автообновление пропущено');
      return;
    }

    try {
      const bookmarklets = await generator.getList();
      if (bookmarklets.length === 0) {
        logger.info('ℹ️ Нет букмарклетов для обновления');
        return;
      }

      logger.info(`🔄 Автообновление ${bookmarklets.length} букмарклетов...`);
      const results = await generator.updateAll(bookmarklets, {
        debug: this[PRIVATE.CONFIG].debug,
        version: this[PRIVATE.CONFIG].version,
      });

      this[PRIVATE.LAST_UPDATE] = new Date().toISOString();
      this[PRIVATE.UPDATE_RESULTS] = results;

      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('📊 РЕЗУЛЬТАТЫ АВТООБНОВЛЕНИЯ');
      logger.info(`   📦 Всего: ${results.total}`);
      logger.info(`   ✅ Обновлено: ${results.updated}`);
      logger.info(`   ❌ Ошибок: ${results.failed}`);
      logger.info('═══════════════════════════════════════════════════════════');
    } catch (error) {
      logger.error('❌ Ошибка автообновления:', error.message);
    }
  }

  // ============================================================
  // 8. ИНИЦИАЛИЗАЦИЯ
  // ============================================================

  _init() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔧 Инициализация компонентов...');

    this._setupListeners();
    this._loadBookmarks();
    this._exportAPI();

    this[PRIVATE.INITIALIZED] = true;
    this[PRIVATE.STATE].initialized = true;
    logger.info('✅ Background Service инициализирован');
  }

  // ============================================================
  // 9. НАСТРОЙКА СЛУШАТЕЛЕЙ
  // ============================================================

  _setupListeners() {
    const logger = this[PRIVATE.LOGGER];

    chrome.tabs.onActivated.addListener(activeInfo => {
      this[PRIVATE.ACTIVE_TAB] = activeInfo.tabId;
      chrome.tabs.get(activeInfo.tabId, tab => {
        if (!chrome.runtime.lastError && tab) {
          this._findTab(tab);
        }
      });
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url || changeInfo.title) {
        this._findTab(tab);
      }
    });

    chrome.tabs.onRemoved.addListener(tabId => {
      if (this[PRIVATE.TAB_MAP].has(tabId)) {
        this[PRIVATE.TAB_MAP].delete(tabId);
        this[PRIVATE.BOOKMARK_MAP].delete(tabId);
        this[PRIVATE.ACTIVE_BOOKMARKLETS].delete(tabId);
        this._removeInstanceSymbols(tabId);
      }
    });

    chrome.action.onClicked.addListener(tab => {
      const activeBookmarklet = this[PRIVATE.ACTIVE_BOOKMARKLETS].get(tab.id);
      const symbolsData = this._getInstanceSymbols(tab.id);
      this._openWindow(activeBookmarklet, symbolsData);
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => this._handleMessage(request, sender, sendResponse));

    logger.info('✅ Слушатели Chrome API настроены');
  }

  // ============================================================
  // 10. РАБОТА С ЗАКЛАДКАМИ
  // ============================================================

  _loadBookmarks() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('📑 Загрузка всех закладок...');

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

      this[PRIVATE.BOOKMARKS] = allBookmarks;
      this[PRIVATE.BOOKMARKLETS] = bookmarklets;
      this[PRIVATE.FOLDERS] = folders;

      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('📊 СТАТИСТИКА ЗАКЛАДОК');
      logger.info(`   📑 Всего закладок: ${allBookmarks.length}`);
      logger.info(`   📌 Букмарклетов: ${bookmarklets.length}`);
      logger.info(`   📁 Папок: ${folders.length}`);
      logger.info('═══════════════════════════════════════════════════════════');

      if (bookmarklets.length > 0) {
        logger.info('📋 ОБНОВЛЕННЫЙ СПИСОК БУКМАРКЛЕТОВ:');
        const tableData = bookmarklets.map(bm => ({
          id: bm.id,
          title: bm.title,
          path: bm.path,
          type: bm.type,
        }));
        logger.table(tableData);
      }
    });
  }

  // ============================================================
  // 11. РАБОТА С ВКЛАДКАМИ
  // ============================================================

  _findTab(tab) {
    const logger = this[PRIVATE.LOGGER];
    const tabId = tab.id;
    const url = tab.url;

    if (!url || this._isIgnoredUrl(url)) {
      return Promise.resolve(null);
    }

    return new Promise(resolve => {
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
          tabId,
          isBookmarklet: bookmark.url && bookmark.url.startsWith('javascript:'),
          type: bookmark.url && bookmark.url.startsWith('javascript:') ? 'bookmarklet' : 'url',
          matchedBy: 'url',
          timestamp: Date.now(),
        };

        this[PRIVATE.TAB_MAP].set(tabId, result.id);
        this[PRIVATE.BOOKMARK_MAP].set(tabId, result);
        this[PRIVATE.TABS].set(tabId, tab);

        logger.info(`✅ Связь: вкладка ${tabId} → "${result.title}"`);
        resolve(result);
      });
    });
  }

  // ============================================================
  // 12. ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  _isIgnoredUrl(url) {
    if (!url) {return true;}
    for (const prefix of this[PRIVATE.CONFIG].ignoredUrls) {
      if (url.startsWith(prefix)) {return true;}
    }
    return false;
  }

  // ============================================================
  // 13. РАБОТА С ОКНОМ
  // ============================================================

  _openWindow(bookmarkletData = null, symbolsData = null) {
    const logger = this[PRIVATE.LOGGER];
    logger.info('📂 Открытие окна расширения...');

    if (this[PRIVATE.EXTENSION_WINDOW]) {
      chrome.windows.get(this[PRIVATE.EXTENSION_WINDOW], window => {
        if (!chrome.runtime.lastError && window) {
          chrome.windows.update(window.id, { focused: true });
          return;
        }
        this[PRIVATE.EXTENSION_WINDOW] = null;
        this._createNewWindow(bookmarkletData, symbolsData);
      });
      return;
    }

    this._createNewWindow(bookmarkletData, symbolsData);
  }

  _createNewWindow(bookmarkletData = null, symbolsData = null) {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🆕 Создание нового окна...');

    chrome.system.display.getInfo(displays => {
      let screenWidth = 1920;
      let screenHeight = 1080;

      if (displays && displays.length > 0) {
        const primary = displays[0];
        screenWidth = primary.workArea.width || primary.bounds.width || 1920;
        screenHeight = primary.workArea.height || primary.bounds.height || 1080;
      }

      const left =
        screenWidth - this[PRIVATE.CONFIG].windowWidth - this[PRIVATE.CONFIG].windowOffset;
      const top = this[PRIVATE.CONFIG].windowOffset + 40;

      let popupUrl = chrome.runtime.getURL('popup.html');
      const params = [];

      if (bookmarkletData) {
        params.push(`bookmarkletId=${bookmarkletData.id}`);
        params.push(`bookmarkletName=${encodeURIComponent(bookmarkletData.name)}`);
        params.push(`bookmarkletType=${bookmarkletData.type || 'unknown'}`);
      }

      if (params.length > 0) {
        popupUrl += '?' + params.join('&');
      }

      chrome.windows.create(
        {
          url: popupUrl,
          type: 'popup',
          width: this[PRIVATE.CONFIG].windowWidth,
          height: this[PRIVATE.CONFIG].windowHeight,
          left: Math.max(0, left),
          top: Math.max(0, top),
          focused: true,
        },
        window => {
          if (window) {
            this[PRIVATE.EXTENSION_WINDOW] = window.id;
            logger.info(`✅ Окно расширения создано (ID: ${window.id})`);
          }
        },
      );
    });
  }

  // ============================================================
  // 14. РАБОТА С СИМВОЛАМИ
  // ============================================================

  _getOrCreateInstanceSymbols(tabId, options = {}) {
    const logger = this[PRIVATE.LOGGER];

    try {
      if (this[PRIVATE.INSTANCE_SYMBOLS].has(tabId)) {
        return this[PRIVATE.INSTANCE_SYMBOLS].get(tabId);
      }

      const instanceId = `bm.${Date.now().toString(36)}.${Math.random().toString(36).substring(2, 8)}`;

      const symbols = {
        instanceId,
        tabId,
        created: Date.now(),
        options,
        symbols: {
          INSTANCE: Symbol.for(`bookmarklet.${instanceId}.instance`),
          STATE: Symbol.for(`bookmarklet.${instanceId}.state`),
          CONFIG: Symbol.for(`bookmarklet.${instanceId}.config`),
          STORAGE: Symbol.for(`bookmarklet.${instanceId}.storage`),
          API: Symbol.for(`bookmarklet.${instanceId}.api`),
        },
      };

      this[PRIVATE.INSTANCE_SYMBOLS].set(tabId, symbols);
      logger.debug(`✅ Созданы символы для вкладки ${tabId}`);
      return symbols;
    } catch (error) {
      logger.error(`❌ Ошибка создания символов: ${error.message}`, error);
      return null;
    }
  }

  _getInstanceSymbols(tabId) {
    try {
      return this[PRIVATE.INSTANCE_SYMBOLS].get(tabId) || null;
    } catch (error) {
      return null;
    }
  }

  _removeInstanceSymbols(tabId) {
    try {
      if (this[PRIVATE.INSTANCE_SYMBOLS].has(tabId)) {
        this[PRIVATE.INSTANCE_SYMBOLS].delete(tabId);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // ============================================================
  // 15. ЭКСПОРТ API
  // ============================================================

  _exportAPI() {
    const logger = this[PRIVATE.LOGGER];

    if (typeof self !== 'undefined') {
      self.__backgroundAPI = {
        getState: () => ({
          initialized: this[PRIVATE.INITIALIZED],
          generatorLoaded: this[PRIVATE.GENERATOR_LOADED],
          lastUpdate: this[PRIVATE.LAST_UPDATE],
          bookmarksCount: this[PRIVATE.BOOKMARKS].length,
          bookmarkletsCount: this[PRIVATE.BOOKMARKLETS].length,
          tabsCount: this[PRIVATE.TABS].size,
          activeBookmarkletsCount: this[PRIVATE.ACTIVE_BOOKMARKLETS].size,
          instanceSymbolsCount: this[PRIVATE.INSTANCE_SYMBOLS].size,
          updateResults: this[PRIVATE.UPDATE_RESULTS],
        }),
        getBookmarklets: () => this[PRIVATE.BOOKMARKLETS],
        getGenerator: () => this[PRIVATE.GENERATOR],
        isGeneratorLoaded: () => this[PRIVATE.GENERATOR_LOADED],
        refresh: async () => {
          if (this[PRIVATE.GENERATOR_LOADED] && this[PRIVATE.GENERATOR]) {
            return this[PRIVATE.GENERATOR].refresh();
          }
          logger.warn('⚠️ Генератор не загружен');
          return null;
        },
        updateAll: async () => {
          if (this[PRIVATE.GENERATOR_LOADED] && this[PRIVATE.GENERATOR]) {
            const bookmarklets = await this[PRIVATE.GENERATOR].getList();
            return this[PRIVATE.GENERATOR].updateAll(bookmarklets);
          }
          logger.warn('⚠️ Генератор не загружен');
          return null;
        },
        reloadGenerator: () => {
          logger.info('🔄 Перезагрузка генератора...');
          this[PRIVATE.GENERATOR_LOADED] = false;
          this[PRIVATE.GENERATOR] = null;
          return this._loadGenerator();
        },
        getSymbols: () => ({ PRIVATE, PUBLIC: {} }),
        getConfig: () => this[PRIVATE.CONFIG],
        clearCache: () => this[PRIVATE.CACHE].clear(),
      };

      logger.info('✅ API экспортирован');
      logger.info('📋 Доступные команды:');
      logger.info('  __backgroundAPI.getState() - состояние');
      logger.info('  __backgroundAPI.getBookmarklets() - букмарклеты');
      logger.info('  __backgroundAPI.getGenerator() - генератор');
      logger.info('  __backgroundAPI.isGeneratorLoaded() - статус генератора');
      logger.info('  __backgroundAPI.refresh() - обновить всё');
      logger.info('  __backgroundAPI.updateAll() - обновить букмарклеты');
      logger.info('  __backgroundAPI.reloadGenerator() - перезагрузить генератор');
    }
  }

  // ============================================================
  // 16. ОБРАБОТКА СООБЩЕНИЙ
  // ============================================================

  _handleMessage(request, sender, sendResponse) {
    const logger = this[PRIVATE.LOGGER];
    const generator = this[PRIVATE.GENERATOR];

    if (request.action === 'get_tab_id') {
      sendResponse({ tabId: sender.tab?.id || null });
      return true;
    }

    if (request.action === 'ping') {
      sendResponse({
        status: 'ok',
        timestamp: Date.now(),
        generatorLoaded: this[PRIVATE.GENERATOR_LOADED],
      });
      return true;
    }

    if (request.action === 'get_all_bookmarks') {
      sendResponse({
        success: true,
        data: {
          all: this[PRIVATE.BOOKMARKS],
          bookmarklets: this[PRIVATE.BOOKMARKLETS],
          folders: this[PRIVATE.FOLDERS],
          timestamp: Date.now(),
        },
      });
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

    if (request.action === 'refresh_bookmarklets') {
      if (!this[PRIVATE.GENERATOR_LOADED] || !generator) {
        sendResponse({ success: false, error: 'Генератор не загружен' });
        return true;
      }

      generator
        .refresh()
        .then(results => {
          this[PRIVATE.UPDATE_RESULTS] = results;
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
        config: this[PRIVATE.CONFIG],
      });
      return true;
    }

    return false;
  }
}

// ============================================================
// 17. СОЗДАНИЕ ЭКЗЕМПЛЯРА И ЭКСПОРТ
// ============================================================

const background = new BackgroundService();

export default BackgroundService;
export { BackgroundService, BookmarkletGenerator };
