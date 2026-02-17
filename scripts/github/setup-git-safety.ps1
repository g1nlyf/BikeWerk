param(
    [switch]$AllTrackedScan = $false
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$hooksDir = Join-Path $repoRoot ".githooks"
$prePushPath = Join-Path $hooksDir "pre-push"

if (-not (Test-Path $hooksDir)) {
    New-Item -ItemType Directory -Path $hooksDir | Out-Null
}

$hookContent = @'
#!/usr/bin/env sh
set -e

if command -v pwsh >/dev/null 2>&1; then
  pwsh -NoProfile -ExecutionPolicy Bypass -File "./scripts/github/scan-secrets.ps1"
elif command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/github/scan-secrets.ps1"
else
  echo "PowerShell is required for secret scan hook."
  exit 1
fi
'@

# Git on Windows is sensitive to BOM/CRLF in shebang scripts. Write LF + UTF-8 no BOM.
$hookContent = $hookContent -replace "`r`n", "`n"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($prePushPath, $hookContent, $utf8NoBom)

git -C $repoRoot config core.hooksPath ".githooks"

if ($AllTrackedScan) {
    & (Join-Path $PSScriptRoot "scan-secrets.ps1") -AllTracked
} else {
    & (Join-Path $PSScriptRoot "scan-secrets.ps1")
}

Write-Host "Git safety hooks installed. hooksPath=.githooks"
Write-Host "Pre-push hook: .githooks/pre-push"
