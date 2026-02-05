# Script to force push and diagnose
Write-Host "=== FORCE PUSH & DIAGNOSE ===" -ForegroundColor Yellow

# 1. Check if we have commits
git log -1
Write-Host "--------------------------------"

# 2. Check remote
git remote -v
Write-Host "--------------------------------"

# 3. Force push to main
Write-Host "Force pushing to main..."
git push -f origin main

pause
