"use client";

// Local record of L2->L1 withdrawals so the UI can resurface the "claim on L1" step
// without the user having to remember a transaction hash. Keyed by wallet address and
// scoped to the current network so testnet/mainnet records never mix.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { l2Chain } from "./chains";
import { scanWithdrawals } from "./scanWithdrawals";

export type WithdrawalRecord = {
  l2Hash: `0x${string}`;
  amount: string; // human-readable WNCG amount
  createdAt: number; // ms epoch — stamped by the caller (Date.now())
  claimed?: boolean;
  l1Hash?: `0x${string}`;
};

const KEY = `wncg-bridge:withdrawals:${l2Chain.id}`;

function read(account?: string): WithdrawalRecord[] {
  if (typeof window === "undefined" || !account) return [];
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const list = all[account.toLowerCase()];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(account: string, list: WithdrawalRecord[]) {
  if (typeof window === "undefined") return;
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    all[account.toLowerCase()] = list;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / serialization errors */
  }
  // Notify other hook instances in the same tab.
  window.dispatchEvent(new Event("wncg-withdrawals-changed"));
}

// Merge chain-discovered withdrawals with the locally-cached ones. Local records win
// on metadata (claimed/l1Hash/amount the user saw), chain finds add anything missing.
function mergeRecords(
  local: WithdrawalRecord[],
  chain: WithdrawalRecord[],
): WithdrawalRecord[] {
  const byHash = new Map<string, WithdrawalRecord>();
  for (const r of chain) byHash.set(r.l2Hash.toLowerCase(), r);
  for (const r of local) {
    const key = r.l2Hash.toLowerCase();
    const existing = byHash.get(key);
    byHash.set(key, existing ? { ...existing, ...r } : r);
  }
  return [...byHash.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function useWithdrawals(account?: string) {
  const [records, setRecords] = useState<WithdrawalRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => setRecords(read(account)), [account]);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("wncg-withdrawals-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("wncg-withdrawals-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  // On connect: show the localStorage cache immediately, then scan the chain for any
  // withdrawals this browser doesn't know about, merge them in, and persist the result
  // (so the next load is instant and offline-friendly).
  const scannedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!account) return;
    const key = account.toLowerCase();
    if (scannedFor.current === key) return; // once per account per mount
    scannedFor.current = key;

    let alive = true;
    setSyncing(true);
    scanWithdrawals(account as Address)
      .then((chain) => {
        if (!alive || chain.length === 0) return;
        const merged = mergeRecords(read(account), chain);
        write(account, merged); // fires wncg-withdrawals-changed -> refresh()
      })
      .catch(() => {
        /* explorer unreachable — cache-only is fine */
      })
      .finally(() => {
        if (alive) setSyncing(false);
      });
    return () => {
      alive = false;
    };
  }, [account]);

  const add = useCallback(
    (rec: WithdrawalRecord) => {
      if (!account) return;
      const list = read(account);
      // de-dupe by l2Hash
      if (!list.some((r) => r.l2Hash === rec.l2Hash)) {
        write(account, [rec, ...list]);
      }
    },
    [account],
  );

  const markClaimed = useCallback(
    (l2Hash: `0x${string}`, l1Hash?: `0x${string}`) => {
      if (!account) return;
      const list = read(account).map((r) =>
        r.l2Hash === l2Hash ? { ...r, claimed: true, l1Hash } : r,
      );
      write(account, list);
    },
    [account],
  );

  const remove = useCallback(
    (l2Hash: `0x${string}`) => {
      if (!account) return;
      write(
        account,
        read(account).filter((r) => r.l2Hash !== l2Hash),
      );
    },
    [account],
  );

  return { records, syncing, add, markClaimed, remove, refresh };
}
