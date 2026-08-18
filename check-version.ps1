param([Parameter(Mandatory=$true)][string]$Version)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $root "frontend\.env"
$repo = $null
if (Test-Path $envPath) {
    foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
        if ($line -match '^VITE_GITHUB_REPO=(.+)$') { $repo = $Matches[1].Trim(); break }
    }
}
if (-not $repo) {
    Write-Output "[ERROR] VITE_GITHUB_REPO not found in frontend\.env"
    exit 1
}

function Get-VersionParts([string]$v) {
    $v = $v -replace '^v', ''
    $parts = $v.Split('.')
    $a = 0; $b = 0; $c = 0
    if ($parts.Length -gt 0) { $a = [int]$parts[0] }
    if ($parts.Length -gt 1) { $b = [int]$parts[1] }
    if ($parts.Length -gt 2) { $c = [int]$parts[2] }
    return @($a, $b, $c)
}

function Test-Newer([string]$new, [string]$old) {
    $pn = Get-VersionParts $new
    $po = Get-VersionParts $old
    for ($i = 0; $i -lt 3; $i++) {
        if ($pn[$i] -ne $po[$i]) { return ($pn[$i] -gt $po[$i]) }
    }
    return $false
}

Write-Output "Checking version $Version against GitHub ($repo)..."
try {
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ Accept = 'application/vnd.github+json' } -ErrorAction Stop
    $latest = [string]$release.tag_name
} catch {
    Write-Output "[WARN] Could not reach GitHub. Skipping version check (release will still be created)."
    exit 0
}

if (-not (Test-Newer $Version $latest)) {
    $latestNum = $latest -replace '^v', ''
    Write-Output ""
    Write-Output "[ERROR] Version $Version is NOT newer than the latest release $latest."
    Write-Output "        GitHub always marks the most recently published release as latest,"
    Write-Output "        so users on v$latestNum would never see an update."
    Write-Output "        Use a higher version, e.g. bump it to v$latestNum.*"
    exit 1
}

Write-Output "OK: $Version is newer than the latest release ($latest)."
exit 0