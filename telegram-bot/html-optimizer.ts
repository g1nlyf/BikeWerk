import * as cheerio from 'cheerio';
// @ts-ignore
import { minify } from 'html-minifier-terser';

export async function optimizeHtml(rawHtml: string): Promise<{ html: string; size: number }> {
    // 1. Cheerio Cleanup
    const $ = cheerio.load(rawHtml);

    // Remove heavy/useless tags
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    $('svg').remove();
    $('iframe').remove();
    $('footer').remove();
    $('header').remove();
    $('nav').remove();

    // Remove base64 images
    $('img[src^="data:"]').remove();

    // Optional: Keep only main containers if possible (heuristic)
    // Kleinanzeigen specific selectors
    const mainContent = $('#viewad-main, #viewad-product, #viewad-main-info, #viewad-contact, #viewad-description, #viewad-extra-info, .ad-details, .gallery-container');
    
    let cleanHtml = '';
    
    if (mainContent.length > 0) {
        // If we found main content, use only that
        cleanHtml = mainContent.map((_, el) => $(el).html()).get().join('\n');
    } else {
        // Fallback: use body HTML
        cleanHtml = $('body').html() || '';
    }

    // 2. Minification
    try {
        const minified = await minify(cleanHtml, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true,
            minifyCSS: false, // CSS is removed anyway
            minifyJS: false   // JS is removed anyway
        });

        // Truncate if still too large (limit to 60k chars for "Fast Pass")
        const truncated = minified.length > 60000 ? minified.substring(0, 60000) + '...' : minified;

        return {
            html: truncated,
            size: truncated.length
        };
    } catch (error) {
        console.error("Minification error:", error);
        // Fallback to just cheerio cleaned html
        const fallback = cleanHtml.substring(0, 60000);
        return {
            html: fallback,
            size: fallback.length
        };
    }
}
