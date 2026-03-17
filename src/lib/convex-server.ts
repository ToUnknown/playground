import "server-only";

import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";

type AdminConvexClient = ConvexHttpClient & {
  setAdminAuth: (token: string) => void;
  setFetchOptions: (options: { cache: "no-store" }) => void;
  function: <
    T extends FunctionReference<"query" | "mutation" | "action">,
  >(
    fn: T,
    componentPath: undefined,
    args: Record<string, unknown>,
  ) => Promise<FunctionReturnType<T>>;
};

export function isConvexConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export function convexServerOptions() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;

  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  }

  return {
    url,
    adminToken: process.env.CONVEX_DEPLOY_KEY,
  };
}

export function createConvexAdminClient() {
  const { url, adminToken } = convexServerOptions();
  const client = new ConvexHttpClient(url) as AdminConvexClient;

  if (!adminToken) {
    throw new Error("CONVEX_DEPLOY_KEY is not configured.");
  }

  client.setAdminAuth(adminToken);
  client.setFetchOptions({ cache: "no-store" });
  return client;
}

export async function runConvexFunction<
  T extends FunctionReference<"query" | "mutation" | "action">,
>(
  fn: T,
  args: Record<string, unknown>,
): Promise<FunctionReturnType<T>> {
  const client = createConvexAdminClient();
  return client.function(fn, undefined, args as never);
}
