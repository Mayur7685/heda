import { ethers } from "ethers";
import { GALILEO } from "../config";
import ABI from "../abis/AnnotationMarket.json";

export const DataType = { Image: 0, Text: 1 } as const;

export function useAnnotationMarket(signer: ethers.Signer | null) {
  if (!signer) return null;

  const contract = new ethers.Contract(
    GALILEO.contracts.annotationMarket,
    ABI,
    signer
  );

  return {
    async createJob(
      dataRootHash: string,
      metadataURI: string,
      rewardPerTaskEth: string,
      taskCount: number,
      dataType: 0 | 1
    ) {
      const reward = ethers.parseEther(rewardPerTaskEth);
      const total = reward * BigInt(taskCount);
      const tx = await contract.createJob(
        dataRootHash, metadataURI, reward, taskCount, dataType,
        { value: total }
      );
      return tx.wait();
    },

    async submitWork(jobId: number, taskId: number, annotationRootHash: string) {
      const tx = await contract.submitWork(jobId, taskId, annotationRootHash);
      return tx.wait();
    },

    async claimTask(jobId: number, taskId: number) {
      const tx = await contract.claimTask(jobId, taskId);
      return tx.wait();
    },

    isTaskAvailable: (jobId: number, taskId: number) =>
      contract.isTaskAvailable(jobId, taskId),

    async submitBatch(jobId: number, taskIds: number[], annotationRootHashes: string[]) {
      const tx = await contract.submitBatch(jobId, taskIds, annotationRootHashes);
      return tx.wait();
    },

    async approveWork(jobId: number, taskId: number) {
      const tx = await contract.approveWork(jobId, taskId);
      return tx.wait();
    },

    async rejectWork(jobId: number, taskId: number) {
      const tx = await contract.rejectWork(jobId, taskId);
      return tx.wait();
    },

    async closeJob(jobId: number) {
      const tx = await contract.closeJob(jobId);
      return tx.wait();
    },

    getJob: (jobId: number) => contract.getJob(jobId),
    getSubmission: (jobId: number, taskId: number) => contract.getSubmission(jobId, taskId),
    totalJobs: () => contract.totalJobs(),

    // Read all JobCreated events for the marketplace listing
    async listJobs() {
      const filter = contract.filters.JobCreated();
      const events = await contract.queryFilter(filter);
      return events.map((e: any) => ({
        jobId: Number(e.args.jobId),
        creator: e.args.creator,
        dataRootHash: e.args.dataRootHash,
        rewardPerTask: ethers.formatEther(e.args.rewardPerTask),
        taskCount: Number(e.args.taskCount),
        dataType: Number(e.args.dataType),
        txHash: e.transactionHash,
      }));
    },

    // Read WorkSubmitted events for a specific annotator
    async listMySubmissions(annotatorAddress: string) {
      const filter = contract.filters.WorkSubmitted(null, null, annotatorAddress);
      const events = await contract.queryFilter(filter);
      return events.map((e: any) => ({
        jobId: Number(e.args.jobId),
        taskId: Number(e.args.taskId),
        annotator: e.args.annotator,
        annotationRootHash: e.args.annotationRootHash,
        txHash: e.transactionHash,
      }));
    },
  };
}
