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
| **0G Storage** | Raw data uploads, annotation results, COCO/JSONL dataset packages |
| **0G Compute** | LLM fine-tuning on annotated text datasets (Qwen2.5, Qwen3) |

---

## Architecture

```
Creator uploads data → 0G Storage (root hash)
Creator posts job → AnnotationMarket.sol (bounty locked onchain)
Annotator claims task → claimTask() (30-min reservation)
Annotator annotates → Workspace UI (bbox/polygon/classification)
Annotator submits batch → submitBatch() (1 signature for all tasks)
Creator approves → approveWork() (instant ETH payment to annotator)
Creator publishes → COCO JSON (images) or JSONL (text) → 0G Storage
Developer purchases → DatasetRegistry.sol (royalty to creator)
Developer fine-tunes → 0G Compute Router API
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
├── contracts/          # Foundry — AnnotationMarket.sol + DatasetRegistry.sol
├── frontend/           # React + Vite + ethers v6
├── backend/            # Node.js upload server (0G Storage)
├── scripts/            # Demo seed script
└── phala-integration.md # Future GPU pipeline plan
```

---

## Quick Start

See [TESTING_GUIDE.md](TESTING_GUIDE.md) for the full judge walkthrough.

```bash
# 1. Clone
git clone <repo> && cd heda

# 2. Start backend
cd backend && cp .env.example .env  # add PRIVATE_KEY
npm install && npm run dev

# 3. Start frontend
cd ../frontend && cp .env.example .env  # add VITE_UPLOAD_API=http://localhost:3001
npm install && npm run dev

# 4. Open http://localhost:5173
```

---

## Key Features

- **Batch submit** — annotate all tasks, sign once (1 MetaMask popup for N tasks)
- **Task claiming** — 30-min reservation prevents wasted work when multiple annotators compete
- **Auto-close** — jobs automatically close when all tasks are approved
- **COCO JSON export** — image datasets export as standard COCO format (works with PyTorch, YOLOv8, Detectron2)
- **JSONL export** — text datasets export as 0G Compute-compatible JSONL (chat/instruction/completion schemas)
- **Verifiable provenance** — every dataset has an onchain root hash linking annotations to source data

---

## Networks

| | Value |
|---|---|
| Network | 0G Galileo Testnet |
| Chain ID | 16602 |
| RPC | https://evmrpc-testnet.0g.ai |
| Explorer | https://chainscan-galileo.0g.ai |
| Storage Indexer | https://indexer-storage-testnet-turbo.0g.ai |
| Faucet | https://faucet.0g.ai |

---

## Links

- [0G Documentation](https://docs.0g.ai)
- [Phala GPU Pipeline Plan](phala-integration.md)
- [Testing Guide for Judges](TESTING_GUIDE.md)
