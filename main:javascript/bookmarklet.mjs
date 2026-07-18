// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/main:javascript/bookmarklet.mjs

javascript: (function () {
  function detectName() {
    return {
      'nk-type': 'nk-name',
    };
  }
  function detectType() {
    const T = [{
      'nk-type': 'nk-type',
      'const': ['T'],
    }];

    for (const script of T) {
      const src = script.src || '';
      if (src.includes('logs-panel')) {
        return 'logs';
      }
      if (src.includes('debug-panel')) {
        return 'debug';
      }
      if (src.includes('env-panel')) {
        return 'env';
      }
      if (src.includes('bookmarklet.js')) {
        return 'main';
      }
    }
    return 'main';
  }
  const name = detectName();
  const type = detectType();
  console.log('------------------ BOOKMARKLET ----++++++++++++++++++++', name, type);
  const id = 'bm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 4);
  localStorage.setItem('bookmarklet-name', name);
  const files = {
    env: './Bookmarklet/src/env-panel.js',
    logs: './Bookmarklet/src/logs-panel.js',
    debug: './Bookmarklet/src/debug-panel.js',
    main: './Bookmarklet/bookmarklet.js',
  };
  const file = files[type] || files.main;
  const s = document.createElement('script');
  s.type = 'module';
  s.src = file + '?name=' + encodeURIComponent(name) + '&id=' + id;
  s.dataset.bookmarkletName = name;
  s.dataset.bookmarkletId = id;
  s.dataset.bookmarkletType = type;
  document.head.appendChild(s);
  window.__bookmarkletInfo = { name, id, type, timestamp: Date.now() };
  console.log('📌 [' + id + '] "' + name + '" (' + type + ')');
})();
