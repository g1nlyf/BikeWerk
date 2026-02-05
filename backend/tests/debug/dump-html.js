const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function dumpHtml() {
    const url = 'https://buycycle.com/de-de/product/status-160-2022-87161';
    console.log(`🔍 Fetching HTML for: ${url}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Expand description if possible
        try {
            const readMore = await page.$('text/Weiterlesen'); // XPath-like or simple selector
            if (readMore) await readMore.click();
        } catch (e) {}

        const html = await page.content();
        fs.writeFileSync('buycycle_dump.html', html);
        console.log('✅ HTML dumped to buycycle_dump.html');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await browser.close();
    }
}

dumpHtml();
