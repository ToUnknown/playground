"use client";

import type { TetrisPieceType } from "@/games/tetris/gameboy-tetris-engine";

export type GameboyTetrisAssets = {
  pieces: Record<TetrisPieceType, HTMLImageElement>;
  scoreBoard: HTMLImageElement;
  titleScreen: HTMLImageElement;
  wall: HTMLImageElement;
};

let assetPromise: Promise<GameboyTetrisAssets> | null = null;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

async function ensureFont() {
  if (typeof window === "undefined" || !("FontFace" in window)) {
    return;
  }

  const font = new FontFace("Gameboy Tetris", 'url("/tetris-gameboy-assets/font.ttf")');
  await font.load();
  document.fonts.add(font);
}

export function loadGameboyTetrisAssets() {
  if (!assetPromise) {
    assetPromise = Promise.all([
      ensureFont().catch(() => undefined),
      loadImage("/tetris-gameboy-assets/i.png"),
      loadImage("/tetris-gameboy-assets/j.png"),
      loadImage("/tetris-gameboy-assets/l.png"),
      loadImage("/tetris-gameboy-assets/o.png"),
      loadImage("/tetris-gameboy-assets/s.png"),
      loadImage("/tetris-gameboy-assets/t.png"),
      loadImage("/tetris-gameboy-assets/z.png"),
      loadImage("/tetris-gameboy-assets/score_board.svg"),
      loadImage("/tetris-gameboy-assets/title_screen.jpg"),
      loadImage("/tetris-gameboy-assets/wall.png"),
    ]).then(([, i, j, l, o, s, t, z, scoreBoard, titleScreen, wall]) => ({
      pieces: { i, j, l, o, s, t, z },
      scoreBoard,
      titleScreen,
      wall,
    }));
  }

  return assetPromise;
}
