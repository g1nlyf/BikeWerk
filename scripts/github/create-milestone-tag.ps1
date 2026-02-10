param(
    [string]$Tag = "",
    [string]$Message = "Milestone snapshot",
    [switch]$PushTag = $false
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($Tag)) {
    $Tag = "milestone-" + (Get-Date -Format "yyyyMMdd-HHmmss")
}

git tag -a $Tag -m $Message
Write-Host "Created tag: $Tag"

if ($PushTag) {
    git push origin $Tag
    Write-Host "Pushed tag to origin: $Tag"
}
