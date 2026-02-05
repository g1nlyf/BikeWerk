-- Migration: Euphoria Pipeline (Phase 2)
-- Table for triggered content based on order status
CREATE TABLE IF NOT EXISTS content_triggers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status_key TEXT NOT NULL,
    content_type TEXT DEFAULT 'tip', -- 'video', 'article', 'tip'
    title TEXT,
    url TEXT,
    description TEXT,
    delay_hours INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed basic content
INSERT OR IGNORE INTO content_triggers (status_key, content_type, title, url, description) VALUES 
('created', 'tip', 'Добро пожаловать в Семью!', NULL, 'Ваш персональный менеджер уже изучает ваш профиль.'),
('hunting', 'video', 'Как мы ищем бриллианты', 'https://youtube.com/shorts/example1', 'Посмотрите, как работает наш AI-Inspector.'),
('inspection', 'article', '12 Точек Проверки', '/blog/inspection-process', 'Мы проверяем каждый миллиметр рамы.'),
('shipped', 'video', 'Сборка за 5 минут', 'https://youtube.com/shorts/example2', 'Инструкция по распаковке вашего нового байка.'),
('delivered', 'tip', 'Первый выезд', NULL, 'Не забудьте проверить давление в шинах!');

-- Add columns to orders (SQLite doesn't support IF NOT EXISTS for columns, so we use a block in JS or try/catch in SQL if supported, 
-- but here we just define the alter statements. The runner usually handles errors if col exists)
-- ALTER TABLE orders ADD COLUMN urgency_level TEXT DEFAULT 'normal';
-- ALTER TABLE orders ADD COLUMN reservation_expires_at DATETIME;
-- ALTER TABLE orders ADD COLUMN euphoria_viewed_at DATETIME;
