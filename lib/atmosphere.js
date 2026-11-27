// Realistic look for the showroom stage: textured facade materials, a physical sky with the sun at
// its true position for a clock time and date (Mumbai), sun shadows, sky-lit reflections, and a
// neighbourhood that lights up after dark (street lamps with light pools on the ground, lit windows
// in the neighbouring blocks, the stilt lit from inside). Installed by createProjectStage when it
// is created with { real: true }; the guided tour keeps the plain look.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createPost } from './postfx.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const LAT = 19.07, LON = 72.88, TZ = 5.5;   // Mumbai suburbs, IST
const D2R = Math.PI / 180;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Sun elevation / azimuth (degrees, azimuth clockwise from north) for local clock hours on a day of the year */
export function sunPosition(hour, doy, lat = LAT, lon = LON, tz = TZ) {
  const B = (2 * Math.PI * (doy - 81)) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);   // minutes
  const decl = 23.45 * Math.sin((2 * Math.PI * (284 + doy)) / 365) * D2R;
  const lst = hour + (4 * (lon - 15 * tz) + eot) / 60;
  const hra = 15 * (lst - 12) * D2R, phi = lat * D2R;
  const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hra);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(decl) * Math.cos(phi) - Math.cos(decl) * Math.sin(phi) * Math.cos(hra)) / Math.max(1e-6, Math.cos(el)))));
  if (hra > 0) az = 2 * Math.PI - az;
  return { el: el / D2R, az: az / D2R };
}
/** Clock hours of sunrise and sunset (sun centre at -0.83 deg) for a day of the year */
export function sunTimes(doy) {
  const find = (a, b) => { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; (sunPosition(m, doy).el > -0.83) === (sunPosition(a, doy).el > -0.83) ? (a = m) : (b = m); } return (a + b) / 2; };
  return { rise: find(3, 12.5), set: find(12.5, 21) };
}
export const dayOfYear = (d = new Date()) => Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);

// facade finishes: texture set, metres per repeat, and how the texture is tinted
// Painted surfaces carry no image texture (box-projected plaster showed seams and blotches): they are
// a flat paint colour with a faint world-space mottle added in the shader. Only paving and wood
// keep texture sets.
const PAINT = {
  ArchWalls: { rough: 0.82 }, CompoundWall: { rough: 0.85 },
  Chajja: { color: 0xf6f3ec, rough: 0.7 }, Parapets: { color: 0xf6f3ec, rough: 0.7 }, Trim: { color: 0xf6f3ec, rough: 0.65 },
  TerraceCore: { color: 0xf1ede4, rough: 0.8 }, LMR: { color: 0xf1ede4, rough: 0.8 },
  Slabs: { color: 0xf1ede4, rough: 0.8 }, Plinth: { color: 0xb9b2a6, rough: 0.9 }, OverheadTank: { color: 0xdfe2e6, rough: 0.75 },
  Columns: { color: 0xf1ede4, rough: 0.8 },
};
const NO_AO = new Set(['Glass', 'Grills', 'Signage', 'SignLogo', 'Water']);
const TEX_CAT = {
  Terrace: { tex: 'square_concrete_pavers', size: 1.2, color: 0xd9d2c6 },
  Plot: { tex: 'square_concrete_pavers', size: 1.6, color: 0xe0d6c8 },
  Doors: { tex: 'oak_veneer_01', size: 1.2 },
};
const AVG = { plastered_wall_02: [186, 178, 163], white_stucco: [215, 211, 208], square_concrete_pavers: [124, 103, 82], oak_veneer_01: [161, 126, 87] };

/** planar texture coordinates per triangle, projected on the dominant axis (metres / size) */
function boxUV(mesh, size) {
  let g = mesh.geometry;
  if (g.attributes.uv && g.userData.boxUV) return;
  if (g.index) g = g.toNonIndexed();
  const pos = g.attributes.position, uv = new Float32Array(pos.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const k = 1 / size;
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b));
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    for (let j = 0; j < 3; j++) {
      const p = j === 0 ? a : j === 1 ? b : c;
      const [u, v] = ay >= ax && ay >= az ? [p.x, p.z] : ax >= az ? [p.z, p.y] : [p.x, p.y];
      uv[(i + j) * 2] = u * k; uv[(i + j) * 2 + 1] = v * k;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.userData.boxUV = true;
  mesh.geometry = g;
}

function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }

export function createAtmosphere(ctx) {
  const { scene, renderer, camera, el, sun, hemi, fill, moon, lamp, ground, groundMat, nb, stars, center, H, project, shadows, dirty, setNightBase } = ctx;
  renderer.toneMapping = THREE.NeutralToneMapping;   // keeps paint colours truer than ACES
  const narrow = ctx.narrow;
  const north = project.north || 0;   // radians: drawing north is model -Z unless a project says otherwise
  const tl = new THREE.TextureLoader();
  const texCache = {};
  const tex = (name, kind) => {
    const key = `${name}_${kind}`;
    if (!texCache[key]) {
      const t = tl.load(`/assets/tex/${key}.webp`, dirty);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
      if (kind === 'diff') t.colorSpace = THREE.SRGBColorSpace;
      texCache[key] = t;
    }
    return texCache[key];
  };

  // ---------- facade materials ----------
  const mottle = (m, amount) => {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvPaintW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vPaintW;
float pHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pNoise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i), pHash(i + vec3(1,0,0)), f.x), mix(pHash(i + vec3(0,1,0)), pHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0,0,1)), pHash(i + vec3(1,0,1)), f.x), mix(pHash(i + vec3(0,1,1)), pHash(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
  float pm = pNoise(vPaintW * 0.35) * 0.6 + pNoise(vPaintW * 1.7) * 0.3 + pNoise(vPaintW * 9.0) * 0.1;
  diffuseColor.rgb *= 1.0 + (pm - 0.5) * ${amount.toFixed(3)};`);
    };
    m.customProgramCacheKey = () => 'paint' + amount;
  };
  const one = (name, opts = {}) => {
    if (!texCache[name]) { const t = tl.load(`/assets/tex/${name}.webp`, dirty); t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 8; if (opts.flipY === false) t.flipY = false; texCache[name] = t; }
    return texCache[name];
  };
  const catInfo = {};   // category -> { ao: every mesh so far has a second UV set, normals: real normals }
  function dress(m, cat) {
    const d = TEX_CAT[cat], pnt = PAINT[cat], ci = catInfo[cat] || {};
    if (ci.normals) m.flatShading = false;
    if (ci.ao && project.ao && !NO_AO.has(cat)) { m.aoMap = one(project.ao, { linear: true, flipY: false }); m.aoMap.channel = 1; m.aoMapIntensity = 1.0; }
    if (cat === 'Glass') { Object.assign(m, { roughness: 0.03, metalness: 0.0, envMapIntensity: 2.2, opacity: 0.86 }); m.color.set(0x1d2b33); m.userData.baseOpacity = 0.86; windowsAtNight(m); return; }
    if (cat === 'WindowFrames') { m.color.set(0x23272b); m.roughness = 0.45; m.metalness = 0.5; return; }
    if (cat === 'Handrails' || cat === 'Railings' || cat === 'Ironwork') { m.color.set(0x1d2023); m.roughness = 0.5; m.metalness = 0.6; return; }
    if (cat === 'Grills') { Object.assign(m, { map: one('kk_grill', { flipY: false }), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.5 }); m.color.set(0x1a1c1f); return; }
    if (cat === 'Signage' || cat === 'SignLogo') { Object.assign(m, { map: one(cat === 'Signage' ? 'kk_sign' : 'kk_logo', { flipY: false }), alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.35, metalness: 0.6 }); m.color.set(0xffffff); return; }
    if (cat === 'Cars') { Object.assign(m, { roughness: 0.25, metalness: 0.6, envMapIntensity: 1.4 }); m.color.set(0x8d9299); return; }
    if (cat === 'ArchWalls' && project.paint) m.color.set(project.paint);
    if (pnt) { if (pnt.color != null) m.color.set(pnt.color); m.roughness = pnt.rough; mottle(m, cat === 'ArchWalls' || cat === 'CompoundWall' ? 0.07 : 0.04); if (cat === 'CompoundWall' && (project.paint || project.wall)) m.color.set(project.paint || project.wall); return; }
    if (!d) return;
    m.map = tex(d.tex, 'diff'); m.normalMap = tex(d.tex, 'nor'); m.roughnessMap = tex(d.tex, 'rough');
    m.normalScale = new THREE.Vector2(0.6, 0.6); m.roughness = 1;
    // tint: divide out the texture's average so the finish keeps the architect's colour
    const avg = AVG[d.tex].map((v) => new THREE.Color().setRGB(v / 255, v / 255, v / 255, THREE.SRGBColorSpace).r);
    const target = new THREE.Color(d.tint ? m.color : (d.color ?? 0xffffff));
    if (d.tint || d.color) m.color.setRGB(target.r / avg[0], target.g / avg[1], target.b / avg[2]);
    else m.color.set(0xffffff);
    m.needsUpdate = true;
  }
  function prep(mesh, cat) {
    const g = mesh.geometry, ci = (catInfo[cat] = catInfo[cat] || { ao: true, normals: true });   // normals: always true once prep has run
    if (!g.attributes.uv1) ci.ao = false;
    if (!g.attributes.normal) {
      // older models carry no normals: give each face its own, so the occlusion pass and smooth lighting have something to work with
      const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals(); mesh.geometry = ng;
    }
    const d = TEX_CAT[cat]; if (d) boxUV(mesh, d.size);
  }
  // lit windows after dark are not all alike: each pane picks its own state (dark, dim, warm, cool)
  // from its position, with a brighter band low in the pane where a lamp or curtain would be
  const glassNight = { value: 0 };
  function windowsAtNight(m) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uGlassNight = glassNight;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlassW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvGlassW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vGlassW;
uniform float uGlassNight;
float gHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  vec3 gCell = floor(vec3((vGlassW.x + 0.7) / 3.3, vGlassW.y / 2.7, (vGlassW.z + 0.7) / 3.3));
  float gOn = step(0.42, gHash(gCell));
  float gLvl = 0.35 + 0.65 * gHash(gCell + 3.1);
  vec3 gTint = mix(vec3(1.0, 0.72, 0.42), vec3(0.95, 0.9, 0.8), gHash(gCell + 7.7));
  float gY = fract(vGlassW.y / 2.7);
  float gShade = mix(1.0, 0.55, smoothstep(0.15, 0.6, gY)) * (0.8 + 0.2 * gHash(floor(vGlassW * 6.0)));
  totalEmissiveRadiance = gTint * gOn * gLvl * gShade * uGlassNight * 2.6;`);
    };
    m.customProgramCacheKey = () => 'glass-night';
  }

  // ---------- sky ----------
  const sky = new Sky();
  sky.scale.setScalar(900); sky.position.copy(center).setY(0);
  const su = sky.material.uniforms;
  su.turbidity.value = 7; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.82;
  su.uNight = { value: 0 }; su.uNightCol = { value: new THREE.Color(0x0b1628) }; su.uGain = { value: 0.55 };
  su.uTwi = { value: 0 }; su.uTwiZen = { value: new THREE.Color(0x16265a) }; su.uTwiHor = { value: new THREE.Color(0x6f7fae) }; su.uTwiGlow = { value: new THREE.Color(0xff9a5a) };
  su.uCloudLit = { value: new THREE.Color(1, 1, 1) }; su.uCloudShade = { value: new THREE.Color(0.6, 0.66, 0.75) };
  su.uCover = { value: 0.52 }; su.uCloudShift = { value: new THREE.Vector2(3.1, 1.7) };
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('void main() {', `uniform float uNight; uniform vec3 uNightCol; uniform float uGain;
uniform float uTwi; uniform vec3 uTwiZen; uniform vec3 uTwiHor; uniform vec3 uTwiGlow;
uniform vec3 uCloudLit; uniform vec3 uCloudShade; uniform float uCover; uniform vec2 uCloudShift;
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1, 0)), f.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), f.x), f.y); }
float cFbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * cNoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main() {`)
    .replace('gl_FragColor = vec4( retColor, 1.0 );', `retColor *= uGain;
			float skyH = max(direction.y, 0.0);
			// the hour after sunset: deep blue overhead, a pale band at the horizon, a warm glow where the sun went down
			vec3 twi = mix(uTwiHor, uTwiZen, pow(skyH, 0.42));
			float towardSun = max(dot(normalize(direction.xz + 1e-5), normalize(vSunDirection.xz + 1e-5)), 0.0);
			twi += uTwiGlow * pow(towardSun, 3.0) * pow(1.0 - skyH, 7.0) * 0.8;
			retColor = mix(retColor, twi, uTwi);
			// broken cloud, thinning to haze at the horizon
			vec2 cp = direction.xz / (direction.y + 0.14) * 1.5 + uCloudShift;
			float cl = cFbm(cp);
			float cover = smoothstep(uCover, uCover + 0.3, cl) * smoothstep(0.015, 0.2, direction.y);
			vec3 cloud = mix(uCloudShade, uCloudLit, smoothstep(0.45, 0.95, cFbm(cp * 0.9 + 4.0) + 0.25 * towardSun));
			retColor = mix(retColor, cloud, cover * 0.9);
			retColor = mix(retColor, uNightCol, uNight);
			gl_FragColor = vec4( retColor, 1.0 );`);
  scene.add(sky);
  const prevBg = scene.background;
  scene.background = null;
  // the reflections come from the same sky, re-baked when the sun has moved far enough
  const envScene = new THREE.Scene();
  const envSky = new Sky(); envSky.material = sky.material; envSky.scale.setScalar(100); envScene.add(envSky);
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6f6a5c }));
  envGround.position.y = -2; envScene.add(envGround);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, envKey = '';
  function bakeEnv(key) {
    if (key === envKey) return;
    envKey = key;
    const rt = pmrem.fromScene(envScene, 0.02, 0.1, 400);
    if (envRT) envRT.dispose();
    envRT = rt; scene.environment = rt.texture;
  }

  // ---------- ground and surroundings ----------
  const P = project.bounds.plot;
  const grass = canvasTex(512, 512, (g, w, h) => {
    const r = rng(11); g.fillStyle = '#6f8050'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${95 + r() * 40 | 0},${110 + r() * 30 | 0},${60 + r() * 20 | 0},0.10)`; g.beginPath(); g.arc(r() * w, r() * h, 40 + r() * 90, 0, 7); g.fill(); }
    for (let i = 0; i < 22000; i++) { const c = 85 + r() * 50; g.fillStyle = `rgba(${c * 0.8 | 0},${c | 0},${c * 0.5 | 0},0.22)`; g.fillRect(r() * w, r() * h, 1, 1 + r() * 2); }
  });
  grass.repeat.set(220, 220);
  groundMat.map = grass; groundMat.color.set(0xffffff); groundMat.needsUpdate = true;
  ground.geometry = new THREE.CircleGeometry(900, 72);   // uv 0..1 over the disc
  // a paved footpath round the compound, where the street lamps stand
  const pathMat = new THREE.MeshStandardMaterial({ map: tex('square_concrete_pavers', 'diff'), normalMap: tex('square_concrete_pavers', 'nor'), roughness: 1, color: 0xd9d0c2 });
  const PW = 3.2, gx0 = P.x[0] - 1.2, gx1 = P.x[1] + 1.2, gz0 = P.z[0] - 1.2, gz1 = P.z[1] + 1.2;
  const pathShape = new THREE.Shape([[gx0 - PW, gz0 - PW], [gx1 + PW, gz0 - PW], [gx1 + PW, gz1 + PW], [gx0 - PW, gz1 + PW]].map(([x, z]) => new THREE.Vector2(x, z)));
  pathShape.holes.push(new THREE.Path([[gx0, gz0], [gx0, gz1], [gx1, gz1], [gx1, gz0]].map(([x, z]) => new THREE.Vector2(x, z))));
  const pathGeo = new THREE.ShapeGeometry(pathShape).rotateX(Math.PI / 2);
  { const pos = pathGeo.attributes.position, uv = pathGeo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 1.6, pos.getZ(i) / 1.6); }
  const path = new THREE.Mesh(pathGeo, pathMat); path.position.y = -0.09; path.receiveShadow = shadows;
  scene.add(path);

  // street lamps every ~13 m along the footpath, with soft pools of light on the ground at night
  const lampPts = [];
  const along = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 13)); for (let i = 0; i <= n; i++) lampPts.push([lerp(x0, x1, i / n), lerp(z0, z1, i / n)]); };
  const lx0 = gx0 - PW * 0.75, lx1 = gx1 + PW * 0.75, lz0 = gz0 - PW * 0.75, lz1 = gz1 + PW * 0.75;
  along(lx0, lz1, lx1, lz1); along(lx1, lz1 - 13, lx1, lz0); along(lx1 - 13, lz0, lx0, lz0); along(lx0, lz0 + 13, lx0, lz1 - 13);
  const uniq = lampPts.filter((p, i) => lampPts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 4) === i);
  const POLE_H = 6;
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, POLE_H, 8).translate(0, POLE_H / 2, 0);
  const headGeo = new THREE.BoxGeometry(0.7, 0.12, 0.3).translate(0, POLE_H, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3b3f44, roughness: 0.5, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x9a9a92, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, uniq.length), heads = new THREE.InstancedMesh(headGeo, headMat, uniq.length);
  const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,232,196,1)'); gr.addColorStop(0.35, 'rgba(255,214,160,0.4)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const pools = new THREE.Group();
  const mtx = new THREE.Matrix4();
  uniq.forEach(([x, z], i) => {
    // the arm faces the plot
    const ang = Math.atan2(center.z - z, center.x - x);
    mtx.makeRotationY(-ang).setPosition(x, 0, z);
    poles.setMatrixAt(i, mtx); heads.setMatrixAt(i, mtx);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), poolMat); pool.position.set(x, -0.05, z); pools.add(pool);
    const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(2.2); halo.position.set(x, POLE_H - 0.1, z); pools.add(halo);
  });
  poles.castShadow = shadows;
  scene.add(poles, heads, pools);
  // four real lights carry the street lamps onto the building; the rest are glow only
  const streetLights = [0, 0.25, 0.5, 0.75].map((f) => {
    const p = uniq[Math.floor(f * uniq.length) % uniq.length];
    const l = new THREE.PointLight(0xffe2bd, 0, 34, 1.6); l.position.set(p[0], POLE_H - 0.3, p[1]); scene.add(l); return l;
  });
  // the stilt floor lit from inside after dark
  const stiltLight = new THREE.PointLight(0xffe0b0, 0, 28, 1.4);
  stiltLight.position.set(center.x, 1.9, center.z); scene.add(stiltLight);

  // ---------- road, parked cars and trees (indicative context, like the lamps) ----------
  const side = project.road?.side || '+z';
  const ctxGroup = new THREE.Group(); scene.add(ctxGroup);
  const RW = 7, cxm = (gx0 + gx1) / 2, czm = (gz0 + gz1) / 2;
  const roadG = new THREE.Group();
  if (side === '+z') roadG.position.set(cxm, 0, gz1 + PW + RW / 2 + 0.2);
  else if (side === '-z') { roadG.position.set(cxm, 0, gz0 - PW - RW / 2 - 0.2); roadG.rotation.y = Math.PI; }
  else if (side === '+x') { roadG.position.set(gx1 + PW + RW / 2 + 0.2, 0, czm); roadG.rotation.y = Math.PI / 2; }
  else { roadG.position.set(gx0 - PW - RW / 2 - 0.2, 0, czm); roadG.rotation.y = -Math.PI / 2; }
  const asphalt = canvasTex(512, 256, (g, w, h) => {
    const r = rng(5); g.fillStyle = '#3b3c3f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const c = 40 + r() * 45; g.fillStyle = `rgba(${c | 0},${c | 0},${(c + 3) | 0},0.5)`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = 'rgba(235,232,220,0.85)'; for (let x = 0; x < w; x += 128) g.fillRect(x + 16, h / 2 - 3, 64, 6);
    g.fillStyle = 'rgba(235,232,220,0.6)'; g.fillRect(0, 10, w, 3); g.fillRect(0, h - 13, w, 3);
  });
  const ROAD_L = 220; asphalt.repeat.set(ROAD_L / 12, 1);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_L, RW).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  road.position.y = -0.1; road.receiveShadow = shadows; roadG.add(road);
  const kerbMat = new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 0.9 });
  for (const zz of [-RW / 2 - 0.1, RW / 2 + 0.1]) { const k = new THREE.Mesh(new THREE.BoxGeometry(ROAD_L, 0.16, 0.2), kerbMat); k.position.set(0, -0.04, zz); k.receiveShadow = shadows; roadG.add(k); }
  // simple cars parked along the near kerb
  const carGlass = new THREE.MeshStandardMaterial({ color: 0x151b22, roughness: 0.08, metalness: 0.2, envMapIntensity: 1.6 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.9 });
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14).rotateX(Math.PI / 2);
  const mkCar = (col, x, len = 4.2) => {
    const g = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color: col, roughness: 0.28, metalness: 0.55, envMapIntensity: 1.3 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.62, 1.72), paint); body.position.y = 0.62;
    const cabinShape = new THREE.Shape([[-len * 0.3, 0], [len * 0.26, 0], [len * 0.14, 0.52], [-len * 0.2, 0.52]].map(([a, b]) => new THREE.Vector2(a, b)));
    const cabin = new THREE.Mesh(new THREE.ExtrudeGeometry(cabinShape, { depth: 1.5, bevelEnabled: false }).translate(0, 0.93, -0.75), carGlass);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(len * 0.36, 0.05, 1.52), paint); roof.position.set(-len * 0.03, 1.47, 0);
    g.add(body, cabin, roof);
    for (const [wx, wz] of [[-len * 0.3, 0.8], [len * 0.3, 0.8], [-len * 0.3, -0.8], [len * 0.3, -0.8]]) { const wh = new THREE.Mesh(wheelGeo, tyre); wh.position.set(wx, 0.32, wz); g.add(wh); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; } });
    g.position.set(x, -0.1, -RW / 2 + 1.25); roadG.add(g); return g;
  };
  if (project.cars !== false) { mkCar(0xc9ccd1, -14); mkCar(0x1b1d21, 9.5, 4.5); mkCar(0x7d1f24, 31, 3.9); }
  ctxGroup.add(roadG);
  // trees: displaced, clustered canopies on a trunk; kept clear of the road and the neighbouring blocks
  const trees = [];
  {
    const r = rng(97);
    const canopyGeo = (() => {
      const g0 = new THREE.IcosahedronGeometry(1, 4); g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
      const g = mergeVertices(g0), pos = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const n = Math.sin(v.x * 5.1 + 1.3) * Math.sin(v.y * 4.3 + 0.7) * Math.sin(v.z * 4.7 + 2.1); v.multiplyScalar(1 + n * 0.25 + Math.sin(v.x * 13 + v.z * 11) * 0.06 + Math.sin(v.y * 23 + v.x * 19) * Math.sin(v.z * 21) * 0.05); pos.setXYZ(i, v.x, v.y, v.z); }
      g.computeVertexNormals(); return g;
    })();
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 1, 7).translate(0, 0.5, 0);
    const nbBoxes = nb.children.map((m) => new THREE.Box3().setFromObject(m).expandByScalar(2.5));
    const roadBox = new THREE.Box3().setFromObject(roadG).expandByScalar(1.2);
    const inner = new THREE.Box3(new THREE.Vector3(gx0 - PW - 1, -5, gz0 - PW - 1), new THREE.Vector3(gx1 + PW + 1, 50, gz1 + PW + 1));
    const GREENS = [0x2f4a25, 0x3a5a2b, 0x2a4322, 0x466331];
    let tries = 0;
    while (trees.length < 16 && tries++ < 400) {
      const ang = r() * Math.PI * 2, rad = 6 + r() * 26;
      const x = cxm + Math.cos(ang) * ((gx1 - gx0) / 2 + PW + rad), z = czm + Math.sin(ang) * ((gz1 - gz0) / 2 + PW + rad), pt = new THREE.Vector3(x, 1, z);
      if (inner.containsPoint(pt) || roadBox.containsPoint(pt) || nbBoxes.some((b) => b.containsPoint(pt)) || trees.some((t) => t.position.distanceTo(new THREE.Vector3(x, 0, z)) < 6)) continue;
      const hgt = 5.5 + r() * 4.5, t = new THREE.Group(); t.position.set(x, -0.1, z);
      const leaf = new THREE.MeshStandardMaterial({ color: GREENS[trees.length % 4], roughness: 0.95, transparent: true });
      const bark = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1, transparent: true });
      mottle(leaf, 0.9);
      const trunk = new THREE.Mesh(trunkGeo, bark); trunk.scale.set(1.2, hgt * 0.5, 1.2); t.add(trunk);
      const lobes = 3 + Math.floor(r() * 3);
      for (let k = 0; k < lobes; k++) {
        const c = new THREE.Mesh(canopyGeo, leaf), sz = hgt * (0.24 + r() * 0.1);
        c.scale.set(sz * (0.9 + r() * 0.3), sz * (0.75 + r() * 0.25), sz * (0.9 + r() * 0.3));
        c.position.set((r() - 0.5) * hgt * 0.3, hgt * (0.55 + r() * 0.3), (r() - 0.5) * hgt * 0.3); c.rotation.y = r() * 6.28; t.add(c);
      }
      t.traverse((o) => { if (o.isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; } });
      t.userData.mats = [leaf, bark]; t.userData.box = new THREE.Box3().setFromObject(t); t.userData.fade = 1; t.userData.cast = true;
      trees.push(t); ctxGroup.add(t);
    }
  }

  // neighbouring blocks: plastered facades with a grid of windows, some lit at night
  const nbMats = [];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 1, transparent: true });
  nbMats.push(roofMat);
  nb.children.forEach((m, i) => {
    // two- to four-storey houses, as around the site in the architect's render
    const hh = 6.4 + ((i * 5) % 4) * 2.1;
    m.scale.y = hh / m.geometry.parameters.height; m.position.y = hh / 2; m.updateMatrixWorld(true);
    const p = { ...m.geometry.parameters, height: hh }, r = rng(31 + i * 7);
    const face = (w, h) => {
      const cols = Math.max(2, Math.round(w / 3.4)), rows = Math.max(1, Math.round(h / 3.0));
      const lit = [];
      const mk = (night) => canvasTex(cols * 32, rows * 32, (g) => {
        g.fillStyle = night ? '#000' : ['#d9cfbf', '#cfd3cf', '#e2d6c4', '#cbbfae'][i % 4]; g.fillRect(0, 0, cols * 32, rows * 32);
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
          const k = y * cols + x; if (!night) lit[k] = r() < 0.42 ? 0.55 + r() * 0.45 : 0;
          const wx = x * 32 + 8, wy = y * 32 + 9;
          if (night) { if (lit[k]) { g.fillStyle = `rgba(255,${190 + (lit[k] * 40) | 0},${120 + (lit[k] * 60) | 0},${lit[k]})`; g.fillRect(wx, wy, 16, 14); } }
          else { g.fillStyle = '#4c5966'; g.fillRect(wx, wy, 16, 14); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(wx - 2, wy + 14, 20, 2); }
        }
      });
      const day = mk(false), nightT = mk(true);
      day.wrapS = day.wrapT = nightT.wrapS = nightT.wrapT = THREE.ClampToEdgeWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: day, emissiveMap: nightT, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.95, transparent: true });
      nbMats.push(mat); return mat;
    };
    const fx = face(p.depth, p.height), fz = face(p.width, p.height);
    m.material = [fx, fx, roofMat.clone(), roofMat.clone(), fz, fz];
    nbMats.push(m.material[2], m.material[3]);
    m.userData.mats = [fx, fz, m.material[2], m.material[3]];
    m.userData.box = new THREE.Box3().setFromObject(m);
    m.userData.fade = 1;
  });
  // blocks that stand between the camera and the building fade out of the way
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4();
  const RB = Math.hypot(project.bounds.x[1] - project.bounds.x[0], project.bounds.z[1] - project.bounds.z[0]) / 2;
  let context = 1;
  function update(camera, look) {
    let changed = false;
    const d = camera.position.distanceTo(look);
    camera.updateMatrixWorld(); pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
    for (const m of [...nb.children, ...trees]) {
      const box = m.userData.box;
      // in view and nearer to the camera than the building's near side: it would stand in front of it
      const blocks = frustum.intersectsBox(box) && box.distanceToPoint(camera.position) < d - RB * 0.6;
      const to = blocks ? 0.0 : 1;
      if (Math.abs(m.userData.fade - to) > 0.01) { m.userData.fade += (to - m.userData.fade) * 0.25; changed = true; } else m.userData.fade = to;
      const o = m.userData.fade * context;
      for (const mm of m.userData.mats) { mm.opacity = o; mm.depthWrite = o > 0.9; }
      m.visible = o > 0.02;
      if (m.isMesh) m.castShadow = shadows && o > 0.5; else if (m.userData.cast !== o > 0.5) { m.userData.cast = o > 0.5; m.traverse((q) => { if (q.isMesh) q.castShadow = shadows && o > 0.5; }); }
    }
    roadG.visible = path.visible = poles.visible = heads.visible = pools.visible = context > 0.5;
    return changed;
  }

  // ---------- time of day ----------
  const WARM = new THREE.Color(0xff9a52), GOLD = new THREE.Color(0xffd2a1), NOON = new THREE.Color(0xfff5e8);
  const HEMI_DAY = new THREE.Color(0xe4ebf2), HEMI_GOLD = new THREE.Color(0xf3c9a0), HEMI_TWI = new THREE.Color(0x6f86c9), HEMI_NIGHT = new THREE.Color(0x2c3c63);
  const FOG_DAY = new THREE.Color(0xc9d6e2), FOG_GOLD = new THREE.Color(0xe8c7a8), FOG_NIGHT = new THREE.Color(0x0d1729);
  const dir = new THREE.Vector3(), tmpC = new THREE.Color();
  if (shadows) {
    sun.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048);
    sun.shadow.map?.dispose(); sun.shadow.map = null;
    sun.shadow.radius = 3;
  }
  let info = { el: 0, az: 0, night: 0 };
  let interior = 0;   // 0..1: a furnished flat or floor is open
  function setTime(hour, doy) {
    const { el, az } = sunPosition(hour, doy);
    const a = az * D2R + north, e = el * D2R;
    dir.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    const lit = smooth(1.5, -4.5, el);               // lamps and windows come on through sunset
    const dark = smooth(-4, -15, el);                // the sky and the ambient light go last
    const twi = smooth(2.5, -3, el) * (1 - dark);    // blue hour
    const night = lit;
    const golden = 1 - smooth(4, 22, el);           // low sun: warm light, long shadows
    setNightBase(dark);                              // stars, glazing opacity
    glassNight.value = lit;
    // sun: follows its true position; fades out just below the horizon
    const up = Math.max(dir.y, 0.03);
    sun.position.copy(dir).setY(up).normalize().multiplyScalar(140).add(center);
    sun.target.position.copy(center);
    sun.intensity = 3.0 * smooth(-1.5, 6, el) * (0.55 + 0.45 * smooth(5, 40, el));
    sun.color.copy(NOON).lerp(GOLD, golden).lerp(WARM, smooth(0.6, 1, golden));
    // moon opposite the sun, faint
    moon.position.copy(center).add(new THREE.Vector3(-dir.x, Math.max(0.5, -dir.y), -dir.z).normalize().multiplyScalar(120));
    moon.intensity = 0.5 * dark;
    hemi.color.copy(HEMI_DAY).lerp(HEMI_GOLD, golden * (1 - twi)).lerp(HEMI_TWI, twi).lerp(HEMI_NIGHT, dark);
    hemi.groundColor.set(0xb8a88e).lerp(tmpC.set(0x2a2f3d), Math.max(twi, dark)).lerp(tmpC.set(0x141a24), dark);
    hemi.intensity = lerp(lerp(0.85, 0.45, twi), 0.2, dark) + interior * (project.unitLight ? 0.05 : 0.35);   // opened-up flats get extra fill
    fill.intensity = lerp(0.14, 0.05, Math.max(twi, dark));
    // sky
    su.sunPosition.value.copy(dir);
    su.uTwi.value = twi; su.uNight.value = dark * 0.97;
    su.turbidity.value = lerp(6, 10, golden);
    const day = 1 - Math.max(twi, dark);
    su.uCloudLit.value.setRGB(1, 1, 1).lerp(tmpC.setRGB(1.0, 0.72, 0.5), golden * day).lerp(tmpC.setRGB(0.42, 0.4, 0.52), twi).lerp(tmpC.setRGB(0.05, 0.065, 0.11), dark);
    su.uCloudShade.value.setRGB(0.62, 0.68, 0.77).lerp(tmpC.setRGB(0.48, 0.44, 0.52), golden * day).lerp(tmpC.setRGB(0.2, 0.23, 0.36), twi).lerp(tmpC.setRGB(0.03, 0.04, 0.075), dark);
    scene.fog.color.copy(FOG_DAY).lerp(FOG_GOLD, golden * day).lerp(tmpC.set(0x5a678f), twi).lerp(FOG_NIGHT, dark);
    scene.environmentIntensity = lerp(lerp(0.75, 0.9, twi), 0.45, dark);
    renderer.toneMappingExposure = lerp(lerp(0.92, 1.1, twi), 1.0, dark);
    // surroundings after dark: warm-white lamps, kept low enough that the facade keeps its own colour
    headMat.emissiveIntensity = lit * 4; poolMat.opacity = lit * 0.55; haloMat.opacity = lit * 0.9;
    for (const l of streetLights) l.intensity = lit * 7;
    stiltLight.intensity = lit * 16;
    lamp.intensity = lit * 10;
    groundMat.color.set(0xffffff).lerp(tmpC.set(0x5a6070), dark * 0.6);
    for (const m of nbMats) if (m.emissiveMap) m.emissiveIntensity = lit * 1.6;
    for (const m of nbMats) if (m.map) m.color.set(0xffffff).lerp(tmpC.set(0x56607a), dark * 0.7);
    for (const m of nbMats) if (!m.map) m.color.set(0xb9b3a8).lerp(tmpC.set(0x2a3245), dark);
    post.setLit(lit);
    bakeEnv(`${Math.round(el / 2)}:${Math.round(az / 15)}`);
    renderer.shadowMap.needsUpdate = true;
    info = { el, az, night, hour, doy };
    dirty();
    return info;
  }

  // ---------- one floor picked out on the exterior ----------
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const bandLine = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, fog: false });
  const band = new THREE.Group(); band.visible = false; scene.add(band);
  const bb = project.bounds;
  const bw = bb.x[1] - bb.x[0] + 0.9, bd = bb.z[1] - bb.z[0] + 0.9;
  const bandGeo = new THREE.BoxGeometry(bw, 1, bd);
  const bandMesh = new THREE.Mesh(bandGeo, bandMat); const bandEdges = new THREE.LineSegments(new THREE.EdgesGeometry(bandGeo), bandLine);
  band.add(bandMesh, bandEdges);
  band.position.set((bb.x[0] + bb.x[1]) / 2, 0, (bb.z[0] + bb.z[1]) / 2);
  function highlightLevel(y0, y1, color) {
    if (y0 == null) { band.visible = false; dirty(); return; }
    band.visible = true; band.scale.y = Math.max(0.3, y1 - y0); band.position.y = (y0 + y1) / 2;
    if (color) { bandMat.color.set(color); bandLine.color.set(color); }
    dirty();
  }

  const post = createPost(renderer, scene, camera, { tier: ctx.fx || (narrow ? 'low' : 'high'), hideFromAO: [pools, band], onTier: () => dirty() });
  post.setSize(el.clientWidth || 1, el.clientHeight || 1);

  return {
    dress, prep, setTime, highlightLevel, update,
    render() { post.render(); }, resize(w, h) { post.setSize(w, h); }, setFx(t) { post.setTier(t); dirty(); }, get fx() { return post.tier; },
    setInterior(v) { if (Math.abs(v - interior) > 0.02) { interior = v; if (info.hour != null) setTime(info.hour, info.doy); } }, setContext(c) { context = c; },
    get info() { return info; },
    dispose() {
      scene.background = prevBg; envRT?.dispose(); pmrem.dispose(); post.dispose();
      Object.values(texCache).forEach((t) => t.dispose());
      [grass, glowTex].forEach((t) => t.dispose());
      sky.geometry.dispose(); sky.material.dispose();
    },
  };
}
