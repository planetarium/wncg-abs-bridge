"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { getWalletClient, waitForTransactionReceipt } from "wagmi/actions";
import { createPublicClient, http, fallback, parseUnits } from "viem";
import { walletActionsL1, walletActionsL2, publicActionsL2 } from "viem/zksync";
import { wagmiConfig } from "./wagmi";
import {
  l1Chain,
  l2Chain,
  L2_RPCS,
  WNCG,
  WNCG_L1_ADDRESS,
  WNCG_L2_ADDRESS,
} from "./chains";
import { erc20Abi } from "./erc20";

export type Direction = "deposit" | "withdraw";

export type BridgeStatus =
  | { kind: "idle" }
  | { kind: "switching" }
  | { kind: "approving" }
  | { kind: "pending"; hash: `0x${string}` }
  | { kind: "success"; hash: `0x${string}`; direction: Direction }
  | { kind: "error"; message: string };

function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "shortMessage" in e) {
    return String((e as { shortMessage: unknown }).shortMessage);
  }
  if (e instanceof Error) return e.message;
  return "Transaction failed.";
}

export function useBridge(direction: Direction) {
  const { address, chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const [status, setStatus] = useState<BridgeStatus>({ kind: "idle" });

  const sourceChain = direction === "deposit" ? l1Chain : l2Chain;
  const tokenOnSource =
    direction === "deposit" ? WNCG_L1_ADDRESS : WNCG_L2_ADDRESS;

  // Balance of WNCG on the source chain for the connected account.
  const balance = useReadContract({
    address: tokenOnSource,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sourceChain.id,
    query: { enabled: Boolean(address), refetchInterval: 12_000 },
  });

  const onWrongChain = Boolean(address) && chain?.id !== sourceChain.id;

  const reset = useCallback(() => setStatus({ kind: "idle" }), []);

  const ensureSourceChain = useCallback(async () => {
    if (chain?.id === sourceChain.id) return;
    setStatus({ kind: "switching" });
    await switchChainAsync({ chainId: sourceChain.id });
  }, [chain?.id, sourceChain.id, switchChainAsync]);

  const bridge = useCallback(
    async (amountText: string) => {
      if (!address) return;
      let amount: bigint;
      try {
        amount = parseUnits(amountText || "0", WNCG.decimals);
      } catch {
        setStatus({ kind: "error", message: "Invalid amount." });
        return;
      }
      if (amount <= 0n) {
        setStatus({ kind: "error", message: "Enter an amount greater than zero." });
        return;
      }

      try {
        await ensureSourceChain();

        if (direction === "deposit") {
          // L1 -> L2: viem zksync deposit handles approve + Bridgehub request.
          const walletClient = (
            await getWalletClient(wagmiConfig, { chainId: l1Chain.id })
          ).extend(walletActionsL1());
          // Dedicated L2 (Abstract) reader for the deposit estimation/Bridgehub queries.
          // Same fallback list as the app so a dead RPC doesn't block deposits.
          const l2PublicClient = createPublicClient({
            chain: l2Chain,
            transport: fallback(
              L2_RPCS.map((url) => http(url)),
              { rank: true, retryCount: 2 },
            ),
          }).extend(publicActionsL2());

          setStatus({ kind: "approving" });
          const hash = await walletClient.deposit({
            client: l2PublicClient,
            token: WNCG_L1_ADDRESS,
            amount,
            to: address,
            approveToken: true,
            approveBaseToken: true,
            refundRecipient: address,
          });
          setStatus({ kind: "pending", hash });
          await waitForTransactionReceipt(wagmiConfig, {
            hash,
            chainId: l1Chain.id,
          });
          setStatus({ kind: "success", hash, direction });
        } else {
          // L2 -> L1: burn on Abstract, emit L2->L1 message. Finalize on L1 later.
          const walletClient = (
            await getWalletClient(wagmiConfig, { chainId: l2Chain.id })
          ).extend(walletActionsL2());

          const hash = await walletClient.withdraw({
            token: WNCG_L2_ADDRESS,
            amount,
            to: address,
          });
          setStatus({ kind: "pending", hash });
          await waitForTransactionReceipt(wagmiConfig, {
            hash,
            chainId: l2Chain.id,
          });
          setStatus({ kind: "success", hash, direction });
        }

        // Refresh source-side balance after a successful bridge.
        balance.refetch();
      } catch (e) {
        setStatus({ kind: "error", message: errMessage(e) });
      }
    },
    [address, direction, ensureSourceChain, balance],
  );

  return useMemo(
    () => ({
      status,
      reset,
      bridge,
      onWrongChain,
      ensureSourceChain,
      sourceChain,
      balance: {
        value: balance.data as bigint | undefined,
        isLoading: balance.isLoading,
        refetch: balance.refetch,
      },
    }),
    [status, reset, bridge, onWrongChain, ensureSourceChain, sourceChain, balance.data, balance.isLoading, balance.refetch],
  );
}
