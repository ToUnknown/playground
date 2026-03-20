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
    controls: [
      "Arrow keys to steer",
      "Eat shards",
      "Do not touch walls or yourself",
      "Z toggles zoom",
    ],
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
      "Arrow keys move, and Up rotates clockwise",
      "A rotates counterclockwise",
      "B hard drops",
      "Enter or Start begins, pauses, and restarts",
      "Z toggles zoom",
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
  {
    id: "blackjack",
    name: "Blackjack",
    tag: "Card hustle",
    description:
      "Minimal Game Boy Blackjack with adjustable bets, pixel cards, and bank-climbing score runs.",
    scoreType: "points",
    thumbnail: "B-03",
    accent: "#d2df93",
    controls: [
      "Arrow up/down adjusts your bet",
      "Enter or Start deals and advances",
      "A hits",
      "B or X stands",
      "Z toggles zoom",
      "Shift or Select exits",
    ],
    modes: [
      {
        id: "solo",
        label: "Solo",
        description: "Run your bank as high as you can before you flame out.",
        leaderboardLabel: "Max bank",
      },
    ],
  },
];

export function getGameManifest(gameId: string) {
  return gameRegistry.find((game) => game.id === gameId) ?? null;
}
