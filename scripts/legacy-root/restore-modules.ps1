$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$modules = @("frontend", "backend", "telegram-bot", "client-telegram-bot")
foreach ($m in $modules) {
  $p = Join-Path $root $m
  if (Test-Path $p) {
    Push-Location $p
    if (Test-Path (Join-Path $p "package-lock.json")) { npm ci } else { npm install }
    if ($m -eq "frontend") { npm run build }
    Pop-Location
  }
}
$sub = Join-Path $root "telegram-bot" | Join-Path -ChildPath "autocat-klein"
if (Test-Path (Join-Path $sub "package.json")) {
  Push-Location $sub
  if (Test-Path (Join-Path $sub "package-lock.json")) { npm ci } else { npm install }
  Pop-Location
}
Write-Host "Done"
