const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const KEY_POOL = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS || process.env.GEMINI_API_KEY || '';
const STATIC_KEY = KEY_POOL.split(/[,;|\s]+/).filter(Boolean)[0] || '';
if (!STATIC_KEY) {
    console.error('No GEMINI_API_KEY configured. Set GEMINI_API_KEY or GEMINI_API_KEYS.');
    process.exit(1);
}
const PROXY_URL =
    process.env.EUBIKE_PROXY_URL ||
    process.env.HUNTER_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.PROXY_URL ||
    '';
const MODELS = [
    'gemini-3.0-pro-preview',
    'gemini-2.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro'
];
const REQUESTS_PER_MODEL = Number(process.env.GEMINI_STRESS_REQUESTS || 20);
const CONCURRENCY = Number(process.env.GEMINI_STRESS_CONCURRENCY || 5);
const TIMEOUT_MS = Number(process.env.GEMINI_STRESS_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS || 60000);

const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined;

function buildUrl(modelName, key) {
    return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
}

async function callModel(modelName, key, requestId) {
    const url = buildUrl(modelName, key);
    const prompt = `Ping ${modelName} #${requestId}`;
    const start = Date.now();
    try {
        const response = await axios.post(
            url,
            { contents: [{ parts: [{ text: prompt }] }] },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: TIMEOUT_MS,
                httpsAgent: agent,
                proxy: false
            }
        );
        const duration = Date.now() - start;
        const ok = Boolean(response.data && response.data.candidates);
        return { success: ok, duration, status: response.status };
    } catch (error) {
        const duration = Date.now() - start;
        let errorMsg = error.message;
        let status = 0;
        if (error.response) {
            status = error.response.status;
            errorMsg = `${error.response.status} ${error.response.statusText}`;
            if (error.response.data && error.response.data.error) {
                errorMsg += ` - ${JSON.stringify(error.response.data.error)}`;
            }
        }
        return { success: false, duration, status, error: errorMsg };
    }
}

function summarize(modelName, results) {
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);
    const avgLatency = successes.length
        ? Math.round(successes.reduce((sum, r) => sum + r.duration, 0) / successes.length)
        : 0;
    const sorted = successes.map(r => r.duration).sort((a, b) => a - b);
    const p95 = sorted.length
        ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
        : 0;
    const errorCounts = failures.reduce((acc, r) => {
        const key = r.error || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    return {
        model: modelName,
        success: successes.length,
        failed: failures.length,
        successRate: `${Math.round((successes.length / results.length) * 100)}%`,
        avgLatencyMs: avgLatency,
        p95LatencyMs: p95,
        topErrors: Object.entries(errorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([err, count]) => `${count}x ${err}`)
            .join(' | ')
    };
}

async function stressModel(modelName, key) {
    const results = [];
    let requestId = 0;
    for (let i = 0; i < REQUESTS_PER_MODEL; i += CONCURRENCY) {
        const batch = [];
        for (let j = 0; j < CONCURRENCY && i + j < REQUESTS_PER_MODEL; j += 1) {
            requestId += 1;
            batch.push(callModel(modelName, key, requestId));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
    }
    return results;
}

async function runTests() {
    console.log('🧪 Starting Gemini Model Stress Tests...\n');
    console.log(`🔑 Key: ${STATIC_KEY.substring(0, 8)}...`);
    console.log(`🛰️ Proxy: ${PROXY_URL}`);
    console.log(`📦 Requests per model: ${REQUESTS_PER_MODEL} | Concurrency: ${CONCURRENCY}`);

    const summaries = [];
    const stable = [];

    for (const model of MODELS) {
        console.log(`\n🔬 Stressing ${model}...`);
        const results = await stressModel(model, STATIC_KEY);
        const summary = summarize(model, results);
        summaries.push(summary);
        if (summary.successRate !== '0%') stable.push(summary);
        console.log(
            `✅ ${model} => ${summary.successRate} | avg ${summary.avgLatencyMs}ms | p95 ${summary.p95LatencyMs}ms`
        );
        if (summary.topErrors) console.log(`⚠️ ${summary.topErrors}`);
    }

    console.log('\n📊 Summary');
    console.table(summaries);

    const ranked = stable
        .filter(s => s.successRate !== '0%')
        .sort((a, b) => {
            const rateA = Number(a.successRate.replace('%', ''));
            const rateB = Number(b.successRate.replace('%', ''));
            if (rateB !== rateA) return rateB - rateA;
            return a.avgLatencyMs - b.avgLatencyMs;
        });

    if (ranked.length) {
        const best = ranked[0];
        console.log(`\n🏆 Stable Winner: ${best.model} (${best.successRate}, avg ${best.avgLatencyMs}ms)`);
    } else {
        console.log('\n⚠️ No stable models detected.');
    }
}

runTests();
