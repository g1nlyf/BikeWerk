# Автоматический скрипт для исправления проблемы с секретами в Git
# Удаляет секрет из истории и исправляет файлы

Write-Host "=== АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ СЕКРЕТОВ В GIT ===" -ForegroundColor Yellow
Write-Host ""

# 1. Проверяем, что мы в git репозитории
if (-not (Test-Path ".git")) {
    Write-Host "❌ Ошибка: не найден .git каталог. Запустите скрипт из корня репозитория." -ForegroundColor Red
    exit 1
}

# 2. Исправляем файл с секретом
$notionFile = "backend/src/apis/js/notion-config.js"
Write-Host "🔧 Исправление файла с секретом..." -ForegroundColor Cyan

if (Test-Path $notionFile) {
    $content = Get-Content $notionFile -Raw
    $originalContent = $content
    
    # Заменяем хардкодный токен на переменную окружения
    $content = $content -replace "API_TOKEN:\s*'[^']+'", "API_TOKEN: process.env.NOTION_API_TOKEN || ''"
    $content = $content -replace "DATABASE_ID:\s*'[^']+'", "DATABASE_ID: process.env.NOTION_DATABASE_ID || '271972f4eb4a8004939bc6e98c699437'"
    
    if ($originalContent -ne $content) {
        Set-Content -Path $notionFile -Value $content -NoNewline
        Write-Host "✅ Файл исправлен: $notionFile" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Файл уже исправлен: $notionFile" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Файл не найден: $notionFile" -ForegroundColor Yellow
}

# 3. Обновляем .gitignore
Write-Host ""
Write-Host "📝 Обновление .gitignore..." -ForegroundColor Cyan

if (-not (Test-Path ".gitignore")) {
    New-Item -Path ".gitignore" -ItemType File | Out-Null
}

$gitignoreContent = Get-Content ".gitignore" -ErrorAction SilentlyContinue -Raw
if ($null -eq $gitignoreContent) { $gitignoreContent = "" }

if ($gitignoreContent -notmatch "\.env") {
    Add-Content -Path ".gitignore" -Value "`n# Environment variables`n*.env`n.env.local`n.env.*.local`n!.env.example"
    Write-Host "✅ Добавлено *.env в .gitignore" -ForegroundColor Green
} else {
    Write-Host "ℹ️  .env уже в .gitignore" -ForegroundColor Gray
}

# 4. Удаляем секрет из истории git через git filter-branch
Write-Host ""
Write-Host "🧹 Очистка истории git от секретов..." -ForegroundColor Cyan
Write-Host "   Это перепишет историю git и может занять несколько минут..." -ForegroundColor Yellow
Write-Host ""

# Создаем backup текущей ветки
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "📦 Создание backup ветки: backup-before-secret-cleanup" -ForegroundColor Cyan
git branch backup-before-secret-cleanup 2>&1 | Out-Null

# Удаляем секрет из всех коммитов
Write-Host "   Удаление секрета из истории через git filter-branch..." -ForegroundColor Gray

# Используем git filter-branch для удаления файла из истории
# Затем добавим исправленную версию
$filterCommand = @"
git filter-branch --force --index-filter `
    "git rm --cached --ignore-unmatch backend/src/apis/js/notion-config.js 2>/dev/null || true" `
    --prune-empty --tag-name-filter cat -- --all
"@

Write-Host "   Выполняется: git filter-branch..." -ForegroundColor Gray
$filterResult = Invoke-Expression $filterCommand 2>&1

if ($LASTEXITCODE -eq 0 -or $filterResult -match "Rewrite|WARNING") {
    Write-Host "✅ История переписана" -ForegroundColor Green
} else {
    Write-Host "⚠️  filter-branch завершился с предупреждениями (это нормально)" -ForegroundColor Yellow
}

# 5. Добавляем исправленный файл
Write-Host ""
Write-Host "📦 Добавление исправленного файла..." -ForegroundColor Cyan
git add $notionFile
git add .gitignore

# Проверяем, есть ли изменения для коммита
$status = git status --porcelain
if ($status -match "notion-config\.js|\.gitignore") {
    git commit -m "fix: remove hardcoded Notion API token, use environment variable" 2>&1 | Out-Null
    Write-Host "✅ Коммит создан с исправлением" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Нет изменений для коммита" -ForegroundColor Gray
}

# 6. Очистка backup refs от filter-branch
Write-Host ""
Write-Host "🧹 Очистка временных файлов filter-branch..." -ForegroundColor Cyan
git for-each-ref --format="%(refname)" refs/original/ | ForEach-Object { git update-ref -d $_ } 2>&1 | Out-Null
git reflog expire --expire=now --all 2>&1 | Out-Null
git gc --prune=now --aggressive 2>&1 | Out-Null
Write-Host "✅ Очистка завершена" -ForegroundColor Green

# 7. Инструкции
Write-Host ""
Write-Host "=== ГОТОВО! ===" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Следующие шаги:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Добавьте в backend/.env (или корневой .env):" -ForegroundColor Cyan
Write-Host "   NOTION_API_TOKEN=ваш_токен_notion" -ForegroundColor White
Write-Host "   NOTION_DATABASE_ID=271972f4eb4a8004939bc6e98c699437" -ForegroundColor White
Write-Host ""
Write-Host "2. Выполните force push (это безопасно, так как мы удалили секрет):" -ForegroundColor Cyan
Write-Host "   git push --force origin $currentBranch" -ForegroundColor White
Write-Host ""
Write-Host "3. Если что-то пойдет не так, восстановите из backup:" -ForegroundColor Cyan
Write-Host "   git checkout backup-before-secret-cleanup" -ForegroundColor White
Write-Host "   git branch -D $currentBranch" -ForegroundColor White
Write-Host "   git checkout -b $currentBranch" -ForegroundColor White
Write-Host ""

$pushNow = Read-Host "Выполнить force push сейчас? (y/n)"
if ($pushNow -eq "y" -or $pushNow -eq "Y") {
    Write-Host ""
    Write-Host "🚀 Выполняется force push..." -ForegroundColor Cyan
    git push --force origin $currentBranch
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Успешно отправлено в GitHub!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Ошибка при push. Проверьте подключение и права доступа." -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "ℹ️  Выполните push вручную когда будете готовы" -ForegroundColor Gray
}

Write-Host ""
pause
