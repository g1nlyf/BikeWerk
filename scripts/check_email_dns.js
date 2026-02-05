/**
 * Скрипт для проверки DNS записей почты
 * Проверяет MX, SPF, DMARC записи для домена
 */

const { execSync } = require('child_process');
const dns = require('dns').promises;

const DOMAIN = 'bikewerk.ru';

async function checkMX() {
    console.log('\n📧 Проверка MX записей...');
    try {
        const records = await dns.resolveMx(DOMAIN);
        if (records.length === 0) {
            console.log('❌ MX записи не найдены!');
            return false;
        }
        console.log('✅ MX записи найдены:');
        records.forEach(record => {
            console.log(`   Приоритет ${record.priority}: ${record.exchange}`);
        });
        
        // Проверка на Yandex
        const hasYandex = records.some(r => r.exchange.includes('yandex'));
        if (hasYandex) {
            console.log('✅ Обнаружен Yandex MX сервер');
        }
        
        return true;
    } catch (error) {
        console.log('❌ Ошибка проверки MX:', error.message);
        return false;
    }
}

async function checkTXT() {
    console.log('\n📝 Проверка TXT записей (SPF, DMARC)...');
    try {
        const records = await dns.resolveTxt(DOMAIN);
        if (records.length === 0) {
            console.log('❌ TXT записи не найдены!');
            return false;
        }
        
        let hasSPF = false;
        let hasDMARC = false;
        
        records.forEach(record => {
            const text = Array.isArray(record) ? record.join('') : record;
            console.log(`   ${text}`);
            
            if (text.includes('v=spf1')) {
                hasSPF = true;
                console.log('   ✅ SPF запись найдена');
            }
            if (text.includes('v=DMARC1')) {
                hasDMARC = true;
                console.log('   ✅ DMARC запись найдена');
            }
        });
        
        if (!hasSPF) {
            console.log('⚠️  SPF запись не найдена! Рекомендуется добавить.');
        }
        if (!hasDMARC) {
            console.log('⚠️  DMARC запись не найдена! Рекомендуется добавить.');
        }
        
        return hasSPF;
    } catch (error) {
        console.log('❌ Ошибка проверки TXT:', error.message);
        return false;
    }
}

async function checkDMARC() {
    console.log('\n🛡️  Проверка DMARC записи...');
    try {
        const records = await dns.resolveTxt(`_dmarc.${DOMAIN}`);
        if (records.length === 0) {
            console.log('⚠️  DMARC запись не найдена');
            return false;
        }
        records.forEach(record => {
            const text = Array.isArray(record) ? record.join('') : record;
            console.log(`   ✅ DMARC: ${text}`);
        });
        return true;
    } catch (error) {
        console.log('⚠️  DMARC запись не найдена (это нормально, если еще не настроено)');
        return false;
    }
}

async function checkCNAME() {
    console.log('\n🔗 Проверка CNAME для mail...');
    try {
        const records = await dns.resolveCname(`mail.${DOMAIN}`);
        if (records.length === 0) {
            console.log('⚠️  CNAME для mail не найден (это опционально)');
            return false;
        }
        records.forEach(record => {
            console.log(`   ✅ mail.${DOMAIN} → ${record}`);
        });
        return true;
    } catch (error) {
        console.log('⚠️  CNAME для mail не найден (это опционально)');
        return false;
    }
}

async function checkWithNslookup() {
    console.log('\n🔍 Проверка через nslookup (альтернативный метод)...');
    try {
        console.log('\nMX записи:');
        const mxResult = execSync(`nslookup -type=MX ${DOMAIN}`, { encoding: 'utf8' });
        console.log(mxResult);
        
        console.log('\nTXT записи:');
        const txtResult = execSync(`nslookup -type=TXT ${DOMAIN}`, { encoding: 'utf8' });
        console.log(txtResult);
    } catch (error) {
        console.log('⚠️  nslookup не доступен (это нормально на Windows)');
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log(`🔍 ПРОВЕРКА DNS ЗАПИСЕЙ ДЛЯ ${DOMAIN.toUpperCase()}`);
    console.log('='.repeat(60));
    
    const mxOk = await checkMX();
    const txtOk = await checkTXT();
    await checkDMARC();
    await checkCNAME();
    
    // Альтернативная проверка
    try {
        await checkWithNslookup();
    } catch (e) {
        // Игнорируем ошибки nslookup
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ ОЦЕНКА:');
    console.log('='.repeat(60));
    
    if (mxOk && txtOk) {
        console.log('✅ DNS записи настроены правильно!');
        console.log('📧 Почта должна работать.');
        console.log('\n💡 Следующие шаги:');
        console.log('   1. Подтверди домен в панели почтового провайдера');
        console.log('   2. Создай почтовые ящики (support@, info@ и т.д.)');
        console.log('   3. Отправь тестовое письмо');
    } else {
        console.log('❌ DNS записи не настроены или настроены неправильно!');
        console.log('\n💡 Что делать:');
        console.log('   1. Открой инструкцию: scripts/EMAIL_SETUP_GUIDE.md');
        console.log('   2. Добавь DNS записи в панели управления доменом');
        console.log('   3. Подожди 5-60 минут для распространения DNS');
        console.log('   4. Запусти этот скрипт снова для проверки');
    }
    
    console.log('\n');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { checkMX, checkTXT, checkDMARC };
