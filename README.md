# ⚡ Heda Protocol — Decentralized AI Data & Model Training Marketplace on 0G

> **Heda Protocol** is a decentralized end-to-end AI data pipeline, bounding box annotation marketplace, and model training ecosystem built natively on **0G Storage** and **0G Galileo Testnet**. 

> 📄 **Detailed Pipeline Technical Documentation**: Read [DATASET_PIPELINE.md](file:///Users/mayurasodara/Desktop/0g-heda/heda/DATASET_PIPELINE.md) for a complete step-by-step technical breakdown of image base64 embedding, 0G Storage pinning, Moondream zero-shot auto-labeling, and PyTorch YOLOv8 model training. 

---

## 🌟 Key Subsystems & Features

1. **Decentralized Data Bounties (`AnnotationMarket.sol`)**:
   - Data scientists create image & text annotation jobs with ETH bounties locked in onchain escrow.
   - Annotators claim tasks, draw bounding boxes / polygon masks, and submit annotations.
   - Job creators review work, approve submissions, and automatically disburse ETH rewards.

2. **0G Storage Verified Datasets (`DatasetRegistry.sol`)**:
   - Published datasets are serialized into standard COCO / JSONL format and posted directly to 0G Storage Merkle Trees.
   - Commercial data buyers can purchase dataset licenses onchain with automated royalty disbursement.

3. **Autonomous PyTorch YOLOv8 Model Training (`backend/ai-service`)**:
   - Fine-tunes vision models on user-annotated 0G datasets.
   - Decodes base64 images, formats YOLO normalized bounding boxes `[class_id, x_center, y_center, w, h]`, runs PyTorch training on GPU (Apple Silicon MPS / CUDA), and streams real-time loss & mAP@50 metrics.

4. **Local Moondream 2 VLM Zero-Shot Auto-Labeling (`moondream_server.py`)**:
   - Dedicated local VLM server running on port `2020` loads Moondream 2 onto Mac GPU / CUDA for fast sub-second zero-shot object detection.

5. **Decentralized AI Model Registry (`ModelRegistry.sol`)**:
   - Fine-tuned PyTorch model weights (`.pt` / `.onnx`) are uploaded to 0G Storage and registered onchain.
   - Includes live interactive model testing modal (`InferenceModal.tsx`).

---

## 🚀 Deployed 0G Galileo Testnet Contracts

| Contract Name | Deployed Galileo Address | Explorer Link |
| :--- | :--- | :--- |
| **`AnnotationMarket`** | `0x0577d4422B9065E2C8B7A29794DD176601Cf2c19` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x0577d4422B9065E2C8B7A29794DD176601Cf2c19) |
| **`DatasetRegistry`** | `0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c) |
| **`ModelRegistry`** | `0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D) |
| **`PipelineSubscription`** | `0x07231896B7dF2F51E6a56A6118850b43522E8f44` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x07231896B7dF2F51E6a56A6118850b43522E8f44) |

---

## 🛠️ System Architecture Overview

```
                          ┌────────────────────────┐
                          │    React Vite UI       │
                          │   (Frontend Port 5173) │
                          └───────────┬────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
┌──────────────────┐       ┌────────────────────┐     ┌─────────────────────┐
│ 0G Galileo EVM   │       │ 0G Storage Network │     │ Local AI Microservice│
│ Smart Contracts  │       │ (Storage Nodes &   │     │ (FastAPI & PyTorch  │
│ (Chain ID 16602) │       │ Turbo Indexer)     │     │ Port 8000 & 2020)   │
└──────────┬───────┘       └──────────┬─────────┘     └──────────┬──────────┘
           │                          │                          │
           └──────────────────────────┼──────────────────────────┘
                                      │
                           ┌──────────▼─────────┐
                           │ SQLite Event       │
                           │ Relayer Indexer    │
                           │ (Backend Port 3001)│
                           └────────────────────┘
```

---

## 💻 Quick Start & Running Locally

### 1. Prerequisites
- **Node.js**: v18+ & npm
- **Python**: v3.10+ (with PyTorch installed)
- **Foundry**: `forge` & `cast`

### 2. Frontend Launch
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

### 3. Backend Relayer & Event Indexer
```bash
cd backend/relayer
npm install
npm start
# Running on http://localhost:3001
```

### 4. Local Moondream 2 VLM GPU Server
```bash
cd backend/ai-service
python3 moondream_server.py
# Running on http://localhost:2020
```

### 5. Python AI & Model Fine-Tuning Microservice
```bash
cd backend/ai-service
python3 main.py
# Running on http://localhost:8000
```

---

## 🧪 Comprehensive Testing Guide

Please see **[TESTING_GUIDE.md](TESTING_GUIDE.md)** for step-by-step instructions on testing data bounties, VLM auto-labeling, PyTorch fine-tuning, and model registration.
