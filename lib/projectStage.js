// Generic three.js stage for the Dadamiya projects: a building split per level (<LEVEL>_<Category>
// nodes, served encrypted like the Sahil models), optional furnished unit models, and the
// controls the GSAP tour drives from scroll position: camera, cut-away at a level, explode,
// day/night and the unit overlay. Renders on demand.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { fetchModel } from './scene.js';

const MAT = {
  ArchWalls:     { color: 0xe6ddd0, roughness: .9 },
  Glass:         { color: 0x3d6b8f, roughness: .1, metalness: .3, transparent: true, opacity: .8, emissive: 0xffc98a, emissiveIntensity: 0 },
  WindowFrames:  { color: 0x3a3a3c, roughness: .4, metalness: .6 },
  Doors:         { color: 0x7a5a3c, roughness: .7 },
  Chajja:        { color: 0xf3f1ec, roughness: .6 },
  Slabs:         { color: 0xe3ddd1, roughness: .9 },
  Plinth:        { color: 0xc9c2b4, roughness: 1 },
  Terrace:       { color: 0xd8d4cb, roughness: .9 },
  Parapets:      { color: 0xf3f1ec, roughness: .6 },
  TerraceCore:   { color: 0xe9e4da, roughness: .8 },
  LMR:           { color: 0xe9e4da, roughness: .8 },
  OverheadTank:  { color: 0xd4d6dc, roughness: .7 },
  Water:         { color: 0x46c9d0, roughness: .05, transparent: true, opacity: .75, emissive: 0x1d8f9c, emissiveIntensity: .2 },
  Stairs:        { color: 0xd3c9b8, roughness: .9 },
  StairLandings: { color: 0xcfc8ba, roughness: .9 },
  Handrails:     { color: 0x4a443e, roughness: .4, metalness: .5 },
  LiftShaft:     { color: 0xbdb6a9, roughness: .9 },
  LiftCars:      { color: 0x8a8a8a, roughness: .3, metalness: .6 },
  Cars:          { color: 0x8a2d2d, roughness: .4, metalness: .3 },
  Plot:          { color: 0x8da27f, roughness: 1 },
  CompoundWall:  { color: 0xd6cbb7, roughness: 1 },
  Railings:      { color: 0x2a2a2a, roughness: .5, metalness: .5 },
};
const CAST = new Set(['ArchWalls', 'Slabs', 'Chajja', 'Parapets', 'TerraceCore', 'LMR', 'OverheadTank', 'CompoundWall', 'Terrace']);
const RECV = new Set(['ArchWalls', 'Slabs', 'Chajja', 'Plot', 'Terrace', 'Plinth', 'Parapets']);
const lerp = (a, b, t) => a + (b - a) * t;

export function createProjectStage(el, project, { narrow = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  el.appendChild(canvas);
  const shadows = !narrow;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, narrow ? 1.75 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const DAY_BG = new THREE.Color(0xd7e3ee), NIGHT_BG = new THREE.Color(0x0e1a2e);
  scene.background = DAY_BG.clone();
  scene.fog = new THREE.Fog(scene.background, 160, 520);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1200);

  const levels = project.levels.map(([k, y, label]) => ({ key: k, y, label }));
  const levelY = Object.fromEntries(levels.map((l) => [l.key, l.y]));
  const center = new THREE.Vector3(...project.center);
  const H = levels[levels.length - 1].y;

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xdbe8f5, 0x9a8f7a, 0.6);
  const sun = new THREE.DirectionalLight(0xffe3c2, 2.6);
  const SUN_DIR = new THREE.Vector3(0.55, 0.75, 0.42).normalize();
  sun.position.copy(SUN_DIR).multiplyScalar(140).add(center);
  sun.target.position.copy(center);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(3072, 3072);
  const sr = Math.max(project.bounds.plot.x[1] - project.bounds.plot.x[0], project.bounds.plot.z[1] - project.bounds.plot.z[0]) * 0.75 + H * 0.5;
  Object.assign(sun.shadow.camera, { left: -sr, right: sr, top: sr, bottom: -sr, near: 20, far: 360 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  const fill = new THREE.DirectionalLight(0xbfd7ee, 0.45);
  fill.position.set(center.x - 90, 50, center.z - 70);
  const moon = new THREE.DirectionalLight(0x7f9cc8, 0);
  moon.position.set(center.x - 60, 120, center.z + 40);
  scene.add(hemi, sun, sun.target, fill, moon);

  // ---------- ground ----------
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xbfc5b6, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 72), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(center.x, -0.12, center.z);
  ground.receiveShadow = shadows;
  scene.add(ground);
  // a few soft neighbour blocks so the building is not alone on the plane
  const nb = new THREE.Group();
  const nbMat = new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 1 });
  const px = project.bounds.plot, spanX = px.x[1] - px.x[0], spanZ = px.z[1] - px.z[0];
  const seeds = [[-1.1, 0.2, 0.8, 0.9], [1.15, -0.3, 0.7, 0.8], [0.2, 1.25, 0.9, 0.6], [-0.4, -1.3, 0.8, 0.7], [1.2, 1.1, 0.6, 0.5], [-1.3, -1.0, 0.7, 0.5]];
  seeds.forEach(([fx, fz, w, h], i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(spanX * w * 0.8, H * h, spanZ * 0.55 * (0.5 + (i % 3) * .25)), nbMat);
    m.position.set(center.x + fx * spanX * 1.05, H * h / 2, center.z + fz * spanZ * 1.05);
    m.castShadow = shadows; m.receiveShadow = shadows; nb.add(m);
  });
  scene.add(nb);

  // ---------- building ----------
  const building = new THREE.Group();
  scene.add(building);
  const floors = {};   // level -> { group, meshes, y, base }
  const materials = {}; const glassMats = [];
  const state = { focus: null, cut: 0, explode: 0, night: 0, buildingAlpha: 1, unitAlpha: 0, unit: null };
  function getMaterial(cat, level) {
    const def = MAT[cat] || { color: 0xcccccc, roughness: .9 };
    const key = cat === 'Glass' ? `${cat}@${level}` : cat;
    if (!materials[key]) {
      const m = new THREE.MeshStandardMaterial({ flatShading: true, ...def });
      if (cat === 'ArchWalls' && project.wall) m.color.set(project.wall);
      if (cat === 'Glass') { m.userData.night = 0.3 + 0.65 * hash(level); glassMats.push(m); }
      if (cat === 'Water' || cat === 'Glass') m.side = THREE.DoubleSide;
      m.userData.baseOpacity = m.opacity;
      materials[key] = m;
    }
    return materials[key];
  }
  function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; }
  function floorFor(level) {
    if (!floors[level]) {
      const group = new THREE.Group(); group.name = level; building.add(group);
      floors[level] = { group, meshes: [], y: levelY[level] ?? 0 };
    }
    return floors[level];
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  function addGltf(gltf) {
    const list = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => { if (o.isMesh) list.push(o); });
    for (const m of list) {
      const match = /^(G|T|F\d\d)_(.+?)(?:\.\d+)?$/.exec(m.name);
      if (!match) continue;
      const [, level, cat] = match;
      const mw = m.matrixWorld.clone();
      const f = floorFor(level);
      f.group.add(m); m.matrix.copy(mw); m.matrix.decompose(m.position, m.quaternion, m.scale);
      m.material = getMaterial(cat, level);
      m.userData = { level, cat };
      m.castShadow = shadows && CAST.has(cat);
      m.receiveShadow = shadows && RECV.has(cat);
      f.meshes.push(m);
    }
    applyState(); dirty();
  }
  async function loadOne(name, onProgress) {
    const buf = await fetchModel(name, onProgress);
    const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
    addGltf(gltf);
  }
  let detailPromise = null;
  async function load(onProgress) {
    await loadOne(project.models.core, onProgress);
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1000));
    idle(() => { detailPromise = detailPromise || loadOne(project.models.detail).catch(console.error); });
  }

  // ---------- furnished units ----------
  const units = {};   // id -> { group, mats, promise }
  function loadUnit(id) {
    const u = project.units.find((x) => x.id === id);
    if (!u) return Promise.resolve(null);
    if (!units[id]) {
      const group = new THREE.Group(); group.visible = false; group.position.y = levelY[project.typical] || 0; scene.add(group);
      const rec = { group, mats: [], ready: false };
      rec.promise = fetchModel(u.model).then((buf) => new Promise((res, rej) => loader.parse(buf, '', res, rej))).then((gltf) => {
        gltf.scene.traverse((o) => {
          if (/^(Ceiling|Slab)(\.\d+)?$/.test(o.name)) o.visible = false;   // dollhouse view: look in from above
          if (!o.isMesh) return;
          o.castShadow = shadows; o.receiveShadow = shadows;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) { if (!m.userData.baseOpacity) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; rec.mats.push(m); } }
        });
        group.add(gltf.scene); rec.ready = true; applyState(); dirty();
      }).catch((e) => { console.error(e); });
      units[id] = rec;
    }
    return units[id].promise;
  }

  // ---------- state ----------
  const EXPLODE_GAP = project.floorH * 1.6;
  const ghost = new THREE.MeshStandardMaterial({ color: 0xa6c8e4, transparent: true, opacity: 0.12, depthWrite: false, roughness: 1, flatShading: true });
  const order = levels.map((l) => l.key);
  function applyState() {
    const { focus, cut, explode, buildingAlpha } = state;
    const fi = focus ? order.indexOf(focus) : -1;
    for (const [level, f] of Object.entries(floors)) {
      const li = order.indexOf(level);
      f.group.position.y = explode * EXPLODE_GAP * li;
      const above = fi >= 0 && li > fi;
      for (const m of f.meshes) {
        const base = materials[m.userData.cat === 'Glass' ? `Glass@${level}` : m.userData.cat];
        if (above && cut > 0.02) {
          // floors above the focus fade to a ghost as the cut-away deepens, then disappear
          m.material = ghost; m.visible = cut < 0.98 || m.userData.cat === 'Plot';
          ghost.opacity = 0.14 * (1 - cut);
        } else { m.material = base; m.visible = true; }
        m.castShadow = shadows && CAST.has(m.userData.cat) && !(above && cut > 0.02);
      }
    }
    building.visible = buildingAlpha > 0.01;
    for (const m of Object.values(materials)) {
      const t = m.userData.baseOpacity ?? 1;
      m.transparent = buildingAlpha < 0.995 || t < 1;
      m.opacity = t * buildingAlpha;
      m.depthWrite = buildingAlpha > 0.5 && !(t < 1);
    }
    for (const [id, u] of Object.entries(units)) {
      const show = state.unit === id && state.unitAlpha > 0.01;
      u.group.visible = show && u.ready;
      for (const m of u.mats) {
        const t = m.userData.baseOpacity ?? 1;
        m.transparent = state.unitAlpha < 0.995 || m.userData.baseTransparent;
        m.opacity = t * state.unitAlpha; m.depthWrite = state.unitAlpha > 0.5 && !m.userData.baseTransparent;
      }
    }
    renderer.shadowMap.needsUpdate = true;
  }
  function setNight(t) {
    hemi.intensity = lerp(0.6, 0.16, t);
    sun.intensity = lerp(2.6, 0.08, t);
    fill.intensity = lerp(0.45, 0.2, t);
    moon.intensity = lerp(0, 0.5, t);
    scene.environmentIntensity = lerp(0.5, 0.12, t);
    renderer.toneMappingExposure = lerp(1.0, 0.85, t);
    scene.background.copy(DAY_BG).lerp(NIGHT_BG, t); scene.fog.color.copy(scene.background);
    groundMat.color.setHex(0xbfc5b6).lerp(new THREE.Color(0x1b2638), t);
    nbMat.color.setHex(0xcfcbc2).lerp(new THREE.Color(0x202a3b), t);
    for (const m of glassMats) { m.emissiveIntensity = t * m.userData.night * 3.2; m.opacity = lerp(m.userData.baseOpacity ?? .8, .95, t); }
    el.classList.toggle('night-stage', t > 0.5);
  }

  // ---------- camera ----------
  const camPos = new THREE.Vector3(center.x + 60, 30, center.z + 90), look = center.clone();
  function setCamera(pos, target, fov) {
    camPos.set(pos[0], pos[1], pos[2]); look.set(target[0], target[1], target[2]);
    if (fov && Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    dirty();
  }
  let yaw = 0, pitch = 0;   // drag offset
  let dirtyFlag = true, alive = true;
  const dirty = () => { dirtyFlag = true; };
  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(el);
  function frame() {
    if (!alive) return;
    requestAnimationFrame(frame);
    if (!dirtyFlag) return;
    dirtyFlag = false;
    // drag to look around: rotate the camera about the look point
    const off = camPos.clone().sub(look);
    const r = Math.hypot(off.x, off.z), a = Math.atan2(off.z, off.x) + yaw;
    const p = new THREE.Vector3(look.x + Math.cos(a) * r, off.y + look.y + pitch * r * 0.25, look.z + Math.sin(a) * r);
    camera.position.copy(p); camera.lookAt(look);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // drag: temporary look-around that eases back when released
  let dragging = false, lx = 0, ly = 0;
  const onDown = (e) => { dragging = true; lx = e.clientX; ly = e.clientY; el.classList.add('dragging'); };
  const onMove = (e) => { if (!dragging) return; yaw += (e.clientX - lx) * 0.004; pitch += (e.clientY - ly) * 0.002; pitch = Math.max(-0.8, Math.min(0.8, pitch)); lx = e.clientX; ly = e.clientY; dirty(); };
  const onUp = () => { dragging = false; el.classList.remove('dragging'); };
  el.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  let relax = setInterval(() => { if (!dragging && (Math.abs(yaw) > 1e-3 || Math.abs(pitch) > 1e-3)) { yaw *= 0.9; pitch *= 0.9; dirty(); } }, 32);

  return {
    scene, camera, renderer, state, levels, levelY, center, H, floors,
    load, loadUnit, setCamera, dirty,
    set(partial) { Object.assign(state, partial); applyState(); dirty(); },
    setNight(t) { state.night = t; setNight(t); dirty(); },
    /** world -> screen position (px) for callouts */
    project(v) { const p = new THREE.Vector3(...v).project(camera); return [(p.x + 1) / 2 * el.clientWidth, (1 - p.y) / 2 * el.clientHeight, p.z < 1]; },
    dispose() {
      alive = false; clearInterval(relax); ro.disconnect();
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      scene.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
      Object.values(materials).forEach((m) => m.dispose()); ghost.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
