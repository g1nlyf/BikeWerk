console.log('🧪 Test header script loaded!');

// Simple header creation
function createSimpleHeader() {
    console.log('🏗️ Creating simple header...');
    
    const headerHTML = `
        <header class="header" style="background: #fff; padding: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); position: fixed; top: 0; left: 0; right: 0; z-index: 1000;">
            <div style="max-width: 1200px; margin: 0 auto; padding: 0 1rem; display: flex; justify-content: space-between; align-items: center;">
                <a href="index.html" style="font-size: 1.5rem; font-weight: bold; text-decoration: none; color: #333;">BikeEU</a>
                <nav style="display: flex; gap: 2rem;">
                    <a href="index.html" style="text-decoration: none; color: #333;">Главная</a>
                    <a href="catalog.html" style="text-decoration: none; color: #333;">Каталог</a>
                    <a href="calculator.html" style="text-decoration: none; color: #333;">Калькулятор</a>
                </nav>
                <button style="padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Войти</button>
            </div>
        </header>
    `;
    
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
        skipLink.insertAdjacentHTML('afterend', headerHTML);
    } else {
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }
    
    // Add margin to main content
    const mainContent = document.querySelector('#main-content');
    if (mainContent) {
        mainContent.style.marginTop = '80px';
    }
    
    console.log('✅ Simple header created!');
}

// Load immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createSimpleHeader);
} else {
    createSimpleHeader();
}