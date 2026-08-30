# ⚡ Heda Protocol — Decentralized AI Data & Model Training Marketplace on 0G

> **Heda Protocol** is a decentralized end-to-end AI data pipeline, multi-annotator bounding box annotation marketplace with Moondream IoU quality scoring, and model training ecosystem built natively on **0G Storage** and **0G Galileo Testnet**.

> 📄 **Detailed Pipeline Technical Documentation**: Read [DATASET_PIPELINE.md](DATASET_PIPELINE.md) for a complete step-by-step technical breakdown of image base64 embedding, 0G Storage pinning, Moondream zero-shot auto-labeling, and PyTorch YOLOv8 model training.

---

## 🌟 Key Subsystems & Features

1. **Multi-Annotator Bounty Market (`AnnotationMarketV2.sol`)**:
   - Data scientists create image annotation jobs with ETH bounties locked in onchain escrow.
   - **Up to 5 annotators per task** can submit annotations — no claim/lock required (fully open submission).
   - Moondream VLM computes **IoU quality scores** for each submission vs. ground-truth auto-detection.
   - Rewards are **auto-distributed proportionally** by IoU score via the backend relayer (BPS shares).
   - Creator can trigger early manual evaluation per-task or for all pending tasks at once.

2. **0G Storage Verified Datasets (`DatasetRegistry.sol`)**:
   - Published datasets are serialized into standard COCO / JSONL format and posted directly to 0G Storage Merkle Trees.
   - Commercial data buyers can purchase dataset licenses onchain with automated royalty disbursement.

3. **Autonomous PyTorch YOLOv8 Model Training (`backend/ai-service`)**:
   - Fine-tunes vision models on user-annotated 0G datasets.
   - Decodes base64 images, formats YOLO normalized bounding boxes `[class_id, x_center, y_center, w, h]`, runs PyTorch training on GPU (Apple Silicon MPS / CUDA), and streams real-time loss & mAP@50 metrics.

4. **Moondream 2 VLM Zero-Shot Auto-Labeling + IoU Scoring**:
   - Local VLM server running on port `2020` loads Moondream 2 onto Mac GPU / CUDA for sub-second detection.
   - Also powers the annotation quality scoring pipeline: computes `POST /annotation/score` comparing user boxes to Moondream ground truth via **mean-best-match IoU**.

5. **Decentralized AI Model Registry (`ModelRegistry.sol`)**:
   - Fine-tuned PyTorch model weights (`.pt` / `.onnx`) are uploaded to 0G Storage and registered onchain.
   - Includes live interactive model testing modal (`InferenceModal.tsx`).

6. **RapidCV Pipeline Subscription (`PipelineSubscription.sol`)**:
   - Onchain credit-gated fine-tuning pipeline with MetaMask signature required before training.

---

## 🚀 Deployed 0G Galileo Testnet Contracts

| Contract Name | Deployed Galileo Address | Explorer Link |
| :--- | :--- | :--- |
| **`AnnotationMarket`** (V1) | `0x4B791da8eD9C4d3b1812b51F63359c1f3AeB8C0A` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x4B791da8eD9C4d3b1812b51F63359c1f3AeB8C0A) |
| **`AnnotationMarketV2`** ⭐ | `0xDF69C008eEBDC1EC147B5A795eA0CAbdB3d778B5` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xDF69C008eEBDC1EC147B5A795eA0CAbdB3d778B5) |
| **`DatasetRegistry`** | `0x4AC6935DE58CeB54f2152a984ae5C597be9eFA5d` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x4AC6935DE58CeB54f2152a984ae5C597be9eFA5d) |
| **`ModelRegistry`** | `0x86758906B8f2b3AFffe10aAC7fD1257647F9166e` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x86758906B8f2b3AFffe10aAC7fD1257647F9166e) |
| **`PipelineSubscription`** | `0xdEF5D5C9DA844C56dd3D59481B5d1265E7101403` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xdEF5D5C9DA844C56dd3D59481B5d1265E7101403) |

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
                           ┌──────────▼──────────────┐
                           │ SQLite Event Indexer    │
                           │ + Annotation Indexer    │
                           │ (Backend Port 3001)     │
                           └─────────────────────────┘
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

### 3. Backend Relayer, Event Indexer & Annotation Indexer
```bash
cd backend/relayer
npm install
npm start
# Running on http://localhost:3001
```

### 4. Local Moondream 2 VLM GPU Server (Auto-Label + IoU Scoring)
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

Please see **[TESTING_GUIDE.md](TESTING_GUIDE.md)** for step-by-step instructions on testing multi-annotator data bounties, IoU quality scoring, VLM auto-labeling, PyTorch fine-tuning, and model registration.
