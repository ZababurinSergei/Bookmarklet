## 📄 Полный `popup.html` с обновлениями

```html
<!-- packages/mtproto-mqtt-gateway/metaflow/02-config-generator/web/Bookmarklet/extension/popup.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bookmarklet Bridge</title>
    <link rel="stylesheet" href="popup.css">
</head>
<body>
    <div id="popup-container">
        <!-- ============================================================
        ШАПКА
        ============================================================ -->
        <div class="header">
            <div class="header-title">
                <span class="icon">📦</span>
                <span>Bookmarklet Bridge</span>
                <span class="version">v1.0</span>
            </div>
            <div class="status-badge" id="status-badge">
                <span class="dot active"></span>
                <span id="status-text">Активно</span>
            </div>
        </div>

        <!-- ============================================================
        ВКЛАДКИ
        ============================================================ -->
        <div class="tabs">
            <button class="tab-btn active" data-tab="settings">⚙️ Настройки</button>
            <button class="tab-btn" data-tab="bookmarks">📑 Закладки</button>
            <button class="tab-btn" data-tab="logs">📋 Логи</button>
            <button class="tab-btn" data-tab="info">ℹ️ Инфо</button>
        </div>

        <!-- ============================================================
        СОДЕРЖИМОЕ ВКЛАДОК
        ============================================================ -->
        <div class="tab-content">
            <!-- ============================================================
            ВКЛАДКА: НАСТРОЙКИ
            ============================================================ -->
            <div class="tab-panel active" id="tab-settings">
                <!-- Группа: Параметры подключения -->
                <div class="settings-group">
                    <h3>🔌 Параметры подключения</h3>
                    
                    <div class="setting-item">
                        <label for="bridge-enabled">Включить мост</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="bridge-enabled" checked>
                            <span class="slider"></span>
                        </div>
                        <span class="setting-desc">Разрешить букмарклетам запрашивать данные</span>
                    </div>

                    <div class="setting-item">
                        <label for="auto-respond">Авто-ответ</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="auto-respond" checked>
                            <span class="slider"></span>
                        </div>
                        <span class="setting-desc">Автоматически отвечать на запросы букмарклетов</span>
                    </div>

                    <div class="setting-item">
                        <label for="timeout">Таймаут ответа (мс)</label>
                        <input type="number" id="timeout" value="5000" min="1000" max="30000" step="500">
                        <span class="setting-desc">Максимальное время ожидания ответа</span>
                    </div>

                    <div class="setting-item">
                        <label for="cache-ttl">Время кеша (сек)</label>
                        <input type="number" id="cache-ttl" value="30" min="5" max="300" step="5">
                        <span class="setting-desc">Время хранения данных в кеше</span>
                    </div>
                </div>

                <!-- Группа: Параметры расширения -->
                <div class="settings-group">
                    <h3>📡 Параметры расширения</h3>
                    
                    <div class="setting-item">
                        <label for="debug-mode">Режим отладки</label>
                        <div class="toggle-switch">
                            <input type="checkbox" id="debug-mode">
                            <span class="slider"></span>
                        </div>
                        <span class="setting-desc">Показывать подробные логи в консоли</span>
                    </div>

                    <div class="setting-item">
                        <label for="log-level">Уровень логирования</label>
                        <select id="log-level">
                            <option value="error">❌ Только ошибки</option>
                            <option value="warn">⚠️ Предупреждения</option>
                            <option value="info" selected>ℹ️ Информация</option>
                            <option value="debug">🔍 Отладка</option>
                            <option value="trace">🐛 Трассировка</option>
                        </select>
                        <span class="setting-desc">Детализация логов</span>
                    </div>

                    <div class="setting-item">
                        <label for="max-logs">Максимум логов</label>
                        <input type="number" id="max-logs" value="100" min="10" max="1000" step="10">
                        <span class="setting-desc">Количество записей в истории логов</span>
                    </div>
                </div>

                <!-- Группа: Статистика -->
                <div class="settings-group">
                    <h3>📊 Статистика</h3>
                    <div class="stats-grid" id="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Всего запросов</span>
                            <span class="stat-value" id="stat-requests">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Успешных</span>
                            <span class="stat-value success" id="stat-success">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Ошибок</span>
                            <span class="stat-value error" id="stat-errors">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Закладок в кеше</span>
                            <span class="stat-value" id="stat-cache">0</span>
                        </div>
                    </div>
                </div>

                <!-- Кнопки действий -->
                <div class="settings-actions">
                    <button class="btn btn-primary" id="btn-save-settings">💾 Сохранить</button>
                    <button class="btn btn-secondary" id="btn-reset-settings">↺ Сбросить</button>
                    <button class="btn btn-danger" id="btn-clear-cache">🗑️ Очистить кеш</button>
                </div>
            </div>

            <!-- ============================================================
            ВКЛАДКА: ЗАКЛАДКИ
            ============================================================ -->
            <div class="tab-panel" id="tab-bookmarks">
                <!-- Панель инструментов -->
                <div class="bookmarks-toolbar">
                    <input type="text" id="bookmark-filter" placeholder="🔍 Фильтр закладок...">
                    <button class="btn btn-secondary" id="btn-refresh-bookmarks">🔄 Обновить</button>
                    <button class="btn btn-secondary" id="btn-export-bookmarks">📤 Экспорт</button>
                </div>

                <!-- Статистика закладок -->
                <div class="bookmarks-stats" id="bookmarks-stats">
                    <span>Всего: <strong id="bookmarks-total">0</strong></span>
                    <span>Букмарклетов: <strong id="bookmarks-bookmarklets">0</strong></span>
                    <span>Папок: <strong id="bookmarks-folders">0</strong></span>
                </div>

                <!-- Список закладок -->
                <div class="bookmarks-list" id="bookmarks-list">
                    <div class="loading">⏳ Загрузка закладок...</div>
                </div>
            </div>

            <!-- ============================================================
            ВКЛАДКА: ЛОГИ
            ============================================================ -->
            <div class="tab-panel" id="tab-logs">
                <!-- Панель инструментов -->
                <div class="logs-toolbar">
                    <button class="btn btn-secondary" id="btn-clear-logs">🗑️ Очистить</button>
                    <button class="btn btn-secondary" id="btn-export-logs">📤 Экспорт</button>
                    <select id="log-filter">
                        <option value="all">Все</option>
                        <option value="error">❌ Ошибки</option>
                        <option value="warn">⚠️ Предупреждения</option>
                        <option value="info">ℹ️ Информация</option>
                        <option value="debug">🔍 Отладка</option>
                    </select>
                </div>

                <!-- Контейнер логов -->
                <div class="logs-container" id="logs-container">
                    <div class="log-empty">📭 Логи будут отображаться здесь</div>
                </div>
            </div>

            <!-- ============================================================
            ВКЛАДКА: ИНФО
            ============================================================ -->
            <div class="tab-panel" id="tab-info">
                <!-- Группа: О расширении -->
                <div class="info-group">
                    <h3>📦 О расширении</h3>
                    <div class="info-item">
                        <span class="info-label">Название</span>
                        <span class="info-value">Bookmarklet Bridge</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Версия</span>
                        <span class="info-value">1.0.0</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">ID</span>
                        <span class="info-value" id="extension-id">—</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Статус</span>
                        <span class="info-value" id="connection-status">🟢 Подключено</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Последнее обновление</span>
                        <span class="info-value" id="last-update">—</span>
                    </div>
                </div>

                <!-- Группа: Текущая вкладка -->
                <div class="info-group">
                    <h3>📌 Текущая вкладка</h3>
                    <div class="info-item">
                        <span class="info-label">Название</span>
                        <span class="info-value" id="current-tab-title">—</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">URL</span>
                        <span class="info-value" id="current-tab-url" style="font-size:11px;color:#636e72;word-break:break-all;">—</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Закладка</span>
                        <span class="info-value" id="current-bookmark-title">—</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Тип</span>
                        <span class="info-value" id="current-bookmark-type">—</span>
                    </div>
                    <button class="btn btn-secondary" id="btn-refresh-tab" style="margin-top:8px;width:100%;">
                        🔄 Обновить данные вкладки
                    </button>
                </div>

                <!-- Группа: Быстрые команды -->
                <div class="info-group">
                    <h3>📋 Быстрые команды</h3>
                    <div class="quick-commands">
                        <div class="command-item">
                            <code>requestBookmarkData()</code>
                            <span class="command-desc">Получить данные текущей закладки</span>
                        </div>
                        <div class="command-item">
                            <code>clearCache()</code>
                            <span class="command-desc">Очистить кеш закладок</span>
                        </div>
                        <div class="command-item">
                            <code>getCacheStats()</code>
                            <span class="command-desc">Статистика кеша</span>
                        </div>
                        <div class="command-item">
                            <code>findBookmarkData(url)</code>
                            <span class="command-desc">Поиск закладки по URL</span>
                        </div>
                        <div class="command-item">
                            <code>requestBookmarkDetails()</code>
                            <span class="command-desc">Детальная информация о закладке</span>
                        </div>
                    </div>
                </div>

                <!-- Группа: Полезные ссылки -->
                <div class="info-group">
                    <h3>🔗 Полезные ссылки</h3>
                    <div class="links">
                        <a href="#" id="link-manager" class="link-item">📦 Открыть менеджер букмарклетов</a>
                        <a href="#" id="link-install" class="link-item">📥 Страница установки букмарклетов</a>
                        <a href="#" id="link-debug" class="link-item">🐛 Открыть debug панель</a>
                        <a href="#" id="link-bookmarks" class="link-item">📑 Управление закладками (chrome://bookmarks)</a>
                    </div>
                </div>
            </div>
        </div>

        <!-- ============================================================
        ПОДВАЛ
        ============================================================ -->
        <div class="footer">
            <span id="footer-status">🟢 Активно</span>
            <span id="footer-version">v1.0.0</span>
            <span id="footer-time"></span>
        </div>
    </div>

    <script src="popup.js" type="module"></script>
</body>
</html>
```

## 📊 Структура документа

```
popup.html
├── Шапка (header)
│   ├── Заголовок с иконкой и версией
│   └── Статус-бейдж с индикатором активности
│
├── Вкладки (tabs)
│   ├── ⚙️ Настройки
│   ├── 📑 Закладки
│   ├── 📋 Логи
│   └── ℹ️ Инфо
│
├── Контент (tab-content)
│   ├── Вкладка: Настройки
│   │   ├── Параметры подключения (4 настройки)
│   │   ├── Параметры расширения (3 настройки)
│   │   ├── Статистика (4 показателя)
│   │   └── Кнопки действий (3 кнопки)
│   │
│   ├── Вкладка: Закладки
│   │   ├── Панель инструментов (фильтр + 2 кнопки)
│   │   ├── Статистика (3 показателя)
│   │   └── Список закладок
│   │
│   ├── Вкладка: Логи
│   │   ├── Панель инструментов (2 кнопки + фильтр)
│   │   └── Контейнер логов
│   │
│   └── Вкладка: Инфо
│       ├── О расширении (5 полей)
│       ├── Текущая вкладка (4 поля + кнопка обновления)
│       ├── Быстрые команды (5 команд)
│       └── Полезные ссылки (4 ссылки)
│
└── Подвал (footer)
    ├── Статус
    ├── Версия
    └── Время
```

## ✨ Основные изменения в `popup.html`

1. **Новая вкладка "ℹ️ Инфо"** — собрана вся полезная информация
2. **Блок "Текущая вкладка"** — показывает активную вкладку и её закладку
3. **Кнопка обновления** — принудительное обновление данных вкладки
4. **Быстрые команды** — список доступных команд для консоли
5. **Полезные ссылки** — быстрый доступ к менеджеру, установке и закладкам
6. **Единые отступы** — все элементы выровнены по сетке
