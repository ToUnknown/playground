"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";

import type { SessionUser, SoloGameResult } from "@/lib/contracts";
import { useScoreSave } from "@/games/shared/use-score-save";
import { loadGameboyTetrisAssets, type GameboyTetrisAssets } from "@/games/tetris/gameboy-tetris-assets";
import {
  GAMEBOY_TETRIS_DARK,
  GAMEBOY_TETRIS_LIGHT,
} from "@/games/tetris/gameboy-tetris-theme";
import {
  createGameboyTetrisEngine,
  type GameboyTetrisEngine,
  type TetrisInput,
  type TetrisPieceState,
  type TetrisPieceType,
  type TetrisSnapshot,
} from "@/games/tetris/gameboy-tetris-engine";
import {
  configureGameboyScreenCanvas,
  GAMEBOY_SCREEN_BACKING_HEIGHT,
  GAMEBOY_SCREEN_BACKING_WIDTH,
  GAMEBOY_SCREEN_HEIGHT,
  GAMEBOY_SCREEN_WIDTH,
} from "@/lib/gameboy-screen";
import type { GameboyAudioCue, GameboyMusicTrack } from "@/lib/gameboy-audio";

export type ExternalGameboyPulse = {
  button: "up" | "down" | "left" | "right" | "a" | "b" | "start" | "select";
  pressed: boolean;
  seq: number;
};

const CANVAS_WIDTH = GAMEBOY_SCREEN_WIDTH;
const CANVAS_HEIGHT = GAMEBOY_SCREEN_HEIGHT;
const BOX = 16;
const PIXEL = 2;
const X_OFFSET = 1;
const Y_OFFSET = 2;
const HUD_FONT = '"Gameboy Tetris", "IBM Plex Sans", monospace';
const FALLBACK_BG = GAMEBOY_TETRIS_LIGHT;
const FALLBACK_DARK = GAMEBOY_TETRIS_DARK;
const SOFT_DROP_REPEAT_MS = 1000 / 20;

type SoftDropState = {
  active: boolean;
  pieceCount: number | null;
  accumulatorMs: number;
};

function drawTextPrompt(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: CanvasTextAlign = "left",
) {
  context.save();
  context.fillStyle = FALLBACK_DARK;
  context.textAlign = align;
  context.font = `16px ${HUD_FONT}`;
  context.fillText(text, x, y);
  context.restore();
}

function drawPiece(
  context: CanvasRenderingContext2D,
  assets: GameboyTetrisAssets,
  piece: TetrisPieceState,
  xOff: number,
  yOff: number,
) {
  const image = assets.pieces[piece.type];

  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (!filled) {
        return;
      }

      context.drawImage(
        image,
        xOff + columnIndex * BOX,
        yOff + rowIndex * BOX,
        BOX,
        BOX,
      );
    });
  });
}

function drawPreviewPiece(
  context: CanvasRenderingContext2D,
  assets: GameboyTetrisAssets,
  piece: TetrisPieceState,
  boxLeft: number,
  boxTop: number,
  boxSize: number,
) {
  const image = assets.pieces[piece.type];
  const previewCellSize = BOX - 2;
  let minColumn = piece.matrix[0]?.length ?? 0;
  let maxColumn = -1;
  let minRow = piece.matrix.length;
  let maxRow = -1;

  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (!filled) {
        return;
      }

      minColumn = Math.min(minColumn, columnIndex);
      maxColumn = Math.max(maxColumn, columnIndex);
      minRow = Math.min(minRow, rowIndex);
      maxRow = Math.max(maxRow, rowIndex);
    });
  });

  if (maxColumn < minColumn || maxRow < minRow) {
    return;
  }

  const contentWidth = (maxColumn - minColumn + 1) * previewCellSize;
  const contentHeight = (maxRow - minRow + 1) * previewCellSize;
  const xOffset = boxLeft + (boxSize - contentWidth) / 2;
  const yOffset = boxTop + (boxSize - contentHeight) / 2;

  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((filled, columnIndex) => {
      if (!filled) {
        return;
      }

      context.drawImage(
        image,
        xOffset + (columnIndex - minColumn) * previewCellSize,
        yOffset + (rowIndex - minRow) * previewCellSize,
        previewCellSize,
        previewCellSize,
      );
    });
  });
}

function drawStaticBoard(
  context: CanvasRenderingContext2D,
  assets: GameboyTetrisAssets,
  snapshot: TetrisSnapshot,
) {
  for (let rowIndex = 1; rowIndex < 20; rowIndex += 1) {
    for (let columnIndex = 1; columnIndex < 11; columnIndex += 1) {
      const cell = snapshot.board[rowIndex]?.[columnIndex];
      const x = (X_OFFSET + columnIndex) * BOX;
      const y = (rowIndex - 1) * BOX;

      if (!cell || cell === "wall") {
        context.fillStyle = FALLBACK_BG;
        context.fillRect(x, y, BOX, BOX);
        continue;
      }

      context.drawImage(assets.pieces[cell], x, y, BOX, BOX);
    }
  }
}

function drawSideWalls(context: CanvasRenderingContext2D, assets: GameboyTetrisAssets) {
  context.save();
  context.strokeStyle = FALLBACK_BG;
  context.lineWidth = PIXEL;
  context.beginPath();
  context.moveTo(BOX - PIXEL / 2, 0);
  context.lineTo(BOX - PIXEL / 2, 18 * BOX);
  context.moveTo(13 * BOX + PIXEL / 2, 0);
  context.lineTo(13 * BOX + PIXEL / 2, 18 * BOX);
  context.stroke();

  for (let index = 0; index < 24; index += 1) {
    context.drawImage(assets.wall, BOX, index * BOX * 0.75, BOX, BOX * 0.75);
    context.drawImage(assets.wall, 12 * BOX, index * BOX * 0.75, BOX, BOX * 0.75);
  }
  context.restore();
}

function drawBoardScene(
  context: CanvasRenderingContext2D,
  assets: GameboyTetrisAssets,
  snapshot: TetrisSnapshot,
) {
  context.fillStyle = FALLBACK_DARK;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawStaticBoard(context, assets, snapshot);

  if (snapshot.currentPiece) {
    drawPiece(
      context,
      assets,
      snapshot.currentPiece,
      (X_OFFSET + snapshot.currentPiece.leftOff) * BOX,
      (snapshot.currentPiece.topOff - Y_OFFSET) * BOX,
    );
  }

  context.drawImage(assets.scoreBoard, 13 * BOX + PIXEL, 0, PIXEL * 55, PIXEL * 144);
  drawSideWalls(context, assets);

  context.fillStyle = FALLBACK_DARK;
  context.textAlign = "right";
  context.font = `${PIXEL * 8}px ${HUD_FONT}`;
  context.fillText(String(snapshot.score), PIXEL * 153, PIXEL * 31);
  context.fillText(String(snapshot.level), PIXEL * 145, PIXEL * 63);
  context.fillText(String(snapshot.lines), PIXEL * 145, PIXEL * 87);

  if (snapshot.nextPieceType) {
    drawPreviewPiece(
      context,
      assets,
      PIECE_PREVIEWS[snapshot.nextPieceType],
      15 * BOX,
      14 * BOX,
      4 * BOX,
    );
  }

  if (snapshot.status === "paused" || snapshot.status === "gameOver") {
    context.fillStyle = "rgba(198, 207, 161, 0.94)";
    context.fillRect(42, 108, 236, 72);
    context.strokeStyle = FALLBACK_DARK;
    context.lineWidth = 2;
    context.strokeRect(42, 108, 236, 72);
    drawTextPrompt(
      context,
      snapshot.status === "gameOver" ? "GAME OVER" : "PAUSED",
      CANVAS_WIDTH / 2,
      138,
      "center",
    );
    context.textAlign = "center";
    context.font = `12px ${HUD_FONT}`;
    context.fillText(
      snapshot.status === "gameOver" ? "PRESS START TO RESTART" : "PRESS START TO RESUME",
      CANVAS_WIDTH / 2,
      158,
    );
  }
}

const PIECE_PREVIEWS: Record<TetrisPieceType, TetrisPieceState> = {
  i: { type: "i", matrix: [[false, false, false, false], [true, true, true, true], [false, false, false, false], [false, false, false, false]], leftOff: 0, topOff: 0 },
  j: { type: "j", matrix: [[true, false, false, false], [true, true, true, false], [false, false, false, false], [false, false, false, false]], leftOff: 0, topOff: 0 },
  l: { type: "l", matrix: [[false, false, true, false], [true, true, true, false], [false, false, false, false], [false, false, false, false]], leftOff: 0, topOff: 0 },
  o: { type: "o", matrix: [[false, true, true, false], [false, true, true, false], [false, false, false, false], [false, false, false, false]], leftOff: 0, topOff: 0 },
  s: { type: "s", matrix: [[false, true, true, false], [true, true, false, false], [false, false, false, false], [false, false, false, false]], leftOff: 0, topOff: 0 },
  t: { type: "t", matrix: [[false, true, false, false], [true, true, true, false], [false, false, false, false], [false, false, false, false]], leftOff: 0, topOff: 0 },
  z: { type: "z", matrix: [[true, true, false, false], [false, true, true, false], [false, false, false, false], [false, false, false, false]], leftOff: 0, topOff: 0 },
};

function drawTitleScene(context: CanvasRenderingContext2D, assets: GameboyTetrisAssets) {
  context.drawImage(assets.titleScreen, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = FALLBACK_BG;
  context.fillRect(0, 228, CANVAS_WIDTH, CANVAS_HEIGHT - 228);
  drawTextPrompt(context, "PRESS START", CANVAS_WIDTH / 2, 252, "center");
}

function mapArcadePulseToInput(button: ExternalGameboyPulse["button"]) {
  if (button === "left") {
    return "left" satisfies TetrisInput;
  }
  if (button === "right") {
    return "right" satisfies TetrisInput;
  }
  if (button === "down") {
    return "down" satisfies TetrisInput;
  }
  if (button === "up") {
    return "rotate" satisfies TetrisInput;
  }
  if (button === "a") {
    return "hold" satisfies TetrisInput;
  }
  if (button === "b") {
    return "hardDrop" satisfies TetrisInput;
  }
  if (button === "start") {
    return "start" satisfies TetrisInput;
  }

  return null;
}

function mapKeyboardToInput(event: KeyboardEvent) {
  if (event.key === "ArrowLeft") {
    return "left" satisfies TetrisInput;
  }
  if (event.key === "ArrowRight") {
    return "right" satisfies TetrisInput;
  }
  if (event.key === "ArrowDown") {
    return "down" satisfies TetrisInput;
  }
  if (event.key === "ArrowUp") {
    return "rotate" satisfies TetrisInput;
  }
  if (event.key === "a" || event.key === "A") {
    return "hold" satisfies TetrisInput;
  }
  if (event.key === "b" || event.key === "B") {
    return "hardDrop" satisfies TetrisInput;
  }
  if (event.key === "c" || event.key === "C") {
    return "hold" satisfies TetrisInput;
  }
  if (event.key === " " || event.key === "x" || event.key === "X") {
    return "hardDrop" satisfies TetrisInput;
  }
  if (event.key === "Enter") {
    return "start" satisfies TetrisInput;
  }

  return null;
}

function useTetrisArcadeLoop(args: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  engineRef: RefObject<GameboyTetrisEngine>;
  assets: GameboyTetrisAssets | null;
  pendingInputRef: RefObject<TetrisInput | null>;
  softDropStateRef: RefObject<SoftDropState>;
  dispatchInputRef: RefObject<(input: TetrisInput) => void>;
  onSnapshotRef: RefObject<(snapshot: TetrisSnapshot, result: SoloGameResult | null) => void>;
}) {
  const {
    canvasRef,
    engineRef,
    assets,
    pendingInputRef,
    softDropStateRef,
    dispatchInputRef,
    onSnapshotRef,
  } = args;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const engine = engineRef.current;

    if (!canvas || !context || !assets) {
      return;
    }

    configureGameboyScreenCanvas(canvas, context);

    let animationFrame = 0;
    let lastFrame = performance.now();
    let dropAccumulator = 0;
    let stopped = false;

    const render = () => {
      const snapshot = engine.getSnapshot();
      context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (snapshot.status === "title") {
        drawTitleScene(context, assets);
      } else {
        drawBoardScene(context, assets, snapshot);
      }
      onSnapshotRef.current(snapshot, engine.getResult());
    };

    const loop = (time: number) => {
      if (stopped) {
        return;
      }

      if (pendingInputRef.current) {
        const input = pendingInputRef.current;
        pendingInputRef.current = null;
        dispatchInputRef.current(input);
      }

      const elapsed = time - lastFrame;
      lastFrame = time;
      if (engine.getStatus() === "playing") {
        dropAccumulator += elapsed;
      } else {
        dropAccumulator = 0;
      }

      while (engine.getStatus() === "playing" && dropAccumulator >= engine.getDropDelayMs()) {
        const dropDelay = engine.getDropDelayMs();
        dropAccumulator -= dropDelay;
        engine.tick(Date.now());
      }

      const softDropState = softDropStateRef.current;
      if (softDropState.active) {
        const snapshot = engine.getSnapshot();
        if (
          snapshot.status !== "playing" ||
          !snapshot.currentPiece ||
          snapshot.piecesPlaced !== softDropState.pieceCount
        ) {
          softDropState.active = false;
          softDropState.pieceCount = null;
          softDropState.accumulatorMs = 0;
        } else {
          softDropState.accumulatorMs += elapsed;

          while (softDropState.accumulatorMs >= SOFT_DROP_REPEAT_MS) {
            softDropState.accumulatorMs -= SOFT_DROP_REPEAT_MS;
            dispatchInputRef.current("down");

            const nextSnapshot = engine.getSnapshot();
            if (
              nextSnapshot.status !== "playing" ||
              !nextSnapshot.currentPiece ||
              nextSnapshot.piecesPlaced !== softDropState.pieceCount
            ) {
              softDropState.active = false;
              softDropState.pieceCount = null;
              softDropState.accumulatorMs = 0;
              break;
            }
          }
        }
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
  }, [assets, canvasRef, dispatchInputRef, engineRef, onSnapshotRef, pendingInputRef, softDropStateRef]);
}

function TetrisGameCanvas({
  sessionUser,
  externalPulse,
  onExit,
  onReplayReady,
  onAudioCue,
  onMusicTrackChange,
  ignoredPulseSeq,
}: {
  sessionUser: SessionUser | null;
  externalPulse?: ExternalGameboyPulse | null;
  onExit?: () => void;
  onReplayReady?: (restart: () => void, score: number, result: SoloGameResult | null) => void;
  onAudioCue?: (cue: GameboyAudioCue) => void;
  onMusicTrackChange?: (track: GameboyMusicTrack | null) => void;
  ignoredPulseSeq?: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef(createGameboyTetrisEngine());
  const lastPulseRef = useRef<number | null>(ignoredPulseSeq ?? null);
  const [assets, setAssets] = useState<GameboyTetrisAssets | null>(null);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<SoloGameResult | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const pendingInputRef = useRef<TetrisInput | null>(null);
  const previousSnapshotRef = useRef<TetrisSnapshot | null>(null);
  const softDropStateRef = useRef<SoftDropState>({
    active: false,
    pieceCount: null,
    accumulatorMs: 0,
  });
  const audioCueRef = useRef(onAudioCue);
  const activeMusicTrackRef = useRef<GameboyMusicTrack | null>(null);
  const dispatchInputRef = useRef<(input: TetrisInput) => void>(() => undefined);
  const onSnapshotRef = useRef<(snapshot: TetrisSnapshot, result: SoloGameResult | null) => void>(
    () => undefined,
  );

  useEffect(() => {
    audioCueRef.current = onAudioCue;
  }, [onAudioCue]);

  const playAudioCue = (cue: GameboyAudioCue) => {
    audioCueRef.current?.(cue);
  };

  const syncMusicTrack = useEffectEvent((status: TetrisSnapshot["status"]) => {
    const nextTrack =
      status === "title"
        ? "tetrisTitle"
        : status === "playing" || status === "paused"
          ? "tetris"
          : null;

    if (activeMusicTrackRef.current === nextTrack) {
      return;
    }

    activeMusicTrackRef.current = nextTrack;
    onMusicTrackChange?.(nextTrack);
  });

  const dispatchInput = useEffectEvent((input: TetrisInput) => {
    const previousStatus = engineRef.current.getStatus();
    engineRef.current.handleInput(input);
    const nextStatus = engineRef.current.getStatus();

    if (input === "restart" || (input === "start" && (previousStatus === "title" || previousStatus === "gameOver"))) {
      setResetKey((value) => value + 1);
      setScore(0);
      setResult(null);
    }

    if (input === "start" && previousStatus === "playing" && nextStatus === "paused") {
      playAudioCue("pause");
      return;
    }

    if (input === "start" && previousStatus === "paused" && nextStatus === "playing") {
      playAudioCue("resume");
      return;
    }

    if (
      (input === "start" && (previousStatus === "title" || previousStatus === "gameOver") && nextStatus === "playing") ||
      input === "restart"
    ) {
      playAudioCue("menuConfirm");
    }
  });

  useScoreSave({
    manifestId: "tetris",
    sessionUser,
    result,
    resetKey,
  });

  const stopSoftDrop = useEffectEvent(() => {
    softDropStateRef.current.active = false;
    softDropStateRef.current.pieceCount = null;
    softDropStateRef.current.accumulatorMs = 0;
  });

  const startSoftDrop = useEffectEvent(() => {
    const snapshot = engineRef.current.getSnapshot();
    if (engineRef.current.getStatus() !== "playing" || !snapshot.currentPiece) {
      return;
    }

    softDropStateRef.current.active = true;
    softDropStateRef.current.pieceCount = snapshot.piecesPlaced;
    softDropStateRef.current.accumulatorMs = 0;
    pendingInputRef.current = "down";
  });

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
    dispatchInputRef.current = dispatchInput;
    onSnapshotRef.current = (snapshot: TetrisSnapshot, nextResult: SoloGameResult | null) => {
      const previousSnapshot = previousSnapshotRef.current;

      syncMusicTrack(snapshot.status);

      if (previousSnapshot) {
        if (previousSnapshot.status !== "gameOver" && snapshot.status === "gameOver") {
          playAudioCue("tetrisGameOver");
        } else if (snapshot.lines > previousSnapshot.lines) {
          playAudioCue("tetrisLineClear");
        } else if (snapshot.piecesPlaced > previousSnapshot.piecesPlaced) {
          playAudioCue("tetrisLock");
        }
      }

      previousSnapshotRef.current = snapshot;
      setScore((current) => (current === snapshot.score ? current : snapshot.score));
      setResult((current) => {
        if (
          current?.score === nextResult?.score &&
          current?.durationMs === nextResult?.durationMs
        ) {
          return current;
        }

        return nextResult;
      });
    };
  });

  useEffect(() => {
    syncMusicTrack(engineRef.current.getStatus());

    return () => {
      activeMusicTrackRef.current = null;
      onMusicTrackChange?.(null);
    };
  }, [onMusicTrackChange]);

  useTetrisArcadeLoop({
    canvasRef,
    engineRef,
    assets,
    pendingInputRef,
    softDropStateRef,
    dispatchInputRef,
    onSnapshotRef,
  });

  useEffect(() => {
    if (!onReplayReady) {
      return;
    }

    onReplayReady(
      () => {
        dispatchInputRef.current("restart");
      },
      score,
      result,
    );
  }, [onReplayReady, result, score]);

  useEffect(() => {
    if (!externalPulse || lastPulseRef.current === externalPulse.seq) {
      return;
    }

    lastPulseRef.current = externalPulse.seq;

    if (externalPulse.button === "down") {
      if (externalPulse.pressed) {
        startSoftDrop();
      } else {
        stopSoftDrop();
      }
      return;
    }

    if (!externalPulse.pressed) {
      return;
    }

    if (externalPulse.button === "select") {
      onExit?.();
      return;
    }

    const input = mapArcadePulseToInput(externalPulse.button);
    if (input) {
      pendingInputRef.current = input;
    }
  }, [externalPulse, onExit]);

  useEffect(() => {
    if (externalPulse) {
      return;
    }

    const pressedKeys = new Set<string>();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (event.repeat || pressedKeys.has(event.key)) {
          return;
        }

        pressedKeys.add(event.key);
        startSoftDrop();
        return;
      }

      const input = mapKeyboardToInput(event);
      if (!input) {
        return;
      }

      event.preventDefault();
      dispatchInputRef.current(input);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown") {
        return;
      }

      event.preventDefault();
      pressedKeys.delete(event.key);
      stopSoftDrop();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [externalPulse]);

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
        background: FALLBACK_BG,
      }}
    />
  );
}

export function ArcadeGameboyTetris({
  controlPulse,
  sessionUser,
  onExit,
  onAudioCue,
  onMusicTrackChange,
  ignoredPulseSeq,
}: {
  controlPulse: ExternalGameboyPulse | null;
  sessionUser: SessionUser | null;
  onExit: () => void;
  onAudioCue?: (cue: GameboyAudioCue) => void;
  onMusicTrackChange?: (track: GameboyMusicTrack | null) => void;
  ignoredPulseSeq?: number | null;
}) {
  return (
    <TetrisGameCanvas
      externalPulse={controlPulse}
      sessionUser={sessionUser}
      onExit={onExit}
      onAudioCue={onAudioCue}
      onMusicTrackChange={onMusicTrackChange}
      ignoredPulseSeq={ignoredPulseSeq}
    />
  );
}
