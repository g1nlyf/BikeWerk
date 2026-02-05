// Create Test Users Script
const { DatabaseManager } = require('../src/js/mysql-config');
const bcrypt = require('bcrypt');

async function createTestUsers() {
    const db = new DatabaseManager();
    
    try {
        console.log('🔄 Creating test users...');
        
        // Initialize database connection
        await db.initialize();
        console.log('✅ Database connection established');
        
        // Test users data
        const testUsers = [
            {
                name: 'Админ',
                email: 'admin@eubike.com',
                password: 'admin123',
                role: 'admin'
            },
            {
                name: 'Иван Петров',
                email: 'ivan@test.com',
                password: 'test123',
                role: 'user'
            },
            {
                name: 'Мария Сидорова',
                email: 'maria@test.com',
                password: 'test123',
                role: 'user'
            }
        ];
        
        for (const userData of testUsers) {
            // Check if user already exists
            const existingUser = await db.query(
                'SELECT id FROM users WHERE email = ?',
                [userData.email]
            );
            
            if (existingUser.length > 0) {
                console.log(`⚠️  User ${userData.email} already exists, skipping...`);
                continue;
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(userData.password, 10);
            
            // Create user
            await db.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [userData.name, userData.email, hashedPassword, userData.role]
            );
            
            console.log(`✅ Created user: ${userData.name} (${userData.email}) - Role: ${userData.role}`);
        }
        
        console.log('\n✅ Test users created successfully!');
        console.log('\n📋 Test Credentials:');
        console.log('   Admin: admin@eubike.com / admin123');
        console.log('   User 1: ivan@test.com / test123');
        console.log('   User 2: maria@test.com / test123');
        
    } catch (error) {
        console.error('❌ Failed to create test users:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run if called directly
if (require.main === module) {
    createTestUsers();
}

module.exports = { createTestUsers };