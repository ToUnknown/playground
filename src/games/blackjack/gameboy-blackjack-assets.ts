"use client";

import { ensureGameboyTetrisFont } from "@/games/tetris/gameboy-tetris-assets";

export const BLACKJACK_SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export const BLACKJACK_RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

export type BlackjackSuit = (typeof BLACKJACK_SUITS)[number];
export type BlackjackRank = (typeof BLACKJACK_RANKS)[number];

export type GameboyBlackjackAssets = {
  faces: Record<string, HTMLImageElement>;
  back: HTMLImageElement;
  chip: HTMLImageElement;
};

const SUIT_CODES: Record<BlackjackSuit, string> = {
  clubs: "c",
  diamonds: "d",
  hearts: "h",
  spades: "s",
};

const RANK_CODES: Record<BlackjackRank, string> = {
  A: "a",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  J: "j",
  Q: "q",
  K: "k",
};

let assetPromise: Promise<GameboyBlackjackAssets> | null = null;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

export function getBlackjackCardAssetKey(suit: BlackjackSuit, rank: BlackjackRank) {
  return `${SUIT_CODES[suit]}-${RANK_CODES[rank]}`;
}

export function loadGameboyBlackjackAssets() {
  if (!assetPromise) {
    const requests = BLACKJACK_SUITS.flatMap((suit) =>
      BLACKJACK_RANKS.map((rank) =>
        loadImage(
          `/blackjack-gameboy-assets/cards/${getBlackjackCardAssetKey(suit, rank)}.svg`,
        ).then((image) => [getBlackjackCardAssetKey(suit, rank), image] as const),
      ),
    );

    assetPromise = Promise.all([
      ensureGameboyTetrisFont().catch(() => undefined),
      ...requests,
      loadImage("/blackjack-gameboy-assets/back.svg"),
      loadImage("/blackjack-gameboy-assets/chip.svg"),
    ]).then((results) => {
      const back = results.at(-2) as HTMLImageElement;
      const chip = results.at(-1) as HTMLImageElement;
      const faces = Object.fromEntries(
        results.slice(1, -2) as Array<readonly [string, HTMLImageElement]>,
      );

      return {
        faces,
        back,
        chip,
      };
    });
  }

  return assetPromise;
}
