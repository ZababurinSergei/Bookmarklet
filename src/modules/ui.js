// modules/ui.js - МАКСИМАЛЬНО УПРОЩЕННАЯ ВЕРСИЯ С ФОРМАМИ
// Подключает отдельный файл forms.js
// ОБНОВЛЕНО: Полная интеграция с forms.js

import buildForms from './forms.js';

// ============================================================
// 1. ПРОСТОЙ Z-INDEX МЕНЕДЖЕР
// ============================================================

const ZIndexManager = {
  _maxZ: 99996,
  _elements: new Map(),

  register(el) {
    if (!el) return;
    const id = el.id || 'el-' + Date.now();
    if (!el.id) el.id = id;
    const z = ++this._maxZ;
    el.style.zIndex = z;
    this._elements.set(id, { el, z });
    return z;
  },

  bringToFront(el) {
    if (!el) return;
    const id = el.id;
    const entry = this._elements.get(id);
    if (!entry) return this.register(el);
    const z = ++this._maxZ;
    entry.el.style.zIndex = z;
    entry.z = z;
    this._elements.set(id, entry);
    return z;
  },

  unregister(el) {
    if (!el) return;
    this._elements.delete(el.id);
  },
};

// ============================================================
// 2. ПОЛУЧЕНИЕ СОСТОЯНИЯ
// ============================================================

function getGlobalState() {
  const inst = window.__bookmarkletInstance || window.R;
  if (inst && inst.getState) return inst.getState();
  return window.__globalState || window.globalState || null;
}

// ============================================================
// 3. UI КОМПОНЕНТ (МИНИМАЛЬНЫЙ)
// ============================================================

class UIComponent {
  constructor(options = {}) {
    this._id = options.componentId || 'ui-' + Date.now();
    this._prefix = options.panelPrefix || 'env';
    this._panelType = options.panelType || 'unknown';
    this._elements = new Map();
    this._listeners = [];
    this._zManager = ZIndexManager;
  }

  _genId(base) {
    return this._prefix + '-' + base + '-' + this._id;
  }

  createElement(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    if (props.style) Object.assign(el.style, props.style);
    for (const child of children) {
      if (typeof child === 'string') el.appendChild(document.createTextNode(child));
      else if (child instanceof Node) el.appendChild(child);
    }
    return el;
  }

  createCached(id, tag, props = {}, children = []) {
    const uid = this._genId(id);
    const el = this.createElement(tag, { ...props, id: uid }, children);
    this._elements.set(id, el);
    return el;
  }

  get(id) {
    return this._elements.get(id) || document.getElementById(this._genId(id));
  }

  on(el, event, handler) {
    el.addEventListener(event, handler);
    this._listeners.push({ el, event, handler });
    return () => el.removeEventListener(event, handler);
  }

  clearListeners() {
    for (const { el, event, handler } of this._listeners) {
      el.removeEventListener(event, handler);
    }
    this._listeners = [];
  }
}

// ============================================================
// 4. ПАНЕЛЬ С ФОРМАМИ
// ============================================================

class PanelBuilder extends UIComponent {
  constructor(options = {}) {
    super(options);
    this.panel = null;
    this._state = null;
    this._dragData = null;
    this._rafId = null;
    this._formsContainer = null;
  }

  getState() {
    if (!this._state) this._state = getGlobalState();
    return this._state;
  }

  // ============================================================
  // ПРОСТОЕ ПЕРЕТАСКИВАНИЕ
  // ============================================================

  setupDrag(panel, header) {
    if (!header || !panel) return;

    let isDragging = false;
    let offsetX = 0,
      offsetY = 0;
    let startX = 0,
      startY = 0;
    let rafId = null;

    panel.style.willChange = 'transform';

    header.addEventListener('mousedown', e => {
      if (e.target.closest('.panel-controls')) return;
      if (e.button !== 0) return;

      e.preventDefault();

      isDragging = true;
      this._zManager.bringToFront(panel);

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

      const state = this.getState();
      if (state && state.position) {
        state.position = { x, y, unit: 'px' };
      }

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }

  // ============================================================
  // ПРОСТОЙ РЕСАЙЗ
  // ============================================================

  setupResize(panel, handle) {
    if (!handle || !panel) return;

    let isResizing = false;
    let startX = 0,
      startY = 0;
    let startW = 0,
      startH = 0;
    let rafId = null;

    handle.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();

      isResizing = true;
      this._zManager.bringToFront(panel);

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

        const state = this.getState();
        if (state && state.size) {
          state.size = { width: w, height: h };
        }

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
    };
  }

  // ============================================================
  // ПОСТРОЕНИЕ ПАНЕЛИ
  // ============================================================

  build() {
    const state = this.getState();
    if (!state) return null;

    const pos = state.position || { x: 20, y: 20 };
    const size = state.size || { width: 420, height: 520 };

    // Создаём панель
    this.panel = this.createCached('panel', 'div', {
      style: {
        position: 'fixed',
        left: pos.x + 'px',
        top: pos.y + 'px',
        width: size.width + 'px',
        height: size.height + 'px',
        zIndex: 99996,
        background: 'rgba(26,26,46,0.96)',
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
        willChange: 'transform',
      },
    });

    this.panel.id = 'env-control-panel';
    this._zManager.register(this.panel);

    // Шапка
    const header = this.buildHeader();
    this.panel.appendChild(header);

    // Тело с формами
    const body = this.buildBody();
    this.panel.appendChild(body);

    // Ресайз
    const resize = this.createCached('resize', 'div', {
      style: {
        position: 'absolute',
        bottom: '0',
        right: '0',
        width: '16px',
        height: '16px',
        cursor: 'nwse-resize',
        zIndex: '10',
        background: 'linear-gradient(135deg, transparent 50%, rgba(102,126,234,0.2) 50%)',
        borderRadius: '0 0 12px 0',
      },
    });
    this.panel.appendChild(resize);

    // Настраиваем перемещение
    this.setupDrag(this.panel, header);
    this.setupResize(this.panel, resize);

    return this.panel;
  }

  // ============================================================
  // ШАПКА
  // ============================================================

  buildHeader() {
    const state = this.getState();
    const ns = state?.namespace || 'off';
    const isOn = ns && ns !== 'off';

    const header = this.createCached('header', 'div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'grab',
        flexShrink: 0,
        minHeight: '44px',
        background: 'rgba(26,26,46,0.98)',
      },
    });

    // Заголовок
    const title = this.createElement('span', {
      style: {
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      },
    });

    const icon = this.createElement('span', { textContent: '🔍' });
    title.appendChild(icon);

    const label = this.createElement('span', {
      textContent: 'ENV Control',
    });
    title.appendChild(label);

    // Статус-бейдж
    const badge = this.createCached('status-badge', 'span', {
      id: 'env-status-badge',
      style: {
        fontSize: '9px',
        padding: '1px 8px',
        borderRadius: '10px',
        background: isOn ? 'rgba(0,184,148,0.15)' : 'rgba(255,255,255,0.05)',
        color: isOn ? '#00b894' : '#636e72',
        border: '1px solid ' + (isOn ? 'rgba(0,184,148,0.2)' : 'rgba(255,255,255,0.05)'),
        maxWidth: '100px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      textContent: ns,
    });
    title.appendChild(badge);
    header.appendChild(title);

    // Кнопки
    const controls = this.createElement('div', {
      style: { display: 'flex', gap: '2px', flexShrink: 0 },
    });

    const minBtn = this.createCached('minimize-btn', 'button', {
      style: {
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
      },
      textContent: '─',
      title: 'Свернуть',
    });

    const maxBtn = this.createCached('maximize-btn', 'button', {
      style: {
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
      },
      textContent: '□',
      title: 'Развернуть',
    });

    const closeBtn = this.createCached('close-btn', 'button', {
      style: {
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
      },
      textContent: '✕',
      title: 'Закрыть',
    });

    controls.append(minBtn, maxBtn, closeBtn);
    header.appendChild(controls);

    // Обработчики кнопок
    minBtn.addEventListener('click', () => {
      const panel = this.panel;
      if (!panel) return;
      const isMin = panel.classList.toggle('minimized');
      minBtn.textContent = isMin ? '□' : '─';
      if (isMin) {
        panel.style.height = '44px';
        panel.style.minHeight = '44px';
        panel.style.maxHeight = '44px';
        const body = panel.querySelector('#env-panel-body');
        if (body) body.style.display = 'none';
        const resize = panel.querySelector('#env-panel-resize');
        if (resize) resize.style.display = 'none';
      } else {
        panel.style.height = '';
        panel.style.minHeight = '';
        panel.style.maxHeight = '';
        const body = panel.querySelector('#env-panel-body');
        if (body) body.style.display = '';
        const resize = panel.querySelector('#env-panel-resize');
        if (resize) resize.style.display = '';
      }
    });

    maxBtn.addEventListener('click', () => {
      const panel = this.panel;
      if (!panel) return;
      const isFull = panel.classList.toggle('fullscreen');
      maxBtn.textContent = isFull ? '⧉' : '□';
      if (isFull) {
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
        const resize = panel.querySelector('#env-panel-resize');
        if (resize) resize.style.display = 'none';
      } else {
        panel.style.width = '';
        panel.style.height = '';
        panel.style.top = '';
        panel.style.left = '';
        panel.style.borderRadius = '';
        panel.style.border = '';
        panel.style.maxWidth = '';
        panel.style.maxHeight = '';
        panel.style.minWidth = '';
        panel.style.minHeight = '';
        panel.style.zIndex = '';
        document.body.style.overflow = '';
        const resize = panel.querySelector('#env-panel-resize');
        if (resize) resize.style.display = '';
        this._zManager.bringToFront(panel);
      }
    });

    closeBtn.addEventListener('click', () => {
      const panel = this.panel;
      if (!panel) return;
      panel.style.opacity = '0';
      panel.style.transform = 'scale(0.95)';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 200);
    });

    // Клик по шапке - на передний план
    header.addEventListener('mousedown', () => {
      this._zManager.bringToFront(this.panel);
    });

    // Двойной клик - развернуть
    header.addEventListener('dblclick', e => {
      if (e.target.closest('.panel-controls')) return;
      maxBtn.click();
    });

    return header;
  }

  // ============================================================
  // ТЕЛО ПАНЕЛИ (С ФОРМАМИ)
  // ============================================================

  buildBody() {
    const body = this.createCached('panel-body', 'div', {
      id: 'env-panel-body',
      style: {
        flex: '1',
        overflowY: 'auto',
        padding: '10px 14px 14px 14px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(102,126,234,0.3) transparent',
      },
    });

    // Строим формы из отдельного файла
    this._formsContainer = buildForms();
    body.appendChild(this._formsContainer);

    return body;
  }

  // ============================================================
  // УНИЧТОЖЕНИЕ
  // ============================================================

  destroy() {
    if (this.panel) {
      this._zManager.unregister(this.panel);
      if (this.panel.parentNode) {
        this.panel.parentNode.removeChild(this.panel);
      }
      this.panel = null;
    }
    this.clearListeners();
    this._state = null;
    this._formsContainer = null;
  }

  // ============================================================
  // ОБНОВЛЕНИЕ UI
  // ============================================================

  refresh() {
    if (this._formsContainer) {
      // Перестраиваем формы
      const parent = this._formsContainer.parentNode;
      if (parent) {
        const newForms = buildForms();
        parent.replaceChild(newForms, this._formsContainer);
        this._formsContainer = newForms;
      }
    }
  }
}

// ============================================================
// 5. ЭКСПОРТ
// ============================================================

export default PanelBuilder;
export { UIComponent, getGlobalState, ZIndexManager };
