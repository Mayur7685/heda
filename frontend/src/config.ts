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
    annotationMarketV2: "0xCBbb84EB5740630B4654Fbf963a503d86E67b939",
    datasetRegistry:    "0x63988395140a19662B3C1dC13B0B64286B0c7cc5",
    modelRegistry:      "0xffc1A5A9a1bE52027142686079d8A78D9dBF4987",
    pipelineSubscription: "0x313BC8CA6b0aa5258b612715a3fda3e70C007260",
  },
} as const;

export const CONTRACTS = {
  MARKET_V2:  "0xCBbb84EB5740630B4654Fbf963a503d86E67b939" as `0x${string}`,
  DATASET_REGISTRY: "0x63988395140a19662B3C1dC13B0B64286B0c7cc5" as `0x${string}`,
  MODEL_REGISTRY:   "0xffc1A5A9a1bE52027142686079d8A78D9dBF4987" as `0x${string}`,
  SUBSCRIPTION:     "0x313BC8CA6b0aa5258b612715a3fda3e70C007260" as `0x${string}`,
};

export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
