import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();
import fs from 'fs';
import Database from 'better-sqlite3';
import multer from 'multer';
import { startIndexer, getIndexedJobs, getIndexedDatasets, getIndexedModels, getIndexerStatus } from './indexer.js';
import {
  startAnnotationIndexer,
  getTaskAnnotations,
  getTaskGroundTruth,
  getJobAnnotationStatus,
  getAnnotatorStats,
  getLeaderboard,
  triggerTaskEvaluation,
} from './annotation-indexer.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ type: ['image/*', 'application/octet-stream'], limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const GALILEO_RPC     = process.env.GALILEO_RPC     || 'https://evmrpc-testnet.0g.ai';
const STORAGE_INDEXER = process.env.STORAGE_INDEXER || 'https://indexer-storage-testnet-turbo.0g.ai';
const UPLOAD_TIMEOUT_MS = 60_000;

// Shared SQLite database (unified for indexers + hardware ingestion)
const dbPath = path.join(process.cwd(), 'indexer.db');
const db     = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize hardware tables
db.exec(`
  CREATE TABLE IF NOT EXISTS device_frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    root_hash TEXT NOT NULL,
    tx_seq TEXT,
    size_bytes INTEGER,
    timestamp INTEGER NOT NULL,
    bounty_job_id INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS device_models (
    device_id TEXT PRIMARY KEY,
    model_id INTEGER NOT NULL,
    weights_root_hash TEXT NOT NULL,
    model_name TEXT,
    assigned_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_device_id ON device_frames(device_id);
`);

// Serial queue — same wallet, nonce must increment one at a time.
let uploadQueue = Promise.resolve();

export async function doUpload(data) {
  let tempPath = null;
  try {
    const provider = new ethers.JsonRpcProvider(GALILEO_RPC);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

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

      console.log('[Relayer] Upload OK:', rootHash);
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

  uploadQueue = uploadQueue
    .then(() => doUpload(data))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('[Relayer] Upload error:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// GET /file?root=... (0G Storage file proxy)
app.get('/file', async (req, res) => {
  const root = req.query.root;
  if (!root) return res.status(400).json({ error: 'Missing root query param' });
  const normHash = root.startsWith('0x') ? root : `0x${root}`;
  const rawHash  = root.replace(/^0x/, '');

  const endpoints = [
    `${STORAGE_INDEXER}/file?root=${normHash}`,
    `${STORAGE_INDEXER}/file?root=${rawHash}`,
    `https://indexer-storage-testnet-standard.0g.ai/file?root=${normHash}`,
    `https://indexer-storage-testnet-standard.0g.ai/file?root=${rawHash}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const resp = await fetch(endpoint);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrayBuf);

        // Check if JPEG (starts with 0xFF 0xD8) or PNG (0x89 0x50)
        if (buf.length >= 2 && buf[0] === 0xFF && buf[1] === 0xD8) {
          res.set('Content-Type', 'image/jpeg');
          return res.send(buf);
        } else if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
          res.set('Content-Type', 'image/png');
          return res.send(buf);
        } else {
          const str = buf.toString('utf-8');
          try {
            const parsed = JSON.parse(str);
            if (parsed && typeof parsed === 'object' && (parsed.code === 101 || parsed.message === 'File not found' || parsed.error === 'File not found')) {
              continue; // try next endpoint
            }
          } catch {}
          return res.send(str);
        }
      }
    } catch {}
  }
  res.status(404).json({ error: 'File not found on 0G Storage' });
});

// ── Lightweight Event Indexer (V1 contracts) ──────────────────────────────────
app.get('/indexer/jobs',     (_, res) => res.json(getIndexedJobs()));
app.get('/indexer/datasets', (_, res) => res.json(getIndexedDatasets()));
app.get('/indexer/models',   (_, res) => res.json(getIndexedModels()));
app.get('/indexer/status',   (_, res) => res.json(getIndexerStatus()));

// ── Annotation V2 API Routes ──────────────────────────────────────────────────

// GET /annotations/task/:jobId/:taskId
// All submissions + IoU scores + reward shares for a specific task.
app.get('/annotations/task/:jobId/:taskId', (req, res) => {
  try {
    const { jobId, taskId } = req.params;
    const submissions = getTaskAnnotations(db, Number(jobId), Number(taskId));
    const submissionCount = submissions.length;
    res.json({ jobId: Number(jobId), taskId: Number(taskId), submissionCount, submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /annotations/ground-truth/:jobId/:taskId
// Cached Moondream / Consensus ground-truth bounding boxes for a task.
app.get('/annotations/ground-truth/:jobId/:taskId', (req, res) => {
  try {
    const gt = getTaskGroundTruth(db, req.params.jobId, req.params.taskId);
    res.json(gt || { jobId: Number(req.params.jobId), taskId: Number(req.params.taskId), groundTruth: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /annotations/job/:jobId/status
// Per-task breakdown (pending / evaluated / rewarded counts) for a job.
app.get('/annotations/job/:jobId/status', (req, res) => {
  try {
    const tasks = getJobAnnotationStatus(db, Number(req.params.jobId));
    res.json({ jobId: Number(req.params.jobId), tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /annotations/evaluate
// Direct evaluation trigger from creator dashboard
app.post('/annotations/evaluate', (req, res) => {
  try {
    const { jobId, taskId } = req.body;
    if (jobId === undefined || taskId === undefined) {
      return res.status(400).json({ error: 'jobId and taskId required' });
    }
    triggerTaskEvaluation(Number(jobId), Number(taskId));
    res.json({ ok: true, message: `Evaluation triggered for job ${jobId} task ${taskId}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /annotations/annotator/:address
// Full submission history + quality stats for a wallet address.
app.get('/annotations/annotator/:address', (req, res) => {
  try {
    const data = getAnnotatorStats(db, req.params.address);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /annotations/leaderboard
// Top 20 annotators ranked by avg IoU score.
app.get('/annotations/leaderboard', (req, res) => {
  try {
    const board = getLeaderboard(db);
    res.json({ leaderboard: board });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Hardware ESP32 Camera Ingestion & OTA Routes ─────────────────────────────

/**
 * POST /api/v1/ingest
 * Accepts binary JPEG or multipart frame from ESP32-CAM, pins to 0G Storage
 */
app.post('/api/v1/ingest', upload.single('frame'), async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'] || req.query.deviceId || 'ESP32-UNKNOWN';
    let imageBuf = null;

    if (req.file && req.file.buffer) {
      imageBuf = req.file.buffer;
    } else if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      imageBuf = req.body;
    }

    if (!imageBuf || imageBuf.length === 0) {
      return res.status(400).json({ error: 'Missing image buffer in request' });
    }

    console.log(`📡 [Hardware Ingest] Received ${imageBuf.length} bytes from ${deviceId}`);

    // Upload to 0G Storage using existing relayer queue
    const b64Data = imageBuf.toString('base64');
    const storageResult = await doUpload(b64Data);

    // Save frame metadata in shared indexer.db
    const stmt = db.prepare(`
      INSERT INTO device_frames (device_id, root_hash, tx_seq, size_bytes, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(deviceId, storageResult.rootHash, storageResult.txSeq ? String(storageResult.txSeq) : null, imageBuf.length, Date.now());

    return res.json({
      success: true,
      deviceId,
      rootHash: storageResult.rootHash,
      txSeq: storageResult.txSeq,
      sizeBytes: imageBuf.length,
      storageExplorer: `https://storagescan-galileo.0g.ai/root/${storageResult.rootHash}`
    });
  } catch (err) {
    console.error('💥 [Hardware Ingest] Upload failed:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/devices/:deviceId/frames
 * Returns frame history for a specific hardware device
 */
app.get('/api/v1/devices/:deviceId/frames', (req, res) => {
  try {
    const { deviceId } = req.params;
    const limit = Number(req.query.limit) || 100;
    const stmt = db.prepare(`
      SELECT * FROM device_frames
      WHERE device_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const frames = stmt.all(deviceId, limit);
    res.json({ deviceId, count: frames.length, frames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/frames
 * Returns recent frames across all cameras
 */
app.get('/api/v1/frames', (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const stmt = db.prepare(`
      SELECT * FROM device_frames
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const frames = stmt.all(limit);
    res.json({ count: frames.length, frames });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/devices/:deviceId/model
 * Assign fine-tuned YOLO model weights to a device
 */
app.post('/api/v1/devices/:deviceId/model', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { modelId, weightsRootHash, modelName } = req.body;
    if (!modelId || !weightsRootHash) {
      return res.status(400).json({ error: 'Missing modelId or weightsRootHash' });
    }

    const stmt = db.prepare(`
      INSERT INTO device_models (device_id, model_id, weights_root_hash, model_name, assigned_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        model_id = excluded.model_id,
        weights_root_hash = excluded.weights_root_hash,
        model_name = excluded.model_name,
        assigned_at = excluded.assigned_at
    `);
    stmt.run(deviceId, modelId, weightsRootHash, modelName || `Model #${modelId}`, Date.now());

    res.json({ success: true, deviceId, modelId, weightsRootHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/devices/:deviceId/ota
 * Polled by ESP32-CAM to download latest model weights
 */
app.get('/api/v1/devices/:deviceId/ota', (req, res) => {
  try {
    const { deviceId } = req.params;
    const stmt = db.prepare(`SELECT * FROM device_models WHERE device_id = ?`);
    const model = stmt.get(deviceId);
    if (!model) {
      return res.json({ assigned: false, message: 'No model assigned yet' });
    }
    res.json({
      assigned: true,
      deviceId: model.device_id,
      modelId: model.model_id,
      weightsRootHash: model.weights_root_hash,
      modelName: model.model_name,
      assignedAt: model.assigned_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/', (_, res) => res.json({
  ok: true,
  service: 'Heda 0G Relayer + Event Indexer + Annotation V2',
  status: 'running'
}));

app.get('/health', (_, res) => res.json({
  ok: true,
  service: 'Heda 0G Relayer + Event Indexer + Annotation V2'
}));

// Process-level crash prevention
process.on('uncaughtException', (err) => {
  console.error('💥 [Relayer] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [Relayer] Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Heda 0G Relayer & Indexer listening on 0.0.0.0:${PORT}`);
  try {
    startIndexer();
  } catch (e) {
    console.error('⚠️ [Relayer] startIndexer error:', e.message);
  }
  try {
    startAnnotationIndexer(db);
  } catch (e) {
    console.error('⚠️ [Relayer] startAnnotationIndexer error:', e.message);
  }
});
