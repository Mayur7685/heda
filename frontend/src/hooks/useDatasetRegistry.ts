import { useMemo } from "react";
import { ethers } from "ethers";
import { GALILEO } from "../config";
import ABI from "../abis/DatasetRegistry.json";

export function useDatasetRegistry(signer: ethers.Signer | null) {
  return useMemo(() => {
    const rawAddr = GALILEO.contracts.datasetRegistry;
    if (!rawAddr || (rawAddr as string) === "0x0000000000000000000000000000000000000000") return null;
    const addr = ethers.getAddress((rawAddr as string).toLowerCase());

    const contract = new ethers.Contract(
      addr,
      ABI,
      signer
    );

    return {
      async publish(
        rootHash: string,
        metadataURI: string,
        priceEth: string,
        dataType: 0 | 1,
        sourceJobId: number
      ) {
        const tx = await contract.publish(
          rootHash, metadataURI, ethers.parseEther(priceEth), dataType, sourceJobId
        );
        return tx.wait();
      },

      async purchase(datasetId: number, priceEth: string) {
        const tx = await contract.purchase(datasetId, {
          value: ethers.parseEther(priceEth),
        });
        return tx.wait();
      },

      hasLicense: (datasetId: number, address: string) =>
        contract.hasLicense(datasetId, address),

      getDataset: (datasetId: number) => contract.getDataset(datasetId),
      totalDatasets: () => contract.totalDatasets(),

      async listDatasets() {
        try {
          const res = await fetch("http://localhost:3001/indexer/datasets");
          if (res.ok) {
            const indexed = await res.json();
            if (Array.isArray(indexed) && indexed.length > 0) return indexed;
          }
        } catch {
          // Fallback to RPC queryFilter if indexer server is offline
        }

        const filter = contract.filters.Published();
        const events = await contract.queryFilter(filter);
        return Promise.all(events.map(async (e: any) => {
          const d = await contract.getDataset(Number(e.args.datasetId));
          return {
            datasetId: Number(e.args.datasetId),
            publisher: e.args.publisher,
            rootHash: e.args.rootHash,
            price: ethers.formatEther(e.args.price),
            dataType: Number(e.args.dataType),
            txHash: e.transactionHash,
            metadataURI: d.metadataURI,
          };
        }));
      },
    };
  }, [signer]);
}
