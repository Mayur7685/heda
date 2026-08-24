# Heda Backend — Upload Server

Minimal Node.js server that handles 0G Storage uploads on behalf of the frontend.

## Why a backend?

The 0G Storage SDK requires a server-side wallet to pay storage fees (gas). MetaMask's EIP-1559 transaction format is incompatible with the SDK's legacy transaction requirements on Galileo testnet. The backend uses a funded server wallet to submit storage transactions.

## Setup

```bash
npm install
cp .env.example .env
# Add your PRIVATE_KEY (funded with 0G tokens for storage fees)
npm run dev
```

## Environment

```bash
# backend/.env
PRIVATE_KEY=0x...   # funded wallet — pays 0G storage fees (~0.00003 0G per upload)
PORT=3001           # optional, defaults to 3001
```

## API

### `POST /upload`

Uploads data to 0G Storage and returns the Merkle root hash.

**Request:**
```json
{ "data": "<base64-encoded bytes>" }
```

**Response:**
```json
{ "rootHash": "0x8f0519..." }
```

**Error:**
```json
{ "error": "Upload failed: ..." }
```

### `GET /health`

Returns `{ "ok": true }` — used by Railway for health checks.

## Deployment (Railway)

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway up

# Set environment variable in Railway dashboard:
# PRIVATE_KEY = 0x...
```

The `railway.json` and `Dockerfile` are already configured.

## Notes

- Uploads use `finalityRequired: false` — returns immediately after tx submission, doesn't wait for storage node sync
- 60-second timeout via `Promise.race` — never hangs forever
- Gas price is fetched dynamically and bumped 20% to avoid replacement errors
- Sequential uploads (not parallel) to avoid nonce conflicts
