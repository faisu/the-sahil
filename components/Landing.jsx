'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PROJECT_LIST } from '@/lib/projects';

gsap.registerPlugin(ScrollTrigger);

// Landing page: one card per hosted project, animated in with GSAP; each card opens its tour.
export default function Landing() {
  const root = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.ld-hero .ld-line', { yPercent: 110, duration: 1.0, stagger: 0.12 }, 0.1)
        .from('.ld-hero p', { y: 18, autoAlpha: 0, duration: 0.8 }, 0.7)
        .from('.ld-card', { y: 60, autoAlpha: 0, duration: 0.9, stagger: 0.14 }, 0.9);
      gsap.utils.toArray('.ld-card').forEach((card) => {
        const img = card.querySelector('img');
        gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
        const onMove = (e) => {
          const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(card, { rotateY: x * 6, rotateX: -y * 6, transformPerspective: 900, duration: 0.5, ease: 'power2.out' });
        };
        const onLeave = () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.8, ease: 'power3.out' });
        card.addEventListener('pointermove', onMove); card.addEventListener('pointerleave', onLeave);
      });
      gsap.from('.ld-how li', { y: 30, autoAlpha: 0, stagger: 0.12, duration: 0.8, scrollTrigger: { trigger: '.ld-how', start: 'top 80%' } });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="ld">
      <section className="ld-hero">
        <div className="wrap">
          <p className="kicker">3D property showcases</p>
          <h1><span className="gs-clip"><span className="ld-line">Every project,</span></span><span className="gs-clip"><em className="ld-line">built from its drawings</em></span></h1>
          <p className="copy">Three developments, three virtual tours. Each building is modelled from the architect’s AutoCAD plans and sections, furnished from the furniture layouts, and explored with a scroll-driven camera: arrival, the stack of floors, a cut-away typical floor, the flats, the terrace, the night view.</p>
        </div>
      </section>
      <section className="ld-grid wrap">
        {PROJECT_LIST.map((p) => (
          <Link key={p.slug} href={p.href} className="ld-card" style={{ '--accent': p.accent }}>
            <figure><img src={p.card} alt={p.name} loading="lazy" /></figure>
            <div className="ld-body">
              <p className="kicker">{p.developer}</p>
              <h2>{p.name}</h2>
              <p className="ld-type">{p.type}</p>
              <ul className="facts">{p.facts.map(([v, l]) => <li key={l}><b>{v}</b>{l}</li>)}</ul>
              <p className="copy small">{p.blurb}</p>
              <span className="cta">Open the tour →</span>
            </div>
          </Link>
        ))}
      </section>
      <section className="ld-how wrap">
        <p className="kicker">How the tours are made</p>
        <ul>
          <li><b>Drawings in</b>AutoCAD plans, sections and elevations are read directly; walls, windows, doors, stairs, lifts and shafts are extracted per floor.</li>
          <li><b>Model out</b>Each floor becomes a separate 3D layer, so the tour can cut the building open, pull the stack apart and highlight a flat.</li>
          <li><b>Furnished</b>Furniture and electrical layouts place every bed, wardrobe, fan and switch board; finishes follow the specification.</li>
          <li><b>Protected</b>Models are streamed encrypted to the viewer’s browser only; crawlers and downloaders get nothing.</li>
        </ul>
      </section>
      <footer className="footer ld-foot">
        <div className="wrap"><p className="fine">3D property showcases</p></div>
      </footer>
    </div>
  );
}
