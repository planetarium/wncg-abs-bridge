// Discover an account's past WNCG withdrawals (L2 -> L1) directly from the chain, so
// the Claim panel auto-populates without the user having to have started the withdrawal
// in this browser. Backed by the Abstract block-explorer API (CORS-open), which indexes
// L2 transactions including the L2->L1 system contract calls.
import { formatUnits, type Address } from "viem";
import { WNCG, WNCG_L2_ADDRESS, l2Chain } from "./chains";
import type { WithdrawalRecord } from "./withdrawals";

// L2 AssetRouter / base-system contract that withdrawals are sent to, and the
// `withdraw(address l1Receiver, address l2Token, uint256 amount)` selector.
const L2_WITHDRAW_TO = "0x0000000000000000000000000000000000010003";
const WITHDRAW_SELECTOR = "0xd9caed12";

// Per-network explorer API base. Only mainnet Abstract is wired today.
const EXPLORER_API: Record<number, string> = {
  2741: "https://block-explorer-api.mainnet.abs.xyz",
};

type ExplorerTx = {
  hash: string;
  to: string | null;
  from: string;
  data: string;
  receivedAt?: string;
  status?: string;
  executeTxHash?: string | null;
};

function decodeWithdraw(data: string): { l2Token: Address; amount: bigint } | null {
  // selector(4) + l1Receiver(32) + l2Token(32) + amount(32)
  if (!data || data.length < 2 + 8 + 64 * 3) return null;
  const body = data.slice(10); // strip "0x" + 4-byte selector
  const l2Token = (`0x${body.slice(64 + 24, 128)}`) as Address;
  const amount = BigInt(`0x${body.slice(128, 192)}`);
  return { l2Token, amount };
}

/**
 * Fetch this account's WNCG withdrawals from the explorer. Returns newest-first
 * WithdrawalRecords. Throws on network/HTTP errors so the caller can fall back to the
 * cache. `executeTxHash` presence is surfaced via the record so the UI can hint
 * readiness, but final claim status is still confirmed on-chain by useClaim.
 */
export async function scanWithdrawals(
  account: Address,
  { pages = 2, perPage = 50 }: { pages?: number; perPage?: number } = {},
): Promise<WithdrawalRecord[]> {
  const base = EXPLORER_API[l2Chain.id];
  if (!base) return [];

  const found: WithdrawalRecord[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${base}/transactions?address=${account}&limit=${perPage}&page=${page}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`explorer ${res.status}`);
    const json = (await res.json()) as { items?: ExplorerTx[]; meta?: { totalPages?: number } };
    const items = json.items ?? [];

    for (const tx of items) {
      if (tx.from?.toLowerCase() !== account.toLowerCase()) continue;
      if ((tx.to ?? "").toLowerCase() !== L2_WITHDRAW_TO) continue;
      if (!tx.data?.toLowerCase().startsWith(WITHDRAW_SELECTOR)) continue;

      const decoded = decodeWithdraw(tx.data);
      if (!decoded) continue;
      // Only WNCG withdrawals.
      if (decoded.l2Token.toLowerCase() !== WNCG_L2_ADDRESS.toLowerCase()) continue;

      found.push({
        l2Hash: tx.hash as `0x${string}`,
        amount: formatAmount(decoded.amount),
        createdAt: tx.receivedAt ? Date.parse(tx.receivedAt) : 0,
      });
    }

    const totalPages = json.meta?.totalPages ?? 1;
    if (page >= totalPages || items.length === 0) break;
  }

  found.sort((a, b) => b.createdAt - a.createdAt);
  return found;
}

function formatAmount(raw: bigint): string {
  const n = Number(formatUnits(raw, WNCG.decimals));
  // Trim to a sensible precision for display/storage.
  return String(Number(n.toFixed(6)));
}
