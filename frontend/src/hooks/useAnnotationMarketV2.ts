/**
 * useAnnotationMarketV2 — React hook for AnnotationMarketV2.sol
 *
 * Key changes from V1:
 * - No claimTask() — submission is completely open
 * - createJob() takes maxAnnotatorsPerTask (1-5) parameter
 * - triggerEvaluation() for manual creator override
 * - distributeRewards() / approveWork() removed from frontend — handled by backend relayer only
 * - getTaskSubmissions() returns an array (multi-annotator) instead of a single struct
 */
import { useMemo }   from 'react';
import { ethers }    from 'ethers';
import { GALILEO, RELAYER_API_URL } from '../config';

// ── Minimal ABI (all functions needed by frontend) ────────────────────────────
const V2_ABI = [
  // Mutating
  'function createJob(bytes32 dataRootHash, string metadataURI, uint256 rewardPerTask, uint256 taskCount, uint8 maxAnnotatorsPerTask, uint8 dataType) payable returns (uint256)',
  'function submitWork(uint256 jobId, uint256 taskId, bytes32 annotationRootHash) external',
  'function submitWorkBatch(uint256 jobId, uint256[] taskIds, bytes32[] annotationRootHashes) external',
  'function triggerEvaluation(uint256 jobId, uint256 taskId) external',
  'function distributeRewards(uint256 jobId, uint256 taskId, address[] annotators, uint256[] sharesBps) external',
  'function distributeRewardsBatch(uint256 jobId, uint256[] taskIds, address[][] annotatorsList, uint256[][] sharesBpsList) external',
  'function closeJob(uint256 jobId) external',

  // View
  'function getJob(uint256 jobId) view returns (tuple(address creator, bytes32 dataRootHash, string metadataURI, uint256 rewardPerTask, uint256 taskCount, uint8 maxAnnotatorsPerTask, uint256 approvedTaskCount, uint8 dataType, bool active))',
  'function getTaskSubmissions(uint256 jobId, uint256 taskId) view returns (tuple(address annotator, bytes32 annotationRootHash, uint256 timestamp, bool rewarded)[])',
  'function getSubmissionCount(uint256 jobId, uint256 taskId) view returns (uint256)',
  'function hasAnnotatorSubmitted(uint256 jobId, uint256 taskId, address annotator) view returns (bool)',
  'function totalJobs() view returns (uint256)',

  // Events
  'event JobCreated(uint256 indexed jobId, address indexed creator, bytes32 dataRootHash, uint256 rewardPerTask, uint256 taskCount, uint8 maxAnnotators, uint8 dataType)',
  'event WorkSubmitted(uint256 indexed jobId, uint256 indexed taskId, address indexed annotator, bytes32 annotationRootHash, uint256 slotIndex)',
  'event EvaluationTriggered(uint256 indexed jobId, uint256 indexed taskId, address triggeredBy)',
  'function resetTask(uint256 jobId, uint256 taskId) external',
  'event TaskReset(uint256 indexed jobId, uint256 indexed taskId, uint256 failedSubmissions)',
];

export const DataTypeV2 = { Image: 0, Text: 1 } as const;

export type TaskSubmission = {
  annotator:           string;
  annotationRootHash:  string;
  timestamp:           number;
  rewarded:            boolean;
};

export type JobV2 = {
  creator:               string;
  dataRootHash:          string;
  metadataURI:           string;
  rewardPerTask:         bigint;
  taskCount:             number;
  maxAnnotatorsPerTask:  number;
  approvedTaskCount:     number;
  dataType:              number;
  active:                boolean;
};

export function useAnnotationMarketV2(signer: ethers.Signer | null) {
  return useMemo(() => {
    const rawAddr = GALILEO.contracts.annotationMarketV2;

    // Guard: return null if V2 not yet deployed (placeholder address)
    if (!rawAddr || (rawAddr as string) === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    const addr = ethers.getAddress((rawAddr as string).toLowerCase());
    const provider = new ethers.JsonRpcProvider(GALILEO.rpc);
    const contract = new ethers.Contract(addr, V2_ABI, signer ?? provider);

    return {
      // ── Write Operations ────────────────────────────────────────

      /**
       * Create a new annotation job.
       * @param dataRootHash         0G Storage root hash of raw images
       * @param metadataURI          0G Storage root hash of metadata JSON
       * @param rewardPerTaskEth     ETH per task (as string, e.g. "0.01")
       * @param taskCount            Number of tasks
       * @param maxAnnotatorsPerTask 1–5 (default 5)
       * @param dataType             0=Image, 1=Text
       */
      async createJob(
        dataRootHash:         string,
        metadataURI:          string,
        rewardPerTaskEth:     string,
        taskCount:            number,
        maxAnnotatorsPerTask: number,
        dataType:             0 | 1
      ) {
        const reward = ethers.parseEther(rewardPerTaskEth);
        const total  = reward * BigInt(taskCount);
        const tx = await contract.createJob(
          dataRootHash,
          metadataURI,
          reward,
          taskCount,
          maxAnnotatorsPerTask,
          dataType,
          { value: total }
        );
        return tx.wait();
      },

      /**
       * Submit annotation for a task. No claim required — fully open.
       * Reverts if wallet already submitted for this task or slots are full.
       */
      async submitWork(jobId: number, taskId: number, annotationRootHash: string) {
        const tx = await contract.submitWork(jobId, taskId, annotationRootHash);
        return tx.wait();
      },

      /**
       * Submit batch annotations for multiple tasks in 1 single transaction & signature.
       */
      async submitWorkBatch(jobId: number, taskIds: number[], annotationRootHashes: string[]) {
        const tx = await contract.submitWorkBatch(jobId, taskIds, annotationRootHashes);
        return tx.wait();
      },

      /**
       * Creator manually requests early evaluation before all slots fill.
       * Backend relayer picks up the EvaluationTriggered event and scores immediately.
       */
      async triggerEvaluation(jobId: number, taskId: number) {
        const tx = await contract.triggerEvaluation(jobId, taskId);
        return tx.wait();
      },

      /**
       * Creator manual override: distribute custom reward split onchain.
       */
      async distributeRewards(jobId: number, taskId: number, annotators: string[], sharesBps: number[]) {
        const tx = await contract.distributeRewards(jobId, taskId, annotators, sharesBps);
        return tx.wait();
      },

      /**
       * Creator manual override batch: distribute custom reward splits for multiple tasks in 1 single transaction & signature.
       */
      async distributeRewardsBatch(jobId: number, taskIds: number[], annotatorsList: string[][], sharesBpsList: number[][]) {
        const tx = await contract.distributeRewardsBatch(jobId, taskIds, annotatorsList, sharesBpsList);
        return tx.wait();
      },

      /**
       * Creator closes job early and reclaims unspent ETH from unrewarded tasks.
       */
      async closeJob(jobId: number) {
        const tx = await contract.closeJob(jobId);
        return tx.wait();
      },

      // ── Read Operations ─────────────────────────────────────────

      getJob: async (jobId: number) => {
        const raw = await contract.getJob(jobId);
        return {
          creator:              raw.creator,
          dataRootHash:         raw.dataRootHash,
          metadataURI:          raw.metadataURI,
          rewardPerTask:        ethers.formatEther(raw.rewardPerTask),
          taskCount:            Number(raw.taskCount),
          maxAnnotatorsPerTask: Number(raw.maxAnnotatorsPerTask),
          approvedTaskCount:    Number(raw.approvedTaskCount),
          dataType:             Number(raw.dataType),
          active:               Boolean(raw.active),
        };
      },

      getTaskSubmissions: (jobId: number, taskId: number): Promise<TaskSubmission[]> =>
        contract.getTaskSubmissions(jobId, taskId),

      getSubmissionCount: (jobId: number, taskId: number): Promise<number> =>
        contract.getSubmissionCount(jobId, taskId).then(Number),

      hasAnnotatorSubmitted: (jobId: number, taskId: number, annotator: string): Promise<boolean> =>
        contract.hasAnnotatorSubmitted(jobId, taskId, annotator),

      totalJobs: (): Promise<number> =>
        contract.totalJobs().then(Number),

      // ── Event Queries ───────────────────────────────────────────

      /** List all jobs via indexer API with RPC fallback */
      async listJobs() {
        try {
          // Using REST leaderboard endpoint via getLeaderboard() method below
          // Use /indexer/jobs if we add V2 events to the main indexer in future
        } catch {}

        // RPC fallback
        const filter = contract.filters.JobCreated();
        const events = await contract.queryFilter(filter);
        return events.map((e: any) => ({
          jobId:                Number(e.args.jobId),
          creator:              e.args.creator,
          dataRootHash:         e.args.dataRootHash,
          rewardPerTask:        ethers.formatEther(e.args.rewardPerTask),
          taskCount:            Number(e.args.taskCount),
          maxAnnotatorsPerTask: Number(e.args.maxAnnotators),
          dataType:             Number(e.args.dataType),
          txHash:               e.transactionHash,
        }));
      },

      /** List submissions by a specific annotator on-chain */
      async listMySubmissions(annotatorAddress: string) {
        try {
          const filter = contract.filters.WorkSubmitted(null, null, annotatorAddress);
          const events = await contract.queryFilter(filter);
          return events.map((e: any) => ({
            jobId: Number(e.args.jobId),
            taskId: Number(e.args.taskId),
            annotator: e.args.annotator,
            annotationRootHash: e.args.annotationRootHash,
            slotIndex: Number(e.args.slotIndex),
            txHash: e.transactionHash,
          }));
        } catch {
          return [];
        }
      },

      /** Fetch task submission count from annotation indexer REST API */
      async getTaskStatus(jobId: number, taskId: number) {
        try {
          const res = await fetch(`${RELAYER_API_URL}/annotations/task/${jobId}/${taskId}`);
          if (res.ok) return await res.json();
        } catch {}
        // Fallback to on-chain
        const count = await contract.getSubmissionCount(jobId, taskId).then(Number);
        return { submissionCount: count, submissions: [] };
      },

      /** Fetch annotator quality stats from REST API */
      async getAnnotatorStats(address: string) {
        try {
          const res = await fetch(`${RELAYER_API_URL}/annotations/annotator/${address}`);
          if (res.ok) return await res.json();
        } catch {}
        return null;
      },

      /** Fetch leaderboard from REST API */
      async getLeaderboard() {
        try {
          const res = await fetch(`${RELAYER_API_URL}/annotations/leaderboard`);
          if (res.ok) return await res.json();
        } catch {}
        return { leaderboard: [] };
      },


      /** POST manual evaluate trigger to relayer REST API */
      async requestEvaluation(jobId: number, taskId: number) {
        const res = await fetch(`${RELAYER_API_URL}/annotations/evaluate`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ jobId, taskId }),
        });
        return res.json();
      },
    };
  }, [signer]);
}
