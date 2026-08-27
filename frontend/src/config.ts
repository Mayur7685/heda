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
    annotationMarket: "0x999C386123c7BD76754756335C254b82EB51efe8",
    datasetRegistry:  "0xd22C7e9109E2fc4712eA990d100166834a2067A0",
    modelRegistry:    "0xB828cfd2e57d2594Cbe54fE293991e48f6B5fbA7",
    pipelineSubscription: "0x0b52211F340aB9cd867be80ec9Fc2B45861229Ac",
  },
} as const;

export const CONTRACTS = {
  MARKET: "0x999C386123c7BD76754756335C254b82EB51efe8" as `0x${string}`,
  DATASET_REGISTRY: "0xd22C7e9109E2fc4712eA990d100166834a2067A0" as `0x${string}`,
  MODEL_REGISTRY: "0xB828cfd2e57d2594Cbe54fE293991e48f6B5fbA7" as `0x${string}`,
  SUBSCRIPTION: "0x0b52211F340aB9cd867be80ec9Fc2B45861229Ac" as `0x${string}`,
};

export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
