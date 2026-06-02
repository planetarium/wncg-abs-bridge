"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { colors } from "@/lib/brand";
import {
  l1Chain,
  l2Chain,
  WNCG,
  l1TxUrl,
  l2TxUrl,
} from "@/lib/chains";
import { useBridge, type Direction } from "@/lib/useBridge";

function ChainRow({
  label,
  name,
  badge,
}: {
  label: string;
  name: string;
  badge: string;
}) {
  return (
    <div className="chain-pill">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md font-mono text-[11px] font-bold"
        style={{
          color: colors.amber,
          background: "rgba(255,157,61,0.1)",
          border: `1px solid ${colors.line}`,
        }}
      >
        {badge}
      </div>
      <div className="flex flex-col">
        <span
          className="font-mono text-[9px] uppercase tracking-[0.18em]"
          style={{ color: colors.dim }}
        >
          {label}
        </span>
        <span className="text-[15px] font-semibold" style={{ color: colors.cream }}>
          {name}
        </span>
      </div>
    </div>
  );
}

export default function BridgeCard() {
  const { isConnected } = useAccount();
  const [direction, setDirection] = useState<Direction>("deposit");
  const [amount, setAmount] = useState("");

  const bridge = useBridge(direction);

  const from = direction === "deposit" ? l1Chain : l2Chain;
  const to = direction === "deposit" ? l2Chain : l1Chain;
  const fromBadge = direction === "deposit" ? "L1" : "L2";
  const toBadge = direction === "deposit" ? "L2" : "L1";

  const balanceText = useMemo(() => {
    if (bridge.balance.value === undefined) return "—";
    return Number(
      formatUnits(bridge.balance.value, WNCG.decimals),
    ).toLocaleString(undefined, { maximumFractionDigits: 6 });
  }, [bridge.balance.value]);

  const overBalance = useMemo(() => {
    if (!amount || bridge.balance.value === undefined) return false;
    try {
      return Number(amount) > Number(formatUnits(bridge.balance.value, WNCG.decimals));
    } catch {
      return false;
    }
  }, [amount, bridge.balance.value]);

  const busy =
    bridge.status.kind === "switching" ||
    bridge.status.kind === "approving" ||
    bridge.status.kind === "pending";

  const canSubmit =
    isConnected &&
    Boolean(amount) &&
    Number(amount) > 0 &&
    !overBalance &&
    !busy;

  function flip() {
    setDirection((d) => (d === "deposit" ? "withdraw" : "deposit"));
    setAmount("");
    bridge.reset();
  }

  function setMax() {
    if (bridge.balance.value !== undefined) {
      setAmount(formatUnits(bridge.balance.value, WNCG.decimals));
    }
  }

  const statusLabel = (() => {
    switch (bridge.status.kind) {
      case "switching":
        return "Switch network in wallet…";
      case "approving":
        return "Confirm in wallet…";
      case "pending":
        return "Bridging… waiting for confirmation";
      default:
        return null;
    }
  })();

  return (
    <div className="bridge-card w-full max-w-[460px] p-6 md:p-7">
      {/* direction toggle */}
      <div className="tab-toggle mb-6">
        <button
          data-active={direction === "deposit"}
          onClick={() => {
            if (direction !== "deposit") flip();
          }}
        >
          Deposit → L2
        </button>
        <button
          data-active={direction === "withdraw"}
          onClick={() => {
            if (direction !== "withdraw") flip();
          }}
        >
          Withdraw → L1
        </button>
      </div>

      {/* from / swap / to */}
      <div className="relative flex flex-col gap-2">
        <ChainRow label="From" name={from.name} badge={fromBadge} />
        <div className="my-[-6px] flex justify-center">
          <button className="swap-btn" onClick={flip} aria-label="Swap direction" type="button">
            ↓
          </button>
        </div>
        <ChainRow label="To" name={to.name} badge={toBadge} />
      </div>

      {/* amount */}
      <div className="field-shell mt-5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: colors.dim }}
          >
            Amount
          </span>
          <span className="font-mono text-[11px]" style={{ color: colors.muted }}>
            Balance: {balanceText} {WNCG.symbol}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            className="amount-input"
            inputMode="decimal"
            type="number"
            min="0"
            placeholder="0.0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              if (bridge.status.kind !== "idle") bridge.reset();
            }}
          />
          <button
            type="button"
            onClick={setMax}
            disabled={bridge.balance.value === undefined}
            className="rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-40"
            style={{
              color: colors.amber,
              border: `1px solid ${colors.line}`,
              background: "rgba(255,157,61,0.06)",
            }}
          >
            Max
          </button>
          <span
            className="font-mono text-[13px] font-semibold"
            style={{ color: colors.cream }}
          >
            {WNCG.symbol}
          </span>
        </div>
        {overBalance && (
          <p className="mt-2 font-mono text-[11px]" style={{ color: colors.err }}>
            Amount exceeds your balance.
          </p>
        )}
      </div>

      {/* per-direction notice (timing expectations BEFORE submitting) */}
      <div
        className="mt-4 rounded-md p-3"
        style={{
          border: `1px solid ${colors.line}`,
          background:
            direction === "withdraw"
              ? "rgba(255,157,61,0.07)"
              : "rgba(255,255,255,0.02)",
        }}
      >
        {direction === "deposit" ? (
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: colors.muted }}>
            <span style={{ color: colors.amber }}>≈ a few minutes.</span> First-time
            deposits ask for two wallet signatures — an ERC-20{" "}
            <span style={{ color: colors.cream }}>approve</span>, then the{" "}
            <span style={{ color: colors.cream }}>deposit</span>. Funds mint on{" "}
            {l2Chain.name} after the L1 tx is finalized.
          </p>
        ) : (
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: colors.muted }}>
            <span style={{ color: colors.amber }}>⚠ Withdrawals are slow.</span> After
            the L2 transaction, the ZK proof must be published and a security delay
            elapses — typically{" "}
            <span style={{ color: colors.cream }}>~3 hours, and up to ~24h</span> when
            the network is busy. You then{" "}
            <span style={{ color: colors.cream }}>claim on L1</span> in a separate
            transaction. Funds are not lost during the wait.
          </p>
        )}
      </div>

      {/* action */}
      <div className="mt-6">
        {!isConnected ? (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button className="primary-action" onClick={openConnectModal} type="button">
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        ) : bridge.onWrongChain && bridge.status.kind === "idle" ? (
          <button
            className="ghost-action"
            type="button"
            onClick={() => bridge.ensureSourceChain()}
          >
            Switch to {from.name}
          </button>
        ) : (
          <button
            className="primary-action"
            type="button"
            disabled={!canSubmit}
            onClick={() => bridge.bridge(amount)}
          >
            {busy && <span className="spin mr-3 inline-block">◠</span>}
            {direction === "deposit"
              ? `Deposit ${WNCG.symbol}`
              : `Withdraw ${WNCG.symbol}`}
          </button>
        )}
      </div>

      {/* status feedback */}
      <AnimatePresence mode="wait">
        {statusLabel && (
          <motion.div
            key={bridge.status.kind}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-4 flex items-center gap-2 font-mono text-[12px]"
            style={{ color: colors.amber2 }}
          >
            <span className="spin inline-block">◠</span>
            {statusLabel}
          </motion.div>
        )}

        {bridge.status.kind === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-md p-3"
            style={{
              border: `1px solid ${colors.line}`,
              background: "rgba(132,194,94,0.08)",
            }}
          >
            <p className="font-mono text-[12px] font-semibold" style={{ color: colors.ok }}>
              ✓ {bridge.status.direction === "deposit" ? "Deposit" : "Withdrawal"} submitted
            </p>
            <p className="mt-1 font-mono text-[11px]" style={{ color: colors.muted }}>
              {bridge.status.direction === "deposit"
                ? "Funds arrive on Abstract once the L1 tx is finalized (a few minutes)."
                : "Your WNCG is now burning on L2. Once the ZK proof is published (~3h, up to ~24h when busy) you must claim it on L1 in a separate transaction."}
            </p>
            <a
              href={
                bridge.status.direction === "deposit"
                  ? l1TxUrl(bridge.status.hash)
                  : l2TxUrl(bridge.status.hash)
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-mono text-[11px] underline"
              style={{ color: colors.amber }}
            >
              View transaction ↗
            </a>
          </motion.div>
        )}

        {bridge.status.kind === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-md p-3"
            style={{
              border: `1px solid ${colors.line}`,
              background: "rgba(224,108,90,0.08)",
            }}
          >
            <p className="font-mono text-[11px] leading-relaxed" style={{ color: colors.err }}>
              {bridge.status.message}
            </p>
            <button
              onClick={bridge.reset}
              className="mt-2 font-mono text-[11px] underline"
              style={{ color: colors.dim }}
              type="button"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p
        className="mt-5 text-center font-mono text-[10px] leading-relaxed"
        style={{ color: colors.dim }}
      >
        ZK Stack bridge · Bridgehub-routed · {WNCG.name} ({WNCG.symbol})
      </p>
    </div>
  );
}
