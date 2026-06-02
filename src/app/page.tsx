/* eslint-disable @next/next/no-img-element */

import Nav from "@/components/Nav";
import BridgePanel from "@/components/BridgePanel";
import { colors, links } from "@/lib/brand";
import { l1Chain, l2Chain } from "@/lib/chains";

// Server component: the hero copy + footer are static HTML rendered on the server, so
// the LCP element (the headline) paints on first byte. Entrance motion is pure CSS
// (.fade-up) which animates immediately without waiting for JS hydration. The heavy
// web3 bridge UI is isolated in BridgePanel (dynamic, ssr:false).
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
            <h1 className="section-title fade-up mb-8">
              Move <em>WNCG</em> between<br />
              Ethereum and <em>Abstract</em>.
            </h1>

            <div
              className="fade-up fade-up-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.14em] lg:justify-start"
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
            </div>
          </div>

          {/* bridge card + claim panel (heavy web3 bundle, lazy) */}
          <BridgePanel />
        </section>

        <footer
          className="relative z-10 mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-3 border-t px-4 py-8 font-mono text-[10px] uppercase tracking-[0.16em] md:flex-row md:px-12"
          style={{ borderColor: colors.line, color: colors.dim }}
        >
          <span>
            ©{" "}
            <a
              href={links.planetarium}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: colors.amber }}
            >
              Planetarium Labs
            </a>{" "}
            · WNCG Bridge
          </span>
          <span>Powered by ZK Stack</span>
        </footer>
      </main>
    </>
  );
}
