// Kleinanzeigen status checker: network + DOM + visual screenshot
// Windows-first beta, runs visible Chrome via puppeteer-extra stealth

const axios = require('axios');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const sharp = require('sharp');
const { HttpsProxyAgent } = require('https-proxy-agent');

puppeteer.use(StealthPlugin());

const DEFAULT_PROXY_URL = '';

// Ensure directories exist
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const DEFAULT_OPTS = {
  screenshotsDir: path.resolve(__dirname, 'screenshots'),
  headless: false,
  slowMo: 0,
  timeoutMs: 60000,
  postLoadDelayMs: 2000,
  captureLongConfirm: false,
  longConfirmDelayMs: 2000,
};

async function listScreenshotFiles(dir) {
  try {
    await fsp.access(dir);
  } catch {
    return [];
  }
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries.filter((e) => e.isFile() && /(\.png|\.jpg|\.jpeg|\.webp)$/i.test(e.name)).map((e) => path.join(dir, e.name));
  const stats = await Promise.all(files.map(async (p) => {
    try {
      const s = await fsp.stat(p);
      const t = s.birthtimeMs || s.ctimeMs || s.mtimeMs || 0;
      return { p, t };
    } catch {
      return { p, t: 0 };
    }
  }));
  stats.sort((a, b) => a.t - b.t);
  return stats;
}

async function enforceScreenshotLimit(dir, maxCount = 10, preDeleteCount = 0) {
  const stats = await listScreenshotFiles(dir);
  const byAge = stats.slice();
  const pre = Math.min(preDeleteCount, byAge.length);
  for (let i = 0; i < pre; i++) {
    const f = byAge[i];
    try { await fsp.unlink(f.p); } catch {}
  }
  const afterPre = await listScreenshotFiles(dir);
  const excess = Math.max(0, afterPre.length - maxCount);
  for (let i = 0; i < excess; i++) {
    const f = afterPre[i];
    try { await fsp.unlink(f.p); } catch {}
  }
}

async function captureShot(page, outPath) {
  try { await page.bringToFront(); } catch (_) {}
  let ok = false;
  try {
    await page.screenshot({ path: outPath, type: 'jpeg', quality: 85, fullPage: false, captureBeyondViewport: false });
    if (fs.existsSync(outPath)) {
      const s = fs.statSync(outPath);
      if (s.size > 10240) ok = true;
    }
  } catch (_) {}
  if (ok) return outPath;
  const altPath = outPath.replace(/\.jpg$/i, '.png');
  try {
    await page.screenshot({ path: altPath, type: 'png', fullPage: true });
    if (fs.existsSync(altPath)) return altPath;
  } catch (_) {}
  return null;
}

/**
 * Fetch HTML content using Puppeteer Stealth (Anti-Bot Bypass)
 */
async function fetchPageHtml(url, opts = {}) {
  const browser = await launchBrowser({ headless: true });
  let html = '';
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Block images/css/fonts for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const rt = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(rt)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for listing container
    try {
      await page.waitForSelector('.ad-listitem', { timeout: 5000 });
    } catch (e) {
      // Continue even if selector not found (maybe empty results)
    }

    html = await page.content();
  } catch (error) {
    console.error(`fetchPageHtml Error: ${error.message}`);
    throw error;
  } finally {
    await browser.close();
  }
  return html;
}

async function launchBrowser(opts = {}) {
  const headlessOpt = opts.headless === true ? 'new' : (opts.headless === false ? false : DEFAULT_OPTS.headless);
  const proxyUrl =
    opts.proxyUrl ||
    process.env.EUBIKE_PROXY_URL ||
    process.env.HUNTER_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.PROXY_URL ||
    DEFAULT_PROXY_URL;
  let proxyServerArg = null;
  let proxyAuth = null;
  try {
    const u = new URL(proxyUrl);
    proxyServerArg = `${u.protocol}//${u.hostname}:${u.port}`;
    if (u.username || u.password) {
      proxyAuth = { username: decodeURIComponent(u.username || ''), password: decodeURIComponent(u.password || '') };
    }
  } catch (_) {}
  const options = {
    headless: headlessOpt,
    slowMo: opts.slowMo !== undefined ? opts.slowMo : DEFAULT_OPTS.slowMo,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--lang=de-DE,de',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,800',
      ...(proxyServerArg ? [`--proxy-server=${proxyServerArg}`] : [])
    ],
    defaultViewport: null,
    ignoreHTTPSErrors: true,
  };
  const browser = await puppeteer.launch(options);
  browser.__eubikeProxyAuth = proxyAuth;
  return browser;
}

async function tryClickBySelectors(page, selectors) {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      await el.click({ delay: 20 });
      await new Promise((r) => setTimeout(r, 400));
      return true;
    } catch (_) {}
  }
  return false;
}

async function tryClickByXPath(page, xpaths) {
  for (const xp of xpaths) {
    try {
      const handles = await page.$x(xp);
      if (!handles || handles.length === 0) continue;
      await handles[0].click({ delay: 20 });
      await new Promise((r) => setTimeout(r, 400));
      return true;
    } catch (_) {}
  }
  return false;
}

async function dismissOverlays(page) {
  try {
    console.log('🧹 [PUPPETEER] Закрываю оверлеи/баннеры...');
    await tryClickBySelectors(page, [
      '#gdpr-banner-accept',
      '[data-testid="gdpr-banner-accept"]',
      'button#gdpr-banner-accept',
      'button[aria-label="Akzeptieren"]',
      'button[aria-label="Accept"]',
      'button[aria-label="Close"]',
      'button[aria-label="Schließen"]',
      'button[title="Schließen"]',
      '.modal__close',
      '.dialog__close',
      '.overlay__close',
      '[data-testid*="close"]'
    ]);
    await tryClickByXPath(page, [
      "//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ','abcdefghijklmnopqrstuvwxyzäöü'),'akzeptieren')]",
      "//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ','abcdefghijklmnopqrstuvwxyzäöü'),'zustimmen')]",
      "//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ','abcdefghijklmnopqrstuvwxyzäöü'),'schließen')]",
      "//button[contains(translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'close')]"
    ]);
    for (let i = 0; i < 3; i++) {
      try { await page.keyboard.press('Escape'); } catch (_) {}
      await new Promise((r) => setTimeout(r, 250));
    }
  } catch (_) {}
}

async function collapseCategories(page) {
  try {
    await page.evaluate(() => {
      const keys = [
        'kategorie',
        'filter',
        'preis',
        'marke',
        'zustand',
        'versand',
        'lieferung',
        'standort',
        'größe',
        'rahmen',
        'radgröße',
        'category',
        'shipping'
      ];
      const txt = (el) => String((el && (el.innerText || el.textContent)) || '').trim().toLowerCase();
      const should = (el) => {
        const t = txt(el);
        if (!t) return false;
        return keys.some((k) => t.includes(k));
      };
      const collapseBtn = (el) => {
        try { el.click(); } catch (_) {}
      };

      const expanded = Array.from(document.querySelectorAll('button[aria-expanded="true"], [role="button"][aria-expanded="true"]'));
      for (const el of expanded) {
        const inSidebar = !!(el.closest('aside') || el.closest('[data-testid*="filter"]') || el.closest('[class*="filter"]'));
        if (inSidebar || should(el)) collapseBtn(el);
      }

      const openDetails = Array.from(document.querySelectorAll('details[open] > summary'));
      for (const el of openDetails) {
        const inSidebar = !!(el.closest('aside') || el.closest('[data-testid*="filter"]') || el.closest('[class*="filter"]'));
        if (inSidebar || should(el)) collapseBtn(el);
      }
    });
    await new Promise((r) => setTimeout(r, 700));
  } catch (_) {}
}

/**
 * Main function to check status and take screenshots
 */
async function checkKleinanzeigenStatus(url, options = {}) {
  const opts = { ...DEFAULT_OPTS, ...options };
  ensureDir(opts.screenshotsDir);

  // Clean old screenshots
  await enforceScreenshotLimit(opts.screenshotsDir, 20, 0);

  let browser;
  try {
    browser = await launchBrowser(opts);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    try {
      if (browser.__eubikeProxyAuth) {
        await page.authenticate(browser.__eubikeProxyAuth);
      }
    } catch (_) {}

    // Anti-detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // 1. Load Page
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs });
    
    // 2. Cookie Consent (if any)
    try {
      const consentBtn = await page.waitForSelector('#gdpr-banner-accept', { timeout: 3000 });
      if (consentBtn) await consentBtn.click();
    } catch (_) {}

    await dismissOverlays(page);
    await collapseCategories(page);
    await new Promise(r => setTimeout(r, opts.postLoadDelayMs));

    // 3. Take Screenshot (Part 1 - Top)
    const ts = Date.now();
    const shot1 = path.join(opts.screenshotsDir, `screenshot_${ts}_part1.jpg`);
    await captureShot(page, shot1);

    // 4. Scroll & Take Screenshot (Part 2)
    await page.evaluate(() => window.scrollBy(0, 800));
    await new Promise(r => setTimeout(r, 1000));
    const shot2 = path.join(opts.screenshotsDir, `screenshot_${ts}_part2.jpg`);
    await captureShot(page, shot2);

    // 5. Extract Data (Structured Snapshot)
    const extractedData = await page.evaluate(() => {
        const getTxt = (sel) => {
            const el = document.querySelector(sel);
            return el ? el.innerText.trim() : '';
        };
        
        // Extract Gallery
        const images = [];
        // 1. Gallery elements (thumbnails or carousel items)
        document.querySelectorAll('.galleryimage-element img, .image-gallery-image img, #viewad-image').forEach(img => {
            const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-imgsrc');
            if (src) images.push(src);
        });
        
        // 2. Data attributes (often high-res)
        document.querySelectorAll('[data-imgsrc]').forEach(el => {
             const src = el.getAttribute('data-imgsrc');
             if (src && !images.includes(src)) images.push(src);
        });

        // 3. Fallback to any large image in ad body
        if (images.length === 0) {
             const main = document.querySelector('#viewad-image');
             if (main) images.push(main.src);
        }

        return {
            details: getTxt('.viewad-details'), // Technical details (Brand, Model, etc.)
            description: getTxt('.viewad-description'), // Description text
            contact: getTxt('#viewad-contact'), // Seller info
            price: getTxt('#viewad-price'), // Price info
            title: getTxt('#viewad-title'), // Title
            gallery: images.filter(url => url && url.length > 10 && !url.includes('placeholder'))
        };
    });

    return {
        slices: [shot1, shot2].filter(p => fs.existsSync(p)),
        telegramPhotoPath: shot1,
        structuredData: extractedData
    };

  } catch (err) {
    console.error(`Check failed: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  checkKleinanzeigenStatus,
  fetchPageHtml,
  DEFAULT_OPTS
};
