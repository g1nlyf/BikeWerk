# Script to push code with optimized settings for slow connections
Write-Host "=== Optimizing Git for Slow Connection ===" -ForegroundColor Green

# 1. Increase buffer size for HTTP posts (to 500MB)
git config --global http.postBuffer 524288000

# 2. Disable low speed limit (prevents disconnecting if speed drops)
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

# 3. Increase generic timeout
git config --global http.gui.timeout 3600

Write-Host "✓ Settings applied (Buffer: 500MB, No speed limit)" -ForegroundColor Green

# 4. Retry push
Write-Host "Puhsing code... (This might take a few minutes)" -ForegroundColor Yellow
git push -u origin main

Write-Host "`nIf this still fails, please check your internet connection."
pause
