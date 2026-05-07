# Heda — Judge Testing Guide

> **5-minute demo path** — follow this to see the full end-to-end flow.

---

## Prerequisites

- MetaMask installed
- 0G Galileo testnet added to MetaMask (Chain ID: 16602)
- Some 0G testnet tokens ([faucet.0g.ai](https://faucet.0g.ai) — 0.1 0G/day)

**Add Galileo to MetaMask:**
```
Network Name: 0G-Galileo-Testnet
RPC URL: https://evmrpc-testnet.0g.ai
Chain ID: 16602
Symbol: 0G
Explorer: https://chainscan-galileo.0g.ai
```

---

## Option A — Use the Live Demo (Recommended)

> Frontend: `https://heda.vercel.app` (or the URL provided)

Skip to **Step 2** below.

---

## Option B — Run Locally

```bash
# Terminal 1: Backend
cd heda/backend
cp .env.example .env
# Add PRIVATE_KEY (any funded wallet)
npm install && npm run dev

# Terminal 2: Frontend
cd heda/frontend
cp .env.example .env
# Set VITE_UPLOAD_API=http://localhost:3001
npm install && npm run dev

# Open http://localhost:5173
```

---

## Step 1 — Connect Wallet

1. Open the app
2. Click **Connect Wallet** (top right)
3. Approve MetaMask connection
4. If prompted, switch to Galileo Testnet (Chain ID 16602)
5. Your 0G balance appears in the header

---

## Step 2 — Browse Existing Jobs

The Jobs page shows open annotation jobs. A demo job with sample images should already be visible.

- Filter by **Image** or **Text**
- Click **Accept Work** on any open job

---

## Step 3 — Annotate (Image Job)

1. The annotation workspace opens
2. **Draw bounding boxes**: click and drag on the image
3. **Select label**: use the label selector in the floating toolbar
4. **Resize boxes**: click a box to select it, drag the handles
5. **Navigate tasks**: use Prev/Next at the bottom, or click tasks in the left sidebar
6. After annotating all tasks, click **Review & Submit** (left sidebar)
7. Preview shows which tasks are done/pending
8. Click **Submit N Tasks** → one MetaMask signature for all tasks

---

## Step 4 — Create Your Own Job (Optional)

1. Go to **Create Job**
2. **Step 1**: Choose Image or Text, upload files
   - For text: choose JSONL schema (Chat / Instruction / Completion)
3. **Step 2**: Add instructions, labels, set reward per task
4. **Step 3**: Review → click **Post Job** → MetaMask signs the tx
5. Job appears on the Jobs page

---

## Step 5 — Approve Annotations (Dashboard)

1. Go to **Dashboard**
2. Select your job from the left panel
3. See submitted annotations with their 0G Storage root hashes
4. Click ✓ to approve (annotator gets paid instantly) or ✗ to reject
5. When all tasks approved → **Publish Dataset** button appears

---

## Step 6 — Publish Dataset

1. Click **Publish Dataset**
2. Enter name, labels (comma-separated), price
3. Click **Publish**
4. For **image jobs**: COCO JSON is built and uploaded to 0G Storage
5. For **text jobs**: JSONL is built in the selected schema and uploaded
6. Dataset appears in the marketplace

---

## Step 7 — Purchase Dataset

1. Go to **Datasets**
2. Find your published dataset
3. Click **Buy** (or **Get Free** if price = 0)
4. MetaMask signs the purchase tx
5. **Licensed ✓** badge appears
6. Click **Details** → **Download Dataset** to get the COCO/JSONL file

---

## Step 8 — Fine-Tune (Text Datasets Only)

1. Go to **Fine-Tune**
2. Only text datasets you own a license for appear
3. Select dataset + base model (Qwen2.5-0.5B-Instruct or Qwen3-32B)
4. Enter your 0G Compute API key (from [pc.0g.ai](https://pc.0g.ai))
5. Click **Start Fine-Tuning**
6. Status polls every 5 seconds

> **Note:** Vision model fine-tuning is not yet available on 0G Compute. Image datasets can be downloaded as COCO JSON for local training.

---

## Verify Onchain

Every action produces a transaction. Check them on Chainscan:

- **Jobs**: https://chainscan-galileo.0g.ai/address/0x4822c5F0617665543B94a0668837CdbBDEb54C90
- **Datasets**: https://chainscan-galileo.0g.ai/address/0x46d4a89e496f3A01785ac5B38ecAc40B081c933c

---

## What's Stored Where

| Data | Location | How to verify |
|---|---|---|
| Raw images/text | 0G Storage | Root hash in job's `dataRootHash` |
| Annotation results | 0G Storage | Root hash in `WorkSubmitted` event |
| COCO/JSONL dataset | 0G Storage | Root hash in `DatasetRegistry` |
| Job bounties | AnnotationMarket contract | `getJob(jobId).rewardPerTask` |
| Dataset licenses | DatasetRegistry contract | `hasLicense(datasetId, address)` |

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "Connect your wallet" message after connecting | Refresh the page — wallet context should sync |
| Upload hangs | Backend may be slow — wait up to 60s, then retry |
| "All tasks claimed" | Tasks have 30-min reservations — try another job or wait |
| MetaMask shows wrong network | Click the warning banner to switch to Galileo |
| No jobs visible | Click Refresh button on Jobs page |

---

## Contract Addresses

```
AnnotationMarket: 0x4822c5F0617665543B94a0668837CdbBDEb54C90
DatasetRegistry:  0x46d4a89e496f3A01785ac5B38ecAc40B081c933c
Network:          0G Galileo Testnet (Chain ID 16602)
```
