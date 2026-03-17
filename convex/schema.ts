import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    usernameLower: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  }).index("by_username_lower", ["usernameLower"]),
  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user_id", ["userId"]),
  userPreferences: defineTable({
    userId: v.id("users"),
    themeId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),
  scoreRuns: defineTable({
    userId: v.id("users"),
    gameId: v.string(),
    mode: v.string(),
    score: v.number(),
    durationMs: v.number(),
    stats: v.any(),
    createdAt: v.number(),
  })
    .index("by_game_mode_score", ["gameId", "mode", "score"])
    .index("by_user_id", ["userId"]),
  multiplayerMatches: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_game_id", ["gameId"])
    .index("by_room_code", ["roomCode"]),
});
