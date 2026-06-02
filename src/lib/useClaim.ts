"use client";

import { useCallback, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { getWalletClient, waitForTransactionReceipt } from "wagmi/actions";
import {
  createPublicClient,
  createWalletClient,
  isHash,
  type EIP1193RequestFn,
} from "viem";
import {
  finalizeWithdrawal,
  isWithdrawalFinalized,
  publicActionsL1,
  publicActionsL2,
} from "viem/zksync";
import { wagmiConfig, rpcFallback } from "./wagmi";
import { l1Chain, l2Chain, L1_RPCS, L2_RPCS } from "./chains";
import { splitTransport } from "./splitTransport";

export type ClaimStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "not-ready" } // tx found but proof not published / delay not elapsed
  | { kind: "ready" } // proof available, can finalize on L1
  | { kind: "already" } // already claimed
  | { kind: "switching" }
  | { kind: "claiming"; hash?: `0x${string}` }
  | { kind: "claimed"; hash: `0x${string}` }
  | { kind: "error"; message: string };

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "shortMessage" in e) {
    return String((e as { shortMessage: unknown }).shortMessage);
  }
  if (e instanceof Error) return e.message;
  return "Failed.";
}

// Read-only L1/L2 clients built on our fallback RPCs (no wallet needed for the check).
function l1Reader() {
  return createPublicClient({
    chain: l1Chain,
    transport: rpcFallback(L1_RPCS),
  }).extend(publicActionsL1());
}
function l2Reader() {
  return createPublicClient({
    chain: l2Chain,
    transport: rpcFallback(L2_RPCS),
  }).extend(publicActionsL2());
}

export function useClaim() {
  const { address, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [status, setStatus] = useState<ClaimStatus>({ kind: "idle" });

  const reset = useCallback(() => setStatus({ kind: "idle" }), []);

  // Check whether an L2 withdrawal tx is ready to be finalized (or already done).
  // Readiness model (zks_getTransactionDetails.status):
  //   included -> committed -> verified/executed  (and ethExecuteTxHash gets set)
  // A withdrawal can be finalized on L1 only once the batch is executed on L1.
  const check = useCallback(async (l2Hash: string): Promise<ClaimStatus["kind"]> => {
    if (!isHash(l2Hash)) {
      const s: ClaimStatus = {
        kind: "error",
        message: "Invalid L2 transaction hash.",
      };
      setStatus(s);
      return s.kind;
    }
    setStatus({ kind: "checking" });
    try {
      const l1 = l1Reader();
      const l2 = l2Reader();

      // Already claimed?
      const finalized = await isWithdrawalFinalized(l1, {
        client: l2,
        hash: l2Hash as `0x${string}`,
      }).catch(() => false);
      if (finalized) {
        setStatus({ kind: "already" });
        return "already";
      }

      // Is the batch executed on L1 yet? If so, the proof is available to finalize.
      const details = await l2.getTransactionDetails({
        txHash: l2Hash as `0x${string}`,
      });
      const ready =
        Boolean(details.ethExecuteTxHash) ||
        details.status === "verified" ||
        details.status === "executed";
      const kind: ClaimStatus["kind"] = ready ? "ready" : "not-ready";
      setStatus({ kind });
      return kind;
    } catch (e) {
      setStatus({ kind: "error", message: errMessage(e) });
      return "error";
    }
  }, []);

  // Finalize (claim) on L1. Reads route to our RPCs; signing stays on the wallet.
  const claim = useCallback(
    async (l2Hash: string) => {
      if (!address) return;
      if (!isHash(l2Hash)) {
        setStatus({ kind: "error", message: "Enter a valid L2 transaction hash." });
        return;
      }
      try {
        if (chain?.id !== l1Chain.id) {
          setStatus({ kind: "switching" });
          await switchChainAsync({ chainId: l1Chain.id });
        }

        const rawWalletClient = await getWalletClient(wagmiConfig, {
          chainId: l1Chain.id,
        });
        const walletClient = createWalletClient({
          account: rawWalletClient.account,
          chain: l1Chain,
          transport: splitTransport(
            rawWalletClient.transport.request as EIP1193RequestFn,
            rpcFallback(L1_RPCS),
          ),
        });
        const l2 = l2Reader();

        setStatus({ kind: "claiming" });
        const hash = await finalizeWithdrawal(walletClient, {
          client: l2,
          hash: l2Hash as `0x${string}`,
        });
        setStatus({ kind: "claiming", hash });
        await waitForTransactionReceipt(wagmiConfig, {
          hash,
          chainId: l1Chain.id,
        });
        setStatus({ kind: "claimed", hash });
      } catch (e) {
        setStatus({ kind: "error", message: errMessage(e) });
      }
    },
    [address, chain?.id, switchChainAsync],
  );

  return { status, check, claim, reset };
}
