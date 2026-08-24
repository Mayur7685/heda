# Heda — Decentralized Annotation Marketplace

> **Label Studio, but onchain.** Annotate datasets, earn crypto, fine-tune AI models — all on the 0G stack.

[![Built on 0G](https://img.shields.io/badge/Built%20on-0G%20Stack-00e479)](https://0g.ai)
[![Network](https://img.shields.io/badge/Network-Galileo%20Testnet-00e479)](https://chainscan-galileo.0g.ai)

---

## What is Heda?

Heda is a decentralized data annotation marketplace where:

- **Job Creators** upload raw data (images or text), post annotation jobs with ETH bounties
- **Annotators** pick up jobs, label data, and get paid instantly onchain per approved task
- **Developers** purchase verified datasets and fine-tune LLMs on 0G Compute

Every piece of data lives on **0G Storage** (permanent, verifiable). Every payment is settled on **0G Chain** (trustless, instant). Every fine-tune runs on **0G Compute** (decentralized GPU).

---

## 0G Stack Usage

| Layer | What Heda uses it for |
|---|---|
| **0G Chain** (EVM, Chain ID 16602) | Job escrow, per-task payments, dataset registry, license purchases |
| **0G Storage** | Raw data uploads, annotation results, COCO JSON + JSONL dataset packages |
| **0G Compute** | LLM fine-tuning on annotated text datasets (Qwen2.5-0.5B, Qwen3-32B) |

---

## Architecture

![workflow](/frontend/public/image.png)

```
Creator uploads data → 0G Storage (root hash)
Creator posts job → AnnotationMarket.sol (bounty locked onchain)
Annotator claims task → claimTask() (30-min reservation, prevents wasted work)
Annotator annotates → Workspace UI (bbox/polygon for images, classification for text)
Annotator submits batch → submitBatch() (1 MetaMask signature for all tasks)
Creator approves → approveWork() (instant ETH payment, auto-closes when complete)
Creator publishes → COCO JSON (images) or JSONL (text) → 0G Storage
Developer purchases → DatasetRegistry.sol (royalty to creator)
Developer downloads → ZIP with images + annotations (image) or JSONL (text)
Developer fine-tunes → 0G Compute Router API (text datasets only)
```

---

## Deployed Contracts (Galileo Testnet)

| Contract | Address | Explorer |
|---|---|---|
| AnnotationMarket | `0x4822c5F0617665543B94a0668837CdbBDEb54C90` | [View](https://chainscan-galileo.0g.ai/address/0x4822c5F0617665543B94a0668837CdbBDEb54C90) |
| DatasetRegistry | `0x46d4a89e496f3A01785ac5B38ecAc40B081c933c` | [View](https://chainscan-galileo.0g.ai/address/0x46d4a89e496f3A01785ac5B38ecAc40B081c933c) |

---

## Repository Structure

```
heda/
├── contracts/           # Foundry — AnnotationMarket.sol + DatasetRegistry.sol
├── frontend/            # React + Vite + ethers v6 + RainbowKit
├── backend/             # Node.js upload server (0G Storage)
├── scripts/             # Demo seed script
├── sample-data/         # Ready-to-use test files for all flows
│   ├── text-sentiment/  # 10 product reviews → positive/negative/neutral
│   ├── text-instruction/# 8 Q&A prompts → instruction schema
│   └── text-completion/ # 5 story prompts → completion schema
└── phala-integration.md # Future GPU pipeline plan (vision model fine-tuning)
```

---

## Quick Start

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for the full judge walkthrough.

```bash
# 1. Clone
git clone <repo> && cd heda

# 2. Start backend (handles 0G Storage uploads)
cd backend && cp .env.example .env  # add PRIVATE_KEY
npm install && npm run dev

# 3. Start frontend
cd ../frontend && cp .env.example .env
# Set: VITE_UPLOAD_API=http://localhost:3001
# Set: VITE_WALLETCONNECT_PROJECT_ID=<from cloud.walletconnect.com>
npm install && npm run dev

# 4. Open http://localhost:5173
```

---

## Key Features

### Annotation
- **Image annotation** — bounding boxes (draw, drag, resize with handles), polygons
- **Text annotation** — single-label classification with configurable labels
- **Batch submit** — annotate all tasks, sign once (1 MetaMask popup for N tasks)
- **Task claiming** — 30-min reservation prevents multiple annotators wasting work on same task
- **Draft saving** — annotations saved to localStorage, restored on page reload
- **Preview before submit** — review all tasks (done/pending) before signing

### Jobs
- **Auto-close** — jobs automatically close when all tasks are approved
- **Multi-annotator support** — each task claimed independently, parallel work on different tasks
- **Instant payment** — annotator receives ETH immediately on approval

### Datasets
- **COCO JSON export** — image datasets: standard COCO format with `images`, `annotations`, `categories`
- **JSONL export** — text datasets: 3 schemas supported (Chat Messages, Instruction, Text Completion)
- **ZIP download** — image datasets download as ZIP with `images/` folder + `annotations/instances.json`
- **Onchain provenance** — every dataset root hash links to source data and annotations on 0G Storage
- **Royalties** — purchase price goes directly to publisher (no platform cut)

### Fine-Tuning (Text only)
- **0G Compute integration** — fetches JSONL from 0G Storage, uploads to 0G Compute, polls status
- **Supported models** — Qwen2.5-0.5B-Instruct ($0.5/M tokens), Qwen3-32B ($4/M tokens)
- **Schema-aware** — JSONL output matches selected schema (chat/instruction/completion)

### Wallet
- **RainbowKit** — MetaMask, WalletConnect, Coinbase Wallet, any injected wallet
- **Custom UI** — styled to match Precision Core design system

---

## Supported Data Formats

| Input | Annotation type | Output format |
|---|---|---|
| Images (PNG/JPG/WEBP) | Bounding boxes, polygons | COCO JSON + ZIP |
| Text files (TXT/JSONL) | Classification | JSONL (chat/instruction/completion) |

---

## Networks

| | Value |
|---|---|
| Network | 0G Galileo Testnet |
| Chain ID | 16602 |
| RPC | https://evmrpc-testnet.0g.ai |
| Explorer | https://chainscan-galileo.0g.ai |
| Storage Indexer | https://indexer-storage-testnet-turbo.0g.ai |
| Faucet | https://faucet.0g.ai (0.1 0G/day) |

---

## Future: Vision Model Fine-Tuning (Phala)

Image dataset fine-tuning (YOLOv8, CLIP) is planned via **Phala Cloud GPU TEE** — see [phala-integration.md](phala-integration.md). When 0G Compute adds vision model support, the pipeline will migrate to 0G.

---

## Links

- [0G Documentation](https://docs.0g.ai)
- [Testing Guide for Judges](TESTING_GUIDE.md)
- [Phala GPU Pipeline Plan](phala-integration.md)
- [Sample Data](sample-data/README.md)
