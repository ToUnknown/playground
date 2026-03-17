import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      userId: args.userId,
      tokenHash: args.tokenHash,
      createdAt,
      expiresAt: args.expiresAt,
    });

    return { sessionId };
  },
});

export const revokeByTokenHash = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!session || session.revokedAt) {
      return null;
    }

    await ctx.db.patch(session._id, { revokedAt: Date.now() });
    return session._id;
  },
});

export const getSessionUserByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!session || session.revokedAt || session.expiresAt <= Date.now()) {
      return null;
    }

    const user = await ctx.db.get(session.userId);

    if (!user) {
      return null;
    }

    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();

    return {
      userId: user._id,
      username: user.username,
      themeId: preferences?.themeId ?? "neon-dusk",
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt ?? user.createdAt,
      sessionExpiresAt: session.expiresAt,
    };
  },
});
