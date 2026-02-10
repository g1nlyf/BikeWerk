param(
    [Parameter(Mandatory = $true)]
    [string]$PatchFile,
    [switch]$ThreeWay = $true
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

if (-not (Test-Path $PatchFile)) {
    $PatchFile = Join-Path $repoRoot $PatchFile
}

if (-not (Test-Path $PatchFile)) {
    Write-Error "Patch file not found: $PatchFile"
    exit 1
}

if ($ThreeWay) {
    git apply --3way --index $PatchFile
} else {
    git apply --index $PatchFile
}

Write-Host "Patch applied and staged: $PatchFile"
