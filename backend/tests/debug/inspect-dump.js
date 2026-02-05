const fs = require('fs');

const html = fs.readFileSync('buycycle_dump.html', 'utf8');

function printContext(keyword) {
    const index = html.indexOf(keyword);
    if (index === -1) {
        console.log(`❌ '${keyword}' not found.`);
        return;
    }
    console.log(`\n🔍 Context for '${keyword}':`);
    // Print 1000 chars before and after
    const start = Math.max(0, index - 1000);
    const end = Math.min(html.length, index + 2000);
    console.log(html.substring(start, end));
}

printContext('Fahrraddetails');
printContext('Allgemeine Informationen');
printContext('Verkäuferbeschreibung');
