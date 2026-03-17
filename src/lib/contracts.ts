export type ThemeId = "neon-dusk";

export type SessionUser = {
  userId: string;
  username: string;
  themeId: ThemeId;
  createdAt: number;
  lastSeenAt: number;
  sessionExpiresAt: number;
};

export type GameMode = {
  id: string;
  label: string;
  description: string;
  leaderboardLabel: string;
  isRealtime?: boolean;
};

export type GameManifest = {
  id: string;
  name: string;
  tag: string;
  description: string;
  scoreType: "points" | "lines";
  thumbnail: string;
  accent: string;
  controls: string[];
  modes: GameMode[];
};

export type ScoreSubmission = {
  gameId: string;
  mode: string;
  score: number;
  durationMs: number;
  stats: Record<string, unknown>;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  score: number;
  createdAt: number;
  durationMs: number;
};

export type PersonalBest = {
  gameId: string;
  mode: string;
  score: number;
  createdAt: number;
};

export type SoloGameResult = {
  score: number;
  durationMs: number;
  stats: Record<string, unknown>;
};

export type MultiplayerPlayerSnapshot = {
  userId: string;
  username: string;
  connectionId: string;
  color: string;
  score: number;
  ready: boolean;
  alive: boolean;
};

export type SnakeSegment = {
  x: number;
  y: number;
};

export type SnakeDirection = "up" | "down" | "left" | "right";

export type MultiplayerState = {
  roomCode: string;
  status: "waiting" | "countdown" | "running" | "finished";
  boardSize: { width: number; height: number };
  food: SnakeSegment | null;
  players: MultiplayerPlayerSnapshot[];
  snakes: Record<string, SnakeSegment[]>;
  countdownEndsAt?: number;
  winnerUserId?: string;
  winnerLabel?: string;
  resultLabel?: string;
};

export type PartyClientMessage =
  | { type: "join"; userId: string; username: string }
  | { type: "ready"; ready: boolean }
  | { type: "input"; direction: SnakeDirection }
  | { type: "rematch" };

export type PartyServerMessage =
  | { type: "state"; payload: MultiplayerState }
  | { type: "error"; message: string }
  | { type: "gameOver"; payload: MultiplayerState };
