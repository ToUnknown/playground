"use client";

import type { TetrisPieceType } from "@/games/tetris/gameboy-tetris-engine";

export type GameboyTetrisAssets = {
  pieces: Record<TetrisPieceType, HTMLImageElement>;
  scoreBoard: HTMLImageElement;
  titleScreen: HTMLImageElement;
  wall: HTMLImageElement;
};

let assetPromise: Promise<GameboyTetrisAssets> | null = null;
let fontPromise: Promise<void> | null = null;
const GAMEBOY_FONT_DESCRIPTOR = '16px "Gameboy Tetris"';
const GAMEBOY_FONT_SAMPLE = "PLAYDROUND";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

export function ensureGameboyTetrisFont() {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return Promise.resolve();
  }

  if (!fontPromise) {
    fontPromise = (async () => {
      const alreadyLoaded = await document.fonts.load(
        GAMEBOY_FONT_DESCRIPTOR,
        GAMEBOY_FONT_SAMPLE,
      );
      if (alreadyLoaded.length > 0) {
        return;
      }

      if (typeof window === "undefined" || !("FontFace" in window)) {
        return;
      }

      const font = new FontFace("Gameboy Tetris", 'url("/tetris-gameboy-assets/font.ttf")');
      const loadedFont = await font.load();
      document.fonts.add(loadedFont);
      await document.fonts.load(GAMEBOY_FONT_DESCRIPTOR, GAMEBOY_FONT_SAMPLE);
    })().catch((error) => {
      fontPromise = null;
      throw error;
    });
  }

  return fontPromise;
}

export function loadGameboyTetrisAssets() {
  if (!assetPromise) {
    void ensureGameboyTetrisFont().catch(() => undefined);

    assetPromise = Promise.all([
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
    ]).then(([i, j, l, o, s, t, z, scoreBoard, titleScreen, wall]) => ({
      pieces: { i, j, l, o, s, t, z },
      scoreBoard,
      titleScreen,
      wall,
    }));
  }

  return assetPromise;
}
