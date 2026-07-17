// core/SharedMemory.js - SharedMemory слой с исправленным requestAnimationFrame
// ОБНОВЛЕНО: Добавлено расширенное debug-логирование
// ОБНОВЛЕНО: Исправлена обработка подписчиков
// ОБНОВЛЕНО: Добавлена очистка старых данных

// ============================================================
// 1. DEBUG-ЛОГГЕР ДЛЯ SHAREDMEMORY
// ============================================================

const SM_LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  shared: 'color: #e17055; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #fdcb6e;',
  publish: 'color: #fd79a8;',
  subscribe: 'color: #55efc4;',
};

function smLog(message, data = null, style = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `%c[${timestamp}] %c[SharedMemory]`;
  const styles = [SM_LOG_STYLES.info, SM_LOG_STYLES.shared];

  if (data !== null && data !== undefined) {
    console.log(
      prefix + ' %c' + message,
      ...styles,
      SM_LOG_STYLES[style] || SM_LOG_STYLES.info,
      data
    );
  } else {
    console.log(prefix + ' %c' + message, ...styles, SM_LOG_STYLES[style] || SM_LOG_STYLES.info);
  }
}

function smHeader(title) {
  console.log('%c' + '═'.repeat(60), SM_LOG_STYLES.separator);
  console.log('%c  🧠 ' + title, SM_LOG_STYLES.header);
  console.log('%c' + '═'.repeat(60), SM_LOG_STYLES.separator);
}

function smSeparator() {
  console.log('%c' + '─'.repeat(60), SM_LOG_STYLES.separator);
}

// ============================================================
// 2. КЛАСС SHAREDMEMORYMANAGER
// ============================================================

class SharedMemoryManager {
  constructor() {
    smHeader('ИНИЦИАЛИЗАЦИЯ SHARED MEMORY');

    this._sharedMemory = null;
    this._support = this._checkSupport();
    this._subscribers = new Map();
    this._initialized = false;
    this._fallbackMode = false;
    this._rafId = null;
    this._isRunning = false;
    this._errorCount = 0;
    this._maxErrors = 10;
    this._lastProcessedData = new Set();
    this._instanceId = 'unknown';
    this._lastDataOffset = 0;
    this._lastDataLength = 0;
    this._lastInstances = 0;
    this._lastUpdate = 0;
    this._consecutiveErrors = 0;
    this._isProcessing = false;
    this._maxDataSize = 1024 * 1024; // 1MB
    this._publishCount = 0;
    this._subscriberCount = 0;

    smLog('🔍 Проверка поддержки SharedMemory...', null, 'info');
    smLog('📊 Статус поддержки:', this._support, 'info');

    if (!this._support.fullySupported) {
      smLog('⚠️ SharedMemory НЕ ПОДДЕРЖИВАЕТСЯ полностью', null, 'warn');
      if (!this._support.sharedArrayBuffer) {
        smLog('  ❌ SharedArrayBuffer не доступен', null, 'error');
      }
      if (!this._support.atomics) {
        smLog('  ❌ Atomics не доступны', null, 'error');
      }
      if (!this._support.crossOriginIsolated) {
        smLog('  ❌ Cross-Origin Isolation не включен', null, 'error');
        smLog('  📋 Для включения добавьте заголовки:', null, 'info');
        smLog('     Cross-Origin-Opener-Policy: same-origin', null, 'info');
        smLog('     Cross-Origin-Embedder-Policy: require-corp', null, 'info');
      }
      smLog('  💡 Будет использован fallback на localStorage', null, 'warn');
      this._fallbackMode = true;
    } else {
      smLog('✅ SharedMemory полностью поддерживается', null, 'success');
    }

    // Настройка слушателя localStorage для fallback
    this._setupLocalStorageListener();

    smSeparator();
    smLog('📊 ИТОГОВАЯ ИНФОРМАЦИЯ SHARED MEMORY:', null, 'header');
    smLog(`  Поддержка: ${this._support.fullySupported ? '✅' : '❌'}`, null, 'info');
    smLog(`  Режим: ${this._fallbackMode ? '⚠️ Fallback' : '✅ SharedMemory'}`, null, 'info');
    smLog(`  Инициализирован: ${this._initialized ? '✅' : '❌'}`, null, 'info');
    smLog(`  Слушатель запущен: ${this._isRunning ? '✅' : '❌'}`, null, 'info');
    smLog(`  Подписчиков: ${this._subscribers.size}`, null, 'info');
    smSeparator();
    smLog(
      '📦 SharedMemory модуль загружен',
      {
        support: this._support,
        mode: this._fallbackMode ? 'fallback' : 'shared',
      },
      'success'
    );

    // Добавляем команды в консоль
    if (typeof window !== 'undefined') {
      window.__sharedMemoryCommands = {
        getStats: () => this.getStats(),
        reinit: () => this.reinit(),
        clear: () => this.clear(),
        destroy: () => this.destroy(),
        subscribe: (key, cb) => this.subscribe(key, cb),
        publish: (key, value) => this.publish(key, value),
        getSupport: () => this.getSupport(),
        isSupported: () => this.isSupported(),
        isInitialized: () => this.isInitialized(),
        isFallbackMode: () => this.isFallbackMode(),
        getInstanceId: () => this.getInstanceId(),
        setInstanceId: id => this.setInstanceId(id),
      };
      smLog('  📋 Команды для управления:', null, 'info');
      smLog('    sharedMemory.getStats()     - получить статистику', null, 'info');
      smLog('    sharedMemory.reinit()       - переинициализировать', null, 'info');
      smLog('    sharedMemory.clear()        - очистить память', null, 'info');
      smLog('    sharedMemory.destroy()      - уничтожить', null, 'info');
      smLog('    sharedMemory.subscribe()    - подписаться на изменения', null, 'info');
      smLog('    sharedMemory.publish()      - опубликовать данные', null, 'info');
    }

    smHeader('ГОТОВ');
  }

  // ============================================================
  // 3. ПРОВЕРКА ПОДДЕРЖКИ
  // ============================================================

  _checkSupport() {
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';
    const hasAtomics = typeof Atomics !== 'undefined';
    const isIsolated = window.crossOriginIsolated || false;

    let headersOk = false;
    try {
      const coop = document.querySelector('meta[name="cross-origin-opener-policy"]');
      const coep = document.querySelector('meta[name="cross-origin-embedder-policy"]');
      headersOk = !!(
        coop &&
        coep &&
        coop.content === 'same-origin' &&
        coep.content === 'require-corp'
      );
    } catch (e) {
      // Игнорируем ошибки
    }

    const support = {
      sharedArrayBuffer: hasSAB,
      atomics: hasAtomics,
      crossOriginIsolated: isIsolated,
      headersOk: headersOk,
      fullySupported: hasSAB && hasAtomics && isIsolated,
    };

    smLog('📋 РЕЗУЛЬТАТЫ ПРОВЕРКИ:', null, 'header');
    smLog(`  SharedArrayBuffer: ${hasSAB ? '✅' : '❌'}`, null, 'info');
    smLog(`  Atomics: ${hasAtomics ? '✅' : '❌'}`, null, 'info');
    smLog(`  Cross-Origin Isolation: ${isIsolated ? '✅' : '❌'}`, null, 'info');
    smLog(`  Заголовки (COOP/COEP): ${headersOk ? '✅' : '❌'}`, null, 'info');
    smLog(`  Полная поддержка: ${support.fullySupported ? '✅' : '❌'}`, null, 'info');

    return support;
  }

  // ============================================================
  // 4. FALLBACK: LOCALSTORAGE
  // ============================================================

  _setupLocalStorageListener() {
    smLog('📌 Настройка слушателя localStorage...', null, 'info');

    if (typeof window === 'undefined') return;

    window.addEventListener('storage', event => {
      if (event.key === 'shared_trigger') {
        smLog('📡 Обнаружено изменение в localStorage', { key: event.key }, 'info');
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('shared_') && key !== 'shared_trigger') {
            try {
              const data = JSON.parse(localStorage.getItem(key));
              if (data.instanceId !== this._instanceId) {
                smLog(`📨 Получены данные из localStorage: ${key}`, data, 'info');
                this._notifySubscribers(data);
              }
            } catch (e) {
              // Игнорируем ошибки парсинга
            }
          }
        }
      }
    });

    smLog('✅ Слушатель localStorage настроен', null, 'success');
  }

  // ============================================================
  // 5. ИНИЦИАЛИЗАЦИЯ SHAREDMEMORY
  // ============================================================

  _initSharedMemory() {
    smLog('🔧 Инициализация SharedMemory...', null, 'info');

    if (!this._support.fullySupported && !this._support.headersOk) {
      smLog('📌 SharedMemory не поддерживается, используем fallback', null, 'warn');
      this._fallbackMode = true;
      return false;
    }

    if (this._initialized) {
      smLog('ℹ️ SharedMemory уже инициализирован', null, 'info');
      return true;
    }

    try {
      const size = this._maxDataSize;
      const sab = new SharedArrayBuffer(size);
      this._sharedMemory = {
        buffer: sab,
        view: new Uint8Array(sab),
        int32: new Int32Array(sab),
      };

      // Инициализируем заголовки
      this._sharedMemory.int32[0] = 1; // Версия
      this._sharedMemory.int32[1] = 0; // Количество инстансов
      this._sharedMemory.int32[2] = 0; // Смещение данных
      this._sharedMemory.int32[3] = 0; // Длина данных
      this._sharedMemory.int32[4] = Date.now(); // Время последнего обновления

      this._initialized = true;
      this._fallbackMode = false;
      this._errorCount = 0;
      this._consecutiveErrors = 0;
      this._lastDataOffset = 0;
      this._lastDataLength = 0;
      this._lastInstances = 0;
      this._lastUpdate = 0;
      this._publishCount = 0;

      this._startListening();

      smLog(
        '✅ SharedMemory инициализирован:',
        {
          size: size,
          crossOriginIsolated: window.crossOriginIsolated,
          version: this._sharedMemory.int32[0],
        },
        'success'
      );

      return true;
    } catch (e) {
      smLog(`❌ Ошибка инициализации SharedMemory: ${e.message}`, e, 'error');
      this._fallbackMode = true;
      this._initialized = false;
      return false;
    }
  }

  // ============================================================
  // 6. СЛУШАТЕЛЬ SHAREDMEMORY (requestAnimationFrame)
  // ============================================================

  _startListening() {
    this._stopListening();

    if (!this._initialized) {
      smLog('⚠️ SharedMemory не инициализирован', null, 'warn');
      return;
    }

    this._isRunning = true;
    this._errorCount = 0;
    this._consecutiveErrors = 0;
    this._isProcessing = false;
    this._lastProcessedData = new Set();

    smLog('▶️ Запуск слушателя SharedMemory (requestAnimationFrame)...', null, 'info');

    const checkChanges = timestamp => {
      // Проверяем, нужно ли остановиться
      if (!this._isRunning || !this._sharedMemory) {
        this._rafId = null;
        return;
      }

      // Защита от рекурсивных вызовов
      if (this._isProcessing) {
        this._rafId = requestAnimationFrame(checkChanges);
        return;
      }

      this._isProcessing = true;

      try {
        const dataOffset = this._sharedMemory.int32[2] || 0;
        const dataLength = this._sharedMemory.int32[3] || 0;
        const currentInstances = this._sharedMemory.int32[1] || 0;
        const lastUpdateTime = this._sharedMemory.int32[4] || 0;

        // Проверяем новые данные
        if (
          dataOffset > 0 &&
          dataLength > 0 &&
          dataOffset < this._sharedMemory.view.length &&
          (dataOffset !== this._lastDataOffset || dataLength !== this._lastDataLength)
        ) {
          try {
            if (dataOffset + dataLength <= this._sharedMemory.view.length) {
              const dataBytes = this._sharedMemory.view.slice(dataOffset, dataOffset + dataLength);
              const decoder = new TextDecoder('utf-8');
              const dataStr = decoder.decode(dataBytes);

              if (dataStr && dataStr.trim()) {
                const data = JSON.parse(dataStr);

                if (data.instanceId !== this._instanceId) {
                  const dataKey = `${data.key}-${data.timestamp}`;
                  if (!this._lastProcessedData.has(dataKey)) {
                    this._lastProcessedData.add(dataKey);
                    smLog(
                      `📡 Получены данные из SharedMemory: ${data.key}`,
                      {
                        key: data.key,
                        instanceId: data.instanceId?.slice(-8),
                        timestamp: data.timestamp,
                      },
                      'info'
                    );
                    this._notifySubscribers(data);

                    if (this._lastProcessedData.size > 1000) {
                      const keys = Array.from(this._lastProcessedData);
                      for (let i = 0; i < 500; i++) {
                        this._lastProcessedData.delete(keys[i]);
                      }
                    }
                  }
                }

                this._lastDataOffset = dataOffset;
                this._lastDataLength = dataLength;
              }
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) {
              smLog(`⚠️ Ошибка чтения SharedMemory: ${e.message}`, null, 'warn');
            }
          }
        }

        // Проверяем изменения в экземплярах
        if (currentInstances !== this._lastInstances && currentInstances > 0) {
          try {
            const instances = JSON.parse(localStorage.getItem('env-panel-instances') || '[]');
            if (Array.isArray(instances) && instances.length > 0) {
              const dataKey = `instances-${instances.length}-${Date.now()}`;
              if (!this._lastProcessedData.has(dataKey)) {
                this._lastProcessedData.add(dataKey);
                smLog(`📡 Обновление инстансов: ${instances.length}`, instances, 'info');
                this._notifySubscribers({
                  key: 'instances',
                  value: instances,
                  oldValue: this._lastInstances,
                  timestamp: Date.now(),
                  instanceId: this._instanceId,
                });
              }
            }
          } catch (e) {
            // Игнорируем
          }
          this._lastInstances = currentInstances;
        }

        if (lastUpdateTime !== this._lastUpdate) {
          this._lastUpdate = lastUpdateTime;
        }

        // Сбрасываем счетчик ошибок
        this._consecutiveErrors = 0;
        this._errorCount = 0;
      } catch (error) {
        this._consecutiveErrors++;
        this._errorCount++;

        smLog(`⚠️ Ошибка в слушателе (${this._errorCount}): ${error.message}`, null, 'warn');

        if (this._consecutiveErrors > 10) {
          smLog('⚠️ Слишком много ошибок, перезапуск слушателя...', null, 'warn');
          this._stopListening();
          setTimeout(() => {
            if (this._initialized) {
              this._startListening();
            }
          }, 500);
          this._isProcessing = false;
          return;
        }
      }

      this._isProcessing = false;

      // Планируем следующий кадр
      if (this._isRunning) {
        this._rafId = requestAnimationFrame(checkChanges);
      } else {
        this._rafId = null;
      }
    };

    // Запускаем первый раз
    this._rafId = requestAnimationFrame(checkChanges);
    smLog('✅ Слушатель SharedMemory запущен', null, 'success');
  }

  _stopListening() {
    smLog('🛑 Остановка слушателя SharedMemory...', null, 'info');

    this._isRunning = false;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    this._isProcessing = false;
    this._lastProcessedData = new Set();

    smLog('✅ Слушатель SharedMemory остановлен', null, 'success');
  }

  // ============================================================
  // 7. УВЕДОМЛЕНИЕ ПОДПИСЧИКОВ
  // ============================================================

  _notifySubscribers(data) {
    smLog(
      `🔔 Уведомление подписчиков для "${data.key}" (${this._subscribers.get(data.key)?.length || 0})`,
      null,
      'info'
    );

    if (data.key) {
      const keyListeners = this._subscribers.get(data.key) || [];
      for (const cb of keyListeners) {
        try {
          cb(data.value, data.oldValue);
        } catch (e) {
          smLog(`⚠️ Ошибка в subscriber для "${data.key}": ${e.message}`, null, 'warn');
        }
      }
    }

    const allListeners = this._subscribers.get('*') || [];
    if (allListeners.length > 0) {
      smLog(`🔔 Уведомление всех подписчиков (*) (${allListeners.length})`, null, 'info');
      for (const cb of allListeners) {
        try {
          cb(data);
        } catch (e) {
          smLog(`⚠️ Ошибка в subscriber (*): ${e.message}`, null, 'warn');
        }
      }
    }
  }

  // ============================================================
  // 8. ПУБЛИКАЦИЯ
  // ============================================================

  publish(key, value, oldValue = null) {
    this._publishCount++;
    smLog(`📤 Публикация "${key}"`, { value, oldValue }, 'publish');

    if (!this._initialized && this._support.fullySupported) {
      smLog('🔄 SharedMemory не инициализирован, пробуем переинициализировать...', null, 'warn');
      this.reinit();
    }

    if (!this._initialized || this._fallbackMode) {
      smLog(`📤 Публикация в localStorage (fallback): "${key}"`, null, 'info');
      return this._publishToLocalStorage(key, value, oldValue);
    }

    try {
      const data = JSON.stringify({
        key,
        value,
        oldValue,
        timestamp: Date.now(),
        instanceId: this._instanceId || 'unknown',
        publishCount: this._publishCount,
      });
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);

      const dataOffset = this._sharedMemory.int32[2] || 0;
      const newOffset = dataOffset + encoded.length + 4;

      if (newOffset > this._sharedMemory.view.length) {
        smLog(
          '⚠️ SharedMemory переполнен, сбрасываем...',
          {
            used: dataOffset,
            max: this._sharedMemory.view.length,
          },
          'warn'
        );
        this._sharedMemory.int32[2] = 0;
        this._sharedMemory.int32[3] = 0;
        return this.publish(key, value, oldValue);
      }

      const view = new Uint8Array(this._sharedMemory.buffer);
      view.set(new Uint8Array(encoded), dataOffset + 4);

      Atomics.store(this._sharedMemory.int32, 2, newOffset);
      Atomics.store(this._sharedMemory.int32, 3, encoded.length);
      Atomics.store(this._sharedMemory.int32, 1, (this._sharedMemory.int32[1] || 0) + 1);
      Atomics.store(this._sharedMemory.int32, 4, Date.now());

      Atomics.notify(this._sharedMemory.int32, 0, 1);

      smLog(
        `✅ Данные опубликованы в SharedMemory (${encoded.length} байт)`,
        {
          key,
          offset: dataOffset,
          length: encoded.length,
          totalUsed: newOffset,
        },
        'success'
      );

      return true;
    } catch (e) {
      smLog(`⚠️ Ошибка публикации в SharedMemory: ${e.message}`, null, 'warn');
      return this._publishToLocalStorage(key, value, oldValue);
    }
  }

  _publishToLocalStorage(key, value, oldValue) {
    try {
      const data = {
        key,
        value,
        oldValue,
        timestamp: Date.now(),
        instanceId: this._instanceId || 'unknown',
        source: 'localStorage',
        publishCount: this._publishCount,
      };

      const storageKey = `shared_${key}`;
      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.setItem('shared_trigger', Date.now().toString());

      smLog(
        `✅ Данные опубликованы в localStorage: "${key}"`,
        {
          storageKey,
          dataSize: JSON.stringify(data).length,
        },
        'success'
      );

      this._notifySubscribers(data);

      return true;
    } catch (e) {
      smLog(`⚠️ Ошибка публикации в localStorage: ${e.message}`, null, 'warn');
      return false;
    }
  }

  // ============================================================
  // 9. ПОДПИСКА
  // ============================================================

  subscribe(key, callback) {
    smLog(`👂 Добавление подписки для "${key}"`, null, 'subscribe');

    if (!this._subscribers.has(key)) {
      this._subscribers.set(key, []);
    }
    this._subscribers.get(key).push(callback);
    this._subscriberCount++;

    smLog(
      `✅ Подписка для "${key}" добавлена. Всего подписчиков: ${this._subscriberCount}`,
      null,
      'success'
    );
    smLog(`📊 Всего подписчиков для "${key}": ${this._subscribers.get(key).length}`, null, 'info');

    return () => this.unsubscribe(key, callback);
  }

  unsubscribe(key, callback) {
    smLog(`👂 Удаление подписки для "${key}"`, null, 'subscribe');

    if (this._subscribers.has(key)) {
      const list = this._subscribers.get(key);
      const index = list.indexOf(callback);
      if (index !== -1) {
        list.splice(index, 1);
        this._subscriberCount--;
        smLog(`✅ Подписка для "${key}" удалена. Осталось: ${list.length}`, null, 'success');
      }
      if (list.length === 0) {
        this._subscribers.delete(key);
        smLog(`🗑️ Ключ "${key}" удалён из подписчиков (пустой список)`, null, 'info');
      }
    }
  }

  clearSubscribers() {
    const count = this._subscribers.size;
    smLog(`🧹 Очистка всех подписчиков (${count})`, null, 'warn');
    this._subscribers.clear();
    this._subscriberCount = 0;
    smLog('✅ Все подписчики очищены', null, 'success');
  }

  // ============================================================
  // 10. ИНФОРМАЦИОННЫЕ МЕТОДЫ
  // ============================================================

  getSupport() {
    return { ...this._support };
  }

  isSupported() {
    return this._support.fullySupported;
  }

  isInitialized() {
    return this._initialized;
  }

  isFallbackMode() {
    return this._fallbackMode;
  }

  getStats() {
    smLog('📊 Получение статистики SharedMemory', null, 'info');

    if (!this._sharedMemory) {
      const stats = {
        initialized: false,
        fallbackMode: this._fallbackMode,
        support: this._support,
        subscribers: this._subscribers.size,
        subscriberCount: this._subscriberCount,
        isRunning: this._isRunning,
        publishCount: this._publishCount,
        instanceId: this._instanceId,
      };
      smLog('📊 Статистика SharedMemory:', stats, 'info');
      return stats;
    }

    const stats = {
      initialized: this._initialized,
      fallbackMode: this._fallbackMode,
      size: this._sharedMemory.buffer.byteLength,
      used: this._sharedMemory.int32[2] || 0,
      instances: this._sharedMemory.int32[1] || 0,
      lastUpdate: new Date(this._sharedMemory.int32[4] || Date.now()),
      version: this._sharedMemory.int32[0] || 0,
      subscribers: this._subscribers.size,
      subscriberCount: this._subscriberCount,
      isRunning: this._isRunning,
      errorCount: this._errorCount,
      publishCount: this._publishCount,
      crossOriginIsolated: window.crossOriginIsolated || false,
      instanceId: this._instanceId,
    };

    smLog('📊 Статистика SharedMemory:', stats, 'info');
    return stats;
  }

  // ============================================================
  // 11. УПРАВЛЕНИЕ
  // ============================================================

  reinit() {
    smLog('🔄 Переинициализация SharedMemory...', null, 'warn');

    this._stopListening();
    this._initialized = false;
    this._sharedMemory = null;
    this._errorCount = 0;
    this._consecutiveErrors = 0;
    this._lastProcessedData = new Set();
    this._lastDataOffset = 0;
    this._lastDataLength = 0;
    this._lastInstances = 0;
    this._lastUpdate = 0;
    this._publishCount = 0;

    this._support = this._checkSupport();
    const result = this._initSharedMemory();

    if (result) {
      smLog('✅ SharedMemory переинициализирован', null, 'success');
    } else {
      smLog('📌 SharedMemory не доступен, используем fallback', null, 'warn');
    }

    return result;
  }

  setInstanceId(id) {
    const oldId = this._instanceId;
    this._instanceId = id;
    smLog(
      `🔑 Установка ID инстанса: ${id.slice(-8)}`,
      {
        oldId: oldId.slice(-8),
        newId: id.slice(-8),
      },
      'info'
    );
  }

  getInstanceId() {
    return this._instanceId || 'unknown';
  }

  clear() {
    smLog('🧹 Очистка SharedMemory...', null, 'warn');

    if (this._sharedMemory) {
      try {
        this._sharedMemory.view.fill(0);
        this._sharedMemory.int32[2] = 0;
        this._sharedMemory.int32[3] = 0;
        this._sharedMemory.int32[4] = Date.now();
        this._lastProcessedData = new Set();
        this._lastDataOffset = 0;
        this._lastDataLength = 0;
        this._publishCount = 0;
        smLog('🧹 SharedMemory очищен', null, 'success');
      } catch (e) {
        smLog(`⚠️ Ошибка очистки SharedMemory: ${e.message}`, null, 'warn');
      }
    }
  }

  destroy() {
    smLog('🗑️ Уничтожение SharedMemory...', null, 'warn');

    this._stopListening();
    this.clearSubscribers();
    this._sharedMemory = null;
    this._initialized = false;
    this._lastProcessedData = new Set();
    this._publishCount = 0;

    // Очищаем localStorage от shared_ ключей
    try {
      const keys = Object.keys(localStorage);
      let count = 0;
      for (const key of keys) {
        if (key.startsWith('shared_')) {
          localStorage.removeItem(key);
          count++;
        }
      }
      if (count > 0) {
        smLog(`🗑️ Удалено ${count} записей из localStorage (shared_*)`, null, 'info');
      }
    } catch (e) {
      smLog(`⚠️ Ошибка очистки localStorage: ${e.message}`, null, 'warn');
    }

    smLog('🗑️ SharedMemory уничтожен', null, 'success');

    // Удаляем глобальные команды
    if (typeof window !== 'undefined') {
      delete window.__sharedMemoryCommands;
    }
  }

  // ============================================================
  // 12. ОЧИСТКА СТАРЫХ ДАННЫХ (СТАТИЧЕСКИЙ МЕТОД)
  // ============================================================

  static cleanupOldData(maxAge = 7 * 24 * 60 * 60 * 1000) {
    // 7 дней по умолчанию
    smLog(
      `🧹 Очистка старых данных SharedMemory (старше ${maxAge / (24 * 60 * 60 * 1000)} дней)...`,
      null,
      'warn'
    );

    try {
      const keys = Object.keys(localStorage);
      let removedCount = 0;
      let keptCount = 0;
      const now = Date.now();

      for (const key of keys) {
        if (key.startsWith('shared_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.timestamp) {
              const age = now - data.timestamp;
              if (age > maxAge) {
                localStorage.removeItem(key);
                removedCount++;
                smLog(
                  `🗑️ Удалена старая запись: ${key} (возраст: ${(age / (24 * 60 * 60 * 1000)).toFixed(1)} дней)`,
                  null,
                  'info'
                );
              } else {
                keptCount++;
              }
            } else {
              // Если нет timestamp, удаляем
              localStorage.removeItem(key);
              removedCount++;
            }
          } catch (e) {
            // Если не удалось распарсить, удаляем
            localStorage.removeItem(key);
            removedCount++;
          }
        }
      }

      smLog(
        `✅ Очистка завершена. Удалено: ${removedCount}, оставлено: ${keptCount}`,
        null,
        'success'
      );
      return { removed: removedCount, kept: keptCount };
    } catch (e) {
      smLog(`⚠️ Ошибка очистки старых данных: ${e.message}`, null, 'error');
      return { removed: 0, kept: 0, error: e.message };
    }
  }

  // ============================================================
  // 13. ОЧИСТКА ВСЕХ ДАННЫХ SHAREDMEMORY (СТАТИЧЕСКИЙ МЕТОД)
  // ============================================================

  static cleanupAll() {
    smHeader('ПОЛНАЯ ОЧИСТКА SHAREDMEMORY');
    smLog('🧹 Запуск полной очистки SharedMemory...', null, 'warn');

    // Очищаем старые данные
    const oldDataResult = SharedMemoryManager.cleanupOldData(0); // 0 = все данные

    // Очищаем trigger
    try {
      localStorage.removeItem('shared_trigger');
      smLog('🗑️ Удалён shared_trigger', null, 'info');
    } catch (e) {
      // Игнорируем
    }

    smSeparator();
    smLog('📊 РЕЗУЛЬТАТЫ ОЧИСТКИ SHAREDMEMORY:', null, 'header');
    smLog(`  🗑️ Удалено записей: ${oldDataResult.removed || 0}`, null, 'info');
    smLog(`  📊 Оставлено записей: ${oldDataResult.kept || 0}`, null, 'info');
    smSeparator();
    smLog('✅ Полная очистка SharedMemory завершена', null, 'success');
    smHeader('ГОТОВ');

    return oldDataResult;
  }
}

// ============================================================
// 14. СОЗДАНИЕ ЭКЗЕМПЛЯРА
// ============================================================

const sharedMemory = new SharedMemoryManager();

if (typeof window !== 'undefined') {
  window.sharedMemory = sharedMemory;
  smLog('🌍 SharedMemory добавлен в window.sharedMemory', null, 'success');
}

// ============================================================
// 15. ЭКСПОРТ
// ============================================================

export default sharedMemory;
export { SharedMemoryManager };
