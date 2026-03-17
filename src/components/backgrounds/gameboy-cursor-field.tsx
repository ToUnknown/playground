"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { GAMEBOY_MUSIC_ENERGY_EVENT, type GameboyMusicEnergyDetail } from "@/lib/gameboy-audio";

type GameboyCursorFieldVariant = "login" | "arcade";

type TrailPoint = {
  x: number;
  y: number;
  life: number;
  strength: number;
};

type PointerState = {
  active: boolean;
  x: number;
  y: number;
  renderX: number;
  renderY: number;
  lastSpawn: number;
  lastTrailX: number;
  lastTrailY: number;
};

type MotifCell = {
  tone: number;
};

type FieldLayout = {
  width: number;
  height: number;
  dpr: number;
  cellSize: number;
  cols: number;
  rows: number;
  motifCells: Map<number, MotifCell>;
};

type MusicReactivity = {
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

type MusicFieldState = {
  low: Float32Array;
  mid: Float32Array;
  high: Float32Array;
  noise: Float32Array;
};

const MOTIF_PATTERNS: number[][][] = [
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1],
    [1, 2],
  ],
];
const SCREEN_BG = "#141b0f";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function mulberry32(seed: number) {
  return () => {
    let next = (seed += 0x6d2b79f5);
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMotifCells(cols: number, rows: number) {
  const motifCells = new Map<number, MotifCell>();
  const random = mulberry32(cols * 7919 + rows * 104729);

  for (let y = 3; y < rows - 4; y += 4) {
    for (let x = 3; x < cols - 4; x += 4) {
      if (random() > 0.14) {
        continue;
      }

      const pattern = MOTIF_PATTERNS[Math.floor(random() * MOTIF_PATTERNS.length)] ?? MOTIF_PATTERNS[0];
      const tone = 0.08 + random() * 0.18;

      for (const [dx, dy] of pattern) {
        const cellX = x + dx;
        const cellY = y + dy;

        if (cellX < 0 || cellY < 0 || cellX >= cols || cellY >= rows) {
          continue;
        }

        motifCells.set(cellY * cols + cellX, { tone });
      }
    }
  }

  return motifCells;
}

function getCellSize(width: number, variant: GameboyCursorFieldVariant) {
  if (variant === "login") {
    if (width < 640) {
      return 14;
    }
    if (width < 1100) {
      return 16;
    }
    return 18;
  }

  if (width < 640) {
    return 16;
  }
  if (width < 1100) {
    return 18;
  }
  return 20;
}

function getFieldColors(intensity: number, motifTone: number) {
  const boosted = clamp(intensity * 1.24 + motifTone * 0.08, 0, 1);

  if (boosted > 0.72) {
    return `rgba(210, 223, 147, ${0.28 + boosted * 0.58})`;
  }

  if (boosted > 0.42) {
    return `rgba(139, 172, 15, ${0.24 + boosted * 0.5})`;
  }

  if (boosted > 0.18) {
    return `rgba(86, 116, 50, ${0.18 + boosted * 0.36})`;
  }

  return `rgba(47, 71, 34, ${0.12 + boosted * 0.24})`;
}

function clampIndex(value: number, max: number) {
  return Math.min(Math.max(value, 0), Math.max(max - 1, 0));
}

export function GameboyCursorField({
  variant = "arcade",
  mouseReactive = true,
}: {
  variant?: GameboyCursorFieldVariant;
  mouseReactive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>(0);
  const layoutRef = useRef<FieldLayout>({
    width: 0,
    height: 0,
    dpr: 1,
    cellSize: 24,
    cols: 0,
    rows: 0,
    motifCells: new Map(),
  });
  const trailRef = useRef<TrailPoint[]>([]);
  const pointerRef = useRef<PointerState>({
    active: false,
    x: 0,
    y: 0,
    renderX: 0,
    renderY: 0,
    lastSpawn: 0,
    lastTrailX: 0,
    lastTrailY: 0,
  });
  const lastFrameTimeRef = useRef(0);
  const pointerVisualStrengthRef = useRef(0);
  const musicFieldRef = useRef<MusicFieldState>({
    low: new Float32Array(0),
    mid: new Float32Array(0),
    high: new Float32Array(0),
    noise: new Float32Array(0),
  });
  const musicEnergyRef = useRef<MusicReactivity>({
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
  const musicVisualEnergyRef = useRef<MusicReactivity>({
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
  const musicEmitCarryRef = useRef({
    low: 0,
    mid: 0,
    high: 0,
    noise: 0,
  });

  const createMusicField = useEffectEvent((cols: number, rows: number) => {
    const size = cols * rows;
    musicFieldRef.current = {
      low: new Float32Array(size),
      mid: new Float32Array(size),
      high: new Float32Array(size),
      noise: new Float32Array(size),
    };
    musicEmitCarryRef.current = {
      low: 0,
      mid: 0,
      high: 0,
      noise: 0,
    };
  });

  const stampMusicCharge = useEffectEvent(
    (field: Float32Array, centerCol: number, centerRow: number, radius: number, strength: number) => {
      const { cols, rows } = layoutRef.current;
      const clampedCol = clampIndex(centerCol, cols);
      const clampedRow = clampIndex(centerRow, rows);

      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const distance = Math.abs(offsetX) + Math.abs(offsetY);
          if (distance > radius) {
            continue;
          }

          const col = clampIndex(clampedCol + offsetX, cols);
          const row = clampIndex(clampedRow + offsetY, rows);
          const index = row * cols + col;
          const amount = strength * (1 - distance / (radius + 1));
          field[index] = Math.min(field[index] + amount, 1.35);
        }
      }
    },
  );

  const resizeCanvas = useEffectEvent(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    const cellSize = getCellSize(width, variant);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    layoutRef.current = {
      width,
      height,
      dpr,
      cellSize,
      cols: Math.ceil(width / cellSize),
      rows: Math.ceil(height / cellSize),
      motifCells: buildMotifCells(Math.ceil(width / cellSize), Math.ceil(height / cellSize)),
    };
    createMusicField(Math.ceil(width / cellSize), Math.ceil(height / cellSize));
  });

  const pushTrailPoint = useEffectEvent((x: number, y: number, strength: number) => {
    trailRef.current.unshift({
      x,
      y,
      life: 1,
      strength,
    });
    trailRef.current = trailRef.current.slice(0, 18);
  });

  const handlePointerMove = useEffectEvent((event: PointerEvent) => {
    if (!mouseReactive) {
      return;
    }

    const pointer = pointerRef.current;
    const wasActive = pointer.active;

    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (!wasActive) {
      pointer.renderX = event.clientX;
      pointer.renderY = event.clientY;
      pointer.lastTrailX = event.clientX;
      pointer.lastTrailY = event.clientY;
    }
  });

  const handlePointerDown = useEffectEvent((event: PointerEvent) => {
    if (!mouseReactive) {
      return;
    }

    const pointer = pointerRef.current;
    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.renderX = event.clientX;
    pointer.renderY = event.clientY;
    pointer.lastSpawn = performance.now();
    pointer.lastTrailX = event.clientX;
    pointer.lastTrailY = event.clientY;
    pushTrailPoint(event.clientX, event.clientY, 1.65);
  });

  const animate = useEffectEvent((time: number) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      frameRef.current = window.requestAnimationFrame(animate);
      return;
    }

    const { width, height, dpr, cellSize, cols, rows, motifCells } = layoutRef.current;
    const lastFrameTime = lastFrameTimeRef.current || time;
    const deltaMs = Math.min(time - lastFrameTime, 40);
    lastFrameTimeRef.current = time;
    const smoothing = 1 - Math.exp(-deltaMs * 0.012);
    musicVisualEnergyRef.current.energy = mix(musicVisualEnergyRef.current.energy, musicEnergyRef.current.energy, smoothing);
    musicVisualEnergyRef.current.low = mix(musicVisualEnergyRef.current.low, musicEnergyRef.current.low, smoothing);
    musicVisualEnergyRef.current.mid = mix(musicVisualEnergyRef.current.mid, musicEnergyRef.current.mid, smoothing);
    musicVisualEnergyRef.current.high = mix(musicVisualEnergyRef.current.high, musicEnergyRef.current.high, smoothing);
    musicVisualEnergyRef.current.noise = mix(musicVisualEnergyRef.current.noise, musicEnergyRef.current.noise, smoothing);
    musicVisualEnergyRef.current.pulse = Math.max(
      musicVisualEnergyRef.current.pulse * Math.exp(-deltaMs * 0.012),
      musicEnergyRef.current.pulse,
    );
    musicVisualEnergyRef.current.lowPulse = Math.max(
      musicVisualEnergyRef.current.lowPulse * Math.exp(-deltaMs * 0.014),
      musicEnergyRef.current.lowPulse,
    );
    musicVisualEnergyRef.current.midPulse = Math.max(
      musicVisualEnergyRef.current.midPulse * Math.exp(-deltaMs * 0.014),
      musicEnergyRef.current.midPulse,
    );
    musicVisualEnergyRef.current.highPulse = Math.max(
      musicVisualEnergyRef.current.highPulse * Math.exp(-deltaMs * 0.015),
      musicEnergyRef.current.highPulse,
    );
    musicVisualEnergyRef.current.noisePulse = Math.max(
      musicVisualEnergyRef.current.noisePulse * Math.exp(-deltaMs * 0.017),
      musicEnergyRef.current.noisePulse,
    );
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = SCREEN_BG;
    context.fillRect(0, 0, width, height);

    const trail = trailRef.current;
    for (let index = trail.length - 1; index >= 0; index -= 1) {
      trail[index].life -= deltaMs * (trail[index].strength > 1 ? 0.00034 : 0.00018);
      if (trail[index].life <= 0) {
        trail.splice(index, 1);
      }
    }

    const pointer = pointerRef.current;
    if (pointer.active) {
      const smoothing = 1 - Math.exp(-deltaMs * 0.022);
      pointer.renderX = mix(pointer.renderX, pointer.x, smoothing);
      pointer.renderY = mix(pointer.renderY, pointer.y, smoothing);

      const trailDistance = Math.hypot(pointer.renderX - pointer.lastTrailX, pointer.renderY - pointer.lastTrailY);
      if (trailDistance > cellSize * 0.28 || time - pointer.lastSpawn > 72) {
        pushTrailPoint(pointer.renderX, pointer.renderY, 0.92);
        pointer.lastSpawn = time;
        pointer.lastTrailX = pointer.renderX;
        pointer.lastTrailY = pointer.renderY;
      }
    }

    const pointerTargetStrength = mouseReactive && pointer.active ? 1 : 0;
    pointerVisualStrengthRef.current = mix(
      pointerVisualStrengthRef.current,
      pointerTargetStrength,
      1 - Math.exp(-deltaMs * 0.02),
    );

    if (pointerVisualStrengthRef.current > 0.01) {
      const pointerGlow = context.createRadialGradient(
        pointer.renderX,
        pointer.renderY,
        0,
        pointer.renderX,
        pointer.renderY,
        variant === "login" ? cellSize * 7.2 : cellSize * 6.8,
      );
      pointerGlow.addColorStop(0, `rgba(210, 223, 147, ${0.22 * pointerVisualStrengthRef.current})`);
      pointerGlow.addColorStop(0.35, `rgba(139, 172, 15, ${0.16 * pointerVisualStrengthRef.current})`);
      pointerGlow.addColorStop(0.72, `rgba(72, 110, 38, ${0.09 * pointerVisualStrengthRef.current})`);
      pointerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = pointerGlow;
      context.fillRect(0, 0, width, height);
    }

    const gap = Math.max(2, Math.floor(cellSize * 0.18));

    if (variant === "arcade") {
      const music = musicVisualEnergyRef.current;
      const musicField = musicFieldRef.current;
      const fieldSize = cols * rows;

      for (let index = 0; index < fieldSize; index += 1) {
        musicField.low[index] *= Math.exp(-deltaMs * 0.0038);
        musicField.mid[index] *= Math.exp(-deltaMs * 0.0047);
        musicField.high[index] *= Math.exp(-deltaMs * 0.0058);
        musicField.noise[index] *= Math.exp(-deltaMs * 0.0076);
      }

      musicEmitCarryRef.current.low += deltaMs * (music.low * 0.010 + music.lowPulse * 0.024);
      musicEmitCarryRef.current.mid += deltaMs * (music.mid * 0.013 + music.midPulse * 0.028);
      musicEmitCarryRef.current.high += deltaMs * (music.high * 0.015 + music.highPulse * 0.032);
      musicEmitCarryRef.current.noise += deltaMs * (music.noise * 0.022 + music.noisePulse * 0.048);

      while (musicEmitCarryRef.current.low >= 1) {
        musicEmitCarryRef.current.low -= 1;
        stampMusicCharge(
          musicField.low,
          Math.floor(Math.random() * cols),
          Math.floor(Math.random() * rows),
          2 + Math.round(music.lowPulse * 2),
          0.3 + music.low * 0.38 + music.lowPulse * 0.42,
        );
      }

      while (musicEmitCarryRef.current.mid >= 1) {
        musicEmitCarryRef.current.mid -= 1;
        stampMusicCharge(
          musicField.mid,
          Math.floor(Math.random() * cols),
          Math.floor(Math.random() * rows),
          1 + Math.round(music.midPulse * 2),
          0.28 + music.mid * 0.36 + music.midPulse * 0.44,
        );
      }

      while (musicEmitCarryRef.current.high >= 1) {
        musicEmitCarryRef.current.high -= 1;
        stampMusicCharge(
          musicField.high,
          Math.floor(Math.random() * cols),
          Math.floor(Math.random() * rows),
          1,
          0.36 + music.high * 0.4 + music.highPulse * 0.48,
        );
      }

      while (musicEmitCarryRef.current.noise >= 1) {
        musicEmitCarryRef.current.noise -= 1;
        stampMusicCharge(
          musicField.noise,
          Math.floor(Math.random() * cols),
          Math.floor(Math.random() * rows),
          0,
          0.34 + music.noise * 0.3 + music.noisePulse * 0.56,
        );
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * cols + col;
        const motif = motifCells.get(index);
        const x = col * cellSize;
        const y = row * cellSize;
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;
        const ambient = 0.03 + (Math.sin(col * 0.55 + time * 0.0009) + Math.cos(row * 0.48 + time * 0.0007)) * 0.008;

        const motifGlow =
          motif
            ? variant === "login"
              ? 0.012 + motif.tone * 0.018
              : 0.003 + motif.tone * 0.006
            : 0;
        let glow = ambient + motifGlow;
        const musicField = musicFieldRef.current;
        const musicGlow =
          musicField.low[index] * 0.56
          + musicField.mid[index] * 0.74
          + musicField.high[index] * 0.96
          + musicField.noise[index] * 1.14;
        glow += musicGlow;

        for (const point of trail) {
          const dx = centerX - point.x;
          const dy = centerY - point.y;
          const radius = cellSize * mix(3.2, 6.3, point.strength / 1.65);
          const distance = Math.hypot(dx, dy);

          if (distance > radius) {
            continue;
          }

          const falloff = 1 - distance / radius;
          glow +=
            falloff
            * falloff
            * point.life
            * point.strength
            * (motif ? 0.96 : 0.68);
        }

        glow = clamp(glow, 0, 1);
        context.fillStyle = getFieldColors(glow, motif?.tone ?? 0);

        const inset = motif ? gap * 0.48 : gap * 0.7;
        const size = cellSize - inset * 2;
        context.fillRect(x + inset, y + inset, size, size);
      }
    }

    context.fillStyle = "rgba(210, 223, 147, 0.05)";
    for (let y = 0; y < height; y += 6) {
      context.fillRect(0, y, width, 1);
    }

    frameRef.current = window.requestAnimationFrame(animate);
  });

  useEffect(() => {
    if (mouseReactive) {
      return;
    }

    pointerRef.current.active = false;
  }, [mouseReactive]);

  useEffect(() => {
    resizeCanvas();

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const handleBlur = () => {
      pointerRef.current.active = false;
    };
    const handleMusicEnergy = (event: Event) => {
      const customEvent = event as CustomEvent<GameboyMusicEnergyDetail>;
      musicEnergyRef.current = {
        energy: clamp(customEvent.detail?.energy ?? 0, 0, 1),
        low: clamp(customEvent.detail?.low ?? 0, 0, 1),
        mid: clamp(customEvent.detail?.mid ?? 0, 0, 1),
        high: clamp(customEvent.detail?.high ?? 0, 0, 1),
        noise: clamp(customEvent.detail?.noise ?? 0, 0, 1),
        pulse: clamp(customEvent.detail?.pulse ?? 0, 0, 1),
        lowPulse: clamp(customEvent.detail?.lowPulse ?? 0, 0, 1),
        midPulse: clamp(customEvent.detail?.midPulse ?? 0, 0, 1),
        highPulse: clamp(customEvent.detail?.highPulse ?? 0, 0, 1),
        noisePulse: clamp(customEvent.detail?.noisePulse ?? 0, 0, 1),
      };
    };

    frameRef.current = window.requestAnimationFrame(animate);
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("blur", handleBlur);
    if (variant === "arcade") {
      window.addEventListener(GAMEBOY_MUSIC_ENERGY_EVENT, handleMusicEnergy as EventListener);
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener(GAMEBOY_MUSIC_ENERGY_EVENT, handleMusicEnergy as EventListener);
      window.cancelAnimationFrame(frameRef.current);
      lastFrameTimeRef.current = 0;
      pointerVisualStrengthRef.current = 0;
      musicEnergyRef.current = {
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
      };
      musicVisualEnergyRef.current = {
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
      };
      createMusicField(0, 0);
    };
  }, [animate, createMusicField, handlePointerDown, handlePointerMove, mouseReactive, resizeCanvas, stampMusicCharge, variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        pointerEvents: "none",
        zIndex: 0,
        opacity: variant === "login" ? 1 : 0.9,
      }}
    />
  );
}
