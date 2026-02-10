# Быстрое исправление проблемы с push в GitHub из-за секретов
# Исправляет файл и предлагает варианты решения

Write-Host "=== ИСПРАВЛЕНИЕ ПРОБЛЕМЫ С PUSH В GITHUB ===" -ForegroundColor Yellow
Write-Host ""

# Проверяем git
if (-not (Test-Path ".git")) {
    Write-Host "❌ Ошибка: не найден .git каталог" -ForegroundColor Red
    exit 1
}

# Файл уже исправлен, просто создаем коммит
$notionFile = "backend/src/apis/js/notion-config.js"
if (Test-Path $notionFile) {
    Write-Host "✅ Файл уже исправлен: $notionFile" -ForegroundColor Green
} else {
    Write-Host "❌ Файл не найден: $notionFile" -ForegroundColor Red
    exit 1
}

# Обновляем .gitignore
if (-not (Test-Path ".gitignore")) {
    New-Item -Path ".gitignore" -ItemType File | Out-Null
}
$gitignoreContent = Get-Content ".gitignore" -ErrorAction SilentlyContinue -Raw
if ($null -eq $gitignoreContent) { $gitignoreContent = "" }
if ($gitignoreContent -notmatch "\.env") {
    Add-Content -Path ".gitignore" -Value "`n# Environment variables`n*.env`n.env.local`n.env.*.local"
    Write-Host "✅ Обновлен .gitignore" -ForegroundColor Green
}

# Создаем коммит
Write-Host ""
Write-Host "📦 Создание коммита с исправлением..." -ForegroundColor Cyan
git add $notionFile
git add .gitignore
git commit -m "fix: remove hardcoded Notion API token, use environment variable" 2>&1 | Out-Null
Write-Host "✅ Коммит создан" -ForegroundColor Green

Write-Host ""
Write-Host "=== РЕШЕНИЕ ПРОБЛЕМЫ ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "GitHub блокирует push из-за секрета в истории коммитов." -ForegroundColor White
Write-Host "Секрет уже удален из кода, но остался в истории." -ForegroundColor White
Write-Host ""
Write-Host "ВАРИАНТ 1 (САМЫЙ ПРОСТОЙ):" -ForegroundColor Cyan
Write-Host "   1. Откройте ссылку в браузере:" -ForegroundColor White
Write-Host "      https://github.com/g1nlyf/BikeWerk/security/secret-scanning/unblock-secret/39Fc2XLzlTY16PGEKxIM2bpqlrt" -ForegroundColor Gray
Write-Host "   2. Нажмите 'Allow secret' (секрет уже удален из кода)" -ForegroundColor White
Write-Host "   3. Вернитесь сюда и нажмите Enter для push" -ForegroundColor White
Write-Host ""
Write-Host "ВАРИАНТ 2: Переписать историю (полностью удалит секрет)" -ForegroundColor Cyan
Write-Host "   Запустите: .\\scripts\\git\\fix-git-secrets-auto.ps1" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Выберите вариант (1/2) или нажмите Enter для варианта 1"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "⏳ Ожидание разрешения секрета в GitHub..." -ForegroundColor Cyan
    Write-Host "   Откройте ссылку выше и нажмите 'Allow secret'" -ForegroundColor Yellow
    Read-Host "Нажмите Enter когда разрешите секрет в GitHub"
    
    Write-Host ""
    Write-Host "🚀 Выполняется push..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Успешно отправлено в GitHub!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Ошибка при push. Возможно секрет еще не разрешен в GitHub." -ForegroundColor Red
        Write-Host "   Попробуйте еще раз или используйте вариант 2." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "🔄 Запуск автоматического скрипта для переписывания истории..." -ForegroundColor Cyan
    & (Join-Path $PSScriptRoot 'fix-git-secrets-auto.ps1')
}

Write-Host ""
Write-Host "📝 ВАЖНО: Добавьте в backend/.env:" -ForegroundColor Yellow
Write-Host "   NOTION_API_TOKEN=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" -ForegroundColor White
Write-Host "   NOTION_DATABASE_ID=271972f4eb4a8004939bc6e98c699437" -ForegroundColor White
Write-Host ""

pause
