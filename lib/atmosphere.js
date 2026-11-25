// Realistic look for the showroom stage: textured facade materials, a physical sky with the sun at
// its true position for a clock time and date (Mumbai), sun shadows, sky-lit reflections, and a
// neighbourhood that lights up after dark (street lamps with light pools on the ground, lit windows
// in the neighbouring blocks, the stilt lit from inside). Installed by createProjectStage when it
// is created with { real: true }; the guided tour keeps the plain look.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

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
const TEX_CAT = {
  ArchWalls: { tex: 'plastered_wall_02', size: 2.4, tint: true },
  CompoundWall: { tex: 'plastered_wall_02', size: 2.0, color: 0xe2d8c6 },
  Chajja: { tex: 'white_stucco', size: 1.6 }, Parapets: { tex: 'white_stucco', size: 1.6 },
  TerraceCore: { tex: 'white_stucco', size: 1.8 }, LMR: { tex: 'white_stucco', size: 1.8 },
  Slabs: { tex: 'white_stucco', size: 2.0 }, Plinth: { tex: 'white_stucco', size: 1.5, color: 0xb9b2a6 },
  Terrace: { tex: 'square_concrete_pavers', size: 1.2, color: 0xd9d2c6 },
  Plot: { tex: 'square_concrete_pavers', size: 1.6, color: 0xe0d6c8 },
  Doors: { tex: 'oak_veneer_01', size: 1.2 },
  OverheadTank: { tex: 'white_stucco', size: 1.5, color: 0xd8dce2 },
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
  const { scene, renderer, sun, hemi, fill, moon, lamp, ground, groundMat, nb, stars, center, H, project, shadows, dirty, setNightBase } = ctx;
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
  function dress(m, cat) {
    const d = TEX_CAT[cat];
    if (cat === 'Glass') { Object.assign(m, { roughness: 0.04, metalness: 0.15, envMapIntensity: 1.6 }); m.color.set(0x2e4f69); return; }
    if (cat === 'WindowFrames' || cat === 'Handrails' || cat === 'Railings') { m.roughness = 0.35; m.metalness = 0.75; return; }
    if (cat === 'Cars') { Object.assign(m, { roughness: 0.22, metalness: 0.65, envMapIntensity: 1.4 }); return; }
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
  function prep(mesh, cat) { const d = TEX_CAT[cat]; if (d) boxUV(mesh, d.size); }

  // ---------- sky ----------
  const sky = new Sky();
  sky.scale.setScalar(900); sky.position.copy(center).setY(0);
  const su = sky.material.uniforms;
  su.turbidity.value = 7; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.006; su.mieDirectionalG.value = 0.82;
  su.uNight = { value: 0 }; su.uNightCol = { value: new THREE.Color(0x0b1628) }; su.uGain = { value: 0.55 };
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('void main() {', 'uniform float uNight;\nuniform vec3 uNightCol;\nuniform float uGain;\nvoid main() {')
    .replace('gl_FragColor = vec4( retColor, 1.0 );', 'retColor = mix(retColor * uGain, uNightCol, uNight);\n\t\t\tgl_FragColor = vec4( retColor, 1.0 );');
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
  const grass = canvasTex(256, 256, (g, w, h) => {
    const r = rng(11); g.fillStyle = '#7c8a5c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const c = 70 + r() * 70; g.fillStyle = `rgba(${c * 0.85 | 0},${c | 0},${c * 0.55 | 0},${0.25 + r() * 0.35})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,130,95,${0.15 + r() * 0.2})`; g.beginPath(); g.arc(r() * w, r() * h, 6 + r() * 20, 0, 7); g.fill(); }
  });
  grass.repeat.set(160, 160);
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
  const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.35, 'rgba(255,190,120,0.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
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
    const l = new THREE.PointLight(0xffc98a, 0, 34, 1.6); l.position.set(p[0], POLE_H - 0.3, p[1]); scene.add(l); return l;
  });
  // the stilt floor lit from inside after dark
  const stiltLight = new THREE.PointLight(0xffe0b0, 0, 28, 1.4);
  stiltLight.position.set(center.x, 1.9, center.z); scene.add(stiltLight);

  // neighbouring blocks: plastered facades with a grid of windows, some lit at night
  const nbMats = [];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a8, roughness: 1, transparent: true });
  nbMats.push(roofMat);
  nb.children.forEach((m, i) => {
    const p = m.geometry.parameters, r = rng(31 + i * 7);
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
    for (const m of nb.children) {
      const box = m.userData.box;
      // in view and nearer to the camera than the building's near side: it would stand in front of it
      const blocks = frustum.intersectsBox(box) && box.distanceToPoint(camera.position) < d - RB * 0.6;
      const to = blocks ? 0.0 : 1;
      if (Math.abs(m.userData.fade - to) > 0.01) { m.userData.fade += (to - m.userData.fade) * 0.25; changed = true; } else m.userData.fade = to;
      const o = m.userData.fade * context;
      for (const mm of m.userData.mats) { mm.opacity = o; mm.depthWrite = o > 0.9; }
      m.visible = o > 0.02;
      m.castShadow = shadows && o > 0.5;
    }
    return changed;
  }

  // ---------- time of day ----------
  const WARM = new THREE.Color(0xff9a52), GOLD = new THREE.Color(0xffd2a1), NOON = new THREE.Color(0xfff5e8);
  const HEMI_DAY = new THREE.Color(0xcfe0f2), HEMI_GOLD = new THREE.Color(0xf3c9a0), HEMI_NIGHT = new THREE.Color(0x24324f);
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
    const night = 1 - smooth(-7, 4, el);            // 0 in daylight, 1 once it is dark
    const golden = 1 - smooth(4, 22, el);           // low sun: warm light, long shadows
    setNightBase(night);                             // glazing glow, stars, the entrance lamp
    // sun: follows its true position; fades out just below the horizon
    const up = Math.max(dir.y, 0.03);
    sun.position.copy(dir).setY(up).normalize().multiplyScalar(140).add(center);
    sun.target.position.copy(center);
    sun.intensity = 3.6 * smooth(-1.5, 6, el) * (0.55 + 0.45 * smooth(5, 40, el));
    sun.color.copy(NOON).lerp(GOLD, golden).lerp(WARM, smooth(0.6, 1, golden));
    // moon opposite the sun, faint
    moon.position.copy(center).add(new THREE.Vector3(-dir.x, Math.max(0.5, -dir.y), -dir.z).normalize().multiplyScalar(120));
    moon.intensity = 0.45 * night;
    hemi.color.copy(HEMI_DAY).lerp(HEMI_GOLD, golden * (1 - night)).lerp(HEMI_NIGHT, night);
    hemi.groundColor.set(0x8f8573).lerp(tmpC.set(0x141a24), night);
    hemi.intensity = lerp(0.36, 0.16, night) + interior * 0.35;   // opened-up flats get extra fill
    fill.intensity = lerp(0.18, 0.05, night);
    // sky
    su.sunPosition.value.copy(dir);
    su.uNight.value = smooth(-2, -12, el) * 0.97;
    su.turbidity.value = lerp(6, 10, golden);
    scene.fog.color.copy(FOG_DAY).lerp(FOG_GOLD, golden * (1 - night)).lerp(FOG_NIGHT, night);
    scene.environmentIntensity = lerp(0.55, 0.3, night);
    renderer.toneMappingExposure = lerp(0.95, 0.9, night);
    // surroundings after dark
    const lit = smooth(0.25, 0.85, night);
    headMat.emissiveIntensity = lit * 3; poolMat.opacity = lit * 0.75; haloMat.opacity = lit * 0.9;
    for (const l of streetLights) l.intensity = lit * 13;
    stiltLight.intensity = lit * 22;
    lamp.intensity = lit * 16;
    groundMat.color.set(0xffffff).lerp(tmpC.set(0x5a6070), night * 0.6);
    for (const m of nbMats) if (m.emissiveMap) m.emissiveIntensity = lit * 1.8;
    for (const m of nbMats) if (m.map) m.color.set(0xffffff).lerp(tmpC.set(0x56607a), night * 0.7);
    for (const m of nbMats) if (!m.map) m.color.set(0xb9b3a8).lerp(tmpC.set(0x2a3245), night);
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

  return {
    dress, prep, setTime, highlightLevel, update,
    setInterior(v) { if (Math.abs(v - interior) > 0.02) { interior = v; if (info.hour != null) setTime(info.hour, info.doy); } }, setContext(c) { context = c; },
    get info() { return info; },
    dispose() {
      scene.background = prevBg; envRT?.dispose(); pmrem.dispose();
      Object.values(texCache).forEach((t) => t.dispose());
      [grass, glowTex].forEach((t) => t.dispose());
      sky.geometry.dispose(); sky.material.dispose();
    },
  };
}
