# Image Review System - Background Launch Script
$projectDir = "C:\Users\Admin\.mavis\agents\coder\workspace\image-review-web\image-review-web-main"
$logFile = Join-Path $projectDir "data\server.log"

# Check if port 8000 is already in use
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[INFO] Port 8000 is already in use. Killing existing process..."
    $processId = (Get-NetTCPConnection -LocalPort 8000).OwningProcess
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "========================================"
Write-Host "    Image Review System (Background)"
Write-Host "========================================"
Write-Host ""
Write-Host "[INFO] Starting server on http://localhost:8000"
Write-Host "[INFO] Output logged to: $logFile"
Write-Host ""

# Start as background job
$job = Start-Job -ScriptBlock {
    param($dir, $log)
    Set-Location -Path $dir
    python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload 2>&1 | Out-File -FilePath $log -Append
} -ArgumentList $projectDir, $logFile

Write-Host "[INFO] Server started in background (Job ID: $($job.Id))"
Write-Host "[INFO] To check logs: Get-Content '$logFile' -Wait -Tail 20"
Write-Host "[INFO] To stop: Stop-Job -Id $($job.Id); Remove-Job -Id $($job.Id)"