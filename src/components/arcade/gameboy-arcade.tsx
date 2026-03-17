"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";

import type {
  GameboyControlButton,
  GameboyControlPulse,
  GameboyPressedButtons,
} from "@/components/arcade/gameboy-games";
import type { GameboyMusicTrack } from "@/lib/gameboy-audio";
import type { SessionUser } from "@/lib/contracts";
import { gameRegistry } from "@/lib/game-registry";
import { ArcadeSidebar } from "@/components/arcade/arcade-sidebar";
import { ARCADE_BOOT_DURATION_MS, ArcadeStage } from "@/components/arcade/arcade-stage";
import { useGameboyAudio } from "@/lib/gameboy-audio";

const pageShellStyle: CSSProperties = {
  width: "100%",
  minHeight: "100vh",
  padding: "36px 24px",
  boxSizing: "border-box",
  background: "#000000",
};

const floatingControlsStyle: CSSProperties = {
  position: "fixed",
  left: "24px",
  bottom: "24px",
  zIndex: 20,
  display: "flex",
  gap: "12px",
  alignItems: "center",
};

const floatingControlButtonStyle: CSSProperties = {
  width: "48px",
  height: "48px",
  padding: 0,
  border: "1px solid rgba(183, 190, 159, 0.16)",
  borderRadius: "999px",
  background: "#000000",
  color: "#f4f2ed",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  appearance: "none",
};

export function GameboyArcade({ sessionUser }: { sessionUser: SessionUser | null }) {
  const [selectedGameId, setSelectedGameId] = useState(gameRegistry[0]?.id ?? "snake");
  const [poweredOn, setPoweredOn] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [leaderboardReady, setLeaderboardReady] = useState(false);
  const [controlPulse, setControlPulse] = useState<GameboyControlPulse | null>(null);
  const [pressedButtons, setPressedButtons] = useState<GameboyPressedButtons>({});
  const [musicTrack, setMusicTrack] = useState<GameboyMusicTrack | null>(null);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const controlSourcesRef = useRef<Map<GameboyControlButton, Set<string>>>(new Map());
  const { playCue, unlockAudio } = useGameboyAudio({
    soundEnabled: soundOn,
    musicEnabled: musicOn,
    poweredOn,
    musicTrack,
  });

  const applyControlState = (button: GameboyControlButton, pressed: boolean, sourceId: string) => {
    const activeSources = controlSourcesRef.current.get(button) ?? new Set<string>();
    const wasPressed = activeSources.size > 0;

    if (pressed) {
      activeSources.add(sourceId);
    } else {
      activeSources.delete(sourceId);
    }

    if (activeSources.size > 0) {
      controlSourcesRef.current.set(button, activeSources);
    } else {
      controlSourcesRef.current.delete(button);
    }

    const isPressed = activeSources.size > 0;
    if (isPressed === wasPressed) {
      return;
    }

    if (isPressed) {
      unlockAudio();
      playCue(
        button === "up" || button === "down" || button === "left" || button === "right"
          ? "dpadPress"
          : "buttonPress",
      );
    }

    setPressedButtons((current) => {
      if (isPressed) {
        return {
          ...current,
          [button]: true,
        };
      }

      if (!current[button]) {
        return current;
      }

      const next = { ...current };
      delete next[button];
      return next;
    });

    setControlPulse({
      button,
      pressed: isPressed,
      seq: Date.now() + Math.random(),
    });
  };

  const applyControlStateEvent = useEffectEvent(applyControlState);

  useEffect(() => {
    const syncViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    const keyMap: Record<string, GameboyControlButton | undefined> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Enter: "start",
      Shift: "select",
      a: "a",
      A: "a",
      b: "b",
      B: "b",
      z: "a",
      Z: "a",
      x: "b",
      X: "b",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const button = keyMap[event.key];
      if (!button) {
        return;
      }

      if (event.repeat) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      applyControlStateEvent(button, true, `keyboard:${event.key}`);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const button = keyMap[event.key];
      if (!button) {
        return;
      }

      event.preventDefault();
      applyControlStateEvent(button, false, `keyboard:${event.key}`);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    let readyTimer = 0;

    if (!poweredOn) {
      return () => window.clearTimeout(readyTimer);
    }

    readyTimer = window.setTimeout(() => {
      setLeaderboardReady(true);
    }, ARCADE_BOOT_DURATION_MS);

    return () => window.clearTimeout(readyTimer);
  }, [poweredOn]);

  const stacked = viewport.width < 980;
  const stageHeight = useMemo(
    () =>
      stacked
        ? viewport.height
        : Math.min(Math.max(viewport.height - 88, 640), 920),
    [stacked, viewport.height],
  );
  const selectedGame = gameRegistry.find((entry) => entry.id === selectedGameId) ?? gameRegistry[0];
  const handleTogglePower = () => {
    unlockAudio();
    setPoweredOn((current) => {
      const next = !current;

      if (current) {
        setLeaderboardReady(false);
      }

      playCue(next ? "powerOn" : "powerOff");
      return next;
    });
  };

  return (
    <main
      style={{
        ...pageShellStyle,
        position: stacked ? "fixed" : "static",
        inset: stacked ? 0 : undefined,
        width: stacked ? "100vw" : "100%",
        minHeight: stacked ? "100dvh" : "100vh",
        height: stacked ? "100dvh" : "100vh",
        padding: stacked ? 0 : pageShellStyle.padding,
        display: "grid",
        gridTemplateColumns: stacked ? "1fr" : "minmax(0, 1fr) 360px",
        gap: stacked ? 0 : "28px",
        overflow: "hidden",
        background: "#000000",
      }}
    >
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0,
          minHeight: stacked ? "100dvh" : undefined,
          overflow: "hidden",
          padding: stacked ? 0 : "8px 0",
        }}
      >
        <div
          style={{
            width: stacked ? "100vw" : "100%",
            maxWidth: stacked ? "100vw" : "980px",
            height: stacked ? "100dvh" : `${Math.round(stageHeight)}px`,
          }}
        >
          <ArcadeStage
            fullScreen={stacked}
            height={stageHeight}
            poweredOn={poweredOn}
            selectedGameId={selectedGame.id}
            sessionUser={sessionUser}
            controlPulse={controlPulse}
            pressedButtons={pressedButtons}
            onControlButtonChange={applyControlState}
            onSelectGame={setSelectedGameId}
            onAudioCue={playCue}
            onMusicTrackChange={setMusicTrack}
          />
        </div>
      </section>

      {!stacked ? (
        <ArcadeSidebar
          selectedGameId={selectedGame.id}
          sessionUser={sessionUser}
          height={stageHeight}
          showLeaderboard={leaderboardReady && Boolean(selectedGame)}
        />
      ) : null}
      <div
        style={{
          ...floatingControlsStyle,
          left: stacked ? "16px" : floatingControlsStyle.left,
          bottom: stacked ? "16px" : floatingControlsStyle.bottom,
        }}
      >
        <button
          type="button"
          onClick={handleTogglePower}
          aria-label={poweredOn ? "Turn power off" : "Turn power on"}
          title={poweredOn ? "Turn power off" : "Turn power on"}
          style={{
            ...floatingControlButtonStyle,
            borderColor: poweredOn ? "rgba(116, 247, 178, 0.32)" : "rgba(232, 60, 34, 0.32)",
            color: poweredOn ? "#74f7b2" : "#e83c22",
          }}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2.75v8.5" />
            <path d="M7.05 5.8a8.25 8.25 0 1 0 9.9 0" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            setSoundOn((value) => !value);
          }}
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          title={soundOn ? "Turn sound off" : "Turn sound on"}
          style={{
            ...floatingControlButtonStyle,
            borderColor: "rgba(183, 190, 159, 0.16)",
            color: "#f4f2ed",
          }}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={soundOn ? "#f4f2ed" : "#7f8493"}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 14h4l5 4V6L8 10H4z" />
            {soundOn ? (
              <>
                <path d="M17 9.5a4 4 0 0 1 0 5" />
                <path d="M19.75 7a7.5 7.5 0 0 1 0 10" />
              </>
            ) : (
              <path d="M16 8l6 8M22 8l-6 8" />
            )}
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            setMusicOn((value) => !value);
          }}
          aria-label={musicOn ? "Turn music off" : "Turn music on"}
          title={musicOn ? "Turn music off" : "Turn music on"}
          style={{
            ...floatingControlButtonStyle,
            borderColor: "rgba(183, 190, 159, 0.16)",
            color: "#f4f2ed",
          }}
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={musicOn ? "#f4f2ed" : "#7f8493"}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V6.5l9-2v11.5" />
            <path d="M9 10.5l9-2" />
            <circle cx="7" cy="18" r="2.5" />
            <circle cx="16" cy="16" r="2.5" />
            {musicOn ? null : <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
    </main>
  );
}
