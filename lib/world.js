// The setting the tower stands in, after the brochure renders: a blue sky with soft clouds (stars
// at night), Mahim Bay to the west (model -X) with a sand beach and surf, SVS Road along the east
// side (+X) meeting a cross street on the south side (+Z), low-rise neighbours in cream and white,
// palms and broadleaf trees along the streets, and a few parked and moving cars.
// Everything is procedural (no extra downloads) and in the model frame: metres, Y up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- layout (model frame) ----------
export const PLOT = { x0: -4, x1: 32, z0: -4, z1: 22 };           // the tower's own plot
const ROAD_A = { x0: 40, x1: 54 };                                  // SVS Road, along Z on the east side
const ROAD_B = { z0: 30, z1: 41 };                                  // cross street, along X on the south side
const ROAD_C = { x0: 7.6, x1: 19.6 };                              // street running south from the junction, on axis with the south face
const PROM = { x0: -64, x1: -50 };                                  // seafront road + promenade
export const shoreX = (z) => -104 + 9 * Math.sin(z / 41) + 4 * Math.sin(z / 13 + 1.3);
const NEAR = { cx: 0, cz: 10, size: 420 };                          // detailed ground texture area

// deterministic random
function rng(seed) { let s = seed >>> 0; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }

// ---------- sky dome: day gradient + sun glow + clouds, night gradient + stars ----------
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      night: { value: 0 },
      sunDir: { value: new THREE.Vector3(-0.55, 0.35, 0.5).normalize() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;   // always at the far plane
      }`,
    fragmentShader: /* glsl */`
      uniform float night; uniform vec3 sunDir; varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        // day: deep blue zenith to a pale, warm-white horizon (brochure day render)
        vec3 zen = vec3(0.10, 0.36, 0.72), mid = vec3(0.36, 0.62, 0.88), hor = vec3(0.86, 0.90, 0.92);
        vec3 day = mix(hor, mid, smoothstep(0.0, 0.22, h));
        day = mix(day, zen, smoothstep(0.22, 0.85, h));
        float s = max(dot(d, sunDir), 0.0);
        day += vec3(1.0, 0.82, 0.6) * (pow(s, 8.0) * 0.35 + pow(s, 600.0) * 3.0);
        day = mix(day, vec3(0.95, 0.86, 0.78), (1.0 - smoothstep(0.0, 0.08, h)) * 0.35);   // warm haze low down
        // clouds: soft cumulus, flattened towards the horizon
        vec2 cp = d.xz / max(0.08, d.y + 0.12) * 1.6;
        float c = smoothstep(0.52, 0.82, fbm(cp + vec2(3.1, 7.4))) * smoothstep(0.0, 0.18, h) * (1.0 - smoothstep(0.55, 0.95, h));
        vec3 cloudCol = mix(vec3(1.0, 0.97, 0.94), vec3(1.0, 0.86, 0.76), pow(s, 3.0));
        day = mix(day, cloudCol, c * 0.85);
        // night: navy sky over a faint city glow on the horizon, stars
        vec3 nz = vec3(0.02, 0.04, 0.10), nh = vec3(0.12, 0.17, 0.30);
        vec3 nt = mix(nh, nz, smoothstep(0.0, 0.5, h)) + vec3(0.30, 0.18, 0.12) * (1.0 - smoothstep(0.0, 0.12, h)) * 0.35;
        vec2 sp = d.xz / max(0.05, d.y + 0.2) * 220.0;
        float st = step(0.9975, hash(floor(sp))) * smoothstep(0.08, 0.4, h);
        nt += vec3(st) * 0.9;
        nt = mix(nt, vec3(0.16, 0.2, 0.3), c * 0.25);
        gl_FragColor = vec4(mix(day, nt, night), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  mat.toneMapped = false;
  const m = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

// ---------- canvas helpers ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { repeat = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Detailed ground around the plot: roads with markings, kerbs, footpaths, crossings, the plot, gardens, beach. */
function nearGroundTexture(px) {
  const S = NEAR.size, k = px / S;
  const [c, x] = canvas(px, px);
  const X = (mx) => (mx - (NEAR.cx - S / 2)) * k, Z = (mz) => (mz - (NEAR.cz - S / 2)) * k;
  const rect = (x0, z0, x1, z1, fill) => { x.fillStyle = fill; x.fillRect(X(x0), Z(z0), (x1 - x0) * k, (z1 - z0) * k); };
  const r = rng(7);
  // base: urban ground with a little variation
  x.fillStyle = '#a8a294'; x.fillRect(0, 0, px, px);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${r() < .5 ? '70,90,50' : '120,110,95'},${0.05 + r() * .08})`; const s = (2 + r() * 10) * k; x.fillRect(r() * px, r() * px, s, s); }
  // gardens (green patches between buildings)
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${78 + r() * 20 | 0},${104 + r() * 20 | 0},${58 + r() * 12 | 0},0.85)`; const w = (8 + r() * 26) * k, h = (8 + r() * 26) * k; x.fillRect(r() * px, r() * px, w, h); }
  // sand down to the shoreline
  x.fillStyle = '#d9c4a0';
  x.beginPath(); x.moveTo(X(-400), Z(-400));
  for (let z = -400; z <= 400; z += 2) x.lineTo(X(shoreX(z) - 2), Z(z));
  x.lineTo(X(-400), Z(400)); x.closePath(); x.fill();
  for (let i = 0; i < 2600; i++) { const zz = -220 + r() * 440, xx = shoreX(zz) + 2 + r() * (PROM.x0 - shoreX(zz)); x.fillStyle = `rgba(${r() < .5 ? '255,245,225' : '170,140,100'},.25)`; x.fillRect(X(xx), Z(zz), 1.2 * k, 1.2 * k); }
  // seafront promenade + road
  rect(PROM.x0 - 0.5, -400, PROM.x0 + 4, 400, '#bdb6a8');
  rect(PROM.x0 + 4, -400, PROM.x1, 400, '#43464b');
  rect(PROM.x0 + 3.6, -400, PROM.x0 + 4, 400, '#d8d3c8');
  // footpaths
  const walk = '#c3bcae';
  rect(ROAD_A.x0 - 4, -400, ROAD_A.x0, 400, walk); rect(ROAD_A.x1, -400, ROAD_A.x1 + 4, 400, walk);
  rect(PROM.x1, ROAD_B.z0 - 4, 400, ROAD_B.z0, walk); rect(PROM.x1, ROAD_B.z1, 400, ROAD_B.z1 + 4, walk);
  // roads
  const asph = '#3d4045';
  rect(ROAD_A.x0, -400, ROAD_A.x1, 400, asph);
  rect(PROM.x1, ROAD_B.z0, 400, ROAD_B.z1, asph);
  rect(ROAD_C.x0 - 3.5, ROAD_B.z1, ROAD_C.x0, 400, walk); rect(ROAD_C.x1, ROAD_B.z1, ROAD_C.x1 + 3.5, 400, walk);
  rect(ROAD_C.x0, ROAD_B.z1 - 1, ROAD_C.x1, 400, asph);
  // asphalt grain
  for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(255,255,255,${r() * .05})`; const xx = r() * px, zz = r() * px; x.fillRect(xx, zz, k * .6, k * .6); }
  // kerbs
  x.fillStyle = '#e4e0d6';
  for (const xx of [ROAD_A.x0, ROAD_A.x1]) rect(xx - .25, -400, xx + .25, 400, '#e4e0d6');
  for (const zz of [ROAD_B.z0]) rect(PROM.x1, zz - .25, 400, zz + .25, '#e4e0d6');
  rect(PROM.x1, ROAD_B.z1 - .25, ROAD_C.x0, ROAD_B.z1 + .25, '#e4e0d6'); rect(ROAD_C.x1, ROAD_B.z1 - .25, 400, ROAD_B.z1 + .25, '#e4e0d6');
  for (const xx of [ROAD_C.x0, ROAD_C.x1]) rect(xx - .25, ROAD_B.z1, xx + .25, 400, '#e4e0d6');
  const ccx = (ROAD_C.x0 + ROAD_C.x1) / 2;
  for (let z = ROAD_B.z1 + 10; z < 400; z += 9) rect(ccx - .08, z, ccx + .08, z + 4, 'rgba(240,240,232,.8)');
  for (let i = 0; i < 12; i++) rect(ROAD_C.x0 + 0.4 + i * 0.95, ROAD_B.z1 + 2, ROAD_C.x0 + 0.85 + i * 0.95, ROAD_B.z1 + 5.6, '#ecebe4');
  // SVS Road median with planting (aerial render)
  const mx = (ROAD_A.x0 + ROAD_A.x1) / 2;
  rect(mx - 0.9, -400, mx + 0.9, ROAD_B.z0 - 8, '#d9d6cd'); rect(mx - 0.6, -400, mx + 0.6, ROAD_B.z0 - 8, '#5f8a3e');
  rect(mx - 0.9, ROAD_B.z1 + 8, mx + 0.9, 400, '#d9d6cd'); rect(mx - 0.6, ROAD_B.z1 + 8, mx + 0.6, 400, '#5f8a3e');
  // lane dashes
  x.fillStyle = 'rgba(240,240,232,.85)';
  for (const lx of [ROAD_A.x0 + 3.5, ROAD_A.x1 - 3.5]) for (let z = -400; z < 400; z += 9) if (z + 4 < ROAD_B.z0 - 6 || z > ROAD_B.z1 + 6) rect(lx - .08, z, lx + .08, z + 4, 'rgba(240,240,232,.8)');
  const bz = (ROAD_B.z0 + ROAD_B.z1) / 2;
  for (let xx = PROM.x1; xx < 400; xx += 9) if (xx + 4 < ROAD_A.x0 - 6 || xx > ROAD_A.x1 + 6) rect(xx, bz - .08, xx + 4, bz + .08, 'rgba(240,240,232,.8)');
  // zebra crossings at the junction
  for (let i = 0; i < 14; i++) { const zz = ROAD_B.z0 - 7 + 0; rect(ROAD_A.x0 + 0.5 + i * 0.95, zz, ROAD_A.x0 + 0.95 + i * 0.95, zz + 3.6, '#ecebe4'); rect(ROAD_A.x0 + 0.5 + i * 0.95, ROAD_B.z1 + 3.4, ROAD_A.x0 + 0.95 + i * 0.95, ROAD_B.z1 + 7, '#ecebe4'); }
  for (let i = 0; i < 11; i++) { rect(ROAD_A.x0 - 7, ROAD_B.z0 + 0.4 + i * 0.95, ROAD_A.x0 - 3.4, ROAD_B.z0 + 0.85 + i * 0.95, '#ecebe4'); rect(ROAD_A.x1 + 3.4, ROAD_B.z0 + 0.4 + i * 0.95, ROAD_A.x1 + 7, ROAD_B.z0 + 0.85 + i * 0.95, '#ecebe4'); }
  // the plot: light stone paving with a darker drive and planters along the edges
  rect(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z1, '#cfc7b7');
  for (let i = 0; i <= 36; i++) rect(PLOT.x0 + i, PLOT.z0, PLOT.x0 + i + .03, PLOT.z1, 'rgba(120,110,95,.15)');
  for (let i = 0; i <= 26; i++) rect(PLOT.x0, PLOT.z0 + i, PLOT.x1, PLOT.z0 + i + .03, 'rgba(120,110,95,.15)');
  rect(PLOT.x1 - 8, PLOT.z1 - 3, ROAD_A.x0 - 4, ROAD_B.z0 - 4, '#b3ab9b');   // entrance forecourt to the corner
  rect(PLOT.x0, PLOT.z0, PLOT.x0 + 1.6, PLOT.z1, '#5d7d3c'); rect(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z0 + 1.6, '#5d7d3c');
  // soft fade at the texture edge into the far ground
  const g = x.createRadialGradient(px / 2, px / 2, px * 0.36, px / 2, px / 2, px * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, px, px); x.globalCompositeOperation = 'source-over';
  return tex(c);
}

/** Far ground: the rest of Mahim as a coarse texture of blocks, greenery and roads. */
function farGroundTexture() {
  const [c, x] = canvas(1024, 1024);
  const r = rng(11);
  x.fillStyle = '#a49e8f'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < .45 ? `rgba(84,106,62,${.5 + r() * .4})` : `rgba(${190 + r() * 40 | 0},${185 + r() * 35 | 0},${170 + r() * 30 | 0},.7)`; x.fillRect(r() * 1024, r() * 1024, 3 + r() * 9, 3 + r() * 9); }
  x.strokeStyle = 'rgba(60,62,66,.8)'; x.lineWidth = 2;
  for (let i = 0; i < 24; i++) { x.beginPath(); const y = r() * 1024; x.moveTo(0, y); x.bezierCurveTo(300, y + (r() - .5) * 200, 700, y + (r() - .5) * 200, 1024, y + (r() - .5) * 100); x.stroke(); }
  return tex(c, { repeat: true });
}

/** Normal map with small ripples for the sea. */
function waveNormals() {
  const N = 256, [c, x] = canvas(N, N), img = x.createImageData(N, N);
  const hgt = (i, j) => Math.sin((i / N) * Math.PI * 2 * 6 + Math.sin((j / N) * Math.PI * 2 * 3) * 1.3) * 0.5 + Math.sin((j / N) * Math.PI * 2 * 9 + (i / N) * Math.PI * 2 * 2) * 0.35 + Math.sin(((i + j) / N) * Math.PI * 2 * 14) * 0.15;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = hgt(i + 1, j) - hgt(i - 1, j), dz = hgt(i, j + 1) - hgt(i, j - 1);
    const n = new THREE.Vector3(-dx * 1.6, 1, -dz * 1.6).normalize();
    const o = (j * N + i) * 4;
    img.data[o] = (n.x * .5 + .5) * 255; img.data[o + 1] = (n.z * .5 + .5) * 255; img.data[o + 2] = n.y * 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return tex(c, { repeat: true, srgb: false });
}

/** Facade texture for neighbouring blocks: rendered wall with a row of windows and balconies per floor. */
function blockTexture() {
  const [c, x] = canvas(256, 256);   // one tile = 2 bays wide (8 m), 2 floors high
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256);
  for (let f = 0; f < 2; f++) {
    const y = f * 128;
    x.fillStyle = '#e8e4dc'; x.fillRect(0, y + 112, 256, 16);                 // slab band
    for (let b = 0; b < 2; b++) {
      const bx = b * 128;
      x.fillStyle = '#3d4450'; x.fillRect(bx + 18, y + 34, 92, 66);            // window
      x.fillStyle = 'rgba(160,190,215,.55)'; x.fillRect(bx + 18, y + 34, 92, 20);
      x.fillStyle = '#f4f2ec'; x.fillRect(bx + 62, y + 34, 4, 66); x.fillRect(bx + 14, y + 98, 100, 6);
    }
  }
  return tex(c, { repeat: true });
}
function blockNightTexture() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
  const r = rng(5);
  for (let f = 0; f < 2; f++) for (let b = 0; b < 2; b++) { if (r() < .55) continue; x.fillStyle = r() < .7 ? '#ffcf8a' : '#cfe0ff'; x.globalAlpha = .5 + r() * .5; x.fillRect(b * 128 + 18, f * 128 + 34, 92, 66); }
  x.globalAlpha = 1;
  return tex(c, { repeat: true });
}

// ---------- neighbours ----------
/** Side walls of a box as quads with UVs in tiles (8 m wide, 6 m = 2 floors high). */
function blockWalls(x0, z0, x1, z1, h, color) {
  const pos = [], uv = [], nor = [], col = [], idx = [];
  const faces = [[x0, z1, x1, z1, 0, 1], [x1, z1, x1, z0, 1, 0], [x1, z0, x0, z0, 0, -1], [x0, z0, x0, z1, -1, 0]];
  for (const [ax, az, bx, bz, nx, nz] of faces) {
    const len = Math.hypot(bx - ax, bz - az), u = Math.max(1, Math.round(len / 8)), v = h / 6, b = pos.length / 3;
    pos.push(ax, 0, az, bx, 0, bz, bx, h, bz, ax, h, az);
    uv.push(0, 0, u, 0, u, v, 0, v);
    for (let i = 0; i < 4; i++) { nor.push(nx, 0, nz); col.push(color.r, color.g, color.b); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
function colored(g, color) {
  g = g.index ? g.toNonIndexed() : g;
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = color.r; a[i * 3 + 1] = color.g; a[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
function neighbourBlocks(narrow) {
  const r = rng(21);
  const tints = ['#e6dfd2', '#ddd4c4', '#d2c8b6', '#ebe7df', '#c9c0b2', '#ddd2bf', '#d8cfc6'].map((c) => new THREE.Color(c));
  const list = [];
  // hand-placed blocks around the plot, after the aerial render (mid-rise residential)
  const near = [
    [-46, -40, -18, -14, 21], [-44, -6, -16, 22, 24], [-40, 50, -10, 76, 18], [-6, -44, 22, -22, 27], [-16, 52, -3, 80, 12], [25, 52, 36, 72, 12],
    [62, -30, 90, -6, 30], [62, 4, 86, 24, 21], [62, 50, 88, 74, 15], [-36, 92, -5, 116, 15], [25, 86, 36, 110, 12], [62, -60, 84, -36, 36],
    [-44, -78, -20, -54, 15], [64, -76, 96, -50, 24], [94, 0, 118, 24, 18], [96, 48, 124, 70, 12],
  ];
  for (const [x0, z0, x1, z1, h] of near) list.push({ x0, z0, x1, z1, h });
  // a looser ring further out, lower near the sea
  const R = narrow ? 260 : 420;
  for (let gx = -40; gx <= R; gx += 34) for (let gz = -R; gz <= R; gz += 34) {
    if (Math.hypot(gx - 13, gz - 7) < 120) continue;
    if (gx > ROAD_A.x0 - 22 && gx < ROAD_A.x1 + 6) continue;
    if (gz > ROAD_B.z0 - 22 && gz < ROAD_B.z1 + 6) continue;
    if (gx > ROAD_C.x0 - 30 && gx < ROAD_C.x1 + 4 && gz > 0) continue;
    if (r() < 0.22) continue;
    const w = 14 + r() * 14, d = 12 + r() * 14, fl = 3 + Math.floor(r() * r() * 12);
    list.push({ x0: gx, z0: gz, x1: gx + w, z1: gz + d, h: fl * 3 + 1 });
  }
  const walls = [], roofs = [];
  for (const b of list) {
    const tint = tints[Math.floor(r() * tints.length)];
    walls.push(blockWalls(b.x0, b.z0, b.x1, b.z1, b.h, tint));
    const roof = new THREE.BoxGeometry(b.x1 - b.x0, 0.6, b.z1 - b.z0); roof.translate((b.x0 + b.x1) / 2, b.h + 0.3, (b.z0 + b.z1) / 2);
    const roofTint = r() < 0.12 ? new THREE.Color('#c96f45') : new THREE.Color('#bdb5a8').lerp(tint, .4);
    roofs.push(colored(roof, roofTint));
    // stair / lift head room on the roof
    const sw = Math.min(6, (b.x1 - b.x0) * .3), sd = Math.min(5, (b.z1 - b.z0) * .3);
    const head = new THREE.BoxGeometry(sw, 2.6, sd); head.translate(b.x0 + (b.x1 - b.x0) * (.3 + r() * .4), b.h + 1.6, b.z0 + (b.z1 - b.z0) * (.3 + r() * .4));
    roofs.push(colored(head, tint));
  }
  const day = blockTexture(), night = blockNightTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: day, vertexColors: true, roughness: .85, emissive: 0xffffff, emissiveMap: night, emissiveIntensity: 0 });
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true });
  const g = new THREE.Group();
  const w = new THREE.Mesh(mergeGeometries(walls), wallMat); w.castShadow = w.receiveShadow = true;
  const rf = new THREE.Mesh(mergeGeometries(roofs), roofMat); rf.castShadow = rf.receiveShadow = true;
  g.add(w, rf);
  return { group: g, wallMat, roofMat, list };
}

// ---------- vegetation ----------
function palmGeometries() {
  const trunk = new THREE.CylinderGeometry(0.17, 0.26, 1, 7, 6, true); trunk.translate(0, 0.5, 0);
  // fronds: tapered strips arching out and down from the crown, merged into one crown mesh
  const fronds = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + (i % 2) * 0.2, L = 3.4 + (i % 3) * 0.4, droop = 0.55 + (i % 4) * 0.12, seg = 8;
    const pos = [], idx = [];
    for (let s = 0; s <= seg; s++) {
      const t = s / seg, w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.55 + 0.04;
      const rr = t * L, y = Math.sin(t * 1.4) * 0.9 - t * t * droop * 2.4;
      const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      pos.push(cx - px, y - w * .25, cz - pz, cx, y + 0.08, cz, cx + px, y - w * .25, cz + pz);
      if (s) { const k = (s - 1) * 3; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    fronds.push(g);
  }
  const crown = mergeGeometries(fronds);
  return { trunk, crown };
}
function treeGeometry() {
  const parts = [];
  const r = rng(3);
  for (let i = 0; i < 5; i++) { const s = 1.4 + r() * 1.1; const g = new THREE.IcosahedronGeometry(s, 1); g.translate((r() - .5) * 2.4, 4 + r() * 1.6, (r() - .5) * 2.4); parts.push(g); }
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 4, 6); trunk.translate(0, 2, 0);
  return { canopy: mergeGeometries(parts.map((p) => p.toNonIndexed())), trunk };
}

function vegetation(narrow) {
  const r = rng(99);
  const palms = [], trees = [];
  const ok = (x, z) => !(x > PLOT.x0 + 2 && x < PLOT.x1 - 2 && z > PLOT.z0 + 2 && z < PLOT.z1 - 2);
  // palms on the footpaths of both roads, on the plot frontage and along the promenade
  for (let z = -200; z <= 220; z += 15 + r() * 6) { palms.push([ROAD_A.x0 - 2, z + r() * 2]); if (r() < .6) palms.push([ROAD_A.x1 + 2, z + 5]); }
  for (let x = -40; x <= 220; x += 16 + r() * 6) { if (Math.abs(x - (ROAD_A.x0 + ROAD_A.x1) / 2) < 14) continue; palms.push([x, ROAD_B.z0 - 2]); if (r() < .6) palms.push([x + 6, ROAD_B.z1 + 2]); }
  for (let z = ROAD_B.z1 + 9; z <= 128; z += 13 + r() * 5) { palms.push([ROAD_C.x0 - 1.8, z]); palms.push([ROAD_C.x1 + 1.8, z + 6 * r()]); }
  for (let z = -260; z <= 260; z += 11 + r() * 7) palms.push([PROM.x0 + 1.5 + r(), z]);
  for (let z = -240; z <= 240; z += 9 + r() * 10) palms.push([shoreX(z) + 14 + r() * 26, z]);
  palms.push([PLOT.x1 - 1, PLOT.z1 - 1], [PLOT.x0 + 1, PLOT.z1 - 1], [PLOT.x1 - 1, PLOT.z0 + 2], [26, 20.5], [6, 20.5]);
  // broadleaf trees in the gaps between neighbours
  for (let i = 0; i < (narrow ? 120 : 260); i++) {
    const x = -48 + r() * 330, z = -260 + r() * 520;
    if (x > ROAD_A.x0 - 3 && x < ROAD_A.x1 + 3) continue;
    if (z > ROAD_B.z0 - 3 && z < ROAD_B.z1 + 3) continue;
    if (x > ROAD_C.x0 - 4 && x < ROAD_C.x1 + 4 && z > ROAD_B.z1) continue;
    if (!ok(x, z) || (x > PLOT.x0 - 3 && x < PLOT.x1 + 3 && z > PLOT.z0 - 3 && z < PLOT.z1 + 3)) continue;
    trees.push([x, z]);
  }
  return { palms, trees };
}

// ---------- cars ----------
function carGeometry() {
  const body = new THREE.BoxGeometry(4.3, 0.8, 1.8); body.translate(0, 0.65, 0);
  const cab = new THREE.BoxGeometry(2.3, 0.6, 1.6); cab.translate(-0.2, 1.35, 0);
  return mergeGeometries([body, cab]);
}

/**
 * Builds the world. `blocked(x0, z0, x1, z1)` lets the caller keep things off an area.
 * Returns the group plus handles the stage uses for night mode and neighbour fading.
 */
export function createWorld({ narrow = false, shadows = true } = {}) {
  const group = new THREE.Group();
  const sky = skyDome();
  group.add(sky);

  // far ground
  const farTex = farGroundTexture(); farTex.repeat.set(10, 10);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ map: farTex, roughness: 1 }));
  far.rotation.x = -Math.PI / 2; far.position.set(800, -0.05, 0);
  far.receiveShadow = shadows;
  group.add(far);
  // near ground (detailed)
  const near = new THREE.Mesh(new THREE.PlaneGeometry(NEAR.size, NEAR.size), new THREE.MeshStandardMaterial({ map: nearGroundTexture(narrow ? 2048 : 4096), transparent: true, roughness: .95 }));
  near.rotation.x = -Math.PI / 2; near.position.set(NEAR.cx, 0.0, NEAR.cz);
  near.receiveShadow = shadows; near.renderOrder = -1;
  group.add(near);
  // far sand strip along the whole coast (beyond the near texture)
  // (shapes are drawn in (x, -z) and laid flat with rotateX(-90°) so their faces point up)
  const sandPts = [new THREE.Vector2(PROM.x0, 2000)];
  for (let z = -2000; z <= 2000; z += 20) sandPts.push(new THREE.Vector2(shoreX(z) - 3, -z));
  sandPts.push(new THREE.Vector2(PROM.x0, -2000));
  const sandGeom = new THREE.ShapeGeometry(new THREE.Shape(sandPts)); sandGeom.rotateX(-Math.PI / 2);
  const sand = new THREE.Mesh(sandGeom, new THREE.MeshStandardMaterial({ color: 0xd6c19d, roughness: 1 }));
  sand.position.y = -0.03;
  group.add(sand);

  // sea: a polygon from the shoreline out to the horizon, with ripples and the sky in it
  const seaPts = [new THREE.Vector2(-4000, 4000)];
  for (let z = -4000; z <= 4000; z += (Math.abs(z) < 600 ? 4 : 100)) seaPts.push(new THREE.Vector2(shoreX(z), -z));
  seaPts.push(new THREE.Vector2(-4000, -4000));
  const seaGeom = new THREE.ShapeGeometry(new THREE.Shape(seaPts));
  seaGeom.rotateX(-Math.PI / 2);
  const sUv = seaGeom.attributes.uv; const sp = seaGeom.attributes.position;
  for (let i = 0; i < sUv.count; i++) sUv.setXY(i, sp.getX(i) / 140, sp.getZ(i) / 140);
  const waves = waveNormals();
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x2c7da0, roughness: 0.16, metalness: 0.05, normalMap: waves, normalScale: new THREE.Vector2(0.18, 0.18), envMapIntensity: 1.1 });
  const sea = new THREE.Mesh(seaGeom, seaMat);
  sea.position.y = 0.06; sea.receiveShadow = false;
  group.add(sea);
  // shallow water + surf: a band along the shore, turquoise fading into foam
  const [fc, fx] = canvas(64, 256);
  const fg = fx.createLinearGradient(0, 0, 0, 256);
  fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(.35, 'rgba(80,190,200,.55)'); fg.addColorStop(.72, 'rgba(160,225,225,.75)'); fg.addColorStop(.86, 'rgba(255,255,255,.95)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
  fx.fillStyle = fg; fx.fillRect(0, 0, 64, 256);
  const r = rng(4);
  for (let i = 0; i < 260; i++) { fx.fillStyle = `rgba(255,255,255,${r() * .6})`; fx.fillRect(r() * 64, 120 + r() * 120, 2 + r() * 10, 1 + r() * 2); }
  const foamTex = tex(fc); foamTex.wrapS = THREE.RepeatWrapping;
  const fpos = [], fuv = [], fidx = [];
  let n = 0;
  for (let z = -900; z <= 900; z += 4, n++) {
    const sx = shoreX(z);
    fpos.push(sx - 26, 0.08, z, sx + 0.5, 0.08, z);
    fuv.push(z / 24, 0, z / 24, 1);
    if (n) { const k = (n - 1) * 2; fidx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const foamGeom = new THREE.BufferGeometry();
  foamGeom.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
  foamGeom.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  foamGeom.setIndex(fidx); foamGeom.computeVertexNormals();
  const foamMat = new THREE.MeshStandardMaterial({ map: foamTex, transparent: true, depthWrite: false, roughness: .6, side: THREE.DoubleSide });
  const foam = new THREE.Mesh(foamGeom, foamMat); foam.renderOrder = 1;
  group.add(foam);

  // neighbours
  const nb = neighbourBlocks(narrow);
  group.add(nb.group);

  // vegetation (instanced)
  const { palms, trees } = vegetation(narrow);
  const pg = palmGeometries();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7764, roughness: .95 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x4f6e2c, roughness: .8, side: THREE.DoubleSide });
  const trunks = new THREE.InstancedMesh(pg.trunk, trunkMat, palms.length);
  const crowns = new THREE.InstancedMesh(pg.crown, frondMat, palms.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const pr = rng(31), col = new THREE.Color();
  palms.forEach(([x, z], i) => {
    const h = 8 + pr() * 7, lean = (pr() - .5) * 0.18, yaw = pr() * Math.PI * 2;
    e.set(lean, yaw, (pr() - .5) * 0.18); q.setFromEuler(e);
    m4.compose(v.set(x, 0, z), q, s.set(1, h, 1)); trunks.setMatrixAt(i, m4);
    const top = new THREE.Vector3(0, h, 0).applyQuaternion(q);
    const sc = 0.9 + pr() * 0.35;
    m4.compose(v.set(x + top.x, top.y, z + top.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), s.set(sc, sc, sc)); crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, col.setHSL(0.24 + pr() * 0.04, 0.42 + pr() * .15, 0.26 + pr() * 0.08));
  });
  trunks.castShadow = crowns.castShadow = shadows;
  group.add(trunks, crowns);
  const tg = treeGeometry();
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  const canopies = new THREE.InstancedMesh(tg.canopy, canopyMat, trees.length);
  const tTrunks = new THREE.InstancedMesh(tg.trunk, trunkMat, trees.length);
  trees.forEach(([x, z], i) => {
    const sc = 0.8 + pr() * 0.9;
    m4.compose(v.set(x, 0, z), q.setFromEuler(e.set(0, pr() * 6.28, 0)), s.set(sc, sc * (0.85 + pr() * .4), sc));
    canopies.setMatrixAt(i, m4); tTrunks.setMatrixAt(i, m4);
    canopies.setColorAt(i, col.setHSL(0.22 + pr() * 0.08, 0.35 + pr() * .2, 0.22 + pr() * 0.1));
  });
  canopies.castShadow = shadows; canopies.receiveShadow = shadows;
  group.add(canopies, tTrunks);

  // cars, parked and on the roads
  const cars = [];
  const cr = rng(77);
  for (let z = -160; z < 200; z += 14 + cr() * 30) if (z < ROAD_B.z0 - 8 || z > ROAD_B.z1 + 8) cars.push([ROAD_A.x0 + 1.8 + (cr() < .5 ? 3.6 : 0), z, Math.PI / 2]);
  for (let z = -160; z < 200; z += 18 + cr() * 30) if (z < ROAD_B.z0 - 8 || z > ROAD_B.z1 + 8) cars.push([ROAD_A.x1 - 1.8 - (cr() < .5 ? 3.6 : 0), z, -Math.PI / 2]);
  for (let x = -40; x < 220; x += 16 + cr() * 30) if (x < ROAD_A.x0 - 8 || x > ROAD_A.x1 + 8) cars.push([x, ROAD_B.z0 + 1.8 + (cr() < .5 ? 3 : 0), 0]);
  for (let z = -200; z < 200; z += 20 + cr() * 30) cars.push([PROM.x0 + 7, z, Math.PI / 2]);
  for (let z = ROAD_B.z1 + 14; z < 260; z += 18 + cr() * 26) cars.push([ROAD_C.x0 + 2.6 + (cr() < .5 ? 0 : 6.8), z, Math.PI / 2]);
  cars.push([PLOT.x1 + 3, PLOT.z1 + 2, 0.4], [ROAD_A.x0 - 6, ROAD_B.z0 - 9, Math.PI / 2]);
  const carMesh = new THREE.InstancedMesh(carGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, metalness: .4 }), cars.length);
  const palette = ['#e8e6e1', '#2b2f36', '#8e9399', '#b03a2e', '#c9cdd2', '#3b4d6b', '#f2f2f0', '#54585e'];
  cars.forEach(([x, z, a], i) => { m4.compose(v.set(x, 0, z), q.setFromEuler(e.set(0, a, 0)), s.set(1, 1, 1)); carMesh.setMatrixAt(i, m4); carMesh.setColorAt(i, col.set(palette[i % palette.length])); });
  carMesh.castShadow = shadows;
  group.add(carMesh);

  // the plot: a low white boundary wall with hedges, as in the street render
  const wallGeo = [];
  const W = (x0, z0, x1, z1) => { const g = new THREE.BoxGeometry(Math.max(.25, x1 - x0), 1.1, Math.max(.25, z1 - z0)); g.translate((x0 + x1) / 2, .55, (z0 + z1) / 2); wallGeo.push(g); };
  W(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z0 + .25); W(PLOT.x0, PLOT.z0, PLOT.x0 + .25, PLOT.z1);
  W(PLOT.x0, PLOT.z1 - .25, PLOT.x1 - 10, PLOT.z1);
  const plotWall = new THREE.Mesh(mergeGeometries(wallGeo), new THREE.MeshStandardMaterial({ color: 0xeeebe4, roughness: .7 }));
  plotWall.castShadow = plotWall.receiveShadow = shadows;
  const hedge = new THREE.Mesh((() => { const g = new THREE.BoxGeometry(PLOT.x1 - PLOT.x0 - 10, 1.2, 1.2); g.translate((PLOT.x0 + PLOT.x1 - 10) / 2, .9, PLOT.z1 - .9); return g; })(), new THREE.MeshStandardMaterial({ color: 0x46672d, roughness: 1, flatShading: true }));
  group.add(plotWall, hedge);

  // context = everything except sky, ground and sea: fades while one part of the tower is in focus
  const context = [nb.group, trunks, crowns, canopies, tTrunks, carMesh];
  const fadeMats = [nb.wallMat, nb.roofMat, trunkMat, frondMat, canopyMat, carMesh.material];

  return {
    group, sky, sea, seaMat, waves, near, nb, context, fadeMats,
    setNight(t) {
      sky.material.uniforms.night.value = t;
      nb.wallMat.emissiveIntensity = t * 0.9;
      seaMat.color.setRGB(0.17 * (1 - t) + 0.03 * t, 0.49 * (1 - t) + 0.07 * t, 0.63 * (1 - t) + 0.14 * t);
      foamMat.opacity = 1 - 0.75 * t;
    },
    setSun(dir) { sky.material.uniforms.sunDir.value.copy(dir).normalize(); },
    /** 0..1 opacity of neighbours, trees and cars. */
    setContext(a) {
      for (const m of fadeMats) { m.transparent = a < 0.999; m.opacity = a; m.depthWrite = a > 0.5; m.needsUpdate = true; }
      for (const o of context) o.visible = a > 0.02;
    },
    tick(dt) { waves.offset.x += dt * 0.012; waves.offset.y += dt * 0.007; },
    dispose() { group.traverse((o) => { o.geometry?.dispose(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (!m) return; m.map?.dispose(); m.emissiveMap?.dispose(); m.normalMap?.dispose(); m.dispose(); }); }); },
  };
}
