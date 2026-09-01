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
    annotationMarketV2:   "0x5b3C320AD51e062b4F93E739470D2dfB7FF4071C",
    datasetRegistry:      "0x8306ef2dfA1713c8053ae85e91a3319509F4fb9F",
    modelRegistry:        "0xaf4675D76a6B19F09b2c6e56Ab387Edb61d5DC78",
    pipelineSubscription: "0x65f2af3CFfcF3e955dC0e93fd598dff93981bC63",
    deviceRegistry:       "0x5abD3a8206528c8Bc0a504fF9413B905ce755af7",
  },
} as const;

export const CONTRACTS = {
  MARKET_V2:  "0x5b3C320AD51e062b4F93E739470D2dfB7FF4071C" as `0x${string}`,
  DATASET_REGISTRY: "0x8306ef2dfA1713c8053ae85e91a3319509F4fb9F" as `0x${string}`,
  MODEL_REGISTRY:   "0xaf4675D76a6B19F09b2c6e56Ab387Edb61d5DC78" as `0x${string}`,
  SUBSCRIPTION:     "0x65f2af3CFfcF3e955dC0e93fd598dff93981bC63" as `0x${string}`,
  DEVICE_REGISTRY:  "0x5abD3a8206528c8Bc0a504fF9413B905ce755af7" as `0x${string}`,
};

export const RELAYER_API_URL = import.meta.env.VITE_UPLOAD_API || import.meta.env.VITE_RELAYER_URL || "http://localhost:3001";
export const INGEST_API_URL = import.meta.env.VITE_INGEST_API || "http://localhost:3002";
export const AI_SERVICE_API_URL = import.meta.env.VITE_AI_SERVICE_API || "http://localhost:8000";
export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
