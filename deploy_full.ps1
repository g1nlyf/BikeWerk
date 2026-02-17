# Full redeploy script:
# 1) Builds frontend locally
# 2) Removes /root/eubike on remote
# 3) Uploads full project archive
# 4) Reinstalls backend deps
# 5) Restarts PM2 and verifies backend health

$ProjectRoot = Get-Location
$ScriptPath = Join-Path $ProjectRoot "backend\scripts\full_redeploy.js"

Write-Host "Starting full redeploy..." -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not in PATH."
    exit 1
}

if (-not (Test-Path $ScriptPath)) {
    Write-Error "Full redeploy script not found at $ScriptPath"
    exit 1
}

node $ScriptPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "Full redeploy completed successfully." -ForegroundColor Green
} else {
    Write-Error "Full redeploy failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
