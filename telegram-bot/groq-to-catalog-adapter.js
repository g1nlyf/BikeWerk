// Адаптер для преобразования данных от Groq парсера в формат каталога
class GroqToCatalogAdapter {
    constructor() {
        // Маппинг категорий из Kleinanzeigen в наши категории
        this.categoryMapping = {
            'Mountainbikes': 'Горный',
            'Rennräder': 'Шоссейный', 
            'Citybikes': 'Городской',
            'E-Bikes': 'Электро',
            'BMX': 'BMX',
            'Kinderfahrräder': 'Детский',
            'Trekkingräder': 'Городской',
            'Crossbikes': 'Горный',
            'Gravelbikes': 'Шоссейный',
            'Fatbikes': 'Горный'
        };

        // Маппинг состояния
        this.conditionMapping = {
            'Neu': 'Новый',
            'Sehr gut': 'Отличное',
            'Gut': 'Хорошее', 
            'Zufriedenstellend': 'Удовлетворительное',
            'Mangelhaft': 'Плохое'
        };

        // Маппинг типов велосипедов
        this.bikeTypeMapping = {
            'Enduro': 'Эндуро',
            'Cross Country': 'Кросс-кантри',
            'Downhill': 'Даунхилл',
            'Trail': 'Трейл',
            'All Mountain': 'Олл-маунтин',
            'Freeride': 'Фрирайд'
        };
    }

    /**
     * Преобразует данные от Groq парсера в формат для каталога
     * @param {Object} groqData - Данные от Groq парсера
     * @returns {Object} - Данные в формате каталога
     */
    adaptGroqDataToCatalog(groqData) {
        try {
            // Базовая валидация
            if (!groqData || !groqData.success) {
                throw new Error('Некорректные данные от Groq парсера');
            }

            // Преобразуем данные в формат каталога
            const catalogData = {
                // Основная информация
                brand: this.extractBrand(groqData),
                model: this.extractModel(groqData),
                category: this.mapCategory(groqData.category),
                bikeType: this.mapBikeType(groqData.bikeType),
                
                // Цена и состояние
                price: this.extractPrice(groqData.price),
                originalPrice: null, // Kleinanzeigen обычно не показывает оригинальную цену
                condition: this.mapCondition(groqData.condition),
                
                // Технические характеристики
                frameSize: this.extractFrameSize(groqData.frameSize),
                year: this.extractYear(groqData),
                wheelDiameter: this.extractWheelDiameter(groqData),
                
                // Описание и особенности
                description: this.cleanDescription(groqData.description),
                title: groqData.title,
                
                // Местоположение и доставка
                location: groqData.location,
                deliveryOption: this.mapDeliveryOption(groqData.deliveryOption),
                isNegotiable: groqData.isNegotiable || false,
                
                // Изображения (пока заглушка, так как Groq не извлекает изображения)
                images: [],
                
                // Информация о продавце
                seller: this.adaptSellerInfo(groqData.seller),
                
                // Метаданные
                source: 'kleinanzeigen',
                originalUrl: groqData.url,
                addedAt: new Date().toISOString()
            };

            console.log('✅ Данные успешно адаптированы для каталога');
            return catalogData;

        } catch (error) {
            console.error('❌ Ошибка адаптации данных:', error);
            throw error;
        }
    }

    /**
     * Извлекает бренд из данных
     */
    extractBrand(groqData) {
        return groqData.brand || 'Unknown';
    }

    /**
     * Извлекает модель из данных
     */
    extractModel(groqData) {
        if (groqData.model) {
            return groqData.model;
        }
        
        // Пытаемся извлечь модель из заголовка
        if (groqData.title && groqData.brand) {
            const title = groqData.title.toLowerCase();
            const brand = groqData.brand.toLowerCase();
            const brandIndex = title.indexOf(brand);
            
            if (brandIndex !== -1) {
                const afterBrand = title.substring(brandIndex + brand.length).trim();
                const words = afterBrand.split(' ');
                if (words.length > 0 && words[0]) {
                    return words[0].charAt(0).toUpperCase() + words[0].slice(1);
                }
            }
        }
        
        return 'Model';
    }

    /**
     * Маппинг категории
     */
    mapCategory(category) {
        return this.categoryMapping[category] || 'Горный';
    }

    /**
     * Маппинг типа велосипеда
     */
    mapBikeType(bikeType) {
        return this.bikeTypeMapping[bikeType] || bikeType || '';
    }

    /**
     * Извлекает и валидирует цену
     */
    extractPrice(price) {
        if (typeof price === 'number' && price > 0) {
            return price;
        }
        
        if (typeof price === 'string') {
            const numPrice = parseFloat(price.replace(/[^\d.,]/g, '').replace(',', '.'));
            return numPrice > 0 ? numPrice : 0;
        }
        
        return 0;
    }

    /**
     * Маппинг состояния
     */
    mapCondition(condition) {
        return this.conditionMapping[condition] || condition || 'Б/у';
    }

    /**
     * Извлекает размер рамы
     */
    extractFrameSize(frameSize) {
        if (!frameSize) return 'M';
        
        // Стандартизируем размеры
        const size = frameSize.toString().toUpperCase();
        const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
        
        if (validSizes.includes(size)) {
            return size;
        }
        
        // Пытаемся найти размер в строке
        for (const validSize of validSizes) {
            if (size.includes(validSize)) {
                return validSize;
            }
        }
        
        return 'M';
    }

    /**
     * Извлекает год из данных
     */
    extractYear(groqData) {
        // Пытаемся найти год в описании или других полях
        const text = `${groqData.description || ''} ${groqData.title || ''}`;
        const yearMatch = text.match(/20\d{2}/);
        
        if (yearMatch) {
            const year = parseInt(yearMatch[0]);
            const currentYear = new Date().getFullYear();
            
            // Проверяем, что год разумный (не из будущего и не слишком старый)
            if (year >= 1990 && year <= currentYear + 1) {
                return year;
            }
        }
        
        return null;
    }

    /**
     * Извлекает диаметр колес
     */
    extractWheelDiameter(groqData) {
        const text = `${groqData.description || ''} ${groqData.title || ''}`;
        
        // Ищем стандартные размеры колес
        const wheelSizes = ['26', '27.5', '28', '29'];
        
        for (const size of wheelSizes) {
            if (text.includes(size + '"') || text.includes(size + ' ')) {
                return size + '"';
            }
        }
        
        return null;
    }

    /**
     * Очищает описание от лишней информации
     */
    cleanDescription(description) {
        if (!description) return '';
        
        // Удаляем лишние пробелы и переносы строк
        let cleaned = description.replace(/\s+/g, ' ').trim();
        
        // Ограничиваем длину описания
        if (cleaned.length > 500) {
            cleaned = cleaned.substring(0, 500) + '...';
        }
        
        return cleaned;
    }

    /**
     * Маппинг опций доставки
     */
    mapDeliveryOption(deliveryOption) {
        if (!deliveryOption) return 'available';
        
        const option = deliveryOption.toLowerCase();
        
        if (option.includes('versand') || option.includes('доставка')) {
            return 'available';
        }
        
        return 'pickup';
    }

    /**
     * Адаптирует информацию о продавце
     */
    adaptSellerInfo(seller) {
        if (!seller) {
            return {
                name: 'Неизвестно',
                type: 'Частное лицо',
                badges: [],
                memberSince: null,
                rating: null
            };
        }

        return {
            name: seller.name || 'Неизвестно',
            type: this.mapSellerType(seller.type),
            badges: Array.isArray(seller.badges) ? seller.badges : [],
            memberSince: seller.memberSince || null,
            rating: seller.rating || null
        };
    }

    /**
     * Маппинг типа продавца
     */
    mapSellerType(type) {
        const typeMapping = {
            'Privater Nutzer': 'Частное лицо',
            'Händler': 'Дилер',
            'Gewerblicher Nutzer': 'Коммерческий пользователь'
        };

        return typeMapping[type] || type || 'Частное лицо';
    }

    /**
     * Валидирует адаптированные данные
     */
    validateCatalogData(catalogData) {
        const errors = [];

        if (!catalogData.brand || catalogData.brand === 'Unknown') {
            errors.push('Отсутствует бренд');
        }

        if (!catalogData.price || catalogData.price <= 0) {
            errors.push('Некорректная цена');
        }

        if (!catalogData.category) {
            errors.push('Отсутствует категория');
        }

        if (errors.length > 0) {
            console.warn('⚠️ Предупреждения при валидации:', errors);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
}

module.exports = GroqToCatalogAdapter;