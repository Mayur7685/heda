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
    annotationMarket: "0x0577d4422B9065E2C8B7A29794DD176601Cf2c19",
    datasetRegistry:  "0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c",
    modelRegistry:    "0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D",
    pipelineSubscription: "0x07231896B7dF2F51E6a56A6118850b43522E8f44",
  },
} as const;

export const CONTRACTS = {
  MARKET: "0x0577d4422B9065E2C8B7A29794DD176601Cf2c19" as `0x${string}`,
  DATASET_REGISTRY: "0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c" as `0x${string}`,
  MODEL_REGISTRY: "0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D" as `0x${string}`,
  SUBSCRIPTION: "0x07231896B7dF2F51E6a56A6118850b43522E8f44" as `0x${string}`,
};

export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
