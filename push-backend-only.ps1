# Push to GitHub excluding the 'frontend' directory
# Usage: .\push-backend-only.ps1 "Your commit message"

$commitMessage = $args[0]
if (-not $commitMessage) {
    $commitMessage = "Update backend and scripts (excluding frontend) - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}

Write-Host "🚀 Starting partial push (Excluding 'frontend')..." -ForegroundColor Cyan

# 1. Verification
if (-not (Test-Path .git)) {
    Write-Error "❌ Error: Not a git repository."
    exit 1
}

# 2. Temporary .gitignore adjustment
$gitignorePath = ".gitignore"
$hasGitignore = Test-Path $gitignorePath
$originalContent = ""

if ($hasGitignore) {
    $originalContent = Get-Content $gitignorePath -Raw
}

# Add 'frontend/' to gitignore if not already there
if ($originalContent -notmatch "(?m)^frontend/?$") {
    Write-Host "📦 Temporarily ignoring 'frontend'..." -ForegroundColor Yellow
    Add-Content -Path $gitignorePath -Value "`n# TEMPORARY EXCLUSION`nfrontend/`n"
}

# 3. Git Operations
try {
    Write-Host "📝 Staging files..."
    git add .
    
    # Double check if frontend is accidentally staged
    $stagedFrontend = git status --porcelain | Select-String "frontend/"
    if ($stagedFrontend) {
        Write-Host "⚠️ Warning: Frontend files detected in stage. Unstaging..." -ForegroundColor Yellow
        git reset frontend/ > $null
    }

    Write-Host "💾 Committing..."
    git commit -m "$commitMessage"

    Write-Host "☁️ Pushing to GitHub..."
    git push

    Write-Host "✅ Success! Backend and scripts pushed." -ForegroundColor Green
}
catch {
    Write-Error "❌ Git operation failed: $_"
}
finally {
    # 4. Cleanup gitignore
    if ($hasGitignore) {
        Set-Content -Path $gitignorePath -Value $originalContent
        Write-Host "🧼 Restored .gitignore" -ForegroundColor Gray
    }
}
