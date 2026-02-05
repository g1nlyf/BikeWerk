/**
 * Скрипт для настройки DNS записей для почты
 * Поддерживает: Yandex 360, Zoho Mail, Google Workspace
 * 
 * ВАЖНО: Этот скрипт только показывает какие DNS записи нужно добавить.
 * Реальные DNS записи нужно добавить в панели управления доменом (у регистратора или Cloudflare).
 */

const fs = require('fs');
const path = require('path');

// Конфигурация
const DOMAIN = 'bikewerk.ru';
const PROVIDER = 'yandex'; // 'yandex', 'zoho', 'google'

// DNS записи для разных провайдеров
const DNS_RECORDS = {
    yandex: {
        name: 'Yandex 360 (Бесплатно до 1000 пользователей)',
        mx: [
            { priority: 10, value: 'mx.yandex.ru' }
        ],
        txt: [
            { name: '@', value: 'v=spf1 redirect=_spf.yandex.net' },
            { name: '_dmarc', value: 'v=DMARC1; p=none; rua=mailto:dmarc@yandex.ru' }
        ],
        cname: [
            { name: 'mail', value: 'domain.mail.yandex.net' }
        ],
        instructions: `
📧 НАСТРОЙКА YANDEX 360 (БЕСПЛАТНО)

1. Регистрация:
   - Перейди на https://360.yandex.ru/
   - Выбери "Для бизнеса" → "Почта для домена"
   - Введи домен: ${DOMAIN}
   - Следуй инструкциям для подтверждения домена

2. DNS записи (добавь в панели управления доменом):
   
   MX записи:
   - Имя: @ (или ${DOMAIN})
   - Приоритет: 10
   - Значение: mx.yandex.ru
   
   TXT записи:
   - Имя: @
   - Значение: v=spf1 redirect=_spf.yandex.net
   
   - Имя: _dmarc
   - Значение: v=DMARC1; p=none; rua=mailto:dmarc@yandex.ru
   
   CNAME (опционально, для mail.${DOMAIN}):
   - Имя: mail
   - Значение: domain.mail.yandex.net

3. После добавления DNS записей:
   - Подожди 5-60 минут (распространение DNS)
   - Вернись в Yandex 360 и подтверди домен
   - Создай почтовые ящики: support@${DOMAIN}, info@${DOMAIN}, hello@${DOMAIN}

4. Просмотр почты:
   - Веб-интерфейс: https://mail.yandex.ru/
   - Или через приложение Yandex Mail на телефоне
   - Логин: support@${DOMAIN} (полный email)
        `
    },
    zoho: {
        name: 'Zoho Mail (Бесплатно до 5 пользователей)',
        mx: [
            { priority: 10, value: 'mx.zoho.eu' },
            { priority: 20, value: 'mx2.zoho.eu' }
        ],
        txt: [
            { name: '@', value: 'v=spf1 include:zoho.eu ~all' },
            { name: 'zoho-verification', value: 'ПОЛУЧИШЬ_ПРИ_РЕГИСТРАЦИИ' }
        ],
        cname: [],
        instructions: `
📧 НАСТРОЙКА ZOHO MAIL (БЕСПЛАТНО ДО 5 ПОЛЬЗОВАТЕЛЕЙ)

1. Регистрация:
   - Перейди на https://www.zoho.com/mail/
   - Выбери "Sign Up Free" → "Mail for Your Domain"
   - Введи домен: ${DOMAIN}
   - Создай аккаунт

2. DNS записи (Zoho даст точные значения при регистрации):
   
   MX записи:
   - Имя: @
   - Приоритет: 10
   - Значение: mx.zoho.eu
   
   - Имя: @
   - Приоритет: 20
   - Значение: mx2.zoho.eu
   
   TXT записи:
   - Имя: @
   - Значение: v=spf1 include:zoho.eu ~all
   
   - Имя: zoho-verification
   - Значение: (получишь при регистрации в Zoho)

3. После добавления DNS:
   - Подожди 5-60 минут
   - Вернись в Zoho и подтверди домен
   - Создай ящики: support@${DOMAIN}, info@${DOMAIN}

4. Просмотр почты:
   - Веб-интерфейс: https://mail.zoho.eu/
   - Логин: support@${DOMAIN}
        `
    },
    google: {
        name: 'Google Workspace (14 дней пробный период)',
        mx: [
            { priority: 1, value: 'aspmx.l.google.com' },
            { priority: 5, value: 'alt1.aspmx.l.google.com' },
            { priority: 5, value: 'alt2.aspmx.l.google.com' },
            { priority: 10, value: 'alt3.aspmx.l.google.com' },
            { priority: 10, value: 'alt4.aspmx.l.google.com' }
        ],
        txt: [
            { name: '@', value: 'v=spf1 include:_spf.google.com ~all' },
            { name: '_dmarc', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}' }
        ],
        cname: [],
        instructions: `
📧 НАСТРОЙКА GOOGLE WORKSPACE (14 ДНЕЙ БЕСПЛАТНО)

1. Регистрация:
   - Перейди на https://workspace.google.com/
   - Выбери "Начать бесплатно" → 14 дней пробный период
   - Введи домен: ${DOMAIN}
   - Следуй инструкциям

2. DNS записи (Google даст точные значения):
   
   MX записи:
   - Имя: @
   - Приоритет: 1
   - Значение: aspmx.l.google.com
   
   - Имя: @
   - Приоритет: 5
   - Значение: alt1.aspmx.l.google.com
   
   - Имя: @
   - Приоритет: 5
   - Значение: alt2.aspmx.l.google.com
   
   - Имя: @
   - Приоритет: 10
   - Значение: alt3.aspmx.l.google.com
   
   - Имя: @
   - Приоритет: 10
   - Значение: alt4.aspmx.l.google.com
   
   TXT записи:
   - Имя: @
   - Значение: v=spf1 include:_spf.google.com ~all
   
   - Имя: _dmarc
   - Значение: v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}

3. После добавления DNS:
   - Подожди 5-60 минут
   - Вернись в Google Workspace и подтверди домен
   - Создай ящики: support@${DOMAIN}, info@${DOMAIN}

4. Просмотр почты:
   - Веб-интерфейс: https://mail.google.com/
   - Логин: support@${DOMAIN}
        `
    }
};

function printInstructions() {
    const provider = DNS_RECORDS[PROVIDER];
    if (!provider) {
        console.error(`❌ Неизвестный провайдер: ${PROVIDER}`);
        console.log('Доступные: yandex, zoho, google');
        return;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📧 НАСТРОЙКА ПОЧТЫ ДЛЯ ${DOMAIN.toUpperCase()}`);
    console.log(`Провайдер: ${provider.name}`);
    console.log('='.repeat(60) + '\n');
    
    console.log(provider.instructions);
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 КРАТКАЯ ИНСТРУКЦИЯ ПО DNS ЗАПИСЯМ:');
    console.log('='.repeat(60) + '\n');
    
    console.log('MX записи:');
    provider.mx.forEach(record => {
        console.log(`  - Имя: ${record.name || '@'}, Приоритет: ${record.priority}, Значение: ${record.value}`);
    });
    
    console.log('\nTXT записи:');
    provider.txt.forEach(record => {
        console.log(`  - Имя: ${record.name}, Значение: ${record.value}`);
    });
    
    if (provider.cname.length > 0) {
        console.log('\nCNAME записи:');
        provider.cname.forEach(record => {
            console.log(`  - Имя: ${record.name}, Значение: ${record.value}`);
        });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ РЕКОМЕНДАЦИЯ:');
    console.log('='.repeat(60));
    console.log('Для российского сайта лучше всего подходит YANDEX 360:');
    console.log('  ✓ Бесплатно до 1000 пользователей');
    console.log('  ✓ Русскоязычный интерфейс');
    console.log('  ✓ Быстрая настройка');
    console.log('  ✓ Надежная доставляемость');
    console.log('  ✓ Веб-интерфейс и мобильные приложения');
    console.log('\n');
}

// Запуск
if (require.main === module) {
    printInstructions();
}

module.exports = { DNS_RECORDS, DOMAIN };
