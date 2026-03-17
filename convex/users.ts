import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

export const getByUsernameLower = internalQuery({
  args: { usernameLower: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_username_lower", (q) =>
        q.eq("usernameLower", args.usernameLower),
      )
      .unique();
  },
});

export const getById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const create = internalMutation({
  args: {
    username: v.string(),
    usernameLower: v.string(),
    passwordHash: v.string(),
    themeId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username_lower", (q) =>
        q.eq("usernameLower", args.usernameLower),
      )
      .unique();

    if (existing) {
      throw new Error("USERNAME_TAKEN");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      username: args.username,
      usernameLower: args.usernameLower,
      passwordHash: args.passwordHash,
      createdAt: now,
      lastSeenAt: now,
    });

    await ctx.db.insert("userPreferences", {
      userId,
      themeId: args.themeId,
      createdAt: now,
      updatedAt: now,
    });

    return { userId };
  },
});

export const touchLastSeen = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { lastSeenAt: Date.now() });
  },
});
