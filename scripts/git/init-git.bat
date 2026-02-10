@echo off
REM Batch file to initialize Git and create first commit
echo === Initializing Git Repository ===

git init
echo ✓ Git initialized

git add .
echo ✓ Files added to staging

git commit -m "Initial commit: EUBike project - bike import service from Europe"
echo ✓ Initial commit created

echo.
echo === Git Status ===
git status

echo.
echo === Next Steps ===
echo 1. Create a repository on GitHub: https://github.com/new
echo 2. Run these commands to connect and push:
echo    git remote add origin https://github.com/YOUR-USERNAME/eubike.git
echo    git branch -M main
echo    git push -u origin main

pause
