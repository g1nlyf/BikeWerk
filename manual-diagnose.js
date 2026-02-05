const { Client } = require('ssh2');

const config = {
    host: '45.9.41.232',
    port: 22,
    username: 'root',
    password: '&9&%4q6631vI'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready');
    
    // Commands equivalent to what the user asked for
    const cmd = `
        echo "=== 1. СОДЕРЖИМОЕ КОРНЕВОЙ ПАПКИ (/root) ==="
        ls -la /root
        
        echo "\n=== 2. СОДЕРЖИМОЕ ПАПКИ ПРОЕКТА (/root/eubike) ==="
        ls -la /root/eubike
        
        echo "\n=== 3. СТАТУС ПРОЦЕССОВ (PM2) ==="
        pm2 status
        
        echo "\n=== 4. ОТКРЫТЫЕ ПОРТЫ ==="
        netstat -tuln | grep LISTEN
        
        echo "\n=== 5. ПОИСК 'localhost' В СБОРКЕ ФРОНТЕНДА ==="
        grep -r "localhost:8082" /root/eubike/frontend/dist/assets/ || echo "✅ 'localhost:8082' НЕ НАЙДЕН (Отлично)"
        
        echo "\n=== 6. ПРОВЕРКА IP В СБОРКЕ ==="
        grep -r "45.9.41.232" /root/eubike/frontend/dist/assets/ | head -n 1 && echo "✅ IP НАЙДЕН" || echo "❌ IP НЕ НАЙДЕН"
        
        echo "\n=== 7. ПРОВЕРКА .env ФАЙЛОВ ==="
        echo "Backend .env:"
        cat /root/eubike/backend/.env
        echo "\nFrontend .env.production:"
        cat /root/eubike/frontend/.env.production
    `;

    conn.exec(cmd, (err, stream) => {
        if (err) throw err;
        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            conn.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).connect(config);
