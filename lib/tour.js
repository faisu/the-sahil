// Scroll-driven tour for the home page. Each section maps to a camera keyframe; the camera,
// canvas opacity, floor focus and day/night state are interpolated from scroll position.
// initTour() runs after the DOM is mounted and returns a cleanup function.
import { createViewer, CENTER, LEVEL_Y } from './scene.js';

export function initTour() {
  const canvas = document.getElementById('stage');
  const narrow = matchMedia('(max-width: 820px)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const viewer = createViewer(canvas, { shadows: !narrow, dprMax: narrow ? 1.5 : 1.75 });
  if (typeof window !== 'undefined') window.__viewer = viewer; // debugging aid

  const cx = CENTER.x, cz = CENTER.z;
  // Camera keyframes per section id. Missing ids fall back to the previous one with alpha 0.
  // One keyframe per section. The model never fades out: each section highlights a part of
  // the tower (focus = floor to keep solid, slice = hide floors above it) and frames it.
  const F = 'F12', fy = LEVEL_Y[F], G = LEVEL_Y.G, T = LEVEL_Y.T, f20 = LEVEL_Y.F20;
  const S = .2;   // constant view offset: the look point sits at 70% of the width, beside the 40% panel
  const KEYS = {
    cover:     { cam: [cx + 70, 28, cz + 150], look: [cx, 32, cz] },
    intro:     { cam: [cx + 70, 16, cz + 118], look: [cx, 34, cz] },
    compare:   { cam: [cx - 10, f20 + 2, cz + 62], look: [cx, f20 + 1, cz], focus: 'F20' },
    location:  { cam: [cx + 60, 150, cz + 100], look: [cx, 24, cz] },
    floor:     { cam: [cx + 34, fy + 26, cz + 44], look: [cx, fy + 1.5, cz], focus: F, slice: true },
    plan:      { cam: [cx + .5, fy + 31, cz + 8.5], look: [cx, fy + 1, cz], focus: F, slice: true },
    lobby:     { cam: [cx + 24, G + 7, cz + 42], look: [cx, G + 3, cz], focus: 'G' },
    living:    { cam: [cx + 6, fy + 24, cz + 42], look: [cx, fy + 1, cz + 2], focus: F, slice: true },
    bedroom:   { cam: [cx - 10, fy + 22, cz - 38], look: [cx, fy + 1, cz - 1], focus: F, slice: true },
    kitchen:   { cam: [cx - 30, fy + 16, cz + 16], look: [cx - 6, fy + 1, cz + 1], focus: F, slice: true },
    namaz:     { cam: [cx + 30, fy + 16, cz + 14], look: [cx + 6, fy + 1, cz], focus: F, slice: true },
    rooftop:   { cam: [cx + 30, T + 31, cz + 42], look: [cx, T - 1, cz] },
    gallery:   { cam: [cx + 18, T + 18, cz + 26], look: [cx, T + 1, cz], focus: 'T' },
    amenities: { cam: [cx + 40, G + 18, cz + 72], look: [cx, G + 8, cz], focus: 'G' },
    night:     { cam: [cx + 58, 14, cz + 105], look: [cx, 38, cz], night: 1 },
    contact:   { cam: [cx + 58, 14, cz + 105], look: [cx, 38, cz], night: 1 },
  };
  for (const k of Object.values(KEYS)) { k.alpha = 1; k.shift = S; }



  const sections = [...document.querySelectorAll('main > section[id], main > footer[id]')];
  const keys = [];
  let prev = KEYS.cover;
  for (const s of sections) {
    const k = Object.assign({}, prev, { alpha: 0 }, KEYS[s.id] || {});
    if (!KEYS[s.id] || !KEYS[s.id].cam) { k.cam = prev.cam; k.look = prev.look; }
    if (!('focus' in (KEYS[s.id] || {}))) { k.focus = null; k.slice = false; }
    if (!('night' in (KEYS[s.id] || {}))) k.night = 0;
    if (!('shift' in (KEYS[s.id] || {}))) k.shift = prev.shift || 0;
    keys.push(k);
    prev = k;
  }

  // ---------- scroll mapping ----------
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // Interpolate the camera on an arc around the (interpolated) look point: azimuth takes the
  // shortest way round, horizontal radius and height blend linearly.
  function orbitLerp(a, b, t) {
    const look = lerp3(a.look, b.look, t);
    const da = [a.cam[0] - a.look[0], a.cam[1] - a.look[1], a.cam[2] - a.look[2]];
    const db = [b.cam[0] - b.look[0], b.cam[1] - b.look[1], b.cam[2] - b.look[2]];
    const ra = Math.hypot(da[0], da[2]), rb = Math.hypot(db[0], db[2]);
    let aa = Math.atan2(da[2], da[0]), ab = Math.atan2(db[2], db[0]);
    if (ab - aa > Math.PI) ab -= 2 * Math.PI; else if (aa - ab > Math.PI) ab += 2 * Math.PI;
    const ang = lerp(aa, ab, t), r = lerp(ra, rb, t), h = lerp(da[1], db[1], t);
    return { look, cam: [look[0] + Math.cos(ang) * r, look[1] + h, look[2] + Math.sin(ang) * r] };
  }
  let lastFocus, lastNight = -1, current = -1, orbitT = 0, desired = null;
  const hint = document.querySelector('.hint');

  const centers = () => sections.map((s) => { const r = s.getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
  let C = centers();
  // pull the camera back as the canvas gets squarer / taller so the framed part still fits
  const perspScale = () => { const a = canvas.clientWidth / Math.max(1, canvas.clientHeight); return a < 0.8 ? 1.5 : a < 1.1 ? 1.28 : a < 1.4 ? 1.12 : 1; };

  function update() {
    const y = scrollY + innerHeight / 2;
    let i = 0;
    while (i < C.length - 1 && y > C[i + 1]) i++;
    let t = i < C.length - 1 ? (y - C[i]) / (C[i + 1] - C[i]) : 0;
    t = Math.max(0, Math.min(1, t));
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
    const e = smooth(t);
    const near = t < .5 ? a : b;
    const idx = t < .5 ? i : Math.min(i + 1, keys.length - 1);
    if (near.focus !== lastFocus) { lastFocus = near.focus; viewer.setFocus(near.focus, !!near.slice); }
    const alpha = lerp(a.alpha, b.alpha, e);
    canvas.style.opacity = alpha.toFixed(3);
    viewer.setActive(alpha > 0.02);
    const night = lerp(a.night, b.night, e);
    if (Math.abs(night - lastNight) > 0.01) { lastNight = night; viewer.setNight(night); document.body.classList.toggle('night', night > 0.5); }
    viewer.setShift(narrow ? 0 : lerp(a.shift, b.shift, e));
    const scale = perspScale();
    const { cam, look } = orbitLerp(a, b, e);
    const d = [cam[0] - look[0], cam[1] - look[1], cam[2] - look[2]];
    const camS = [look[0] + d[0] * scale, look[1] + d[1] * scale, look[2] + d[2] * scale];
    desired = { cam: camS, look };
    viewer.goTo(camS, look);
    if (idx !== current) { current = idx; setRail(sections[idx].id); }
    hint?.classList.toggle('show', alpha > .5 && !narrow);
  }

  // gentle orbit while the 3D stage is visible
  if (!reduced) {
    viewer.addHook((dt) => {
      if (!desired || parseFloat(canvas.style.opacity) < 0.02) return false;
      orbitT += dt;
      const ang = Math.sin(orbitT * 0.18) * 0.035;
      const [lx, , lz] = desired.look;
      const dx = desired.cam[0] - lx, dz = desired.cam[2] - lz;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      viewer.camTarget.set(lx + dx * cos - dz * sin, desired.cam[1], lz + dx * sin + dz * cos);
      return true;
    });
  }

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } };
  const onResize = () => { C = centers(); update(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);
  const mainRO = new ResizeObserver(onResize);   // section heights change as images/fonts arrive
  mainRO.observe(document.querySelector('main'));

  // ---------- rail + nav current ----------
  const rail = document.querySelector('.rail');
  const navLinks = [...document.querySelectorAll('.nav a[href*="#"]')];
  function setRail(id) {
    rail?.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + id));
    const navId = sections.find((s) => s.id === id)?.dataset.nav || id;
    navLinks.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href').endsWith('#' + navId)));
  }
  if (rail) {
    rail.innerHTML = '';
    for (const s of sections) {
      if (!s.dataset.title) continue;
      const a = document.createElement('a');
      a.href = '#' + s.id;
      a.innerHTML = `<span>${s.dataset.title}</span>`;
      rail.appendChild(a);
    }
  }

  // ---------- reveal on scroll ----------
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  document.querySelectorAll('.reveal, .feature').forEach((el) => io.observe(el));

  // ---------- load ----------
  const bar = document.querySelector('.loader i');
  const note = document.querySelector('.load-note');
  let alive = true;
  viewer.load((e) => {
    if (e.total && bar) { const p = Math.round((e.loaded / e.total) * 100); bar.style.width = p + '%'; note.textContent = `Loading 3D model ${p}%`; }
  }).then(() => {
    if (!alive) return;
    bar.style.width = '100%';
    document.querySelector('.loader')?.classList.add('done');
    note.textContent = 'Model loaded';
    note.classList.add('done');
    C = centers();
    update();
    viewer.goTo(desired.cam, desired.look, { now: true });
  }).catch((err) => { if (note) note.textContent = '3D model unavailable'; console.error(err); });

  update();
  viewer.goTo(desired.cam, desired.look, { now: true });

  return () => {
    alive = false;
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onResize);
    mainRO.disconnect();
    io.disconnect();
    if (rail) rail.innerHTML = '';
    document.body.classList.remove('night');
    viewer.dispose();
  };
}
