import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
  phantomWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { defineChain } from "viem";

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmrpc-testnet.0g.ai"] },
  },
  blockExplorers: {
    default: { name: "Chainscan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
});

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64";

// Explicit wallet list — controls the order shown in the modal.
// MetaMask is first so it's the default recommendation.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, walletConnectWallet],
    },
    {
      groupName: "More",
      wallets: [coinbaseWallet, rainbowWallet, phantomWallet, injectedWallet],
    },
  ],
  {
    appName: "Heda",
    projectId: PROJECT_ID,
  }
);

export const wagmiConfig = createConfig({
  chains: [galileo],
  connectors,
  transports: {
    [galileo.id]: http("https://evmrpc-testnet.0g.ai"),
  },
  ssr: false,
});

