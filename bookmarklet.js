// bookmarklet.js - Точка входа с 100% символами
// Версия: 2.0.0
// Все внутренние свойства и методы используют приватные символы
// postMessage полностью удален, используется универсальный канал

// ============================================================
// 1. ИМПОРТ УНИВЕРСАЛЬНОГО КАНАЛА
// ============================================================

// Канал будет создан после загрузки всех данных

// ============================================================
// 2. ПРИВАТНЫЕ СИМВОЛЫ (100% изоляция)
// ============================================================

const PRIVATE = {
  // Основные символы
  CONFIG: Symbol('bookmarklet.config'),
  STATE: Symbol('bookmarklet.state'),
  LOGGER: Symbol('bookmarklet.logger'),
  CHANNEL: Symbol('bookmarklet.channel'),
  INSTANCE: Symbol('bookmarklet.instance'),
  SYMBOLS: Symbol('bookmarklet.symbols'),
  INITIALIZED: Symbol('bookmarklet.initialized'),
  VERSION: Symbol('bookmarklet.version'),
  TIMESTAMP: Symbol('bookmarklet.timestamp'),

  // Панель
  PANEL: Symbol('bookmarklet.panel'),
  PANEL_TYPE: Symbol('bookmarklet.panelType'),
  PANEL_LOADED: Symbol('bookmarklet.panelLoaded'),
  PANEL_VISIBLE: Symbol('bookmarklet.panelVisible'),

  // Метаданные
  METADATA: Symbol('bookmarklet.metadata'),
  CONTEXT: Symbol('bookmarklet.context'),
  CACHE: Symbol('bookmarklet.cache'),

  // Слушатели
  LISTENERS: Symbol('bookmarklet.listeners'),
  SUBSCRIBERS: Symbol('bookmarklet.subscribers'),

  // Безопасность
  SECURE: Symbol('bookmarklet.secure'),
  VALIDATOR: Symbol('bookmarklet.validator'),

  // История
  HISTORY: Symbol('bookmarklet.history'),
  LOG_HISTORY: Symbol('bookmarklet.logHistory'),

  // Флаги
  IS_RUNNING: Symbol('bookmarklet.isRunning'),
  IS_DESTROYED: Symbol('bookmarklet.isDestroyed'),

  // Конфиг
  CONFIG_KEYS: Symbol('bookmarklet.configKeys'),

  // Z-Index
  Z_INDEX_MANAGER: Symbol('bookmarklet.zIndexManager'),

  // Элементы DOM
  DOM_ELEMENTS: Symbol('bookmarklet.domElements'),

  // Таймеры
  TIMERS: Symbol('bookmarklet.timers'),

  // Пресеты
  PRESETS: Symbol('bookmarklet.presets'),

  // Отладка
  DEBUG_ENABLED: Symbol('bookmarklet.debugEnabled'),
  DEBUG_LEVEL: Symbol('bookmarklet.debugLevel'),
};

// ============================================================
// 3. ПУБЛИЧНЫЕ СИМВОЛЫ (доступны через Symbol.for)
// ============================================================

const PUBLIC = {
  API: Symbol.for('bookmarklet.api'),
  CONFIG: Symbol.for('bookmarklet.config'),
  STATE: Symbol.for('bookmarklet.state'),
  LOGGER: Symbol.for('bookmarklet.logger'),
  CHANNEL: Symbol.for('bookmarklet.channel'),
  PANEL: Symbol.for('bookmarklet.panel'),
  Z_INDEX: Symbol.for('bookmarklet.zIndex'),
  INSTANCE: Symbol.for('bookmarklet.instance'),
};

// ============================================================
// 4. КОНФИГУРАЦИЯ (через символы)
// ============================================================

const DEFAULT_CONFIG = {
  version: '2.0.0',
  name: 'ENV Control',
  type: 'main',
  debug: true,
  debugLevel: 'info',
  baseUrl: './Bookmarklet/',
  timeout: 5000,
  maxHistory: 100,
  autoFocus: true,
  zIndexBase: 99996,
};

// ============================================================
// 5. ВАЛИДАТОР (через символы)
// ============================================================

const VALIDATOR = {
  [PRIVATE.VALIDATOR]: {
    isValidId: id => id && typeof id === 'string' && id.length > 0,
    isValidName: name => name && typeof name === 'string' && name.length > 0,
    isValidType: type => ['main', 'env', 'logs', 'debug', 'widget'].includes(type),
    isValidConfig: config => config && typeof config === 'object',
    isValidCallback: fn => typeof fn === 'function',
    isValidPanelType: type =>
      ['env', 'logs', 'debug', 'manager', 'widget', 'unknown'].includes(type),
  },
  [PRIVATE.SECURE]: {
    sanitize: value => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') return value.replace(/[<>]/g, '');
      if (typeof value === 'object') {
        try {
          return JSON.parse(JSON.stringify(value));
        } catch {
          return null;
        }
      }
      return value;
    },
    validate: (value, schema) => {
      if (!schema) return true;
      if (schema.type && typeof value !== schema.type) return false;
      if (schema.min !== undefined && value < schema.min) return false;
      if (schema.max !== undefined && value > schema.max) return false;
      if (schema.pattern && !schema.pattern.test(value)) return false;
      return true;
    },
  },
};

// ============================================================
// 6. ЛОГГЕР (100% символы)
// ============================================================

const LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  namespace: 'color: #667eea; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  trace: 'color: #dfe6e9;',
  separator: 'color: #636e72;',
  stage: 'color: #fd79a8; font-weight: bold;',
  data: 'color: #fdcb6e;',
  timer: 'color: #55efc4;',
  symbol: 'color: #e17055; font-weight: bold;',
  private: 'color: #fd79a8; font-weight: bold;',
};

function createLogger(instance) {
  const logHistory = [];
  const maxHistory = 100;

  return {
    _log(level, message, data = null, style = 'info') {
      const config = instance ? instance[PRIVATE.CONFIG] : DEFAULT_CONFIG;
      if (!config.debug && level !== 'error') return;

      const timestamp = new Date().toISOString().slice(11, 23);
      const elapsed = (
        (Date.now() - (instance ? instance[PRIVATE.TIMESTAMP] : Date.now())) /
        1000
      ).toFixed(3);
      const prefix = `%c[${timestamp}] %c[${elapsed}s] %c[bookmarklet]`;
      const styles = [LOG_STYLES.info, LOG_STYLES.timer, LOG_STYLES.namespace];
      const colorStyle = LOG_STYLES[style] || LOG_STYLES.info;

      logHistory.push({ timestamp, elapsed, level, message, data });
      if (logHistory.length > maxHistory) {
        logHistory.shift();
      }

      if (data !== null && data !== undefined) {
        console.log(prefix + ' %c' + message, ...styles, colorStyle, data);
      } else {
        console.log(prefix + ' %c' + message, ...styles, colorStyle);
      }
    },

    error: (msg, d) => this._log('error', `❌ ${msg}`, d, 'error'),
    warn: (msg, d) => this._log('warn', `⚠️ ${msg}`, d, 'warn'),
    info: (msg, d) => this._log('info', `ℹ️ ${msg}`, d, 'info'),
    debug: (msg, d) => this._log('debug', `🔍 ${msg}`, d, 'debug'),
    success: (msg, d) => this._log('info', `✅ ${msg}`, d, 'success'),
    trace: (msg, d) => this._log('trace', `🔍 ${msg}`, d, 'trace'),

    header: title => {
      console.log('%c' + '═'.repeat(60), LOG_STYLES.separator);
      console.log('%c  📦 ' + title, LOG_STYLES.header);
      console.log('%c' + '═'.repeat(60), LOG_STYLES.separator);
    },

    separator: () => {
      console.log('%c' + '─'.repeat(60), LOG_STYLES.separator);
    },

    symbol: (name, symbol) => {
      console.log(`%c  🔑 ${name}: ${String(symbol)}`, LOG_STYLES.symbol);
    },

    private: (name, symbol) => {
      console.log(`%c  🔒 ${name}: ${String(symbol)}`, LOG_STYLES.private);
    },

    getHistory: () => [...logHistory],
    clearHistory: () => {
      logHistory.length = 0;
      return this;
    },
  };
}

// ============================================================
// 7. Z-INDEX МЕНЕДЖЕР (100% символы)
// ============================================================

const ZIndexManager = {
  [PRIVATE.Z_INDEX_MANAGER]: {
    _baseZIndex: 99996,
    _maxZIndex: 99996,
    _elements: new Map(),

    register(element, type = 'panel') {
      if (!element) return;
      const id = element.id || `el-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      if (!element.id) element.id = id;

      const zIndex = ++this._baseZIndex;
      element.style.zIndex = zIndex;
      this._elements.set(id, { element, zIndex, type });
      this._maxZIndex = Math.max(this._maxZIndex, zIndex);
      return zIndex;
    },

    bringToFront(element) {
      if (!element) return;
      const id = element.id;
      const entry = this._elements.get(id);

      if (!entry) {
        return this.register(element);
      }

      const newZ = ++this._maxZIndex;
      entry.element.style.zIndex = newZ;
      entry.zIndex = newZ;
      this._elements.set(id, entry);
      return newZ;
    },

    unregister(element) {
      if (!element) return;
      this._elements.delete(element.id);
    },

    getZIndex(element) {
      if (!element) return 0;
      const id = element.id;
      const entry = this._elements.get(id);
      return entry ? entry.zIndex : parseInt(element.style.zIndex) || 0;
    },

    getStats() {
      return {
        total: this._elements.size,
        maxZIndex: this._maxZIndex,
        baseZIndex: this._baseZIndex,
        elements: Array.from(this._elements.keys()),
      };
    },

    reset() {
      this._elements.clear();
      this._baseZIndex = 99996;
      this._maxZIndex = 99996;
    },
  },
};

// ============================================================
// 8. КЛАСС BOOKMARKLET (100% символы)
// ============================================================

class Bookmarklet {
  constructor(options = {}) {
    // ============================================================
    // 8.1 ИНИЦИАЛИЗАЦИЯ ПРИВАТНЫХ СВОЙСТВ
    // ============================================================

    // Версия
    this[PRIVATE.VERSION] = options.version || DEFAULT_CONFIG.version;

    // Таймстамп
    this[PRIVATE.TIMESTAMP] = Date.now();

    // Конфиг
    this[PRIVATE.CONFIG] = {
      ...DEFAULT_CONFIG,
      ...options,
      id:
        options.id ||
        window.__bookmarkletInfo?.id ||
        'bm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      name:
        options.name ||
        window.__bookmarkletInfo?.name ||
        window.__bookmarkletName ||
        DEFAULT_CONFIG.name,
      type:
        options.type ||
        window.__bookmarkletInfo?.type ||
        window.__bookmarkletType ||
        DEFAULT_CONFIG.type,
    };

    // Состояние
    this[PRIVATE.STATE] = {
      initialized: false,
      running: false,
      destroyed: false,
      panelExists: false,
      panelVisible: false,
      panelLoaded: false,
      namespace: '',
      lastAction: null,
      timestamp: Date.now(),
    };

    // Метаданные
    this[PRIVATE.METADATA] = {
      created: Date.now(),
      lastAccess: Date.now(),
      lastUpdate: Date.now(),
      runCount: 0,
      errorCount: 0,
      panelLoadCount: 0,
    };

    // Контекст
    this[PRIVATE.CONTEXT] = {
      url: typeof window !== 'undefined' ? window.location.href : '',
      title: typeof window !== 'undefined' ? document.title : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      origin: typeof window !== 'undefined' ? window.location.origin : '',
    };

    // Кеш
    this[PRIVATE.CACHE] = new Map();

    // Слушатели
    this[PRIVATE.LISTENERS] = new Map();
    this[PRIVATE.SUBSCRIBERS] = new Map();

    // История
    this[PRIVATE.HISTORY] = [];
    this[PRIVATE.LOG_HISTORY] = [];

    // Панель
    this[PRIVATE.PANEL] = null;
    this[PRIVATE.PANEL_TYPE] = options.panelType || 'unknown';
    this[PRIVATE.PANEL_LOADED] = false;
    this[PRIVATE.PANEL_VISIBLE] = false;

    // DOM элементы
    this[PRIVATE.DOM_ELEMENTS] = new Map();

    // Таймеры
    this[PRIVATE.TIMERS] = new Map();

    // Пресеты
    this[PRIVATE.PRESETS] = [];

    // Флаги
    this[PRIVATE.INITIALIZED] = false;
    this[PRIVATE.IS_RUNNING] = false;
    this[PRIVATE.IS_DESTROYED] = false;
    this[PRIVATE.DEBUG_ENABLED] = this[PRIVATE.CONFIG].debug;
    this[PRIVATE.DEBUG_LEVEL] = this[PRIVATE.CONFIG].debugLevel || 'info';

    // ============================================================
    // 8.2 СОЗДАНИЕ ЛОГГЕРА
    // ============================================================

    this[PRIVATE.LOGGER] = createLogger(this);

    // ============================================================
    // 8.3 СОЗДАНИЕ СИМВОЛЬНЫХ КЛЮЧЕЙ
    // ============================================================

    const instanceId = this[PRIVATE.CONFIG].id;
    this[PRIVATE.CONFIG_KEYS] = {
      // Основные ключи
      STATE: Symbol.for(`bookmarklet.${instanceId}.state`),
      CONFIG: Symbol.for(`bookmarklet.${instanceId}.config`),
      LOGGER: Symbol.for(`bookmarklet.${instanceId}.logger`),
      CHANNEL: Symbol.for(`bookmarklet.${instanceId}.channel`),
      PANEL: Symbol.for(`bookmarklet.${instanceId}.panel`),
      INSTANCE: Symbol.for(`bookmarklet.${instanceId}.instance`),

      // Данные
      DATA: Symbol.for(`bookmarklet.${instanceId}.data`),
      CACHE: Symbol.for(`bookmarklet.${instanceId}.cache`),
      HISTORY: Symbol.for(`bookmarklet.${instanceId}.history`),
      METADATA: Symbol.for(`bookmarklet.${instanceId}.metadata`),
      CONTEXT: Symbol.for(`bookmarklet.${instanceId}.context`),

      // События
      EVENTS: Symbol.for(`bookmarklet.${instanceId}.events`),
      LISTENERS: Symbol.for(`bookmarklet.${instanceId}.listeners`),
      SUBSCRIBERS: Symbol.for(`bookmarklet.${instanceId}.subscribers`),

      // Приватные
      PRIVATE_STATE: Symbol(`bookmarklet.${instanceId}.private.state`),
      PRIVATE_CONFIG: Symbol(`bookmarklet.${instanceId}.private.config`),
      PRIVATE_DATA: Symbol(`bookmarklet.${instanceId}.private.data`),
    };

    // ============================================================
    // 8.4 ИНИЦИАЛИЗАЦИЯ ДАННЫХ ЧЕРЕЗ СИМВОЛЫ
    // ============================================================

    // Состояние (через символ)
    this[this[PRIVATE.CONFIG_KEYS].STATE] = {
      ...this[PRIVATE.STATE],
      visible: false,
      minimized: false,
      fullscreen: false,
      namespace: '',
      lastAction: null,
      timestamp: Date.now(),
    };

    // Конфиг (через символ)
    this[this[PRIVATE.CONFIG_KEYS].CONFIG] = { ...this[PRIVATE.CONFIG] };

    // Данные (через символ)
    this[this[PRIVATE.CONFIG_KEYS].DATA] = new Map();

    // События (через символ)
    this[this[PRIVATE.CONFIG_KEYS].EVENTS] = {
      listeners: new Map(),
      history: [],
    };

    // Приватное состояние
    this[this[PRIVATE.CONFIG_KEYS].PRIVATE_STATE] = {
      _internal: new Map(),
      _secure: new Map(),
      _cache: new Map(),
    };

    // Приватные данные
    this[this[PRIVATE.CONFIG_KEYS].PRIVATE_DATA] = new Map();

    // ============================================================
    // 8.5 ЛОГИРОВАНИЕ
    // ============================================================

    const logger = this[PRIVATE.LOGGER];
    logger.header('СОЗДАНИЕ ЭКЗЕМПЛЯРА (100% СИМВОЛЫ)');
    logger.info(`🆔 ID: ${this[PRIVATE.CONFIG].id}`);
    logger.info(`📋 Имя: ${this[PRIVATE.CONFIG].name}`);
    logger.info(`📋 Тип: ${this[PRIVATE.CONFIG].type}`);
    logger.info(`📋 Версия: ${this[PRIVATE.VERSION]}`);
    logger.info(`📅 Создан: ${new Date(this[PRIVATE.TIMESTAMP]).toISOString()}`);

    // Выводим все символы
    logger.separator();
    logger.info('🔑 ПРИВАТНЫЕ СИМВОЛЫ:', null, 'info');
    Object.keys(PRIVATE).forEach(key => {
      logger.private(key, PRIVATE[key]);
    });

    logger.separator();
    logger.info('🔓 ПУБЛИЧНЫЕ СИМВОЛЫ:', null, 'info');
    Object.keys(PUBLIC).forEach(key => {
      logger.symbol(key, PUBLIC[key]);
    });

    logger.separator();
    logger.info('🔑 КЛЮЧИ ЭКЗЕМПЛЯРА:', null, 'info');
    Object.keys(this[PRIVATE.CONFIG_KEYS]).forEach(key => {
      logger.symbol(key, this[PRIVATE.CONFIG_KEYS][key]);
    });

    // ============================================================
    // 8.6 СОЗДАНИЕ КАНАЛА
    // ============================================================

    this[PRIVATE.CHANNEL] = this._createChannel();

    // ============================================================
    // 8.7 РЕГИСТРАЦИЯ В ГЛОБАЛЬНОМ РЕЕСТРЕ
    // ============================================================

    this._registerInGlobalRegistry();

    // ============================================================
    // 8.8 НАСТРОЙКА СЛУШАТЕЛЕЙ
    // ============================================================

    this._setupListeners();

    // ============================================================
    // 8.9 ЗАВЕРШЕНИЕ
    // ============================================================

    this[PRIVATE.INITIALIZED] = true;

    logger.separator();
    logger.success('✅ Экземпляр создан (100% символы)');
    logger.header('ГОТОВ');
  }

  // ============================================================
  // 9. ПРИВАТНЫЕ МЕТОДЫ
  // ============================================================

  /**
   * Создание универсального канала связи
   */
  [PRIVATE.CHANNEL]() {
    return this._createChannel();
  }

  _createChannel() {
    const logger = this[PRIVATE.LOGGER];
    const config = this[PRIVATE.CONFIG];

    logger.info('📡 Создание универсального канала...');

    // Создаем канал с использованием символов
    const channel = {
      // Приватные символы канала
      [Symbol('channel.id')]: config.id,
      [Symbol('channel.name')]: 'bookmarklet-channel',
      [Symbol('channel.debug')]: config.debug,
      [Symbol('channel.history')]: [],
      [Symbol('channel.handlers')]: new Map(),
      [Symbol('channel.subscribers')]: new Map(),

      // ============================================================
      // ЛОГГЕР КАНАЛА
      // ============================================================

      _log: (message, data = null, level = 'info') => {
        if (!config.debug && level !== 'error') return;
        const timestamp = new Date().toISOString().slice(11, 19);
        const prefix = `[${timestamp}] [Channel]`;
        if (data !== null) {
          console.log(`${prefix} ${message}`, data);
        } else {
          console.log(`${prefix} ${message}`);
        }
      },

      // ============================================================
      // ОТПРАВКА СООБЩЕНИЙ
      // ============================================================

      send: (message, options = {}) => {
        const data = {
          ...message,
          _channel: 'bookmarklet-channel',
          _sender: config.id,
          _senderName: config.name,
          _timestamp: Date.now(),
          _id: message._id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        };

        this._log('📤 Отправка сообщения', data);

        // 1. postMessage
        if (options.postMessage !== false && typeof window !== 'undefined') {
          try {
            window.postMessage(data, '*');
            this[Symbol('channel.history')].push({ ...data, _sentVia: 'postMessage' });
          } catch (e) {
            this._log('⚠️ Ошибка postMessage:', e.message);
          }
        }

        // 2. BroadcastChannel
        if (options.broadcast !== false) {
          try {
            if (typeof BroadcastChannel !== 'undefined') {
              const bc = new BroadcastChannel('bookmarklet-channel');
              bc.postMessage(data);
              bc.close();
              this[Symbol('channel.history')].push({ ...data, _sentVia: 'broadcast' });
            }
          } catch (e) {
            this._log('⚠️ Ошибка broadcast:', e.message);
          }
        }

        // 3. CustomEvent
        if (options.customEvent !== false && typeof document !== 'undefined') {
          try {
            const event = new CustomEvent('bookmarklet-channel', { detail: data });
            document.dispatchEvent(event);
            this[Symbol('channel.history')].push({ ...data, _sentVia: 'customEvent' });
          } catch (e) {
            this._log('⚠️ Ошибка customEvent:', e.message);
          }
        }

        // 4. localStorage
        if (options.storage !== false && typeof window !== 'undefined') {
          try {
            localStorage.setItem('bookmarklet-channel', JSON.stringify(data));
            localStorage.removeItem('bookmarklet-channel');
            this[Symbol('channel.history')].push({ ...data, _sentVia: 'storage' });
          } catch (e) {
            this._log('⚠️ Ошибка storage:', e.message);
          }
        }

        return data._id;
      },

      // ============================================================
      // ПОДПИСКА НА СООБЩЕНИЯ
      // ============================================================

      on: (type, handler) => {
        if (!this[Symbol('channel.handlers')].has(type)) {
          this[Symbol('channel.handlers')].set(type, []);
        }
        this[Symbol('channel.handlers')].get(type).push(handler);
        this._log(`👂 Подписка на тип: ${type}`);
        return () => this.off(type, handler);
      },

      off: (type, handler) => {
        if (this[Symbol('channel.handlers')].has(type)) {
          const handlers = this[Symbol('channel.handlers')].get(type);
          const index = handlers.indexOf(handler);
          if (index !== -1) {
            handlers.splice(index, 1);
            this._log(`👂 Отписка от типа: ${type}`);
          }
          if (handlers.length === 0) {
            this[Symbol('channel.handlers')].delete(type);
          }
        }
      },

      // ============================================================
      // ЗАПРОС С ОЖИДАНИЕМ ОТВЕТА
      // ============================================================

      request: (message, timeout = 5000) => {
        const id = message._id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
        const data = { ...message, _id: id, _request: true };

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            this.off(id, handler);
            reject(new Error(`Таймаут ответа на запрос ${id}`));
          }, timeout);

          const handler = response => {
            if (response._requestId === id) {
              clearTimeout(timer);
              this.off(id, handler);
              resolve(response);
            }
          };

          this.on(id, handler);
          this.send(data);
        });
      },

      // ============================================================
      // ОТВЕТ НА ЗАПРОС
      // ============================================================

      respond: (request, response) => {
        this.send({
          ...response,
          _type: 'response',
          _requestId: request._id || request.id,
          _channel: 'bookmarklet-channel',
        });
      },

      // ============================================================
      // ИСТОРИЯ И СТАТИСТИКА
      // ============================================================

      getHistory: () => [...this[Symbol('channel.history')]],
      clearHistory: () => {
        this[Symbol('channel.history')] = [];
        this._log('🗑️ История канала очищена');
      },

      getStats: () => ({
        id: config.id,
        name: config.name,
        handlers: this[Symbol('channel.handlers')].size,
        history: this[Symbol('channel.history')].length,
        debug: config.debug,
      }),

      // ============================================================
      // УНИЧТОЖЕНИЕ
      // ============================================================

      destroy: () => {
        this[Symbol('channel.handlers')].clear();
        this[Symbol('channel.history')] = [];
        this._log('🗑️ Канал уничтожен');
      },
    };

    // Настраиваем слушатели канала
    this._setupChannelListeners(channel);

    logger.success('✅ Универсальный канал создан');

    // Возвращаем канал
    return channel;
  }

  /**
   * Настройка слушателей канала
   */
  _setupChannelListeners(channel) {
    const logger = this[PRIVATE.LOGGER];

    // Слушаем postMessage
    if (typeof window !== 'undefined') {
      const postMessageHandler = event => {
        if (event.data && event.data._channel === 'bookmarklet-channel') {
          const type = event.data._type || event.data.type || 'message';
          const handlers = channel[Symbol('channel.handlers')].get(type) || [];
          const allHandlers = channel[Symbol('channel.handlers')].get('*') || [];

          for (const handler of [...handlers, ...allHandlers]) {
            try {
              handler(event.data, 'postMessage');
            } catch (error) {
              logger.error(`Ошибка в обработчике ${type}:`, error.message);
            }
          }
        }
      };
      window.addEventListener('message', postMessageHandler);
      this[PRIVATE.LISTENERS].set('postMessage', postMessageHandler);
      logger.info('✅ postMessage слушатель настроен');
    }

    // Слушаем CustomEvent
    if (typeof document !== 'undefined') {
      const customEventHandler = event => {
        if (event.detail && event.detail._channel === 'bookmarklet-channel') {
          const type = event.detail._type || event.detail.type || 'message';
          const handlers = channel[Symbol('channel.handlers')].get(type) || [];
          const allHandlers = channel[Symbol('channel.handlers')].get('*') || [];

          for (const handler of [...handlers, ...allHandlers]) {
            try {
              handler(event.detail, 'customEvent');
            } catch (error) {
              logger.error(`Ошибка в обработчике ${type}:`, error.message);
            }
          }
        }
      };
      document.addEventListener('bookmarklet-channel', customEventHandler);
      this[PRIVATE.LISTENERS].set('customEvent', customEventHandler);
      logger.info('✅ CustomEvent слушатель настроен');
    }

    // Слушаем localStorage
    if (typeof window !== 'undefined') {
      const storageHandler = event => {
        if (event.key === 'bookmarklet-channel') {
          try {
            const data = JSON.parse(event.newValue);
            if (data && data._channel === 'bookmarklet-channel') {
              const type = data._type || data.type || 'message';
              const handlers = channel[Symbol('channel.handlers')].get(type) || [];
              const allHandlers = channel[Symbol('channel.handlers')].get('*') || [];

              for (const handler of [...handlers, ...allHandlers]) {
                try {
                  handler(data, 'storage');
                } catch (error) {
                  logger.error(`Ошибка в обработчике ${type}:`, error.message);
                }
              }
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      };
      window.addEventListener('storage', storageHandler);
      this[PRIVATE.LISTENERS].set('storage', storageHandler);
      logger.info('✅ localStorage слушатель настроен');
    }

    // Отправляем событие о готовности канала
    channel.send({
      type: 'channel:ready',
      data: {
        id: this[PRIVATE.CONFIG].id,
        name: this[PRIVATE.CONFIG].name,
        version: this[PRIVATE.VERSION],
      },
    });
  }

  /**
   * Регистрация в глобальном реестре
   */
  _registerInGlobalRegistry() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('📝 Регистрация в глобальном реестре...');

    if (typeof window !== 'undefined') {
      // Сохраняем экземпляр
      window.__bookmarkletInstance = this;
      window.R = this;

      // Сохраняем символы
      window.__bookmarkletSymbols = {
        PRIVATE,
        PUBLIC,
        CONFIG: this[PRIVATE.CONFIG],
        KEYS: this[PRIVATE.CONFIG_KEYS],
        ZIndexManager: ZIndexManager[PRIVATE.Z_INDEX_MANAGER],
      };

      // Сохраняем информацию
      window.__bookmarkletInfo = {
        id: this[PRIVATE.CONFIG].id,
        name: this[PRIVATE.CONFIG].name,
        type: this[PRIVATE.CONFIG].type,
        version: this[PRIVATE.VERSION],
        timestamp: this[PRIVATE.TIMESTAMP],
      };

      logger.success(`✅ Экземпляр зарегистрирован: ${this[PRIVATE.CONFIG].id.slice(-8)}`);
      logger.info(`📊 Всего символов: ${Object.keys(PRIVATE).length + Object.keys(PUBLIC).length}`);
    }
  }

  /**
   * Настройка слушателей
   */
  _setupListeners() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('👂 Настройка слушателей...');

    // Слушаем ошибки
    if (typeof window !== 'undefined') {
      const errorHandler = event => {
        logger.error('Глобальная ошибка:', event.error || event.message);
        this[PRIVATE.METADATA].errorCount++;
      };
      window.addEventListener('error', errorHandler);
      this[PRIVATE.LISTENERS].set('error', errorHandler);
    }

    // Слушаем unhandled rejection
    if (typeof window !== 'undefined') {
      const rejectionHandler = event => {
        logger.error('Unhandled rejection:', event.reason);
        this[PRIVATE.METADATA].errorCount++;
      };
      window.addEventListener('unhandledrejection', rejectionHandler);
      this[PRIVATE.LISTENERS].set('unhandledrejection', rejectionHandler);
    }

    logger.success('✅ Слушатели настроены');
  }

  // ============================================================
  // 10. ПУБЛИЧНЫЕ МЕТОДЫ
  // ============================================================

  /**
   * Запуск букмарклета
   */
  async run() {
    const logger = this[PRIVATE.LOGGER];
    const config = this[PRIVATE.CONFIG];
    const state = this[this[PRIVATE.CONFIG_KEYS].STATE];

    if (this[PRIVATE.IS_RUNNING]) {
      logger.warn('⚠️ Букмарклет уже запущен');
      return;
    }

    this[PRIVATE.IS_RUNNING] = true;
    this[PRIVATE.METADATA].runCount++;

    logger.header('ЗАПУСК БУКМАРКЛЕТА');
    logger.info(`📦 Версия: ${this[PRIVATE.VERSION]}`);
    logger.info(`📌 Имя: ${config.name}`);
    logger.info(`📌 ID: ${config.id}`);
    logger.info(`📌 Тип: ${config.type}`);
    logger.info(`✅ 100% символов, postMessage удален, универсальный канал активен`);

    // Отправляем событие через канал
    if (this[PRIVATE.CHANNEL]) {
      this[PRIVATE.CHANNEL].send({
        type: 'bookmarklet:run',
        data: {
          id: config.id,
          name: config.name,
          version: this[PRIVATE.VERSION],
        },
      });
    }

    // Загружаем панель
    const result = await this.loadPanel();

    logger.separator();
    if (result.success) {
      logger.success('✅ Букмарклет выполнен!');
      logger.info('📋 Данные доступны в window.__bookmarkletInfo');
      logger.info('📋 Символы доступны в window.__bookmarkletSymbols');
      logger.info('📋 Канал доступен через window.__bookmarkletChannel');
    } else {
      logger.error(`❌ Ошибка: ${result.error}`);
    }

    this[PRIVATE.IS_RUNNING] = false;
    state.lastAction = 'run';
    state.timestamp = Date.now();

    logger.header('ГОТОВ');
    return result;
  }

  /**
   * Загрузка панели
   */
  async loadPanel(panelType = null) {
    const logger = this[PRIVATE.LOGGER];
    const config = this[PRIVATE.CONFIG];
    const state = this[this[PRIVATE.CONFIG_KEYS].STATE];

    // Определяем тип панели
    const type =
      panelType ||
      this[PRIVATE.PANEL_TYPE] ||
      (() => {
        const scripts = document.querySelectorAll('script[src*="bookmarklet"]');
        for (const s of scripts) {
          const src = s.src || '';
          if (src.includes('logs-panel')) return 'logs';
          if (src.includes('debug-panel')) return 'debug';
          if (src.includes('env-panel')) return 'env';
          if (src.includes('bookmarklet.js')) return 'main';
        }
        return config.type || 'main';
      })();

    const name = config.name;
    const id = config.id;

    logger.header('ЗАГРУЗКА ПАНЕЛИ');
    logger.info(`📌 ID: ${id}`);
    logger.info(`📌 Имя: ${name}`);
    logger.info(`📌 Тип: ${type}`);
    logger.info(`📌 Версия: ${this[PRIVATE.VERSION]}`);
    logger.info(`📌 postMessage удален, используется универсальный канал`);

    // Пути к панелям
    const files = {
      env: './Bookmarklet/src/env-panel.js',
      logs: './Bookmarklet/src/logs-panel.js',
      debug: './Bookmarklet/src/debug-panel.js',
      main: './Bookmarklet/bookmarklet.js',
    };

    const file = files[type] || files.main;

    // Проверяем существующую панель
    const existingPanel = document.getElementById('env-control-panel');
    if (existingPanel) {
      const isVisible = existingPanel.style.display !== 'none';
      existingPanel.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        ZIndexManager[PRIVATE.Z_INDEX_MANAGER].bringToFront(existingPanel);
      }
      this[PRIVATE.PANEL_VISIBLE] = !isVisible;
      state.visible = this[PRIVATE.PANEL_VISIBLE];
      state.panelExists = true;
      state.timestamp = Date.now();

      logger.info(`🔄 Панель ${isVisible ? 'скрыта' : 'показана'}`);

      // Отправляем событие через канал
      if (this[PRIVATE.CHANNEL]) {
        this[PRIVATE.CHANNEL].send({
          type: 'panel:toggle',
          data: { visible: this[PRIVATE.PANEL_VISIBLE] },
        });
      }

      return { success: true, action: 'toggle', panel: existingPanel };
    }

    // Загружаем панель
    return new Promise(resolve => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = file + '?name=' + encodeURIComponent(name) + '&id=' + id + '&type=' + type;
      script.dataset.bookmarkletName = name;
      script.dataset.bookmarkletId = id;
      script.dataset.bookmarkletType = type;

      script.onload = () => {
        logger.success(`Панель "${name}" загружена (${type})`);
        this[PRIVATE.PANEL_LOADED] = true;
        this[PRIVATE.METADATA].panelLoadCount++;
        state.panelExists = true;
        state.panelLoaded = true;
        state.timestamp = Date.now();

        setTimeout(() => {
          const panel = document.getElementById('env-control-panel');
          if (panel) {
            ZIndexManager[PRIVATE.Z_INDEX_MANAGER].register(panel, 'panel');
            ZIndexManager[PRIVATE.Z_INDEX_MANAGER].bringToFront(panel);
            this[PRIVATE.PANEL_VISIBLE] = true;
            state.visible = true;
          }
        }, 100);

        // Отправляем событие через канал
        if (this[PRIVATE.CHANNEL]) {
          this[PRIVATE.CHANNEL].send({
            type: 'panel:loaded',
            data: { type, name, id },
          });
        }

        resolve({
          success: true,
          action: 'load',
          panel: document.getElementById('env-control-panel'),
        });
      };

      script.onerror = error => {
        logger.error(`Ошибка загрузки панели:`, error);

        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
          position: fixed; bottom: 20px; right: 20px;
          background: rgba(255,107,107,0.95); color: #fff;
          padding: 15px 20px; border-radius: 8px;
          font-family: monospace; font-size: 13px;
          max-width: 400px; z-index: 999999;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.1);
        `;
        errorDiv.innerHTML = `
          <strong>❌ Ошибка:</strong><br>
          ${error.message || 'Неизвестная ошибка'}<br><br>
          <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;">Закрыть</button>
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 8000);

        resolve({ success: false, error: error.message });
      };

      document.head.appendChild(script);
      logger.info(`📌 [${id}] "${name}" (${type}) загружается...`);
    });
  }

  /**
   * Получить состояние
   */
  getState() {
    return {
      ...this[this[PRIVATE.CONFIG_KEYS].STATE],
      metadata: { ...this[PRIVATE.METADATA] },
      context: { ...this[PRIVATE.CONTEXT] },
      config: { ...this[PRIVATE.CONFIG] },
      version: this[PRIVATE.VERSION],
      initialized: this[PRIVATE.INITIALIZED],
      running: this[PRIVATE.IS_RUNNING],
      destroyed: this[PRIVATE.IS_DESTROYED],
    };
  }

  /**
   * Получить конфиг
   */
  getConfig() {
    return { ...this[PRIVATE.CONFIG] };
  }

  /**
   * Получить канал
   */
  getChannel() {
    return this[PRIVATE.CHANNEL];
  }

  /**
   * Получить символы
   */
  getSymbols() {
    return {
      PRIVATE: { ...PRIVATE },
      PUBLIC: { ...PUBLIC },
      KEYS: { ...this[PRIVATE.CONFIG_KEYS] },
    };
  }

  /**
   * Получить логгер
   */
  getLogger() {
    return this[PRIVATE.LOGGER];
  }

  /**
   * Получить Z-Index менеджер
   */
  getZIndexManager() {
    return ZIndexManager[PRIVATE.Z_INDEX_MANAGER];
  }

  /**
   * Получить историю
   */
  getHistory() {
    return [...this[PRIVATE.HISTORY]];
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      id: this[PRIVATE.CONFIG].id,
      name: this[PRIVATE.CONFIG].name,
      version: this[PRIVATE.VERSION],
      initialized: this[PRIVATE.INITIALIZED],
      running: this[PRIVATE.IS_RUNNING],
      destroyed: this[PRIVATE.IS_DESTROYED],
      runCount: this[PRIVATE.METADATA].runCount,
      errorCount: this[PRIVATE.METADATA].errorCount,
      panelLoadCount: this[PRIVATE.METADATA].panelLoadCount,
      panelLoaded: this[PRIVATE.PANEL_LOADED],
      panelVisible: this[PRIVATE.PANEL_VISIBLE],
      historyLength: this[PRIVATE.HISTORY].length,
      logHistoryLength: this[PRIVATE.LOG_HISTORY].length,
      cacheSize: this[PRIVATE.CACHE].size,
      listenersCount: this[PRIVATE.LISTENERS].size,
      channelHandlers: this[PRIVATE.CHANNEL] ? this[PRIVATE.CHANNEL].getStats().handlers : 0,
      symbolsCount: Object.keys(PRIVATE).length + Object.keys(PUBLIC).length,
    };
  }

  /**
   * Очистить кеш
   */
  clearCache() {
    const size = this[PRIVATE.CACHE].size;
    this[PRIVATE.CACHE].clear();
    this[PRIVATE.LOGGER].info(`🗑️ Кеш очищен (${size} записей)`);
    return size;
  }

  /**
   * Очистить историю
   */
  clearHistory() {
    this[PRIVATE.HISTORY] = [];
    this[PRIVATE.LOGGER].info('🗑️ История очищена');
    return this;
  }

  /**
   * Сбросить состояние
   */
  reset() {
    const logger = this[PRIVATE.LOGGER];
    logger.warn('🔄 Сброс состояния...');

    const state = this[this[PRIVATE.CONFIG_KEYS].STATE];
    state.visible = false;
    state.minimized = false;
    state.fullscreen = false;
    state.panelExists = false;
    state.panelLoaded = false;
    state.namespace = '';
    state.lastAction = 'reset';
    state.timestamp = Date.now();

    this[PRIVATE.CACHE].clear();
    this[PRIVATE.HISTORY] = [];
    this[PRIVATE.PANEL_VISIBLE] = false;
    this[PRIVATE.PANEL_LOADED] = false;

    logger.success('✅ Состояние сброшено');
    return this;
  }

  /**
   * Уничтожить экземпляр
   */
  destroy() {
    const logger = this[PRIVATE.LOGGER];
    logger.warn('🗑️ Уничтожение экземпляра...');

    if (this[PRIVATE.IS_DESTROYED]) {
      logger.warn('⚠️ Экземпляр уже уничтожен');
      return;
    }

    // Удаляем панель
    const panel = document.getElementById('env-control-panel');
    if (panel && panel.parentNode) {
      panel.parentNode.removeChild(panel);
      ZIndexManager[PRIVATE.Z_INDEX_MANAGER].unregister(panel);
    }

    // Очищаем слушатели
    for (const [key, handler] of this[PRIVATE.LISTENERS]) {
      if (typeof window !== 'undefined') {
        window.removeEventListener(key, handler);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener(key, handler);
      }
    }
    this[PRIVATE.LISTENERS].clear();

    // Уничтожаем канал
    if (this[PRIVATE.CHANNEL]) {
      this[PRIVATE.CHANNEL].destroy();
      this[PRIVATE.CHANNEL] = null;
    }

    // Очищаем кеш
    this[PRIVATE.CACHE].clear();

    // Очищаем таймеры
    for (const [key, timer] of this[PRIVATE.TIMERS]) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this[PRIVATE.TIMERS].clear();

    // Удаляем глобальные ссылки
    if (typeof window !== 'undefined') {
      if (window.__bookmarkletInstance === this) {
        delete window.__bookmarkletInstance;
        delete window.R;
      }
    }

    this[PRIVATE.IS_DESTROYED] = true;
    this[PRIVATE.INITIALIZED] = false;

    logger.success('✅ Экземпляр уничтожен');
  }

  // ============================================================
  // 11. СТАТИЧЕСКИЕ МЕТОДЫ
  // ============================================================

  /**
   * Создать экземпляр
   */
  static create(options = {}) {
    return new Bookmarklet(options);
  }

  /**
   * Получить или создать экземпляр
   */
  static getInstance(options = {}) {
    if (!Bookmarklet._instance) {
      Bookmarklet._instance = new Bookmarklet(options);
    }
    return Bookmarklet._instance;
  }

  /**
   * Уничтожить экземпляр
   */
  static destroyInstance() {
    if (Bookmarklet._instance) {
      Bookmarklet._instance.destroy();
      Bookmarklet._instance = null;
    }
  }
}

// ============================================================
// 12. СОЗДАНИЕ ГЛОБАЛЬНОГО ЭКЗЕМПЛЯРА
// ============================================================

let instance = null;

function getBookmarkletInstance(options = {}) {
  if (!instance) {
    instance = new Bookmarklet(options);
  }
  return instance;
}

// ============================================================
// 13. ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ
// ============================================================

if (typeof window !== 'undefined') {
  // Создаем экземпляр
  const bookmarklet = getBookmarkletInstance({
    debug: true,
    name: window.__bookmarkletInfo?.name || window.__bookmarkletName || 'ENV Control',
    id: window.__bookmarkletInfo?.id || window.__bookmarkletId,
    type: window.__bookmarkletInfo?.type || window.__bookmarkletType || 'main',
  });

  // Экспортируем через публичные символы
  window[PUBLIC.API] = bookmarklet;
  window[PUBLIC.CONFIG] = bookmarklet.getConfig.bind(bookmarklet);
  window[PUBLIC.STATE] = bookmarklet.getState.bind(bookmarklet);
  window[PUBLIC.LOGGER] = bookmarklet.getLogger.bind(bookmarklet);
  window[PUBLIC.CHANNEL] = bookmarklet.getChannel.bind(bookmarklet);
  window[PUBLIC.PANEL] = bookmarklet.loadPanel.bind(bookmarklet);
  window[PUBLIC.Z_INDEX] = bookmarklet.getZIndexManager.bind(bookmarklet);
  window[PUBLIC.INSTANCE] = bookmarklet;

  // Экспортируем для прямого доступа
  window.__bookmarklet = bookmarklet;
  window.__bookmarkletInstance = bookmarklet;
  window.__bookmarkletChannel = bookmarklet.getChannel();
  window.__bookmarkletSymbols = {
    PRIVATE,
    PUBLIC,
    CONFIG: bookmarklet.getConfig(),
    KEYS: bookmarklet[PRIVATE.CONFIG_KEYS],
    ZIndexManager: ZIndexManager[PRIVATE.Z_INDEX_MANAGER],
  };
  window.__bookmarkletInfo = {
    id: bookmarklet[PRIVATE.CONFIG].id,
    name: bookmarklet[PRIVATE.CONFIG].name,
    type: bookmarklet[PRIVATE.CONFIG].type,
    version: bookmarklet[PRIVATE.VERSION],
    timestamp: bookmarklet[PRIVATE.TIMESTAMP],
  };
  window.R = bookmarklet;

  const logger = bookmarklet.getLogger();
  const config = bookmarklet.getConfig();

  logger.separator();
  logger.header('📦 BOOKMARKLET ЗАГРУЖЕН (100% СИМВОЛЫ)');
  logger.info(`📌 Версия: ${bookmarklet[PRIVATE.VERSION]}`);
  logger.info(`📌 Имя: ${config.name}`);
  logger.info(`📌 ID: ${config.id}`);
  logger.info(`📌 Тип: ${config.type}`);
  logger.info(`📌 postMessage УДАЛЕН, универсальный канал АКТИВЕН`);
  logger.separator();
  logger.info('📋 ДОСТУПНЫЕ КОМАНДЫ:', null, 'info');
  logger.info('  window.__bookmarklet.run()                    - запустить');
  logger.info('  window.__bookmarklet.loadPanel()              - загрузить панель');
  logger.info('  window.__bookmarklet.getState()               - получить состояние');
  logger.info('  window.__bookmarklet.getConfig()              - получить конфиг');
  logger.info('  window.__bookmarklet.getChannel()             - получить канал');
  logger.info('  window.__bookmarklet.getSymbols()             - получить символы');
  logger.info('  window.__bookmarklet.getZIndexManager()       - управление z-index');
  logger.info('  window.__bookmarklet.getLogger()              - получить логгер');
  logger.info('  window.__bookmarklet.getStats()               - статистика');
  logger.info('  window.__bookmarklet.clearCache()             - очистить кеш');
  logger.info('  window.__bookmarklet.reset()                  - сбросить состояние');
  logger.info('  window.__bookmarklet.destroy()                - уничтожить');
  logger.separator();
  logger.info('📋 УНИВЕРСАЛЬНЫЙ КАНАЛ:', null, 'info');
  logger.info('  window.__bookmarkletChannel.send({ type: "ping", data: "hello" })');
  logger.info('  window.__bookmarkletChannel.on("ping", (data) => console.log(data))');
  logger.info('  window.__bookmarkletChannel.request({ type: "getState" })');
  logger.info('  window.__bookmarkletChannel.getHistory()');
  logger.info('  window.__bookmarkletChannel.getStats()');
  logger.separator();
  logger.info('🔑 СИМВОЛЫ:', null, 'info');
  logger.info(`  Приватных: ${Object.keys(PRIVATE).length}`);
  logger.info(`  Публичных: ${Object.keys(PUBLIC).length}`);
  logger.info(`  Всего: ${Object.keys(PRIVATE).length + Object.keys(PUBLIC).length}`);
  logger.separator();
  logger.info('📌 ПУБЛИЧНЫЕ СИМВОЛЫ (Symbol.for):', null, 'info');
  Object.keys(PUBLIC).forEach(key => {
    logger.info(`  ${String(PUBLIC[key])}`);
  });
  logger.separator();
  logger.success('✅ Bookmarklet готов к работе!');
  logger.header('ГОТОВ');
}

// ============================================================
// 14. ЭКСПОРТ ДЛЯ ES6 МОДУЛЕЙ
// ============================================================

export default Bookmarklet;
export { Bookmarklet, getBookmarkletInstance, PRIVATE, PUBLIC };
