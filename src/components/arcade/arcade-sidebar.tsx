"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { anyApi } from "convex/server";
import { useQuery } from "convex/react";
import { startTransition, useEffect, useMemo, useState, type CSSProperties } from "react";

import type { GameManifest, LeaderboardEntry, PersonalBest, SessionUser } from "@/lib/contracts";
import { gameRegistry } from "@/lib/game-registry";
import { useConvexAvailability } from "@/components/providers/convex-provider";

const sideCardStyle: CSSProperties = {
  border: "1px solid rgba(183, 190, 159, 0.16)",
  borderRadius: "28px",
  background: "rgba(10, 14, 9, 0.18)",
  backdropFilter: "blur(8px)",
  boxShadow: "none",
  padding: "18px",
};

const sideLabelStyle: CSSProperties = {
  color: "rgba(216, 221, 236, 0.74)",
  fontSize: "0.78rem",
  fontWeight: 600,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontFamily: '"Rajdhani", sans-serif',
};

const sideActionStyle: CSSProperties = {
  marginTop: "16px",
  width: "100%",
  minHeight: "46px",
  border: "1px solid rgba(170, 181, 214, 0.18)",
  borderRadius: "999px",
  background: "rgba(126, 138, 179, 0.1)",
  color: "#f4f2ed",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  appearance: "none",
};

const LEADERBOARD_FADE_MS = 220;

function SessionCard({
  sessionUser,
  game,
  showBest,
}: {
  sessionUser: SessionUser | null;
  game: GameManifest | null;
  showBest: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { available } = useConvexAvailability();
  const mode = game?.modes[0]?.id ?? "solo";
  const personalBests = useQuery(
    anyApi.scores.getPersonalBests,
    available && sessionUser
      ? {
          userId: sessionUser.userId as never,
        }
      : "skip",
  ) as PersonalBest[] | undefined;
  const bestForGame = useMemo(
    () =>
      game ? personalBests?.find((entry) => entry.gameId === game.id && entry.mode === mode) ?? null : null,
    [game, mode, personalBests],
  );

  return (
    <div style={sideCardStyle}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
        <span style={sideLabelStyle}>Player</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        <strong
          style={{
            fontFamily: '"Rajdhani", sans-serif',
            fontSize: "2rem",
            letterSpacing: "0.04em",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sessionUser?.username ?? "Guest"}
        </strong>
        {showBest && game ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <strong
              style={{
                fontFamily: '"Rajdhani", sans-serif',
                fontSize: "1.65rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: bestForGame ? game.accent : "#f4f2ed",
              }}
            >
              {bestForGame?.score ?? "--"}
            </strong>
            <span
              style={{
                marginTop: "4px",
                color: "#b9bfd6",
                fontSize: "0.76rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Best {game.name}
            </span>
          </div>
        ) : null}
      </div>
      {sessionUser ? (
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button
            style={{
              ...sideActionStyle,
              marginTop: 0,
              width: "100%",
            }}
            disabled={pending}
            onClick={() => {
              setPending(true);
              startTransition(async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.refresh();
                setPending(false);
              });
            }}
          >
            {pending ? "..." : "Log out"}
          </button>
        </div>
      ) : (
        <Link href="/enter" style={sideActionStyle}>
          Enter
        </Link>
      )}
    </div>
  );
}

function LeaderboardCard({
  game,
  leaderboard,
}: {
  game: GameManifest;
  leaderboard: LeaderboardEntry[];
}) {
  return (
    <div
      style={{
        ...sideCardStyle,
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <span style={sideLabelStyle}>Leaderboard</span>
          <h2
            style={{
              fontFamily: '"Rajdhani", sans-serif',
              fontSize: "2rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {game.name}
          </h2>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {leaderboard.length ? (
          leaderboard.map((entry) => (
            <div
              key={`${entry.userId}-${entry.rank}`}
              style={{
                display: "grid",
                gridTemplateColumns: "24px minmax(0, 1fr) auto",
                gap: "12px",
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: "18px",
                background: "rgba(10, 14, 9, 0.34)",
                border: "1px solid rgba(183, 190, 159, 0.12)",
                boxShadow: "inset 0 1px 0 rgba(210, 223, 147, 0.04)",
              }}
            >
              <span>{entry.rank}</span>
                <strong
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontFamily: '"Rajdhani", sans-serif',
                    letterSpacing: "0.04em",
                  }}
                >
                  {entry.username}
              </strong>
              <span>{entry.score}</span>
            </div>
          ))
        ) : (
          <p style={{ color: "#b9bfd6" }}>No scores yet.</p>
        )}
      </div>
    </div>
  );
}

export function ArcadeSidebar({
  selectedGameId,
  sessionUser,
  height,
  showLeaderboard,
}: {
  selectedGameId: string;
  sessionUser: SessionUser | null;
  height: number;
  showLeaderboard: boolean;
}) {
  const { available } = useConvexAvailability();
  const selectedGame = gameRegistry.find((entry) => entry.id === selectedGameId) ?? null;
  const selectedMode = selectedGame?.modes[0]?.id ?? "solo";
  const selectedLeaderboard = useQuery(
    anyApi.scores.getGlobalLeaderboard,
    available && showLeaderboard && selectedGame
      ? {
          gameId: selectedGame.id,
          mode: selectedMode,
          limit: 5,
        }
      : "skip",
  ) as LeaderboardEntry[] | undefined;
  const selectedLeaderboardLoaded = Boolean(available && showLeaderboard && selectedGame && selectedLeaderboard);
  const [displayedGame, setDisplayedGame] = useState<GameManifest | null>(null);
  const [displayedLeaderboard, setDisplayedLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [renderLeaderboard, setRenderLeaderboard] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);

  useEffect(() => {
    let fadeTimer = 0;
    let swapTimer = 0;
    let firstFrame = 0;
    let secondFrame = 0;

    if (!available || !showLeaderboard || !selectedGame) {
      if (!renderLeaderboard) {
        setDisplayedGame(null);
        setDisplayedLeaderboard([]);
        setLeaderboardVisible(false);
        return () => {
          window.clearTimeout(fadeTimer);
          window.clearTimeout(swapTimer);
          window.cancelAnimationFrame(firstFrame);
          window.cancelAnimationFrame(secondFrame);
        };
      }

      setLeaderboardVisible(false);
      fadeTimer = window.setTimeout(() => {
        setRenderLeaderboard(false);
        setDisplayedGame(null);
        setDisplayedLeaderboard([]);
      }, LEADERBOARD_FADE_MS);

      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
        window.clearTimeout(fadeTimer);
        window.clearTimeout(swapTimer);
      };
    }

    if (!selectedLeaderboardLoaded) {
      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
        window.clearTimeout(fadeTimer);
        window.clearTimeout(swapTimer);
      };
    }

    if (!renderLeaderboard || !displayedGame) {
      setDisplayedGame(selectedGame);
      setDisplayedLeaderboard(selectedLeaderboard ?? []);
      firstFrame = window.requestAnimationFrame(() => {
        setRenderLeaderboard(true);
        secondFrame = window.requestAnimationFrame(() => {
          setLeaderboardVisible(true);
        });
      });

      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
        window.clearTimeout(fadeTimer);
        window.clearTimeout(swapTimer);
      };
    }

    if (displayedGame.id === selectedGame.id) {
      setDisplayedLeaderboard(selectedLeaderboard ?? []);
      firstFrame = window.requestAnimationFrame(() => {
        setLeaderboardVisible(true);
      });

      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
        window.clearTimeout(fadeTimer);
        window.clearTimeout(swapTimer);
      };
    }

    setLeaderboardVisible(false);
    swapTimer = window.setTimeout(() => {
      setDisplayedGame(selectedGame);
      setDisplayedLeaderboard(selectedLeaderboard ?? []);
      setLeaderboardVisible(false);
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          setLeaderboardVisible(true);
        });
      });
    }, LEADERBOARD_FADE_MS);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(swapTimer);
    };
  }, [
    available,
    displayedGame,
    renderLeaderboard,
    selectedGame,
    selectedLeaderboard,
    selectedLeaderboardLoaded,
    showLeaderboard,
  ]);

  return (
    <aside
      style={{
        width: "360px",
        maxWidth: "360px",
        height: `${Math.round(height)}px`,
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minHeight: 0,
      }}
    >
      <SessionCard
        sessionUser={sessionUser}
        game={selectedGame}
        showBest={showLeaderboard && Boolean(selectedGame)}
      />
      {renderLeaderboard && displayedGame ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            opacity: leaderboardVisible ? 1 : 0,
            transform: leaderboardVisible ? "translateY(0)" : "translateY(10px)",
            filter: leaderboardVisible ? "blur(0px)" : "blur(4px)",
            transition: `opacity ${LEADERBOARD_FADE_MS}ms ease, transform ${LEADERBOARD_FADE_MS}ms ease, filter ${LEADERBOARD_FADE_MS}ms ease`,
            willChange: "opacity, transform, filter",
          }}
        >
          <LeaderboardCard game={displayedGame} leaderboard={displayedLeaderboard} />
        </div>
      ) : null}
    </aside>
  );
}
