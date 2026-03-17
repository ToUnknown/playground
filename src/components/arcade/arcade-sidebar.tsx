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
  background: "#000000",
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.26)",
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
}: {
  sessionUser: SessionUser | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { available } = useConvexAvailability();
  const personalBests = useQuery(
    anyApi.scores.getPersonalBests,
    available && sessionUser
      ? {
          userId: sessionUser.userId as never,
        }
      : "skip",
  ) as PersonalBest[] | undefined;
  const totalPoints = useMemo(
    () => personalBests?.reduce((sum, entry) => sum + entry.score, 0) ?? 0,
    [personalBests],
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
            textTransform: "uppercase",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sessionUser?.username ?? "Guest"}
        </strong>
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
              color: "#f4f2ed",
            }}
          >
            {totalPoints}
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
            points
          </span>
        </div>
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
  sessionUser,
}: {
  game: GameManifest;
  sessionUser: SessionUser | null;
}) {
  const { available } = useConvexAvailability();
  const mode = game.modes[0]?.id ?? "solo";

  const leaderboard = useQuery(
    anyApi.scores.getGlobalLeaderboard,
    available
      ? {
          gameId: game.id,
          mode,
          limit: 5,
        }
      : "skip",
  ) as LeaderboardEntry[] | undefined;

  const personalBests = useQuery(
    anyApi.scores.getPersonalBests,
    available && sessionUser
      ? {
          userId: sessionUser.userId as never,
        }
      : "skip",
  ) as PersonalBest[] | undefined;

  const bestForGame = useMemo(
    () => personalBests?.find((entry) => entry.gameId === game.id && entry.mode === mode) ?? null,
    [game.id, mode, personalBests],
  );

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
        {bestForGame ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
            <small
              style={{
                color: "#b9bfd6",
                fontSize: "0.78rem",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
              }}
            >
              Best
            </small>
            <strong
              style={{
                color: game.accent,
                fontFamily: '"Rajdhani", sans-serif',
                fontSize: "1.8rem",
                letterSpacing: "0.04em",
              }}
            >
              {bestForGame.score}
            </strong>
          </div>
        ) : null}
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
        {available ? (
          leaderboard?.length ? (
            leaderboard.map((entry, index) => (
              <div
                key={`${entry.userId}-${entry.rank}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px minmax(0, 1fr) auto",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom:
                    index === leaderboard.length - 1
                      ? "none"
                      : "1px solid rgba(123, 138, 185, 0.12)",
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
                    textTransform: "uppercase",
                  }}
                >
                  {entry.username}
                </strong>
                <span>{entry.score}</span>
              </div>
            ))
          ) : (
            <p style={{ color: "#b9bfd6" }}>No scores yet.</p>
          )
        ) : (
          <p style={{ color: "#b9bfd6" }}>Convex offline.</p>
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
  const selectedGame = gameRegistry.find((entry) => entry.id === selectedGameId) ?? null;
  const [renderLeaderboard, setRenderLeaderboard] = useState(showLeaderboard);
  const [leaderboardVisible, setLeaderboardVisible] = useState(showLeaderboard);

  useEffect(() => {
    let fadeTimer = 0;
    let firstFrame = 0;
    let secondFrame = 0;

    if (showLeaderboard && selectedGame) {
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
      };
    }

    firstFrame = window.requestAnimationFrame(() => {
      setLeaderboardVisible(false);
      fadeTimer = window.setTimeout(() => {
        setRenderLeaderboard(false);
      }, LEADERBOARD_FADE_MS);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(fadeTimer);
    };
  }, [selectedGame, showLeaderboard]);

  return (
    <aside
      style={{
        width: "360px",
        maxWidth: "360px",
        height: `${Math.round(height)}px`,
        background: "#000000",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minHeight: 0,
      }}
    >
      <SessionCard
        sessionUser={sessionUser}
      />
      {renderLeaderboard && selectedGame ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            opacity: leaderboardVisible ? 1 : 0,
            transition: `opacity ${LEADERBOARD_FADE_MS}ms ease`,
          }}
        >
          <LeaderboardCard game={selectedGame} sessionUser={sessionUser} />
        </div>
      ) : null}
    </aside>
  );
}
