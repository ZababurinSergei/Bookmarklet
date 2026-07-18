// bookmark-controller.js - Контроллер управления закладками с хешированием и кешированием

class BookmarkController {
  constructor() {
    // Состояние с прокси
    this._state = {
      bookmarks: [],
      bookmarklets: [],
      folders: [],
      tree: [],
      isLoading: false,
      lastUpdate: null,
      filter: '',
      selectedId: null,
      expandedFolders: new Set(),

      // Кеш с хешами
      cache: {
        bookmarklets: {}, // id -> { hash, code, title, lastChecked }
        hashes: {}, // id -> hash
        version: '2.0.0',
        lastCleanup: null,
      },
    };

    // Создаем прокси для реактивного состояния
    this.state = new Proxy(this._state, {
      set: (target, property, value) => {
        const oldValue = target[property];
        target[property] = value;
        this._emit('change', {
          property,
          oldValue,
          newValue: value,
          state: this.getState(),
        });
        this._saveState();
        return true;
      },
      get: (target, property) => {
        return target[property];
      },
    });

    // Слушатели событий
    this._listeners = {
      change: [],
      add: [],
      update: [],
      delete: [],
      select: [],
      error: [],
      cache: [],
    };

    // Загружаем сохраненное состояние
    this._loadState();

    // Инициализация
    this._init();

    console.log('📦 BookmarkController инициализирован с хешированием');
  }

  // ============================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ============================================================

  _init() {
    // Загружаем закладки при старте
    this.loadAll();

    // Слушаем изменения закладок извне
    if (typeof chrome !== 'undefined' && chrome.bookmarks) {
      chrome.bookmarks.onCreated.addListener((id, bookmark) => {
        this.loadAll();
        this._emit('add', { id, bookmark });
      });

      chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
        this.loadAll();
        this._emit('delete', { id, removeInfo });
      });

      chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
        this.loadAll();
        this._emit('update', { id, changeInfo });
      });

      chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
        this.loadAll();
      });
    }
  }

  // ============================================================
  // СОХРАНЕНИЕ/ЗАГРУЗКА СОСТОЯНИЯ
  // ============================================================

  _saveState() {
    try {
      const data = {
        bookmarks: this._state.bookmarks,
        bookmarklets: this._state.bookmarklets,
        folders: this._state.folders,
        filter: this._state.filter,
        selectedId: this._state.selectedId,
        lastUpdate: this._state.lastUpdate,
        expandedFolders: Array.from(this._state.expandedFolders || []),
        cache: this._state.cache,
      };
      localStorage.setItem('bookmark-controller-state', JSON.stringify(data));
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }

  _loadState() {
    try {
      const saved = localStorage.getItem('bookmark-controller-state');
      if (saved) {
        const data = JSON.parse(saved);
        this._state.bookmarks = data.bookmarks || [];
        this._state.bookmarklets = data.bookmarklets || [];
        this._state.folders = data.folders || [];
        this._state.filter = data.filter || '';
        this._state.selectedId = data.selectedId || null;
        this._state.lastUpdate = data.lastUpdate || null;
        if (data.expandedFolders) {
          this._state.expandedFolders = new Set(data.expandedFolders);
        }
        if (data.cache) {
          this._state.cache = {
            ...this._state.cache,
            ...data.cache,
            bookmarklets: data.cache.bookmarklets || {},
            hashes: data.cache.hashes || {},
          };
        }
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  }

  // ============================================================
  // ХЕШ-ФУНКЦИИ
  // ============================================================

  /**
   * Вычисляет хеш URL букмарклета
   * Используется для сравнения версий
   */
  _hashUrl(url) {
    if (!url) return null;

    // Очищаем URL от префикса и пробелов
    let code = url.replace(/^javascript:/i, '').trim();

    // Нормализуем: удаляем лишние пробелы и переносы
    code = code.replace(/\s+/g, ' ');
    code = code.replace(/;\s*}/g, '}');
    code = code.replace(/{\s*/g, '{');
    code = code.replace(/\s*}/g, '}');

    // Простой хеш (быстрый, но надежный для сравнения)
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash1 = ((hash1 << 5) - hash1 + char) & 0xffffffff;
      hash2 = ((hash2 << 7) - hash2 + char) & 0xffffffff;
    }

    // Комбинируем хеши
    return `${hash1.toString(16).padStart(8, '0')}${hash2.toString(16).padStart(8, '0')}`;
  }

  /**
   * Вычисляет хеш для объекта букмарклета
   */
  _hashBookmarklet(bookmark) {
    if (!bookmark || !bookmark.url) return null;
    return this._hashUrl(bookmark.url);
  }

  /**
   * Сравнивает хеши двух букмарклетов
   */
  _compareHashes(hash1, hash2) {
    if (!hash1 && !hash2) return true;
    if (!hash1 || !hash2) return false;
    return hash1 === hash2;
  }

  // ============================================================
  // УПРАВЛЕНИЕ КЕШЕМ
  // ============================================================

  _updateCache(bookmarklets) {
    const now = Date.now();
    const cache = this.state.cache;

    // Обновляем кеш для каждого букмарклета
    for (const bm of bookmarklets) {
      const id = String(bm.id);
      const hash = this._hashBookmarklet(bm);

      // Если букмарклет уже в кеше
      if (cache.bookmarklets[id]) {
        const cached = cache.bookmarklets[id];

        // Если хеш изменился — обновляем
        if (cached.hash !== hash) {
          cached.hash = hash;
          cached.code = bm.code || this._extractCode(bm.url);
          cached.title = bm.title;
          cached.lastChecked = now;
          cached.updatedAt = now;
          this._emit('cache', {
            action: 'update',
            id,
            oldHash: cached.hash,
            newHash: hash,
          });
        } else {
          // Хеш не изменился — просто обновляем время проверки
          cached.lastChecked = now;
        }
      } else {
        // Новый букмарклет — добавляем в кеш
        cache.bookmarklets[id] = {
          hash: hash,
          code: bm.code || this._extractCode(bm.url),
          title: bm.title,
          url: bm.url,
          addedAt: now,
          lastChecked: now,
          updatedAt: now,
        };
        this._emit('cache', {
          action: 'add',
          id,
          hash: hash,
        });
      }

      // Обновляем хеши
      cache.hashes[id] = hash;
    }

    // Удаляем из кеша те, которых больше нет
    const currentIds = new Set(bookmarklets.map(b => String(b.id)));
    const cachedIds = Object.keys(cache.bookmarklets);
    let removedCount = 0;

    for (const id of cachedIds) {
      if (!currentIds.has(id)) {
        delete cache.bookmarklets[id];
        delete cache.hashes[id];
        removedCount++;
        this._emit('cache', { action: 'remove', id });
      }
    }

    if (removedCount > 0) {
      console.log(`🗑️ Удалено ${removedCount} устаревших записей из кеша`);
    }

    cache.lastCleanup = now;
    this._saveState();

    return {
      total: Object.keys(cache.bookmarklets).length,
      updated: 0,
      added: 0,
      removed: removedCount,
    };
  }

  /**
   * Извлекает код из URL букмарклета
   */
  _extractCode(url) {
    if (!url) return null;
    return url.replace(/^javascript:/i, '').trim();
  }

  /**
   * Получает букмарклет из кеша по ID
   */
  getCachedBookmarklet(id) {
    const cached = this.state.cache.bookmarklets[String(id)];
    if (cached) {
      return {
        ...cached,
        isFromCache: true,
        age: Date.now() - cached.lastChecked,
      };
    }
    return null;
  }

  /**
   * Проверяет, изменился ли букмарклет с момента последнего кеширования
   */
  isBookmarkletChanged(bookmark) {
    const id = String(bookmark.id);
    const cached = this.state.cache.bookmarklets[id];

    if (!cached) return true; // Нет в кеше — значит изменился

    const currentHash = this._hashBookmarklet(bookmark);
    return cached.hash !== currentHash;
  }

  /**
   * Получает букмарклет либо из кеша, либо загружает свежий
   */
  getBookmarkletWithCache(id, forceRefresh = false) {
    const bookmark = this.getBookmarklet(id);
    if (!bookmark) return null;

    // Если принудительное обновление или хеш изменился
    if (forceRefresh || this.isBookmarkletChanged(bookmark)) {
      // Обновляем кеш
      this._updateCache([bookmark]);
      return {
        ...bookmark,
        fromCache: false,
        hash: this._hashBookmarklet(bookmark),
      };
    }

    // Берем из кеша
    const cached = this.getCachedBookmarklet(id);
    if (cached) {
      return {
        ...bookmark,
        ...cached,
        fromCache: true,
        cacheAge: Date.now() - cached.lastChecked,
      };
    }

    // Если в кеше нет — возвращаем как есть
    return {
      ...bookmark,
      fromCache: false,
      hash: this._hashBookmarklet(bookmark),
    };
  }

  /**
   * Получает все букмарклеты с использованием кеша
   */
  getAllBookmarkletsWithCache(forceRefresh = false) {
    const bookmarklets = this.getBookmarklets();
    const result = [];
    let fromCache = 0;
    let fromLive = 0;

    for (const bm of bookmarklets) {
      const withCache = this.getBookmarkletWithCache(bm.id, forceRefresh);
      result.push(withCache);
      if (withCache.fromCache) {
        fromCache++;
      } else {
        fromLive++;
      }
    }

    return {
      bookmarklets: result,
      stats: {
        total: result.length,
        fromCache,
        fromLive,
        cacheHitRate:
          result.length > 0 ? ((fromCache / result.length) * 100).toFixed(1) + '%' : '0%',
      },
    };
  }

  // ============================================================
  // ЗАГРУЗКА ЗАКЛАДОК
  // ============================================================

  loadAll(useCache = true) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        reject(new Error('Chrome bookmarks API недоступен'));
        return;
      }

      this.state.isLoading = true;

      chrome.bookmarks.getTree(tree => {
        if (chrome.runtime.lastError) {
          this.state.isLoading = false;
          this._emit('error', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        try {
          const { allBookmarks, bookmarklets, folders } = this._extractBookmarks(tree);

          // Обновляем состояние
          this.state.bookmarks = allBookmarks;
          this.state.bookmarklets = bookmarklets;
          this.state.folders = folders;
          this.state.tree = tree;
          this.state.lastUpdate = new Date().toISOString();
          this.state.isLoading = false;

          // Обновляем кеш
          const cacheStats = this._updateCache(bookmarklets);

          // Определяем, сколько взято из кеша
          const cacheHit = bookmarklets.filter(
            bm => this.state.cache.bookmarklets[String(bm.id)]
          ).length;

          const result = {
            bookmarks: allBookmarks,
            bookmarklets,
            folders,
            total: allBookmarks.length,
            cache: {
              ...cacheStats,
              hit: cacheHit,
              hitRate:
                bookmarklets.length > 0
                  ? ((cacheHit / bookmarklets.length) * 100).toFixed(1) + '%'
                  : '0%',
            },
          };

          this._emit('change', {
            property: 'bookmarks',
            total: allBookmarks.length,
            bookmarklets: bookmarklets.length,
            folders: folders.length,
            cache: result.cache,
          });

          resolve(result);
        } catch (error) {
          this.state.isLoading = false;
          this._emit('error', error);
          reject(error);
        }
      });
    });
  }

  _extractBookmarks(nodes, path = '') {
    const allBookmarks = [];
    const bookmarklets = [];
    const folders = [];

    function traverse(node, currentPath) {
      if (node.url) {
        const isBookmarklet = node.url.startsWith('javascript:');
        const bookmark = {
          id: node.id,
          title: node.title || 'Без названия',
          url: node.url,
          path: currentPath || 'Корень',
          isBookmarklet: isBookmarklet,
          type: isBookmarklet ? 'bookmarklet' : 'url',
          parentId: node.parentId,
          dateAdded: node.dateAdded,
          dateLastUsed: node.dateLastUsed,
          index: node.index,
          syncing: node.syncing || false,
          code: isBookmarklet ? node.url.replace(/^javascript:/i, '').trim() : null,
          name: node.title || 'Без названия',
        };
        allBookmarks.push(bookmark);
        if (isBookmarklet) {
          bookmarklets.push(bookmark);
        }
      }

      if (node.children) {
        const folderPath =
          node.title && !node.url && node.id !== '0' && node.id !== '1'
            ? currentPath
              ? `${currentPath} > ${node.title}`
              : node.title
            : currentPath;

        if (node.title && !node.url && node.id !== '0' && node.id !== '1') {
          folders.push({
            id: node.id,
            title: node.title,
            path: currentPath || 'Корень',
            childrenCount: node.children.length,
            parentId: node.parentId,
          });
        }

        for (const child of node.children) {
          traverse(child, folderPath);
        }
      }
    }

    for (const root of nodes) {
      traverse(root, path);
    }

    return { allBookmarks, bookmarklets, folders };
  }

  // ============================================================
  // ПОЛУЧЕНИЕ ЗАКЛАДОК
  // ============================================================

  getBookmarks() {
    return this._state.bookmarks;
  }

  getBookmarklets() {
    return this._state.bookmarklets;
  }

  getFolders() {
    return this._state.folders;
  }

  getBookmark(id) {
    return this._state.bookmarks.find(b => b.id === String(id));
  }

  getBookmarklet(id) {
    return this._state.bookmarklets.find(b => b.id === String(id));
  }

  getBookmarkletByName(name) {
    return this._state.bookmarklets.find(b => b.title === name);
  }

  getFilteredBookmarks(filter = null) {
    const searchFilter = filter || this._state.filter;
    if (!searchFilter) return this._state.bookmarks;

    const lowerFilter = searchFilter.toLowerCase();
    return this._state.bookmarks.filter(
      b =>
        b.title.toLowerCase().includes(lowerFilter) ||
        (b.url && b.url.toLowerCase().includes(lowerFilter)) ||
        (b.code && b.code.toLowerCase().includes(lowerFilter))
    );
  }

  getBookmarksByType(type) {
    if (type === 'bookmarklet') return this._state.bookmarklets;
    if (type === 'folder') return this._state.folders;
    return this._state.bookmarks.filter(b => b.type === type);
  }

  getBookmarksByFolder(folderId) {
    return this._state.bookmarks.filter(b => b.parentId === String(folderId));
  }

  getState() {
    return {
      ...this._state,
      expandedFolders: Array.from(this._state.expandedFolders),
    };
  }

  // ============================================================
  // ДОБАВЛЕНИЕ ЗАКЛАДОК
  // ============================================================

  addBookmark(options) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        reject(new Error('Chrome bookmarks API недоступен'));
        return;
      }

      const { title, url, parentId, index } = options;

      if (!title || !url) {
        reject(new Error('Название и URL обязательны'));
        return;
      }

      const createOptions = {
        title: title,
        url: url,
        parentId: parentId || '1',
        index: index || 0,
      };

      chrome.bookmarks.create(createOptions, result => {
        if (chrome.runtime.lastError) {
          this._emit('error', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        // Перезагружаем список
        this.loadAll()
          .then(() => {
            this._emit('add', { bookmark: result });
            resolve(result);
          })
          .catch(reject);
      });
    });
  }

  addBookmarklet(title, code, parentId = '1') {
    return this.addBookmark({
      title: title,
      url: 'javascript:' + code,
      parentId: parentId,
    });
  }

  // ============================================================
  // ОБНОВЛЕНИЕ ЗАКЛАДОК
  // ============================================================

  updateBookmark(id, options) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        reject(new Error('Chrome bookmarks API недоступен'));
        return;
      }

      if (!id) {
        reject(new Error('ID закладки обязателен'));
        return;
      }

      // Если обновляем URL букмарклета — добавляем префикс
      if (options.url && !options.url.startsWith('javascript:') && options.isBookmarklet) {
        options.url = 'javascript:' + options.url;
      }

      chrome.bookmarks.update(String(id), options, result => {
        if (chrome.runtime.lastError) {
          this._emit('error', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        // Перезагружаем список
        this.loadAll()
          .then(() => {
            this._emit('update', { id, changes: options, result });
            resolve(result);
          })
          .catch(reject);
      });
    });
  }

  updateBookmarkletCode(id, newCode) {
    return this.updateBookmark(id, {
      url: 'javascript:' + newCode,
      isBookmarklet: true,
    });
  }

  updateBookmarkletByName(name, newCode) {
    return new Promise((resolve, reject) => {
      const bookmark = this._state.bookmarklets.find(b => b.title === name);
      if (!bookmark) {
        reject(new Error(`Букмарклет "${name}" не найден`));
        return;
      }
      this.updateBookmarkletCode(bookmark.id, newCode).then(resolve).catch(reject);
    });
  }

  /**
   * Обновляет букмарклет только если хеш изменился
   */
  updateBookmarkletIfChanged(id, newCode) {
    return new Promise(async (resolve, reject) => {
      try {
        // Получаем текущий букмарклет
        const current = this.getBookmarklet(id);
        if (!current) {
          reject(new Error(`Букмарклет с ID ${id} не найден`));
          return;
        }

        // Вычисляем хеш нового кода
        const newHash = this._hashUrl('javascript:' + newCode);
        const currentHash = this.state.cache.hashes[String(id)];

        // Если хеши совпадают — ничего не делаем
        if (this._compareHashes(currentHash, newHash)) {
          this._emit('cache', {
            action: 'unchanged',
            id,
            hash: newHash,
          });
          resolve({
            id,
            unchanged: true,
            message: 'Код не изменился',
            hash: newHash,
          });
          return;
        }

        // Хеши разные — обновляем
        const result = await this.updateBookmarkletCode(id, newCode);

        // Обновляем кеш
        const updatedBm = this.getBookmarklet(id);
        if (updatedBm) {
          this._updateCache([updatedBm]);
        }

        this._emit('cache', {
          action: 'updated',
          id,
          oldHash: currentHash,
          newHash: newHash,
        });

        resolve({
          id,
          unchanged: false,
          updated: true,
          result,
          oldHash: currentHash,
          newHash: newHash,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Обновляет все букмарклеты, проверяя хеши
   * Обновляет только те, которые изменились
   */
  updateAllBookmarkletsWithHashCheck(newCode) {
    return new Promise(async (resolve, reject) => {
      const bookmarklets = this._state.bookmarklets;
      if (bookmarklets.length === 0) {
        resolve({
          updated: 0,
          unchanged: 0,
          message: 'Нет букмарклетов для обновления',
        });
        return;
      }

      let updated = 0;
      let unchanged = 0;
      let errors = [];
      const details = [];

      for (const bm of bookmarklets) {
        try {
          const result = await this.updateBookmarkletIfChanged(bm.id, newCode);
          if (result.unchanged) {
            unchanged++;
          } else {
            updated++;
          }
          details.push(result);
        } catch (error) {
          errors.push({ id: bm.id, title: bm.title, error: error.message });
        }
      }

      this._emit('batch', {
        action: 'update_with_hash_check',
        updated,
        unchanged,
        errors,
        details,
      });

      resolve({
        updated,
        unchanged,
        errors,
        total: bookmarklets.length,
        details,
      });
    });
  }

  // ============================================================
  // УДАЛЕНИЕ ЗАКЛАДОК
  // ============================================================

  deleteBookmark(id) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        reject(new Error('Chrome bookmarks API недоступен'));
        return;
      }

      if (!id) {
        reject(new Error('ID закладки обязателен'));
        return;
      }

      // Получаем информацию о закладке перед удалением
      const bookmark = this.getBookmark(id);

      chrome.bookmarks.remove(String(id), () => {
        if (chrome.runtime.lastError) {
          this._emit('error', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        // Перезагружаем список
        this.loadAll()
          .then(() => {
            this._emit('delete', { id, bookmark });
            resolve({ id, bookmark });
          })
          .catch(reject);
      });
    });
  }

  deleteBookmarklet(id) {
    return this.deleteBookmark(id);
  }

  deleteBookmarkletByName(name) {
    return new Promise((resolve, reject) => {
      const bookmark = this._state.bookmarklets.find(b => b.title === name);
      if (!bookmark) {
        reject(new Error(`Букмарклет "${name}" не найден`));
        return;
      }
      this.deleteBookmark(bookmark.id).then(resolve).catch(reject);
    });
  }

  deleteAllBookmarklets() {
    return new Promise((resolve, reject) => {
      const bookmarklets = this._state.bookmarklets;
      if (bookmarklets.length === 0) {
        resolve({ deleted: 0, message: 'Нет букмарклетов для удаления' });
        return;
      }

      let deleted = 0;
      let errors = [];

      const promises = bookmarklets.map(bm =>
        this.deleteBookmark(bm.id)
          .then(() => deleted++)
          .catch(err => errors.push({ id: bm.id, title: bm.title, error: err.message }))
      );

      Promise.all(promises).then(() => {
        this._emit('batch', { action: 'delete_all', deleted, errors });
        resolve({ deleted, errors, total: bookmarklets.length });
      });
    });
  }

  // ============================================================
  // ПЕРЕМЕЩЕНИЕ ЗАКЛАДОК
  // ============================================================

  moveBookmark(id, parentId, index = null) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        reject(new Error('Chrome bookmarks API недоступен'));
        return;
      }

      const moveOptions = { parentId: String(parentId) };
      if (index !== null) {
        moveOptions.index = index;
      }

      chrome.bookmarks.move(String(id), moveOptions, result => {
        if (chrome.runtime.lastError) {
          this._emit('error', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        this.loadAll()
          .then(() => {
            this._emit('update', { id, move: moveOptions, result });
            resolve(result);
          })
          .catch(reject);
      });
    });
  }

  // ============================================================
  // ПОИСК ЗАКЛАДОК
  // ============================================================

  search(query) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        reject(new Error('Chrome bookmarks API недоступен'));
        return;
      }

      chrome.bookmarks.search(query, results => {
        if (chrome.runtime.lastError) {
          this._emit('error', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }

        const formatted = results.map(node => ({
          id: node.id,
          title: node.title || 'Без названия',
          url: node.url,
          parentId: node.parentId,
          isBookmarklet: node.url && node.url.startsWith('javascript:'),
          type: node.url && node.url.startsWith('javascript:') ? 'bookmarklet' : 'url',
          dateAdded: node.dateAdded,
          index: node.index,
        }));

        resolve(formatted);
      });
    });
  }

  // ============================================================
  // ФИЛЬТРАЦИЯ И СОРТИРОВКА
  // ============================================================

  setFilter(filter) {
    this.state.filter = filter;
    this._saveState();
    this._emit('filter', { filter });
  }

  sortBy(property, ascending = true) {
    const sorted = [...this._state.bookmarks];
    sorted.sort((a, b) => {
      const valA = a[property] || '';
      const valB = b[property] || '';
      const comparison = valA > valB ? 1 : valA < valB ? -1 : 0;
      return ascending ? comparison : -comparison;
    });
    this.state.bookmarks = sorted;
    return sorted;
  }

  // ============================================================
  // ПАКЕТНЫЕ ОПЕРАЦИИ
  // ============================================================

  updateAllBookmarklets(newCode) {
    return new Promise((resolve, reject) => {
      const bookmarklets = this._state.bookmarklets;
      if (bookmarklets.length === 0) {
        resolve({ updated: 0, message: 'Нет букмарклетов для обновления' });
        return;
      }

      let updated = 0;
      let errors = [];

      const promises = bookmarklets.map(bm =>
        this.updateBookmarkletCode(bm.id, newCode)
          .then(() => updated++)
          .catch(err => errors.push({ id: bm.id, title: bm.title, error: err.message }))
      );

      Promise.all(promises).then(() => {
        this._emit('batch', { action: 'update_all', updated, errors });
        resolve({ updated, errors, total: bookmarklets.length });
      });
    });
  }

  // ============================================================
  // ОЧИСТКА КЕША
  // ============================================================

  clearCache() {
    const cache = this.state.cache;
    const size = Object.keys(cache.bookmarklets).length;

    cache.bookmarklets = {};
    cache.hashes = {};
    cache.lastCleanup = Date.now();

    this._saveState();
    this._emit('cache', { action: 'clear', size });

    console.log(`🗑️ Кеш очищен (${size} записей)`);
    return { cleared: size };
  }

  /**
   * Очищает устаревший кеш (старше указанного времени)
   */
  cleanOldCache(maxAge = 7 * 24 * 60 * 60 * 1000) {
    // 7 дней по умолчанию
    const now = Date.now();
    const cache = this.state.cache;
    let removed = 0;

    for (const [id, data] of Object.entries(cache.bookmarklets)) {
      if (now - data.lastChecked > maxAge) {
        delete cache.bookmarklets[id];
        delete cache.hashes[id];
        removed++;
      }
    }

    cache.lastCleanup = now;
    this._saveState();

    console.log(`🧹 Удалено ${removed} устаревших записей из кеша`);
    return { removed, remaining: Object.keys(cache.bookmarklets).length };
  }

  // ============================================================
  // СТАТИСТИКА КЕША
  // ============================================================

  getCacheStats() {
    const cache = this.state.cache;
    const bookmarklets = this._state.bookmarklets;
    const cachedIds = new Set(Object.keys(cache.bookmarklets));
    const bookmarkletIds = new Set(bookmarklets.map(b => String(b.id)));

    // Находим устаревшие (которых нет в текущих закладках)
    const orphaned = [];
    for (const id of cachedIds) {
      if (!bookmarkletIds.has(id)) {
        orphaned.push(id);
      }
    }

    return {
      totalCached: Object.keys(cache.bookmarklets).length,
      totalBookmarklets: bookmarklets.length,
      cacheHitRate:
        bookmarklets.length > 0
          ? (
              (bookmarklets.filter(b => cachedIds.has(String(b.id))).length / bookmarklets.length) *
              100
            ).toFixed(1) + '%'
          : '0%',
      orphaned: orphaned.length,
      orphanedIds: orphaned.slice(0, 10),
      version: cache.version,
      lastCleanup: cache.lastCleanup,
      age: cache.lastCleanup ? Date.now() - cache.lastCleanup : null,
    };
  }

  // ============================================================
  // УСТАНОВКА ВЕРСИИ КЕША
  // ============================================================

  setCacheVersion(version) {
    this.state.cache.version = version;
    this._saveState();
    this._emit('cache', { action: 'version', version });
    return version;
  }

  // ============================================================
  // ЭКСПОРТ/ИМПОРТ
  // ============================================================

  exportBookmarks() {
    return {
      timestamp: new Date().toISOString(),
      total: this._state.bookmarks.length,
      bookmarklets: this._state.bookmarklets,
      folders: this._state.folders,
      bookmarks: this._state.bookmarks,
      cache: this._state.cache,
      version: '2.0.0',
    };
  }

  exportToJSON() {
    return JSON.stringify(this.exportBookmarks(), null, 2);
  }

  importFromJSON(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!data.bookmarks && !data.bookmarklets) {
        throw new Error('Неверный формат данных');
      }
      return data;
    } catch (error) {
      throw new Error(`Ошибка импорта: ${error.message}`);
    }
  }

  // ============================================================
  // СОБЫТИЯ
  // ============================================================

  on(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event].push(callback);
    }
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      for (const callback of this._listeners[event]) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Ошибка в слушателе ${event}:`, error);
        }
      }
    }
  }

  // ============================================================
  // УТИЛИТЫ
  // ============================================================

  getStats() {
    return {
      total: this._state.bookmarks.length,
      bookmarklets: this._state.bookmarklets.length,
      folders: this._state.folders.length,
      lastUpdate: this._state.lastUpdate,
      isLoading: this._state.isLoading,
      cache: this.getCacheStats(),
    };
  }

  reset() {
    this._state.bookmarks = [];
    this._state.bookmarklets = [];
    this._state.folders = [];
    this._state.tree = [];
    this._state.lastUpdate = null;
    this._state.cache.bookmarklets = {};
    this._state.cache.hashes = {};
    this._state.cache.lastCleanup = Date.now();
    this._saveState();
    this._emit('change', { action: 'reset' });
    console.log('🔄 Состояние сброшено');
    return true;
  }
}

// ============================================================
// ГЛОБАЛЬНЫЙ ЭКЗЕМПЛЯР
// ============================================================

let bookmarkController = null;

function getBookmarkController() {
  if (!bookmarkController) {
    bookmarkController = new BookmarkController();

    if (typeof window !== 'undefined') {
      window.__bookmarkController = bookmarkController;
    }
  }
  return bookmarkController;
}

// ============================================================
// ЭКСПОРТ
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BookmarkController, getBookmarkController };
}

if (typeof window !== 'undefined') {
  window.BookmarkController = BookmarkController;
  window.getBookmarkController = getBookmarkController;

  console.log('📦 BookmarkController загружен');
  console.log('📋 Доступные команды:');
  console.log('  controller.loadAll()           - загрузить все закладки');
  console.log('  controller.addBookmarklet()    - добавить букмарклет');
  console.log('  controller.updateBookmarklet() - обновить букмарклет');
  console.log('  controller.deleteBookmarklet() - удалить букмарклет');
  console.log('  controller.updateAllBookmarklets() - обновить все');
  console.log('  controller.deleteAllBookmarklets() - удалить все');
  console.log('  controller.getBookmarklets()   - получить все букмарклеты');
  console.log('  controller.getFilteredBookmarks() - получить с фильтром');
  console.log('  controller.exportToJSON()      - экспортировать');
  console.log("  controller.on('change', cb)   - подписка на изменения");
  console.log('');
  console.log('📋 Команды кеша:');
  console.log('  controller.updateBookmarkletIfChanged(id, code) - обновить если изменился');
  console.log('  controller.updateAllBookmarkletsWithHashCheck(code) - обновить все с проверкой');
  console.log('  controller.getBookmarkletWithCache(id) - получить с кешем');
  console.log('  controller.getAllBookmarkletsWithCache() - получить все с кешем');
  console.log('  controller.getCacheStats() - статистика кеша');
  console.log('  controller.clearCache() - очистить кеш');
  console.log('  controller.cleanOldCache() - очистить устаревший кеш');
}
