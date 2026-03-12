const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const INSPECTIONS_FILE = path.join(DATA_DIR, 'inspections.json');
const EDIT_PASSWORD = '7788';

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function readJson(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.error('Ошибка чтения JSON:', error);
        return fallback;
    }
}

function writeJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Ошибка записи JSON:', error);
        return false;
    }
}

function loadInitialItems() {
    try {
        const backup = require('./xmlParser_backup.js');
        if (backup && typeof backup.getInitialXMLItems === 'function') {
            const items = backup.getInitialXMLItems();
            return items.map(({ id, title, help }) => ({ id, title, help }));
        }
    } catch (error) {
        console.error('Ошибка загрузки бэкапа:', error);
    }
    return [];
}

function ensureItemsFile() {
    const existing = readJson(ITEMS_FILE, null);
    if (existing && Array.isArray(existing.items)) return;

    const initialItems = loadInitialItems();
    writeJson(ITEMS_FILE, { items: initialItems, updatedAt: Date.now() });
}

function ensureInspectionsFile() {
    const existing = readJson(INSPECTIONS_FILE, null);
    if (existing && Array.isArray(existing)) return;
    writeJson(INSPECTIONS_FILE, []);
}

function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            if (!body) return resolve(null);
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                resolve(null);
            }
        });
    });
}

function sendJson(res, statusCode, payload) {
    const data = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data)
    });
    res.end(data);
}

function sendText(res, statusCode, text) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(text);
}

function serveStatic(req, res) {
    const parsedUrl = url.parse(req.url);
    let pathname = parsedUrl.pathname || '/';
    if (pathname === '/') pathname = '/index.html';

    const filePath = path.join(__dirname, pathname);
    if (!filePath.startsWith(__dirname)) {
        return sendText(res, 403, 'Forbidden');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            return sendText(res, 404, 'Not Found');
        }
        const ext = path.extname(filePath).toLowerCase();
        const typeMap = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };
        const contentType = typeMap[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

function normalizeItems(items) {
    if (!Array.isArray(items)) return null;
    return items
        .filter(item => item && Number.isFinite(item.id))
        .map(item => ({
            id: Number(item.id),
            title: String(item.title || '').trim() || `Пункт ${item.id}`,
            help: String(item.help || '')
        }))
        .sort((a, b) => a.id - b.id);
}

ensureDataDir();
ensureItemsFile();
ensureInspectionsFile();

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname || '/';

    if (pathname.startsWith('/api/')) {
        if (pathname === '/api/items') {
            if (req.method === 'GET') {
                const data = readJson(ITEMS_FILE, { items: loadInitialItems(), updatedAt: Date.now() });
                return sendJson(res, 200, data);
            }

            if (req.method === 'POST') {
                const body = await parseBody(req);
                if (!body || body.password !== EDIT_PASSWORD) {
                    return sendJson(res, 403, { error: 'Неверный пароль' });
                }
                const normalized = normalizeItems(body.items);
                if (!normalized) {
                    return sendJson(res, 400, { error: 'Некорректные данные' });
                }
                const payload = { items: normalized, updatedAt: Date.now() };
                writeJson(ITEMS_FILE, payload);
                return sendJson(res, 200, payload);
            }
        }

        if (pathname === '/api/restore' && req.method === 'POST') {
            const body = await parseBody(req);
            if (!body || body.password !== EDIT_PASSWORD) {
                return sendJson(res, 403, { error: 'Неверный пароль' });
            }
            const initialItems = loadInitialItems();
            const payload = { items: initialItems, updatedAt: Date.now() };
            writeJson(ITEMS_FILE, payload);
            return sendJson(res, 200, payload);
        }

        if (pathname === '/api/inspections') {
            if (req.method === 'GET') {
                const data = readJson(INSPECTIONS_FILE, []);
                return sendJson(res, 200, data);
            }
            if (req.method === 'POST') {
                const body = await parseBody(req);
                if (!body || !body.inspection) {
                    return sendJson(res, 400, { error: 'Нет данных' });
                }
                const inspections = readJson(INSPECTIONS_FILE, []);
                inspections.unshift(body.inspection);
                writeJson(INSPECTIONS_FILE, inspections.slice(0, 200));
                return sendJson(res, 200, { ok: true });
            }
        }

        return sendJson(res, 404, { error: 'Не найдено' });
    }

    return serveStatic(req, res);
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
