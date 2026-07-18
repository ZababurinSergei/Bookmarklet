// content.js - Мост между букмарклетом и расширением
// С ВСТРОЕННЫМ CHANNEL MANAGER (без отдельного файла)
// 100% СИМВОЛОВ — полная изоляция и безопасность

// ============================================================
// 0. ПРИВАТНЫЕ СИМВОЛЫ ДЛЯ ВСЕГО МОДУЛЯ
// ============================================================

const PRIVATE = {
  // Основные символы
  CONFIG: Symbol('content.config'),
  LOGGER: Symbol('content.logger'),
  STATE: Symbol('content.state'),
  CACHE: Symbol('content.cache'),
  HANDLERS: Symbol('content.handlers'),
  INITIALIZED: Symbol('content.initialized'),
  TAB_ID: Symbol('content.tabId'),
  EXTENSION_AVAILABLE: Symbol('content.extensionAvailable'),
  CHANNEL: Symbol('content.channel'),
  CHANNEL_READY: Symbol('content.channelReady'),
  CHANNEL_PENDING: Symbol('content.channelPending'),
  WAIT_INTERVAL: Symbol('content.waitInterval'),
  IS_WAITING: Symbol('content.isWaiting'),

  // Дополнительные символы для полной изоляции
  VERSION: Symbol('content.version'),
  TIMESTAMP: Symbol('content.timestamp'),
  METADATA: Symbol('content.metadata'),
  CONTEXT: Symbol('content.context'),
  LISTENERS: Symbol('content.listeners'),
  SECURE: Symbol('content.secure'),
  VALIDATOR: Symbol('content.validator'),
  DEBUG: Symbol('content.debug'),
  LOG_HISTORY: Symbol('content.logHistory'),
  TIMERS: Symbol('content.timers'),
  RAF_ID: Symbol('content.rafId'),
  IS_DESTROYED: Symbol('content.isDestroyed'),
  SYMBOL_KEYS: Symbol('content.symbolKeys'),
};

// ============================================================
// 1. ПУБЛИЧНЫЕ СИМВОЛЫ (доступны через Symbol.for)
// ============================================================

const PUBLIC = {
  API: Symbol.for('content.api'),
  STATE: Symbol.for('content.state'),
  CONFIG: Symbol.for('content.config'),
  LOGGER: Symbol.for('content.logger'),
  CHANNEL: Symbol.for('content.channel'),
  BRIDGE: Symbol.for('content.bridge'),
  EVENTS: Symbol.for('content.events'),
  INSTANCE: Symbol.for('content.instance'),
};

// ============================================================
// 2. ВСТРОЕННЫЙ CHANNEL MANAGER (с приватными символами)
// ============================================================

(function () {
  'use strict';

  // Приватные символы для ChannelManager
  const CHANNEL_PRIVATE = {
    CONFIG: Symbol('channel.config'),
    LOGGER: Symbol('channel.logger'),
    STATE: Symbol('channel.state'),
    HISTORY: Symbol('channel.history'),
    HANDLERS: Symbol('channel.handlers'),
    BROADCAST: Symbol('channel.broadcast'),
  };

  const CHANNEL_DEFAULT_CONFIG = {
    debug: true,
    name: 'bookmarklet-channel',
    maxHistory: 100,
    timeout: 5000,
  };

  function createChannelLogger(config) {
    return {
      _log: function (level, message, data, style) {
        if (!config.debug && level !== 'error') return;
        const timestamp = new Date().toISOString().slice(11, 19);
        const prefix = '[' + timestamp + '] [Channel:' + config.name + ']';
        if (data !== null && data !== undefined) {
          console.log(prefix + ' ' + message, data);
        } else {
          console.log(prefix + ' ' + message);
        }
      },
      error: function (msg, d) {
        this._log('error', '❌ ' + msg, d);
      },
      warn: function (msg, d) {
        this._log('warn', '⚠️ ' + msg, d);
      },
      info: function (msg, d) {
        this._log('info', 'ℹ️ ' + msg, d);
      },
      debug: function (msg, d) {
        this._log('debug', '🔍 ' + msg, d);
      },
      success: function (msg, d) {
        this._log('info', '✅ ' + msg, d);
      },
    };
  }

  function ChannelManager(options) {
    options = options || {};
    const config = {
      debug: options.debug !== undefined ? options.debug : CHANNEL_DEFAULT_CONFIG.debug,
      name: options.name || CHANNEL_DEFAULT_CONFIG.name,
      maxHistory: options.maxHistory || CHANNEL_DEFAULT_CONFIG.maxHistory,
      timeout: options.timeout || CHANNEL_DEFAULT_CONFIG.timeout,
    };

    this[CHANNEL_PRIVATE.CONFIG] = config;
    this[CHANNEL_PRIVATE.LOGGER] = createChannelLogger(config);
    this[CHANNEL_PRIVATE.STATE] = {
      id: options.id || 'channel-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      initialized: false,
    };
    this[CHANNEL_PRIVATE.HISTORY] = [];
    this[CHANNEL_PRIVATE.HANDLERS] = new Map();
    this[CHANNEL_PRIVATE.BROADCAST] = null;
    this._init();
  }

  ChannelManager.prototype._init = function () {
    const logger = this[CHANNEL_PRIVATE.LOGGER];
    const config = this[CHANNEL_PRIVATE.CONFIG];
    const state = this[CHANNEL_PRIVATE.STATE];

    logger.info('🚀 Канал инициализирован', { id: state.id, name: config.name });

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(config.name);
        this[CHANNEL_PRIVATE.BROADCAST] = bc;
        const self = this;
        bc.onmessage = function (event) {
          self._handleMessage(event.data, 'broadcast');
        };
        logger.success('✅ BroadcastChannel создан');
      }
    } catch (e) {
      logger.warn('⚠️ BroadcastChannel не поддерживается', e.message);
    }

    if (typeof window !== 'undefined') {
      const self = this;
      window.addEventListener('message', function (event) {
        if (event.data && event.data._channel === config.name) {
          self._handleMessage(event.data, 'postMessage');
        }
      });
      logger.success('✅ postMessage слушатель настроен');
    }

    if (typeof document !== 'undefined') {
      const self = this;
      document.addEventListener(config.name, function (event) {
        if (event.detail) {
          self._handleMessage(event.detail, 'customEvent');
        }
      });
      logger.success('✅ CustomEvent слушатель настроен');
    }

    state.initialized = true;
    if (typeof window !== 'undefined') {
      window.__channel = this;
      window.__channelManager = this;
    }
  };

  ChannelManager.prototype._handleMessage = function (data, source) {
    const logger = this[CHANNEL_PRIVATE.LOGGER];
    const handlers = this[CHANNEL_PRIVATE.HANDLERS];
    const history = this[CHANNEL_PRIVATE.HISTORY];
    const config = this[CHANNEL_PRIVATE.CONFIG];

    const entry = Object.assign({}, data, { _source: source, _received: Date.now() });
    history.push(entry);
    if (history.length > config.maxHistory) {
      history.shift();
    }

    const type = data._type || data.type || 'message';
    const typeHandlers = handlers.get(type) || [];

    logger.debug('📨 Получено сообщение [' + type + '] через ' + source, data);

    for (var i = 0; i < typeHandlers.length; i++) {
      try {
        typeHandlers[i](data, source);
      } catch (error) {
        logger.error('Ошибка в обработчике ' + type + ':', error.message);
      }
    }

    const allHandlers = handlers.get('*') || [];
    for (var j = 0; j < allHandlers.length; j++) {
      try {
        allHandlers[j](data, source);
      } catch (error) {
        logger.error('Ошибка в универсальном обработчике:', error.message);
      }
    }
  };

  ChannelManager.prototype.send = function (message, options) {
    options = options || {};
    const logger = this[CHANNEL_PRIVATE.LOGGER];
    const config = this[CHANNEL_PRIVATE.CONFIG];
    const state = this[CHANNEL_PRIVATE.STATE];
    const broadcast = this[CHANNEL_PRIVATE.BROADCAST];

    const data = Object.assign({}, message, {
      _channel: config.name,
      _sender: state.id,
      _timestamp: Date.now(),
      _id: message._id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    });

    const type = data._type || data.type || 'message';
    logger.debug('📤 Отправка сообщения [' + type + ']', data);

    if (options.postMessage !== false) {
      try {
        if (typeof window !== 'undefined') {
          window.postMessage(data, '*');
        }
      } catch (e) {
        logger.warn('⚠️ Ошибка postMessage:', e.message);
      }
    }

    if (options.broadcast !== false) {
      try {
        if (broadcast) {
          broadcast.postMessage(data);
        }
      } catch (e) {
        logger.warn('⚠️ Ошибка broadcast:', e.message);
      }
    }

    if (options.customEvent !== false) {
      try {
        if (typeof document !== 'undefined') {
          const event = new CustomEvent(config.name, { detail: data });
          document.dispatchEvent(event);
        }
      } catch (e) {
        logger.warn('⚠️ Ошибка customEvent:', e.message);
      }
    }

    return data._id;
  };

  ChannelManager.prototype.on = function (type, handler) {
    const handlers = this[CHANNEL_PRIVATE.HANDLERS];
    if (!handlers.has(type)) {
      handlers.set(type, []);
    }
    handlers.get(type).push(handler);
    const self = this;
    return function () {
      self.off(type, handler);
    };
  };

  ChannelManager.prototype.off = function (type, handler) {
    const handlers = this[CHANNEL_PRIVATE.HANDLERS];
    if (handlers.has(type)) {
      const list = handlers.get(type);
      const index = list.indexOf(handler);
      if (index !== -1) {
        list.splice(index, 1);
      }
      if (list.length === 0) {
        handlers.delete(type);
      }
    }
  };

  ChannelManager.prototype.request = function (message, timeout) {
    timeout = timeout || this[CHANNEL_PRIVATE.CONFIG].timeout || 5000;
    const self = this;
    return new Promise(function (resolve, reject) {
      const id = message._id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      const data = Object.assign({}, message, { _id: id, _request: true });
      const timer = setTimeout(function () {
        self.off(id, handler);
        reject(new Error('Таймаут ответа на запрос ' + id));
      }, timeout);
      const handler = function (response) {
        if (response._requestId === id) {
          clearTimeout(timer);
          self.off(id, handler);
          resolve(response);
        }
      };
      self.on(id, handler);
      self.send(data);
    });
  };

  ChannelManager.prototype.respond = function (request, response) {
    this.send(
      Object.assign({}, response, {
        _type: 'response',
        _requestId: request._id || request.id,
        _channel: this[CHANNEL_PRIVATE.CONFIG].name,
      })
    );
  };

  ChannelManager.prototype.getHistory = function () {
    return this[CHANNEL_PRIVATE.HISTORY].slice();
  };

  ChannelManager.prototype.clearHistory = function () {
    this[CHANNEL_PRIVATE.HISTORY] = [];
    return this;
  };

  ChannelManager.prototype.getStats = function () {
    const state = this[CHANNEL_PRIVATE.STATE];
    const config = this[CHANNEL_PRIVATE.CONFIG];
    const handlers = this[CHANNEL_PRIVATE.HANDLERS];
    const history = this[CHANNEL_PRIVATE.HISTORY];
    const broadcast = this[CHANNEL_PRIVATE.BROADCAST];
    return {
      id: state.id,
      name: config.name,
      handlers: handlers.size,
      history: history.length,
      broadcastChannel: !!broadcast,
      debug: config.debug,
      initialized: state.initialized,
    };
  };

  ChannelManager.prototype.destroy = function () {
    const broadcast = this[CHANNEL_PRIVATE.BROADCAST];
    if (broadcast) {
      broadcast.close();
    }
    this[CHANNEL_PRIVATE.HANDLERS].clear();
    this[CHANNEL_PRIVATE.HISTORY] = [];
    if (typeof window !== 'undefined') {
      delete window.__channel;
      delete window.__channelManager;
    }
  };

  // Регистрация в глобальный объект
  if (typeof window !== 'undefined') {
    window.ChannelManager = ChannelManager;
    const defaultChannel = new ChannelManager({
      name: 'bookmarklet-channel',
      debug: true,
    });
    window.__channel = defaultChannel;
    window.__channelManager = defaultChannel;

    console.log('%c' + '═'.repeat(60), 'color: #636e72;');
    console.log(
      '%c  📦 ChannelManager загружен (встроенный, 100% символы)',
      'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;'
    );
    console.log('%c' + '═'.repeat(60), 'color: #636e72;');
    console.log('📋 Доступные команды:');
    console.log('  __channel.send({ type: "ping", data: "hello" })');
    console.log('  __channel.on("ping", function(data) { console.log(data); })');
    console.log('  __channel.request({ type: "getState" })');
    console.log('  __channel.getHistory()');
    console.log('  __channel.getStats()');
    console.log('%c' + '═'.repeat(60), 'color: #636e72;');
  }
})();

// ============================================================
// 3. КОНФИГУРАЦИЯ (через приватные символы)
// ============================================================

const CONFIG = {
  [PRIVATE.CONFIG]: {
    debug: true,
    version: '2.0.0',
    timeout: 5000,
    cacheTTL: 30000,
    channelCheckInterval: 100,
    channelCheckTimeout: 10000,
  },
};

// ============================================================
// 4. ЛОГГЕР (100% символы)
// ============================================================

const LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  namespace: 'color: #e17055; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #fdcb6e;',
  symbol: 'color: #e17055; font-weight: bold;',
  private: 'color: #fd79a8; font-weight: bold;',
};

function createLogger() {
  const logHistory = [];
  const maxHistory = 200;

  const logger = {
    [PRIVATE.LOG_HISTORY]: logHistory,

    _log: function (level, message, data, style) {
      const config = CONFIG[PRIVATE.CONFIG];
      if (!config.debug && level !== 'error') return;

      const timestamp = new Date().toISOString().slice(11, 19);
      const prefix = `%c[${timestamp}] %c[Content]`;
      const styles = [LOG_STYLES.info, LOG_STYLES.namespace];
      const colorStyle = LOG_STYLES[style || 'info'] || LOG_STYLES.info;

      logHistory.push({ timestamp, level, message, data });
      if (logHistory.length > maxHistory) {
        logHistory.shift();
      }

      if (data !== null && data !== undefined) {
        console.log(prefix + ' %c' + message, ...styles, colorStyle, data);
      } else {
        console.log(prefix + ' %c' + message, ...styles, colorStyle);
      }
    },

    error: function (msg, d) {
      this._log('error', `❌ ${msg}`, d, 'error');
    },
    warn: function (msg, d) {
      this._log('warn', `⚠️ ${msg}`, d, 'warn');
    },
    info: function (msg, d) {
      this._log('info', `ℹ️ ${msg}`, d, 'info');
    },
    debug: function (msg, d) {
      this._log('debug', `🔍 ${msg}`, d, 'debug');
    },
    success: function (msg, d) {
      this._log('info', `✅ ${msg}`, d, 'success');
    },

    header: function (title) {
      console.log('%c' + '═'.repeat(60), LOG_STYLES.separator);
      console.log('%c  🔌 ' + title, LOG_STYLES.header);
      console.log('%c' + '═'.repeat(60), LOG_STYLES.separator);
    },

    separator: function () {
      console.log('%c' + '─'.repeat(60), LOG_STYLES.separator);
    },

    symbol: function (name, symbol) {
      console.log(`%c  🔑 ${name}: ${String(symbol)}`, LOG_STYLES.symbol);
    },

    private: function (name, symbol) {
      console.log(`%c  🔒 ${name}: ${String(symbol)}`, LOG_STYLES.private);
    },

    getHistory: function () {
      return [...logHistory];
    },
    clearHistory: function () {
      logHistory.length = 0;
      return this;
    },
  };

  return logger;
}

// ============================================================
// 5. СОСТОЯНИЕ (через приватные символы)
// ============================================================

const state = {
  [PRIVATE.CONFIG]: CONFIG[PRIVATE.CONFIG],
  [PRIVATE.LOGGER]: null,
  [PRIVATE.CACHE]: new Map(),
  [PRIVATE.HANDLERS]: new Map(),
  [PRIVATE.INITIALIZED]: false,
  [PRIVATE.TAB_ID]: null,
  [PRIVATE.EXTENSION_AVAILABLE]: false,
  [PRIVATE.CHANNEL]: null,
  [PRIVATE.CHANNEL_READY]: false,
  [PRIVATE.CHANNEL_PENDING]: false,
  [PRIVATE.WAIT_INTERVAL]: null,
  [PRIVATE.IS_WAITING]: false,
  [PRIVATE.IS_DESTROYED]: false,
  [PRIVATE.VERSION]: '2.0.0',
  [PRIVATE.TIMESTAMP]: Date.now(),
  [PRIVATE.METADATA]: {
    created: Date.now(),
    lastAccess: Date.now(),
    lastUpdate: Date.now(),
    runCount: 0,
    errorCount: 0,
  },
  [PRIVATE.CONTEXT]: {
    url: typeof window !== 'undefined' ? window.location.href : '',
    title: typeof window !== 'undefined' ? document.title : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  },
  [PRIVATE.LISTENERS]: [],
  [PRIVATE.TIMERS]: new Map(),
  [PRIVATE.RAF_ID]: null,
  [PRIVATE.SYMBOL_KEYS]: null,
};

state[PRIVATE.LOGGER] = createLogger();
const logger = state[PRIVATE.LOGGER];

// ============================================================
// 6. ВАЛИДАТОР (через приватные символы)
// ============================================================

const VALIDATOR = {
  [PRIVATE.VALIDATOR]: {
    isValidId: id => id && typeof id === 'string' && id.length > 0,
    isValidName: name => name && typeof name === 'string' && name.length > 0,
    isValidType: type => ['main', 'env', 'logs', 'debug', 'widget'].includes(type),
    isValidConfig: config => config && typeof config === 'object',
    isValidCallback: fn => typeof fn === 'function',
    isValidUrl: url => url && typeof url === 'string' && url.length > 0,
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
// 7. КЕШИРОВАНИЕ (через приватные символы)
// ============================================================

function getCachedData(key) {
  const cache = state[PRIVATE.CACHE];
  if (cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.timestamp < CONFIG[PRIVATE.CONFIG].cacheTTL) {
      return entry.data;
    }
    cache.delete(key);
  }
  return null;
}

function setCachedData(key, data) {
  state[PRIVATE.CACHE].set(key, {
    data: data,
    timestamp: Date.now(),
  });
}

function clearCache() {
  const size = state[PRIVATE.CACHE].size;
  state[PRIVATE.CACHE].clear();
  logger.info(`🗑️ Кеш очищен (${size} записей)`);
  return size;
}

// ============================================================
// 8. ПРОВЕРКА РАСШИРЕНИЯ (без tabId)
// ============================================================

function checkExtensionAvailable() {
  try {
    state[PRIVATE.EXTENSION_AVAILABLE] = !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    state[PRIVATE.EXTENSION_AVAILABLE] = false;
  }
  return state[PRIVATE.EXTENSION_AVAILABLE];
}

// ============================================================
// 9. СОЗДАНИЕ КАНАЛА (через приватные символы)
// ============================================================

function createChannel() {
  if (typeof window.ChannelManager === 'undefined') {
    logger.warn('⚠️ ChannelManager не найден');
    return null;
  }

  try {
    const channel = new window.ChannelManager({
      name: 'bookmarklet-channel',
      debug: CONFIG[PRIVATE.CONFIG].debug,
    });
    state[PRIVATE.CHANNEL] = channel;
    state[PRIVATE.CHANNEL_READY] = true;
    state[PRIVATE.CHANNEL_PENDING] = false;
    state[PRIVATE.IS_WAITING] = false;
    logger.success('✅ Универсальный канал создан');
    return channel;
  } catch (error) {
    logger.error('❌ Ошибка создания канала:', error.message);
    return null;
  }
}

// ============================================================
// 10. ИНИЦИАЛИЗАЦИЯ КАНАЛА (через приватные символы)
// ============================================================

function initChannel() {
  if (state[PRIVATE.CHANNEL_READY]) {
    logger.info('ℹ️ Канал уже инициализирован');
    return true;
  }

  if (typeof window.ChannelManager === 'undefined') {
    logger.warn('⚠️ ChannelManager не загружен');
    return false;
  }

  logger.info('🔧 Инициализация канала...');

  const channel = createChannel();
  if (channel) {
    setupChannelHandlers(channel);

    channel.send({
      _type: 'content:ready',
      data: {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
        channelType: 'full',
        version: state[PRIVATE.VERSION],
      },
    });

    logger.success('✅ Канал инициализирован');

    // Обновляем bridge с публичными символами
    if (window.__bookmarkBridge) {
      updateBridgeAPI();
    }

    return true;
  }

  return false;
}

// ============================================================
// 11. ОБРАБОТЧИКИ КАНАЛА (через приватные символы)
// ============================================================

function setupChannelHandlers(channel) {
  if (!channel) return;

  channel.on('*', function (data, source) {
    logger.debug('📨 [' + source + '] Получено:', data);
  });

  channel.on('content:getBookmark', function (data) {
    logger.info('📑 Запрос данных закладки:', data);

    const url = data.url || window.location.href;
    // 🔧 tabId не используется — обработчик отсутствует в background
    const tabId = null;

    const cacheKey = url; // без tabId
    const cached = getCachedData(cacheKey);
    if (cached) {
      channel.respond(data, {
        success: true,
        data: cached,
        fromCache: true,
      });
      return;
    }

    getBookmarkDataFromBackground(url)
      .then(function (response) {
        if (response && response.title) {
          setCachedData(cacheKey, response);
          channel.respond(data, {
            success: true,
            data: response,
            fromCache: false,
          });
        } else {
          channel.respond(data, {
            success: false,
            error: 'Закладка не найдена',
          });
        }
      })
      .catch(function (error) {
        channel.respond(data, {
          success: false,
          error: error.message,
        });
      });
  });

  channel.on('content:ping', function (data) {
    channel.respond(data, {
      success: true,
      data: {
        status: 'ok',
        timestamp: Date.now(),
        extensionAvailable: state[PRIVATE.EXTENSION_AVAILABLE],
        version: state[PRIVATE.VERSION],
      },
    });
  });

  logger.success('✅ Обработчики канала настроены');
}

// ============================================================
// 12. ПОЛУЧЕНИЕ ДАННЫХ ИЗ BACKGROUND (без tabId)
// ============================================================

function getBookmarkDataFromBackground(url) {
  return new Promise(function (resolve, reject) {
    if (!state[PRIVATE.EXTENSION_AVAILABLE]) {
      reject(new Error('Расширение недоступно'));
      return;
    }

    logger.debug('📤 Запрос данных для: ' + url);

    const timeout = setTimeout(function () {
      reject(new Error('Таймаут ожидания ответа от background'));
    }, CONFIG[PRIVATE.CONFIG].timeout);

    try {
      chrome.runtime.sendMessage(
        {
          action: 'find_bookmark_by_url',
          url: url,
          timestamp: Date.now(),
          source: 'content_script',
        },
        function (response) {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            logger.error('Ошибка background:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          logger.debug('📥 Ответ от background:', response);
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
// 13. ЗАПРОС ДАННЫХ (через приватные символы)
// ============================================================

function requestBookmarkData(url) {
  const targetUrl = url || window.location.href;
  const channel = state[PRIVATE.CHANNEL];

  logger.info('📡 Запрос данных для: ' + targetUrl);

  if (channel) {
    return channel.request({
      _type: 'content:getBookmark',
      url: targetUrl,
    });
  }

  logger.error('❌ Канал не инициализирован');
  return Promise.reject(new Error('Канал не инициализирован'));
}

// ============================================================
// 14. СОСТОЯНИЕ BRIDGE (через приватные символы)
// ============================================================

function getBridgeState() {
  return {
    initialized: state[PRIVATE.INITIALIZED],
    extensionAvailable: state[PRIVATE.EXTENSION_AVAILABLE],
    cacheSize: state[PRIVATE.CACHE].size,
    channelReady: state[PRIVATE.CHANNEL_READY],
    hasChannel: !!state[PRIVATE.CHANNEL],
    channelPending: state[PRIVATE.CHANNEL_PENDING],
    isWaiting: state[PRIVATE.IS_WAITING],
    version: state[PRIVATE.VERSION],
    metadata: { ...state[PRIVATE.METADATA] },
    context: { ...state[PRIVATE.CONTEXT] },
    destroyed: state[PRIVATE.IS_DESTROYED],
  };
}

function checkExtension() {
  const available = checkExtensionAvailable();
  logger.info('📌 Расширение: ' + (available ? '✅ доступно' : '❌ недоступно'));
  return available;
}

function getChannel() {
  return state[PRIVATE.CHANNEL];
}

function isChannelReady() {
  return state[PRIVATE.CHANNEL_READY];
}

// ============================================================
// 15. ОБНОВЛЕНИЕ BRIDGE API (через публичные символы)
// ============================================================

function updateBridgeAPI() {
  if (!window.__bookmarkBridge) return;

  // Экспортируем через публичные символы
  window[PUBLIC.API] = requestBookmarkData;
  window[PUBLIC.STATE] = getBridgeState;
  window[PUBLIC.CONFIG] = CONFIG[PRIVATE.CONFIG];
  window[PUBLIC.LOGGER] = logger;
  window[PUBLIC.CHANNEL] = state[PRIVATE.CHANNEL];
  window[PUBLIC.BRIDGE] = window.__bookmarkBridge;
  window[PUBLIC.INSTANCE] = {
    requestBookmarkData,
    clearCache,
    checkExtension,
    getChannel,
    isChannelReady,
    initChannel,
    getState: getBridgeState,
    getSymbols: getSymbols,
  };

  // Обновляем __bookmarkBridge
  window.__bookmarkBridge.requestBookmarkData = requestBookmarkData;
  window.__bookmarkBridge.clearCache = clearCache;
  window.__bookmarkBridge.checkExtension = checkExtension;
  window.__bookmarkBridge.isAvailable = function () {
    return state[PRIVATE.EXTENSION_AVAILABLE];
  };
  window.__bookmarkBridge.getChannel = getChannel;
  window.__bookmarkBridge.isChannelReady = isChannelReady;
  window.__bookmarkBridge.initChannel = initChannel;
  window.__bookmarkBridge.getState = getBridgeState;
  window.__bookmarkBridge.getSymbols = getSymbols;
  window.__bookmarkBridge._isReady = true;
  window.__bookmarkBridge._version = state[PRIVATE.VERSION];

  logger.success('✅ __bookmarkBridge обновлен (100% символы)');
}

// ============================================================
// 16. ПОЛУЧЕНИЕ СИМВОЛОВ (через приватные символы)
// ============================================================

function getSymbols() {
  return {
    PRIVATE: {
      CONFIG: PRIVATE.CONFIG,
      LOGGER: PRIVATE.LOGGER,
      STATE: PRIVATE.STATE,
      CACHE: PRIVATE.CACHE,
      HANDLERS: PRIVATE.HANDLERS,
      INITIALIZED: PRIVATE.INITIALIZED,
      TAB_ID: PRIVATE.TAB_ID,
      EXTENSION_AVAILABLE: PRIVATE.EXTENSION_AVAILABLE,
      CHANNEL: PRIVATE.CHANNEL,
      CHANNEL_READY: PRIVATE.CHANNEL_READY,
      CHANNEL_PENDING: PRIVATE.CHANNEL_PENDING,
      WAIT_INTERVAL: PRIVATE.WAIT_INTERVAL,
      IS_WAITING: PRIVATE.IS_WAITING,
      VERSION: PRIVATE.VERSION,
      TIMESTAMP: PRIVATE.TIMESTAMP,
      METADATA: PRIVATE.METADATA,
      CONTEXT: PRIVATE.CONTEXT,
      LISTENERS: PRIVATE.LISTENERS,
      SECURE: PRIVATE.SECURE,
      VALIDATOR: PRIVATE.VALIDATOR,
      DEBUG: PRIVATE.DEBUG,
      LOG_HISTORY: PRIVATE.LOG_HISTORY,
      TIMERS: PRIVATE.TIMERS,
      RAF_ID: PRIVATE.RAF_ID,
      IS_DESTROYED: PRIVATE.IS_DESTROYED,
      SYMBOL_KEYS: PRIVATE.SYMBOL_KEYS,
    },
    PUBLIC: {
      API: PUBLIC.API,
      STATE: PUBLIC.STATE,
      CONFIG: PUBLIC.CONFIG,
      LOGGER: PUBLIC.LOGGER,
      CHANNEL: PUBLIC.CHANNEL,
      BRIDGE: PUBLIC.BRIDGE,
      EVENTS: PUBLIC.EVENTS,
      INSTANCE: PUBLIC.INSTANCE,
    },
    CONFIG: CONFIG[PRIVATE.CONFIG],
    state: getBridgeState(),
  };
}

// ============================================================
// 17. ИНИЦИАЛИЗАЦИЯ CONTENT SCRIPT (БЕЗ TAB ID)
// ============================================================

function initContentScript() {
  logger.header('ЗАГРУЗКА CONTENT SCRIPT (100% СИМВОЛЫ)');
  logger.info('📦 Версия: ' + state[PRIVATE.VERSION]);
  logger.info('📅 Запуск: ' + new Date(state[PRIVATE.TIMESTAMP]).toISOString());

  // Проверяем расширение
  checkExtensionAvailable();
  logger.info(
    '📌 Расширение: ' + (state[PRIVATE.EXTENSION_AVAILABLE] ? '✅ доступно' : '❌ недоступно')
  );

  // 🔧 ВРЕМЕННО ОТКЛЮЧЕНО: получение tabId через background (обработчик отсутствует)
  // initTabId() больше не вызывается
  logger.info('📌 Tab ID: не требуется (получение отключено)');

  // ChannelManager уже встроен, сразу инициализируем
  if (typeof window.ChannelManager !== 'undefined') {
    initChannel();
  } else {
    logger.error('❌ ChannelManager не загружен (ошибка встроенного кода)');
  }

  // Обновляем bridge
  if (window.__bookmarkBridge) {
    updateBridgeAPI();
  }

  // Создаём bridge если его нет
  if (!window.__bookmarkBridge) {
    window.__bookmarkBridge = {
      requestBookmarkData: requestBookmarkData,
      clearCache: clearCache,
      checkExtension: checkExtension,
      getChannel: getChannel,
      isChannelReady: isChannelReady,
      initChannel: initChannel,
      getState: getBridgeState,
      getSymbols: getSymbols,
      _isReady: true,
      _version: state[PRIVATE.VERSION],
    };
    logger.success('✅ __bookmarkBridge создан');
  }

  state[PRIVATE.INITIALIZED] = true;
  state[PRIVATE.METADATA].lastUpdate = Date.now();

  logger.separator();
  logger.info('📋 ДОСТУПНЫЕ КОМАНДЫ (через __bookmarkBridge):');
  logger.info('  requestBookmarkData()  - запросить данные закладки');
  logger.info('  clearCache()           - очистить кеш');
  logger.info('  checkExtension()       - проверить статус расширения');
  logger.info('  getChannel()           - получить канал связи');
  logger.info('  isChannelReady()       - проверить готовность канала');
  logger.info('  initChannel()          - инициализировать канал');
  logger.info('  getState()             - получить состояние');
  logger.info('  getSymbols()           - получить все символы');
  logger.separator();

  logger.info('🔑 ПРИВАТНЫЕ СИМВОЛЫ (' + Object.keys(PRIVATE).length + '):');
  Object.keys(PRIVATE).forEach(key => {
    logger.private(key, PRIVATE[key]);
  });

  logger.separator();

  logger.info('🔓 ПУБЛИЧНЫЕ СИМВОЛЫ (' + Object.keys(PUBLIC).length + '):');
  Object.keys(PUBLIC).forEach(key => {
    logger.symbol(key, PUBLIC[key]);
  });

  logger.separator();

  // Экспортируем через публичные символы
  if (typeof window !== 'undefined') {
    window[PUBLIC.API] = requestBookmarkData;
    window[PUBLIC.STATE] = getBridgeState;
    window[PUBLIC.CONFIG] = CONFIG[PRIVATE.CONFIG];
    window[PUBLIC.LOGGER] = logger;
    window[PUBLIC.CHANNEL] = state[PRIVATE.CHANNEL];
    window[PUBLIC.BRIDGE] = window.__bookmarkBridge;
    window[PUBLIC.INSTANCE] = {
      requestBookmarkData,
      clearCache,
      checkExtension,
      getChannel,
      isChannelReady,
      initChannel,
      getState: getBridgeState,
      getSymbols,
    };
    window.__contentInstance = window[PUBLIC.INSTANCE];
  }

  logger.success('✅ Content Script инициализирован (100% символы)');
  logger.header('ГОТОВ');
}

// ============================================================
// 18. УНИЧТОЖЕНИЕ (через приватные символы)
// ============================================================

function destroy() {
  if (state[PRIVATE.IS_DESTROYED]) {
    logger.warn('⚠️ Content Script уже уничтожен');
    return;
  }

  logger.header('УНИЧТОЖЕНИЕ CONTENT SCRIPT');

  // Очищаем таймеры
  const timers = state[PRIVATE.TIMERS];
  for (const [key, timer] of timers) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  timers.clear();

  // Отменяем RAF
  if (state[PRIVATE.RAF_ID]) {
    cancelAnimationFrame(state[PRIVATE.RAF_ID]);
    state[PRIVATE.RAF_ID] = null;
  }

  // Закрываем канал
  if (state[PRIVATE.CHANNEL]) {
    state[PRIVATE.CHANNEL].destroy();
    state[PRIVATE.CHANNEL] = null;
    state[PRIVATE.CHANNEL_READY] = false;
  }

  // Очищаем кеш
  state[PRIVATE.CACHE].clear();

  // Удаляем глобальные ссылки
  if (typeof window !== 'undefined') {
    delete window[PUBLIC.API];
    delete window[PUBLIC.STATE];
    delete window[PUBLIC.CONFIG];
    delete window[PUBLIC.LOGGER];
    delete window[PUBLIC.CHANNEL];
    delete window[PUBLIC.BRIDGE];
    delete window[PUBLIC.INSTANCE];
    delete window.__contentInstance;
  }

  state[PRIVATE.IS_DESTROYED] = true;
  state[PRIVATE.INITIALIZED] = false;

  logger.success('✅ Content Script уничтожен');
  logger.header('ГОТОВ');
}

// ============================================================
// 19. ЗАПУСК (через приватные символы)
// ============================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  Promise.resolve().then(initContentScript);
}

// ============================================================
// 20. ЭКСПОРТ (через публичные символы) — БЕЗ export
// ============================================================

if (typeof window !== 'undefined') {
  window[PUBLIC.API] = requestBookmarkData;
  window[PUBLIC.STATE] = getBridgeState;
  window[PUBLIC.CONFIG] = CONFIG[PRIVATE.CONFIG];
  window[PUBLIC.LOGGER] = logger;
  window[PUBLIC.CHANNEL] = state[PRIVATE.CHANNEL];
  window[PUBLIC.BRIDGE] = window.__bookmarkBridge || {};
  window[PUBLIC.INSTANCE] = {
    requestBookmarkData,
    clearCache,
    checkExtension,
    getChannel,
    isChannelReady,
    initChannel,
    getState: getBridgeState,
    getSymbols,
    destroy,
  };
  window.__contentInstance = window[PUBLIC.INSTANCE];
}

console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
console.log('║                    📦 CONTENT SCRIPT (100% СИМВОЛЫ)                         ║');
console.log('╠═══════════════════════════════════════════════════════════════════════════════╣');
console.log('║  📋 Все логи выводятся в консоль с цветовой разметкой                       ║');
console.log('║  🔑 Полная изоляция через приватные символы                                 ║');
console.log('║  🔓 Публичные символы через Symbol.for                                      ║');
console.log('║  📌 Tab ID не используется (обработчик отсутствует в background)            ║');
console.log('║  📌 Кеширование работает без tabId                                          ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');

// ============================================================
// 21. ЭКСПОРТ ДЛЯ ОТЛАДКИ — БЕЗ export (только глобальные объекты)
// ============================================================

// Экспортируем через window для отладки
window.__contentAPI = {
  requestBookmarkData,
  clearCache,
  checkExtension,
  getChannel,
  isChannelReady,
  initChannel,
  getState: getBridgeState,
  getSymbols,
  destroy,
  // События
  on: function (event, callback) {
    if (!state[PRIVATE.HANDLERS].has(event)) {
      state[PRIVATE.HANDLERS].set(event, []);
    }
    state[PRIVATE.HANDLERS].get(event).push(callback);
    return () => this.off(event, callback);
  },
  off: function (event, callback) {
    if (state[PRIVATE.HANDLERS].has(event)) {
      const handlers = state[PRIVATE.HANDLERS].get(event);
      const index = handlers.indexOf(callback);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        state[PRIVATE.HANDLERS].delete(event);
      }
    }
  },
  emit: function (event, data) {
    if (state[PRIVATE.HANDLERS].has(event)) {
      const handlers = state[PRIVATE.HANDLERS].get(event);
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          logger.error(`Ошибка в обработчике ${event}:`, error.message);
        }
      }
    }
  },
  // Публичные символы
  PUBLIC_SYMBOLS: PUBLIC,
  PRIVATE_SYMBOLS: PRIVATE,
  getConfig: () => CONFIG[PRIVATE.CONFIG],
  getLogger: () => logger,
  getChannel: getChannel,
  isReady: () => state[PRIVATE.INITIALIZED] && !state[PRIVATE.IS_DESTROYED],
};

// Также экспортируем через публичные символы
window[PUBLIC.API] = requestBookmarkData;
window[PUBLIC.STATE] = getBridgeState;
window[PUBLIC.CONFIG] = CONFIG[PRIVATE.CONFIG];
window[PUBLIC.LOGGER] = logger;
window[PUBLIC.CHANNEL] = state[PRIVATE.CHANNEL];
window[PUBLIC.BRIDGE] = window.__bookmarkBridge || {};
window[PUBLIC.INSTANCE] = window.__contentAPI;

console.log('✅ Content script полностью загружен (100% символы)');
console.log('📋 Доступно: window.__contentAPI');
console.log('📋 Публичные символы: window[Symbol.for("content.api")]');
