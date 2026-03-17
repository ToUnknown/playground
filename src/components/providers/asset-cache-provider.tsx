"use client";

import { useEffect } from "react";

export function AssetCacheProvider() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;

    const registerWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (!cancelled) {
          void registration.update().catch(() => undefined);
        }
      } catch {
        // Ignore registration failures and keep the app usable.
      }
    };

    void registerWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
