"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const GAMEBOY_MUSIC_ENERGY_EVENT = "gameboy-music-energy";

export type GameboyMusicEnergyDetail = {
  energy: number;
  low: number;
  mid: number;
  high: number;
  noise: number;
  pulse: number;
  lowPulse: number;
  midPulse: number;
  highPulse: number;
  noisePulse: number;
};

export type GameboyAudioCue =
  | "powerOn"
  | "powerOff"
  | "buttonPress"
  | "dpadPress"
  | "menuMove"
  | "menuConfirm"
  | "pause"
  | "resume"
  | "snakeEat"
  | "tetrisLock"
  | "tetrisLineClear"
  | "tetrisGameOver"
  | "gameOver";

export type GameboyMusicTrack = "menu" | "snake" | "blackjack" | "tetris" | "tetrisTitle";

type SoundConfig = {
  src: string;
  volume: number;
  playbackRate?: number;
};

type MusicConfig = {
  sources: string[];
  volume: number;
  playback?: "loop" | "playlist";
};

const SOUND_LIBRARY: Record<GameboyAudioCue, SoundConfig> = {
  powerOn: {
    src: "/audio/sfx/power-up.mp3",
    volume: 0.4,
    playbackRate: 1,
  },
  powerOff: {
    src: "/audio/sfx/beep-b.mp3",
    volume: 0.32,
    playbackRate: 0.74,
  },
  buttonPress: {
    src: "/audio/sfx/button-press.wav",
    volume: 0.3,
    playbackRate: 1,
  },
  dpadPress: {
    src: "/audio/sfx/button-press.wav",
    volume: 0.2,
    playbackRate: 1.08,
  },
  menuMove: {
    src: "/audio/sfx/beep-a.mp3",
    volume: 0.18,
    playbackRate: 1.1,
  },
  menuConfirm: {
    src: "/audio/sfx/beep-a.mp3",
    volume: 0.18,
    playbackRate: 1.06,
  },
  pause: {
    src: "/audio/sfx/beep-b.mp3",
    volume: 0.26,
    playbackRate: 0.9,
  },
  resume: {
    src: "/audio/sfx/beep-a.mp3",
    volume: 0.28,
    playbackRate: 1,
  },
  snakeEat: {
    src: "/audio/sfx/coin.mp3",
    volume: 0.34,
    playbackRate: 1.02,
  },
  tetrisLock: {
    src: "/audio/sfx/beep-b.mp3",
    volume: 0.24,
    playbackRate: 0.84,
  },
  tetrisLineClear: {
    src: "/audio/tetris/08. Stage Clear.m4a",
    volume: 0.52,
    playbackRate: 1,
  },
  tetrisGameOver: {
    src: "/audio/tetris/18. Game Over.m4a",
    volume: 0.48,
    playbackRate: 1,
  },
  gameOver: {
    src: "/audio/sfx/game-over.mp3",
    volume: 0.4,
    playbackRate: 1,
  },
};

const MUSIC_LIBRARY: Record<GameboyMusicTrack, MusicConfig> = {
  menu: {
    sources: ["/audio/music/arcade-menu.mp3"],
    volume: 1.5,
  },
  snake: {
    sources: [
      "/audio/music/snake-round.ogg",
      "/audio/music/snake-round.mp3",
      "/audio/music/snake-round.wav",
    ],
    volume: 0.3,
  },
  blackjack: {
    sources: ["/audio/music/blackjack-music.m4a"],
    volume: 0.34,
  },
  tetrisTitle: {
    sources: ["/audio/tetris/01. Title.m4a"],
    volume: 0.38,
  },
  tetris: {
    sources: [
      "/audio/tetris/02. A-Type Music (v1.0).m4a",
      "/audio/tetris/03. A-Type Music (Korobeiniki).m4a",
      "/audio/tetris/04. B-Type Music.m4a",
      "/audio/tetris/05. C-Type Music.m4a",
    ],
    volume: 0.42,
    playback: "playlist",
  },
};
const MUSIC_POWER_OFF_FADE_MS = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pickRandomPlaylistIndex(length: number, previousIndex: number | null) {
  if (length <= 1) {
    return 0;
  }

  const randomIndex = Math.floor(Math.random() * (length - 1));
  if (previousIndex === null || previousIndex < 0 || previousIndex >= length) {
    return randomIndex;
  }

  return randomIndex >= previousIndex ? randomIndex + 1 : randomIndex;
}

export function useGameboyAudio({
  soundEnabled,
  musicEnabled,
  soundVolume,
  musicVolume,
  poweredOn,
  musicTrack,
}: {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number;
  musicVolume: number;
  poweredOn: boolean;
  musicTrack: GameboyMusicTrack | null;
}) {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const soundBufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const soundLoadPromiseRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());
  const musicBufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const musicLoadPromiseRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());
  const activeMusicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeMusicTrackRef = useRef<GameboyMusicTrack | null>(null);
  const resolvedMusicRef = useRef<Map<GameboyMusicTrack, string[]>>(new Map());
  const playlistLastIndexRef = useRef<Map<GameboyMusicTrack, number>>(new Map());
  const musicFadeTimeoutRef = useRef<number | null>(null);
  const musicAnalyserRef = useRef<AnalyserNode | null>(null);
  const musicMeterFrameRef = useRef<number>(0);
  const musicEnergyRef = useRef(0);
  const musicLowRef = useRef(0);
  const musicMidRef = useRef(0);
  const musicHighRef = useRef(0);
  const musicNoiseRef = useRef(0);
  const musicPulseRef = useRef(0);
  const musicLowPulseRef = useRef(0);
  const musicMidPulseRef = useRef(0);
  const musicHighPulseRef = useRef(0);
  const musicNoisePulseRef = useRef(0);

  const emitMusicEnergy = useCallback((detail: GameboyMusicEnergyDetail) => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(
      new CustomEvent(GAMEBOY_MUSIC_ENERGY_EVENT, {
        detail,
      }),
    );
  }, []);

  const resetMusicEnergy = useCallback(() => {
    musicEnergyRef.current = 0;
    musicLowRef.current = 0;
    musicMidRef.current = 0;
    musicHighRef.current = 0;
    musicNoiseRef.current = 0;
    musicPulseRef.current = 0;
    musicLowPulseRef.current = 0;
    musicMidPulseRef.current = 0;
    musicHighPulseRef.current = 0;
    musicNoisePulseRef.current = 0;
    emitMusicEnergy({
      energy: 0,
      low: 0,
      mid: 0,
      high: 0,
      noise: 0,
      pulse: 0,
      lowPulse: 0,
      midPulse: 0,
      highPulse: 0,
      noisePulse: 0,
    });
  }, [emitMusicEnergy]);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioContextRef.current) {
      const AudioContextCtor = window.AudioContext;
      if (!AudioContextCtor) {
        return null;
      }

      const context = new AudioContextCtor({
        latencyHint: "interactive",
      });
      const sfxGain = context.createGain();
      const musicGain = context.createGain();
      const musicAnalyser = context.createAnalyser();
      sfxGain.gain.value = soundEnabled ? clamp(soundVolume, 0, 1) : 0;
      musicGain.gain.value = musicEnabled ? clamp(musicVolume, 0, 1) : 0;
      sfxGain.connect(context.destination);
      musicGain.connect(context.destination);
      musicAnalyser.fftSize = 128;
      musicAnalyser.smoothingTimeConstant = 0.78;
      musicAnalyser.connect(musicGain);

      audioContextRef.current = context;
      sfxGainRef.current = sfxGain;
      musicGainRef.current = musicGain;
      musicAnalyserRef.current = musicAnalyser;
    }

    return audioContextRef.current;
  }, [musicEnabled, musicVolume, soundEnabled, soundVolume]);

  const loadSoundBuffer = useCallback(
    async (src: string) => {
      const cachedBuffer = soundBufferRef.current.get(src);
      if (cachedBuffer) {
        return cachedBuffer;
      }

      const existingPromise = soundLoadPromiseRef.current.get(src);
      if (existingPromise) {
        return existingPromise;
      }

      const context = ensureAudioContext();
      if (!context) {
        throw new Error("AudioContext is unavailable");
      }

      const loadPromise = fetch(src, {
        cache: "force-cache",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load sound: ${src}`);
          }

          return response.arrayBuffer();
        })
        .then((buffer) => context.decodeAudioData(buffer.slice(0)))
        .then((decodedBuffer) => {
          soundBufferRef.current.set(src, decodedBuffer);
          soundLoadPromiseRef.current.delete(src);
          return decodedBuffer;
        })
        .catch((error) => {
          soundLoadPromiseRef.current.delete(src);
          throw error;
        });

      soundLoadPromiseRef.current.set(src, loadPromise);
      return loadPromise;
    },
    [ensureAudioContext],
  );

  const unlockAudio = useCallback(() => {
    setAudioUnlocked(true);

    const context = ensureAudioContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
    }
  }, [ensureAudioContext]);

  const clearMusicFadeTimeout = useCallback(() => {
    if (musicFadeTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(musicFadeTimeoutRef.current);
      musicFadeTimeoutRef.current = null;
    }
  }, []);

  const stopMusic = useCallback(() => {
    clearMusicFadeTimeout();
    const activeMusicSource = activeMusicSourceRef.current;
    if (!activeMusicSource) {
      return;
    }

    activeMusicSource.onended = null;
    try {
      activeMusicSource.stop();
    } catch {
      // Ignore stop failures for sources that have already ended.
    }
    activeMusicSource.disconnect();
    activeMusicSourceRef.current = null;
    activeMusicTrackRef.current = null;
  }, [clearMusicFadeTimeout]);

  const fadeOutMusic = useCallback((durationMs: number) => {
    if (musicFadeTimeoutRef.current !== null) {
      return;
    }

    const context = audioContextRef.current;
    const musicGain = musicGainRef.current;
    const activeMusicSource = activeMusicSourceRef.current;
    if (!context || !musicGain || !activeMusicSource) {
      stopMusic();
      return;
    }

    const now = context.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(0.0001, now + durationMs / 1000);

    musicFadeTimeoutRef.current = window.setTimeout(() => {
      if (activeMusicSourceRef.current === activeMusicSource) {
        activeMusicSource.onended = null;
        try {
          activeMusicSource.stop();
        } catch {
          // Ignore stop failures for sources that have already ended.
        }
        activeMusicSource.disconnect();
        activeMusicSourceRef.current = null;
        activeMusicTrackRef.current = null;
      }

      musicFadeTimeoutRef.current = null;
      const currentContext = audioContextRef.current;
      const currentMusicGain = musicGainRef.current;
      if (currentContext && currentMusicGain) {
        currentMusicGain.gain.cancelScheduledValues(currentContext.currentTime);
        currentMusicGain.gain.setValueAtTime(0, currentContext.currentTime);
      }
    }, durationMs);
  }, [stopMusic]);

  const loadMusicBuffer = useCallback(
    async (src: string) => {
      const cachedBuffer = musicBufferRef.current.get(src);
      if (cachedBuffer) {
        return cachedBuffer;
      }

      const existingPromise = musicLoadPromiseRef.current.get(src);
      if (existingPromise) {
        return existingPromise;
      }

      const context = ensureAudioContext();
      if (!context) {
        throw new Error("AudioContext is unavailable");
      }

      const loadPromise = fetch(src, {
        cache: "force-cache",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to load music: ${src}`);
          }

          return response.arrayBuffer();
        })
        .then((buffer) => context.decodeAudioData(buffer.slice(0)))
        .then((decodedBuffer) => {
          musicBufferRef.current.set(src, decodedBuffer);
          musicLoadPromiseRef.current.delete(src);
          return decodedBuffer;
        })
        .catch((error) => {
          musicLoadPromiseRef.current.delete(src);
          throw error;
        });

      musicLoadPromiseRef.current.set(src, loadPromise);
      return loadPromise;
    },
    [ensureAudioContext],
  );

  const resolveMusicSources = useCallback(async (track: GameboyMusicTrack) => {
    const cachedSources = resolvedMusicRef.current.get(track);
    if (cachedSources) {
      return cachedSources;
    }

    const availableSources: string[] = [];
    for (const candidate of MUSIC_LIBRARY[track].sources) {
      try {
        const response = await fetch(candidate, {
          method: "HEAD",
          cache: "no-store",
        });

        if (response.ok) {
          availableSources.push(candidate);
        }
      } catch {
        // Ignore fetch failures and fall through to the next candidate.
      }
    }

    resolvedMusicRef.current.set(track, availableSources);
    return availableSources;
  }, []);

  const playCue = useCallback(
    (cue: GameboyAudioCue) => {
      setAudioUnlocked(true);

      if (!soundEnabled || typeof window === "undefined") {
        return;
      }

      const config = SOUND_LIBRARY[cue];
      const context = ensureAudioContext();
      const sfxGain = sfxGainRef.current;
      if (!context || !sfxGain) {
        return;
      }

      const startPlayback = (buffer: AudioBuffer) => {
        const source = context.createBufferSource();
        const gainNode = context.createGain();

        source.buffer = buffer;
        source.playbackRate.value = config.playbackRate ?? 1;
        gainNode.gain.value = config.volume;

        source.connect(gainNode);
        gainNode.connect(sfxGain);
        source.start();
      };

      const cachedBuffer = soundBufferRef.current.get(config.src);
      if (cachedBuffer) {
        if (context.state === "suspended") {
          void context.resume()
            .then(() => {
              startPlayback(cachedBuffer);
            })
            .catch(() => undefined);
          return;
        }

        startPlayback(cachedBuffer);
        return;
      }

      void loadSoundBuffer(config.src)
        .then((buffer) => {
          if (context.state === "suspended") {
            return context.resume().then(() => {
              startPlayback(buffer);
            });
          }

          startPlayback(buffer);
        })
        .catch(() => undefined);
    },
    [ensureAudioContext, loadSoundBuffer, soundEnabled],
  );

  useEffect(() => {
    if (!audioUnlocked) {
      return;
    }

    const context = ensureAudioContext();
    if (!context || !sfxGainRef.current) {
      return;
    }

    sfxGainRef.current.gain.value = soundEnabled ? clamp(soundVolume, 0, 1) : 0;
  }, [audioUnlocked, ensureAudioContext, soundEnabled, soundVolume]);

  useEffect(() => {
    if (!audioUnlocked) {
      return;
    }

    const context = audioContextRef.current;
    const musicGain = musicGainRef.current;
    if (!context || !musicGain) {
      return;
    }

    clearMusicFadeTimeout();
    musicGain.gain.cancelScheduledValues(context.currentTime);

    if (!poweredOn) {
      return;
    }

    if (!musicEnabled || !musicTrack) {
      musicGain.gain.value = 0;
      return;
    }

    musicGain.gain.value = MUSIC_LIBRARY[musicTrack].volume * clamp(musicVolume, 0, 1);
  }, [audioUnlocked, clearMusicFadeTimeout, musicEnabled, musicTrack, musicVolume, poweredOn]);

  useEffect(() => {
    if (!audioUnlocked) {
      return;
    }

    const context = ensureAudioContext();
    if (!context) {
      return;
    }

    for (const { src } of Object.values(SOUND_LIBRARY)) {
      void loadSoundBuffer(src).catch(() => undefined);
    }
  }, [audioUnlocked, ensureAudioContext, loadSoundBuffer]);

  useEffect(() => {
    if (!audioUnlocked || typeof window === "undefined") {
      stopMusic();
      return;
    }

    if (!poweredOn) {
      fadeOutMusic(MUSIC_POWER_OFF_FADE_MS);
      return;
    }

    if (!musicEnabled || !musicTrack) {
      stopMusic();
      return;
    }

    let cancelled = false;

    const startMusic = async () => {
      const resolvedSources = await resolveMusicSources(musicTrack);
      if (cancelled) {
        return;
      }

      if (resolvedSources.length === 0) {
        stopMusic();
        return;
      }

      const context = ensureAudioContext();
      const musicGain = musicGainRef.current;
      if (!context || !musicGain) {
        return;
      }

      clearMusicFadeTimeout();
      musicGain.gain.cancelScheduledValues(context.currentTime);

      if (context.state === "suspended") {
        try {
          await context.resume();
        } catch {
          return;
        }
      }

      if (activeMusicTrackRef.current === musicTrack && activeMusicSourceRef.current) {
        musicGain.gain.value = musicEnabled
          ? MUSIC_LIBRARY[musicTrack].volume * clamp(musicVolume, 0, 1)
          : 0;
        return;
      }

      stopMusic();
      const playback = MUSIC_LIBRARY[musicTrack].playback ?? "loop";
      const startIndex =
        playback === "playlist"
          ? pickRandomPlaylistIndex(
              resolvedSources.length,
              playlistLastIndexRef.current.get(musicTrack) ?? null,
            )
          : 0;

      const playResolvedSource = async (index: number) => {
        const src = resolvedSources[index % resolvedSources.length];
        if (!src) {
          return;
        }

        const buffer = await loadMusicBuffer(src);
        if (cancelled || activeMusicTrackRef.current !== musicTrack) {
          return;
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = playback !== "playlist";
        if (musicAnalyserRef.current) {
          source.connect(musicAnalyserRef.current);
        } else {
          source.connect(musicGain);
        }

        source.onended = () => {
          if (activeMusicSourceRef.current === source) {
            source.disconnect();
            activeMusicSourceRef.current = null;
          }

          if (cancelled || activeMusicTrackRef.current !== musicTrack || playback !== "playlist") {
            return;
          }

          void playResolvedSource(
            pickRandomPlaylistIndex(
              resolvedSources.length,
              index,
            ),
          );
        };

        activeMusicSourceRef.current = source;
        activeMusicTrackRef.current = musicTrack;
        if (playback === "playlist") {
          playlistLastIndexRef.current.set(musicTrack, index);
        }
        source.start();
      };

      activeMusicTrackRef.current = musicTrack;
      await playResolvedSource(startIndex);

      if (musicGain) {
        musicGain.gain.value = musicEnabled
          ? MUSIC_LIBRARY[musicTrack].volume * clamp(musicVolume, 0, 1)
          : 0;
      }
    };

    void startMusic();

    return () => {
      cancelled = true;
    };
  }, [audioUnlocked, clearMusicFadeTimeout, ensureAudioContext, fadeOutMusic, loadMusicBuffer, musicEnabled, musicTrack, musicVolume, poweredOn, resolveMusicSources, stopMusic]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.cancelAnimationFrame(musicMeterFrameRef.current);

    if (!audioUnlocked || !poweredOn || !musicEnabled || !musicTrack) {
      resetMusicEnergy();
      return;
    }

    const analyser = musicAnalyserRef.current;
    if (!analyser) {
      resetMusicEnergy();
      return;
    }

    const analyserData = new Uint8Array(analyser.frequencyBinCount);

    const updateMeter = () => {
      const activeMusicSource = activeMusicSourceRef.current;
      if (!activeMusicSource) {
        musicEnergyRef.current = Math.max(musicEnergyRef.current * 0.9, 0);
        musicLowRef.current *= 0.9;
        musicMidRef.current *= 0.9;
        musicHighRef.current *= 0.9;
        musicNoiseRef.current *= 0.9;
        musicPulseRef.current *= 0.84;
        musicLowPulseRef.current *= 0.72;
        musicMidPulseRef.current *= 0.72;
        musicHighPulseRef.current *= 0.72;
        musicNoisePulseRef.current *= 0.72;
        emitMusicEnergy({
          energy: musicEnergyRef.current,
          low: musicLowRef.current,
          mid: musicMidRef.current,
          high: musicHighRef.current,
          noise: musicNoiseRef.current,
          pulse: musicPulseRef.current,
          lowPulse: musicLowPulseRef.current,
          midPulse: musicMidPulseRef.current,
          highPulse: musicHighPulseRef.current,
          noisePulse: musicNoisePulseRef.current,
        });
        musicMeterFrameRef.current = window.requestAnimationFrame(updateMeter);
        return;
      }

      analyser.getByteFrequencyData(analyserData);

      let lowSum = 0;
      let lowCount = 0;
      let midSum = 0;
      let midCount = 0;
      let highSum = 0;
      let highCount = 0;
      let noiseSum = 0;
      let noiseCount = 0;

      for (let index = 0; index < analyserData.length; index += 1) {
        const normalized = analyserData[index] / 255;
        if (index < 5) {
          lowSum += normalized;
          lowCount += 1;
        } else if (index < 14) {
          midSum += normalized;
          midCount += 1;
        } else if (index < 28) {
          highSum += normalized;
          highCount += 1;
        } else {
          noiseSum += normalized;
          noiseCount += 1;
        }
      }

      const low = lowCount > 0 ? lowSum / lowCount : 0;
      const mid = midCount > 0 ? midSum / midCount : 0;
      const high = highCount > 0 ? highSum / highCount : 0;
      const noise = noiseCount > 0 ? noiseSum / noiseCount : 0;
      const lowTransient = Math.max(0, low - musicLowRef.current * 0.9);
      const midTransient = Math.max(0, mid - musicMidRef.current * 0.93);
      const highTransient = Math.max(0, high - musicHighRef.current * 0.95);
      const noiseTransient = Math.max(0, noise - musicNoiseRef.current * 0.97);
      const nextEnergy = low * 0.32 + mid * 0.28 + high * 0.24 + noise * 0.16;
      const transient = Math.max(lowTransient, midTransient, highTransient, noiseTransient);

      musicEnergyRef.current = musicEnergyRef.current * 0.62 + nextEnergy * 0.38;
      musicLowRef.current = musicLowRef.current * 0.55 + low * 0.45;
      musicMidRef.current = musicMidRef.current * 0.58 + mid * 0.42;
      musicHighRef.current = musicHighRef.current * 0.62 + high * 0.38;
      musicNoiseRef.current = musicNoiseRef.current * 0.68 + noise * 0.32;
      musicLowPulseRef.current = Math.max(musicLowPulseRef.current * 0.66, clamp(lowTransient * 2.1, 0, 1));
      musicMidPulseRef.current = Math.max(musicMidPulseRef.current * 0.66, clamp(midTransient * 2.05, 0, 1));
      musicHighPulseRef.current = Math.max(musicHighPulseRef.current * 0.68, clamp(highTransient * 2.1, 0, 1));
      musicNoisePulseRef.current = Math.max(musicNoisePulseRef.current * 0.72, clamp(noiseTransient * 2.3, 0, 1));
      musicPulseRef.current = Math.max(musicPulseRef.current * 0.72, clamp(transient * 1.85, 0, 1));
      emitMusicEnergy({
        energy: musicEnergyRef.current,
        low: musicLowRef.current,
        mid: musicMidRef.current,
        high: musicHighRef.current,
        noise: musicNoiseRef.current,
        pulse: musicPulseRef.current,
        lowPulse: musicLowPulseRef.current,
        midPulse: musicMidPulseRef.current,
        highPulse: musicHighPulseRef.current,
        noisePulse: musicNoisePulseRef.current,
      });
      musicMeterFrameRef.current = window.requestAnimationFrame(updateMeter);
    };

    musicMeterFrameRef.current = window.requestAnimationFrame(updateMeter);

    return () => {
      window.cancelAnimationFrame(musicMeterFrameRef.current);
      resetMusicEnergy();
    };
  }, [audioUnlocked, emitMusicEnergy, musicEnabled, musicTrack, poweredOn, resetMusicEnergy]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.cancelAnimationFrame(musicMeterFrameRef.current);
      }
      clearMusicFadeTimeout();
      resetMusicEnergy();
      stopMusic();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, [clearMusicFadeTimeout, resetMusicEnergy, stopMusic]);

  return {
    playCue,
    unlockAudio,
  };
}
