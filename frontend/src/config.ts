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
    annotationMarket: import.meta.env.VITE_MARKET_ADDRESS ?? "0x993Ab9D8d254cCe045F00A642CCDE21145a77C2B",
    datasetRegistry:  import.meta.env.VITE_DATASET_REGISTRY_ADDRESS ?? "0x94353b3BDF015346802bc965e1FF807c09222Ede",
    modelRegistry:    import.meta.env.VITE_MODEL_REGISTRY_ADDRESS ?? "0xa3Eb0cfb5472944770142F4CB27Dd516DbC4c126",
    pipelineSubscription: import.meta.env.VITE_PIPELINE_SUBSCRIPTION_ADDRESS ?? "0x9d7dcFAA625a1622C4042E2Eb9978c34F5BA7EDF",
  },
} as const;


export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
