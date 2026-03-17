import { clsx } from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

export function normalizeUsername(username: string) {
  return username.trim().replace(/\s+/g, " ");
}

export function usernameKey(username: string) {
  return normalizeUsername(username).toLowerCase();
}

export function formatDate(value: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function formatScore(score: number, scoreType: "points" | "lines") {
  return `${score.toLocaleString()} ${scoreType}`;
}

export function randomRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

export function json<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}
