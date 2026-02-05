$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$modules = @("frontend", "backend", "telegram-bot", "client-telegram-bot")
foreach ($m in $modules) {
  $p = Join-Path $root $m
  if (Test-Path $p) {
    Get-ChildItem -Path $p -Recurse -Force -Directory | Where-Object { $_.Name -eq "node_modules" } | ForEach-Object { Remove-Item -Recurse -Force $_.FullName }
  }
}
$sub = Join-Path $root "telegram-bot" | Join-Path -ChildPath "autocat-klein"
if (Test-Path $sub) {
  Get-ChildItem -Path $sub -Recurse -Force -Directory | Where-Object { $_.Name -eq "node_modules" } | ForEach-Object { Remove-Item -Recurse -Force $_.FullName }
}
Write-Host "Done"
