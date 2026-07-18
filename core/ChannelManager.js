// core/ChannelManager.js - Универсальный канал связи
// ПОЛНОСТЬЮ БЕЗ ES МОДУЛЕЙ (без export/import)

(function () {
  'use strict';

  // ============================================================
  // 1. ПРИВАТНЫЕ СИМВОЛЫ
  // ============================================================

  var PRIVATE = {
    CONFIG: Symbol('channel.config'),
    LOGGER: Symbol('channel.logger'),
    STATE: Symbol('channel.state'),
    HISTORY: Symbol('channel.history'),
    HANDLERS: Symbol('channel.handlers'),
    BROADCAST: Symbol('channel.broadcast'),
  };

  // ============================================================
  // 2. КОНФИГУРАЦИЯ
  // ============================================================

  var DEFAULT_CONFIG = {
    debug: true,
    name: 'bookmarklet-channel',
    maxHistory: 100,
    timeout: 5000,
  };

  // ============================================================
  // 3. ЛОГГЕР
  // ============================================================

  function createLogger(config) {
    var logger = {
      _log: function (level, message, data, style) {
        if (!config.debug && level !== 'error') return;

        var timestamp = new Date().toISOString().slice(11, 19);
        var prefix = '[' + timestamp + '] [Channel:' + config.name + ']';

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
    return logger;
  }

  // ============================================================
  // 4. КЛАСС CHANNEL MANAGER
  // ============================================================

  function ChannelManager(options) {
    options = options || {};

    var config = {
      debug: options.debug !== undefined ? options.debug : DEFAULT_CONFIG.debug,
      name: options.name || DEFAULT_CONFIG.name,
      maxHistory: options.maxHistory || DEFAULT_CONFIG.maxHistory,
      timeout: options.timeout || DEFAULT_CONFIG.timeout,
    };

    // Приватные данные
    this[PRIVATE.CONFIG] = config;
    this[PRIVATE.LOGGER] = createLogger(config);
    this[PRIVATE.STATE] = {
      id: options.id || 'channel-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      initialized: false,
    };
    this[PRIVATE.HISTORY] = [];
    this[PRIVATE.HANDLERS] = new Map();
    this[PRIVATE.BROADCAST] = null;

    // Инициализация
    this._init();
  }

  // ============================================================
  // 5. МЕТОДЫ CHANNEL MANAGER
  // ============================================================

  ChannelManager.prototype._init = function () {
    var logger = this[PRIVATE.LOGGER];
    var config = this[PRIVATE.CONFIG];
    var state = this[PRIVATE.STATE];

    logger.info('🚀 Канал инициализирован', {
      id: state.id,
      name: config.name,
    });

    // Создаем BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        var bc = new BroadcastChannel(config.name);
        this[PRIVATE.BROADCAST] = bc;

        var self = this;
        bc.onmessage = function (event) {
          self._handleMessage(event.data, 'broadcast');
        };
        logger.success('✅ BroadcastChannel создан');
      }
    } catch (e) {
      logger.warn('⚠️ BroadcastChannel не поддерживается', e.message);
    }

    // Слушаем postMessage
    if (typeof window !== 'undefined') {
      var self = this;
      window.addEventListener('message', function (event) {
        if (event.data && event.data._channel === config.name) {
          self._handleMessage(event.data, 'postMessage');
        }
      });
      logger.success('✅ postMessage слушатель настроен');
    }

    // Слушаем CustomEvent
    if (typeof document !== 'undefined') {
      var self = this;
      document.addEventListener(config.name, function (event) {
        if (event.detail) {
          self._handleMessage(event.detail, 'customEvent');
        }
      });
      logger.success('✅ CustomEvent слушатель настроен');
    }

    state.initialized = true;

    // Глобальный доступ
    if (typeof window !== 'undefined') {
      window.__channel = this;
      window.__channelManager = this;
    }
  };

  ChannelManager.prototype._log = function (message, data, level) {
    var logger = this[PRIVATE.LOGGER];
    if (level === 'error') logger.error(message, data);
    else if (level === 'warn') logger.warn(message, data);
    else if (level === 'debug') logger.debug(message, data);
    else if (level === 'success') logger.success(message, data);
    else logger.info(message, data);
  };

  ChannelManager.prototype._handleMessage = function (data, source) {
    var logger = this[PRIVATE.LOGGER];
    var handlers = this[PRIVATE.HANDLERS];
    var history = this[PRIVATE.HISTORY];
    var config = this[PRIVATE.CONFIG];

    // Сохраняем в историю
    var entry = Object.assign({}, data, { _source: source, _received: Date.now() });
    history.push(entry);
    if (history.length > config.maxHistory) {
      history.shift();
    }

    var type = data._type || data.type || 'message';
    var typeHandlers = handlers.get(type) || [];

    logger.debug('📨 Получено сообщение [' + type + '] через ' + source, data);

    // Вызываем обработчики типа
    for (var i = 0; i < typeHandlers.length; i++) {
      try {
        typeHandlers[i](data, source);
      } catch (error) {
        logger.error('Ошибка в обработчике ' + type + ':', error.message);
      }
    }

    // Вызываем универсальные обработчики
    var allHandlers = handlers.get('*') || [];
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
    var logger = this[PRIVATE.LOGGER];
    var config = this[PRIVATE.CONFIG];
    var state = this[PRIVATE.STATE];
    var broadcast = this[PRIVATE.BROADCAST];

    var data = Object.assign({}, message, {
      _channel: config.name,
      _sender: state.id,
      _timestamp: Date.now(),
      _id: message._id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
    });

    var type = data._type || data.type || 'message';
    logger.debug('📤 Отправка сообщения [' + type + ']', data);

    // 1. Через postMessage
    if (options.postMessage !== false) {
      try {
        if (typeof window !== 'undefined') {
          window.postMessage(data, '*');
        }
      } catch (e) {
        logger.warn('⚠️ Ошибка postMessage:', e.message);
      }
    }

    // 2. Через BroadcastChannel
    if (options.broadcast !== false) {
      try {
        if (broadcast) {
          broadcast.postMessage(data);
        }
      } catch (e) {
        logger.warn('⚠️ Ошибка broadcast:', e.message);
      }
    }

    // 3. Через CustomEvent
    if (options.customEvent !== false) {
      try {
        if (typeof document !== 'undefined') {
          var event = new CustomEvent(config.name, { detail: data });
          document.dispatchEvent(event);
        }
      } catch (e) {
        logger.warn('⚠️ Ошибка customEvent:', e.message);
      }
    }

    return data._id;
  };

  ChannelManager.prototype.on = function (type, handler) {
    var handlers = this[PRIVATE.HANDLERS];
    if (!handlers.has(type)) {
      handlers.set(type, []);
    }
    handlers.get(type).push(handler);

    var logger = this[PRIVATE.LOGGER];
    logger.debug('👂 Подписка на тип: ' + type);

    var self = this;
    return function () {
      self.off(type, handler);
    };
  };

  ChannelManager.prototype.off = function (type, handler) {
    var handlers = this[PRIVATE.HANDLERS];
    if (handlers.has(type)) {
      var list = handlers.get(type);
      var index = list.indexOf(handler);
      if (index !== -1) {
        list.splice(index, 1);
        var logger = this[PRIVATE.LOGGER];
        logger.debug('👂 Отписка от типа: ' + type);
      }
      if (list.length === 0) {
        handlers.delete(type);
      }
    }
  };

  ChannelManager.prototype.request = function (message, timeout) {
    timeout = timeout || this[PRIVATE.CONFIG].timeout || 5000;
    var self = this;
    var logger = this[PRIVATE.LOGGER];

    return new Promise(function (resolve, reject) {
      var id = message._id || Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      var data = Object.assign({}, message, { _id: id, _request: true });

      var timer = setTimeout(function () {
        self.off(id, handler);
        reject(new Error('Таймаут ответа на запрос ' + id));
      }, timeout);

      var handler = function (response) {
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
        _channel: this[PRIVATE.CONFIG].name,
      })
    );
  };

  ChannelManager.prototype.getHistory = function () {
    return this[PRIVATE.HISTORY].slice();
  };

  ChannelManager.prototype.clearHistory = function () {
    this[PRIVATE.HISTORY] = [];
    var logger = this[PRIVATE.LOGGER];
    logger.info('🗑️ История очищена');
    return this;
  };

  ChannelManager.prototype.getStats = function () {
    var state = this[PRIVATE.STATE];
    var config = this[PRIVATE.CONFIG];
    var handlers = this[PRIVATE.HANDLERS];
    var history = this[PRIVATE.HISTORY];
    var broadcast = this[PRIVATE.BROADCAST];

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
    var logger = this[PRIVATE.LOGGER];
    logger.info('🗑️ Уничтожение канала');

    var broadcast = this[PRIVATE.BROADCAST];
    if (broadcast) {
      broadcast.close();
    }

    this[PRIVATE.HANDLERS].clear();
    this[PRIVATE.HISTORY] = [];

    if (typeof window !== 'undefined') {
      delete window.__channel;
      delete window.__channelManager;
    }

    logger.success('✅ Канал уничтожен');
  };

  // ============================================================
  // 6. ГЛОБАЛЬНАЯ РЕГИСТРАЦИЯ
  // ============================================================

  if (typeof window !== 'undefined') {
    window.ChannelManager = ChannelManager;

    // Создаем глобальный канал
    var defaultChannel = new ChannelManager({
      name: 'bookmarklet-channel',
      debug: true,
    });

    window.__channel = defaultChannel;
    window.__channelManager = defaultChannel;

    console.log('%c' + '═'.repeat(60), 'color: #636e72;');
    console.log(
      '%c  📦 ChannelManager загружен',
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

  // ============================================================
  // 7. НЕТ export !!!
  // ============================================================
})();
