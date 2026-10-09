param([Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
function Run([string]$exe, [string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "$exe failed; release stopped" }
}
if ((& git status --porcelain)) { throw 'Commit or stash your work before releasing' }
if ((& git branch --show-current).Trim() -ne 'main') { throw 'Release from main only' }
foreach ($name in @('FINERA_KEYSTORE', 'FINERA_STORE_PASSWORD', 'FINERA_KEY_ALIAS', 'FINERA_KEY_PASSWORD')) {
    if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Set $name for the existing installation signing key" }
}
if (-not (Test-Path $env:FINERA_KEYSTORE)) { throw 'Release keystore not found. Do not generate a replacement for an existing installation.' }
# Incorporate remote changes before building. Never rebase an already-built release.
Run 'git' @('fetch', 'origin', 'main', '--tags')
Run 'git' @('merge', '--ff-only', 'origin/main')
& powershell -NoProfile -File (Join-Path $root 'check-version.ps1') -Version $Version
if ($LASTEXITCODE -ne 0) { throw 'Release version check failed' }
& git show-ref --verify --quiet "refs/tags/v$Version"
if ($LASTEXITCODE -eq 0) { throw 'This tag already exists; use a new release version' }
& powershell -NoProfile -File (Join-Path $root 'release-tools.ps1') -Version $Version
if ($LASTEXITCODE -ne 0) { throw 'Version update failed' }
Push-Location (Join-Path $root 'frontend')
try {
    Run 'npm.cmd' @('ci')
    Run 'npm.cmd' @('test')
    Run 'npm.cmd' @('run', 'check:version')
    Run 'npm.cmd' @('run', 'build')
    Run 'npx.cmd' @('cap', 'sync', 'android')
    Push-Location 'android'
    try { Run '.\gradlew.bat' @('assembleRelease') } finally { Pop-Location }
} finally { Pop-Location }
$apk = Join-Path $root 'frontend\android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $apk)) { throw 'Signed release APK was not produced' }
$sha = "$apk.sha256"
(Get-FileHash -Algorithm SHA256 $apk).Hash.ToLower() | Out-File -Encoding ASCII $sha
Run 'git' @('add', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/android/app/build.gradle', 'frontend/dist')
Run 'git' @('commit', '-m', "Release v$Version")
Run 'git' @('tag', '-a', "v$Version", '-m', "Finera v$Version")
# Atomic push fails if remote main moved. Rebuild from the new head on the next run.
Run 'git' @('push', '--atomic', 'origin', 'HEAD:main', "refs/tags/v$Version")
Run 'gh' @('release', 'create', "v$Version", $apk, $sha, '--verify-tag', '--title', "Finera v$Version", '--generate-notes', '--latest')
Write-Output "Published signed release v$Version with SHA-256 metadata. Keep your signing keystore backed up securely."
