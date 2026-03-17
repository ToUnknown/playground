"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { SessionUser, SoloGameResult } from "@/lib/contracts";
import { useScoreSave } from "@/games/shared/use-score-save";
import {
  loadGameboyTetrisAssets,
  type GameboyTetrisAssets,
} from "@/games/tetris/gameboy-tetris-assets";
import {
  GAMEBOY_TETRIS_DARK,
  GAMEBOY_TETRIS_LIGHT,
} from "@/games/tetris/gameboy-tetris-theme";
import {
  configureGameboyScreenCanvas,
  GAMEBOY_SCREEN_BACKING_HEIGHT,
  GAMEBOY_SCREEN_BACKING_WIDTH,
  GAMEBOY_SCREEN_HEIGHT,
  GAMEBOY_SCREEN_WIDTH,
} from "@/lib/gameboy-screen";

export type GameboyControlButton =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "start"
  | "select";

export type GameboyControlPulse = {
  button: GameboyControlButton;
  pressed: boolean;
  seq: number;
};

export type GameboyPressedButtons = Partial<Record<GameboyControlButton, boolean>>;

const SCREEN_WIDTH = GAMEBOY_SCREEN_WIDTH;
const SCREEN_HEIGHT = GAMEBOY_SCREEN_HEIGHT;
const SCREEN_BG = "#8fa319";
const SCREEN_MID = "#7d8d12";
const SCREEN_DARK = "#306230";
const SCREEN_DARKEST = "#0f380f";
const SCREEN_PANEL = GAMEBOY_TETRIS_LIGHT;
const SCREEN_PANEL_EDGE = GAMEBOY_TETRIS_DARK;
const PIXEL_FONT = '"Gameboy Tetris", "IBM Plex Sans", monospace';

const menuShellStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: "16px 18px",
  color: SCREEN_DARKEST,
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  fontFamily: PIXEL_FONT,
};

const menuHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: "0.85rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const menuListStyle: CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
  gap: "10px",
  paddingTop: "4px",
};

type GameProps = {
  controlPulse: GameboyControlPulse | null;
  sessionUser: SessionUser | null;
  onExit: () => void;
};

const bootShellStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: "20px 22px 18px",
  color: SCREEN_PANEL_EDGE,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  fontFamily: PIXEL_FONT,
  background: SCREEN_PANEL,
};

function drawScreenFrame(context: CanvasRenderingContext2D, title: string, meta: string) {
  context.fillStyle = SCREEN_MID;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  context.fillStyle = SCREEN_DARKEST;
  context.font = 'bold 14px "IBM Plex Sans", monospace';
  context.fillText(title.toUpperCase(), 18, 26);

  context.textAlign = "right";
  context.fillText(meta.toUpperCase(), SCREEN_WIDTH - 18, 26);
  context.textAlign = "left";
}

function drawArcadeChrome(
  context: CanvasRenderingContext2D,
  title: string,
  meta: string,
  bodyTop: number,
  bodyHeight: number,
) {
  context.fillStyle = SCREEN_PANEL_EDGE;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  context.fillStyle = SCREEN_PANEL_EDGE;
  context.fillRect(24, 10, SCREEN_WIDTH - 48, 48);
  context.fillRect(24, bodyTop - 10, SCREEN_WIDTH - 48, bodyHeight + 20);

  context.fillStyle = SCREEN_PANEL;
  context.fillRect(32, 16, SCREEN_WIDTH - 64, 36);
  context.strokeStyle = SCREEN_PANEL_EDGE;
  context.lineWidth = 2;
  context.strokeRect(32.5, 16.5, SCREEN_WIDTH - 65, 35);

  context.fillStyle = SCREEN_PANEL_EDGE;
  context.font = `14px ${PIXEL_FONT}`;
  context.fillText(title.toUpperCase(), 44, 38);
  context.textAlign = "right";
  context.fillText(meta.toUpperCase(), SCREEN_WIDTH - 44, 38);
  context.textAlign = "left";
}

function drawVerticalWallColumns(
  context: CanvasRenderingContext2D,
  assets: GameboyTetrisAssets | null,
  left: number,
  top: number,
  height: number,
  right: number,
) {
  context.fillStyle = SCREEN_PANEL_EDGE;
  context.fillRect(left, top, 12, height);
  context.fillRect(right, top, 12, height);

  if (!assets) {
    return;
  }

  for (let offset = -2; offset < height + 4; offset += 8) {
    context.drawImage(assets.wall, left + 1, top + offset, 10, 8);
    context.drawImage(assets.wall, right + 1, top + offset, 10, 8);
  }
}

function drawInsetPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  context.fillStyle = SCREEN_PANEL;
  context.fillRect(x, y, width, height);
  context.strokeStyle = SCREEN_PANEL_EDGE;
  context.lineWidth = 2;
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function useSubmitResult(manifestId: string, sessionUser: SessionUser | null) {
  const [result, setResult] = useState<SoloGameResult | null>(null);
  const [resetKey, setResetKey] = useState(0);
  useScoreSave({
    manifestId,
    result,
    resetKey,
    sessionUser,
  });

  const resetResult = () => {
    setResult(null);
    setResetKey((value) => value + 1);
  };

  return { result, setResult, resetKey, resetResult };
}

function usePulseEffect(
  controlPulse: GameboyControlPulse | null,
  handler: (button: GameboyControlButton) => void,
) {
  const onPulse = useEffectEvent(handler);
  const lastSeqRef = useRef<number | null>(null);

  useEffect(() => {
    if (!controlPulse) {
      return;
    }
    if (lastSeqRef.current === controlPulse.seq) {
      return;
    }
    lastSeqRef.current = controlPulse.seq;
    if (!controlPulse.pressed) {
      return;
    }
    onPulse(controlPulse.button);
  }, [controlPulse]);
}

type Matrix = number[][];
type TetrisPiece = {
  shape: Matrix;
  shade: string;
  x: number;
  y: number;
};

const TETRIS_BOARD_WIDTH = 10;
const TETRIS_BOARD_HEIGHT = 16;
const TETRIS_CELL = 14;
const TETRIS_BOARD_LEFT = 28;
const TETRIS_BOARD_TOP = 18;
const TETRIS_SHADES = [SCREEN_DARK, "#3d6c26", "#476e27", "#5e7f34"];
const TETRIS_PIECES: Array<{ shape: Matrix; shade: string }> = [
  { shape: [[1, 1, 1, 1]], shade: TETRIS_SHADES[0] },
  { shape: [[1, 1], [1, 1]], shade: TETRIS_SHADES[1] },
  { shape: [[0, 1, 0], [1, 1, 1]], shade: TETRIS_SHADES[2] },
  { shape: [[1, 1, 0], [0, 1, 1]], shade: TETRIS_SHADES[3] },
  { shape: [[0, 1, 1], [1, 1, 0]], shade: TETRIS_SHADES[0] },
  { shape: [[1, 0, 0], [1, 1, 1]], shade: TETRIS_SHADES[2] },
  { shape: [[0, 0, 1], [1, 1, 1]], shade: TETRIS_SHADES[1] },
];

function makeBoard() {
  return Array.from({ length: TETRIS_BOARD_HEIGHT }, () =>
    Array<string | null>(TETRIS_BOARD_WIDTH).fill(null),
  );
}

function cloneShape(shape: Matrix) {
  return shape.map((row) => [...row]);
}

function spawnPiece(): TetrisPiece {
  const template = TETRIS_PIECES[Math.floor(Math.random() * TETRIS_PIECES.length)];
  return {
    shape: cloneShape(template.shape),
    shade: template.shade,
    x: Math.floor((TETRIS_BOARD_WIDTH - template.shape[0].length) / 2),
    y: 0,
  };
}

function rotateShape(shape: Matrix) {
  return shape[0].map((_, columnIndex) =>
    shape.map((row) => row[columnIndex]).reverse(),
  );
}

function tryRotatePiece(board: Array<Array<string | null>>, piece: TetrisPiece) {
  const rotated = rotateShape(piece.shape);
  const offsets = [0, -1, 1, -2, 2];
  for (const offset of offsets) {
    if (!collides(board, piece, piece.x + offset, piece.y, rotated)) {
      return {
        ...piece,
        x: piece.x + offset,
        shape: rotated,
      };
    }
  }
  return null;
}

function collides(
  board: Array<Array<string | null>>,
  piece: TetrisPiece,
  nextX: number,
  nextY: number,
  shape = piece.shape,
) {
  return shape.some((row, rowIndex) =>
    row.some((cell, columnIndex) => {
      if (!cell) {
        return false;
      }

      const boardX = nextX + columnIndex;
      const boardY = nextY + rowIndex;

      return (
        boardX < 0 ||
        boardX >= TETRIS_BOARD_WIDTH ||
        boardY >= TETRIS_BOARD_HEIGHT ||
        (boardY >= 0 && board[boardY][boardX] !== null)
      );
    }),
  );
}

function drawTetrisCell(
  context: CanvasRenderingContext2D,
  boardX: number,
  boardY: number,
  shade: string,
  offsetX = TETRIS_BOARD_LEFT,
  offsetY = TETRIS_BOARD_TOP,
  cellSize = TETRIS_CELL,
) {
  const left = offsetX + boardX * cellSize + 1;
  const top = offsetY + boardY * cellSize + 1;
  const size = cellSize - 2;

  context.fillStyle = SCREEN_MID;
  context.fillRect(left, top, size, size);

  if (shade === TETRIS_SHADES[0]) {
    context.fillStyle = SCREEN_DARK;
    context.fillRect(left + 1, top + 1, size - 2, size - 2);
  } else if (shade === TETRIS_SHADES[1]) {
    context.strokeStyle = SCREEN_DARKEST;
    context.lineWidth = 2;
    context.strokeRect(left + 2, top + 2, size - 4, size - 4);
  } else if (shade === TETRIS_SHADES[2]) {
    context.fillStyle = SCREEN_DARK;
    context.fillRect(left + 2, top + 2, size - 4, size - 4);
    context.fillStyle = SCREEN_MID;
    context.fillRect(left + 5, top + 5, size - 10, size - 10);
  } else {
    context.fillStyle = SCREEN_DARK;
    for (let dotY = top + 2; dotY < top + size - 2; dotY += 4) {
      for (let dotX = left + 2; dotX < left + size - 2; dotX += 4) {
        context.fillRect(dotX, dotY, 1.5, 1.5);
      }
    }
  }
}

function drawTetrisWall(context: CanvasRenderingContext2D, x: number, y: number, height: number) {
  const brickWidth = 10;
  const brickHeight = 8;

  context.fillStyle = SCREEN_DARKEST;
  context.fillRect(x, y, brickWidth, height);

  for (let row = 0; row < Math.ceil(height / brickHeight); row += 1) {
    const top = y + row * brickHeight;
    const offset = row % 2 === 0 ? 0 : brickWidth / 2;
    for (let column = 0; column < 2; column += 1) {
      const left = x + offset + column * brickWidth - brickWidth / 2;
      context.strokeStyle = SCREEN_MID;
      context.lineWidth = 1;
      context.strokeRect(left + 0.5, top + 0.5, brickWidth, brickHeight);
    }
  }
}

function drawPanelBox(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
) {
  context.fillStyle = SCREEN_MID;
  context.fillRect(x, y, width, height);
  context.strokeStyle = SCREEN_DARKEST;
  context.lineWidth = 2;
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  context.strokeRect(x + 4.5, y + 4.5, width - 9, height - 9);

  context.fillStyle = SCREEN_DARKEST;
  context.font = 'bold 14px "IBM Plex Sans", monospace';
  context.fillText(label, x + 16, y + 22);
  context.textAlign = "center";
  context.font = 'bold 22px "Rajdhani", sans-serif';
  context.fillText(value, x + width / 2, y + height - 14);
  context.textAlign = "left";
}

function drawTetrisBoard(
  context: CanvasRenderingContext2D,
  board: Array<Array<string | null>>,
  piece: TetrisPiece,
  nextPiece: TetrisPiece,
  lines: number,
  paused: boolean,
  result: SoloGameResult | null,
) {
  const boardWidth = TETRIS_BOARD_WIDTH * TETRIS_CELL;
  const boardHeight = TETRIS_BOARD_HEIGHT * TETRIS_CELL;
  const sidePanelX = 188;
  const sidePanelWidth = 110;
  const level = Math.floor(lines / 10);
  const score = lines * 100 + level * 25;

  context.fillStyle = SCREEN_MID;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  context.fillStyle = "#203018";
  context.fillRect(sidePanelX, 0, sidePanelWidth, SCREEN_HEIGHT);

  drawTetrisWall(context, TETRIS_BOARD_LEFT - 12, TETRIS_BOARD_TOP, boardHeight);
  drawTetrisWall(context, TETRIS_BOARD_LEFT + boardWidth + 2, TETRIS_BOARD_TOP, boardHeight);

  context.fillStyle = SCREEN_BG;
  context.fillRect(TETRIS_BOARD_LEFT, TETRIS_BOARD_TOP, boardWidth, boardHeight);
  context.strokeStyle = SCREEN_DARKEST;
  context.lineWidth = 2;
  context.strokeRect(TETRIS_BOARD_LEFT - 0.5, TETRIS_BOARD_TOP - 0.5, boardWidth + 1, boardHeight + 1);

  board.forEach((row, rowIndex) => {
    row.forEach((shade, columnIndex) => {
      if (!shade) {
        return;
      }
      drawTetrisCell(context, columnIndex, rowIndex, shade);
    });
  });

  piece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!cell) {
        return;
      }
      drawTetrisCell(context, piece.x + columnIndex, piece.y + rowIndex, piece.shade);
    });
  });

  drawPanelBox(context, 206, 12, 94, 46, "SCORE", String(score));
  drawPanelBox(context, 206, 86, 94, 50, "LEVEL", String(level));
  drawPanelBox(context, 206, 146, 94, 50, "LINES", String(lines));

  context.fillStyle = SCREEN_MID;
  context.fillRect(206, 218, 94, 58);
  context.strokeStyle = SCREEN_DARKEST;
  context.lineWidth = 2;
  context.strokeRect(206.5, 218.5, 93, 57);
  context.strokeRect(210.5, 222.5, 85, 49);

  const previewWidth = nextPiece.shape[0]?.length ?? 0;
  const previewHeight = nextPiece.shape.length;
  const previewCell = 10;
  const previewOffsetX = 222 + Math.floor((52 - previewWidth * previewCell) / 2);
  const previewOffsetY = 232 + Math.floor((32 - previewHeight * previewCell) / 2);

  nextPiece.shape.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (!cell) {
        return;
      }
      drawTetrisCell(
        context,
        columnIndex,
        rowIndex,
        nextPiece.shade,
        previewOffsetX,
        previewOffsetY,
        previewCell,
      );
    });
  });

  if (paused || result) {
    context.fillStyle = "rgba(139, 172, 15, 0.92)";
    context.fillRect(42, 108, 226, 70);
    context.strokeStyle = SCREEN_DARK;
    context.lineWidth = 2;
    context.strokeRect(42, 108, 226, 70);
    context.fillStyle = SCREEN_DARKEST;
    context.textAlign = "center";
    context.font = 'bold 16px "IBM Plex Sans", monospace';
    context.fillText(result ? "STACK LOCKED" : "PAUSED", SCREEN_WIDTH / 2, 136);
    context.font = '12px "IBM Plex Sans", monospace';
    context.fillText(
      result ? "START TO PLAY AGAIN" : "START TO RESUME",
      SCREEN_WIDTH / 2,
      156,
    );
    context.fillText("SELECT FOR MENU", SCREEN_WIDTH / 2, 172);
    context.textAlign = "left";
  }
}

export function GameboyTetris({ controlPulse, onExit, sessionUser }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boardRef = useRef(makeBoard());
  const pieceRef = useRef<TetrisPiece>(spawnPiece());
  const nextPieceRef = useRef<TetrisPiece>(spawnPiece());
  const linesRef = useRef(0);
  const piecesRef = useRef(0);
  const pausedRef = useRef(false);
  const startedAtRef = useRef(0);

  const [lines, setLines] = useState(0);
  const [paused, setPaused] = useState(false);
  const { result, setResult, resetResult } = useSubmitResult("tetris", sessionUser);

  const resetGame = () => {
    boardRef.current = makeBoard();
    pieceRef.current = spawnPiece();
    nextPieceRef.current = spawnPiece();
    linesRef.current = 0;
    piecesRef.current = 0;
    pausedRef.current = false;
    startedAtRef.current = Date.now();
    setLines(0);
    setPaused(false);
    resetResult();
  };

  const mergePiece = () => {
    pieceRef.current.shape.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (!cell) {
          return;
        }
        const boardY = pieceRef.current.y + rowIndex;
        if (boardY >= 0) {
          boardRef.current[boardY][pieceRef.current.x + columnIndex] = pieceRef.current.shade;
        }
      });
    });
  };

  const clearLines = () => {
    const filtered = boardRef.current.filter((row) => row.some((cell) => cell === null));
    const cleared = TETRIS_BOARD_HEIGHT - filtered.length;
    if (cleared > 0) {
      boardRef.current = [
        ...Array.from({ length: cleared }, () => Array<string | null>(TETRIS_BOARD_WIDTH).fill(null)),
        ...filtered,
      ];
      linesRef.current += cleared;
      setLines(linesRef.current);
    }
  };

  const spawnNext = () => {
    const next = {
      ...nextPieceRef.current,
      shape: cloneShape(nextPieceRef.current.shape),
    };
    if (collides(boardRef.current, next, next.x, next.y)) {
      setResult({
        score: linesRef.current,
        durationMs: Date.now() - startedAtRef.current,
        stats: {
          linesCleared: linesRef.current,
          piecesPlaced: piecesRef.current,
        },
      });
      return;
    }
    pieceRef.current = next;
    nextPieceRef.current = spawnPiece();
  };

  const hardDrop = () => {
    while (!collides(boardRef.current, pieceRef.current, pieceRef.current.x, pieceRef.current.y + 1)) {
      pieceRef.current = {
        ...pieceRef.current,
        y: pieceRef.current.y + 1,
      };
    }
    mergePiece();
    clearLines();
    piecesRef.current += 1;
    spawnNext();
  };

  const lockCurrentPiece = () => {
    mergePiece();
    clearLines();
    piecesRef.current += 1;
    spawnNext();
  };

  usePulseEffect(controlPulse, (button) => {
    if (button === "select") {
      onExit();
      return;
    }

    if (button === "start") {
      if (result) {
        resetGame();
        return;
      }
      pausedRef.current = !pausedRef.current;
      setPaused(pausedRef.current);
      return;
    }

    if (result && (button === "a" || button === "b")) {
      resetGame();
      return;
    }

    if (pausedRef.current || result) {
      return;
    }

    if (button === "left" || button === "right" || button === "down") {
      const dx = button === "left" ? -1 : button === "right" ? 1 : 0;
      const dy = button === "down" ? 1 : 0;
      if (!collides(boardRef.current, pieceRef.current, pieceRef.current.x + dx, pieceRef.current.y + dy)) {
        pieceRef.current = {
          ...pieceRef.current,
          x: pieceRef.current.x + dx,
          y: pieceRef.current.y + dy,
        };
        if (
          button === "down" &&
          collides(boardRef.current, pieceRef.current, pieceRef.current.x, pieceRef.current.y + 1)
        ) {
          lockCurrentPiece();
        }
      }
      return;
    }

    if (button === "up" || button === "a") {
      const rotated = tryRotatePiece(boardRef.current, pieceRef.current);
      if (rotated) {
        pieceRef.current = rotated;
      }
      return;
    }

    if (button === "b") {
      hardDrop();
    }
  });

  useEffect(() => {
    resetGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    configureGameboyScreenCanvas(canvas, context);

    let animationFrame = 0;
    let lastDropAt = performance.now();
    let stopped = false;

    const dropDelay = () => Math.max(140, 520 - linesRef.current * 14);

    const tick = () => {
      if (collides(boardRef.current, pieceRef.current, pieceRef.current.x, pieceRef.current.y + 1)) {
        lockCurrentPiece();
      } else {
        pieceRef.current = {
          ...pieceRef.current,
          y: pieceRef.current.y + 1,
        };
        if (collides(boardRef.current, pieceRef.current, pieceRef.current.x, pieceRef.current.y + 1)) {
          lockCurrentPiece();
        }
      }
    };

    const draw = () => {
      drawTetrisBoard(
        context,
        boardRef.current,
        pieceRef.current,
        nextPieceRef.current,
        lines,
        paused,
        result,
      );
    };

    const loop = (time: number) => {
      if (stopped) {
        return;
      }

      if (!pausedRef.current && !result && time - lastDropAt >= dropDelay()) {
        lastDropAt = time;
        tick();
      }

      draw();
      animationFrame = requestAnimationFrame(loop);
    };

    draw();
    animationFrame = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [clearLines, lines, mergePiece, paused, result, setResult, spawnNext]);

  return (
    <canvas
      ref={canvasRef}
      width={GAMEBOY_SCREEN_BACKING_WIDTH}
      height={GAMEBOY_SCREEN_BACKING_HEIGHT}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        imageRendering: "pixelated",
      }}
    />
  );
}

export function GameboyMenuScreen({
  games,
  selectedIndex,
}: {
  games: Array<{ name: string; modes: number }>;
  selectedIndex: number;
}) {
  const selected = useMemo(() => games[selectedIndex], [games, selectedIndex]);

  return (
    <div style={menuShellStyle}>
      <div style={menuHeadStyle}>
        <span>Game Select</span>
        <span>{String(selectedIndex + 1).padStart(2, "0")}</span>
      </div>
      <div style={menuListStyle}>
        {games.map((game, index) => (
          <div
            key={game.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              padding: "8px 10px",
              border: `1px solid rgba(15, 56, 15, 0.18)`,
              background: index === selectedIndex ? "rgba(15, 56, 15, 0.18)" : "rgba(139, 172, 15, 0.22)",
              fontSize: "0.95rem",
            }}
          >
            <span>{index === selectedIndex ? ">" : " "}</span>
            <strong
              style={{
                flex: 1,
                marginLeft: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {game.name}
            </strong>
            <small
              style={{
                textTransform: "uppercase",
                fontSize: "0.72rem",
              }}
            >
              {game.modes} mode
            </small>
          </div>
        ))}
      </div>
      <div style={menuHeadStyle}>
        <span>A START</span>
        <span>SELECT MENU</span>
      </div>
    </div>
  );
}

function drawMenuCanvas(
  context: CanvasRenderingContext2D,
  games: Array<{ name: string; modes: number }>,
  selectedIndex: number,
  assets: GameboyTetrisAssets | null,
) {
  const bodyTop = 64;
  const bodyHeight = 196;
  const wallLeft = 34;
  const wallRight = SCREEN_WIDTH - 46;
  const listLeft = 46;
  const listTop = 82;
  const listWidth = SCREEN_WIDTH - 92;

  drawArcadeChrome(
    context,
    "Game Select",
    String(selectedIndex + 1).padStart(2, "0"),
    bodyTop,
    bodyHeight,
  );
  drawVerticalWallColumns(context, assets, wallLeft, bodyTop, bodyHeight, wallRight);

  games.forEach((game, index) => {
    const top = listTop + index * 54;
    drawInsetPanel(context, listLeft, top, listWidth, 42);
    if (index === selectedIndex) {
      context.fillStyle = "rgba(64, 66, 67, 0.12)";
      context.fillRect(listLeft + 3, top + 3, listWidth - 6, 36);
    }

    context.fillStyle = SCREEN_PANEL_EDGE;
    context.font = `18px ${PIXEL_FONT}`;
    context.textAlign = "center";
    context.fillText(game.name.toUpperCase(), listLeft + listWidth / 2, top + 27);

    if (index === selectedIndex) {
      context.font = 'bold 16px "IBM Plex Sans", monospace';
      context.fillText("<", listLeft + 18, top + 27);
      context.fillText(">", listLeft + listWidth - 18, top + 27);
      context.font = `18px ${PIXEL_FONT}`;
    }

    context.textAlign = "left";
  });

}

export function GameboyMenuCanvas({
  games,
  selectedIndex,
}: {
  games: Array<{ name: string; modes: number }>;
  selectedIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [assets, setAssets] = useState<GameboyTetrisAssets | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    configureGameboyScreenCanvas(canvas, context);
    drawMenuCanvas(context, games, selectedIndex, assets);
  }, [assets, games, selectedIndex]);

  return (
    <canvas
      ref={canvasRef}
      width={GAMEBOY_SCREEN_BACKING_WIDTH}
      height={GAMEBOY_SCREEN_BACKING_HEIGHT}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        imageRendering: "pixelated",
      }}
    />
  );
}

export function GameboyBootScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((value) => Math.min(value + 1 / 9, 1));
    }, 120);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div style={bootShellStyle}>
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "18px",
        }}
      >
        <strong
          style={{
            fontSize: "1rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: SCREEN_PANEL_EDGE,
          }}
        >
          Loading...
        </strong>
        <div
          style={{
            width: "100%",
            maxWidth: "188px",
            padding: "4px",
            border: `2px solid ${SCREEN_PANEL_EDGE}`,
            background: SCREEN_PANEL,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "14px",
              background: SCREEN_PANEL,
              overflow: "hidden",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                borderTop: "1px solid rgba(198, 207, 161, 0.4)",
                borderBottom: "1px solid rgba(64, 66, 67, 0.16)",
              }}
            />
            <span
              style={{
                display: "block",
                width: `${progress * 100}%`,
                height: "100%",
                background: SCREEN_PANEL_EDGE,
                boxShadow: "inset 0 0 0 1px rgba(198, 207, 161, 0.18)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function drawBootCanvas(
  context: CanvasRenderingContext2D,
  progress: number,
) {
  const bodyTop = 76;
  const bodyHeight = 136;

  drawArcadeChrome(context, "System Boot", "GB-01", bodyTop, bodyHeight);
  drawInsetPanel(context, 62, 96, 196, 94);

  context.fillStyle = SCREEN_PANEL_EDGE;
  context.textAlign = "center";
  context.font = `16px ${PIXEL_FONT}`;
  context.fillText("LOADING...", SCREEN_WIDTH / 2, 128);

  context.fillStyle = SCREEN_PANEL;
  context.fillRect(82, 160, 156, 16);
  context.strokeStyle = SCREEN_PANEL_EDGE;
  context.strokeRect(81.5, 159.5, 157, 17);

  context.fillStyle = SCREEN_PANEL_EDGE;
  context.fillRect(84, 162, Math.round(152 * progress), 12);
  context.textAlign = "left";
}

export function GameboyBootCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((value) => Math.min(value + 1 / 9, 1));
    }, 120);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    configureGameboyScreenCanvas(canvas, context);
    drawBootCanvas(context, progress);
  }, [progress]);

  return (
    <canvas
      ref={canvasRef}
      width={GAMEBOY_SCREEN_BACKING_WIDTH}
      height={GAMEBOY_SCREEN_BACKING_HEIGHT}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        imageRendering: "pixelated",
      }}
    />
  );
}
