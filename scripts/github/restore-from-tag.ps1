param(
    [Parameter(Mandatory = $true)]
    [string]$Tag,
    [string]$NewBranch = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

if ([string]::IsNullOrWhiteSpace($NewBranch)) {
    $NewBranch = "restore/" + $Tag
}

git fetch --tags
git checkout -b $NewBranch $Tag

Write-Host "Created restore branch: $NewBranch (from tag $Tag)"
Write-Host "You can inspect and cherry-pick/revert safely without rewriting main."
