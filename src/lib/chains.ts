import {
  mainnet,
  sepolia,
  abstract,
  abstractTestnet,
} from "wagmi/chains";
import type { Address } from "viem";

// Flip the whole app between the mainnet pair and the testnet pair with one env var.
export const IS_TESTNET =
  process.env.NEXT_PUBLIC_BRIDGE_NETWORK?.toLowerCase() === "testnet";

// L1 (settlement) <-> L2 (Abstract, a ZK Stack chain).
export const l1Chain = IS_TESTNET ? sepolia : mainnet;
export const l2Chain = IS_TESTNET ? abstractTestnet : abstract;

export const WNCG = {
  symbol: "WNCG",
  name: "Wrapped NCG",
  decimals: 18,
} as const;

// WNCG token contracts. Mainnet addresses were supplied directly; testnet falls back
// to the same addresses as placeholders (override via NEXT_PUBLIC_* if you deploy test tokens).
export const WNCG_L1_ADDRESS: Address = (process.env
  .NEXT_PUBLIC_WNCG_L1_ADDRESS ??
  "0xf203Ca1769ca8e9e8FE1DA9D147DB68B6c919817") as Address;

export const WNCG_L2_ADDRESS: Address = (process.env
  .NEXT_PUBLIC_WNCG_L2_ADDRESS ??
  "0x3a058F406654B908a60cBE296faC03C7bF1c6769") as Address;

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
