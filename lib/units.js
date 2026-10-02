// Flat units overview: interactive floor stack. Click a floor card or the model to isolate
// a floor; switch between tower / floor / plan views; explode the stack; show the basement.
// initUnits() runs after the DOM is mounted and returns a cleanup function.
import { createViewer, LEVELS, LEVEL_Y, CENTER, levelLabel, floorIndex } from './scene.js';

const RES = { type: '5 BHK Residence', sub: 'Entire floor · one flat per floor', area: '≈135 m² carpet (indicative)', tags: ['Sea view'] };
// Floor data from the architectural drawing R0 (06-07-26) and the brochure. Status badges are demo data.
const DATA = {
  T:   { type: 'Rooftop Sanctuary', sub: 'Terrace amenities · +69.3 m', tags: ['Amenities'], status: 'na',
         features: ['Fully functional swimming pool', 'Open-to-sky cafeteria & sitting deck', 'Lockers, toilets & changing rooms', 'Overhead water tank & lift machine room'] },
  F14: { ...RES, sub: 'Entire floor · refuge floor', tags: ['Sea view', 'Refuge'], features: ['Open refuge area 47.7 m² with 1.2 m parapet', 'Fire-evacuation lift access'] },
  F07: { ...RES, sub: 'Entire floor · refuge floor', tags: ['Sea view', 'Refuge'], features: ['Open refuge area 47.7 m² with 1.2 m parapet', 'Fire-evacuation lift access'] },
  F17: { ...RES, area: '134.66 m² carpet (per drawing)' },
  F03: { ...RES, sub: 'Residence · fitness centre level', tags: ['Sea view', 'Fitness centre'], features: ['Fitness centre on this level', '300 mm structural walls'] },
  F02: { ...RES, area: '138.55 m² carpet (per drawing)' },
  F01: { ...RES, sub: 'Residence · society office level', tags: ['Sea view', 'Society office'] },
  G:   { type: 'Ground Floor', sub: 'Entrance lobby & retail', tags: ['Amenities'], status: 'na',
         features: ['Decorative double-height entrance lobby', 'Retail shops facing SVS Road', 'Two high-speed lifts (one fire-evacuation)', 'Pump room, meter room, society office'] },
  B:   { type: 'Basement', sub: 'Mechanical parking & services', tags: ['Parking'], status: 'na',
         features: ['Mechanical zig-zag pit parking · 32 car pallets', 'Domestic, flush & fire water tanks (1.5 lakh l fire)', '91 bored piles, 680 mm dia', 'Retaining wall to −2.6 m'] },
};
const DEMO_RESERVED = new Set(['F05', 'F09', 'F20']);   // placeholder availability for the demo

export function floorInfo(level) {
  const d = DATA[level] || RES;
  const status = d.status || (DEMO_RESERVED.has(level) ? 'reserved' : 'available');
  const features = d.features || ['Column-less, fully customisable plate', 'Curved sea-facing glass bay', 'Living + dining + 5 bedrooms + kitchen', '3.0 m floor-to-floor'];
  return { level, i: floorIndex(level), label: levelLabel(level), y: LEVEL_Y[level], status, features, ...RES, ...d };
}

export const FLOOR_GROUPS = [
  ['Rooftop', ['T']],
  ['Residences · upper', LEVELS.filter((l) => /^F/.test(l) && +l.slice(1) >= 15).reverse()],
  ['Residences · mid', LEVELS.filter((l) => /^F/.test(l) && +l.slice(1) >= 8 && +l.slice(1) <= 14).reverse()],
  ['Residences · lower', LEVELS.filter((l) => /^F/.test(l) && +l.slice(1) <= 7).reverse()],
  ['Podium & services', ['G', 'B']],
];

export function initUnits(root) {
  const q = (s) => root.querySelector(s);
  const qa = (s) => [...root.querySelectorAll(s)];
  const narrow = matchMedia('(max-width: 980px)').matches;
  const canvas = q('#units-stage');
  const viewer = createViewer(canvas, { shadows: !narrow, dprMax: narrow ? 1.5 : 1.75 });
  const cx = CENTER.x, cz = CENTER.z;
  const vlabel = q('.vlabel');
  const hoverName = q('.vfoot .hover');
  const explodeBtn = q('[data-explode]');
  const basementBtn = q('[data-basement]');
  const offs = [];
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); offs.push(() => el.removeEventListener(ev, fn, opt)); };

  let mode = 'tower', selected = null, exploded = false, basement = false;
  const dist = narrow ? 1.35 : 1;
  const scaleCam = ({ cam, look }) => {
    const d = [cam[0] - look[0], cam[1] - look[1], cam[2] - look[2]];
    const s = dist * (exploded ? 1.45 : 1);
    return { cam: [look[0] + d[0] * s, look[1] + d[1] * s, look[2] + d[2] * s], look };
  };
  const towerCam = () => scaleCam(selected ? { cam: [cx + 44, 36, cz + 102], look: [cx, 33, cz] } : { cam: [cx + 52, 38, cz + 118], look: [cx, 33, cz] });
  const floorCam = (level) => { const y = LEVEL_Y[level] + (viewer.floors[level]?.group.position.y || 0); return scaleCam({ cam: [cx + 30, y + 22, cz + 38], look: [cx, y + 1.4, cz] }); };
  const planCam = (level) => { const y = LEVEL_Y[level] + (viewer.floors[level]?.group.position.y || 0); return { cam: [cx, y + 60, cz + .001], look: [cx, y + 1, cz] }; };

  function apply() {
    viewer.useOrtho(mode === 'plan');
    viewer.setCategoryHidden('Beams', mode === 'plan');
    viewer.setCategoryHidden('Chajja', mode === 'plan');
    if (mode === 'plan' && selected) { viewer.setFocus(selected, true); const c = planCam(selected); viewer.goTo(c.cam, c.look); }
    else if (mode === 'floor' && selected) { viewer.setFocus(selected, true); const c = floorCam(selected); viewer.goTo(c.cam, c.look); }
    else { viewer.setFocus(selected, false); const c = towerCam(); viewer.goTo(c.cam, c.look); }
    const d = selected ? floorInfo(selected) : null;
    vlabel.querySelector('b').textContent = d ? d.label : 'The Sahil';
    vlabel.querySelector('span').textContent = d ? `${d.type} · +${d.y.toFixed(1)} m` : 'G + 22 · 69.3 m · 24 levels';
    qa('.toolbar [data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    qa('.toolbar [data-mode]:not([data-mode="tower"])').forEach((b) => (b.disabled = !selected));
  }

  function select(level, { scroll = true } = {}) {
    selected = level;
    if (level && mode === 'tower') mode = 'floor';
    if (!level) mode = 'tower';
    qa('.fcard').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.level === level)));
    if (level && scroll) q(`.fcard[data-level="${level}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (level === 'B' && !basement) toggleBasement(true);
    apply();
  }
  function toggleBasement(v) { basement = v; basementBtn.setAttribute('aria-pressed', String(v)); viewer.setBasement(v); }

  // ---- toolbar ----
  qa('.toolbar [data-mode]').forEach((b) => on(b, 'click', () => {
    mode = b.dataset.mode;
    if (mode !== 'tower' && !selected) select('F12', { scroll: false });
    apply();
  }));
  on(explodeBtn, 'click', () => {
    exploded = !exploded;
    explodeBtn.setAttribute('aria-pressed', String(exploded));
    viewer.tween(viewer.state, 'explode', exploded ? 1 : 0, 1100, () => viewer.applyState());
    apply();
  });
  on(basementBtn, 'click', () => toggleBasement(!basement));
  on(q('[data-reset]'), 'click', () => select(null));

  // ---- hover / click / drag on the model ----
  let hoverLevel = null, downAt = null, drag = null;
  on(canvas, 'pointermove', (e) => {
    const l = viewer.pick(e.clientX, e.clientY);
    if (l !== hoverLevel) { hoverLevel = l; viewer.setHover(l); canvas.style.cursor = l ? 'pointer' : 'crosshair'; if (hoverName) hoverName.textContent = l ? levelLabel(l) : ''; }
    if (!drag || mode === 'plan') return;
    const dx = (e.clientX - drag.x) / canvas.clientWidth;
    if (Math.abs(dx) < 0.002) return;
    const look = mode === 'floor' && selected ? floorCam(selected).look : towerCam().look;
    const vx = drag.cam.x - look[0], vz = drag.cam.z - look[2];
    const a = -dx * Math.PI * 1.2, cos = Math.cos(a), sin = Math.sin(a);
    viewer.goTo([look[0] + vx * cos - vz * sin, drag.cam.y, look[2] + vx * sin + vz * cos], look);
  });
  on(canvas, 'pointerleave', () => { hoverLevel = null; viewer.setHover(null); if (hoverName) hoverName.textContent = ''; });
  on(canvas, 'pointerdown', (e) => { downAt = [e.clientX, e.clientY]; drag = { x: e.clientX, y: e.clientY, cam: viewer.camTarget.clone() }; canvas.setPointerCapture(e.pointerId); });
  on(canvas, 'pointerup', (e) => {
    drag = null;
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const l = viewer.pick(e.clientX, e.clientY);
    if (l) select(l); else if (mode === 'tower') select(null);
  });
  on(window, 'pointerup', () => { drag = null; });

  // ---- floor cards (rendered by React) ----
  qa('.fcard').forEach((el) => on(el, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }));
  qa('.fcard').forEach((el) => on(el, 'click', (e) => {
    const level = el.dataset.level;
    const t = e.target.closest('[data-plan],[data-fl],a');
    if (t?.dataset.plan) { e.stopPropagation(); mode = 'plan'; select(level, { scroll: false }); return; }
    if (t?.dataset.fl) { e.stopPropagation(); mode = 'floor'; select(level, { scroll: false }); return; }
    if (t?.tagName === 'A') return;
    if (selected === level) { if (mode === 'plan') return; select(null); }
    else { mode = mode === 'plan' ? 'plan' : 'floor'; select(level, { scroll: false }); }
  }));

  // ---- load ----
  const prog = q('.vprogress'), bar = q('.vprogress i');
  let alive = true;
  viewer.load((e) => { if (e.total && bar) bar.style.width = Math.round((e.loaded / e.total) * 100) + '%'; })
    .then(() => { if (!alive) return; bar.style.width = '100%'; prog.classList.add('done'); viewer.loadDetail(); apply(); })
    .catch((err) => console.error(err));
  apply();
  const c0 = towerCam(); viewer.goTo(c0.cam, c0.look, { now: true });

  const deep = new URLSearchParams(location.search).get('floor');
  if (deep && LEVEL_Y[deep] !== undefined) select(deep, { scroll: false });

  return () => { alive = false; offs.forEach((f) => f()); viewer.dispose(); };
}
