# Скрипт для исправления проблемы с секретами в Git
# Удаляет секреты из истории и исправляет файлы

Write-Host "=== ИСПРАВЛЕНИЕ СЕКРЕТОВ В GIT ===" -ForegroundColor Yellow
Write-Host ""

# 1. Проверяем, что мы в git репозитории
if (-not (Test-Path ".git")) {
    Write-Host "❌ Ошибка: не найден .git каталог. Запустите скрипт из корня репозитория." -ForegroundColor Red
    exit 1
}

# 2. Проверяем статус git
Write-Host "📋 Проверка статуса git..." -ForegroundColor Cyan
git status
Write-Host ""

# 3. Сохраняем текущий токен Notion (если нужно)
$notionFile = "backend/src/apis/js/notion-config.js"
if (Test-Path $notionFile) {
    $content = Get-Content $notionFile -Raw
    if ($content -match "API_TOKEN:\s*'([^']+)'") {
        $savedToken = $matches[1]
        Write-Host "⚠️  Найден токен Notion в файле. Сохраните его в .env как NOTION_API_TOKEN" -ForegroundColor Yellow
        Write-Host "   Токен: $($savedToken.Substring(0, [Math]::Min(20, $savedToken.Length)))..." -ForegroundColor Gray
    }
}

# 4. Исправляем файл (заменяем токен на переменную окружения)
Write-Host ""
Write-Host "🔧 Исправление файла с секретом..." -ForegroundColor Cyan
if (Test-Path $notionFile) {
    $content = Get-Content $notionFile -Raw
    $newContent = $content -replace "API_TOKEN:\s*'[^']+'", "API_TOKEN: process.env.NOTION_API_TOKEN || ''"
    $newContent = $newContent -replace "DATABASE_ID:\s*'[^']+'", "DATABASE_ID: process.env.NOTION_DATABASE_ID || '271972f4eb4a8004939bc6e98c699437'"
    
    if ($content -ne $newContent) {
        Set-Content -Path $notionFile -Value $newContent -NoNewline
        Write-Host "✅ Файл исправлен: $notionFile" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Файл уже исправлен: $notionFile" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Файл не найден: $notionFile" -ForegroundColor Yellow
}

# 5. Добавляем файл в .gitignore (если там есть секреты)
if (-not (Test-Path ".gitignore")) {
    New-Item -Path ".gitignore" -ItemType File | Out-Null
}

$gitignoreContent = Get-Content ".gitignore" -ErrorAction SilentlyContinue
if ($gitignoreContent -notcontains "*.env") {
    Add-Content -Path ".gitignore" -Value "`n# Environment variables`n*.env`n.env.local`n.env.*.local"
    Write-Host "✅ Добавлено *.env в .gitignore" -ForegroundColor Green
}

# 6. Удаляем секрет из истории git используя git filter-branch
Write-Host ""
Write-Host "🧹 Очистка истории git от секретов..." -ForegroundColor Cyan
Write-Host "   Это может занять несколько минут..." -ForegroundColor Gray

# Создаем временный скрипт для filter-branch
$filterScript = @"
#!/bin/sh
git filter-branch --force --index-filter `
  "git rm --cached --ignore-unmatch backend/src/apis/js/notion-config.js" `
  --prune-empty --tag-name-filter cat -- --all
"@

# Альтернативный метод: используем git filter-repo (если установлен) или простой подход
Write-Host "   Используем git filter-branch для удаления секрета из истории..." -ForegroundColor Gray

# Проверяем, есть ли уже исправленный файл в последнем коммите
$lastCommit = git log -1 --name-only --pretty=format:"" | Select-String "notion-config.js"
if ($lastCommit) {
    Write-Host "   ⚠️  Файл найден в последнем коммите. Нужно переписать историю." -ForegroundColor Yellow
    
    # Метод 1: Используем BFG Repo-Cleaner (если установлен) - самый быстрый
    # Метод 2: Используем git filter-branch (встроенный)
    # Метод 3: Просто делаем новый коммит с исправлением (если секрет только в последнем коммите)
    
    Write-Host ""
    Write-Host "📝 Варианты решения:" -ForegroundColor Cyan
    Write-Host "   1. Создать новый коммит с исправлением (быстро, но секрет останется в истории)" -ForegroundColor White
    Write-Host "   2. Переписать историю через git filter-branch (долго, но полностью удалит секрет)" -ForegroundColor White
    Write-Host ""
    
    $choice = Read-Host "Выберите вариант (1 или 2, по умолчанию 1)"
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }
    
    if ($choice -eq "1") {
        # Вариант 1: Просто делаем новый коммит
        Write-Host ""
        Write-Host "📦 Создание нового коммита с исправлением..." -ForegroundColor Cyan
        git add $notionFile
        git add .gitignore
        git commit -m "fix: remove hardcoded Notion API token, use environment variable"
        Write-Host "✅ Коммит создан" -ForegroundColor Green
    } else {
        # Вариант 2: Переписываем историю
        Write-Host ""
        Write-Host "⚠️  ВНИМАНИЕ: Это перепишет всю историю git!" -ForegroundColor Red
        Write-Host "   Убедитесь, что у вас есть backup репозитория." -ForegroundColor Yellow
        $confirm = Read-Host "Продолжить? (yes/no)"
        
        if ($confirm -eq "yes") {
            Write-Host "   Запускаем git filter-branch..." -ForegroundColor Cyan
            
            # Удаляем файл из всех коммитов
            git filter-branch --force --index-filter `
                "git rm --cached --ignore-unmatch backend/src/apis/js/notion-config.js 2>/dev/null || true" `
                --prune-empty --tag-name-filter cat -- --all 2>&1 | Out-Null
            
            # Затем добавляем исправленную версию
            git add $notionFile
            git commit -m "fix: remove hardcoded Notion API token, use environment variable" --allow-empty
            
            Write-Host "✅ История переписана" -ForegroundColor Green
            Write-Host ""
            Write-Host "⚠️  ВАЖНО: Теперь нужно сделать force push:" -ForegroundColor Yellow
            Write-Host "   git push --force origin main" -ForegroundColor White
        } else {
            Write-Host "❌ Отменено пользователем" -ForegroundColor Red
            exit 1
        }
    }
} else {
    # Файл не в последнем коммите, просто добавляем исправление
    Write-Host "   Файл не найден в последних коммитах, создаем новый коммит..." -ForegroundColor Gray
    git add $notionFile
    git add .gitignore
    git commit -m "fix: remove hardcoded Notion API token, use environment variable"
    Write-Host "✅ Коммит создан" -ForegroundColor Green
}

# 7. Инструкции по настройке .env
Write-Host ""
Write-Host "=== СЛЕДУЮЩИЕ ШАГИ ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Добавьте в backend/.env (или корневой .env):" -ForegroundColor Cyan
Write-Host "   NOTION_API_TOKEN=ваш_токен_здесь" -ForegroundColor White
Write-Host "   NOTION_DATABASE_ID=271972f4eb4a8004939bc6e98c699437" -ForegroundColor White
Write-Host ""
Write-Host "2. Если вы выбрали вариант 2 (переписать историю), выполните:" -ForegroundColor Cyan
Write-Host "   git push --force origin main" -ForegroundColor White
Write-Host ""
Write-Host "3. Если вы выбрали вариант 1, просто выполните:" -ForegroundColor Cyan
Write-Host "   git push origin main" -ForegroundColor White
Write-Host ""

pause
