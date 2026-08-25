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
    annotationMarket: import.meta.env.VITE_ANNOTATION_MARKET || "0x4822c5F0617665543B94a0668837CdbBDEb54C90",
    datasetRegistry: import.meta.env.VITE_DATASET_REGISTRY || "0x46d4a89e496f3A01785ac5B38ecAc40B081c933c",
    modelRegistry: import.meta.env.VITE_MODEL_REGISTRY || "0x10840B8F0cb9ee5Fa30fa13979e7ddf4D57891a4",
  },
} as const;


export const COMPUTE_ROUTER = "https://router-api.0g.ai/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "Qwen2.5-0.5B-Instruct",
  "Qwen3-32B",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
