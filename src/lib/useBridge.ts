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
  custom,
  http,
  parseUnits,
  type EIP1193RequestFn,
  type Transport,
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

// JSON-RPC methods that must be served by the wallet (signing, account state, sending).
// Everything else (reads: eth_call, eth_getBalance, gas estimation, receipts, ...) is
// routed to our own fallback RPC set. This is the fix for "L1_NULLIFIER reverted 403":
// viem's deposit reads L1 system contracts through the wallet client, and some wallet
// RPCs reject those reads with 403. Splitting reads off the wallet avoids that entirely.
const WALLET_ONLY_METHODS = new Set([
  "eth_sendTransaction",
  "eth_sendRawTransaction",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v4",
  "eth_signTransaction",
  "personal_sign",
  "eth_accounts",
  "eth_requestAccounts",
  "eth_chainId",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_watchAsset",
  "wallet_getPermissions",
  "wallet_requestPermissions",
]);

// A transport that sends signing/account/sending calls to `walletRequest` (the wallet)
// and routes all read calls to `readTransport` (our ranked fallback RPCs).
function splitTransport(
  walletRequest: EIP1193RequestFn,
  readTransport: Transport,
): Transport {
  return (params) => {
    const read = readTransport(params);
    return custom({
      async request(args) {
        if (WALLET_ONLY_METHODS.has(args.method)) {
          return walletRequest(args as Parameters<EIP1193RequestFn>[0]);
        }
        return read.request(args);
      },
    })(params);
  };
}
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
