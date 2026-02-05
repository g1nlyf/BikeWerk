// Data Migration Script for EUBike MySQL Migration
const fs = require('fs').promises;
const path = require('path');
const { DatabaseManager } = require('../src/js/mysql-config');

class DataMigrator {
    constructor() {
        this.db = new DatabaseManager();
    }

    async migrate() {
        try {
            console.log('🔄 Starting data migration...');
            
            // Initialize database
            await this.db.initialize();
            console.log('✅ Database connection established');

            // Migrate bikes data
            await this.migrateBikesData();
            
            // Migrate user data (if exists in localStorage backup)
            await this.migrateUserData();
            
            console.log('✅ Data migration completed successfully!');
            
        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        } finally {
            await this.db.close();
        }
    }

    async migrateBikesData() {
        console.log('🔄 Migrating bikes data...');
        
        // Read main bikes data
        const mainBikesPath = path.join(__dirname, '../bikes-data.json');
        // Resolve telegram-bot bikes data json across different monorepo layouts
        const fsSync = require('fs');
        const tgCandidates = [
            path.join(__dirname, '../telegram-bot/bikes-data.json'),
            path.resolve(__dirname, '../../telegram-bot/bikes-data.json'),
            path.resolve(__dirname, '../../../telegram-bot/bikes-data.json'),
        ];
        const telegramBikesPath = tgCandidates.find(p => fsSync.existsSync(p));
        
        let allBikes = [];
        
        // Load main bikes data
        try {
            const mainBikesData = await fs.readFile(mainBikesPath, 'utf8');
            const mainBikes = JSON.parse(mainBikesData);
            allBikes = allBikes.concat(mainBikes);
            console.log(`📊 Loaded ${mainBikes.length} bikes from main catalog`);
        } catch (error) {
            console.log('⚠️  Main bikes data not found, skipping...');
        }
        
        // Load telegram bikes data
        try {
            if (!telegramBikesPath) throw new Error('telegram-bot/bikes-data.json not found');
            const telegramBikesData = await fs.readFile(telegramBikesPath, 'utf8');
            const telegramBikes = JSON.parse(telegramBikesData);
            
            // Filter out duplicates based on name and brand
            const existingBikes = new Set(allBikes.map(bike => `${bike.name}-${bike.brand}`));
            const newTelegramBikes = telegramBikes.filter(bike => 
                !existingBikes.has(`${bike.name}-${bike.brand}`)
            );
            
            allBikes = allBikes.concat(newTelegramBikes);
            console.log(`📊 Loaded ${newTelegramBikes.length} unique bikes from telegram bot`);
        } catch (error) {
            console.log('⚠️  Telegram bikes data not found, skipping...');
        }

        if (allBikes.length === 0) {
            console.log('⚠️  No bikes data found to migrate');
            return;
        }

        console.log(`📊 Total bikes to migrate: ${allBikes.length}`);

        // Clear existing data
        await this.db.query('DELETE FROM bike_specs');
        await this.db.query('DELETE FROM bike_images');
        await this.db.query('DELETE FROM bikes');
        console.log('🗑️  Cleared existing bikes data');

        let migratedCount = 0;
        let errorCount = 0;

        for (const bike of allBikes) {
            try {
                await this.migrateSingleBike(bike);
                migratedCount++;
                
                if (migratedCount % 10 === 0) {
                    console.log(`📊 Migrated ${migratedCount}/${allBikes.length} bikes...`);
                }
            } catch (error) {
                console.error(`❌ Failed to migrate bike: ${bike.name}`, error.message);
                errorCount++;
            }
        }

        console.log(`✅ Bikes migration completed: ${migratedCount} successful, ${errorCount} errors`);
    }

    async migrateSingleBike(bike) {
        // Prepare bike data with proper defaults
        const bikeData = {
            name: bike.name || 'Unknown Bike',
            category: bike.category || 'other',
            brand: bike.brand || 'Unknown',
            model: bike.model || '',
            size: bike.size || '',
            price: parseFloat(bike.price) || 0,
            original_price: parseFloat(bike.originalPrice) || parseFloat(bike.price) || 0,
            discount: parseInt(bike.discount) || 0,
            main_image: bike.image || (bike.images && bike.images[0]) || '',
            rating: parseFloat(bike.rating) || 0,
            reviews: parseInt(bike.reviews) || 0,
            review_count: parseInt(bike.reviewCount) || 0,
            description: bike.description || '',
            features: JSON.stringify(bike.features || []),
            delivery_info: bike.deliveryInfo || '',
            warranty: bike.warranty || '',
            source: bike.source || 'migrated',
            original_url: bike.originalUrl || '',
            condition_status: bike.condition || 'used',
            year: parseInt(bike.year) || null,
            wheel_diameter: bike.wheelDiameter || '',
            location: bike.location || '',
            is_negotiable: bike.isNegotiable || false,
            is_new: bike.isNew || false,
            discipline: bike.discipline || ''
        };

        // Insert bike
        const bikeResult = await this.db.query(`
            INSERT INTO bikes (
                name, category, brand, model, size, price, original_price, discount,
                main_image, rating, reviews, review_count, description, features,
                delivery_info, warranty, source, original_url, condition_status,
                year, wheel_diameter, location, is_negotiable, is_new, discipline
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            bikeData.name, bikeData.category, bikeData.brand, bikeData.model,
            bikeData.size, bikeData.price, bikeData.original_price, bikeData.discount,
            bikeData.main_image, bikeData.rating, bikeData.reviews, bikeData.review_count,
            bikeData.description, bikeData.features, bikeData.delivery_info, bikeData.warranty,
            bikeData.source, bikeData.original_url, bikeData.condition_status,
            bikeData.year, bikeData.wheel_diameter, bikeData.location,
            bikeData.is_negotiable, bikeData.is_new, bikeData.discipline
        ]);

        const bikeId = bikeResult.lastID;

        // Insert images
        if (bike.images && Array.isArray(bike.images)) {
            for (let i = 0; i < bike.images.length; i++) {
                if (bike.images[i]) {
                    await this.db.query(
                        'INSERT INTO bike_images (bike_id, image_url, image_order, is_main) VALUES (?, ?, ?, ?)',
                        [bikeId, bike.images[i], i, i === 0]
                    );
                }
            }
        } else if (bike.image) {
            // Single image
            await this.db.query(
                'INSERT INTO bike_images (bike_id, image_url, image_order, is_main) VALUES (?, ?, ?, ?)',
                [bikeId, bike.image, 0, true]
            );
        }

        // Insert specs
        if (bike.specs && Array.isArray(bike.specs)) {
            for (let i = 0; i < bike.specs.length; i++) {
                const spec = bike.specs[i];
                if (spec && spec.label && spec.value) {
                    await this.db.query(
                        'INSERT INTO bike_specs (bike_id, spec_label, spec_value, spec_order) VALUES (?, ?, ?, ?)',
                        [bikeId, spec.label, spec.value, i]
                    );
                }
            }
        }

        return bikeId;
    }

    async migrateUserData() {
        console.log('🔄 Checking for user data to migrate...');
        
        // Note: Since localStorage data is client-side, we'll create a sample admin user
        // In a real scenario, you'd need to export localStorage data first
        
        try {
            // Check if admin user already exists
            const existingAdmin = await this.db.query(
                'SELECT id FROM users WHERE email = ?',
                ['admin@eubike.com']
            );

            if (existingAdmin.length === 0) {
                // Create default admin user
                const bcrypt = require('bcrypt');
                const hashedPassword = await bcrypt.hash('admin123', 10);
                
                await this.db.query(
                    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                    ['Admin User', 'admin@eubike.com', hashedPassword, 'admin']
                );
                
                console.log('✅ Created default admin user (admin@eubike.com / admin123)');
            } else {
                console.log('ℹ️  Admin user already exists');
            }
        } catch (error) {
            console.error('❌ Failed to create admin user:', error);
        }
    }
}

// Run migration if called directly
async function runMigration() {
    const migrator = new DataMigrator();
    try {
        await migrator.migrate();
        console.log('\n🎉 Migration completed successfully!');
        console.log('\n🚀 Next steps:');
        console.log('   1. Start the server: npm start');
        console.log('   2. Update frontend to use new API endpoints');
        console.log('   3. Test all functionality');
    } catch (error) {
        console.error('\n💥 Migration failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = { DataMigrator };