'use client';
import { useRef } from 'react';
import { sunTimes, dayOfYear } from '@/lib/atmosphere';

// 24-hour clock for the showroom: drag the hand (noon at the top, midnight at the bottom) or use the
// slider, presets and season; the stage puts the sun where it stands at that time in Mumbai.
const fmt = (h) => { const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const SEASONS = [
  { id: 'today', label: 'Today', doy: () => dayOfYear() },
  { id: 'mar', label: '21 Mar', doy: () => 80 },
  { id: 'jun', label: '21 Jun', doy: () => 172 },
  { id: 'sep', label: '23 Sep', doy: () => 266 },
  { id: 'dec', label: '21 Dec', doy: () => 355 },
];
const S = 176, C = S / 2, R = 66;
const pt = (h, r = R) => { const a = ((h - 12) / 24) * Math.PI * 2; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
function arc(h0, h1, r) {
  const [x0, y0] = pt(h0, r), [x1, y1] = pt(h1, r);
  const span = ((h1 - h0) % 24 + 24) % 24;
  return `M${x0} ${y0}A${r} ${r} 0 ${span > 12 ? 1 : 0} 1 ${x1} ${y1}`;
}

export default function SunClock({ hour, doy, sun, playing, accent, onHour, onPreset, onDoy, onPlay, onNight, onClose }) {
  const svg = useRef(null);
  const { rise, set } = sunTimes(doy);
  const night = sun ? sun.night > 0.5 : false;
  const season = SEASONS.find((x) => x.doy() === doy)?.id || 'other';
  const now = () => { const d = new Date(); const ist = (d.getUTCHours() + d.getUTCMinutes() / 60 + 5.5) % 24; onDoy(dayOfYear()); onPreset(ist); };
  const presets = [
    ['Sunrise', rise + 0.1], ['Morning', 9], ['Noon', 12.5], ['Golden hour', set - 0.6], ['Dusk', set + 0.35], ['Night', 21],
  ];
  const drag = (e) => {
    const r = svg.current.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    const a = Math.atan2(x, -y);   // clockwise from the top
    let h = 12 + (a / (Math.PI * 2)) * 24; h = ((h % 24) + 24) % 24;
    onHour(Math.round(h * 12) / 12);
  };
  const [hx, hy] = pt(hour), [ix, iy] = pt(hour, R - 22);
  const dirTxt = sun && sun.el > 0 ? `Sun ${Math.round(sun.el)}° up in the ${COMPASS[Math.round(sun.az / 45) % 8]}` : sun && sun.el > -6 ? 'Twilight' : 'After dark';
  return (
    <div className="sr-sheet sr-clock" role="dialog" aria-label="Time of day">
      <div className="hd"><b>Sun &amp; shadows</b><button type="button" className="x" onClick={onClose} aria-label="Close">×</button></div>
      <div className="dialrow">
        <svg ref={svg} viewBox={`-12 -12 ${S + 24} ${S + 24}`} className="dial" style={{ '--acc': accent }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(e); }}
          onPointerMove={(e) => { if (e.buttons) drag(e); }} aria-hidden="true">
          <circle cx={C} cy={C} r={R} className="night" />
          <path d={arc(rise, set, R)} className="day" />
          {Array.from({ length: 24 }, (_, h) => { const [a, b] = pt(h, R + 6), [c, d] = pt(h, R + (h % 6 ? 9 : 12)); return <line key={h} x1={a} y1={b} x2={c} y2={d} className="tick" />; })}
          {[0, 6, 12, 18].map((h) => { const [x, y] = pt(h, R + 20); return <text key={h} x={x} y={y + 3.5} className="lab">{String(h).padStart(2, '0')}</text>; })}
          <line x1={C} y1={C} x2={ix} y2={iy} className="hand" />
          <circle cx={hx} cy={hy} r={11} className={`knob${night ? ' moon' : ''}`} />
          <text x={C} y={C - 2} className="big">{fmt(hour)}</text>
          <text x={C} y={C + 15} className="sm">{!sun ? '' : sun.el > 15 ? 'daylight' : sun.el > 0 ? 'low sun' : sun.el > -6 ? 'twilight' : 'night'}</text>
        </svg>
        <div className="side">
          <p className="dir">{dirTxt}</p>
          <p className="rs"><span>Sunrise <b>{fmt(rise)}</b></span><span>Sunset <b>{fmt(set)}</b></span></p>
          <div className="btns">
            <button type="button" className={`play${playing ? ' on' : ''}`} onClick={onPlay} aria-pressed={playing}>{playing ? 'Pause' : 'Play the day'}</button>
            <button type="button" onClick={onNight}>{night ? 'Day' : 'Night'}</button>
            <button type="button" onClick={now}>Now</button>
          </div>
        </div>
      </div>
      <input type="range" min="0" max="23.917" step="0.0833" value={hour} onChange={(e) => onHour(parseFloat(e.target.value))} aria-label="Time of day" aria-valuetext={fmt(hour)} />
      <div className="chips" role="group" aria-label="Times">
        {presets.map(([l, h]) => <button type="button" key={l} onClick={() => onPreset(h)}>{l}<small>{fmt(h)}</small></button>)}
      </div>
      <div className="chips seasons" role="group" aria-label="Season">
        {SEASONS.map((x) => <button type="button" key={x.id} className={season === x.id ? 'on' : ''} onClick={() => onDoy(x.doy())}>{x.label}</button>)}
      </div>
      <p className="fine">Sun path for Mumbai (19.1° N) in IST, with the drawing’s north taken as true north. Street lamps, the footpath and the neighbouring blocks are indicative context, not from the drawings.</p>
    </div>
  );
}
