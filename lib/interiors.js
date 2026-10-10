// Furnished interiors, after the brochure: the typical 5 BHK residence (floor plan, isometric,
// living, kitchen, bedroom and namaz room renders), the ground-floor entrance lobby, the
// 3rd-floor fitness centre and the rooftop (pool deck with its pergola, café with a roof deck,
// sit-outs). Surfaces are PBR textures from Poly Haven (CC0, public/assets/tex); hero furniture
// is either Poly Haven models (public/assets/models/ph) or modelled here with rounded, smooth
// geometry (sofas, beds, tub chairs, kitchen run, chandeliers, café, pergola); sanitaryware and
// a few utility pieces come from Kenney's Furniture Kit (CC0, public/assets/models/furniture).
// Positions are read off the brochure floor plan in plan pixels: the plan registers exactly with
// the model (stair core and lift shafts coincide), see X()/Z() below.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { OUTLINE, LEVEL_Y } from './scene.js';

// brochure floor plan pixel -> model metres (37 px per metre; lift shafts at x 16.88, z 3.35)
const X = (px) => 16.88 + (px - 585) / 37;
const Z = (py) => 3.35 + (py - 55) / 37;
const D = (px) => px / 37;   // plan pixels -> metres (lengths)
const WALL_H = 2.8, WALL_T = 0.12, CEIL = 2.85;
const PI = Math.PI;

// ---------- PBR textures (Poly Haven, /assets/tex) ----------
const TEX_URL = '/assets/tex/';
const texLoader = new THREE.TextureLoader();
const texCache = new Map();
function loadTex(file, srgb) {
  if (!texCache.has(file)) {
    texCache.set(file, texLoader.loadAsync(TEX_URL + file).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }).catch(() => null));
  }
  return texCache.get(file);
}
const SURFACES = ['marble_01', 'oak_wood_planks', 'oak_veneer_01', 'plastered_wall_02', 'floral_jacquard', 'granite_tile_03', 'red_brick_03', 'rubber_tiles', 'square_concrete_pavers', 'wood_floor_deck', 'leather_white', 'velour_velvet', 'white_stucco'];
let surfPromise = null;
/** All surface maps, loaded once: { name: { diff, nor, rough } }. */
function loadSurfaces() {
  if (!surfPromise) surfPromise = Promise.all(SURFACES.map(async (n) => [n, { diff: await loadTex(n + '_diff.webp', true), nor: await loadTex(n + '_nor.webp', false), rough: await loadTex(n + '_rough.webp', false) }])).then(Object.fromEntries);
  return surfPromise;
}
let SURF = null;
/**
 * A material on a Poly Haven surface. `rep` = texture repeats per metre (uv are in metres for
 * floors made with slab()/plate(); for boxes, uv are 0..1 per face so `rep` is per face).
 */
function surf(name, { rep = 1, color = 0xffffff, rough = 1, metal = 0, normal = 1, sheen = 0, sheenColor = 0xffffff, side, physical = false, noMap = false, ...rest } = {}) {
  const s = SURF?.[name];
  const Mat = physical || sheen ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const m = new Mat({ color, roughness: rough, metalness: metal, ...rest });
  if (side !== undefined) m.side = side;
  if (s) {
    const rp = (t) => { if (!t) return null; const c = t.clone(); c.repeat.set(rep, rep); c.needsUpdate = true; return c; };
    if (!noMap) m.map = rp(s.diff); m.normalMap = rp(s.nor); m.roughnessMap = rp(s.rough);
    m.normalScale = new THREE.Vector2(normal, normal);
  }
  if (sheen) { m.sheen = sheen; m.sheenColor = new THREE.Color(sheenColor); m.sheenRoughness = .7; }
  return m;
}

// ---------- canvas textures (patterns the brochure shows that have no photo source) ----------
function canvasTex(w, h, draw, { repeat = true, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
function veins(x, w, h, r, color, n = 7, width = 1.2) {
  x.strokeStyle = color; x.lineWidth = width;
  for (let i = 0; i < n; i++) {
    x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py);
    for (let k = 0; k < 12; k++) { px += (r() - .3) * w * .14; py += (r() - .5) * h * .12; x.lineTo(px, py); }
    x.globalAlpha = .25 + r() * .5; x.stroke();
  }
  x.globalAlpha = 1;
}
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const r = rng(9);
  TEX = {
    // white statuario (reception desk, dining top, lobby tables)
    statuario: canvasTex(1024, 1024, (x, w, h) => { x.fillStyle = '#f3f2ef'; x.fillRect(0, 0, w, h); veins(x, w, h, r, '#55575b', 9, 2.2); veins(x, w, h, r, '#9a9ca0', 14, 1); veins(x, w, h, r, '#c9c6bf', 20, .6); }),
    // geometric star lattice (namaz room walls)
    lattice: canvasTex(512, 512, (x, w, h) => {
      x.fillStyle = '#f1ece3'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b89a5a'; x.lineWidth = 1.6;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const cx = i * 64, cy = j * 64; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * PI / 4; x.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); x.lineTo(cx + Math.cos(a + PI / 8) * 18, cy + Math.sin(a + PI / 8) * 18); } x.closePath(); x.stroke(); x.beginPath(); x.arc(cx + 32, cy + 32, 9, 0, 7); x.stroke(); }
    }),
    // lobby triptych: brown wave on plaster
    art: canvasTex(768, 384, (x, w, h) => {
      x.fillStyle = '#d2cbc0'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(120,110,95,${r() * .08})`; x.fillRect(r() * w, r() * h, 2 + r() * 30, 1 + r() * 3); }
      x.fillStyle = '#6b3f26'; x.beginPath(); x.moveTo(0, h * .45);
      x.bezierCurveTo(w * .25, h * .1, w * .45, h * .8, w * .7, h * .4); x.bezierCurveTo(w * .85, h * .2, w * .95, h * .5, w, h * .35);
      x.lineTo(w, h * .6); x.bezierCurveTo(w * .8, h * .75, w * .6, h * .9, w * .45, h * .6); x.bezierCurveTo(w * .3, h * .35, w * .15, h * .8, 0, h * .7); x.closePath(); x.fill();
    }, { repeat: false }),
    // bedroom wall panels: pale fabric with a sketched branch (render)
    panelArt: canvasTex(512, 768, (x, w, h) => {
      x.fillStyle = '#e4ddd2'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(90,80,70,${r() * .05})`; x.fillRect(r() * w, r() * h, 2, 2); }
      x.strokeStyle = 'rgba(70,60,55,.55)'; x.lineWidth = 2;
      for (let b = 0; b < 4; b++) { x.beginPath(); let px = w * .2 + r() * w * .6, py = h; x.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (r() - .5) * 90; py -= 60 + r() * 40; x.lineTo(px, py); x.beginPath(); x.ellipse(px, py, 10 + r() * 8, 5 + r() * 3, r() * 3, 0, 7); x.stroke(); x.moveTo(px, py); } x.stroke(); }
    }, { repeat: false }),
    // chevron jali screen (kitchen), used as alpha
    jali: canvasTex(256, 512, (x, w, h) => {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 10;
      for (let y = -30; y < h + 30; y += 34) { x.beginPath(); x.moveTo(0, y); x.lineTo(w / 2, y + 26); x.lineTo(w, y); x.stroke(); }
      x.fillStyle = '#fff'; x.fillRect(0, 0, 12, h); x.fillRect(w - 12, 0, 12, h); x.fillRect(w / 2 - 4, 0, 8, h);
    }, { srgb: false }),
    sign: canvasTex(512, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#f6d9a2'; x.font = '600 70px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; if ('letterSpacing' in x) x.letterSpacing = '8px'; x.fillText('COFFEE', w / 2, h / 2 + 4); }, { repeat: false }),
    menu: canvasTex(256, 512, (x, w, h) => { x.fillStyle = '#1d1b1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8dcc6'; for (let i = 0; i < 14; i++) { x.fillRect(24, 40 + i * 30, 110 + (i * 37) % 60, 6); x.fillRect(200, 40 + i * 30, 28, 6); } x.font = '700 28px Georgia'; x.fillText('MENU', 24, 24); }, { repeat: false }),
    poster: canvasTex(256, 384, (x, w, h) => { x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#333'; x.fillRect(20, 20, w - 40, h * .62); x.fillStyle = '#fff'; x.font = '700 42px Jost, sans-serif'; x.textAlign = 'center'; x.fillText('KEEP', w / 2, h * .78); x.fillText('GOING', w / 2, h * .9); }, { repeat: false }),
    tv: canvasTex(512, 288, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1a2a44'); g.addColorStop(.5, '#2f5f8a'); g.addColorStop(1, '#d9b47a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.arc(w * .7, h * .35, 60, 0, 7); x.fill(); }, { repeat: false }),
    carpetRug: canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#8d867d'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 6; for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(0, i * 60 + 20); x.lineTo(w, i * 60 + 20); x.stroke(); } x.fillStyle = 'rgba(40,36,32,.35)'; x.fillRect(60, 60, w - 120, h - 120); x.fillStyle = '#8d867d'; x.fillRect(80, 80, w - 160, h - 160); }, { repeat: false }),
  };
  return TEX;
}

// ---------- materials ----------
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const t = textures();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  MATS = {
    // walls and ceilings
    wall: surf('plastered_wall_02', { color: 0xf0ebe2, rough: .9, normal: .5 }),
    wallWarm: surf('plastered_wall_02', { color: 0xd8cec0, rough: .9, normal: .5 }),
    wallGrey: surf('plastered_wall_02', { color: 0xbdb7ae, rough: .85, normal: .6 }),
    ceiling: std({ color: 0xf7f4ee, roughness: .95, side: THREE.BackSide }),
    ceilingDown: std({ color: 0xf7f4ee, roughness: .95 }),
    ceilingDark: std({ color: 0x2b2826, roughness: .8, side: THREE.BackSide }),
    timberCeil: surf('oak_veneer_01', { rep: .35, color: 0xe2c398, rough: .65, normal: .4 }),
    // floors
    marbleFloor: surf('marble_01', { color: 0xf2e6d2, rough: .9, metal: .02, normal: .4 }),   // cream polished marble (roughnessMap is scaled below)
    lobbyFloor: surf('marble_01', { color: 0xbfbab2, rough: .85, normal: .5 }),
    oakFloor: surf('oak_wood_planks', { color: 0xc9a173, rough: .7, normal: .6 }),
    bathStone: surf('granite_tile_03', { color: 0x8f8a84, rough: .7, normal: .5 }),
    carpet: surf('floral_jacquard', { color: 0x9e9aa6, rough: 1, normal: .8 }),
    brick: surf('red_brick_03', { color: 0xc9b2a4, rough: .95, normal: 1 }),
    rubber: surf('rubber_tiles', { color: 0x4a4a4c, rough: .95, normal: .7 }),
    pavers: surf('square_concrete_pavers', { color: 0xb9b6b1, rough: .9, normal: .8 }),
    deck: surf('wood_floor_deck', { color: 0xc89a6a, rough: .75, normal: .7 }),
    statuario: std({ map: t.statuario, roughness: .12, metalness: .02 }),
    // soft furnishings (sheen = velvet / boucle highlight)
    boucle: surf('leather_white', { color: 0xf1eadc, rough: 1, normal: .8, sheen: .6, sheenColor: 0xfff6ea }),
    boucleDark: surf('leather_white', { color: 0xcdbfae, rough: 1, normal: .8, sheen: .5, sheenColor: 0xfff0e0 }),
    velvetMaroon: surf('velour_velvet', { noMap: true, rep: 3, color: 0x6f3238, rough: .85, normal: .6, sheen: .9, sheenColor: 0xd08890 }),
    velvetBeige: surf('velour_velvet', { noMap: true, rep: 3, color: 0xd4c4ad, rough: .85, normal: .6, sheen: .8, sheenColor: 0xfff2e0 }),
    velvetGrey: surf('velour_velvet', { noMap: true, rep: 3, color: 0xa39a90, rough: .9, normal: .6, sheen: .8, sheenColor: 0xf0e8e0 }),
    velvetOlive: surf('velour_velvet', { noMap: true, rep: 3, color: 0x6f6a3a, rough: .9, normal: .6, sheen: .8, sheenColor: 0xd8d29a }),
    linen: surf('leather_white', { color: 0xf6f1e8, rough: 1, normal: .5, sheen: .4 }),
    duvet: surf('leather_white', { color: 0xf3ece0, rough: 1, normal: 1.2, sheen: .5, sheenColor: 0xfffaf0 }),
    headboard: surf('leather_white', { color: 0xe6dccb, rough: 1, normal: .8, sheen: .4 }),
    panelArt: std({ map: t.panelArt, roughness: .95 }),
    sheer: phys({ color: 0xffffff, roughness: .9, transmission: 0, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false, sheen: .5 }),
    drape: surf('velour_velvet', { noMap: true, rep: 2, color: 0xb59a7a, rough: .95, normal: .5, sheen: .6, sheenColor: 0xf0d8b8, side: THREE.DoubleSide }),
    rugGrey: std({ map: t.carpetRug, roughness: 1 }),
    rugDark: std({ color: 0x4f4b48, roughness: 1 }),
    // timber and stone furniture
    oak: surf('oak_veneer_01', { color: 0xc89c6b, rough: .55, normal: .5 }),
    walnut: surf('oak_veneer_01', { color: 0x4e3524, rough: .55, normal: .5 }),
    slats: surf('oak_veneer_01', { color: 0x5a3f2c, rough: .6, normal: .5, side: THREE.DoubleSide }),
    lattice: std({ map: t.lattice, roughness: .85 }),
    art: std({ map: t.art, roughness: .9 }),
    white: phys({ color: 0xf5f4f1, roughness: .18, metalness: 0, clearcoat: .6, clearcoatRoughness: .15 }),   // gloss kitchen shutters
    whiteDS: phys({ color: 0xf5f4f1, roughness: .18, metalness: 0, clearcoat: .6, clearcoatRoughness: .15, side: THREE.DoubleSide }),
    counter: surf('marble_01', { rep: .4, color: 0xb58d62, rough: .5, normal: .5, side: THREE.DoubleSide }),               // brown stone worktop (kitchen render)
    brass: std({ color: 0xcaa362, roughness: .28, metalness: .95 }),
    gold: std({ color: 0xd4a94c, roughness: .3, metalness: 1, emissive: 0x6b4a16, emissiveIntensity: .35 }),
    black: std({ color: 0x1f1f21, roughness: .4, metalness: .3 }),
    steel: std({ color: 0xc2c5c9, roughness: .25, metalness: .9 }),
    darkPanel: surf('oak_veneer_01', { color: 0x2e2724, rough: .7, normal: .4 }),
    stoneWall: surf('white_stucco', { color: 0xb4ada3, rough: .85, normal: .5 }),
    blueLocker: std({ color: 0x23497e, roughness: .5, metalness: .2 }),
    gymWhite: std({ color: 0xe8e8e6, roughness: .4 }),
    yellow: std({ color: 0xe9c22c, roughness: .5 }),
    mirror: std({ color: 0xd8dde2, roughness: .03, metalness: 1 }),
    glass: phys({ color: 0xdfeef4, roughness: .05, metalness: 0, transparent: true, opacity: .14, side: THREE.DoubleSide, depthWrite: false }),
    glassBal: phys({ color: 0xcfe3ea, roughness: .05, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }),
    frame: std({ color: 0x2f2a26, roughness: .5, metalness: .4 }),
    led: std({ color: 0xffe2b0, emissive: 0xffc77a, emissiveIntensity: 2.4 }),
    ledCool: std({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 1.8 }),
    downlight: std({ color: 0xfff4e0, emissive: 0xffe6bf, emissiveIntensity: 3 }),
    crystal: std({ color: 0xffe9b8, emissive: 0xffd080, emissiveIntensity: 1.1, roughness: .2, metalness: .7 }),
    shade: std({ color: 0xfff6e6, emissive: 0xffe0b0, emissiveIntensity: .9, roughness: .9, side: THREE.DoubleSide }),
    leaf: std({ color: 0x4a6e3a, roughness: .85 }),
    pot: surf('white_stucco', { color: 0xe8e2d8, rough: .9, normal: .4 }),
    potDark: std({ color: 0x3a3634, roughness: .8 }),
    rattan: std({ color: 0x8a6440, roughness: .95 }),
    water: phys({ color: 0x2f9a98, roughness: .04, metalness: 0, transparent: true, opacity: .85, transmission: 0 }),
    jali: std({ color: 0x2b2826, roughness: .6, metalness: .3, alphaMap: t.jali, alphaTest: .5, side: THREE.DoubleSide }),
    signText: std({ map: t.sign, transparent: true, emissive: 0xffd08a, emissiveMap: t.sign, emissiveIntensity: 1.4 }),
    menu: std({ map: t.menu, roughness: .6 }),
    poster: std({ map: t.poster, roughness: .6 }),
    tv: std({ map: t.tv, roughness: .2, emissive: 0xffffff, emissiveMap: t.tv, emissiveIntensity: .5 }),
    louvre: std({ color: 0x3a3633, roughness: .6, metalness: .3 }),
    louvreLight: std({ color: 0x6f6a66, roughness: .6, metalness: .3 }),
    cream: std({ color: 0xece8e0, roughness: .45 }),
    bronze: std({ color: 0x6f6157, roughness: .5, metalness: .5 }),
  };
  MATS.marbleFloor.roughness = .35; MATS.lobbyFloor.roughness = .3; MATS.statuario.roughness = .12;
  return MATS;
}

// ---------- primitive helpers (all return meshes positioned in model metres) ----------
function box(w, h, d, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; return m; }
/** Rounded box (soft furniture, cushions, plinths). */
function rbox(w, h, d, r, mat, x, y, z, ry = 0) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat); m.position.set(x, y + h / 2, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; return m; }
function cyl(rt, rb, h, mat, x, y, z, seg = 32) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; return m; }
/** Horizontal plane facing up at height y, uv in metres. */
function slab(x0, z0, x1, z1, y, mat) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-PI / 2);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0), uv.getY(i) * (z1 - z0));
  const m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; return m;
}
/** Vertical plane (picture, panel) facing direction `ry` (0 = +Z). */
function panel(w, h, mat, x, y, z, ry) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; return m; }
/** Axis-aligned wall between plan points, full height, uv in metres. */
function wallPx(px0, py0, px1, py1, y, mat, h = WALL_H) {
  const x0 = X(px0), z0 = Z(py0), x1 = X(px1), z1 = Z(py1);
  const w = Math.max(WALL_T, Math.abs(x1 - x0) + (z0 === z1 ? WALL_T : 0)), d = Math.max(WALL_T, Math.abs(z1 - z0) + (x0 === x1 ? WALL_T : 0));
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d), uv.getY(i) * h);
  const m = new THREE.Mesh(g, mat); m.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; return m;
}
/** Shape of the floor plate (the slab outline), for floors and ceilings. */
function plateShape(inset = 0.05) {
  const pts = OUTLINE.flatMap((fc) => fc.pts.map((p) => new THREE.Vector2(p.x - p.nx * inset, -(p.z - p.nz * inset))));
  return new THREE.Shape(pts);
}
function plateGeometry(inset) {
  const g = new THREE.ShapeGeometry(plateShape(inset)); g.rotateX(-PI / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  return g;
}
/** Points along the curved and flat south side of the plate (glass line), inset from the slab edge. */
function southGlassPts(inset) {
  return OUTLINE.filter((f) => f.id === 'SE' || f.id === 'S' || f.id === 'SW').flatMap((fc) => fc.pts.map((p) => ({ x: p.x - p.nx * inset, z: p.z - p.nz * inset, nx: p.nx, nz: p.nz })));
}
function ribbon(pts, y0, y1, mat, uScale = 0) {
  const pos = [], idx = [], uv = [];
  let s = 0;
  pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); pos.push(p.x, y0, p.z, p.x, y1, p.z); uv.push(uScale ? s / uScale : 0, 0, uScale ? s / uScale : 0, 1); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
}
const resample = (pts, step) => {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); if (acc >= step) { out.push(pts[i]); acc = 0; } }
  return out;
};
/** Down-facing strip (LED cove, seen from below only). */
function strip(w, d, mat, x, y, z, ry = 0) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.rotation.y = ry; return m; }
/** Instanced down-facing discs (downlights). */
function dots(points, r, h, mat) {
  const g = new THREE.CircleGeometry(r, 16); g.rotateX(PI / 2);
  const inst = new THREE.InstancedMesh(g, mat, points.length), m4 = new THREE.Matrix4();
  points.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); });
  return inst;
}

// ---------- model libraries: Kenney (utility pieces) + Poly Haven (hero pieces) ----------
const KENNEY_URL = '/assets/models/furniture/', PH_URL = '/assets/models/ph/';
const KENNEY = ['toilet', 'bathroomSink', 'shower', 'bathtub', 'bathroomMirror', 'washer', 'desk', 'chairDesk', 'computerScreen', 'kitchenCoffeeMachine', 'books', 'kitchenFridgeBuiltIn'];
const PH = ['mid_century_lounge_chair', 'modern_arm_chair_01', 'coffee_table_round_01', 'modern_coffee_table_01', 'dining_chair_02', 'Chandelier_01', 'modern_ceiling_lamp_01', 'potted_plant_02', 'potted_plant_04', 'pachira_aquatica_01', 'modern_wooden_cabinet', 'outdoor_table_chair_set_01', 'bar_chair_round_01'];
let libPromise = null;
function loadLibrary() {
  if (!libPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const prep = (n, s) => {
      if (n === 'pachira_aquatica_01') s.children.filter((o) => !/_b$/.test(o.name)).forEach((o) => s.remove(o));   // the file holds four plants in a row: keep the one at the origin
      s.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { if (/leaves|leaf/i.test(m.name) || /leaves|leaf/i.test(o.name)) { m.alphaTest = .5; m.side = THREE.DoubleSide; m.transparent = false; m.needsUpdate = true; } }
      });
      s.updateMatrixWorld(true);
      return [n, { scene: s, box: new THREE.Box3().setFromObject(s) }];
    };
    const one = (url, n) => loader.loadAsync(url + n + '.glb').then((g) => prep(n, g.scene)).catch((e) => { console.warn('model', n, e); return [n, null]; });
    libPromise = Promise.all([...KENNEY.map((n) => one(KENNEY_URL, n)), ...PH.map((n) => one(PH_URL, n))]).then((list) => Object.fromEntries(list));
  }
  return libPromise;
}
// Kenney material names -> render colours. Each placement can override.
const TINT = { carpet: '#d9ccb9', carpetWhite: '#f1ede6', carpetBlue: '#cdbfae', carpetDarker: '#6a6560', wood: '#a07a55', woodDark: '#5e4331', metal: '#2c2c2e', metalLight: '#e6e6e4', metalMedium: '#9a9a9a', metalDark: '#3b3b3d', plant: '#4c6d36', glass: '#cfe2ea' };
const matCache = new Map();
function tinted(mat, spec) {
  const key = mat.uuid + JSON.stringify(spec);
  if (!matCache.has(key)) {
    const m = mat.clone(); m.flatShading = false;
    if (typeof spec === 'string') m.color = new THREE.Color(spec);
    else { if (spec.color) m.color = new THREE.Color(spec.color); if (spec.noMap) m.map = null; if (spec.rough !== undefined) m.roughness = spec.rough; if (spec.emissive) { m.emissive = new THREE.Color(spec.emissive); m.emissiveIntensity = spec.emissiveIntensity ?? 1; } }
    m.needsUpdate = true; matCache.set(key, m);
  }
  return matCache.get(key);
}
/**
 * Places a library model fitted to a w × h × d box (metres; w along its width, d its depth) with
 * its bottom centre at (x, y, z), turned to face `face` (radians; 0 = the model's front towards +Z).
 * `tint` maps material names (or '*' for all) to a colour or { color, noMap, rough }. `keep` = true
 * keeps the model's proportions (scale uniformly to the largest given dimension).
 */
function fit(lib, name, { x, z, y = FLOOR_Y, w, d, h, face = 0, tint = {}, keep = false }) {
  const item = lib[name];
  if (!item) return new THREE.Group();
  const s = item.box.getSize(new THREE.Vector3()), c = item.box.getCenter(new THREE.Vector3());
  let sx = w ? w / s.x : (d ? d / s.z : (h ? h / s.y : 1)), sz = d ? d / s.z : sx, sy = h ? h / s.y : (sx + sz) / 2;
  if (keep) { const k = Math.min(w ? w / s.x : 1e9, d ? d / s.z : 1e9, h ? h / s.y : 1e9); sx = sy = sz = k === 1e9 ? 1 : k; }
  const inner = item.scene.clone(true);
  inner.scale.set(sx, sy, sz);
  inner.position.set(-c.x * sx, -item.box.min.y * sy, -c.z * sz);
  const colors = { ...(name in lib && PH.includes(name) ? {} : TINT), ...tint };
  inner.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; const out = ms.map((m) => (colors[m.name] ? tinted(m, colors[m.name]) : colors['*'] ? tinted(m, colors['*']) : m)); o.material = Array.isArray(o.material) ? out : out[0]; } });
  const g = new THREE.Group(); g.add(inner); g.position.set(x, y, z); g.rotation.y = face;
  return g;
}
let FLOOR_Y = 0;   // floor level of the interior being built: fit() places on it unless told otherwise
const FACE = { S: 0, N: PI, E: PI / 2, W: -PI / 2 };   // front towards +Z (south), -Z, +X, -X

// ---------- soft furniture (rounded, smooth) ----------
/**
 * A sofa section: plinth, seat cushions, back cushions and optional arms, `len` wide along its
 * local x, `dep` deep, front towards +z. Returns a group with its origin at the bottom centre.
 */
function sofa(len, dep = .95, { armL = true, armR = true, seats = 0, mat, dark } = {}) {
  const M = mats(), g = new THREE.Group(), f = mat || M.boucle, fd = dark || M.boucleDark;
  const armW = .22, inner = len - (armL ? armW : 0) - (armR ? armW : 0), x0 = -len / 2 + (armL ? armW : 0);
  g.add(rbox(len, .2, dep, .05, fd, 0, .06, 0));                       // plinth
  g.add(box(len - .1, .06, dep - .1, M.walnut, 0, 0, 0));              // recessed base
  const n = seats || Math.max(1, Math.round(inner / 1.0));
  for (let i = 0; i < n; i++) { const cw = inner / n; g.add(rbox(cw - .03, .22, dep - .3, .09, f, x0 + cw * (i + .5), .26, .1)); }
  for (let i = 0; i < n; i++) { const cw = inner / n; const b = rbox(cw - .04, .42, .22, .1, f, x0 + cw * (i + .5), .4, -dep / 2 + .16); b.rotation.x = -.12; g.add(b); }
  if (armL) g.add(rbox(armW, .62, dep - .02, .08, fd, -len / 2 + armW / 2, .06, 0));
  if (armR) g.add(rbox(armW, .62, dep - .02, .08, fd, len / 2 - armW / 2, .06, 0));
  return g;
}
function cushion(x, y, z, w = .45, h = .45, mat, ry = 0, rx = -.15) { const m = rbox(w, h, .13, .06, mat, 0, 0, 0); m.position.set(x, y + h / 2, z); m.rotation.set(rx, ry, 0); return m; }
/** The living room's U sofa: a long back section with two returns, open towards +z. */
function uSofa(x, y, z, ry = 0) {
  const g = new THREE.Group(), M = mats();
  const back = sofa(3.6, .95, { armL: false, armR: false, seats: 3 }); back.position.set(0, 0, 0); g.add(back);
  const l = sofa(2.0, .95, { armL: true, armR: false, seats: 2 }); l.rotation.y = PI / 2; l.position.set(-1.8 + .475, 0, .55 + .5); g.add(l);
  const r = sofa(2.0, .95, { armL: false, armR: true, seats: 2 }); r.rotation.y = -PI / 2; r.position.set(1.8 - .475, 0, .55 + .5); g.add(r);
  g.add(cushion(-.9, .48, -.1, .45, .45, M.velvetBeige, .2), cushion(.9, .48, -.1, .45, .45, M.velvetOlive, -.2), cushion(-1.3, .48, .9, .4, .4, M.velvetGrey, PI / 2));
  g.add(rbox(.8, .3, .4, .05, M.velvetGrey, 1.1, .3, 1.5));   // folded throw
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}
/** Tub chair: a curved shell around a round seat on four splayed legs (bedroom render). */
function tubChair(x, y, z, ry = 0, mat) {
  const M = mats(), g = new THREE.Group(), f = mat || M.velvetBeige;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(.38, .36, .42, 32, 1, true, PI * .15, PI * 1.7), f); shell.position.y = .62; shell.castShadow = true; g.add(shell);
  const shellIn = new THREE.Mesh(new THREE.CylinderGeometry(.34, .32, .4, 32, 1, true, PI * .15, PI * 1.7), f); shellIn.position.y = .62; shellIn.material = f; g.add(shellIn);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(.36, .03, 8, 48, PI * 1.7), f); lip.rotation.x = PI / 2; lip.rotation.z = PI * .15; lip.position.y = .83; g.add(lip);
  g.add(cyl(.36, .34, .14, f, 0, .36, 0)); g.add(cyl(.33, .33, .08, f, 0, .5, 0));
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; const leg = new THREE.Mesh(new THREE.CylinderGeometry(.014, .02, .38, 8), M.black); leg.position.set(Math.cos(a) * .22, .19, Math.sin(a) * .22); leg.rotation.z = -Math.cos(a) * .2; leg.rotation.x = Math.sin(a) * .2; g.add(leg); }
  g.add(cushion(0, .5, -.1, .34, .32, M.velvetOlive, 0, -.3));
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}
/** Platform bed with a quilted duvet, pillows and a wide upholstered headboard (bedroom render). Head towards -z. */
function bed(x, y, z, ry = 0, w = 1.9, l = 2.1) {
  const M = mats(), g = new THREE.Group();
  g.add(box(w + .24, .25, l + .12, M.oak, 0, .05, .02));                 // oak platform
  g.add(box(w, .05, l - .2, M.walnut, 0, 0, 0));
  g.add(rbox(w, .22, l, .06, M.linen, 0, .3, 0));                          // mattress
  const duvet = rbox(w + .04, .16, l * .66, .07, M.duvet, 0, .5, l * .17); duvet.rotation.x = .02; g.add(duvet);
  g.add(rbox(w * .5, .08, .35, .04, M.duvet, 0, .66, l * .17 - .5));      // folded edge
  for (const [dx, s] of [[-.45, 1], [.45, 1], [-.5, .8], [.5, .8]]) { const p = rbox(.7 * s, .14, .45 * s, .06, M.linen, dx, .52, -l / 2 + .32 + (s < 1 ? .18 : 0)); p.rotation.x = -.55; g.add(p); }
  const throwC = rbox(.5, .1, .4, .04, M.velvetGrey, .05, .53, -l / 2 + .75); throwC.rotation.x = -.25; g.add(throwC);
  // headboard: upholstered panel with an oak frame and a glowing reveal
  g.add(rbox(w + 1.6, 1.15, .1, .02, M.headboard, 0, .2, -l / 2 - .1));
  g.add(box(w + 1.7, .05, .14, M.oak, 0, 1.35, -l / 2 - .1));
  g.add(box(w + 1.7, .02, .02, M.led, 0, 1.33, -l / 2 - .02));
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}
function nightstand(x, y, z, ry = 0) { const M = mats(), g = new THREE.Group(); g.add(rbox(.5, .45, .42, .02, M.oak, 0, .05, 0)); g.add(box(.44, .02, .02, M.brass, 0, .3, .21)); g.add(cyl(.2, .2, .04, M.black, 0, .5, 0)); g.position.set(x, y, z); g.rotation.y = ry; return g; }
function tableLamp(x, y, z) { const M = mats(), g = new THREE.Group(); g.add(cyl(.06, .08, .02, M.brass, 0, 0, 0)); g.add(cyl(.012, .012, .3, M.brass, 0, .02, 0, 8)); g.add(cyl(.13, .15, .18, M.shade, 0, .3, 0)); g.position.set(x, y, z); return g; }
/** Hanging bedside pendant: a black cone on a cord (bedroom render). */
function pendant(x, yCeil, z, drop = 1.2) { const M = mats(), g = new THREE.Group(); g.add(cyl(.004, .004, drop, M.black, x, yCeil - drop, z, 4)); g.add(cyl(.09, .04, .12, M.black, x, yCeil - drop - .12, z)); g.add(cyl(.07, .07, .01, M.led, x, yCeil - drop - .12, z)); return g; }
/** Sheer + drape pair along a line, hung just below the ceiling. */
function curtain(x0, z0, x1, z1, y, { sheer = true, drape = true, h = CEIL - .05 } = {}) {
  const M = mats(), g = new THREE.Group(), len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
  const mk = (mat, amp, freq, off) => {
    const geo = new THREE.PlaneGeometry(len, h, Math.max(8, Math.round(len * 14)), 1);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * freq + off) * amp);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.position.set((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2); m.rotation.y = ry; m.castShadow = drape; return m;
  };
  if (sheer) g.add(mk(M.sheer, .035, 11, 0));
  if (drape) { const d = mk(M.drape, .06, 7, 1); d.scale.x = .42; d.position.add(new THREE.Vector3(Math.cos(ry) * (len * .29), 0, -Math.sin(ry) * (len * .29))); d.translateZ(.08); g.add(d); }
  g.add(box(len, .05, .1, M.frame, (x0 + x1) / 2, y + h, (z0 + z1) / 2, ry));
  return g;
}
function doorLeaf(px, py, y, ry, open = 1.2) { const M = mats(), g = new THREE.Group(); g.add(box(.04, 2.1, .9, M.walnut, 0, 0, .45)); g.add(box(.02, .02, .12, M.brass, .03, 1.0, .82)); g.position.set(X(px), y, Z(py)); g.rotation.y = ry + open; return g; }

// ---------- bespoke pieces ----------
function chandelierCrystal(x, y, z, w = 2.6, d = 1.0) {   // living: cascade of brass sprigs with gold leaves (render)
  const M = mats(), g = new THREE.Group(), r = rng(3);
  const leaf = new THREE.IcosahedronGeometry(0.022, 1); leaf.scale(1, .35, 2.2);
  const pos = [];
  for (let i = 0; i < 340; i++) { const a = r() * PI * 2, rr = Math.sqrt(r()); pos.push([x + Math.cos(a) * rr * w / 2, y - 0.22 - r() * 0.3 - (1 - rr) * .2, z + Math.sin(a) * rr * d / 2, r() * PI]); }
  const inst = new THREE.InstancedMesh(leaf, M.crystal, pos.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  pos.forEach((p, i) => { m4.compose(v.set(p[0], p[1], p[2]), q.setFromEuler(e.set(.3, p[3], .2)), s); inst.setMatrixAt(i, m4); });
  g.add(inst);
  const rods = pos.filter((_, i) => i % 3 === 0).map((p) => { const c = new THREE.CylinderGeometry(.0025, .0025, y - p[1], 3); c.translate(p[0], (y + p[1]) / 2, p[2]); return c; });
  g.add(new THREE.Mesh(mergeGeometries(rods), M.brass));
  g.add(box(w * .9, .03, .12, M.brass, x, y - .05, z));
  return g;
}
function ringPendants(x, y, z, rings) {   // lobby: timber rings with a lit inner face (render)
  const M = mats(), g = new THREE.Group();
  for (const [dx, dz, R, drop] of rings) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(R, .045, 10, 64), M.oak); t.rotation.x = PI / 2; t.position.set(x + dx, y - drop, z + dz); g.add(t);
    const l = new THREE.Mesh(new THREE.TorusGeometry(R - .025, .018, 8, 64), M.led); l.rotation.x = PI / 2; l.position.set(x + dx, y - drop - .04, z + dz); g.add(l);
    for (let k = 0; k < 3; k++) { const a = k * 2.1; g.add(cyl(.003, .003, drop, M.black, x + dx + Math.cos(a) * R, y - drop, z + dz + Math.sin(a) * R, 3)); }
  }
  return g;
}
function linearPendant(x, y, z, len, drop, ry = 0) { const M = mats(), g = new THREE.Group(); g.add(box(len, .03, .03, M.brass, 0, -drop, 0)); g.add(box(len - .04, .012, .02, M.ledCool, 0, -drop - .012, 0)); for (const s of [-.4, .4]) g.add(cyl(.003, .003, drop, M.black, s * len, -drop, 0, 3)); g.position.set(x, y, z); g.rotation.y = ry; return g; }
function plant(lib, x, y, z, kind = 'big', s = 1) {
  if (kind === 'big') return fit(lib, 'potted_plant_02', { x, z, y, h: 1.25 * s, keep: true });
  if (kind === 'tree') return fit(lib, 'pachira_aquatica_01', { x, z, y, h: 1.9 * s, keep: true });
  if (kind === 'small') return fit(lib, 'potted_plant_04', { x, z, y, h: .3 * s, keep: true });
  // 'bush': smooth clumps in a stucco planter
  const M = mats(), g = new THREE.Group(), r = rng(Math.round(x * 100 + z * 10));
  g.add(cyl(.24 * s, .2 * s, .5 * s, M.pot, x, y, z));
  const leaves = [];
  for (let i = 0; i < 7; i++) { const l = new THREE.IcosahedronGeometry((.18 + r() * .1) * s, 2); l.scale(1, 1.3, 1); l.translate(x + (r() - .5) * .36 * s, y + (.6 + r() * .45) * s, z + (r() - .5) * .36 * s); leaves.push(l); }
  const m = new THREE.Mesh(mergeGeometries(leaves), M.leaf); m.castShadow = true; g.add(m);
  return g;
}
function diningTable(x, y, z, len, wid, ry) {   // white marble top on a brass frame (living render)
  const M = mats(), g = new THREE.Group();
  g.add(rbox(wid, .05, len, .02, M.statuario, 0, .72, 0));
  for (const dz of [-len * .36, len * .36]) { g.add(box(wid * .7, .04, .05, M.brass, 0, .68, dz)); for (const dx of [-wid * .33, wid * .33]) g.add(box(.05, .68, .05, M.brass, dx, 0, dz)); }
  g.add(box(.05, .04, len * .72, M.brass, 0, .68, 0));
  g.add(cyl(.12, .1, .3, M.black, 0, .77, 0)); g.add(plantVase(0, .77, 0));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function plantVase(x, y, z) { const M = mats(), g = new THREE.Group(); const r = rng(5); const stems = []; for (let i = 0; i < 14; i++) { const c = new THREE.CylinderGeometry(.004, .004, .55 + r() * .25, 4); c.translate(x + (r() - .5) * .12, y + .3 + .35, z + (r() - .5) * .12); c.rotateX((r() - .5) * .2); stems.push(c); } g.add(new THREE.Mesh(mergeGeometries(stems), M.rattan)); return g; }
function displayCabinet(x, y, z, w, ry) {   // dining wall unit: dark frame, lit glass shelves
  const M = mats(), g = new THREE.Group();
  g.add(box(w, 2.4, .42, M.darkPanel, 0, 0, 0));
  g.add(box(w - .12, 1.5, .34, M.black, 0, .85, .05));
  for (let i = 0; i < 4; i++) { g.add(box(w - .16, .02, .3, M.glassBal, 0, .95 + i * .36, .06)); g.add(box(w - .2, .012, .02, M.led, 0, .96 + i * .36, -.08)); }
  g.add(box(w - .12, .02, .02, M.led, 0, 2.3, .2)); g.add(box(w - .14, 1.5, .01, M.glass, 0, .85, .22));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function tvWall(x, y, z, w, ry) {   // slatted TV unit (Poly Haven cabinet is placed separately) with a thin screen
  const M = mats(), g = new THREE.Group();
  g.add(box(w, 2.6, .06, M.darkPanel, 0, 0, 0));
  for (let i = 0; i < Math.floor(w / .12); i++) g.add(box(.05, 2.5, .03, M.walnut, -w / 2 + .06 + i * .12, .05, .04));
  g.add(box(1.9, 1.08, .03, M.black, 0, .85, .08)); g.add(panel(1.84, 1.02, M.tv, 0, 1.39, .1, 0));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function receptionDesk(x, y, z, ry) {   // white statuario block with LED reveals (lobby render)
  const M = mats(), g = new THREE.Group();
  g.add(box(2.6, 1.05, .75, M.statuario, 0, .06, 0));
  g.add(box(2.62, .025, .77, M.led, 0, .72, 0));
  g.add(box(2.5, .06, .66, M.led, 0, 0, 0));
  g.add(box(2.6, .04, .8, M.statuario, 0, 1.11, -.02));
  g.add(box(.55, .38, .04, M.white, 0, 1.2, -.12)); g.add(box(.06, .1, .06, M.steel, 0, 1.15, -.12)); g.add(box(.2, .12, .12, M.steel, 0, 1.15, -.12));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function loungeTable(x, y, z, ry) {   // lobby: two-tier marble slabs on walnut blocks (render)
  const M = mats(), g = new THREE.Group();
  g.add(box(.18, .3, .18, M.walnut, -.35, 0, .1)); g.add(box(.18, .4, .18, M.walnut, .4, 0, -.15));
  g.add(rbox(1.3, .05, .7, .02, M.statuario, -.1, .3, .15)); g.add(rbox(1.0, .05, .6, .02, M.statuario, .35, .4, -.2));
  g.add(cyl(.09, .07, .22, M.potDark, .35, .45, -.2)); g.add(plantVase(.35, .45, -.2));
  g.add(box(.3, .05, .2, M.black, -.3, .35, .1)); g.add(box(.26, .05, .18, M.cream, -.3, .4, .1));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function mihrab(x, y, z, ry) {   // pointed arch niche with lit outlines and gold calligraphy (namaz render)
  const M = mats(), g = new THREE.Group();
  const arch = (w, h, peak) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h); s.quadraticCurveTo(-w / 2, h + peak * .6, 0, h + peak); s.quadraticCurveTo(w / 2, h + peak * .6, w / 2, h); s.lineTo(w / 2, 0); s.closePath(); return s; };
  const back = new THREE.Mesh(new THREE.ShapeGeometry(arch(2.3, 1.8, .9)), M.lattice); back.position.z = .002; g.add(back);
  for (const [w, h, p, dz] of [[1.95, 1.6, .8, .12], [1.5, 1.45, .7, .22]]) {
    const outer = arch(w + .18, h, p + .1), hole = arch(w, h - .02, p); outer.holes.push(hole);
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: .1, bevelEnabled: false }), M.cream); frame.position.z = dz - .1; g.add(frame);
    const glow = new THREE.Mesh(new THREE.ShapeGeometry((() => { const o = arch(w + .02, h, p + .02); o.holes.push(arch(w - .04, h, p - .02)); return o; })()), M.led); glow.position.z = dz + .002; g.add(glow);
  }
  const niche = new THREE.Mesh(new THREE.ShapeGeometry(arch(1.2, 1.35, .6)), new THREE.MeshStandardMaterial({ color: 0xf3e2bf, emissive: 0xffd28c, emissiveIntensity: .7 })); niche.position.z = .25; g.add(niche);
  g.add(box(.08, 1.35, .02, M.mirror, -.32, 0, .26)); g.add(box(.08, 1.35, .02, M.mirror, .32, 0, .26));
  g.add(box(1.4, .16, .02, M.gold, 0, 2.6, .02)); g.add(box(.6, .14, .02, M.gold, 0, 1.55, .27));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function exerciseBike(x, y, z, ry) {
  const M = mats(), g = new THREE.Group();
  g.add(rbox(.95, .06, .5, .02, M.gymWhite, 0, 0, 0));
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .95, 12), M.gymWhite); frame.position.set(-.05, .5, 0); frame.rotation.z = -.35; g.add(frame);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .09, 32), M.yellow); wheel.rotation.x = PI / 2; wheel.position.set(.25, .38, 0); g.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .12, 16), M.black); hub.rotation.x = PI / 2; hub.position.set(.25, .38, 0); g.add(hub);
  g.add(rbox(.3, .08, .24, .03, M.black, -.28, .92, 0));
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .6, 10), M.gymWhite); post.position.set(.32, .72, 0); g.add(post);
  g.add(box(.08, .05, .5, M.black, .36, 1.0, 0)); g.add(box(.14, .1, .04, M.black, .3, 1.05, 0));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function treadmill(x, y, z, ry) {
  const M = mats(), g = new THREE.Group();
  g.add(rbox(1.9, .22, .82, .04, M.black, 0, 0, 0));
  g.add(box(1.55, .02, .55, M.rubber, -.08, .22, 0));
  for (const dz of [.36, -.36]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.2, 10), M.steel); r.position.set(.78, .75, dz); r.rotation.z = .25; g.add(r); }
  g.add(rbox(.32, .34, .76, .04, M.black, .9, 1.22, 0));
  g.add(box(.02, .22, .34, new THREE.MeshStandardMaterial({ color: 0x223, emissive: 0x3366aa, emissiveIntensity: .8 }), .75, 1.3, 0));
  g.add(box(.05, .04, .8, M.steel, .72, 1.12, 0));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function legPress(x, y, z, ry) {
  const M = mats(), g = new THREE.Group();
  g.add(box(2.0, .1, .9, M.steel, 0, 0, 0));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1.6, .08, .6), M.steel); rail.position.set(.2, .55, 0); rail.rotation.z = .6; g.add(rail);
  g.add(rbox(.5, .1, .55, .03, M.black, -.55, .45, 0));
  const back = new THREE.Mesh(new RoundedBoxGeometry(.1, .6, .5, 3, .03), M.black); back.position.set(-.85, .75, 0); back.rotation.z = .5; g.add(back);
  g.add(box(.5, .6, .06, M.yellow, .7, .7, .34)); g.add(box(.5, .6, .06, M.yellow, .7, .7, -.34));
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}
function dumbbellRack(x, y, z, ry) {
  const M = mats(), g = new THREE.Group();
  for (const h of [.35, .7]) { g.add(box(1.4, .04, .08, M.black, 0, h, -.15)); g.add(box(1.4, .04, .08, M.black, 0, h, .15)); }
  g.add(box(.05, .75, .4, M.black, -.68, 0, 0)); g.add(box(.05, .75, .4, M.black, .68, 0, 0));
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { const s = .05 + i * .012, xx = -.55 + i * .27; for (const dz of [-.1, .1]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(s, s, .06, 14), M.black); d.rotation.z = PI / 2; d.position.set(xx + dz, .39 + r * .35, 0); g.add(d); } g.add(cyl(.012, .012, .14, M.steel, xx, .32 + r * .35, 0, 8).rotateZ(PI / 2)); }
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}
function bollard(x, y, z) { const M = mats(), g = new THREE.Group(); g.add(box(.12, .6, .12, M.black, x, y, z)); g.add(box(.1, .05, .1, M.led, x, y + .5, z)); return g; }
function planterBox(x, y, z, len, wid, ry = 0, n = 0) {   // dark stone planter with shrubs
  const M = mats(), g = new THREE.Group(), r = rng(Math.round(x * 37 + z * 7));
  g.add(box(len, .55, wid, M.potDark, 0, 0, 0)); g.add(box(len - .08, .02, wid - .08, M.rugDark, 0, .53, 0));
  const leaves = [];
  const k = n || Math.max(2, Math.round(len / .55));
  for (let i = 0; i < k; i++) { const cx = -len / 2 + len * (i + .5) / k; for (let j = 0; j < 6; j++) { const l = new THREE.IcosahedronGeometry(.08 + r() * .07, 2); l.scale(1, 1.3 + r() * .5, 1); l.translate(cx + (r() - .5) * .34, .62 + r() * .18, (r() - .5) * (wid - .25)); leaves.push(l); } }
  const m = new THREE.Mesh(mergeGeometries(leaves), M.leaf); m.castShadow = true; g.add(m);
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}
function poolLounger(x, y, z, ry) {
  const M = mats(), g = new THREE.Group();
  g.add(box(.68, .04, 1.3, M.rattan, 0, .3, .25));
  const back = new THREE.Mesh(new THREE.BoxGeometry(.68, .04, .7), M.rattan); back.position.set(0, .5, -.6); back.rotation.x = -.6; g.add(back);
  g.add(rbox(.6, .07, 1.2, .03, M.boucleDark, 0, .34, .25));
  const bc = new THREE.Mesh(new RoundedBoxGeometry(.6, .07, .62, 3, .03), M.boucleDark); bc.position.set(0, .55, -.58); bc.rotation.x = -.6; g.add(bc);
  for (const [dx, dz] of [[-.3, .8], [.3, .8], [-.3, -.2], [.3, -.2]]) g.add(box(.04, .3, .04, M.rattan, dx, 0, dz));
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}
function glassBalustrade(pts, y, h = 1.1) {
  const M = mats(), g = new THREE.Group();
  g.add(ribbon(pts, y + .08, y + h, M.glassBal));
  g.add(ribbon(pts, y + h - .04, y + h, M.steel));
  for (const p of resample(pts, 1.2)) g.add(cyl(.02, .02, h, M.steel, p.x, y, p.z, 8));
  return g;
}
function stair(x, y, z, w, rise, run, n, ry = 0) {   // open timber stair with a glass balustrade, climbing along +z
  const M = mats(), g = new THREE.Group();
  for (let i = 0; i < n; i++) { g.add(box(w, .06, run + .03, M.deck, 0, (i + 1) * rise - .06, i * run + run / 2)); g.add(box(w - .2, rise - .06, .04, M.darkPanel, 0, i * rise, i * run + .02)); }
  const stringer = new THREE.Mesh(new THREE.BoxGeometry(.06, .2, Math.hypot(n * rise, n * run)), M.darkPanel); stringer.position.set(0, n * rise / 2 - .15, n * run / 2); stringer.rotation.x = -Math.atan2(n * rise, n * run); g.add(stringer);
  const pts = []; for (let i = 0; i <= n; i++) pts.push({ x: w / 2 + .02, z: i * run, y: i * rise });
  const pos = [], idx = []; pts.forEach((p, i) => { pos.push(p.x, p.y + .05, p.z, p.x, p.y + 1.0, p.z); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setIndex(idx); bg.computeVertexNormals();
  g.add(new THREE.Mesh(bg, M.glassBal));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(.05, .04, Math.hypot(n * rise, n * run)), M.steel); rail.position.set(w / 2 + .02, n * rise / 2 + 1.0, n * run / 2); rail.rotation.x = -Math.atan2(n * rise, n * run); g.add(rail);
  g.position.set(x, y, z); g.rotation.y = ry; return g;
}

// ---------- the typical residence ----------
function residence(lib, y) {
  FLOOR_Y = y;
  const M = mats(), g = new THREE.Group();
  g.name = 'residence';
  const add = (...o) => o.forEach((m) => g.add(m));

  // floors: marble everywhere, oak in the bedrooms and wardrobes, stone in the baths, carpet in the namaz room
  const base = new THREE.Mesh(plateGeometry(0.3), M.marbleFloor); base.position.y = y + .005; base.receiveShadow = true; add(base);
  for (const [a, b, c, d] of [[40, 52, 165, 172], [165, 52, 220, 135], [220, 52, 330, 172], [797, 52, 907, 172], [770, 172, 907, 260]]) add(slab(X(a), Z(b), X(c), Z(d), y + .012, M.oakFloor));
  for (const [a, b, c, d] of [[40, 172, 168, 220], [742, 52, 797, 132], [692, 260, 745, 372]]) add(slab(X(a), Z(b), X(c), Z(d), y + .012, M.bathStone));
  add(slab(X(665), Z(52), X(742), Z(132), y + .014, M.carpet));
  add(slab(X(500), Z(52), X(585), Z(218), y + .012, M.statuario));

  // ceiling: plaster with a dropped timber-plank panel over the living and dining, cove LEDs and downlights
  const ceil = new THREE.Mesh(plateGeometry(0.3), M.ceiling); ceil.position.y = y + CEIL; add(ceil);
  const timber = (a, b, c, d) => { const s = slab(X(a), Z(b), X(c), Z(d), y + CEIL - .12, M.timberCeil); s.rotation.x = PI; add(s); for (const [x0, z0, x1, z1, ry] of [[a, b, c, b, 0], [a, d, c, d, 0], [a, b, a, d, PI / 2], [c, b, c, d, PI / 2]]) { const e = strip(ry ? D(d - b) : D(c - a), .12, M.ceilingDown, X((x0 + x1) / 2), y + CEIL - .06, Z((z0 + z1) / 2), ry); e.rotation.x = ry ? 0 : 0; e.geometry = new THREE.PlaneGeometry(ry ? D(d - b) : D(c - a), .12); e.rotation.set(0, ry ? PI / 2 : 0, 0); e.position.y = y + CEIL - .06; add(e); } };
  timber(350, 236, 700, 372); timber(225, 236, 345, 372); timber(45, 56, 160, 168); timber(802, 56, 902, 168);
  for (const [a, b, c, d] of [[350, 236, 700, 372], [225, 236, 345, 372], [45, 56, 160, 168], [802, 56, 902, 168], [232, 56, 326, 168], [775, 176, 902, 256]]) {
    add(strip(D(c - a), .04, M.led, X((a + c) / 2), y + CEIL - .13, Z(b) + .03)); add(strip(D(c - a), .04, M.led, X((a + c) / 2), y + CEIL - .13, Z(d) - .03));
    add(strip(.04, D(d - b), M.led, X(a) + .03, y + CEIL - .13, Z((b + d) / 2))); add(strip(.04, D(d - b), M.led, X(c) - .03, y + CEIL - .13, Z((b + d) / 2)));
  }
  const dl = [];
  for (let px = 70; px < 900; px += 55) for (let pz = 80; pz < 360; pz += 55) dl.push([X(px), y + CEIL - .01, Z(pz)]);
  add(dots(dl.filter(([x, , z]) => Math.abs(x - 16.5) > 2.6 || z > 7.8), .06, .02, M.downlight));

  // partition walls from the plan (with door gaps) and open door leaves
  const W = [
    [165, 50, 165, 100], [165, 135, 220, 135], [40, 172, 168, 172], [168, 172, 168, 220], [40, 220, 168, 220], [220, 50, 220, 140],
    [255, 172, 330, 172], [330, 50, 330, 172], [330, 172, 500, 172], [500, 115, 500, 218], [500, 218, 520, 218], [560, 218, 665, 218],
    [585, 50, 585, 218], [665, 50, 665, 218], [665, 132, 690, 132], [715, 132, 742, 132], [742, 50, 742, 132], [742, 132, 797, 132],
    [797, 50, 797, 140], [702, 172, 740, 172], [770, 172, 907, 172], [702, 172, 702, 225],
    [692, 260, 692, 300], [692, 330, 692, 372], [692, 260, 745, 260], [745, 260, 745, 372],
  ];
  for (const w of W) add(wallPx(...w, y, M.wall));
  add(doorLeaf(220, 172, y, PI / 2, -1.1), doorLeaf(740, 172, y, PI / 2, 1.2), doorLeaf(797, 140, y, 0, -1.0));
  // north wall and end walls with windows (sill 0.9, head 2.2)
  const wins = [[60, 150], [235, 305], [440, 500], [515, 575], [675, 735], [815, 890]];
  let x0 = 35;
  for (const [w0, w1] of wins) { add(wallPx(x0, 50, w0, 50, y, M.wall)); add(wallPx(w0, 50, w1, 50, y, M.wall, .9)); add(wallPx(w0, 50, w1, 50, y + 2.2, M.wall, WALL_H - 2.2)); add(box(D(w1 - w0), 1.3, .02, M.glass, X((w0 + w1) / 2), y + .9, Z(50))); x0 = w1; }
  add(wallPx(x0, 50, 907, 50, y, M.wall));
  for (const [w0, w1] of wins) { add(box(.04, 1.3, .05, M.bronze, X(w0), y + .9, Z(50))); add(box(.04, 1.3, .05, M.bronze, X(w1), y + .9, Z(50))); add(box(D(w1 - w0), .04, .05, M.bronze, X((w0 + w1) / 2), y + .9, Z(50))); add(box(D(w1 - w0), .04, .05, M.bronze, X((w0 + w1) / 2), y + 2.18, Z(50))); }
  for (const px of [35, 907]) { add(wallPx(px, 50, px, 80, y, M.wall)); add(wallPx(px, 160, px, 186, y, M.wall)); add(wallPx(px, 80, px, 160, y, M.wall, .9)); add(wallPx(px, 80, px, 160, y + 2.2, M.wall, .6)); add(box(.02, 1.3, D(80), M.glass, X(px), y + .9, Z(120))); add(box(.05, .04, D(80), M.bronze, X(px), y + .9, Z(120))); add(box(.05, .04, D(80), M.bronze, X(px), y + 2.18, Z(120))); }

  // the curved and flat south glass: full-height glazing with bronze mullions, sheers at the bedroom bays
  const gl = southGlassPts(0.42);
  add(ribbon(gl, y, y + CEIL, M.glass));
  const mull = resample(gl, 1.35).map((p) => { const b = new THREE.BoxGeometry(.06, CEIL, .1); b.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(p.nx, p.nz)).setPosition(p.x, y + CEIL / 2, p.z)); return b; });
  const mm = new THREE.Mesh(mergeGeometries(mull), M.frame); mm.castShadow = true; add(mm);
  add(ribbon(gl.map((p) => ({ ...p, x: p.x - p.nx * .03, z: p.z - p.nz * .03 })), y, y + .08, M.frame));
  add(ribbon(gl.map((p) => ({ ...p, x: p.x - p.nx * .03, z: p.z - p.nz * .03 })), y + CEIL - .1, y + CEIL, M.frame));
  // sheers along the living glass, drapes at the bedroom bays
  const sw = OUTLINE.find((f) => f.id === 'SW').pts, se = OUTLINE.find((f) => f.id === 'SE').pts, sf = OUTLINE.find((f) => f.id === 'S').pts;
  const sheerAlong = (pts, inset, step) => resample(pts.map((p) => ({ x: p.x - p.nx * inset, z: p.z - p.nz * inset })), step).forEach((p, i, a) => { if (i) add(curtain(a[i - 1].x, a[i - 1].z, p.x, p.z, y, { drape: false })); });
  sheerAlong(sf, .6, 1.4);
  sheerAlong(se.filter((p) => p.z > Z(236)), .6, 1.0);

  // ---- living (U sofa on a rug, marble drum tables, crystal chandelier, slatted TV wall) ----
  add(uSofa(X(434), y, Z(262), 0));
  add(fit(lib, 'coffee_table_round_01', { x: X(428), z: Z(302), y, w: 1.1, d: 1.1, h: .4 }));
  add(fit(lib, 'coffee_table_round_01', { x: X(454), z: Z(292), y, w: .7, d: .7, h: .5 }));
  add(slab(X(368), Z(248), X(500), Z(348), y + .018, M.rugGrey));
  add(chandelierCrystal(X(434), y + CEIL - .12, Z(292), 2.8, 1.1));
  add(tvWall(X(440), y, Z(178), 4.2, 0));
  add(fit(lib, 'modern_wooden_cabinet', { x: X(440), z: Z(186), y, w: 2.4, d: .48, h: .6, face: FACE.S }));
  add(fit(lib, 'modern_arm_chair_01', { x: X(515), z: Z(300), y, w: .85, h: 1.0, d: 1.0, face: FACE.W, keep: true }));
  add(plant(lib, X(548), y, Z(348), 'tree', 1.1), plant(lib, X(362), y, Z(355), 'big'));
  add(fit(lib, 'modern_ceiling_lamp_01', { x: X(360), z: Z(355), y: y + CEIL - 1.5, h: 1.2, keep: true }));
  // second lounge by the east bay (brochure plan: sofa, armchair, glass table)
  add(sofa(2.4, .95, { seats: 3 }).translateX(X(642)).translateY(y).translateZ(Z(340)).rotateY(PI));
  add(fit(lib, 'mid_century_lounge_chair', { x: X(680), z: Z(300), y, h: 1.0, keep: true, face: FACE.W - .4 }));
  add(fit(lib, 'modern_coffee_table_01', { x: X(636), z: Z(298), y, w: 1.1, d: .6, h: .4, face: FACE.E }));
  add(slab(X(590), Z(262), X(690), Z(360), y + .018, M.rugGrey));
  add(plant(lib, X(700), y, Z(252), 'big', .9));

  // ---- dining: marble table for eight, upholstered chairs, ring pendant, lit display unit ----
  add(diningTable(X(286), y, Z(292), 2.8, 1.05, 0));
  for (const [i, dz] of [-1.0, -.34, .34, 1.0].entries()) {
    const mat = i % 2 ? M.velvetMaroon : M.velvetBeige;
    add(fit(lib, 'dining_chair_02', { x: X(286) - .82, z: Z(292) + dz, y, h: .95, keep: true, face: FACE.E, tint: { '*': { color: i % 2 ? '#7a3a40' : '#d9c7ad', noMap: true, rough: .9 } } }));
    add(fit(lib, 'dining_chair_02', { x: X(286) + .82, z: Z(292) + dz, y, h: .95, keep: true, face: FACE.W, tint: { '*': { color: i % 2 ? '#d9c7ad' : '#7a3a40', noMap: true, rough: .9 } } }));
    void mat;
  }
  add(ringPendants(X(286), y + CEIL - .12, Z(292), [[0, -.35, .34, .8], [0, .25, .25, .95], [0, .65, .18, 1.0]]));
  add(displayCabinet(X(224), y, Z(300), 1.9, PI / 2));

  // ---- kitchen: gloss white base units on a curve along the glass, stone worktop, hob, sink, washer, jali screens ----
  const arc = OUTLINE.find((f) => f.id === 'SW').pts;
  const runPts = resample(arc.map((p) => ({ x: p.x - p.nx * 0.78, z: p.z - p.nz * 0.78, nx: p.nx, nz: p.nz })), .6).filter((p) => p.x < X(196) && p.z > Z(228));
  add(ribbon(runPts.map((p) => ({ ...p, x: p.x + p.nx * .02, z: p.z + p.nz * .02 })), y, y + .1, M.black));                    // plinth
  runPts.forEach((p, i) => {
    if (i === runPts.length - 1) return;
    const q = runPts[i + 1], mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, nx = (p.nx + q.nx) / 2, nz = (p.nz + q.nz) / 2, len = Math.hypot(q.x - p.x, q.z - p.z);
    const door = rbox(len - .025, .78, .02, .006, M.white, 0, 0, 0); door.position.set(mx - nx * .3, y + .1 + .39, mz - nz * .3); door.rotation.y = Math.atan2(-nx, -nz); add(door);
    add(box(len - .4, .012, .012, M.steel, mx - nx * .31, y + .54, mz - nz * .31, Math.atan2(nx, nz)));
  });
  add(ribbon(runPts.map((p) => ({ ...p, x: p.x - p.nx * .27, z: p.z - p.nz * .27 })), y + .1, y + .88, M.whiteDS));           // carcass behind the doors
  add(ribbon(runPts.map((p) => ({ ...p, x: p.x + p.nx * .34, z: p.z + p.nz * .34 })), y + .1, y + .88, M.whiteDS));
  const top = (off, y0, y1) => ribbon(runPts.map((p) => ({ ...p, x: p.x - p.nx * off, z: p.z - p.nz * off })), y0, y1, M.counter, 1);
  add(top(-.36, y + .88, y + .93), top(.36, y + .88, y + .93));
  const ctop = (() => { const pos = [], idx = [], uv = []; runPts.forEach((p, i) => { pos.push(p.x - p.nx * .36, y + .93, p.z - p.nz * .36, p.x + p.nx * .36, y + .93, p.z + p.nz * .36); uv.push(i * .6, 0, i * .6, .72); if (i) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }); const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals(); const m = new THREE.Mesh(gg, M.counter); m.receiveShadow = true; return m; })();
  add(ctop);
  const at = (t) => runPts[Math.min(runPts.length - 1, Math.floor(t * (runPts.length - 1)))];
  { const p = at(.62); const hob = box(.75, .012, .5, M.black, p.x, y + .93, p.z, Math.atan2(p.nx, p.nz)); add(hob); for (const [dx, dz] of [[-.2, -.12], [.2, -.12], [-.2, .14], [.2, .14]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.07, .008, 6, 24), M.steel); ring.rotation.x = PI / 2; ring.position.set(p.x + dx, y + .95, p.z + dz); add(ring); } }
  { const p = at(.35); add(box(.7, .02, .45, M.steel, p.x, y + .925, p.z, Math.atan2(p.nx, p.nz))); add(box(.6, .14, .36, M.black, p.x, y + .78, p.z, Math.atan2(p.nx, p.nz))); const tap = new THREE.Mesh(new THREE.TorusGeometry(.14, .012, 8, 24, PI), M.steel); tap.position.set(p.x - p.nx * .22, y + 1.08, p.z - p.nz * .22); tap.rotation.y = Math.atan2(p.nx, p.nz); add(tap); add(cyl(.014, .014, .28, M.steel, p.x - p.nx * .3, y + .93, p.z - p.nz * .3, 10)); }
  { const e = runPts[runPts.length - 1]; add(fit(lib, 'washer', { x: e.x + .68, z: e.z + .05, y, w: .62, d: .62, h: .86, face: Math.atan2(-e.nx, -e.nz), tint: { metalLight: '#f2f2f0', metal: '#2a2a2a', metalDark: '#3a3a3a' } })); }
  for (const p of [at(.1), at(.8)]) add(box(.08, .02, .08, M.pot, p.x, y + .93, p.z), plant(lib, p.x, y + .93, p.z, 'small', 1));
  // tall gloss units and the fridge along the kitchen's east wall, uppers with an LED reveal along the north wall
  add(box(.6, 2.4, D(118), M.white, X(203) - .3, y, Z(312)));
  for (let i = 0; i < 4; i++) add(box(.012, 2.3, .02, M.steel, X(203) - .61, y + .05, Z(262) + i * .8));
  add(fit(lib, 'kitchenFridgeBuiltIn', { x: X(150), z: Z(232), y, w: .9, d: .65, h: 2.1, face: FACE.S, tint: { metalLight: '#f2f2f0', wood: '#f3f2ef', woodDark: '#e6e4e0' } }));
  add(box(D(110), .7, .35, M.white, X(95), y + 1.55, Z(221) + .18)); add(box(D(110), .02, .02, M.led, X(95), y + 1.53, Z(221) + .36));
  add(box(D(110), .04, .6, M.counter, X(95), y + .88, Z(221) + .3)); add(box(D(110), .78, .58, M.white, X(95), y + .1, Z(221) + .3));
  add(fit(lib, 'kitchenCoffeeMachine', { x: X(60), z: Z(240), y: y + .92, w: .32, d: .36, h: .4, face: FACE.S }));
  for (const t of [.06, .94]) { const p = arc[Math.floor(t * (arc.length - 1))]; add(panel(.8, CEIL - .1, M.jali, p.x - p.nx * .55, y + CEIL / 2, p.z - p.nz * .55, Math.atan2(p.nx, p.nz))); }

  // ---- bedrooms: platform bed, tub chairs at the window, panelled wall art, shade chandelier, wardrobes ----
  const bedroom = (bx, bz, faceS, chairs, wardrobe) => {
    const ry = faceS ? 0 : PI, back = faceS ? -1 : 1;
    add(bed(X(bx), y, Z(bz), ry));
    const hz = Z(bz) + back * 1.05;
    for (const s of [-1.25, 1.25]) { add(nightstand(X(bx) + s, y, hz - back * .32, ry)); add(tableLamp(X(bx) + s, y + .45, hz - back * .32)); }
    for (const s of [-.3, .3]) add(panel(1.0, 2.2, M.panelArt, X(bx) + s * 5.2, y + 1.4, hz + back * .2, faceS ? 0 : PI), box(1.04, 2.24, .02, M.oak, X(bx) + s * 5.2, y + .28, hz + back * .22));
    add(panel(1.0, 2.2, M.panelArt, X(bx) + 3.2, y + 1.4, hz + back * .2, faceS ? 0 : PI));
    add(slab(X(bx) - 1.6, Z(bz) - back * .2 - 1.3, X(bx) + 1.6, Z(bz) - back * .2 + 1.3, y + .016, M.rugGrey));
    add(fit(lib, 'Chandelier_01', { x: X(bx), z: Z(bz) - back * .2, y: y + CEIL - .8, w: .95, d: .95, h: .68 }));
    add(pendant(X(bx) - 1.25, y + CEIL - .1, hz - back * .32, 1.15));
    for (const [cx, cz, cf] of chairs || []) add(tubChair(X(cx), y, Z(cz), cf, M.velvetBeige));
    if (wardrobe) { const [wx, wz, ww, wf] = wardrobe; const wg = new THREE.Group(); wg.add(box(ww, 2.4, .6, M.oak, 0, 0, 0)); for (let i = 1; i < Math.ceil(ww / .5); i++) wg.add(box(.006, 2.3, .01, M.walnut, -ww / 2 + .5 * i, .05, .3)); for (let i = 0; i < Math.ceil(ww / .5); i++) wg.add(box(.015, 1.2, .02, M.brass, -ww / 2 + .5 * i + .44, .6, .31)); wg.position.set(X(wx), y, Z(wz)); wg.rotation.y = wf; add(wg); }
  };
  bedroom(111, 90, true, [[56, 84, FACE.E + .35], [56, 134, FACE.E - .35]], [192, 60, 1.8, 0]);
  add(cyl(.2, .2, .5, M.statuario, X(50), y, Z(109)));
  add(curtain(X(40), Z(60), X(40), Z(165), y, {}));
  add(fit(lib, 'desk', { x: X(72), z: Z(164), y, w: 1.3, d: .5, h: .75, face: FACE.N, tint: { wood: '#b48d64' } }), fit(lib, 'books', { x: X(60), z: Z(166), y: y + .75, w: .3, d: .2, h: .18 }), tableLamp(X(90), y + .75, Z(166)));
  bedroom(284, 138, true, [], [232, 80, 1.2, PI / 2]);
  add(curtain(X(240), Z(52), X(300), Z(52), y, {}));
  bedroom(852, 136, false, [], [812, 62, 1.1, 0]);
  add(curtain(X(818), Z(52), X(888), Z(52), y, {}));
  bedroom(802, 210, true, [[770, 296, FACE.N - .6], [756, 330, FACE.N - 1.1]], [713, 198, 1.3, PI / 2]);
  add(cyl(.2, .2, .5, M.statuario, X(750), y, Z(310)));
  for (const [w0, w1] of wins) if (w0 > 50 && w0 < 320 || w0 > 800) add(curtain(X(w0) - .3, Z(52), X(w1) + .3, Z(52), y, { sheer: true, drape: false, h: 2.6 }));

  // ---- baths ----
  const bath = (tx, tz, tf, sx, sz, sf, shx, shz, mir) => {
    add(fit(lib, 'toilet', { x: X(tx), z: Z(tz), y, w: .4, d: .65, h: .75, face: tf, tint: { metalLight: '#f6f6f4' } }));
    add(fit(lib, 'bathroomSink', { x: X(sx), z: Z(sz), y, w: .8, d: .5, h: .9, face: sf, tint: { wood: '#3a3532', metalLight: '#f6f6f4' } }));
    if (mir) add(fit(lib, 'bathroomMirror', { x: X(mir[0]), z: Z(mir[1]), y: y + 1.1, w: .7, d: .05, h: .8, face: sf }));
    if (shx) add(fit(lib, 'shower', { x: X(shx), z: Z(shz), y, w: .9, d: .9, h: 2.1, tint: { metalLight: '#f6f6f4' } }));
  };
  bath(60, 185, FACE.S, 105, 214, FACE.N, 148, 196, [105, 218]);
  bath(770, 64, FACE.S, 770, 120, FACE.N, null, null, [770, 128]);
  bath(718, 356, FACE.N, 728, 272, FACE.S, 718, 300, [728, 264]);
  add(fit(lib, 'bathtub', { x: X(110), z: Z(195), y, w: 1.6, d: .75, h: .55, face: FACE.S, tint: { metalLight: '#f6f6f4' } }));
  for (const [a, b, c, d] of [[40, 172, 168, 220], [742, 52, 797, 132], [692, 260, 745, 372]]) { for (const [wx0, wz0, wx1, wz1] of [[a, b, c, b], [a, d, c, d], [a, b, a, d], [c, b, c, d]]) { const m = wallPx(wx0, wz0, wx1, wz1, y, M.bathStone, 2.2); m.scale.set(.985, 1, .985); m.position.y = y + 1.1; add(m); } }

  // ---- namaz room: mihrab on the west wall (towards the qibla), lattice walls, prayer rugs, drapes ----
  add(mihrab(X(666) + .08, y, Z(92), PI / 2));
  add(panel(D(77), 2.6, M.lattice, X(703), y + 1.35, Z(52) + .08, 0));
  add(panel(D(80), 2.6, M.lattice, X(741) - .08, y + 1.35, Z(92), -PI / 2));
  add(curtain(X(742) - .08, Z(60), X(742) - .08, Z(125), y, {}));
  for (let i = 0; i < 2; i++) add(box(.7, .012, 1.15, new THREE.MeshStandardMaterial({ color: i ? 0x7a2f2f : 0x2f4f6a, roughness: 1 }), X(690) + i * .85, y + .016, Z(100)));

  // ---- lift lobby: statuario floor, bronze lift portals, console ----
  for (const lz of [4.4, 6.6]) { add(box(.1, 2.3, 1.3, M.bronze, X(585) + .05, y, lz)); add(box(.02, 2.2, 1.0, M.steel, X(585) + .1, y, lz)); add(box(.02, .02, 1.3, M.led, X(585) + .12, y + 2.28, lz)); }
  add(box(1.2, .8, .35, M.walnut, X(540), y, Z(60) + .2)); add(plant(lib, X(520), y + .8, Z(62), 'small', 1.2));

  // lights the stage switches on while this floor is shown inside
  g.userData.lights = [[X(434), Z(292)], [X(286), Z(292)], [X(110), Z(290)], [X(111), Z(110)], [X(802), Z(250)], [X(852), Z(110)], [X(640), Z(300)], [X(703), Z(92)]];
  return g;
}

// ---------- ground floor: entrance lobby ----------
function lobby(lib, y) {
  FLOOR_Y = y;
  const M = mats(), g = new THREE.Group();
  const add = (...o) => o.forEach((m) => g.add(m));
  const x0 = 12.7, x1 = 21.6, z0 = 7.75, z1 = 11.6;
  add(slab(x0, z0, x1, z1 + .4, y + .01, M.lobbyFloor));
  add(slab(14.6, 3.35, 16.85, z0, y + .01, M.lobbyFloor));
  const ceil = slab(x0, z0, x1, z1 + .4, y + CEIL + .3, M.ceiling); ceil.rotation.x = PI; add(ceil);
  // dropped ceiling tray with a cove, downlights
  add(box(x1 - x0 - 1.2, .12, z1 - z0 - .8, M.ceilingDown, (x0 + x1) / 2, y + CEIL + .18, (z0 + z1) / 2));
  for (const [sx, sz, ex, ez] of [[x0 + .6, z0 + .4, x1 - .6, z0 + .4], [x0 + .6, z1 - .4, x1 - .6, z1 - .4]]) add(box(ex - sx, .02, .03, M.led, (sx + ex) / 2, y + CEIL + .2, sz));
  const dl = []; for (let x = x0 + 1; x < x1; x += 1.4) for (let z = z0 + 1; z < z1; z += 1.4) dl.push([x, y + CEIL + .29, z]); add(dots(dl, .06, .02, M.downlight));
  // stone-and-brass feature wall behind the desk (core side), plain walls either side, lift portals
  add(box(x1 - x0, CEIL + .3, .1, M.stoneWall, (x0 + x1) / 2, y, z0));
  for (let i = 0; i < 7; i++) add(box(.04, CEIL + .2, .03, M.brass, x0 + 1.0 + i * 1.25, y, z0 + .07));
  for (let i = 0; i < 3; i++) add(box(.02, CEIL + .2, .02, M.led, x0 + 1.62 + i * 1.25, y, z0 + .08));
  add(box(.12, CEIL + .3, z1 - z0 + .4, M.wallWarm, x0, y, (z0 + z1 + .4) / 2));
  add(box(.12, CEIL + .3, z1 - z0 + .4, M.wall, x1, y, (z0 + z1 + .4) / 2));
  for (const lz of [4.4, 6.6]) { add(box(.1, 2.3, 1.3, M.bronze, 16.85, y, lz)); add(box(.02, 2.2, 1.0, M.steel, 16.8, y, lz)); add(box(.02, .02, 1.3, M.led, 16.78, y + 2.28, lz)); }
  add(box(.04, 2.6, .04, M.led, x0 + .1, y + .1, z0 + .5));
  add(receptionDesk(15.2, y, 8.8, 0));
  add(fit(lib, 'chairDesk', { x: 15.2, z: 8.2, y, w: .6, d: .6, h: 1.0, face: FACE.S, tint: { metal: '#2a2523', carpet: '#3a3532' } }));
  add(ringPendants(17.6, y + CEIL + .3, 9.4, [[0, 0, .8, .9], [-.7, -.35, .5, 1.25], [-.2, .45, .35, 1.5]]));
  add(linearPendant(14.6, y + CEIL + .3, 8.3, 1.2, 1.4, 0), linearPendant(15.9, y + CEIL + .3, 8.1, 1.0, 1.7, 0));
  // lounge by the art wall
  const s = sofa(2.7, 1.0, { seats: 3 }); s.rotation.y = -PI / 2; s.position.set(x1 - .6, y, 10.0); add(s);
  add(cushion(x1 - .6, y + .48, 9.3, .45, .45, M.velvetGrey, -PI / 2), cushion(x1 - .62, y + .48, 10.0, .45, .45, M.boucleDark, -PI / 2 + .1), cushion(x1 - .6, y + .48, 10.7, .42, .42, M.velvetBeige, -PI / 2));
  add(loungeTable(19.3, y, 10.0, .3));
  add(fit(lib, 'modern_arm_chair_01', { x: 19.4, z: 8.4, y, h: 1.0, keep: true, face: FACE.S + .3 }));
  add(slab(18.3, 8.6, 20.9, 11.5, y + .018, M.rugGrey));
  for (const [i, dz] of [[0, -1.0], [1, 0], [2, 1.0]]) { const a = panel(.85, 1.15, M.art, x1 - .08, y + 1.75, 10.1 + dz, -PI / 2); a.material = M.art.clone(); a.material.map = M.art.map.clone(); a.material.map.needsUpdate = true; a.material.map.offset.x = i / 3; a.material.map.repeat.x = 1 / 3; add(a); add(box(.04, 1.21, .91, M.walnut, x1 - .05, y + 1.17, 10.1 + dz)); }
  add(plant(lib, 13.3, y, 8.4, 'tree', 1.1), plant(lib, 21.0, y, 8.2, 'big'), plant(lib, 13.4, y, 11.2, 'big', .9));
  g.userData.lights = [[17.2, 9.5], [15.6, 8.8], [20, 10.2], [14, 10.5]];
  return g;
}

// ---------- 3rd floor: fitness centre ----------
function gym(lib, y) {
  FLOOR_Y = y;
  const M = mats(), g = new THREE.Group();
  const add = (...o) => o.forEach((m) => g.add(m));
  const base = new THREE.Mesh(plateGeometry(0.3), M.oakFloor); base.position.y = y + .006; add(base);
  add(slab(X(230), Z(280), X(560), Z(360), y + .012, M.rubber));
  const ceil = new THREE.Mesh(plateGeometry(0.3), M.ceilingDark); ceil.position.y = y + CEIL; add(ceil);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { const cx = 6 + i * 3.3, cz = 8.0 + j * 2.4; add(box(2.4, .16, 1.9, M.darkPanel, cx, y + CEIL - .16, cz)); add(strip(2.4, .05, M.led, cx, y + CEIL - .17, cz - .92), strip(2.4, .05, M.led, cx, y + CEIL - .17, cz + .92), strip(.05, 1.9, M.led, cx - 1.17, y + CEIL - .17, cz), strip(.05, 1.9, M.led, cx + 1.17, y + CEIL - .17, cz)); add(dots([[cx, y + CEIL - .17, cz]], .07, 0, M.downlight)); }
  // brick feature walls along the core and the north side, mirror wall at the east end, poster
  add(wallPx(220, 172, 500, 172, y, M.brick)); add(wallPx(35, 50, 907, 50, y, M.brick));
  add(box(.06, 2.5, 4.0, M.mirror, X(700), y + .1, Z(300))); add(box(.15, CEIL, 4.4, M.wall, X(700) + .1, y, Z(300)));
  add(panel(1.0, 1.5, M.poster, X(360), y + 1.6, Z(172) + .1, 0)); add(box(.02, .02, 1.6, M.led, X(300), y + .6, Z(172) + .09).rotateZ(PI / 2));
  for (const px of [500, 640]) add(box(.03, 2.2, .03, M.led, X(px), y + .2, Z(172) + .1));
  // glazing
  const gl = southGlassPts(0.42); add(ribbon(gl, y, y + CEIL, M.glass));
  const mm = new THREE.Mesh(mergeGeometries(resample(gl, 1.6).map((p) => { const b = new THREE.BoxGeometry(.08, CEIL, .1); b.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(p.nx, p.nz)).setPosition(p.x, y + CEIL / 2, p.z)); return b; })), M.frame); mm.castShadow = true; add(mm);
  // bikes along the glass, treadmills behind, leg press, weights, balls, lockers, bench, water cooler, TV
  for (let i = 0; i < 4; i++) add(exerciseBike(X(250) + i * 1.25, y, Z(338), .15));
  for (let i = 0; i < 4; i++) add(treadmill(X(420) + i * 1.05, y, Z(320), PI / 2));
  add(legPress(X(360), y, Z(300), 0));
  add(dumbbellRack(X(650), y, Z(240), 0), dumbbellRack(X(560), y, Z(200), PI / 2));
  const ball = (c, r, x, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), new THREE.MeshStandardMaterial({ color: c, roughness: .4 })); m.position.set(x, y + r, z); m.castShadow = true; return m; };
  add(ball(0x9fe04a, .32, X(600), Z(300)), ball(0x2b47c9, .28, X(585), Z(312)), ball(0xd23a2a, .18, X(575), Z(292)));
  for (let i = 0; i < 4; i++) { add(box(.5, 2.0, .5, M.blueLocker, X(660) + i * .52, y, Z(200))); add(box(.02, .14, .02, M.steel, X(660) + i * .52 + .18, y + 1.2, Z(200) + .26)); }
  add(rbox(1.4, .08, .4, .03, M.black, X(620), y + .4, Z(240))); for (const dx of [-.6, .6]) add(box(.06, .4, .36, M.steel, X(620) + dx, y, Z(240)));
  add(box(.35, 1.2, .35, M.gymWhite, X(680), y, Z(330)), cyl(.14, .14, .4, M.glassBal, X(680), y + 1.2, Z(330)));
  add(box(1.6, .95, .04, M.black, X(430), y + 1.4, Z(172) + .1), panel(1.5, .85, M.tv, X(430), y + 1.88, Z(172) + .13, 0));
  add(plant(lib, X(240), y, Z(200), 'tree'), plant(lib, X(690), y, Z(360), 'big'));
  g.userData.lights = [[X(300), Z(300)], [X(470), Z(300)], [X(630), Z(280)], [X(380), Z(220)]];
  return g;
}

// ---------- rooftop: pavers, pool deck under its pergola, café with a roof deck, sit-outs ----------
function terrace(lib, y, slabTop) {
  FLOOR_Y = y;
  const M = mats(), g = new THREE.Group();
  const add = (...o) => o.forEach((m) => g.add(m));
  const top = slabTop ?? y;                         // top of the terrace slab (the pool basin rises 0.5 m above it)
  const pav = new THREE.Mesh(plateGeometry(0.5), M.pavers); pav.position.y = y + .02; pav.receiveShadow = true; add(pav);
  // the rooftop core: dark timber cladding on its south face with the lit logo and "COFFEE" sign (café render)
  const cx0 = 8.58, cx1 = 19.64, cz0 = 3.12, cz1 = 8.31, CH = 4.5;
  add(box(cx1 - cx0 + .06, CH, .14, M.darkPanel, (cx0 + cx1) / 2, y, cz1 + .02));
  for (let i = 0; i < Math.floor((cx1 - cx0) / .14); i++) add(box(.06, CH - .1, .04, M.slats, cx0 + .1 + i * .14, y + .05, cz1 + .11));
  add(box(.14, CH, cz1 - cz0, M.darkPanel, cx1 + .02, y, (cz0 + cz1) / 2), box(.14, CH, cz1 - cz0, M.darkPanel, cx0 - .02, y, (cz0 + cz1) / 2));
  // ---- café: counter with an LED reveal, back bar, canopy roof with a deck on top and a stair up (café render) ----
  const cx = 12.4, cz = cz1 + .1;
  add(box(3.8, 1.05, .62, M.walnut, cx, y, cz + 1.25)); add(box(3.82, .05, .66, M.black, cx, y + 1.05, cz + 1.25)); add(box(3.8, .03, .03, M.led, cx, y + .98, cz + 1.57)); add(box(3.6, .02, .5, M.led, cx, y + .02, cz + 1.25));
  for (let i = 0; i < 3; i++) { add(box(3.2, .03, .3, M.walnut, cx, y + 1.4 + i * .4, cz + .16)); add(box(3.1, .012, .02, M.led, cx, y + 1.39 + i * .4, cz + .3)); }
  for (let i = 0; i < 9; i++) { add(cyl(.04, .035, .16 + (i % 3) * .04, M.glassBal, cx - 1.4 + i * .35, y + 1.43 + (i % 2) * .4, cz + .16)); }
  add(fit(lib, 'kitchenCoffeeMachine', { x: cx + 1.1, z: cz + 1.0, y: y + 1.1, w: .5, d: .4, h: .45, face: FACE.S, tint: { metal: '#2a2a2a', metalLight: '#d8d8d6' } }));
  add(box(.9, .4, .45, M.glassBal, cx - .9, y + 1.1, cz + 1.05), box(.86, .02, .4, M.steel, cx - .9, y + 1.3, cz + 1.05));
  add(panel(.7, 1.3, M.menu, cx - 1.5, y + 2.0, cz + .32, 0));
  add(panel(1.6, .4, M.signText, cx, y + 3.9, cz + .13, 0));
  for (let i = 0; i < 4; i++) add(fit(lib, 'bar_chair_round_01', { x: cx - 1.3 + i * .85, z: cz + 2.05, y, h: .78, keep: true }));
  // canopy roof: dark slab on a white fascia, LED edge, held on two slender posts; its top is a timber deck with a glass balustrade and planters
  const RY = 3.25, rx0 = cx0 + .5, rx1 = 14.8, rz1 = cz1 + 2.7;
  add(box(rx1 - rx0, .18, rz1 - cz1, M.darkPanel, (rx0 + rx1) / 2, y + RY, (cz1 + rz1) / 2));
  add(box(rx1 - rx0 + .1, .1, rz1 - cz1 + .1, M.cream, (rx0 + rx1) / 2, y + RY + .18, (cz1 + rz1) / 2));
  add(box(rx1 - rx0, .03, .03, M.led, (rx0 + rx1) / 2, y + RY - .01, rz1 - .02));
  add(slab(rx0 + .1, cz1 + .1, rx1 - .1, rz1 - .1, y + RY + .29, M.deck));
  add(box(rx1 - rx0, .45, .3, M.darkPanel, (rx0 + rx1) / 2, y + RY - .3, cz1 + .2));   // edge beam on the core: the roof cantilevers from it
  const deckEdge = [{ x: rx0, z: cz1 + .05 }, { x: rx0, z: rz1 }, { x: rx1, z: rz1 }, { x: rx1, z: cz1 + .05 }];
  add(glassBalustrade(deckEdge, y + RY + .28));
  add(planterBox(rx0 + 1.2, y + RY + .28, rz1 - .45, 1.6, .45), planterBox(rx1 - 1.5, y + RY + .28, rz1 - .45, 1.6, .45));
  add(stair(rx1 + .55, y, rz1 + .55, .95, RY / 13, .25, 13, PI));   // climbs north to the deck's east corner
  add(planterBox(rx1 + .55, y + .02, rz1 + 1.0, .95, .4));
  // ---- pool deck (east curve): timber deck raised to the pool coping, loungers, side tables, planting ----
  const DY = top + .5;
  add(box(4.4, DY - y - .02, 3.0, M.darkPanel, 18.4, y + .02, 10.1)); add(slab(16.2, 8.6, 20.6, 11.6, DY + .02, M.deck));
  add(box(4.4, .12, .35, M.deck, 18.4, DY - .14, 11.75)); add(box(4.4, .12, .35, M.deck, 18.4, DY - .38, 12.05));
  for (let i = 0; i < 2; i++) add(poolLounger(17.4, DY + .02, 9.4 + i * 1.3, FACE.E));
  add(box(.4, .4, .4, M.rattan, 16.7, DY + .02, 9.4), box(.4, .4, .4, M.rattan, 16.7, DY + .02, 10.9));
  add(plant(lib, 20.0, DY + .02, 11.1, 'big'), plant(lib, 16.6, DY + .02, 8.9, 'tree', .9), plant(lib, 19.6, DY + .02, 8.9, 'big', .8));
  for (const [px, pz] of [[21.0, 8.6], [20.9, 10.2]]) { add(cyl(.02, .02, .9, M.steel, px, DY, pz, 8)); const h = new THREE.Mesh(new THREE.TorusGeometry(.25, .02, 8, 24, PI), M.steel); h.position.set(px + .25, DY + .9, pz); add(h); }
  // pool pergola: louvred canopy on a white fascia, cantilevered from the core's south face over the pool deck, LED edges
  const PY = 3.3, px0 = 16.3, px1 = 20.5, pz0 = cz1 + .05, pz1 = 11.4;
  add(box(px1 - px0, .32, pz1 - pz0, M.cream, (px0 + px1) / 2, y + PY, (pz0 + pz1) / 2));
  const hole = box(px1 - px0 - .6, .34, pz1 - pz0 - .6, M.cream, (px0 + px1) / 2, y + PY - .01, (pz0 + pz1) / 2); hole.material = M.darkPanel; add(hole);
  for (let i = 0; i < Math.floor((px1 - px0 - .6) / .22); i++) { const s = box(.05, .18, pz1 - pz0 - .6, M.louvre, px0 + .3 + .11 + i * .22, y + PY + .07, (pz0 + pz1) / 2); s.rotation.z = .5; add(s); }
  add(box(.03, .03, pz1 - pz0, M.led, px1 - .02, y + PY - .02, (pz0 + pz1) / 2));
  add(box(px1 - px0, .03, .03, M.led, (px0 + px1) / 2, y + PY - .02, pz1 - .02), box(px1 - px0, .03, .03, M.led, (px0 + px1) / 2, y + PY - .02, pz0 + .02));
  add(box(px1 - px0, .5, .3, M.cream, (px0 + px1) / 2, y + PY - .18, pz0 + .15));   // deep edge beam on the core: the canopy cantilevers from it
  for (const px of [px0 + .6, (px0 + px1) / 2, px1 - .6]) { const b = box(.14, .14, pz1 - pz0 - .4, M.cream, px, y + PY + .32, (pz0 + pz1) / 2); add(b); }
  // ---- sit-out (west curve): curved run of sofas, rattan tables, armchairs, lamps, planters, bollards ----
  const sw = OUTLINE.find((f) => f.id === 'SW').pts;
  const seat = resample(sw.map((p) => ({ x: p.x - p.nx * 1.3, z: p.z - p.nz * 1.3, nx: p.nx, nz: p.nz })), 1.0).filter((p, i, a) => i > 1 && i < a.length - 2);
  seat.forEach((p, i) => { const s = sofa(1.0, .85, { armL: i === 0, armR: i === seat.length - 1, seats: 1 }); s.position.set(p.x, y + .02, p.z); s.rotation.y = Math.atan2(-p.nx, -p.nz) + PI; add(s); if (i % 3 === 1) add(cushion(p.x - p.nx * .3, y + .5, p.z - p.nz * .3, .42, .42, M.velvetOlive, Math.atan2(-p.nx, -p.nz) + PI)); });
  add(slab(2.6, 7.2, 9.6, 11.6, y + .03, M.deck));
  add(rbox(1.0, .4, 1.0, .03, M.rattan, 5.4, y + .03, 9.6), rbox(.9, .04, .9, .01, M.glassBal, 5.4, y + .43, 9.6));
  add(fit(lib, 'mid_century_lounge_chair', { x: 8.6, z: 8.5, y: y + .03, h: 1.0, keep: true, face: FACE.S - .6 }), fit(lib, 'mid_century_lounge_chair', { x: 8.9, z: 10.3, y: y + .03, h: 1.0, keep: true, face: FACE.W - .3 }));
  add(fit(lib, 'modern_coffee_table_01', { x: 7.5, z: 9.5, y: y + .03, w: .6, d: 1.1, h: .4, face: FACE.E }));
  add(fit(lib, 'outdoor_table_chair_set_01', { x: 9.0, z: 11.4, y: y + .03, h: .86, keep: true, face: FACE.E }));
  for (const [px, pz] of [[6.6, 10.6], [4.4, 8.2]]) { add(box(.2, .6, .2, M.cream, px, y + .03, pz)); add(box(.22, .25, .22, M.shade, px, y + .63, pz)); }
  for (const [px, pz, s] of [[3.0, 6.2, 1.2], [7.6, 11.8, 1.0], [14.6, 11.9, 1.0], [21.2, 10.1, .9], [2.6, 9.4, 1.0]]) add(plant(lib, px, y, pz, s > 1.1 ? 'tree' : 'big', s));
  // planters along the inside of the south face and the west curve, bollard lights
  add(planterBox(11.5, y + .02, 11.8, 3.6, .4), planterBox(19.6, y + .02, 11.8, 1.6, .4));
  for (const p of resample(sw.map((p) => ({ x: p.x - p.nx * .55, z: p.z - p.nz * .55, nx: p.nx, nz: p.nz })), 1.3).slice(1, -1)) add(planterBox(p.x, y + .02, p.z, 1.1, .4, Math.atan2(p.nx, p.nz), 2));
  for (const [px, pz] of [[6.0, 11.2], [9.0, 11.9], [13.5, 11.9], [16.0, 11.7], [3.6, 7.4]]) add(bollard(px, y, pz));
  g.userData.lights = [[cx, cz + 1.8], [18.5, 7], [6, 9.5], [12, 10.5]];
  return g;
}

/**
 * Interior provider for createBuilding (lib/scene.js): returns a promise of the furnished group
 * for a level (or null). Groups are built once per level; textures and the model kits load on
 * first use. `slabTop(level)` may return the top of a level's slab (for the rooftop pool deck).
 */
export function createInteriors({ slabTop } = {}) {
  const cache = new Map();
  return function build(level) {
    if (!cache.has(level)) {
      cache.set(level, Promise.all([loadLibrary(), loadSurfaces()]).then(([lib, s]) => {
        SURF = s; mats();
        const y = LEVEL_Y[level];
        if (level === 'B') return null;
        if (level === 'G') return lobby(lib, y + .02);
        if (level === 'F03') return gym(lib, y + .02);
        if (level === 'T') return terrace(lib, y + .01, slabTop ? slabTop(level) : undefined);
        if (level === 'F01') return null;   // podium (retail double height)
        return residence(lib, y + .02);
      }));
    }
    return cache.get(level);
  };
}
/** Structural-model categories the furnished interior replaces (its partitions differ from the brochure plan). */
export const REPLACED_CATS = new Set(['ArchWalls', 'Doors', 'Glass', 'WindowFrames', 'Handrails', 'Cars', 'Pallets']);
