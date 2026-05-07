import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ethers } from "ethers";
import { GALILEO } from "../config";

declare global {
  interface Window { ethereum?: any; }
}

type WalletCtx = {
  signer: ethers.Signer | null;
  address: string | null;
  chainId: number | null;
  isCorrectChain: boolean;
  connect: () => Promise<void>;
  switchToGalileo: () => Promise<void>;
  error: string | null;
};

const WalletContext = createContext<WalletCtx>({
  signer: null, address: null, chainId: null, isCorrectChain: false,
  connect: async () => {}, switchToGalileo: async () => {}, error: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCorrectChain = chainId === GALILEO.chainId;

  async function connect() {
    if (!window.ethereum) { setError("MetaMask not found."); return; }
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const s = await provider.getSigner();
      const network = await provider.getNetwork();
      setSigner(s);
      setAddress(await s.getAddress());
      setChainId(Number(network.chainId));
      setError(null);
    } catch (e: any) { setError(e.message); }
  }

  async function switchToGalileo() {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${GALILEO.chainId.toString(16)}` }] });
    } catch (e: any) {
      if (e.code === 4902) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: `0x${GALILEO.chainId.toString(16)}`, chainName: "0G-Galileo-Testnet", nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 }, rpcUrls: [GALILEO.rpc], blockExplorerUrls: [GALILEO.explorer] }] });
      }
    }
  }

  // Auto-reconnect if already connected
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts.length > 0) connect();
    });
    const handleChainChange = (hex: string) => setChainId(parseInt(hex, 16));
    const handleAccountsChange = (accounts: string[]) => {
      if (accounts.length === 0) { setSigner(null); setAddress(null); setChainId(null); }
      else connect();
    };
    window.ethereum.on("chainChanged", handleChainChange);
    window.ethereum.on("accountsChanged", handleAccountsChange);
    return () => {
      window.ethereum?.removeListener("chainChanged", handleChainChange);
      window.ethereum?.removeListener("accountsChanged", handleAccountsChange);
    };
  }, []);

  return (
    <WalletContext.Provider value={{ signer, address, chainId, isCorrectChain, connect, switchToGalileo, error }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
