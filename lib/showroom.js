// Showroom data for the Dadamiya projects: camera presets (derived from the tour keyframes, so
// both stay framed the same way), the model state each preset needs, and the hotspots on the
// building's exterior. Floor-plan hotspots come from project.finish.hotspots (lib/projects.js).
//
// Exterior hotspot anchors are either a fixed model-frame point [x, y, z] or a mesh category on
// a level ({ cat, level }), resolved at runtime to the top of that category's bounding box, so
// the pin sits on the modelled tank / car park / machine room rather than a guessed spot.
import { keyframes } from './tourKeys.js';

const typY = (p) => p.levels.find((l) => l[0] === p.typical)[1];
const topY = (p) => p.levels[p.levels.length - 1][1];

/** cam/look pair -> orbit parameters about the look point */
export function toOrbit({ cam, look, fov }) {
  const ox = cam[0] - look[0], oy = cam[1] - look[1], oz = cam[2] - look[2];
  const r = Math.hypot(ox, oy, oz);
  return { tx: look[0], ty: look[1], tz: look[2], theta: Math.atan2(oz, ox), phi: Math.asin(oy / r), r, fov: fov || 38 };
}
export function fromOrbit(o) {
  const c = Math.cos(o.phi);
  return { cam: [o.tx + Math.cos(o.theta) * c * o.r, o.ty + Math.sin(o.phi) * o.r, o.tz + Math.sin(o.theta) * c * o.r], look: [o.tx, o.ty, o.tz], fov: o.fov };
}

const EXT = { focus: null, cut: 0, explode: 0, finish: 0 };

/** Named camera presets ("views") for a project. mode: which top-level toggle the view belongs to. */
export function showroomViews(p) {
  const K0 = keyframes({ ...p, H: topY(p) });
  // the tour's keyframes look from the south; a project whose front is on the north side mirrors them
  const flip = (k) => (p.viewFrom === 'north' && k?.cam ? { ...k, cam: [k.cam[0], k.cam[1], 2 * k.look[2] - k.cam[2]] } : k);
  const K = { ...K0, arrive: flip(K0.arrive), stilt: flip(K0.stilt), terrace: flip(K0.terrace), stack: flip(K0.stack) };
  const arrive = toOrbit(K.arrive);
  const H = topY(p), R = Math.max(p.bounds.x[1] - p.bounds.x[0], p.bounds.z[1] - p.bounds.z[0]);
  const HX = H + p.floorH * 1.6 * (p.levels.length - 1);
  // fit: the extent (m) the preset must keep in frame, so it works on any screen shape
  const views = [
    { id: 'facade', label: 'Façade', mode: 'exterior', orbit: arrive, fit: { h: (H + 4.5) * 1.25, w: R * 1.2, d: R * 0.5 }, state: EXT },
    { id: 'aerial', label: 'Aerial', mode: 'exterior', orbit: { ...arrive, phi: 1.0, r: arrive.r * 1.15, ty: H * 0.35, theta: arrive.theta + (p.viewFrom === 'north' ? 0.5 : -0.5) }, fit: { h: Math.max(H, R) * 1.2, w: R * 1.6, d: R * 0.5 }, state: EXT },
    { id: 'entrance', label: p.slug === 'mansouza' ? 'Stilt & parking' : 'Stilt & entrance', mode: 'exterior', orbit: toOrbit(K.stilt), state: EXT },
    { id: 'terrace', label: 'Terrace', mode: 'exterior', orbit: toOrbit(K.terrace), state: EXT },
    { id: 'stack', label: 'Floor stack', mode: 'exterior', orbit: toOrbit(K.stack), fit: { h: HX * 1.15, w: R * 1.4, d: R * 0.6 }, state: { ...EXT, explode: 1 } },
    { id: 'floor', label: p.flatLevels ? 'Flats by floor' : 'Typical floor', mode: 'interior', orbit: toOrbit(K.floor), fit: { h: R * 0.75, w: R * 1.15 }, state: { focus: p.typical, cut: 1, explode: 0, finish: p.finish ? 1 : 0 } },
  ];
  return views;
}

/** Orbit for the furnished unit dollhouse */
export function unitOrbit(p, id) {
  const k = keyframes({ ...p, H: topY(p) })['unit' + id];
  const u = p.units.find((x) => x.id === id);
  // look in from about 55° or more: at the tour's lower angle the 2.55 m walls hide the narrow rooms
  return k ? { ...toOrbit(k), ...(toOrbit(k).phi < 0.95 ? { phi: 0.95 } : {}), fit: { h: 0, w: Math.max(u.bounds.x[1] - u.bounds.x[0], u.bounds.z[1] - u.bounds.z[0]) * 1.2 } } : null;
}

/** Cut-away at any level: the floors above are lifted off, the level is seen from above */
export function levelOrbit(p, level) {
  const K = keyframes({ ...p, H: topY(p) });
  const o = { ...toOrbit(K.floor), fit: { h: 0, w: Math.max(p.bounds.x[1] - p.bounds.x[0], p.bounds.z[1] - p.bounds.z[0]) * 1.15 } };
  const y = (p.levels.find((l) => l[0] === level) || [0, 0])[1];
  return { ...o, ty: y, phi: Math.max(o.phi, 0.7) };
}

const EXTERIOR_HOTSPOTS = {
  'krishna-kaveri': (p) => [
    { id: 'stilt', label: 'Stilt parking', anchor: { cat: 'Cars', level: 'G' }, view: 'entrance',
      title: 'Stilt parking and entrance', lines: ['Cars park on the stilt floor around the two cores', 'Entrance lobby, society office, fitness centre and meter room sit between the columns', 'A 3 m driveway rings the plot inside the compound wall'] },
    { id: 'chowk', label: 'Inner chowk', anchor: [0, topY(p) + 0.6, 0], view: 'floor',
      title: 'Open-to-sky inner chowk', lines: ['Shared courtyard between the two wings, open from the stilt to the sky', 'Lobby windows of both wings look into it', 'Brings daylight and cross-ventilation to the lift lobbies'] },
    { id: 'core', label: 'Lift & stair core', anchor: [6.6, topY(p) + 2.7, -0.8],
      title: 'Lift and staircase, one per wing', lines: ['One lift and one three-flight staircase per wing', 'Headroom boxes rise 2.4 m over the terrace', 'Six flats reached from each core on every floor'] },
    { id: 'avs', label: 'Ventilation shafts', anchor: [9.2, typY(p) + 1.4, 5.8],
      title: 'Air-ventilation shafts', lines: ['Toilets and kitchens ventilate into A.V.S. shafts', 'The shafts read as white vertical boxes on the peach façade', 'Finished with parapeted tops on the terrace'] },
    { id: 'chajja', label: '1.2 m chajjas', anchor: [15.4, typY(p) + 2.2, 1.2],
      title: 'Chajjas over the alcove bays', lines: ['1.2 m projections shade the alcove windows', 'Window sills at 0.80 m, heads at 2.45 m (north elevation)', 'The terrace outline widens over them, as drawn'] },
    { id: 'terrace', label: 'Terrace', anchor: [-9, topY(p) + 1.2, -10.5], view: 'terrace',
      title: 'The terrace, +16.15 m', lines: ['1.0 m parapet all round', 'Lift and stair headrooms around the open chowk', 'No overhead tank is drawn on the terrace plan'] },
  ],
  mansouza: (p) => [
    { id: 'parking', label: 'Puzzle parking', anchor: { cat: 'Cars', level: 'G' }, view: 'entrance',
      title: 'Mechanical puzzle parking', lines: ['Puzzle parking fills the stilt floor', 'It continues on the first-floor deck beside the society office (deck modelled without cars)', 'Entrance lobby, pump room and meter room sit at the core'] },
    { id: 'core', label: 'Stair & lift headroom', anchor: { cat: 'TerraceCore', level: 'T' }, view: 'floor',
      title: 'Central staircase and two lifts', lines: ['One three-flight staircase wraps a central well', 'Two lifts; the stair and lift headroom rises 4.2 m above the terrace', 'Fire-rated doors to every flat'] },
    { id: 'tank', label: 'Overhead tank', anchor: { cat: 'OverheadTank', level: 'T' }, view: 'terrace',
      title: 'Overhead water tank', lines: ['Overhead water storage on the terrace, above a 1 m parapet', 'The drawing shows two tanks; only the south-east one is a closed outline, so only it is modelled'] },
    { id: 'avs', label: 'Ventilation shafts', anchor: [1.1, typY(p) + 1.4, -8.3],
      title: 'Air-ventilation shafts', lines: ['Four A.V.S. shafts ventilate the toilets', 'Kitchens and toilets stack floor to floor'] },
    { id: 'chajja', label: '0.60 m chajjas', anchor: [11.8, typY(p) + 2.2, 1.6],
      title: '0.60 m cantilevered chajjas', lines: ['0.60 m chajjas over every window', '0.15 m cornices at the floor bands', '0.30 m chajja over the staircase windows'] },
  ],
};
export const exteriorHotspots = (p) => (EXTERIOR_HOTSPOTS[p.slug] || (() => []))(p);

/** What each building does and does not have for the showroom, shown in the info sheet */
export const SHOWROOM_GAPS = {
  'krishna-kaveri': [
    'Rooms are seen from one standing point each; there is no free walk through a flat yet.',
    'All five floors repeat the typical plan, so a flat type looks the same on every floor and in each mirror position.',
    'Façade colour options are not offered: the only colour scheme on record is the architect’s peach render.',
    'Stilt lobby, fitness centre and society office are in the plan but not furnished.',
    'The road, trees, street lamps and neighbouring houses are indicative context, not from a site plan.',
    'Interior finishes, furniture and colours are a neutral assumption: no material schedule is on record.',
    'Rendered stills and 360° views are from this model, not from the developer’s brochure.',
  ],
  mansouza: [
    'No interior walk at eye level yet: the flats are shown as furnished dollhouses and in the floor cut-away.',
    'Flats are furnished by room type: no furniture drawing was supplied for Mansouza.',
    'Façade colour options are not offered: no colour scheme or render is on record.',
    'Only the 4th-floor plan (2nd to 5th) is furnished. The 6th to 10th floor plans are modelled but not furnished.',
    'The road, trees, parked cars, street lamps and neighbouring blocks are indicative context, not from a site plan.',
  ],
};

/** A storey seen from outside: the camera level with it, on the side the visitor is already looking from */
export function facadeLevelOrbit(p, level, theta) {
  const arrive = showroomViews(p)[0].orbit;
  const i = Math.max(0, p.levels.findIndex((l) => l[0] === level));
  const y0 = p.levels[i][1], y1 = i + 1 < p.levels.length ? p.levels[i + 1][1] : y0 + 1.0;
  const b = p.bounds, R = Math.max(b.x[1] - b.x[0], b.z[1] - b.z[0]);
  return { tx: (b.x[0] + b.x[1]) / 2, ty: (y0 + y1) / 2, tz: (b.z[0] + b.z[1]) / 2, theta: theta ?? arrive.theta, phi: 0.1, r: R * 1.3, fov: arrive.fov,
    fit: { h: Math.max(y1 - y0, 2.5) * 4.5, w: R * 1.25, d: R * 0.55 } };
}
