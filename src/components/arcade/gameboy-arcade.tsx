"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";

import type {
  GameboyControlButton,
  GameboyControlPulse,
  GameboyPressedButtons,
} from "@/components/arcade/gameboy-games";
import { GameboyCursorField } from "@/components/backgrounds/gameboy-cursor-field";
import { loadGameboyTetrisAssets } from "@/games/tetris/gameboy-tetris-assets";
import type { GameboyMusicTrack } from "@/lib/gameboy-audio";
import type { SessionUser } from "@/lib/contracts";
import { gameRegistry } from "@/lib/game-registry";
import { ArcadeStage } from "@/components/arcade/arcade-stage";
import { useGameboyAudio } from "@/lib/gameboy-audio";

const pageShellStyle: CSSProperties = {
  width: "100%",
  minHeight: "100dvh",
  padding: 0,
  boxSizing: "border-box",
  background: "#000000",
};

const backgroundTintStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--gameboy-screen-bg)",
  pointerEvents: "none",
};

const powerTipStyle: CSSProperties = {
  position: "fixed",
  top: "18px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 20,
  borderRadius: "999px",
  background: "rgba(10, 14, 9, 0.72)",
  color: "#ffffff",
  padding: "8px 14px",
  fontFamily: '"Rajdhani", sans-serif',
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontSize: "0.8rem",
};

const DEFAULT_SOUND_LEVEL = 5;
const DEFAULT_MUSIC_LEVEL = 5;
const SOUND_LEVEL_STORAGE_KEY = "playdround:gameboy-sound-level";
const MUSIC_LEVEL_STORAGE_KEY = "playdround:gameboy-music-level";
const BACKGROUND_FADE_MS = 420;
const LOGOUT_POWER_OFF_MS = 320;
const LOGOUT_FADE_MS = 700;

function clampLevel(level: number) {
  return Math.max(0, Math.min(10, Math.round(level)));
}

export function GameboyArcade({ sessionUser }: { sessionUser: SessionUser | null }) {
  const [selectedGameId, setSelectedGameId] = useState(gameRegistry[0]?.id ?? "snake");
  const [gameboyZoomed, setGameboyZoomed] = useState(false);
  const [poweredOn, setPoweredOn] = useState(false);
  const [soundLevel, setSoundLevel] = useState(DEFAULT_SOUND_LEVEL);
  const [musicLevel, setMusicLevel] = useState(DEFAULT_MUSIC_LEVEL);
  const [showPowerTip, setShowPowerTip] = useState(false);
  const [powerTipVisible, setPowerTipVisible] = useState(false);
  const [controlPulse, setControlPulse] = useState<GameboyControlPulse | null>(null);
  const [pressedButtons, setPressedButtons] = useState<GameboyPressedButtons>({});
  const [musicTrack, setMusicTrack] = useState<GameboyMusicTrack | null>(null);
  const [hoveringModel, setHoveringModel] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [logoutPhase, setLogoutPhase] = useState<"idle" | "poweringOff" | "fading">("idle");
  const [backgroundVisible, setBackgroundVisible] = useState(false);
  const controlSourcesRef = useRef<Map<GameboyControlButton, Set<string>>>(new Map());
  const { playCue, unlockAudio } = useGameboyAudio({
    soundEnabled: soundLevel > 0,
    musicEnabled: musicLevel > 0,
    soundVolume: soundLevel / 10,
    musicVolume: musicLevel / 10,
    poweredOn,
    musicTrack,
  });

  useEffect(() => {
    void loadGameboyTetrisAssets().catch(() => undefined);
  }, []);

  const resetControlState = useCallback(() => {
    controlSourcesRef.current.clear();
    setPressedButtons({});
    setControlPulse(null);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    const storedSoundLevel = window.localStorage.getItem(SOUND_LEVEL_STORAGE_KEY);
    const storedMusicLevel = window.localStorage.getItem(MUSIC_LEVEL_STORAGE_KEY);

    if (storedSoundLevel !== null) {
      const parsedSoundLevel = Number(storedSoundLevel);
      if (Number.isFinite(parsedSoundLevel)) {
        queueMicrotask(() => {
          if (!cancelled) {
            setSoundLevel(clampLevel(parsedSoundLevel));
          }
        });
      }
    }

    if (storedMusicLevel !== null) {
      const parsedMusicLevel = Number(storedMusicLevel);
      if (Number.isFinite(parsedMusicLevel)) {
        queueMicrotask(() => {
          if (!cancelled) {
            setMusicLevel(clampLevel(parsedMusicLevel));
          }
        });
      }
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SOUND_LEVEL_STORAGE_KEY, String(clampLevel(soundLevel)));
  }, [soundLevel]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(MUSIC_LEVEL_STORAGE_KEY, String(clampLevel(musicLevel)));
  }, [musicLevel]);

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
      x: "b",
      X: "b",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (logoutPhase !== "idle") {
        event.preventDefault();
        return;
      }

      if ((event.key === "p" || event.key === "P") && !poweredOn) {
        if (event.repeat) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        unlockAudio();
        resetControlState();
        setPoweredOn(true);
        setShowPowerTip(false);
        playCue("powerOn");
        return;
      }

      if ((event.key === "z" || event.key === "Z") && poweredOn) {
        if (event.repeat) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        setGameboyZoomed((current) => !current);
        return;
      }

      if (!poweredOn) {
        return;
      }

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
      if (logoutPhase !== "idle") {
        event.preventDefault();
        return;
      }

      if (!poweredOn) {
        return;
      }

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
  }, [logoutPhase, playCue, poweredOn, resetControlState, unlockAudio]);

  useEffect(() => {
    let tipTimer = 0;
    let fadeFrame = 0;

    if (poweredOn) {
      return () => window.clearTimeout(tipTimer);
    }

    tipTimer = window.setTimeout(() => {
      setShowPowerTip(true);
      fadeFrame = window.requestAnimationFrame(() => {
        setPowerTipVisible(true);
      });
    }, 5000);

    return () => {
      window.clearTimeout(tipTimer);
      window.cancelAnimationFrame(fadeFrame);
    };
  }, [poweredOn]);

  const handleBackgroundReadyChange = useCallback((ready: boolean) => {
    setBackgroundVisible(ready);
  }, []);

  const stacked = viewport.width < 980;
  const stageHeight = useMemo(
    () =>
      stacked
        ? viewport.height
        : Math.max(viewport.height, 640),
    [stacked, viewport.height],
  );
  const handleSelectGame = (gameId: string) => {
    setSelectedGameId(gameId);
  };
  const handlePowerOff = () => {
    unlockAudio();
    resetControlState();
    setBackgroundVisible(false);
    setPoweredOn(false);
    setShowPowerTip(false);
    setPowerTipVisible(false);
    setHoveringModel(false);
    playCue("powerOff");
  };

  const handleLogout = useCallback(async () => {
    if (logoutPhase !== "idle") {
      return;
    }

    unlockAudio();
    resetControlState();
    setLogoutPhase("poweringOff");
    setBackgroundVisible(false);
    setPoweredOn(false);
    setShowPowerTip(false);
    setPowerTipVisible(false);
    setHoveringModel(false);
    playCue("powerOff");

    await new Promise((resolve) => {
      window.setTimeout(resolve, LOGOUT_POWER_OFF_MS);
    });

    setLogoutPhase("fading");

    await new Promise((resolve) => {
      window.setTimeout(resolve, LOGOUT_FADE_MS);
    });

    if (sessionUser) {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    }

    window.location.assign("/enter");
  }, [logoutPhase, playCue, resetControlState, sessionUser, unlockAudio]);

  return (
    <main
      style={{
        ...pageShellStyle,
        position: stacked ? "fixed" : "relative",
        inset: stacked ? 0 : undefined,
        width: stacked ? "100vw" : "100%",
        minHeight: "100dvh",
        height: "100dvh",
        padding: 0,
        isolation: "isolate",
        display: "block",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          ...backgroundTintStyle,
          zIndex: 0,
          opacity: backgroundVisible ? 1 : 0,
          transition: `opacity ${BACKGROUND_FADE_MS}ms ease`,
        }}
      />
      {poweredOn ? (
        <GameboyCursorField
          variant="arcade"
          mouseReactive={!hoveringModel}
          visible={backgroundVisible}
          fadeMs={BACKGROUND_FADE_MS}
        />
      ) : null}
      {showPowerTip ? (
        <div
          style={{
            ...powerTipStyle,
            opacity: powerTipVisible ? 1 : 0,
            transition: "opacity 320ms ease",
          }}
        >
          Press P to turn on the Game Boy
        </div>
      ) : null}
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0,
          minHeight: "100dvh",
          overflow: stacked ? "hidden" : "visible",
          padding: 0,
          position: "relative",
          zIndex: 1,
          opacity: logoutPhase === "fading" ? 0 : 1,
          transition: `opacity ${LOGOUT_FADE_MS}ms ease`,
          pointerEvents: logoutPhase === "idle" ? "auto" : "none",
        }}
      >
        <div
          style={{
            width: stacked ? "100vw" : "100%",
            maxWidth: stacked ? "100vw" : "1080px",
            height: stacked ? "100dvh" : `${Math.round(stageHeight)}px`,
          }}
        >
          <ArcadeStage
            fullScreen={stacked}
            height={stageHeight}
            poweredOn={poweredOn}
            selectedGameId={selectedGameId}
            gameboyZoomed={gameboyZoomed}
            sessionUser={sessionUser}
            controlPulse={controlPulse}
            pressedButtons={pressedButtons}
            soundLevel={soundLevel}
            musicLevel={musicLevel}
            onControlButtonChange={applyControlState}
            onModelHoverChange={setHoveringModel}
            onSelectGame={handleSelectGame}
            onSoundLevelChange={setSoundLevel}
            onMusicLevelChange={setMusicLevel}
            onPowerOff={handlePowerOff}
            onRequestLogout={async () => {
              await handleLogout();
            }}
            onAudioCue={playCue}
            onMusicTrackChange={setMusicTrack}
            onBackgroundReadyChange={handleBackgroundReadyChange}
          />
        </div>
      </section>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 25,
          background: "#000000",
          opacity: logoutPhase === "fading" ? 1 : 0,
          transition: `opacity ${LOGOUT_FADE_MS}ms ease`,
          pointerEvents: logoutPhase === "idle" ? "none" : "auto",
        }}
      />
    </main>
  );
}
