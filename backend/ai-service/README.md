# 🤖 Heda Protocol — AI & Model Fine-Tuning Microservice

Python FastAPI microservice and dedicated **Moondream 2 VLM local GPU server** for autonomous YOLO model fine-tuning and zero-shot VLM auto-labeling.

---

## 🌟 Key Components & Services

1. **`moondream_server.py` (Port 2020)**:
   - Dedicated local Moondream 2 VLM server.
   - Loads model weights onto Apple Silicon GPU (Metal/MPS) or CUDA **once** for fast sub-second zero-shot object detection (`/v1/detect`).

2. **`main.py` & `train_yolo.py` (Port 8000)**:
   - REST API for training PyTorch YOLOv8 models (`/train/start`, `/train/status`).
   - Downloads 0G Storage datasets, decodes base64 images into `images/train/`, converts COCO annotations into YOLO label files, and executes PyTorch fine-tuning.
   - `/predict`: Executes live model inference on test images uploaded by users.

---

## 🚀 Running Local AI Services

### Terminal Window 1 (Moondream VLM GPU Server)
```bash
python3 moondream_server.py
# Listening on http://localhost:2020
```

### Terminal Window 2 (Main Python AI & Fine-Tuning Service)
```bash
python3 main.py
# Listening on http://localhost:8000
```
