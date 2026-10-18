// Registry of the projects hosted by this site. The Sahil keeps its own bespoke tour
// (lib/tour.js); the Dadamiya projects share the GSAP tour (components/GsapTour.jsx +
// lib/projectStage.js) driven by the data below. Model frames: glTF Y-up metres, ground = 0;
// the Dadamiya models are centred on the staircase of the typical plan (x east, z south).
import { MZ_UNITS } from './mzUnits.js';

const kkLevels = [['G', 0.15, 'Stilt'], ['F01', 2.65, '1st floor'], ['F02', 5.35, '2nd floor'], ['F03', 8.05, '3rd floor'], ['F04', 10.75, '4th floor'], ['F05', 13.45, '5th floor'], ['T', 16.15, 'Terrace']];
const mzLevels = [['G', 0.15, 'Stilt'], ['F01', 2.95, '1st floor'], ['F02', 5.85, '2nd floor'], ['F03', 8.75, '3rd floor'], ['F04', 11.65, '4th floor'], ['F05', 14.55, '5th floor'],
  ['F06', 17.45, '6th floor'], ['F07', 20.35, '7th floor'], ['F08', 23.25, '8th floor'], ['F09', 26.15, '9th floor'], ['F10', 29.05, '10th floor'], ['T', 31.95, 'Terrace']];

export const PROJECTS = {
  sahil: {
    slug: 'sahil', kind: 'bespoke', href: '/sahil',
    name: 'The Sahil', tagline: 'Luxury begins here', place: 'SVS Road, Mahim · Mumbai',
    developer: 'Metro Estates × Quba Groups', type: 'Sea-facing tower · 5 BHK, one flat per floor',
    facts: [['22', 'storeys'], ['1', 'flat per floor'], ['69 m', 'above the bay']],
    accent: '#2d6ae0', card: '/assets/img/tower-day.jpg',
    features: ['Real map of Mahim', 'Eye-level walk-through', 'Rooftop pool', 'By night'],
    blurb: 'A 22-storey landmark on the Mahim shoreline, modelled from the structural drawings and furnished after the brochure. Scroll tour on the real map of Mahim, a walk through the residence and the rooftop pool.',
  },
  'krishna-kaveri': {
    slug: 'krishna-kaveri', kind: 'gsap', href: '/krishna-kaveri',
    name: 'Krishna Kaveri', tagline: 'Twelve homes, two wings, one courtyard', place: 'Gaonthan village road · Mumbai suburbs',
    developer: 'Dadamiya Infrastructure LLP', type: 'Stilt + 5 · 2 BHK, 1 BHK and compact 1 BHK',
    facts: [['G+5', 'storeys'], ['12', 'flats per floor'], ['3', 'unit types']],
    accent: '#c47a2c', card: '/assets/img/kk-render.jpg',
    features: ['Exploded stack', 'Cut-away floor', '3 furnished units', 'By night'],
    blurb: 'A stilt-plus-five building in two wings around an open inner chowk, lifts and staircases in each wing, every flat furnished from the architect’s furniture and electrical drawings.',
    models: { core: 'kk_core', detail: 'kk_detail' },
    levels: kkLevels, floorH: 2.7, typical: 'F03',
    // model-frame extents (metres): building footprint and the plot, used for framing and floor picking
    bounds: { x: [-15.6, 15.6], z: [-13.0, 13.0], plot: { x: [-20, 19.5], z: [-15.3, 15.1] } },
    center: [0, 8.2, 0], wall: 0xf2cda0,
    units: [
      { id: 'A', model: 'kk_unit_A', name: 'Unit A · 2 BHK corner flat', carpet: '52.6 m²', rooms: 'Living/dining 3.20 × 6.40 · kitchen 4.35 × 2.10 · bedrooms 4.05 × 2.75 and 3.05 × 2.75 · two toilets', bounds: { x: [-15.55, -4.75], z: [-12.0, -2.15] } },
      { id: 'B', model: 'kk_unit_B', name: 'Unit B · 1 BHK with alcove kitchen', carpet: '37.7 m²', rooms: 'Living/dining 5.80 × 2.60 with two alcoves · bedroom 3.90 × 2.65 · two toilets', bounds: { x: [-15.55, -8.3], z: [-6.6, 1.4] } },
      { id: 'C', model: 'kk_unit_C', name: 'Unit C · compact 1 BHK', carpet: '32.8 m²', rooms: 'Living/dining 2.75 × 5.80 · kitchen 2.05 × 2.55 · bedroom 3.20 × 3.35 · two toilets', bounds: { x: [-4.8, 0.1], z: [-12.0, -2.15] } },
    ],
    // finished cut-away of the typical floor: the twelve flats are mirror copies of A, B and C about
    // the model axes; B's alcove strip straddles z = 0 and is shared with its mirror
    finish: {
      copies: [[1, 1], [-1, 1], [1, -1], [-1, -1]], dedupe: { B: 1.45 }, floor: 'marble_01', view: 1.2,
      hotspots: [
        { id: 'A', at: [10.15, 7.1], label: 'Unit A · 2 BHK', unit: 'A' },
        { id: 'B', at: [12.6, 3.6], label: 'Unit B · 1 BHK', unit: 'B' },
        { id: 'C', at: [2.35, 7.1], label: 'Unit C · 1 BHK', unit: 'C' },
        { id: 'chowk', at: [0, 0], label: 'Inner chowk', title: 'Open-to-sky inner chowk', lines: ['Shared courtyard between the two wings, open from the stilt to the sky', 'Lobby windows of both wings look into it', 'Brings daylight and cross-ventilation to the lift lobbies'] },
        { id: 'core', at: [6.6, -0.8], label: 'Lift & staircase', title: 'Lift and staircase, wing A', lines: ['One lift and one three-flight staircase per wing', 'Lift lobby opens onto the chowk', 'Six flats reached from each core'] },
        { id: 'avs', at: [9.2, 5.8], label: 'A.V.S. shafts', title: 'Air-ventilation shafts', lines: ['Toilets and kitchens ventilate into A.V.S. shafts', 'The shafts read as white vertical boxes on the façade', 'Finished with parapeted tops on the terrace'] },
        { id: 'chajja', at: [15.4, 1.2], label: '1.2 m chajjas', title: 'Chajjas over the alcove bays', lines: ['1.2 m projections shade the alcove windows', 'Window sills at 0.90 m, lintels at 2.10 m', 'MS grills on the windows'] },
      ],
      schedule: {
        note: 'Carpet areas measured on the 3D model from the architect’s typical plan; four flats of each type on every floor (mirror copies).',
        rows: [
          { flat: 'Unit A', type: '2 BHK corner', count: 4, area: 52.6, rooms: 'Living/dining 3.20 × 6.40 · kitchen 4.35 × 2.10 · bedrooms 4.05 × 2.75, 3.05 × 2.75 · two toilets' },
          { flat: 'Unit B', type: '1 BHK + alcove kitchen', count: 4, area: 37.7, rooms: 'Living/dining 5.80 × 2.60 · two alcoves · bedroom 3.90 × 2.65 · two toilets' },
          { flat: 'Unit C', type: 'Compact 1 BHK', count: 4, area: 32.8, rooms: 'Living/dining 2.75 × 5.80 · kitchen 2.05 × 2.55 · bedroom 3.20 × 3.35 · two toilets' },
        ],
      },
    },
    story: [
      { id: 'arrive', step: '01 · Arrival', kicker: 'Dadamiya Infrastructure LLP', title: 'Krishna Kaveri', copy: 'Twelve homes on each of five floors, in two wings that share an open-to-sky inner chowk. Stilt parking below, a terrace above, white ventilation shafts drawing vertical lines up the peach façade.' },
      { id: 'stilt', step: '02 · Stilt floor', kicker: 'Ground level', title: 'Park under the building', copy: 'Cars park on the stilt floor around the two cores. The entrance lobby, society office, fitness centre and meter room sit between the columns; a 3 m driveway rings the plot inside the compound wall.' },
      { id: 'stack', step: '03 · The stack', kicker: 'Five typical floors', title: 'Every floor, pulled apart', copy: 'The floors lift away from each other to show the repeating plan: two lifts, two staircases, the chowk in the middle and the flats wrapped around it.' },
      { id: 'floor', step: '04 · Typical floor', kicker: 'Cut away at the 3rd floor', title: 'Twelve flats, three types', copy: 'Each wing has a 2 BHK at the corner, a 1 BHK with an alcove kitchen beside the lift and a compact 1 BHK facing the chowk, mirrored on both sides. One of each type is furnished.' },
      { id: 'unitA', step: '05 · Unit A', kicker: '2 BHK · corner', title: 'Unit A', unit: 'A' },
      { id: 'unitB', step: '06 · Unit B', kicker: '1 BHK · alcove kitchen', title: 'Unit B', unit: 'B' },
      { id: 'unitC', step: '07 · Unit C', kicker: 'Compact 1 BHK', title: 'Unit C', unit: 'C' },
      { id: 'terrace', step: '08 · Terrace', kicker: '+16.15 m', title: 'The terrace', copy: 'Lift and stair headrooms rise over the chowk, the ventilation shafts finish in parapeted boxes, and the 1.2 m chajjas wrap the alcove bays.' },
      { id: 'night', step: '09 · By night', kicker: 'Evening', title: 'Lit from within', copy: 'Warm light in the windows, the courtyard open to the sky.' },
    ],
  },
  mansouza: {
    slug: 'mansouza', kind: 'gsap', href: '/mansouza',
    name: 'Mansouza CHSL', tagline: 'Redevelopment, ten floors over puzzle parking', place: 'Chembur · Mumbai',
    developer: 'Dadamiya Infrastructure LLP', type: 'Stilt + 10 · 1 and 2 BHK redevelopment',
    facts: [['G+10', 'storeys'], ['32 m', 'to the terrace'], ['2', 'lifts']],
    accent: '#3f80b4', card: '/assets/img/mz-tour.jpg',
    features: ['Exploded stack', 'Cut-away floor', 'Puzzle parking', 'By night'],
    blurb: 'A stilt-plus-ten redevelopment on an irregular plot: puzzle parking at the stilt and on the first-floor deck, one staircase and two lifts, overhead tanks and lift machine rooms on the terrace.',
    models: { core: 'mz_core', detail: 'mz_detail' },
    levels: mzLevels, floorH: 2.9, typical: 'F04',
    bounds: { x: [-8.9, 11.5], z: [-13.3, 9.9], plot: { x: [-20, 18], z: [-22, 26] } },
    center: [1.3, 16, -1.7], wall: 0xebe4d7,
    // every flat of the typical floor furnished (no furniture drawing: placed by room type, tools/dadamiya/mz_units.py);
    // flats are not rectangles, so each carries its outline for the cut-away
    units: [
      ['401', '1 BHK', 'Living 3.05 × 4.55 · bedroom 2.75 × 3.25 · kitchen 2.15 × 2.25 · two toilets'],
      ['402', '1 BHK', 'Living 3.05 × 4.55 · bedroom 2.75 × 3.25 · kitchen 2.15 × 2.25 · two toilets'],
      ['403', '2 BHK', 'Living 2.75 × 5.00 · bedrooms 3.05 × 3.00 and 3.20 × 3.20 · kitchen 2.30 × 2.20 · two toilets'],
      ['404', '1 BHK', 'Living 5.15 × 2.75 · bedroom 2.60 × 2.75 · kitchen 2.15 × 2.10 · toilet'],
      ['405', '2 BHK + study', 'Living 2.75 × 5.35 · dining 2.80 × 2.30 · bedrooms 2.90 × 2.75 and 3.15 × 3.05 · study 3.15 × 2.10 · kitchen 2.10 × 2.95 · three toilets'],
      ['406', '2 BHK', 'Living 5.70 × 2.75 · bedrooms 3.45 × 2.75 and 3.15 × 2.75 · kitchen 2.15 × 2.10 · three toilets'],
    ].map(([id, type, rooms]) => ({ id, name: `Flat ${id} · ${type}`, rooms, ...MZ_UNITS[id], carpet: `${MZ_UNITS[id].carpet} m²` })),
    // the finished cut-away of the 4th floor: the six furnished flats in place, the core in finish
    // materials. Room sizes are the architect's dimensions; flats are numbered 1 to 6 at their doors.
    finish: {
      copies: [[1, 1]], floor: 'oak_wood_planks', wall: 0xf4f0e8, view: 1.3,
      hotspots: [
        { id: '401', at: [4.2, 0.6], label: 'Flat 401', flat: '401' },
        { id: '402', at: [4.2, 5.6], label: 'Flat 402', flat: '402' },
        { id: '403', at: [-1.8, 7.0], label: 'Flat 403', flat: '403' },
        { id: '404', at: [-6.0, 2.5], label: 'Flat 404', flat: '404' },
        { id: '405', at: [-1.2, -10.4], label: 'Flat 405', flat: '405' },
        { id: '406', at: [2.0, -5.3], label: 'Flat 406', flat: '406' },
        { id: 'core', at: [0.2, 0.2], label: 'Staircase & two lifts', title: 'Central staircase and two lifts', lines: ['One three-flight staircase wraps a central well', 'Two lifts, lobbies of 2.25 × 5.30 and 5.85 × 2.25', 'Fire-rated doors (F.R.D.) to every flat'] },
        { id: 'avs', at: [1.1, -8.3], label: 'Ventilation shafts', title: 'Air-ventilation shafts', lines: ['Four A.V.S. shafts ventilate the toilets', 'A service duct beside the north-west toilets', 'Kitchens and toilets stack floor to floor'] },
        { id: 'chajja', at: [11.8, 1.6], label: '0.60 m chajjas', title: '0.60 m cantilevered chajjas', lines: ['0.60 m chajjas over every window', '0.15 m cornices at the floor bands', '0.30 m chajja over the staircase windows'] },
      ],
      schedule: {
        note: 'Room sizes are the architect’s figures on the 2nd–5th floor plan; area is the sum of the listed rooms (indicative, not the RERA carpet area).',
        rows: [
          { flat: '401', type: '1 BHK', rooms: [['Living', 3.05, 4.55], ['Bedroom', 2.75, 3.25], ['Kitchen', 2.15, 2.25], ['Toilet', 2.0, 1.2], ['Toilet', 1.4, 1.2], ['Passage', 1.85, 0.9]] },
          { flat: '402', type: '1 BHK', rooms: [['Living', 3.05, 4.55], ['Bedroom', 2.75, 3.25], ['Kitchen', 2.15, 2.25], ['Toilet', 2.0, 1.2], ['Toilet', 1.4, 1.2], ['Passage', 1.85, 0.9]] },
          { flat: '403', type: '2 BHK', rooms: [['Living', 2.75, 5.0], ['Bedroom', 3.05, 3.0], ['Bedroom', 3.2, 3.2], ['Kitchen', 2.3, 2.2], ['Toilet', 1.85, 1.45], ['Toilet', 1.8, 1.45]] },
          { flat: '404', type: '1 BHK', rooms: [['Living', 5.15, 2.75], ['Bedroom', 2.6, 2.75], ['Kitchen', 2.15, 2.1], ['Toilet', 1.9, 1.1], ['Passage', 3.7, 0.9]] },
          { flat: '405', type: '2 BHK + study', rooms: [['Living', 2.75, 5.35], ['Dining', 2.8, 2.3], ['Bedroom', 2.9, 2.75], ['Bedroom', 3.15, 3.05], ['Study', 3.15, 2.1], ['Kitchen', 2.1, 2.95], ['Toilet', 2.9, 1.1], ['Toilet', 1.2, 1.75], ['Toilet', 1.9, 1.2]] },
          { flat: '406', type: '2 BHK', rooms: [['Living', 5.7, 2.75], ['Bedroom', 3.45, 2.75], ['Bedroom', 3.15, 2.75], ['Kitchen', 2.15, 2.1], ['Toilet', 2.05, 1.15], ['Toilet', 2.1, 1.2], ['Toilet', 2.1, 1.15]] },
        ],
      },
    },
    story: [
      { id: 'arrive', step: '01 · Arrival', kicker: 'Dadamiya Infrastructure LLP', title: 'Mansouza CHSL', copy: 'A society redevelopment: ten residential floors over a stilt, on a plot that narrows towards the road. The compound wall follows the plot, the building steps with it.' },
      { id: 'stilt', step: '02 · Stilt & podium', kicker: 'Ground and first floor', title: 'Puzzle parking', copy: 'Mechanical puzzle parking fills the stilt and continues on the first-floor deck beside the society office; the entrance lobby, pump room and meter room sit at the core.' },
      { id: 'stack', step: '03 · The stack', kicker: 'Ten floors', title: 'Floor by floor', copy: 'The floors separate to show how the plan changes up the building: 2nd to 5th, 6th to 8th, 9th and the 10th with its pocket terrace.' },
      { id: 'floor', step: '04 · Typical floor', kicker: 'Cut away at the 4th floor', title: 'Around one staircase', copy: 'Flats of 1 and 2 BHK wrap the single staircase and the two lifts; ventilation shafts serve the toilets; 0.60 m chajjas shade every window.' },
      { id: 'terrace', step: '05 · Terrace', kicker: '+31.95 m', title: 'Tanks and machine rooms', copy: 'Two overhead water tanks, the lift machine rooms and the stair headroom stand on the terrace above a 1 m parapet.' },
      { id: 'night', step: '06 · By night', kicker: 'Evening', title: 'Lit from within', copy: 'The tower by night, windows warm against the sky.' },
    ],
  },
};

export const PROJECT_LIST = Object.values(PROJECTS);
export const getProject = (slug) => PROJECTS[slug] || null;
export const levelLabelOf = (project, level) => (project.levels.find((l) => l[0] === level) || [])[2] || level;
