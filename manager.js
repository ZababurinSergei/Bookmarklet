// manager.js - Управление букмарклетом

// ============================================================
//  ЛОГГЕР
// ============================================================

const logContainer = document.getElementById('log-container');

function addLog(message, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `<span class="time">[${time}]</span><span class="${type}">${message}</span>`;
  logContainer.appendChild(div);
  logContainer.scrollTop = logContainer.scrollHeight;

  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.firstChild);
  }
}

function clearLogs() {
  logContainer.innerHTML = '';
  addLog('🧹 Логи очищены', 'info');
}

// ============================================================
//  ПРОВЕРКА СТАТУСА
// ============================================================

async function checkAll() {
  addLog('🔍 Проверка всех компонентов...', 'info');

  await checkSW();
  await checkSharedMemory();
  await checkInstances();
  await checkBookmarkletLoaded();
}

async function checkSW() {
  const el = document.getElementById('sw-status');

  if (!('serviceWorker' in navigator)) {
    el.textContent = '❌ Не поддерживается';
    el.className = 'value fail';
    addLog('❌ Service Workers не поддерживаются', 'fail');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (registration && registration.active) {
      el.textContent = '✅ Активен';
      el.className = 'value ok';
      addLog('✅ Service Worker активен', 'ok');
    } else if (registration) {
      el.textContent = '⏳ Устанавливается';
      el.className = 'value warn';
      addLog('⏳ Service Worker устанавливается', 'warn');
    } else {
      el.textContent = '❌ Не зарегистрирован';
      el.className = 'value fail';
      addLog('❌ Service Worker не зарегистрирован', 'fail');
    }
  } catch (e) {
    el.textContent = '❌ Ошибка';
    el.className = 'value fail';
    addLog(`❌ Ошибка проверки SW: ${e.message}`, 'fail');
  }
}

async function checkSharedMemory() {
  const el = document.getElementById('sm-status');
  const coiEl = document.getElementById('coi-status');

  const hasSAB = typeof SharedArrayBuffer !== 'undefined';
  const hasAtomics = typeof Atomics !== 'undefined';
  const isIsolated = window.crossOriginIsolated || false;

  // Проверяем заголовки
  let coop = null,
    coep = null;
  try {
    const response = await fetch('./', { cache: 'no-store' });
    coop = response.headers.get('Cross-Origin-Opener-Policy');
    coep = response.headers.get('Cross-Origin-Embedder-Policy');
  } catch (e) {}

  const fullySupported = hasSAB && hasAtomics && isIsolated;

  if (fullySupported) {
    el.textContent = '✅ Работает';
    el.className = 'value ok';
    coiEl.textContent = '✅ Включена';
    coiEl.className = 'value ok';
    addLog('✅ SharedMemory работает', 'ok');
    if (coop) {addLog(`  COOP: ${coop}`, 'info');}
    if (coep) {addLog(`  COEP: ${coep}`, 'info');}
  } else {
    el.textContent = hasSAB && hasAtomics ? '⚠️ Частично' : '❌ Не работает';
    el.className = hasSAB && hasAtomics ? 'value warn' : 'value fail';
    coiEl.textContent = isIsolated ? '⚠️ Частично' : '❌ Выключена';
    coiEl.className = isIsolated ? 'value warn' : 'value fail';

    if (!hasSAB) {addLog('❌ SharedArrayBuffer не доступен', 'fail');}
    if (!hasAtomics) {addLog('❌ Atomics не доступны', 'fail');}
    if (!isIsolated) {
      addLog('❌ Cross-Origin Isolation не включена', 'fail');
      addLog('  💡 Добавьте заголовки или используйте Service Worker', 'warn');
      addLog('  💡 После установки Service Worker перезагрузите страницу', 'warn');
    }
  }
}

async function checkInstances() {
  const el = document.getElementById('instances-count');
  const listEl = document.getElementById('instances-list');

  try {
    const instances = JSON.parse(localStorage.getItem('env-panel-instances') || '[]');
    const current = localStorage.getItem('env-panel-current-instance');
    el.textContent = instances.length;

    if (instances.length === 0) {
      listEl.innerHTML =
        '<span style="color:#636e72;font-size:12px;">Нет активных экземпляров</span>';
    } else {
      listEl.innerHTML = instances
        .map(
          id =>
            `<span class="instance-tag ${id === current ? 'active' : ''}">${id.slice(-8)}${id === current ? ' ⭐' : ''}</span>`,
        )
        .join('');
    }

    if (instances.length > 0) {
      addLog(`📊 Активных экземпляров: ${instances.length}`, 'info');
    }
  } catch (e) {
    el.textContent = '?';
    addLog(`❌ Ошибка получения экземпляров: ${e.message}`, 'fail');
  }
}

function checkBookmarkletLoaded() {
  const el = document.getElementById('bookmarklet-status');
  if (!el) {return;}

  const scripts = document.querySelectorAll('script[src*="bookmarklet.js"]');
  const hasBookmarklet = scripts.length > 0;
  const hasInstance = !!(window.__bookmarkletInstance || window.R);

  if (hasBookmarklet || hasInstance) {
    el.textContent = '✅ Загружен';
    el.className = 'value ok';
    if (hasInstance) {
      const id = window.__bookmarkletInstance?.id || window.R?.id || 'unknown';
      el.textContent = `✅ Активен (${id.slice(-8)})`;
    }
  } else {
    el.textContent = '❌ Не загружен';
    el.className = 'value fail';
  }
}

// ============================================================
//  УПРАВЛЕНИЕ
// ============================================================

async function registerSW() {
  addLog('🔄 Регистрация Service Worker...', 'info');

  if (!('serviceWorker' in navigator)) {
    addLog('❌ Service Workers не поддерживаются', 'fail');
    return;
  }

  try {
    // Удаляем старую регистрацию
    const oldReg = await navigator.serviceWorker.getRegistration('/');
    if (oldReg) {
      await oldReg.unregister();
      addLog('🗑️ Старый Service Worker удален', 'info');
    }

    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    // Ждем активации
    if (registration.active) {
      addLog('✅ Service Worker зарегистрирован и активен', 'ok');
    } else {
      await new Promise(resolve => {
        if (registration.active) {
          resolve();
        } else {
          registration.addEventListener('statechange', function onStateChange() {
            if (this.state === 'activated') {
              addLog('✅ Service Worker активирован', 'ok');
              this.removeEventListener('statechange', onStateChange);
              resolve();
            }
          });
        }
      });
    }

    addLog('💡 Перезагрузите страницу для применения заголовков', 'warn');
    setTimeout(checkAll, 500);
  } catch (e) {
    addLog(`❌ Ошибка регистрации: ${e.message}`, 'fail');
  }
}

async function runBookmarklet() {
  addLog('🚀 Запуск букмарклета...', 'info');

  try {
    // Проверяем, есть ли уже экземпляр
    const existing = document.querySelector('script[src*="bookmarklet.js"]');
    if (existing) {
      addLog('⚠️ Букмарклет уже загружен, перезагружаем...', 'warn');
      existing.remove();
      // Удаляем старый экземпляр
      if (window.__bookmarkletInstance?.destroy) {
        window.__bookmarkletInstance.destroy();
      }
      delete window.__bookmarkletInstance;
      delete window.R;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = './Bookmarklet/bookmarklet.js';
    script.onload = () => {
      addLog('✅ Букмарклет загружен', 'ok');
      setTimeout(() => {
        checkAll();
        // Показываем информацию об экземпляре
        if (window.R) {
          addLog(`📦 Экземпляр: ${window.R.id || 'unknown'}`, 'info');
        }
      }, 500);
    };
    script.onerror = () => addLog('❌ Ошибка загрузки букмарклета', 'fail');
    document.head.appendChild(script);
  } catch (e) {
    addLog(`❌ Ошибка: ${e.message}`, 'fail');
  }
}

async function clearCache() {
  addLog('🗑️ Очистка кеша...', 'info');

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
        addLog(`✅ Service Worker удален`, 'ok');
      }
    }

    const keys = await caches.keys();
    for (const key of keys) {
      await caches.delete(key);
      addLog(`🗑️ Кеш "${key}" удален`, 'ok');
    }

    addLog('✅ Кеш очищен', 'ok');
    addLog('💡 Перезагрузите страницу', 'warn');
    setTimeout(checkAll, 500);
  } catch (e) {
    addLog(`❌ Ошибка очистки: ${e.message}`, 'fail');
  }
}

async function resetAll() {
  if (
    !confirm(
      '⚠️ Сбросить всё состояние?\n\nЭто удалит:\n- Все данные localStorage (настройки, состояние)\n- Service Worker\n- Кеш браузера\n\nПродолжить?',
    )
  )
  {return;}

  addLog('🔄 Сброс всех данных...', 'warn');

  try {
    // Очищаем localStorage
    const keys = Object.keys(localStorage);
    let count = 0;
    for (const key of keys) {
      if (
        key.startsWith('env-panel-') ||
        key.startsWith('shared_') ||
        key.startsWith('bookmarklet-')
      ) {
        localStorage.removeItem(key);
        count++;
      }
    }
    addLog(`🗑️ Удалено ${count} записей из localStorage`, 'info');

    // Удаляем экземпляры из глобального объекта
    if (window.__bookmarkletInstance?.destroy) {
      window.__bookmarkletInstance.destroy();
    }
    delete window.__bookmarkletInstance;
    delete window.R;
    delete window.globalState;
    delete window.__globalState;

    // Очищаем кеш
    await clearCache();

    addLog('✅ Сброс выполнен', 'ok');
    addLog('🔄 Перезагрузка страницы через 2 секунды...', 'info');

    setTimeout(() => {
      location.reload();
    }, 2000);
  } catch (e) {
    addLog(`❌ Ошибка сброса: ${e.message}`, 'fail');
  }
}

function copyBookmarklet() {
  const code = document.getElementById('bookmarklet-code');
  const text = code.textContent.trim();

  navigator.clipboard
    .writeText(text)
    .then(() => {
      addLog('📋 Букмарклет скопирован в буфер обмена', 'ok');
    })
    .catch(() => {
      const range = document.createRange();
      range.selectNode(code);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      try {
        document.execCommand('copy');
        addLog('📋 Букмарклет скопирован (fallback)', 'ok');
      } catch (e) {
        addLog('❌ Не удалось скопировать', 'fail');
      }
      window.getSelection().removeAllRanges();
    });
}

function copyManagerBookmarklet() {
  const text = `javascript:window.open('./Bookmarklet/manager.html','_blank','width=900,height=800');`;

  navigator.clipboard
    .writeText(text)
    .then(() => {
      addLog('📋 Менеджер скопирован в буфер обмена', 'ok');
    })
    .catch(() => {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      addLog('📋 Менеджер скопирован (fallback)', 'ok');
    });
}

// ============================================================
//  СЛУШАТЕЛИ СОБЫТИЙ
// ============================================================

// Слушаем изменения в localStorage
window.addEventListener('storage', event => {
  if (event.key === 'env-panel-instances' || event.key === 'env-panel-current-instance') {
    checkInstances();
  }
  if (event.key === 'env-panel-visible') {
    addLog(`📌 Видимость панели: ${event.newValue === 'true' ? 'показана' : 'скрыта'}`, 'info');
  }
});

// Слушаем сообщения от Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    addLog(`📨 Сообщение от SW: ${JSON.stringify(event.data)}`, 'info');
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    addLog('🔄 Контроллер SW изменился', 'info');
    setTimeout(checkAll, 500);
  });
}

// Слушаем ошибки
window.addEventListener('error', event => {
  addLog(`❌ Ошибка: ${event.message}`, 'fail');
});

window.addEventListener('unhandledrejection', event => {
  addLog(`❌ Unhandled rejection: ${event.reason}`, 'fail');
});

// ============================================================
//  ЭКСПОРТ В ГЛОБАЛЬНЫЙ ОБЪЕКТ
// ============================================================

window.manager = {
  checkAll,
  checkSW,
  checkSharedMemory,
  checkInstances,
  checkBookmarkletLoaded,
  registerSW,
  runBookmarklet,
  clearCache,
  resetAll,
  copyBookmarklet,
  copyManagerBookmarklet,
  clearLogs,
  addLog,
};

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================

addLog('📦 Bookmarklet Manager загружен', 'info');
addLog(`📌 Версия: 2.0`, 'info');
addLog(`📌 Origin: ${location.origin}`, 'info');

// Проверяем всё при загрузке
setTimeout(checkAll, 300);

// Обновляем статус каждые 10 секунд
setInterval(checkAll, 10000);

console.log('📦 Bookmarklet Manager загружен');
console.log('  Используйте manager.checkAll() для проверки');
console.log('  Используйте manager.registerSW() для регистрации SW');
console.log('  Используйте manager.runBookmarklet() для запуска');
console.log('  Используйте manager.resetAll() для сброса всего');
console.log('  Используйте manager.copyBookmarklet() для копирования букмарклета');
