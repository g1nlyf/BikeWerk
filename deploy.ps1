# Configuration
$ProjectRoot = Get-Location
$AutoDeployScript = Join-Path $ProjectRoot "backend\scripts\auto_deploy.js"

Write-Host "Starting automated deployment..." -ForegroundColor Green

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed or not in PATH."
    exit 1
}

# Check if auto_deploy.js exists
if (-not (Test-Path $AutoDeployScript)) {
    Write-Error "Deployment script not found at $AutoDeployScript"
    exit 1
}

# Execute the Node.js deployment script
Write-Host "Delegating to Node.js auto-deploy script..." -ForegroundColor Cyan
node $AutoDeployScript

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment completed successfully!" -ForegroundColor Green
} else {
    Write-Error "Deployment failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
