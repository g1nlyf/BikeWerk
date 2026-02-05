// API Client for EUBike SQLite Backend
class APIClient {
    constructor() {
        this.baseURL = 'http://localhost:8080/api';
        this.token = localStorage.getItem('authToken'); // Исправлено: используем 'authToken' как везде
    }

    // Helper method to make HTTP requests
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        

        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add auth token if available
        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Handle different error message formats
                let errorMessage = data.message || data.error;
                
                // Provide user-friendly messages for common errors
                if (response.status === 401) {
                    errorMessage = errorMessage === 'Invalid credentials' ? 
                        'Неверный email или пароль' : 
                        (errorMessage || 'Ошибка авторизации');
                } else if (response.status === 400) {
                    errorMessage = errorMessage || 'Неверные данные запроса';
                } else if (response.status === 500) {
                    errorMessage = 'Ошибка сервера. Попробуйте позже';
                } else {
                    errorMessage = errorMessage || `Ошибка ${response.status}`;
                }
                
                throw new Error(errorMessage);
            }


            return data;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Authentication methods
    async register(userData) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (response.token) {
            this.token = response.token;
            localStorage.setItem('authToken', this.token);
        }
        
        return response;
    }

    async login(credentials) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });
        
        if (response.token) {
            this.token = response.token;
            localStorage.setItem('authToken', this.token);
        }
        
        return response;
    }

    async getCurrentUser() {
        return await this.request('/auth/me');
    }

    async logout() {
        try {
            // Call server logout if we have a token
            if (this.token) {
                await this.request('/auth/logout', {
                    method: 'POST'
                });
            }
        } catch (error) {
            console.error('Server logout error:', error);
            // Continue with local logout even if server call fails
        } finally {
            // Always clear local state
            this.token = null;
            localStorage.removeItem('authToken');
        }
    }

    // Bikes methods
    async getBikes(filters = {}) {
        const queryParams = new URLSearchParams();
        
        // Add filters to query params
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null) {
                if (Array.isArray(filters[key])) {
                    filters[key].forEach(value => queryParams.append(key, value));
                } else {
                    queryParams.append(key, filters[key]);
                }
            }
        });

        const endpoint = queryParams.toString() ? `/bikes?${queryParams}` : '/bikes';
        return await this.request(endpoint);
    }

    async getBike(id) {
        return await this.request(`/bikes/${id}`);
    }

    async addBike(bikeData) {
        return await this.request('/bikes', {
            method: 'POST',
            body: JSON.stringify(bikeData)
        });
    }

    // Favorites methods
    async getFavorites() {
        return await this.request('/favorites');
    }

    async addToFavorites(bikeId) {
        return await this.request('/favorites', {
            method: 'POST',
            body: JSON.stringify({ bikeId })
        });
    }

    async removeFromFavorites(bikeId) {
        return await this.request(`/favorites/${bikeId}`, {
            method: 'DELETE'
        });
    }

    // Cart methods
    async getCart() {
        console.log('=== API getCart Request ===');
        console.log('Token exists:', !!this.token);
        
        try {
            const result = await this.request('/cart');
            console.log('=== API getCart Response ===');
            console.log('Response data:', result);
            return result;
        } catch (error) {
            console.error('=== API getCart Error ===');
            console.error('Error:', error);
            throw error;
        }
    }

    async addToCart(bikeId, quantity = 1, calculatedPrice = null) {
        console.log('=== API Request to /cart ===');
        console.log('Token exists:', !!this.token);
        console.log('Config:', {
            method: 'POST',
            body: JSON.stringify({ bikeId, quantity, calculatedPrice })
        });
        
        try {
            const result = await this.request('/cart', {
                method: 'POST',
                body: JSON.stringify({ bikeId, quantity, calculatedPrice })
            });
            console.log('=== API Response from /cart ===');
            console.log('Response data:', result);
            return result;
        } catch (error) {
            console.error('=== API Error from /cart ===');
            console.error('Error:', error);
            throw error;
        }
    }

    async removeFromCart(bikeId) {
        return await this.request(`/cart/${bikeId}`, {
            method: 'DELETE'
        });
    }

    async clearCart() {
        console.log('=== API clearCart Request ===');
        console.log('Token exists:', !!this.token);
        
        try {
            const result = await this.request('/cart/clear', {
                method: 'DELETE'
            });
            console.log('=== API clearCart Response ===');
            console.log('Response data:', result);
            return result;
        } catch (error) {
            console.error('=== API clearCart Error ===');
            console.error('Error:', error);
            throw error;
        }
    }

    async updateCartQuantity(bikeId, quantity) {
        console.log('=== API updateCartQuantity ===');
        console.log('Bike ID:', bikeId);
        console.log('Quantity:', quantity);
        console.log('Token exists:', !!this.token);
        console.log('Token value:', this.token ? this.token.substring(0, 20) + '...' : 'null');
        
        return await this.request(`/cart/${bikeId}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
    }

    // Helper method to check if user is authenticated
    isAuthenticated() {
        return !!this.token;
    }

    // Method to sync token from localStorage (for cases when token is set externally)
    syncTokenFromStorage() {
        const storedToken = localStorage.getItem('authToken');
        if (storedToken && storedToken !== this.token) {
            this.token = storedToken;
            console.log('APIClient token synced from localStorage');
        }
    }

    // Create order from cart using CRM API (Supabase)
    async createOrder() {
        console.log('=== API createOrder (CRM) ===');
        console.log('Token exists:', !!this.token);
        
        try {
            // Ensure CRM API is initialized
            if (!window.crmApi) {
                console.log('Initializing CRM API...');
                if (typeof initializeCRM === 'function') {
                    initializeCRM();
                } else {
                    throw new Error('CRM API not available');
                }
            }
            
            // Get cart data from local storage or API
            const cartResponse = await this.getCart();
            if (!cartResponse.success || !cartResponse.cart || cartResponse.cart.length === 0) {
                throw new Error('Корзина пуста');
            }
            
            // Get user data - check multiple possible sources
            let userData = null;
            
            // Try to get user data from different sources
            const currentUser = localStorage.getItem('currentUser');
            if (currentUser) {
                userData = JSON.parse(currentUser);
            }
            
            // Fallback: try to get current user via API
            if (!userData || !userData.id) {
                try {
                    const apiUser = await this.getCurrentUser();
                    if (apiUser && apiUser.id) {
                        userData = apiUser;
                    }
                } catch (error) {
                    console.log('Could not get user from API:', error);
                }
            }
            
            // Final check
            if (!userData || !userData.id) {
                throw new Error('Пользователь не авторизован');
            }
            
            // Prepare cart data for CRM API
            const cart = cartResponse.cart;
            const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // Use the first item as primary bike (for compatibility with CRM API)
            const primaryBike = cart[0];
            
            const cartData = {
                bike_type: primaryBike.name,
                bike_size: primaryBike.size || 'Не указан',
                bike_color: primaryBike.color || 'Не указан',
                bike_price: totalAmount,
                bike_url: window.location.origin + '/product-detail.html?id=' + primaryBike.bike_id,
                quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
                specifications: cart.map(item => `${item.name} (${item.quantity} шт.)`).join(', '),
                notes: `Заказ из корзины. Товары: ${cart.map(item => `${item.name} x${item.quantity}`).join(', ')}`
            };
            
            const customerData = {
                name: userData.name || userData.username || 'Не указано',
                email: userData.email || 'Не указано',
                phone: userData.phone || 'Не указано',
                contact_method: 'email',
                address: 'Не указан',
                notes: 'Заказ создан через корзину'
            };
            
            console.log('Creating order via CRM API...');
            console.log('Cart data:', cartData);
            console.log('Customer data:', customerData);
            
            // Create order via CRM API
            const result = await window.crmApi.createOrderFromCart(cartData, customerData, false);
            
            console.log('CRM API result:', result);
            
            // Clear cart after successful order creation
            if (result && result.order) {
                await this.clearCart();
            }
            
            return {
                success: true,
                order: result.order,
                message: 'Заказ успешно создан'
            };
            
        } catch (error) {
            console.error('Error creating order via CRM API:', error);
            return {
                success: false,
                error: error.message || 'Ошибка при создании заказа'
            };
        }
    }

    // Get user orders
    async getOrders() {
        console.log('=== API getOrders ===');
        console.log('Token exists:', !!this.token);
        
        return await this.request('/orders', {
            method: 'GET'
        });
    }
}

// Create global instance
window.apiClient = new APIClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}