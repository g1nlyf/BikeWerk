param(
    [string]$Repo = "",
    [switch]$DryRun = $true
)

$ErrorActionPreference = "Stop"

$secretNames = @(
    "GEMINI_API_KEY",
    "GEMINI_API_KEYS",
    "GOOGLE_API_KEY",
    "JWT_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SENDGRID_API_KEY",
    "TG_CLIENT_BOT_TOKEN",
    "BOT_SECRET"
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    if ($DryRun) {
        Write-Warning "GitHub CLI (gh) is not installed. Dry run will continue without upload capability."
    } else {
        Write-Error "GitHub CLI (gh) is not installed."
        exit 1
    }
}

if ($DryRun) {
    Write-Host "Dry run mode: secrets will NOT be uploaded."
}

$setCount = 0
foreach ($name in $secretNames) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        Write-Host "Skip $name (not set in current shell/user env)."
        continue
    }

    if ($DryRun) {
        Write-Host "Would set: $name"
        continue
    }

    if ([string]::IsNullOrWhiteSpace($Repo)) {
        $value | gh secret set $name --body -
    } else {
        $value | gh secret set $name --repo $Repo --body -
    }
    $setCount++
    Write-Host "Set: $name"
}

if (-not $DryRun) {
    Write-Host "Uploaded secrets: $setCount"
}
