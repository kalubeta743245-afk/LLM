# start-bridge.ps1 - Waits 30s then starts bridge.js in background

$ErrorActionPreference = "Stop"

$logDir = "$PSScriptRoot\.data"
$logFile = "$logDir\bridge.log"
$port = 8899

if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Check if port 8899 is already in use (bridge already running)
$portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($portInUse) {
    Add-Content -Path $logFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Bridge already running on port $port, skipping."
    exit 0
}

Add-Content -Path $logFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Waiting 30 seconds for network..."
Start-Sleep -Seconds 30

$nodeExe = "node"
$bridgeScript = "$PSScriptRoot\public\bridge.js"

Add-Content -Path $logFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Starting bridge.js..."

$process = Start-Process -FilePath $nodeExe -ArgumentList $bridgeScript -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $logFile -RedirectStandardError "$logDir\bridge-error.log" -NoNewWindow -PassThru -WindowStyle Hidden

Add-Content -Path $logFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Bridge started with PID $($process.Id)"
