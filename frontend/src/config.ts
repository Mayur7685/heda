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
    annotationMarketV2: "0x91D36c08C323e9e7C3Fb77D4802E152277f73fFe",
    datasetRegistry:    "0xb026c66388EaF015198b242E5c6ca00aF36A6E26",
    modelRegistry:      "0x6aD6537618dD2bF3B9cAe585E485Ff216AAb1c0C",
    pipelineSubscription: "0x3EE57E207D6A826f05b57101dcbA002fC1fCE6D1",
  },
} as const;

export const CONTRACTS = {
  MARKET_V2:  "0x91D36c08C323e9e7C3Fb77D4802E152277f73fFe" as `0x${string}`,
  DATASET_REGISTRY: "0xb026c66388EaF015198b242E5c6ca00aF36A6E26" as `0x${string}`,
  MODEL_REGISTRY:   "0x6aD6537618dD2bF3B9cAe585E485Ff216AAb1c0C" as `0x${string}`,
  SUBSCRIPTION:     "0x3EE57E207D6A826f05b57101dcbA002fC1fCE6D1" as `0x${string}`,
};

export const RELAYER_API_URL = import.meta.env.VITE_UPLOAD_API || import.meta.env.VITE_RELAYER_URL || "http://localhost:3001";
export const AI_SERVICE_API_URL = import.meta.env.VITE_AI_SERVICE_API || "http://localhost:8000";
export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
