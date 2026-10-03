# The Sahil — website (Next.js)

Next.js 15 (App Router) site for The Sahil, Mahim. Deploys to Vercel with no configuration.

```
app/page.jsx            scroll tour (home)           components/Tour.jsx + lib/tour.js
app/units/page.jsx      flat units overview          components/UnitsView.jsx + lib/units.js
lib/scene.js            createBuilding (per-floor GLB loading, focus/slice/explode/night state) + createViewer (three.js canvas for /units)
lib/map.js              createMapStage: MapLibre map of Mahim with the tower on its plot, driven by the tour  components/MapControls.jsx
app/globals.css         brochure design system
public/assets/models    sahil_core.glb (exterior, 492 KB) + sahil_detail.glb (interiors, 280 KB), meshopt-compressed
public/assets/img       brochure renders (WebP + JPEG), logos, icons
```

## Map stage

The home page stage is a MapLibre GL map (OpenFreeMap "liberty" style, no API key) that stays
fixed behind every section. A three.js custom layer renders `sahil_core.glb` on the plot the way
the MapLibre "Add a 3D model using three.js" example does, and `lib/tour.js` drives the map camera
from the same metre-based cam/look keyframes the three.js viewer used (converted with
`map.calculateCameraOptionsFromTo`), so each section is demonstrated on the real plot with Mahim
Bay in view. Knobs in `lib/map.js`:

- `SITE` — plot lng/lat (122/124 SVS Road, seaward side of the road; indicative).
- `SEA_BEARING` — compass bearing the curved sea-facing bay points to (the GLB's +Z side).
- `VIEWS` — camera presets for the chips in the Location panel (plot, from the sea, shoreline, neighbourhood, Mumbai).
- `DESTINATIONS` — the brochure drive-time places; the list in the panel flies the map to each one.

Picking a chip or a destination pauses the scroll keyframes ("back to the tour" or scrolling to
the next section resumes them). Figures and icons with `data-view` (gallery pictures, amenity
icons) zoom the model to that amenity on hover, focus or tap; the presets live in `VIEWS` inside
`lib/tour.js`. Night mode dims the basemap with a CSS filter on the stage and lights the glass.

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
cd public/assets/models
npx @gltf-transform/cli optimize sahil_core.glb sahil_core.glb --compress meshopt --instance false --join false --flatten true
npx @gltf-transform/cli optimize sahil_detail.glb sahil_detail.glb --compress meshopt --instance false --join false --flatten true
```

See `FEASIBILITY.md` for the evaluation, loading strategy and launch checklist.
