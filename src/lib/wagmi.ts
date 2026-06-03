import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  rabbyWallet,
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, fallback } from "wagmi";
import { l1Chain, l2Chain, L1_RPCS, L2_RPCS } from "./chains";

// Build a viem `fallback` transport from a list of RPC URLs. `rank` makes viem probe
// them and prefer the fastest live endpoint, automatically failing over if one dies.
export function rpcFallback(urls: string[]) {
  return fallback(
    urls.map((url) => http(url)),
    { rank: true, retryCount: 2 },
  );
}

// RainbowKit needs a WalletConnect Cloud project id. RainbowKit rejects empty/short
// ids, so we fall back to a placeholder 32-char hex string that lets injected wallets
// (MetaMask, Rabby, etc.) work in dev — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to a
// real id from https://cloud.reown.com for WalletConnect / mobile QR support.
const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
  "00000000000000000000000000000000";

// Explicit wallet list so we control exactly what shows in the modal. Passing
// `wallets` overrides RainbowKit's implicit default set, which now bundles
// "Base Account" — dropped here since this bridge settles on Ethereum, not Base.
// EOA wallets (Rabby/MetaMask) lead because deposits require signing on Ethereum L1.
export const wagmiConfig = getDefaultConfig({
  appName: "WNCG Bridge",
  projectId,
  chains: [l1Chain, l2Chain],
  wallets: [
    {
      groupName: "Recommended",
      wallets: [rabbyWallet, metaMaskWallet, walletConnectWallet],
    },
    {
      groupName: "More",
      wallets: [coinbaseWallet, rainbowWallet],
    },
  ],
  transports: {
    [l1Chain.id]: rpcFallback(L1_RPCS),
    [l2Chain.id]: rpcFallback(L2_RPCS),
  },
  ssr: true,
});
