# Инструкция по установке Git для Windows

## Проблема
Git не найден в системе. Ошибка: `Die Benennung "git" wurde nicht als Name eines Cmdlet`

## Решение: Установка Git

### Вариант 1: Скачать установщик (Рекомендуется)

1. **Скачайте Git для Windows:**
   - Перейдите: https://git-scm.com/download/win
   - Скачайте последнюю версию (обычно 64-bit)

2. **Установите Git:**
   - Запустите скачанный файл `Git-x.xx.x-64-bit.exe`
   - При установке выберите:
     - ✅ "Git from the command line and also from 3rd-party software" (важно!)
     - ✅ "Use Git and optional Unix tools from the Command Prompt"
   - Остальные настройки можно оставить по умолчанию
   - Нажмите "Install"

3. **Перезапустите PowerShell/Command Prompt**
   - Закройте все окна PowerShell
   - Откройте новое окно PowerShell

4. **Проверьте установку:**
   ```powershell
   git --version
   ```
   Должно показать что-то вроде: `git version 2.x.x`

### Вариант 2: Установка через winget (быстрее)

Если у вас есть winget (Windows 10/11), выполните в PowerShell:

```powershell
winget install --id Git.Git -e --source winget
```

После установки перезапустите PowerShell.

### Вариант 3: Установка через Chocolatey

Если у вас установлен Chocolatey:

```powershell
choco install git
```

## После установки

1. Перезапустите PowerShell
2. Проверьте: `git --version`
3. Настройте Git:
   ```powershell
   git config --global user.name "Ваше Имя"
   git config --global user.email "your.email@example.com"
   ```

4. Вернитесь к инициализации проекта:
   ```powershell
   cd c:\Users\hacke\CascadeProjects\Finals1\eubike
   .\init-git.ps1
   ```

## Если Git уже установлен, но не найден

Проверьте PATH:
```powershell
$env:PATH -split ';' | Select-String -Pattern 'git'
```

Если Git не в PATH, добавьте путь (обычно `C:\Program Files\Git\cmd`):
```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\Git\cmd", "User")
```

Затем перезапустите PowerShell.
