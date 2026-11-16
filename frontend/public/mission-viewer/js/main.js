// Arranque del visualizador: carga mission.json, arma la escena y conecta la interfaz.
import * as THREE from "three";

import { createEmbedBridge, isEmbedded, VIEWER } from "./embed.js";
import { chaseCamera, nearestBody, trailWindow } from "./follow.js";
import { FRAMES, createFrames } from "./frames.js";
import { createHud } from "./hud.js";
import { densify, hermiteState, toTypedSamples } from "./interpolate.js";
import { createLabels } from "./labels.js";
import { KM_PER_UNIT, createScene, mul3, rotZ, setMatrix, transpose3 } from "./scene.js";
import { RESULTS, dvBudget, eventInfo, vehicleAt } from "./story.js";
import { createTimeline, formatMET } from "./timeline.js";
import { SUNLIT, createTour, phaseIndexAt } from "./tour.js";
import { createMoonOrbit, createNrho, createTrajectory } from "./trajectory.js";
import { createShip } from "./vehicles.js";

const $ = (id) => document.getElementById(id);
const SUN_DIR_ECI = [1, 0, 0]; // dirección fija del Sol (solo para iluminar)
const PAD_LON_DEG = -80.62; // LC-39B
const L2_RATIO = 1.1678; // distancia de L2 a la Tierra, en unidades de la distancia Tierra–Luna
const CARD_MS = 9000;
const CAMERA_MOVE_S = 1.4;
// Tamaño de la nave en pantalla: fracción del cuerpo más cercano, con límites
const SHIP_TO_BODY = 0.28;
const SHIP_MIN = 0.005;
const SHIP_MAX = 0.05;
const SHIP_LABEL = {
  sls: "SLS",
  core: "SLS",
  eus: "EUS + Orion",
  orion: "Orion",
  hls: "HLS",
  dragon: "Crew Dragon",
  soyuz: "Soyuz MS",
  iss: "ISS Station",
  rover: "Lunar Rover",
  ares: "Ares I Transit",
  gateway: "Gateway",
  lro: "LRO",
  mars2020: "Perseverance",
  clipper: "Europa Clipper",
  parker: "Parker Solar Probe",
  apollo: "Apollo CSM",
  saturnv: "Saturn V",
};
const VEHICLE_FULL_LABEL = {
  sls: "SLS Block 1B + Orion",
  core: "SLS Core + Orion",
  eus: "EUS + Orion",
  orion: "Orion",
  hls: "Starship HLS",
  dragon: "Falcon 9 + Crew Dragon",
  soyuz: "Soyuz MS",
  iss: "ISS Orbital Station",
  rover: "Pressurized Lunar Rover",
  ares: "Ares I Mars Transit",
  gateway: "Lunar Gateway",
  lro: "Lunar Reconnaissance Orbiter",
  mars2020: "Mars 2020 Perseverance",
  clipper: "Europa Clipper",
  parker: "Parker Solar Probe",
  apollo: "Apollo Command/Service Module",
  saturnv: "Saturn V + Apollo CSM/LM",
};

/** Distancia de cámara al cambiar de foco (unidades de escena = 1 000 km). */
const FOCUS_DISTANCE = { earth: 30, moon: 9, ship: 3, system: 620 };
const OVERVIEW = { frame: "rot", focus: "system", distance: 620, dir: [0.1, -0.62, 0.78] };

const ease = (u) => u * u * (3 - 2 * u);
const norm = (v) => {
  const d = Math.hypot(...v) || 1;
  return v.map((x) => x / d);
};

async function main() {
  const params = new URLSearchParams(location.search);
  const rawData = params.get("data");
  const rawVehicle = params.get("vehicle");
  const vehicleOverride = rawVehicle && VEHICLE_FULL_LABEL[rawVehicle] ? rawVehicle : null;
  const dataUrl =
    rawData && (/^data\/[a-zA-Z0-9_.-]+\.json$/.test(rawData) || rawData.startsWith("blob:"))
      ? rawData
      : "data/mission.json";
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error(`Failed to load ${dataUrl} (${res.status})`);
  const mission = await res.json();
  if (mission.schema_version !== 1) throw new Error(`Unsupported format version: ${mission.schema_version}`);

  const { phases, events, bodies } = mission;
  const samples = toTypedSamples(mission.samples);
  const frames = createFrames(bodies.moon);
  const omegaEarth = bodies.earth.rotation_rate_rad_s;
  const tLast = phases[phases.length - 1].t_end;
  const positionAt = (t) => hermiteState(samples, t).r;
  const extraBodies = (bodies.extra || []).map((b) => {
    const bSamples = toTypedSamples({
      t: mission.samples.t,
      m: mission.samples.m,
      phase_index: mission.samples.phase_index,
      ...b.track,
    });
    return {
      ...b,
      positionAt: (t) => hermiteState(bSamples, t).r,
    };
  });
  const extraMap = Object.fromEntries(extraBodies.map((b) => [b.id, b]));

  const view = createScene($("viewport"), bodies);
  const { scene, camera, controls, renderer } = view;

  // La textura tiene el meridiano 0 en +x; el simulador pone LC-39B donde cae en ECI a t = 0
  const padLon = Math.atan2(samples.y[0], samples.x[0]) - THREE.MathUtils.degToRad(PAD_LON_DEG);
  view.earth.geometry.rotateZ(padLon);
  view.clouds.geometry.rotateZ(padLon);

  const trajectory = createTrajectory(scene, densify(samples), phases, frames);
  const moonOrbit = createMoonOrbit(scene, frames);
  const nrho = mission.nrho ? createNrho(scene, frames, mission.nrho) : null;

  const { ship, gateway, setLook } = createShip(scene);

  // Etiquetas
  const labels = createLabels($("labels"), camera);
  const label = {
    earth: labels.add("Earth", { priority: 9, kind: "body" }),
    moon: labels.add("Moon", { priority: 9, kind: "body" }),
    mercury: labels.add("Mercury", { priority: 5, kind: "body" }),
    venus: labels.add("Venus", { priority: 6, kind: "body" }),
    mars: labels.add("Mars", { priority: 7, kind: "body" }),
    jupiter: labels.add("Jupiter", { priority: 6, kind: "body" }),
    saturn: labels.add("Saturn", { priority: 5, kind: "body" }),
    site: mission.landing_site ? labels.add("Landing Site · 86.8° S", { priority: 8, kind: "site" }) : null,
    gateway: nrho ? labels.add("Gateway", { priority: 7 }) : null,
    ship: labels.add("", { priority: 10, kind: "ship" }),
    pad: labels.add(mission.launch_site?.name || "LC-39B", { priority: 6 }),
    l2: labels.add("L2", { priority: 3 }),
  };
  for (const b of extraBodies) {
    if (!label[b.id]) label[b.id] = labels.add(b.name || b.id, { priority: 8, kind: "body" });
  }
  // Embebido: solo la escena (Tierra, Luna, trayectoria y nave); el anfitrión pone el contexto.
  const embedded = isEmbedded(window.location.search);
  const maneuvers = (embedded ? [] : events)
    .filter((e) => /TLI|OPF|NRI|DOI|PDI/.test(e.label))
    .map((e) => ({ e, r: positionAt(e.t), item: labels.add(eventInfo(e.label).short, { priority: 4, kind: "event" }) }));

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = { t: 0, playing: false, speedIndex: 0, frame: OVERVIEW.frame, focus: OVERVIEW.focus };

  const budget = dvBudget(events);
  const hud = createHud(
    {
      root: document.documentElement, met: $("hud-met"), phase: $("hud-phase"), vehicle: $("hud-vehicle"),
      alt: $("hud-alt"), altLabel: $("hud-alt-label"), speed: $("hud-speed"), speedLabel: $("hud-speed-label"),
      rates: $("hud-rates"), vertical: $("hud-vertical"), horizontal: $("hud-horizontal"),
      mass: $("hud-mass"), frame: $("hud-frame"),
      sparkAlt: $("spark-alt"), sparkSpeed: $("spark-speed"), cursor: [...document.querySelectorAll("#hud .cursor")],
      physics: $("sci-physics"), method: $("sci-method"), result: $("sci-result"),
      dvBar: $("dv-bar"), dvList: $("dv-list"), dvSpent: $("dv-spent"),
    },
    mission, samples, frames, budget
  );

  // --- Tarjeta de evento ---------------------------------------------------------------
  let cardTimer = 0;
  function showCard(e) {
    const info = eventInfo(e.label);
    $("card-time").textContent = formatMET(e.t);
    $("card-dv").textContent = info.dv ? `Δv ${hud.fmt(RESULTS[info.dv], 0)} m/s` : "";
    $("card-title").textContent = e.label;
    $("card-text").textContent = info.text;
    $("event-card").hidden = false;
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => ($("event-card").hidden = true), CARD_MS);
  }

  const timeline = createTimeline(
    { track: $("track"), tags: $("tags"), names: $("names"), curtain: $("curtain"), slider: $("slider"), play: $("play") },
    mission,
    state,
    {
      cross: showCard,
      jump(e) {
        showCard(e);
        const { shot } = eventInfo(e.label);
        tour.sync(e.t);
        if (shot) applyShot(shot);
      },
    }
  );

  // --- Cámara --------------------------------------------------------------------------
  // Un movimiento mezcla el foco anterior con el nuevo y acerca la cámara en escala logarítmica.
  let move = null;

  function focusPosition(key, t, frame) {
    const earth = frames.toFrame(frame, [0, 0, 0], t);
    const moon = frames.toFrame(frame, frames.moonPosition(t), t);
    if (key === "earth") return earth;
    if (key === "moon") return moon;
    if (extraMap[key]) return frames.toFrame(frame, extraMap[key].positionAt(t), t);
    if (key === "system") return earth.map((x, i) => (x + moon[i]) / 2);
    return frames.toFrame(frame, positionAt(t), t);
  }

  /** Cámara rasante: sobre el cuerpo más cercano, mirando a la nave contra el horizonte. */
  function horizonDirection() {
    const t = state.t;
    const ship = positionAt(t);
    const moonRel = ship.map((x, i) => x - frames.moonPosition(t)[i]);
    const nearMoon = Math.hypot(...moonRel) < Math.hypot(...ship) / 2;
    const up = norm(frames.directionToFrame(state.frame, nearMoon ? moonRel : ship, t));
    const side = norm([up[1], -up[0], 0.2]);
    return up.map((x, i) => 0.42 * x + 0.9 * side[i]);
  }

  /** En pantallas angostas el sistema Tierra–Luna solo cabe alejando la cámara. */
  const fit = (key, distance) => (key === "system" ? distance * Math.max(1.3 / camera.aspect, 1) : distance);

  function moveCamera(key, rawDistance, dir) {
    const distance = fit(key, rawDistance);
    const from = state.focus;
    const offset = camera.position.clone().sub(controls.target);
    state.focus = key;
    const toDir = (dir ? new THREE.Vector3(...dir) : offset.clone()).normalize();
    const fromDist = Math.max(offset.length(), 1e-3);
    if (reducedMotion) {
      camera.position.copy(toDir.multiplyScalar(distance));
      move = null;
      return;
    }
    move = { from, u: 0, fromDist, toDist: distance, fromDir: offset.normalize(), toDir };
  }

  function setFocus(key, distance) {
    const near = key === "ship" && state.t < phases[0].t_end;
    moveCamera(key, distance ?? (near ? 1.6 : FOCUS_DISTANCE[key]));
  }

  function applyShot(shot) {
    setFrame(shot.frame);
    moveCamera(shot.focus, shot.distance, shot.dir ?? (shot.view === "horizon" ? horizonDirection() : null));
  }

  // --- Controles -----------------------------------------------------------------------
  // A la vista solo quedan reproducir, Ciencia y Ayuda; lo demás son atajos (ver la ayuda).
  function setFrame(key) {
    state.frame = key;
  }

  let showLabels = true;
  const tEvent = (re) => events.find((e) => re.test(e.label))?.t ?? 0;

  function toggleScience() {
    const open = $("science").hidden;
    $("science").hidden = !open;
    $("science-btn").setAttribute("aria-expanded", String(open));
  }
  $("science-btn").addEventListener("click", toggleScience);

  // Cámara guiada: una toma por fase. Mover la cámara con el ratón la desactiva.
  const tour = createTour(phases, (shot) => applyShot(shot));
  function setGuided(on) {
    if (on) tour.start();
    else tour.stop();
    $("guide-btn").hidden = on;
  }
  $("guide-btn").addEventListener("click", () => setGuided(true));
  controls.addEventListener("start", () => {
    move = null;
    setGuided(false);
  });

  // Pantallas de inicio y final
  const startMission = () => {
    $("intro").hidden = true;
    $("finale").hidden = true;
    document.body.classList.remove("intro");
    hud.redraw();
    timeline.layoutTags();
    timeline.seek(0);
    timeline.setSpeedIndex(0);
    setGuided(true);
    if (!state.playing) timeline.togglePlay();
  };
  $("intro-start").addEventListener("click", startMission);
  $("finale-replay").addEventListener("click", startMission);
  $("finale-close").addEventListener("click", () => ($("finale").hidden = true));

  $("finale-stats").innerHTML = [
    [`${hud.fmt(RESULTS.touchdown_speed_ms, 1)} m/s`, "touchdown velocity"],
    [`${hud.fmt(RESULTS.landing_error_m * 100, 1)} cm`, "landing site error"],
    [`${hud.fmt(RESULTS.mission_days, 2)} days`, "mission duration"],
    [`${hud.fmt(hud.total / 1000, 2)} km/s`, "Δv since insertion"],
    [`${hud.fmt(RESULTS.hls_mass_landed_t, 1)} t`, "HLS mass on surface"],
    [`${events.length}`, "mission events"],
  ].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join("");

  const help = $("help");
  $("help-btn").addEventListener("click", () => help.showModal());
  $("help-close").addEventListener("click", () => help.close());
  controls.enableDamping = !reducedMotion;

  window.addEventListener("keydown", (e) => {
    if (embedded) return; // sin atajos: los controles los pone el anfitrión
    if (!$("intro").hidden) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        startMission();
      }
      return;
    }
    const manual = (fn) => () => {
      setGuided(false);
      fn();
    };
    const actions = {
      " ": () => timeline.togglePlay(),
      ArrowRight: () => timeline.jumpEvent(1),
      ArrowLeft: () => timeline.jumpEvent(-1),
      ArrowUp: () => timeline.setSpeed(1),
      ArrowDown: () => timeline.setSpeed(-1),
      "+": () => timeline.setSpeed(1),
      "-": () => timeline.setSpeed(-1),
      1: manual(() => setFrame("eci")),
      2: manual(() => setFrame("rot")),
      3: manual(() => setFrame("moon")),
      n: manual(() => setFocus("ship")),
      t: manual(() => setFocus("earth")),
      l: manual(() => setFocus("moon")),
      m: manual(() => applyShot(OVERVIEW)),
      c: toggleScience,
      e: () => (showLabels = !showLabels),
      g: () => setGuided(true),
      h: () => (help.open ? help.close() : help.showModal()),
    };
    const fn = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });

  // --- Bucle ---------------------------------------------------------------------------
  const tmp = new THREE.Vector3();
  const screenA = new THREE.Vector3();
  const screenB = new THREE.Vector3();
  const moonFixedToRot = rotZ(Math.PI); // el meridiano 0 lunar mira a la Tierra (−x del marco rotante)
  const nrhoCount = nrho ? mission.nrho.x.length : 0;
  const tNri = tEvent(/NRI/);
  const tDoi = tEvent(/DOI/);

  // Gateway sigue en la NRHO después de la DOI: se ancla al punto de la órbita donde se separó el HLS
  let gatewayAnchor = 0;
  if (nrho) {
    const r = frames.toFrame("rot", positionAt(tDoi), tDoi);
    let best = Infinity;
    for (let i = 0; i < nrhoCount; i++) {
      const d = Math.hypot(mission.nrho.x[i] - r[0], mission.nrho.y[i] - r[1], mission.nrho.z[i] - r[2]);
      if (d < best) [best, gatewayAnchor] = [d, i];
    }
  }
  function gatewayEci(t) {
    if (t <= tDoi) return positionAt(t);
    const i = Math.round(gatewayAnchor + ((t - tDoi) / mission.nrho.period_s) * nrhoCount) % nrhoCount;
    return frames.fromRotating([mission.nrho.x[i], mission.nrho.y[i], mission.nrho.z[i]], t);
  }

  camera.position.set(...OVERVIEW.dir).normalize().multiplyScalar(fit(OVERVIEW.focus, OVERVIEW.distance));
  $("loading").remove();

  // Modo embebido: sin pantallas de inicio/final; el anfitrión controla el reloj.
  let bridge = null;
  if (embedded) {
    document.body.classList.add("embed");
    hud.redraw();
    timeline.layoutTags();
    // Vista cercana: sin órbitas completas; la estela de la nave traza el camino.
    moonOrbit.line.visible = false;
    if (nrho) nrho.line.visible = false;
    bridge = createEmbedBridge(window, (cmd) => {
      if (cmd.type === "seek") {
        if (state.playing) timeline.togglePlay();
        timeline.seek(cmd.t);
        follow.user = false; // vuelve a encuadrar el cuerpo más cercano
        follow.force = true;
      } else if ((cmd.type === "play") !== state.playing) {
        timeline.togglePlay();
      }
    });
    bridge.post({ source: VIEWER, type: "ready", tEnd: tLast, phases, events });
  } else {
    $("intro").hidden = false;
    document.body.classList.add("intro");
  }

  // Cámara de persecución (solo embebido): detrás de la nave, mirando al cuerpo que orbita,
  // con zoom para que el cuerpo se vea grande. Si el usuario mueve la cámara se respeta
  // su vista hasta el siguiente salto de tiempo.
  const follow = { user: false, force: true };
  const baseFov = camera.fov;
  if (embedded) controls.addEventListener("start", () => (follow.user = true));

  function updateFollow(elapsed) {
    const t = state.t;
    const extraAtT = extraBodies.map((b) => ({
      id: b.id,
      radius_km: b.radius_km,
      chase_km: b.chase_km,
      pos: b.positionAt(t),
    }));
    const target = nearestBody(positionAt(t), frames.moonPosition(t), extraAtT);
    if (target.focus !== state.focus || target.frame !== state.frame) {
      setFrame(target.frame);
      state.focus = target.focus;
      follow.force = true;
    }
    if (follow.user) return;
    const k = follow.force || reducedMotion ? 1 : 1 - Math.exp(-elapsed * 3);
    follow.force = false;
    if (target.focus === "ship") {
      // Deep space: center directly on the spacecraft/rocket looking forward along its trajectory
      const st = hermiteState(samples, t);
      const v = norm(frames.velocityToFrame(target.frame, st.r, st.v, t));
      const camPos = [-v[0] * 3.2 + 0.9, -v[1] * 3.2 - 1.5, -v[2] * 3.2 + 1.4];
      camera.position.lerp(tmp.set(...camPos), k);
      camera.fov += (40 - camera.fov) * k;
      camera.updateProjectionMatrix();
      return;
    }
    const body = focusPosition(target.focus, t, target.frame);
    const shipPos = frames.toFrame(target.frame, positionAt(t), t);
    const radius =
      target.radius_km ??
      (target.focus === "moon" ? bodies.moon.radius_km : bodies.earth.radius_km);
    const shot = chaseCamera(shipPos.map((x, i) => x - body[i]), radius);
    camera.position.lerp(tmp.set(...shot.position).divideScalar(KM_PER_UNIT), k);
    camera.fov += (shot.fov - camera.fov) * k;
    camera.updateProjectionMatrix();
  }

  let last = performance.now();
  let vehicleName = "";
  let finished = false;

  function frameLoop(now) {
    const elapsed = (now - last) / 1000;
    const dt = Math.min(elapsed, 0.1);
    last = now;
    timeline.tick(dt);
    tour.update(state.t);
    if (embedded) updateFollow(elapsed);
    const landed = state.t >= tLast;
    if (landed && !finished && !embedded) {
      $("finale").hidden = false;
      $("event-card").hidden = true;
    }
    finished = landed;

    const { t, frame } = state;
    const st = hermiteState(samples, t);
    const moonEci = frames.moonPosition(t);
    const shipF = frames.toFrame(frame, st.r, t);
    const moonF = frames.toFrame(frame, moonEci, t);
    const earthF = frames.toFrame(frame, [0, 0, 0], t);

    let focus = focusPosition(state.focus, t, frame);
    if (move) {
      move.u = Math.min(move.u + elapsed / CAMERA_MOVE_S, 1);
      const e = ease(move.u);
      const old = focusPosition(move.from, t, frame);
      focus = focus.map((x, i) => old[i] + (x - old[i]) * e);
      const dist = Math.exp(Math.log(move.fromDist) * (1 - e) + Math.log(move.toDist) * e);
      camera.position.copy(tmp.copy(move.fromDir).lerp(move.toDir, e).normalize().multiplyScalar(dist));
      if (move.u >= 1) move = null;
    }
    const rel = (p, out = tmp) => out.set((p[0] - focus[0]) / KM_PER_UNIT, (p[1] - focus[1]) / KM_PER_UNIT, (p[2] - focus[2]) / KM_PER_UNIT);

    const M = frames.matrix(frame, t);
    rel(earthF);
    setMatrix(view.earth.matrix, mul3(M, rotZ(omegaEarth * t)), tmp.x, tmp.y, tmp.z);
    view.earth.matrixWorldNeedsUpdate = true;
    // Rotación síncrona: la Luna está fija en el marco rotante, sea cual sea el marco de vista
    rel(moonF);
    setMatrix(view.moon.matrix, mul3(mul3(M, transpose3(frames.matrix("rot", t))), moonFixedToRot), tmp.x, tmp.y, tmp.z);
    view.moon.matrixWorldNeedsUpdate = true;
    ship.position.copy(rel(shipF));

    const defaultVehicleId =
      mission.vehicle && VEHICLE_FULL_LABEL[mission.vehicle] ? mission.vehicle : null;
    const vehicle = vehicleOverride
      ? { id: vehicleOverride, name: VEHICLE_FULL_LABEL[vehicleOverride] }
      : defaultVehicleId
        ? { id: defaultVehicleId, name: VEHICLE_FULL_LABEL[defaultVehicleId] }
        : events.some((e) => /SRB|MECO|TLI/.test(e.label))
          ? vehicleAt(t, events)
          : /iss/i.test(dataUrl)
            ? { id: "iss", name: VEHICLE_FULL_LABEL.iss }
            : /mars/i.test(dataUrl)
              ? { id: "mars2020", name: VEHICLE_FULL_LABEL.mars2020 }
              : /lro|lunar_base/i.test(dataUrl)
                ? { id: "lro", name: VEHICLE_FULL_LABEL.lro }
                : vehicleAt(t, events);
    const shipName =
      landed && mission.landing_site && !vehicleOverride
        ? "HLS · Landing Site, 86.8° S"
        : SHIP_LABEL[vehicle.id];
    if (shipName !== vehicleName) {
      vehicleName = shipName;
      label.ship.el.textContent = shipName;
      label.ship.w = 0;
    }

    const v = frames.velocityToFrame(frame, st.r, st.v, t);
    const camDist = camera.position.distanceTo(controls.target);

    const sun = frames.directionToFrame(frame, SUN_DIR_ECI, t);
    view.sun.position.set(sun[0], sun[1], sun[2]).multiplyScalar(100);

    trajectory.update(frame, focus, t, shipF, embedded ? trailWindow(phases, t) : undefined);
    moonOrbit.update(frame, t, focus);
    nrho?.update(frame, t, focus);
    view.stars.position.copy(camera.position);

    const phase = phases[phaseIndexAt(phases, t)];
    hud.update(t, st, phase, moonEci, FRAMES[frame], vehicle, landed);
    bridge?.report(now, t, phase.id, state.playing);

    controls.update();
    camera.updateMatrixWorld();

    // La silueta apunta a donde va la nave; el HLS en descenso final se mantiene vertical
    const along = phase.id === "landing" ? norm(st.r.map((x, i) => x - moonEci[i])) : norm(v);
    const lookAhead = camDist * 0.05;
    const earthC = rel(earthF, new THREE.Vector3());
    const moonC = rel(moonF, new THREE.Vector3());
    const occluders = [
      { center: earthC, radius: bodies.earth.radius_km / KM_PER_UNIT },
      { center: moonC, radius: bodies.moon.radius_km / KM_PER_UNIT },
    ];
    for (const b of extraBodies) {
      const bPos = rel(frames.toFrame(frame, b.positionAt(t), t), new THREE.Vector3());
      const mesh = view.extraMeshes?.[b.id];
      if (mesh) mesh.position.copy(bPos);
      occluders.push({ center: bPos, radius: b.radius_km / KM_PER_UNIT });
      if (label[b.id]) {
        label[b.id].pos.copy(bPos);
        label[b.id].pos.z += b.radius_km / KM_PER_UNIT;
        label[b.id].active = bPos.distanceTo(camera.position) > 3 * (b.radius_km / KM_PER_UNIT);
      }
    }
    // La nave no está a escala, pero nunca supera al cuerpo más cercano
    const fovTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const baseTan = Math.tan(THREE.MathUtils.degToRad(baseFov / 2));
    const scaleNear = (p) => {
      if (state.focus === "ship") return 0.036;
      let nearest = occluders[0];
      let minDist = p.distanceTo(nearest.center);
      for (let i = 1; i < occluders.length; i++) {
        const d = p.distanceTo(occluders[i].center);
        if (d < minDist) {
          minDist = d;
          nearest = occluders[i];
        }
      }
      const apparent = nearest.radius / nearest.center.distanceTo(camera.position) / fovTan;
      return Math.min(Math.max(SHIP_TO_BODY * apparent, SHIP_MIN), SHIP_MAX);
    };
    // Los sprites tienen tamaño fijo en pantalla pero el zoom los agranda: se compensa
    const zoomFix = embedded ? fovTan / baseTan : 1;
    const look = (sprite, id, size) => setLook(sprite, id, size * zoomFix, size);
    look(ship, vehicle.id, scaleNear(ship.position));
    const axis = phase.id === "landing" ? frames.directionToFrame(frame, along, t) : along;
    screenA.copy(ship.position).project(camera);
    screenB.copy(ship.position).addScaledVector(tmp.set(...axis), lookAhead).project(camera);
    ship.material.rotation = Math.atan2((screenB.y - screenA.y) / camera.aspect, screenB.x - screenA.x) - Math.PI / 2;

    // Gateway: mientras Orion está acoplada se dibuja una sola silueta
    const docked = t >= tNri && t < tDoi;
    const behind = occluders.some((o) => labels.hidden(ship.position, o));
    ship.visible = !docked && !behind && $("intro").hidden;
    label.ship.active = ship.visible;
    label.ship.pos.copy(ship.position);
    if (nrho) {
      const shown = t >= tNri;
      gateway.visible = shown;
      label.gateway.active = gateway.visible;
      if (shown) {
        gateway.position.copy(rel(frames.toFrame(frame, gatewayEci(t), t)));
        look(gateway, "gateway", scaleNear(gateway.position));
        if (occluders.some((o) => labels.hidden(gateway.position, o))) gateway.visible = false;
        label.gateway.pos.copy(gateway.position);
      }
    }

    // Position deep-space Solar System planets relative to focus
    if (view.solarPlanets) {
      const fx = focus[0] / KM_PER_UNIT;
      const fy = focus[1] / KM_PER_UNIT;
      const fz = focus[2] / KM_PER_UNIT;
      for (const [key, planet] of Object.entries(view.solarPlanets)) {
        if (!planet.visible) continue;
        const [bx, by, bz] = planet.userData.basePos;
        planet.position.set(bx - fx, by - fy, bz - fz);
        if (label[key]) {
          label[key].pos.copy(planet.position);
          label[key].active = true;
        }
      }
    }

    // Etiquetas: cada punto en su marco, con el instante que le corresponde
    rel(earthF, label.earth.pos);
    rel(moonF, label.moon.pos);
    label.earth.active = label.earth.pos.distanceTo(camera.position) > 3 * bodies.earth.radius_km / KM_PER_UNIT;
    label.moon.active = label.moon.pos.distanceTo(camera.position) > 3 * bodies.moon.radius_km / KM_PER_UNIT;
    label.earth.pos.z += bodies.earth.radius_km / KM_PER_UNIT;
    label.moon.pos.z += bodies.moon.radius_km / KM_PER_UNIT;
    if (label.site) rel(frames.toFrame(frame, frames.fromRotating(mission.landing_site.position_km, t), t), label.site.pos);
    const padEci = [samples.x[0], samples.y[0], samples.z[0]];
    const padNow = mul3(rotZ(omegaEarth * t), [padEci[0], 0, 0, padEci[1], 0, 0, padEci[2], 0, 0]);
    rel(frames.toFrame(frame, [padNow[0], padNow[3], padNow[6]], t), label.pad.pos);
    label.pad.active = t < Math.min(phases[0].t_end, 1800);
    rel(frames.toFrame(frame, frames.fromRotating([L2_RATIO * bodies.moon.orbit_radius_km, 0, 0], t), t), label.l2.pos);
    for (const m of maneuvers) rel(frames.toFrame(frame, m.r, m.e.t), m.item.pos);

    if (embedded) label.l2.active = false;
    labels.update(showLabels, occluders);

    renderer.render(scene, camera);
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);
}

main().catch((err) => {
  console.error(err);
  const box = $("loading");
  if (box) {
    box.textContent = `Error: ${err.message}. Serve the frontend/ directory using a local server (see README).`;
    box.classList.add("error");
  }
});
