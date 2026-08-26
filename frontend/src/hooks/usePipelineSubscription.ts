import { useMemo } from "react";
import { ethers } from "ethers";
import { GALILEO } from "../config";

const SUBSCRIPTION_ABI = [
  "function subscribe() external payable",
  "function consumeTrainingQuota(address user) external returns (uint256 remainingQuota)",
  "function getRemainingQuota(address user) external view returns (uint256 remainingQuota, uint256 periodEnd, bool active)",
  "function subscriptionFee() external view returns (uint256)",
  "event Subscribed(address indexed user, uint256 periodStart, uint256 periodEnd)",
  "event QuotaConsumed(address indexed user, uint256 remainingQuota)"
];

export function usePipelineSubscription(signer: ethers.Signer | null) {
  return useMemo(() => {
    const address = GALILEO.contracts.pipelineSubscription;
    if (!address || address === "0x0000000000000000000000000000000000000000") return null;

    const providerOrSigner = signer ?? new ethers.JsonRpcProvider(GALILEO.rpc);
    const contract = new ethers.Contract(address, SUBSCRIPTION_ABI, providerOrSigner);

    return {
      address,

      async getRemainingQuota(userAddress: string) {
        const [remainingQuota, periodEnd, active] = await contract.getRemainingQuota(userAddress);
        return {
          remainingQuota: Number(remainingQuota),
          periodEnd: Number(periodEnd),
          active: Boolean(active)
        };
      },

      async getSubscriptionFee() {
        const fee = await contract.subscriptionFee();
        return ethers.formatEther(fee);
      },

      async subscribe(feeEth: string = "0.001") {
        if (!signer) throw new Error("Wallet not connected");
        const tx = await contract.subscribe({ value: ethers.parseEther(feeEth) });
        return await tx.wait();
      },

      async consumeTrainingQuota(userAddress: string) {
        if (!signer) throw new Error("Wallet not connected");
        const tx = await contract.consumeTrainingQuota(userAddress);
        return await tx.wait();
      }
    };
  }, [signer]);
}
