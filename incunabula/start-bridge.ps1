# start-bridge.ps1 - Starts bridge.js fully hidden (no CMD window)

$ErrorActionPreference = "SilentlyContinue"

$logDir = "$PSScriptRoot\.data"
$logFile = "$logDir\bridge.log"
$port = 8899

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Check if port 8899 is already in use (bridge already running)
$portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($portInUse) {
    exit 0
}

# Wait for network
Start-Sleep -Seconds 30

$nodeExe = "node"
$bridgeScript = "$PSScriptRoot\public\bridge.js"

# Start bridge fully hidden - no window at all
$process = Start-Process -FilePath $nodeExe -ArgumentList $bridgeScript -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
