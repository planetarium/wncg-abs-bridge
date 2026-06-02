"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { colors } from "@/lib/brand";
import { WNCG, l1TxUrl, l2TxUrl } from "@/lib/chains";
import { useClaim } from "@/lib/useClaim";
import { useWithdrawals, type WithdrawalRecord } from "@/lib/withdrawals";

function shortHash(h: string) {
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Readiness = "unknown" | "checking" | "ready" | "not-ready" | "already";

function ClaimRow({
  record,
  onClaimed,
  onRemove,
}: {
  record: WithdrawalRecord;
  onClaimed: (l2Hash: `0x${string}`, l1Hash?: `0x${string}`) => void;
  onRemove: (l2Hash: `0x${string}`) => void;
}) {
  const { check, claim, status } = useClaim();
  const [readiness, setReadiness] = useState<Readiness>("unknown");

  // Auto-check readiness once on mount (and let the user re-check).
  useEffect(() => {
    let alive = true;
    setReadiness("checking");
    check(record.l2Hash).then((kind) => {
      if (!alive) return;
      if (kind === "ready") setReadiness("ready");
      else if (kind === "already") {
        setReadiness("already");
        onClaimed(record.l2Hash);
      } else if (kind === "not-ready") setReadiness("not-ready");
      else setReadiness("unknown");
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.l2Hash]);

  // Reflect a successful claim back into storage.
  useEffect(() => {
    if (status.kind === "claimed") {
      onClaimed(record.l2Hash, status.hash);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.kind]);

  const claiming =
    status.kind === "claiming" || status.kind === "switching";

  const badge = (() => {
    if (status.kind === "claimed" || readiness === "already")
      return { text: "Claimed", color: colors.ok };
    if (readiness === "checking" || status.kind === "checking")
      return { text: "Checking…", color: colors.dim };
    if (readiness === "ready") return { text: "Ready to claim", color: colors.amber };
    if (readiness === "not-ready")
      return { text: "Maturing", color: colors.muted };
    return { text: "Unknown", color: colors.dim };
  })();

  const done = status.kind === "claimed" || readiness === "already";

  return (
    <div
      className="rounded-md p-3"
      style={{ border: `1px solid ${colors.line}`, background: colors.bg }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-mono text-[12px] font-semibold" style={{ color: colors.cream }}>
            {record.amount ? `${record.amount} ` : ""}
            {WNCG.symbol}
          </span>
          <a
            href={l2TxUrl(record.l2Hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] underline"
            style={{ color: colors.dim }}
          >
            L2 {shortHash(record.l2Hash)} · {timeAgo(record.createdAt)}
          </a>
        </div>
        <span
          className="whitespace-nowrap rounded-sm px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]"
          style={{ color: badge.color, border: `1px solid ${colors.line}` }}
        >
          {badge.text}
        </span>
      </div>

      {!done && (
        <div className="mt-3 flex items-center gap-2">
          {readiness === "ready" ? (
            <button
              type="button"
              className="primary-action"
              style={{ padding: "11px" }}
              disabled={claiming}
              onClick={() => claim(record.l2Hash)}
            >
              {claiming && <span className="spin mr-2 inline-block">◠</span>}
              {status.kind === "switching" ? "Switch network…" : "Claim on L1"}
            </button>
          ) : (
            <button
              type="button"
              className="ghost-action"
              style={{ padding: "11px" }}
              disabled={readiness === "checking"}
              onClick={() => {
                setReadiness("checking");
                check(record.l2Hash).then((kind) =>
                  setReadiness(
                    kind === "ready"
                      ? "ready"
                      : kind === "already"
                        ? "already"
                        : kind === "not-ready"
                          ? "not-ready"
                          : "unknown",
                  ),
                );
              }}
            >
              {readiness === "checking" ? "Checking…" : "Re-check status"}
            </button>
          )}
        </div>
      )}

      {readiness === "not-ready" && (
        <p className="mt-2 font-mono text-[10px] leading-relaxed" style={{ color: colors.dim }}>
          Proof not published yet. ZK Stack withdrawals mature in ~3h (up to ~24h when
          busy). Check back later — your funds are safe.
        </p>
      )}

      {status.kind === "claimed" && (
        <a
          href={l1TxUrl(status.hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-mono text-[10px] underline"
          style={{ color: colors.amber }}
        >
          ✓ Claimed on L1 {shortHash(status.hash)} ↗
        </a>
      )}

      {record.claimed && record.l1Hash && status.kind !== "claimed" && (
        <a
          href={l1TxUrl(record.l1Hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block font-mono text-[10px] underline"
          style={{ color: colors.amber }}
        >
          ✓ Claimed on L1 ↗
        </a>
      )}

      {status.kind === "error" && (
        <p className="mt-2 font-mono text-[10px] leading-relaxed" style={{ color: colors.err }}>
          {status.message}
        </p>
      )}

      {done && (
        <button
          type="button"
          onClick={() => onRemove(record.l2Hash)}
          className="mt-2 font-mono text-[10px] underline"
          style={{ color: colors.dim }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export default function ClaimPanel() {
  const { address, isConnected } = useAccount();
  const { records, markClaimed, remove } = useWithdrawals(address);

  // Show pending (unclaimed) first; keep claimed ones until dismissed.
  const sorted = useMemo(
    () => [...records].sort((a, b) => Number(a.claimed) - Number(b.claimed)),
    [records],
  );

  if (!isConnected || records.length === 0) return null;

  const pending = records.filter((r) => !r.claimed).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bridge-card mt-5 w-full max-w-[460px] p-6 md:p-7"
    >
      <div className="mb-4 flex items-center justify-between">
        <span
          className="font-mono text-[11px] uppercase tracking-[0.16em]"
          style={{ color: colors.amber }}
        >
          Claim on L1
        </span>
        {pending > 0 && (
          <span
            className="rounded-sm px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]"
            style={{ color: colors.amber, border: `1px solid ${colors.line}` }}
          >
            {pending} pending
          </span>
        )}
      </div>

      <p className="mb-4 font-mono text-[11px] leading-relaxed" style={{ color: colors.muted }}>
        Withdrawals you started are tracked here. Once a withdrawal matures, claim it on{" "}
        {WNCG.symbol === "WNCG" ? "Ethereum" : "L1"} to receive your tokens.
      </p>

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {sorted.map((r) => (
            <ClaimRow
              key={r.l2Hash}
              record={r}
              onClaimed={markClaimed}
              onRemove={remove}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
