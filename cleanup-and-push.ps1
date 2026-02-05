# Script to clean up large files and push
Write-Host "=== Cleaning up Git Index ===" -ForegroundColor Yellow

# 1. Remove tracked files that should be ignored (like .db.bak)
git rm --cached -r backend/database/eubike.db.bak*
git rm --cached -r backend/database/eubike_test.db-wal
git rm --cached -r backend/database/eubike.db*

# 2. Add modified .gitignore and commit removal
git add .gitignore
git commit -m "Remove ignored database files from index"

# 3. Push with optimized settings
Write-Host "Pushing cleaner repo..." -ForegroundColor Green
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999
git push -u origin main

pause
