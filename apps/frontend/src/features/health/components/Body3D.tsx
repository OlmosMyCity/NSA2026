'use client';

/**
 * @module health/components/Body3D
 * Interactive 3D anatomical Digital Twin powered by React Three Fiber / Three.js
 * and the BodyParts3D GLB model (`/anatomy/body.glb`).
 *
 * Maps anatomical mesh groups (`heart`, `brain`, `lungs`/`pleura`/`arteries`/`veins`
 * -> `blood`, `skeleton` -> `bones`, and `sleep` focusing on `brain`) to the 5
 * physiological twin zones, driving emissive status glow, priority-ranked raycast
 * picking, smooth camera framing, and heart-rate / respiratory animations.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { ZoneSummary } from '../domain/summary';
import type { BodyZoneId, HealthStatus } from '../domain/types';

const MODEL_URL = '/anatomy/body.glb';

/** Maps GLB model node/group names to the 5 Digital Twin zones (`null` for outer skin). */
const PART_ZONE: Record<string, BodyZoneId | null> = {
  skin: null,
  heart: 'heart',
  lungs: 'blood',
  pleura: 'blood',
  arteries: 'blood',
  veins: 'blood',
  brain: 'brain',
  skeleton: 'bones',
};

const PICK_PRIORITY: Record<string, number> = {
  heart: 5,
  brain: 5,
  lungs: 4,
  pleura: 4,
  skeleton: 3,
  arteries: 2,
  veins: 2,
  skin: 0,
};

const ZONE_FOCUS_PART: Record<BodyZoneId, string> = {
  heart: 'heart',
  blood: 'pleura',
  brain: 'brain',
  sleep: 'brain',
  bones: 'skeleton',
};

const PART_COLOR: Record<string, string> = {
  skin: '#c8a692',
  heart: '#9b2c2c',
  lungs: '#c97b7b',
  pleura: '#d99898',
  arteries: '#b83232',
  veins: '#445e93',
  brain: '#d7a89a',
  skeleton: '#dcd3bf',
};

/** WebGL emissive glow hex colors synchronized with CSS `--status-*` design tokens. */
const STATUS_GLOW_HEX: Record<HealthStatus, string> = {
  green: '#327b58',
  amber: '#b9781e',
  red: '#b62a37',
  unknown: '#6e6f73',
};

interface Body3DProps {
  zones: Record<BodyZoneId, ZoneSummary>;
  selected: BodyZoneId | null;
  onSelect: (zone: BodyZoneId) => void;
  onHover?: (zone: BodyZoneId | null) => void;
  heartRate?: number;
  className?: string;
}

/**
 * Interactive 3D astronaut anatomical canvas with emissive per-zone status glow,
 * orbit controls, and resettable camera framing.
 */
export default function Body3D(props: Body3DProps) {
  const [resetNonce, setResetNonce] = useState(0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setResetNonce((n) => n + 1)}
        className="twin-btn twin-btn-ghost absolute bottom-3 right-3 z-10 h-8 bg-canvas/60 px-2.5 text-xs backdrop-blur-md"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Reset view
      </button>

      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-lg bg-canvas/60 px-2.5 py-1.5 text-[11px] text-stem backdrop-blur-md">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-status-nominal" /> Nominal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-status-caution" /> Watch
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-status-critical" /> Critical
        </span>
      </div>

      <Canvas
        camera={{ position: [0, 1.0, 2.6], fov: 35, near: 0.01, far: 20 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        className={`${props.className ?? '!h-[520px] sm:!h-[600px]'} w-full touch-none`}
        aria-label="3D astronaut anatomical body model"
      >
        <hemisphereLight args={['#e5ebf7', '#1a2130', 1.15]} />
        <directionalLight position={[2, 3, 2]} intensity={1.45} />
        <directionalLight position={[-2, 1, -2]} intensity={0.85} color="#8da2cf" />
        <Suspense
          fallback={
            <Html center className="whitespace-nowrap text-sm font-medium text-stem">
              Loading anatomical model…
            </Html>
          }
        >
          <Anatomy {...props} resetNonce={resetNonce} />
        </Suspense>
      </Canvas>
    </div>
  );
}

function Anatomy({ zones, selected, onSelect, onHover, heartRate, resetNonce }: Body3DProps & { resetNonce: number }) {
  const { scene } = useGLTF(MODEL_URL);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  const parts = useMemo(() => {
    const map: Record<string, THREE.Mesh> = {};
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const name = Object.keys(PART_ZONE).find((k) => o.name === k || o.parent?.name === k);
      if (!name) return;
      const isSkin = name === 'skin';
      if (!o.geometry.getAttribute('normal')) o.geometry.computeVertexNormals();
      o.material = new THREE.MeshStandardMaterial({
        color: PART_COLOR[name],
        roughness: isSkin ? 0.55 : 0.45,
        metalness: 0,
        transparent: true,
        opacity: isSkin ? 0.22 : 1,
        depthWrite: !isSkin,
        side: isSkin ? THREE.FrontSide : THREE.DoubleSide,
      });
      o.userData.part = name;
      o.userData.baseScale = o.scale.clone();
      map[name] = o;
    });
    return map;
  }, [scene]);

  const goal = useMemo(() => {
    scene.updateMatrixWorld(true);
    const target = selected ? parts[ZONE_FOCUS_PART[selected]] : parts.skin;
    const box = new THREE.Box3().setFromObject(target ?? scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = Math.max(size * (selected ? 2.6 : 1.8), 0.35);
    return { center, position: center.clone().add(new THREE.Vector3(0, size * 0.05, dist)) };
  }, [selected, parts, scene]);

  const animating = useRef(true);
  useEffect(() => {
    animating.current = true;
  }, [goal, resetNonce]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const k = 1 - Math.exp(-delta * 4);

    if (animating.current && controls.current) {
      camera.position.lerp(goal.position, k);
      controls.current.target.lerp(goal.center, k);
      controls.current.update();
      if (camera.position.distanceTo(goal.position) < 0.005) animating.current = false;
    }

    for (const [name, mesh] of Object.entries(parts)) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const zone = PART_ZONE[name];
      const status = zone ? zones[zone].status : 'unknown';
      const inFocus = !selected || zone === selected || (selected === 'sleep' && zone === 'brain');
      const baseOpacity =
        name === 'skin'
          ? selected ? 0.04 : 0.16
          : !inFocus
            ? 0.08
            : name === 'skeleton' && selected !== 'bones'
              ? 0.32
              : name === 'pleura'
                ? 0.38
                : 1;
      mat.opacity += (baseOpacity - mat.opacity) * k;
      mat.depthWrite = mat.opacity > 0.9;

      const glow = status === 'red' ? 0.32 + 0.22 * Math.sin(t * 4) : status === 'amber' ? 0.26 : 0.05;
      mat.emissive.set(STATUS_GLOW_HEX[status]);
      mat.emissiveIntensity = zone && inFocus ? glow : 0;
    }

    const heart = parts.heart;
    if (heart) {
      const period = 60 / (heartRate || 70);
      const phase = (t % period) / period;
      const s = 1 + (phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) * 0.05 : 0);
      heart.scale.copy(heart.userData.baseScale).multiplyScalar(s);
    }
    const b = Math.sin(t * 1.4);
    for (const name of ['lungs', 'pleura']) {
      const m = parts[name];
      if (m) m.scale.copy(m.userData.baseScale).multiply(new THREE.Vector3(1 + b * 0.012, 1 + b * 0.02, 1));
    }
  });

  const pickZone = (e: ThreeEvent<MouseEvent | PointerEvent>): BodyZoneId | null => {
    let best: string | null = null;
    let touchedSkin = false;
    for (const hit of e.intersections) {
      const part = hit.object.userData.part as string | undefined;
      if (part === 'skin') touchedSkin = true;
      if (part && PART_ZONE[part] && (!best || PICK_PRIORITY[part] > PICK_PRIORITY[best])) best = part;
    }
    if (best) return PART_ZONE[best];
    return touchedSkin ? 'bones' : null;
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    const zone = pickZone(e);
    if (zone) onSelect(zone);
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const zone = pickZone(e);
    document.body.style.cursor = zone ? 'pointer' : '';
    onHover?.(zone);
  };

  return (
    <>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerMove={handleMove}
        onPointerOut={() => {
          document.body.style.cursor = '';
          onHover?.(null);
        }}
      />
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={0.2}
        maxDistance={4}
        onStart={() => (animating.current = false)}
      />
    </>
  );
}

useGLTF.preload(MODEL_URL);

