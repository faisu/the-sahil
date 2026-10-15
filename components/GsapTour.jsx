'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { getProject, PROJECT_LIST } from '@/lib/projects';
import { createProjectStage } from '@/lib/projectStage';

gsap.registerPlugin(ScrollTrigger);

// Scroll-driven, GSAP-timed tour of a Dadamiya project. The 3D stage is fixed behind the page;
// each story section is a ScrollTrigger that scrubs the camera along an orbit between keyframes
// and drives the model state (cut-away level, exploded stack, furnished unit overlay, night).
// Panels, numbers and the progress rail are animated with GSAP as they enter.

function keyframes(p) {
  const [cx, cy, cz] = p.center; const H = p.H ?? p.levels[p.levels.length - 1][1];
  const R = Math.max(p.bounds.x[1] - p.bounds.x[0], p.bounds.z[1] - p.bounds.z[0]);
  const typY = p.levels.find((l) => l[0] === p.typical)[1];
  const D = Math.max(R * 1.6, H * 1.35);                      // arrival distance: whole building in frame, tall or wide
  const HX = H + p.floorH * 1.6 * (p.levels.length - 1);        // height of the exploded stack
  const K = {
    arrive:  { cam: [cx + D * 0.8, H * 0.7 + 6, cz + D], look: [cx, H * 0.45, cz], fov: 38 },
    stilt:   { cam: [cx + R * 1.05, 2.2, cz + R * 1.35], look: [cx, 1.6, cz], fov: 44, cut: 0 },
    stack:   { cam: [cx + HX * 0.75, HX * 0.9 + 6, cz + HX * 0.9], look: [cx, HX * 0.5, cz], fov: 36, explode: 1 },
    floor:   { cam: [cx + R * 0.35, typY + R * 1.15, cz + R * 0.85], look: [cx, typY, cz - R * 0.05], fov: 34, focus: p.typical, cut: 1 },
    terrace: { cam: [cx + R * 0.9, H + R * 0.95, cz + R * 1.1], look: [cx, H, cz], fov: 36 },
    night:   { cam: [cx + D * 0.95, H * 0.6 + 6, cz + D * 0.95], look: [cx, H * 0.42, cz], fov: 38, night: 1 },
  };
  for (const u of p.units || []) {
    const ux = (u.bounds.x[0] + u.bounds.x[1]) / 2, uz = (u.bounds.z[0] + u.bounds.z[1]) / 2;
    const uw = Math.max(u.bounds.x[1] - u.bounds.x[0], u.bounds.z[1] - u.bounds.z[0]);
    K['unit' + u.id] = { cam: [ux + uw * 0.9, typY + uw * 0.95, uz + uw * 1.1], look: [ux, typY + 0.8, uz], fov: 40, unit: u.id, focus: p.typical, cut: 1, orbit: { c: [ux, typY + 0.8, uz], r: uw * 1.35, h: uw * 0.95 } };
  }
  return K;
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function orbitLerp(a, b, t) {
  const look = lerp3(a.look, b.look, t);
  const da = [a.cam[0] - a.look[0], a.cam[1] - a.look[1], a.cam[2] - a.look[2]];
  const db = [b.cam[0] - b.look[0], b.cam[1] - b.look[1], b.cam[2] - b.look[2]];
  const ra = Math.max(.1, Math.hypot(da[0], da[2])), rb = Math.max(.1, Math.hypot(db[0], db[2]));
  let aa = Math.atan2(da[2], da[0]), ab = Math.atan2(db[2], db[0]);
  if (ab - aa > Math.PI) ab -= 2 * Math.PI; else if (aa - ab > Math.PI) ab += 2 * Math.PI;
  const ang = lerp(aa, ab, t), r = Math.exp(lerp(Math.log(ra), Math.log(rb), t)), h = lerp(da[1], db[1], t) * (r / lerp(ra, rb, t));
  return { look, cam: [look[0] + Math.cos(ang) * r, look[1] + h, look[2] + Math.sin(ang) * r], fov: lerp(a.fov || 38, b.fov || 38, t) };
}

export default function GsapTour({ slug }) {
  const project = getProject(slug);
  const root = useRef(null);

  useEffect(() => {
    const p = project; if (!p) return;
    const el = root.current;
    const stageEl = el.querySelector('#gstage');
    const narrow = matchMedia('(max-width: 820px)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stage = createProjectStage(stageEl, p, { narrow });
    const K = keyframes({ ...p, H: stage.H });
    const sections = [...el.querySelectorAll('main > section[id], main > footer[id]')];
    const DEF = { explode: 0, cut: 0, focus: null, night: 0, unit: null };
    const keys = sections.map((s) => ({ ...DEF, ...(K[s.id] || K.arrive), id: s.id }));
    // sections without a key hold the previous camera
    for (let i = 1; i < keys.length; i++) if (!K[sections[i].id]) keys[i] = { ...keys[i - 1], id: sections[i].id, night: keys[i - 1].night };

    const loader = el.querySelector('.loader i'), note = el.querySelector('.load-note');
    stage.load(({ loaded, total }) => { if (loader && total) loader.style.width = `${Math.min(100, 100 * loaded / total)}%`; })
      .then(() => { stageEl.classList.add('ready'); loader?.parentElement.classList.add('done'); note?.classList.add('done'); })
      .catch((e) => { console.error(e); note && (note.textContent = 'The 3D model could not be loaded'); });
    for (const u of p.units || []) stage.loadUnit(u.id);   // start early, they are 2–3 MB each

    // ---- camera + model state scrubbed per section ----
    const cur = { t: 0 };   // global progress in section units
    const apply = (gi) => {
      const i = Math.max(0, Math.min(keys.length - 1, Math.floor(gi))), f = gi - i;
      const a = keys[i], b = keys[Math.min(keys.length - 1, i + 1)];
      const s = f < 0.5 ? 0 : (f - 0.5) * 2;   // hold the first half of a section, move during the second
      const e = s * s * (3 - 2 * s);
      let cam;
      if (a.orbit && b.orbit && a.unit === b.unit) cam = a;
      else cam = orbitLerp(a, b, e);
      // inside a unit section the camera orbits slowly around the furnished unit
      const ob = f < 0.5 ? a : b;
      if (ob.orbit && (f < 0.5 ? true : e > 0.95)) {
        const ang = (f < 0.5 ? f : f - 1) * Math.PI * 0.9 + Math.PI * 0.25;
        cam = { cam: [ob.orbit.c[0] + Math.cos(ang) * ob.orbit.r, ob.orbit.c[1] + ob.orbit.h, ob.orbit.c[2] + Math.sin(ang) * ob.orbit.r], look: ob.orbit.c, fov: ob.fov };
      }
      stage.setCamera(cam.cam, cam.look, cam.fov);
      const unit = e < 0.5 ? a.unit : b.unit;
      const unitAlpha = a.unit === b.unit ? (a.unit ? 1 : 0) : (a.unit ? Math.max(0, 1 - e * 2) : Math.max(0, e * 2 - 1));
      const focus = e < 0.5 ? a.focus : b.focus;
      stage.set({
        explode: lerp(a.explode, b.explode, e), cut: lerp(a.cut, b.cut, e), focus,
        unit, unitAlpha, buildingAlpha: 1 - unitAlpha,
      });
      stage.setNight(lerp(a.night, b.night, e));
    };
    const st = ScrollTrigger.create({
      trigger: el.querySelector('main'), start: 'top top', end: 'bottom bottom', scrub: reduced ? false : 0.6,
      onUpdate: (self) => { const gi = self.progress * (sections.length - 1); gsap.to(cur, { t: gi, duration: reduced ? 0 : 0.35, overwrite: true, ease: 'power2.out', onUpdate: () => apply(cur.t) }); },
    });
    apply(0);

    // ---- panel reveals, counters, rail ----
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.gs-rv').forEach((node) => {
        gsap.fromTo(node, { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: node, start: 'top 88%', toggleActions: 'play none none reverse' } });
      });
      gsap.utils.toArray('.gs-num').forEach((n) => {
        const target = parseFloat(n.dataset.n), dec = (n.dataset.n.split('.')[1] || '').length;
        const o = { v: 0 };
        gsap.to(o, { v: target, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: n, start: 'top 90%' }, onUpdate: () => { n.textContent = o.v.toFixed(dec); } });
      });
      // hero intro
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.gs-hero .gs-line', { yPercent: 110, duration: 1.1, stagger: 0.12 }, 0.2)
        .from('.gs-hero .gs-sub', { y: 20, autoAlpha: 0, duration: 0.8 }, 0.8)
        .from('.gs-hero .gs-fact', { y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, 1.0)
        .from('.gs-hero .cue', { autoAlpha: 0, duration: 0.8 }, 1.4);
      // progress rail
      const dots = [...el.querySelectorAll('.gs-rail a')];
      sections.forEach((s, i) => {
        ScrollTrigger.create({ trigger: s, start: 'top 50%', end: 'bottom 50%', onToggle: (self) => { if (self.isActive) { dots.forEach((d, j) => d.classList.toggle('on', j === i)); document.body.classList.toggle('night', keys[i].night > 0.5); } } });
      });
      // panel parallax: the brochure column drifts slightly slower than the page
      gsap.utils.toArray('.gs-panel .body').forEach((body) => {
        gsap.fromTo(body, { y: narrow ? 0 : 40 }, { y: narrow ? 0 : -40, ease: 'none', scrollTrigger: { trigger: body.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }, el);

    return () => { st.kill(); ctx.revert(); stage.dispose(); document.body.classList.remove('night'); };
  }, [project]);

  if (!project) return null;
  const p = project;
  const next = PROJECT_LIST[(PROJECT_LIST.findIndex((x) => x.slug === p.slug) + 1) % PROJECT_LIST.length];
  const steps = p.story;

  return (
    <div ref={root} className="gs" style={{ '--accent': p.accent }}>
      <div className="loader"><i /></div>
      <div className="load-note">Loading 3D model</div>
      <div id="gstage" className="stage" role="img" aria-label={`3D model of ${p.name}. Drag to look around.`} />
      <div className="hint"><span className="h-drag">Drag to look around</span><span className="h-swipe">Swipe sideways to look around</span><span className="h-scroll">Scroll to tour</span></div>
      <nav className="gs-rail" aria-label="Tour steps">
        <a href="#cover" className="on" title="Start" />
        {steps.map((s) => <a key={s.id} href={`#${s.id}`} title={s.title} />)}
        <a href="#contact" title="Contact" />
      </nav>

      <main>
        <section id="cover" className="sec cover gs-hero" data-title={p.name}>
          <div className="inner">
            <p className="gs-sub kicker">{p.developer} · {p.place}</p>
            <h1 className="hero"><span className="gs-clip"><span className="gs-line">{p.name.split(' ')[0]}</span></span><span className="gs-clip"><em className="gs-line">{p.name.split(' ').slice(1).join(' ') || p.tagline.split(',')[0]}</em></span></h1>
            <p className="gs-sub where">{p.tagline} · {p.type}</p>
            <ul className="facts" aria-label="At a glance">
              {p.facts.map(([v, l]) => <li key={l} className="gs-fact"><b>{v}</b>{l}</li>)}
            </ul>
            <p className="gs-sub copy">{p.blurb}</p>
          </div>
          <a className="cue" href={`#${steps[0].id}`}>Start the virtual tour <i /></a>
        </section>

        {steps.map((s, i) => {
          const unit = s.unit ? p.units.find((u) => u.id === s.unit) : null;
          return (
            <section key={s.id} id={s.id} className={`sec split gs-panel${s.id === 'night' ? ' nightsec' : ''}`} data-title={s.title}>
              <div className="panel">
                <div className="logo-top"><span className="gs-brand">{p.name}</span><span className="step">{s.step}</span></div>
                <div className="body">
                  <p className="kicker gs-rv">{s.kicker}</p>
                  <h2 className="display sm gs-rv">{s.title}</h2>
                  {unit ? (
                    <>
                      <p className="copy gs-rv">{unit.name}. {unit.rooms}.</p>
                      <ul className="gs-stats gs-rv">
                        <li><b><span className="gs-num" data-n={parseFloat(unit.carpet)}>0</span> m²</b>carpet (modelled)</li>
                        <li><b>{p.levels.filter((l) => /^F/.test(l[0])).length}</b>floors with this unit</li>
                      </ul>
                      <p className="copy small gs-rv">Furnished from the architect’s furniture and electrical drawing: every bed, wardrobe, sofa, dining set, kitchen platform, sanitary fitting, fan, downlight, switch board, socket and AC point sits where the drawing puts it. Scroll slowly to orbit the flat.</p>
                    </>
                  ) : <p className="copy gs-rv">{s.copy}</p>}
                  {s.id === 'stack' && (
                    <ul className="gs-levels gs-rv">
                      {[...p.levels].reverse().map(([k, y, label]) => <li key={k}><b>{label}</b><span>+{y.toFixed(2)} m</span></li>)}
                    </ul>
                  )}
                </div>
                <div className="logo-bot"><span className="gs-dev">{p.developer}</span></div>
              </div>
            </section>
          );
        })}

        <footer id="contact" className="footer gs-footer" data-title="Contact">
          <div className="wrap">
            <p className="kicker" style={{ color: 'var(--accent)' }}>{p.developer}</p>
            <h2 className="display sm">{p.name}</h2>
            <p className="tag">{p.place}</p>
            <ul className="facts" style={{ justifyContent: 'center', margin: '1.5rem 0' }}>{p.facts.map(([v, l]) => <li key={l}><b>{v}</b>{l}</li>)}</ul>
            <div className="gs-next">
              <Link className="cta" href={next.href}>Next project: {next.name} →</Link>
              <Link className="ghost" href="/">All projects</Link>
            </div>
            <p className="disclaimer">The 3D model is generated from the architect’s AutoCAD drawings (plans, section and elevations) and furnished from the furniture and electrical layout; it is indicative. Specifications, layouts and areas are subject to the agreement and to approval of the authorities. Furniture: Poly Haven and Kenney (CC0).</p>
            <p className="fine">Virtual tour · {p.name} · {p.developer}</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
