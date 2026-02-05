/**
 * InputSanitizer.js
 * Очистка и валидация входных данных перед отправкой в AI
 */

class InputSanitizer {
    /**
     * Проверяет, является ли объявление "мусорным"
     * (резерв, удалено, продано)
     */
    static isJunkListing(rawBike) {
        const title = (rawBike.title || '').toLowerCase();
        
        // Ключевые слова мусора
        const junkKeywords = [
            'reserviert', 
            'gelöscht', 
            'verkauft', 
            'sold', 
            'reserved', 
            'deleted'
        ];

        // Проверяем title на точное совпадение или начало строки
        // "Reserviert • Gelöscht • ..."
        if (junkKeywords.some(k => title.includes(k + ' •') || title.startsWith(k))) {
            return true;
        }

        return false;
    }

    /**
     * Очищает заголовок от мусорных префиксов и спецсимволов
     */
    static cleanTitle(title) {
        if (!title) return '';
        
        let cleaned = title;
        
        // 1. Удаляем префиксы типа "Reserviert • Gelöscht •"
        // Регулярка ищет слова Reserviert/Gelöscht в начале строки, с разделителями
        cleaned = cleaned.replace(/^(reserviert|gelöscht|verkauft|sold|reserved)[\s•|\-]*/gi, '').trim();
        
        // 2. Удаляем повторяющиеся разделители и bullet points
        cleaned = cleaned.replace(/[•]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // 3. Удаляем escaped newlines если есть
        cleaned = cleaned.replace(/\\n/g, ' ');

        return cleaned;
    }

    /**
     * Очищает описание от HTML entities и escaped characters
     */
    static cleanDescription(description) {
        if (!description) return '';
        
        let cleaned = description;

        // 1. Декодируем HTML entities (базовые)
        cleaned = cleaned
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");

        // 2. Нормализуем переносы строк
        cleaned = cleaned.replace(/\\n/g, '\n');

        // 3. Удаляем null bytes и control characters кроме переносов
        cleaned = cleaned.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');

        return cleaned;
    }

    /**
     * Очищает все поля объекта
     */
    static sanitize(rawBike) {
        return {
            ...rawBike,
            title: this.cleanTitle(rawBike.title),
            description: this.cleanDescription(rawBike.description)
        };
    }
}

module.exports = InputSanitizer;
