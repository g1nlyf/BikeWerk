-- Virtual Garage & Post-Sales Tables

-- Digital Passports: The "Golden Ticket" for verified bikes
CREATE TABLE IF NOT EXISTS digital_passports (
    token VARCHAR(64) PRIMARY KEY, -- Secure random hash
    bike_id INTEGER NOT NULL,
    user_id INTEGER, -- Current owner (if known)
    qr_code_url TEXT, -- Path to generated QR image
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    FOREIGN KEY(bike_id) REFERENCES bikes(id)
);

-- Accessories: For Smart Upsell
CREATE TABLE IF NOT EXISTS accessories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT, -- 'helmet', 'pedals', 'maintenance', 'bags'
    tags TEXT, -- JSON array: ['carbon', 'gravel', 'road', 'tubeless']
    price REAL,
    image_url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT 1
);

-- Seed some basic accessories
INSERT INTO accessories (name, category, tags, price, description) VALUES 
('Carbon Assembly Paste', 'maintenance', '["carbon"]', 15.00, 'Essential for carbon frames/posts'),
('Torque Key 5Nm', 'maintenance', '["carbon", "road", "gravel"]', 20.00, 'Prevent overtightening'),
('Tubeless Sealant', 'maintenance', '["tubeless", "gravel", "mtb"]', 25.00, 'For tubeless setups'),
('Aero Road Helmet', 'helmet', '["road", "aero"]', 150.00, 'Fast and safe'),
('Gravel Frame Bag', 'bags', '["gravel", "bikepacking"]', 80.00, 'Adventure ready'),
('Flat Pedals', 'pedals', '["mtb", "city"]', 40.00, 'High grip'),
('SPD Pedals', 'pedals', '["road", "gravel", "xc"]', 60.00, 'Clipless standard');
