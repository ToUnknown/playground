"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  | "gameOver";

export type GameboyMusicTrack = "menu" | "tetris" | "snake";

type SoundConfig = {
  src: string;
  volume: number;
  playbackRate?: number;
};

type MusicConfig = {
  sources: string[];
  volume: number;
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
    volume: 0.32,
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
    src: "/audio/sfx/line-clear.mp3",
    volume: 0.36,
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
  tetris: {
    // Accept a few common filenames for the user-supplied Tetris track.
    sources: [
      "/audio/music/tetris-theme.ogg",
      "/audio/music/tetris-theme.mp3",
      "/audio/music/tetris-theme.wav",
      "/audio/music/tetris-original.mp3",
      "/audio/music/tetris-original.ogg",
      "/audio/music/tetris-original.wav",
    ],
    volume: 0.5,
  },
};

function createAudioElement(src: string) {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
}

export function useGameboyAudio({
  soundEnabled,
  musicEnabled,
  poweredOn,
  musicTrack,
}: {
  soundEnabled: boolean;
  musicEnabled: boolean;
  poweredOn: boolean;
  musicTrack: GameboyMusicTrack | null;
}) {
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const soundBufferRef = useRef<Map<string, AudioBuffer>>(new Map());
  const soundLoadPromiseRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());
  const activeMusicRef = useRef<HTMLAudioElement | null>(null);
  const musicSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const resolvedMusicRef = useRef<Map<GameboyMusicTrack, string>>(new Map());

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
      sfxGain.gain.value = soundEnabled ? 1 : 0;
      musicGain.gain.value = musicEnabled ? 1 : 0;
      sfxGain.connect(context.destination);
      musicGain.connect(context.destination);

      audioContextRef.current = context;
      sfxGainRef.current = sfxGain;
      musicGainRef.current = musicGain;
    }

    return audioContextRef.current;
  }, [musicEnabled, soundEnabled]);

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

  const stopMusic = useCallback(() => {
    const activeMusic = activeMusicRef.current;
    if (!activeMusic) {
      return;
    }

    activeMusic.pause();
    activeMusic.currentTime = 0;
    activeMusicRef.current = null;
  }, []);

  const resolveMusicSource = useCallback(async (track: GameboyMusicTrack) => {
    const cachedSource = resolvedMusicRef.current.get(track);
    if (cachedSource) {
      return cachedSource;
    }

    for (const candidate of MUSIC_LIBRARY[track].sources) {
      try {
        const response = await fetch(candidate, {
          method: "HEAD",
          cache: "no-store",
        });

        if (response.ok) {
          resolvedMusicRef.current.set(track, candidate);
          return candidate;
        }
      } catch {
        // Ignore fetch failures and fall through to the next candidate.
      }
    }

    return null;
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

      if (context.state === "suspended") {
        void context.resume().catch(() => undefined);
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
        startPlayback(cachedBuffer);
        return;
      }

      void loadSoundBuffer(config.src)
        .then((buffer) => {
          startPlayback(buffer);
        })
        .catch(() => undefined);
    },
    [ensureAudioContext, loadSoundBuffer, soundEnabled],
  );

  useEffect(() => {
    const context = ensureAudioContext();
    if (!context || !sfxGainRef.current) {
      return;
    }

    sfxGainRef.current.gain.value = soundEnabled ? 1 : 0;
  }, [ensureAudioContext, soundEnabled]);

  useEffect(() => {
    if (!musicGainRef.current) {
      return;
    }

    if (!musicEnabled || !musicTrack) {
      musicGainRef.current.gain.value = 0;
      return;
    }

    musicGainRef.current.gain.value = MUSIC_LIBRARY[musicTrack].volume;
  }, [musicEnabled, musicTrack]);

  useEffect(() => {
    const context = ensureAudioContext();
    if (!context) {
      return;
    }

    for (const { src } of Object.values(SOUND_LIBRARY)) {
      void loadSoundBuffer(src).catch(() => undefined);
    }
  }, [ensureAudioContext, loadSoundBuffer]);

  useEffect(() => {
    if (!audioUnlocked || !poweredOn || !musicEnabled || !musicTrack || typeof window === "undefined") {
      stopMusic();
      return;
    }

    let cancelled = false;

    const startMusic = async () => {
      const src = await resolveMusicSource(musicTrack);
      if (cancelled) {
        return;
      }

      if (!src) {
        stopMusic();
        return;
      }

      const context = ensureAudioContext();
      const musicGain = musicGainRef.current;
      const absoluteSrc = new URL(src, window.location.origin).href;
      let music = activeMusicRef.current;

      if (!music || music.src !== absoluteSrc) {
        if (music) {
          music.pause();
          music.currentTime = 0;
        }

        music = createAudioElement(src);
        music.loop = true;
        activeMusicRef.current = music;

        if (musicSourceRef.current) {
          musicSourceRef.current.disconnect();
          musicSourceRef.current = null;
        }

        if (context && musicGain) {
          const source = context.createMediaElementSource(music);
          source.connect(musicGain);
          musicSourceRef.current = source;
        }
      }

      if (musicGain) {
        musicGain.gain.value = musicEnabled ? MUSIC_LIBRARY[musicTrack].volume : 0;
      }
      music.volume = context && musicGain ? 1 : Math.min(1, MUSIC_LIBRARY[musicTrack].volume);
      void music.play().catch(() => undefined);
    };

    void startMusic();

    return () => {
      cancelled = true;
    };
  }, [audioUnlocked, ensureAudioContext, musicEnabled, musicTrack, poweredOn, resolveMusicSource, stopMusic]);

  useEffect(() => {
    return () => {
      stopMusic();
      if (musicSourceRef.current) {
        musicSourceRef.current.disconnect();
        musicSourceRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, [stopMusic]);

  return {
    playCue,
    unlockAudio,
  };
}
