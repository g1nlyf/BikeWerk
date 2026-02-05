import * as cheerio from 'cheerio';
import { ParsedCandidates } from '../types';

export const fastParseHtml = (html: string): ParsedCandidates => {
    const $ = cheerio.load(html);
    
    const title = $('#viewad-title').text().trim() || $('h1').first().text().trim();
    const priceCandidate = $('#viewad-price').text().trim() || $('.ad-price').text().trim();
    const descriptionCandidate = $('#viewad-description-text').text().trim();
    const locationCandidate = $('#viewad-locality').text().trim();
    const rawAdId = $('#viewad-ad-id-box li').last().text().replace(/[^0-9]/g, '') || '';
    
    const imageCandidates: string[] = [];
    $('#viewad-image').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src) imageCandidates.push(src);
    });
    $('.galleryimage-element img').each((_, el) => {
         const src = $(el).attr('src') || $(el).attr('data-src');
         if (src) imageCandidates.push(src);
    });

    const metaTags: Record<string, string> = {};
    $('meta').each((_, el) => {
        const name = $(el).attr('name') || $(el).attr('property');
        const content = $(el).attr('content');
        if (name && content) metaTags[name] = content;
    });

    return {
        title: title || null,
        priceCandidate: priceCandidate || null,
        descriptionCandidate: descriptionCandidate || null,
        locationCandidate: locationCandidate || null,
        rawAdId: rawAdId || null,
        imageCandidates,
        metaTags
    };
};
