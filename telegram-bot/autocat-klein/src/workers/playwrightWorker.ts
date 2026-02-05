import { chromium, Browser, Page } from 'playwright';
import { PlaywrightPlan, PlaywrightExecutionResult } from '../types';

export class PlaywrightService {
    private browser: Browser | null = null;

    async init() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    }

    async executePlan(url: string, plan: PlaywrightPlan): Promise<PlaywrightExecutionResult> {
        if (!this.browser) await this.init();
        
        const context = await this.browser!.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        });
        const page = await context.newPage();
        const result: PlaywrightExecutionResult = {
            html: "",
            screenshots: {},
            xhrResponses: [],
            extractedImages: [],
            cookiesAccepted: false,
            success: false
        };

        try {
            await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

            // Execute steps
            for (const step of plan.steps) {
                try {
                    if (step.action === 'click' && step.selector) {
                        await page.click(step.selector, { timeout: step.timeout || 5000 });
                    } else if (step.action === 'waitForSelector' && step.selector) {
                        await page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
                    } else if (step.action === 'screenshot') {
                        const buffer = await page.screenshot({ fullPage: false });
                        result.screenshots[step.name || 'default'] = buffer.toString('base64');
                    } else if (step.action === 'extract' && step.selectors) {
                        // basic extraction if needed
                    }
                } catch (e) {
                    console.warn(`Step failed: ${JSON.stringify(step)}`, e);
                }
            }

            // Always capture final state
            result.html = await page.content();
            
            // Extract images
            result.extractedImages = await page.$$eval('img', imgs => imgs.map(img => img.src));

            result.success = true;

        } catch (error: any) {
            result.error = error.message;
        } finally {
            await context.close();
        }

        return result;
    }

    async close() {
        if (this.browser) await this.browser.close();
    }
}

export const playwrightService = new PlaywrightService();
