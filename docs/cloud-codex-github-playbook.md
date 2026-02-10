# Cloud Codex + GitHub Playbook (Safe Secrets)

## 1) Goal
- Keep local machine as source of truth until first stable push.
- Move daily coding to cloud Codex through GitHub.
- Never store Gemini/Google keys in git history.

## 2) One-time local setup
From repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\prepare-cloud-sync.ps1 -RunFullTrackedScan
```

This does:
- installs a pre-push hook (`.githooks/pre-push`);
- runs secret scan and writes `logs/secret-scan.txt`.

## 3) Secret policy (Gemini-safe)
- Real keys live only in local `.env` files and GitHub Secrets.
- Repo stores only `.env.example` placeholders.
- If key was ever committed in history:
  1. rotate key immediately in Google/Gemini console;
  2. remove from current files;
  3. optionally rewrite git history before sharing repository broadly.

## 4) Push on good internet
When you are on stable uplink:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\push-with-retry.ps1 -Remote origin -Branch <your-branch>
```

What script does:
- runs secret scan before push;
- tunes git upload settings for slow networks;
- retries push with exponential backoff.

## 5) GitHub Secrets for CI/cloud runtime
Set secrets in GitHub repository settings:
- `GEMINI_API_KEY` or `GEMINI_API_KEYS`
- `GOOGLE_API_KEY` (if used)
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SENDGRID_API_KEY`
- `BOT_SECRET`

Optional helper (from machine where env vars are already loaded):

```powershell
# Preview only
powershell -ExecutionPolicy Bypass -File .\scripts\github\sync-gh-secrets.ps1 -DryRun

# Upload
powershell -ExecutionPolicy Bypass -File .\scripts\github\sync-gh-secrets.ps1 -DryRun:$false -Repo g1nlyf/BikeWerk
```

## 6) CI behavior
Workflow file: `.github/workflows/ci.yml`
- Frontend job always runs lint/build.
- Backend tests run only if `GEMINI_API_KEY` or `GEMINI_API_KEYS` exists in GitHub Secrets.
- Without Gemini key, backend job logs skip message instead of failing.

## 7) How to inspect versions and rollback

### View history
```bash
git log --oneline --decorate --graph -n 30
```

### Restore one file from previous commit
```bash
git restore --source <commit_sha> -- path/to/file
```

### Revert a bad commit safely (new commit that undoes changes)
```bash
git revert <commit_sha>
```

### Create milestone snapshot tags
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\create-milestone-tag.ps1 -Message "before cloud handoff" -PushTag
```

### Restore from tag into a safe branch
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\restore-from-tag.ps1 -Tag milestone-YYYYMMDD-HHMMSS
```

### Return branch to specific commit locally (dangerous for shared branch)
```bash
git reset --hard <commit_sha>
```

### Recover after mistakes
```bash
git reflog
git reset --hard <sha_from_reflog>
```

## 8) Recommended workflow with cloud Codex
1. Local: finish chunk, run tests, commit.
2. Good internet: run `push-with-retry.ps1`.
3. Cloud Codex: continue work from GitHub branch.
4. If needed locally: pull or download patch, apply, continue.

## 9) Patch exchange between cloud and local
Export patch:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\export-patch.ps1 -FromRef origin/main -ToRef HEAD
```

Import patch:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\github\import-patch.ps1 -PatchFile .\patches\changes-YYYYMMDD-HHMMSS.patch
```
