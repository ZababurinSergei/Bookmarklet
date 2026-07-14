// logs-panel.js - Logs Control Panel Bookmarklet
// Панель для просмотра и управления логами
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
        <rect width="64" height="64" rx="12" fill="#00b894"/>
        <text x="32" y="44" font-family="Arial" font-size="28" font-weight="bold" fill="white" text-anchor="middle">📋</text>
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

  // ========== ПЕРЕХВАТ ЛОГОВ ==========
  let logEntries = [];
  let isPaused = false;
  let isFollowing = true;
  let logId = 0;

  const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    SUCCESS: 'success',
  };

  function getLevelLabel(level) {
    const labels = {
      debug: 'DEBUG',
      info: 'INFO',
      warn: 'WARN',
      error: 'ERROR',
      success: 'SUCCESS',
    };
    return labels[level] || level.toUpperCase();
  }

  function getLevelColor(level) {
    const colors = {
      debug: '#667eea',
      info: '#74b9ff',
      warn: '#fdcb6e',
      error: '#ff6b6b',
      success: '#00b894',
    };
    return colors[level] || '#8899bb';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function parseFormatString(str, args) {
    if (!str || typeof str !== 'string') {
      return { message: String(str), styles: [] };
    }

    let result = '';
    let argIndex = 0;
    const styles = [];
    const formatRegex = /%([sdoOjc%])/g;
    let match;
    let lastIndex = 0;

    while ((match = formatRegex.exec(str)) !== null) {
      const [fullMatch, type] = match;
      const prefix = str.slice(lastIndex, match.index);
      if (prefix) result += prefix;
      lastIndex = formatRegex.lastIndex;

      switch (type) {
        case '%':
          result += '%';
          break;
        case 's':
          result += argIndex < args.length ? String(args[argIndex++]) : '%s';
          break;
        case 'd':
          if (argIndex < args.length) {
            const num = Number(args[argIndex++]);
            result += isNaN(num) ? 'NaN' : String(num);
          } else {
            result += '%d';
          }
          break;
        case 'j':
        case 'o':
        case 'O':
          if (argIndex < args.length) {
            const val = args[argIndex++];
            try {
              const indent = type === 'O' ? 4 : type === 'o' ? 2 : 0;
              result += JSON.stringify(val, null, indent);
            } catch {
              result += String(val);
            }
          } else {
            result += `%${type}`;
          }
          break;
        case 'c':
          if (argIndex < args.length) {
            styles.push({ start: result.length, style: String(args[argIndex++]) });
          } else {
            result += '%c';
          }
          break;
        default:
          result += fullMatch;
      }
    }

    if (lastIndex < str.length) {
      result += str.slice(lastIndex);
    }

    while (argIndex < args.length) {
      const remaining = args[argIndex++];
      if (remaining !== undefined && remaining !== null) {
        try {
          if (typeof remaining === 'object') {
            result += ' ' + JSON.stringify(remaining);
          } else {
            result += ' ' + String(remaining);
          }
        } catch {
          result += ' [Object]';
        }
      }
    }

    return { message: result, styles };
  }

  function addLogEntry(level, ...args) {
    if (isPaused) return;

    let message = '';
    let rawMessage = '';

    if (args.length > 0 && typeof args[0] === 'string') {
      const parsed = parseFormatString(args[0], args.slice(1));
      rawMessage = parsed.message;
      message = parsed.message;
    } else if (args.length > 0) {
      message = args
        .map(a => {
          if (a === null) return 'null';
          if (a === undefined) return 'undefined';
          if (typeof a === 'object') {
            try {
              return JSON.stringify(a);
            } catch {
              return '[Object]';
            }
          }
          return String(a);
        })
        .join(' ');
    } else {
      message = ' ';
    }

    let actualLevel = level;
    if (!actualLevel || actualLevel === 'info') {
      if (message.includes('❌') || message.includes('error') || message.includes('Error')) {
        actualLevel = LOG_LEVELS.ERROR;
      } else if (message.includes('⚠️') || message.includes('warn') || message.includes('Warn')) {
        actualLevel = LOG_LEVELS.WARN;
      } else if (message.includes('✅') || message.includes('success')) {
        actualLevel = LOG_LEVELS.SUCCESS;
      } else if (message.includes('🔍') || message.includes('debug') || message.includes('DEBUG')) {
        actualLevel = LOG_LEVELS.DEBUG;
      } else {
        actualLevel = LOG_LEVELS.INFO;
      }
    }

    const entry = {
      id: logId++,
      timestamp: new Date(),
      level: actualLevel,
      message: message,
      rawMessage: rawMessage || message,
    };

    logEntries.push(entry);
    if (logEntries.length > 1000) logEntries = logEntries.slice(-500);

    renderLogs();
    updateLogStats();
    if (isFollowing) {
      const console = document.getElementById('logs-console');
      if (console) console.scrollTop = console.scrollHeight;
    }
  }

  function renderLogs() {
    const filter = document.getElementById('logs-filter')?.value?.toLowerCase() || '';
    const levelFilter = document.getElementById('logs-level')?.value || 'all';

    let filtered = logEntries;
    if (filter) {
      filtered = filtered.filter(
        e => e.message.toLowerCase().includes(filter) || e.rawMessage.toLowerCase().includes(filter)
      );
    }
    if (levelFilter !== 'all') {
      filtered = filtered.filter(e => e.level === levelFilter);
    }

    const console = document.getElementById('logs-console');
    if (!console) return;

    if (filtered.length === 0) {
      console.innerHTML = `<div class="logs-empty">📭 Нет логов${filter ? ' по вашему фильтру' : ''}</div>`;
      return;
    }

    let html = '';
    const entries = isFollowing ? filtered : filtered.slice(-100);

    for (const entry of entries) {
      const time = entry.timestamp.toLocaleTimeString();
      const levelLabel = getLevelLabel(entry.level);
      const color = getLevelColor(entry.level);
      html += `
        <div class="logs-entry">
          <span class="logs-time">${time}</span>
          <span class="logs-level ${entry.level}">${levelLabel}</span>
          <span class="logs-message">${escapeHtml(entry.message)}</span>
        </div>
      `;
    }

    console.innerHTML = html;
  }

  function updateLogStats() {
    const total = logEntries.length;
    const errors = logEntries.filter(e => e.level === LOG_LEVELS.ERROR).length;
    const warnings = logEntries.filter(e => e.level === LOG_LEVELS.WARN).length;

    const totalEl = document.getElementById('logs-total');
    const errorsEl = document.getElementById('logs-errors');
    const warningsEl = document.getElementById('logs-warnings');
    if (totalEl) totalEl.textContent = total;
    if (errorsEl) errorsEl.textContent = errors;
    if (warningsEl) warningsEl.textContent = warnings;

    const statusEl = document.getElementById('logs-status');
    if (statusEl) {
      statusEl.textContent = isPaused ? '⏸️ Пауза' : '▶️ Активен';
      statusEl.style.color = isPaused ? '#fdcb6e' : '#00b894';
    }
  }

  // ========== ПЕРЕХВАТ CONSOLE ==========
  const originalLog = console.log;
  const originalDebug = console.debug;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = function (...args) {
    originalLog.apply(console, args);
    addLogEntry(LOG_LEVELS.INFO, ...args);
  };
  console.debug = function (...args) {
    originalDebug.apply(console, args);
    addLogEntry(LOG_LEVELS.DEBUG, ...args);
  };
  console.info = function (...args) {
    originalInfo.apply(console, args);
    addLogEntry(LOG_LEVELS.INFO, ...args);
  };
  console.warn = function (...args) {
    originalWarn.apply(console, args);
    addLogEntry(LOG_LEVELS.WARN, ...args);
  };
  console.error = function (...args) {
    originalError.apply(console, args);
    addLogEntry(LOG_LEVELS.ERROR, ...args);
  };

  // ========== УДАЛЕНИЕ СТАРОЙ ПАНЕЛИ ==========
  const oldPanel = document.getElementById('logs-control-panel');
  if (oldPanel) oldPanel.remove();

  // ========== СОЗДАНИЕ ПАНЕЛИ ==========
  const panel = document.createElement('div');
  panel.id = 'logs-control-panel';

  // ========== ЗАГРУЗКА СОХРАНЕННЫХ ПАРАМЕТРОВ ==========
  const DEFAULT_WIDTH = 500;
  const DEFAULT_HEIGHT = 450;
  const MARGIN = 20;

  const savedPos = localStorage.getItem('logs-panel-position');
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

  const savedSize = localStorage.getItem('logs-panel-size');
  let size = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  if (savedSize) {
    try {
      const s = JSON.parse(savedSize);
      if (typeof s.width === 'number' && s.width > 200) size.width = s.width;
      if (typeof s.height === 'number' && s.height > 200) size.height = s.height;
    } catch (e) {}
  }

  // ========== ПЕРЕКЛЮЧЕНИЕ ВИДИМОСТИ ==========
  const currentVisible = localStorage.getItem('logs-panel-visible') === 'true';
  const newVisible = !currentVisible;
  localStorage.setItem('logs-panel-visible', String(newVisible));

  console.log(
    `🔄 Переключение видимости логов: ${currentVisible ? 'видима' : 'скрыта'} → ${newVisible ? 'видима' : 'скрыта'}`
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

  const { left, top } = calculatePosition();

  // ========== СТИЛИ ПАНЕЛИ ==========
  panel.style.cssText = `
    position:fixed;
    left:${left}px;
    top:${top}px;
    width:${size.width}px;
    height:${size.height}px;
    z-index:999998;
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
    min-width:300px;
    min-height:300px;
    user-select:none;
  `;

  // ========== ШАПКА ==========
  const header = document.createElement('div');
  header.id = 'logs-panel-header';
  header.style.cssText = `
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:10px 16px;
    border-bottom:1px solid rgba(255,255,255,0.05);
    cursor:grab;
    user-select:none;
    flex-shrink:0;
    background:rgba(26,26,46,0.95);
    border-radius:16px 16px 0 0;
    position:sticky;
    top:0;
    z-index:1;
    min-height:40px;
  `;

  const logCount = logEntries.length;
  header.innerHTML = `
    <span style="font-weight:bold;font-size:14px;">📋 Logs Control</span>
    <div style="display:flex;align-items:center;gap:6px;">
      <span id="logs-status-badge" style="
        font-size:10px;
        padding:2px 10px;
        border-radius:12px;
        background:${isPaused ? 'rgba(253,203,110,0.2)' : 'rgba(0,184,148,0.2)'};
        color:${isPaused ? '#fdcb6e' : '#00b894'};
      ">${isPaused ? '⏸️ Пауза' : '▶️ Активен'}</span>
      <span id="logs-count-badge" style="
        font-size:10px;
        padding:2px 8px;
        border-radius:12px;
        background:rgba(102,126,234,0.2);
        color:#667eea;
      ">${logCount}</span>
      <button id="logs-close-btn" style="
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

  // ========== РЕСАЙЗ ХЭНДЛ ==========
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
    display:flex;
    flex-direction:column;
    gap:8px;
  `;

  // ========== УПРАВЛЕНИЕ ЛОГАМИ ==========
  const controls = document.createElement('div');
  controls.style.cssText = `
    display:flex;
    flex-direction:column;
    gap:6px;
    flex-shrink:0;
  `;

  controls.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <input id="logs-filter" type="text" placeholder="🔍 Фильтр..." style="
        flex:1;
        min-width:100px;
        padding:4px 10px;
        border:1px solid rgba(255,255,255,0.1);
        border-radius:6px;
        background:rgba(0,0,0,0.3);
        color:#fff;
        font-size:12px;
        outline:none;
      ">
      <select id="logs-level" style="
        padding:4px 8px;
        border:1px solid rgba(255,255,255,0.1);
        border-radius:6px;
        background:rgba(0,0,0,0.3);
        color:#fff;
        font-size:12px;
        outline:none;
        cursor:pointer;
      ">
        <option value="all">Все</option>
        <option value="debug">Debug</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
        <option value="success">Success</option>
      </select>
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap;">
      <button id="logs-pause-btn" style="
        padding:3px 12px;
        border:1px solid rgba(255,255,255,0.1);
        border-radius:4px;
        background:rgba(255,255,255,0.05);
        color:#8899bb;
        font-size:11px;
        cursor:pointer;
        transition:all 0.2s;
      ">⏸️ Пауза</button>
      <button id="logs-clear-btn" style="
        padding:3px 12px;
        border:1px solid rgba(255,255,255,0.1);
        border-radius:4px;
        background:rgba(255,255,255,0.05);
        color:#8899bb;
        font-size:11px;
        cursor:pointer;
        transition:all 0.2s;
      ">🗑️ Очистить</button>
      <button id="logs-export-btn" style="
        padding:3px 12px;
        border:1px solid rgba(255,255,255,0.1);
        border-radius:4px;
        background:rgba(255,255,255,0.05);
        color:#8899bb;
        font-size:11px;
        cursor:pointer;
        transition:all 0.2s;
      ">📥 Экспорт</button>
      <button id="logs-follow-btn" style="
        padding:3px 12px;
        border:1px solid rgba(0,184,148,0.3);
        border-radius:4px;
        background:rgba(0,184,148,0.1);
        color:#00b894;
        font-size:11px;
        cursor:pointer;
        transition:all 0.2s;
      ">▶️ Следить</button>
    </div>
  `;
  contentWrapper.appendChild(controls);

  // ========== КОНСОЛЬ ЛОГОВ ==========
  const consoleEl = document.createElement('div');
  consoleEl.id = 'logs-console';
  consoleEl.style.cssText = `
    flex:1;
    background:rgba(0,0,0,0.4);
    border-radius:6px;
    padding:8px;
    overflow-y:auto;
    font-family:'Courier New',monospace;
    font-size:11px;
    line-height:1.5;
    min-height:100px;
    border:1px solid rgba(255,255,255,0.05);
    color:#dfe6e9;
  `;
  consoleEl.innerHTML = `<div class="logs-empty" style="color:#8899bb;text-align:center;padding:20px;font-style:italic;">📭 Логи будут отображаться здесь...</div>`;
  contentWrapper.appendChild(consoleEl);

  // ========== СТАТИСТИКА ==========
  const stats = document.createElement('div');
  stats.style.cssText = `
    display:flex;
    gap:12px;
    font-size:11px;
    color:#8899bb;
    padding-top:6px;
    border-top:1px solid rgba(255,255,255,0.05);
    flex-wrap:wrap;
    flex-shrink:0;
  `;
  stats.innerHTML = `
    <span>📊 Всего: <b id="logs-total">${logEntries.length}</b></span>
    <span style="color:#ff6b6b;">❌ <b id="logs-errors">${logEntries.filter(e => e.level === LOG_LEVELS.ERROR).length}</b></span>
    <span style="color:#fdcb6e;">⚠️ <b id="logs-warnings">${logEntries.filter(e => e.level === LOG_LEVELS.WARN).length}</b></span>
    <span id="logs-status" style="color:#00b894;">▶️ Активен</span>
  `;
  contentWrapper.appendChild(stats);

  panel.appendChild(contentWrapper);
  document.body.appendChild(panel);

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
    localStorage.setItem('logs-panel-position', JSON.stringify(pos));
    localStorage.setItem(
      'logs-panel-size',
      JSON.stringify({
        width: panel.offsetWidth,
        height: panel.offsetHeight,
      })
    );
  }

  // ========== ПЕРЕТАСКИВАНИЕ ==========
  let isDragging = false;
  let dragStartX = 0,
    dragStartY = 0;
  let panelStartX = 0,
    panelStartY = 0;

  function startDrag(e) {
    if (e.target.tagName === 'BUTTON' || e.target.id === 'logs-close-btn') return;
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

    let newWidth = Math.max(300, resizeStartWidth + dx);
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

  // ========== ОБРАБОТЧИКИ ==========
  document.getElementById('logs-close-btn')?.addEventListener('click', () => {
    savePanelState();
    localStorage.setItem('logs-panel-visible', 'false');
    panel.style.transform = 'scale(0.8)';
    panel.style.opacity = '0';
    panel.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      panel.style.display = 'none';
      console.log('❌ Панель логов закрыта');
    }, 300);
  });

  document.getElementById('logs-filter')?.addEventListener('input', renderLogs);
  document.getElementById('logs-level')?.addEventListener('change', renderLogs);

  document.getElementById('logs-pause-btn')?.addEventListener('click', () => {
    isPaused = !isPaused;
    const btn = document.getElementById('logs-pause-btn');
    const badge = document.getElementById('logs-status-badge');
    const status = document.getElementById('logs-status');
    btn.textContent = isPaused ? '▶️ Возобновить' : '⏸️ Пауза';
    if (badge) {
      badge.textContent = isPaused ? '⏸️ Пауза' : '▶️ Активен';
      badge.style.background = isPaused ? 'rgba(253,203,110,0.2)' : 'rgba(0,184,148,0.2)';
      badge.style.color = isPaused ? '#fdcb6e' : '#00b894';
    }
    if (status) {
      status.textContent = isPaused ? '⏸️ Пауза' : '▶️ Активен';
      status.style.color = isPaused ? '#fdcb6e' : '#00b894';
    }
  });

  document.getElementById('logs-clear-btn')?.addEventListener('click', () => {
    logEntries = [];
    renderLogs();
    updateLogStats();
  });

  document.getElementById('logs-export-btn')?.addEventListener('click', () => {
    const data = JSON.stringify(logEntries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('logs-follow-btn')?.addEventListener('click', () => {
    isFollowing = !isFollowing;
    const btn = document.getElementById('logs-follow-btn');
    btn.textContent = isFollowing ? '▶️ Следить' : '⏹️ Не следить';
    btn.style.borderColor = isFollowing ? 'rgba(0,184,148,0.3)' : 'rgba(255,255,255,0.1)';
    btn.style.background = isFollowing ? 'rgba(0,184,148,0.1)' : 'rgba(255,255,255,0.05)';
    btn.style.color = isFollowing ? '#00b894' : '#8899bb';
    if (isFollowing) {
      const console = document.getElementById('logs-console');
      console.scrollTop = console.scrollHeight;
    }
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

  // ========== АДАПТАЦИЯ ПРИ РЕСАЙЗЕ ==========
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
      panel.style.width = Math.max(300, winW - 30) + 'px';
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

  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  console.log('✅ Logs Control загружена!');
  console.log(`📌 Состояние: ${newVisible ? '🟢 ПАНЕЛЬ ВИДИМА' : '🔴 ПАНЕЛЬ СКРЫТА'}`);
  console.log(`📐 Размер: ${size.width}x${size.height}`);
  console.log(
    `📍 Позиция: ${pos.x}${pos.unit === '%' ? '%' : 'px'}, ${pos.y}${pos.unit === '%' ? '%' : 'px'}`
  );
  console.log('📋 Доступные команды:');
  console.log('  console.log() - будет отображаться в панели');
  console.log('  console.debug() - будет отображаться в панели');
  console.log('  console.error() - будет отображаться в панели');
  console.log('  console.warn() - будет отображаться в панели');
  console.log('  console.info() - будет отображаться в панели');
  console.log('🖱️ Перетащи за шапку | ↘️ Ресайз уголком');
  console.log('💡 Нажмите закладку снова, чтобы скрыть/показать');

  // Добавляем тестовый лог
  setTimeout(() => {
    addLogEntry(LOG_LEVELS.INFO, '✅ Панель логов запущена');
    addLogEntry(LOG_LEVELS.INFO, '📝 Все console.log() теперь отображаются здесь');
    addLogEntry(LOG_LEVELS.DEBUG, '🔍 Поддерживаются форматтеры: %s, %d, %j, %c', 'строка', 42, {
      test: 'объект',
    });
  }, 100);
})();
