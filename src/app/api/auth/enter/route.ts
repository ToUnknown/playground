import { anyApi } from "convex/server";

import { persistSession, verifyPassword } from "@/lib/auth/server";
import { isConvexConfigured, runConvexFunction } from "@/lib/convex-server";
import { authSchema } from "@/lib/schemas";
import { json, normalizeUsername, usernameKey } from "@/lib/utils";

export async function POST(request: Request) {
  if (!isConvexConfigured()) {
    return json(
      { error: "Convex is not configured yet." },
      { status: 503 },
    );
  }

  const payload = authSchema.safeParse(await request.json());
  if (!payload.success) {
    return json({ error: "Enter a valid name and password." }, { status: 400 });
  }

  const username = normalizeUsername(payload.data.username);
  const existing = await runConvexFunction(
    anyApi.users.getByUsernameLower,
    { usernameLower: usernameKey(username) },
  );

  if (!existing) {
    return json({ status: "needs_confirmation" });
  }

  const passwordValid = await verifyPassword(
    existing.passwordHash,
    payload.data.password,
  );

  if (!passwordValid) {
    return json({ error: "Wrong password for that name." }, { status: 401 });
  }

  await persistSession(existing._id as string);
  await runConvexFunction(
    anyApi.users.touchLastSeen,
    { userId: existing._id },
  );

  return json({ status: "authenticated" });
}
