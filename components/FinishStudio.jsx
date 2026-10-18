'use client';
import { useEffect, useRef, useState } from 'react';

// Finished cut-away of the typical floor, layered over the GSAP tour's stage while the tour holds on
// the floor stop: labelled pins with room/flat cards, a before/after divider between the CAD
// linework and the finished render, the floor schedule, zoom, a focus view and a PNG download.

const PIN_H = 1.5;   // pin height above the finished floor (m)
const area = (rooms) => rooms.reduce((s, [, w, d]) => s + w * d, 0);
const fmt = (v) => v.toFixed(2);

function cardFor(p, h) {
  if (h.unit) {
    const u = p.units.find((x) => x.id === h.unit);
    const row = p.finish.schedule?.rows.find((r) => r.flat === `Unit ${h.unit}`);
    const sec = p.story.find((s) => s.unit === h.unit);
    return {
      kicker: row ? `${row.type} · ${row.count} per floor` : 'Furnished flat', title: u.name,
      stats: [[u.carpet, 'carpet (modelled)']],
      lines: u.rooms.split(' · '), link: sec && { href: `#${sec.id}`, text: `Walk through ${sec.title}` },
    };
  }
  if (h.flat) {
    const r = p.finish.schedule.rows.find((x) => x.flat === h.flat);
    return {
      kicker: `${r.type} · ${levelName(p)}`, title: `Flat ${r.flat}`,
      stats: [[`${area(r.rooms).toFixed(1)} m²`, 'sum of rooms'], [String(r.rooms.filter(([n]) => /bed/i.test(n)).length), 'bedrooms']],
      lines: r.rooms.map(([n, w, d]) => `${n} ${fmt(w)} × ${fmt(d)} m`),
    };
  }
  return { kicker: levelName(p), title: h.title, lines: h.lines };
}
const levelName = (p) => (p.levels.find((l) => l[0] === p.typical) || [])[2] || 'Typical floor';

export default function FinishStudio({ project: p, stage, active }) {
  const root = useRef(null);
  const pins = useRef({});
  const [open, setOpen] = useState(null);       // hotspot id with its card open
  const [split, setSplit] = useState(null);     // 0..1 across the visible stage region, null = off
  const [specs, setSpecs] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const F = p.finish;
  const typY = (p.levels.find((l) => l[0] === p.typical) || [0, 0])[1];

  // leaving the floor stop resets everything
  useEffect(() => {
    if (active) return;
    setOpen(null); setSplit(null); setSpecs(false); setFocus(false);
    if (stage) { stage.setZoom(1); setZoom(1); }
  }, [active, stage]);
  useEffect(() => { document.body.classList.toggle('fs-focus', focus && active); return () => document.body.classList.remove('fs-focus'); }, [focus, active]);

  // centre the floor in the visible part of the stage (the tour panel covers the left of the canvas)
  useEffect(() => {
    if (!stage) return;
    const upd = () => { const r = root.current?.getBoundingClientRect(); stage.setShift(active && r && innerWidth > 820 ? (r.left + r.width / 2) - innerWidth / 2 : 0); };
    upd(); addEventListener('resize', upd);
    return () => { removeEventListener('resize', upd); stage.setShift(0); };
  }, [active, stage, focus]);

  // stage split follows the divider (stage takes a fraction of the whole canvas)
  useEffect(() => {
    if (!stage) return;
    if (split == null || !active) { stage.setSplit(null); return; }
    const r = root.current.getBoundingClientRect();
    stage.setSplit((r.left + r.width * split) / innerWidth);
  }, [split, active, stage, focus]);

  // pins follow the camera every rendered frame
  useEffect(() => {
    if (!stage || !F) return;
    const place = () => {
      const r = root.current?.getBoundingClientRect(); if (!r) return;
      for (const h of F.hotspots) {
        const el = pins.current[h.id]; if (!el) continue;
        const [x, y, vis] = stage.project([h.at[0], typY + PIN_H, h.at[1]]);
        const inside = vis && x > r.left + 8 && x < r.right - 8 && y > r.top + 56 && y < r.bottom - 8;
        el.style.transform = `translate(${x - r.left}px, ${y - r.top}px)`;
        el.classList.toggle('off', !inside);
      }
    };
    const off = stage.onFrame(place);
    addEventListener('resize', place);
    place();
    return () => { off(); removeEventListener('resize', place); };
  }, [stage, F, typY]);

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { setOpen(null); setSpecs(false); setFocus(false); } };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);

  if (!F) return null;

  const dragDivider = (e) => {
    e.preventDefault();
    const r = root.current.getBoundingClientRect();
    const move = (ev) => setSplit(Math.max(0.04, Math.min(0.96, (ev.clientX - r.left) / r.width)));
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
    move(e);
  };
  const zoomBy = (f) => setZoom(stage.setZoom(stage.zoom * f));
  const download = async () => {
    if (!stage || busy) return;
    setBusy(true);
    const r = root.current.getBoundingClientRect();
    try {
      const blob = await stage.capture({ scale: 2, crop: { x: r.left, y: r.top, w: r.width, h: r.height } });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${p.slug}-${levelName(p).replace(/\s+/g, '-').toLowerCase()}-${split == null ? 'finished' : 'before-after'}.png`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } finally { setBusy(false); }
  };
  const card = open && cardFor(p, F.hotspots.find((h) => h.id === open));
  const furnished = !!F.copies;

  return (
    <div ref={root} className={`fs${active ? ' on' : ''}${split != null ? ' splitting' : ''}`} aria-hidden={!active}>
      <div className="fs-bar">
        <button type="button" className={split != null ? 'sel' : ''} onClick={() => setSplit(split == null ? 0.5 : null)} aria-pressed={split != null}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v16M3 5h5v10H3zM12 5h5v10h-5z" /></svg>Before / After
        </button>
        <button type="button" onClick={() => setSpecs(true)}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h12v14H4zM7 7h6M7 10h6M7 13h4" /></svg>Floor specs
        </button>
        <button type="button" className="pri" onClick={download} disabled={busy}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M6 8l4 4 4-4M4 16h12" /></svg>{busy ? 'Rendering…' : 'Download'}
        </button>
      </div>

      {split == null
        ? <span className="fs-badge">{furnished ? 'Finished 3D cut-away' : 'Finished floor cut-away'}</span>
        : <><span className="fs-badge cad" style={{ left: 16 }}>CAD linework</span><span className="fs-badge" style={{ left: 'auto', right: 16 }}>Finished</span></>}

      <div className="fs-pins">
        {F.hotspots.map((h) => (
          <button type="button" key={h.id} ref={(n) => { pins.current[h.id] = n; }} className={`fs-pin off${open === h.id ? ' sel' : ''}${h.unit || h.flat ? ' flat' : ''}`}
            onClick={() => setOpen(open === h.id ? null : h.id)} aria-expanded={open === h.id}>
            <i /><span>{h.label}</span>
          </button>
        ))}
      </div>

      {card && (
        <aside className="fs-card" role="dialog" aria-label={card.title}>
          <button type="button" className="x" onClick={() => setOpen(null)} aria-label="Close">×</button>
          <p className="k">{card.kicker}</p>
          <h3>{card.title}</h3>
          {card.stats && <ul className="st">{card.stats.map(([v, l]) => <li key={l}><b>{v}</b>{l}</li>)}</ul>}
          <ul className="ln">{card.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {card.link && <a className="go" href={card.link.href} onClick={() => setOpen(null)}>{card.link.text} ↓</a>}
        </aside>
      )}

      {split != null && (
        <div className="fs-divider" style={{ left: `${split * 100}%` }} onPointerDown={dragDivider}>
          <span role="slider" aria-label="Before / after divider" aria-valuenow={Math.round(split * 100)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit(Math.max(0.04, split - 0.05)); if (e.key === 'ArrowRight') setSplit(Math.min(0.96, split + 0.05)); }}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5l-4 5 4 5M13 5l4 5-4 5" /></svg>
          </span>
        </div>
      )}

      <div className="fs-tools">
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom in"><svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4M6.5 9h5M9 6.5v5" /></svg></button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom out"><svg viewBox="0 0 20 20"><circle cx="9" cy="9" r="5.5" /><path d="M13 13l4 4M6.5 9h5" /></svg></button>
        <button type="button" className="pct" onClick={() => setZoom(stage.setZoom(1))} title="Reset zoom">{Math.round(zoom * 100)}%</button>
        <i />
        <button type="button" onClick={() => setFocus(!focus)} aria-pressed={focus} aria-label={focus ? 'Show the tour panel' : 'Expand the view'}>
          <svg viewBox="0 0 20 20">{focus ? <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" /> : <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />}</svg>
        </button>
        <button type="button" onClick={download} aria-label="Download this view"><svg viewBox="0 0 20 20"><path d="M10 3v9M6 8l4 4 4-4M4 16h12" /></svg></button>
      </div>

      {specs && (
        <div className="fs-modal" role="dialog" aria-modal="true" aria-label="Floor specifications" onClick={(e) => { if (e.target === e.currentTarget) setSpecs(false); }}>
          <div className="box">
            <button type="button" className="x" onClick={() => setSpecs(false)} aria-label="Close">×</button>
            <p className="k">{p.name} · {levelName(p)}</p>
            <h3>Floor schedule</h3>
            <table>
              <thead><tr><th>Flat</th><th>Type</th><th>Area</th><th>Rooms</th></tr></thead>
              <tbody>
                {F.schedule.rows.map((r) => (
                  <tr key={r.flat}>
                    <td><b>{r.flat}</b>{r.count ? <small>× {r.count} per floor</small> : null}</td>
                    <td>{r.type}</td>
                    <td className="num">{(r.area ?? area(r.rooms)).toFixed(1)} m²</td>
                    <td>{Array.isArray(r.rooms) ? r.rooms.map(([n, w, d]) => `${n} ${fmt(w)} × ${fmt(d)}`).join(' · ') : r.rooms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">{F.schedule.note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
