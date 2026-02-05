import { storage } from './lib/storage';
import { loadSearchTemplates } from './config';
import { CONFIG } from './config';
import * as cheerio from 'cheerio';
import { fetcher } from './lib/fetcher';
import { smartFilter, SearchItem } from './lib/smartFilter';
import { pipeline } from './lib/pipeline';
import pLimit from 'p-limit';

const parseArgs = () => {
    const args = process.argv.slice(2);
    const countArg = args.find(a => a.startsWith('--count='));
    const modeArg = args.find(a => a.startsWith('--mode='));
    
    return {
        count: countArg ? parseInt(countArg.split('=')[1]) : 50,
        mode: modeArg ? modeArg.split('=')[1] : 'auto'
    };
};

const runDirect = async (targetCount: number) => {
    const templates = loadSearchTemplates().templates;
    await storage.init();
    const limit = pLimit(1);
    let added = 0;

    for (const t of templates) {
        if (added >= targetCount) break;
        const url = t.urlPattern.replace('{page}', '1');
        console.log(`Запрос - ${url}`);
        const { html } = await fetcher.fetchPage(url);
        const $ = cheerio.load(html);
        const items: SearchItem[] = [];
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
                items.push({ title, price, link: fullUrl, location, date, snippet });
            }
        });
        console.log(`Байков по запросу - ${items.length}`);
        const { selectedUrls } = await smartFilter.selectTopCandidates(items);
        console.log(`Выбрано ${selectedUrls.length} - ${selectedUrls.join('\n')}`);

        for (let i = 0; i < selectedUrls.length && added < targetCount; i++) {
            const link = selectedUrls[i];
            const item = items.find(it => it.link === link);
            console.log(`байк ${i + 1} - ссылка ${link} ${item ? item.title : ''}`);
            await limit(() => pipeline.processListing(link));
            added += 1;
        }
    }

    await storage.close();
};

const main = async () => {
    const { count, mode } = parseArgs();
    console.log(`Starting AutoCat with target=${count}, mode=${mode}`);
    if (mode === 'direct') {
        await runDirect(count);
        return;
    }

    try {
        await storage.init();
        const { searchQueue, parseQueue, closeQueues } = await import('./workers/queues');
        await import('./workers/fetchSearch');
        await import('./workers/parseListing');
        const templates = loadSearchTemplates().templates;
        const searchJobs = templates.map((t: any) => ({ name: 'search', data: { url: t.urlPattern.replace('{page}', '1'), pageType: t.name } }));
        await searchQueue.addBulk(searchJobs);
        console.log(`Enqueued ${searchJobs.length} seed pages`);
    } catch (e) {
        await runDirect(count);
        return;
    }

    const { parseQueue, closeQueues } = await import('./workers/queues');
    const interval = setInterval(async () => {
        const counts = await parseQueue.getJobCounts();
        if (counts.completed >= count) {
            clearInterval(interval);
            await closeQueues();
            await storage.close();
            console.log('Done.');
            process.exit(0);
        }
    }, 5000);
};

main().catch(console.error);
