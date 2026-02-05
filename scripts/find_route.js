const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../backend/server.js');
const content = fs.readFileSync(serverPath, 'utf8');

const regex = /app\.get\(['"]\/api\/bikes['"]|app\.get\(['"]\/api\/catalog\/bikes['"]/;
const match = content.match(regex);

if (match) {
    console.log('Found route:', match[0]);
    // Find line number
    const lines = content.split('\n');
    lines.forEach((line, index) => {
        if (line.includes(match[0]) || line.includes('/api/bikes') || line.includes('/api/catalog/bikes')) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    });
} else {
    console.log('Route not found');
}
