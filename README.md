# 3D property showcases — website (Next.js)

Next.js 15 (App Router) site hosting three projects from one deployment. Deploys to Vercel with no configuration.

```
/                       Storey platform landing (components/Landing.jsx + app/landing.css, data in lib/platform.js):
                        pinned hero scrubs a live model (ghost → assembled → exploded → cut-away → night), manifesto,
                        pipeline with the stepping plan sketch (components/PlanSketch.jsx), capabilities, live projects, numbers, CTA
/sahil, /sahil/units    The Sahil, Mahim: the bespoke map + 3D scroll tour and the flat units page (below)
/krishna-kaveri         Krishna Kaveri (Dadamiya Infrastructure): GSAP scroll tour of the stilt + 5 building and its three furnished unit types
/krishna-kaveri/showroom, /mansouza/showroom
                        full-screen 3D showroom (components/Showroom.jsx + app/showroom.css, presets and hotspots in lib/showroom.js)
/mansouza               Mansouza CHSL (Dadamiya Infrastructure): GSAP scroll tour of the stilt + 10 redevelopment
lib/projects.js         project registry: names, facts, levels, model names, story sections, unit models and bounds
lib/projectStage.js     generic three.js stage for the per-level Dadamiya models (cut-away, explode, night, unit overlay)
components/GsapTour.jsx GSAP ScrollTrigger tour: camera orbit scrubbed per section, panel reveals, counters, progress rail
```

`/units` redirects to `/sahil/units`. The free-plan notice (watermark, bar and upgrade dialog) was removed: the site
demonstrates any of the three projects to a prospect without flags or environment variables.

## The Sahil

```
app/page.jsx            scroll tour (home)           components/Tour.jsx + lib/tour.js
app/units/page.jsx      flat units overview          components/UnitsView.jsx + lib/units.js
lib/scene.js            createBuilding (per-floor GLB loading, focus/slice/explode/night state) + createViewer (three.js canvas for /units)
lib/stage.js            createTowerStage: full-screen three.js scene for the home tour (lighting, shadows, reflections, drag to look)
lib/world.js            procedural setting: sky, sea and beach, streets, neighbours, palms, trees, cars
lib/interiors.js        furnished interiors (residence, lobby, gym, rooftop) after the brochure
lib/map.js              createMapStage: MapLibre map of Mahim with the tower, the exterior half of the tour  components/MapControls.jsx
app/globals.css         brochure design system
private/models          sahil_core.glb (exterior, 492 KB) + sahil_detail.glb (interiors, 280 KB), meshopt-compressed, served only via app/api/scene
public/assets/img       brochure renders (WebP + JPEG), logos, icons
```

## Virtual tour

The home page is a scroll-driven virtual tour with no pictures: every view is the 3D model.
Two stages share one camera path in the model's metre frame and cross-fade as you scroll
(`lib/tour.js`, `KEYS`, each with `mode: 'map' | '3d'`):

- **The real map** (`lib/map.js`): MapLibre with the tower on its plot for arrival, the aerial,
  the sea view, the location (chips and drive times fly the map), the street and the night view.
- **The 3D world** (`lib/stage.js` + `lib/world.js`): the tower in a procedural setting for the
  lobby, the cut-away 12th floor and its plan, an eye-level walk through the residence (living
  and dining, kitchen, master bedroom, namaz room), the 3rd-floor gym and the rooftop (pool, café,
  sit-out). Eye-level keyframes (`walk: true`) glide in straight lines with a wider lens; dragging
  turns the head. Changing floors, the camera steps out through the glass and back in.

### Furnished interiors

`lib/interiors.js` furnishes the floors after the brochure renders and plan. The brochure floor
plan registers exactly with the model (stair core and lift shafts coincide), so positions are
read off the plan in pixels (`X()/Z()`). The structural model's own partitions differ from the
brochure layout, so a furnished floor hides them (`REPLACED_CATS`) and draws the plan's walls,
floors, ceilings (timber panels, LED coves, downlights) and glazing instead.

- Typical residence (every floor 4–22): four bedrooms with platform beds, tub chairs and
  panelled walls, a U sofa under the crystal chandelier, marble dining for eight, a curved gloss
  kitchen with a stone worktop and jali screens, baths, wardrobes, a namaz room with a lit mihrab
  on the wall that faces the qibla, and the lift lobby.
- Ground floor: entrance lobby. 3rd floor: fitness centre. Terrace: pool deck under a louvred
  pergola, café kiosk with a canopy roof carrying a timber roof deck (stair, glass balustrade,
  planters), curved sit-out, planters and bollards.

Materials are PBR surfaces from **Poly Haven (CC0)** in `public/assets/tex` (marble, oak,
plaster, velvet, brick, pavers, deck timber…, 1k WebP). Hero furniture is either Poly Haven
models in `public/assets/models/ph` (lounge and arm chairs, marble drum tables, dining chairs,
chandelier, globe pendant, plants, slatted cabinet, bistro set, bar stools; simplified with
gltf-transform, 512 px WebP textures, ~2.7 MB in all) or modelled in code with rounded, smooth
geometry (sofas, beds, tub chairs, the kitchen run, pendants, the café, the pergola).
Sanitaryware and a few utility pieces are Kenney's **Furniture Kit (CC0)** in
`public/assets/models/furniture`. Licence notes sit alongside each folder. `createBuilding`
(lib/scene.js) builds a floor's interior the first time it is in focus, so the Flat Units page
shows furnished floors too.

### Walk-through camera

Eye-level keyframes (`walk: true` in `lib/tour.js`) glide along routes rather than straight
lines: `via` waypoints take the camera through the flat's doors and hall from room to room; a
change of floor backs the camera out through the south glass, rides the façade and dollies in
again; exterior shots arrive at an eye-level stop by orbiting to a point outside the glass and
dollying in (and leave by backing out first). While a walk stop is active the focused floor's
façade skin is hidden (`open` state in `lib/scene.js`), so the room shows through the glass on
the way in and out. `window.__tour.settled` reports when the damped camera has reached its
keyframe (used by screenshot tooling).

## Map stage

OpenFreeMap "liberty" style, the tower on its plot through a three.js custom layer. Knobs in `lib/map.js`:

- `SITE` — plot centre lng/lat (19.038245, 72.839001; 122/124 SVS Road, seaward side of the road).
- `MODEL_BEARING` — compass bearing of the GLB's +Z side (curved bay).
- `VIEWS` — camera presets for the chips (plot, from the sea, shoreline, neighbourhood, Mumbai).
- `DESTINATIONS` — the brochure drive-time places; the list in the panel flies the map to each one.

## Visitors, model protection and plan notice

- **Visitor tracking**: Vercel Web Analytics (`<Analytics />` in `app/layout.jsx`). Turn it on in
  Vercel → Project → Analytics; visitors, page views, countries and referrers show there. No cookies.
- **Model protection** (`lib/sceneGuard.js`, `app/api/scene/*`): the GLBs are not public files. The
  page opens a 5-minute scene session, then fetches each model AES-encrypted and decrypts it in
  memory. Requests without browser Fetch Metadata, from bots/AI agents/scripts (by user agent) or
  with a token from another browser get 403/404. `app/robots.js` and `noai` headers turn AI crawlers
  away. Set `SCENE_SECRET` (any long random string) in Vercel. This stops scrapers and casual
  downloads; nothing rendered in a browser can be made impossible to capture.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Deploy to Vercel

1. The repo lives at https://github.com/faisu/the-sahil.
2. In Vercel, **Add New Project → Import** that repo. The Next.js preset is detected from `vercel.json`/`package.json`; no build settings needed (build `next build`, output `.next`, Node 20).
3. Optional: set `NEXT_PUBLIC_SITE_URL` to the production domain so Open Graph URLs are absolute.

Or from the terminal:

```bash
npx vercel
```

`next.config.mjs` sets one-year immutable caching for everything under `/assets/`, so change a
filename when you replace a model or image.

## Dadamiya projects (Krishna Kaveri, Mansouza)

The models come from `../tools/dadamiya` (see `../Dadamiya/DADAMIYA_NOTES.md`). `split_floors.py KK|MZ
private/models` writes `kk_core.glb`/`kk_detail.glb` and `mz_core.glb`/`mz_detail.glb` with one node per level
and category (`G_ArchWalls`, `F03_Glass`, …), compressed with gltf-transform meshopt; the furnished units are
`kk_unit_A/B/C.glb` (meshopt + WebP). All of them are served through the same encrypted `/api/scene` route
(`lib/sceneGuard.js` `MODEL_FILES`). The tour's keyframes are derived from the project's bounds and levels in
`lib/projects.js`; to add a project, add its entry there and its models to `private/models`.

## 3D showroom (Krishna Kaveri, Mansouza)

`/krishna-kaveri/showroom` and `/mansouza/showroom` reuse `lib/projectStage.js` (created with `drag: false`; the
showroom runs its own persistent orbit) and the tour's camera keyframes (`lib/tourKeys.js`):

- drag to orbit, pinch / wheel / +− to zoom, arrow keys; turntable; reset
- Exterior / Interior toggle (interior = furnished cut-away of the typical floor; the unit models load on first visit)
- presets: façade, aerial, stilt, terrace, floor stack, typical floor (`showroomViews`; `fit` keeps them framed on any screen)
- hotspots on the exterior (`exteriorHotspots`; anchors are model points or a mesh category's bounding box) and on the
  floor (`project.finish.hotspots`), each opening a card; flat pins open the flat
- flat-type picker: each furnished unit as a dollhouse with its rooms and modelled area
- floor by floor: each storey from outside (camera level with it, the storey outlined; `facadeLevelOrbit`) or cut away
- exploded stack, fullscreen, share link (`?view=`, `?unit=`, `?level=`, `?storey=`, `&t=` clock hours, `&d=` day of year;
  the old `&night=1` opens at 20:30)
- the real look (`createProjectStage(..., { real: true })`, `lib/atmosphere.js`): flat paint colours with a slight
  shader mottle (`PAINT`, `project.paint`), a Preetham sky with procedural clouds and a blue hour after sunset,
  reflections baked from that sky, and the sun at its true position for Mumbai (19.07° N, 72.88° E, IST) at the clock
  time and date, casting shadows. Drawing north is taken as true north (`project.north`, radians, rotates it). After
  dark single window panes light up per room, warm-white street lamps along an indicative footpath throw pools of
  light, the stilt is lit and the low-rise neighbours show lit windows. An indicative road with kerb and parked cars
  sits on the gate side (`project.road.side`), with trees round the plot; anything that would stand between the camera
  and the building fades out. `project.viewFrom: 'north'` mirrors the exterior presets to the gate side and
  `project.hour` sets the opening time
- Krishna Kaveri's facade model carries the architect's detailing as extra categories (`Trim`, `Ironwork`, `Grills`,
  `Signage`, `SignLogo`; grills and signs are alpha cards with `kk_grill` / `kk_sign` / `kk_logo` textures) and a baked
  ambient-occlusion atlas on the second UV set (`project.ao`, `public/assets/tex/kk_ao.webp`). Models without normals
  get flat ones on load
- image finishing (`lib/postfx.js`, three's own passes): tiers `high` (MSAA 4x, GTAO, bloom, grade), `mid` (no GTAO),
  `low` (MSAA 2x, bloom after dark only; where phones start) and `off`. The stage drops a tier when the median frame
  runs over 30 ms (45 ms on `low`); `?fx=high|mid|low|off` forces one
- furnished Krishna Kaveri flats carry their room lighting baked into the glTF occlusion slot on the second UV set
  (`project.unitLight`); the real look uses it as a light map (sRGB, stepped back by day), the plain look as AO.
  Ceiling fittings are named `ceil_*` and wall points `elec_*`, and are hidden in the top-down floor cut-away
- stills (`project.stills`, `public/assets/img/kk/`): the Photo button fades to a path-traced still of the current
  preset (`hero_<view>_<day|dusk|night>.webp`, picked from the sun's height) or of the flat's living room
  (`unit_<X>_living.webp`); touching the model returns to live. The 360° button opens the flat's panorama
  (`unit_<X>_pano.webp`, `components/PanoView.jsx`; `pano.heading` is the starting direction in degrees)
- flats by floor (`project.flatLevels`, Krishna Kaveri): Interior shows a floor with its flats as plain coloured
  blocks, one colour per type (`lib/flatColors.js`; blocks are the unit `outline`s mirrored by `finish.copies`), with a
  chip per floor giving its flat count. Nothing furnished is loaded until a flat is picked (block, lettered pin or
  legend). The picked flat's unit model is then placed at that floor and mirror position (`state.unitAt`), and a strip
  of room chips (read from the model's `Floor_<id>_<kind>` plates, `stage.unitRooms`) puts the camera inside a room at
  eye level with the ceiling back on (`state.inside`; drag looks around, zoom changes the field of view); rooms too
  small to stand in are shown from above. Share links carry `&floor=`, `&pos=sx,sz` and `&room=<key>`.
  `project.cars: false` hides the stilt cars and the indicative road cars
- room to room: the standing point of a room is the spot of its floor plate farthest from the walls and the furniture
  (`standPoint` in `lib/projectStage.js`: 15 cm grid, furniture by the bounding box of each named piece), facing the
  furniture. While standing somewhere a bar gives previous / next / the way out (`.sr-walk`), and signposts
  (`.sr-pin.go`) mark the four nearest other places; both come from one `nav` list in `components/Showroom.jsx`. The
  unit models carry a `Lobby` node (a stub of the lift lobby beyond the main door) that is shown only from inside
- ground-floor walk (`project.groundTour`, Krishna Kaveri): eye-level stops on the stilt taken from the labels of the
  stilt floor plan (`at: [x, z]`, `look` = compass heading, optional `pitch` up), reached from "Walk the ground floor"
  on the stilt preset or the Ground chip of the floor strip; same bar and signposts; share link `?walk=<stop id>`
- the clock (`components/SunClock.jsx`): 24-hour dial (drag the sun), slider, presets (sunrise, morning, noon, golden
  hour, dusk, night, now), season (today, equinoxes, solstices) and a time-lapse of the day
- a seven-step first-visit walkthrough (remembered in localStorage), an info sheet listing what the model does not have

## Rebuilding the 3D model

From the repo root (needs `trimesh`, `rtree`, `numpy` and `@gltf-transform/cli`). The source
model `sayyed_house_full.glb` and `building_spec.json` come from the DWG extraction and are kept
outside this repo:

```bash
python3 tools/split_floors.py /path/to/sayyed_house_full.glb /path/to/building_spec.json
cd private/models
npx @gltf-transform/cli optimize sahil_core.glb sahil_core.glb --compress meshopt --instance false --join false --flatten true
npx @gltf-transform/cli optimize sahil_detail.glb sahil_detail.glb --compress meshopt --instance false --join false --flatten true
```

See `FEASIBILITY.md` for the evaluation, loading strategy and launch checklist.
