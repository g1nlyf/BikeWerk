import * as dotenv from 'dotenv';
import * as path from 'path';
import axios from 'axios';

const envPath = path.resolve(__dirname, '../../.env');
console.log(`Loading env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error);
}

const apiKey = process.env.GEMINI_API_KEY;
console.log('GEMINI_API_KEY loaded:', !!apiKey);
if (apiKey) {
    console.log('Length:', apiKey.length);
    console.log('First 5:', apiKey.substring(0, 5));
    console.log('Last 5:', apiKey.substring(apiKey.length - 5));
    console.log('Contains whitespace?', /\s/.test(apiKey));
    console.log('Contains quotes?', /['"]/.test(apiKey));
    
    // Try models
    const models = [
        'gemini-2.5-flash'
    ];

    (async () => {
         // List models first
         const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
         console.log('Listing models...');
         try {
             const listRes = await axios.get(listUrl);
             console.log('Available models:', listRes.data.models?.map((m: any) => m.name));
         } catch (e: any) {
             console.log('ListModels failed:', e.message);
         }

         for (const model of models) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            console.log(`\nTesting request to ${model}...`);
            try {
                const res = await axios.post(url, {
                    contents: [{ parts: [{ text: "Hello" }] }]
                }, { validateStatus: () => true });
                
                console.log(`Status: ${res.status}`);
                if (res.status !== 200) {
                    console.log('Error:', res.data?.error?.message || res.data);
                } else {
                    console.log('Success!');
                }
            } catch (err: any) {
                console.log('Request failed:', err.message);
            }
        }
    })();
} else {
    console.error('API Key not found in process.env');
}
