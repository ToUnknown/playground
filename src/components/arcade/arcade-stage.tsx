"use client";

import { anyApi } from "convex/server";
import { useQuery } from "convex/react";
import { useEffect, useEffectEvent, useMemo, useRef, useState, type CSSProperties } from "react";

import { GameboyModelViewer } from "@/components/arcade/gameboy-model-viewer";
import {
  GameboyBootCanvas,
  GameboyMenuCanvas,
  type GameboyMenuScreen,
  type GameboyMenuView,
} from "@/components/arcade/gameboy-games";
import { useConvexAvailability } from "@/components/providers/convex-provider";
import { ArcadeGameboyBlackjack } from "@/games/blackjack/gameboy-blackjack-canvas";
import { GameboySnake } from "@/games/snake/gameboy-snake-canvas";
import { loadGameboyTetrisAssets } from "@/games/tetris/gameboy-tetris-assets";
import { ArcadeGameboyTetris } from "@/games/tetris/gameboy-tetris-canvas";
import type {
  GameboyControlButton,
  GameboyControlPulse,
  GameboyPressedButtons,
} from "@/components/arcade/gameboy-games";
import type { LeaderboardEntry, SessionUser } from "@/lib/contracts";
import { gameRegistry } from "@/lib/game-registry";
import type { GameboyAudioCue, GameboyMusicTrack } from "@/lib/gameboy-audio";
import type { GameboyViewerConfig } from "@/components/arcade/gameboy-model-viewer";

const stageShellStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
};

type ScreenPhase = "off" | "boot" | "menu" | "game";
const MAIN_MENU_ITEMS = ["Play", "Leaderboards", "Settings", "Turn off"] as const;
const SETTINGS_MENU_ITEMS = ["sounds", "music", "logout"] as const;

export const ARCADE_BOOT_DURATION_MS = 1180;
const DEFAULT_MENU_BALANCE = 100;

const ZOOMED_VIEWER_CONFIG: Partial<
  Omit<GameboyViewerConfig, "modelUrl" | "fullScreen" | "height" | "screen">
> = {
  // Manual tuning point for global screen zoom:
  // - `initialCamera.position[2]` smaller = closer, larger = farther back
  // - `initialCamera.fov` smaller = tighter zoom, larger = wider framing
  // - `modelTransform.position[0]` nudges left/right
  // - `modelTransform.position[1]` nudges up/down
  // - `modelTransform.scale` increases or decreases the apparent zoom
  initialCamera: {
    position: [0, 0.12, 1.8],
    fov: 25,
  },
  modelTransform: {
    position: [0, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    scale: 4,
  },
  motion: {
    dragSensitivity: {
      x: 0.03,
      y: 0.03,
    },
    rotationDamping: 4,
    dragLimits: {
      x: [-0.4, 0.4],
      y: [-0.6, 0.6],
    },
    pointerFollow: {
      x: 0,
      y: 0,
    },
  },
};

export function ArcadeStage({
  fullScreen,
  height,
  poweredOn,
  selectedGameId,
  gameboyZoomed,
  sessionUser,
  controlPulse,
  pressedButtons,
  soundLevel,
  musicLevel,
  onControlButtonChange,
  onModelHoverChange,
  onSelectGame,
  onSoundLevelChange,
  onMusicLevelChange,
  onPowerOff,
  onRequestLogout,
  onAudioCue,
  onMusicTrackChange,
  onBackgroundReadyChange,
}: {
  fullScreen: boolean;
  height: number;
  poweredOn: boolean;
  selectedGameId: string;
  gameboyZoomed: boolean;
  sessionUser: SessionUser | null;
  controlPulse: GameboyControlPulse | null;
  pressedButtons: GameboyPressedButtons;
  soundLevel: number;
  musicLevel: number;
  onControlButtonChange: (button: GameboyControlButton, pressed: boolean, sourceId: string) => void;
  onModelHoverChange?: (hovering: boolean) => void;
  onSelectGame: (gameId: string) => void;
  onSoundLevelChange: (level: number) => void;
  onMusicLevelChange: (level: number) => void;
  onPowerOff: () => void;
  onRequestLogout: () => Promise<void> | void;
  onAudioCue?: (cue: GameboyAudioCue) => void;
  onMusicTrackChange?: (track: GameboyMusicTrack | null) => void;
  onBackgroundReadyChange?: (ready: boolean) => void;
}) {
  const { available: convexAvailable } = useConvexAvailability();
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const [screenCanvas, setScreenCanvas] = useState<HTMLCanvasElement | null>(null);
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>("off");
  const [screenVisible, setScreenVisible] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [bootFinished, setBootFinished] = useState(false);
  const [menuAssetsReady, setMenuAssetsReady] = useState(false);
  const [menuBalance, setMenuBalance] = useState<number | null>(sessionUser ? null : DEFAULT_MENU_BALANCE);
  const [menuScreen, setMenuScreen] = useState<GameboyMenuScreen>("main");
  const [mainMenuIndex, setMainMenuIndex] = useState(0);
  const [leaderboardEntryIndex, setLeaderboardEntryIndex] = useState(0);
  const [settingsIndex, setSettingsIndex] = useState(0);
  const [logoutPending, setLogoutPending] = useState(false);
  const [launchPulseSeq, setLaunchPulseSeq] = useState<number | null>(null);
  const lastControlSeqRef = useRef<number | null>(null);
  const selectedIndex = useMemo(
    () => Math.max(0, gameRegistry.findIndex((game) => game.id === selectedGameId)),
    [selectedGameId],
  );
  const selectedGame = useMemo(
    () => gameRegistry.find((game) => game.id === selectedGameId) ?? gameRegistry[0] ?? null,
    [selectedGameId],
  );
  const leaderboardEntries = useQuery(
    anyApi.scores.getGlobalLeaderboard,
    convexAvailable && screenPhase === "menu" && menuScreen === "leaderboardEntries" && selectedGame
      ? {
          gameId: selectedGame.id,
          mode: selectedGame.modes[0]?.id ?? "solo",
          limit: 20,
        }
      : "skip",
  ) as LeaderboardEntry[] | undefined;

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
    let resetFrame = 0;

    if (!poweredOn) {
      resetFrame = window.requestAnimationFrame(() => {
        setBootFinished(false);
      });
      fadeOutFrame = window.requestAnimationFrame(() => {
        setScreenVisible(false);
      });
      offTimer = window.setTimeout(() => {
        setScreenPhase("off");
      }, 220);
      return () => {
        window.cancelAnimationFrame(resetFrame);
        window.cancelAnimationFrame(fadeOutFrame);
        window.clearTimeout(offTimer);
      };
    }

    if (!modelReady) {
      resetFrame = window.requestAnimationFrame(() => {
        setBootFinished(false);
        setScreenVisible(false);
        setScreenPhase("off");
      });
      return () => {
        window.cancelAnimationFrame(resetFrame);
      };
    }

    fadeInFrame = window.requestAnimationFrame(() => {
      setScreenPhase("boot");
      setScreenVisible(true);
      setMenuScreen("main");
      setMainMenuIndex(0);
      setLeaderboardEntryIndex(0);
      setSettingsIndex(0);
      setLogoutPending(false);
    });
    bootTimer = window.setTimeout(() => {
      setBootFinished(true);
    }, ARCADE_BOOT_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(fadeOutFrame);
      window.cancelAnimationFrame(fadeInFrame);
      window.cancelAnimationFrame(resetFrame);
      window.clearTimeout(bootTimer);
      window.clearTimeout(offTimer);
    };
  }, [modelReady, poweredOn]);

  useEffect(() => {
    if (!poweredOn) {
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setMenuAssetsReady(false);
      }
    });

    void loadGameboyTetrisAssets()
      .then(() => {
        if (!cancelled) {
          setMenuAssetsReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMenuAssetsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [poweredOn]);

  useEffect(() => {
    if (!poweredOn || screenPhase !== "boot" || !bootFinished || !menuAssetsReady) {
      return;
    }

    const phaseFrame = window.requestAnimationFrame(() => {
      lastControlSeqRef.current = controlPulse?.seq ?? null;
      setLaunchPulseSeq(null);
      setMenuScreen("main");
      setScreenPhase("menu");
    });

    return () => {
      window.cancelAnimationFrame(phaseFrame);
    };
  }, [bootFinished, controlPulse?.seq, menuAssetsReady, poweredOn, screenPhase]);

  useEffect(() => {
    let cancelled = false;

    if (!poweredOn) {
      queueMicrotask(() => {
        if (!cancelled) {
          setMenuBalance(sessionUser ? null : DEFAULT_MENU_BALANCE);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (!sessionUser) {
      queueMicrotask(() => {
        if (!cancelled) {
          setMenuBalance(DEFAULT_MENU_BALANCE);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    if (screenPhase !== "boot" && screenPhase !== "menu") {
      return;
    }

    void fetch("/api/blackjack-bank", {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load blackjack bank.");
        }

        const payload = (await response.json()) as { bank?: unknown };
        const nextBalance =
          typeof payload.bank === "number" && Number.isFinite(payload.bank)
            ? payload.bank
            : DEFAULT_MENU_BALANCE;

        if (!cancelled) {
          setMenuBalance(nextBalance);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMenuBalance(DEFAULT_MENU_BALANCE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [poweredOn, screenPhase, sessionUser]);

  useEffect(() => {
    onBackgroundReadyChange?.(poweredOn && modelReady && (screenPhase === "menu" || screenPhase === "game"));
  }, [modelReady, onBackgroundReadyChange, poweredOn, screenPhase]);

  useEffect(() => {
    if (!poweredOn || screenPhase === "off") {
      onMusicTrackChange?.(null);
      return;
    }

    if (screenPhase === "boot") {
      onMusicTrackChange?.(null);
      return;
    }

    if (screenPhase === "menu") {
      onMusicTrackChange?.("menu");
      return;
    }

    if (screenPhase === "game" && selectedGameId === "tetris") {
      return;
    }

    if (screenPhase === "game" && selectedGameId === "snake") {
      onMusicTrackChange?.("snake");
      return;
    }

    if (screenPhase === "game" && selectedGameId === "blackjack") {
      onMusicTrackChange?.("blackjack");
      return;
    }

    onMusicTrackChange?.(null);
  }, [onMusicTrackChange, poweredOn, screenPhase, selectedGameId]);

  const handleMenuPulse = useEffectEvent((pulse: GameboyControlPulse) => {
    const moveGameSelection = (direction: -1 | 1) => {
      const nextIndex = (selectedIndex + direction + gameRegistry.length) % gameRegistry.length;
      onSelectGame(gameRegistry[nextIndex]?.id ?? selectedGameId);
      onAudioCue?.("menuMove");
    };
    const launchSelectedGame = () => {
      onAudioCue?.("menuConfirm");
      window.requestAnimationFrame(() => {
        setLaunchPulseSeq(pulse.seq);
        setScreenPhase("game");
      });
    };

    if (menuScreen === "main") {
      if (pulse.button === "up") {
        setMainMenuIndex((current) => (current - 1 + MAIN_MENU_ITEMS.length) % MAIN_MENU_ITEMS.length);
        onAudioCue?.("menuMove");
        return;
      }

      if (pulse.button === "down") {
        setMainMenuIndex((current) => (current + 1) % MAIN_MENU_ITEMS.length);
        onAudioCue?.("menuMove");
        return;
      }

      if (pulse.button === "start" || pulse.button === "a") {
        onAudioCue?.("menuConfirm");

        if (mainMenuIndex === 0) {
          setMenuScreen("games");
          return;
        }

        if (mainMenuIndex === 1) {
          setMenuScreen("leaderboardGames");
          return;
        }

        if (mainMenuIndex === 2) {
          setMenuScreen("settings");
          return;
        }

        onPowerOff();
      }

      return;
    }

    if (menuScreen === "games") {
      if (pulse.button === "up" || pulse.button === "left") {
        moveGameSelection(-1);
        return;
      }

      if (pulse.button === "down" || pulse.button === "right") {
        moveGameSelection(1);
        return;
      }

      if (pulse.button === "select") {
        onAudioCue?.("menuMove");
        setMenuScreen("main");
        return;
      }

      if (pulse.button === "start" || pulse.button === "a") {
        launchSelectedGame();
      }

      return;
    }

    if (menuScreen === "leaderboardGames") {
      if (pulse.button === "up" || pulse.button === "left") {
        moveGameSelection(-1);
        return;
      }

      if (pulse.button === "down" || pulse.button === "right") {
        moveGameSelection(1);
        return;
      }

      if (pulse.button === "select") {
        onAudioCue?.("menuMove");
        setMenuScreen("main");
        return;
      }

      if (pulse.button === "start" || pulse.button === "a") {
        onAudioCue?.("menuConfirm");
        setLeaderboardEntryIndex(0);
        setMenuScreen("leaderboardEntries");
      }

      return;
    }

    if (menuScreen === "leaderboardEntries") {
      if (pulse.button === "up") {
        setLeaderboardEntryIndex((current) =>
          Math.max(0, current - 1),
        );
        onAudioCue?.("menuMove");
        return;
      }

      if (pulse.button === "down") {
        setLeaderboardEntryIndex((current) =>
          Math.min(Math.max((leaderboardEntries?.length ?? 1) - 1, 0), current + 1),
        );
        onAudioCue?.("menuMove");
        return;
      }

      if (pulse.button === "select") {
        onAudioCue?.("menuMove");
        setMenuScreen("leaderboardGames");
      }

      return;
    }

    if (menuScreen === "settings") {
      if (pulse.button === "up") {
        setSettingsIndex((current) => (current - 1 + SETTINGS_MENU_ITEMS.length) % SETTINGS_MENU_ITEMS.length);
        onAudioCue?.("menuMove");
        return;
      }

      if (pulse.button === "down") {
        setSettingsIndex((current) => (current + 1) % SETTINGS_MENU_ITEMS.length);
        onAudioCue?.("menuMove");
        return;
      }

      if (pulse.button === "left" || pulse.button === "right") {
        const delta = pulse.button === "left" ? -1 : 1;

        if (settingsIndex === 0) {
          onSoundLevelChange(Math.max(0, Math.min(10, soundLevel + delta)));
          onAudioCue?.("menuMove");
          return;
        }

        if (settingsIndex === 1) {
          onMusicLevelChange(Math.max(0, Math.min(10, musicLevel + delta)));
          onAudioCue?.("menuMove");
          return;
        }
      }

      if (pulse.button === "select") {
        onAudioCue?.("menuMove");
        setMenuScreen("main");
        return;
      }

      if ((pulse.button === "start" || pulse.button === "a") && settingsIndex === 2 && !logoutPending) {
        onAudioCue?.("menuConfirm");
        setLogoutPending(true);
        void Promise.resolve(onRequestLogout()).finally(() => {
          setLogoutPending(false);
        });
      }
    }
  });

  useEffect(() => {
    if (!poweredOn || screenPhase !== "menu" || !controlPulse || !controlPulse.pressed) {
      return;
    }

    if (lastControlSeqRef.current === controlPulse.seq) {
      return;
    }
    lastControlSeqRef.current = controlPulse.seq;

    handleMenuPulse(controlPulse);
  }, [
    controlPulse,
    poweredOn,
    screenPhase,
  ]);

  const menuGames = useMemo(
    () =>
      gameRegistry.map((game) => ({
        name: game.name,
      })),
    [],
  );
  const menuView = useMemo<GameboyMenuView>(() => {
    if (menuScreen === "main") {
      return {
        screen: "main",
        selectedIndex: mainMenuIndex,
        balance: menuBalance,
      };
    }

    if (menuScreen === "games") {
      return {
        screen: "games",
        selectedIndex,
        balance: menuBalance,
        games: menuGames,
      };
    }

    if (menuScreen === "leaderboardGames") {
      return {
        screen: "leaderboardGames",
        selectedIndex,
        games: menuGames,
      };
    }

    if (menuScreen === "leaderboardEntries") {
      return {
        screen: "leaderboardEntries",
        selectedIndex: leaderboardEntryIndex,
        gameName: selectedGame?.name ?? "Leaderboard",
        entries: leaderboardEntries ?? null,
      };
    }

    return {
      screen: "settings",
      selectedIndex: settingsIndex,
      username: sessionUser?.username ?? "Guest",
      soundLevel,
      musicLevel,
      pendingLogout: logoutPending,
    };
  }, [
    leaderboardEntries,
    leaderboardEntryIndex,
    logoutPending,
    mainMenuIndex,
    menuBalance,
    menuGames,
    menuScreen,
    musicLevel,
    selectedGame?.name,
    selectedIndex,
    sessionUser?.username,
    settingsIndex,
    soundLevel,
  ]);
  const viewerConfig =
    poweredOn && gameboyZoomed
      ? ZOOMED_VIEWER_CONFIG
      : undefined;
  return (
    <section
      style={{
        ...stageShellStyle,
        overflow: "visible",
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
          <GameboyMenuCanvas view={menuView} />
        ) : screenPhase === "game" && selectedGameId === "tetris" ? (
          <ArcadeGameboyTetris
            controlPulse={controlPulse}
            onExit={() => {
              setMenuScreen("games");
              setScreenPhase("menu");
            }}
            sessionUser={sessionUser}
            onAudioCue={onAudioCue}
            onMusicTrackChange={onMusicTrackChange}
            ignoredPulseSeq={launchPulseSeq}
          />
        ) : screenPhase === "game" && selectedGameId === "blackjack" ? (
          <ArcadeGameboyBlackjack
            controlPulse={controlPulse}
            pressedButtons={pressedButtons}
            onExit={() => {
              setMenuScreen("games");
              setScreenPhase("menu");
            }}
            sessionUser={sessionUser}
            ignoredPulseSeq={launchPulseSeq}
          />
        ) : screenPhase === "game" ? (
          <GameboySnake
            controlPulse={controlPulse}
            onExit={() => {
              setMenuScreen("games");
              setScreenPhase("menu");
            }}
            sessionUser={sessionUser}
            onAudioCue={onAudioCue}
          />
        ) : null}
      </div>
      <div
        style={{
          width: "100%",
          height: fullScreen ? "100dvh" : `${Math.round(height)}px`,
          overflow: "visible",
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
          onModelHoverChange={onModelHoverChange}
          onModelReadyChange={setModelReady}
          viewerConfig={viewerConfig}
        />
      </div>
    </section>
  );
}
