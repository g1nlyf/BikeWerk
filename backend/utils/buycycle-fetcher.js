const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

/**
 * BUYCYCLE FETCHER
 * 
 * Скачивает HTML страницы Buycycle с полным рендерингом JavaScript
 * Обходит Cloudflare защиту и загружает динамический контент
 */
class BuycycleFetcher {
  
  /**
   * Скачать HTML страницы
   * @param {string} url - URL страницы Buycycle
   * @param {Object} options - Опции
   * @returns {Promise<string>} HTML содержимое
   */
  static async fetch(url, options = {}) {
    const {
      waitForSelector = 'h1', // Ждем загрузки заголовка
      timeout = 30000,
      saveToFile = null,
      userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    } = options;
    
    console.log(`\n🌐 Fetching: ${url}`);
    console.log('⏳ Starting browser...');
    
    let browser = null;
    
    try {
      // Запускаем браузер
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage'
        ]
      });
      
      const page = await browser.newPage();
      
      // Устанавливаем User-Agent
      await page.setUserAgent(userAgent);
      
      // Устанавливаем viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Блокируем ненужные ресурсы для ускорения
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      console.log('🚀 Navigating to page...');
      
      // Переходим на страницу
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: timeout 
      });
      
      console.log('⏱️  Waiting for content to load...');
      
      // Ждем загрузки основного контента
      try {
        await page.waitForSelector(waitForSelector, { timeout: 5000 });
      } catch (e) {
        console.log('⚠️  Selector not found, continuing anyway...');
      }
      
      // Дополнительная пауза для динамического контента (ФИКС)
      await this.sleep(2000);
      
      // Скроллим вниз для lazy-loading контента
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.sleep(500);
      
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.sleep(500);
      
      console.log('📄 Extracting HTML...');
      
      // Получаем полный HTML
      const html = await page.content();
      
      console.log(`✅ HTML fetched (${html.length} chars)`);
      
      // Сохраняем в файл если указано
      if (saveToFile) {
        const dir = path.dirname(saveToFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(saveToFile, html, 'utf-8');
        console.log(`💾 Saved to: ${saveToFile}`);
      }
      
      await browser.close();
      
      return html;
      
    } catch (error) {
      console.error('❌ Error fetching page:', error.message);
      
      if (browser) {
        await browser.close();
      }
      
      throw error;
    }
  }
  
  /**
   * Утилита для ожидания (замена page.waitForTimeout)
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Быстрая проверка доступности URL
   */
  static async ping(url) {
    try {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      
      const response = await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      const status = response.status();
      await browser.close();
      
      return { success: status === 200, status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = BuycycleFetcher;
