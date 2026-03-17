export const GAMEBOY_SCREEN_WIDTH = 320;
export const GAMEBOY_SCREEN_HEIGHT = 288;
export const GAMEBOY_SCREEN_RESOLUTION_SCALE = 1.125;
export const GAMEBOY_SCREEN_BACKING_WIDTH = Math.round(
  GAMEBOY_SCREEN_WIDTH * GAMEBOY_SCREEN_RESOLUTION_SCALE,
);
export const GAMEBOY_SCREEN_BACKING_HEIGHT = Math.round(
  GAMEBOY_SCREEN_HEIGHT * GAMEBOY_SCREEN_RESOLUTION_SCALE,
);

export function configureGameboyScreenCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = false;
  context.setTransform(
    canvas.width / GAMEBOY_SCREEN_WIDTH,
    0,
    0,
    canvas.height / GAMEBOY_SCREEN_HEIGHT,
    0,
    0,
  );
}
