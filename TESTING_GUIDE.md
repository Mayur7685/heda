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

### Terminal 2 — Node.js, SQLite Relayer Indexer & Annotation Indexer (Port 3001)
```bash
cd backend/relayer
npm install
npm start
```
*Relayer + Event Indexer + Annotation Indexer will run at `http://localhost:3001`*

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
*Expected Output: `Ran 3 test suites: 33 passed, 0 failed` (AnnotationMarket V1: 15, V2: 18)*

### 2. Event Indexer Status & Onchain Database Queries
```bash
curl http://localhost:3001/indexer/status
curl http://localhost:3001/indexer/jobs
curl http://localhost:3001/indexer/datasets
```
*Expected Output: JSON object containing indexed block status and active jobs*

### 3. Annotation Indexer — Quality Leaderboard
```bash
curl http://localhost:3001/annotations/leaderboard
```
*Expected Output: `{ "leaderboard": [...] }` with top annotators by avg IoU score*

### 4. Local Moondream 2 VLM Bounding Box Detection Test
```bash
curl -X POST http://localhost:2020/v1/detect \
  -H "Content-Type: application/json" \
  -d '{"image_url": "https://raw.githubusercontent.com/ultralytics/yolov5/master/data/images/zidane.jpg", "object": "person"}'
```
*Expected Output: JSON containing detected bounding box coordinates `[x_min, y_min, x_max, y_max]`*

### 5. IoU Annotation Score Endpoint
```bash
curl -X POST http://localhost:8000/annotation/score \
  -H "Content-Type: application/json" \
  -d '{
    "image_data": "<base64_image>",
    "labels": ["person"],
    "submitted_boxes": [{"label": "person", "x_min": 0.1, "y_min": 0.1, "x_max": 0.5, "y_max": 0.9}]
  }'
```
*Expected Output: `{ "iou_score": 0.82, "mean_iou": 0.82, "ground_truth_count": 1 }`*

### 6. IoU Python Unit Tests
```bash
cd backend/ai-service
python3 -m pytest test_iou.py -v
```
*Expected Output: `15 passed, 0 failed`*

### 7. AI Microservice Health Check
```bash
curl http://localhost:8000/
```
*Expected Output: `{"message": "Heda AI Microservice Running"}`*

---

## 🎯 Full End-to-End User Test Scenario

1. **Step 1: Wallet Setup & Faucet Funds**
2. **Step 2: Create a Multi-Annotator Bounty Job (V2)**
3. **Step 3: Annotate Tasks as Multiple Wallets & Auto-Label with Moondream**
4. **Step 4: IoU Quality Scoring & Auto Reward Distribution**
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

## 📝 Step 2: Create a Multi-Annotator Bounty Job (V2)

1. Navigate to **Create Job** (`http://localhost:5173/create`).
2. **Step 1 (Upload)**: Select 3–5 sample image files (`.png`, `.jpg`, `.webp`).
3. **Step 2 (Configure)**:
   - Enter **Instructions**: *"Draw tight bounding boxes around all hardhats and worker helmets."*
   - Add **Class Labels**: Type `hardhat` and press `Enter`.
   - Set **Reward per Task**: `0.01 0G`.
   - Set **Max Annotators per Task**: drag the slider to `3` (means up to 3 wallets can submit per task).
   - You should see the **⚡ Moondream IoU Auto-Eval** badge indicating V2 mode.
4. **Step 3 (Review & Confirm)**: Verify the review table shows:
   - `Max Annotators/Task: 3 (open submission)`
   - `Evaluation Method: ⚡ Moondream IoU Auto-Eval`
5. Click **Post Job (lock X 0G)**. Sign the MetaMask transaction.
6. **Expected Result**: Success card appears — "Up to 3 annotators per task can now submit annotations".

---

## 🎨 Step 3: Multi-Wallet Annotation & Auto-Labeling

1. Open **Jobs Marketplace** (`http://localhost:5173/jobs`).
2. Click **Start Annotating** on your job — no claiming/locking required! Slots are open.
3. In the workspace sidebar, notice each task shows a **slot counter** (e.g. `0/3`) indicating how many annotators have submitted.
4. Draw bounding boxes (or use **Moondream AI Auto-Label**) and click **Save & Next**.
5. After all tasks, click **Submit All — 1 signature**. Sign the MetaMask tx.
6. **Repeat with a second wallet** — switch wallets in MetaMask, navigate to the same job, and submit different annotations.
7. After submission, slot counter updates to e.g. `2/3`.

---

## 📊 Step 4: IoU Quality Scoring & Auto Reward Distribution

### Automatic (Backend Relayer)
The annotation indexer (`annotation-indexer.js`) polls for `WorkSubmitted` events every 10 seconds. Once a task's slots fill (or after 24 hours), it:
1. Fetches the raw image from 0G Storage.
2. Calls `POST http://localhost:8000/annotation/score` for each submission.
3. Computes proportional BPS reward shares based on IoU quality.
4. Calls `AnnotationMarketV2.distributeRewards()` on-chain automatically.

### Manual Override (Creator)
1. Navigate to **Creator Dashboard** (`http://localhost:5173/dashboard`).
2. Select your job from the left panel.
3. You will see the **IoU Score column** for each submission showing color-coded scores:
   - 🟢 Green: ≥70% — high quality
   - 🟡 Yellow: 30–69% — medium quality
   - 🔴 Red: <30% — low quality
4. Click **⚡ Evaluate All (Moondream)** to trigger immediate on-chain evaluation.
5. Or click the **⚡ Eval** button next to a specific task row.
6. Once evaluated, tasks show **Auto-Rewarded** badge with the reward share percentage.

### Verify Reward Distribution
```bash
# Check task submissions and IoU scores via indexer API
curl http://localhost:3001/annotations/task/0/0

# Check annotator stats
curl http://localhost:3001/annotations/annotator/0xYOUR_WALLET_ADDRESS

# View leaderboard
curl http://localhost:3001/annotations/leaderboard
```

---

## 📦 Step 5: Dataset Publishing & ZIP Downloading

1. On **Creator Dashboard**, click **Publish to Dataset Marketplace** (available once tasks are rewarded).
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
| **`AnnotationMarketV2`** ⭐ | `0xCBbb84EB5740630B4654Fbf963a503d86E67b939` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xCBbb84EB5740630B4654Fbf963a503d86E67b939) |
| **`DatasetRegistry`** | `0x63988395140a19662B3C1dC13B0B64286B0c7cc5` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x63988395140a19662B3C1dC13B0B64286B0c7cc5) |
| **`ModelRegistry`** | `0xffc1A5A9a1bE52027142686079d8A78D9dBF4987` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0xffc1A5A9a1bE52027142686079d8A78D9dBF4987) |
| **`PipelineSubscription`** | `0x313BC8CA6b0aa5258b612715a3fda3e70C007260` | [View on 0G Explorer](https://chainscan-galileo.0g.ai/address/0x313BC8CA6b0aa5258b612715a3fda3e70C007260) |

---

## 🤖 Step 6: Fine-Tune PyTorch YOLO Model

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
   - Model weights `.pt` are uploaded to 0G Storage and registered onchain.

---

## ⚡ Step 7: Live Model Testing & Weights Downloading

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

- [x] **Smart Contracts (V1 + V2)**: 33 / 33 unit tests passed (`cd contracts && forge test`).
- [x] **Relayer + Event Indexer**: SQLite synced on 0G Galileo Testnet (`cd backend/relayer && npm start`).
- [x] **Annotation Indexer**: Multi-annotator IoU pipeline running (`annotation-indexer.js` auto-started by relayer).
- [x] **IoU Python Tests**: 15 / 15 passed (`cd backend/ai-service && python3 -m pytest test_iou.py -v`).
- [x] **Moondream 2 VLM**: Serving local GPU detection on port `2020` (`cd backend/ai-service && python3 moondream_server.py`).
- [x] **AI Microservice**: Serving PyTorch training & inference on port `8000` (`cd backend/ai-service && python3 main.py`).
- [x] **Frontend**: Compiled clean with 0 errors (`cd frontend && npm run build`).
