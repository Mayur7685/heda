# 🏋️ Heda — Decentralized Data Intelligence & Model Training Platform

> **Label Studio + Roboflow Universe, onchain.** Annotate datasets, check dataset health, train YOLO models, and publish weights — all powered by the **0G Stack**.

[![Built on 0G](https://img.shields.io/badge/Built%20on-0G%20Stack-00e479)](https://0g.ai)
[![Network](https://img.shields.io/badge/Network-Galileo%20Testnet-00e479)](https://chainscan-galileo.0g.ai)

---

## 🌟 What is Heda?

Heda is a decentralized computer vision annotation marketplace and model training platform where:

- **Job Creators** upload raw image datasets, define bounding box classes, and lock 0G ETH bounties in escrow.
- **Annotators** claim tasks, annotate images with bounding box tools (with 1-click **Moondream AI Auto-Label Assist**), and get paid instantly per approved task.
- **Data Engineers** inspect **Dataset Health Check** scores (class balance, box size, null warnings) and publish COCO JSON datasets to the **Dataset Universe (`/datasets`)**.
- **ML Engineers** fine-tune **YOLOv8** models locally or on GPU infra, stream live mAP50 training metrics, and publish `.pt` model weights to the **Model Universe (`/models`)** backed by **0G Storage**.

---

## 🏗️ 0G Stack Integration

| Layer | What Heda uses it for |
|---|---|
| **0G Chain** (Galileo Testnet, Chain ID 16602) | Job Escrow, Task Bounties, Dataset Registry, Model Registry, Onchain Model Weights Licensing |
| **0G Storage** | Raw image store, COCO JSON datasets, trained `.pt` YOLO model weights, metadata hashes |
| **0G Compute / Local AI Microservice** | Moondream VLM AI Auto-Labeling assist + Python PyTorch YOLOv8 model training engine |

---

## 🛠️ Microservice Architecture

```
┌─────────────────────────┐       1. POST /train/start        ┌─────────────────────────┐
│                         │ ─────────────────────────────────> │   Python AI Service     │
│   Heda React Frontend   │                                   │    (ai-service:8000)    │
│   (TrainingModal.tsx)   │ <──────────────────────────────── │    (FastAPI + PyTorch)  │
└─────────────────────────┘       4. Stream Logs & Metrics    └────────────┬────────────┘
             │                                                             │ 3. Relay Weights Upload
             │ 5. Publish to Model Universe                                ▼
             ▼                                                ┌─────────────────────────┐
┌─────────────────────────┐                                   │   Node.js 0G Relayer    │
│    ModelRegistry.sol    │ <──────────────────────────────── │      (relayer:3001)     │
│  (0G Galileo Testnet)   │       0G Storage Merkle Root      └─────────────────────────┘
└─────────────────────────┘
```

---

## 📜 Deployed Contracts (0G Galileo Testnet)

| Contract | Address | Explorer |
|---|---|---|
| **AnnotationMarket** | `0x4d0E12D93c3EE2fe301F9F43Eb6b6ce50d098a39` | [View](https://chainscan-galileo.0g.ai/address/0x4d0E12D93c3EE2fe301F9F43Eb6b6ce50d098a39) |
| **DatasetRegistry** | `0x4f7Ffd227E3EB49BE79c89c02dFD67F0D04B9068` | [View](https://chainscan-galileo.0g.ai/address/0x4f7Ffd227E3EB49BE79c89c02dFD67F0D04B9068) |
| **ModelRegistry** | `0x707De61B03948Ac28AA8175aa88AdE582c57c1b9` | [View](https://chainscan-galileo.0g.ai/address/0x707De61B03948Ac28AA8175aa88AdE582c57c1b9) |

---

## 🚀 Quick Start (Local Setup)

### 1. Terminal 1 — 0G Relayer Service
```bash
cd heda/backend/relayer
npm install
npm start
```
*Runs Node.js 0G Storage Upload Relayer on `http://localhost:3001`*

### 2. Terminal 2 — Python AI & YOLO Training Microservice
```bash
cd heda/backend/ai-service
bash setup_env.sh
source .venv/bin/activate
python main.py
```
*Runs Python FastAPI ML Service on `http://localhost:8000`*

### 3. Terminal 3 — React Frontend
```bash
cd heda/frontend
npm install
npm run dev
```
*Opens Heda DApp on `http://localhost:5173`*

---

## 🧪 Automated Test Suite

Run the automated test suite for the AI trainer engine:

```bash
python3 heda/backend/ai-service/test_trainer.py
```

Expected Output:
```
..
----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

---

## 🐳 Docker Deployment

To launch all microservices in containers with GPU support:

```bash
cd heda/backend
docker compose up -d
```
