// Database Setup Script for EUBike MySQL Migration
const { DatabaseManager } = require('../src/js/mysql-config');

async function setupDatabase() {
    const db = new DatabaseManager();
    
    try {
        console.log('🔄 Starting database setup...');
        
        // Initialize database connection
        await db.initialize();
        console.log('✅ Database connection established');
        
        // Test connection
        await db.testConnection();
        console.log('✅ Database connection tested successfully');
        
        console.log('✅ Database setup completed successfully!');
        console.log('\n📊 Database Structure:');
        console.log('   - users: User accounts and authentication');
        console.log('   - bikes: Main bike catalog data');
        console.log('   - bike_images: Bike image URLs and metadata');
        console.log('   - bike_specs: Bike specifications and features');
        console.log('   - user_favorites: User favorite bikes');
        console.log('   - shopping_cart: User shopping cart items');
        console.log('   - orders: Order history and tracking');
        console.log('   - order_items: Individual items in orders');
        console.log('   - telegram_users: Telegram bot user data');
        console.log('   - bot_sessions: Telegram bot session management');
        
        console.log('\n🚀 Next steps:');
        console.log('   1. Run: npm run migrate (to migrate existing data)');
        console.log('   2. Run: npm start (to start the server)');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

// Run setup if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };