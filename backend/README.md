# 📦 Heda Protocol — Backend Microservices

The Heda backend is divided into two cleanly isolated, modular microservices:

---

## 1. 🟢 `relayer/` — Node.js 0G Storage Upload Service (Port 3001)
- **Role**: Handles 0G Storage SDK (`@0gfoundation/0g-ts-sdk`) Merkle tree generation and contract relayer uploads.
- **Stack**: Node.js 20, Express, Ethers.js v6.
- **Run Locally**:
  ```bash
  cd relayer
  npm install
  npm start
  ```

---

## 2. 🐍 `ai-service/` — Python Machine Learning Service (Port 8000)
- **Role**: Downloads datasets from 0G Storage, prepares YOLO structure, trains PyTorch YOLOv8 models (CUDA / Apple Metal MPS / CPU), and posts trained weight hashes back to 0G Storage.
- **Stack**: Python 3.11, FastAPI, Uvicorn, PyTorch, Ultralytics.
- **Run Locally**:
  ```bash
  cd ai-service
  bash setup_env.sh
  python main.py
  ```
- **Automated Tests**:
  ```bash
  python test_trainer.py
  ```

---

## 🐳 Docker Deployment (Both Services)

To run both microservices containerized with Nvidia GPU support:

```bash
docker compose up -d
```
