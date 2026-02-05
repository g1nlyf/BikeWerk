# Script to find large files in Git history
Write-Host "=== Scanning for Large Files ===" -ForegroundColor Yellow

# List all files sorted by size (approximate)
git rev-list --objects --all | 
  git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' | 
  Select-String "blob" | 
  ForEach-Object { 
    $parts = $_.ToString().Split(' ', 4)
    [PSCustomObject]@{
      ID = $parts[1]
      SizeBytes = [int64]$parts[2]
      Path = $parts[3]
    }
  } | 
  Sort-Object SizeBytes -Descending | 
  Select-Object -First 10 | 
  Format-Table -AutoSize

Write-Host "If you see files like *.zip, *.rar, *.tar.gz above - they are causing the error!"
pause
