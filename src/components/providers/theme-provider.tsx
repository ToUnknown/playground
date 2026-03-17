"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ThemeId } from "@/lib/contracts";
import { defaultThemeId, themes } from "@/lib/themes";

type ThemeContextValue = {
  themeId: ThemeId;
  setThemeId: (themeId: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeId: defaultThemeId,
  setThemeId: () => undefined,
});

const STORAGE_KEY = "friends-arcade-theme";

export function ThemeProvider({
  children,
  initialThemeId,
}: {
  children: ReactNode;
  initialThemeId?: ThemeId;
}) {
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window === "undefined") {
      return initialThemeId ?? defaultThemeId;
    }
    const storedTheme = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return storedTheme && storedTheme in themes
      ? storedTheme
      : (initialThemeId ?? defaultThemeId);
  });

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeId;

    for (const [token, value] of Object.entries(themes[themeId].values)) {
      root.style.setProperty(token, value);
    }

    window.localStorage.setItem(STORAGE_KEY, themeId);
  }, [themeId]);

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
    }),
    [themeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
