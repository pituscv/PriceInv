$ErrorActionPreference = "Stop"

$nodeDir = "C:\Users\14385\Documents\node-v22.22.2-win-x64\node-v22.22.2-win-x64"
$npmCmd = Join-Path $nodeDir "npm.cmd"

if (-not (Test-Path $npmCmd)) {
  Write-Error "No encuentro npm.cmd en: $npmCmd"
}

& $npmCmd run dev

#powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
