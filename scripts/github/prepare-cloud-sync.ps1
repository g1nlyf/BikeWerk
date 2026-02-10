param(
    [string]$Branch = "",
    [switch]$InstallHooks = $true,
    [switch]$RunFullTrackedScan = $false
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (git rev-parse --abbrev-ref HEAD).Trim()
}

Write-Host "Preparing repository for GitHub/cloud workflow..."
Write-Host "Current branch: $Branch"

if ($InstallHooks) {
    & (Join-Path $PSScriptRoot "setup-git-safety.ps1") -AllTrackedScan:$RunFullTrackedScan
} elseif ($RunFullTrackedScan) {
    & (Join-Path $PSScriptRoot "scan-secrets.ps1") -AllTracked
} else {
    & (Join-Path $PSScriptRoot "scan-secrets.ps1")
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "1) Review logs/secret-scan.txt"
Write-Host "2) Stage and commit your changes"
Write-Host "3) Push with retry script when good internet is available:"
Write-Host "   powershell -ExecutionPolicy Bypass -File .\\scripts\\github\\push-with-retry.ps1 -Remote origin -Branch $Branch"
