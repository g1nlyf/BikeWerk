# FINAL FIX for Slow Internet
# This script rewrites history to create a single SMALL commit without any images
Write-Host "=== FINAL FIX: Re-creating History (Small Upload) ===" -ForegroundColor Cyan

# 1. Switch to a new orphan branch (disconnects from old history)
Write-Host "1. Creating fresh start..."
git checkout --orphan fresh-start

# 2. Clear Git Index completely (Unstage everything)
Write-Host "2. Clearing large files from memory..."
git rm -rf --cached . > $null 2>&1

# 3. Add back ONLY permitted files
# Since .gitignore now excludes images, they won't be added!
Write-Host "3. Adding only code files..."
git add .

# 4. Create the clean commit
Write-Host "4. Committing..."
git commit -m "Initial commit (Code Only) - Optimized for upload"

# 5. Delete old failed branch and rename this one to main
Write-Host "5. Updating branch..."
git branch -D main 2>$null
git branch -m main

# 6. Force Push
Write-Host "6. Pushing to GitHub (Should be VERY fast now)..." -ForegroundColor Green
git push -u origin main --force

Write-Host "`n=== DONE! Check GitHub: https://github.com/g1nlyf/BikeWerk ===" -ForegroundColor Green
pause
