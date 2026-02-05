const BikesDatabase = require('./bikes-database-node');

async function test() {
    const db = new BikesDatabase();
    try {
        // Wait for init
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const bikeData = {
            brand: 'TestBrand',
            model: 'TestModel',
            price: 100,
            category: 'Горный'
        };
        
        console.log('Adding bike...');
        const savedBike = await db.addBike(bikeData);
        console.log('Saved bike ID type:', typeof savedBike.id);
        console.log('Saved bike ID value:', savedBike.id);
        
        if (savedBike.id instanceof Promise) {
            console.log('ID IS A PROMISE!');
            const resolvedId = await savedBike.id;
            console.log('Resolved ID:', resolvedId);
        }
    } catch (e) {
        console.error(e);
    }
}

test();
