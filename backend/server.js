import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import 'dotenv/config';
import os from 'os';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const GALILEO_RPC = 'https://evmrpc-testnet.0g.ai';
const STORAGE_INDEXER = 'https://indexer-storage-testnet-turbo.0g.ai';
const UPLOAD_TIMEOUT_MS = 60_000;

// Serial queue — same wallet, nonce must increment one at a time.
// Parallel uploads cause "replacement transaction underpriced" errors.
let uploadQueue = Promise.resolve();

async function doUpload(data) {
  let tempPath = null;
  try {
    const provider = new ethers.JsonRpcProvider(GALILEO_RPC);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Bump gas 20% to avoid replacement errors on retry
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice
      ? (feeData.gasPrice * 120n) / 100n
      : BigInt(10_000_000_000);

    const { ZgFile, Indexer } = await import('@0gfoundation/0g-ts-sdk');
    const indexer = new Indexer(STORAGE_INDEXER);

    tempPath = path.join(os.tmpdir(), `heda-${Date.now()}`);
    fs.writeFileSync(tempPath, Buffer.from(data, 'base64'));

    const file = await ZgFile.fromFilePath(tempPath);
    try {
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

      const rootHash = tree.rootHash();
      if (!rootHash) throw new Error('Root hash is null');

      const uploadPromise = indexer.upload(file, GALILEO_RPC, signer,
        { finalityRequired: false }, undefined, { gasPrice });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Upload timeout after 60s')), UPLOAD_TIMEOUT_MS));

      const [, uploadErr] = await Promise.race([uploadPromise, timeoutPromise]);
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message ?? uploadErr}`);

      console.log('Upload OK:', rootHash);
      return { rootHash };
    } finally {
      await file.close();
    }
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

// POST /upload
app.post('/upload', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Missing data field' });

  // Enqueue — each upload waits for the previous to finish
  uploadQueue = uploadQueue
    .then(() => doUpload(data))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Upload error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Heda upload server on :${PORT}`));
