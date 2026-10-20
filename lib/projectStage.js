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
  // a warm pool of light at the entrance side once the sun is down
  const lamp = new THREE.PointLight(0xffc27a, 0, 60, 1.8);
  lamp.position.set(center.x, 2.5, project.bounds.z[1] + 9);
  scene.add(hemi, sun, sun.target, fill, moon, lamp);

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
  nbMat.transparent = true;

  // night sky: a dome of faint stars that only shows once the lights go down
  const stars = (() => {
    const n = 1100, pos = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, e = Math.asin(0.12 + rnd() * 0.85), r = 520;
      pos.set([center.x + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, center.z + Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xdfe8f5, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const p = new THREE.Points(g, m); p.visible = false; p.frustumCulled = false; scene.add(p);
    return p;
  })();

  // ---------- building ----------
  const building = new THREE.Group();
  scene.add(building);
  const floors = {};   // level -> { group, meshes, y, base }
  const materials = {}; const glassMats = [];
  // wire: the building as a hidden-line drawing (0..1); context: the neighbour blocks (0..1)
  const state = { focus: null, cut: 0, explode: 0, night: 0, buildingAlpha: 1, unitAlpha: 0, unit: null, finish: 0, wire: 0, context: 1 };
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
        addFinishCopies(id, gltf.scene);
        group.add(gltf.scene); rec.ready = true; applyState(); dirty();
      }).catch((e) => { console.error(e); });
      units[id] = rec;
    }
    return units[id].promise;
  }

  // ---------- finished floor ----------
  // The typical floor dressed for the finished cut-away: every flat furnished (mirror copies of the
  // furnished unit types when the plan is symmetric about the model axes), the building's own walls
  // cut away where a furnished flat stands, the rest of the floor in finish materials.
  const F = project.finish || {};
  const finishSet = new THREE.Group(); finishSet.visible = false; finishSet.position.y = levelY[project.typical] || 0; scene.add(finishSet);
  const finishMats = [];
  const MAX_CUT = 16;
  const cutRects = Array.from({ length: MAX_CUT }, () => new THREE.Vector4(1e6, 1e6, 1e6, 1e6));
  let nCut = 0;
  for (const u of project.units || []) for (const [sx, sz] of F.copies || []) {
    if (nCut >= MAX_CUT || u.outline) break;
    const xs = u.bounds.x.map((v) => v * sx).sort((a, b) => a - b), zs = u.bounds.z.map((v) => v * sz).sort((a, b) => a - b);
    cutRects[nCut++].set(xs[0] - 0.05, zs[0] - 0.05, xs[1] + 0.05, zs[1] + 0.05);
  }
  const cutU = { value: cutRects };
  // flats that are not rectangles carry their outline instead: drawn into a plan mask (2 cm a pixel,
  // dilated 4 cm so the building's wall faces on the outline go too) that the walls sample
  let cutMask = null;
  const outlined = (project.units || []).filter((u) => u.outline);
  if (outlined.length && F.copies) {
    const px = 50, b = project.bounds, x0 = b.x[0] - 1, z0 = b.z[0] - 1, w = b.x[1] - b.x[0] + 2, h = b.z[1] - b.z[0] + 2;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * px); cv.height = Math.ceil(h * px);
    const g = cv.getContext('2d'); g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 0.08 * px; g.lineJoin = 'miter';
    for (const u of outlined) for (const [sx, sz] of F.copies) {
      g.beginPath();
      u.outline.forEach(([x, z], i) => g[i ? 'lineTo' : 'moveTo']((x * sx - x0) * px, (z * sz - z0) * px));
      g.closePath(); g.fill(); g.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.NearestFilter;
    cutMask = { tex: { value: tex }, box: { value: new THREE.Vector4(x0, z0, 1 / w, 1 / h) } };
  }
  function addFinishCopies(id, src) {
    if (!F.copies) return;
    src.updateMatrixWorld(true);
    const box = new THREE.Box3();
    src.traverse((o) => { if (o.isMesh) { box.setFromObject(o); o.userData.fz = [box.min.z, box.max.z]; } });
    const memo = new Map();
    const own = (m) => {
      if (!memo.has(m)) { const c = m.clone(); c.userData.baseOpacity = m.userData.baseOpacity ?? m.opacity; c.userData.baseTransparent = m.userData.baseTransparent ?? m.transparent; memo.set(m, c); finishMats.push(c); }
      return memo.get(m);
    };
    const band = F.dedupe?.[id];   // strip shared with the mirrored neighbour: keep it from one copy only
    for (const [sx, sz] of F.copies) {
      const c = src.clone(true); c.scale.set(sx, 1, sz);
      c.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
        o.castShadow = shadows; o.receiveShadow = shadows;
        if (band && sz < 0 && o.userData.fz && o.userData.fz[0] > -band && o.userData.fz[1] < band) o.visible = false;
        if (CEILING_ITEM.test(o.name) || CEILING_ITEM.test(o.parent?.name || '')) o.visible = false;
      });
      finishSet.add(c);
    }
  }
  // fittings at ceiling height read as clutter in the top-down cut-away
  const CEILING_ITEM = /^(light|fan|Chandelier|switch|socket|db|bell|exhaust|point)(_|\.|\d|$)/;
  // finish materials for the building's own meshes on the typical floor
  const NO_CUT = new Set(['Slabs', 'Stairs', 'StairLandings', 'Handrails', 'LiftShaft', 'LiftCars', 'Plot', 'Cars']);
  const finishBase = {};
  let floorTex = null;
  function finishMaterial(cat, level) {
    const key = cat === 'Glass' ? `${cat}@${level}` : cat;
    if (!finishBase[key]) {
      const m = materials[key].clone();
      m.userData = { ...materials[key].userData };
      if (cat === 'ArchWalls' && F.wall) m.color.set(F.wall);
      if (cat === 'Slabs' && F.floor) {
        if (!floorTex) {
          const tl = new THREE.TextureLoader();
          const t = (n, srgb) => { const x = tl.load(`/assets/tex/${F.floor}_${n}.webp`, dirty); x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; if (srgb) x.colorSpace = THREE.SRGBColorSpace; return x; };
          floorTex = { map: t('diff', true), normalMap: t('nor'), roughnessMap: t('rough') };
        }
        Object.assign(m, floorTex, { color: new THREE.Color(0xffffff), roughness: 1 });   // stays flat-shaded: the model has no normals
      }
      if ((nCut || cutMask) && !NO_CUT.has(cat)) {
        m.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          if (cutMask) {
            sh.uniforms.uCutMask = cutMask.tex; sh.uniforms.uCutBox = cutMask.box;
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCutW;\nuniform sampler2D uCutMask;\nuniform vec4 uCutBox;')
              .replace('void main() {', 'void main() {\n  vec2 cutUv = (vCutW.xz - uCutBox.xy) * uCutBox.zw;\n  if (all(greaterThan(cutUv, vec2(0.0))) && all(lessThan(cutUv, vec2(1.0))) && texture2D(uCutMask, cutUv).r > 0.5) discard;');
          } else {
            sh.uniforms.uCut = cutU;
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vCutW;\nuniform vec4 uCut[${MAX_CUT}];`)
              .replace('void main() {', `void main() {\n  for (int i = 0; i < ${MAX_CUT}; i++) { vec4 r = uCut[i]; if (vCutW.x > r.x && vCutW.x < r.z && vCutW.z > r.y && vCutW.z < r.w) discard; }`);
          }
        };
        m.customProgramCacheKey = () => (cutMask ? 'finish-cut-mask' : 'finish-cut');
      }
      finishBase[key] = m;
    }
    return finishBase[key];
  }
  function prepFinishMesh(m) {
    // floor finishes need texture coordinates: planar from the plan, a repeat per 1.25 m
    if (m.userData.cat !== 'Slabs' || !F.floor || m.geometry.attributes.uv) return;
    const pos = m.geometry.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) * 0.8; uv[i * 2 + 1] = pos.getZ(i) * 0.8; }
    m.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  // ---------- the drawing (hidden-line view) ----------
  // Edge lines per mesh, built the first time wire mode is asked for; the meshes themselves are
  // drawn depth-only (and pushed back a little) so the lines behind the walls are hidden, which
  // reads as a drafted elevation rather than a tangle of wireframe.
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1f3d6b, transparent: true, opacity: 0, depthWrite: false });
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const NO_WIRE = new Set(['Cars', 'LiftCars', 'Water']);
  // built one floor per frame so the load does not hitch; meshes that arrive later (the detail
  // model) get their lines on the next pass
  const wireQueue = new Set();
  function wireFor(f) {
    f.lines = f.lines || [];
    for (const m of f.meshes) {
      if (m.userData.line || NO_WIRE.has(m.userData.cat)) continue;
      const ls = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), wireMat);
      ls.position.copy(m.position); ls.quaternion.copy(m.quaternion); ls.scale.copy(m.scale);
      ls.userData.src = m; m.userData.line = ls; f.group.add(ls); f.lines.push(ls);
    }
    return f.lines;
  }

  // ---------- state ----------
  const EXPLODE_GAP = project.floorH * 1.6;
  const ghost = new THREE.MeshStandardMaterial({ color: 0xa6c8e4, transparent: true, opacity: 0.12, depthWrite: false, roughness: 1, flatShading: true });
  const order = levels.map((l) => l.key);
  function applyState() {
    const { focus, cut, explode, buildingAlpha, wire } = state;
    const fi = focus ? order.indexOf(focus) : -1;
    const drawing = wire > 0.01, solid = buildingAlpha > 0.01;
    for (const [level, f] of Object.entries(floors)) {
      const li = order.indexOf(level);
      f.group.position.y = explode * EXPLODE_GAP * li;
      const above = fi >= 0 && li > fi;
      const finished = state.finish > 0.5 && level === project.typical;
      for (const m of f.meshes) {
        let base = materials[m.userData.cat === 'Glass' ? `Glass@${level}` : m.userData.cat];
        if (finished) { prepFinishMesh(m); base = finishMaterial(m.userData.cat, level); }
        if (above && cut > 0.02) {
          // floors above the focus fade to a ghost as the cut-away deepens, then disappear
          m.material = ghost; m.visible = cut < 0.98 || m.userData.cat === 'Plot';
          ghost.opacity = 0.14 * (1 - cut);
        } else if (!solid && drawing) { m.material = depthOnly; m.visible = true; }   // occluders for the line drawing
        else { m.material = base; m.visible = solid; }
        m.castShadow = shadows && CAST.has(m.userData.cat) && solid && !(above && cut > 0.02);
      }
      if (drawing && f.meshes.some((m) => !m.userData.line && !NO_WIRE.has(m.userData.cat))) wireQueue.add(f);
      for (const ls of f.lines || []) ls.visible = drawing && ls.userData.src.visible && !(above && cut > 0.02);
    }
    wireMat.opacity = wire * 0.85;
    building.visible = solid || drawing;
    nb.visible = state.context > 0.01; nbMat.opacity = state.context;
    for (const m of nb.children) m.castShadow = shadows && state.context > 0.5;   // shadow maps ignore opacity
    for (const m of [...Object.values(materials), ...Object.values(finishBase)]) {
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
    finishSet.visible = state.finish > 0.01;
    for (const m of finishMats) {
      const t = m.userData.baseOpacity ?? 1;
      m.transparent = state.finish < 0.995 || m.userData.baseTransparent;
      m.opacity = t * state.finish; m.depthWrite = state.finish > 0.5 && !m.userData.baseTransparent;
    }
    renderer.shadowMap.needsUpdate = true;
  }
  function setNight(t) {
    hemi.intensity = lerp(0.6, 0.16, t);
    sun.intensity = lerp(2.6, 0.08, t);
    fill.intensity = lerp(0.45, 0.2, t);
    moon.intensity = lerp(0, 0.5, t);
    lamp.intensity = lerp(0, 40, t);
    scene.environmentIntensity = lerp(0.5, 0.12, t);
    renderer.toneMappingExposure = lerp(1.0, 0.85, t);
    scene.background.copy(DAY_BG).lerp(NIGHT_BG, t); scene.fog.color.copy(scene.background);
    groundMat.color.setHex(0xbfc5b6).lerp(new THREE.Color(0x1b2638), t);
    nbMat.color.setHex(0xcfcbc2).lerp(new THREE.Color(0x2a3650), t);
    nbMat.emissive.setHex(0x000000).lerp(new THREE.Color(0x0a1220), t);   // neighbours stay silhouettes against the sky
    stars.visible = t > 0.01; stars.material.opacity = Math.max(0, (t - 0.35) / 0.65) * 0.9;
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
  let zoom = 1;              // dolly towards the look point (1 = the tour's framing)
  let shift = 0, shiftTo = 0; // horizontal frame shift (px) so the subject centres in the part of the stage not under the panel
  let split = null;          // fraction of the canvas width: CAD linework left of it, finished render right
  const listeners = new Set();
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
    if (wireQueue.size) { const f = wireQueue.values().next().value; wireQueue.delete(f); wireFor(f); applyState(); dirtyFlag = true; }
    if (!dirtyFlag) return;
    dirtyFlag = false;
    draw();
    for (const fn of listeners) fn();
  }
  function draw() {
    // drag to look around: rotate the camera about the look point
    const off = camPos.clone().sub(look);
    const r = Math.hypot(off.x, off.z), a = Math.atan2(off.z, off.x) + yaw;
    const p = new THREE.Vector3(look.x + Math.cos(a) * r, off.y + look.y + pitch * r * 0.25, look.z + Math.sin(a) * r);
    p.sub(look).divideScalar(zoom).add(look);
    camera.position.copy(p); camera.lookAt(look);
    const cw = el.clientWidth, ch = el.clientHeight;
    if (Math.abs(shift) > 0.5) camera.setViewOffset(cw, ch, -shift, 0, cw, ch); else if (camera.view?.enabled) camera.clearViewOffset();
    if (split == null) { renderer.render(scene, camera); return; }
    const w = el.clientWidth, h = el.clientHeight, sx = Math.round(w * split);
    renderer.setScissorTest(true);
    renderer.setScissor(sx, 0, w - sx, h); renderer.render(scene, camera);   // finished first: it also refreshes the shadow map
    renderer.setScissor(0, 0, sx, h); renderCad();
    renderer.setScissorTest(false);
  }

  // ---------- CAD linework (the "before" of the before/after slider) ----------
  const CAD_BG = new THREE.Color(0x10294a);
  const cadFill = new THREE.MeshBasicMaterial({ color: 0x1a3a63, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const cadLine = new THREE.LineBasicMaterial({ color: 0xd9e8ff });
  const cadScene = new THREE.Scene();
  const cadEdges = {};   // level -> group of edge lines following that floor
  function edgesFor(level) {
    if (cadEdges[level] !== undefined) return cadEdges[level];
    const f = floors[level]; if (!f) return null;
    const g = new THREE.Group();
    for (const m of f.meshes) {
      if (m.userData.cat === 'Plot') continue;
      const ls = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), cadLine);
      ls.position.copy(m.position); ls.quaternion.copy(m.quaternion); ls.scale.copy(m.scale);
      g.add(ls);
    }
    cadScene.add(g); cadEdges[level] = g;
    return g;
  }
  function renderCad() {
    const bg = scene.background, fog = scene.fog, hidden = [finishSet, ground, nb, stars, ...Object.values(units).map((u) => u.group)];
    const vis = hidden.map((o) => o.visible);
    scene.background = CAD_BG; scene.fog = null; scene.overrideMaterial = cadFill; hidden.forEach((o) => { o.visible = false; });
    renderer.render(scene, camera);
    scene.background = bg; scene.fog = fog; scene.overrideMaterial = null; hidden.forEach((o, i) => { o.visible = vis[i]; });
    const level = state.focus || project.typical;
    for (const [k, g] of Object.entries(cadEdges)) if (g) g.visible = k === level;
    const g = edgesFor(level);
    if (g) {
      g.position.y = floors[level].group.position.y;
      const ac = renderer.autoClear; renderer.autoClear = false;
      renderer.render(cadScene, camera);
      renderer.autoClear = ac;
    }
  }
  requestAnimationFrame(frame);

  // drag: temporary look-around that eases back when released
  let dragging = false, lx = 0, ly = 0;
  const onDown = (e) => { dragging = true; lx = e.clientX; ly = e.clientY; el.classList.add('dragging'); };
  const onMove = (e) => { if (!dragging) return; yaw += (e.clientX - lx) * 0.004; pitch += (e.clientY - ly) * 0.002; pitch = Math.max(-0.8, Math.min(0.8, pitch)); lx = e.clientX; ly = e.clientY; dirty(); };
  const onUp = () => { dragging = false; el.classList.remove('dragging'); };
  el.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  let relax = setInterval(() => {
    if (!dragging && (Math.abs(yaw) > 1e-3 || Math.abs(pitch) > 1e-3)) { yaw *= 0.9; pitch *= 0.9; dirty(); }
    if (Math.abs(shift - shiftTo) > 0.5) { shift += (shiftTo - shift) * 0.15; dirty(); } else if (shift !== shiftTo) { shift = shiftTo; dirty(); }
  }, 32);

  return {
    scene, camera, renderer, state, levels, levelY, center, H, floors,
    load, loadUnit, setCamera, dirty,
    /** dolly factor towards the look point (1 = tour framing) */
    setZoom(k) { zoom = Math.max(0.6, Math.min(3, k)); dirty(); return zoom; },
    get zoom() { return zoom; },
    /** ease the framing sideways by px (positive = right) */
    setShift(px) { shiftTo = px; },
    /** before/after slider: null for the normal render, else 0..1 of the canvas width */
    setSplit(f) { split = f == null ? null : Math.max(0, Math.min(1, f)); dirty(); },
    /** called after every rendered frame (for screen-space callouts) */
    onFrame(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** PNG of the current view at a higher pixel ratio, cropped to a CSS-pixel rect of the stage */
    capture({ scale = 2, crop = null } = {}) {
      const pr = renderer.getPixelRatio(), w = el.clientWidth, h = el.clientHeight;
      renderer.setPixelRatio(scale); renderer.setSize(w, h, false);
      draw();
      const c = crop || { x: 0, y: 0, w, h };
      const out = document.createElement('canvas'); out.width = Math.round(c.w * scale); out.height = Math.round(c.h * scale);
      out.getContext('2d').drawImage(canvas, c.x * scale, c.y * scale, c.w * scale, c.h * scale, 0, 0, out.width, out.height);
      renderer.setPixelRatio(pr); renderer.setSize(w, h, false); dirty();
      return new Promise((res) => out.toBlob(res, 'image/png'));
    },
    set(partial) { Object.assign(state, partial); applyState(); dirty(); },
    setNight(t) { state.night = t; setNight(t); dirty(); },
    /** world -> screen position (px) for callouts */
    project(v) { const p = new THREE.Vector3(...v).project(camera); return [(p.x + 1) / 2 * el.clientWidth, (1 - p.y) / 2 * el.clientHeight, p.z < 1]; },
    dispose() {
      alive = false; clearInterval(relax); ro.disconnect();
      el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
      scene.traverse((o) => { if (o.isMesh) o.geometry?.dispose(); });
      Object.values(materials).forEach((m) => m.dispose()); Object.values(finishBase).forEach((m) => m.dispose()); finishMats.forEach((m) => m.dispose());
      cadScene.traverse((o) => { if (o.isLineSegments) o.geometry.dispose(); });
      ghost.dispose(); wireMat.dispose(); depthOnly.dispose(); stars.geometry.dispose(); stars.material.dispose(); renderer.dispose(); canvas.remove(); listeners.clear();
    },
  };
}
