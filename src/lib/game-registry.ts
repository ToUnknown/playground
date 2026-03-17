import type { GameManifest } from "@/lib/contracts";

export const gameRegistry: GameManifest[] = [
  {
    id: "snake",
    name: "Snake",
    tag: "Arcade chase",
    description:
      "Classic solo Snake with quick rounds, pressure ramps, and leaderboard-worthy greed.",
    scoreType: "points",
    thumbnail: "S-01",
    accent: "#74f7b2",
    controls: ["Arrow keys to steer", "Eat shards", "Do not touch walls or yourself"],
    modes: [
      {
        id: "solo",
        label: "Solo",
        description: "Endless solo run for personal bests and global rank.",
        leaderboardLabel: "Solo score",
      },
      {
        id: "duel",
        label: "Snake 1v1",
        description: "Private room code duel on one field.",
        leaderboardLabel: "Match wins",
        isRealtime: true,
      },
    ],
  },
  {
    id: "tetris",
    name: "Tetris",
    tag: "Puzzle sprint",
    description:
      "Game Boy styled Tetris with title screen, hold, hard drops, and authentic retro presentation.",
    scoreType: "points",
    thumbnail: "T-02",
    accent: "#ffd05f",
    controls: [
      "Arrow keys move and rotate",
      "C or A holds the current piece",
      "Space, X, or B hard drops",
      "Enter or Start begins, pauses, and restarts",
    ],
    modes: [
      {
        id: "solo",
        label: "Solo",
        description: "Score-chasing Game Boy Tetris run.",
        leaderboardLabel: "High score",
      },
    ],
  },
];

export function getGameManifest(gameId: string) {
  return gameRegistry.find((game) => game.id === gameId) ?? null;
}
