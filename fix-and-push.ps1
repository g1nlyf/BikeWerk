# Script to fix Git push issues and configure identity
# Runs all necessary commands to commit and push correctly

Write-Host "=== Fixing Git Upload & Identity ===" -ForegroundColor Green

# 0. Configure Git Identity (REQUIRED for commit)
Write-Host "0. Configuring Git Identity..."
# Using the username from your remote URL: g1nlyf
git config --global user.name "g1nlyf"
# Using GitHub's no-reply email format to keep your email private
git config --global user.email "g1nlyf@users.noreply.github.com"
Write-Host "✓ Identity configured as g1nlyf" -ForegroundColor Green

# 1. Add all files
Write-Host "1. Adding files..."
git add .

# 2. Commit files
Write-Host "2. Creating initial commit..."
git commit -m "Initial commit of BikeWerk"

# 3. Rename branch to main
Write-Host "3. Setting branch to main..."
git branch -M main

# 4. Ensure remote is correct
Write-Host "4. Configuring remote repository..."
git remote remove origin 2>$null
git remote add origin https://github.com/g1nlyf/BikeWerk.git

# 5. Push
Write-Host "5. Pushing to GitHub..."
git push -u origin main

Write-Host "`n=== DONE! ===" -ForegroundColor Green
Write-Host "Please check: https://github.com/g1nlyf/BikeWerk"
pause
