// Shared design tokens lifted from the 9C / Nine Corporation portal system so the
// bridge keeps the same warm-black + amber look & feel.
export const colors = {
  bg: "#0A0908",
  bg2: "#121110",
  bg3: "#1A1816",
  panel: "#17130F",
  amber: "#FF9D3D",
  amber2: "#FFD07A",
  amberDeep: "#C9591A",
  cream: "#F4F1EC",
  muted: "#A39E95",
  dim: "#8A867D",
  line: "rgba(255,255,255,0.09)",
  ok: "#84C25E",
  err: "#e06c5a",
  onAmber: "#120A00",
} as const;

export const links = {
  planetarium: "https://www.planetariumlabs.com/",
  nineChronicles: "https://nine-chronicles.com/",
  abstract: "https://abs.xyz/",
  github: "https://github.com/planetarium",
} as const;
