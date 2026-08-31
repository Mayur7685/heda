import { useMemo } from "react";
import { ethers } from "ethers";
import { GALILEO, RELAYER_API_URL } from "../config";
import ABI from "../abis/ModelRegistry.json";

export const ModelTypeNames = ["YOLOv8", "CLIP", "QwenFineTune", "SAM", "Other"] as const;

export function useModelRegistry(signer: ethers.Signer | null) {
  return useMemo(() => {
    const rawAddr = GALILEO.contracts.modelRegistry;
    if (!rawAddr || (rawAddr as string) === "0x0000000000000000000000000000000000000000") return null;
    const addr = ethers.getAddress((rawAddr as string).toLowerCase());

    const runner = signer || new ethers.JsonRpcProvider(GALILEO.rpc);

    const contract = new ethers.Contract(
      addr,
      ABI,
      runner
    );

    return {
      async publish(
        weightsRootHash: string,
        reportRootHash: string,
        metadataURI: string,
        priceEth: string,
        modelType: number,
        sourceDatasetId: number
      ) {
        const price = ethers.parseEther(priceEth);
        const tx = await contract.publish(
          weightsRootHash,
          reportRootHash || ethers.ZeroHash,
          metadataURI,
          price,
          modelType,
          sourceDatasetId
        );
        return tx.wait();
      },

      async purchase(modelId: number, priceEth: string) {
        const tx = await contract.purchase(modelId, {
          value: ethers.parseEther(priceEth),
        });
        return tx.wait();
      },

      async setInferenceEndpoint(modelId: number, endpoint: string) {
        const tx = await contract.setInferenceEndpoint(modelId, endpoint);
        return tx.wait();
      },

      hasLicense: (modelId: number, address: string) =>
        contract.hasLicense(modelId, address),

      getModel: (modelId: number) => contract.getModel(modelId),
      totalModels: () => contract.totalModels(),

      async listModels() {
        try {
          const res = await fetch(`${RELAYER_API_URL}/indexer/models`);
          if (res.ok) {
            const indexed = await res.json();
            if (Array.isArray(indexed) && indexed.length > 0) return indexed;
          }
        } catch {
          // Fallback to RPC queryFilter if indexer server is offline
        }

        const filter = contract.filters.ModelPublished();
        const events = await contract.queryFilter(filter);
        return Promise.all(
          events.map(async (e: any) => {
            const m = await contract.getModel(Number(e.args.modelId));
            return {
              modelId: Number(e.args.modelId),
              publisher: e.args.publisher,
              weightsRootHash: e.args.weightsRootHash,
              reportRootHash: m.reportRootHash,
              metadataURI: m.metadataURI,
              price: ethers.formatEther(m.price),
              modelType: Number(m.modelType),
              sourceDatasetId: Number(m.sourceDatasetId),
              downloadCount: Number(m.downloadCount),
              inferenceEndpoint: m.inferenceEndpoint,
              txHash: e.transactionHash,
            };
          })
        );
      },
    };
  }, [signer]);
}
