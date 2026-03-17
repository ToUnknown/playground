import { v } from "convex/values";

import { internalMutation, query } from "./_generated/server";

export const create = internalMutation({
  args: {
    gameId: v.string(),
    roomCode: v.string(),
    winnerUserId: v.optional(v.id("users")),
    result: v.string(),
    summary: v.any(),
    players: v.array(
      v.object({
        userId: v.id("users"),
        username: v.string(),
        score: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("multiplayerMatches", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getRecentMatches = query({
  args: {
    gameId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("multiplayerMatches")
      .withIndex("by_game_id", (q) => q.eq("gameId", args.gameId))
      .order("desc")
      .take(args.limit ?? 5);
  },
});
