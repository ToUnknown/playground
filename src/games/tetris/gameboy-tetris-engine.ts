"use client";

import type { SoloGameResult } from "@/lib/contracts";

export type TetrisPieceType = "i" | "j" | "l" | "o" | "s" | "t" | "z";
export type TetrisGameStatus = "title" | "playing" | "paused" | "gameOver";

export type TetrisCell = TetrisPieceType | "wall" | null;

export type TetrisPieceState = {
  type: TetrisPieceType;
  matrix: boolean[][];
  leftOff: number;
  topOff: number;
};

export type TetrisSnapshot = {
  status: TetrisGameStatus;
  board: TetrisCell[][];
  currentPiece: TetrisPieceState | null;
  nextPieceType: TetrisPieceType | null;
  holdPieceType: TetrisPieceType | null;
  score: number;
  level: number;
  lines: number;
  piecesPlaced: number;
};

export type TetrisInput =
  | "left"
  | "right"
  | "down"
  | "rotate"
  | "hold"
  | "hardDrop"
  | "start"
  | "restart";

const BOARD_HEIGHT = 20;
const BOARD_WIDTH = 12;
const PLAYFIELD_TOP = 1;
const PLAYFIELD_BOTTOM = 18;
const PLAYFIELD_LEFT = 1;
const PLAYFIELD_RIGHT = 10;
const SPAWN_LEFT = 4;
const SPAWN_TOP = 1;
const LEADERBOARD_VERSION = "gameboy-tetris-v1";

const PIECE_TEMPLATES: Record<TetrisPieceType, boolean[][]> = {
  j: [
    [true, false, false, false],
    [true, true, true, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  l: [
    [false, false, true, false],
    [true, true, true, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  t: [
    [false, true, false, false],
    [true, true, true, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  o: [
    [false, true, true, false],
    [false, true, true, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  s: [
    [false, true, true, false],
    [true, true, false, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  z: [
    [true, true, false, false],
    [false, true, true, false],
    [false, false, false, false],
    [false, false, false, false],
  ],
  i: [
    [false, false, false, false],
    [true, true, true, true],
    [false, false, false, false],
    [false, false, false, false],
  ],
};

function cloneMatrix(matrix: boolean[][]) {
  return matrix.map((row) => [...row]);
}

function createBoard(): TetrisCell[][] {
  return Array.from({ length: BOARD_HEIGHT }, (_, rowIndex) =>
    Array.from({ length: BOARD_WIDTH }, (_, columnIndex) => {
      if (
        rowIndex === 0 ||
        rowIndex === BOARD_HEIGHT - 1 ||
        columnIndex === 0 ||
        columnIndex === BOARD_WIDTH - 1
      ) {
        return "wall";
      }

      return null;
    }),
  );
}

function shufflePieces() {
  const bag = (Object.keys(PIECE_TEMPLATES) as TetrisPieceType[]).slice();

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = bag[index];
    bag[index] = bag[swapIndex]!;
    bag[swapIndex] = temp!;
  }

  return bag;
}

function createPiece(type: TetrisPieceType): TetrisPieceState {
  return {
    type,
    matrix: cloneMatrix(PIECE_TEMPLATES[type]),
    leftOff: SPAWN_LEFT,
    topOff: SPAWN_TOP,
  };
}

function rotateMatrix(type: TetrisPieceType, matrix: boolean[][]) {
  if (type === "o") {
    return cloneMatrix(matrix);
  }

  const limit = type === "i" ? matrix.length : matrix.length - 1;
  const rotated = cloneMatrix(matrix);

  for (let rowIndex = 0; rowIndex < limit / 2; rowIndex += 1) {
    for (let columnIndex = rowIndex; columnIndex < limit - rowIndex - 1; columnIndex += 1) {
      const temp = rotated[rowIndex]![columnIndex]!;
      rotated[rowIndex]![columnIndex] = rotated[limit - columnIndex - 1]![rowIndex]!;
      rotated[limit - columnIndex - 1]![rowIndex] =
        rotated[limit - rowIndex - 1]![limit - columnIndex - 1]!;
      rotated[limit - rowIndex - 1]![limit - columnIndex - 1] =
        rotated[columnIndex]![limit - rowIndex - 1]!;
      rotated[columnIndex]![limit - rowIndex - 1] = temp;
    }
  }

  return rotated;
}

function collides(board: TetrisCell[][], piece: TetrisPieceState) {
  return piece.matrix.some((row, rowIndex) =>
    row.some((filled, columnIndex) => {
      if (!filled) {
        return false;
      }

      const boardRow = piece.topOff + rowIndex;
      const boardColumn = piece.leftOff + columnIndex;
      return Boolean(board[boardRow]?.[boardColumn]);
    }),
  );
}

function stampPiece(board: TetrisCell[][], piece: TetrisPieceState) {
  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (!filled) {
        return;
      }

      const boardRow = piece.topOff + rowIndex;
      const boardColumn = piece.leftOff + columnIndex;
      if (board[boardRow]?.[boardColumn] !== undefined) {
        board[boardRow]![boardColumn] = piece.type;
      }
    });
  });
}

function isLineFilled(row: TetrisCell[]) {
  for (let columnIndex = PLAYFIELD_LEFT; columnIndex <= PLAYFIELD_RIGHT; columnIndex += 1) {
    if (!row[columnIndex]) {
      return false;
    }
  }

  return true;
}

function makePlayableRow(): TetrisCell[] {
  return Array.from({ length: BOARD_WIDTH }, (_, columnIndex) => {
    if (columnIndex === 0 || columnIndex === BOARD_WIDTH - 1) {
      return "wall";
    }

    return null;
  });
}

function cloneBoard(board: TetrisCell[][]) {
  return board.map((row) => [...row]);
}

export class GameboyTetrisEngine {
  private status: TetrisGameStatus = "title";
  private board: TetrisCell[][] = createBoard();
  private queue: TetrisPieceType[] = [];
  private currentPiece: TetrisPieceState | null = null;
  private nextPieceType: TetrisPieceType | null = null;
  private holdPieceType: TetrisPieceType | null = null;
  private holdUsed = false;
  private score = 0;
  private level = 0;
  private lines = 0;
  private piecesPlaced = 0;
  private startedAt = 0;
  private result: SoloGameResult | null = null;

  getSnapshot(): TetrisSnapshot {
    return {
      status: this.status,
      board: cloneBoard(this.board),
      currentPiece: this.currentPiece
        ? {
            type: this.currentPiece.type,
            matrix: cloneMatrix(this.currentPiece.matrix),
            leftOff: this.currentPiece.leftOff,
            topOff: this.currentPiece.topOff,
          }
        : null,
      nextPieceType: this.nextPieceType,
      holdPieceType: this.holdPieceType,
      score: this.score,
      level: this.level,
      lines: this.lines,
      piecesPlaced: this.piecesPlaced,
    };
  }

  getResult() {
    return this.result;
  }

  getStatus() {
    return this.status;
  }

  getDropDelayMs() {
    const speedFrames = Math.max(8, 30 - this.level);
    return (speedFrames * 1000) / 60;
  }

  resetToTitle() {
    this.status = "title";
    this.board = createBoard();
    this.queue = [];
    this.currentPiece = null;
    this.nextPieceType = null;
    this.holdPieceType = null;
    this.holdUsed = false;
    this.score = 0;
    this.level = 0;
    this.lines = 0;
    this.piecesPlaced = 0;
    this.startedAt = 0;
    this.result = null;
  }

  start(now = Date.now()) {
    this.board = createBoard();
    this.queue = shufflePieces();
    this.currentPiece = this.takeNextPiece();
    this.nextPieceType = this.queue[0] ?? null;
    this.holdPieceType = null;
    this.holdUsed = false;
    this.score = 0;
    this.level = 0;
    this.lines = 0;
    this.piecesPlaced = 0;
    this.startedAt = now;
    this.result = null;
    this.status = "playing";
  }

  handleInput(input: TetrisInput, now = Date.now()) {
    if (input === "restart") {
      this.start(now);
      return;
    }

    if (input === "start") {
      if (this.status === "title" || this.status === "gameOver") {
        this.start(now);
        return;
      }

      if (this.status === "playing") {
        this.status = "paused";
        return;
      }

      if (this.status === "paused") {
        this.status = "playing";
      }

      return;
    }

    if (this.status !== "playing" || !this.currentPiece) {
      return;
    }

    if (input === "left" || input === "right" || input === "down") {
      const movedPiece = {
        ...this.currentPiece,
        leftOff:
          this.currentPiece.leftOff + (input === "left" ? -1 : input === "right" ? 1 : 0),
        topOff: this.currentPiece.topOff + (input === "down" ? 1 : 0),
      };

      if (!collides(this.board, movedPiece)) {
        this.currentPiece = movedPiece;
        if (input === "down") {
          this.score += 1;
        }
      } else if (input === "down") {
        this.lockCurrentPiece(now);
      }

      return;
    }

    if (input === "rotate") {
      const rotated = rotateMatrix(this.currentPiece.type, this.currentPiece.matrix);
      const rotatedPiece = {
        ...this.currentPiece,
        matrix: rotated,
        leftOff:
          this.currentPiece.leftOff === 0
            ? 1
            : this.currentPiece.leftOff === 9
              ? 8
              : this.currentPiece.leftOff,
      };

      if (!collides(this.board, rotatedPiece)) {
        this.currentPiece = rotatedPiece;
      }

      return;
    }

    if (input === "hold") {
      this.holdCurrentPiece(now);
      return;
    }

    if (input === "hardDrop") {
      while (this.currentPiece && !collides(this.board, { ...this.currentPiece, topOff: this.currentPiece.topOff + 1 })) {
        this.currentPiece = {
          ...this.currentPiece,
          topOff: this.currentPiece.topOff + 1,
        };
      }

      this.lockCurrentPiece(now);
    }
  }

  tick(now = Date.now()) {
    if (this.status !== "playing" || !this.currentPiece) {
      return;
    }

    const nextPiece = {
      ...this.currentPiece,
      topOff: this.currentPiece.topOff + 1,
    };

    if (collides(this.board, nextPiece)) {
      this.lockCurrentPiece(now);
      return;
    }

    this.currentPiece = nextPiece;
  }

  private ensureQueue() {
    if (this.queue.length === 0) {
      this.queue.push(...shufflePieces());
    }
  }

  private takeNextPiece() {
    this.ensureQueue();
    const type = this.queue.shift() ?? "t";
    this.ensureQueue();
    this.nextPieceType = this.queue[0] ?? null;
    return createPiece(type);
  }

  private holdCurrentPiece(now: number) {
    if (!this.currentPiece || this.holdUsed) {
      return;
    }

    const currentType = this.currentPiece.type;
    this.holdUsed = true;

    if (!this.holdPieceType) {
      this.holdPieceType = currentType;
      this.currentPiece = this.takeNextPiece();
    } else {
      const nextType = this.holdPieceType;
      this.holdPieceType = currentType;
      this.currentPiece = createPiece(nextType);
    }

    if (this.currentPiece && collides(this.board, this.currentPiece)) {
      this.finishGame(now);
    }
  }

  private lockCurrentPiece(now: number) {
    if (!this.currentPiece) {
      return;
    }

    stampPiece(this.board, this.currentPiece);
    this.piecesPlaced += 1;
    this.holdUsed = false;

    const topRowBlocked = this.board[PLAYFIELD_TOP]
      ?.slice(PLAYFIELD_LEFT, PLAYFIELD_RIGHT + 1)
      .some(Boolean);

    this.clearLines();

    if (topRowBlocked) {
      this.finishGame(now);
      return;
    }

    this.currentPiece = this.takeNextPiece();

    if (this.currentPiece && collides(this.board, this.currentPiece)) {
      this.finishGame(now);
    }
  }

  private clearLines() {
    let cleared = 0;

    for (let rowIndex = PLAYFIELD_TOP; rowIndex <= PLAYFIELD_BOTTOM; rowIndex += 1) {
      if (isLineFilled(this.board[rowIndex]!)) {
        this.board.splice(rowIndex, 1);
        this.board.splice(PLAYFIELD_TOP, 0, makePlayableRow());
        cleared += 1;
        rowIndex -= 1;
      }
    }

    if (!cleared) {
      return;
    }

    this.lines += cleared;
    this.level = Math.floor(this.lines / 10);

    if (cleared === 1) {
      this.score += 40 * (this.level + 1);
    } else if (cleared === 2) {
      this.score += 100 * (this.level + 1);
    } else if (cleared === 3) {
      this.score += 300 * (this.level + 1);
    } else if (cleared === 4) {
      this.score += 1200 * (this.level + 1);
    }
  }

  private finishGame(now: number) {
    this.status = "gameOver";
    this.currentPiece = null;
    this.result = {
      score: this.score,
      durationMs: Math.max(0, now - this.startedAt),
      stats: {
        leaderboardVersion: LEADERBOARD_VERSION,
        score: this.score,
        level: this.level,
        linesCleared: this.lines,
        piecesPlaced: this.piecesPlaced,
      },
    };
  }
}

export function createGameboyTetrisEngine() {
  return new GameboyTetrisEngine();
}
