param(
    [string]$FromRef = "origin/main",
    [string]$ToRef = "HEAD",
    [string]$OutputDir = "patches"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

$absOut = Join-Path $repoRoot $OutputDir
if (-not (Test-Path $absOut)) {
    New-Item -ItemType Directory -Path $absOut | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$patchPath = Join-Path $absOut "changes-$stamp.patch"

git diff --binary "$FromRef..$ToRef" > $patchPath

Write-Host "Patch exported: $patchPath"
Write-Host "Apply on another machine with scripts/github/import-patch.ps1"
