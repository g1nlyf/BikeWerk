ALTER TABLE bikes ADD COLUMN currency TEXT;
ALTER TABLE bikes ADD COLUMN quality_score REAL;
ALTER TABLE bikes ADD COLUMN source_platform TEXT;
ALTER TABLE bikes ADD COLUMN unified_data TEXT;
ALTER TABLE bikes ADD COLUMN specs_json TEXT;
ALTER TABLE bikes ADD COLUMN inspection_json TEXT;
ALTER TABLE bikes ADD COLUMN seller_json TEXT;
ALTER TABLE bikes ADD COLUMN logistics_json TEXT;
ALTER TABLE bikes ADD COLUMN features_json TEXT;

ALTER TABLE bike_images ADD COLUMN local_path TEXT;
ALTER TABLE bike_images ADD COLUMN image_type TEXT;
ALTER TABLE bike_images ADD COLUMN position INTEGER DEFAULT 0;
ALTER TABLE bike_images ADD COLUMN is_downloaded INTEGER DEFAULT 0;
ALTER TABLE bike_images ADD COLUMN download_attempts INTEGER DEFAULT 0;
ALTER TABLE bike_images ADD COLUMN download_failed INTEGER DEFAULT 0;
ALTER TABLE bike_images ADD COLUMN width INTEGER;
ALTER TABLE bike_images ADD COLUMN height INTEGER;
ALTER TABLE bike_images ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_bikes_brand_category ON bikes(brand, category);
CREATE INDEX IF NOT EXISTS idx_bikes_price_quality ON bikes(price, quality_score);
CREATE INDEX IF NOT EXISTS idx_bikes_source_platform ON bikes(source_platform, source_ad_id);
CREATE INDEX IF NOT EXISTS idx_bike_images_bike_id ON bike_images(bike_id);
