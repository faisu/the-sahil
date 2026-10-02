'use client';
import { useEffect, useRef } from 'react';
import { preload } from 'react-dom';
import { initUnits, floorInfo, FLOOR_GROUPS } from '@/lib/units';
import { MODELS, LEVELS } from '@/lib/scene';

const tagClass = (t) => (/sea/i.test(t) ? 'sea' : /refuge/i.test(t) ? 'refuge' : 'amen');
const shortNo = (l) => (l === 'T' || l === 'G' || l === 'B' ? l : String(+l.slice(1)));
const shortKind = (l) => (l === 'T' ? 'Terrace' : l === 'G' ? 'Ground' : l === 'B' ? 'Basement' : 'Floor');

function FloorCard({ level }) {
  const d = floorInfo(level);
  return (
    <div role="button" tabIndex={0} className="fcard" data-level={level} aria-pressed="false">
      <div className="no">{shortNo(level)}<small>{shortKind(level)}</small></div>
      <div className="t">
        <b>{d.type}</b><span>{d.sub}</span>
        <div className="tags">{d.tags.map((t) => <span key={t} className={`tag ${tagClass(t)}`}>{t}</span>)}</div>
      </div>
      <span className={`status ${d.status}`}>{d.status === 'na' ? 'Common area' : d.status}</span>
      <div className="more">
        <div className="row">
          <span><b>Level</b> +{d.y.toFixed(2)} m</span>
          {d.area && <span><b>Area</b> {d.area}</span>}
          <span><b>Floor height</b> {level === 'T' ? '—' : '3.0 m'}</span>
        </div>
        <ul>{d.features.map((f) => <li key={f}>{f}</li>)}</ul>
        <div className="row">
          <a className="enq" href={`mailto:Sales@metroestates.net?subject=${encodeURIComponent('Enquiry: The Sahil, ' + d.label)}`}>Enquire</a>
          <button type="button" className="ghostbtn" data-plan={level}>Plan view</button>
          <button type="button" className="ghostbtn" data-fl={level}>3D floor</button>
        </div>
      </div>
    </div>
  );
}

export default function UnitsView() {
  preload(MODELS.core, { as: 'fetch', crossOrigin: 'anonymous' });
  const root = useRef(null);
  useEffect(() => initUnits(root.current), []);
  const residenceFloors = LEVELS.filter((l) => /^F/.test(l)).length;

  return (
    <main ref={root}>
      <header className="units-head">
        <div className="wrap">
          <h1><small>The Sahil · Mahim</small>Flat units <em>overview</em></h1>
          <div className="stats">
            <div><b>{residenceFloors}</b>Residence floors</div>
            <div><b>1</b>Flat per floor</div>
            <div><b>5</b>BHK</div>
            <div><b>69<span style={{ fontSize: '.5em' }}> m</span></b>Terrace level</div>
          </div>
        </div>
      </header>

      <section className="wrap units-layout">
        <div className="viewer">
          <div className="vprogress"><i /></div>
          <canvas id="units-stage" aria-label="Interactive 3D floor stack of The Sahil" />
          <div className="toolbar">
            <div className="grp" role="group" aria-label="View">
              <button type="button" data-mode="tower" aria-pressed="true">Tower</button>
              <button type="button" data-mode="floor" aria-pressed="false">Floor</button>
              <button type="button" data-mode="plan" aria-pressed="false">Plan</button>
            </div>
            <div className="grp">
              <button type="button" data-explode aria-pressed="false">Explode</button>
              <button type="button" data-basement aria-pressed="false">Basement</button>
              <button type="button" data-reset>Reset</button>
            </div>
          </div>
          <div className="vlabel"><b>The Sahil</b><span>G + 22 · 69.3 m · 24 levels</span></div>
          <div className="vfoot">
            <div className="legend">
              <span><i style={{ background: '#f2ece2', border: '1px solid #c9c1b1' }} />Selected floor</span>
              <span><i style={{ background: 'rgba(166,200,228,.5)' }} />Other floors</span>
              <span><i style={{ background: '#8dbfe3' }} />Glass</span>
            </div>
            <div className="hover" />
            <div>Hover · click a floor · drag to orbit</div>
          </div>
        </div>

        <aside>
          <div className="floor-list" aria-label="Floors">
            {FLOOR_GROUPS.map(([title, levels]) => (
              <div key={title} style={{ display: 'contents' }}>
                <div className="grp-title">{title}</div>
                {levels.map((l) => <FloorCard key={l} level={l} />)}
              </div>
            ))}
          </div>
          <p className="units-note">Levels, floor heights, refuge areas and the two carpet areas marked “per drawing” come from structural drawing R0 dated 06-07-26 (Space Consulting / Kazi &amp; Associates). Typical carpet areas are indicative and the availability badges are placeholder demo data, to be replaced by the sales CRM feed.</p>
        </aside>
      </section>

      <section className="wrap compare-plan">
        <div className="grid">
          <figure>
            <span className="chip">Typical Floor Plan</span>
            <picture><source srcSet="/assets/img/floor-plan.webp" type="image/webp" /><img src="/assets/img/floor-plan.jpg" alt="Typical 5 BHK floor plan" width="1600" height="667" loading="lazy" decoding="async" /></picture>
          </figure>
          <figure>
            <span className="chip">Isometric View</span>
            <picture><source srcSet="/assets/img/floor-iso.webp" type="image/webp" /><img src="/assets/img/floor-iso.jpg" alt="Isometric cutaway of the 5 BHK residence" width="1600" height="681" loading="lazy" decoding="async" /></picture>
          </figure>
        </div>
      </section>
    </main>
  );
}
