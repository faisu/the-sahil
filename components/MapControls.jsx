'use client';
import { useEffect, useState } from 'react';

const VIEW_IDS = ['plot', 'sea', 'shore', 'area', 'city'];
const VIEW_LABELS = { plot: 'The plot', sea: 'From the sea', shore: 'Shoreline', area: 'Neighbourhood', city: 'Mumbai' };

// Location panel controls for the map stage. Chips and the drive-time list ([data-dest]
// buttons rendered by HomeContent) send 'sahil:map' events that lib/tour.js forwards to the
// map; the tour answers with 'sahil:view' so the active chip and note stay in sync.
export default function MapControls() {
  const [view, setView] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    const dests = [...document.querySelectorAll('#location [data-dest]')];
    const onDest = (e) => { e.preventDefault(); dispatchEvent(new CustomEvent('sahil:map', { detail: { flyTo: e.currentTarget.dataset.dest } })); };
    dests.forEach((d) => d.addEventListener('click', onDest));
    const onView = (e) => {
      const { id, v } = e.detail;
      if (!id) { setView(null); setNote(''); dests.forEach((d) => d.removeAttribute('aria-current')); return; }
      const dest = id.startsWith('dest:');
      setView(dest ? null : id);
      setNote(dest ? `${v.name} · about ${v.mins} minutes by road` : v.note);
      dests.forEach((d) => d.toggleAttribute('aria-current', dest && d.dataset.dest === id.slice(5)));
    };
    addEventListener('sahil:view', onView);
    return () => { removeEventListener('sahil:view', onView); dests.forEach((d) => d.removeEventListener('click', onDest)); };
  }, []);
  const go = (id) => dispatchEvent(new CustomEvent('sahil:map', { detail: { go: id } }));
  const resume = () => dispatchEvent(new CustomEvent('sahil:map', { detail: { resume: true } }));
  return (
    <div className="map-ui">
      <div className="map-views" role="group" aria-label="Map views">
        {VIEW_IDS.map((id) => (
          <button key={id} type="button" aria-pressed={view === id} onClick={() => go(id)}>{VIEW_LABELS[id]}</button>
        ))}
      </div>
      {note && <p className="map-note">{note} · <button type="button" className="map-resume" onClick={resume}>back to the tour</button></p>}
    </div>
  );
}
