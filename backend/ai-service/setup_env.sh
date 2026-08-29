#!/usr/bin/env bash
set -e

echo "========================================================="
echo "   Heda Protocol — AI Microservice Environment Setup     "
echo "========================================================="

# Detect Python version
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python 3 is required but not installed."
    exit 1
fi

echo "✓ Found $($PYTHON_CMD --version)"

# Create virtual environment if not exists
VENV_DIR=".venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating Python virtual environment in $VENV_DIR..."
    $PYTHON_CMD -m venv $VENV_DIR
fi

# Activate virtualenv
source $VENV_DIR/bin/activate
echo "✓ Virtual environment activated: $(which python)"

# Upgrade pip & setuptools
python -m pip install --upgrade pip setuptools wheel --quiet

# Install dependencies
echo "📥 Installing FastAPI, Ultralytics, PyTorch, and ML dependencies..."
python -m pip install -r requirements.txt

# Verify Hardware Acceleration (CUDA / MPS / CPU)
echo "---------------------------------------------------------"
echo "🔍 Detecting PyTorch Hardware Acceleration:"
python -c "
import torch
if torch.cuda.is_available():
    print('  🚀 CUDA Acceleration: ACTIVE (GPU: ' + torch.cuda.get_device_name(0) + ')')
elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    print('  🚀 Apple Metal (MPS) Acceleration: ACTIVE (Apple Silicon)')
else:
    print('  💻 CPU Execution: ACTIVE (Fallback)')
"
echo "---------------------------------------------------------"
echo "✅ Environment setup complete!"
echo "👉 To start Moondream 2 VLM GPU Server (Port 2020):"
echo "   source .venv/bin/activate && python3 moondream_server.py"
echo "👉 To start AI Fine-Tuning & Inference Server (Port 8000):"
echo "   source .venv/bin/activate && python3 main.py"

