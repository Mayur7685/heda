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
    annotationMarket: import.meta.env.VITE_ANNOTATION_MARKET || "0x4d0E12D93c3EE2fe301F9F43Eb6b6ce50d098a39",
    datasetRegistry: import.meta.env.VITE_DATASET_REGISTRY || "0x4f7Ffd227E3EB49BE79c89c02dFD67F0D04B9068",
    modelRegistry: import.meta.env.VITE_MODEL_REGISTRY || "0x707De61B03948Ac28AA8175aa88AdE582c57c1b9",
  },
} as const;


export const COMPUTE_ROUTER = "https://router-api.0g.ai/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "Qwen2.5-0.5B-Instruct",
  "Qwen3-32B",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
