"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import type {
  GameboyControlButton,
  GameboyControlPulse,
} from "@/components/arcade/gameboy-games";
import { useScoreSave } from "@/games/shared/use-score-save";
import {
  loadGameboyTetrisAssets,
  type GameboyTetrisAssets,
} from "@/games/tetris/gameboy-tetris-assets";
import {
  GAMEBOY_TETRIS_DARK,
  GAMEBOY_TETRIS_LIGHT,
} from "@/games/tetris/gameboy-tetris-theme";
import type { SessionUser, SoloGameResult } from "@/lib/contracts";
import type { GameboyAudioCue } from "@/lib/gameboy-audio";
import {
  configureGameboyScreenCanvas,
  GAMEBOY_SCREEN_BACKING_HEIGHT,
  GAMEBOY_SCREEN_BACKING_WIDTH,
  GAMEBOY_SCREEN_HEIGHT,
  GAMEBOY_SCREEN_WIDTH,
} from "@/lib/gameboy-screen";

type GameboySnakeProps = {
  controlPulse: GameboyControlPulse | null;
  sessionUser: SessionUser | null;
  onExit: () => void;
  onAudioCue?: (cue: GameboyAudioCue) => void;
};

type SnakePoint = { x: number; y: number };
type SnakeDirection = SnakePoint;
type SnakeGameStatus = "ready" | "playing" | "paused" | "gameOver";

const SCREEN_WIDTH = GAMEBOY_SCREEN_WIDTH;
const SCREEN_HEIGHT = GAMEBOY_SCREEN_HEIGHT;
const GRID_SIZE = 16;
const CELL_SIZE = 12;
const BOARD_SIZE = GRID_SIZE * CELL_SIZE;
const BOARD_LEFT = Math.floor((SCREEN_WIDTH - BOARD_SIZE) / 2);
const BOARD_TOP = 70;
const BOARD_BOTTOM = BOARD_TOP + BOARD_SIZE;
const HUD_LEFT = 32;
const HUD_TOP = 14;
const HUD_WIDTH = SCREEN_WIDTH - HUD_LEFT * 2;
const HUD_HEIGHT = 42;
const WALL_WIDTH = 12;
const WALL_LEFT = BOARD_LEFT - WALL_WIDTH;
const WALL_RIGHT = BOARD_LEFT + BOARD_SIZE;
const WALL_TOP = BOARD_TOP - WALL_WIDTH;
const WALL_BOTTOM = BOARD_BOTTOM;
const WALL_OUTER_WIDTH = WALL_RIGHT + WALL_WIDTH - WALL_LEFT;
const FONT_FAMILY = '"Gameboy Tetris", "IBM Plex Sans", monospace';
const HUD_VALUE_FONT_SIZE = 14;
const FALLBACK_BG = GAMEBOY_TETRIS_LIGHT;
const FALLBACK_DARK = GAMEBOY_TETRIS_DARK;
const FALLBACK_DEEP = GAMEBOY_TETRIS_DARK;
const GRID_LINE = "rgba(64, 66, 67, 0.14)";
const SNAKE_FILL = "#5f6955";
const SNAKE_SHADOW = "#353736";
const SNAKE_HIGHLIGHT = "#aab68a";
const SNAKE_CORE = "#495043";
const APPLE_FILL = "#6c7557";
const APPLE_HIGHLIGHT = "#cfd8a8";
const INITIAL_SNAKE: SnakePoint[] = [
  { x: 8, y: 8 },
  { x: 7, y: 8 },
  { x: 6, y: 8 },
];

const SNAKE_DIRECTIONS: Record<
  Extract<GameboyControlButton, "up" | "down" | "left" | "right">,
  SnakeDirection
> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function createInitialSnake() {
  return INITIAL_SNAKE.map((segment) => ({ ...segment }));
}

function samePoint(a: SnakePoint, b: SnakePoint) {
  return a.x === b.x && a.y === b.y;
}

function randomSnakeFood(snake: SnakePoint[]) {
  if (snake.length >= GRID_SIZE * GRID_SIZE) {
    return null;
  }

  let candidate = { x: 0, y: 0 };
  do {
    candidate = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some((segment) => samePoint(segment, candidate)));

  return candidate;
}

function isOppositeDirection(a: SnakeDirection, b: SnakeDirection) {
  return a.x === b.x * -1 && a.y === b.y * -1;
}

function formatValue(value: number, width = 2) {
  return String(value).padStart(width, "0");
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${formatValue(minutes)}:${formatValue(seconds)}`;
}

function usePulseEffect(
  controlPulse: GameboyControlPulse | null,
  handler: (button: GameboyControlButton) => void,
  options?: { ignoreInitialPulse?: boolean },
) {
  const onPulse = useEffectEvent(handler);
  const lastSeqRef = useRef<number | null>(null);
  const ignoredInitialPulseRef = useRef(false);

  useEffect(() => {
    if (!controlPulse || lastSeqRef.current === controlPulse.seq) {
      return;
    }

    if (options?.ignoreInitialPulse && !ignoredInitialPulseRef.current) {
      ignoredInitialPulseRef.current = true;
      lastSeqRef.current = controlPulse.seq;
      return;
    }

    lastSeqRef.current = controlPulse.seq;
    if (!controlPulse.pressed) {
      return;
    }
    onPulse(controlPulse.button);
  }, [controlPulse, options?.ignoreInitialPulse]);
}

function drawWallColumn(
  context: CanvasRenderingContext2D,
  assets: GameboyTetrisAssets | null,
  x: number,
  top: number,
  height: number,
) {
  context.fillStyle = FALLBACK_DARK;
  context.fillRect(x, top, WALL_WIDTH, height);

  if (!assets) {
    return;
  }

  for (let offset = -2; offset < height + 4; offset += 8) {
    context.drawImage(assets.wall, x + 1, top + offset, WALL_WIDTH - 2, 8);
  }
}

function drawWallRow(
  context: CanvasRenderingContext2D,
  assets: GameboyTetrisAssets | null,
  x: number,
  y: number,
  width: number,
) {
  context.fillStyle = FALLBACK_DARK;
  context.fillRect(x, y, width, WALL_WIDTH);

  if (!assets) {
    return;
  }

  for (let offset = -2; offset < width + 4; offset += 10) {
    const tileWidth = Math.min(10, width - offset);
    if (tileWidth <= 0) {
      continue;
    }
    context.drawImage(assets.wall, x + offset, y + 2, tileWidth, 8);
  }
}

function drawPanel(
  context: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  context.fillStyle = FALLBACK_BG;
  context.fillRect(x, y, width, HUD_HEIGHT);
  context.strokeStyle = FALLBACK_DARK;
  context.lineWidth = 2;
  context.strokeRect(x + 0.5, y + 0.5, width - 1, HUD_HEIGHT - 1);

  context.fillStyle = FALLBACK_DARK;
  context.textAlign = "left";
  context.font = `10px ${FONT_FAMILY}`;
  context.fillText(label, x + 10, y + 12);

  context.textAlign = "center";
  context.font = `${HUD_VALUE_FONT_SIZE}px ${FONT_FAMILY}`;
  context.fillText(value, x + width / 2, y + 30);
}

function drawPieceTile(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  context.fillStyle = SNAKE_SHADOW;
  context.fillRect(x + 1, y + 1, size - 2, size - 2);

  context.fillStyle = SNAKE_FILL;
  context.fillRect(x + 2, y + 2, size - 4, size - 4);

  context.fillStyle = SNAKE_HIGHLIGHT;
  context.fillRect(x + 3, y + 2, size - 6, 1);
  context.fillRect(x + 2, y + 3, 1, size - 6);

  context.fillStyle = SNAKE_CORE;
  context.fillRect(x + 4, y + 3, size - 8, size - 6);

  context.fillStyle = SNAKE_HIGHLIGHT;
  context.fillRect(x + 5, y + 4, size - 10, 1);

  context.fillStyle = FALLBACK_BG;
  context.fillRect(x + 1, y + 1, 1, 1);
  context.fillRect(x + size - 2, y + 1, 1, 1);
  context.fillRect(x + 1, y + size - 2, 1, 1);
  context.fillRect(x + size - 2, y + size - 2, 1, 1);
}

function drawSnakeHead(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  direction: SnakeDirection,
) {
  drawPieceTile(context, x, y, size);

  const eyes =
    direction.x > 0
      ? [
          { x: x + size - 4, y: y + 3 },
          { x: x + size - 4, y: y + size - 5 },
        ]
      : direction.x < 0
        ? [
            { x: x + 2, y: y + 3 },
            { x: x + 2, y: y + size - 5 },
          ]
        : direction.y < 0
          ? [
              { x: x + 3, y: y + 2 },
              { x: x + size - 5, y: y + 2 },
            ]
          : [
              { x: x + 3, y: y + size - 4 },
              { x: x + size - 5, y: y + size - 4 },
            ];

  context.fillStyle = FALLBACK_BG;
  eyes.forEach((eye) => {
    context.fillRect(eye.x, eye.y, 2, 2);
  });
}

function drawApple(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const centerX = x + size / 2;
  const centerY = y + size / 2 + 0.5;
  const radius = size / 2 - 2.5;

  context.fillStyle = APPLE_FILL;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = FALLBACK_DARK;
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = APPLE_HIGHLIGHT;
  context.beginPath();
  context.arc(centerX - 2, centerY - 2, 1.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = FALLBACK_DARK;
  context.fillRect(Math.round(centerX) - 1, y + 1, 2, 3);
  context.fillRect(Math.round(centerX) + 1, y + 1, 2, 1);
}

function drawOverlay(
  context: CanvasRenderingContext2D,
  title: string,
  action: string,
) {
  context.fillStyle = "rgba(198, 207, 161, 0.94)";
  context.fillRect(42, 108, 236, 72);
  context.strokeStyle = FALLBACK_DARK;
  context.lineWidth = 2;
  context.strokeRect(42, 108, 236, 72);

  context.fillStyle = FALLBACK_DARK;
  context.textAlign = "center";
  context.font = `16px ${FONT_FAMILY}`;
  context.fillText(title, SCREEN_WIDTH / 2, 138);
  context.font = `10px ${FONT_FAMILY}`;
  context.fillText(action, SCREEN_WIDTH / 2, 156);
  context.fillText("SELECT FOR MENU", SCREEN_WIDTH / 2, 170);
  context.textAlign = "left";
}

function drawSnakeSplash(context: CanvasRenderingContext2D) {
  context.fillStyle = FALLBACK_DARK;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  context.textAlign = "center";
  context.fillStyle = FALLBACK_BG;
  context.font = `42px ${FONT_FAMILY}`;
  context.textBaseline = "middle";
  context.fillText("SNAKE", SCREEN_WIDTH / 2, 142);
  context.font = `12px ${FONT_FAMILY}`;
  context.fillText("START", SCREEN_WIDTH / 2, 212);
  context.textBaseline = "alphabetic";
  context.textAlign = "left";
}

function drawSnakeScene(args: {
  context: CanvasRenderingContext2D;
  assets: GameboyTetrisAssets | null;
  snake: SnakePoint[];
  food: SnakePoint | null;
  score: number;
  status: SnakeGameStatus;
  result: SoloGameResult | null;
  runtimeMs: number;
  direction: SnakeDirection;
}) {
  const {
    context,
    assets,
    snake,
    food,
    score,
    status,
    result,
    runtimeMs,
    direction,
  } = args;
  const boardRight = BOARD_LEFT + BOARD_SIZE;
  const sizeValue = formatValue(snake.length);
  const scoreValue = String(score).padStart(3, "0");

  if (status === "ready") {
    drawSnakeSplash(context);
    return;
  }

  context.fillStyle = FALLBACK_DEEP;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  context.fillStyle = FALLBACK_DARK;
  context.fillRect(HUD_LEFT - 8, HUD_TOP - 6, HUD_WIDTH + 16, HUD_HEIGHT + 16);
  context.fillRect(BOARD_LEFT - 20, BOARD_TOP - 8, BOARD_SIZE + 40, BOARD_SIZE + 20);

  drawPanel(context, "SIZE", sizeValue, HUD_LEFT, HUD_TOP, 56);
  drawPanel(context, "RUN", formatDuration(runtimeMs), HUD_LEFT + 64, HUD_TOP, 78);
  drawPanel(
    context,
    "SCORE",
    scoreValue,
    HUD_LEFT + 150,
    HUD_TOP,
    HUD_WIDTH - 150,
  );

  drawWallRow(context, assets, WALL_LEFT, WALL_TOP, WALL_OUTER_WIDTH);
  drawWallColumn(context, assets, WALL_LEFT, BOARD_TOP, BOARD_SIZE);
  drawWallColumn(context, assets, WALL_RIGHT, BOARD_TOP, BOARD_SIZE);
  drawWallRow(context, assets, WALL_LEFT, WALL_BOTTOM, WALL_OUTER_WIDTH);

  context.fillStyle = FALLBACK_BG;
  context.fillRect(BOARD_LEFT, BOARD_TOP, BOARD_SIZE, BOARD_SIZE);
  context.strokeStyle = FALLBACK_DARK;
  context.lineWidth = 2;
  context.strokeRect(BOARD_LEFT - 0.5, BOARD_TOP - 0.5, BOARD_SIZE + 1, BOARD_SIZE + 1);

  context.strokeStyle = GRID_LINE;
  context.lineWidth = 1;
  for (let index = 1; index < GRID_SIZE; index += 1) {
    const x = BOARD_LEFT + index * CELL_SIZE + 0.5;
    const y = BOARD_TOP + index * CELL_SIZE + 0.5;

    context.beginPath();
    context.moveTo(x, BOARD_TOP);
    context.lineTo(x, BOARD_BOTTOM);
    context.stroke();

    context.beginPath();
    context.moveTo(BOARD_LEFT, y);
    context.lineTo(boardRight, y);
    context.stroke();
  }

  if (food) {
    const x = BOARD_LEFT + food.x * CELL_SIZE;
    const y = BOARD_TOP + food.y * CELL_SIZE;
    drawApple(context, x, y, CELL_SIZE);
  }

  snake.forEach((segment, index) => {
    const x = BOARD_LEFT + segment.x * CELL_SIZE;
    const y = BOARD_TOP + segment.y * CELL_SIZE;
    if (index === 0) {
      drawSnakeHead(context, x, y, CELL_SIZE, direction);
      return;
    }

    drawPieceTile(context, x, y, CELL_SIZE);
  });

  context.fillStyle = FALLBACK_DARK;
  context.font = `9px ${FONT_FAMILY}`;
  context.textAlign = "center";
  context.fillText("EAT TO GROW", SCREEN_WIDTH / 2, 276);
  context.textAlign = "left";

  if (status === "gameOver" && result) {
    drawOverlay(context, "GAME OVER", "START TO RESTART");
  } else if (status === "paused") {
    drawOverlay(context, "PAUSED", "START TO RESUME");
  }
}

export function GameboySnake({
  controlPulse,
  sessionUser,
  onExit,
  onAudioCue,
}: GameboySnakeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const directionRef = useRef<SnakeDirection>({ x: 1, y: 0 });
  const queuedRef = useRef<SnakeDirection>({ x: 1, y: 0 });
  const snakeRef = useRef<SnakePoint[]>(createInitialSnake());
  const foodRef = useRef<SnakePoint | null>(randomSnakeFood(INITIAL_SNAKE));
  const scoreRef = useRef(0);
  const statusRef = useRef<SnakeGameStatus>("ready");
  const elapsedMsRef = useRef(0);
  const resumedAtRef = useRef(0);
  const resultRef = useRef<SoloGameResult | null>(null);
  const [result, setResult] = useState<SoloGameResult | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [assets, setAssets] = useState<GameboyTetrisAssets | null>(null);
  const audioCueRef = useRef(onAudioCue);

  useEffect(() => {
    audioCueRef.current = onAudioCue;
  }, [onAudioCue]);

  const playAudioCue = (cue: GameboyAudioCue) => {
    audioCueRef.current?.(cue);
  };

  useScoreSave({
    manifestId: "snake",
    result,
    resetKey,
    sessionUser,
  });

  const finishGame = useEffectEvent((nextResult: SoloGameResult) => {
    if (statusRef.current === "playing" && resumedAtRef.current) {
      elapsedMsRef.current += Date.now() - resumedAtRef.current;
      resumedAtRef.current = 0;
    }
    statusRef.current = "gameOver";
    resultRef.current = nextResult;
    setResult(nextResult);
  });

  const resetGame = () => {
    directionRef.current = { x: 1, y: 0 };
    queuedRef.current = { x: 1, y: 0 };
    snakeRef.current = createInitialSnake();
    foodRef.current = randomSnakeFood(snakeRef.current);
    scoreRef.current = 0;
    statusRef.current = "ready";
    elapsedMsRef.current = 0;
    resumedAtRef.current = 0;
    resultRef.current = null;
    setResult(null);
    setResetKey((value) => value + 1);
  };

  useEffect(() => {
    let cancelled = false;

    void loadGameboyTetrisAssets().then((loadedAssets) => {
      if (!cancelled) {
        setAssets(loadedAssets);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  usePulseEffect(
    controlPulse,
    (button) => {
      if (button === "select") {
        onExit();
        return;
      }

      if (button === "start") {
        if (resultRef.current) {
          resetGame();
          statusRef.current = "playing";
          resumedAtRef.current = Date.now();
          playAudioCue("menuConfirm");
          return;
        }

        if (statusRef.current === "ready") {
          statusRef.current = "playing";
          resumedAtRef.current = Date.now();
          playAudioCue("menuConfirm");
          return;
        }

        if (statusRef.current === "playing") {
          elapsedMsRef.current += Date.now() - resumedAtRef.current;
          resumedAtRef.current = 0;
          statusRef.current = "paused";
          playAudioCue("pause");
          return;
        }

        if (statusRef.current === "paused") {
          statusRef.current = "playing";
          resumedAtRef.current = Date.now();
          playAudioCue("resume");
        }
        return;
      }

      if ((button === "a" || button === "b") && resultRef.current) {
        resetGame();
        playAudioCue("menuConfirm");
        return;
      }

      const nextDirection = SNAKE_DIRECTIONS[button as keyof typeof SNAKE_DIRECTIONS];
      if (!nextDirection || statusRef.current !== "playing") {
        return;
      }

      if (!isOppositeDirection(directionRef.current, nextDirection)) {
        queuedRef.current = nextDirection;
      }
    },
    { ignoreInitialPulse: true },
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    configureGameboyScreenCanvas(canvas, context);

    let animationFrame = 0;
    let lastTick = performance.now();
    let stopped = false;

    const step = () => {
      directionRef.current = queuedRef.current;
      const snake = snakeRef.current;
      const nextHead = {
        x: snake[0]!.x + directionRef.current.x,
        y: snake[0]!.y + directionRef.current.y,
      };
      const willGrow = foodRef.current ? samePoint(nextHead, foodRef.current) : false;
      const occupiedSnake = willGrow ? snake : snake.slice(0, -1);

      const collided =
        nextHead.x < 0 ||
        nextHead.y < 0 ||
        nextHead.x >= GRID_SIZE ||
        nextHead.y >= GRID_SIZE ||
        occupiedSnake.some((segment) => samePoint(segment, nextHead));

      if (collided) {
        playAudioCue("gameOver");
        const durationMs =
          elapsedMsRef.current +
          (statusRef.current === "playing" && resumedAtRef.current
            ? Date.now() - resumedAtRef.current
            : 0);
        finishGame({
          score: scoreRef.current,
          durationMs,
          stats: {
            apples: scoreRef.current,
            snakeLength: snakeRef.current.length,
          },
        });
        return;
      }

      snakeRef.current = [nextHead, ...snake];

      if (willGrow) {
        playAudioCue("snakeEat");
        scoreRef.current += 1;
        foodRef.current = randomSnakeFood(snakeRef.current);

        if (!foodRef.current) {
          const durationMs =
            elapsedMsRef.current +
            (statusRef.current === "playing" && resumedAtRef.current
              ? Date.now() - resumedAtRef.current
              : 0);
          finishGame({
            score: scoreRef.current,
            durationMs,
            stats: {
              apples: scoreRef.current,
              snakeLength: snakeRef.current.length,
              clearedBoard: true,
            },
          });
        }
        return;
      }

      snakeRef.current.pop();
    };

    const render = () => {
      const runtimeMs =
        resultRef.current?.durationMs ??
        elapsedMsRef.current +
          (statusRef.current === "playing" && resumedAtRef.current
            ? Date.now() - resumedAtRef.current
            : 0);
      drawSnakeScene({
        context,
        assets,
        snake: snakeRef.current,
        food: foodRef.current,
        score: scoreRef.current,
        status: statusRef.current,
        result: resultRef.current,
        runtimeMs,
        direction: directionRef.current,
      });
    };

    const loop = (time: number) => {
      if (stopped) {
        return;
      }

      if (statusRef.current === "playing" && !resultRef.current && time - lastTick >= 120) {
        lastTick = time;
        step();
      }

      render();
      animationFrame = window.requestAnimationFrame(loop);
    };

    render();
    animationFrame = window.requestAnimationFrame(loop);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [assets]);

  return (
    <canvas
      ref={canvasRef}
      width={GAMEBOY_SCREEN_BACKING_WIDTH}
      height={GAMEBOY_SCREEN_BACKING_HEIGHT}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        imageRendering: "pixelated",
        background: FALLBACK_DEEP,
      }}
    />
  );
}
