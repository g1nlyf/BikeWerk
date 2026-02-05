// BikeEU - AI Chat Widget
// Интеллектуальный помощник для подбора велосипедов

class BikeAIChat {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isTyping = false;
        
        // Предустановленные ответы для демонстрации
        this.responses = {
            greeting: [
                "Привет! Я помогу вам подобрать идеальный велосипед из Европы. Расскажите, для каких целей вам нужен велосипед?",
                "Здравствуйте! Меня зовут Анна, я консультант BikeEU. Чем могу помочь в выборе велосипеда?"
            ],
            budget: [
                "Отличный выбор! В этом ценовом диапазоне есть много качественных вариантов. Какой тип катания вас интересует больше?",
                "Понятно. Для этого бюджета я могу предложить несколько отличных моделей. Вы предпочитаете шоссейные или горные велосипеды?"
            ],
            recommendation: [
                "Исходя из ваших предпочтений, рекомендую обратить внимание на Trek Domane или Canyon Endurace. Хотите узнать подробности?",
                "Для ваших целей идеально подойдет Specialized Roubaix или Giant Defy. Могу рассказать о каждой модели подробнее."
            ],
            delivery: [
                "Доставка из Европы занимает 14-21 день. Мы берём на себя все таможенные процедуры и доставляем до двери.",
                "Стандартная доставка 2-3 недели, экспресс-доставка 10-14 дней. Все документы и растаможка включены в стоимость."
            ]
        };
        
        this.init();
    }
    
    init() {
        this.createChatWidget();
        this.bindEvents();
        this.addWelcomeMessage();
    }
    
    createChatWidget() {
        // Создаём кнопку чата
        const chatButton = document.createElement('div');
        chatButton.className = 'chat-button';
        chatButton.innerHTML = `
            <div class="chat-button-content">
                <i data-lucide="message-circle"></i>
                <span class="chat-button-text">Помощь в выборе</span>
            </div>
            <div class="chat-notification">1</div>
        `;
        
        // Создаём модальное окно чата
        const chatModal = document.createElement('div');
        chatModal.className = 'chat-modal';
        chatModal.innerHTML = `
            <div class="chat-container">
                <div class="chat-header">
                    <div class="chat-agent">
                        <div class="agent-avatar">
                            <i data-lucide="user"></i>
                        </div>
                        <div class="agent-info">
                            <h4>Анна</h4>
                            <span class="agent-status">Консультант BikeEU</span>
                        </div>
                    </div>
                    <button class="chat-close" aria-label="Закрыть чат">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                
                <div class="chat-messages" id="chat-messages">
                    <!-- Messages will be added here -->
                </div>
                
                <div class="chat-input-container">
                    <div class="chat-quick-actions">
                        <button class="quick-action" data-message="Какой велосипед лучше для города?">
                            Для города
                        </button>
                        <button class="quick-action" data-message="Сколько стоит доставка?">
                            Доставка
                        </button>
                        <button class="quick-action" data-message="Какой у вас бюджет до 200 000 рублей?">
                            Бюджет до 200к
                        </button>
                    </div>
                    
                    <div class="chat-input-wrapper">
                        <input type="text" 
                               id="chat-input" 
                               placeholder="Напишите ваш вопрос..."
                               maxlength="500">
                        <button class="chat-send" id="chat-send" aria-label="Отправить сообщение">
                            <i data-lucide="send"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(chatButton);
        document.body.appendChild(chatModal);
        
        this.chatButton = chatButton;
        this.chatModal = chatModal;
        this.messagesContainer = chatModal.querySelector('#chat-messages');
        this.chatInput = chatModal.querySelector('#chat-input');
        this.sendButton = chatModal.querySelector('#chat-send');
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
    
    bindEvents() {
        // Открытие/закрытие чата
        this.chatButton.addEventListener('click', () => this.toggleChat());
        
        const closeButton = this.chatModal.querySelector('.chat-close');
        closeButton.addEventListener('click', () => this.closeChat());
        
        // Отправка сообщений
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Быстрые действия
        const quickActions = this.chatModal.querySelectorAll('.quick-action');
        quickActions.forEach(action => {
            action.addEventListener('click', () => {
                const message = action.getAttribute('data-message');
                this.chatInput.value = message;
                this.sendMessage();
            });
        });
        
        // Закрытие при клике вне модального окна
        this.chatModal.addEventListener('click', (e) => {
            if (e.target === this.chatModal) {
                this.closeChat();
            }
        });
        
        // Автофокус на input при открытии
        this.chatModal.addEventListener('transitionend', () => {
            if (this.isOpen) {
                this.chatInput.focus();
            }
        });
    }
    
    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }
    
    openChat() {
        this.isOpen = true;
        this.chatModal.classList.add('active');
        this.chatButton.classList.add('active');
        
        // Скрываем уведомление
        const notification = this.chatButton.querySelector('.chat-notification');
        if (notification) {
            notification.style.display = 'none';
        }
        
        // Фокус на input
        setTimeout(() => {
            this.chatInput.focus();
        }, 300);
    }
    
    closeChat() {
        this.isOpen = false;
        this.chatModal.classList.remove('active');
        this.chatButton.classList.remove('active');
    }
    
    addWelcomeMessage() {
        const welcomeMessage = this.getRandomResponse('greeting');
        this.addMessage(welcomeMessage, 'bot', true);
    }
    
    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isTyping) return;
        
        // Добавляем сообщение пользователя
        this.addMessage(message, 'user');
        this.chatInput.value = '';
        
        // Показываем индикатор печати
        this.showTypingIndicator();
        
        // Генерируем ответ
        setTimeout(() => {
            this.generateResponse(message);
        }, 1000 + Math.random() * 2000); // 1-3 секунды
    }
    
    addMessage(text, sender, isWelcome = false) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${sender}-message`;
        
        if (sender === 'bot') {
            messageElement.innerHTML = `
                <div class="message-avatar">
                    <i data-lucide="user"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">${text}</div>
                    <div class="message-time">${this.getCurrentTime()}</div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="message-content">
                    <div class="message-text">${text}</div>
                    <div class="message-time">${this.getCurrentTime()}</div>
                </div>
            `;
        }
        
        this.messagesContainer.appendChild(messageElement);
        this.messages.push({ text, sender, timestamp: Date.now() });
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Анимация появления
        if (!isWelcome) {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                messageElement.style.transition = 'opacity 300ms ease, transform 300ms ease';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            }, 50);
        }
        
        this.scrollToBottom();
    }
    
    showTypingIndicator() {
        this.isTyping = true;
        
        const typingElement = document.createElement('div');
        typingElement.className = 'chat-message bot-message typing-indicator';
        typingElement.innerHTML = `
            <div class="message-avatar">
                <i data-lucide="user"></i>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        this.messagesContainer.appendChild(typingElement);
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        this.scrollToBottom();
        
        this.typingElement = typingElement;
    }
    
    hideTypingIndicator() {
        if (this.typingElement) {
            this.messagesContainer.removeChild(this.typingElement);
            this.typingElement = null;
        }
        this.isTyping = false;
    }
    
    generateResponse(userMessage) {
        this.hideTypingIndicator();
        
        const message = userMessage.toLowerCase();
        let response;
        
        // Простая логика определения типа вопроса
        if (message.includes('привет') || message.includes('здравствуй')) {
            response = this.getRandomResponse('greeting');
        } else if (message.includes('бюджет') || message.includes('цена') || message.includes('стоимость')) {
            response = this.getRandomResponse('budget');
        } else if (message.includes('доставка') || message.includes('сколько времени') || message.includes('когда')) {
            response = this.getRandomResponse('delivery');
        } else if (message.includes('рекомендуй') || message.includes('посоветуй') || message.includes('какой')) {
            response = this.getRandomResponse('recommendation');
        } else {
            // Общий ответ
            response = "Спасибо за вопрос! Для более точной консультации рекомендую связаться с нашим менеджером по телефону +7 (495) 123-45-67. Также могу помочь с расчётом стоимости доставки через калькулятор на сайте.";
        }
        
        this.addMessage(response, 'bot');
        
        // Добавляем дополнительные быстрые действия после ответа
        if (message.includes('рекомендуй') || message.includes('какой')) {
            setTimeout(() => {
                this.addQuickRecommendations();
            }, 1000);
        }
    }
    
    addQuickRecommendations() {
        const recommendationsElement = document.createElement('div');
        recommendationsElement.className = 'chat-message bot-message recommendations';
        recommendationsElement.innerHTML = `
            <div class="message-avatar">
                <i data-lucide="user"></i>
            </div>
            <div class="message-content">
                <div class="message-text">Вот несколько популярных моделей:</div>
                <div class="bike-recommendations">
                    <div class="bike-rec-item" data-bike="trek-domane">
                        <img src="https://images.unsplash.com/photo-1571068316344-75bc76f77890?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" alt="Trek Domane">
                        <div class="bike-rec-info">
                            <h5>Trek Domane SL 6</h5>
                            <p>от 350 000 ₽</p>
                        </div>
                    </div>
                    <div class="bike-rec-item" data-bike="canyon-endurace">
                        <img src="https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80" alt="Canyon Endurace">
                        <div class="bike-rec-info">
                            <h5>Canyon Endurace CF</h5>
                            <p>от 280 000 ₽</p>
                        </div>
                    </div>
                </div>
                <div class="message-time">${this.getCurrentTime()}</div>
            </div>
        `;
        
        this.messagesContainer.appendChild(recommendationsElement);
        
        // Initialize Lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
        
        // Bind click events for recommendations
        const recItems = recommendationsElement.querySelectorAll('.bike-rec-item');
        recItems.forEach(item => {
            item.addEventListener('click', () => {
                const bikeId = item.getAttribute('data-bike');
                this.handleBikeRecommendationClick(bikeId);
            });
        });
        
        this.scrollToBottom();
    }
    
    handleBikeRecommendationClick(bikeId) {
        const bikeInfo = {
            'trek-domane': 'Trek Domane SL 6 - отличный выбор для длительных поездок. Карбоновая рама, Shimano 105, вес 8.5 кг. Хотите узнать больше или рассчитать стоимость доставки?',
            'canyon-endurace': 'Canyon Endurace CF - идеален для комфортного катания. Карбон, Shimano Ultegra, аэродинамичная геометрия. Могу помочь с оформлением заказа!'
        };
        
        const response = bikeInfo[bikeId] || 'Отличный выбор! Хотите узнать подробности об этой модели?';
        this.addMessage(response, 'bot');
    }
    
    getRandomResponse(category) {
        const responses = this.responses[category];
        return responses[Math.floor(Math.random() * responses.length)];
    }
    
    getCurrentTime() {
        return new Date().toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }
}

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    new BikeAIChat();
});