// Contenido narrativo de la misión: vehículos, ciencia por fase, tarjetas de evento y
// presupuesto de Δv. Módulo puro. RESULTS copia docs/figures/results.json; tests/story.test.mjs
// falla si las dos fuentes se separan.

import { SUNLIT } from "./tour.js";

export const RESULTS = {
  dv_insertion_ms: 1200.4742863813735,
  dv_tli_ms: 3246.700784983657,
  dv_opf_ms: 291.3410215896104,
  dv_nri_ms: 172.34603111055455,
  dv_doi_ms: 701.6533740151943,
  dv_powered_ms: 2297.21691785107,
  touchdown_speed_ms: 1.0030018378838763,
  landing_error_m: 0.013516691062196726,
  hls_mass_landed_t: 154.4375295363584,
  mission_days: 16.231407385648602,
  site_lat_deg: -86.8,
};

/** Multiplicador del modo Auto: cada fase dura unos 20–35 s de reproducción. */
export const AUTO_RATE = {
  ascent: 20,
  parking: 300,
  leo: 120,
  heo: 1800,
  transit: 15000,
  outbound: 15000,
  cruise: 400000,
  flyby: 3600,
  gravity_assist: 86400,
  lunar_orbit: 300,
  nrho: 40000,
  approach: 86400,
  descent: 300,
  edl: 20,
  landing: 20,
  return: 15000,
  perihelion: 86400,
};

export const PHASE_INFO = {
  ascent: {
    short: "Ascent",
    physics: "Thrust, drag with Cd(Mach), and variable mass over a rotating Earth.",
    method: "Dormand–Prince RK45 with events",
    result: "Max-Q 29.6 kPa · MECO at 160 km",
  },
  parking: {
    short: "Parking Orbit",
    physics: "Low Earth orbit while waiting for the trans-lunar injection window.",
    method: "Velocity Verlet (symplectic)",
    result: "Inclination 29.8° · TLI at 2.33 h",
  },
  leo: {
    short: "LEO",
    physics: "Nearly circular low Earth orbit under Keplerian gravity.",
    method: "Universal Kepler propagation",
    result: "Altitude ~418 km · 51.6° · 7.66 km/s",
  },
  heo: {
    short: "HEO",
    physics: "Highly elliptical Earth orbit for systems checkout.",
    method: "Universal Kepler propagation",
    result: "Apogee ~70,000 km before TLI",
  },
  transit: {
    short: "Transit",
    physics: "Restricted three-body problem with a powered lunar flyby.",
    method: "Multiple shooting + SLSQP",
    result: "Flyby at 1,340 km · 55.7% of Orion Δv",
  },
  outbound: {
    short: "Lunar Transit",
    physics: "Trans-lunar trajectory toward the Moon's sphere of influence.",
    method: "Universal Kepler + lunar ephemerides",
    result: "Direct cislunar transfer",
  },
  cruise: {
    short: "Interplanetary Cruise",
    physics: "Heliocentric transfer orbit under solar gravity.",
    method: "Lambert problem + universal Kepler",
    result: "JPL ephemerides (Standish)",
  },
  flyby: {
    short: "Flyby",
    physics: "Gravitational deflection and free-return trajectory around the Moon.",
    method: "Universal Kepler",
    result: "Lunar far-side pass",
  },
  gravity_assist: {
    short: "Gravity Assist",
    physics: "Planetary encounter modifying heliocentric energy and angular momentum.",
    method: "Multi-leg Lambert + JPL ephemerides",
    result: "Propellant-free gravitational boost",
  },
  lunar_orbit: {
    short: "Lunar Orbit",
    physics: "Selenocentric polar mapping orbit around the Moon.",
    method: "Selenocentric universal Kepler",
    result: "Low polar orbit (~50 km)",
  },
  nrho: {
    short: "NRHO",
    physics: "Periodic halo orbit near L2 in the CR3BP, using the state transition matrix.",
    method: "Differential correction + continuation",
    result: "9:2 NRHO · 6.56 d period · perilune 3,248 km",
  },
  approach: {
    short: "Approach",
    physics: "Terminal approach phase toward the target planet.",
    method: "Lambert + JPL ephemerides",
    result: "Entry / capture corridor",
  },
  descent: {
    short: "HLS Orbit",
    physics: "Ellipse down to 15 km altitude under degree-100 GRGM1200A lunar gravity (mascons).",
    method: "DOP853 with events",
    result: "DOI 702 m/s · 1.59 h coast",
  },
  edl: {
    short: "EDL",
    physics: "Atmospheric entry, descent, and landing on the Martian surface.",
    method: "Entry profile 125 km → 0 km",
    result: "Touchdown in Jezero Crater",
  },
  landing: {
    short: "Descent",
    physics: "Powered descent with variable mass in the Moon-fixed frame.",
    method: "DOP853 + E-guidance",
    result: "Touchdown at 1.0 m/s within 1.4 cm of target",
  },
  return: {
    short: "Return",
    physics: "Free-return trajectory toward Earth's atmospheric interface.",
    method: "Universal Kepler",
    result: "Earth re-entry",
  },
  perihelion: {
    short: "Perihelion",
    physics: "Closest solar approach after Venus gravity assist.",
    method: "Lambert + heliocentric Kepler",
    result: "24.8 million km from the Sun",
  },
};

/** Vehículo activo, por hora de misión. `until` usa los eventos reales de separación. */
export function vehicleAt(t, events) {
  const at = (re) => events.find((e) => re.test(e.label))?.t ?? Infinity;
  if (t < at(/SRB/)) return { id: "sls", name: "SLS Block 1B + Orion" };
  if (t < at(/MECO/)) return { id: "core", name: "Core Stage + EUS + Orion" };
  if (t < at(/TLI/)) return { id: "eus", name: "EUS + Orion" };
  if (t < at(/DOI/)) return { id: "orion", name: "Orion" };
  return { id: "hls", name: "HLS (Lunar Lander)" };
}

const SHIP = { frame: "eci", focus: "ship" };
const LANDING = { frame: "moon", focus: "ship", view: "horizon" };

const EVENT_INFO = [
  [/Max-Q/, { short: "Max-Q", text: "Maximum dynamic pressure: 29.6 kPa — peak aerodynamic load on the launch vehicle.", shot: { ...SHIP, distance: 1.6, view: "horizon" } }],
  [/SRB/, { short: "SRB", text: "Both solid rocket boosters exhaust propellant and separate, dropping vehicle mass abruptly.", shot: { ...SHIP, distance: 1.6, view: "horizon" } }],
  [/MECO|Inserción en órbita/, { short: "MECO", text: "Core stage cutoff completes and the EUS inserts Orion into parking orbit.", dv: "dv_insertion_ms", shot: { frame: "eci", focus: "earth", distance: 22, dir: SUNLIT } }],
  [/TLI/, { short: "TLI", text: "EUS propels Orion toward the Moon and separates. From here, Orion flies solo.", dv: "dv_tli_ms", shot: { frame: "eci", focus: "earth", distance: 60, dir: SUNLIT } }],
  [/OPF/, { short: "OPF", text: "Orion fires its main engine 1,340 km above the Moon, using lunar gravity to reach NRHO.", dv: "dv_opf_ms", shot: { frame: "rot", focus: "moon", distance: 30 } }],
  [/NRI/, { short: "NRI", text: "Orion brakes into Gateway's orbit, a 9:2 NRHO synchronized with the Moon.", dv: "dv_nri_ms", shot: { frame: "rot", focus: "moon", distance: 170, dir: [0.92, -0.38, 0.08] } }],
  [/DOI/, { short: "DOI", text: "HLS departs NRHO shortly before perilune into an ellipse dropping to 15 km. Displayed mass switches to HLS.", dv: "dv_doi_ms", shot: { frame: "moon", focus: "moon", distance: 9, dir: [0.8, -0.45, -0.4] } }],
  [/PDI/, { short: "PDI", text: "Powered descent begins with E-guidance: 700 s burn at up to 87% thrust.", dv: "dv_powered_ms", shot: { ...LANDING, distance: 0.8 } }],
  [/High gate/, { short: "High gate", text: "Braking phase ends and terminal approach to the landing site begins.", shot: { ...LANDING, distance: 0.45 } }],
  [/Low gate/, { short: "Low gate", text: "At 100 m above the site, vertical descent begins, terminating at 1 m/s.", shot: { ...LANDING, distance: 0.45 } }],
  [/Alunizaje/, { short: "Touchdown", text: "Surface touchdown in the lunar south polar region.", shot: { ...LANDING, distance: 0.45 } }],
];

export function eventInfo(label) {
  return EVENT_INFO.find(([re]) => re.test(label))?.[1] ?? { short: label, text: "", shot: null };
}

/** Maniobras del presupuesto de Δv, en orden; `end` indica un encendido largo. */
export function dvBudget(events) {
  const at = (re) => events.find((e) => re.test(e.label))?.t ?? Infinity;
  return [
    { name: "Insertion", dv: RESULTS.dv_insertion_ms, t: at(/Inserción en órbita/) },
    { name: "TLI", dv: RESULTS.dv_tli_ms, t: at(/TLI/) },
    { name: "OPF", dv: RESULTS.dv_opf_ms, t: at(/OPF/) },
    { name: "NRI", dv: RESULTS.dv_nri_ms, t: at(/NRI/) },
    { name: "DOI", dv: RESULTS.dv_doi_ms, t: at(/DOI/) },
    { name: "Descent", dv: RESULTS.dv_powered_ms, t: at(/PDI/), end: at(/Alunizaje/) },
  ];
}

/** Δv gastado hasta t (m/s): los impulsos cuentan enteros y el descenso crece linealmente. */
export function dvSpent(budget, t) {
  return budget.reduce((sum, b) => {
    if (t < b.t) return sum;
    return sum + (b.end ? b.dv * Math.min((t - b.t) / (b.end - b.t), 1) : b.dv);
  }, 0);
}
