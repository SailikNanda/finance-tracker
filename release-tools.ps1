param([Parameter(Mandatory=$true)][string]$Version)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Update-File([string]$path, [string]$pattern, [string]$replacement) {
    $full = Join-Path $root $path
    if (-not (Test-Path $full)) { Write-Output "  WARN: missing $path"; return }
    $text = [System.IO.File]::ReadAllText($full)
    if ($text -match $pattern) {
        $text = [regex]::Replace($text, $pattern, $replacement)
        [System.IO.File]::WriteAllText($full, $text)
        Write-Output "  OK: $path"
    } else {
        Write-Output "  WARN: pattern not found in $path"
    }
}

Update-File "frontend\.env" 'VITE_APP_VERSION=[^\r\n]*' "VITE_APP_VERSION=$Version"
Update-File "frontend\package.json" '"version": "[^"]*"' ('"version": "' + $Version + '"')
Update-File "frontend\android\app\build.gradle" 'versionName "[^"]*"' ('versionName "' + $Version + '"')

$gradlePath = Join-Path $root "frontend\android\app\build.gradle"
$gradle = [System.IO.File]::ReadAllText($gradlePath)
$m = [regex]::Match($gradle, 'versionCode (\d+)')
if ($m.Success) {
    $newCode = [int]$m.Groups[1].Value + 1
    $gradle = [regex]::Replace($gradle, 'versionCode \d+', "versionCode $newCode")
    [System.IO.File]::WriteAllText($gradlePath, $gradle)
    Write-Output "  OK: versionCode -> $newCode"
} else {
    Write-Output "  WARN: versionCode not found in build.gradle"
}

Write-Output "Version set to $Version"