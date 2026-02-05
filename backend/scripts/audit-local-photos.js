const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function auditLocalPhotos() {
    console.log('\n🔍 Auditing local photos...\n');

    const dbPath = path.resolve(__dirname, '../database/eubike.db');
    const db = new Database(dbPath, { readonly: true });
    
    // Find records with local paths or NULL
    const records = db.prepare(`
        SELECT * FROM bike_images 
        WHERE local_path LIKE '/images/%' 
           OR local_path LIKE 'public/images/%'
           OR local_path IS NULL
    `).all();

    const stats = {
        total: records.length,
        localPaths: 0,
        externalUrls: 0,
        nullPaths: 0,
        filesExist: 0,
        missingFiles: 0,
        totalSize: 0
    };

    const projectRoot = path.resolve(__dirname, '../../'); // Assuming we are in backend/scripts
    // Frontend public images usually at frontend/public/images OR backend/public/images depending on setup
    // Based on previous context, they are likely in backend/public/images/bikes OR frontend/public...
    // Let's check typical paths.
    
    const possibleRoots = [
        path.join(projectRoot, 'backend/public'),
        path.join(projectRoot, 'frontend/public'),
        path.join(projectRoot, 'public')
    ];

    for (const record of records) {
        if (!record.local_path) {
            stats.nullPaths++;
            continue;
        }

        if (record.local_path.startsWith('http')) {
            stats.externalUrls++;
            continue;
        }

        stats.localPaths++;
        
        // Normalize path: remove leading slash
        const relPath = record.local_path.startsWith('/') ? record.local_path.slice(1) : record.local_path;
        
        let found = false;
        for (const root of possibleRoots) {
            const fullPath = path.join(root, relPath);
            if (fs.existsSync(fullPath)) {
                stats.filesExist++;
                stats.totalSize += fs.statSync(fullPath).size;
                found = true;
                break;
            }
        }
        
        if (!found) {
            stats.missingFiles++;
        }
    }

    const sizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

    console.log(`Database records: ${stats.total}`);
    console.log(`  ├─ Local paths (/images/): ${stats.localPaths}`);
    console.log(`  ├─ External URLs: ${stats.externalUrls}`);
    console.log(`  └─ NULL paths: ${stats.nullPaths}`);
    console.log('');
    console.log(`File system check:`);
    console.log(`  ├─ Files exist: ${stats.filesExist}`);
    console.log(`  ├─ Missing files: ${stats.missingFiles}`);
    console.log(`  └─ Total size: ${sizeMB} MB`);
    console.log('');
    console.log(`📊 Migration scope:`);
    console.log(`  Files to migrate: ${stats.filesExist}`);
    console.log(`  Estimated upload time: ~${Math.ceil((stats.totalSize / (50 * 1024)) / 60)} minutes (at 50KB/s)`);
    console.log(`  ImageKit storage usage: ${sizeMB} MB / 20 GB (${((stats.totalSize / (20 * 1024 * 1024 * 1024)) * 100).toFixed(4)}%)`);
}

auditLocalPhotos();
