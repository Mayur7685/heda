# ⚡ Heda Protocol — Relayer, Event Indexer & Annotation Indexer

Node.js Express microservice with two SQLite WAL indexers:
1. **Event Indexer** — listens to V1 contract events (`JobCreated`, `Published`, `ModelPublished`).
2. **Annotation Indexer** — listens to V2 multi-annotator events, scores IoU quality, and auto-calls `distributeRewards()`.

---

## 🌟 REST API Endpoints

### Event Indexer (V1 Contracts)
- **`GET /indexer/status`**: Returns current syncing state, last indexed block number, and total counts.
- **`GET /indexer/jobs`**: Returns all indexed annotation jobs from `AnnotationMarket.sol`.
- **`GET /indexer/datasets`**: Returns all indexed datasets from `DatasetRegistry.sol`.
- **`GET /indexer/models`**: Returns all indexed AI model weights from `ModelRegistry.sol`.

### Annotation Indexer (V2 Multi-Annotator)
- **`GET /annotations/task/:jobId/:taskId`**: All submissions + IoU scores + reward shares for a task.
- **`GET /annotations/job/:jobId/status`**: Per-task breakdown (pending / evaluated / rewarded counts).
- **`GET /annotations/annotator/:address`**: Full submission history + quality stats for a wallet.
- **`GET /annotations/leaderboard`**: Top 20 annotators ranked by average IoU score.
- **`POST /annotations/evaluate`** `{ jobId, taskId }`: Manual creator override to trigger evaluation.

### Storage Relay
- **`POST /upload`**: Relays base64 data payloads to 0G Storage nodes and returns the Merkle root hash.
- **`GET /file?root=<hash>`**: Proxies file retrieval from 0G Storage indexer.

---

## 🔄 Annotation IoU Pipeline (Auto Flow)

```
WorkSubmitted event detected
         │
         ▼
  Check if task slots full
  or EvaluationTriggered fired
         │
         ▼
  Fetch image from 0G Storage
         │
         ▼
  POST /annotation/score (AI service)
  Moondream detects ground truth boxes
  compute_iou() scores each submission
         │
         ▼
  computeSharesBps() → proportional
  reward shares (sum exactly 10000 BPS)
         │
         ▼
  distributeRewards() on-chain
  ETH sent proportionally to annotators
```

**IoU Thresholds:**
- `MIN_IOU = 0.30` — submissions below this get 0 BPS (no reward).
- Submissions above threshold share rewards proportionally to their IoU score.

---

## 🚀 Running the Relayer & Indexers

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env
# Edit .env: set PRIVATE_KEY (relayer signer wallet)

# 3. Run all services (relayer + both indexers)
npm start
# Server listening on http://localhost:3001
```

**Environment Variables (`.env`):**
```
PRIVATE_KEY=0x...          # Relayer signer private key (matches RELAYER_SIGNER in contract)
GALILEO_RPC=https://evmrpc-testnet.0g.ai
PORT=3001
```

---

## 🗄️ SQLite Database Schema

All data is stored in `indexer.db` (WAL mode, shared between both indexers):

```sql
-- V2 Annotation Submissions
CREATE TABLE annotation_submissions (
  job_id INTEGER, task_id INTEGER, annotator TEXT,
  annotation_root_hash TEXT, slot_index INTEGER,
  iou_score REAL, reward_share_bps INTEGER,
  status TEXT DEFAULT 'pending',  -- pending | evaluated | rewarded
  submitted_at INTEGER, evaluated_at INTEGER
);

-- Annotator Quality Statistics
CREATE TABLE annotator_stats (
  address TEXT PRIMARY KEY,
  total_submissions INTEGER DEFAULT 0,
  total_rewarded INTEGER DEFAULT 0,
  avg_iou_score REAL DEFAULT 0,
  total_earned_wei TEXT DEFAULT '0'
);
```
