'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { AstronautTelemetryFrame } from '../domain/types';

/**
 * Sujeto sintético en 3D para el HUD de /vision cuando no se usa la webcam.
 * Sustituye la cara dibujada por el simulador y se anima con la telemetría:
 *  - pose de la cabeza (pitch / yaw / roll) → cabeceo por somnolencia
 *  - respiración (respiration_rpm) → leve escala vertical
 *  - pulso (bpm) → brillo rojo sincronizado con el latido
 *  - estrés → tinte cálido; sueño / baja alerta → luz atenuada y azulada
 */
const MODEL_URL = '/anatomy/head.glb';

const DEG = Math.PI / 180;
/** El GLB mira hacia +X; se gira para que mire a la cámara (+Z). */
const MODEL_YAW = -Math.PI / 2;

interface Props {
  telemetry: AstronautTelemetryFrame | null;
}

export default function SyntheticHead3D({ telemetry }: Props) {
  const telemetryRef = useRef<AstronautTelemetryFrame | null>(telemetry);
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  return (
    <Canvas
      camera={{ position: [0, 0.02, 2.05], fov: 32, near: 0.01, far: 20 }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      className="!h-full w-full"
      aria-label="Synthetic astronaut 3D head"
    >
      <Lights telemetryRef={telemetryRef} />
      <Suspense
        fallback={
          <Html center className="whitespace-nowrap font-mono text-[11px] text-slate-400">
            Loading synthetic subject…
          </Html>
        }
      >
        <Head telemetryRef={telemetryRef} />
      </Suspense>
    </Canvas>
  );
}

type TelemetryRef = React.MutableRefObject<AstronautTelemetryFrame | null>;

function Lights({ telemetryRef }: { telemetryRef: TelemetryRef }) {
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const cool = useMemo(() => new THREE.Color('#6d8fd6'), []);
  const white = useMemo(() => new THREE.Color('#ffffff'), []);

  useFrame((_, dt) => {
    const t = telemetryRef.current;
    const sleeping = t?.context === 'sleep_pod';
    const alert = t ? t.mood.alertness_score / 100 : 1;
    const k = Math.min(1, dt * 2);
    const targetKey = sleeping ? 0.55 : 0.9 + alert * 0.8;
    if (key.current) {
      key.current.intensity += (targetKey - key.current.intensity) * k;
      key.current.color.lerp(sleeping ? cool : white, k);
    }
    if (hemi.current) {
      hemi.current.intensity += ((sleeping ? 0.7 : 1.25) - hemi.current.intensity) * k;
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#e5ebf7', '#1a2130', 1.25]} />
      <directionalLight ref={key} position={[1.5, 2, 2.5]} intensity={1.6} />
      <directionalLight position={[-2, 0.5, -1.5]} intensity={0.9} color="#7dd3fc" />
    </>
  );
}

function Head({ telemetryRef }: { telemetryRef: TelemetryRef }) {
  const { scene } = useGLTF(MODEL_URL);
  const group = useRef<THREE.Group>(null);
  const beatPhase = useRef(0);
  const breathPhase = useRef(0);
  const pose = useRef({ pitch: 0, yaw: 0, roll: 0 });

  // Material propio (clonado) para poder modular el emissive sin tocar la caché de useGLTF
  const { model, materials } = useMemo(() => {
    const clone = scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const src = o.material as THREE.MeshStandardMaterial;
      const m = src.clone();
      m.emissive = new THREE.Color('#ff2a2a');
      m.emissiveIntensity = 0;
      o.material = m;
      mats.push(m);
    });
    // Centrar y escalar a ~1 m de alto
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    clone.position.sub(center);
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    wrapper.scale.setScalar(1 / Math.max(size.y, 1e-6));
    wrapper.rotation.y = MODEL_YAW;
    return { model: wrapper, materials: mats };
  }, [scene]);

  useEffect(
    () => () => {
      materials.forEach((m) => m.dispose());
    },
    [materials]
  );

  const stressColor = useMemo(() => new THREE.Color('#ff6a3d'), []);
  const pulseColor = useMemo(() => new THREE.Color('#ff2a2a'), []);

  useFrame((state, dt) => {
    const t = telemetryRef.current;
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, dt * 3);

    // Pose de la cabeza: datos del simulador + vaivén idle
    const time = state.clock.elapsedTime;
    const idleYaw = Math.sin(time * 0.35) * 6;
    const tgt = {
      pitch: (t?.sleep.head_pitch_deg ?? 0) * 0.9,
      yaw: (t?.sleep.head_yaw_deg ?? 0) + idleYaw,
      roll: t?.sleep.head_roll_deg ?? 0,
    };
    pose.current.pitch += (tgt.pitch - pose.current.pitch) * k;
    pose.current.yaw += (tgt.yaw - pose.current.yaw) * k;
    pose.current.roll += (tgt.roll - pose.current.roll) * k;
    g.rotation.set(pose.current.pitch * DEG, pose.current.yaw * DEG, pose.current.roll * DEG);

    // Respiración
    const rpm = t?.heart_rate.respiration_rpm || 14;
    breathPhase.current += dt * (rpm / 60) * Math.PI * 2;
    const breath = Math.sin(breathPhase.current);
    g.scale.set(1, 1 + breath * 0.006, 1);
    g.position.y = breath * 0.006;

    // Pulso: pico agudo en cada latido (solo con rPPG calibrado)
    const bpm = t?.heart_rate.bpm ?? 0;
    let pulse = 0;
    if (bpm > 0) {
      beatPhase.current = (beatPhase.current + dt * (bpm / 60)) % 1;
      pulse = Math.pow(Math.max(0, Math.cos(beatPhase.current * Math.PI * 2)), 12);
    }

    // Estrés: tinte cálido por encima del 40 %
    const stress = t ? Math.max(0, (t.mood.stress_index - 40) / 60) : 0;
    const emissive = stress * 0.14 + pulse * 0.12;
    for (const m of materials) {
      m.emissive.copy(pulseColor).lerp(stressColor, stress);
      m.emissiveIntensity += (emissive - m.emissiveIntensity) * Math.min(1, dt * 12);
    }
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
