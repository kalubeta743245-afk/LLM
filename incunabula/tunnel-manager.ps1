# tunnel-manager.ps1 — creates a permanent Cloudflare tunnel for the bridge.
# Uses a named tunnel so the URL stays the same across restarts.

$ErrorActionPreference = 'Stop'
$TunnelName = 'incunabula-bridge'
$DataDir = Join-Path $PSScriptRoot '.data'
$IdFile = Join-Path $DataDir 'tunnel-id.txt'
$UrlFile = Join-Path $DataDir 'tunnel-url.txt'

if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }

# --- Helper: run cloudflared and capture output ---
function Run-Cf($args) {
    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = 'cloudflared'
    $pinfo.Arguments = $args
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($pinfo)
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    return @{ stdout = $stdout; stderr = $stderr; exit = $p.ExitCode }
}

# --- Step 1: Reuse existing tunnel ID if present, otherwise create one ---
$tunnelId = $null
if (Test-Path $IdFile) {
    $tunnelId = (Get-Content $IdFile -Raw).Trim()
    if ($tunnelId) {
        # Verify the tunnel still exists
        $check = Run-Cf "tunnel info $tunnelId"
        if ($check.exit -ne 0) {
            $tunnelId = $null  # tunnel was deleted, recreate
        }
    }
}

if (-not $tunnelId) {
    # Delete any leftover tunnel with same name first
    Run-Cf "tunnel delete $TunnelName" | Out-Null

    $r = Run-Cf "tunnel create $TunnelName"
    if ($r.exit -ne 0) {
        Write-Error "Failed to create tunnel: $($r.stderr)"
        exit 1
    }
    # cloudflared prints the tunnel ID (UUID) in the output
    $tunnelId = ($r.stdout -split "`n" | Where-Object { $_ -match 'Created tunnel' } | Select-Object -First 1) -replace '.*with id\s+', '' -replace '\s.*', ''
    if (-not $tunnelId) {
        # Fallback: last UUID-like line
        $tunnelId = ($r.stdout -split "`n" | Where-Object { $_ -match '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' } | Select-Object -First 1) -replace '.*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}).*', '$1'
    }
    if (-not $tunnelId) {
        Write-Error "Could not parse tunnel ID from output: $($r.stdout) / $($r.stderr)"
        exit 1
    }
    Set-Content -Path $IdFile -Value $tunnelId -NoNewline
}

# --- Step 2: DNS route (needed at least once) ---
Run-Cf "tunnel route dns $TunnelName" | Out-Null

# --- Step 3: Start the tunnel ---
# Write placeholder URL while tunnel starts
Set-Content -Path $UrlFile -Value "starting..." -NoNewline

$runProc = New-Object System.Diagnostics.ProcessStartInfo
$runProc.FileName = 'cloudflared'
$runProc.Arguments = "tunnel run --url http://localhost:8899 $TunnelName"
$runProc.RedirectStandardOutput = $true
$runProc.RedirectStandardError = $true
$runProc.UseShellExecute = $false
$runProc.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::Start($runProc)

# --- Step 4: Capture the trycloudflare URL from stderr ---
$urlFound = $false
$deadline = [DateTime]::Now.AddSeconds(15)
while (-not $proc.HasExited -or $proc.StandardError.Peek() -ge 0) {
    if ([DateTime]::Now -gt $deadline) { break }
    $line = $proc.StandardError.ReadLine()
    if ($line -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
        $tunnelUrl = $matches[0]
        Set-Content -Path $UrlFile -Value $tunnelUrl -NoNewline
        $urlFound = $true
        break
    }
    # Also handle cloudflared tunnel info output with CNAME
    if ($line -match 'https://[a-z0-9\-]+\.argotunnel\.com') {
        # This is the quick tunnel URL format
    }
}

if (-not $urlFound) {
    # Fallback: read stderr until we find the URL or process exits
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
    # Last resort: write the named tunnel URL pattern
    Set-Content -Path $UrlFile -Value "named://$TunnelName" -NoNewline
}

Write-Host "Tunnel '$TunnelName' (ID: $tunnelId) running on $tunnelUrl"

# Keep running until killed
$proc.WaitForExit()
