// The idea the landing page presents: Storey, a personal side project exploring immersive real-estate
// experiences built from architects' drawings. The hosted projects (lib/projects.js) are its live case studies. Copy, numbers
// and section data live here so the landing component stays layout-only.
import { PROJECT_LIST } from './projects';

export const PRODUCT = {
  name: 'Storey',
  byline: 'a side project',
  tagline: 'Every building has a storey.',
  // what the product does, one breath
  pitch: 'Storey turns the architect’s drawings into a living 3D world. Buyers scroll through the arrival, the stack of floors, a cut-away plan and the furnished flats, on any phone, before the first slab is cast.',
  heroProject: 'krishna-kaveri',   // the model the landing hero assembles (a per-level Dadamiya model)
};

// Hero phases, scrubbed by scroll while the hero is pinned. `t` is the progress at which the
// phase's state is reached; the building state keys match lib/projectStage.js.
export const HERO_PHASES = [
  { id: 'draw',  t: 0.00, step: '01', title: 'Drawings in',        copy: 'Plans, sections and elevations are read straight from AutoCAD. The building is traced, not redrawn.', alpha: 0 },
  { id: 'stack', t: 0.34, step: '02', title: 'Every floor, a layer', copy: 'Each level is its own model. Pull the stack apart and the plan repeats floor by floor.', explode: 1 },
  { id: 'floor', t: 0.66, step: '03', title: 'Cut it open',         copy: 'Slice at any floor to look down into the flats, the cores and the courtyard.', cut: 1, focus: true },
  { id: 'night', t: 1.00, step: '04', title: 'Lights on',           copy: 'Day to night on the same model. Warm windows, open sky, nothing rendered in advance.', night: 1 },
];

// Words that scroll in the ticker between the hero and the manifesto: everything a viewer can do.
export const TICKER = ['Arrival', 'The real street', 'The stack', 'Cut-away floor', 'Furnished flats', 'Walk-through', 'Rooftop', 'Drive times', 'Sea view', 'By night', 'Phone first', 'One link'];

export const MANIFESTO = {
  problem: ['Brochures are flat.', 'Renders are fiction.', 'Site visits are Saturdays.'],
  answer: 'A Storey is built from the real drawings, so what the buyer explores is what gets built. Plans, sections, furniture layouts and electrical drawings become one world: the building on its street, every floor a layer, every flat furnished, day and night.',
};

// The pipeline, one step per sketch stage in components/PlanSketch.jsx.
export const PIPELINE = [
  { n: '01', title: 'Drawings in', copy: 'AutoCAD plans, sections and elevations are read directly. Walls, windows, doors, stairs, lifts and shafts are extracted floor by floor.' },
  { n: '02', title: 'A building that comes apart', copy: 'Each level becomes its own layer, so the camera can lift the stack apart, cut the building open at any floor and single out one flat.' },
  { n: '03', title: 'Furnished from the layouts', copy: 'Furniture and electrical drawings place every bed, wardrobe, fan and switchboard. Finishes follow the specification, materials are physically based.' },
  { n: '04', title: 'Placed in the city', copy: 'The tower stands on its real plot on a live street map. Landmarks, drive times and the sea view are a scroll away.' },
  { n: '05', title: 'Told as a story', copy: 'Arrival, stilt, stack, floor, flats, terrace, night. The scroll is the script and the camera is the narrator.' },
  { n: '06', title: 'Delivered, protected', copy: 'One link, no app. The model streams encrypted to the viewer’s browser only, and a 22-storey tower weighs less than one brochure photograph.' },
];

export const CAPABILITIES = [
  { id: 'camera', title: 'Scroll-driven camera', copy: 'Orbits, dollies and eye-level walks scrubbed by the scrollbar. Drag to look around at any moment.' },
  { id: 'cut', title: 'Cut-away at any floor', copy: 'Floors above fade to a ghost and vanish, leaving the plan readable from above.' },
  { id: 'explode', title: 'Exploded stack', copy: 'The levels lift apart to show how the plan changes up the building.' },
  { id: 'furnish', title: 'Furnished flats', copy: 'Every unit type furnished from the architect’s furniture and electrical layouts, in dollhouse view.' },
  { id: 'map', title: 'Real-map arrival', copy: 'The building on its plot on a live street map, with landmarks, drive times and the view.' },
  { id: 'night', title: 'Day to night', copy: 'One scroll from afternoon sun to lit windows, on the same model.' },
  { id: 'phone', title: 'Phone first', copy: 'The model folds into a strip under the title on phones; the story scrolls beneath it.' },
  { id: 'lock', title: 'Encrypted delivery', copy: 'Models are streamed AES-encrypted to a short-lived browser session. Crawlers and downloaders get nothing.' },
  { id: 'analytics', title: 'Visitor analytics', copy: 'Which floor, which flat, how far down the story each visitor scrolled.' },
];

export const AUDIENCES = [
  { who: 'Developers', title: 'Launch before the sample flat', copy: 'One link for the website, the WhatsApp broadcast and the QR on the hoarding. Every prospect walks the same building, the one in the drawings.' },
  { who: 'Channel partners', title: 'Close across the table', copy: 'Open the flat on a phone, cut the floor open, turn the lights on. The buyer sees their flat, not a render of somebody else’s.' },
  { who: 'Architects', title: 'Your drawings, faithfully', copy: 'Nothing is invented, nothing is moved. Partitions, shafts, chajjas and stair cores land exactly where the DWG puts them.' },
];

// Numbers on the page, derived from what is hosted (lib/projects.js) and the model files in
// private/models. Update the model sizes when the GLBs are rebuilt.
const MODEL_KB = { sahil: 492 + 280, 'krishna-kaveri': 234 + 31, mansouza: 359 + 36 };
const LEVELS = { sahil: 25, 'krishna-kaveri': 7, mansouza: 12 };   // B, G, 22 floors and the terrace; stilt + 5 + terrace; stilt + 10 + terrace
export const STATS = [
  { n: PROJECT_LIST.length, label: 'live projects' },
  { n: Object.values(LEVELS).reduce((a, b) => a + b, 0), label: 'levels modelled' },
  { n: 4, label: 'unit types furnished' },
  { n: Math.round(Object.values(MODEL_KB).reduce((a, b) => a + b, 0) / 1024 * 10) / 10, label: 'MB for all three buildings', dec: 1 },
];
