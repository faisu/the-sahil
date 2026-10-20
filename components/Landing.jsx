'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PROJECT_LIST, getProject } from '@/lib/projects';
import { PRODUCT, HERO_PHASES, TICKER, MANIFESTO, PIPELINE, CAPABILITIES, AUDIENCES, STATS } from '@/lib/platform';
import { createProjectStage } from '@/lib/projectStage';
import PlanSketch from './PlanSketch';
import { StoreyMark } from './LandingNav';

gsap.registerPlugin(ScrollTrigger);

// Platform landing. The hero pins a live 3D building (one of the hosted models, streamed
// encrypted like the tours) and scrubs it through the product's four moves while the page
// scrolls: ghosted drawing → assembled → exploded stack → cut-away floor → night. Below it the
// manifesto, the pipeline (with the plan sketch stepping alongside), the capabilities, the live
// projects, the numbers, the audiences and the call to action.

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (s) => s * s * (3 - 2 * s);
function orbitLerp(a, b, t) {
  const look = lerp3(a.look, b.look, t);
  const da = [a.cam[0] - a.look[0], a.cam[1] - a.look[1], a.cam[2] - a.look[2]];
  const db = [b.cam[0] - b.look[0], b.cam[1] - b.look[1], b.cam[2] - b.look[2]];
  const ra = Math.max(.1, Math.hypot(da[0], da[2])), rb = Math.max(.1, Math.hypot(db[0], db[2]));
  let aa = Math.atan2(da[2], da[0]), ab = Math.atan2(db[2], db[0]);
  if (ab - aa > Math.PI) ab -= 2 * Math.PI; else if (aa - ab > Math.PI) ab += 2 * Math.PI;
  const ang = lerp(aa, ab, t), r = Math.exp(lerp(Math.log(ra), Math.log(rb), t)), h = lerp(da[1], db[1], t) * (r / lerp(ra, rb, t));
  return { look, cam: [look[0] + Math.cos(ang) * r, look[1] + h, look[2] + Math.sin(ang) * r], fov: lerp(a.fov, b.fov, t), ang, r, h };
}

// Camera and model state for each hero phase. The look point is pushed left on wide screens so
// the building sits beside the headline rather than under it.
function heroKeys(p, H, narrow) {
  const [cx, cy, cz] = p.center;
  const R = Math.max(p.bounds.x[1] - p.bounds.x[0], p.bounds.z[1] - p.bounds.z[0]);
  const typY = p.levels.find((l) => l[0] === p.typical)[1];
  const D = Math.max(R * 1.6, H * 1.35);
  const HX = H + p.floorH * 1.6 * (p.levels.length - 1);
  const off = narrow ? 0 : R * 0.42;          // look left of the building so it sits beside the headline
  const dy = narrow ? -H * 0.8 : 0;            // phones: the headline sits at the bottom, so lift the building clear of it
  // wire: the building as a hidden-line drawing; context: the neighbour blocks; finish: the furnished typical floor
  const base = { explode: 0, cut: 0, focus: null, night: 0, alpha: 1, wire: 0, context: 1, finish: 0 };
  const K = {
    draw:  { cam: [cx + D * 0.75, H * 0.95 + 12, cz + D * 1.1], look: [cx - off, H * 0.42 + dy, cz], fov: 36, wire: 1, context: 0.3 },
    stack: { cam: [cx + HX * 1.3, HX * 1.1 + 6, cz + HX * 1.5], look: [cx - off * 0.8, HX * 0.47 + dy * 0.5, cz], fov: 36, explode: 1, context: 0 },
    floor: { cam: [cx + R * 0.45, typY + R * 1.5, cz + R * 1.25], look: [cx - off * 0.4, typY + dy * 0.35, cz - R * 0.05], fov: 34, focus: p.typical, cut: 1, context: 0, finish: 1 },
    night: { cam: [cx + D * 1.0, H * 0.6 + 6, cz + D * 0.95], look: [cx - off * 0.8, H * 0.42 + dy * 0.45, cz], fov: 38, night: 1 },
  };
  return HERO_PHASES.map((ph) => ({ ...base, ...K[ph.id], alpha: ph.alpha ?? 1, t: ph.t }));
}

function Icon({ id }) {
  const P = {
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
    cut: <><path d="M4 9h16M4 15h16" /><path d="M8 4v16" strokeDasharray="2 3" /><path d="M16 4v16" strokeDasharray="2 3" /></>,
    explode: <><path d="M5 7l7-3 7 3-7 3z" /><path d="M5 13l7 3 7-3" /><path d="M5 18l7 3 7-3" /></>,
    furnish: <><path d="M4 11v7h16v-7" /><path d="M6 11V6h12v5" /><path d="M9 6v5M15 6v5" /></>,
    map: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></>,
    night: <><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></>,
    phone: <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    analytics: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>,
  };
  return <svg className="ld-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[id]}</svg>;
}

export default function Landing() {
  const root = useRef(null);
  const [sketchStep, setSketchStep] = useState(0);   // 0 = nothing drawn yet; the pipeline steps set 1–6
  const hero = getProject(PRODUCT.heroProject);

  useEffect(() => {
    const el = root.current;
    const narrow = matchMedia('(max-width: 820px)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nav = document.querySelector('.ld-nav');

    // ---------- the live building in the hero ----------
    const heroEl = el.querySelector('.ld-hero'), stageEl = el.querySelector('.ld-stage'), blueprint = el.querySelector('.ld-blueprint');
    const loader = el.querySelector('.ld-loader i'), copyEl = el.querySelector('.ld-hero-copy'), phaseEls = [...el.querySelectorAll('.ld-phase')];
    const bar = el.querySelector('.ld-hbar i'), live = el.querySelector('.ld-live span'), hint = el.querySelector('.ld-hint');
    const tags = [...el.querySelectorAll('.ld-tag')];
    const stage = createProjectStage(stageEl, hero, { narrow });
    const K = heroKeys(hero, stage.H, narrow);
    const liveText = `Live model · ${hero.name}`;
    let hintTimer = 0;
    stage.load(({ loaded, total }) => {
      if (loader && total) loader.style.width = `${Math.min(100, 100 * loaded / total)}%`;
      if (live && total) live.textContent = `Streaming · ${Math.min(99, Math.round(100 * loaded / total))}%`;
    })
      .then(() => {
        stageEl.classList.add('ready'); loader?.parentElement.classList.add('done');
        if (live) live.textContent = liveText;
        if (hint && !narrow) { hint.classList.add('show'); hintTimer = setTimeout(() => hint.classList.remove('show'), 6000); }
      })
      .catch((e) => { console.error(e); stageEl.classList.add('failed'); });
    const hideHint = () => { hint?.classList.remove('show'); clearTimeout(hintTimer); };
    stageEl.addEventListener('pointerdown', hideHint, { once: true });

    // the furnished flats for the cut-away: a few MB more, fetched once the viewer is actually
    // scrolling the hero (never with data saver on)
    let unitsReady = 0, unitsAsked = false;
    const wantUnits = hero.finish && hero.units?.length && !navigator.connection?.saveData;
    const askUnits = () => {
      if (unitsAsked || !wantUnits) return;
      unitsAsked = true;
      Promise.all(hero.units.map((u) => stage.loadUnit(u.id))).then(() => { unitsReady = 1; apply(); });
    };

    let p = 0, idle = 0, heroNight = false;
    const darks = [];
    let heroVis = null;
    const updateNav = () => nav?.classList.toggle('dark', (heroVis?.isActive && heroNight) || darks.some((t) => t.isActive));
    // pointer parallax: the camera leans a little towards the cursor (desktop only)
    const par = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e) => { par.tx = (e.clientX / innerWidth - 0.5) * 2; par.ty = (e.clientY / innerHeight - 0.5) * 2; };
    if (!narrow && !reduced) heroEl.addEventListener('pointermove', onPointer);
    // floor tags beside the exploded stack: anchored to the corner that sits right-most on screen
    const [bx, bz] = [hero.bounds.x[1] + 0.8, hero.bounds.z[0]];
    const gap = hero.floorH * 1.6;
    let tagAlpha = 0;
    const placeTags = () => {
      if (!tags.length) return;
      stage.levels.forEach((l, i) => {
        const n = tags[i]; if (!n) return;
        if (tagAlpha < 0.02) { n.style.opacity = 0; return; }
        const [x, y, front] = stage.project([bx, l.y + stage.state.explode * gap * i + hero.floorH * 0.45, bz]);
        n.style.opacity = front ? tagAlpha : 0;
        n.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
    };
    const offFrame = stage.onFrame(placeTags);
    const apply = () => {
      let i = 0; while (i < K.length - 2 && p >= K[i + 1].t) i++;
      const a = K[i], b = K[i + 1];
      const f = (p - a.t) / (b.t - a.t);
      const e = smooth(Math.max(0, Math.min(1, (f - 0.3) / 0.7)));   // hold the first third of each phase, move through the rest
      const c = orbitLerp(a, b, e);
      // a slow turn while the page is still at the top: the drawing drifts under the headline
      const ang = c.ang + idle * (1 - Math.min(1, p / 0.08)) + par.x * 0.05;
      // the keys frame a wide screen; narrower viewports back the camera off so the building still fits
      const k = Math.max(1, Math.min(2.6, 1.78 / ((stageEl.clientWidth || 1) / (stageEl.clientHeight || 1))));
      stage.setCamera([c.look[0] + Math.cos(ang) * c.r * k, c.look[1] + c.h * k - par.y * c.r * 0.035, c.look[2] + Math.sin(ang) * c.r * k], c.look, c.fov);
      const alpha = lerp(a.alpha, b.alpha, e);
      const explode = lerp(a.explode, b.explode, e);
      stage.set({
        explode, cut: lerp(a.cut, b.cut, e), focus: e < 0.5 ? a.focus : b.focus, buildingAlpha: alpha,
        wire: lerp(a.wire, b.wire, e), context: lerp(a.context, b.context, e), finish: lerp(a.finish, b.finish, e) * unitsReady,
      });
      stage.setNight(lerp(a.night, b.night, e));
      blueprint.style.opacity = lerp(a.wire, b.wire, e) * 0.9;
      // tags fade in with the explode and out again as the cut-away begins
      tagAlpha = smooth(Math.max(0, Math.min(1, (explode - 0.35) / 0.5))) * (1 - smooth(Math.max(0, Math.min(1, lerp(a.cut, b.cut, e) / 0.5))));
      const active = e < 0.5 ? i : i + 1;
      phaseEls.forEach((n, j) => n.classList.toggle('on', j === active));
      if (bar) bar.style.transform = `scaleY(${p})`;
      const fade = Math.max(0, 1 - p / 0.14);
      copyEl.style.opacity = fade; copyEl.style.transform = `translateY(${(1 - fade) * -40}px)`; copyEl.style.pointerEvents = fade > 0.3 ? 'auto' : 'none';
      heroEl.classList.toggle('scrolled', p > 0.03);
      if (p > 0.03) hideHint();
      if (p > 0.12) askUnits();
      heroNight = lerp(a.night, b.night, e) > 0.5;
      heroEl.classList.toggle('is-night', heroNight);
      updateNav();
    };
    const cur = { t: 0 };
    const st = ScrollTrigger.create({
      trigger: heroEl, start: 'top top', end: 'bottom bottom', scrub: reduced ? false : 0.5,
      onUpdate: (self) => { gsap.to(cur, { t: self.progress, duration: reduced ? 0 : 0.3, overwrite: true, ease: 'power2.out', onUpdate: () => { p = cur.t; apply(); } }); },
    });
    heroVis = ScrollTrigger.create({ trigger: heroEl, start: 'top 60px', end: 'bottom 60px', onToggle: updateNav });
    const tick = (_t, deltaMs) => {   // ticker delta is in ms
      let moved = false;
      if (p < 0.08 && !reduced) { idle += (deltaMs / 1000) * 0.035; moved = true; }
      if (Math.abs(par.tx - par.x) > 1e-3 || Math.abs(par.ty - par.y) > 1e-3) { par.x += (par.tx - par.x) * 0.06; par.y += (par.ty - par.y) * 0.06; moved = true; }
      if (moved) apply();
    };
    gsap.ticker.add(tick);
    apply();
    // the shot rig waits on this: true once the model and, when wanted, the furnished flats are in
    window.__heroReady = () => stageEl.classList.contains('ready') && (!unitsAsked || unitsReady === 1);

    // ---------- page animations ----------
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      // fromTo with explicit end values: a from() that has not started when the effect re-runs
      // (Fast Refresh, strict mode) is reverted to its hidden state and would animate 0 → 0
      tl.fromTo('.ld-hero-copy .ld-line', { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.12 }, 0.3)
        .fromTo('.ld-hero-copy .kicker, .ld-hero-copy .copy, .ld-hero-copy .ld-actions', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.1 }, 0.9)
        .fromTo('.ld-phase, .ld-hbar, .ld-cue, .ld-live', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, 1.3);

      gsap.utils.toArray('.ld-rv').forEach((node) => {
        gsap.fromTo(node, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: node, start: 'top 88%', toggleActions: 'play none none reverse' } });
      });
      gsap.utils.toArray('.ld-stagger').forEach((group) => {
        gsap.fromTo(group.children, { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.09, ease: 'power3.out', scrollTrigger: { trigger: group, start: 'top 85%', toggleActions: 'play none none reverse' } });
      });
      gsap.utils.toArray('.ld-manifesto .ld-line').forEach((line, i) => {
        gsap.fromTo(line, { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'power3.out', delay: i * 0.12, scrollTrigger: { trigger: line, start: 'top 85%', toggleActions: 'play none none reverse' } });
      });
      gsap.utils.toArray('.ld-num').forEach((n) => {
        const target = parseFloat(n.dataset.n), dec = Number(n.dataset.dec || 0);
        const o = { v: 0 };
        gsap.to(o, { v: target, duration: 1.8, ease: 'power2.out', scrollTrigger: { trigger: n, start: 'top 90%' }, onUpdate: () => { n.textContent = o.v.toFixed(dec); } });
      });
      // the sketch steps with the pipeline list
      gsap.utils.toArray('.ld-step').forEach((s, i) => {
        ScrollTrigger.create({ trigger: s, start: 'top 58%', end: 'bottom 58%', onToggle: (self) => { if (self.isActive) { setSketchStep(i + 1); s.classList.add('on'); } else s.classList.remove('on'); } });
      });
      // dark sections tint the nav
      gsap.utils.toArray('.ld-dark').forEach((s) => {
        darks.push(ScrollTrigger.create({ trigger: s, start: 'top 60px', end: 'bottom 60px', onToggle: updateNav }));
      });
      // project cards: parallax image and a pointer tilt
      gsap.utils.toArray('.ld-card').forEach((card) => {
        const img = card.querySelector('img');
        gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
        if (narrow) return;
        const onMove = (e) => {
          const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(card, { rotateY: x * 7, rotateX: -y * 7, transformPerspective: 1000, duration: 0.5, ease: 'power2.out' });
          card.style.setProperty('--mx', `${(x + 0.5) * 100}%`); card.style.setProperty('--my', `${(y + 0.5) * 100}%`);
        };
        const onLeave = () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.9, ease: 'power3.out' });
        card.addEventListener('pointermove', onMove); card.addEventListener('pointerleave', onLeave);
      });
    }, root);

    return () => {
      gsap.ticker.remove(tick); st.kill(); heroVis.kill(); ctx.revert(); offFrame(); clearTimeout(hintTimer);
      heroEl.removeEventListener('pointermove', onPointer); stageEl.removeEventListener('pointerdown', hideHint);
      stage.dispose(); nav?.classList.remove('dark'); delete window.__heroReady;
    };
  }, [hero]);


  return (
    <div ref={root} className="ld">
      {/* ---------- hero: the live building ---------- */}
      <section className="ld-hero" id="top">
        <div className="ld-view">
          <div className="ld-stage" role="img" aria-label={`Live 3D model of ${hero.name}. Drag to look around; scroll to take it apart.`} />
          <div className="ld-blueprint" aria-hidden="true" />
          <div className="ld-loader" aria-hidden="true"><i /></div>
          <div className="ld-hero-copy">
            <p className="kicker">{PRODUCT.name} · immersive real estate</p>
            <h1><span className="gs-clip"><span className="ld-line">Every building</span></span><span className="gs-clip"><em className="ld-line">has a storey.</em></span></h1>
            <p className="copy">{PRODUCT.pitch}</p>
            <div className="ld-actions">
              <Link className="ld-btn" href={PROJECT_LIST[0].href}>Walk a live project</Link>
              <a className="ld-btn ghost" href="#projects">See the projects</a>
            </div>
          </div>
          <ol className="ld-phases" aria-label="What the scroll does to the model">
            {HERO_PHASES.map((ph) => (
              <li key={ph.id} className="ld-phase"><b>{ph.step}</b><span><strong>{ph.title}</strong><small>{ph.copy}</small></span></li>
            ))}
          </ol>
          <div className="ld-tags" aria-hidden="true">
            {hero.levels.map(([k, , label]) => <span key={k} className={`ld-tag${k === hero.typical ? ' typ' : ''}`}><i />{label}{k === hero.typical ? <small>typical</small> : null}</span>)}
          </div>
          <div className="ld-hbar" aria-hidden="true"><i /></div>
          <div className="ld-live"><i /><span>Live model · {hero.name}</span></div>
          <div className="ld-hint" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11M12 10.5V7.5a1.5 1.5 0 0 1 3 0v3M15 10v-1a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.4-1.8L9 15" /></svg>Drag to look around</div>
          <a className="ld-cue" href="#why"><span>Scroll to build it</span><svg width="14" height="22" viewBox="0 0 14 22" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="12" height="20" rx="6" /><path d="M7 5v4" /></svg></a>
        </div>
      </section>

      {/* ---------- ticker ---------- */}
      <div className="ld-ticker ld-dark" aria-hidden="true">
        <div className="ld-ticker-track">{[...TICKER, ...TICKER].map((w, i) => <span key={i}>{w}<i /></span>)}</div>
      </div>

      {/* ---------- manifesto ---------- */}
      <section className="ld-manifesto ld-dark" id="why">
        <div className="wrap ld-mf">
          <p className="ld-sec">01 — Why</p>
          <h2>{MANIFESTO.problem.map((l) => <span key={l} className="gs-clip"><span className="ld-line">{l}</span></span>)}</h2>
          <div className="ld-mf-answer ld-rv">
            <p className="ld-lede">{MANIFESTO.answer}</p>
            <p className="ld-note">Built from the DWG, not from a mood board.</p>
          </div>
        </div>
        <div className="ld-glow" aria-hidden="true" />
      </section>

      {/* ---------- pipeline ---------- */}
      <section className="ld-pipeline" id="pipeline">
        <div className="wrap">
          <header className="ld-head ld-rv">
            <p className="ld-sec">02 — Pipeline</p>
            <h2>From drawings to a world, <em>in six moves.</em></h2>
            <p className="copy">Nothing is modelled by hand. The drawings the architect already made are the only input.</p>
          </header>
          <div className="ld-pipe">
            <div className="ld-sketch-wrap"><div className="ld-sketch-card"><PlanSketch step={sketchStep} /><p className="ld-sketch-cap">2 BHK · typical floor · {PIPELINE[Math.max(0, sketchStep - 1)].title}</p></div></div>
            <ol className="ld-steps">
              {PIPELINE.map((s) => (
                <li key={s.n} className="ld-step"><b>{s.n}</b><h3>{s.title}</h3><p>{s.copy}</p></li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- capabilities ---------- */}
      <section className="ld-caps" id="platform">
        <div className="wrap">
          <header className="ld-head ld-rv">
            <p className="ld-sec">03 — Platform</p>
            <h2>One model, <em>every way to look at it.</em></h2>
            <p className="copy">Every capability runs on the same building, in the browser, with no plug-ins and nothing to install.</p>
          </header>
          <ul className="ld-cap-grid ld-stagger">
            {CAPABILITIES.map((c) => (
              <li key={c.id} className="ld-cap"><Icon id={c.id} /><h3>{c.title}</h3><p>{c.copy}</p></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- live projects ---------- */}
      <section className="ld-projects" id="projects">
        <div className="wrap">
          <header className="ld-head ld-rv">
            <p className="ld-sec">04 — Live projects</p>
            <h2>Three buildings, <em>already on the platform.</em></h2>
            <p className="copy">Each one is a complete experience built from its own drawing set. Open any of them; they are the product.</p>
          </header>
          <div className="ld-grid ld-stagger">
            {PROJECT_LIST.map((p) => (
              <Link key={p.slug} href={p.href} className="ld-card" style={{ '--accent': p.accent }}>
                <figure><img src={p.card} alt={p.name} loading="lazy" /><span className="ld-livepill"><i />Live</span></figure>
                <div className="ld-body">
                  <p className="kicker">{p.developer}</p>
                  <h3>{p.name}</h3>
                  <p className="ld-type">{p.type}</p>
                  <ul className="facts">{p.facts.map(([v, l]) => <li key={l}><b>{v}</b>{l}</li>)}</ul>
                  <p className="copy small">{p.blurb}</p>
                  <ul className="ld-chips">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                  <span className="ld-open">Open the experience <i>→</i></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- numbers ---------- */}
      <section className="ld-stats">
        <ul className="wrap ld-stagger">
          {STATS.map((s) => (
            <li key={s.label}><b className="ld-num" data-n={s.n} data-dec={s.dec || 0}>0</b><span>{s.label}</span></li>
          ))}
        </ul>
      </section>

      {/* ---------- who it is for ---------- */}
      <section className="ld-who" id="for">
        <div className="wrap">
          <header className="ld-head ld-rv">
            <p className="ld-sec">05 — Who it’s for</p>
            <h2>The same world, <em>three ways to use it.</em></h2>
          </header>
          <ul className="ld-who-grid ld-stagger">
            {AUDIENCES.map((a) => (
              <li key={a.who}><p className="kicker">{a.who}</p><h3>{a.title}</h3><p>{a.copy}</p></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- call to action ---------- */}
      <section className="ld-cta ld-dark" id="contact">
        <div className="wrap ld-rv">
          <StoreyMark size={56} />
          <h2>Bring the drawings.<br /><em>Leave with a world.</em></h2>
          <p className="ld-lede">One plan set in, one link out: it opens on any phone, with the building on its street, its floors, its flats and its night.</p>
          <div className="ld-actions">
            <Link className="ld-btn ghost light" href={PROJECT_LIST[0].href}>Walk a live project</Link>
          </div>
        </div>
        <div className="ld-glow" aria-hidden="true" />
      </section>

      <footer className="ld-foot ld-dark">
        <div className="wrap">
          <div className="ld-foot-brand"><StoreyMark size={28} /><span><b>{PRODUCT.name}</b> · {PRODUCT.byline}</span></div>
          <ul className="ld-foot-links">{PROJECT_LIST.map((p) => <li key={p.slug}><Link href={p.href}>{p.name}</Link></li>)}</ul>
          <p className="fine">Models stream encrypted to the viewer’s browser only. The site asks AI crawlers not to train on its media. © {new Date().getFullYear()}.</p>
        </div>
      </footer>
    </div>
  );
}
