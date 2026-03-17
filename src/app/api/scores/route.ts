import { anyApi } from "convex/server";

import { getSessionUser } from "@/lib/auth/server";
import { isConvexConfigured, runConvexFunction } from "@/lib/convex-server";
import { getGameManifest } from "@/lib/game-registry";
import { scoreSubmissionSchema } from "@/lib/schemas";
import { json } from "@/lib/utils";

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return json({ error: "Log in before submitting scores." }, { status: 401 });
  }

  if (!isConvexConfigured()) {
    return json(
      { error: "Convex is not configured yet." },
      { status: 503 },
    );
  }

  const payload = scoreSubmissionSchema.safeParse(await request.json());
  if (!payload.success) {
    return json({ error: "Invalid score payload." }, { status: 400 });
  }

  const game = getGameManifest(payload.data.gameId);
  const modeExists = game?.modes.some((mode) => mode.id === payload.data.mode);

  if (!game || !modeExists) {
    return json({ error: "Unknown game mode." }, { status: 400 });
  }

  await runConvexFunction(
    anyApi.scores.create,
    {
      userId: sessionUser.userId,
      ...payload.data,
    },
  );

  return json({ status: "saved" });
}
