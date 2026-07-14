// env-panel.js - ENV Control Panel Bookmarklet
// Фикс: переключение видимости при каждом запуске
(function () {
  // ========== FAVICON ==========
  function updateFavicon() {
    document.querySelectorAll('link[rel*="icon"]').forEach(el => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href =
      'https://raw.githubusercontent.com/ZababurinSergei/Bookmarklet/refs/heads/main/favicon.png';
    document.head.appendChild(link);

    const fallback = document.createElement('link');
    fallback.rel = 'icon';
    fallback.type = 'image/svg+xml';
    fallback.href = `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <rect width="64" height="64" rx="12" fill="#667eea"/>
        <text x="32" y="44" font-family="Arial" font-size="28" font-weight="bold" fill="white" text-anchor="middle">🐞</text>
      </svg>
    `)}`;
    document.head.appendChild(fallback);
  }
  updateFavicon();

  // ========== ПРОВЕРКА ENV ==========
  if (typeof ENV === 'undefined' && typeof window.ENV === 'undefined') {
    alert('❌ ENV не найден на этой странице!');
    return;
  }
  const env = window.ENV || ENV;

  // ========== ГРУППЫ ==========
  const GROUPS = {
    '🌊 Flow': {
      presets: [
        { name: 'Все flow', value: 'wasm:flow:*' },
        { name: 'Flow шаги', value: 'wasm:flow:step:*' },
        { name: 'Flow чекпоинты', value: 'wasm:flow:checkpoint:*' },
        { name: 'Flow ветки', value: 'wasm:flow:branch:*' },
      ],
    },
    '🧠 Memory': {
      presets: [
        { name: 'Все память', value: 'wasm:memory:*' },
        { name: 'Чтение памяти', value: 'wasm:memory:read:*' },
        { name: 'Запись памяти', value: 'wasm:memory:write:*' },
      ],
    },
    '⚡ Generate': {
      presets: [
        { name: 'Все генерация', value: 'wasm:generate:*' },
        { name: 'JSON генерация', value: 'wasm:generate:json:*' },
        { name: 'C генерация', value: 'wasm:generate:c:*' },
        { name: 'ENV генерация', value: 'wasm:generate:env:*' },
      ],
    },
    '🔧 API': {
      presets: [
        { name: 'Все API', value: 'wasm:api:*' },
        { name: 'API вызовы', value: 'wasm:api:call:*' },
        { name: 'API ошибки', value: 'wasm:api:error:*' },
      ],
    },
    '🚨 Errors': {
      presets: [
        { name: 'Все ошибки', value: 'wasm:error:*' },
        { name: 'Критические', value: 'wasm:error:critical:*' },
      ],
    },
    '📊 All': {
      presets: [
        { name: 'ВСЕ ЛОГИ', value: 'wasm:*' },
        { name: 'Все кроме памяти', value: '*,-wasm:memory:*' },
        { name: 'Flow+Generate+Memory', value: 'wasm:flow:*,wasm:generate:*,wasm:memory:*' },
        { name: 'Только ошибки', value: 'wasm:error:*' },
      ],
    },
    '🎯 Custom': {
      presets: [
        { name: 'Отключить всё', value: '' },
        { name: 'Только flow и generate', value: 'wasm:flow:*,wasm:generate:*' },
        { name: 'Только memory и errors', value: 'wasm:memory:*,wasm:error:*' },
        { name: 'Flow + API', value: 'wasm:flow:*,wasm:api:*' },
      ],
    },
  };

  // ========== УДАЛЕНИЕ СТАРОЙ ПАНЕЛИ ==========
  const oldPanel = document.getElementById('env-control-panel');
  if (oldPanel) oldPanel.remove();

  // ========== СОЗДАНИЕ ПАНЕЛИ ==========
  const panel = document.createElement('div');
  panel.id = 'env-control-panel';

  // ========== ЗАГРУЗКА СОХРАНЕННЫХ ПАРАМЕТРОВ ==========
  const DEFAULT_WIDTH = 380;
  const DEFAULT_HEIGHT = 500;
  const MARGIN = 20;

  const savedPos = localStorage.getItem('env-panel-position');
  let pos = { x: MARGIN, y: MARGIN, unit: 'px' };
  if (savedPos) {
    try {
      const p = JSON.parse(savedPos);
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        pos = p;
        pos.unit = p.unit || 'px';
      }
    } catch (e) {}
  }

  const savedSize = localStorage.getItem('env-panel-size');
  let size = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  if (savedSize) {
    try {
      const s = JSON.parse(savedSize);
      if (typeof s.width === 'number' && s.width > 200) size.width = s.width;
      if (typeof s.height === 'number' && s.height > 200) size.height = s.height;
    } catch (e) {}
  }

  // ========== КЛЮЧЕВОЕ: ПРОВЕРКА И ПЕРЕКЛЮЧЕНИЕ ВИДИМОСТИ ==========
  // Читаем текущее состояние видимости
  const currentVisible = localStorage.getItem('env-panel-visible') === 'true';

  // Инвертируем состояние при каждом запуске (toggle)
  const newVisible = !currentVisible;

  // Сохраняем новое состояние
  localStorage.setItem('env-panel-visible', String(newVisible));

  console.log(
    `🔄 Переключение видимости: ${currentVisible ? 'видима' : 'скрыта'} → ${newVisible ? 'видима' : 'скрыта'}`
  );

  // ========== РАСЧЕТ ПОЗИЦИИ ==========
  function calculatePosition() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    let left, top;

    if (pos.unit === '%') {
      left = Math.max(MARGIN, Math.min(winW - size.width - MARGIN, (pos.x / 100) * winW));
      top = Math.max(MARGIN, Math.min(winH - size.height - MARGIN, (pos.y / 100) * winH));
    } else {
      left = Math.max(MARGIN, Math.min(winW - size.width - MARGIN, pos.x));
      top = Math.max(MARGIN, Math.min(winH - size.height - MARGIN, pos.y));
    }
    return { left, top };
  }

  // ========== СОХРАНЕНИЕ СОСТОЯНИЯ ==========
  function savePanelState() {
    const rect = panel.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    if (winW < 800 || winH < 600) {
      pos = {
        x: (rect.left / winW) * 100,
        y: (rect.top / winH) * 100,
        unit: '%',
      };
    } else {
      pos = {
        x: rect.left,
        y: rect.top,
        unit: 'px',
      };
    }
    localStorage.setItem('env-panel-position', JSON.stringify(pos));
    localStorage.setItem(
      'env-panel-size',
      JSON.stringify({
        width: panel.offsetWidth,
        height: panel.offsetHeight,
      })
    );
    // НЕ сохраняем видимость здесь - она управляется отдельно
  }

  // ========== ПРИМЕНЕНИЕ ПАРАМЕТРОВ ==========
  const { left, top } = calculatePosition();

  panel.style.cssText = `
    position:fixed;
    left:${left}px;
    top:${top}px;
    width:${size.width}px;
    height:${size.height}px;
    z-index:999999;
    background:rgba(26,26,46,0.95);
    backdrop-filter:blur(20px);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:16px;
    padding:0;
    color:#fff;
    font-family:Segoe UI,system-ui,sans-serif;
    font-size:13px;
    box-shadow:0 20px 60px rgba(0,0,0,0.8);
    display:${newVisible ? 'flex' : 'none'};
    flex-direction:column;
    overflow:hidden;
    min-width:280px;
    min-height:300px;
    user-select:none;
  `;

  // ========== ШАПКА ==========
  const header = document.createElement('div');
  header.id = 'env-panel-header';
  header.style.cssText = `
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:12px 16px 10px 16px;
    border-bottom:1px solid rgba(255,255,255,0.05);
    cursor:grab;
    user-select:none;
    flex-shrink:0;
    background:rgba(26,26,46,0.95);
    border-radius:16px 16px 0 0;
    position:sticky;
    top:0;
    z-index:1;
    min-height:44px;
  `;

  const cur = env.DEBUG.namespace || 'off';
  header.innerHTML = `
    <span style="font-weight:bold;font-size:14px;">🔍 ENV Control</span>
    <div style="display:flex;align-items:center;gap:6px;">
      <span id="env-status" style="
        font-size:10px;
        padding:2px 10px;
        border-radius:12px;
        background:${cur !== 'off' ? 'rgba(0,184,148,0.2)' : 'rgba(255,255,255,0.05)'};
        color:${cur !== 'off' ? '#00b894' : '#636e72'};
        max-width:100px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      ">${cur}</span>
      <button id="env-close-btn" style="
        background:none;
        border:none;
        color:#8899bb;
        cursor:pointer;
        font-size:16px;
        padding:0 4px;
        transition:color 0.2s;
      ">✕</button>
    </div>
  `;
  panel.appendChild(header);

  // ========== РЕЗАЙЗ ХЭНДЛ ==========
  const resizeHandle = document.createElement('div');
  resizeHandle.style.cssText = `
    position:absolute;
    bottom:0;
    right:0;
    width:16px;
    height:16px;
    cursor:nwse-resize;
    z-index:10;
    background:linear-gradient(135deg, transparent 50%, rgba(102,126,234,0.3) 50%);
    border-radius:0 0 16px 0;
  `;
  panel.appendChild(resizeHandle);

  // ========== СОДЕРЖИМОЕ ==========
  const contentWrapper = document.createElement('div');
  contentWrapper.style.cssText = `
    padding:12px 16px 16px 16px;
    overflow-y:auto;
    flex:1;
    scrollbar-width:thin;
    scrollbar-color:#667eea transparent;
  `;

  // ========== ИНСТРУКЦИЯ ==========
  const helpText = document.createElement('div');
  helpText.style.cssText = `
    font-size:10px;
    color:#8899bb;
    padding:6px 10px;
    background:rgba(255,255,255,0.03);
    border-radius:6px;
    margin-bottom:10px;
    border:1px solid rgba(255,255,255,0.05);
  `;
  helpText.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      <span>💡</span>
      <span>Клик → применить</span>
      <span style="color:#445;">|</span>
      <span style="color:#667eea;">🖱️ Перетащи</span>
      <span style="color:#445;">|</span>
      <span style="color:#fdcb6e;">↘️ Ресайз</span>
      <span style="color:#445;">|</span>
      <span style="color:#ff6b6b;">✕ Закрыть</span>
    </div>
  `;
  contentWrapper.appendChild(helpText);

  // ========== ГРУППЫ ==========
  const groups = document.createElement('div');
  groups.style.cssText = 'display:flex;flex-direction:column;gap:8px';
  let val = env.DEBUG.namespace || '';

  Object.entries(GROUPS).forEach(([name, group]) => {
    const g = document.createElement('div');
    g.style.cssText =
      'border:1px solid rgba(255,255,255,0.05);border-radius:8px;padding:8px 10px;background:rgba(255,255,255,0.02)';

    const t = document.createElement('div');
    t.style.cssText =
      'font-size:10px;font-weight:bold;color:#8899bb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px';
    t.textContent = name;
    g.appendChild(t);

    const b = document.createElement('div');
    b.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px';

    group.presets.forEach(p => {
      const active = val === p.value;
      const btn = document.createElement('button');
      btn.textContent = p.name;
      btn.dataset.preset = p.value || '';
      btn.style.cssText = `
        padding:3px 8px;
        border:1px solid ${active ? '#667eea' : 'rgba(255,255,255,0.05)'};
        border-radius:4px;
        background:${active ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)'};
        color:${active ? '#fff' : '#8899bb'};
        font-size:10px;
        cursor:pointer;
        transition:all 0.2s;
        font-family:inherit;
        white-space:nowrap;
      `;

      btn.onmouseenter = () => {
        const a = btn.dataset.preset === val;
        btn.style.background = a ? 'rgba(102,126,234,0.4)' : 'rgba(255,255,255,0.08)';
        btn.style.transform = 'translateY(-1px)';
      };
      btn.onmouseleave = () => {
        const a = btn.dataset.preset === val;
        btn.style.background = a ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
        btn.style.transform = 'translateY(0)';
      };

      btn.onclick = () => {
        const v = btn.dataset.preset;
        if (v) {
          env.debug.enable(v);
          console.log(`✅ Включен DEBUG: ${v}`);
        } else {
          env.debug.disable();
          console.log('🔇 DEBUG отключен');
        }
        val = v;
        const s = document.getElementById('env-status');
        if (s) {
          const d = v || 'off';
          s.textContent = d;
          s.style.background = v ? 'rgba(0,184,148,0.2)' : 'rgba(255,255,255,0.05)';
          s.style.color = v ? '#00b894' : '#636e72';
        }
        document.querySelectorAll('#env-control-panel button[data-preset]').forEach(b2 => {
          const a = b2.dataset.preset === v;
          b2.style.background = a ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
          b2.style.color = a ? '#fff' : '#8899bb';
          b2.style.borderColor = a ? '#667eea' : 'rgba(255,255,255,0.05)';
        });
      };
      b.appendChild(btn);
    });
    g.appendChild(b);
    groups.appendChild(g);
  });
  contentWrapper.appendChild(groups);

  // ========== БЫСТРЫЕ ДЕЙСТВИЯ ==========
  const actions = document.createElement('div');
  actions.style.cssText =
    'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:4px;flex-wrap:wrap';

  const actionButtons = [
    {
      text: '📊',
      color: '#8899bb',
      bg: 'rgba(255,255,255,0.03)',
      title: 'Показать ENV',
      action: () => {
        console.log('📊 ENV Config:', env.debug.getConfig());
        alert('📊 ENV Config:\n' + JSON.stringify(env.debug.getConfig(), null, 2));
      },
    },
    {
      text: '🔊 Всё',
      color: '#00b894',
      bg: 'rgba(0,184,148,0.1)',
      title: 'Включить все логи',
      action: () => {
        env.debug.enable('wasm:*');
        console.log('✅ Включены все логи: wasm:*');
        const s = document.getElementById('env-status');
        if (s) {
          s.textContent = 'wasm:*';
          s.style.background = 'rgba(0,184,148,0.2)';
          s.style.color = '#00b894';
        }
        document.querySelectorAll('#env-control-panel button[data-preset]').forEach(b => {
          const a = b.dataset.preset === 'wasm:*';
          b.style.background = a ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
          b.style.color = a ? '#fff' : '#8899bb';
          b.style.borderColor = a ? '#667eea' : 'rgba(255,255,255,0.05)';
        });
      },
    },
    {
      text: '🔇 Выкл',
      color: '#636e72',
      bg: 'rgba(255,255,255,0.03)',
      title: 'Отключить все логи',
      action: () => {
        env.debug.disable();
        console.log('🔇 DEBUG отключен');
        const s = document.getElementById('env-status');
        if (s) {
          s.textContent = 'off';
          s.style.background = 'rgba(255,255,255,0.05)';
          s.style.color = '#636e72';
        }
        document.querySelectorAll('#env-control-panel button[data-preset]').forEach(b => {
          const a = b.dataset.preset === '';
          b.style.background = a ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)';
          b.style.color = a ? '#fff' : '#8899bb';
          b.style.borderColor = a ? '#667eea' : 'rgba(255,255,255,0.05)';
        });
      },
    },
  ];

  actionButtons.forEach(a => {
    const btn = document.createElement('button');
    btn.textContent = a.text;
    btn.title = a.title || '';
    btn.style.cssText = `
      padding:4px 10px;
      border:1px solid rgba(255,255,255,0.05);
      border-radius:4px;
      background:${a.bg};
      color:${a.color};
      font-size:10px;
      cursor:pointer;
      font-family:inherit;
      transition:all 0.2s;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255,255,255,0.08)';
      btn.style.transform = 'translateY(-1px)';
    };
    btn.onmouseleave = () => {
      btn.style.background = a.bg;
      btn.style.transform = 'translateY(0)';
    };
    btn.onclick = a.action;
    actions.appendChild(btn);
  });
  contentWrapper.appendChild(actions);

  // ========== КОМАНДЫ В КОНСОЛИ ==========
  const commandsInfo = document.createElement('div');
  commandsInfo.style.cssText = `
    margin-top:8px;
    padding:6px 10px;
    background:rgba(0,0,0,0.3);
    border-radius:4px;
    font-size:9px;
    color:#636e72;
    font-family:monospace;
    border:1px solid rgba(255,255,255,0.03);
  `;
  commandsInfo.innerHTML = `
    <div style="color:#8899bb;font-weight:bold;font-size:9px;margin-bottom:2px;">📋 Консоль:</div>
    <div style="display:flex;flex-wrap:wrap;gap:3px;font-size:9px;">
      <code style="color:#667eea;">env.debug.enable("wasm:*")</code>
      <span style="color:#445;">|</span>
      <code style="color:#667eea;">env.debug.disable()</code>
      <span style="color:#445;">|</span>
      <code style="color:#667eea;">env.debug.getConfig()</code>
    </div>
  `;
  contentWrapper.appendChild(commandsInfo);

  panel.appendChild(contentWrapper);

  // ========== ДОБАВЛЯЕМ ПАНЕЛЬ ==========
  document.body.appendChild(panel);

  // ========== КНОПКА ЗАКРЫТИЯ ==========
  const closeBtn = document.getElementById('env-close-btn');
  if (closeBtn) {
    closeBtn.onclick = e => {
      e.stopPropagation();

      // Сохраняем позицию и размеры
      savePanelState();
      // Устанавливаем видимость в false (панель скрыта)
      localStorage.setItem('env-panel-visible', 'false');

      panel.style.transform = 'scale(0.8)';
      panel.style.opacity = '0';
      panel.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        panel.style.display = 'none';
        console.log('❌ Панель закрыта (состояние: скрыта)');
        console.log('💡 Нажмите закладку снова, чтобы открыть');
      }, 300);
    };
  }

  // ========== ПЕРЕТАСКИВАНИЕ ==========
  let isDragging = false;
  let dragStartX = 0,
    dragStartY = 0;
  let panelStartX = 0,
    panelStartY = 0;

  function startDrag(e) {
    if (e.target.tagName === 'BUTTON' || e.target.id === 'env-close-btn') return;
    e.preventDefault();
    isDragging = true;

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    dragStartX = clientX;
    dragStartY = clientY;

    const rect = panel.getBoundingClientRect();
    panelStartX = rect.left;
    panelStartY = rect.top;

    header.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none';
    panel.style.pointerEvents = 'auto';
    panel.style.transition = 'none';
  }

  function moveDrag(e) {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    const dx = clientX - dragStartX;
    const dy = clientY - dragStartY;

    let newX = Math.max(0, panelStartX + dx);
    let newY = Math.max(0, panelStartY + dy);

    const maxX = window.innerWidth - panel.offsetWidth;
    const maxY = window.innerHeight - panel.offsetHeight;
    newX = Math.min(newX, maxX);
    newY = Math.min(newY, maxY);

    panel.style.left = newX + 'px';
    panel.style.top = newY + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function endDrag() {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = 'grab';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      panel.style.transition = '';
      savePanelState();
    }
  }

  header.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', moveDrag);
  document.addEventListener('mouseup', endDrag);
  header.addEventListener('touchstart', startDrag, { passive: false });
  document.addEventListener('touchmove', moveDrag, { passive: false });
  document.addEventListener('touchend', endDrag);

  // ========== РЕСАЙЗ ==========
  let isResizing = false;
  let resizeStartX = 0,
    resizeStartY = 0;
  let resizeStartWidth = 0,
    resizeStartHeight = 0;

  function startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    resizeStartX = clientX;
    resizeStartY = clientY;
    resizeStartWidth = panel.offsetWidth;
    resizeStartHeight = panel.offsetHeight;

    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none';
    panel.style.pointerEvents = 'auto';
    panel.style.transition = 'none';
  }

  function moveResize(e) {
    if (!isResizing) return;
    e.preventDefault();

    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const clientY = e.clientY || e.touches?.[0]?.clientY || 0;

    const dx = clientX - resizeStartX;
    const dy = clientY - resizeStartY;

    let newWidth = Math.max(280, resizeStartWidth + dx);
    let newHeight = Math.max(300, resizeStartHeight + dy);

    const maxW = window.innerWidth - parseInt(panel.style.left || 20) - 10;
    const maxH = window.innerHeight - parseInt(panel.style.top || 20) - 10;
    newWidth = Math.min(newWidth, maxW);
    newHeight = Math.min(newHeight, maxH);

    panel.style.width = newWidth + 'px';
    panel.style.height = newHeight + 'px';
  }

  function endResize() {
    if (isResizing) {
      isResizing = false;
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      panel.style.transition = '';
      savePanelState();
    }
  }

  resizeHandle.addEventListener('mousedown', startResize);
  resizeHandle.addEventListener('touchstart', startResize, { passive: false });
  document.addEventListener('mousemove', moveResize);
  document.addEventListener('touchmove', moveResize, { passive: false });
  document.addEventListener('mouseup', endResize);
  document.addEventListener('touchend', endResize);

  // ========== АДАПТАЦИЯ ПРИ РЕСАЙЗЕ ОКНА ==========
  let adaptTimeout;
  function adaptToWindow() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const rect = panel.getBoundingClientRect();
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;

    let newLeft = rect.left;
    let newTop = rect.top;

    if (rect.left + panelW > winW - 10) newLeft = winW - panelW - 10;
    if (rect.top + panelH > winH - 10) newTop = winH - panelH - 10;
    if (rect.left < 0) newLeft = 10;
    if (rect.top < 0) newTop = 10;

    if (panelW > winW - 20) {
      panel.style.width = Math.max(280, winW - 30) + 'px';
    }
    if (panelH > winH - 20) {
      panel.style.height = Math.max(300, winH - 30) + 'px';
    }

    if (newLeft !== rect.left || newTop !== rect.top) {
      panel.style.left = newLeft + 'px';
      panel.style.top = newTop + 'px';
      savePanelState();
    }
  }

  window.addEventListener('resize', () => {
    clearTimeout(adaptTimeout);
    adaptTimeout = setTimeout(adaptToWindow, 100);
  });

  // ========== АНИМАЦИЯ ПОЯВЛЕНИЯ ==========
  if (newVisible) {
    panel.style.transform = 'scale(0.9)';
    panel.style.opacity = '0';
    panel.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      panel.style.transform = 'scale(1)';
      panel.style.opacity = '1';
    }, 50);
  }

  console.log('✅ ENV Control загружена!');
  console.log(`📌 Состояние: ${newVisible ? '🟢 ПАНЕЛЬ ВИДИМА' : '🔴 ПАНЕЛЬ СКРЫТА'}`);
  console.log(`📐 Размер: ${size.width}x${size.height}`);
  console.log(
    `📍 Позиция: ${pos.x}${pos.unit === '%' ? '%' : 'px'}, ${pos.y}${pos.unit === '%' ? '%' : 'px'}`
  );
  console.log('📋 Доступные команды:');
  console.log('  env.debug.enable("wasm:*")  - включить логи');
  console.log('  env.debug.disable()         - отключить логи');
  console.log('  env.debug.getConfig()       - показать конфиг');
  console.log('🖱️ Перетащи за шапку | ↘️ Ресайз уголком');
  console.log('💡 Нажмите закладку снова, чтобы скрыть/показать');
})();
