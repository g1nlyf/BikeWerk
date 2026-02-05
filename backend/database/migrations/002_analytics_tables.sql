-- backend/database/migrations/002_analytics_tables.sql

CREATE TABLE IF NOT EXISTS bike_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bike_id INTEGER NOT NULL,
  brand TEXT,
  model TEXT,
  year INTEGER,
  tier INTEGER,
  price INTEGER,
  optimal_price INTEGER,
  discount_pct REAL,
  
  -- Engagement метрики
  views INTEGER DEFAULT 0,
  detail_views INTEGER DEFAULT 0,
  avg_time_on_page REAL DEFAULT 0, -- seconds
  favorites INTEGER DEFAULT 0,
  
  -- Временные метрики
  listed_at DATETIME,
  first_view_at DATETIME,
  sold_at DATETIME,
  days_to_first_view REAL,
  days_to_sell REAL,
  
  -- Предсказания
  predicted_hotness INTEGER DEFAULT 50, -- 0-100
  predicted_days_to_sell REAL,
  
  -- Актуальность
  status TEXT DEFAULT 'active', -- active/sold/removed
  
  FOREIGN KEY (bike_id) REFERENCES bikes(id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_model ON bike_analytics(brand, model, year);
CREATE INDEX IF NOT EXISTS idx_analytics_status ON bike_analytics(status);
CREATE INDEX IF NOT EXISTS idx_analytics_sold ON bike_analytics(sold_at);

-- Триггер: автоматически создавать запись при добавлении bike
CREATE TRIGGER IF NOT EXISTS create_analytics_on_bike_insert
AFTER INSERT ON bikes
BEGIN
  INSERT INTO bike_analytics (
    bike_id, brand, model, year, tier, price, optimal_price, listed_at
  ) VALUES (
    NEW.id, NEW.brand, NEW.model, NEW.year, NEW.tier,
    NEW.purchase_cost, NEW.optimal_price, datetime('now')
  );
END;

-- Триггер: обновлять sold_at при продаже
CREATE TRIGGER IF NOT EXISTS update_analytics_on_sale
AFTER UPDATE OF is_active ON bikes
WHEN NEW.is_active = 0 AND OLD.is_active = 1
BEGIN
  UPDATE bike_analytics
  SET
    sold_at = datetime('now'),
    days_to_sell = JULIANDAY(datetime('now')) - JULIANDAY(listed_at),
    status = 'sold'
  WHERE bike_id = NEW.id;
END;
