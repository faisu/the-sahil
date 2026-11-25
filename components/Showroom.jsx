'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { getProject } from '@/lib/projects';
import { createProjectStage } from '@/lib/projectStage';
import { cardFor } from '@/components/FinishStudio';
import { showroomViews, unitOrbit, levelOrbit, facadeLevelOrbit, fromOrbit, exteriorHotspots, SHOWROOM_GAPS } from '@/lib/showroom';
import { sunTimes, dayOfYear } from '@/lib/atmosphere';
import SunClock from '@/components/SunClock';

// Full-screen 3D showroom for a Dadamiya project: free orbit with pinch / wheel zoom, camera
// presets, exterior / interior (furnished cut-away) toggle, hotspots with feature cards, flat-type
// switching (furnished unit dollhouses), floor-by-floor cut-away and exterior, a clock that puts the
// sun (and its shadows) where it stands at that hour, the surroundings lit after dark, exploded stack,
// fullscreen, share link and a skippable first-visit walkthrough. Reuses the GSAP tour's stage.

const TUTORIAL_KEY = 'showroom-tips-v2';
const fmtTime = (h) => { const m = Math.round(h * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export { fmtTime };
const PIN_H = 1.5;

const Icon = ({ d, title }) => (<svg viewBox="0 0 24 24" aria-hidden={title ? undefined : true}>{title && <title>{title}</title>}<path d={d} /></svg>);
const IC = {
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  unfull: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z',
  sun: 'M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  explode: 'M5 5h14v3H5zM5 10.5h14v3H5zM5 16h14v3H5z',
  floors: 'M3 8l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 16l9 4 9-4',
  spin: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4',
  reset: 'M12 4a8 8 0 1 1-7.4 5M4 4v5h5',
  share: 'M16 6l-4-4-4 4M12 2v13M5 11v9h14v-9',
  help: 'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.1-1.5 2.1V15M12 18.5v.5M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19z',
  info: 'M12 11v6M12 7.5v.5M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19z',
  chev: 'M6 15l6-6 6 6',
  back: 'M15 5l-7 7 7 7',
};

export default function Showroom({ slug }) {
  const p = getProject(slug);
  const root = useRef(null), stageEl = useRef(null), pinsEl = useRef({});
  const api = useRef(null);         // the project stage
  const cam = useRef(null);         // orbit parameters being rendered
  const camTween = useRef(null), stTween = useRef(null), timeTween = useRef(null);
  const anchors = useRef({});       // hotspot id -> resolved [x, y, z]
  const home = useRef(null);        // orbit of the current preset (reset + zoom limits)
  const views = useMemo(() => showroomViews(p), [p]);
  const extPins = useMemo(() => exteriorHotspots(p), [p]);
  const floorPins = p.finish?.hotspots || [];
  const typY = p.levels.find((l) => l[0] === p.typical)[1];

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState('exterior');    // exterior | interior | unit
  const [view, setView] = useState('facade');
  const [unit, setUnit] = useState(null);
  const [unitLoading, setUnitLoading] = useState(false);
  const [level, setLevel] = useState(null);        // exterior x-ray cut at a level
  const [hour, setHour] = useState(11);             // local clock time (IST), hours
  const [doy, setDoy] = useState(() => dayOfYear());   // day of the year: the sun's path follows the season
  const [sunInfo, setSunInfo] = useState(null);       // { el, az, night } from the stage
  const [playing, setPlaying] = useState(false);     // time-lapse
  const [extLevel, setExtLevel] = useState(null);    // a storey picked out on the exterior
  const [floorMode, setFloorMode] = useState('out'); // floors sheet: from outside | cut away
  const night = !!sunInfo && sunInfo.night > 0.5;
  const [explode, setExplode] = useState(false);
  const [spin, setSpin] = useState(false);
  const [open, setOpen] = useState(null);          // hotspot id
  const [sheet, setSheet] = useState(null);        // 'units' | 'floors' | 'info' | null
  const [tip, setTip] = useState(-1);              // walkthrough step, -1 = closed
  const [full, setFull] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const [toast, setToast] = useState('');
  const [interacted, setInteracted] = useState(false);
  const [unitMin, setUnitMin] = useState(false);       // phones: the flat card starts folded above the controls
  const [furnishing, setFurnishing] = useState(false);   // furnished flats still downloading for the floor view

  // ---------- camera ----------
  const push = useCallback(() => {
    const s = api.current, o = cam.current; if (!s || !o) return;
    const v = fromOrbit(o); s.setCamera(v.cam, v.look, v.fov);
  }, []);
  // pull the camera back until the preset's extent fits this screen (portrait phones need more room)
  const fitted = useCallback((orbit, fit) => {
    const el = stageEl.current; if (!fit || !el) return { ...orbit };
    const a = (el.clientWidth || 1) / (el.clientHeight || 1), t = Math.tan((orbit.fov * Math.PI) / 360);
    const need = Math.max(fit.h / 2 / t, fit.w / 2 / (t * a)) + (fit.d || 0);   // d: how far the near side stands in front of the look point
    return { ...orbit, r: Math.max(orbit.r, need) };
  }, []);
  const flyTo = useCallback((orbit0, { duration = 1.4 } = {}) => {
    const orbit = fitted(orbit0, orbit0.fit);
    delete orbit.fit;
    if (!cam.current) { cam.current = { ...orbit }; push(); return; }
    home.current = { ...orbit };
    camTween.current?.kill();
    const cur = cam.current, to = { ...orbit };
    // shortest way round
    while (to.theta - cur.theta > Math.PI) to.theta -= Math.PI * 2;
    while (cur.theta - to.theta > Math.PI) to.theta += Math.PI * 2;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    camTween.current = gsap.to(cur, { ...to, duration: reduced ? 0 : duration, ease: 'power2.inOut', onUpdate: push });
  }, [push, fitted]);
  const stateTo = useCallback((st, { duration = 1.1 } = {}) => {
    const s = api.current; if (!s) return;
    stTween.current?.kill();
    const o = { cut: s.state.cut, explode: s.state.explode, finish: s.state.finish, unitAlpha: s.state.unitAlpha, context: s.state.context };
    const to = { cut: st.cut ?? 0, explode: st.explode ?? 0, finish: st.finish ?? 0, unitAlpha: st.unitAlpha ?? 0, context: st.unit ? 0 : 1 };   // neighbours step aside for a flat
    // focus switches at once when cutting in, at the end when cutting out
    if (st.focus) s.set({ focus: st.focus });
    if (st.unit) s.set({ unit: st.unit });
    stTween.current = gsap.to(o, {
      ...to, duration, ease: 'power2.inOut',
      onUpdate: () => s.set({ cut: o.cut, explode: o.explode, finish: o.finish, unitAlpha: o.unitAlpha, buildingAlpha: 1 - o.unitAlpha, context: o.context }),
      onComplete: () => { if (!st.focus) s.set({ focus: null }); if (!st.unit) s.set({ unit: null }); },
    });
  }, []);

  // ---------- stage ----------
  useEffect(() => {
    const narrow = matchMedia('(max-width: 760px)').matches;
    const s = createProjectStage(stageEl.current, p, { narrow, drag: false, maxDpr: narrow ? 1.5 : 1.75, real: true, shadows: true });
    api.current = s;
    window.__showroom = { stage: s, cam };   // inspection hook for screenshot tooling, like window.__tour
    setCanFull(!!document.fullscreenEnabled);

    // deep link: ?view=terrace | ?unit=A | ?level=F02 | ?storey=F03, &t=18.5 (clock hours) &d=172 (day of year); &night=1 = 20:30
    const q = new URLSearchParams(location.search);
    const v0 = views.find((v) => v.id === q.get('view')) || views[0];
    { const o = fitted(v0.orbit, v0.fit); delete o.fit; cam.current = { ...o }; home.current = { ...o }; }
    push();
    s.load(({ loaded, total }) => total && setProgress(Math.min(1, loaded / total)))
      .then(() => { setProgress(1); setReady(true); })
      .catch((e) => { console.error(e); setFailed(true); });
    const t0 = parseFloat(q.get('t')), d0 = parseInt(q.get('d'), 10);
    if (t0 >= 0 && t0 < 24) setHour(t0); else if (q.get('night') === '1') setHour(20.5);
    if (d0 >= 1 && d0 <= 366) setDoy(d0);
    if (q.get('unit') && p.units.some((u) => u.id === q.get('unit'))) setTimeout(() => selectUnit(q.get('unit')), 50);
    else if (q.get('level') && p.levels.some((l) => l[0] === q.get('level'))) setTimeout(() => selectLevel(q.get('level')), 50);
    else if (q.get('storey') && p.levels.some((l) => l[0] === q.get('storey'))) setTimeout(() => selectStorey(q.get('storey'), { instant: true }), 50);
    else if (v0.id !== 'facade') setTimeout(() => selectView(v0.id, { instant: true }), 50);

    try { if (!localStorage.getItem(TUTORIAL_KEY)) setTimeout(() => setTip(0), 900); } catch { /* storage blocked: skip the tips */ }

    return () => { camTween.current?.kill(); stTween.current?.kill(); timeTween.current?.kill(); s.dispose(); api.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  // ---------- orbit input: drag, pinch, wheel, keys ----------
  useEffect(() => {
    const el = stageEl.current; if (!el) return;
    const pts = new Map();
    let pinch0 = 0, r0 = 0, moved = 0;
    const lim = () => { const h = home.current || cam.current; return [h.r * 0.35, h.r * 2.4]; };
    const touch = () => { camTween.current?.kill(); setInteracted(true); setSpin(false); };
    const down = (e) => { el.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0; el.classList.add('dragging');
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); r0 = cam.current.r; } };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      const o = cam.current;
      if (pts.size === 1) {
        const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
        moved += Math.abs(dx) + Math.abs(dy); if (moved < 3) return;
        touch();
        o.theta += dx * 0.006; o.phi = Math.max(0.02, Math.min(1.45, o.phi + dy * 0.004));
      } else if (pts.size === 2) {
        touch();
        const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const [lo, hi] = lim(); o.r = Math.max(lo, Math.min(hi, r0 * pinch0 / Math.max(1, d)));
      }
      push();
    };
    const up = (e) => { pts.delete(e.pointerId); if (!pts.size) el.classList.remove('dragging'); if (pts.size === 1) { const [only] = pts.values(); pts.clear(); pts.set(e.pointerId, only); } };
    const wheel = (e) => { e.preventDefault(); touch(); const [lo, hi] = lim(); const o = cam.current; o.r = Math.max(lo, Math.min(hi, o.r * Math.exp(e.deltaY * 0.0012))); push(); };
    const key = (e) => {
      if (e.target.closest?.('input,textarea')) return;
      const o = cam.current; let hit = true;
      if (e.key === 'ArrowLeft') o.theta -= 0.12; else if (e.key === 'ArrowRight') o.theta += 0.12;
      else if (e.key === 'ArrowUp') o.phi = Math.min(1.45, o.phi + 0.08); else if (e.key === 'ArrowDown') o.phi = Math.max(0.02, o.phi - 0.08);
      else if (e.key === '+' || e.key === '=') o.r *= 0.9; else if (e.key === '-') o.r *= 1.1;
      else if (e.key === 'Escape') { setOpen(null); setSheet(null); setTip(-1); hit = false; } else hit = false;
      if (hit) { e.preventDefault(); touch(); push(); }
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false }); addEventListener('keydown', key);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); removeEventListener('keydown', key); };
  }, [push]);

  // the drag hint goes once the visitor has had time to read it
  useEffect(() => { if (!ready) return; const t = setTimeout(() => setInteracted(true), 7000); return () => clearTimeout(t); }, [ready]);

  // auto spin: a slow turntable until the visitor touches the model
  useEffect(() => {
    if (!spin) return;
    let raf, t0 = performance.now();
    const tick = (t) => { cam.current.theta += (t - t0) * 0.00012; t0 = t; push(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [spin, push]);

  // clock: sun, sky, shadows and the lights of the neighbourhood follow the time of day
  useEffect(() => {
    const s = api.current; if (!s) return;
    const i = s.setTime(hour, doy);
    if (i) setSunInfo((prev) => (prev && Math.abs(prev.el - i.el) < 0.05 && Math.abs(prev.night - i.night) < 0.01 ? prev : { el: i.el, az: i.az, night: i.night }));
  }, [hour, doy]);
  // move the clock smoothly (forward through the day) to a time
  const timeTo = useCallback((h, { duration = 1.6 } = {}) => {
    timeTween.current?.kill(); setPlaying(false);
    const o = { h: hour };
    let to = h; if (to < o.h - 0.01 && o.h - to > 2) to += 24;   // go forward round the clock, not back
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    timeTween.current = gsap.to(o, { h: to, duration: reduced ? 0 : duration, ease: 'power1.inOut', onUpdate: () => setHour(((o.h % 24) + 24) % 24) });
  }, [hour]);
  // time-lapse: about an hour a second, from dawn to late evening
  useEffect(() => {
    if (!playing) return;
    let raf, t0 = performance.now();
    const tick = (t) => { const dt = Math.min(0.1, (t - t0) / 1000); t0 = t; setHour((h) => { const n = h + dt * 1.1; return n > 23 ? 5 : n; }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const toggleNight = () => { const { set } = sunTimes(doy); timeTo(night ? 11 : Math.max(20, set + 1.2)); };

  // fullscreen state follows the browser (Esc leaves it too)
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  // ---------- hotspots follow the camera ----------
  const pins = mode === 'exterior' && !explode && !level && !extLevel ? extPins : mode === 'interior' ? floorPins : [];
  useEffect(() => {
    const s = api.current; if (!s) return;
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    const resolve = (h) => {
      if (anchors.current[h.id]) return anchors.current[h.id];
      if (Array.isArray(h.anchor)) return (anchors.current[h.id] = h.anchor);
      if (h.at) return (anchors.current['f:' + h.id] = [h.at[0], typY + PIN_H, h.at[1]]);
      const f = s.floors[h.anchor.level]; if (!f) return null;
      box.makeEmpty();
      for (const m of f.meshes) if (m.userData.cat === h.anchor.cat) { tmp.setFromObject(m); box.union(tmp); }
      if (box.isEmpty()) return null;
      const c = box.getCenter(new THREE.Vector3());
      return (anchors.current[h.id] = [c.x, box.max.y + 0.8, c.z]);
    };
    const place = () => {
      const W = stageEl.current?.clientWidth || 1, Hh = stageEl.current?.clientHeight || 1;
      const cp = s.camera.position, ctr = s.center;
      for (const h of pins) {
        const el = pinsEl.current[h.id]; if (!el) continue;
        const a = h.at ? [h.at[0], typY + PIN_H, h.at[1]] : resolve(h);
        if (!a) { el.classList.add('off'); continue; }
        const [x, y, vis] = s.project(a);
        // pins on the far side of the building (below the roof line) are hidden by it
        const behind = !h.at && a[1] < s.H - 0.3 && Math.hypot(cp.x - a[0], cp.z - a[2]) > Math.hypot(cp.x - ctr.x, cp.z - ctr.z) + 1.5;
        const inside = vis && x > 12 && x < W - 12 && y > 60 && y < Hh - 40;
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.classList.toggle('off', !inside || behind);
      }
    };
    const off = s.onFrame(place); place();
    return off;
  }, [pins, typY]);

  // ---------- actions ----------
  const writeUrl = (params) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    history.replaceState(null, '', `${location.pathname}${q.toString() ? '?' + q : ''}`);
  };
  useEffect(() => {
    if (!api.current) return;
    const tq = Math.abs(hour - 11) > 0.01 ? String(Math.round(hour * 4) / 4) : null, dq = doy !== dayOfYear() ? String(doy) : null;
    writeUrl({ view: mode !== 'unit' && !level && !extLevel && view !== 'facade' ? view : null, unit: mode === 'unit' ? unit : null, level: mode !== 'unit' ? level : null, storey: mode === 'exterior' ? extLevel : null, t: playing ? null : tq, d: dq });
  }, [mode, view, unit, level, extLevel, hour, doy, playing]);

  function selectView(id, { instant = false } = {}) {
    const v = views.find((x) => x.id === id); if (!v) return;
    setView(id); setMode(v.mode); setUnit(null); setLevel(null); setExtLevel(null); setOpen(null); setExplode(v.state.explode > 0);
    flyTo({ ...v.orbit, fit: v.fit }, { duration: instant ? 0 : 1.4 });
    stateTo({ ...v.state, unitAlpha: 0 }, { duration: instant ? 0.01 : 1.1 });
    // the finished floor is built from the furnished unit models: fetch them on first visit only
    if (v.state.finish && api.current) {
      const all = p.units.map((u) => api.current.loadUnit(u.id));
      setFurnishing(true);
      Promise.all(all).finally(() => setFurnishing(false));
    }
  }
  function selectMode(m) {
    if (m === 'exterior') selectView(view !== 'floor' && views.find((v) => v.id === view)?.mode === 'exterior' ? view : 'facade');
    else selectView('floor');
  }
  function selectUnit(id) {
    const o = unitOrbit(p, id); if (!o || !api.current) return;
    setUnitMin(innerWidth <= 760);
    setUnit(id); setMode('unit'); setLevel(null); setExtLevel(null); setOpen(null); setSheet(null); setExplode(false); setUnitLoading(true);
    flyTo(o);
    stateTo({ focus: p.typical, cut: 1, explode: 0, finish: 0, unitAlpha: 0, unit: id }, { duration: 0.8 });
    api.current.loadUnit(id).then(() => {
      setUnitLoading(false);
      if (api.current?.state.unit !== id) return;
      stateTo({ focus: p.typical, cut: 1, explode: 0, finish: 0, unitAlpha: 1, unit: id }, { duration: 0.9 });
    });
  }
  function selectLevel(lv) {
    if (!lv) { selectView('facade'); return; }
    const o = levelOrbit(p, lv);
    setLevel(lv); setExtLevel(null); setMode('exterior'); setUnit(null); setOpen(null); setSheet(null); setExplode(false); setView(null);
    flyTo(o);
    stateTo({ focus: lv, cut: 1, explode: 0, finish: lv === p.typical && p.finish ? 1 : 0, unitAlpha: 0 });
  }
  // one storey from outside: the camera comes level with it, the storey is outlined on the facade
  function selectStorey(lv, { instant = false } = {}) {
    if (!lv) { selectView('facade'); return; }
    const o = facadeLevelOrbit(p, lv, cam.current?.theta);
    setExtLevel(lv); setLevel(null); setMode('exterior'); setUnit(null); setOpen(null); setExplode(false); setView(null);
    if (innerWidth <= 760) setSheet(null);
    flyTo(o, { duration: instant ? 0 : 1.2 });
    stateTo({ focus: null, cut: 0, explode: 0, finish: 0, unitAlpha: 0 }, { duration: instant ? 0.01 : 0.9 });
  }
  const stepStorey = (d) => { const ks = p.levels.map((l) => l[0]); const i = ks.indexOf(extLevel) + d; if (i >= 0 && i < ks.length) selectStorey(ks[i]); };
  // the outline follows the picked storey
  useEffect(() => {
    const s = api.current; if (!s) return;
    if (!extLevel) { s.highlightLevel(null); return; }
    const i = p.levels.findIndex((l) => l[0] === extLevel), y0 = p.levels[i][1];
    const y1 = i + 1 < p.levels.length ? p.levels[i + 1][1] : y0 + 1.0;
    s.highlightLevel(Math.max(0, y0 - (i === 0 ? 0.15 : 0)), y1, p.accent);
  }, [extLevel, p]);

  function toggleExplode() {
    if (mode === 'unit') return;
    if (explode) selectView('facade'); else selectView('stack');
  }
  function reset() { if (home.current) flyTo(home.current, { duration: 0.9 }); }
  async function share() {
    const url = location.href;
    try {
      if (navigator.share && innerWidth <= 760) await navigator.share({ title: `${p.name} · 3D showroom`, url });
      else { await navigator.clipboard.writeText(url); flash('Link to this view copied'); }
    } catch { /* cancelled */ }
  }
  function flash(t) { setToast(t); setTimeout(() => setToast(''), 2200); }
  function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else root.current.requestFullscreen?.().catch(() => {}); }
  function pinAction(h) {
    if (h.unit) return () => selectUnit(h.unit);
    if (h.flat) return () => selectUnit(h.flat);
    if (h.view) return () => selectView(h.view);
    return null;
  }

  // a card on the right: slide the model into the space left of it (desktop only)
  const hasCard = !!open || mode === 'unit' || sheet === 'info';
  useEffect(() => {
    const s = api.current; if (!s) return;
    const upd = () => s.setShift(hasCard && innerWidth > 760 ? -Math.min(200, innerWidth * 0.14) : 0);
    upd(); addEventListener('resize', upd); return () => removeEventListener('resize', upd);
  }, [hasCard]);

  // ---------- walkthrough ----------
  const TIPS = [
    { sel: '.sr-stage', title: 'Turn it around', text: 'Drag to orbit the building. Pinch or scroll to zoom. Arrow keys work too.' },
    { sel: '.sr-mode', title: 'Outside or in', text: 'Switch between the exterior and the furnished cut-away of the typical floor.' },
    { sel: '.sr-views', title: 'Jump to a view', text: 'Presets for the façade, aerial, stilt, terrace, the floor stack and the typical floor.' },
    { sel: '.sr-pin:not(.off)', title: 'Tap a pin', text: 'Pins open a card on that part of the building. Some take you to a closer view.' },
    { sel: '.sr-unitbtn', title: 'Pick a flat type', text: 'Open any flat type as a furnished 3D model with its rooms and carpet area.' },
    { sel: '.sr-timebtn', title: 'Set the clock', text: 'Pick a time and season: the sun, its shadows and the street and window lights follow it. Play runs a day in seconds.' },
    { sel: '.sr-rail', title: 'More controls', text: 'The floor stack, each floor from outside or cut away, turntable, reset, share and fullscreen.' },
  ];
  const endTips = () => { setTip(-1); try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* ignore */ } };
  const [tipBox, setTipBox] = useState(null);
  useEffect(() => {
    if (tip < 0) { setTipBox(null); return; }
    const place = () => {
      const t = TIPS[tip]; const el = root.current?.querySelector(t.sel);
      const r = el?.getBoundingClientRect();
      setTipBox(r && t.sel !== '.sr-stage' ? { x: r.left + r.width / 2, y: r.top, b: r.bottom, w: r.width, h: r.height } : null);
    };
    place(); addEventListener('resize', place); return () => removeEventListener('resize', place);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip, mode]);

  // ---------- render ----------
  const curUnit = unit ? p.units.find((u) => u.id === unit) : null;
  const unitRow = curUnit && p.finish?.schedule?.rows.find((r) => r.flat === `Unit ${curUnit.id}` || r.flat === curUnit.id);
  const card = (() => {
    if (!open) return null;
    const ext = extPins.find((h) => h.id === open);
    if (ext && mode === 'exterior') return { kicker: p.name, title: ext.title, lines: ext.lines, h: ext };
    const fl = floorPins.find((h) => h.id === open);
    if (fl) { const c = cardFor(p, fl); return { ...c, link: null, h: fl }; }
    return null;
  })();
  const levelLabel = (k) => (p.levels.find((l) => l[0] === k) || [])[2] || k;
  const tipT = tip >= 0 ? TIPS[tip] : null;
  const tipStyle = (() => {
    if (!tipT) return null;
    if (!tipBox) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    const W = typeof innerWidth === 'number' ? innerWidth : 1000, Hh = typeof innerHeight === 'number' ? innerHeight : 800;
    const below = tipBox.y < Hh * 0.45;
    const x = Math.max(150, Math.min(W - 150, tipBox.x));
    return below ? { left: x, top: tipBox.b + 14, transform: 'translateX(-50%)' } : { left: x, top: tipBox.y - 14, transform: 'translate(-50%, -100%)' };
  })();

  return (
    <div ref={root} className={`sr${night ? ' sr-night' : ''}${ready ? ' sr-ready' : ''}`} style={{ '--accent': p.accent }}>
      <div ref={stageEl} className="sr-stage" role="img" aria-label={`3D model of ${p.name}. Drag to orbit, pinch or scroll to zoom.`} tabIndex={0} />

      {!ready && (
        <div className="sr-loading" aria-live="polite">
          <p className="k">{p.developer}</p>
          <h1>{p.name}</h1>
          <div className="bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <p className="pct">{failed ? 'The 3D model could not be loaded. Reload to try again.' : `Loading the 3D showroom · ${Math.round(progress * 100)}%`}</p>
        </div>
      )}

      <header className="sr-top">
        <Link href={p.href} className="sr-back" aria-label={`Back to the ${p.name} tour`}><Icon d={IC.back} /></Link>
        <div className="sr-title"><b>{p.name}</b><small>3D showroom · {p.place}</small></div>
        <div className="sr-mode" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={mode === 'exterior'} className={mode === 'exterior' ? 'on' : ''} onClick={() => selectMode('exterior')}>Exterior</button>
          <button type="button" role="tab" aria-selected={mode !== 'exterior'} className={mode !== 'exterior' ? 'on' : ''} onClick={() => selectMode('interior')}>Interior</button>
        </div>
      </header>

      <nav className="sr-rail" aria-label="Viewer controls">
        {canFull && <button type="button" onClick={toggleFull} aria-pressed={full} title={full ? 'Exit fullscreen' : 'Fullscreen'}><Icon d={full ? IC.unfull : IC.full} /><span>{full ? 'Exit' : 'Full'}</span></button>}
        <button type="button" className="sr-timebtn" onClick={() => setSheet(sheet === 'clock' ? null : 'clock')} aria-pressed={sheet === 'clock'} title="Time of day: sun, shadows and lights"><Icon d={night ? IC.moon : IC.sun} /><span>{fmtTime(hour)}</span></button>
        <button type="button" onClick={toggleExplode} aria-pressed={explode} disabled={mode === 'unit'} title="Pull the floors apart"><Icon d={IC.explode} /><span>Stack</span></button>
        <button type="button" onClick={() => setSheet(sheet === 'floors' ? null : 'floors')} aria-pressed={sheet === 'floors' || !!level || !!extLevel} title="Floor by floor, outside or cut away"><Icon d={IC.floors} /><span>Floors</span></button>
        <button type="button" onClick={() => setSpin(!spin)} aria-pressed={spin} title="Turntable"><Icon d={IC.spin} /><span>Spin</span></button>
        <button type="button" onClick={reset} title="Reset the view"><Icon d={IC.reset} /><span>Reset</span></button>
        <button type="button" onClick={share} title="Share this view"><Icon d={IC.share} /><span>Share</span></button>
        <button type="button" onClick={() => setSheet(sheet === 'info' ? null : 'info')} aria-pressed={sheet === 'info'} title="About this model"><Icon d={IC.info} /><span>Info</span></button>
        <button type="button" onClick={() => setTip(0)} title="How it works"><Icon d={IC.help} /><span>Help</span></button>
      </nav>

      <div className="sr-pins" aria-label="Hotspots">
        {pins.map((h) => (
          <button type="button" key={(mode === 'interior' ? 'f:' : 'e:') + h.id} ref={(n) => { pinsEl.current[h.id] = n; }}
            className={`sr-pin off${open === h.id ? ' sel' : ''}${h.unit || h.flat ? ' flat' : ''}`} onClick={() => setOpen(open === h.id ? null : h.id)} aria-expanded={open === h.id}>
            <i /><span>{h.label}</span>
          </button>
        ))}
      </div>

      {card && (
        <aside className="sr-card" role="dialog" aria-label={card.title}>
          <button type="button" className="x" onClick={() => setOpen(null)} aria-label="Close">×</button>
          <p className="k">{card.kicker}</p>
          <h3>{card.title}</h3>
          {card.stats && <ul className="st">{card.stats.map(([v, l]) => <li key={l}><b>{v}</b>{l}</li>)}</ul>}
          <ul className="ln">{card.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {pinAction(card.h) && (
            <button type="button" className="go" onClick={pinAction(card.h)}>
              {card.h.unit || card.h.flat ? 'Open this flat in 3D' : `Go to ${views.find((v) => v.id === card.h.view)?.label.toLowerCase()} view`} →
            </button>
          )}
        </aside>
      )}

      {mode === 'unit' && curUnit && (
        <aside className={`sr-card sr-unitcard${unitMin ? ' min' : ''}`} aria-live="polite">
          <button type="button" className="fold" onClick={() => setUnitMin(!unitMin)} aria-expanded={!unitMin} aria-label={unitMin ? 'Show the flat details' : 'Fold the flat details'}><Icon d={IC.chev} /></button>
          <p className="k">{unitRow?.type || 'Furnished flat'}{unitRow?.count ? ` · ${unitRow.count} per floor` : ''}</p>
          <h3>{curUnit.name}</h3>
          <ul className="st"><li><b>{curUnit.carpet}</b>{p.slug === 'mansouza' ? 'sum of rooms (modelled)' : 'carpet (modelled)'}</li><li><b>{levelLabel(p.typical).replace(' floor', '')}</b>floor shown</li></ul>
          <ul className="ln">{curUnit.rooms.split(' · ').map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="fine">{p.slug === 'mansouza' ? 'Furniture placed by room type: no furniture drawing was supplied.' : 'Furnished from the architect’s furniture and electrical drawing.'}{unitLoading ? ' Loading the furnished model…' : ''}</p>
          <button type="button" className="go" onClick={() => selectView('floor')}>← All flats on the floor</button>
        </aside>
      )}

      {furnishing && mode === 'interior' && <div className="sr-badge">Furnishing the flats…</div>}
      {extLevel && (
        <div className="sr-badge sr-storey">
          <button type="button" onClick={() => stepStorey(-1)} disabled={extLevel === p.levels[0][0]} aria-label="Floor below"><Icon d={IC.chev} /></button>
          <span><b>{levelLabel(extLevel)}</b> from outside · +{(p.levels.find((l) => l[0] === extLevel) || [0, 0])[1].toFixed(2)} m</span>
          <button type="button" onClick={() => stepStorey(1)} disabled={extLevel === p.levels[p.levels.length - 1][0]} aria-label="Floor above" className="up"><Icon d={IC.chev} /></button>
          <button type="button" onClick={() => selectLevel(extLevel)} className="txt" title="Lift off the floors above and look in">Cut away</button>
          <button type="button" onClick={() => selectView('facade')} aria-label="Back to the whole building">×</button>
        </div>
      )}
      {level && (
        <div className="sr-badge">Cut away at the {levelLabel(level).toLowerCase()}{level !== p.typical ? ' · bare walls' : ''}<button type="button" onClick={() => selectView('facade')} aria-label="Close the cut-away">×</button></div>
      )}

      <footer className="sr-bottom">
        <button type="button" className="sr-unitbtn" onClick={() => setSheet(sheet === 'units' ? null : 'units')} aria-expanded={sheet === 'units'}>
          <span className="sw" aria-hidden="true">{curUnit ? curUnit.id : p.units.length}</span>
          <span className="tx"><small>Flat type</small><b>{curUnit ? curUnit.name.split(' · ')[1] || curUnit.name : `${p.units.length} furnished types`}</b></span>
          <Icon d={IC.chev} />
        </button>
        <div className="sr-views" role="tablist" aria-label="Camera presets">
          {views.map((v) => (
            <button type="button" role="tab" key={v.id} aria-selected={view === v.id && mode !== 'unit' && !level} className={view === v.id && mode !== 'unit' && !level ? 'on' : ''} onClick={() => selectView(v.id)}>{v.label}</button>
          ))}
        </div>
        <Link className="sr-cta" href={p.href}>Guided tour</Link>
      </footer>

      {sheet === 'units' && (
        <div className="sr-sheet" role="dialog" aria-label="Flat types">
          <div className="hd"><b>Flat types</b><button type="button" className="x" onClick={() => setSheet(null)} aria-label="Close">×</button></div>
          <ul>
            {p.units.map((u) => {
              const row = p.finish?.schedule?.rows.find((r) => r.flat === `Unit ${u.id}` || r.flat === u.id);
              return (
                <li key={u.id}>
                  <button type="button" className={unit === u.id ? 'on' : ''} onClick={() => selectUnit(u.id)}>
                    <span className="sw">{u.id}</span>
                    <span className="tx"><b>{u.name.split(' · ')[1] || u.name}</b><small>{u.carpet}{row?.count ? ` · ${row.count} per floor` : ''}</small></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="all" onClick={() => { setSheet(null); selectView('floor'); }}>See all flats on the {levelLabel(p.typical).toLowerCase()} →</button>
        </div>
      )}

      {sheet === 'floors' && (
        <div className="sr-sheet sr-floors" role="dialog" aria-label="Floors">
          <div className="hd"><b>Floor by floor</b><button type="button" className="x" onClick={() => setSheet(null)} aria-label="Close">×</button></div>
          <div className="sr-seg" role="tablist" aria-label="How to show the floor">
            <button type="button" role="tab" aria-selected={floorMode === 'out'} className={floorMode === 'out' ? 'on' : ''} onClick={() => setFloorMode('out')}>From outside</button>
            <button type="button" role="tab" aria-selected={floorMode === 'cut'} className={floorMode === 'cut' ? 'on' : ''} onClick={() => setFloorMode('cut')}>Cut away</button>
          </div>
          <ul>
            {[...p.levels].reverse().map(([k, y, label]) => {
              const on = floorMode === 'out' ? extLevel === k : level === k;
              return (
                <li key={k}><button type="button" className={on ? 'on' : ''} onClick={() => (floorMode === 'out' ? selectStorey(k) : selectLevel(k))}>
                  <span className="tx"><b>{label}</b><small>+{y.toFixed(2)} m{floorMode === 'cut' && k === p.typical ? ' · furnished' : ''}</small></span>
                </button></li>
              );
            })}
          </ul>
          {(level || extLevel) && <button type="button" className="all" onClick={() => selectView('facade')}>Show the whole building</button>}
        </div>
      )}

      {sheet === 'clock' && (
        <SunClock hour={hour} doy={doy} sun={sunInfo} playing={playing} accent={p.accent}
          onHour={(h) => { timeTween.current?.kill(); setPlaying(false); setHour(h); }}
          onPreset={(h) => timeTo(h)} onDoy={setDoy} onPlay={() => { timeTween.current?.kill(); setPlaying(!playing); }}
          onNight={toggleNight} onClose={() => setSheet(null)} />
      )}

      {sheet === 'info' && (
        <div className="sr-sheet sr-info" role="dialog" aria-label="About this model">
          <div className="hd"><b>About this model</b><button type="button" className="x" onClick={() => setSheet(null)} aria-label="Close">×</button></div>
          <p>{p.blurb}</p>
          <ul className="facts">{p.facts.map(([v, l]) => <li key={l}><b>{v}</b>{l}</li>)}</ul>
          <p className="k">Not in this showroom yet</p>
          <ul className="gaps">{(SHOWROOM_GAPS[p.slug] || []).map((g) => <li key={g}>{g}</li>)}</ul>
          <p className="fine">Generated from the architect’s AutoCAD drawings; indicative. Layouts and areas are subject to the agreement and to approval of the authorities. Furniture: Poly Haven and Kenney (CC0).</p>
        </div>
      )}

      {ready && !interacted && tip < 0 && <div className="sr-hint" aria-hidden="true"><i />Drag to orbit</div>}
      {toast && <div className="sr-toast" role="status">{toast}</div>}

      {tipT && (
        <div className="sr-tips" role="dialog" aria-label="How the showroom works">
          {tipBox && <div className="ring" style={{ left: tipBox.x - tipBox.w / 2 - 6, top: tipBox.y - 6, width: tipBox.w + 12, height: tipBox.h + 12 }} />}
          <div className="box" style={tipStyle}>
            <p className="k">{tip + 1} / {TIPS.length}</p>
            <h4>{tipT.title}</h4>
            <p>{tipT.text}</p>
            <div className="sr-tipnav">
              <button type="button" onClick={endTips}>Skip</button>
              <button type="button" className="pri" onClick={() => (tip + 1 < TIPS.length ? setTip(tip + 1) : endTips())}>{tip + 1 < TIPS.length ? 'Next' : 'Done'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
