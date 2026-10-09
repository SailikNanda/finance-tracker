param([Parameter(Mandatory=$true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& node (Join-Path $root 'frontend\scripts\set-version.mjs') $Version
if ($LASTEXITCODE -ne 0) { throw 'Version update failed' }
