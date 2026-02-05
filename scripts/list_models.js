let axiosLib;
try {
    axiosLib = require('axios');
} catch (e) {
    try {
        axiosLib = require('../telegram-bot/node_modules/axios');
    } catch (e2) {
        console.error('❌ Could not load axios. Please run npm install in telegram-bot directory.');
        process.exit(1);
    }
}

const axios = axiosLib.default || axiosLib;

const key = 'AIzaSyCS6qbM0otGtFcrLbqi_X44oQUCMkCV8kY'; // Backend key

async function listModels() {
    console.log(`\n📋 Listing Models for key ${key.substring(0, 5)}...`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    
    try {
        const response = await axios.get(url, {
            validateStatus: () => true
        });

        if (response.status === 200) {
            const models = response.data.models || [];
            console.log(`✅ Found ${models.length} models:`);
            models.forEach(m => {
                console.log(`   - ${m.name} (${m.displayName})`);
                console.log(`     Methods: ${m.supportedGenerationMethods?.join(', ')}`);
            });
        } else {
            console.log(`❌ Failed to list models: ${response.status} ${response.statusText}`);
            console.log(JSON.stringify(response.data, null, 2));
        }
    } catch (error) {
        console.log(`❌ Exception: ${error.message}`);
    }
}

listModels();
