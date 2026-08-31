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
    annotationMarketV2:   "0xA93b5bB49Ef86ceB8Cb06d06e984bAaf25683Ff0",
    datasetRegistry:      "0x22eBC4856744a628d19992d12304C951c7F5E1aD",
    modelRegistry:        "0xed6Ba6EC7c9ada63e0b37f97a4cA36042E3D6698",
    pipelineSubscription: "0x6952ec1f73626BdBF7BD8C549589710b25cfE622",
    deviceRegistry:       "0xae5f90a24513ca825a30C66aA279f5f363bdbbAb",
  },
} as const;

export const CONTRACTS = {
  MARKET_V2:  "0xA93b5bB49Ef86ceB8Cb06d06e984bAaf25683Ff0" as `0x${string}`,
  DATASET_REGISTRY: "0x22eBC4856744a628d19992d12304C951c7F5E1aD" as `0x${string}`,
  MODEL_REGISTRY:   "0xed6Ba6EC7c9ada63e0b37f97a4cA36042E3D6698" as `0x${string}`,
  SUBSCRIPTION:     "0x6952ec1f73626BdBF7BD8C549589710b25cfE622" as `0x${string}`,
  DEVICE_REGISTRY:  "0xae5f90a24513ca825a30C66aA279f5f363bdbbAb" as `0x${string}`,
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
