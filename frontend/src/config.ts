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
    annotationMarket: import.meta.env.VITE_MARKET_ADDRESS ?? "0x83281b1a16DbA12ACC983e47FdbFD682Fd2A3F48",
    datasetRegistry:  import.meta.env.VITE_DATASET_REGISTRY_ADDRESS ?? "0xE0F020329C1c968f44B72360e45FA2EB9F35e96E",
    modelRegistry:    import.meta.env.VITE_MODEL_REGISTRY_ADDRESS ?? "0x91A033BDEb12c335DacA8Ed3c7A52cf780aF75D3",
    pipelineSubscription: import.meta.env.VITE_PIPELINE_SUBSCRIPTION_ADDRESS ?? "0x80CBFA451F1E83a9DE9536e1CD0bd85406017FD6",
  },
} as const;


export const COMPUTE_ROUTER = "https://router-api-testnet.integratenetwork.work/v1";

export const SUPPORTED_FINETUNE_MODELS = [
  "qwen2.5-omni",
  "Qwen2.5-0.5B-Instruct",
] as const;

export type FineTuneModel = (typeof SUPPORTED_FINETUNE_MODELS)[number];
