// Скрипт для назначения роли администратора
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database/stolen_bikes.db');
const db = new Database(dbPath);

const ADMIN_CHAT_ID = 1076231865;

// Назначаем роль admin
db.prepare('UPDATE users SET role = ? WHERE chat_id = ?').run('admin', ADMIN_CHAT_ID);

// Проверяем
const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(ADMIN_CHAT_ID);

console.log('✅ Роль admin назначена!');
console.log('Пользователь:', user);

db.close();
