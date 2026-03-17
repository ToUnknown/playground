"use client";

import type { ReactNode } from "react";

import type { ThemeId } from "@/lib/contracts";
import { DesktopOnlyGate } from "@/components/layout/desktop-only-gate";
import { AssetCacheProvider } from "@/components/providers/asset-cache-provider";
import { OptionalConvexProvider } from "@/components/providers/convex-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export function AppProviders({
  children,
  initialThemeId,
}: {
  children: ReactNode;
  initialThemeId?: ThemeId;
}) {
  return (
    <ThemeProvider initialThemeId={initialThemeId}>
      <AssetCacheProvider />
      <DesktopOnlyGate>
        <OptionalConvexProvider>{children}</OptionalConvexProvider>
      </DesktopOnlyGate>
    </ThemeProvider>
  );
}
