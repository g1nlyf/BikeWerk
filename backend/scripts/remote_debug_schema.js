const { DatabaseManager } = require('../src/js/mysql-config');

(async () => {
    const db = new DatabaseManager();
    await db.initialize();
    console.log('🔌 DB Connected for Debug');

    console.log('--- user_favorites info ---');
    try {
        const info = await db.query('PRAGMA table_info(user_favorites)');
        console.log(JSON.stringify(info, null, 2));
    } catch (e) {
        console.error('Error getting table info:', e.message);
    }
    
    console.log('--- bikes info (partial) ---');
    try {
        const info = await db.query('PRAGMA table_info(bikes)');
        console.log(JSON.stringify(info.filter(c => ['is_new', 'rank'].includes(c.name)), null, 2));
    } catch (e) {
        console.error('Error getting bikes info:', e.message);
    }

})();
