// Scroll-driven tour for the home page. The stage is a full-screen three.js scene with the
// tower in its setting (lib/stage.js); each section maps to a camera keyframe in the model's
// metre frame, and the camera, floor focus, callout and day/night state are interpolated from
// scroll position. The Location panel carries its own MapLibre map of Mahim (lib/map.js).
// On phones the first screen is the tower full-bleed; scrolling folds it into a strip at the
// top of the screen and the tour panels run beneath it.
// initTour() runs after the DOM is mounted and returns a cleanup function.
import { CENTER, LEVEL_Y } from './scene.js';
import { createTowerStage } from './stage.js';

export function initTour() {
  const stageEl = document.getElementById('stage');
  const narrowMQ = matchMedia('(max-width: 820px)');
  let narrow = narrowMQ.matches;   // follows resizes / rotation across the breakpoint
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = createTowerStage(stageEl, { narrow });
  if (typeof window !== 'undefined') window.__stage = stage; // debugging aid

  const cx = CENTER.x, cz = CENTER.z;
  // Model frame: -X points west to Mahim Bay, +X east to SVS Road, +Z (the flat south face
  // between the two curved glass bays) to the cross street. Each section frames a part of the
  // tower (focus = floor kept solid, slice = floors above it hidden) and may pin a callout to it.
  const F = 'F12', fy = LEVEL_Y[F], G = LEVEL_Y.G, T = LEVEL_Y.T, f20 = LEVEL_Y.F20;
  const S = .2;   // desktop: the look point sits at 70% of the width, beside the 40% panel
  const y3 = LEVEL_Y.F03;
  const KEYS = {
    // street level, up the street that runs to the south face, as in the brochure day render
    cover:     { cam: [cx + 1.5, 1.7, cz + 168], look: [cx + 1, 37.5, cz] },
    // the brochure aerial: high over the junction, the beach and the bay behind the tower
    intro:     { cam: [cx + 125, 150, cz + 135], look: [cx - 14, 22, cz], tag: { at: [cx, T + 5, cz + 5], text: 'G + 22 storeys · 69 m' } },
    // a high floor's curved glass bay with the sea beyond it
    compare:   { cam: [cx + 52, f20 + 12, cz + 58], look: [cx - 6, f20 + 1, cz + 3], focus: 'F20', tag: { at: [cx + 9, f20 + 1.5, cz + 6], text: '20th floor · sea-facing bay' } },
    // pulled right back: the plot, SVS Road, the beach and Mahim Bay
    location:  { cam: [cx + 270, 230, cz + 70], look: [cx - 70, 0, cz], tag: { at: [cx - 190, 1, cz - 10], text: 'Arabian Sea · Mahim Bay' } },
    // residences: the camera comes in close to the sliced plate so one floor reads as one home
    floor:     { cam: [cx + 26, fy + 24, cz - 34], look: [cx, fy + 1.5, cz + 2], focus: F, slice: true, tag: { at: [cx + 10, fy + 3, cz + 4], text: '12th floor · one flat, one floor' } },
    plan:      { cam: [cx + .5, fy + 34, cz - 2], look: [cx, fy + 1, cz], focus: F, slice: true },
    lobby:     { cam: [cx + 16, G + 12, cz + 26], look: [cx + 4, G + 1.5, cz + 2], focus: 'G', slice: true, tag: { at: [cx + 4, G + 2.5, cz + 2], text: 'Entrance lobby' } },
    living:    { cam: [cx + 4, fy + 17, cz - 26], look: [cx, fy + 1, cz + 3], focus: F, slice: true, tag: { at: [cx, fy + 1.5, cz + 4], text: 'Living & dining' } },
    bedroom:   { cam: [cx - 8, fy + 16, cz - 25], look: [cx - 2, fy + 1, cz - 2], focus: F, slice: true, tag: { at: [cx - 4, fy + 1.5, cz - 1], text: 'Bedroom wing' } },
    kitchen:   { cam: [cx - 25, fy + 13, cz - 10], look: [cx - 9, fy + 1, cz], focus: F, slice: true, tag: { at: [cx - 9, fy + 1.5, cz + 1], text: 'Kitchen' } },
    namaz:     { cam: [cx + 25, fy + 13, cz - 8], look: [cx + 9, fy + 1, cz], focus: F, slice: true, tag: { at: [cx + 9, fy + 1.5, cz], text: 'Namaz room' } },
    // the roof from the south, as in the brochure rooftop render
    rooftop:   { cam: [cx + 4, T + 52, cz + 46], look: [cx, T, cz], focus: 'T', tag: { at: [cx + 10.5, T + 1, cz + 3], text: 'Rooftop pool' } },
    gallery:   { cam: [cx - 14, T + 20, cz + 22], look: [cx + 1, T + 1, cz], focus: 'T', tag: { at: [cx - 6, T + 1.5, cz + 2], text: 'Sky deck & café' } },
    amenities: { cam: [cx + 52, 5, cz + 62], look: [cx + 6, 9, cz + 4], tag: { at: [cx + 9, 4, cz + 5.5], text: 'Entrance off SVS Road' } },
    night:     { cam: [cx + 1.5, 1.7, cz + 168], look: [cx + 1, 37.5, cz], night: 1, tag: { at: [cx, T + 2, cz + 5], text: 'The crown, lit' } },
    contact:   { cam: [cx + 150, 60, cz + 210], look: [cx - 20, 30, cz], night: 1 },
  };
  // Close-ups for a specific amenity or room, applied while an element with data-view is
  // hovered / focused / tapped (see bindViews below). They override the section keyframe.
  const VIEWS = {
    terrace:  { cam: [cx + 14, T + 14, cz - 20], look: [cx, T + 1, cz], focus: 'T', slice: true },
    gym:      { cam: [cx + 22, y3 + 20, cz - 27], look: [cx, y3 + 1.5, cz], focus: 'F03', slice: true },
    pool:     { cam: [cx + 18, T + 16, cz + 14], look: [cx + 9, T, cz], focus: 'T', slice: true },
    cafe:     { cam: [cx + 24, T + 12, cz - 13], look: [cx + 8, T + 1, cz], focus: 'T', slice: true },
    lobby:    { cam: [cx + 16, G + 12, cz + 26], look: [cx + 4, G + 1.5, cz + 2], focus: 'G', slice: true },
    lifts:    { cam: [cx + 13, fy + 15, cz - 25], look: [cx + 5, fy + 1.5, cz - 2], focus: F, slice: true },
    cctv:     { cam: [cx + 40, 9, cz + 40], look: [cx + 6, 4, cz + 4] },
    garden:   { cam: [cx - 14, T + 13, cz - 20], look: [cx, T + 1, cz], focus: 'T', slice: true },
    sitout:   { cam: [cx + 18, T + 13, cz - 22], look: [cx + 4, T + 1, cz + 2], focus: 'T', slice: true },
    kitchen:  { cam: [cx - 25, fy + 13, cz - 10], look: [cx - 9, fy + 1, cz], focus: F, slice: true },
    refuge:   { cam: [cx + 24, LEVEL_Y.F14 + 12, cz - 10], look: [cx + 9, LEVEL_Y.F14 + 1, cz], focus: 'F14', slice: true },
  };
  // the stage lens (30°) is longer than the brochure-plan shots were set up for: pull the
  // cut-away (sliced) shots back so a whole plate stays in frame
  const pullBack = (k, f) => { k.cam = k.look.map((l, j) => l + (k.cam[j] - l) * f); };
  for (const k of [...Object.values(KEYS), ...Object.values(VIEWS)]) if (k.slice) pullBack(k, 1.35);
  // close-ups keep the plate nearer the middle of the stage (smaller view offset)
  for (const [id, k] of Object.entries(KEYS)) { k.shift = k.slice || ['rooftop', 'gallery'].includes(id) ? S * .55 : S; }

  const sections = [...document.querySelectorAll('main > section[id], main > footer[id]')];
  const keys = [];
  let prev = KEYS.cover;
  for (const s of sections) {
    const own = KEYS[s.id] || {};
    const k = Object.assign({}, prev, own);
    if (!own.cam) { k.cam = prev.cam; k.look = prev.look; }
    if (!('focus' in own)) { k.focus = null; k.slice = false; }
    if (!('night' in own)) k.night = 0;
    if (!('shift' in own)) k.shift = prev.shift || 0;
    if (!('tag' in own)) k.tag = null;
    keys.push(k);
    prev = k;
  }

  // ---------- scroll mapping ----------
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // Interpolate the camera on an arc around the (interpolated) look point: azimuth takes the
  // shortest way round, horizontal radius blends in log space (zooms feel even), height linearly.
  function orbitLerp(a, b, t) {
    const look = lerp3(a.look, b.look, t);
    const da = [a.cam[0] - a.look[0], a.cam[1] - a.look[1], a.cam[2] - a.look[2]];
    const db = [b.cam[0] - b.look[0], b.cam[1] - b.look[1], b.cam[2] - b.look[2]];
    const ra = Math.max(.1, Math.hypot(da[0], da[2])), rb = Math.max(.1, Math.hypot(db[0], db[2]));
    let aa = Math.atan2(da[2], da[0]), ab = Math.atan2(db[2], db[0]);
    if (ab - aa > Math.PI) ab -= 2 * Math.PI; else if (aa - ab > Math.PI) ab += 2 * Math.PI;
    const ang = lerp(aa, ab, t), r = Math.exp(lerp(Math.log(ra), Math.log(rb), t)), h = lerp(da[1], db[1], t) * (r / lerp(ra, rb, t));
    return { look, cam: [look[0] + Math.cos(ang) * r, look[1] + h, look[2] + Math.sin(ang) * r] };
  }
  let lastFocus, lastSlice = false, lastCtx = true, lastNight = -1, current = -1, orbitT = 0, desired = null, override = null, shift = 0, shiftY = 0, tag = null;
  const hint = document.querySelector('.hint');
  const callout = document.querySelector('.callout');
  const calloutText = callout?.querySelector('span');

  // phones: the stage is full-bleed on the cover and folds into a strip as the cover scrolls away
  const nav = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
  const cover = document.getElementById('cover');
  let vis = innerHeight, fold = 0;   // visible height of the stage (from the top of the screen), cover fold progress
  function layoutStage() {
    if (!narrow) { vis = innerHeight; fold = 0; stageEl.style.clipPath = ''; stageEl.classList.remove('strip'); return; }
    const strip = nav() + Math.round(innerHeight * 0.44);
    const coverH = cover ? cover.offsetHeight : innerHeight;
    const p = Math.max(0, Math.min(1, scrollY / Math.max(1, coverH - strip)));
    fold = p;
    vis = Math.round(lerp(innerHeight, strip, smooth(p)));
    stageEl.style.clipPath = `inset(0 0 ${innerHeight - vis}px 0)`;
    stageEl.classList.toggle('strip', p >= 1);
    document.documentElement.style.setProperty('--stage-vis', vis + 'px');
  }

  const centers = () => sections.map((s) => { const r = s.getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
  let C = centers();
  // pull the camera back as the visible stage gets squarer / taller so the framed part still fits
  const perspScale = () => {
    const h = narrow ? Math.max(1, vis - nav()) : stageEl.clientHeight;
    const a = stageEl.clientWidth / Math.max(1, h);
    return a < 0.6 ? 1.75 : a < 0.8 ? 1.5 : a < 1.1 ? 1.28 : a < 1.4 ? 1.12 : 1;
  };

  function update() {
    layoutStage();
    // the reading line: the middle of the screen, or of the part below the strip on phones
    const y = scrollY + (narrow ? lerp(innerHeight / 2, (vis + innerHeight) / 2, fold) : innerHeight / 2);
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
      recentre = true;   // ease any drag offset back to the framed shot
      setTag(near.tag);
    }
    // the callout only shows once the camera has (nearly) settled on a keyframe
    callout?.classList.toggle('on', !!tag && !override && (t < .22 || t > .78));
    if (!override && (near.focus !== lastFocus || !!near.slice !== lastSlice)) { lastFocus = near.focus; lastSlice = !!near.slice; stage.setFocus(near.focus, !!near.slice); }
    // neighbours and trees step back once a floor or amenity is in focus
    const focused = !!(override ? override.focus : near.focus);
    if (focused === lastCtx) { lastCtx = !focused; stage.setContext(!focused); }
    const night = lerp(a.night, b.night, e);
    if (Math.abs(night - lastNight) > 0.01) { lastNight = night; stage.setNight(night); document.body.classList.toggle('night', night > 0.5); }
    shift = narrow ? 0 : lerp(a.shift, b.shift, e);
    // phones: centre the look point in the visible part of the stage (below the nav)
    shiftY = narrow ? ((nav() + vis) / 2 - innerHeight / 2) / innerHeight - (current === 0 ? 0.1 * (vis / innerHeight) : 0) : 0;
    const scale = perspScale();
    let { cam, look } = orbitLerp(a, b, e);
    if (override) {
      ({ cam, look } = override);
      if (override.focus !== lastFocus || !!override.slice !== lastSlice) { lastFocus = override.focus; lastSlice = !!override.slice; stage.setFocus(override.focus, !!override.slice); }
    }
    const d = [cam[0] - look[0], cam[1] - look[1], cam[2] - look[2]];
    desired = { cam: [look[0] + d[0] * scale, look[1] + d[1] * scale, look[2] + d[2] * scale], look };
    kick();
  }

  function setTag(t) {
    tag = t || null;
    if (tag && calloutText) calloutText.textContent = tag.text;
  }

  // ---------- damped camera + gentle sway ----------
  const cur = { cam: null, look: null };
  let raf = 0, last = 0, immediate = true, recentre = false;
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!desired) return;
    if (!cur.cam || immediate) { cur.cam = desired.cam.slice(); cur.look = desired.look.slice(); immediate = false; }
    const k = 1 - Math.exp(-dt * 4.2);
    let busy = false;
    for (let j = 0; j < 3; j++) {
      cur.cam[j] = lerp(cur.cam[j], desired.cam[j], k);
      cur.look[j] = lerp(cur.look[j], desired.look[j], k);
      if (Math.abs(cur.cam[j] - desired.cam[j]) > 0.01 || Math.abs(cur.look[j] - desired.look[j]) > 0.01) busy = true;
    }
    // a section change eases any drag offset back to the framed shot
    const u = stage.user;
    if (recentre && !stage.dragging) {
      const kk = 1 - Math.exp(-dt * 2.5);
      u.yaw = lerp(u.yaw, 0, kk); u.pitch = lerp(u.pitch, 0, kk);
      if (Math.abs(u.yaw) < 1e-3 && Math.abs(u.pitch) < 1e-3) { u.yaw = u.pitch = 0; recentre = false; } else busy = true;
    }
    let cam = cur.cam;
    if (!reduced && !document.hidden && !stage.dragging) {   // slow sway around the look point
      orbitT += dt; busy = true;
      const ang = Math.sin(orbitT * 0.16) * 0.05;
      const [lx, , lz] = cur.look;
      const dx = cur.cam[0] - lx, dz = cur.cam[2] - lz;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      cam = [lx + dx * cos - dz * sin, cur.cam[1], lz + dx * sin + dz * cos];
    }
    stage.lookFrom(cam, cur.look, shift, shiftY);
    if (busy) kick();
  }
  // callout follows its anchor after every rendered frame
  stage.afterRender(() => {
    if (!callout || !tag) return;
    const p = stage.project(tag.at);
    callout.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    callout.classList.toggle('off', !p.visible || (narrow && p.y > vis - 10));
  });
  const onVisibility = () => { last = 0; kick(); };
  document.addEventListener('visibilitychange', onVisibility);
  stage.onUserMove = () => { recentre = false; hint?.classList.add('used'); };

  // ---------- amenity / room close-ups ----------
  const viewEls = [...document.querySelectorAll('[data-view]')];
  const coarse = matchMedia('(pointer: coarse)').matches;
  function clearViewMarks() { viewEls.forEach((el) => el.removeAttribute('data-view-active')); }
  function setView(name, el) {
    override = name && VIEWS[name] ? VIEWS[name] : null;
    clearViewMarks();
    if (override && el) el.setAttribute('data-view-active', '');
    if (override) recentre = true;
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

  // ---------- Location panel: its own map of Mahim, created when the panel comes near ----------
  const mapEl = document.getElementById('locmap');
  let mapStage = null, mapIO = null, alive = true;
  if (mapEl) {
    mapIO = new IntersectionObserver(async (es) => {
      if (!es.some((e) => e.isIntersecting) || mapStage) return;
      mapIO.disconnect();
      const { createMapStage } = await import('./map.js');
      if (!alive) return;
      mapStage = createMapStage(mapEl, { interactive: true, onView: (id, v) => dispatchEvent(new CustomEvent('sahil:view', { detail: { id, v } })) });
      mapStage.ready.then(() => mapEl.classList.add('ready'));
      mapStage.load().catch((err) => console.error(err));
    }, { rootMargin: '800px 0px' });
    mapIO.observe(mapEl);
  }
  const onMapRequest = (e) => {
    const { go, flyTo, resume } = e.detail || {};
    if (!mapStage) return;
    if (resume) { mapStage.go('plot'); dispatchEvent(new CustomEvent('sahil:view', { detail: { id: null } })); return; }
    if (go) mapStage.go(go); else if (flyTo) mapStage.flyTo(flyTo);
  };
  addEventListener('sahil:map', onMapRequest);

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } };
  const onResize = () => { narrow = narrowMQ.matches; C = centers(); update(); };
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
    document.body.dataset.section = id;
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
  stageEl.classList.add('ready');   // sky, sea and streets show at once; the tower arrives with the model
  stage.load((e) => {
    if (e.total && bar) { const p = Math.round((e.loaded / e.total) * 100); bar.style.width = p + '%'; note.textContent = `Loading 3D model ${p}%`; }
  }).then(() => {
    if (!alive) return;
    bar.style.width = '100%';
    document.querySelector('.loader')?.classList.add('done');
    note.textContent = 'Model loaded';
    note.classList.add('done');
    document.body.classList.add('model-ready');
    C = centers();
    update();
  }).catch((err) => { if (note) note.textContent = '3D model unavailable'; console.error(err); });

  update();
  hint?.classList.add('show');

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
    mapIO?.disconnect();
    mapStage?.dispose();
    if (rail) rail.innerHTML = '';
    document.body.classList.remove('night', 'model-ready');
    stage.dispose();
  };
}
