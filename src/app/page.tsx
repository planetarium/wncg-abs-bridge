"use client";

/* eslint-disable @next/next/no-img-element */

import { motion } from "framer-motion";
import Nav from "@/components/Nav";
import BridgeCard from "@/components/BridgeCard";
import { colors, links } from "@/lib/brand";
import { l1Chain, l2Chain } from "@/lib/chains";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const, delay },
});

export default function Home() {
  return (
    <>
      <Nav />

      {/* ambient background */}
      <div className="hero-grid-bg" />
      <div className="hero-dust" aria-hidden="true">
        <div className="layer bokeh" />
        <div className="layer far" />
        <div className="layer near" />
      </div>

      <main className="relative z-10 min-h-screen">
        <section className="mx-auto flex min-h-screen max-w-screen-2xl flex-col items-center gap-12 px-4 pb-16 pt-32 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:px-12 lg:pt-40">
          {/* copy */}
          <div className="max-w-xl text-center lg:text-left">
            <motion.div
              {...fadeUp(0)}
              className="mb-7 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] lg:justify-start"
              style={{ color: colors.amber }}
            >
              <span className="block h-px w-10" style={{ background: colors.amber }} />
              ZK Stack Bridge · Est. 2018
            </motion.div>

            <motion.h1
              {...fadeUp(0.1)}
              className="section-title mb-7"
            >
              Move <em>WNCG</em> between<br />
              Ethereum and <em>Abstract</em>.
            </motion.h1>

            <motion.p
              {...fadeUp(0.2)}
              className="mb-8 text-[15px] leading-relaxed md:text-base"
              style={{ color: colors.muted }}
            >
              Bridge Wrapped NCG across layers. Deposits lock WNCG on{" "}
              {l1Chain.name} and mint it on {l2Chain.name}, a ZK Stack chain;
              withdrawals burn on L2 and unlock on L1 — all routed through the
              ZK Stack Bridgehub. Connect a wallet to begin.
            </motion.p>

            <motion.div
              {...fadeUp(0.3)}
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.14em] lg:justify-start"
              style={{ color: colors.dim }}
            >
              <span>
                <span style={{ color: colors.amber }}>L1</span> {l1Chain.name}
              </span>
              <span>
                <span style={{ color: colors.amber }}>L2</span> {l2Chain.name}
              </span>
              <a
                href={links.abstract}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-amber"
              >
                What is Abstract? ↗
              </a>
            </motion.div>
          </div>

          {/* bridge card */}
          <motion.div
            {...fadeUp(0.2)}
            className="flex w-full justify-center lg:w-auto lg:justify-end"
          >
            <BridgeCard />
          </motion.div>
        </section>

        <footer
          className="relative z-10 mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-3 border-t px-4 py-8 font-mono text-[10px] uppercase tracking-[0.16em] md:flex-row md:px-12"
          style={{ borderColor: colors.line, color: colors.dim }}
        >
          <span>Nine Corporation · WNCG Bridge</span>
          <span>
            Powered by ZK Stack ·{" "}
            <a
              href={links.nineChronicles}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.amber }}
            >
              Nine Chronicles
            </a>
          </span>
        </footer>
      </main>
    </>
  );
}
