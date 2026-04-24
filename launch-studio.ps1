param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 3600
)

$resolvedRoot = [System.IO.Path]::GetFullPath($Root)
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if (-not $listener) {
  Start-Process -FilePath "cmd.exe" -WorkingDirectory $resolvedRoot -ArgumentList "/k", "node server.mjs" | Out-Null

  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 500
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
  } until ($listener -or (Get-Date) -gt $deadline)
}

Start-Process "http://localhost:$Port"

if (-not $listener) {
  Write-Host "Server startup timed out. Check the new console window."
}
