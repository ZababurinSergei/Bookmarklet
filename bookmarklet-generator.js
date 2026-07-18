// bookmarklet-generator.js - Генератор букмарклетов с уникальными ID и названиями

class BookmarkletGenerator {
  constructor() {
    this.bookmarklets = new Map();
    this._init();
  }

  _init() {
    // Загружаем сохраненные букмарклеты
    this._loadBookmarklets();
  }

  /**
   * Генерирует уникальный ID для букмарклета
   */
  generateId(name) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6);
    const nameHash = this._hashString(name).substr(0, 6);
    return `bm-${nameHash}-${timestamp}-${random}`;
  }

  /**
   * Хеш для строки
   */
  _hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash + char) & 0xffffffff;
    }
    return hash.toString(16);
  }

  /**
   * Генерирует код букмарклета с встроенным ID и названием
   */
  generateBookmarkletCode(name, options = {}) {
    const id = options.id || this.generateId(name);
    const version = options.version || '2.0.0';
    const type = options.type || 'main';
    const baseUrl = options.baseUrl || './Bookmarklet/';
    const fallbackEnabled = options.fallbackEnabled !== false;
    const description = options.description || '';

    // Основной код букмарклета с самодиагностикой
    return `javascript:(()=>{
            "use strict";
            
            // ============================================================
            //  ИНФОРМАЦИЯ О БУКМАРКЛЕТЕ (ВСТРОЕННАЯ)
            // ============================================================
            
            const BOOKMARKLET_INFO = {
                id: "${id}",
                name: "${name}",
                type: "${type}",
                version: "${version}",
                description: "${description}",
                generated: "${new Date().toISOString()}",
                baseUrl: "${baseUrl}"
            };
            
            // Сохраняем в глобальный объект ДО загрузки
            window.__bookmarkletInfo = BOOKMARKLET_INFO;
            window.__bookmarkletId = BOOKMARKLET_INFO.id;
            window.__bookmarkletName = BOOKMARKLET_INFO.name;
            window.__bookmarkletType = BOOKMARKLET_INFO.type;
            
            // ============================================================
            //  ОТПРАВКА СООБЩЕНИЯ О ЗАПУСКЕ
            // ============================================================
            
            try {
                // Отправляем postMessage с информацией о букмарклете
                window.postMessage({
                    source: 'bookmarklet',
                    type: 'BOOKMARKLET_INIT',
                    bookmarkletId: BOOKMARKLET_INFO.id,
                    bookmarkletName: BOOKMARKLET_INFO.name,
                    bookmarkletType: BOOKMARKLET_INFO.type,
                    version: BOOKMARKLET_INFO.version,
                    timestamp: Date.now(),
                    url: window.location.href,
                    title: document.title
                }, '*');
                
                console.log(\`📌 [\${BOOKMARKLET_INFO.id}] Букмарклет "\${BOOKMARKLET_INFO.name}" запущен\`);
            } catch (e) {
                console.warn('⚠️ Ошибка отправки postMessage:', e.message);
            }
            
            // ============================================================
            //  ОСНОВНАЯ ЛОГИКА БУКМАРКЛЕТА
            // ============================================================
            
            function detectPanelType() {
                const scripts = document.querySelectorAll('script[src*="bookmarklet"]');
                for (const script of scripts) {
                    const src = script.src || '';
                    if (src.includes('logs-panel')) return 'logs';
                    if (src.includes('debug-panel')) return 'debug';
                    if (src.includes('env-panel')) return 'env';
                    if (src.includes('bookmarklet.js')) return 'main';
                }
                return BOOKMARKLET_INFO.type || 'main';
            }
            
            function getPanelPath(type) {
                const paths = {
                    env: './Bookmarklet/src/env-panel.js',
                    logs: './Bookmarklet/src/logs-panel.js',
                    debug: './Bookmarklet/src/debug-panel.js',
                    manager: './Bookmarklet/src/manager.html',
                    main: './Bookmarklet/bookmarklet.js'
                };
                return paths[type] || paths.main;
            }
            
            // ============================================================
            //  ЗАГРУЗКА ПАНЕЛИ
            // ============================================================
            
            try {
                const panelType = detectPanelType();
                const panelPath = getPanelPath(panelType);
                
                // Проверяем, есть ли уже панель
                const existingPanel = document.getElementById('env-control-panel');
                if (existingPanel) {
                    // Переключаем видимость
                    const isVisible = existingPanel.style.display !== 'none';
                    existingPanel.style.display = isVisible ? 'none' : 'flex';
                    console.log(\`🔄 [\${BOOKMARKLET_INFO.id}] Панель \${isVisible ? 'скрыта' : 'показана'}\`);
                    return;
                }
                
                // Создаем и загружаем панель
                console.log(\`📦 [\${BOOKMARKLET_INFO.id}] Загрузка панели: \${panelPath}\`);
                
                const script = document.createElement('script');
                script.type = 'module';
                script.src = panelPath + '?id=' + BOOKMARKLET_INFO.id + '&name=' + encodeURIComponent(BOOKMARKLET_INFO.name);
                script.dataset.bookmarkletId = BOOKMARKLET_INFO.id;
                script.dataset.bookmarkletName = BOOKMARKLET_INFO.name;
                script.dataset.bookmarkletType = panelType;
                
                script.onload = () => {
                    console.log(\`✅ [\${BOOKMARKLET_INFO.id}] Панель загружена\`);
                };
                
                script.onerror = (error) => {
                    console.error(\`❌ [\${BOOKMARKLET_INFO.id}] Ошибка загрузки панели:\`, error);
                    // Если ошибка — пробуем fallback
                    if (${fallbackEnabled}) {
                        console.log('🔄 Используем fallback — запрос к расширению');
                        window.postMessage({
                            source: 'bookmarklet',
                            type: 'BOOKMARKLET_FALLBACK',
                            bookmarkletId: BOOKMARKLET_INFO.id,
                            bookmarkletName: BOOKMARKLET_INFO.name,
                            error: error.message || 'Ошибка загрузки'
                        }, '*');
                    }
                };
                
                document.head.appendChild(script);
                
            } catch (error) {
                console.error(\`❌ [\${BOOKMARKLET_INFO.id}] Критическая ошибка:\`, error);
                
                // Отправляем ошибку в расширение
                if (${fallbackEnabled}) {
                    window.postMessage({
                        source: 'bookmarklet',
                        type: 'BOOKMARKLET_ERROR',
                        bookmarkletId: BOOKMARKLET_INFO.id,
                        bookmarkletName: BOOKMARKLET_INFO.name,
                        error: error.message || 'Критическая ошибка',
                        stack: error.stack || null
                    }, '*');
                }
                
                // Простой fallback — показываем алерт
                alert(\`❌ Ошибка букмарклета "\${BOOKMARKLET_INFO.name}"\\n\${error.message}\\n\\nПопробуйте перезагрузить страницу.\`);
            }
        })();`;
  }

  /**
   * Генерирует компактную версию букмарклета (минифицированную)
   */
  generateCompactBookmarkletCode(name, options = {}) {
    const fullCode = this.generateBookmarkletCode(name, options);
    // Минифицируем
    return fullCode
      .replace(/\s+/g, ' ')
      .replace(/\/\*.*?\*\//g, '')
      .replace(/\/\/.*?(\n|$)/g, '')
      .trim();
  }

  /**
   * Создает букмарклет для всех типов панелей
   */
  createBookmarklet(name, type = 'main', options = {}) {
    const id = options.id || this.generateId(name);
    const code = this.generateBookmarkletCode(name, { ...options, id, type });

    return {
      id: id,
      name: name,
      type: type,
      code: code,
      url: code, // Полный URL для закладки
      generated: new Date().toISOString(),
      version: options.version || '2.0.0',
      description: options.description || '',
      panelPath: options.panelPath || this._getPanelPath(type),
    };
  }

  /**
   * Получает путь к панели по типу
   */
  _getPanelPath(type) {
    const paths = {
      env: './Bookmarklet/src/env-panel.js',
      logs: './Bookmarklet/src/logs-panel.js',
      debug: './Bookmarklet/src/debug-panel.js',
      manager: './Bookmarklet/src/manager.html',
      main: './Bookmarklet/bookmarklet.js',
      widget: './Bookmarklet/src/widget.mjs',
    };
    return paths[type] || paths.main;
  }

  /**
   * Создает все стандартные букмарклеты
   */
  createAllStandardBookmarklets() {
    const bookmarklets = [];
    const types = [
      { name: 'ENV Control', type: 'main', desc: 'Панель управления ENV и DEBUG' },
      { name: 'Logs Control', type: 'logs', desc: 'Панель просмотра логов' },
      { name: 'Debug Control', type: 'debug', desc: 'Панель управления отладкой' },
      { name: 'Manager', type: 'manager', desc: 'Полный менеджер букмарклетов' },
      { name: 'Widget', type: 'widget', desc: 'Виджет генератора' },
      { name: 'Toggle ENV', type: 'main', desc: 'Быстрое переключение ENV панели' },
      { name: 'Toggle Logs', type: 'logs', desc: 'Быстрое переключение Logs панели' },
      { name: 'Toggle Debug', type: 'debug', desc: 'Быстрое переключение Debug панели' },
      { name: 'Register SW', type: 'main', desc: 'Регистрация Service Worker' },
      { name: 'Reset All', type: 'main', desc: 'Сброс всех данных букмарклетов' },
    ];

    for (const t of types) {
      const bm = this.createBookmarklet(t.name, t.type, {
        description: t.desc,
        version: '2.0.0',
      });
      bookmarklets.push(bm);
      this.saveBookmarklet(bm);
    }

    return bookmarklets;
  }

  // ============================================================
  //  ЗАГРУЗКА/СОХРАНЕНИЕ БУКМАРКЛЕТОВ
  // ============================================================

  _loadBookmarklets() {
    try {
      const saved = localStorage.getItem('bookmarklet-generator-data');
      if (saved) {
        const data = JSON.parse(saved);
        for (const [id, bm] of Object.entries(data)) {
          this.bookmarklets.set(id, bm);
        }
        console.log(`📦 Загружено ${this.bookmarklets.size} букмарклетов из кеша`);
      }
    } catch (e) {
      // Игнорируем
    }
  }

  saveBookmarklet(bookmarklet) {
    this.bookmarklets.set(bookmarklet.id, bookmarklet);
    this._saveBookmarklets();
  }

  _saveBookmarklets() {
    try {
      const data = {};
      for (const [id, bm] of this.bookmarklets) {
        data[id] = bm;
      }
      localStorage.setItem('bookmarklet-generator-data', JSON.stringify(data));
    } catch (e) {
      // Игнорируем
    }
  }

  getBookmarklet(id) {
    return this.bookmarklets.get(id) || null;
  }

  getBookmarkletByName(name) {
    for (const [id, bm] of this.bookmarklets) {
      if (bm.name === name) {
        return bm;
      }
    }
    return null;
  }

  getAllBookmarklets() {
    return Array.from(this.bookmarklets.values());
  }

  getBookmarkletsByType(type) {
    return Array.from(this.bookmarklets.values()).filter(bm => bm.type === type);
  }

  deleteBookmarklet(id) {
    const result = this.bookmarklets.delete(id);
    this._saveBookmarklets();
    return result;
  }

  deleteBookmarkletByName(name) {
    const bm = this.getBookmarkletByName(name);
    if (bm) {
      return this.deleteBookmarklet(bm.id);
    }
    return false;
  }

  /**
   * Обновляет существующий букмарклет
   */
  updateBookmarklet(id, updates) {
    const existing = this.bookmarklets.get(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates };
    this.bookmarklets.set(id, updated);
    this._saveBookmarklets();
    return updated;
  }

  /**
   * Обновляет код всех букмарклетов
   */
  regenerateAllBookmarklets() {
    const all = this.getAllBookmarklets();
    for (const bm of all) {
      const newCode = this.generateBookmarkletCode(bm.name, {
        id: bm.id,
        type: bm.type,
        version: bm.version || '2.0.0',
        description: bm.description || '',
      });
      bm.code = newCode;
      bm.url = newCode;
      bm.generated = new Date().toISOString();
    }
    this._saveBookmarklets();
    return all;
  }

  /**
   * Экспортирует все букмарклеты в JSON
   */
  exportBookmarklets() {
    return {
      timestamp: new Date().toISOString(),
      total: this.bookmarklets.size,
      bookmarklets: this.getAllBookmarklets(),
      version: '2.0.0',
    };
  }

  /**
   * Импортирует букмарклеты из JSON
   */
  importBookmarklets(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!data.bookmarklets || !Array.isArray(data.bookmarklets)) {
        throw new Error('Неверный формат данных');
      }

      let imported = 0;
      for (const bm of data.bookmarklets) {
        if (bm.id && bm.name && bm.code) {
          this.saveBookmarklet(bm);
          imported++;
        }
      }

      return { imported, total: data.bookmarklets.length };
    } catch (error) {
      throw new Error(`Ошибка импорта: ${error.message}`);
    }
  }

  /**
   * Очищает все сохраненные букмарклеты
   */
  clearAll() {
    const count = this.bookmarklets.size;
    this.bookmarklets.clear();
    this._saveBookmarklets();
    return { cleared: count };
  }

  /**
   * Получает статистику
   */
  getStats() {
    const all = this.getAllBookmarklets();
    const byType = {};
    for (const bm of all) {
      byType[bm.type] = (byType[bm.type] || 0) + 1;
    }

    return {
      total: all.length,
      byType: byType,
      generated: all.filter(b => b.generated).length,
      hasDescription: all.filter(b => b.description).length,
      version: '2.0.0',
    };
  }
}

// ============================================================
//  ЭКСПОРТ
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookmarkletGenerator };
}

if (typeof window !== 'undefined') {
  window.BookmarkletGenerator = BookmarkletGenerator;
  window.bookmarkletGenerator = new BookmarkletGenerator();

  console.log('📦 BookmarkletGenerator загружен');
  console.log('📋 Доступные команды:');
  console.log('  bookmarkletGenerator.createBookmarklet(name, type) - создать букмарклет');
  console.log('  bookmarkletGenerator.createAllStandardBookmarklets() - создать все стандартные');
  console.log('  bookmarkletGenerator.getBookmarklet(id) - получить по ID');
  console.log('  bookmarkletGenerator.getBookmarkletByName(name) - получить по имени');
  console.log('  bookmarkletGenerator.getAllBookmarklets() - получить все');
  console.log('  bookmarkletGenerator.getBookmarkletsByType(type) - получить по типу');
  console.log('  bookmarkletGenerator.regenerateAllBookmarklets() - перегенерировать все');
  console.log('  bookmarkletGenerator.exportBookmarklets() - экспортировать в JSON');
  console.log('  bookmarkletGenerator.importBookmarklets(json) - импортировать из JSON');
  console.log('  bookmarkletGenerator.clearAll() - очистить все');
  console.log('  bookmarkletGenerator.getStats() - статистика');
}
