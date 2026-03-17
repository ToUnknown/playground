"use client";

import { useMemo, useState } from "react";
import { anyApi } from "convex/server";
import { useQuery } from "convex/react";

import type { PersonalBest, SessionUser } from "@/lib/contracts";
import { gameRegistry } from "@/lib/game-registry";
import { formatDate } from "@/lib/utils";
import { useConvexAvailability } from "@/components/providers/convex-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

function LiveLeaderboards({
  sessionUser,
  gameId,
}: {
  sessionUser: SessionUser | null;
  gameId: string;
}) {
  const game = gameRegistry.find((entry) => entry.id === gameId) ?? gameRegistry[0];
  const mode = game.modes[0]?.id ?? "solo";
  const leaderboard = useQuery(anyApi.scores.getGlobalLeaderboard, {
    gameId: game.id,
    mode,
    limit: 10,
  }) as
    | Array<{
        rank: number;
        userId: string;
        username: string;
        score: number;
        createdAt: number;
      }>
    | undefined;

  const personalBests = useQuery(anyApi.scores.getPersonalBests, {
    userId: sessionUser?.userId,
  }) as PersonalBest[] | undefined;

  return (
    <div className="leaderboard-stack">
      <Panel className="leaderboard-panel leaderboard-panel-yours">
        <span className="eyebrow">Your Bests</span>
        <div className="leaderboard-list">
          {sessionUser ? (
            personalBests?.length ? (
              personalBests.map((entry) => (
                <div
                  className="leaderboard-row"
                  key={`${entry.gameId}-${entry.mode}`}
                >
                  <strong>{entry.gameId}</strong>
                  <span>{entry.mode}</span>
                  <span>{entry.score}</span>
                  <small>{formatDate(entry.createdAt)}</small>
                </div>
              ))
            ) : (
              <p className="muted-copy">Empty.</p>
            )
          ) : (
            <p className="muted-copy">Enter.</p>
          )}
        </div>
      </Panel>
      <Panel className="leaderboard-panel leaderboard-panel-global">
        <span className="eyebrow">Global</span>
        <h2>{game.name}</h2>
        <div className="leaderboard-list leaderboard-list-fill">
          {leaderboard?.length ? (
            leaderboard.map((entry) => (
              <div className="leaderboard-row" key={entry.userId}>
                <span>{entry.rank}</span>
                <strong>{entry.username}</strong>
                <span>{entry.score}</span>
                <small>{formatDate(entry.createdAt)}</small>
              </div>
            ))
          ) : (
            <p className="muted-copy">Empty.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function LeaderboardBrowser({
  sessionUser,
}: {
  sessionUser: SessionUser | null;
}) {
  const [gameId, setGameId] = useState(gameRegistry[0]?.id ?? "snake");
  const { available } = useConvexAvailability();
  const currentGame = useMemo(
    () => gameRegistry.find((game) => game.id === gameId) ?? gameRegistry[0],
    [gameId],
  );

  return (
    <section className="leaderboard-page">
      <div className="tab-row">
        {gameRegistry.map((game) => (
          <Button
            key={game.id}
            variant={game.id === gameId ? "primary" : "ghost"}
            onClick={() => setGameId(game.id)}
          >
            {game.name}
          </Button>
        ))}
      </div>
      {available ? (
        <LiveLeaderboards sessionUser={sessionUser} gameId={gameId} />
      ) : (
        <Panel className="leaderboard-panel leaderboard-panel-global">
          <span className="eyebrow">Global</span>
          <h2>{currentGame.name}</h2>
          <p className="muted-copy">No Convex.</p>
        </Panel>
      )}
    </section>
  );
}
