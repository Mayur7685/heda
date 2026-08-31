# 🏋️ Heda Protocol — Scalable Model Training Architecture & Setup Guide

This document explains how the **Heda Local & Cloud Model Training Pipeline** works, how to set it up on any developer machine or cloud GPU instance (Nvidia CUDA / Apple Silicon MPS / CPU), and how to verify it with automated tests.

---

## 🛠️ System Architecture

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

## 🚀 Quick Local Setup (2 Terminal Tabs)

### 1. Terminal Tab 1 — 0G Relayer Service
```bash
cd heda/backend/relayer
npm install
npm start
```
*Runs 0G Storage Upload Relayer on `http://localhost:3001`*

---

### 2. Terminal Tab 2 — Python AI Microservice
```bash
cd heda/backend/ai-service
bash setup_env.sh
python3 main.py
```
*Runs Python YOLO Training FastAPI service on `http://localhost:8000`*

---

## 🧪 Running Automated Tests

Run the automated test suite to verify 0G dataset fetching, YOLO directory formatting, IoU calculations, and PyTorch model weight exports:

```bash
cd heda/backend/ai-service
python3 -m unittest test_trainer.py
python3 -m pytest test_iou.py -v
```

Expected Output:
```
Ran 2 tests in 0.001s
OK
15 passed, 0 failed
```

---

## 🐳 Docker / Cloud Deployment (Nvidia GPU Support)

To run both microservices in a containerized environment (AWS EC2, Lambda Labs, RunPod, or 0G Compute):

```bash
cd heda/backend
docker compose up -d
```

### Docker Highlights:
* `relayer`: Node.js 20 lightweight container for 0G Storage SDK.
* `ai-service`: Python 3.11 container with PyTorch & Nvidia CUDA GPU hardware acceleration.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | AI service port |
| `RELAYER_URL` | `http://localhost:3001/upload` | Relayer upload URL |
| `PRIVATE_KEY` | *(Required)* | EVM wallet private key in `relayer/.env` |
