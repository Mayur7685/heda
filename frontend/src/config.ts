// Single source of truth for all network config.
// Fill contract addresses after deploying with forge script.

export const GALILEO = {
  chainId: 16602,
  rpc: "https://evmrpc-testnet.0g.ai",
  storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
  explorer: "https://chainscan-galileo.0g.ai",
  storageExplorer: "https://storagescan-galileo.0g.ai",
  faucet: "https://faucet.0g.ai",
  contracts: {
    annotationMarket: import.meta.env.VITE_ANNOTATION_MARKET ?? "",
    datasetRegistry: import.meta.env.VITE_DATASET_REGISTRY ?? "",
  },
} as const;

export const COMPUTE_ROUTER = "https://router-api.0g.ai/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "Qwen2.5-0.5B-Instruct",
  "Qwen3-32B",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
