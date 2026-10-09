param([Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = & git -C $root remote get-url origin
if ($LASTEXITCODE -ne 0 -or $url -notmatch 'github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$') { throw 'Cannot resolve GitHub repository' }
$repo = $Matches[1]
try {
    $list = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases?per_page=100" -Headers @{ Accept = 'application/vnd.github+json' }
} catch { throw 'Could not verify published versions. Check the network before releasing.' }
$new = [version]$Version
foreach ($release in $list) {
    if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v?(\d+\.\d+\.\d+)$') { continue }
    if ($new -le [version]$Matches[1]) { throw "Version $Version must be higher than every stable published release ($($release.tag_name))" }
}
Write-Output "Version $Version is newer than all stable published releases"
