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
    annotationMarket:   "0x4B791da8eD9C4d3b1812b51F63359c1f3AeB8C0A",
    annotationMarketV2: "0x401fBd48959DC36cab4ddd5898952dCcCdf004f2",
    datasetRegistry:    "0x4AC6935DE58CeB54f2152a984ae5C597be9eFA5d",
    modelRegistry:      "0x86758906B8f2b3AFffe10aAC7fD1257647F9166e",
    pipelineSubscription: "0xdEF5D5C9DA844C56dd3D59481B5d1265E7101403",
  },
} as const;

export const CONTRACTS = {
  MARKET:     "0x4B791da8eD9C4d3b1812b51F63359c1f3AeB8C0A" as `0x${string}`,
  MARKET_V2:  "0x401fBd48959DC36cab4ddd5898952dCcCdf004f2" as `0x${string}`,
  DATASET_REGISTRY: "0x4AC6935DE58CeB54f2152a984ae5C597be9eFA5d" as `0x${string}`,
  MODEL_REGISTRY:   "0x86758906B8f2b3AFffe10aAC7fD1257647F9166e" as `0x${string}`,
  SUBSCRIPTION:     "0xdEF5D5C9DA844C56dd3D59481B5d1265E7101403" as `0x${string}`,
};

export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
