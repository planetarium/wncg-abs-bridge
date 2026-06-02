import { mainnet, abstract } from "wagmi/chains";
import type { Address } from "viem";

// Mainnet only: Ethereum (L1, settlement) <-> Abstract (L2, a ZK Stack chain).
export const IS_TESTNET = false;
export const l1Chain = mainnet;
export const l2Chain = abstract;

export const WNCG = {
  symbol: "WNCG",
  name: "Wrapped NCG",
  decimals: 18,
} as const;

// WNCG mainnet token contracts (overridable via NEXT_PUBLIC_* if needed).
export const WNCG_L1_ADDRESS: Address = (process.env
  .NEXT_PUBLIC_WNCG_L1_ADDRESS ??
  "0xf203Ca1769ca8e9e8FE1DA9D147DB68B6c919817") as Address;

export const WNCG_L2_ADDRESS: Address = (process.env
  .NEXT_PUBLIC_WNCG_L2_ADDRESS ??
  "0x3a058F406654B908a60cBE296faC03C7bF1c6769") as Address;

// Candidate RPC endpoints fed to a viem `fallback` transport, which probes them and
// routes to whichever responds (ranked fastest-first), failing over automatically.
// A custom endpoint via env is prepended so it wins when present.
//
// Only endpoints verified to serve `eth_call` reliably are listed for L1 — the deposit
// flow reads L1 system contracts (e.g. L1_NULLIFIER) and a flaky RPC there surfaces as
// "L1_NULLIFIER reverted ... 403". eth.merkle.io / llamarpc / cloudflare-eth were
// dropped for returning 1015 / 1200 / -32603 under load.
export const L1_RPCS: string[] = [
  process.env.NEXT_PUBLIC_L1_RPC_URL,
  "https://ethereum-rpc.publicnode.com",
  "https://eth.drpc.org",
  "https://rpc.mevblocker.io",
].filter((u): u is string => Boolean(u));

// L2 MUST expose the zksync `zks_*` JSON-RPC methods (getBridgehubContract,
// getBaseTokenL1Address, ...) or deposits break. abstract.drpc.org returns -32601 for
// those, so it is deliberately NOT included — only the official Abstract RPC is.
export const L2_RPCS: string[] = [
  process.env.NEXT_PUBLIC_L2_RPC_URL,
  "https://api.mainnet.abs.xyz",
].filter((u): u is string => Boolean(u));

export const explorer = {
  l1: l1Chain.blockExplorers?.default.url ?? "https://etherscan.io",
  l2: l2Chain.blockExplorers?.default.url ?? "https://abscan.org",
} as const;

export function l1TxUrl(hash: string) {
  return `${explorer.l1}/tx/${hash}`;
}
export function l2TxUrl(hash: string) {
  return `${explorer.l2}/tx/${hash}`;
}
