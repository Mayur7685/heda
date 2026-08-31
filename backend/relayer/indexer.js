import Database from 'better-sqlite3';
import { ethers } from 'ethers';
import path from 'path';

const GALILEO_RPC = process.env.GALILEO_RPC || 'https://evmrpc-testnet.0g.ai';

const ANNOTATION_MARKET_V2_ADDR = ethers.getAddress((process.env.VITE_MARKET_V2_ADDRESS || '0xA93b5bB49Ef86ceB8Cb06d06e984bAaf25683Ff0').toLowerCase());
const DATASET_REGISTRY_ADDR     = ethers.getAddress((process.env.VITE_DATASET_REGISTRY_ADDRESS || '0x22eBC4856744a628d19992d12304C951c7F5E1aD').toLowerCase());
const MODEL_REGISTRY_ADDR       = ethers.getAddress((process.env.VITE_MODEL_REGISTRY_ADDRESS || '0xed6Ba6EC7c9ada63e0b37f97a4cA36042E3D6698').toLowerCase());

// Minimal ABIs for event indexing

const MARKET_V2_ABI = [
  'event JobCreated(uint256 indexed jobId, address indexed creator, bytes32 dataRootHash, uint256 rewardPerTask, uint256 taskCount, uint8 maxAnnotators, uint8 dataType)',
  'function getJob(uint256 jobId) external view returns (tuple(address creator, bytes32 dataRootHash, string metadataURI, uint256 rewardPerTask, uint256 taskCount, uint8 maxAnnotatorsPerTask, uint256 approvedTaskCount, uint8 dataType, bool active))',
  'event TaskReset(uint256 indexed jobId, uint256 indexed taskId, uint256 failedSubmissions)',
];

const DATASET_ABI = [
  'event Published(uint256 indexed datasetId, address indexed publisher, bytes32 rootHash, uint256 price, uint8 dataType)',
  'function datasets(uint256 datasetId) external view returns (address publisher, bytes32 rootHash, string metadataURI, uint256 price, uint8 dataType, uint256 sourceJobId, bool exists)',
];

const MODEL_ABI = [
  'event ModelPublished(uint256 indexed modelId, address indexed publisher, bytes32 weightsRootHash, uint8 modelType)',
  'function models(uint256 modelId) external view returns (address publisher, bytes32 weightsRootHash, bytes32 reportRootHash, string metadataURI, uint256 price, uint8 modelType, uint256 sourceDatasetId, bool exists, uint256 downloadCount, string inferenceEndpoint)',
];

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'indexer.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS indexer_state (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    job_id INTEGER PRIMARY KEY,
    creator TEXT NOT NULL,
    data_root_hash TEXT NOT NULL,
    metadata_uri TEXT,
    reward_per_task TEXT NOT NULL,
    task_count INTEGER NOT NULL,
    data_type INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS datasets (
    dataset_id INTEGER PRIMARY KEY,
    publisher TEXT NOT NULL,
    root_hash TEXT NOT NULL,
    metadata_uri TEXT,
    price TEXT NOT NULL,
    data_type INTEGER NOT NULL,
    source_job_id INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS models (
    model_id INTEGER PRIMARY KEY,
    publisher TEXT NOT NULL,
    weights_root_hash TEXT NOT NULL,
    report_root_hash TEXT,
    metadata_uri TEXT,
    price TEXT NOT NULL,
    model_type INTEGER NOT NULL,
    source_dataset_id INTEGER NOT NULL,
    download_count INTEGER DEFAULT 0,
    inference_endpoint TEXT,
    tx_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

// Prepared statements for fast queries
const stmtSetState = db.prepare('INSERT OR REPLACE INTO indexer_state (key, value) VALUES (?, ?)');
const stmtGetState = db.prepare('SELECT value FROM indexer_state WHERE key = ?');

const stmtUpsertJob = db.prepare(`
  INSERT OR REPLACE INTO jobs (job_id, creator, data_root_hash, metadata_uri, reward_per_task, task_count, data_type, tx_hash, block_number, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const stmtUpsertDataset = db.prepare(`
  INSERT OR REPLACE INTO datasets (dataset_id, publisher, root_hash, metadata_uri, price, data_type, source_job_id, tx_hash, block_number, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const stmtUpsertModel = db.prepare(`
  INSERT OR REPLACE INTO models (model_id, publisher, weights_root_hash, report_root_hash, metadata_uri, price, model_type, source_dataset_id, download_count, inference_endpoint, tx_hash, block_number, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let isSyncing = false;

export async function syncEvents() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const provider = new ethers.JsonRpcProvider(GALILEO_RPC);
    const latestBlock = await provider.getBlockNumber();

    const defaultStartBlock = Number(process.env.START_BLOCK || 52184500);
    const storedLastBlock = stmtGetState.get('last_indexed_block')?.value;
    let fromBlock = storedLastBlock ? parseInt(storedLastBlock, 10) + 1 : defaultStartBlock;

    if (fromBlock > latestBlock) {
      isSyncing = false;
      return;
    }

    // Limit block chunk size to 10000 blocks to prevent RPC timeouts
    const toBlock = Math.min(latestBlock, fromBlock + 9999);

    const marketV2Contract = new ethers.Contract(ANNOTATION_MARKET_V2_ADDR, MARKET_V2_ABI, provider);
    const datasetContract  = new ethers.Contract(DATASET_REGISTRY_ADDR, DATASET_ABI, provider);
    const modelContract    = new ethers.Contract(MODEL_REGISTRY_ADDR, MODEL_ABI, provider);

    // 1b. Sync Jobs (V2)
    if (marketV2Contract) {
      try {
        const v2JobLogs = await marketV2Contract.queryFilter(marketV2Contract.filters.JobCreated(), fromBlock, toBlock);
        for (const log of v2JobLogs) {
          const jobId = Number(log.args.jobId);
          const creator = log.args.creator;
          const dataRootHash = log.args.dataRootHash;
          const rewardPerTask = ethers.formatEther(log.args.rewardPerTask);
          const taskCount = Number(log.args.taskCount);
          const dataType = Number(log.args.dataType);

          let metadataURI = '';
          try {
            const jobObj = await marketV2Contract.getJob(jobId);
            metadataURI = jobObj.metadataURI;
          } catch {}

          stmtUpsertJob.run(
            jobId, creator, dataRootHash, metadataURI, rewardPerTask, taskCount, dataType, log.transactionHash, log.blockNumber, Date.now()
          );
        }
      } catch (e) {
        console.warn('[Indexer] V2 Job log fetch note:', e.message);
      }
    }

    // 2. Sync Datasets
    try {
      const dsLogs = await datasetContract.queryFilter(datasetContract.filters.Published(), fromBlock, toBlock);
      for (const log of dsLogs) {
        const datasetId = Number(log.args.datasetId);
        const publisher = log.args.publisher;
        const rootHash = log.args.rootHash;
        const price = ethers.formatEther(log.args.price);
        const dataType = Number(log.args.dataType);
        let metadataURI = '', sourceJobId = 0;
        try {
          const dsObj = await datasetContract.datasets(datasetId);
          metadataURI = dsObj.metadataURI;
          sourceJobId = Number(dsObj.sourceJobId);
        } catch {}

        stmtUpsertDataset.run(
          datasetId, publisher, rootHash, metadataURI, price, dataType, sourceJobId, log.transactionHash, log.blockNumber, Date.now()
        );
      }
    } catch (e) {
      console.warn('[Indexer] Dataset log fetch note:', e.message);
    }

    // 3. Sync Models
    try {
      const modelLogs = await modelContract.queryFilter(modelContract.filters.ModelPublished(), fromBlock, toBlock);
      for (const log of modelLogs) {
        const modelId = Number(log.args.modelId);
        const publisher = log.args.publisher;
        const weightsRootHash = log.args.weightsRootHash;
        const modelType = Number(log.args.modelType);

        let reportRootHash = '', metadataURI = '', price = '0', sourceDatasetId = 0, downloadCount = 0, inferenceEndpoint = '';
        try {
          const mObj = await modelContract.models(modelId);
          reportRootHash = mObj.reportRootHash;
          metadataURI = mObj.metadataURI;
          price = ethers.formatEther(mObj.price);
          sourceDatasetId = Number(mObj.sourceDatasetId);
          downloadCount = Number(mObj.downloadCount);
          inferenceEndpoint = mObj.inferenceEndpoint;
        } catch {}

        stmtUpsertModel.run(
          modelId, publisher, weightsRootHash, reportRootHash, metadataURI, price, modelType, sourceDatasetId, downloadCount, inferenceEndpoint, log.transactionHash, log.blockNumber, Date.now()
        );
      }
    } catch (e) {
      console.warn('[Indexer] Model log fetch note:', e.message);
    }

    stmtSetState.run('last_indexed_block', toBlock.toString());
    stmtSetState.run('last_sync_time', Date.now().toString());

    const jobsCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
    const datasetsCount = db.prepare('SELECT COUNT(*) as count FROM datasets').get().count;
    const modelsCount = db.prepare('SELECT COUNT(*) as count FROM models').get().count;
    console.log(`[Indexer] ⚡ Synced block range ${fromBlock}..${toBlock} (${jobsCount} jobs, ${datasetsCount} datasets, ${modelsCount} models)`);
  } catch (err) {
    console.error('[Indexer] Sync error:', err.message);
  } finally {
    isSyncing = false;
  }
}

// Start background sync timer (runs every 12s)
export function startIndexer() {
  console.log('⚡ Lightweight SQLite Event Indexer initialized');
  syncEvents();
  setInterval(syncEvents, 12_000);
}

// Data Getters for Express REST endpoints
export function getIndexedJobs() {
  return db.prepare('SELECT * FROM jobs ORDER BY job_id DESC').all().map((r) => ({
    jobId: r.job_id,
    creator: r.creator,
    dataRootHash: r.data_root_hash,
    metadataURI: r.metadata_uri,
    rewardPerTask: r.reward_per_task,
    taskCount: r.task_count,
    dataType: r.data_type,
    txHash: r.tx_hash,
    blockNumber: r.block_number,
  }));
}

export function getIndexedDatasets() {
  return db.prepare('SELECT * FROM datasets ORDER BY dataset_id DESC').all().map((r) => ({
    datasetId: r.dataset_id,
    publisher: r.publisher,
    rootHash: r.root_hash,
    metadataURI: r.metadata_uri,
    price: r.price,
    dataType: r.data_type,
    sourceJobId: r.source_job_id,
    txHash: r.tx_hash,
    blockNumber: r.block_number,
  }));
}

export function getIndexedModels() {
  return db.prepare('SELECT * FROM models ORDER BY model_id DESC').all().map((r) => ({
    modelId: r.model_id,
    publisher: r.publisher,
    weightsRootHash: r.weights_root_hash,
    reportRootHash: r.report_root_hash,
    metadataURI: r.metadata_uri,
    price: r.price,
    modelType: r.model_type,
    sourceDatasetId: r.source_dataset_id,
    downloadCount: r.download_count,
    inferenceEndpoint: r.inference_endpoint,
    txHash: r.tx_hash,
    blockNumber: r.block_number,
  }));
}

export function getIndexerStatus() {
  const lastBlock = stmtGetState.get('last_indexed_block')?.value ?? '0';
  const lastSync = stmtGetState.get('last_sync_time')?.value ?? '0';
  return {
    status: 'online',
    lastIndexedBlock: parseInt(lastBlock, 10),
    lastSyncTimestamp: parseInt(lastSync, 10),
    jobsCount: db.prepare('SELECT COUNT(*) as count FROM jobs').get().count,
    datasetsCount: db.prepare('SELECT COUNT(*) as count FROM datasets').get().count,
    modelsCount: db.prepare('SELECT COUNT(*) as count FROM models').get().count,
  };
}
