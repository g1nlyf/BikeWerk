
// Wait for unified system to be ready
document.addEventListener('unifiedSystemReady', function(event) {
    // System is ready, can use window.unifiedAuth, window.unifiedHeader, window.unifiedLogin
});
// Login Overlay Manager
class LoginOverlayManager {
    constructor() {
        this.loginOverlay = null;
        this.registerOverlay = null;
        this.loginForm = null;
        this.registerForm = null;
        
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupElements());
        } else {
            this.setupElements();
        }
    }

    setupElements() {
        this.loginOverlay = document.getElementById('login-overlay');
        this.registerOverlay = document.getElementById('register-overlay');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');

        if (this.loginForm) {
            this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        if (this.registerForm) {
            this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideLoginModal();
                this.hideRegisterModal();
            }
        });
    }

    showLoginModal() {
        if (this.loginOverlay) {
            this.loginOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Focus on email input
            const emailInput = document.getElementById('login-email');
            if (emailInput) {
                setTimeout(() => emailInput.focus(), 100);
            }
        }
    }

    hideLoginModal() {
        if (this.loginOverlay) {
            this.loginOverlay.style.display = 'none';
            document.body.style.overflow = '';
            this.clearLoginForm();
        }
    }

    showRegisterModal() {
        if (this.registerOverlay) {
            this.registerOverlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Focus on name input
            const nameInput = document.getElementById('register-name');
            if (nameInput) {
                setTimeout(() => nameInput.focus(), 100);
            }
        }
    }

    hideRegisterModal() {
        if (this.registerOverlay) {
            this.registerOverlay.style.display = 'none';
            document.body.style.overflow = '';
            this.clearRegisterForm();
        }
    }

    showRegisterForm() {
        this.hideLoginModal();
        this.showRegisterModal();
    }

    showLoginForm() {
        this.hideRegisterModal();
        this.showLoginModal();
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = document.querySelector('#login-form button[type="submit"]');
        const errorDiv = document.getElementById('login-error');

        // Clear previous errors
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }

        // Validate inputs
        if (!email || !password) {
            this.showError('login-error', 'Пожалуйста, заполните все поля');
            return;
        }

        // Show loading state
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Вход...';
        }

        try {
            // Use unified auth manager
            if (window.unifiedAuth) {
                const result = await window.unifiedAuth.login({ email, password });
                
                if (result.success) {
                    // Hide modal
                    this.hideLoginModal();
                    
                    // Update header UI
                    if (window.modernHeader && typeof window.modernHeader.checkAuthStatus === 'function') {
                        window.modernHeader.checkAuthStatus();
                    }
                    
                    // Redirect if needed
                    const urlParams = new URLSearchParams(window.location.search);
                    const redirect = urlParams.get('redirect');
                    if (redirect) {
                        window.location.href = redirect;
                    }
                }
            } else {
                // Fallback to direct API call
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (data.success) {
                    // Store token
                    localStorage.setItem('authToken', data.token);
                    
                    // Update global auth state
                    if (window.unifiedAuth) {
                        window.unifiedAuth.user = data.user;
                        window.unifiedAuth.token = data.token;
                        window.unifiedAuth.notifyListeners('login', data.user);
                    }

                    // Hide modal and show success
                    this.hideLoginModal();
                    this.showNotification('Добро пожаловать!', 'success');
                    
                    // Update header UI
                    if (window.modernHeader && typeof window.modernHeader.checkAuthStatus === 'function') {
                        window.modernHeader.checkAuthStatus();
                    }
                    
                    // Redirect if needed
                    const urlParams = new URLSearchParams(window.location.search);
                    const redirect = urlParams.get('redirect');
                    if (redirect) {
                        window.location.href = redirect;
                    }
                } else {
                    this.showError('login-error', data.error || 'Ошибка входа');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('login-error', error.message || 'Ошибка соединения с сервером');
        } finally {
            // Reset button state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Войти';
            }
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(this.registerForm);
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            passwordConfirm: formData.get('passwordConfirm')
        };

        const submitBtn = this.registerForm.querySelector('.register-submit-btn');

        try {
            // Validate passwords match
            if (userData.password !== userData.passwordConfirm) {
                throw new Error('Пароли не совпадают');
            }

            // Show loading state
            submitBtn.disabled = true;
            this.hideError('register-error');

            // Attempt registration
            const response = await window.apiClient.register({
                name: userData.name,
                email: userData.email,
                password: userData.password
            });
            
            if (response.success) {
                // Registration successful, now login
                const loginResult = await window.unifiedAuth.login({
                    email: userData.email,
                    password: userData.password
                });
                
                if (loginResult.success) {
                    this.hideRegisterModal();
                    this.showSuccessMessage('Регистрация прошла успешно! Добро пожаловать!');
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showError('register-error', error.message || 'Ошибка регистрации');
        } finally {
            submitBtn.disabled = false;
        }
    }

    showError(errorId, message) {
        const errorDiv = document.getElementById(errorId);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    hideError(errorId) {
        const errorDiv = document.getElementById(errorId);
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
    }

    clearLoginForm() {
        if (this.loginForm) {
            this.loginForm.reset();
            this.hideError('login-error');
        }
    }

    clearRegisterForm() {
        if (this.registerForm) {
            this.registerForm.reset();
            this.hideError('register-error');
        }
    }

    showSuccessMessage(message) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 6px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 10001;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.remove();
            style.remove();
        }, 3000);
    }
}

// Global functions for backward compatibility
function showLoginModal() {
    window.loginOverlayManager?.showLoginModal();
}

function hideLoginModal() {
    window.loginOverlayManager?.hideLoginModal();
}

function showRegisterModal() {
    window.loginOverlayManager?.showRegisterModal();
}

function hideRegisterModal() {
    window.loginOverlayManager?.hideRegisterModal();
}

function showRegisterForm() {
    window.loginOverlayManager?.showRegisterForm();
}

function showLoginForm() {
    window.loginOverlayManager?.showLoginForm();
}

// Export class to global scope
window.LoginOverlayManager = LoginOverlayManager;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.loginOverlayManager = new LoginOverlayManager();
        // Create unified login object for new system
        window.unifiedLogin = window.loginOverlayManager;
        // Create alias for compatibility with header
        window.loginOverlay = {
            showLogin: () => window.loginOverlayManager.showLoginModal(),
            showRegister: () => window.loginOverlayManager.showRegisterModal(),
            hide: () => window.loginOverlayManager.hideLoginModal()
        };
    });
} else {
    window.loginOverlayManager = new LoginOverlayManager();
    // Create unified login object for new system
    window.unifiedLogin = window.loginOverlayManager;
    // Create alias for compatibility with header
    window.loginOverlay = {
        showLogin: () => window.loginOverlayManager.showLoginModal(),
        showRegister: () => window.loginOverlayManager.showRegisterModal(),
        hide: () => window.loginOverlayManager.hideLoginModal()
    };
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginOverlayManager;
}