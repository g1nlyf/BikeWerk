// BikeEU - Main JavaScript
// Neo-Lux Minimalism interactions

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initHeader();
    initMobileMenu();
    initProductCards();
    initContactForm();
    initScrollToTop();
    initAccordion();
    
    console.log('BikeEU initialized');
});

// Header functionality
function initHeader() {
    const header = document.getElementById('header');
    let lastScrollY = window.scrollY;
    let isScrolling = false;
    
    function updateHeader() {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) {
            header.classList.add('header-sticky');
        } else {
            header.classList.remove('header-sticky');
        }
        
        lastScrollY = currentScrollY;
        isScrolling = false;
    }
    
    window.addEventListener('scroll', function() {
        if (!isScrolling) {
            requestAnimationFrame(updateHeader);
            isScrolling = true;
        }
    });
}

// Mobile menu functionality
function initMobileMenu() {
    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');
    const mobileMenu = document.querySelector('.mobile-menu');
    const body = document.body;
    
    if (!mobileToggle) return;
    
    mobileToggle.addEventListener('click', function() {
        const isExpanded = mobileToggle.getAttribute('aria-expanded') === 'true';
        
        mobileToggle.setAttribute('aria-expanded', !isExpanded);
        
        // Handle both nav systems
        if (nav) {
            nav.classList.toggle('nav-open');
        }
        if (mobileMenu) {
            mobileMenu.classList.toggle('active');
        }
        
        body.classList.toggle('menu-open');
        
        // Animate hamburger
        mobileToggle.classList.toggle('active');
    });
    
    // Close menu when clicking nav links
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (nav) {
                nav.classList.remove('nav-open');
            }
            if (mobileMenu) {
                mobileMenu.classList.remove('active');
            }
            body.classList.remove('menu-open');
            mobileToggle.setAttribute('aria-expanded', 'false');
            mobileToggle.classList.remove('active');
        });
    });
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && (
            (nav && nav.classList.contains('nav-open')) || 
            (mobileMenu && mobileMenu.classList.contains('active'))
        )) {
            if (nav) {
                nav.classList.remove('nav-open');
            }
            if (mobileMenu) {
                mobileMenu.classList.remove('active');
            }
            body.classList.remove('menu-open');
            mobileToggle.setAttribute('aria-expanded', 'false');
            mobileToggle.classList.remove('active');
        }
    });
}

// Product cards interactions
function initProductCards() {
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const actions = card.querySelector('.product-actions');
        
        if (actions) {
            // Show/hide actions on hover
            card.addEventListener('mouseenter', function() {
                actions.style.opacity = '1';
                actions.style.transform = 'translateY(0)';
            });
            
            card.addEventListener('mouseleave', function() {
                actions.style.opacity = '0';
                actions.style.transform = 'translateY(8px)';
            });
        }
        
        // Handle action buttons
        const actionButtons = card.querySelectorAll('.product-action');
        actionButtons.forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Add ripple effect
                createRipple(button, e);
                
                // Handle specific actions
                const svg = button.querySelector('svg');
                if (svg) {
                    const path = svg.querySelector('path');
                    if (path && path.getAttribute('d').includes('20.84 4.61')) {
                        // Heart icon - toggle favorite
                        toggleFavorite(button);
                    } else {
                        // Eye icon - quick view
                        openQuickView(card);
                    }
                }
            });
        });
    });
}

// Toggle favorite state
function toggleFavorite(button) {
    const svg = button.querySelector('svg');
    const isActive = button.classList.contains('active');
    
    if (isActive) {
        button.classList.remove('active');
        svg.style.fill = 'none';
        showToast('Удалено из избранного');
    } else {
        button.classList.add('active');
        svg.style.fill = 'var(--warm-accent)';
        showToast('Добавлено в избранное');
    }
}

// Quick view functionality
function openQuickView(card) {
    const title = card.querySelector('.product-title').textContent;
    const price = card.querySelector('.product-price').textContent;
    const image = card.querySelector('.product-image').src;
    
    // Create modal (simplified version)
    const modal = document.createElement('div');
    modal.className = 'modal modal-quick-view';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <button class="modal-close" aria-label="Закрыть">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="quick-view-content">
                <img src="${image}" alt="${title}" class="quick-view-image">
                <div class="quick-view-info">
                    <h3>${title}</h3>
                    <div class="price">${price}</div>
                    <a href="bike-selection.html" class="btn btn-primary">Подробнее</a>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    
    // Animate in
    requestAnimationFrame(() => {
        modal.classList.add('modal-open');
    });
    
    // Close handlers
    const closeBtn = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    function closeModal() {
        modal.classList.remove('modal-open');
        setTimeout(() => {
            document.body.removeChild(modal);
            document.body.classList.remove('modal-open');
        }, 280);
    }
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
}

// Contact form handling
function initContactForm() {
    const form = document.querySelector('.contact-form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Validate form
        if (!validateForm(data)) return;
        
        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Отправка...';
        submitBtn.disabled = true;
        
        // Simulate form submission
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            form.reset();
            showToast('Сообщение отправлено! Мы ответим в течение 24 часов.', 'success');
        }, 2000);
    });
    
    // Input focus effects
    const inputs = form.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('form-group-focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('form-group-focused');
            if (this.value) {
                this.parentElement.classList.add('form-group-filled');
            } else {
                this.parentElement.classList.remove('form-group-filled');
            }
        });
    });
}

// Form validation
function validateForm(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length < 2) {
        errors.push('Введите корректное имя');
    }
    
    if (!data.email || !isValidEmail(data.email)) {
        errors.push('Введите корректный email');
    }
    
    if (!data.message || data.message.trim().length < 10) {
        errors.push('Сообщение должно содержать минимум 10 символов');
    }
    
    if (errors.length > 0) {
        showToast(errors.join('. '), 'error');
        return false;
    }
    
    return true;
}

// Email validation
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Toast notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.classList.add('toast-show');
    });
    
    // Auto remove
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// Ripple effect for buttons
function createRipple(element, event) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        if (element.contains(ripple)) {
            element.removeChild(ripple);
        }
    }, 600);
}

// Scroll to top functionality
function initScrollToTop() {
    const scrollBtn = document.createElement('button');
    scrollBtn.className = 'scroll-to-top';
    scrollBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18,15 12,9 6,15"></polyline>
        </svg>
    `;
    scrollBtn.setAttribute('aria-label', 'Наверх');
    
    document.body.appendChild(scrollBtn);
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 500) {
            scrollBtn.classList.add('scroll-to-top-visible');
        } else {
            scrollBtn.classList.remove('scroll-to-top-visible');
        }
    });
    
    scrollBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Accessibility helpers
function trapFocus(element) {
    const focusableElements = element.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    );
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];
    
    element.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastFocusableElement) {
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        }
    });
}

// FAQ Accordion
function initAccordion() {
    const container = document.getElementById('faq-accordion');
    if (!container) return;

    const triggers = container.querySelectorAll('.accordion-trigger');

    function closeOthers(currentTrigger) {
        triggers.forEach(trigger => {
            if (trigger === currentTrigger) return;
            const panelId = trigger.getAttribute('aria-controls');
            const panel = document.getElementById(panelId);
            if (!panel) return;
            trigger.setAttribute('aria-expanded', 'false');
            panel.hidden = true;
        });
    }

    function toggle(trigger) {
        const panelId = trigger.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);
        if (!panel) return;

        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            trigger.setAttribute('aria-expanded', 'false');
            panel.hidden = true;
        } else {
            closeOthers(trigger);
            trigger.setAttribute('aria-expanded', 'true');
            panel.hidden = false;
        }
    }

    triggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            toggle(trigger);
        });

        trigger.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(trigger);
            }
        });
    });
}