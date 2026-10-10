# The Sahil — website (Next.js)

Next.js 15 (App Router) site for The Sahil, Mahim. Deploys to Vercel with no configuration.

```
app/page.jsx            scroll tour (home)           components/Tour.jsx + lib/tour.js
app/units/page.jsx      flat units overview          components/UnitsView.jsx + lib/units.js
lib/scene.js            createBuilding (per-floor GLB loading, focus/slice/explode/night state) + createViewer (three.js canvas for /units)
lib/stage.js            createTowerStage: full-screen three.js scene for the home tour (lighting, shadows, reflections, drag to look)
lib/world.js            procedural setting: sky, sea and beach, streets, neighbours, palms, trees, cars
lib/map.js              createMapStage: MapLibre map of Mahim in the Location panel  components/MapControls.jsx
app/globals.css         brochure design system
private/models          sahil_core.glb (exterior, 492 KB) + sahil_detail.glb (interiors, 280 KB), meshopt-compressed, served only via app/api/scene
public/assets/img       brochure renders (WebP + JPEG), logos, icons
```

## 3D stage

The home page stage (`lib/stage.js`) is a full-screen three.js scene that stays behind every
section: the tower from `lib/scene.js` in a procedural setting from `lib/world.js` — a sky dome
with clouds (stars at night), Mahim Bay with surf and a sand beach to the west, SVS Road, the
cross street and the street that runs up to the south face, low-rise neighbours, palms, trees and
cars. A low warm sun from the sea side, soft shadows and sky reflections in the glass follow the
brochure renders (`tower-day`, `aerial`, `rooftop-aerial`, `tower-night`). The façade skin has a
roughness/metalness mask so the glass mirrors the sky while the bronze frames stay satin.

`lib/tour.js` drives the camera from scroll with metre-based keyframes (`KEYS`): street level up to
the south face (cover, as in the day render), the brochure aerial, the 20th-floor sea bay, a
pulled-back view of the plot and the bay, the sliced 12th floor and its rooms, the rooftop pool
and deck, the entrance off SVS Road and the night crown. Each keyframe can pin a **callout** to
the part of the tower in view; the floor in focus gets a glowing outline instead of ghosting the
rest of the tower, and neighbours/trees fade back for the cut-aways. Visitors can **drag** (or
swipe sideways on a phone) to look around; the view eases back to the framed shot on the next
section. Figures and icons with `data-view` zoom the model to that amenity (`VIEWS`).

**Phones:** the first screen is the tower full-bleed under the title; scrolling folds the stage
into a strip under the nav (a clip-path, so the canvas never resizes) and the tour panels run
beneath it, each one re-framing the model in the strip.

## Location map

The Location panel carries its own MapLibre map (`lib/map.js`, created when the panel comes near):
OpenFreeMap "liberty" style, the tower on its plot through a three.js custom layer, cooperative
gestures so the wheel keeps scrolling the page. Knobs in `lib/map.js`:

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
