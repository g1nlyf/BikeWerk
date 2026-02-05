
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '../database/eubike.db');

async function ensureShoppingCart() {
    console.log(`Checking database at: ${dbPath}`);
    
    let db;
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Check if table exists
        const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='shopping_cart'");
        
        if (tableExists) {
            console.log('✅ shopping_cart table already exists.');
            
            // Optional: Check schema to ensure it matches expectations
            const columns = await db.all("PRAGMA table_info(shopping_cart)");
            console.log('Current columns:', columns.map(c => c.name).join(', '));
            
        } else {
            console.log('⚠️ shopping_cart table missing. Creating...');
            
            const createTableSQL = `
            CREATE TABLE shopping_cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                bike_id INTEGER NOT NULL,
                quantity INTEGER DEFAULT 1,
                calculated_price DECIMAL(10,2),
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (bike_id) REFERENCES bikes(id) ON DELETE CASCADE,
                UNIQUE(user_id, bike_id)
            );
            `;
            
            await db.exec(createTableSQL);
            console.log('✅ shopping_cart table created successfully.');
            
            // Create indexes
            await db.exec('CREATE INDEX IF NOT EXISTS idx_shopping_cart_user_id ON shopping_cart(user_id);');
            await db.exec('CREATE INDEX IF NOT EXISTS idx_shopping_cart_bike_id ON shopping_cart(bike_id);');
            console.log('✅ Indexes created.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (db) {
            await db.close();
        }
    }
}

ensureShoppingCart();
