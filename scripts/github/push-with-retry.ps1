param(
    [string]$Remote = "origin",
    [string]$Branch = "",
    [int]$MaxRetries = 6,
    [int]$InitialDelaySeconds = 5,
    [switch]$SkipSecretScan = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (git rev-parse --abbrev-ref HEAD).Trim()
}

if (-not $SkipSecretScan) {
    & (Join-Path $PSScriptRoot "scan-secrets.ps1")
}

# Ensure hooks are installed and present. If hooksPath points to .githooks but it
# is missing/corrupted, Git push can fail with "cannot spawn .githooks/pre-push".
$expectedHook = Join-Path $repoRoot ".githooks\pre-push"
if (-not (Test-Path $expectedHook)) {
    Write-Warning "pre-push hook missing. Re-installing git safety hooks..."
    & (Join-Path $PSScriptRoot "setup-git-safety.ps1")
}

Write-Host "Configuring robust Git transport settings for slow/unstable upload..."
git config --local http.postBuffer 524288000 | Out-Null
git config --local http.lowSpeedLimit 1 | Out-Null
git config --local http.lowSpeedTime 1200 | Out-Null
git config --local core.compression 3 | Out-Null
git config --local pack.windowMemory 100m | Out-Null
git config --local pack.packSizeLimit 100m | Out-Null
git config --local pack.threads 1 | Out-Null

Write-Host "Packing objects..."
git gc --aggressive --prune=now | Out-Null

$attempt = 1
$delay = $InitialDelaySeconds
$success = $false

while ($attempt -le $MaxRetries -and -not $success) {
    Write-Host "Push attempt $attempt/$MaxRetries -> $Remote $Branch"

    # Re-assert hooksPath on every attempt (some environments override it).
    git config --local core.hooksPath ".githooks" | Out-Null

    & git push $Remote $Branch
    if ($LASTEXITCODE -eq 0) {
        $success = $true
        break
    }

    if ($attempt -lt $MaxRetries) {
        Write-Warning "Push failed. Retrying in $delay sec..."
        Start-Sleep -Seconds $delay
        $delay = [Math]::Min(300, $delay * 2)
    }
    $attempt++
}

if (-not $success) {
    Write-Error "Push failed after $MaxRetries attempts."
    exit 1
}

Write-Host "Push completed successfully."
exit 0
