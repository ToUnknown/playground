import "server-only";

export function getEnv(name: string) {
  return process.env[name];
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function hasConvexEnv() {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export function publicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
