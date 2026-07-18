javascript: (function () {
  'use strict';
  
  // ============================================================
  // ДЕБАГ-ВЕРСИЯ БУКМАРКЛЕТА
  // Сгенерировано автоматически из bookmarklet.mjs
  // Версия: 2.0.0-debug (2026-07-17)
  // ============================================================
  
  // ============================================================
  // 1. КОНФИГУРАЦИЯ ДЕБАГЕРА
  // ============================================================
  
  const DEBUG_CONFIG = {
    enabled: true,
    levels: {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4,
      VERBOSE: 5
    },
    currentLevel: 5,
    showTimestamps: true,
    showObjects: true,
    showFunctions: true,
    showStack: true,
    maxObjectDepth: 10,
    maxArrayItems: 50,
    maxStringLength: 500,
    colors: true,
    outputToConsole: true,
    outputToPanel: true,
  };
  
  // ============================================================
  // 2. ДЕБАГ-ЛОГГЕР
  // ============================================================
  
  const debug = {
    _logs: [],
    _maxLogs: 1000,
    _startTime: Date.now(),
    _indent: 0,
    
    error: function(...args) { this._log('ERROR', ...args); },
    warn: function(...args) { this._log('WARN', ...args); },
    info: function(...args) { this._log('INFO', ...args); },
    debug: function(...args) { this._log('DEBUG', ...args); },
    trace: function(...args) { this._log('TRACE', ...args); },
    verbose: function(...args) { this._log('VERBOSE', ...args); },
    success: function(...args) { this._log('INFO', '✅', ...args); },
    
    object: function(label, obj, depth = 5) {
      this._log('DEBUG', `📦 ${label}:`, obj, { depth: depth });
    },
    array: function(label, arr, maxItems = 20) {
      this._log('DEBUG', `📋 ${label}:`, arr, { maxItems: maxItems });
    },
    function: function(label, fn) {
      this._log('DEBUG', `🔧 ${label}:`, fn);
    },
    time: function(label) {
      this._log('INFO', `⏱️ ${label}: ${(Date.now() - this._startTime)}ms`);
    },
    
    group: function(label) {
      this._log('INFO', `📂 ${label}`);
      this._indent += 2;
    },
    groupEnd: function() {
      this._indent = Math.max(0, this._indent - 2);
    },
    
    _log: function(level, ...args) {
      if (!DEBUG_CONFIG.enabled) return;
      
      const levelNum = DEBUG_CONFIG.levels[level] || 0;
      if (levelNum > DEBUG_CONFIG.currentLevel) return;
      
      const timestamp = DEBUG_CONFIG.showTimestamps ? `[${new Date().toISOString().slice(11, 23)}]` : '';
      const prefix = `${timestamp} [${level}]`;
      const indent = ' '.repeat(this._indent || 0);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level,
        args: args,
        indent: this._indent || 0,
      };
      
      this._logs.push(logEntry);
      if (this._logs.length > this._maxLogs) {
        this._logs.shift();
      }
      
      if (DEBUG_CONFIG.outputToConsole) {
        const style = this._getConsoleStyle(level);
        const message = `${indent}${prefix}`;
        
        if (args.length === 1 && typeof args[0] === 'object') {
          console.log(`%c${message}`, style, args[0]);
        } else if (args.length > 0) {
          console.log(`%c${message}`, style, ...args);
        } else {
          console.log(`%c${message}`, style);
        }
      }
    },
    
    _getConsoleStyle: function(level) {
      if (!DEBUG_CONFIG.colors) return '';
      
      const styles = {
        ERROR: 'color: #ff6b6b; font-weight: bold;',
        WARN: 'color: #fdcb6e; font-weight: bold;',
        INFO: 'color: #74b9ff; font-weight: bold;',
        DEBUG: 'color: #a29bfe;',
        TRACE: 'color: #dfe6e9; font-style: italic;',
        VERBOSE: 'color: #636e72; font-size: 11px;',
      };
      
      return styles[level] || styles.INFO;
    },
    
    getLogs: function(level = null) {
      if (level) {
        return this._logs.filter(log => log.level === level);
      }
      return this._logs;
    },
    
    clear: function() {
      this._logs = [];
    },
    
    export: function() {
      return JSON.stringify(this._logs, null, 2);
    },
    
    configure: function(config) {
      Object.assign(DEBUG_CONFIG, config);
    },
    
    setLevel: function(level) {
      if (DEBUG_CONFIG.levels[level] !== undefined) {
        DEBUG_CONFIG.currentLevel = DEBUG_CONFIG.levels[level];
        this.info(`🔊 Уровень логирования установлен: ${level}`);
        return true;
      }
      this.error(`❌ Неизвестный уровень: ${level}`);
      return false;
    },
    
    getLevel: function() {
      const levels = Object.keys(DEBUG_CONFIG.levels);
      return levels.find(k => DEBUG_CONFIG.levels[k] === DEBUG_CONFIG.currentLevel) || 'UNKNOWN';
    },
    
    inspect: function(obj, label = 'Объект', depth = 5) {
      this.group(`🔍 Инспекция: ${label}`);
      this.verbose('Тип:', typeof obj);
      this.verbose('Конструктор:', obj?.constructor?.name || 'N/A');
      
      if (typeof obj === 'object' && obj !== null) {
        const keys = Object.keys(obj);
        this.verbose(`Ключи (${keys.length}):`, keys);
        
        if (depth > 0) {
          this.group('Содержимое:');
          for (const key of keys) {
            try {
              this.verbose(`  ${key}:`, obj[key]);
            } catch (e) {
              this.verbose(`  ${key}: [Ошибка доступа]`, e.message);
            }
          }
          this.groupEnd();
        }
      }
      this.groupEnd();
    },
    
    stack: function(label = 'Стек вызовов') {
      const stack = new Error().stack;
      this.debug(`📚 ${label}:`, stack);
    },
    
    measure: function(label, fn) {
      const start = performance.now();
      try {
        const result = fn();
        const elapsed = (performance.now() - start).toFixed(2);
        this.info(`⏱️ ${label}: ${elapsed}ms`);
        return result;
      } catch (error) {
        const elapsed = (performance.now() - start).toFixed(2);
        this.error(`❌ ${label}: ошибка через ${elapsed}ms`, error);
        throw error;
      }
    },
    
    memory: function() {
      if (window.performance && window.performance.memory) {
        const mem = window.performance.memory;
        this.info(`🧠 Память:`, {
          used: `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        });
      } else {
        this.warn('🧠 Информация о памяти недоступна');
      }
    },
    
    environment: function() {
      this.group('🌐 Среда выполнения');
      this.info('User Agent:', navigator.userAgent);
      this.info('Platform:', navigator.platform);
      this.info('URL:', window.location.href);
      this.info('Title:', document.title);
      this.groupEnd();
    },
    
    logs: function(level = null) {
      const logs = this.getLogs(level);
      console.table(logs.map(log => ({
        time: log.timestamp,
        level: log.level,
        message: log.args.join(' ').slice(0, 100),
      })));
      return logs;
    },
    
    globals: function() {
      this.group('🌍 Глобальные объекты');
      const globals = ['window', 'document', 'navigator', 'location', 'history', 'localStorage'];
      for (const name of globals) {
        try {
          this.verbose(`${name}:`, window[name]);
        } catch (e) {
          this.verbose(`${name}: [Ошибка доступа]`, e.message);
        }
      }
      this.groupEnd();
    }
  };
  
  // ============================================================
  // 3. ОРИГИНАЛЬНЫЙ КОД БУКМАРКЛЕТА
  // ============================================================
  
  // ПРАВИЛЬНЫЕ ПУТИ К ПАНЕЛЯМ (src/ директория)
  const PANEL_PATHS = {
    env: './Bookmarklet/src/env-panel.js',
    logs: './Bookmarklet/src/logs-panel.js',
    debug: './Bookmarklet/src/debug-panel.js',
    manager: './Bookmarklet/src/manager.html',
    main: './Bookmarklet/bookmarklet.js',
  };
  
    // packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/main:javascript/bookmarklet.mjs
  
  javascript: (function (...args) {
  
    console.log('INIT_THIS', args);
    function detectName() {
      const scripts = document.querySelectorAll('script[data-bookmarklet-name]');
      console.log('-------------------', scripts);
      for (const script of scripts) {
        if (script.dataset.bookmarkletName) {return script.dataset.bookmarkletName;}
      }
      const params = new URLSearchParams(window.location.search);
      const nameParam = params.get('name');
      if (nameParam) {return decodeURIComponent(nameParam);}
      const saved = localStorage.getItem('bookmarklet-name');
      if (saved) {return saved;}
      const title = document.title || '';
      if (title.includes('ENV') || title.includes('env')) {return 'ENV Control';}
      if (title.includes('Logs') || title.includes('logs')) {return 'Logs Control';}
      if (title.includes('Debug') || title.includes('debug')) {return 'Debug Control';}
      if (title.includes('Manager') || title.includes('manager')) {return 'Manager';}
      if (title.includes('Widget') || title.includes('widget')) {return 'Widget';}
      return 'Bookmarklet';
    }
    function detectType() {
      const scripts = document.querySelectorAll('script[src*="bookmarklet"]');
      for (const script of scripts) {
        const src = script.src || '';
        if (src.includes('logs-panel')) {return 'logs';}
        if (src.includes('debug-panel')) {return 'debug';}
        if (src.includes('env-panel')) {return 'env';}
        if (src.includes('bookmarklet.js')) {return 'main';}
      }
      return 'main';
    }
    const name = detectName();
    const type = detectType();
    console.log('----------------------++++++++++++++++++++', name, type);
    const id = 'bm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    localStorage.setItem('bookmarklet-name', name);
    const files = {
      env: './Bookmarklet/src/env-panel.js',
      logs: './Bookmarklet/src/logs-panel.js',
      debug: './Bookmarklet/src/debug-panel.js',
      main: './Bookmarklet/bookmarklet.js',
    };
    const file = files[type] || files.main;
    const s = document.createElement('script');
    s.type = 'module';
    s.src = file + '?name=' + encodeURIComponent(name) + '&id=' + id;
    s.dataset.bookmarkletName = name;
    s.dataset.bookmarkletId = id;
    s.dataset.bookmarkletType = type;
    document.head.appendChild(s);
    window.__bookmarkletInfo = { name, id, type, timestamp: Date.now() };
    console.log('📌 [' + id + '] "' + name + '" (' + type + ')');
  })();
  
  // ============================================================
  // 4. ЗАПУСК С ДЕБАГОМ
  // ============================================================
  
  debug.info('═══════════════════════════════════════════════════════════');
  debug.info('🐛 ДЕБАГ-ВЕРСИЯ БУКМАРКЛЕТА АКТИВИРОВАНА');
  debug.info('═══════════════════════════════════════════════════════════');
  debug.info('📋 Доступные команды в консоли:');
  debug.info('  __debug.logs()          - показать все логи');
  debug.info('  __debug.clear()         - очистить логи');
  debug.info('  __debug.export()        - экспортировать логи в JSON');
  debug.info('  __debug.inspect(obj)    - подробная инспекция объекта');
  debug.info('  __debug.environment()   - информация о среде');
  debug.info('  __debug.memory()        - информация о памяти');
  debug.info('  __debug.globals()       - дамп глобальных объектов');
  debug.info('  __debug.stack()         - показать стек вызовов');
  debug.info('  __debug.measure(label, fn) - замерить время выполнения');
  debug.info('  __debug.setLevel("VERBOSE") - установить уровень логирования');
  debug.info('  __debug.configure({...}) - настройка дебагера');
  debug.info('═══════════════════════════════════════════════════════════');
  
  // Сохраняем debug в глобальный объект
  window.__debug = debug;
  window.__debugConfig = DEBUG_CONFIG;
  
  // Выполняем оригинальный код с оберткой
  try {
    debug.info('🚀 Запуск оригинального кода букмарклета...');
    const result = main();
    debug.success('✅ Букмарклет выполнен успешно');
    debug.object('📊 Результат', result);
  } catch (error) {
    debug.error('❌ Ошибка выполнения букмарклета:', error);
    debug.error('  Стек:', error.stack);
  }
  
})();