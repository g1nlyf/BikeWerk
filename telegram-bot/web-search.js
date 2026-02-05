const fetch = require('node-fetch');

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.text();
  } catch (e) {
    try {
      const proxied = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { timeout: 12000 });
      const json = await proxied.json();
      return json.contents || '';
    } catch (e2) {
      throw e;
    }
  }
}

function parseDuckDuckGoHtml(html) {
  const results = [];
  const re = /<a[^>]*class=["']?result__a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class=["']?result__snippet[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && results.length < 10) {
    const url = m[1];
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    const snippet = m[3].replace(/<[^>]+>/g, '').trim();
    results.push({ title, url, snippet });
  }
  if (results.length === 0) {
    const re2 = /<a[^>]*class=["']?result__a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    while ((m = re2.exec(html)) && results.length < 10) {
      const url = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      results.push({ title, url, snippet: '' });
    }
  }
  return results;
}

async function search(query, limit = 5) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=de-de`;
  const html = await fetchHtml(url);
  const results = parseDuckDuckGoHtml(html);
  return results.slice(0, Math.max(1, limit));
}

module.exports = {
  search
};