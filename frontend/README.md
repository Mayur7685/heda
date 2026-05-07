# Heda Frontend

React + Vite + TypeScript frontend for the Heda annotation marketplace.

## Stack

- **React 19** + **Vite 8** + **TypeScript**
- **ethers v6** — wallet + contract interaction
- **react-konva** — annotation canvas (bounding boxes, polygons)
- **react-router-dom v7** — routing
- **Tailwind CSS v4** + custom Precision Core design system

## Setup

```bash
npm install
cp .env.example .env
# Fill in contract addresses and backend URL
npm run dev
```

## Environment Variables

```bash
# Contract addresses (Galileo testnet)
VITE_ANNOTATION_MARKET=0x4822c5F0617665543B94a0668837CdbBDEb54C90
VITE_DATASET_REGISTRY=0x46d4a89e496f3A01785ac5B38ecAc40B081c933c

# Backend upload server
VITE_UPLOAD_API=http://localhost:3001  # local
# VITE_UPLOAD_API=https://your-backend.railway.app  # production

# 0G Compute API key (from https://pc.0g.ai)
VITE_COMPUTE_API_KEY=sk-
```

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Jobs | Browse open annotation jobs |
| `/jobs/:jobId/:taskId` | Workspace | Annotation canvas |
| `/create` | CreateJob | 3-step wizard to post a job |
| `/datasets` | Datasets | Dataset marketplace |
| `/datasets/:id` | DatasetDetail | Dataset details + download |
| `/dashboard` | Dashboard | Creator: approve/reject/publish |
| `/submissions` | Submissions | Annotator earnings history |
| `/finetune` | FineTune | Fine-tune LLMs on 0G Compute |

## Key Architecture Decisions

- **WalletProvider context** — single wallet state shared across all pages (no duplicate connect buttons)
- **Backend for uploads** — 0G Storage SDK requires legacy transactions; MetaMask sends EIP-1559. Backend uses a server wallet to bypass this.
- **Batch submit** — `submitBatch()` sends all annotations in one tx (one MetaMask signature)
- **Task claiming** — `claimTask()` reserves tasks for 30 min to prevent wasted work

## Build

```bash
npm run build   # outputs to dist/
```

## Deploy to Vercel

```bash
vercel --prod
# Set env vars in Vercel dashboard
```
