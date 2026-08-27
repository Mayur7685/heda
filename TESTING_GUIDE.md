# 🧪 Heda Protocol — Comprehensive Judge & Developer Testing Guide

This testing guide provides step-by-step instructions for testing every feature of Heda Protocol, including expected terminal outputs, onchain responses, and UI state verification.

---

## 🎯 Test Scenario Overview

1. **Step 1: Wallet Setup & Faucet Funds**
2. **Step 2: Create an Image Annotation Bounty Job**
3. **Step 3: Annotate Tasks & Run Moondream 2 Zero-Shot Auto-Labeling**
4. **Step 4: Review, Approve Work & Release Bounty Rewards**
5. **Step 5: Package & Download 0G Storage Dataset (COCO Format)**
6. **Step 6: Fine-Tune PyTorch YOLOv8 Model on 0G Dataset**
7. **Step 7: Register Model Weights & Run Live PyTorch Inference Test**

---

## 🛠️ Step 1: Wallet Setup & Galileo Faucet

1. Open your Web3 wallet (MetaMask or WalletConnect).
2. Switch network to **0G Galileo Testnet**:
   - **Network Name**: `0g Galileo Testnet`
   - **RPC URL**: `https://evmrpc-testnet.0g.ai`
   - **Chain ID**: `16602`
   - **Currency Symbol**: `0G`
   - **Block Explorer**: `https://chainscan-galileo.0g.ai`
3. Fund your wallet with testnet tokens via [https://faucet.0g.ai](https://faucet.0g.ai).

---

## 📝 Step 2: Create an Image Annotation Job (`CreateJob.tsx`)

1. Navigate to **Create Job** (`http://localhost:5173/create`).
2. **Step 1 (Upload)**: Select 3–5 sample image files (`.png`, `.jpg`, `.webp`).
3. **Step 2 (Configure)**:
   - Enter **Instructions**: *"Draw tight bounding boxes around all hardhats and worker helmets."*
   - Add **Class Labels**: Type `hardhat` and press `Enter`.
   - Set **Reward per Task**: `0.01 0G`.
4. **Step 3 (Review & Confirm)**: Click **Create Job & Lock Escrow**.
5. **MetaMask Prompt**: Sign the transaction.
6. **Expected Result**: Success card appears displaying transaction hash link and **"View on Creator Dashboard"** button.

---

## 🎨 Step 3: Annotate Tasks & Auto-Labeling (`Workspace.tsx` & `RapidCVPipeline.tsx`)

1. Open **Jobs Marketplace** (`http://localhost:5173/jobs`) or **Rapid CV Pipeline** (`http://localhost:5173/pipeline`).
2. Click **Start Annotating** on Job `#0`.
3. In the workspace tool sidebar, click **Moondream AI Auto-Label (Local VLM)**.
4. **Expected Terminal Output (`moondream_server.py`)**:
   ```
   [VLM DETECT] Finding object: 'hardhat'
   ✔ Local Moondream 2 VLM detected 2 objects locally (0.42s)
   ```
5. Bounding boxes automatically render over the canvas in green.
6. Click **Review & Submit All Tasks**. Confirm the MetaMask signature transaction.

---

## 📊 Step 4: Creator Approval & Reward Disbursement (`Dashboard.tsx`)

1. Switch wallet account to the **Job Creator** address.
2. Navigate to **Creator Dashboard** (`http://localhost:5173/dashboard`).
3. Under **Jobs Created**, expand Job `#0`.
4. Review submitted task annotations. Click **Approve Submission**.
5. **Expected Result**: Onchain transaction executes `AnnotationMarket.approveWork()`, disbursing `0.01 0G` reward directly to the worker's address.

---

## 📦 Step 5: Dataset Publishing & ZIP Downloading (`DatasetDetail.tsx`)

1. On **Creator Dashboard**, click **Publish to Dataset Marketplace**.
2. Set dataset license price (e.g. `0 0G` for free or `0.05 0G` paid).
3. Navigate to **Dataset Marketplace** (`http://localhost:5173/datasets`).
4. Click on your dataset card and click **Download Dataset (.ZIP)**.
5. **Expected Result**: Unzipping `heda-dataset-0.zip` contains:
   - `annotations/instances.json` (Full COCO format schema).
   - `images/task_1.jpg`, `images/task_2.jpg`, etc.

---

## 🤖 Step 6: Fine-Tune PyTorch YOLO Model (`TrainingModal.tsx`)

1. On the Dataset detail page or **Rapid CV Pipeline**, click **Fine-Tune YOLO Model**.
2. Click **Start Local PyTorch Training**.
3. **Expected Terminal Output (`main.py` & `train_yolo.py`)**:
   ```
   ==============================================================
   HEDA PROTOCOL — PYTORCH YOLO MODEL FINE-TUNING ENGINE
   ==============================================================
   [1/4] Fetching dataset root 0xc9d3... across 0G Storage gateways...
   [2/4] Decoded 10 base64 images into images/train/
   [3/4] Formatted YOLO label files in labels/train/
   [4/4] Running PyTorch YOLOv8n fine-tuning...
   Epoch 1/10 - loss: 0.842 - mAP50: 0.764
   Epoch 10/10 - loss: 0.112 - mAP50: 0.914
   ✔ Training Complete! Model weights saved to best.pt
   ```

---

## ⚡ Step 7: Live Model Testing (`InferenceModal.tsx`)

1. Navigate to **Model Registry** (`http://localhost:5173/models`).
2. Click **Test Model (Live Inference)** on your trained YOLO model.
3. Upload any test image from your computer.
4. Click **Run Live Inference**.
5. **Expected Result**: The trained model detects bounding boxes on your uploaded image, displaying confidence percentages and detection latency (`<15ms`).

---

## 🟢 Verification Checklist

- [x] **Smart Contracts**: 17 / 17 unit tests passed (`cd contracts && forge test`).
- [x] **Relayer Indexer**: SQLite synced on 0G Galileo Testnet (`cd backend/relayer && npm start`).
- [x] **Moondream 2 VLM**: Serving local GPU detection on port `2020` (`cd backend/ai-service && python3 moondream_server.py`).
- [x] **AI Microservice**: Serving PyTorch training & inference on port `8000` (`cd backend/ai-service && python3 main.py`).
- [x] **Frontend**: Compiled clean with 0 errors (`cd frontend && npm run build`).
