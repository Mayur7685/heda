# ⚡ Heda Protocol — Decentralized AI Data & Model Training Marketplace on 0G

> **Heda Protocol** is a decentralized end-to-end AI data pipeline, multi-annotator bounding box annotation marketplace with Moondream IoU quality scoring, and model training ecosystem built natively on **0G Storage** and **0G Galileo Testnet**.

> 📄 **Detailed Pipeline Technical Documentation**: Read [DATASET_PIPELINE.md](DATASET_PIPELINE.md) for a complete step-by-step technical breakdown of image base64 embedding, 0G Storage pinning, Moondream zero-shot auto-labeling, and PyTorch YOLOv8 model training.

---

## 🌟 Key Subsystems & Features

1. **Autonomous RapidCV Studio (`/rapid-cv` / `/pipeline`)**:
   - **8-Stage AI Engineering Pipeline**: Concept $\rightarrow$ Zero-Shot Prompting $\rightarrow$ Auto-Labeling $\rightarrow$ Multi-Class Review & Edit $\rightarrow$ Augmentations & 0G Storage Pinning $\rightarrow$ GPU YOLO Fine-Tuning $\rightarrow$ Interactive Sandbox Testing $\rightarrow$ 0G Edge Deploy & Code Export.
   - **Dynamic Golden-Angle Class Color System**: Computes non-overlapping $137.5^\circ$ Golden Ratio hue distributions for any arbitrary user classes with zero hardcoding.
   - **Interactive Test Sandbox**: Live testing with customizable Confidence Thresholds, NMS IoU suppression, Hardware selection (0G Private Compute / ONNX Edge / CPU), and raw JSON predictions inspector.

2. **Multi-Annotator Bounty Market (`AnnotationMarketV2.sol`)**:
   - Data scientists create image annotation jobs with 0G ETH bounties locked in onchain escrow.
   - **Up to 5 annotators per task** can submit annotations — no claim/lock required (fully open submission).
   - Moondream VLM + Consensus algorithms compute **IoU quality scores** for each submission vs. ground-truth auto-detection.
   - Rewards are **auto-distributed proportionally** by IoU score via the backend relayer (BPS shares).
   - Creator can trigger early manual evaluation per-task or for all pending tasks at once.

3. **0G Storage Verified Datasets (`DatasetRegistry.sol`)**:
   - Published datasets are serialized into standard COCO / YOLO formats and posted directly to 0G Storage Merkle Trees.
   - Commercial data buyers can purchase dataset licenses onchain with automated royalty disbursement.

4. **Autonomous PyTorch YOLO Model Training (`backend/ai-service`)**:
   - Fine-tunes vision models (YOLOv8, YOLOv11, RT-DETR) on user-annotated 0G datasets.
   - Decodes base64 images, formats YOLO normalized bounding boxes `[class_id, x_center, y_center, w, h]`, runs PyTorch training on GPU (Apple Silicon MPS / CUDA), and streams real-time loss & mAP@50 metrics.

5. **Decentralized AI Model Registry (`ModelRegistry.sol`)**:
   - Fine-tuned PyTorch model weights (`.pt` / `.onnx`) are uploaded to 0G Storage and registered onchain.
   - Includes live interactive model testing modal and developer integration SDK snippets (Python, cURL, JavaScript, React).

6. **Pipeline Subscription (`PipelineSubscription.sol`)**:
   - Onchain credit-gated fine-tuning pipeline with MetaMask signature required before training.

---

## 🚀 Deployed 0G Galileo Testnet Contracts

| Contract Name | Deployed Galileo Address | Explorer Link |
| :--- | :--- | :--- |
| **`AnnotationMarketV2`** ⭐ | `0xCBbb84EB5740630B4654Fbf963a503d86E67b939` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xCBbb84EB5740630B4654Fbf963a503d86E67b939) |
| **`DatasetRegistry`** | `0x63988395140a19662B3C1dC13B0B64286B0c7cc5` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x63988395140a19662B3C1dC13B0B64286B0c7cc5) |
| **`ModelRegistry`** | `0xffc1A5A9a1bE52027142686079d8A78D9dBF4987` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xffc1A5A9a1bE52027142686079d8A78D9dBF4987) |
| **`PipelineSubscription`** | `0x313BC8CA6b0aa5258b612715a3fda3e70C007260` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x313BC8CA6b0aa5258b612715a3fda3e70C007260) |

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
