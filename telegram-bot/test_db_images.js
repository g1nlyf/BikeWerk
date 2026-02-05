const BikesDatabase = require('./bikes-database-node');
const path = require('path');

async function testDB() {
    const db = new BikesDatabase();
    console.log('DB Path:', db.dbPath);
    
    // Wait for DB to be ready (it initializes in constructor but methods await queries)
    // Actually initializeDatabase is async but constructor is not. 
    // Queries might fail if called immediately if table doesn't exist, but it waits for exec.
    
    // Let's try to get bike 122
    const bike = await db.getBikeById(122);
    console.log('Bike 122:', bike ? bike.name : 'Not found');
    
    if (bike) {
        console.log('Current images:', bike.images);
        
        // Try adding images
        const testImages = ['/images/bikes/id122/0.jpg'];
        await db.addBikeImages(122, testImages);
        
        // Check again
        const images = await db.getBikeImages(122);
        console.log('Images after addition:', images);
    }
}

testDB();
