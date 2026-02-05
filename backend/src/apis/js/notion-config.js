// Конфигурация для работы с Notion API
const NOTION_CONFIG = {
    // Токен интеграции Notion
    API_TOKEN: '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',
    
    // ID базы данных заявок (нужно будет получить из Notion)
    DATABASE_ID: '271972f4eb4a8004939bc6e98c699437',
    
    // URL для API запросов
    API_BASE_URL: 'https://api.notion.com/v1',
    
    // Версия API
    API_VERSION: '2022-06-28',
    
    // Статусы заявок (соответствуют статусам в Notion)
    ORDER_STATUSES: {
        NEW: 'Новая',
        PROCESSING: 'Ждет обработки', 
        IN_WORK: 'В обработке',
        COMPLETED: 'Выполнена',
        CANCELLED: 'Отменена',
        READY: 'Обработка к покупке'
    },
    
    // Способы оплаты
    PAYMENT_METHODS: {
        BANK_TRANSFER: 'Банковский перевод',
        CASH: 'Наличные',
        CRYPTO: 'Криптовалюта'
    }
};

// Функция для генерации уникального номера заявки
function generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${timestamp}${random}`;
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NOTION_CONFIG, generateOrderNumber };
}