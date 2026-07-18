// env-panel.js - ENV Control Panel с 100% символами
// ОБНОВЛЕНО: Полная изоляция через приватные символы
// ОБНОВЛЕНО: Интеграция с ChannelManager
// ОБНОВЛЕНО: Оптимизированное перетаскивание

// ============================================================
// 1. ИМПОРТЫ
// ============================================================

const ChannelManager = window.ChannelManager;

// ============================================================
// 2. ПРИВАТНЫЕ СИМВОЛЫ (100% изоляция)
// ============================================================

const PRIVATE = {
  // Основные символы
  INSTANCE: Symbol('env-panel.instance'),
  STATE: Symbol('env-panel.state'),
  CONFIG: Symbol('env-panel.config'),
  LOGGER: Symbol('env-panel.logger'),
  PANEL: Symbol('env-panel.panel'),
  PANEL_ID: Symbol('env-panel.panelId'),
  COMPONENT_ID: Symbol('env-panel.componentId'),
  PANEL_TYPE: Symbol('env-panel.panelType'),
  IS_VISIBLE: Symbol('env-panel.isVisible'),
  IS_MINIMIZED: Symbol('env-panel.isMinimized'),
  IS_FULLSCREEN: Symbol('env-panel.isFullscreen'),

  // Управление
  Z_INDEX: Symbol('env-panel.zIndex'),
  POSITION: Symbol('env-panel.position'),
  SIZE: Symbol('env-panel.size'),
  DRAG_DATA: Symbol('env-panel.dragData'),
  RESIZE_DATA: Symbol('env-panel.resizeData'),
  RAF_ID: Symbol('env-panel.rafId'),

  // Слушатели и события
  LISTENERS: Symbol('env-panel.listeners'),
  CHANNEL: Symbol('env-panel.channel'),
  CHANNEL_SUB: Symbol('env-panel.channelSub'),
  EVENT_HANDLERS: Symbol('env-panel.eventHandlers'),

  // Кеш и метаданные
  CACHE: Symbol('env-panel.cache'),
  METADATA: Symbol('env-panel.metadata'),
  CONTEXT: Symbol('env-panel.context'),

  // Безопасность
  SECURE: Symbol('env-panel.secure'),
  VALIDATOR: Symbol('env-panel.validator'),

  // Отладка
  DEBUG: Symbol('env-panel.debug'),
  LOG_HISTORY: Symbol('env-panel.logHistory'),
  TIMERS: Symbol('env-panel.timers'),

  // Внутренние
  INITIALIZED: Symbol('env-panel.initialized'),
  DESTROYED: Symbol('env-panel.destroyed'),
  VERSION: Symbol('env-panel.version'),
  BUILD: Symbol('env-panel.build'),
};

// ============================================================
// 3. ПУБЛИЧНЫЕ СИМВОЛЫ (доступны через Symbol.for)
// ============================================================

const PUBLIC = {
  API: Symbol.for('env-panel.api'),
  STATE: Symbol.for('env-panel.state'),
  CONFIG: Symbol.for('env-panel.config'),
  LOGGER: Symbol.for('env-panel.logger'),
  PANEL: Symbol.for('env-panel.panel'),
  CHANNEL: Symbol.for('env-panel.channel'),
  EVENTS: Symbol.for('env-panel.events'),
};

// ============================================================
// 4. ЛОГГЕР (использует приватные символы)
// ============================================================

const LOG_STYLES = {
  header:
    'background: #1a1a2e; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: bold;',
  panel: 'color: #00b894; font-weight: bold;',
  success: 'color: #00b894;',
  error: 'color: #ff6b6b;',
  info: 'color: #74b9ff;',
  warn: 'color: #fdcb6e;',
  separator: 'color: #636e72;',
  data: 'color: #fdcb6e;',
  type: 'color: #667eea; font-weight: bold;',
  symbol: 'color: #e17055; font-weight: bold;',
  private: 'color: #fd79a8; font-weight: bold;',
  channel: 'color: #55efc4; font-weight: bold;',
};

function createLogger(instanceId) {
  const history = [];
  const maxHistory = 100;

  return {
    _log(level, message, data = null, style = 'info') {
      const timestamp = new Date().toISOString().slice(11, 19);
      const prefix = `%c[${timestamp}] %c[ENV-Panel:${instanceId?.slice(-6) || 'unknown'}]`;
      const styles = [LOG_STYLES.info, LOG_STYLES.panel];
      const colorStyle = LOG_STYLES[style] || LOG_STYLES.info;

      history.push({ timestamp, level, message, data });
      if (history.length > maxHistory) {
        history.shift();
      }

      if (data !== null && data !== undefined) {
        console.log(prefix + ' %c' + message, ...styles, colorStyle, data);
      } else {
        console.log(prefix + ' %c' + message, ...styles, colorStyle);
      }
    },

    error: (msg, d) => this._log('error', `❌ ${msg}`, d, 'error'),
    warn: (msg, d) => this._log('warn', `⚠️ ${msg}`, d, 'warn'),
    info: (msg, d) => this._log('info', `ℹ️ ${msg}`, d, 'info'),
    debug: (msg, d) => this._log('debug', `🔍 ${msg}`, d, 'debug'),
    success: (msg, d) => this._log('info', `✅ ${msg}`, d, 'success'),

    header(title) {
      console.log('%c' + '═'.repeat(70), LOG_STYLES.separator);
      console.log('%c  🔍 ' + title, LOG_STYLES.header);
      console.log('%c' + '═'.repeat(70), LOG_STYLES.separator);
    },

    separator() {
      console.log('%c' + '─'.repeat(70), LOG_STYLES.separator);
    },

    getHistory: () => [...history],
    clearHistory: () => {
      history.length = 0;
      return this;
    },
  };
}

// ============================================================
// 5. ВАЛИДАТОР (через символы)
// ============================================================

const VALIDATOR = {
  [PRIVATE.VALIDATOR]: {
    isValidId: id => id && typeof id === 'string' && id.length > 0,
    isValidType: type => ['main', 'env', 'logs', 'debug', 'widget'].includes(type),
    isValidName: name => name && typeof name === 'string' && name.length > 0,
    isValidPanelType: type =>
      ['env', 'logs', 'debug', 'manager', 'widget', 'unknown'].includes(type),
    isValidConfig: config => config && typeof config === 'object',
    isValidCallback: fn => typeof fn === 'function',
    isValidNumber: n => typeof n === 'number' && !isNaN(n),
    isValidPosition: pos => pos && typeof pos.x === 'number' && typeof pos.y === 'number',
    isValidSize: size => size && typeof size.width === 'number' && typeof size.height === 'number',
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
// 6. Z-INDEX МЕНЕДЖЕР (глобальный, через символы)
// ============================================================

const ZIndexManager = {
  _baseZIndex: 99996,
  _maxZIndex: 99996,
  _elements: new Map(),

  register(element, type = 'panel') {
    if (!element) return;
    const id = element.id || `el-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    if (!element.id) element.id = id;
    const zIndex = ++this._baseZIndex;
    element.style.zIndex = zIndex;
    this._elements.set(id, { element, zIndex, type });
    this._maxZIndex = Math.max(this._maxZIndex, zIndex);
    return zIndex;
  },

  bringToFront(element) {
    if (!element) return;
    const id = element.id;
    const entry = this._elements.get(id);
    if (!entry) return this.register(element);
    const newZ = ++this._maxZIndex;
    entry.element.style.zIndex = newZ;
    entry.zIndex = newZ;
    this._elements.set(id, entry);
    return newZ;
  },

  unregister(element) {
    if (!element) return;
    this._elements.delete(element.id);
  },

  getStats() {
    return {
      total: this._elements.size,
      maxZIndex: this._maxZIndex,
      baseZIndex: this._baseZIndex,
      elements: Array.from(this._elements.keys()),
    };
  },
};

// ============================================================
// 7. ОСНОВНОЙ КЛАСС ENV PANEL (100% символы)
// ============================================================

class EnvPanel {
  constructor(options = {}) {
    // ============================================================
    // 7.1 ИНИЦИАЛИЗАЦИЯ ПРИВАТНЫХ СВОЙСТВ
    // ============================================================

    // ID и основные свойства
    this[PRIVATE.INSTANCE] = {
      id: options.id || 'env-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      type: options.type || 'env',
      name: options.name || 'ENV Control',
      created: new Date().toISOString(),
    };

    this[PRIVATE.VERSION] = options.version || '2.0.0';
    this[PRIVATE.BUILD] = options.build || '2026-07-18';

    // Компонент ID
    this[PRIVATE.COMPONENT_ID] =
      options.componentId || 'env-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    this[PRIVATE.PANEL_ID] = options.panelId || 'env-control-panel';
    this[PRIVATE.PANEL_TYPE] = options.panelType || 'env';

    // Состояние панели
    this[PRIVATE.PANEL] = null;
    this[PRIVATE.IS_VISIBLE] = false;
    this[PRIVATE.IS_MINIMIZED] = false;
    this[PRIVATE.IS_FULLSCREEN] = false;

    // Позиция и размер
    this[PRIVATE.POSITION] = options.position || { x: 20, y: 20 };
    this[PRIVATE.SIZE] = options.size || { width: 420, height: 520 };
    this[PRIVATE.Z_INDEX] = options.zIndex || 99996;

    // Данные для перетаскивания
    this[PRIVATE.DRAG_DATA] = null;
    this[PRIVATE.RESIZE_DATA] = null;
    this[PRIVATE.RAF_ID] = null;

    // Слушатели
    this[PRIVATE.LISTENERS] = [];
    this[PRIVATE.EVENT_HANDLERS] = new Map();

    // Кеш
    this[PRIVATE.CACHE] = new Map();

    // Метаданные
    this[PRIVATE.METADATA] = {
      created: Date.now(),
      lastAccess: Date.now(),
      lastUpdate: Date.now(),
      runCount: 0,
      errorCount: 0,
      toggleCount: 0,
    };

    // Контекст
    this[PRIVATE.CONTEXT] = {
      url: typeof window !== 'undefined' ? window.location.href : '',
      title: typeof window !== 'undefined' ? document.title : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    // История логов
    this[PRIVATE.LOG_HISTORY] = [];
    this[PRIVATE.TIMERS] = new Map();

    // Флаги
    this[PRIVATE.INITIALIZED] = false;
    this[PRIVATE.DESTROYED] = false;

    // ============================================================
    // 7.2 СОЗДАНИЕ ЛОГГЕРА
    // ============================================================

    this[PRIVATE.LOGGER] = createLogger(this[PRIVATE.INSTANCE].id);

    // ============================================================
    // 7.3 СОЗДАНИЕ КАНАЛА СВЯЗИ
    // ============================================================

    this[PRIVATE.CHANNEL] = new ChannelManager({
      id: this[PRIVATE.INSTANCE].id + '-channel',
      name: 'env-panel-channel',
      debug: true,
    });

    // Подписка на события канала
    this[PRIVATE.CHANNEL_SUB] = this[PRIVATE.CHANNEL].on('*', (data, source) => {
      this._handleChannelMessage(data, source);
    });

    // Отправка события о создании
    this[PRIVATE.CHANNEL].send({
      type: 'env-panel:created',
      data: {
        id: this[PRIVATE.INSTANCE].id,
        name: this[PRIVATE.INSTANCE].name,
        version: this[PRIVATE.VERSION],
        timestamp: Date.now(),
      },
    });

    // ============================================================
    // 7.4 ИНИЦИАЛИЗАЦИЯ
    // ============================================================

    this._init();

    // ============================================================
    // 7.5 ЭКСПОРТ ПУБЛИЧНЫХ СИМВОЛОВ
    // ============================================================

    this._exportSymbols();

    const logger = this[PRIVATE.LOGGER];
    logger.header('СОЗДАНИЕ ENV PANEL (100% СИМВОЛЫ)');
    logger.info('🆔 ID:', this[PRIVATE.INSTANCE].id, 'instance');
    logger.info('📋 Тип:', this[PRIVATE.INSTANCE].type, 'type');
    logger.info('📛 Имя:', this[PRIVATE.INSTANCE].name, 'info');
    logger.info('📅 Создан:', this[PRIVATE.INSTANCE].created, 'info');
    logger.info('📌 Компонент:', this[PRIVATE.COMPONENT_ID], 'info');
    logger.info('📌 Панель:', this[PRIVATE.PANEL_ID], 'info');
    logger.info('📌 Тип панели:', this[PRIVATE.PANEL_TYPE], 'type');
    logger.info('📌 Канал:', this[PRIVATE.CHANNEL].name, 'channel');
    logger.info('📌 Версия:', this[PRIVATE.VERSION], 'info');
    logger.info('📌 Сборка:', this[PRIVATE.BUILD], 'info');

    logger.separator();
    logger.info('🔑 ПРИВАТНЫЕ СИМВОЛЫ:', Object.keys(PRIVATE).length, 'private');
    logger.info('🔑 ПУБЛИЧНЫЕ СИМВОЛЫ:', Object.keys(PUBLIC).length, 'symbol');

    logger.separator();
    logger.success('✅ EnvPanel создан (100% символы)');
    logger.header('ГОТОВ');
  }

  // ============================================================
  // 8. ПРИВАТНЫЕ МЕТОДЫ
  // ============================================================

  /**
   * Инициализация панели
   */
  [PRIVATE.INIT]() {
    this._init();
  }

  _init() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔧 Инициализация EnvPanel...');

    // Проверяем существующую панель
    const existingPanel = document.getElementById(this[PRIVATE.PANEL_ID]);
    if (existingPanel) {
      logger.info('ℹ️ Существующая панель найдена');
      this[PRIVATE.PANEL] = existingPanel;
      this[PRIVATE.IS_VISIBLE] = existingPanel.style.display !== 'none';
      this[PRIVATE.INITIALIZED] = true;

      // Отправляем событие через канал
      this[PRIVATE.CHANNEL].send({
        type: 'env-panel:existing',
        data: {
          id: this[PRIVATE.INSTANCE].id,
          visible: this[PRIVATE.IS_VISIBLE],
        },
      });

      return;
    }

    // Создаем панель
    this._buildPanel();

    this[PRIVATE.INITIALIZED] = true;

    // Отправляем событие через канал
    this[PRIVATE.CHANNEL].send({
      type: 'env-panel:initialized',
      data: {
        id: this[PRIVATE.INSTANCE].id,
        panelId: this[PRIVATE.PANEL_ID],
        timestamp: Date.now(),
      },
    });

    logger.success('✅ EnvPanel инициализирован');
  }

  /**
   * Построение панели
   */
  [PRIVATE.BUILD_PANEL]() {
    this._buildPanel();
  }

  _buildPanel() {
    const logger = this[PRIVATE.LOGGER];
    const instance = this[PRIVATE.INSTANCE];
    const pos = this[PRIVATE.POSITION];
    const size = this[PRIVATE.SIZE];

    logger.info('🏗️ Построение панели...');

    // Создаем панель
    const panel = document.createElement('div');
    panel.id = this[PRIVATE.PANEL_ID];
    panel.dataset.panelType = this[PRIVATE.PANEL_TYPE];
    panel.dataset.instanceId = instance.id;
    panel.dataset.componentId = this[PRIVATE.COMPONENT_ID];

    // Стили
    Object.assign(panel.style, {
      position: 'fixed',
      left: pos.x + 'px',
      top: pos.y + 'px',
      width: size.width + 'px',
      height: size.height + 'px',
      zIndex: this[PRIVATE.Z_INDEX],
      background: 'rgba(26, 26, 46, 0.96)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      color: '#fff',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      fontSize: '13px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: '320px',
      minHeight: '300px',
      maxWidth: '90vw',
      maxHeight: '90vh',
      userSelect: 'none',
      willChange: 'transform, opacity',
      backfaceVisibility: 'hidden',
    });

    // Шапка
    const header = this._buildHeader();
    panel.appendChild(header);

    // Тело
    const body = this._buildBody();
    panel.appendChild(body);

    // Ресайз хэндл
    const resize = this._buildResizeHandle();
    panel.appendChild(resize);

    // Регистрируем в ZIndexManager
    ZIndexManager.register(panel, 'panel');

    // Сохраняем
    this[PRIVATE.PANEL] = panel;

    // Настраиваем перетаскивание
    this._setupDrag(panel, header);

    // Настраиваем ресайз
    this._setupResize(panel, resize);

    // Настраиваем обработчики
    this._setupHandlers(panel);

    // Добавляем в DOM
    document.body.appendChild(panel);
    this[PRIVATE.IS_VISIBLE] = true;

    logger.success('✅ Панель построена');
    logger.info('📐 Размеры:', size, 'data');
    logger.info('📍 Позиция:', pos, 'data');
    logger.info('📌 Z-Index:', this[PRIVATE.Z_INDEX], 'data');

    // Отправляем событие через канал
    this[PRIVATE.CHANNEL].send({
      type: 'env-panel:built',
      data: {
        id: this[PRIVATE.INSTANCE].id,
        panelId: this[PRIVATE.PANEL_ID],
        size: size,
        position: pos,
        zIndex: this[PRIVATE.Z_INDEX],
      },
    });
  }

  /**
   * Построение шапки
   */
  [PRIVATE.BUILD_HEADER]() {
    return this._buildHeader();
  }

  _buildHeader() {
    const instance = this[PRIVATE.INSTANCE];
    const header = document.createElement('div');
    header.id = 'env-panel-header';
    Object.assign(header.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      cursor: 'grab',
      flexShrink: 0,
      minHeight: '44px',
      background: 'rgba(26, 26, 46, 0.98)',
    });

    // Заголовок
    const title = document.createElement('span');
    Object.assign(title.style, {
      fontWeight: 'bold',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    });
    title.innerHTML = `
      <span style="margin-right:6px;">🔍</span>
      ENV Control
      <span id="env-status-badge" style="font-size:9px;padding:1px 8px;border-radius:10px;background:rgba(0,184,148,0.15);color:#00b894;border:1px solid rgba(0,184,148,0.2);margin-left:8px;">off</span>
    `;
    header.appendChild(title);

    // Кнопки управления
    const controls = document.createElement('div');
    controls.className = 'panel-controls';
    Object.assign(controls.style, {
      display: 'flex',
      gap: '2px',
      flexShrink: 0,
    });

    const minBtn = document.createElement('button');
    minBtn.id = 'env-minimize-btn';
    Object.assign(minBtn.style, {
      background: 'none',
      border: 'none',
      color: '#8899bb',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '0 4px',
      width: '28px',
      height: '28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      transition: 'all 0.2s',
    });
    minBtn.textContent = '─';
    minBtn.title = 'Свернуть';

    const maxBtn = document.createElement('button');
    maxBtn.id = 'env-maximize-btn';
    Object.assign(maxBtn.style, {
      background: 'none',
      border: 'none',
      color: '#8899bb',
      cursor: 'pointer',
      fontSize: '14px',
      padding: '0 4px',
      width: '28px',
      height: '28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      transition: 'all 0.2s',
    });
    maxBtn.textContent = '□';
    maxBtn.title = 'Развернуть';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'env-close-btn';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: '#8899bb',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '0 4px',
      width: '28px',
      height: '28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '4px',
      transition: 'all 0.2s',
    });
    closeBtn.textContent = '✕';
    closeBtn.title = 'Закрыть';

    controls.append(minBtn, maxBtn, closeBtn);
    header.appendChild(controls);

    // Сохраняем кнопки в кеш
    this[PRIVATE.CACHE].set('minimize-btn', minBtn);
    this[PRIVATE.CACHE].set('maximize-btn', maxBtn);
    this[PRIVATE.CACHE].set('close-btn', closeBtn);

    return header;
  }

  /**
   * Построение тела
   */
  [PRIVATE.BUILD_BODY]() {
    return this._buildBody();
  }

  _buildBody() {
    const body = document.createElement('div');
    body.id = 'env-panel-body';
    Object.assign(body.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '10px 14px 14px 14px',
      scrollbarWidth: 'thin',
      scrollbarColor: 'rgba(102,126,234,0.3) transparent',
    });

    // Загружаем формы
    this._loadForms(body);

    return body;
  }

  /**
   * Загрузка форм
   */
  [PRIVATE.LOAD_FORMS]() {
    this._loadForms();
  }

  async _loadForms(container) {
    const logger = this[PRIVATE.LOGGER];
    logger.info('📦 Загрузка форм...');

    try {
      const { default: buildForms } = await import('./modules/forms.js');
      const formsContainer = buildForms();
      container.appendChild(formsContainer);
      logger.success('✅ Формы загружены');

      // Отправляем событие через канал
      this[PRIVATE.CHANNEL].send({
        type: 'env-panel:forms-loaded',
        data: {
          id: this[PRIVATE.INSTANCE].id,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      logger.error('❌ Ошибка загрузки форм:', error.message);
      container.innerHTML = `
        <div style="color:#ff6b6b;padding:20px;text-align:center;">
          ❌ Ошибка загрузки форм<br>
          <span style="font-size:12px;color:#8899bb;">${error.message}</span>
        </div>
      `;
    }
  }

  /**
   * Построение ресайз хэндла
   */
  [PRIVATE.BUILD_RESIZE]() {
    return this._buildResizeHandle();
  }

  _buildResizeHandle() {
    const resize = document.createElement('div');
    resize.id = 'env-panel-resize';
    Object.assign(resize.style, {
      position: 'absolute',
      bottom: '0',
      right: '0',
      width: '16px',
      height: '16px',
      cursor: 'nwse-resize',
      zIndex: '10',
      background: 'linear-gradient(135deg, transparent 50%, rgba(102,126,234,0.2) 50%)',
      borderRadius: '0 0 12px 0',
    });
    return resize;
  }

  /**
   * Настройка перетаскивания (оптимизированное)
   */
  [PRIVATE.SETUP_DRAG]() {
    this._setupDrag();
  }

  _setupDrag(panel, header) {
    if (!header || !panel) return;

    let isDragging = false;
    let offsetX = 0,
      offsetY = 0;
    let startX = 0,
      startY = 0;
    let rafId = null;

    header.addEventListener('mousedown', e => {
      if (e.target.closest('.panel-controls')) return;
      if (this[PRIVATE.IS_FULLSCREEN]) return;
      if (e.button !== 0) return;

      e.preventDefault();

      isDragging = true;
      ZIndexManager.bringToFront(panel);

      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      startX = rect.left;
      startY = rect.top;

      panel.style.transition = 'none';
      panel.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseup', onUp, { passive: true });
    });

    const onMove = e => {
      if (!isDragging) return;

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      rafId = requestAnimationFrame(() => {
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        x = Math.max(0, Math.min(maxX, x));
        y = Math.max(0, Math.min(maxY, y));

        panel.style.transform = `translate(${x - startX}px, ${y - startY}px)`;
        panel.dataset.x = x;
        panel.dataset.y = y;

        // Обновляем позицию
        this[PRIVATE.POSITION] = { x, y };
        this[PRIVATE.METADATA].lastUpdate = Date.now();

        rafId = null;
      });
    };

    const onUp = () => {
      if (!isDragging) return;
      isDragging = false;

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const x = parseInt(panel.dataset.x) || parseInt(panel.style.left) || 20;
      const y = parseInt(panel.dataset.y) || parseInt(panel.style.top) || 20;

      panel.style.transform = 'none';
      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
      panel.style.cursor = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      this[PRIVATE.POSITION] = { x, y };

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Отправляем событие через канал
      this[PRIVATE.CHANNEL].send({
        type: 'env-panel:position-changed',
        data: {
          id: this[PRIVATE.INSTANCE].id,
          position: { x, y },
        },
      });
    };
  }

  /**
   * Настройка ресайза (оптимизированный)
   */
  [PRIVATE.SETUP_RESIZE]() {
    this._setupResize();
  }

  _setupResize(panel, handle) {
    if (!handle || !panel) return;

    let isResizing = false;
    let startX = 0,
      startY = 0;
    let startW = 0,
      startH = 0;
    let rafId = null;

    handle.addEventListener('mousedown', e => {
      if (this[PRIVATE.IS_FULLSCREEN]) return;
      e.stopPropagation();
      e.preventDefault();

      isResizing = true;
      ZIndexManager.bringToFront(panel);

      startX = e.clientX;
      startY = e.clientY;
      startW = panel.offsetWidth;
      startH = panel.offsetHeight;

      panel.style.transition = 'none';
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', onMove, { passive: true });
      document.addEventListener('mouseup', onUp, { passive: true });
    });

    const onMove = e => {
      if (!isResizing) return;

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      rafId = requestAnimationFrame(() => {
        const w = Math.max(320, Math.min(window.innerWidth * 0.9, startW + (e.clientX - startX)));
        const h = Math.max(300, Math.min(window.innerHeight * 0.9, startH + (e.clientY - startY)));

        panel.style.width = w + 'px';
        panel.style.height = h + 'px';

        this[PRIVATE.SIZE] = { width: w, height: h };
        this[PRIVATE.METADATA].lastUpdate = Date.now();

        rafId = null;
      });
    };

    const onUp = () => {
      if (!isResizing) return;
      isResizing = false;

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      panel.style.transition = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }

      // Отправляем событие через канал
      this[PRIVATE.CHANNEL].send({
        type: 'env-panel:size-changed',
        data: {
          id: this[PRIVATE.INSTANCE].id,
          size: this[PRIVATE.SIZE],
        },
      });
    };
  }

  /**
   * Настройка обработчиков кнопок
   */
  [PRIVATE.SETUP_HANDLERS]() {
    this._setupHandlers();
  }

  _setupHandlers(panel) {
    const logger = this[PRIVATE.LOGGER];
    const minBtn = this[PRIVATE.CACHE].get('minimize-btn');
    const maxBtn = this[PRIVATE.CACHE].get('maximize-btn');
    const closeBtn = this[PRIVATE.CACHE].get('close-btn');

    if (minBtn) {
      minBtn.addEventListener('click', () => {
        this[PRIVATE.IS_MINIMIZED] = !this[PRIVATE.IS_MINIMIZED];
        if (this[PRIVATE.IS_MINIMIZED]) {
          panel.classList.add('minimized');
          panel.style.height = '44px';
          panel.style.minHeight = '44px';
          panel.style.maxHeight = '44px';
          const body = panel.querySelector('#env-panel-body');
          if (body) body.style.display = 'none';
          const resize = panel.querySelector('#env-panel-resize');
          if (resize) resize.style.display = 'none';
          minBtn.textContent = '□';
        } else {
          panel.classList.remove('minimized');
          panel.style.height = '';
          panel.style.minHeight = '';
          panel.style.maxHeight = '';
          const body = panel.querySelector('#env-panel-body');
          if (body) body.style.display = '';
          const resize = panel.querySelector('#env-panel-resize');
          if (resize) resize.style.display = '';
          minBtn.textContent = '─';
        }

        this[PRIVATE.CHANNEL].send({
          type: 'env-panel:minimized',
          data: {
            id: this[PRIVATE.INSTANCE].id,
            minimized: this[PRIVATE.IS_MINIMIZED],
          },
        });
      });
    }

    if (maxBtn) {
      maxBtn.addEventListener('click', () => {
        this[PRIVATE.IS_FULLSCREEN] = !this[PRIVATE.IS_FULLSCREEN];
        if (this[PRIVATE.IS_FULLSCREEN]) {
          // Сохраняем текущие размеры
          panel.dataset.prevWidth = panel.offsetWidth;
          panel.dataset.prevHeight = panel.offsetHeight;
          panel.dataset.prevLeft = panel.style.left || panel.offsetLeft + 'px';
          panel.dataset.prevTop = panel.style.top || panel.offsetTop + 'px';

          panel.style.width = '100vw';
          panel.style.height = '100vh';
          panel.style.top = '0';
          panel.style.left = '0';
          panel.style.borderRadius = '0';
          panel.style.border = 'none';
          panel.style.maxWidth = '100vw';
          panel.style.maxHeight = '100vh';
          panel.style.minWidth = '100vw';
          panel.style.minHeight = '100vh';
          panel.style.zIndex = '999999';
          document.body.style.overflow = 'hidden';

          if (this[PRIVATE.IS_MINIMIZED]) {
            this[PRIVATE.IS_MINIMIZED] = false;
            panel.classList.remove('minimized');
            minBtn.textContent = '─';
          }

          const resize = panel.querySelector('#env-panel-resize');
          if (resize) resize.style.display = 'none';
          maxBtn.textContent = '⧉';
        } else {
          const prevWidth = parseInt(panel.dataset.prevWidth) || 420;
          const prevHeight = parseInt(panel.dataset.prevHeight) || 520;
          const prevLeft = panel.dataset.prevLeft || '20px';
          const prevTop = panel.dataset.prevTop || '20px';

          panel.style.width = prevWidth + 'px';
          panel.style.height = prevHeight + 'px';
          panel.style.top = prevTop;
          panel.style.left = prevLeft;
          panel.style.borderRadius = '12px';
          panel.style.border = '1px solid rgba(255,255,255,0.08)';
          panel.style.maxWidth = '';
          panel.style.maxHeight = '';
          panel.style.minWidth = '320px';
          panel.style.minHeight = '300px';
          panel.style.zIndex = '';
          document.body.style.overflow = '';

          const resize = panel.querySelector('#env-panel-resize');
          if (resize) resize.style.display = '';
          maxBtn.textContent = '□';

          ZIndexManager.bringToFront(panel);
        }

        this[PRIVATE.CHANNEL].send({
          type: 'env-panel:fullscreen',
          data: {
            id: this[PRIVATE.INSTANCE].id,
            fullscreen: this[PRIVATE.IS_FULLSCREEN],
          },
        });
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this._hide();
      });
    }

    // Клик по панели - на передний план
    panel.addEventListener('mousedown', e => {
      if (e.target.closest('.panel-controls')) return;
      if (e.target.closest('button')) return;
      if (e.target.closest('input')) return;
      if (e.target.closest('select')) return;
      if (e.target.closest('textarea')) return;
      ZIndexManager.bringToFront(panel);
    });

    // Двойной клик по шапке - развернуть
    const header = panel.querySelector('#env-panel-header');
    if (header) {
      header.addEventListener('dblclick', e => {
        if (e.target.closest('.panel-controls')) return;
        maxBtn?.click();
      });
    }

    logger.success('✅ Обработчики настроены');
  }

  /**
   * Скрыть панель
   */
  [PRIVATE.HIDE]() {
    this._hide();
  }

  _hide() {
    const panel = this[PRIVATE.PANEL];
    if (!panel) return;

    panel.style.transform = 'scale(0.95)';
    panel.style.opacity = '0';
    setTimeout(() => {
      panel.style.display = 'none';
    }, 300);

    this[PRIVATE.IS_VISIBLE] = false;
    this[PRIVATE.METADATA].lastUpdate = Date.now();

    this[PRIVATE.CHANNEL].send({
      type: 'env-panel:hidden',
      data: {
        id: this[PRIVATE.INSTANCE].id,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Показать панель
   */
  [PRIVATE.SHOW]() {
    this._show();
  }

  _show() {
    const panel = this[PRIVATE.PANEL];
    if (!panel) return;

    panel.style.display = 'flex';
    panel.style.transform = 'scale(0.95)';
    panel.style.opacity = '0';
    setTimeout(() => {
      panel.style.transform = 'scale(1)';
      panel.style.opacity = '1';
      ZIndexManager.bringToFront(panel);
    }, 50);

    this[PRIVATE.IS_VISIBLE] = true;
    this[PRIVATE.METADATA].lastUpdate = Date.now();
    this[PRIVATE.METADATA].toggleCount++;

    this[PRIVATE.CHANNEL].send({
      type: 'env-panel:shown',
      data: {
        id: this[PRIVATE.INSTANCE].id,
        timestamp: Date.now(),
        toggleCount: this[PRIVATE.METADATA].toggleCount,
      },
    });
  }

  /**
   * Переключить панель
   */
  [PRIVATE.TOGGLE]() {
    this._toggle();
  }

  _toggle() {
    if (this[PRIVATE.IS_VISIBLE]) {
      this._hide();
    } else {
      this._show();
    }
  }

  /**
   * Обработка сообщений из канала
   */
  [PRIVATE.HANDLE_CHANNEL_MESSAGE]() {
    this._handleChannelMessage();
  }

  _handleChannelMessage(data, source) {
    const logger = this[PRIVATE.LOGGER];
    logger.debug(`📨 [${source}] Сообщение из канала:`, data);

    if (data.type === 'env-panel:toggle') {
      this._toggle();
    }

    if (data.type === 'env-panel:show') {
      this._show();
    }

    if (data.type === 'env-panel:hide') {
      this._hide();
    }

    if (data.type === 'env-panel:get-state') {
      this[PRIVATE.CHANNEL].send({
        type: 'env-panel:state',
        data: this._getState(),
        _requestId: data._id,
      });
    }
  }

  /**
   * Получить состояние
   */
  [PRIVATE.GET_STATE]() {
    return this._getState();
  }

  _getState() {
    return {
      id: this[PRIVATE.INSTANCE].id,
      name: this[PRIVATE.INSTANCE].name,
      type: this[PRIVATE.INSTANCE].type,
      version: this[PRIVATE.VERSION],
      visible: this[PRIVATE.IS_VISIBLE],
      minimized: this[PRIVATE.IS_MINIMIZED],
      fullscreen: this[PRIVATE.IS_FULLSCREEN],
      position: this[PRIVATE.POSITION],
      size: this[PRIVATE.SIZE],
      zIndex: this[PRIVATE.Z_INDEX],
      metadata: { ...this[PRIVATE.METADATA] },
      context: { ...this[PRIVATE.CONTEXT] },
      panelId: this[PRIVATE.PANEL_ID],
      componentId: this[PRIVATE.COMPONENT_ID],
      initialized: this[PRIVATE.INITIALIZED],
      destroyed: this[PRIVATE.DESTROYED],
    };
  }

  /**
   * Экспорт символов в глобальный объект
   */
  [PRIVATE.EXPORT_SYMBOLS]() {
    this._exportSymbols();
  }

  _exportSymbols() {
    if (typeof window === 'undefined') return;

    const instanceId = this[PRIVATE.INSTANCE].id;

    // Экспортируем публичные символы
    window[PUBLIC.API] = this;
    window[PUBLIC.STATE] = this._getState.bind(this);
    window[PUBLIC.CONFIG] = {
      id: this[PRIVATE.INSTANCE].id,
      name: this[PRIVATE.INSTANCE].name,
      version: this[PRIVATE.VERSION],
      panelId: this[PRIVATE.PANEL_ID],
    };
    window[PUBLIC.LOGGER] = this[PRIVATE.LOGGER];
    window[PUBLIC.PANEL] = this[PRIVATE.PANEL];
    window[PUBLIC.CHANNEL] = this[PRIVATE.CHANNEL];
    window[PUBLIC.EVENTS] = {
      on: this.on.bind(this),
      off: this.off.bind(this),
      emit: this.emit.bind(this),
    };

    // Экспортируем приватные символы для отладки
    window.__envPanelSymbols = {
      PRIVATE: PRIVATE,
      PUBLIC: PUBLIC,
      instanceId: instanceId,
    };
  }

  // ============================================================
  // 9. ПУБЛИЧНЫЕ МЕТОДЫ
  // ============================================================

  /**
   * Показать панель
   */
  show() {
    this._show();
    return this;
  }

  /**
   * Скрыть панель
   */
  hide() {
    this._hide();
    return this;
  }

  /**
   * Переключить панель
   */
  toggle() {
    this._toggle();
    return this;
  }

  /**
   * Получить состояние
   */
  getState() {
    return this._getState();
  }

  /**
   * Получить конфиг
   */
  getConfig() {
    return {
      id: this[PRIVATE.INSTANCE].id,
      name: this[PRIVATE.INSTANCE].name,
      type: this[PRIVATE.INSTANCE].type,
      version: this[PRIVATE.VERSION],
      panelId: this[PRIVATE.PANEL_ID],
      componentId: this[PRIVATE.COMPONENT_ID],
    };
  }

  /**
   * Получить логгер
   */
  getLogger() {
    return this[PRIVATE.LOGGER];
  }

  /**
   * Получить канал
   */
  getChannel() {
    return this[PRIVATE.CHANNEL];
  }

  /**
   * Подписаться на событие
   */
  on(event, callback) {
    if (!this[PRIVATE.EVENT_HANDLERS].has(event)) {
      this[PRIVATE.EVENT_HANDLERS].set(event, []);
    }
    this[PRIVATE.EVENT_HANDLERS].get(event).push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Отписаться от события
   */
  off(event, callback) {
    if (this[PRIVATE.EVENT_HANDLERS].has(event)) {
      const handlers = this[PRIVATE.EVENT_HANDLERS].get(event);
      const index = handlers.indexOf(callback);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this[PRIVATE.EVENT_HANDLERS].delete(event);
      }
    }
  }

  /**
   * Отправить событие
   */
  emit(event, data) {
    if (this[PRIVATE.EVENT_HANDLERS].has(event)) {
      const handlers = this[PRIVATE.EVENT_HANDLERS].get(event);
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          this[PRIVATE.LOGGER].error(`Ошибка в обработчике ${event}:`, error.message);
        }
      }
    }

    // Отправляем через канал
    this[PRIVATE.CHANNEL].send({
      type: `env-panel:${event}`,
      data: data,
      _source: this[PRIVATE.INSTANCE].id,
    });
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      instance: { ...this[PRIVATE.INSTANCE] },
      metadata: { ...this[PRIVATE.METADATA] },
      state: this._getState(),
      cache: this[PRIVATE.CACHE].size,
      listeners: this[PRIVATE.LISTENERS].length,
      eventHandlers: this[PRIVATE.EVENT_HANDLERS].size,
      channel: this[PRIVATE.CHANNEL].getStats(),
      version: this[PRIVATE.VERSION],
      build: this[PRIVATE.BUILD],
    };
  }

  /**
   * Уничтожить панель
   */
  destroy() {
    const logger = this[PRIVATE.LOGGER];
    logger.header('УНИЧТОЖЕНИЕ ENV PANEL');

    if (this[PRIVATE.DESTROYED]) {
      logger.warn('⚠️ Панель уже уничтожена');
      return;
    }

    // Удаляем панель из DOM
    if (this[PRIVATE.PANEL] && this[PRIVATE.PANEL].parentNode) {
      ZIndexManager.unregister(this[PRIVATE.PANEL]);
      this[PRIVATE.PANEL].parentNode.removeChild(this[PRIVATE.PANEL]);
      logger.info('🗑️ Панель удалена из DOM');
    }

    // Закрываем канал
    if (this[PRIVATE.CHANNEL_SUB]) {
      this[PRIVATE.CHANNEL_SUB]();
    }
    this[PRIVATE.CHANNEL].destroy();
    logger.info('🗑️ Канал уничтожен');

    // Очищаем кеш
    this[PRIVATE.CACHE].clear();
    this[PRIVATE.LISTENERS] = [];
    this[PRIVATE.EVENT_HANDLERS].clear();

    // Удаляем символы из глобального объекта
    if (typeof window !== 'undefined') {
      delete window[PUBLIC.API];
      delete window[PUBLIC.STATE];
      delete window[PUBLIC.CONFIG];
      delete window[PUBLIC.LOGGER];
      delete window[PUBLIC.PANEL];
      delete window[PUBLIC.CHANNEL];
      delete window[PUBLIC.EVENTS];
      delete window.__envPanelSymbols;
    }

    this[PRIVATE.DESTROYED] = true;
    this[PRIVATE.INITIALIZED] = false;

    logger.success('✅ EnvPanel уничтожен');
    logger.header('ГОТОВ');

    // Отправляем событие через канал перед закрытием
    this[PRIVATE.CHANNEL].send({
      type: 'env-panel:destroyed',
      data: {
        id: this[PRIVATE.INSTANCE].id,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Перезагрузить панель
   */
  async reload() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔄 Перезагрузка панели...');

    // Сохраняем состояние
    const state = this._getState();

    // Уничтожаем старую панель
    this.destroy();

    // Создаем новую
    this[PRIVATE.INITIALIZED] = false;
    this[PRIVATE.DESTROYED] = false;

    // Восстанавливаем состояние
    this[PRIVATE.POSITION] = state.position;
    this[PRIVATE.SIZE] = state.size;
    this[PRIVATE.Z_INDEX] = state.zIndex;

    // Пересоздаем
    this._init();

    // Восстанавливаем видимость
    if (state.visible) {
      this._show();
    }

    logger.success('✅ Панель перезагружена');
    return this;
  }

  /**
   * Сбросить состояние
   */
  reset() {
    const logger = this[PRIVATE.LOGGER];
    logger.info('🔄 Сброс состояния...');

    this[PRIVATE.POSITION] = { x: 20, y: 20 };
    this[PRIVATE.SIZE] = { width: 420, height: 520 };
    this[PRIVATE.Z_INDEX] = 99996;
    this[PRIVATE.IS_MINIMIZED] = false;
    this[PRIVATE.IS_FULLSCREEN] = false;
    this[PRIVATE.METADATA] = {
      created: Date.now(),
      lastAccess: Date.now(),
      lastUpdate: Date.now(),
      runCount: 0,
      errorCount: 0,
      toggleCount: 0,
    };
    this[PRIVATE.CACHE].clear();

    // Обновляем панель
    const panel = this[PRIVATE.PANEL];
    if (panel) {
      panel.style.width = this[PRIVATE.SIZE].width + 'px';
      panel.style.height = this[PRIVATE.SIZE].height + 'px';
      panel.style.left = this[PRIVATE.POSITION].x + 'px';
      panel.style.top = this[PRIVATE.POSITION].y + 'px';
      panel.style.zIndex = this[PRIVATE.Z_INDEX];
      panel.classList.remove('minimized', 'fullscreen');
    }

    logger.success('✅ Состояние сброшено');
    return this;
  }
}

// ============================================================
// 10. ЭКСПОРТ (по умолчанию — функция создания)
// ============================================================

export default async function (instanceArg) {
  const instance = instanceArg || window.__bookmarkletInstance || window.R;

  if (instance && instance.getState) {
    const state = instance.getState ? instance.getState() : null;
    if (state && state.panelExists) {
      state.visible = !state.visible;
      return state;
    }
  }

  // Создаем новую панель
  const panel = new EnvPanel({
    id: instance?.id || 'env-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    name: instance?.name || 'ENV Control',
    type: 'env',
    panelType: 'env',
  });

  // Сохраняем в глобальный объект
  if (typeof window !== 'undefined') {
    window.__envPanel = panel;
  }

  return panel;
}

// ============================================================
// 11. ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ
// ============================================================

if (typeof window !== 'undefined') {
  window.EnvPanel = EnvPanel;
  window.__envPanel = null;

  console.log('📦 env-panel.js загружен (100% символы)');
  console.log('📋 Доступные команды:');
  console.log('  __envPanel.show()      - показать панель');
  console.log('  __envPanel.hide()      - скрыть панель');
  console.log('  __envPanel.toggle()    - переключить');
  console.log('  __envPanel.getState()  - получить состояние');
  console.log('  __envPanel.getStats()  - статистика');
  console.log('  __envPanel.reload()    - перезагрузить');
  console.log('  __envPanel.reset()     - сбросить');
  console.log('  __envPanel.destroy()   - уничтожить');
  console.log('  __envPanel.getChannel() - получить канал');
  console.log('');
  console.log('🔑 Символы:');
  console.log('  PRIVATE:', Object.keys(PRIVATE).length, 'приватных символов');
  console.log('  PUBLIC:', Object.keys(PUBLIC).length, 'публичных символов');
  console.log('  window.__envPanelSymbols - доступ к символам');
}

// ============================================================
// 12. ЭКСПОРТ СИМВОЛОВ
// ============================================================

export { PRIVATE, PUBLIC, EnvPanel };
