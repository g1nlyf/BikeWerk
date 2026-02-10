const axios = require('axios');
const fs = require('fs');

async function check() {
    const key = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;
    if (!key) {
        console.error("Missing GEMINI_API_KEY / GEMINI_API_KEY_1 in environment.");
        process.exit(1);
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${key}`;
    const output = 'key_check_result.txt';

    try {
        const resp = await axios.post(url, {
            contents: [{ parts: [{ text: "echo: OK" }] }]
        }, { timeout: 10000 });

        const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || "NO TEXT";
        fs.writeFileSync(output, `SUCCESS: ${text}`);
        console.log("Check wrote to file.");
    } catch (e) {
        fs.writeFileSync(output, `FAILURE: ${e.message}\n${JSON.stringify(e.response?.data || {})}`);
        console.error("Check failed.");
    }
}

check();
