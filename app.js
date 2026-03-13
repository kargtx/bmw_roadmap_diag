// Состояние приложения
let items = [];
let currentItemForHelp = null;
let currentTheme = 'light';
let syncInterval = null;
let lastScrollTop = 0;
let isAtTop = true;
let lastItemsUpdate = 0;
let editSessionPassword = null;
let inspectionsUnlocked = false;

const API_BASE = (() => {
    if (location.origin && location.origin.startsWith('http')) {
        const host = location.hostname;
        const port = location.port;
        if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '3000') {
            return 'http://localhost:3000';
        }
        return location.origin;
    }
    return 'http://localhost:3000';
})();

const EDIT_PASSWORD = '7788';
const PROGRESS_KEY = 'dieselCheckProgress';
const VEHICLE_KEY = 'dieselCheckVehicle';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    loadVehicleInfo();
    setupVehicleInputs();

    await loadItemsFromServer();

    renderItems();
    updateLastSyncTime();

    // Запускаем синхронизацию
    startSync();

    // Отслеживаем скролл
    setupScrollHandler();
});

// Настройка обработчика скролла
function setupScrollHandler() {
    const topBar = document.getElementById('topBar');
    const progressContainer = document.getElementById('progressContainer');

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Проверяем, находится ли пользователь вверху страницы
        isAtTop = scrollTop < 50;

        // Показываем/скрываем прогресс-бар
        if (isAtTop) {
            progressContainer.classList.remove('hidden');
        } else {
            progressContainer.classList.add('hidden');
        }

        // Скрываем верхнюю панель при скролле вниз
        if (scrollTop > lastScrollTop && scrollTop > 60) {
            topBar.classList.add('hidden');
        } else {
            topBar.classList.remove('hidden');
        }

        lastScrollTop = scrollTop;
    });
}

// Синхронизация с сервером
function startSync() {
    if (syncInterval) clearInterval(syncInterval);

    syncInterval = setInterval(async () => {
        try {
            await refreshItemsIfUpdated();
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
        }
    }, 20000);
}

// Показать индикатор синхронизации
function showSyncIndicator(message) {
    const indicator = document.getElementById('syncIndicator');
    const status = document.getElementById('syncStatus');
    status.textContent = message;
    indicator.classList.add('show');
}

// Скрыть индикатор
function hideSyncIndicator() {
    const indicator = document.getElementById('syncIndicator');
    indicator.classList.remove('show');
}

// Обновление времени синхронизации
function updateLastSyncTime() {
    const lastSync = document.getElementById('lastSyncTime');
    if (lastSync && lastItemsUpdate) {
        const date = new Date(lastItemsUpdate);
        lastSync.textContent = `Последнее обновление: ${date.toLocaleString()}`;
    }
}

// Загрузка пунктов с сервера
async function loadItemsFromServer() {
    try {
        const response = await fetch(`${API_BASE}/api/items`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        if (!data || !Array.isArray(data.items)) throw new Error('Некорректный формат');

        lastItemsUpdate = data.updatedAt || Date.now();
        items = data.items.map(item => ({
            id: item.id,
            title: item.title,
            help: item.help,
            checked: false
        }));

        try {
            saveXMLToStorage(items);
        } catch (error) {
            console.error('Ошибка кэширования:', error);
        }

        applyLocalProgress();
        updateLastSyncTime();
        return true;
    } catch (error) {
        console.error('Ошибка загрузки с сервера:', error);
        items = await loadXMLFromFile();
        applyLocalProgress();
        return false;
    }
}

async function refreshItemsIfUpdated() {
    const response = await fetch(`${API_BASE}/api/items`);
    if (!response.ok) return;
    const data = await response.json();
    if (!data || !Array.isArray(data.items)) return;

    if (data.updatedAt && data.updatedAt > lastItemsUpdate) {
        showSyncIndicator('🔄 Получены обновления...');

        lastItemsUpdate = data.updatedAt;
        items = data.items.map(item => ({
            id: item.id,
            title: item.title,
            help: item.help,
            checked: false
        }));

        try {
            saveXMLToStorage(items);
        } catch (error) {
            console.error('Ошибка кэширования:', error);
        }

        applyLocalProgress();
        renderItems();
        updateLastSyncTime();

        setTimeout(() => hideSyncIndicator(), 1500);
    }
}

async function saveItemsToServer(password) {
    const payload = {
        password,
        items: items.map(item => ({
            id: item.id,
            title: item.title,
            help: item.help
        }))
    };

    let response;
    try {
        response = await fetch(`${API_BASE}/api/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        throw new Error('Сервер недоступен. Запустите server.js');
    }

    if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        const message = result.error || `Ошибка сохранения (код ${response.status})`;
        throw new Error(message);
    }

    const data = await response.json();
    lastItemsUpdate = data.updatedAt || Date.now();
    updateLastSyncTime();
}

// Восстановление из файла бэкапа
async function restoreFromBackupFlow() {
    const password = await requireEditPassword();
    if (!password) return;

    if (confirm('Восстановить все справки из файла бэкапа? Все текущие изменения будут потеряны.')) {
        showSyncIndicator('🔄 Восстановление из бэкапа...');

        const response = await fetch(`${API_BASE}/api/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            hideSyncIndicator();
            alert('Не удалось восстановить справки');
            return;
        }

        const data = await response.json();
        lastItemsUpdate = data.updatedAt || Date.now();
        items = data.items.map(item => ({
            id: item.id,
            title: item.title,
            help: item.help,
            checked: false
        }));

        applyLocalProgress();
        renderItems();
        updateLastSyncTime();

        setTimeout(() => {
            hideSyncIndicator();
            alert('Справки восстановлены из файла бэкапа!');
        }, 1000);

    }
}

// Отрисовка списка
function renderItems() {
    const list = document.getElementById('itemsList');
    if (!list) return;

    list.innerHTML = '';

    items.forEach((item, index) => {
        const displayTitle = getDisplayTitle(item);
        const card = document.createElement('div');
        card.className = 'item-card';

        card.innerHTML = `
            <div class="item-main">
                <div class="item-checkbox ${item.checked ? 'checked' : ''}" onclick="toggleCheck(${item.id})">
                    ${item.checked ? '✓' : ''}
                </div>
                <div class="item-content">
                    <div class="item-title">${index + 1}. ${displayTitle}</div>
                    <div class="item-number">ID: ${item.id}</div>
                </div>
            </div>
            <button class="item-help-btn" onclick="showHelp(${item.id})">
                <span>📖</span> Показать справку
            </button>
        `;

        list.appendChild(card);
    });

    updateStats();
}

// Показать справку
function showHelp(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    currentItemForHelp = id;

    document.getElementById('helpModalTitle').textContent = getDisplayTitle(item);
    document.getElementById('modalHelpContent').textContent = item.help || 'Нет справки для этого пункта';
    document.getElementById('helpModal').classList.add('active');

    // Блокируем скролл body
    document.body.style.overflow = 'hidden';
}

// Закрыть справку
function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('active');

    // Возвращаем скролл body
    document.body.style.overflow = '';
}

// Переключение чекбокса
function toggleCheck(id) {
    const item = items.find(i => i.id === id);
    if (item) {
        item.checked = !item.checked;
        renderItems();
        saveProgress();

        showSyncIndicator('🔄 Сохранение...');
        setTimeout(() => hideSyncIndicator(), 1000);
    }
}

// Обновление статистики
function updateStats() {
    const total = items.length;
    const completed = items.filter(i => i.checked).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('completedCount').textContent = completed;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressPercent').textContent = percent;
}

// Добавление нового пункта
async function addNewItem() {
    const password = await requireEditPassword();
    if (!password) return;

    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const newItem = {
        id: newId,
        title: `Новый пункт ${newId}`,
        help: `Пункт ${newId}:\n1) Описание действия`,
        checked: false
    };

    items.push(newItem);

    try {
        await saveItemsToServer(password);
        renderItems();
        showHelp(newId);

        showSyncIndicator('➕ Добавлен новый пункт');
        setTimeout(() => hideSyncIndicator(), 1500);
    } catch (error) {
        alert(error.message || 'Ошибка сохранения');
    }
}

// Редактирование текущей справки
async function editCurrentHelp() {
    if (!currentItemForHelp) return;

    const password = await requireEditPassword();
    if (!password) return;
    editSessionPassword = password;

    const itemId = currentItemForHelp;
    closeHelpModal();

    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const displayTitle = getDisplayTitle(item);
    document.getElementById('editModalTitle').textContent = `Редактирование: ${displayTitle}`;
    document.getElementById('editTitle').value = normalizeTitle(item.title) || displayTitle;
    document.getElementById('editHelp').value = item.help || '';
    document.getElementById('editModal').classList.add('active');

    
    // Блокируем скролл body
    document.body.style.overflow = 'hidden';
}

// Закрыть редактирование
function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');

    // Возвращаем скролл body
    document.body.style.overflow = '';
}

// Сохранение изменений
async function saveItem() {
    const title = document.getElementById('editTitle').value.trim();
    const help = document.getElementById('editHelp').value.trim();

    if (!title) {
        alert('Введите название пункта');
        return;
    }

    const item = items.find(i => i.id === currentItemForHelp);
    if (item) {
        item.title = title;
        item.help = help;

        try {
            const password = editSessionPassword || await requireEditPassword();
            if (!password) return;

            await saveItemsToServer(password);
            renderItems();

            showSyncIndicator('🔄 Изменения сохранены');
            setTimeout(() => hideSyncIndicator(), 1500);
        } catch (error) {
            alert(error.message || 'Ошибка сохранения');
        }
    }

    closeEditModal();
}

// Удаление пункта
async function deleteCurrentItem() {
    if (items.length <= 1) {
        alert('Нельзя удалить последний пункт');
        return;
    }

    const password = await requireEditPassword();
    if (!password) return;

    if (confirm('Удалить этот пункт?')) {
        items = items.filter(i => i.id !== currentItemForHelp);

        try {
            await saveItemsToServer(password);
            renderItems();
            closeEditModal();

            showSyncIndicator('🔄 Пункт удален');
            setTimeout(() => hideSyncIndicator(), 1500);
        } catch (error) {
            alert(error.message || 'Ошибка сохранения');
        }
    }
}

// Снять все отметки
function clearAllChecks() {
    items.forEach(item => item.checked = false);
    renderItems();
    saveProgress();

    showSyncIndicator('🔄 Отметки сняты');
    setTimeout(() => hideSyncIndicator(), 1000);
}

// Окончить проверку
async function finishInspection() {
    const vehicle = getVehicleInfo();
    if (!vehicle.modelCode || !vehicle.plate) {
        alert('Заполните код модели и госномер');
        return;
    }

    if (!isValidPlate(vehicle.plate)) {
        alert('Госномер должен быть в формате Х666ХХ666');
        return;
    }

    const completedItems = items.filter(i => i.checked).map(i => ({ id: i.id, title: getDisplayTitle(i) }));
    const total = items.length;
    const completed = completedItems.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    let message = `✅ Выполнено: ${completed}/${total} (${percent}%)\n\n`;
    message += '✅ Выполненные проверки:\n';
    if (completedItems.length > 0) {
        completedItems.forEach((item, idx) => {
            message += `${idx + 1}. ${item.title}\n`;
        });
    } else {
        message += '— Нет выполненных проверок\n';
    }

    if (completed === total && total > 0) {
        message += '\n🎉 Все пункты отмечены! Проверка завершена.';
    }

    alert(message);

    await saveInspection({
        modelCode: vehicle.modelCode,
        plate: vehicle.plate,
        completed,
        total,
        completedItems,
        completedAt: new Date().toISOString()
    });

    if (inspectionsUnlocked) {
        await loadInspections();
        const container = document.getElementById('inspectionsList');
        if (container) container.classList.remove('hidden');
    }
}

// Переключение темы
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggleSmall');

    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙 Сменить тему';
        currentTheme = 'light';
    } else {
        body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️ Сменить тему';
        currentTheme = 'dark';
    }

    localStorage.setItem('theme', currentTheme);
}

// Загрузка темы
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        const btn = document.getElementById('themeToggleSmall');
        if (btn) btn.textContent = '☀️ Сменить тему';
        currentTheme = 'dark';
    }
}

// Данные автомобиля
function setupVehicleInputs() {
    const modelInput = document.getElementById('modelCodeInput');
    const plateInput = document.getElementById('plateInput');
    if (!modelInput || !plateInput) return;

    modelInput.addEventListener('input', () => {
        modelInput.value = modelInput.value.toUpperCase().replace(/\s+/g, '');
        saveVehicleInfo();
    });

    plateInput.addEventListener('input', () => {
        plateInput.value = formatPlateInput(plateInput.value);
        saveVehicleInfo();
    });
}

function formatPlateInput(value) {
    const cleaned = value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
    return cleaned.slice(0, 9);
}

function isValidPlate(value) {
    const normalized = value.toUpperCase();
    return /^[A-ZА-Я]\d{3}[A-ZА-Я]{2}\d{3}$/.test(normalized);
}

function getVehicleInfo() {
    const modelInput = document.getElementById('modelCodeInput');
    const plateInput = document.getElementById('plateInput');
    return {
        modelCode: modelInput ? modelInput.value.trim() : '',
        plate: plateInput ? plateInput.value.trim().toUpperCase() : ''
    };
}

function saveVehicleInfo() {
    const info = getVehicleInfo();
    localStorage.setItem(VEHICLE_KEY, JSON.stringify(info));
}

function loadVehicleInfo() {
    try {
        const raw = localStorage.getItem(VEHICLE_KEY);
        if (!raw) return;
        const info = JSON.parse(raw);
        const modelInput = document.getElementById('modelCodeInput');
        const plateInput = document.getElementById('plateInput');
        if (modelInput && info.modelCode) modelInput.value = info.modelCode;
        if (plateInput && info.plate) plateInput.value = info.plate;
    } catch (error) {
        console.error('Ошибка загрузки данных авто:', error);
    }
}

function normalizeTitle(rawTitle) {
    if (!rawTitle) return '';
    return rawTitle
        .replace(/^Пункт\\s*\\d+\\s*[:\\-–—]?\\s*/i, '')
        .trim();
}

function getDisplayTitle(item) {
    if (!item) return 'Без названия';
    const normalizedTitle = normalizeTitle(item.title);
    if (normalizedTitle) return normalizedTitle;
    const derived = deriveTitleFromHelp(item.help, item.id);
    return derived || (item.title || `Пункт ${item.id}`);
}

function deriveTitleFromHelp(helpText, id) {
    if (!helpText) return '';
    const firstLine = helpText.split('\\n')[0].trim();
    if (!firstLine) return '';
    const cleaned = normalizeTitle(firstLine);
    return cleaned || firstLine;
}

// Прогресс локально
function saveProgress() {
    const checkedIds = items.filter(i => i.checked).map(i => i.id);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(checkedIds));
}

function applyLocalProgress() {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (!raw) return;
        const checkedIds = new Set(JSON.parse(raw));
        items.forEach(item => {
            item.checked = checkedIds.has(item.id);
        });
    } catch (error) {
        console.error('Ошибка прогресса:', error);
    }
}

// Пароль
async function requireEditPassword() {
    const pass = prompt('Введите пароль для редактирования');
    if (!pass) return null;
    if (pass !== EDIT_PASSWORD) {
        alert('Неверный пароль');
        return null;
    }
    return pass;
}

// Панель мастера
async function loadInspections() {
    try {
        const response = await fetch(`${API_BASE}/api/inspections`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        renderInspections(Array.isArray(data) ? data : []);
    } catch (error) {
        console.error('Ошибка загрузки проверок:', error);
        renderInspections([]);
    }
}

function renderInspections(list) {
    const container = document.getElementById('inspectionsList');
    if (!container) return;

    if (!list.length) {
        container.innerHTML = '<div class="inspection-card">Проверок пока нет</div>';
        return;
    }

    container.innerHTML = '';
    list.forEach(item => {
        const card = document.createElement('div');
        card.className = 'inspection-card';

        const completedAt = item.completedAt ? new Date(item.completedAt).toLocaleString() : '';
        const completedItems = Array.isArray(item.completedItems) ? item.completedItems : [];
        const listText = completedItems.map(i => `• ${i.title}`).join('\n');

        card.innerHTML = `
            <div class="inspection-title">${item.modelCode || 'Без модели'} • ${item.plate || 'Без номера'}</div>
            <div class="inspection-meta">${completedAt} • ${item.completed || 0}/${item.total || 0} пунктов</div>
            <div class="inspection-items">${listText || 'Нет отмеченных пунктов'}</div>
        `;

        container.appendChild(card);
    });
}

async function saveInspection(inspection) {
    try {
        await fetch(`${API_BASE}/api/inspections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inspection })
        });
    } catch (error) {
        console.error('Ошибка сохранения проверки:', error);
    }
}

// Открыть проверки мастера (по паролю)
async function unlockInspections() {
    const password = await requireEditPassword();
    if (!password) return;

    inspectionsUnlocked = true;
    await loadInspections();

    const container = document.getElementById('inspectionsList');
    if (container) {
        container.classList.remove('hidden');
    }

}

// Очистка интервала
window.addEventListener('beforeunload', () => {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
});

// Управление выезжающей панелью инструментов
function toggleToolsPanel() {
    const panel = document.getElementById('toolsPanel');
    const overlay = document.getElementById('toolsOverlay');
    const btn = document.getElementById('toolsToggleBtn');
    const isActive = panel.classList.contains('active');
    
    panel.classList.toggle('active');
    overlay.classList.toggle('active');
    
    // Скрываем/показываем кнопку
    if (!isActive) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'flex';
    }
}

function closeToolsPanel() {
    const panel = document.getElementById('toolsPanel');
    const overlay = document.getElementById('toolsOverlay');
    const btn = document.getElementById('toolsToggleBtn');
    panel.classList.remove('active');
    overlay.classList.remove('active');
    btn.style.display = 'flex';
}
