// core/LocalInstance.js - Локальный экземпляр букмарклета
// ОБНОВЛЕНО: Добавлена поддержка множественных инстансов с изолированными состояниями
// ОБНОВЛЕНО: Добавлено расширенное debug-логирование
// ОБНОВЛЕНО: Исправлена регистрация и очистка инстансов
// ОБНОВЛЕНО: Добавлены методы cleanupOldInstances, cleanupLocalStorage, cleanupAll

import globalState from './GlobalState.js';

// ============================================================
// 1. DEBUG-ЛОГГЕР ДЛЯ LOCALINSTANCE
// ============================================================

const LI_LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  instance: 'color: #667eea; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #fdcb6e;',
  type: 'color: #764ba2; font-weight: bold;',
};

function liLog(message, data = null, style = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `%c[${timestamp}] %c[LocalInstance]`;
  const styles = [LI_LOG_STYLES.info, LI_LOG_STYLES.instance];

  if (data !== null && data !== undefined) {
    console.log(
      prefix + ' %c' + message,
      ...styles,
      LI_LOG_STYLES[style] || LI_LOG_STYLES.info,
      data
    );
  } else {
    console.log(prefix + ' %c' + message, ...styles, LI_LOG_STYLES[style] || LI_LOG_STYLES.info);
  }
}

function liHeader(title) {
  console.log('%c' + '═'.repeat(60), LI_LOG_STYLES.separator);
  console.log('%c  📦 ' + title, LI_LOG_STYLES.header);
  console.log('%c' + '═'.repeat(60), LI_LOG_STYLES.separator);
}

function liSeparator() {
  console.log('%c' + '─'.repeat(60), LI_LOG_STYLES.separator);
}

// ============================================================
// 2. КЛАСС LOCALINSTANCE
// ============================================================

class LocalInstance {
  constructor(options = {}) {
    liHeader('СОЗДАНИЕ ЛОКАЛЬНОГО ЭКЗЕМПЛЯРА');

    this.id = 'bookmarklet-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    this.type = options.type || 'main';
    this.name = options.name || 'Bookmarklet';
    this.created = new Date().toISOString();
    this._panel = null;
    this._isVisible = false;
    this._version = '2.0.0';
    this._listeners = [];
    this._panelType = options.panelType || 'unknown';

    liLog('🆔 ID экземпляра:', this.id, 'instance');
    liLog('📋 Тип:', this.type, 'type');
    liLog('📛 Имя:', this.name, 'info');
    liLog('📅 Создан:', this.created, 'info');
    liLog('📋 Тип панели:', this._panelType, 'type');

    // Регистрируем в глобальном реестре
    this._registerInGlobalRegistry();

    liLog('📊 Глобальное состояние:', globalState ? '✅ доступно' : '❌ недоступно', 'info');

    const instances = globalState ? globalState.getInstances() : [];
    liLog(`📊 Активных инстансов: ${instances.length}`, instances.length, 'info');

    const smSupported = globalState ? globalState.isSharedMemorySupported() : false;
    liLog(`📊 SharedMemory: ${smSupported ? '✅' : '❌'}`, null, 'info');

    liSeparator();
    liLog('✅ Локальный экземпляр создан', null, 'success');
    liHeader('ГОТОВ');
  }

  // ============================================================
  // 3. РЕГИСТРАЦИЯ В ГЛОБАЛЬНОМ РЕЕСТРЕ
  // ============================================================

  _registerInGlobalRegistry() {
    liLog('📝 Регистрация в глобальном реестре...', null, 'info');

    try {
      if (!window.__debugInstances) {
        window.__debugInstances = {};
        liLog('📦 Создан глобальный реестр инстансов', null, 'success');
      }

      // Проверяем, не существует ли уже такой инстанс
      if (window.__debugInstances[this.id]) {
        liLog('⚠️ Инстанс с таким ID уже существует, перезаписываем', null, 'warn');
      }

      window.__debugInstances[this.id] = {
        id: this.id,
        type: this.type,
        panelType: this._panelType,
        name: this.name,
        created: this.created,
        panel: this._panel,
        state: {
          visible: this._isVisible,
          minimized: false,
          fullscreen: false,
        },
        // Методы управления
        setDebug: namespace => this._setDebug(namespace),
        destroy: () => this.destroy(),
        getState: () => this.getFullState(),
        getPanelState: () => this.getPanelState(),
      };

      liLog(`✅ Инстанс ${this.id.slice(-8)} зарегистрирован`, null, 'success');
      liLog(`📊 Всего инстансов: ${Object.keys(window.__debugInstances).length}`, null, 'info');

      // Выводим список активных инстансов
      liSeparator();
      liLog('📋 Активные инстансы:', null, 'info');
      const instances = Object.keys(window.__debugInstances);
      instances.forEach(id => {
        const data = window.__debugInstances[id];
        const isCurrent = id === this.id;
        const icon = isCurrent ? '●' : '○';
        const color = isCurrent ? LI_LOG_STYLES.success : LI_LOG_STYLES.info;
        console.log(
          `  %c${icon} %c${id.slice(-8)} %c(${data.type || 'unknown'}) %c"${data.name || 'Без имени'}" %cсоздан: ${data.created || '?'}`,
          color,
          LI_LOG_STYLES.instance,
          LI_LOG_STYLES.type,
          LI_LOG_STYLES.info,
          LI_LOG_STYLES.separator
        );
      });
      liSeparator();
    } catch (e) {
      liLog('⚠️ Ошибка регистрации в глобальном реестре:', e.message, 'error');
    }
  }

  // ============================================================
  // 4. ВНУТРЕННИЕ МЕТОДЫ
  // ============================================================

  _setDebug(namespace) {
    liLog(`🔍 Установка DEBUG: ${namespace || 'off'}`, null, 'info');
    try {
      if (window.ENV && window.ENV.debug && window.ENV.debug.enable) {
        if (namespace) {
          window.ENV.debug.enable(namespace);
        } else {
          window.ENV.debug.disable();
        }
        liLog(`✅ DEBUG установлен: ${namespace || 'off'}`, null, 'success');
      } else {
        // Fallback
        localStorage.setItem('debug', namespace || '');
        if (window.DEBUG !== undefined) {
          window.DEBUG = namespace || '';
        }
        liLog(`✅ DEBUG установлен (fallback): ${namespace || 'off'}`, null, 'success');
      }
    } catch (e) {
      liLog(`⚠️ Ошибка установки DEBUG: ${e.message}`, null, 'error');
      localStorage.setItem('debug', namespace || '');
    }
    // Обновляем состояние
    if (globalState) {
      globalState.namespace = namespace || '';
    }
  }

  // ============================================================
  // 5. ПОЛУЧЕНИЕ СОСТОЯНИЯ
  // ============================================================

  /**
   * Получить глобальное состояние
   */
  getState() {
    liLog('📊 Получение глобального состояния', null, 'info');
    return globalState;
  }

  /**
   * Получить состояние панели
   */
  getPanelState() {
    const state = {
      id: this.id,
      type: this.type,
      panelType: this._panelType,
      name: this.name,
      visible: this._isVisible,
      panelExists: !!this._panel,
      created: this.created,
      version: this._version,
    };
    liLog('📊 Состояние панели:', state, 'info');
    return state;
  }

  /**
   * Получить полное состояние (глобальное + локальное)
   */
  getFullState() {
    const fullState = {
      instance: this.getPanelState(),
      global: globalState ? globalState.getState() : null,
      sharedMemory: globalState ? globalState.getSharedMemoryStats() : null,
      instances: globalState ? globalState.getInstances() : [],
      instancesCount: globalState ? globalState.getInstancesCount() : 0,
      history: globalState ? globalState.getHistory().slice(-10) : [],
      timestamp: new Date().toISOString(),
    };
    liLog(
      '📊 Полное состояние получено',
      {
        instanceId: this.id.slice(-8),
        instancesCount: fullState.instancesCount,
        historyCount: fullState.history.length,
      },
      'info'
    );
    return fullState;
  }

  // ============================================================
  // 6. УПРАВЛЕНИЕ ПАНЕЛЬЮ
  // ============================================================

  /**
   * Запустить панель
   */
  async runPanel() {
    liLog(`🚀 Запуск панели (${this.id.slice(-8)})...`, null, 'info');

    // Проверяем существующую панель
    const existingPanel = document.getElementById('env-control-panel');
    if (existingPanel) {
      const isVisible = existingPanel.style.display !== 'none';
      if (globalState) globalState.visible = !isVisible;
      this._isVisible = globalState ? globalState.visible : !isVisible;
      liLog(`🔄 Панель ${this._isVisible ? 'показана' : 'скрыта'}`, null, 'info');
      return this._isVisible;
    }

    // Импортируем и запускаем панель
    try {
      liLog('📦 Импорт env-panel.js...', null, 'info');
      const module = await import('../src/env-panel.js');
      if (module && module.default) {
        liLog('🔧 Вызов module.default()...', null, 'info');
        this._panel = await module.default(this);
        this._isVisible = true;
        if (globalState) globalState.visible = true;

        // Обновляем реестр
        if (window.__debugInstances && window.__debugInstances[this.id]) {
          window.__debugInstances[this.id].panel = this._panel;
          window.__debugInstances[this.id].state.visible = true;
        }

        liLog(`✅ Панель создана (${this.id.slice(-8)})`, null, 'success');
        liLog(`📌 Тип панели: ${this._panelType}`, null, 'type');
        return this._panel;
      }
    } catch (error) {
      liLog(`❌ Ошибка загрузки панели (${this.id.slice(-8)}):`, error.message, 'error');
      liLog('  📚 Stack:', error.stack, 'error');
      return null;
    }
  }

  /**
   * Показать панель
   */
  showPanel() {
    const panel = document.getElementById('env-control-panel');
    if (panel) {
      panel.style.display = 'flex';
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.transform = 'scale(1)';
        panel.style.opacity = '1';
      }, 50);
      this._isVisible = true;
      if (globalState) globalState.visible = true;
      liLog(`🟢 Панель показана (${this.id.slice(-8)})`, null, 'success');
      return true;
    }
    liLog(`⚠️ Панель не найдена (${this.id.slice(-8)})`, null, 'warn');
    return false;
  }

  /**
   * Скрыть панель
   */
  hidePanel() {
    const panel = document.getElementById('env-control-panel');
    if (panel) {
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);
      this._isVisible = false;
      if (globalState) globalState.visible = false;
      liLog(`🔴 Панель скрыта (${this.id.slice(-8)})`, null, 'info');
      return true;
    }
    liLog(`⚠️ Панель не найдена (${this.id.slice(-8)})`, null, 'warn');
    return false;
  }

  /**
   * Переключить видимость панели
   */
  togglePanel() {
    liLog(`🔄 Переключение панели (${this.id.slice(-8)})`, null, 'info');
    if (this._isVisible) {
      return this.hidePanel();
    } else {
      return this.showPanel();
    }
  }

  /**
   * Закрыть панель (полное закрытие)
   */
  closePanel() {
    const panel = document.getElementById('env-control-panel');
    if (panel) {
      panel.style.transform = 'scale(0.8)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.remove();
        this._panel = null;
        this._isVisible = false;
        if (globalState) {
          globalState.visible = false;
          globalState.panelExists = false;
        }
        // Обновляем реестр
        if (window.__debugInstances && window.__debugInstances[this.id]) {
          window.__debugInstances[this.id].panel = null;
          window.__debugInstances[this.id].state.visible = false;
        }
        liLog(`🗑️ Панель закрыта (${this.id.slice(-8)})`, null, 'info');
      }, 300);
      return true;
    }
    liLog(`⚠️ Панель не найдена (${this.id.slice(-8)})`, null, 'warn');
    return false;
  }

  // ============================================================
  // 7. УПРАВЛЕНИЕ СОСТОЯНИЕМ
  // ============================================================

  /**
   * Синхронизация с localStorage
   */
  sync(choice = 'merge') {
    liLog(`🔄 Синхронизация (${choice})...`, null, 'info');
    if (globalState && globalState.syncWithStorage) {
      const result = globalState.syncWithStorage(choice);
      liLog(`✅ Синхронизация завершена`, null, 'success');
      return result;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return false;
  }

  /**
   * Экспорт состояния
   */
  export() {
    liLog('📤 Экспорт состояния...', null, 'info');
    if (globalState && globalState.export) {
      const data = globalState.export();
      liLog(`✅ Экспортировано ${data.length} байт`, null, 'success');
      return data;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return null;
  }

  /**
   * Импорт состояния
   */
  import(json) {
    liLog('📥 Импорт состояния...', null, 'info');
    if (globalState && globalState.import) {
      const result = globalState.import(json);
      if (result) {
        liLog('✅ Импорт успешен', null, 'success');
      } else {
        liLog('⚠️ Ошибка импорта', null, 'warn');
      }
      return result;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return false;
  }

  /**
   * Сброс состояния
   */
  reset() {
    liLog('🔄 Сброс состояния...', null, 'warn');
    if (globalState && globalState.reset) {
      const result = globalState.reset();
      liLog('✅ Состояние сброшено', null, 'success');
      return result;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return null;
  }

  /**
   * Получить историю изменений
   */
  getHistory() {
    if (globalState && globalState.getHistory) {
      const history = globalState.getHistory();
      liLog(`📜 История (${history.length} записей)`, null, 'info');
      return history;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return [];
  }

  /**
   * Очистить историю
   */
  clearHistory() {
    liLog('🗑️ Очистка истории...', null, 'warn');
    if (globalState && globalState.clearHistory) {
      return globalState.clearHistory();
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return null;
  }

  /**
   * Установить значение в глобальном состоянии
   */
  set(key, value) {
    liLog(`✏️ Установка "${key}":`, value, 'info');
    if (globalState && globalState.set) {
      return globalState.set(key, value);
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return null;
  }

  /**
   * Получить значение из глобального состояния
   */
  get(key) {
    if (globalState && globalState.get) {
      const value = globalState.get(key);
      liLog(`📖 Получение "${key}":`, value, 'info');
      return value;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return null;
  }

  // ============================================================
  // 8. ИНФОРМАЦИЯ О СОСТОЯНИИ
  // ============================================================

  /**
   * Получить список всех экземпляров
   */
  getInstances() {
    return globalState ? globalState.getInstances() : [];
  }

  /**
   * Получить ID текущего экземпляра
   */
  getInstanceId() {
    return this.id;
  }

  /**
   * Проверить SharedMemory
   */
  checkSharedMemory() {
    liLog('🧠 Проверка SharedMemory...', null, 'info');
    if (globalState) {
      const result = {
        supported: globalState.isSharedMemorySupported(),
        ready: globalState.isSharedMemoryReady(),
        stats: globalState.getSharedMemoryStats(),
      };
      liLog('✅ SharedMemory статус:', result, 'info');
      return result;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return { supported: false, ready: false, stats: null };
  }

  /**
   * Получить статистику глобального состояния
   */
  getGlobalStats() {
    if (globalState) {
      const stats = {
        instances: globalState.getInstances().length,
        historyCount: globalState.getHistory().length,
        sharedMemory: globalState.getSharedMemoryStats(),
        state: globalState.getState(),
      };
      liLog('📊 Глобальная статистика:', stats, 'info');
      return stats;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return null;
  }

  /**
   * Подписаться на изменения глобального состояния
   */
  on(key, callback) {
    liLog(`👂 Подписка на "${key}"`, null, 'info');
    if (globalState && globalState.on) {
      const unsubscribe = globalState.on(key, callback);
      this._listeners.push(unsubscribe);
      liLog(`✅ Подписка на "${key}" добавлена`, null, 'success');
      return unsubscribe;
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return () => {};
  }

  /**
   * Отписаться от изменений
   */
  off(key, callback) {
    liLog(`👂 Отписка от "${key}"`, null, 'info');
    if (globalState && globalState.off) {
      return globalState.off(key, callback);
    }
    liLog('⚠️ Состояние не найдено', null, 'warn');
    return null;
  }

  // ============================================================
  // 9. УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ
  // ============================================================

  /**
   * Уничтожить экземпляр
   */
  destroy() {
    liHeader(`УНИЧТОЖЕНИЕ ЭКЗЕМПЛЯРА: ${this.id.slice(-8)}`);
    liLog(`🗑️ Уничтожение экземпляра: ${this.id}`, null, 'warn');

    // Закрываем панель
    this.closePanel();

    // Очищаем слушатели
    liLog(`🧹 Очистка ${this._listeners.length} слушателей...`, null, 'info');
    for (const unsubscribe of this._listeners) {
      try {
        unsubscribe();
      } catch (e) {
        liLog(`⚠️ Ошибка при отписке: ${e.message}`, null, 'error');
      }
    }
    this._listeners = [];

    // Удаляем из глобального состояния
    if (globalState && globalState.destroyInstance) {
      liLog('🗑️ Удаление из глобального состояния...', null, 'info');
      globalState.destroyInstance(this.id);
    }

    // Удаляем из глобального реестра
    if (window.__debugInstances) {
      delete window.__debugInstances[this.id];
      liLog(
        `🗑️ Удалён из глобального реестра. Осталось: ${Object.keys(window.__debugInstances).length}`,
        null,
        'info'
      );
    }

    // Удаляем ссылку на себя
    if (typeof window !== 'undefined') {
      if (window.__bookmarkletInstance === this) {
        window.__bookmarkletInstance = null;
        liLog('🗑️ Очищена ссылка window.__bookmarkletInstance', null, 'info');
      }
      if (window.R === this) {
        window.R = null;
        liLog('🗑️ Очищена ссылка window.R', null, 'info');
      }
    }

    // Удаляем данные из localStorage
    try {
      const keys = Object.keys(localStorage);
      let count = 0;
      for (const key of keys) {
        if (key.includes(this.id) || key === 'debug-instance-' + this.id) {
          localStorage.removeItem(key);
          count++;
        }
      }
      if (count > 0) {
        liLog(`🗑️ Удалено ${count} записей из localStorage`, null, 'info');
      }
    } catch (e) {
      liLog(`⚠️ Ошибка очистки localStorage: ${e.message}`, null, 'error');
    }

    liLog(`✅ Экземпляр уничтожен: ${this.id.slice(-8)}`, null, 'success');
    liSeparator();
    return true;
  }

  /**
   * Перезагрузить экземпляр
   */
  async reload() {
    liLog(`🔄 Перезагрузка экземпляра: ${this.id.slice(-8)}`, null, 'info');
    this.closePanel();
    this._panel = null;
    this._isVisible = false;
    const result = await this.runPanel();
    if (result) {
      liLog(`✅ Экземпляр перезагружен: ${this.id.slice(-8)}`, null, 'success');
    } else {
      liLog(`⚠️ Ошибка перезагрузки: ${this.id.slice(-8)}`, null, 'warn');
    }
    return result;
  }

  // ============================================================
  // 10. ОТЛАДКА
  // ============================================================

  /**
   * Вывести отладочную информацию
   */
  debug() {
    liHeader('ОТЛАДКА ЛОКАЛЬНОГО ЭКЗЕМПЛЯРА');

    console.log('%c  📌 ИНФОРМАЦИЯ ОБ ЭКЗЕМПЛЯРЕ:', LI_LOG_STYLES.header);
    console.log(`  %cID: ${this.id}`, LI_LOG_STYLES.instance);
    console.log(`  %cТип: ${this.type}`, LI_LOG_STYLES.type);
    console.log(`  %cТип панели: ${this._panelType}`, LI_LOG_STYLES.type);
    console.log(`  %cИмя: ${this.name}`, LI_LOG_STYLES.info);
    console.log(`  %cВерсия: ${this._version}`, LI_LOG_STYLES.info);
    console.log(`  %cСоздан: ${this.created}`, LI_LOG_STYLES.info);
    console.log(
      `  %cПанель: ${this._isVisible ? '🟢 Видима' : '🔴 Скрыта'}`,
      this._isVisible ? LI_LOG_STYLES.success : LI_LOG_STYLES.warn
    );
    console.log(
      `  %cPanel объект: ${this._panel ? '✅' : '❌'}`,
      this._panel ? LI_LOG_STYLES.success : LI_LOG_STYLES.error
    );

    liSeparator();

    console.log('%c  📌 ГЛОБАЛЬНОЕ СОСТОЯНИЕ:', LI_LOG_STYLES.header);
    const instances = globalState ? globalState.getInstances() : [];
    const instancesCount = instances.length;
    console.log(`  %cЭкземпляров: ${instancesCount}`, LI_LOG_STYLES.info);
    console.log(
      `  %cТекущий: ${globalState ? globalState.getCurrentInstance()?.slice(-8) || 'нет' : 'нет'}`,
      LI_LOG_STYLES.instance
    );
    console.log(
      `  %cИстория: ${globalState ? globalState.getHistory().length : 0} записей`,
      LI_LOG_STYLES.info
    );

    const smSupported = globalState ? globalState.isSharedMemorySupported() : false;
    const smReady = globalState ? globalState.isSharedMemoryReady() : false;
    console.log(
      `  %cSharedMemory: ${smSupported ? '✅' : '❌'} ${smReady ? '(готов)' : '(не готов)'}`,
      smSupported ? LI_LOG_STYLES.success : LI_LOG_STYLES.error
    );

    if (globalState && globalState.isSharedMemorySupported()) {
      const stats = globalState.getSharedMemoryStats();
      if (stats) {
        console.log(`  %cSharedMemory размер: ${stats.size || 'N/A'} байт`, LI_LOG_STYLES.info);
        console.log(
          `  %cSharedMemory использовано: ${stats.used || 'N/A'} байт`,
          LI_LOG_STYLES.info
        );
        console.log(`  %cSharedMemory инстансов: ${stats.instances || 'N/A'}`, LI_LOG_STYLES.info);
      }
    }

    liSeparator();

    // Список всех инстансов
    console.log('%c  📌 ВСЕ ИНСТАНСЫ:', LI_LOG_STYLES.header);
    if (window.__debugInstances) {
      const ids = Object.keys(window.__debugInstances);
      ids.forEach((id, index) => {
        const data = window.__debugInstances[id];
        const isCurrent = id === this.id;
        const icon = isCurrent ? '⭐' : `${index + 1}.`;
        const color = isCurrent ? LI_LOG_STYLES.success : LI_LOG_STYLES.info;
        console.log(
          `  %c${icon} %c${id.slice(-8)} %c(${data.type || 'unknown'}) %c"${data.name || 'Без имени'}"`,
          color,
          LI_LOG_STYLES.instance,
          LI_LOG_STYLES.type,
          LI_LOG_STYLES.info
        );
      });
    } else {
      console.log('  %c⚠️ Реестр инстансов не найден', LI_LOG_STYLES.warn);
    }

    liSeparator();

    console.log('%c  📌 ДОСТУПНЫЕ КОМАНДЫ:', LI_LOG_STYLES.header);
    console.log(
      '  %cR.getState()       %c- получить глобальное состояние',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.runPanel()       %c- запустить/переключить панель',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.showPanel()      %c- показать панель',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.hidePanel()      %c- скрыть панель',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.togglePanel()    %c- переключить панель',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.closePanel()     %c- закрыть панель',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.sync()           %c- синхронизировать с localStorage',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.export()         %c- экспортировать состояние',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.import()         %c- импортировать состояние',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.reset()          %c- сбросить состояние',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.getHistory()     %c- история изменений',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.getInstances()   %c- список экземпляров',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.checkSharedMemory() %c- проверить SharedMemory',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.destroy()        %c- уничтожить экземпляр',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.reload()         %c- перезагрузить экземпляр',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );
    console.log(
      '  %cR.debug()          %c- показать эту отладку',
      LI_LOG_STYLES.instance,
      LI_LOG_STYLES.info
    );

    liSeparator();

    console.log('%c  📌 ИНФОРМАЦИЯ О РЕЕСТРЕ:', LI_LOG_STYLES.header);
    console.log(
      `  %cwindow.__debugInstances: ${window.__debugInstances ? '✅' : '❌'}`,
      window.__debugInstances ? LI_LOG_STYLES.success : LI_LOG_STYLES.error
    );
    console.log(
      `  %cwindow.__bookmarkletInstance: ${window.__bookmarkletInstance ? '✅' : '❌'}`,
      window.__bookmarkletInstance ? LI_LOG_STYLES.success : LI_LOG_STYLES.error
    );
    console.log(
      `  %cwindow.R: ${window.R ? '✅' : '❌'}`,
      window.R ? LI_LOG_STYLES.success : LI_LOG_STYLES.error
    );
    console.log(
      `  %cglobalState: ${globalState ? '✅' : '❌'}`,
      globalState ? LI_LOG_STYLES.success : LI_LOG_STYLES.error
    );

    liSeparator();
    liHeader('ГОТОВ');

    return this.getFullState();
  }

  // ============================================================
  // 11. ОЧИСТКА СТАРЫХ ИНСТАНСОВ (СТАТИЧЕСКИЙ МЕТОД)
  // ============================================================

  /**
   * Очистить старые инстансы (оставить только последние N)
   * @param {number} keepCount - количество инстансов для сохранения
   * @returns {number} количество удалённых инстансов
   */
  static cleanupOldInstances(keepCount = 3) {
    liLog(`🧹 Очистка старых инстансов (оставить ${keepCount})...`, null, 'info');

    if (!window.__debugInstances) {
      liLog('⚠️ Реестр инстансов не найден', null, 'warn');
      return 0;
    }

    const instances = Object.keys(window.__debugInstances);
    if (instances.length <= keepCount) {
      liLog(`✅ Инстансов не больше ${keepCount}, очистка не требуется`, null, 'success');
      return 0;
    }

    // Сортируем по дате создания (старые сначала)
    const sorted = instances.sort((a, b) => {
      const dataA = window.__debugInstances[a];
      const dataB = window.__debugInstances[b];
      const dateA = dataA?.created ? new Date(dataA.created) : new Date(0);
      const dateB = dataB?.created ? new Date(dataB.created) : new Date(0);
      return dateA - dateB;
    });

    // ИСПРАВЛЕНО: Объявляем toRemove здесь, до использования
    const toRemove = sorted.slice(0, sorted.length - keepCount);

    liLog(
      `🗑️ Будет удалено ${toRemove.length} старых инстансов`,
      {
        toRemove: toRemove.map(id => id.slice(-8)),
        keepCount: keepCount,
        total: instances.length,
      },
      'warn'
    );

    let removedCount = 0;
    let errors = [];

    for (const id of toRemove) {
      try {
        const instance = window.__debugInstances[id];
        if (instance && typeof instance.destroy === 'function') {
          instance.destroy();
          liLog(`🗑️ Удалён инстанс (через destroy): ${id.slice(-8)}`, null, 'info');
        } else {
          // Если нет метода destroy, удаляем вручную
          if (instance && instance.panel && instance.panel.parentNode) {
            instance.panel.parentNode.removeChild(instance.panel);
            liLog(`🗑️ Удалена панель инстанса: ${id.slice(-8)}`, null, 'info');
          }
          // Удаляем из глобального состояния
          if (globalState && globalState.destroyInstance) {
            globalState.destroyInstance(id);
            liLog(`🗑️ Инстанс удалён из глобального состояния: ${id.slice(-8)}`, null, 'info');
          }
          delete window.__debugInstances[id];
          liLog(`🗑️ Принудительно удалён инстанс: ${id.slice(-8)}`, null, 'info');
        }
        removedCount++;
      } catch (e) {
        liLog(`⚠️ Ошибка удаления инстанса ${id.slice(-8)}: ${e.message}`, null, 'error');
        errors.push({ id: id.slice(-8), error: e.message });
        // Пробуем удалить вручную
        try {
          // Удаляем из глобального состояния
          if (globalState && globalState.destroyInstance) {
            globalState.destroyInstance(id);
          }
          delete window.__debugInstances[id];
          removedCount++;
          liLog(`🗑️ Принудительно удалён (после ошибки): ${id.slice(-8)}`, null, 'info');
        } catch (e2) {
          liLog(`❌ Не удалось удалить инстанс ${id.slice(-8)}: ${e2.message}`, null, 'error');
        }
      }
    }

    // Очищаем localStorage от старых инстансов
    try {
      const keys = Object.keys(localStorage);
      let localStorageCount = 0;
      let removedKeys = [];
      for (const key of keys) {
        if (key.startsWith('debug-instance-') || key.startsWith('bookmarklet-')) {
          const id = key.replace('debug-instance-', '');
          // Проверяем, существует ли ещё этот инстанс
          if (!window.__debugInstances[id]) {
            localStorage.removeItem(key);
            localStorageCount++;
            removedKeys.push(key);
          }
        }
      }
      if (localStorageCount > 0) {
        liLog(
          `🗑️ Удалено ${localStorageCount} записей из localStorage`,
          {
            keys: removedKeys,
          },
          'info'
        );
      }
    } catch (e) {
      liLog(`⚠️ Ошибка очистки localStorage: ${e.message}`, null, 'error');
    }

    const remaining = Object.keys(window.__debugInstances).length;
    liLog(
      `✅ Очистка завершена`,
      {
        removed: removedCount,
        remaining: remaining,
        errors: errors.length,
      },
      'success'
    );

    if (errors.length > 0) {
      liLog(`⚠️ Ошибок при удалении: ${errors.length}`, errors, 'warn');
    }

    return removedCount;
  }

  // ============================================================
  // 12. ОЧИСТКА localStorage ОТ МУСОРА (СТАТИЧЕСКИЙ МЕТОД)
  // ============================================================

  /**
   * Очистить localStorage от мусорных записей
   * @returns {Object} результат очистки
   */
  static cleanupLocalStorage() {
    liLog('🧹 Очистка localStorage от мусора...', null, 'info');

    try {
      const keys = Object.keys(localStorage);
      let removedCount = 0;
      let keptCount = 0;
      const removedKeys = [];

      for (const key of keys) {
        // Проверяем ключи, связанные с букмарклетами
        if (
          key.startsWith('debug-instance-') ||
          key.startsWith('bookmarklet-') ||
          key.startsWith('env-panel-') ||
          key.startsWith('logs-panel-') ||
          key.startsWith('debug-panel-') ||
          key.startsWith('shared_') ||
          key === 'debug' ||
          key === 'env-panel-instances' ||
          key === 'env-panel-current-instance'
        ) {
          // Проверяем, существует ли ещё инстанс для этого ключа
          let isActive = false;
          if (key.startsWith('debug-instance-')) {
            const id = key.replace('debug-instance-', '');
            if (window.__debugInstances && window.__debugInstances[id]) {
              isActive = true;
            }
          }

          // Проверяем, используется ли ключ для глобального состояния
          if (
            key === 'debug' ||
            key === 'env-panel-instances' ||
            key === 'env-panel-current-instance'
          ) {
            // Эти ключи всегда нужны
            isActive = true;
          }

          if (!isActive) {
            localStorage.removeItem(key);
            removedCount++;
            removedKeys.push(key);
          } else {
            keptCount++;
          }
        }
      }

      if (removedCount > 0) {
        liLog(
          `🗑️ Удалено ${removedCount} записей из localStorage`,
          {
            removed: removedKeys,
            kept: keptCount,
          },
          'info'
        );
      } else {
        liLog('✅ Мусора в localStorage не найдено', null, 'success');
      }

      return { removed: removedCount, kept: keptCount, keys: removedKeys };
    } catch (e) {
      liLog(`⚠️ Ошибка очистки localStorage: ${e.message}`, null, 'error');
      return { removed: 0, kept: 0, keys: [], error: e.message };
    }
  }

  // ============================================================
  // 13. ПОЛНАЯ ОЧИСТКА ВСЕГО (СТАТИЧЕСКИЙ МЕТОД)
  // ============================================================

  /**
   * Полная очистка всех данных букмарклета
   * @param {number} keepCount - количество инстансов для сохранения
   * @returns {Object} результат очистки
   */
  static cleanupAll(keepCount = 3) {
    liHeader('ПОЛНАЯ ОЧИСТКА');
    liLog('🧹 Запуск полной очистки...', null, 'warn');

    // Очищаем старые инстансы
    const instancesRemoved = LocalInstance.cleanupOldInstances(keepCount);

    // Очищаем localStorage
    const storageResult = LocalInstance.cleanupLocalStorage();

    // Очищаем кеш браузера
    try {
      if ('caches' in window) {
        caches
          .keys()
          .then(keys => {
            for (const key of keys) {
              if (key.includes('bookmarklet') || key.includes('widget')) {
                caches.delete(key);
                liLog(`🗑️ Удалён кеш: ${key}`, null, 'info');
              }
            }
          })
          .catch(e => {
            liLog(`⚠️ Ошибка очистки кеша: ${e.message}`, null, 'error');
          });
      }
    } catch (e) {
      liLog(`⚠️ Ошибка очистки кеша: ${e.message}`, null, 'error');
    }

    liSeparator();
    liLog('📊 РЕЗУЛЬТАТЫ ОЧИСТКИ:', null, 'header');
    liLog(`  🗑️ Удалено инстансов: ${instancesRemoved}`, null, 'info');
    liLog(`  🗑️ Удалено записей localStorage: ${storageResult.removed || 0}`, null, 'info');
    liLog(
      `  📊 Осталось инстансов: ${Object.keys(window.__debugInstances || {}).length}`,
      null,
      'info'
    );
    liLog(`  📊 Осталось записей localStorage: ${storageResult.kept || 0}`, null, 'info');
    liSeparator();
    liLog('✅ Полная очистка завершена', null, 'success');
    liHeader('ГОТОВ');

    return {
      instancesRemoved,
      storageRemoved: storageResult.removed || 0,
      storageKept: storageResult.kept || 0,
      remainingInstances: Object.keys(window.__debugInstances || {}).length,
    };
  }
}

// ============================================================
// 14. ЭКСПОРТ
// ============================================================

liLog(
  '📦 Модуль LocalInstance загружен',
  {
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    methods: [
      'constructor',
      'getState',
      'getPanelState',
      'getFullState',
      'runPanel',
      'showPanel',
      'hidePanel',
      'togglePanel',
      'closePanel',
      'sync',
      'export',
      'import',
      'reset',
      'getHistory',
      'clearHistory',
      'set',
      'get',
      'getInstances',
      'getInstanceId',
      'checkSharedMemory',
      'getGlobalStats',
      'on',
      'off',
      'destroy',
      'reload',
      'debug',
      'cleanupOldInstances (static)',
      'cleanupLocalStorage (static)',
      'cleanupAll (static)',
    ],
  },
  'success'
);

export default LocalInstance;
