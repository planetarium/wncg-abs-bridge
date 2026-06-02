"use client";

import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  darkTheme,
  type Theme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi";
import { colors } from "@/lib/brand";

// Tint RainbowKit's dark theme to match the portal palette.
const bridgeTheme: Theme = {
  ...darkTheme({
    accentColor: colors.amber,
    accentColorForeground: colors.onAmber,
    borderRadius: "small",
    overlayBlur: "small",
  }),
};
bridgeTheme.colors.modalBackground = colors.bg2;
bridgeTheme.colors.modalBorder = colors.line;
bridgeTheme.colors.profileForeground = colors.panel;
bridgeTheme.fonts.body = "var(--font-jetbrains-mono), ui-monospace, monospace";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={bridgeTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
