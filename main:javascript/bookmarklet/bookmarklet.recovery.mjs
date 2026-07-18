// packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/main:javascript/bookmarklet.mjs

javascript: (function (...args) {

  console.log('INIT_THIS', args);
  function detectName() {
    const scripts = document.querySelectorAll('script[data-bookmarklet-name]');
    console.log('-------------------', scripts);
    for (const script of scripts) {
      if (script.dataset.bookmarkletName) {return script.dataset.bookmarkletName;}
    }
    const params = new URLSearchParams(window.location.search);
    const nameParam = params.get('name');
    if (nameParam) {return decodeURIComponent(nameParam);}
    const saved = localStorage.getItem('bookmarklet-name');
    if (saved) {return saved;}
    const title = document.title || '';
    if (title.includes('ENV') || title.includes('env')) {return 'ENV Control';}
    if (title.includes('Logs') || title.includes('logs')) {return 'Logs Control';}
    if (title.includes('Debug') || title.includes('debug')) {return 'Debug Control';}
    if (title.includes('Manager') || title.includes('manager')) {return 'Manager';}
    if (title.includes('Widget') || title.includes('widget')) {return 'Widget';}
    return 'Bookmarklet';
  }
  function detectType() {
    const scripts = document.querySelectorAll('script[src*="bookmarklet"]');
    for (const script of scripts) {
      const src = script.src || '';
      if (src.includes('logs-panel')) {return 'logs';}
      if (src.includes('debug-panel')) {return 'debug';}
      if (src.includes('env-panel')) {return 'env';}
      if (src.includes('bookmarklet.js')) {return 'main';}
    }
    return 'main';
  }
  const name = detectName();
  const type = detectType();
  console.log('----------------------++++++++++++++++++++', name, type);
  const id = 'bm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
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