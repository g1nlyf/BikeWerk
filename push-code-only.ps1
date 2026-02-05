# Script to push CODE ONLY (No images)
Write-Host "=== Pushing Code Only ===" -ForegroundColor Cyan

# 1. Remove images from Git index (keep files on disk)
Write-Host "Removing images from git tracking..."
git rm --cached -r frontend/public/*.png 2>$null
git rm --cached -r frontend/public/ext\ photos/ 2>$null
git rm --cached -r images/ 2>$null

# 2. Add modified .gitignore
git add .

# 3. Commit
git commit -m "Deploy: Code only (images excluded for now)"

# 4. Push
Write-Host "Pushing code..." -ForegroundColor Green
git push -u origin main

Write-Host "`n=== SUCCESS! Code is on GitHub. ===" -ForegroundColor Green
pause
