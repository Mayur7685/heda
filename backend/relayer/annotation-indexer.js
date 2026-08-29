/**
 * Heda Annotation Indexer — Phase 3
 *
 * Multi-annotator IoU quality pipeline:
 *  1. Polls AnnotationMarketV2 for WorkSubmitted + EvaluationTriggered events.
 *  2. Stores each submission in SQLite (annotation_submissions).
 *  3. Triggers Moondream IoU evaluation when:
 *       a. Task slots are full (all maxAnnotatorsPerTask submitted), OR
 *       b. 24 hours have elapsed since first submission on a task, OR
 *       c. Creator manually fires triggerEvaluation() on-chain (EvaluationTriggered event).
 *  4. Calls /annotation/score on the AI microservice → returns iouScore per submission.
 *  5. Computes quality-weighted sharesBps (basis points) via computeSharesBps().
 *  6. Calls AnnotationMarketV2.distributeRewards() with the relayer signer wallet.
 *  7. Updates SQLite annotator_stats for the leaderboard.
 */

import { ethers }   from 'ethers';
import Database     from 'better-sqlite3';
import path         from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const GALILEO_RPC       = process.env.GALILEO_RPC       || 'https://evmrpc-testnet.0g.ai';
const STORAGE_INDEXER   = process.env.STORAGE_INDEXER   || 'https://indexer-storage-testnet-turbo.0g.ai';
const AI_SERVICE_URL    = process.env.AI_SERVICE_URL    || 'http://localhost:8000';
const MARKET_V2_ADDRESS = process.env.VITE_MARKET_V2_ADDRESS || '';
const RELAYER_PRIVKEY   = process.env.PRIVATE_KEY        || '';

const POLL_INTERVAL_MS  = 10_000;   // 10 seconds
const EVAL_TIMEOUT_MS   = 24 * 60 * 60 * 1000;  // 24 hours
const MIN_IOU_THRESHOLD = 0.30;     // IoU below this → zero reward share
const MAX_RETRIES       = 3;        // Moondream retry attempts

// ── Contract ABI (V2 minimal) ─────────────────────────────────────────────────
const MARKET_V2_ABI = [
  'event WorkSubmitted(uint256 indexed jobId, uint256 indexed taskId, address indexed annotator, bytes32 annotationRootHash, uint256 slotIndex)',
  'event EvaluationTriggered(uint256 indexed jobId, uint256 indexed taskId, address triggeredBy)',
  'function getJob(uint256 jobId) view returns (tuple(address creator, bytes32 dataRootHash, string metadataURI, uint256 rewardPerTask, uint256 taskCount, uint8 maxAnnotatorsPerTask, uint256 approvedTaskCount, uint8 dataType, bool active))',
  'function getTaskSubmissions(uint256 jobId, uint256 taskId) view returns (tuple(address annotator, bytes32 annotationRootHash, uint256 timestamp, bool rewarded)[])',
  'function getSubmissionCount(uint256 jobId, uint256 taskId) view returns (uint256)',
  'function distributeRewards(uint256 jobId, uint256 taskId, address[] annotators, uint256[] sharesBps) external',
];

// ── SQLite Schema ─────────────────────────────────────────────────────────────
const dbPath = path.join(__dirname, 'indexer.db');
let db;

function initAnnotationTables(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS annotation_submissions (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id                INTEGER NOT NULL,
      task_id               INTEGER NOT NULL,
      annotator             TEXT    NOT NULL,
      annotation_root_hash  TEXT    NOT NULL,
      iou_score             REAL    DEFAULT NULL,
      reward_share_bps      INTEGER DEFAULT 0,
      reward_eth_wei        TEXT    DEFAULT '0',
      status                TEXT    DEFAULT 'pending',
      submitted_at          INTEGER NOT NULL,
      evaluated_at          INTEGER DEFAULT NULL,
      UNIQUE(job_id, task_id, annotator)
    );

    CREATE TABLE IF NOT EXISTS annotator_stats (
      address               TEXT PRIMARY KEY,
      total_submissions     INTEGER DEFAULT 0,
      total_evaluated       INTEGER DEFAULT 0,
      total_rejected        INTEGER DEFAULT 0,
      avg_iou_score         REAL    DEFAULT 0,
      total_earned_wei      TEXT    DEFAULT '0',
      reputation_score      REAL    DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_ground_truth (
      job_id                INTEGER NOT NULL,
      task_id               INTEGER NOT NULL,
      image_root_hash       TEXT    NOT NULL,
      ground_truth_json     TEXT    NOT NULL,
      moondream_classes     TEXT    NOT NULL,
      created_at            INTEGER NOT NULL,
      PRIMARY KEY (job_id, task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_anno_subs_job_task  ON annotation_submissions(job_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_anno_subs_annotator ON annotation_submissions(annotator);
    CREATE INDEX IF NOT EXISTS idx_anno_subs_status    ON annotation_submissions(status);
  `);
}

// ── IoU Share Computation ─────────────────────────────────────────────────────

/**
 * Convert raw IoU scores into basis-point shares (must sum to exactly 10000).
 * Annotators below MIN_IOU_THRESHOLD receive 0 share.
 * If ALL scores are below threshold returns all-zeros (ETH stays in contract).
 */
function computeSharesBps(iouScores) {
  const floored = iouScores.map(s => (s >= MIN_IOU_THRESHOLD ? s : 0));
  const total   = floored.reduce((a, b) => a + b, 0);
  if (total === 0) return floored.map(() => 0);

  const raw       = floored.map(s => Math.floor((s / total) * 10000));
  const remainder = 10000 - raw.reduce((a, b) => a + b, 0);
  const maxIdx    = raw.indexOf(Math.max(...raw));
  raw[maxIdx]    += remainder;   // fix rounding so sum is exactly 10000
  return raw;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchFromStorage(rootHash) {
  const normHash = rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`;
  const endpoints = [
    `${STORAGE_INDEXER}/file?root=${normHash}`,
    `https://indexer-storage-testnet-standard.0g.ai/file?root=${normHash}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) return await res.text();
    } catch {}
  }
  return null;
}

async function callAnnotationScore(imageBase64, submittedBoxes, moondreamClasses) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/annotation/score`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, submittedBoxes, moondreamClasses }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) return await res.json();
      console.error(`[AnnotationIndexer] /annotation/score HTTP ${res.status} attempt ${attempt + 1}`);
    } catch (err) {
      console.error(`[AnnotationIndexer] /annotation/score error attempt ${attempt + 1}:`, err.message);
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

// ── Core Evaluation Pipeline ──────────────────────────────────────────────────

async function evaluateTask(contractWithSigner, provider, jobId, taskId) {
  const evalKey = `${jobId}:${taskId}`;
  console.log(`[AnnotationIndexer] Evaluating task ${evalKey} ...`);

  // Check if already rewarded in SQLite
  const alreadyRewarded = db.prepare(
    `SELECT 1 FROM annotation_submissions WHERE job_id=? AND task_id=? AND status='rewarded' LIMIT 1`
  ).get(jobId, taskId);
  if (alreadyRewarded) {
    console.log(`[AnnotationIndexer] Task ${evalKey} already rewarded, skipping.`);
    return;
  }

  // Load pending submissions from SQLite
  const subs = db.prepare(
    `SELECT * FROM annotation_submissions WHERE job_id=? AND task_id=? AND status='pending'`
  ).all(jobId, taskId);

  if (subs.length === 0) {
    console.log(`[AnnotationIndexer] No pending submissions for task ${evalKey}.`);
    return;
  }

  // Get job metadata to find image root hash and annotation classes
  let job;
  try {
    job = await contractWithSigner.getJob(jobId);
  } catch (err) {
    console.error(`[AnnotationIndexer] Failed to fetch job ${jobId}:`, err.message);
    return;
  }

  const imageRootHash = job.dataRootHash;

  // Fetch (or reuse cached) ground truth
  let groundTruthBoxes;
  const cachedGT = db.prepare(
    `SELECT ground_truth_json FROM task_ground_truth WHERE job_id=? AND task_id=?`
  ).get(jobId, taskId);

  if (cachedGT) {
    groundTruthBoxes = JSON.parse(cachedGT.ground_truth_json);
    console.log(`[AnnotationIndexer] Using cached GT for task ${evalKey} (${groundTruthBoxes.length} boxes)`);
  } else {
    // Fetch image from 0G Storage
    const imageData = await fetchFromStorage(imageRootHash);
    if (!imageData) {
      console.error(`[AnnotationIndexer] Could not fetch image for job ${jobId} from 0G Storage.`);
      return;
    }

    // Parse metadata to get annotation classes
    let moondreamClasses = ['object'];
    try {
      const metaData = await fetchFromStorage(job.metadataURI.replace('0x', ''));
      if (metaData) {
        const meta = JSON.parse(metaData);
        if (meta.classes && Array.isArray(meta.classes)) moondreamClasses = meta.classes;
      }
    } catch {}

    // Call Moondream via /annotation/score with first submission's boxes as proxy
    // (GT is generated from the image, not from submitted boxes)
    const firstSubmission = subs[0];
    let submittedBoxes = [];
    try {
      const annoData = await fetchFromStorage(firstSubmission.annotation_root_hash);
      if (annoData) submittedBoxes = JSON.parse(annoData);
    } catch {}

    const scoreResult = await callAnnotationScore(imageData, submittedBoxes, moondreamClasses);
    if (!scoreResult) {
      console.error(`[AnnotationIndexer] Moondream unavailable for task ${evalKey} after ${MAX_RETRIES} attempts.`);
      return;
    }

    groundTruthBoxes = scoreResult.groundTruthBoxes || [];
    db.prepare(`
      INSERT OR REPLACE INTO task_ground_truth (job_id, task_id, image_root_hash, ground_truth_json, moondream_classes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(jobId, taskId, imageRootHash, JSON.stringify(groundTruthBoxes), JSON.stringify(moondreamClasses), Date.now());
  }

  // Score each submission individually
  const iouScores = [];
  for (const sub of subs) {
    let submittedBoxes = [];
    try {
      const annoData = await fetchFromStorage(sub.annotation_root_hash);
      if (annoData) submittedBoxes = JSON.parse(annoData);
    } catch {}

    const iou = scoreAnnotationLocally(submittedBoxes, groundTruthBoxes);
    iouScores.push(iou);
    console.log(`[AnnotationIndexer]  annotator=${sub.annotator.slice(0,8)}... IoU=${iou.toFixed(4)}`);
  }

  // Compute proportional BPS shares
  const sharesBps = computeSharesBps(iouScores);
  console.log(`[AnnotationIndexer] Shares BPS:`, sharesBps);

  // If all rejected (all zeros), skip on-chain call but mark as evaluated
  const allRejected = sharesBps.every(s => s === 0);

  if (!allRejected) {
    // Call distributeRewards on-chain
    const annotators = subs.map(s => s.annotator);
    try {
      const tx = await contractWithSigner.distributeRewards(jobId, taskId, annotators, sharesBps);
      console.log(`[AnnotationIndexer] distributeRewards tx: ${tx.hash}`);
      await tx.wait();
      console.log(`[AnnotationIndexer] ✓ Rewards distributed for task ${evalKey}`);
    } catch (err) {
      console.error(`[AnnotationIndexer] distributeRewards failed:`, err.message);
      return;
    }
  } else {
    console.log(`[AnnotationIndexer] All submissions below IoU threshold for task ${evalKey}. No rewards distributed.`);
  }

  // Update SQLite
  const now = Date.now();
  const upsertSub = db.prepare(`
    UPDATE annotation_submissions
    SET iou_score=?, reward_share_bps=?, status=?, evaluated_at=?
    WHERE job_id=? AND task_id=? AND annotator=?
  `);

  const upsertStats = db.prepare(`
    INSERT INTO annotator_stats (address, total_submissions, total_evaluated, total_rejected, avg_iou_score, total_earned_wei, reputation_score)
    VALUES (?, 1, 1, ?, ?, ?, ?)
    ON CONFLICT(address) DO UPDATE SET
      total_submissions = total_submissions + 1,
      total_evaluated   = total_evaluated + 1,
      total_rejected    = total_rejected + excluded.total_rejected,
      avg_iou_score     = (avg_iou_score * total_evaluated + excluded.avg_iou_score) / (total_evaluated + 1),
      reputation_score  = (reputation_score * 0.8 + excluded.avg_iou_score * 0.2)
  `);

  const job2 = await contractWithSigner.getJob(jobId).catch(() => null);
  const rewardPerTask = job2 ? BigInt(job2.rewardPerTask.toString()) : 0n;

  for (let i = 0; i < subs.length; i++) {
    const sub    = subs[i];
    const iou    = iouScores[i];
    const bps    = sharesBps[i];
    const status = allRejected ? 'rejected' : (bps > 0 ? 'rewarded' : 'rejected');
    const earned = (rewardPerTask * BigInt(bps) / 10000n).toString();

    upsertSub.run(iou, bps, status, now, jobId, taskId, sub.annotator);
    upsertStats.run(sub.annotator, bps === 0 ? 1 : 0, iou, earned, iou);
  }
}

// Local IoU scoring (avoids extra API call when GT is already cached)
function computeIouLocal(a, b) {
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + b.w, by2 = b.y + b.h;
  const inter = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1)) *
                Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const union = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter;
  return union > 0 ? inter / union : 0;
}

function scoreAnnotationLocally(submitted, groundTruth) {
  if (!groundTruth || groundTruth.length === 0) return 0;
  const scores = groundTruth.map(gt => {
    const sameLabel = submitted.filter(s => s.label === gt.label);
    return sameLabel.length > 0
      ? Math.max(...sameLabel.map(s => computeIouLocal(gt, s)))
      : 0;
  });
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ── Event Backfill Loop ───────────────────────────────────────────────────────

let lastIndexedBlock = 0;
const pendingEvaluations = new Set(); // "jobId:taskId" strings

async function backfillEvents(contract, contractWithSigner, provider) {
  try {
    const currentBlock = await provider.getBlockNumber();
    if (lastIndexedBlock >= currentBlock) return;

    const fromBlock = Math.max(lastIndexedBlock, currentBlock - 2000); // cap range
    console.log(`[AnnotationIndexer] Indexing blocks ${fromBlock}→${currentBlock} ...`);

    // WorkSubmitted
    const workEvents = await contract.queryFilter('WorkSubmitted', fromBlock, currentBlock);
    for (const ev of workEvents) {
      const { jobId, taskId, annotator, annotationRootHash } = ev.args;
      const key = `${jobId}:${taskId}`;

      try {
        db.prepare(`
          INSERT OR IGNORE INTO annotation_submissions
            (job_id, task_id, annotator, annotation_root_hash, status, submitted_at)
          VALUES (?, ?, ?, ?, 'pending', ?)
        `).run(Number(jobId), Number(taskId), annotator, annotationRootHash, Date.now());
      } catch {}

      // Check if slots are now full
      const slotIndex = Number(ev.args.slotIndex);
      let job;
      try { job = await contract.getJob(jobId); } catch { continue; }
      if (slotIndex + 1 >= job.maxAnnotatorsPerTask) {
        if (!pendingEvaluations.has(key)) {
          pendingEvaluations.add(key);
          evaluateTask(contractWithSigner, provider, Number(jobId), Number(taskId))
            .catch(err => console.error(`[AnnotationIndexer] evaluateTask error ${key}:`, err.message))
            .finally(() => pendingEvaluations.delete(key));
        }
      }
    }

    // EvaluationTriggered (manual creator override)
    const triggerEvents = await contract.queryFilter('EvaluationTriggered', fromBlock, currentBlock);
    for (const ev of triggerEvents) {
      const { jobId, taskId, triggeredBy } = ev.args;
      const key = `${jobId}:${taskId}`;
      // address(0) means auto-trigger (from submitWork), non-zero = creator override
      if (triggeredBy !== ethers.ZeroAddress && !pendingEvaluations.has(key)) {
        console.log(`[AnnotationIndexer] Manual evaluation triggered for task ${key} by ${triggeredBy}`);
        pendingEvaluations.add(key);
        evaluateTask(contractWithSigner, provider, Number(jobId), Number(taskId))
          .catch(err => console.error(`[AnnotationIndexer] Manual evaluateTask error ${key}:`, err.message))
          .finally(() => pendingEvaluations.delete(key));
      }
    }

    lastIndexedBlock = currentBlock;
  } catch (err) {
    console.error('[AnnotationIndexer] backfillEvents error:', err.message);
  }
}

// ── 24h Timeout Checker ───────────────────────────────────────────────────────

async function checkTimeouts(contractWithSigner, provider) {
  const cutoff = Date.now() - EVAL_TIMEOUT_MS;
  const timedOut = db.prepare(`
    SELECT DISTINCT job_id, task_id
    FROM annotation_submissions
    WHERE status='pending' AND submitted_at < ?
  `).all(cutoff);

  for (const { job_id, task_id } of timedOut) {
    const key = `${job_id}:${task_id}`;
    if (!pendingEvaluations.has(key)) {
      console.log(`[AnnotationIndexer] 24h timeout triggered for task ${key}`);
      pendingEvaluations.add(key);
      evaluateTask(contractWithSigner, provider, job_id, task_id)
        .catch(err => console.error(`[AnnotationIndexer] Timeout evaluateTask error ${key}:`, err.message))
        .finally(() => pendingEvaluations.delete(key));
    }
  }
}

// ── Public Startup ────────────────────────────────────────────────────────────

export function startAnnotationIndexer(database) {
  db = database;
  initAnnotationTables(db);

  if (!MARKET_V2_ADDRESS || MARKET_V2_ADDRESS === '0x0000000000000000000000000000000000000000') {
    console.log('[AnnotationIndexer] VITE_MARKET_V2_ADDRESS not set — indexer disabled.');
    return;
  }
  if (!RELAYER_PRIVKEY) {
    console.log('[AnnotationIndexer] PRIVATE_KEY not set — indexer disabled.');
    return;
  }

  const provider           = new ethers.JsonRpcProvider(GALILEO_RPC, null, { staticNetwork: true });
  const relayerWallet      = new ethers.Wallet(RELAYER_PRIVKEY, provider);
  const contract           = new ethers.Contract(MARKET_V2_ADDRESS, MARKET_V2_ABI, provider);
  const contractWithSigner = contract.connect(relayerWallet);

  console.log(`[AnnotationIndexer] Starting — contract: ${MARKET_V2_ADDRESS}`);
  console.log(`[AnnotationIndexer] Relayer wallet: ${relayerWallet.address}`);

  const poll = async () => {
    await backfillEvents(contract, contractWithSigner, provider);
    await checkTimeouts(contractWithSigner, provider);
  };

  poll(); // immediate first poll
  setInterval(poll, POLL_INTERVAL_MS);
  console.log(`[AnnotationIndexer] Polling every ${POLL_INTERVAL_MS / 1000}s`);
}

// ── Read API (used by server.js REST routes) ─────────────────────────────────

export function getTaskAnnotations(database, jobId, taskId) {
  return database.prepare(`
    SELECT * FROM annotation_submissions WHERE job_id=? AND task_id=? ORDER BY iou_score DESC NULLS LAST
  `).all(jobId, taskId);
}

export function getJobAnnotationStatus(database, jobId) {
  return database.prepare(`
    SELECT task_id,
      COUNT(*) AS total_submissions,
      SUM(CASE WHEN status='pending'   THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status='evaluated' OR status='rewarded' THEN 1 ELSE 0 END) AS evaluated,
      SUM(CASE WHEN status='rewarded'  THEN 1 ELSE 0 END) AS rewarded,
      SUM(CASE WHEN status='rejected'  THEN 1 ELSE 0 END) AS rejected
    FROM annotation_submissions WHERE job_id=?
    GROUP BY task_id ORDER BY task_id
  `).all(jobId);
}

export function getAnnotatorStats(database, address) {
  const stats = database.prepare(
    `SELECT * FROM annotator_stats WHERE address=?`
  ).get(address.toLowerCase());

  const history = database.prepare(`
    SELECT * FROM annotation_submissions WHERE annotator=? ORDER BY submitted_at DESC LIMIT 50
  `).all(address.toLowerCase());

  return { stats: stats || null, submissions: history };
}

export function getLeaderboard(database) {
  return database.prepare(`
    SELECT address, avg_iou_score, reputation_score, total_submissions,
           total_evaluated, total_rejected, total_earned_wei
    FROM annotator_stats
    ORDER BY avg_iou_score DESC
    LIMIT 20
  `).all();
}
