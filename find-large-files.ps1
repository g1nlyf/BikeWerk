# Script to find large files that are NOT ignored by git
Write-Host "=== Finding Large Files (Not Ignored) ===" -ForegroundColor Yellow

# Find all files that are tracked or would be tracked
git ls-files -c -o --exclude-standard | ForEach-Object { 
    try {
        $file = Get-Item -LiteralPath $_ -ErrorAction SilentlyContinue
        if ($file -and $file.Length -gt 500000) { # Larger than 500KB
            [PSCustomObject]@{
                Path = $_
                SizeMB = [math]::round($file.Length / 1MB, 2)
            }
        }
    } catch {}
} | Sort-Object SizeMB -Descending | Format-Table -AutoSize

Write-Host "`nThese files will be uploaded. If you see something large, we need to ignore it!"
pause
