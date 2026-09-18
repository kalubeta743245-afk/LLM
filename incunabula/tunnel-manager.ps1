# tunnel-manager.ps1 — creates a Cloudflare quick tunnel for the bridge.
# Quick tunnels don't require authentication but URLs change on restart.

$ErrorActionPreference = 'Continue'
$DataDir = Join-Path $PSScriptRoot '.data'
$UrlFile = Join-Path $DataDir 'tunnel-url.txt'

if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }

# --- Helper: run cloudflared and capture output ---
$Cloudflared = Join-Path $PSScriptRoot 'cloudflared.exe'
if (-not (Test-Path $Cloudflared)) { $Cloudflared = 'cloudflared' }

# --- Start quick tunnel ---
Set-Content -Path $UrlFile -Value "starting..." -NoNewline

$runProc = New-Object System.Diagnostics.ProcessStartInfo
$runProc.FileName = $Cloudflared
$runProc.Arguments = "tunnel --url http://localhost:8899"
$runProc.RedirectStandardOutput = $true
$runProc.RedirectStandardError = $true
$runProc.UseShellExecute = $false
$runProc.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($runProc)

# --- Capture the trycloudflare URL from stderr ---
$urlFound = $false
$deadline = [DateTime]::Now.AddSeconds(20)
while (-not $proc.HasExited -or $proc.StandardError.Peek() -ge 0) {
    if ([DateTime]::Now -gt $deadline) { break }
    $line = $proc.StandardError.ReadLine()
    if ($line -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
        $tunnelUrl = $matches[0]
        Set-Content -Path $UrlFile -Value $tunnelUrl -NoNewline
        $urlFound = $true
        break
    }
}

if (-not $urlFound) {
    $deadline2 = [DateTime]::Now.AddSeconds(10)
    while (-not $proc.HasExited -and [DateTime]::Now -lt $deadline2) {
        $line = $proc.StandardError.ReadLine()
        if ($line -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $tunnelUrl = $matches[0]
            Set-Content -Path $UrlFile -Value $tunnelUrl -NoNewline
            $urlFound = $true
            break
        }
    }
}

if (-not $urlFound) {
    Set-Content -Path $UrlFile -Value "failed" -NoNewline
}

Write-Host "Tunnel running on $tunnelUrl"

# Keep running until killed
$proc.WaitForExit()
