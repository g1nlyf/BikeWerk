# AGENTS.md (eubike)

## Repo layout
- frontend/ : React + Vite + Tailwind + Radix
- backend/  : Node/Express (JS/TS mix), SQLite, Mocha integration tests
- telegram-bot/, client-telegram-bot/, manager-bot/ : separate Node projects

## Conventions
- Prefer small PRs and incremental refactors.
- Do not introduce new dependencies without explicit approval.
- Never commit secrets. If secrets are found, redact and propose rotation steps.

## Absolute Secret Rules
- GEMINI/GOOGLE API keys must never be committed, pushed, or printed.
- Never output full contents of .env*, ecosystem.config.js, or any secret-bearing file.
- Only show redacted diffs or redacted snippets when editing such files.
- If a Gemini/Google key is detected anywhere:
  1) Immediately redact it.
  2) Propose key rotation.
  3) Verify the file is gitignored.

## Source of Truth & Git Usage
- The local repository is the primary source of truth.
- GitHub is used only for milestone snapshots and major stable updates.
- Frequent pushing is NOT expected.
- Prefer local commits; push only when a feature/module is largely complete.

## Commands (run from repo root unless stated)
### Frontend
- Install: (cd frontend) npm ci
- Dev:     (cd frontend) npm run dev
- Lint:    (cd frontend) npm run lint
- Build:   (cd frontend) npm run build
- Preview: (cd frontend) npm run preview

### Backend
- Install: (cd backend) npm ci
- Dev:     (cd backend) npm run dev
- Start:   (cd backend) npm run start
- Tests:   (cd backend) npm test
- Migrate: (cd backend) npm run migrate
- Setup DB:(cd backend) npm run setup-db
- Sync DB: (cd backend) npm run sync-db

## Safety rails
- Treat `npm run migrate|setup-db|sync-db`, any scripts under backend/scripts, and any PM2/deploy scripts as dangerous.
- Always prompt before: git push, git reset --hard, git clean -fd, rm/del/rmdir, pm2 *, deploy.ps1/deploy.bat.
- Network should stay OFF by default; enable only in dev/deploy profiles when installing deps or calling external APIs.

## Testing expectations
- For backend changes: run (cd backend) npm test.
- For frontend changes: run (cd frontend) npm run lint and npm run build.
- Prefer adding a small regression test when fixing a bug.

## Large file note
- backend/server.js is large; avoid sweeping edits. Prefer extracting one router/service at a time with minimal behavior change.
