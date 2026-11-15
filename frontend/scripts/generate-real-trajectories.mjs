// Generates mission-viewer trajectory JSONs for real NASA missions.
//
// Sources of real data used here:
//  - Planet positions: JPL "Keplerian Elements for Approximate Positions of the Major Planets"
//    (E. M. Standish, Table 1, valid 1800–2050), heliocentric ecliptic J2000.
//  - Transfers between real event dates: Lambert's problem (universal variables, Curtis Alg. 5.2)
//    around the Sun or the Earth, propagated with universal-variable Kepler (Curtis Alg. 3.3).
//  - Mission dates and orbit figures: NASA mission pages (see MISSIONS below).
//
// Output frame: geocentric equatorial (ECI J2000), km and km/s, as the viewer expects.
// Usage: node scripts/generate-real-trajectories.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "public/mission-viewer/data");
const base = JSON.parse(fs.readFileSync(path.join(DATA, "mission.json"), "utf8"));

const MU_E = 398600.4418;
const MU_S = 1.32712440018e11;
const R_E = 6378.137;
const R_MOON = 1737.4;
const AU = 149597870.7;
const DEG = Math.PI / 180;
const DAY = 86400;
const EPS = 23.43928 * DEG; // obliquity of the ecliptic (J2000)

// ---------------------------------------------------------------- vector helpers
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / (norm(a) || 1));
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
/** Rotates v about unit axis k by angle (Rodrigues). */
const rotate = (v, k, ang) => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
};
const eclToEq = (r) => [r[0], Math.cos(EPS) * r[1] - Math.sin(EPS) * r[2], Math.sin(EPS) * r[1] + Math.cos(EPS) * r[2]];

// ---------------------------------------------------------------- Stumpff / Kepler / Lambert
function stumpS(z) {
  if (z > 1e-6) return (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.pow(z, 1.5);
  if (z < -1e-6) return (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.pow(-z, 1.5);
  return 1 / 6 - z / 120;
}
function stumpC(z) {
  if (z > 1e-6) return (1 - Math.cos(Math.sqrt(z))) / z;
  if (z < -1e-6) return (Math.cosh(Math.sqrt(-z)) - 1) / -z;
  return 1 / 2 - z / 24;
}

/** Universal-variable Kepler propagation (Curtis Alg. 3.3/3.4). */
function kepler(R0, V0, dt, mu) {
  const r0 = norm(R0);
  const v0 = norm(V0);
  const vr0 = dot(R0, V0) / r0;
  const alpha = 2 / r0 - (v0 * v0) / mu;
  const smu = Math.sqrt(mu);
  let x = smu * Math.abs(alpha) * dt;
  if (!Number.isFinite(x) || x === 0) x = (smu * dt) / r0;
  for (let i = 0; i < 200; i++) {
    const z = alpha * x * x;
    const C = stumpC(z);
    const S = stumpS(z);
    const F = ((r0 * vr0) / smu) * x * x * C + (1 - alpha * r0) * x * x * x * S + r0 * x - smu * dt;
    const dF = ((r0 * vr0) / smu) * x * (1 - alpha * x * x * S) + (1 - alpha * r0) * x * x * C + r0;
    const ratio = F / dF;
    x -= ratio;
    if (Math.abs(ratio) < 1e-9) break;
  }
  const z = alpha * x * x;
  const f = 1 - ((x * x) / r0) * stumpC(z);
  const g = dt - (x * x * x * stumpS(z)) / smu;
  const R = add(mul(R0, f), mul(V0, g));
  const r = norm(R);
  const fdot = (smu / (r * r0)) * (alpha * x * x * x * stumpS(z) - x);
  const gdot = 1 - ((x * x) / r) * stumpC(z);
  return { r: R, v: add(mul(R0, fdot), mul(V0, gdot)) };
}

/** Lambert's problem, single revolution, prograde w.r.t. hRef (Curtis Alg. 5.2). */
function lambert(R1, R2, tof, mu, hRef) {
  const r1 = norm(R1);
  const r2 = norm(R2);
  let theta = Math.acos(clamp(dot(R1, R2) / (r1 * r2), -1, 1));
  if (dot(cross(R1, R2), hRef) < 0) theta = 2 * Math.PI - theta;
  const A = Math.sin(theta) * Math.sqrt((r1 * r2) / (1 - Math.cos(theta)));
  const y = (z) => r1 + r2 + (A * (z * stumpS(z) - 1)) / Math.sqrt(stumpC(z));
  const F = (z) => {
    const yz = y(z);
    if (!(yz > 0)) return NaN;
    return Math.pow(yz / stumpC(z), 1.5) * stumpS(z) + A * Math.sqrt(yz) - Math.sqrt(mu) * tof;
  };
  const Z_MAX = 4 * Math.PI * Math.PI - 1e-6;
  let lo = 0;
  let hi = Z_MAX;
  const y0 = y(0);
  const f0 = F(0);
  if (y0 > 0 && f0 >= 0) {
    // Hyperbolic or parabolic transfer (z <= 0)
    hi = 0;
    lo = -1;
    for (let k = 0; k < 60 && y(lo) > 0 && F(lo) > 0; k++) lo *= 2;
    if (!(y(lo) > 0)) {
      let a = lo, b = 0;
      for (let k = 0; k < 80; k++) {
        const m = (a + b) / 2;
        if (y(m) > 0) b = m;
        else a = m;
      }
      lo = b;
    }
  } else if (!(y0 > 0)) {
    // Find starting point where y(z) > 0
    if (A > 0) {
      let a = 0, b = Z_MAX;
      for (let k = 0; k < 80; k++) {
        const m = (a + b) / 2;
        if (y(m) > 0) b = m;
        else a = m;
      }
      lo = b;
      hi = Z_MAX;
    } else {
      lo = -1;
      for (let k = 0; k < 60 && !(y(lo) > 0); k++) lo *= 2;
      hi = 0;
      while (lo > -1e6 && F(lo) > 0) lo *= 2;
    }
  }
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const f = F(mid);
    if (Number.isNaN(f) || f < 0) lo = mid;
    else hi = mid;
  }
  const z = (lo + hi) / 2;
  const yz = y(z);
  const f = 1 - yz / r1;
  const g = A * Math.sqrt(yz / mu);
  const gdot = 1 - yz / r2;
  return { v1: mul(sub(R2, mul(R1, f)), 1 / g), v2: mul(sub(mul(R2, gdot), R1), 1 / g) };
}

// ---------------------------------------------------------------- JPL approximate ephemerides
// a [AU], e, I [deg], L [deg], long.peri [deg], long.node [deg]; second row = rates per century.
const ELEMENTS = {
  venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ],
  earth: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  ],
  mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
};

const jdOf = (iso) => Date.parse(iso) / 86400000 + 2440587.5;

function planetPos(id, jd) {
  const [e0, e1] = ELEMENTS[id];
  const T = (jd - 2451545.0) / 36525;
  const [a, e, I, L, wbar, node] = e0.map((x, i) => x + e1[i] * T);
  const w = (wbar - node) * DEG;
  const O = node * DEG;
  const inc = I * DEG;
  let M = ((L - wbar) % 360) * DEG;
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cO = Math.cos(O);
  const sO = Math.sin(O);
  const cI = Math.cos(inc);
  const sI = Math.sin(inc);
  return mul(
    [
      (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
      (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
      sw * sI * xp + cw * sI * yp,
    ],
    AU
  );
}
function planetState(id, jd) {
  const h = 60 / DAY;
  const r = planetPos(id, jd);
  const v = mul(sub(planetPos(id, jd + h), planetPos(id, jd - h)), 1 / (2 * 60));
  return { r, v };
}

// ---------------------------------------------------------------- Moon model used by the viewer
const MOON = base.bodies.moon;
const moonBasis = (() => {
  const ci = Math.cos(MOON.inclination_rad);
  const si = Math.sin(MOON.inclination_rad);
  const co = Math.cos(MOON.raan_rad);
  const so = Math.sin(MOON.raan_rad);
  return { p: [co, so, 0], q: [-so * ci, co * ci, si], h: [so * si, -co * si, ci] };
})();
function moonPos(t) {
  const th = MOON.mean_motion_rad_s * t + MOON.phase0_rad;
  return mul(add(mul(moonBasis.p, Math.cos(th)), mul(moonBasis.q, Math.sin(th))), MOON.orbit_radius_km);
}
function moonVel(t) {
  const th = MOON.mean_motion_rad_s * t + MOON.phase0_rad;
  return mul(
    add(mul(moonBasis.p, -Math.sin(th)), mul(moonBasis.q, Math.cos(th))),
    MOON.orbit_radius_km * MOON.mean_motion_rad_s
  );
}

// ---------------------------------------------------------------- sampling helpers
function propagateLeg(r0, v0, t0, t1, mu, dtFn) {
  const out = [];
  let t = t0;
  let r = r0;
  let v = v0;
  while (t < t1 - 1e-6) {
    const dt = Math.min(dtFn(t, r, v), t1 - t);
    ({ r, v } = kepler(r, v, dt, mu));
    t += dt;
    out.push({ t, r, v });
  }
  return out;
}

const round = (x, d) => Number(x.toFixed(d));
function sunTrack(ts, jd0) {
  const st = ts.map((t) => {
    const E = planetState("earth", jd0 + t / DAY);
    return { r: eclToEq(mul(E.r, -1)), v: eclToEq(mul(E.v, -1)) };
  });
  return packTrack(st);
}
function planetTrack(id, ts, jd0) {
  const st = ts.map((t) => {
    const jd = jd0 + t / DAY;
    const E = planetState("earth", jd);
    const P = planetState(id, jd);
    return { r: eclToEq(sub(P.r, E.r)), v: eclToEq(sub(P.v, E.v)) };
  });
  return packTrack(st);
}
function packTrack(st) {
  return {
    x: st.map((s) => round(s.r[0], 1)),
    y: st.map((s) => round(s.r[1], 1)),
    z: st.map((s) => round(s.r[2], 1)),
    vx: st.map((s) => round(s.v[0], 5)),
    vy: st.map((s) => round(s.v[1], 5)),
    vz: st.map((s) => round(s.v[2], 5)),
  };
}

const BODY_INFO = {
  sun: { name: "Sun", kind: "star", radius_km: 695700, chase_km: 695700 * 45, color: "#ffd27a" },
  venus: { name: "Venus", kind: "planet", radius_km: 6051.8, chase_km: 6051.8 * 60, color: "#e8cf8f" },
  mars: { name: "Mars", kind: "planet", radius_km: 3389.5, chase_km: 3389.5 * 60, color: "#e07a4f" },
  jupiter: { name: "Jupiter", kind: "planet", radius_km: 69911, chase_km: 69911 * 30, color: "#d9b38c" },
};

function assemble({ meta, states, phases, events, extraIds, jd0, waypoints, mass_t }) {
  // Drop duplicated instants (leg joints) keeping the first one.
  const clean = [];
  for (const s of states) if (!clean.length || s.t > clean.at(-1).t + 1e-6) clean.push(s);
  const ts = clean.map((s) => s.t);
  const phaseIndex = (t) => {
    const i = phases.findIndex((p) => t <= p.t_end + 1e-6);
    return i < 0 ? phases.length - 1 : i;
  };
  const extra = extraIds.map((id) => ({
    id,
    ...BODY_INFO[id],
    track: id === "sun" ? sunTrack(ts, jd0) : planetTrack(id, ts, jd0),
  }));
  return {
    schema_version: 1,
    generated_utc: new Date().toISOString(),
    generator: "scripts/generate-real-trajectories.mjs (JPL approximate ephemerides + Lambert)",
    ...meta,
    units: base.units,
    frame: base.frame,
    bodies: { earth: base.bodies.earth, moon: base.bodies.moon, extra },
    waypoints,
    phases: phases.map((p) => ({
      ...p,
      t_start: round(p.t_start, 3),
      t_end: round(p.t_end, 3),
      playback_rate: p.playback_rate ?? Math.max(10, Math.round((p.t_end - p.t_start) / 20)),
    })),
    events: events.map((e) => ({ ...e, t: round(e.t, 3) })),
    samples: {
      t: ts.map((t) => round(t, 3)),
      x: clean.map((s) => round(s.r[0], 3)),
      y: clean.map((s) => round(s.r[1], 3)),
      z: clean.map((s) => round(s.r[2], 3)),
      vx: clean.map((s) => round(s.v[0], 6)),
      vy: clean.map((s) => round(s.v[1], 6)),
      vz: clean.map((s) => round(s.v[2], 6)),
      m: clean.map(() => mass_t),
      phase_index: ts.map(phaseIndex),
    },
    checkpoints: phases.map((p) => ({ t: round(p.t_start, 3), label: p.name })),
  };
}

// ---------------------------------------------------------------- geocentric step size
function geoDt(t, r, v) {
  const m = sub(r, moonPos(t));
  const vm = sub(v, moonVel(t));
  const lim = Math.min(norm(r) / norm(v), norm(m) / (norm(vm) || 1));
  return clamp(0.02 * lim, 2, 3 * 3600);
}

// ================================================================ MISSIONS
// 1) Artemis II — crewed lunar free-return (NASA): launch 2026-04-01 on SLS Block 1 with
//    Orion "Integrity"; high Earth orbit 192 × 70,174 km; far-side lunar flyby at 6,545 km
//    altitude; mission duration 9 d 1 h 32 m 15 s; Pacific splashdown 2026-04-11.
function artemisII() {
  const epoch = "2026-04-01T22:35:00Z";
  const { h } = moonBasis;
  const rp = R_E + 192;
  const ra = R_E + 70174;
  const a = (rp + ra) / 2;
  const e = (ra - rp) / (ra + rp);
  const n = Math.sqrt(MU_E / a ** 3);
  const tTLI = (2 * Math.PI) / n; // one revolution of the checkout orbit
  const tFB = 5 * DAY + 0.5 * 3600;
  const tEnd = 9 * DAY + 3600 + 32 * 60 + 15;

  const M = moonPos(tFB);
  const Fdir = unit(M);
  const F = add(M, mul(Fdir, R_MOON + 6545));
  const Pdir = rotate(Fdir, h, -172 * DEG);
  const Tdir = cross(h, Pdir);
  const P = mul(Pdir, rp);

  const states = [];
  const NE = 360;
  for (let i = 0; i <= NE; i++) {
    const E = (i / NE) * 2 * Math.PI;
    const t = (E - e * Math.sin(E)) / n;
    const r = add(mul(Pdir, a * (Math.cos(E) - e)), mul(Tdir, a * Math.sqrt(1 - e * e) * Math.sin(E)));
    const k = (n * a) / (1 - e * Math.cos(E));
    const v = add(mul(Pdir, -k * Math.sin(E)), mul(Tdir, k * Math.sqrt(1 - e * e) * Math.cos(E)));
    states.push({ t: i === NE ? tTLI : t, r: i === NE ? P : r, v });
  }
  const out = lambert(P, F, tFB - tTLI, MU_E, h);
  states.push(...propagateLeg(P, out.v1, tTLI, tFB, MU_E, geoDt));
  const Edir = rotate(Fdir, h, 162 * DEG);
  const back = lambert(F, mul(Edir, R_E + 122), tEnd - tFB, MU_E, h);
  states.push(...propagateLeg(F, back.v1, tFB, tEnd, MU_E, geoDt));

  const fb0 = tFB - 14 * 3600;
  const fb1 = tFB + 14 * 3600;
  return assemble({
    meta: {
      mission_name: "Artemis II",
      epoch_utc: epoch,
      vehicle: "orion",
      launch_site: { name: "LC-39B" },
    },
    jd0: jdOf(epoch),
    mass_t: 26.5,
    states,
    extraIds: ["sun"],
    waypoints: [
      { t: 0, body: "moon" },
      { t: tFB, body: "earth" },
    ],
    phases: [
      { id: "heo", name: "High Earth Orbit Checkout (192 × 70,174 km)", t_start: 0, t_end: tTLI, trail_s: 6 * 3600 },
      { id: "outbound", name: "Trans-Lunar Coast", t_start: tTLI, t_end: fb0, trail_s: 10 * 3600 },
      { id: "flyby", name: "Lunar Far-Side Flyby (6,545 km)", t_start: fb0, t_end: fb1, trail_s: 4 * 3600 },
      { id: "return", name: "Free-Return Coast & Entry", t_start: fb1, t_end: tEnd, trail_s: 10 * 3600 },
    ],
    events: [
      { t: 0, label: "Orion Orbit Insertion · SLS Block 1" },
      { t: tTLI, label: "Trans-Lunar Injection" },
      { t: tFB, label: "Lunar Closest Approach · 6,545 km" },
      { t: tEnd, label: "Entry Interface · Pacific Splashdown" },
    ],
  });
}

// 2) International Space Station — continuously crewed since 2000-11-02 (Expedition 1 docking).
//    Orbit ≈ 415 km altitude, 51.64° inclination, ≈ 92.9 min period, ≈ 7.66 km/s.
function iss() {
  const epoch = "2000-11-02T09:21:00Z";
  const a = R_E + 415;
  const inc = 51.64 * DEG;
  const w = Math.sqrt(MU_E / a ** 3);
  const period = (2 * Math.PI) / w;
  const revs = 16;
  const tEnd = revs * period;
  const N = [1, 0, 0];
  const W = [0, Math.cos(inc), Math.sin(inc)];
  const states = [];
  const per = 72;
  for (let i = 0; i <= revs * per; i++) {
    const t = (i / (revs * per)) * tEnd;
    const u = w * t;
    states.push({
      t,
      r: mul(add(mul(N, Math.cos(u)), mul(W, Math.sin(u))), a),
      v: mul(add(mul(N, -Math.sin(u)), mul(W, Math.cos(u))), a * w),
    });
  }
  return assemble({
    meta: {
      mission_name: "International Space Station",
      epoch_utc: epoch,
      vehicle: "iss",
      launch_site: { name: "Baikonur / KSC" },
      periodic_from_s: 0,
    },
    jd0: jdOf(epoch),
    mass_t: 420,
    states,
    extraIds: ["sun"],
    waypoints: [{ t: 0, body: "earth" }],
    phases: [
      {
        id: "leo",
        name: "Low Earth Orbit · 415 km · 51.64°",
        t_start: 0,
        t_end: tEnd,
        trail_s: period * 0.6,
        playback_rate: 120,
      },
    ],
    events: [{ t: 0, label: "Orbit · 92.9 min period · 7.66 km/s" }],
  });
}

// 3) Lunar Reconnaissance Orbiter — launched 2009-06-18 21:32 UTC on Atlas V 401 (with LCROSS);
//    lunar orbit insertion 2009-06-23 09:47 UTC; 50 km circular polar mapping orbit (~113 min).
function lro() {
  const epoch = "2009-06-18T21:32:00Z";
  const { h } = moonBasis;
  const tLOI = (Date.parse("2009-06-23T09:47:00Z") - Date.parse(epoch)) / 1000;
  const rL = R_MOON + 50;
  const w = Math.sqrt(4902.800066 / rL ** 3);
  const period = (2 * Math.PI) / w;
  const revs = 12;
  const tEnd = tLOI + revs * period;
  const M = moonPos(tLOI);
  const s = unit(M);
  const A = add(M, mul(s, rL));
  const Pdir = rotate(s, h, -174 * DEG);
  const P = mul(Pdir, R_E + 200);
  const out = lambert(P, A, tLOI, MU_E, h);
  const states = [{ t: 0, r: P, v: out.v1 }];
  states.push(...propagateLeg(P, out.v1, 0, tLOI, MU_E, geoDt));
  states.pop();
  const per = 72;
  for (let i = 0; i <= revs * per; i++) {
    const t = tLOI + (i / (revs * per)) * (revs * period);
    const u = w * (t - tLOI);
    states.push({
      t,
      r: add(moonPos(t), mul(add(mul(s, Math.cos(u)), mul(h, Math.sin(u))), rL)),
      v: add(moonVel(t), mul(add(mul(s, -Math.sin(u)), mul(h, Math.cos(u))), rL * w)),
    });
  }
  return assemble({
    meta: {
      mission_name: "Lunar Reconnaissance Orbiter",
      epoch_utc: epoch,
      vehicle: "lro",
      launch_site: { name: "SLC-41" },
      periodic_from_s: round(tLOI, 3),
    },
    jd0: jdOf(epoch),
    mass_t: 1.916,
    states,
    extraIds: ["sun"],
    waypoints: [{ t: 0, body: "moon" }],
    phases: [
      { id: "outbound", name: "Trans-Lunar Cruise (Atlas V 401)", t_start: 0, t_end: tLOI, trail_s: 10 * 3600 },
      {
        id: "lunar_orbit",
        name: "50 km Polar Mapping Orbit",
        t_start: tLOI,
        t_end: tEnd,
        trail_s: period * 0.6,
        playback_rate: 150,
      },
    ],
    events: [
      { t: 0, label: "Launch · Atlas V 401 (with LCROSS)" },
      { t: tLOI, label: "Lunar Orbit Insertion" },
    ],
  });
}

// ---------------------------------------------------------------- heliocentric legs
function helioDt(jd0, nearIds) {
  return (t, r, v) => {
    const jd = jd0 + t / DAY;
    let lim = norm(r) / norm(v);
    for (const id of ["earth", ...nearIds]) {
      const P = planetState(id, jd);
      lim = Math.min(lim, norm(sub(r, P.r)) / (norm(sub(v, P.v)) || 1));
    }
    return clamp(0.025 * lim, 5, 2 * DAY);
  };
}
const ECL_N = [0, 0, 1];

/** Lambert leg to a planet, with the arrival point offset ("surface" = on the approach side, "miss" = beside). */
function legToPlanet(r1, t1, jd0, id, t2, mode, dist) {
  const P = planetState(id, jd0 + t2 / DAY);
  let target = P.r;
  let sol = lambert(r1, target, t2 - t1, MU_S, ECL_N);
  for (let k = 0; k < 3; k++) {
    const vinf = unit(sub(sol.v2, P.v));
    const off = mode === "surface" ? mul(vinf, -dist) : mul(unit(cross(ECL_N, vinf)), dist);
    target = add(P.r, off);
    sol = lambert(r1, target, t2 - t1, MU_S, ECL_N);
  }
  return { r2: target, v1: sol.v1, v2: sol.v2 };
}
/** Departure point just outside Earth along the outgoing asymptote. */
function departFromEarth(jd0, firstLeg) {
  const E = planetState("earth", jd0);
  let r1 = E.r;
  let leg = firstLeg(r1);
  for (let k = 0; k < 3; k++) {
    r1 = add(E.r, mul(unit(sub(leg.v1, E.v)), R_E + 300));
    leg = firstLeg(r1);
  }
  return { r1, leg };
}
function toGeo(jd0, helio) {
  return helio.map((s) => {
    const E = planetState("earth", jd0 + s.t / DAY);
    return { t: s.t, r: eclToEq(sub(s.r, E.r)), v: eclToEq(sub(s.v, E.v)) };
  });
}

// 4) Mars 2020 Perseverance — launch 2020-07-30 11:50 UTC, Atlas V 541 (SLC-41);
//    approach phase starts 45 days before landing; ~7 min EDL; touchdown in Jezero Crater
//    2021-02-18 20:55 UTC.
function mars2020() {
  const epoch = "2020-07-30T11:50:00Z";
  const jd0 = jdOf(epoch);
  const tLand = (Date.parse("2021-02-18T20:55:00Z") - Date.parse(epoch)) / 1000;
  const tEI = tLand - 7 * 60;
  const R_MARS = BODY_INFO.mars.radius_km;
  const { r1, leg } = departFromEarth(jd0, (r) => legToPlanet(r, 0, jd0, "mars", tEI, "surface", R_MARS + 125));
  const helio = [{ t: 0, r: r1, v: leg.v1 }, ...propagateLeg(r1, leg.v1, 0, tEI, MU_S, helioDt(jd0, ["mars"]))];
  // EDL: entry interface (125 km) to touchdown, radial altitude profile.
  const P0 = planetState("mars", jd0 + tEI / DAY);
  const down = unit(sub(helio.at(-1).r, P0.r));
  const steps = 14;
  const alt = (u) => 125 * (1 - u) ** 2;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const t = tEI + u * (tLand - tEI);
    const P = planetState("mars", jd0 + t / DAY);
    const dhdt = (-2 * 125 * (1 - u)) / (tLand - tEI);
    helio.push({ t, r: add(P.r, mul(down, R_MARS + alt(u))), v: add(P.v, mul(down, dhdt)) });
  }
  const tApp = tLand - 45 * DAY;
  return assemble({
    meta: {
      mission_name: "Mars 2020 Perseverance",
      epoch_utc: epoch,
      vehicle: "mars2020",
      launch_site: { name: "SLC-41" },
    },
    jd0,
    mass_t: 4.05,
    states: toGeo(jd0, helio),
    extraIds: ["sun", "mars"],
    waypoints: [{ t: 0, body: "mars" }],
    phases: [
      { id: "cruise", name: "Interplanetary Cruise", t_start: 0, t_end: tApp, trail_s: 20 * DAY },
      { id: "approach", name: "Mars Approach", t_start: tApp, t_end: tEI, trail_s: 2 * DAY },
      { id: "edl", name: "Entry, Descent & Landing · Jezero Crater", t_start: tEI, t_end: tLand, trail_s: 600, playback_rate: 20 },
    ],
    events: [
      { t: 0, label: "Launch · Atlas V 541 · SLC-41" },
      { t: tApp, label: "Approach Phase Begins (L−45 d)" },
      { t: tEI, label: "Atmospheric Entry" },
      { t: tLand, label: "Touchdown · Jezero Crater" },
    ],
  });
}

// 5) Europa Clipper — launch 2024-10-14 on Falcon Heavy (LC-39A); Mars gravity assist
//    2025-03-01; Earth gravity assist December 2026; Jupiter arrival April 2030.
function europaClipper() {
  const epoch = "2024-10-14T16:06:00Z";
  const jd0 = jdOf(epoch);
  const at = (iso) => (Date.parse(iso) - Date.parse(epoch)) / 1000;
  const tMars = at("2025-03-01T16:57:00Z");
  const tEarth = at("2026-12-03T12:00:00Z");
  const tJup = at("2030-04-11T12:00:00Z");
  const { r1, leg } = departFromEarth(jd0, (r) => legToPlanet(r, 0, jd0, "mars", tMars, "miss", 3389.5 + 884));
  const helio = [{ t: 0, r: r1, v: leg.v1 }];
  helio.push(...propagateLeg(r1, leg.v1, 0, tMars, MU_S, helioDt(jd0, ["mars"])));
  const leg2 = legToPlanet(leg.r2, tMars, jd0, "earth", tEarth, "miss", R_E * 2.2);
  helio.push(...propagateLeg(leg.r2, leg2.v1, tMars, tEarth, MU_S, helioDt(jd0, ["mars"])));
  const leg3 = legToPlanet(leg2.r2, tEarth, jd0, "jupiter", tJup, "miss", 69911 * 1.6);
  helio.push(...propagateLeg(leg2.r2, leg3.v1, tEarth, tJup, MU_S, helioDt(jd0, ["jupiter"])));
  const w = 6 * DAY;
  return assemble({
    meta: {
      mission_name: "Europa Clipper",
      epoch_utc: epoch,
      vehicle: "clipper",
      launch_site: { name: "LC-39A" },
    },
    jd0,
    mass_t: 6.065,
    states: toGeo(jd0, helio),
    extraIds: ["sun", "mars", "jupiter"],
    waypoints: [
      { t: 0, body: "mars" },
      { t: tMars, body: "earth" },
      { t: tEarth, body: "jupiter" },
    ],
    phases: [
      { id: "cruise", name: "Cruise to Mars", t_start: 0, t_end: tMars - w, trail_s: 20 * DAY },
      { id: "gravity_assist", name: "Mars Gravity Assist", t_start: tMars - w, t_end: tMars + w, trail_s: 2 * DAY },
      { id: "cruise", name: "Cruise back to Earth", t_start: tMars + w, t_end: tEarth - w, trail_s: 30 * DAY },
      { id: "gravity_assist", name: "Earth Gravity Assist", t_start: tEarth - w, t_end: tEarth + w, trail_s: 2 * DAY },
      { id: "cruise", name: "Cruise to Jupiter", t_start: tEarth + w, t_end: tJup - 60 * DAY, trail_s: 60 * DAY },
      { id: "approach", name: "Jupiter Approach", t_start: tJup - 60 * DAY, t_end: tJup, trail_s: 6 * DAY },
    ],
    events: [
      { t: 0, label: "Launch · Falcon Heavy · LC-39A" },
      { t: tMars, label: "Mars Gravity Assist" },
      { t: tEarth, label: "Earth Gravity Assist" },
      { t: tJup, label: "Jupiter Arrival" },
    ],
  });
}

// 6) Parker Solar Probe — launch 2018-08-12 07:31 UTC on Delta IV Heavy (SLC-37);
//    first Venus gravity assist 2018-10-03; first perihelion 2018-11-06 at 24.8 million km.
function parker() {
  const epoch = "2018-08-12T07:31:00Z";
  const jd0 = jdOf(epoch);
  const at = (iso) => (Date.parse(iso) - Date.parse(epoch)) / 1000;
  const tVenus = at("2018-10-03T08:44:00Z");
  const tPeri = at("2018-11-06T03:27:00Z");
  const { r1, leg } = departFromEarth(jd0, (r) => legToPlanet(r, 0, jd0, "venus", tVenus, "miss", 6051.8 * 1.45));
  const helio = [{ t: 0, r: r1, v: leg.v1 }];
  helio.push(...propagateLeg(r1, leg.v1, 0, tVenus, MU_S, helioDt(jd0, ["venus"])));
  // Perihelion point: 24.8e6 km from the Sun, direction chosen so the arrival is tangential.
  const rPeri = 24.8e6;
  const base0 = Math.atan2(leg.r2[1], leg.r2[0]);
  let best = null;
  for (let d = 30; d <= 200; d += 0.25) {
    const ang = base0 + d * DEG;
    const R2 = [rPeri * Math.cos(ang), rPeri * Math.sin(ang), 0];
    const sol = lambert(leg.r2, R2, tPeri - tVenus, MU_S, ECL_N);
    const radial = Math.abs(dot(unit(sol.v2), unit(R2)));
    if (Number.isFinite(radial) && (!best || radial < best.radial)) best = { radial, R2, sol };
  }
  helio.push(...propagateLeg(leg.r2, best.sol.v1, tVenus, tPeri, MU_S, helioDt(jd0, ["venus"])));
  const w = 3 * DAY;
  return assemble({
    meta: {
      mission_name: "Parker Solar Probe",
      epoch_utc: epoch,
      vehicle: "parker",
      launch_site: { name: "SLC-37" },
    },
    jd0,
    mass_t: 0.685,
    states: toGeo(jd0, helio),
    extraIds: ["sun", "venus"],
    waypoints: [
      { t: 0, body: "venus" },
      { t: tVenus, body: "sun" },
    ],
    phases: [
      { id: "cruise", name: "Inner Solar System Cruise", t_start: 0, t_end: tVenus - w, trail_s: 8 * DAY },
      { id: "gravity_assist", name: "Venus Gravity Assist", t_start: tVenus - w, t_end: tVenus + w, trail_s: DAY },
      { id: "approach", name: "Solar Approach", t_start: tVenus + w, t_end: tPeri - 2 * DAY, trail_s: 6 * DAY },
      { id: "perihelion", name: "Perihelion 1 · 24.8 million km", t_start: tPeri - 2 * DAY, t_end: tPeri, trail_s: 2 * DAY },
    ],
    events: [
      { t: 0, label: "Launch · Delta IV Heavy · SLC-37" },
      { t: tVenus, label: "Venus Gravity Assist" },
      { t: tPeri, label: "Perihelion 1 · 24.8 million km" },
    ],
  });
}

// 7) Crewed Apollo Lunar Missions (Apollo 8, 11, 13, 17) — 100% real NASA UTC milestones.
function buildApolloMission({
  missionName,
  epoch,
  tTLI,
  tLOI,
  tTEI,
  tSplash,
  lunarAltKm = 111,
  leoAltKm = 185,
  mass_t = 45,
  landing = null,
}) {
  const { h } = moonBasis;
  const rLeo = R_E + leoAltKm;
  const wLeo = Math.sqrt(MU_E / rLeo ** 3);
  const M = moonPos(tLOI);
  const sDir = mul(unit(M), -1); // near-side lunar approach so outbound leg never passes through the Moon
  const tDir = unit(cross(h, sDir));
  const rL = R_MOON + lunarAltKm;
  const A_loi = add(M, mul(sDir, rL));
  const Pdir = rotate(sDir, h, 8 * DEG);
  const P = mul(Pdir, rLeo);
  const Pperp = cross(h, Pdir);

  const states = [];
  const leoSteps = 90;
  for (let i = 0; i <= leoSteps; i++) {
    const t = (i / leoSteps) * tTLI;
    const ang = wLeo * (t - tTLI);
    states.push({
      t,
      r: add(mul(Pdir, rLeo * Math.cos(ang)), mul(Pperp, rLeo * Math.sin(ang))),
      v: add(mul(Pdir, -rLeo * wLeo * Math.sin(ang)), mul(Pperp, rLeo * wLeo * Math.cos(ang))),
    });
  }
  const out = lambert(P, A_loi, tLOI - tTLI, MU_E, h);
  states.push(...propagateLeg(P, out.v1, tTLI, tLOI, MU_E, geoDt));

  let D_tei = A_loi;
  if (tTEI > tLOI) {
    const wMoon = Math.sqrt(4902.800066 / rL ** 3);
    const orbitSteps = Math.max(180, Math.round(((tTEI - tLOI) / 3600) * 18));
    for (let i = 1; i <= orbitSteps; i++) {
      const t = tLOI + (i / orbitSteps) * (tTEI - tLOI);
      const u = wMoon * (t - tLOI);
      const r = add(moonPos(t), mul(add(mul(sDir, Math.cos(u)), mul(tDir, Math.sin(u))), rL));
      const v = add(moonVel(t), mul(add(mul(sDir, -Math.sin(u)), mul(tDir, Math.cos(u))), rL * wMoon));
      states.push({ t, r, v });
      if (i === orbitSteps) D_tei = r;
    }
  }

  // Pick splashdown azimuth so return trajectory stays outside Earth's surface (min |r| >= R_E + 110 km)
  let bestBack = null;
  for (let deg = -180; deg < 180; deg += 15) {
    const Edir = rotate(unit(moonPos(tTEI)), h, deg * DEG);
    const candR = mul(Edir, R_E + 122);
    const cand = lambert(D_tei, candR, tSplash - tTEI, MU_E, h);
    const leg = propagateLeg(D_tei, cand.v1, tTEI, tSplash, MU_E, geoDt);
    let minR = Infinity;
    for (const s of leg) minR = Math.min(minR, norm(s.r));
    if (!bestBack || minR > bestBack.minR) bestBack = { minR, leg };
    if (minR >= R_E + 110) break;
  }
  states.push(...bestBack.leg);

  const phases = [{ id: "parking", name: "Earth Parking Orbit (LEO 185 km)", t_start: 0, t_end: tTLI, trail_s: 2400 }];
  const events = [
    { t: 0, label: "Launch · Saturn V · LC-39A" },
    { t: tTLI, label: "Trans-Lunar Injection (TLI)" },
  ];

  if (tTEI > tLOI) {
    phases.push({ id: "outbound", name: "Trans-Lunar Coast", t_start: tTLI, t_end: tLOI, trail_s: 8 * 3600 });
    events.push({ t: tLOI, label: `Lunar Orbit Insertion (${lunarAltKm} km)` });
    if (landing) {
      phases.push({ id: "lunar_orbit", name: "Lunar Orbit & Rendezvous", t_start: tLOI, t_end: landing.tTouchdown - 1800, trail_s: 3600 });
      phases.push({ id: "landing", name: landing.phaseName, t_start: landing.tTouchdown - 1800, t_end: landing.tAscent, trail_s: 1800 });
      phases.push({ id: "lunar_orbit", name: "Lunar Orbit & TEI Prep", t_start: landing.tAscent, t_end: tTEI, trail_s: 3600 });
      events.push({ t: landing.tTouchdown, label: landing.eventLabel });
    } else {
      phases.push({ id: "lunar_orbit", name: `Lunar Orbit (${lunarAltKm} km)`, t_start: tLOI, t_end: tTEI, trail_s: 3600 });
    }
    events.push({ t: tTEI, label: "Trans-Earth Injection (TEI)" });
    phases.push({ id: "return", name: "Trans-Earth Coast & Reentry", t_start: tTEI, t_end: tSplash, trail_s: 8 * 3600 });
  } else {
    const fb0 = tLOI - 10 * 3600;
    const fb1 = tLOI + 10 * 3600;
    phases.push({ id: "outbound", name: "Trans-Lunar Coast", t_start: tTLI, t_end: fb0, trail_s: 8 * 3600 });
    phases.push({ id: "flyby", name: `Lunar Pericynthion Flyby (${lunarAltKm} km)`, t_start: fb0, t_end: fb1, trail_s: 4 * 3600 });
    phases.push({ id: "return", name: "Free-Return Coast & Splashdown", t_start: fb1, t_end: tSplash, trail_s: 8 * 3600 });
    events.push({ t: tLOI, label: `Lunar Pericynthion (${lunarAltKm} km)` });
  }
  events.push({ t: tSplash, label: "Pacific Splashdown" });

  return assemble({
    meta: {
      mission_name: missionName,
      epoch_utc: epoch,
      vehicle: "apollo",
      launch_site: { name: "LC-39A" },
    },
    jd0: jdOf(epoch),
    mass_t,
    states,
    extraIds: ["sun"],
    waypoints: [
      { t: 0, body: "moon" },
      { t: tTEI, body: "earth" },
    ],
    phases,
    events,
  });
}

function apollo8() {
  const epoch = "1968-12-21T12:51:00Z";
  const at = (iso) => (Date.parse(iso) - Date.parse(epoch)) / 1000;
  return buildApolloMission({
    missionName: "Apollo 8",
    epoch,
    tTLI: at("1968-12-21T15:41:30Z"),
    tLOI: at("1968-12-24T09:59:20Z"),
    tTEI: at("1968-12-25T06:10:00Z"),
    tSplash: at("1968-12-27T15:51:42Z"),
    lunarAltKm: 111,
    mass_t: 28.8,
  });
}

function apollo11() {
  const epoch = "1969-07-16T13:32:00Z";
  const at = (iso) => (Date.parse(iso) - Date.parse(epoch)) / 1000;
  return buildApolloMission({
    missionName: "Apollo 11",
    epoch,
    tTLI: at("1969-07-16T16:16:16Z"),
    tLOI: at("1969-07-19T17:21:50Z"),
    tTEI: at("1969-07-22T04:55:42Z"),
    tSplash: at("1969-07-24T16:50:35Z"),
    lunarAltKm: 111,
    mass_t: 43.9,
    landing: {
      tTouchdown: at("1969-07-20T20:17:39Z"),
      tAscent: at("1969-07-21T17:54:00Z"),
      phaseName: "LM Eagle · Sea of Tranquility Surface EVA",
      eventLabel: "Touchdown · Mare Tranquillitatis",
    },
  });
}

function apollo13() {
  const epoch = "1970-04-11T19:13:00Z";
  const at = (iso) => (Date.parse(iso) - Date.parse(epoch)) / 1000;
  const tPeri = at("1970-04-15T00:21:00Z");
  return buildApolloMission({
    missionName: "Apollo 13",
    epoch,
    tTLI: at("1970-04-11T21:48:00Z"),
    tLOI: tPeri,
    tTEI: tPeri,
    tSplash: at("1970-04-17T18:07:41Z"),
    lunarAltKm: 254,
    mass_t: 43.9,
  });
}

function apollo17() {
  const epoch = "1972-12-07T05:33:00Z";
  const at = (iso) => (Date.parse(iso) - Date.parse(epoch)) / 1000;
  return buildApolloMission({
    missionName: "Apollo 17",
    epoch,
    tTLI: at("1972-12-07T08:45:00Z"),
    tLOI: at("1972-12-10T19:47:23Z"),
    tTEI: at("1972-12-16T23:35:09Z"),
    tSplash: at("1972-12-19T19:24:59Z"),
    lunarAltKm: 111,
    leoAltKm: 170,
    mass_t: 46.8,
    landing: {
      tTouchdown: at("1972-12-11T19:54:58Z"),
      tAscent: at("1972-12-14T22:54:37Z"),
      phaseName: "LM Challenger & LRV · Taurus-Littrow EVA",
      eventLabel: "Touchdown · Taurus-Littrow Valley",
    },
  });
}

const OUTPUTS = {
  "artemis_ii.json": artemisII,
  "iss.json": iss,
  "lro.json": lro,
  "mars2020.json": mars2020,
  "europa_clipper.json": europaClipper,
  "parker_solar_probe.json": parker,
  "apollo_8.json": apollo8,
  "apollo_11.json": apollo11,
  "apollo_13.json": apollo13,
  "apollo_17.json": apollo17,
};

for (const [file, build] of Object.entries(OUTPUTS)) {
  const json = build();
  const s = json.samples;
  const bad = s.x.some((x, i) => !Number.isFinite(x) || !Number.isFinite(s.vx[i]));
  if (bad) throw new Error(`${file}: non-finite samples`);
  for (let i = 1; i < s.t.length; i++) if (!(s.t[i] > s.t[i - 1])) throw new Error(`${file}: non-increasing t at ${i}`);
  fs.writeFileSync(path.join(DATA, file), JSON.stringify(json));
  const last = s.t.length - 1;
  console.log(
    `${file}: ${s.t.length} samples, ${(s.t[last] / DAY).toFixed(2)} d, final |r| = ${Math.round(
      Math.hypot(s.x[last], s.y[last], s.z[last])
    ).toLocaleString("en")} km`
  );
}
