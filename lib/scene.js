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
export const MODELS = { core: 'core', detail: 'detail' };   // served encrypted by app/api/scene (see lib/sceneGuard.js)

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
  Chajja:         { color: 0xf4f2ee, roughness: .5 },
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
  Water:          { color: 0x46c9d0, roughness: .05, metalness: .1, transparent: true, opacity: .8, emissive: 0x1d8f9c, emissiveIntensity: .25 },
  Pallets:        { color: 0x7d7d7d, roughness: .5, metalness: .5 },
  Cars:           { color: 0x3b4048, roughness: .4, metalness: .3 },
  Stairs:         { color: 0xcfc8ba, roughness: .9 },
  StairLandings:  { color: 0xcfc8ba, roughness: .9 },
  Handrails:      { color: 0x5a5047, roughness: .4, metalness: .5 },
  LiftShaft:      { color: 0xcfc8ba, roughness: .9 },
  LiftCars:       { color: 0x8a8a8a, roughness: .3, metalness: .6 },
  Terrace:        { color: 0xa47c58, roughness: .8 },    // timber deck, as on the brochure rooftop
  Parapets:       { color: 0xf4f2ee, roughness: .5 },
  TerraceWalls:   { color: 0xf4f2ee, roughness: .5 },
  TerraceCore:    { color: 0x8f8a84, roughness: .8 },   // grey rooftop core, as in the brochure rooftop render
  OverheadTank:   { color: 0x8f8a84, roughness: .8 },
  LMR:            { color: 0x8f8a84, roughness: .8 },
  Plot:           { color: 0xcfc5b3, roughness: 1 },
};
const CAST = new Set(['ArchWalls', 'Slabs', 'Chajja', 'Parapets', 'TerraceWalls', 'TerraceCore', 'LMR', 'OverheadTank', 'ShearWalls_300', 'ShearWalls_230']);
const RECV = new Set(['ArchWalls', 'Slabs', 'Chajja', 'Plot', 'Terrace', 'Parapets']);
const EXPLODE_GAP = 1.7;

// ---------- facade skin ----------
// The structural GLB has plain walls with punched windows; the brochure renders show a dark
// bronze façade with a grid of windows on the flat faces, curved full-height glass bays with
// white balcony bands at the curved corners, white pilasters where the curves meet the flat
// faces, a podium of shopfront glazing and a white rooftop crown with louvred screens, the
// logo and the pool. The skin is generated from one clean outline of the typical floor plate
// (OUTLINE below), so every floor stacks exactly. It is hidden on a floor while that floor is
// sliced open, so the interior shots still see in.
export const SKIN = new Set(['Curtain', 'Band', 'Fins', 'Crown', 'Louvres', 'Sign']);   // pool and planting stay when the roof is opened
// drawn rooftop walls the crown stands in for: hidden while the crown is shown, back when the roof is sliced open
const UNDER_CROWN = new Set(['TerraceWalls', 'Parapets', 'ArchWalls']);
const BAND_H = 0.28, CROWN_FASCIA = 0.8;
const PROTRUDE = { flat: 0.16, arc: 0.55 };   // white band projection: thin on flat faces, balcony-deep on the curves

/**
 * Outline of the typical floor plate in the model frame (x, z metres), in ring order (outward
 * normals on the left of travel, as three.js' counter-clockwise winding expects): west end,
 * north (road-side long) face with small rounded corners, east end, the large-radius south-east
 * arc, the flat south face and the south-west arc. Arc radii are fitted to the slab edge of the
 * typical floor plan (R ≈ 8.7 m west, ≈ 10 m east), meeting the flat faces at a crease.
 */
const OUTLINE_INTERIOR = [13.95, 7.3];
const X0 = 1.45, X1 = 26.45, Z0 = 2.4, Z1 = 12.2, RC = 0.6, ZEND = 6.9, XS0 = 7.0, XS1 = 20.2;
function linePts(a, b, step = 0.6) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(len / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push({ x: a[0] + dx * i / n, z: a[1] + dz * i / n, nx: dz / len, nz: -dx / len });
  return out;
}
function arcPts(a, b, R) {
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1];
  const c = Math.hypot(dx, dz), h = Math.sqrt(Math.max(0, R * R - c * c / 4));
  const px = -dz / c, pz = dx / c;
  const c1 = [mx + px * h, mz + pz * h], c2 = [mx - px * h, mz - pz * h];
  const d = (p) => Math.hypot(p[0] - OUTLINE_INTERIOR[0], p[1] - OUTLINE_INTERIOR[1]);
  const C = d(c1) < d(c2) ? c1 : c2;   // centre on the inside of the plate
  const a1 = Math.atan2(a[1] - C[1], a[0] - C[0]);
  let da = Math.atan2(b[1] - C[1], b[0] - C[0]) - a1;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const n = Math.max(2, Math.ceil(Math.abs(da) * R / 0.35));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = a1 + da * i / n, nx = Math.cos(t), nz = Math.sin(t);
    out.push({ x: C[0] + R * nx, z: C[1] + R * nz, nx, nz });
  }
  return out;
}
function face(id, kind, pts) {
  let s = 0;
  pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); p.s = s; });
  return { id, kind, pts, len: s };
}
export const OUTLINE = [
  face('W', 'flat', linePts([X0, ZEND], [X0, Z0 + RC])),
  face('N', 'flat', [...arcPts([X0, Z0 + RC], [X0 + RC, Z0], RC), ...linePts([X0 + RC, Z0], [X1 - RC, Z0]).slice(1), ...arcPts([X1 - RC, Z0], [X1, Z0 + RC], RC).slice(1)]),
  face('E', 'flat', linePts([X1, Z0 + RC], [X1, ZEND])),
  face('SE', 'arc', arcPts([X1, ZEND], [XS1, Z1], 10)),
  face('S', 'flat', linePts([XS1, Z1], [XS0, Z1])),
  face('SW', 'arc', arcPts([XS0, Z1], [X0, ZEND], 8.7)),
];
// where the curves meet the flat faces: white full-height pilasters (normal of the flat face)
const PILASTERS = [
  { x: X0, z: ZEND, nx: -1, nz: 0, w: 0.5 },
  { x: XS0, z: Z1, nx: 0, nz: 1, w: 0.75 },
  { x: XS1, z: Z1, nx: 0, nz: 1, w: 0.75 },
  { x: X1, z: ZEND, nx: 1, nz: 0, w: 0.5 },
];

const val = (v, p) => (typeof v === 'function' ? v(p) : v);
/**
 * Vertical strip along a face's points, pushed out by `off` (number or fn(point)), from y0 to y1
 * (numbers or fn(point)). u runs in metres / uScale along the face; v is 0..1 bottom to top, or
 * absolute height / vScale when vScale is given (continuous louvre stripes).
 */
function wallStrip(pts, off, y0, y1, uScale = 1, vScale = 0) {
  const pos = [], nor = [], uv = [], idx = [];
  pts.forEach((p, i) => {
    const d = val(off, p), x = p.x + p.nx * d, z = p.z + p.nz * d, a = val(y0, p), b = val(y1, p);
    pos.push(x, a, z, x, b, z);
    nor.push(p.nx, 0, p.nz, p.nx, 0, p.nz);
    uv.push(p.s / uScale, vScale ? a / vScale : 0, p.s / uScale, vScale ? b / vScale : 1);
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  return geom(pos, nor, uv, idx);
}
/** Horizontal strip between two offsets at height y (fn or number), facing up (dir 1) or down (-1). */
function capStrip(pts, offIn, offOut, y, dir) {
  const pos = [], nor = [], uv = [], idx = [];
  pts.forEach((p, i) => {
    const a = val(offIn, p), b = val(offOut, p), h = val(y, p);
    pos.push(p.x + p.nx * a, h, p.z + p.nz * a, p.x + p.nx * b, h, p.z + p.nz * b);
    nor.push(0, dir, 0, 0, dir, 0);
    uv.push(0, 0, 0, 0);
    if (i) { const k = (i - 1) * 2; if (dir > 0) idx.push(k, k + 2, k + 1, k + 2, k + 3, k + 1); else idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3); }
  });
  return geom(pos, nor, uv, idx);
}
/** A white band: outer face plus top and bottom caps, between offset 0 and `off`. */
function bandStrip(pts, off, y0, y1) {
  return [wallStrip(pts, off, y0, y1), capStrip(pts, -0.05, off, y1, 1), capStrip(pts, -0.05, off, y0, -1)];
}
function geom(pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function mergeGeoms(list) {
  const pos = [], nor = [], uv = [], idx = [];
  let base = 0;
  for (const g of list) {
    if (g.index === null) { const n = g.attributes.position.count; g.setIndex(Array.from({ length: n }, (_, i) => i)); }
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, t = g.attributes.uv?.array;
    for (const v of p) pos.push(v);
    for (const v of n) nor.push(v);
    for (let i = 0; i < p.length / 3; i++) uv.push(t ? t[i * 2] : 0, t ? t[i * 2 + 1] : 0);
    for (const i of g.index.array) idx.push(i + base);
    base += p.length / 3;
    g.dispose();
  }
  return geom(pos, nor, uv, idx);
}

// ---------- façade textures (canvas, day colour + night emissive pairs) ----------
const BRONZE = '#584c43', BRONZE_DK = '#2b2520';
function glassFill(x, x0, y0, x1, y1) {   // sky reflection fading down the pane, as in the day render
  const g = x.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#93a8ba'); g.addColorStop(0.3, '#5a6e80'); g.addColorStop(1, '#262f39');
  x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
}
function litFill(x, x0, y0, x1, y1) {
  const g = x.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff3e0'); g.addColorStop(1, '#b59a7a');
  x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
}
function roundRect(x, x0, y0, w, h, r) {
  x.beginPath();
  x.moveTo(x0 + r[0], y0); x.lineTo(x0 + w - r[1], y0); x.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r[1]);
  x.lineTo(x0 + w, y0 + h - r[2]); x.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r[2], y0 + h);
  x.lineTo(x0 + r[3], y0 + h); x.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r[3]);
  x.lineTo(x0, y0 + r[0]); x.quadraticCurveTo(x0, y0, x0 + r[0], y0); x.closePath();
}
const PATTERNS = {
  // flat faces: one bay per repeat, a large window with a mullion and transom in bronze cladding
  grid: { w: 256, h: 256, tiles: 5, draw(x, night) {
    x.fillStyle = night ? '#000' : BRONZE; x.fillRect(0, 0, 256, 256);
    if (!night) { const g = x.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
    (night ? litFill : glassFill)(x, 34, 30, 222, 226);
    x.fillStyle = night ? '#000' : BRONZE_DK;
    x.fillRect(126, 30, 5, 196); x.fillRect(34, 86, 188, 4);
    if (!night) { x.strokeStyle = BRONZE_DK; x.lineWidth = 6; x.strokeRect(34, 30, 188, 196); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(37, 33, 182, 2); }
  } },
  // top floors of the flat south face: near floor-to-ceiling glass, as in the renders
  gridGlass: { w: 256, h: 256, tiles: 3, draw(x, night) {
    x.fillStyle = night ? '#000' : BRONZE; x.fillRect(0, 0, 256, 256);
    (night ? litFill : glassFill)(x, 14, 10, 242, 250);
    x.fillStyle = night ? '#000' : BRONZE_DK;
    x.fillRect(88, 10, 4, 240); x.fillRect(164, 10, 4, 240); x.fillRect(14, 70, 228, 4);
    if (!night) { x.strokeStyle = BRONZE_DK; x.lineWidth = 5; x.strokeRect(14, 10, 228, 240); }
  } },
  // curved bays: full-height glass across the whole arc in a bronze frame with rounded corners
  // that groups two floors (upper floor: rounded top; lower floor: rounded bottom)
  bayTop: { w: 512, h: 256, draw(x, night) { bay(x, night, 'top'); } },
  bayBot: { w: 512, h: 256, draw(x, night) { bay(x, night, 'bot'); } },
  bayRefuge: { w: 512, h: 256, draw(x, night) {   // open refuge floor: dark void over a glass balustrade
    x.fillStyle = night ? '#000' : BRONZE; x.fillRect(0, 0, 512, 256);
    x.fillStyle = night ? '#3a2c1d' : '#2d2925'; x.fillRect(30, 10, 452, 246);
    if (!night) { const g = x.createLinearGradient(0, 160, 0, 256); g.addColorStop(0, 'rgba(160,185,205,.55)'); g.addColorStop(1, 'rgba(60,75,90,.7)'); x.fillStyle = g; x.fillRect(30, 160, 452, 96); x.fillStyle = '#d9d6d0'; x.fillRect(30, 158, 452, 4); }
  } },
  // podium shopfronts (ground and first floor): clear glass onto warm interiors, slim mullions
  shop: { w: 256, h: 256, tiles: 1, draw(x, night) {
    const g = x.createLinearGradient(0, 0, 0, 256);
    if (night) { g.addColorStop(0, '#fff3dc'); g.addColorStop(1, '#e2c49a'); } else { g.addColorStop(0, '#8496a6'); g.addColorStop(.3, '#5e5850'); g.addColorStop(1, '#8c7257'); }
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = night ? '#000' : '#2c2723';
    x.fillRect(0, 0, 6, 256); x.fillRect(250, 0, 6, 256); x.fillRect(0, 36, 256, 5);
  } },
  // rooftop screens: dark horizontal louvres
  louvre: { w: 64, h: 64, draw(x, night) {
    x.fillStyle = night ? '#000' : '#26231f'; x.fillRect(0, 0, 64, 64);
    if (night) return;
    for (let i = 0; i < 4; i++) { x.fillStyle = '#5d5853'; x.fillRect(0, i * 16, 64, 9); x.fillStyle = '#77716b'; x.fillRect(0, i * 16, 64, 2); }
  } },
};
function bay(x, night, end) {
  x.fillStyle = night ? '#000' : BRONZE; x.fillRect(0, 0, 512, 256);
  const top = end === 'top', r = 70;
  roundRect(x, 30, top ? 26 : 0, 452, 230, top ? [r, r, 0, 0] : [0, 0, r, r]);
  x.save(); x.clip();
  (night ? litFill : glassFill)(x, 0, 0, 512, 256);
  x.fillStyle = night ? '#000' : BRONZE_DK;
  for (let i = 1; i < 8; i++) x.fillRect(20 + i * 59 - 2, 0, 4, 256);
  if (!night) { x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, 0, 512, 3); }
  x.restore();
}
const NIGHT_DIM = [0.15, 0.85, 0.4, 0.95, 0.25, 0.7, 0.05, 0.9, 0.55];
let texCache = null;
function facadeTextures() {
  if (texCache || typeof document === 'undefined') return texCache;
  texCache = {};
  for (const [name, p] of Object.entries(PATTERNS)) {
    const pair = {}, tiles = p.tiles || 1;
    for (const night of [false, true]) {
      const c = document.createElement('canvas'); c.width = p.w * tiles; c.height = p.h;
      const x = c.getContext('2d');
      for (let i = 0; i < tiles; i++) {
        x.save(); x.translate(i * p.w, 0); x.beginPath(); x.rect(0, 0, p.w, p.h); x.clip();
        p.draw(x, night);
        // at night some rooms are lit and some are not: dim each tile by a fixed pseudo-random amount
        if (night) { x.fillStyle = `rgba(0,0,0,${NIGHT_DIM[(i * 7 + name.length) % NIGHT_DIM.length]})`; x.fillRect(0, 0, p.w, p.h); }
        x.restore();
      }
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      pair[night ? 'night' : 'day'] = t;
    }
    texCache[name] = pair;
  }
  return texCache;
}
/** "The Sahil" lettering for the crown fascia (transparent canvas). */
function letteringTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#2f6fb3'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '600 118px Georgia, "Times New Roman", serif';
  if ('letterSpacing' in x) x.letterSpacing = '6px';
  x.fillText('The Sahil', 512, 86);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

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
    buildSkin();
    applyState();
  }

  // ---------- facade skin (see SKIN above) ----------
  let skinBuilt = false;
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f1, roughness: .38, metalness: 0, emissive: 0xffd9a8, emissiveIntensity: 0 });
  materials.Band = materials.Fins = materials.Crown = bandMat;
  const louvreMat = (() => {
    const tex = facadeTextures();
    return new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex?.louvre.day, roughness: .55, metalness: .3, side: THREE.DoubleSide });
  })();
  materials.Louvres = louvreMat;
  function curtainMat(pattern, level) {
    const key = `Curtain:${pattern}@${level}`;
    if (materials[key]) return materials[key];
    const tex = facadeTextures()?.[pattern];
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: tex?.day, roughness: .28, metalness: .2, envMapIntensity: .7,
      emissive: 0xffc98a, emissiveMap: tex?.night, emissiveIntensity: 0,
    });
    const r = hash(level + pattern);
    m.userData.night = pattern === 'shop' ? 0.8 : 0.15 + 0.35 * r;
    if (pattern !== 'shop' && r > 0.45) m.emissive.set(r > 0.8 ? 0xd9c8ff : 0xbcd2ff);   // some homes lit cool white, most warm (night render)
    glassMats.push(m);
    materials[key] = m;
    return m;
  }
  function addSkin(level, cat, geom, mat, cast = true) {
    const f = floorFor(level);
    const m = new THREE.Mesh(geom, mat);
    m.name = `${level}_${cat}`;
    m.userData = { level, cat, mat };
    m.castShadow = shadows && cast;
    m.receiveShadow = shadows;
    f.group.add(m);
    f.meshes.push(m);
    return m;
  }
  const protrude = (kind) => PROTRUDE[kind];
  /** Pattern of a face on a level. */
  function patternFor(level, fc) {
    if (level === 'G' || level === 'F01') return 'shop';
    const n = parseInt(level.slice(1), 10);
    if (fc.kind === 'arc') {
      if ((n === 7 || n === 14) && fc.id === 'SE') return 'bayRefuge';
      return n % 2 ? 'bayTop' : 'bayBot';
    }
    if (fc.id === 'S' && n >= 18) return 'gridGlass';
    return 'grid';
  }
  /** Repeat length along a face so each pattern tile is a whole bay. */
  function uScaleFor(pattern, fc) {
    if (pattern.startsWith('bay')) return fc.len;
    const tiles = PATTERNS[pattern].tiles || 1;
    if (pattern === 'shop') return tiles * fc.len / Math.max(1, Math.round(fc.len / 2.2));
    if (fc.id === 'S') return tiles * fc.len / 3;              // three window bays, as in the renders
    return tiles * fc.len / Math.max(1, Math.round(fc.len / 3.1));
  }
  function pilaster(p, y0, y1, depth = 0.8) {
    const g = new THREE.BoxGeometry(p.w, y1 - y0, depth);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(p.nx, p.nz)).setPosition(p.x + p.nx * (depth / 2 - 0.12), (y0 + y1) / 2, p.z + p.nz * (depth / 2 - 0.12)));
    return g;
  }
  function buildSkin() {
    if (skinBuilt) return;
    // top of the slab on every floor that has one (the roof deck is the terrace's slab)
    const slabs = [];
    const v = new THREE.Vector3();
    for (const level of LEVELS) {
      const f = floors[level];
      const slabCat = level === 'T' ? 'Terrace' : 'Slabs';
      const ms = f?.meshes.filter((m) => m.userData.cat === slabCat) || [];
      if (!ms.length || level === 'B') continue;
      let top = -Infinity;
      for (const m of ms) {
        const a = m.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrix); if (v.y > top) top = v.y; }
      }
      slabs.push({ level, top });
    }
    if (slabs.length < 3) return;
    skinBuilt = true;
    const bandH = (level) => (level === 'T' ? CROWN_FASCIA : BAND_H);
    for (let i = 0; i < slabs.length; i++) {
      const { level, top } = slabs[i];
      const next = slabs[i + 1];
      if (level === 'T') { buildCrown(top); continue; }
      // white slab-edge band (none at the first floor, so the podium glazing reads double height)
      if (level !== 'F01') {
        const y0 = level === 'G' ? top - 0.3 : top - BAND_H;
        addSkin(level, 'Band', mergeGeoms(OUTLINE.flatMap((fc) => bandStrip(fc.pts, protrude(fc.kind), y0, top + .02))), bandMat);
      }
      if (!next) continue;
      const y0 = top + .02, y1 = next.top - (next.level === 'F01' ? -0.02 : bandH(next.level));
      // façade between this band and the next, one strip per face with that face's pattern
      const byPattern = {};
      for (const fc of OUTLINE) {
        const pat = patternFor(level, fc);
        (byPattern[pat] ||= []).push(wallStrip(fc.pts, .04, y0, y1, uScaleFor(pat, fc)));
      }
      for (const [pat, list] of Object.entries(byPattern)) addSkin(level, 'Curtain', mergeGeoms(list), curtainMat(pat, level), false);
      // white pilasters where the curves meet the flat faces, floor to floor
      const fy0 = level === 'G' ? 0 : top - BAND_H, fy1 = next.top - BAND_H;
      addSkin(level, 'Fins', mergeGeoms(PILASTERS.map((p) => pilaster(p, fy0, fy1))), bandMat);
    }
  }
  /**
   * Rooftop crown as in the brochure: a deep white fascia carrying "The Sahil", a louvred parapet
   * capped by a white ring all round, and a taller louvred screen along the road-side face and
   * both ends whose white top sweeps down over the curved corners; the logo on a louvred panel at
   * the centre of the south face, the pool in the east curve and planting along the west curve.
   */
  function buildCrown(top) {
    const L = 'T', PAR = 1.25, SCREEN = 4.6, CAP = 0.32;
    const pieces = [];
    // fascia + parapet ring
    for (const fc of OUTLINE) {
      const p = protrude(fc.kind);
      pieces.push(...bandStrip(fc.pts, p, top - CROWN_FASCIA, top + .05));
      pieces.push(...bandStrip(fc.pts, p, top + PAR - CAP, top + PAR));
    }
    // screen height along each face: full on the ends and the road side, sweeping down over the arcs
    const screenH = (fc) => {
      if (fc.kind === 'flat') return fc.id === 'S' ? null : () => SCREEN;
      const fromEnd = (p) => (fc.id === 'SE' ? p.s / fc.len : 1 - p.s / fc.len);   // 0 at the end face
      return (p) => { const t = Math.min(1, fromEnd(p) / 0.62); const e = t * t * (3 - 2 * t); return SCREEN + (PAR - SCREEN) * e; };
    };
    const louvres = [];
    for (const fc of OUTLINE) {
      louvres.push(wallStrip(fc.pts, .06, top + .05, top + PAR - CAP, 1.2, 0.5));          // parapet
      louvres.push(wallStrip(fc.pts, -.05, top + .05, top + PAR - CAP, 1.2, 0.5));         // its inner face
      const h = screenH(fc);
      if (!h) continue;
      const pts = fc.pts.filter((p) => h(p) > PAR + 0.05 || fc.kind === 'flat');
      if (pts.length < 2) continue;
      louvres.push(wallStrip(pts, .06, top + PAR, (p) => top + h(p) - CAP, 1.2, 0.5));
      louvres.push(wallStrip(pts, -.05, top + PAR, (p) => top + h(p) - CAP, 1.2, 0.5));
      // white top of the screen: outer face, inner face and cap
      pieces.push(wallStrip(pts, .22, (p) => top + h(p) - CAP, (p) => top + h(p)));
      pieces.push(wallStrip(pts.map((p) => ({ ...p, nx: -p.nx, nz: -p.nz })).reverse(), .12, (p) => top + h(p) - CAP, (p) => top + h(p)));
      pieces.push(capStrip(pts, -.12, .22, (p) => top + h(p), 1));
      pieces.push(capStrip(pts, -.12, .22, (p) => top + h(p) - CAP, -1));
    }
    // the pilasters carry on up into the parapet ring
    for (const p of PILASTERS) pieces.push(pilaster(p, top - CROWN_FASCIA, top + PAR));
    addSkin(L, 'Crown', mergeGeoms(pieces), bandMat);
    addSkin(L, 'Louvres', mergeGeoms(louvres), louvreMat);

    // logo panel at the centre of the south face, lettering on the fascia below it
    const cx = (XS0 + XS1) / 2;
    const panel = new THREE.BoxGeometry(3.4, 2.7, .25); panel.translate(cx, top + 1.35, Z1 - .05);
    const frame = new THREE.BoxGeometry(3.7, .22, .4); frame.translate(cx, top + 2.75, Z1 - .05);
    addSkin(L, 'Sign', mergeGeoms([panel, frame]), louvreMat);
    if (typeof document !== 'undefined') {
      const signMat = new THREE.MeshStandardMaterial({ map: letteringTexture(), transparent: true, roughness: .4, metalness: .2, emissive: 0x5aa0ff, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
      signMat.userData.night = 0.9; glassMats.push(signMat);
      const word = new THREE.PlaneGeometry(4.6, .72); word.translate(cx, top - CROWN_FASCIA / 2 - .02, Z1 + PROTRUDE.flat + .03);
      addSkin(L, 'Sign', word, signMat, false);
      materials['Sign:word'] = signMat;
      const logoMat = new THREE.MeshStandardMaterial({ transparent: true, roughness: .4, metalness: .3, emissive: 0x5aa0ff, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2 });
      logoMat.userData.night = 0.9; glassMats.push(logoMat);
      materials['Sign:logo'] = logoMat;
      const img = new Image();
      img.onload = () => {   // just the round mark (top 78 % of the logo artwork)
        const c = document.createElement('canvas'); c.width = 512; c.height = 512;
        const sh = img.height * 0.78, sw = Math.min(img.width, sh);
        c.getContext('2d').drawImage(img, (img.width - sw) / 2, 0, sw, sh, 0, 0, 512, 512);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
        logoMat.map = t; logoMat.emissiveMap = t; logoMat.needsUpdate = true;
        onChange && onChange();
      };
      img.src = '/assets/img/logo-sahil-mark.png';
      const mark = new THREE.PlaneGeometry(2.2, 2.2); mark.translate(cx, top + 1.42, Z1 + .09);
      addSkin(L, 'Sign', mark, logoMat, false);
    }

    // pool in the east curve: the plate outline pulled in, cut at x = 20.6
    const inset = (d) => OUTLINE.flatMap((fc) => fc.pts.map((p) => [p.x - p.nx * d, p.z - p.nz * d]));
    const poolShape = (d, xCut) => {
      const ring = inset(d).filter(([x]) => x >= xCut);
      ring.sort((a, b) => Math.atan2(a[1] - 7.3, a[0] - xCut) - Math.atan2(b[1] - 7.3, b[0] - xCut));
      const s = new THREE.Shape();
      s.moveTo(xCut, 7.3 - 0); ring.forEach(([x, z]) => s.lineTo(x, z)); s.closePath();
      return s;
    };
    const basin = new THREE.ExtrudeGeometry(poolShape(.35, 20.6), { depth: .5, bevelEnabled: false });
    basin.rotateX(Math.PI / 2); basin.translate(0, top + .5, 0);
    addSkin(L, 'PoolBasin', basin, bandMat);
    const water = new THREE.ShapeGeometry(poolShape(.7, 21.0));
    water.rotateX(Math.PI / 2); water.translate(0, top + .515, 0);
    const wm = getMaterial('Water', L).clone(); wm.color.set(0x3fd3d6); wm.emissive.set(0x23a9b3); wm.emissiveIntensity = .35; wm.side = THREE.DoubleSide;
    materials['Water:pool'] = wm;
    addSkin(L, 'Pool', water, wm, false);

    // planting along the inside of the west curve and the west half of the south face
    const leaf = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: .9, flatShading: true });
    materials.Planting = leaf;
    const bushes = [], rnd = (k) => hash('p' + k);
    let k = 0;
    for (const fc of OUTLINE.filter((f) => f.id === 'SW' || f.id === 'W')) {
      for (let i = 0; i < fc.pts.length; i++) {
        const p = fc.pts[i], r = .35 + .3 * rnd(k++);
        const g = new THREE.IcosahedronGeometry(r, 0);
        g.scale(1, .8 + .5 * rnd(k++), 1);
        g.translate(p.x - p.nx * .7, top + r * .7, p.z - p.nz * .7);
        bushes.push(g);
      }
    }
    if (bushes.length) addSkin(L, 'Planting', mergeGeoms(bushes), leaf);
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
        const opened = state.slice && level === state.focus;
        const skinned = skinBuilt && !opened && level === 'T' && UNDER_CROWN.has(m.userData.cat);
        m.visible = !state.hiddenCats.has(m.userData.cat) && !(opened && SKIN.has(m.userData.cat)) && !skinned;
        m.material = fi >= 0 && level !== state.focus ? ghost : m.userData.mat;
      }
    }
    onChange && onChange();
  }

  /** Night look of the materials only (lights belong to whoever renders). */
  function setNight(t) {
    state.night = t;
    bandMat.emissiveIntensity = t * 0.3;   // the white bands and crown catch the façade lighting
    for (const g of glassMats) {
      g.emissiveIntensity = t * g.userData.night * 1.6;
      g.opacity = 0.82 + (0.9 - 0.82) * t;
    }
    onChange && onChange();
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  async function loadOne(name, onProgress) {
    const buf = await fetchModel(name, onProgress);
    const g = await loader.parseAsync(buf, '');
    addGltf(g);
    return g;
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

// ---- protected model loading: a short-lived scene session, then AES-encrypted bytes ----
let sessionPromise = null;
function sceneSession() {
  if (!sessionPromise) {
    sessionPromise = fetch('/api/scene/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('Scene session refused'); return r.json(); })
      .then(async ({ token, key, ttl }) => {
        const raw = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
        const aes = await crypto.subtle.importKey('raw', raw, 'AES-CTR', false, ['decrypt']);
        setTimeout(() => { sessionPromise = null; }, Math.max(ttl - 30000, 1000));
        return { token, aes };
      });
    sessionPromise.catch(() => { sessionPromise = null; });
  }
  return sessionPromise;
}

async function fetchModel(name, onProgress) {
  const { token, aes } = await sceneSession();
  const r = await fetch(`/api/scene/part/${name}`, { headers: { 'X-Scene-Token': token }, credentials: 'same-origin', cache: 'no-store' });
  if (!r.ok || !r.body) throw new Error('Model unavailable');
  const total = Number(r.headers.get('content-length')) || 0;
  const reader = r.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length;
    onProgress && onProgress({ loaded, total });
  }
  const enc = new Uint8Array(loaded);
  let o = 0; for (const c of chunks) { enc.set(c, o); o += c.length; }
  return crypto.subtle.decrypt({ name: 'AES-CTR', counter: enc.subarray(0, 16), length: 128 }, aes, enc.subarray(16));
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
