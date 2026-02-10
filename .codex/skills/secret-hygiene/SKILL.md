---
name: secret-hygiene
description: Scan eubike repo for leaked secrets (SendGrid/API keys/tokens/env files), produce redacted report and remediation steps (.env.example, gitignore, key rotation). Trigger when asked to check secrets or prep PR.
---
# Secret Hygiene

## Steps
1. From repo root, scan for patterns:
   - `SENDGRID`, `API_KEY`, `SECRET`, `token`, `.env`, `ecosystem.config.js`.
   - `GEMINI_API_KEY`, `GOOGLE_API_KEY`.
   - Use `rg -n "SENDGRID|API_KEY|SECRET|token|GEMINI_API_KEY|GOOGLE_API_KEY|\\.env"` and never print values.
2. When reporting matches, show only: file path + line number + key name (never the value).
3. Record findings into `logs/secret-scan.txt` as `path:line KEY_NAME`.
4. Propose remediation per item:
   - Move value to env var, update code to read from process.env.
   - Add placeholder to `.env.example` (create/update) without real value.
   - Add sensitive files to `.gitignore` if not already.
   - Recommend key rotation for any leaked secrets.
5. Summarize highest-risk items first (committed keys, prod configs).

## Notes
- Never echo actual secret values in responses.
- If files already in git history, note that rotation + history rewrite may be required.
