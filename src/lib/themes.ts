import type { ThemeId } from "@/lib/contracts";

export const defaultThemeId: ThemeId = "neon-dusk";

export const themes = {
  "neon-dusk": {
    label: "Neon Dusk",
    values: {
      "--bg": "#07070c",
      "--bg-elevated": "rgba(13, 14, 24, 0.82)",
      "--panel": "rgba(18, 21, 36, 0.86)",
      "--panel-strong": "rgba(26, 30, 52, 0.96)",
      "--text": "#f4f2ed",
      "--muted": "#b9bfd6",
      "--line": "rgba(123, 138, 185, 0.22)",
      "--accent": "#74f7b2",
      "--accent-strong": "#ffd05f",
      "--danger": "#ff6b7d",
      "--shadow": "0 24px 100px rgba(0, 0, 0, 0.4)",
      "--grid": "rgba(116, 247, 178, 0.08)",
    },
  },
} satisfies Record<ThemeId, { label: string; values: Record<string, string> }>;
