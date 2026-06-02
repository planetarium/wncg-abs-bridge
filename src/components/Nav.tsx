"use client";

/* eslint-disable @next/next/no-img-element */

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { colors, links } from "@/lib/brand";
import { IS_TESTNET } from "@/lib/chains";

export default function Nav() {
  return (
    <nav
      className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-5 py-4 md:px-10 lg:px-12"
      style={{
        background: "rgba(10, 9, 8, 0.86)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: `1px solid ${colors.line}`,
      }}
    >
      <a
        href={links.nineCorp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nine Corporation"
        className="flex items-center gap-3"
      >
        <img
          src="/assets/logo-mark.svg"
          alt="Nine Corporation"
          width={30}
          height={30}
          className="h-[26px] w-auto"
        />
        <span
          className="hidden font-mono text-[11px] uppercase tracking-[0.18em] sm:inline"
          style={{ color: colors.dim }}
        >
          WNCG Bridge
        </span>
        {IS_TESTNET && (
          <span
            className="rounded-sm px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
            style={{
              color: colors.amber,
              border: `1px solid ${colors.line}`,
              background: "rgba(255,157,61,0.08)",
            }}
          >
            Testnet
          </span>
        )}
      </a>

      <ConnectButton
        accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
        chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
        showBalance={false}
      />
    </nav>
  );
}
