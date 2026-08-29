# 🧪 Heda Protocol — Comprehensive Judge & Developer Testing Guide

This testing guide provides step-by-step instructions for testing every feature of Heda Protocol locally, including exact terminal commands, expected outputs, onchain responses, and UI state verification.

---

## 💻 Step 0: Terminal Startup Commands for Local Testing

Open 4 terminal windows to launch all sub-services locally:

### Terminal 1 — Frontend Web Application (Port 5173)
```bash
cd frontend
npm install
npm run dev
```
*App will run at `http://localhost:5173`*

### Terminal 2 — Node.js & SQLite Relayer Indexer (Port 3001)
```bash
cd backend/relayer
npm install
npm start
```
*Indexer API will run at `http://localhost:3001`*

### Terminal 3 — Local Moondream 2 VLM Server (Port 2020)
```bash
cd backend/ai-service
python3 -m pip install -r requirements.txt --break-system-packages
python3 moondream_server.py
```
*Dedicated VLM Server will load model onto GPU & run at `http://localhost:2020`*

### Terminal 4 — PyTorch YOLO Fine-Tuning & Inference Service (Port 8000)
```bash
cd backend/ai-service
python3 main.py
```
*Main AI Microservice will run at `http://localhost:8000`*

---

## 💻 CLI Verification & Test Commands

You can also run these direct terminal commands to verify each subsystem:

### 1. Smart Contract Unit Tests (Foundry)
```bash
cd contracts
forge test
```
*Expected Output: `Ran 2 test suites: 17 passed, 0 failed`*

### 2. Event Indexer Status & Onchain Database Queries
```bash
curl http://localhost:3001/indexer/status
curl http://localhost:3001/indexer/jobs
curl http://localhost:3001/indexer/datasets
```
*Expected Output: JSON object containing indexed block status and active jobs*

### 3. Local Moondream 2 VLM Bounding Box Detection Test
```bash
curl -X POST http://localhost:2020/v1/detect \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://raw.githubusercontent.com/ultralytics/yolov5/master/data/images/zidane.jpg", "object": "person"}'
```
*Expected Output: JSON containing detected bounding box coordinates `[x_min, y_min, x_max, y_max]`*

### 4. AI Microservice Swagger & Health Check
```bash
curl http://localhost:8000/
```
*Expected Output: `{"message": "Heda AI Microservice Running"}`*

---

## 🎯 Full End-to-End User Test Scenario

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

## 📜 Deployed 0G Galileo Smart Contracts

| Contract Name | Deployed Galileo Address | Explorer Link |
| :--- | :--- | :--- |
| **`AnnotationMarket`** | `0x0577d4422B9065E2C8B7A29794DD176601Cf2c19` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x0577d4422B9065E2C8B7A29794DD176601Cf2c19) |
| **`DatasetRegistry`** | `0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c) |
| **`ModelRegistry`** | `0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D) |
| **`PipelineSubscription`** | `0x07231896B7dF2F51E6a56A6118850b43522E8f44` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x07231896B7dF2F51E6a56A6118850b43522E8f44) |

---

## 🤖 Step 6: Fine-Tune PyTorch YOLO Model (`TrainingModal.tsx` & `RapidCVPipeline.tsx`)

1. On the Dataset detail page or **Rapid CV Studio** (`http://localhost:5173/rapid-cv`), click **Start YOLO Fine-Tuning**.
2. **MetaMask Onchain Transaction Signature Prompt**:
   - Prompts you to confirm 1 Training Credit deduction onchain (`PipelineSubscription.sol.consumeTrainingQuota`).
   - If confirmed, credit is deducted on 0G Galileo Testnet and PyTorch training starts!
3. **Live Visual Telemetry Dashboard**:
   - **Progress Fill Bar**: Animates `Epoch X of Y (XX%)`.
   - **Metrics HUD Grid**: Live mAP@50, Precision, Box Loss, and Cls Loss pills.
   - **Live Event Stream**: Streaming badges for `[HARDWARE]` (⚡ Apple Metal MPS), `[0G DATA]`, `[YOLO SETUP]`, and `[EPOCH]`.
4. **Publish Model to Universe**:
   - When training completes, click **Publish Model to Model Universe**.
   - Model weights `.pt` are uploaded to 0G Storage and registered onchain with `sourceDatasetName` metadata.

---

## ⚡ Step 7: Live Model Testing & Weights Downloading (`Models.tsx`)

1. Navigate to **Model Universe** (`http://localhost:5173/models`).
2. Every model card displays:
   - **Source Dataset Badge & Link**: e.g., `🗄️ dataset of hardhat (#40)` linking straight to `/datasets/:id`.
   - **Download Weights (.pt)**: Decodes base64 model binary and saves as `<model_name>.pt`.
3. Click **Test Model (Live Inference)** on your trained YOLO model.
4. Upload any test image from your computer.
5. Click **Run Live Inference**.
6. **Expected Result**: Clean green bounding box overlays render on your test image with realtime detection latency (`<15ms`).

---

## 🟢 Verification Checklist

- [x] **Smart Contracts**: 17 / 17 unit tests passed (`cd contracts && forge test`).
- [x] **Relayer Indexer**: SQLite synced on 0G Galileo Testnet (`cd backend/relayer && npm start`).
- [x] **Moondream 2 VLM**: Serving local GPU detection on port `2020` (`cd backend/ai-service && python3 moondream_server.py`).
- [x] **AI Microservice**: Serving PyTorch training & inference on port `8000` (`cd backend/ai-service && python3 main.py`).
- [x] **Frontend**: Compiled clean with 0 errors (`cd frontend && npm run build`).
