// Scroll-driven tour for the home page. The stage is the Mahim street map with the tower on
// its plot (lib/map.js); each section maps to a camera keyframe in the model's metre frame,
// and the map camera, floor focus and day/night state are interpolated from scroll position.
// initTour() runs after the DOM is mounted and returns a cleanup function.
import { CENTER, LEVEL_Y } from './scene.js';
import { createMapStage, VIEWS as MAP_VIEWS } from './map.js';

export function initTour() {
  const stageEl = document.getElementById('stage');
  const narrow = matchMedia('(max-width: 820px)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = createMapStage(stageEl, { onView: (id, v) => dispatchEvent(new CustomEvent('sahil:view', { detail: { id, v } })) });
  if (typeof window !== 'undefined') window.__stage = stage; // debugging aid

  const cx = CENTER.x, cz = CENTER.z;
  // Camera keyframes per section id, in the model frame (metres, Y up, +Z = sea side).
  // Each section highlights a part of the tower (focus = floor to keep solid, slice = hide
  // floors above it) and frames it; the map underneath always shows the plot and the water.
  const F = 'F12', fy = LEVEL_Y[F], G = LEVEL_Y.G, T = LEVEL_Y.T, f20 = LEVEL_Y.F20;
  const S = .2;   // view offset: the look point sits at 70% of the width, beside the 40% panel
  const y3 = LEVEL_Y.F03;
  // On the map the camera always sits well above its look point (pitch ≈ 55–65°) so the
  // streets and the water stay readable; the three.js-era near-horizontal shots are gone.
  const KEYS = {
    // The camera stays on the land side (-Z) looking out past the tower to Mahim Bay, so the
    // water is in frame throughout; only "compare" looks back at the sea-facing bay from the water.
    cover:     { cam: [cx + 110, 130, cz - 160], look: [cx, 20, cz + 30] },
    intro:     { cam: [cx + 95, 125, cz - 135], look: [cx, 30, cz + 20] },
    compare:   { cam: [cx - 10, f20 + 32, cz + 62], look: [cx, f20 + 1, cz], focus: 'F20' },   // a high floor seen from the water
    location:  { cam: [cx + 90, 160, cz - 230], look: [cx, 5, cz + 40] },                  // pulled back: the plot, the road, the shoreline
    // residences: the camera comes in close to the sliced plate so one floor reads as one home
    floor:     { cam: [cx + 26, fy + 24, cz - 34], look: [cx, fy + 1.5, cz + 2], focus: F, slice: true },
    plan:      { cam: [cx + .5, fy + 32, cz - 2], look: [cx, fy + 1, cz], focus: F, slice: true },
    lobby:     { cam: [cx + 13, G + 14, cz - 22], look: [cx + 4, G + 1.5, cz - 1], focus: 'G', slice: true },
    living:    { cam: [cx + 4, fy + 17, cz - 26], look: [cx, fy + 1, cz + 3], focus: F, slice: true },   // across the plate to the sea-facing bay
    bedroom:   { cam: [cx - 8, fy + 16, cz - 25], look: [cx - 2, fy + 1, cz - 2], focus: F, slice: true },
    kitchen:   { cam: [cx - 25, fy + 13, cz - 10], look: [cx - 9, fy + 1, cz], focus: F, slice: true },
    namaz:     { cam: [cx + 25, fy + 13, cz - 8], look: [cx + 9, fy + 1, cz], focus: F, slice: true },
    rooftop:   { cam: [cx + 22, T + 24, cz - 30], look: [cx, T, cz + 2], focus: 'T' },
    gallery:   { cam: [cx + 13, T + 14, cz - 19], look: [cx, T + 1, cz + 2], focus: 'T' },
    amenities: { cam: [cx + 30, G + 40, cz - 50], look: [cx, G + 4, cz + 4], focus: 'G' },
    night:     { cam: [cx + 58, 100, cz - 105], look: [cx, 30, cz + 10], night: 1 },
    contact:   { cam: [cx + 58, 100, cz - 105], look: [cx, 30, cz + 10], night: 1 },
  };
  // Close-ups for a specific amenity or room, applied while an element with data-view is
  // hovered / focused / tapped (see bindViews below). They override the section keyframe.
  const VIEWS = {
    terrace:  { cam: [cx + 14, T + 14, cz - 20], look: [cx, T + 1, cz], focus: 'T', slice: true },
    gym:      { cam: [cx + 22, y3 + 20, cz - 27], look: [cx, y3 + 1.5, cz], focus: 'F03', slice: true },
    pool:     { cam: [cx + 5, T + 19, cz - 9], look: [cx, T, cz], focus: 'T', slice: true },
    cafe:     { cam: [cx + 24, T + 12, cz - 13], look: [cx + 8, T + 1, cz], focus: 'T', slice: true },
    lobby:    { cam: [cx + 13, G + 14, cz - 22], look: [cx + 4, G + 1.5, cz - 1], focus: 'G', slice: true },
    lifts:    { cam: [cx + 13, fy + 15, cz - 25], look: [cx + 5, fy + 1.5, cz - 2], focus: F, slice: true },
    cctv:     { cam: [cx + 22, G + 20, cz - 30], look: [cx, G + 2, cz], focus: 'G', slice: true },
    garden:   { cam: [cx - 14, T + 13, cz - 20], look: [cx, T + 1, cz], focus: 'T', slice: true },
    sitout:   { cam: [cx + 18, T + 13, cz - 22], look: [cx + 4, T + 1, cz + 2], focus: 'T', slice: true },
    kitchen:  { cam: [cx - 25, fy + 13, cz - 10], look: [cx - 9, fy + 1, cz], focus: F, slice: true },
    refuge:   { cam: [cx + 24, LEVEL_Y.F14 + 12, cz - 10], look: [cx + 9, LEVEL_Y.F14 + 1, cz], focus: 'F14', slice: true },
  };
  // close-ups keep the plate nearer the middle of the stage (smaller view offset)
  for (const [id, k] of Object.entries(KEYS)) { k.shift = k.slice || ['rooftop', 'gallery'].includes(id) ? S * .55 : S; }

  const sections = [...document.querySelectorAll('main > section[id], main > footer[id]')];
  const keys = [];
  let prev = KEYS.cover;
  for (const s of sections) {
    const k = Object.assign({}, prev, KEYS[s.id] || {});
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
  let lastFocus, lastSlice = false, lastNight = -1, current = -1, orbitT = 0, desired = null, override = null, manual = false, shift = 0;
  const hint = document.querySelector('.hint');

  const centers = () => sections.map((s) => { const r = s.getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
  let C = centers();
  // pull the camera back as the stage gets squarer / taller so the framed part still fits
  const perspScale = () => { const a = stageEl.clientWidth / Math.max(1, stageEl.clientHeight); return a < 0.8 ? 1.5 : a < 1.1 ? 1.28 : a < 1.4 ? 1.12 : 1; };

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
    if (idx !== current) {
      current = idx; setRail(sections[idx].id);
      if (override) { override = null; clearViewMarks(); }
      if (manual) { manual = false; stage.clearDest(); dispatchEvent(new CustomEvent('sahil:view', { detail: { id: null } })); }
      stage.setPin(sections[idx].id === 'location' || idx < 2);
    }
    if (!override && (near.focus !== lastFocus || !!near.slice !== lastSlice)) { lastFocus = near.focus; lastSlice = !!near.slice; stage.setFocus(near.focus, !!near.slice); }
    const night = lerp(a.night, b.night, e);
    if (Math.abs(night - lastNight) > 0.01) { lastNight = night; stage.setNight(night); document.body.classList.toggle('night', night > 0.5); }
    shift = narrow ? 0 : lerp(a.shift, b.shift, e);
    const scale = perspScale();
    let { cam, look } = orbitLerp(a, b, e);
    if (override) {
      ({ cam, look } = override);
      if (override.focus !== lastFocus || !!override.slice !== lastSlice) { lastFocus = override.focus; lastSlice = !!override.slice; stage.setFocus(override.focus, !!override.slice); }
    }
    const d = [cam[0] - look[0], cam[1] - look[1], cam[2] - look[2]];
    desired = { cam: [look[0] + d[0] * scale, look[1] + d[1] * scale, look[2] + d[2] * scale], look };
    hint?.classList.toggle('show', !narrow && !manual);
    kick();
  }

  // ---------- damped camera + gentle orbit (drives the map) ----------
  const cur = { cam: null, look: null };
  let raf = 0, last = 0, immediate = true;
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!desired || manual) return;
    if (!cur.cam || immediate) { cur.cam = desired.cam.slice(); cur.look = desired.look.slice(); immediate = false; }
    const k = 1 - Math.exp(-dt * 5.5);
    let busy = false;
    for (let j = 0; j < 3; j++) {
      cur.cam[j] = lerp(cur.cam[j], desired.cam[j], k);
      cur.look[j] = lerp(cur.look[j], desired.look[j], k);
      if (Math.abs(cur.cam[j] - desired.cam[j]) > 0.01 || Math.abs(cur.look[j] - desired.look[j]) > 0.01) busy = true;
    }
    let cam = cur.cam;
    if (!reduced && !document.hidden) {   // slow sway around the look point
      orbitT += dt; busy = true;
      const ang = Math.sin(orbitT * 0.18) * 0.035;
      const [lx, , lz] = cur.look;
      const dx = cur.cam[0] - lx, dz = cur.cam[2] - lz;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      cam = [lx + dx * cos - dz * sin, cur.cam[1], lz + dx * sin + dz * cos];
    }
    stage.lookFrom(cam, cur.look, shift);
    if (busy) kick();
  }
  const onVisibility = () => { last = 0; kick(); };
  document.addEventListener('visibilitychange', onVisibility);

  // ---------- amenity / room close-ups ----------
  const viewEls = [...document.querySelectorAll('[data-view]')];
  const coarse = matchMedia('(pointer: coarse)').matches;
  function clearViewMarks() { viewEls.forEach((el) => el.removeAttribute('data-view-active')); }
  function setView(name, el) {
    override = name && VIEWS[name] ? VIEWS[name] : null;
    clearViewMarks();
    if (override && el) el.setAttribute('data-view-active', '');
    update();
  }
  const viewOffs = [];
  for (const el of viewEls) {
    const name = el.dataset.view;
    const enter = () => setView(name, el), leave = () => { if (override === VIEWS[name]) setView(null); };
    const tap = (e) => { if (!coarse) return; e.preventDefault(); override === VIEWS[name] ? setView(null) : setView(name, el); };
    el.addEventListener('pointerenter', enter); el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', enter); el.addEventListener('focusout', leave);
    el.addEventListener('click', tap);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    viewOffs.push(() => { el.removeEventListener('pointerenter', enter); el.removeEventListener('pointerleave', leave); el.removeEventListener('focusin', enter); el.removeEventListener('focusout', leave); el.removeEventListener('click', tap); });
  }

  // ---------- Location panel: named map views and drive-time destinations ----------
  // While one is active the scroll keyframes pause; scrolling to another section resumes them.
  const onMapRequest = (e) => {
    const { go, flyTo, resume } = e.detail || {};
    if (resume) { manual = false; stage.clearDest(); immediate = true; dispatchEvent(new CustomEvent('sahil:view', { detail: { id: null } })); update(); return; }
    manual = true; immediate = true;
    if (go) stage.go(go); else if (flyTo) stage.flyTo(flyTo);
    hint?.classList.remove('show');
  };
  addEventListener('sahil:map', onMapRequest);

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
  stage.ready.then(() => { if (alive) { stageEl.classList.add('ready'); immediate = true; update(); } });
  stage.load((e) => {
    if (e.total && bar) { const p = Math.round((e.loaded / e.total) * 100); bar.style.width = p + '%'; note.textContent = `Loading 3D model ${p}%`; }
  }).then(() => {
    if (!alive) return;
    bar.style.width = '100%';
    document.querySelector('.loader')?.classList.add('done');
    note.textContent = 'Model loaded';
    note.classList.add('done');
    C = centers();
    update();
  }).catch((err) => { if (note) note.textContent = '3D model unavailable'; console.error(err); });

  update();

  return () => {
    alive = false;
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onResize);
    removeEventListener('sahil:map', onMapRequest);
    document.removeEventListener('visibilitychange', onVisibility);
    cancelAnimationFrame(raf);
    viewOffs.forEach((f) => f());
    mainRO.disconnect();
    io.disconnect();
    if (rail) rail.innerHTML = '';
    document.body.classList.remove('night');
    stage.dispose();
  };
}
