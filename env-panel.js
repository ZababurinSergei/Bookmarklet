// env-panel.js - ENV Control Panel Bookmarklet
(function () {
  if (typeof ENV === 'undefined' && typeof window.ENV === 'undefined') {
    alert('❌ ENV не найден на этой странице!');
    return;
  }
  const env = window.ENV || ENV;

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

  const oldPanel = document.getElementById('env-control-panel');
  if (oldPanel) oldPanel.remove();

  const panel = document.createElement('div');
  panel.id = 'env-control-panel';

  const saved = localStorage.getItem('env-panel-position');
  let pos = { x: 20, y: 20 };
  if (saved) {
    try {
      const p = JSON.parse(saved);
      if (typeof p.x === 'number' && typeof p.y === 'number') pos = p;
    } catch (e) {}
  }

  panel.style.cssText = `
    position:fixed;
    left:${pos.x}px;
    top:${pos.y}px;
    z-index:999999;
    background:rgba(26,26,46,0.95);
    backdrop-filter:blur(20px);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:16px;
    padding:20px;
    max-width:380px;
    max-height:80vh;
    overflow-y:auto;
    color:#fff;
    font-family:Segoe UI,system-ui,sans-serif;
    font-size:13px;
    box-shadow:0 20px 60px rgba(0,0,0,0.8);
    min-width:320px;
    scrollbar-width:thin;
    scrollbar-color:#667eea transparent;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display:flex;
    justify-content:space-between;
    align-items:center;
    margin-bottom:15px;
    padding-bottom:10px;
    border-bottom:1px solid rgba(255,255,255,0.05);
    cursor:grab;
    user-select:none;
  `;

  const cur = env.DEBUG.namespace || 'off';
  header.innerHTML = `
    <span style="font-weight:bold;font-size:15px;">🔍 ENV Control</span>
    <div style="display:flex;align-items:center;gap:8px;">
      <span id="env-status" style="
        font-size:11px;
        padding:3px 12px;
        border-radius:12px;
        background:${cur !== 'off' ? 'rgba(0,184,148,0.2)' : 'rgba(255,255,255,0.05)'};
        color:${cur !== 'off' ? '#00b894' : '#636e72'};
        max-width:120px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      ">${cur}</span>
      <button id="env-close-btn" style="
        background:none;
        border:none;
        color:#8899bb;
        cursor:pointer;
        font-size:18px;
        padding:0 5px;
      ">✕</button>
    </div>
  `;
  panel.appendChild(header);

  const groups = document.createElement('div');
  groups.style.cssText = 'display:flex;flex-direction:column;gap:10px';
  let val = env.DEBUG.namespace || '';

  Object.entries(GROUPS).forEach(([name, group]) => {
    const g = document.createElement('div');
    g.style.cssText =
      'border:1px solid rgba(255,255,255,0.05);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,0.02)';

    const t = document.createElement('div');
    t.style.cssText =
      'font-size:11px;font-weight:bold;color:#8899bb;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px';
    t.textContent = name;
    g.appendChild(t);

    const b = document.createElement('div');
    b.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px';

    group.presets.forEach(p => {
      const active = val === p.value;
      const btn = document.createElement('button');
      btn.textContent = p.name;
      btn.dataset.preset = p.value || '';
      btn.style.cssText = `
        padding:4px 10px;
        border:1px solid ${active ? '#667eea' : 'rgba(255,255,255,0.05)'};
        border-radius:5px;
        background:${active ? 'rgba(102,126,234,0.3)' : 'rgba(255,255,255,0.03)'};
        color:${active ? '#fff' : '#8899bb'};
        font-size:11px;
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
        } else {
          env.debug.disable();
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
  panel.appendChild(groups);

  const actions = document.createElement('div');
  actions.style.cssText =
    'margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:6px;flex-wrap:wrap';

  [
    {
      text: '📊 Показать ENV',
      color: '#8899bb',
      bg: 'rgba(255,255,255,0.03)',
      action: () => {
        console.log('ENV:', env.debug.getConfig());
        alert('ENV:\n' + JSON.stringify(env.debug.getConfig(), null, 2));
      },
    },
    {
      text: '🔊 Все включить',
      color: '#00b894',
      bg: 'rgba(0,184,148,0.1)',
      action: () => {
        env.debug.enable('wasm:*');
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
      text: '🔇 Всё отключить',
      color: '#636e72',
      bg: 'rgba(255,255,255,0.03)',
      action: () => {
        env.debug.disable();
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
  ].forEach(a => {
    const btn = document.createElement('button');
    btn.textContent = a.text;
    btn.style.cssText = `
      padding:5px 12px;
      border:1px solid rgba(255,255,255,0.05);
      border-radius:5px;
      background:${a.bg};
      color:${a.color};
      font-size:11px;
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
  panel.appendChild(actions);

  document.getElementById('env-close-btn').onclick = () => {
    panel.style.transform = 'scale(0.8)';
    panel.style.opacity = '0';
    setTimeout(() => {
      panel.style.display = 'none';
      localStorage.setItem('env-panel-visible', 'false');
    }, 300);
  };

  let dragging = false;
  let startX, startY, panelX, panelY;

  header.onmousedown = e => {
    if (e.target.tagName === 'BUTTON') return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const r = panel.getBoundingClientRect();
    panelX = r.left;
    panelY = r.top;
    header.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    panel.style.transition = 'none';
  };

  document.onmousemove = e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = Math.max(0, panelX + dx) + 'px';
    panel.style.top = Math.max(0, panelY + dy) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  };

  document.onmouseup = () => {
    if (dragging) {
      dragging = false;
      header.style.cursor = 'grab';
      document.body.style.userSelect = '';
      panel.style.transition = '';
      const r = panel.getBoundingClientRect();
      localStorage.setItem('env-panel-position', JSON.stringify({ x: r.left, y: r.top }));
      localStorage.setItem('env-panel-visible', 'true');
    }
  };

  document.body.appendChild(panel);
  panel.style.transform = 'scale(0.9)';
  panel.style.opacity = '0';
  panel.style.transition = 'all 0.3s ease';
  setTimeout(() => {
    panel.style.transform = 'scale(1)';
    panel.style.opacity = '1';
  }, 50);
  localStorage.setItem('env-panel-visible', 'true');
  console.log('✅ ENV Control загружена!');
})();



javascript: (function () {
  const s = document.createElement('script');
  s.src =
    'https://raw.githubusercontent.com/ZababurinSergei/mtproto-mqtt-gateway/refs/heads/master/metaflow/02-config-generator/web/Bookmarklet/env-panel.js?token=GHSAT0AAAAAAD7IHO6FV4P2Y474TJJRUJQS2SWQ3MQ';
  document.head.appendChild(s);
})();
