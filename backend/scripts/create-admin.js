const { DatabaseManager } = require('../src/js/mysql-config');
const bcrypt = require('bcrypt');

async function run() {
    const dbManager = new DatabaseManager();
    await dbManager.initialize();

    const email = 'admin@gmail.com';
    const password = '12345678';
    const name = 'Admin';
    const role = 'admin';

    try {
        // Check if exists
        const users = await dbManager.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length > 0) {
            console.log('Admin user already exists.');
            // Update password and role just in case
            const hash = await bcrypt.hash(password, 10);
            await dbManager.query('UPDATE users SET password = ?, role = ? WHERE email = ?', [hash, role, email]);
            console.log('Admin user updated.');
            return;
        }

        const hash = await bcrypt.hash(password, 10);
        await dbManager.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hash, role]
        );
        console.log('Admin user created successfully.');
    } catch (err) {
        console.error('Error creating admin:', err);
    }
}

run();
