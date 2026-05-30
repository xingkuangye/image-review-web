# Image Review System - Local Deployment Script
# Navigate to project directory
Set-Location -Path "C:\Users\Admin\.mavis\agents\coder\workspace\image-review-web\image-review-web-main"

# Check if port 8000 is already in use
$portInUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "[INFO] Port 8000 is already in use. Killing existing process..."
    $processId = (Get-NetTCPConnection -LocalPort 8000).OwningProcess
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "========================================"
Write-Host "    Image Review System"
Write-Host "========================================"
Write-Host ""
Write-Host "[INFO] Starting server on http://localhost:8000"
Write-Host "[INFO] Open http://localhost:8000 in your browser"
Write-Host "[INFO] Admin page: http://localhost:8000/admin"
Write-Host ""

# Open browser
Start-Process "http://localhost:8000"

# Start the server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload