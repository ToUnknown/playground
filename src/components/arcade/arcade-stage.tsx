"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { GameboyModelViewer } from "@/components/arcade/gameboy-model-viewer";
import {
  GameboyBootCanvas,
  GameboyMenuCanvas,
} from "@/components/arcade/gameboy-games";
import { GameboySnake } from "@/games/snake/gameboy-snake-canvas";
import { ArcadeGameboyTetris } from "@/games/tetris/gameboy-tetris-canvas";
import type {
  GameboyControlButton,
  GameboyControlPulse,
  GameboyPressedButtons,
} from "@/components/arcade/gameboy-games";
import type { SessionUser } from "@/lib/contracts";
import { gameRegistry } from "@/lib/game-registry";
import type { GameboyAudioCue, GameboyMusicTrack } from "@/lib/gameboy-audio";

const stageShellStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
};

type ScreenPhase = "off" | "boot" | "menu" | "game";

export const ARCADE_BOOT_DURATION_MS = 1180;

export function ArcadeStage({
  fullScreen,
  height,
  poweredOn,
  selectedGameId,
  sessionUser,
  controlPulse,
  pressedButtons,
  onControlButtonChange,
  onSelectGame,
  onAudioCue,
  onMusicTrackChange,
}: {
  fullScreen: boolean;
  height: number;
  poweredOn: boolean;
  selectedGameId: string;
  sessionUser: SessionUser | null;
  controlPulse: GameboyControlPulse | null;
  pressedButtons: GameboyPressedButtons;
  onControlButtonChange: (button: GameboyControlButton, pressed: boolean, sourceId: string) => void;
  onSelectGame: (gameId: string) => void;
  onAudioCue?: (cue: GameboyAudioCue) => void;
  onMusicTrackChange?: (track: GameboyMusicTrack | null) => void;
}) {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const [screenCanvas, setScreenCanvas] = useState<HTMLCanvasElement | null>(null);
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>("off");
  const [screenVisible, setScreenVisible] = useState(false);
  const [launchPulseSeq, setLaunchPulseSeq] = useState<number | null>(null);
  const lastControlSeqRef = useRef<number | null>(null);
  const selectedIndex = useMemo(
    () => Math.max(0, gameRegistry.findIndex((game) => game.id === selectedGameId)),
    [selectedGameId],
  );

  useEffect(() => {
    const wrapper = sourceRef.current;
    if (!wrapper) {
      return;
    }

    const syncCanvas = () => {
      const canvas = wrapper.querySelector("canvas");
      setScreenCanvas(canvas instanceof HTMLCanvasElement ? canvas : null);
    };

    syncCanvas();
    const frame = window.requestAnimationFrame(syncCanvas);
    return () => window.cancelAnimationFrame(frame);
  }, [screenPhase, selectedGameId]);

  useEffect(() => {
    let bootTimer = 0;
    let offTimer = 0;
    let fadeInFrame = 0;
    let fadeOutFrame = 0;

    if (!poweredOn) {
      fadeOutFrame = window.requestAnimationFrame(() => {
        setScreenVisible(false);
      });
      offTimer = window.setTimeout(() => {
        setScreenPhase("off");
      }, 220);
      return () => {
        window.cancelAnimationFrame(fadeOutFrame);
        window.clearTimeout(offTimer);
      };
    }

    fadeInFrame = window.requestAnimationFrame(() => {
      setScreenPhase("boot");
      setScreenVisible(true);
    });
    bootTimer = window.setTimeout(() => {
      setScreenPhase("menu");
    }, ARCADE_BOOT_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(fadeOutFrame);
      window.cancelAnimationFrame(fadeInFrame);
      window.clearTimeout(bootTimer);
      window.clearTimeout(offTimer);
    };
  }, [poweredOn]);

  useEffect(() => {
    if (!poweredOn || screenPhase === "off") {
      onMusicTrackChange?.(null);
      return;
    }

    if (screenPhase === "boot" || screenPhase === "menu") {
      onMusicTrackChange?.("menu");
      return;
    }

    if (screenPhase === "game" && selectedGameId === "tetris") {
      onMusicTrackChange?.("tetris");
      return;
    }

    if (screenPhase === "game" && selectedGameId === "snake") {
      onMusicTrackChange?.("snake");
      return;
    }

    onMusicTrackChange?.(null);
  }, [onMusicTrackChange, poweredOn, screenPhase, selectedGameId]);

  useEffect(() => {
    if (!poweredOn || screenPhase !== "menu" || !controlPulse || !controlPulse.pressed) {
      return;
    }

    if (lastControlSeqRef.current === controlPulse.seq) {
      return;
    }
    lastControlSeqRef.current = controlPulse.seq;

    if (controlPulse.button === "up" || controlPulse.button === "left") {
      const nextIndex = (selectedIndex - 1 + gameRegistry.length) % gameRegistry.length;
      onSelectGame(gameRegistry[nextIndex]?.id ?? selectedGameId);
      onAudioCue?.("menuMove");
      return;
    }

    if (controlPulse.button === "down" || controlPulse.button === "right") {
      const nextIndex = (selectedIndex + 1) % gameRegistry.length;
      onSelectGame(gameRegistry[nextIndex]?.id ?? selectedGameId);
      onAudioCue?.("menuMove");
      return;
    }

    if (controlPulse.button === "start" || controlPulse.button === "a") {
      onAudioCue?.("menuConfirm");
      window.requestAnimationFrame(() => {
        setLaunchPulseSeq(controlPulse.seq);
        setScreenPhase("game");
      });
    }
  }, [controlPulse, onAudioCue, onSelectGame, poweredOn, screenPhase, selectedGameId, selectedIndex]);

  const menuGames = useMemo(
    () =>
      gameRegistry.map((game) => ({
        name: game.name,
        modes: game.modes.length,
      })),
    [],
  );
  return (
    <section
      style={{
        ...stageShellStyle,
        overflow: fullScreen ? "visible" : "hidden",
      }}
    >
      <div
        ref={sourceRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "320px",
          height: "288px",
          overflow: "hidden",
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        {screenPhase === "boot" ? (
          <GameboyBootCanvas />
        ) : screenPhase === "menu" ? (
          <GameboyMenuCanvas
            games={menuGames}
            selectedIndex={selectedIndex}
          />
        ) : screenPhase === "game" && selectedGameId === "tetris" ? (
          <ArcadeGameboyTetris
            controlPulse={controlPulse}
            onExit={() => setScreenPhase("menu")}
            sessionUser={sessionUser}
            onAudioCue={onAudioCue}
            ignoredPulseSeq={launchPulseSeq}
          />
        ) : screenPhase === "game" ? (
          <GameboySnake
            controlPulse={controlPulse}
            onExit={() => setScreenPhase("menu")}
            sessionUser={sessionUser}
            onAudioCue={onAudioCue}
          />
        ) : null}
      </div>
      <div
        style={{
          width: "100%",
          height: fullScreen ? "100dvh" : `${Math.round(height)}px`,
          overflow: fullScreen ? "visible" : "hidden",
        }}
      >
        <GameboyModelViewer
          modelUrl="/models/game_boy_classic_interactive.glb"
          fullScreen={fullScreen}
          height={height}
          screenMode={screenCanvas ? "mapped" : "placeholder"}
          screenTexture={screenCanvas}
          poweredOn={screenVisible}
          pressedButtons={pressedButtons}
          onControlButtonChange={onControlButtonChange}
        />
      </div>
    </section>
  );
}
