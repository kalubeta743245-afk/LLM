# start-bridge.ps1 - Starts bridge + tunnel fully hidden, auto-deploys new URL

$ErrorActionPreference = "SilentlyContinue"
$Dir = "C:\Users\GENEXT\ZCodeProject\incunabula"
$DataDir = "$Dir\.data"
$LogFile = "$DataDir\bridge.log"
$TunnelFile = "$DataDir\tunnel-url.txt"
$Port = 8899

if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }

# Skip if bridge already running
if (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue) { exit 0 }

# Kill old processes
Get-Process -Name node,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start bridge
$node = Start-Process -FilePath "node" -ArgumentList "$Dir\public\bridge.js" -WorkingDirectory $Dir -WindowStyle Hidden -PassThru

# Start cloudflared tunnel
$cf = "$Dir\cloudflared.exe"
if (Test-Path $cf) {
    $proc = Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:$Port" -WorkingDirectory $Dir -WindowStyle Hidden -PassThru -RedirectStandardError "$DataDir\cf-stderr.log"
    
    # Wait for tunnel URL (max 25 seconds)
    $deadline = [DateTime]::Now.AddSeconds(25)
    while ([DateTime]::Now -lt $deadline) {
        Start-Sleep -Seconds 1
        if (Test-Path $TunnelFile) {
            $url = (Get-Content $TunnelFile -Raw).Trim()
            if ($url -and $url -match "https://.*trycloudflare\.com" -and $url -ne "starting..." -and $url -ne "failed") {
                # Update wrangler.toml and deploy
                $toml = Get-Content "$Dir\wrangler.toml" -Raw
                $newToml = $toml -replace 'BRIDGE_URL = ".*"', "BRIDGE_URL = `"$url`""
                Set-Content -Path "$Dir\wrangler.toml" -Value $newToml -NoNewline
                
                # Deploy silently
                Push-Location $Dir
                npx wrangler deploy 2>&1 | Out-Null
                Pop-Location
                
                Add-Content -Path $LogFile -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Tunnel: $url (deployed)"
                break
            }
        }
    }
}
