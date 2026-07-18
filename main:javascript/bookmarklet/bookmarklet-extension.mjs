javascript: (function(){
  'use strict';
  
  // ============================================================
  // БУКМАРКЛЕТ С ПОДДЕРЖКОЙ РАСШИРЕНИЯ
  // Сгенерировано автоматически из bookmarklet.mjs
  // Версия: 2.0.0-extension (2026-07-17)
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
        case 'error': console.error(`${prefix} ❌ ${message}`, data || ''); break;
        case 'warn':  console.warn(`${prefix} ⚠️ ${message}`, data || ''); break;
        case 'debug': console.log(`${prefix} 🔍 ${message}`, data || ''); break;
        default:      console.log(`${prefix} ℹ️ ${message}`, data || '');
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
      console.log(`📌 ЗАКЛАДКА: ${bookmark.title}`);
      console.log(`📌 ТИП: ${bookmark.type || 'unknown'}`);
      console.log(`📌 ID: ${bookmark.id || 'нет'}`);
      console.log(`📌 ВЕРСИЯ: ${bookmark.version || '1.0.0'}`);
      console.log(`📌 РОДИТЕЛЬ: ${bookmark.parent?.title || 'корень'}`);
      console.log(`📌 СОСЕДЕЙ: ${bookmark.siblings?.length || 0}`);
      console.log('═══════════════════════════════════════════════════════════');
      
      if (bookmark.customConfig && Object.keys(bookmark.customConfig).length > 0) {
        console.log('🔧 КАСТОМНЫЕ НАСТРОЙКИ:');
        console.table(bookmark.customConfig);
      }
      
      if (bookmark.features && bookmark.features.length > 0) {
        console.log(`✨ ДОСТУПНЫЕ ФУНКЦИИ: ${bookmark.features.join(', ')}`);
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
      
      console.log('═'.repeat(60));
      console.log('✅ Готово! Данные доступны в window.__bookmarkData');
      
    } catch (error) {
      logger.error('Ошибка:', error.message);
      
      console.log('⚠️ Используем fallback (без расширения)...');
      
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
    }
  }
  
  // ============================================================
  // 6. ЗАПУСК
  // ============================================================
  
  mainWithExtension();
  
})();