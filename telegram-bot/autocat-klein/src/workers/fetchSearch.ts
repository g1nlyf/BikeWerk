import { Worker, Job } from 'bullmq';
import { fetcher } from '../lib/fetcher';
import { parseQueue } from './queues';
import * as cheerio from 'cheerio';
import { cleanHtml } from '../lib/htmlUtils';
import { smartFilter, SearchItem } from '../lib/smartFilter';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
};

export const fetchSearchWorker = new Worker('search-pages', async (job: Job) => {
    const { url, pageType } = job.data;
    console.log(`Запрос - ${url}`);

    try {
        const { html } = await fetcher.fetchPage(url);
        const $ = cheerio.load(html);
        const items: SearchItem[] = [];

        // Selector for Kleinanzeigen items
        $('article.aditem').each((_, el) => {
            const $el = $(el);
            const linkEl = $el.find('a.ellipsis');
            const link = linkEl.attr('href');
            const title = linkEl.text().trim();
            const price = $el.find('.aditem-main--middle--price-shipping--price').text().trim();
            const location = $el.find('.aditem-main--top--left').text().trim();
            const date = $el.find('.aditem-main--top--right').text().trim();
            const snippet = $el.find('.aditem-main--middle--description').text().trim();

            if (link && title) {
                const fullUrl = link.startsWith('http') ? link : `https://www.kleinanzeigen.de${link}`;
                items.push({
                    title,
                    price,
                    link: fullUrl,
                    location,
                    date,
                    snippet
                });
            }
        });

        console.log(`Байков по запросу - ${items.length}`);

        // Use Smart Filter to pick top 3
        const { selectedUrls, reasons } = await smartFilter.selectTopCandidates(items);

        console.log(`Выбрано ${selectedUrls.length} - ${selectedUrls.join('\n')}`);

        const jobs = selectedUrls.map(link => ({
            name: 'listing',
            data: { url: link, source: pageType },
            opts: { jobId: link } // Dedup by URL in queue
        }));

        await parseQueue.addBulk(jobs);

        return { count: selectedUrls.length, reasons };

    } catch (error: any) {
        console.error(`Error fetching search page ${url}:`, error.message);
        throw error;
    }
}, { connection, concurrency: 1 });
