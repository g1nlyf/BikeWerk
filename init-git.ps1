# Script to initialize Git and create first commit
# Run this in PowerShell from the eubike project directory

Write-Host "=== Initializing Git Repository ===" -ForegroundColor Green

# Initialize git repository
git init
Write-Host "✓ Git initialized" -ForegroundColor Green

# Add all files (respecting .gitignore)
git add .
Write-Host "✓ Files added to staging" -ForegroundColor Green

# Create first commit
git commit -m "Initial commit: EUBike project - bike import service from Europe"
Write-Host "✓ Initial commit created" -ForegroundColor Green

# Show status
Write-Host "`n=== Git Status ===" -ForegroundColor Cyan
git status

Write-Host "`n=== Next Steps ===" -ForegroundColor Yellow
Write-Host "1. Create a repository on GitHub: https://github.com/new"
Write-Host "2. Run these commands to connect and push:"
Write-Host "   git remote add origin https://github.com/YOUR-USERNAME/eubike.git"
Write-Host "   git branch -M main"
Write-Host "   git push -u origin main"
