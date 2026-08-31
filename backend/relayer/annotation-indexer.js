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

import 'dotenv/config';
import { ethers }   from 'ethers';
import Database     from 'better-sqlite3';
import path         from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const GALILEO_RPC       = process.env.GALILEO_RPC       || 'https://evmrpc-testnet.0g.ai';
const STORAGE_INDEXER   = process.env.STORAGE_INDEXER   || 'https://indexer-storage-testnet-turbo.0g.ai';
const AI_SERVICE_URL    = process.env.AI_SERVICE_URL    || 'http://localhost:8000';
const MARKET_V2_ADDRESS = process.env.VITE_MARKET_V2_ADDRESS || process.env.MARKET_V2_ADDRESS || '0xCBbb84EB5740630B4654Fbf963a503d86E67b939';
const RELAYER_PRIVKEY   = process.env.PRIVATE_KEY        || '0x3d20b42d0ec55312d082c53a9fb1635a374051c976f8bd76f016b4781b438653';

const POLL_INTERVAL_MS  = 10_000;   // 10 seconds
const EVAL_TIMEOUT_MS   = 24 * 60 * 60 * 1000;  // 24 hours
const MIN_IOU_THRESHOLD = 0.30;     // IoU below this → zero reward share
const MAX_RETRIES       = 3;        // Moondream retry attempts

let distributeTxQueue = Promise.resolve(); // Serial queue for distributeRewards on-chain transactions

// ── Contract ABI (V2 minimal) ─────────────────────────────────────────────────
const MARKET_V2_ABI = [
  'event WorkSubmitted(uint256 indexed jobId, uint256 indexed taskId, address indexed annotator, bytes32 annotationRootHash, uint256 slotIndex)',
  'event EvaluationTriggered(uint256 indexed jobId, uint256 indexed taskId, address triggeredBy)',
  'event TaskReset(uint256 indexed jobId, uint256 indexed taskId, uint256 failedSubmissions)',
  'event JobClosed(uint256 indexed jobId, uint256 unspentReturned)',
  'function getJob(uint256 jobId) view returns (tuple(address creator, bytes32 dataRootHash, string metadataURI, uint256 rewardPerTask, uint256 taskCount, uint8 maxAnnotatorsPerTask, uint256 approvedTaskCount, uint8 dataType, bool active))',
  'function getTaskSubmissions(uint256 jobId, uint256 taskId) view returns (tuple(address annotator, bytes32 annotationRootHash, uint256 timestamp, bool rewarded)[])',
  'function getSubmissionCount(uint256 jobId, uint256 taskId) view returns (uint256)',
  'function distributeRewards(uint256 jobId, uint256 taskId, address[] annotators, uint256[] sharesBps) external',
  'function distributeRewardsBatch(uint256 jobId, uint256[] taskIds, address[][] annotatorsList, uint256[][] sharesBpsList) external',
  'function submitWorkBatch(uint256 jobId, uint256[] taskIds, bytes32[] annotationRootHashes) external',
  'function resetTask(uint256 jobId, uint256 taskId) external',
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
      tx_hash               TEXT    DEFAULT '',
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

async function fetchFromStorage(rootHash, retries = 3, delayMs = 5000) {
  const normHash = rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`;
  const endpoints = [
    `${STORAGE_INDEXER}/file?root=${normHash}`,
    `https://indexer-storage-testnet-standard.0g.ai/file?root=${normHash}`,
  ];
  for (let attempt = 0; attempt < retries; attempt++) {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim().length > 0) return text;
        }
      } catch {}
    }
    if (attempt < retries - 1) {
      console.log(`[AnnotationIndexer] Storage fetch attempt ${attempt + 1}/${retries} failed for ${normHash.slice(0,12)}... retrying in ${delayMs/1000}s`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

async function fetchMoondreamCloudDetect(imageBase64, className) {
  const apiKey = process.env.MOONDREAM_API_KEY;
  if (!apiKey || !imageBase64) return null;
  try {
    const formattedImage = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const res = await fetch("https://api.moondream.ai/v1/detect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Moondream-Auth": apiKey,
      },
      body: JSON.stringify({
        image_url: formattedImage,
        object: className,
      }),
      signal: AbortSignal.timeout(18000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.objects)) {
        const boxes = data.objects.map((obj) => {
          const xMin = Number(obj.x_min ?? 0);
          const yMin = Number(obj.y_min ?? 0);
          const xMax = Number(obj.x_max ?? 0);
          const yMax = Number(obj.y_max ?? 0);
          return {
            label: className,
            x: xMin,
            y: yMin,
            w: Math.max(0, xMax - xMin),
            h: Math.max(0, yMax - yMin),
            x_min: xMin,
            y_min: yMin,
            x_max: xMax,
            y_max: yMax,
          };
        });
        console.log(`[AnnotationIndexer] Moondream Cloud detected ${boxes.length} box(es) for '${className}'`);
        return boxes;
      }
    } else {
      const errText = await res.text().catch(() => "");
      console.warn(`[AnnotationIndexer] Moondream Cloud API status ${res.status} for '${className}':`, errText);
    }
  } catch (err) {
    console.warn(`[AnnotationIndexer] Moondream Cloud API direct call note for '${className}':`, err.message);
  }
  return null;
}

async function callAnnotationScore(imageBase64, submittedBoxes, moondreamClasses) {
  // 1. Try local Python AI microservice first
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${AI_SERVICE_URL}/annotation/score`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, submittedBoxes, moondreamClasses }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return await res.json();
    } catch {}
  }

  // 2. Direct Moondream Cloud API fallback if Python AI service is offline
  if (imageBase64 && Array.isArray(moondreamClasses) && moondreamClasses.length > 0) {
    console.log(`[AnnotationIndexer] Python AI service offline — calling Moondream Cloud API directly from Relayer Node (${moondreamClasses.length} class(es))...`);
    const groundTruthBoxes = [];
    for (const cls of moondreamClasses) {
      // Guardrail: 600ms delay between classes to strictly adhere to Moondream 2 req/sec rate limit
      await new Promise(r => setTimeout(r, 600));
      const detected = await fetchMoondreamCloudDetect(imageBase64, cls);
      if (detected && detected.length > 0) groundTruthBoxes.push(...detected);
    }
    if (groundTruthBoxes.length > 0) {
      return { groundTruthBoxes };
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
    // Fetch image payload from 0G Storage (with retry built into fetchFromStorage)
    const rawStorage = await fetchFromStorage(imageRootHash);
    let imageBase64 = "";
    if (rawStorage) {
      try {
        const parsed = JSON.parse(rawStorage);
        if (Array.isArray(parsed) && parsed[taskId]) {
          const item = parsed[taskId];
          const rawB64 = item.data || item.base64 || item;
          const mime = item.type || 'image/jpeg';
          imageBase64 = typeof rawB64 === 'string' && rawB64.startsWith('data:') ? rawB64 : `data:${mime};base64,${rawB64}`;
        } else if (parsed.data) {
          imageBase64 = parsed.data;
        } else {
          imageBase64 = rawStorage;
        }
      } catch {
        imageBase64 = rawStorage;
      }
    }

    // Parse metadata to get annotation classes/labels
    let moondreamClasses = ['object'];
    try {
      const metaData = await fetchFromStorage(job.metadataURI.replace('0x', ''));
      if (metaData) {
        const meta = JSON.parse(metaData);
        if (meta.labels && Array.isArray(meta.labels)) moondreamClasses = meta.labels;
        else if (meta.classes && Array.isArray(meta.classes)) moondreamClasses = meta.classes;
      }
    } catch {}

    // Fetch annotation boxes for all submissions to check storage availability
    const allSubBoxes = [];
    let storageAvailableCount = 0;
    for (const s of subs) {
      try {
        const raw = await fetchFromStorage(s.annotation_root_hash);
        if (raw) {
          storageAvailableCount++;
          const parsed = JSON.parse(raw);
          const boxes = parsed.annotation || parsed.submittedBoxes || parsed;
          if (Array.isArray(boxes) && boxes.length > 0) allSubBoxes.push(boxes);
        }
      } catch {}
    }

    // ⚠️ If storage is NOT available for any annotation yet — defer eval, do NOT score zeros
    if (storageAvailableCount === 0) {
      console.log(`[AnnotationIndexer] ⏳ 0G Storage not yet indexed for task ${evalKey} — deferring evaluation by 3 minutes.`);
      setTimeout(() => {
        if (!pendingEvaluations.has(evalKey)) {
          pendingEvaluations.add(evalKey);
          evaluateTask(contractWithSigner, provider, jobId, taskId)
            .catch(err => console.error(`[AnnotationIndexer] Deferred evaluateTask error ${evalKey}:`, err.message))
            .finally(() => pendingEvaluations.delete(evalKey));
        }
      }, 3 * 60 * 1000);
      return; // exit without scoring zeros
    }

    // Try Moondream Cloud for ground truth (uses image + class names)
    const scoreResult = await callAnnotationScore(imageBase64, allSubBoxes[0] || [], moondreamClasses);
    if (scoreResult && Array.isArray(scoreResult.groundTruthBoxes) && scoreResult.groundTruthBoxes.length > 0) {
      groundTruthBoxes = scoreResult.groundTruthBoxes;
      console.log(`[AnnotationIndexer] Moondream Cloud GT for task ${evalKey}: ${groundTruthBoxes.length} boxes`);
    } else {
      // Consensus GT from actual submissions (good enough when Moondream unavailable)
      groundTruthBoxes = buildConsensusGTLocal(allSubBoxes);
      console.log(`[AnnotationIndexer] Consensus GT for task ${evalKey}: ${groundTruthBoxes.length} boxes from ${allSubBoxes.length} submissions`);
    }

    groundTruthBoxes = groundTruthBoxes || [];

    // ⚠️ Never cache an empty GT — it would permanently poison future scoring
    if (groundTruthBoxes.length > 0) {
      db.prepare(`
        INSERT OR REPLACE INTO task_ground_truth (job_id, task_id, image_root_hash, ground_truth_json, moondream_classes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(jobId, taskId, imageRootHash, JSON.stringify(groundTruthBoxes), JSON.stringify(moondreamClasses), Date.now());
    } else {
      console.log(`[AnnotationIndexer] ⚠️ Empty GT for task ${evalKey} — deferring eval by 3 minutes instead of scoring zeros.`);
      setTimeout(() => {
        if (!pendingEvaluations.has(evalKey)) {
          pendingEvaluations.add(evalKey);
          evaluateTask(contractWithSigner, provider, jobId, taskId)
            .catch(err => console.error(`[AnnotationIndexer] GT-retry evaluateTask error ${evalKey}:`, err.message))
            .finally(() => pendingEvaluations.delete(evalKey));
        }
      }, 3 * 60 * 1000);
      return; // exit without scoring zeros
    }
  }

  // Score each submission individually against ground truth
  const iouScores = [];
  let missingStorageCount = 0;
  for (const sub of subs) {
    let submittedBoxes = [];
    try {
      const annoData = await fetchFromStorage(sub.annotation_root_hash);
      if (annoData) {
        const parsedAnno = JSON.parse(annoData);
        submittedBoxes = parsedAnno.annotation || parsedAnno.submittedBoxes || parsedAnno;
        if (!Array.isArray(submittedBoxes)) submittedBoxes = [];
      } else {
        missingStorageCount++;
      }
    } catch { missingStorageCount++; }

    const iou = scoreAnnotationLocally(submittedBoxes, groundTruthBoxes);
    iouScores.push(iou);
    console.log(`[AnnotationIndexer]  annotator=${sub.annotator.slice(0,8)}... IoU=${iou.toFixed(4)} boxes=${submittedBoxes.length}`);
  }

  // If storage missing for ALL submissions, defer instead of giving false zeros
  if (missingStorageCount === subs.length) {
    console.log(`[AnnotationIndexer] ⏳ All submission storage unavailable for task ${evalKey} — deferring 3 minutes.`);
    // Remove cached GT so we re-derive it next attempt
    db.prepare(`DELETE FROM task_ground_truth WHERE job_id=? AND task_id=?`).run(jobId, taskId);
    setTimeout(() => {
      if (!pendingEvaluations.has(evalKey)) {
        pendingEvaluations.add(evalKey);
        evaluateTask(contractWithSigner, provider, jobId, taskId)
          .catch(err => console.error(`[AnnotationIndexer] Storage-retry evaluateTask error ${evalKey}:`, err.message))
          .finally(() => pendingEvaluations.delete(evalKey));
      }
    }, 3 * 60 * 1000);
    return;
  }

  // Compute proportional BPS shares
  const sharesBps = computeSharesBps(iouScores);
  console.log(`[AnnotationIndexer] Shares BPS:`, sharesBps);

  // If all rejected (all zeros), skip on-chain call but mark as evaluated
  const allRejected = sharesBps.every(s => s === 0);

  if (!allRejected) {
    // Call distributeRewards on-chain sequentially (nonce queue)
    const annotators = subs.map(s => s.annotator);
    let txSuccess = false;
    await (distributeTxQueue = distributeTxQueue.then(async () => {
      try {
        const tx = await contractWithSigner.distributeRewards(jobId, taskId, annotators, sharesBps, { gasLimit: 300000 });
        console.log(`[AnnotationIndexer] distributeRewards tx ${evalKey}: ${tx.hash}`);
        await tx.wait(1);
        console.log(`[AnnotationIndexer] ✓ Rewards distributed for task ${evalKey}`);
        txSuccess = true;
      } catch (err) {
        console.error(`[AnnotationIndexer] distributeRewards failed for ${evalKey}:`, err.message);
      }
    })).catch(() => {});

    if (!txSuccess) return;
  } else {
    // All submissions genuinely scored 0 IoU — call resetTask() on-chain to reopen slots
    console.log(`[AnnotationIndexer] ⚠️ All submissions GENUINELY rejected (real 0 IoU) for task ${evalKey} — calling resetTask() to reopen for new annotators.`);
    await (distributeTxQueue = distributeTxQueue.then(async () => {
      try {
        const tx = await contractWithSigner.resetTask(jobId, taskId, { gasLimit: 200000 });
        console.log(`[AnnotationIndexer] resetTask tx ${evalKey}: ${tx.hash}`);
        await tx.wait(1);
        console.log(`[AnnotationIndexer] ✓ Task ${evalKey} reset — slots reopened, ETH still locked for next round.`);
      } catch (err) {
        console.error(`[AnnotationIndexer] resetTask failed for ${evalKey}:`, err.message);
      }
    })).catch(() => {});
    // Clear SQLite state so next round can re-evaluate fresh
    db.prepare(`DELETE FROM annotation_submissions WHERE job_id=? AND task_id=?`).run(jobId, taskId);
    db.prepare(`DELETE FROM task_ground_truth WHERE job_id=? AND task_id=?`).run(jobId, taskId);
    return; // don't update stats with 0-reward entries
  }

  // Update SQLite
  const now = Date.now();
  const upsertSub = db.prepare(`
    UPDATE annotation_submissions
    SET iou_score=?, reward_share_bps=?, reward_eth_wei=?, status=?, evaluated_at=?
    WHERE job_id=? AND task_id=? AND annotator=?
  `);

  const job2 = await contractWithSigner.getJob(jobId).catch(() => null);
  const rewardPerTask = job2 ? BigInt(job2.rewardPerTask.toString()) : 0n;

  for (let i = 0; i < subs.length; i++) {
    const sub       = subs[i];
    const iou       = iouScores[i];
    const bps       = sharesBps[i];
    const status    = allRejected ? 'rejected' : (bps > 0 ? 'rewarded' : 'rejected');
    const earnedWei = (rewardPerTask * BigInt(bps) / 10000n).toString();

    upsertSub.run(iou, bps, earnedWei, status, now, jobId, taskId, sub.annotator);

    const existing = db.prepare(`SELECT total_earned_wei FROM annotator_stats WHERE LOWER(address)=LOWER(?)`).get(sub.annotator);
    const prevWei  = existing ? BigInt(existing.total_earned_wei || '0') : 0n;
    const newWei   = (prevWei + BigInt(earnedWei)).toString();

    db.prepare(`
      INSERT INTO annotator_stats (address, total_submissions, total_evaluated, total_rejected, avg_iou_score, total_earned_wei, reputation_score)
      VALUES (?, 1, 1, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        total_submissions = total_submissions + 1,
        total_evaluated   = total_evaluated + 1,
        total_rejected    = total_rejected + excluded.total_rejected,
        avg_iou_score     = (avg_iou_score * total_evaluated + excluded.avg_iou_score) / (total_evaluated + 1),
        total_earned_wei  = ?,
        reputation_score  = (reputation_score * 0.8 + excluded.avg_iou_score * 0.2)
    `).run(sub.annotator, bps === 0 ? 1 : 0, iou, earnedWei, iou, newWei);
  }
}

export function toRelativeBoxLocal(box, imgW = 680.0, imgH = 400.0) {
  const label = String(box.label || 'object');

  if (box.x_min !== undefined && box.x_max !== undefined) {
    const xMin = Number(box.x_min);
    const yMin = Number(box.y_min);
    const xMax = Number(box.x_max);
    const yMax = Number(box.y_max);
    return {
      label,
      x: Math.max(0.0, Math.min(1.0, xMin)),
      y: Math.max(0.0, Math.min(1.0, yMin)),
      w: Math.max(0.0, Math.min(1.0, xMax - xMin)),
      h: Math.max(0.0, Math.min(1.0, yMax - yMin)),
    };
  }

  if (box.relX !== undefined && box.relW !== undefined) {
    return {
      label,
      x: Math.max(0.0, Math.min(1.0, Number(box.relX))),
      y: Math.max(0.0, Math.min(1.0, Number(box.relY))),
      w: Math.max(0.0, Math.min(1.0, Number(box.relW))),
      h: Math.max(0.0, Math.min(1.0, Number(box.relH))),
    };
  }

  const x = Number(box.x || 0);
  const y = Number(box.y || 0);
  const w = Number(box.w || 0);
  const h = Number(box.h || 0);
  const cW = Number(box.canvasW || imgW);
  const cH = Number(box.canvasH || imgH);

  if (x > 1.0 || y > 1.0 || w > 1.0 || h > 1.0) {
    return {
      label,
      x: Math.max(0.0, Math.min(1.0, x / cW)),
      y: Math.max(0.0, Math.min(1.0, y / cH)),
      w: Math.max(0.0, Math.min(1.0, w / cW)),
      h: Math.max(0.0, Math.min(1.0, h / cH)),
    };
  }
  return {
    label,
    x: Math.max(0.0, Math.min(1.0, x)),
    y: Math.max(0.0, Math.min(1.0, y)),
    w: Math.max(0.0, Math.min(1.0, w)),
    h: Math.max(0.0, Math.min(1.0, h)),
  };
}

function buildConsensusGTLocal(allSubBoxes) {
  const flattened = [];
  for (const list of allSubBoxes) {
    if (Array.isArray(list)) {
      for (const b of list) {
        if (b && typeof b === 'object') {
          flattened.push(toRelativeBoxLocal(b));
        }
      }
    }
  }
  if (flattened.length === 0) return [];

  const clusters = [];
  for (const b of flattened) {
    let matched = false;
    for (const c of clusters) {
      if (c[0].label === b.label && computeIouLocal(c[0], b) >= 0.30) {
        c.push(b);
        matched = true;
        break;
      }
    }
    if (!matched) clusters.push([b]);
  }

  return clusters.map(c => ({
    label: c[0].label,
    x: Number((c.reduce((sum, box) => sum + box.x, 0) / c.length).toFixed(4)),
    y: Number((c.reduce((sum, box) => sum + box.y, 0) / c.length).toFixed(4)),
    w: Number((c.reduce((sum, box) => sum + box.w, 0) / c.length).toFixed(4)),
    h: Number((c.reduce((sum, box) => sum + box.h, 0) / c.length).toFixed(4)),
  }));
}

// Local IoU scoring (avoids extra API call when GT is already cached)
function computeIouLocal(boxA, boxB) {
  const a = toRelativeBoxLocal(boxA);
  const b = toRelativeBoxLocal(boxB);
  const ax1 = a.x, ay1 = a.y, ax2 = a.x + a.w, ay2 = a.y + a.h;
  const bx1 = b.x, by1 = b.y, bx2 = b.x + b.w, by2 = b.y + b.h;
  const inter = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1)) *
                Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter;
  return union > 0 ? inter / union : 0;
}

function scoreAnnotationLocally(submitted, groundTruth) {
  const subArray = Array.isArray(submitted) ? submitted : (submitted?.annotation || []);
  if (!groundTruth || groundTruth.length === 0) return 0;
  const scores = groundTruth.map(gt => {
    const sameLabel = subArray.filter(s => s && s.label === gt.label);
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

    const defaultStartBlock = Number(process.env.START_BLOCK || 52183500);
    const fromBlock = lastIndexedBlock > 0 ? lastIndexedBlock : Math.min(defaultStartBlock, currentBlock);
    console.log(`[AnnotationIndexer] Indexing blocks ${fromBlock}→${currentBlock} ...`);

    // WorkSubmitted
    const workEvents = await contract.queryFilter('WorkSubmitted', fromBlock, currentBlock);
    for (const ev of workEvents) {
      const { jobId, taskId, annotator, annotationRootHash } = ev.args;
      const txHash = ev.transactionHash || "";
      const key = `${jobId}:${taskId}`;

      try {
        db.prepare(`
          INSERT OR IGNORE INTO annotation_submissions
            (job_id, task_id, annotator, annotation_root_hash, tx_hash, status, submitted_at)
          VALUES (?, ?, ?, ?, ?, 'pending', ?)
        `).run(Number(jobId), Number(taskId), annotator, annotationRootHash, txHash, Date.now());
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

    // JobClosed (creator closes/archives job early)
    const closedEvents = await contract.queryFilter('JobClosed', fromBlock, currentBlock);
    for (const ev of closedEvents) {
      const jobId = Number(ev.args.jobId);
      console.log(`[AnnotationIndexer] Job #${jobId} closed onchain — updating pending submissions to 'closed'`);
      db.prepare(`
        UPDATE annotation_submissions
        SET status='closed'
        WHERE job_id=? AND status='pending'
      `).run(jobId);
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

let activeProvider = null;
let activeContractWithSigner = null;

export function triggerTaskEvaluation(jobId, taskId) {
  const key = `${jobId}:${taskId}`;
  if (pendingEvaluations.has(key)) {
    console.log(`[AnnotationIndexer] Task ${key} already evaluating, skipping duplicate trigger.`);
    return;
  }
  if (!activeContractWithSigner || !activeProvider) {
    console.warn(`[AnnotationIndexer] Cannot trigger evaluation — indexer not fully initialized yet.`);
    return;
  }
  console.log(`[AnnotationIndexer] ⚡ Immediate evaluation requested for task ${key}`);
  pendingEvaluations.add(key);
  evaluateTask(activeContractWithSigner, activeProvider, Number(jobId), Number(taskId))
    .catch(err => console.error(`[AnnotationIndexer] Immediate evaluateTask error ${key}:`, err.message))
    .finally(() => pendingEvaluations.delete(key));
}

export function startAnnotationIndexer(database) {
  db = database;
  initAnnotationTables(db);

  const marketV2Addr = ethers.getAddress(MARKET_V2_ADDRESS.toLowerCase());
  const relayerPrivKey = RELAYER_PRIVKEY;

  if (!marketV2Addr || marketV2Addr === '0x0000000000000000000000000000000000000000') {
    console.log('[AnnotationIndexer] VITE_MARKET_V2_ADDRESS not set — indexer disabled.');
    return;
  }
  if (!relayerPrivKey) {
    console.log('[AnnotationIndexer] PRIVATE_KEY not set — indexer disabled.');
    return;
  }

  const provider           = new ethers.JsonRpcProvider(GALILEO_RPC, null, { staticNetwork: true });
  const relayerWallet      = new ethers.Wallet(relayerPrivKey, provider);
  const contract           = new ethers.Contract(marketV2Addr, MARKET_V2_ABI, provider);
  const contractWithSigner = contract.connect(relayerWallet);

  activeProvider = provider;
  activeContractWithSigner = contractWithSigner;

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

export function getTaskGroundTruth(database, jobId, taskId) {
  const row = database.prepare(
    `SELECT * FROM task_ground_truth WHERE job_id=? AND task_id=?`
  ).get(Number(jobId), Number(taskId));
  if (!row) return null;
  let groundTruth = [];
  try { groundTruth = JSON.parse(row.ground_truth_json || '[]'); } catch {}
  return { ...row, groundTruth };
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
    `SELECT * FROM annotator_stats WHERE LOWER(address) = LOWER(?)`
  ).get(address);

  const history = database.prepare(`
    SELECT * FROM annotation_submissions WHERE LOWER(annotator) = LOWER(?) ORDER BY submitted_at DESC LIMIT 50
  `).all(address);

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
