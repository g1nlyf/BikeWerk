import { minify } from 'html-minifier-terser';
import * as cheerio from 'cheerio';

export const minifyHtml = async (html: string): Promise<string> => {
    try {
        return await minify(html, {
            removeAttributeQuotes: true,
            collapseWhitespace: true,
            removeComments: true,
            removeOptionalTags: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            minifyCSS: true,
            minifyJS: true,
            removeTagWhitespace: true
        });
    } catch (error) {
        console.error("Error minifying HTML:", error);
        return html; // Return original if minification fails
    }
};

export const cleanHtml = (html: string): string => {
    try {
        const $ = cheerio.load(html);

        // Remove heavy/irrelevant elements
        $('script').remove();
        $('style').remove();
        $('svg').remove();
        $('noscript').remove();
        $('iframe').remove();
        $('header').remove();
        $('footer').remove();
        $('nav').remove();
        $('.is-hidden').remove();
        $('[aria-hidden="true"]').remove();
        
        // Remove cookies banners, popups, ads
        $('#gdpr-banner').remove();
        $('.site-footer').remove();
        $('.site-header').remove();

        // Try to narrow down to main content if possible
        // Kleinanzeigen usually has #viewad-main or #viewad-content
        const mainContent = $('#viewad-main, #viewad-content, article.aditem-main');
        if (mainContent.length > 0) {
            return mainContent.html() || '';
        }

        // Fallback: return body content
        return $('body').html() || '';
    } catch (e) {
        // Fallback to regex if cheerio fails
        return html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
            .replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gm, "");
    }
};
