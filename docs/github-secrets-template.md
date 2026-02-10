# GitHub Actions Secrets Template (BikeWerk)

Ниже список секретов, которые добавляются в GitHub:
`Settings -> Secrets and variables -> Actions -> New repository secret`

## Что это такое
- `JWT_SECRET`: секрет для подписи JWT-токенов авторизации на backend.
- `SENDGRID_API_KEY`: ключ SendGrid для отправки email.
- `BOT_SECRET`: внутренний секрет для защиты webhook/служебных вызовов (если используется).
- `GEMINI_API_KEY`: ключ Gemini API (у тебя уже добавлен, но текущий нужно ротировать).
- `GEMINI_API_KEYS`: пул ключей Gemini через запятую (опционально, если используешь несколько ключей).
- `GOOGLE_API_KEY`: Google API key (если используется отдельный от Gemini).
- `SUPABASE_URL`: URL проекта Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key Supabase (высокие привилегии).

## Telegram боты (разделяем токены)
В коде встречаются эти переменные окружения:
- `BOT_TOKEN` / `TG_BOT_TOKEN`: основной (simple) Telegram-бот.
- `MANAGER_BOT_TOKEN`: менеджер-бот (fallback на `BOT_TOKEN`, если не задан).
- `ADMIN_BOT_TOKEN`: админ-бот (где используется).
- `STATUS_BOT_TOKEN`: статус-бот (`telegram-bot/status-check-bot.js`).
- `TG_CLIENT_BOT_TOKEN`: client-telegram-bot.
- `TG_ADMIN_CHAT_ID` / `ADMIN_CHAT_ID`: chat id для уведомлений (в разных модулях).
- `TELEGRAM_CHANNEL_ID`, `TELEGRAM_PUBLIC_CHANNEL_ID`: каналы для публикаций (если используешь).

## Шаблон значений (без реальных ключей)
```env
JWT_SECRET=PASTE_REAL_VALUE_HERE
SENDGRID_API_KEY=PASTE_REAL_VALUE_HERE
BOT_SECRET=PASTE_REAL_VALUE_HERE

GEMINI_API_KEY=PASTE_REAL_VALUE_HERE
GEMINI_API_KEYS=PASTE_REAL_VALUE_HERE
GOOGLE_API_KEY=PASTE_REAL_VALUE_HERE

SUPABASE_URL=PASTE_REAL_VALUE_HERE
SUPABASE_SERVICE_ROLE_KEY=PASTE_REAL_VALUE_HERE

BOT_TOKEN=PASTE_REAL_VALUE_HERE
TG_BOT_TOKEN=PASTE_REAL_VALUE_HERE
MANAGER_BOT_TOKEN=PASTE_REAL_VALUE_HERE
ADMIN_BOT_TOKEN=PASTE_REAL_VALUE_HERE
STATUS_BOT_TOKEN=PASTE_REAL_VALUE_HERE
TG_CLIENT_BOT_TOKEN=PASTE_REAL_VALUE_HERE
TG_ADMIN_CHAT_ID=PASTE_REAL_VALUE_HERE
ADMIN_CHAT_ID=PASTE_REAL_VALUE_HERE
TELEGRAM_CHANNEL_ID=PASTE_REAL_VALUE_HERE
TELEGRAM_PUBLIC_CHANNEL_ID=PASTE_REAL_VALUE_HERE
```

## Откуда брать/как генерировать (без утечек)
- `JWT_SECRET`, `BOT_SECRET`: генерируй случайную строку (минимум 32 байта).
  - PowerShell пример: `[Convert]::ToBase64String((1..32 | ForEach-Object {Get-Random -Maximum 256}))`
- `SENDGRID_API_KEY`: берется в SendGrid (API Keys).
- Telegram токены: берутся у BotFather.
- Supabase: `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` из настроек проекта Supabase.

## Безопасная загрузка в GitHub без вывода ключей в чат
1. Загрузи значения в локальные env-переменные (PowerShell сессия).
2. Выполни:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\sync-gh-secrets.ps1 -DryRun:$false -Repo g1nlyf/BikeWerk
```
3. После загрузки очисти сессию/терминал.
