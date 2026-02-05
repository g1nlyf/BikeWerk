// Shared bikes database for EUBike application
class BikesDatabase {
    constructor() {
        this.bikes = [];
        this.categories = ['Горный', 'Шоссейный', 'Городской', 'Электро', 'BMX', 'Детский'];
        this.brands = ['trek', 'specialized', 'giant', 'cannondale', 'scott', 'merida', 'cube', 'bianchi'];
        this.sizes = ['XS', 'S', 'M', 'L', 'XL'];
        this.seed = 12345; // Fixed seed for consistent data generation
        this.images = [
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
            'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400',
            'https://images.unsplash.com/photo-1544191696-15693072b5a7?w=400',
            'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400',
            'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400',
            'https://images.unsplash.com/photo-1502744688674-c619d1586c9e?w=400',
            'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400',
            'https://images.unsplash.com/photo-1544191696-15693072b5a7?w=400'
        ];
        this.bikeNames = {
            'Горный': ['Mountain Pro', 'Trail Master', 'Peak Rider', 'Rock Crusher', 'Alpine Beast'],
            'Шоссейный': ['Road Racer', 'Speed Demon', 'Aero Elite', 'Carbon Flash', 'Wind Cutter'],
            'Городской': ['City Cruiser', 'Urban Rider', 'Metro Glide', 'Street Smart', 'Town Explorer'],
            'Электро': ['E-Power', 'Electric Glide', 'Volt Rider', 'Battery Beast', 'Eco Cruiser'],
            'BMX': ['Stunt Master', 'Trick Pro', 'Jump King', 'Street Warrior', 'Park Rider'],
            'Детский': ['Little Explorer', 'Kid Cruiser', 'Junior Rider', 'Mini Adventure', 'Young Cyclist']
        };
        
        this.loadBikes();
    }

    async loadBikes() {
        console.log('🔄 Генерация данных велосипедов...');
        this.generateBikes();
        console.log(`✅ Сгенерировано ${this.bikes.length} велосипедов (обновлено: ${new Date().toLocaleTimeString()})`);
        console.log('🔍 Первые 3 велосипеда:', this.bikes.slice(0, 3).map(b => `${b.id}: ${b.name}`));
        console.log('🔍 Последние 3 велосипеда:', this.bikes.slice(-3).map(b => `${b.id}: ${b.name}`));
    }

    // Seeded random number generator for consistent data
    seededRandom() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    generateBikes() {
        for (let i = 0; i < 50; i++) {
            const category = this.categories[Math.floor(this.seededRandom() * this.categories.length)];
            const brand = this.brands[Math.floor(this.seededRandom() * this.brands.length)];
            const size = this.sizes[Math.floor(this.seededRandom() * this.sizes.length)];
            const nameOptions = this.bikeNames[category];
            const name = nameOptions[Math.floor(this.seededRandom() * nameOptions.length)];
            
            const basePrice = Math.floor(this.seededRandom() * 3000) + 300;
            const discount = this.seededRandom() > 0.7 ? Math.floor(this.seededRandom() * 30) + 10 : 0;
            const currentPrice = discount > 0 ? Math.floor(basePrice * (1 - discount / 100)) : basePrice;
            
            const bike = {
                id: i + 1,
                name: `${brand.charAt(0).toUpperCase() + brand.slice(1)} ${name}`,
                category: category,
                brand: brand,
                size: size,
                price: currentPrice,
                originalPrice: discount > 0 ? basePrice : null,
                discount: discount,
                image: this.images[Math.floor(this.seededRandom() * this.images.length)],
                specs: this.generateSpecs(category),
                isNew: this.seededRandom() > 0.8,
                isFavorite: false,
                rating: (this.seededRandom() * 2 + 3).toFixed(1), // 3.0 - 5.0
                reviews: Math.floor(this.seededRandom() * 200) + 10,
                reviewCount: Math.floor(this.seededRandom() * 200) + 10,
                description: this.generateDescription(category, brand, name),
                features: this.generateFeatures(category),
                deliveryInfo: this.generateDeliveryInfo(),
                warranty: this.generateWarranty(category)
            };
            
            this.bikes.push(bike);
        }
    }

    generateSpecs(category) {
        const baseSpecs = [
            { label: 'Размер рамы', value: this.sizes[Math.floor(this.seededRandom() * this.sizes.length)] },
            { label: 'Вес', value: `${(this.seededRandom() * 5 + 10).toFixed(1)} кг` },
            { label: 'Количество скоростей', value: `${Math.floor(this.seededRandom() * 20) + 1}` }
        ];

        switch (category) {
            case 'Горный':
                return [...baseSpecs,
                    { label: 'Тип подвески', value: 'Передняя' },
                    { label: 'Диаметр колес', value: '29"' },
                    { label: 'Материал рамы', value: 'Алюминий' },
                    { label: 'Тормоза', value: 'Дисковые гидравлические' },
                    { label: 'Ход подвески', value: '120 мм' }
                ];
            case 'Шоссейный':
                return [...baseSpecs,
                    { label: 'Тип рамы', value: 'Аэродинамическая' },
                    { label: 'Диаметр колес', value: '700c' },
                    { label: 'Материал рамы', value: 'Карбон' },
                    { label: 'Тормоза', value: 'Дисковые' },
                    { label: 'Ширина покрышек', value: '25 мм' }
                ];
            case 'Городской':
                return [...baseSpecs,
                    { label: 'Тип рамы', value: 'Комфортная' },
                    { label: 'Диаметр колес', value: '28"' },
                    { label: 'Материал рамы', value: 'Сталь' },
                    { label: 'Тормоза', value: 'V-brake' },
                    { label: 'Корзина', value: 'Включена' }
                ];
            case 'Электро':
                return [...baseSpecs,
                    { label: 'Мотор', value: '250W' },
                    { label: 'Батарея', value: '36V 10Ah' },
                    { label: 'Запас хода', value: '60 км' },
                    { label: 'Время зарядки', value: '4-6 часов' },
                    { label: 'Вес', value: '22 кг' }
                ];
            case 'BMX':
                return [...baseSpecs,
                    { label: 'Диаметр колес', value: '20"' },
                    { label: 'Материал рамы', value: 'Хромоль' },
                    { label: 'Тип рамы', value: 'Freestyle' },
                    { label: 'Пеги', value: 'Включены' }
                ];
            case 'Детский':
                return [...baseSpecs,
                    { label: 'Возраст', value: '6-12 лет' },
                    { label: 'Диаметр колес', value: '20"' },
                    { label: 'Дополнительные колеса', value: 'Съемные' },
                    { label: 'Защита цепи', value: 'Полная' }
                ];
            default:
                return baseSpecs;
        }
    }

    generateDescription(category, brand, name) {
        const descriptions = {
            'Горный': `Этот ${brand} ${name} создан для покорения самых сложных горных троп. Прочная рама и надежная подвеска обеспечивают отличную проходимость по любому рельефу.`,
            'Шоссейный': `${brand} ${name} - это воплощение скорости и аэродинамики. Легкая карбоновая рама и профессиональные компоненты делают его идеальным для шоссейных гонок.`,
            'Городской': `Комфортный ${brand} ${name} идеально подходит для ежедневных поездок по городу. Удобная посадка и практичные аксессуары делают каждую поездку приятной.`,
            'Электро': `${brand} ${name} сочетает в себе традиционную езду на велосипеде с современными электрическими технологиями. Мощный мотор поможет преодолеть любые расстояния.`,
            'BMX': `${brand} ${name} создан для экстремальных трюков и фристайла. Прочная конструкция выдержит самые смелые маневры в скейт-парке.`,
            'Детский': `${brand} ${name} - безопасный и надежный велосипед для юных велосипедистов. Яркий дизайн и продуманная конструкция обеспечат радость от катания.`
        };
        return descriptions[category] || 'Качественный велосипед для активного отдыха.';
    }

    generateFeatures(category) {
        const commonFeatures = [
            'Качественная сборка',
            'Гарантия производителя',
            'Сертифицированные компоненты'
        ];

        const categoryFeatures = {
            'Горный': ['Амортизационная вилка', 'Агрессивный протектор', 'Защита звезд'],
            'Шоссейный': ['Аэродинамическая рама', 'Легкие колеса', 'Профессиональная трансмиссия'],
            'Городской': ['Комфортное седло', 'Защита цепи', 'Светоотражатели'],
            'Электро': ['Съемная батарея', 'LED дисплей', 'Режимы помощи'],
            'BMX': ['Усиленная рама', 'Пеги для трюков', 'Поворотный руль'],
            'Детский': ['Дополнительные колеса', 'Яркий дизайн', 'Безопасные материалы']
        };

        return [...commonFeatures, ...(categoryFeatures[category] || [])];
    }

    generateDeliveryInfo() {
        return {
            freeDelivery: this.seededRandom() > 0.3,
            deliveryTime: `${Math.floor(this.seededRandom() * 5) + 1}-${Math.floor(this.seededRandom() * 3) + 3} дней`,
            assembly: this.seededRandom() > 0.5,
            pickup: true
        };
    }

    generateWarranty(category) {
        const warranties = {
            'Горный': '2 года на раму, 1 год на компоненты',
            'Шоссейный': '3 года на раму, 1 год на компоненты',
            'Городской': '2 года на раму, 6 месяцев на компоненты',
            'Электро': '2 года на раму, 1 год на электронику',
            'BMX': '1 год на раму, 6 месяцев на компоненты',
            'Детский': '1 год на раму, 6 месяцев на компоненты'
        };
        return warranties[category] || '1 год гарантии';
    }

    // Public methods
    getAllBikes() {
        return this.bikes;
    }

    getBikeById(id) {
        return this.bikes.find(bike => bike.id === parseInt(id));
    }

    getBikesByCategory(category) {
        return this.bikes.filter(bike => bike.category === category);
    }

    getBikesByBrand(brand) {
        return this.bikes.filter(bike => bike.brand === brand);
    }

    searchBikes(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.bikes.filter(bike => 
            bike.name.toLowerCase().includes(lowercaseQuery) ||
            bike.category.toLowerCase().includes(lowercaseQuery) ||
            bike.brand.toLowerCase().includes(lowercaseQuery)
        );
    }

    getCategories() {
        return this.categories;
    }

    getBrands() {
        return this.brands;
    }

    // Методы для добавления новых велосипедов (для Telegram бота)
    addBike(bikeData) {
        // Генерируем новый ID
        const newId = Math.max(...this.bikes.map(bike => bike.id), 0) + 1;
        
        // Создаем объект велосипеда с полной структурой
        const newBike = {
            id: newId,
            name: `${bikeData.brand || 'Unknown'} ${bikeData.model || 'Model'}`,
            category: this.mapCategory(bikeData.category),
            brand: (bikeData.brand || 'unknown').toLowerCase(),
            size: bikeData.frameSize || 'M',
            price: bikeData.price || 0,
            originalPrice: bikeData.originalPrice || null,
            discount: bikeData.originalPrice && bikeData.price ? 
                Math.round((1 - bikeData.price / bikeData.originalPrice) * 100) : 0,
            image: bikeData.images && bikeData.images.length > 0 ? 
                bikeData.images[0] : this.getDefaultImage(bikeData.category),
            images: bikeData.images && bikeData.images.length > 0 ? 
                bikeData.images : [this.getDefaultImage(bikeData.category)],
            specs: this.generateSpecsFromData(bikeData),
            isNew: bikeData.condition === 'Новый' || bikeData.condition === 'Как новый',
            isFavorite: false,
            rating: (Math.random() * 2 + 3).toFixed(1), // 3.0 - 5.0
            reviews: Math.floor(Math.random() * 50) + 5,
            reviewCount: Math.floor(Math.random() * 50) + 5,
            description: bikeData.description || this.generateDescription(bikeData.category, bikeData.brand, bikeData.model),
            features: this.generateFeatures(this.mapCategory(bikeData.category)),
            deliveryInfo: bikeData.deliveryOption === 'available' ? 
                this.generateDeliveryInfo() : { available: false, text: 'Только самовывоз' },
            warranty: this.generateWarranty(this.mapCategory(bikeData.category)),
            // Дополнительные поля для велосипедов из Telegram бота
            source: 'telegram-bot',
            originalUrl: bikeData.originalUrl,
            location: bikeData.location,
            condition: bikeData.condition,
            isNegotiable: bikeData.isNegotiable || false,
            dateAdded: new Date().toISOString()
        };

        // Добавляем велосипед в массив
        this.bikes.push(newBike);
        
        // Обновляем глобальные данные
        if (typeof window !== 'undefined') {
            window.bikesData = this.bikes;
        }

        console.log(`✅ Велосипед добавлен в базу данных: ID ${newId}, ${newBike.name}`);
        return newBike;
    }

    mapCategory(category) {
        // Маппинг категорий из Gemini API в категории системы
        const categoryMap = {
            'Горный': 'Горный',
            'Шоссейный': 'Шоссейный', 
            'Городской': 'Городской',
            'Электро': 'Электро',
            'BMX': 'BMX',
            'Детский': 'Детский'
        };
        
        return categoryMap[category] || 'Городской';
    }

    getDefaultImage(category) {
        // Возвращаем изображение по умолчанию в зависимости от категории
        const defaultImages = {
            'Горный': 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400',
            'Шоссейный': 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400',
            'Городской': 'https://images.unsplash.com/photo-1544191696-15693072b5a7?w=400',
            'Электро': 'https://images.unsplash.com/photo-1502744688674-c619d1586c9e?w=400',
            'BMX': 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400',
            'Детский': 'https://images.unsplash.com/photo-1544191696-15693072b5a7?w=400'
        };
        
        return defaultImages[category] || defaultImages['Городской'];
    }

    generateSpecsFromData(bikeData) {
        const baseSpecs = [
            { label: 'Бренд', value: bikeData.brand || 'Не указан' },
            { label: 'Модель', value: bikeData.model || 'Не указана' },
            { label: 'Год выпуска', value: bikeData.year ? bikeData.year.toString() : 'Не указан' },
            { label: 'Размер рамы', value: bikeData.frameSize || 'Не указан' },
            { label: 'Диаметр колес', value: bikeData.wheelDiameter || 'Не указан' },
            { label: 'Состояние', value: bikeData.condition || 'Не указано' },
            { label: 'Местоположение', value: bikeData.location || 'Не указано' }
        ];

        // Добавляем специфичные для категории характеристики
        const category = this.mapCategory(bikeData.category);
        const categorySpecs = this.generateSpecs(category);
        
        // Объединяем базовые характеристики с категорийными
        return [...baseSpecs, ...categorySpecs.slice(3)]; // Пропускаем первые 3 базовые характеристики
    }

    removeBike(bikeId) {
        const index = this.bikes.findIndex(bike => bike.id === parseInt(bikeId));
        if (index !== -1) {
            const removedBike = this.bikes.splice(index, 1)[0];
            
            // Обновляем глобальные данные
            if (typeof window !== 'undefined') {
                window.bikesData = this.bikes;
            }
            
            console.log(`🗑️ Велосипед удален из базы данных: ${removedBike.name}`);
            return removedBike;
        }
        return null;
    }

    updateBike(bikeId, updateData) {
        const bike = this.getBikeById(bikeId);
        if (bike) {
            Object.assign(bike, updateData);
            
            // Обновляем глобальные данные
            if (typeof window !== 'undefined') {
                window.bikesData = this.bikes;
            }
            
            console.log(`📝 Велосипед обновлен: ${bike.name}`);
            return bike;
        }
        return null;
    }

    getBikesBySource(source) {
        return this.bikes.filter(bike => bike.source === source);
    }

    getTelegramBikes() {
        return this.getBikesBySource('telegram-bot');
    }

    // Метод для принудительного обновления данных
    async reloadBikes() {
        console.log('🔄 Принудительное обновление данных велосипедов...');
        this.bikes = []; // Очищаем текущие данные
        await this.loadBikes();
        
        // Уведомляем каталог об обновлении данных
        if (window.catalog && typeof window.catalog.loadBikes === 'function') {
            await window.catalog.loadBikes();
        }
        
        return this.bikes;
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.bikesDB = new BikesDatabase();

    // Initialize bikes data asynchronously
    (async () => {
        await window.bikesDB.loadBikes();
        window.bikesData = window.bikesDB.getAllBikes();
        console.log('🚀 База данных велосипедов инициализирована');
    })();

    // Автоматическое обновление данных при возвращении фокуса на страницу
    let lastFocusTime = Date.now();
    window.addEventListener('focus', async () => {
        const now = Date.now();
        // Обновляем данные только если прошло более 5 секунд с последнего фокуса
        if (now - lastFocusTime > 5000) {
            console.log('🔄 Страница получила фокус, проверяем обновления...');
            await window.bikesDB.reloadBikes();
        }
        lastFocusTime = now;
    });
} else {
    // Node.js environment support
    module.exports = BikesDatabase;
}

// Обновление данных при событии visibilitychange (когда пользователь возвращается на вкладку)
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', async () => {
        if (!document.hidden) {
            const now = Date.now();
            if (now - lastFocusTime > 5000) {
                console.log('🔄 Вкладка стала активной, проверяем обновления...');
                await window.bikesDB.reloadBikes();
                lastFocusTime = now;
            }
        }
    });
}

// Export for potential use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BikesDatabase;
}