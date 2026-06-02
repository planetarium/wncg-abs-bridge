"use client";

import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { getWalletClient, waitForTransactionReceipt } from "wagmi/actions";
import {
  createPublicClient,
  createWalletClient,
  parseUnits,
  type EIP1193RequestFn,
} from "viem";
import { walletActionsL1, walletActionsL2, publicActionsL2 } from "viem/zksync";
import { wagmiConfig, rpcFallback } from "./wagmi";
import {
  l1Chain,
  l2Chain,
  L1_RPCS,
  L2_RPCS,
  WNCG,
  WNCG_L1_ADDRESS,
  WNCG_L2_ADDRESS,
} from "./chains";

import { erc20Abi } from "./erc20";
import { splitTransport } from "./splitTransport";

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

  // Used inside bridge(): set "switching", flip the chain, and let the caller's next
  // step overwrite status. Does NOT reset to idle (the deposit/withdraw flow continues).
  const ensureSourceChain = useCallback(async () => {
    if (chain?.id === sourceChain.id) return;
    setStatus({ kind: "switching" });
    await switchChainAsync({ chainId: sourceChain.id });
  }, [chain?.id, sourceChain.id, switchChainAsync]);

  // Used by the standalone "Switch to <chain>" button. Unlike ensureSourceChain this
  // resets to idle when done — otherwise the spinner is stuck on "switching" forever
  // because nothing else runs afterward.
  const switchToSource = useCallback(async () => {
    if (chain?.id === sourceChain.id) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "switching" });
    try {
      await switchChainAsync({ chainId: sourceChain.id });
      setStatus({ kind: "idle" });
    } catch (e) {
      setStatus({ kind: "error", message: errMessage(e) });
    }
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
          // Rebuild the wallet client with a split transport so that signing/sending
          // goes to the wallet but every read (incl. the L1_NULLIFIER lookup) goes to
          // our own L1 RPCs — wallet RPCs were 403-ing those reads.
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
          }).extend(walletActionsL1());

          // Dedicated L2 (Abstract) reader for the deposit estimation/Bridgehub queries.
          const l2PublicClient = createPublicClient({
            chain: l2Chain,
            transport: rpcFallback(L2_RPCS),
          }).extend(publicActionsL2());

          // The L2 base cost (the ETH that must accompany the deposit to pay for L2
          // execution) = bridgehub.l2TransactionBaseCost(chainId, gasPrice, l2GasLimit,
          // gasPerPubdata). viem under-computes it two ways vs the official zksync-ethers
          // SDK (which zksync-cli uses), causing the Bridgehub to revert with
          // MsgValueTooLow (#-39000) — failed simulation + stuck-pending tx:
          //
          //   1. l2GasLimit: viem trusts zks_estimateGasL1ToL2 (~500k here), but
          //      zksync-ethers enforces L1_RECOMMENDED_MIN_ERC20_DEPOSIT_GAS_LIMIT =
          //      1,000,000 and then scales it ×1.2. We pin 3,000,000 (well above that
          //      floor); the unused portion is refunded to refundRecipient.
          //   2. gasPrice: the L1 base fee can tick up between estimation and send, so
          //      we pin maxFeePerGas to ~3x the current base fee for headroom.
          //
          // gasPerPubdataByte is the zksync-required 800.
          const l1Public = createPublicClient({
            chain: l1Chain,
            transport: rpcFallback(L1_RPCS),
          });
          const block = await l1Public.getBlock({ blockTag: "latest" });
          const baseFee = block.baseFeePerGas ?? 1_000_000_000n;
          const priority = 1_500_000_000n; // 1.5 gwei tip
          const maxFeePerGas = baseFee * 3n + priority;

          setStatus({ kind: "approving" });
          const hash = await walletClient.deposit({
            client: l2PublicClient,
            token: WNCG_L1_ADDRESS,
            amount,
            to: address,
            approveToken: true,
            approveBaseToken: true,
            refundRecipient: address,
            maxFeePerGas,
            maxPriorityFeePerGas: priority,
            l2GasLimit: 3_000_000n,
            gasPerPubdataByte: 800n,
          });
          setStatus({ kind: "pending", hash });
          await waitForTransactionReceipt(wagmiConfig, {
            hash,
            chainId: l1Chain.id,
          });
          setStatus({ kind: "success", hash, direction });
        } else {
          // L2 -> L1: burn on Abstract, emit L2->L1 message. Finalize on L1 later.
          // viem's withdraw reads zksync system RPCs (zks_L1ChainId,
          // zks_getBridgehubContract, ...) through the L2 client; wallet RPCs reject
          // those ("method zks_L1ChainId does not exist"). Split the transport so
          // signing/sending stays on the wallet and those reads go to our L2 RPCs.
          const rawWalletClient = await getWalletClient(wagmiConfig, {
            chainId: l2Chain.id,
          });
          const walletClient = createWalletClient({
            account: rawWalletClient.account,
            chain: l2Chain,
            transport: splitTransport(
              rawWalletClient.transport.request as EIP1193RequestFn,
              rpcFallback(L2_RPCS),
            ),
          }).extend(walletActionsL2());

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
      switchToSource,
      sourceChain,
      balance: {
        value: balance.data as bigint | undefined,
        isLoading: balance.isLoading,
        refetch: balance.refetch,
      },
    }),
    [status, reset, bridge, onWrongChain, ensureSourceChain, switchToSource, sourceChain, balance.data, balance.isLoading, balance.refetch],
  );
}
