import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("userPreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const upsertTheme = internalMutation({
  args: {
    userId: v.id("users"),
    themeId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        themeId: args.themeId,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("userPreferences", {
      userId: args.userId,
      themeId: args.themeId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
