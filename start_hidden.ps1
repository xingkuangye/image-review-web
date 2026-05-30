$ErrorActionPreference = 'SilentlyContinue'
$projectDir = "C:\Users\Admin\.mavis\agents\coder\workspace\image-review-web\image-review-web-main"

# Kill existing process on port 8000
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInUse) {
    $processId = (Get-NetTCPConnection -LocalPort 8000).OwningProcess
    Stop-Process -Id $processId -Force
    Start-Sleep -Seconds 2
}

# Start hidden
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "python"
$psi.Arguments = "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"
$psi.WorkingDirectory = $projectDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true

$process = [System.Diagnostics.Process]::Start($psi)
Write-Host "Server started in background (PID: $($process.Id))"
Write-Host "Access: http://localhost:8000"
Write-Host "Admin: http://localhost:8000/admin"