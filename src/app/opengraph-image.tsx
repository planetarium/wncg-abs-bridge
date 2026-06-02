import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Static 1200x630 social card, generated at build time with @vercel/og (next/og).
// Brand: warm-black background + amber accent, matching the bridge UI.
export const alt = "WNCG Bridge — Ethereum ↔ Abstract";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Embed the WNCG mark as a data URL so the OG renderer needs no network fetch.
function wncgIconDataUrl() {
  try {
    const buf = readFileSync(
      join(process.cwd(), "public", "assets", "wncg-icon.png"),
    );
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export default function OgImage() {
  const icon = wncgIconDataUrl();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "radial-gradient(1200px 600px at 75% 15%, rgba(255,157,61,0.18), transparent 60%), #0A0908",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          color: "#F4F1EC",
        }}
      >
        {/* top row: mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} width={72} height={72} alt="" />
          ) : null}
          <div
            style={{
              fontSize: 26,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "#8A867D",
              fontFamily: "monospace",
            }}
          >
            WNCG Bridge
          </div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -3,
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            <span>Move&nbsp;</span>
            <span style={{ color: "#FF9D3D" }}>WNCG</span>
            <span>&nbsp;between</span>
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -3,
              display: "flex",
            }}
          >
            <span>Ethereum and&nbsp;</span>
            <span style={{ color: "#FF9D3D" }}>Abstract</span>
            <span>.</span>
          </div>
        </div>

        {/* bottom row: chains + credit */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#8A867D",
            fontFamily: "monospace",
            borderTop: "1px solid rgba(255,255,255,0.09)",
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", gap: 36 }}>
            <span>
              <span style={{ color: "#FF9D3D" }}>L1</span> Ethereum
            </span>
            <span>
              <span style={{ color: "#FF9D3D" }}>L2</span> Abstract
            </span>
            <span>ZK Stack</span>
          </div>
          <span>Planetarium Labs</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
