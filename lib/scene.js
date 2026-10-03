// Shared three.js viewer for The Sahil. Loads the per-floor GLBs (exterior shell first,
// interior detail when idle), groups meshes by floor, and exposes focus / slice /
// explode / night / plan controls. Rendering is on-demand (only while something changes).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const LEVELS = ['B', 'G', ...Array.from({ length: 22 }, (_, i) => 'F' + String(i + 1).padStart(2, '0')), 'T'];
export const LEVEL_Y = { B: -2.0, G: 0.3, T: 69.3 };
for (let i = 1; i <= 22; i++) LEVEL_Y['F' + String(i).padStart(2, '0')] = 0.3 + 3 * i;
export const FLOOR_H = 3;
export const CENTER = new THREE.Vector3(12.56, 36, 7.38);     // building centroid (glTF Y-up, metres, ground = 0)
export const FOOTPRINT = { x: [1.0, 26.8], z: [2.3, 12.5] };   // typical slab bounds
export const MODELS = { core: '/assets/models/sahil_core.glb', detail: '/assets/models/sahil_detail.glb' };

export const floorIndex = (level) => LEVELS.indexOf(level);
export function levelLabel(level) {
  if (level === 'B') return 'Basement';
  if (level === 'G') return 'Ground Floor';
  if (level === 'T') return 'Terrace';
  const n = parseInt(level.slice(1), 10);
  const s = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${s} Floor`;
}

export const MAT = {
  ArchWalls:      { color: 0xd9d1c3, roughness: .92 },
  Glass:          { color: 0x35587a, roughness: .12, metalness: .25, transparent: true, opacity: .82, envMapIntensity: 1.2, emissive: 0xffc98a, emissiveIntensity: 0 },
  WindowFrames:   { color: 0x5a4632, roughness: .4, metalness: .6 },
  Doors:          { color: 0x6b533f, roughness: .7 },
  LiftDoors:      { color: 0x8d8d8d, roughness: .3, metalness: .7 },
  Chajja:         { color: 0xf3eee6, roughness: .85 },
  Slabs:          { color: 0xe6e0d4, roughness: .9 },
  Beams:          { color: 0xcdc4b4, roughness: .9 },
  ShearWalls_300: { color: 0xc9c1b1, roughness: .9 },
  ShearWalls_230: { color: 0xc9c1b1, roughness: .9 },
  BasementWalls:  { color: 0xb3ab9d, roughness: 1 },
  RetainingWall:  { color: 0xb3ab9d, roughness: 1 },
  PileCapRaft:    { color: 0xa9a194, roughness: 1 },
  PitSlab:        { color: 0xa9a194, roughness: 1 },
  Piles:          { color: 0x9e968a, roughness: 1 },
  TankWalls:      { color: 0xb3ab9d, roughness: 1 },
  Water:          { color: 0x4fb4c8, roughness: .1, transparent: true, opacity: .6 },
  Pallets:        { color: 0x7d7d7d, roughness: .5, metalness: .5 },
  Cars:           { color: 0x3b4048, roughness: .4, metalness: .3 },
  Stairs:         { color: 0xcfc8ba, roughness: .9 },
  StairLandings:  { color: 0xcfc8ba, roughness: .9 },
  Handrails:      { color: 0x5a5047, roughness: .4, metalness: .5 },
  LiftShaft:      { color: 0xcfc8ba, roughness: .9 },
  LiftCars:       { color: 0x8a8a8a, roughness: .3, metalness: .6 },
  Terrace:        { color: 0xded6c8, roughness: .95 },
  Parapets:       { color: 0xe8e1d4, roughness: .9 },
  TerraceWalls:   { color: 0xe8e1d4, roughness: .9 },
  TerraceCore:    { color: 0xe0d8ca, roughness: .9 },
  OverheadTank:   { color: 0xe0d8ca, roughness: .9 },
  LMR:            { color: 0xe0d8ca, roughness: .9 },
  Plot:           { color: 0xcfc5b3, roughness: 1 },
};
const CAST = new Set(['ArchWalls', 'Slabs', 'Chajja', 'Parapets', 'TerraceWalls', 'TerraceCore', 'LMR', 'OverheadTank', 'ShearWalls_300', 'ShearWalls_230']);
const RECV = new Set(['ArchWalls', 'Slabs', 'Chajja', 'Plot', 'Terrace', 'Parapets']);
const EXPLODE_GAP = 1.7;

/**
 * The tower as a three.js group: meshes grouped per floor, materials by category, and the
 * focus / slice / explode / basement / night state. Shared by the on-page viewer and the map
 * stage (which renders the same group inside a MapLibre custom layer).
 */
export function createBuilding({ shadows = false } = {}) {
  const building = new THREE.Group();
  const floors = {};            // level -> { group, meshes, pick, y }
  const materials = {};         // cat (or cat@level for glass) -> material
  const glassMats = [];
  const ghost = new THREE.MeshStandardMaterial({ color: 0xa6c8e4, transparent: true, opacity: 0.15, depthWrite: false, roughness: 1, metalness: 0, flatShading: true });
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  const state = { focus: null, slice: false, explode: 0, night: 0, showBasement: false, hiddenCats: new Set(), plan: false };
  let onChange = null;

  function getMaterial(cat, level) {
    const def = MAT[cat] || { color: 0xcccccc, roughness: .9 };
    const key = cat === 'Glass' ? `${cat}@${level}` : cat;
    if (!materials[key]) {
      const m = new THREE.MeshStandardMaterial({ flatShading: true, ...def });
      if (cat === 'Glass') { m.userData.night = 0.35 + 0.6 * hash(level); glassMats.push(m); }
      if (cat === 'Water' || cat === 'Glass') m.side = THREE.DoubleSide;
      materials[key] = m;
    }
    return materials[key];
  }
  function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; }

  function floorFor(level) {
    if (!floors[level]) {
      const group = new THREE.Group();
      group.name = level;
      building.add(group);
      const y = LEVEL_Y[level];
      const h = level === 'B' ? 2.3 : level === 'T' ? 4.6 : FLOOR_H;
      const pick = new THREE.Mesh(new THREE.BoxGeometry(FOOTPRINT.x[1] - FOOTPRINT.x[0] + .6, h, FOOTPRINT.z[1] - FOOTPRINT.z[0] + .6), pickMat);
      pick.position.set(CENTER.x, y + h / 2, CENTER.z);
      pick.userData.level = level;
      group.add(pick);
      floors[level] = { group, meshes: [], pick, y };
    }
    return floors[level];
  }

  function addGltf(gltf) {
    const list = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => { if (o.isMesh) list.push(o); });
    for (const m of list) {
      const match = /^(B|G|T|F\d\d)_(.+)$/.exec(m.name);
      if (!match) continue;
      const [, level, cat] = match;
      const mw = m.matrixWorld.clone();
      const f = floorFor(level);
      f.group.add(m);
      m.matrix.copy(mw);
      m.matrix.decompose(m.position, m.quaternion, m.scale);
      m.material = getMaterial(cat, level);
      m.userData = { level, cat, mat: m.material };
      m.castShadow = shadows && CAST.has(cat);
      m.receiveShadow = shadows && RECV.has(cat);
      f.meshes.push(m);
    }
    applyState();
  }

  function applyState() {
    const fi = state.focus ? floorIndex(state.focus) : -1;
    for (const level of Object.keys(floors)) {
      const f = floors[level];
      const i = floorIndex(level);
      let visible = level !== 'B' || state.showBasement;
      if (state.slice && fi >= 0 && i > fi) visible = false;
      f.group.visible = visible;
      f.group.position.y = state.explode * Math.max(0, i - 1) * EXPLODE_GAP;
      for (const m of f.meshes) {
        m.visible = !state.hiddenCats.has(m.userData.cat);
        m.material = fi >= 0 && level !== state.focus ? ghost : m.userData.mat;
      }
    }
    onChange && onChange();
  }

  /** Night look of the materials only (lights belong to whoever renders). */
  function setNight(t) {
    state.night = t;
    for (const g of glassMats) {
      g.emissiveIntensity = t * g.userData.night * 1.6;
      g.opacity = 0.82 + (0.9 - 0.82) * t;
    }
    onChange && onChange();
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  function loadOne(url, onProgress) {
    return new Promise((res, rej) => loader.load(url, (g) => { addGltf(g); res(g); }, (e) => onProgress && onProgress(e), rej));
  }
  let detailPromise = null;
  function loadDetail() {
    if (!detailPromise) detailPromise = loadOne(MODELS.detail);
    return detailPromise;
  }
  async function load(onProgress) {
    await loadOne(MODELS.core, onProgress);
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
    idle(() => loadDetail());
  }

  return {
    building, floors, materials, glassMats, ghost, pickMat, state,
    addGltf, applyState, setNight, load, loadDetail,
    set onChange(fn) { onChange = fn; },
    setFocus(level, slice = false) { state.focus = level; state.slice = slice; applyState(); },
    setExplode(t) { state.explode = t; applyState(); },
    setBasement(v) { state.showBasement = v; applyState(); },
    setCategoryHidden(cat, hidden) { hidden ? state.hiddenCats.add(cat) : state.hiddenCats.delete(cat); applyState(); },
    dispose() {
      building.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
      Object.values(materials).forEach((m) => m.dispose());
      ghost.dispose(); pickMat.dispose();
    },
  };
}

export function createViewer(canvas, { shadows = true, dprMax = 1.75 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprMax));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;   // light and building are static; refresh only on state changes
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const persp = new THREE.PerspectiveCamera(38, 1, 0.5, 800);
  const ortho = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.5, 400);
  let camera = persp;
  persp.position.set(60, 30, 130);

  const hemi = new THREE.HemisphereLight(0xdbe8f5, 0xcbbfa8, 0.65);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(55, 95, 70);
  sun.target.position.copy(CENTER);
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 70, bottom: -70, near: 10, far: 320 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  const fill = new THREE.DirectionalLight(0xbfd7ee, 0.45);
  fill.position.set(-70, 40, 60);
  scene.add(hemi, sun, sun.target, fill);

  const b = createBuilding({ shadows });
  const { building, floors, materials, ghost, state } = b;
  scene.add(building);
  b.onChange = () => { renderer.shadowMap.needsUpdate = true; requestRender(); };

  const hoverBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(FOOTPRINT.x[1] - FOOTPRINT.x[0] + .6, FLOOR_H - .1, FOOTPRINT.z[1] - FOOTPRINT.z[0] + .6)),
    new THREE.LineBasicMaterial({ color: 0x2d6ae0, transparent: true, opacity: .9 }));
  hoverBox.visible = false;
  scene.add(hoverBox);

  // ---------- camera motion (damped) ----------
  const camTarget = persp.position.clone();
  const lookTarget = CENTER.clone();
  const lookCur = CENTER.clone();
  let immediate = false;
  function goTo(pos, look, { now = false } = {}) {
    camTarget.set(pos[0], pos[1], pos[2]);
    lookTarget.set(look[0], look[1], look[2]);
    if (now) immediate = true;
    requestRender();
  }
  const tweens = [];
  function tween(obj, key, to, ms = 900, onUpdate) {
    const from = obj[key];
    const t0 = performance.now();
    tweens.push({ obj, key, from, to, ms, t0, onUpdate });
    requestRender();
  }
  function stepTweens(now) {
    let busy = false;
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      const e = 1 - Math.pow(1 - k, 3);
      tw.obj[tw.key] = tw.from + (tw.to - tw.from) * e;
      tw.onUpdate && tw.onUpdate(tw.obj[tw.key]);
      if (k >= 1) tweens.splice(i, 1); else busy = true;
    }
    return busy;
  }

  // ---------- night ----------
  function setNight(t) {
    hemi.intensity = lerp(0.65, 0.18, t);
    sun.intensity = lerp(2.4, 0.12, t);
    fill.intensity = lerp(0.45, 0.25, t);
    scene.environmentIntensity = lerp(0.55, 0.08, t);
    renderer.toneMappingExposure = lerp(1.05, 0.95, t);
    b.setNight(t);
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  let pending = false, last = performance.now(), active = true;
  const hooks = [];

  // ---------- resize ----------
  let shift = 0; // -0.5..0.5 of width: where the look point appears
  function applyShift(w, h) {
    if (Math.abs(shift) < 1e-3) { persp.clearViewOffset(); return; }
    persp.setViewOffset(w, h, -shift * w, 0, w, h);
  }
  function resize() {
    if (!canvas.isConnected) return;   // observer can fire once more after unmount
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    persp.aspect = w / h;
    applyShift(w, h);
    persp.updateProjectionMatrix();
    const span = 15; // half-width of plan in metres
    const a = w / h;
    if (a >= 1) { ortho.left = -span * a; ortho.right = span * a; ortho.top = span; ortho.bottom = -span; }
    else { ortho.left = -span; ortho.right = span; ortho.top = span / a; ortho.bottom = -span / a; }
    ortho.updateProjectionMatrix();
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement || document.body);
  resize();

  // ---------- render on demand ----------
  function requestRender() {
    if (pending || !active) return;
    pending = true;
    requestAnimationFrame(frame);
  }
  // adaptive quality: after a warm-up, if frames are slow drop pixel ratio and shadows
  let slowFrames = 0, frames = 0, degraded = 0;
  function degrade() {
    degraded++;
    if (degraded === 1) renderer.setPixelRatio(1);
    if (degraded === 2 && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      sun.castShadow = false;
      scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      Object.values(materials).forEach((m) => (m.needsUpdate = true));
      ghost.needsUpdate = true;
    }
    slowFrames = 0;
  }
  function frame(now) {
    pending = false;
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    if (++frames > 10 && raw > 0.045 && raw < 1) { if (++slowFrames > 12 && degraded < 2) degrade(); } else if (slowFrames > 0) slowFrames--;
    let busy = stepTweens(now);
    const k = immediate ? 1 : 1 - Math.exp(-dt * 5.5);
    immediate = false;
    persp.position.lerp(camTarget, k);
    lookCur.lerp(lookTarget, k);
    if (camera === ortho) { ortho.position.copy(persp.position); ortho.up.set(0, 0, -1); ortho.lookAt(lookCur); }
    else { persp.up.set(0, 1, 0); persp.lookAt(lookCur); }
    if (persp.position.distanceToSquared(camTarget) > 1e-4 || lookCur.distanceToSquared(lookTarget) > 1e-4) busy = true;
    for (const h of hooks) if (h(dt, now)) busy = true;
    renderer.render(scene, camera);
    if (busy) requestRender();
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = Object.values(floors).filter((f) => f.group.visible).map((f) => f.pick);
    const hit = ray.intersectObjects(list, false)[0];
    return hit ? hit.object.userData.level : null;
  }
  function setHover(level) {
    if (!level || !floors[level]) { hoverBox.visible = false; requestRender(); return; }
    const f = floors[level];
    const h = level === 'B' ? 2.3 : level === 'T' ? 4.6 : FLOOR_H;
    hoverBox.position.set(CENTER.x, f.y + h / 2 + f.group.position.y, CENTER.z);
    hoverBox.scale.set(1, h / (FLOOR_H - .1), 1);
    hoverBox.visible = true;
    requestRender();
  }

  return {
    renderer, scene, persp, ortho, floors, state, building,
    get camera() { return camera; },
    load: b.load, loadDetail: b.loadDetail, goTo, tween, requestRender, pick, setHover, applyState: b.applyState, setNight,
    setActive(v) { active = v; if (v) requestRender(); },
    addHook(fn) { hooks.push(fn); },
    useOrtho(v) { camera = v ? ortho : persp; requestRender(); },
    setShift(v) { if (Math.abs(v - shift) < 1e-3) return; shift = v; const w = renderer.domElement.width / renderer.getPixelRatio(), h = renderer.domElement.height / renderer.getPixelRatio(); applyShift(w, h); persp.updateProjectionMatrix(); requestRender(); },
    setFocus: b.setFocus, setExplode: b.setExplode, setBasement: b.setBasement, setCategoryHidden: b.setCategoryHidden,
    get camTarget() { return camTarget; },
    dispose() {
      active = false;
      ro.disconnect();
      b.dispose(); pmrem.dispose();
      renderer.dispose();
    },
  };
}
