// Vista cercana del modo embebido: cámara de persecución (detrás de la nave, mirando al
// cuerpo que orbita) y una estela corta, como la de un avión. Módulo puro (sin DOM ni Three.js).
import { phaseIndexAt } from "./tour.js";

/** Largo de la estela (s de vuelo hacia atrás) en cada fase. */
export const TRAIL_SECONDS = {
  ascent: 240,
  parking: 1500,
  leo: 2700,
  heo: 6 * 3600,
  transit: 6 * 3600,
  outbound: 12 * 3600,
  cruise: 14 * 86400,
  flyby: 6 * 3600,
  gravity_assist: 5 * 86400,
  lunar_orbit: 4 * 3600,
  nrho: 12 * 3600,
  approach: 2 * 86400,
  descent: 1500,
  edl: 1200,
  landing: 300,
  return: 12 * 3600,
  perihelion: 5 * 86400,
};
const DEFAULT_TRAIL = 1800;

/** Esfera de influencia lunar aproximada (km): dentro, la cámara sigue a la Luna. */
export const MOON_SOI_KM = 66000;
/** Radio máximo alrededor de la Tierra para centrar en la Tierra; más allá se centra en la nave. */
export const EARTH_CHASE_MAX_KM = 85000;

/** Ventana [t0, t] de la estela: solo hacia atrás. */
export function trailWindow(phases, t) {
  const tail = TRAIL_SECONDS[phases[phaseIndexAt(phases, t)].id] ?? DEFAULT_TRAIL;
  return [Math.max(0, t - tail), t];
}

/** Brillo de la estela: tenue y desvaneciéndose hacia atrás. 0 = fuera de la ventana. */
export function trailFade(ti, t, [t0, t1]) {
  if (ti < t0 || ti > t1) return 0;
  if (t <= t0) return 0.55;
  return 0.55 * ((ti - t0) / (t - t0)) ** 1.5;
}

/** Cuerpo que la nave orbita: planeta destino cercano, Luna, Tierra cercana, o la propia nave en espacio profundo. */
export function nearestBody(shipEci, moonEci, extraBodiesAtT = []) {
  for (const b of extraBodiesAtT) {
    const d = Math.hypot(shipEci[0] - b.pos[0], shipEci[1] - b.pos[1], shipEci[2] - b.pos[2]);
    const chaseLimit = b.chase_km ?? b.radius_km * 30;
    if (d < chaseLimit) return { focus: b.id, frame: "eci", radius_km: b.radius_km };
  }
  const dMoon = Math.hypot(shipEci[0] - moonEci[0], shipEci[1] - moonEci[1], shipEci[2] - moonEci[2]);
  if (dMoon < MOON_SOI_KM) return { focus: "moon", frame: "moon", radius_km: 1737.4 };
  const dEarth = Math.hypot(shipEci[0], shipEci[1], shipEci[2]);
  if (dEarth < EARTH_CHASE_MAX_KM) return { focus: "earth", frame: "eci", radius_km: 6371 };
  return { focus: "ship", frame: "eci", radius_km: 0 };
}

/** Fracción de media pantalla que ocupa el radio del cuerpo en la toma. */
export const BODY_SHARE = 0.45;
/** Dónde queda la nave: fracción de media pantalla por encima del centro del cuerpo. */
export const SHIP_OFFSET = 0.4;
const FOV_MIN = 1.5;
const FOV_MAX = 40;

/**
 * Cámara de persecución. `rel` = posición de la nave respecto al cuerpo (km, en el marco
 * de vista). Devuelve la posición de cámara respecto al cuerpo (km) y el campo de visión
 * (grados): el cuerpo ocupa ~BODY_SHARE de la pantalla y la nave queda delante, un poco
 * por encima del centro, con su estela.
 */
export function chaseCamera(rel, radiusKm) {
  const d = Math.hypot(rel[0], rel[1], rel[2]) || radiusKm;
  const u = rel.map((x) => x / d);
  const dist = Math.max(1.25 * d, 3.2 * radiusKm);
  const half = Math.min(Math.max(Math.atan(radiusKm / dist / BODY_SHARE), (FOV_MIN / 2) * (Math.PI / 180)), (FOV_MAX / 2) * (Math.PI / 180));
  // Desplazamiento lateral proporcional al zoom: la nave se ve a SHIP_OFFSET del centro
  const gap = dist - d;
  const lateral = gap * Math.tan(half) * SHIP_OFFSET;
  const up = [-u[0] * u[2], -u[1] * u[2], 1 - u[2] * u[2]];
  const upLen = Math.hypot(...up);
  const w = upLen > 1e-6 ? up.map((x) => x / upLen) : [1, 0, 0];
  return {
    position: u.map((x, i) => x * dist - w[i] * lateral),
    fov: 2 * half * (180 / Math.PI),
  };
}
