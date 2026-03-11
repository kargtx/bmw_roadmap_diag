// Состояние приложения
let items = [];
let selectedItemId = 1;
let currentTheme = 'light';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    items = loadItemsFromStorage();
    renderItems();
    renderHelp();
});

// Отрисовка списка
function renderItems() {
    const list = document.getElementById('itemsList');
    list.innerHTML = '';
    
    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `item-card ${selectedItemId === item.id ? 'selected' : ''}`;
        card.onclick = () => selectItem(item.id);
        
        const preview = item.help.split('\n')[0].substring(0, 40) + '...';
        
        card.innerHTML = `
            <div class="item-checkbox ${item.checked ? 'checked' : ''}" onclick="event.stopPropagation(); toggleCheck(${item.id})">
                ${item.checked ? '✓' : ''}
            </div>
            <div class="item-content">
                <div class="item-title">${index + 1}. ${item.title}</div>
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
    }
}

// Обновление статистики
function updateStats() {
    const total = items.length;
    const completed = items.filter(i => i.checked).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('progressPercent').textContent = percent + '%';
    document.getElementById('progressFill').style.width = percent + '%';
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
    renderItems();
    saveItemsToStorage(items);
    selectItem(newId);
    openEditModal(newId);
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
    document.getElementById('editTitle').value = item.title;
    document.getElementById('editHelp').value = item.help;
    document.getElementById('editModal').classList.add('active');
    
    // Показываем кнопку удаления
    document.getElementById('deleteBtn').style.display = 'block';
}

// Закрытие модального окна
function closeModal() {
    document.getElementById('editModal').classList.remove('active');
}

// Сохранение изменений
function saveItem() {
    const title = document.getElementById('editTitle').value;
    const help = document.getElementById('editHelp').value;
    
    if (!title.trim()) {
        alert('Введите название пункта');
        return;
    }
    
    const item = items.find(i => i.id === selectedItemId);
    if (item) {
        item.title = title;
        item.help = help;
        renderItems();
        renderHelp();
        saveItemsToStorage(items);
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
        
        renderItems();
        renderHelp();
        saveItemsToStorage(items);
        closeModal();
    }
}

// Снять все отметки
function clearAllChecks() {
    items.forEach(item => item.checked = false);
    renderItems();
    saveItemsToStorage(items);
}

// Отправка результатов
function submitResults() {
    const completed = items.filter(i => i.checked).length;
    const total = items.length;
    const notCompleted = items.filter(i => !i.checked);
    
    let message = `Выполнено: ${completed}/${total} (${Math.round(completed/total*100)}%)\n\n`;
    
    if (notCompleted.length > 0) {
        message += 'Не отмечены:\n';
        notCompleted.forEach(item => {
            message += `• ${item.title}\n`;
        });
    } else {
        message += 'Все пункты отмечены!';
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

modal.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
});

modal.addEventListener('touchmove', (e) => {
    if (touchStartY > e.touches[0].clientY + 50) {
        closeModal();
    }
});