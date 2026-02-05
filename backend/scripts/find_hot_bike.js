const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    console.log('Navigating to Buycycle High Demand page...');
    await page.goto('https://buycycle.com/de-de/shop/all/high-demand/1', { waitUntil: 'networkidle2' });

    // Wait for bike cards
    await page.waitForSelector('a[href*="/bike/"]');

    const bikeLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/bike/"]'));
        return links.map(a => a.href).filter(href => !href.includes('mechanic-check'));
    });

    console.log('Found bike links:');
    // Get unique links
    const uniqueLinks = [...new Set(bikeLinks)];
    uniqueLinks.slice(0, 5).forEach((link, i) => console.log(`${i + 1}: ${link}`));

    await browser.close();
})();
