$targetDir = "C:\Users\hacke\CascadeProjects\Finals1\eubike\.agent\skills\ui-ux-pro-max"
$repoUrl = "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git"

Write-Host "Starting installation of UI/UX Pro Max Skill..."

# Check if git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is not installed or not in PATH."
    exit 1
}

# Clean existing directory
if (Test-Path $targetDir) {
    Write-Host "Removing existing directory: $targetDir"
    Remove-Item -Path $targetDir -Recurse -Force
}

# Clone repository
Write-Host "Cloning repository from $repoUrl..."
git clone $repoUrl $targetDir

if ($LASTEXITCODE -eq 0) {
    Write-Host "Clone successful."
    
    # Remove .git folder to avoid nested repository issues
    $gitDir = Join-Path $targetDir ".git"
    if (Test-Path $gitDir) {
        Write-Host "Removing .git directory..."
        Remove-Item -Path $gitDir -Recurse -Force
    }
    
    Write-Host "Skill 'ui-ux-pro-max' installed successfully to $targetDir"
}
else {
    Write-Error "Failed to clone repository. Please check your internet connection and the URL."
    exit 1
}
