// Модуль для работы с Notion API
class NotionOrderAPI {
    constructor() {
        this.config = NOTION_CONFIG;
        this.headers = {
            'Authorization': `Bearer ${this.config.API_TOKEN}`,
            'Content-Type': 'application/json',
            'Notion-Version': this.config.API_VERSION
        };
    }

    // Создание новой заявки в Notion
    async createOrder(orderData) {
        try {
            const orderNumber = generateOrderNumber();
            
            const notionData = {
                parent: { database_id: this.config.DATABASE_ID },
                properties: {
                    "Номер заявки": {
                        title: [
                            {
                                text: {
                                    content: orderNumber
                                }
                            }
                        ]
                    },
                    "Имя клиента": {
                        rich_text: [
                            {
                                text: {
                                    content: orderData.name || 'Не указано'
                                }
                            }
                        ]
                    },
                    "Способ связи": {
                        rich_text: [
                            {
                                text: {
                                    content: orderData.contact || 'Не указано'
                                }
                            }
                        ]
                    },
                    "Способ оплаты": {
                        select: {
                            name: this.config.PAYMENT_METHODS[orderData.payment] || orderData.payment
                        }
                    },
                    "Дополнительные пожелания": {
                        rich_text: [
                            {
                                text: {
                                    content: orderData.wishes || 'Нет'
                                }
                            }
                        ]
                    },
                    "Статус": {
                        select: {
                            name: this.config.ORDER_STATUSES.NEW
                        }
                    },
                    "Дата создания": {
                        date: {
                            start: new Date().toISOString()
                        }
                    }
                }
            };

            const response = await fetch(`${this.config.API_BASE_URL}/pages`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(notionData)
            });

            if (!response.ok) {
                throw new Error(`Ошибка создания заявки: ${response.status}`);
            }

            const result = await response.json();
            
            return {
                success: true,
                orderNumber: orderNumber,
                notionId: result.id,
                message: 'Заявка успешно создана'
            };

        } catch (error) {
            console.error('Ошибка при создании заявки:', error);
            return {
                success: false,
                error: error.message,
                message: 'Ошибка при создании заявки'
            };
        }
    }

    // Получение статуса заявки по номеру
    async getOrderStatus(orderNumber) {
        try {
            const query = {
                database_id: this.config.DATABASE_ID,
                filter: {
                    property: "Номер заявки",
                    title: {
                        equals: orderNumber
                    }
                }
            };

            const response = await fetch(`${this.config.API_BASE_URL}/databases/${this.config.DATABASE_ID}/query`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(query)
            });

            if (!response.ok) {
                throw new Error(`Ошибка получения статуса: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.results.length === 0) {
                return {
                    success: false,
                    message: 'Заявка с таким номером не найдена'
                };
            }

            const order = result.results[0];
            const properties = order.properties;

            return {
                success: true,
                orderData: {
                    orderNumber: properties["Номер заявки"]?.title[0]?.text?.content || orderNumber,
                    customerName: properties["Имя клиента"]?.rich_text[0]?.text?.content || 'Не указано',
                    contact: properties["Способ связи"]?.rich_text[0]?.text?.content || 'Не указано',
                    paymentMethod: properties["Способ оплаты"]?.select?.name || 'Не указано',
                    wishes: properties["Дополнительные пожелания"]?.rich_text[0]?.text?.content || 'Нет',
                    status: properties["Статус"]?.select?.name || 'Неизвестно',
                    createdDate: properties["Дата создания"]?.date?.start || null,
                    updatedDate: order.last_edited_time || null
                }
            };

        } catch (error) {
            console.error('Ошибка при получении статуса заявки:', error);
            return {
                success: false,
                error: error.message,
                message: 'Ошибка при получении статуса заявки'
            };
        }
    }

    // Получение всех заявок (для админки)
    async getAllOrders() {
        try {
            const response = await fetch(`${this.config.API_BASE_URL}/databases/${this.config.DATABASE_ID}/query`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    sorts: [
                        {
                            property: "Дата создания",
                            direction: "descending"
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Ошибка получения заявок: ${response.status}`);
            }

            const result = await response.json();
            
            return {
                success: true,
                orders: result.results.map(order => {
                    const properties = order.properties;
                    return {
                        orderNumber: properties["Номер заявки"]?.title[0]?.text?.content || 'Неизвестно',
                        customerName: properties["Имя клиента"]?.rich_text[0]?.text?.content || 'Не указано',
                        contact: properties["Способ связи"]?.rich_text[0]?.text?.content || 'Не указано',
                        paymentMethod: properties["Способ оплаты"]?.select?.name || 'Не указано',
                        status: properties["Статус"]?.select?.name || 'Неизвестно',
                        createdDate: properties["Дата создания"]?.date?.start || null,
                        updatedDate: order.last_edited_time || null
                    };
                })
            };

        } catch (error) {
            console.error('Ошибка при получении всех заявок:', error);
            return {
                success: false,
                error: error.message,
                message: 'Ошибка при получении заявок'
            };
        }
    }
}

// Создаем глобальный экземпляр API
const notionAPI = new NotionOrderAPI();

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotionOrderAPI;
}