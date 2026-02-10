// Конфигурация для BikeEU калькулятора
const CONFIG = {
    // Gemini API настройки
    // NOTE: Do not ship API keys in client code. Set via server-side env/config.
    GEMINI_API_KEY: '',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',

    // Supabase CRM настройки
    SUPABASE: {
        URL: '',
        ANON_KEY: ''
    },

    // Настройки парсера
    PARSER: {
        TIMEOUT: 30000, // 30 секунд
        RETRY_ATTEMPTS: 3,
        SUPPORTED_DOMAINS: [
            'kleinanzeigen.de',
            'ebay-kleinanzeigen.de',
            'willhaben.at',
            'marktplaats.nl',
            'leboncoin.fr'
        ]
    },

    // Тестовые данные для демонстрации
    DEMO_DATA: {
        price: 1200,
        year: 2022,
        brand: 'Trek',
        model: 'Domane SL 5',
        frameSize: '56 см',
        wheelDiameter: '700c',
        isNegotiable: false,
        deliveryOption: 'available',
        description: 'Шоссейный велосипед в отличном состоянии'
    }
};

// Конфигурация Supabase для CRM (совместимость с существующим кодом)
const SUPABASE_CONFIG = {
    url: CONFIG.SUPABASE.URL,
    key: CONFIG.SUPABASE.ANON_KEY
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
    window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
