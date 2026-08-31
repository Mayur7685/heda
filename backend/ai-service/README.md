# 🤖 Heda Protocol — AI & Model Fine-Tuning Microservice

Python FastAPI microservice and dedicated vision engine powering autonomous YOLO model fine-tuning, real-time edge inference, and zero-shot VLM object detection on **0G Storage** datasets.

---

## 🌟 Architecture & Key Subsystems

### 1. Autonomous YOLO Fine-Tuning (`train_yolo.py` / `main.py`)
- **Supported Architectures**: YOLOv8, YOLOv11, and RT-DETR (nano, small, medium).
- **0G Dataset Ingestion**: Downloads dataset packages directly from 0G Storage Merkle root hashes, decodes Base64 images into `images/train/`, and normalizes bounding boxes `[class_id, x_center, y_center, width, height]`.
- **GPU Acceleration**: Automatically detects and leverages **NVIDIA CUDA** or **Apple Silicon Metal (MPS)** with fallback to multi-threaded CPU.
- **Live Metrics Streaming**: Emits epoch-by-epoch loss (`box_loss`, `cls_loss`), precision, recall, and **mAP@50** telemetry.

### 2. Live Inference Engine (`/predict`)
- Performs real-time object detection on user test images in the **RapidCV Test Sandbox** and **Model Universe**.
- Returns normalized bounding boxes, class names, confidence scores, and execution latency.

### 3. Local Moondream 2 VLM GPU Server (`moondream_server.py` — Port 2020)
- Serves local zero-shot vision-language model inference (`/v1/detect`) on port `2020`.
- Keeps weights in GPU memory for fast sub-second bounding box proposals without external API calls.

---

## 🚀 Quick Start & Environment Setup

### ⚡ Option A: Automated One-Click Script
```bash
cd backend/ai-service
chmod +x setup_env.sh
./setup_env.sh
```

### 🛠️ Option B: Manual Virtualenv Setup
```bash
cd backend/ai-service

# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 3. Start Main AI & Fine-Tuning Service (Port 8000)
python3 main.py

# 4. (Optional) Start Local Moondream VLM Server (Port 2020)
python3 moondream_server.py
```

---

## 📡 REST API Reference (`http://localhost:8000`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Service health check and hardware acceleration info |
| `POST` | `/train/start` | Launch asynchronous PyTorch YOLO fine-tuning job |
| `GET` | `/train/status/{train_id}` | Poll live training metrics, epoch progress, and logs |
| `POST` | `/predict` | Run live bounding box inference on an uploaded image |
| `GET` | `/models/export/{train_id}` | Download trained model weights (`.pt` / `.onnx`) |

---

## 🧪 Testing & Verification

Run the Python unit test suite:
```bash
source .venv/bin/activate
python3 -m pytest test_iou.py -v
```
*Expected Output: `15 passed, 0 failed`*
