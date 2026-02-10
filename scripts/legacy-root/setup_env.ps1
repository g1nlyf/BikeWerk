# Этот скрипт устанавливает переменную окружения HOME, равную USERPROFILE
# Это необходимо для корректной работы некоторых инструментов (например, Playwright) в Windows

try {
    # Получаем путь к профилю пользователя (например, C:\Users\Username)
    $userProfile = [System.Environment]::GetEnvironmentVariable("USERPROFILE")
    
    if (-not $userProfile) {
        Write-Error "Ошибка: Переменная окружения USERPROFILE не найдена."
        exit 1
    }

    # Проверяем, установлена ли уже переменная HOME
    $currentHome = [System.Environment]::GetEnvironmentVariable("HOME", "User")
    
    if ($currentHome -eq $userProfile) {
        Write-Host "Переменная HOME уже установлена корректно: $currentHome"
    }
    else {
        # Устанавливаем переменную HOME для текущего пользователя (сохраняется в реестре)
        [System.Environment]::SetEnvironmentVariable("HOME", $userProfile, "User")
        Write-Host "Успешно установлена переменная окружения HOME: $userProfile"
        Write-Host "ВАЖНО: Пожалуйста, ПЕРЕЗАПУСТИТЕ ваш редактор кода (IDE) или терминал, чтобы изменения вступили в силу для агента."
    }
}
catch {
    Write-Error "Произошла ошибка при настройке переменной окружения: $_"
}
