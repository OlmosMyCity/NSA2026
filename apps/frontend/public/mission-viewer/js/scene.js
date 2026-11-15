// Escena 3D: renderizador, cámara, Tierra, Luna, estrellas y luces.
// Escala: 1 unidad de escena = 1 000 km. El eje +Z de ECI apunta "arriba" (camera.up).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { setLineResolution } from "./trajectory.js";

export const KM_PER_UNIT = 1000;

function texture(renderer, file) {
  const tex = new THREE.TextureLoader().load(`assets/${file}`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/** Halo azul de la atmósfera: brilla en el limbo y se apaga hacia el centro del disco. */
function atmosphere(radius) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.025, 64, 32),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        varying vec3 vNormal;
        void main() {
          #include <logdepthbuf_fragment>
          float rim = pow(clamp(-vNormal.z + 0.75, 0.0, 1.0), 5.0);
          gl_FragColor = vec4(0.32, 0.6, 1.0, 1.0) * rim;
        }`,
    })
  );
}

/**
 * Relieve procedural que aparece al acercarse, donde el mapa ya no tiene resolución (y en los
 * polos se estira). Es decorativo: no representa terreno real.
 */
function addSurfaceDetail(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjectPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjectPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vObjectPos;
        float hash3(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.zyx + 31.32);
          return fract((p.x + p.y) * p.z);
        }
        float valueNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x),
                mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x),
                mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float detail = 0.45 * valueNoise(vObjectPos * 45.0) + 0.3 * valueNoise(vObjectPos * 170.0)
          + 0.17 * valueNoise(vObjectPos * 640.0) + 0.08 * valueNoise(vObjectPos * 2400.0);
        float nearness = 1.0 - smoothstep(0.3, 3.0, length(vViewPosition));
        diffuseColor.rgb *= mix(1.0, 0.55 + 0.9 * detail, nearness);`
      );
  };
}

/** Esfera con los polos sobre el eje Z (SphereGeometry los pone sobre Y). */
function zUpSphere(radius, segments) {
  const geo = new THREE.SphereGeometry(radius, segments, segments / 2);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function starField(count, radius) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    const z = 2 * rnd() - 1;
    const a = 2 * Math.PI * rnd();
    const s = Math.sqrt(1 - z * z);
    pos.set([radius * s * Math.cos(a), radius * s * Math.sin(a), radius * z], 3 * i);
    const b = 0.25 + 0.75 * rnd() ** 3; // pocas estrellas brillantes, muchas tenues
    const warm = rnd() * 0.15;
    col.set([b, b * (1 - warm / 2), b * (1 - warm)], 3 * i);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ vertexColors: true, size: 1.4, sizeAttenuation: false });
  return new THREE.Points(geo, mat);
}

export function createScene(container, bodies) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);

  const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1e-5, 1e9);
  camera.up.set(0, 0, 1);
  camera.position.set(2, -2, 1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1e-3;
  controls.maxDistance = 2e6;

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  scene.add(sun, sun.target);

  const earthRadius = bodies.earth.radius_km / KM_PER_UNIT;
  const earth = new THREE.Mesh(
    zUpSphere(earthRadius, 128),
    new THREE.MeshStandardMaterial({ map: texture(renderer, "earth_blue_marble.jpg"), roughness: 0.85 })
  );
  earth.matrixAutoUpdate = false;
  scene.add(earth);

  const clouds = new THREE.Mesh(
    zUpSphere(earthRadius * 1.006, 96),
    new THREE.MeshStandardMaterial({
      map: texture(renderer, "earth_clouds_1024.png"), transparent: true, opacity: 0.75, depthWrite: false,
    })
  );
  earth.add(clouds);
  earth.add(atmosphere(earthRadius));

  // 256 segmentos: la flecha de cada faceta queda por debajo de 0,2 km, y el descenso es visible
  const moon = new THREE.Mesh(
    zUpSphere(bodies.moon.radius_km / KM_PER_UNIT, 256),
    new THREE.MeshStandardMaterial({ map: texture(renderer, "moon_lroc_4k.jpg"), roughness: 1 })
  );
  addSurfaceDetail(moon.material);
  moon.matrixAutoUpdate = false;
  scene.add(moon);

  const stars = starField(3500, 8e3);
  scene.add(stars);

  // Solar System planets (positioned in deep space outside Earth-Moon orbit for interplanetary context)
  function planetTexture(palette, banded = false) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 128);
    palette.forEach(([stop, color]) => grad.addColorStop(stop, color));
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
    let s = palette.length * 131 + 17;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < (banded ? 40 : 120); i++) {
      g.fillStyle = `rgba(255,255,255,${(rnd() * 0.12).toFixed(3)})`;
      if (banded) {
        g.fillRect(0, rnd() * 128, 256, 2 + rnd() * 8);
      } else {
        g.beginPath();
        g.arc(rnd() * 256, rnd() * 128, 2 + rnd() * 14, 0, Math.PI * 2);
        g.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makePlanet(radiusUnits, palette, posUnits, banded = false, hasRing = false) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      zUpSphere(radiusUnits, 48),
      new THREE.MeshStandardMaterial({ map: planetTexture(palette, banded), roughness: 0.88 })
    );
    group.add(mesh);
    if (hasRing) {
      const ringGeo = new THREE.RingGeometry(radiusUnits * 1.35, radiusUnits * 2.25, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xd8c7a0,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = 0.42;
      group.add(ring);
    }
    group.userData.basePos = posUnits;
    group.position.set(...posUnits);
    scene.add(group);
    return group;
  }

  const solarPlanets = {
    mercury: makePlanet(14, [[0, "#9c958d"], [0.5, "#7d776f"], [1, "#a79f96"]], [1150, -680, -140]),
    venus: makePlanet(24, [[0, "#e8c888"], [0.5, "#d4a962"], [1, "#f0d9a8"]], [1420, -1180, -220], true),
    mars: makePlanet(22, [[0, "#d87c52"], [0.45, "#b34d2e"], [0.85, "#8f371e"], [1, "#e8ddd4"]], [-1280, 1460, 260]),
    jupiter: makePlanet(68, [[0, "#d9c2a3"], [0.25, "#c68e5c"], [0.5, "#e6d6be"], [0.75, "#b56942"], [1, "#cbb192"]], [-2150, 2450, 480], true),
    saturn: makePlanet(56, [[0, "#e6d4a3"], [0.5, "#cdb47a"], [1, "#e9dcb8"]], [-3100, 1850, -520], true, true),
  };

  const EXTRA_PALETTES = {
    venus: { palette: [[0, "#e8c888"], [0.5, "#d4a962"], [1, "#f0d9a8"]], banded: true },
    mars: { palette: [[0, "#d87c52"], [0.45, "#b34d2e"], [0.85, "#8f371e"], [1, "#e8ddd4"]], banded: false },
    jupiter: { palette: [[0, "#d9c2a3"], [0.25, "#c68e5c"], [0.5, "#e6d6be"], [0.75, "#b56942"], [1, "#cbb192"]], banded: true },
    saturn: { palette: [[0, "#e6d4a3"], [0.5, "#cdb47a"], [1, "#e9dcb8"]], banded: true },
  };
  const extraMeshes = {};
  for (const b of bodies.extra || []) {
    if (solarPlanets[b.id]) solarPlanets[b.id].visible = false;
    const rUnits = b.radius_km / KM_PER_UNIT;
    let mesh;
    if (b.id === "sun") {
      mesh = new THREE.Mesh(
        zUpSphere(rUnits, 64),
        new THREE.MeshBasicMaterial({ color: b.color || "#ffd166" })
      );
    } else {
      const style = EXTRA_PALETTES[b.id] || {
        palette: [[0, b.color || "#94a3b8"], [0.5, "#64748b"], [1, b.color || "#cbd5e1"]],
        banded: false,
      };
      mesh = new THREE.Mesh(
        zUpSphere(rUnits, 64),
        new THREE.MeshStandardMaterial({ map: planetTexture(style.palette, style.banded), roughness: 0.85 })
      );
    }
    scene.add(mesh);
    extraMeshes[b.id] = mesh;
  }

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    setLineResolution(container.clientWidth, container.clientHeight);
  }
  setLineResolution(container.clientWidth, container.clientHeight);
  window.addEventListener("resize", resize);

  return { THREE, renderer, scene, camera, controls, sun, earth, clouds, moon, stars, solarPlanets, extraMeshes };
}

/** Matrix4 de Three.js a partir de una 3×3 por filas y una traslación. */
export function setMatrix(m4, M, tx, ty, tz) {
  m4.set(M[0], M[1], M[2], tx, M[3], M[4], M[5], ty, M[6], M[7], M[8], tz, 0, 0, 0, 1);
}

export function rotZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** Traspuesta de una 3×3 por filas. */
export function transpose3(M) {
  return [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];
}

export function mul3(A, B) {
  const out = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      out[3 * i + j] = A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j];
  return out;
}
