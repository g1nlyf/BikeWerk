const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

/**
 * KLEINANZEIGEN FETCHER
 * 
 * Fetches HTML from Kleinanzeigen using Puppeteer Stealth
 * Handles anti-bot protection and dynamic content
 */
class KleinanzeigenFetcher {
  
  /**
   * Fetch HTML content
   * @param {string} url - Kleinanzeigen URL
   * @param {Object} options - Options
   * @returns {Promise<string>} HTML content
   */
  static async fetch(url, options = {}) {
    const {
      waitForSelector = '#viewad-title', // Detail page selector
      timeout = 30000,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    } = options;
    
    console.log(`\n🌐 Fetching: ${url}`);
    console.log('⏳ Starting browser...');
    
    let browser = null;
    
    try {
      browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set User-Agent
      await page.setUserAgent(userAgent);
      
      // Set Viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      console.log('🚀 Navigating to page...');
      
      // Navigate
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: timeout 
      });
      
      console.log('⏱️  Waiting for content to load...');
      
      // Check for Anti-Bot
      const title = await page.title();
      if (title.includes('Robot') || title.includes('Captcha')) {
         throw new Error('Blocked by Anti-Bot (Captcha/Robot check)');
      }
      
      // Wait for selector
      try {
        await page.waitForSelector(waitForSelector, { timeout: 10000 });
      } catch (e) {
        console.log('⚠️  Selector not found, page might be missing or different layout...');
      }
      
      // Random delay to mimic human
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
      
      console.log('📄 Extracting HTML...');
      
      // Get HTML
      const html = await page.content();
      
      console.log(`✅ HTML fetched (${html.length} chars)`);
      
      return html;
      
    } catch (error) {
      console.error(`❌ Fetch Error: ${error.message}`);
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }
}

module.exports = KleinanzeigenFetcher;
