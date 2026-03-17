import { createUserSession, persistSession } from "@/lib/auth/server";
import { isConvexConfigured } from "@/lib/convex-server";
import { authSchema } from "@/lib/schemas";
import { json } from "@/lib/utils";

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

  try {
    const session = await createUserSession({
      username: payload.data.username,
      password: payload.data.password,
    });

    await persistSession(session.userId);

    return json({ status: "created" });
  } catch (error) {
    if (error instanceof Error && error.message === "USERNAME_TAKEN") {
      return json(
        { error: "That name was just taken. Try logging in instead." },
        { status: 409 },
      );
    }

    return json({ error: "Unable to create account." }, { status: 500 });
  }
}
