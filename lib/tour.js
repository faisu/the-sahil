// Scroll-driven virtual tour of the whole project. Two stages share one camera path in the
// model's metre frame:
//   - the real map of Mahim (lib/map.js: MapLibre with the tower on its plot) for the exterior
//     and aerial shots, the location and the night view;
//   - the 3D world (lib/stage.js: the tower with furnished interiors in its setting) for the
//     lobby, the cut-away floor, the walk through the residence, the gym and the rooftop.
// Each section maps to a keyframe; camera, floor focus, callout, stage cross-fade and day/night
// are interpolated from scroll position. Eye-level ("walk") keyframes glide in straight lines and
// hop outside the façade when they change floors. On phones the first screen is the model
// full-bleed; scrolling folds it into a strip at the top and the tour panels run beneath it.
// initTour() runs after the DOM is mounted and returns a cleanup function.
import { CENTER, LEVEL_Y } from './scene.js';
import { createTowerStage } from './stage.js';
import { createMapStage } from './map.js';

// brochure floor plan pixel -> model metres (same registration as lib/interiors.js)
const PX = (px) => 16.88 + (px - 585) / 37;
const PZ = (py) => 3.35 + (py - 55) / 37;

export function initTour() {
  const stageEl = document.getElementById('stage');
  const mapEl = document.getElementById('map');
  const narrowMQ = matchMedia('(max-width: 820px)');
  let narrow = narrowMQ.matches;   // follows resizes / rotation across the breakpoint
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = createTowerStage(stageEl, { narrow });
  const mapStage = createMapStage(mapEl, { onView: (id, v) => dispatchEvent(new CustomEvent('sahil:view', { detail: { id, v } })) });
  // debugging aids (window.__tour.settled is true once the camera has reached its keyframe)
  let settled = false;
  if (typeof window !== 'undefined') { window.__stage = stage; window.__mapStage = mapStage; window.__tour = { get settled() { return settled; }, get section() { return current >= 0 ? sections[current].id : null; } }; }

  const cx = CENTER.x, cz = CENTER.z;
  const G = LEVEL_Y.G, T = LEVEL_Y.T, F = 'F12', fy = LEVEL_Y[F], f20 = LEVEL_Y.F20, y3 = LEVEL_Y.F03;
  const eye = 1.6;
  const S = .2;   // desktop: the look point sits right of centre, beside the panel
  // mode: 'map' (real map) or '3d' (furnished model in its setting). walk = eye level inside.
  const KEYS = {
    // ---- the real map: arrival, the tower on SVS Road, the sea, the neighbourhood ----
    cover:     { mode: 'map', cam: [cx + 125, 62, cz + 150], look: [cx + 2, 30, cz] },
    intro:     { mode: 'map', cam: [cx + 125, 150, cz + 135], look: [cx - 14, 22, cz] },
    compare:   { mode: 'map', cam: [cx + 58, f20 + 16, cz + 62], look: [cx - 8, f20, cz + 3] },
    location:  { mode: 'map', cam: [cx + 230, 170, cz + 90], look: [cx - 40, 5, cz] },
    // ---- into the 3D model: the lobby, the cut-away residence, then a walk through it ----
    lobby:     { mode: '3d', walk: true, focus: 'G', cam: [17.3, G + 1.6, 11.9], look: [15.2, G + 1.2, 8.2], exit: [17.3, G + 2.1, 22], tag: { at: [15.2, G + 1.2, 8.8], text: 'Reception · entrance lobby' } },
    floor:     { mode: '3d', focus: F, slice: true, cam: [cx + 2, fy + 25, cz + 19], look: [cx, fy, cz + 1], tag: { at: [PX(434), fy + .8, PZ(290)], text: '12th floor · one flat, one floor' } },
    plan:      { mode: '3d', focus: F, slice: true, cam: [cx, fy + 34, cz + 4.5], look: [cx, fy, cz + .4] },
    living:    { mode: '3d', walk: true, focus: F, cam: [PX(486), fy + 1.7, PZ(196)], look: [PX(330), fy + 1.0, PZ(372)], tag: { at: [PX(430), fy + .8, PZ(300)], text: 'Living · dining for eight' } },
    kitchen:   { mode: '3d', walk: true, focus: F, cam: [PX(186), fy + 1.6, PZ(232)], look: [PX(70), fy + .9, PZ(335)], via: [[PX(330), fy + eye, PZ(205)], [PX(196), fy + 1.58, PZ(236)]], tag: { at: [PX(95), fy + 1.0, PZ(300)], text: 'Curved modular kitchen' } },
    bedroom:   { mode: '3d', walk: true, focus: F, cam: [PX(157), fy + eye, PZ(158)], look: [PX(60), fy + .95, PZ(96)], via: [[PX(196), fy + eye, PZ(236)], [PX(195), fy + eye, PZ(152)]], tag: { at: [PX(111), fy + .7, PZ(95)], text: 'Master bedroom' } },
    namaz:     { mode: '3d', walk: true, focus: F, fov: 80, cam: [PX(716), fy + 1.45, PZ(127)], look: [PX(667), fy + 1.35, PZ(95)], via: [[PX(195), fy + eye, PZ(152)], [PX(240), fy + eye, PZ(200)], [PX(480), fy + eye, PZ(205)], [PX(505), fy + eye, PZ(238)], [PX(700), fy + eye, PZ(238)], [PX(755), fy + eye, PZ(235)], [PX(755), fy + eye, PZ(150)], [PX(703), fy + 1.55, PZ(140)]], tag: { at: [PX(667), fy + 1.2, PZ(92)], text: 'Namaz room · facing the qibla' } },
    gym:       { mode: '3d', walk: true, focus: 'F03', cam: [PX(225), y3 + eye, PZ(296)], look: [PX(520), y3 + .9, PZ(325)], tag: { at: [PX(300), y3 + 1.0, PZ(338)], text: 'Fitness centre · 3rd floor' } },
    rooftop:   { mode: '3d', focus: 'T', cam: [cx + 5, T + 46, cz + 44], look: [cx, T, cz], tag: { at: [22.3, T + .6, 9.6], text: 'Rooftop pool' } },
    pool:      { mode: '3d', walk: true, focus: 'T', cam: [16.0, T + 2.1, 12.0], look: [23.0, T + .7, 7.6], tag: { at: [22.5, T + .55, 9.8], text: 'Swimming pool' } },
    cafe:      { mode: '3d', walk: true, focus: 'T', cam: [14.3, T + 1.7, 11.3], look: [11.6, T + 1.4, 8.8], tag: { at: [12.4, T + 1.1, 9.8], text: 'Open-to-sky café' } },
    terrace:   { mode: '3d', walk: true, focus: 'T', cam: [9.9, T + 1.7, 10.9], look: [4.0, T + .7, 8.2], tag: { at: [4.6, T + .8, 9.0], text: 'Sit-out deck' } },
    // ---- back out to the map: the street, the tower by night ----
    amenities: { mode: 'map', cam: [cx + 105, 45, cz + 120], look: [cx + 2, 22, cz] },
    night:     { mode: 'map', cam: [cx + 125, 62, cz + 150], look: [cx + 2, 30, cz], night: 1 },
    contact:   { mode: 'map', cam: [cx + 210, 140, cz + 230], look: [cx - 20, 20, cz], night: 1 },
  };
  // close-ups applied while an element with data-view is hovered / focused / tapped
  const VIEWS = {
    lobby: KEYS.lobby, kitchen: KEYS.kitchen, gym: KEYS.gym, pool: KEYS.pool, cafe: KEYS.cafe, terrace: KEYS.terrace, garden: KEYS.terrace, sitout: KEYS.terrace,
    lifts: { mode: '3d', walk: true, focus: F, cam: [PX(560), fy + eye, PZ(320)], look: [PX(545), fy + 1.4, PZ(150)] },
    cctv:  { mode: 'map', cam: [cx + 45, 14, cz + 50], look: [cx + 6, 5, cz + 4] },
  };
  for (const k of Object.values(KEYS)) k.shift = k.walk ? S * .8 : k.slice || k.focus === 'T' ? S * .55 : S;
  for (const k of Object.values(VIEWS)) if (k.shift === undefined) k.shift = k.walk ? S * .8 : S;

  const sections = [...document.querySelectorAll('main > section[id], main > footer[id]')];
  const DEF = { mode: '3d', walk: false, slice: false, focus: null, night: 0, tag: null };
  const keys = [];
  let prev = { ...DEF, ...KEYS.cover };
  for (const s of sections) {
    const own = KEYS[s.id];
    keys.push(own ? { ...DEF, ...own } : prev);   // a section without a keyframe holds the previous one
    prev = keys[keys.length - 1];
  }

  // ---------- interpolation ----------
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  // exterior moves: an arc around the (interpolated) look point, radius blended in log space
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
  // eye-level moves glide along a route: through the rooms' doors (b.via), or, between floors, out
  // through the south glass, up or down outside the façade and back in. Exterior <-> eye level:
  // back out of the room through the glass before orbiting away, dolly in through it on arrival.
  const SOUTH = 12.2;   // z of the flat south face (model metres)
  const exitPoint = (k) => k.exit || (k.focus === 'T' ? [k.cam[0], k.cam[1] + 6, k.cam[2] + 5] : [k.cam[0], k.cam[1] + .8, SOUTH + 9]);
  const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  /** Constant-speed travel along pts with a look target per vertex. */
  function route(pts, looks, t) {
    const seg = [], cum = [0];
    for (let i = 1; i < pts.length; i++) { seg.push(Math.hypot(...sub3(pts[i], pts[i - 1]))); cum.push(cum[i - 1] + seg[i - 1]); }
    const total = cum[cum.length - 1] || 1, s = t * total;
    let i = 0; while (i < seg.length - 1 && s > cum[i + 1]) i++;
    const u = seg[i] ? smooth(Math.max(0, Math.min(1, (s - cum[i]) / seg[i]))) : 1;
    return { cam: lerp3(pts[i], pts[i + 1], u), look: lerp3(looks[i], looks[i + 1], u) };
  }
  function walkLerp(a, b, t) {
    if (a.focus !== b.focus) { const Ea = exitPoint(a), Eb = exitPoint(b); return route([a.cam, Ea, Eb, b.cam], [a.look, a.look, b.look, b.look], t); }
    const pts = [a.cam, ...(b.via || []), b.cam];
    // at each waypoint look a few metres past the next one, so the head turns through the route
    const looks = pts.map((p, i) => (i === pts.length - 1 ? b.look : add3(pts[i + 1], norm3(sub3(pts[i + 1], p)), 3)));
    looks[0] = a.look;
    return route(pts, looks, t);
  }
  const SPLIT = .3;
  function mixedLerp(a, b, t) {
    if (a.walk) {   // back out to the exit point, then orbit on to b
      const E = exitPoint(a);
      if (t < SPLIT) return { cam: lerp3(a.cam, E, smooth(t / SPLIT)), look: a.look };
      return orbitLerp({ cam: E, look: a.look }, b, (t - SPLIT) / (1 - SPLIT));
    }
    const E = exitPoint(b);   // orbit to the entry point, then dolly in
    if (t < 1 - SPLIT) return orbitLerp(a, { cam: E, look: b.look }, t / (1 - SPLIT));
    return { cam: lerp3(E, b.cam, smooth((t - 1 + SPLIT) / SPLIT)), look: b.look };
  }
  const pathLerp = (a, b, t) => (a.walk && b.walk ? walkLerp(a, b, t) : a.walk || b.walk ? mixedLerp(a, b, t) : orbitLerp(a, b, t));

  let lastFocus, lastSlice = false, lastOpen = false, lastCtx = true, lastNight = -1, current = -1, orbitT = 0, desired = null, override = null, manual = false;
  let shift = 0, shiftY = 0, tag = null, mapMix = 1, walkNow = false, fovNow = 0, lastMix = -1, focusTarget = { focus: null, slice: false };
  const hint = document.querySelector('.hint');
  const callout = document.querySelector('.callout');
  const calloutText = callout?.querySelector('span');

  // phones: the stages are full-bleed on the cover and fold into a strip as the cover scrolls away
  const nav = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
  const cover = document.getElementById('cover');
  let vis = innerHeight, fold = 0;
  function layoutStage() {
    if (!narrow) { vis = innerHeight; fold = 0; stageEl.style.clipPath = mapEl.style.clipPath = ''; return; }
    const strip = nav() + Math.round(innerHeight * 0.44);
    const coverH = cover ? cover.offsetHeight : innerHeight;
    const p = Math.max(0, Math.min(1, scrollY / Math.max(1, coverH - strip)));
    fold = p;
    vis = Math.round(lerp(innerHeight, strip, smooth(p)));
    stageEl.style.clipPath = mapEl.style.clipPath = `inset(0 0 ${innerHeight - vis}px 0)`;
    document.documentElement.style.setProperty('--stage-vis', vis + 'px');
  }

  const centers = () => sections.map((s) => { const r = s.getBoundingClientRect(); return r.top + scrollY + r.height / 2; });
  let C = centers();
  const perspScale = () => {
    const h = narrow ? Math.max(1, vis - nav()) : innerHeight;
    const a = innerWidth / Math.max(1, h);
    return a < 0.6 ? 1.75 : a < 0.8 ? 1.5 : a < 1.1 ? 1.28 : a < 1.4 ? 1.12 : 1;
  };

  // which stage shows: cross-fade in the middle third of a map <-> 3D transition
  function stageMix(a, b, t) {
    const ma = a.mode === 'map' ? 1 : 0, mb = b.mode === 'map' ? 1 : 0;
    if (ma === mb) return ma;
    const u = Math.max(0, Math.min(1, (t - .35) / .3));
    return lerp(ma, mb, smooth(u));
  }
  function applyMix(m) {
    if (Math.abs(m - lastMix) < .002) return;
    lastMix = m;
    mapEl.style.opacity = m.toFixed(3);
    stageEl.style.opacity = (1 - m).toFixed(3);
    stageEl.style.pointerEvents = m > .5 ? 'none' : '';
    stage.setActive(m < .999);
    document.body.classList.toggle('on-map', m > .5);
  }

  function update() {
    layoutStage();
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
      if (manual) { manual = false; mapStage.clearDest(); dispatchEvent(new CustomEvent('sahil:view', { detail: { id: null } })); }
      mapStage.setPin(['cover', 'intro', 'location'].includes(sections[idx].id));
      recentre = true;
      setTag(near.tag);
    }
    const k = override || near;
    mapMix = override ? (override.mode === 'map' ? 1 : 0) : stageMix(a, b, t);
    applyMix(mapMix);
    walkNow = !!k.walk; fovNow = k.fov || 0;
    callout?.classList.toggle('on', !!tag && !override && mapMix < .05 && (t < .2 || t > .8));
    focusTarget = { focus: k.focus || null, slice: !!k.slice, open: !!k.walk };
    // neighbours and trees step back while a floor is opened up from above
    const ctx = !(k.focus && !k.walk && k.focus !== 'T');
    if (ctx !== lastCtx) { lastCtx = ctx; stage.setContext(ctx); mapStage.setNeighbours(ctx); }
    const night = lerp(a.night, b.night, e);
    if (Math.abs(night - lastNight) > 0.01) { lastNight = night; stage.setNight(night); mapStage.setNight(night); document.body.classList.toggle('night', night > 0.5); }
    shift = narrow ? 0 : (override ? override.shift : lerp(a.shift, b.shift, e));
    shiftY = narrow ? ((nav() + vis) / 2 - innerHeight / 2) / innerHeight - (current === 0 ? 0.1 * (vis / innerHeight) : 0) : 0;
    let { cam, look } = override ? { cam: override.cam, look: override.look } : pathLerp(a, b, a.walk && b.walk ? t : e);
    if (!k.walk) {   // exterior and cut-away shots pull back as the visible stage gets narrower
      const sc = perspScale(), d = [cam[0] - look[0], cam[1] - look[1], cam[2] - look[2]];
      cam = [look[0] + d[0] * sc, look[1] + d[1] * sc, look[2] + d[2] * sc];
    }
    desired = { cam, look };
    settled = false;
    kick();
  }
  // the focused floor is opened from above whenever the camera is above its ceiling (so a dive
  // from the cut-away into the walk-through never looks down onto the floor above)
  function applyFocus(camY) {
    const { focus } = focusTarget;
    const above = focus && focus !== 'T' && camY > LEVEL_Y[focus] + 2.75;
    const slice = focusTarget.slice || !!above, open = focusTarget.open;
    if (focus !== lastFocus || slice !== lastSlice || open !== lastOpen) { lastFocus = focus; lastSlice = slice; lastOpen = open; stage.setFocus(focus, slice, open); }
  }

  function setTag(t) { tag = t || null; if (tag && calloutText) calloutText.textContent = tag.text; }

  // ---------- damped camera + gentle sway, driving both stages ----------
  const cur = { cam: null, look: null };
  let raf = 0, last = 0, immediate = true, recentre = false;
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!desired) return;
    if (!cur.cam || immediate) { cur.cam = desired.cam.slice(); cur.look = desired.look.slice(); immediate = false; }
    const kk = 1 - Math.exp(-dt * (walkNow ? 3.2 : 4.2));
    let busy = false;
    for (let j = 0; j < 3; j++) {
      cur.cam[j] = lerp(cur.cam[j], desired.cam[j], kk);
      cur.look[j] = lerp(cur.look[j], desired.look[j], kk);
      if (Math.abs(cur.cam[j] - desired.cam[j]) > 0.005 || Math.abs(cur.look[j] - desired.look[j]) > 0.005) busy = true;
    }
    settled = !busy;
    const u = stage.user;
    if (recentre && !stage.dragging) {
      const r = 1 - Math.exp(-dt * 2.5);
      u.yaw = lerp(u.yaw, 0, r); u.pitch = lerp(u.pitch, 0, r);
      if (Math.abs(u.yaw) < 1e-3 && Math.abs(u.pitch) < 1e-3) { u.yaw = u.pitch = 0; recentre = false; } else busy = true;
    }
    let cam = cur.cam;
    if (!reduced && !document.hidden && !stage.dragging) {   // slow sway (a gentle head turn when walking)
      orbitT += dt; busy = true;
      const ang = Math.sin(orbitT * 0.16) * (walkNow ? 0.012 : 0.045);
      const [lx, , lz] = cur.look;
      const dx = cur.cam[0] - lx, dz = cur.cam[2] - lz;
      const cos = Math.cos(ang), sin = Math.sin(ang);
      cam = [lx + dx * cos - dz * sin, cur.cam[1], lz + dx * sin + dz * cos];
    }
    applyFocus(cam[1]);
    if (mapMix < .999) stage.lookFrom(cam, cur.look, shift, shiftY, walkNow, fovNow);
    if (mapMix > .001 && !manual) mapStage.lookFrom(cam, cur.look, shift);
    if (busy) kick();
  }
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
    recentre = true;
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
  // While one is active the scroll keyframes pause on the map; scrolling to another section resumes them.
  const onMapRequest = (e) => {
    const { go, flyTo, resume } = e.detail || {};
    if (resume) { manual = false; mapStage.clearDest(); immediate = true; dispatchEvent(new CustomEvent('sahil:view', { detail: { id: null } })); update(); return; }
    manual = true; immediate = true;
    if (go) mapStage.go(go); else if (flyTo) mapStage.flyTo(flyTo);
  };
  addEventListener('sahil:map', onMapRequest);

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; update(); }); } };
  const onResize = () => { narrow = narrowMQ.matches; C = centers(); update(); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onResize);
  const mainRO = new ResizeObserver(onResize);
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
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // ---------- load ----------
  const bar = document.querySelector('.loader i');
  const note = document.querySelector('.load-note');
  let alive = true;
  stageEl.classList.add('ready');
  mapStage.ready.then(() => { if (alive) { mapEl.classList.add('ready'); immediate = true; update(); } });
  mapStage.load().catch((err) => console.error(err));
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
    // furnish the tour's floors ahead of time so the walk-through never waits
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    idle(() => stage.loadDetail().then(() => ['G', F, 'F03', 'T'].forEach((l) => stage.building.ensureInterior(l))));
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
    if (rail) rail.innerHTML = '';
    document.body.classList.remove('night', 'model-ready', 'on-map');
    mapStage.dispose();
    stage.dispose();
  };
}
