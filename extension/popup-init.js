// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/popup-init.js
// Скрипт для определения PiP режима и инициализации окна (отдельный файл, без inline)

(function () {
  'use strict';

  // ============================================================
  // 1. ОПРЕДЕЛЕНИЕ PiP РЕЖИМА
  // ============================================================

  // Флаг для определения PiP режима
  if (window.documentPictureInPicture && window.documentPictureInPicture.window === window) {
    window.__isPipMode = true;
  }

  // ============================================================
  // 2. УНИКАЛЬНОСТЬ ОКНА
  // ============================================================

  const POPUP_INIT_KEY = 'bookmarklet-bridge-popup-initialized';
  const POPUP_INSTANCE_ID = Date.now().toString(36) + Math.random().toString(36).substr(2, 4);

  // Проверяем, не открыто ли уже другое окно
  try {
    const existingId = localStorage.getItem(POPUP_INIT_KEY);
    if (existingId && !window.__isPipMode) {
      console.log(`⚠️ Другое окно уже инициализировано (${existingId})`);
    }
    // Сохраняем ID этого окна
    localStorage.setItem(POPUP_INIT_KEY, POPUP_INSTANCE_ID);
  } catch (e) {
    // Игнорируем ошибки localStorage
  }

  // ============================================================
  // 3. ОЧИСТКА ПРИ ЗАКРЫТИИ
  // ============================================================

  window.addEventListener('beforeunload', function () {
    try {
      const currentId = localStorage.getItem(POPUP_INIT_KEY);
      if (currentId === POPUP_INSTANCE_ID) {
        localStorage.removeItem(POPUP_INIT_KEY);
      }
    } catch (e) {
      // Игнорируем ошибки
    }
  });

  // ============================================================
  // 4. ОБРАБОТКА СООБЩЕНИЙ ОТ PiP
  // ============================================================

  window.addEventListener('message', function (event) {
    if (event.data && event.data.action === 'pip_init') {
      console.log('📦 Получены данные для PiP инициализации');
      // Данные будут обработаны в popup.js
      window.__pipData = event.data.state;
    }
  });

  // ============================================================
  // 5. ПРОВЕРКА ПОДДЕРЖКИ PiP
  // ============================================================

  window.__pipSupported = 'documentPictureInPicture' in window;
  if (!window.__pipSupported) {
    console.log('ℹ️ Document Picture-in-Picture не поддерживается');
  }

  // ============================================================
  // 6. ЛОГИРОВАНИЕ
  // ============================================================

  console.log('📦 Popup инициализирован (ID: ' + POPUP_INSTANCE_ID + ')');
  console.log('📌 PiP режим: ' + (window.__isPipMode ? '✅ активен' : '❌ не активен'));
  console.log('📌 PiP поддержка: ' + (window.__pipSupported ? '✅ есть' : '❌ нет'));
})();
