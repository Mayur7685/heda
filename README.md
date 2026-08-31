# ⚡ Heda Protocol — Decentralized AI Data & Model Training Marketplace on 0G

> **Heda Protocol** is a decentralized end-to-end AI vision engineering ecosystem, multi-annotator bounding box annotation marketplace with Moondream IoU quality scoring, and autonomous model training pipeline built natively on **0G Storage** and the **0G Galileo Testnet**.

[![0G Galileo Testnet](https://img.shields.io/badge/Network-0G%20Galileo%20Testnet%20(16602)-00e479?style=flat-square)](https://chainscan-galileo.0g.ai)
[![0G Storage](https://img.shields.io/badge/Storage-0G%20Decentralized%20Storage-00bfff?style=flat-square)](https://storagescan-galileo.0g.ai)
[![Moondream VLM](https://img.shields.io/badge/VLM-Moondream%202%20Auto--Label-ff9f1c?style=flat-square)](https://moondream.ai)
[![PyTorch YOLO](https://img.shields.io/badge/Model-PyTorch%20YOLOv8%20%2F%20v11%20%2F%20RT--DETR-a855f7?style=flat-square)](https://ultralytics.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

1. [Key Features & Subsystems](#-key-features--subsystems)
   - [1. Autonomous RapidCV Studio (8-Stage Pipeline)](#1-autonomous-rapidcv-studio-8-stage-ai-pipeline)
   - [2. Multi-Annotator Bounty Marketplace](#2-multi-annotator-bounty-marketplace-annotationmarketv2sol)
   - [3. 0G Storage Verified Dataset Registry](#3-0g-storage-verified-dataset-registry-datasetregistrysol)
   - [4. Autonomous PyTorch GPU Model Fine-Tuning](#4-autonomous-pytorch-gpu-model-fine-tuning-backendai-service)
   - [5. Interactive Test Sandbox & Live Inference](#5-interactive-test-sandbox--live-inference)
   - [6. Decentralized AI Model Registry](#6-decentralized-ai-model-registry-modelregistrysol)
   - [7. Pipeline Subscription & Quota Management](#7-pipeline-subscription--quota-management-pipelinesubscriptionsol)
   - [8. Creator Dashboard & Quality Leaderboard](#8-creator-dashboard--quality-leaderboard)
2. [🔮 Upcoming Features & Roadmap (Coming Soon)](#-upcoming-features--roadmap-coming-soon)
   - [1. Unified 0G VLM Leaderboard](#1-unified-0g-vlm-leaderboard-0g-private-compute-benchmark)
   - [2. Actionable Vision Workflows](#2-actionable-vision-workflows-event-trigger--reaction-engine)
   - [3. Physical Device & Edge IoT Vision Pipeline](#3-physical-device--edge-iot-vision-pipeline-esp32--raspberry-pi--jetson)
3. [Deployed 0G Galileo Smart Contracts](#-deployed-0g-galileo-smart-contracts)
4. [System Architecture](#-system-architecture)
5. [Quick Start & Running Locally](#-quick-start--running-locally)
6. [Testing & Verification](#-testing--verification)

---

## 🌟 Key Features & Subsystems

### 1. Autonomous RapidCV Studio (8-Stage AI Pipeline)
RapidCV Studio (`/rapid-cv` or `/pipeline`) transforms raw, unlabeled images into production-ready computer vision models through an autonomous 8-stage engineering loop:

- **Stage 1 (Concept & Task Selection)**: Choose from pre-configured industry domains (*PPE Safety, Drone Inspection, Smart Agriculture, Retail, Robotics, Urban Mobility*) or define open-ended custom vision tasks.
- **Stage 2 (Open-Ended Class Definition)**: Add arbitrary vision classes (e.g. `hardhat`, `safety vest`, `drone`, `microchip`).
- **Stage 3 (Zero-Shot VLM Auto-Labeling)**: Leverages **Moondream Cloud API** or local GPU VLM to detect objects, normalize bounding boxes, and label classes with sub-second latency.
- **Stage 4 (Multi-Class Review & Dynamic Golden-Angle Colors)**: 
  - Uses a deterministic **Golden Angle ($137.508^\circ$) color wheel distribution** ($\theta = (140^\circ + i \times 137.508^\circ) \pmod{360^\circ}$) so that *any* user-defined classes receive distinct, non-overlapping, high-contrast colors.
  - Interactive Konva canvas editor allows bounding box drawing, resizing, and manual label reassignment.
- **Stage 5 (Data Augmentation & 0G Storage Pinning)**: Applies flip, rotation, brightness, and mosaic augmentations, encodes complete Base64 image payloads + COCO JSON annotations, and pins the dataset to 0G Storage nodes.
- **Stage 6 (PyTorch GPU Fine-Tuning)**: Fine-tunes custom YOLO models (YOLOv8, YOLOv11, RT-DETR) with live streaming **HUD Telemetry** (mAP@50, Box Loss, Cls Loss, Precision, Recall).
- **Stage 7 (Interactive Test Sandbox)**: Real-time playground with hyperparameter sliders (**Confidence Threshold**, **NMS IoU suppression**, **Hardware Engine**, and **Max Detections**).
- **Stage 8 (0G Edge Deploy & Code Export)**: Registers weights onchain and provides drop-in SDK snippets in Python, cURL, JavaScript, and React.

---

### 2. Multi-Annotator Bounty Marketplace (`AnnotationMarketV2.sol`)
A decentralized crowdsourced labeling market with automated quality-weighted reward settlement:

- **Open Task Slots**: Up to 5 independent annotators can submit annotations per task without restrictive claim locks.
- **Batch Submission**: Annotators complete entire jobs and submit all tasks in **1 single signature & transaction** (`submitWorkBatch`).
- **Automated IoU Quality Scoring**: The backend relayer indexes submissions and computes **Mean-Best-Match IoU** against Moondream ground truth.
- **Proportional Reward Distribution**: Rewards are distributed onchain via `distributeRewards()` in exact proportion to annotator IoU scores (BPS shares summing to 10,000).
- **Creator Manual Override**: Creators can trigger early onchain evaluation at any time (`triggerEvaluation()`) or close jobs to reclaim unspent bounties.

---

### 3. 0G Storage Verified Dataset Registry (`DatasetRegistry.sol`)
Decentralized dataset publishing and licensing infrastructure:

- **Complete Binary Embedding**: Unlike metadata-only pointers, Heda embeds binary image data and COCO annotations into single verified 0G Storage Merkle root hashes.
- **Onchain Licensing**: Commercial buyers purchase access licenses onchain with automated royalty disbursement to dataset publishers.
- **One-Click ZIP Export**: Clients unpack 0G Storage Merkle trees and download full datasets containing both `annotations/instances.json` and raw image binaries.

---

### 4. Autonomous PyTorch GPU Model Fine-Tuning (`backend/ai-service`)
High-performance machine learning microservice for fine-tuning vision models on 0G datasets:

- **Hardware Acceleration**: Automatically detects and activates **Apple Silicon Metal (MPS)**, **NVIDIA CUDA**, or multi-threaded CPU.
- **Dataset Structuring**: Automatically downloads 0G Storage root hashes, decodes Base64 images into `images/train/`, and formats normalized YOLO `.txt` labels.
- **Telemetry Streaming**: Emits real-time SSE/polling telemetry to the frontend progress HUD.

---

### 5. Interactive Test Sandbox & Live Inference
A comprehensive testing environment embedded directly into the RapidCV Pipeline:

- **Separated Upload & Inference**: Upload test images or pick 1-click samples from the staged dataset reel.
- **Live Hyperparameter Sliders**:
  - **Confidence Threshold** (`10% - 95%`): Live filters low-confidence predictions.
  - **NMS IoU Threshold** (`10% - 90%`): Controls overlapping bounding box suppression.
  - **Hardware Engine Selector**: `0G Private Computer (CUDA GPU)`, `0G Edge Runtime (ONNX)`, or `Local CPU`.
  - **Max Detections Limit**: Preset caps (`25`, `50`, `100`, `300`).
- **Dedicated Run Action**: Prominent **`⚡ Run Model Inference`** button with sub-15ms execution time and raw JSON inspection.

---

### 6. Decentralized AI Model Registry (`ModelRegistry.sol`)
Onchain repository for trained computer vision model weights:

- **Dataset Provenance**: Every model entry stores the source dataset ID, title, and training metrics (mAP@50, epochs, architecture).
- **Binary Weight Downloads**: Download trained PyTorch weights (`.pt`) or ONNX runtime binaries.
- **Live Testing Modal**: Test any published model directly inside the browser (`InferenceModal.tsx`).

---

### 7. Pipeline Subscription & Quota Management (`PipelineSubscription.sol`)
Smart contract credit manager for compute-intensive pipelines:

- **Credit Escrow**: Manages user training quotas onchain.
- **MetaMask Transaction Authorization**: Fine-tuning consumes 1 training credit via `consumeTrainingQuota()` prior to execution.

---

### 8. Creator Dashboard & Quality Leaderboard
Comprehensive analytics and reputation tracking:

- **Creator Studio (`/dashboard`)**: Track active jobs, view annotator slot fill rates, inspect color-coded submission IoU scores (🟢 $\ge 70\%$, 🟡 $30-69\%$, 🔴 $<30\%$), and trigger batch evaluations.
- **Global Leaderboard (`/leaderboard`)**: Ranks annotators worldwide by completed tasks, total 0G earned, and historical average IoU quality score.

---

## 🔮 Upcoming Features & Roadmap (Coming Soon)

Based on the platform showcase on the landing page, the following major vision infrastructure modules are in active development:

### 1. Unified 0G VLM Leaderboard (0G Private Compute Benchmark)
- **Decentralized Vision Benchmarks**: Comprehensive rankings and evaluation of Vision-Language Models (VLMs) hosted on **0G Private Compute**.
- **Specialized Vision Tasks**: Performance tracking across *Object Detection, Counting, Spatial Identification, Industrial OCR, Structured Data Extraction, and Visual Reasoning*.
- **Quality Score Tiers**: Transparent performance tiers (🟢 $\ge 75\%$ High Accuracy, 🟡 $40–74\%$ Medium, 🔴 $<40\%$ Low) with filters for Open vs. Closed weights.

### 2. Actionable Vision Workflows (Event Trigger & Reaction Engine)
- **Threshold-Driven Automation**: Transform raw computer vision detections into automated real-world physical and digital actions:
  - **Industrial PPE Compliance**: `IF 'no_hardhat' in Zone A > 85% confidence` $\rightarrow$ Trigger audio siren on factory floor + write immutable incident hash to 0G Galileo.
  - **Automated Conveyor Defect Ejection**: `IF 'surface_scratch' > 90% confidence` $\rightarrow$ Pulse GPIO relay on Raspberry Pi / PLC to divert defective part to reject bin.
  - **Perimeter Security Alert**: `IF 'unauthorized_vehicle' after hours` $\rightarrow$ Dispatch webhook alert + pin high-res Merkle proof snapshot to 0G Storage.

### 3. Physical Device & Edge IoT Vision Pipeline (ESP32 / Raspberry Pi / Jetson)
- **Autonomous Microcontroller Ingestion**: Connect low-cost $5 ESP32-CAMs and edge cameras via `POST /api/device/push`.
- **Automated Field Ingestion Flow**:
  1. Microcontrollers capture frames on motion/optical triggers.
  2. Frames are pushed directly to Heda for zero-shot Moondream VLM auto-labeling.
  3. Raw image captures are permanently pinned to **0G Storage** Merkle trees.
  4. Automatic creation of onchain bounty tasks for human verification.
  5. Export lightweight **ONNX / TensorRT** optimized weights back to edge microcontrollers.

---

## 🚀 Deployed 0G Galileo Testnet Contracts

All smart contracts are compiled with Solidity `^0.8.24` and deployed on the **0G Galileo Testnet** (Chain ID `16602`):

| Contract Name | Deployed Galileo Address | Explorer Link |
| :--- | :--- | :--- |
| **`AnnotationMarketV2`** ⭐ | `0x91D36c08C323e9e7C3Fb77D4802E152277f73fFe` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x91D36c08C323e9e7C3Fb77D4802E152277f73fFe) |
| **`DatasetRegistry`** | `0xb026c66388EaF015198b242E5c6ca00aF36A6E26` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xb026c66388EaF015198b242E5c6ca00aF36A6E26) |
| **`ModelRegistry`** | `0x6aD6537618dD2bF3B9cAe585E485Ff216AAb1c0C` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x6aD6537618dD2bF3B9cAe585E485Ff216AAb1c0C) |
| **`PipelineSubscription`** | `0x3EE57E207D6A826f05b57101dcbA002fC1fCE6D1` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x3EE57E207D6A826f05b57101dcbA002fC1fCE6D1) |

---

## 🛠️ System Architecture

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
- **Python**: v3.10+ (with PyTorch support)
- **Foundry**: `forge` & `cast`

### 2. Frontend Launch
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

### 3. Backend Relayer & SQLite Indexers
```bash
cd backend/relayer
npm install
npm start
# Running on http://localhost:3001
```

### 4. Python AI & Model Fine-Tuning Service
```bash
cd backend/ai-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
# Running on http://localhost:8000
```

### 5. (Optional) Local Moondream 2 VLM Server
```bash
cd backend/ai-service
source .venv/bin/activate
python3 moondream_server.py
# Running on http://localhost:2020
```

---

## 🧪 Testing & Verification

For comprehensive end-to-end testing scenarios, smart contract Foundry test suites, and API verification commands, please refer to:
- 📖 **[TESTING_GUIDE.md](TESTING_GUIDE.md)** — Step-by-step judge and developer testing playbook.
- 📦 **[DATASET_PIPELINE.md](DATASET_PIPELINE.md)** — In-depth dataset serialization, 0G Storage Merkle proofs, and model training specifications.
