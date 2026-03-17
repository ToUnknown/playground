import { anyApi } from "convex/server";

import { isConvexConfigured, runConvexFunction } from "@/lib/convex-server";
import { matchPersistSchema } from "@/lib/schemas";
import { json } from "@/lib/utils";

export async function POST(request: Request) {
  const token = request.headers.get("authorization");
  const expected = process.env.PARTYKIT_SERVER_TOKEN;

  if (!expected || token !== `Bearer ${expected}`) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isConvexConfigured()) {
    return json(
      { error: "Convex is not configured yet." },
      { status: 503 },
    );
  }

  const payload = matchPersistSchema.safeParse(await request.json());
  if (!payload.success) {
    return json({ error: "Invalid match payload." }, { status: 400 });
  }

  await runConvexFunction(
    anyApi.matches.create,
    payload.data,
  );

  return json({ status: "saved" });
}
