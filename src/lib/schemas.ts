import { z } from "zod";

export const authSchema = z.object({
  username: z.string().min(2).max(24),
  password: z.string().min(4).max(72),
});

export const scoreSubmissionSchema = z.object({
  gameId: z.string().min(1),
  mode: z.string().min(1),
  score: z.number().int().nonnegative().max(9_999_999),
  durationMs: z.number().int().nonnegative().max(60 * 60 * 1000),
  stats: z.record(z.string(), z.unknown()),
});

export const matchPersistSchema = z.object({
  gameId: z.string().min(1),
  roomCode: z.string().min(1),
  result: z.string().min(1),
  winnerUserId: z.string().optional(),
  summary: z.record(z.string(), z.unknown()),
  players: z
    .array(
      z.object({
        userId: z.string(),
        username: z.string(),
        score: z.number().int().nonnegative(),
      }),
    )
    .min(2)
    .max(2),
});
