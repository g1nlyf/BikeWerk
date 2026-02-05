// Конфигурация для BikeEU калькулятора
const CONFIG = {
    // Gemini API настройки
    GEMINI_API_KEY: 'AIzaSyCS6qbM0otGtFcrLbqi_X44oQUCMkCV8kY',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    
    // Supabase CRM настройки
    SUPABASE: {
        URL: 'https://lclalsznmrjgqsgaqtps.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbGFsc3pubXJqZ3FzZ2FxdHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5Nzg5MDgsImV4cCI6MjA3NjU1NDkwOH0.nyTQDoddHyrY4_QizmQFLue8EjNqeQaJ0U021Hbc7YI'
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