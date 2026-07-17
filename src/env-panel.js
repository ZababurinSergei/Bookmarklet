// env-panel.js - ENV Control Panel с оптимизированным перемещением
// ОБНОВЛЕНО: Плавное перемещение с will-change: transform
// ОБНОВЛЕНО: Оптимизированный requestAnimationFrame
// ОБНОВЛЕНО: Исправлен z-index через ZIndexManager
// ОБНОВЛЕНО: Добавлен обработчик mousedown на всю панель для z-index

// ============================================================
// 1. DEBUG-ЛОГГЕР
// ============================================================

const ENV_LOG_STYLES = {
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
};

function envLog(message, data = null, style = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `%c[${timestamp}] %c[ENV-Panel]`;
  const styles = [ENV_LOG_STYLES.info, ENV_LOG_STYLES.panel];

  if (data !== null && data !== undefined) {
    console.log(
      prefix + ' %c' + message,
      ...styles,
      ENV_LOG_STYLES[style] || ENV_LOG_STYLES.info,
      data
    );
  } else {
    console.log(prefix + ' %c' + message, ...styles, ENV_LOG_STYLES[style] || ENV_LOG_STYLES.info);
  }
}

function envHeader(title) {
  console.log('%c' + '═'.repeat(60), ENV_LOG_STYLES.separator);
  console.log('%c  🔍 ' + title, ENV_LOG_STYLES.header);
  console.log('%c' + '═'.repeat(60), ENV_LOG_STYLES.separator);
}

// ============================================================
// 2. Z-INDEX МЕНЕДЖЕР (глобальный)
// ============================================================

// Используем глобальный менеджер если доступен
const getZIndexManager = () => {
  if (window.__bookmarklet && window.__bookmarklet.ZIndexManager) {
    return window.__bookmarklet.ZIndexManager;
  }
  // Fallback: простой менеджер
  let baseZIndex = 99996;
  let maxZIndex = 99996;
  const elements = new Map();

  return {
    register(element, type = 'panel') {
      if (!element) return;
      const id = element.id || `el-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      if (!element.id) element.id = id;
      const zIndex = ++baseZIndex;
      element.style.zIndex = zIndex;
      elements.set(id, { element, zIndex, type });
      maxZIndex = Math.max(maxZIndex, zIndex);
      return zIndex;
    },
    bringToFront(element) {
      if (!element) return;
      const id = element.id;
      const entry = elements.get(id);
      if (!entry) return this.register(element);
      const newZ = ++maxZIndex;
      entry.element.style.zIndex = newZ;
      entry.zIndex = newZ;
      elements.set(id, entry);
      return newZ;
    },
    getZIndex(element) {
      if (!element) return 0;
      const id = element.id;
      const entry = elements.get(id);
      return entry ? entry.zIndex : parseInt(element.style.zIndex) || 0;
    },
  };
};

// ============================================================
// 3. ПОЛУЧЕНИЕ ЭКЗЕМПЛЯРОВ
// ============================================================

function getInstance() {
  if (arguments[0] && typeof arguments[0] === 'object' && arguments[0].getState) {
    return arguments[0];
  }
  const instance = window.__bookmarkletInstance || window.R;
  if (instance && instance.getState) {
    return instance;
  }
  envLog('⚠️ Локальный экземпляр не найден', null, 'warn');
  return null;
}

function getGlobalState() {
  const instance = getInstance();
  if (instance && instance.getState) {
    return instance.getState();
  }
  return window.__globalState || window.globalState || null;
}

// ============================================================
// 4. ФУНКЦИЯ ПОДНЯТИЯ ПАНЕЛИ (ОБЩАЯ)
// ============================================================

function bringToFront(panel) {
  if (!panel) return;

  // Получаем все окна и панели
  const allWindows = document.querySelectorAll(
    '.widget-window, #widget-app, #env-control-panel, #logs-control-panel, ' +
      '#debug-control-panel-v2, #debug-control-panel'
  );

  // Находим максимальный z-index
  let maxZ = 99999;
  allWindows.forEach(win => {
    if (win !== panel && win.style.display !== 'none') {
      const z = parseInt(win.style.zIndex) || 0;
      if (z > maxZ) maxZ = z;
    }
  });

  // Устанавливаем новый z-index
  const newZ = maxZ + 1;
  panel.style.zIndex = newZ;

  // Убираем класс active со всех окон
  allWindows.forEach(win => {
    win.classList.remove('active-window');
  });

  // Добавляем класс активному окну
  panel.classList.add('active-window');

  // Обновляем глобальный максимум
  if (window.__zIndexMax) {
    window.__zIndexMax = Math.max(window.__zIndexMax || 0, newZ);
  } else {
    window.__zIndexMax = newZ;
  }

  return newZ;
}

// ============================================================
// 5. ОПТИМИЗИРОВАННОЕ ПЕРЕТАСКИВАНИЕ
// ============================================================

function setupOptimizedDrag(panel, header, state) {
  if (!header || !panel) return;

  let dragData = null;
  let rafId = null;
  let isDragging = false;

  // Включаем аппаратное ускорение
  panel.style.willChange = 'transform, opacity';
  panel.style.backfaceVisibility = 'hidden';
  panel.style.transform = 'translateZ(0)';

  header.addEventListener('mousedown', e => {
    if (e.target.closest('.panel-controls')) return;
    if (state.fullscreen) return;
    if (e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    isDragging = true;

    // Выводим на передний план
    bringToFront(panel);

    const rect = panel.getBoundingClientRect();

    dragData = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: rect.left,
      startY: rect.top,
      lastX: rect.left,
      lastY: rect.top,
    };

    // Отключаем transition для плавности
    panel.style.transition = 'none';
    panel.style.cursor = 'grabbing';
    panel.classList.add('dragging');

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    // Используем capture фазу для лучшей производительности
    document.addEventListener('mousemove', onDrag, { passive: false, capture: true });
    document.addEventListener('mouseup', onDragEnd, { passive: false, capture: true });
  });

  function onDrag(e) {
    if (!isDragging || !dragData) return;
    e.preventDefault();

    // Отменяем предыдущий кадр
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    // Используем requestAnimationFrame для синхронизации с обновлением экрана
    rafId = requestAnimationFrame(() => {
      const newLeft = e.clientX - dragData.offsetX;
      const newTop = e.clientY - dragData.offsetY;

      // Ограничиваем положение с учётом границ окна
      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;

      const clampedX = Math.max(0, Math.min(maxX, newLeft));
      const clampedY = Math.max(0, Math.min(maxY, newTop));

      // Используем transform для более плавного перемещения (аппаратное ускорение)
      panel.style.transform = `translate3d(${clampedX - dragData.startX}px, ${clampedY - dragData.startY}px, 0)`;

      // Сохраняем позицию в data-атрибуте для восстановления
      panel.dataset.dragX = clampedX;
      panel.dataset.dragY = clampedY;

      if (state.position) {
        state.position = { x: clampedX, y: clampedY, unit: 'px' };
      }

      rafId = null;
    });
  }

  function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    // Отключаем обработчики
    document.removeEventListener('mousemove', onDrag, { capture: true });
    document.removeEventListener('mouseup', onDragEnd, { capture: true });

    // Восстанавливаем стили
    panel.style.cursor = '';
    panel.style.transition = '';
    panel.classList.remove('dragging');

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Применяем финальную позицию через left/top (для сохранения состояния)
    const finalX = parseInt(panel.dataset.dragX) || parseInt(panel.style.left) || 20;
    const finalY = parseInt(panel.dataset.dragY) || parseInt(panel.style.top) || 20;

    // Убираем transform и устанавливаем финальную позицию
    panel.style.transform = 'none';
    panel.style.left = finalX + 'px';
    panel.style.top = finalY + 'px';

    if (state.position) {
      state.position = { x: finalX, y: finalY, unit: 'px' };
    }

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    dragData = null;
    envLog('🖱️ Перетаскивание завершено', { x: finalX, y: finalY }, 'info');
  }
}

// ============================================================
// 6. ОПТИМИЗИРОВАННЫЙ РЕСАЙЗ
// ============================================================

function setupOptimizedResize(panel, resizeHandle, state) {
  if (!resizeHandle || !panel) return;

  let resizeData = null;
  let rafId = null;
  let isResizing = false;

  resizeHandle.addEventListener('mousedown', e => {
    if (state.fullscreen) return;
    e.stopPropagation();
    e.preventDefault();

    isResizing = true;

    bringToFront(panel);

    resizeData = {
      startX: e.clientX,
      startY: e.clientY,
      width: panel.offsetWidth,
      height: panel.offsetHeight,
    };

    panel.style.transition = 'none';
    panel.style.cursor = 'nwse-resize';
    panel.classList.add('resizing');

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onResize, { passive: false });
    document.addEventListener('mouseup', onResizeEnd, { passive: false });
  });

  function onResize(e) {
    if (!isResizing || !resizeData) return;
    e.preventDefault();

    if (rafId) {
      cancelAnimationFrame(rafId);
    }

    rafId = requestAnimationFrame(() => {
      const dx = e.clientX - resizeData.startX;
      const dy = e.clientY - resizeData.startY;

      const newWidth = Math.max(280, Math.min(window.innerWidth * 0.9, resizeData.width + dx));
      const newHeight = Math.max(300, Math.min(window.innerHeight * 0.9, resizeData.height + dy));

      panel.style.width = newWidth + 'px';
      panel.style.height = newHeight + 'px';

      if (state.size) {
        state.size = { width: newWidth, height: newHeight };
      }

      rafId = null;
    });
  }

  function onResizeEnd() {
    if (!isResizing) return;
    isResizing = false;

    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', onResizeEnd);

    panel.style.cursor = '';
    panel.style.transition = '';
    panel.classList.remove('resizing');

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    resizeData = null;
    envLog('📐 Ресайз завершён', null, 'info');
  }
}

// ============================================================
// 7. ПОСТРОЕНИЕ ПАНЕЛИ
// ============================================================

async function buildPanel() {
  envHeader('СОЗДАНИЕ PANEL');

  const instance = getInstance();
  if (!instance) {
    envLog('❌ Экземпляр не найден', null, 'error');
    return null;
  }

  const state = getGlobalState();
  if (!state) {
    envLog('❌ Глобальное состояние не найдено', null, 'error');
    return null;
  }

  // Проверяем существующую панель
  const existingPanel = document.getElementById('env-control-panel');
  if (existingPanel) {
    const isVisible = existingPanel.style.display !== 'none';
    state.visible = !isVisible;
    envLog(`🔄 Панель ${state.visible ? 'показана' : 'скрыта'}`, null, 'info');
    return state;
  }

  envLog('🆕 Создание новой панели...', null, 'info');

  try {
    const { default: PanelBuilder } = await import('./modules/ui.js');
    const componentId = 'env-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

    const builder = new PanelBuilder({
      panelType: 'env',
      panelId: 'env-control-panel',
      panelPrefix: 'env',
      componentId: componentId,
    });

    const panel = builder.build();
    if (!panel) {
      envLog('❌ Не удалось создать панель', null, 'error');
      return null;
    }

    panel.id = 'env-control-panel';
    panel.dataset.panelType = 'env';
    panel.dataset.instanceId = instance.id || 'unknown';
    panel.dataset.componentId = componentId;

    // Добавляем оптимизацию для плавного перемещения
    panel.style.willChange = 'transform, opacity';
    panel.style.backfaceVisibility = 'hidden';
    panel.style.transform = 'translateZ(0)';

    // Регистрируем в ZIndexManager
    const zManager = getZIndexManager();
    zManager.register(panel, 'panel');

    // Добавляем панель в DOM
    document.body.appendChild(panel);
    state.panelExists = true;
    state.visible = true;

    // Настраиваем перетаскивание
    const header = builder.get('env-panel-header');
    if (header) {
      setupOptimizedDrag(panel, header, state);
    }

    // Настраиваем ресайз
    const resizeHandle = builder.get('env-panel-resize');
    if (resizeHandle) {
      setupOptimizedResize(panel, resizeHandle, state);
    }

    // Настраиваем обработчики кнопок
    setupHandlers(builder, panel, state, instance);
    setupStateListeners(builder, panel, state);

    // ============================================================
    // ✅ КЛИК ПО ВСЕЙ ПАНЕЛИ - поднимаем z-index
    // ============================================================
    panel.addEventListener('mousedown', function (e) {
      // Исключаем элементы управления, чтобы не мешать их работе
      if (e.target.closest('.panel-controls')) return;
      if (e.target.closest('button')) return;
      if (e.target.closest('input')) return;
      if (e.target.closest('select')) return;
      if (e.target.closest('textarea')) return;
      if (e.target.closest('a')) return;

      bringToFront(panel);
      envLog('🔝 Панель поднята (клик по области)', null, 'debug');
    });

    state.isReady = true;

    envLog('✅ Панель создана и показана!', null, 'success');
    return state;
  } catch (error) {
    envLog('❌ Ошибка создания панели:', error.message, 'error');
    return null;
  }
}

// ============================================================
// 8. ОБРАБОТЧИКИ КНОПОК
// ============================================================

function setupHandlers(builder, panel, state, instance) {
  envLog('🔧 Настройка обработчиков...', null, 'info');

  const minimizeBtn = builder.get('env-minimize-btn');
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      if (state.fullscreen) {
        state.fullscreen = false;
        setTimeout(() => {
          state.minimized = true;
        }, 300);
        return;
      }
      state.minimized = !state.minimized;
    });
  }

  const maximizeBtn = builder.get('env-maximize-btn');
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      state.fullscreen = !state.fullscreen;
    });
  }

  const closeBtn = builder.get('env-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();
      state.visible = false;
      panel.style.opacity = '0';
      panel.style.transform = 'scale(0.95)';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);
    });
  }

  const header = builder.get('env-panel-header');
  if (header) {
    header.addEventListener('dblclick', e => {
      if (e.target.closest('.panel-controls')) return;
      if (maximizeBtn) maximizeBtn.click();
    });
  }

  // ============================================================
  // ✅ КЛИК ПО ПАНЕЛИ - выводим на передний план (уже добавлен в buildPanel)
  // ============================================================
  // Обработчик добавлен в buildPanel, чтобы срабатывал на всю панель
}

// ============================================================
// 9. СЛУШАТЕЛИ СОСТОЯНИЯ
// ============================================================

function setupStateListeners(builder, panel, state) {
  envLog('👂 Настройка слушателей состояния...', null, 'info');

  state.on('minimized', e => {
    if (e.value) {
      panel.classList.add('minimized');
      panel.style.height = '44px';
      panel.style.minHeight = '44px';
      panel.style.maxHeight = '44px';
      const body = panel.querySelector('#env-panel-body');
      if (body) body.style.display = 'none';
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = 'none';
    } else {
      panel.classList.remove('minimized');
      const prevHeight = parseInt(panel.dataset.prevHeight) || 520;
      panel.style.height = prevHeight + 'px';
      panel.style.minHeight = '300px';
      panel.style.maxHeight = '';
      const body = panel.querySelector('#env-panel-body');
      if (body) body.style.display = '';
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = '';
    }
    const minBtn = builder.get('env-minimize-btn');
    if (minBtn) minBtn.textContent = e.value ? '□' : '─';
  });

  state.on('fullscreen', e => {
    if (e.value) {
      if (!panel.dataset.prevWidth) {
        panel.dataset.prevWidth = panel.offsetWidth;
        panel.dataset.prevHeight = panel.offsetHeight;
        panel.dataset.prevLeft = panel.style.left || panel.offsetLeft + 'px';
        panel.dataset.prevTop = panel.style.top || panel.offsetTop + 'px';
      }
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
      if (state.minimized) {
        state.minimized = false;
      }
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = 'none';
    } else {
      const prevWidth = parseInt(panel.dataset.prevWidth) || 380;
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
      panel.style.minWidth = '280px';
      panel.style.minHeight = '300px';
      panel.style.zIndex = '';
      document.body.style.overflow = '';
      const resize = panel.querySelector('#env-panel-resize');
      if (resize) resize.style.display = '';
      bringToFront(panel);
    }
    const maxBtn = builder.get('env-maximize-btn');
    if (maxBtn) maxBtn.textContent = e.value ? '⧉' : '□';
  });

  state.on('visible', e => {
    if (e.value) {
      panel.style.display = 'flex';
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.transform = 'scale(1)';
        panel.style.opacity = '1';
        bringToFront(panel);
      }, 50);
    } else {
      panel.style.transform = 'scale(0.95)';
      panel.style.opacity = '0';
      setTimeout(() => {
        panel.style.display = 'none';
      }, 300);
    }
  });
}

// ============================================================
// 10. ЭКСПОРТ
// ============================================================

export default async function (instanceArg) {
  const instance = instanceArg || getInstance();
  if (instance) {
    // Если экземпляр передан, используем его
    const state = instance.getState ? instance.getState() : getGlobalState();
    if (state && state.panelExists) {
      state.visible = !state.visible;
      return state;
    }
  }
  return await buildPanel();
}

export { getInstance, getGlobalState, bringToFront };

envLog('📦 env-panel.js загружен (оптимизированная версия)', null, 'success');
