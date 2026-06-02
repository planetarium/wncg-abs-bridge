import { custom, type EIP1193RequestFn, type Transport } from "viem";

// JSON-RPC methods that must be served by the wallet (signing, account state, sending).
// Everything else (reads: eth_call, eth_getBalance, zks_* system queries, receipts, ...)
// is routed to our own fallback RPC set. This is the fix for both the deposit-side
// "L1_NULLIFIER reverted 403" and the withdraw-side "zks_L1ChainId does not exist":
// viem reads system contracts/methods through the wallet client, and many wallet RPCs
// reject those reads. Splitting reads off the wallet avoids that entirely.
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
export function splitTransport(
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
