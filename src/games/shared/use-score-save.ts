"use client";

import { useEffect, useRef, useState } from "react";

import type { SessionUser, SoloGameResult } from "@/lib/contracts";

export function useScoreSave(args: {
  manifestId: string;
  sessionUser: SessionUser | null;
  result: SoloGameResult | null;
  resetKey: number;
}) {
  const { manifestId, sessionUser, result, resetKey } = args;
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const submittedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    submittedKeyRef.current = null;
    queueMicrotask(() => {
      setSaveState("idle");
    });
  }, [resetKey]);

  useEffect(() => {
    if (!result || !sessionUser) {
      return;
    }

    const resultKey = `${manifestId}:${result.score}:${result.durationMs}`;
    if (submittedKeyRef.current === resultKey) {
      return;
    }

    submittedKeyRef.current = resultKey;
    let cancelled = false;

    void Promise.resolve()
      .then(async () => {
        if (!cancelled) {
          setSaveState("saving");
        }

        const response = await fetch("/api/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: manifestId,
            mode: "solo",
            score: result.score,
            durationMs: result.durationMs,
            stats: result.stats,
          }),
        });

        if (!cancelled) {
          setSaveState(response.ok ? "saved" : "error");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSaveState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [manifestId, result, sessionUser]);

  return saveState;
}
