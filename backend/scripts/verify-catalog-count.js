const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

async function fetchJson(url) {
    const res = await fetch(url);
    const data = await res.json();
    return { status: res.status, data };
}

async function verifyEndpoint(baseUrl, path) {
    const url = `${baseUrl}${path}`;
    const { status, data } = await fetchJson(url);
    assert(status === 200, `HTTP ${status} for ${url}`);
    assert(data && data.success === true, `success!=true for ${url}`);
    assert(Array.isArray(data.bikes), `bikes is not array for ${url}`);
    assert(typeof data.count === 'number', `count is not number for ${url}`);
    assert(typeof data.total === 'number', `total is not number for ${url}`);
    assert(data.count === data.bikes.length, `count mismatch for ${url}: count=${data.count} bikes=${data.bikes.length}`);
    assert(data.total >= data.count, `total < count for ${url}: total=${data.total} count=${data.count}`);
    return { url, count: data.count, total: data.total, bikesLen: data.bikes.length };
}

function readArg(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx === -1) return null;
    const v = process.argv[idx + 1];
    return v ? String(v).trim() : null;
}

async function run() {
    const argBase = readArg('--base');
    const baseUrl = argBase || process.env.API_BASE || 'http://localhost:8082/api';
    const results = [];
    results.push(await verifyEndpoint(baseUrl, '/bikes?limit=3&offset=0'));
    results.push(await verifyEndpoint(baseUrl, '/catalog/bikes?limit=3&offset=0'));
    for (const r of results) {
        console.log(`OK ${r.url} total=${r.total} count=${r.count} bikes=${r.bikesLen}`);
    }
}

run().catch((err) => {
    console.error(`VERIFY FAILED: ${err.message}`);
    process.exit(1);
});
