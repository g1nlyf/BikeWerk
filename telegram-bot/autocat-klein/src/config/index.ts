import * as path from 'path';
import * as fs from 'fs';

export const CONFIG = {
    BRANDS_FILE: path.join(__dirname, 'brands.json'),
    SEARCH_TEMPLATES_FILE: path.join(__dirname, 'search-templates.json'),
    
    // Defaults
    DEFAULT_CONCURRENCY: 3,
    DEFAULT_TIMEOUT: 20000,
    USER_AGENTS: [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    ]
};

export const loadBrands = (): string[] => {
    try {
        return JSON.parse(fs.readFileSync(CONFIG.BRANDS_FILE, 'utf-8'));
    } catch (e) {
        return [];
    }
};

export const loadSearchTemplates = (): any => {
    try {
        return JSON.parse(fs.readFileSync(CONFIG.SEARCH_TEMPLATES_FILE, 'utf-8'));
    } catch (e) {
        return { templates: [] };
    }
};
