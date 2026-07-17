// core/GlobalState.js - Глобальное состояние (общее для всех букмарклетов)
// ОБНОВЛЕНО: Добавлена поддержка множественных инстансов с изолированными состояниями
// ОБНОВЛЕНО: Добавлено расширенное debug-логирование
// ОБНОВЛЕНО: Исправлена загрузка состояний инстансов (instancesStates)

import sharedMemory from './SharedMemory.js';

// ============================================================
// 1. DEBUG-ЛОГГЕР ДЛЯ GLOBALSTATE
// ============================================================

const LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  instance: 'color: #667eea; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #dfe6e9;',
};

function gsLog(message, data = null, style = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `%c[${timestamp}] %c[GlobalState]`;
  const styles = [LOG_STYLES.info, LOG_STYLES.instance];

  if (data !== null && data !== undefined) {
    console.log(prefix + ' %c' + message, ...styles, LOG_STYLES[style] || LOG_STYLES.info, data);
  } else {
    console.log(prefix + ' %c' + message, ...styles, LOG_STYLES[style] || LOG_STYLES.info);
  }
}

function gsHeader(title) {
  console.log('%c' + '═'.repeat(60), LOG_STYLES.separator);
  console.log('%c  🌍 ' + title, LOG_STYLES.header);
  console.log('%c' + '═'.repeat(60), LOG_STYLES.separator);
}

function gsSeparator() {
  console.log('%c' + '─'.repeat(60), LOG_STYLES.separator);
}

// ============================================================
// 2. КОНСТАНТЫ
// ============================================================

const STORAGE_KEYS = {
  VISIBLE: 'env-panel-visible',
  HIDDEN: 'env-panel-hidden',
  POSITION: 'env-panel-position',
  SIZE: 'env-panel-size',
  ZINDEX: 'env-panel-zindex',
  MINIMIZED: 'env-panel-minimized',
  FULLSCREEN: 'env-panel-fullscreen',
  NAMESPACE: 'env-panel-namespace',
  PRESETS: 'env-panel-presets',
  STATE_VERSION: 'env-panel-state-version',
  INSTANCES: 'env-panel-instances',
  CURRENT_INSTANCE: 'env-panel-current-instance',
  INSTANCE_PREFIX: 'debug-instance-',
};

const DEFAULT_STATE = {
  visible: true,
  hidden: false,
  position: { x: 20, y: 20, unit: 'px' },
  size: { width: 380, height: 520 },
  zIndex: 99996,
  minimized: false,
  fullscreen: false,
  namespace: '',
  presets: [],
  panelExists: false,
  isReady: false,
  version: '2.0.0',
  lastModified: null,
  instances: [],
  instancesStates: {},
  activeInstanceId: null,
};

// ============================================================
// 3. КЛАСС GLOBALSTATE
// ============================================================

class GlobalState {
  constructor() {
    gsHeader('ИНИЦИАЛИЗАЦИЯ ГЛОБАЛЬНОГО СОСТОЯНИЯ');

    this._listeners = new Map();
    this._history = [];
    this._maxHistory = 100;
    this._instanceId = this._generateInstanceId();
    this._state = this._loadState();
    this._state.lastModified = new Date().toISOString();
    this._sharedMemoryReady = false;

    gsLog('🆔 Создан инстанс GlobalState:', this._instanceId, 'instance');

    this._registerInstance();

    this._initSharedMemory();

    localStorage.setItem(STORAGE_KEYS.CURRENT_INSTANCE, this._instanceId);

    gsLog(
      '📊 Текущее состояние загружено',
      {
        instances: this._state.instances.length,
        hasStates: !!this._state.instancesStates,
        activeInstance: this._state.activeInstanceId,
      },
      'info'
    );

    return this._createProxy();
  }

  // ============================================================
  // 4. ГЕНЕРАЦИЯ ID
  // ============================================================

  _generateInstanceId() {
    const id = 'bookmarklet-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    gsLog('🔑 Сгенерирован ID:', id, 'instance');
    return id;
  }

  // ============================================================
  // 5. SHARED MEMORY
  // ============================================================

  _initSharedMemory() {
    gsLog('🔍 Проверка SharedMemory...', null, 'info');

    if (!sharedMemory.isSupported()) {
      gsLog('📌 SharedMemory не поддерживается, используем localStorage', null, 'warn');
      return;
    }

    try {
      const result = sharedMemory.reinit();

      if (result) {
        this._sharedMemoryReady = true;
        gsLog('✅ SharedMemory инициализирован', null, 'success');

        sharedMemory.setInstanceId(this._instanceId);

        sharedMemory.subscribe('*', data => {
          if (data.key && data.key in this._state) {
            gsLog(`📡 Получено из SharedMemory: ${data.key} =`, data.value, 'info');
            const oldValue = this._state[data.key];
            this._state[data.key] = data.value;
            this._saveState();
            this._notify(data.key, data.value, oldValue);
          }
        });

        this._registerInstance();
      } else {
        gsLog('📌 SharedMemory не инициализирован, используем localStorage', null, 'warn');
      }
    } catch (error) {
      gsLog('⚠️ Ошибка инициализации SharedMemory:', error.message, 'error');
      gsLog('📌 Используем localStorage как fallback', null, 'warn');
    }
  }

  // ============================================================
  // 6. РЕГИСТРАЦИЯ ИНСТАНСА
  // ============================================================

  _registerInstance() {
    gsLog('📝 Регистрация инстанса...', null, 'info');

    try {
      let instances = this.getInstances();
      if (!instances.includes(this._instanceId)) {
        instances.push(this._instanceId);
        localStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));
        localStorage.setItem(STORAGE_KEYS.CURRENT_INSTANCE, this._instanceId);
        gsLog(`✅ Инстанс ${this._instanceId.slice(-8)} добавлен в реестр`, null, 'success');
      }
      this._state.instances = instances;

      // Инициализируем instancesStates если его нет
      if (!this._state.instancesStates) {
        this._state.instancesStates = {};
        gsLog('📦 Создан объект instancesStates', null, 'info');
      }

      // Создаём состояние для текущего инстанса
      if (!this._state.instancesStates[this._instanceId]) {
        this._state.instancesStates[this._instanceId] = {
          visible: true,
          minimized: false,
          fullscreen: false,
          position: { x: 20 + Math.random() * 100, y: 20 + Math.random() * 100, unit: 'px' },
          size: { width: 380, height: 520 },
          zIndex: 99996 + Math.floor(Math.random() * 100),
          namespace: '',
          panelExists: false,
          isReady: false,
          lastModified: new Date().toISOString(),
        };
        this._saveInstanceState(this._instanceId);
        gsLog(`✅ Состояние для инстанса ${this._instanceId.slice(-8)} создано`, null, 'success');
      }

      if (this._sharedMemoryReady) {
        sharedMemory.publish('instances', instances);
        sharedMemory.publish('instancesStates', this._state.instancesStates);
        gsLog('📡 Данные опубликованы в SharedMemory', null, 'info');
      }

      gsLog(`📊 Всего инстансов: ${instances.length}`, instances.length, 'info');
    } catch (e) {
      gsLog('⚠️ Ошибка регистрации экземпляра:', e.message, 'error');
    }
  }

  // ============================================================
  // 7. СОХРАНЕНИЕ/ЗАГРУЗКА СОСТОЯНИЯ ИНСТАНСА
  // ============================================================

  _saveInstanceState(instanceId) {
    try {
      const key = STORAGE_KEYS.INSTANCE_PREFIX + instanceId;
      const state = this._state.instancesStates[instanceId];
      if (state) {
        const data = {
          ...state,
          lastModified: new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(data));
        gsLog(
          `💾 Состояние инстанса ${instanceId.slice(-8)} сохранено`,
          {
            key: key,
            size: JSON.stringify(data).length,
          },
          'info'
        );
      }
    } catch (e) {
      gsLog(`⚠️ Ошибка сохранения состояния инстанса ${instanceId}:`, e.message, 'error');
    }
  }

  _loadInstanceState(instanceId) {
    try {
      const key = STORAGE_KEYS.INSTANCE_PREFIX + instanceId;
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        // ИСПРАВЛЕНО: Проверяем существование instancesStates
        if (!this._state.instancesStates) {
          this._state.instancesStates = {};
          gsLog(
            `📦 Создан instancesStates при загрузке инстанса ${instanceId.slice(-8)}`,
            null,
            'info'
          );
        }
        this._state.instancesStates[instanceId] = {
          ...this._state.instancesStates[instanceId],
          ...data,
        };
        gsLog(
          `📥 Состояние инстанса ${instanceId.slice(-8)} загружено`,
          {
            key: key,
            size: raw.length,
          },
          'info'
        );
        return this._state.instancesStates[instanceId];
      }
    } catch (e) {
      // ИСПРАВЛЕНО: Игнорируем ошибки загрузки, просто логируем
      gsLog(
        `⚠️ Ошибка загрузки состояния инстанса ${instanceId.slice(-8)}: ${e.message}`,
        null,
        'warn'
      );
    }
    return null;
  }

  _removeInstanceState(instanceId) {
    try {
      const key = STORAGE_KEYS.INSTANCE_PREFIX + instanceId;
      localStorage.removeItem(key);
      if (this._state.instancesStates) {
        delete this._state.instancesStates[instanceId];
      }
      gsLog(`🗑️ Состояние инстанса ${instanceId.slice(-8)} удалено`, null, 'warn');
    } catch (e) {
      gsLog(`⚠️ Ошибка удаления состояния инстанса ${instanceId}:`, e.message, 'error');
    }
  }

  // ============================================================
  // 8. УДАЛЕНИЕ ИНСТАНСА
  // ============================================================

  _unregisterInstance() {
    gsLog(`🗑️ Удаление инстанса ${this._instanceId.slice(-8)}...`, null, 'warn');

    try {
      let instances = this.getInstances();
      const index = instances.indexOf(this._instanceId);
      if (index !== -1) {
        instances.splice(index, 1);
        localStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));

        if (instances.length > 0) {
          localStorage.setItem(STORAGE_KEYS.CURRENT_INSTANCE, instances[0]);
          gsLog(`📌 Активный инстанс изменён на ${instances[0].slice(-8)}`, null, 'info');
        } else {
          localStorage.removeItem(STORAGE_KEYS.CURRENT_INSTANCE);
          gsLog('📌 Активных инстансов не осталось', null, 'warn');
        }
      }
      this._state.instances = instances;

      this._removeInstanceState(this._instanceId);

      if (this._sharedMemoryReady) {
        sharedMemory.publish('instances', instances);
        gsLog('📡 Данные обновлены в SharedMemory', null, 'info');
      }

      gsLog(
        `✅ Инстанс ${this._instanceId.slice(-8)} удалён. Осталось: ${instances.length}`,
        null,
        'success'
      );
    } catch (e) {
      gsLog('⚠️ Ошибка удаления экземпляра:', e.message, 'error');
    }
  }

  // ============================================================
  // 9. PROXY
  // ============================================================

  _createProxy() {
    const target = this;

    return new Proxy(target, {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        if (prop in target._state) {
          return target._state[prop];
        }
        return undefined;
      },

      set(target, prop, value) {
        if (prop in target._state) {
          const oldValue = target._state[prop];
          if (oldValue === value) return true;

          target._state[prop] = value;
          target._state.lastModified = new Date().toISOString();
          target._saveState();
          target._notify(prop, value, oldValue);
          target._addHistory(prop, value, oldValue);

          if (target._sharedMemoryReady) {
            sharedMemory.publish(prop, value, oldValue);
          }

          return true;
        }
        target[prop] = value;
        return true;
      },

      has(target, prop) {
        return prop in target || prop in target._state;
      },

      ownKeys(target) {
        return [...new Set([...Object.keys(target), ...Object.keys(target._state)])];
      },

      getOwnPropertyDescriptor(target, prop) {
        if (prop in target._state) {
          return {
            enumerable: true,
            configurable: true,
            value: target._state[prop],
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
  }

  // ============================================================
  // 10. ЗАГРУЗКА/СОХРАНЕНИЕ
  // ============================================================

  _loadState() {
    gsLog('📥 Загрузка состояния из localStorage...', null, 'info');

    const state = { ...DEFAULT_STATE };

    try {
      const version = localStorage.getItem(STORAGE_KEYS.STATE_VERSION);
      if (version) {
        state.version = version;
        gsLog(`📌 Версия состояния: ${version}`, null, 'info');
      }

      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        if (
          key === 'STATE_VERSION' ||
          key === 'INSTANCES' ||
          key === 'CURRENT_INSTANCE' ||
          key === 'INSTANCE_PREFIX'
        )
          continue;

        const value = localStorage.getItem(storageKey);
        if (value === null) continue;

        const stateKey = key.toLowerCase();
        switch (key) {
          case 'VISIBLE':
            state.visible = value === 'true';
            break;
          case 'HIDDEN':
            state.hidden = value === 'true';
            break;
          case 'POSITION':
            try {
              state.position = JSON.parse(value);
            } catch {
              /* ignore */
            }
            break;
          case 'SIZE':
            try {
              state.size = JSON.parse(value);
            } catch {
              /* ignore */
            }
            break;
          case 'ZINDEX':
            state.zIndex = parseInt(value) || 99996;
            break;
          case 'MINIMIZED':
            state.minimized = value === 'true';
            break;
          case 'FULLSCREEN':
            state.fullscreen = value === 'true';
            break;
          case 'NAMESPACE':
            state.namespace = value;
            break;
          case 'PRESETS':
            try {
              state.presets = JSON.parse(value);
            } catch {
              /* ignore */
            }
            break;
        }
      }

      const wasHidden = localStorage.getItem(STORAGE_KEYS.HIDDEN) === 'true';
      if (wasHidden && state.visible) {
        state.visible = false;
      }

      // Загружаем список инстансов
      state.instances = this.getInstances();

      // ИСПРАВЛЕНО: Всегда инициализируем instancesStates
      state.instancesStates = {};

      // Загружаем состояния для каждого инстанса
      for (const instanceId of state.instances) {
        const instanceState = this._loadInstanceState(instanceId);
        if (instanceState) {
          state.instancesStates[instanceId] = instanceState;
        } else {
          // Если состояние не загрузилось, создаём дефолтное
          state.instancesStates[instanceId] = {
            visible: true,
            minimized: false,
            fullscreen: false,
            position: { x: 20 + Math.random() * 100, y: 20 + Math.random() * 100, unit: 'px' },
            size: { width: 380, height: 520 },
            zIndex: 99996 + Math.floor(Math.random() * 100),
            namespace: '',
            panelExists: false,
            isReady: false,
            lastModified: new Date().toISOString(),
          };
          gsLog(
            `📦 Создано дефолтное состояние для инстанса ${instanceId.slice(-8)}`,
            null,
            'info'
          );
        }
      }

      gsLog(
        `✅ Состояние загружено. Инстансов: ${state.instances.length}`,
        {
          instances: state.instances.map(id => id.slice(-8)),
          statesCount: Object.keys(state.instancesStates).length,
        },
        'success'
      );
    } catch (e) {
      gsLog('⚠️ Ошибка загрузки состояния:', e.message, 'error');
      // Инициализируем instancesStates даже при ошибке
      if (!state.instancesStates) {
        state.instancesStates = {};
      }
    }

    return state;
  }

  _saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.STATE_VERSION, this._state.version);

      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        if (
          key === 'STATE_VERSION' ||
          key === 'INSTANCES' ||
          key === 'CURRENT_INSTANCE' ||
          key === 'INSTANCE_PREFIX'
        )
          continue;

        const stateKey = key.toLowerCase();
        let value = this._state[stateKey];

        if (typeof value === 'object') {
          localStorage.setItem(storageKey, JSON.stringify(value));
        } else {
          localStorage.setItem(storageKey, String(value));
        }
      }

      this._saveInstanceState(this._instanceId);

      gsLog('💾 Состояние сохранено', null, 'info');
    } catch (e) {
      gsLog('⚠️ Ошибка сохранения состояния:', e.message, 'error');
    }
  }

  // ============================================================
  // 11. УВЕДОМЛЕНИЯ
  // ============================================================

  _notify(key, value, oldValue) {
    const listeners = this._listeners.get(key) || [];
    const allListeners = this._listeners.get('*') || [];

    const event = { key, value, oldValue, timestamp: Date.now(), instanceId: this._instanceId };

    gsLog(`🔔 Уведомление: ${key}`, { oldValue, value }, 'info');

    for (const listener of [...listeners, ...allListeners]) {
      try {
        listener(event);
      } catch (e) {
        gsLog('⚠️ Ошибка в listener:', e.message, 'error');
      }
    }
  }

  _addHistory(key, value, oldValue) {
    this._history.push({
      key,
      value,
      oldValue,
      timestamp: new Date().toISOString(),
      instanceId: this._instanceId,
    });
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }
    gsLog(`📜 История добавлена: ${key}`, { count: this._history.length }, 'info');
  }

  // ============================================================
  // 12. ПУБЛИЧНЫЕ МЕТОДЫ
  // ============================================================

  on(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, []);
    }
    this._listeners.get(key).push(callback);
    gsLog(`👂 Добавлен слушатель для "${key}"`, null, 'info');
    return () => this.off(key, callback);
  }

  off(key, callback) {
    if (this._listeners.has(key)) {
      const listeners = this._listeners.get(key);
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
        gsLog(`👂 Удалён слушатель для "${key}"`, null, 'info');
      }
    }
  }

  getState() {
    gsLog('📊 Получение состояния', null, 'info');
    return { ...this._state };
  }

  get(key) {
    const value = this._state[key];
    gsLog(`📖 Получение "${key}":`, value, 'info');
    return value;
  }

  set(key, value) {
    gsLog(`✏️ Установка "${key}":`, value, 'info');
    this[key] = value;
    return this;
  }

  reset() {
    gsLog('🔄 Сброс состояния к дефолтному', null, 'warn');
    const oldState = { ...this._state };
    this._state = {
      ...DEFAULT_STATE,
      lastModified: new Date().toISOString(),
      instances: this.getInstances(),
      instancesStates: {},
    };

    // Восстанавливаем состояния для существующих инстансов
    for (const instanceId of this._state.instances) {
      this._state.instancesStates[instanceId] = {
        visible: true,
        minimized: false,
        fullscreen: false,
        position: { x: 20 + Math.random() * 100, y: 20 + Math.random() * 100, unit: 'px' },
        size: { width: 380, height: 520 },
        zIndex: 99996 + Math.floor(Math.random() * 100),
        namespace: '',
        panelExists: false,
        isReady: false,
        lastModified: new Date().toISOString(),
      };
      this._saveInstanceState(instanceId);
    }

    this._saveState();
    this._notify('reset', this._state, oldState);
    gsLog('✅ Состояние сброшено', null, 'success');
    return this;
  }

  getHistory() {
    gsLog(`📜 Получение истории (${this._history.length} записей)`, null, 'info');
    return [...this._history];
  }

  clearHistory() {
    gsLog('🗑️ Очистка истории', null, 'warn');
    this._history = [];
    return this;
  }

  getInstanceId() {
    return this._instanceId;
  }

  getInstances() {
    try {
      const instances = JSON.parse(localStorage.getItem(STORAGE_KEYS.INSTANCES) || '[]');
      return Array.isArray(instances) ? instances : [];
    } catch (e) {
      return [];
    }
  }

  getCurrentInstance() {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_INSTANCE) || null;
  }

  getInstanceState(instanceId) {
    gsLog(`📖 Получение состояния инстанса ${instanceId.slice(-8)}`, null, 'info');

    // Проверяем, существует ли instancesStates
    if (!this._state.instancesStates) {
      this._state.instancesStates = {};
    }

    if (instanceId === this._instanceId) {
      return this._state.instancesStates[instanceId] || null;
    }
    return this._loadInstanceState(instanceId);
  }

  updateInstanceState(instanceId, updates) {
    gsLog(`✏️ Обновление состояния инстанса ${instanceId.slice(-8)}`, updates, 'info');

    if (!this._state.instancesStates) {
      this._state.instancesStates = {};
    }
    if (!this._state.instancesStates[instanceId]) {
      this._state.instancesStates[instanceId] = {};
    }
    Object.assign(this._state.instancesStates[instanceId], updates);
    this._saveInstanceState(instanceId);
    this._notify('instanceStateUpdate', { instanceId, updates }, null);
    return this._state.instancesStates[instanceId];
  }

  setActiveInstance(instanceId) {
    gsLog(`🎯 Установка активного инстанса: ${instanceId.slice(-8)}`, null, 'info');
    this._state.activeInstanceId = instanceId;
    this._saveState();
    this._notify('activeInstanceChanged', instanceId, null);
  }

  getActiveInstance() {
    return this._state.activeInstanceId || this._instanceId;
  }

  getSharedMemoryStats() {
    return sharedMemory.getStats();
  }

  isSharedMemorySupported() {
    return sharedMemory.isSupported();
  }

  isSharedMemoryReady() {
    return this._sharedMemoryReady;
  }

  isFallbackMode() {
    return sharedMemory.isFallbackMode();
  }

  destroy() {
    gsLog(`🗑️ Уничтожение GlobalState (${this._instanceId.slice(-8)})`, null, 'warn');
    this._unregisterInstance();
    if (this._sharedMemoryReady) {
      sharedMemory.publish('instance-removed', this._instanceId);
    }
    sharedMemory.destroy();
    gsLog('✅ GlobalState уничтожен', null, 'success');
  }

  destroyInstance(instanceId) {
    gsLog(`🗑️ Уничтожение инстанса ${instanceId.slice(-8)}`, null, 'warn');

    if (instanceId === this._instanceId) {
      this.destroy();
      return true;
    }

    const instances = this.getInstances();
    if (!instances.includes(instanceId)) {
      gsLog(`❌ Инстанс ${instanceId.slice(-8)} не найден`, null, 'error');
      return false;
    }

    const newInstances = instances.filter(id => id !== instanceId);
    localStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(newInstances));
    if (this._state.activeInstanceId === instanceId) {
      this._state.activeInstanceId = newInstances[0] || null;
    }
    this._removeInstanceState(instanceId);
    this._state.instances = newInstances;
    this._saveState();
    this._notify('instances', newInstances, instances);

    gsLog(
      `✅ Инстанс ${instanceId.slice(-8)} уничтожен. Осталось: ${newInstances.length}`,
      null,
      'success'
    );
    return true;
  }

  export() {
    gsLog('📤 Экспорт состояния', null, 'info');
    const data = {
      state: this._state,
      history: this._history,
      instanceId: this._instanceId,
      instances: this.getInstances(),
      currentInstance: this.getCurrentInstance(),
      instancesStates: this._state.instancesStates || {},
      sharedMemory: this._sharedMemoryReady ? sharedMemory.getStats() : null,
      timestamp: new Date().toISOString(),
    };
    gsLog(`📊 Экспортировано ${JSON.stringify(data).length} байт`, null, 'info');
    return JSON.stringify(data, null, 2);
  }

  import(json) {
    gsLog('📥 Импорт состояния', null, 'info');

    try {
      const data = JSON.parse(json);
      if (data.state) {
        this._state = { ...this._state, ...data.state };
        this._state.lastModified = new Date().toISOString();

        if (data.instancesStates) {
          this._state.instancesStates = data.instancesStates;
          for (const [id, state] of Object.entries(data.instancesStates)) {
            this._saveInstanceState(id);
          }
        }

        this._saveState();
        this._notify('import', this._state, null);
        gsLog(`✅ Импорт успешен. Инстансов: ${this._state.instances.length}`, null, 'success');
        return true;
      }
      return false;
    } catch (e) {
      gsLog('⚠️ Ошибка импорта:', e.message, 'error');
      return false;
    }
  }

  compareWithStorage() {
    gsLog('🔍 Сравнение с localStorage...', null, 'info');

    const storageState = {};
    const differences = {};
    let hasDifferences = false;

    try {
      for (const [key, storageKey] of Object.entries(STORAGE_KEYS)) {
        if (
          key === 'STATE_VERSION' ||
          key === 'INSTANCES' ||
          key === 'CURRENT_INSTANCE' ||
          key === 'INSTANCE_PREFIX'
        )
          continue;
        const value = localStorage.getItem(storageKey);
        if (value !== null) {
          const stateKey = key.toLowerCase();
          switch (key) {
            case 'VISIBLE':
              storageState[stateKey] = value === 'true';
              break;
            case 'HIDDEN':
              storageState[stateKey] = value === 'true';
              break;
            case 'POSITION':
            case 'SIZE':
            case 'PRESETS':
              try {
                storageState[stateKey] = JSON.parse(value);
              } catch {
                storageState[stateKey] = value;
              }
              break;
            case 'ZINDEX':
              storageState[stateKey] = parseInt(value) || 99996;
              break;
            case 'MINIMIZED':
              storageState[stateKey] = value === 'true';
              break;
            case 'FULLSCREEN':
              storageState[stateKey] = value === 'true';
              break;
            default:
              storageState[stateKey] = value;
          }
        }
      }
    } catch (e) {
      gsLog('⚠️ Ошибка сравнения:', e.message, 'error');
    }

    for (const [key, value] of Object.entries(storageState)) {
      if (key === 'lastModified' || key === 'version') continue;
      if (JSON.stringify(this._state[key]) !== JSON.stringify(value)) {
        differences[key] = {
          current: this._state[key],
          storage: value,
        };
        hasDifferences = true;
      }
    }

    if (hasDifferences) {
      gsLog('📊 Обнаружены различия:', differences, 'warn');
    } else {
      gsLog('✅ Состояния синхронизированы', null, 'success');
    }

    return { hasDifferences, differences, storageState, currentState: this._state };
  }

  syncWithStorage(choice = 'merge') {
    gsLog(`🔄 Синхронизация с localStorage (${choice})...`, null, 'info');

    const comparison = this.compareWithStorage();
    if (!comparison.hasDifferences) {
      gsLog('✅ Состояния синхронизированы', null, 'success');
      return true;
    }

    if (choice === 'storage') {
      const newState = this._loadState();
      Object.assign(this._state, newState);
      this._state.lastModified = new Date().toISOString();
      gsLog('📥 Состояние загружено из localStorage', null, 'info');
    } else if (choice === 'current') {
      this._saveState();
      gsLog('📤 Текущее состояние сохранено в localStorage', null, 'info');
    } else if (choice === 'merge') {
      const storageState = this._loadState();
      Object.assign(this._state, storageState, this._state);
      this._state.lastModified = new Date().toISOString();
      this._saveState();
      gsLog('🔀 Состояния объединены (storage имеет приоритет)', null, 'info');
    }

    this._notify('sync', this._state, null);
    return true;
  }

  getInstancesInfo() {
    const instances = this.getInstances();
    const current = this.getCurrentInstance();
    const info = {
      total: instances.length,
      current: current,
      list: instances,
      states: this._state.instancesStates || {},
      isCurrent: id => id === current,
      getState: id => this.getInstanceState(id),
    };
    gsLog(`📊 Информация об инстансах: ${info.total}`, info, 'info');
    return info;
  }

  isInstanceActive(instanceId) {
    const instances = this.getInstances();
    return instances.includes(instanceId);
  }

  getInstancesCount() {
    return this.getInstances().length;
  }

  getAllInstancesStates() {
    const states = {};
    const instances = this.getInstances();
    for (const id of instances) {
      states[id] = this.getInstanceState(id);
    }
    gsLog(`📊 Получены состояния всех инстансов (${instances.length})`, null, 'info');
    return states;
  }

  clearOtherInstances() {
    const instances = this.getInstances();
    const otherInstances = instances.filter(id => id !== this._instanceId);
    gsLog(`🗑️ Очистка других инстансов (${otherInstances.length})`, null, 'warn');

    for (const id of otherInstances) {
      this.destroyInstance(id);
    }

    gsLog(`✅ Очищено ${otherInstances.length} инстансов`, null, 'success');
    return otherInstances.length;
  }

  resetInstanceState(instanceId) {
    gsLog(`🔄 Сброс состояния инстанса ${instanceId.slice(-8)} к дефолтному`, null, 'warn');

    if (!this._state.instancesStates) {
      this._state.instancesStates = {};
    }
    this._state.instancesStates[instanceId] = {
      visible: true,
      minimized: false,
      fullscreen: false,
      position: { x: 20 + Math.random() * 100, y: 20 + Math.random() * 100, unit: 'px' },
      size: { width: 380, height: 520 },
      zIndex: 99996 + Math.floor(Math.random() * 100),
      namespace: '',
      panelExists: false,
      isReady: false,
      lastModified: new Date().toISOString(),
    };
    this._saveInstanceState(instanceId);
    this._notify('instanceStateReset', { instanceId }, null);

    gsLog(`✅ Состояние инстанса ${instanceId.slice(-8)} сброшено`, null, 'success');
    return this._state.instancesStates[instanceId];
  }
}

// ============================================================
// 13. СОЗДАНИЕ ГЛОБАЛЬНОГО ЭКЗЕМПЛЯРА
// ============================================================

let globalStateInstance = null;

function getGlobalState() {
  if (!globalStateInstance) {
    gsHeader('СОЗДАНИЕ ГЛОБАЛЬНОГО ЭКЗЕМПЛЯРА');
    globalStateInstance = new GlobalState();

    if (typeof window !== 'undefined') {
      window.__globalState = globalStateInstance;
      gsLog('🌍 GlobalState добавлен в window.__globalState', null, 'success');
    }

    const instances = globalStateInstance.getInstances();
    gsSeparator();
    gsLog('📊 ИТОГОВАЯ ИНФОРМАЦИЯ:', null, 'header');
    gsLog(`  📌 Instance ID: ${globalStateInstance.getInstanceId()}`, null, 'instance');
    gsLog(`  📌 Инстансов: ${instances.length}`, null, 'info');
    gsLog(
      `  📌 Текущий: ${globalStateInstance.getCurrentInstance()?.slice(-8) || 'нет'}`,
      null,
      'info'
    );
    gsLog(
      `  📌 SharedMemory: ${globalStateInstance.isSharedMemorySupported() ? '✅' : '❌'}`,
      null,
      'info'
    );
    gsLog(
      `  📌 SharedMemory Ready: ${globalStateInstance.isSharedMemoryReady() ? '✅' : '❌'}`,
      null,
      'info'
    );
    gsLog(
      `  📌 Fallback Mode: ${globalStateInstance.isFallbackMode() ? '✅' : '❌'}`,
      null,
      'info'
    );
    gsLog(
      `  📌 States Count: ${Object.keys(globalStateInstance._state.instancesStates || {}).length}`,
      null,
      'info'
    );
    gsSeparator();
    gsLog('✅ GlobalState готов к работе!', null, 'success');
    gsHeader('ГОТОВ');
  }
  return globalStateInstance;
}

const globalState = getGlobalState();

// ============================================================
// 14. ЭКСПОРТ
// ============================================================

export default globalState;
export { getGlobalState, GlobalState };
