#!/bin/bash

echo "========================================"
echo "     Image Review System"
echo "========================================"
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python3 not found. Please install it."
    exit 1
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "[INFO] Creating virtual environment..."
    python3 -m venv venv
    echo "[INFO] Installing dependencies..."
    source venv/bin/activate
    pip install -r requirements.txt
fi

# Start server
echo "[INFO] Starting server..."
source venv/bin/activate

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8000
elif command -v open &> /dev/null; then
    open http://localhost:8000
fi

uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
