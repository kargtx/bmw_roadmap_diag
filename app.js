// Состояние приложения
let items = [];
let selectedItemId = 1;
let currentTheme = 'light';
let syncInterval = null;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    items = loadItemsFromStorage();
    
    // Если items пустой или не массив, используем INITIAL_ITEMS
    if (!items || !Array.isArray(items) || items.length === 0) {
        items = JSON.parse(JSON.stringify(INITIAL_ITEMS));
    }
    
    selectedItemId = items[0]?.id || 1;
    
    renderItems();
    renderHelp();
    updateLastSyncTime();
    
    // Запускаем синхронизацию между вкладками
    startSync();
});

// Синхронизация между вкладками/устройствами
function startSync() {
    // Слушаем изменения в localStorage из других вкладок
    window.addEventListener('storage', (e) => {
        if (e.key === 'dieselCheckData' && e.newValue) {
            try {
                const newData = JSON.parse(e.newValue);
                if (newData.items && Array.isArray(newData.items)) {
                    // Показываем индикатор синхронизации
                    showSyncIndicator('🔄 Получены обновления...');
                    
                    // Обновляем данные
                    items = newData.items;
                    
                    // Проверяем, существует ли выбранный ID
                    if (!items.find(i => i.id === selectedItemId)) {
                        selectedItemId = items[0]?.id || null;
                    }
                    
                    renderItems();
                    renderHelp();
                    updateLastSyncTime();
                    
                    setTimeout(() => hideSyncIndicator(), 2000);
                }
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
            }
        }
    });
    
    // Периодическая проверка обновлений (для разных устройств)
    syncInterval = setInterval(checkForUpdates, 5000);
}

// Проверка обновлений
function checkForUpdates() {
    const lastSync = localStorage.getItem('lastSyncTime');
    if (lastSync) {
        // Здесь можно добавить логику проверки с сервером
        // Для локального хранения просто обновляем время
        updateLastSyncTime();
    }
}

// Показать индикатор синхронизации
function showSyncIndicator(message) {
    const indicator = document.getElementById('syncIndicator');
    const status = document.getElementById('syncStatus');
    status.textContent = message;
    indicator.classList.add('show');
}

// Скрыть индикатор синхронизации
function hideSyncIndicator() {
    const indicator = document.getElementById('syncIndicator');
    indicator.classList.remove('show');
}

// Обновление времени последней синхронизации
function updateLastSyncTime() {
    const lastSync = document.getElementById('lastSyncTime');
    if (lastSync) {
        lastSync.textContent = `Последняя синхронизация: ${getLastSyncTime()}`;
    }
}

// Восстановление из бэкапа
function restoreFromBackup() {
    if (confirm('Восстановить все справки из бэкапа? Все текущие изменения будут потеряны.')) {
        showSyncIndicator('🔄 Восстановление из бэкапа...');
        
        items = restoreFromBackup();
        selectedItemId = items[0]?.id || 1;
        
        saveItemsToStorage(items);
        renderItems();
        renderHelp();
        
        setTimeout(() => {
            hideSyncIndicator();
            alert('Справки восстановлены из бэкапа!');
        }, 1000);
    }
}

// Отрисовка списка
function renderItems() {
    const list = document.getElementById('itemsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `item-card ${selectedItemId === item.id ? 'selected' : ''}`;
        card.onclick = () => selectItem(item.id);
        
        const preview = item.help ? item.help.split('\n')[0].substring(0, 40) + '...' : 'Нет справки';
        
        card.innerHTML = `
            <div class="item-checkbox ${item.checked ? 'checked' : ''}" onclick="event.stopPropagation(); toggleCheck(${item.id})">
                ${item.checked ? '✓' : ''}
            </div>
            <div class="item-content">
                <div class="item-title">${index + 1}. ${item.title || 'Без названия'}</div>
                <div class="item-preview">${preview}</div>
            </div>
        `;
        
        list.appendChild(card);
    });
    
    updateStats();
}

// Отрисовка справки
function renderHelp() {
    const helpContent = document.getElementById('helpContent');
    if (!helpContent) return;
    
    const item = items.find(i => i.id === selectedItemId);
    if (item) {
        helpContent.textContent = item.help || 'Нет справки для этого пункта';
    } else {
        helpContent.textContent = 'Выберите пункт для просмотра справки';
    }
}

// Выбор пункта
function selectItem(id) {
    selectedItemId = id;
    renderItems();
    renderHelp();
}

// Переключение чекбокса
function toggleCheck(id) {
    const item = items.find(i => i.id === id);
    if (item) {
        item.checked = !item.checked;
        renderItems();
        saveItemsToStorage(items);
        
        // Показываем индикатор синхронизации
        showSyncIndicator('🔄 Сохранение...');
        setTimeout(() => hideSyncIndicator(), 1000);
    }
}

// Обновление статистики
function updateStats() {
    const total = items.length;
    const completed = items.filter(i => i.checked).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const completedSpan = document.getElementById('completedCount');
    const totalSpan = document.getElementById('totalCount');
    const percentSpan = document.getElementById('progressPercent');
    const progressFill = document.getElementById('progressFill');
    
    if (completedSpan) completedSpan.textContent = completed;
    if (totalSpan) totalSpan.textContent = total;
    if (percentSpan) percentSpan.textContent = percent + '%';
    if (progressFill) progressFill.style.width = percent + '%';
}

// Добавление нового пункта
function addNewItem() {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    items.push({
        id: newId,
        title: 'Новый пункт',
        help: 'Текст справки для нового пункта',
        checked: false
    });
    
    saveItemsToStorage(items);
    renderItems();
    selectItem(newId);
    openEditModal(newId);
    
    showSyncIndicator('🔄 Добавлен новый пункт');
    setTimeout(() => hideSyncIndicator(), 1500);
}

// Редактирование текущего пункта
function editCurrentHelp() {
    if (!selectedItemId) {
        alert('Сначала выберите пункт');
        return;
    }
    openEditModal(selectedItemId);
}

// Открытие модального окна
function openEditModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('modalTitle').textContent = `Редактирование: ${item.title}`;
    document.getElementById('editTitle').value = item.title || '';
    document.getElementById('editHelp').value = item.help || '';
    document.getElementById('editModal').classList.add('active');
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('editModal').classList.remove('active');
}

// Сохранение изменений
function saveItem() {
    const title = document.getElementById('editTitle').value.trim();
    const help = document.getElementById('editHelp').value.trim();
    
    if (!title) {
        alert('Введите название пункта');
        return;
    }
    
    const item = items.find(i => i.id === selectedItemId);
    if (item) {
        item.title = title;
        item.help = help;
        
        saveItemsToStorage(items);
        renderItems();
        renderHelp();
        
        showSyncIndicator('🔄 Изменения сохранены');
        setTimeout(() => hideSyncIndicator(), 1500);
    }
    
    closeModal();
}

// Удаление текущего пункта
function deleteCurrentItem() {
    if (items.length <= 1) {
        alert('Нельзя удалить последний пункт');
        return;
    }
    
    if (confirm('Удалить этот пункт?')) {
        items = items.filter(i => i.id !== selectedItemId);
        
        // Выбираем первый доступный пункт
        selectedItemId = items[0]?.id || null;
        
        saveItemsToStorage(items);
        renderItems();
        renderHelp();
        closeModal();
        
        showSyncIndicator('🔄 Пункт удален');
        setTimeout(() => hideSyncIndicator(), 1500);
    }
}

// Снять все отметки
function clearAllChecks() {
    items.forEach(item => item.checked = false);
    renderItems();
    saveItemsToStorage(items);
    
    showSyncIndicator('🔄 Отметки сняты');
    setTimeout(() => hideSyncIndicator(), 1000);
}

// Отправка результатов
function submitResults() {
    const completed = items.filter(i => i.checked).length;
    const total = items.length;
    const notCompleted = items.filter(i => !i.checked);
    
    let message = `✅ Выполнено: ${completed}/${total} (${Math.round(completed/total*100)}%)\n\n`;
    
    if (notCompleted.length > 0) {
        message += '❌ Не отмечены:\n';
        notCompleted.forEach(item => {
            message += `• ${item.title}\n`;
        });
    } else {
        message += '🎉 Все пункты отмечены! Отличная работа!';
    }
    
    alert(message);
}

// Переключение темы
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggle');
    
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        currentTheme = 'light';
    } else {
        body.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
        currentTheme = 'dark';
    }
    
    localStorage.setItem('theme', currentTheme);
}

// Загрузка сохраненной темы
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggle').textContent = '☀️';
        currentTheme = 'dark';
    }
}

// Обработка свайпа вниз для закрытия модалки на телефоне
let touchStartY = 0;
const modal = document.getElementById('editModal');

if (modal) {
    modal.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });

    modal.addEventListener('touchmove', (e) => {
        if (touchStartY > e.touches[0].clientY + 50) {
            closeModal();
        }
    });
}

// Очистка интервала при выгрузке страницы
window.addEventListener('beforeunload', () => {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
});