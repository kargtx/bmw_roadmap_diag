// Состояние приложения
let items = [];
let currentItemForHelp = null;
let currentTheme = 'light';
let syncInterval = null;
let lastScrollTop = 0;
let isAtTop = true;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    
    // Загружаем XML данные
    items = await loadXMLFromFile();
    
    // Создаем бэкап при первом запуске
    if (!localStorage.getItem('dieselCheckXMLBackup')) {
        createBackup(items);
    }
    
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

// Синхронизация между устройствами
function startSync() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'dieselCheckXML' && e.newValue) {
            try {
                showSyncIndicator('🔄 Получены обновления...');
                
                const newItems = parseXMLToItems(e.newValue);
                if (newItems) {
                    items = newItems;
                    renderItems();
                    updateLastSyncTime();
                }
                
                setTimeout(() => hideSyncIndicator(), 2000);
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
            }
        }
    });
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
    const lastUpdate = localStorage.getItem('lastXMLUpdate');
    if (lastSync && lastUpdate) {
        const date = new Date(parseInt(lastUpdate));
        lastSync.textContent = `Последнее обновление: ${date.toLocaleString()}`;
    }
}

// Восстановление из файла бэкапа
async function restoreFromBackupFile() {
    if (confirm('Восстановить все справки из файла бэкапа? Все текущие изменения будут потеряны.')) {
        showSyncIndicator('🔄 Восстановление из бэкапа...');
        
        const backupItems = await restoreFromBackupFile();
        if (backupItems) {
            items = backupItems;
            saveXMLToStorage(items);
            renderItems();
        }
        
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
        const card = document.createElement('div');
        card.className = 'item-card';
        
        card.innerHTML = `
            <div class="item-main">
                <div class="item-checkbox ${item.checked ? 'checked' : ''}" onclick="toggleCheck(${item.id})">
                    ${item.checked ? '✓' : ''}
                </div>
                <div class="item-content">
                    <div class="item-title">${index + 1}. ${item.title || 'Пункт ' + item.id}</div>
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
    
    document.getElementById('helpModalTitle').textContent = item.title || `Пункт ${id}`;
    document.getElementById('modalHelpContent').textContent = item.help || 'Нет справки для этого пункта';
    document.getElementById('helpModal').classList.add('active');
    
    // Блокируем скролл body
    document.body.style.overflow = 'hidden';
}

// Закрыть справку
function closeHelpModal() {
    document.getElementById('helpModal').classList.remove('active');
    currentItemForHelp = null;
    
    // Возвращаем скролл body
    document.body.style.overflow = '';
}

// Переключение чекбокса
function toggleCheck(id) {
    const item = items.find(i => i.id === id);
    if (item) {
        item.checked = !item.checked;
        renderItems();
        saveXMLToStorage(items);
        
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
function addNewItem() {
    const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    const newItem = {
        id: newId,
        title: `Новый пункт ${newId}`,
        help: `Пункт ${newId}:\n1) Описание действия`,
        checked: false
    };
    
    items.push(newItem);
    saveXMLToStorage(items);
    createBackup(items);
    renderItems();
    
    // Показываем справку для нового пункта
    showHelp(newId);
    
    showSyncIndicator('➕ Добавлен новый пункт');
    setTimeout(() => hideSyncIndicator(), 1500);
}

// Редактирование текущей справки
function editCurrentHelp() {
    if (!currentItemForHelp) return;
    
    closeHelpModal();
    
    const item = items.find(i => i.id === currentItemForHelp);
    if (!item) return;
    
    document.getElementById('editModalTitle').textContent = `Редактирование: ${item.title}`;
    document.getElementById('editTitle').value = item.title || '';
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
function saveItem() {
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
        
        saveXMLToStorage(items);
        createBackup(items);
        renderItems();
        
        showSyncIndicator('🔄 Изменения сохранены');
        setTimeout(() => hideSyncIndicator(), 1500);
    }
    
    closeEditModal();
}

// Удаление пункта
function deleteCurrentItem() {
    if (items.length <= 1) {
        alert('Нельзя удалить последний пункт');
        return;
    }
    
    if (confirm('Удалить этот пункт?')) {
        items = items.filter(i => i.id !== currentItemForHelp);
        
        saveXMLToStorage(items);
        createBackup(items);
        renderItems();
        closeEditModal();
        
        showSyncIndicator('🔄 Пункт удален');
        setTimeout(() => hideSyncIndicator(), 1500);
    }
}

// Снять все отметки
function clearAllChecks() {
    items.forEach(item => item.checked = false);
    renderItems();
    saveXMLToStorage(items);
    
    showSyncIndicator('🔄 Отметки сняты');
    setTimeout(() => hideSyncIndicator(), 1000);
}

// Окончить проверку
function finishInspection() {
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
        message += '🎉 Все пункты отмечены! Проверка завершена.';
    }
    
    alert(message);
}

// Переключение темы
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.getElementById('themeToggleSmall');
    
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

// Загрузка темы
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggleSmall').textContent = '☀️';
        currentTheme = 'dark';
    }
}

// Очистка интервала
window.addEventListener('beforeunload', () => {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
});