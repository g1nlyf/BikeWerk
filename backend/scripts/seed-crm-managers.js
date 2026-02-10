/**
 * Seed script for CRM manager accounts and test data
 * Run: node scripts/seed-crm-managers.js
 */

const bcrypt = require('bcryptjs');
const path = require('path');

// Load database
const Database = require('better-sqlite3');
const dbPath = path.join(__dirname, '../database/eubike.db');
const db = new Database(dbPath);

console.log('🌱 Seeding CRM data...\n');

// ========================================
// MANAGERS
// ========================================

const managers = [
    { name: 'Admin BikeWerk', email: 'admin@bikewerk.ru', phone: '+79001234567', role: 'admin' },
    { name: 'Иван Менеджер', email: 'manager1@bikewerk.ru', phone: '+79001234568', role: 'manager' },
    { name: 'Мария Менеджер', email: 'manager2@bikewerk.ru', phone: '+79001234569', role: 'manager' }
];

const password = 'Manager123!';
const hashedPassword = bcrypt.hashSync(password, 10);

console.log('👤 Creating managers...');

for (const manager of managers) {
    try {
        // Check if exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(manager.email);

        if (existing) {
            // Update role if exists
            db.prepare('UPDATE users SET role = ?, password = ? WHERE email = ?')
                .run(manager.role, hashedPassword, manager.email);
            console.log(`  ✓ Updated: ${manager.email} (role: ${manager.role})`);
        } else {
            // Insert new
            db.prepare(`
                INSERT INTO users (name, email, phone, password, role, must_change_password, must_set_email)
                VALUES (?, ?, ?, ?, ?, 0, 0)
            `).run(manager.name, manager.email, manager.phone, hashedPassword, manager.role);
            console.log(`  ✓ Created: ${manager.email} (role: ${manager.role})`);
        }
    } catch (err) {
        console.log(`  ✗ Error for ${manager.email}: ${err.message}`);
    }
}

console.log(`\n🔑 Password for all managers: ${password}\n`);

// ========================================
// SUMMARY
// ========================================

const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE role IN (?, ?)').get('manager', 'admin');
console.log(`\n📊 Summary:`);
console.log(`   Managers/Admins in DB: ${userCount.count}`);

console.log('\n✅ CRM seed complete!\n');

db.close();
