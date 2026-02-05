const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to DB
const dbPath = path.resolve(__dirname, '../database/eubike.db');
const db = new sqlite3.Database(dbPath);

const testBike = {
    name: "Test Bike Specialized Tarmac",
    brand: "Specialized",
    model: "Tarmac SL7",
    price: 3500,
    category: "Шоссейный",
    is_active: 1,
    description: "Manual test insertion",
    main_image: "https://images.buycycle.com/bike_uploads/12345/optimized_12345.webp" // Fake url
};

db.serialize(() => {
    db.run(`
        INSERT INTO bikes (
            name, brand, model, price, category, is_active, description, created_at, added_at, main_image
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?
        )
    `, [testBike.name, testBike.brand, testBike.model, testBike.price, testBike.category, testBike.is_active, testBike.description, testBike.main_image], function(err) {
        if (err) {
            console.error('Insert failed:', err);
        } else {
            console.log('Test bike inserted with ID:', this.lastID);
        }
    });
});

db.close();
