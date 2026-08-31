# 📦 Heda Protocol — Backend Microservices

The Heda backend is divided into two cleanly isolated, modular microservices:

---

## 1. 🟢 `relayer/` — Node.js Relayer & SQLite Indexers (Port 3001)
- **Role**: Handles 0G Storage SDK uploads, Event Indexer (jobs/datasets/models), and Annotation Indexer with automated Moondream IoU quality evaluation and onchain reward settlement.
- **Stack**: Node.js 20, Express, Ethers.js v6, Better-SQLite3.
- **Run Locally**:
  ```bash
  cd relayer
  npm install
  npm start
  ```

---

## 2. 🐍 `ai-service/` — Python ML & Fine-Tuning Service (Port 8000 & 2020)
- **Role**: Ingests 0G Storage datasets, trains PyTorch YOLO (v8, v11, RT-DETR) models with hardware acceleration (Apple Silicon MPS / CUDA), executes live `/predict` inference, and serves local Moondream 2 VLM (`moondream_server.py`).
- **Stack**: Python 3.11+, FastAPI, Uvicorn, PyTorch, Ultralytics, Moondream.
- **Run Locally**:
  ```bash
  cd ai-service
  ./setup_env.sh
  python3 main.py
  ```
- **Automated Tests**:
  ```bash
  pytest test_iou.py -v
  ```

---

## 🐳 Docker Deployment (Both Services)

To run both microservices containerized with Nvidia GPU support:

```bash
docker compose up -d
```
