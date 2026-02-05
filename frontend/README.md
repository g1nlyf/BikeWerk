# Frontend (Vite + React + TypeScript)

Команды:
- `npm run dev` — запуск локального сервера (http://localhost:5173)
- `npm run build` — сборка
- `npm run preview` — предпросмотр сборки

Tailwind:
- Конфиг: `tailwind.config.cjs` (content настроен на `./index.html` и `./src/**/*.{ts,tsx}`; dark режим — `class`).
- Стили: `src/index.css` с директивами `@tailwind base/components/utilities`.

Алиасы:
- `@` указывает на `src/` (см. `vite.config.ts` и `tsconfig.app.json`).
- `next/link` алиасится на `src/lib/nextLinkShim.tsx`, чтобы импортируемые блоки из Next работали.

Добавление блоков (shadcn/ui):
- Убедись, что `components.json` присутствует.
- Команда: `npx shadcn@latest add https://21st.dev/r/...` — блоки попадут в `src/components/`.

Импорт будущих блоков:
- `motion` из `framer-motion` поддерживается.
- Импорты `next/link` автоматически работают через шима, либо оборачивай в `<a>` или `Button asChild`.

API:
- `VITE_API_URL` задаётся в `.env` (по умолчанию `http://localhost:8082`).
- Прокси `/api` в `vite.config.ts` переадресует на бэкенд по `http://localhost:8082`.

Структура:
- Главная страница (`/`) теперь рендерится через `TestBikeflipLanding2.tsx` (ранее была `/test/2`).
- Старая главная (`App.tsx`) сохранена, но не используется в роутинге по умолчанию.
