# ⚡ Heda Protocol — Decentralized AI Data & Model Training Marketplace on 0G

> **Heda Protocol** is a decentralized end-to-end AI vision engineering ecosystem, physical IoT edge camera fleet manager, multi-annotator bounding box annotation marketplace with Moondream IoU quality scoring, and autonomous model training pipeline built natively on **0G Storage** and the **0G Galileo Testnet**.

[![0G Galileo Testnet](https://img.shields.io/badge/Network-0G%20Galileo%20Testnet%20(16602)-00e479?style=flat-square)](https://chainscan-galileo.0g.ai)
[![0G Storage](https://img.shields.io/badge/Storage-0G%20Decentralized%20Storage-00bfff?style=flat-square)](https://storagescan-galileo.0g.ai)
[![Moondream VLM](https://img.shields.io/badge/VLM-Moondream%202%20Auto--Label-ff9f1c?style=flat-square)](https://moondream.ai)
[![PyTorch YOLO](https://img.shields.io/badge/Model-PyTorch%20YOLOv8%20%2F%20v11%20%2F%20RT--DETR-a855f7?style=flat-square)](https://ultralytics.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-white?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

1. [Key Features & Subsystems](#-key-features--subsystems)
   - [1. Autonomous RapidCV Studio (8-Stage Pipeline)](#1-autonomous-rapidcv-studio-8-stage-ai-pipeline)
   - [2. Physical IoT & Edge Hardware Fleet](#2-physical-iot--edge-hardware-fleet-deviceregistrysol)
   - [3. Multi-Annotator Bounty Marketplace](#3-multi-annotator-bounty-marketplace-annotationmarketv2sol)
   - [4. 0G Storage Verified Dataset Registry](#4-0g-storage-verified-dataset-registry-datasetregistrysol)
   - [5. Autonomous PyTorch GPU Model Fine-Tuning](#5-autonomous-pytorch-gpu-model-fine-tuning-backendai-service)
   - [6. Interactive Test Sandbox & Live Inference](#6-interactive-test-sandbox--live-inference)
   - [7. Decentralized AI Model Registry](#7-decentralized-ai-model-registry-modelregistrysol)
   - [8. Pipeline Subscription & Quota Management](#8-pipeline-subscription--quota-management-pipelinesubscriptionsol)
   - [9. Creator Dashboard & Quality Leaderboard](#9-creator-dashboard--quality-leaderboard)
2. [📡 Edge Hardware & Demo Simulation Guide](#-edge-hardware--demo-simulation-guide)
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

### 2. Physical IoT & Edge Hardware Fleet (`DeviceRegistry.sol`)
Connect physical cameras and edge computing microcontrollers directly to the 0G network:

- **On-Chain Hardware Pairing**: Register edge devices (`ESP32-CAM`, Raspberry Pi, Jetson) under your wallet on `DeviceRegistry.sol`.
- **Decentralized Ingestion**: Microcontrollers stream photos directly via HTTP POST, pinned instantly to **0G Storage**.
- **1-Click Bounty Conversion**: Select streamed camera frames and package them into decentralized bounding box bounties.
- **Over-The-Air (OTA) Weights Sync**: Assign trained YOLO/ONNX weights onchain $\rightarrow$ cameras automatically sync checkpoints via `/api/v1/devices/:id/ota`.
- 📖 **[View Hardware Firmware Guide & Pinouts](firmware/esp32-cam/README.md)**

---

### 3. Multi-Annotator Bounty Marketplace (`AnnotationMarketV2.sol`)
A decentralized crowdsourced labeling market with automated quality-weighted reward settlement:

- **Open Task Slots**: Up to 5 independent annotators can submit annotations per task without restrictive claim locks.
- **Batch Submission**: Annotators complete entire jobs and submit all tasks in **1 single signature & transaction** (`submitWorkBatch`).
- **Automated IoU Quality Scoring**: The backend relayer indexes submissions and computes **Mean-Best-Match IoU** against Moondream ground truth.
- **Proportional Reward Distribution**: Rewards are distributed onchain via `distributeRewards()` in exact proportion to annotator IoU scores (BPS shares summing to 10,000).
- **Creator Manual Override**: Creators can trigger early onchain evaluation at any time (`triggerEvaluation()`) or close jobs to reclaim unspent bounties.

---

### 4. 0G Storage Verified Dataset Registry (`DatasetRegistry.sol`)
Decentralized dataset publishing and licensing infrastructure:

- **Complete Binary Embedding**: Unlike metadata-only pointers, Heda embeds binary image data and COCO annotations into single verified 0G Storage Merkle root hashes.
- **Onchain Licensing**: Commercial buyers purchase access licenses onchain with automated royalty disbursement to dataset publishers.
- **One-Click ZIP Export**: Clients unpack 0G Storage Merkle trees and download full datasets containing both `annotations/instances.json` and raw image binaries.

---

### 5. Autonomous PyTorch GPU Model Fine-Tuning (`backend/ai-service`)
High-performance machine learning microservice for fine-tuning vision models on 0G datasets:

- **Hardware Acceleration**: Automatically detects and activates **Apple Silicon Metal (MPS)**, **NVIDIA CUDA**, or multi-threaded CPU.
- **Dataset Structuring**: Automatically downloads 0G Storage root hashes, decodes Base64 images into `images/train/`, and formats normalized YOLO `.txt` labels.
- **Telemetry Streaming**: Emits real-time SSE/polling telemetry to the frontend progress HUD.

---

### 6. Interactive Test Sandbox & Live Inference
A comprehensive testing environment embedded directly into the RapidCV Pipeline:

- **Live Hyperparameter Sliders**:
  - **Confidence Threshold** (`10% - 95%`): Live filters low-confidence predictions.
  - **NMS IoU Threshold** (`10% - 90%`): Controls overlapping bounding box suppression.
  - **Hardware Engine Selector**: `0G Private Computer (CUDA GPU)`, `0G Edge Runtime (ONNX)`, or `Local CPU`.
  - **Max Detections Limit**: Preset caps (`25`, `50`, `100`, `300`).
- **Dedicated Run Action**: Prominent **`⚡ Run Model Inference`** button with sub-15ms execution time and raw JSON inspection.

---

### 7. Decentralized AI Model Registry (`ModelRegistry.sol`)
Onchain repository for trained computer vision model weights:

- **Dataset Provenance**: Every model entry stores the source dataset ID, title, and training metrics (mAP@50, epochs, architecture).
- **Binary Weight Downloads**: Download trained PyTorch weights (`.pt`) or ONNX runtime binaries.
- **Live Testing Modal**: Test any published model directly inside the browser (`InferenceModal.tsx`).

---

### 8. Pipeline Subscription & Quota Management (`PipelineSubscription.sol`)
Smart contract credit manager for compute-intensive pipelines:

- **Credit Escrow**: Manages user training quotas onchain.
- **MetaMask Transaction Authorization**: Fine-tuning consumes 1 training credit via `consumeTrainingQuota()` prior to execution.

---

### 9. Creator Dashboard & Quality Leaderboard
Comprehensive analytics and reputation tracking:

- **Creator Studio (`/dashboard`)**: Track active jobs, view annotator slot fill rates, inspect color-coded submission IoU scores (🟢 $\ge 70\%$, 🟡 $30-69\%$, 🔴 $<30\%$), and trigger batch evaluations.
- **Global Leaderboard (`/leaderboard`)**: Ranks annotators worldwide by completed tasks, total 0G earned, and historical average IoU quality score.

---

## 📡 Edge Hardware & Demo Simulation Guide

Heda supports both **physical hardware deployments** (e.g. Seeed Studio XIAO ESP32-S3, AI-Thinker ESP32-CAM) and a **complete simulation workflow** for testing in demo and evaluation environments.

### How it Works in Production (Physical Microcontroller)
```
 ┌──────────────┐    Raw Binary JPEG    ┌──────────────────┐    0G Turbo    ┌──────────────────┐
 │  ESP32-CAM   │ ────────────────────> │  Heda Relayer    │ ─────────────> │    0G Storage    │
 │  Edge Node   │  X-Device-Id Header   │  /api/v1/ingest  │                │  (Decentralized) │
 └──────────────┘                       └──────────────────┘                └──────────────────┘
```
1. The physical camera connects to 2.4GHz Wi-Fi and captures a JPEG frame from its OV2640 sensor.
2. The firmware executes an HTTP POST to `/api/v1/ingest` with header `X-Device-Id: ESP32-<MAC_ADDRESS>`.
3. The Relayer calculates the Merkle root and pins the image to **0G Storage**.
4. The frame index is registered in SQLite WAL database and tied to the paired wallet on `DeviceRegistry.sol`.

---

### How to Simulate Edge Ingestion in Demo Environments

You do **not** need physical ESP32 hardware to test the edge hardware fleet features. You can simulate edge camera snapshots using standard CLI commands:

#### Step 1: Pair a Simulated Camera in the WebApp
1. Navigate to **`http://localhost:5173/devices`** in your browser.
2. Click **`+ Pair New Camera`**.
3. Enter Device ID: `ESP32-94:E6:86:12:AB:CD` and Device Name: `Construction Site Cam #1`.
4. Confirm the transaction in MetaMask on **0G Galileo Testnet**.

#### Step 2: Simulate Edge Camera Frame Snapshots (0G Storage Upload)
Run the following curl command to upload a batch of real-world edge camera snapshots to 0G Storage under your paired device ID:

```bash
# Upload sample hardhat construction photos to 0G Storage
curl -X POST http://localhost:3001/api/v1/ingest \
  -H "X-Device-Id: ESP32-94:E6:86:12:AB:CD" \
  -F "frame=@hardhatdata/hardhat1.jpg"
```

*To stream 5 distinct frames:*
```bash
for file in hardhat1.jpg hardhat2.jpg hardhat3.jpg hardhat4.jpg hardhat5.jpg; do
  echo "Streaming $file to 0G Storage..."
  curl -s -X POST http://localhost:3001/api/v1/ingest \
    -H "X-Device-Id: ESP32-94:E6:86:12:AB:CD" \
    -F "frame=@hardhatdata/$file"
  echo ""
  sleep 1
done
```

#### Step 3: View Ingested Frames & Deploy Bounties
1. Refresh **`http://localhost:5173/devices`** — your camera card will show `Live 0G Node` and `Frames Ingested: 5`.
2. Click **`View Ingest Stream`** to open the gallery (`/devices/ESP32-94:E6:86:12:AB:CD`).
3. Select frames, click **`⚡ Create Bounty Job`**, set instructions and reward, and deploy directly to **0G Galileo**.
4. Annotators can now annotate these edge frames in the **Workspace**!

#### Step 4: Simulate OTA Weights Synchronization
When a model is assigned to the camera from the web dashboard, simulate the edge camera checking for new model weights:
```bash
curl http://localhost:3001/api/v1/devices/ESP32-94:E6:86:12:AB:CD/ota
```
**Output:**
```json
{
  "deviceId": "ESP32-94:E6:86:12:AB:CD",
  "assigned": true,
  "modelTitle": "PPE Hardhat Detector v1",
  "weightsRootHash": "0x794bfa2542a2205562857e4e13028bc1665a3ba2e8e2d42bfe07d4b4a16ca32e",
  "weightsDownloadUrl": "http://localhost:3001/file?root=0x794bfa2542a2205562857e4e13028bc1665a3ba2e8e2d42bfe07d4b4a16ca32e"
}
```

---

## 🚀 Deployed 0G Galileo Testnet Contracts

All smart contracts are compiled with Solidity `^0.8.24` and deployed on the **0G Galileo Testnet** (Chain ID `16602`):

| Contract Name | Deployed Galileo Address | Explorer Link |
| :--- | :--- | :--- |
| **`AnnotationMarketV2`** ⭐ | `0xA93b5bB49Ef86ceB8Cb06d06e984bAaf25683Ff0` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xA93b5bB49Ef86ceB8Cb06d06e984bAaf25683Ff0) |
| **`DatasetRegistry`** | `0x22eBC4856744a628d19992d12304C951c7F5E1aD` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x22eBC4856744a628d19992d12304C951c7F5E1aD) |
| **`ModelRegistry`** | `0xed6Ba6EC7c9ada63e0b37f97a4cA36042E3D6698` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xed6Ba6EC7c9ada63e0b37f97a4cA36042E3D6698) |
| **`PipelineSubscription`** | `0x6952ec1f73626BdBF7BD8C549589710b25cfE622` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x6952ec1f73626BdBF7BD8C549589710b25cfE622) |
| **`DeviceRegistry`** 📷 | `0xae5f90a24513ca825a30C66aA279f5f363bdbbAb` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xae5f90a24513ca825a30C66aA279f5f363bdbbAb) |

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
                           │ + Hardware Ingest Engine│
                           │ (Backend Port 3001)     │
                           └──────────▲──────────────┘
                                      │
                           ┌──────────┴──────────────┐
                           │ Physical ESP32-CAMs     │
                           │ & Edge Vision Nodes     │
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
- 📷 **[firmware/esp32-cam/README.md](firmware/esp32-cam/README.md)** — Physical ESP32-CAM flashing & wiring guide.
- 📦 **[DATASET_PIPELINE.md](DATASET_PIPELINE.md)** — In-depth dataset serialization, 0G Storage Merkle proofs, and model training specifications.
