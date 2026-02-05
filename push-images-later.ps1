# Script to push IMAGES (Run when internet is good)
Write-Host "=== Pushing Images (Heavy Upload) ===" -ForegroundColor Cyan

# 1. Restore .gitignore (remove the hack)
# We will just manually force add the files, overriding .gitignore
Write-Host "Adding images..."
git add -f frontend/public/*.png
git add -f "frontend/public/ext photos/"
git add -f images/

# 2. Commit
git commit -m "Assets: Uploading images"

# 3. Push
Write-Host "Pushing images (this might take time)..." -ForegroundColor Green
git push -u origin main

Write-Host "`n=== SUCCESS! Images uploaded. ===" -ForegroundColor Green
pause
