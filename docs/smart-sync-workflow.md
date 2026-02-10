# Smart Sync Workflow (Local <-> GitHub <-> Cloud Codex)

Цель: один раз “правильно” запушить локальный репозиторий в GitHub, дальше работать через cloud Codex по GitHub, а локалку обновлять безопасно (pull или patch), с возможностью отката.

## Важно про Gemini ключ
- Gemini/Google ключи никогда не должны быть в git (ни в коде, ни в `.env`).
- Ключи хранятся в GitHub Secrets (для Actions/облака) и локально в `.env`/env vars (для твоей машины).

## 0) One-time: подготовка репозитория (хуки + скан)
Из корня репо:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\prepare-cloud-sync.ps1 -RunFullTrackedScan
```

Проверить отчёт:
`logs/secret-scan.txt`

## 1) Перед первым “большим” пушем: зафиксировать точку отката (milestone tag)
Сначала закоммить изменения (если ещё не закоммичено):

```powershell
git status
git add .
git commit -m "milestone: before first cloud handoff"
```

Создать тег-снимок и запушить его:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\create-milestone-tag.ps1 -Message "before first cloud handoff" -PushTag
```

## 2) Пуш на нормальном интернете (умный push с ретраями)
Пушить лучше после того как milestone tag уже в GitHub.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\push-with-retry.ps1 -Remote origin -Branch main
```

Если работаешь не в `main`, подставь свою ветку:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\push-with-retry.ps1 -Remote origin -Branch <branch>
```

## 3) Откат (3 варианта)

### Вариант A: безопасно вернуть состояние через отдельную ветку от тега (рекомендуется)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\restore-from-tag.ps1 -Tag <milestone-tag>
```
Дальше смотри/сравнивай/черрипикай нужные коммиты без переписывания истории `main`.

### Вариант B: откатить один плохой коммит “чисто” (создаёт новый commit-undo)
```powershell
git revert <bad_commit_sha>
git push
```

### Вариант C: вернуть конкретный файл
```powershell
git restore --source <commit_sha> -- path/to/file
git commit -m "restore file"
git push
```

## 4) Как обновить локалку до состояния GitHub (cloud -> local)

### Если локалка чистая (нет незакоммиченных изменений)
```powershell
git checkout main
git fetch origin
git pull --ff-only origin main
```

### Если локалка грязная (есть изменения), самый безопасный путь
1) Временно убрать изменения в stash:
```powershell
git status
git stash push -u -m "wip before pull"
```

2) Обновиться до remote:
```powershell
git checkout main
git fetch origin
git pull --ff-only origin main
```

3) Вернуть свои изменения:
```powershell
git stash pop
```

Если `stash pop` дал конфликты: решаешь конфликты, потом `git add .` и `git commit`.

## 5) Патчи вместо pull (когда нужно быстро “перенести изменения” без git pull)

### Экспорт патча (на стороне где есть изменения)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\export-patch.ps1 -FromRef origin/main -ToRef HEAD
```

### Импорт патча (на стороне локалки)
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\import-patch.ps1 -PatchFile .\patches\changes-YYYYMMDD-HHMMSS.patch
```

Патч применяется и сразу стейджится (в индексе). Дальше:
```powershell
git status
git commit -m "apply patch"
```

## 6) Быстрый “ежедневный” сценарий

### Local -> GitHub -> Cloud
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\prepare-cloud-sync.ps1
git add .
git commit -m "work"
powershell -ExecutionPolicy Bypass -File .\scripts\github\push-with-retry.ps1 -Remote origin -Branch main
```

### Cloud -> Local
```powershell
git fetch origin
git pull --ff-only origin main
```

## 7) Где смотреть “версии кода” на GitHub
- Commits: история коммитов и diff.
- Branches: параллельные ветки под задачи.
- Tags: milestone-снимки, удобны для быстрых “точек отката”.

