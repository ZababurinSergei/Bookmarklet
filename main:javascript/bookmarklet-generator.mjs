// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/main:javascript/bookmarklet-generator.mjs

/**
 * ============================================================
 * МОДУЛЬ ГЕНЕРАЦИИ БУКМАРКЛЕТОВ (100% СИМВОЛЫ)
 * ============================================================
 *
 * Генерирует код букмарклета с подстановкой данных из расширения.
 * Автоматически обновляет URL закладок после получения списка.
 *
 * Версия: 2.0.0
 * Дата: 2026-07-18
 *
 * ============================================================
 */

// ============================================================
// 1. ПРИВАТНЫЕ СИМВОЛЫ
// ============================================================

const PRIVATE = {
  // Основные символы
  CONFIG: Symbol('bookmarklet-generator.config'),
  LOGGER: Symbol('bookmarklet-generator.logger'),
  STATE: Symbol('bookmarklet-generator.state'),
  CACHE: Symbol('bookmarklet-generator.cache'),

  // Функции
  GENERATE_CODE: Symbol('bookmarklet-generator.generateCode'),
  UPDATE_BOOKMARK: Symbol('bookmarklet-generator.updateBookmark'),
  UPDATE_ALL: Symbol('bookmarklet-generator.updateAll'),
  GET_LIST: Symbol('bookmarklet-generator.getList'),
  REFRESH: Symbol('bookmarklet-generator.refresh'),

  // Данные
  BOOKMARKLETS: Symbol('bookmarklet-generator.bookmarklets'),
  RESULTS: Symbol('bookmarklet-generator.results'),
  OPTIONS: Symbol('bookmarklet-generator.options'),

  // Внутренние
  INTERNAL: Symbol('bookmarklet-generator.internal'),
  INITIALIZED: Symbol('bookmarklet-generator.initialized'),
};

// ============================================================
// 2. ПУБЛИЧНЫЕ СИМВОЛЫ (доступны через Symbol.for)
// ============================================================

const PUBLIC = {
  API: Symbol.for('bookmarklet-generator.api'),
  GENERATOR: Symbol.for('bookmarklet-generator.generator'),
  UPDATER: Symbol.for('bookmarklet-generator.updater'),
  REFRESHER: Symbol.for('bookmarklet-generator.refresher'),
  CONFIG: Symbol.for('bookmarklet-generator.config'),
  LOGGER: Symbol.for('bookmarklet-generator.logger'),
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
};

// ============================================================
// 4. КЛАСС БУКМАРКЛЕТ ГЕНЕРАТОР
// ============================================================

class BookmarkletGenerator {
  constructor(options = {}) {
    // Инициализация приватных свойств
    this[PRIVATE.CONFIG] = { ...DEFAULT_CONFIG, ...options };
    this[PRIVATE.LOGGER] = this._createLogger();
    this[PRIVATE.STATE] = {
      initialized: false,
      bookmarklets: [],
      results: null,
      lastUpdate: null,
      errors: [],
    };
    this[PRIVATE.CACHE] = new Map();
    this[PRIVATE.BOOKMARKLETS] = [];
    this[PRIVATE.RESULTS] = null;
    this[PRIVATE.OPTIONS] = options;
    this[PRIVATE.INITIALIZED] = false;

    this[PRIVATE.LOGGER].info('📦 BookmarkletGenerator initialized', {
      version: DEFAULT_CONFIG.version,
      debug: this[PRIVATE.CONFIG].debug,
    });

    // Автоматическая инициализация
    this._init();
  }

  // ============================================================
  // 5. ПРИВАТНЫЕ МЕТОДЫ
  // ============================================================

  /**
   * Создает логгер
   */
  [PRIVATE.LOGGER]() {
    return this._createLogger();
  }

  _createLogger() {
    const config = this[PRIVATE.CONFIG];

    return {
      _log: (level, message, data) => {
        if (!config.debug && level !== 'error') return;
        const prefix = '[BookmarkletGenerator]';
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
      error: (msg, d) => this._log('error', msg, d),
      warn: (msg, d) => this._log('warn', msg, d),
      info: (msg, d) => this._log('info', msg, d),
      debug: (msg, d) => this._log('debug', msg, d),
    };
  }

  /**
   * Инициализация модуля
   */
  _init() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔄 Инициализация генератора букмарклетов...');

    // Проверяем доступность Chrome API
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      logger.info('✅ Chrome API доступно');

      // Автоматическое обновление при загрузке
      setTimeout(() => {
        this[PRIVATE.REFRESH]().catch(err => {
          logger.warn('Автоматическое обновление не выполнено:', err.message);
        });
      }, 500);
    } else {
      logger.warn('⚠️ Chrome API не доступно (работа в ограниченном режиме)');
    }

    this[PRIVATE.INITIALIZED] = true;
    this[PRIVATE.STATE].initialized = true;
  }

  /**
   * Генерирует код букмарклета (приватный метод)
   */
  [PRIVATE.GENERATE_CODE](bookmarkData, options = {}) {
    const logger = this[PRIVATE.LOGGER];
    const config = this[PRIVATE.CONFIG];

    logger.debug('Генерация кода букмарклета', {
      title: bookmarkData?.title,
      id: bookmarkData?.id,
      type: options?.type || 'main',
    });

    const title = bookmarkData?.title || options.title || 'Bookmarklet';
    const type = options.type || 'main';
    const id = options.id || `bm-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`;
    const version = options.version || config.version;
    const debug = options.debug !== false;

    // Определяем путь к файлу
    const fileMap = {
      env: config.files.env,
      logs: config.files.logs,
      debug: config.files.debug,
      main: config.files.main,
      manager: config.files.manager,
      widget: config.files.widget,
    };
    const file = fileMap[type] || config.files.main;
    const fullPath = config.basePath + file;

    // Генерируем полный код букмарклета
    const code = `javascript:(()=>{(function(){"use strict";

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

const CONFIG = {
  debug: ${debug},
  timeout: ${config.timeout},
  source: "${config.source}",
  extensionSource: "${config.extensionSource}",
  responseType: "${config.responseType}",
  version: "${version}",
  title: "${title}",
  type: "${type}",
  id: "${id}",
};

// ============================================================
// ЛОГГЕР
// ============================================================

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

// ============================================================
// ПОЛУЧЕНИЕ ДАННЫХ ОТ РАСШИРЕНИЯ
// ============================================================

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

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

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

    // ============================================================
    // ЗАГРУЗКА ПАНЕЛИ
    // ============================================================

    (function(...args) {
      console.log("INIT_THIS", args);

      function detectName() {
        const scripts = document.querySelectorAll("script[data-bookmarklet-name]");
        console.log("-------------------", scripts);
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

    // Fallback
    (function(...args) {
      console.log("INIT_THIS", args);

      function detectName() {
        const scripts = document.querySelectorAll("script[data-bookmarklet-name]");
        console.log("-------------------", scripts);
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

// ============================================================
// ЗАПУСК
// ============================================================

main();

})();})();`;

    logger.debug('Код сгенерирован', { length: code.length, type });
    return code;
  }

  /**
   * Обновляет один букмарклет (приватный метод)
   */
  [PRIVATE.UPDATE_BOOKMARK](bookmarkId, newCode) {
    return new Promise((resolve, reject) => {
      const logger = this[PRIVATE.LOGGER];

      if (!bookmarkId) {
        reject(new Error('bookmarkId is required'));
        return;
      }

      if (!newCode || !newCode.startsWith('javascript:')) {
        reject(new Error('newCode must start with "javascript:"'));
        return;
      }

      logger.info(`📝 Обновление букмарклета ${bookmarkId}...`);

      chrome.bookmarks.update(bookmarkId, { url: newCode }, result => {
        if (chrome.runtime.lastError) {
          logger.error('Ошибка обновления:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        logger.info(`✅ Букмарклет обновлен: ${result.title}`);
        resolve(result);
      });
    });
  }

  /**
   * Обновляет все букмарклеты (приватный метод)
   */
  [PRIVATE.UPDATE_ALL](bookmarklets, options = {}) {
    const logger = this[PRIVATE.LOGGER];
    const results = {
      total: bookmarklets.length,
      updated: 0,
      failed: 0,
      errors: [],
      details: [],
    };

    logger.info(`🔄 Обновление ${bookmarklets.length} букмарклетов...`);

    return new Promise(resolve => {
      let processed = 0;
      const total = bookmarklets.length;

      if (total === 0) {
        resolve(results);
        return;
      }

      for (const bm of bookmarklets) {
        // Проверяем, что это букмарклет
        if (!bm.url || !bm.url.startsWith('javascript:')) {
          logger.debug(`Пропускаем ${bm.title}: не букмарклет`);
          processed++;
          if (processed === total) resolve(results);
          continue;
        }

        // Генерируем новый код
        const type = bm.type || options.type || 'main';
        const newCode = this[PRIVATE.GENERATE_CODE](
          { id: bm.id, title: bm.title, type: bm.type },
          { type, ...options }
        );

        // Обновляем
        this[PRIVATE.UPDATE_BOOKMARK](bm.id, newCode)
          .then(result => {
            results.updated++;
            results.details.push({ id: bm.id, title: bm.title, success: true, result });
            logger.info(`✅ Обновлен: ${bm.title}`);
          })
          .catch(error => {
            results.failed++;
            results.errors.push({ id: bm.id, title: bm.title, error: error.message });
            logger.error(`❌ Ошибка обновления ${bm.title}:`, error.message);
          })
          .finally(() => {
            processed++;
            if (processed === total) {
              logger.info(`📊 Результат: ${results.updated} обновлено, ${results.failed} ошибок`);
              resolve(results);
            }
          });
      }
    });
  }

  /**
   * Получает список букмарклетов из расширения (приватный метод)
   */
  [PRIVATE.GET_LIST]() {
    return new Promise((resolve, reject) => {
      const logger = this[PRIVATE.LOGGER];

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
          const bookmarklets = response.data.bookmarklets || [];
          logger.info(`📦 Получено ${bookmarklets.length} букмарклетов из расширения`);

          // Выводим подробный список
          if (bookmarklets.length > 0) {
            logger.info('📋 ОБНОВЛЕННЫЙ СПИСОК БУКМАРКЛЕТОВ С TAB ID:');
            console.table(
              bookmarklets.map(bm => ({
                id: bm.id,
                title: bm.title,
                type: bm.type,
                path: bm.path,
                isBookmarklet: bm.isBookmarklet,
                tabId: bm.tabId || '—',
              }))
            );
          }

          resolve(bookmarklets);
        } else {
          reject(new Error('Invalid response from extension'));
        }
      });
    });
  }

  /**
   * Обновляет список букмарклетов и их URL (приватный метод)
   */
  [PRIVATE.REFRESH]() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔄 Обновление букмарклетов...');

    return this[PRIVATE.GET_LIST]()
      .then(bookmarklets => {
        this[PRIVATE.BOOKMARKLETS] = bookmarklets;
        return this[PRIVATE.UPDATE_ALL](bookmarklets, this[PRIVATE.OPTIONS]);
      })
      .then(results => {
        this[PRIVATE.RESULTS] = results;
        this[PRIVATE.STATE].lastUpdate = new Date().toISOString();
        logger.info(`✅ Обновление завершено: ${results.updated} обновлено`);
        return results;
      })
      .catch(error => {
        logger.error('❌ Ошибка обновления букмарклетов:', error.message);
        throw error;
      });
  }

  // ============================================================
  // 6. ПУБЛИЧНЫЕ МЕТОДЫ (доступны через API)
  // ============================================================

  /**
   * Генерирует код букмарклета
   */
  generateCode(bookmarkData, options = {}) {
    return this[PRIVATE.GENERATE_CODE](bookmarkData, options);
  }

  /**
   * Обновляет один букмарклет
   */
  updateBookmark(bookmarkId, newCode) {
    return this[PRIVATE.UPDATE_BOOKMARK](bookmarkId, newCode);
  }

  /**
   * Обновляет все букмарклеты
   */
  updateAll(bookmarklets, options = {}) {
    return this[PRIVATE.UPDATE_ALL](bookmarklets, options);
  }

  /**
   * Получает список букмарклетов из расширения
   */
  getList() {
    return this[PRIVATE.GET_LIST]();
  }

  /**
   * Обновляет список букмарклетов и их URL
   */
  refresh() {
    return this[PRIVATE.REFRESH]();
  }

  /**
   * Получает состояние
   */
  getState() {
    return { ...this[PRIVATE.STATE] };
  }

  /**
   * Получает конфигурацию
   */
  getConfig() {
    return { ...this[PRIVATE.CONFIG] };
  }

  /**
   * Получает результаты последнего обновления
   */
  getResults() {
    return this[PRIVATE.RESULTS] ? { ...this[PRIVATE.RESULTS] } : null;
  }

  /**
   * Получает список букмарклетов
   */
  getBookmarklets() {
    return [...this[PRIVATE.BOOKMARKLETS]];
  }

  /**
   * Очищает кеш
   */
  clearCache() {
    this[PRIVATE.CACHE].clear();
    const logger = this[PRIVATE.LOGGER];
    logger.info('🗑️ Кеш очищен');
    return this;
  }

  /**
   * Сбрасывает состояние
   */
  reset() {
    this[PRIVATE.STATE] = {
      initialized: true,
      bookmarklets: [],
      results: null,
      lastUpdate: null,
      errors: [],
    };
    this[PRIVATE.BOOKMARKLETS] = [];
    this[PRIVATE.RESULTS] = null;
    this[PRIVATE.CACHE].clear();
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔄 Состояние сброшено');
    return this;
  }

  /**
   * Экспортирует данные в JSON
   */
  export() {
    return JSON.stringify(
      {
        state: this[PRIVATE.STATE],
        bookmarklets: this[PRIVATE.BOOKMARKLETS],
        results: this[PRIVATE.RESULTS],
        config: this[PRIVATE.CONFIG],
        timestamp: new Date().toISOString(),
        version: DEFAULT_CONFIG.version,
      },
      null,
      2
    );
  }

  /**
   * Импортирует данные из JSON
   */
  import(json) {
    try {
      const data = JSON.parse(json);
      if (data.state) this[PRIVATE.STATE] = { ...data.state };
      if (data.bookmarklets) this[PRIVATE.BOOKMARKLETS] = [...data.bookmarklets];
      if (data.results) this[PRIVATE.RESULTS] = { ...data.results };
      const logger = this[PRIVATE.LOGGER];
      logger.info('📥 Данные импортированы');
      return this;
    } catch (error) {
      const logger = this[PRIVATE.LOGGER];
      logger.error('❌ Ошибка импорта:', error.message);
      throw error;
    }
  }

  // ============================================================
  // 7. СТАТИЧЕСКИЕ МЕТОДЫ
  // ============================================================

  /**
   * Создает экземпляр генератора
   */
  static create(options = {}) {
    return new BookmarkletGenerator(options);
  }

  /**
   * Получает или создает экземпляр
   */
  static getInstance(options = {}) {
    if (!BookmarkletGenerator._instance) {
      BookmarkletGenerator._instance = new BookmarkletGenerator(options);
    }
    return BookmarkletGenerator._instance;
  }

  /**
   * Очищает все экземпляры
   */
  static destroyInstance() {
    BookmarkletGenerator._instance = null;
    const logger = console;
    logger.info('🗑️ Экземпляр уничтожен');
  }
}

// ============================================================
// 8. СОЗДАНИЕ ГЛОБАЛЬНОГО ЭКЗЕМПЛЯРА
// ============================================================

let instance = null;

function getInstance(options = {}) {
  if (!instance) {
    instance = new BookmarkletGenerator(options);
  }
  return instance;
}

// ============================================================
// 9. ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ
// ============================================================

if (typeof window !== 'undefined') {
  // Создаем экземпляр
  const generator = getInstance({ debug: true });

  // Экспортируем через публичные символы
  window[PUBLIC.API] = generator;
  window[PUBLIC.GENERATOR] = generator.generateCode.bind(generator);
  window[PUBLIC.UPDATER] = generator.updateAll.bind(generator);
  window[PUBLIC.REFRESHER] = generator.refresh.bind(generator);
  window[PUBLIC.CONFIG] = generator.getConfig.bind(generator);
  window[PUBLIC.LOGGER] = generator[PRIVATE.LOGGER];

  // Экспортируем для прямого доступа
  window.__bookmarkletGenerator = generator;
  window.__bookmarkletGeneratorAPI = {
    generate: generator.generateCode.bind(generator),
    update: generator.updateBookmark.bind(generator),
    updateAll: generator.updateAll.bind(generator),
    refresh: generator.refresh.bind(generator),
    getList: generator.getList.bind(generator),
    getState: generator.getState.bind(generator),
    getConfig: generator.getConfig.bind(generator),
    getResults: generator.getResults.bind(generator),
    getBookmarklets: generator.getBookmarklets.bind(generator),
    clearCache: generator.clearCache.bind(generator),
    reset: generator.reset.bind(generator),
    export: generator.export.bind(generator),
    import: generator.import.bind(generator),
  };

  // Логируем доступные команды
  const logger = generator[PRIVATE.LOGGER];
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('📦 МОДУЛЬ ГЕНЕРАЦИИ БУКМАРКЛЕТОВ ЗАГРУЖЕН');
  logger.info(`📌 Версия: ${DEFAULT_CONFIG.version}`);
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('📋 ДОСТУПНЫЕ КОМАНДЫ:');
  logger.info('  __bookmarkletGenerator.refresh()      - обновить все букмарклеты');
  logger.info('  __bookmarkletGenerator.getList()      - получить список букмарклетов');
  logger.info('  __bookmarkletGenerator.generate(data) - сгенерировать код');
  logger.info('  __bookmarkletGenerator.update(id, code) - обновить один');
  logger.info('  __bookmarkletGenerator.updateAll(list) - обновить все');
  logger.info('  __bookmarkletGenerator.getState()     - получить состояние');
  logger.info('  __bookmarkletGenerator.getResults()   - получить результаты');
  logger.info('  __bookmarkletGenerator.getConfig()    - получить конфигурацию');
  logger.info('  __bookmarkletGenerator.clearCache()   - очистить кеш');
  logger.info('  __bookmarkletGenerator.reset()        - сбросить состояние');
  logger.info('  __bookmarkletGenerator.export()       - экспортировать данные');
  logger.info('  __bookmarkletGenerator.import(json)   - импортировать данные');
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('📌 ПУБЛИЧНЫЕ СИМВОЛЫ (Symbol.for):');
  logger.info(`  ${String(PUBLIC.API)} - API`);
  logger.info(`  ${String(PUBLIC.GENERATOR)} - Генератор`);
  logger.info(`  ${String(PUBLIC.UPDATER)} - Обновление`);
  logger.info(`  ${String(PUBLIC.REFRESHER)} - Обновление списка`);
  logger.info(`  ${String(PUBLIC.CONFIG)} - Конфигурация`);
  logger.info(`  ${String(PUBLIC.LOGGER)} - Логгер`);
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('🔑 ПРИВАТНЫЕ СИМВОЛЫ (только внутри):');
  logger.info(`  ${String(PRIVATE.CONFIG)} - Конфигурация`);
  logger.info(`  ${String(PRIVATE.LOGGER)} - Логгер`);
  logger.info(`  ${String(PRIVATE.STATE)} - Состояние`);
  logger.info(`  ${String(PRIVATE.CACHE)} - Кеш`);
  logger.info(`  ${String(PRIVATE.GENERATE_CODE)} - Генерация кода`);
  logger.info(`  ${String(PRIVATE.UPDATE_BOOKMARK)} - Обновление букмарклета`);
  logger.info(`  ${String(PRIVATE.UPDATE_ALL)} - Обновление всех`);
  logger.info(`  ${String(PRIVATE.GET_LIST)} - Получение списка`);
  logger.info(`  ${String(PRIVATE.REFRESH)} - Обновление списка`);
  logger.info(`  ${String(PRIVATE.BOOKMARKLETS)} - Список букмарклетов`);
  logger.info(`  ${String(PRIVATE.RESULTS)} - Результаты`);
  logger.info(`  ${String(PRIVATE.OPTIONS)} - Опции`);
  logger.info(`  ${String(PRIVATE.INTERNAL)} - Внутренние`);
  logger.info(`  ${String(PRIVATE.INITIALIZED)} - Инициализирован`);
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('✅ BookmarkletGenerator готов к работе!');
  logger.info('═══════════════════════════════════════════════════════════');
}

// ============================================================
// 10. ЭКСПОРТ ДЛЯ ES6 МОДУЛЕЙ
// ============================================================

export default BookmarkletGenerator;
export { BookmarkletGenerator, getInstance, PRIVATE, PUBLIC, DEFAULT_CONFIG };

// ============================================================
// 11. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================================

// Автоматическое обновление при загрузке модуля
// (если запущено в контексте расширения)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const generator = getInstance({ debug: true });

  // Небольшая задержка для полной инициализации
  setTimeout(() => {
    generator.refresh().catch(err => {
      const logger = generator[PRIVATE.LOGGER];
      logger.warn('Автоматическое обновление не выполнено:', err.message);
    });
  }, 1000);
}
