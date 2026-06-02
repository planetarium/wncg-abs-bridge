import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { l1Chain, l2Chain } from "./chains";

// RainbowKit needs a WalletConnect Cloud project id. RainbowKit rejects empty/short
// ids, so we fall back to a placeholder 32-char hex string that lets injected wallets
// (MetaMask, Rabby, etc.) work in dev — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to a
// real id from https://cloud.reown.com for WalletConnect / mobile QR support.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "00000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName: "WNCG Bridge",
  projectId,
  chains: [l1Chain, l2Chain],
  transports: {
    [l1Chain.id]: http(),
    [l2Chain.id]: http(),
  },
  ssr: true,
});
