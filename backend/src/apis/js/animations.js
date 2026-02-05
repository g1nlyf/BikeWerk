// BikeEU - Animations & Micro-interactions
// Neo-Lux Minimalism smooth animations

document.addEventListener('DOMContentLoaded', function() {
    initScrollAnimations();
    initHeroAnimation();
    initStaggeredAnimations();
    
    console.log('Animations initialized');
});

// Initialize scroll-triggered animations
function initScrollAnimations() {
    const sections = document.querySelectorAll('.section');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    sections.forEach(section => {
        sectionObserver.observe(section);
    });
}

// Hero animation sequence
function initHeroAnimation() {
    const heroImage = document.querySelector('.hero-image');
    const heroText = document.querySelector('.hero-text');
    const priceStrip = document.querySelector('.price-strip');
    
    if (heroImage) {
        // Trigger hero image animation
        setTimeout(() => {
            heroImage.style.opacity = '1';
            heroImage.style.transform = 'translateY(0) scale(1)';
        }, 100);
    }
    
    if (heroText) {
        // Stagger text elements
        const textElements = heroText.querySelectorAll('h1, p, .btn-group');
        textElements.forEach((element, index) => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                element.style.transition = 'opacity 520ms cubic-bezier(.2,.9,.3,1), transform 520ms cubic-bezier(.2,.9,.3,1)';
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 300 + (index * 60));
        });
    }
    
    if (priceStrip) {
        // Animate price strip
        setTimeout(() => {
            priceStrip.style.opacity = '1';
            priceStrip.style.transform = 'translateY(0)';
        }, 800);
    }
}

// Staggered animations for lists and grids
function initStaggeredAnimations() {
    const animatedGroups = [
        { selector: '.products-grid .product-card', delay: 60 },
        { selector: '.process-grid .process-step', delay: 60 },
        { selector: '.trust-grid .trust-item', delay: 60 },
        { selector: '.footer-content .footer-section', delay: 60 }
    ];
    
    animatedGroups.forEach(group => {
        const elements = document.querySelectorAll(group.selector);
        
        if (elements.length === 0) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = Array.from(elements).indexOf(entry.target);
                    
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, index * group.delay);
                    
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -30px 0px'
        });
        
        elements.forEach(element => {
            element.style.opacity = '0';
            element.style.transform = 'translateY(12px)';
            element.style.transition = 'opacity 520ms cubic-bezier(.2,.9,.3,1), transform 520ms cubic-bezier(.2,.9,.3,1)';
            observer.observe(element);
        });
    });
}

// Smooth scroll for anchor links
function initSmoothScroll() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Parallax effect for hero image (subtle)
function initParallax() {
    const heroImage = document.querySelector('.hero-image img');
    
    if (!heroImage) return;
    
    let ticking = false;
    
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.1;
        
        heroImage.style.transform = `translateY(${rate}px)`;
        ticking = false;
    }
    
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick);
}

// Counter animation for numbers
function animateCounters() {
    const counters = document.querySelectorAll('[data-count]');
    
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.getAttribute('data-count'));
                const duration = 2000;
                const step = target / (duration / 16);
                let current = 0;
                
                const timer = setInterval(() => {
                    current += step;
                    counter.textContent = Math.floor(current);
                    
                    if (current >= target) {
                        counter.textContent = target;
                        clearInterval(timer);
                    }
                }, 16);
                
                counterObserver.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
}

// Loading animation for images
function initImageLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                const src = img.getAttribute('data-src');
                
                img.style.opacity = '0';
                img.style.transition = 'opacity 300ms ease';
                
                img.onload = function() {
                    img.style.opacity = '1';
                };
                
                img.src = src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px'
    });
    
    images.forEach(img => {
        imageObserver.observe(img);
    });
}

// Magnetic effect for buttons (subtle)
function initMagneticButtons() {
    const buttons = document.querySelectorAll('.btn-primary');
    
    buttons.forEach(button => {
        button.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            const moveX = x * 0.1;
            const moveY = y * 0.1;
            
            this.style.transform = `translate(${moveX}px, ${moveY}px) translateY(-2px)`;
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translate(0, 0) translateY(0)';
        });
    });
}

// Text reveal animation
function initTextReveal() {
    const textElements = document.querySelectorAll('.text-reveal');
    
    textElements.forEach(element => {
        const text = element.textContent;
        element.innerHTML = '';
        
        text.split('').forEach((char, index) => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.opacity = '0';
            span.style.transform = 'translateY(20px)';
            span.style.transition = `opacity 300ms ease ${index * 30}ms, transform 300ms ease ${index * 30}ms`;
            element.appendChild(span);
        });
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const spans = entry.target.querySelectorAll('span');
                    spans.forEach(span => {
                        span.style.opacity = '1';
                        span.style.transform = 'translateY(0)';
                    });
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        
        observer.observe(element);
    });
}

// Initialize all animations
function initAllAnimations() {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion) {
        // Disable complex animations
        document.body.classList.add('reduced-motion');
        return;
    }
    
    initSmoothScroll();
    initParallax();
    animateCounters();
    initImageLoading();
    initMagneticButtons();
    initTextReveal();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllAnimations);
} else {
    initAllAnimations();
}