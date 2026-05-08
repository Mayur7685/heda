# Heda — Judge Testing Guide

> Complete walkthrough of all features. Estimated time: 15–20 minutes for full flow.

---

## Prerequisites

- Any EVM wallet (MetaMask recommended, or use WalletConnect for mobile)
- 0G testnet tokens — get from [faucet.0g.ai](https://faucet.0g.ai) (0.1 0G/day)
- Backend running (for uploads) — see Option B below

**Add Galileo to MetaMask manually if needed:**
```
Network Name: 0G-Galileo-Testnet
RPC URL:      https://evmrpc-testnet.0g.ai
Chain ID:     16602
Symbol:       0G
Explorer:     https://chainscan-galileo.0g.ai
```

---

## Option A — Live Demo (Recommended)

> URL: `https://heda.vercel.app` *(or URL provided by team)*

The backend is hosted — no local setup needed. Skip to **Step 1**.

---

## Option B — Run Locally

```bash
# Terminal 1: Backend upload server
cd heda/backend
cp .env.example .env        # add PRIVATE_KEY (funded wallet)
npm install && npm run dev  # runs on :3001

# Terminal 2: Frontend
cd heda/frontend
cp .env.example .env        # set VITE_UPLOAD_API=http://localhost:3001
npm install && npm run dev  # runs on :5173
```

---

## Step 1 — Connect Wallet

1. Click **Connect Wallet** (top right)
2. Choose MetaMask, WalletConnect, or Coinbase Wallet
3. If on wrong network → click **Switch to Galileo** warning button
4. Your 0G balance appears next to your address in the header

---

## Step 2 — Browse Jobs

The **Jobs** page defaults to open jobs only. Closed/completed jobs are hidden.

- Filter by **Image** or **Text** using the filter bar
- Each card shows: job name, data type, reward per task, progress bar, creator address
- Click **Accept Work** → automatically finds the first unclaimed task

> **Multi-annotator feature:** Tasks are claimed for 30 minutes. If someone else is working on task 3, you'll be routed to task 4 automatically.

---

## Step 3A — Annotate an Image Job

1. **Floating toolbar** (top center of canvas):
   - `⬜` Box tool — click and drag to draw bounding box
   - `⬡` Polygon tool — click to add points, "Close" to finish
   - Label dropdown — select active label
   - `🔍+/-` — zoom in/out

2. **Right sidebar** — lists all drawn annotations:
   - Click annotation to select it
   - Drag resize handles to adjust width/height
   - Click label name to change it
   - Click delete icon to remove

3. **Left sidebar** — task overview:
   - See all tasks with ✓ done / ○ pending
   - Click any task to jump to it
   - Labels legend with color coding
   - **Review & Submit** button

4. Click **Save & Next** after each task (no wallet popup)

5. When ready → **Review & Submit** → preview modal shows all tasks → **Submit N Tasks** → **1 MetaMask signature** for everything

---

## Step 3B — Annotate a Text Job

1. Read the text displayed
2. Click the correct classification label (positive / negative / neutral, etc.)
3. Click **Save & Next**
4. Repeat for all tasks
5. **Review & Submit** → 1 signature

---

## Step 4 — Create Your Own Job

### Image Job
1. Go to **Create Job** → Select **Images**
2. Upload PNG/JPG files from `sample-data/` (or your own)
3. Step 2: Add instructions + bounding box classes (e.g. `car, truck, person`)
4. Set reward per task (e.g. `0.001 0G`)
5. Step 3: Review → **Post Job** → MetaMask signs

### Text Job
1. Go to **Create Job** → Select **Text**
2. Choose **JSONL Schema**:
   - **Chat Messages** — for classification (recommended, use with `sample-data/text-sentiment/`)
   - **Instruction** — for Q&A tasks (use with `sample-data/text-instruction/`)
   - **Text Completion** — for generative tasks (use with `sample-data/text-completion/`)
3. Upload `.txt` files
4. Step 2: Add instructions + classification labels
5. Post job

> **Sample data available** in `heda/sample-data/` — ready-to-use files for all three text schemas.

---

## Step 5 — Approve Annotations (Dashboard)

1. Go to **Dashboard**
2. Left panel: your jobs with progress bars
3. Click a job → right panel shows all submissions
4. Each row: task #, annotator address, annotation root hash (links to 0G Storage)
5. Click **✓** to approve → annotator paid instantly onchain
6. Click **✗** to reject → task reopens for another annotator
7. When all tasks approved → job auto-closes → **Publish Dataset** button appears

---

## Step 6 — Publish Dataset

1. Click **Publish Dataset**
2. Fill in:
   - **Name** — dataset name
   - **Labels** — comma-separated (used for COCO categories / JSONL schema)
   - **Price** — in 0G (0 = free)
3. Click **Publish** — button shows progress: "Building COCO dataset…" → "Uploading…" → "Publishing onchain…"

**What gets built:**
- **Image jobs** → COCO JSON (`{"images": [...], "annotations": [...], "categories": [...]}`)
- **Text jobs** → JSONL in selected schema (`{"messages": [...]}` or `{"instruction": ...}` or `{"text": ...}`)

Both are uploaded to 0G Storage. The root hash is stored in `DatasetRegistry` onchain.

---

## Step 7 — Purchase & Download Dataset

1. Go to **Datasets** marketplace
2. Datasets show real names, format badge (COCO JSON / JSONL), task count
3. Click **Details** → dataset detail page
4. Click **Buy for X 0G** (or **Get Free**) → MetaMask signs
5. **Licensed ✓** badge appears
6. Click **Download Dataset** → downloads `heda-dataset-{id}.zip`

**ZIP contents:**
- **Image datasets**: `images/` (original files) + `annotations/instances.json` (COCO) + `README.txt`
- **Text datasets**: `dataset.jsonl` + `README.txt`

The COCO JSON works directly with PyTorch, YOLOv8, Detectron2. The JSONL works directly with 0G Compute fine-tuning.

---

## Step 8 — Fine-Tune on 0G Compute (Text Datasets)

1. Go to **Fine-Tune**
2. Only **text datasets you own a license for** appear
3. Select dataset + base model:
   - `Qwen2.5-0.5B-Instruct` — fast, cheap ($0.5/M tokens)
   - `Qwen3-32B` — powerful ($4/M tokens)
4. Enter 0G Compute API key (get from [pc.0g.ai](https://pc.0g.ai) — deposit 0G tokens first)
5. Click **Start Fine-Tuning**
6. Status updates every 5 seconds: Pending → Running → Succeeded

> **Image datasets:** Fine-tuning not yet available on 0G Compute for vision models. Download the ZIP and train locally with YOLOv8/PyTorch.

---

## Step 9 — My Work (Earnings)

Go to **My Work** to see:
- Total 0G earned from approved annotations
- All submitted tasks with status (Approved / Pending)
- Transaction links for each submission

---

## Verify Everything Onchain

| What | Where |
|---|---|
| All jobs | https://chainscan-galileo.0g.ai/address/0x4822c5F0617665543B94a0668837CdbBDEb54C90 |
| All datasets | https://chainscan-galileo.0g.ai/address/0x46d4a89e496f3A01785ac5B38ecAc40B081c933c |
| Storage files | https://storagescan-galileo.0g.ai |

---

## What's Stored Where

| Data | Storage | Identifier |
|---|---|---|
| Raw images/text | 0G Storage | `job.dataRootHash` |
| Job metadata (instructions, labels, schema) | 0G Storage | `job.metadataURI` |
| Annotation results (per task) | 0G Storage | `submission.annotationRootHash` |
| COCO JSON / JSONL dataset | 0G Storage | `dataset.rootHash` in DatasetRegistry |
| Dataset metadata | 0G Storage | `dataset.metadataURI` |
| Job bounties | AnnotationMarket contract | `getJob(jobId).rewardPerTask` |
| Dataset licenses | DatasetRegistry contract | `hasLicense(datasetId, address)` |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Upload hangs >60s | Backend timeout — retry. Check backend logs. |
| "All tasks claimed" | 30-min reservation active — try another job or wait |
| Job not appearing after create | Click Refresh on Jobs page |
| Download gives empty ZIP | Storage node may be slow — wait 30s and retry |
| Fine-tune fails | Check API key is valid and has balance at pc.0g.ai |
| Wrong network warning | Click the red "Switch to Galileo" button in header |

---

## Contract Addresses

```
AnnotationMarket: 0x4822c5F0617665543B94a0668837CdbBDEb54C90
DatasetRegistry:  0x46d4a89e496f3A01785ac5B38ecAc40B081c933c
Network:          0G Galileo Testnet (Chain ID 16602)
```
