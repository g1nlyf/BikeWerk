
// Wait for unified system to be ready
document.addEventListener('unifiedSystemReady', function(event) {
    // System is ready, can use window.unifiedAuth, window.unifiedHeader, window.unifiedLogin
});
// Universal Header Manager
class HeaderManager {
    constructor() {
        this.currentUser = null;
        this.cartCount = 0;
        this.isProfileDropdownOpen = false;
        
        this.init();
    }

    async init() {
        // Wait for DOM and global auth to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupHeader());
        } else {
            this.setupHeader();
        }

        // Listen for auth state changes
        if (window.unifiedAuth) {
            window.unifiedAuth.addListener((event, data) => {
                if (event === 'login') {
                    this.handleLogin(data);
                } else if (event === 'logout') {
                    this.handleLogout();
                }
            });
        }
    }

    setupHeader() {
        this.updateAuthState();
        this.updateCartCount();
        this.highlightCurrentPage();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const profileDropdown = document.getElementById('profile-dropdown');
            if (profileDropdown && this.isProfileDropdownOpen) {
                if (!profileDropdown.contains(e.target)) {
                    this.closeProfileDropdown();
                }
            }
        });

        // Handle mobile menu toggle
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }
    }

    updateAuthState() {
        const isAuthenticated = window.unifiedAuth?.isAuthenticated();
        const user = window.unifiedAuth?.getCurrentUser();

        // Desktop elements
        const loginBtn = document.getElementById('login-btn');
        const profileDropdown = document.getElementById('profile-dropdown');
        const profileName = document.getElementById('profile-name');

        // Mobile elements
        const mobileLoginBtn = document.getElementById('mobile-login-btn');
        const mobileProfileBtn = document.getElementById('mobile-profile-btn');

        if (isAuthenticated && user) {
            // User is logged in
            if (loginBtn) loginBtn.style.display = 'none';
            if (profileDropdown) profileDropdown.style.display = 'block';
            if (profileName) profileName.textContent = window.unifiedAuth.getUserDisplayName();

            if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
            if (mobileProfileBtn) mobileProfileBtn.style.display = 'block';

            this.currentUser = user;
        } else {
            // User is not logged in
            if (loginBtn) loginBtn.style.display = 'block';
            if (profileDropdown) profileDropdown.style.display = 'none';

            if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
            if (mobileProfileBtn) mobileProfileBtn.style.display = 'none';

            this.currentUser = null;
        }
    }

    handleLogin(user) {
        this.currentUser = user;
        this.updateAuthState();
        this.updateCartCount(); // Refresh cart count for logged in user
    }

    handleLogout() {
        this.currentUser = null;
        this.updateAuthState();
        this.updateCartCount(); // Refresh cart count for guest user
        this.closeProfileDropdown();
    }

    toggleProfileDropdown() {
        const profileBtn = document.getElementById('profile-btn');
        const profileMenu = document.getElementById('profile-menu');

        if (this.isProfileDropdownOpen) {
            this.closeProfileDropdown();
        } else {
            this.openProfileDropdown();
        }
    }

    openProfileDropdown() {
        const profileBtn = document.getElementById('profile-btn');
        const profileMenu = document.getElementById('profile-menu');

        if (profileBtn && profileMenu) {
            profileBtn.setAttribute('aria-expanded', 'true');
            profileMenu.style.display = 'block';
            this.isProfileDropdownOpen = true;
        }
    }

    closeProfileDropdown() {
        const profileBtn = document.getElementById('profile-btn');
        const profileMenu = document.getElementById('profile-menu');

        if (profileBtn && profileMenu) {
            profileBtn.setAttribute('aria-expanded', 'false');
            profileMenu.style.display = 'none';
            this.isProfileDropdownOpen = false;
        }
    }

    async updateCartCount() {
        try {
            let count = 0;

            if (window.unifiedAuth?.isAuthenticated()) {
                // Get cart count from API for authenticated users
                const cartData = await window.apiClient?.getCart();
                if (cartData && cartData.success && cartData.cart) {
                    count = cartData.cart.reduce((total, item) => total + item.quantity, 0);
                }
            } else {
                // Get cart count from localStorage for guest users
                const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
                count = localCart.reduce((total, item) => total + item.quantity, 0);
            }

            this.cartCount = count;
            this.displayCartCount(count);
        } catch (error) {
            console.error('Error updating cart count:', error);
            // Fallback to localStorage
            const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
            const count = localCart.reduce((total, item) => total + item.quantity, 0);
            this.cartCount = count;
            this.displayCartCount(count);
        }
    }

    displayCartCount(count) {
        const cartCountElements = document.querySelectorAll('.cart-count, #cart-count, #cart-count-menu');
        cartCountElements.forEach(element => {
            if (element) {
                element.textContent = count;
                element.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        });
    }

    highlightCurrentPage() {
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link[data-page]');

        navLinks.forEach(link => {
            const page = link.getAttribute('data-page');
            link.classList.remove('active');

            if (currentPath.includes(page) || 
                (page === 'index' && (currentPath === '/' || currentPath.includes('index.html')))) {
                link.classList.add('active');
            }
        });
    }

    toggleMobileMenu() {
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        const mobileNav = document.querySelector('.mobile-nav');
        
        if (mobileMenuToggle && mobileNav) {
            const isOpen = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
            
            mobileMenuToggle.setAttribute('aria-expanded', !isOpen);
            mobileMenuToggle.classList.toggle('active');
            mobileNav.classList.toggle('active');
            
            // Prevent body scroll when menu is open
            document.body.style.overflow = isOpen ? '' : 'hidden';
        }
    }

    // Global logout function
    logout() {
        if (window.unifiedAuth) {
            window.unifiedAuth.logout();
        }
        
        // Redirect to home page
        window.location.href = 'index.html';
    }
}

// Global functions for backward compatibility
function logout() {
    window.headerManager?.logout();
}

function toggleMobileMenu() {
    window.headerManager?.toggleMobileMenu();
}

function toggleMobileProfileMenu() {
    // For mobile, we can show a simple menu or redirect to profile page
    window.headerManager?.toggleProfileDropdown();
}

// Initialize header manager
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.headerManager = new HeaderManager();
    });
} else {
    window.headerManager = new HeaderManager();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderManager;
}