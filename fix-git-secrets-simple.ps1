# Простой скрипт для исправления секретов в Git
# Исправляет файл и создает коммит, затем предлагает варианты для push

Write-Host "=== БЫСТРОЕ ИСПРАВЛЕНИЕ СЕКРЕТОВ ===" -ForegroundColor Yellow
Write-Host ""

# 1. Исправляем файл
$notionFile = "backend/src/apis/js/notion-config.js"
Write-Host "🔧 Исправление файла..." -ForegroundColor Cyan

if (Test-Path $notionFile) {
    $content = Get-Content $notionFile -Raw
    $content = $content -replace "API_TOKEN:\s*'[^']+'", "API_TOKEN: process.env.NOTION_API_TOKEN || ''"
    $content = $content -replace "DATABASE_ID:\s*'[^']+'", "DATABASE_ID: process.env.NOTION_DATABASE_ID || '271972f4eb4a8004939bc6e98c699437'"
    Set-Content -Path $notionFile -Value $content -NoNewline
    Write-Host "✅ Файл исправлен" -ForegroundColor Green
} else {
    Write-Host "❌ Файл не найден: $notionFile" -ForegroundColor Red
    exit 1
}

# 2. Обновляем .gitignore
if (-not (Test-Path ".gitignore")) {
    New-Item -Path ".gitignore" -ItemType File | Out-Null
}
$gitignoreContent = Get-Content ".gitignore" -ErrorAction SilentlyContinue -Raw
if ($null -eq $gitignoreContent) { $gitignoreContent = "" }
if ($gitignoreContent -notmatch "\.env") {
    Add-Content -Path ".gitignore" -Value "`n# Environment variables`n*.env`n.env.local`n.env.*.local"
}

# 3. Создаем коммит
Write-Host ""
Write-Host "📦 Создание коммита..." -ForegroundColor Cyan
git add $notionFile
git add .gitignore
git commit -m "fix: remove hardcoded Notion API token, use environment variable"
Write-Host "✅ Коммит создан" -ForegroundColor Green

# 4. Варианты решения
Write-Host ""
Write-Host "=== ВАРИАНТЫ РЕШЕНИЯ ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "GitHub блокирует push из-за секрета в истории. Есть 3 варианта:" -ForegroundColor White
Write-Host ""
Write-Host "ВАРИАНТ 1 (РЕКОМЕНДУЕТСЯ): Использовать GitHub web interface" -ForegroundColor Cyan
Write-Host "   1. Перейдите по ссылке из ошибки:" -ForegroundColor White
Write-Host "      https://github.com/g1nlyf/BikeWerk/security/secret-scanning/unblock-secret/39Fc2XLzlTY16PGEKxIM2bpqlrt" -ForegroundColor Gray
Write-Host "   2. Нажмите 'Allow secret' (секрет уже удален из кода)" -ForegroundColor White
Write-Host "   3. Затем выполните: git push origin main" -ForegroundColor White
Write-Host ""
Write-Host "ВАРИАНТ 2: Переписать историю (удалит секрет полностью)" -ForegroundColor Cyan
Write-Host "   Запустите: .\fix-git-secrets-auto.ps1" -ForegroundColor White
Write-Host ""
Write-Host "ВАРИАНТ 3: Создать новую ветку без истории" -ForegroundColor Cyan
Write-Host "   git checkout --orphan clean-main" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor White
Write-Host "   git commit -m 'Initial commit'" -ForegroundColor White
Write-Host "   git push -f origin clean-main:main" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Выберите вариант (1/2/3) или нажмите Enter для варианта 1"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "📋 Инструкции:" -ForegroundColor Cyan
    Write-Host "   1. Откройте ссылку выше в браузере" -ForegroundColor White
    Write-Host "   2. Разрешите секрет (Allow secret)" -ForegroundColor White
    Write-Host "   3. Вернитесь сюда и нажмите Enter для push" -ForegroundColor White
    Read-Host "Нажмите Enter когда разрешите секрет в GitHub"
    Write-Host ""
    Write-Host "🚀 Выполняется push..." -ForegroundColor Cyan
    git push origin main
} elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "🔄 Запуск автоматического скрипта..." -ForegroundColor Cyan
    .\fix-git-secrets-auto.ps1
} elseif ($choice -eq "3") {
    Write-Host ""
    Write-Host "⚠️  ВНИМАНИЕ: Это создаст новую ветку без истории!" -ForegroundColor Red
    $confirm = Read-Host "Продолжить? (yes/no)"
    if ($confirm -eq "yes") {
        git checkout --orphan clean-main
        git add .
        git commit -m "Initial commit - secrets removed"
        git push -f origin clean-main:main
        Write-Host "✅ Новая ветка создана и отправлена" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "📝 Не забудьте добавить в .env:" -ForegroundColor Yellow
Write-Host "   NOTION_API_TOKEN=ваш_токен" -ForegroundColor White
Write-Host "   NOTION_DATABASE_ID=271972f4eb4a8004939bc6e98c699437" -ForegroundColor White
Write-Host ""

pause
