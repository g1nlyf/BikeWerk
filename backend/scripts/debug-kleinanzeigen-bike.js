const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');

puppeteer.use(StealthPlugin());

const url = process.argv[2] || 'https://www.kleinanzeigen.de/s-anzeige/santa-cruz-bronson-c-s-kit-groesse-m/3300077074-217-5842';

(async () => {
    console.log(`Debug scraping: ${url}`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const content = await page.content();
        const $ = cheerio.load(content);

        // 1. Title
        const title = $('#viewad-title').text().trim();
        console.log(`Title: ${title}`);

        // 2. Price
        const price = $('#viewad-price').text().trim();
        console.log(`Price: ${price}`);

        // 3. Description
        const desc = $('#viewad-description-text').text().trim();
        console.log(`Description length: ${desc.length}`);
        console.log(`Description start: ${desc.slice(0, 100)}...`);

        // 4. Attributes
        console.log('--- Attributes ---');
        $('#viewad-details .addetailslist--detail').each((i, el) => {
            const key = $(el).text().split(':')[0].trim();
            const val = $(el).find('span').text().trim() || $(el).text().split(':')[1]?.trim();
            console.log(`${key}: ${val}`);
        });

        // 5. Images
        console.log('--- Images ---');
        // Main image
        const mainImg = $('#viewad-image').attr('src') || $('#viewad-image').data('src');
        console.log(`Main: ${mainImg}`);

        // Gallery
        const gallery = [];
        $('.galleryimage-element img').each((i, el) => {
            let src = $(el).attr('src') || $(el).data('src') || $(el).data('imgsrc');
            if (src) gallery.push(src);
        });
        
        // Also check for JSON-LD which might have high-res images
        const jsonLd = $('script[type="application/ld+json"]').html();
        if (jsonLd) {
            try {
                const data = JSON.parse(jsonLd);
                if (data.image) {
                    console.log('JSON-LD Images:', Array.isArray(data.image) ? data.image : [data.image]);
                }
            } catch(e) {}
        }

        console.log(`Gallery count: ${gallery.length}`);
        console.log(gallery);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
