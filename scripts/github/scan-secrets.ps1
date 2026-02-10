param(
    [switch]$AllTracked = $false,
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
}

Set-Location $RepoRoot

$logDir = Join-Path $RepoRoot "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}
$logPath = Join-Path $logDir "secret-scan.txt"

if ($AllTracked) {
    $targetFiles = @(git ls-files)
} else {
    $targetFiles = @(git diff --cached --name-only)
}

# Keep only existing files (avoid deleted/renamed stale paths)
$targetFiles = $targetFiles | Where-Object {
    -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path (Join-Path $RepoRoot $_))
}

$ignoredExt = @(
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
    ".zip", ".rar", ".7z", ".tar", ".gz", ".db", ".sqlite", ".sqlite3",
    ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3"
)

$safePlaceholders = @(
    "your_key_here", "your_key", "your-secret", "your_secret", "changeme",
    "change_me", "example", "sample", "test-key", "placeholder", "<redacted>"
)

$assignmentKeys = @(
    "GEMINI_API_KEY",
    "GEMINI_API_KEYS",
    "GOOGLE_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SENDGRID_API_KEY",
    "JWT_SECRET",
    "BOT_SECRET",
    "TG_CLIENT_BOT_TOKEN"
)

$findings = New-Object System.Collections.Generic.List[string]
$highRisk = $false

foreach ($relPath in $targetFiles) {
    $fullPath = Join-Path $RepoRoot $relPath
    $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
    if ($ignoredExt -contains $ext) { continue }

    $lines = Get-Content -Path $fullPath -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($null -eq $lines) { continue }

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $lineNo = $i + 1
        $line = [string]$lines[$i]
        $trimmed = $line.Trim()

        # Literal Google/Gemini key signatures (never print value)
        if ($line -match "AIza[0-9A-Za-z\-_]{35}") {
            $findings.Add("${relPath}:$lineNo GOOGLE_OR_GEMINI_KEY_LITERAL")
            $highRisk = $true
            continue
        }

        # Generic long token literal in obvious secret assignments
        if ($line -match "(?i)\b(api[_-]?key|secret|token)\b\s*[:=]\s*['""][A-Za-z0-9_\-]{20,}['""]") {
            $findings.Add("${relPath}:$lineNo POSSIBLE_HARDCODED_SECRET")
            $highRisk = $true
            continue
        }

        # .env style assignments for known keys
        foreach ($keyName in $assignmentKeys) {
            if ($trimmed -match "^(?:export\s+)?$keyName\s*=\s*(.+)$") {
                $rawValue = $matches[1].Trim().Trim("'`"")
                $valueLower = $rawValue.ToLowerInvariant()

                $isPlaceholder = $false
                foreach ($ph in $safePlaceholders) {
                    if ($valueLower.Contains($ph)) {
                        $isPlaceholder = $true
                        break
                    }
                }

                # Variables referencing env/system values are acceptable.
                $looksLikeReference = $rawValue -match "^\$\{?.+\}?$" -or $rawValue -match "process\.env\."
                $looksEmpty = [string]::IsNullOrWhiteSpace($rawValue)

                $isStrictEnvFile = ($relPath -match "(^|/)\.env$") -or ($relPath -match "\.env\.[^/]+$")
                $isExampleEnvFile = $relPath -match "\.env\.example$"

                if ($isStrictEnvFile -and -not $isExampleEnvFile -and -not $isPlaceholder -and -not $looksLikeReference -and -not $looksEmpty) {
                    $findings.Add("${relPath}:$lineNo $keyName")
                    $highRisk = $true
                } else {
                    $findings.Add("${relPath}:$lineNo ${keyName}_PLACEHOLDER")
                }
            }
        }
    }
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$modeLabel = if ($AllTracked) { "all-tracked" } else { "staged-only" }
$header = @(
    "# Secret scan report",
    "# Generated: $timestamp",
    "# Mode: $modeLabel",
    ""
)

if ($findings.Count -eq 0) {
    $body = @("No findings.")
} else {
    $body = $findings | Sort-Object -Unique
}

($header + $body) | Set-Content -Path $logPath -Encoding UTF8

Write-Host "Secret scan report: $logPath"
Write-Host "Findings: $($findings.Count)"

if ($highRisk) {
    Write-Error "Potential secret leak detected. Review logs/secret-scan.txt and redact before push."
    exit 2
}

exit 0
