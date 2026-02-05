// ========================================
// 🚀 CRM API СЛОЙ ДЛЯ EUBIKE
// Версия: 2.2 - Updated at 2024-12-25 (Canonical Alignment)
// ========================================

class CRMApi {
    constructor(supabaseUrl, supabaseKey, db = null) {
        this.supabaseUrl = supabaseUrl;
        this.supabaseKey = supabaseKey;
        this.db = db; // Local database driver if available (SQLite)
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Prefer': 'return=representation',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        };
        
        // Инициализация Supabase JavaScript клиента
        if (typeof window !== 'undefined' && window.supabase) {
            this.supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            console.log('✅ Supabase клиент инициализирован (Browser)');
        } else if (supabaseUrl && supabaseKey) {
            try {
                const { createClient } = require('@supabase/supabase-js');
                this.supabase = createClient(supabaseUrl, supabaseKey);
                console.log('✅ Supabase клиент инициализирован (Node.js)');
            } catch (e) {
                console.warn('⚠️ Ошибка инициализации Supabase (Node.js):', e.message);
            }
        } else if (!this.db) {
            console.warn('⚠️ Supabase JavaScript библиотека не найдена и локальная БД не указана');
        }
        
        this.tables = {
            applications: 'leads',
            orders: 'orders', // Используем каноническое имя таблицы 'orders'
            finances: 'payments',
            logistics: 'shipments',
            employees: 'users',
            orderHistory: 'order_status_events',
            customers: 'customers',
            auditLog: 'audit_log',
            documents: 'documents',
            tasks: 'tasks'
        };
    }

    // Вспомогательный метод для выполнения запросов (локально или через API)
    async _request(options) {
        const { table, method, body, filters = {}, select = '*' } = options;
        const tableName = this.tables[table] || table;

        if (this.db) {
            // ЛОКАЛЬНЫЙ РЕЖИМ (SQLite)
            try {
                if (method === 'POST') {
                    const keys = Object.keys(body);
                    const placeholders = keys.map(() => '?').join(', ');
                    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
                    const params = keys.map(k => {
                        const val = body[k];
                        return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
                    });
                    console.log(`[DB DEBUG] Executing: ${sql}`);
                    console.log(`[DB DEBUG] Params: ${JSON.stringify(params)}`);
                    const result = await this.db.query(sql, params);
                    console.log(`[DB DEBUG] Result: ${JSON.stringify(result)}`);
                    return body;
                } 
                
                if (method === 'GET') {
                    let sql = `SELECT ${select} FROM ${tableName}`;
                    const params = [];
                    const filterKeys = Object.keys(filters);
                    if (filterKeys.length > 0) {
                        const whereClauses = filterKeys.map(k => {
                            const filterVal = String(filters[k]);
                            if (filterVal.startsWith('eq.')) {
                                params.push(filterVal.slice(3));
                                return `${k} = ?`;
                            }
                            if (filterVal.startsWith('gte.')) {
                                params.push(filterVal.slice(4));
                                return `${k} >= ?`;
                            }
                            if (filterVal.startsWith('lte.')) {
                                params.push(filterVal.slice(4));
                                return `${k} <= ?`;
                            }
                            if (filterVal.startsWith('gt.')) {
                                params.push(filterVal.slice(3));
                                return `${k} > ?`;
                            }
                            if (filterVal.startsWith('lt.')) {
                                params.push(filterVal.slice(3));
                                return `${k} < ?`;
                            }
                            if (filterVal.startsWith('like.')) {
                                params.push(filterVal.slice(5));
                                return `${k} LIKE ?`;
                            }
                            // По умолчанию eq
                            params.push(filterVal);
                            return `${k} = ?`;
                        });
                        sql += ` WHERE ${whereClauses.join(' AND ')}`;
                    }
                    
                    // Добавляем сортировку по умолчанию, если это история или логи
                    if (tableName === 'order_status_events' || tableName === 'audit_log') {
                        sql += ' ORDER BY created_at DESC';
                    }

                    return await this.db.query(sql, params);
                }

                if (method === 'PATCH') {
                    const keys = Object.keys(body);
                    const setClause = keys.map(k => `${k} = ?`).join(', ');
                    const filterKeys = Object.keys(filters);
                    let sql = `UPDATE ${tableName} SET ${setClause}`;
                    const params = keys.map(k => {
                        const val = body[k];
                        return (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
                    });
                    
                    if (filterKeys.length > 0) {
                        const whereClauses = filterKeys.map(k => {
                            const filterVal = String(filters[k]);
                            if (filterVal.startsWith('eq.')) {
                                params.push(filterVal.slice(3));
                                return `${k} = ?`;
                            }
                            params.push(filterVal);
                            return `${k} = ?`;
                        });
                        sql += ` WHERE ${whereClauses.join(' AND ')}`;
                    }
                    await this.db.query(sql, params);
                    return { success: true };
                }
            } catch (error) {
                console.error(`Local DB Error (${method} ${tableName}):`, error);
                throw error;
            }
        }

        // РЕЖИМ API (Supabase)
        if (!this.supabaseUrl) {
            console.warn('⚠️ Supabase URL не задан, запрос пропущен:', method, tableName);
            return method === 'GET' ? [] : { success: false, error: 'NO_DATABASE' };
        }
        
        let url = `${this.supabaseUrl}/rest/v1/${tableName}`;
        
        const fetchOptions = {
            method,
            headers: this.headers
        };

        if (method === 'GET') {
            url += `?select=${encodeURIComponent(select)}`;
            Object.keys(filters).forEach(k => {
                url += `&${k}=${encodeURIComponent(filters[k])}`;
            });
        } else if (filters.id) {
            // Для PATCH/DELETE по ID
            url += `?id=${encodeURIComponent(filters.id)}`;
        }

        if (body) {
            fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error: ${response.status} ${text}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    // ========================================
    // 🛡️ АУДИТ И БЕЗОПАСНОСТЬ
    // ========================================

    async logAudit(action, entity, entityId, payload = {}, actorId = null) {
        try {
            const auditData = {
                id: this.generateUUID(),
                actor_id: actorId,
                action: action,
                entity: entity,
                entity_id: entityId,
                payload: payload,
                created_at: new Date().toISOString()
            };

            await this._request({
                table: 'auditLog',
                method: 'POST',
                body: auditData
            });
        } catch (error) {
            console.error('Ошибка записи в аудит-лог:', error);
        }
    }

    async callRpc(functionName, params = {}) {
        try {
            const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(params)
            });

            const text = await response.text();

            if (!response.ok) {
                throw new Error(`RPC ${functionName} failed: ${response.status} ${text}`);
            }

            if (!text || !text.trim()) {
                return null;
            }

            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        } catch (error) {
            console.error('RPC error:', functionName, error);
            throw error;
        }
    }

    // ========================================
    // 🔍 SPRINT 1: QUALITY CONTROL LOGIC
    // ========================================

    async evaluateFinalQuality(orderId) {
        try {
            console.log('🔍 Evaluating final quality for order:', orderId);
            
            // 1. Get Order and linked Bike
            let order = null;
            if (this.db) {
                const orders = await this._request({
                    table: 'orders',
                    method: 'GET',
                    filters: { id: `eq.${orderId}` }
                });
                order = orders[0];
            } else {
                 const { data } = await this.supabase
                    .from('orders')
                    .select('*, bikes(*)')
                    .eq('id', orderId)
                    .single();
                 order = data;
                 // Flatten structure if needed or handle logic below
            }

            if (!order) throw new Error('Order not found');

            let bike = null;
            if (order.bike_id) {
                if (this.db) {
                    const bikes = await this._request({
                        table: 'bikes', // Assuming bikes is accessible via _request if mapped, otherwise raw query
                        method: 'GET',
                        filters: { id: `eq.${order.bike_id}` } // This might fail if table map is incomplete
                    });
                     // _request uses 'this.tables', need to map 'bikes'
                    if (!this.tables.bikes) this.tables.bikes = 'bikes';
                    const bikesRes = await this._request({
                        table: 'bikes',
                        method: 'GET',
                        filters: { id: `eq.${order.bike_id}` }
                    });
                    bike = bikesRes[0];
                } else if (order.bikes) {
                    bike = order.bikes;
                } else {
                     // Fetch bike from supabase if not expanded
                     const { data } = await this.supabase
                        .from('bikes')
                        .select('*')
                        .eq('id', order.bike_id)
                        .single();
                     bike = data;
                }
            }

            if (!bike) {
                console.warn('⚠️ No bike linked to order, cannot evaluate quality');
                return { success: false, reason: 'NO_BIKE' };
            }

            const initial = bike.initial_quality_class;
            const finalClass = bike.final_quality_class;

            console.log(`📊 Quality Check: ${initial} -> ${finalClass}`);

            if (!initial || !finalClass) {
                 console.log('⏳ Quality classes not fully set yet');
                 return { success: true, status: 'pending_data' };
            }

            // Logic:
            // Degradation: A->B, A->C, B->C
            // Confirmation: A->A, B->B, C->C, B->A (improvement)
            
            const qualityMap = { 'A': 3, 'B': 2, 'C': 1 };
            const valInit = qualityMap[initial] || 0;
            const valFinal = qualityMap[finalClass] || 0;

            let newStatus = 'quality_confirmed';
            let isRefundable = 0;

            if (valFinal < valInit) {
                // Degradation
                newStatus = 'quality_degraded';
                isRefundable = 1;
            } else {
                // Same or better
                newStatus = 'quality_confirmed';
                isRefundable = 0;
            }

            // Update Order
            await this.updateOrderStatus(orderId, newStatus, `Quality evaluated: ${initial} -> ${finalClass}`, 'system');
            
            // Update is_refundable flag
            await this._request({
                table: 'orders',
                method: 'PATCH',
                body: { is_refundable: isRefundable },
                filters: { id: `eq.${orderId}` }
            });

            console.log(`✅ Order ${orderId} updated: status=${newStatus}, refundable=${isRefundable}`);
            return { success: true, status: newStatus, is_refundable: !!isRefundable };

        } catch (error) {
            console.error('Error evaluating quality:', error);
            throw error;
        }
    }

    // ========================================
    // 👤 КЛИЕНТЫ (CUSTOMERS)
    // ========================================

    async findOrCreateCustomer(customerData) {
        try {
            const { full_name, phone, email, contact_value, contact_method } = customerData;
            
            // Пробуем найти существующего клиента по телефону, email или contact_value
            const filters = {};
            
            // Определяем, что искать
            const searchPhone = phone || (contact_method === 'phone' ? contact_value : null) || (contact_method === 'telegram' ? contact_value : null);
            const searchEmail = email || (contact_method === 'email' ? contact_value : null);

            if (searchPhone && searchEmail) {
                // В SQLite/Supabase API фильтрация 'or' отличается. 
                // Для простоты в локальном режиме ищем сначала по одному, потом по другому.
                const byPhone = await this._request({
                    table: 'customers',
                    method: 'GET',
                    filters: { phone: `eq.${searchPhone}` }
                });
                if (byPhone && byPhone.length > 0) return byPhone[0];

                const byEmail = await this._request({
                    table: 'customers',
                    method: 'GET',
                    filters: { email: `eq.${searchEmail}` }
                });
                if (byEmail && byEmail.length > 0) return byEmail[0];
            } else if (searchPhone) {
                filters.phone = `eq.${searchPhone}`;
            } else if (searchEmail) {
                filters.email = `eq.${searchEmail}`;
            }

            if (Object.keys(filters).length > 0) {
                const customers = await this._request({
                    table: 'customers',
                    method: 'GET',
                    filters
                });
                if (customers && customers.length > 0) {
                    console.log('✅ Найден существующий клиент:', customers[0].id);
                    return customers[0];
                }
            }

            return await this.createCustomer(customerData);
        } catch (error) {
            console.error('Ошибка поиска/создания клиента:', error);
            throw error;
        }
    }

    async createCustomer(customerData) {
        try {
            // ID генерируется базой данных (или используем дефолт)
            const requestData = {
                full_name: customerData.full_name || customerData.customer_name || 'Anonymous',
                phone: customerData.phone || customerData.contact_value || null,
                email: customerData.email || null,
                preferred_channel: customerData.preferred_channel || 'telegram',
                country: customerData.country || null,
                created_at: new Date().toISOString()
            };

            const result = await this._request({
                table: 'customers',
                method: 'POST',
                body: requestData
            });

            const created = Array.isArray(result) ? result[0] : result;
            return created;
        } catch (error) {
            console.error('Ошибка в createCustomer:', error);
            throw error;
        }
    }

    // ========================================
    // 📋 ЗАЯВКИ / ЛИДЫ (LEADS)
    // ========================================

    // Создать новую заявку (Lead)
    async createApplication(applicationData) {
        try {
            console.log('🔄 Начинаем создание лида...');
            
            // 1. Обеспечиваем наличие клиента
            let customerId = applicationData.customer_id;
            if (!customerId) {
                const customer = await this.findOrCreateCustomer({
                    full_name: applicationData.customer_name,
                    phone: applicationData.contact_method === 'phone' ? applicationData.contact_value : null,
                    email: applicationData.contact_method === 'email' ? applicationData.contact_value : null,
                    ...applicationData
                });
                customerId = customer.id;
            }

            // 2. Подготавливаем данные лида согласно SQL Schema
            const requestData = {
                // ID генерируется БД
                source: applicationData.source || 'website',
                customer_id: customerId,
                bike_url: applicationData.bike_url || null,
                bike_snapshot: applicationData.bike_snapshot || null,
                customer_comment: applicationData.application_notes || applicationData.customer_comment || applicationData.notes || null,
                estimated_budget_eur: applicationData.estimated_budget_eur || null,
                status: applicationData.status || 'new',
                created_at: new Date().toISOString()
            };
            
            if (applicationData.id) {
                requestData.id = applicationData.id;
            }
            
            const result = await this._request({
                table: 'applications',
                method: 'POST',
                body: requestData
            });

            const created = Array.isArray(result) ? result[0] : result;
            const createdId = created?.id || requestData.id;

            // Логируем создание лида
            await this.logAudit('create', 'leads', createdId, requestData, applicationData.user_id || null);

            return created;
        } catch (error) {
            console.error('💥 Ошибка создания лида:', error);
            throw error;
        }
    }

    // Получить все заявки
    async getApplications(filters = {}) {
        try {
            const apiFilters = {};
            if (filters.status) apiFilters.status = `eq.${filters.status}`;
            if (filters.source) apiFilters.source = `eq.${filters.source}`;
            if (filters.customer_id) apiFilters.customer_id = `eq.${filters.customer_id}`;

            return await this._request({
                table: 'applications',
                method: 'GET',
                filters: apiFilters
            });
        } catch (error) {
            console.error('Ошибка получения заявок:', error);
            throw error;
        }
    }

    async updateApplication(applicationId, updateData) {
        try {
            const payload = updateData || {};
            const { status, ...rest } = payload;
            const actorId = payload.changed_by || payload.user_id || null;

            if (typeof status !== 'undefined') {
                if (!actorId) {
                    throw new Error('CRM_USER_ID_REQUIRED');
                }
                // Проверяем существование RPC функции перед вызовом или используем обычный PATCH
                if (!this.db) {
                    try {
                        await this.callRpc('advance_lead_status_safe', {
                            p_lead_id: applicationId,
                            p_new_status: status,
                            p_user_id: actorId,
                            p_reason: null,
                            p_notes: payload.status_note || null
                        });
                    } catch (rpcError) {
                        console.warn('RPC advance_lead_status_safe failed, falling back to PATCH:', rpcError.message);
                        await this._request({
                            table: 'applications',
                            method: 'PATCH',
                            body: { status },
                            filters: { id: `eq.${applicationId}` }
                        });
                    }
                } else {
                    // В локальном режиме просто PATCH
                    await this._request({
                        table: 'applications',
                        method: 'PATCH',
                        body: { status },
                        filters: { id: `eq.${applicationId}` }
                    });
                }
            }

            // Фильтруем поля, оставляя только канонические для таблицы leads
            const canonicalFields = ['source', 'customer_id', 'bike_url', 'bike_snapshot', 'customer_comment', 'estimated_budget_eur', 'status'];
            const filteredRest = {};
            Object.keys(rest).forEach(key => {
                if (canonicalFields.includes(key)) {
                    filteredRest[key] = rest[key];
                }
            });

            if (Object.keys(filteredRest).length === 0) {
                return { success: true };
            }

            await this._request({
                table: 'applications',
                method: 'PATCH',
                body: filteredRest,
                filters: { id: `eq.${applicationId}` }
            });

            return { success: true };
        } catch (error) {
            console.error('Ошибка обновления заявки:', error);
            throw error;
        }
    }

    // ========================================
    // 📦 ЗАКАЗЫ (ORDERS)
    // ========================================

    // Генерация номера заказа
    async generateOrderNumber() {
        try {
            const today = new Date();
            const datePrefix = today.getFullYear().toString().slice(-2) + 
                             String(today.getMonth() + 1).padStart(2, '0') + 
                             String(today.getDate()).padStart(2, '0');
            
            // Получаем количество заказов за сегодня
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
            const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
            
            const todayOrders = await this._request({
                table: 'orders',
                method: 'GET',
                filters: { created_at: `gte.${todayStart}` }
            });
            
            const orderCount = (todayOrders ? todayOrders.length : 0) + 1;
            return `ORD-${datePrefix}-${String(orderCount).padStart(3, '0')}`;
        } catch (error) {
            console.error('Ошибка генерации номера заказа:', error);
            return `ORD-${Date.now()}`;
        }
    }

    async syncOrderToSupabase(orderId) {
        if (this.db) {
            console.log('⚠️ Syncing local order to Supabase:', orderId);
            try {
                // Get full order data
                const order = await this.getOrderById(orderId);
                if (!order) return;

                // Sync via dedicated service
                const supabaseService = require('../src/services/supabase');
                if (supabaseService.enabled) {
                    // Fetch customer data
                    const customers = await this._request({
                        table: 'customers',
                        method: 'GET',
                        filters: { id: `eq.${order.customer_id}` }
                    });
                    
                    if (customers && customers[0]) {
                        await supabaseService.syncOrder(order, customers[0]);
                    }
                }
            } catch (e) {
                console.error('Supabase Sync Failed:', e.message);
            }
        }
    }

    // Создать заказ
    async createOrder(orderData) {
        try {
            // ... (existing code)
            
            // 1. Обеспечиваем наличие клиента, если его еще нет
            let customerId = orderData.customer_id;
            if (!customerId && (orderData.customer_name || orderData.contact_value)) {
                const customer = await this.findOrCreateCustomer({
                    full_name: orderData.customer_name,
                    phone: orderData.contact_method === 'phone' ? orderData.contact_value : null,
                    email: orderData.contact_method === 'email' ? orderData.contact_value : null,
                    ...orderData
                });
                customerId = customer.id;
            }

            // 2. Подготавливаем данные заказа согласно SQL Schema
            const orderCode = orderData.order_code || orderData.order_number || await this.generateOrderNumber();
            const requestData = {
                id: this.generateUUID(), // Use UUID for Primary Key (Supabase requires uuid type)
                order_code: orderCode,
                customer_id: customerId || null,
                lead_id: orderData.lead_id || null,
                bike_id: orderData.bike_id || null, // New field for Sprint 1
                bike_url: orderData.bike_url || null,
                bike_snapshot: orderData.bike_snapshot || null,
                final_price_eur: orderData.final_price_eur || null,
                commission_eur: orderData.commission_eur || null,
                status: orderData.status || 'awaiting_deposit', // Changed from awaiting_payment
                assigned_manager: orderData.assigned_manager || orderData.manager_id || null,
                // booking_price removed to fix 400 error
                is_refundable: orderData.is_refundable ? true : false, // Sprint 1: Refundable flag
                created_at: new Date().toISOString(),
                magic_link_token: orderData.magic_link_token || this.generateUUID() // Euphoria Tracker Token
                // timeline_events removed to fix 400 error
            };

            console.log('📦 Создаем заказ с данными:', requestData);

            // 3. Выполняем POST запрос для создания записи в таблице orders
            const result = await this._request({
                table: 'orders',
                method: 'POST',
                body: requestData
            });
            
            const created = Array.isArray(result) ? result[0] : result;
            const createdId = created?.id || requestData.id;

            // Для локального режима (SQLite) мы хотим убедиться, что запись создана
            // прежде чем добавлять связанные записи (Foreign Key constraints)
            if (this.db) {
                // Небольшая пауза или проверка не требуется, так как query в DatabaseManager
                // выполняется последовательно и возвращает результат после завершения run()
                console.log(`✅ Запись заказа ${createdId} успешно создана в локальной БД`);
                
                // Trigger Sync
                this.syncOrderToSupabase(createdId);
            }

            // 4. Логируем создание заказа
            await this.logAudit('create', 'orders', createdId, requestData, orderData.user_id || null);
            
            // 5. Также добавляем начальную запись в историю статусов
            // Теперь Foreign Key на order_id в таблице order_status_events должен сработать
            await this.addStatusHistory(createdId, requestData.status, 'Initial order creation', orderData.user_id || null);

            return created || requestData; // Return created object or request data if created is null
        } catch (error) {
            console.error('Ошибка создания заказа:', error);
            throw error;
        }
    }

    // Отладочная функция для проверки всех заказов
    async debugGetAllOrders() {
        try {
            console.log('🔍 Получаем все заказы для отладки...');
            const orders = await this._request({
                table: 'orders',
                method: 'GET'
            });

            console.log(`📋 Всего заказов в таблице: ${orders ? orders.length : 0}`);
            return orders || [];
        } catch (error) {
            console.error('Ошибка получения всех заказов:', error);
            throw error;
        }
    }

    // Получение заказа по ID
    async getOrderById(orderId) {
        try {
            console.log(`🔍 Ищем заказ: ${orderId}`);
            
            // Сначала пробуем найти по точному UUID
            const ordersById = await this._request({
                table: 'orders',
                method: 'GET',
                filters: { id: `eq.${orderId}` }
            });
            
            if (ordersById && ordersById.length > 0) {
                return ordersById[0];
            }

            // Если не нашли по UUID, пробуем по order_code
            const ordersByCode = await this._request({
                table: 'orders',
                method: 'GET',
                filters: { order_code: `eq.${orderId}` }
            });

            if (ordersByCode && ordersByCode.length > 0) {
                return ordersByCode[0];
            }
            
            console.log('❌ Заказ не найден:', orderId);
            return null;
        } catch (error) {
            console.error('Ошибка получения заказа:', error);
            throw error;
        }
    }

    // Получение полной информации о заказе (заказ + финансы + логистика)
    async getFullOrderInfo(orderId) {
        try {
            console.log('🔍 Загружаем полную информацию о заказе:', orderId);
            
            // Сначала получаем основную информацию о заказе
            const order = await this.getOrderById(orderId);
            
            if (!order) {
                console.log('❌ Заказ не найден, возвращаем пустые данные');
                return {
                    success: true,
                    data: {
                        order: null,
                        finance: null,
                        logistics: null,
                        history: []
                    }
                };
            }

            // Получаем связанные данные, используя id из найденного заказа
            const [finance, logistics, history] = await Promise.all([
                this.getFinances({ order_id: order.id }),
                this.getLogistics({ order_id: order.id }),
                this.getOrderHistory(order.id)
            ]);

            console.log('✅ Полная информация о заказе загружена:', {
                order: order,
                finance: finance.length > 0 ? finance[0] : null,
                logistics: logistics.length > 0 ? logistics[0] : null,
                history: history
            });

            return {
                success: true,
                data: {
                    order: order,
                    finance: finance.length > 0 ? finance[0] : null,
                    logistics: logistics.length > 0 ? logistics[0] : null,
                    history: history
                }
            };
        } catch (error) {
            console.error('💥 Ошибка получения полной информации о заказе:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Получение истории заказа
    async getOrderHistory(orderId) {
        try {
            console.log(`📜 Получаем историю заказа: ${orderId}`);
            
            const history = await this._request({
                table: 'orderHistory',
                method: 'GET',
                filters: { order_id: `eq.${orderId}` }
            });

            console.log(`📜 История заказа получена: ${history.length} записей`);
            return history;
        } catch (error) {
            console.error('Ошибка получения истории заказа:', error);
            return [];
        }
    }

    // Получить заказы
    async getOrders(filters = {}) {
        try {
            const apiFilters = {};
            if (filters.status) apiFilters.status = `eq.${filters.status}`;
            if (filters.assigned_manager) apiFilters.assigned_manager = `eq.${filters.assigned_manager}`;
            if (filters.customer_id) apiFilters.customer_id = `eq.${filters.customer_id}`;
            if (filters.lead_id) apiFilters.lead_id = `eq.${filters.lead_id}`;

            return await this._request({
                table: 'orders',
                method: 'GET',
                filters: apiFilters
            });
        } catch (error) {
            console.error('Ошибка получения заказов:', error);
            throw error;
        }
    }

    async updateOrder(orderId, updateData) {
        try {
            // Sprint 5: Price Protection Logic
            if (updateData.final_price_eur) {
                const order = await this.getOrderById(orderId);
                if (order && order.booking_price) {
                    if (parseFloat(updateData.final_price_eur) > parseFloat(order.booking_price)) {
                        console.log(`🛡️ Price Protection Triggered: Final ${updateData.final_price_eur} > Booking ${order.booking_price}`);
                        updateData.is_refundable = 1;
                        await this.sendNotification('price_protection', orderId, "Цена изменилась. Активирована защита покупателя (возврат доступен).");
                    }
                }
            }

            return await this._request({
                table: 'orders',
                method: 'PATCH',
                body: updateData,
                filters: { id: `eq.${orderId}` }
            });
        } catch (error) {
            console.error('Error updating order:', error);
            throw error;
        }
    }

    async updateOrderStatus(orderId, newStatus, statusNote = '', updatedBy = null) {
        try {
            if (!updatedBy) {
                throw new Error('CRM_USER_ID_REQUIRED');
            }

            // Sprint 5: Timestamp for confirmation (48h timer)
            let confirmationTimestamp = null;
            if (newStatus === 'quality_confirmed' || newStatus === 'quality_degraded') {
                confirmationTimestamp = new Date().toISOString();
            }

            // Notification Trigger 1: Quality Confirmed/Degraded
            if (newStatus === 'quality_confirmed') {
                await this.sendNotification('quality_confirmed', orderId, "Ваш отчет готов! У вас есть 48 часов, чтобы завершить покупку");
            } else if (newStatus === 'quality_degraded') {
                await this.sendNotification('quality_degraded', orderId, "Внимание: класс качества изменился. У вас есть право на мгновенный возврат задатка");
            }

            // Пробуем использовать RPC функцию (только в Supabase режиме)
            if (!this.db && this.supabaseUrl) {
                try {
                    await this.callRpc('advance_order_status_safe', {
                        p_order_id: orderId,
                        p_new_status: newStatus,
                        p_user_id: updatedBy,
                        p_reason: null,
                        p_notes: statusNote
                    });
                    
                    // If confirmation timestamp needs setting (RPC might not handle it), do a patch
                    if (confirmationTimestamp) {
                         await this._request({
                            table: 'orders',
                            method: 'PATCH',
                            body: { confirmation_timestamp: confirmationTimestamp },
                            filters: { id: `eq.${orderId}` }
                        });
                    }

                    await this.logAudit('ORDER_STATUS_CHANGE', 'orders', orderId, {
                        old_status: 'unknown_rpc',
                        new_status: newStatus,
                        notes: statusNote
                    }, updatedBy);

                    return { success: true };
                } catch (rpcError) {
                    console.warn('RPC advance_order_status_safe failed, falling back to PATCH:', rpcError.message);
                }
            }

            // Fallback или локальный режим
            await this.addStatusHistory(orderId, newStatus, statusNote, updatedBy);
            
            const updateBody = { status: newStatus };
            if (confirmationTimestamp) {
                updateBody.confirmation_timestamp = confirmationTimestamp;
            }

            await this._request({
                table: 'orders',
                method: 'PATCH',
                body: updateBody,
                filters: { id: `eq.${orderId}` }
            });
            
            await this.logAudit('ORDER_STATUS_CHANGE', 'orders', orderId, {
                new_status: newStatus,
                notes: statusNote,
                fallback: true
            }, updatedBy);

            return { success: true };
        } catch (error) {
            console.error('Ошибка обновления статуса заказа:', error);
            throw error;
        }
    }

    // Sprint 5: Check for expired orders
    async checkExpiredOrders() {
        try {
            console.log('⏰ Checking for expired orders...');
            // Find orders that are quality_confirmed/degraded AND older than 48h
            // Logic: NOW > confirmation_timestamp + 48h
            
            // Calculate cutoff time (48h ago)
            const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
            
            // Since filtering by date math is tricky in simple API wrapper, we might need to fetch candidate orders
            // Filter: status in ('quality_confirmed', 'quality_degraded') AND confirmation_timestamp < cutoff
            
            // Note: complex OR/AND logic depends on implementation. 
            // We'll fetch quality_confirmed and quality_degraded separately or together if supported.
            // For simplicity, let's fetch all active orders in these statuses.
            
            let candidates = [];
            
            try {
                const confirmed = await this._request({
                    table: 'orders',
                    method: 'GET',
                    filters: { status: 'eq.quality_confirmed' }
                });
                if (confirmed) candidates.push(...confirmed);
            } catch (e) {
                if (!e.message?.includes('invalid input value for enum')) {
                    console.warn('⚠️ Error fetching quality_confirmed orders:', e.message);
                }
            }
            
            try {
                const degraded = await this._request({
                    table: 'orders',
                    method: 'GET',
                    filters: { status: 'eq.quality_degraded' }
                });
                if (degraded) candidates.push(...degraded);
            } catch (e) {
                if (!e.message?.includes('invalid input value for enum')) {
                    console.warn('⚠️ Error fetching quality_degraded orders:', e.message);
                }
            }
            
            let expiredCount = 0;
            
            for (const order of candidates) {
                if (!order.confirmation_timestamp) continue;
                
                // Check if expired
                if (new Date(order.confirmation_timestamp) < new Date(cutoff)) {
                    console.log(`⏳ Order ${order.id} expired. Auto-closing...`);
                    
                    // 1. Expire Order
                    await this.updateOrderStatus(order.id, 'expired', 'Auto-expired: 48h timeout reached', 'system');
                    
                    // 2. Release Bike Reservation
                    if (order.bike_id) {
                         await this._request({
                            table: 'bikes',
                            method: 'PATCH',
                            body: { is_reserviert: 0 }, // 0 for false in sqlite usually
                            filters: { id: `eq.${order.bike_id}` }
                        });
                        console.log(`🚲 Bike ${order.bike_id} released.`);
                    }
                    
                    // 3. Notify
                    await this.sendNotification('order_expired', order.id, "Срок бронирования истек. Велосипед освобожден.");
                    
                    expiredCount++;
                } else {
                    // Check for 12h warning (36h passed)
                    const warningCutoff = new Date(Date.now() - 36 * 60 * 60 * 1000);
                    // If confirmation < warningCutoff (meaning more than 36h passed) AND not yet warned?
                    // We need a flag 'warning_sent' to avoid spam. 
                    // For now, we'll skip implementing stateful warning to avoid DB schema changes unless necessary.
                    // Or we can check if 36h passed AND < 37h passed (approx window)
                }
            }
            
            if (expiredCount > 0) {
                console.log(`✅ Auto-expired ${expiredCount} orders.`);
            }
        } catch (error) {
            console.error('Error checking expired orders:', error);
        }
    }

    // Sprint 5: Request Help
    async requestHelp(orderId) {
        try {
            console.log(`🆘 Help requested for order ${orderId}`);
            
            // Set attention_required flag
            // Assuming we can use 'tags' or specific column. 
            // If column doesn't exist, we might need to add it or put in notes.
            // Let's assume we can PATCH 'attention_required' (needs schema update or ignore if missing)
            
            // Safer: Append to notes if column missing risk is high, but let's try column first 
            // or just log it for now as "Help Request" in history.
            
            await this.addStatusHistory(orderId, 'help_requested', 'Client requested human assistance', 'client');
            
            // Try updating flag
            try {
                await this._request({
                    table: 'orders',
                    method: 'PATCH',
                    body: { attention_required: true },
                    filters: { id: `eq.${orderId}` }
                });
            } catch (e) {
                console.warn('Could not set attention_required column, might be missing:', e.message);
            }

            // Notify Manager
            await this.sendNotification('help_request', orderId, `Клиенту по заказу #${orderId} нужна помощь в чате`);
            
            return { success: true };
        } catch (error) {
            console.error('Error requesting help:', error);
            throw error;
        }
    }

    // Sprint 5: Notification System Stub
    async sendNotification(type, orderId, message) {
        console.log(`🔔 [NOTIFICATION] Type: ${type}, Order: ${orderId}, Msg: "${message}"`);
        
        try {
            // 1. Get Order to find Customer
            const order = await this.getOrderById(orderId);
            if (!order || !order.customer_id) return;

            // 2. Get Customer
            const customers = await this._request({
                table: 'customers',
                method: 'GET',
                filters: { id: `eq.${order.customer_id}` }
            });
            const customer = customers && customers[0];

            if (!customer) return;

            // 3. Check if Telegram
            // Check both contact_method fields (schema varies)
            const channel = customer.preferred_channel || customer.contact_method;
            const contact = customer.phone || customer.contact_value;

            if ((channel === 'telegram' || !channel) && contact) {
                // 4. Send via Telegram API
                const token = process.env.BOT_TOKEN;
                if (!token) {
                    console.warn('⚠️ BOT_TOKEN not found for notifications');
                    return;
                }

                // Dynamic import axios if needed, but it should be available in server env
                // Assuming axios is globally available or required at top of file? 
                // crm-api.js is a class file, usually required by server.js which has axios.
                // But this file doesn't require axios. We should use fetch (native in Node 18+) or require it.
                // Since we are in a class, let's try fetch first.
                
                const url = `https://api.telegram.org/bot${token}/sendMessage`;
                const payload = {
                    chat_id: contact,
                    text: message,
                    parse_mode: 'Markdown'
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const txt = await response.text();
                    console.error('❌ Failed to send Telegram notification:', txt);
                } else {
                    console.log(`✅ Notification sent to ${contact}`);
                }
            }
        } catch (e) {
            console.error('Notification error:', e.message);
        }
    }

    // ========================================
    // 💰 ФИНАНСЫ (FINANCES)
    // ========================================

    // Создать финансовую запись (Payment)
    async createFinanceRecord(financeData) {
        try {
            const actorId = financeData.created_by || financeData.user_id || null;

            // 1. Проверка на дубликат по external_reference
            if (financeData.external_reference) {
                const existing = await this._request({
                    table: 'finances',
                    method: 'GET',
                    filters: { external_reference: `eq.${financeData.external_reference}` },
                    select: 'id'
                });
                
                if (existing && existing.length > 0) {
                    console.log('ℹ️ Платеж с таким external_reference уже существует:', financeData.external_reference);
                    return { success: true, id: existing[0].id, duplicate: true };
                }
            }

            // 2. Попытка использовать Safe RPC для регистрации платежа (только в Supabase режиме)
            if (!this.db && this.supabaseUrl) {
                try {
                    const rpcResult = await this.callRpc('record_generic_payment_safe', {
                        p_order_id: financeData.order_id,
                        p_amount: parseFloat(financeData.amount || 0),
                        p_currency: financeData.currency || 'EUR',
                        p_direction: financeData.direction || 'incoming',
                        p_role: financeData.role || 'client_payment',
                        p_method: financeData.method || 'online_cashbox',
                        p_external_reference: financeData.external_reference || null,
                        p_user_id: actorId
                    });
                    if (rpcResult) return { success: true, ...rpcResult };
                } catch (rpcError) {
                    console.warn('RPC record_generic_payment_safe failed, falling back to manual:', rpcError.message);
                }
            }

            // 3. Ручная вставка (Fallback или локальный режим)
            const requestData = {
                id: financeData.id || this.generateUUID(),
                order_id: financeData.order_id,
                direction: financeData.direction || 'incoming',
                role: financeData.role || 'client_payment',
                method: financeData.method || 'online_cashbox',
                amount: parseFloat(financeData.amount || financeData.total_amount || 0),
                currency: financeData.currency || 'EUR',
                status: financeData.status || financeData.payment_status || 'planned',
                external_reference: financeData.external_reference || financeData.payment_reference || null,
                related_payment_id: financeData.related_payment_id || null,
                created_by: actorId,
                created_at: new Date().toISOString()
            };
            
            await this._request({
                table: 'finances',
                method: 'POST',
                body: requestData
            });

            // 4. Логирование и обновление статуса заказа
            await this.logAudit('create_payment', 'payments', requestData.id, requestData, actorId);

            // Если это входящий завершенный платеж клиента, переводим заказ в paid
            if (requestData.direction === 'incoming' && requestData.status === 'completed' && requestData.role === 'client_payment') {
                try {
                    await this.updateOrderStatus(requestData.order_id, 'paid', 'Auto-updated after payment', actorId);
                } catch (statusError) {
                    console.error('Не удалось автоматически обновить статус заказа:', statusError.message);
                }
            }

            return { success: true, id: requestData.id, ...requestData };
        } catch (error) {
            console.error('Ошибка создания финансовой записи:', error);
            throw error;
        }
    }

    async recordPaymentLedger(entry) {
        try {
            const actorId = entry.created_by || entry.user_id || null;
            const amount = parseFloat(entry.amount || 0);
            if (!Number.isFinite(amount) || amount < 0) {
                throw new Error('AMOUNT_INVALID');
            }

            const direction = entry.direction || 'incoming';
            const role = entry.role || entry.chain_step || entry.chainStep || 'client_payment';
            const method = entry.method || 'online_cashbox';
            const currency = entry.currency || 'EUR';
            const status = entry.status || 'planned';
            const externalReference = entry.external_reference || entry.externalReference || null;
            const relatedPaymentId = entry.related_payment_id || entry.relatedPaymentId || null;

            if (externalReference) {
                try {
                    const existing = await this._request({
                        table: 'finances',
                        method: 'GET',
                        filters: { external_reference: `eq.${externalReference}` },
                        select: 'id'
                    });
                    if (existing && existing.length > 0) {
                        return { success: true, id: existing[0].id, duplicate: true };
                    }
                } catch {}
            }

            if (!this.db && this.supabaseUrl) {
                try {
                    const rpcResult = await this.callRpc('record_generic_payment_safe', {
                        p_order_id: entry.order_id || entry.orderId,
                        p_amount: amount,
                        p_currency: currency,
                        p_direction: direction,
                        p_role: role,
                        p_method: method,
                        p_external_reference: externalReference,
                        p_user_id: actorId
                    });
                    if (rpcResult) return { success: true, ...rpcResult };
                } catch (rpcError) {
                    console.warn('RPC record_generic_payment_safe failed, falling back to insert:', rpcError.message);
                }
            }

            const canonicalData = {
                id: entry.id || this.generateUUID(),
                order_id: entry.order_id || entry.orderId || null,
                direction,
                role,
                method,
                amount,
                currency,
                status,
                external_reference: externalReference,
                related_payment_id: relatedPaymentId,
                created_by: actorId,
                created_at: new Date().toISOString()
            };

            try {
                const inserted = await this._request({
                    table: 'finances',
                    method: 'POST',
                    body: canonicalData
                });

                await this.logAudit('create_payment', 'payments', canonicalData.id, canonicalData, actorId);

                if (direction === 'incoming' && status === 'completed' && role === 'client_payment') {
                    try {
                        await this.updateOrderStatus(canonicalData.order_id, 'paid', 'Auto-updated after payment', actorId);
                    } catch {}
                }

                return { success: true, id: canonicalData.id, data: inserted || canonicalData };
            } catch (canonicalError) {
                const legacyData = {
                    payment_id: entry.payment_id || entry.paymentId || this.generateUUID(),
                    order_id: entry.order_id || entry.orderId || null,
                    application_id: entry.application_id || entry.applicationId || null,
                    chain_step: entry.chain_step || entry.chainStep || role,
                    direction,
                    method,
                    currency,
                    amount,
                    status,
                    scheduled_at: entry.scheduled_at || entry.scheduledAt || null,
                    completed_at: entry.completed_at || entry.completedAt || (status === 'completed' ? new Date().toISOString() : null),
                    related_payment_id: relatedPaymentId,
                    external_reference: externalReference,
                    metadata: entry.metadata || {},
                    comment: entry.comment || null,
                    created_by: actorId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                const insertedLegacy = await this._request({
                    table: 'finances',
                    method: 'POST',
                    body: legacyData
                });

                await this.logAudit('create_payment', 'payments', legacyData.payment_id, legacyData, actorId);

                if (direction === 'incoming' && status === 'completed' && legacyData.chain_step === 'client_payment') {
                    try {
                        await this.updateOrderStatus(legacyData.order_id, 'paid', 'Auto-updated after payment', actorId);
                    } catch {}
                }

                return { success: true, id: legacyData.payment_id, data: insertedLegacy || legacyData, fallback: true, error: String(canonicalError && canonicalError.message || canonicalError) };
            }
        } catch (error) {
            const err = new Error(String(error && error.message || error));
            err.code = error && error.code ? error.code : (String(error && error.message || error) || 'UNKNOWN');
            throw err;
        }
    }

    // Получить финансовые записи
    async getFinances(filters = {}) {
        try {
            console.log('💰 Получаем финансовые записи (payments) с фильтрами:', filters);
            
            const apiFilters = {};
            if (filters.status) apiFilters.status = `eq.${filters.status}`;
            if (filters.order_id) apiFilters.order_id = `eq.${filters.order_id}`;
            if (filters.direction) apiFilters.direction = `eq.${filters.direction}`;

            return await this._request({
                table: 'finances',
                method: 'GET',
                filters: apiFilters
            });
        } catch (error) {
            console.error('Ошибка получения финансовых записей:', error);
            return [];
        }
    }

    // ========================================
    // 🚚 ЛОГИСТИКА (LOGISTICS)
    // ========================================

    // Создать логистическую запись (Shipment)
    async createLogisticsRecord(logisticsData) {
        try {
            const requestData = {
                id: logisticsData.id || this.generateUUID(),
                order_id: logisticsData.order_id,
                provider: logisticsData.provider || logisticsData.carrier || 'rusbid',
                tracking_number: logisticsData.tracking_number || null,
                warehouse_received: logisticsData.warehouse_received || false,
                warehouse_photos_received: logisticsData.warehouse_photos_received || false,
                client_received: logisticsData.client_received || false,
                estimated_delivery_date: logisticsData.estimated_delivery_date || logisticsData.estimated_delivery || null,
                ruspost_status: logisticsData.ruspost_status || null,
                ruspost_last_update: logisticsData.ruspost_last_update || null,
                created_at: new Date().toISOString()
            };
            
            console.log('🚚 Отправляем логистические данные (shipments):', requestData);
            
            await this._request({
                table: 'logistics',
                method: 'POST',
                body: requestData
            });

            return { success: true, id: requestData.id, ...requestData };
        } catch (error) {
            console.error('Ошибка создания логистической записи:', error);
            throw error;
        }
    }

    // Получить логистические записи
    async getLogistics(filters = {}) {
        try {
            console.log('🚚 Получаем логистические записи (shipments) с фильтрами:', filters);
            
            const apiFilters = {};
            if (filters.order_id) apiFilters.order_id = `eq.${filters.order_id}`;
            if (filters.tracking_number) apiFilters.tracking_number = `eq.${filters.tracking_number}`;

            return await this._request({
                table: 'logistics',
                method: 'GET',
                filters: apiFilters
            });
        } catch (error) {
            console.error('Ошибка получения логистических записей:', error);
            return [];
        }
    }

    // ========================================
    // 👥 СОТРУДНИКИ (EMPLOYEES)
    // ========================================

    // Получить активных сотрудников
    async getActiveEmployees() {
        try {
            return await this._request({
                table: 'employees',
                method: 'GET',
                filters: { active: 'eq.true' }
            });
        } catch (error) {
            console.error('Ошибка получения сотрудников:', error);
            throw error;
        }
    }

    // ========================================
    // 📄 ДОКУМЕНТЫ (DOCUMENTS)
    // ========================================

    async attachDocument(documentData) {
        try {
            const requestData = {
                id: documentData.id || this.generateUUID(),
                order_id: documentData.order_id,
                type: documentData.type || 'invoice',
                file_url: documentData.file_url,
                uploaded_at: new Date().toISOString()
            };

            await this._request({
                table: 'documents',
                method: 'POST',
                body: requestData
            });

            return { success: true, id: requestData.id, ...requestData };
        } catch (error) {
            console.error('Ошибка прикрепления документа:', error);
            throw error;
        }
    }

    // ========================================
    // ✅ ЗАДАЧИ (TASKS)
    // ========================================

    async createTask(taskData) {
        try {
            const requestData = {
                id: taskData.id || this.generateUUID(),
                order_id: taskData.order_id,
                title: taskData.title,
                description: taskData.description || null,
                due_at: taskData.due_at || null,
                completed: false,
                assigned_to: taskData.assigned_to || null,
                created_at: new Date().toISOString()
            };

            await this._request({
                table: 'tasks',
                method: 'POST',
                body: requestData
            });

            return { success: true, id: requestData.id, ...requestData };
        } catch (error) {
            console.error('Ошибка создания задачи:', error);
            throw error;
        }
    }

    // ========================================
    // 📊 АНАЛИТИКА И ОТЧЕТЫ
    // ========================================

    // Статистика по заявкам
    async getApplicationsStats() {
        try {
            const applications = await this.getApplications();
            
            const stats = {
                total: applications.length,
                new: applications.filter(app => app.status === 'new').length,
                in_progress: applications.filter(app => app.status === 'in_progress').length,
                qualified: applications.filter(app => app.status === 'qualified').length,
                converted: applications.filter(app => app.status === 'converted').length,
                rejected: applications.filter(app => app.status === 'rejected').length
            };

            return stats;
        } catch (error) {
            console.error('Ошибка получения статистики заявок:', error);
            throw error;
        }
    }

    // Конверсия заявок в заказы
    async getConversionRate(dateFrom, dateTo) {
        try {
            const applications = await this.getApplications();
            const filteredApps = applications.filter(app => {
                const createdDate = new Date(app.created_at);
                return createdDate >= new Date(dateFrom) && createdDate <= new Date(dateTo);
            });
            
            const totalApplications = filteredApps.length;
            const convertedApplications = filteredApps.filter(app => app.status === 'converted').length;
            
            return {
                total_applications: totalApplications,
                converted_applications: convertedApplications,
                conversion_rate: totalApplications > 0 ? (convertedApplications / totalApplications * 100).toFixed(2) : 0
            };
        } catch (error) {
            console.error('Ошибка расчета конверсии:', error);
            throw error;
        }
    }

    // ========================================
    // 🛠️ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ========================================

    // Генерация UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Добавить запись в историю статусов
    async addStatusHistory(orderId, status, note = '', updatedBy = null) {
        try {
            // Пытаемся получить текущий статус заказа для old_status
            let oldStatus = null;
            try {
                const order = await this.getOrderById(orderId);
                if (order) oldStatus = order.status;
            } catch (e) {
                console.warn('Не удалось получить предыдущий статус для истории');
            }

            const historyData = {
                id: this.generateUUID(),
                order_id: orderId,
                old_status: oldStatus,
                new_status: status,
                changed_by: updatedBy,
                created_at: new Date().toISOString()
            };

            console.log('📋 Отправляем данные истории (order_status_events):', historyData);

            await this._request({
                table: 'orderHistory',
                method: 'POST',
                body: historyData
            });

            return { success: true, id: historyData.id };
        } catch (error) {
            console.error('Ошибка добавления записи в историю:', error);
            throw error;
        }
    }

    // ========================================
    // 🔗 РАБОТА СО СВЯЗАННЫМИ ДАННЫМИ И VIEW
    // ========================================

    // Получить полную информацию о заказе (с заявкой, финансами и логистикой)
    async getOrderFullInfo(orderId = null) {
        try {
            const apiFilters = {};
            if (orderId) apiFilters.id = `eq.${orderId}`;

            const orders = await this._request({
                table: 'orders',
                method: 'GET',
                filters: apiFilters
            });
            
            if (orderId && orders && orders.length > 0) {
                const order = orders[0];
                let bike = null;
                
                if (order.bike_id) {
                     try {
                        // Ensure table mapping exists
                        if (!this.tables.bikes) this.tables.bikes = 'bikes';
                        
                        const bikes = await this._request({
                            table: 'bikes',
                            method: 'GET',
                            filters: { id: `eq.${order.bike_id}` }
                        });
                        if (bikes && bikes.length > 0) bike = bikes[0];
                     } catch(e) {
                         console.warn('Failed to fetch linked bike:', e.message);
                     }
                }
                
                return {
                    success: true,
                    data: {
                        order: order,
                        bike: bike
                    }
                };
            }

            return { success: true, data: orders };
        } catch (error) {
            console.error('Ошибка получения полной информации о заказе:', error);
            throw error;
        }
    }

    // Получить историю заказа с данными сотрудника
    async getOrderHistoryWithEmployee(orderId = null) {
        try {
            const apiFilters = {};
            if (orderId) apiFilters.order_id = `eq.${orderId}`;

            return await this._request({
                table: 'orderHistory',
                method: 'GET',
                filters: apiFilters
            });
        } catch (error) {
            console.error('Ошибка получения истории заказа:', error);
            throw error;
        }
    }

    // Получить заказы по менеджеру
    async getOrdersByManager(managerId = null) {
        try {
            const apiFilters = {};
            if (managerId) apiFilters.assigned_manager = `eq.${managerId}`;

            return await this._request({
                table: 'orders',
                method: 'GET',
                filters: apiFilters
            });
        } catch (error) {
            console.error('Ошибка получения заказов по менеджеру:', error);
            throw error;
        }
    }

    // Создать заказ из заявки (с автоматическим связыванием)
    async createOrderFromApplication(applicationId, orderData = {}) {
        try {
            // Получаем данные заявки
            const applications = await this.getApplications();
            const application = applications.find(app => app.id === applicationId);
            
            if (!application) {
                throw new Error('Заказ (Lead) не найден');
            }

            // Создаем заказ с привязкой к заявке
            const newOrderData = {
                lead_id: applicationId,
                customer_id: application.customer_id,
                bike_url: application.bike_url,
                bike_snapshot: application.bike_snapshot,
                status: 'awaiting_payment',
                ...orderData
            };

            const order = await this.createOrder(newOrderData);

            // Обновляем статус заявки
            await this.updateApplication(applicationId, {
                status: 'converted',
                changed_by: orderData.changed_by || orderData.user_id || 'system'
            });

            return order;
        } catch (error) {
            console.error('Ошибка создания заказа из заявки:', error);
            throw error;
        }
    }

    // Получить связанные данные для заказа
    async getOrderRelatedData(orderId) {
        try {
            const [orderInfo, history, finances, logistics] = await Promise.all([
                this.getOrderFullInfo(orderId),
                this.getOrderHistoryWithEmployee(orderId),
                this.getFinances({ order_id: orderId }),
                this.getLogistics({ order_id: orderId })
            ]);

            return {
                order: orderInfo[0] || null,
                history: history || [],
                finances: finances || [],
                logistics: logistics || []
            };
        } catch (error) {
            console.error('Ошибка получения связанных данных заказа:', error);
            throw error;
        }
    }

    // Получить статистику по связанным данным
    async getRelatedDataStats() {
        try {
            const [applications, orders, finances, logistics] = await Promise.all([
                this.getApplications(),
                this.getOrders(),
                this.getFinances(),
                this.getLogistics()
            ]);

            return {
                applications: {
                    total: applications.length,
                    new: applications.filter(app => app.status === 'new').length,
                    converted: applications.filter(app => app.status === 'converted').length,
                    conversion_rate: applications.length > 0 ? 
                        (applications.filter(app => app.status === 'converted').length / applications.length * 100).toFixed(2) : 0
                },
                orders: {
                    total: orders.length,
                    new: orders.filter(order => order.status === 'new').length,
                    confirmed: orders.filter(order => order.status === 'confirmed').length,
                    completed: orders.filter(order => order.status === 'completed').length
                },
                finances: {
                    total: finances.length,
                    paid: finances.filter(fin => fin.payment_status === 'paid').length,
                    pending: finances.filter(fin => fin.payment_status === 'pending').length,
                    total_amount: finances.reduce((sum, fin) => sum + (parseFloat(fin.total_amount) || 0), 0)
                },
                logistics: {
                    total: logistics.length,
                    delivered: logistics.filter(log => log.delivery_status === 'delivered').length,
                    in_transit: logistics.filter(log => log.delivery_status === 'in_transit').length,
                    pending: logistics.filter(log => log.delivery_status === 'pending').length
                }
            };
        } catch (error) {
            console.error('Ошибка получения статистики связанных данных:', error);
            throw error;
        }
    }

    // Создать быстрый заказ (Quick Order) из формы "Купить в один клик"
    async createQuickOrder(orderData) {
        try {
            console.log('🚀 CRM: Создание быстрого заказа...', orderData);
            
            // 1. Создаем заявку (Lead)
            const applicationPayload = {
                source: orderData.source || 'quick_order',
                customer_name: orderData.name || 'Anonymous',
                contact_method: orderData.contact_method || 'telegram',
                contact_value: orderData.contact_value || '',
                application_notes: orderData.notes || null,
                bike_url: orderData.bike_url || null,
                bike_snapshot: orderData.bike_snapshot || null,
                status: 'new'
            };
            
            const application = await this.createApplication(applicationPayload);
            console.log('✅ Заявка создана:', application.id);
            
            // 2. Создаем заказ на основе заявки
            let initialStatus = 'awaiting_deposit';
            // Explicitly set verification_pending for new model if 3% deposit is not yet paid but intended?
            // Actually, if "quick order" implies intent to pay deposit, status is awaiting_deposit.
            // If deposit is paid, it moves to verification_pending.
            
            // Extract bike ID if present
            const bikeId = orderData.items && orderData.items[0] ? orderData.items[0].bike_id : null;
            
            // Calculate booking price from payload
            let bookingPrice = orderData.booking_amount_eur || null;
            if (!bookingPrice && orderData.items && orderData.items[0]) {
                const fullPrice = parseFloat(orderData.final_price_eur || orderData.items[0].price);
                // Sprint 4: Deposit is 2% of the price (User request)
                bookingPrice = Math.round(fullPrice * 0.02);
                if (bookingPrice < 10) bookingPrice = 10; // Minimum 10 EUR deposit
            }

            const orderPayload = {
                lead_id: application.id,
                customer_id: application.customer_id, // Передаем ID клиента из заявки
                customer_name: orderData.name || 'Anonymous',
                contact_method: orderData.contact_method || 'telegram',
                contact_value: orderData.contact_value || '',
                order_notes: orderData.notes || null,
                bike_url: orderData.bike_url || null,
                bike_snapshot: orderData.bike_snapshot || null,
                status: 'awaiting_payment', // Canonical status for Supabase Enum (mapped from awaiting_deposit)
                bike_id: bikeId, // Now supported in DB
                bike_name: orderData.items && orderData.items[0] ? orderData.items[0].name : 'Unknown Bike', // New Field
                booking_amount_eur: bookingPrice, // New Field (was booking_price in code, DB has booking_amount_eur)
                // booking_price removed to fix 400 error
                listing_price_eur: orderData.items && orderData.items[0] ? parseFloat(orderData.items[0].price) : 0, // New Field
                final_price_eur: parseFloat(orderData.final_price_eur) || (orderData.items && orderData.items[0] ? parseFloat(orderData.items[0].price) : 0),
                total_price_rub: orderData.total_price_rub,
                booking_amount_rub: orderData.booking_amount_rub,
                exchange_rate: orderData.exchange_rate,
                delivery_method: orderData.delivery_method,
                commission_eur: orderData.commission_eur || null,
                assigned_manager: orderData.assigned_manager || orderData.manager_id || null,
                is_refundable: false, // Default false
                initial_quality: 'A', // Default assumption for now, or extract from snapshot if available
                created_at: new Date().toISOString(),
                magic_link_token: orderData.magic_link_token || this.generateUUID()
                // timeline_events removed to fix 400 error
            };
            
            // Fix for Supabase strict mode if bike_id column was missing (now added, but safety check)
            if (!this.db && !orderPayload.bike_snapshot) {
                 orderPayload.bike_snapshot = {};
            }
            if (!this.db) {
                // Ensure bike_id is in snapshot just in case
                if (typeof orderPayload.bike_snapshot === 'object') {
                    orderPayload.bike_snapshot.bike_id = bikeId;
                }
            }
            
            const order = await this.createOrder(orderPayload);
            console.log('✅ Заказ создан:', order.id);

            // Sprint 4: Create Verification Task
            if (order.id) {
                 await this.createTask({
                     order_id: order.id,
                     title: 'VERIFY_BIKE',
                     description: `Verify bike availability and condition for Order ${order.order_code}. URL: ${orderData.bike_url}`,
                     due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h due
                 });
                 console.log('✅ Task VERIFY_BIKE created for order:', order.id);
            }
            
            // 3. (Sprint 3) Generate Payment Link if auto_payment is requested
            let paymentUrl = null;
            if (orderData.auto_payment && orderData.deposit_amount) {
                try {
                    // This assumes a generatePaymentLink function exists or we mock it for now
                    // Ideally we would integrate Stripe/Yookassa here
                    // For now, we'll simulate a payment link or use a placeholder
                    // In a real implementation, this would call the payment gateway API
                    
                    // We can call a helper method to generate the link
                    paymentUrl = await this.generatePaymentLink({
                        order_id: order.id,
                        amount: orderData.deposit_amount,
                        currency: 'RUB', // Assuming RUB for deposit
                        description: `Задаток за заказ ${order.order_code}`,
                        metadata: {
                            bike_id: bikeId,
                            order_id: order.id,
                            initial_quality_class: 'A' // Needs to be fetched ideally, or passed
                        }
                    });
                } catch (payErr) {
                    console.error('Failed to generate payment link:', payErr);
                }
            }

            return {
                success: true,
                lead_id: application.id,
                order_id: order.id,
                order_number: order.order_code || order.order_number || null,
                tracking_url: `/order-tracking/${order.id}`, // Changed to use order ID for direct tracking
                payment_url: paymentUrl
            };
        } catch (error) {
            console.error('💥 Ошибка создания быстрого заказа:', error);
            throw error;
        }
    }

    // Sprint 3: Payment Link Generator Stub (Replace with real integration)
    async generatePaymentLink(params) {
        // In a real app, this would make an API call to Stripe/Yookassa
        // For demonstration, we'll return a mock URL that might redirect to a success handler
        console.log('💳 Generating Payment Link:', params);
        
        // Mock Stripe Session creation
        // const session = await stripe.checkout.sessions.create(...)
        // return session.url;

        // For now, return a link to a mock payment page or directly to success for testing
        // We can create a test endpoint on our server to simulate payment
        return `/mock-payment?order_id=${params.order_id}&amount=${params.amount}`; 
    }

    // ========================================
    // 🔄 ИНТЕГРАЦИЯ С СУЩЕСТВУЮЩИМИ ФОРМАМИ
    // ========================================

    // Обработка формы заявки с сайта
    async handleWebsiteApplication(formData) {
        try {
            const applicationData = {
                source: 'website',
                customer_name: formData.name || 'Anonymous',
                contact_method: formData.contact_method || 'email',
                contact_value: formData.email || formData.phone || '',
                application_notes: `Bike type: ${formData.bike_type || 'N/A'}. Budget: ${formData.budget_min || '0'}-${formData.budget_max || '0'}. Purpose: ${formData.usage_purpose || 'N/A'}. Height: ${formData.height || 'N/A'}. Questions: ${formData.questions || 'N/A'}`,
                bike_url: formData.bike_url || null,
                estimated_budget_eur: parseInt(formData.budget_max) || null,
                status: 'new'
            };

            return await this.createApplication(applicationData);
        } catch (error) {
            console.error('Ошибка обработки заявки с сайта:', error);
            throw error;
        }
    }

    // ========================================
    // 👤 ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ
    // ========================================

    // Получение заказов пользователя по email
    async getUserOrders(userEmail, limit = 20, offset = 0) {
        try {
            console.log('👤 Получаем заказы пользователя:', userEmail);
            
            // В SQLite режиме используем _request
            if (this.db) {
                // В канонической таблице orders связь идет через customer_id, 
                // а не напрямую через email. Нам нужно найти клиента сначала.
                const customers = await this._request({
                    table: 'customers',
                    method: 'GET',
                    filters: { phone: `eq.${userEmail}` } // Проверяем телефон/ник
                });

                if (!customers || customers.length === 0) {
                    const customersByEmail = await this._request({
                        table: 'customers',
                        method: 'GET',
                        filters: { email: `eq.${userEmail}` }
                    });
                    if (!customersByEmail || customersByEmail.length === 0) return [];
                    customers.push(...customersByEmail);
                }

                const customerId = customers[0].id;
                return await this._request({
                    table: 'orders',
                    method: 'GET',
                    filters: { customer_id: `eq.${customerId}` },
                    select: '*'
                });
            }

            // Supabase fallback
            const { data, error } = await this.supabase
                .from(this.tables.orders)
                .select('*')
                .eq('contact_value', userEmail)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('❌ Ошибка получения заказов пользователя:', error);
            throw error;
        }
    }

    // Получение статистики заказов пользователя
    async getUserOrdersStats(userEmail) {
        try {
            console.log('📊 Получаем статистику заказов для:', userEmail);
            console.log('📋 Используем таблицу:', this.tables.orders);
            
            const { data, error } = await this.supabase
                .from(this.tables.orders)
                .select('status, total_amount, created_at')
                .eq('contact_value', userEmail);

            if (error) {
                console.error('❌ Ошибка получения статистики заказов:', error);
                return { success: false, error: error.message };
            }

            const stats = {
                total_orders: data?.length || 0,
                total_amount: data?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0,
                status_counts: {}
            };

            // Подсчет заказов по статусам
            data?.forEach(order => {
                stats.status_counts[order.status] = (stats.status_counts[order.status] || 0) + 1;
            });

            return { success: true, data: stats };
        } catch (error) {
            console.error('❌ Ошибка получения статистики заказов:', error);
            return { success: false, error: error.message };
        }
    }

    // ========================================
    // 🛒 АВТОМАТИЗИРОВАННОЕ СОЗДАНИЕ ЗАКАЗОВ
    // ========================================

    // Генерация унифицированного ID для всех связанных таблиц
    generateUnifiedOrderId() {
        return Date.now(); // Простой числовой ID на основе timestamp
    }

    // Создание заказа из корзины с автоматическим созданием заявки и всех связанных записей
    async createOrderFromCart(cartData, customerData, needsManager = false, actorUserId = null) {
        try {
            console.log('🛒 Начинаем создание заказа из корзины...');
            
            // 1. Обеспечиваем наличие клиента
            const customer = await this.findOrCreateCustomer({
                full_name: customerData.name || 'Anonymous',
                phone: customerData.phone || null,
                email: customerData.email || null,
                preferred_channel: customerData.contact_method || 'email'
            });

            // 2. СОЗДАЕМ ЗАЯВКУ (автоматически)
            const applicationData = {
                source: 'cart',
                customer_id: customer.id,
                bike_url: cartData.bike_url || null,
                bike_snapshot: cartData.bike_snapshot || null,
                application_notes: customerData.notes || cartData.notes || 'Order from cart',
                status: needsManager ? 'new' : 'converted',
                created_at: new Date().toISOString()
            };

            const application = await this.createApplication(applicationData);
            console.log('✅ Заявка создана:', application.id);

            // 3. СОЗДАЕМ ЗАКАЗ
            const orderPayload = {
                lead_id: application.id,
                customer_id: customer.id,
                bike_id: cartData.bike_id, // Pass bike_id
                bike_url: cartData.bike_url || null,
                bike_snapshot: cartData.bike_snapshot || null,
                final_price_eur: parseFloat(cartData.bike_price) || 0,
                // booking_price removed to fix 400 error
                status: needsManager ? 'awaiting_payment' : 'awaiting_payment', // Canonical status
                assigned_manager: null,
                order_notes: customerData.notes || cartData.notes || null
            };

            const order = await this.createOrder(orderPayload);
            console.log('✅ Заказ создан:', order.id);

            // 4. СОЗДАЕМ ФИНАНСОВУЮ ЗАПИСЬ
            const financeData = {
                order_id: order.id,
                direction: 'incoming',
                role: 'client_payment',
                method: cartData.payment_method || 'online_cashbox',
                amount: parseFloat(cartData.bike_price) || 0,
                currency: 'EUR',
                status: 'planned',
                created_by: actorUserId
            };

            const financeRecord = await this.createFinanceRecord(financeData);
            console.log('✅ Финансовая запись создана:', financeRecord.id);

            // 5. СОЗДАЕМ ЛОГИСТИЧЕСКУЮ ЗАПИСЬ
            const logisticsData = {
                order_id: order.id,
                provider: cartData.delivery_method === 'rusbid' ? 'rusbid' : 'rusbid', // Default to rusbid as per schema enum
                estimated_delivery_date: this.calculateEstimatedDelivery(cartData.delivery_method),
                warehouse_received: false
            };

            const logisticsRecord = await this.createLogisticsRecord(logisticsData);
            console.log('✅ Логистическая запись создана:', logisticsRecord.id);

            return {
                success: true,
                order_id: order.id,
                order_number: order.order_code,
                lead_id: application.id,
                tracking_url: `/order-tracking/${application.id}`
            };

        } catch (error) {
            console.error('💥 Ошибка создания заказа из корзины:', error);
            throw error;
        }
    }

    // Вспомогательная функция для расчета ориентировочной даты доставки
    calculateEstimatedDelivery(deliveryMethod) {
        const now = new Date();
        let daysToAdd = 7; // По умолчанию 7 дней
        
        switch(deliveryMethod) {
            case 'express':
                daysToAdd = 2;
                break;
            case 'courier':
                daysToAdd = 3;
                break;
            case 'pickup':
                daysToAdd = 1;
                break;
            case 'post':
                daysToAdd = 10;
                break;
        }
        
        now.setDate(now.getDate() + daysToAdd);
        return now.toISOString().split('T')[0]; // Возвращаем только дату
    }

    // Обработка оплаты заказа с автоматическим обновлением всех связанных записей
    async processPayment(orderId, paymentData) {
        try {
            console.log('💳 Обрабатываем оплату для заказа:', orderId);
            
            await this.updateOrderStatus(orderId, 'paid', 'Оплата получена', null);
            
            const financeUpdate = {
                payment_status: 'completed',
                payment_date: new Date().toISOString(),
                transaction_id: paymentData.transaction_id,
                payment_amount: paymentData.amount,
                updated_at: new Date().toISOString()
            };
            
            // Рассчитываем прибыль
            const financeRecord = await this.getFinances({ order_id: orderId });
            if (financeRecord && financeRecord.length > 0) {
                const record = financeRecord[0];
                const profit = paymentData.amount - record.bike_cost - record.delivery_cost - (paymentData.amount * record.commission_rate);
                financeUpdate.profit_margin = profit;
                financeUpdate.profit_percentage = (profit / paymentData.amount) * 100;
            }
            
            await this.updateFinanceRecord(orderId, financeUpdate);
            
            await this.recordPaymentLedger({
                order_id: orderId,
                chain_step: 'client_payment',
                direction: 'incoming',
                method: paymentData.method || null,
                currency: paymentData.currency || null,
                amount: paymentData.amount,
                status: 'completed',
                external_reference: paymentData.transaction_id || null,
                comment: 'process_payment'
            });

            await this.updateLogisticsStatus(orderId, 'processing', 'Заказ оплачен, готовится к отправке');
            
            console.log('✅ Оплата успешно обработана');
            return { success: true, order_id: orderId };
            
        } catch (error) {
            console.error('💥 Ошибка обработки оплаты:', error);
            throw error;
        }
    }

    // Обновление финансовой записи
    async updateFinanceRecord(orderId, updateData) {
        try {
            return await this._request({
                table: 'finances',
                method: 'PATCH',
                body: updateData,
                filters: { order_id: `eq.${orderId}` }
            });
        } catch (error) {
            console.error('Ошибка обновления финансовой записи:', error);
            throw error;
        }
    }

    // Обновление логистического статуса
    async updateLogisticsStatus(orderId, newStatus, statusNote = '') {
        try {
            const updateData = {
                delivery_status: newStatus,
                status_notes: statusNote,
                updated_at: new Date().toISOString()
            };

            await this._request({
                table: 'logistics',
                method: 'PATCH',
                body: updateData,
                filters: { order_id: `eq.${orderId}` }
            });

            // Добавляем запись в историю
            await this.addStatusHistory(orderId, newStatus, statusNote, null);

            return { success: true };
        } catch (error) {
            console.error('Ошибка обновления логистического статуса:', error);
            throw error;
        }
    }

    async createTaskRecord(taskData) {
        const payload = taskData || {};

        return await this.callRpc('create_task', {
            p_order_id: payload.order_id || null,
            p_application_id: payload.application_id || null,
            p_title: payload.title || null,
            p_description: payload.description || null,
            p_status: payload.status || 'open',
            p_priority: payload.priority || 'medium',
            p_assignee_id: payload.assignee_id || null,
            p_created_by: payload.created_by || null,
            p_due_at: payload.due_at || null
        });
    }

    async completeTask(taskId, completedBy = null) {
        return await this.callRpc('mark_task_completed', {
            p_task_id: taskId,
            p_completed_by: completedBy
        });
    }

    async attachDocumentRecord(documentData) {
        const payload = documentData || {};

        return await this.callRpc('attach_document', {
            p_order_id: payload.order_id || null,
            p_application_id: payload.application_id || null,
            p_document_type: payload.document_type || null,
            p_status: payload.status || null,
            p_storage_url: payload.storage_url || null,
            p_content_hash: payload.content_hash || null,
            p_uploaded_by: payload.uploaded_by || null,
            p_verified_by: payload.verified_by || null,
            p_metadata: payload.metadata || {}
        });
    }

    // ========================================
    // 🛒 КОРЗИНА (SHOPPING CART)
    // ========================================

    async getCart(userId) {
        try {
            if (this.db) {
                const sql = `
                    SELECT 
                        sc.id, sc.user_id, sc.bike_id, sc.quantity, sc.calculated_price,
                        b.name, b.brand, b.model, b.price, b.main_image as image
                    FROM shopping_cart sc
                    JOIN bikes b ON sc.bike_id = b.id
                    WHERE sc.user_id = ?
                `;
                const items = await this.db.query(sql, [userId]);
                return items.map(item => ({
                    ...item,
                    image: item.image // You might need image resolution logic here or on frontend
                }));
            } else {
                // Supabase
                const { data, error } = await this.supabase
                    .from('shopping_cart')
                    .select(`
                        *,
                        bikes:bike_id (name, brand, model, price, main_image)
                    `)
                    .eq('user_id', userId);
                
                if (error) throw error;
                return data.map(item => ({
                    id: item.id,
                    user_id: item.user_id,
                    bike_id: item.bike_id,
                    quantity: item.quantity,
                    calculated_price: item.calculated_price,
                    name: item.bikes?.name,
                    brand: item.bikes?.brand,
                    model: item.bikes?.model,
                    price: item.bikes?.price,
                    image: item.bikes?.main_image
                }));
            }
        } catch (error) {
            console.error('Error getting cart:', error);
            return [];
        }
    }

    async addToCart(userId, item) {
        try {
            const { bike_id, quantity, calculated_price } = item;
            if (this.db) {
                // Check if exists
                const existing = await this.db.query('SELECT id, quantity FROM shopping_cart WHERE user_id = ? AND bike_id = ?', [userId, bike_id]);
                if (existing.length > 0) {
                    await this.db.query('UPDATE shopping_cart SET quantity = quantity + ? WHERE id = ?', [quantity, existing[0].id]);
                } else {
                    await this.db.query('INSERT INTO shopping_cart (user_id, bike_id, quantity, calculated_price) VALUES (?, ?, ?, ?)', [userId, bike_id, quantity, calculated_price]);
                }
            } else {
                // Supabase
                const { data: existing } = await this.supabase
                    .from('shopping_cart')
                    .select('id, quantity')
                    .eq('user_id', userId)
                    .eq('bike_id', bike_id)
                    .single();

                if (existing) {
                    await this.supabase
                        .from('shopping_cart')
                        .update({ quantity: existing.quantity + quantity })
                        .eq('id', existing.id);
                } else {
                    await this.supabase
                        .from('shopping_cart')
                        .insert({ user_id: userId, bike_id, quantity, calculated_price });
                }
            }
            return { success: true };
        } catch (error) {
            console.error('Error adding to cart:', error);
            throw error;
        }
    }

    async updateCartItem(userId, bikeId, quantity) {
        try {
            if (this.db) {
                await this.db.query('UPDATE shopping_cart SET quantity = ? WHERE user_id = ? AND bike_id = ?', [quantity, userId, bikeId]);
            } else {
                await this.supabase
                    .from('shopping_cart')
                    .update({ quantity })
                    .eq('user_id', userId)
                    .eq('bike_id', bikeId);
            }
            return { success: true };
        } catch (error) {
            console.error('Error updating cart:', error);
            throw error;
        }
    }

    async removeFromCart(userId, bikeId) {
        try {
            if (this.db) {
                await this.db.query('DELETE FROM shopping_cart WHERE user_id = ? AND bike_id = ?', [userId, bikeId]);
            } else {
                await this.supabase
                    .from('shopping_cart')
                    .delete()
                    .eq('user_id', userId)
                    .eq('bike_id', bikeId);
            }
            return { success: true };
        } catch (error) {
            console.error('Error removing from cart:', error);
            throw error;
        }
    }

    async clearCart(userId) {
        try {
            if (this.db) {
                await this.db.query('DELETE FROM shopping_cart WHERE user_id = ?', [userId]);
            } else {
                await this.supabase
                    .from('shopping_cart')
                    .delete()
                    .eq('user_id', userId);
            }
            return { success: true };
        } catch (error) {
            console.error('Error clearing cart:', error);
            throw error;
        }
    }
}

// ========================================
// 🌐 ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
// ========================================

// Конфигурация для подключения к Supabase
const CRM_CONFIG = {
    // Реальные данные Supabase проекта
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://lclalsznmrjgqsgaqtps.supabase.co',
    SUPABASE_ANON_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbGFsc3pubXJqZ3FzZ2FxdHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5Nzg5MDgsImV4cCI6MjA3NjU1NDkwOH0.nyTQDoddHyrY4_QizmQFLue8EjNqeQaJ0U021Hbc7YI'
};

// Глобальный экземпляр API
let crmApi = null;

// Инициализация API
function initializeCRM(supabaseUrl = CRM_CONFIG.SUPABASE_URL, supabaseKey = CRM_CONFIG.SUPABASE_ANON_KEY, db = null) {
    crmApi = new CRMApi(supabaseUrl, supabaseKey, db);
    // Делаем crmApi доступным глобально
    if (typeof window !== 'undefined') {
        window.crmApi = crmApi;
    }
    console.log('CRM API инициализирован' + (db ? ' (с поддержкой локальной БД)' : ''));
    return crmApi;
}

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CRMApi, initializeCRM };
}

// ========================================
// 📝 ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
// ========================================

/*
// Инициализация
const crm = initializeCRM('your-supabase-url', 'your-supabase-key');

// Создание заявки
const newApplication = await crm.createApplication({
    customer_name: 'Иван Петров',
    contact_method: 'email',
    contact_value: 'ivan@example.com',
    bike_interest: 'mountain',
    budget_max: 2000
});

// Получение заказов
const orders = await crm.getOrders({ status: 'new' });

// Обновление статуса заказа
await crm.updateOrderStatus('order-id', 'confirmed', 'Подтверждено менеджером', 'employee-id');

// Получение статистики
const stats = await crm.getApplicationsStats();
const conversion = await crm.getConversionRate('2024-01-01', '2024-12-31');

// ========================================
// 🔗 НОВЫЕ МЕТОДЫ ДЛЯ РАБОТЫ СО СВЯЗЯМИ
// ========================================

// Получение полной информации о заказе (с заявкой, финансами и логистикой)
const fullOrderInfo = await crm.getOrderFullInfo('order-123');

// Получение истории заказа с данными сотрудника
const orderHistory = await crm.getOrderHistoryWithEmployee('order-123');

// Получение заказов конкретного менеджера
const managerOrders = await crm.getOrdersByManager('manager-456');

// Создание заказа из заявки (автоматическое связывание)
const newOrder = await crm.createOrderFromApplication('app-789', {
    manager_assigned: 'manager-456',
    priority: 'high'
});

// Получение всех связанных данных для заказа
const relatedData = await crm.getOrderRelatedData('order-123');
console.log('Заказ:', relatedData.order);
console.log('История:', relatedData.history);
console.log('Финансы:', relatedData.finances);
console.log('Логистика:', relatedData.logistics);

// Получение общей статистики по всем связанным данным
const relatedStats = await crm.getRelatedDataStats();
console.log('Статистика заявок:', relatedStats.applications);
console.log('Статистика заказов:', relatedStats.orders);
console.log('Статистика финансов:', relatedStats.finances);
console.log('Статистика логистики:', relatedStats.logistics);
*/
