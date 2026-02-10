const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    const url = 'https://buycycle.com/de-de/product/capra-sram-gx-eagle-62538';
    console.log(`Debuging URL: ${url}`);

    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    const details = await page.evaluate(() => {
        const details = { components: {} };
        const clean = (t) => t ? t.trim().replace(/\s+/g, ' ') : '';

        // 5. Next.js App Router Data Extraction (self.__next_f)
        const nextFData = window.self?.__next_f;
        if (nextFData && Array.isArray(nextFData)) {
            try {
                // Flatten the stream
                const stream = nextFData.map(item => item[1]).join('');
                
                // Regex extraction for Description
                const descMatch = stream.match(/"description":\{"key":"[^"]+","value":"(.*?)"/);
                if (descMatch && descMatch[1]) {
                        // Unescape JSON string
                        // Replace \\" with " and \\n with \n
                        let rawDesc = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                        // Also handle unicode escapes if needed, but basic replacement helps
                        if (rawDesc.length > (details.description?.length || 0)) {
                            details.description = rawDesc;
                        }
                }

                // Regex extraction for Attributes (Components)
                // We scan the entire stream for key-value pairs that look like attributes
                // Pattern: {"key":"...","value":"..."}
                // This is a bit loose but effective for finding "component_name" etc.
                const attrRegex = /{"key":"(.*?)","value":"(.*?)"(?:,"url":.*?)?}/g;
                let match;
                while ((match = attrRegex.exec(stream)) !== null) {
                    const key = match[1];
                    let val = match[2];
                    
                    // Cleanup value
                    val = val.replace(/\\"/g, '"');

                    if (key && val) {
                        // Normalize keys: component_name -> Groupset, etc.
                        if (key === 'component_name') details.components['Groupset'] = val;
                        else if (key === 'frame_material_name') details.components['Frame Material'] = val;
                        else if (key === 'brake_type_name') details.components['Brakes'] = val;
                        else details.components[key] = val;
                    }
                }

            } catch (e) {
                details.error = e.message;
            }
        }
        return details;
    });

    console.log('Extracted Details via Next.js Stream:', JSON.stringify(details, null, 2));

    await browser.close();
})();

