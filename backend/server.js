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
const UPLOAD_TIMEOUT_MS = 60_000; // 60s max — never hang forever

async function uploadWithTimeout(file, signer, gasPrice) {
  const { Indexer } = await import('@0gfoundation/0g-ts-sdk');
  const indexer = new Indexer(STORAGE_INDEXER);

  const uploadPromise = indexer.upload(
    file, GALILEO_RPC, signer,
    { finalityRequired: false },  // return after tx submitted, don't wait for node sync
    undefined,
    { gasPrice }
  );

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Upload timeout after 60s')), UPLOAD_TIMEOUT_MS)
  );

  return Promise.race([uploadPromise, timeoutPromise]);
}

// POST /upload — accepts base64 data, returns root hash
app.post('/upload', async (req, res) => {
  let tempPath = null;
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Missing data field' });

    const provider = new ethers.JsonRpcProvider(GALILEO_RPC);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Bump gas 20% above current to avoid replacement errors
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice
      ? (feeData.gasPrice * 120n) / 100n
      : BigInt(10_000_000_000);

    const { ZgFile } = await import('@0gfoundation/0g-ts-sdk');
    tempPath = path.join(os.tmpdir(), `heda-${Date.now()}`);
    fs.writeFileSync(tempPath, Buffer.from(data, 'base64'));

    const file = await ZgFile.fromFilePath(tempPath);
    try {
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

      const rootHash = tree.rootHash();
      if (!rootHash) throw new Error('Root hash is null');

      const result = await uploadWithTimeout(file, signer, gasPrice);
      const [tx, uploadErr] = result;
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message ?? uploadErr}`);

      console.log('Upload OK:', rootHash);
      res.json({ rootHash });
    } finally {
      await file.close();
    }
  } catch (error) {
    console.error('Upload error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
});

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Heda upload server on :${PORT}`));
