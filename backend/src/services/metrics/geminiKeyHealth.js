function collectGeminiKeys() {
    const keys = [];
    const seen = new Set();

    const pushIfValid = (raw) => {
        if (!raw) return;
        const value = String(raw).trim();
        if (!value) return;
        if (seen.has(value)) return;
        seen.add(value);
        keys.push(value);
    };

    const pool = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS || '';
    pool
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach(pushIfValid);

    for (let i = 1; i <= 20; i++) {
        pushIfValid(process.env[`GEMINI_API_KEY_${i}`]);
    }

    pushIfValid(process.env.GEMINI_API_KEY);

    return keys;
}

function getGeminiKeyHealth() {
    const keys = collectGeminiKeys();
    return {
        hasAny: keys.length > 0,
        keyCount: keys.length,
        source: keys.length > 1 ? 'pool' : keys.length === 1 ? 'single' : 'missing'
    };
}

module.exports = {
    collectGeminiKeys,
    getGeminiKeyHealth
};
