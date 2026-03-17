import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

function isSupportedLeaderboardRun(
  gameId: string,
  stats: unknown,
) {
  if (gameId !== "tetris") {
    return true;
  }

  const leaderboardVersion = (stats as { leaderboardVersion?: unknown } | null)?.leaderboardVersion;
  return leaderboardVersion === "gameboy-tetris-v1";
}

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    gameId: v.string(),
    mode: v.string(),
    score: v.number(),
    durationMs: v.number(),
    stats: v.any(),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("scoreRuns", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getGlobalLeaderboard = query({
  args: {
    gameId: v.string(),
    mode: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const runs = await ctx.db
      .query("scoreRuns")
      .withIndex("by_game_mode_score", (q) => q.eq("gameId", args.gameId))
      .collect();

    const rankedRuns = runs
      .filter((run) => run.mode === args.mode && isSupportedLeaderboardRun(args.gameId, run.stats))
      .sort((a, b) => b.score - a.score)
      .slice(0, 200);

    const winners = new Map<
      string,
      { run: (typeof rankedRuns)[number]; username: string }
    >();

    for (const run of rankedRuns) {
      if (winners.has(run.userId)) {
        continue;
      }

      const user = await ctx.db.get(run.userId);
      if (!user) {
        continue;
      }

      winners.set(run.userId, { run, username: user.username });
      if (winners.size >= (args.limit ?? 10)) {
        break;
      }
    }

    return Array.from(winners.values()).map(({ run, username }, index) => ({
      rank: index + 1,
      userId: run.userId,
      username,
      score: run.score,
      createdAt: run.createdAt,
      durationMs: run.durationMs,
    }));
  },
});

export const getPersonalBests = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const userId = args.userId;

    if (!userId) {
      return [];
    }

    const runs = await ctx.db
      .query("scoreRuns")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    const bests = new Map<
      string,
      { gameId: string; mode: string; score: number; createdAt: number }
    >();

    for (const run of runs) {
      if (!isSupportedLeaderboardRun(run.gameId, run.stats)) {
        continue;
      }

      const key = `${run.gameId}:${run.mode}`;
      const previous = bests.get(key);
      if (!previous || run.score > previous.score) {
        bests.set(key, {
          gameId: run.gameId,
          mode: run.mode,
          score: run.score,
          createdAt: run.createdAt,
        });
      }
    }

    return Array.from(bests.values()).sort((a, b) => b.score - a.score);
  },
});
