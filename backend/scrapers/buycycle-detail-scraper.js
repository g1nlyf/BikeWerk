const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class BuycycleDetailScraper {
  
  async scrapeProductPage(url) {
    console.log(`📄 [DETAIL] Scraping: ${url}`);
    
    const browser = await puppeteer.launch({ 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    
    try {
      // User-agent (important!)
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      
      // Navigate with extended timeout
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 60000  // ✅ 60 секунд вместо 30
      });
      
      // Wait for main content
      await page.waitForSelector('h1, [class*="title"]', { timeout: 10000 });
      
      // Extract data
      const details = await page.evaluate(() => {
        const data = {};
        
        // ===== METHOD 1: __NEXT_DATA__ (preferred) =====
        try {
          const nextDataEl = document.getElementById('__NEXT_DATA__');
          if (nextDataEl) {
            const json = JSON.parse(nextDataEl.textContent);
            const product = json.props?.pageProps?.product;
            
            if (product) {
              data.title = product.title;
              data.price = product.price?.value;
              data.original_price = product.originalPrice?.value;
              data.year = product.year;
              data.frame_size = product.frameSize;
              data.condition = product.condition;
              data.brand = product.brand?.name;
              data.model = product.model?.name;
              data.category = product.category?.name;
              data.description = product.description;
              data.images = product.images?.map(img => img.url) || [];
              
              // Seller
              data.seller_name = product.seller?.name;
              data.seller_location = product.seller?.location;
              data.seller_rating = product.seller?.rating;
              
              console.log('[DEBUG] Extracted from __NEXT_DATA__');
            }
          }
        } catch (e) {
          console.error('[DEBUG] __NEXT_DATA__ parsing failed:', e.message);
        }
        
        // ===== METHOD 2: DOM FALLBACK (if __NEXT_DATA__ fails) =====
        if (!data.title) {
          console.log('[DEBUG] Fallback to DOM parsing...');
          
          // Title
          const titleEl = document.querySelector('h1, [class*="ProductTitle"]');
          data.title = titleEl?.textContent?.trim();
          
          // Price
          const priceEl = document.querySelector('[class*="Price"], [class*="price"], .product-price-current');
          if (priceEl) {
            const priceText = priceEl.textContent.trim();
            data.price = parseInt(priceText.replace(/[^\d]/g, ''));
          } else {
             // Try searching by text content if class fails
             const allDivs = Array.from(document.querySelectorAll('div, span, h2, h3'));
             // Find element with € sign and reasonable length
             const euroEl = allDivs.find(el => el.textContent.includes('€') && el.textContent.length < 30 && /\d/.test(el.textContent));
             
             if (euroEl) {
                // Extract the number near the € sign
                // Regex to match "1.200" or "1200"
                const match = euroEl.textContent.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
                if (match) {
                    data.price = parseInt(match[0].replace(/[.,]/g, ''));
                }
             }
          }
          
          // Images
          data.images = Array.from(document.querySelectorAll('img[src*="cloudfront"]'))
            .map(img => {
              // Get high-res from srcset
              if (img.srcset) {
                const parts = img.srcset.split(',');
                return parts[parts.length - 1].trim().split(' ')[0];
              }
              return img.src;
            })
            .filter(src => !src.includes('placeholder'));
          
          // Description
          const descEl = document.querySelector('[class*="escription"]');
          data.description = descEl?.textContent?.trim();
        }
        
        // ===== METHOD 3: PARSE "ALLGEMEINE INFORMATIONEN" =====
        const infoChips = {};
        document.querySelectorAll('[class*="Info"] dl, dl').forEach(dl => {
          const dt = dl.querySelector('dt')?.textContent?.trim();
          const dd = dl.querySelector('dd')?.textContent?.trim();
          if (dt && dd) {
            infoChips[dt] = dd;
          }
        });
        
        // Map German fields to English
        if (Object.keys(infoChips).length > 0) {
          data.general_info = infoChips;
          
          // Extract specific fields
          if (!data.year) data.year = parseInt(infoChips['Jahr']);
          if (!data.frame_size) data.frame_size = infoChips['Rahmengröße'];
          if (!data.condition) data.condition = infoChips['Zustand'];
          
          console.log('[DEBUG] Extracted general_info:', Object.keys(infoChips).length, 'fields');
        }
        
        // ===== METHOD 4: PARSE "FAHRRADDETAILS" =====
        const components = {};
        document.querySelectorAll('table tr, [class*="Detail"] dl').forEach(row => {
          const label = row.querySelector('td:first-child, dt')?.textContent?.trim();
          const value = row.querySelector('td:last-child, dd')?.textContent?.trim();
          if (label && value && label !== value) {
            components[label] = value;
          }
        });
        
        if (Object.keys(components).length > 0) {
          data.components = components;
          console.log('[DEBUG] Extracted components:', Object.keys(components).length, 'items');
        }
        
        return data;
      });
      
      await browser.close();
      
      // Validation
      if (!details.title && !details.price) {
        console.log(`   ❌ NO DATA EXTRACTED (page might have anti-bot)`);
        return null;
      }
      
      console.log(`   ✅ Extracted: ${Object.keys(details).filter(k => details[k]).length} fields`);
      return details;
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      await browser.close();
      return null;
    }
  }
}

module.exports = new BuycycleDetailScraper();
