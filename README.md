# The Sahil — website (Next.js)

Next.js 15 (App Router) site for The Sahil, Mahim. Deploys to Vercel with no configuration.

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
- **Free-plan notice** (`components/PlanNotice.jsx`, `lib/plan.js`): set `NEXT_PUBLIC_PLAN_PROVIDER`
  and `NEXT_PUBLIC_PLAN_CONTACT_URL`; set `NEXT_PUBLIC_PLAN=pro` to remove it once purchased.

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
