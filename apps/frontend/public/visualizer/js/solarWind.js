// Capa 3D de Viento Solar, Espiral de Parker, Auroras Polares, Magnetosfera y Escudo Storm Shelter
// Se adapta al marco de referencia activo (ECI, rotante, selenocéntrico) y al origen flotante.
import * as THREE from "three";

const PARTICLE_COUNT = 950;
const STREAM_LENGTH = 1100; // 1.1M km en unidades de escena (1 u = 1000 km)
const STREAM_RADIUS = 380;

const PALETTES = {
  nominal: { core: new THREE.Color(0x5ec8ff), hot: new THREE.Color(0xb8ecff), bow: new THREE.Color(0x38bdf8) },
  warning: { core: new THREE.Color(0xffa73b), hot: new THREE.Color(0xffe08a), bow: new THREE.Color(0xf59e0b) },
  storm: { core: new THREE.Color(0xff3864), hot: new THREE.Color(0xff9ec4), bow: new THREE.Color(0xf43f5e) },
};

function createCircleTexture() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.8)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function createParkerLineGeometry(yOffset, spiralDeg) {
  const pts = [];
  const steps = 36;
  const tanAngle = Math.tan(THREE.MathUtils.degToRad(Math.min(72, Math.max(15, spiralDeg))));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = 520 - u * 1040; // +520 (hacia el Sol) -> -520 (espacio profundo)
    const curveY = yOffset + (u - 0.5) * 260 * tanAngle * 0.45 + Math.sin(u * Math.PI) * 25;
    pts.push(new THREE.Vector3(x, curveY, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export function createSolarWindLayer(scene, earthRadiusUnits) {
  const group = new THREE.Group();
  group.name = "solar-wind-layer";
  scene.add(group);

  // --- 1. Partículas de viento solar ---
  const streamGroup = new THREE.Group();
  group.add(streamGroup);

  const offsets = new Float32Array(PARTICLE_COUNT * 3);
  const seeds = new Float32Array(PARTICLE_COUNT);
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * STREAM_RADIUS;
    offsets[3 * i] = (Math.random() - 0.5) * STREAM_LENGTH;
    offsets[3 * i + 1] = Math.cos(angle) * rad;
    offsets[3 * i + 2] = Math.sin(angle) * rad;
    seeds[i] = 0.65 + Math.random() * 0.7;
  }

  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const particleMat = new THREE.PointsMaterial({
    size: 7.5,
    map: createCircleTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.frustumCulled = false;
  streamGroup.add(particles);

  // --- 1b. Líneas de campo magnético (Espiral de Parker) ---
  const parkerGroup = new THREE.Group();
  streamGroup.add(parkerGroup);
  const parkerMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const parkerOffsets = [-160, 0, 160];
  const parkerLines = parkerOffsets.map((yOff) => {
    const line = new THREE.Line(createParkerLineGeometry(yOff, 45), parkerMat);
    line.frustumCulled = false;
    parkerGroup.add(line);
    return line;
  });

  // --- 2. Magnetosfera / Bow Shock + Cinturón de Van Allen + Auroras Polares ---
  const bowGeo = new THREE.SphereGeometry(1, 36, 24, -Math.PI / 2, Math.PI, 0, Math.PI);
  bowGeo.rotateY(Math.PI / 2);
  const bowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    wireframe: true,
  });
  const bowShock = new THREE.Mesh(bowGeo, bowMat);
  group.add(bowShock);

  // Cinturón de Van Allen (toroide translúcido alrededor de la Tierra)
  const vanAllenGeo = new THREE.TorusGeometry(earthRadiusUnits * 2.2, earthRadiusUnits * 0.42, 16, 48);
  const vanAllenMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const vanAllenBelt = new THREE.Mesh(vanAllenGeo, vanAllenMat);
  group.add(vanAllenBelt);

  // Auroras polares (Norte y Sur)
  const auroraGeo = new THREE.RingGeometry(earthRadiusUnits * 0.34, earthRadiusUnits * 0.56, 36);
  const auroraMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const auroraNorth = new THREE.Mesh(auroraGeo, auroraMat);
  const auroraSouth = new THREE.Mesh(auroraGeo, auroraMat);
  group.add(auroraNorth, auroraSouth);

  // --- 3. Frente de choque CME / Fulguración direccional ---
  const cmeGroup = new THREE.Group();
  group.add(cmeGroup);

  const cmeWaveGeo = new THREE.SphereGeometry(1, 32, 20, -Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.15, Math.PI * 0.7);
  cmeWaveGeo.rotateY(Math.PI / 2);
  const cmeWaveMat = new THREE.MeshBasicMaterial({
    color: 0xff8c32,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const cmeWave = new THREE.Mesh(cmeWaveGeo, cmeWaveMat);
  cmeGroup.add(cmeWave);

  // Anillo indicador de impacto sobre la zona cislunar / Gateway
  const ringGeo = new THREE.RingGeometry(14, 17, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff5a36,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const impactRing = new THREE.Mesh(ringGeo, ringMat);
  group.add(impactRing);

  // Escudo Storm Shelter alrededor de la nave / Gateway
  const shelterGeo = new THREE.SphereGeometry(12, 24, 16);
  const shelterMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.28,
    wireframe: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shelterHalo = new THREE.Mesh(shelterGeo, shelterMat);
  shelterHalo.visible = false;
  group.add(shelterHalo);

  // Estado interno
  let simTime = 0;
  let lastSpiralDeg = 45;
  let visible = true;
  let weather = {
    scenario: "NOMINAL",
    speedKmS: 410,
    densityPcm3: 4.8,
    bzNt: -1.2,
    parkerSpiralAngleDeg: 45,
    magnetopauseStandoffRe: 10.6,
    sourceLatDeg: 5,
    sourceLonDeg: 12,
    coneHalfAngleDeg: 25,
    primaryImpactZone: "DEEP_SPACE_MISS",
    stormScale: "S0_NOMINAL",
    cmeActive: false,
    shelterActive: false,
  };

  const xAxis = new THREE.Vector3(1, 0, 0);
  const sunVec = new THREE.Vector3();
  const cmeDir = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const tmpColor = new THREE.Color();

  function setVisible(next) {
    visible = Boolean(next);
    group.visible = visible;
  }

  function setWeatherState(next) {
    if (!next) return;
    const sw = next.solarWind || {};
    const imp = next.impactPrediction || {};
    const scale = next.currentTelemetry?.stormScale || imp.predictedStormScale || "S0_NOMINAL";
    const isWarning = Boolean(next.earlyWarning?.isWarningActive);
    const isMiss = imp.primaryImpactZone === "DEEP_SPACE_MISS";
    const cmeActive =
      isWarning ||
      scale !== "S0_NOMINAL" ||
      (next.activeScenario && !String(next.activeScenario).startsWith("NOMINAL"));

    const spiralDeg = Number(sw.parkerSpiralAngleDeg ?? 45);
    if (Math.abs(spiralDeg - lastSpiralDeg) > 2) {
      lastSpiralDeg = spiralDeg;
      parkerLines.forEach((line, idx) => {
        line.geometry.dispose();
        line.geometry = createParkerLineGeometry(parkerOffsets[idx], spiralDeg);
      });
    }

    weather = {
      scenario: next.activeScenario || "LIVE",
      speedKmS: Number(sw.speedKmS ?? 410),
      densityPcm3: Number(sw.densityPcm3 ?? 4.8),
      bzNt: Number(sw.bzNt ?? -1.2),
      parkerSpiralAngleDeg: spiralDeg,
      magnetopauseStandoffRe: Number(imp.magnetopauseStandoffRe ?? 10.6),
      sourceLatDeg: Number(imp.sourceLatDeg ?? 0),
      sourceLonDeg: Number(imp.sourceLonDeg ?? 0),
      coneHalfAngleDeg: Number(imp.coneHalfAngleDeg ?? 35),
      primaryImpactZone: imp.primaryImpactZone || "DEEP_SPACE_MISS",
      stormScale: scale,
      cmeActive: Boolean(cmeActive && !isMiss ? true : String(next.activeScenario || "").includes("MISS")),
      shelterActive: Boolean(next.shelterActive ?? weather.shelterActive),
    };
  }

  function setShelterActive(active) {
    weather.shelterActive = Boolean(active);
  }

  function update(dtReal, sunDirFrame, earthPos, moonPos, gatewayPos, shipPos, cameraPos) {
    if (!visible) return;
    simTime += Math.min(dtReal, 0.05);

    sunVec.set(sunDirFrame[0], sunDirFrame[1], sunDirFrame[2]).normalize();
    quat.setFromUnitVectors(xAxis, sunVec);

    streamGroup.position.copy(earthPos).add(moonPos).multiplyScalar(0.5);
    streamGroup.quaternion.copy(quat);

    const isStorm = weather.stormScale === "S4_SEVERE" || weather.stormScale === "S5_EXTREME";
    const isWarning =
      !isStorm &&
      (weather.speedKmS >= 600 ||
        weather.stormScale === "S2_MODERATE" ||
        weather.stormScale === "S3_STRONG" ||
        String(weather.scenario).includes("FLARE"));
    const pal = isStorm ? PALETTES.storm : isWarning ? PALETTES.warning : PALETTES.nominal;

    const visualSpeed = (weather.speedKmS / 400) * 145;
    const densityRatio = Math.min(1, Math.max(0.35, weather.densityPcm3 / 18));
    const activeCount = Math.floor(PARTICLE_COUNT * (0.45 + 0.55 * densityRatio));

    const posArr = particleGeo.attributes.position.array;
    const colArr = particleGeo.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (i >= activeCount) {
        posArr[3 * i] = 1e6;
        posArr[3 * i + 1] = 1e6;
        posArr[3 * i + 2] = 1e6;
        continue;
      }
      const rawX = offsets[3 * i] - simTime * visualSpeed * seeds[i];
      const wrappedX = ((((rawX + STREAM_LENGTH / 2) % STREAM_LENGTH) + STREAM_LENGTH) % STREAM_LENGTH) - STREAM_LENGTH / 2;
      posArr[3 * i] = wrappedX;
      posArr[3 * i + 1] = offsets[3 * i + 1];
      posArr[3 * i + 2] = offsets[3 * i + 2];

      const mixFactor = (seeds[i] - 0.65) / 0.7;
      tmpColor.copy(pal.core).lerp(pal.hot, mixFactor);
      colArr[3 * i] = tmpColor.r;
      colArr[3 * i + 1] = tmpColor.g;
      colArr[3 * i + 2] = tmpColor.b;
    }
    particleGeo.attributes.position.needsUpdate = true;
    particleGeo.attributes.color.needsUpdate = true;
    particleMat.size = isStorm ? 9.5 : isWarning ? 8.2 : 6.8;

    parkerMat.color.copy(pal.bow);
    parkerMat.opacity = isStorm ? 0.42 : isWarning ? 0.34 : 0.18;

    // Magnetosfera & Cinturón de Van Allen
    const standoffUnits = Math.max(earthRadiusUnits * 1.45, weather.magnetopauseStandoffRe * earthRadiusUnits * 0.48);
    bowShock.position.copy(earthPos);
    bowShock.quaternion.copy(quat);
    bowShock.scale.set(standoffUnits, standoffUnits * 1.35, standoffUnits * 1.35);
    bowMat.color.copy(pal.bow);
    bowMat.opacity = isStorm ? 0.26 : isWarning ? 0.2 : 0.14;

    vanAllenBelt.position.copy(earthPos);
    vanAllenMat.opacity = isStorm ? 0.24 : isWarning ? 0.18 : 0.1;

    // Auroras polares según Bz sur
    const auroraStrength = Math.min(1, Math.max(0, (-weather.bzNt - 2) / 20));
    auroraNorth.visible = auroraStrength > 0.05;
    auroraSouth.visible = auroraStrength > 0.05;
    if (auroraStrength > 0.05) {
      auroraNorth.position.set(earthPos.x, earthPos.y, earthPos.z + earthRadiusUnits * 0.96);
      auroraSouth.position.set(earthPos.x, earthPos.y, earthPos.z - earthRadiusUnits * 0.96);
      const pulse = 1 + 0.12 * Math.sin(simTime * 6.0);
      const aScale = (0.85 + auroraStrength * 0.45) * pulse;
      auroraNorth.scale.setScalar(aScale);
      auroraSouth.scale.setScalar(aScale);
      auroraMat.color.setHex(isStorm ? 0xe879f9 : 0x34d399);
      auroraMat.opacity = 0.25 + auroraStrength * 0.55;
    }

    // Onda de choque CME direccional
    const showCme =
      weather.cmeActive ||
      weather.primaryImpactZone === "CISLUNAR_AND_EARTH_DIRECT" ||
      String(weather.scenario).includes("MISS");

    cmeGroup.visible = showCme;
    if (showCme) {
      const latRad = THREE.MathUtils.degToRad(weather.sourceLatDeg);
      const lonRad = THREE.MathUtils.degToRad(weather.sourceLonDeg);
      const localDir = new THREE.Vector3(
        -Math.cos(latRad) * Math.cos(lonRad),
        Math.sin(lonRad) * Math.cos(latRad),
        Math.sin(latRad)
      ).normalize();

      cmeDir.copy(localDir).applyQuaternion(quat);
      const wavePeriod = 4.5;
      const phase = (simTime % wavePeriod) / wavePeriod;
      const waveRadius = 80 + phase * 620;

      cmeGroup.position.copy(earthPos).addScaledVector(sunVec, 480);
      cmeGroup.quaternion.setFromUnitVectors(xAxis, cmeDir);
      cmeWave.scale.setScalar(waveRadius);
      cmeWaveMat.color.copy(weather.primaryImpactZone === "DEEP_SPACE_MISS" ? PALETTES.warning.core : pal.core);
      cmeWaveMat.opacity = (1 - phase) * 0.28;
    }

    // Anillo de impacto en Gateway/Luna
    const showImpactRing =
      weather.primaryImpactZone !== "DEEP_SPACE_MISS" &&
      (isStorm || isWarning) &&
      Boolean(gatewayPos || moonPos);
    impactRing.visible = showImpactRing;
    if (showImpactRing) {
      const targetPos = gatewayPos || moonPos;
      impactRing.position.copy(targetPos);
      impactRing.lookAt(cameraPos);
      const pulse = 1 + 0.18 * Math.sin(simTime * 5.0);
      impactRing.scale.setScalar(pulse);
      ringMat.color.copy(pal.core);
      ringMat.opacity = 0.45 + 0.25 * Math.sin(simTime * 5.0);
    }

    // Halo de Storm Shelter alrededor de la nave / Gateway
    const shelterPos = gatewayPos || shipPos;
    shelterHalo.visible = weather.shelterActive && Boolean(shelterPos);
    if (shelterHalo.visible) {
      shelterHalo.position.copy(shelterPos);
      shelterHalo.rotation.y = simTime * 0.8;
      shelterMat.opacity = 0.22 + 0.12 * Math.sin(simTime * 4.0);
    }
  }

  return { setVisible, setWeatherState, setShelterActive, update, isVisible: () => visible };
}
