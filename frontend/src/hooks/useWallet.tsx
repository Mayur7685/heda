import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ethers } from "ethers";
import { galileo } from "../wagmi";
import { GALILEO } from "../config";

type WalletCtx = {
  signer: ethers.Signer | null;
  address: string | null;
  chainId: number | null;
  isCorrectChain: boolean;
  connect: () => void;
  switchToGalileo: () => void;
  error: string | null;
};

const WalletContext = createContext<WalletCtx>({
  signer: null, address: null, chainId: null, isCorrectChain: false,
  connect: () => {}, switchToGalileo: () => {}, error: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();
  const { switchChain } = useSwitchChain();
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [error] = useState<string | null>(null);

  const isCorrectChain = chainId === GALILEO.chainId;

  // Convert wagmi walletClient → ethers Signer
  useEffect(() => {
    if (!walletClient || !isConnected) { setSigner(null); return; }
    // walletClient is viem — wrap with ethers BrowserProvider via window.ethereum
    if (typeof window !== "undefined" && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      provider.getSigner().then(setSigner).catch(() => setSigner(null));
    }
  }, [walletClient, isConnected, chainId]);

  const connect = () => openConnectModal?.();
  const switchToGalileo = () => switchChain({ chainId: galileo.id });

  return (
    <WalletContext.Provider value={{
      signer,
      address: address ?? null,
      chainId: chainId ?? null,
      isCorrectChain,
      connect,
      switchToGalileo,
      error,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
