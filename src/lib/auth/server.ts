import "server-only";

import { verify as verifyArgon2, hash as hashArgon2 } from "@node-rs/argon2";
import { cookies } from "next/headers";
import { createHmac, randomBytes } from "node:crypto";
import { anyApi } from "convex/server";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/auth/shared";
import type { SessionUser } from "@/lib/contracts";
import { runConvexFunction } from "@/lib/convex-server";
import { defaultThemeId } from "@/lib/themes";
import { usernameKey } from "@/lib/utils";

export async function hashPassword(password: string) {
  return hashArgon2(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string) {
  return verifyArgon2(hash, password);
}

export function hashSessionToken(token: string) {
  const secret = process.env.SESSION_SECRET ?? "friends-arcade-dev-secret";
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function createUserSession(args: {
  username: string;
  passwordHash?: string;
  password?: string;
}) {
  const normalizedUsername = args.username.trim();
  const usernameLower = usernameKey(normalizedUsername);

  const existing = await runConvexFunction(
    anyApi.users.getByUsernameLower,
    { usernameLower },
  );

  let userId = existing?._id as string | undefined;
  let passwordHash = existing?.passwordHash;

  if (!existing) {
    const nextHash =
      args.passwordHash ?? (args.password ? await hashPassword(args.password) : null);

    if (!nextHash) {
      throw new Error("PASSWORD_HASH_REQUIRED");
    }

    const created = await runConvexFunction(
      anyApi.users.create,
      {
        username: normalizedUsername,
        usernameLower,
        passwordHash: nextHash,
        themeId: defaultThemeId,
      },
    );
    userId = created.userId as string;
    passwordHash = nextHash;
  }

  return {
    userId: userId!,
    passwordHash: passwordHash!,
    usernameLower,
  };
}

export async function persistSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;

  await runConvexFunction(
    anyApi.sessions.create,
    { userId, tokenHash, expiresAt },
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
    path: "/",
  });

  return { expiresAt };
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await runConvexFunction(
      anyApi.sessions.revokeByTokenHash,
      { tokenHash: hashSessionToken(token) },
    );
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const sessionUser = await runConvexFunction(
    anyApi.sessions.getSessionUserByTokenHash,
    { tokenHash: hashSessionToken(token) },
  );

  return (sessionUser as SessionUser | null) ?? null;
}
