"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Center, Environment, PerspectiveCamera, useGLTF } from "@react-three/drei";
import {
  AdditiveBlending,
  CanvasTexture,
  ClampToEdgeWrapping,
  FrontSide,
  Group,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
} from "three";
import type { Material, MeshStandardMaterial } from "three";
import type { GLTF } from "three-stdlib";
import type {
  GameboyControlButton,
  GameboyPressedButtons,
} from "@/components/arcade/gameboy-games";

type GameboyGLTF = GLTF & {
  scene: Group;
};

export type GameboyScreenMode = "placeholder" | "mapped";

export type GameboyScreenMount = {
  anchorName?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  tint: string;
};

type GameboyBatteryMount = {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
};

export type GameboyViewerConfig = {
  modelUrl: string;
  fullScreen: boolean;
  height: number;
  initialCamera: {
    position: [number, number, number];
    fov: number;
  };
  modelTransform: {
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  };
  motion: {
    dragSensitivity: {
      x: number;
      y: number;
    };
    rotationDamping: number;
    dragLimits: {
      x: [number, number] | null;
      y: [number, number] | null;
    };
    pointerFollow: {
      x: number;
      y: number;
    };
  };
  screen: {
    mode: GameboyScreenMode;
    mount: GameboyScreenMount;
    texture?: Texture | null;
  };
};

const DEFAULT_SCREEN_MOUNT: GameboyScreenMount = {
  anchorName: "screen",
  position: [0.025, 0.18, 0],
  rotation: [0, Math.PI / 2, 0],
  size: [0.08, 0.0632],
  tint: "#d2df93",
};

// Temporary LED placement so it is easy to spot and tweak against the model.
const DEFAULT_BATTERY_MOUNT: GameboyBatteryMount = {
  position: [0.02499, 0.1895, 0.0535],
  rotation: [0, Math.PI / 2, 0],
  size: [0.0055, 0.0055],
};

const DEFAULT_VIEWER_CONFIG: Omit<GameboyViewerConfig, "modelUrl" | "fullScreen" | "height" | "screen"> = {
  initialCamera: {
    position: [0, 0, 2],
    fov: 35,
  },
  modelTransform: {
    position: [0, -0.02, 0],
    rotation: [0, -Math.PI / 2, 0],
    scale: 4.3,
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
      x: 0.15,
      y: 0.15,
    },
  },
};

const MODEL_NODE_NAMES = {
  a: "btn_a",
  b: "btn_b",
  start: "btn_start",
  select: "btn_select",
  dpad: "dpad_cap",
} as const;

const ROUND_BUTTON_PRESS_DEPTH = 0.003;
const CENTER_BUTTON_PRESS_DEPTH = 0.00135;
const DPAD_PRESS_DEPTH = 0.0024;
const DPAD_TILT = 0.12;
const POINTER_PRESS_VISUAL_MS = 110;
const MODEL_REVEAL_ENTRY_X = 0.02;
const MODEL_REVEAL_ENTRY_Y = -0.06;
const MODEL_REVEAL_ENTRY_Z = 0.44;
const MODEL_REVEAL_OVERSHOOT_X = 0;
const MODEL_REVEAL_OVERSHOOT_Y = 0.01;
const MODEL_REVEAL_OVERSHOOT_Z = -0.02;
const MODEL_REVEAL_TILT_X = -0.08;
const MODEL_REVEAL_TILT_Y = Math.PI * 2;
const MODEL_REVEAL_TILT_Z = 0.1;
const MODEL_REVEAL_OVERSHOOT_TILT_X = 0.02;
const MODEL_REVEAL_OVERSHOOT_TILT_Y = -0.14;
const MODEL_REVEAL_OVERSHOOT_TILT_Z = -0.015;
const MODEL_REVEAL_START_SCALE = 0.04;
const MODEL_REVEAL_OVERSHOOT_SCALE = 1.045;
const MODEL_REVEAL_DELAY_MS = 70;
const MODEL_REVEAL_DURATION_MS = 860;
const MODEL_REVEAL_ENTRY_PORTION = 0.82;
const MODEL_INTERACTION_DELAY_MS = 2000;
const MODEL_INTERACTION_FADE_MS = 260;

type InteractiveModelParts = {
  body: Group;
  buttons: Partial<Record<keyof typeof MODEL_NODE_NAMES, Mesh>>;
};

type DpadPivotData = {
  meshOffset: Vector3;
  pivotPosition: Vector3;
};

function createButtonBooleanRecord(): Record<GameboyControlButton, boolean> {
  return {
    a: false,
    b: false,
    start: false,
    select: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };
}

function createButtonTimeRecord(): Record<GameboyControlButton, number> {
  return {
    a: 0,
    b: 0,
    start: 0,
    select: 0,
    up: 0,
    down: 0,
    left: 0,
    right: 0,
  };
}

function applyAxisLimit(value: number, limits: [number, number] | null) {
  if (!limits) {
    return value;
  }

  return MathUtils.clamp(value, limits[0], limits[1]);
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeOutBack(value: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function getStagedRevealValue(progress: number, startValue: number, overshootValue: number, endValue = 0) {
  if (progress <= MODEL_REVEAL_ENTRY_PORTION) {
    const entryProgress = easeOutCubic(progress / MODEL_REVEAL_ENTRY_PORTION);
    return mix(startValue, overshootValue, entryProgress);
  }

  const settleProgress = easeOutCubic((progress - MODEL_REVEAL_ENTRY_PORTION) / (1 - MODEL_REVEAL_ENTRY_PORTION));
  return mix(overshootValue, endValue, settleProgress);
}

function getRevealPose(progress: number) {
  if (progress >= 1) {
    return {
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scale: 1,
    };
  }

  const scaleProgress = easeOutBack(progress);
  return {
    offsetX: getStagedRevealValue(progress, MODEL_REVEAL_ENTRY_X, MODEL_REVEAL_OVERSHOOT_X),
    offsetY: getStagedRevealValue(progress, MODEL_REVEAL_ENTRY_Y, MODEL_REVEAL_OVERSHOOT_Y),
    offsetZ: getStagedRevealValue(progress, MODEL_REVEAL_ENTRY_Z, MODEL_REVEAL_OVERSHOOT_Z),
    rotationX: getStagedRevealValue(progress, MODEL_REVEAL_TILT_X, MODEL_REVEAL_OVERSHOOT_TILT_X),
    rotationY: getStagedRevealValue(progress, MODEL_REVEAL_TILT_Y, MODEL_REVEAL_OVERSHOOT_TILT_Y),
    rotationZ: getStagedRevealValue(progress, MODEL_REVEAL_TILT_Z, MODEL_REVEAL_OVERSHOOT_TILT_Z),
    scale: mix(MODEL_REVEAL_START_SCALE, 1, scaleProgress),
  };
}

const INITIAL_REVEAL_POSE = getRevealPose(0);

function getInteractionWeight(progress: number) {
  return easeOutCubic(progress);
}

function prepareMaterial(material: Material) {
  const meshMaterial = material as MeshStandardMaterial;

  if ("map" in meshMaterial && meshMaterial.map) {
    meshMaterial.map.colorSpace = SRGBColorSpace;
    meshMaterial.map.needsUpdate = true;
  }

  meshMaterial.side = FrontSide;
  meshMaterial.depthWrite = true;
  meshMaterial.depthTest = true;
  meshMaterial.alphaHash = false;
  meshMaterial.forceSinglePass = false;

  if (meshMaterial.transparent && meshMaterial.opacity >= 0.999) {
    meshMaterial.transparent = false;
    meshMaterial.alphaTest = 0;
  }

  meshMaterial.needsUpdate = true;
}

function sanitizeScene(root: Group) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => {
        const clonedMaterial = material.clone();
        prepareMaterial(clonedMaterial);
        return clonedMaterial;
      });
      return;
    }

    const clonedMaterial = mesh.material.clone();
    prepareMaterial(clonedMaterial);
    mesh.material = clonedMaterial;
  });
}

function splitInteractiveModel(scene: Group): InteractiveModelParts {
  const body = scene.clone();
  sanitizeScene(body);

  const buttons = Object.entries(MODEL_NODE_NAMES).reduce<InteractiveModelParts["buttons"]>((acc, [key, name]) => {
    const object = body.getObjectByName(name);
    if (object instanceof Mesh) {
      object.removeFromParent();
      object.matrixAutoUpdate = true;
      object.updateMatrix();
      object.updateMatrixWorld(true);
      acc[key as keyof typeof MODEL_NODE_NAMES] = object;
    }
    return acc;
  }, {});

  return {
    body,
    buttons,
  };
}

function resolveDpadDirection(mesh: Mesh, worldPoint: Vector3): GameboyControlButton {
  const localPoint = mesh.worldToLocal(worldPoint.clone());
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }

  const bounds = mesh.geometry.boundingBox;
  if (!bounds) {
    return "up";
  }

  const centerY = (bounds.min.y + bounds.max.y) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  const halfHeight = Math.max((bounds.max.y - bounds.min.y) / 2, 0.0001);
  const halfWidth = Math.max((bounds.max.z - bounds.min.z) / 2, 0.0001);
  const normalizedY = (localPoint.y - centerY) / halfHeight;
  const normalizedZ = (localPoint.z - centerZ) / halfWidth;

  if (Math.abs(normalizedY) >= Math.abs(normalizedZ)) {
    return normalizedY >= 0 ? "up" : "down";
  }

  return normalizedZ >= 0 ? "left" : "right";
}

function getPointerCaptureTarget(event: ThreeEvent<PointerEvent>) {
  return event.target as EventTarget & {
    hasPointerCapture(pointerId: number): boolean;
    releasePointerCapture(pointerId: number): void;
    setPointerCapture(pointerId: number): void;
  };
}

type PointerInteractionType = "drag" | "control";

function getDpadPivotData(mesh: Mesh): DpadPivotData | null {
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }

  const bounds = mesh.geometry.boundingBox;
  if (!bounds) {
    return null;
  }

  const localCenter = bounds.getCenter(new Vector3());
  mesh.updateMatrix();

  const pivotPosition = localCenter.clone().applyMatrix4(mesh.matrix);
  const meshOffset = mesh.position.clone().sub(pivotPosition);

  return {
    meshOffset,
    pivotPosition,
  };
}

function createBatteryIndicatorTextures() {
  if (typeof document === "undefined") {
    return null;
  }

  const dotCanvas = document.createElement("canvas");
  dotCanvas.width = 256;
  dotCanvas.height = 256;

  const dotContext = dotCanvas.getContext("2d");
  if (!dotContext) {
    return null;
  }

  dotContext.clearRect(0, 0, dotCanvas.width, dotCanvas.height);
  dotContext.beginPath();
  dotContext.arc(128, 128, 88, 0, Math.PI * 2);
  dotContext.fillStyle = "rgba(255,255,255,0.22)";
  dotContext.fill();

  dotContext.beginPath();
  dotContext.arc(128, 128, 68, 0, Math.PI * 2);
  dotContext.fillStyle = "rgba(255,255,255,0.78)";
  dotContext.fill();

  dotContext.beginPath();
  dotContext.arc(128, 128, 42, 0, Math.PI * 2);
  dotContext.fillStyle = "rgba(255,255,255,1)";
  dotContext.fill();

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = 256;
  glowCanvas.height = 256;

  const glowContext = glowCanvas.getContext("2d");
  if (!glowContext) {
    return null;
  }

  const glowGradient = glowContext.createRadialGradient(128, 128, 12, 128, 128, 120);
  glowGradient.addColorStop(0, "rgba(255,255,255,0.95)");
  glowGradient.addColorStop(0.22, "rgba(255,255,255,0.55)");
  glowGradient.addColorStop(0.55, "rgba(255,255,255,0.14)");
  glowGradient.addColorStop(1, "rgba(255,255,255,0)");
  glowContext.fillStyle = glowGradient;
  glowContext.fillRect(0, 0, glowCanvas.width, glowCanvas.height);

  const dotTexture = new CanvasTexture(dotCanvas);
  dotTexture.colorSpace = SRGBColorSpace;
  dotTexture.minFilter = LinearFilter;
  dotTexture.magFilter = LinearFilter;
  dotTexture.needsUpdate = true;

  const glowTexture = new CanvasTexture(glowCanvas);
  glowTexture.colorSpace = SRGBColorSpace;
  glowTexture.minFilter = LinearFilter;
  glowTexture.magFilter = LinearFilter;
  glowTexture.needsUpdate = true;

  return {
    dotTexture,
    glowTexture,
  };
}

function createScreenSurfaceTextures() {
  if (typeof document === "undefined") {
    return null;
  }

  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 256;
  textureCanvas.height = 256;

  const textureContext = textureCanvas.getContext("2d");
  if (!textureContext) {
    return null;
  }

  textureContext.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  textureContext.fillStyle = "rgba(255,255,255,0.025)";
  for (let y = 0; y < textureCanvas.height; y += 4) {
    textureContext.fillRect(0, y, textureCanvas.width, 1);
  }

  textureContext.strokeStyle = "rgba(255,255,255,0.045)";
  textureContext.lineWidth = 1;
  for (let index = 0; index < 5; index += 1) {
    const y = 30 + index * 42;
    textureContext.beginPath();
    textureContext.moveTo(20, y);
    textureContext.lineTo(236, y + (index % 2 === 0 ? 4 : -4));
    textureContext.stroke();
  }

  for (let index = 0; index < 180; index += 1) {
    const x = Math.random() * textureCanvas.width;
    const y = Math.random() * textureCanvas.height;
    const size = 1 + Math.random() * 1.75;
    const alpha = 0.018 + Math.random() * 0.04;
    textureContext.fillStyle = `rgba(255,255,255,${alpha})`;
    textureContext.fillRect(x, y, size, size);
  }

  const textureOverlay = new CanvasTexture(textureCanvas);
  textureOverlay.colorSpace = SRGBColorSpace;
  textureOverlay.minFilter = LinearFilter;
  textureOverlay.magFilter = LinearFilter;
  textureOverlay.wrapS = ClampToEdgeWrapping;
  textureOverlay.wrapT = ClampToEdgeWrapping;
  textureOverlay.needsUpdate = true;

  return {
    textureOverlay,
  };
}

function ScreenSurface({
  mode,
  mount,
  texture,
  poweredOn,
  surfaceTextures,
}: {
  mode: GameboyScreenMode;
  mount: GameboyScreenMount;
  texture?: Texture | null;
  poweredOn: boolean;
  surfaceTextures: ReturnType<typeof createScreenSurfaceTextures>;
}) {
  const [mounted, setMounted] = useState(poweredOn);
  const contentMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const baseMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const textureMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const liveTextureRef = useRef<Texture | null>(texture ?? null);

  useEffect(() => {
    liveTextureRef.current = texture ?? null;
  }, [texture]);

  useEffect(() => {
    let offTimer = 0;
    let mountFrame = 0;

    if (poweredOn) {
      mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
      });
      return () => {
        window.cancelAnimationFrame(mountFrame);
        window.clearTimeout(offTimer);
      };
    }

    offTimer = window.setTimeout(() => {
      setMounted(false);
    }, 220);

    return () => {
      window.cancelAnimationFrame(mountFrame);
      window.clearTimeout(offTimer);
    };
  }, [poweredOn]);

  useEffect(() => {
    const contentMaterial = contentMaterialRef.current;
    if (!contentMaterial) {
      return;
    }

    contentMaterial.map = mode === "mapped" && texture ? texture : null;
    contentMaterial.color.set(mode === "mapped" && texture ? "#ffffff" : mount.tint);
    contentMaterial.needsUpdate = true;
  }, [mode, mount.tint, texture]);

  useFrame((_, delta) => {
    const baseMaterial = baseMaterialRef.current;
    const contentMaterial = contentMaterialRef.current;
    const textureMaterial = textureMaterialRef.current;
    if (!baseMaterial || !contentMaterial || !textureMaterial) {
      return;
    }

    baseMaterial.opacity = MathUtils.damp(baseMaterial.opacity, poweredOn ? 1 : 0, 8, delta);
    contentMaterial.opacity = MathUtils.damp(contentMaterial.opacity, poweredOn ? 1 : 0, 8, delta);
    textureMaterial.opacity = MathUtils.damp(textureMaterial.opacity, poweredOn ? 0.14 : 0.03, 8, delta);

    if (liveTextureRef.current) {
      liveTextureRef.current.needsUpdate = true;
    }
  });

  if (!mounted) {
    return null;
  }

  return (
    <>
      <mesh
        position={mount.position}
        rotation={mount.rotation}
        renderOrder={11}
      >
        <planeGeometry args={mount.size} />
        <meshBasicMaterial
          ref={baseMaterialRef}
          color="#0f110a"
          toneMapped={false}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh
        position={mount.position}
        rotation={mount.rotation}
        renderOrder={12}
      >
        <planeGeometry args={mount.size} />
        <meshBasicMaterial
          ref={contentMaterialRef}
          color={mode === "mapped" && texture ? "#ffffff" : mount.tint}
          map={mode === "mapped" && texture ? texture : null}
          toneMapped={false}
          transparent
          opacity={0}
        />
      </mesh>
      <mesh
        position={[mount.position[0], mount.position[1], mount.position[2] + 0.00015]}
        rotation={mount.rotation}
        renderOrder={13}
      >
        <planeGeometry args={mount.size} />
        <meshBasicMaterial
          ref={textureMaterialRef}
          color="#eef0da"
          map={surfaceTextures?.textureOverlay ?? null}
          toneMapped={false}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

function BatteryIndicatorSurface({
  mount,
  poweredOn,
  dotTexture,
  glowTexture,
}: {
  mount: GameboyBatteryMount;
  poweredOn: boolean;
  dotTexture: Texture | null;
  glowTexture: Texture | null;
}) {
  const dotMaterialRef = useRef<MeshBasicMaterial | null>(null);
  const glowMaterialRef = useRef<MeshBasicMaterial | null>(null);

  useFrame(({ clock }, delta) => {
    const dotMaterial = dotMaterialRef.current;
    const glowMaterial = glowMaterialRef.current;
    if (!dotMaterial || !glowMaterial) {
      return;
    }

    const glowPulse = poweredOn ? 0.45 + (Math.sin(clock.elapsedTime * 4.2) + 1) * 0.2 : 0;
    dotMaterial.opacity = MathUtils.damp(dotMaterial.opacity, poweredOn ? 1 : 0.35, 9, delta);
    glowMaterial.opacity = MathUtils.damp(glowMaterial.opacity, glowPulse, 6, delta);
    dotMaterial.color.set(poweredOn ? "#ff4d42" : "#3d0c10");
    glowMaterial.color.set("#ff3b30");
  });

  if (!dotTexture || !glowTexture) {
    return null;
  }

  return (
    <group
      position={mount.position}
      rotation={mount.rotation}
    >
      <mesh
        position={[0, 0, 0.0002]}
        renderOrder={13}
      >
        <planeGeometry args={[mount.size[0] * 2.6, mount.size[1] * 2.6]} />
        <meshBasicMaterial
          ref={glowMaterialRef}
          color="#ff3b30"
          map={glowTexture}
          toneMapped={false}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh
        position={[0, 0, 0.0004]}
        renderOrder={14}
      >
        <planeGeometry args={mount.size} />
        <meshBasicMaterial
          ref={dotMaterialRef}
          color="#3d0c10"
          map={dotTexture}
          toneMapped={false}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function ModelRig({
  modelUrl,
  config,
  dragRotation,
  pointerRotation,
  poweredOn,
  pressedButtons,
  onControlButtonChange,
  batteryTextures,
  screenSurfaceTextures,
  pointerInteraction,
  onControlHoverChange,
  onRevealStart,
}: {
  modelUrl: string;
  config: GameboyViewerConfig;
  dragRotation: RefObject<Vector2>;
  pointerRotation: RefObject<Vector2>;
  poweredOn: boolean;
  pressedButtons: GameboyPressedButtons;
  onControlButtonChange?: (button: GameboyControlButton, pressed: boolean, sourceId: string) => void;
  batteryTextures: ReturnType<typeof createBatteryIndicatorTextures>;
  screenSurfaceTextures: ReturnType<typeof createScreenSurfaceTextures>;
  pointerInteraction: RefObject<Map<number, PointerInteractionType>>;
  onControlHoverChange?: (hovering: boolean) => void;
  onRevealStart?: () => void;
}) {
  const { scene } = useGLTF(modelUrl) as GameboyGLTF;
  const interactionRigRef = useRef<Group>(null);
  const revealRigRef = useRef<Group>(null);
  const dpadPivotRef = useRef<Group>(null);
  const settledRotationRef = useRef(new Vector2(0, 0));
  const revealStartedAtRef = useRef<number | null>(null);
  const activePointerButtonsRef = useRef(new Map<number, GameboyControlButton>());
  const pointerSourceRef = useRef(new Map<number, string>());
  const pointerVisualUntilRef = useRef(createButtonTimeRecord());
  const onControlButtonChangeRef = useRef(onControlButtonChange);
  const onRevealStartRef = useRef(onRevealStart);

  useEffect(() => {
    onControlButtonChangeRef.current = onControlButtonChange;
  }, [onControlButtonChange]);

  useEffect(() => {
    onRevealStartRef.current = onRevealStart;
  }, [onRevealStart]);

  useLayoutEffect(() => {
    settledRotationRef.current.set(0, 0);
    revealStartedAtRef.current = performance.now() + MODEL_REVEAL_DELAY_MS;
    onRevealStartRef.current?.();
  }, [modelUrl]);

  const modelParts = useMemo(() => {
    return splitInteractiveModel(scene);
  }, [scene]);

  const baseTransforms = useMemo(
    () => ({
      aPosition: modelParts.buttons.a?.position.clone() ?? new Vector3(),
      bPosition: modelParts.buttons.b?.position.clone() ?? new Vector3(),
      startPosition: modelParts.buttons.start?.position.clone() ?? new Vector3(),
      selectPosition: modelParts.buttons.select?.position.clone() ?? new Vector3(),
    }),
    [modelParts.buttons.a, modelParts.buttons.b, modelParts.buttons.select, modelParts.buttons.start],
  );

  const dpadPivotData = useMemo(() => {
    const dpad = modelParts.buttons.dpad;
    if (!dpad) {
      return null;
    }

    return getDpadPivotData(dpad);
  }, [modelParts.buttons.dpad]);

  const buttonMeshesRef = useRef(modelParts.buttons);
  const baseTransformsRef = useRef(baseTransforms);

  useEffect(() => {
    buttonMeshesRef.current = modelParts.buttons;
    baseTransformsRef.current = baseTransforms;
  }, [baseTransforms, modelParts.buttons]);

  useEffect(() => {
    return () => {
      onControlHoverChange?.(false);
    };
  }, [onControlHoverChange]);

  const emitControlButtonChange = (button: GameboyControlButton, pressed: boolean, sourceId: string) => {
    onControlButtonChangeRef.current?.(button, pressed, sourceId);
  };

  useEffect(() => {
    const activePointerButtons = activePointerButtonsRef.current;
    const pointerSources = pointerSourceRef.current;
    const pointerInteractions = pointerInteraction.current;

    return () => {
      activePointerButtons.forEach((button, pointerId) => {
        const sourceId = pointerSources.get(pointerId) ?? `pointer:${pointerId}`;
        emitControlButtonChange(button, false, sourceId);
      });
      activePointerButtons.clear();
      pointerSources.clear();
      pointerInteractions.clear();
      pointerVisualUntilRef.current = createButtonTimeRecord();
    };
  }, [pointerInteraction]);

  useEffect(() => {
    const releaseAllControls = () => {
      const activePointerButtons = activePointerButtonsRef.current;
      const pointerSources = pointerSourceRef.current;

      activePointerButtons.forEach((button, pointerId) => {
        const sourceId = pointerSources.get(pointerId) ?? `pointer:${pointerId}`;
        emitControlButtonChange(button, false, sourceId);
      });

      activePointerButtons.clear();
      pointerSources.clear();
      pointerInteraction.current.clear();
      pointerVisualUntilRef.current = createButtonTimeRecord();
    };

    window.addEventListener("pointerup", releaseAllControls);
    window.addEventListener("pointercancel", releaseAllControls);
    window.addEventListener("blur", releaseAllControls);

    return () => {
      window.removeEventListener("pointerup", releaseAllControls);
      window.removeEventListener("pointercancel", releaseAllControls);
      window.removeEventListener("blur", releaseAllControls);
    };
  }, [pointerInteraction]);

  const updatePointerButton = (pointerId: number, nextButton: GameboyControlButton | null) => {
    const sourceId = pointerSourceRef.current.get(pointerId) ?? `pointer:${pointerId}`;
    pointerSourceRef.current.set(pointerId, sourceId);

    const currentButton = activePointerButtonsRef.current.get(pointerId);
    if (currentButton === nextButton) {
      return;
    }

    if (currentButton) {
      emitControlButtonChange(currentButton, false, sourceId);
      activePointerButtonsRef.current.delete(pointerId);
    }

    if (nextButton) {
      activePointerButtonsRef.current.set(pointerId, nextButton);
      pointerVisualUntilRef.current[nextButton] = POINTER_PRESS_VISUAL_MS / 1000;

      const buttons = buttonMeshesRef.current;
      const transforms = baseTransformsRef.current;
      const dpadPivot = dpadPivotRef.current;

      if (nextButton === "a" && buttons.a) {
        buttons.a.position.x = transforms.aPosition.x - ROUND_BUTTON_PRESS_DEPTH;
      } else if (nextButton === "b" && buttons.b) {
        buttons.b.position.x = transforms.bPosition.x - ROUND_BUTTON_PRESS_DEPTH;
      } else if (nextButton === "start" && buttons.start) {
        buttons.start.position.x = transforms.startPosition.x - CENTER_BUTTON_PRESS_DEPTH;
      } else if (nextButton === "select" && buttons.select) {
        buttons.select.position.x = transforms.selectPosition.x - CENTER_BUTTON_PRESS_DEPTH;
      } else if (
        dpadPivot &&
        dpadPivotData &&
        (nextButton === "up" || nextButton === "down" || nextButton === "left" || nextButton === "right")
      ) {
        dpadPivot.position.x = dpadPivotData.pivotPosition.x - DPAD_PRESS_DEPTH;
        dpadPivot.position.y = dpadPivotData.pivotPosition.y;
        dpadPivot.position.z = dpadPivotData.pivotPosition.z;
        dpadPivot.rotation.x = 0;
        dpadPivot.rotation.y = nextButton === "left" ? -DPAD_TILT : nextButton === "right" ? DPAD_TILT : 0;
        dpadPivot.rotation.z = nextButton === "up" ? DPAD_TILT : nextButton === "down" ? -DPAD_TILT : 0;
      }

      emitControlButtonChange(nextButton, true, sourceId);
    }
  };

  const releasePointerButton = (pointerId: number) => {
    updatePointerButton(pointerId, null);
    pointerSourceRef.current.delete(pointerId);
    pointerInteraction.current.delete(pointerId);
  };

  const handleButtonPointerDown =
    (button: GameboyControlButton) => (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      pointerInteraction.current.set(event.pointerId, "control");
      const target = getPointerCaptureTarget(event);
      target.setPointerCapture(event.pointerId);
      updatePointerButton(event.pointerId, button);
    };

  const handleButtonPointerUp = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const target = getPointerCaptureTarget(event);
    if (target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    releasePointerButton(event.pointerId);
  };

  const handleButtonPointerCancel = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    releasePointerButton(event.pointerId);
  };

  const handleControlPointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onControlHoverChange?.(true);
  };

  const handleControlPointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onControlHoverChange?.(false);
  };

  const handleDpadPointerDown = (event: ThreeEvent<PointerEvent>) => {
    const dpad = modelParts.buttons.dpad;
    if (!dpad) {
      return;
    }

    event.stopPropagation();
    pointerInteraction.current.set(event.pointerId, "control");
    const target = getPointerCaptureTarget(event);
    target.setPointerCapture(event.pointerId);
    updatePointerButton(event.pointerId, resolveDpadDirection(dpad, event.point));
  };

  const handleDpadPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const dpad = modelParts.buttons.dpad;
    const target = getPointerCaptureTarget(event);
    if (!dpad || !target.hasPointerCapture(event.pointerId)) {
      return;
    }

    event.stopPropagation();
    updatePointerButton(event.pointerId, resolveDpadDirection(dpad, event.point));
  };

  useFrame((_, delta) => {
    const interactionRig = interactionRigRef.current;
    const revealRig = revealRigRef.current;
    const buttons = buttonMeshesRef.current;
    const transforms = baseTransformsRef.current;
    if (!interactionRig || !revealRig) {
      return;
    }

    const activePointerButtons = activePointerButtonsRef.current;
    const pointerPressed = createButtonBooleanRecord();

    activePointerButtons.forEach((button) => {
      pointerPressed[button] = true;
    });

    const pointerVisualUntil = pointerVisualUntilRef.current;
    pointerVisualUntil.a = Math.max(pointerVisualUntil.a - delta, 0);
    pointerVisualUntil.b = Math.max(pointerVisualUntil.b - delta, 0);
    pointerVisualUntil.start = Math.max(pointerVisualUntil.start - delta, 0);
    pointerVisualUntil.select = Math.max(pointerVisualUntil.select - delta, 0);
    pointerVisualUntil.up = Math.max(pointerVisualUntil.up - delta, 0);
    pointerVisualUntil.down = Math.max(pointerVisualUntil.down - delta, 0);
    pointerVisualUntil.left = Math.max(pointerVisualUntil.left - delta, 0);
    pointerVisualUntil.right = Math.max(pointerVisualUntil.right - delta, 0);

    if (!pointerPressed.a && pointerVisualUntil.a > 0) {
      pointerPressed.a = true;
    }
    if (!pointerPressed.b && pointerVisualUntil.b > 0) {
      pointerPressed.b = true;
    }
    if (!pointerPressed.start && pointerVisualUntil.start > 0) {
      pointerPressed.start = true;
    }
    if (!pointerPressed.select && pointerVisualUntil.select > 0) {
      pointerPressed.select = true;
    }
    if (!pointerPressed.up && pointerVisualUntil.up > 0) {
      pointerPressed.up = true;
    }
    if (!pointerPressed.down && pointerVisualUntil.down > 0) {
      pointerPressed.down = true;
    }
    if (!pointerPressed.left && pointerVisualUntil.left > 0) {
      pointerPressed.left = true;
    }
    if (!pointerPressed.right && pointerVisualUntil.right > 0) {
      pointerPressed.right = true;
    }

    const { rotationDamping } = config.motion;

    settledRotationRef.current.x = MathUtils.damp(
      settledRotationRef.current.x,
      dragRotation.current.x + pointerRotation.current.x,
      rotationDamping,
      delta,
    );
    settledRotationRef.current.y = MathUtils.damp(
      settledRotationRef.current.y,
      dragRotation.current.y + pointerRotation.current.y,
      rotationDamping,
      delta,
    );

    const revealStartedAt = revealStartedAtRef.current;
    const now = performance.now();
    const revealProgress =
      revealStartedAt === null
        ? 0
        : MathUtils.clamp((now - revealStartedAt) / MODEL_REVEAL_DURATION_MS, 0, 1);
    const revealPose = getRevealPose(revealProgress);
    const interactionProgress =
      revealStartedAt === null
        ? 0
        : MathUtils.clamp(
            (now - (revealStartedAt + MODEL_REVEAL_DURATION_MS + MODEL_INTERACTION_DELAY_MS)) /
              MODEL_INTERACTION_FADE_MS,
            0,
            1,
          );
    const interactionWeight = getInteractionWeight(interactionProgress);

    interactionRig.rotation.x = settledRotationRef.current.x * interactionWeight;
    interactionRig.rotation.y = settledRotationRef.current.y * interactionWeight;
    interactionRig.rotation.z = 0;

    if (revealProgress >= 1) {
      revealRig.rotation.set(0, 0, 0);
      revealRig.position.set(0, 0, 0);
      revealRig.scale.setScalar(1);
    } else {
      revealRig.rotation.x = revealPose.rotationX;
      revealRig.rotation.y = revealPose.rotationY;
      revealRig.rotation.z = revealPose.rotationZ;
      revealRig.position.x = revealPose.offsetX;
      revealRig.position.y = -revealPose.offsetY;
      revealRig.position.z = revealPose.offsetZ;
      revealRig.scale.setScalar(revealPose.scale);
    }

    if (buttons.a) {
      buttons.a.position.x = MathUtils.damp(
        buttons.a.position.x,
        transforms.aPosition.x - (pressedButtons.a || pointerPressed.a ? ROUND_BUTTON_PRESS_DEPTH : 0),
        16,
        delta,
      );
    }

    if (buttons.b) {
      buttons.b.position.x = MathUtils.damp(
        buttons.b.position.x,
        transforms.bPosition.x - (pressedButtons.b || pointerPressed.b ? ROUND_BUTTON_PRESS_DEPTH : 0),
        16,
        delta,
      );
    }

    if (buttons.start) {
      buttons.start.position.x = MathUtils.damp(
        buttons.start.position.x,
        transforms.startPosition.x
          - (pressedButtons.start || pointerPressed.start ? CENTER_BUTTON_PRESS_DEPTH : 0),
        14,
        delta,
      );
    }

    if (buttons.select) {
      buttons.select.position.x = MathUtils.damp(
        buttons.select.position.x,
        transforms.selectPosition.x
          - (pressedButtons.select || pointerPressed.select ? CENTER_BUTTON_PRESS_DEPTH : 0),
        14,
        delta,
      );
    }

    const dpadPivot = dpadPivotRef.current;
    const dpadPressed =
      pressedButtons.up ||
      pressedButtons.down ||
      pressedButtons.left ||
      pressedButtons.right ||
      pointerPressed.up ||
      pointerPressed.down ||
      pointerPressed.left ||
      pointerPressed.right;
    if (dpadPivot && dpadPivotData) {
      dpadPivot.position.x = MathUtils.damp(
        dpadPivot.position.x,
        dpadPivotData.pivotPosition.x - (dpadPressed ? DPAD_PRESS_DEPTH : 0),
        16,
        delta,
      );
      dpadPivot.position.y = dpadPivotData.pivotPosition.y;
      dpadPivot.position.z = dpadPivotData.pivotPosition.z;
      dpadPivot.rotation.x = MathUtils.damp(dpadPivot.rotation.x, 0, 12, delta);
      dpadPivot.rotation.y = MathUtils.damp(
        dpadPivot.rotation.y,
        ((pressedButtons.left || pointerPressed.left) ? -DPAD_TILT : 0)
          + ((pressedButtons.right || pointerPressed.right) ? DPAD_TILT : 0),
        12,
        delta,
      );
      dpadPivot.rotation.z = MathUtils.damp(
        dpadPivot.rotation.z,
        ((pressedButtons.up || pointerPressed.up) ? DPAD_TILT : 0)
          + ((pressedButtons.down || pointerPressed.down) ? -DPAD_TILT : 0),
        12,
        delta,
      );
    }
  });

  return (
    <group
      position={config.modelTransform.position}
    >
      <group
        ref={interactionRigRef}
        rotation={[0, 0, 0]}
      >
        <group
          ref={revealRigRef}
          position={[
            INITIAL_REVEAL_POSE.offsetX,
            -INITIAL_REVEAL_POSE.offsetY,
            INITIAL_REVEAL_POSE.offsetZ,
          ]}
          rotation={[
            INITIAL_REVEAL_POSE.rotationX,
            INITIAL_REVEAL_POSE.rotationY,
            INITIAL_REVEAL_POSE.rotationZ,
          ]}
          scale={INITIAL_REVEAL_POSE.scale}
        >
          <Center>
            <group
              rotation={config.modelTransform.rotation}
              scale={config.modelTransform.scale}
            >
              <primitive object={modelParts.body} />
              {modelParts.buttons.a ? (
                <primitive
                  object={modelParts.buttons.a}
                  onPointerDown={handleButtonPointerDown("a")}
                  onPointerUp={handleButtonPointerUp}
                  onPointerCancel={handleButtonPointerCancel}
                  onPointerOver={handleControlPointerOver}
                  onPointerOut={handleControlPointerOut}
                />
              ) : null}
              {modelParts.buttons.b ? (
                <primitive
                  object={modelParts.buttons.b}
                  onPointerDown={handleButtonPointerDown("b")}
                  onPointerUp={handleButtonPointerUp}
                  onPointerCancel={handleButtonPointerCancel}
                  onPointerOver={handleControlPointerOver}
                  onPointerOut={handleControlPointerOut}
                />
              ) : null}
              {modelParts.buttons.start ? (
                <primitive
                  object={modelParts.buttons.start}
                  onPointerDown={handleButtonPointerDown("start")}
                  onPointerUp={handleButtonPointerUp}
                  onPointerCancel={handleButtonPointerCancel}
                  onPointerOver={handleControlPointerOver}
                  onPointerOut={handleControlPointerOut}
                />
              ) : null}
              {modelParts.buttons.select ? (
                <primitive
                  object={modelParts.buttons.select}
                  onPointerDown={handleButtonPointerDown("select")}
                  onPointerUp={handleButtonPointerUp}
                  onPointerCancel={handleButtonPointerCancel}
                  onPointerOver={handleControlPointerOver}
                  onPointerOut={handleControlPointerOut}
                />
              ) : null}
              {modelParts.buttons.dpad && dpadPivotData ? (
                <group
                  ref={dpadPivotRef}
                  position={[
                    dpadPivotData.pivotPosition.x,
                    dpadPivotData.pivotPosition.y,
                    dpadPivotData.pivotPosition.z,
                  ]}
                >
                  <primitive
                    object={modelParts.buttons.dpad}
                    position={[
                      dpadPivotData.meshOffset.x,
                      dpadPivotData.meshOffset.y,
                      dpadPivotData.meshOffset.z,
                    ]}
                    onPointerDown={handleDpadPointerDown}
                    onPointerMove={handleDpadPointerMove}
                    onPointerUp={handleButtonPointerUp}
                    onPointerCancel={handleButtonPointerCancel}
                    onPointerOver={handleControlPointerOver}
                    onPointerOut={handleControlPointerOut}
                  />
                </group>
              ) : null}
              <ScreenSurface
                mode={config.screen.mode}
                mount={config.screen.mount}
                texture={config.screen.texture}
                poweredOn={poweredOn}
                surfaceTextures={screenSurfaceTextures}
              />
              <BatteryIndicatorSurface
                mount={DEFAULT_BATTERY_MOUNT}
                poweredOn={poweredOn}
                dotTexture={batteryTextures?.dotTexture ?? null}
                glowTexture={batteryTextures?.glowTexture ?? null}
              />
            </group>
          </Center>
        </group>
      </group>
    </group>
  );
}

export function GameboyModelViewer({
  modelUrl,
  fullScreen,
  height,
  screenMode = "placeholder",
  screenTexture,
  screenTint = DEFAULT_SCREEN_MOUNT.tint,
  poweredOn = true,
  pressedButtons = {},
  onControlButtonChange,
  viewerConfig,
}: {
  modelUrl: string;
  fullScreen: boolean;
  height: number;
  screenMode?: GameboyScreenMode;
  screenTexture?: Texture | HTMLCanvasElement | null;
  screenTint?: string;
  poweredOn?: boolean;
  pressedButtons?: GameboyPressedButtons;
  onControlButtonChange?: (button: GameboyControlButton, pressed: boolean, sourceId: string) => void;
  viewerConfig?: Partial<Omit<GameboyViewerConfig, "modelUrl" | "fullScreen" | "height" | "screen">>;
}) {
  const [dragging, setDragging] = useState(false);
  const [hoveringControl, setHoveringControl] = useState(false);
  const [revealVisible, setRevealVisible] = useState(false);
  const dragRotationRef = useRef(new Vector2(0, 0));
  const pointerRotationRef = useRef(new Vector2(0, 0));
  const dragStartRef = useRef<Vector2 | null>(null);
  const pointerInteractionRef = useRef(new Map<number, PointerInteractionType>());

  useEffect(() => {
    setRevealVisible(false);
  }, [modelUrl]);

  const mappedTexture = useMemo(() => {
    if (!screenTexture) {
      return null;
    }

    if (screenTexture instanceof Texture) {
      const texture = screenTexture.clone();
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = NearestFilter;
      texture.magFilter = NearestFilter;
      texture.needsUpdate = true;
      return texture;
    }

    const texture = new CanvasTexture(screenTexture);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, [screenTexture]);

  const batteryTextures = useMemo(() => createBatteryIndicatorTextures(), []);
  const screenSurfaceTextures = useMemo(() => createScreenSurfaceTextures(), []);

  useEffect(() => {
    return () => {
      batteryTextures?.dotTexture.dispose();
      batteryTextures?.glowTexture.dispose();
      screenSurfaceTextures?.textureOverlay.dispose();
    };
  }, [batteryTextures, screenSurfaceTextures]);

  const config = useMemo<GameboyViewerConfig>(
    () => ({
      modelUrl,
      fullScreen,
      height,
      initialCamera: viewerConfig?.initialCamera ?? DEFAULT_VIEWER_CONFIG.initialCamera,
      modelTransform: viewerConfig?.modelTransform ?? DEFAULT_VIEWER_CONFIG.modelTransform,
      motion: viewerConfig?.motion ?? DEFAULT_VIEWER_CONFIG.motion,
      screen: {
        mode: screenMode,
        texture: mappedTexture,
        mount: {
          ...DEFAULT_SCREEN_MOUNT,
          tint: screenTint,
        },
      },
    }),
    [fullScreen, height, mappedTexture, modelUrl, screenMode, screenTint, viewerConfig],
  );

  return (
    <div
      style={{
        position: fullScreen ? "fixed" : "relative",
        inset: fullScreen ? 0 : undefined,
        width: fullScreen ? "100vw" : "100%",
        height: fullScreen ? "100dvh" : `${Math.round(height)}px`,
        borderRadius: 0,
        overflow: "visible",
        background: "transparent",
        pointerEvents: "auto",
        opacity: revealVisible ? 1 : 0,
        transition: "opacity 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "opacity",
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
          cursor: dragging ? "grabbing" : hoveringControl ? "pointer" : "grab",
        }}
        onPointerDown={(event) => {
          if (pointerInteractionRef.current.get(event.pointerId) === "control") {
            return;
          }

          pointerInteractionRef.current.set(event.pointerId, "drag");
          dragStartRef.current = new Vector2(event.clientX, event.clientY);
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (pointerInteractionRef.current.get(event.pointerId) === "control") {
            return;
          }

          const bounds = event.currentTarget.getBoundingClientRect();
          const normalizedX = bounds.width ? (event.clientX - bounds.left) / bounds.width - 0.5 : 0;
          const normalizedY = bounds.height ? (event.clientY - bounds.top) / bounds.height - 0.5 : 0;

          if (!dragging) {
            pointerRotationRef.current.x = MathUtils.clamp(
              normalizedY * config.motion.pointerFollow.x,
              -config.motion.pointerFollow.x,
              config.motion.pointerFollow.x,
            );
            pointerRotationRef.current.y = MathUtils.clamp(
              normalizedX * config.motion.pointerFollow.y,
              -config.motion.pointerFollow.y,
              config.motion.pointerFollow.y,
            );
          }

          if (dragging && dragStartRef.current) {
            const deltaX = event.clientX - dragStartRef.current.x;
            const deltaY = event.clientY - dragStartRef.current.y;
            dragRotationRef.current.y = applyAxisLimit(
              dragRotationRef.current.y + deltaX * config.motion.dragSensitivity.y,
              config.motion.dragLimits.y,
            );
            dragRotationRef.current.x = applyAxisLimit(
              dragRotationRef.current.x + deltaY * config.motion.dragSensitivity.x,
              config.motion.dragLimits.x,
            );
            dragStartRef.current.set(event.clientX, event.clientY);
          }
        }}
        onPointerUp={(event) => {
          pointerInteractionRef.current.delete(event.pointerId);
          setDragging(false);
          dragStartRef.current = null;
          dragRotationRef.current.set(0, 0);
        }}
        onPointerCancel={(event) => {
          pointerInteractionRef.current.delete(event.pointerId);
          setDragging(false);
          dragStartRef.current = null;
          dragRotationRef.current.set(0, 0);
        }}
        onPointerLeave={() => {
          pointerInteractionRef.current.clear();
          setDragging(false);
          setHoveringControl(false);
          dragStartRef.current = null;
          dragRotationRef.current.set(0, 0);
          pointerRotationRef.current.set(0, 0);
        }}
      >
        <PerspectiveCamera
          makeDefault
          position={config.initialCamera.position}
          fov={config.initialCamera.fov}
        />
        <ambientLight intensity={1.9} color="#fff7e0" />
        <directionalLight position={[5, 7, 6]} intensity={2.55} color="#fff4d5" />
        <directionalLight position={[-6, -3, 4]} intensity={1.05} color="#d3dbff" />
        <spotLight
          position={[0, 8, 8]}
          angle={0.38}
          penumbra={0.7}
          intensity={1.95}
          color="#fff8e6"
        />
        <Suspense fallback={null}>
          <ModelRig
            modelUrl={modelUrl}
            config={config}
            dragRotation={dragRotationRef}
            pointerRotation={pointerRotationRef}
            poweredOn={poweredOn}
            pressedButtons={pressedButtons}
            onControlButtonChange={onControlButtonChange}
            batteryTextures={batteryTextures}
            screenSurfaceTextures={screenSurfaceTextures}
            pointerInteraction={pointerInteractionRef}
            onControlHoverChange={setHoveringControl}
            onRevealStart={() => setRevealVisible(true)}
          />
          <Environment preset="warehouse" />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/game_boy_classic_interactive.glb");
