"use client";

import dynamic from "next/dynamic";
import { colors } from "@/lib/brand";

// The bridge UI pulls in the heavy web3 stack (wagmi / RainbowKit / WalletConnect,
// ~1.5MB of JS). Loading it with ssr:false keeps that bundle out of the critical
// render path so the hero headline (the LCP element) paints immediately. A
// lightweight skeleton holds the layout to avoid any shift.
const BridgeCard = dynamic(() => import("./BridgeCard"), {
  ssr: false,
  loading: () => <CardSkeleton />,
});
const ClaimPanel = dynamic(() => import("./ClaimPanel"), { ssr: false });

function CardSkeleton() {
  return (
    <div
      className="bridge-card w-full max-w-[460px] p-6 md:p-7"
      style={{ minHeight: 520 }}
      aria-hidden="true"
    >
      <div
        className="mb-6 h-[44px] w-full rounded-md"
        style={{ background: "rgba(255,255,255,0.03)" }}
      />
      <div className="flex flex-col gap-2">
        <div className="h-[68px] rounded-md" style={{ background: "rgba(255,255,255,0.03)" }} />
        <div className="h-[68px] rounded-md" style={{ background: "rgba(255,255,255,0.03)" }} />
      </div>
      <div
        className="mt-5 h-[92px] rounded-md"
        style={{ background: "rgba(255,255,255,0.03)" }}
      />
      <div
        className="mt-6 h-[56px] w-full rounded-md"
        style={{ background: colors.amber, opacity: 0.25 }}
      />
    </div>
  );
}

export default function BridgePanel() {
  return (
    <div className="fade-up fade-up-2 flex w-full flex-col items-center lg:w-auto lg:items-end">
      <BridgeCard />
      <ClaimPanel />
    </div>
  );
}
