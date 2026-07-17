// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/main:javascript/default.mjs

import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { SourceMapConsumer } from 'source-map';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// ВЕРСИЯ
// ============================================================

const VERSION = '5.3.0';
const VERSION_DATE = '2026-07-17';

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

const SOURCE_FILE = path.join(__dirname, 'bookmarklet.mjs');
const OUTPUT_DIR = path.join(__dirname, 'bookmarklet');
const MINIFIED_FILE = path.join(OUTPUT_DIR, 'bookmarklet.min.mjs');
const MINIFIED_MAP_FILE = path.join(OUTPUT_DIR, 'bookmarklet.min.mjs.map');
const RECOVERY_FILE = path.join(OUTPUT_DIR, 'bookmarklet.recovery.mjs');
const DEBUG_FILE = path.join(OUTPUT_DIR, 'bookmarklet-debug.mjs');
const DEBUG_MIN_FILE = path.join(OUTPUT_DIR, 'bookmarklet-debug.min.mjs');
const EXTENSION_FILE = path.join(OUTPUT_DIR, 'bookmarklet-extension.mjs');
const EXTENSION_MIN_FILE = path.join(OUTPUT_DIR, 'bookmarklet-extension.min.mjs');

// ПРАВИЛЬНЫЕ ПУТИ К ПАНЕЛЯМ (относительно корня сайта)
const PANEL_PATHS = {
  env: './Bookmarklet/src/env-panel.js',
  logs: './Bookmarklet/src/logs-panel.js',
  debug: './Bookmarklet/src/debug-panel.js',
  manager: './Bookmarklet/src/manager.html',
  main: './Bookmarklet/bookmarklet.js',
};

// Создаем выходную директорию
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================================
// ШАБЛОНЫ ДЛЯ ГЕНЕРАЦИИ
// ============================================================

function generateDebugVersion(originalCode) {
  const cleanCode = originalCode.replace(/^javascript:\s*/i, '').trim();

  return `javascript: (function () {
  'use strict';
  
  // ============================================================
  // ДЕБАГ-ВЕРСИЯ БУКМАРКЛЕТА
  // Сгенерировано автоматически из bookmarklet.mjs
  // Версия: 2.0.0-debug (${VERSION_DATE})
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
      this._log('DEBUG', \`📦 \${label}:\`, obj, { depth: depth });
    },
    array: function(label, arr, maxItems = 20) {
      this._log('DEBUG', \`📋 \${label}:\`, arr, { maxItems: maxItems });
    },
    function: function(label, fn) {
      this._log('DEBUG', \`🔧 \${label}:\`, fn);
    },
    time: function(label) {
      this._log('INFO', \`⏱️ \${label}: \${(Date.now() - this._startTime)}ms\`);
    },
    
    group: function(label) {
      this._log('INFO', \`📂 \${label}\`);
      this._indent += 2;
    },
    groupEnd: function() {
      this._indent = Math.max(0, this._indent - 2);
    },
    
    _log: function(level, ...args) {
      if (!DEBUG_CONFIG.enabled) return;
      
      const levelNum = DEBUG_CONFIG.levels[level] || 0;
      if (levelNum > DEBUG_CONFIG.currentLevel) return;
      
      const timestamp = DEBUG_CONFIG.showTimestamps ? \`[\${new Date().toISOString().slice(11, 23)}]\` : '';
      const prefix = \`\${timestamp} [\${level}]\`;
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
        const message = \`\${indent}\${prefix}\`;
        
        if (args.length === 1 && typeof args[0] === 'object') {
          console.log(\`%c\${message}\`, style, args[0]);
        } else if (args.length > 0) {
          console.log(\`%c\${message}\`, style, ...args);
        } else {
          console.log(\`%c\${message}\`, style);
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
        this.info(\`🔊 Уровень логирования установлен: \${level}\`);
        return true;
      }
      this.error(\`❌ Неизвестный уровень: \${level}\`);
      return false;
    },
    
    getLevel: function() {
      const levels = Object.keys(DEBUG_CONFIG.levels);
      return levels.find(k => DEBUG_CONFIG.levels[k] === DEBUG_CONFIG.currentLevel) || 'UNKNOWN';
    },
    
    inspect: function(obj, label = 'Объект', depth = 5) {
      this.group(\`🔍 Инспекция: \${label}\`);
      this.verbose('Тип:', typeof obj);
      this.verbose('Конструктор:', obj?.constructor?.name || 'N/A');
      
      if (typeof obj === 'object' && obj !== null) {
        const keys = Object.keys(obj);
        this.verbose(\`Ключи (\${keys.length}):\`, keys);
        
        if (depth > 0) {
          this.group('Содержимое:');
          for (const key of keys) {
            try {
              this.verbose(\`  \${key}:\`, obj[key]);
            } catch (e) {
              this.verbose(\`  \${key}: [Ошибка доступа]\`, e.message);
            }
          }
          this.groupEnd();
        }
      }
      this.groupEnd();
    },
    
    stack: function(label = 'Стек вызовов') {
      const stack = new Error().stack;
      this.debug(\`📚 \${label}:\`, stack);
    },
    
    measure: function(label, fn) {
      const start = performance.now();
      try {
        const result = fn();
        const elapsed = (performance.now() - start).toFixed(2);
        this.info(\`⏱️ \${label}: \${elapsed}ms\`);
        return result;
      } catch (error) {
        const elapsed = (performance.now() - start).toFixed(2);
        this.error(\`❌ \${label}: ошибка через \${elapsed}ms\`, error);
        throw error;
      }
    },
    
    memory: function() {
      if (window.performance && window.performance.memory) {
        const mem = window.performance.memory;
        this.info(\`🧠 Память:\`, {
          used: \`\${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\`,
          total: \`\${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB\`,
          limit: \`\${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\`,
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
          this.verbose(\`\${name}:\`, window[name]);
        } catch (e) {
          this.verbose(\`\${name}: [Ошибка доступа]\`, e.message);
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
  
  ${cleanCode
    .split('\n')
    .map(line => '  ' + line)
    .join('\n')}
  
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
  
})();`;
}

function generateExtensionVersion(originalCode) {
  const cleanCode = originalCode.replace(/^javascript:\s*/i, '').trim();

  return `javascript: (function(){
  'use strict';
  
  // ============================================================
  // БУКМАРКЛЕТ С ПОДДЕРЖКОЙ РАСШИРЕНИЯ
  // Сгенерировано автоматически из bookmarklet.mjs
  // Версия: 2.0.0-extension (${VERSION_DATE})
  // ============================================================
  
  // ============================================================
  // 1. КОНФИГУРАЦИЯ
  // ============================================================
  
  const CONFIG = {
    debug: true,
    timeout: 5000,
    source: 'my-bookmarklet',
    extensionSource: 'my-extension-bridge',
    responseType: 'BOOKMARK_DATA_RESPONSE'
  };
  
  // ============================================================
  // 2. ЛОГГЕР
  // ============================================================
  
  const logger = {
    log: function(level, message, data) {
      if (!CONFIG.debug && level !== 'error') return;
      const prefix = '[Bookmarklet]';
      switch(level) {
        case 'error': console.error(\`\${prefix} ❌ \${message}\`, data || ''); break;
        case 'warn':  console.warn(\`\${prefix} ⚠️ \${message}\`, data || ''); break;
        case 'debug': console.log(\`\${prefix} 🔍 \${message}\`, data || ''); break;
        default:      console.log(\`\${prefix} ℹ️ \${message}\`, data || '');
      }
    },
    error: function(msg, d) { this.log('error', msg, d); },
    warn: function(msg, d) { this.log('warn', msg, d); },
    info: function(msg, d) { this.log('info', msg, d); },
    debug: function(msg, d) { this.log('debug', msg, d); }
  };
  
  // ============================================================
  // 3. ПОЛУЧЕНИЕ ДАННЫХ ОТ РАСШИРЕНИЯ
  // ============================================================
  
  function getBookmarkData() {
    return new Promise((resolve, reject) => {
      logger.info('Запрос данных от расширения...');
      
      function handleResponse(event) {
        if (event.data && 
            event.data.source === CONFIG.extensionSource && 
            event.data.type === CONFIG.responseType) {
          
          const bookmark = event.data.payload;
          logger.info('Получены данные:', bookmark);
          
          window.removeEventListener('message', handleResponse);
          clearTimeout(timeoutId);
          resolve(bookmark);
        }
      }
      
      window.addEventListener('message', handleResponse);
      
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handleResponse);
        logger.warn('Таймаут ожидания ответа от расширения');
        reject(new Error('Таймаут: расширение не ответило'));
      }, CONFIG.timeout);
      
      window.postMessage({ 
        source: CONFIG.source, 
        type: 'REQUEST_BOOKMARK_DATA',
        currentUrl: window.location.href 
      }, '*');
      
      logger.debug('Запрос отправлен');
    });
  }
  
  // ============================================================
  // 4. ОСНОВНАЯ ФУНКЦИЯ С ИНТЕГРАЦИЕЙ
  // ============================================================
  
  async function mainWithExtension() {
    console.log('═'.repeat(60));
    console.log('📦 БУКМАРКЛЕТ С РАСШИРЕНИЕМ v2.0');
    console.log('═'.repeat(60));
    
    try {
      const bookmark = await getBookmarkData();
      
      console.log('═══════════════════════════════════════════════════════════');
      console.log(\`📌 ЗАКЛАДКА: \${bookmark.title}\`);
      console.log(\`📌 ТИП: \${bookmark.type || 'unknown'}\`);
      console.log(\`📌 ID: \${bookmark.id || 'нет'}\`);
      console.log(\`📌 ВЕРСИЯ: \${bookmark.version || '1.0.0'}\`);
      console.log(\`📌 РОДИТЕЛЬ: \${bookmark.parent?.title || 'корень'}\`);
      console.log(\`📌 СОСЕДЕЙ: \${bookmark.siblings?.length || 0}\`);
      console.log('═══════════════════════════════════════════════════════════');
      
      if (bookmark.customConfig && Object.keys(bookmark.customConfig).length > 0) {
        console.log('🔧 КАСТОМНЫЕ НАСТРОЙКИ:');
        console.table(bookmark.customConfig);
      }
      
      if (bookmark.features && bookmark.features.length > 0) {
        console.log(\`✨ ДОСТУПНЫЕ ФУНКЦИИ: \${bookmark.features.join(', ')}\`);
      }
      
      window.__bookmarkData = bookmark;
      
      // ============================================================
      // 5. ОРИГИНАЛЬНЫЙ КОД БУКМАРКЛЕТА
      // ============================================================
      
      // ПРАВИЛЬНЫЕ ПУТИ К ПАНЕЛЯМ (src/ директория)
      const PANEL_PATHS = {
        env: './Bookmarklet/src/env-panel.js',
        logs: './Bookmarklet/src/logs-panel.js',
        debug: './Bookmarklet/src/debug-panel.js',
        manager: './Bookmarklet/src/manager.html',
        main: './Bookmarklet/bookmarklet.js',
      };
      
      ${cleanCode
        .split('\n')
        .map(line => '      ' + line)
        .join('\n')}
      
      console.log('═'.repeat(60));
      console.log('✅ Готово! Данные доступны в window.__bookmarkData');
      
    } catch (error) {
      logger.error('Ошибка:', error.message);
      
      console.log('⚠️ Используем fallback (без расширения)...');
      
      ${cleanCode
        .split('\n')
        .map(line => '      ' + line)
        .join('\n')}
    }
  }
  
  // ============================================================
  // 6. ЗАПУСК
  // ============================================================
  
  mainWithExtension();
  
})();`;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function stripPrefix(code) {
  return code.replace(/^javascript:\s*/i, '').trim();
}

function addPrefix(code) {
  return 'javascript:' + code;
}

function isMinified(code) {
  const lines = code.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return false;
  const avgLineLength = code.length / lines.length;
  return (lines.length < 20 && avgLineLength > 80) || (code.length > 1000 && lines.length < 30);
}

// ============================================================
// МИНИФИКАЦИЯ
// ============================================================

async function minifyCode(code, filename) {
  console.log(`   🔧 Минификация ${filename}...`);

  try {
    const pureCode = stripPrefix(code);
    const result = await esbuild.transform(pureCode, {
      minify: true,
      minifyWhitespace: true,
      minifyIdentifiers: true,
      minifySyntax: true,
      target: 'es2020',
      format: 'iife',
      platform: 'browser',
      legalComments: 'none',
    });

    const minified = addPrefix(result.code);
    const originalSize = code.length;
    const minifiedSize = minified.length;
    const compression = ((1 - minifiedSize / originalSize) * 100).toFixed(1);

    console.log(`      ✅ Размер: ${minifiedSize} байт (${compression}% сжатие)`);

    return minified;
  } catch (error) {
    console.log(`      ❌ Ошибка: ${error.message}`);
    return null;
  }
}

// ============================================================
// ВОССТАНОВЛЕНИЕ ОРИГИНАЛА ИЗ SOURCE MAP
// ============================================================

async function recoverOriginalFromSourceMap(mapContent) {
  console.log('\n🔄 Восстановление оригинала из Source Map...');

  try {
    const { SourceMapConsumer } = await import('source-map');
    const mapData = typeof mapContent === 'string' ? JSON.parse(mapContent) : mapContent;
    const consumer = await new SourceMapConsumer(mapData);

    let recovered = '';

    if (mapData.sourcesContent && mapData.sourcesContent.length > 0) {
      recovered = mapData.sourcesContent[0];
      console.log(`   📄 Найден исходный код в source map (${recovered.length} байт)`);
    } else {
      console.log('   ⚠️ Исходный код не найден в source map');
      consumer.destroy();
      return null;
    }

    consumer.destroy();
    recovered = stripPrefix(recovered);

    return recovered;
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
    return null;
  }
}

// ============================================================
// AST ПРОВЕРКА ЭКВИВАЛЕНТНОСТИ
// ============================================================

function normalizeASTForComparison(node, depth = 0) {
  if (!node || typeof node !== 'object') return node;
  if (depth > 20) return { type: 'max_depth' };

  const normalized = { type: node.type };

  for (const key in node) {
    if (
      key === 'start' ||
      key === 'end' ||
      key === 'loc' ||
      key === 'range' ||
      key === 'comments' ||
      key === 'tokens' ||
      key === 'errors'
    ) {
      continue;
    }

    const value = node[key];
    if (Array.isArray(value)) {
      normalized[key] = value.map(v => normalizeASTForComparison(v, depth + 1));
    } else if (value && typeof value === 'object') {
      normalized[key] = normalizeASTForComparison(value, depth + 1);
    } else {
      if (typeof value === 'string' && value.length > 0) {
        normalized[key] = '[string:' + value.length + ']';
      } else if (typeof value === 'number') {
        normalized[key] = '[number]';
      } else {
        normalized[key] = value;
      }
    }
  }
  return normalized;
}

function compareAST(ast1, ast2) {
  try {
    const norm1 = normalizeASTForComparison(ast1);
    const norm2 = normalizeASTForComparison(ast2);

    const str1 = JSON.stringify(norm1);
    const str2 = JSON.stringify(norm2);

    if (str1 === str2) {
      return { equivalent: true };
    }

    let diffPos = -1;
    let diffContext = '';
    const maxLen = Math.min(str1.length, str2.length);
    for (let i = 0; i < maxLen; i++) {
      if (str1[i] !== str2[i]) {
        diffPos = i;
        const start = Math.max(0, i - 30);
        const end = Math.min(i + 30, maxLen);
        diffContext = `...${str1.substring(start, end)}...`;
        break;
      }
    }

    return {
      equivalent: false,
      diffPos: diffPos,
      diffContext: diffContext,
      len1: str1.length,
      len2: str2.length,
    };
  } catch (error) {
    return {
      equivalent: false,
      error: error.message,
    };
  }
}

function parseCode(code) {
  if (!code || typeof code !== 'string') return null;

  try {
    return parse(code, {
      ecmaVersion: 2020,
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    });
  } catch (error) {
    try {
      return parse(code, {
        ecmaVersion: 2020,
        sourceType: 'script',
        allowReturnOutsideFunction: true,
      });
    } catch {
      return null;
    }
  }
}

function checkASTEquivalence(code1, code2) {
  console.log('\n🔍 AST проверка эквивалентности...');
  console.log(`   📌 Версия кодера: ${VERSION}`);

  try {
    const clean1 = stripPrefix(code1);
    const clean2 = stripPrefix(code2);

    console.log(`   📏 Длина 1: ${clean1.length} символов`);
    console.log(`   📏 Длина 2: ${clean2.length} символов`);

    const ast1 = parseCode(clean1);
    const ast2 = parseCode(clean2);

    if (!ast1 || !ast2) {
      console.log('   ⚠️ Не удалось распарсить код');
      return false;
    }

    const result = compareAST(ast1, ast2);

    if (result.equivalent) {
      console.log('   ✅ AST структуры идентичны!');
      return true;
    } else {
      console.log('   ❌ AST структуры различаются');
      if (result.error) {
        console.log(`   ⚠️ Ошибка: ${result.error}`);
      } else {
        console.log(`   📍 Позиция различия: ${result.diffPos}`);
        console.log(`   📄 Контекст: ${result.diffContext}`);
        console.log(`   📊 Длина AST1: ${result.len1}`);
        console.log(`   📊 Длина AST2: ${result.len2}`);
      }
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Ошибка AST проверки: ${error.message}`);
    return false;
  }
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

async function processFile(inputFile) {
  console.log('═'.repeat(60));
  console.log(`📦 BOOKMARKLET CODEC v${VERSION} (с минификацией всех версий)`);
  console.log(`📅 Дата: ${VERSION_DATE}`);
  console.log('═'.repeat(60));

  console.log('📖 Чтение файла:', inputFile);

  const sourceCode = fs.readFileSync(inputFile, 'utf-8');
  const pureCode = stripPrefix(sourceCode);

  console.log(`   Размер: ${sourceCode.length} байт`);
  console.log(`   Строк: ${sourceCode.split('\n').length}`);
  console.log(`   Минимизирован: ${isMinified(pureCode) ? '✅ ДА' : '❌ НЕТ'}`);

  const isMin = isMinified(pureCode);
  let minifiedCode = sourceCode;
  let recoveredCode = sourceCode;
  let verificationResult = false;

  if (!isMin) {
    console.log('\n🔧 Минификация с source map...');

    const result = await esbuild.transform(pureCode, {
      minify: true,
      minifyWhitespace: true,
      minifyIdentifiers: false,
      minifySyntax: true,
      target: 'es2020',
      format: 'iife',
      platform: 'browser',
      legalComments: 'none',
      sourcemap: true,
      sourcefile: 'bookmarklet.mjs',
      sourcesContent: true,
    });

    minifiedCode = addPrefix(result.code);

    fs.writeFileSync(MINIFIED_FILE, minifiedCode, 'utf-8');
    console.log(`✅ Минифицированная версия: ${MINIFIED_FILE}`);
    console.log(
      `   Размер: ${minifiedCode.length} байт (${((1 - minifiedCode.length / sourceCode.length) * 100).toFixed(1)}% сжатие)`
    );

    if (result.map) {
      const mapContent = typeof result.map === 'string' ? result.map : JSON.stringify(result.map);
      fs.writeFileSync(MINIFIED_MAP_FILE, mapContent, 'utf-8');
      console.log(`✅ Source map сохранен: ${MINIFIED_MAP_FILE}`);
      console.log(`   Размер: ${mapContent.length} байт`);

      const recovered = await recoverOriginalFromSourceMap(mapContent);
      if (recovered) {
        recoveredCode = recovered;
        fs.writeFileSync(RECOVERY_FILE, recoveredCode, 'utf-8');
        console.log(`✅ Восстановленная версия: ${RECOVERY_FILE}`);
        console.log(`   Размер: ${recoveredCode.length} байт`);

        console.log('\n🔍 ВЕРИФИКАЦИЯ ВОССТАНОВЛЕНИЯ');
        console.log('─'.repeat(60));
        verificationResult = checkASTEquivalence(sourceCode, recoveredCode);
        console.log(`   📌 Результат: ${verificationResult ? '✅ ПРОЙДЕНА' : '❌ НЕ ПРОЙДЕНА'}`);
      }
    }
  } else {
    console.log('\n⚠️ Файл уже минифицирован');
    fs.writeFileSync(MINIFIED_FILE, sourceCode, 'utf-8');
    console.log(`✅ Минифицированная версия (оригинал): ${MINIFIED_FILE}`);
  }

  // ============================================================
  // ГЕНЕРАЦИЯ DEBUG ВЕРСИИ
  // ============================================================

  console.log('\n🐛 Генерация debug версии...');
  const debugCode = generateDebugVersion(sourceCode);
  fs.writeFileSync(DEBUG_FILE, debugCode, 'utf-8');
  console.log(`✅ Debug версия: ${DEBUG_FILE}`);
  console.log(`   Размер: ${debugCode.length} байт`);

  // Минификация debug версии
  const debugMinified = await minifyCode(debugCode, 'bookmarklet-debug.mjs');
  if (debugMinified) {
    fs.writeFileSync(DEBUG_MIN_FILE, debugMinified, 'utf-8');
    console.log(`✅ Debug минифицированная версия: ${DEBUG_MIN_FILE}`);
    console.log(`   Размер: ${debugMinified.length} байт`);
  }

  // ============================================================
  // ГЕНЕРАЦИЯ EXTENSION ВЕРСИИ
  // ============================================================

  console.log('\n🔌 Генерация extension версии...');
  const extensionCode = generateExtensionVersion(sourceCode);
  fs.writeFileSync(EXTENSION_FILE, extensionCode, 'utf-8');
  console.log(`✅ Extension версия: ${EXTENSION_FILE}`);
  console.log(`   Размер: ${extensionCode.length} байт`);

  // Минификация extension версии
  const extensionMinified = await minifyCode(extensionCode, 'bookmarklet-extension.mjs');
  if (extensionMinified) {
    fs.writeFileSync(EXTENSION_MIN_FILE, extensionMinified, 'utf-8');
    console.log(`✅ Extension минифицированная версия: ${EXTENSION_MIN_FILE}`);
    console.log(`   Размер: ${extensionMinified.length} байт`);
  }

  // ============================================================
  // СТАТИСТИКА
  // ============================================================

  console.log('\n📊 СТАТИСТИКА:');
  console.log(`   📦 Оригинал:              ${sourceCode.length} байт`);
  console.log(`   📦 Минифицированный:      ${minifiedCode.length} байт`);
  console.log(`   📦 Восстановленный:       ${recoveredCode.length} байт`);
  console.log(`   🐛 Debug:                ${debugCode.length} байт`);
  console.log(`   🐛 Debug min:            ${debugMinified ? debugMinified.length : '—'} байт`);
  console.log(`   🔌 Extension:            ${extensionCode.length} байт`);
  console.log(
    `   🔌 Extension min:        ${extensionMinified ? extensionMinified.length : '—'} байт`
  );

  if (!isMin) {
    const compression = ((1 - minifiedCode.length / sourceCode.length) * 100).toFixed(1);
    console.log(`   📊 Сжатие: ${compression}%`);
    console.log(`   ✅ Source Map: ${MINIFIED_MAP_FILE}`);
  }

  console.log(`   ✅ Верификация: ${verificationResult ? '✅ ПРОЙДЕНА' : '❌ НЕ ПРОЙДЕНА'}`);

  console.log('\n✅ Готово! Все файлы сгенерированы:');
  console.log(`   📁 ${OUTPUT_DIR}`);
  console.log(`   ├── bookmarklet.min.mjs           (минифицированный)`);
  if (!isMin) console.log(`   ├── bookmarklet.min.mjs.map      (source map)`);
  console.log(`   ├── bookmarklet.recovery.mjs      (восстановленный)`);
  console.log(`   ├── bookmarklet-debug.mjs         (debug версия)`);
  console.log(`   ├── bookmarklet-debug.min.mjs     (debug минифицированный)`);
  console.log(`   ├── bookmarklet-extension.mjs     (extension версия)`);
  console.log(`   └── bookmarklet-extension.min.mjs (extension минифицированный)`);
  console.log('═'.repeat(60));

  return {
    original: sourceCode,
    minified: minifiedCode,
    recovered: recoveredCode,
    debug: debugCode,
    debugMinified: debugMinified,
    extension: extensionCode,
    extensionMinified: extensionMinified,
    isMinified: isMin,
    verified: verificationResult,
    version: VERSION,
  };
}

// ============================================================
// ЗАПУСК
// ============================================================

const args = process.argv.slice(2);
let inputFile = args[0] || SOURCE_FILE;

if (!path.isAbsolute(inputFile)) {
  inputFile = path.join(__dirname, inputFile);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ Файл не найден: ${inputFile}`);
  console.log(`\nИспользование: node default.mjs [путь_к_файлу]`);
  console.log(`\nПо умолчанию используется: ${SOURCE_FILE}`);
  console.log(`\nВыходная директория: ${OUTPUT_DIR}`);
  process.exit(1);
}

const result = await processFile(inputFile);

console.log(`\n📌 Bookmarklet Codec v${VERSION} завершил работу`);
console.log(`   📅 ${VERSION_DATE}`);
console.log(`   ✅ Верификация: ${result.verified ? 'ПРОЙДЕНА' : 'НЕ ПРОЙДЕНА'}`);
