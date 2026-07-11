param([int]$Port = 8000)

Write-Host ""
Write-Host "========================================"
Write-Host "  StudentLocker - Starting Server"
Write-Host "========================================"
Write-Host ""

# Start local HTTP server in background
$serverScript = @"
param([int]`$Port = $Port)
`$listener = New-Object System.Net.HttpListener
`$listener.Prefixes.Add("http://+:`$Port/")
`$listener.Prefixes.Add("http://localhost:`$Port/")
`$listener.Start()

`$currentPath = Get-Location

while (`$true) {
    try {
        `$context = `$listener.GetContext()
        `$request = `$context.Request
        `$response = `$context.Response
        
        `$localPath = `$request.Url.LocalPath
        if (`$localPath -eq "/") { `$localPath = "index.html" }
        
        `$filePath = Join-Path `$currentPath `$localPath.TrimStart("/")
        
        if (Test-Path `$filePath -PathType Leaf) {
            try {
                `$content = [System.IO.File]::ReadAllBytes(`$filePath)
                `$response.ContentLength64 = `$content.Length
                
                `$ext = [System.IO.Path]::GetExtension(`$filePath).ToLower()
                switch (`$ext) {
                    ".html" { `$response.ContentType = "text/html; charset=utf-8" }
                    ".css" { `$response.ContentType = "text/css" }
                    ".js" { `$response.ContentType = "text/javascript" }
                    ".json" { `$response.ContentType = "application/json" }
                    ".png" { `$response.ContentType = "image/png" }
                    ".jpg" { `$response.ContentType = "image/jpeg" }
                    ".jpeg" { `$response.ContentType = "image/jpeg" }
                    ".gif" { `$response.ContentType = "image/gif" }
                    ".svg" { `$response.ContentType = "image/svg+xml" }
                    ".ico" { `$response.ContentType = "image/x-icon" }
                    default { `$response.ContentType = "application/octet-stream" }
                }
                
                `$response.OutputStream.Write(`$content, 0, `$content.Length)
                `$response.StatusCode = 200
            } catch {
                `$response.StatusCode = 500
            }
        } else {
            `$response.StatusCode = 404
        }
        
        `$response.Close()
    } catch {
        # Silently handle errors
    }
}
"@

$tempScript = "$env:TEMP\student-locker-server.ps1"
$serverScript | Out-File -FilePath $tempScript -Encoding UTF8

# Start server in background
$serverJob = Start-Job -ScriptBlock { & powershell -ExecutionPolicy Bypass -File $args[0] -Port $args[1] } -ArgumentList $tempScript, $Port
Start-Sleep -Seconds 2

Write-Host "[OK] Local HTTP Server started on port $Port"
Write-Host ""

# Start ngrok tunnel
Write-Host "[INFO] Creating public tunnel with ngrok..."
$ngrokPath = "$env:USERPROFILE\ngrok\ngrok.exe"

if (Test-Path $ngrokPath) {
    # Run ngrok in background
    $ngrokJob = Start-Job -ScriptBlock {
        param($path, $port)
        & $path http $port --log=stdout
    } -ArgumentList $ngrokPath, $Port
    
    Start-Sleep -Seconds 3
    
    # Get ngrok status
    try {
        $ngrokStatus = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
        $publicUrl = $ngrokStatus.tunnels[0].public_url -replace "^http://", ""
    } catch {
        $publicUrl = "⏳ Generating public URL..."
    }
} else {
    Write-Host "⚠ ngrok not found at $ngrokPath"
    $publicUrl = "Manual setup needed"
}

# Get local IPs
$localIPs = @()
$localIPs += Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^127\." -and $_.IPAddress -notmatch "^169\." } | ForEach-Object { $_.IPAddress }

Write-Host ""
Write-Host "========================================"
Write-Host "  SERVER RUNNING - ACCESS URLS"
Write-Host "========================================"
Write-Host ""

Write-Host "[DESKTOP & LOCAL]:"
Write-Host "   http://localhost:$Port"
Write-Host ""

if ($localIPs.Count -gt 0) {
    Write-Host "[SAME NETWORK - Home WiFi]:"
    foreach ($ip in $localIPs) {
        Write-Host "   http://$($ip):$Port"
    }
    Write-Host ""
}

Write-Host "[ANY NETWORK - Cellular/Different WiFi]:"
if ($publicUrl -match "^http") {
    Write-Host "   $publicUrl"
} else {
    Write-Host "   $publicUrl"
    Write-Host "   Waiting for ngrok to generate URL..."
}

Write-Host ""
Write-Host "========================================"
Write-Host ""
Write-Host "[HOW TO ACCESS]:"
Write-Host "   Desktop:    http://localhost:$Port"
Write-Host "   Same WiFi:  Copy local IP link"
Write-Host "   Any Phone:  Copy public ngrok URL"
Write-Host ""
Write-Host "Press Ctrl+C to STOP"
Write-Host ""

# Keep script running
while ($true) {
    Start-Sleep -Seconds 10
}
